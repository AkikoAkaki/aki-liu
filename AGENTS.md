# AGENTS.md

## Memory

Your memory is OptMem:
- The tool is `I:\Projects\aki-liu\.optmem\memo`
- Your memories are in `I:\Projects\aki-liu\.optmem\memory`

OptMem outlives every session, compaction, model and vendor change.
Without it you do not know who you are, or what was decided and tried.

### At startup: activating OptMem (mandatory)

Run `I:\Projects\aki-liu\.optmem\memo wake` before any other tool call, in every session, and
then do exactly what it prints, to the end of its output.

### While working: register memories (mandatory)

Call `I:\Projects\aki-liu\.optmem\memo note "<1 line, max 280 bytes>"` whenever you learn
something new, or something worth keeping happens. That covers a task
worth real effort, a fact or insight the user teaches you, anything you
learn about their life (even indirectly), any event of lasting effect.

Do not register redundant memories.

If `I:\Projects\aki-liu\.optmem\memo note` asks a compression: do it before your next action.

Never edit or delete anything under `I:\Projects\aki-liu\.optmem\memory`: the tool manages it.

### When you need an old memory: search, or navigate

`I:\Projects\aki-liu\.optmem\memo recall <regex>` searches every memory, word for word.

Your memories also form a binary tree: #0-1, #2-3 ... exist as one-line
summaries, pairs of those as #0-3, and so on -- every `#a-b` line wake
prints is one node of it. `I:\Projects\aki-liu\.optmem\memo zoom <a-b>` opens a node into its
two halves, down to the raw memories.

### If you're a subagent: skip everything above

Parallel sessions on this machine are all you, and may all write memories.
A subagent is not: it must never run `memo`, because it cannot judge what
is already known, and its notes would arrive duplicated and incorrectly.
When you spawn one, write: `You are a subagent. Don't run memo.`

## Build & run

```powershell
hugo serve --disableFastRender
hugo --gc --minify           # production build → public/
```

No `npm`, `Node.js`, or package manager needed. Hugo handles CSS/JS bundling internally.

## Project structure

- **Multilingual**: Chinese is default (`zh`), English uses `index.en.md` alongside `index.md`. Content filenames are always Chinese; English translations live in the same directory.
- **Content sections** (`content/`): `ideas/`, `notes/`, `textlab/`, `influences/`. All use the same `list.html` template with the 3-column archive layout (sidebar-left → main → sidebar-right with hover preview).
- **Homepage**: Driven by `data/homepage.yaml`, not markdown. Template: `layouts/index.html`.
- **CSS pipeline**: Global bundle concatenates `base.css` → `layout.css` → `components.css` → `motion.css` → `search.css`. Homepage loads `home.css`; single pages load a `post.css` + `syntax-highlight.css` page bundle; microblog and dashboard CSS are route-conditional. All are processed via Hugo Pipes (`resources.Concat` + `resources.Minify` where applicable).
- **JS**: `assets/js/main.js` is the global entrypoint built via Hugo's `js.Build`; `assets/js/microblog.js` is a second entrypoint loaded only on the microblog section list. No external bundler.

## Conventions

- **Images**: Non-SVG/GIF images are auto-converted to WebP via the custom render-image hook (`layouts/_default/_markup/render-image.html`). Use the `figure` shortcode for page-bundle images that need captions.
- **Video**: Use `localvideo` shortcode with page-bundle assets.
- **KaTeX**: Enabled globally but only rendered on pages with `enableKaTeX: true` or `math: true` frontmatter (see `layouts/partials/head/katex.html`).
- **Tags**: Defined in frontmatter as `tags: ["tag-name"]`. Rendered via `/tags/<name>/` using `layouts/tags/term.html`.
- **Archive preview**: Hover previews come from one fingerprinted JSON per language (`layouts/partials/archive-preview-index.html`, first 800 characters of each page). `assets/js/modules/archive-preview.js` fetches it the first time the pointer enters a list and loads KaTeX only for previews with math.
- **Fonts**: Switzer is served locally from `/static/fonts/switzer/` (paid). Newsreader and JetBrains Mono loaded from Google Fonts.
- **Goldmark**: `unsafe = true` (HTML in markdown), `hardLineBreak = true`.
- **Drafts**: Set `draft: true` in frontmatter; Hugo only publishes them with `--buildDrafts`.

## Creating content

```powershell
hugo new content ideas/my-slug/index.md
```

Use the same leaf-bundle pattern for `notes/`, `textlab/`, and `influences/`.

```powershell
hugo new content ideas/my-slug/index.en.md
```

Create the English translation in the same bundle by using the filename suffix.

```powershell
hugo new content microblog/2026/06/12-101010
```

Microblog directories must be `YYYY/MM/DD-HHMMSS`; the slug and public URL derive from that directory.

`microblog.cmd` opens the local composer console; publishing from that console commits and pushes to the current branch.

Use `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\new-microblog.ps1` as the safe file-only microblog alternative with no commit or push.

See `WORKFLOW.md` for the human authoring, preview, microblog, media, metrics, and publishing workflow.

## Quality & metrics

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\metrics-report.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\check.ps1
```

Generates build timing, template performance, broken link checks, and HTML quality reports in `reports/metrics/`. The check script runs a local pre-push smoke check against `public_test/`.

## Deployment

Vercel — configured in `vercel.json`. Build command sets `--baseURL` from the env var. Hugo version pinned to `0.152.2`.

## Key files

| Purpose | Path |
|---|---|
| Hugo config | `hugo.toml` |
| Homepage data | `data/homepage.yaml` |
| Base layout | `layouts/_default/baseof.html` |
| CSS bundle entrypoints | `layouts/partials/head/core-assets.html`, `assets/css/base.css`, `layout.css`, `components.css`, `motion.css`, `search.css` |
| JS entrypoints | `assets/js/main.js`, `assets/js/microblog.js` |
| Deferred decisions | `deferred_optimizations.md` |
| Claude local config | `.claude/settings.local.json` |
