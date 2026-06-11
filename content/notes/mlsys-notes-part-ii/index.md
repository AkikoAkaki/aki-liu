---
title: "MLSys 2：计算图、训练系统与分布式扩展"
date: 2026-05-31
tags: ["mlsys"]
math: true
draft: false
---

<aside>

**TL;DR**

Part II 学的是 ML 程序如何被执行：模型如何表示，计算如何调度，数据如何通信，以及训练如何扩展到大规模系统

Part I 关注硬件资源，Part II 关注计算与资源的映射

- Computation Graph 描述模型结构和数据依赖
- Operator 是张量级别的计算单元
- Kernel 是最终运行在硬件上的代码实现
- Graph Compiler 负责图优化、算子融合和代码生成
- Communication 是分布式训练和推理的核心成本之一
- DP / TP / PP / Expert 等并行策略本质上是在不同维度切分工作
- Training 的本质是前向传播、反向传播和参数更新
- FSDP、ZeRO 等技术通过分片和动态加载突破单卡显存限制
- MoE 通过稀疏激活实现"大参数量、低计算量"
- LoRA、QLoRA 等 PEFT 方法通过只训练少量参数降低微调成本

</aside>

### Computation Graph 优化

#### ML 程序的两种视角

- **Computation Graph**：算子级别，宏观，把整个模型看成一个个 operator 连起来
	- 主要优化方式：图变换，算子融合，并行策略等
	- 主要工具层：TorchInductor，XLA，TensorRT，TVM graph pass 等
- **Loop-Intensive Code**：循环级别，微观，把最终的所有算子看成大量 nested loops
	- 主要优化方式：向量化、分块、软件流水等
	- 主要工具层：CUDA，Triton，CUTLASS，LLVM backend 等

#### ML 应用的分类

- **Deep Learning 任务特定模型：**
	- 计算机视觉（ResNet、ViT）
	- 语音识别、NLP 分类
- **Large Language Models（LLMs）：**
	- GPT 系列、Gemini 系列、Claude 系列等
	- 特征：极大的参数量（百亿到万亿）、自回归生成、KV Cache 管理挑战
- **Diffusion Models（扩散模型）：**
	- Stable Diffusion、DALL-E 等
	- 特征：迭代推理（多步去噪）、时间步依赖

三类模型统称为 Foundation Models（基模），共同特征：

- 大量 Compute：每次推理需要大量矩阵乘法
- 大量 Memory：参数权重和中间激活值占用大量显存
- 大量 Communication：分布式训练/推理时需要大量数据传输

#### 算子

ML 程序的基本计算单元是算子（Operator / Op）。和 CPU 指令的区别是，它基于 tensor 而非 scalar。

不同算子的算术强度不同，瓶颈也不同，所以优化方法也不同：

- **Elementwise operator（ReLU, Add, Mul, Sigmoid）**
	- Compute 少，memory traffic 大，FLOP/Byte 低，通常 memory-bound。
	- 优化方式：fusion, memory coalescing
- **Tensor-level operator（MatMul, Conv, Attention）**
	- FLOP/Byte 高，大矩阵通常 compute-bound
	- 优化方式：tiling, Tensor Core, shared memory reuse, vectorization
- **Reduction operator（Softmax, LayerNorm, Sum）**
	- 需要跨元素 aggregation/synchronization，性能介于前二者之间
	- 优化方式：tree reduction, warp reduction, shared memory reduction
- **Data transformation operator（Reshape, Transpose, Concat）**
	- 几乎不 compute，核心是 memory layout 和 access pattern
	- 优化方式：layout optimization, memory coalescing, fusion

#### Eager Execution 和 Graph Execution

Eager Execution 是立即执行
- 优点：调试简单，代码直观
- 缺点：错过跨算子优化机会（如 MatMul 和 ReLU 可以融合）

Graph Execution 是先构建完整计算图，再编译优化，再执行
- 优点：可以把很多步骤合并、重排、自动优化
- 缺点：输入形状是动态的话处理复杂，初次编译有开销

PyTorch 2.0 中的 `torch.compile` 的步骤：
1. TorchDynamo：把普通 Python 代码转换成 computational graph (FX Graph / IR)
2. TorchInductor：优化和生成 kernel（fusion, tiling, scheduling, autotuning）
3. Guard 机制：检查输入 shape 有没有变化，在需要的时候重新 compile

#### Graph 优化

核心思想：少写 HBM，少 launch kernel，多 overlap

**算子融合（Operator Fusion）**
- 多个相邻算子合并为单个 GPU kernel，消除中间的显存 round-trip
- FlashAttention 的核心就是融合

**调度重排（Schedule Reordering）**
- 确保 data dependency 正确的同时重排算子执行顺序
- 少占显存，独立算子并行，compute-communication overlap

**图识别与替换（Pattern Recognition & Replacement）**
- 识别特定 pattern，替换成更高效的实现
- 比如 `Q×K^T → Scale → Mask → Softmax → Dropout → ×V` 六个独立算子可以被替换为一个融合的 FlashAttention 算子
- 这是 torch.compile、XLA、ONNX Runtime 等框架的重要优化手段

#### ML 并行策略

- **Data Parallelism（DP）**
	- 切 batch，每张 GPU 放完整模型。
	- 通信：AllReduce 同步梯度。
	- 适合：模型能装进单 GPU。
- **Pipeline Parallelism（PP）**
	- 切模型层，每张 GPU 放一部分层。
	- 通信：层间 activation 传递。
	- 适合：模型太深、单 GPU 放不下。
- **Tensor Parallelism（TP）**
	- 切单层矩阵，每张 GPU 算部分矩阵。
	- 通信：层内 AllReduce。
	- 适合：单层太大或追求更高吞吐。
- **Expert Parallelism（EP）**
	- 切 MoE expert，不同 GPU 放不同 expert。
	- 通信：AlltoAll 分发 token。
	- 适合：MoE 模型。
- **Sequence Parallelism（SP）**
	- 切 sequence length，不同 GPU 处理不同 token 段。
	- 通信：AllGather + ReduceScatter。
	- 适合：超长上下文/KV Cache 很大时。

---

### Loop 优化

20% 的热点代码（通常是循环）消耗 80% 的执行时间。在 ML 中，会有大量的 array/matrix/tensor，几乎所有算子都可以展开为多层嵌套循环。

两个优化方向：
- Front-end 优化：最大化利用 CPU/GPU 流水线和核心
- Back-end 优化：减少执行的实际开销，降低执行实际运行时间

#### 具体优化方法

- 单循环优化：
	- **Loop Unrolling**：直接展开所有循环
		- 优点：减少循环控制的开销，增加 ILP（instruction-level parallelism），更容易 SIMD 向量化
		- 缺点：代码体积变大，寄存器占用变多
	- **Loop Splitting / Peeling**：把麻烦的边界条件拆出去
		- 优点：主循环更容易向量化，更好对齐
		- 缺点：代码会复杂一点
	- **Loop Vectorization**：用一条 SIMD 指令算多条数据（前提是 iteration 之间没有数据依赖）
		- 优点：大幅提高吞吐
		- 缺点：有数据依赖时无法使用，对 memory layout 敏感
	- **Loop Parallelization**：不同 iteration 分给不同 threads
		- 优点：workload 不均匀的情况下容易负载均衡
		- 缺点：访存不连续，cache locality 不好
	- **Software Pipelining**：重排指令，使得不同 iteration 重叠执行
		- 优点：隐藏延迟，能够填满流水线
		- 缺点：调度复杂，寄存器压力大
- 多循环优化：
	- **Loop Interchange**：交换嵌套循环顺序，改变访存顺序
		- 优点：提高 cache locality，让访问更连续，增加 data reuse
		- 缺点：不能破坏数据依赖
	- **Loop Blocking / Tiling**：把大循环切成 cache / SRAM 能放得下的小块
		- 优点：减少 cache miss，提高数据复用和算术强度，是最重要的循环优化之一
		- 缺点：Tile size 不好选，太小利用率低，大的会撑爆 cache / register
	- **Loop Fusion**：合并多个循环，避免中间结果写回 memory
		- 优点：减少 memory traffic，HBM / global memory 读写，增加 locality
		- 缺点：kernel 更复杂，寄存器压力大，降低 occupancy
	- **Loop Unroll-and-Jam**：先 unroll 外层循环，再和内层循环融合
		- 优点：增加向量化机会，提高 data reuse
		- 缺点：代码体积增加，寄存器压力增加
	- **Loop Skewing**：改变 iteration space 几何形状，让有依赖的循环也能执行
		- 优点：让 wavefront / stencil / DP 类问题也能并行化
		- 缺点：实现和调度复杂，可读性差

#### Autotuning

GPU kernel optimization 没有理论最优，因为不同 GPU/kernel/shape/硬件等各种因素都会影响最优值，它们没有简单公式，很难手算。Autotuning 就是自动尝试 kernel 的各种参数配置，搜索到最优的那个。

它的难点是：参数空间巨大，而且参数和 runtime 的关系不平滑、不直观。

> 最近我在 Pai 的 research group 中了解到 Jingyu Qiu 最近在做的工作。他的核心 hypothesis 是 static instruction count space 是否比 raw config space 更能解释和指导 autotuning，然后想办法用 static instruction map 替代 raw config，作为更接近性能的搜索空间，给 autotuning 提供更可解释、更 sample-efficient 的性能坐标。我正在积极跟进这个项目，并尝试为这个项目做贡献。

---

### 宏观调度

**专用加速器**：最简单的硬件设计，为每种算子类型建一个专用功能 unit，然后串行执行。

但这样大部分硬件资源会被浪费，所以需要 pipeline parallelism 让不同单元并行工作提高吞吐，但需要更多缓冲区、计算单元副本，且效率受限于最慢的单元。

**增加并行度（pipeline / data parallel）**：增加内存或增加计算。

**动态调度**：比如 PyTorch 的实现就是 `算子队列 → worker 抢任务 → 执行 kernel`
- 优点：灵活，可以支持动态 shape、if/loop、动态控制流
- 缺点：无法提前知道后面会发生什么，有调度开销

**静态调度**：如果输入输出大小固定，那就能提前生成调度方案
- 优点：可预测，好优化

---

### Kernel 优化

**Little's Law**：$n = R \times t$
- $n$：同时 in-flight 的操作数
- $R$：吞吐率（硬件每周期能接受/完成的操作数）
- $t$：每次操作的延迟（周期）

这个公式的意义是：要让硬件跑满（R 达到峰值），必须在任意时刻维持至少 n 个 in-flight 操作。由于 GPU 通过并发隐藏延迟，所以要足够的并发来最大化硬件利用率。

---

### Roofline 模型

#### 算术强度（Arithmetic Intensity）

$$I = \frac{\text{FLOPs}}{\text{Bytes}}$$

每从内存读入 1 字节数据所对应的浮点运算次数。

**注意**：这里的"Bytes"是内存流量（Memory Traffic），不是数据大小，需要考虑数据复用（数据从 HBM 载入 Cache 只算一次，后续对该数据的访问不算）。

**常见算子的算术强度（参考值）：**

| 算子                | 典型 $I$              | 瓶颈类型          |
| ----------------- | ------------------- | ------------- |
| 向量加法 $y = a + b$  | 0.5 FLOP/Byte（FP32） | Memory-Bound  |
| ReLU              | 0.25 FLOP/Byte      | Memory-Bound  |
| Softmax           | ~1 FLOP/Byte        | Memory-Bound  |
| LayerNorm         | ~2 FLOP/Byte        | Memory-Bound  |
| 小矩阵乘法（M=N=K=64）   | ~32 FLOP/Byte       | Memory-Bound  |
| 大矩阵乘法（M=N=K=1024） | ~512 FLOP/Byte      | Compute-Bound |
| 注意力（序列长度 512）     | ~50 FLOP/Byte       | Compute-Bound |

#### Roofline 公式

$$P = \min\left(T_{peak},\ \beta \times I\right) \text{ FLOP/s}$$

其中：

- $T_{peak}$：处理器的**峰值计算吞吐**（TFLOP/s）
- $\beta$：处理器的**内存带宽**（GB/s 或 TB/s）
- $I$：程序的**算术强度**（FLOP/Byte）
- $P$：程序可达到的**性能上界**（TFLOP/s）

---

### 内存与存储

#### 分配方式

**静态分配**：程序启动时分配内存，常用于编译时确定大小的东西。

**动态分配**：运行时按需分配。
- 动态分配时，可能会因为高频率分配/释放、内存不足、内存碎片化造成性能瓶颈（因为 `cudaMalloc` 很慢）
- 解决方法：
	- 内存规划（执行前分析，让不同生命周期的张量共用同一块内存）
	- 内存池（分配的内存缓存在池中供下次使用，减少分配开销）

#### 内存空间

- **Global Memory**：很大，很慢，HBM。主要数据最开始都在这里
- **Shared Memory**：片内 SRAM，Block 内线程共享，把需要反复读取的数据先搬到这里，同一块数据只碰一次 HBM
- **Register**：最快最小
- **Constant Memory**：只读数据，所有线程读同一地址时只访问一次 HBM 然后广播给所有线程
- **Local Memory**：就是 HBM，但是逻辑上是每个线程私有的，寄存器放不下的东西溢出到这里，出现了说明寄存器压力大，需要优化

#### 内存使用

- **Weights**：模型本身。训练时更新，推理时只读，所有输入共用同一份，内存占用固定
- **Activations**：前向传播中每一层的输出，反向传播时用来计算梯度，可以选择不存到时候重新算
	- 训练时 activation 必须留着给反向传播用，但是层数一多内存就线性增长。优化方向是给 checkpointing，只保存关键层，其他的可以重算。节省约 $\sqrt{n}$ 倍内存（$n$ 为层数），但前向传播需要运行约 1.33× 时间
- **Gradients**：反向传播算出来的，和 Weights 大小相同，更新完后就不用了
- **Optimizer State**：维护一阶矩 m 和二阶矩 v，且是 2 倍模型大小，训练过程全程保存
	- m：梯度的指数移动平均，"最近梯度的方向趋势"
	- v：梯度平方的指数移动平均，"最近梯度的波动幅度"
	- 每次更新参数时，Adam 用这两个值来调整学习率，波动大的参数更新步子小，波动小的步子大

**内存估算公式**：$M_{total} = \underbrace{P \times 4}_{\text{Weights}} + \underbrace{P \times 4}_{\text{Gradients}} + \underbrace{2P \times 4}_{\text{Adam: }m,v} + M_{act}$

FP32 Adam 训练时，每个参数占 16 字节 = Weights 4 字节 + Gradients 4 字节 + m 和 v 各 4 字节

#### 内存优化技术

- **量化（Quantization）**
	- 将模型参数从高精度浮点转为低精度整数，减少内存占用
	- 分为权重量化（主要节省内存带宽而非计算）和权重 + 激活量化（同时节省内存和计算）
- **权重稀疏化（Sparsification）**
	- 将权重中接近零的参数看作零，跳过计算，只存非零值和它们的坐标
	- 分为非结构化稀疏（稀疏位置随机，但内存不连续，难向量化）和半结构化稀疏（比如 2:4 稀疏，访存更高效）
- **压缩（Compression）**
	- 无损压缩：传输量减小，但需要花时间解压
	- 有损压缩：就是量化

#### 权重文件的加载

权重文件巨大，加载进 GPU 是一大难题。传统 PyTorch Pickle 文件会把整个文件完整读入 CPU RAM 再复制到 GPU，极其缓慢。更优化的方法是 `mmap` 方式，让 OS 把文件映射成虚拟内存地址，仅加载当前需要的层。Safetensors（Hugging Face 开发）是目前推荐的现代权重格式，设计上原生支持这个方式。

---

### 通信

单机内通信：
- **Load/Store**：CPU 直接访问数据。灵活，但占 CPU 资源，适合小数据
- **Non-temporal Load/Store**：提示 CPU 不要缓存这些数据，适合大块只写一次的数据
- **DMA（Direct Memory Access）**：专用硬件，CPU 启动后就可以执行别的

**Pinned Memory** 是不会因 RAM 不够用被 OS 被 swap 出去的内存，DMA 能安全使用其物理地址，但它相当于永久占用物理内存，所以不能滥用。

**GPUDirect 技术**：让 GPU 绕过 CPU 内存直接和外部设备通信
- GPUDirect RDMA：直接和网卡通信，用于多机传输
- GPUDirect P2P：同机器多卡之间直接通过 NVLink 互传，不经过 CPU 内存

#### 网络拓扑

- **Bisection Bandwidth**：衡量网络的核心指标，把网络里所有节点切成两半，数一数跨越这条切割线的所有链路的带宽总和。这个数越大说明网络越不容易在大规模通信时拥塞。
- **Ring**：每个节点只连左右邻居，结构简单，AllReduce 时带宽效率最优，节点多了延迟高，bisection bandwidth 低
- **Tree**：有层次，传播快，但瓶颈是根节点因为带宽压力集中在那里
- **Fat-Tree**：数据中心主流方案，上层交换机端口多，无带宽瓶颈，但结构复杂、成本高，bisection bandwidth 高
- **2D/3D Torus**：每个节点连 2/3 个维度（同行/同列/同层）的邻居，bisection bandwidth 高
- **Fully Connected**：每对节点都相连，成本高。单机 NVLink（Nvidia 为 GPU 通信专门设计的高速互联，绕过 PCIe 直接 GPU 对 GPU 传数据）就是接近全连接，带宽是 PCIe（CPU 到 GPU 的数据总线）的 10 倍

#### 通信协议栈

- **物理层**
	- 把比特转换成物理信号（电压、光脉冲、无线电波）传输
	- 只管"怎么传信号"，不管信号是什么意思
	- 介质：铜缆（双绞线、同轴）、光纤、无线
	- 机器之间用光纤还是铜缆连，决定了物理带宽上限。大规模集群基本都是光纤
- **数据链路层**
	- 负责同一个局域网内两台机器之间的通信
	- 用 MAC 地址寻址（硬件地址，烧在网卡里）
	- 把数据打包成帧（Frame），加上源/目的 MAC 地址
	- 以太网（Ethernet）是最常见实现，便宜但性能差一点；InfiniBand 延迟更低、带宽更高，是 HPC 和 AI 集群的主流选择
- **网络层**
	- 负责跨网络的路由，把数据从任意源头送到任意目的地
	- 用 IP 地址寻址
	- 路由器在这一层工作，决定数据包走哪条路径
	- 不保证可靠性，只管"尽力送到"
	- InfiniBand 有自己的寻址方式（LID），不用 IP，延迟更低。RoCE 是在以太网上模拟 RDMA，还是用 IP 寻址
- **传输层**
	- 负责端到端的通信，在两个进程之间建立连接
	- TCP：可靠，有握手、确认、重传，但开销大。要经过内核，CPU 负责拷贝，梯度同步时延迟高、CPU 占用大
	- UDP：不可靠，没有确认机制，但延迟低
	- RDMA Verbs：绕过内核，网卡直接读写 GPU 内存，CPU 几乎不介入，这是大规模训练能跑起来的基础
- **应用层**
	- 具体应用的协议，定义数据格式和交互方式
	- HTTP/gRPC：网页和服务间调用
	- MPI：传统 HPC 的消息传递
	- NCCL：NVIDIA 的 GPU 集体通信库（AllReduce 等），直接调用底层网卡接口绕过中间层

#### 集群通信

集体通信（Collective Communication，CC）是所有参与设备共同执行的多步数据传输+计算。

**AllReduce**：每块 GPU 各自算梯度，把所有卡的梯度加起来取平均，最后每块卡都拿到这个结果去更新参数的操作

朴素实现：

```python
# 每个 GPU 发送数据给 GPU 0，GPU 0 求和后广播
# 通信量：O(P × |g|)，GPU 0 是瓶颈
for m in other_devices:
    send(m, my_gradient)
result = my_gradient
for m in other_devices:
    result += recv(m)
broadcast(result)
```

**Ring AllReduce（带宽最优）**：把每块卡的梯度切成 P 段，排成一个环。是目前 NCCL 和 PyTorch DDP 使用的标准算法

1. **Reduce-Scatter**：每块卡只负责自己那一段的汇总。沿着环传 P-1 轮，每轮把自己收到的数据累加再传给下一块卡。结束后每块卡拥有某一段梯度的全局总和。

	```
	每个 GPU 的数据分成 P 段：[S0|S1|S2|S3]（P=4 为例）
	
	轮次 1：GPU_i 向 GPU_{i+1} 发送 S_i 的副本，同时接收 S_{i-1} 并累加
	轮次 2：GPU_i 向 GPU_{i+1} 发送累加后的 S_{i-1}，同时接收并累加 S_{i-2}
	轮次 3：类似…
	
	经过 P-1 轮后，GPU_i 有 S_i 的全局 sum
	```

2. **AllGather**：每块卡把自己已经汇总好的那段广播出去，再传 P-1 轮。结束后每块卡都有完整的全局梯度。

	```
	每个 GPU 将自己的 S_i（已是全局 sum）发给下一个 GPU
	经过 P-1 轮后，每个 GPU 都有完整的 [S0+S1+S2+S3]
	```

每块卡发送和接收的数据量约等于 2|g|，和卡数 P 无关。这就是带宽效率最优的原因：加再多卡，每块卡的通信量不增加。

#### 其他 Collective Communication 算法

| 算法                | 语义                | 通信方向            | 场景                   |
| ----------------- | ----------------- | --------------- | -------------------- |
| **Broadcast**     | Root 发送数据给所有节点    | 1 → N           | 参数服务器广播模型权重          |
| **Reduce**        | 所有节点的数据聚合到 Root   | N → 1           | （较少用，被 AllReduce 替代） |
| **AllReduce**     | 所有节点聚合，结果广播给所有人   | N → N           | **梯度同步**（DDP）        |
| **Gather**        | 所有节点的数据发给 Root    | N → 1           | 收集推理结果               |
| **AllGather**     | 所有节点的数据广播给所有人     | N → N           | **FSDP 的参数重建**       |
| **Scatter**       | Root 将数据分发给各节点    | 1 → N           | 分发 Batch 数据          |
| **ReduceScatter** | AllReduce 的前半段    | N → N（每人只保留一部分） | **FSDP 的梯度 Shard**   |
| **AlltoAll**      | 每个节点发送不同数据给每个其他节点 | N → N（全对全）      | **MoE 的 Expert 路由**  |
| **Barrier**       | 同步点，所有节点等待彼此到达    | —               | 迭代间同步                |

#### 通信库的现状

| 库         | 维护方          | 特点                                        |
| --------- | ------------ | ----------------------------------------- |
| **NCCL**  | NVIDIA       | GPU 间通信的事实标准；针对 NVLink 和 InfiniBand 优化    |
| **RCCL**  | AMD          | 基于 NCCL 的 AMD ROCm 版本                    |
| **MSCCL** | Microsoft    | 允许自定义通信算法（如 Synthesis-based 算法）           |
| **MPI**   | 学术/HPC 生态   | 传统 HPC 标准，对 GPU 支持较弱                     |

**40% 的训练成本是通信成本**。这是 ML 系统领域的重要数据点，也是通信优化研究持续活跃的原因。

#### 不同并行策略对应的通信类型

| 并行策略                     | 通信发生时机                                         | 使用的 CC 算法                 | 通信量                                 |
| ------------------------ | ---------------------------------------------- | ------------------------- | ----------------------------------- |
| **Data Parallel（DDP）**   | 每步反向传播后梯度同步                                    | AllReduce                 | $O(\text{参数量})$ / 步                 |
| **Pipeline Parallel**    | 每层激活值前向传递 / 梯度后向传递                             | P2P Send/Recv             | $O(\text{层输出大小})$ / 微批              |
| **Tensor Parallel**      | 矩阵分块后合并结果                                      | AllReduce（层内）             | $O(\text{激活大小})$ / 层                |
| **FSDP（ZeRO-3）**         | 每层前向时 AllGather 参数；Backward 时 ReduceScatter 梯度 | AllGather + ReduceScatter | $O(\text{参数量})$ / 步（与 DDP 相同但分散到每层） |
| **Expert Parallel（MoE）** | Token 路由到 Expert + 结果收集                        | AlltoAll                  | $O(\text{batch 大小})$ / MoE 层        |

#### 通信优化

- **梯度压缩（Gradient Compression）**：在 AllReduce 之前把梯度压小，比如用低秩近似。通信量大幅下降，但会有误差，通常用误差反馈机制补偿
- **使用过期数据（Stale Synchronous Parallelism）**：不等所有 GPU 完成计算就开始下一步，允许使用略微过时的梯度
	- **DistriFusion**（扩散模型分布式推理）：这个思路在扩散模型上的应用。在不同 GPU 上并行去噪步骤，使用上一步的激活值近似替代当前步（步间激活值变化小），几乎不损精度但实现推理并行化
	- **Hogwild!**（异步 SGD）
- **Compute-Communication Overlap**：典型例子为 PyTorch DDP 的 **Bucketed Gradient AllReduce**：不等所有层的梯度算完再统一 AllReduce，而是按 Bucket 分组，某个 Bucket 的梯度算完就立刻开始 AllReduce，和后续层的反向传播并发执行

---

### 训练

#### 训练流程

1. 初始化（随机权重，不能全 0）
2. 前向传播
	1. 输入数据逐层经过线性变换和激活函数
	2. 输出预测值 $\hat{y}$，保存所有中间激活值
	3. 计算 $\mathrm{Loss} = \mathrm{loss}(\hat{y}, y)$
3. 反向传播
	1. 从 Loss 出发，用链式法则逐层往前算每个参数的梯度 $\frac{\partial L}{\partial W}$
	2. 用梯度更新参数：$W \leftarrow W - \eta \cdot \frac{\partial L}{\partial W}$
4. 检查收敛
5. 重复

#### 微分方式

- **数值微分**：直接用定义近似。简单但有误差，而且每个参数都要跑一次前向，参数多了不可行
- **符号微分**：代数推导。精确但表达式会爆炸性增长
- **自动微分**：沿计算图应用链式法则。复杂、精确、高效，现代 ML 框架（PyTorch、JAX、TensorFlow）全部使用自动微分
	- **前向模式 AD**：每次前向传播只能算对一个输入变量的梯度。神经网络有几百亿参数，就要跑几百亿次
	- **反向模式 AD**：先跑一次完整的前向传播，把所有中间值记在 Tape 上，然后从 Loss 往回走一遍，一次就得到对所有参数的梯度
		- 主要内存开销：存储所有前向传播中间值，每一层的局部梯度都要用到。
		- 优化策略：Gradient Checkpointing

#### 梯度下降与并行化

- **全量梯度下降（Batch Gradient Descent）**：用整个数据集算梯度均值，最准，但一步要看完所有数据，太慢
- **随机梯度下降（SGD）**：每步只用一个随机样本 i 的梯度更新，快但梯度噪声很大，更新方向不稳定
	- **Mini-batch SGD**：实际使用的。折中，用一小批数据，梯度质量够用，而且一个 batch 内的样本可以在 GPU 上并行计算
- **Adam 等优化器**：给每个参数维护一阶矩和二阶矩并自动调整有效学习率，而非同一个学习率。代价是 2x 优化器状态存储
- **Hogwild!**：多个 worker 并行算梯度，但更新共享参数时可能有冲突，需要锁。稀疏梯度冲突概率低，适合用，但稠密梯度如 Transformer 锁竞争性能开销大

#### 分布式训练的存储与调度挑战

模型规模从 2012 年的两块消费级 GPU 到 2024 的数千块 H100，数量级增长极快。存储和调度成为了独立的工程问题。

- **Meta 的 Tectonic-Shift**：大规模 ML 存储
	- 问题：数百 TB 的训练数据，光是 checkpoint 存储需求就极大
	- 解决：
		- 数据集要反复读很多遍（多个 Epoch），访问模式是顺序的，所以使用预读和缓存效果优化
		- Checkpoint 是突发性的大量写入，几千块 GPU 同时把状态写进去，用写入缓冲和聚合来吸收峰值
		- 数据大小差异很大，用 SSD 缓存热数据、HDD 存冷数据来分层处理
- **Meta 的 MAST**：全球 ML 训练调度
	- 问题：地理分布数据中心调度 ML 训练作业，需要考虑不同数据中心的 GPU 可用性（故障和维护情况），网络带宽，高优先级作业抢占资源，局部 checkpoint 恢复等
	- 解决：全局调度器维护所有数据中心资源状态，在作业提交时选择最优的数据中心组合，并在运行中动态迁移或重新调度以最大化 Goodput（有效吞吐，有效完成的训练步数/时钟时间，故障恢复、通信阻塞、被抢占的时间都不算）

#### 并行化方法

- **Data Parallelism**：每块 GPU 存完整模型，并行处理一部分数据，各自算完梯度后同步。简单但模型大就放不下
	- PyTorch DistributedDataParallel（DDP）的优化：
		- 参数按 bucket 分组，每个 bucket 梯度算完后立即开始 AllReduce
		- 可选 AllReduce 前压缩梯度
- **Pipeline Parallelism**：把模型按层切分，每块卡负责几层，前向传播时激活值从前面的卡传给后面的卡，反向传播时梯度反向传回来
	- 朴素实现的问题：一张卡前向传播结束后到反向传播前都是空闲的
	- GPipe 的解决方案：将 Batch 分成 M 个 micro-batch，流水线处理，一张卡前向传播后立刻开始处理第二个 micro-batch。M 越大 bubble 越小，但需要内存来缓存中间激活
- **Tensor Parallelism**：把单个矩阵乘法拆到多卡上并行计算。
	- Megatron-LM：第一个矩阵按列切分，每块卡算部分输出，无需通信，第二个矩阵按行切分，每块卡算出局部结果，最后 AllReduce 合并。整个 MLP 层只需要一次 AllReduce，通信开销很小。代价是每层结束都要通信一次，所以一般都是单机用
- **ZeRO（Zero Redundancy Optimizer）**：不在每个 GPU 上存完整模型
	- ZeRO-1：优化器状态分片，节省约 4 倍内存
	- ZeRO-2：优化器状态和梯度分片，节省约 8 倍内存
	- ZeRO-3：优化器状态、梯度和参数分片，节省约 GPU 数量倍的内存
		- 原理：每个 GPU 存 1 / P 的参数、梯度和优化器状态需要某一层参数时，用 AllGather 把完整参数临时凑起来，算完前向后立即丢弃。反向传播也是一样的，但是反向传播完并不立刻丢弃，而是使用 ReduceScatter 把梯度分回去，每张卡自己更新局部参数。代价是通信量约为 ZeRO-1 和 2 的 1.5 倍
		- **PyTorch FSDP（Fully Sharded Data Parallel）**：ZeRO-3 在 PyTorch 中的官方实现。模型能放进单卡用 DDP，放不进去用 FSDP
			- CPU Offload（FSDP/ZeRO 的可选扩展）：把不活跃的参数和优化器状态卸载到 CPU 内存甚至 SSD，GPU 只保留当前在算的那部分。代价是 CPU↔GPU 传输延迟，但允许训练比 GPU 内存大得多的模型
- **3D Parallelism**：同时用 DP, PP, TP。
	- 假设有 64 块 GPU，就 8 TP × 4 PP × 2 DP
	- TP 组内：AllReduce（延迟敏感，需要高带宽 NVLink）
	- PP 组间：P2P（激活值传递，中等带宽）
	- DP 组间：AllReduce（延迟不敏感，可接受 InfiniBand 延迟）

所有 ML 并行策略都可以分解为这些操作（作用于算子/层/数据）：
- **Partitioning（分片/分割）**：将数据/算子切分到不同设备
	- 比如 ZeRO 参数分片 / Pipeline 层切割
- **Replication（复制）**：在不同设备上保留完整副本
	- 比如 DDP 的模型副本，参数服务器等
- **Loading/Unloading**：根据 Liveness 动态装载所需数据
	- 比如 FSDP 的 AllGather/ReduceScatter

#### 性能诊断要点

- **通信量**：通信是否将 Compute-Bound 变成 I/O Bound？
- **计算强度**：算数强度是否低于脊点
- **时间线分析**（`nsight systems` / `torch.profiler`）：
	- GPU 空闲时间
	- 过度同步
	- 通信与计算是否重叠

#### 容错

单个组件的可靠性决定了整个训练任务的 MTTF（Mean Time to Failure，平均故障间隔时间）。10000 块 GPU、每块 MTTF 100 天，整个集群就平均每 14 分钟故障一次。容错是必须的。

故障类型：
- 硬件故障：GPU 内存错误/电源故障/NVLink 故障等
- 软件故障：CUDA kernel 崩溃/死锁等
- 基础设施故障：数据中心断电等

容错机制：
- Checkpoint
- Goodput 最大化：checkpoint 太频繁 I/O 开销大，太稀疏可能故障后丢进度
- Singularity 的 elastic training：训练任务运行时动态增减 GPU，无需重启
	- 新 GPU 加入：从 checkpoint 恢复，加入 AllReduce 环
	- GPU 故障退出：剩余 GPU 重新组织，继续从最近 checkpoint 训练

---

### 微调

预训练一次成本极高，出来一个通用模型。微调是在这个基础上用相对少量的数据继续训练，调整模型行为的一种 post training 技术，成本低得多。

**成本差距**：

| 阶段      | GPT-3 规模的成本估计                         | GPT-5 规模的成本估计                    |
| ------- | ------------------------------------- | -------------------------------- |
| 预训练     | ~\$4–12M（一次性）                         | ~$500M / run                     |
| 全量微调    | ~\$600（以 Alpaca 7B 为参考）               | 不现实/不适用（参数量极大，需专用集群）             |
| LoRA 微调 | ~\$50（以 Alpaca 7B-LoRA 为参考），单 GPU 数小时 | ~$1,000–$3,500+（云端，针对可访问的等效规模模型） |

#### Adapter

在 Transformer 每层内插入一个小模块，把维度压缩到远小于 d 的 r，过一个激活函数，再升回 d，加上残差，冻结原始权重，只训练这个小模块。

优点是参数量小（$2rd$ 而非 $d^2$）。缺点是推理时每层都要多走一遍 Adapter，增加延迟，没法消除。

#### Prefix Tuning

不修改 Transformer 内部结构，而是在每层的 k/v 序列前拼一段可训练的前缀参数，模型训练的时候同时看到这个前缀，前缀的内容通过梯度下降优化出来。

和 prompt engineering 不同的是 prompt 是离散的词汇表中的词，但 prefix 可以是连续的任意实数向量，表达能力更强。

#### LoRA

由于微调时权重的变化量 $\Delta W$ 是低秩的，所以可以用两个小矩阵 A 和 B 的乘积来近似。原始权重 $W_{0}$ 冻结，只训练 A 和 B。B 初始化为全零，保证训练开始时模型行为不变。

关键优势是推理时可以把 BA 直接加回 W₀，合并成一个矩阵，推理完全没有额外开销。这是 LoRA 成为目前主流的核心原因。

参数量极小：GPT-3 全量微调要训练 175B 参数，LoRA r=4 只需训练约 35M 参数，不到 0.02%。

**QLoRA**：在 LoRA 基础上把冻结的 $W_{0}$ 用 INT4 量化存储，显存需求进一步大幅下降。65B 模型可以在单张 48GB 显卡上微调，让大模型微调在消费级硬件上成为可能。

#### PEFT（Parameter-Efficient Fine-Tuning）方法对比

| 方法                                   | 可训练参数量          | 推理开销             | 多任务切换               | 适用场景           |
| ------------------------------------ | --------------- | ---------------- | ------------------- | -------------- |
| **全量微调**                             | 100%（$P$ 个参数）   | 无额外              | 每任务独立模型             | 有大量计算资源，追求最高性能 |
| **Adapter**                          | ~30%（BERT base） | 有（额外层）           | 仅换 Adapter 权重       | 推理延迟不敏感        |
| **Prefix Tuning**                    | ~0.1%           | 很小（额外 $k$ token） | 仅换前缀                | 生成任务，任务数多      |
| **LoRA**                             | <0.1%           | **无**（可合并）       | 合并前可换 $A,B$；合并后无法切换 | 几乎所有场景，是目前实践主流 |
| **ReFT（Representation Fine-Tuning）** | 视配置             | 有（额外操作）          | 是                   | 新方向，研究性        |

---

### MoE

根据 Scaling Law，模型越大越好，但稠密模型越大，计算成本也暴涨。MoE 是想要模型参数量很大，但只激活一小部分的模型，大幅缩减实际计算量。

数学定义是：

$$y = \sum_{i=1}^{n} G(x)_i \cdot E_i(x)$$

其中：

- $E_i(x)$：第 $i$ 个 **Expert**（一个小型 FFN 网络）
- $G(x)_i$：**Gate 网络**（路由网络）对第 $i$ 个 Expert 的权重
	- 如果 Gate 给某个 Expert 的权重为 0，那这个 Expert 就完全不用算
	- **Sparsely-Gated MoE 中的 G**：$G(x) = \text{Softmax}(\text{Top-K}(x \cdot W_g + \text{noise}))$
		- $x \cdot W_{g}$ 是用 token 算出每个 Expert 的得分
		- Top K 是只保留得分最高的 K 个，其余置零
		- noise 是噪声，帮助探索不同的 Expert 而不是一直固定
- $n$：Expert 总数（通常 8–64 个，极端情况如 DeepSeekMoE 有 256 个）

#### MoE 训练时的系统问题

**Shrinking Batch Problem**：Expert 越多，每个 Expert 分到的 token 越少。如果 batch 很小，单个 Expert 效率低，算术强度低，就是 Memory-Bound。

- 解决办法是 Expert Parallelism + 批次路由。把 Expert 分到多个设备上，每个设备放一个 Expert，然后多个数据并行设备的 batch 就可以汇聚到一起给 Expert，有效 batch 就变大了。代价是 AlltoAll 通信代价。

MoE 的 Expert 分散在不同设备上，Token 就需要通过网络发送到对应 Expert，算完再发回来，这是额外的通信开销，稠密模型中没有。

- 由于通信量和 Expert 隐藏层维度成正比，所以一个解决办法是减少 Expert 中间层大小来减少通信

训练时可能导致 Gate 网络偏爱的某几个 Expert 越来越热门，会导致热门 Expert 负载高延迟高，冷门 Expert 负载低利用率低。

- 解决方案：在训练中引入一个 auxiliary load balancing loss，惩罚负载不均的情况

#### GShard 与 DeepSeekMoE

**GShard** 将 MoE 应用到了 Transformer 上，实现了 6000 亿参数模型每 token 激活约十分之一参数。一些关键机制为：
- 用户标注哪些层是 MoE，编译器自动生成分片和通信代码
- 每个设备只存 $\frac{1}{n}$ 的 Expert，增加 Expert 数量不怎么增加单个设备内存负担
- 一个 Expert 收到的 token 超过其容量时，随机路由到其他 Expert。略微降低精度，但提高负载均衡
- 给每个 Expert 设一个容量上限，超过的直接跳过 Expert 走残差连接（Overflow）

**DeepSeekMoE** 改进了普通 MoE 中学到的知识过于通用的问题。
- **Fine-grained Expert Segmentation**：如果 Expert 少，每个 Expert 为了覆盖足够多的 token，都会变得通用，造成知识冗余。解决办法是将每个 Expert 的 FFN 中间维度缩小 m 倍，增加 m 倍 Expert 数量，激活 m 倍的 Expert。这样每个 Expert 接受更少的 token，计算量相同，但 Expert 更专精。
- **Shared Experts**：每个 Expert 为了处理通用知识消耗容量，造成学习效率低。解决办法是设置几个 shared experts，对所有 token 都激活，专门处理通用知识。其他 Experts 的激活数量就随之减少。类似 Residual MoE。DeepSeek-V3 一个 MoE 层的 256 个路由 Expert + 1 shared expert 能做到 671B 总参数的情况下每个 token 只激活约二十分之一的参数。

#### MoE 推理优化

稠密模型每层的权重对所有 token 相同，所以一个 batch 的 token 都可以堆在一起一次算。MoE 每个 token 路由到不同 expert，token 分散，无法堆在一起算。而且 LLM 推理就是小 batch 场景，极端 memory-bound，MoE 再把 token 路由到分散的 Expert，每个 Expert 算的东西更少，更 memory-bound，效率更低。

优化方式：
- **Expert Parallelism + Critical Path Routing**：把路由路径相同的 token 放在同一个设备上一起批处理，同时用 expert parallelism 增加有效 batch 大小，Non-Expert 层如 Attention 用 Tensor Slicing 并行
- **Hierarchical AlltoAll**：传统 AlltoAll 是 P 个设备两两通信，延迟高。小 batch 情况下，数据量小，瓶颈是延迟而非带宽，通信太多了就慢。Hierarchical AlltoAll 是先在每台设备内用延迟极低的 NVLink 做 AlltoAll，汇总好数据后跨机器的 AlltoAll 用高延迟的 InfiniBand 传一次，减少跨机器通信次数，总延迟大幅下降
- **Fused MoE Kernels**：Gate 计算步骤很多，用独立 kernel 会有大量 global memory 读写。融合后就省了反复读写显存的开销
