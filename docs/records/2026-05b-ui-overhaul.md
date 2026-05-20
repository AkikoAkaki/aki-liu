# 阶段三：全站 UI 系统大改 (2026-05-09 → 05-17)

## TL;DR

这 8 天是最密集的工程期，几乎重写了站点的每一个可见模块：

- **搜索**：首次引入全站搜索，Ctrl+K 唤起。Hugo 构建时生成 JSON 索引（含 title/permalink/summary/tags/section/lang），前端实时筛选。这个索引格式后来被仪表盘和后台管理工具复用。
- **导航**：从一个小药丸按钮，迭代成可展开的毛玻璃 Menu Bar，滚动时自动隐藏/显示，链接逐项 staggered 入场。
- **TOC**：文章目录从朴素链接列表，升级为固定位置的毛玻璃面板，带 3D Tilt 效果和标签主题色的实时追踪指示器。
- **首页**：Work 区块从单列列表 → 三列网格 → 2×3 矩阵布局，hover 可预览详情。
- **页脚**：改成固定渐变 Reveal Footer——滚动到底部时渐变蒙板逐渐透明，揭示完整页脚内容和引用语。
- **Microblog**：全新的微博客板块，时间轴布局、年份分组、独立 RSS/JSON Feed，后续导入了 133 条 Threads 历史数据。配套的 `microblog.css` 和 `microblog.js` 作为独立 bundle 被 Hugo Pipes 分别编译。
- **WebGL 流体**：首页背景经历了 13 步演变——clip-path 入场动画 → 胶片颗粒 → 光标视差 glow → CSS 渐变 box → 最终替换为 WebGL domain-warping 流体着色器，支持鼠标交互（velocity-drag 而非简单的径向推力）。所有代码此时还在 `index.html` 的行内 `<script>` 里，为后面的 `FluidEngine` 类模块化重构铺了路。
- **About**：页面模板从 24 行涨到 157 行，新增课程卡片、学期分组、头像素材，经历 4 轮 mockup 迭代。
- **基础文件膨胀**：`main.js` 从 239 行涨到 1000+ 行，`components.css` 从 220 行涨到 900+ 行。新建了 `motion.css`（动效集中管理）、`search.css`（435 行）、`microblog.css`（678 行）——后两者作为独立 CSS bundle 通过 Hugo Pipes 条件加载（search 全站共用、microblog 仅在 `/microblog/` 路由输出）。
- **后台工具雏形**：`microblog-server.js` + `microblog-ui.html` 首次出现，为后续 Aki's Studio 控制台奠基。

---

本阶段是该项目最大规模的界面重构期，覆盖了导航、搜索、目录、页脚、首页布局、Microblog、WebGL 和 About 页面等几乎所有面向用户的系统。

---

## 一、搜索与命令面板 (05-09)

### 方案

首次引入全站搜索功能，技术链路：Hugo 构建时生成搜索索引 → 前端 JS 消费。

- 新建 `layouts/_default/searchindex.json`：Hugo 在构建时生成 JSON 索引
- 索引 schema：每条记录含 `id`、`title`、`permalink`、`summary`（截取前 200 字符）、`tags`（数组）、`section`（所属栏目）、`date`、`lang`。这个格式后续被 Dashboard 和后台管理工具直接复用
- 新建 `assets/css/search.css`（435 行）：搜索面板专用样式（毛玻璃背景、圆角、键盘导航高亮）
- `assets/js/main.js`：+493 行搜索交互逻辑（快捷键 Ctrl+K 唤起弹窗、输入实时筛选、↑↓ 键导航、Enter 跳转、Esc 关闭）
- `hugo.toml`：新增 `[outputFormats.SearchIndex]` 自定义输出格式，`[outputs.home]` 追加 `SearchIndex`

### 文件

| 文件 | 操作 |
|---|---|
| `assets/css/search.css` | 新建，435 行 |
| `assets/js/main.js` | +493 行搜索逻辑 |
| `layouts/_default/searchindex.json` | 新建，JSON 索引模板 |
| `hugo.toml` | 新增 SearchIndex 输出格式 |

---

## 二、文章页面重设计 (05-09 → 05-10)

### 2.1 文章头部重构

- 单页头部从简单的标题+日期布局升级为网格排版
- 新增元信息展示区：发布日期、阅读时间、标签分类
- 相关样式集中在 `assets/css/post.css`

### 2.2 字体引入

- 引入思源宋体（Source Han Serif / Noto Serif CJK）作为正文字体族
- 在 `hugo.toml` 中注册 Google Fonts 异步加载
- 全局排版配色整体调优，确保中文排版质感

### 文件

| 文件 | 改动 |
|---|---|
| `assets/css/post.css` | +95 行头部排版 |
| `layouts/_default/single.html` | 头部模板重构 |
| `hugo.toml` | 新增字体配置 |
| `layouts/partials/head/core-assets.html` | 字体加载配置 |

---

## 三、TOC 目录组件重构 (05-10)

### 从简单链接列表 → 沉浸式交互面板

分四次连续 commit 迭代：

| 轮次 | 内容 |
|---|---|
| **v1** | 毛玻璃面板（`backdrop-filter: blur`）、3D Tilt 鼠标跟随、动态滑动指示器 |
| **v2** | 指示器从固定色改为标签主题色圆点，跟随文本右侧实时定位 |
| **v3** | 归档页日期可点击跳转，TOC 指示器支持多标签颜色循环 |
| **v4** | 优化移动端行为和边界情况 |

### 技术细节

- TOC 面板：`position: fixed`，仅在桌面端显示，滚动时自动高亮当前段落
- 3D Tilt 效果通过 CSS `perspective` + `rotateX/Y` 实现
- 指示器使用 `IntersectionObserver` 监听各段落可见性
- 核心逻辑集中在 `layouts/partials/post-toc-script.html`

### 文件

| 文件 | 改动 |
|---|---|
| `assets/css/post.css` | +147 行 TOC 样式 |
| `layouts/partials/post-toc-script.html` | +159 行 TOC JS |
| `layouts/_default/single.html` | 新增 TOC 挂载逻辑 |

---

## 四、首页三列网格 + 页脚 Reveal (05-10)

### 4.1 首页工作区重构

- 首页 Work 区块从单列列表升级为三列网格布局
- 每个工作条目支持悬浮预览（右侧面板展示详细描述）
- 新增 Contact 联系区

### 4.2 页脚 Reveal Footer

- 页脚从简单的版权行升级为**固定渐变出现（Reveal Footer）**
- 新增联系方式与引用语区域（"ENGINEER with THOUGHTS"）
- 实现：页面滚动到底部时，渐变蒙版逐渐透明化，揭示完整页脚
- 出现时机通过 `IntersectionObserver` + CSS `mask-image` 渐变控制

### 文件

| 文件 | 改动 |
|---|---|
| `assets/css/home.css` | +376 行首页网格 |
| `assets/js/main.js` | +57 行悬浮预览逻辑 |
| `data/homepage.yaml` | 数据结构重构为三列 |
| `layouts/index.html` | 模板适配新布局 |
| `assets/css/layout.css` | +234 行 Reveal Footer 样式 |
| `layouts/_default/baseof.html` | 页脚模板重构 |

---

## 五、导航栏重构：Pill → Menu Bar (05-10 → 05-11)

### 演进过程

| 版本 | 描述 |
|---|---|
| **之前** | 固定药丸（pill）按钮，功能单一 |
| **v1 (05-10)** | 重构为可展开式 Menu Bar：点击 pill 展开全屏菜单面板 |
| **v2 (05-10)** | 交互打磨：滚动感知隐藏（向下滚隐藏/向上滚显示）、staggered 逐项链接入场动画、动效曲线调优 |
| **v3 (05-11)** | 搜索面板与菜单视觉统一：统一配色、毛玻璃材质、间距体系 |
| **v4 (05-11)** | 菜单扩展为可搜索面板（见下文 §六） |

### 技术细节

- 滚动感知隐藏：`scroll` 事件 + 方向判断 + throttling
- Staggered 入场：CSS `animation-delay` 为每个菜单项递增
- 动效曲线：`cubic-bezier(0.22, 1, 0.36, 1)` 等高级缓动
- 页脚从硬编码改为数据驱动（通过 `homepage.yaml` 渲染联系方式）

### 文件

| 文件 | 改动 |
|---|---|
| `assets/css/base.css` | +262 行菜单样式 |
| `assets/css/search.css` | 样式统一 |
| `assets/js/main.js` | +65 行菜单交互 |
| `layouts/_default/baseof.html` | 导航模板重构 |

---

## 六、Microblog 系统 (05-11)

### 首次引入微博客板块

- **内容结构**：`content/microblog/` 按 `年/月/日-时间` 目录组织，每个条目为独立 Hugo page bundle
- **列表模板**：`layouts/microblog/list.html`（时间轴布局）
- **单篇模板**：`layouts/microblog/single.html`
- **RSS/Feed**：`list.rss.xml` + `list.microblog_feed.json`
- **样式**：`assets/css/microblog.css`（678 行），独立于主站 CSS bundle
- **JS**：`assets/js/microblog.js`（289 行），时间轴滚动加载、年份分组

### Hugo 配置扩展

- `hugo.toml` 新增 `[taxonomies]` 和 Microblog 相关的输出格式配置
- 搜索索引引入 Microblog 数据源

### 文件

| 文件 | 操作 |
|---|---|
| `assets/css/microblog.css` | 新建，678 行 |
| `assets/js/microblog.js` | 新建，289 行 |
| `layouts/microblog/list.html` | 新建 |
| `layouts/microblog/single.html` | 新建 |
| `layouts/microblog/list.rss.xml` | 新建 |
| `layouts/microblog/list.microblog_feed.json` | 新建 |
| `content/microblog/_index.md` | 新建 |
| `hugo.toml` | 新增 Microblog 配置 |

---

## 七、归档页与搜索面板打磨 (05-11 → 05-16)

这五天里对各系统进行了连续精修：

- **归档页排版**：全面切换为 sans-serif 字族（原为 serif），文章头部间距变量化以支持短内容自适应，页脚从硬编码改为 `homepage.yaml` 数据驱动
- **搜索面板与菜单融合**：菜单 pill 展开后可切换至搜索模式，两者共享同一套毛玻璃材质与间距体系；相关样式集中至 `search.css`
- **Microblog 打磨**：移动端时间轴布局优化 + 视觉系统重设计（对齐编辑级排版标准，`microblog.css` +235 行，时间轴密度、卡片间距、元信息层级全面调优）
- **搜索栏交互重写**（05-15）：`main.js` +326 行，搜索逻辑全面重构，侧边导航栏动态间距优化

## 八、首页 2×3 Grid 重构 (05-15)

### 从三列网格升级为 2×3

- `data/homepage.yaml`：完全重构数据结构，从三列 `[left, center, right]` 改为 2×3 矩阵 `[[a,b],[c,d],[e,f]]`
- `layouts/index.html`：模板适配新网格渲染逻辑
- `assets/css/home.css`：网格布局从 3-column 改为 2-column with cell stacking

---

## 九、About 页面与内容系统 (05-15 → 05-17)

### 9.1 About 页面全生命周期建设

这一轮完整搭建了 About 页面的框架和内容：

- 新建 `layouts/about/list.html`（初版 24 行，最终扩至 157 行）作为 About 专属模板
- 新建英文内容页：`courses/index.en.md`、`resume/index.en.md`，支持完整双语展示
- **视觉重设计**（05-16）：`components.css` +545 行、`base.css` +49 行、`layout.css` 重构。经历了 4 轮 mockup 迭代（`about-mockup.html` → v2 → v3 → standalone）
- **课程卡片**（05-17）：新建 `af-courses-card` CSS 样式，About 页面新增课程卡片区，按学期分组
- 引入 avatar 和 University of Rochester logo 素材

### 9.2 后台工具链首次出现

`scripts/microblog-server.js`（181 行 Node.js 后端）和 `scripts/microblog-ui.html`（610 行前端）首次引入，提供最初版的微博客内容管理界面——这是 Aki's Studio 控制台的原型。

### 9.3 Threads 数据导入与动效集中管理

- 从 Threads 导入 133 条历史微博（2024-05 至 2026-03），统一 Microblog 目录结构
- 新建 `assets/css/motion.css`（118 行），将散落在各文件的动效定义集中管理
- 首页与 About 最终视觉 polish

---

## 十、WebGL 流体引擎的演化 (05-17)

### 从 CSS 渐变 → WebGL 着色器的完整演变链

| 阶段 | 内容 |
|---|---|
| **Step 1** | 首页添加 clip-path reveal 入场动画（hero name + bio text） |
| **Step 2** | Hero 慢速模糊→清晰纹理出现效果 |
| **Step 3** | 添加胶片颗粒（film grain）overlay 效果 |
| **Step 4** | Hero name 光标视差（cursor parallax）效果 |
| **Step 5** | 光标跟随径向渐变 glow |
| **Step 6** | glow 切换为灰色，移除胶片颗粒 |
| **Step 7** | 全页 glow → hero 边界灰色流体 box |
| **Step 8** | 引入 WebGL domain-warped 流体着色器，替代纯 CSS 渐变 |
| **Step 9** | 将 WebGL canvas 移出 clipped wrapper，延迟 resize 至布局完成后 |
| **Step 10** | 鼠标推动扰动（push disturbance） |
| **Step 11** | 径向 push → velocity-drag 流体交互 |
| **Step 12** | 鼠标悬浮湍流持续激活 |
| **Step 13** | 从平滑鼠标位置计算流体速度，消除抖动 |

### 技术特征

- 所有 WebGL 代码此时仍在 `layouts/index.html` 中以行内 `<script>` 形式存在
- 着色器使用 domain-warping（域扭曲）算法生成有机流动纹理
- 鼠标交互通过 velocity-drag（速度拖拽）而非径向推力，模拟流体粘性
- 这一步为 5/19 的 `FluidEngine` 类模块化重构奠定了原型基础

---

## 十一、关键文件演变总览

以下是在本阶段改动最密集的核心文件：

| 文件 | 阶段初 | 阶段末 | 说明 |
|---|---|---|---|
| `assets/css/base.css` | 基础变量+排版 | +430 行新增 | 导航、搜索、动效系统 |
| `assets/css/home.css` | 简单首页样式 | +450 行 | 三列→2×3 网格、预览面板 |
| `assets/css/components.css` | 220 行 | +700 行 | 归档卡片、标签、About 组件 |
| `assets/css/post.css` | 基础文章样式 | +280 行 | TOC、头部排版、多彩标签 |
| `assets/css/search.css` | 不存在 | 435 行 | 搜索面板全套样式 |
| `assets/css/microblog.css` | 不存在 | 678 行 | Microblog 时间轴样式 |
| `assets/css/motion.css` | 不存在 | 118 行 | 集中动效管理 |
| `assets/js/main.js` | 239 行 | +800 行 | 搜索、菜单、TOC、预览、WebGL 调度 |
| `assets/js/microblog.js` | 不存在 | 289 行 | Microblog 交互 |
| `layouts/index.html` | 数据驱动模板 | +140 行 WebGL | 首页承载 WebGL 着色器 |
| `layouts/about/list.html` | 24 行 | 157 行 | About 视觉升级 |
| `layouts/partials/post-toc-script.html` | 基础 TOC | +159 行 | 毛玻璃+3D Tilt+指示器 |
| `scripts/microblog-server.js` | 不存在 | 181 行 | 内容管理后台服务 |
| `scripts/microblog-ui.html` | 不存在 | 610 行 | 内容管理前端界面 |

---

*记录时间：2026-05-20*
