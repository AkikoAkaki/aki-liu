---
title: "计算理论 5：P、NP 与复杂性类"
date: 2026-05-01
tags: ["theory-of-computation", "computer-science"]
math: true
draft: false
---

<aside>

**TL;DR**

Part V 学的是在“能算出来”的问题里，哪些能高效算，哪些只是能验证。

- $\mathbf{P}$：确定性多项式时间可判定的语言
- $\mathbf{NP}$：多项式时间可验证的语言，也等价于 NTM 多项式时间可判定
- Certificate 是让 verifier 快速确认 yes instance 的证据
- $\mathbf{P} \subseteq \mathbf{NP}$，但是否相等未知
- Polynomial-time reduction 写作 $A \leq_P B$，意思是 $A$ 不难于 $B$
- NP-complete = 在 NP 中，且所有 NP 问题都能多项式时间规约到它
- 证明 NP-complete 通常两步：show $B \in NP$，再从已知 NPC 问题规约到 $B$
- 复杂性类关系：$\mathbf{L} \subseteq \mathbf{NL} \subseteq \mathbf{P} \subseteq \mathbf{NP} \subseteq \mathbf{PSPACE}$
- Savitch 定理给出 $\mathbf{PSPACE} = \mathbf{NPSPACE}$

</aside>

### 从可判定到高效可判定

前面讨论 decidability 时，只问一个问题：有没有算法能在有限时间内给出答案。

复杂性理论继续问：如果能算，要花多少资源。

这里的资源主要是：

- Time：运行多少步
- Space：使用多少 tape cell / memory

很多 decidable 问题虽然理论上能算，但可能需要指数时间，实际完全不可用。所以复杂性理论的第一条分界线是 polynomial time。

多项式时间通常被当成“可高效求解”的数学近似。它不等于工程上一定快，但比指数时间稳定得多。

### Time complexity

定义：

$$
\text{TIME}(t(n))
$$

表示可以在 $O(t(n))$ 时间内被某个确定性 TM 判定的语言集合。

于是：

$$
\mathbf{P} = \bigcup_k \text{TIME}(n^k)
$$

$\mathbf{P}$ 就是所有能在多项式时间内判定的语言。

一些典型的 P 中问题：

- $A_{DFA}$
- $E_{DFA}$
- $EQ_{DFA}$
- $A_{CFG}$
- PATH
- RELPRIME

证明一个语言在 P 中，核心是给出一个多项式时间算法，并分析时间复杂度。

格式大概是：

```text
构造 TM M:
  On input <...>:
    1. ...
    2. ...
    3. ...

每一步使用 O(n^k) 时间，总步骤数也是多项式，所以 L in P.
```

### NP：可验证，不一定可求解

$\mathbf{NP}$ 有两个等价定义。

第一种：非确定性多项式时间。

$$
\mathbf{NP} = \bigcup_k \text{NTIME}(n^k)
$$

第二种更常用：多项式时间 verifier。

一个语言 $L$ 在 NP 中，如果存在多项式时间 verifier $V$，使得：

$$
w \in L \iff \exists c, V(w,c)=1
$$

其中 $c$ 是 certificate。

直觉是：答案也许很难找，但如果有人给你一个候选答案，你能很快检查它对不对。

几个例子：

| 问题 | Certificate | Verifier 做什么 |
|---|---|---|
| SAT | 变量赋值 | 检查公式是否为 true |
| CLIQUE | $k$ 个节点 | 检查它们两两相连 |
| HAMPATH | 一条路径 | 检查是否每个点出现一次且相邻有边 |
| SUBSET-SUM | 一个子集 | 检查和是否等于目标值 |

所以 NP 不是“不能多项式时间解决”的意思。NP 是“能多项式时间验证”的意思。

如果一个问题在 P 中，它当然也在 NP 中。因为可以直接忽略 certificate，用 polynomial-time decider 自己算答案。

$$
\mathbf{P} \subseteq \mathbf{NP}
$$

是否有：

$$
\mathbf{P} = \mathbf{NP}
$$

未知。

### coNP

coNP 是 NP 的补类：

$$
L \in \text{coNP} \iff \overline{L} \in \mathbf{NP}
$$

也就是说，coNP 中的问题有多项式时间可验证的 no certificate。

比如 TAUTOLOGY 问题问一个布尔公式是否永真。它的补问题是“是否存在一个赋值让公式为 false”，这个补问题有很自然的 certificate：给一个 falsifying assignment。

所以 TAUTOLOGY 在 coNP 中。

目前不知道：

$$
\mathbf{NP} = \text{coNP}
$$

这和 P vs NP 一样，是复杂性理论里的大问题。

### Polynomial-time reduction

多项式时间规约写作：

$$
A \leq_P B
$$

意思是存在一个多项式时间可计算函数 $f$，使得：

$$
w \in A \iff f(w) \in B
$$

直觉和 mapping reducibility 一样：把 $A$ 的输入快速翻译成 $B$ 的输入。

$A \leq_P B$ 表示：

```text
A 不难于 B
能解 B 就能解 A
```

几个核心传递结论：

- $A \leq_P B$ 且 $B \in P \Rightarrow A \in P$
- $A \leq_P B$ 且 $A \notin P \Rightarrow B \notin P$，在已知前提下逆用
- 如果 $A \leq_P B$ 且 $B \leq_P C$，那么 $A \leq_P C$

规约方向仍然很重要。要证明目标问题 $B$ 难，要从已知难问题规约到 $B$。

### NP-complete

$B$ 是 NP-complete，当且仅当：

1. $B \in \mathbf{NP}$
2. 对所有 $A \in \mathbf{NP}$，都有 $A \leq_P B$

也就是说，$B$ 自己在 NP 里，而且它至少和 NP 中所有问题一样难。

实际证明时，不会从所有 NP 问题逐个规约。我们用传递性：

只需要找一个已知 NP-complete 问题 $C$，证明：

$$
C \leq_P B
$$

所以 NP-complete 证明通常是两步：

```text
Step 1: Show B in NP
  给 certificate 和 polynomial-time verifier

Step 2: Show C <=_P B
  从某个已知 NP-complete 问题构造到 B 的多项式时间规约
```

如果某个 NP-complete 问题在 P 中，那么：

$$
\mathbf{P} = \mathbf{NP}
$$

因为所有 NP 问题都能规约到它。

### SAT 和 Cook-Levin

SAT 是布尔公式可满足性问题：

$$
SAT = \{\langle \phi \rangle \mid \phi \text{ is satisfiable}\}
$$

Cook-Levin Theorem 说明 SAT 是 NP-complete。

这是整个 NP-completeness 网络的起点。

直觉上，任何 NP 问题都有一个多项式时间 verifier。Verifier 的计算过程可以编码成一个布尔公式，公式可满足当且仅当存在某个 certificate 让 verifier 接受。

所以任意 NP 问题都能规约到 SAT。

SAT 之后，我们可以通过规约链把 NP-completeness 传给更多问题。

### 常见 NP-complete 问题网络

常见规约链：

```text
SAT
  -> 3SAT
      -> CLIQUE
          -> VERTEX-COVER

3SAT
  -> HAMPATH
      -> SUBSET-SUM
```

几个问题的含义：

| 问题 | 描述 |
|---|---|
| SAT | 布尔公式是否存在满足赋值 |
| 3SAT | CNF 形式，每个 clause 恰好 3 个 literal |
| CLIQUE | 图中是否存在大小为 $k$ 的 clique |
| VERTEX-COVER | 是否存在 $k$ 个节点覆盖所有边 |
| HAMPATH | 是否存在 Hamiltonian path |
| SUBSET-SUM | 是否存在一个子集，和为目标值 |

这些问题来自完全不同的表面领域：逻辑、图、路径、数值组合。

NP-completeness 的意义就是：它们底层共享同一类搜索难度。只要一个被高效解决，整个 NP 都会被高效解决。

### P、NP、PSPACE 的关系

先看大关系：

$$
\begin{aligned}
\mathbf{L}
&\subseteq \mathbf{NL}
= \mathbf{coNL}\\
&\subseteq \mathbf{P}
\subseteq \mathbf{NP}
\subseteq \mathbf{PSPACE}
= \mathbf{NPSPACE}\\
&\subseteq \mathbf{EXPTIME}
\end{aligned}
$$

这些包含关系大多比较直观：

- $\mathbf{L} \subseteq \mathbf{NL}$：确定性是非确定性的特殊情况
- $\mathbf{NL} \subseteq \mathbf{P}$：可以在多项式时间内搜索 configuration graph
- $\mathbf{P} \subseteq \mathbf{NP}$：能直接求解当然能验证
- $\mathbf{NP} \subseteq \mathbf{PSPACE}$：多项式时间最多访问多项式空间
- $\mathbf{PSPACE} = \mathbf{NPSPACE}$：Savitch 定理的推论

已知：

$$
\mathbf{P} \neq \mathbf{EXPTIME}
$$

未知的包括：

- $\mathbf{P}$ vs $\mathbf{NP}$
- $\mathbf{NP}$ vs $\mathbf{PSPACE}$
- $\mathbf{NP}$ vs $\text{coNP}$

### Space complexity

空间复杂度看的是机器使用多少 tape cell。

定义：

$$
\text{SPACE}(f(n))
$$

表示确定性 TM 使用 $O(f(n))$ 空间可判定的语言。

$$
\text{NSPACE}(f(n))
$$

表示非确定性 TM 使用 $O(f(n))$ 空间可判定的语言。

于是：

$$
\mathbf{PSPACE} = \bigcup_k \text{SPACE}(n^k)
$$

也就是多项式空间可解的问题。

和时间不同，空间可以复用。一个算法可能运行很久，但只用很少空间。

### Savitch 定理

Savitch 定理：

$$
\text{NSPACE}(f(n)) \subseteq \text{SPACE}(f^2(n))
$$

其中 $f(n) \geq n$。

推论：

$$
\mathbf{PSPACE} = \mathbf{NPSPACE}
$$

因为多项式平方后仍然是多项式。

这和时间复杂度形成对比。我们不知道 $\mathbf{P}$ 是否等于 $\mathbf{NP}$，但在多项式空间里，确定性和非确定性是一样强的。

### PSPACE-complete

PSPACE-complete 的定义和 NP-complete 很像：

$B$ 是 PSPACE-complete，当且仅当：

1. $B \in \mathbf{PSPACE}$
2. 对所有 $A \in \mathbf{PSPACE}$，都有 $A \leq_P B$

典型 PSPACE-complete 问题是 TQBF：

$$
\text{TQBF} = \{\langle \phi \rangle \mid \phi \text{ is a true quantified Boolean formula}\}
$$

SAT 只问是否存在一个赋值：

$$
\exists x_1, x_2, ..., x_n \; \phi(x_1,\ldots,x_n)
$$

TQBF 允许任意交替的量词：

$$
\exists x_1 \forall x_2 \exists x_3 \cdots \phi(x_1,x_2,x_3,\ldots)
$$

这种交替让问题像博弈一样：我选一个变量，你选一个变量，最后看公式真假。它通常需要考虑指数规模的博弈树，但可以用递归和空间复用维持多项式空间。

### L 和 NL

$\mathbf{L}$ 是对数空间：

$$
\mathbf{L} = \text{SPACE}(\log n)
$$

对数空间很小，只够存计数器、指针、当前节点编号之类的信息。

$\mathbf{NL}$ 是非确定性对数空间：

$$
\mathbf{NL} = \text{NSPACE}(\log n)
$$

典型问题是 PATH：

$$
PATH = \{\langle G,s,t\rangle \mid G \text{ 中存在从 } s \text{ 到 } t \text{ 的路径}\}
$$

PATH 在 NL 中。机器只需要记住当前节点，用非确定性猜下一步，最多走 $n$ 步。

一个重要结论：

$$
\mathbf{NL} = \mathbf{coNL}
$$

这和 NP 是否等于 coNP 形成对比。对数空间的世界里，非确定性可达和不可达之间有更强的结构。

### 复杂性类的直觉总结

可以把这些类按问题的“资源需求”粗略理解：

| 类 | 直觉 |
|---|---|
| $\mathbf{L}$ | 只用很少空间，像在图上拿着几个指针走 |
| $\mathbf{NL}$ | 对数空间 + 非确定性猜测 |
| $\mathbf{P}$ | 多项式时间内能直接求解 |
| $\mathbf{NP}$ | 给出 certificate 后能多项式时间验证 |
| $\mathbf{PSPACE}$ | 可以用多项式空间搜索很大的状态空间 |
| $\mathbf{EXPTIME}$ | 指数时间可解 |

Part V 的重点是看清几条分界，不是背一堆类名：

- 可求解 vs 可验证：P 和 NP
- 时间 vs 空间：P/NP 和 PSPACE
- 确定性 vs 非确定性：P vs NP 未知，PSPACE vs NPSPACE 已知相等
- 问题之间的难度传递：polynomial-time reduction

计算理论的最后一层问题从“能不能算”变成“能不能高效算”。P vs NP 到现在还没解决，也正是因为这条分界没有被真正看清。
