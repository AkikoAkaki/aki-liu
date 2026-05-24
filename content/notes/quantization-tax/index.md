---
title: "RTX 4060 上的 LLM 量化实测：4-bit decode 比 FP16 慢在哪里"
date: 2026-05-23
tags: ["mlsys"]
math: true
draft: false
cover: "cover.png"
---

{{< figure src="cover.png" alt="4-bit 量化推理为什么更慢了？显存↓60%，速度却↓27%" >}}

<aside>

**TL;DR**

- **反直觉现象**：在 RTX 4060 上对 Qwen2.5-1.5B 做逐层评测，发现 4-bit 量化虽省了近 60% 显存，但 Decode 推理速度却比 FP16 慢了 27%（7.4 → 5.8 tok/s）。
- **致命的量化税**：根源在于“非融合”的反量化路径（out-of-place dequant）。权重在显存中解压再写回，导致每次访存暴增至 4.5 字节（远高于 FP16 的 2 字节）。这在 GQA 架构的较小矩阵（如 K/V 投影层）中尤为明显，单层最高慢了 380%。
- **片上融合算子**：用 Triton 实现了一个 fused dequant-GEMV 算子，把反量化完全放在片上 SRAM 完成，省去显存往返。替换 K/V 投影层后，Decode 吞吐量成功挽回 16%（至 6.7 tok/s）。
- **GitHub 链接**：本项目（LLM Quant Profiler）的源代码已开源：[AkikoAkaki/llm-quant-profiler](https://github.com/AkikoAkaki/llm-quant-profiler)。

</aside>

最近我做了一个小项目，测量我的笔记本 RTX 4060 GPU 上 4-bit 量化推理的真实性能。这个项目是我的第一个 AI Infra 项目，在此之前我没有任何 AI Infra 或 MLSys 的基础。我为此补充了一些基础知识，会整理成笔记之后发出来。

大模型在生成文本时，decode 阶段每生成一个 token，模型的大量权重都要从显存读一遍，而这些权重大多只参与当前 token 的一次计算。计算量不大，访存压力大，典型的 memory-bound。

所以我一开始的假设很简单：LLM 权重从 FP16 变成 4-bit（FP4 / NF4 / INT4）之后，显存占用下降，decode 又是 memory-bound，推理速度应该变快才对。至少不该明显变慢。

实际测下来：`Qwen2.5-1.5B-Instruct + RTX 4060 Laptop 8GB`，bitsandbytes 4-bit 量化，显存从 3.1GB 降到了 1.2GB，省了接近 60%。但 decode 从 17.40s 变成了 22.10s，慢了 1.27 倍。

显存是省了，但推理没变快，反而更慢。省下来的显存读取开销，是不是被反量化的额外成本抵消了？

### 背景

#### Prefill 与 Decode

LLM 推理分两个阶段。Prefill 一次性处理整个 prompt，输入序列可能有数百个 token，Linear 层做的是矩阵乘矩阵（GEMM），算力和带宽都在消耗。Decode 是逐 token 生成，每步只处理一个 token，batch=1 时 Linear 层退化成矩阵乘向量（GEMV）。

| 阶段 | 执行模式 | 典型算子 | 常见瓶颈 |
| --- | --- | --- | --- |
| Prefill | 一次性处理 prompt | GEMM / attention | compute + memory |
| Decode | 每次生成一个 token | GEMV | memory bandwidth |

GEMV 的算术强度很低。对一个 $M \times N$ 的权重矩阵，GEMV 做 $2MN$ 次浮点运算（每个元素一次乘法一次加法），但需要读取 $MN$ 个权重。FP16 下每个权重 2 bytes，算术强度约为：

$$\text{AI} = \frac{2MN}{MN \times 2} = 1 \text{ FLOP/Byte}$$

每搬 1 byte 数据只做 1 次浮点运算，瓶颈完全在显存带宽。RTX 4060 Laptop 的显存带宽是 272 GB/s，FP16 峰值算力约 22 TFLOPS，ridge point（算力和带宽的平衡点）在 $22000 / 272 \approx 80$ FLOP/Byte。Decode 的算术强度只有 1，离 ridge point 差了将近两个数量级。

#### 量化的标准预期

既然 decode 是 memory-bound，直觉上低比特量化应该有帮助：权重从 FP16（2 bytes）压到 4-bit（0.5 byte），搬的数据少了 4 倍，显存带宽压力应该大幅降低。

bitsandbytes 是最常用的量化库之一。加载时传 `BitsAndBytesConfig(load_in_4bit=True)`，它自动将所有 `nn.Linear` 替换成 `Linear4bit`。内部使用 NF4（Normal Float 4）编码——一种专为正态分布权重设计的非线性 4-bit 格式，16 个不均匀分布的码点。量化以 block 为单位（默认 blocksize=64），每个 block 共享一个 FP32 scale（absmax）。两个 4-bit 值 pack 进一个 uint8，存储效率很高。

问题是：推理时 GPU 不能直接用 4-bit 格式做矩阵乘法，必须先反量化（dequantize）回 FP16。反量化的实现方式，决定了量化到底是省了带宽还是浪费了带宽。

### 实验设置

| 项目 | 配置 |
| --- | --- |
| 模型 | `Qwen/Qwen2.5-1.5B-Instruct` |
| GPU | RTX 4060 Laptop 8GB |
| 显存带宽 | 272 GB/s |
| FP16 峰值算力 | ~22 TFLOPS |
| 环境 | WSL2 Ubuntu |
| 工具 | PyTorch / Transformers / bitsandbytes / Triton |
| 输入 | 512-token prompt |
| Decode steps | 128 |
| 重复次数 | 3 |

三种模式对比：FP16 baseline、bitsandbytes 4-bit baseline、自己手写的 Triton fused dequant-GEMV kernel。

关于命名：我实验记录里把 baseline 简写成 INT4，但严格说 bitsandbytes 的 4-bit 路径涉及 FP4/NF4/INT4 等不同编码方式，不等价于整数 INT4，文章里统一写 4-bit。我的 Triton kernel 也不是严格的 INT4。它读 packed 4-bit weight，在 kernel 内部拆 4-bit index，查 16-entry codebook，乘 blockwise scale，直接做 GEMV 累加。

#### Profiling 方法

逐层计时用的是 PyTorch 的 `register_forward_pre_hook` 和 `register_forward_hook`，配合 CUDA Events。

为什么不用 `time.time()`？GPU 执行是异步的。CPU 调用 `layer(x)` 时只是把指令放进 CUDA stream 的队列就返回了，GPU 可能还没开始执行。`time.time()` 测到的是"把任务提交给队列"的时间，几乎是 0，不是真实的 GPU 耗时。`torch.cuda.Event` 在 GPU 队列里插入时间戳，配合 `synchronize()` 等 GPU 真正完成后再读取，测到的才是真实耗时。

为什么不用 `model.generate()`？`generate()` 内部封装了整个 token 生成循环，hook 触发时无法知道当前是第几个 token、是 prefill 还是 decode。手动写 decode loop，每步显式调用一次 forward，可以精确控制每步的记录，把 prefill 和 decode 的数据干净地分开。每次运行采集 6300+ 条逐层记录。

### 端到端结果

| Mode | Prefill | Decode | Throughput | VRAM |
| --- | ---: | ---: | ---: | ---: |
| FP16 | 0.25s | 17.40s | 7.4 tok/s | 3100 MB |
| 4-bit bitsandbytes | 0.27s | 22.10s | 5.8 tok/s | 1227 MB |
| 4-bit + fused k/v | 3.20s | 19.09s | 6.7 tok/s | 1227 MB |

显存从 3100 MB 降到 1227 MB。但 decode 从 7.4 tok/s 掉到 5.8 tok/s。省了显存，没换来速度。

### 逐层 profiling：问题出在哪

逐层看下来，性能下降最严重的是 attention 里的 `k_proj` 和 `v_proj`。有些层里 4-bit 的 k/v projection 比 FP16 慢 4-5 倍，最夸张的超过 350%。

这一开始看着有点反直觉，因为 `k_proj` / `v_proj` 并不是最大的 Linear 层，却降得最厉害。

#### 为什么是 k/v projection

原因是 Qwen2.5-1.5B 用了 Grouped Query Attention（GQA）。标准 Multi-Head Attention（MHA）里 Q、K、V 三个投影的输出维度相同，都等于 hidden size。GQA 让多个 query head 共享同一组 key/value head，K 和 V 的 head 数量远少于 Q。在 Qwen2.5-1.5B 里，具体的维度是：

```
q_proj: (1, 1, 1536) → (1, 1, 1536)   输出 1536
k_proj: (1, 1, 1536) → (1, 1, 256)    输出 256
v_proj: (1, 1, 1536) → (1, 1, 256)    输出 256
o_proj: (1, 1, 1536) → (1, 1, 1536)   输出 1536
```

k/v 的输出维度只有 q/o 的 $1/6$。矩阵小意味着 FLOPs 少，但 dequantization 的开销和矩阵大小不成正比——对每个 block，不管矩阵多大，都要读 packed weight、查码本、乘 scale。矩阵越小，这些固定开销在总时间中的占比越高。

这就是为什么 Top-10 量化税最重的层全部是 `k_proj` 和 `v_proj`，而不是更大的 `q_proj`、`o_proj` 或 MLP 层。

{{< figure src="fig1_layerwise_latency.png" caption="**图 1**：Qwen2.5-1.5B 逐层 Decode 耗时对比。4-bit 量化版本在大多数层中均慢于 FP16 基线，特别是在浅层数中表现更为明显。" >}}

{{< figure src="fig3_top10_slowest.png" caption="**图 2**：量化税（Dequantization Slowdown）最严重的 Top-10 层。性能退化最明显的全部为 `k_proj` 和 `v_proj` 层，最高耗时增幅甚至超过了 350%。" >}}

显存方面，4-bit 确实做到了承诺。下图显示 decode 过程中两种模式的 VRAM 曲线——FP16 全程约 3100 MB，4-bit 约 1250 MB，差值稳定，128 步内 KV cache 增长微乎其微。瓶颈不在 cache 增长，而在每层权重的反量化路径。

{{< figure src="fig2_memory_growth.png" caption="**图 3**：Decode 阶段（128 步内）的显存（VRAM）使用与增长曲线。4-bit 能够将显存占用从 3.1 GB 稳定降至约 1.2 GB，且 KV Cache 的增长极小。" >}}

### 量化税：一个 byte-accounting 模型

FP16 weight 每个元素读 2 bytes。4-bit weight 每个元素只占 0.5 byte，看起来是四分之一。但这只是存储格式上的数字，运行时要看实际的计算路径。

如果 4-bit Linear 的执行路径是 out-of-place dequantization，也就是：

```text
VRAM[4-bit weight]
  -> read 4-bit weight
  -> dequantize to FP16
  -> write FP16 buffer to VRAM
  -> read FP16 buffer
  -> GEMV
```

那么每个 weight 实际产生的显存访问是：

```text
0.5 byte  read 4-bit weight
+ 2.0 bytes write FP16
+ 2.0 bytes read FP16
= 4.5 bytes / weight
```

FP16 只要 2.0 bytes / weight。

4-bit 想省显存访问，结果反量化路径要把 weight 解压成 FP16 写回显存再读回来，实际 memory traffic 比 FP16 还高。这就是所谓的"量化税"：格式转换引入的额外访存，把带宽收益抵消了。

#### 用 Roofline 模型量化这个损失

Roofline 模型是分析 kernel 性能的标准工具。横轴是算术强度（FLOP/Byte），纵轴是实际吞吐量（FLOP/s）。一个 kernel 的性能上界由两条线决定：

- **内存带宽上界**：当算术强度低时，性能受限于带宽，吞吐量 = 带宽 $\times$ 算术强度，是一条斜线
- **算力上界**：当算术强度高时，性能受限于算力，是一条水平线

两条线的交点叫 **ridge point**，是算力和带宽刚好平衡的算术强度。RTX 4060 Laptop 的 ridge point 约在 80 FLOP/Byte。

FP16 GEMV 的算术强度约 1 FLOP/Byte，已经在 ridge point 左侧极远处，完全 memory-bound。4-bit 路径如果实际访存变成 4.5 bytes / weight，算术强度降到：

$$\text{AI}_\text{4-bit} = \frac{2MN}{MN \times 4.5} \approx 0.44 \text{ FLOP/Byte}$$

在 Roofline 图上，4-bit 的点比 FP16 更靠左——量化不仅没有把工作点右移（更高效），反而左移了（更低效）。

{{< figure src="fig4_roofline.png" caption="**图 4**：基于 Roofline 模型的性能瓶颈分析。由于 out-of-place 反量化引入的 VRAM 往返访存，4-bit 路径的算术强度降至约 0.44 FLOP/Byte，使得工作点偏向了更低效的 Memory-bound 区域。" >}}

我没有逐行读 bitsandbytes 的 CUDA 源码来验证它内部是不是精确走了这条路径。但这个模型和实测吻合：4-bit decode 端到端变慢，最慢的层集中在小矩阵 k/v projection，换成 fused kernel 后吞吐回升。

### Fused kernel：把反量化搬到片上

#### GPU 内存层级

理解 fused kernel 为什么有效，需要先看 GPU 的内存层级：

```text
VRAM / HBM / GDDR6        ~272 GB/s    ← 片外，慢
  ↓
L2 Cache (~32 MB)          ~3 TB/s
  ↓
L1 / Shared Memory (SRAM)  ~20 TB/s    ← 片上，快
  ↓
Registers
```

VRAM 是片外存储，读写要走显存总线，带宽有限。L1 / Shared Memory（SRAM）是片上的，读写速度比 VRAM 快一到两个数量级，而且不占用显存带宽。

bitsandbytes 的问题在于：它在 VRAM 中分配了一个 FP16 buffer，把 4-bit 权重解码写进去，然后从 VRAM 重新读出来做 matmul。两次 VRAM 访问，两次带宽消耗。

fused kernel 的思路：把 4-bit 权重读进片上 SRAM，在 SRAM 里解码，直接做乘法累加，结果写出。中间结果不经过 VRAM。

```text
VRAM[4-bit weight]
  -> read 4-bit weight
  -> dequantize on chip (SRAM)
  -> directly accumulate into GEMV
  -> write output
```

#### 为什么用 Triton

CUDA C 可以做同样的事，但 Triton 的抽象层次更高：以 block 为单位编程，不需要手动管理 shared memory 的分配和同步，自动处理 warp 调度和内存合并。对于这种相对简单的 GEMV kernel，Triton 能显著缩短开发周期。

#### Kernel 实现

我用 Triton 写了一个 fused dequant-GEMV kernel。读 packed 4-bit weight，片上 unpack，查 codebook，乘 scale，直接做 FP32 accumulation，最后写出 FP16 output。

```python
from __future__ import annotations

import torch
import triton
import triton.language as tl

from phase3_utils import Linear4bitArtifacts


@triton.jit
def _fused_fp4_gemv_kernel(
    packed_ptr,               # packed uint8 权重，已展平 [out * in / 2]
    absmax_ptr,               # block scale，shape [n_blocks]，float32
    code_ptr,                 # FP4 码本，shape [16]，float32
    x_ptr,                    # 输入向量，shape [in_features]，float16
    out_ptr,                  # 输出向量，shape [out_features]，float16
    in_features,              # 输入维度（1536）
    blocksize: tl.constexpr,  # 每个 block 的大小（64）
    BLOCK_IN: tl.constexpr,   # >= in_features // 2，必须是 2 的幂
):
    row = tl.program_id(0)

    n_packed = in_features // 2
    blocks_per_row = in_features // blocksize

    col_pairs = tl.arange(0, BLOCK_IN)
    mask = col_pairs < n_packed

    # 读 packed uint8
    packed = tl.load(
        packed_ptr + row * n_packed + col_pairs,
        mask=mask, other=0
    ).to(tl.int32)

    # 拆包：每个 uint8 存两个 4-bit 值
    hi = (packed >> 4) & 0xF
    lo = packed & 0xF

    # 查码本：16-entry NF4 codebook，gather read
    hi_fp = tl.load(code_ptr + hi, mask=mask, other=0.0)
    lo_fp = tl.load(code_ptr + lo, mask=mask, other=0.0)

    # 乘 blockwise scale
    block_idx = row * blocks_per_row + (col_pairs * 2) // blocksize
    scale = tl.load(absmax_ptr + block_idx, mask=mask, other=0.0)
    hi_fp = hi_fp * scale
    lo_fp = lo_fp * scale

    # 点积，FP32 累加（FP16 累加 1536 次误差超标）
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

Kernel 启动 `out_features` 个程序，每个程序负责输出向量的一行。每个程序读入整行的 packed weight（`in_features / 2` 个 uint8），在片上完成拆包、查码本、乘 scale、点积，写出一个 FP16 标量。全程不写回 VRAM。

这个 kernel 没改模型结构，没改量化算法，只改了反量化发生的位置——从显存中的 FP16 buffer 搬到片上。

集成方式是写一个 `FusedFP4Linear` 类替换模型中的 `Linear4bit`，通过 `replace_kv_proj_with_fused(model)` 遍历所有 attention 层，把 `k_proj` 和 `v_proj` 换掉，共 56 个 projection（28 层 $\times$ 2）。

### 结果与分析

把 28 层 attention 的 `k_proj` 和 `v_proj` 全换成 fused kernel（56 个 projection），我的结果是：

- bitsandbytes 4-bit：5.8 tok/s
- fused k/v：6.7 tok/s
- decode 吞吐提升约 16%，显存不变

消掉一部分 dequant round-trip 后 decode 确实变快了。

#### 为什么只提升 16%

理论上，如果 4-bit 路径的 4.5 bytes/weight 降到 fused 路径的 0.5 bytes/weight，带宽节省应该是 9 倍。但实际只提升了 16%，原因有几个：

1. **只替换了部分层。** 56 个 k/v projection 只占模型约 197 个权重层的 28%。其余 `Linear4bit` 层（q_proj, o_proj, gate_proj, up_proj, down_proj, lm_head）仍走 bitsandbytes 的 out-of-place 路径。整体提升被稀释。
2. **k/v projection 本身很小。** 正因为 k/v 矩阵小，虽然相对 slowdown 最大（350%+），但它们的绝对耗时占总 decode 时间的比例并不高。替换它们带来的绝对时间节省有限。
3. **Prefill 退化。** fused kernel 是 GEMV-only，每个程序只处理一个 token。Prefill 阶段一次处理 512 个 token，需要 GEMM 而不是 GEMV。用 GEMV kernel 做 GEMM 等于每个 token 单独调用一次 kernel，开销远大于一次 GEMM。因此 Prefill 从 0.27s 退化到 3.20s。这是已知的设计限制——优化 Prefill 需要一个完全不同的 kernel。

附一个判断表，什么时候量化可能有收益，什么时候可能是负优化：

| 场景 | 量化更可能有收益 | 量化可能负优化 |
| --- | --- | --- |
| 算子形态 | 大 GEMM / batched matmul | 小 GEMV |
| 执行阶段 | 长 prefill / 大 batch | batch=1 decode |
| kernel 实现 | dequant + matmul fused | dequant 写回 VRAM |
| 主要瓶颈 | 显存容量 / 带宽 | format conversion / fixed overhead |
| 矩阵形状 | 足够大，摊薄开销 | 小矩阵，固定开销占比高 |
| 后端 | AWQ / GPTQ / exllama | 通用 out-of-place 路径 |

### 更广的视角

这个实验本质上是在手动重做 AWQ、GPTQ、exllama 等成熟量化框架已经做过的事。它们比 bitsandbytes 快的核心原因不是量化算法更好，而是它们内置了 fused dequant + matmul kernel——和我在 Phase 3 做的是同一件事，只是实现更成熟、覆盖更完整。

bitsandbytes 的设计重心是"最小侵入地把模型塞进有限显存"，它的 `load_in_4bit` 一行代码就能用，不需要额外的模型转换步骤。但这种易用性的代价是运行时效率：dequant 走 out-of-place 路径，每次 forward 都写回 VRAM。

这个项目让我理解的一点是：**量化本身不是问题，执行路径才是。** 权重压缩存起来、运行时解压回 FP16 buffer 再算，这更像省显存而不是加速。反量化、scaling、矩阵乘法在一个 kernel 里融合起来，矩阵够大，访存路径够短，量化才可能真的变快。

#### 局限性

- 实验只在一个模型（Qwen2.5-1.5B）一张消费卡（RTX 4060 Laptop）上做，不能直接泛化到更大模型或数据中心 GPU
- Batch size 固定为 1。更大 batch 下 GEMV 变成 GEMM，算术强度上升，量化税的相对影响会减小
- Fused kernel 没有做 autotuning，Triton 的默认调度可能不是最优
- 没有和 AWQ/GPTQ/exllama 做直接对比

---

做完这个项目之后我有一个感觉：之前看到量化、KV cache、FlashAttention 这些词的时候，总觉得每个词都是一个更新的技术，背后都是一个确定的优化方向，用了就该变快。但实际测下来，优化有没有用取决于 workload 到底卡在哪。同一个技巧，换个矩阵形状、换个 batch size、换个 kernel 实现，结论可能完全相反。

我之前一直觉得自己在 MLSys 领域是个门外汉。做完这个项目之后感觉终于算半只脚踏进这个我最感兴趣的方向了。
