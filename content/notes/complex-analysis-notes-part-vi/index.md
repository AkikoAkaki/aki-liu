---
title: "复分析 6：实积分、Contour Choice 与 Branch Cuts"
date: 2026-05-01
tags: ["complex-analysis", "mathematics"]
math: true
draft: false
---

<aside>

**TL;DR**

Part VI 学的是 residue theorem 的应用：把实积分变成复平面里的闭合路径积分。

- 积分范围决定 contour 类型
- $-\infty$ 到 $+\infty$ 常用上半圆或下半圆
- $0$ 到 $2\pi$ 的三角积分常用单位圆 $z=e^{i\theta}$
- 含 $e^{imx}$ 的积分根据 $m$ 的符号选上半圆或下半圆
- 大圆弧积分要用 ML estimate / Jordan's Lemma 证明消失
- 实轴上有奇点时，要用 indented contour 绕开
- 多值函数如 $\log z$、$z^\alpha$ 需要 branch cut
- contour choice 的核心是让未知实积分成为闭合积分的一部分，并让多余路径消失

</aside>

### 为什么实积分能用复分析算

Residue theorem 计算的是闭合路径上的复积分。

实积分看起来只在实轴上。

关键技巧是：把实轴上的积分嵌入一个闭合 contour 中。

如果闭合 contour 由几段组成：

```text
实轴部分 + 大圆弧部分 + 小凹槽部分 + branch cut 两侧
```

那么 residue theorem 给出整体积分。

只要能证明其他部分消失或可以表达，实轴积分就被解出来。

所以实积分题的核心在于 contour 怎么选；留数计算是 contour 确定后的局部步骤。

### 先看积分范围

积分范围通常直接提示 contour。

| 积分形式 | 常见 contour |
|---|---|
| $\int_{-\infty}^{\infty}R(x)\,dx$ | 上半圆或下半圆 |
| $\int_{-\infty}^{\infty}R(x)e^{imx}\,dx$ | $m>0$ 上半圆，$m<0$ 下半圆 |
| $\int_0^{2\pi}R(\cos\theta,\sin\theta)\,d\theta$ | 单位圆 $z=e^{i\theta}$ |
| 含实轴奇点的积分 | indented contour |
| 含 $\log x$、$x^\alpha$ | branch cut contour |

你源笔记里的判断很实用：

看积分范围。

$-\infty$ 到 $+\infty$ 通常是半圆围道。

$0$ 到 $2\pi$ 通常是单位圆。

含三角函数和 $e^{imx}$ 时，把三角函数放进复指数里。

### 有理函数实积分

典型形式：

$$
\int_{-\infty}^{\infty} R(x)\,dx
$$

其中 $R(x)$ 是有理函数，并且在无穷远处衰减得足够快。

做法：

1. 把 $x$ 换成复变量 $z$
2. 选择上半圆 contour：

$$
C_R=[-R,R]\cup C_R^+
$$

3. 找上半平面里的极点
4. 用 residue theorem
5. 证明大圆弧积分趋于 0
6. 令 $R\to\infty$

如果：

$$
\int_{C_R^+}R(z)\,dz \to 0
$$

那么：

$$
\begin{aligned}
\int_{-\infty}^{\infty}R(x)\,dx
&=2\pi i\sum_{\operatorname{Im}z_k>0}\operatorname{Res}(R,z_k)
\end{aligned}
$$

### 例子：1/(x^4+1) 的实积分

考虑：

$$
\int_{-\infty}^{\infty}\frac{1}{x^4+1}\,dx
$$

复化：

$$
f(z)=\frac{1}{z^4+1}
$$

极点来自：

$$
z^4=-1=e^{i(\pi+2\pi k)}
$$

所以：

$$
z_k=e^{i(\pi+2\pi k)/4}
$$

上半平面的两个极点是：

$$
e^{i\pi/4},\quad e^{i3\pi/4}
$$

由于都是简单极点：

$$
\operatorname{Res}(f,z_k)=\frac{1}{4z_k^3}
$$

然后上半圆积分给出：

$$
\begin{aligned}
\int_{-\infty}^{\infty}\frac{1}{x^4+1}\,dx
&=2\pi i
\sum_{\operatorname{Im}z_k>0}
\operatorname{Res}(f,z_k)
\end{aligned}
$$

这里的计算步骤不复杂。真正的结构是：实轴积分 + 大圆弧积分 = 上半平面留数贡献，而大圆弧积分消失。

### Jordan's Lemma 和半圆选择

如果积分含：

$$
e^{imx}
$$

通常考虑：

$$
e^{imz}
$$

设：

$$
z=x+iy
$$

那么：

$$
e^{imz}=e^{imx-my}
$$

当 $m>0$，在上半平面 $y>0$，有：

$$
e^{-my}
$$

衰减。

所以 $m>0$ 选上半圆。

当 $m<0$，要选下半圆。

这就是 contour choice 的一个典型原则：选让指数项衰减的方向。

### Cos 和 Sin 积分

如果实积分里有：

$$
\cos(mx)
$$

可以看成：

$$
\operatorname{Re}(e^{imx})
$$

如果有：

$$
\sin(mx)
$$

可以看成：

$$
\operatorname{Im}(e^{imx})
$$

先计算：

$$
\int_{-\infty}^{\infty} f(x)e^{imx}\,dx
$$

最后取实部或虚部。

这比直接处理三角函数更自然，因为复指数和半圆 contour 的衰减方向匹配。

### 单位圆代换

如果积分是：

$$
\int_0^{2\pi}R(\cos\theta,\sin\theta)\,d\theta
$$

通常令：

$$
z=e^{i\theta}
$$

于是：

$$
|z|=1
$$

并且：

$$
d\theta=\frac{dz}{iz}
$$

$$
\cos\theta=\frac{z+z^{-1}}{2}
$$

$$
\sin\theta=\frac{z-z^{-1}}{2i}
$$

原来的实积分就变成单位圆上的闭合 contour integral。

然后：

1. 化成有理函数
2. 找单位圆内部的极点
3. 算留数
4. 乘 $2\pi i$

这类题的 contour 已经固定：单位圆。

### 实轴上有奇点

如果实轴上有极点，普通上半圆 contour 会穿过奇点。

这时要用 indented contour。

也就是在实轴奇点附近挖一个小半圆绕开。

这个小凹槽通常贡献：

$$
\pm i\pi \operatorname{Res}(f,z_0)
$$

符号取决于绕行方向。

于是 principal value 公式常出现：

$$
\begin{aligned}
\operatorname{p.v.}\int_{-\infty}^{\infty}f(x)\,dx
&=2\pi i\sum_{\text{上半平面}}\operatorname{Res}
+i\pi\sum_{\text{实轴}}\operatorname{Res}
\end{aligned}
$$

具体符号要和 contour 方向保持一致。

这里的直觉是：实轴上的奇点只被路径绕了半圈，所以贡献半个 $2\pi i$。

### Branch cuts

多值函数需要 branch cut。

典型例子：

- $\log z$
- $z^\alpha$
- $\sqrt z$

如果 integrand 里有这些函数，就必须先选择 branch。

branch cut 的作用是让函数在剩下的区域里单值解析。

常见 contour：

- keyhole contour around positive real axis
- keyhole contour around negative real axis
- branch cut between two branch points

这类积分的结构通常是：branch cut 两侧的函数值相差一个相位因子。上下两侧积分相减后，留下目标实积分。

### Contour choice 的原则

选择 contour 时，问几个问题：

1. 目标实积分在哪一段路径上出现？
2. 哪些额外路径需要证明趋于 0？
3. integrand 的极点在哪？
4. 哪些极点应该被 contour 包住？
5. 是否有 branch point，需要 cut 哪条线？
6. 是否有实轴奇点，需要凹槽绕开？
7. 指数项在哪个半平面衰减？

不要先算留数。

先确定 contour。

留数只是 contour 确定后的局部计算。

### 实积分方法的统一结构

大多数 residue applications 都可以写成：

```text
目标实积分
  → 选择复函数 f(z)
  → 选择 contour C
  → 用 residue theorem 计算闭合积分
  → 证明额外路径消失或可控
  → 解出目标实积分
```

这一步把一维实积分放进二维复平面里。

复平面提供了新的路径选择自由。你可以绕过奇点，可以选上半圆，可以选单位圆，可以沿 branch cut 两侧走。

这个自由度正是复分析强大的地方。

### Part VI 的核心线

Residue theorem 本身只告诉你闭合积分等于内部留数。

实积分应用还多一步：设计一个闭合 contour，让目标实积分成为其中的一段。

所以 Part VI 的重点是 contour choice：

- 有理函数实积分：半圆
- 三角积分：单位圆
- Fourier 型积分：按指数衰减方向选半平面
- 实轴奇点：indented contour
- 多值函数：branch cut

一旦 contour 选对，计算通常就变成找极点和算留数。
