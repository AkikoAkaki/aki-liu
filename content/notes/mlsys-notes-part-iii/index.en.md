---
title: "MLSys 3: Compiler Stack, Inference Engines, Quantization, and Systems Frontiers"
date: 2026-06-07
tags: ["mlsys"]
math: true
draft: false
---

<aside>

**TL;DR**

Part III examines how real systems land the concepts from Parts I and II: concrete compilers, inference engines, quantization methods, communication libraries, specialized hardware, and engineering case studies.

Part I focused on hardware resources, Part II on mapping computation to resources. Part III focuses on engineering implementation and cutting-edge systems.

- Triton uses Block abstraction to let the compiler handle shared memory, synchronization, and vectorization; developers only need to focus on per-Block logic
- PyTorch 2 (Dynamo → FX → Inductor → Triton) adds a layer of automatic compilation on top of eager execution
- vLLM / PagedAttention applies OS paging concepts to KV Cache, combined with Continuous Batching to dramatically boost throughput
- Quantization (GPTQ / AWQ / Marlin / QMoE) is fundamentally about saving VRAM bandwidth; the hard part is hiding the dequantization tax
- Communication optimization splits into single-GPU (Triton, FlashAttention) and multi-GPU (NCCL, MSCCL topology-aware synthesis, CoCoNet computation-communication fusion)
- Scaling Laws show that bigger parameters are better; Chinchilla corrects this to balancing parameters and data; Inference-Time Scaling proposes that longer inference may yield higher-quality answers
- Specialized hardware (TPU / Systolic Array, Groq TSP) uses static, deterministic execution to trade for predictable latency
- AI Infra is the real engineering difficulty behind large-scale training
- Staleness tolerance (used in DistriFusion) is a cross-cutting systems philosophy: trade slightly stale data for parallelism

</aside>

## Triton

Write GPU code in Python; the underlying compiler automatically generates highly optimized CUDA/PTX. The core idea is **Block**-based programming rather than per-thread programming. Positioned for deep learning operator development: less effort than handwritten CUDA, more flexible and closer to peak performance than PyTorch custom operators.

Two lifelines:

- `triton.language as tl`: a dedicated language package for GPUs; all parallel instructions (`load` / `store` / `dot` / `arange` etc.) are called through it.
- `@triton.jit`: a decorator that compiles Python functions into GPU machine code.

### Programming Model: Block Abstraction

Handwriting high-performance CUDA is extremely difficult. Programmers must simultaneously manage Shared Memory loads and stores, coalesced access within Warps, register allocation and spilling, vectorization and bank conflict avoidance, and Tensor Core invocation formats (wmma / mma). Moreover, these optimizations are highly hardware-specific -- optimal code for the A100 may not be optimal for the H100, let alone AMD GPUs.

Triton inserts an intermediate abstraction layer between the CUDA thread model and high-level Python:

- **Programmer's perspective**: only write how each Program (corresponding to one Thread Block) handles one Output Tile, using `tl.load` / `tl.store` / `tl.dot` to operate on entire Tiles, with tile sizes as compile-time constants (`constexpr`).
- **Compiler automatically**: analyzes access patterns to generate Shared Memory loads, inserts `__syncthreads()`, vectorizes intra-Tile operations, avoids bank conflicts, generates mma instruction sequences for Tensor Cores, and manages register allocation per architecture.

One-line distinction: CUDA manually manages shared memory and synchronization from the microscopic perspective of each thread; Triton only writes what each block should do -- thread partitioning, memory coalescing, and pipelining optimizations are all left to the compiler.

### General Skeleton and Launch

Four steps on the kernel side -- you should be able to write these with your eyes closed. The host side uses a wrapper for logistics (the kernel only understands pointers, not tensors).

```python
@triton.jit
def my_kernel(input_ptr, output_ptr, n_elements, BLOCK_SIZE: tl.constexpr):
    pid = tl.program_id(axis=0)                            # 1. Check in at the workshop
    offsets = pid * BLOCK_SIZE + tl.arange(0, BLOCK_SIZE)  # 2. Plan the range
    mask = offsets < n_elements                            #    Boundary mask
    data = tl.load(input_ptr + offsets, mask=mask)         # 3. Load
    result = …                                             #    Compute (only change this)
    tl.store(output_ptr + offsets, result, mask=mask)      #    Store back

def wrapper(x: torch.Tensor):
    output = torch.empty_like(x)        # Pre-allocate holes of same shape in VRAM
    n_elements = x.numel()
    grid = lambda meta: (triton.cdiv(n_elements, meta['BLOCK_SIZE']),)
    my_kernel[grid](x, output, n_elements, BLOCK_SIZE=1024)
    return output
```

Key points:

- All parameters are pointers (memory base addresses); never pass entire tensors. Use `base_address + offset_array` (`x_ptr + offsets`) to get entire block addresses at once.
- `BLOCK_SIZE: tl.constexpr` is a compile-time constant; must be a power of 2.
- `tl.arange(0, BLOCK_SIZE)` generates offset arrays in parallel; cannot use Python's `range`.
- `mask` is a boolean array preventing out-of-bounds in the last block; must be passed to both `load` and `store`.
- `grid = lambda meta: …` lets `BLOCK_SIZE` changes propagate automatically; no hardcoded numbers. `triton.cdiv(a, b)` is ceiling division, ensuring no data loss.
- `kernel[grid](args)`: square brackets are workshop count (grid), parentheses are data.

### Minimal Complete Example: Vector Addition

```python
import torch, triton
import triton.language as tl

@triton.jit
def add_kernel(x_ptr, y_ptr, out_ptr, N, BLOCK_SIZE: tl.constexpr):
    pid = tl.program_id(0)
    offs = pid * BLOCK_SIZE + tl.arange(0, BLOCK_SIZE)
    mask = offs < N
    x = tl.load(x_ptr + offs, mask=mask)
    y = tl.load(y_ptr + offs, mask=mask)
    tl.store(out_ptr + offs, x + y, mask=mask)

def triton_add(x, y):
    out = torch.empty_like(x)
    N = x.numel()
    grid = lambda m: (triton.cdiv(N, m['BLOCK_SIZE']),)
    add_kernel[grid](x, y, out, N, BLOCK_SIZE=1024)
    return out
```

The boilerplate (`pid` / `offsets` / `mask` / `load` / `store` / `constexpr`) is nearly invariant. All more complex operators only differ in the "compute" step.

### Advanced: Matrix Multiplication

Writing matrix multiplication requires only two changes: replace the compute logic with `tl.dot(a, b)`, and change the grid from one-dimensional to two-dimensional. Each Program handles one `BLOCK_M × BLOCK_N` output tile of C, with the accumulator kept in registers, looping over the K dimension in blocks for multiply-accumulate.

```python
@triton.jit
def matmul_kernel(A, B, C, M, N, K,
                  stride_am, stride_ak, stride_bk, stride_bn, stride_cm, stride_cn,
                  BLOCK_M: tl.constexpr, BLOCK_N: tl.constexpr, BLOCK_K: tl.constexpr):
    pid_m, pid_n = tl.program_id(0), tl.program_id(1)
    offs_m = pid_m * BLOCK_M + tl.arange(0, BLOCK_M)
    offs_n = pid_n * BLOCK_N + tl.arange(0, BLOCK_N)
    offs_k = tl.arange(0, BLOCK_K)
    acc = tl.zeros((BLOCK_M, BLOCK_N), dtype=tl.float32)   # Accumulator in registers
    for k in range(0, K, BLOCK_K):                          # Block along K dimension
        a = tl.load(A + offs_m[:, None] * stride_am + (k + offs_k)[None, :] * stride_ak,
                    mask=(offs_m[:, None] < M) & ((k + offs_k)[None, :] < K))
        b = tl.load(B + (k + offs_k)[:, None] * stride_bk + offs_n[None, :] * stride_bn,
                    mask=((k + offs_k)[:, None] < K) & (offs_n[None, :] < N))
        acc += tl.dot(a, b)                                 # Compiler maps to Tensor Core mma
    tl.store(C + offs_m[:, None] * stride_cm + offs_n[None, :] * stride_cn,
             acc.to(tl.float16),
             mask=(offs_m[:, None] < M) & (offs_n[None, :] < N))

grid = lambda meta: (triton.cdiv(M, meta['BLOCK_M']), triton.cdiv(N, meta['BLOCK_N']))
```

Behind the scenes, the compiler compiles the `tl.load` of two tiles into "first load into Shared Memory, then feed into Tensor Core input registers," and automatically inserts synchronization, vectorization, and selects mma variants based on tile size.

### Triton vs. Handwritten CUDA

| Dimension | Handwritten CUDA | Triton |
|---|---|---|
| Code volume | Hundreds of lines | Tens of lines |
| Performance (A100 FP16 MatMul) | ~85–95% peak | ~80–90% peak |
| Portability | Very poor (GPU-specific) | Good (NVIDIA / AMD) |
| Development efficiency | Low | High |

Limitations: currently only supports GPUs (no CPU support); does not support all CUDA features (e.g., dynamic shared memory allocation); extremely optimized kernels like FlashAttention still benefit from handwritten CUDA, which requires finer-grained control.

Real-world impact: PyTorch 2's TorchInductor backend generates Triton kernels by default; large portions of xFormers and Flash-Attention 2 are implemented in Triton; inference optimizations like Flash Decoding also depend on it. Triton is becoming the de facto standard for ML kernel development.

## vLLM

A trained model by itself is just weights. The inference engine is a layer of software sitting on top of the model, responsible for accepting requests, scheduling the GPU, managing VRAM, and ultimately outputting tokens.

Inference problems are very different from training problems. The autoregressive decoding characteristics of inference are: during inference, every generated token requires retaining all KV pairs of previously generated tokens, so it grows linearly. Common problems include:

- Traditional approaches, not knowing the final output length, pre-allocate KV Cache for each request at the maximum possible sequence length, but most requests don't need the maximum length, wasting large amounts of KV Cache VRAM
- Fragments left after releasing short requests cannot be used by long requests
- Multiple requests may share system prompts / conversation history, but traditional methods independently allocate KV Cache per request, unable to share prefix content

### PagedAttention

Since each decode step only processes one new token, compute intensity is low; the bottleneck is primarily moving KV Cache from VRAM. How many requests a batch can hold depends on how much KV Cache fits in VRAM, which directly determines throughput.

The three different problems above are actually all the same kind of systems problem. Studied in prior memory optimization work, the OS provided a unified answer: paging. This is also the core of PagedAttention.

Each request maintains a page table mapping logical pages to physical blocks. Physical blocks can be scattered, but logically contiguous.

- If block size is large, the page table is relatively small, memory access is more contiguous, but the last block is prone to wasting space
  - E.g., a block that holds 20 tokens; a request generating 21 tokens leaves one block with only 1 token, very wasteful
- If size is too small, the page table grows large, lookups increase, memory access becomes scattered

Since physical blocks are scattered, the PagedAttention kernel needs an extra indirection (table lookup) step. So the kernel design goal should be to make access feel as contiguous as possible even when KV Cache is not, keeping warp threads accessing adjacent addresses. The PagedAttention kernel is almost certainly harder to write, but it improves VRAM utilization.

When multiple requests share a prefix, their page tables point to the same set of physical blocks, with a reference count on each block, so reads share the same data. Only on writes does CoW (Copy-on-Write) trigger to create private copies.

### Continuous Batching

Since PagedAttention turns KV Cache into dynamically allocatable/reclaimable blocks, there is no need to wait for all requests to complete together. Completed requests immediately release their pages, and new requests immediately fill in. This dynamic request scheduling is Continuous Batching.

### Preemption

When VRAM is insufficient, there are two strategies:
- Swap: copy the evicted request's KV Cache to CPU memory, then copy it back later, avoiding recomputation. The cost is PCIe round-trip data movement, which is slow.
- Recompute: discard the KV Cache and recompute when needed. Since Prefill is large matrix multiplication, naturally suited for GPU computation, it is fast and may even be faster than PCIe round-trip movement.

## Quantization

Quantization is essentially about squeezing continuous or high-precision numbers into fewer discrete bins. Weight errors, through matrix multiplication, become output errors.

During inference with small batch sizes, the workload is generally memory-bound. In this case, quantization primarily saves VRAM bandwidth, not simply for faster low-precision computation. With large batches, improving kernel compute efficiency becomes more critical.

### Mainstream Quantization Methods

- **GPTQ (Post-Training Quantization via Layer-wise OBQ):**
  - Internally uses a Hessian approximation to assess the importance of different weight quantization errors
  - The Hessian is a second-derivative matrix describing how sharply the loss/error curves when parameters change slightly; think of it as a sensitivity map

- **AWQ (Activation-Aware Weight Quantization):**
  - Runs the model once with a small amount of calibration data, observes activation distributions, identifies important channels, then applies per-channel scaling to weights so important channels are less vulnerable during quantization

- **Marlin (INT4 GEMM Kernel for Weight-only Quantization):**
  - Quantization running on actual GPUs involves many kernel overheads, such as unpacking, dequantization, etc.
  - Marlin is a high-performance GEMM kernel specifically designed for 4-bit weight-only quantization. Through weight reordering, tile design, asynchronous loading, scale handling, etc., it tries to hide the dequantization tax

- **QMoE**
  - A complete framework for trillion-parameter MoE: compression + storage format + GPU decode kernels
  - Ordinary dense Transformer: each layer has Attention, MLP/FFN
  - MoE Transformer: replaces some MLP/FFN with many Experts: Attention, Router, Experts
    - Each expert is typically a small FFN/MLP
    - The router decides which expert each token goes to, e.g., top-1 or top-2
    - Each token only activates a few experts, not all of them
    - MoE total parameter count is significantly larger, but actual activated parameters per token are a small fraction

## PyTorch 2 / TorchDynamo / Inductor

The problem PyTorch 2 aims to solve: users still write ordinary PyTorch code (eager mode, each operator calls a kernel individually, but scheduling overhead is high and fusion is difficult), but the system automatically turns it into a faster graph, then generates high-performance kernels. So this adds a layer of automatic compilation on top of eager PyTorch.

Pipeline:
1. Ordinary Python / PyTorch code
2. TorchDynamo: observes your program's execution at the Python bytecode level, capturing the Tensor operations inside
   1. The difficulty is that Python is too dynamic, so it must use bytecode-level methods to minimize user code changes.
3. FX Graph: an IR keeping only the Tensor computation relationships, which are easier to optimize
4. TorchInductor optimizes the graph and compiles
   1. Fusion: reduces Python calls and VRAM reads/writes
   2. Graph break: when TorchDynamo cannot capture a graph, it falls back to eager execution
      1. This is a performance killer. It fragments the graph, preventing many optimizations.
   3. Guards: for safety, the compiler attaches guard conditions to compiled graphs
      1. If the next invocation satisfies the guards, reuse the compiled graph
      2. If not, recompile a new graph
      3. This is a compromise between dynamic languages and static compilation. It lets PyTorch 2 handle dynamic inputs, at the cost of possible recompilation
5. Generate Triton / C++ kernels
6. GPU / CPU execution

## Communication

**Single-GPU optimization**:  
- How to reduce memory access, increase reuse, and make kernels faster within a single GPU
- Representatives: Triton, FlashAttention, Marlin
  
**Multi-GPU communication optimization**:  
- How to reduce waiting, reduce wasted data transfer, and make transfers more efficient across multiple GPUs
- Representatives: NCCL, MSCCL, CoCoNet

### Primary Communication Operations (Traditional NCCL, NVIDIA Collective Communications Library)

- **AllReduce**:
  - Each GPU has a copy of data, such as gradients
  - Sum all GPUs' data, then distribute the result back to every GPU
  - Commonly used for synchronizing gradients in Data Parallel training

- **AllGather**:
  - Each GPU has a piece of data
  - In the end, every GPU gets everyone's data
  - Commonly used in Tensor Parallel / Sequence Parallel

- **ReduceScatter**:
  - All GPUs' data is first summed
  - But the result is split into pieces, each GPU gets only one piece
  - Commonly used in ZeRO, Tensor Parallel

- **Broadcast**:
  - One GPU sends data to all GPUs

### MSCCL, Microsoft Collective Communications Library

Optimizing communication itself. Traditional communication libraries have fixed algorithms (e.g., Ring, Tree) using manually designed universal communication algorithms. But real machine topologies are complex. For example, within a single machine, GPUs have NVLink with some connections being faster; across machines there is InfiniBand; different clusters have different connection patterns. So no single algorithm is always best.

MSCCL takes a different approach: for a specific topology, specific data size, and specific collective, it automatically synthesizes a more suitable communication algorithm.

### CoCoNet, Collaborative Convolutional Network

Jointly optimizing communication and computation. Traditional distributed ML frameworks generally complete communication fully, then perform computation -- kept separate. CoCoNet does not treat communication and computation as two completely separate black boxes; it places them into the same graph and optimizes them together.

Key approaches:
- **Chunking + overlap**: split a large tensor's communication into many chunks; once one chunk's communication is complete, without waiting for the full AllReduce, immediately perform subsequent computation on that chunk.
- **Communication-compute fusion**

## Scaling

### Scaling Laws

Large model performance is determined by:
- Model parameter count N
- Training data volume D
- Training compute volume C

Empirically, as long as you reasonably increase model, data, and compute, loss decreases according to a relatively stable pattern, so bigger parameters are better.

### Chinchilla

Many large models are not parameter-constrained but training-token-constrained. Under the same training compute budget, a smaller model + more tokens may be better. One should not blindly scale up models; instead, balance model size and training data volume.

If the inference serving cost (user requests × inference cost) over the model's lifecycle is sufficiently high, then training a smaller model with more data is economically optimal. Spend more compute during training to significantly reduce per-inference cost.

### Inference-Time Scaling

Modern models scale not only during training but also during inference. Previously the goal was to infer as fast as possible, but later it was found that reasoning can improve answer quality. Some examples:
- Longer chain-of-thought / reasoning tokens  
- Self-consistency: multiple sampling then voting  
- Tree search / beam search  
- Verifier / reward model selecting answers  
- Tool use / agent multi-step execution  
- Test-time compute scaling

Inference may involve: a user question → generate multiple candidates → each candidate further expanded → call tools → verify → iteratively correct → final output. This requires more tokens, context, KV cache, concurrent requests, scheduling complexity, latency cost, etc.

## TPU / Systolic Array

GPUs are relatively general-purpose parallel processors. They can run many types of kernels, such as matmul, attention, sort, sampling, image processing. But this generality also brings complexity: thread scheduling, cache, shared memory, warp, memory coalescing, etc.
- Flexible, suitable for various operators
- Requires programmers/compilers to carefully manage tiling, memory, warp

TPUs are more specialized. Primarily designed for large-scale tensor computation in deep learning, especially matrix multiplication. One of their core hardware structures is the systolic array.
- More specialized, particularly suited for regular large matrix multiplication  
- Data flow is more fixed, with great energy efficiency and throughput
- Strengths in large-scale regular tensor compute, but when facing dynamic, irregular, control-flow-heavy workloads, must rely on compilers and system design to compensate

A systolic array can be understood as:

```
PE  PE  PE  PE
PE  PE  PE  PE
PE  PE  PE  PE
PE  PE  PE  PE
```

Each PE is a small compute unit, typically performing multiply-add. During matrix multiplication, data is not read from memory and sent to a core each time; instead, it flows through this compute array like water. Data from matrix A flows in one direction, data from matrix B flows in another, each PE performs local multiply-add, then passes the data to neighboring PEs. Data does not need to repeatedly access distant memory; it flows and is reused within the compute array.

## AI Infra: Storage, Scheduling, Cluster Management

Similar to infra in software engineering: when training/inference scale becomes very large, the real difficulty is not just writing the model, but managing data, checkpoints, GPU clusters, failures, and scheduling. This part is AI Infra.

### Tectonic-Shift (Meta, ATC 2023)

A large-scale AI training infrastructure proposed by Meta. Large model training requires reading massive amounts of data and continuously writing checkpoints. A single checkpoint can be hundreds of GB or more. If every checkpoint save must synchronously write to slow storage, GPUs are forced to wait.

Tectonic-Shift's approach: make training data reads and checkpoint writes keep up with GPUs, preventing the storage system from slowing down training. Key optimizations:
1. **Foreground Buffering**: Checkpoint writes first enter a fast SSD buffer layer, asynchronously flushed to HDD, preventing checkpoint blocking of training (traditional approach: synchronous writes to slow HDD, training paused 10+ minutes)
2. **Tiered Storage**: Hot data on SSD; cold data on HDD or object storage
3. **Read-Ahead Prefetch**: Detect sequential access patterns in ML training, prefetch the next N data files, accelerating GPU data loading

### MAST, Machine learning Allocation and Scheduling Tool / Global Scheduling of ML Training (Meta, OSDI 2024)

A VRAM-aware scheduling system for large model training proposed by Meta. Meta operates data centers across multiple global geographic locations; ML training jobs require thousands of GPUs running for weeks. Local failures at any facility (network partition, single data center power outage) can cause the entire training job to fail.

If a company has multiple data centers, each with many GPUs, you cannot just look at where there are free GPUs; you must also consider where it is more stable, has better networking, and has lower failure probability.

- A central scheduler knows the GPU status (available, busy, failed) across all data centers and selects the optimal GPU set for each training job (considering network topology, failure history, remaining capacity)
- The keyword is Goodput (effectively completed training steps / time). Preferentially select nodes with low failure rates, even if GPU utilization is temporarily not 100%
- Maintain multiple Shadow Jobs; if the primary job's node fails, immediately restart from the nearest checkpoint using a Shadow Job (Warmup time < 1 minute)

### Singularity (Microsoft, 2022)

A scheduling system proposed by Microsoft. Key capabilities:
- **Dynamic Preemption**: When high-priority jobs (e.g., inference serving traffic bursts) need GPU resources, lower-priority training jobs can be paused
- **Dynamic Elasticity**: Allows jobs to dynamically increase or decrease GPU count during execution (e.g., automatically scale when the cluster has idle GPUs)

Implementation: insert a virtualization layer (Execution Substrate) between the ML framework and hardware:
1. Periodically create lightweight checkpoints automatically (10× smaller than traditional checkpoints, achieved by storing only diffs)
2. On receiving a preemption signal, wait until the next checkpoint point (typically < 30 seconds), save state, then pause
3. After resources are restored, seamlessly resume from checkpoint (user perception = training slightly slower)
4. Elastic scaling: when new GPUs join, re-shard the data-parallel group, continue from the current checkpoint (supports FSDP dynamic resharding)

## DistriFusion

Li et al., "DistriFusion: Distributed Parallel Inference for High-Resolution Diffusion Models," CVPR 2024

- LLM process: existing tokens → generate next token → generate another token → continue
- Diffusion process: random noise → denoise one step → denoise another step → denoise another step → clear image

High-resolution image generation is slow, so DistriFusion aims to solve how to split a single diffusion inference across multiple GPUs for parallel execution. If images are simply partitioned across GPUs, each GPU only has a portion of the image, and Self-Attention requiring a global receptive field cannot complete without communication -- but communication is expensive.

DistriFusion's key insight: the intermediate features of adjacent diffusion steps change very little -- they evolve gradually. So since the change is small, the "global features" needed for the current step can first use the approximate results from the previous step.

Core technique: **Asynchronous Displacement**
- When computing the current step, instead of waiting for the current step's global communication results, first use the global features that were already communicated in the previous step, then later, through asynchronous computation, fill in the communication results
- The core systems philosophy is **staleness tolerance**: as long as result quality does not noticeably degrade, the system allows using slightly stale data

## Groq TSP

GPUs are powerful general-purpose parallel machines, but performance can vary greatly and is highly dynamic, depending on cache hits, warp execution patterns, memory access and kernel scheduling, etc. These make latency difficult to predict.

Groq TSP is a relatively static, deterministic, compiler-driven AI inference hardware; its focus is not being more general-purpose than GPUs, but making inference execution more predictable.

Its implementation approaches:
1. **No Cache**: completely eliminates hardware caches, replacing them with explicitly managed Scratchpad Memory (the compiler decides when and where data resides)
2. **In-order Execution**: no OOO, no speculative execution; each instruction executes at a fixed clock cycle
3. **Static Scheduling**: the compiler (not the hardware scheduler) decides which instruction to issue to which functional unit each cycle
4. **Ultra-long instruction word (VLIW-like)**: each clock cycle, the compiler simultaneously controls multiple independent functional units (similar to VLIW processors)

## A Relational Algebra Perspective on Automatic Differentiation

Ordinary deep learning: automatic differentiation is designed around dense tensors, but is inefficient for relational computation (database queries, recommendation systems, graph data, etc.).

Relational algebra AD: extends automatic differentiation from the dense tensor world to the world of database/sparse table operations, understanding forward and backward passes through the lens of join, group-by, and aggregation, deriving algebraic differentiation rules for these relational operations.

Ordinary Tensor AD:  
- Suitable for dense tensor computation
- Typical scenarios: Transformer, CNN, MLP
  
Relational Algebra AD:  
- Suitable for sparse, tabular, recommendation systems, embedding-heavy workloads
- Typical scenarios: lookup, join, group-by, aggregation
