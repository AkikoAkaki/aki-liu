---
title: "05 函数式语言"
date: 2026-04-25
tags: ["programming-languages"]
draft: false
---

Functional languages 这一章的核心问题是：如果把"函数"当成语言的中心，而不是把"状态修改"当成程序的中心，编程语言会变成什么样。

在 imperative programming 里，程序通常被理解成一系列命令：

```text
改变变量
更新状态
执行循环
修改对象
```

Functional programming 更关注表达式、函数组合、值的变换和引用透明性。它关心的是：

* 函数能否像普通值一样被传递
* 数据是否可以保持不可变
* 表达式是否可以被它的值替换
* 求值顺序是否影响结果
* 函数调用能否被缓存
* 代码本身能否作为数据处理

这一章不只是介绍 Lisp、Scheme、ML、Haskell 这些语言，也是在讨论一种不同的程序组织方式。

## Lambda calculus

Functional programming 的基础数学形式体系是 lambda calculus。

Lambda calculus 用非常小的一组规则表达计算：

* 变量
* 函数抽象
* 函数应用

例如：

```text
λx. x + 1
```

表示一个接收 `x` 并返回 `x + 1` 的函数。

函数应用则是：

```text
(λx. x + 1) 3
```

结果是：

```text
4
```

Lambda calculus 的重要性在于：它说明"函数定义"和"函数调用"本身就足以表达计算。很多 functional language 的核心语义都可以追溯到这个模型。

## Functional programming 的显著特征

Functional programming languages 通常有一些共同特征，但不是每一种语言都全部具备。

常见特征包括：

* 函数是 first-class values。
* 倾向使用 pure functions。
* 倾向使用 immutable data。
* 强调 referential transparency。
* 通过表达式组合描述计算。
* 常用 recursion 和 higher-order functions 代替显式循环。
* 一些语言支持 lazy evaluation，比如 Haskell。
* 一些语言有强大的 type inference，比如 ML、OCaml、Haskell。

要注意：不是所有函数式语言都是 lazy 的。Scheme、ML、OCaml、F# 等很多语言默认都是 eager evaluation。
也不是所有函数式语言都完全没有状态修改。很多语言允许 mutation，只是函数式风格会尽量减少或隔离它。

## First-class value

`First-class value` 指一个值可以像普通数据一样被使用。

如果函数是 first-class value，就意味着函数可以：

* 赋值给变量
* 作为参数传给另一个函数
* 作为返回值返回
* 存进数据结构
* 在运行时创建

例如 JavaScript：

```js
const addOne = x => x + 1;

function apply(f, x) {
    return f(x);
}

apply(addOne, 3);
```

这里 `addOne` 是一个函数，但它像普通值一样被传给 `apply`。

First-class functions 是 functional programming 的基础。没有它，就很难自然地写 higher-order functions、callbacks、map/filter/reduce 这类结构。

## Higher-order functions

如果一个函数接收函数作为参数，或者返回一个函数，它就是 higher-order function。

例如：

```js
const numbers = [1, 2, 3];

numbers.map(x => x + 1);
```

`map` 接收一个函数，然后把这个函数应用到数组里的每个元素。

Higher-order functions 的意义是：程序可以把"行为"当作值传递。

这让很多重复模式可以被抽象出来：

* 遍历
* 过滤
* 聚合
* 回调
* 策略选择
* 延迟执行

例如：

```js
numbers.filter(x => x > 1)
       .map(x => x * 2)
       .reduce((a, b) => a + b, 0);
```

这段代码关心的是数据如何变换，而不是手动写循环和更新临时变量。

## Pure functions

Pure function 指满足两个条件的函数：

1. 相同输入永远得到相同输出。
2. 没有 side effects。

例如：

```text
f(x) = x + 1
```

这是 pure function。只要输入是 `3`，输出永远是 `4`。

但下面这种函数不是 pure：

```js
let counter = 0;

function next() {
    counter += 1;
    return counter;
}
```

它依赖并修改外部状态。即使没有参数，多次调用结果也不同。

Pure functions 的好处是：

* 容易测试。
* 容易推理。
* 容易缓存。
* 更适合并发。
* 编译器更容易优化。

但现实程序必须处理 I/O、时间、随机数、网络、数据库等副作用。所以函数式语言通常不是完全消灭副作用，而是用类型系统、monad、effect system、runtime convention 等方式管理副作用。

## Immutability

Functional programming 通常偏好 immutable data，也就是数据一旦创建，就不再被修改。

例如，如果想"修改"一个 list，通常不是原地改它，而是创建一个新 list。

```text
old list -> new list
```

Immutability 的好处包括：

* 不容易出现共享可变状态 bug。
* 多线程读取更安全。
* 更容易做持久化数据结构。
* 更容易理解某个值在程序中的含义。
* 函数调用之间不会偷偷改变同一个对象。

它的代价是：如果实现不好，可能产生大量复制。
所以函数式语言通常会用 persistent data structures，通过结构共享减少复制成本。

## Referential transparency

`Referential transparency` 指一个表达式可以被它的计算结果替换，而不改变程序行为。

例如：

```text
2 + 3
```

可以替换成：

```text
5
```

程序行为不变。

如果函数是 pure 的，那么函数调用也可以替换成它的结果。

例如：

```text
square(3)
```

如果 `square` 是 pure function，就可以替换为：

```text
9
```

Referential transparency 的好处是程序更容易推理。你不需要担心这个表达式背后是否修改了全局变量、写了文件、发了网络请求或依赖当前时间。

这也是 functional programming 让程序更接近数学表达的原因之一。

## Lisp / Scheme 的 REPL

Lisp 和 Scheme 很早就强调 interactive development。REPL 是 read-eval-print loop。

它做四件事：

1. Read：读取用户输入的表达式。
2. Eval：求值这个表达式。
3. Print：打印求值结果。
4. Loop：回到第一步，继续等待输入。

例如：

```scheme
> (+ 1 2)
3
```

REPL 让程序员可以逐步测试表达式、函数和数据结构。它对探索式编程、教学和调试都很有帮助。

## Scheme 中 let、let* 和 letrec

Scheme 中的 `let`、`let*` 和 `letrec` 都用于局部绑定，但绑定规则不同。

### let

`let` 是 parallel binding。多个变量的初始值在同一外层环境中计算，彼此之间看不到对方的新绑定。

例如：

```scheme
(let ((x 1)
      (y 2))
  (+ x y))
```

这里 `x` 和 `y` 同时被绑定。

如果写：

```scheme
(let ((x 1)
      (y x))
  y)
```

这里 `y` 的初始化表达式里的 `x` 不会引用同一个 `let` 里新绑定的 `x`，而是去外层环境找。

### let*

`let*` 是 sequential binding。变量按顺序绑定，后面的绑定可以看到前面的绑定。

例如：

```scheme
(let* ((x 1)
       (y x))
  y)
```

这里 `y` 可以看到前面刚绑定的 `x`，所以结果是 `1`。

### letrec

`letrec` 用于 recursive binding。它允许绑定之间互相引用，常用于定义递归函数或互递归函数。

例如：

```scheme
(letrec ((fact
          (lambda (n)
            (if (= n 0)
                1
                (* n (fact (- n 1)))))))
  (fact 5))
```

`fact` 在自己的函数体中可以引用自己。

简单比较：

```text
let    = parallel binding
let*   = sequential binding
letrec = recursive binding
```

## eq?、eqv? 和 equal?

Scheme 中的 equality 也分层次。

### eq?

`eq?` 通常用于判断两个对象是否是同一个对象，也就是 identity / pointer-level equality。

它接近"是否指向同一个东西"。

例如，对于 symbols，`eq?` 通常很有用：

```scheme
(eq? 'a 'a)
```

### eqv?

`eqv?` 比 `eq?` 更适合比较一些基本值，比如数字和字符。

它大致判断两个值是否表示同一个简单值。比如相同数值的数字、相同字符，通常用 `eqv?` 更合理。

### equal?

`equal?` 更偏 structural equality。它会递归比较复合结构的内容。

例如两个 list 内容一样，即使不是同一个对象，`equal?` 也可能认为它们相等。

可以粗略记：

```text
eq?     = identity
eqv?    = identity + simple value equality
equal?  = structural equality
```

## Scheme 如何偏离纯函数式模型

Scheme 是函数式语言，但它不是纯函数式语言。它允许一些偏离 purely functional model 的操作。

常见包括：

* mutation，例如 `set!`
* mutable pairs 或 vectors
* I/O 操作
* assignment
* continuation 相关控制流
* interaction with external state

例如：

```scheme
(define x 1)
(set! x 2)
```

这就修改了已有绑定的值。

Scheme 的特点是：它支持函数式编程，但不强制所有程序都保持纯函数式。

## Homoiconicity

`Homoiconic` 指代码和数据使用同一种结构表示。

Lisp 是最经典的例子。Lisp 程序本身就是 list 结构。

例如表达式：

```scheme
(+ 1 2)
```

既是一段代码，也可以被当成 list 数据：

```scheme
'(+ 1 2)
```

因为代码就是数据，程序可以很自然地生成、修改、分析另一段程序。

这让 Lisp 的 macro system 非常强大。

Homoiconicity 的意义是：

* 程序可以操作程序。
* macro 更自然。
* 元编程能力强。
* 语言语法和 AST 之间距离很近。

## S-expression

S-expression 是 symbolic expression 的缩写，是 Lisp 代码和数据的基本表示形式。

S-expression 可以是 atom，也可以是 list。

Atom 例子：

```scheme
x
42
"hello"
```

List 例子：

```scheme
(+ 1 2)
(define x 3)
(lambda (x) (+ x 1))
```

Lisp 程序基本上由 S-expressions 构成。
这也是 Lisp 代码看起来有很多括号的原因：括号直接表示树结构。

## eval 和 apply

`eval` 和 `apply` 是理解 Lisp / Scheme 求值模型的重要概念。

### eval

`eval` 接收一个表达式，并在某个环境中对它求值。

它回答的是：

```text
这个表达式的值是什么？
```

例如：

```scheme
(eval '(+ 1 2))
```

会得到：

```text
3
```

### apply

`apply` 接收一个函数和一组参数，把函数应用到这些参数上。

它回答的是：

```text
把这个函数作用于这些参数，会得到什么？
```

例如：

```scheme
(apply + '(1 2 3))
```

会得到：

```text
6
```

简单说：

```text
eval  = 求一个表达式的值
apply = 调用一个函数，并传入参数
```

## Function 和 special form

在 Scheme 中，普通 function 调用通常会先求值所有参数，再把结果传给函数。

例如：

```scheme
(+ 1 2)
```

`1` 和 `2` 会被求值，然后传给 `+`。

但 special form 有自己的求值规则。它不会简单地先求值所有参数。

例如：

```scheme
(if condition then-expr else-expr)
```

`if` 只会根据 condition 的结果求值其中一个分支。如果它是普通函数，那么 then 和 else 都会先被求值，这就不符合条件表达式的语义。

常见 special forms 包括：

* `if`
* `define`
* `lambda`
* `quote`
* `set!`
* `let`

Special form 的意义是让语言可以定义特殊控制结构和绑定结构。

## Normal-order evaluation 和 Applicative-order evaluation

求值策略决定函数参数什么时候被计算。

### Applicative-order evaluation

Applicative-order evaluation 也叫 eager evaluation。它会先计算所有 actual parameters，然后再调用函数。

大多数主流语言默认使用这种策略，比如 C、Java、Python、JavaScript、Scheme。

例如：

```text
f(g(), h())
```

在 applicative-order 中，会先计算 `g()` 和 `h()`，再调用 `f`。

优点：

* 行为直接。
* 实现相对简单。
* 性能较可预测。
* 和副作用语言更容易结合。

缺点：

* 即使某个参数在函数体内没有用到，也会被计算。
* 可能无法表达某些短路或无限结构。

### Normal-order evaluation

Normal-order evaluation 会把参数表达式传入函数，只有在真正需要时才求值。

例如：

```text
f(expensive())
```

如果 `f` 从来没用到这个参数，那么 `expensive()` 就不会被执行。

优点：

* 可以避免不必要计算。
* 可以处理某些无限数据结构。
* 更接近按需求值的数学模型。

缺点：

* 如果同一个参数被使用多次，表达式可能被重复计算。
* 实现更复杂。
* 和副作用结合时更难理解。

## Lazy evaluation

Lazy evaluation 可以看作 normal-order evaluation 的改进：参数只在第一次被需要时计算，并把结果缓存起来。之后再次使用同一个参数，就直接使用缓存结果。

所以 lazy evaluation 的特点是：

```text
need it -> compute once -> remember it
```

它和 normal-order 的关键区别在于是否缓存结果。

Lazy evaluation 的优点：

* 避免不必要计算。
* 支持无限数据结构。
* 可以写出更组合式的数据流代码。
* 同一个表达式不会被重复计算。

缺点：

* 求值时间不直观。
* 空间使用不容易预测。
* 可能产生 thunk 堆积。
* 调试性能问题更困难。

Haskell 是典型的 lazy functional language。很多其他函数式语言默认 eager，但也可以通过 lazy constructs 或 thunk 实现延迟求值。

## Strict function

一个 function 是 `strict`，意思是：如果它的参数无法产生值，那么函数本身也无法产生值。

更形式化地说，如果参数是 bottom，也就是不终止或出错，那么 strict function 的结果也是 bottom。

简单理解：

```text
strict function 需要先得到参数值，才能得到自己的结果
```

比如普通加法是 strict 的：

```text
x + 1
```

如果 `x` 本身是一个不会结束的计算，那么 `x + 1` 也不会结束。

但 `if` 这样的结构不是对所有分支 strict。它只需要 condition，然后只求值被选中的分支。

这就是为什么 `if` 通常是 special form，而不是普通函数。

## Memoization

`Memoization` 指缓存函数调用的结果，避免重复计算。

如果一个函数是 pure 的，那么同样输入永远得到同样输出。这样就可以安全地缓存：

```text
f(x) 计算一次
之后再遇到 f(x)，直接返回缓存结果
```

例如 Fibonacci 递归如果不缓存，会重复计算大量子问题：

```text
fib(5)
= fib(4) + fib(3)
= fib(3) + fib(2) + fib(2) + fib(1)
...
```

Memoization 可以把这些重复调用缓存起来，大幅提高性能。

它的机制是：

1. 检查参数是否已经在 cache 中。
2. 如果有，直接返回缓存结果。
3. 如果没有，计算结果。
4. 把结果存进 cache。
5. 返回结果。

Memoization 的限制是：

* 需要额外内存。
* 参数必须能作为 key。
* 对有副作用的函数不安全。
* 缓存策略需要控制，否则可能无限增长。

## Functional programming 和 Concurrency

Pure functional languages 对并发特别有吸引力，原因是它们减少了共享可变状态。

并发程序最难处理的问题之一是：

```text
多个线程同时读写同一块共享数据
```

如果数据不可变，很多 race condition 就不会出现。多个线程可以安全地共享同一个值，因为没有线程会原地修改它。

Pure functions 也更容易并行化。因为函数调用不依赖隐藏状态，编译器或 runtime 更容易判断哪些计算可以同时进行。

当然，真实程序仍然需要 I/O 和外部状态。但函数式语言可以把 effect 集中管理，让纯计算部分更容易并发执行。

## Functional programming 的取舍

Functional programming 的优势很明显：

* 程序更容易推理。
* 状态变化更少。
* 测试更方便。
* 并发更安全。
* 抽象能力很强。
* higher-order functions 让重复控制结构可以被封装。

但它也有代价：

* 对初学者来说思维方式不直观。
* 性能模型有时不明显，尤其是 lazy evaluation。
* 过度抽象可能降低可读性。
* 与底层系统、可变状态、I/O 交互时需要额外机制。
* 某些场景下会产生额外 allocation。

所以 functional programming 的价值不是把所有程序都写成数学公式，而是提供一种更容易控制状态和组合逻辑的方式。

## 小结

Functional Languages 这一章可以用几组问题串起来：

1. 如果函数是一等值，程序结构会发生什么变化？
2. Pure function 为什么更容易测试、缓存和并发？
3. Immutability 如何减少共享状态带来的问题？
4. Referential transparency 为什么让程序更容易推理？
5. Lisp / Scheme 为什么能把代码当数据处理？
6. `let`、`let*`、`letrec` 的绑定规则有什么区别？
7. `eq?`、`eqv?`、`equal?` 分别在比较什么？
8. `eval` 和 `apply` 分别代表求值模型中的哪一步？
9. Eager、normal-order、lazy evaluation 的区别是什么？
10. Strictness 如何描述函数对参数求值的依赖？
11. Memoization 为什么依赖 pure function 的性质？

Functional programming 的重点是把计算理解成值和函数的组合，而不是一连串状态修改。它通过 first-class functions、immutability、referential transparency 和 controlled effects，让程序更容易推理和组合。它也提醒我们：语言设计不只有命令式的一条路，计算可以围绕表达式、函数和求值策略来组织。
