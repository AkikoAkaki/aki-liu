---
title: "04 面向对象与动态分派"
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
