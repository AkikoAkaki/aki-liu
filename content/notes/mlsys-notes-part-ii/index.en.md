---
title: "MLSys 2: Computation Graphs, Training Systems, and Distributed Scaling"
date: 2026-05-31
tags: ["mlsys"]
math: true
draft: false
---

<aside>

**TL;DR**

Part II covers how ML programs are executed: how models are represented, how computation is scheduled, how data is communicated, and how training scales to large systems

Part I focuses on hardware resources; Part II focuses on the mapping between computation and resources

- Computation Graph describes model structure and data dependencies
- Operator is the tensor-level unit of computation
- Kernel is the code that ultimately runs on hardware
- Graph Compiler handles graph optimization, operator fusion, and code generation
- Communication is one of the core costs in distributed training and inference
- Parallelism strategies like DP / TP / PP / Expert are fundamentally about partitioning work along different dimensions
- Training is essentially forward pass, backward pass, and parameter update
- FSDP, ZeRO, and similar techniques overcome single-GPU memory limits through sharding and dynamic loading
- MoE achieves "large parameter count, low compute" via sparse activation
- PEFT methods like LoRA and QLoRA reduce fine-tuning cost by training only a small fraction of parameters

</aside>

### Computation Graph Optimization

#### Two Views of an ML Program

- **Computation Graph**: operator-level, macroscopic -- the whole model seen as a sequence of connected operators
	- Primary optimizations: graph transformations, operator fusion, parallelism strategies, etc.
	- Primary tooling: TorchInductor, XLA, TensorRT, TVM graph passes, etc.
- **Loop-Intensive Code**: loop-level, microscopic -- all operators ultimately expressed as large numbers of nested loops
	- Primary optimizations: vectorization, tiling, software pipelining, etc.
	- Primary tooling: CUDA, Triton, CUTLASS, LLVM backend, etc.

#### ML Application Categories

- **Task-Specific Deep Learning Models:**
	- Computer vision (ResNet, ViT)
	- Speech recognition, NLP classification
- **Large Language Models (LLMs):**
	- GPT series, Gemini series, Claude series, etc.
	- Characteristics: enormous parameter counts (tens of billions to trillions), autoregressive generation, KV Cache management challenges
- **Diffusion Models:**
	- Stable Diffusion, DALL-E, etc.
	- Characteristics: iterative inference (multi-step denoising), timestep dependency

All three are collectively called Foundation Models, sharing common traits:

- Massive Compute: each inference requires large-scale matrix multiplication
- Massive Memory: parameter weights and intermediate activations occupy large amounts of GPU memory
- Massive Communication: large-scale data transfer required for distributed training / inference

#### Operators

The basic unit of computation in ML programs is the operator (Op). Unlike CPU instructions, operators work on tensors rather than scalars.

Different operators have different arithmetic intensities and different bottlenecks, so optimization approaches differ:

- **Elementwise operators (ReLU, Add, Mul, Sigmoid)**
	- Low compute, high memory traffic, low FLOP/Byte -- typically memory-bound
	- Optimizations: fusion, memory coalescing
- **Tensor-level operators (MatMul, Conv, Attention)**
	- High FLOP/Byte; large matrices are typically compute-bound
	- Optimizations: tiling, Tensor Cores, shared memory reuse, vectorization
- **Reduction operators (Softmax, LayerNorm, Sum)**
	- Require cross-element aggregation / synchronization; performance falls between the above two
	- Optimizations: tree reduction, warp reduction, shared memory reduction
- **Data transformation operators (Reshape, Transpose, Concat)**
	- Almost no compute; the core concern is memory layout and access pattern
	- Optimizations: layout optimization, memory coalescing, fusion

#### Eager Execution vs. Graph Execution

Eager Execution runs operations immediately
- Advantages: easy to debug, code is intuitive
- Disadvantages: misses cross-operator optimization opportunities (e.g., MatMul and ReLU could be fused)

Graph Execution first builds the full computation graph, then compiles and optimizes, then executes
- Advantages: many steps can be merged, reordered, and automatically optimized
- Disadvantages: dynamic input shapes are complex to handle; initial compilation has overhead

Steps of `torch.compile` in PyTorch 2.0:
1. TorchDynamo: converts ordinary Python code into a computation graph (FX Graph / IR)
2. TorchInductor: optimizes and generates kernels (fusion, tiling, scheduling, autotuning)
3. Guard mechanism: checks whether input shapes have changed and recompiles when necessary

#### Graph Optimization

Core idea: fewer HBM writes, fewer kernel launches, more overlap

**Operator Fusion**
- Multiple adjacent operators are merged into a single GPU kernel, eliminating intermediate memory round-trips
- FlashAttention's core technique is fusion

**Schedule Reordering**
- Reorders operator execution while preserving data dependencies
- Reduces memory footprint, enables parallel execution of independent operators, compute-communication overlap

**Pattern Recognition & Replacement**
- Recognizes specific patterns and replaces them with more efficient implementations
- For example, `Q×K^T → Scale → Mask → Softmax → Dropout → ×V` (six separate operators) can be replaced with a single fused FlashAttention operator
- A key optimization technique in torch.compile, XLA, ONNX Runtime, and similar frameworks

#### ML Parallelism Strategies

- **Data Parallelism (DP)**
	- Splits the batch; each GPU holds the complete model.
	- Communication: AllReduce to synchronize gradients.
	- Best for: model fits on a single GPU.
- **Pipeline Parallelism (PP)**
	- Splits model layers; each GPU holds a subset of layers.
	- Communication: activation transfer between adjacent layers.
	- Best for: model is too deep to fit on a single GPU.
- **Tensor Parallelism (TP)**
	- Splits individual weight matrices; each GPU computes part of a matrix.
	- Communication: intra-layer AllReduce.
	- Best for: single layers are too large, or higher throughput is needed.
- **Expert Parallelism (EP)**
	- Splits MoE experts; different GPUs hold different experts.
	- Communication: AlltoAll to dispatch tokens.
	- Best for: MoE models.
- **Sequence Parallelism (SP)**
	- Splits sequence length; different GPUs handle different token segments.
	- Communication: AllGather + ReduceScatter.
	- Best for: very long contexts or large KV Caches.

---

### Loop Optimization

The hottest 20% of code (usually loops) consumes 80% of execution time. ML workloads involve large arrays, matrices, and tensors -- nearly every operator can be unrolled into multi-level nested loops.

Two optimization directions:
- Front-end optimization: maximize utilization of CPU/GPU pipelines and cores
- Back-end optimization: reduce actual execution overhead and wall-clock runtime

#### Specific Techniques

- Single-loop optimizations:
	- **Loop Unrolling**: fully unroll all loop iterations
		- Advantages: reduces loop control overhead, increases ILP (instruction-level parallelism), easier SIMD vectorization
		- Disadvantages: larger code size, higher register pressure
	- **Loop Splitting / Peeling**: extract problematic boundary cases into separate loops
		- Advantages: main loop is easier to vectorize and better aligned
		- Disadvantages: code becomes slightly more complex
	- **Loop Vectorization**: use a single SIMD instruction to operate on multiple data items (requires no data dependencies between iterations)
		- Advantages: dramatically increases throughput
		- Disadvantages: cannot be used when data dependencies exist; sensitive to memory layout
	- **Loop Parallelization**: distribute different iterations to different threads
		- Advantages: easy load balancing under uneven workloads
		- Disadvantages: non-contiguous memory access, poor cache locality
	- **Software Pipelining**: reorder instructions so different iterations overlap
		- Advantages: hides latency, fills the pipeline
		- Disadvantages: complex scheduling, high register pressure
- Multi-loop optimizations:
	- **Loop Interchange**: swap the order of nested loops to change memory access order
		- Advantages: improves cache locality, makes accesses more sequential, increases data reuse
		- Disadvantages: cannot violate data dependencies
	- **Loop Blocking / Tiling**: split large loops into tiles that fit in cache / SRAM
		- Advantages: reduces cache misses, improves data reuse and arithmetic intensity; one of the most important loop optimizations
		- Disadvantages: tile size is hard to choose -- too small means low utilization, too large overflows cache / registers
	- **Loop Fusion**: merge multiple loops to avoid writing intermediate results back to memory
		- Advantages: reduces memory traffic (HBM / global memory reads and writes), improves locality
		- Disadvantages: kernel is more complex, higher register pressure, reduced occupancy
	- **Loop Unroll-and-Jam**: unroll the outer loop first, then fuse with the inner loop
		- Advantages: increases vectorization opportunities, improves data reuse
		- Disadvantages: larger code size, higher register pressure
	- **Loop Skewing**: change the geometry of the iteration space so that dependent loops can also be parallelized
		- Advantages: enables parallelization of wavefront / stencil / DP-style problems
		- Disadvantages: complex implementation and scheduling, poor readability

#### Autotuning

GPU kernel optimization has no theoretical optimum, because different GPUs, kernels, shapes, and hardware configurations all affect the best value -- there is no simple formula and it cannot be computed by hand. Autotuning automatically tries many parameter configurations for a kernel to find the best one.

The challenge is that the configuration space is enormous, and the relationship between parameters and runtime is neither smooth nor intuitive.

> I recently learned about work being done by Jingyu Qiu in Pai's research group. His core hypothesis is whether the static instruction count space can better explain and guide autotuning than the raw config space -- and he is working on using a static instruction map as a substitute for raw config, serving as a more performance-proximate search space that provides more interpretable and more sample-efficient performance coordinates for autotuning. I am actively following this project and looking for ways to contribute.

---

### Macro Scheduling

**Dedicated accelerators**: the simplest hardware design -- build a dedicated functional unit for each operator type and execute serially.

The problem is that most hardware resources sit idle. Pipeline parallelism lets different units work concurrently to improve throughput, but requires more buffers and copies of compute units, and efficiency is limited by the slowest unit.

**Increasing parallelism (pipeline / data parallel)**: add more memory or add more compute.

**Dynamic scheduling**: PyTorch's approach is `operator queue → worker picks up task → execute kernel`
- Advantages: flexible; supports dynamic shapes, if/loop, dynamic control flow
- Disadvantages: cannot see ahead to future operations; scheduling overhead

**Static scheduling**: if input/output sizes are fixed, a schedule can be generated in advance
- Advantages: predictable, easier to optimize

---

### Kernel Optimization

**Little's Law**: $n = R \times t$
- $n$: number of operations in-flight simultaneously
- $R$: throughput (operations the hardware can accept / complete per cycle)
- $t$: latency per operation (cycles)

The implication: to fully utilize hardware (R at peak), at least n in-flight operations must be maintained at all times. Since GPUs hide latency through concurrency, sufficient concurrency is required to maximize hardware utilization.

---

### Roofline Model

#### Arithmetic Intensity

$$I = \frac{\text{FLOPs}}{\text{Bytes}}$$

The number of floating point operations per byte of data read from memory.

**Note**: "Bytes" here refers to memory traffic, not data size -- data reuse must be accounted for (loading data from HBM into cache counts once; subsequent accesses to that data do not).

**Arithmetic intensity reference values for common operators:**

| Operator                        | Typical $I$              | Bottleneck    |
| ------------------------------- | ------------------------ | ------------- |
| Vector add $y = a + b$          | 0.5 FLOP/Byte (FP32)     | Memory-Bound  |
| ReLU                            | 0.25 FLOP/Byte           | Memory-Bound  |
| Softmax                         | ~1 FLOP/Byte             | Memory-Bound  |
| LayerNorm                       | ~2 FLOP/Byte             | Memory-Bound  |
| Small MatMul (M=N=K=64)         | ~32 FLOP/Byte            | Memory-Bound  |
| Large MatMul (M=N=K=1024)       | ~512 FLOP/Byte           | Compute-Bound |
| Attention (sequence length 512) | ~50 FLOP/Byte            | Compute-Bound |

#### Roofline Formula

$$P = \min\left(T_{peak},\ \beta \times I\right) \text{ FLOP/s}$$

where:

- $T_{peak}$: processor **peak compute throughput** (TFLOP/s)
- $\beta$: processor **memory bandwidth** (GB/s or TB/s)
- $I$: program **arithmetic intensity** (FLOP/Byte)
- $P$: achievable **performance upper bound** (TFLOP/s)

---

### Memory and Storage

#### Allocation Strategies

**Static allocation**: memory is allocated at program startup; used for things whose size is known at compile time.

**Dynamic allocation**: allocated on demand at runtime.
- Frequent alloc / free, insufficient memory, and memory fragmentation can all create performance bottlenecks (because `cudaMalloc` is very slow)
- Solutions:
	- Memory planning (analyze before execution and let tensors with non-overlapping lifetimes share the same memory)
	- Memory pooling (cache allocated memory in a pool for reuse, reducing allocation overhead)

#### Memory Spaces

- **Global Memory**: large, slow, HBM. This is where most data lives initially
- **Shared Memory**: on-chip SRAM, shared within a thread block -- move frequently accessed data here so the same data only touches HBM once
- **Registers**: fastest and smallest
- **Constant Memory**: read-only data; when all threads read the same address, HBM is accessed once and the value is broadcast
- **Local Memory**: physically HBM, but logically private to each thread; registers that overflow spill here -- its appearance indicates high register pressure that needs optimization

#### Memory Breakdown

- **Weights**: the model itself. Updated during training, read-only during inference, shared across all inputs, fixed memory footprint
- **Activations**: the output of each layer during the forward pass, used during backpropagation to compute gradients; can be recomputed on demand instead of stored
	- During training, activations must be retained for backpropagation, but memory grows linearly with layer count. The optimization is gradient checkpointing: only save key layers and recompute the rest. Saves approximately $\sqrt{n}$ times memory ($n$ = number of layers), but the forward pass needs to run approximately 1.33× longer
- **Gradients**: computed during backpropagation; same size as weights; discarded after the parameter update
- **Optimizer State**: maintains first moment m and second moment v -- 2× the model size -- kept throughout training
	- m: exponential moving average of gradients -- "recent gradient direction trend"
	- v: exponential moving average of squared gradients -- "recent gradient volatility"
	- Adam uses these two values to adjust the effective learning rate per parameter: large variance → smaller step, small variance → larger step

**Memory estimation formula**: $M_{total} = \underbrace{P \times 4}_{\text{Weights}} + \underbrace{P \times 4}_{\text{Gradients}} + \underbrace{2P \times 4}_{\text{Adam: }m,v} + M_{act}$

With FP32 Adam, each parameter occupies 16 bytes = 4 bytes (weights) + 4 bytes (gradients) + 4 bytes each for m and v

#### Memory Optimization Techniques

- **Quantization**
	- Convert model parameters from high-precision floats to low-precision integers to reduce memory footprint
	- Weight-only quantization (primarily saves memory bandwidth, not compute) vs. weight + activation quantization (saves both memory and compute)
- **Weight Sparsification**
	- Treat near-zero weights as zero, skip their computation, and store only non-zero values and their coordinates
	- Unstructured sparsity (random sparse positions, but non-contiguous in memory, hard to vectorize) vs. semi-structured sparsity (e.g., 2:4 sparsity, more efficient memory access)
- **Compression**
	- Lossless: reduces transfer volume but requires decompression time
	- Lossy: this is essentially quantization

#### Loading Weight Files

Weight files are enormous and loading them onto GPU is a significant challenge. Traditional PyTorch Pickle files load the entire file into CPU RAM before copying to GPU -- extremely slow. A better approach is `mmap`, where the OS maps the file into virtual memory addresses and loads only the currently needed layers. Safetensors (developed by Hugging Face) is the recommended modern weight format, designed with native support for this pattern.

---

### Communication

Intra-machine communication:
- **Load/Store**: CPU directly accesses data. Flexible but occupies CPU resources; suitable for small data
- **Non-temporal Load/Store**: hints the CPU not to cache this data; suitable for large write-once data
- **DMA (Direct Memory Access)**: dedicated hardware; the CPU can do other work once DMA is initiated

**Pinned Memory** is memory that the OS cannot swap out when RAM is low. DMA can safely use its physical address. However, it permanently occupies physical memory and must not be overused.

**GPUDirect**: lets GPUs bypass CPU memory and communicate directly with external devices
- GPUDirect RDMA: communicates directly with the NIC for multi-machine transfer
- GPUDirect P2P: direct GPU-to-GPU transfer within the same machine via NVLink, bypassing CPU memory

#### Network Topology

- **Bisection Bandwidth**: the core metric for network capacity -- cut all nodes in half and sum the bandwidth of all links crossing the cut. A higher value means the network is less prone to congestion during large-scale communication.
- **Ring**: each node connects only to its left and right neighbors; simple structure; optimal bandwidth efficiency for AllReduce; high latency as node count grows; low bisection bandwidth
- **Tree**: hierarchical; fast propagation; but the root node is a bottleneck because bandwidth pressure concentrates there
- **Fat-Tree**: the mainstream data center topology; upper-layer switches have more ports; no bandwidth bottleneck; but complex and expensive; high bisection bandwidth
- **2D/3D Torus**: each node connects to neighbors in 2/3 dimensions (same row/column/layer); high bisection bandwidth
- **Fully Connected**: every pair of nodes is directly connected; expensive. Single-machine NVLink (NVIDIA's high-speed interconnect for GPU communication, bypassing PCIe for direct GPU-to-GPU transfer) is close to fully connected, with 10× the bandwidth of PCIe (the CPU-to-GPU data bus)

#### Communication Protocol Stack

- **Physical Layer**
	- Converts bits into physical signals (voltage, light pulses, radio waves) for transmission
	- Only concerned with "how to transmit signals", not what they mean
	- Media: copper (twisted pair, coaxial), fiber, wireless
	- Whether machines are connected by fiber or copper determines the physical bandwidth ceiling. Large clusters use fiber almost exclusively
- **Data Link Layer**
	- Handles communication between two machines on the same local network
	- Uses MAC addresses for addressing (hardware addresses burned into NICs)
	- Packages data into frames with source/destination MAC addresses
	- Ethernet is the most common implementation -- cheap but slightly lower performance; InfiniBand has lower latency and higher bandwidth and is the standard for HPC and AI clusters
- **Network Layer**
	- Handles cross-network routing, delivering data from any source to any destination
	- Uses IP addresses for addressing
	- Routers operate at this layer and decide the path for each packet
	- Provides no reliability guarantees -- "best effort delivery" only
	- InfiniBand uses its own addressing scheme (LID) instead of IP for lower latency. RoCE emulates RDMA over Ethernet and still uses IP addressing
- **Transport Layer**
	- Handles end-to-end communication between two processes
	- TCP: reliable, with handshakes, acknowledgments, and retransmission, but high overhead. Goes through the kernel with CPU-managed copies -- high latency and CPU usage for gradient synchronization
	- UDP: unreliable, no acknowledgment mechanism, but low latency
	- RDMA Verbs: bypasses the kernel; the NIC reads and writes GPU memory directly with minimal CPU involvement -- the foundation that makes large-scale training feasible
- **Application Layer**
	- Application-specific protocols defining data format and interaction
	- HTTP/gRPC: web and service-to-service calls
	- MPI: traditional HPC message passing
	- NCCL: NVIDIA's GPU collective communication library (AllReduce, etc.), calls NIC interfaces directly to bypass intermediate layers

#### Cluster Communication

Collective Communication (CC) is a multi-step data transfer + computation operation executed jointly by all participating devices.

**AllReduce**: each GPU computes its own gradients, all gradients are summed and averaged, and every GPU receives the result to update its parameters

Naive implementation:

```python
# Each GPU sends data to GPU 0; GPU 0 sums and broadcasts
# Communication volume: O(P × |g|); GPU 0 is the bottleneck
for m in other_devices:
    send(m, my_gradient)
result = my_gradient
for m in other_devices:
    result += recv(m)
broadcast(result)
```

**Ring AllReduce (bandwidth-optimal)**: each GPU's gradients are split into P segments arranged in a ring. This is the standard algorithm used by NCCL and PyTorch DDP.

1. **Reduce-Scatter**: each GPU is responsible for aggregating one segment only. The ring runs for P-1 rounds; in each round a GPU accumulates the data it receives and passes it on. After P-1 rounds, each GPU holds the global sum for one segment.

	```
	Each GPU's data is split into P segments: [S0|S1|S2|S3] (P=4 example)
	
	Round 1: GPU_i sends a copy of S_i to GPU_{i+1}, receives S_{i-1} and accumulates
	Round 2: GPU_i sends the accumulated S_{i-1} to GPU_{i+1}, receives and accumulates S_{i-2}
	Round 3: similar...
	
	After P-1 rounds, GPU_i holds the global sum of S_i
	```

2. **AllGather**: each GPU broadcasts its fully aggregated segment for P-1 more rounds. After completion, every GPU holds the complete global gradient.

	```
	Each GPU sends its S_i (now the global sum) to the next GPU
	After P-1 rounds, every GPU holds the complete [S0+S1+S2+S3]
	```

Each GPU sends and receives approximately 2|g| of data total, independent of the number of GPUs P. This is why Ring AllReduce is bandwidth-optimal: adding more GPUs does not increase the per-GPU communication volume.

#### Other Collective Communication Algorithms

| Algorithm         | Semantics                               | Communication Direction        | Use Case                        |
| ----------------- | --------------------------------------- | ------------------------------ | ------------------------------- |
| **Broadcast**     | Root sends data to all nodes            | 1 → N                          | Parameter server broadcasting model weights |
| **Reduce**        | All nodes aggregate data to Root        | N → 1                          | (Rarely used; superseded by AllReduce) |
| **AllReduce**     | All nodes aggregate; result sent to all | N → N                          | **Gradient synchronization** (DDP) |
| **Gather**        | All nodes send data to Root             | N → 1                          | Collecting inference results    |
| **AllGather**     | All nodes broadcast data to all         | N → N                          | **FSDP parameter reconstruction** |
| **Scatter**       | Root distributes data to each node      | 1 → N                          | Distributing batch data         |
| **ReduceScatter** | First half of AllReduce                 | N → N (each keeps one portion) | **FSDP gradient sharding**      |
| **AlltoAll**      | Each node sends different data to every other node | N → N (all-to-all)  | **MoE expert routing**          |
| **Barrier**       | Synchronization point; all nodes wait for each other | —              | Inter-iteration synchronization |

#### Current State of Communication Libraries

| Library   | Maintainer       | Notes                                                       |
| --------- | ---------------- | ----------------------------------------------------------- |
| **NCCL**  | NVIDIA           | De facto standard for GPU communication; optimized for NVLink and InfiniBand |
| **RCCL**  | AMD              | AMD ROCm port of NCCL                                       |
| **MSCCL** | Microsoft        | Allows custom communication algorithms (e.g., synthesis-based) |
| **MPI**   | Academic/HPC     | Traditional HPC standard; weak GPU support                  |

**40% of training cost is communication cost.** This is an important data point in ML systems and explains why communication optimization research remains highly active.

#### Communication Patterns by Parallelism Strategy

| Parallelism Strategy           | When Communication Occurs                                        | CC Algorithm Used             | Communication Volume                              |
| ------------------------------ | ---------------------------------------------------------------- | ----------------------------- | ------------------------------------------------- |
| **Data Parallel (DDP)**        | After backpropagation each step for gradient sync               | AllReduce                     | $O(\text{params})$ / step                         |
| **Pipeline Parallel**          | Forward: activation transfer between layers; Backward: gradient transfer | P2P Send/Recv          | $O(\text{layer output size})$ / micro-batch       |
| **Tensor Parallel**            | Merging partial matrix results                                   | AllReduce (intra-layer)       | $O(\text{activation size})$ / layer               |
| **FSDP (ZeRO-3)**              | Forward: AllGather params per layer; Backward: ReduceScatter gradients | AllGather + ReduceScatter | $O(\text{params})$ / step (same as DDP but spread across layers) |
| **Expert Parallel (MoE)**      | Token routing to experts + result collection                     | AlltoAll                      | $O(\text{batch size})$ / MoE layer                |

#### Communication Optimization

- **Gradient Compression**: compress gradients before AllReduce, e.g., using low-rank approximation. Communication volume drops significantly, but introduces error; an error feedback mechanism is typically used to compensate
- **Stale Synchronous Parallelism**: begin the next step without waiting for all GPUs to finish, allowing use of slightly outdated gradients
	- **DistriFusion** (distributed diffusion model inference): applies this idea to diffusion models. Parallel denoising steps run on different GPUs, using the previous step's activations as an approximation for the current step (activations change little between steps) -- near-lossless accuracy with parallelized inference
	- **Hogwild!** (asynchronous SGD)
- **Compute-Communication Overlap**: the canonical example is PyTorch DDP's **Bucketed Gradient AllReduce** -- rather than waiting until all layer gradients are computed to do a single AllReduce, gradients are grouped into buckets and AllReduce starts on each bucket as soon as it's ready, running concurrently with backpropagation through later layers

---

### Training

#### Training Loop

1. Initialize (random weights; all-zero initialization doesn't work)
2. Forward pass
	1. Input data passes through linear transformations and activation functions layer by layer
	2. Produces prediction $\hat{y}$; all intermediate activations are saved
	3. Compute $\mathrm{Loss} = \mathrm{loss}(\hat{y}, y)$
3. Backward pass
	1. Starting from Loss, apply the chain rule layer by layer to compute gradients $\frac{\partial L}{\partial W}$ for each parameter
	2. Update parameters with gradients: $W \leftarrow W - \eta \cdot \frac{\partial L}{\partial W}$
4. Check for convergence
5. Repeat

#### Differentiation Methods

- **Numerical differentiation**: directly approximates the definition. Simple but error-prone; each parameter requires a separate forward pass -- infeasible with many parameters
- **Symbolic differentiation**: algebraic derivation. Exact but expression size grows explosively
- **Automatic differentiation**: applies the chain rule along the computation graph. Complex, exact, and efficient; all modern ML frameworks (PyTorch, JAX, TensorFlow) use it
	- **Forward-mode AD**: each forward pass computes the gradient with respect to only one input variable. A network with tens of billions of parameters would require tens of billions of passes
	- **Reverse-mode AD**: runs one full forward pass, records all intermediate values on a Tape, then traverses backward from Loss once to get gradients for all parameters in a single pass
		- Primary memory cost: storing all forward pass intermediate values; local gradients at each layer are all needed
		- Optimization: Gradient Checkpointing

#### Gradient Descent and Parallelization

- **Batch Gradient Descent**: computes gradient mean over the entire dataset -- most accurate, but must scan all data before each step; too slow
- **Stochastic Gradient Descent (SGD)**: uses a single random sample per step -- fast, but gradient noise is high and update direction is unstable
	- **Mini-batch SGD**: what is actually used. A middle ground -- uses a small batch of data, gradient quality is sufficient, and samples within a batch can be parallelized on GPU
- **Adam and similar optimizers**: maintain per-parameter first and second moments to automatically adjust the effective learning rate, rather than using a single global rate. The cost is 2× optimizer state storage
- **Hogwild!**: multiple workers compute gradients in parallel, but updates to shared parameters may conflict and require locking. Sparse gradients have low collision probability and work well, but dense gradients like those in Transformers suffer significant lock contention overhead

#### Storage and Scheduling Challenges in Distributed Training

Model scale grew from two consumer GPUs in 2012 to thousands of H100s in 2024 -- orders of magnitude in a short time. Storage and scheduling became independent engineering problems.

- **Meta's Tectonic-Shift**: large-scale ML storage
	- Problem: hundreds of terabytes of training data; checkpoint storage requirements alone are enormous
	- Solutions:
		- Datasets are read many times (multiple epochs) with sequential access patterns -- prefetching and caching are highly effective
		- Checkpoints are bursty large writes: thousands of GPUs simultaneously writing state -- write buffering and aggregation absorb the peak
		- Data sizes vary widely -- tiered storage with SSDs for hot data and HDDs for cold data
- **Meta's MAST**: global ML training scheduling
	- Problem: scheduling ML training jobs across geographically distributed data centers, accounting for GPU availability (failures and maintenance), network bandwidth, high-priority job preemption, and local checkpoint recovery
	- Solution: a global scheduler maintains resource state across all data centers, selects the optimal data center combination at job submission time, and dynamically migrates or reschedules during execution to maximize Goodput (effective throughput = valid training steps completed / wall clock time; time lost to failure recovery, communication stalls, and preemption is not counted)

#### Parallelization Methods

- **Data Parallelism**: each GPU holds the complete model and processes a subset of data; gradients are synchronized after all GPUs compute. Simple, but fails when the model doesn't fit on a single GPU
	- PyTorch DistributedDataParallel (DDP) optimizations:
		- Parameters are grouped into buckets; AllReduce starts immediately when each bucket's gradients are ready
		- Optional gradient compression before AllReduce
- **Pipeline Parallelism**: splits model layers across GPUs; activations flow forward from earlier GPUs to later ones during the forward pass, and gradients flow backward during the backward pass
	- Problem with naive implementation: a GPU is idle from when its forward pass finishes until its backward pass begins
	- GPipe's solution: split the batch into M micro-batches and pipeline them -- a GPU immediately starts processing the second micro-batch after finishing the first's forward pass. Larger M means a smaller bubble, but more memory to cache intermediate activations
- **Tensor Parallelism**: splits individual matrix multiplications across GPUs
	- Megatron-LM: the first matrix is split column-wise, each GPU computes partial outputs with no communication needed; the second matrix is split row-wise, each GPU produces a partial result, then AllReduce merges them. The entire MLP layer requires only one AllReduce, keeping communication overhead low. The tradeoff is one communication per layer end, so this is typically confined to a single machine
- **ZeRO (Zero Redundancy Optimizer)**: avoids storing the complete model on every GPU
	- ZeRO-1: shard optimizer states; saves approximately 4× memory
	- ZeRO-2: shard optimizer states and gradients; saves approximately 8× memory
	- ZeRO-3: shard optimizer states, gradients, and parameters; saves approximately P× memory (P = number of GPUs)
		- Mechanism: each GPU stores 1/P of parameters, gradients, and optimizer state. When a layer's parameters are needed, AllGather temporarily assembles the full parameters, the forward pass runs, and parameters are immediately discarded. Backpropagation is similar, but after completing the backward pass the gradients are not immediately discarded -- ReduceScatter shards them back, and each GPU updates its own local parameters. Communication volume is approximately 1.5× that of ZeRO-1 and ZeRO-2
		- **PyTorch FSDP (Fully Sharded Data Parallel)**: the official PyTorch implementation of ZeRO-3. If the model fits on a single GPU, use DDP; otherwise use FSDP
			- CPU Offload (optional extension for FSDP/ZeRO): offloads inactive parameters and optimizer states to CPU memory or even SSD; the GPU only keeps the portion currently being computed. The tradeoff is CPU↔GPU transfer latency, but it allows training models much larger than GPU memory
- **3D Parallelism**: uses DP, PP, and TP simultaneously
	- Example: 64 GPUs → 8 TP × 4 PP × 2 DP
	- Within TP groups: AllReduce (latency-sensitive; requires high-bandwidth NVLink)
	- Between PP groups: P2P (activation transfer; moderate bandwidth)
	- Between DP groups: AllReduce (latency-tolerant; InfiniBand latency is acceptable)

All ML parallelism strategies decompose into these operations (applied to operators / layers / data):
- **Partitioning**: split data / operators across different devices
	- e.g., ZeRO parameter sharding, Pipeline layer splitting
- **Replication**: maintain complete copies on different devices
	- e.g., DDP model replicas, parameter servers
- **Loading/Unloading**: dynamically load data based on liveness
	- e.g., FSDP AllGather / ReduceScatter

#### Performance Diagnosis

- **Communication volume**: is communication turning a Compute-Bound problem into I/O-Bound?
- **Arithmetic intensity**: is arithmetic intensity below the ridge point?
- **Timeline analysis** (`nsight systems` / `torch.profiler`):
	- GPU idle time
	- Excessive synchronization
	- Whether compute and communication overlap

#### Fault Tolerance

The reliability of individual components determines the MTTF (Mean Time to Failure) of the entire training job. With 10,000 GPUs each with an MTTF of 100 days, the whole cluster fails on average every 14 minutes. Fault tolerance is mandatory.

Failure types:
- Hardware failures: GPU memory errors, power supply failures, NVLink failures, etc.
- Software failures: CUDA kernel crashes, deadlocks, etc.
- Infrastructure failures: data center power outages, etc.

Fault tolerance mechanisms:
- Checkpointing
- Goodput maximization: too frequent checkpointing has high I/O overhead; too infrequent means losing progress after a failure
- Singularity's elastic training: dynamically add or remove GPUs from a running training job without restarting
	- New GPU joins: recovers from checkpoint and joins the AllReduce ring
	- GPU failure exits: remaining GPUs reorganize and continue training from the most recent checkpoint

---

### Fine-Tuning

Pretraining is extremely expensive, producing a general-purpose model. Fine-tuning is a post-training technique that continues training on relatively small amounts of data to adjust model behavior at a fraction of the pretraining cost.

**Cost comparison:**

| Stage           | Estimated cost at GPT-3 scale              | Estimated cost at GPT-5 scale                    |
| --------------- | ------------------------------------------ | ------------------------------------------------ |
| Pretraining     | ~\$4–12M (one-time)                        | ~$500M / run                                     |
| Full fine-tuning | ~\$600 (Alpaca 7B as reference)           | Impractical / not applicable (requires dedicated clusters) |
| LoRA fine-tuning | ~\$50 (Alpaca 7B-LoRA), single GPU, hours | ~$1,000–$3,500+ (cloud, equivalent accessible model) |

#### Adapter

A small module is inserted within each Transformer layer, compressing the dimension to r (much smaller than d), applying an activation function, projecting back to d, and adding a residual. The original weights are frozen; only this small module is trained.

Advantages: small parameter count ($2rd$ vs. $d^2$). Disadvantages: inference must pass through the Adapter at every layer, adding latency that cannot be eliminated.

#### Prefix Tuning

Rather than modifying the Transformer's internal structure, a trainable prefix is prepended to the k/v sequence at each layer. The model sees this prefix during training and the prefix content is optimized via gradient descent.

Unlike prompt engineering (which uses discrete tokens from the vocabulary), prefix vectors are continuous real-valued vectors with greater expressive power.

#### LoRA

Since the weight update $\Delta W$ during fine-tuning is low-rank, it can be approximated as the product of two small matrices A and B. The original weights $W_{0}$ are frozen; only A and B are trained. B is initialized to all zeros, ensuring model behavior is unchanged at the start of training.

The key advantage is that at inference time BA can be added directly back to W₀ and merged into a single matrix, incurring zero additional inference overhead. This is the core reason LoRA became the dominant approach.

Parameter count is dramatically reduced: full fine-tuning of GPT-3 trains 175B parameters; LoRA with r=4 trains approximately 35M parameters, less than 0.02%.

**QLoRA**: extends LoRA by quantizing the frozen $W_{0}$ to INT4, further reducing memory requirements significantly. A 65B model can be fine-tuned on a single 48 GB GPU, making large model fine-tuning feasible on consumer hardware.

#### PEFT (Parameter-Efficient Fine-Tuning) Comparison

| Method                                    | Trainable Params        | Inference Overhead       | Multi-task Switching              | Best For                               |
| ----------------------------------------- | ----------------------- | ------------------------ | --------------------------------- | -------------------------------------- |
| **Full Fine-tuning**                      | 100% ($P$ params)       | None                     | Separate model per task           | Abundant compute, highest performance needed |
| **Adapter**                               | ~30% (BERT base)        | Yes (extra layers)       | Swap Adapter weights only         | Inference latency not a concern        |
| **Prefix Tuning**                         | ~0.1%                   | Small (extra $k$ tokens) | Swap prefix only                  | Generation tasks, many tasks           |
| **LoRA**                                  | <0.1%                   | **None** (mergeable)     | Swap $A,B$ before merge; not after | Almost all scenarios; current standard |
| **ReFT (Representation Fine-Tuning)**     | Varies                  | Yes (extra ops)          | Yes                               | New direction; research-oriented       |

---

### MoE

According to the Scaling Law, larger models perform better -- but dense models also see compute costs explode with scale. MoE aims to have a large parameter count while only activating a small fraction of parameters per token, dramatically reducing actual compute.

Formally:

$$y = \sum_{i=1}^{n} G(x)_i \cdot E_i(x)$$

where:

- $E_i(x)$: the $i$-th **Expert** (a small FFN network)
- $G(x)_i$: the **Gate network** (router) weight for the $i$-th Expert
	- If the gate assigns zero weight to an Expert, that Expert is not computed at all
	- **G in Sparsely-Gated MoE**: $G(x) = \text{Softmax}(\text{Top-K}(x \cdot W_g + \text{noise}))$
		- $x \cdot W_{g}$ computes a score for each Expert from the token
		- Top-K keeps only the K highest-scoring Experts and sets the rest to zero
		- Noise encourages exploration of different Experts rather than always routing to the same ones
- $n$: total number of Experts (typically 8–64; extreme cases like DeepSeekMoE have 256)

#### System Issues in MoE Training

**Shrinking Batch Problem**: as the number of Experts increases, each Expert receives fewer tokens. With small batches, individual Expert efficiency drops, arithmetic intensity falls, and operation becomes memory-bound.

- Solution: Expert Parallelism + batched routing. Distribute Experts across multiple devices with one Expert per device, then aggregate batches from multiple data-parallel devices to form a larger effective batch for each Expert. The cost is AlltoAll communication overhead.

With MoE Experts spread across different devices, tokens must be sent over the network to the appropriate Expert and returned after computation -- an extra communication cost absent in dense models.

- Since communication volume is proportional to the Expert's hidden dimension, one mitigation is to reduce Expert intermediate layer size

During training, the gate network may favor certain Experts, causing them to become increasingly popular -- hot Experts face high load and latency, cold Experts sit underutilized.

- Solution: introduce an auxiliary load balancing loss during training that penalizes imbalanced load distribution

#### GShard and DeepSeekMoE

**GShard** applied MoE to Transformers, achieving a 600B-parameter model where each token activates approximately one-tenth of parameters. Key mechanisms include:
- Users annotate which layers are MoE; the compiler automatically generates sharding and communication code
- Each device stores $\frac{1}{n}$ of the Experts; adding more Experts barely increases per-device memory burden
- When an Expert receives more tokens than its capacity, excess tokens are randomly routed to other Experts -- slightly reduces accuracy but improves load balance
- Each Expert has a capacity cap; overflow tokens skip the Expert and pass through the residual connection

**DeepSeekMoE** addresses the problem of Experts in standard MoE learning overly general knowledge:
- **Fine-grained Expert Segmentation**: with few Experts, each must cover enough tokens to be useful and becomes general, causing knowledge redundancy. The fix: shrink each Expert's FFN hidden dimension by a factor of m and increase the number of Experts by m, activating m times as many Experts. Each Expert receives fewer tokens; compute remains the same; but Experts become more specialized.
- **Shared Experts**: Experts spending capacity on general knowledge reduces learning efficiency. The fix: designate a few shared Experts that are always activated for every token to handle general knowledge. The activation count for other Experts decreases accordingly -- similar in spirit to Residual MoE. DeepSeek-V3's MoE layer (256 routed Experts + 1 shared Expert) achieves 671B total parameters while activating only about one-twentieth of them per token.

#### MoE Inference Optimization

In dense models, the same weights apply to all tokens in a batch, so a full batch can be computed together. In MoE, each token routes to a different Expert, scattering tokens and preventing batching. LLM inference is already a small-batch scenario -- extremely memory-bound. MoE further scatters tokens across Experts, each Expert computing even less, becoming more memory-bound and less efficient.

Optimization approaches:
- **Expert Parallelism + Critical Path Routing**: co-locate tokens with the same routing path on the same device for batched processing; use Expert Parallelism to increase effective batch size; parallelize non-Expert layers like Attention with Tensor Slicing
- **Hierarchical AlltoAll**: traditional AlltoAll requires pairwise communication between P devices with high latency. In small-batch scenarios the bottleneck is latency rather than bandwidth -- too many communications slows everything down. Hierarchical AlltoAll first performs AlltoAll within each machine using low-latency NVLink, aggregates the data, then does a single cross-machine AlltoAll over high-latency InfiniBand -- reducing the number of cross-machine communications and dramatically lowering total latency
- **Fused MoE Kernels**: Gate computation involves many steps; separate kernels cause heavy global memory read/write traffic. Fusion eliminates the repeated HBM access overhead
