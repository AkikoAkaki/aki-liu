# Repository Structure

This document describes the full structure of the **aki-liu** personal website repository for use by AI-assisted cleanup, refactoring, and technical debt discovery.

> **⚠️ Style Constraint**: Do **not** modify any CSS files (`assets/css/*.css` or `themes/paco/assets/css/*.css`) or the visual design of any layout/template. All cleanup should be logic- and structure-only.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Static site generator | [Hugo](https://gohugo.io/) ≥ 0.112.0 |
| Deployment | [Vercel](https://vercel.com/) (`vercel.json`) |
| Markup | Markdown rendered by Goldmark (hard line breaks enabled, raw HTML allowed) |
| Math | KaTeX (CDN, auto-render on `DOMContentLoaded`) |
| Fonts | Inter (sans-serif), Newsreader (serif) — Google Fonts |
| Theme | Custom inline theme named `paco` (`themes/paco/`) |
| CSS bundling | Hugo `resources.Concat` + `fingerprint` (no Node/build tool) |

---

## Directory Tree

```
aki-liu/
├── archetypes/
│   └── default.md           # Default front matter template for new content
├── assets/
│   └── css/                 # ★ AUTHORITATIVE CSS (overrides themes/paco/assets/css/)
│       ├── base.css          # CSS variables, reset, root font/color tokens
│       ├── layout.css        # Three-column grid, sidebar, footer, responsive breakpoints
│       ├── components.css    # Reusable UI: back-link, writing list, tag sidebar, 404 page
│       ├── home.css          # Homepage-only: intro, work table, now/connect sections
│       └── post.css          # Single post: typography, TOC, code blocks, media, tables
├── content/
│   ├── _index.md            # Site root (title: "Home")
│   ├── cute-things/         # Miscellaneous personal/fun content (not in mainSections)
│   │   ├── index.md
│   │   ├── lxr.mp4          # ⚠️ Binary asset committed to git
│   │   ├── me.png           # ⚠️ Binary asset committed to git
│   │   └── zhizhi.jpg       # ⚠️ Binary asset committed to git
│   ├── engineering/         # Technical writing: CS notes, math, engineering practices
│   │   └── _index.md        # Section front matter (url: /engineering/)
│   ├── insights/            # Reflections on software, industry, personal growth
│   │   ├── _index.md        # Section front matter (url: /insights/)
│   │   └── <slug>/index.md  # Each post is a leaf bundle (one per subdirectory)
│   └── textlab/             # Creative writing & cultural criticism (Chinese-language heavy)
│       ├── _index.md        # Section front matter (type: textlab, url: /textlab/)
│       └── <slug>/index.md  # Each post is a leaf bundle; many have Chinese titles
├── data/
│   └── homepage.yaml        # All homepage content: intro, work table columns, now, connect
├── layouts/
│   ├── 404.html             # Custom 404 page
│   ├── index.html           # Homepage template — reads from data/homepage.yaml
│   ├── _default/
│   │   ├── _markup/
│   │   │   └── render-table.html  # Wraps Markdown tables in .table-wrapper div
│   │   ├── baseof.html      # Base HTML shell: <head>, CSS bundle, KaTeX, three-column layout
│   │   ├── list.html        # Generic section list (insights, engineering): year-grouped
│   │   └── single.html      # Single post: header, TOC sidebar, content, scroll-spy JS
│   ├── partials/
│   │   ├── icons/
│   │   │   └── back-arrow.html  # Reusable back-arrow SVG icon
│   │   └── tag-sidebar.html     # Tag cloud with counts; supports "inline" and "sidebar" variants
│   ├── shortcodes/
│   │   └── localvideo.html  # Renders local video assets (page bundle resources or static/)
│   ├── tags/
│   │   └── term.html        # Tag taxonomy page: lists posts, back-links to owning section
│   └── textlab/
│       └── list.html        # Textlab section list (same structure as _default/list.html)
├── static/
│   └── .nojekyll            # Prevents GitHub Pages from treating the site as Jekyll
├── themes/
│   └── paco/
│       └── assets/
│           └── css/         # ⚠️ Duplicate of assets/css/ — NEVER loaded (overridden by root assets/)
│               ├── base.css
│               ├── components.css
│               ├── home.css
│               ├── layout.css
│               └── post.css
├── public/                  # ⚠️ Build output — should NOT be committed (see Known Issues)
├── .gitignore
├── archetypes/default.md
├── hugo.toml                # Hugo configuration
├── vercel.json              # Vercel build configuration
└── REPO_STRUCTURE.md        # This file
```

---

## Content Sections

| Section | URL | `type` | In `mainSections` | Description |
|---|---|---|---|---|
| `insights/` | `/insights/` | (default) | ✅ | English-language reflections on software, productivity, industry |
| `engineering/` | `/engineering/` | (default) | ✅ | Technical notes, CS/math writing |
| `textlab/` | `/textlab/` | `textlab` | ✅ | Creative writing, cultural criticism (mostly Chinese) |
| `cute-things/` | `/cute-things/` | (default) | ❌ | Personal/miscellaneous content with media assets |

All posts use [leaf bundles](https://gohugo.io/content-management/page-bundles/) (a subdirectory with `index.md`).

---

## Layout System

### Template Lookup (Hugo precedence: project > theme)

1. `layouts/index.html` — homepage
2. `layouts/textlab/list.html` — textlab section list (overrides default)
3. `layouts/_default/list.html` — all other section lists
4. `layouts/_default/single.html` — all single posts
5. `layouts/tags/term.html` — tag taxonomy pages
6. `layouts/404.html` — 404 page
7. `layouts/_default/baseof.html` — base shell wrapping every page

### Page Blocks (defined in `baseof.html`)

| Block | Purpose |
|---|---|
| `main` | Primary content area (center column) |
| `sidebar-right` | Right sidebar (tag cloud on list pages; TOC on post pages) |

### Three-Column Grid

```
[.site-sidebar (left)] | [.site-main (center, 650px)] | [.site-sidebar-right (right)]
```

- Left sidebar is always empty (reserved for future use).
- Right sidebar: tag cloud on section lists, sticky TOC on posts.
- Collapses to single column at ≤ 768 px; right sidebar hidden on mobile.

---

## CSS Architecture

All CSS lives in `assets/css/` and is bundled at build time:

```
baseof.html → resources.Concat([base, layout, components, home, post]) → css/bundle.<hash>.css
```

| File | Responsibility |
|---|---|
| `base.css` | CSS custom properties (color, font, spacing tokens); resets; dark-mode overrides |
| `layout.css` | `.site-container` grid, sidebar, footer, all responsive breakpoints |
| `components.css` | `.title-with-back`, `.writing-list`/`.writing-item`, `.tag-sidebar`, `.not-found` |
| `home.css` | `.home-container`, `.intro`, `.work-table`, `.now-section`, `.connect-section` |
| `post.css` | `.post-single`, `.post-toc`, `.post-content` (typography, code, images, tables, lists, footnotes) |

**Do not modify any CSS.** The files in `themes/paco/assets/css/` are identical copies that are never loaded (Hugo's asset lookup finds `assets/css/` first).

---

## Data Files

### `data/homepage.yaml`

Controls 100% of the homepage content (excluding footer). Sections:

| Key | Description |
|---|---|
| `intro.name` | Author name |
| `intro.tagline` | Italic tagline in the first bio paragraph |
| `intro.bio[]` | Array of bio paragraphs (HTML allowed) |
| `columns[]` | Work table columns: `id`, `title`, `cssClass`, `items[{title, desc, link}]` |
| `now.title` / `now.paragraphs[]` | "Now" section |
| `connect.title` / `connect.paragraphs[]` | "Connect" section |

---

## Hugo Configuration (`hugo.toml`)

| Setting | Value | Notes |
|---|---|---|
| `baseURL` | `/` | Relative — works with Vercel's domain injection |
| `theme` | `paco` | Points to `themes/paco/` |
| `mainSections` | `['insights', 'engineering', 'textlab']` | Drives RSS feed and taxonomy pages |
| `params.enableKaTeX` | `true` | Loads KaTeX CSS+JS from CDN |
| `markup.goldmark.renderer.unsafe` | `true` | Allows raw HTML in Markdown |
| `markup.goldmark.renderer.hardLineBreak` | `true` | Newlines render as `<br>` |
| `markup.highlight.noClasses` | `false` | Uses CSS classes for syntax highlighting (Monokai style) |

---

## Known Issues & Technical Debt

### 🔴 Critical

| # | File | Issue |
|---|---|---|
| 1 | `public/` | Build artifact committed to git. `.gitignore` lists `/public/` but it was added before the ignore rule. Run `git rm -r --cached public/` to untrack. |
| 2 | `.hugo_build.lock` | Build lock file committed to git. `.gitignore` lists `.hugo_build.lock` but the file is tracked. Run `git rm --cached .hugo_build.lock` to untrack. |

### 🟡 Medium

| # | File | Issue |
|---|---|---|
| 3 | `data/homepage.yaml` (line 38) | The "Engineering" work-table entry links to `/notes/` but the actual section URL is `/engineering/`. This is a **broken internal link**. |
| 4 | `layouts/_default/baseof.html` (line 51) | `{{ $writingSection := .Site.GetPage "section" "writing" }}` — this variable is assigned but never referenced. Dead code. |
| 5 | `layouts/_default/baseof.html` (lines 46–50) | `$nav`, `$homeLabel`, and `writingLabel` (from `hugo.toml`) are computed but `$homeLabel` is never used in the template output. Confusing dead code. |
| 6 | `layouts/textlab/list.html` (lines 4–8) | Back-arrow SVG is inlined instead of using the existing `{{ partial "icons/back-arrow.html" . }}` partial. Duplicate code. |
| 7 | `themes/paco/assets/css/*.css` | Five CSS files are exact duplicates of `assets/css/*.css` and are **never loaded** by Hugo (root `assets/` takes precedence). The theme's CSS directory can be deleted without any effect. |

### 🟢 Low / Nice-to-have

| # | File | Issue |
|---|---|---|
| 8 | `content/cute-things/lxr.mp4` | A ~365 KB binary video file is committed to git. Binary assets are better served from a CDN or object storage. |
| 9 | `layouts/textlab/list.html` | Nearly identical to `layouts/_default/list.html` (only differs in back-link and absence of `{{ if eq $page.Kind "page" }}` guard). Could be consolidated into a shared partial. |
| 10 | `layouts/_default/list.html` | Has `{{ if eq $page.Kind "page" }}` guard inside the loop, but `textlab/list.html` does not. Inconsistency — may cause section index pages to appear in the textlab list. |
| 11 | `hugo.toml` | `writingLabel = 'Writing'` under `[params.navigation]` is defined but never read by any template. |
| 12 | `content/engineering/` | The section has an `_index.md` but no posts (the directory is empty aside from the index). The section still renders as an empty list page. |

---

## Vercel Deployment

```json
{
  "build": { "env": { "HUGO_VERSION": "0.139.0" } },
  "buildCommand": "hugo --gc --minify",
  "outputDirectory": "public",
  "framework": "hugo"
}
```

Hugo version pinned to **0.139.0** in Vercel, while `hugo.toml` only requires ≥ 0.112.0.
