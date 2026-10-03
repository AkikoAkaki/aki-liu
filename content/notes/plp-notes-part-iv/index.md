---
hidden: true
title: "PLP 4：并发与程序构建"
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


这一篇的核心问题是：一段源代码如何变成可以运行的程序，以及程序运行时，语言系统还需要继续做哪些管理工作。

前面几章讨论的是语言特性：类型、对象、函数、并发、内存。这里关注的是这些特性如何落地：

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

可以把这一篇分成两半：

* Building a runnable program：编译器如何分析、优化和生成代码。
* Run-time program management：运行时系统、虚拟机和 JIT 如何支持程序运行。

它们共同回答一个问题：高级语言的抽象，最终如何被机器执行。

## Basic block

`Basic block` 是一段连续的指令序列。

它有两个关键性质：

* 只能从第一条指令进入。
* 只能从最后一条指令离开。

也就是说，basic block 中间不会有别的入口，也不会在中间突然跳走。

例如：

```text
x = a + b
y = x * 2
z = y - 1
```

如果这三条指令之间没有 branch、jump、return、exception edge，它们可以构成一个 basic block。

Basic block 是编译器做局部优化的基本单位。因为 block 内部控制流是直线的，编译器可以比较容易地分析：

* 哪些表达式重复了
* 哪些变量不再使用
* 哪些计算可以提前
* 哪些临时变量可以消掉

## Control flow graph

`Control flow graph`，简称 CFG，用图表示程序的所有可能执行路径。

在 CFG 里：

* 每个节点是一个 basic block。
* 每条边表示控制流可能从一个 block 跳到另一个 block。

例如一个 `if` 语句可能形成这样的结构：

```text
        condition
        /       \
   then block   else block
        \       /
        join block
```

循环也可以在 CFG 中表现为回边：

```text
loop header -> loop body -> loop header
```

CFG 对编译器非常重要，因为很多优化需要跨越单个 basic block，理解整个函数的控制流。

例如：

* 找循环。
* 找死代码。
* 分析变量活跃区间。
* 做数据流分析。
* 判断某个分支是否永远不会执行。
* 做全局优化。

Basic block 解决的是"直线代码怎么分析"，CFG 解决的是"分支和循环怎么分析"。

## Virtual registers

`Virtual registers` 是编译器在中间表示里使用的抽象寄存器。

真实机器的寄存器数量很有限，比如 x86-64 只有有限数量的通用寄存器。编译器如果一开始就直接使用真实寄存器，优化会很麻烦。

所以中间阶段通常先假设有无限多个寄存器：

```text
v1 = a + b
v2 = v1 * c
v3 = v2 - d
```

这里的 `v1`、`v2`、`v3` 不一定是真实硬件寄存器，它们是 virtual registers。

Virtual registers 的作用是：

* 屏蔽不同硬件的寄存器差异。
* 让优化阶段更容易表达中间结果。
* 暂时假设寄存器数量足够。
* 把"生成逻辑"和"映射到真实寄存器"分开。

后面 register allocation 阶段再决定：

```text
v1 -> rax
v2 -> rbx
v3 -> stack slot
```

如果真实寄存器不够，就会发生 spilling。

## Local code improvement 和 Global code improvement

`Local code improvement` 指只在一个 basic block 内部做优化。

它的特点是：

* 范围小。
* 不需要复杂控制流分析。
* 实现简单。
* 编译速度快。
* 适合处理直线代码中的冗余。

例如：

```text
x = a + b
y = a + b
```

在同一个 basic block 里，编译器可以发现 `a + b` 被重复计算了，于是把它变成：

```text
t = a + b
x = t
y = t
```

`Global code improvement` 指跨越多个 basic blocks 的优化，通常在整个函数范围内进行。

它需要 CFG 和数据流分析。比如一个变量在某个分支里被定义，在另一个 block 中被使用，编译器需要知道不同路径上的值是否一致。

Global optimization 的例子包括：

* global common subexpression elimination
* loop-invariant code motion
* dead code elimination
* constant propagation
* register allocation
* partial redundancy elimination

Local optimization 更简单，global optimization 更强，但分析成本更高。

## Register spilling

`Register spilling` 指需要同时保存的值太多，超过了硬件物理寄存器数量，编译器被迫把某些值从寄存器移到内存中，通常是 stack slot。

例如编译器本来希望：

```text
v1 -> register
v2 -> register
v3 -> register
...
```

但真实寄存器不够，只能：

```text
v7 -> stack memory
```

之后每次使用 `v7`，都要从内存 load 回来；每次更新它，又要 store 回内存。

Spilling 的代价很高：

* 增加 load / store 指令。
* 增加内存访问延迟。
* 增加 instruction count。
* 可能破坏 cache locality。
* 让 hot path 变慢。

编译器通常会根据变量的使用频率、活跃区间、循环位置等因素决定哪些值应该留在寄存器，哪些可以 spill。

常见方法包括 graph coloring register allocation 和 linear scan register allocation。

## Intermediate form

`Intermediate form`，也叫 IF 或 IR，是编译器内部使用的中间表示。

源语言和机器指令之间差距很大。高级语言有类型、函数、对象、异常、闭包、泛型、模块；机器指令只有寄存器、内存、跳转、算术和调用。

IR 的作用是建立一个中间层：

```text
source language -> IR -> target machine code
```

它让编译器可以在不直接面对所有源语言细节和所有机器细节的情况下做分析和优化。

## IF 的 level

Intermediate form 可以有不同层级：high-level、medium-level、low-level。

### High-level IF

High-level IF 接近源代码，保留大量源语言结构。

典型例子是 AST。

它的优点是：

* 保留语法结构。
* 保留类型信息。
* 容易对应回源码。
* 适合做高层语义分析。
* 适合做某些源语言相关优化。

缺点是：

* 和机器差距大。
* 语言相关性强。
* 不适合做底层寄存器和指令优化。
* 多种语言之间不容易共享。

### Medium-level IF

Medium-level IF 在源语言和机器之间取平衡。它通常会去掉一部分源语言细节，但仍然保持平台无关。

很多通用优化发生在这一层。

例如：

* constant folding
* common subexpression elimination
* dead code elimination
* inlining
* loop optimization
* data-flow analysis

它的优点是：

* 相对语言无关。
* 相对机器无关。
* 适合复用优化器。
* 比 AST 更接近执行模型。

缺点是：

* 丢失一部分高层语义。
* 仍然不能直接运行。
* 某些机器相关优化还做不了。

LLVM IR 就可以理解成一种偏 medium 到 low-level 的 IR。

### Low-level IF

Low-level IF 接近机器指令，通常看起来像带 virtual registers 的 assembly。

它的优点是：

* 接近真实硬件。
* 适合指令选择。
* 适合寄存器分配。
* 适合机器相关优化。
* 可以精确表达 calling convention、load/store、branch 等细节。

缺点是：

* 可移植性差。
* 不容易还原到源语言结构。
* 高层语义已经丢失。
* 分析和重构程序结构更困难。

可以粗略理解：

```text
High-level IR  = 接近源码
Medium-level IR = 适合通用优化
Low-level IR   = 接近机器
```

## 为什么要用单一 IF

如果有多种源语言和多种目标机器，单一中间表示可以显著降低编译器复杂度。

假设有 M 种源语言，N 种目标机器。

如果每种语言都直接写到每种机器，需要：

```text
M * N
```

个编译器组合。

如果引入统一 IF：

```text
source languages -> IF -> target machines
```

只需要：

```text
M 个 front ends + N 个 back ends
```

这把复杂度从乘法关系变成加法关系。

前端负责：

* 解析源代码。
* 做词法、语法、语义检查。
* 生成统一 IF。

中端负责：

* 在 IF 上做机器无关优化。

后端负责：

* 把 IF 映射到具体机器指令。
* 做机器相关优化。
* 处理寄存器、指令选择、calling convention。

这个结构的价值是解耦。

源语言变化时，不一定要重写所有后端。
新机器出现时，也不一定要为每种语言重写完整编译器。

## 为什么编译器可能使用多个 IF

虽然单一 IF 很有价值，但实际编译器经常使用多个 IR。

原因是不同阶段需要不同信息。

早期阶段需要保留源语言结构：

```text
AST / typed AST
```

中间阶段需要适合优化：

```text
SSA IR / three-address code
```

后期阶段需要接近机器：

```text
machine IR / virtual-register assembly
```

多个 IR 的好处是：

* 每个阶段使用最合适的表示。
* 高层优化不被底层细节干扰。
* 底层优化不需要处理复杂源语言结构。
* 编译器结构更清晰。
* 不同优化 pass 可以使用不同粒度的信息。

缺点是：

* IR 之间需要转换。
* 编译器实现更复杂。
* 需要维护更多工具和验证逻辑。
* 转换时可能丢失信息。

所以单一 IF 是理想化的解耦模型，多个 IF 是工程上的常见选择。

## Back end compiler

Back end 负责把优化后的 IR 变成目标机器代码。

它通常包含几个主要阶段：

### Instruction selection

把 IR 操作映射成目标机器指令。

例如 IR 中的：

```text
x = y + z
```

可能被映射成某个架构上的 `add` 指令。

不同 CPU 的指令集不同，所以 instruction selection 是机器相关的。

### Instruction scheduling

调整指令顺序，让 CPU pipeline、cache、branch prediction、load latency 等表现更好。

例如，如果某条 load 指令需要等待内存，编译器可能把一些独立指令排到它后面，隐藏延迟。

### Register allocation

把 virtual registers 映射到 physical registers。

如果物理寄存器不够，就要 spill 到 stack。

### Calling convention lowering

处理参数传递、返回值、栈帧、寄存器保存、函数调用协议。

### Object code emission

生成目标文件或机器码，包括指令、数据段、符号表、重定位信息等。

Back end 的核心任务是：把相对抽象的 IR 变成具体机器可以执行的指令序列。

## Middle end

`Middle end` 是编译器中做 IR-to-IR 转换的部分。

它不直接关心源语言语法，也不直接关心具体机器指令。它的输入和输出通常都是某种中间表示。

Middle end 的常见优化包括：

* inlining
* constant folding
* constant propagation
* dead code elimination
* common subexpression elimination
* loop-invariant code motion
* strength reduction
* escape analysis
* data-flow analysis
* control-flow simplification

Middle end 的价值是复用。

如果多个前端都能生成同一种 IR，多个后端都能接收这种 IR，那么 middle end 的优化就能服务很多语言和很多平台。

## 从编译器到运行时

编译器把程序变成某种可运行形式，但程序真正运行时，仍然可能需要语言系统提供支持。

例如：

* 内存分配。
* 垃圾回收。
* 异常处理。
* 动态类型检查。
* 线程调度。
* 反射。
* 类加载。
* 模块加载。
* 安全检查。
* JIT 编译。
* 程序启动和退出清理。

这些功能属于 run-time system。

## Run-time system

`Run-time system` 是语言在程序运行时提供的一组基础机制。

它和普通 library 的区别在于：runtime system 支持的是语言本身的语义。

普通 library 提供可选功能。比如字符串处理库、HTTP 库、数学库。你可以用，也可以不用。

Run-time system 则通常是程序运行的基础。没有它，语言的很多特性无法实现。

例如 Java 程序依赖 JVM 的 class loading、GC、exception handling、thread management 等。Python 程序依赖 Python interpreter 和 object model。Go 程序依赖自己的 runtime 做 goroutine scheduling、GC、stack growth 等。

Run-time system 可能负责：

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
* interaction with OS

可以说，runtime system 是高级语言抽象在运行期的支撑层。

## Runtime 和 Library 的区别

一个简单判断方式是：这个机制是否在支持语言语义本身。

例如：

```text
GC             = runtime
exception unwinding = runtime
dynamic type check  = runtime
thread scheduler    = runtime
string utility      = library
HTTP client         = library
JSON parser         = library
```

当然边界有时会模糊。某些语言把一部分功能放进标准库，但实现上仍然需要 runtime 配合。

例如 Go 的 channel 看起来像语言特性，也和 runtime 调度器紧密相关。Java 的 reflection API 是 library 形式，但底层依赖 class metadata 和 JVM 支持。

## Interpreter

Interpreter 直接执行程序表示，而不是提前把整个程序编译成 native machine code。

最简单的 interpreter 可能直接遍历 AST。

例如：

```text
eval(BinaryExpr("+", left, right))
```

每次执行都根据 AST 节点类型决定该做什么。

AST interpreter 实现比较直接，适合教学、脚本语言、小工具或早期原型。但它性能通常较低，因为每一步都需要大量动态分派和树遍历。

为了提高性能，很多语言会先把源代码编译成 bytecode，再由 virtual machine 执行 bytecode。

## Virtual machine

`Virtual machine` 在这里通常指 process VM，也就是为某个程序或某种语言提供的虚拟执行环境。

它通常有自己的：

* bytecode instruction set
* operand stack 或 virtual registers
* method / function representation
* memory model
* type metadata
* exception mechanism
* class / module loader
* garbage collector
* interpreter 或 JIT compiler

VM 和普通 AST interpreter 的区别在于：VM 通常执行的是更低层、更线性的 intermediate form，比如 bytecode，而不是直接遍历源码 AST。

例如：

```text
source code -> bytecode -> VM executes bytecode
```

Bytecode 比 AST 更接近机器执行模型。它通常是线性指令序列，因此解释执行时开销更低，也更适合 JIT 编译。

## System VM 和 Process VM

Virtual machine 可以分成 system VM 和 process VM。

### System VM

System VM 模拟一整套硬件平台，可以运行完整操作系统。

例如常见的虚拟机软件可以让一个 guest OS 以为自己运行在真实硬件上。

它抽象的是：

* CPU
* memory
* disk
* network
* devices
* ISA 或硬件接口

System VM 也可以被叫作 hardware virtual machine、machine emulator、platform VM 等，具体叫法取决于实现方式和语境。

它的目标是让多个操作系统共享同一台物理机器，或者让一个 OS 运行在不同的宿主环境中。

### Process VM

Process VM 为单个程序提供运行环境。程序开始运行时创建，程序结束时销毁。

例如：

* JVM
* .NET CLR
* WebAssembly runtime
* CPython interpreter 在广义上也可以看作语言运行环境

Process VM 抽象的是语言级执行环境。它让程序觉得自己运行在一个专门为该语言设计的机器上。

Process VM 的目标包括：

* 平台无关。
* 安全隔离。
* 动态加载。
* 管理内存。
* 支持 JIT。
* 提供一致的语言语义。

可以粗略比较：

```text
System VM  = 虚拟硬件，运行整个 OS
Process VM = 虚拟语言机器，运行单个程序
```

## Managed code

`Managed code` 指由 runtime 或 virtual machine 管理执行的代码。

它通常具有这些特征：

* 自动内存管理。
* 类型安全验证。
* 异常处理支持。
* 安全检查。
* metadata 支持。
* reflection 支持。
* JIT 编译。
* 跨平台 bytecode 或 intermediate language。

Java bytecode、.NET IL 都是典型例子。

Managed code 的优势是：

* 安全性更强。
* 内存管理负担更小。
* 可以做运行时优化。
* 平台无关性更好。
* runtime 可以收集 profile 信息再优化。

代价是：

* 启动可能更慢。
* 运行时系统更复杂。
* 内存占用可能更高。
* 和底层硬件之间隔了一层抽象。
* 某些场景下性能可预测性较弱。

## 为什么很多 VM 使用 stack-based intermediate form

很多 VM 使用 stack-based bytecode，因为它实现简单，指令紧凑。

Stack-based bytecode 通过 operand stack 传递临时值。

例如表达式：

```text
a + b
```

可能编译成：

```text
load a
load b
add
```

`load a` 把 `a` 压栈，`load b` 把 `b` 压栈，`add` 从栈顶弹出两个值，相加后再压回栈。

Stack-based form 的优点：

* 指令短，不需要显式写很多寄存器编号。
* bytecode 更紧凑。
* 生成代码简单。
* 验证类型和栈深度相对直接。
* 适合解释器执行。

缺点：

* 需要频繁 push / pop。
* 数据依赖有时不如 register-based IR 清晰。
* JIT 编译前通常要再转换成更适合优化的形式。
* 表达复杂优化时不如 SSA / register form 方便。

所以 stack-based bytecode 适合作为 portable execution format，但优化阶段可能会转换成另一种 IR。

## JVM 架构

Java Virtual Machine 可以分成几个主要部分。

### Class loader

Class loader 负责把 `.class` 文件加载到内存中。

它不只是读文件，还涉及：

* 查找 class。
* 加载 bytecode。
* 验证 class file。
* 准备静态字段。
* 解析符号引用。
* 初始化 class。

Class loading 是 JVM 动态性的基础。Java 可以在运行时加载新类，也可以通过不同 class loader 隔离不同命名空间。

### Runtime data areas

JVM 运行时数据区大致包括线程共享区和线程私有区。

线程共享区包括：

* heap
* method area / metaspace

线程私有区包括：

* PC register
* Java stack
* native method stack

Heap 存对象。Java stack 存每个方法调用的 stack frame。PC register 记录当前线程执行到哪条 bytecode。

### Execution engine

Execution engine 负责执行 bytecode。

它通常包括：

* interpreter
* JIT compiler
* garbage collector

Interpreter 可以快速开始执行 bytecode。JIT 会把热点代码编译成 native code。GC 负责自动内存管理。

### JNI 和 Native Libraries

JNI 是 Java Native Interface。它允许 Java 调用 C/C++ 等 native code，也允许 native code 调用 JVM。

这让 Java 程序可以使用操作系统 API、硬件接口或已有 native library。

但 JNI 也会绕过一部分 managed environment 的安全和可移植性，因此需要谨慎使用。

## Java class file

Java class file 是 JVM 的输入格式之一。它不是源代码，而是编译后的 bytecode 和 metadata。

一个 class file 通常包含：

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

其中 constant pool 很重要。它保存字符串、类名、方法名、字段名、符号引用等信息。

Class file 的设计让 Java 可以做到：

```text
compile once, run on any JVM
```

只要目标机器有兼容 JVM，就可以加载和执行同一份 bytecode。

## Load time validity checks

JVM 在 load time 会对 class file 做很多有效性检查。

这些检查的目的，是确保 bytecode 不会破坏 JVM 的安全模型和类型系统。

### Format checks

Format checks 检查 class file 的基本结构是否合法。

例如：

* 文件开头是否是 `0xCAFEBABE`。
* class file 版本是否被当前 JVM 支持。
* constant pool 格式是否正确。
* 文件是否缺少必要部分。
* 文件是否有多余或损坏内容。

### Semantic checks

Semantic checks 检查类语义是否合法。

例如：

* 类是否有合法父类。
* 是否试图继承 final class。
* 非抽象类是否实现了所有 abstract methods。
* 字段和方法声明是否符合规则。

### Bytecode verification

Bytecode verification 检查指令是否安全。

例如：

* 操作数类型是否匹配。
* operand stack 是否会 underflow 或 overflow。
* 局部变量使用前是否初始化。
* branch target 是否合法。
* 方法返回类型是否正确。
* 不会伪造对象引用或破坏类型安全。

### Symbolic reference verification

Class file 中很多引用是 symbolic reference，比如通过类名、字段名、方法名表示目标。

JVM 需要确认：

* 目标类存在。
* 目标字段或方法存在。
* 当前类有权限访问目标。
* 引用解析符合访问控制规则。

这些检查让 JVM 可以在执行前阻止恶意或损坏的 bytecode。

## Just-in-time compiler

`JIT compiler` 在程序运行过程中，把 bytecode 或 intermediate representation 编译成 native machine code。

它介于 interpreter 和 ahead-of-time compiler 之间。

Interpreter 的优点是启动快、实现灵活，但长期执行性能较低。
AOT compilation 的优点是运行前已经生成机器码，但它缺少运行时 profile 信息。
JIT 的特点是：先运行起来，再根据运行时信息优化热点代码。

JIT 的潜在优势包括：

* 根据真实硬件做优化。
* 根据运行时 profile 优化 hot path。
* 做 aggressive inlining。
* 做 devirtualization。
* 做 escape analysis。
* 消除不必要的 boxing / allocation。
* 根据类型反馈优化动态调用。
* 对不常执行的代码少花编译成本。

代价是：

* 启动阶段可能较慢。
* 运行时编译消耗 CPU。
* 需要更多内存保存编译后代码。
* 性能有 warm-up 过程。
* 行为比纯 AOT 更复杂。

## 为什么 JIT 常以 bytecode 为输入

JIT 可以以 source code 为输入，也可以以 bytecode 为输入。很多系统更倾向于 bytecode，原因是 bytecode 已经完成了大量前端工作。

Bytecode 通常已经处理了：

* parsing
* syntax checking
* type checking
* name resolution
* basic semantic checks
* portable representation

这样 JIT 不需要每次从源代码重新解析。它可以直接面对更规则、更接近执行模型的表示。

Bytecode 的优势包括：

* 比 source code 更紧凑。
* 更容易验证。
* 更容易跨平台分发。
* 更适合解释执行。
* 更适合转换成优化 IR。
* 可以隐藏部分源码细节。

所以 JIT 输入 bytecode，本质上是把前端编译和运行时优化分开。

## Hot path

`Hot path` 指程序中执行频率最高的代码路径。

它可能是：

* 核心循环。
* 高频函数。
* 常走的 if 分支。
* 关键请求路径。
* 数值计算内核。
* 高频对象方法调用。

Hot path 很重要，因为程序性能通常由少数高频路径决定。

如果一段代码只执行一次，即使优化 10 倍，对整体性能影响也可能很小。
如果一段代码执行十亿次，哪怕每次省一个指令，也可能显著提升性能。

JIT 会特别关注 hot path。它可以先解释执行程序，同时收集 profile 信息：

* 哪些方法最常调用。
* 哪些分支最常走。
* 某个 virtual call site 通常出现哪些类型。
* 哪些对象没有逃逸。
* 哪些循环最热。

然后 JIT 把这些 hot code 编译成更高效的 native code。

## JIT 如何 inline virtual methods

Virtual method 正常情况下需要 dynamic dispatch。编译器在静态阶段不一定知道具体调用目标。

但 JIT 有运行时 profile 信息。它可能发现某个 call site 实际上几乎总是同一个类型。

例如：

```java
shape.draw()
```

理论上 `shape` 可能是 `Circle`、`Rectangle`、`Triangle`。
但运行时 profile 显示这里 99% 都是 `Circle`。

JIT 可以做 optimistic optimization：

1. 假设这里通常是 `Circle`。
2. 插入类型检查。
3. 如果确实是 `Circle`，直接调用并 inline `Circle.draw()`。
4. 如果后来出现别的类型，走 fallback path，必要时 deoptimize。

这种优化能把动态调用变成接近静态调用的性能。

这也是 JIT 的优势之一：它可以利用运行时事实，而不是只依赖编译期类型。

## Deoptimization

JIT 经常做基于假设的优化。

例如它假设：

* 某个变量总是某个类型。
* 某个 class 没有被新的 subclass 扩展。
* 某个 branch 基本不会走。
* 某个对象不会逃逸。

如果这些假设后来失效，runtime 需要撤回优化，回到更通用的执行方式。这个过程叫 deoptimization。

Deoptimization 的存在让 JIT 可以大胆优化，同时保留语言语义正确性。

可以理解成：

```text
先根据当前事实生成快路径
如果事实变了，再退回安全路径
```

这对动态语言和 managed runtime 很重要。

## Reflection

`Reflection` 指程序在 runtime 访问、检查甚至修改自身结构的能力。

它通常包括：

* 获取对象的 class。
* 查看 class 的字段和方法。
* 根据字符串查找方法。
* 动态创建对象。
* 动态调用方法。
* 读取 annotation / metadata。
* 修改访问权限或属性。

例如 Java 中可以通过 reflection 做：

```java
Class<?> c = Class.forName("User");
Object obj = c.getConstructor().newInstance();
```

Reflection 的作用包括：

* 框架开发。
* 依赖注入。
* ORM。
* 序列化 / 反序列化。
* 测试工具。
* 插件系统。
* 动态加载。

很多现代框架都依赖 reflection，因为框架需要在不知道具体业务类的情况下操作它们。

## Reflection 的代价和滥用

Reflection 很强，但不能随便用，尤其不要放在 hot path 中频繁执行。

问题包括：

* 动态查找成本高。
* 编译器和 JIT 很难 inline。
* 类型检查推迟到运行时。
* 可能产生 boxing / unboxing。
* 破坏封装。
* 让代码更难读。
* 可能绕过访问控制。
* 重构时不容易被 IDE 和编译器发现。

例如，如果每次请求都用字符串查找字段并动态调用方法，性能会明显下降。更好的方式通常是：

* 启动时反射一次，缓存结果。
* 用 code generation 生成直接调用代码。
* 用 method handle / function pointer 缓存访问路径。
* 避免在核心循环里做反射查找。

Reflection 适合做框架边界和元编程，不适合替代普通方法调用。

## 小结

Building and Running Programs 可以用几组问题串起来：

1. Basic block 为什么是局部优化的基本单位？
2. CFG 如何表示程序所有可能的控制流？
3. Virtual registers 为什么能让编译器先假设寄存器无限？
4. Register spilling 为什么会显著降低性能？
5. High-level、medium-level、low-level IR 分别适合什么阶段？
6. 为什么统一 IF 能把多语言、多平台编译器复杂度从乘法变成加法？
7. 为什么真实编译器仍然常常使用多个 IR？
8. Middle end 做的 IR-to-IR 优化有什么价值？
9. Back end 如何把 IR 映射到真实机器指令？
10. Run-time system 和普通 library 的区别是什么？
11. VM 为什么通常执行 bytecode，而不是直接执行 AST？
12. System VM 和 process VM 分别抽象什么？
13. Managed code 依赖 runtime 获得了什么能力？
14. JVM 如何通过 class loading、verification、interpreter、JIT 和 GC 支持 Java 程序？
15. JIT 如何利用 hot path 和 runtime profile 做优化？
16. Reflection 为什么强大，也为什么容易破坏性能和可维护性？

这一篇的重点是把编译期和运行期连起来看。编译器负责把源代码变成更接近机器的表示，runtime 负责在程序运行时继续支撑语言语义。IR、CFG、virtual registers、JIT、VM、GC、reflection 这些东西看起来分散，其实都在解决同一个问题：如何让高级语言既保留抽象，又能被真实机器高效、安全地执行。

