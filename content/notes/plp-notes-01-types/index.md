---
title: "01 类型系统"
date: 2026-04-21
tags: ["programming-languages"]
draft: false
---

类型系统这章的核心问题是：语言如何理解一段数据"是什么"，它能做什么操作，错误应该在什么时候被发现，以及代码如何在不同数据之间安全复用。

可以把 types 理解成编程语言里的约束系统。它一方面帮助程序员表达意图，另一方面帮助编译器或运行时发现不合理的操作。一个值如果被看成 `int`，它就可以参与整数运算；如果被看成 `string`，它就可以进行字符串拼接、索引、匹配等操作。同一段二进制数据，在不同类型解释下会有完全不同的意义。

## 类型的作用

类型在编程语言里主要有几类作用：

* 告诉编译器或运行时，一段数据应该如何被解释，比如 `int`、`float`、`string`、`bool`。
* 做安全检查，防止无效操作，比如让字符串除以数字，或者把一个不支持某方法的对象传给函数。
* 帮助决定内存分配和数据布局，比如一个 `int` 占多少字节，一个 record 如何对齐。
* 提供抽象，让程序员不必关心底层二进制细节，只需要关心值支持哪些操作。

所以类型不是单纯的标签。它同时影响语义、安全性、内存表示和程序结构。

## Strongly typed 和 Statically typed

`Strongly typed` 指语言会严格执行类型规则，限制不兼容类型之间的操作。比如如果一个函数需要 `Integer`，你不能随便传一个 `Boolean` 或 `String` 进去，除非语言明确允许某种转换。

`Statically typed` 指类型检查发生在编译期。程序运行之前，编译器就已经知道大多数表达式、变量和函数返回值的类型。

这两个概念不一样：

* Java：通常是 strongly typed + statically typed。
* Python：通常是 strongly typed + dynamically typed。
* C：statically typed，但不是非常 strong，因为它允许很多绕过类型系统的操作。
* JavaScript：dynamically typed，并且有很多隐式 coercion，类型规则比较宽松。

C 语言之所以很难被称为严格的 strongly typed，主要是因为它允许：

* pointer casts
* pointer arithmetic
* unsafe unions
* 把一种类型的内存用另一种类型解释

例如，C 里可以通过强制转换把 `int*` 当成 `float*` 使用。编译器会给出警告或允许你这么做，但这样已经绕过了类型系统本身。

## Type clash

`Type clash` 就是类型不匹配错误。比如函数需要一个 `Integer` 参数，但你传入了一个 `Boolean`；或者一个表达式要求左右两边类型兼容，但实际不兼容。

类型系统越早发现 type clash，程序越容易调试。静态类型语言通常在编译期发现，动态类型语言通常在运行期发现。

## 三种理解类型的方式

类型可以从三个角度理解：denotational、structural、abstraction-based。

### Denotational view

Denotational view 把类型理解成一组值的集合。

例如：

* `bool = {true, false}`
* `int` 是某个整数范围内的值集合
* 一个 enum 类型也是有限值集合

这种观点强调：一个值属于某个集合，所以它属于某个类型。

### Structural view

Structural view 关注类型的内部结构。两个类型如果结构一致，就可以被视为相同或兼容。

比如两个 record 都有：

```ts
{
  name: string
  age: number
}
```

那么在结构类型系统里，它们可能被认为是同一种形状的对象。TypeScript 就很接近这种思路。

### Abstraction-based view

Abstraction-based view 关注一个类型暴露了什么操作，而不是它内部如何实现。

比如一个 stack 类型真正重要的可能不是内部到底用 array 还是 linked list，而是它支持：

* `push`
* `pop`
* `top`
* `isEmpty`

只要外部能通过这些操作正确使用它，它就可以被看作某种 stack abstraction。

这个角度和 ADT、interface、module 都关系很大。

## Orthogonality

一组语言特性具有 `orthogonality`，意味着这些特性可以相对独立地组合，彼此之间没有太多特殊限制。

比如一个语言如果同时支持 arrays 和 pointers，并且这两个特性足够正交，那么它应该自然支持：

* array of pointers
* pointer to array
* pointer to pointer
* array of arrays

正交性的好处是语言规则更统一，程序员不需要记很多特殊情况。缺点是组合过多时，语言可能变得复杂，甚至产生一些难以理解的边缘行为。

## Aggregates

`Aggregates` 是把多个数据项组合在一起形成的新类型。常见例子包括：

* array
* record / struct
* tuple
* object

它们让语言可以表达更复杂的数据结构。比如 `Point` 可以由两个数字组成，`Student` 可以由姓名、ID、成绩等字段组成。

## Option types

`Option type` 用来表达"可能有值，也可能没有值"。

典型形式是：

```rust
Option<T> = Some(T) | None
```

它的作用是把"空值"显式放进类型系统，而不是让 `null` 到处传播。这样编译器可以强制程序员处理不存在的情况，减少空指针错误。

比如一个查找函数可以返回：

```rust
Some(value)
```

或者：

```rust
None
```

调用者必须处理这两种情况。

## Polymorphism

`Polymorphism` 指同一段代码、同一个接口，能够作用于多种类型。

最常见的几种形式是：

* parametric polymorphism
* subtype polymorphism
* ad hoc polymorphism
* duck typing

### Parametric polymorphism

Parametric polymorphism 指写代码时不指定具体类型，而是用类型参数表示。

例如：

```java
List<T>
```

这里的 `T` 可以是 `String`、`Integer`、`User` 等。函数或数据结构的逻辑对不同类型保持一致。

Generics 通常就是 parametric polymorphism 在具体语言里的实现。它的主要价值是：在复用代码的同时保留类型安全。

### Subtype polymorphism

Subtype polymorphism 指一个子类型可以出现在需要父类型的地方。

例如，如果 `Student` 是 `Person` 的子类型，那么一个需要 `Person` 的函数也可以接收 `Student`。

这类多态通常和继承、interface、dynamic dispatch 有关。

### Ad hoc polymorphism

Overloading 是典型的 ad hoc polymorphism。

例如：

```java
add(int a, int b)
add(double a, double b)
add(String a, String b)
```

它们名字一样，但实际可能是不同实现。它被称为 ad hoc，是因为这种多态是针对特定类型组合分别定义的，而不是通过一个统一的类型参数自动得到。

## Generics 和 Overloading 的区别

Generics 是为多种类型写一份逻辑。

Overloading 是为不同类型写多份逻辑，只是共用同一个名字。

例如，generic function 更像：

```java
T identity(T x) {
    return x;
}
```

它对任何 `T` 都做同一件事。

Overloading 更像：

```java
print(int x)
print(String x)
print(User x)
```

它们名字相同，但函数体可以完全不同。

## Type equivalence 和 Type compatibility

`Type equivalence` 关心两个类型是否被语言视为同一个类型。

`Type compatibility` 关心两个类型能否在某些上下文中一起使用。

这两个概念不能混在一起。

比如两个类型不一定 equivalent，但可能 compatible。一个 `int` 和一个 `float` 不是同一个类型，但某些语言允许把 `int` 隐式转换成 `float`。这就是 compatibility，而不是 equivalence。

### Structural equivalence

Structural equivalence 按内部结构判断类型是否等价。只要字段、字段类型、顺序等结构一致，就可能被认为是同一类型。

优点：

* 灵活
* 减少重复声明
* 适合描述"只要形状对就可以使用"的场景

例子：

* TypeScript 的对象类型
* OCaml 的部分 object 类型
* Go 的 interface satisfaction 更接近结构化思想

### Name equivalence

Name equivalence 按名字判断类型是否等价。即使两个类型结构一样，只要名字不同，也可能被视为不同类型。

优点：

* 更安全
* 更能表达程序员意图
* 可以防止结构相同但语义不同的类型被误用

比如：

```c
type UserId = int
type ProductId = int
```

从结构看它们都是整数，但语义完全不同。Name equivalence 可以避免把 `UserId` 当成 `ProductId` 使用。

常见例子：

* Java 的 class 类型
* C++ 的 class / struct 类型
* Ada 的类型系统

## Strict name equivalence 和 Loose name equivalence

`Strict name equivalence` 指新的类型定义会创建一个全新的、不兼容的类型。即使底层结构一样，也不等价。

`Loose name equivalence` 指类型别名只是给已有类型起了一个新名字，两者仍然等价。

简单说：

```text
strict: 新名字 = 新类型
loose: 新名字 = 原类型的别名
```

两者的区别在于：语言到底把这个声明看成"定义新类型"，还是"定义别名"。

## Type conversion、Type coercion 和 Nonconverting casts

`Type conversion` 是显式类型转换。程序员明确写出转换操作，转换过程中可能改变底层表示。

例如：

```c
(float) x
```

`Type coercion` 是隐式类型转换。程序员没有显式写转换，但编译器或运行时自动完成。

例如：

```c
int x = 1;
double y = x;
```

这里 `int` 可能被自动转换成 `double`。

`Nonconverting type cast` 不改变底层 bits，只是改变解释方式。它把同一段内存当成另一种类型来看。这类操作风险更高，因为它绕过了正常的类型语义。

## Coercion 的支持与反对

支持 coercion 的理由：

* 减少冗余代码
* 写起来更方便
* 有些转换符合直觉，比如 `int` 到 `float`

反对 coercion 的理由：

* 可能隐藏 bug
* 可能导致精度丢失
* 代码可读性下降
* 程序行为变得难以预测

弱类型语言里的很多奇怪行为都和 coercion 有关。比如 JavaScript 的 `==` 会触发隐式转换，所以 `"0" == 0` 会得到 `true`。这类规则有时方便，但也容易让 equality 的意义变得模糊。

## 什么时候 Type conversion 需要 run-time check

当编译期无法确定转换一定安全时，就需要 run-time check。

常见情况包括：

* narrowing conversion
* downcasting
* subrange / refinement checks

### Narrowing conversion

比如从范围更大的类型转成范围更小的类型：

```text
float -> int
long -> short
```

这可能导致溢出、截断或精度丢失，所以语言可能需要检查。

### Downcasting

比如把父类引用转成子类引用：

```java
Object x = "hello";
String s = (String) x;
```

编译器只知道 `x` 的静态类型是 `Object`，真正的对象类型要在运行期确认。

### Subrange checks

如果语言支持范围类型，例如：

```text
1..100
```

那么把普通整数赋给这个类型时，需要检查值是否真的在范围内。

## Type inference

`Type inference` 指语言根据上下文自动推断类型，程序员不需要显式写出所有类型。

它常见于：

* 变量初始化
* 函数返回值
* 泛型函数调用
* lambda / closure

例如：

```rust
let x = 3;
```

编译器可以推断 `x` 是整数类型。

Type inference 的目标不是取消类型系统，而是减少重复标注。类型仍然存在，只是由编译器推出来。

## Explicit 和 Implicit parametric polymorphism

`Explicit parametric polymorphism` 要求程序员显式写出类型参数。

例如：

```java
List<String>
```

好处是清晰、可控，读代码时容易知道类型是什么。

`Implicit parametric polymorphism` 则通过 type inference 自动推出类型参数。程序员不需要写 `<T>`，编译器根据表达式的使用方式推断。

好处是代码更简洁，也更接近数学表达。

## Hindley-Milner type inference

Hindley-Milner type inference 的核心过程可以理解成三步：

1. 给未知类型创建类型变量。
2. 根据表达式结构收集类型约束。
3. 用 unification 解这些约束，并在合适的位置泛化未被具体化的类型变量。

例如：

```ml
fun x -> x
```

这里 `x` 没有被用于任何具体操作，所以编译器没有理由把它限制成 `int`、`string` 或其他具体类型。它会被推断成：

```text
'a -> 'a
```

意思是：接收某个类型的值，返回同一个类型的值。

这就是 ML 的 type inference 可以自然导出 polymorphism 的原因。没有被约束成具体类型的变量，会在 `let` 绑定等位置被 generalize 成泛型类型。

## Duck typing

Duck typing 的直觉是：

> 如果它走起来像鸭子，叫起来像鸭子，那它就可以被当成鸭子使用。

它不关心对象声明的类型，也不要求显式继承某个 interface。它只关心对象在运行时是否真的支持需要的操作。

例如，一个函数调用：

```python
x.quack()
```

只要 `x` 有 `quack` 方法，这个调用就可以继续。至于 `x` 的 class 名字是什么，并不重要。

Duck typing 主要出现在动态语言中，比如：

* Python
* Ruby
* JavaScript

Go 和 TypeScript 也有类似"只要结构满足就可以使用"的思想，但它们更适合称为 structural typing 或 static duck typing，因为检查可以发生在编译期。

## Equality testing 为什么微妙

Equality 看起来只是问：

```text
a 是否等于 b？
```

但真正的问题是：你到底想比较什么？

| 维度   | 问题                | 例子                           |
| ---- | ----------------- | ---------------------------- |
| 引用相等 | 是否是同一块内存？         | Java 里的 `==` 比较对象引用          |
| 结构相等 | 内容是否相同？           | Java 里的 `.equals()`          |
| 语义相等 | 数学意义上是否等价？        | `{1,2,3}` 和 `{3,2,1}` 作为集合相等 |
| 浮点精度 | 计算误差是否影响结果？       | `0.1 + 0.2 != 0.3`           |
| 隐式转换 | 比较前是否发生 coercion？ | JS 里 `"0" == 0` 为 `true`     |

所以 equality testing 微妙的地方在于：不同语言、不同类型、不同运算符，可能在回答完全不同的问题。

一个对象可以和另一个对象：

* 地址相同
* 内容相同
* 语义相同
* 经过转换后相同
* 在某个容忍误差范围内相同

这些都可能被叫作"相等"，但它们不是同一种相等。

## Deep comparison 和 Shallow comparison

`Shallow comparison` 只比较第一层。

如果是数字、布尔值、字符串这类简单值，通常直接比较值本身。如果是对象或数组，shallow comparison 很可能只比较引用，也就是是否指向同一个内存地址。

`Deep comparison` 会递归比较内部内容。

例如两个对象：

```js
{ name: "Aki", tags: ["PL", "compiler"] }
```

如果它们地址不同，但每一层字段和值都相同，deep comparison 会认为它们相等。

## Deep assignment 和 Shallow assignment

`Shallow assignment` 通常只是复制引用。两个变量指向同一个对象。

结果是：通过其中一个变量修改对象，另一个变量也能看到变化。

`Deep assignment` 会递归复制整个对象结构。复制之后，新对象和原对象在内存中独立存在。

所以：

* shallow copy：快、省内存，但容易产生共享状态
* deep copy：更安全，但成本更高

这和 equality 一样，表面上只是"复制"，实际要问的是：复制的是引用，还是整个对象图？

## 小结

Types 这一章可以用几个问题串起来：

1. 一个值属于什么类型？
2. 这个类型允许什么操作？
3. 类型错误在编译期发现，还是运行期发现？
4. 两个类型什么时候算相同？
5. 两个类型什么时候可以一起使用？
6. 类型转换是显式的、隐式的，还是只改变解释方式？
7. 一段代码如何安全地复用于多种类型？
8. "相等"到底是在比较地址、结构、语义，还是转换后的结果？

类型系统的本质是语言设计中的边界管理。它把某些操作定义为合法，把另一些操作定义为错误；它可以让程序更安全，也可能让语言更复杂。理解类型系统，不只是记住 `int`、`float`、`string`，而是理解语言如何用规则组织值、操作和抽象。
