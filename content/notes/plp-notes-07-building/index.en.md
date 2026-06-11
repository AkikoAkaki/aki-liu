---
title: "07 Building and Running Programs"
date: 2026-04-27
tags: ["programming-languages"]
draft: false
---

The core question of this chapter is: how does a piece of source code become a runnable program, and what management work must the language system continue to perform while the program runs.

The preceding chapters discussed language features: types, objects, functions, concurrency, memory. Here the focus is on how those features land:

```text
source code
-> front end
-> intermediate form
-> optimization
-> code generation
-> executable / bytecode
-> run-time system / virtual machine
-> execution
```

This chapter can be divided into two halves:

* Building a runnable program: how the compiler analyzes, optimizes, and generates code.
* Run-time program management: how the runtime system, virtual machine, and JIT support program execution.

Together they answer one question: how the abstractions of high-level languages are ultimately executed by machines.

## Basic Block

A `basic block` is a contiguous sequence of instructions.

It has two key properties:

* Entry is only possible at the first instruction.
* Exit is only possible at the last instruction.

That is, there are no other entry points in the middle of a basic block, and no sudden jumps out in the middle.

For example:

```text
x = a + b
y = x * 2
z = y - 1
```

If there are no branches, jumps, returns, or exception edges among these three instructions, they can form a basic block.

Basic blocks are the fundamental unit for local compiler optimizations. Because control flow within a block is linear, the compiler can relatively easily analyze:

* Which expressions are repeated
* Which variables are no longer used
* Which computations can be moved earlier
* Which temporaries can be eliminated

## Control Flow Graph

A `control flow graph`, abbreviated CFG, represents all possible execution paths of a program as a graph.

In a CFG:

* Each node is a basic block.
* Each edge indicates that control flow may jump from one block to another.

For example, an `if` statement may form the following structure:

```text
        condition
        /       \
   then block   else block
        \       /
        join block
```

Loops can also appear in a CFG as back edges:

```text
loop header -> loop body -> loop header
```

The CFG is very important to the compiler because many optimizations need to span beyond a single basic block and understand the control flow of the entire function.

For example:

* Finding loops.
* Finding dead code.
* Analyzing variable liveness ranges.
* Performing dataflow analysis.
* Determining whether a branch will never execute.
* Performing global optimizations.

Basic blocks solve the problem of "how to analyze straight-line code"; CFGs solve the problem of "how to analyze branches and loops."

## Virtual Registers

`Virtual registers` are abstract registers used by the compiler in the intermediate representation.

Real machines have very limited registers; for example, x86-64 has only a limited number of general-purpose registers. If the compiler directly uses real registers from the start, optimization becomes very difficult.

So intermediate stages typically first assume unlimited registers:

```text
v1 = a + b
v2 = v1 * c
v3 = v2 - d
```

Here `v1`, `v2`, and `v3` are not necessarily real hardware registers; they are virtual registers.

The roles of virtual registers:

* Abstract away register differences across hardware.
* Make it easier for optimization phases to express intermediate results.
* Temporarily assume sufficient registers are available.
* Separate "generating logic" from "mapping to real registers."

Later, the register allocation phase decides:

```text
v1 -> rax
v2 -> rbx
v3 -> stack slot
```

If real registers are insufficient, spilling occurs.

## Local Code Improvement and Global Code Improvement

`Local code improvement` refers to optimization performed only within a single basic block.

Its characteristics:

* Small scope.
* No complex control flow analysis needed.
* Simple to implement.
* Fast compilation speed.
* Suitable for handling redundancy in straight-line code.

For example:

```text
x = a + b
y = a + b
```

Within the same basic block, the compiler can detect that `a + b` is computed twice and transform it into:

```text
t = a + b
x = t
y = t
```

`Global code improvement` refers to optimization spanning multiple basic blocks, typically performed across the entire function.

It requires a CFG and dataflow analysis. For example, a variable defined in one branch and used in another block -- the compiler needs to know whether the values along different paths are consistent.

Examples of global optimization include:

* global common subexpression elimination
* loop-invariant code motion
* dead code elimination
* constant propagation
* register allocation
* partial redundancy elimination

Local optimization is simpler; global optimization is stronger, but with higher analysis costs.

## Register Spilling

`Register spilling` means that too many values need to be simultaneously held, exceeding the number of physical hardware registers, forcing the compiler to move some values from registers to memory, typically stack slots.

For example, the compiler originally wanted:

```text
v1 -> register
v2 -> register
v3 -> register
...
```

But with insufficient real registers, it can only:

```text
v7 -> stack memory
```

Thereafter, every use of `v7` requires loading from memory; every update requires storing back to memory.

The cost of spilling is high:

* Increases load/store instructions.
* Increases memory access latency.
* Increases instruction count.
* May degrade cache locality.
* Slows down hot paths.

Compilers typically decide which values to keep in registers and which to spill based on variables' usage frequency, liveness ranges, loop positions, and other factors.

Common methods include graph coloring register allocation and linear scan register allocation.

## Intermediate Form

`Intermediate form`, also called IF or IR, is the intermediate representation used internally by the compiler.

There is a large gap between source language and machine instructions. High-level languages have types, functions, objects, exceptions, closures, generics, modules; machine instructions have only registers, memory, jumps, arithmetic, and calls.

The role of IR is to establish an intermediate layer:

```text
source language -> IR -> target machine code
```

It allows the compiler to perform analysis and optimization without directly facing all source language details and all machine details.

## IF Levels

Intermediate forms can exist at different levels: high-level, medium-level, low-level.

### High-Level IF

A high-level IF is close to source code, retaining many source language structures.

A typical example is the AST.

Its advantages:

* Preserves syntactic structure.
* Preserves type information.
* Easier to map back to source code.
* Suitable for high-level semantic analysis.
* Suitable for certain source-language-related optimizations.

Disadvantages:

* Large gap from the machine.
* Strong language dependence.
* Unsuitable for low-level register and instruction optimization.
* Harder to share across multiple languages.

### Medium-Level IF

A medium-level IF strikes a balance between source language and machine. It typically strips away some source language details while remaining platform-independent.

Many general optimizations happen at this level.

For example:

* constant folding
* common subexpression elimination
* dead code elimination
* inlining
* loop optimization
* dataflow analysis

Advantages:

* Relatively language-independent.
* Relatively machine-independent.
* Suitable for reusing optimizers.
* Closer to the execution model than ASTs.

Disadvantages:

* Loses some high-level semantics.
* Still cannot run directly.
* Some machine-specific optimizations cannot yet be done.

LLVM IR can be understood as a somewhat medium-to-low-level IR.

### Low-Level IF

A low-level IF is close to machine instructions, typically resembling assembly with virtual registers.

Advantages:

* Close to real hardware.
* Suitable for instruction selection.
* Suitable for register allocation.
* Suitable for machine-specific optimizations.
* Can precisely express calling conventions, load/store, branches, and other details.

Disadvantages:

* Poor portability.
* Hard to map back to source language structures.
* High-level semantics are already lost.
* Analyzing and reconstructing program structure is more difficult.

A rough understanding:

```text
High-level IR  = close to source code
Medium-level IR = suitable for general optimizations
Low-level IR   = close to the machine
```

## Why Use a Single IF

With multiple source languages and multiple target machines, a single intermediate representation can significantly reduce compiler complexity.

Suppose there are M source languages and N target machines.

If each language directly writes to each machine, you need:

```text
M * N
```

compiler combinations.

If a unified IF is introduced:

```text
source languages -> IF -> target machines
```

You only need:

```text
M front ends + N back ends
```

This turns complexity from a multiplicative relationship into an additive one.

Front ends handle:

* Parsing source code.
* Doing lexical, syntactic, and semantic checks.
* Generating the unified IF.

The middle end handles:

* Performing machine-independent optimizations on the IF.

Back ends handle:

* Mapping IF to concrete machine instructions.
* Performing machine-specific optimizations.
* Handling registers, instruction selection, calling conventions.

The value of this structure is decoupling.

When source languages change, not all back ends need rewriting.
When new machines appear, not every language needs a complete compiler rewrite.

## Why Compilers May Use Multiple IFs

Although a single IF is very valuable, real compilers often use multiple IRs.

The reason is that different phases need different information.

Early phases need to preserve source language structure:

```text
AST / typed AST
```

Middle phases need suitability for optimization:

```text
SSA IR / three-address code
```

Late phases need closeness to the machine:

```text
machine IR / virtual-register assembly
```

Benefits of multiple IRs:

* Each phase uses the most suitable representation.
* High-level optimizations are not disturbed by low-level details.
* Low-level optimizations don't need to handle complex source language structures.
* Compiler structure is clearer.
* Different optimization passes can use information at different granularities.

Disadvantages:

* Conversions between IRs are needed.
* Compiler implementation is more complex.
* More tools and verification logic must be maintained.
* Information may be lost during conversion.

So a single IF is an idealized decoupling model; multiple IFs are a common engineering choice.

## Back End Compiler

The back end is responsible for turning the optimized IR into target machine code.

It typically includes several main phases:

### Instruction Selection

Maps IR operations to target machine instructions.

For example, IR:

```text
x = y + z
```

May be mapped to an `add` instruction on some architecture.

Different CPUs have different instruction sets, so instruction selection is machine-dependent.

### Instruction Scheduling

Adjusts instruction order to improve CPU pipeline, cache, branch prediction, load latency, etc.

For example, if a load instruction must wait for memory, the compiler may schedule independent instructions after it to hide latency.

### Register Allocation

Maps virtual registers to physical registers.

If physical registers are insufficient, spilling to the stack occurs.

### Calling Convention Lowering

Handles parameter passing, return values, stack frames, register saves, and function call protocols.

### Object Code Emission

Generates object files or machine code, including instructions, data sections, symbol tables, relocation information, etc.

The core task of the back end: turn relatively abstract IR into instruction sequences that concrete machines can execute.

## Middle End

The `middle end` is the part of the compiler that performs IR-to-IR transformations.

It does not directly concern itself with source language syntax, nor with specific machine instructions. Its inputs and outputs are typically some form of intermediate representation.

Common middle-end optimizations include:

* inlining
* constant folding
* constant propagation
* dead code elimination
* common subexpression elimination
* loop-invariant code motion
* strength reduction
* escape analysis
* dataflow analysis
* control-flow simplification

The value of the middle end is reuse.

If multiple front ends can all generate the same kind of IR, and multiple back ends can all accept that IR, then the middle end's optimizations can serve many languages and many platforms.

## From Compiler to Runtime

The compiler turns the program into some executable form, but when the program actually runs, the language system may still need to provide support.

For example:

* Memory allocation.
* Garbage collection.
* Exception handling.
* Dynamic type checking.
* Thread scheduling.
* Reflection.
* Class loading.
* Module loading.
* Security checks.
* JIT compilation.
* Program startup and shutdown cleanup.

These functions belong to the run-time system.

## Run-Time System

The `run-time system` is a set of foundational mechanisms provided by the language while the program is running.

The difference from ordinary libraries: the runtime system supports the semantics of the language itself.

Ordinary libraries provide optional functionality. For example, a string processing library, an HTTP library, a math library. You can use them or not.

The run-time system, in contrast, is typically foundational to running the program. Without it, many language features cannot be realized.

For example, Java programs depend on the JVM's class loading, GC, exception handling, thread management, etc. Python programs depend on the Python interpreter and object model. Go programs depend on their own runtime for goroutine scheduling, GC, stack growth, etc.

The run-time system may handle:

* heap allocation
* garbage collection
* stack management
* thread / coroutine scheduling
* exception propagation
* dynamic dispatch support
* type checks
* reflection metadata
* module loading
* program startup
* finalization / cleanup
* interaction with the OS

One can say: the runtime system is the support layer for high-level language abstractions at execution time.

## Difference Between Runtime and Library

A simple way to judge: does this mechanism support the language semantics itself?

For example:

```text
GC             = runtime
exception unwinding = runtime
dynamic type check  = runtime
thread scheduler    = runtime
string utility      = library
HTTP client         = library
JSON parser         = library
```

Of course, boundaries sometimes blur. Some languages place certain features in the standard library, but implementation still requires runtime cooperation.

For example, Go's channels appear as language features but are also closely tied to the runtime scheduler. Java's reflection API is a library form, but underneath depends on class metadata and JVM support.

## Interpreter

An interpreter directly executes the program representation rather than compiling the entire program into native machine code ahead of time.

The simplest interpreter may directly traverse the AST.

For example:

```text
eval(BinaryExpr("+", left, right))
```

Each execution decides what to do based on the AST node type.

AST interpreters are relatively direct to implement, suitable for teaching, scripting languages, small tools, or early prototypes. But performance is usually low because each step requires extensive dynamic dispatch and tree traversal.

To improve performance, many languages first compile source code into bytecode, then execute the bytecode through a virtual machine.

## Virtual Machine

A `virtual machine` here usually refers to a process VM -- a virtual execution environment provided for a single program or a single language.

It typically has its own:

* bytecode instruction set
* operand stack or virtual registers
* method / function representation
* memory model
* type metadata
* exception mechanism
* class / module loader
* garbage collector
* interpreter or JIT compiler

The difference between a VM and an ordinary AST interpreter: a VM typically executes a lower-level, more linear intermediate form, such as bytecode, rather than directly traversing source-code ASTs.

For example:

```text
source code -> bytecode -> VM executes bytecode
```

Bytecode is closer to the machine execution model than ASTs. It is typically a linear instruction sequence, so interpretive execution has lower overhead and is more suitable for JIT compilation.

## System VM and Process VM

Virtual machines can be divided into system VMs and process VMs.

### System VM

A system VM emulates a complete hardware platform that can run a full operating system.

For example, common virtualization software can make a guest OS believe it is running on real hardware.

It abstracts:

* CPU
* memory
* disk
* network
* devices
* ISA or hardware interface

System VMs may also be called hardware virtual machines, machine emulators, platform VMs, etc., depending on the implementation approach and context.

Their goal is to let multiple operating systems share the same physical machine, or let one OS run in a different host environment.

### Process VM

A process VM provides an execution environment for a single program. It is created when the program starts and destroyed when the program ends.

For example:

* JVM
* .NET CLR
* WebAssembly runtime
* The CPython interpreter can also be broadly viewed as a language execution environment

A process VM abstracts a language-level execution environment. It makes the program feel like it is running on a machine specially designed for that language.

Goals of process VMs include:

* Platform independence.
* Security isolation.
* Dynamic loading.
* Managing memory.
* Supporting JIT.
* Providing consistent language semantics.

A rough comparison:

```text
System VM  = virtualizes hardware, runs an entire OS
Process VM = virtualizes a language machine, runs a single program
```

## Managed Code

`Managed code` refers to code whose execution is managed by a runtime or virtual machine.

It typically has these characteristics:

* Automatic memory management.
* Type safety verification.
* Exception handling support.
* Security checks.
* Metadata support.
* Reflection support.
* JIT compilation.
* Cross-platform bytecode or intermediate language.

Java bytecode and .NET IL are typical examples.

Advantages of managed code:

* Stronger security.
* Smaller memory management burden.
* Can perform runtime optimizations.
* Better platform independence.
* Runtime can collect profile information for optimization.

Costs:

* Startup may be slower.
* Runtime system is more complex.
* Memory footprint may be higher.
* An abstraction layer sits between code and underlying hardware.
* Performance predictability is weaker in some scenarios.

## Why Many VMs Use Stack-Based Intermediate Forms

Many VMs use stack-based bytecode because it is simple to implement and instructions are compact.

Stack-based bytecode passes temporary values through an operand stack.

For example, the expression:

```text
a + b
```

May be compiled to:

```text
load a
load b
add
```

`load a` pushes `a` onto the stack, `load b` pushes `b`, `add` pops two values from the stack top, adds them, and pushes the result back.

Advantages of stack-based form:

* Instructions are short; no need to explicitly write many register numbers.
* Bytecode is more compact.
* Code generation is simple.
* Verifying types and stack depth is relatively direct.
* Suitable for interpreter execution.

Disadvantages:

* Requires frequent pushes/pops.
* Data dependencies are sometimes less clear than register-based IR.
* JIT compilation typically first needs to convert to a form more suitable for optimization.
* Expressing complex optimizations is less convenient than SSA/register form.

So stack-based bytecode is suitable as a portable execution format, but optimization phases may convert to another IR.

## JVM Architecture

The Java Virtual Machine can be divided into several main parts.

### Class Loader

The class loader is responsible for loading `.class` files into memory.

It goes beyond just reading files; it also involves:

* Finding classes.
* Loading bytecode.
* Verifying class files.
* Preparing static fields.
* Resolving symbolic references.
* Initializing classes.

Class loading is the foundation of the JVM's dynamic nature. Java can load new classes at runtime and isolate different namespaces through different class loaders.

### Runtime Data Areas

JVM runtime data areas roughly include thread-shared areas and thread-private areas.

Thread-shared areas include:

* heap
* method area / metaspace

Thread-private areas include:

* PC register
* Java stack
* native method stack

The heap stores objects. The Java stack stores the stack frame for each method invocation. The PC register records which bytecode the current thread is executing.

### Execution Engine

The execution engine is responsible for executing bytecode.

It typically includes:

* interpreter
* JIT compiler
* garbage collector

The interpreter can quickly start executing bytecode. The JIT compiles hotspot code into native code. The GC handles automatic memory management.

### JNI and Native Libraries

JNI is the Java Native Interface. It allows Java to call native code such as C/C++, and also allows native code to call the JVM.

This lets Java programs use OS APIs, hardware interfaces, or existing native libraries.

But JNI also bypasses some of the managed environment's safety and portability, so it should be used with care.

## Java Class File

The Java class file is one of the JVM's input formats. It is not source code, but compiled bytecode and metadata.

A class file typically contains:

* magic number
* version
* constant pool
* access flags
* class name
* superclass name
* interfaces
* fields
* methods
* attributes
* bytecode instructions
* exception table
* debug information

The constant pool is particularly important. It stores strings, class names, method names, field names, symbolic references, and other information.

The class file design lets Java achieve:

```text
compile once, run on any JVM
```

As long as the target machine has a compatible JVM, the same bytecode can be loaded and executed.

## Load Time Validity Checks

The JVM performs many validity checks on class files at load time.

The purpose of these checks is to ensure that bytecode does not compromise the JVM's security model and type system.

### Format Checks

Format checks verify whether the basic structure of the class file is legal.

For example:

* Whether the file starts with `0xCAFEBABE`.
* Whether the class file version is supported by the current JVM.
* Whether the constant pool format is correct.
* Whether the file is missing required parts.
* Whether the file has excess or corrupted content.

### Semantic Checks

Semantic checks verify whether the class semantics are legal.

For example:

* Whether the class has a legal superclass.
* Whether it attempts to inherit a final class.
* Whether a non-abstract class implements all abstract methods.
* Whether field and method declarations follow the rules.

### Bytecode Verification

Bytecode verification checks whether instructions are safe.

For example:

* Whether operand types match.
* Whether the operand stack would underflow or overflow.
* Whether local variables are initialized before use.
* Whether branch targets are legal.
* Whether method return types are correct.
* That object references are not forged or type safety broken.

### Symbolic Reference Verification

Many references in class files are symbolic references, representing targets through class names, field names, and method names.

The JVM must confirm:

* The target class exists.
* The target field or method exists.
* The current class has permission to access the target.
* Reference resolution complies with access control rules.

These checks let the JVM block malicious or corrupted bytecode before execution.

## Just-in-Time Compiler

A `JIT compiler` compiles bytecode or intermediate representation into native machine code during program execution.

It sits between an interpreter and an ahead-of-time compiler.

The advantage of an interpreter: fast startup, flexible implementation, but lower long-run performance.
The advantage of AOT compilation: machine code is generated before execution, but it lacks runtime profile information.
The JIT's characteristic: first get running, then optimize hot code based on runtime information.

Potential advantages of JIT:

* Optimize for the real hardware.
* Optimize hot paths based on runtime profiles.
* Perform aggressive inlining.
* Devirtualize.
* Perform escape analysis.
* Eliminate unnecessary boxing/allocation.
* Optimize dynamic calls based on type feedback.
* Spend less compilation cost on infrequently executed code.

Costs:

* Startup phase may be slower.
* Runtime compilation consumes CPU.
* More memory is needed to store compiled code.
* Performance has a warm-up process.
* Behavior is more complex than pure AOT.

## Why JIT Often Takes Bytecode as Input

JIT can take source code or bytecode as input. Many systems prefer bytecode because bytecode has already completed a large amount of front-end work.

Bytecode typically has already handled:

* parsing
* syntax checking
* type checking
* name resolution
* basic semantic checks
* portable representation

Thus the JIT does not need to re-parse from source code each time. It can directly face a more regular representation closer to the execution model.

Bytecode advantages include:

* More compact than source code.
* Easier to verify.
* Easier to distribute cross-platform.
* More suitable for interpretative execution.
* More suitable for conversion to optimization IR.
* Can hide some source code details.

So JIT inputting bytecode is essentially separating front-end compilation from runtime optimization.

## Hot Path

A `hot path` refers to the code path with the highest execution frequency in the program.

It may be:

* The core loop.
* High-frequency functions.
* Frequently taken if branches.
* Critical request paths.
* Numerical computation kernels.
* High-frequency object method calls.

Hot paths are important because program performance is typically determined by a few high-frequency paths.

If a piece of code executes only once, even a 10× optimization has minimal impact on overall performance.
If a piece of code executes a billion times, even saving one instruction per execution can significantly improve performance.

JITs pay special attention to hot paths. They can first interpret-execute the program while collecting profile information:

* Which methods are most frequently called.
* Which branches are most frequently taken.
* What types typically appear at a given virtual call site.
* Which objects do not escape.
* Which loops are hottest.

Then the JIT compiles this hot code into more efficient native code.

## How JIT Inlines Virtual Methods

Virtual methods normally require dynamic dispatch. The compiler at the static stage may not know the concrete call target.

But the JIT has runtime profile information. It may discover that a given call site is almost always the same type in practice.

For example:

```java
shape.draw()
```

Theoretically, `shape` could be `Circle`, `Rectangle`, `Triangle`.
But runtime profiles show that 99% of the time it's `Circle`.

The JIT can perform optimistic optimization:

1. Assume it's typically `Circle`.
2. Insert a type check.
3. If it is indeed `Circle`, directly call and inline `Circle.draw()`.
4. If another type later appears, take the fallback path, possibly deoptimizing.

This optimization can bring dynamic call performance close to static call performance.

This is also one of the JIT's advantages: it can leverage runtime facts, not just compile-time types.

## Deoptimization

JITs often perform assumption-based optimization.

For example, it assumes:

* A certain variable is always a certain type.
* A certain class has not been extended by new subclasses.
* A certain branch is basically never taken.
* A certain object does not escape.

If these assumptions later become invalid, the runtime needs to retract the optimization and return to a more general execution method. This process is called deoptimization.

The existence of deoptimization allows JITs to optimize boldly while preserving language semantic correctness.

It can be understood as:

```text
First generate a fast path based on current facts
If the facts change, fall back to the safe path
```

This is very important for dynamic languages and managed runtimes.

## Reflection

`Reflection` refers to a program's ability to access, inspect, and even modify its own structure at runtime.

It typically includes:

* Obtaining an object's class.
* Inspecting a class's fields and methods.
* Finding methods by string name.
* Dynamically creating objects.
* Dynamically invoking methods.
* Reading annotations/metadata.
* Modifying access permissions or properties.

For example, in Java, through reflection you can:

```java
Class<?> c = Class.forName("User");
Object obj = c.getConstructor().newInstance();
```

Roles of reflection include:

* Framework development.
* Dependency injection.
* ORM.
* Serialization/deserialization.
* Testing tools.
* Plugin systems.
* Dynamic loading.

Many modern frameworks depend on reflection because frameworks need to operate on concrete business classes without knowing them in advance.

## Costs and Abuse of Reflection

Reflection is powerful but cannot be used casually, especially not frequently executed on hot paths.

Problems include:

* High dynamic lookup cost.
* Hard for the compiler and JIT to inline.
* Type checking deferred to runtime.
* May produce boxing/unboxing.
* Breaks encapsulation.
* Makes code harder to read.
* May bypass access control.
* Refactoring is not easily discovered by IDEs and compilers.

For example, if every request uses string lookups to find fields and dynamically call methods, performance degrades significantly. Better approaches are typically:

* Reflect once at startup, cache results.
* Use code generation to produce direct call code.
* Use method handles/function pointers to cache access paths.
* Avoid reflective lookups in core loops.

Reflection is suitable for framework boundaries and metaprogramming, not as a substitute for ordinary method calls.

## Summary

Building and Running Programs can be threaded together with several sets of questions:

1. Why is the basic block the fundamental unit of local optimization?
2. How does the CFG represent all possible control flows of a program?
3. Why can virtual registers let the compiler first assume infinite registers?
4. Why does register spilling significantly degrade performance?
5. What stages are high-level, medium-level, and low-level IR each suited for?
6. Why can a unified IF turn multi-language, multi-platform compiler complexity from multiplication into addition?
7. Why do real compilers still often use multiple IRs?
8. What is the value of the IR-to-IR optimizations done by the middle end?
9. How does the back end map IR to real machine instructions?
10. What is the difference between a run-time system and an ordinary library?
11. Why do VMs typically execute bytecode rather than ASTs directly?
12. What do system VMs and process VMs each abstract?
13. What capabilities does managed code gain by depending on a runtime?
14. How does the JVM support Java programs through class loading, verification, interpreter, JIT, and GC?
15. How does JIT leverage hot paths and runtime profiles for optimization?
16. Why is reflection powerful, yet easily destructive to performance and maintainability?

The key point of this chapter is connecting compile-time and runtime together. The compiler handles turning source code into a representation closer to the machine; the runtime handles continuing to support language semantics while the program runs. IR, CFG, virtual registers, JIT, VM, GC, reflection -- these things may seem scattered, but they all solve the same problem: how to keep high-level languages abstract while still being executed efficiently and safely by real machines.
