# 全库审阅与修复记录

日期：2026-10-24。审阅基线：`a335dae0cefa086c65ddc8c12341a5ff52b7e153`。

本轮确认并修复 30 项问题，其中 P2 有 24 项，P3 有 6 项。P2 涉及功能、数据保护和可靠性。P3 涉及较低影响的导航、界面和工具行为。以下问题把握均为高，跨来源访问问题的验证边界见 T11。

记录时，修复保留在未提交工作区，HEAD 仍为上述基线，没有推送或部署。原有 `.gitignore`、`AGENTS.md` 修改，`WORKFLOW.md`、`deferred_optimizations.md` 删除，以及未跟踪的 `.md` 均未处理。

## 审阅范围

审阅覆盖当前全库，包括近期提交未修改的代码。四组分别检查前端交互、内容与路由、本地内容工具、构建与部署，子任务继承主线程模型。主线程沿调用链核验候选问题，使用临时仓库和 Chromium 复现，再合并重复项。

覆盖范围包括以下内容：

- `assets/js` 的 12 个 JavaScript 文件和 `assets/css` 的 10 个 CSS 文件。
- `layouts` 的全部 32 个模板，以及 Hugo 和部署配置。
- `content` 的全部 362 个 Markdown 文件的发布属性、路由、链接和资源规则，其中微博有 133 条。
- 本地写作服务、管理界面、内容创建脚本、检查脚本和指标脚本。

正文检查限于发布、链接和渲染规则，没有逐篇润色。About、Dashboard 和搜索均在审阅范围内。Dashboard 的旧图表监听器和动画清理符合当前调用方式，本轮未据此新增问题。

这些数量对应审阅基线。文件清单和内容数量的查询命令如下：

```powershell
rg --files assets/js assets/css layouts scripts
(Get-ChildItem -LiteralPath content -Recurse -Filter '*.md' -File).Count
(Get-ChildItem -LiteralPath content/microblog -Recurse -Filter index.md -File).Count
hugo list all
```

## 本地内容工具

相关实现位于 [microblog-server.js](../../scripts/microblog-server.js)、[microblog-ui.html](../../scripts/microblog-ui.html) 和 [check.ps1](../../scripts/check.ps1)。`applyFrontmatterUpdates()` 更新发布属性，`selectContentItem()` 读取详情，`handleSave()` 保存编辑。

| 编号与级别 | 触发条件及原影响 | 修复与验证结果 |
|---|---|---|
| T01 · P2 | 新建文章与旧稿使用同一目录时，中文被覆盖，空英文输入还会删除英文文件。 | 新建遇到已有目录或冲突网址返回 409。原 HTTP 路由和真实临时 Git 仓库确认中英文旧稿不变。 |
| T02 · P2 | 旧管理入口重建发布属性，丢失 `hidden`、封面和翻译信息。编辑微博还会解除草稿并重写日期。 | 编辑保留原属性，只更新明确提交的字段。未提供的草稿状态和微博日期保持原值，英文文件不会因空输入被删除。HTTP 和 Hugo 验证通过。 |
| T03 · P2 | 发布或删除时，未限定路径的 `git commit` 会夹带无关暂存文件。 | 操作前检查无关暂存，提交限定文章目录。真实临时 Git 验证拒绝操作前不写入，成功提交只包含目标文章。 |
| T04 · P2 | 纽约时区下，日期字符串转为本地时间后倒退一天。微博的本地时区又不符合 `+08:00` 检查规则。 | 文章保留日期字符串，新微博和时钟使用上海时间，编辑保留原发布时间。纽约时区下的 HTTP 测试通过。 |
| T05 · P2 | 标题包含 `$&` 等字符时，`String.replace()` 将输入当作替换指令，破坏发布属性。 | 替换使用回调返回新行。真实 PUT 请求确认特殊字符按字面值保存。 |
| T06 · P2 | `draft: true # not ready` 被读成字符串，界面将草稿误判为已发布，保存后写成 `false`。 | 解析器识别行尾注释和显式布尔标签。无法解析的草稿标记阻止编辑。异常请求后服务健康检查仍返回 200。 |
| T07 · P2 | 旧发布入口未转义标签中的引号和标题中的反斜杠，接口成功后 Hugo 无法解析文件。 | 字符串和标签使用 JSON 编码写入 YAML 或 TOML。引号、反斜杠输入经真实发布和 Hugo 解析通过。 |
| T08 · P2 | 先选 A 再选 B，A 的详情迟到时会覆盖显示，提交目标仍是 B。 | 详情响应核对条目和请求版本，提交核对显示项。Chromium 控制响应顺序后，页面显示 B，提交请求也指向 B。 |
| T09 · P2 | 请求保存 v1 后继续输入 v2，成功响应无条件清除未保存状态。 | 保存响应比较当前字段和请求快照。Chromium 确认磁盘保存 v1 时，v2 仍标为未保存，第二次保存成功。 |
| T10 · P2 | 再次点击当前 Library 条目会重置编辑状态，直接丢弃未保存内容。 | 当前条目点击不重置详情。Chromium 验证编辑内容和未保存提示均保留。 |
| T11 · P2 | 服务接受任意来源的内容请求，也没有写入会话校验。浏览器允许连接回环地址时，其他来源可读写内容。 | 服务限制 `Host` 和 `Origin`，移除任意来源 CORS，写入要求随机会话凭据。外部来源、伪造 Host 和缺少凭据的请求均返回 403。删除入口只接受具体内容项。 |
| T12 · P2 | 未加引号的数字 slug 被 Hugo 数值化，38 条微博的真实网址与工具显示不一致。 | 现有 slug 全部改为字符串，并保留数值化后的真实旧网址。工具生成的网址、133 个落地页和原正文核对通过。地址规则见下文。 |
| T13 · P3 | 发布将图片移入文章目录，管理界面仍请求临时上传目录，预览返回 404。 | 图片按所属文章目录读取，编辑中新上传的图片可从临时目录读取。HTTP 和 Chromium 图片加载验证通过。 |
| T14 · P3 | 文章 Slug 输入框没有加入请求，保存结果始终由英文标题决定。 | 创建请求携带并校验自定义 slug。Chromium 确认请求值和创建目录一致。 |
| T15 · P3 | 发布或删除后，Library 继续复用旧缓存，直到刷新页面才更新。 | 成功响应使列表缓存失效。Chromium 验证新增和删除后的列表。迟到响应保留其他条目的编辑内容，随后仍可保存。 |

T11 的原始复现确认了本机跨来源读写。当前 Chromium 阻止了模拟公共 HTTPS 页面的相关请求，因此原结论不等于任意公网网站都能直接攻击本机服务。

修复复核还验证了以下边界，没有另计为独立问题：

- TOML 新增顶层字段写在首个表之前，已有表内字段保持原样。Hugo 确认新增的 `draft = true` 生效。
- YAML 多行标题替换完整值。折叠、保留换行和去除尾部换行的四种样例均能读取和保存，未知属性保留。
- `!!bool true` 和 `!!bool false` 正确解析。非法草稿值使 `/api/tags` 返回 400，服务继续运行。
- 发布或删除 A 的响应迟到时，B 的选择、请求版本和编辑内容保持不变，B 随后保存成功。

## 内容与路由

| 编号与级别 | 位置、触发条件及原影响 | 修复与验证结果 |
|---|---|---|
| R01 · P2 | [new-microblog.ps1](../../scripts/new-microblog.ps1)、服务创建入口和 [微博 archetype](../../archetypes/microblog/index.md) 使用仅含时间的 slug，不同日期会发布到同一网址。现有四组冲突使八条记录只对应四个页面。 | 新建使用带日期的 slug，并检查网址冲突。现有四条冲突记录获得唯一地址。Hugo 不再报告重复目标，133 条微博对应 133 个页面。 |
| R02 · P2 | 英文微博 HTML 回退到中文内容，但 JSON 和 RSS 只查英文站点。JavaScript 用空 JSON 覆盖页面。 | [microblog-entries.html](../../layouts/partials/microblog-entries.html) 统一三种输出的回退规则。中英文 JSON 各有 133 条，RSS 各有 30 条。Chromium 确认英文页面显示内容。 |
| R03 · P2 | [归档预览](../../layouts/partials/archive-list-items.html) 嵌入文章正文后，相对链接按归档页位置解析，跳到不存在的目录。 | [render-link.html](../../layouts/_default/_markup/render-link.html) 按所属文章和资源解析链接。实际预览指向 `/notes/mlsys-notes-part-i/`。查询参数、片段、资源和外部链接样例通过。 |
| R04 · P2 | [america-symptom 英文正文](../../content/textlab/america-symptom/index.en.md) 的两处链接指向不存在的英文译文。 | 两处链接改指现有中文页 `/textlab/american-dream/`。生成输出和 Chromium 核验通过，没有改写正文措辞。 |
| R05 · P2 | [seo.html](../../layouts/partials/head/seo.html) 将文章内的 `cover.png` 解析成站点根目录图片，分享封面失效。 | 模板优先查文章资源。两种语言的量化文章均指向存在的 `/notes/quantization-tax/cover.png`，Chromium 核验通过。 |
| R06 · P3 | [微博单页](../../layouts/microblog/single.html) 的 newer 和 older 绑定颠倒，导航方向与日期相反。 | 交换 `.NextInSection` 和 `.PrevInSection` 的绑定。逐一检查 133 个页面，相邻链接的日期方向一致。 |
| R07 · P3 | [搜索索引](../../layouts/_default/searchindex.json) 将隐藏子篇计入标签数量，但 [标签页](../../layouts/tags/term.html) 排除这些子篇，出现计数为 1、结果为 0。 | 标签来源与标签页可见性一致，隐藏子篇仍保留正文搜索。Chromium 确认 `dynamic-programming` 不再产生空结果导航，隐藏子篇正文仍在索引中。 |

### Microblog 地址映射

新微博的网址为 `/microblog/YYYYMMDDHHMMSS/`，时间使用上海时区。内容目录仍为 `YYYY/MM/DD-HHMMSS`，slug 必须是带引号的字符串。[check.ps1](../../scripts/check.ps1) 检查重复 slug，并接受保留旧网址的短数字字符串。

133 篇微博仅修改 slug 行，正文未变。全部 129 个原有独立网址保留。38 条原来被数值化的 slug 保留真实已发布地址，例如 `012700` 改为字符串 `"5568"`，继续使用 `/microblog/5568/`。

每组冲突中，按源文件路径排序的首条记录保留旧地址，另一条使用新地址：

| 内容目录 | 原共用地址 | 新独立地址 |
|---|---|---|
| `2025/12/26-120100` | `/microblog/120100/` | `/microblog/20251226120100/` |
| `2025/03/06-164200` | `/microblog/164200/` | `/microblog/20250306164200/` |
| `2025/02/03-154300` | `/microblog/154300/` | `/microblog/20250203154300/` |
| `2024/06/22-034800` | `/microblog/034800/` | `/microblog/20240622034800/` |

## 前端交互

| 编号与级别 | 位置、触发条件及原影响 | 修复与验证结果 |
|---|---|---|
| F01 · P2 | [archive-filter.js](../../assets/js/modules/archive-filter.js) 在离场动画结束前取消筛选时，旧回调失效，重新匹配的条目仍透明且不可点击。 | 重新匹配时清除离场状态。整站 Chromium 连续反转筛选后，6 个条目全部可见，没有残留离场类。 |
| F02 · P2 | 菜单滚动隐藏后，[search-palette.js](../../assets/js/modules/search-palette.js) 打开搜索却保留隐藏状态，输入框在视口外。[menu.js](../../assets/js/modules/menu.js) 也未保护搜索状态。 | 打开搜索清除滚动隐藏，搜索展开期间菜单保持可见。整站 Chromium 和原模块验证了搜索位置、焦点及继续滚动的行为。 |
| F03 · P2 | [microblog.js](../../assets/js/microblog.js) 恢复多列时调用 `pushState()`，返回和前进又触发写入，导致历史循环。 | 恢复过程禁止写入历史。整站 Chromium 验证返回能离开微博页，前进能恢复多列，原模块验证恢复没有历史写入。 |
| F04 · P2 | feed 请求完成前打开年份列，代码用空数据创建列，加载后没有重新填充。 | 年份和标签列等待共享 feed 请求。整站延迟响应测试中，2025 列加载后显示卡片，总数为 95。 |
| F05 · P2 | [layout.css](../../assets/css/layout.css) 在系统深色模式下只切换页脚背景，文字仍深色。显式浅色模式也缺少背景覆盖。 | 背景、文字和签名统一使用主题变量。系统浅深色与 auto、light、dark 的六种组合通过，整站主题切换验证通过。 |

## 构建与部署脚本

| 编号与级别 | 位置、触发条件及原影响 | 修复与验证结果 |
|---|---|---|
| B01 · P2 | [metrics-report.ps1](../../scripts/metrics-report.ps1) 在没有本地报告历史的新副本中，只用当前采样覆盖已提交趋势，30 条缩成 1 条。 | `Get-HistorySeries` 合并已提交 timeline 和本地历史，按 `stamp` 去重，保留最近 30 条。真实脚本验证原 30 条未丢失，34 条合并后保留 30 条，无历史时生成单条。 |
| B02 · P2 | [download-katex.ps1](../../scripts/download-katex.ps1) 下载失败后继续执行，最终退出 0 并输出成功。 | 下载异常立即抛出。注入核心文件或字体下载失败时均退出 1，成功样例退出 0 并生成 23 个文件。 |
| B03 · P3 | [public-asset-audit.ps1](../../scripts/public-asset-audit.ps1) 对无图片的合法目录求和时，在严格模式下访问不存在的 `Sum` 属性并退出。 | 空集合直接返回 0。空目录、无图片目录和含图片目录均通过真实脚本验证。 |

## 验证记录

生产构建使用 Hugo `0.152.2+extended`。输出为中文 317 个 Hugo 页面、英文 141 个 Hugo 页面，没有重复目标。这里的页面数是 Hugo 构建统计，不等于落地 HTML 文件数。

构建命令将生成物和缓存放在系统临时目录，避免写入真实项目的生成目录：

```powershell
$env:HUGO_RESOURCEDIR = Join-Path $env:TEMP 'aki-fix-main-resources'
$env:HUGO_BUILD_NOJSCONFIGINASSETS = 'true'
hugo --minify --noBuildLock --printPathWarnings --destination "$env:TEMP/aki-fix-main-public" --cacheDir "$env:TEMP/aki-fix-main-cache"
```

整合后的独立 Git worktree 执行了以下检查：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/check.ps1 -Audit
```

结果为 `Summary: PASS`，包括 133 条微博检查和资源审计。该脚本会生成 `public_test` 和审计报告，本轮未在真实项目中运行。

真实项目执行了以下只读检查：

```powershell
node --check scripts/microblog-server.js
node scripts/check-content-roundtrip.js
git diff --check
```

JavaScript、UI 内联脚本和 PowerShell 语法检查通过。内容检查确认 362 个文件逐字节往返一致。微博网址检查确认 133 条记录、133 个唯一网址、零个缺失页面，且没有修改 slug 行以外的内容。

所有变异内容写入、删除和 Git 提交均发生在临时仓库。Chromium 测试通过控制请求顺序和延迟核验编辑竞态、返回历史和慢加载。构建脚本分别验证了成功、失败、无历史和空集合路径。

临时验证脚本已删除，测试服务和浏览器已关闭。独立 worktree、构建缓存和测试数据保留在系统临时目录。一次性验证脚本未作为项目测试文件提交。

## 未验证范围

本轮没有验证线上 Vercel 环境、真实远端推送、Git hooks、Firefox、Safari 和实机移动 GPU。KaTeX 下载使用成功与异常请求桩，没有重新访问 CDN。外部链接可用性没有做全面联网检查。

生成目录、第三方资源和历史样稿未作为主要源码逐项审阅。上述通过结果仅对应本次工作区修复，不代表这些未验证范围已通过。
