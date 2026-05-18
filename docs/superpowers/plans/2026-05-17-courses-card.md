# Courses Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a clickable Courses card to the about page pinboard that shows the current semester's courses and links to `/about/courses/`.

**Architecture:** New `.af-courses-card` CSS class added alongside existing pinboard card styles in `components.css`. Card HTML added to the pinboard canvas in `layouts/about/list.html`. The target page (`content/about/courses/index.md`) already exists and just needs its content structured properly.

**Tech Stack:** Hugo (static site generator), vanilla CSS, no JS needed.

---

## File Map

| File | Action | What changes |
|------|--------|-------------|
| `assets/css/components.css` | Modify | Add `.af-courses-card` and sub-element styles after the `.af-cv-card` block (~line 1287) |
| `layouts/about/list.html` | Modify | Add courses card `<a>` element inside `.af-pinboard-canvas` div |
| `content/about/courses/index.md` | Modify | Structure content with semester heading |
| `content/about/courses/index.en.md` | Modify | Mirror structure in English |

---

## Task 1: Add CSS for the Courses Card

**Files:**
- Modify: `assets/css/components.css` (after the `.af-cv-card` block, around line 1287)

- [ ] **Step 1: Add the CSS block**

Open `assets/css/components.css`. Find the closing brace of `.af-cv-card-pdf` (around line 1286). Add the following immediately after:

```css
/* Courses card */
.af-courses-card {
    position: absolute;
    width: 160px;
    background: var(--bg-color);
    border: 1px solid var(--color-divider);
    padding: 12px 12px 10px 18px;
    box-shadow: 0 14px 28px rgba(0,0,0,0.05);
    text-decoration: none;
    color: inherit;
    display: block;
    transition: transform .4s cubic-bezier(0.16, 1, 0.3, 1), box-shadow .25s ease;
}
.af-courses-card:hover {
    transform: translateY(-4px) rotate(0deg) !important;
    box-shadow:
        0 4px 8px rgba(0,0,0,0.06),
        0 28px 48px rgba(0,0,0,0.10);
}
.af-courses-card-punch {
    position: absolute;
    top: 20px;
    left: -9px;
    width: 18px;
    height: 18px;
    background: #f5f4f2;
    border-radius: 50%;
    border: 1px solid rgba(0,0,0,0.09);
    z-index: 1;
}
.af-courses-card-header {
    display: flex;
    justify-content: space-between;
    font: 700 7.5px/1 var(--font-sans);
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--color-muted);
    margin-bottom: 8px;
}
.af-courses-card-list {
    border-top: 1px solid var(--color-divider);
    padding-top: 8px;
    display: flex;
    flex-direction: column;
    gap: 5px;
}
.af-courses-card-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 6px;
}
.af-courses-card-code {
    font: 500 7.5px/1 var(--font-sans);
    letter-spacing: 0.04em;
    color: var(--color-muted);
    white-space: nowrap;
}
.af-courses-card-name {
    font: 400 8.5px/1.2 var(--font-sans);
    color: var(--color-heading);
    text-align: right;
}
.af-courses-card-footer {
    margin-top: 10px;
    border-top: 1px solid var(--color-divider);
    padding-top: 6px;
    font: 700 7px/1 var(--font-sans);
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--color-muted);
}
```

- [ ] **Step 2: Commit**

```bash
git add assets/css/components.css
git commit -m "feat: add af-courses-card CSS styles"
```

---

## Task 2: Add the Card to the Pinboard

**Files:**
- Modify: `layouts/about/list.html` (inside `.af-pinboard-canvas`, after the `.af-cv-card` div, around line 299)

- [ ] **Step 1: Add the card HTML**

Open `layouts/about/list.html`. Find the closing `</div>` of `.af-cv-card` (the one containing `af-cv-card-pdf`, around line 299). Add the following immediately after it, before the closing `</div>` of `.af-pinboard-canvas`:

```html
<a class="af-courses-card reveal-pin" href="/about/courses/" style="top:148px;left:352px; --pin-rot:-3deg; --reveal-delay: 400ms">
  <div class="af-courses-card-punch"></div>
  <div class="af-courses-card-header">
    <span>Spring 2026</span>
    <span>5 courses</span>
  </div>
  <div class="af-courses-card-list">
    <div class="af-courses-card-row">
      <span class="af-courses-card-code">CSC 254</span>
      <span class="af-courses-card-name">PL Design</span>
    </div>
    <div class="af-courses-card-row">
      <span class="af-courses-card-code">CSC 282</span>
      <span class="af-courses-card-name">Algorithms</span>
    </div>
    <div class="af-courses-card-row">
      <span class="af-courses-card-code">CSC 280</span>
      <span class="af-courses-card-name">Models & Limits</span>
    </div>
    <div class="af-courses-card-row">
      <span class="af-courses-card-code">MATH 282</span>
      <span class="af-courses-card-name">Complex Analysis</span>
    </div>
    <div class="af-courses-card-row">
      <span class="af-courses-card-code">CSC 299W</span>
      <span class="af-courses-card-name">Social &amp; Computing</span>
    </div>
  </div>
  <div class="af-courses-card-footer">All courses →</div>
</a>
```

- [ ] **Step 2: Verify Hugo builds without error**

Run Hugo's local server and open the about page:
```bash
hugo server
```
Navigate to `http://localhost:1313/about/`. Expected: page builds, courses card appears in the pinboard at the correct position, slightly left-tilted.

- [ ] **Step 3: Check hover and click**

Hover over the card. Expected: card lifts 4px and straightens to `rotate(0deg)`.  
Click the card. Expected: navigates to `/about/courses/`.

- [ ] **Step 4: Adjust position if needed**

If the card overlaps awkwardly with existing cards, tweak `top` and `left` in the `style` attribute. The pinboard is intentionally layered so some overlap is fine. The canvas is `max-width: 680px` and `height: min(620px, calc(100vh - 164px))`. Keep the card fully within these bounds.

- [ ] **Step 5: Commit**

```bash
git add layouts/about/list.html
git commit -m "feat: add courses card to about pinboard"
```

---

## Task 3: Structure the Courses Page Content

**Files:**
- Modify: `content/about/courses/index.md`
- Modify: `content/about/courses/index.en.md`

- [ ] **Step 1: Update the Chinese version**

Replace `content/about/courses/index.md` with:

```markdown
---
title: "Courses"
date: 2026-05-15
weight: 1
draft: false
---

这里记录我在罗切斯特大学修过的所有课程。

## Spring 2026

- **CSC 254** · Programming Language Design & Implementation
- **CSC 282** · Design & Analysis of Efficient Algorithms
- **CSC 280** · Computer Models & Limitations
- **MATH 282** · Intro to Complex Analysis
- **CSC 299W** · Social Implications of Computing
```

- [ ] **Step 2: Update the English version**

Replace `content/about/courses/index.en.md` with:

```markdown
---
title: "Courses"
date: 2026-05-15
weight: 1
draft: false
---

A running record of courses I have taken at the University of Rochester.

## Spring 2026

- **CSC 254** · Programming Language Design & Implementation
- **CSC 282** · Design & Analysis of Efficient Algorithms
- **CSC 280** · Computer Models & Limitations
- **MATH 282** · Intro to Complex Analysis
- **CSC 299W** · Social Implications of Computing
```

- [ ] **Step 3: Verify the page renders correctly**

With Hugo server running, navigate to `http://localhost:1313/about/courses/`.  
Expected: standard article layout with title "Courses", a short intro paragraph, and "Spring 2026" as a heading with five course entries.

- [ ] **Step 4: Commit**

```bash
git add content/about/courses/index.md content/about/courses/index.en.md
git commit -m "feat: structure courses page with semester heading"
```
