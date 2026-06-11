---
title: "03 子程序与控制抽象"
date: 2026-04-23
tags: ["programming-languages"]
draft: false
---

Subroutines 这一章的核心问题是：语言如何把一段代码封装成可调用的单元，以及一次函数调用在运行时到底发生了什么。

表面上，函数调用只是：

```text
f(x)
```

但实现层面要处理很多事情：

* 参数如何传进去
* 返回值如何传回来
* 局部变量放在哪里
* 调用结束后如何回到原位置
* 嵌套函数如何访问外层变量
* 异常发生时如何清理栈帧
* coroutine 和 thread 如何保存与恢复控制流

所以这一章连接的是"语言里的函数抽象"和"机器上的控制流与栈帧"。

## Calling sequence

`Calling sequence` 是一次子程序调用时，caller 和 callee 需要共同完成的一组步骤。

它的作用是让函数调用变成一个可恢复、可嵌套、可返回的过程。程序进入子程序之前，要保存足够的信息；子程序执行完之后，要恢复到调用前的状态，并把返回值交回去。

可以把 calling sequence 分成两个方向：

```text
on entry: 进入子程序
on return: 离开子程序
```

### On entry

进入子程序时，通常要做这些事：

1. 传递参数。
2. 保存 return address，也就是函数结束后应该回到哪里。
3. 调整 stack pointer，为新栈帧分配空间。
4. 保存必要的寄存器，比如 frame pointer、callee-saved registers。
5. 初始化局部变量或局部对象。
6. 把 program counter 跳转到子程序入口。

其中有些工作由 caller 做，有些由 callee 的 prologue 做。

### On return

离开子程序时，通常要做这些事：

1. 放置 return value。
2. 清理局部变量或局部对象。
3. 恢复 stack pointer。
4. 恢复保存过的寄存器。
5. 恢复 frame pointer。
6. 根据 return address 回到 caller。

其中 callee 的 epilogue 负责清理当前函数自己的状态，caller 则负责处理返回值和调用后的善后。

## Prologue 和 Epilogue

`Prologue` 是子程序刚开始执行时的一小段代码，用来建立当前函数的运行环境。

它通常做：

* 保存旧的 frame pointer。
* 设置新的 frame pointer。
* 为局部变量分配栈空间。
* 保存 callee-saved registers。
* 初始化局部对象。

`Epilogue` 是子程序返回前的一小段代码，用来撤销 prologue 做过的事情。

它通常做：

* 析构或清理局部对象。
* 恢复 callee-saved registers。
* 恢复旧的 frame pointer。
* 弹出当前 stack frame。
* 跳转回 return address。

Prologue 和 epilogue 的存在，让函数调用可以嵌套任意多层，并且每一层都有自己的局部环境。

## Stack pointer 和 Frame pointer

`Stack pointer` 指向当前栈顶。栈在运行时会不断变化，push、pop、函数调用、局部变量分配都会移动 stack pointer。

`Frame pointer` 指向当前栈帧中的一个固定位置。它通常在函数执行期间保持稳定。

为什么通常需要两者？

因为如果只用 stack pointer，局部变量和参数相对于 stack pointer 的偏移可能会不断变化。比如函数中又临时 push 了一些值，或者运行时分配了可变大小的局部空间，stack pointer 会移动，编译器就很难用固定偏移访问变量。

Frame pointer 提供了一个稳定基准：

```text
local variable = FP - fixed offset
parameter      = FP + fixed offset
```

它也有利于调试。程序崩溃时，debugger 可以通过 frame pointer 还原 call stack。

有些优化编译器会省略 frame pointer，把它当成普通寄存器使用。但概念上，frame pointer 是理解 stack frame 的关键。

## Static chain

在支持嵌套函数的语言中，内层函数可能访问外层函数的变量。

例如：

```text
function outer() {
    var x

    function inner() {
        use x
    }
}
```

`inner` 执行时，需要找到 `outer` 的 stack frame，才能访问 `x`。这时就需要 static chain。

`Static chain` 是一条由 static links 组成的链。每个 stack frame 里保存一个 static link，指向它在源代码词法结构上的外层函数的 stack frame。

注意这里的 "static" 指 lexical nesting，不是调用顺序。

维护 static chain 的过程大致是：

1. Caller 根据自己和 callee 的词法嵌套关系，计算 callee 应该拿到的 static link。
2. Caller 把这个 static link 作为隐藏参数传给 callee。
3. Callee 在 prologue 中把 static link 存进自己的 stack frame。
4. 当 callee 需要访问外层变量时，顺着 static link 找到对应外层 frame，再通过固定偏移访问变量。

Static chain 的优点是实现简单。缺点是如果嵌套层级很深，访问很外层的变量需要沿链多次跳转。

## Display

`Display` 是另一种支持嵌套作用域访问的机制。

它可以理解成一个数组，数组的每个位置记录当前某个 lexical nesting level 对应的 stack frame 地址。

例如：

```text
display[0] = global scope frame
display[1] = level 1 frame
display[2] = level 2 frame
```

如果当前函数在第 3 层，想访问第 1 层的变量，可以直接通过：

```text
display[1] + offset
```

这样访问外层变量是 O(1)，不需要像 static chain 那样一层一层跳。

### Display 和 Static chain 的区别

| 维度     | Static chain             | Display           |
| ------ | ------------------------ | ----------------- |
| 基本结构   | 每个 frame 有一个 static link | 一个外部数组记录各层 frame  |
| 访问外层变量 | 可能需要多次跳转                 | 直接索引，通常 O(1)      |
| 调用维护成本 | 较低                       | 调用和返回时要更新 display |
| 实现复杂度  | 简单                       | 更复杂               |
| 适合场景   | 嵌套不深时很好                  | 深层嵌套访问频繁时更有优势     |

总体上，static chain 更简单；display 访问快，但维护成本更高。

## 为什么参数常用 registers 传递

现代机器通常用 registers 传递前几个参数，而不是全部压到 stack 上。

原因很直接：

* registers 访问极快。
* stack 访问要经过内存层级，可能命中 cache，也可能 miss。
* register passing 需要更少指令。
* 现代 CPU 有更多通用寄存器，可以承担常见参数数量。

例如 x86-64 的常见调用约定会把前几个整数或指针参数放在寄存器里。只有参数太多、太大，或者需要取地址时，才会更多依赖 stack。

## Caller-saved 和 Callee-saved registers

调用约定通常会规定一部分寄存器由 caller 保存，另一部分由 callee 保存。

`Caller-saved registers` 的意思是：如果 caller 认为某些寄存器的值在调用后还要用，它自己要在调用前保存。Callee 可以自由覆盖这些寄存器。

`Callee-saved registers` 的意思是：callee 如果要使用这些寄存器，必须在进入时保存，返回前恢复。Caller 可以假设这些寄存器在调用前后保持不变。

为什么要分成两类？

如果全部 caller 保存，caller 不知道 callee 到底会用哪些寄存器，可能保存太多。
如果全部 callee 保存，callee 也不知道 caller 到底关心哪些寄存器，也可能保存太多。

分成两类之后，编译器可以把短生命周期的临时值放在 caller-saved registers，把长生命周期的值放在 callee-saved registers。这样整体开销更低。

## 为什么倾向于让 Callee 做某些工作

有些工作理论上 caller 和 callee 都可以做。很多时候会倾向于让 callee 做，主要原因是减少代码体积。

如果每个 caller 都重复生成同一段善后代码，程序里会出现很多重复指令。放在 callee 中，只需要生成一份。

另外，callee 更了解自己的内部情况：

* 需要多少局部空间
* 哪些寄存器会被使用
* 哪些局部对象需要清理
* 返回前要恢复哪些状态

所以把这些工作放在 callee 中，通常更符合封装，也更容易维护。

## 为什么即使用 registers 传参，stack 中仍可能保留参数空间

即使参数通过 registers 传递，编译器或 ABI 仍可能在 stack 中为参数预留空间。

原因包括：

* 寄存器没有地址。如果程序要对参数取地址，参数必须被放到内存中。
* 函数复杂时，寄存器可能不够用，参数需要 spill 到 stack。
* 可变参数函数需要把参数放在连续区域里，方便遍历。
* 调试器和异常处理机制可能需要更稳定的调用信息。
* 某些 ABI 规定必须预留 shadow space 或 home space。

所以 register passing 是优化常见路径，但 stack 仍然是函数调用语义的重要后备结构。

## Calling sequence 的优化

在特殊情况下，编译器可以优化 calling sequence。

例如 leaf routine，也就是不会再调用其他函数的函数。它可能不需要完整建立 stack frame，也不需要保存 return address 之外的复杂状态。

常见优化包括：

* 省略 frame pointer。
* 省略不必要的寄存器保存。
* 对 leaf function 使用更短的 prologue / epilogue。
* 使用 tail-call optimization，直接复用当前栈帧。
* inline expansion，完全消除调用开销。
* 对小函数做 constant propagation 和 dead code elimination。

这些优化的核心目标是：如果某些调用协议在当前场景中不是必需的，就不要付出完整成本。

## Inline subroutine 和 Macro

`Inline subroutine` 是函数。它有正常的类型检查、作用域规则和语义约束。编译器只是把函数体展开到调用点，从而减少函数调用开销。

`Macro` 通常是文本或语法层面的替换。尤其在 C 预处理器里，macro 不做正常的类型检查，也不遵循普通函数的作用域规则。

例如：

```c
#define SQUARE(x) x * x
```

如果调用：

```c
SQUARE(a + b)
```

可能展开成：

```c
a + b * a + b
```

这就和预期不同。

Inline subroutine 更安全，macro 更底层、更灵活，也更容易出问题。

## 什么时候适合 inline

适合 inline 的情况包括：

* 函数体很小，调用开销比函数本身还大。
* 函数被频繁调用。
* 调用点传入常量，inline 后可以做 constant folding。
* 编译器需要看到更多上下文，以便做进一步优化。
* 虚函数调用在某些场景下能被 devirtualize，然后 inline。

但 inline 也有代价。过度 inline 会让代码体积膨胀，影响 instruction cache，甚至降低性能。

所以 inline 的价值不是"越多越好"，而是让编译器在合适的位置消除抽象成本。

## Formal parameters 和 Actual parameters

`Formal parameters` 是函数定义里的参数，也就是形参。

例如：

```c
int add(int x, int y)
```

这里 `x` 和 `y` 是 formal parameters。

它们是函数内部的局部名字。函数没有被调用时，它们没有具体值。

`Actual parameters` 是函数调用时传进去的实际参数，也就是实参。

例如：

```c
add(a + 1, b)
```

这里 `a + 1` 和 `b` 是 actual parameters。

简单说：

```text
formal parameter = 函数定义里的占位符
actual parameter = 调用时传入的实际表达式或值
```

## Parameter-passing modes

参数传递模式决定了 actual parameter 和 formal parameter 之间的关系。

常见模式包括：

* call-by-value
* call-by-reference
* call-by-result
* call-by-value-result
* call-by-name
* call-by-sharing

不同语言会选择不同组合。

## Call-by-value

`Call-by-value` 是把 actual parameter 的值复制给 formal parameter。

函数内部修改 formal parameter，不会影响 caller 中的原变量。

例如：

```c
void f(int x) {
    x = 10;
}

int a = 1;
f(a);
// a is still 1
```

优点：

* 简单。
* 安全。
* 不容易产生副作用。
* 小数据传递成本低。

缺点：

* 大对象复制成本高。
* 函数无法通过参数直接修改 caller 的变量。

适合小型、不可变或不希望被修改的数据。

## Call-by-reference

`Call-by-reference` 是让 formal parameter 成为 actual parameter 的别名。

函数内部对 formal parameter 的修改，会直接反映到 caller 的变量上。

例如概念上：

```text
f(x) 修改的是 caller 里的 x 本身
```

优点：

* 可以让函数修改 caller 的变量。
* 传大对象时只需要传地址，避免复制。

缺点：

* 容易产生副作用。
* aliasing 会让程序难以推理。
* 调试更复杂。

适合需要输出结果、修改大对象或避免复制的场景。

## Call-by-result

`Call-by-result` 指 formal parameter 在函数进入时不从 actual parameter 取值，但函数返回时，会把 formal parameter 的最终值复制回 actual parameter。

它像是一个 output parameter。

概念上：

```text
进入函数：不读取 actual
离开函数：formal -> actual
```

这种模式适合只想让函数输出结果，而不想让它读取原始值的情况。

问题是如果多个 formal parameters 最后写回同一个 actual parameter，写回顺序会影响结果。

## Call-by-value-result

`Call-by-value-result` 也叫 copy-in / copy-out。

进入函数时，把 actual parameter 的值复制给 formal parameter。
离开函数时，把 formal parameter 的最终值复制回 actual parameter。

概念上：

```text
进入函数：actual -> formal
离开函数：formal -> actual
```

它看起来像 call-by-reference，但中间函数操作的是本地副本。区别是 aliasing 行为不同，尤其当多个参数引用同一个实际变量时，结果可能和 call-by-reference 不一样。

## Call-by-name

`Call-by-name` 指 actual parameter 不在调用前求值，而是把表达式本身延迟到函数内部，每次使用 formal parameter 时重新求值。

它可以理解成把参数表达式包装成一个 thunk。

这种模式在 Algol 60 中很有名。

优点是非常灵活，可以表达延迟求值。缺点是实现复杂，而且容易产生难以理解的副作用。

现代语言里更常见的是通过 lambda、closure 或 lazy evaluation 实现类似效果。

## Call-by-sharing

Java、Python、JavaScript、Ruby 等 reference model 语言通常更接近 `call-by-sharing`。

Call-by-sharing 的意思是：把对象引用的副本传给函数。

函数内部不能通过重新绑定 formal parameter 改变 caller 变量指向哪个对象，但可以通过这个引用修改对象内部状态。

例如 Python：

```python
def f(x):
    x.append(1)

a = []
f(a)
# a becomes [1]
```

这里函数修改了对象内容，所以 caller 能看到变化。

但如果写：

```python
def g(x):
    x = [1]

a = []
g(a)
# a is still []
```

这里 `x = [1]` 只是让 formal parameter 指向新对象，不会改变 caller 里的 `a`。

所以 call-by-sharing 和 call-by-reference 的区别是：共享的是对象，不是变量绑定本身。

## 如何选择参数传递方式

可以用几个问题判断：

* 数据很小，并且不希望被修改：call-by-value。
* 数据很大，但不需要修改：传 reference / pointer to const，或语言里的共享引用。
* 需要函数修改 caller 可见的状态：call-by-reference 或类似 output parameter。
* 想避免复制，但又不想暴露可变性：不可变对象、const reference、borrowed reference。
* Reference model 语言里，要注意函数能否修改对象内部状态。

核心权衡是：

```text
复制成本 vs 副作用风险
```

## Default parameters

Default parameters 指函数参数可以有默认值。调用者不传某个参数时，语言自动使用默认值。

例如：

```python
def connect(host, port=80):
    ...
```

默认参数的实现通常有两种：

* 编译器在调用点补上默认值。
* 函数入口处检查参数是否缺失，再填入默认值。

默认参数让 API 更简洁，但也可能造成歧义，尤其当参数很多、类型相近时。

## Named parameters

Named parameters，也叫 keyword parameters，允许调用时指定参数名。

例如：

```python
connect(host="example.com", port=443)
```

它的好处是：

* 调用更清晰。
* 参数很多时不容易传错顺序。
* 可以只指定部分可选参数。
* API 可读性更强。

它的代价是：函数签名中的参数名变成公开接口的一部分，之后修改名字可能破坏调用者代码。

## Variable-length argument lists

Variable-length argument lists 允许函数接收数量不固定的参数。

例如 C 里的：

```c
printf("%d %s", x, s);
```

这种机制适合格式化输出、日志、构造列表等场景。

C/C++ 中的 varargs 比较底层，类型安全较弱。程序员和库函数需要自己按照格式字符串解释参数。

Java 和 C# 的变长参数通常更类型安全，本质上更接近数组：

```java
void f(String... args)
```

编译器知道参数元素类型，也能做更多检查。

## Return value 的机制

函数返回值可以用几种方式实现。

第一种是通过 register 返回。小的整数、指针、浮点值通常可以直接放在特定寄存器中。

第二种是通过 caller 提供的内存位置返回。对于大对象，caller 可以预先分配空间，然后把地址传给 callee，让 callee 把结果写进去。

第三种是通过 heap 分配返回。函数创建对象，把引用或指针返回给 caller。这样对象可以在函数结束后继续存在，但也带来内存管理问题。

不同机制的区别在于：

* 小值适合寄存器，快。
* 大对象适合 caller-allocated return slot，避免复制。
* 动态对象适合 heap，但需要 GC 或手动管理。

## Structured exceptions

`Structured exceptions` 是语言级的异常处理机制。它把错误处理和正常业务逻辑分开。

优点包括：

* 正常路径更清晰。
* 异常可以自动向上传播，直到找到合适 handler。
* 可以携带错误信息、类型和 stack trace。
* 配合 `finally` 或 RAII，可以保证资源被清理。
* 错误处理逻辑可以集中在合适的位置。

没有 structured exceptions 时，程序员常用这些方法：

* 返回错误码，比如 `-1` 表示失败。
* 使用特殊返回值，比如 `null`。
* 设置全局错误变量，比如 C 的 `errno`。
* 通过 output parameter 返回错误。
* 传入 callback 或 handler function。

这些方法可行，但容易让每一层调用都充满错误检查。

## Exceptions as classes

C++、Java、C# 等语言把 exceptions 定义成 classes，有几个好处：

* 可以用类型层级区分错误种类。
* 可以携带额外字段，比如错误码、文件名、上下文。
* handler 可以捕获某个父类异常，从而处理一组相关错误。
* 可以复用普通 OO 机制，如继承和多态。

例如：

```java
catch (IOException e)
```

可以捕获所有 I/O 相关异常。

## try...finally

`try...finally` 的核心目的是 guaranteed execution。

无论 `try` 里面发生什么，`finally` 里的代码都应该执行。

常见情况包括：

* `try` 正常执行完，执行 `finally`。
* `try` 中发生异常，先执行 `finally`，再继续寻找 handler。
* `try` 中执行 `return`、`break`、`continue`，仍然先执行 `finally`。

它主要用于资源清理：

```java
try {
    use(resource);
} finally {
    resource.close();
}
```

这样即使中途出错，也能关闭文件、释放锁、断开连接。

## Zero-cost exceptions

有些语言实现异常时，会尽量让正常路径没有额外运行时开销。这通常叫 zero-cost exceptions。

思路是：

* 编译期生成异常处理表。
* 正常执行时，不在每个 `try` 块里插入额外检查。
* 没有异常发生时，程序几乎不付出运行时成本。
* 异常真的发生时，再根据当前指令地址查表，执行 stack unwinding，寻找 handler。

这种机制的 tradeoff 是：

* 正常路径很快。
* 二进制文件需要存异常表，有空间开销。
* 异常发生时会很慢。

所以 exceptions 适合处理异常情况，不适合用作普通控制流。

## Stack unwinding 和 implicit handler

当一个函数中发生异常，但当前函数没有合适的 catch handler 时，运行时需要离开当前函数，继续向 caller 查找 handler。

这个过程叫 stack unwinding。

子程序的 implicit handler 需要做几件事：

1. 清理当前函数中已经构造的局部对象。
2. 执行必要的 finally 或析构逻辑。
3. 恢复寄存器和 frame pointer 等调用状态。
4. 弹出当前 stack frame。
5. 回到 caller 的异常查找过程。
6. 如果一直找不到 handler，终止程序并报告错误。

所以异常不是简单的 jump。它必须保证离开每一层函数时，资源和运行时状态被正确处理。

## Coroutines

Coroutine 是可以主动暂停和恢复的控制流。

普通函数调用是：

```text
caller -> callee -> return to caller
```

Coroutine 可以是：

```text
A runs -> A yields -> B runs -> B yields -> A resumes
```

它不一定结束后才返回，而是可以在中途保存状态，之后继续执行。

## Coroutine 和 Thread

Coroutine 和 thread 都能表示多个控制流，但调度方式和开销不同。

| 维度   | Coroutine        | Thread        |
| ---- | ---------------- | ------------- |
| 调度者  | 程序员或语言 runtime   | OS kernel     |
| 切换方式 | 主动 yield / await | 可被 OS 抢占      |
| 切换成本 | 低                | 高             |
| 并行能力 | 通常并发，不一定并行       | 可以在多核上并行      |
| 适合场景 | 异步 I/O、大量轻量任务    | CPU 并行、阻塞系统调用 |

Coroutine 的优势是轻量，适合大量等待型任务。Thread 的优势是真正并行，适合需要多核执行的任务。

## Stackful 和 Stackless coroutines

Coroutine 可以分成 stackful 和 stackless。

### Stackful coroutines

Stackful coroutine 有自己的栈。它可以在嵌套调用的深处 yield，然后之后从同一位置恢复。

优点：

* 表达能力强。
* 可以像普通同步代码一样写。
* 可以从深层调用中挂起。

缺点：

* 每个 coroutine 需要栈空间。
* 切换成本比 stackless 高。
* 实现更复杂。

代表机制或语言包括 Lua coroutine、Go goroutine 等。严格说 Go goroutine 更接近由 runtime 管理的轻量线程，但它有独立可增长栈，因此常被放在 stackful 控制流模型里理解。

### Stackless coroutines

Stackless coroutine 没有独立调用栈。编译器或 runtime 通常把 async function 转换成状态机。

优点：

* 内存开销小。
* 性能高。
* 很适合 async / await 模型。

缺点：

* 只能在标记为 async 的函数中挂起。
* 普通函数不能随意 yield。
* async 会在函数签名中传播。

代表例子包括 JavaScript、Python async、C# async、Rust async。

## Coroutine stacks 的分配方式

Coroutine 如果是 stackful，就需要考虑栈怎么分配。

常见方法有三种。

第一种是固定大小栈。实现简单，切换快，但容易浪费内存，也可能栈溢出。

第二种是可增长栈。初始很小，需要时扩展。内存利用率好，但实现复杂，扩展时有额外成本。

第三种是 segmented stack。栈由多个小段组成，需要更多空间时追加新段。它避免一次性分配大栈，但会让栈访问和调试更复杂。

这些方案都在权衡：

```text
实现简单度 / 内存利用率 / 切换成本 / 栈溢出风险
```

## Event

编程语言意义上的 event，可以理解成某个外部或内部情况发生后，系统通知程序去处理。

例如：

* 用户点击按钮。
* 网络请求完成。
* 文件读取结束。
* 定时器到期。
* 消息到达。
* 传感器状态变化。

Event 的重点是：程序不是线性地从头跑到尾，而是等待某些事情发生，再执行对应 handler。

## Event loop

Event loop 是一种常见的事件处理策略。

系统维护一个 event queue。程序不断从 queue 中取出事件，然后执行对应 handler。

流程大致是：

```text
wait for event -> dequeue event -> run handler -> wait for next event
```

优点：

* 模型简单。
* 单线程事件循环不需要锁。
* 执行顺序相对可预测。
* 很适合 UI 和 I/O 密集型程序。

缺点：

* 某个 handler 执行太久会阻塞整个 loop。
* CPU 密集型任务会导致界面卡死或请求延迟。
* 需要把长任务拆开或交给 worker。

JavaScript 的异步模型就和 event loop 关系很深。

## Concurrent dispatch / callbacks

另一种事件策略是 concurrent dispatch。事件发生后，系统把 handler 分发到不同 thread 或 thread pool 中执行。

优点：

* 不容易被单个 handler 卡死。
* 可以利用多核 CPU。
* 吞吐量高。
* 适合服务器端并发请求处理。

缺点：

* 多个 handler 可能同时访问共享数据。
* 需要锁、原子操作或其他同步机制。
* 调试更复杂。
* 线程切换和调度有额外开销。

可以粗略理解：

```text
event loop: 顺序处理，简单但怕阻塞
concurrent dispatch: 并行处理，强大但要同步
```

## Asynchronous programming

Asynchronous programming 关注的是：遇到等待时，不要阻塞当前控制流。

典型等待包括：

* 网络 I/O
* 文件 I/O
* 数据库查询
* 定时器
* 用户输入

异步编程的目标是让程序在等待某个操作完成时，可以继续处理别的事情。

它和 concurrent programming 有联系，但重点不同。

`Asynchronous programming` 关注等待的非阻塞化。
`Concurrent programming` 关注多个任务在同一时间段内推进。
`Parallel programming` 关注多个任务真的同时在多个核心上运行。

异步程序可以是单线程并发，也可以结合多线程。

## JavaScript async 的演进

JavaScript 的异步模型大致经历了几个阶段：

第一阶段是 callbacks。

```js
readFile(path, function(result) {
    ...
});
```

问题是嵌套多了容易形成 callback hell。

第二阶段是 promises。

```js
readFile(path)
    .then(result => ...)
    .catch(error => ...);
```

Promise 把异步结果变成一个对象，方便链式组合。

第三阶段是 async / await。

```js
const result = await readFile(path);
```

它让异步代码写起来更接近同步代码，但底层仍然是 promise 和 event loop。

## 小结

Subroutines and Control Abstraction 这一章可以用几组问题串起来：

1. 函数调用时，caller 和 callee 分别负责什么？
2. Stack frame 如何保存参数、局部变量、返回地址和寄存器？
3. 为什么需要 stack pointer 和 frame pointer？
4. 嵌套函数如何访问外层作用域？
5. 参数到底是复制值、传引用、传对象共享，还是延迟表达式？
6. 返回值如何从 callee 回到 caller？
7. 异常发生时，运行时如何清理栈帧并寻找 handler？
8. Coroutine 如何把控制流暂停并恢复？
9. Event loop 和 concurrent dispatch 如何处理外部事件？
10. Async programming 如何避免等待时阻塞程序？

这一章的重点是看到"函数"并不是一个纯粹的语法单位。每次调用背后都有 calling convention、stack layout、register discipline、parameter mode 和 control-flow protocol。语言把这些细节包装起来，让程序员可以写 `f(x)`，但实现层面必须精确处理进入、返回、异常、暂停和恢复。
