# Homepage Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 3-column work table with a 2-column, 3-row grid (left: Experience / Project / About; right: Writing / Notes / Microblog), with clickable section title links and auto-populated right column.

**Architecture:** Three files change — `data/homepage.yaml` (data restructure), `layouts/index.html` (template logic), `assets/css/home.css` (grid layout only). All existing item-level styles (`.work-item`, `.work-item-title`, `.work-item-role`, `.work-item-leader`, `.work-item-date`) are reused exactly as-is. Intro section and Now section are not touched.

**Tech Stack:** Hugo (Go templates), CSS Grid, YAML

---

### Task 1: Restructure `data/homepage.yaml`

**Files:**
- Modify: `data/homepage.yaml`

- [ ] **Step 1: Replace the `columns` block with a `grid` block**

In `data/homepage.yaml`, delete the entire `columns:` section and replace it with:

```yaml
grid:
  left:
    - id: experience
      title: Experience
      link: /experience/
      items:
        - title: Artisk
          role: Full-stack AI Engineer Intern
          date: "2024 ~ Present"
          link: "https://gemini.artisk.ai/about"
          preview: "https://images.unsplash.com/photo-1707343843437-caacff5cfa74?q=80&w=600&auto=format&fit=crop"
        - title: Dentist Journey
          role: QA & Test Intern
          date: "2023 ~ 2024"
          link: "https://dentistjourney.com"
        - title: Bear Lab @URochester
          role: Research Assistant
          date: "2023 ~ 2024"
          link: "https://rochester-bear-lab.github.io/"
    - id: projects
      title: Project
      link: /projects/
      items:
        - title: LLM Quant Profiler
          role: Creator
          date: "2024"
          link: "https://github.com/AkikoAkaki/llm-quant-profiler"
        - title: MoodStream
          role: Creator
          date: "2023"
          link: "https://github.com/AkikoAkaki/moodstream"
    - id: about
      title: About
      link: /about/
      sublinks:
        - label: Courses
          link: /about/courses/
        - label: Resume
          link: /about/resume/
        - label: Tools
          link: /about/tools/
        - label: Reading
          link: /about/reading/
  right:
    - id: writing
      title: Writing
      link: /writing/
      sections: [textlab, ideas]
      limit: 3
    - id: notes
      title: Notes
      link: /notes/
      sections: [technical]
      limit: 3
    - id: microblog
      title: Microblog
      link: /microblog/
      sections: [microblog]
      limit: 3
```

Keep `intro:`, `now:`, and `connect:` blocks exactly as they are.

- [ ] **Step 2: Commit**

```bash
git add data/homepage.yaml
git commit -m "data: restructure homepage yaml to 2x3 grid"
```

---

### Task 2: Update `layouts/index.html`

**Files:**
- Modify: `layouts/index.html` (lines 42–73, the `{{/* Work table section */}}` block)

- [ ] **Step 1: Replace the work table section block**

Find and replace the entire section from `{{/* Work table section */}}` through the closing `</section>` tag (currently lines 42–73). Replace with:

```go-html-template
    {{/* Work grid section */}}
    <section class="work-table-section">
        <div class="work-grid">
            {{/* Left column: Experience, Project, About */}}
            <div class="work-column">
                {{- range $cell := $data.grid.left }}
                <div class="work-cell">
                    <h3 class="work-col-title">
                        <a href="{{ $cell.link | relLangURL }}">{{ $cell.title }}</a><span class="work-col-title-arrow">→</span>
                    </h3>
                    {{- if $cell.sublinks }}
                    <div class="work-sublinks">
                        {{- range $cell.sublinks }}
                        <a href="{{ .link | relLangURL }}" class="work-sublink">{{ .label }}</a>
                        {{- end }}
                    </div>
                    {{- else }}
                    <div class="work-items">
                        {{- range $cell.items }}
                        <div class="work-item"{{ if .preview }} data-preview="{{ .preview | relURL }}"{{ end }}>
                            <div class="work-item-title-row">
                                {{- if .link }}
                                <a href="{{ .link | relLangURL }}" class="work-item-title">{{ .title }}</a>
                                {{- else }}
                                <span class="work-item-title">{{ .title }}</span>
                                {{- end }}
                            </div>
                            <div class="work-item-details-row">
                                {{- if .role }}
                                <span class="work-item-role">{{ .role }}</span>
                                {{- end }}
                                <div class="work-item-leader"></div>
                                {{- if .date }}
                                <span class="work-item-date">{{ .date }}</span>
                                {{- end }}
                            </div>
                        </div>
                        {{- end }}
                    </div>
                    {{- end }}
                </div>
                {{- end }}
            </div>

            {{/* Right column: Writing, Notes, Microblog (auto-latest from Hugo) */}}
            <div class="work-column">
                {{- range $cell := $data.grid.right }}
                <div class="work-cell">
                    <h3 class="work-col-title">
                        <a href="{{ $cell.link | relLangURL }}">{{ $cell.title }}</a><span class="work-col-title-arrow">→</span>
                    </h3>
                    <div class="work-items">
                        {{- $pages := where site.RegularPages "Section" "in" $cell.sections }}
                        {{- $pages = sort $pages "Date" "desc" }}
                        {{- $pages = first $cell.limit $pages }}
                        {{- if eq $cell.id "microblog" }}
                            {{- range $pages }}
                            <div class="work-item">
                                <div class="work-item-title-row">
                                    <a href="{{ .RelPermalink }}" class="work-item-title">{{ .Title }}</a>
                                </div>
                                <div class="work-item-details-row">
                                    <span class="work-item-role">{{ .Date.Format "Jan 2, 2006" }}</span>
                                </div>
                            </div>
                            {{- end }}
                        {{- else }}
                            {{- range $pages }}
                            <div class="work-item">
                                <div class="work-item-title-row">
                                    <a href="{{ .RelPermalink }}" class="work-item-title">{{ .Title }}</a>
                                </div>
                                <div class="work-item-details-row">
                                    <span class="work-item-role">{{ .Section | title }}</span>
                                    <div class="work-item-leader"></div>
                                    <span class="work-item-date">{{ .Date.Format "2006" }}</span>
                                </div>
                            </div>
                            {{- end }}
                        {{- end }}
                    </div>
                </div>
                {{- end }}
            </div>
        </div>
    </section>
```

- [ ] **Step 2: Run Hugo and verify no template errors**

```bash
hugo server
```

Expected: server starts, no `ERROR` lines in output. Open `http://localhost:1313` and verify:
- Left column: Experience / Project / About cells stacked vertically
- Right column: Writing / Notes / Microblog cells stacked vertically
- All section titles are rendered as links (they may 404 — that is fine for now)
- Experience and Project items still show role + leader line + date pill
- About cell shows 4 plain sub-links (Courses / Resume / Tools / Reading)

- [ ] **Step 3: Commit**

```bash
git add layouts/index.html
git commit -m "feat: update homepage template to 2x3 grid layout"
```

---

### Task 3: Update `assets/css/home.css`

**Files:**
- Modify: `assets/css/home.css`

- [ ] **Step 1: Change `.work-grid` from 3 columns to 2 columns**

Find:
```css
.work-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 3rem; /* Space between columns */
    width: 100%;
    max-width: 1150px;
    margin: 0 auto;
}
```

Replace with:
```css
.work-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 3rem;
    width: 100%;
    max-width: 1150px;
    margin: 0 auto;
}
```

- [ ] **Step 2: Add new rules for column stacking, title links, and About sub-links**

Insert the following block immediately after the `.work-grid` rule (before `.work-col-title`):

```css
.work-column {
    display: flex;
    flex-direction: column;
    gap: 3.5rem;
}

.work-col-title a {
    color: inherit;
    text-decoration: none;
}

.work-col-title-arrow {
    margin-left: 0.5em;
    opacity: 0.35;
    font-style: normal;
}

.work-sublinks {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem 1.5rem;
}

.work-sublink {
    font-family: var(--font-sans);
    font-size: 0.95rem;
    color: var(--color-heading);
    text-decoration: none;
    position: relative;
    padding-bottom: 2px;
}

.work-sublink::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    height: 1px;
    background: currentColor;
    opacity: 0.5;
}
```

- [ ] **Step 3: Update the responsive breakpoint**

Find:
```css
@media (max-width: 900px) {
    .work-grid {
        grid-template-columns: 1fr;
        gap: 3.5rem;
        max-width: 680px;
    }
}
```

Replace with:
```css
@media (max-width: 900px) {
    .work-grid {
        grid-template-columns: 1fr;
        gap: 3.5rem;
        max-width: 680px;
    }

    .work-column {
        gap: 3rem;
    }
}
```

- [ ] **Step 4: Verify in browser**

With `hugo server` running, open `http://localhost:1313` and check:
- Desktop (viewport > 900px): 2-column grid, each side has 3 cells stacked with spacing
- Resize to < 900px: all 6 cells stack into a single column
- `→` arrow appears to the right of each section title at reduced opacity
- About cell: 4 sub-links rendered with subtle underline
- `.work-item` entries in Experience/Project look identical to before (role, leader dot-line, date pill unchanged)

- [ ] **Step 5: Commit**

```bash
git add assets/css/home.css
git commit -m "style: update work-grid to 2-column layout with cell stacking"
```
