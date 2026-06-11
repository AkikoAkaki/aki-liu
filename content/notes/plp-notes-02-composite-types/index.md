---
title: "02 复合类型与内存布局"
date: 2026-04-22
tags: ["programming-languages"]
draft: false
---

Composite types 这一章的核心问题是：语言如何把多个值组织成更复杂的数据结构，以及这些结构在内存里到底如何表示。

如果 Types 这一章关注"一个值是什么"，Composite Types 这一章关注的就是"多个值如何被放在一起"。这不只是语法设计问题，也会直接影响内存布局、访问效率、安全性、赋值语义、比较语义和垃圾回收。

可以把本章理解成一组语言层和机器层之间的连接：

* record / struct：多个字段如何排列
* union / variant record：同一块内存如何表示不同形态的数据
* array / slice：连续数据如何被寻址和切分
* pointer / reference：对象之间如何互相连接
* garbage collection：程序如何处理不再可达的 heap object

## Records 和 holes

Record，也就是很多语言里的 struct，是把多个字段组合成一个整体。

例如 C 里的结构体：

```c
struct MyRecord {
    char a;
    int b;
};
```

直觉上，`char` 占 1 字节，`int` 占 4 字节，所以整个 struct 应该占 5 字节。但实际情况通常不是这样。编译器可能会在 `char a` 和 `int b` 之间插入几个空字节，让 `int b` 的地址满足对齐要求。

这些不存实际数据、只用来占位的字节，就叫 holes 或 padding。

### holes 是怎么产生的

holes 主要来自 data alignment。

现代 CPU 访问内存时，通常更喜欢按照某些边界读取数据。比如一个 4 字节的 `int` 如果放在 4 字节对齐的地址上，读取会更快，也更符合硬件要求。如果字段紧密排列导致某个字段跨越不合适的边界，CPU 可能需要更多次读取，甚至在某些架构上无法直接访问。

所以编译器会插入 padding，让字段地址对齐。

例如：

```c
struct MyRecord {
    char a;   // 1 byte
              // 3 bytes padding
    int b;    // 4 bytes
};
```

这时整个 struct 可能占 8 字节，而不是 5 字节。

### holes 的影响

holes 有几个重要影响：

* 增加内存占用。
* 影响 binary layout，使跨语言、网络协议、文件格式映射变复杂。
* 影响相等性比较，因为 padding bytes 里可能残留随机数据。
* 可能带来安全问题，因为 hole 中可能残留旧内存内容。

这也是为什么 record assignment 通常比 record comparison 更容易实现。

赋值时，编译器可以直接复制整块内存，包括 padding。即使 padding 里的内容没有语义意义，复制过去也没问题。

但比较时，如果直接比较整块内存，padding bytes 可能不同，导致两个语义上相同的 record 被判断为不同。因此比较 record 通常需要逐字段比较，而不能简单 memcmp。

## Packing

`Packing` 指取消或减少 record 中的 holes，让字段尽可能紧密排列。

它的优点是：

* 减少内存占用。
* 适合映射硬件寄存器、网络协议、文件格式等要求精确布局的场景。
* 可以保证不同设备或不同程序看到相同的内存视图。

它的缺点是：

* 访问可能变慢。
* 某些硬件上未对齐访问可能报错。
* 代码更难移植。
* 编译器优化空间变小。

所以 packing 一般不用于普通业务代码，而更多用于嵌入式、系统编程、网络协议、二进制文件解析等场景。

## 为什么编译器可能重新排列字段

如果语言允许，编译器可能会重新排列 record 的字段顺序，以减少 padding。

比如原本字段顺序是：

```c
char a;
int b;
char c;
```

可能会产生多个 holes。若改成：

```c
int b;
char a;
char c;
```

整体内存占用可能更小。

但这也会带来问题：

* 程序员不能依赖字段的物理顺序。
* 和 C ABI、硬件布局、网络协议、文件格式交互时会出错。
* 反射、序列化、调试工具可能更复杂。

因此很多语言会限制编译器随意重排字段，尤其当 record layout 需要对外暴露时。

## Unions 和 Variant Records

Union 是一种特殊的 composite type。它允许多个字段共享同一块内存。Union 的大小通常由最大成员决定。

例如：

```c
union Value {
    int i;
    float f;
    char* s;
};
```

同一块内存可以被解释成 `int`、`float` 或 `char*`。这很节省空间，但也很危险，因为程序员必须自己记住当前到底存的是哪一种类型。

### Variant records

Variant record 可以理解成更安全的 union。它通常带有一个 tag，用来记录当前是哪一种 variant。

现代语言里的很多 sum types / algebraic data types，本质上都和 tagged union 有关。

例如 Rust：

```rust
enum Result<T, E> {
    Ok(T),
    Err(E),
}
```

这里的 `Result` 可能是 `Ok`，也可能是 `Err`。语言会记录当前 variant，并强制程序员处理不同情况。

### 现代用途

Union / variant records 在现代程序里主要有两个用途：

第一，表示类型安全的状态或结果。

比如一个操作要么成功，要么失败：

```rust
Result<T, E>
```

这比返回 `null` 或错误码更清晰，因为成功和失败被写进了类型系统。

第二，表示有多种形态的数据结构。

比如 AST 中，一个 expression 可能是：

* literal
* variable
* binary expression
* function call
* if expression

这些不同形态可以用 variant type 表示。

## Width subtyping 和 Depth subtyping

Record subtyping 里有两个重要概念：width subtyping 和 depth subtyping。

### Width subtyping

Width subtyping 指一个 record 如果拥有另一个 record 所需要的所有字段，并且还有更多字段，那么它可以被看作后者的 subtype。

例如：

```ts
type Person = {
    name: string
}

type Student = {
    name: string
    age: number
}
```

`Student` 拥有 `Person` 需要的 `name` 字段，还多了 `age`。在支持 width subtyping 的系统里，`Student` 可以出现在需要 `Person` 的地方。

直觉是：需要的字段都有，多出来的字段可以忽略。

### Depth subtyping

Depth subtyping 关注字段类型本身的 subtype 关系。

例如：

```ts
type A = {
    info: Person
}

type B = {
    info: Student
}
```

如果 `Student` 是 `Person` 的 subtype，那么 `B` 可能被看作 `A` 的 subtype。

但 depth subtyping 在 mutable record 中会带来风险。

如果一个函数以为自己拿到的是：

```ts
{ info: Person }
```

并且它可以修改 `info` 字段，那么它可能把一个普通 `Person` 写进去。但原对象实际要求 `info` 是 `Student`。这样就破坏了类型安全。

所以 mutable fields 会让 depth subtyping 变复杂。

## Record subtyping 和 Union subtyping 的方向为什么相反

在 record subtyping 中，字段更多的 record 是 subtype。

因为它能满足字段更少的 record 的要求。

```text
{name, age} <: {name}
```

但在 union subtyping 中，constructor 更少的 union 反而是 subtype。

例如：

```text
Red | Blue <: Red | Blue | Green
```

原因是 union 表示"可能是哪几种情况"。可能性越少，类型越具体，也越容易被更宽的 union 接收。

简单说：

* record 是"我有什么"
* union 是"我可能是什么"

record 字段越多，能力越强。union 分支越少，可能性越窄。

## Array slice

Array slice 是对数组中一段连续子序列的引用。它通常不复制原数据，而是提供一个 view。

一个 slice 通常包含：

* 指向起始位置的指针或引用
* length
* 有些语言还会包含 capacity，比如 Go

例如 Go 的 slice 里有：

```text
pointer + length + capacity
```

但不是所有语言的 slice 都暴露 capacity。更通用地说，slice 的核心是 pointer / reference + length。

### slice 的用途

Slice 很有用，因为它可以让程序只处理大数组中的一部分，而不复制整段数据。

常见用途包括：

* 处理巨大数组的一小段。
* 用同一个函数处理完整数组和局部片段。
* 字符串解析。
* sliding window。
* 避免不必要的数据复制。
* 通过 length 信息做 bounds checking，提高安全性。

但 slice 也有一个重要语义：它通常共享原数组的数据。修改 slice 中的元素，可能也会修改原数组。

## Two-dimensional array 和 Array of arrays

二维数组和一维数组的数组，在语义和内存布局上可能有明显区别。

### 真正的二维数组

真正的 two-dimensional array 通常是一个连续的大内存块。

比如一个 `3 x 4` 的数组，所有元素可以连续存储。

优点：

* 内存紧凑。
* 寻址简单。
* cache locality 好。
* 适合数值计算。

缺点：

* 通常要求矩形结构。
* 每一行长度固定。

### Array of one-dimensional arrays

Array of arrays 是一个数组，里面的每个元素又指向另一个数组。

它的优点是：

* 每一行可以长度不同。
* 更灵活。
* 行可以独立分配、替换或扩展。

缺点是：

* 需要额外存储 row pointers。
* 寻址多一次间接访问。
* 内存可能分散，cache locality 较差。
* 分配和回收更复杂。

简单说，连续二维数组更适合性能，array of arrays 更适合灵活性。

## Array shape

Array shape 指数组每个维度的大小。

例如：

```text
int A[3][4][5]
```

这个数组的 shape 是：

```text
3 x 4 x 5
```

shape 决定了数组总元素数量，也决定了多维下标如何映射到线性内存地址。

## Stack allocation 和 Heap allocation

子程序中声明的数组什么时候能放在 stack，什么时候必须放在 heap？

### 可以放在 stack 的情况

通常满足这些条件时，可以放在 stack：

* 大小在编译时已知，或函数进入后固定。
* 生命周期只在当前函数调用期间。
* 大小适中，不会导致 stack overflow。
* 语言和实现允许这种分配方式。

例如 C 中的局部固定大小数组：

```c
int a[100];
```

它通常可以放在 stack 上。

某些语言支持 VLA，也就是 variable-length array。它的大小在运行时决定，但进入作用域后不再变化，也可能分配在 stack 上。不过这取决于语言和实现。

### 必须放在 heap 的情况

通常需要 heap allocation 的情况包括：

* 对象需要跨函数调用继续存在。
* 大小在编译期不可知，且不适合 stack。
* 数组很大。
* 数组需要动态扩容。
* 数据结构生命周期不服从严格的函数调用栈。

例如：

```c
int* a = malloc(n * sizeof(int));
```

这就是 heap allocation。

## Contiguous layout 和 Row-pointer layout

多维数组有两种常见布局：contiguous layout 和 row-pointer layout。

### Contiguous layout

Contiguous layout 把所有元素放在一整块连续内存中。

优点：

* 地址计算简单。
* cache locality 好。
* 适合顺序访问。
* 内存开销小。
* 对数值计算友好。

缺点：

* 形状通常较固定。
* 扩展或改变某一行不方便。
* 需要一整块连续内存。

### Row-pointer layout

Row-pointer layout 先存一组指针，每个指针指向一行。

优点：

* 更灵活。
* 每行可以不同长度。
* 可以单独替换某一行。
* 动态分配更自然。

缺点：

* 多一次指针间接访问。
* 内存更分散。
* cache locality 较差。
* 需要额外存储指针。

## Row-major 和 Column-major

连续分配的多维数组还要决定元素按什么顺序放进内存。

### Row-major

Row-major 先放完第一行，再放第二行。

例如：

```text
A[0][0], A[0][1], A[0][2], A[1][0], A[1][1], ...
```

C、C++、Java 等语言通常使用 row-major 或类似布局。

### Column-major

Column-major 先放完第一列，再放第二列。

例如：

```text
A[0][0], A[1][0], A[2][0], A[0][1], A[1][1], ...
```

Fortran、MATLAB 等更偏 column-major。

### 为什么程序员需要知道布局

因为访问顺序会影响 cache performance。

现代 CPU 读取内存时，会一次读取一整条 cache line。如果程序按内存连续顺序访问，就能充分利用 cache。如果访问顺序和布局相反，就会频繁跳跃，性能可能明显下降。

对于 row-major 数组，更高效的访问方式通常是：

```c
for (int i = 0; i < rows; i++) {
    for (int j = 0; j < cols; j++) {
        use(A[i][j]);
    }
}
```

内层循环沿着行走，访问是连续的。

## 数组元素地址计算

编译器在计算数组元素地址时，有些工作可以在编译期完成，有些必须在运行期完成。

### 编译期可以完成的部分

通常包括：

* 元素大小，比如 `int`、`double` 的大小。
* 每个维度的固定大小。
* 下标下界，如果语言固定从 0 开始。
* 常量下标的偏移量。
* 局部数组相对于 stack frame 的固定偏移。

例如：

```c
A[5]
```

如果 `A` 是固定数组，元素大小已知，那么 `5 * element_size` 这部分可以在编译期处理。

### 运行期必须完成的部分

通常包括：

* 变量下标，比如 `A[i]` 里的 `i`。
* heap object 的实际 base address。
* 每次函数调用时 stack frame 的实际地址。
* 动态数组的长度。
* bounds checking，比如检查 `0 <= i < length`。

在 Java、Rust 等强调安全性的语言中，数组访问通常需要运行期边界检查。编译器有时可以优化掉这些检查，但语义上需要保证越界访问不会悄悄发生。

## Strings 为什么常常比 Array of characters 更特殊

很多语言会给 string 提供比普通 character array 更多的操作，因为 string 通常代表文本，而不仅是一段字符数组。

String 可能支持：

* 拼接
* 子串
* 模式匹配
* 编码处理
* 不可变性
* 哈希缓存
* 正则相关操作
* Unicode 语义

而 array of characters 更接近裸数据容器。它关心的是元素存储和索引，不一定关心文本语义。

所以 string 和 char array 的区别，不只是 API 多一点，而是抽象层次不同。String 是文本抽象，char array 是字符序列的存储结构。

## Recursive types

Recursive type 指一个类型的定义中包含自己。

最经典的例子是 linked list：

```c
struct Node {
    int value;
    struct Node* next;
};
```

这里 `next` 指向另一个 `Node`。通过这个递归结构，就可以构造任意长度的链表。

Recursive types 让语言可以表达：

* linked list
* tree
* graph
* AST
* nested data structures

但它也带来一个问题：一个类型不能直接无限包含自己。

例如下面这种写法不成立：

```c
struct Node {
    int value;
    struct Node next;
};
```

因为这会要求一个 `Node` 里面直接包含另一个完整的 `Node`，而那个 `Node` 里面又包含另一个完整的 `Node`，大小无限递归。

所以递归结构通常需要 pointer 或 reference 作为间接层。

## Reference model 和 Pointer model

具有变量 reference model 的语言中，变量通常保存的是对象引用，而不是对象本身。Java、Python、JavaScript、Ruby 等语言接近这个模型。

例如在 Java 里：

```java
Node next;
```

这个字段本身就是一个引用。程序员不需要显式写 `*`。

在 value model + pointers 的语言中，程序员需要明确区分值和地址。C、C++、Rust、Go 等语言都要求程序员在某种程度上面对这个区别。

可以这样比较：

| 维度   | Reference model                      | Value + Pointers model            |
| ---- | ------------------------------------ | --------------------------------- |
| 递归定义 | 隐式、自动                                | 显式，需要声明 pointer/reference         |
| 内存成本 | 通常较高，每个对象独立分配                        | 更可控，可以精细安排布局                      |
| 易用性  | 更高，符合直觉                              | 更低，需要管理地址和生命周期                    |
| 运行效率 | 受 GC 和内存离散影响                         | 局部优化空间更大                          |
| 代表语言 | Java, Python, JavaScript, Ruby, Lisp | C, C++, Rust, Go, Pascal, Fortran |

Reference model 的优势是写起来简单，特别适合复杂对象图。Pointer model 的优势是控制力强，适合系统编程和性能敏感场景。

## Dereference

Dereference 指通过 pointer 或 reference 找到它指向的对象。

在 C/C++ 中，dereference 是显式的：

```c
int value = *ptr;
```

在 Rust 中也可以显式解引用：

```rust
let value = *ptr;
```

在 Go 中：

```go
value := *ptr
```

而在 Java、Python、JavaScript、C# 等语言里，dereference 通常是透明的。程序员操作对象时，不需要显式写 `*`。语言和运行时自动通过引用找到对象。

这种设计更易用，但也隐藏了对象间接访问、共享状态和 heap allocation 的成本。

## Pointer、Address 和 Reference

`Address` 是内存位置的数值标识。它可以被存在寄存器或内存里，也可以作为指针值的一部分出现。

`Pointer` 是一种带类型语义的地址值。它不仅表示某个地址，还告诉语言可以如何解释这个地址上的数据。Pointer 可以被 dereference，也可能支持 pointer arithmetic。

`Reference` 通常更像一个受限制的 pointer。它一般更安全，语义上表示某个对象或变量的别名。

可以粗略比较：

| 概念        | 含义                             |
| --------- | ------------------------------ |
| Address   | 内存位置的数值标识                      |
| Pointer   | 可以指向地址、可解引用、可能能做 arithmetic 的值 |
| Reference | 更受限制、更安全的别名或对象引用               |

在 C++ 中，reference 通常必须初始化，之后不能重新绑定。它也不像普通 pointer 那样直接做 arithmetic。
在 Java/Python 这类语言中，reference 更接近对象句柄，程序员不能直接看到原始地址。

## C 中 Pointers 和 Arrays 的互操作性

C 语言中，arrays 和 pointers 有很强的互操作性。

例如：

```c
a[i]
```

很多时候可以理解成：

```c
*(a + i)
```

这带来一些好处：

* 表达简洁。
* 数组遍历可以直接用 pointer arithmetic。
* 适合底层系统编程。
* 函数传数组时可以自然退化为指针。

但也带来很多问题：

* 数组长度信息容易丢失。
* bounds checking 缺失。
* 容易越界访问。
* 指针和数组语义混在一起，初学者很难理解。
* 安全漏洞风险高。

C 的这种设计非常强大，也非常危险。

## Dangling references

Dangling reference 指向一个已经无效的对象或内存区域。

常见产生原因：

* 手动释放 heap 内存后，指针仍然指向原地址。
* 函数返回后，指针仍然指向已经销毁的局部变量。
* 对象生命周期结束后，引用还被保存下来。

例如：

```c
int* p = malloc(sizeof(int));
free(p);
// p is now dangling
```

此时 `p` 仍然保存着一个地址，但那块内存已经不属于它了。

Dangling reference 的问题很严重：

* 访问它可能导致程序崩溃。
* 原地址可能已经被分配给别的数据，修改它会破坏无关对象。
* 它可能成为安全漏洞。
* bug 通常不稳定，很难复现。

常见预防方式：

* C/C++ 中释放后把指针设为 `NULL`。
* 使用智能指针管理生命周期。
* 使用 ownership / borrowing 系统，比如 Rust。
* 使用 GC，让运行时避免释放仍可达对象。

## Garbage

Garbage 指 heap 上已经分配，但程序无法再访问的对象。

例如：

```java
x = new Object();
x = new Object();
```

第一行创建的对象，如果没有其他引用指向它，在第二行之后就变成 garbage。

它还占着内存，但程序已经无法使用它。

Garbage 的问题包括：

* 占用内存。
* 导致内存泄漏。
* 降低分配器效率。
* 最严重时导致程序耗尽内存。

## Dangling reference 和 Garbage 的区别

这两个问题方向相反。

Dangling reference 是：

```text
还有引用，但对象已经无效
```

Garbage 是：

```text
对象还存在，但已经没有引用
```

手动内存管理语言容易出现 dangling references，也容易出现 garbage。
带 GC 的语言通常能避免 dangling references，因为可达对象不会被回收，但仍然可能因为意外保留引用而造成 memory leak。

## Reference counting

Reference counting 是一种垃圾回收方法。每个对象记录当前有多少引用指向它。

当引用数变成 0 时，对象可以立即释放。

优点：

* 对象可以及时回收。
* 实现相对简单。
* 不需要长时间全局停顿。
* 回收时机比较可预测。

缺点：

* 每次引用赋值都要更新计数，有运行时开销。
* 每个对象需要额外存储 counter。
* 无法自动处理循环引用。

例如两个对象互相引用：

```text
A -> B
B -> A
```

如果外部已经无法访问 A 和 B，它们仍然互相让对方的 reference count 大于 0。这样就不会被回收。

## Tracing collection

Tracing collection 从一组 roots 开始，沿着引用关系找到所有可达对象。没有被找到的对象就是 garbage。

Roots 通常包括：

* stack 上的局部变量
* registers
* global variables
* runtime system 持有的引用

Tracing collection 的优点：

* 可以处理循环引用。
* 不需要每次赋值都更新计数。
* 能批量回收 garbage。
* 可以和 compaction 结合，减少内存碎片。

缺点：

* 回收不一定立即发生。
* 需要额外的运行时机制。
* 某些实现会造成 pause time。
* 通常需要更多可用 heap 空间。

## Mark-and-sweep

Mark-and-sweep 分成两个阶段：

1. Mark：从 roots 出发，标记所有可达对象。
2. Sweep：扫描 heap，回收未被标记的对象。

优点：

* 可以回收循环垃圾。
* 不需要移动对象。
* 实现相对直接。

缺点：

* 可能产生内存碎片。
* 需要扫描 heap。
* 分配大对象时可能因为碎片而失败。

## Stop-and-copy

Stop-and-copy 把 heap 分成两个区域。程序只在其中一个区域分配对象。GC 时，把所有存活对象复制到另一个区域，然后清空原区域。

优点：

* 回收后内存非常紧凑。
* 分配很快，通常只需要移动一个指针。
* 不会产生外部碎片。

缺点：

* 需要预留另一半空间。
* 存活对象多时复制成本高。
* 对象移动后需要更新引用。
* GC 时通常要暂停程序。

## Generational garbage collection

Generational GC 基于一个经验观察：

大多数对象很快死亡，少数对象会活很久。

所以 heap 被分成 young generation 和 old generation。

Young generation 中对象死亡率高，适合用 copying collection。因为大部分对象都死了，只需要复制少数存活对象。

Old generation 中对象已经活过多次 GC，比较稳定，通常不频繁移动，可以用 mark-and-sweep 或 mark-compact。

优点：

* 大部分时间只回收 young generation。
* 回收速度快。
* 符合真实程序的对象生命周期规律。

缺点：

* 实现复杂。
* 需要处理 young 到 old 的引用。
* 需要 write barrier 等额外机制。

## Conservative garbage collection

Conservative GC 指运行时不完全知道某个值到底是不是 pointer，于是保守地把"看起来像地址"的值当成 pointer 处理。

这常见于 C/C++ 这类没有完整运行时类型信息的语言。

优点：

* 可以给原本不支持 GC 的语言添加某种程度的自动回收。
* 不需要程序完全配合。

缺点：

* 可能误把普通整数当成指针。
* 某些垃圾可能无法回收。
* 通常不能随意移动对象，因为不知道所有引用在哪里。

Conservative GC 的原则是：宁愿少回收，也不要错误回收还可能被访问的对象。

## Copying collectors 对 cache performance 的影响

Copying collector 通常有利于 cache performance。

原因是它会把存活对象复制到连续区域，让相关对象在内存中更紧密。之后程序访问这些对象时，更容易命中 cache。

同时，copying collection 后的空闲空间也很连续，分配新对象时只需要 bump pointer，速度非常快。

但如果存活对象很多，复制成本会升高。对象移动也会导致引用更新成本。

## GC 的 time-space tradeoff

Garbage collection 里有明显的 time-space tradeoff。

### Heap size vs GC frequency

如果 heap 很大：

* GC 频率低。
* 程序大部分时间运行更顺。
* 但占用更多内存。
* 单次 GC 可能更重。

如果 heap 很小：

* GC 频率高。
* 内存占用低。
* 但 CPU 更多时间花在回收上。
* 程序可能频繁卡顿。

### Fragmentation vs Compaction

Mark-and-sweep 不移动对象，回收速度相对直接，但容易留下碎片。

Copying / compacting collectors 会移动对象，让内存更紧凑，但需要花时间复制对象和更新引用。

所以 GC 的设计一直在权衡：

```text
少占内存 / 少停顿 / 高吞吐 / 低碎片 / 实现简单
```

这些目标很难全部同时达到。

## 减少 GC pause time 的技术

常见方法包括：

* incremental GC：把一次大回收拆成很多小步骤。
* concurrent GC：让 GC 尽量和程序同时运行。
* generational GC：多数时候只回收 young generation。
* parallel GC：用多个线程一起做回收。
* region-based allocation：按区域批量释放。
* escape analysis：让某些对象分配在 stack 上，减少 heap 压力。
* tuning heap size：通过更大的 heap 减少 GC 频率。

不同语言和 runtime 会采用不同组合。

## Smart pointers

Smart pointer 是一种自动管理资源的指针对象。它看起来像 pointer，但会在生命周期结束时自动释放资源。

C++ 里常见的 smart pointers 包括：

```cpp
std::unique_ptr<T>
std::shared_ptr<T>
std::weak_ptr<T>
```

`unique_ptr` 表示独占所有权。对象只能有一个 owner。
`shared_ptr` 表示共享所有权，通过引用计数管理生命周期。
`weak_ptr` 用来观察对象但不增加引用计数，常用于打破循环引用。

Smart pointer 的作用是把手动 `delete` 转化为更安全的生命周期管理。

## 小结

Composite Types 这一章可以用几组问题串起来：

1. 多个字段放在一起时，内存布局如何决定？
2. 为什么 record 里会有 holes？
3. 为什么 packing 可以省空间，但可能损失性能？
4. Union 如何让多种类型共享同一块内存？
5. Variant records 如何把 tag 加入类型安全？
6. Array 是连续存储，还是 row-pointer 存储？
7. Slice 是复制数据，还是引用一段 view？
8. Pointer、address、reference 的区别是什么？
9. Recursive type 为什么通常需要 pointer 或 reference？
10. Dangling reference 和 garbage 分别是什么问题？
11. GC 如何在时间、空间、停顿、碎片之间做权衡？

这章的重点是看到语言抽象背后的内存现实。Record、array、slice、pointer、reference 看起来是语法概念，但它们都会落到对象如何分配、如何寻址、如何复制、如何比较、如何回收。Composite types 的设计，本质上是在表达能力、运行效率和内存安全之间做取舍。
