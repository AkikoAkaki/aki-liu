# 待审阅的优化项（涉及样式/内容/手动操作）

以下优化项均**未执行**，需要您审阅后决定是否推进。

---

## 1. Switzer 字体格式：OTF → WOFF2

### 不改会怎样
浏览器每次加载页面都要下载并解码 OTF 格式字体，总计约 **645 KB**（10 个字重文件×约 35-48 KB 每个）。OTF 是桌面字体格式，浏览器对其解码效率低于 WOFF2。

### 改了会怎样
- 字体文件体积减少约 **50–70%**（预计降到 200–320 KB）
- 首次加载时间缩短，尤其是在移动端/低速网络
- 视觉效果**完全不变**，WOFF2 是 OTF 的无损压缩

### 应该怎么改
1. 使用字体转换工具（如 [Google Fonts Helper](https://google-webfonts-helper.herokuapp.com/)、FontSquirrel Webfont Generator 或命令行工具 `pyftsubset`/`woff2_compress`）将 10 个保留的 OTF 文件转换为 WOFF2
2. 将生成的 `.woff2` 文件放入 `/static/fonts/switzer/`
3. 在 `assets/css/base.css` 中将所有 `@font-face` 的 `src` 从：
   ```css
   src: url("/fonts/switzer/Switzer-Light.otf") format("opentype");
   ```
   改为：
   ```css
   src: url("/fonts/switzer/Switzer-Light.woff2") format("woff2");
   ```
4. 可保留 OTF 作为 fallback（format 列表中添加两项），但通常仅 WOFF2 已足够覆盖所有现代浏览器

---

## 2. 导航描述栏的 blur 过渡效果

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

## 3. 列表页预览区 HTML 负载（`.Content` → `.Summary`）

### 当前情况
`layouts/partials/archive-list-items.html` 第 31 行：
```html
<div class="preview-summary raw-content-preview">
    {{ .Content }}
</div>
```
每篇文章的**完整渲染 HTML** 都被嵌入到列表页的隐藏 `div` 中。例如，20 篇平均 8KB 的文章 = 额外 **160KB** 的 HTML 负载，且完全在首次加载时传输（隐藏元素也是 HTML 的一部分）。

### 不改会怎样
列表页随文章数量增加而线性变重，文章数越多列表页越慢。

### 改了会怎样（如果使用 `.Summary`）
- **优点**：HTML 体积大幅减少；Hugo 的 `.Summary` 默认约 70 个词（可配置）
- **缺点（视觉）**：右侧预览区域内容变少，不再显示文章中段的图片、代码块、引用等内容
- 如果文章开头足够引人入胜，摘要预览可能已足够好

### 应该怎么改（如果您决定改）
```html
<!-- 当前 -->
<div class="preview-summary raw-content-preview">
    {{ .Content }}
</div>

<!-- 改为（Hugo 自动生成摘要，约前 70 词） -->
<div class="preview-summary raw-content-preview">
    {{ .Summary }}
</div>
```
或手动控制字数上限（约等于 500-800 字符的 HTML）：
```html
{{ .Content | truncateHTML 500 }}
```

> **权衡建议**：如果您的文章都有精心撰写的开头，`.Summary` 效果很好；如果开头是直接进入正文，可能预览体验下降。

---

## 4. signature.png 压缩

### 不改会怎样
`/static/images/signature.png` 文件大小 **368 KB**，但实际渲染最大宽度仅为 104px（移动端 56-80px）。`loading="lazy"` 已添加，可延迟加载，但文件体积仍然很大，回访用户缓存命中前都需下载。

### 改了会怎样
- 文件大小可减少到 **10–30 KB**（WebP 格式）或 **30–60 KB**（优化后的 PNG）
- 视觉效果无变化（签名图片本身不变，只是文件更小）
- 首次访问加载更快（即使懒加载也缩短了请求时间）

### 应该怎么改
1. 将图片调整到 2x retina 尺寸：宽 **208px**（104px × 2）
2. 转换为 WebP 格式，使用工具如 [Squoosh](https://squoosh.app/) 或 `cwebp`
3. 替换 `/static/images/signature.png` 为压缩后的版本
4. 如转为 WebP，同时修改 `baseof.html` 第 32 行的 `src` 后缀为 `.webp`
   （或使用 `<picture>` 标签提供 PNG fallback）

---

## 5. signature.png 的 width/height 属性（防 CLS）

### 不改会怎样
缺少 `width` 和 `height` HTML 属性，浏览器在图片加载完成前无法预知其宽高比，可能导致页脚区域在图片加载瞬间发生布局偏移（CLS 指标变差）。由于已添加 `loading="lazy"`，该问题仅在用户滚动到底部时发生，影响相对较小。

### 改了会怎样
浏览器提前预留图片占位空间，完全消除布局偏移。视觉上完全无变化。

### 应该怎么改
首先用任意工具查看 `signature.png` 的实际像素尺寸（宽×高），然后在 `baseof.html` 第 32 行添加：
```html
<img src="{{ "images/signature.png" | relURL }}" 
     alt="AKI LIU" 
     class="footer-signature" 
     loading="lazy"
     width="实际宽度px"
     height="实际高度px">
```
CSS 的 `clamp()` 会覆盖 HTML 属性做出正确的响应式渲染，但浏览器会用这两个属性计算正确的宽高比来预留空间。
