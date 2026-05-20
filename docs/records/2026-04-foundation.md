# 阶段一：基础搭建 (2026-04-24 → 04-28)

## TL;DR

- **首页数据驱动**：手写 HTML → YAML 数据驱动（`homepage.yaml`），改内容不再需要改代码
- **TextLab 档案系统**：三列网格布局——左栏标签分类过滤、中栏文章卡片列表、右栏 hover 预览面板。这套架构后来被所有 Section（ideas、notes、microblog 等）复用，全部使用同一个 `list.html` 模板 + `archive-list-items.html` partial
- **CSS 管线**：建立 `base.css` / `layout.css` / `components.css` 三件套，通过 Hugo Pipes（`resources.Concat` + `resources.Minify`）串成单一 hash bundle
- **品牌字体**：首次引入 Switzer + PPEditorialOld 字族
- **排版配置**：Goldmark `unsafe = true`（允许 HTML 内联）、`hardLineBreak = true`（保留硬换行）
- **首页动画**：逐字字体切换动画（setTimeout 队列）+ 链接下划线擦除效果
- **响应式**：移动端三列→单列堆叠，侧边栏和预览面板按断点显示/隐藏

---

本阶段建立了整个站点的两大核心系统：数据驱动首页和 TextLab 档案系统。

---

## 1. 首页 YAML 数据驱动化

### 背景

首页原本是硬编码 HTML，内容分散在模板和 Markdown 中，维护困难。

### 方案

- 创建 `data/homepage.yaml` 作为首页唯一数据源，定义栏目区块及各自的条目列表
- 重写 `layouts/index.html`，通过 `.Site.Data.homepage` 动态渲染所有区块
- 数据结构：顶层为带 `section` 标识的栏目列表，每个栏目包含 `name`、`title`、`link`、一组 `items`（每个 item 含 `label`、`link`、`desc`、`tag` 等字段），以及一个 `row` 索引控制网格定位
- 后续这个结构被多次重构——从简单列表 → 三列分区 → 2×3 矩阵，每次只需改 YAML 和模板，不影响内容

### 文件

| 文件 | 操作 |
|---|---|
| `data/homepage.yaml` | 新建，定义全站首页数据结构 |
| `layouts/index.html` | 重写，从硬编码 HTML 改为数据驱动模板 |
| `assets/css/home.css` | 配套样式调整 |

---

## 2. 全局样式体系与构建管线

### CSS 架构

- `assets/css/base.css`：`@font-face` 声明（Switzer + PPEditorialOld 字族）、CSS 自定义属性体系（颜色、间距、字体变量），全局排版基线和重置
- `assets/css/layout.css`：页面容器、网格骨架、响应式断点
- `assets/css/components.css`：可复用 UI 组件（标签侧边栏、文章卡片、预览面板等）
- 通过 Hugo Pipes 串成单一 bundle：`resources.Concat` 拼接 → `resources.Minify` 压缩 → 输出的 `bundle.min.css` 带 content-hash 文件名，天然支持长期缓存

### Hugo 渲染配置

- Goldmark `unsafe = true`：允许 Markdown 中直接写 HTML（`<details>`、`<kbd>` 等）
- Goldmark `hardLineBreak = true`：保留硬换行为 `<br>`，符合中文排版习惯

### 响应式导航

- 桌面端固定导航栏，移动端自适应折叠
- 基于 CSS `@media` 断点控制，不依赖 JS

核心文件：`assets/css/base.css`（CSS 变量与排版地基）、`assets/css/home.css`（首页样式）、`assets/css/layout.css`（网格骨架）。

---

## 3. TextLab 档案系统

### 背景

TextLab 是该站的核心内容板块（文学作品存档），需要一套能从 Markdown 源文件自动生成分类、过滤、预览的归档系统。

### 方案

分多轮迭代搭建：

#### 3.1 三列网格架构

这是整个站点最关键的设计决策之一，后续所有 Section 均复用此模板：

- **左栏**：标签侧边栏，按文章 tags 自动分组聚合，点击 tag 实时过滤中间列表
- **中栏**：文章列表，每行显示标题、日期、摘要，hover 时高亮
- **右栏**：内容预览面板，hover 中部文章行时在右侧渲染对应文章的全文预览（通过隐藏 `<div class="item-preview-data">` 注入 `.Content` HTML）

这套布局的 CSS 骨架由 `assets/css/layout.css` 定义（三列 CSS Grid），组件样式由 `assets/css/components.css` 提供。

#### 3.2 基础布局与样式组件

- 创建 `layouts/textlab/list.html`（TextLab 专属列表模板）、`partials/textlab-list-items.html`
- 首版 `components.css` 已达 220+ 行

#### 3.3 动态过滤与分类

- 左侧标签栏自动按 tags 分组统计
- 点击标签实时过滤（纯 CSS 方案，`.item[data-tags]` 属性匹配）

#### 3.4 通用化归档系统

关键的架构抽象：将 TextLab 专用的 `textlab-list-items.html` 重命名为 `archive-list-items.html`，抽出为通用 Partial。
`layouts/_default/list.html` 升级为支持**所有 Section** 的通用归档模板——此时尚未创建 Microblog，但架构已预留扩展空间。
`layouts/_default/baseof.html` 同步重构，移除硬编码的切区逻辑，改用 Hugo 的 Section 系统自动匹配。

#### 3.5 响应式适配

- 移动端三列网格切换为单列堆叠
- 侧边栏在窄屏隐藏或移至列表下方
- 预览面板仅在桌面端显示（`min-width` 断点）

### 文件

| 文件 | 操作 |
|---|---|
| `assets/css/layout.css` | 新建，三列网格布局骨架 |
| `assets/css/components.css` | 新建，220+ 行组件样式 |
| `layouts/textlab/list.html` | 新建 → 后被通用 `list.html` 取代 |
| `layouts/_default/list.html` | 重写，升级为通用归档模板 |
| `layouts/partials/archive-list-items.html` | 从 textlab-list-items 重命名而来 |
| `layouts/_default/baseof.html` | 重构，移除硬编码切区逻辑 |

---

*记录时间：2026-05-20*
