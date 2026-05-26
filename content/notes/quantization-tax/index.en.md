---
title: "LLM Quantization on RTX 4060: Where 4-bit Decode Falls Behind FP16"
date: 2026-05-23
tags: ["mlsys"]
math: true
draft: false
cover: "cover.png"
---

{{< figure src="cover.png" alt="Why is 4-bit quantized inference slower? VRAM ↓60%, speed ↓27%" >}}

<aside>

#### TL;DR

- On an RTX 4060 Laptop, Qwen2.5-1.5B at 4-bit quantization cuts VRAM from 3.1GB to 1.2GB, but decode throughput drops from 7.4 to 5.8 tok/s -- 27% slower.
- The main culprit is bitsandbytes' non-fused dequantization path: weights are first unpacked from 4-bit back to FP16, written to VRAM, then read again by GEMV. Effective memory traffic per weight goes from 2 bytes (FP16) to roughly 4.5 bytes.
- This "quantization tax" is especially visible in GQA's K/V projection layers; these matrices are smaller, so dequantization and memory overhead account for a larger share of total time, with per-layer slowdowns as high as 380%.
- I wrote a fused dequant-GEMV kernel in Triton that keeps dequantization on-chip. After replacing K/V projection layers, decode throughput recovered to 6.7 tok/s, reclaiming 16%.
- Code: [AkikoAkaki/llm-quant-profiler](https://github.com/AkikoAkaki/llm-quant-profiler).

</aside>

I recently did a small project measuring real 4-bit quantized inference performance on my laptop's RTX 4060 GPU. This was my first AI Infra project -- I had no background in AI Infra or MLSys before this. I filled in some foundational knowledge along the way, which I'll write up and post separately.

During LLM text generation, the decode phase reads a large portion of the model's weights from VRAM for every token it generates, and those weights each participate in just one computation per token. Low compute demand, high memory pressure -- a textbook memory-bound workload.

My initial hypothesis was simple: when LLM weights go from FP16 to 4-bit (FP4/NF4/INT4), memory footprint drops, decode is memory-bound, so inference should get faster. Or at least not noticeably slower.

What I actually measured: `Qwen2.5-1.5B-Instruct + RTX 4060 Laptop 8GB`, bitsandbytes 4-bit quantization, VRAM dropped from 3.1GB to 1.2GB -- about 60% less. But decode went from 17.40s to 22.10s, 1.27x slower.

VRAM was saved, but inference didn't speed up; it got slower. Were the bandwidth savings wiped out by the overhead of dequantization?

### Background

#### Prefill and Decode

LLM inference has two phases. Prefill processes the entire prompt at once -- input may be hundreds of tokens, and Linear layers run matrix-matrix multiplication (GEMM), consuming both compute and bandwidth. Decode generates one token per step; with batch=1, Linear layers reduce to matrix-vector multiplication (GEMV).

| Phase | Execution | Typical op | Bottleneck |
| --- | --- | --- | --- |
| Prefill | Process entire prompt at once | GEMM / attention | compute + memory |
| Decode | Generate one token per step | GEMV | memory bandwidth |

GEMV arithmetic intensity is low. For an $M \times N$ weight matrix, GEMV performs $2MN$ floating point operations (one multiply and one add per element), but reads $MN$ weights. At FP16, 2 bytes per weight, arithmetic intensity is approximately:

$$\text{AI} = \frac{2MN}{MN \times 2} = 1 \text{ FLOP/Byte}$$

One floating point operation per byte of data moved -- bottleneck is entirely memory bandwidth. RTX 4060 Laptop bandwidth is 272 GB/s, FP16 peak compute ~22 TFLOPS, ridge point at $22000 / 272 \approx 80$ FLOP/Byte. Decode arithmetic intensity of 1 is nearly two orders of magnitude below the ridge point.

#### Standard Expectation from Quantization

Since decode is memory-bound, the intuition is that lower-bit quantization should help: compressing weights from FP16 (2 bytes) to 4-bit (0.5 byte) reduces data moved by 4x, significantly lowering memory bandwidth pressure.

bitsandbytes is one of the most widely used quantization libraries. Pass `BitsAndBytesConfig(load_in_4bit=True)` at load time, and it automatically replaces all `nn.Linear` with `Linear4bit`. Internally it uses NF4 (Normal Float 4) encoding -- a nonlinear 4-bit format designed for normally distributed weights, with 16 unevenly distributed code points. Quantization is block-wise (default blocksize=64), with each block sharing one FP32 scale (absmax). Two 4-bit values are packed into one uint8 -- very storage-efficient.

The issue: during inference, the GPU cannot do matrix multiplication directly in 4-bit format; it must first dequantize back to FP16. The implementation of that dequantization step determines whether quantization actually saves bandwidth or wastes it.

### Experiment Setup

| Item | Config |
| --- | --- |
| Model | `Qwen/Qwen2.5-1.5B-Instruct` |
| GPU | RTX 4060 Laptop 8GB |
| Memory bandwidth | 272 GB/s |
| FP16 peak compute | ~22 TFLOPS |
| Environment | WSL2 Ubuntu |
| Tools | PyTorch / Transformers / bitsandbytes / Triton |
| Input | 512-token prompt |
| Decode steps | 128 |
| Repetitions | 3 |

Three modes compared: FP16 baseline, bitsandbytes 4-bit baseline, and a hand-written Triton fused dequant-GEMV kernel.

On naming: in my experiment logs I abbreviated the baseline as INT4, but strictly speaking bitsandbytes' 4-bit path involves FP4/NF4/INT4 and other encodings -- it's not equivalent to integer INT4. I'll write "4-bit" throughout. My Triton kernel is also not strict INT4: it reads packed 4-bit weights, unpacks 4-bit indices inside the kernel, looks up the 16-entry codebook, multiplies by blockwise scale, and accumulates directly for GEMV.

#### Profiling Methodology

Per-layer timing uses PyTorch's `register_forward_pre_hook` and `register_forward_hook` with CUDA Events.

Why not `time.time()`? GPU execution is asynchronous. When the CPU calls `layer(x)`, it just queues the instruction in the CUDA stream and returns immediately -- the GPU may not have started yet. `time.time()` measures "time to submit the task to the queue," nearly zero, not actual GPU time. `torch.cuda.Event` inserts timestamps into the GPU queue; reading them after `synchronize()` waits for the GPU to actually finish -- that's real latency.

Why not `model.generate()`? `generate()` wraps the entire token generation loop. With hooks, you can't tell which token you're on or whether it's prefill or decode. Writing a manual decode loop and explicitly calling forward once per step lets you precisely control what gets recorded and cleanly separate prefill and decode data. Each run collects 6300+ per-layer records.

### End-to-End Results

| Mode | Prefill | Decode | Throughput | VRAM |
| --- | ---: | ---: | ---: | ---: |
| FP16 | 0.25s | 17.40s | 7.4 tok/s | 3100 MB |
| 4-bit bitsandbytes | 0.27s | 22.10s | 5.8 tok/s | 1227 MB |
| 4-bit + fused k/v | 3.20s | 19.09s | 6.7 tok/s | 1227 MB |

VRAM dropped from 3100MB to 1227MB. But decode dropped from 7.4 tok/s to 5.8 tok/s. VRAM saved, no speed gain.

### Layer-wise Profiling: Where Is the Problem?

Looking layer by layer, the worst degradation is in the attention `k_proj` and `v_proj` layers. In some layers, 4-bit k/v projection is 4-5x slower than FP16; the worst exceeds 350%.

This looks counterintuitive at first, since `k_proj`/`v_proj` aren't the largest Linear layers, yet they degrade the most.

#### Why k/v Projections

Qwen2.5-1.5B uses Grouped Query Attention (GQA). In standard Multi-Head Attention (MHA), Q, K, V projections have the same output dimension, all equal to hidden size. GQA lets multiple query heads share one group of key/value heads, so K and V have far fewer heads than Q. In Qwen2.5-1.5B:

```
q_proj: (1, 1, 1536) → (1, 1, 1536)   output 1536
k_proj: (1, 1, 1536) → (1, 1, 256)    output 256
v_proj: (1, 1, 1536) → (1, 1, 256)    output 256
o_proj: (1, 1, 1536) → (1, 1, 1536)   output 1536
```

k/v output dimension is only $1/6$ of q/o. Smaller matrix means fewer FLOPs, but dequantization overhead doesn't scale proportionally with matrix size -- per block, regardless of matrix size, you still need to read packed weights, look up the codebook, and multiply by scale. The smaller the matrix, the larger the share these fixed costs take in total time.

This is why the top-10 highest quantization-tax layers are all `k_proj` and `v_proj`, rather than the larger `q_proj`, `o_proj`, or MLP layers.

{{< figure src="fig1_layerwise_latency.png" caption="**Fig. 1**: Per-layer decode latency for Qwen2.5-1.5B. The 4-bit quantized version is slower than the FP16 baseline in most layers, with the effect most pronounced in the shallower layers." >}}

{{< figure src="fig3_top10_slowest.png" caption="**Fig. 2**: Top-10 layers with the highest quantization tax. The worst-affected layers are all `k_proj` and `v_proj`, with latency increases exceeding 350% at the extreme." >}}

On VRAM, 4-bit delivers on its promise. The figure below shows VRAM curves for both modes during decode -- FP16 stays around 3100MB, 4-bit around 1250MB, a stable gap throughout, with minimal KV cache growth over 128 steps. The bottleneck isn't cache growth; it's the dequantization path per layer.

{{< figure src="fig2_memory_growth.png" caption="**Fig. 3**: VRAM usage and growth during decode (128 steps). 4-bit keeps memory footprint stably around 1.2GB, down from 3.1GB, with negligible KV cache growth." >}}

### The Quantization Tax: A Byte-Accounting Model

FP16 weights read 2 bytes per element. 4-bit weights occupy only 0.5 byte per element -- looks like one quarter. But that's the storage format number; at runtime what matters is the actual execution path.

If 4-bit Linear's execution path is out-of-place dequantization:

```text
VRAM[4-bit weight]
  -> read 4-bit weight
  -> dequantize to FP16
  -> write FP16 buffer to VRAM
  -> read FP16 buffer
  -> GEMV
```

Then actual VRAM accesses per weight:

```text
0.5 byte  read 4-bit weight
+ 2.0 bytes write FP16
+ 2.0 bytes read FP16
= 4.5 bytes / weight
```

FP16 is only 2.0 bytes / weight.

4-bit aimed to save memory traffic, but the dequantization path decompresses weights to FP16, writes back to VRAM, then reads them again -- actual memory traffic is higher than FP16. This is the "quantization tax": the extra memory accesses from format conversion cancel out the bandwidth benefit.

#### Quantifying the Loss with the Roofline Model

The Roofline model is a standard tool for analyzing kernel performance. The x-axis is arithmetic intensity (FLOP/Byte), the y-axis is actual throughput (FLOP/s). A kernel's performance ceiling is determined by two lines:

- **Memory bandwidth ceiling**: when arithmetic intensity is low, performance is bandwidth-limited; throughput = bandwidth $\times$ arithmetic intensity, a diagonal line
- **Compute ceiling**: when arithmetic intensity is high, performance is compute-limited, a horizontal line

The intersection is the **ridge point**, the arithmetic intensity where compute and bandwidth are balanced. RTX 4060 Laptop ridge point is around 80 FLOP/Byte.

FP16 GEMV arithmetic intensity ~1 FLOP/Byte, already far left of the ridge point -- fully memory-bound. If the 4-bit path's actual memory traffic is 4.5 bytes/weight, arithmetic intensity drops to:

$$\text{AI}_\text{4-bit} = \frac{2MN}{MN \times 4.5} \approx 0.44 \text{ FLOP/Byte}$$

On the Roofline plot, 4-bit sits even further left than FP16 -- quantization doesn't shift the operating point right (more efficient); it shifts it left (less efficient).

{{< figure src="fig4_roofline.png" caption="**Fig. 4**: Roofline model analysis. Due to the VRAM round-trip introduced by out-of-place dequantization, the 4-bit path's arithmetic intensity drops to ~0.44 FLOP/Byte, pushing the operating point deeper into the memory-bound region." >}}

I didn't read through bitsandbytes' CUDA source line by line to verify it takes exactly this path internally. But this model matches the measurements: 4-bit decode is slower end-to-end, the slowest layers are small-matrix k/v projections, and throughput recovers after switching to a fused kernel.

### Fused Kernel: Moving Dequantization On-Chip

#### GPU Memory Hierarchy

Understanding why a fused kernel helps requires looking at the GPU's memory hierarchy:

```text
VRAM / HBM / GDDR6        ~272 GB/s    ← off-chip, slow
  ↓
L2 Cache (~32 MB)          ~3 TB/s
  ↓
L1 / Shared Memory (SRAM)  ~20 TB/s    ← on-chip, fast
  ↓
Registers
```

VRAM is off-chip storage; read/write goes through the memory bus with limited bandwidth. L1/Shared Memory (SRAM) is on-chip, one to two orders of magnitude faster than VRAM, and doesn't consume memory bus bandwidth.

bitsandbytes' problem: it allocates an FP16 buffer in VRAM, decodes 4-bit weights into it, then reads it back from VRAM for matmul. Two VRAM accesses, two bandwidth costs.

The fused kernel idea: read 4-bit weights into on-chip SRAM, decode in SRAM, multiply-accumulate directly, write the output. Intermediate results never touch VRAM.

```text
VRAM[4-bit weight]
  -> read 4-bit weight
  -> dequantize on chip (SRAM)
  -> directly accumulate into GEMV
  -> write output
```

#### Why Triton

CUDA C can do the same, but Triton operates at a higher abstraction level: programming in blocks, no manual shared memory allocation/synchronization, automatic warp scheduling and memory coalescing. For a relatively simple GEMV kernel like this, Triton significantly shortens development time.

#### Kernel Implementation

I wrote a fused dequant-GEMV kernel in Triton. It reads packed 4-bit weights, unpacks on-chip, looks up the codebook, multiplies by scale, accumulates in FP32, and writes FP16 output.

```python
from __future__ import annotations

import torch
import triton
import triton.language as tl

from phase3_utils import Linear4bitArtifacts


@triton.jit
def _fused_fp4_gemv_kernel(
    packed_ptr,               # packed uint8 weights, flattened [out * in / 2]
    absmax_ptr,               # block scale, shape [n_blocks], float32
    code_ptr,                 # FP4 codebook, shape [16], float32
    x_ptr,                    # input vector, shape [in_features], float16
    out_ptr,                  # output vector, shape [out_features], float16
    in_features,              # input dimension (1536)
    blocksize: tl.constexpr,  # elements per block (64)
    BLOCK_IN: tl.constexpr,   # >= in_features // 2, must be power of 2
):
    row = tl.program_id(0)

    n_packed = in_features // 2
    blocks_per_row = in_features // blocksize

    col_pairs = tl.arange(0, BLOCK_IN)
    mask = col_pairs < n_packed

    # read packed uint8
    packed = tl.load(
        packed_ptr + row * n_packed + col_pairs,
        mask=mask, other=0
    ).to(tl.int32)

    # unpack: each uint8 stores two 4-bit values
    hi = (packed >> 4) & 0xF
    lo = packed & 0xF

    # look up codebook: 16-entry NF4 codebook, gather read
    hi_fp = tl.load(code_ptr + hi, mask=mask, other=0.0)
    lo_fp = tl.load(code_ptr + lo, mask=mask, other=0.0)

    # multiply blockwise scale
    block_idx = row * blocks_per_row + (col_pairs * 2) // blocksize
    scale = tl.load(absmax_ptr + block_idx, mask=mask, other=0.0)
    hi_fp = hi_fp * scale
    lo_fp = lo_fp * scale

    # dot product, FP32 accumulation (FP16 accumulation over 1536 steps exceeds error tolerance)
    x_hi = tl.load(x_ptr + col_pairs * 2,     mask=mask, other=0.0)
    x_lo = tl.load(x_ptr + col_pairs * 2 + 1, mask=mask, other=0.0)

    acc = tl.sum(
        hi_fp.to(tl.float32) * x_hi.to(tl.float32) +
        lo_fp.to(tl.float32) * x_lo.to(tl.float32),
        axis=0
    )

    tl.store(out_ptr + row, acc.to(tl.float16))


def fused_fp4_gemv_triton(artifacts: Linear4bitArtifacts, x: torch.Tensor) -> torch.Tensor:
    if x.ndim != 1:
        raise ValueError(f"x must be 1D, got {tuple(x.shape)}")
    if x.shape[0] != artifacts.in_features:
        raise ValueError(
            f"input width mismatch: expected {artifacts.in_features}, got {x.shape[0]}"
        )

    out = torch.empty(artifacts.out_features, device=x.device, dtype=torch.float16)
    BLOCK_IN = triton.next_power_of_2(artifacts.in_features // 2)

    _fused_fp4_gemv_kernel[(artifacts.out_features,)](
        artifacts.packed_weight.view(-1),
        artifacts.absmax,
        artifacts.code,
        x,
        out,
        artifacts.in_features,
        artifacts.blocksize,
        BLOCK_IN=BLOCK_IN,
    )

    if artifacts.bias is not None:
        out = out + artifacts.bias
    return out
```

The kernel launches `out_features` programs, each handling one row of the output vector. Each program reads an entire row of packed weights (`in_features / 2` uint8s), unpacks on-chip, looks up the codebook, multiplies by scale, accumulates (FP32), and writes one FP16 scalar. Never writes back to VRAM.

The kernel doesn't change the model architecture or the quantization algorithm -- it only changes where dequantization happens, from a VRAM FP16 buffer to on-chip.

Integration: a `FusedFP4Linear` class replaces `Linear4bit` in the model; `replace_kv_proj_with_fused(model)` iterates through all attention layers, replacing `k_proj` and `v_proj` -- 56 projections total (28 layers × 2).

### Results and Analysis

After replacing all 28 attention layers' `k_proj` and `v_proj` with the fused kernel (56 projections):

- bitsandbytes 4-bit: 5.8 tok/s
- fused k/v: 6.7 tok/s
- ~16% decode throughput improvement, same VRAM

Eliminating part of the dequant round-trip does make decode faster.

#### Why Only 16%

In theory, if the 4-bit path's 4.5 bytes/weight drops to the fused path's 0.5 bytes/weight, bandwidth savings should be 9x. But the actual improvement is only 16%, for a few reasons:

1. **Only partial layer replacement.** 56 k/v projections account for about 28% of the model's ~197 weight layers. The remaining `Linear4bit` layers (`q_proj`, `o_proj`, `gate_proj`, `up_proj`, `down_proj`, `lm_head`) still go through bitsandbytes' out-of-place path. Overall improvement is diluted.
2. **k/v projections are themselves small.** Precisely because k/v matrices are small, their relative slowdown is highest (350%+), but their absolute latency as a share of total decode time isn't that high. The absolute time saved by replacing them is limited.
3. **Prefill regression.** The fused kernel is GEMV-only -- each program handles one token. The prefill phase processes 512 tokens at once, requiring GEMM rather than GEMV. Running a GEMV kernel for GEMM amounts to calling the kernel once per token, far costlier than a single GEMM call. So Prefill regresses from 0.27s to 3.20s. This is a known design limitation; optimizing Prefill requires a completely different kernel.

A quick reference for when quantization is likely to help vs. hurt:

| Scenario | Quantization more likely to help | Quantization may hurt |
| --- | --- | --- |
| Operator shape | Large GEMM / batched matmul | Small GEMV |
| Execution phase | Long prefill / large batch | batch=1 decode |
| Kernel implementation | dequant + matmul fused | dequant written back to VRAM |
| Main bottleneck | Memory capacity / bandwidth | Format conversion / fixed overhead |
| Matrix shape | Large enough to amortize overhead | Small matrix, fixed overhead dominates |
| Backend | AWQ / GPTQ / exllama | Generic out-of-place path |

### Broader Perspective

This experiment essentially redoes what mature quantization frameworks like AWQ, GPTQ, and exllama have already done. The core reason they're faster than bitsandbytes isn't better quantization algorithms -- it's that they have built-in fused dequant + matmul kernels, doing exactly what I did in Phase 3, just with more mature implementations and broader coverage.

bitsandbytes' design focus is "getting a model into limited VRAM with minimal friction." One line of `load_in_4bit=True` and you're running, no extra model conversion steps needed. The cost of that convenience is runtime efficiency: dequant goes through an out-of-place path, writing back to VRAM on every forward pass.

What this project made clear to me: **quantization itself isn't the problem -- the execution path is.** Compressing weights for storage, then decompressing to an FP16 buffer at runtime before computing, is more "fits in VRAM" than "runs faster." When dequantization, scaling, and matrix multiplication are fused into one kernel, the matrix is large enough, and the memory path is short enough -- that's when quantization might actually speed things up.

#### Limitations

- Experiment only on one model (Qwen2.5-1.5B) and one consumer GPU (RTX 4060 Laptop); can't directly generalize to larger models or data center GPUs
- Batch size fixed at 1. With larger batches, GEMV becomes GEMM, arithmetic intensity rises, and the relative impact of the quantization tax decreases
- Fused kernel was not autotuned; Triton's default schedule may not be optimal
- No direct comparison with AWQ/GPTQ/exllama

---

After finishing this project, I had a feeling: before, when I saw terms like quantization, KV cache, FlashAttention, each one felt like a newer technique pointing in one clear direction -- use it and things should get faster. But actually measuring things, whether an optimization helps depends entirely on where the workload is actually bottlenecked. The same technique, with a different matrix shape, different batch size, or different kernel implementation, can yield completely opposite results.

I used to think of myself as a complete outsider to MLSys. After this project, it finally feels like I've got one foot in the door of the direction I'm most interested in.
