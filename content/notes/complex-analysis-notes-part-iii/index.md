---
title: "复分析 3：复积分、路径无关与 Cauchy Theory"
date: 2026-05-04
tags: ["complex-analysis", "mathematics"]
math: true
draft: false
---

<aside>

**TL;DR**

Part III 学的是复分析最核心的一组定理：解析函数的积分受路径、边界和奇点控制。

- 复积分沿 contour 计算，本质是把路径参数化成实变量积分
- 如果有 antiderivative，积分只看起点和终点，路径无关
- Cauchy's Theorem：单连通区域内解析函数沿闭合路径积分为 0
- 路径可以像橡皮筋一样变形，只要不跨过奇点，积分值不变
- Cauchy Integral Formula：解析函数内部点的值由边界积分决定
- CIF 进一步推出解析函数自动无穷可导
- Cauchy Estimates 把“边界决定内部”量化成导数上界
- Liouville Theorem：有界 entire function 必须是常数

</aside>

### Contour integral

复积分沿路径进行。

如果路径 $C$ 可以参数化为：

$$
z=z(t),\quad a\leq t\leq b
$$

那么：

$$
\begin{aligned}
\int_C f(z)\,dz
&=\int_a^b f(z(t))z'(t)\,dt
\end{aligned}
$$

这叫暴力参数化积分。

它是最底层的方法：把复积分转成实变量积分。

但复分析真正有意思的地方是，很多时候你不需要真的积分。解析性会让路径积分大幅简化。

### Antiderivative and path independence

如果 $f$ 在区域内有 antiderivative $F$，也就是：

$$
F'(z)=f(z)
$$

那么：

$$
\int_C f(z)\,dz = F(z(b))-F(z(a))
$$

积分只看起点和终点。

于是任何闭合路径都有：

$$
\oint_C f(z)\,dz=0
$$

这和实变量积分里的基本定理很像。

但复分析里更强的是：在合适区域中，解析性本身就会导致闭合积分为 0。

### Cauchy's Theorem

Cauchy's Theorem 的基本形式：

如果 $f$ 在单连通区域 $D$ 内解析，那么对 $D$ 内任何闭合路径 $C$：

$$
\oint_C f(z)\,dz=0
$$

这里有两个关键词：

- analytic
- simply connected

Simply connected 可以直观理解为区域里没有洞。

如果区域里没有奇点形成的洞，闭合路径可以连续缩成一点。解析函数沿这样的闭合路径积分为 0。

这就是你笔记里的直觉：

在复平面，只要区域内没有“坑”（奇点），怎么走积分都是 0。

### Deformation：橡皮筋理论

路径变形原则可以这样想：

积分路径像一根橡皮筋。

只要不被“钉子”（奇点）卡住，你可以随意把它捏扁、揉圆、拉伸，积分值不变。

如果两条闭合路径围住同一批奇点，并且变形过程中没有跨过奇点，那么：

$$
\oint_{C_1} f(z)\,dz = \oint_{C_2} f(z)\,dz
$$

如果路径能缩到一个点，并且里面没有奇点，积分就是 0。

这条直觉非常重要。后面的 residue theorem 本质上就是：闭合积分只关心路径绕住了哪些奇点。

### ML Estimate

有时候不需要精确计算积分，只需要证明它趋于 0 或者估计上界。

ML estimate：

如果在路径 $C$ 上：

$$
|f(z)|\leq M
$$

路径长度是 $L$，那么：

$$
\left|\int_C f(z)\,dz\right|\leq ML
$$

这条估计很朴素：积分的大小不超过最大高度乘路径长度。

它在实积分 contour method 里经常用来证明大圆弧上的积分消失。

### Cauchy Integral Formula

Cauchy Integral Formula 是复分析里最核心的定理之一。

如果 $f$ 在闭合曲线 $C$ 及其内部解析，$z_0$ 在 $C$ 内部，那么：

$$
f(z_0)=\frac{1}{2\pi i}\oint_C \frac{f(z)}{z-z_0}\,dz
$$

也可以写成：

$$
\oint_C \frac{f(z)}{z-z_0}\,dz=2\pi i f(z_0)
$$

这条公式的直觉非常强：

解析函数在内部某一点的值，完全由边界上的积分决定。

这就是“边界决定内部”。

### Generalized CIF

Cauchy Integral Formula 还有高阶导数版本：

$$
\begin{aligned}
f^{(n)}(z_0)
&=\frac{n!}{2\pi i}
\oint_C
\frac{f(z)}{(z-z_0)^{n+1}}\,dz
\end{aligned}
$$

等价地：

$$
\begin{aligned}
\oint_C \frac{f(z)}{(z-z_0)^{n+1}}\,dz
&=\frac{2\pi i}{n!}f^{(n)}(z_0)
\end{aligned}
$$

所以遇到：

$$
\oint_C \frac{f(z)}{(z-z_0)^m}\,dz
$$

可以直接把它识别成导数公式：

$$
\frac{2\pi i}{(m-1)!}f^{(m-1)}(z_0)
$$

这是一条结构结论，不只是技巧：解析函数的高阶导数也由边界控制。

### 解析函数自动无穷可导

在实分析里，一阶可导不代表二阶可导，更不代表无穷可导。

在复分析里，解析函数一旦成立，就自动有无穷多阶导数。

原因就在 generalized CIF。

如果 $f$ 解析，那么 $f^{(n)}(z_0)$ 可以用边界积分表示。这个公式对所有 $n$ 都成立。

所以 analytic 比 differentiable 强得多。

### Cauchy Estimates

Cauchy Estimates 把 CIF 的刚性量化。

如果 $f$ 在圆盘：

$$
|z-z_0|\leq R
$$

内解析，并且边界上：

$$
|f(z)|\leq M
$$

那么：

$$
|f^{(n)}(z_0)| \leq \frac{n!M}{R^n}
$$

直觉是：

解析函数非常刚性。边界上函数值最大是 $M$，圆盘半径是 $R$，那么圆心处第 $n$ 阶导数不能太大。

圆盘越大，限制越强。

特别是 entire function 可以取任意大的 $R$，于是这个估计会变得非常有力。

### Liouville Theorem

Liouville Theorem：

如果 $f$ 是 entire function，并且有界，那么 $f$ 必须是常数。

证明直觉很短。

由 Cauchy estimate，对任意 $z_0$：

$$
|f'(z_0)|\leq \frac{M}{R}
$$

因为 $f$ entire，半径 $R$ 可以任意大。

令：

$$
R\to\infty
$$

得到：

$$
f'(z_0)=0
$$

由于 $z_0$ 任意，所以 $f'$ 处处为 0，$f$ 是常数。

这就是复分析的刚性最经典的体现：一个函数想在整个复平面上处处解析又处处有界，唯一办法就是常数。

### Fundamental Theorem of Algebra

Liouville Theorem 可以证明代数基本定理。

结论：

任何非常数复系数多项式 $P(z)$ 都至少有一个复根。

反证。

假设 $P(z)$ 没有根，那么：

$$
f(z)=\frac{1}{P(z)}
$$

在整个复平面解析，是 entire function。

当：

$$
|z|\to\infty
$$

非常数多项式 $P(z)$ 的模长趋于无穷，所以：

$$
f(z)\to 0
$$

同时 $f$ 在有限区域内连续，因此有界。

于是 $f$ 是有界 entire function，由 Liouville Theorem，$f$ 必须是常数。

这意味着 $P$ 也是常数，矛盾。

所以 $P$ 必有根。

### Maximum Modulus Principle

Maximum Modulus Principle：

非常数解析函数在区域内部不能取得最大模长。

最大值只能在边界上取到。

这和实函数完全不同。实函数可以在内部有局部最大值，比如 $1-x^2$。

解析函数的内部值被边界约束得太强。除非函数是常数，否则它不能在内部单独鼓起来。

这也是“边界决定内部”的另一种表达。

### Part III 的核心线

这一部分的逻辑链是：

```text
解析性
  → Cauchy's Theorem
  → 路径变形和闭合积分为 0
  → Cauchy Integral Formula
  → 边界决定内部
  → 自动无穷可导
  → Cauchy Estimates
  → Liouville / FTA / Maximum Modulus
```

复分析真正开始变强，就是从 Cauchy theory 开始。后面 Laurent series、singularity、residue theorem 都是在这个基础上继续展开。
