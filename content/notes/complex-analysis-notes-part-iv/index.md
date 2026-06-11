---
title: "复分析 4：Taylor、Laurent Series 与奇点分类"
date: 2026-05-03
tags: ["complex-analysis", "mathematics"]
math: true
draft: false
---

<aside>

**TL;DR**

Part IV 学的是复函数的局部结构：在一点附近，函数可以怎样展开，奇点又怎样被展开式分类。

- 解析函数可以在点附近展开成 Taylor series
- Power series 的收敛域是以展开中心为圆心的圆盘
- 收敛半径等于从展开中心到最近奇点的距离
- Taylor 是实心的，Laurent 是空心的
- Laurent series 允许负次幂，适合在奇点周围的环域展开
- Principal part 是 Laurent series 的负幂部分，决定奇点类型
- Removable singularity：没有负幂项
- Pole：有限个负幂项
- Essential singularity：无穷多个负幂项
- 分式函数的奇点类型通常由分子分母零点阶数相减决定

</aside>

### Power series 的几何

复分析里，power series 不是单纯的形式展开。

如果函数在 $z_0$ 附近解析，它可以写成：

$$
f(z)=\sum_{n=0}^{\infty}a_n(z-z_0)^n
$$

这个级数的收敛域在复平面上是一个圆盘 $|z-z_0|<R$。

这里最重要的直觉是：

收敛半径 $R$ 等于从展开中心 $z_0$ 到最近奇点的距离。

也就是说，power series 可以一直扩展，直到撞上第一个奇点。

这比实分析更几何。实轴上的收敛区间，其实是复平面里收敛圆盘和实轴的交集。

### Taylor series

如果 $f$ 在圆盘 $|z-z_0|<R$ 内解析，那么：

$$
f(z)=\sum_{n=0}^{\infty}
\frac{f^{(n)}(z_0)}{n!}(z-z_0)^n
$$

Taylor series 描述的是函数在一个正常点附近的局部结构。

常见基础展开是 $e^z=\sum_{n=0}^{\infty}\frac{z^n}{n!}$、$\sin z=\sum_{n=0}^{\infty}(-1)^n\frac{z^{2n+1}}{(2n+1)!}$、$\cos z=\sum_{n=0}^{\infty}(-1)^n\frac{z^{2n}}{(2n)!}$。

最重要的还是几何级数：$\frac{1}{1-z}=\sum_{n=0}^{\infty}z^n,\ |z|<1$。

很多复杂展开，本质上都是把函数凑成几何级数、指数、三角函数的变形。

### 平移展开中心

如果展开中心不是 0，先换元 $w=z-z_0$，把函数改写成 $w$ 的函数，再用基础公式。

比如在 $z_0=i$ 附近展开 $f(z)=\frac{1}{1-z}$。令 $w=z-i$，于是 $z=w+i$。代入：

$$
\begin{aligned}
\frac{1}{1-z}
&=\frac{1}{1-i-w}\\
&=\frac{1}{1-i}\cdot
\frac{1}{1-\frac{w}{1-i}}
\end{aligned}
$$

只要 $\left|\frac{w}{1-i}\right|<1$，就可以用几何级数：

$$
\begin{aligned}
\frac{1}{1-z}
&=\sum_{n=0}^{\infty}
\frac{(z-i)^n}{(1-i)^{n+1}}
\end{aligned}
$$

展开题的核心动作经常就是：平移、提大项、强凑成 $1-u$ 的形式。

### Laurent series

Taylor series 只能在解析点附近展开。

如果展开中心本身是奇点，比如 $\frac{1}{z}$ 在 $z=0$ 附近，就不可能只用非负次幂表达。

Laurent series 允许负次幂：

$$
f(z)=\sum_{n=-\infty}^{\infty}c_n(z-z_0)^n
$$

它适用于环域 $r<|z-z_0|<R$。

你的笔记里有一个很好的说法：

Taylor 是实心的，Laurent 是空心的。

如果函数在圆盘里都好好的，用 Taylor。

如果圆心有一个奇点，只能在奇点外面的圆环里展开，用 Laurent。

### Principal part

Laurent series 可以分成两部分：

解析部是 $\sum_{n=0}^{\infty}c_n(z-z_0)^n$，主部是 $\sum_{n=1}^{\infty}\frac{c_{-n}}{(z-z_0)^n}$。主部就是负次幂部分，奇点的信息全部藏在这里。

- 主部为空：奇点可以被补掉
- 主部有限：函数像某个有限阶 $\frac{1}{(z-z_0)^m}$ 爆掉
- 主部无限：函数在奇点附近行为极其复杂

### 提大项原则

Laurent 展开里最常用的公式还是几何级数：$\frac{1}{1-u}=\sum_{n=0}^{\infty}u^n$，前提是 $|u|<1$。所以遇到 $\frac{1}{A-B}$，可以有两种提法：

$$
\begin{aligned}
\frac{1}{A-B}
&=\frac{1}{A}\frac{1}{1-B/A}\quad &&\text{when } |B/A|<1,\\
&=-\frac{1}{B}\frac{1}{1-A/B}\quad &&\text{when } |A/B|<1.
\end{aligned}
$$

到底提 $A$ 还是提 $B$，取决于哪个能让括号里的 $u$ 满足 $|u|<1$。

这就是提大项原则。

区域不同，展开不同。一个函数在不同 annulus 里会有不同 Laurent series。

### 同一函数，不同圆环域

看 $f(z)=\frac{1}{(z-1)(z-2)}$。先部分分式：$f(z)=\frac{-1}{z-1}+\frac{1}{z-2}$。

在区域 $1<|z|<2$，处理第一项时，因为 $|z|>1$，$z$ 是大项：

$$
\begin{aligned}
\frac{-1}{z-1}
&=-\frac{1}{z}\frac{1}{1-\frac{1}{z}}\\
&=-\sum_{n=0}^{\infty}\frac{1}{z^{n+1}}
\end{aligned}
$$

处理第二项时，因为 $|z|<2$，常数 2 是大项：

$$
\begin{aligned}
\frac{1}{z-2}
&=-\frac{1}{2}\frac{1}{1-\frac{z}{2}}\\
&=-\sum_{n=0}^{\infty}\frac{z^n}{2^{n+1}}
\end{aligned}
$$

所以同一个函数，在这个圆环域里同时有负幂和正幂。

如果区域换成 $|z|>2$，两项都会按 $z$ 是大项展开，结果就不同。

### 奇点分类

孤立奇点：

在 $z_0$ 处不解析，但在某个去心邻域 $0<|z-z_0|<R$ 内解析。

孤立奇点分三类：

| 类型 | Laurent 特征 | 极限特征 |
|---|---|---|
| Removable | 没有负幂项 | 极限存在且有限 |
| Pole | 有有限个负幂项 | 模长趋于无穷 |
| Essential | 有无穷多个负幂项 | 极限不存在，且不是无穷 |

比如 $\frac{\sin z}{z}$ 在 $z=0$ 是 removable singularity，因为 $\sin z=z-\frac{z^3}{3!}+\cdots$，所以 $\frac{\sin z}{z}=1-\frac{z^2}{3!}+\cdots$，没有负幂项。

### Pole 和阶数

如果 Laurent 主部最低到 $\frac{c_{-m}}{(z-z_0)^m}$，且 $c_{-m}\neq 0$，那么 $z_0$ 是 $m$ 阶极点。

等价地，最小的 $m$ 使得 $\lim_{z\to z_0}(z-z_0)^m f(z)$ 存在且非零，那么 $m$ 就是极点阶数。

例如 $\frac{1}{z^2}$ 在 0 是 2 阶极点。

### Essential singularity

典型例子是 $e^{1/z}$。因为：

$$
\begin{aligned}
e^{1/z}
&=1+\frac{1}{z}+\frac{1}{2!z^2}+\frac{1}{3!z^3}+\cdots
\end{aligned}
$$

有无穷多个负幂项。

所以 $z=0$ 是 essential singularity。

如果外面乘一个多项式，比如 $z^3e^{1/z}$，只能消掉有限个负次幂，后面仍然有无穷多个负幂项。

所以仍然是 essential singularity。

### 分子分母阶数对消法则

分式函数 $h(z)=\frac{f(z)}{g(z)}$ 判断 $z_0$ 的奇点类型，常常只需要比较分子和分母在 $z_0$ 处的零点阶数。

设：

- 分子 $f$ 在 $z_0$ 有 $n$ 阶零点
- 分母 $g$ 在 $z_0$ 有 $m$ 阶零点

那么：

- 如果 $n\geq m$，奇点可去
- 如果 $n<m$，是 $m-n$ 阶极点

比如 $\frac{\sin z}{z^3}$ 在 0 附近，$\sin z$ 有 1 阶零点，$z^3$ 有 3 阶零点。

所以 0 是 2 阶极点。

有理分式不会产生 essential singularity。本性奇点通常来自 $e^{1/z}$、$\sin(1/z)$ 这类带无穷级数嵌套的函数。

### 零点和极点的关系

如果 $f(z_0)=0$，并且 $f(z)=(z-z_0)^m g(z)$，其中 $g$ 在 $z_0$ 解析且 $g(z_0)\neq 0$，那么 $z_0$ 是 $m$ 阶零点。

零点和极点互为倒数关系：

如果 $z_0$ 是 $f$ 的 $m$ 阶零点，那么 $z_0$ 是 $1/f$ 的 $m$ 阶极点。

这个关系非常实用。很多极点阶数的判断，其实是在看分母零点阶数。

### Part IV 的核心线

Taylor 和 Laurent series 给了复函数一个局部显微镜。

正常点附近是 Taylor：

```text
非负幂，实心圆盘
```

奇点附近是 Laurent：

```text
允许负幂，空心圆环
```

奇点分类看 principal part：

```text
没有负幂项 → removable
有限负幂项 → pole
无限负幂项 → essential
```

下一篇 residue theorem 只会抽取其中一个系数：$c_{-1}$。但这个系数会决定整个闭合积分。
