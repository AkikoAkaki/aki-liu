---
title: "计算理论 2：CFG、PDA 与结构化语言"
date: 2026-05-04
tags: ["theory-of-computation", "computer-science"]
math: true
draft: false
---

<aside>

**TL;DR**

Part II 学的是 Regular language 往上一层的模型：如果机器多一个 stack，它能识别什么结构。

- CFG 从生成角度描述语言，PDA 从识别角度描述语言
- CFG = $(V, \Sigma, R, S)$：变量、终结符、替换规则、起始符号
- PDA = 有限状态机 + stack
- CFG $\iff$ PDA，所以 context-free language 有文法和机器两种等价视角
- CFL 能处理嵌套和配对结构，比如 $\{a^n b^n\}$
- DPDA $\neq$ NPDA，确定性 PDA 弱于非确定性 PDA
- Ambiguity 是文法的性质，一个语言可能有歧义文法，也可能有无歧义文法
- CFL pumping lemma 是双点同步泵吸：$uvxyz \to uv^ixy^iz$
- CFL 对 union、concatenation、star 封闭，对 complement、intersection 不封闭

</aside>

### 从有限状态到 stack

Regular language 的机器只有有限状态。它可以记住“现在处于哪一种情况”，但不能记住任意长的历史。

比如：

$$
\{a^n b^n \mid n \geq 0\}
$$

这个语言要求 a 的数量和 b 的数量相同。DFA 只能有有限个状态，没办法记住任意大的 $n$。

如果机器多一个 stack，情况就变了。读到 a 时压栈，读到 b 时弹栈，最后栈刚好清空，就说明数量匹配。

这就是 context-free language 的核心能力：它可以处理一类结构化的、嵌套式的记忆。

### CFG：生成语言的规则系统

CFG（Context-Free Grammar）是从生成角度定义语言。一个 CFG 写作：

$$
G = (V, \Sigma, R, S)
$$

- $V$：临时变量（Variables）
- $\Sigma$：最终生成的字符（Terminals）
- $R$：替换规则（Rules）
- $S$：起始符号（Start symbol）

比如语言 $\{a^n b^n \mid n \geq 0\}$ 可以用下面的 grammar 生成：

```text
S -> aSb
S -> ε
```

每次用 $S \to aSb$，就同时在左边加一个 a、右边加一个 b。最后用 $S \to \epsilon$ 停下来。

生成过程可以是：

```text
S
=> aSb
=> aaSbb
=> aaaSbbb
=> aaabbb
```

这个 grammar 直接把“左右数量同步增加”的结构写出来了。DFA 做不到这一点，因为 DFA 没有办法保存任意多的 a 等待后面的 b 来匹配。

### Parse tree 和 derivation

CFG 不只是生成字符串，也会给字符串一个结构。

比如一个表达式：

```text
a + a * a
```

如果 grammar 没有写清楚优先级，它可能有两种 parse tree：

```text
(a + a) * a
a + (a * a)
```

这就是 ambiguity。

歧义性是 CFG 文法本身的性质。一个文法生成同一个字符串有两棵不同的 parse tree，就说明这个文法有歧义。

注意，ambiguity 首先是文法的性质，不直接等于语言的性质。同一个 CFL 可能既有歧义文法，也有无歧义文法。只有那些不管怎么写 grammar 都有歧义的语言，才叫 inherently ambiguous。

编译器里 parser 很关心这件事。表达式优先级、结合性、if-else 绑定，本质上都要避免语法结构有歧义。

### PDA：识别语言的 stack machine

PDA（Pushdown Automaton）是从机器角度定义 CFL。它可以理解为 DFA 多了一个 stack。

DFA 的每一步只看：

```text
当前状态 + 当前输入字符
```

PDA 的每一步会看：

```text
当前状态 + 当前输入字符 + 栈顶符号
```

然后它可以：

- 改变状态
- 读入一个字符，或者用 $\epsilon$ transition 不读字符
- pop 栈顶
- push 新符号

这给了 PDA 一种受限的无限记忆。它不是随便读写内存，只能访问 stack top，所以特别适合括号匹配、递归嵌套、左右配对这类结构。

比如识别 $\{a^n b^n\}$：

1. 读到 a：往 stack 里 push 一个标记
2. 转到读 b 的阶段
3. 每读一个 b：pop 一个标记
4. 输入结束且 stack 清空：accept

### CFG 和 PDA 等价

Context-free language 有两个等价定义：

$$
\text{CFG} \iff \text{PDA}
$$

一个语言是 CFL，当且仅当它能被某个 CFG 生成，也当且仅当它能被某个 PDA 识别。

这两个视角各自有用：

| 视角 | 适合解释什么 |
|---|---|
| CFG | 语言如何被递归规则生成 |
| PDA | 机器如何用 stack 识别结构 |

CFG 更像语法规则。PDA 更像运行时识别器。

比如括号语言：

```text
()
(())
(()())
```

用 CFG 写，就是递归生成括号结构。用 PDA 识别，就是遇到左括号压栈，遇到右括号弹栈。

### CNF：把 grammar 变成标准形

Chomsky Normal Form（CNF）是一种标准化的 CFG 形式。它把规则限制成几种简单格式：

```text
A -> BC
A -> a
S -> ε   # 如果语言包含空串
```

CNF 的价值在于让算法更容易处理，grammar 本身未必更好读。

比如 $A_{CFG}$：

$$
A_{CFG} = \{\langle G,w\rangle \mid G \text{ 是 CFG 且 } w \in L(G)\}
$$

这个问题是 decidable。一个常见方法是先把 grammar 转成 CNF，然后只需要检查有限长度的推导。CNF 下，如果 $w$ 长度为 $n$，任何生成 $w$ 的推导长度都是受控的，所以可以穷举。

这和 DFA 很不一样。DFA 直接模拟即可，CFG 需要先把“可能无限展开的规则系统”压到一个可检查的标准形里。

### DPDA 和 NPDA

NFA 和 DFA 表达能力相同，但 PDA 这里不一样：

$$
\text{DPDA} \neq \text{NPDA}
$$

DPDA 弱于 NPDA。

关键原因是 stack 的选择一旦做错，很难回头。

比如偶回文语言：

$$
\{ww^R \mid w \in \{0,1\}^*\}
$$

NPDA 可以非确定性地猜中点：

- 还没到中点：继续读字符并压栈
- 猜到中点：开始弹栈并比对后半段

只要有一条路径猜对，就 accept。

DPDA 不能这么做。它不能回溯，也不知道什么时候到中点该弹栈。一旦没到中点就开始弹，或者错过中点再弹，后面就救不回来。

所以在 finite automata 里，non-determinism 不增加表达能力；在 pushdown automata 里，non-determinism 确实增加能力。

### CFL Pumping Lemma

Regular pumping lemma 是单点循环：

$$
xyz \to xy^iz
$$

CFL pumping lemma 是双点同步循环：

$$
uvxyz \to uv^ixy^iz
$$

如果 $L$ 是一个 CFL，那么存在 pumping length $p$，使得对任何长度至少为 $p$ 的字符串 $s \in L$，都可以拆成：

$$
s = uvxyz
$$

并满足：

- $|vy| > 0$
- $|vxy| \leq p$
- 对所有 $i \geq 0$，都有 $uv^ixy^iz \in L$

这里的直觉是：CFG 的 parse tree 如果足够高，就一定有某个 variable 在同一路径上重复出现。重复的 variable 对应两段可以一起 pump 的字符串，也就是 $v$ 和 $y$。

Regular language 是有限状态重复，所以只 pump 一段。CFL 是递归变量重复，所以会出现两段同步变化。

### 为什么 a^n b^n c^n 不是 CFL

考虑：

$$
L = \{a^n b^n c^n \mid n \geq 0\}
$$

它要求 a、b、c 三段数量都相同。

直觉上，单个 stack 可以处理一个配对关系，比如 a 和 b。要同时保证 a=b 且 b=c，就需要维护两个独立计数。一个后进先出的 stack 不够用。

用 pumping lemma 看，选：

$$
s = a^p b^p c^p
$$

由于 $|vxy| \leq p$，所以 $vxy$ 最多跨过两个相邻区段，不可能同时覆盖 a、b、c 三段。

于是 $v$ 和 $y$ 的 pump 只会改变一段或两段的数量，不可能让三段数量始终同步变化。取 $i=0$ 或 $i=2$ 后，总会破坏 $a^n b^n c^n$ 的结构。

所以这个语言不是 CFL。

### CFL 的 closure 边界

CFL 的 closure 性质比 regular language 弱。

| 操作 | CFL 是否封闭 | 直觉 |
|---|---|---|
| Union | Yes | 两个 grammar 合并，新增 start symbol |
| Concatenation | Yes | 先生成前一个语言，再生成后一个语言 |
| Star | Yes | start symbol 递归生成多段 |
| Intersection | No | 两个 stack-like constraint 合起来可能需要更多记忆 |
| Complement | No | 如果对 complement 和 union 都封闭，就会推出 intersection 封闭 |
| CFL $\cap$ Regular | Yes | Regular constraint 只加有限状态，不增加 stack 难度 |

这里最有用的结论是：

$$
\text{CFL} \cap \text{Regular} = \text{CFL}
$$

也就是说，用 regular language 去筛一个 CFL，结果仍然是 CFL。

这个结论经常用来证明某个语言不是 CFL。先假设它是 CFL，再和一个 regular language 相交，把它筛成一个已知不是 CFL 的语言，得到矛盾。

### 从语言结构看模型能力

到这一层，语言层级已经有比较清楚的直觉：

- Regular：只需要有限状态
- CFL：需要一个 stack
- 非 CFL：可能需要多个独立计数、交叉依赖、或者更一般的内存

CFG 和 PDA 其实是在讲同一件事：

- CFG 说：这个语言能不能用递归规则生成
- PDA 说：这个语言能不能用 stack 识别

Stack 是 Part II 的中心。它比有限状态强很多，足以处理嵌套结构；但它仍然是受限内存，只能按后进先出的方式使用。这个限制会在后面引出更一般的模型：Turing machine。
