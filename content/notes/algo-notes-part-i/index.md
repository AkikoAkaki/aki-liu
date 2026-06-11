---
title: "算法分析 1：算法设计、正确性与复杂度分析"
date: 2026-05-06
tags: ["algorithms", "computer-science"]
math: true
draft: false
---

<aside>

**TL;DR**

Part I 学的是算法课最底层的 thinking：怎么把一个问题写成可以计算的形式，怎么说明算法一定对，怎么分析它要花多少资源。

- 这门课更接近数学课，重点在设计、证明和归约，不在把代码一行行跑出来
- 一个算法问题先拆成：input、output、constraint、objective
- 设计时先问：我最终需要知道什么？它依赖哪些中间状态？这些状态怎么转移？
- 正确性证明通常靠 induction、exchange argument、cut property、invariant、duality、reduction
- 复杂度分析先确定 input size，再数状态数、边数、递归层数、每层工作量
- 分治的核心是 Divide / Conquer / Combine
- Master Theorem 处理的是 $T(n)=aT(n/b)+f(n)$ 这种递归规模关系
- 高层判断比实现细节更重要：什么时候能用 greedy，什么时候必须 DP，什么时候要转成 graph / flow / LP

</aside>

### 算法课真正要训练什么

算法课表面上有很多具体算法：Dijkstra、Bellman-Ford、Kruskal、Ford-Fulkerson、Simplex、Knapsack DP。

但最重要的不是把它们的代码背下来。

更核心的问题是：

- 一个自然语言问题怎样变成 formal problem
- 约束应该编码成状态、边、容量，还是不等式
- 为什么这个算法适用
- 为什么它不会错
- 它的成本由什么决定

很多看似和编程完全无关的问题，比如排课、分配、运输、活动选择、网络容量、路径限制，最后都可以转成一个算法问题。

这个转化过程才是 Design and Analysis of Algorithms 的中心。

### 问题建模：先把对象拆开

看到一个问题，先不要急着套算法。先把它拆成四件事：

| 维度 | 要问的问题 |
|---|---|
| Input | 给了哪些对象？数字、序列、图、集合、时间区间、容量？ |
| Constraint | 什么是合法解？不能冲突、不能超过容量、必须连通、必须覆盖？ |
| Objective | 要最大化还是最小化什么？长度、成本、收益、数量、风险？ |
| Output | 要输出一个值，还是输出具体方案？ |

很多题卡住，是因为没有先把这些东西分开。

比如“安排最多活动”：

- Input：一组活动，每个活动有 start time 和 finish time
- Constraint：被选活动之间不能重叠
- Objective：最大化活动数量
- Output：最多能选多少个，或者具体选哪些

再比如“每个学生分配一个项目，满足偏好并最大化匹配数”：

- Input：学生、项目、可接受关系
- Constraint：每个学生最多一个项目，每个项目最多一个学生
- Objective：最大化匹配数量
- Output：matching

第二个问题自然会变成 bipartite matching，第一个问题可能是 greedy 或 DP，取决于活动有没有 weight。

### 从问题到模型

算法设计中最常见的模型转换大概有几类：

| 原始问题特征 | 常见模型 |
|---|---|
| 依赖关系、先后顺序 | DAG / topological order |
| 路径、距离、可达性 | Graph shortest path / reachability |
| 有限次特殊操作 | Layered graph |
| 两类对象配对 | Bipartite matching / max flow |
| 容量、供需、运输 | Flow / min-cost flow |
| 线性目标 + 线性约束 | Linear programming |
| 最优子结构 + 重叠子问题 | Dynamic programming |
| 局部选择可能推出全局最优 | Greedy |
| 搜索空间太大且难验证边界 | NP / approximation / randomization |

这里没有一个万能公式。关键是读出问题里的结构。

如果约束像“每一步从一个状态走到另一个状态”，通常可以建图。

如果约束像“每个对象只能被用一次”，通常会想到 matching。

如果约束像“总量不能超过某个容量”，可能是 knapsack、flow 或 LP。

如果约束像“我现在的最优解依赖前面某些更小问题的最优解”，通常是 DP。

### 正确性证明比代码重要

算法课里，代码只是算法思想的一种表达。真正要说明的是：为什么这个方法一定得到正确答案。

常见证明方法：

| 方法 | 适用场景 |
|---|---|
| Induction | DP、递归算法、图上按拓扑序计算 |
| Exchange argument | Greedy 算法 |
| Cut property / cycle property | MST |
| Loop invariant | 迭代算法、Dijkstra、Bellman-Ford |
| Duality | LP、max-flow min-cut |
| Reduction | NP-completeness、把新问题转成旧问题 |

DP 的证明通常是 induction。

先定义 $dp[i]$ 的含义，再证明每个状态的递推确实覆盖了所有可能的最后一步决策，并且没有漏掉更优解。

Greedy 的证明通常是 exchange argument。

先假设有一个最优解和 greedy 解不同，然后把最优解中的某个选择换成 greedy 的选择，证明换完不变差。重复这个过程，最后得到 greedy 解也是最优。

图算法经常靠 invariant。

Dijkstra 的核心 invariant 是：每次从 priority queue 中取出的点，其最短距离已经确定。这个 invariant 依赖非负边权。如果有负边，这个保证就没了。

### 复杂度分析：先确定输入规模

复杂度分析第一步是确定 input size。

如果输入是数组，通常用 $n$。

如果输入是图，通常用：

- $n = |V|$
- $m = |E|$

如果输入有数值容量，比如 knapsack 的容量 $C$，要特别小心。$O(nC)$ 看起来像多项式，但如果 $C$ 用二进制表示，输入长度是 $\log C$，那 $O(nC)$ 就是 pseudo-polynomial。

复杂度通常来自几种来源：

| 来源 | 怎么数 |
|---|---|
| 遍历数组 | $O(n)$ |
| 遍历图 | $O(n+m)$ |
| 状态表 | 状态数量 × 每个状态转移成本 |
| 排序 | $O(n\log n)$ 或 $O(m\log m)$ |
| Priority queue | 每次 extract / update 的 log factor |
| 递归 | 层数 × 每层工作，或解 recurrence |
| Flow | 增广次数 × 每次找增广路成本 |

很多算法题不需要把实现细节写满，但必须清楚成本来自哪里。

### 分治：把跨越部分单独处理

分治的基本结构：

```text
solve(input[左..右]):
    if 足够小: 直接返回答案

    中点 m = (左+右)/2
    左答案 = solve(input[左..m])
    右答案 = solve(input[m+1..右])
    跨越答案 = ???

    return 合并(左答案, 右答案, 跨越答案)
```

分治的难点通常不在“递归解决左右两边”，而在 crossing case。

以最大子数组和为例：

- 最优子数组完全在左半边
- 最优子数组完全在右半边
- 最优子数组跨过中点

前两种递归处理。跨越中点的情况需要从中点向左扫一个最大后缀和，再从中点向右扫一个最大前缀和，二者相加。

于是：

$$
T(n)=2T(n/2)+O(n)
$$

根据 Master Theorem：

$$
T(n)=O(n\log n)
$$

### Master Theorem 的直觉

递归式：

$$
T(n)=aT(n/b)+f(n)
$$

其中：

- $a$：每层分出几个子问题
- $n/b$：每个子问题多大
- $f(n)$：当前层额外做多少合并工作

比较的是当前层工作 $f(n)$ 和叶子规模贡献 $n^{\log_b a}$。

| 情况 | 直觉 | 结果 |
|---|---|---|
| $f(n)$ 更小 | 工作主要在叶子 | $T(n)=\Theta(n^{\log_b a})$ |
| $f(n)$ 同阶 | 每层贡献差不多 | $T(n)=\Theta(n^{\log_b a}\log n)$ |
| $f(n)$ 更大 | 工作主要在根部 | $T(n)=\Theta(f(n))$ |

Merge sort：

$$
T(n)=2T(n/2)+O(n)
$$

这里 $n^{\log_2 2}=n$，每层都是 $O(n)$，一共 $\log n$ 层，所以 $O(n\log n)$。

二分查找：

$$
T(n)=T(n/2)+O(1)
$$

每层只做常数工作，一共 $\log n$ 层，所以 $O(\log n)$。

Strassen：

$$
T(n)=7T(n/2)+O(n^2)
$$

这里 $n^{\log_2 7}\approx n^{2.81}$，递归子问题贡献更大，所以复杂度是：

$$
O(n^{\log_2 7})
$$

### 算法选择的高层判断

很多题可以先按结构粗分：

| 看到什么 | 先想到什么 |
|---|---|
| 最优解依赖更小子问题 | DP |
| 局部最优看起来可交换 | Greedy + exchange proof |
| 有节点、边、路径、可达性 | Graph |
| 有额外路径状态 | Layered graph |
| 有两类对象一对一配对 | Bipartite matching |
| 有容量、流量、供需 | Flow |
| 线性目标和线性约束 | LP |
| 要证明新问题很难 | Reduction / NP-completeness |

这张表的作用是降低搜索空间，不是让人机械套模板。

算法设计最常见的失败方式，是在还没看清结构前就开始写某个熟悉算法。更好的顺序是：先建模，再判断范式，再证明正确性，最后分析复杂度。

Part I 的重点就是这套顺序。
