# Homepage Redesign — Design Spec
**Date:** 2026-05-14  
**Branch:** search-bar-redesign  
**Scope:** Homepage only. Sub-pages (Experience detail, Projects detail, About, Writing umbrella, etc.) are deferred to future brainstorming sessions.

---

## Goal

The current homepage has a 3-column work table (Experience, Project, Writing) where column items link to external pages but the columns themselves have no section-level link. Visitors cannot tell that there are dedicated section pages for Experience, Projects, Writing, Notes, Microblog, or About. The redesign makes every section discoverable and clickable from the homepage without adding noise.

---

## Homepage Structure (final)

Three sections, in order:

1. **Intro** — unchanged. SVG name + bio text.
2. **Work grid** — the 3-column table becomes a 2-column, 3-row grid.
3. **Now section** — the three expandable "More about me" cards, kept as-is for now.

---

## Work Grid Spec

### Layout

```
Left column          |  Right column
─────────────────────────────────────
Experience     →     |  Writing      →
Project        →     |  Notes        →
About          →     |  Microblog    →
```

- CSS grid: `grid-template-columns: 1fr 1fr`, `grid-template-rows: repeat(3, auto)`
- **No dividers** — no border between rows, no border between columns. Spacing only.
- Each cell is a self-contained block: section title + list of items below.

### Clickability

Every section title (Experience, Project, About, Writing, Notes, Microblog) becomes a link pointing to its section page. A subtle `→` sits to the right of each title on the same baseline. Styling: same italic/small-caps treatment as current column headers, underline on hover.

### Cell content

| Cell | Content | Source |
|---|---|---|
| Experience | 2–3 most recent entries (title, role, date) — same as current | `homepage.yaml` → `columns[experience]` |
| Project | 2–3 most recent entries (title, role, date) — same as current | `homepage.yaml` → `columns[projects]` |
| About | Sub-links row: Courses · Resume · Tools · Reading (and others as added later) | `homepage.yaml` → new `about.sublinks` list |
| Writing | Auto-latest 3 posts from textlab + ideas sections combined, sorted by date | Hugo: `site.RegularPages` filtered by section |
| Notes | Auto-latest 2–3 posts from technical section (to be renamed `/notes/`) | Hugo: `site.RegularPages` filtered by section |
| Microblog | Auto-latest 2–3 microblog entries (title/date or short excerpt) | Hugo: `site.RegularPages` filtered by section |

Writing auto-list shows: post title + section tag (Essay / Textlab) + date.  
Notes auto-list shows: post title + date.  
Microblog auto-list shows: date + first ~80 chars of content.

### About sub-links

Rendered as a horizontal (or wrapped) list of underlined links, smaller than the section title, no role/date columns. Placeholders for now: `Courses`, `Resume`, `Tools`, `Reading`. New sub-links can be added by editing `homepage.yaml` without touching templates.

---

## Data Model Changes (`homepage.yaml`)

Current `columns` list (3 items) is replaced by a `grid` structure:

```yaml
grid:
  left:
    - id: experience
      title: Experience
      link: /experience/
      items: [ ... same as before ... ]
    - id: projects
      title: Project
      link: /projects/
      items: [ ... same as before ... ]
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
      autoLatest: true
      section: [textlab, ideas]
      limit: 3
    - id: notes
      title: Notes
      link: /notes/
      autoLatest: true
      section: [technical]
      limit: 3
    - id: microblog
      title: Microblog
      link: /microblog/
      autoLatest: true
      section: [microblog]
      limit: 3
```

Auto-latest cells (`autoLatest: true`) ignore `items` and instead query Hugo's page collection at render time.

---

## Template Changes (`layouts/index.html`)

- Replace the `work-table-section` block with a new `work-grid-section` block.
- Left column: iterate `$data.grid.left`. For `about` cell, render `sublinks` as a link row instead of item list.
- Right column: iterate `$data.grid.right`. For `autoLatest` cells, use Hugo `where` to fetch pages from the specified sections, sorted by date, limited to `limit`.
- Section title renders as `<a href="{{ $cell.link }}">{{ $cell.title }}</a>` with a `→` span.

---

## CSS Changes (`assets/css/home.css`)

- `.work-grid` changes from `grid-template-columns: 1fr 1fr 1fr` to `grid-template-columns: 1fr 1fr`.
- Each left/right column is itself a flex column of cells stacked vertically.
- No borders added. Existing `.work-item` spacing rules apply within each cell.
- `.work-col-title` gains an `<a>` wrapper; underline shown on hover only.
- Add `.work-col-title-arrow` for the `→` glyph: `opacity: 0.4`, no transition needed.
- Add `.work-sublinks` for the About cell: `font-size: smaller`, `display: flex`, `gap: 1rem`, `flex-wrap: wrap`.

---

## What Does NOT Change

- Intro section (SVG name + bio)
- "More about me" / Now section (three expandable cards) — kept exactly as-is
- Footer / Connect section
- Individual item links within Experience and Project cells
- All existing content files

---

## Out of Scope (future sessions)

- `/experience/` list page and individual experience sub-pages
- `/projects/` list page and individual project sub-pages
- `/writing/` umbrella page
- `/about/` page and its sub-pages (Courses, Tools, Reading, etc.)
- Renaming `/technical/` to `/notes/`
- Notes and Microblog section pages themselves
