---
title: "计算理论 4：不可判定性、对角化与归约"
date: 2026-05-02
tags: ["theory-of-computation", "computer-science"]
math: true
draft: false
---

<aside>

**TL;DR**

Part IV 学的是怎么证明一个问题没有算法能解决。

- 所有 TM 的集合是可数的，所有语言的集合是不可数的，所以一定存在 TM 无法识别的语言
- $A_{TM}$ 是 recognizable，但不是 decidable
- $\overline{A_{TM}}$ 不是 T-recognizable
- 对角化的核心是构造一个和假设 decider 反着来的机器
- 归约的核心是：如果能解目标问题，就能顺便解一个已知不可能的问题
- Mapping reducibility 要求 $w \in A \iff f(w) \in B$
- $f$ 只是构造一个新的 TM 描述，不实际运行 $M$
- 要证 $B$ undecidable，通常证明 $A_{TM} \leq_m B$
- 要证 $B$ unrecognizable，通常证明 $\overline{A_{TM}} \leq_m B$

</aside>

### 不可判定性从哪里来

在 DFA 和 CFG 那里，很多问题都可以被判定。到了 TM，情况变了。

原因在于 TM 已经强到可以描述程序本身，不是因为它太弱。程序可以读程序、模拟程序、构造程序，也就会出现自指和对角化。

最粗的 counting argument 是：

- 所有字符串 $\Sigma^*$ 是可数的
- 所有 TM 都可以编码成字符串 $\langle M\rangle$，所以 TM 的集合可数
- 所有语言是 $\Sigma^*$ 的所有子集，也就是 power set，所以不可数

因此语言比 TM 多。必然存在没有任何 TM 能识别的语言。

但 counting argument 只告诉我们“存在”。真正有用的是给出具体问题，比如 $A_{TM}$，并证明它不可判定。

### A_TM

定义：

$$
A_{TM} = \{\langle M,w\rangle \mid M \text{ is a TM and } M \text{ accepts } w\}
$$

这就是图灵机接受问题。输入是一台机器 $M$ 和一个字符串 $w$，问题是：$M$ 会不会接受 $w$。

$A_{TM}$ 是 T-recognizable。Universal TM 可以直接模拟：

```text
On input <M, w>:
  Simulate M on w.
  If M accepts, accept.
  If M rejects, reject.
```

如果 $M$ 接受 $w$，模拟总会看到 accept。

但如果 $M$ 不接受 $w$，可能是 reject，也可能是 loop。loop 的时候，模拟器也只能一起 loop。

所以 $A_{TM}$ recognizable，但这还没有说明它是否 decidable。

### 对角化证明 A_TM 不可判定

假设存在一个 decider $H$ 能 decide $A_{TM}$。

也就是说：

```text
H(<M, w>) = accept  iff M accepts w
H(<M, w>) = reject  iff M does not accept w
```

现在构造一台机器 $D$：

```text
D = "On input <M>:
  1. Run H on <M, <M>>
  2. If H accepts, reject.
  3. If H rejects, accept."
```

$D$ 做的事很简单：拿 $H$ 判断 $M$ 是否接受自己的编码，然后反着来。

现在问：

$$
D(\langle D\rangle)
$$

如果 $D$ accepts $\langle D\rangle$，说明 $H$ 判断 $D$ accepts $\langle D\rangle$，但 $D$ 的定义会让它 reject。矛盾。

如果 $D$ rejects $\langle D\rangle$，说明 $H$ 判断 $D$ does not accept $\langle D\rangle$，但 $D$ 的定义会让它 accept。矛盾。

所以 $H$ 不存在。$A_{TM}$ 不可判定。

这个证明的核心是：构造一个机器，让它在自己的输入上和假设的 decider 永远相反。

### A_TM 的补集不可识别

定理：

如果 $A$ 和 $\overline{A}$ 都是 T-recognizable，那么 $A$ 是 decidable。

证明思路是 dovetailing。让 $M_1$ 识别 $A$，$M_2$ 识别 $\overline{A}$，并行运行两者。输入要么在 $A$，要么在 $\overline{A}$，所以总有一边会 accept。

现在看 $A_{TM}$：

1. $A_{TM}$ is recognizable
2. $A_{TM}$ is not decidable
3. 如果 $\overline{A_{TM}}$ 也是 recognizable，那么 $A_{TM}$ 就 decidable
4. 矛盾

所以：

$$
\overline{A_{TM}} \text{ is not T-recognizable}
$$

这比 undecidable 更强。它连“看到 yes 就停机确认”的 recognizer 都没有。

### General reduction：用一个 solver 解决另一个问题

归约的核心思想是：

要证明 $B$ 不可判定，证明“如果 $B$ 可判定，那么 $A_{TM}$ 也可判定”。

因为 $A_{TM}$ 已知不可判定，所以 $B$ 不可能可判定。

这类证明的结构通常是：

1. 假设存在判定机 $R$ 解决目标问题 $B$
2. 构造判定机 $S$ 解决 $A_{TM}$
3. $S$ 在输入 $\langle M,w\rangle$ 上构造一个辅助对象
4. 把辅助对象喂给 $R$
5. 根据 $R$ 的结果判断 $M$ 是否接受 $w$
6. 得到 $A_{TM}$ 可判定，矛盾

真正难的地方是第 3 步：怎么把 $M$ 在 $w$ 上的行为，绑定到某个语言性质上。

### HALT_TM 不可判定

定义：

$$
HALT_{TM} = \{\langle M,w\rangle \mid M \text{ halts on } w\}
$$

假设存在 decider $R$ 判定 $HALT_{TM}$。

构造 $S$ 判定 $A_{TM}$：

```text
S = "On input <M, w>:
  1. Use R to test whether M halts on w.
  2. If M does not halt, reject.
  3. If M halts, simulate M on w until it halts.
  4. If M accepts, accept. If M rejects, reject."
```

如果能判断 $M$ 会不会停机，那我们就可以安全模拟 $M$。不停机就 reject，停机就等它结束并看 accept/reject。

这样 $S$ 就决定了 $A_{TM}$，矛盾。

所以 $HALT_{TM}$ 不可判定。

### E_TM 不可判定

定义：

$$
E_{TM} = \{\langle M\rangle \mid L(M)=\emptyset\}
$$

它问的是一台 TM 的语言是否为空。

证明时常用一个辅助机器 $M_w$：

```text
M_w = "On input x:
  1. If x != w, reject.
  2. If x = w, run M on w.
  3. If M accepts, accept."
```

这个构造的效果是：

- 如果 $M$ accepts $w$，那么 $L(M_w)=\{w\}$
- 如果 $M$ does not accept $w$，那么 $L(M_w)=\emptyset$

于是 $M$ 在 $w$ 上是否接受，被绑定成了 $M_w$ 的语言是否为空。

如果有 decider 能判断 $E_{TM}$，就能用它判断 $A_{TM}$，矛盾。

关键技巧是 hardcoding：把 $w$ 写进新机器 $M_w$ 里，让新机器的整体语言性质反映原机器在固定输入上的行为。

### Mapping reducibility

General reduction 可以调用 solver、取反结果、做额外逻辑。Mapping reducibility 更严格。

定义：

一个函数 $f: \Sigma^* \to \Sigma^*$ 是 computable，如果存在 TM $F$，对所有输入 $w$，$F$ 都停机，并在 tape 上留下 $f(w)$。

定义：

$$
A \leq_m B
$$

表示存在可计算函数 $f$，使得：

$$
w \in A \iff f(w) \in B
$$

直觉是：$f$ 把 $A$ 的 yes instance 翻译成 $B$ 的 yes instance，把 $A$ 的 no instance 翻译成 $B$ 的 no instance。

这里有个非常容易错的点：

$f$ 只是构造一个新的 TM 描述，是语法操作，不实际运行 $M$。$f$ 必须总是停机。

如果你在构造 $f$ 的时候真的去模拟 $M$，那 $M$ 可能 loop，$f$ 就不是 computable function 了。

### Mapping reduction 的四个传递结论

已知 $A \leq_m B$：

| 条件 | 结论 |
|---|---|
| $B$ decidable | $A$ decidable |
| $A$ undecidable | $B$ undecidable |
| $B$ T-recognizable | $A$ T-recognizable |
| $A$ T-unrecognizable | $B$ T-unrecognizable |

方向要特别小心。

$A \leq_m B$ 的意思是：能解 $B$ 就能解 $A$。所以 $B$ 至少和 $A$ 一样难。

要证明 $B$ undecidable，常见方向是：

$$
A_{TM} \leq_m B
$$

要证明 $B$ unrecognizable，常见方向是：

$$
\overline{A_{TM}} \leq_m B
$$

不要反过来写。$B \leq_m A_{TM}$ 只能说明 $B$ 不比 $A_{TM}$ 难，不能推出 $B$ 不可判定。

### A_TM reduce to HALT_TM

构造：

$$
f(\langle M,w\rangle) = \langle M',w\rangle
$$

其中 $M'$ 是把 $M$ 的所有 reject 改成 loop 的机器。

于是：

- 如果 $M$ accepts $w$，那么 $M'$ halts on $w$
- 如果 $M$ does not accept $w$，那么 $M'$ does not halt on $w$

所以：

$$
\langle M,w\rangle \in A_{TM}
\iff
\langle M',w\rangle \in HALT_{TM}
$$

因此：

$$
A_{TM} \leq_m HALT_{TM}
$$

因为 $A_{TM}$ undecidable，所以 $HALT_{TM}$ undecidable。

### E_TM 的方向问题

$E_{TM}$ 是：

$$
\{\langle M\rangle \mid L(M)=\emptyset\}
$$

用刚才的 $M_w$：

- $M$ accepts $w$ $\Rightarrow L(M_w)=\{w\}$，非空
- $M$ does not accept $w$ $\Rightarrow L(M_w)=\emptyset$

所以更自然的 mapping 是：

$$
A_{TM} \leq_m \overline{E_{TM}}
$$

或者：

$$
\overline{A_{TM}} \leq_m E_{TM}
$$

这也能说明两件事：

- $E_{TM}$ undecidable
- $E_{TM}$ not T-recognizable

这个例子很容易把 accept/reject 方向写反。处理 $E_{TM}$ 时要一直盯着“语言为空”对应的是 $M$ 不接受 $w$。

### Rice's Theorem

Rice's Theorem 可以理解为不可判定性的批量版本：

只要是关于 TM 识别语言的非平凡语义属性，就不可判定。

非平凡的意思是：有些 TM 的语言满足这个性质，有些 TM 的语言不满足。

比如：

- $L(M)$ 是否为空
- $L(M)$ 是否有限
- $L(M)$ 是否 regular
- $L(M)$ 是否包含某个字符串

这些都在问 $L(M)$ 的语义属性，不是在问机器描述的表面形式。

Rice's Theorem 的直觉是：只要这个性质能区分某些语言，就可以把 $M$ on $w$ 的 accept 行为 hardcode 到一个新机器的语言里，然后把 $A_{TM}$ 归约过来。

### 易错点

几个点值得单独放着：

- Decider 对所有输入停机，recognizer 只需在接受的输入上停机
- Mapping reduction 的 $f$ 必须停机
- $f$ 构造机器，不运行机器
- $A \leq_m B$ 表示能解 $B$ 就能解 $A$
- 证明 undecidable 常用 $A_{TM} \leq_m B$
- 证明 unrecognizable 常用 $\overline{A_{TM}} \leq_m B$
- $A \leq_m B \Rightarrow \overline{A} \leq_m \overline{B}$，同一个 $f$
- General reduction 可以取反结果，mapping reduction 不能靠 solver 结果取反

Part IV 的主线就是这几件事：对角化制造第一个不可判定问题，归约把不可判定性传给更多问题，mapping reduction 再把 recognizable / unrecognizable 的边界也精确地传过去。
