---
title: "Resume"
date: 2026-05-15
lastmod: 2026-10-25
weight: 2
draft: false
---

Fengkai (Aki) Liu · [aki.f.liu2004@gmail.com](mailto:aki.f.liu2004@gmail.com) · [GitHub](https://github.com/AkikoAkaki) · [LinkedIn](https://www.linkedin.com/in/aki-liu-10ba4b363/)

## Education

**University of Rochester** · Rochester, NY

- B.S. in Computer Science and B.S. in Applied Mathematics, expected December 2026
- Dean's List: Fall 2023 – Spring 2025, Spring 2026
- Full course list: [Courses](/en/about/courses/)

## Research

**ML Systems Research**, University of Rochester (Prof. Sreepathi Pai) · May 2026 – Present

- Study whether a GPU kernel autotuner can fix low-impact tuning parameters to cut tuning cost while keeping the quality of the final kernel.

**Research Assistant, HCI & Spatial Computing Security**, BEAR Lab, University of Rochester · Sep 2025 – Dec 2025

- Analyzed sensor-driven attack vectors in AR/VR, including side-channel leaks and redirected-walking manipulation.
- Prototyped interaction dynamics in MuJoCo to explore security issues such as sensor drift in virtual environments.

## Experience

**Artisk Inc.** · Software Engineer Intern · San Francisco, CA (Remote) · May 2025 – Feb 2026

- Implemented backend features for a deployed internal log management tool with FastAPI, SQLite, and Amazon S3: date-based log rotation, compressed archives, and log search and download.
- Replaced backend-proxied downloads with S3 pre-signed URLs, and fetched archived logs on demand for search with automatic cleanup of temporary files.
- Built a multi-step onboarding questionnaire that stores answers in MongoDB, and AI name suggestions for new collections using debounced OpenAI requests with a local fallback.
- Built admin pages for user feedback and subscription plans across an Express API, its tests, and React views.

**Dentist Journey** · QA & Test Engineer Intern · San Diego, CA (Remote) · Sep 2025 – Dec 2025

- Tested authentication, AI-generation, subscription, and file-upload APIs; documented inconsistent responses, unenforced usage limits, upload-validation failures, and N+1 queries in bug reports for the founder and engineering team.

## Projects

**LLM Quantization Tax Profiler** · Mar 2026 – Present · [Write-up](/en/notes/quantization-tax/)

- Built a reproducible single-GPU LLM profiler that separates no-hook end-to-end benchmarking from CUDA Event layer diagnosis for FP16 and bitsandbytes FP4 inference on an RTX 4060 Laptop GPU.
- Measured a controlled FP4 latency–VRAM trade-off: 47.7% higher batch-1 decode latency with 56.5% lower peak allocated VRAM, then used layer diagnosis and Roofline reasoning to narrow the profiling question.
- Implemented a Triton fused FP4 k/v GEMV prototype, validated its correctness across 56 projections, and reported its neutral end-to-end result instead of claiming a speedup.

**MoodStream** · Jan 2026 – Jun 2026 · [GitHub](https://github.com/AkikoAkaki/moodstream)

- Real-time danmaku (live comment) sentiment aggregation platform built with Go, Redis, gRPC, and server-sent events. Archived.

## Skills

- **Programming:** Python, Go, Java, TypeScript, C, SQL, Kotlin
- **Frameworks and tools:** PyTorch, vLLM, Triton, Redis, React, Node.js, FastAPI, Docker, Git, MongoDB, AWS S3, Hugging Face
- **Languages:** English (full professional), Chinese (native), Japanese (conversational)

## Writing

- Essays, fragments, and criticism in [Text Lab](/en/textlab/)
