---
title: "计算理论 1：自动机、语言层级与有限记忆"
date: 2026-05-05
tags: ["theory-of-computation", "computer-science"]
math: true
draft: false
---

<aside>

**TL;DR**

Part I 学的是最小的计算模型：如果一台机器只有有限个状态，它能识别什么语言，不能识别什么语言。

- Regular language = 有限状态机能识别的语言
- DFA、NFA、Regex 是同一类语言的三种表示方式
- DFA 的每一步都确定，NFA 可以分叉，但两者表达能力相同
- 有限状态机没有无限记忆，只能记住有限种“情况”
- Pumping lemma 的核心是：字符串足够长时，有限状态机必然重复某个状态
- Regular language 的典型边界是计数和嵌套，例如 $\{a^n b^n \mid n \geq 0\}$ 不是 regular
- 语言层级可以粗略看成：Regular $\subset$ Context-Free $\subset$ Decidable $\subset$ Recognizable $\subset$ All languages

</aside>

### 语言和机器

Theory of Computation 关心计算本身的边界，不限定在某一门编程语言怎么写。

一个 language 是字符串的集合。比如：

$$
L = \{w \in \{0,1\}^* \mid w \text{ contains an even number of } 1s\}
$$

这个语言包含所有 1 的个数为偶数的二进制字符串。机器的任务是读入一个字符串，然后判断它是否属于这个语言。

所以每一种计算模型都可以对应一类语言：

| 语言类别 | 识别它的机器 | 核心记忆结构 |
|---|---|---|
| Regular languages | DFA / NFA | 有限状态 |
| Context-free languages | PDA | 有限状态 + stack |
| Decidable languages | Turing machine decider | 无限 tape，且必须 halt |
| Recognizable languages | Turing machine recognizer | 无限 tape，但 reject 时可以 loop |

这门课的主线其实就是不断问同一个问题：给机器多一点记忆，它能识别的语言会不会变多。

### DFA：确定性的有限记忆

DFA（Deterministic Finite Automaton）是最简单的计算模型。它由五个部分组成：

$$
(Q, \Sigma, \delta, q_0, F)
$$

- $Q$：有限状态集合
- $\Sigma$：输入 alphabet
- $\delta$：状态转移函数
- $q_0$：起始状态
- $F$：接受状态集合

DFA 的特点是：每个状态读到每个字符时，都只有一个确定的下一状态。

比如判断一个二进制字符串里 1 的数量是不是偶数，只需要两个状态：

```text
even --1--> odd
odd  --1--> even
even --0--> even
odd  --0--> odd
```

这个机器不需要记住出现过多少个 1，只需要记住“当前是奇数个还是偶数个”。这就是 finite state 的本质：它不保存完整历史，只把历史压缩成有限个等价情况。

如果一个问题可以被压缩成有限种情况，它通常就是 regular 的。如果它需要记住任意大的数字、任意深的嵌套、任意长的对应关系，那有限状态就不够了。

### NFA：分叉不等于更强

NFA（Nondeterministic Finite Automaton）和 DFA 的区别是，NFA 在一个状态读到一个字符时，可以有多个下一状态，也可以没有下一状态，还可以通过 $\epsilon$ transition 不读字符直接跳转。

直觉上，NFA 像是在同时尝试很多条路径。只要其中一条路径接受，整个 NFA 就接受。

这听起来比 DFA 强很多，但在 regular language 这一层，NFA 和 DFA 的表达能力完全相同。

原因是 subset construction。DFA 可以用一个状态来表示 NFA 的一组可能状态：

$$
q_{\text{DFA}} = \{q_1, q_3, q_7\}
$$

也就是说，DFA 并没有复制出多条计算路径。它把“当前 NFA 可能在哪些状态”作为自己的状态。代价是状态数可能指数级膨胀，但表达能力不变。

所以：

$$
\text{DFA} \equiv \text{NFA}
$$

NFA 的价值在于构造更自然，不在于表达能力更强。很多 closure proof 和 regex 转 automaton 的证明里，用 NFA 会自然很多。

### Regex：同一类语言的代数写法

Regular expression 是 regular language 的另一种表示方式。

它更像语言的代数描述，不是程序执行模型。核心操作只有几个：

- Union：$A \cup B$
- Concatenation：$AB$
- Star：$A^*$

Regex、NFA、DFA 三者描述的是同一类语言：

$$
\text{Regex} \equiv \text{NFA} \equiv \text{DFA}
$$

这件事的意义是：regular language 有三种互相等价的视角。

- Regex：怎么把小语言组合成大语言
- NFA：怎么用分叉的状态图识别语言
- DFA：怎么用确定性的有限状态识别语言

如果只看表达能力，它们没有区别。如果看构造和证明，三者各有用途。

### Closure：语言类是否能承受组合

一个语言类是否 closed under 某个操作，意思是：拿这个类里的语言做完操作之后，结果是否还在这个类里。

Regular languages 对很多操作封闭：

| 操作 | 是否封闭 | 直觉 |
|---|---|---|
| Union | Yes | 两台机器并排跑，任意一台 accept 就 accept |
| Concatenation | Yes | 第一段跑完后通过 $\epsilon$ transition 进入第二台 NFA |
| Star | Yes | 接受后可以跳回开头继续跑 |
| Complement | Yes | DFA 交换 accept / reject states |
| Intersection | Yes | product construction 同时追踪两台 DFA 的状态 |

这里最重要的是 construction 的思路，而不是背结论。

比如 regular languages 对 union 封闭。给定两个 NFA $N_1$ 和 $N_2$，新建一个起始状态，用 $\epsilon$ transition 连到 $N_1$ 和 $N_2$ 的起始状态。新机器可以非确定性地选择跑左边还是右边，只要其中一个接受就接受。

这说明 $L(N_1) \cup L(N_2)$ 仍然是 regular。

Closure proof 的基本模式就是：如果每个输入语言都有机器，那我能不能把这些机器拼成一台新机器，识别操作后的语言。

### Pumping Lemma：有限状态一定会重复

Pumping lemma 是 regular language 最重要的反证工具。它用来证明某些语言不是 regular。

核心直觉很简单：DFA 的状态数有限。如果它读入的字符串足够长，就一定会在某个状态上重复。

如果一个 DFA 有 $p$ 个状态，读一个长度至少为 $p$ 的字符串时，根据 pigeonhole principle，前 $p+1$ 个访问位置里一定有两个位置落在同一个状态。中间那段路径就是一个 loop。

所以对于任意 regular language $L$，存在一个 pumping length $p$，使得所有长度至少为 $p$ 的字符串 $s \in L$ 都可以拆成：

$$
s = xyz
$$

并满足：

- $|y| > 0$
- $|xy| \leq p$
- 对所有 $i \geq 0$，都有 $xy^iz \in L$

这里的 $y$ 就是可以重复走的 loop。

Pumping lemma 的说法看起来抽象，但它表达的是一个硬限制：有限状态机无法记住 loop 走了几次。如果走一次合法，走两次、三次、零次也应该合法。

### 为什么 a^n b^n 不是 regular

考虑语言：

$$
L = \{a^n b^n \mid n \geq 0\}
$$

它包含：

```text
ab
aabb
aaabbb
aaaabbbb
```

这个语言要求 a 的数量和 b 的数量完全相同。

假设它是 regular。根据 pumping lemma，存在 pumping length $p$。选字符串：

$$
s = a^p b^p
$$

因为 $|xy| \leq p$，所以 $x$ 和 $y$ 都只能落在前面的 a 区域里。又因为 $|y| > 0$，所以 $y$ 至少包含一个 a。

现在 pump down，取 $i = 0$：

$$
xy^0z = xz
$$

这会删掉一些 a，但 b 的数量不变。结果变成：

$$
a^{p-k}b^p
$$

其中 $k > 0$。这个字符串不再满足 a 和 b 数量相同，所以不在 $L$ 中。

矛盾。因此 $L$ 不是 regular。

这个例子说明 regular language 的边界：DFA 可以记住有限模式，但不能记住无上限的精确计数。

### Regular 和 Context-Free 的分界

Regular language 的机器只有有限状态。Context-free language 的机器多了一个 stack。

这个 stack 改变了机器的能力。它可以支持一种受限形式的无限记忆：后进先出。

所以 $\{a^n b^n\}$ 不是 regular，但它是 context-free。PDA 可以先读 a 并压栈，每读一个 b 就弹出一个 a。最后栈正好清空，就说明数量匹配。

这就是 Regular 和 CFL 的本质区别：

- Regular：只能记住有限种状态
- CFL：可以记住一段嵌套或配对结构

但 stack 也不是万能的。它只适合处理嵌套结构，不适合同时维护多个独立计数。比如：

$$
\{a^n b^n c^n \mid n \geq 0\}
$$

这个语言要求 a、b、c 三段数量都相同，单个 stack 就不够了。

### 语言层级

计算模型越强，能识别的语言越多。

```text
Regular
  ⊂ Context-Free
    ⊂ Decidable
      ⊂ Turing-Recognizable
        ⊂ All Languages
```

每一层都有一个核心新增能力：

| 层级 | 新增能力 | 典型边界 |
|---|---|---|
| Regular | 有限状态 | 不能无限计数 |
| Context-Free | Stack | 能处理嵌套，但不能处理多个独立计数 |
| Decidable | Turing machine + 必须 halt | 能算法判定，但仍有问题不可判定 |
| Recognizable | accept 时 halt，reject 可 loop | 能确认 yes instance，但不一定能确认 no instance |
| All languages | 任意字符串集合 | 大多数语言没有算法识别 |

Part I 的重点是最底层：finite memory 的能力和限制。

DFA、NFA、Regex 看起来是不同工具，但它们都在描述同一件事：只依赖有限状态就能识别的语言。Pumping lemma 则给出了这类语言的边界。只要一个语言要求机器记住任意大的数量或结构，regular model 就会失效。
