---
title: "03 Subroutines and Control Abstraction"
date: 2026-04-23
tags: ["programming-languages"]
draft: false
---

The core question of the subroutines chapter is: how does a language encapsulate a block of code into a callable unit, and what actually happens at runtime during a function call.

On the surface, a function call is just:

```text
f(x)
```

But at the implementation level, many things must be handled:

* How parameters are passed in
* How return values are passed back
* Where local variables are placed
* How to return to the original location after the call ends
* How nested functions access outer variables
* How to clean up stack frames when exceptions occur
* How coroutines and threads save and restore control flow

So this chapter connects "function abstraction in the language" with "control flow and stack frames on the machine."

## Calling Sequence

The `calling sequence` is a set of steps that the caller and callee jointly perform during a subroutine call.

Its purpose is to make a function call a resumable, nestable, returnable process. Before entering the subroutine, the program must save enough information; after the subroutine finishes, it must restore the pre-call state and hand back the return value.

The calling sequence can be divided into two directions:

```text
on entry: entering the subroutine
on return: leaving the subroutine
```

### On Entry

When entering a subroutine, the following are typically done:

1. Pass parameters.
2. Save the return address, i.e., where execution should resume after the function ends.
3. Adjust the stack pointer to allocate space for the new stack frame.
4. Save necessary registers, such as the frame pointer and callee-saved registers.
5. Initialize local variables or local objects.
6. Jump the program counter to the subroutine's entry point.

Some of these tasks are done by the caller, some by the callee's prologue.

### On Return

When leaving a subroutine, the following are typically done:

1. Place the return value.
2. Clean up local variables or local objects.
3. Restore the stack pointer.
4. Restore saved registers.
5. Restore the frame pointer.
6. Return to the caller based on the return address.

The callee's epilogue is responsible for cleaning up the current function's own state, while the caller handles the return value and post-call cleanup.

## Prologue and Epilogue

The `prologue` is a short piece of code at the very beginning of the subroutine that sets up the current function's execution environment.

It typically does:

* Save the old frame pointer.
* Set the new frame pointer.
* Allocate stack space for local variables.
* Save callee-saved registers.
* Initialize local objects.

The `epilogue` is a short piece of code before the subroutine returns that undoes what the prologue did.

It typically does:

* Destruct or clean up local objects.
* Restore callee-saved registers.
* Restore the old frame pointer.
* Pop the current stack frame.
* Jump back to the return address.

The existence of prologue and epilogue allows function calls to be nested to arbitrary depths, with each level having its own local environment.

## Stack Pointer and Frame Pointer

The `stack pointer` points to the current top of the stack. The stack changes constantly at runtime; pushes, pops, function calls, and local variable allocations all move the stack pointer.

The `frame pointer` points to a fixed position within the current stack frame. It typically remains stable during function execution.

Why are both usually needed?

Because if only the stack pointer is used, the offsets of local variables and parameters relative to the stack pointer may change constantly. For example, if temporary values are pushed or variably sized local space is allocated, the stack pointer moves, making it difficult for the compiler to access variables at fixed offsets.

The frame pointer provides a stable baseline:

```text
local variable = FP - fixed offset
parameter      = FP + fixed offset
```

It also aids debugging. When a program crashes, the debugger can reconstruct the call stack through the frame pointer.

Some optimizing compilers omit the frame pointer, using it as an ordinary register. But conceptually, the frame pointer is key to understanding stack frames.

## Static Chain

In languages that support nested functions, an inner function may access variables of an outer function.

For example:

```text
function outer() {
    var x

    function inner() {
        use x
    }
}
```

When `inner` executes, it needs to find `outer`'s stack frame to access `x`. This is where the static chain comes in.

A `static chain` is a chain composed of static links. Each stack frame stores a static link pointing to the stack frame of its lexically enclosing function in the source code.

Note that "static" here refers to lexical nesting, not call order.

The process of maintaining the static chain is roughly:

1. The caller, based on the lexical nesting relationship between itself and the callee, computes the static link the callee should receive.
2. The caller passes this static link to the callee as a hidden parameter.
3. The callee stores the static link in its own stack frame in the prologue.
4. When the callee needs to access an outer variable, it follows the static link to find the corresponding outer frame, then accesses the variable at a fixed offset.

The advantage of the static chain is simple implementation. The disadvantage is that if nesting levels are deep, accessing very outer variables requires multiple hops along the chain.

## Display

A `display` is another mechanism for supporting nested scope access.

It can be understood as an array, where each position records the stack frame address corresponding to a certain lexical nesting level.

For example:

```text
display[0] = global scope frame
display[1] = level 1 frame
display[2] = level 2 frame
```

If the current function is at level 3 and wants to access a variable at level 1, it can directly use:

```text
display[1] + offset
```

This makes accessing outer variables O(1), without needing to hop level by level like the static chain.

### Display vs. Static Chain

| Dimension | Static Chain | Display |
| ---- | ---- | ---- |
| Basic structure | Each frame has one static link | An external array recording frames at each level |
| Accessing outer variables | May need multiple hops | Direct indexing, typically O(1) |
| Call maintenance cost | Lower | Must update display on calls and returns |
| Implementation complexity | Simple | More complex |
| Suitable scenarios | Fine when nesting is not deep | More advantageous when deep nesting accesses are frequent |

Overall, the static chain is simpler; the display has faster access but higher maintenance cost.

## Why Parameters Are Often Passed in Registers

Modern machines typically pass the first few parameters in registers rather than pushing everything onto the stack.

The reason is straightforward:

* Register access is extremely fast.
* Stack access goes through the memory hierarchy, possibly hitting cache or missing.
* Register passing requires fewer instructions.
* Modern CPUs have more general-purpose registers that can handle common parameter counts.

For example, the x86-64 common calling convention places the first few integer or pointer parameters in registers. Only when there are too many parameters, they are too large, or their address is needed does the stack become more heavily relied upon.

## Caller-Saved and Callee-Saved Registers

Calling conventions typically specify that some registers are saved by the caller and others by the callee.

`Caller-saved registers` means: if the caller believes the values of certain registers will still be needed after the call, it must save them itself before the call. The callee can freely overwrite these registers.

`Callee-saved registers` means: if the callee wants to use these registers, it must save them on entry and restore them before returning. The caller can assume these registers remain unchanged across the call.

Why are they split into two categories?

If all are caller-saved, the caller doesn't know which registers the callee will use and may save too many.
If all are callee-saved, the callee also doesn't know which registers the caller cares about and may also save too many.

By splitting into two categories, the compiler can place short-lifetime temporaries in caller-saved registers and long-lifetime values in callee-saved registers. This reduces overall overhead.

## Why Certain Tasks Tend to Fall on the Callee

Some tasks could theoretically be done by either the caller or the callee. Often the preference is for the callee, primarily to reduce code size.

If every caller generates the same cleanup code repeatedly, many duplicate instructions appear in the program. Placing them in the callee requires only one copy.

Additionally, the callee knows more about its own internals:

* How much local space is needed
* Which registers will be used
* Which local objects need cleanup
* What state to restore before returning

So placing these tasks in the callee is usually more aligned with encapsulation and easier to maintain.

## Why Parameter Space May Remain in the Stack Even with Register Passing

Even when parameters are passed in registers, the compiler or ABI may still reserve parameter space in the stack.

Reasons include:

* Registers don't have addresses. If the program needs to take the address of a parameter, the parameter must be placed in memory.
* When the function is complex, registers may be insufficient and parameters must spill to the stack.
* Variadic functions need parameters in a contiguous region for easy traversal.
* Debuggers and exception handling mechanisms may need more stable call information.
* Some ABIs mandate reserved shadow space or home space.

So register passing is an optimization for the common path, but the stack remains an important fallback structure for function call semantics.

## Calling Sequence Optimizations

In special cases, the compiler can optimize the calling sequence.

For example, a leaf routine -- a function that calls no other functions. It may not need to fully establish a stack frame, nor need to save complex state beyond the return address.

Common optimizations include:

* Omitting the frame pointer.
* Omitting unnecessary register saves.
* Using shorter prologue/epilogue for leaf functions.
* Using tail-call optimization, directly reusing the current stack frame.
* Inline expansion, eliminating call overhead entirely.
* Constant propagation and dead code elimination on small functions.

The core goal of these optimizations is: if certain call protocol elements are unnecessary in the current scenario, don't pay the full cost.

## Inline Subroutines and Macros

An `inline subroutine` is a function. It has normal type checking, scoping rules, and semantic constraints. The compiler simply expands the function body at the call site, reducing function call overhead.

A `macro` is usually a textual or syntactic-level substitution. Especially in the C preprocessor, macros do not perform normal type checking and do not follow ordinary function scoping rules.

For example:

```c
#define SQUARE(x) x * x
```

If called as:

```c
SQUARE(a + b)
```

It may expand to:

```c
a + b * a + b
```

Which is different from what was intended.

Inline subroutines are safer; macros are lower-level, more flexible, and also more error-prone.

## When Inlining Is Appropriate

Situations where inlining is appropriate include:

* The function body is very small, with call overhead larger than the function itself.
* The function is called very frequently.
* Constants are passed at the call site, enabling constant folding after inlining.
* The compiler needs more context for further optimization.
* Virtual function calls can be devirtualized in some scenarios and then inlined.

But inlining also has costs. Excessive inlining bloats code size, affects instruction cache, and can even reduce performance.

So the value of inlining is not "the more the better," but letting the compiler eliminate abstraction costs where appropriate.

## Formal Parameters and Actual Parameters

`Formal parameters` are the parameters in the function definition -- the parameter names.

For example:

```c
int add(int x, int y)
```

Here `x` and `y` are formal parameters.

They are local names within the function. When the function is not called, they have no concrete values.

`Actual parameters` are the actual arguments passed at the call site.

For example:

```c
add(a + 1, b)
```

Here `a + 1` and `b` are actual parameters.

Simply put:

```text
formal parameter = placeholder in the function definition
actual parameter = actual expression or value passed at the call
```

## Parameter-Passing Modes

The parameter-passing mode determines the relationship between actual parameters and formal parameters.

Common modes include:

* call-by-value
* call-by-reference
* call-by-result
* call-by-value-result
* call-by-name
* call-by-sharing

Different languages choose different combinations.

## Call-by-Value

`Call-by-value` copies the value of the actual parameter to the formal parameter.

Modifying the formal parameter inside the function does not affect the original variable in the caller.

For example:

```c
void f(int x) {
    x = 10;
}

int a = 1;
f(a);
// a is still 1
```

Pros:

* Simple.
* Safe.
* Less prone to side effects.
* Low cost for small data.

Cons:

* High copying cost for large objects.
* Functions cannot directly modify the caller's variables through parameters.

Suitable for small, immutable, or data that should not be modified.

## Call-by-Reference

`Call-by-reference` makes the formal parameter an alias for the actual parameter.

Modifications to the formal parameter inside the function are directly reflected in the caller's variable.

For example, conceptually:

```text
f(x) modifies the caller's x itself
```

Pros:

* Allows functions to modify the caller's variables.
* Only needs to pass an address for large objects, avoiding copying.

Cons:

* Prone to side effects.
* Aliasing makes programs harder to reason about.
* Debugging is more complex.

Suitable for output results, modifying large objects, or avoiding copying.

## Call-by-Result

`Call-by-result` means the formal parameter does not take its value from the actual parameter on function entry, but on return, the final value of the formal parameter is copied back to the actual parameter.

It behaves like an output parameter.

Conceptually:

```text
Entering: do not read actual
Leaving: formal -> actual
```

This mode suits situations where the function should only produce output results without reading the original value.

The problem is that if multiple formal parameters write back to the same actual parameter, the write-back order affects the result.

## Call-by-Value-Result

`Call-by-value-result` is also called copy-in / copy-out.

On function entry, the value of the actual parameter is copied to the formal parameter.
On function exit, the final value of the formal parameter is copied back to the actual parameter.

Conceptually:

```text
Entering: actual -> formal
Leaving: formal -> actual
```

It resembles call-by-reference, but the function operates on a local copy in between. The difference lies in aliasing behavior; especially when multiple parameters reference the same actual variable, the result may differ from call-by-reference.

## Call-by-Name

`Call-by-name` means the actual parameter is not evaluated before the call; instead, the expression itself is deferred into the function and re-evaluated each time the formal parameter is used.

It can be understood as wrapping the parameter expression as a thunk.

This mode is famous from Algol 60.

The advantage is great flexibility, enabling deferred evaluation. The disadvantage is complex implementation and easy production of hard-to-understand side effects.

Modern languages more commonly achieve similar effects through lambdas, closures, or lazy evaluation.

## Call-by-Sharing

Languages with a reference model, such as Java, Python, JavaScript, and Ruby, are closer to `call-by-sharing`.

Call-by-sharing means: a copy of the object reference is passed to the function.

The function cannot change which object the caller's variable points to by rebinding the formal parameter, but it can modify the object's internal state through this reference.

For example, in Python:

```python
def f(x):
    x.append(1)

a = []
f(a)
# a becomes [1]
```

Here the function modified the object's contents, so the caller sees the change.

But if written:

```python
def g(x):
    x = [1]

a = []
g(a)
# a is still []
```

Here `x = [1]` only makes the formal parameter point to a new object; it does not change `a` in the caller.

So the difference between call-by-sharing and call-by-reference is: what is shared is the object, not the variable binding itself.

## How to Choose a Parameter-Passing Mode

A few questions can guide the decision:

* Data is small and should not be modified: call-by-value.
* Data is large but should not be modified: pass reference/pointer to const, or shared references in the language.
* Need the function to modify caller-visible state: call-by-reference or similar output parameter.
* Want to avoid copying but not expose mutability: immutable objects, const reference, borrowed reference.
* In reference-model languages, be aware of whether the function can modify the object's internal state.

The core tradeoff is:

```text
copying cost vs. side-effect risk
```

## Default Parameters

Default parameters mean function parameters can have default values. If the caller does not pass a certain parameter, the language automatically uses the default.

For example:

```python
def connect(host, port=80):
    ...
```

Default parameters are typically implemented in two ways:

* The compiler fills in the default value at the call site.
* The function entry checks whether the parameter is missing and fills in the default.

Default parameters make APIs cleaner but can cause ambiguity, especially when there are many parameters with similar types.

## Named Parameters

Named parameters, also called keyword parameters, allow specifying parameter names at the call site.

For example:

```python
connect(host="example.com", port=443)
```

Benefits:

* Calls are clearer.
* Less prone to passing wrong order when there are many parameters.
* Only some optional parameters need to be specified.
* API readability is stronger.

Cost: parameter names in function signatures become part of the public interface; changing names later may break caller code.

## Variable-Length Argument Lists

Variable-length argument lists allow functions to receive an indefinite number of arguments.

For example, in C:

```c
printf("%d %s", x, s);
```

This mechanism suits formatted output, logging, constructing lists, and similar scenarios.

C/C++ varargs are relatively low-level with weak type safety. The programmer and library functions must interpret arguments according to the format string themselves.

Java and C# variadic arguments are typically more type-safe, essentially closer to arrays:

```java
void f(String... args)
```

The compiler knows the element types of the arguments and can do more checking.

## Return Value Mechanisms

Function return values can be implemented in several ways.

First, through registers. Small integers, pointers, and floating-point values can typically be placed directly in specific registers.

Second, through a memory location provided by the caller. For large objects, the caller can pre-allocate space and pass the address to the callee, which writes the result there.

Third, through heap allocation. The function creates an object and returns a reference or pointer to the caller. This allows the object to survive beyond the function call, but introduces memory management issues.

The differences among mechanisms:

* Small values suit registers -- fast.
* Large objects suit caller-allocated return slots -- avoid copying.
* Dynamic objects suit the heap -- but require GC or manual management.

## Structured Exceptions

`Structured exceptions` are language-level exception handling mechanisms. They separate error handling from normal business logic.

Advantages include:

* The normal path is clearer.
* Exceptions can automatically propagate upward until a suitable handler is found.
* Can carry error information, types, and stack traces.
* With `finally` or RAII, resource cleanup can be guaranteed.
* Error handling logic can be centralized at appropriate locations.

Without structured exceptions, programmers commonly use these methods:

* Return error codes, e.g., `-1` for failure.
* Use special return values, e.g., `null`.
* Set global error variables, e.g., C's `errno`.
* Return errors through output parameters.
* Pass in callback or handler functions.

These methods work but tend to fill every layer of calls with error checks.

## Exceptions as Classes

Languages like C++, Java, and C# define exceptions as classes, offering several benefits:

* Error categories can be distinguished through type hierarchies.
* Can carry extra fields, such as error codes, filenames, and context.
* Handlers can catch a parent class exception, thereby handling a group of related errors.
* Can reuse ordinary OO mechanisms like inheritance and polymorphism.

For example:

```java
catch (IOException e)
```

Can catch all I/O-related exceptions.

## try...finally

The core purpose of `try...finally` is guaranteed execution.

No matter what happens in `try`, the code in `finally` should execute.

Common situations include:

* `try` completes normally, then `finally` executes.
* An exception occurs in `try`; `finally` executes first, then handler search continues.
* `return`, `break`, `continue` execute in `try`; `finally` still executes first.

It is mainly used for resource cleanup:

```java
try {
    use(resource);
} finally {
    resource.close();
}
```

This ensures that even if an error occurs midway, files are closed, locks released, and connections disconnected.

## Zero-Cost Exceptions

Some language implementations try to make the normal path have no extra runtime overhead. This is usually called zero-cost exceptions.

The idea is:

* Generate exception handling tables at compile time.
* During normal execution, do not insert extra checks at each `try` block.
* When no exception occurs, the program incurs almost no runtime cost.
* When an exception does occur, look up the table based on the current instruction address, perform stack unwinding, and find the handler.

The tradeoff of this mechanism:

* The normal path is fast.
* The binary needs to store exception tables, incurring space overhead.
* Exception handling is very slow.

So exceptions are suitable for handling exceptional situations, not for use as ordinary control flow.

## Stack Unwinding and Implicit Handlers

When an exception occurs in a function but no suitable catch handler is found in the current function, the runtime needs to leave the current function and continue searching upward in the caller.

This process is called stack unwinding.

The subroutine's implicit handler must do several things:

1. Clean up local objects already constructed in the current function.
2. Execute necessary finally or destructor logic.
3. Restore registers, frame pointer, and other call state.
4. Pop the current stack frame.
5. Return to the caller's exception search process.
6. If no handler is ever found, terminate the program and report the error.

So exceptions are not simple jumps. They must ensure that at each layer leaving the function, resources and runtime state are correctly handled.

## Coroutines

A coroutine is a control flow that can actively suspend and resume.

An ordinary function call is:

```text
caller -> callee -> return to caller
```

A coroutine can be:

```text
A runs -> A yields -> B runs -> B yields -> A resumes
```

It does not necessarily return only after finishing; it can save state midway and continue execution later.

## Coroutines and Threads

Coroutines and threads can both represent multiple control flows, but their scheduling methods and overhead differ.

| Dimension | Coroutine | Thread |
| ---- | ---- | ---- |
| Scheduler | Programmer or language runtime | OS kernel |
| Switching method | Voluntary yield / await | Can be preempted by OS |
| Switching cost | Low | High |
| Parallel capability | Usually concurrent, not necessarily parallel | Can run in parallel on multiple cores |
| Suitable scenarios | Async I/O, many lightweight tasks | CPU parallelism, blocking system calls |

The advantage of coroutines is lightweight, suitable for many waiting-oriented tasks. The advantage of threads is true parallelism, suitable for tasks requiring multi-core execution.

## Stackful and Stackless Coroutines

Coroutines can be divided into stackful and stackless.

### Stackful Coroutines

A stackful coroutine has its own stack. It can yield deep within nested calls and later resume from the same position.

Pros:

* Strong expressive power.
* Can be written like ordinary synchronous code.
* Can suspend from deep call chains.

Cons:

* Each coroutine needs stack space.
* Higher switching cost than stackless.
* More complex implementation.

Representative mechanisms or languages include Lua coroutines, Go goroutines, etc. Strictly speaking, Go goroutines are closer to lightweight threads managed by the runtime, but they have independent growable stacks, so they are often understood within the stackful control flow model.

### Stackless Coroutines

A stackless coroutine has no independent call stack. The compiler or runtime typically converts async functions into state machines.

Pros:

* Low memory overhead.
* High performance.
* Very suitable for the async/await model.

Cons:

* Can only suspend in functions marked as async.
* Ordinary functions cannot arbitrarily yield.
* Async propagates through function signatures.

Representative examples include JavaScript, Python async, C# async, Rust async.

## Coroutine Stack Allocation

If a coroutine is stackful, how the stack is allocated must be considered.

Three common approaches exist.

First, a fixed-size stack. Simple to implement, fast switching, but prone to wasting memory and possible stack overflow.

Second, a growable stack. Starts very small, expands when needed. Good memory utilization, but complex to implement with extra cost on expansion.

Third, a segmented stack. The stack is composed of multiple small segments; more are appended when more space is needed. Avoids one-time large stack allocation, but makes stack access and debugging more complex.

These approaches all balance:

```text
implementation simplicity / memory utilization / switching cost / stack overflow risk
```

## Event

In the programming language sense, an event can be understood as the system notifying the program to handle something after some external or internal situation occurs.

For example:

* User clicks a button.
* A network request completes.
* A file read finishes.
* A timer expires.
* A message arrives.
* A sensor state changes.

The key point about events: the program does not run linearly from start to finish, but waits for things to happen, then executes corresponding handlers.

## Event Loop

The event loop is a common event-handling strategy.

The system maintains an event queue. The program continuously takes events from the queue and executes corresponding handlers.

The flow is roughly:

```text
wait for event -> dequeue event -> run handler -> wait for next event
```

Pros:

* Simple model.
* Single-threaded event loops don't need locks.
* Execution order is relatively predictable.
* Very suitable for UI and I/O-intensive programs.

Cons:

* A handler that takes too long blocks the entire loop.
* CPU-intensive tasks cause UI freezes or request delays.
* Long tasks must be split or delegated to workers.

JavaScript's async model is deeply connected to the event loop.

## Concurrent Dispatch / Callbacks

Another event strategy is concurrent dispatch. When an event occurs, the system distributes handlers to different threads or thread pools for execution.

Pros:

* Less likely to be stuck by a single handler.
* Can utilize multi-core CPUs.
* High throughput.
* Suitable for server-side concurrent request processing.

Cons:

* Multiple handlers may simultaneously access shared data.
* Requires locks, atomic operations, or other synchronization mechanisms.
* Debugging is more complex.
* Thread switching and scheduling incur extra overhead.

A rough understanding:

```text
event loop: sequential processing, simple but afraid of blocking
concurrent dispatch: parallel processing, powerful but must synchronize
```

## Asynchronous Programming

Asynchronous programming focuses on: when encountering a wait, don't block the current control flow.

Typical waits include:

* Network I/O
* File I/O
* Database queries
* Timers
* User input

The goal of async programming is to let the program continue processing other things while waiting for an operation to complete.

It is related to concurrent programming, but with a different focus.

`Asynchronous programming` focuses on making waiting non-blocking.
`Concurrent programming` focuses on multiple tasks advancing within the same time period.
`Parallel programming` focuses on multiple tasks truly running simultaneously on multiple cores.

Async programs can be single-threaded concurrent, or combined with multi-threading.

## Evolution of JavaScript Async

JavaScript's async model has roughly gone through several stages:

The first stage was callbacks.

```js
readFile(path, function(result) {
    ...
});
```

The problem is that deep nesting easily leads to callback hell.

The second stage was promises.

```js
readFile(path)
    .then(result => ...)
    .catch(error => ...);
```

Promises turn async results into objects, facilitating chainable composition.

The third stage was async / await.

```js
const result = await readFile(path);
```

It makes async code read closer to synchronous code, but underneath it remains promises and the event loop.

## Summary

The Subroutines and Control Abstraction chapter can be threaded together with several sets of questions:

1. During a function call, what are the caller and callee each responsible for?
2. How does the stack frame hold parameters, local variables, return addresses, and registers?
3. Why are both the stack pointer and frame pointer needed?
4. How do nested functions access outer scopes?
5. Are parameters copies of values, passed by reference, shared objects, or deferred expressions?
6. How does the return value go from callee back to caller?
7. When an exception occurs, how does the runtime clean up stack frames and find a handler?
8. How do coroutines suspend and resume control flow?
9. How do event loops and concurrent dispatch handle external events?
10. How does async programming avoid blocking while waiting?

The key point of this chapter is seeing that a "function" is not a purely syntactic unit. Behind every call are calling conventions, stack layout, register discipline, parameter modes, and control-flow protocols. The language wraps these details so programmers can write `f(x)`, but at the implementation level, entry, return, exceptions, suspension, and resumption must all be precisely handled.
