# Site Authoring Workflow

---

## 1. Quick start

```powershell
hugo server -D --disableFastRender
```

Opens a live preview at `http://localhost:1313`. The `-D` flag includes drafts.

---

## 2. Local preview

```powershell
# Include drafts
hugo server -D --disableFastRender

# Production-equivalent (no drafts, minified)
hugo --gc --minify
```

`public/` is the build output directory. Do not commit it.

---

## 3. Creating a normal article

All content sections (`ideas/`, `notes/`, `textlab/`, `influences/`) use the same leaf-bundle pattern.

```powershell
hugo new content ideas/my-slug/index.md
```

This creates `content/ideas/my-slug/index.md` using the archetype for that section. Edit frontmatter, write content, add assets into the same bundle directory.

---

## 4. Creating an English translation

Create the translation file alongside the Chinese `index.md` in the same bundle:

```powershell
hugo new content ideas/my-slug/index.en.md
```

The slug and URL are inherited from the bundle directory. The archetype pre-fills a matching frontmatter stub.

---

## 5. Creating a microblog entry (safe method)

Use the dedicated script. It creates files only and does nothing with git.

```powershell
# Now (uses current Asia/Shanghai time)
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\new-microblog.ps1

# At a specific time
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\new-microblog.ps1 -At "2026-06-12T10:10:10"

# With tags
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\new-microblog.ps1 -Tags tag1,tag2

# As a draft
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\new-microblog.ps1 -Draft
```

Output: `content/microblog/YYYY/MM/DD-HHMMSS/index.md`

Public URL is `/microblog/HHMMSS/`.

Frontmatter shape produced:

```yaml
---
date: 2026-06-12T10:10:10+08:00
slug: "101010"
tags: []
draft: false
---
```

Alternatively, use the archetype directly:

```powershell
hugo new content microblog/2026/06/12-101010
```

Either way, no git operations are performed.

---

## 6. Microblog console

```powershell
.\microblog.cmd
```

Opens a local composer console. **Caution: publishing from this console commits and pushes to the current branch immediately.** It does not stage for review. Do not use this on `main` unless you intend to push directly.

Use the script in section 5 when you want to write, review, and commit on your own schedule.

---

## 7. Images and media

**Standard images** (Markdown syntax):

```markdown
![alt text](image.jpg)
```

The render-image hook converts these to WebP automatically. No extra steps.

**Page-bundle images with captions** (use the shortcode):

```markdown
{{< figure src="image.jpg" alt="alt text" caption="Caption text here." >}}
```

**Videos** (page-bundle assets only):

```markdown
{{< localvideo src="clip.mp4" >}}
```

**About-page images** run through a separate Hugo Pipes pipeline. Do not try to replicate that pattern elsewhere.

**Do not commit assets to** `public/` **or** `public_test/`. These are build artifacts.

---

## 8. Drafts and publishing

Set `draft: true` in frontmatter to hold a piece back:

```yaml
draft: true
```

Hugo only builds drafts when invoked with `-D` / `--buildDrafts`. Vercel's production build does not use `-D`, so drafts are safe to push.

To publish: change `draft: false` (or remove the field) before committing.

---

## 9. Before pushing / before merging

- Check that `public/` is not staged (`git status`).
- Check that `public_test/` is not staged.
- Check that any test content created during scripting is not staged.
- Run a local production build and eyeball it:

```powershell
hugo --gc --minify
```

- Check the Vercel preview deployment before merging a PR. Vercel generates a preview URL for every push to a branch. Review it before hitting merge.

---

## 10. Metrics and asset audits

**Metrics report** (build timing, template performance, broken links, HTML quality):

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\metrics-report.ps1
```

Output lands in `reports/metrics/`. These files are tracked in git as history.

**Asset audit** (public directory inventory):

```powershell
hugo --gc --minify --destination public_test
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\public-asset-audit.ps1 -PublicDir .\public_test
```

Run this against a local build output. Do not commit `public_test/`.

---

## 11. Recommended workflows

### Normal article workflow

1. `hugo new content ideas/my-slug/index.md`
2. Write in `content/ideas/my-slug/index.md`. Add assets to same directory.
3. `hugo server -D --disableFastRender` to preview.
4. If translating: `hugo new content ideas/my-slug/index.en.md`
5. When ready: set `draft: false`.
6. Commit the bundle directory only.
7. Push branch, check Vercel preview, then merge.

### Microblog safe workflow

1. `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\new-microblog.ps1`
2. Open the generated file, write the post.
3. `hugo server -D --disableFastRender` to preview.
4. When ready: confirm `draft: false` in frontmatter.
5. `git add content/microblog/...` (stage only the new bundle).
6. Commit and push normally.

### Content-heavy / media-heavy workflow

1. Create the bundle with `hugo new content`.
2. Drop images and videos into the bundle directory.
3. Use `figure` shortcode for captioned images, `localvideo` for video.
4. Preview locally: `hugo server -D --disableFastRender`.
5. Run the asset audit after a local build to catch orphaned files:

```powershell
hugo --gc --minify --destination public_test
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\public-asset-audit.ps1 -PublicDir .\public_test
```

6. Commit only `content/` assets. Do not commit `public/` or `public_test/`.

---

## 12. Common mistakes / footguns

| Mistake | What happens | Fix |
|---|---|---|
| Running `.\microblog.cmd` on `main` and publishing | Commits and pushes directly to `main` | Use `new-microblog.ps1` instead; commit manually |
| Committing `public/` | Build artifacts in git history; Vercel ignores it anyway | First use `git restore --staged public/ public_test/`; if artifacts were already committed, use `git rm --cached` |
| Using a flat path `content/ideas/my-slug.md` instead of a bundle | Images and assets cannot co-locate; shortcodes may break | Always use `content/ideas/my-slug/index.md` |
| Forgetting to set `draft: false` | Post is invisible in production, even after pushing | Check frontmatter before the final commit |
| Wrong microblog directory name format | Hugo cannot derive the slug; URL breaks | Directory must be `YYYY/MM/DD-HHMMSS`; use the script |
| Missing `slug` field in microblog frontmatter | Public URL falls back to directory name instead of time | The script sets this automatically; double-check if hand-crafting |
| Checking Vercel preview after merging | Regressions caught too late | Always review the preview URL on the branch before merging |
