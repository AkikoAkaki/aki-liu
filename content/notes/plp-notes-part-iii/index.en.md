---
hidden: true
title: "PLP 3: Object Orientation and Functional Languages"
date: 2026-04-24
tags: ["programming-languages"]
draft: false
---

The core question of the object orientation chapter is: how do languages bind data and operations together, and how does the same piece of code execute different logic at runtime based on the object's actual type.

On the surface, OOP is about class, object, inheritance, method -- these syntactic elements. At a deeper level, it's concerned with several things:

* How to encapsulate state
* How to hide implementation details
* How to reuse existing code
* How to reference subtype objects through supertype references
* How to decide which method to call at runtime
* How to initialize and destroy objects
* How to implement interfaces, abstract classes, dynamic dispatch, and vtables

So this chapter is not simply "object-oriented programming philosophy," but how the object model is implemented by the language and runtime.

## Three Defining Features of OOP

Object-oriented programming is generally considered to have three core features:

* Encapsulation
* Inheritance
* Polymorphism

### Encapsulation

Encapsulation means binding data and the code that operates on that data together to form an object.

Objects can have internal state, such as fields, attributes, and member variables. The object exposes a set of methods to the outside; external code operates on the object through these methods, rather than directly and arbitrarily modifying internal state.

Its roles include:

* Hiding implementation details.
* Reducing coupling between modules.
* Preventing external code from breaking the object's internal invariants.
* Allowing objects to change internal implementation without changing the external interface.

For example, a `Stack` object exposes `push` and `pop` externally, but whether it internally uses an array or linked list can be hidden.

### Inheritance

Inheritance means one class can inherit the properties and methods of another class and extend or modify behavior on top of that.

For example:

```java
class Student extends Person {
    ...
}
```

`Student` can reuse `Person`'s fields and methods, and also add its own logic.

The roles of inheritance include:

* Code reuse.
* Expressing is-a relationships.
* Supporting subtype polymorphism.
* Allowing frameworks to write superclass logic while subclasses provide concrete implementations.

Inheritance also has costs. When hierarchies are too deep, code behavior can become hard to trace; superclass changes can also affect many subclasses.

### Polymorphism

Polymorphism means the same interface can correspond to multiple implementations.

For example, a function receiving `Shape`:

```java
void draw(Shape s) {
    s.draw();
}
```

What is actually passed may be `Circle`, `Rectangle`, `Triangle`. The caller does not need to know the concrete type, only that they can all `draw()`.

This allows programs to program to interfaces or abstract types, reducing dependency on concrete implementations.

## Benefits of Abstraction

Abstraction is one of the foundations of OOP. Its value is not just "hiding complexity," but also includes:

* Reducing cognitive load. The programmer does not need to care about every internal detail all the time.
* Enabling modularity and decoupling. Different modules can collaborate through interfaces.
* Improving maintainability. When internal implementation changes, external code may not need to change.
* Enhancing extensibility. New concrete types can plug into existing abstractions.
* Protecting object invariants. Objects can control how external code modifies their state.

Good abstraction lets programmers think about "what this object can do," rather than "how it does every step internally."

## Members: Data Members and Subroutine Members

In OOP, the members of a class are typically divided into two categories:

* Data member: more commonly called fields, attributes, instance variables, member variables.
* Subroutine member: more commonly called methods, member functions.

For example:

```java
class Person {
    String name;       // data member / field

    void speak() {     // method
        ...
    }
}
```

Objects place data members and methods together in the same abstraction unit -- this is the basic form of OOP encapsulation.

## The Purpose of Private Parts in Interfaces

Some languages or module systems allow interfaces to have private parts. The purpose is not for external users to directly use, but for the compiler, linker, or subclasses to know what internal information the object needs.

Private parts cannot be completely hidden because implementation and compilation may need to know:

* Object size.
* Field layout.
* The existence of private methods.
* Layout requirements for subclass inheritance.
* ABI compatibility.

From the external user's perspective, the private part is inaccessible.
From the language implementation's perspective, it may still affect object layout, compilation, and linking.

## `super` and C++'s `::`

In Java, `super` is used to reference the superclass version of a field, method, or constructor.

For example:

```java
super.toString();
```

It means calling `toString` in the superclass, not the overridden version in the current class.

C++'s `::` scope resolution operator can also be used to specify a member within a certain class scope:

```cpp
Base::foo();
```

Both can be used to resolve ambiguity when the current class and superclass both have members with the same name.

## Why Inline Subroutines Are Important in OOP

OOP encourages using method calls to protect abstraction boundaries. For example, using getters/setters to access fields, and small methods to express object behavior.

But if every access actually incurs function call overhead, performance suffers.

Inline subroutines are especially important for OOP, for several reasons:

First, many methods are very short.

For example:

```java
int getX() {
    return x;
}
```

If such methods are called frequently, call overhead may exceed the method itself. Inlining can eliminate this cost.

Second, inlining lets the compiler see more context.

After the method is expanded at the call site, the compiler can further perform constant propagation, dead code elimination, escape analysis, and other optimizations.

Third, dynamic dispatch in OOP hinders optimization.

If the compiler can prove the concrete target of a virtual method call, it can devirtualize, turning the dynamic call into a direct call, then further inline.

So inlining is an important optimization for reducing OOP abstraction cost.

## Constructors and Destructors

A `constructor` is the initialization logic automatically executed when an object is created.

It typically handles:

* Initializing fields.
* Establishing object invariants.
* Acquiring resources.
* Calling the superclass constructor.
* Initializing member objects.

Constructors can be overloaded, meaning the same class can have multiple constructors with different parameter lists. But it is usually not dynamic dispatch in the virtual method sense.

For example, in C++/Java:

```java
class Person {
    Person() { ... }
    Person(String name) { ... }
}
```

This is called constructor overloading.

A `destructor` is the cleanup logic executed at the end of an object's lifecycle. In C++:

```cpp
~ClassName()
```

A destructor typically handles:

* Releasing resources.
* Closing files.
* Releasing locks.
* Disconnecting connections.
* Cleaning up manually allocated memory.

C++ especially relies on destructors because of RAII. Resource lifetime is bound to object lifetime. When an object leaves scope, the destructor runs automatically.

In GC languages, memory is typically freed by the garbage collector, so the importance of destructors is relatively reduced. But non-memory resources like files, sockets, and locks still need explicit cleanup or handling through mechanisms like `try-with-resources`/`using`.

## Other Terms for Subclass and Superclass

`Subclass` is also commonly called:

* derived class
* child class
* subtype

`Superclass` is also commonly called:

* base class
* parent class
* supertype

These terms vary slightly across languages and contexts, but broadly describe inheritance or subtype relationships.

## Why Generics Are Still Needed Alongside Inheritance

Inheritance provides subtype polymorphism. Generics provide parametric polymorphism.

They solve different problems.

If containers are expressed through inheritance, for example:

```java
List<Object>
```

Then all elements are treated as `Object`, requiring casts upon retrieval, losing type information, and being error-prone.

Generics can express:

```java
List<String>
List<Integer>
List<User>
```

Thus the same `List<T>` logic can be used for different types while preserving compile-time type safety.

So the value of generics:

* Avoids duplicated code.
* Preserves concrete element types.
* Reduces downcasts.
* Provides stronger static checking.
* Expresses a different kind of reuse relationship than inheritance.

Inheritance focuses on "whether one type is a subtype of another."
Generics focus on "whether the same logic can hold for any type parameter."

## Opaque Export

Opaque export means a module exposes a type's name and interface to the outside world, but hides its concrete representation.

External code knows the type exists and knows what operations can be called, but does not know the internal structure.

For example, a module might expose:

```text
type Stack
push(Stack, value)
pop(Stack)
```

But not expose whether `Stack` internally uses an array or linked list.

Benefits of opaque export:

* Implementation can change freely.
* External code cannot depend on internal layout.
* Abstraction boundaries are clearer.
* Modules can maintain their own invariants.

This is closely related to OOP's private fields, interfaces, and ADTs.

## The `this` Parameter

In OOP languages, method code typically exists as a single copy, but a class can create many objects.

For example:

```java
Person a = new Person("A");
Person b = new Person("B");
a.speak();
b.speak();
```

`a.speak()` and `b.speak()` call the same method code. The question is: when the method executes, how does it know whether it's operating on `a` or `b`?

The answer is the hidden `this` parameter.

`this` points to the current receiver object. Inside the method, fields and methods of the current object are accessed through `this`.

Its roles include:

* Identifying the current object.
* Accessing current object fields.
* Resolving conflicts between parameter names and field names.
* Supporting chained calls.
* Passing the object itself to other functions or methods.

For example:

```java
class Person {
    String name;

    Person(String name) {
        this.name = name;
    }
}
```

Here `this.name` is the field, and `name` is the constructor parameter.

From an implementation perspective, a method call:

```java
obj.method(x)
```

Can be understood as implicitly passing:

```text
method(obj, x)
```

Where `obj` is `this`.

## private, protected, public in C++

In C++, class members can have three access levels.

`private`: only the current class's member functions and friends can access. Neither external code nor subclasses can directly access.

`protected`: the current class and subclasses can access; external code cannot.

`public`: any code that can see the object can access.

Simply put:

| Access Level | Inside Class | Subclass | External Code |
| ---- | ---- | ---- | ---- |
| private | Yes | No | No |
| protected | Yes | Yes | No |
| public | Yes | Yes | Yes |

public is the interface, private is implementation detail, and protected is the internal interface provided for inheritance.

## Why Object Initialization Is Simpler in the Reference Model

In value-model languages, objects can be directly nested inside other objects. Therefore, the construction order of each sub-object, memory layout, and lifetime must be decided during initialization.

C++ is a typical example. When an object is created, it must initialize in order:

* virtual base classes
* non-virtual base classes
* member objects
* the current class's own constructor body

If a member object is not correctly initialized, problems arise.

In reference-model languages, variables typically hold object references. Objects are connected through references rather than directly embedding complete objects. Fields can first be set to `null` or default reference values, then gradually pointed to actual objects.

This makes initialization simpler:

* Object size is more fixed.
* Fields are typically just references.
* No need to directly embed complex objects.
* Construction order is easier to linearize.
* GC can handle object lifetimes.

The cost is more heap allocations and indirect accesses.

## Constructor Selection

C++, Java, and C# compilers typically decide which constructor to call based on the constructor's parameter list.

For example:

```java
new Person()
new Person("Aki")
new Person("Aki", 20)
```

The compiler performs overload resolution based on parameter count and types.

Eiffel and Smalltalk have different mechanisms. They lean more toward treating object creation and initialization methods as ordinary messages or explicit creation procedures, rather than being strongly bound to class names and overloading rules as in C++/Java.

## C++ Constructor Order

Constructor order in C++ is very important. The rough rules are:

1. Initialize virtual base classes.
2. Initialize non-virtual base classes in the order they appear in the declaration.
3. Initialize member objects in the order fields are declared in the class.
4. Execute the current derived class constructor body.

Note: the member initialization order is determined by the field declaration order, not the writing order in the initializer list.

For example:

```cpp
class C {
    A a;
    B b;
public:
    C() : b(), a() {}
};
```

Even though the initializer list writes `b(), a()`, `a` is still initialized first, then `b`.

Java and C# prohibit true multiple class inheritance, so construction order is much simpler than C++. Typically, the superclass constructor is called first, then current class fields are initialized, and finally the current constructor body executes.

## Initialization and Assignment

In C++, initialization and assignment are two different concepts.

`Initialization` happens when the object is created. The object transitions from non-existence to existence and receives its initial state.

For example:

```cpp
String s("hello");
```

Here `s` is directly constructed.

`Assignment` happens after the object already exists. It assigns a new value to an existing object.

For example:

```cpp
String s;
s = "hello";
```

Here `s` is first default-constructed, then receives a new value through the assignment operator.

The difference:

* Initialization creates objects.
* Assignment modifies existing objects.
* Initialization calls constructors.
* Assignment calls assignment operators.
* Initialization avoids the extra cost of default-constructing then overwriting.

This is also why C++ recommends initializing directly when possible, rather than creating first and assigning later.

## Why C++ Needs Destructors More Than Eiffel

C++ has no default tracing GC, and extensive resource management relies on object lifetimes.

A C++ object may manage:

* heap memory
* file handle
* socket
* mutex
* database connection
* GPU resource

Without destructors, these resources easily leak.

In languages like Eiffel that rely more on GC, memory reclamation is handled by the runtime. Although non-memory resources still need handling, destructors do not occupy as high a position in the core language model as in C++.

C++ destructors are key to RAII. Resources are automatically released when objects leave scope, allowing resource management to be tied to control flow.

## Static Method Binding and Dynamic Method Binding

`Static binding` means the compiler decides which method to call at compile time.

For example, non-virtual methods in C++ are typically statically bound. The compiler decides the call target based on the variable's static type.

Pros:

* Fast calls.
* Easy to inline.
* Large compiler optimization space.

Cons:

* Does not support runtime polymorphism.
* Superclass references calling methods do not vary based on actual object type.

`Dynamic binding` means the runtime decides which method to call based on the object's actual type.

For example, ordinary instance methods in Java default to dynamic dispatch; methods marked `virtual` in C++ use dynamic binding.

Pros:

* Supports subtype polymorphism.
* High-level code can invoke subclass behavior through supertype references.
* Suitable for frameworks and plug-in extensibility.

Cons:

* Requires extra indirect jumps.
* Affects inlining.
* Object layout must support vtables or similar mechanisms.

## Why C++ and C# Default Toward Static Binding

Dynamic binding is an important mechanism for OOP polymorphism. But neither C++ nor C# makes all methods unconditionally dynamically bound.

C++ defaults to nonvirtual, primarily for performance and control:

* Static binding is faster.
* Easier to inline.
* Objects may not need a vptr.
* Programmers must explicitly write `virtual` to express polymorphic intent.
* C++ values zero-overhead abstraction; classes that don't need polymorphism should not automatically pay the cost.

In C#, methods are also not virtual by default; `virtual` and `override` must be explicitly written. This helps API designers control which methods are allowed to be overridden, preventing subclasses from arbitrarily changing superclass behavior.

Java, in contrast, leans more toward default dynamic dispatch, except for `static`, `final`, and `private` methods.

## Redefining and Overriding

`Redefining` is when a subclass defines a method with the same name as one in the superclass, but the superclass method is not virtual, or the language semantics do not form a true override.

It is more like name hiding.

`Overriding` is when a subclass replaces a virtual method in the superclass, achieving true dynamic binding.

For example, in C++:

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

If called through `Base*`:

```cpp
Base* p = new Derived();
p->f(); // calls Base::f
p->g(); // calls Derived::g
```

This shows that overriding is related to dynamic binding, while redefining is just name-level covering.

## Dynamic Binding and Polymorphism

Polymorphism is the goal; dynamic binding is one of the core mechanisms for achieving it.

When code is written as:

```java
Shape s = new Circle();
s.draw();
```

At compile time, the only thing known is that `s`'s static type is `Shape`. But at runtime, the object's actual type is `Circle`.

If static binding is used, the call is resolved based on `Shape`.
If dynamic binding is used, the call is resolved based on `Circle`.

So dynamic binding lets supertype references retain subtype behavior. This is key to subtype polymorphism working.

## Abstract Method and Abstract Class

An `abstract method` is a method that has only a signature, no concrete implementation.

In C++, it's also called a pure virtual method:

```cpp
virtual void draw() = 0;
```

In Java:

```java
abstract void draw();
```

A class containing abstract methods is usually also an abstract class. It cannot be directly instantiated because some methods are not yet implemented.

The role of abstract classes is to define a common interface and some shared logic, leaving concrete behavior to subclasses.

For example:

```java
abstract class Shape {
    abstract void draw();

    void move(int dx, int dy) {
        ...
    }
}
```

`Shape` stipulates that all shapes must be able to `draw`, but how exactly to draw is decided by subclasses.

## Reverse Assignment

Reverse assignment means assigning a superclass variable to a subclass variable -- i.e., assignment in the downcast direction.

For example:

```java
Person p = new Student();
Student s = (Student) p;
```

This requires a run-time check because the compiler only knows that `p`'s static type is `Person`. It must check at runtime whether the object `p` actually points to is indeed `Student` or a subclass of `Student`.

If not, it fails.

Upcasts are typically safe:

```java
Student -> Person
```

Downcasts are not necessarily safe:

```java
Person -> Student
```

So reverse assignment requires runtime type checking.

## vtable

The `vtable` is a common mechanism for implementing dynamic dispatch.

It can be understood as an array of function pointers. Each class typically has one vtable containing the actual function addresses of that class's virtual methods.

Inside the object, there is usually a hidden pointer called `vptr`, pointing to the vtable of its class.

When calling a virtual method, the rough process is:

1. Through the object address, find the vptr in the object.
2. Through the vptr, find the class's vtable.
3. Based on the compile-time-determined method slot/index, find the function address.
4. Jump to that function for execution.

For example:

```cpp
p->draw();
```

If `draw` is a virtual method, the compiler does not directly hardcode the address of `Shape::draw`, but finds the `draw` corresponding to the current object's actual type through the vtable.

The cost of vtables is one or more indirect accesses. The benefit is selecting the correct method at runtime.

## Object Closures and Virtual Methods

Objects can be analogized to closures because they encapsulate state and operations together.

A closure is:

```text
code + captured environment
```

An object can also be seen as:

```text
methods + fields
```

The importance of virtual methods: when an object is placed into a supertype or interface type, it can still retain its own behavior.

For example:

```java
List<Shape> shapes = ...
for (Shape s : shapes) {
    s.draw();
}
```

Here `s`'s static type is always `Shape`, but each object can execute its own `draw`. This behavior lets objects carry not only data but also logic that can be executed in some future context.

So virtual methods make objects more like "stateful units of behavior." They bind the current object's data with methods to be executed in the future.

## Interface Inheritance

`Interface inheritance` means a class inherits method signatures but not concrete implementations.

An interface only stipulates:

```text
You must provide these methods
```

It does not stipulate:

```text
How these methods must be written internally
```

For example, in Java:

```java
interface Drawable {
    void draw();
}
```

Any class that implements `draw` can be used as `Drawable`.

Interface inheritance solves several problems:

* Different classes can share the same set of operation requirements.
* No common superclass is needed to use the same interface.
* Avoids the diamond problem caused by multiple implementation inheritance.
* High-level code can depend on interfaces rather than concrete classes.
* One class can implement multiple interfaces.

True multiple inheritance can inherit implementations from multiple superclasses, but it introduces conflicts. If two superclasses both provide a method with the same name, the subclass may not know which implementation to inherit. Interface inheritance, by inheriting only signatures, greatly reduces such conflicts.

## Implementing Interface Inheritance

In statically typed object languages, implementing interface inheritance requires solving one problem: given an interface method call, how does the runtime quickly find the actual implementation?

Common approaches include:

### Interface Table

Objects or class metadata store interface tables. Each interface corresponds to a set of method addresses.

When calling an interface method, first find the object's class, then find the method table for that interface, then jump to the concrete method.

The advantage is clear structure. The disadvantage is more complex than ordinary vtable dispatch.

### Multiple vptrs or Pointer Adjustment

In languages supporting multiple inheritance or complex interface layouts, an object may have multiple vptrs, or may need pointer offset adjustments when viewed as a certain interface/base class.

This approach can express complex object layouts, but implementation and debugging are more complex.

### Hash / Lookup-Based Dispatch

Dispatch can also be done through method names or method IDs. Flexible, but lookup cost is higher, and there may be hash collisions or unstable performance.

## Inline Caching

Inline caching is a technique for optimizing dynamic dispatch.

The core observation: at the same call site, the object's actual type is usually very stable.

For example:

```java
x.foo()
```

Although theoretically this location could receive many types, in practice 99% of calls might be the same class.

Inline caching caches the last-seen type and the corresponding method address at the call site.

The next time this call site is executed:

1. Check whether the object type matches the cache.
2. If it matches, jump directly to the cached method.
3. If it doesn't match, use normal dispatch and update or extend the cache.

Benefits include:

* Reduces dynamic lookup cost.
* More favorable for branch prediction.
* Provides type information to the JIT.
* Opportunity to further inline hot methods.

In dynamic languages and JIT compilers, inline caching is very important.

## Default Methods and Fields in Interfaces

Some languages allow interfaces to contain default method implementations.

For example, Java 8+:

```java
interface Drawable {
    void draw();

    default void debug() {
        ...
    }
}
```

Thus interfaces not only specify signatures but can also provide default logic.

Benefits:

* Adding methods to existing interfaces does not necessarily break all implementing classes.
* Simple common logic can be reused.
* Reduces duplicated code.

But it also reintroduces some of the complexity of multiple inheritance. If a class implements multiple interfaces and those interfaces provide conflicting default methods, the language must specify conflict resolution rules.

Static fields or constants in interfaces are relatively simple because they don't belong to object instances. Mutable fields are more complex because interfaces themselves have no object layout; the language must decide where these fields actually reside.

## What Multiple Inheritance Can Do

True multiple inheritance allows a class to inherit the state and implementation of multiple superclasses.

It is stronger than interface inheritance because it can reuse:

* Fields
* Method implementations
* Protected helper logic
* The internal structures of multiple superclasses

But it also brings complex problems:

* Method name conflicts.
* Field layout conflicts.
* Diamond inheritance problem.
* Complex constructor ordering.
* Complex object pointer adjustments.
* Complex dynamic dispatch implementation.

So many modern languages choose: classes allow only single inheritance, but interfaces can be multiply implemented. This retains polymorphic flexibility while avoiding most of the complexity of multiple implementation inheritance.

## Uniform Object Model

A language providing a `uniform object model` means almost all values are treated as objects.

Typical examples:

* Smalltalk
* Ruby

In a uniform object model:

* Primitive types are also objects.
* Operations are typically expressed as message sends or method calls.
* All types may share a single root class.
* Reflection and metaprogramming are more natural.
* Language semantics are more uniform.

For example, in Ruby:

```ruby
1.to_s
"hello".length
```

Integers and strings both receive method calls like objects.

The advantage of a uniform object model is uniform semantics, elegant expression, and strong metaprogramming capabilities.
The disadvantage is that implementation may have extra overhead, especially if primitive values always need to be boxed, which affects performance.

Many languages adopt a compromise: semantically make primitives look like objects, but use unboxing, inline storage, JIT optimizations, etc., to reduce overhead.

## Summary

The Object Orientation chapter can be threaded together with several sets of questions:

1. How do objects encapsulate data and operations together?
2. What boundaries do public, private, and protected in a class each express?
3. Is inheritance code reuse, or a subtype relationship?
4. What reuse problems do generics and inheritance each solve?
5. Why is `this` a hidden parameter of method calls?
6. How do constructors establish an object's initial state?
7. Why are destructors especially important in C++?
8. What is the difference between static binding and dynamic binding?
9. What is the difference between overriding and redefining?
10. How does the vtable implement virtual method dispatch?
11. How does interface inheritance avoid the problems of multiple implementation inheritance?
12. How does inline caching optimize dynamic method calls?
13. Why is the uniform object model semantically elegant, yet potentially costly in performance?

The key point of OOP is not just class syntax, but how the object model organizes state, behavior, abstraction boundaries, and runtime dispatch. Encapsulation handles hiding and protecting state, inheritance expresses extension relationships, and polymorphism lets code run against abstractions. Dynamic dispatch, vtables, interface tables, and inline caching are the costs and optimization methods paid for these abstractions at the implementation level.


The core question of the functional languages chapter is: what happens to programming languages when "functions" are placed at the center of the language, rather than "state modification" at the center of the program.

In imperative programming, programs are typically understood as a sequence of commands:

```text
Change variables
Update state
Execute loops
Modify objects
```

Functional programming is more concerned with expressions, function composition, value transformations, and referential transparency. It cares about:

* Whether functions can be passed around like ordinary values
* Whether data can remain immutable
* Whether an expression can be replaced by its value
* Whether evaluation order affects results
* Whether function calls can be cached
* Whether code itself can be treated as data

This chapter is not just about introducing languages like Lisp, Scheme, ML, and Haskell, but also about discussing a different way of organizing programs.

## Lambda Calculus

The foundational mathematical formalism of functional programming is lambda calculus.

Lambda calculus expresses computation using a very small set of rules:

* Variables
* Function abstraction
* Function application

For example:

```text
λx. x + 1
```

Represents a function that receives `x` and returns `x + 1`.

Function application is:

```text
(λx. x + 1) 3
```

The result is:

```text
4
```

The importance of lambda calculus: it demonstrates that "function definition" and "function call" alone are sufficient to express computation. The core semantics of many functional languages can be traced back to this model.

## Distinctive Features of Functional Programming

Functional programming languages typically share some common features, though not every language possesses all of them.

Common features include:

* Functions are first-class values.
* Tendency to use pure functions.
* Tendency to use immutable data.
* Emphasis on referential transparency.
* Describing computation through expression composition.
* Common use of recursion and higher-order functions instead of explicit loops.
* Some languages support lazy evaluation, such as Haskell.
* Some languages have powerful type inference, such as ML, OCaml, Haskell.

Note: not all functional languages are lazy. Many languages like Scheme, ML, OCaml, and F# default to eager evaluation.
Also, not all functional languages completely lack state modification. Many languages allow mutation, but the functional style strives to minimize or isolate it.

## First-Class Value

A `first-class value` means a value can be used like ordinary data.

If functions are first-class values, it means functions can:

* Be assigned to variables
* Be passed as arguments to other functions
* Be returned as return values
* Be stored in data structures
* Be created at runtime

For example, JavaScript:

```js
const addOne = x => x + 1;

function apply(f, x) {
    return f(x);
}

apply(addOne, 3);
```

Here `addOne` is a function, but it is passed to `apply` like an ordinary value.

First-class functions are the foundation of functional programming. Without them, it is hard to naturally write higher-order functions, callbacks, map/filter/reduce, and similar structures.

## Higher-Order Functions

If a function receives a function as an argument, or returns a function, it is a higher-order function.

For example:

```js
const numbers = [1, 2, 3];

numbers.map(x => x + 1);
```

`map` receives a function and applies it to every element in the array.

The significance of higher-order functions: programs can pass "behavior" as values.

This allows many repetitive patterns to be abstracted:

* Traversal
* Filtering
* Aggregation
* Callbacks
* Strategy selection
* Deferred execution

For example:

```js
numbers.filter(x => x > 1)
       .map(x => x * 2)
       .reduce((a, b) => a + b, 0);
```

This code cares about how data transforms, not manually writing loops and updating temporary variables.

## Pure Functions

A pure function satisfies two conditions:

1. Same input always yields the same output.
2. No side effects.

For example:

```text
f(x) = x + 1
```

This is a pure function. As long as the input is `3`, the output is always `4`.

But the following is not pure:

```js
let counter = 0;

function next() {
    counter += 1;
    return counter;
}
```

It depends on and modifies external state. Even with no parameters, multiple calls yield different results.

The benefits of pure functions:

* Easy to test.
* Easy to reason about.
* Easy to cache.
* More suitable for concurrency.
* Easier for the compiler to optimize.

But real programs must handle side effects like I/O, time, random numbers, networking, and databases. So functional languages typically do not completely eliminate side effects, but manage them through type systems, monads, effect systems, runtime conventions, etc.

## Immutability

Functional programming generally prefers immutable data -- that is, data, once created, is never modified.

For example, if you want to "modify" a list, you typically do not mutate it in place, but create a new list.

```text
old list -> new list
```

The benefits of immutability include:

* Less prone to shared-mutable-state bugs.
* Multi-threaded reads are safer.
* Easier to implement persistent data structures.
* Easier to understand what a value means in the program.
* Function calls won't secretly change the same object.

Its cost: if not implemented well, it can produce a lot of copying.
So functional languages typically use persistent data structures, reducing copying costs through structural sharing.

## Referential Transparency

`Referential transparency` means an expression can be replaced by its computed result without changing program behavior.

For example:

```text
2 + 3
```

Can be replaced with:

```text
5
```

Program behavior is unchanged.

If a function is pure, then function calls can also be replaced by their results.

For example:

```text
square(3)
```

If `square` is a pure function, it can be replaced with:

```text
9
```

The benefit of referential transparency is that programs are easier to reason about. You don't need to worry about whether this expression secretly modified a global variable, wrote a file, sent a network request, or depended on the current time.

This is also one reason functional programming brings programs closer to mathematical expression.

## Lisp / Scheme REPL

Lisp and Scheme emphasized interactive development early on. REPL is read-eval-print loop.

It does four things:

1. Read: reads the expression entered by the user.
2. Eval: evaluates the expression.
3. Print: prints the evaluation result.
4. Loop: returns to the first step, continuing to wait for input.

For example:

```scheme
> (+ 1 2)
3
```

REPL lets programmers incrementally test expressions, functions, and data structures. It is very helpful for exploratory programming, teaching, and debugging.

## let, let*, and letrec in Scheme

`let`, `let*`, and `letrec` in Scheme are all used for local bindings, but their binding rules differ.

### let

`let` is parallel binding. The initial values of multiple variables are computed in the same outer environment; they cannot see each other's new bindings.

For example:

```scheme
(let ((x 1)
      (y 2))
  (+ x y))
```

Here `x` and `y` are bound simultaneously.

If written:

```scheme
(let ((x 1)
      (y x))
  y)
```

The `x` in `y`'s initialization expression does not refer to the newly bound `x` within the same `let`, but looks to the outer environment.

### let*

`let*` is sequential binding. Variables are bound in order; later bindings can see earlier bindings.

For example:

```scheme
(let* ((x 1)
       (y x))
  y)
```

Here `y` can see the just-bound `x`, so the result is `1`.

### letrec

`letrec` is used for recursive binding. It allows bindings to reference each other, commonly used for defining recursive or mutually recursive functions.

For example:

```scheme
(letrec ((fact
          (lambda (n)
            (if (= n 0)
                1
                (* n (fact (- n 1)))))))
  (fact 5))
```

`fact` can reference itself within its own function body.

A simple comparison:

```text
let    = parallel binding
let*   = sequential binding
letrec = recursive binding
```

## eq?, eqv?, and equal?

Equality in Scheme also has levels.

### eq?

`eq?` is typically used to determine whether two objects are the same object -- i.e., identity / pointer-level equality.

It is close to "do they point to the same thing."

For example, for symbols, `eq?` is typically very useful:

```scheme
(eq? 'a 'a)
```

### eqv?

`eqv?` is more suitable than `eq?` for comparing some basic values, such as numbers and characters.

It roughly determines whether two values represent the same simple value. For example, numbers with the same numeric value, identical characters -- `eqv?` is more reasonable.

### equal?

`equal?` leans more toward structural equality. It recursively compares the contents of composite structures.

For example, two lists with the same content, even if they are not the same object, `equal?` may consider them equal.

A rough memory aid:

```text
eq?     = identity
eqv?    = identity + simple value equality
equal?  = structural equality
```

## How Scheme Deviates from the Purely Functional Model

Scheme is a functional language, but not a purely functional one. It allows some operations that deviate from the purely functional model.

Common ones include:

* Mutation, e.g., `set!`
* Mutable pairs or vectors
* I/O operations
* Assignment
* Continuation-related control flow
* Interaction with external state

For example:

```scheme
(define x 1)
(set! x 2)
```

This modifies the value of an existing binding.

Scheme's character: it supports functional programming but does not force all programs to remain purely functional.

## Homoiconicity

`Homoiconic` means code and data use the same structural representation.

Lisp is the most classic example. Lisp programs are themselves list structures.

For example, the expression:

```scheme
(+ 1 2)
```

Is both a piece of code and can also be treated as list data:

```scheme
'(+ 1 2)
```

Because code is data, programs can naturally generate, modify, and analyze other programs.

This makes Lisp's macro system very powerful.

The significance of homoiconicity:

* Programs can manipulate programs.
* Macros are more natural.
* Strong metaprogramming capabilities.
* Close distance between language syntax and AST.

## S-expression

S-expression is short for symbolic expression -- the basic representation of Lisp code and data.

An S-expression can be an atom or a list.

Atom examples:

```scheme
x
42
"hello"
```

List example:

```scheme
(+ 1 2)
(define x 3)
(lambda (x) (+ x 1))
```

Lisp programs are essentially composed of S-expressions.
This is also why Lisp code has so many parentheses: parentheses directly represent tree structure.

## eval and apply

`eval` and `apply` are important concepts for understanding Lisp/Scheme's evaluation model.

### eval

`eval` receives an expression and evaluates it in some environment.

It answers:

```text
What is the value of this expression?
```

For example:

```scheme
(eval '(+ 1 2))
```

Yields:

```text
3
```

### apply

`apply` receives a function and a set of arguments, and applies the function to those arguments.

It answers:

```text
What do you get when applying this function to these arguments?
```

For example:

```scheme
(apply + '(1 2 3))
```

Yields:

```text
6
```

Simply put:

```text
eval  = evaluate the value of an expression
apply = call a function with arguments
```

## Function and Special Form

In Scheme, an ordinary function call typically first evaluates all arguments, then passes the results to the function.

For example:

```scheme
(+ 1 2)
```

`1` and `2` are evaluated, then passed to `+`.

But a special form has its own evaluation rules. It does not simply evaluate all arguments first.

For example:

```scheme
(if condition then-expr else-expr)
```

`if` only evaluates one branch based on the condition's result. If it were an ordinary function, both then and else would be evaluated first, which would violate the semantics of conditional expressions.

Common special forms include:

* `if`
* `define`
* `lambda`
* `quote`
* `set!`
* `let`

The significance of special forms is that they let the language define special control structures and binding structures.

## Normal-Order Evaluation and Applicative-Order Evaluation

Evaluation strategy determines when function arguments are computed.

### Applicative-Order Evaluation

Applicative-order evaluation, also called eager evaluation, first computes all actual parameters, then calls the function.

Most mainstream languages default to this strategy, e.g., C, Java, Python, JavaScript, Scheme.

For example:

```text
f(g(), h())
```

In applicative order, `g()` and `h()` are computed first, then `f` is called.

Pros:

* Direct behavior.
* Relatively simple to implement.
* Performance is relatively predictable.
* Easier to combine with side-effect languages.

Cons:

* Even if a parameter is never used in the function body, it is still computed.
* May be unable to express certain short-circuit or infinite structures.

### Normal-Order Evaluation

Normal-order evaluation passes the parameter expressions into the function, evaluating them only when truly needed.

For example:

```text
f(expensive())
```

If `f` never uses this parameter, `expensive()` is never executed.

Pros:

* Can avoid unnecessary computation.
* Can handle certain infinite data structures.
* Closer to the mathematical model of call-by-need.

Cons:

* If the same parameter is used multiple times, the expression may be recomputed.
* More complex to implement.
* Harder to understand when combined with side effects.

## Lazy Evaluation

Lazy evaluation can be seen as an improvement on normal-order evaluation: parameters are computed only the first time they are needed, and the result is cached. When the same parameter is used again later, the cached result is used directly.

So the characteristic of lazy evaluation is:

```text
need it -> compute once -> remember it
```

The key difference from normal-order is whether the result is cached.

Pros of lazy evaluation:

* Avoids unnecessary computation.
* Supports infinite data structures.
* Allows writing more compositional dataflow code.
* Same expression is not recomputed.

Cons:

* Evaluation timing is non-intuitive.
* Space usage is harder to predict.
* May produce thunk accumulation.
* Debugging performance issues is more difficult.

Haskell is a typical lazy functional language. Many other functional languages default to eager but can also achieve deferred evaluation through lazy constructs or thunks.

## Strict Function

A function is `strict` if: when its argument cannot produce a value, the function itself also cannot produce a value.

More formally, if the argument is bottom (non-terminating or erroneous), the strict function's result is also bottom.

A simple understanding:

```text
A strict function needs to obtain the argument value before it can produce its own result
```

For example, ordinary addition is strict:

```text
x + 1
```

If `x` itself is a non-terminating computation, then `x + 1` also does not terminate.

But structures like `if` are not strict in all branches. It only needs the condition, then evaluates only the selected branch.

This is why `if` is typically a special form, not an ordinary function.

## Memoization

`Memoization` means caching the results of function calls to avoid recomputation.

If a function is pure, the same input always yields the same output. This makes safe caching possible:

```text
Compute f(x) once
Later encounter f(x) again, directly return cached result
```

For example, Fibonacci recursion without caching recomputes many subproblems:

```text
fib(5)
= fib(4) + fib(3)
= fib(3) + fib(2) + fib(2) + fib(1)
...
```

Memoization can cache these repeated calls, greatly improving performance.

Its mechanism:

1. Check whether the arguments are already in the cache.
2. If so, directly return the cached result.
3. If not, compute the result.
4. Store the result in the cache.
5. Return the result.

Memoization's limitations:

* Requires extra memory.
* Arguments must serve as keys.
* Unsafe for functions with side effects.
* Cache strategy must be controlled, or it may grow without bound.

## Functional Programming and Concurrency

Pure functional languages are particularly attractive for concurrency because they reduce shared mutable state.

One of the hardest problems in concurrent programming is:

```text
Multiple threads simultaneously reading and writing the same piece of shared data
```

If data is immutable, many race conditions simply cannot occur. Multiple threads can safely share the same value because no thread will mutate it in place.

Pure functions are also easier to parallelize. Because function calls do not depend on hidden state, the compiler or runtime can more easily determine which computations can be performed simultaneously.

Of course, real programs still need I/O and external state. But functional languages can centralize effect management, making the pure computation parts easier to execute concurrently.

## Tradeoffs of Functional Programming

The advantages of functional programming are clear:

* Programs are easier to reason about.
* Less state change.
* Easier testing.
* Safer concurrency.
* Strong abstraction capability.
* Higher-order functions let repetitive control structures be encapsulated.

But it also has costs:

* The mindset is not intuitive for beginners.
* The performance model is sometimes unclear, especially with lazy evaluation.
* Excessive abstraction can reduce readability.
* Interacting with low-level systems, mutable state, and I/O requires extra mechanisms.
* Some scenarios produce extra allocations.

So the value of functional programming is not turning every program into a mathematical formula, but providing a way to more easily control state and compose logic.

## Summary

The Functional Languages chapter can be threaded together with several sets of questions:

1. If functions are first-class values, how does program structure change?
2. Why are pure functions easier to test, cache, and make concurrent?
3. How does immutability reduce problems from shared state?
4. Why does referential transparency make programs easier to reason about?
5. Why can Lisp/Scheme treat code as data?
6. What are the differences in binding rules among `let`, `let*`, and `letrec`?
7. What are `eq?`, `eqv?`, and `equal?` each comparing?
8. What steps in the evaluation model do `eval` and `apply` each represent?
9. What is the difference among eager, normal-order, and lazy evaluation?
10. How does strictness describe a function's dependency on argument evaluation?
11. Why does memoization depend on the properties of pure functions?

The key point of functional programming is understanding computation as the composition of values and functions, rather than a sequence of state modifications. Through first-class functions, immutability, referential transparency, and controlled effects, it makes programs easier to reason about and compose. It also reminds us: language design does not have only the imperative path; computation can be organized around expressions, functions, and evaluation strategies.

