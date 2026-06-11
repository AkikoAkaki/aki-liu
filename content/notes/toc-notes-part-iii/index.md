---
title: "计算理论 3：图灵机、可判定性与计算边界"
date: 2026-05-03
tags: ["theory-of-computation", "computer-science"]
math: true
draft: false
---

<aside>

**TL;DR**

Part III 学的是计算模型从 stack machine 走到 Turing machine 之后，什么叫一个问题“能被算法解决”。

- TM = 有限控制器 + 无限 tape + 读写头
- TM 的结果有三种：accept、reject by halting、reject by looping
- Decider 对所有输入都停机，recognizer 只要求接受的输入会停机
- Decidable $\subset$ Turing-recognizable
- Multi-tape TM、NTM、Enumerator 和标准 TM 在可计算性上等价
- Church-Turing Thesis：所有合理的计算模型，计算能力等同于 TM
- Decidable 子程序一定 halt，可以串行等待结果
- Recognizable 子程序可能 loop，多个 recognizer 需要 dovetailing
- $A_{DFA}$、$E_{DFA}$、$A_{CFG}$ 都 decidable；$A_{TM}$ recognizable but not decidable

</aside>

### 图灵机解决了什么问题

DFA 只有有限状态。PDA 多了一个 stack。它们都能解释一部分语言，但仍然很受限。

Turing machine 的目标是把“算法”这个直觉概念形式化。

一台 TM 有：

- 有限状态控制器
- 一条可以无限延伸的 tape
- 一个读写头
- 每一步根据当前状态和当前格子内容，决定写什么、往哪走、进入哪个状态

它看起来很原始，但能力足够表达我们通常意义上的算法。

### TM 的形式定义

标准 TM 可以写成七元组：

$$
M = (Q, \Sigma, \Gamma, \delta, q_0, q_{acc}, q_{rej})
$$

- $Q$：状态集合
- $\Sigma$：输入字母表，不含空白符
- $\Gamma$：带字母表，$\Sigma \subseteq \Gamma$，且包含空白符
- $\delta$：转移函数
- $q_0$：起始状态
- $q_{acc}$：接受状态
- $q_{rej}$：拒绝状态，且 $q_{acc} \neq q_{rej}$

确定性 TM 的转移函数是：

$$
\delta: Q \times \Gamma \to Q \times \Gamma \times \{L, R\}
$$

意思是：看当前状态和当前 tape 符号，然后写一个符号，移动读写头，进入新状态。

### 三种结果

TM 在输入 $w$ 上运行，可能有三种结果：

1. Accept：进入 $q_{acc}$
2. Reject by halting：进入 $q_{rej}$
3. Reject by looping：永远运行

第三种是 TM 和 DFA/PDA 很不一样的地方。DFA 读完输入就结束，CFG/PDA 的判定问题也可以转成有限检查。但 TM 可以一直跑下去。

所以在 TM 这里，“没有接受”不等于“明确拒绝”。机器可能只是还没停。

这正是 decidable 和 recognizable 的区别。

### Configuration：TM 的快照

Configuration 表示 TM 在某时刻的快照。

常见写法是：

$$
u q v
$$

意思是 tape 内容为 $uv$，当前状态为 $q$，读写头在 $v$ 的第一个字符上。

- 起始格局：$q_0 w$
- 接受格局：含 $q_{acc}$ 的格局
- 拒绝格局：含 $q_{rej}$ 的格局

这个概念后面很有用。很多证明会把一次计算过程看成一串 configuration：

```text
C_1, C_2, C_3, ..., C_k
```

每个 configuration 都必须合法地推出下一个。Computation history 这类证明就是在利用这个结构。

### Decidable 和 Recognizable

关键定义：

- Turing-recognizable：存在某个 TM $M$，使得 $L(M)=A$
- Turing-decidable：存在某个 TM decider $M$，使得 $L(M)=A$，并且 $M$ 对所有输入都停机
- Decider：对所有输入都停机的 TM

直觉上：

- Decidable：yes 和 no 都能在有限时间内确认
- Recognizable：yes 能在有限时间内确认，no 可能永远等不到

也可以用你原来的话说：

- Decidable：子程序一定 halt，可以“等结果”再做下一步，串行调用安全
- Recognizable：子程序可能永远 loop，不能串行等待，否则一卡就是永远

这两个概念差别很小，但后面所有不可判定性证明都卡在这里。

### Decidable vs Recognizable

如果一个语言 $A$ 是 decidable，那它一定是 recognizable。因为 decider 本身就是一个更强的 recognizer。

$$
\text{Decidable} \subseteq \text{Turing-recognizable}
$$

反过来不成立。典型例子是：

$$
A_{TM} = \{\langle M,w\rangle \mid M \text{ accepts } w\}
$$

$A_{TM}$ 是 recognizable。Universal TM 可以模拟 $M$ on $w$。如果 $M$ 接受，Universal TM 也接受。

但如果 $M$ 不接受 $w$，有两种情况：

- $M$ reject and halt
- $M$ loop forever

Universal TM 无法在有限时间内分辨第二种情况。所以 $A_{TM}$ 不是 decidable。

### Dovetailing

Recognizable 的麻烦是可能 loop。

如果要同时运行多个 recognizer，不能这样写：

```text
先运行 M1，等 M1 结束后再运行 M2
```

因为 $M_1$ 可能永远不结束，导致 $M_2$ 根本没有机会运行。

正确方法是 dovetailing（交错模拟）：

```text
第 1 轮：跑 M1 一步，跑 M2 一步
第 2 轮：跑 M1 一步，跑 M2 一步
第 3 轮：跑 M1 一步，跑 M2 一步
...
```

如果某个 recognizer 最终会 accept，它总会在某一轮被推进到 accept。

这就是定理：

如果 $A$ 和 $\overline{A}$ 都是 T-recognizable，那么 $A$ 是 decidable。

做法是并行运行两个 recognizer。一个识别 $A$，一个识别 $\overline{A}$。输入必然属于其中一个，所以总有一边会 accept。谁先 accept，就给出对应答案。

### TM 变体不增强可计算性

很多 TM 变体看起来更强，但在“能识别什么语言”这件事上，它们和标准 TM 等价。

| 变体 | 与标准 TM 关系 | 关键证明思路 |
|---|---|---|
| Multi-tape TM | 等价 | 用单带模拟多带，用 `#` 分隔，用加点符号标记头位置 |
| NTM | 等价 | BFS 搜索计算树的所有分支 |
| Enumerator | $A$ 是 T-recognizable $\iff$ 某个枚举器枚举 $A$ | 避免在某个 $w_i$ 上死循环，用交错模拟 |
| Queue automaton | 等价 | 用队列模拟带，push / pull 模拟读写头移动 |
| Left-reset TM | 等价 | 多次 reset 再右移到目标位置，模拟左移 |

核心结论：

- Multi-tape TM 不增强识别能力
- NTM 不增强识别能力
- $A$ 可判定 $\iff$ 某个 NTM 判定 $A$

这些变体可能更快、更好写，但不会扩大可计算语言的集合。

这是可计算性和复杂性的区别。可计算性只问“能不能算”，复杂性才问“要花多少时间和空间”。

### Church-Turing Thesis

Church-Turing Thesis 可以粗略写成：

```text
Algorithm = Turing machine
```

所有合理的计算模型，例如 RAM、现代编程语言、lambda calculus，只要是在形式化“算法”，计算能力都等同于 TM。

这是 thesis，不是 theorem，无法证明。

因为“算法”本身是一个直观概念，不是已经被数学定义好的对象。Church-Turing Thesis 的意义是：各种独立提出的计算模型最后都落到同一类可计算函数上，所以 TM 很可能抓住了算法的本质。

### 常见 decidable 问题

不是所有关于机器的问题都困难。只要机器模型足够受限，很多问题是 decidable 的。

| 问题 | 含义 | 判定方法 |
|---|---|---|
| $A_{DFA}$ | DFA 是否接受输入 $w$ | 直接模拟 DFA |
| $E_{DFA}$ | DFA 语言是否为空 | 从起始状态做 reachability，看是否能到 accept state |
| $EQ_{DFA}$ | 两个 DFA 是否等价 | 构造对称差，再测空集 |
| $A_{CFG}$ | CFG 是否生成 $w$ | 转 CNF 后做有限检查 |
| $E_{CFG}$ | CFG 语言是否为空 | 从终结符反向标记能生成终结串的变量 |

这些问题 decidable 的共同原因是：虽然对象可能看起来复杂，但检查空间仍然可以被压成有限过程。

DFA 状态有限。CFG 推导可以转成标准形。LBA 在长度为 $n$ 的输入上也只有有限个 configuration，所以 $A_{LBA}$ 可判定。

### 语言层级再看一次

现在语言层级可以更完整地写出来：

```text
Regular
  ⊂ Context-Free
    ⊂ Decidable
      ⊂ Turing-Recognizable
        ⊂ All Languages
```

前两层是模型能力的增加：finite state 到 stack。

到 TM 之后，问题变成：机器是否总能停机。

Decidable 和 recognizable 的差别就是 halt 的差别。Decider 对所有输入停机。Recognizer 只需要在接受的输入上停机。

这个小差别会直接通向下一部分：有些问题并非暂时不会解；它们不存在任何 decider 能解决。
