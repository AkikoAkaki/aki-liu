---
title: "MLSys 1: Hardware, Memory, Parallelism, and Data Layout"
date: 2026-05-18
tags: ["mlsys"]
math: true
draft: false
---

<aside>

**TL;DR**

Part I covers hardware fundamentals: where compute lives, where memory slows down, how parallelism works, and how data patterns affect performance

- ML performance = compute × memory × parallelism × data layout
- CPU: pipelines, out-of-order execution, branch prediction, cache, few powerful cores, low latency, good at complex control flow
- GPU: massive threads, SIMD/SIMT, Warps, high bandwidth, latency hiding, high throughput, good at regular large-scale computation
- Hardware compute capacity needs SIMD to be fully utilized
- Memory hierarchy: Register → L1 → L2 → L3 → DRAM → SSD; the essence of ML tiling optimization is loading data into fast memory and maximizing reuse
- Two reasons a kernel can be slow: compute-bound, memory-bound
- Lower precision saves memory and bandwidth, but introduces decoding costs and numerical risks
- Sequential access is fast, random access is slow; regular access patterns are easy to vectorize, irregular ones are hard to fully saturate in hardware

</aside>

### MLSys: Definition and Characteristics

**Definition**: any system capable of running ML programs, covering training / fine-tuning / inference
- Shared Memory System: typically a single machine, such as a server with multiple GPUs
- Distributed Memory Systems: multiple machines connected via network; reading each other's memory requires data transfer, e.g. GPU clusters / data centers
- Memory topology determines communication cost; communication cost determines whether training and inference can scale efficiently

**Characteristics**:
- Massive compute
- Massive memory
- Massive communication

**Training**: input data → forward pass → compute loss → backward pass → update weights
- Highest compute demand
- Most data
- Longest time
- Highest cost
- Typically requires many GPUs/TPUs

**Fine-tuning**: pretrained model → task-specific data → small-scale retraining → specialized model
- Lower cost than full training
- Less data
- Shorter time
- Typically done once for a specific task

**Inference**: user input → forward pass → output
- Triggered on every user request
- Per-request compute is much smaller than training
- No backward pass
- No weight updates
- But total volume can be very large due to many concurrent requests

---

### Efficiency

#### Time Model

$$T = \frac{W \times t}{P}$$

where:

- $W$: work (e.g. number of FLOPs)
- $t$: average time per unit of work
- $P$: parallelism

#### Energy Model

$$E = \sum_{w \in W} E_w$$

where $E_w$ is the energy consumed executing work $w$. Measurement methods include external sensors and on-processor sensors.

#### Storage Efficiency (Data Compression)

$$\text{Compression Ratio} = \frac{\text{uncompressed size}}{\text{compressed size}}$$

- **Lossless**: original data can be fully recovered
- **Lossy**: cannot recover exactly, but the compressed data is close enough for the application (quantization in ML is essentially lossy compression)

#### Scalability

How resource requirements grow as scale increases

---

### CPU Architecture

**Von Neumann Architecture**

Programs are data too; code can be stored, loaded, and modified

```
┌─────────────────────────┐
│           CPU           │
│  ┌──────┐  ┌─────────┐  │
│  │ ALU  │  │   MEM   │  │
│  └──────┘  └─────────┘  │
│       ┌──────────┐      │
│       │  Regs    │      │
│       │  (PC…) │      │
│       └──────────┘      │
└────────────┬────────────┘
             │
      ┌──────┴──────┐
      │     RAM     │
      │  (Program   │
      │   + Data)   │
      └─────────────┘
```

**CPU Instruction Cycle**
1. **Fetch**: find current instruction address using the program counter (a register storing the current/next instruction address)
2. **Decode**: parse instruction meaning (decode opcode and operands)
3. **Execute**: execute the instruction (dispatch to ALU/FPU, etc.)
4. **Write back**: write execution result back to register/memory

One **CPU clock cycle**: all in-flight instructions advance one step together.
- **IPC (Instructions Per Cycle)**: as the name implies, how many instructions per cycle -- the core metric for CPU utilization


**ISA**: defines CPU rules, such as:
- What instructions it recognizes
- What registers it has
- How memory is addressed
- Function call conventions
- How exceptions are handled

---

### Execution Modes

#### Serial Execution

```
Timeline →
Inst 1: [F][D][E][WB]
Inst 2:             [F][D][E][WB]
Inst 3:                         [F][D][E][WB]
```

Each instruction completes before the next begins.
- Early / minimal / educational CPUs
- Simple but slow

#### Pipelined Execution

```
Timeline →
Inst 1: [F][D][E][WB]
Inst 2:    [F][D][E ][WB]
Inst 3:       [F][D ][E][WB]
Inst 4:          [F ][D][E][WB]
```

Different stages of different instructions can overlap, but the same instruction cannot parallelize within itself.
- Essential in modern CPUs, significantly increases throughput
- Intel/AMD/ARM/Apple Silicon

Three types of hazards:
- **Data hazard**: a later instruction needs the result of an earlier write before it can read (RAW, Read After Write)
  - Solution: stall, or data forwarding/bypassing -- pass the result directly to the next instruction
- **Structural hazard**: hardware (functional unit) resource contention
  - Solution: stall, add units, or pipeline functional units
- **Control hazard**: some instructions need to know the branch outcome
  - Solution: stall, or branch prediction

#### Parallel Execution

Multiple execution units simultaneously execute different instructions

```
Timeline →
Inst 1: [F][D][E][WB]
Inst 2: [F][D][E][WB]
Inst 3: [F][D][E][WB]
Inst 4: [F][D][E][WB]
```

Suited for large amounts of independent data: AI / graphics / matrix multiplication / scientific computing
- Multi-core CPU
- GPU
- SIMD/AVX
- AI tensor units

---

### Modern CPU Execution Optimizations

#### Out-of-Order Execution (OoO)

Program order defines semantics; execution order can be determined by data dependencies to improve performance. Modern CPUs fetch 8-16 instructions at a time and typically maintain hundreds of in-flight instructions simultaneously.

Whoever has their data ready executes first.

#### Superscalar Execution

Note: superscalar is not a type of OoO, but high-performance OoO CPUs are almost always superscalar.

The goal is to complete multiple instructions per cycle, e.g. issuing multiple instructions in the same cycle. The key is that instructions must not depend on each other.

```
Timeline (superscalar, fetch 2 per cycle) →
[F:I1,I2][D:I1,I2][E:I1,I2][WB:I1,I2]
         [F:I3,I4][D:I3,I4][E:I3,I4][WB:I3,I4]
```

Potential issues (false dependencies, often just name conflicts):
- **Anti-dependence (WAR, Write After Read)**: must read an earlier instruction's value before writing
- **Output dependence (WAW, Write After Write)**: write order cannot be violated
- Modern CPUs largely eliminate these with register renaming, distinguishing logical from physical register names
- Only RAW / data hazards are cases where a later instruction genuinely needs an earlier computation's result

Even though execution is out-of-order, commit must happen in-order.

#### Speculative Execution

CPU performs branch prediction, executes ahead, then verifies. If the prediction was correct, commit directly and save time; if wrong, discard the speculatively executed instructions and re-fetch.

---

### Modern Multi-Core CPU and Performance Ceilings

**SMT (Simultaneous Multithreading / Hyperthreading)**: multiple threads have their own PC, register state / partial frontend state, but share backend resources like ALU/FPU (same core)
- Advantage: improves hardware utilization, keeps the backend busy
- Disadvantage: resource contention and security issues

**CMP (Chip Multiprocessor / Multicore)**: true multiple cores, each with its own execution resources, sharing L3 cache, memory controller, main memory, etc.
- Advantage: true parallelism, more power-efficient than overclocking a single core, high throughput
- Disadvantage: parallel programming is hard, cache coherence is hard, memory bandwidth under pressure

**Theoretical lower bound on program execution time**:

$$T_{min\text{ (cycles)}} = \frac{W}{IPC_{max}}$$

Minimum cycles = total instructions ÷ maximum instructions completable per cycle

In seconds, divide the right side by clock frequency f (Hz)

#### Flynn's Taxonomy

| Class | Full Name | Meaning | Examples |
| ---- | ---- | ---- | ---- |
| **SISD** | Single Instruction, Single Data | Classic serial processor | Single-core CPU |
| **MIMD** | Multiple Instruction, Multiple Data | Multi-core, each core runs independently | Multi-core CPU, GPU (in some sense) |
| **SIMD** | Single Instruction, Multiple Data | Same instruction acts on multiple data simultaneously | Vector machines, GPU (core of ML computation) |
| **MISD** | Multiple Instruction, Single Data | Almost nonexistent in practice | -- |

---

### Vector Processors

Two directions:
- Vertical: most common -- two vectors computed element-wise to produce another vector
- Horizontal: computation within a single vector, producing a scalar or vector

Vector machines cannot do conditional jumps, so conditional branches use masks (e.g. `[1,0,1,0]` applies to elements 1 and 3; skips elements 2 and 4).

Handling non-contiguous memory:
- **Gather**: read data from scattered addresses, collect into a vector
- **Scatter**: write a vector's data to scattered addresses
- Both are much slower than contiguous load/store

Two vectorization approaches:
- Compiler auto-vectorization: compiler detects this can be SIMD, automatically generates AVX/SSE instructions
  - Advantages: simple, portable
  - Disadvantages: may not optimize successfully, no manual control
  - Use cases: the vast majority of ordinary scenarios
- Manual explicit: write code like `_mm256_add_epi32` that directly manipulates vector registers
  - Advantages: ultimate optimization and precise control
  - Disadvantages: extremely complex, hard to write, maintain, and port
  - Use cases: AI kernels, game engines, image processing, extreme HPC, compiler development, etc.

---

### GPU and CUDA

#### CPU vs. GPU Architecture

| Dimension | CPU | GPU |
| ---- | ---- | ---- |
| Core count | A few to tens of large cores | Thousands of small cores (SM × CUDA Cores) |
| Design goal | **Low latency** (latency-optimized) | **High throughput** (throughput-optimized) |
| Execution | Out-of-order superscalar | Sequential but highly SMT (64-way) |
| Clock frequency | High (3-5 GHz) | Lower (1-2 GHz) |
| Cache design | Large L1/L2/L3 Cache | Small L1, large register file, Shared Memory |
| Use cases | Complex control flow, low-latency tasks | Large-scale data parallelism, throughput tasks |

When a thread is waiting, CPUs speed up by reducing latency; GPUs have many threads/warps and can simply switch to another warp.

#### CUDA Basics

**CUDA hierarchy**:

```
Grid (entire task)
 └── Block (thread block)
      └── Warp (smallest scheduling/execution unit, 32 threads)
           └── Thread (individual thread)
```

**Warp Divergence**: threads within a warp take different branches, but a warp can only execute one instruction at a time, so it must run the true branch first, then the false branch, then merge -- effective utilization halves.
- For short branches, may use predication (masking) directly

To approach the theoretical performance ceiling of modern processors, you must make full use of vector instructions for parallelism, since high performance in modern CPUs/GPUs fundamentally comes from SIMD/vector parallelism.

That said, modern high-performance computing increasingly moves away from hand-writing low-level SIMD/CUDA, relying instead on compilers/DSLs to automatically generate high-performance code, e.g. Triton.

GPU/vector programming advice:
- Memory layout, parallelism, and batching should all be designed GPU-first -- and this usually makes CPU paths faster too
- DSLs like Triton are simpler and more portable than handwritten CUDA; the Triton compiler handles many low-level details automatically
- In some cases, CPU auto-vectorized performance is also very high
- ISPC can be used for CPU SIMD programs, analogous to CUDA on GPU

---

### ML and Binary Rules / Data Layout

#### Integer Representation

Affects how data is quantized (e.g. FP16 quantized to INT8), how weights are stored, decoded, and converted back to approximate float values

#### Bit Manipulation

One byte = 8 bits, but INT4 = 4 bits, so one byte stores two INT4 weights.

Inference needs to handle load byte, mask/shift, sign extend, etc.

#### Floating Point Representation

Determines ML numerical stability, training precision, memory footprint, and compute throughput. For example, FP16 has higher precision but a smaller dynamic range; BF16 has higher dynamic range but coarser precision.

IEEE 754 standard: FP32 = 1 sign bit + 8 exponent bits + 23 mantissa bits. High precision and range, but memory and bandwidth intensive. Also not exact values, so different gradient accumulation orders or different GPU/kernel combinations may produce different training results.

- FP32: higher precision and range, but slow and large
- FP16: fast, memory-efficient, but small range, prone to overflow/underflow
- BF16: range close to FP32, more stable for training, but coarser precision
- FP8: faster and more compact, but more prone to precision loss

#### Byte Order

Affects how model files are read, how tensor data is interpreted, and whether cross-platform transfer is correct. Must use the correct byte order to read correct values.

#### Structs and Arrays

Structs have padding for alignment. Good alignment means fast load/store; poor alignment noticeably slows access.

GPU/CPU handle contiguous memory access much faster than scattered access. Matrix multiplication, attention, and convolution all depend heavily on layout and tiling.

Union significance: shares the same memory block with no data copying, only changing how it's interpreted. Useful for inspecting raw bit patterns of float/BF16/FP16, doing low-precision format conversions, etc.

#### Sparse Data Formats

Many matrices have mostly zero elements -- storing all of them wastes compute and storage. Some examples:
- Adjacency matrices in graph neural networks
- Gating matrices in MoE
- Weight matrices after pruning
- Word embedding lookups

Two formats:

**COO (Coordinate Format)**: uses two/three arrays to store coordinates and values of non-zero elements

```
Sparse matrix:        COO representation:
0  0  1  0            row: [0  2  2]
0  0  0  0    →       col: [2  1  3]
0  1  0  1            (optional data array)
0  0  0  0
```

Advantages: intuitive, easy to construct  
Disadvantages: stores redundant information, no fast access to a specific row

**CSR (Compressed Sparse Row)**:
- `col`: column indices
- `row_start`: starting position of each row
- `data`: non-zero values

```
Sparse matrix:        CSR representation:
0  0  1  0            col:       [2  1  3]
0  0  0  0    →       row_start: [0  1  1  3  3]
0  1  0  1           
0  0  0  0
```

Advantages: fast access to all non-zero elements in row i, sequential access is fast, less redundant information  
Disadvantages: multiple indirect memory accesses (load `row_start[i]`, then `col[j]`, then `data[j]` -- possible multiple cache misses); hard to vectorize due to non-contiguous addresses; difficult to modify structure

#### Data Layout

**AoS (Array of Structures) vs. SoA (Structure of Arrays)**

| Layout | Access pattern | Vectorization | Cache efficiency |
| --- | --- | --- | --- |
| AoS | Access one x every sizeof(Point) | Requires Gather, difficult | Poor (loads unneeded y) |
| SoA | Sequential access to x array | Direct, efficient | Good |

If matrix multiplication's access direction matches memory layout (e.g. row-major in C), access is sequential and much faster than jumping around.

Can also use loop interchange to change loop order, or loop tiling/blocking to process matrices in small tiles, improving cache hit rate. High-performance compilers like Triton use this technique.

---

### Memory Technology

| Technology | Volatile | Speed (latency) | Density | Use |
| ---- | ---- | ---- | ---- | ---- |
| **Registers** | Yes | Fastest (< 1 ns) | Lowest | CPU/GPU internal temporary storage |
| **SRAM** | Yes | Very fast (~1-5 ns) | Low (6 transistors/bit) | CPU/GPU Cache (L1/L2) |
| **DRAM** | Yes | Slow (~50-100 ns) | High (1 transistor + capacitor/bit) | Main memory (RAM), GPU VRAM |
| **HBM** | Yes | Fast (DRAM-level latency, higher bandwidth) | High | Modern GPU main memory (A100/H100) |
| **NVMe SSD** | No | Very slow (~100 μs) | Very high | Persistent storage, model weight loading |
| **HDD** | No | Extremely slow (~10 ms) | Highest | Large-scale dataset storage |

**Memory bandwidth**: how much data can be moved per second

Since each memory bank can handle only one request at a time and memory access is slow, a request queue buffers multiple requests to ensure bandwidth is fully utilized (**Memory Level Parallelism, MLP**).

If requests always hit the same bank, other banks sit idle and bandwidth utilization drops. Modern memory controllers use interleaving -- distributing consecutive addresses across different banks -- to mitigate this.

GPU shared memory has 32 banks, corresponding to the 32 lanes of a warp. A core goal of GPU kernel optimization is to have warp threads access different banks as much as possible, maximizing bandwidth.

---

### Cache

CPU is fast, DRAM is slow, hence caching.

Hierarchy: Register → L1 → L2 → L3 → DRAM → SSD
- Closer means faster, smaller, more expensive
- Further means slower, larger, cheaper

Higher cache hit rate means lower average access time. Cache misses carry a very high penalty.

#### Locality Principles

- **Spatial locality**: after accessing one address, nearby addresses are likely to be accessed soon
- **Temporal locality**: recently used data is likely to be needed again soon

#### Cache Organization

- **Direct-Mapped**: one address can only map to one fixed cache location -- simple, fast, prone to conflicts
- **Fully Associative**: one address can map to any cache location -- fewer conflicts, but complex hardware
- **Set-Associative**: maps to a set first, then selects among multiple ways within that set -- a compromise

#### 3C Cache Miss Model

- **Compulsory Miss**: first-ever access, definitely not in cache
- **Conflict Miss**: multiple addresses map to the same cache set, evicting each other
- **Capacity Miss**: working set is too large to fit in cache

#### Cache Replacement Policies

- **OPT (Optimal)**: evict the line furthest from reuse in the future. No one knows the future, so this is a theoretical optimum only
- **LRU (Least Recently Used)**: evict the least recently used line
- **MRU (Most Recently Used)**: evict the most recently used line. Used for some special patterns, e.g. scanning a huge array in a loop
- **Random/FIFO**: simple to implement

#### Cache Write Policies

- **Write-Through**: write to DRAM immediately when CPU modifies cache
  - Advantage: simple
  - Disadvantage: every write goes to DRAM -- slow
- **Write-Back**: mark the cache line when modified; write back to DRAM only when evicted
  - Advantage: reduces memory traffic, faster
  - Disadvantage: more complex to implement

---

### GPU Memory Hierarchy

GPU devotes large chip area to registers and data movement in pursuit of throughput. Since GPU runs a massive number of threads simultaneously and each thread needs independent registers, the register file is especially large -- more important than cache here.

Shared Memory is programmer-managed small SRAM, extremely fast, the key resource for high-performance kernels.

DMA (Direct Memory Access) is dedicated hardware for data movement. With DMA, CPUs/GPUs don't have to move data themselves, enabling compute/communication overlap.

---

### Memory Coherence

In a multi-core CPU, each core has its own cache. Making the same memory address appear consistent across all cores is what cache coherence solves.

The most widely used protocol is MESI:
- M = Modified: this core modified it; memory has the old value; no other core has a valid copy
- E = Exclusive: only this core has it; consistent with memory
- S = Shared: multiple cores have it; read-only; consistent with memory
- I = Invalid: invalid; must reload next time

If one core wants to write to a cache line, all copies in other cores must be invalidated.

In multi-thread/multi-core training, shared data is frequently modified -- a major performance bottleneck. Optimization approaches include reducing sharing and batching synchronization to cut communication and sync overhead.

---

### Virtual Memory

Like virtual registers, the essence is making programs think they own a large contiguous memory space, while actual memory may be physically scattered. It allows multiple programs to safely share memory, hides physical memory fragmentation, and temporarily stores data on disk when RAM runs low.

- Virtual memory is managed in Pages, commonly 4 KB
- Page Table stores virtual page → physical page mappings
- TLB (Translation Lookaside Buffer) caches recent address translation results for reuse

Page Fault conditions:
- Page table mapping not yet established (first access): OS allocates a page and creates a mapping
- RAM is full, page has been swapped to disk: OS reads it back from disk -- very slow

Each Page Table entry has permission bits (Read/Write/Execute). Each process can only see its own virtual memory, preventing programs from tampering with each other's data, stealing credentials, or attacking the system -- enabling process isolation and memory safety.

For large model weights, Huge Pages (2 MB/1 GB) are typically used to reduce page count and TLB misses.
