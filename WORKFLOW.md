# Site Authoring Workflow

## Preview and build

```powershell
hugo server -D --disableFastRender   # live preview with drafts at http://localhost:1313
hugo --gc --minify                   # production build into public/
```

`public/` and `public_test/` are build output. Never commit them. If one is staged, run `git restore --staged public/ public_test/`; if one was committed, remove it with `git rm --cached`.

## New content

Every section uses leaf bundles: `content/<section>/<slug>/index.md`, with the page's images and videos in the same folder. A flat `content/notes/my-slug.md` cannot hold assets.

```powershell
hugo new content notes/my-slug/index.md      # Chinese (default language)
hugo new content notes/my-slug/index.en.md   # English translation in the same bundle
```

The translation takes its slug and URL from the bundle directory.

## Microblog

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\new-microblog.ps1
```

Options: `-At "2026-06-12T10:10:10"` (default: now in Asia/Shanghai), `-Tags tag1,tag2`, `-Draft`. The script creates `content/microblog/YYYY/MM/DD-HHMMSS/index.md` and runs no git commands. `hugo new content microblog/2026/06/12-101010` writes the same file.

The directory must keep the `YYYY/MM/DD-HHMMSS` shape, because the date and the slug derive from it. New entries get the URL `/microblog/YYYYMMDDHHMMSS/`; older entries keep their short slugs.

```yaml
---
date: 2026-06-12T10:10:10+08:00
slug: "20260612101010"
tags: []
draft: false
---
```

## Media

- `![alt text](image.jpg)`: the render-image hook converts the image to WebP.
- `{{< figure src="image.jpg" alt="alt text" caption="Caption." >}}`: a bundle image with a caption.
- `{{< localvideo src="clip.mp4" >}}`: a bundle video.

About-page images use their own Hugo Pipes pipeline. Do not copy it to other pages.

## Drafts

`draft: true` holds a page back. Only `-D` (`--buildDrafts`) builds drafts, and Vercel does not pass it, so drafts are safe to push. Set `draft: false` before the final commit, or the page stays invisible in production.

## Before pushing

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\check.ps1   # add -Audit for output sizes
```

The check builds `public_test/`, warns about staged build output, and validates microblog paths and frontmatter. `-Audit` also prints the total size of images, CSS, JS, HTML and search indexes, and the ten largest files. It does not detect unused files.

If the change touches fixed elements, the footer or page-level `overflow`, also run `node scripts/edge-check.mjs` on the same build. It needs Node 22+ and Chrome or Edge, and prints `PASS` or the failing page and step. It simulates Safari, so confirm a mobile layout fix on a real iPhone.

Review the branch's Vercel preview URL before merging.

## Metrics

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\metrics-report.ps1
```

Run it after committing code changes. It builds into a temp directory, rewrites `data/metrics/latest.json`, and appends one point to `data/metrics/history_timeline.json`, which keeps the last 30. The dashboard reads only these two files, so commit them to publish the snapshot. Hugo and Vercel builds measure nothing.

- Build time is one local `hugo --gc --minify` run with the existing resource cache, not a cold or repeated benchmark.
- Cache reuse share divides cached calls by all template calls, from a separate `--templateMetrics` run.
- Page asset sizes count the local stylesheets and scripts that the initial HTML references, including vendor files under `/lib/`. Inline, remote and runtime-loaded code is excluded. Gzip figures compress each file separately.
- The asset baseline is the `data/metrics/latest.json` at the local `origin/main` ref. The script fetches nothing.
- Generated pages include archives and tag pages, so the count is not an article count.
- The script stops without writing if the Git revision or status changes during the run.
