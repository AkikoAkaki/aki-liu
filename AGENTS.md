# AGENTS.md

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
- **Archive preview**: List pages embed full `.Content` in hidden `<div class="item-preview-data">` elements for the hover preview panel. This means list pages grow linearly with article count — if you need to reduce payload, see `deferred_optimizations.md`.
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
```

Generates build timing, template performance, broken link checks, and HTML quality reports in `reports/metrics/`.

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
