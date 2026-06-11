---
title: "复分析 5：Residue Theorem 与复积分降维"
date: 2026-05-02
tags: ["complex-analysis", "mathematics"]
math: true
draft: false
---

<aside>

**TL;DR**

Part V 学的是复积分最强的计算工具：闭合路径积分可以被奇点的留数完全控制。

- Residue 是 Laurent series 中 $(z-z_0)^{-1}$ 项的系数
- 留数 = 过路费，路径绕奇点一圈就贡献 $2\pi i\operatorname{Res}$
- Residue Theorem：$\oint_C f(z)\,dz=2\pi i\sum\operatorname{Res}(f,z_k)$
- 先看分母，分母告诉你极点在哪，极点决定方法
- 简单极点可以用 $\operatorname{Res}(P/Q,z_0)=P(z_0)/Q'(z_0)$
- 高阶极点先乘掉主爆炸项，再求导
- 留数定理把复杂积分转成有限个局部系数计算

</aside>

### Residue 是什么

如果 $z_0$ 是孤立奇点，函数在 $z_0$ 附近有 Laurent expansion：

$$
f(z)=\sum_{n=-\infty}^{\infty}c_n(z-z_0)^n
$$

Residue 是其中：

$$
c_{-1}
$$

也就是：

$$
\frac{c_{-1}}{z-z_0}
$$

这一项的系数。

记作：

$$
\operatorname{Res}(f,z_0)
$$

为什么偏偏是 $z^{-1}$ 项重要？

因为：

$$
\oint_C (z-z_0)^n\,dz=0
$$

对所有 $n\neq -1$ 都成立，而：

$$
\oint_C \frac{1}{z-z_0}\,dz=2\pi i
$$

所以整个 Laurent series 里，闭合积分只会“看见”$-1$ 次幂项。

### 留数 = 过路费

可以用你笔记里的说法：

留数 = 过路费。

每当路径绕着一个奇点转一圈，这个奇点就贡献一次：

$$
2\pi i\cdot \operatorname{Res}(f,z_0)
$$

如果路径围住多个奇点，贡献相加。

如果奇点在路径外面，它对积分没有贡献。

这和路径变形直觉一致：路径只关心自己绕住了哪些奇点。

### Residue Theorem

Residue Theorem：

如果 $f$ 在闭合曲线 $C$ 上及其内部解析，除了有限个孤立奇点 $z_1,\ldots,z_k$，那么：

$$
\begin{aligned}
\oint_C f(z)\,dz
&=2\pi i\sum_{j=1}^{k}\operatorname{Res}(f,z_j)
\end{aligned}
$$

这条定理把一个全局积分问题，降维成有限个局部系数问题。

不需要沿路径积分，不需要参数化曲线，只要找内部奇点并计算留数。

### 先看分母

做 residue problem 时，最先看分母。

分母告诉你极点在哪，极点决定用什么方法。

比如：

$$
\frac{P(z)}{Q(z)}
$$

极点来自：

$$
Q(z)=0
$$

下一步看：

- 哪些极点在 contour 内部
- 它们是简单极点还是高阶极点
- 分子是否和分母发生对消

这个顺序比直接展开 Laurent series 快得多。

### 简单极点

如果 $z_0$ 是简单极点，那么：

$$
\begin{aligned}
\operatorname{Res}(f,z_0)
&=\lim_{z\to z_0}(z-z_0)f(z)
\end{aligned}
$$

特别地，如果：

$$
f(z)=\frac{P(z)}{Q(z)}
$$

其中：

$$
Q(z_0)=0,\quad Q'(z_0)\neq 0,\quad P(z_0)\neq 0
$$

那么：

$$
\operatorname{Res}(f,z_0)=\frac{P(z_0)}{Q'(z_0)}
$$

这个公式非常常用。

例如：

$$
f(z)=\frac{1}{z^4+1}
$$

在简单根 $z_0$ 处：

$$
\operatorname{Res}(f,z_0)=\frac{1}{4z_0^3}
$$

因为分母导数是 $4z^3$。

### 高阶极点

如果 $z_0$ 是 $m$ 阶极点，那么：

$$
\begin{aligned}
\operatorname{Res}(f,z_0)
&=\frac{1}{(m-1)!}
\lim_{z\to z_0}
\frac{d^{m-1}}{dz^{m-1}}
\left[(z-z_0)^m f(z)\right]
\end{aligned}
$$

直觉是：

先乘上 $(z-z_0)^m$，消掉主要爆炸项，让函数变回解析函数。

然后通过求导抽出原来 Laurent series 里的 $(z-z_0)^{-1}$ 系数。

一阶极点时，$m=1$，这个公式就退化成：

$$
\lim_{z\to z_0}(z-z_0)f(z)
$$

### CIF 和 residue 的关系

Cauchy Integral Formula 其实是 residue theorem 的特殊形式。

如果：

$$
\oint_C \frac{f(z)}{z-z_0}\,dz
$$

其中 $f$ 在内部解析，那么 integrand 在 $z_0$ 有简单极点，留数是：

$$
f(z_0)
$$

所以 residue theorem 给出：

$$
\begin{aligned}
\oint_C \frac{f(z)}{z-z_0}\,dz
&=2\pi i f(z_0)
\end{aligned}
$$

这正是 CIF。

高阶 CIF 也对应高阶极点留数计算。

### 例子：有理函数闭合积分

计算：

$$
\oint_{|z|=2}\frac{e^z}{(z-1)^3}\,dz
$$

这里 $z=1$ 在圆内，是 3 阶极点。

用 generalized CIF：

$$
\begin{aligned}
\oint_C \frac{f(z)}{(z-z_0)^3}\,dz
&=\frac{2\pi i}{2!}f''(z_0)
\end{aligned}
$$

其中：

$$
f(z)=e^z,\quad z_0=1
$$

所以：

$$
\begin{aligned}
\oint_{|z|=2}\frac{e^z}{(z-1)^3}\,dz
&=\pi i e
\end{aligned}
$$

这类题不要真的参数化积分。它的结构已经告诉你该用 CIF / residue。

### 无穷远点留数

有时也会讨论无穷远点的留数。

定义：

$$
\begin{aligned}
\operatorname{Res}(f,\infty)
&=-
\operatorname{Res}\left(\frac{1}{z^2}f\left(\frac{1}{z}\right),0\right)
\end{aligned}
$$

还有一个很有用的结论：

所有有限奇点和无穷远点的留数总和为 0。

$$
\sum_{k}\operatorname{Res}(f,z_k)+\operatorname{Res}(f,\infty)=0
$$

这有时可以用来快速算某个难算的留数。

### Residue theorem 的计算流程

一个闭合 contour integral 通常按这个顺序：

1. 找出所有分母为零的点
2. 判断哪些在 contour 内部
3. 判断极点阶数
4. 选留数公式
5. 求内部留数之和
6. 乘以 $2\pi i$
7. 如果 contour 是顺时针，结果取负

如果函数在 contour 内部没有奇点，结果就是 0。

如果奇点在 contour 外部，也不贡献。

如果奇点在 contour 上，需要额外处理，普通 residue theorem 不能直接套。

### Residue theorem 的直觉

从 Cauchy's Theorem 到 Residue Theorem，逻辑是连续的。

解析区域里没有奇点，闭合积分为 0。

如果有奇点，路径不能穿过它们，也不能把它们抹掉。

但每个孤立奇点对闭合积分的影响，只由 Laurent series 的 $c_{-1}$ 决定。

所以全局路径积分被压缩成：

```text
路径绕住哪些奇点
每个奇点的 residue 是多少
```

这就是复积分的降维。

Part VI 里，实积分会被转成复平面里的闭合 contour integral，然后用 residue theorem 解决。
