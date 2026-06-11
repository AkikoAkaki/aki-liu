---
title: "算法分析 5：Flow、Matching、LP 与约束建模"
date: 2026-05-02
tags: ["algorithms", "optimization"]
math: true
draft: false
---

<aside>

**TL;DR**

Part V 学的是约束建模：当问题里有容量、分配、供需、线性约束时，怎么把它转成 flow、matching 或 LP。

- Matching 适合一对一配对，尤其是两类对象之间的兼容关系
- Bipartite matching 可以转成 max flow
- Flow 适合容量、供需、路径输送、资源分配
- Max-flow min-cut 把“最大可输送量”和“最小瓶颈容量”连在一起
- Min-cost flow 适合“既要满足供需，又要最小化成本”
- LP 适合线性目标 + 线性约束
- Duality 的核心是：对偶问题给出原问题的上界或下界
- 这类问题重点在变量、边、容量、不等式怎么定义

</aside>

### 从算法到约束模型

有些问题不像路径问题，也不像 DP。

它们通常长这样：

- 给每个人分配一个任务
- 每条道路有运输容量
- 每个仓库有供给，每个城市有需求
- 要在预算、比例、质量约束下最大化收益
- 要证明某个方案已经最优

这类问题的核心是约束。

Flow、matching、LP 都是在回答同一个问题：如何把约束写成一个可求解的优化模型。

### Matching：一对一配对

Matching 适合处理“每个对象最多用一次”的配对问题。

最典型的是 bipartite matching。

左边一类对象，右边一类对象。边表示兼容。

例子：

- 学生可以做哪些项目
- 工人可以执行哪些任务
- 行和列之间是否可以放一个棋子
- 人和时间段是否兼容

目标通常是最大化匹配数量，或者找到完美匹配。

建模步骤：

1. 确定二部图两侧
2. 确定什么时候连边
3. 每个点最多匹配一次
4. 求 maximum matching 或 perfect matching

### Bipartite matching = Max flow

Bipartite matching 可以转成 max flow。

构造：

- 加超级源点 $s$
- $s$ 连到左侧所有点，容量 1
- 左侧点连到右侧点，容量 1，表示可匹配关系
- 右侧点连到超级汇点 $t$，容量 1
- 求 $s$ 到 $t$ 的最大流

每一单位流对应一对匹配。

容量 1 保证每个左侧点和右侧点最多被使用一次。

所以 matching 的排他性，被 flow 的 capacity 约束表达出来了。

这类转换的重点在于看出“最多一次”可以用容量 1 表示，算法实现是后面的事。

### Flow network

Flow network 包含：

- source $s$
- sink $t$
- directed edges
- capacity $c(e)$
- flow $f(e)$

约束：

1. Capacity constraint：

$$
0 \leq f(e) \leq c(e)
$$

2. Flow conservation：

除 source 和 sink 外，每个点流入量等于流出量。

Flow 的直觉是：资源从源点流向汇点，中间节点不能凭空制造或吞掉资源。

这很适合建模运输、分配、通道容量、并行路径、任务安排。

### Residual network

Residual network 表示当前流量方案还能怎么调整。

如果一条边还有剩余容量，就可以继续往正向推。

如果一条边已经推过流，也可以沿反向边撤回一部分流。

这解释了 Ford-Fulkerson 中一个看似奇怪的现象：某条边之前被推进了流，后面可能又被减少。

反向边并不表示真的有反向道路。它表示可以取消之前的选择，把容量释放给更好的路径。

这也是 flow 比 simple greedy 更强的地方。它允许后悔和重排。

### Max-flow Min-cut

Cut 是把顶点分成两边：

$$
S \cup T = V,\quad s \in S,\quad t \in T
$$

cut capacity 是从 $S$ 指向 $T$ 的边容量总和。

任何 $s$ 到 $t$ 的 flow 都不能超过任何 cut 的容量，因为所有流都必须跨过这个 cut。

所以：

$$
\text{max flow} \leq \text{min cut}
$$

Max-flow Min-cut Theorem 说它们其实相等。

这很重要。它给了 flow 问题一个双重解释：

- primal view：最多能运多少流
- dual view：最小瓶颈在哪里

当一个 flow 达到某个 cut 的容量，就证明它已经最优。

### Disjoint paths

边不相交路径可以用 flow 建模。

把每条边容量设为 1。最大流值就是最多有多少条 edge-disjoint paths。

如果要 vertex-disjoint paths，可以拆点：

$$
v_{in} \to v_{out}
$$

这条边容量设为 1，所有进入 $v$ 的边连到 $v_{in}$，所有从 $v$ 出发的边从 $v_{out}$ 连出。

这样经过顶点 $v$ 的总流量最多 1。

拆点的本质是：把“点容量”转成“边容量”。

### Min-cost flow

Max flow 只关心能流多少。

Min-cost flow 还关心每单位流的成本。

适用场景：

- 节点有供给和需求
- 边有单位运输成本
- 要满足所有需求，并最小化总成本

建模时常用：

$$
supply(v)=\text{现有量}-\text{目标量}
$$

供给点连 source，需求点连 sink，原图边带 cost。

如果问题说“最便宜地把多余资源搬到缺少资源的地方”，基本就是 min-cost flow。

### LP：线性目标和线性约束

Linear programming 适合这种问题：

```text
maximize / minimize  一个线性目标
subject to           一组线性约束
                     变量符号限制
```

标准形大概是：

$$
\max c^T x
$$

subject to：

$$
Ax \leq b,\quad x \geq 0
$$

LP 建模的关键是选变量。

变量选对了，约束通常自然写出来。

比如混合问题：

- $x_i$ 表示第 $i$ 种原料使用比例
- 约束是比例总和为 1
- 各成分含量在上下限之间
- 目标是最大化收益或最小化成本

比如调度问题：

- $x_{ij}=1$ 表示任务 $i$ 是否分给机器 $j$
- 每个任务必须被分配一次
- 每台机器不能超过容量
- 目标是最小化总成本

如果变量要求 0/1，那就是 integer programming，通常会进入 NP-hard 的世界。

### Slack variable 和标准化

LP 里的很多形式差异只是语法。

如果约束是：

$$
a_1x_1+a_2x_2 \leq b
$$

可以加 slack variable：

$$
a_1x_1+a_2x_2+s=b,\quad s\geq 0
$$

如果变量没有非负限制，可以写成两个非负变量之差：

$$
y = y^+ - y^-
$$

其中：

$$
y^+ \geq 0,\quad y^- \geq 0
$$

这些操作的意义是把不同形式的约束统一到 LP solver 能处理的格式。

### Simplex 的高层理解

Simplex 可以理解为在 feasible polytope 的顶点之间移动。

LP 的最优解如果存在，就可以在某个顶点上取得。

Simplex 从一个顶点出发，每次沿着一条边移动到更好的相邻顶点，直到没有相邻顶点能改进目标值。

它的高层直觉很像 greedy walk on polytope。

实际手算 tableau 是机械过程，但在网站笔记里更重要的是：

- 约束形成一个多面体
- 目标函数是一组平行超平面
- 最优点出现在边界顶点
- pivot 是从一个 basis 换到另一个 basis

### Duality

每个 LP 都有一个 dual。

对偶的意义是给原问题提供界。

如果原问题是 maximize，那么任意 dual feasible solution 都给原问题一个 upper bound。

这就是 weak duality：

$$
\text{primal value} \leq \text{dual value}
$$

Strong duality 说，在合适条件下，如果最优解存在，那么：

$$
\text{primal optimum} = \text{dual optimum}
$$

这个结论非常强。它说明有时候证明一个解最优，不需要枚举所有可行解，只需要给出一个 primal solution 和一个 dual solution，并且它们的目标值相等。

### Flow 和 LP 的关系

Max flow 也可以写成 LP。

变量是每条边上的 flow：

$$
f_e
$$

约束是 capacity 和 flow conservation。

目标是最大化从 source 流出的总量。

Min cut 则对应它的对偶结构。

所以 max-flow min-cut 可以看成一种组合优化里的强对偶现象。

这也是为什么 flow 既是图算法，也是优化模型。

### 建模时怎么判断

可以按下面的方式判断：

| 问题特征 | 模型 |
|---|---|
| 两类对象一对一匹配 | Bipartite matching |
| 每个对象有容量限制 | Flow |
| 有运输成本 | Min-cost flow |
| 线性目标 + 线性约束 | LP |
| 变量必须是 0/1 | ILP，通常更难 |
| 要证明最优值边界 | Cut / duality |

这类问题最常见的错误，是只看见“分配”就直接写 matching。

如果每个对象不止能用一次，或者有容量、费用、供需，就应该考虑 flow 或 LP。

如果目标和约束都是线性的，但没有明显图结构，LP 往往更自然。

Part V 的重点就是：把约束翻译成模型。算法只是模型之后的求解工具。
