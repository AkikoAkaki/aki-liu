---
title: "算法分析 3：Greedy、局部选择与正确性证明"
date: 2026-05-04
tags: ["algorithms", "greedy"]
math: true
draft: false
---

<aside>

**TL;DR**

Part III 学的是 greedy：什么时候局部最优可以推出全局最优。

- Greedy 每一步都做当前看起来最好的选择
- Greedy 成立需要 greedy-choice property 和 optimal substructure
- 证明通常靠 exchange argument：把某个最优解逐步换成 greedy 解，且不变差
- 无权 activity selection 可以 greedy；有权 activity scheduling 通常要 DP
- MST 的 greedy 正确性靠 cut property 和 cycle property
- Dijkstra 是 greedy，但依赖非负边权
- Huffman coding 每次合并频率最小的两个节点，也是 greedy
- Greedy 的风险是：局部选择可能提前锁死未来选择

</aside>

### Greedy 的问题意识

Greedy 算法的形式很简单：每一步都做当前局部最好的选择。

难点不在算法怎么写，而在这个局部选择是否值得相信。

很多问题看起来都可以 greedy：

- 每次选最短的活动
- 每次选价值最大的物品
- 每次选当前最短的边
- 每次选最近的节点

但只有一部分是对的。

Greedy 成功的核心条件是：当前这个选择不会破坏某个全局最优解。换句话说，总存在一个最优解包含 greedy 的第一步选择。

这就是 greedy-choice property。

### Exchange argument

Greedy 最常用的证明是 exchange argument。

标准思路：

1. 设 $G$ 是 greedy 解，$O$ 是某个最优解
2. 找到 $G$ 和 $O$ 第一个不同选择
3. 把 $O$ 中对应部分换成 greedy 的选择
4. 证明换完后仍然可行，且目标值不变差
5. 重复交换，最后得到一个和 greedy 解一致的最优解

这类证明的核心在于解释交换后为什么不变差，形式本身不重要。

如果你找不到交换理由，通常说明 greedy 很可能不成立。

### Activity selection

无权活动选择问题：

给一组活动，每个活动有开始时间和结束时间，选择最多数量的互不重叠活动。

正确的 greedy 策略是：

```text
每次选择结束时间最早的活动
```

为什么不是开始最早？因为开始早不代表给后面留出更多空间。

为什么不是持续时间最短？短活动可能卡在中间，阻断两边更好的组合。

结束时间最早的活动有一个特殊性质：它给剩余活动留下最大空间。

证明：

设 $g$ 是结束时间最早的活动。取任意一个最优解 $O$，设它的第一个活动是 $o$。

因为 $g$ 结束不晚于 $o$，所以把 $O$ 中的第一个活动 $o$ 换成 $g$ 后，后面的活动仍然不冲突。

新解大小不变，所以仍然最优，并且包含 greedy 的第一步选择。

接下来对子问题重复同样论证。

### 有权活动调度为什么不能 greedy

如果每个活动有 weight，目标变成最大化总价值，结束时间最早就不一定对了。

一个长活动可能价值很高，胜过多个短活动。

这时问题变成 weighted interval scheduling，通常用 DP：

$$
T[k] = \max(T[k-1], v_k + T[p(k)])
$$

这个对比很重要。

同样是活动选择：

- 无权：目标是数量，结束最早有 exchange argument
- 有权：目标是价值，局部结束早不保证价值最大，需要 DP 记历史

算法范式取决于 objective，不只取决于题面长得像不像。

### MST：Cut Property

Minimum Spanning Tree 是 greedy 的经典成功案例。

MST 的核心正确性来自 cut property：

对任意 cut，跨过这个 cut 的最小权重边是 safe edge，可以被某棵 MST 包含。

直觉是：

如果某棵 MST 没有这条最小 crossing edge $e$，那么加上 $e$ 会形成一个环。这个环里一定还有另一条跨过同一个 cut 的边 $f$。因为 $e$ 是最小 crossing edge，所以：

$$
w(e) \leq w(f)
$$

用 $e$ 替换 $f$，树仍然连通，权重不增加。

所以选择 $e$ 是安全的。

Kruskal 和 Prim 都是在不断选择 safe edge。

### Kruskal 和 Prim 的区别

Kruskal：

- 全局按边权从小到大看边
- 只要加入后不形成环，就加入
- 更像“把很多小树逐渐合并”
- 常用 union-find 判断是否成环

Prim：

- 从任意起点开始维护一棵树
- 每次选择连接当前树和外部节点的最小边
- 更像“从一个点向外扩张”
- 常用 priority queue 找最小 crossing edge

两者的正确性都依赖 cut property。

一些有用结论：

- 环上 maximum weight edge 一定不在某棵 MST 中
- 跨 cut 的 minimum weight edge 是 safe 的
- bridge 一定在 MST 中
- 如果所有边权互不相同，MST 唯一

### Dijkstra：Greedy 依赖非负边权

Dijkstra 也是 greedy。

它每次从未确定节点中取出当前距离最小的节点，并认为这个距离已经是最终最短距离。

这个判断成立的原因是：所有边权非负。

如果当前最小距离是 $d[u]$，任何绕到别的未确定节点再回来更新 $u$ 的路径，都只会更长，因为边权不能减少距离。

所以 $u$ 被取出时，$d[u]$ 已经确定。

这就是 Dijkstra 的 invariant。

如果有负权边，这个 invariant 失效。一个节点现在看起来最近，之后可能通过一条负边被改得更短。

所以：

- 非负边权 + shortest path：Dijkstra
- 有负边权但无负环：Bellman-Ford
- DAG：拓扑序 DP 可以处理负边权

算法选择要看约束。Dijkstra 的重点在于非负边权支撑了 greedy 选择，priority queue 只是实现工具。

### Bellman-Ford 更像 DP

Bellman-Ford 不做 Dijkstra 那种“当前最小已经最终”的 greedy 判断。

它的思想是：

第 $i$ 轮后，所有最多使用 $i$ 条边的最短路都被正确计算。

因为一条简单最短路最多有 $n-1$ 条边，所以做 $n-1$ 轮 relaxation 就够了。

这更像 DP：

$$
dist_i[v] = \min_{(u,v)\in E}(dist_{i-1}[u]+w(u,v))
$$

实现上可以用一个数组反复松弛，但证明思路是按路径边数做 induction。

这也解释了为什么 Bellman-Ford 可以处理负边：它没有提前确认某个点的最终距离。

### Huffman coding

Huffman coding 的目标是给字符设计 prefix-free code，使得期望编码长度最小。

Greedy 策略：

```text
每次合并频率最小的两个节点
```

直觉是：频率越低的字符越应该放在更深的位置。最深的两个叶子应该是频率最低的两个字符，而且它们可以做 sibling。

所以每次把两个最低频率字符合并成一个新节点，问题规模减少 1。

这个证明也有 exchange flavor：如果最深 sibling 不是两个最低频率字符，可以交换标签，不会增加总代价。

### Fractional knapsack 和 0/1 knapsack

Fractional knapsack 可以 greedy。

每个物品可以切分时，按单位价值排序，从高到低装入背包，就是最优。

因为任意一个低单位价值的重量，都可以被更高单位价值的重量替换，价值不会变差。

0/1 knapsack 不能这样做。

物品不可切分，局部单位价值最高的物品可能占用容量，导致错过更好的组合。

所以：

- Fractional knapsack：greedy
- 0/1 knapsack：DP / NP-hard decision variant

同一个题面，是否允许切分，会改变整个算法范式。

### Greedy 失败的常见原因

Greedy 失败通常有几种模式：

1. 局部选择占用了关键资源，后续无法补救
2. 当前收益最大，不代表组合收益最大
3. 当前结束最早、距离最近、重量最小，只是某个维度好，不代表目标函数好
4. 问题有隐藏的全局约束，需要状态记录

遇到一个新问题，如果想用 greedy，先问：

- 这个选择是否可以被交换进某个最优解
- 选择后剩余问题是否和原问题同型
- 是否存在一个小反例打破局部选择

如果这三个问题答不清楚，greedy 就不能直接用。

### Greedy 和 DP 的分界

Greedy 和 DP 都依赖 optimal substructure。

区别在于：

- Greedy 只需要保留一个当前选择
- DP 要保留多个状态，因为不同历史会影响未来

Activity selection 无权版本里，选最早结束活动后，剩余问题只看它之后的活动，历史不重要。

Weighted interval scheduling 里，活动价值改变了选择的比较方式，需要保留前缀最优值。

Dijkstra 里，非负边权保证当前最短的点不会被未来路径反超。

Bellman-Ford 里没有这个保证，只能按路径长度逐轮更新。

Part III 的核心判断就是：局部选择有没有足够强的结构保证。能证明，就 greedy；不能证明，通常要 DP、graph search、flow 或更复杂的模型。
