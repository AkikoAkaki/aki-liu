# Aki Hugo Site Engineering Pass Archive

日期：2026-06-12
仓库：`AkikoAkaki/aki-liu`
范围：代码质量、性能、媒体处理、写作发布流程、agent 可维护性

## 摘要

这一轮改造的核心目标不是增加新功能，而是把站点从“能跑，但很多规则依赖记忆和 prompt 约束”，推进到“更轻、更稳、更适合长期维护和 agent 协作”的状态。

最直接的变化有四类：

1. 代码结构更清楚。原来偏重的 `assets/js/main.js` 被拆成多个 feature module，后续修改的影响面更可控。
2. 性能和媒体有了量化工具。站点新增 asset audit，About 页最大图片债被处理，public 输出体积减少约 94 MB。
3. microblog 发布链路更安全。原先“点一下可能直接 commit + push 到生产”的流程，现在有安全脚本、no-push 模式、main 分支保护和本地检查。
4. 写作、翻译、microblog、图片、preview、metrics 都有了文档和命令入口，作者本人和 agent 都更不容易踩坑。

一句话总结：这次不是给网站加新东西，而是给网站补了安全带、体检表、说明书，并把最重的一包图片减下来了。

## 1. Code Quality / Maintainability

对应 PR：#11 `Refactor JS structure and harden local publishing workflow`

这一部分完成了代码结构整理和本地发布安全加固：

- 修正旧的 `/technical/` 搜索命令。
- 更新 `AGENTS.md`，让 agent 能更准确理解当前项目结构和命令。
- 给 `microblog-server.js` 增加 path traversal 防护。
- 将根目录下的 mockup / scratch 文件移到 `docs/mockups/`。
- 将原本臃肿的 `assets/js/main.js` 拆成多个 feature module。
- 补上共享 helper 和面向 agent 的 invariant comments。

体感收益：以后再让 Codex / Claude 修改网站时，不需要在一个巨大的 JS 文件里翻找上下文。模块边界更清楚，agent 更容易知道每段代码负责什么，也更不容易误改旧路径、旧约定或危险路径。

## 2. Performance Baseline / Asset Audit

对应 PR：#12 `Add public asset audit for performance baselines`

这一部分新增了 public asset audit，用来量化 build output 的总体积、图片体积、CSS / JS 体积、search index 体积和最大文件。

当时 baseline：

- `public_test`：736 files / 333.12 MB
- images：234.79 MB
- CSS：168.36 KB
- JS：334.19 KB
- HTML / routes：16.97 MB
- search index zh：637.22 KB
- search index en：249.56 KB

最大文件主要集中在 `gainax-kanada` 视频和 About 原图。

体感收益：以后性能优化不再靠猜。可以直接判断体积增长来自视频、图片、JS、CSS、HTML 还是 search index。

## 3. Safe Loading / Runtime Performance

对应 PR：#13 `Add safe loading pauses and intent-based search warmup`

这一部分做了低风险的运行时性能优化：

- About base image 加 `fetchpriority="high"`。
- hidden sequence images 改为 lazy / async。
- fluid effect 在 tab hidden 时 pause / resume。
- search index 在用户 hover、focus、pointer intent 时提前 warm up。

这次没有改图片源、压缩策略、布局或搜索 ranking。

体感收益：后台标签页不再持续跑 WebGL；搜索在用户准备打开时可以提前加载；About 页隐藏图片不会一开始就和首屏抢资源。这不是“某个按钮快 2 倍”的优化，而是减少不必要的后台和初始加载压力。

## 4. About Image Pipeline

对应 PR：#14 `Process About images with Hugo Pipes`

这一部分带来了本轮最大体积收益。About 页 40 张图片从 `static/images/about` 原图直出，改为通过 Hugo Pipes 处理成 WebP q82，并限制长边 2000px。

结果：

- public output：333.12 MB -> 238.85 MB
- images：234.79 MB -> 140.52 MB
- 总体减少：94.26 MB

体感收益：About 页和整体站点不再背着一组十几 MB 的原图。首次打开、手机网络访问、Vercel build output 和缓存压力都会更轻。

注意：这一步主要优化加载体积，不改变视觉设计。未来如果觉得 WebP q82 对某些照片质感有影响，可以针对具体图片调到 q85 / q88。

## 5. Archetypes / Content Creation Foundation

对应 PR：#15 `fix: align archetypes with YAML content conventions`

这一部分把默认 archetype 从 TOML 改成 YAML，并新增 microblog leaf-bundle archetype。microblog archetype 会从 `content/microblog/YYYY/MM/DD-HHMMSS` 推导 `date` 和 `slug`。`AGENTS.md` 也新增了创建普通文章、英文翻译和 microblog 的命令说明。

体感收益：以后不需要每次复制旧文章再手改 frontmatter。`hugo new` 生成出来的内容更符合当前站点规范，microblog 也不会因为忘记 slug 而生成错误 URL。

常用命令：

```powershell
hugo new content ideas/my-slug/index.md
hugo new content ideas/my-slug/index.en.md
hugo new content microblog/2026/06/12-101010
```

## 6. Safe Microblog Scaffold Script

对应 PR：#16 `feat: add safe microblog scaffold script`

这一部分新增 `scripts/new-microblog.ps1`，作为 microblog 的安全生成方式。它只创建文件，不执行 `git add`、`commit` 或 `push`。它支持当前上海时间、指定时间、tags、draft，并生成正确的 `content/microblog/YYYY/MM/DD-HHMMSS/index.md` 和 `/microblog/HHMMSS/` URL。

体感收益：以后想写 microblog，但不想冒着 console 一键推送的风险，可以用这个脚本先生成文件，慢慢写，再自己决定什么时候 commit / push。

常用命令：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\new-microblog.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\new-microblog.ps1 -At "2026-06-12T10:10:10"
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\new-microblog.ps1 -Tags tag1,tag2
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\new-microblog.ps1 -Draft
```

## 7. Author Workflow Guide

对应 PR：#17 `docs: add author workflow guide`

这一部分新增 `WORKFLOW.md`，并从 `AGENTS.md` 链过去。内容覆盖本地 preview、创建文章、创建英文翻译、安全 microblog、microblog console 警告、图片和视频、draft、push / merge 前检查、metrics、asset audit 和常见 footguns。

体感收益：以后不用回忆“应该怎么发文章”“microblog 怎么命名”“`public_test` 能不能 commit”“图片应该怎么放”。这些规则集中在一个作者手册里。

## 8. Local Pre-push Check

对应 PR：#18 `feat: add local pre-push check script`

这一部分新增 `scripts/check.ps1`。它会做本地 pre-push smoke check：

- 提醒 `public/`、`public_test/` 或测试内容是否被 staged。
- build 到 `public_test/`。
- 扫描所有 microblog 的路径形状、`date`、`slug`、`draft`。
- 检查 slug 是否匹配目录。
- 检查 date 是否是 `+08:00`。
- 可选 `-Audit` 跑 asset audit。

脚本不做 git 写入，不 commit，不 push。

体感收益：push 前有一个“体检按钮”。它能提前发现 microblog slug 错、日期格式错、Hugo build 挂、`public_test` 被误 staged 这类低级但麻烦的问题。

常用命令：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\check.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\check.ps1 -Audit
```

## 9. Safer Microblog Console

对应 PR：#19 `fix: make microblog console publishing safer`

这一部分改造了 `microblog.cmd` 背后的 `microblog-server.js`。现在 console publish / delete 会挡住 `main` 分支，支持 `MICROBLOG_NO_PUSH=1` 跳过 push，正常分支 publish / delete 会先跑 `scripts/check.ps1` 再 push。`WORKFLOW.md` 也记录了 no-push 模式。

体感收益：以前 console 很危险，点发布就可能直接 commit + push。现在至少有三层保护：main 上不让发，push 前会检查，需要时可以 no-push，只在本地 commit。

安全 no-push 启动方式：

```powershell
$env:MICROBLOG_NO_PUSH='1'; .\microblog.cmd
```

## 10. 当前站点状态

现在站点从“个人项目脚本 + Hugo 页面”，变成了更接近长期维护项目的结构。

代码方面：JS 被拆分，危险路径被加固，agent 修改边界更清楚。

性能方面：有 baseline，有 asset audit，About 图片最大债已处理。

写作方面：文章、翻译、microblog 都有标准创建入口。

发布方面：microblog 有 safe scaffold、no-push console、main branch protection 和本地检查。

文档方面：`AGENTS.md` 面向 agent，`WORKFLOW.md` 面向作者。

## 11. 体感变化

最明显：About 页和整体站点更轻，资源包少了约 94 MB。

最安心：microblog 不再那么容易一键误推生产环境。

最省脑：新建文章、翻译、microblog 有固定命令，不用复制旧文件硬改。

最有长期价值：以后继续用 Codex / Claude 改站时，项目结构、文档和检查脚本会给它们明确边界，不容易越改越乱。

## 12. 后续可以继续做的事

性能线剩余事项：

1. 优化 `textlab/gainax-kanada` 视频体积。
2. 盘点并优化 Text Lab / article 里剩余的大 PNG。
3. 给 content image render hook 增加更细的 srcset / resize 策略。
4. 做字体 audit / self-hosting 策略。
5. 拆分 route-level JS entrypoints。
6. 设计 search index 体积控制策略。

这些现在不是地基问题，而是后续 polish。下一步如果继续做，建议先做 media inventory report，不要直接压视频。
