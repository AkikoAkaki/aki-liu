---
title: "07 构建与运行程序"
date: 2026-04-27
tags: ["programming-languages"]
draft: false
---

这一篇的核心问题是：一段源代码如何变成可以运行的程序，以及程序运行时，语言系统还需要继续做哪些管理工作。

前面几章讨论的是语言特性：类型、对象、函数、并发、内存。这里关注的是这些特性如何落地：

```text
source code
-> front end
-> intermediate form
-> optimization
-> code generation
-> executable / bytecode
-> run-time system / virtual machine
-> execution
```

可以把这一篇分成两半：

* Building a runnable program：编译器如何分析、优化和生成代码。
* Run-time program management：运行时系统、虚拟机和 JIT 如何支持程序运行。

它们共同回答一个问题：高级语言的抽象，最终如何被机器执行。

## Basic block

`Basic block` 是一段连续的指令序列。

它有两个关键性质：

* 只能从第一条指令进入。
* 只能从最后一条指令离开。

也就是说，basic block 中间不会有别的入口，也不会在中间突然跳走。

例如：

```text
x = a + b
y = x * 2
z = y - 1
```

如果这三条指令之间没有 branch、jump、return、exception edge，它们可以构成一个 basic block。

Basic block 是编译器做局部优化的基本单位。因为 block 内部控制流是直线的，编译器可以比较容易地分析：

* 哪些表达式重复了
* 哪些变量不再使用
* 哪些计算可以提前
* 哪些临时变量可以消掉

## Control flow graph

`Control flow graph`，简称 CFG，用图表示程序的所有可能执行路径。

在 CFG 里：

* 每个节点是一个 basic block。
* 每条边表示控制流可能从一个 block 跳到另一个 block。

例如一个 `if` 语句可能形成这样的结构：

```text
        condition
        /       \
   then block   else block
        \       /
        join block
```

循环也可以在 CFG 中表现为回边：

```text
loop header -> loop body -> loop header
```

CFG 对编译器非常重要，因为很多优化需要跨越单个 basic block，理解整个函数的控制流。

例如：

* 找循环。
* 找死代码。
* 分析变量活跃区间。
* 做数据流分析。
* 判断某个分支是否永远不会执行。
* 做全局优化。

Basic block 解决的是"直线代码怎么分析"，CFG 解决的是"分支和循环怎么分析"。

## Virtual registers

`Virtual registers` 是编译器在中间表示里使用的抽象寄存器。

真实机器的寄存器数量很有限，比如 x86-64 只有有限数量的通用寄存器。编译器如果一开始就直接使用真实寄存器，优化会很麻烦。

所以中间阶段通常先假设有无限多个寄存器：

```text
v1 = a + b
v2 = v1 * c
v3 = v2 - d
```

这里的 `v1`、`v2`、`v3` 不一定是真实硬件寄存器，它们是 virtual registers。

Virtual registers 的作用是：

* 屏蔽不同硬件的寄存器差异。
* 让优化阶段更容易表达中间结果。
* 暂时假设寄存器数量足够。
* 把"生成逻辑"和"映射到真实寄存器"分开。

后面 register allocation 阶段再决定：

```text
v1 -> rax
v2 -> rbx
v3 -> stack slot
```

如果真实寄存器不够，就会发生 spilling。

## Local code improvement 和 Global code improvement

`Local code improvement` 指只在一个 basic block 内部做优化。

它的特点是：

* 范围小。
* 不需要复杂控制流分析。
* 实现简单。
* 编译速度快。
* 适合处理直线代码中的冗余。

例如：

```text
x = a + b
y = a + b
```

在同一个 basic block 里，编译器可以发现 `a + b` 被重复计算了，于是把它变成：

```text
t = a + b
x = t
y = t
```

`Global code improvement` 指跨越多个 basic blocks 的优化，通常在整个函数范围内进行。

它需要 CFG 和数据流分析。比如一个变量在某个分支里被定义，在另一个 block 中被使用，编译器需要知道不同路径上的值是否一致。

Global optimization 的例子包括：

* global common subexpression elimination
* loop-invariant code motion
* dead code elimination
* constant propagation
* register allocation
* partial redundancy elimination

Local optimization 更简单，global optimization 更强，但分析成本更高。

## Register spilling

`Register spilling` 指需要同时保存的值太多，超过了硬件物理寄存器数量，编译器被迫把某些值从寄存器移到内存中，通常是 stack slot。

例如编译器本来希望：

```text
v1 -> register
v2 -> register
v3 -> register
...
```

但真实寄存器不够，只能：

```text
v7 -> stack memory
```

之后每次使用 `v7`，都要从内存 load 回来；每次更新它，又要 store 回内存。

Spilling 的代价很高：

* 增加 load / store 指令。
* 增加内存访问延迟。
* 增加 instruction count。
* 可能破坏 cache locality。
* 让 hot path 变慢。

编译器通常会根据变量的使用频率、活跃区间、循环位置等因素决定哪些值应该留在寄存器，哪些可以 spill。

常见方法包括 graph coloring register allocation 和 linear scan register allocation。

## Intermediate form

`Intermediate form`，也叫 IF 或 IR，是编译器内部使用的中间表示。

源语言和机器指令之间差距很大。高级语言有类型、函数、对象、异常、闭包、泛型、模块；机器指令只有寄存器、内存、跳转、算术和调用。

IR 的作用是建立一个中间层：

```text
source language -> IR -> target machine code
```

它让编译器可以在不直接面对所有源语言细节和所有机器细节的情况下做分析和优化。

## IF 的 level

Intermediate form 可以有不同层级：high-level、medium-level、low-level。

### High-level IF

High-level IF 接近源代码，保留大量源语言结构。

典型例子是 AST。

它的优点是：

* 保留语法结构。
* 保留类型信息。
* 容易对应回源码。
* 适合做高层语义分析。
* 适合做某些源语言相关优化。

缺点是：

* 和机器差距大。
* 语言相关性强。
* 不适合做底层寄存器和指令优化。
* 多种语言之间不容易共享。

### Medium-level IF

Medium-level IF 在源语言和机器之间取平衡。它通常会去掉一部分源语言细节，但仍然保持平台无关。

很多通用优化发生在这一层。

例如：

* constant folding
* common subexpression elimination
* dead code elimination
* inlining
* loop optimization
* data-flow analysis

它的优点是：

* 相对语言无关。
* 相对机器无关。
* 适合复用优化器。
* 比 AST 更接近执行模型。

缺点是：

* 丢失一部分高层语义。
* 仍然不能直接运行。
* 某些机器相关优化还做不了。

LLVM IR 就可以理解成一种偏 medium 到 low-level 的 IR。

### Low-level IF

Low-level IF 接近机器指令，通常看起来像带 virtual registers 的 assembly。

它的优点是：

* 接近真实硬件。
* 适合指令选择。
* 适合寄存器分配。
* 适合机器相关优化。
* 可以精确表达 calling convention、load/store、branch 等细节。

缺点是：

* 可移植性差。
* 不容易还原到源语言结构。
* 高层语义已经丢失。
* 分析和重构程序结构更困难。

可以粗略理解：

```text
High-level IR  = 接近源码
Medium-level IR = 适合通用优化
Low-level IR   = 接近机器
```

## 为什么要用单一 IF

如果有多种源语言和多种目标机器，单一中间表示可以显著降低编译器复杂度。

假设有 M 种源语言，N 种目标机器。

如果每种语言都直接写到每种机器，需要：

```text
M * N
```

个编译器组合。

如果引入统一 IF：

```text
source languages -> IF -> target machines
```

只需要：

```text
M 个 front ends + N 个 back ends
```

这把复杂度从乘法关系变成加法关系。

前端负责：

* 解析源代码。
* 做词法、语法、语义检查。
* 生成统一 IF。

中端负责：

* 在 IF 上做机器无关优化。

后端负责：

* 把 IF 映射到具体机器指令。
* 做机器相关优化。
* 处理寄存器、指令选择、calling convention。

这个结构的价值是解耦。

源语言变化时，不一定要重写所有后端。
新机器出现时，也不一定要为每种语言重写完整编译器。

## 为什么编译器可能使用多个 IF

虽然单一 IF 很有价值，但实际编译器经常使用多个 IR。

原因是不同阶段需要不同信息。

早期阶段需要保留源语言结构：

```text
AST / typed AST
```

中间阶段需要适合优化：

```text
SSA IR / three-address code
```

后期阶段需要接近机器：

```text
machine IR / virtual-register assembly
```

多个 IR 的好处是：

* 每个阶段使用最合适的表示。
* 高层优化不被底层细节干扰。
* 底层优化不需要处理复杂源语言结构。
* 编译器结构更清晰。
* 不同优化 pass 可以使用不同粒度的信息。

缺点是：

* IR 之间需要转换。
* 编译器实现更复杂。
* 需要维护更多工具和验证逻辑。
* 转换时可能丢失信息。

所以单一 IF 是理想化的解耦模型，多个 IF 是工程上的常见选择。

## Back end compiler

Back end 负责把优化后的 IR 变成目标机器代码。

它通常包含几个主要阶段：

### Instruction selection

把 IR 操作映射成目标机器指令。

例如 IR 中的：

```text
x = y + z
```

可能被映射成某个架构上的 `add` 指令。

不同 CPU 的指令集不同，所以 instruction selection 是机器相关的。

### Instruction scheduling

调整指令顺序，让 CPU pipeline、cache、branch prediction、load latency 等表现更好。

例如，如果某条 load 指令需要等待内存，编译器可能把一些独立指令排到它后面，隐藏延迟。

### Register allocation

把 virtual registers 映射到 physical registers。

如果物理寄存器不够，就要 spill 到 stack。

### Calling convention lowering

处理参数传递、返回值、栈帧、寄存器保存、函数调用协议。

### Object code emission

生成目标文件或机器码，包括指令、数据段、符号表、重定位信息等。

Back end 的核心任务是：把相对抽象的 IR 变成具体机器可以执行的指令序列。

## Middle end

`Middle end` 是编译器中做 IR-to-IR 转换的部分。

它不直接关心源语言语法，也不直接关心具体机器指令。它的输入和输出通常都是某种中间表示。

Middle end 的常见优化包括：

* inlining
* constant folding
* constant propagation
* dead code elimination
* common subexpression elimination
* loop-invariant code motion
* strength reduction
* escape analysis
* data-flow analysis
* control-flow simplification

Middle end 的价值是复用。

如果多个前端都能生成同一种 IR，多个后端都能接收这种 IR，那么 middle end 的优化就能服务很多语言和很多平台。

## 从编译器到运行时

编译器把程序变成某种可运行形式，但程序真正运行时，仍然可能需要语言系统提供支持。

例如：

* 内存分配。
* 垃圾回收。
* 异常处理。
* 动态类型检查。
* 线程调度。
* 反射。
* 类加载。
* 模块加载。
* 安全检查。
* JIT 编译。
* 程序启动和退出清理。

这些功能属于 run-time system。

## Run-time system

`Run-time system` 是语言在程序运行时提供的一组基础机制。

它和普通 library 的区别在于：runtime system 支持的是语言本身的语义。

普通 library 提供可选功能。比如字符串处理库、HTTP 库、数学库。你可以用，也可以不用。

Run-time system 则通常是程序运行的基础。没有它，语言的很多特性无法实现。

例如 Java 程序依赖 JVM 的 class loading、GC、exception handling、thread management 等。Python 程序依赖 Python interpreter 和 object model。Go 程序依赖自己的 runtime 做 goroutine scheduling、GC、stack growth 等。

Run-time system 可能负责：

* heap allocation
* garbage collection
* stack management
* thread / coroutine scheduling
* exception propagation
* dynamic dispatch support
* type checks
* reflection metadata
* module loading
* program startup
* finalization / cleanup
* interaction with OS

可以说，runtime system 是高级语言抽象在运行期的支撑层。

## Runtime 和 Library 的区别

一个简单判断方式是：这个机制是否在支持语言语义本身。

例如：

```text
GC             = runtime
exception unwinding = runtime
dynamic type check  = runtime
thread scheduler    = runtime
string utility      = library
HTTP client         = library
JSON parser         = library
```

当然边界有时会模糊。某些语言把一部分功能放进标准库，但实现上仍然需要 runtime 配合。

例如 Go 的 channel 看起来像语言特性，也和 runtime 调度器紧密相关。Java 的 reflection API 是 library 形式，但底层依赖 class metadata 和 JVM 支持。

## Interpreter

Interpreter 直接执行程序表示，而不是提前把整个程序编译成 native machine code。

最简单的 interpreter 可能直接遍历 AST。

例如：

```text
eval(BinaryExpr("+", left, right))
```

每次执行都根据 AST 节点类型决定该做什么。

AST interpreter 实现比较直接，适合教学、脚本语言、小工具或早期原型。但它性能通常较低，因为每一步都需要大量动态分派和树遍历。

为了提高性能，很多语言会先把源代码编译成 bytecode，再由 virtual machine 执行 bytecode。

## Virtual machine

`Virtual machine` 在这里通常指 process VM，也就是为某个程序或某种语言提供的虚拟执行环境。

它通常有自己的：

* bytecode instruction set
* operand stack 或 virtual registers
* method / function representation
* memory model
* type metadata
* exception mechanism
* class / module loader
* garbage collector
* interpreter 或 JIT compiler

VM 和普通 AST interpreter 的区别在于：VM 通常执行的是更低层、更线性的 intermediate form，比如 bytecode，而不是直接遍历源码 AST。

例如：

```text
source code -> bytecode -> VM executes bytecode
```

Bytecode 比 AST 更接近机器执行模型。它通常是线性指令序列，因此解释执行时开销更低，也更适合 JIT 编译。

## System VM 和 Process VM

Virtual machine 可以分成 system VM 和 process VM。

### System VM

System VM 模拟一整套硬件平台，可以运行完整操作系统。

例如常见的虚拟机软件可以让一个 guest OS 以为自己运行在真实硬件上。

它抽象的是：

* CPU
* memory
* disk
* network
* devices
* ISA 或硬件接口

System VM 也可以被叫作 hardware virtual machine、machine emulator、platform VM 等，具体叫法取决于实现方式和语境。

它的目标是让多个操作系统共享同一台物理机器，或者让一个 OS 运行在不同的宿主环境中。

### Process VM

Process VM 为单个程序提供运行环境。程序开始运行时创建，程序结束时销毁。

例如：

* JVM
* .NET CLR
* WebAssembly runtime
* CPython interpreter 在广义上也可以看作语言运行环境

Process VM 抽象的是语言级执行环境。它让程序觉得自己运行在一个专门为该语言设计的机器上。

Process VM 的目标包括：

* 平台无关。
* 安全隔离。
* 动态加载。
* 管理内存。
* 支持 JIT。
* 提供一致的语言语义。

可以粗略比较：

```text
System VM  = 虚拟硬件，运行整个 OS
Process VM = 虚拟语言机器，运行单个程序
```

## Managed code

`Managed code` 指由 runtime 或 virtual machine 管理执行的代码。

它通常具有这些特征：

* 自动内存管理。
* 类型安全验证。
* 异常处理支持。
* 安全检查。
* metadata 支持。
* reflection 支持。
* JIT 编译。
* 跨平台 bytecode 或 intermediate language。

Java bytecode、.NET IL 都是典型例子。

Managed code 的优势是：

* 安全性更强。
* 内存管理负担更小。
* 可以做运行时优化。
* 平台无关性更好。
* runtime 可以收集 profile 信息再优化。

代价是：

* 启动可能更慢。
* 运行时系统更复杂。
* 内存占用可能更高。
* 和底层硬件之间隔了一层抽象。
* 某些场景下性能可预测性较弱。

## 为什么很多 VM 使用 stack-based intermediate form

很多 VM 使用 stack-based bytecode，因为它实现简单，指令紧凑。

Stack-based bytecode 通过 operand stack 传递临时值。

例如表达式：

```text
a + b
```

可能编译成：

```text
load a
load b
add
```

`load a` 把 `a` 压栈，`load b` 把 `b` 压栈，`add` 从栈顶弹出两个值，相加后再压回栈。

Stack-based form 的优点：

* 指令短，不需要显式写很多寄存器编号。
* bytecode 更紧凑。
* 生成代码简单。
* 验证类型和栈深度相对直接。
* 适合解释器执行。

缺点：

* 需要频繁 push / pop。
* 数据依赖有时不如 register-based IR 清晰。
* JIT 编译前通常要再转换成更适合优化的形式。
* 表达复杂优化时不如 SSA / register form 方便。

所以 stack-based bytecode 适合作为 portable execution format，但优化阶段可能会转换成另一种 IR。

## JVM 架构

Java Virtual Machine 可以分成几个主要部分。

### Class loader

Class loader 负责把 `.class` 文件加载到内存中。

它不只是读文件，还涉及：

* 查找 class。
* 加载 bytecode。
* 验证 class file。
* 准备静态字段。
* 解析符号引用。
* 初始化 class。

Class loading 是 JVM 动态性的基础。Java 可以在运行时加载新类，也可以通过不同 class loader 隔离不同命名空间。

### Runtime data areas

JVM 运行时数据区大致包括线程共享区和线程私有区。

线程共享区包括：

* heap
* method area / metaspace

线程私有区包括：

* PC register
* Java stack
* native method stack

Heap 存对象。Java stack 存每个方法调用的 stack frame。PC register 记录当前线程执行到哪条 bytecode。

### Execution engine

Execution engine 负责执行 bytecode。

它通常包括：

* interpreter
* JIT compiler
* garbage collector

Interpreter 可以快速开始执行 bytecode。JIT 会把热点代码编译成 native code。GC 负责自动内存管理。

### JNI 和 Native Libraries

JNI 是 Java Native Interface。它允许 Java 调用 C/C++ 等 native code，也允许 native code 调用 JVM。

这让 Java 程序可以使用操作系统 API、硬件接口或已有 native library。

但 JNI 也会绕过一部分 managed environment 的安全和可移植性，因此需要谨慎使用。

## Java class file

Java class file 是 JVM 的输入格式之一。它不是源代码，而是编译后的 bytecode 和 metadata。

一个 class file 通常包含：

* magic number
* version
* constant pool
* access flags
* class name
* superclass name
* interfaces
* fields
* methods
* attributes
* bytecode instructions
* exception table
* debug information

其中 constant pool 很重要。它保存字符串、类名、方法名、字段名、符号引用等信息。

Class file 的设计让 Java 可以做到：

```text
compile once, run on any JVM
```

只要目标机器有兼容 JVM，就可以加载和执行同一份 bytecode。

## Load time validity checks

JVM 在 load time 会对 class file 做很多有效性检查。

这些检查的目的，是确保 bytecode 不会破坏 JVM 的安全模型和类型系统。

### Format checks

Format checks 检查 class file 的基本结构是否合法。

例如：

* 文件开头是否是 `0xCAFEBABE`。
* class file 版本是否被当前 JVM 支持。
* constant pool 格式是否正确。
* 文件是否缺少必要部分。
* 文件是否有多余或损坏内容。

### Semantic checks

Semantic checks 检查类语义是否合法。

例如：

* 类是否有合法父类。
* 是否试图继承 final class。
* 非抽象类是否实现了所有 abstract methods。
* 字段和方法声明是否符合规则。

### Bytecode verification

Bytecode verification 检查指令是否安全。

例如：

* 操作数类型是否匹配。
* operand stack 是否会 underflow 或 overflow。
* 局部变量使用前是否初始化。
* branch target 是否合法。
* 方法返回类型是否正确。
* 不会伪造对象引用或破坏类型安全。

### Symbolic reference verification

Class file 中很多引用是 symbolic reference，比如通过类名、字段名、方法名表示目标。

JVM 需要确认：

* 目标类存在。
* 目标字段或方法存在。
* 当前类有权限访问目标。
* 引用解析符合访问控制规则。

这些检查让 JVM 可以在执行前阻止恶意或损坏的 bytecode。

## Just-in-time compiler

`JIT compiler` 在程序运行过程中，把 bytecode 或 intermediate representation 编译成 native machine code。

它介于 interpreter 和 ahead-of-time compiler 之间。

Interpreter 的优点是启动快、实现灵活，但长期执行性能较低。
AOT compilation 的优点是运行前已经生成机器码，但它缺少运行时 profile 信息。
JIT 的特点是：先运行起来，再根据运行时信息优化热点代码。

JIT 的潜在优势包括：

* 根据真实硬件做优化。
* 根据运行时 profile 优化 hot path。
* 做 aggressive inlining。
* 做 devirtualization。
* 做 escape analysis。
* 消除不必要的 boxing / allocation。
* 根据类型反馈优化动态调用。
* 对不常执行的代码少花编译成本。

代价是：

* 启动阶段可能较慢。
* 运行时编译消耗 CPU。
* 需要更多内存保存编译后代码。
* 性能有 warm-up 过程。
* 行为比纯 AOT 更复杂。

## 为什么 JIT 常以 bytecode 为输入

JIT 可以以 source code 为输入，也可以以 bytecode 为输入。很多系统更倾向于 bytecode，原因是 bytecode 已经完成了大量前端工作。

Bytecode 通常已经处理了：

* parsing
* syntax checking
* type checking
* name resolution
* basic semantic checks
* portable representation

这样 JIT 不需要每次从源代码重新解析。它可以直接面对更规则、更接近执行模型的表示。

Bytecode 的优势包括：

* 比 source code 更紧凑。
* 更容易验证。
* 更容易跨平台分发。
* 更适合解释执行。
* 更适合转换成优化 IR。
* 可以隐藏部分源码细节。

所以 JIT 输入 bytecode，本质上是把前端编译和运行时优化分开。

## Hot path

`Hot path` 指程序中执行频率最高的代码路径。

它可能是：

* 核心循环。
* 高频函数。
* 常走的 if 分支。
* 关键请求路径。
* 数值计算内核。
* 高频对象方法调用。

Hot path 很重要，因为程序性能通常由少数高频路径决定。

如果一段代码只执行一次，即使优化 10 倍，对整体性能影响也可能很小。
如果一段代码执行十亿次，哪怕每次省一个指令，也可能显著提升性能。

JIT 会特别关注 hot path。它可以先解释执行程序，同时收集 profile 信息：

* 哪些方法最常调用。
* 哪些分支最常走。
* 某个 virtual call site 通常出现哪些类型。
* 哪些对象没有逃逸。
* 哪些循环最热。

然后 JIT 把这些 hot code 编译成更高效的 native code。

## JIT 如何 inline virtual methods

Virtual method 正常情况下需要 dynamic dispatch。编译器在静态阶段不一定知道具体调用目标。

但 JIT 有运行时 profile 信息。它可能发现某个 call site 实际上几乎总是同一个类型。

例如：

```java
shape.draw()
```

理论上 `shape` 可能是 `Circle`、`Rectangle`、`Triangle`。
但运行时 profile 显示这里 99% 都是 `Circle`。

JIT 可以做 optimistic optimization：

1. 假设这里通常是 `Circle`。
2. 插入类型检查。
3. 如果确实是 `Circle`，直接调用并 inline `Circle.draw()`。
4. 如果后来出现别的类型，走 fallback path，必要时 deoptimize。

这种优化能把动态调用变成接近静态调用的性能。

这也是 JIT 的优势之一：它可以利用运行时事实，而不是只依赖编译期类型。

## Deoptimization

JIT 经常做基于假设的优化。

例如它假设：

* 某个变量总是某个类型。
* 某个 class 没有被新的 subclass 扩展。
* 某个 branch 基本不会走。
* 某个对象不会逃逸。

如果这些假设后来失效，runtime 需要撤回优化，回到更通用的执行方式。这个过程叫 deoptimization。

Deoptimization 的存在让 JIT 可以大胆优化，同时保留语言语义正确性。

可以理解成：

```text
先根据当前事实生成快路径
如果事实变了，再退回安全路径
```

这对动态语言和 managed runtime 很重要。

## Reflection

`Reflection` 指程序在 runtime 访问、检查甚至修改自身结构的能力。

它通常包括：

* 获取对象的 class。
* 查看 class 的字段和方法。
* 根据字符串查找方法。
* 动态创建对象。
* 动态调用方法。
* 读取 annotation / metadata。
* 修改访问权限或属性。

例如 Java 中可以通过 reflection 做：

```java
Class<?> c = Class.forName("User");
Object obj = c.getConstructor().newInstance();
```

Reflection 的作用包括：

* 框架开发。
* 依赖注入。
* ORM。
* 序列化 / 反序列化。
* 测试工具。
* 插件系统。
* 动态加载。

很多现代框架都依赖 reflection，因为框架需要在不知道具体业务类的情况下操作它们。

## Reflection 的代价和滥用

Reflection 很强，但不能随便用，尤其不要放在 hot path 中频繁执行。

问题包括：

* 动态查找成本高。
* 编译器和 JIT 很难 inline。
* 类型检查推迟到运行时。
* 可能产生 boxing / unboxing。
* 破坏封装。
* 让代码更难读。
* 可能绕过访问控制。
* 重构时不容易被 IDE 和编译器发现。

例如，如果每次请求都用字符串查找字段并动态调用方法，性能会明显下降。更好的方式通常是：

* 启动时反射一次，缓存结果。
* 用 code generation 生成直接调用代码。
* 用 method handle / function pointer 缓存访问路径。
* 避免在核心循环里做反射查找。

Reflection 适合做框架边界和元编程，不适合替代普通方法调用。

## 小结

Building and Running Programs 可以用几组问题串起来：

1. Basic block 为什么是局部优化的基本单位？
2. CFG 如何表示程序所有可能的控制流？
3. Virtual registers 为什么能让编译器先假设寄存器无限？
4. Register spilling 为什么会显著降低性能？
5. High-level、medium-level、low-level IR 分别适合什么阶段？
6. 为什么统一 IF 能把多语言、多平台编译器复杂度从乘法变成加法？
7. 为什么真实编译器仍然常常使用多个 IR？
8. Middle end 做的 IR-to-IR 优化有什么价值？
9. Back end 如何把 IR 映射到真实机器指令？
10. Run-time system 和普通 library 的区别是什么？
11. VM 为什么通常执行 bytecode，而不是直接执行 AST？
12. System VM 和 process VM 分别抽象什么？
13. Managed code 依赖 runtime 获得了什么能力？
14. JVM 如何通过 class loading、verification、interpreter、JIT 和 GC 支持 Java 程序？
15. JIT 如何利用 hot path 和 runtime profile 做优化？
16. Reflection 为什么强大，也为什么容易破坏性能和可维护性？

这一篇的重点是把编译期和运行期连起来看。编译器负责把源代码变成更接近机器的表示，runtime 负责在程序运行时继续支撑语言语义。IR、CFG、virtual registers、JIT、VM、GC、reflection 这些东西看起来分散，其实都在解决同一个问题：如何让高级语言既保留抽象，又能被真实机器高效、安全地执行。
