---
title: "Notes on Programming Language Design and Implementation"
date: 2026-04-28
tags: ["programming-languages"]
draft: false
---

This set of notes is compiled from *Programming Language Pragmatics* course review material, covering type systems, composite types, subroutines, object orientation, functional languages, concurrency, compilation and runtime systems, and other topics.

The focus is on placing programming language concepts back into a few core questions:

* How is a value classified, checked, and interpreted?
* How do complex data structures map to memory?
* What actually happens at runtime during a function call?
* How are objects, inheritance, and dynamic dispatch implemented?
* How do functional languages organize computation?
* How do concurrent programs manage multiple control flows and shared state?
* How do compilers, virtual machines, and runtime systems support high-level language abstractions?

Programming language concepts may initially seem abstract, but most are closely tied to concrete implementation choices. Type systems affect safety and code reuse. Record layout affects memory alignment and comparison. Function calls affect stack frames and registers. Virtual methods affect object layout and dispatch overhead. Coroutines affect scheduling and control flow. Garbage collection simultaneously affects memory safety and pause times.

The goal of these notes is to connect these concepts and reveal the tradeoffs behind language design.

## [01 Type Systems](../plp-notes-01-types/)

Types discusses how a language understands "what" a value is.

Core questions include:

* What role do types play in a language?
* What is the difference between strongly typed and statically typed?
* How do type equivalence and type compatibility differ?
* When are structural equivalence and name equivalence each appropriate?
* What is the relationship among polymorphism, generics, overloading, and duck typing?
* How does type inference, especially Hindley-Milner, derive types from constraints?
* Why is equality testing more subtle than it appears on the surface?

The key point: types are not just variable labels. They simultaneously affect legal operations, error checking, memory representation, code reuse, and abstraction boundaries.

## [02 Composite Types and Memory Layout](../plp-notes-02-composite-types/)

Composite Types discusses how multiple values are organized into more complex data structures, and how those structures are represented in memory.

Core questions include:

* Why do holes and padding appear in records/structs?
* Why can packing save space but potentially lose performance?
* How do unions, variant records, and sum types represent multiple data forms?
* What is the difference between width subtyping and depth subtyping?
* How do arrays, slices, row-major, and column-major affect access efficiency?
* What are pointers, addresses, and references?
* What two opposite problems are dangling references and garbage?
* How do reference counting, tracing GC, and generational GC each balance tradeoffs?

The key point: composite types are language abstractions on the surface, but at the bottom they boil down to object layout, addressing, copying, comparison, and reclamation.

## [03 Subroutines and Control Abstraction](../plp-notes-03-subroutines/)

Subroutines discusses how function calls encapsulate a block of code into a control structure that can be entered, returned from, and nested.

Core questions include:

* What is a calling sequence?
* What are prologue and epilogue each responsible for?
* Why are both the stack pointer and frame pointer important?
* How do static chains and displays support nested function access to outer variables?
* Are parameters call-by-value, call-by-reference, call-by-sharing, or other modes?
* When an exception occurs, how does stack unwinding clean up the call stack?
* What is the difference between coroutines and threads?
* How do event loops, callbacks, and async/await express non-blocking control flow?

The key point: function calls are not mere syntactic sugar. Behind every call are stack frames, registers, parameter passing, return addresses, and exception handling protocols.

## [04 Object Orientation and Dynamic Dispatch](../plp-notes-04-oo/)

Object Orientation discusses how objects encapsulate state and behavior together, and how the runtime selects method implementations based on an object's actual type.

Core questions include:

* What problems do encapsulation, inheritance, and polymorphism each solve?
* How does abstraction reduce complexity and protect object invariants?
* Why is the `this` parameter a hidden parameter of method calls?
* How do constructors and destructors manage object lifecycles?
* Why aren't initialization and assignment the same thing in C++?
* What is the difference between static binding and dynamic binding?
* What is the difference between overriding and redefining?
* How does the vtable implement virtual method dispatch?
* How does interface inheritance avoid the problems of multiple implementation inheritance?
* How does inline caching optimize dynamic dispatch?

The key point: OOP is not just class syntax, but an entire object model, abstraction boundaries, and runtime dispatch mechanism.

## [05 Functional Languages](../plp-notes-05-functional/)

Functional Languages discusses how programs are organized when functions, expressions, and value transformations are placed at the center of the language.

Core questions include:

* Why is lambda calculus the theoretical foundation of functional programming?
* What expressive power do first-class functions bring?
* Why are pure functions, immutability, and referential transparency important?
* What are the differences in binding rules among `let`, `let*`, and `letrec` in Scheme?
* What do `eq?`, `eqv?`, and `equal?` each compare?
* Why does Lisp's homoiconicity make macros and metaprogramming particularly natural?
* What steps in the evaluation process do eval and apply each represent?
* What is the difference among eager, normal-order, and lazy evaluation?
* Why does memoization depend on the properties of pure functions?

The key point: functional languages organize computation as expressions and function composition, and make programs easier to reason about, test, and execute concurrently by reducing mutable state.

## [06 Concurrency](../plp-notes-06-concurrency/)

Concurrency discusses how language and runtime schedule multiple simultaneously advancing control flows within a program and protect shared state.

Core questions include:

* What is the difference among concurrent, parallel, and distributed?
* Why do race conditions depend on uncontrollable execution interleaving?
* How does synchronization handle mutual exclusion and condition waiting?
* How do the costs and capabilities of coroutines, user-level threads, kernel threads, and processes differ?
* When is busy waiting wasteful, and when might it be reasonable?
* Why can message passing reduce explicit locks?
* What hardware primitives do test-and-set and compare-and-swap provide?
* How do monitors, condition variables, and semaphores organize synchronization?
* Why does deadlock occur, and how can it be prevented, avoided, or detected?
* How do futures represent an asynchronous computation as a value?

The key point: the difficulty of concurrent programming is not just doing many things at once, but that multiple control flows share resources, interleave execution, wait for conditions, and compete for CPU.

## [07 Building and Running Programs](../plp-notes-07-building/)

Building and Running Programs examines compile-time and runtime together, discussing how source code becomes executable programs, and how runtimes, VMs, and JITs continue to support language semantics.

Core questions include:

* How do basic blocks and control flow graphs help compilers analyze programs?
* Why do virtual registers let optimization phases temporarily assume infinite registers?
* Why does register spilling degrade performance?
* What stages are high-level, medium-level, and low-level IR each suited for?
* Why can a unified intermediate form reduce compiler complexity for multiple languages and platforms?
* What are the respective responsibilities of the middle end and back end?
* What is the difference between a run-time system and an ordinary library?
* What do process VMs and system VMs each abstract?
* What capabilities does managed code gain by depending on a runtime?
* How does the JVM support Java programs through class loading, verification, interpreter, JIT, and GC?
* How does JIT leverage hot paths and runtime profiles for optimization?
* Why is reflection powerful, yet easily destructive to performance and maintainability?

The key point: high-level language abstractions ultimately rely on compilers and runtimes working together. IR, CFG, VM, JIT, GC, and reflection may seem disparate, but they all answer the same question: how to keep high-level languages abstract while still being executed efficiently and safely by real machines.

## Suggested Reading Order

Reading in order from 01 to 07 is recommended, as they roughly progress from language semantics toward implementation mechanisms:

```text
01 Type Systems
→ 02 Composite Types and Memory Layout
→ 03 Subroutines and Control Abstraction
→ 04 Object Orientation and Dynamic Dispatch
→ 05 Functional Languages
→ 06 Concurrency
→ 07 Building and Running Programs
```

The first few chapters focus on how languages organize values, data, and control flow. The later chapters gradually shift toward runtime, concurrency, and compiler implementation.

If you only want to quickly build an overall framework, read the summary section of each chapter first, then revisit the details.

## The Big Picture

This set of notes can be compressed into one large question:

```text
A programming language is a set of abstractions.
A compiler and runtime system make those abstractions executable.
```

Type systems define what operations are legal.
Composite types define how data is organized.
Subroutines define how control flow enters and returns.
Object systems define how state and behavior are bound.
Functional languages define how computation is organized through expressions and function composition.
Concurrency mechanisms define how multiple control flows advance simultaneously.
Compilers and runtime systems are responsible for turning all of this into programs that machines can execute, manage, and optimize.

Understanding programming languages is not just memorizing syntax, but understanding the design tradeoffs behind each language feature: safety, performance, expressiveness, maintainability, implementation complexity, and how much mental burden the programmer must bear.
