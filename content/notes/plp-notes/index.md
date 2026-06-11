---
title: "Programming Language Design and Implementation 笔记"
date: 2026-04-28
tags: ["programming-languages"]
draft: false
---

这组 notes 整理自 *Programming Language Pragmatics* 课程复习内容，覆盖类型系统、复合类型、子程序、面向对象、函数式语言、并发、编译与运行时系统等主题。

重点是把编程语言里的概念放回几个核心问题中：

* 一个值如何被分类、检查和解释？
* 复杂数据结构如何映射到内存？
* 函数调用在运行时到底发生了什么？
* 对象、继承和动态分派如何实现？
* 函数式语言如何组织计算？
* 并发程序如何管理多个控制流和共享状态？
* 编译器、虚拟机和运行时系统如何支撑高级语言抽象？

编程语言的概念初看往往很抽象，但大多数都和具体的实现选择紧密相关。类型系统影响安全性和代码复用。record 布局影响内存对齐和比较。函数调用影响栈帧和寄存器。虚方法影响对象布局和分派开销。coroutine 影响调度和控制流。垃圾回收同时影响内存安全和停顿时间。

这组 notes 的目标是把这些概念串起来，看清语言设计背后的 tradeoffs。

## [01 类型系统](../plp-notes-01-types/)

Types 这一篇讨论语言如何理解一个值"是什么"。

核心问题包括：

* 类型在语言中起什么作用？
* strongly typed 和 statically typed 有什么区别？
* type equivalence 和 type compatibility 如何区分？
* structural equivalence 和 name equivalence 分别适合什么场景？
* polymorphism、generics、overloading、duck typing 之间有什么关系？
* type inference，尤其 Hindley-Milner，如何从约束中推导类型？
* equality testing 为什么比表面上更复杂？

这一篇的重点是：类型不只是变量标签。它同时影响合法操作、错误检查、内存表示、代码复用和抽象边界。

## [02 复合类型与内存布局](../plp-notes-02-composite-types/)

Composite Types 这一篇讨论多个值如何被组织成更复杂的数据结构，以及这些结构在内存中如何表示。

核心问题包括：

* record / struct 中为什么会出现 holes 和 padding？
* packing 为什么能节省空间，但可能损失性能？
* union、variant record、sum type 如何表示多种数据形态？
* width subtyping 和 depth subtyping 有什么区别？
* array、slice、row-major、column-major 如何影响访问效率？
* pointer、address、reference 分别是什么？
* dangling reference 和 garbage 是两种什么相反的问题？
* reference counting、tracing GC、generational GC 各自如何权衡？

这一篇的重点是：复合类型表面上是语言抽象，底层则会落到对象布局、寻址、复制、比较和回收。

## [03 子程序与控制抽象](../plp-notes-03-subroutines/)

Subroutines 这一篇讨论函数调用如何把一段代码封装成可进入、可返回、可嵌套的控制结构。

核心问题包括：

* calling sequence 是什么？
* prologue 和 epilogue 分别负责什么？
* stack pointer 和 frame pointer 为什么都重要？
* static chain 和 display 如何支持嵌套函数访问外层变量？
* 参数到底是 call-by-value、call-by-reference、call-by-sharing，还是其他模式？
* exception 发生时 stack unwinding 如何清理调用栈？
* coroutine 和 thread 有什么区别？
* event loop、callback、async / await 如何表达非阻塞控制流？

这一篇的重点是：函数调用不是单纯的语法糖。每次调用背后都有栈帧、寄存器、参数传递、返回地址和异常处理协议。

## [04 面向对象与动态分派](../plp-notes-04-oo/)

Object Orientation 这一篇讨论对象如何把状态和行为封装在一起，以及运行时如何根据对象真实类型选择方法实现。

核心问题包括：

* encapsulation、inheritance、polymorphism 分别解决什么问题？
* abstraction 如何降低复杂度并保护对象不变式？
* `this` parameter 为什么是方法调用的隐藏参数？
* constructor 和 destructor 如何管理对象生命周期？
* C++ 中 initialization 和 assignment 为什么不是一回事？
* static binding 和 dynamic binding 有什么区别？
* overriding 和 redefining 有什么区别？
* vtable 如何实现 virtual method dispatch？
* interface inheritance 如何避免多重实现继承的问题？
* inline caching 如何优化动态分派？

这一篇的重点是：OOP 不只是 class 语法，而是一整套对象模型、抽象边界和运行时分派机制。

## [05 函数式语言](../plp-notes-05-functional/)

Functional Languages 这一篇讨论如果把函数、表达式和值的变换放在语言中心，程序会如何组织。

核心问题包括：

* lambda calculus 为什么是函数式编程的理论基础？
* first-class functions 带来了什么表达能力？
* pure function、immutability、referential transparency 为什么重要？
* Scheme 中 `let`、`let*`、`letrec` 的绑定规则有什么区别？
* `eq?`、`eqv?`、`equal?` 分别比较什么？
* Lisp 的 homoiconicity 为什么让 macro 和 metaprogramming 特别自然？
* eval 和 apply 分别代表求值过程中的哪一步？
* eager、normal-order、lazy evaluation 有什么区别？
* memoization 为什么依赖 pure function 的性质？

这一篇的重点是：函数式语言把计算组织成表达式和函数组合，并通过减少可变状态让程序更容易推理、测试和并发执行。

## [06 并发](../plp-notes-06-concurrency/)

Concurrency 这一篇讨论当程序中有多个控制流同时推进时，语言和运行时如何调度它们，并保护共享状态。

核心问题包括：

* concurrent、parallel、distributed 有什么区别？
* race condition 为什么依赖不可控的执行交错？
* synchronization 如何处理互斥和条件等待？
* coroutine、user-level thread、kernel thread、process 的成本和能力有什么不同？
* busy waiting 什么时候浪费，什么时候可能合理？
* message passing 为什么能减少显式锁？
* test-and-set 和 compare-and-swap 提供了什么硬件原语？
* monitor、condition variable、semaphore 如何组织同步？
* deadlock 为什么会发生，如何预防、避免或检测？
* futures 如何把异步计算表示成一个值？

这一篇的重点是：并发编程的难点不只是同时做很多事，而是多个控制流会共享资源、交错执行、等待条件并争夺 CPU。

## [07 构建与运行程序](../plp-notes-07-building/)

Building and Running Programs 这一篇把编译期和运行期放在一起看，讨论源代码如何变成可执行程序，以及 runtime / VM / JIT 如何继续支撑语言语义。

核心问题包括：

* basic block 和 control flow graph 如何帮助编译器分析程序？
* virtual registers 为什么让优化阶段可以暂时假设寄存器无限？
* register spilling 为什么会降低性能？
* high-level、medium-level、low-level IR 分别适合什么阶段？
* 为什么统一 intermediate form 可以降低多语言、多平台编译器复杂度？
* middle end 和 back end 分别负责什么？
* run-time system 和普通 library 有什么区别？
* process VM 和 system VM 分别抽象什么？
* managed code 依赖 runtime 获得了哪些能力？
* JVM 如何通过 class loading、verification、interpreter、JIT 和 GC 支持 Java 程序？
* JIT 如何利用 hot path 和 runtime profile 做优化？
* reflection 为什么强大，也为什么容易破坏性能和可维护性？

这一篇的重点是：高级语言抽象最终要靠编译器和运行时共同实现。IR、CFG、VM、JIT、GC、reflection 看起来分散，其实都在回答同一个问题：如何让高级语言既保持抽象，又能被真实机器高效、安全地执行。

## 建议阅读顺序

建议按照 01 到 07 顺序阅读，因为它们大致从语言语义走向实现机制：

```text
01 类型系统
→ 02 复合类型与内存布局
→ 03 子程序与控制抽象
→ 04 面向对象与动态分派
→ 05 函数式语言
→ 06 并发
→ 07 构建与运行程序
```

前几篇关注语言如何组织值、数据和控制流。后几篇逐渐转向运行时、并发和编译器实现。

如果只想快速建立整体框架，可以先读每篇的小结部分，再回头看细节。

## 全貌

这组 notes 可以被压缩成一个大的问题：

```text
A programming language is a set of abstractions.
A compiler and runtime system make those abstractions executable.
```

类型系统定义什么操作合法。
复合类型定义数据如何组织。
子程序定义控制流如何进入和返回。
对象系统定义状态和行为如何绑定。
函数式语言定义计算如何通过表达式和函数组合。
并发机制定义多个控制流如何同时推进。
编译器和运行时系统负责把这一切变成机器可以执行、可以管理、可以优化的程序。

理解编程语言，不只是记住某种语法，而是理解每个语言特性背后的设计取舍：安全性、性能、表达能力、可维护性、实现复杂度，以及程序员需要承担多少心智负担。
