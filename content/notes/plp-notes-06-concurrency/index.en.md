---
title: "06 Concurrency"
date: 2026-04-26
tags: ["programming-languages"]
draft: false
---

The core question of the concurrency chapter is: when a program has multiple control flows advancing simultaneously, how do the language and runtime organize them, schedule them, and prevent them from mutually corrupting shared state.

The execution order of single-threaded programs is usually relatively direct: step by step forward, with state changes relatively easy to trace. The difficulty of concurrent programs lies in this: the execution order of multiple tasks may interleave, and this interleaving order is not fully controlled by the programmer.

So concurrent programming is not just about "how to make programs faster," but also includes:

* How multiple tasks advance simultaneously
* Which tasks truly run at the same time
* How shared data is protected
* How waiting conditions are expressed
* How the OS and runtime schedule control flows
* How to avoid race conditions, deadlock, starvation
* How to balance performance and safety

## Concurrent, Parallel, and Distributed

These three words are easily conflated, but they focus on different levels.

`Concurrent` means multiple tasks are advancing within the same time period. They do not necessarily truly run simultaneously; they can alternate execution on a single CPU.

For example, a web server simultaneously handling multiple requests. Even with only one core, as long as it handles request B while request A is waiting for I/O, it can be called concurrent.

`Parallel` means multiple tasks truly run at the same instant. It typically requires multi-core CPUs, multiple processors, or GPUs.

For example, splitting a large matrix computation into parts and executing them on multiple cores simultaneously -- this is parallel.

`Distributed` means tasks run on multiple machines connected through a network.

For example, a system composed of multiple servers, each machine responsible for different services or different data shards. Distributed systems also must handle network latency, machine failures, message loss, consistency, and other issues.

A rough memory aid:

```text
concurrent  = multiple tasks interleaved
parallel    = multiple tasks executing simultaneously
distributed = multiple tasks spread across multiple machines
```

Concurrency is a structural problem, parallelism is an execution problem, and distributed is a deployment and communication problem.

## Why Concurrency Is Needed

People write concurrent programs for several main motivations.

First, to avoid blocking.

If one task is waiting for I/O -- reading a file, accessing the network, querying a database -- the CPU can execute other tasks rather than idly waiting.

Second, to improve responsiveness.

If a UI program puts a time-consuming task on the main thread, the interface freezes. Putting time-consuming tasks in the background lets the foreground continue responding to user operations.

Third, to improve throughput.

Servers need to handle large numbers of requests simultaneously. Concurrency lets the system process another request while one request waits, thereby improving overall throughput.

Fourth, to utilize multi-core hardware.

After single-core performance growth slowed, hardware performance improvements increasingly rely on multiple cores. Programs using only a single thread struggle to fully utilize modern CPUs.

Fifth, to adapt to internet and cloud computing environments.

Web services, databases, distributed storage, AI training and inference systems, all naturally need to handle large numbers of concurrent tasks.

So concurrency is both a performance requirement and a system structure requirement.

## Levels of Parallelism

Parallelism can appear at many levels.

At the hardware level:

* instruction-level parallelism
* SIMD / vector instructions
* multi-core CPU
* GPU
* multi-processor systems
* distributed clusters

At the program abstraction level:

* threads
* tasks
* async / await
* futures / promises
* actors
* data parallelism
* message passing
* distributed jobs

Programmers do not necessarily directly control every hardware detail. Languages, compilers, runtimes, and libraries provide different abstractions, letting programmers express parallelism at different granularities.

## Race Condition

A `race condition` means the program result depends on the uncontrollable execution order of multiple threads or tasks.

More specifically, several conditions typically must be met:

* Multiple control flows access the same shared data.
* At least one access is a write operation.
* Sufficient synchronization mechanisms are lacking.
* Different execution interleavings lead to different results.

For example, two threads simultaneously doing:

```text
counter = counter + 1
```

This looks like a single line of code, but at the bottom level it may be decomposed into:

```text
read counter
add 1
write counter
```

If both threads first read `counter = 0`, then each writes back `1`, the final result is `1`, not the expected `2`.

The trouble with race conditions is that they do not necessarily occur every time. They depend on scheduling timing, so they may disappear during debugging and reappear under high load in production.

## Synchronization

`Synchronization` means using some mechanism to coordinate the execution order of multiple control flows, ensuring they do not incorrectly interfere with shared state.

Common synchronization mechanisms include:

* lock / mutex
* semaphore
* condition variable
* monitor
* atomic operations
* barriers
* message passing

Synchronization mainly solves two kinds of problems:

The first is mutual exclusion -- only allowing one thread at a time to access a given piece of shared state.

The second is condition synchronization -- a thread must wait until a certain condition is met before it can continue.

For example:

```text
When the queue is empty, the consumer must wait
When the queue is non-empty, the consumer can retrieve data
```

## Context Switch

A `context switch` means that when the CPU switches from one thread or process to another, it needs to save the current task's state and load the next task's state.

Content that may need to be saved and restored includes:

* registers
* program counter
* stack pointer
* scheduling state
* memory mapping information
* CPU flags
* kernel bookkeeping data

Context switching is pure overhead. It advances no business logic itself, merely allowing different tasks to take turns using the CPU.

Thread-level context switches are lighter than process-level ones, because threads within the same process share the address space. Process switching typically also involves heavier memory management state.

## Preemption

`Preemption` means the scheduler can forcibly interrupt the currently running task and allocate the CPU to another task.

Without preemption, a task that does not voluntarily yield the CPU could run indefinitely, preventing other tasks from executing.

The benefits of preemption:

* Guarantees system responsiveness.
* Prevents a single task from monopolizing the CPU long-term.
* Lets the OS fairly schedule multiple tasks.

The costs:

* Programs can be interrupted at arbitrary locations.
* Concurrency reasoning is more complex.
* Shared state needs synchronization protection.
* Context switches bring extra overhead.

Cooperative scheduling relies on tasks voluntarily yielding. Preemptive scheduling is forced switching by the system.

## Cache Coherence Problem

In multi-core CPUs, each core may have its own cache. If multiple cores simultaneously cache the same memory location, a coherence problem arises.

For example:

```text
core 1 cache: x = 1
core 2 cache: x = 1
```

If core 1 changes `x` to `2`, core 2's cache may still hold the old value `1`. The system must guarantee that different cores eventually see a consistent memory state.

Cache coherence protocols maintain this consistency. They propagate invalidation or update information between cores.

The impact on programmers: reading and writing shared variables is not simply "read memory" and "write memory." Underneath, cache lines, memory ordering, barriers, false sharing, and other issues are at play.

## Coroutines, User-Level Threads, Kernel Threads, and Processes

These are different abstractions of "control flow," but their managers, switching costs, and parallel capabilities differ.

### Coroutines

Coroutines are typically scheduled by the programmer or language runtime. They are cooperative, meaning they must actively `yield` or `await` to give up control.

Characteristics:

* Extremely low switching cost.
* Suitable for async I/O.
* Can support large numbers of concurrent tasks.
* Typically not directly scheduled by the OS.
* If a coroutine does not yield, it may block the entire event loop or runtime thread.

Coroutines emphasize lightweight concurrency; they do not necessarily provide true multi-core parallelism.

### User-Level Threads

User-level threads are managed by a user-space runtime; the OS may not be aware of every user-level thread's existence.

Characteristics:

* Switching cost lower than kernel threads.
* Flexible scheduling.
* Can be optimized by the language runtime.
* If the runtime does not handle blocking system calls well, one thread blocking may stall the entire process or a group of user threads.

Early green threads followed a similar idea. Modern runtimes typically mitigate the "one blocks, all block" problem through M:N scheduling, async I/O, and other techniques.

### Kernel Threads

Kernel threads are managed by the OS kernel and are the basic unit of OS scheduling.

Characteristics:

* Can truly run in parallel on multiple cores.
* One thread blocking does not necessarily block the entire process.
* The OS can preemptively schedule.
* Higher switching cost than user-level threads.
* Heavier to create and destroy.

C/C++ pthreads, Java threads, and OS threads are all related to the kernel thread model.

### Processes

A process is the basic unit of resource allocation. Each process typically has an independent address space.

Characteristics:

* Strong memory isolation.
* One process crashing does not typically directly corrupt another process.
* Good security.
* High communication cost.
* Higher context switch cost than threads.

Processes typically communicate through IPC, sockets, pipes, shared memory, etc.

A rough comparison:

| Abstraction | Manager | Memory Relationship | Switching Cost | Parallel Capability |
| ---- | ---- | ---- | ---- | ---- |
| Coroutine | Program / runtime | Typically shares intra-thread state | Very low | Typically not guaranteed |
| User-level thread | Runtime | Shares process memory | Low | Depends on runtime mapping |
| Kernel thread | OS | Shares process memory | Higher | Can run multi-core parallel |
| Process | OS | Address space isolation | Highest | Can run multi-core parallel |

## Busy Waiting

`Busy waiting` means a thread, while waiting for a condition to be met, continuously loops checking, rather than entering a sleep state.

For example:

```c
while (!ready) {
    // keep checking
}
```

The problem is wasted CPU. The thread clearly cannot do meaningful work yet, but continues occupying a core performing checks.

But busy waiting is not always unreasonable. If the wait time is extremely short, and the context switch cost of sleeping and waking is higher, brief spinning may be faster.

So busy waiting is suitable for:

* Very short wait times.
* Very small critical sections.
* Multi-core environments where another thread will soon release the lock.
* Low-level synchronization primitive implementations.

The main alternative is blocking / sleep-wait. When the thread finds the condition is not met, it goes to sleep, and the OS or runtime wakes it when the condition is met.

## Message Passing

Message-passing programs communicate by sending messages, rather than multiple threads directly sharing the same mutable memory.

It typically does not require explicit locks because each actor / process / task only directly modifies its own private state. Other tasks cannot arbitrarily access its internal data; they can only send messages requesting it to process.

For example, in the actor model:

```text
Actor A -> message -> Actor B
```

Actor B, upon receiving the message, processes it sequentially within its own context. Shared state is replaced by message passing, so many race conditions are reduced.

But message passing also has costs:

* Message copying or serialization costs.
* Message ordering and loss issues.
* Deadlocks and livelocks can still occur.
* Distributed scenarios must also handle network failures.

So message passing reduces shared-memory synchronization complexity but does not eliminate all concurrency problems.

## Language-Based and Library-Based Concurrency

Concurrency can be directly supported by the language or provided by libraries.

### Language-Based Concurrency

Language-based concurrency means the language syntax and semantics directly include concurrency mechanisms.

For example:

* Go's `go` and channels
* Erlang's processes and message passing
* C#'s `async` / `await`
* Java's synchronized monitor semantics

Pros:

* Concise syntax.
* The compiler and runtime understand concurrency structures better.
* Can provide stronger safety guarantees.
* Easier to optimize.
* More unified semantics.

Cons:

* The language itself becomes more complex.
* When the concurrency model is insufficiently flexible, programmers struggle to work around it.
* Greater runtime burden.

### Library-Based Concurrency

Library-based concurrency provides threads, tasks, locks, futures, and other mechanisms through libraries.

For example:

* pthreads
* C++ standard library threads
* Python threading / asyncio
* Java concurrency libraries

Pros:

* Flexible.
* Does not bloat the language core.
* Different concurrency models can be swapped and extended.
* More transparent to underlying mechanisms.

Cons:

* Syntax may be verbose.
* The compiler may not understand the library's semantics.
* Weaker safety guarantees.
* Errors are more easily deferred to runtime.

A rough summary:

```text
language-based = stronger semantics, lower flexibility
library-based  = higher flexibility, less language assistance
```

## Creating New Threads of Control

Languages and systems can create new control flows in multiple ways.

Common mechanisms include:

* fork a process
* create a thread
* spawn a task
* start a coroutine
* launch an async computation
* create an actor
* submit work to a thread pool
* register an event handler or callback

The differences among these mechanisms lie in:

* Whether memory is shared.
* Whether scheduled by the OS.
* Whether it can be parallel.
* How high the creation cost is.
* What the communication method is.
* Who manages the lifecycle.

For example, creating a process is heavy but strongly isolated; creating a coroutine is lightweight but typically depends on runtime scheduling.

## Fork/Join and co-begin

`co-begin` indicates that a group of statements can execute concurrently, continuing only after they all finish.

It typically has a relatively fixed structure.

`Fork/join` is more flexible. Programs can dynamically create tasks at runtime and wait for certain tasks to complete at appropriate points.

Where fork/join is stronger:

* Can dynamically decide how many tasks to create.
* Can recursively spawn subtasks.
* Can implement divide-and-conquer parallelism.
* The join location can be separate from the fork location.

For example, parallel merge sort is very suitable for fork/join:

```text
fork sort(left)
fork sort(right)
join both
merge
```

## From Coroutine to Scheduling, Preemption, and Parallelism

Concurrent control flow can be seen as a progressively enhanced process.

### Scheduling

The most basic coroutines may have A directly yield to B, and B yield back to A. Tasks are tightly coupled.

With a scheduler added, coroutines no longer directly specify who runs next, but hand control to the scheduler.

The scheduler maintains a ready queue:

```text
A yields -> scheduler -> choose B
B yields -> scheduler -> choose C
```

Thus tasks don't need to know about each other. Scheduling logic is centralized in the runtime.

### Preemption

Coroutines are typically cooperative by default. To add preemption, the runtime needs to be able to interrupt a task even when it hasn't actively yielded.

Implementation approaches may include:

* Hardware timer interrupts.
* Periodic runtime checks.
* Compiler inserting safepoints at loop or function entries.
* Runtime detecting long-running tasks and triggering switches.

The benefit of preemption is better fairness. The cost is more complex implementation, and tasks can be interrupted at more locations, increasing synchronization demands.

### Parallelism

If the runtime only schedules coroutines on a single kernel thread, it can only achieve concurrency, not true multi-core parallelism.

To achieve parallelism, multiple worker threads can be introduced, letting multiple OS threads simultaneously execute runtime tasks.

A common model is M:N scheduling:

```text
M user-level tasks
N kernel threads
The runtime schedules M tasks onto N threads
```

If a worker becomes idle, it can steal tasks from other workers' queues -- work stealing.

This combines the lightweight task model with multi-core parallelism.

## Mutual Exclusion and Critical Section

`Mutual exclusion` means at any given moment, only one thread is allowed to enter a certain piece of code or access a certain shared resource.

A `critical section` is the dangerous code region that accesses shared resources.

For example:

```c
lock(m);
counter++;
unlock(m);
```

`counter++` is the critical section because it reads and writes a shared variable. `lock` and `unlock` ensure mutual exclusion.

Critical sections should be as short as possible. The longer the lock is held, the longer other threads wait, and the lower the concurrency.

## Atomicity and Condition Synchronization

`Atomicity` means an operation either completes entirely or is not observed to be in an intermediate state at all. To other threads, it is indivisible.

Typical tools include:

* locks
* atomic variables
* hardware atomic instructions

Atomicity solves the problem of "don't let multiple threads simultaneously corrupt the same state."

`Condition synchronization` solves the problem of "a thread cannot proceed until a certain condition is met."

For example:

```text
Queue empty -> consumer waits
Queue non-empty -> consumer continues
```

Typical tools include:

* semaphores
* condition variables
* monitors
* channels

A rough comparison:

```text
atomicity              = operation integrity
condition synchronization = execution order and waiting conditions
```

## test_and_set

`test_and_set` is a hardware atomic instruction. It completes in one indivisible step:

1. Read the old value of a memory location.
2. Set that memory location to a new value.
3. Return the old value.

It can be used to construct a spin lock.

Conceptual code:

```c
while (test_and_set(&lock) == 1) {
    // spin
}

// critical section

lock = 0;
```

If `lock` was originally 0, the thread sets it to 1 and enters the critical section.
If `lock` was originally 1, another thread holds the lock; the current thread continues spinning.

The advantage of spin locks is simple implementation and potential speed advantage over sleep/wakeup for short waits.
The disadvantage is wasted CPU, with severe performance degradation when lock-holding time is long.

## compare_and_swap

`compare_and_swap`, also called CAS, is a more general atomic instruction.

Its behavior is:

```text
if *addr == expected:
    *addr = new_value
    success
else:
    no modification
    failure
```

CAS's advantage is that it can do "conditional updates." This allows implementing more complex lock-free or non-blocking data structures.

For example, atomic increment can be written as:

```text
do:
    old = x
    new = old + 1
while CAS(&x, old, new) fails
```

Compared to test_and_set, CAS has richer semantics:

* Not just for grabbing locks.
* Can update based on whether the old value still matches expectations.
* Can implement lock-free stacks, queues, counters, etc.
* On failure, can retry rather than necessarily entering traditional lock waiting.

But CAS is not a silver bullet. It can encounter the ABA problem, and under high contention may repeatedly fail and retry, wasting CPU. If using CAS to implement locks, and the lock-holding thread dies, other threads may still get stuck. CAS's advantage lies mainly in supporting finer-grained lock-free algorithms, not automatically solving all lock problems.

## Reader-Writer Lock

An ordinary mutex only allows one thread at a time, without distinguishing reads and writes.

A reader-writer lock distinguishes two kinds of access:

* readers: only read shared data.
* writers: modify shared data.

The typical rules:

* Multiple readers can enter simultaneously.
* A writer must have exclusive access when entering.
* Readers and writers cannot enter at the same time.

It suits read-heavy, write-light scenarios.

Pros:

* Improves read concurrency.
* Reduces unnecessary mutual exclusion.

Cons:

* More complex implementation than ordinary locks.
* Writer starvation or reader starvation may occur.
* If writes are frequent, the advantage is minimal.

## Monitor

A `monitor` is a high-level synchronization structure. It encapsulates shared data and the methods operating on that data together, ensuring that only one thread can be executing inside the monitor at any given time.

A monitor can be understood as:

```text
shared state + automatic mutual exclusion + condition variables
```

When entering a monitor method, the lock is automatically acquired; when leaving, the lock is released.

Java's `synchronized` is close to the monitor idea.

The value of monitors is binding locks and shared data together, reducing the complexity of manual lock management.

## Condition Variables and Semaphores

Condition variables within monitors handle the situation of "entering the monitor and finding the condition is not yet met."

For example, a bounded buffer:

```text
buffer empty -> consumer waits
buffer full  -> producer waits
```

Condition variables must typically be used together with monitor locks. They themselves have no memory.

If a thread signals a condition variable when no one is waiting, this signal is typically lost. Threads arriving later still need to wait.

Semaphores, in contrast, are stateful. They maintain a counter.

* `P` / `wait`: decrement the counter; if it cannot be decremented, wait.
* `V` / `signal`: increment the counter, possibly waking a waiter.

A semaphore's signal has memory. If you signal first, then wait, the later wait may pass directly.

A rough comparison:

| Mechanism | Has State? | Must Pair with Monitor? | Use |
| ---- | ---- | ---- | ---- |
| Condition variable | No memory | Typically must | Waiting for a condition |
| Semaphore | Has counter | Not necessarily | Controlling resource count or synchronization order |

## Monitor Signals: Hints vs. Absolutes

Signals in monitors can have two semantics.

### Signal as Absolute

In Hoare-style monitors, after thread A signals, the waiting thread B immediately gains control of the monitor. A pauses, B runs immediately.

This semantics is closer to mathematical proofs. Because the awakened thread can assume the condition still holds at the time of the signal.

The disadvantage is complex implementation and high context switch cost.

### Signal as Hint

In Mesa-style monitors, after thread A signals, it continues running. The waiting thread B is merely placed back into the ready queue; when it runs depends on the scheduler.

This is more efficient and more aligned with many modern system implementations.

But because by the time B actually runs, the condition may have been changed by other threads, B must re-check the condition upon waking.

Therefore, condition variables should typically be paired with `while`, not `if`:

```java
while (!condition) {
    wait();
}
```

This also handles spurious wakeups.

## Monitor Invariant

A `monitor invariant` refers to the basic consistency condition that the shared state within the monitor must satisfy.

It typically must hold at these moments:

* When no thread is executing inside the monitor.
* Before a thread enters a monitor method.
* After a thread leaves a monitor method.
* Before a thread calls wait, releasing the monitor lock.

While a thread is executing inside the monitor, it can temporarily break the invariant, but must restore it before exiting or waiting.

For example, a bounded buffer's invariant might be:

```text
0 <= count <= capacity
```

After any producer or consumer operation ends, this condition must be guaranteed to hold.

The monitor invariant is key to proving monitor correctness.

## Nested Monitor Problem

The nested monitor problem refers to a thread holding one monitor's lock entering another monitor and waiting inside it. This can prevent the lock from being released, blocking other threads from entering the needed monitor, potentially causing deadlock or getting stuck.

For example:

```text
Thread A holds monitor M1
Thread A enters monitor M2 and waits
Thread B needs M1 to make A's condition true
```

But M1 is held by A, so B cannot enter; A is waiting for B to change the condition.

Potential solutions include:

* Avoid waiting in one monitor while holding another.
* Mandate a uniform lock ordering.
* Reduce nested monitors.
* Use finer-grained or higher-level synchronization structures.
* Explicitly release the outer lock before waiting.
* Use message passing or the actor model to reduce shared-lock complexity.

## Deadlock

`Deadlock` means two or more threads wait for each other to release resources, causing all involved threads to be unable to proceed indefinitely.

A typical example:

```text
Thread A holds lock 1, waits for lock 2
Thread B holds lock 2, waits for lock 1
```

The result: A waits for B, B waits for A; neither can continue.

Deadlock typically requires several conditions to be simultaneously met:

1. Mutual exclusion: resources cannot be simultaneously used by multiple threads.
2. Hold and wait: threads hold some resources while waiting for others.
3. No preemption: resources cannot be forcibly taken away.
4. Circular wait: a circular waiting relationship exists.

Strategies for handling deadlock include:

### Prevention

Break one of the deadlock conditions.

For example, mandate that all threads must acquire locks in the same order:

```text
Always acquire lock A first, then lock B
```

This prevents circular waiting.

### Avoidance

Before allocating resources, determine whether an unsafe state would be entered. The classic example is Banker's algorithm.

This approach is theoretically clear but requires knowing resource demands in advance, limiting general applicability.

### Detection and Recovery

Allow deadlocks to occur, but have the system periodically detect them. If a deadlock is found, terminate some threads, roll back operations, or release resources.

Databases and operating systems may use such methods.

## Starvation and Fairness

Starvation means a certain thread cannot obtain needed resources long-term, even though the overall system is still running.

This differs from deadlock. In deadlock, everyone is stuck; in starvation, some threads are chronically starved while others continue.

For example, in a reader-writer lock, if readers keep coming in, the writer may never get the lock.

Fairness refers to whether scheduling and synchronization mechanisms guarantee that threads that have waited long enough eventually get to execute.

Improving fairness may reduce throughput because the system needs more management and queuing overhead.

## Why Pure Functional Languages Are Suitable for Concurrency

Pure functional languages are attractive for concurrency primarily because they reduce shared mutable state.

If data is immutable, multiple threads can safely share the same value. No thread will mutate it in place, so many race conditions are eliminated.

Pure functions are also easier to execute in parallel. As long as functions have no side effects, there are no hidden dependencies between function calls, making it easier for the runtime or programmer to determine which computations can be executed simultaneously.

This does not mean pure functional languages automatically solve all concurrency problems. Real programs still need I/O, scheduling, resource management, and communication. But the pure computation parts become easier to safely parallelize.

## Futures

A `future` represents a result that will be obtained at some point in the future.

When a program starts an asynchronous task, it can first get a future. This future may not have a value yet, but when the task completes later, it will hold the result or error.

For example, conceptually:

```text
future = start computation
do other work
result = wait future
```

Benefits of futures:

* Represent asynchronous computation as a value.
* Can compose multiple asynchronous tasks.
* Can defer waiting for results.
* Make concurrent program structures clearer.

Many languages have similar concepts:

* Java `Future` / `CompletableFuture`
* JavaScript `Promise`
* Scala `Future`
* C++ `std::future`
* Python `asyncio.Future`
* Rust `Future`

When using futures, be aware:

* Waiting on a future may block the current thread.
* Future failures must handle exceptions or errors.
* Multiple futures waiting for each other may cause deadlock.
* Too many tasks may overwhelm the thread pool or runtime.
* Overly deep callback or async chains increase debugging difficulty.

The core significance of futures is turning "computation that completes later" into an object within the language.

## Summary

The Concurrency chapter can be threaded together with several sets of questions:

1. What problems do concurrent, parallel, and distributed each solve?
2. Why shouldn't the CPU be wasted while waiting for I/O?
3. Why do race conditions depend on execution interleaving?
4. Is synchronization about protecting shared state or waiting for conditions?
5. How do the costs and capabilities of coroutines, user-level threads, kernel threads, and processes differ?
6. When is busy waiting wasteful, and when might it be reasonable?
7. Why can message passing reduce explicit locks?
8. What do language-based concurrency and library-based concurrency each sacrifice?
9. From coroutines to scheduling, preemption, and parallelism, what mechanisms need to be added?
10. What is the difference between atomicity and condition synchronization?
11. What hardware primitives do TAS and CAS each provide?
12. How do monitors organize shared data, locks, and condition variables together?
13. Why does deadlock occur, and how can it be prevented, avoided, or detected?
14. How do futures represent asynchronous computation as a value?

The difficulty of concurrent programming is not just "doing many things at once," but that multiple control flows share resources, interleave execution, wait for conditions, and compete for CPU. Languages and runtimes provide coroutines, threads, monitors, atomics, futures, message passing, and other mechanisms -- all fundamentally managing two problems: how to let tasks advance effectively, and how to keep shared state correct.
