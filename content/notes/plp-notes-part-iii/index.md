---
hidden: true
title: "PLP 3：面向对象与函数式语言"
date: 2026-04-24
tags: ["programming-languages"]
draft: false
---

Object orientation 这一章的核心问题是：语言如何把数据和操作绑定在一起，以及如何让同一段代码在运行时根据对象的真实类型执行不同逻辑。

OOP 表面上是 class、object、inheritance、method 这些语法。更底层一点看，它关心的是几件事：

* 如何封装状态
* 如何隐藏实现细节
* 如何复用已有代码
* 如何通过父类型引用子类型对象
* 如何在运行时决定调用哪个方法
* 如何初始化和销毁对象
* 如何实现 interface、abstract class、dynamic dispatch 和 vtable

所以这一章不是单纯的"面向对象编程思想"，而是对象模型如何被语言和运行时实现。

## OOP 的三个定义特征

通常认为 object-oriented programming 有三个核心特征：

* Encapsulation
* Inheritance
* Polymorphism

### Encapsulation

Encapsulation 指把数据和操作这些数据的代码绑定在一起，形成 object。

对象内部可以有自己的状态，比如字段、属性、成员变量。对象对外暴露一组方法，外部通过这些方法操作对象，而不是直接随意改内部状态。

它的作用包括：

* 隐藏实现细节。
* 降低模块之间的耦合。
* 防止外部代码破坏对象内部不变式。
* 让对象可以在不改变外部接口的情况下修改内部实现。

例如一个 `Stack` 对象对外暴露 `push` 和 `pop`，但内部到底用 array 还是 linked list，可以被隐藏起来。

### Inheritance

Inheritance 指一个 class 可以继承另一个 class 的属性和方法，并在此基础上扩展或修改行为。

例如：

```java
class Student extends Person {
    ...
}
```

`Student` 可以复用 `Person` 的字段和方法，也可以新增自己的逻辑。

Inheritance 的作用包括：

* 代码复用。
* 表达 is-a 关系。
* 支持 subtype polymorphism。
* 让框架可以写父类逻辑，子类提供具体实现。

Inheritance 也有代价。层级过深时，代码行为可能变得难以追踪；父类修改也可能影响大量子类。

### Polymorphism

Polymorphism 指同一个接口可以对应多种实现。

例如一个函数接收 `Shape`：

```java
void draw(Shape s) {
    s.draw();
}
```

实际传入的可能是 `Circle`、`Rectangle`、`Triangle`。调用者不需要知道具体类型，只需要知道它们都能 `draw()`。

这让程序可以面向接口或抽象类型编程，从而减少对具体实现的依赖。

## Abstraction 的好处

Abstraction 是 OOP 的基础之一。它的价值不只是"隐藏复杂性"，还包括：

* 降低认知负荷。程序员不需要每次都关心所有内部细节。
* 实现模块化和解耦。不同模块可以通过接口协作。
* 提高可维护性。内部实现改变时，外部代码不一定需要改变。
* 增强扩展性。新的具体类型可以接入已有抽象。
* 保护对象不变式。对象可以控制外部如何修改自己的状态。

好的 abstraction 让程序员思考"这个对象能做什么"，而不是"它内部每一步怎么做"。

## Member: data member 和 subroutine member

在 OOP 里，class 里的成员通常分成两类：

* Data member：更常见的名字是 field、attribute、instance variable、member variable。
* Subroutine member：更常见的名字是 method、member function。

例如：

```java
class Person {
    String name;       // data member / field

    void speak() {     // method
        ...
    }
}
```

对象把 data members 和 methods 放在同一个抽象单位里，这就是 OOP 封装的基本形式。

## Interface 中 private 部分的目的

有些语言或模块系统允许 interface 中有 private 部分。它的目的不是让外部用户直接使用，而是让编译器、链接器或子类知道对象需要哪些内部信息。

private 部分不能被完全隐藏，原因是实现和编译可能需要知道：

* 对象大小。
* 字段布局。
* private method 的存在。
* 子类继承时的布局要求。
* ABI 兼容性。

从外部使用者角度看，private 部分不可访问。
从语言实现角度看，它仍可能影响对象布局、编译和链接。

## `super` 和 C++ 的 `::`

Java 中的 `super` 用来引用父类版本的字段、方法或 constructor。

例如：

```java
super.toString();
```

它表示调用 superclass 中的 `toString`，而不是当前 class override 后的版本。

C++ 中的 `::` scope resolution operator 也可以用来指定某个 class 作用域里的成员：

```cpp
Base::foo();
```

两者都可以用于消除"当前类和父类都有同名成员"时的歧义。

## 为什么 inline subroutines 在 OOP 中重要

OOP 鼓励使用方法调用来保护抽象边界。比如用 getter/setter 访问字段，用小方法表达对象行为。

但如果每次访问都真的产生函数调用开销，性能会受到影响。

Inline subroutines 对 OOP 特别重要，原因有几个：

第一，很多方法很短。

例如：

```java
int getX() {
    return x;
}
```

如果这种方法频繁调用，调用开销可能比方法本身还大。Inline 可以消除这部分成本。

第二，inline 让编译器看到更多上下文。

方法被展开到调用点之后，编译器可以进一步做 constant propagation、dead code elimination、escape analysis 等优化。

第三，OOP 中的 dynamic dispatch 会阻碍优化。

如果编译器能证明某个虚方法调用的具体目标，它就可以 devirtualize，把动态调用变成直接调用，然后进一步 inline。

所以 inline 是让 OOP 抽象成本变低的重要优化手段。

## Constructors 和 Destructors

`Constructor` 是对象创建时自动执行的初始化逻辑。

它通常负责：

* 初始化字段。
* 建立对象不变式。
* 申请资源。
* 调用父类 constructor。
* 初始化成员对象。

Constructor 可以 overload，也就是同一个 class 可以有多个不同参数列表的 constructor。但它通常不是 virtual method 意义上的 dynamic dispatch。

例如 C++ / Java 里：

```java
class Person {
    Person() { ... }
    Person(String name) { ... }
}
```

这叫 constructor overloading。

`Destructor` 是对象生命周期结束时执行的清理逻辑。C++ 中用：

```cpp
~ClassName()
```

Destructor 通常负责：

* 释放资源。
* 关闭文件。
* 释放锁。
* 断开连接。
* 清理手动分配的内存。

C++ 特别依赖 destructor，因为它有 RAII。资源的生命周期和对象生命周期绑定在一起。对象离开作用域时，destructor 自动运行。

GC 语言里，内存通常由垃圾回收器释放，所以 destructor 的重要性相对降低。但文件、socket、锁这类非内存资源仍然需要显式关闭或用类似 `try-with-resources` / `using` 的机制处理。

## Subclass 和 Superclass 的其他术语

`Subclass` 也常被叫作：

* derived class
* child class
* subtype

`Superclass` 也常被叫作：

* base class
* parent class
* supertype

这些词在不同语言和语境里略有差别，但大体都在描述继承或子类型关系。

## 为什么有 inheritance 之后还需要 generics

Inheritance 提供 subtype polymorphism。Generics 提供 parametric polymorphism。

二者解决的问题不同。

如果用 inheritance 表达容器类型，比如：

```java
List<Object>
```

那么所有元素都被当成 `Object`，取出来时需要 cast，类型信息丢失，容易出错。

Generics 可以表达：

```java
List<String>
List<Integer>
List<User>
```

这样同一个 `List<T>` 逻辑可以用于不同类型，同时保留编译期类型安全。

所以 generics 的价值是：

* 避免重复代码。
* 保留具体元素类型。
* 减少 downcast。
* 提供更强的静态检查。
* 表达和 inheritance 不同的复用关系。

Inheritance 关注"某类型是不是另一类型的子类型"。
Generics 关注"同一段逻辑能否对任意类型参数成立"。

## Opaque export

Opaque export 指模块对外暴露某个类型的名字和接口，但隐藏它的具体表示。

外部代码知道这个类型存在，也知道可以调用哪些操作，但不知道内部结构。

例如模块可能暴露：

```text
type Stack
push(Stack, value)
pop(Stack)
```

但不暴露 `Stack` 内部到底是 array 还是 linked list。

Opaque export 的好处是：

* 实现可以自由改变。
* 外部无法依赖内部布局。
* 抽象边界更清晰。
* 模块可以维护自己的不变式。

这和 OOP 的 private fields、interface、ADT 都关系很近。

## `this` parameter

在 OOP 语言中，方法代码通常只有一份，但一个 class 可以创建很多对象。

例如：

```java
Person a = new Person("A");
Person b = new Person("B");
a.speak();
b.speak();
```

`a.speak()` 和 `b.speak()` 调用的是同一份方法代码。问题是：方法执行时怎么知道当前操作的是 `a` 还是 `b`？

答案就是隐藏的 `this` parameter。

`this` 指向当前 receiver object。方法内部通过 `this` 访问当前对象的字段和方法。

它的作用包括：

* 标识当前对象。
* 访问当前对象字段。
* 解决参数名和字段名冲突。
* 支持链式调用。
* 把对象自身传给其他函数或方法。

例如：

```java
class Person {
    String name;

    Person(String name) {
        this.name = name;
    }
}
```

这里 `this.name` 是字段，`name` 是 constructor 参数。

从实现角度看，方法调用：

```java
obj.method(x)
```

可以理解成隐式传入：

```text
method(obj, x)
```

其中 `obj` 就是 `this`。

## C++ 中 private、protected、public

C++ 里 class members 可以有三种访问级别。

`private`：只有当前 class 的成员函数和 friend 可以访问。外部和子类都不能直接访问。

`protected`：当前 class 和子类可以访问，外部不能访问。

`public`：任何能看到该对象的代码都可以访问。

简单说：

| 访问级别      | class 内部 | subclass | 外部代码 |
| --------- | -------- | -------- | ---- |
| private   | 可以       | 不可以      | 不可以  |
| protected | 可以       | 可以       | 不可以  |
| public    | 可以       | 可以       | 可以   |

public 是接口，private 是实现细节，protected 则是为继承提供的内部接口。

## Reference model 中对象初始化为什么更简单

在 value model 语言里，对象可以直接嵌套在另一个对象内部。因此初始化时必须决定每个子对象的构造顺序、内存布局和生命周期。

C++ 就是典型例子。一个对象创建时，要依次初始化：

* virtual base classes
* non-virtual base classes
* member objects
* 当前 class 自己的 constructor body

如果某个成员对象没有正确初始化，就会出问题。

Reference model 语言中，变量通常保存的是对象引用。对象和对象之间通过引用连接，而不是直接内嵌完整对象。字段可以先被设为 `null` 或默认引用值，再逐步指向实际对象。

这让初始化更简单：

* 对象大小更固定。
* 字段通常只是引用。
* 不需要直接内嵌复杂对象。
* 构造顺序较容易线性化。
* GC 可以处理对象生命周期。

代价是更多 heap allocation 和间接访问。

## Constructor 选择

C++、Java、C# 编译器通常根据 constructor 的参数列表来决定调用哪个 constructor。

例如：

```java
new Person()
new Person("Aki")
new Person("Aki", 20)
```

编译器会根据参数数量和类型做 overload resolution。

Eiffel 和 Smalltalk 的机制不同。它们更偏向把对象创建和初始化方法看作普通消息或显式 creation procedure，而不是像 C++/Java 那样强绑定到 class 名称和重载规则上。

## C++ constructor 顺序

C++ 中对象构造顺序非常重要。大致规则是：

1. 初始化 virtual base classes。
2. 按 base class 在声明中出现的顺序初始化 non-virtual base classes。
3. 按 member fields 在 class 中声明的顺序初始化成员对象。
4. 执行当前 derived class constructor body。

注意：成员初始化顺序由字段声明顺序决定，不由 initializer list 中的书写顺序决定。

例如：

```cpp
class C {
    A a;
    B b;
public:
    C() : b(), a() {}
};
```

即使 initializer list 里写的是 `b(), a()`，实际仍然先初始化 `a`，再初始化 `b`。

Java 和 C# 禁止真正的多重 class inheritance，因此构造顺序比 C++ 简单很多。通常是先调用父类 constructor，再初始化当前类字段，最后执行当前 constructor body。

## Initialization 和 Assignment

C++ 中 initialization 和 assignment 是两个不同概念。

`Initialization` 发生在对象创建时。对象从还不存在变成存在，并获得初始状态。

例如：

```cpp
String s("hello");
```

这里是直接构造 `s`。

`Assignment` 发生在对象已经存在之后。它把一个新值赋给已有对象。

例如：

```cpp
String s;
s = "hello";
```

这里 `s` 先被默认构造，然后再通过 assignment operator 接收新值。

区别在于：

* initialization 创建对象。
* assignment 修改已有对象。
* initialization 调用 constructor。
* assignment 调用 assignment operator。
* initialization 可以避免先默认构造再覆盖的额外成本。

这也是为什么 C++ 里推荐在能初始化时直接初始化，而不是先创建再赋值。

## 为什么 C++ 比 Eiffel 更需要 destructors

C++ 没有默认的 tracing GC，并且大量资源管理依赖对象生命周期。

一个 C++ 对象可能管理：

* heap memory
* file handle
* socket
* mutex
* database connection
* GPU resource

如果没有 destructor，这些资源很容易泄漏。

Eiffel 等更依赖 GC 的语言中，内存回收由运行时负责。虽然非内存资源仍然需要处理，但 destructor 在语言核心模型中的地位没有 C++ 那么高。

C++ 的 destructor 是 RAII 的关键。对象离开作用域时自动释放资源，这让资源管理可以和控制流结合起来。

## Static method binding 和 Dynamic method binding

`Static binding` 指编译期就决定调用哪个方法。

例如 C++ 中非 virtual method 通常是 static binding。编译器根据变量的静态类型决定调用目标。

优点：

* 调用快。
* 容易 inline。
* 编译器优化空间大。

缺点：

* 不支持运行时多态。
* 父类引用调用方法时，不会根据实际对象类型变化。

`Dynamic binding` 指运行时根据对象的实际类型决定调用哪个方法。

例如 Java 中普通 instance methods 默认 dynamic dispatch，C++ 中标记为 `virtual` 的方法使用 dynamic binding。

优点：

* 支持 subtype polymorphism。
* 高层代码可以通过父类型调用子类行为。
* 适合框架和插件式扩展。

缺点：

* 需要额外间接跳转。
* 影响 inline。
* 对象布局需要支持 vtable 或类似机制。

## 为什么 C++ 和 C# 默认偏 static binding

Dynamic binding 是实现 OOP 多态的重要机制。但 C++ 和 C# 都没有让所有方法无条件动态绑定。

C++ 默认 nonvirtual，主要是出于性能和控制：

* static binding 更快。
* 更容易 inline。
* 对象不一定需要 vptr。
* 程序员需要显式写 `virtual` 表达多态意图。
* C++ 重视 zero-overhead abstraction，不希望不需要多态的类自动付出成本。

C# 中方法默认也不是 virtual，需要显式 `virtual` 和 `override`。这有助于 API 设计者控制哪些方法允许被重写，避免子类随意改变父类行为。

Java 则更偏向默认 dynamic dispatch，除了 `static`、`final`、`private` 等方法。

## Redefining 和 Overriding

`Redefining` 是子类定义了一个和父类同名的方法，但父类方法不是 virtual，或者语言语义上没有形成真正的 override。

它更像 name hiding。

`Overriding` 是子类替代父类中的 virtual method，实现真正的动态绑定。

例如 C++：

```cpp
class Base {
public:
    void f();          // nonvirtual
    virtual void g();  // virtual
};

class Derived : public Base {
public:
    void f();          // redefines / hides Base::f
    void g() override; // overrides Base::g
};
```

如果通过 `Base*` 调用：

```cpp
Base* p = new Derived();
p->f(); // calls Base::f
p->g(); // calls Derived::g
```

这说明 overriding 和 dynamic binding 相关，而 redefining 只是名字层面的覆盖。

## Dynamic binding 和 Polymorphism

Polymorphism 是目标，dynamic binding 是实现它的一种核心机制。

当代码写成：

```java
Shape s = new Circle();
s.draw();
```

编译期只知道 `s` 的静态类型是 `Shape`。但运行期对象真实类型是 `Circle`。

如果使用 static binding，调用会根据 `Shape` 决定。
如果使用 dynamic binding，调用会根据 `Circle` 决定。

所以 dynamic binding 让父类型引用能够保留子类型行为。这是 subtype polymorphism 能工作的关键。

## Abstract method 和 Abstract class

`Abstract method` 是只有方法签名、没有具体实现的方法。

在 C++ 中也叫 pure virtual method：

```cpp
virtual void draw() = 0;
```

在 Java 中可以写：

```java
abstract void draw();
```

包含 abstract method 的 class 通常也是 abstract class。它不能直接实例化，因为还有方法没有实现。

Abstract class 的作用是定义公共接口和部分共享逻辑，把具体行为留给子类完成。

例如：

```java
abstract class Shape {
    abstract void draw();

    void move(int dx, int dy) {
        ...
    }
}
```

`Shape` 规定所有形状都要能 `draw`，但具体怎么画由子类决定。

## Reverse assignment

Reverse assignment 指把一个父类变量赋给子类变量，也就是 downcast 方向的赋值。

例如：

```java
Person p = new Student();
Student s = (Student) p;
```

这需要 run-time check，因为编译器只知道 `p` 的静态类型是 `Person`。它必须在运行期检查 `p` 实际指向的对象是否真的是 `Student` 或 `Student` 的子类。

如果不是，就会失败。

Upcast 通常安全：

```java
Student -> Person
```

Downcast 不一定安全：

```java
Person -> Student
```

所以 reverse assignment 需要运行时类型检查。

## vtable

`vtable` 是实现 dynamic dispatch 的常见机制。

它可以理解成一个函数指针数组。每个 class 通常有一张 vtable，里面存放该 class 的 virtual methods 的实际函数地址。

对象内部通常会有一个隐藏指针，叫 `vptr`，指向它所属 class 的 vtable。

调用 virtual method 时，大致过程是：

1. 通过对象地址找到对象里的 vptr。
2. 通过 vptr 找到 class 的 vtable。
3. 根据编译期确定的 method slot/index 找到函数地址。
4. 跳转到该函数执行。

例如：

```cpp
p->draw();
```

如果 `draw` 是 virtual method，编译器不会直接写死 `Shape::draw` 的地址，而是通过 vtable 查找当前对象实际类型对应的 `draw`。

vtable 的代价是一次或多次间接访问。好处是可以在运行期选择正确方法。

## Object closures 和 virtual methods

对象可以类比成一种 closure，因为它把状态和操作封装在一起。

Closure 是：

```text
code + captured environment
```

Object 也可以看作：

```text
methods + fields
```

Virtual methods 的重要性在于：当对象被放进父类型或接口类型中时，它仍然能保留自己的行为。

例如：

```java
List<Shape> shapes = ...
for (Shape s : shapes) {
    s.draw();
}
```

这里 `s` 的静态类型都是 `Shape`，但每个对象可以执行自己的 `draw`。这种行为让对象不仅携带数据，也携带可在未来某个上下文中执行的逻辑。

所以 virtual method 让对象更像"带状态的行为单元"。它把当前对象的数据和未来要执行的方法绑定起来。

## Interface inheritance

`Interface inheritance` 指一个 class 继承方法签名，但不继承具体实现。

Interface 只规定：

```text
你必须提供这些方法
```

它不规定：

```text
这些方法内部必须怎么写
```

例如 Java：

```java
interface Drawable {
    void draw();
}
```

任何 class 只要实现 `draw`，就可以作为 `Drawable` 使用。

Interface inheritance 解决了几个问题：

* 不同 class 可以共享同一组操作要求。
* 不需要共同父类也能使用同一个接口。
* 避免多重实现继承带来的菱形问题。
* 高层代码可以依赖接口，而不是依赖具体 class。
* 一个 class 可以实现多个 interface。

真正的 multiple inheritance 可以继承多个父类的实现，但也会带来冲突。如果两个父类都提供同名方法，子类可能不知道该继承哪个实现。Interface inheritance 通过只继承签名，大幅减少这种冲突。

## Interface inheritance 的实现

在 statically typed object languages 中，实现 interface inheritance 需要解决一个问题：给定一个接口方法调用，运行时如何快速找到实际实现？

常见方案包括：

### Interface table

对象或 class metadata 中保存 interface table。每个 interface 对应一组方法地址。

调用 interface method 时，先找到对象的 class，再找到该 interface 对应的 method table，然后跳转到具体方法。

优点是结构清晰。缺点是比普通 vtable dispatch 更复杂。

### 多 vptr 或调整指针

在支持多重继承或复杂 interface layout 的语言中，一个对象可能有多个 vptr，或者在被看作某个 interface / base class 时需要调整指针偏移。

这种方案能表达复杂对象布局，但实现和调试都更复杂。

### Hash / lookup based dispatch

也可以通过方法名或 method ID 做查找。灵活，但查找成本较高，也可能有哈希冲突或性能不稳定问题。

## Inline caching

Inline caching 是优化 dynamic dispatch 的技术。

核心观察是：同一个 call site 上，对象的实际类型通常很稳定。

例如：

```java
x.foo()
```

这个位置虽然理论上可能接收很多类型，但实际运行中可能 99% 都是同一种 class。

Inline caching 会在调用点缓存上一次见到的类型和对应方法地址。

下次再执行这个调用点时：

1. 检查对象类型是否和缓存一致。
2. 如果一致，直接跳到缓存的方法。
3. 如果不一致，走普通 dispatch，并更新或扩展缓存。

好处包括：

* 减少动态查找成本。
* 更利于分支预测。
* 给 JIT 提供类型信息。
* 有机会进一步 inline 热点方法。

在动态语言和 JIT 编译器中，inline caching 非常重要。

## Interface 中的 default methods 和 fields

一些语言允许 interface 包含 default method implementation。

例如 Java 8 之后：

```java
interface Drawable {
    void draw();

    default void debug() {
        ...
    }
}
```

这样 interface 不只规定签名，也可以提供默认逻辑。

好处是：

* 给已有 interface 增加方法时，不一定破坏所有实现类。
* 可以复用简单公共逻辑。
* 减少重复代码。

但它也重新引入了一部分多重继承的复杂性。如果一个 class 实现多个 interface，而这些 interface 提供冲突的 default method，就需要语言规定冲突解决规则。

Interface 中的 static fields 或 constants 通常比较简单，因为它们不属于对象实例。Mutable fields 则更复杂，因为 interface 本身没有对象布局，语言必须决定这些字段到底存在哪里。

## Multiple inheritance 能做什么

真正的 multiple inheritance 可以让一个 class 继承多个父类的状态和实现。

它比 interface inheritance 更强，因为它可以复用：

* 字段
* method implementation
* protected helper logic
* 多个父类的内部结构

但它也带来复杂问题：

* 方法名冲突。
* 字段布局冲突。
* 菱形继承问题。
* constructor 顺序复杂。
* 对象指针调整复杂。
* dynamic dispatch 实现复杂。

所以很多现代语言选择：class 只允许单继承，但 interface 可以多实现。这样保留多态灵活性，同时避免多重实现继承的大部分复杂性。

## Uniform object model

一种语言提供 `uniform object model`，意味着几乎所有值都被看作对象。

典型例子：

* Smalltalk
* Ruby

在 uniform object model 中：

* 基础类型也是对象。
* 操作通常表现为 message send 或 method call。
* 所有类型可能共享一个 root class。
* 反射和元编程更自然。
* 语言语义更统一。

例如在 Ruby 中：

```ruby
1.to_s
"hello".length
```

整数和字符串都像对象一样接收方法调用。

Uniform object model 的优点是语义统一、表达优雅、元编程能力强。
缺点是实现可能有额外开销，尤其是 primitive values 如果都要装箱，会影响性能。

很多语言会采用折中方案：语义上让 primitive 看起来像对象，但实现上做 unboxing、inline storage、JIT 优化等，以减少开销。

## 小结

Object Orientation 这一章可以用几组问题串起来：

1. 对象如何把数据和操作封装在一起？
2. Class 的 public、private、protected 分别表达什么边界？
3. Inheritance 是代码复用，还是 subtype relationship？
4. Generics 和 inheritance 分别解决什么复用问题？
5. `this` 为什么是方法调用的隐藏参数？
6. Constructor 如何建立对象初始状态？
7. Destructor 为什么在 C++ 里特别重要？
8. Static binding 和 dynamic binding 的区别是什么？
9. Overriding 和 redefining 有什么区别？
10. vtable 如何实现 virtual method dispatch？
11. Interface inheritance 如何避免多重实现继承的问题？
12. Inline caching 如何优化动态方法调用？
13. Uniform object model 为什么语义优雅，但实现上可能有性能代价？

OOP 的重点不只是 class 语法，而是对象模型如何把状态、行为、抽象边界和运行时分派组织起来。Encapsulation 负责隐藏和保护状态，inheritance 负责表达扩展关系，polymorphism 负责让代码面向抽象运行。Dynamic dispatch、vtable、interface table、inline caching 则是这些抽象在实现层面付出的成本和优化方式。


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

