# AGENTS.md

## 记忆

本项目使用 OptMem：
- 工具：`I:\Projects\aki-liu\.optmem\memo`
- 记忆目录：`I:\Projects\aki-liu\.optmem\memory`

OptMem 跨会话、上下文压缩、模型和供应商保留记忆。没有它，你无法知道之前的决定和尝试。

### 启动时激活 OptMem（必须）

每次会话在其他工具调用前运行 `I:\Projects\aki-liu\.optmem\memo wake`，然后按输出执行到底。

### 工作时记录记忆（必须）

遇到值得保留的新信息时，调用 `I:\Projects\aki-liu\.optmem\memo note "<一行，最多 280 字节>"`。包括花费实质精力的任务、用户告诉你的事实、你了解到的生活情况和有持续影响的事件。不要重复记录。

如果 `memo note` 要求压缩，在下一步操作前完成。不要直接编辑或删除 `I:\Projects\aki-liu\.optmem\memory` 下的任何内容，由工具管理。

### 查找旧记忆

`I:\Projects\aki-liu\.optmem\memo recall <regex>` 搜索所有记忆。

记忆也组成一棵二叉树：`#0-1`、`#2-3` 等是一行摘要，其组合也是摘要。`wake` 输出的每个 `#a-b` 都是一个节点。用 `I:\Projects\aki-liu\.optmem\memo zoom <a-b>` 展开两个子节点，直到原始记忆。

### 子 agent

子 agent 跳过上述记忆操作。不同会话可以共同写入记忆，但子 agent 不应调用 `memo`，因为它无法判断内容是否重复。创建子 agent 时写明：`You are a subagent. Don't run memo.`

## 构建和运行

`WORKFLOW.md` 是写作指南，包含预览、构建、新建文章和翻译、Microblog、媒体、草稿、推送前检查及指标命令。Hugo 自己打包 CSS 和 JS；站点构建不需要 `npm`、Node.js 或包管理器。只有 `scripts/edge-check.mjs` 需要 Node。

## 项目结构

- **双语**：中文默认（`zh`），内容目录使用 slug，中文正文为 `index.md`，英文翻译放在同目录的 `index.en.md`。
- **内容栏目**（`content/`）：`notes/`、`textlab/` 和 `weeknotes/` 使用 `list.html` 的三栏归档布局（左侧栏、正文、右侧悬停预览）。`microblog/` 和 `about/` 有独立布局；`influences/` 是单页。`hugo.toml` 的 `mainSections`（notes、textlab、weeknotes）通过 `site.MainSections` 提供归档、标签页和标签搜索的数据；它必须位于第一个 `[table]` 之前，否则 TOML 会把它归入该表。
- **首页**：数据来自 `data/homepage.yaml`，模板为 `layouts/index.html`。
- **导航**：`data/nav.yaml` 按顺序列出菜单项。`baseof.html` 根据它渲染菜单，并以 `data-nav` JSON 传给搜索面板；标记为 `hidden: true` 的条目也会出现在搜索面板中。
- **CSS**：全局 bundle 按 `base.css` → `layout.css` → `components.css` → `motion.css` → `search.css` 拼接。首页加载 `home.css`，单页加载 `post.css` + `syntax-highlight.css`，About、Microblog 和 Dashboard 的 CSS 按路由加载。均由 Hugo Pipes 处理（适用时使用 `resources.Concat` 和 `resources.Minify`）。
- **JS**：`assets/js/main.js` 是通过 Hugo `js.Build` 构建的全局入口。`home.js`、`about.js`、`dashboard.js`、`microblog.js` 在各自路由加载；有目录的单页加载 `post-toc.js`。文章和归档预览均通过 `assets/js/modules/katex.js` 渲染 KaTeX。媒体查询位于 `assets/js/modules/media.js`，搜索评分和摘要位于 `assets/js/modules/search-core.js`。不使用外部打包器。

## 约定

- **图片**：非 SVG/GIF 图片通过自定义渲染钩子 `layouts/_default/_markup/render-image.html` 自动转换为 WebP。需要说明的 bundle 图片使用 `figure` shortcode。
- **视频**：使用 `localvideo` shortcode 和 bundle 内素材。
- **KaTeX**：全局启用；frontmatter 设置 `enableKaTeX`/`math` 或内容包含数学分隔符的页面会加载（`layouts/partials/page-has-math.html`、`layouts/partials/head/katex.html`）。文件位于带版本号的 `static/lib/katex-<version>/`，因为 `/lib/` 使用不可变缓存；升级时同时修改 `layouts/partials/katex-base.html` 和 `scripts/download-katex.ps1`。
- **标签**：在 frontmatter 中写 `tags: ["tag-name"]`，由 `layouts/tags/term.html` 渲染 `/tags/<name>/`。URL、`data-tag` 和筛选使用 slug。`data/tags.yaml` 将 slug 映射到圆点颜色及需要特殊大小写的标签名（如 `mlsys` → `MLSys`）；模板通过 `style="--tag-color: …"` 输出颜色。新标签在此添加一行；缺少配置时使用灰点和标题式大小写。
- **归档预览**：每篇文章有带指纹的预览 JSON（`layouts/partials/archive-preview-entry.html`，前 800 个字符）。`assets/js/modules/archive-preview.js` 加载悬停或聚焦的文章，仅为含公式的预览加载 KaTeX。
- **Microblog 分页**：`microblog-feed-index.html` 嵌入列数和带指纹的每 30 条分块 URL。浏览器只请求下一块；公开的 `feed.json` 仍包含全部内容。
- **字体**：Switzer、PP Editorial Old、JetBrains Mono、Newsreader 和 Noto Serif SC 自托管于 `static/fonts/`；只有归档页的另一款 Newsreader 从 Google Fonts 加载。
- **Goldmark**：`unsafe = true`（允许 Markdown 中的 HTML），`hardWraps = true`；`$`、`\(`、`$$`、`\[` 公式交给 KaTeX。
- **Microblog 目录**：必须为 `YYYY/MM/DD-HHMMSS`；slug 和公开 URL 由目录生成。

## 检查

`scripts/check.ps1` 用于推送前检查，`scripts/metrics-report.ps1` 更新 `data/metrics/` 中的 Dashboard 数据；命令见 `WORKFLOW.md`。

修改固定定位元素、页脚、`.site-wrapper` 或 `html`/`body` 的 `overflow` 后，运行 `node scripts/edge-check.mjs`（需要 Node 22+ 和 Chrome 或 Edge，读取 `public_test/`）。iOS Safari 26 从屏幕边缘真实的 fixed 元素取状态栏和工具栏颜色，并在 `<footer>` 隐藏后保留其颜色。脚本模拟 WebKit 规则，检查状态栏下方内容、工具栏染色、页面未在页脚结束和嵌套滚动容器。页脚保持在正常文档流中，顶部渐隐保持为带实色 `background-color` 的真实元素。

## 部署

正式域名：`https://akiliu.vercel.app`。Vercel 配置位于 `vercel.json`；构建命令从环境变量设置 `--baseURL`。Hugo 版本固定为 `0.152.2`。

## 主要文件

| 用途 | 路径 |
|---|---|
| Hugo 配置 | `hugo.toml` |
| 首页数据 | `data/homepage.yaml` |
| 导航 | `data/nav.yaml` |
| 标签颜色和名称 | `data/tags.yaml`、`layouts/partials/tag-label.html`、`layouts/partials/tag-color.html` |
| 基础布局 | `layouts/_default/baseof.html` |
| CSS bundle 入口 | `layouts/partials/head/core-assets.html`、`assets/css/base.css`、`layout.css`、`components.css`、`motion.css`、`search.css` |
| 路由 CSS | `assets/css/home.css`、`post.css` + `syntax-highlight.css`、`about.css`、`microblog.css`、`dashboard.css` |
| JS 入口 | `assets/js/main.js`、`home.js`、`about.js`、`dashboard.js`、`microblog.js`、`post-toc.js` |
| 归档悬停预览 | `layouts/partials/archive-preview-entry.html`、`assets/js/modules/archive-preview.js` |
| 本地 Claude 配置（已忽略） | `.claude/settings.local.json` |

历史工程记录和设计草案归档在 Obsidian 项目目录 `E:\obsidian-vault\00 系统\项目\aki-liu`，不参与构建。
