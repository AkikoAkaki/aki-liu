# 网站写作流程

## 预览和构建

```powershell
hugo server -D --disableFastRender   # 本地预览，包含草稿：http://localhost:1313
hugo --gc --minify                   # 生产构建，输出到 public/
```

`public/` 和 `public_test/` 是构建产物，不要提交。若已暂存，运行 `git restore --staged public/ public_test/`；若已提交，使用 `git rm --cached` 移出版本控制。

## 新建内容

各栏目使用 leaf bundle：`content/<section>/<slug>/index.md`，图片和视频放在同一目录。平铺的 `content/notes/my-slug.md` 无法在同一目录组织素材。

```powershell
hugo new content notes/my-slug/index.md      # 中文（默认语言）
hugo new content notes/my-slug/index.en.md   # 同一 bundle 内的英文翻译
```

翻译沿用 bundle 目录的 slug 和 URL。

## Microblog

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\new-microblog.ps1
```

可选参数：`-At "2026-06-12T10:10:10"`（默认上海当前时间）、`-Tags tag1,tag2`、`-Draft`。脚本创建 `content/microblog/YYYY/MM/DD-HHMMSS/index.md`，不执行 Git 命令。`hugo new content microblog/2026/06/12-101010` 也会创建同一个文件。

目录必须保持 `YYYY/MM/DD-HHMMSS` 格式，日期和 slug 由此生成。新条目使用 `/microblog/YYYYMMDDHHMMSS/`，旧条目保留原有短 slug。

```yaml
---
date: 2026-06-12T10:10:10+08:00
slug: "20260612101010"
tags: []
draft: false
---
```

## 媒体

- `![alt text](image.jpg)`：图片渲染钩子会转换为 WebP。
- `{{< figure src="image.jpg" alt="alt text" caption="Caption." >}}`：带说明的 bundle 图片。
- `{{< localvideo src="clip.mp4" >}}`：bundle 内的视频。

About 页图片使用独立的 Hugo Pipes 流程，不要复制到其他页面。

## 草稿

`draft: true` 表示草稿。只有 `-D`（`--buildDrafts`）会构建草稿；Vercel 不使用该参数，因此草稿可以推送。发布前设为 `draft: false`，否则生产站点不会显示。

## 推送前

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\check.ps1   # 加 -Audit 检查产物大小
```

检查会构建 `public_test/`、提示已暂存的构建产物，并验证 Microblog 路径和 frontmatter。`-Audit` 还会输出图片、CSS、JS、HTML 和搜索索引的总大小及最大的十个文件；它不检测未使用文件。

如果改动涉及固定元素、页脚或页面级 `overflow`，对同一构建运行 `node scripts/edge-check.mjs`。它需要 Node 22+ 和 Chrome 或 Edge，输出 `PASS` 或失败的页面和步骤。它模拟 Safari；确认移动端布局修复前，还需用真实 iPhone 检查。

合并前检查分支的 Vercel 预览地址。

## 指标

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\metrics-report.ps1
```

代码提交后运行。脚本在临时目录构建，重写 `data/metrics/latest.json`，并向 `data/metrics/history_timeline.json` 追加一个数据点，后者保留最近 30 条。Dashboard 只读取这两个文件；提交它们才会发布新快照。Hugo 和 Vercel 构建不会采集指标。

- 构建时间是在已有资源缓存下运行一次 `hugo --gc --minify` 的结果，不是冷缓存或重复测量。
- 缓存复用比例是缓存调用次数除以所有模板调用次数，来自单独的 `--templateMetrics` 运行。
- 页面资源大小统计初始 HTML 引用的本地样式和脚本，包括 `/lib/` 下的第三方文件；不含内联、远程和运行时加载的代码。Gzip 数字按文件分别压缩估算。
- 资源基线取本地 `origin/main` 引用中的 `data/metrics/latest.json`；脚本不会 fetch。
- 生成页面数包含归档和标签页，不等于文章数。
- 采集期间若 Git 版本或状态变化，脚本会停止且不写入结果。
