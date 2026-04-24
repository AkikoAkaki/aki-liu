# Aki's Blog Redesign Handoff

**Date:** 2026-04-15  
**Current Branch:** develop  
**Status:** Planning phase  

---

## Context

你的网站目前是 Hugo + paco.me 设计的复刻。内容很好（尤其是 textlab 的写作），但设计框架不是你自己的，整体感觉「简陋」。

经过分析，问题的根本不在 Hugo 本身，而在于：
1. 字体（Inter 太通用）
2. 信息架构（不清晰你想展示什么）
3. 视觉层次（缺少视觉锚点和冲击力）

---

## 设计参考

### 1. sspeier.com（首页方向）
**URL:** https://sspeier.com/

**关键特征：**
- 超大 display type 的名字（占满视口）
- 3D 人物形象（持续可见的视觉锚点）
- 瑞士极简美学：Suisse Int'l 字体、极度克制的空间
- 简洁的 bio + "First taste is free" 的个性化 tagline
- 工作列表用四栏表格展示（项目、角色、日期、公司）
- 极少内容但高度精致

**适合你的部分：**
- Display type 的气场（可改成你的名字或 tagline）
- 极简的信息架构哲学
- 字体和间距的处理方式

**不适合你的部分：**
- 3D 人物（你没有等价的视觉内容）
- 工作表设计（你的内容结构不同）

---

### 2. andrewherzog.com/archive（内容展示方向）
**URL:** https://www.andrewherzog.com/archive

**关键特征：**
- 四栏布局：左侧筛选器 → 中间内容列表 → 右侧导航 → 右下角预览
- 灵活的筛选系统（按年份、类别、搜索）
- 色点标签系统（视觉分类）
- Hover 时显示项目预览图
- 内容量大（234 entries）但不显得混乱

**适合你的部分：**
- 多维度筛选逻辑（可用于 writings/textlab）
- 信息架构的可扩展性
- 列表设计的精致度

**不适合你的部分：**
- 预览图（你是文字内容）
- 四栏设计可能对移动端不友好

---

## 当前站点分析

### 优点
- 内容结构清晰（insights / engineering / textlab 分类）
- 多语言支持（中英）
- 写作质量高（"主体的弥散" 那篇是真的好）

### 问题点
1. **首页 bio**：模板化，没有个人声音
   - 现在："Operating at the intersection of AI Infrastructure, Product Thinking..."
   - 问题：任何人都可以这么说

2. **三栏 work table**
   - Education 列只有 1 项，大量空白
   - Projects 和 Writing 列不对称
   - 视觉上失衡

3. **字体**
   - 用的是 Inter（全世界都在用）
   - 缺少个性

4. **整体感觉**
   - 极简，但「空」，不是「精」
   - 缺少视觉冲击点

---

## 重设计方向

### 选项 A：sspeier 式首页 + 保留现有 archive（短期）
**工作量：中等**
- 首页换成大号 tagline + 简洁 bio
- 删除或重组 work table
- 升级字体（可用免费字体如 IBM Plex Sans）
- 保留 writings/textlab 现有设计

**优点：** 快速见效，首页有气场
**缺点：** archive 页还是普通列表，信息组织没改进

---

### 选项 B：完整重设计（sspeier 首页 + andrewherzog archive）（中期）
**工作量：大**
- 首页按 sspeier 风格重做
- Writings/textlab 列表加入筛选系统、分类标签、搜索
- 升级字体
- 可能需要调整 Hugo layout

**优点：** 整站协调，设计完整
**缺点：** 工作量大，需要时间

---

## 技术决定

### 框架
**保留 Hugo。** 不换栈。
- 你的 markdown 写作流程最高效
- Hugo 完全支持 CSS 和 JavaScript（不是限制因素）
- 内容永远是你的文件

### 字体
**需要升级。** 选项：
1. **付费：Suisse Int'l**（$100-200，就是 sspeier 用的）
2. **免费替代：**
   - IBM Plex Sans（瑞士风，中文支持）
   - Inter 的升级版（Inter Display）
   - Source Sans Pro

### CSS 架构
- 现有 `base.css / layout.css / home.css / post.css` 结构保留
- 新增 `display.css`（display type 样式）
- 新增 `archive.css`（筛选和多维列表）

### JavaScript
- 简化为：过滤逻辑（tags/categories）+ hover 预览
- 可用 vanilla JS，不需要框架

---

## 文件清单

**需要修改的文件：**
```
assets/css/
  - base.css          → 字体变量、颜色重新审视
  - home.css          → 首页重设计（sspeier 风格）
  - display.css       → 新增（display type）
  - archive.css       → 新增或扩展（筛选系统）

layouts/
  - index.html        → 首页重做
  - _default/list.html → writings/archive 列表重做

data/
  - homepage.yaml     → 简化 work table 或删除

```

**可能新增的文件：**
```
assets/js/
  - archive-filter.js → 筛选和搜索逻辑
```

---

## 下一步

1. **确定设计方向**：选项 A（快）还是 B（完整）？
2. **字体决定**：买 Suisse Int'l 还是用免费字体？
3. **视觉锚点**：sspeier 用 3D 人物，你想用什么？（插画？头像？一句话？）
4. **开始设计**：从首页（display type）还是 archive（筛选系统）开始？

---

## 参考链接

- Current site: https://aki-liu.vercel.app/
- sspeier: https://sspeier.com/
- andrewherzog archive: https://www.andrewherzog.com/archive
- gwern blog: https://gwern.net/blog/index
- paco.me: https://paco.me/

---

**Handoff by:** Claude  
**For:** Aki Liu  
