# 阶段四：架构重构与仪表盘 (2026-05-18 → 05-20)

## TL;DR

- **字体压缩**：25 个字重 OTF → WOFF2（Brotli），体积 -48%
- **死代码清理**：一轮审计清掉 235 行冗余代码和重复逻辑
- **WebGL 模块化**：首页行内 WebGL 抽出为 `FluidEngine` 类，支持视口外自动暂停、深色模式适配、无障碍降级、预乘透明度修正
- **链接预加载**：`prefetch.js` 引擎，桌面端 65ms hover 防抖、移动端利用触摸间隙预请求、低带宽自动挂起
- **KaTeX 本地化**：完全离线自托管，零 CDN 依赖，20 个 WOFF2 字体随 Git 提交
- **栏目更名**：`technical` → `notes`（`git mv` 保留历史），全局联动更新
- **Aki's Studio**：从 Phase 3 简单管理工具升级为多板块写作控制台（CRUD API + 双语编辑器 + 稿件管理 + 8 项集成测试）
- **Observability 仪表盘**：`metrics-report.ps1` 采集 → JSON → Hugo `getJSON` 渲染 → Bento Grid 卡片布局，趋势图四维平滑插值动画，构建时间 670-770ms

---

本报告整合了 2026 年 5 月 18 日至 20 日的所有主要改动，按功能模块组织，便于日后查阅和复用。

---

## 零、前期基础设施与代码净化 (5/18 深夜 — 5/19 凌晨)

在大规模重构启动之前，先完成了全站的"减脂增肌"工作。

### 0.1 字体格式升级与资源优化

- **WOFF2 格式转换**：将全部 Switzer 18 字重 + PPEditorialOld 7 字重从 OTF 转换为 WOFF2（Brotli 压缩），字体总包体积缩减约 **48%**
- **修复预加载 404**：`Switzer-Regular.woff2` 的 `<link rel="preload">` 此前指向错误路径，本次一并修正
- **移除冗余资源**：删除未使用的 `signature.png`（360KB），已被 WebP 替代

### 0.2 安全与 SEO 加固

- **Vercel 安全头**：`vercel.json` 新增 `X-Content-Type-Options`、`X-Frame-Options`、`Referrer-Policy`、`Permissions-Policy`
- **静态资源缓存**：JS 文件配置 `immutable` 强缓存头
- **无障碍**：键盘用户 `skip-to-content` 跳转链接、搜索弹窗焦点捕获
- **SEO**：所有非首页页面注入 `BreadcrumbList` JSON-LD 结构化数据

### 0.3 内容初始化

- 创建项目第一篇技术笔记 `content/technical/mlsys-notes-part-i/index.md`（MLSys 学习笔记）

### 0.4 全站死代码清理

一次性审计清理约 **235 行**冗余代码，涉及 15 个文件：

| 清理项 | 说明 |
|---|---|
| 删除 3 个废弃 Partial | `writing-list-items`、`title-with-back`、`back-link-data` |
| 删除 `archive-copyright` JS 块 | ~60 行，4 个无用事件监听器 |
| 删除 5 个未用 CSS 变量 | `--type-hero`、`--font-display` 等 |
| 删除 4 个死 CSS 选择器 | `.af-summary-focus`、`.work-col-title-arrow` 等 |
| 合并重复动画 | `fade-in-up` → 统一使用 `motion-rise` |
| 去重 TableOfContents 调用 | 4 次 → 1 次（通过 `.Store` 缓存） |
| 提取重复 HTML | 预览容器 HTML 提取为 `archive-preview` partial |
| 合并事件监听器 | 图片序列 5 个 → 2 个 |
| 移除冗余 resize 监听 | `ResizeObserver` 已覆盖，删除 `window.resize` |
| 修复 bug | `popstate` 缺少年份列清理、`makeSnippet` 变量遮蔽全局 `window` |
| 字体栈收束 | 移除组件级重复 `font-family` 声明，全部归入 `base.css` |

### 0.6 三大重构方案设计文档

在动手实施前，为三个核心模块分别编写了设计文档，存入 `docs/plans/`：
- `2026-05-19-webgl-refactor-design.md` — WebGL 流体引擎模块化方案
- `2026-05-19-link-prefetch-design.md` — 链接智能预加载引擎方案
- `2026-05-19-katex-localization-design.md` — KaTeX 本地自托管方案

---

## 一、Observability 仪表盘 — 从零到一的全栈构建

仪表盘是本轮开发的核心新功能，从无到有经历了十余次迭代。

### 1.1 技术链路

- **数据源**：`data/metrics/latest.json`（当前快照，含 build 耗时/死链数/页面数/模板性能/质量指标/CSS 体积）和 `data/metrics/history_timeline.json`（近 200 条历史记录，每条含 `buildMs`/`brokenLinks`/`zhPages`/`enPages`/`cacheRatio`/`commit`）
- **数据采集**：`scripts/metrics-report.ps1` 在构建时自动运行，生成 JSON 并提交至 `data/metrics/`，Hugo 通过 `getJSON` 在构建期静态读取
- **模板**：`layouts/dashboard/single.html`，直接获取 `{{ .Site.Data.metrics.latest }}` 和 `{{ .Site.Data.metrics.history_timeline }}`
- **样式**：`assets/css/dashboard.css`（独立 CSS bundle，通过 Hugo Pipes 条件加载）
- **路由**：`/dashboard/`，全宽桌面布局，无侧边栏

### 1.2 功能演进

| 阶段 | 内容 |
|---|---|
| **初始搭建** | Hugo 构建时静态指标渲染，基础 SVG 图表，CSS 加载与渲染修复 |
| **全宽 Bento Grid** | 重构为全屏宽 Bento 卡片布局，CSS hover 驱动的 SVG 交互 |
| **Premium Bento + Vanilla JS** | 升级视觉层级，引入原生 JS 交互图表（环形图、趋势图） |
| **Editorial 风格重设计** | 完全重写为编辑风原生页面，统一的排版语言 |
| **彩色可视化** | 多维度性能指标着色（构建时间、页面体积、死链率），垂直性能渐变带 |
| **状态色系调优** | 警告黄色 `#f0bf00`、错误桃粉色 `#e88b95`，告别生硬的原色高亮 |
| **全局 inline code 规范化** | 统一等宽字体 `JetBrains Mono`，`0.85em` 字号，`6px` 圆角，自适应前景色 |
| **趋势图缓动动画** | `requestAnimationFrame` 驱动 Dual-Lerp 插值（阻尼系数 `0.18`），坐标、数值、描边色、透明度四维同步过渡 |

### 1.3 关键技术细节

- **数字滚变动效**：趋势图 tooltip 中的毫秒数值在节点间平滑递增/递减，而非瞬间跳变
- **游标淡入淡出**：`transition: opacity 0.14s cubic-bezier(0.4, 0, 0.2, 1)`，代替 `display: none`
- **休眠收敛**：`dist < 0.05` 时自动停止 `rAF` 循环，避免空闲 CPU 消耗
- **全局 inline code 收束**：`pre code` 级联选择器清空圆角/背景噪声，防止代码块被污染

---

## 二、首页与全站视觉打磨

### 2.1 首页交互升级

- **作品悬停预览**：homepage work items 支持 hover 时在右侧面板展示内容预览（`home.css` + `main.js`）
- **About 页面重排**：视觉叙事序列更新（`layouts/about/list.html`）
- **排版微调**：全站链接字体、色彩、hover 动效统一；动态 TOC 行为优化（`post-toc-script.html`）；`figure` shortcode 微调
- **导航净化**：`homepage.yaml` 中无跳转的栏目改用 `<span>` 替代 `<a>`，`cursor: default`；Notes 链接更正为 `/notes/`，消除死跳转

---

## 三、核心架构重构

### 3.1 栏目更名：`technical` → `notes`

- `git mv content/technical content/notes`，保留全部 Git 历史
- 全局联动更新：`hugo.toml`、`baseof.html`、`searchindex.json`、`homepage.yaml`、`tags/term.html`
- CSS 选择器映射：`[data-tag="technical"]` → `[data-tag="notes"]`
- 标签提纯：MLSys 笔记 tags 从 `["notes", "mlsys"]` 精简为 `["mlsys"]`，消除栏目名与标签名的冗余

### 3.2 WebGL 流体引擎模块化（`assets/js/modules/fluid-engine.js`）

- 从首页模板拔除 180 行行内 WebGL 代码，封装为 `FluidEngine` 类
- 完整生命周期：`init()` → `start()` → `pause()` → `resize()` → `destroy()`
- **视口节流**：`IntersectionObserver` 监听，滑出视口自动暂停 `rAF`
- **无障碍降级**：`prefers-reduced-motion` 时仅绘制单帧静态纹理
- **深色模式适配**：`MutationObserver` 监听 `data-theme` 变化，实时切换流体色彩
- **预乘透明度修正**：`gl_FragColor = vec4(color * alpha, alpha)`，解决 GPU 合成的白色 halo 脏边
- **椭圆烟雾底色**：径向椭圆渐变替代矩形 Vignette，宽度扩展至 `1.05`，视觉通透有呼吸感

### 3.3 链接智能预加载（`assets/js/modules/prefetch.js`）

- **环境感知**：检测 Network Information API，低速/省流模式下自动挂起
- **意图判定**：桌面端 65ms hover 防抖，移动端利用 `touchstart` 物理操作间隙预加载
- **白名单过滤**：自动排除外链、锚点、`_blank`、非 HTML 资源
- **内存去重**：同一页面一次会话仅预加载一次

### 3.4 KaTeX 本地自托管

- 编写 `scripts/download-katex.ps1` 自动从 jsDelivr 拉取核心文件 + 20 个 WOFF2 字体
- 存入 `static/lib/katex/`，启用 Git 追踪（总 < 200KB）
- 修改 `head/katex.html` 移除 CDN 依赖，CSS 首屏加载防 CLS 抖动，JS `defer` 不阻塞渲染

---

## 四、内容管理控制台 "Aki's Studio"

本阶段将 Phase 3 中首次出现的简单微博客管理工具（`microblog-server.js` 181 行 + `microblog-ui.html` 610 行）大幅升级为功能完备的多板块写作控制台。

### 4.1 后端服务（`scripts/microblog-server.js`，181 → 480+ 行）

- 全功能 CRUD：`GET /api/posts`（按栏目/草稿状态筛选列表）、`POST /api/publish`（发布/更新）、`POST /api/delete`（物理删除下线）
- 多板块发布：自动创建目标 Section 目录、中英文 Page Bundle 分离写入（`index.md` + `index.en.md`）
- 图片资产托管：前端粘贴/拖拽上传 → 临时目录暂存 → 发布时自动迁移至 page bundle
- `TEST_MODE` 沙盒：环境变量 `TEST_MODE=true` 时静默拦截 Git 操作 + 禁止自动打开浏览器，用于集成测试

### 4.2 前端界面（`scripts/microblog-ui.html`，610 → 900+ 行）

- macOS 风格标题栏 + 三标签页签切换（微微博 / 写文章 / 稿件管理）
- 双语对照编辑器：中英文独立编辑区 + 左右分栏实时预览，支持 Section 选择、Slug 自定义、日期管理、草稿/发布开关、KaTeX 公式开关
- 稿件管理器：按栏目和草稿状态分组的卡片式列表，即时搜索过滤，一键拉回编辑器修改

### 4.3 集成测试（`scratch/test-publishing.js`）

- 无外部依赖的 API 测试套件，完整覆盖：页面请求 → 标签抓取 → 文章索引 → 图片暂存 → 中英文混合文章创建 → 内容编辑 → 文章下线清除 → Git 零污染回滚
- 8 项测试在 Windows 环境一键通过，验证核心发布管线的鲁棒性

---

## 五、Bug 修复

### 5.1 冷启动字体失效

- **问题**：`font-display: optional` 过于激进（100ms 超时），首次冷启动永久退化为系统字体
- **修复**：本地 `@font-face` 和外链 Google Fonts 均改为 `font-display: swap`，确保字体下载后立即替换

### 5.2 WebGL 容器零尺寸竞态

- **问题**：字体延迟加载导致容器在 WebGL 初始化时高度坍塌为 0，造成 Context Lost
- **修复**：在 `main.js` 中监听 `document.fonts.ready`，字体到位后自动调用 `engine.doResize()` 重算 viewport

### 5.3 多语言死链（5/19）

- **问题**：英文站各 Section 缺少 `_index.en.md`，产生 50 个 404
- **修复**：为所有 Section 补齐英文描述文件；列表模板增设多语言回退逻辑（`.Sites.Default`）

### 5.4 列表页预览 DOM 膨胀（5/19）

- **问题**：列表页以隐藏 `div` 注入完整 `.Content`，DOM 随文章数线性扩张
- **修复**：`truncate 800` 截断，Hugo 自动闭合标签，负载降低 90%+

---

## 六、工程清理

- 删除 `.superpowers/`、`output/`、`public_test/`、`temp.html` 等临时/废弃目录
- 移除 `.hugo_build.lock` 和 `.claude/worktrees/`
- 关于页面设计 mockup 归档至 `docs/archive/about-redesign/`

---

## 七、质量指标

| 指标 | 数值 |
|---|---|
| Hugo 构建时间 | `670ms — 770ms` |
| 死链率 | 0 |
| KaTeX 外部依赖 | 0（完全本地托管） |
| 列表页 DOM 负载 | 降低 90%+ |
| 控制台 API 测试通过率 | 100%（8/8） |
| WebGL 后台能耗 | 0（视口外自动暂停） |

---

*记录时间：2026-05-20（涵盖 5/18 - 5/20 全部改动）*
