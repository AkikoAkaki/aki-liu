---
title: "Machine Learning Systems (MLSys) Notes"
date: 2026-05-18
tags: ["mlsys"]
is_series_root: true
draft: false
---

This set of notes is compiled from technical learning and development practices in Machine Learning Systems (MLSys), aiming to dissect hardware characteristics, computation graph compilation, and cutting-edge technologies in ultra-large-scale distributed training and inference.

The entire topic focuses on the intersection of software and hardware: not only studying machine learning algorithms, but also studying how to build efficient low-level software systems to support their execution.

## Contents

* ### [Part 1: Hardware, Memory, Parallelism & Data Layout](../mlsys-notes-part-i/)
  Introduces the low-level hardware bottlenecks faced by large model computing. Explores GPU architecture characteristics, High Bandwidth Memory (HBM) vs compute ratios, memory hierarchy costs, and the impact of data layout on Tensor Core efficiency.

* ### [Part 2: Computation Graphs, Training Systems & Distributed Scaling](../mlsys-notes-part-ii/)
  Analyzes the core design of deep learning frameworks. Explores the construction and execution models of computation graphs, and how to scale to hundreds or thousands of GPUs using parallelization strategies (Data Parallelism DP, Tensor Parallelism TP, Pipeline Parallelism PP, ZeRO memory optimizations) for ultra-large-scale training.

* ### [Part 3: Compiler Stacks, Inference Engines, Quantization & Frontier Systems](../mlsys-notes-part-iii/)
  Studies model deployment and optimization. Analyzes the core principles and system design trade-offs of deep learning compilers (e.g. TVM, Triton), high-performance inference engines (e.g. vLLM), and model quantization (e.g. 4-bit quantization, mixed precision).

---

## Reading Suggestions

It is recommended to start with the hardware bottlenecks and single-card optimizations in Part 1 to understand the memory wall and compute wall, then read about distributed training in Part 2 to widen the perspective to system clusters, and finally explore inference and compiler techniques in Part 3 to learn how models are deployed and optimized.
