---
title: "计算理论 专题笔记"
date: 2026-05-05
tags: ["theory-of-computation", "computer-science"]
is_series_root: true
draft: false
---

这组 notes 整理自计算理论（Theory of Computation）课程的核心内容，探讨计算的根本极限：什么问题可以被计算机解决，什么问题不能，以及解决它们需要消耗多少资源。

本专题跨越了从形式语言、自动机，到图灵机、可判定性，再到计算复杂性（P vs NP 等）的完整理论模型，试图看清“计算”这一概念本身的数学边界。

## 目录

* ### [Part 1：自动机、CFG 与语言层级](../toc-notes-part-i/)
  探讨最简单的计算模型——有限自动机（DFA/NFA）与正则表达式，逐步深入到下推自动机（PDA）与上下文无关文法（CFG），厘清乔姆斯基语言层级（Chomsky Hierarchy）。

* ### [Part 2：图灵机、可判定与不可判定](../toc-notes-part-ii/)
  介绍通用计算模型——图灵机（Turing Machine）的结构与变体。探讨丘奇-图灵论题，深入剖析可判定性与不可判定性（Decidability），特别是著名的停机问题（Halting Problem）及其对角线证明法。

* ### [Part 3：P、NP 与复杂度层级](../toc-notes-part-iii/)
  将目光投向计算资源的限制。介绍时间与空间复杂度类（P、NP、PSPACE），深入探讨 NP 完备性（NP-Completeness）、库克-列文定理，以及如何通过多项式时间规约证明问题的计算难度。

---

## 学习建议

计算理论是计算机科学的数学基石。建议遵循“自动机（有穷资源） → 图灵机（无穷资源但可能有穷步骤） → 复杂度类（限制时间/空间资源）”的逻辑主线，这能帮助你从最根本的数学层面理解什么是“可计算的”。
