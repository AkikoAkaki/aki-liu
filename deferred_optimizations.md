# 待审阅的优化项（涉及样式/内容/手动操作）

以下优化项均**未执行**，需要您审阅后决定是否推进。

---

## 1. 导航描述栏的 blur 过渡效果 (原第 2 项)

### 不改会怎样
当前 `.nav-description-display` 使用 `filter: blur(4px)` 到 `filter: blur(0px)` 的过渡实现"焦外→焦内"淡入效果。`filter` 每帧都会触发全像素重新光栅化，GPU 开销较高（每次 hover 进入导航时都发生）。

### 改了会怎样（如果移除 blur）
- **视觉变化**：导航描述文字的出现方式从"焦外模糊淡入+上浮"变为"直接透明度淡入+上浮"
- 动画仍然流畅，但失去"焦距感"
- GPU 帧率在 hover 时会有所改善

### 应该怎么改（如果您决定改）
在 `assets/css/base.css` 中，将 `.nav-description-display` 的初始和激活状态修改：

```css
/* 移除 filter，只保留 opacity + transform */
.nav-description-display {
    /* 删除这行: filter: blur(4px); */
    opacity: 0;
    transform: translateY(6px);
    transition: opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1),
                transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

.nav-description-display.show {
    opacity: 1;
    /* 删除这行: filter: blur(0px); */
    transform: translateY(0);
}
```

---

## 2. 列表页预览区 HTML 负载与截断 (已采用截断优化)

### 状态：已优化
`layouts/partials/archive-list-items.html` 已采用 `truncate 800` 进行字数上限控制，避免未受控的长篇全文渲染进列表 DOM。

---

## 3. signature.png 压缩与 WebP 化 (已完成)

### 状态：已完成
模板已全面改用 `/static/images/signature.webp` (9.12 KB)，替代了原 368 KB 的 PNG 资源，体积缩减 97.5%。
