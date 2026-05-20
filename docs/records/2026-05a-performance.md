# 阶段二：性能优化与代码质量 (2026-05-01 → 05-05)

## TL;DR

- **JS 架构解耦**：245 行内联 JS 从模板中抽出，汇入 `main.js`，通过 Hugo `js.Build`（内置 Go ESBuild）编译为带 hash 的 bundle，支持 ES module 和 `immutable` 强缓存
- **图片管线**：Markdown 中的图片在构建时自动转 WebP + 生成响应式 `srcset`，通过 `render-image.html` hook 实现，作者无需手动转换
- **字体与缓存**：预加载策略 + `font-display: swap`，CSS 选择器修剪，静态资源配置长期缓存头
- **签名图**：PNG 360KB → WebP 9KB
- **安全头**：`vercel.json` 新增 `X-Content-Type-Options`、`X-Frame-Options`、`Referrer-Policy`、`Permissions-Policy`
- **Bug 修复**：5 个移动端回归（预览面板不可见、统计块错位、标签圆点消失、grid 列溢出、多余下划线动画）
- **工程规范**：创建 `AGENTS.md`，记录 Hugo 命令、CSS 管线、项目结构等核心约定

---

本阶段执行了一次集中的性能与代码质量提升，为后续大规模 UI 重构清理障碍。

---

## 1. 代码质量清理

- 全局排查并消除 CSS/JS/Hugo 模板中的重复定义
- 合并多个独立脚本为统一入口 `assets/js/main.js`
- 提取复用 Partial：`forward-arrow.html`、`hover-arrow.html`、`is-truthy.html`
- 精简 `baseof.html`，减少模板嵌套层级
- 删除 `content/_index.en.md` 等空档描述文件、清理 `layouts/404.html` 和 `localvideo` shortcode 中的残留样式

---

## 2. 性能优化链

此阶段连续 5 个 commit 围绕性能展开：

### 2.1 全面性能优化

- 字体精简：移除未使用的字体文件和声明
- 动画优化：减少重排触发
- 选择器优化：降级复杂 CSS 选择器
- 缓存策略：为静态资源添加长期缓存头

### 2.2 图片/字体/惰性加载

- 图片尺寸预定义防止 CLS
- 字体异步加载（`font-display: swap` 策略验证）
- WOFF2 格式预设检查
- 创建 `deferred_optimizations.md` 记录待办优化项

### 2.3 隐式性能优化

- JIT 动画策略（仅在元素可见时运行动画）
- 字体预加载 `<link rel="preload">`
- 缓存策略修正（`vercel.json` 头部微调）

### 2.4 JS 架构解耦

关键改动：将分散在 `baseof.html` 中的 245 行内联 JS 迁移至独立的 `assets/js/main.js`（239 行），实现：

- JS 与模板完全解耦——模板只负责挂载 DOM，JS 通过 `DOMContentLoaded` 事件统一初始化
- 通过 Hugo `js.Build`（内置 Go 版 ESBuild）处理 JS 入口文件，支持 ES module 语法（`import` / `export`），输出带 content-hash 的 bundle（如 `main.min.d1275046.js`），天然支持 `immutable` 强缓存
- `baseof.html` 从 245 行内联 JS 缩减为引用一个 `<script type="module">` 标签

同时将签名图从 PNG（360KB）压缩为 WebP（9KB），移除对 `signature.png` 的引用。

### 2.5 图片自动优化管线

建立一套构建时自动图片处理链路，作者只需在 Markdown 中写标准 `![alt](image.png)` 语法，无需手动转换格式：

- 创建 `layouts/_default/_markup/render-image.html`：Hugo 的 Markdown 渲染钩子，拦截所有 `![...](...)` 语法
  - 对非 SVG/GIF 的图片，自动调用 Hugo 的 `.Resize` / `.Content` 方法转换为 WebP
  - 在 `<img>` 标签中输出 `srcset` 属性（原始 + 1.5x + 2x），浏览器根据屏幕密度自动选择最优尺寸
  - 保留原始 `src` 作为回退（fallback）
- 重构 `layouts/shortcodes/figure.html`：为 page-bundle 内的图片提供带 `<figcaption>` 的 `<figure>` 封装，支持标题和自定义 class

字体切换动画从 CSS `transition-delay`（导致"瞬间全变" bug，因为所有 delay 值在渲染时同时到期）修复为逐字 `setTimeout` 队列，每个字依次独立触发 transition。

---

## 3. Bug 修复（5/04 — 5/05）

这一批集中在移动端视觉回归：移除 Experiences 区块多余的下划线 wipe 动画、修正 grid 列溢出和 data-link hover 状态、修复移动端预览面板不可见、统计块 fixed 定位错位、标签彩色圆点 CSS 变量作用域丢失。5 项修复集中在 `home.css` 和 `layout.css`。

### 本阶段核心产出文件

| 文件 | 改动量 | 说明 |
|---|---|---|
| `assets/js/main.js` | 新建，239+ 行 | 从模板中抽离的集中 JS 入口 |
| `layouts/_default/baseof.html` | -245 行内联 JS | 模板减负 |
| `layouts/_default/_markup/render-image.html` | 新建 | WebP 自动转换钩子 |
| `layouts/shortcodes/figure.html` | 重写 | figure 短代码 |
| `static/images/signature.webp` | 新建，9KB | 替代 360KB PNG |
| `vercel.json` | 更新 | 缓存头 + 安全头 |
| `AGENTS.md` | 新建 | 项目开发指南 |

---

*记录时间：2026-05-20*
