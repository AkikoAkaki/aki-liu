---
title: "MLSys 笔记 Part I：硬件、内存、并行与数据布局"
date: 2026-05-18
tags: ["mlsys"]
math: true
draft: false
---

<aside>

**TL;DR**

Part I 学的是硬件底层：算力在哪里，内存慢在哪里，并行怎么发生，数据 pattern 怎么影响性能

- ML 性能 = 算力 × 内存 × 并行 × 数据布局
- CPU：流水线，乱序执行，分支预测，cache，少量强核心，低延迟，擅长复杂控制流
- GPU：海量线程，SIMD/SIMT，Warp，高带宽，隐藏延迟，高吞吐，擅长大量规则计算
- 硬件算力需要靠 SIMD 吃满
- 内存层级：Register → L1 → L2 → L3 → DRAM → SSD，ML 优化的 tiling 本质是把数据搬进快内存后尽可能 reuse
- Kernel 慢的两种原因：compute-bound, memory-bound
- 低精度能省显存和带宽，但会带来解码成本和数值风险
- 连续访问快，随机访问慢，规则访问容易向量化，不规则访问难以吃满硬件

</aside>

### MLSys 定义和特点

**定义**：任何能运行 ML 程序的 system，可以是运行 training/fine-tuning/inference 任意一个
- Shared Memory System：通常指单台机器，如配有多 GPU 的服务器
- Distributed Memory Systems：多台机器通过网络连接，读取对方内存需要数据传输，如 GPU 集群/数据中心
- 内存拓扑决定通信成本，通信成本决定训练和推理能不能高效扩展

**特点**：
- 大量 Compute
- 大量 Memory
- 大量 Communication

**Training**：输入数据 → 前向传播 → 计算损失 → 反向传播 → 更新权重
- 计算量最大
- 数据量最大
- 时间最长
- 成本最高
- 通常需要大量 GPU/TPU

**Fine-tuning**：预训练模型 → 特定任务数据 → 少量再训练 → 专用模型
- 成本低于完整训练
- 数据量更少
- 时间更短
- 通常针对一个具体任务做一次

**Inference**：用户输入 → 前向传播 → 输出结果
- 每次用户请求都会发生
- 单次计算量比训练小很多
- 不做反向传播
- 不更新模型参数
- 但总量可能非常大，因为用户请求很多

---

### 效率

#### 时间模型

$$T = \frac{W \times t}{P}$$

其中：

- $W$：工作量（Work，例如 FLOP 数）
- $t$：单位工作的平均时间
- $P$：并行度（Parallelism）

#### 能耗模型

$$E = \sum_{w \in W} E_w$$

其中 $E_w$ 是执行工作 $w$ 消耗的能量。测量方式包括外部传感器和处理器内部传感器。

#### 存储效率 （数据压缩）

$$\text{Compression Ratio} = \frac{\text{uncompressed size}}{\text{compressed size}}$$

- **无损压缩（Lossless）**：可以完全恢复原始数据
- **有损压缩（Lossy）**：无法精确恢复，但压缩后的数据在应用层面足够接近原始数据（ML 中的量化本质上是有损压缩）

#### 可扩展性

规模增大后，资源需求怎么增大

---

### CPU 架构

**冯诺依曼 （von Neumann）架构**

程序本身也是数据，代码也可以被存储/加载/修改

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

**CPU 指令执行周期**
1. **Fetch**：根据 program counter（保存当前/下条指令地址的一个寄存器）找到当前指令地址
2. **Decode**：解析指令含义（解析操作 opcode 和数据 operands）
3. **Execute**：执行指令（分配指令到 ALU/FPU 等硬件单元）
4. **Write back**：写回执行结果到寄存器/内存

一个 **CPU clock cycle**：CPU 里所有正在进行的 instruction 一起往前推进一步。
- **IPC (Instructions Per Cycle)**：顾名思义，一个 cycle 里有多少个 instruction，是衡量 CPU 利用率的核心指标


**ISA** ：定义 CPU 规则，如：
- 认识什么指令
- 有那些寄存器
- 内存怎么寻址
- 函数调用怎么约定
- 异常怎么处理

---

### 执行方式

#### 串行执行

```
时间轴 →
指令1: [F][D][E][WB]
指令2:             [F][D][E][WB]
指令3:                         [F][D][E][WB]
```

每条指令执行完才执行下一条。
- 早期/极简/教学 CPU
- 简单但慢

#### 流水线执行

```
时间轴 →
指令1: [F][D][E][WB]
指令2:    [F][D][E ][WB]
指令3:       [F][D ][E][WB]
指令4:          [F ][D][E][WB]
```

不同指令的不同阶段可以并行执行，但不能同一个指令并行。
- 现代 CPU 必备，显著提高吞吐
- Intel/AMD/ARM/Apple Silicon

三种冒险：
- **数据冒险**：需要先 write 完结果再 read 才不出错的情况（RAW, Read After Write）
  - 解决方法：停顿，或 data forwarding/bypassing，将运算结果直接传给下一条指令
- **结构冒险**：硬件（功能单元）资源竞争
  - 解决方法：停顿，或增加单元，或流水线化功能单元
- **控制冒险**：有些指令需要知道分支判断结果
  - 解决方法：停顿，或分支预测

#### 并行执行

多个 execution units 同时执行不同 instruction

```
时间轴 →
指令1: [F][D][E][WB]
指令2: [F][D][E][WB]
指令3: [F][D][E][WB]
指令4: [F][D][E][WB]
```

适合大量相互独立的数据，比如 AI/图形/矩阵乘法/科学计算
- 多核 CPU
- GPU
- SIMD/AVX
- AI tensor units

---

### 现代 CPU 执行优化

#### 乱序执行（OoO，Out of Order  Execution）

程序顺序负责定义语义，执行顺序可以由数据依赖决定，以提升性能。现代 CPU 每次 fetch 8-16 条指令，一般同时维护数百条 in-flight instructions。

谁的数据准备好了，谁就先执行。

#### 超标量执行 （Superscalar）

注意，superscalar 并不是 OoO 的一种，但高性能 OoO CPU 几乎一定是 superscalar

希望每个 cycle 完成多条指令，比如一个周期同时发射多条指令。关键是指令之间不能互相依赖。

```
时间轴（超标量，每周期取2条）→
[F:I1,I2][D:I1,I2][E:I1,I2][WB:I1,I2]
         [F:I3,I4][D:I3,I4][E:I3,I4][WB:I3,I4]
```

可能遇到的问题（假相关，很多时候只是名字冲突）：
- **反相关（Anti-dependence / WAR, Write After Read）**：必须得先 read 前面的 instruction 才能 write
- **输出相关（Output dependence / WAW, Write After Write）**：write 顺序不能乱
- 现代 CPU 用 register renaming 基本可以消除，区分逻辑寄存器和物理寄存器的名字
- 只有 RAW/数据冒险是后面的指令真的需要前面的计算结果

注意，虽然执行是乱的，但提交时需要顺序提交。

#### 投机执行

CPU 进行分支预测并提前执行然后检验结果，如果预测对了就直接提交省时间，如果错了就丢弃提前执行的指令重新 fetch

---

### 现代多核 CPU 与性能上限

**同时多线程（SMT-Simultaneous Multithreading/Hyperthreading)**：多个线程有自己的 PC、寄存器状态/部分前端状态，但共享 ALU/FPU 等后端核心资源（同一个核）
- 优点：提升硬件利用率，不让后端闲置
- 缺点：有资源竞争和安全问题

**芯片多处理器（CMP-Chip Multiprocessor/Multicore）**：真的多核，每个都有自己的执行资源，共享 L3 cache，内存控制器，主内存等资源
- 优点：真并行，比单核提频省电，吞吐高
- 缺点：并行编程难，缓存难连贯，内存带宽压力大

**程序执行时间的理论下界**：

$$T_{min\text{ (cycles)}} = \frac{W}{IPC_{max}}$$

最少周期数 = 总指令量 ÷ 每周期最多完成的指令数

换成秒，就是右边多除以一个时钟频率 f（Hz）

#### Flynn 分类法

| 类别       | 全称                                  | 含义            | 例子                 |
| -------- | ----------------------------------- | ------------- | ------------------ |
| **SISD** | Single Instruction, Single Data     | 经典串行处理器       | 单核 CPU             |
| **MIMD** | Multiple Instruction, Multiple Data | 多核处理器，每核独立执行  | 多核 CPU，GPU（在某种意义上） |
| **SIMD** | Single Instruction, Multiple Data   | 同一指令同时作用于多个数据 | 向量机、GPU（ML 计算核心）   |
| **MISD** | Multiple Instruction, Single Data   | 实际中几乎不存在      | —                  |

---

### 向量处理器/向量机

两种方向：
- Vertical：最常见，两个向量逐元素计算得到另一个向量
- Horizontal：单个向量内部进行计算，产生一个标量或向量

向量机处理无法进行条件跳转，所以处理条件分支只能用掩码（mask），比如 `[1,0,1,0]` 就是对第 1,3 的元素生效，对 2,4 的元素不生效。

处理不连续内存的访存方法：
- **Gather**：从很多分散地址读取数据，收集成一个向量
- **Scatter**：把一个向量的数据，写到很多分散地址
- 两者都比处理连续内存的 load/store 慢很多

两种向量化方式：
- 编译器自动向量化：编译器发现这能 SIMD，然后自动生成 AVX/SSE 指令。
  - 优点：简单，可移植
  - 缺点：不一定优化成功，不能自己控制
  - 应用：绝大多数普通场景
- 纯显式手写：写 `_mm256_add_epi32` 这种直接操作向量寄存器的代码
  - 优点：可以极致优化和精确控制
  - 缺点：非常复杂、难写难维护难移植
  - 应用：AI kernel，游戏引擎，图像处理，极致 HPC，编译器开发等

---

### GPU 与 CUDA

#### CPU 与 GPU 架构对比

| 维度   | CPU                        | GPU                           |
| ---- | -------------------------- | ----------------------------- |
| 核心数  | 几至几十个大核                    | 数千个小核（SM × CUDA Cores）        |
| 设计目标 | **低延迟**（latency-optimized） | **高吞吐**（throughput-optimized） |
| 执行方式 | 乱序超标量                      | 顺序但高度 SMT（64-way）             |
| 时钟频率 | 高（3–5 GHz）                 | 较低（1–2 GHz）                   |
| 缓存设计 | 大 L1/L2/L3 Cache           | 小 L1，大寄存器文件，Shared Memory     |
| 适用场景 | 复杂控制流，低延迟任务                | 大规模数据并行，吞吐量任务                 |

当某个线程正在等待时，CPU 靠减少延迟来加速，但 GPU 线程/warp 多，切换到别的 warp 就行。

#### CUDA 基础

**CUDA 核心概念层级**：

```
Grid（整个任务）
 └── Block（线程块）
      └── Warp（最小调度/执行单位，32 Threads）
           └── Thread（单个线程）
```

**Warp Divergence**：一个 warp 内线程走不同分支，但一个 warp 只能执行同一条指令，所以得先执行 true 分支再执行 false 分支最后合并，有效利用率减半。
- 短分支时，可能直接用 mask（predication）

想逼近现代处理器的理论性能上限必须充分使用向量指令进行并行，因为现代 CPU/GPU 的高性能本就主要来自 SIMD/vector 并行。

但是，现代高性能计算越来越不想手写底层 SIMD/CUDA，  而是让 compiler/DSL 自动生成高性能代码，比如 Triton。

GPU/向量编程建议：
- Memory layout，parallelism，batching 都优先以 GPU 为中心而设计，而且这样通常也会让 CPU 变快
- Triton 等 DSL 比手写纯 CUDA 更简单也更可移植，Triton 编译器会自动处理一些底层细节
- 一些情况下 CPU 自动向量化的性能也非常高
- 可以用 ISPC 写 CPU SIMD 程序，类似 GPU 上的 CUDA

---

### ML 与二进制规则和数据布局

#### 整数表示

整数表示影响数据如何量化（比如 FP16 量化到 INT8），影响权重怎么存，怎么解码，怎么算回近似浮点值

#### 位操作

一个 byte = 8 bits，但一个 INT4 = 4 bits，所以一个 byte 中存两个 INT4 权重。

推理时需要考虑 load byte, mask/shift, sign extend 等。

#### 浮点数表示

浮点数表示决定 ML 的数值稳定性，训练精度，显存占用和计算吞吐。比如 FP16 精度较高，但动态范围较小，BF16 动态范围较高，但精度较粗。

IEEE 754 浮点标准是 FP32 = 1 符号位 + 8 指数位 + 23 尾数位。这个精度和范围比较高，但占显存和带宽。同时，它并不是精确值，所以不同梯度累计顺序，不同 GPU/kernel 可能都得到不同训练结果。

- FP32：精度和范围较高，但慢、占空间
- FP16：快、省显存，但范围小，容易 overflow/underflow
- BF16：范围接近 FP32，训练更稳，但精度更粗
- FP8：更快更省，但更容易损失精度

#### 字节序

影响模型文件怎么读，tensor 数据如何解释，跨平台传输是否正确。读取的时候要按照正确的字节序才能读出正确的数。

#### 结构体与数组

结构体有 padding 用来对齐。所以对齐得好，load/store 快，对齐不好，访问会明显变慢。

GPU/CPU 在处理连续内存访问上比分散内存访问快非常多。矩阵乘法、attention、convolution 都高度依赖 layout 和 tiling。

Union 的意义：共享同一块内存，不复制数据，只改变解释方式。比如查看 float/BF16/FP16 原始位模式，做低精度格式转换等。

#### 稀疏数据格式

很多矩阵中大部分元素都是 0，全存起来浪费计算和存储资源。一些稀疏矩阵比如：
- 图神经网络的 adjacency matrix
- MoE 中的 Gating 矩阵
- Pruning 后的权重矩阵
- Word embedding lookup

两种格式：

**COO（Coordinate Format）**：用两个/三个数组存非零元素的坐标和值

```
稀疏矩阵:             COO 表示:
0  0  1  0            row: [0  2  2]
0  0  0  0    →       col: [2  1  3]
0  1  0  1            (可选 data 数组)
0  0  0  0
```

优点：直观，易于构建
缺点：存的重复信息多，没有对某行的快速访问

**CSR（Compressed Sparse Row）**：
- `col` ：列索引
- `row_start`：每行起始位置
- `data`：非零值

```
稀疏矩阵:             CSR 表示:
0  0  1  0            col:       [2  1  3]
0  0  0  0    →       row_start: [0  1  1  3  3]
0  1  0  1           
0  0  0  0
```

优点：可以快速访问第 i 行的所有非零元素，按夯访问快，存的重复信息少
缺点：间接内存访问多（先加载 `row_start[i]`，再加载 `col[j]`，再加载 `data[j]` 可能有多次 Cache Miss），由于内存地址不连续所以难以向量化，修改结构困难

#### 数据布局

**AoS（Array of Structures）vs SOA（Structure of Arrays）**

| 布局  | 访问模式                    | 向量化          | Cache 效率    |
| --- | ----------------------- | ------------ | ----------- |
| AoS | 每隔 sizeof(Point) 访问一个 x | 需要 Gather，困难 | 差（加载不需要的 y） |
| SoA | 连续访问 x 数组               | 直接，高效        | 好           |

如果矩阵乘法的访问方向和 memory layout 一致（比如 C 中用 row-major），那就是连续内存访问，比跳跃访问快很多。

也可以用 loop interchange 改变循环顺序，或者 loop tiling/blocking 将矩阵分成小块处理，提升 cache 命中率（Triton 等高性能编译器就用这种技术）。

---

### 内存技术

| 技术           | 易失性 | 速度（延迟）            | 密度                | 用途                     |
| ------------ | --- | ----------------- | ----------------- | ---------------------- |
| **寄存器**      | 是   | 最快（< 1 ns）        | 最低                | CPU/GPU 内部临时存储         |
| **SRAM**     | 是   | 极快（~ 1–5 ns）      | 低（6 晶体管/bit）      | CPU/GPU 的 Cache（L1/L2） |
| **DRAM**     | 是   | 慢（~ 50–100 ns）    | 高（1 晶体管 + 电容/bit） | 主内存（RAM），GPU VRAM      |
| **HBM**      | 是   | 快（DRAM 级延迟，但带宽更高） | 高                 | 现代 GPU 的主内存（A100/H100） |
| **NVMe SSD** | 否   | 很慢（~ 100 μs）      | 很高                | 持久化存储，模型权重加载           |
| **HDD**      | 否   | 极慢（~ 10 ms）       | 最高                | 大规模数据集存储               |

**内存带宽**：一秒能搬运多少数据

由于每个 memory bank 一次只能处理一个请求，访存又很慢，所以要用请求队列缓冲多个请求，确保榨干带宽（**Memory Level Parallelism, MLP**）。

如果 request 总在同一个 bank，其他 bank 闲置，带宽利用率就低了。现代内存控制器会通过 interleaving，将连续地址分散到不同 bank，缓解这个问题。

GPU shaerd memory 有 32 个 bank，对应 warp 上的 32 个 lane。所以 GPU kernel optimization 的核心也有让 warp 尽量访问不同的 bank，以最大化带宽。

---

### 缓存

CPU 快，DRAM 慢，于是要缓存。

层级：Register → L1 → L2 → L3 → DRAM → SSD
- 越近越快、越小、越贵
- 越远越慢、越大、越便宜

缓存命中率越高，平均访问时间越低。缓存未命中要付出非常大的代价。

#### 局部性原理

- **空间局部性**：访问一个地址后，附近地址很可能也被被访问
- **时间局部性**：刚用过的数据，很可能马上又要用

#### Cache 组织方式

- **Direct-Mapped**：一个地址只能放 cache 的固定位置
  - 简单，快，容易冲突
- **Fully Associative**：一个地址可以放 cache 的任意位置
  - 冲突少，但硬件复杂
- **Set-Associative**：先映射到某个 set，再在 set 里的多个 way 中选位置
  - 折中

#### 3C Cache Miss 模型

- **Compulsory Miss**：第一次访问，cache 里肯定没有。
- **Conflict Miss**：多个地址映射到同一个 cache set，互相挤掉。
- **Capacity Miss**：工作集太大，cache 放不下。

#### Cache 替换策略

- **OPT（Optimal）**：踢掉未来最久不会用的行。问题是没人知道未来会怎样，所以它只是一个理论最优
- **LRU（Least Recently Used）**：踢掉最少使用的行
- **MRU（Most Recently Used）**：踢掉最近刚用行。常用于少数特殊模式，比如循环扫描超大数组
- **Random/FIFO**：实现简单

#### Cache 写策略

- **Write-Through**：CPU 改 cache 的时候立即写进 DRAM
  - 优点：简单
  - 缺点：每次都要写回 DRAM 太慢
- **Write-Back**：CPU 改 cache 的时候标记一下，直到真正被踢出去时才写回 DRAM
  - 优点：减少 memory traffic，快
  - 缺点：实现没那么简单

---

### GPU 内存层次

GPU 为了 throughput 把大量芯片面积给了 register 和 data movement。由于 GPU 同时挂超多 thread，每个 thread 都要有独立的 register，所以 register 特别大，比 cache 更重要。

Shared Memory 是程序员手动管理的小 SRAM，速度极快，是高性能 kernel 的关键资源。

DMA（Direct Memory Access）是一个专门负责搬运数据的硬件。有 DMA 后，CPU/GPU 就不用亲自搬运数据，实现计算与通信重叠（Overlap）

---

### 内存一致性

多核 CPU 里，每个核有自己的 cache，要让同一个内存地址在每个核眼里都是一样的值，就是 cache coherence 要解决的。

目前最广泛使用的 cache coherence 协议是 MESI 协议：
- M = Modified，本核改过，内存还是旧的，其他核没有有效副本。
- E = Exclusive，只有本核有，和内存一致。
- S = Shared，多个核都有，只读，和内存一致。
- I = Invalid，无效，下次必须重新加载。

如果一个核心要写某个 cache line，那其他核心里的旧副本必须失效。

多线程/多核训练中，共享的数据会频繁修改，是很大的性能瓶颈。优化方法有少共享，batch 同步等减少通信和同步的方法。

---

### 虚拟内存

和虚拟寄存器一样，本质是让程序以为自己占有一大片连续内存，实际内存可能分散在不同地方。它的意义是让多个程序安全地共享内存，隐藏物理内存碎片，在内存不够时把数据暂时放在磁盘。

- 虚拟内存按 Page 管理，常见大小为 4 KB。
- Page Table 存储虚拟页 → 物理页的映射。
- TLB（Translation Lookaside Buffer）存储最近的地址映射结果，方便 reuse。

Page Fault（缺页异常）的情况：
- 页表还没建立映射（首次访问）：OS 从分配 page，建立映射
- RAM 不够，页被换到 disk：OS 从 disk 读回来，非常慢

每个 Page Table 条目里还有权限位（Read/Write/Execute），每个进程只能看到自己的虚拟内存，防止程序互相篡改数据，偷密码，攻击系统等问题，保护内存，实现进程隔离和内存安全。

如大模型权重很大，一般用 Huge Pages（2 MB/1 GB Page），可以减少 page 数和 TLB miss。
