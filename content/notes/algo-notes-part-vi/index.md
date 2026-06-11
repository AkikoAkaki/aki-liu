---
title: "算法分析 6：复杂性边界、NP、近似与随机化"
date: 2026-05-01
tags: ["algorithms", "complexity"]
math: true
draft: false
---

<aside>

**TL;DR**

Part VI 学的是算法设计碰到边界之后怎么办。

- P 是多项式时间可解，NP 是多项式时间可验证
- NP-complete 问题代表一大类搜索问题的共同难度
- 证明 NP-complete 的核心是 reduction：把已知难题翻译成新问题
- Knapsack 的 $O(nC)$ 是 pseudo-polynomial，不是真正关于输入长度的多项式
- 0/1 选择、覆盖、路径、着色、整数约束，常常会进入 NP-hard 区域
- 碰到 NP-hard 问题，可以考虑 special case、pseudo-polynomial、approximation、randomization、heuristic
- Approximation 追求可证明的近似比
- Randomized algorithms 分 Las Vegas 和 Monte Carlo

</aside>

### 算法设计不总能找到高效精确解

前面几篇都在讲怎么设计算法。

但算法课还有一条很重要的线：有些问题可能没有多项式时间精确算法。

这不是说完全不能算。可以暴力搜索，可以用指数算法，可以在小规模上跑，可以近似，可以随机化，可以限制输入结构。

复杂性理论给的是边界意识：什么时候我们应该停止寻找普通的 polynomial-time exact algorithm，转而换目标。

### P 和 NP

$\mathbf{P}$ 是多项式时间可解的问题。

也就是存在一个算法，可以在输入规模 $n$ 的多项式时间内给出答案。

$\mathbf{NP}$ 是多项式时间可验证的问题。

给你一个 certificate，你能在多项式时间内检查它是否证明答案为 yes。

例子：

| 问题 | Certificate |
|---|---|
| SAT | 一组变量赋值 |
| Clique | 一组节点 |
| Vertex Cover | 一组顶点 |
| Hamiltonian Path | 一条访问所有点一次的路径 |
| Subset Sum | 一个子集 |

如果一个问题能快速求解，那当然能快速验证：

$$
\mathbf{P} \subseteq \mathbf{NP}
$$

但是否：

$$
\mathbf{P} = \mathbf{NP}
$$

未知。

### NP-complete

一个问题是 NP-complete，意思是：

1. 它在 NP 中
2. 所有 NP 问题都能多项式时间规约到它

实际证明时通常不用从所有 NP 问题出发。

只要找一个已知 NP-complete 问题 $A$，证明：

$$
A \leq_P B
$$

就能说明 $B$ 至少和 $A$ 一样难。

证明结构：

1. Show $B \in NP$
2. 从已知 NP-complete 问题 $A$ 构造到 $B$ 的 polynomial-time reduction
3. 证明：

$$
x \in A \iff f(x) \in B
$$

这里最容易错的是方向。

要证明 $B$ 难，应该把已知难题翻译成 $B$，不是把 $B$ 翻译成已知难题。

### Reduction 的建模意义

Reduction 不只是复杂性证明技巧，也是一种建模能力。

它的含义是：新问题至少包含旧问题的全部困难。

比如 Vertex Cover 和 Independent Set 的关系。

给定图 $G=(V,E)$：

$S$ 是 independent set，当且仅当 $V\setminus S$ 是 vertex cover。

所以大小为 $k$ 的 independent set，对应大小为 $n-k$ 的 vertex cover。

这个转换说明两个问题共享同一个结构：选择一些点，使边的约束满足，只是从“保留”视角和“覆盖”视角看。

很多 reduction 的本质都是换一种语言重写约束。

### 常见困难结构

一些题面信号容易提示 NP-hard / NP-complete：

| 信号 | 常见来源 |
|---|---|
| 从集合中选子集，满足很多约束 | Set Cover / Vertex Cover / Independent Set |
| 是否存在访问每个点一次的路径 | Hamiltonian Path |
| 给图染色，冲突点颜色不同 | Graph Coloring |
| 0/1 决策变量很多 | ILP / SAT |
| 数字子集求和 | Subset Sum / Knapsack |
| 覆盖所有元素，成本最小 | Set Cover |

这不表示看到这些词就一定 NP-hard，但它们是强烈信号。

如果一个问题可以被看作“在指数多的组合里找一个满足约束的选择”，并且没有明显的 DP/flow/greedy 结构，就要警惕复杂性边界。

### Knapsack 和 pseudo-polynomial

0/1 knapsack 的 DP 复杂度是：

$$
O(nC)
$$

其中 $C$ 是容量。

这看起来像多项式，但它不是关于输入长度的多项式。

如果容量 $C$ 用二进制写在输入里，输入长度是：

$$
\log C
$$

而算法时间是 $C$，也就是对输入长度指数级。

所以 $O(nC)$ 叫 pseudo-polynomial time。

这类算法对数值不大的实例很好用，但不能说明问题在 P 中。

Subset Sum、Knapsack 都有这种特点：数值大小本身进入状态维度。

### 碰到 NP-hard 后怎么办

证明一个问题 NP-hard，不等于工作结束。

实际算法设计里，还有很多选择：

1. **Special case**
   限制输入结构后，问题可能变简单。比如一般图 coloring 难，但 bipartite graph 2-coloring 是线性时间。

2. **Pseudo-polynomial algorithm**
   如果数值范围不大，像 knapsack 的 $O(nC)$ 可能很实用。

3. **Approximation algorithm**
   不追求最优，追求可证明接近最优。

4. **Randomized algorithm**
   用随机性换取更简单或更快的算法。

5. **Heuristic**
   没有最坏情况保证，但在实际数据上表现好。

6. **Parameterized algorithm**
   把复杂度集中到某个小参数上，比如 $O(2^k n)$。

复杂性边界的意义是帮助你改问题，而不是让你放弃。

### Approximation

Approximation algorithm 追求近似比。

如果是 minimization problem，一个 $\rho$-approximation 算法满足：

$$
ALG \leq \rho \cdot OPT
$$

如果是 maximization problem，通常写成：

$$
ALG \geq \frac{1}{\rho}OPT
$$

重点是这个保证对所有输入都成立。

### Vertex Cover 的 2-approx

Vertex Cover 问题：选尽量少的点，使每条边至少有一个端点被选中。

一个简单 2-approx：

```text
while graph still has edges:
    pick any edge (u,v)
    add both u and v to cover
    remove all edges incident to u or v
```

为什么是 2-approx？

算法每次选一条还没被覆盖的边 $(u,v)$。这些被选中的边两两不相邻，因为每次都会删除 incident edges。

所以它们形成一个 matching。

任何 vertex cover 至少要为 matching 中每条边选一个端点，因此：

$$
OPT \geq |M|
$$

算法为每条 matching edge 选两个端点，所以：

$$
ALG = 2|M| \leq 2OPT
$$

这个证明很典型：找一个 lower bound，然后证明算法结果不超过它的常数倍。

### Set Cover 的 greedy

Set Cover 的 greedy 策略是：

每次选择能覆盖最多未覆盖元素的集合。

这个算法不能保证常数近似比，但能保证 $O(\log n)$ 近似。

直觉是：每一步都覆盖当前剩余元素的一大块，剩余未覆盖部分按比例下降。

Set Cover 是 greedy 不精确但仍然有理论保证的典型例子。

这和 activity selection 不同。Activity selection 的 greedy 是 exact algorithm，Set Cover 的 greedy 是 approximation algorithm。

### Randomized algorithms

随机化算法不一定是“不严谨”。很多随机化算法有清楚的概率保证。

常见两类：

| 类型 | 特点 |
|---|---|
| Las Vegas | 永远正确，但运行时间是随机变量 |
| Monte Carlo | 运行时间固定或有界，但有小概率出错 |

Randomized QuickSort 是 Las Vegas 风格：排序结果一定正确，但 pivot 随机，运行时间是期望 $O(n\log n)$。

一些 randomized primality testing 更接近 Monte Carlo：运行很快，但可能有极小概率给错答案。

随机化的价值是打破最坏情况输入对 deterministic choice 的攻击，或者用采样降低计算成本。

### Randomized QuickSort

QuickSort 最坏情况是 $O(n^2)$，比如每次 pivot 都选到最差位置。

随机选 pivot 后，输入顺序不再能稳定制造最坏分割。

期望复杂度变成：

$$
O(n\log n)
$$

这里的分析重点在于随机 pivot 让递归树在期望上保持平衡，代码只是表面形式。

### 复杂性边界和建模选择

一个问题如果 NP-hard，通常说明它太一般了。

可以问：

- 输入图是否是 DAG
- 图是否 bipartite
- 权重是否非负
- 容量是否小
- 目标是否允许近似
- 是否只需要高概率正确
- 是否可以接受 pseudo-polynomial
- 是否有小参数

很多高效算法来自特殊结构。

比如：

- 最长路径在一般图中难，在 DAG 上可以线性 DP
- Matching 在 general graph 中更难，在 bipartite graph 中可以用 flow
- 0/1 knapsack 一般是 NP-hard，但容量小的时候 DP 很实用
- Set Cover 难，但 greedy 有 logarithmic approximation

所以复杂性理论不是和算法设计分开的。它告诉我们：哪些结构重要，哪些假设让问题变简单。

### Part VI 的总结

算法设计有三种结果：

1. 找到 polynomial-time exact algorithm
2. 证明一般情形很难
3. 改变目标：限制输入、近似、随机化、参数化、启发式

前几篇主要讲第一种。

Part VI 讲的是第二种和第三种。

这也是算法思维里很重要的一层：不是所有问题都值得继续硬找 exact algorithm。看清边界后，才知道该换哪种问题形式。
