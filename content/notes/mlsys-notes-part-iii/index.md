---
title: "MLSys 3：编译器栈、推理引擎、量化与系统前沿"
date: 2026-06-07
tags: ["mlsys"]
math: true
draft: false
---

<aside>

**TL;DR**

Part III 学的是真实系统如何把前两部分落地：具体的编译器、推理引擎、量化方法、通信库、专用硬件与工程案例

Part I 关注硬件资源，Part II 关注计算与资源的映射，Part III 关注工程实现与前沿系统

- Triton 用 Block 抽象让编译器接管 shared memory、同步与向量化，开发者只需要关注每个 Block 内的逻辑
- PyTorch 2（Dynamo → FX → Inductor → Triton）在 eager 之上加一层自动编译
- vLLM / PagedAttention 把 OS 分页思想用到 KV Cache，配合 Continuous Batching 大幅提升吞吐
- 量化（GPTQ / AWQ / Marlin / QMoE）核心是省显存带宽，难点是隐藏量化/反量化税
- 通信优化分单卡（Triton、FlashAttention）和多卡（NCCL、MSCCL 拓扑感知合成、CoCoNet 通算融合）
- Scaling Laws 说明参数越大越好，Chinchilla 修正为要平衡参数与数据，Inference-Time Scaling 提出推理越久可能答案质量也越好
- 专用硬件（TPU / Systolic Array、Groq TSP）用静态、确定性执行换取可预测的延迟
- AI Infra 才是大规模训练真正的工程难点
- staleness tolerance（用在 DistriFusion 上）是一条贯穿性的系统哲学：用稍旧的数据换并行

</aside>

## Triton

用 Python 写 GPU 代码，底层自动编译为高度优化的 CUDA/PTX。核心思想是基于 **Block（块）** 编程，而不是基于单个线程。定位是深度学习算子开发：比手写 CUDA 省力，比 PyTorch 自定义算子更灵活、性能更接近峰值。

两条生命线：

- `triton.language as tl`：GPU 上的专用语言包，所有并行指令（`load` / `store` / `dot` / `arange` 等）都从它调用。
- `@triton.jit`：装饰器，把 Python 函数编译成 GPU 机器码。

### 编程模型：Block 抽象

手写高性能 CUDA 极难，程序员要同时管理 Shared Memory 的加载存储、Warp 内的 Coalesced 访问、寄存器分配与 Spilling、向量化与 Bank Conflict 规避、Tensor Core 的调用格式（wmma / mma）。而且这些优化高度硬件特定，对 A100 的最优代码到 H100 上未必最优，更别说 AMD GPU。

Triton 在 CUDA 线程模型和高层 Python 之间插入一层中间抽象：

- **程序员视角**：只写每个 Program（对应一个 Thread Block）如何处理一个 Output Tile，用 `tl.load` / `tl.store` / `tl.dot` 操作整个 Tile，Tile 大小作为编译期常量（`constexpr`）。
- **编译器自动**：分析访问模式生成 Shared Memory 加载、插入 `__syncthreads()`、向量化 Tile 内操作、规避 Bank Conflict、为 Tensor Core 生成 mma 指令序列、按架构管理寄存器分配。

一句话区分：CUDA 是在每个线程的微观视角手动管理共享内存和同步；Triton 只写每个块怎么做，线程划分、内存合并、流水线优化都交给编译器。

### 通用骨架与启动

内核侧四步，闭着眼也要写出来；主机侧用 wrapper 做后勤（kernel 只认指针，不认张量）。

```python
@triton.jit
def my_kernel(input_ptr, output_ptr, n_elements, BLOCK_SIZE: tl.constexpr):
    pid = tl.program_id(axis=0)                            # 1. 车间报到
    offsets = pid * BLOCK_SIZE + tl.arange(0, BLOCK_SIZE)  # 2. 规划区间
    mask = offsets < n_elements                            #    边界掩码
    data = tl.load(input_ptr + offsets, mask=mask)         # 3. 加载
    result = …                                             #    计算（只改这里）
    tl.store(output_ptr + offsets, result, mask=mask)      #    存回

def wrapper(x: torch.Tensor):
    output = torch.empty_like(x)        # 显存里提前挖好同形状的空坑
    n_elements = x.numel()
    grid = lambda meta: (triton.cdiv(n_elements, meta['BLOCK_SIZE']),)
    my_kernel[grid](x, output, n_elements, BLOCK_SIZE=1024)
    return output
```

关键点：

- 入参全是指针（内存首地址），绝不传整个张量。用「基地址 + 偏移量数组」（`x_ptr + offsets`）一次拿到整块地址。
- `BLOCK_SIZE: tl.constexpr` 是编译期常量，必须是 2 的幂。
- `tl.arange(0, BLOCK_SIZE)` 并行生成偏移数组，不能用 Python 的 `range`。
- `mask` 是布尔数组，防止最后一个块越界，load / store 都要带。
- `grid = lambda meta: …` 让 BLOCK_SIZE 改动自动传播，不写死数字；`triton.cdiv(a, b)` 是向上取整除法，保证不丢数据。
- `kernel[grid](args)`：方括号是车间数量（grid），圆括号是数据。

### 最小完整示例：向量加法

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

通用部分（`pid` / `offsets` / `mask` / `load` / `store` / `constexpr`）几乎不变，所有更复杂的算子都只在「计算」这一步做文章。

### 进阶：矩阵乘法

写矩阵乘只需两处改动：计算逻辑换成 `tl.dot(a, b)`，网格从一维改成二维。每个 Program 负责 C 中一个 `BLOCK_M × BLOCK_N` 的输出 Tile，累加器留在寄存器里，沿 K 维分块循环做乘加。

```python
@triton.jit
def matmul_kernel(A, B, C, M, N, K,
                  stride_am, stride_ak, stride_bk, stride_bn, stride_cm, stride_cn,
                  BLOCK_M: tl.constexpr, BLOCK_N: tl.constexpr, BLOCK_K: tl.constexpr):
    pid_m, pid_n = tl.program_id(0), tl.program_id(1)
    offs_m = pid_m * BLOCK_M + tl.arange(0, BLOCK_M)
    offs_n = pid_n * BLOCK_N + tl.arange(0, BLOCK_N)
    offs_k = tl.arange(0, BLOCK_K)
    acc = tl.zeros((BLOCK_M, BLOCK_N), dtype=tl.float32)   # 累加器在寄存器
    for k in range(0, K, BLOCK_K):                          # 沿 K 维分块
        a = tl.load(A + offs_m[:, None] * stride_am + (k + offs_k)[None, :] * stride_ak,
                    mask=(offs_m[:, None] < M) & ((k + offs_k)[None, :] < K))
        b = tl.load(B + (k + offs_k)[:, None] * stride_bk + offs_n[None, :] * stride_bn,
                    mask=((k + offs_k)[:, None] < K) & (offs_n[None, :] < N))
        acc += tl.dot(a, b)                                 # 编译器映射到 Tensor Core mma
    tl.store(C + offs_m[:, None] * stride_cm + offs_n[None, :] * stride_cn,
             acc.to(tl.float16),
             mask=(offs_m[:, None] < M) & (offs_n[None, :] < N))

grid = lambda meta: (triton.cdiv(M, meta['BLOCK_M']), triton.cdiv(N, meta['BLOCK_N']))
```

编译器在背后把两个 Tile 的 `tl.load` 编译成「先进 Shared Memory，再喂给 Tensor Core 输入寄存器」，并自动插同步、向量化、按 Tile 大小选 mma 变体。

### Triton vs 手写 CUDA

| 维度 | 手写 CUDA | Triton |
|---|---|---|
| 代码量 | 数百行 | 数十行 |
| 性能（A100 FP16 MatMul） | ~85–95% 峰值 | ~80–90% 峰值 |
| 可移植性 | 极差（针对特定 GPU） | 好（NVIDIA / AMD） |
| 开发效率 | 低 | 高 |

局限：目前只支持 GPU（不支持 CPU）；不支持全部 CUDA 功能（如动态共享内存分配）；FlashAttention 这类极致优化的 kernel 手写 CUDA 仍有优势，因为需要更细粒度的控制。

现实影响：PyTorch 2 的 TorchInductor 后端默认生成 Triton kernel；xFormers、Flash-Attention 2 的大量实现基于 Triton；Flash Decoding 等推理优化也依赖它。Triton 正在成为 ML kernel 开发的事实标准。

## vLLM

训练好的模型本身只是权重。推理引擎是在模型之上，负责接请求、调度 GPU、管理显存、最后输出 token 的一层软件。

推理问题和训练问题非常不一样。推理的自回归解码的特点是：推理时，每生成一个 token，都要保留已生成的 token 的所有 KV pairs，于是它会一直线性增长。一些常见的问题有：

- 传统做法由于不知道最终会生成多长的回答，会为每个请求预分配最大可能序列长度的 KV Cache，但实际上大多数请求不需要最大长度，导致大量 KV Cache 显存被浪费
- 释放短请求后留下的碎片无法被长请求利用
- 多个请求可能共享 system prompt / conversation history，但是传统方法都是给每个请求独立分配 KV Cache，无法共享这部分 prefix

### PagedAttention

由于每个 decode step 只处理一个新的 token，所以计算强度不大，瓶颈主要是把 KV Cache 从显存搬进来。一个 batch 能放多少请求取决于显存里能放多少 KV Cache，这直接决定吞吐量。

以上三个不同的问题其实都是同一种类的系统问题。在以前的内存优化上就已经研究过，OS 给出的统一答案是：分页，这也是 PagedAttention 的核心。

每个请求维护一张逻辑 page 到物理 block 的 page table，物理 block 可以分散，但逻辑上连续。

- 如果 block size 大，page table 相对会小点，访存更连续，但最后一块容易浪费空间
  - 比如一个能装 20 个 token 的 block，一次请求生成 21 个 token，那其中就有一个 block 只用了 1 token，很浪费
- 如果 size 过小，page table 就大，查表多，访存散

由于物理 block 分散了，所以 PagedAttention 的 kernel 需要多一步间接寻址（查表）的跳转步骤。所以 kernel 的设计目标应该是即使 KV Cache 不连续，也尽量像连续地一样，让 warp 里的线程访问相邻地址。PagedAttention 的 kernel 几乎一定会更难写，但它显存利用率提升。

当多个请求共享 prefix 时，他们的 page table 指向同一批物理 block，block 上再留一个引用计数，这样读的时候就读同一个。只有写入的时候才出发 CoW（Copy-on-Write）创建私有副本。

### Continuous Batching

由于 PagedAttention 把 KV Cache 变成了可动态分配/回收的 block，所以不用等所有请求同时完成，而是已完成的请求立即释放 Page，新请求立即填入，这种动态请求调度就是 Continuous Batching。

### Preemption

当显存不足时，有两种策略：
- Swap：把被踢请求的 KV Cache 复制到 CPU 内存，过会儿再复制回来，这样无需重算。代价是 PCle 需要来回搬运，很慢
- Recompute：丢弃 KV Cache，要用的时候重算。由于 Prefill 是大矩阵乘法，天生适合 GPU 计算，很快，所以可能比 PCle 来回搬运还快点

## 量化

量化本质是把连续或高精度的数字，塞进更少的离散格子里。权重误差经过矩阵乘法就会变成输出误差。

推理阶段 batch 小的时候一般都是 memory-bound，这种情况量化主要是为了节省显存带宽，不单纯是为了低精度算得更快。batch 大的时候提升 kernel 计算效率才是比较关键的。

### 主流量化方法

- **GPTQ（Post-Training Quantization via Layer-wise OBQ）：**
  - 内部用 Hessian 近似来判断不同权重量化误差的重要性的一种方法
  - Hessian 是二阶导数矩阵，用来描述参数变一点点，loss/误差会弯曲得多厉害，可以理解为一种敏感度地图

- **AWQ（Activation-Aware Weight Quantization）：**
  - 用少量 calibration data 跑一遍模型，观察 activation 分布，找出重要 channel，然后对权重做 per-channel scaling，让重要 channel 在量化时更不容易受伤的一种方法

- **Marlin（INT4 GEMM Kernel for Weight-only Quantization）：**
  - 量化在实际 GPU 上跑起来中涉及许多 kernel 开销，比如 unpack, dequant 等
  - Marlin 是一种专门为 4-bit weight-only quantization 设计的高性能 GEMM kernel，通过权重重排、tile 设计、异步加载、scale 处理等手段，尽量隐藏反量化税

- **QMoE**
  - 针对 trillion-parameter MoE 的压缩 + 存储格式 + GPU 解码 kernel 的一整套框架
  - 普通 dense Transformer：每一层有 Attention, MLP/FFN
  - MoE Transformer：把某些 MLP/FFN 换成很多 Expert：Attention, Router, Experts
    - 每个 expert 通常就是一个小的 FFN/MLP
    - router 会根据 token 决定这个 token 送去哪个 expert，比如 top-1 或 top-2
    - 每个 token 只激活少数 experts，而不是所有 experts 都算
    - MoE 总参数量明显更大，但每个 token 实际激活的参数是一小部分

## PyTorch 2 / TorchDynamo / Inductor

PyTorch 2 想解决的问题是：用户还像以前一样写普通 PyTorch（eager mode，每个算子单独调用 kernel，但调度开销大且难 fuse），但系统自动把它变成更快的 graph，再生成高性能 kernel。所以这是在 eager PyTorch 上加了一层自动编译系统。

流程：
1. 普通 Python / PyTorch 代码
2. TorchDynamo：在 Python bytecode 层面观察你的程序运行，把里面的 Tensor 操作抓出来
   1. 难点是 Python 太动态，所以要用 bytecode-level 的方式尽量不让用户改代码。
3. FX Graph：IR，只保留更容易优化的 Tensor 计算关系
4. TorchInductor 优化图并编译
   1. fusion：减少 Python 调用和显存读写
   2. graph break：在 TorchDynamo 抓不到图的时候退回 eager 执行
      1. 是性能杀手。它会让图被切碎，导致很多优化做不了。
   3. guard：编译器为了安全，会给编译好的图加一些 guard 条件，
      1. 如果下一次调用满足 guard，就复用编译好的图
      2. 如果不满足，就重新编译一个新图
      3. 是动态语言和静态编译之间的妥协。它让 PyTorch 2 可以处理动态输入，但代价是可能重新编译
5. 生成 Triton / C++ kernel
6. GPU / CPU 执行

## 通信

**单卡优化**：  
- 怎么让一个 GPU 内部少访存、多复用、kernel 更快
- 代表：Triton、FlashAttention、Marlin
  
**多卡通信优化**：  
- 怎么让多张 GPU 之间少等待、少传废数据、传得更合理。 
- 代表：NCCL、MSCCL、CoCoNet

### 主要通信操作（传统 NCCL, NVIDIA Collective Communications Library）

- **AllReduce**：
  - 每张 GPU 都有一份数据，比如梯度
  - 把所有 GPU 的数据加起来，然后结果发回每一张 GPU
  - 常用于 Data Parallel 训练同步梯度

- **AllGather**：
  - 每张 GPU 有一块数据
  - 最后每张 GPU 都拿到所有人的数据
  - 常用于 Tensor Parallel / Sequence Parallel

- **ReduceScatter**：
  - 所有 GPU 的数据先加起来
  - 但结果被切成几块，每张 GPU 只拿其中一块
  - 常用于 ZeRO、Tensor Parallel

- **Broadcast**：
  - 一张 GPU 把数据发给所有 GPU

### MSCCL, Microsoft Collective Communications Library

优化通信本身。传统通信库有一些固定算法，比如 Ring, Tree 之类的，使用人工设计好的通用通信算法。但真实机器拓扑很复杂。比如一台机器里 GPU 之间有 NVLink，有些 GPU 连接更快；跨机器又有 InfiniBand；不同集群的连接方式也不同。所以没有一个算法永远最好。

MSCCL 则是针对具体拓扑、具体数据大小、具体 collective，自动合成一个更适合的通信算法。

### CoCoNet, Collaborative Convolutional Network

联合优化通信和计算。传统分布式 ML 框架一般是 communication 完整结束，再做 computation，都是分开的。 CoCoNet 不把 communication 和 computation 当成两个完全分开的黑盒，把它们放进同一张图里，一起优化。

主要做：
- **chunking + overlap**：把一个大 tensor 的通信拆成很多块，一块通信完成后，不等整个 AllReduce 完成，而是马上对这一块做后续计算。
- **communication-compute fusion**

## Scaling

### Scaling Laws

大模型性能由这些决定：
- 模型参数量 N
- 训练数据量 D
- 训练计算量 C

经验上，只要你合理增加模型、数据和计算，loss 会按某种比较稳定的规律下降，所以参数越大越好。

### Chinchilla

很多大模型不是参数不够，而是训练 token 不够。在同样训练计算量下，更小模型 + 更多 token 可能更好。不应该盲目把模型做得更大，而应该平衡模型大小和训练数据量。

如果推理时的服务成本（用户请求数 × 推理成本）在模型生命周期内足够高，那么用更多数据训练更小的模型是经济最优的。训练时多花一些计算，换取每次推理成本的大幅降低。

### Inference-Time Scaling

现代模型不只是训练时 scale，推理时也开始 scale。以前是想要尽可能推理快，但后来发现 reasoning 可能让答案更好。一些例子是：
- longer chain-of-thought / reasoning tokens  
- self-consistency 多次采样再投票  
- tree search / beam search  
- verifier / reward model 选择答案  
- tool use / agent 多步执行  
- test-time compute scaling

推理可能涉及：一个用户问题 → 生成多个候选 → 每个候选继续展开 → 调用工具 → 验证 → 反复修正 → 最后输出。它需要更多 token、上下文、KV cache、并发请求、调度复杂度、latency 成本等。

## TPU / Systolic Array

GPU 是比较通用的并行处理器。它可以跑很多类型的 kernel，比如 matmul、attention、sort、sampling、image processing。但这种通用性也带来复杂度：线程调度、cache、shared memory、warp、memory coalescing 等。
- 灵活，适合各种算子
- 需要程序员/编译器精细管理 tiling、memory、warp

TPU 更专门。它主要为深度学习里的大规模 tensor compute 设计，尤其是矩阵乘法。它的核心硬件结构之一就是 systolic array。
- 更专用，特别适合规则的大矩阵乘法  
- 数据流更固定，能效和吞吐很好
- 强项是大规模规则 tensor compute，但遇到动态、不规则、控制流多的 workload，就需要靠编译器和系统设计来弥补

Systolic array 可以这么理解：

```
PE  PE  PE  PE
PE  PE  PE  PE
PE  PE  PE  PE
PE  PE  PE  PE
```

每个 PE 是一个小计算单元，通常做 multiply-add。矩阵乘法时，数据不是每次都从内存读出来送到一个核心里算，而是像水流一样穿过这个计算阵列。一个方向流入 A 矩阵的数据，另一个方向流入 B 矩阵的数据，每个 PE 在本地做乘加，然后把数据继续传给旁边的 PE。数据不用频繁来回访问远端内存，而是在计算阵列里流动并复用。

## AI Infra：存储、调度、集群管理

跟软件工程中的 infra 类似，当训练/推理规模变得很大以后，真正困难的不只是写 model，而是怎么管理数据、checkpoint、GPU 集群、故障、调度，这一部分就是 AI Infra。

### Tectonic-Shift（Meta，ATC 2023）

Meta 提出的一种大规模 AI 训练基础设施。大模型训练需要读大量数据，也要不断写 checkpoint。checkpoint 可能一次几百 GB，甚至更大。如果每次保存 checkpoint 都要同步写到慢存储，GPU 就会被迫等待。

Tectonic-Shift 的思路是：让训练数据和 checkpoint 的读写跟得上 GPU，不要让存储系统拖慢训练。主要优化有：
1. **Foreground Buffering（前台缓冲）**：Checkpoint 写入先进入快速 SSD 缓冲层，异步刷入 HDD，避免 Checkpoint 阻塞训练（传统做法：同步写入慢速 HDD，训练暂停 10+ 分钟）
2. **Tiered Storage（分层存储）**：热数据放 SSD；冷数据放 HDD 或对象存储
3. **Read-Ahead Prefetch（预读预取）**：检测 ML 训练的顺序访问模式，prefetch 下 N 个数据文件，提速 GPU 数据加载

### MAST, Machine learning Allocation and Scheduling Tool / Global Scheduling of ML Training（Meta，OSDI 2024）

Meta 提出的一种面向大模型训练的显存感知调度系统。Meta 在全球多个地理位置运营数据中心，ML 训练作业需要数千 GPU 运行数周。任何设施的局部故障（网络分区、单个数据中心断电）都可能导致整个训练作业失败。

如果一个公司有多个数据中心，每个数据中心有很多 GPU，那就不能只看哪里有空 GPU，还要看哪里更稳定、网络更好、故障概率更低。

- 一个中央调度器知道所有数据中心的 GPU 状态（可用、忙碌、故障），为每个训练作业选择最优的 GPU 集合（考虑网络拓扑、故障历史、剩余容量）
- 关键词是 Goodput（有效完成的训练步数 / 时间）。优先选择故障率低的节点，即使暂时 GPU 利用率不是 100%
- 维护多个 Shadow Job（影子作业），一旦主作业节点故障，立即用 Shadow Job 从最近 Checkpoint 重启（Warmup 时间 < 1 分钟）

### Singularity（Microsoft，2022）

Microsoft 提出的一种调度系统。主要允许：
- **动态抢占（Preemption）**：高优先级作业（如推理服务流量突发）需要 GPU 资源时，可以暂停正在训练的低优先级作业
- **动态弹性扩容（Elasticity）**：允许作业在运行中动态增加或减少 GPU 数量（如集群有空闲 GPU 时自动扩展）

实现方式为：ML 框架和硬件之间插入一个虚拟化层（Execution Substrate）：
1. 定期自动创建轻量级 Checkpoint（比传统 Checkpoint 小 10×，通过只存储 diff 实现）
2. 接到抢占信号时，等到下一个 Checkpoint 点（通常 < 30 秒），保存状态后暂停
3. 资源恢复后，从 Checkpoint 无缝恢复（用户感知 = 训练速度略慢）
4. 弹性扩展：新增 GPU 加入时，重新分片数据并行组，从当前 Checkpoint 继续（支持 FSDP 的动态 resharding）

## DistriFusion

Li et al., "DistriFusion: Distributed Parallel Inference for High-Resolution Diffusion Models," CVPR 2024

- LLM 过程：已有 token → 生成下一个 token → 再生成下一个 token → 继续
- Diffusion 过程：随机噪声 → 去噪一步 → 再去噪一步 → 再去噪一步 → 清晰图像

高分辨率图像生成很慢，所以 DistriFusion 想要解决如何把一次 diffusion 推理拆到多张 GPU 上并行。如果简单地将图像划分到不同 GPU，每个 GPU 只有图像的一部分，需要全局感受野的 Self-Attention 无法在不通信的情况下完成，但通信很贵。

DistriFusion 的关键洞察是：diffusion 相邻步骤的中间特征变化很小，是渐进变化的。所以既然变化很小，那么这一轮需要的"全局特征"，可以先用上一轮的近似结果。

核心技巧：**Asynchronous Displacement**
- 当前步计算时，不用等当前步的全局通信结果，而是先用上一步已经通信好的全局特征，之后再通过异步计算，把通信结果补上
- 核心系统哲学是 **staleness tolerance**：只要结果质量不明显下降，系统允许用稍微旧一点的数据

## Groq TSP

GPU 是很强的通用并行机器，但性能波动很多很动态，比如 cache 是否命中，warp 怎么执行，内存访问和 kernel 怎么调度等。这些让延迟很难预测。

Groq TSP 是一种偏静态、确定性、编译器驱动的 AI 推理硬件；它的重点不是比 GPU 更通用，而是让推理执行更可预测。

它的实现方式有：
1. **无 Cache**：彻底取消硬件 Cache，改用显式管理的 Scratchpad Memory（编译器决定数据在何时位于何处）
2. **In-order Execution（顺序执行）**：无 OOO，无推测执行，每条指令在固定的时钟周期执行
3. **静态调度（Static Scheduling）**：编译器（而非硬件调度器）决定每个周期执行哪条指令，发射给哪个功能单元
4. **超长指令字（VLIW-like）**：每个时钟周期，编译器同时控制多个独立的功能单元（类似 VLIW 处理器）

## 自动微分的关系代数视角

普通深度学习：自动微分围绕 dense tensor 设计，但对于关系型计算（数据库查询、推荐系统、图数据等）效率低。

关系代数 AD：把自动微分从 dense tensor 世界扩展到数据库/稀疏表操作世界，用 join、group-by、aggregation 的方式理解前向和反向，推导这些关系操作的代数性微分规则。

普通 Tensor AD：  
- 适合 dense tensor 计算
- 典型场景：Transformer、CNN、MLP
  
关系代数 AD：  
- 适合稀疏、表格、推荐系统、embedding-heavy workload
- 典型场景：lookup、join、group-by、aggregation
