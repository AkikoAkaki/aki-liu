---
date: 2026-05-16T10:00:01+08:00
slug: 100001
tags: ["Technical", "Hugo"]
draft: false
---

最近在研究 Hugo 的 `resources.Concat` 功能，发现它在处理 CSS 管道时非常高效。

通过将多个基础样式表合并：
```javascript
const base = resources.Get("css/base.css");
const layout = resources.Get("css/layout.css");
const bundle = resources.Concat("css/main.css", [base, layout]);
```

这样可以显著减少 HTTP 请求数，提升页面加载速度。
