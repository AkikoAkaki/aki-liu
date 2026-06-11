---
title: "复分析 2：解析函数、C-R 方程与调和函数"
date: 2026-05-05
tags: ["complex-analysis", "mathematics"]
math: true
draft: false
---

<aside>

**TL;DR**

Part II 学的是复分析最关键的刚性来源：复可导远强于实可导。

- 复导数要求从平面上所有方向逼近同一个极限
- 函数在一点解析，意味着它在该点附近一个邻域里可导
- Cauchy-Riemann equations 是判断复可导和解析性的核心工具
- $f(z)=u(x,y)+iv(x,y)$ 解析时，$u$ 和 $v$ 不是独立的，它们被 C-R 方程锁在一起
- 出现 $\bar z$、$|z|$、$\operatorname{Re}z$、$\operatorname{Im}z$ 通常是非解析信号
- 解析函数的实部和虚部都是 harmonic functions
- 给定 harmonic function $u$，可以用 C-R 方程寻找 harmonic conjugate $v$
- 解析性在几何上对应局部保角，前提是导数不为 0

</aside>

### 复导数为什么更强

实函数的导数只需要从一条线的左右逼近。

复函数的导数定义看起来类似：

$$
f'(z_0)=\lim_{\Delta z\to 0}\frac{f(z_0+\Delta z)-f(z_0)}{\Delta z}
$$

但 $\Delta z$ 是复数。它可以从平面上的任意方向趋近 0。

所以这个极限必须对所有逼近路径都一致。

这就是复可导比实可导强很多的原因。

一个函数如果只在某个方向上表现好，不够。它要在二维平面所有方向上都给出同一个线性近似。

### Analyticity

函数在某点解析，意思是它在该点的某个邻域内可导。

注意这里不是只在一个点可导。

解析性是局部性质，需要一整个小圆盘。

如果函数在整个复平面解析，叫 entire function。

常见 entire functions：

- polynomial
- $e^z$
- $\sin z$
- $\cos z$

解析函数在复分析里是“完美”的函数。它不只是有一阶导数，后面会看到，它会自动有无穷多阶导数，而且可以被 power series 展开。

这就是复分析的刚性。

### Cauchy-Riemann Equations

设：

$$
f(z)=u(x,y)+iv(x,y)
$$

其中 $z=x+iy$。

如果 $f$ 解析，并且偏导条件足够好，那么 $u$ 和 $v$ 满足 Cauchy-Riemann equations：

$$
u_x=v_y
$$

$$
u_y=-v_x
$$

这两条方程说明：实部和虚部不能随便选。

一个复函数看似由两个实函数 $u$ 和 $v$ 组成，但解析性会强行把它们绑在一起。

这和一般的二维向量场完全不同。大多数 $u+iv$ 都不是解析函数。

### 从方向极限看 C-R

复导数要求所有方向一致。

沿实轴方向逼近：

$$
\Delta z = \Delta x
$$

得到：

$$
f'(z)=u_x+iv_x
$$

沿虚轴方向逼近：

$$
\Delta z = i\Delta y
$$

得到：

$$
f'(z)=v_y-iu_y
$$

两者必须相等：

$$
u_x+iv_x = v_y-iu_y
$$

比较实部和虚部：

$$
u_x=v_y,\quad v_x=-u_y
$$

也就是 C-R equations。

这说明 C-R 方程不是凭空出现的。它来自“从不同方向求导必须得到同一个结果”。

### 一眼定生死

有一些表达式通常是非解析信号：

- $\bar z$
- $|z|$
- $\operatorname{Re}z$
- $\operatorname{Im}z$

原因是它们依赖 $z$ 和 $\bar z$ 的混合信息，破坏了复线性结构。

比如：

$$
f(z)=\bar z=x-iy
$$

这里：

$$
u=x,\quad v=-y
$$

所以：

$$
u_x=1,\quad v_y=-1
$$

C-R 方程不成立。它不解析。

相反，如果函数只由 $z$ 通过 polynomial、exponential、trigonometric 这些解析操作组成，通常是解析的，只要避开分母为零和 branch cut。

### 点可导和解析不是一回事

有些函数可能在某个孤立点可导，但不解析。

比如：

$$
f(z)=|z|^2
$$

写成：

$$
f(z)=x^2+y^2
$$

在 $z=0$ 处，导数定义给出：

$$
\frac{|h|^2}{h}
$$

其模长是 $|h|$，趋向 0，所以在 0 可导。

但它不在 0 的任何邻域内都可导，因此不在 0 解析。

这点很重要：complex differentiable at a point 和 analytic at a point 不是同一件事。

### Harmonic Functions

如果：

$$
f(z)=u(x,y)+iv(x,y)
$$

解析，那么 $u$ 和 $v$ 都满足 Laplace equation：

$$
u_{xx}+u_{yy}=0
$$

$$
v_{xx}+v_{yy}=0
$$

满足 Laplace equation 的函数叫 harmonic function。

证明来自 C-R 方程。

由：

$$
u_x=v_y,\quad u_y=-v_x
$$

对第一式再对 $x$ 求导，对第二式再对 $y$ 求导：

$$
u_{xx}=v_{yx}
$$

$$
u_{yy}=-v_{xy}
$$

如果混合偏导相等，就得到：

$$
u_{xx}+u_{yy}=0
$$

所以解析函数的实部和虚部天然是 harmonic。

### Harmonic Conjugate

反过来，如果给定一个 harmonic function $u$，很多时候可以找一个 $v$，使得：

$$
f=u+iv
$$

解析。

这个 $v$ 叫 harmonic conjugate。

方法直接来自 C-R 方程：

$$
v_y=u_x
$$

$$
v_x=-u_y
$$

步骤：

1. 算 $u_x,u_y$
2. 从 $v_y=u_x$ 对 $y$ 积分，得到 $v$
3. 用 $v_x=-u_y$ 修正积分时出现的 $g(x)$

比如：

$$
u(x,y)=x^3-3xy^2
$$

有：

$$
u_x=3x^2-3y^2,\quad u_y=-6xy
$$

由：

$$
v_y=u_x=3x^2-3y^2
$$

对 $y$ 积分：

$$
v=3x^2y-y^3+g(x)
$$

再用：

$$
v_x=-u_y=6xy
$$

得到：

$$
6xy+g'(x)=6xy
$$

所以：

$$
g'(x)=0
$$

最终：

$$
v=3x^2y-y^3+C
$$

### 解析函数的几何意义

解析函数在导数不为 0 的点附近，会局部保持角度。

这叫 conformality。

直觉是：

$$
f(z_0+h)\approx f(z_0)+f'(z_0)h
$$

而乘以一个非零复数 $f'(z_0)$，几何上就是缩放 + 旋转。

缩放和旋转会保持角度。

所以 analytic function 在微观上看起来像一个局部的旋转缩放变换。

这也是为什么解析性和几何联系很强。它不只是“函数有导数”，还意味着函数在局部以一种非常有结构的方式变形平面。

### 解析函数的刚性

实函数可以很灵活。可以局部改一点，拼接一段，构造各种奇怪函数。

解析函数非常刚性。

这种刚性会在后面不断出现：

- C-R 方程把实部和虚部锁在一起
- Cauchy Integral Formula 让边界决定内部
- 解析函数自动无穷可导
- 有界 entire function 必须是常数
- power series 的收敛半径由最近奇点决定

Part II 的重点是：复可导不是普通二维可导。它是一个很强的结构条件，强到足以决定函数后面几乎所有性质。
