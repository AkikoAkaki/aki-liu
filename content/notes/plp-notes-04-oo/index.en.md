---
title: "04 Object Orientation and Dynamic Dispatch"
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
