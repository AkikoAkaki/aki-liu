---
title: "06 并发"
date: 2026-04-26
tags: ["programming-languages"]
draft: false
---

Concurrency 这一章的核心问题是：当程序里有多个控制流同时推进时，语言和运行时如何组织它们、调度它们，并防止它们互相破坏共享状态。

单线程程序的执行顺序通常比较直接。一步一步往下走，状态变化也比较容易追踪。并发程序的难点在于：多个任务的执行顺序可能交错，而且这个交错顺序不完全由程序员控制。

所以并发编程关心的不只是"怎样让程序更快"，还包括：

* 多个任务如何同时推进
* 哪些任务真的同时运行
* 共享数据如何保护
* 等待条件如何表达
* OS 和 runtime 如何调度控制流
* 如何避免 race condition、deadlock、starvation
* 如何在性能和安全之间取舍

## Concurrent、Parallel 和 Distributed

这三个词很容易混在一起，但它们关注的层次不同。

`Concurrent` 指多个任务在同一段时间内都在推进。它们不一定真的同时运行，可以是在一个 CPU 上交替执行。

例如，一个 Web server 同时处理多个请求。哪怕只有一个核心，只要它在请求 A 等 I/O 时去处理请求 B，也可以称为 concurrent。

`Parallel` 指多个任务真的在同一时刻运行。它通常需要多核 CPU、多处理器或 GPU。

例如，把一个大矩阵计算切成多个部分，在多个核心上同时执行，这就是 parallel。

`Distributed` 指任务运行在通过网络连接的多台机器上。

例如，一个系统由多台服务器组成，每台机器负责不同服务或不同数据分片。Distributed system 还要处理网络延迟、机器故障、消息丢失、一致性等问题。

可以粗略记：

```text
concurrent  = 多个任务交错推进
parallel    = 多个任务同时执行
distributed = 多个任务分布在多台机器上
```

Concurrency 是结构问题，parallelism 是执行问题，distributed 是部署和通信问题。

## 为什么需要并发

人们编写并发程序，主要有几个动机。

第一，避免阻塞。

如果一个任务在等待 I/O，比如读文件、访问网络、查数据库，CPU 可以去执行别的任务，而不是空等。

第二，提高响应性。

UI 程序如果把耗时任务放在主线程里，界面会卡死。把耗时任务放到后台，前台仍然可以响应用户操作。

第三，提高吞吐量。

服务器需要同时处理大量请求。并发让系统可以在一个请求等待时处理另一个请求，从而提高整体吞吐。

第四，利用多核硬件。

单核性能增长放缓之后，硬件性能提升越来越依赖多核。程序如果只用单线程，就很难充分利用现代 CPU。

第五，适应互联网和云计算环境。

Web 服务、数据库、分布式存储、AI 训练和推理系统，都天然需要处理大量并发任务。

所以并发既是性能需求，也是系统结构需求。

## Parallelism 的实现层级

Parallelism 可以出现在很多层级。

硬件层面有：

* instruction-level parallelism
* SIMD / vector instructions
* multi-core CPU
* GPU
* multi-processor systems
* distributed clusters

程序抽象层面有：

* threads
* tasks
* async / await
* futures / promises
* actors
* data parallelism
* message passing
* distributed jobs

程序员不一定直接控制每个硬件细节。语言、编译器、runtime 和库会提供不同抽象，让程序员以不同粒度表达并行性。

## Race condition

`Race condition` 指程序结果取决于多个线程或任务的不可控执行顺序。

更具体地说，通常需要满足几个条件：

* 多个控制流访问同一共享数据。
* 至少一个访问是写操作。
* 缺少足够的同步机制。
* 不同执行交错会导致不同结果。

例如两个线程同时做：

```text
counter = counter + 1
```

这看起来是一行代码，但底层可能分成：

```text
read counter
add 1
write counter
```

如果两个线程都先读到 `counter = 0`，然后各自写回 `1`，最终结果就是 `1`，而不是预期的 `2`。

Race condition 的麻烦在于它不一定每次出现。它取决于调度时机，所以调试时可能消失，线上高负载时又出现。

## Synchronization

`Synchronization` 指用某种机制协调多个控制流的执行顺序，确保它们不会错误地干扰共享状态。

常见同步机制包括：

* lock / mutex
* semaphore
* condition variable
* monitor
* atomic operations
* barriers
* message passing

Synchronization 主要解决两类问题：

第一类是 mutual exclusion，也就是同一时间只允许一个线程访问某段共享状态。

第二类是 condition synchronization，也就是某个线程必须等到某个条件成立后才能继续执行。

例如：

```text
队列为空时，消费者必须等待
队列非空时，消费者才能取数据
```

## Context switch

`Context switch` 指 CPU 从一个线程或进程切换到另一个线程或进程时，需要保存当前任务状态，并加载下一个任务状态。

需要保存和恢复的内容可能包括：

* registers
* program counter
* stack pointer
* scheduling state
* memory mapping information
* CPU flags
* kernel bookkeeping data

Context switch 是纯开销。它本身不推进业务逻辑，只是为了让不同任务轮流使用 CPU。

线程级 context switch 比进程级轻，因为同一进程内的线程共享地址空间。进程切换通常还涉及更重的内存管理状态。

## Preemption

`Preemption` 指调度器可以强行中断当前正在运行的任务，把 CPU 分配给另一个任务。

如果没有 preemption，一个任务只要不主动让出 CPU，就可能一直运行，导致其他任务无法执行。

Preemption 的好处是：

* 保证系统响应性。
* 避免某个任务长期霸占 CPU。
* 让 OS 可以公平调度多个任务。

代价是：

* 程序可能在任意位置被打断。
* 并发推理更复杂。
* 共享状态需要同步保护。
* context switch 会带来额外开销。

协作式调度依赖任务主动 yield。抢占式调度则由系统强制切换。

## Cache coherence problem

多核 CPU 中，每个核心可能有自己的 cache。多个核心如果同时缓存同一块内存，就会出现 coherence problem。

例如：

```text
core 1 cache 中 x = 1
core 2 cache 中 x = 1
```

如果 core 1 把 `x` 改成 `2`，core 2 的 cache 里可能还保留旧值 `1`。系统必须保证不同核心最终看到一致的内存状态。

Cache coherence protocol 用来维护这种一致性。它会在核心之间传播 invalidation 或 update 信息。

这对程序员的影响是：共享变量的读写不是单纯的"读内存"和"写内存"。底层还涉及 cache line、memory ordering、barrier、false sharing 等问题。

## Coroutines、User-level threads、Kernel threads 和 Processes

这些都是"控制流"的不同抽象，但它们的管理者、切换成本和并行能力不同。

### Coroutines

Coroutine 通常由程序员或 language runtime 调度。它是 cooperative 的，必须主动 `yield` 或 `await` 才会让出控制权。

特点：

* 切换成本极低。
* 适合异步 I/O。
* 可以支持大量并发任务。
* 通常不被 OS 直接调度。
* 如果某个 coroutine 不让出控制权，可能阻塞整个 event loop 或 runtime thread。

Coroutine 强调轻量并发，不一定提供真正的多核并行。

### User-level threads

User-level threads 由用户态 runtime 管理，OS 不一定知道每一个用户级线程的存在。

特点：

* 切换成本比 kernel thread 低。
* 调度灵活。
* 可以由语言 runtime 自己优化。
* 如果 runtime 没有很好处理阻塞系统调用，一个线程阻塞可能导致整个进程或一组用户线程被堵住。

早期绿色线程就是类似思路。现代 runtime 通常会通过 M:N 调度、异步 I/O 等方式缓解"一堵全堵"的问题。

### Kernel threads

Kernel threads 由 OS kernel 管理，是 OS 调度的基本单位。

特点：

* 可以在多核上真正并行。
* 一个线程阻塞不一定阻塞整个进程。
* OS 可以抢占调度。
* 切换成本比 user-level thread 高。
* 创建和销毁更重。

C/C++ pthread、Java thread、OS thread 都和 kernel thread 模型有关。

### Processes

Process 是资源分配的基本单位。每个 process 通常有独立地址空间。

特点：

* 内存隔离强。
* 一个 process 崩溃通常不直接破坏另一个 process。
* 安全性好。
* 通信成本高。
* context switch 成本比线程更高。

进程之间通常通过 IPC、socket、pipe、shared memory 等方式通信。

可以粗略比较：

| 抽象                | 管理者          | 内存关系      | 切换成本 | 并行能力           |
| ----------------- | ------------ | --------- | ---- | -------------- |
| Coroutine         | 程序 / runtime | 通常共享线程内状态 | 很低   | 通常不保证          |
| User-level thread | runtime      | 共享进程内存    | 低    | 取决于 runtime 映射 |
| Kernel thread     | OS           | 共享进程内存    | 较高   | 可以多核并行         |
| Process           | OS           | 地址空间隔离    | 最高   | 可以多核并行         |

## Busy waiting

`Busy waiting` 指一个线程在等待条件成立时，不断循环检查，而不是进入睡眠状态。

例如：

```c
while (!ready) {
    // keep checking
}
```

它的问题是浪费 CPU。线程明明无法继续做有意义的工作，却一直占用核心执行检查。

但 busy waiting 不是永远不合理。如果等待时间极短，而进入睡眠和唤醒的 context switch 成本更高，那么短暂 spinning 可能更快。

所以 busy waiting 适合：

* 等待时间非常短。
* 临界区很小。
* 多核环境中另一个线程很快会释放锁。
* 底层同步原语实现。

主要替代方案是 blocking / sleep-wait。线程发现条件不满足时进入睡眠，由 OS 或 runtime 在条件满足时唤醒它。

## Message passing

Message-passing 程序通过发送消息来通信，而不是多个线程直接共享同一块可变内存。

它通常不需要显式锁，是因为每个 actor / process / task 只直接修改自己的私有状态。其他任务不能随意访问它的内部数据，只能发送消息请求它处理。

例如 actor model 中：

```text
Actor A -> message -> Actor B
```

Actor B 收到消息后，在自己的上下文中顺序处理。共享状态被替换成消息传递，因此很多 race condition 会减少。

但 message passing 也有代价：

* 消息复制或序列化成本。
* 消息顺序和丢失问题。
* 死锁和 livelock 仍然可能出现。
* 分布式场景还要处理网络失败。

所以 message passing 降低了共享内存同步复杂度，但没有消除所有并发问题。

## Language-based 和 Library-based 并发

并发可以由语言直接支持，也可以由库提供。

### Language-based concurrency

Language-based concurrency 指语言语法和语义直接包含并发机制。

例如：

* Go 的 `go` 和 channel
* Erlang 的 process 和 message passing
* C# 的 `async` / `await`
* Java 的 synchronized monitor 语义

优点：

* 语法简洁。
* 编译器和 runtime 更了解并发结构。
* 可以提供更强的安全保证。
* 更容易做优化。
* 语义更统一。

缺点：

* 语言本身变复杂。
* 并发模型不够灵活时，程序员难以绕开。
* runtime 负担更重。

### Library-based concurrency

Library-based concurrency 通过库提供线程、任务、锁、future 等机制。

例如：

* pthreads
* C++ standard library threads
* Python threading / asyncio
* Java concurrency libraries

优点：

* 灵活。
* 不让语言核心过于臃肿。
* 可以替换和扩展不同并发模型。
* 对底层机制更透明。

缺点：

* 语法可能冗长。
* 编译器不一定理解库的语义。
* 安全保证更弱。
* 错误更容易留到运行期。

可以粗略说：

```text
language-based = 语义更强，灵活性较低
library-based  = 灵活性更高，语言帮助较少
```

## 创建新的 Threads of control

语言和系统可以用多种方式创建新的控制流。

常见机制包括：

* fork a process
* create a thread
* spawn a task
* start a coroutine
* launch an async computation
* create an actor
* submit work to a thread pool
* register an event handler or callback

这些机制的差异在于：

* 是否共享内存。
* 是否由 OS 调度。
* 是否能并行。
* 创建成本多高。
* 通信方式是什么。
* 生命周期由谁管理。

例如，创建 process 很重但隔离强；创建 coroutine 很轻但通常依赖 runtime 调度。

## Fork/join 和 co-begin

`co-begin` 表示一组语句可以并发执行，等它们全部结束后继续。

它通常结构比较固定。

`Fork/join` 更灵活。程序可以在运行时动态创建任务，也可以在合适的位置等待某些任务完成。

Fork/join 更强大的地方在于：

* 可以动态决定创建多少任务。
* 可以递归地产生子任务。
* 可以实现 divide-and-conquer parallelism。
* join 的位置可以和 fork 分离。

例如并行归并排序就很适合 fork/join：

```text
fork sort(left)
fork sort(right)
join both
merge
```

## 从 Coroutine 到 Scheduling、Preemption、Parallelism

可以把并发控制流看成逐步增强的过程。

### Scheduling

最基础的 coroutine 可能是 A 直接 yield 到 B，B 再 yield 回 A。任务之间耦合很强。

加入 scheduler 后，coroutine 不直接指定下一个运行谁，而是把控制权交给调度器。

调度器维护 ready queue：

```text
A yields -> scheduler -> choose B
B yields -> scheduler -> choose C
```

这样任务之间不需要彼此知道对方。调度逻辑集中在 runtime 中。

### Preemption

Coroutine 默认通常是 cooperative 的。要加入 preemption，就需要让 runtime 能在任务没有主动 yield 时中断它。

实现思路可能包括：

* 硬件 timer interrupt。
* runtime 定期检查。
* 编译器在循环或函数入口插入 safepoint。
* 运行时检测长时间运行的任务并触发切换。

Preemption 的好处是公平性更好。代价是实现复杂，并且任务可能在更多位置被打断，同步需求增加。

### Parallelism

如果 runtime 只在一个 kernel thread 上调度 coroutines，它只能并发，不能真正多核并行。

要实现 parallelism，可以引入多个 worker threads，让多个 OS threads 同时执行 runtime tasks。

一种常见模型是 M:N scheduling：

```text
M 个用户级任务
N 个 kernel threads
runtime 把 M 个任务调度到 N 个线程上
```

如果某个 worker 空闲，可以从其他 worker 的队列偷任务，也就是 work stealing。

这样就能把轻量任务模型和多核并行结合起来。

## Mutual exclusion 和 Critical section

`Mutual exclusion` 指同一时刻只允许一个线程进入某段代码或访问某个共享资源。

`Critical section` 是访问共享资源的危险代码区域。

例如：

```c
lock(m);
counter++;
unlock(m);
```

`counter++` 就是 critical section，因为它读写共享变量。`lock` 和 `unlock` 用来保证 mutual exclusion。

Critical section 应该尽量短。因为锁持有时间越长，其他线程等待时间越长，并发度越低。

## Atomicity 和 Condition synchronization

`Atomicity` 指一个操作要么完整发生，要么完全不被观察到中间状态。对其他线程来说，它不可被分割。

典型工具包括：

* locks
* atomic variables
* hardware atomic instructions

Atomicity 解决的是"不要让多个线程同时破坏同一状态"。

`Condition synchronization` 解决的是"某个条件没满足之前，线程不能继续"。

例如：

```text
队列为空 -> 消费者等待
队列非空 -> 消费者继续
```

典型工具包括：

* semaphores
* condition variables
* monitors
* channels

可以粗略比较：

```text
atomicity              = 操作完整性
condition synchronization = 执行顺序和等待条件
```

## test_and_set

`test_and_set` 是一种硬件原子指令。它在一个不可分割的步骤中完成：

1. 读取某个内存位置的旧值。
2. 把这个内存位置设置为新值。
3. 返回旧值。

可以用它构造 spin lock。

概念代码：

```c
while (test_and_set(&lock) == 1) {
    // spin
}

// critical section

lock = 0;
```

如果 `lock` 原来是 0，线程把它设为 1，并进入临界区。
如果 `lock` 原来是 1，说明别的线程持有锁，当前线程继续自旋等待。

Spin lock 的优点是实现简单，短等待时可能比 sleep/wakeup 更快。
缺点是浪费 CPU，锁持有时间长时性能很差。

## compare_and_swap

`compare_and_swap`，也叫 CAS，是更通用的原子指令。

它的行为是：

```text
如果 *addr == expected:
    *addr = new_value
    成功
否则:
    不修改
    失败
```

CAS 的优势在于它可以做"条件更新"。这让它可以实现更复杂的 lock-free 或 non-blocking 数据结构。

例如原子递增可以写成：

```text
do:
    old = x
    new = old + 1
while CAS(&x, old, new) fails
```

和 test_and_set 相比，CAS 的语义更丰富：

* 不只是抢锁。
* 可以基于旧值是否仍然符合预期来更新。
* 可以实现 lock-free stack、queue、counter 等结构。
* 失败时可以重试，而不是一定进入传统锁等待。

但 CAS 也不是万能的。它可能遇到 ABA problem，也可能在高竞争下不断失败重试，浪费 CPU。如果用 CAS 实现锁，而持锁线程挂掉，其他线程仍然可能卡住。CAS 的优势主要在于支持更细粒度的无锁算法，不是自动解决所有锁的问题。

## Reader-writer lock

普通 mutex 同一时间只允许一个线程进入，不区分读和写。

Reader-writer lock 区分两种访问：

* readers：只读共享数据。
* writers：修改共享数据。

规则通常是：

* 多个 readers 可以同时进入。
* writer 进入时必须独占。
* reader 和 writer 不能同时进入。

它适合读多写少的场景。

优点：

* 提高读并发。
* 减少不必要的互斥。

缺点：

* 实现比普通锁复杂。
* 可能出现 writer starvation 或 reader starvation。
* 如果写很多，优势不明显。

## Monitor

`Monitor` 是一种高级同步结构。它把共享数据和操作这些数据的方法封装在一起，并保证同一时刻只有一个线程能在 monitor 内执行。

可以把 monitor 理解成：

```text
共享状态 + 自动互斥 + 条件变量
```

进入 monitor 的方法时自动获得锁，离开时释放锁。

Java 的 `synchronized` 就接近 monitor 思想。

Monitor 的价值是把锁和共享数据绑定起来，减少程序员手动管理锁的复杂度。

## Condition variables 和 Semaphores

Monitor 里的 condition variable 用来处理"进入 monitor 后发现条件还不满足"的情况。

例如 bounded buffer：

```text
buffer empty -> consumer waits
buffer full  -> producer waits
```

Condition variable 通常必须和 monitor lock 一起使用。它本身没有记忆。

如果线程在没有人等待时 signal 一个 condition variable，这个 signal 通常会丢失。之后来的线程仍然需要等待。

Semaphore 则是有状态的。它维护一个计数器。

* `P` / `wait`：计数减一，如果不能减就等待。
* `V` / `signal`：计数加一，可能唤醒等待者。

Semaphore 的 signal 有记忆。如果先 signal，再 wait，后来的 wait 可能直接通过。

可以粗略比较：

| 机制                 | 是否有状态 | 是否必须配合 monitor | 用途          |
| ------------------ | ----- | -------------- | ----------- |
| Condition variable | 无记忆   | 通常需要           | 等待某个条件      |
| Semaphore          | 有计数   | 不一定            | 控制资源数量或同步顺序 |

## Monitor signals: hints vs absolutes

Monitor 中的 signal 可以有两种语义。

### Signal as absolute

在 Hoare-style monitor 中，线程 A signal 之后，等待线程 B 立即获得 monitor 的控制权。A 暂停，B 立刻运行。

这种语义更接近数学证明。因为被唤醒的线程可以假设 signal 时条件仍然成立。

缺点是实现复杂，context switch 成本高。

### Signal as hint

在 Mesa-style monitor 中，线程 A signal 之后继续运行。等待线程 B 只是被放回 ready queue，之后什么时候运行取决于调度器。

这更高效，也更符合很多现代系统实现。

但因为 B 真正运行时，条件可能已经被其他线程改变，所以 B 被唤醒后必须重新检查条件。

因此 condition variable 通常要配合 `while`，而不是 `if`：

```java
while (!condition) {
    wait();
}
```

这也能处理 spurious wakeups。

## Monitor invariant

`Monitor invariant` 指 monitor 内共享状态必须满足的基本一致性条件。

它通常要求在这些时刻成立：

* 没有线程在 monitor 内执行时。
* 线程进入 monitor 方法之前。
* 线程离开 monitor 方法之后。
* 线程调用 wait 释放 monitor lock 之前。

线程在 monitor 内部执行时，可以暂时打破 invariant，但在退出或等待前必须恢复它。

例如 bounded buffer 的 invariant 可能是：

```text
0 <= count <= capacity
```

任何 producer 或 consumer 操作结束后，都必须保证这个条件成立。

Monitor invariant 是证明 monitor 正确性的关键。

## Nested monitor problem

Nested monitor problem 指一个线程在持有一个 monitor 的锁时，又进入另一个 monitor，并在其中等待。这样可能导致锁无法释放，其他线程也无法进入需要的 monitor，从而产生死锁或卡住。

例如：

```text
Thread A holds monitor M1
Thread A enters monitor M2 and waits
Thread B needs M1 to make A's condition true
```

但 M1 被 A 持有，B 进不去，A 又在等 B 改变条件。

潜在解决方案包括：

* 避免在持有一个 monitor 时等待另一个 monitor。
* 规定统一锁顺序。
* 减少嵌套 monitor。
* 使用更细粒度或更高层的同步结构。
* 显式释放外层锁后再等待。
* 使用 message passing 或 actor model 降低共享锁复杂度。

## Deadlock

`Deadlock` 指两个或多个线程互相等待对方释放资源，导致所有相关线程永久无法继续。

典型例子：

```text
Thread A holds lock 1, waits for lock 2
Thread B holds lock 2, waits for lock 1
```

结果是 A 等 B，B 等 A，谁都无法继续。

Deadlock 通常需要几个条件同时成立：

1. Mutual exclusion：资源不能同时被多个线程使用。
2. Hold and wait：线程持有一些资源，同时等待其他资源。
3. No preemption：资源不能被强行夺走。
4. Circular wait：存在循环等待关系。

处理 deadlock 的策略包括：

### Prevention

破坏死锁条件之一。

例如规定所有线程必须按同一顺序获取锁：

```text
永远先拿 lock A，再拿 lock B
```

这样就不会出现循环等待。

### Avoidance

在分配资源前判断是否会进入不安全状态。经典例子是 Banker's algorithm。

这种方法理论上清晰，但需要提前知道资源需求，实际通用性有限。

### Detection and recovery

允许死锁发生，但系统定期检测。如果发现死锁，就终止某些线程、回滚操作或释放资源。

数据库和操作系统中可能使用这类方法。

## Starvation 和 Fairness

Starvation 指某个线程长期得不到需要的资源，虽然系统整体还在运行。

这和 deadlock 不同。Deadlock 是大家都卡住；starvation 是有些线程一直被饿着，其他线程还在继续。

例如 reader-writer lock 中，如果不断有 reader 进来，writer 可能一直拿不到锁。

Fairness 指调度和同步机制是否保证等待足够久的线程最终能执行。

提高 fairness 可能降低吞吐，因为系统需要更多管理和排队成本。

## Pure functional languages 为什么适合并发

Pure functional languages 对并发有吸引力，主要是因为它们减少共享可变状态。

如果数据不可变，多个线程可以安全共享同一个值。没有线程会原地修改它，也就少了很多 race condition。

Pure function 也更容易并行执行。只要函数没有副作用，多个函数调用之间没有隐藏依赖，runtime 或程序员就更容易判断哪些计算可以同时执行。

这并不意味着纯函数式语言自动解决所有并发问题。真实程序仍然需要 I/O、调度、资源管理和通信。但纯计算部分会更容易安全地并行化。

## Futures

`Future` 表示一个未来才会得到的结果。

当程序启动一个异步任务时，可以先得到一个 future。这个 future 现在可能还没有值，但之后任务完成时，它会持有结果或错误。

例如概念上：

```text
future = start computation
do other work
result = wait future
```

Future 的好处是：

* 把异步计算表示成一个值。
* 可以组合多个异步任务。
* 可以延迟等待结果。
* 让并发程序结构更清晰。

很多语言都有类似概念：

* Java `Future` / `CompletableFuture`
* JavaScript `Promise`
* Scala `Future`
* C++ `std::future`
* Python `asyncio.Future`
* Rust `Future`

使用 futures 时要注意：

* 等待 future 可能阻塞当前线程。
* future 失败时要处理异常或错误。
* 多个 future 互相等待可能造成 deadlock。
* 过多任务可能压垮线程池或 runtime。
* callback 链或 async 链过深会增加调试难度。

Future 的核心意义是把"稍后完成的计算"变成语言中的一个对象。

## 小结

Concurrency 这一章可以用几组问题串起来：

1. Concurrent、parallel、distributed 分别解决什么问题？
2. 为什么等待 I/O 时不应该浪费 CPU？
3. Race condition 为什么依赖执行交错？
4. Synchronization 是保护共享状态，还是等待条件成立？
5. Coroutine、user-level thread、kernel thread、process 的成本和能力有什么不同？
6. Busy waiting 什么时候浪费，什么时候可能合理？
7. Message passing 为什么能减少显式锁？
8. Language-based concurrency 和 library-based concurrency 各自牺牲了什么？
9. 从 coroutine 到 scheduling、preemption、parallelism，需要增加哪些机制？
10. Atomicity 和 condition synchronization 有什么区别？
11. TAS 和 CAS 分别提供什么硬件原语？
12. Monitor 如何把共享数据、锁和条件变量组织在一起？
13. Deadlock 为什么会发生，如何预防、避免或检测？
14. Futures 如何把异步计算表示成一个值？

并发编程的难点不只是"同时做很多事"，而是多个控制流会共享资源、交错执行、等待条件并争夺 CPU。语言和运行时提供 coroutine、thread、monitor、atomic、future、message passing 等机制，本质上都是在管理两个问题：怎样让任务有效推进，以及怎样让共享状态保持正确。
