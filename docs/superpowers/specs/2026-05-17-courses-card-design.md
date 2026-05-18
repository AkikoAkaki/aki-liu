# Courses Card Design

**Date:** 2026-05-17  
**Status:** Approved

## Overview

Add a clickable Courses card to the about page pinboard. The card shows the current semester's courses and links to the existing `/about/courses/` article page.

## Card Design

**Visual style:** Registration slip / schedule printout  
**Size:** ~160×200px (similar to `.af-cv-card`)  
**Font:** Site sans-serif (Switzer), no monospace  
**Background:** White (`#fff`)  
**Border:** 1px solid, same as other pinboard cards  
**Shadow:** Same as `.af-cv-card` (`0 14px 28px rgba(0,0,0,0.05)`)  
**Rotation:** `rotate(-3deg)` (left lean, like notebook card)  
**Hover:** `translateY(-4px) rotate(0deg)` — same lift-and-straighten as all other cards

**Hole punch:** Positioned on the left edge, centered vertically at ~20px from top. A circular cutout (`18px` diameter) using the page background color, with a faint border.

**Card layout (top to bottom):**
1. Header row: semester label left (`Spring 2026`), course count right (`5 courses`) — small uppercase, muted color
2. Divider line (`1px solid var(--color-divider)`)
3. Course list: two columns per row — course number (left, muted, small) + course name (right, normal weight). 5 rows for Spring 2026.
4. Divider line
5. Footer: `All courses →` — small uppercase, very muted

**Current semester content (Spring 2026):**
- CSC 254 · Programming Language Design
- CSC 282 · Algorithms
- CSC 280 · Computer Models & Limitations
- MATH 282 · Complex Analysis
- CSC 299W · Social Implications

## Pinboard Placement

Added to `.af-pinboard-canvas` in `layouts/about/list.html`. Positioned to avoid heavy overlap with existing cards while maintaining the scattered pinboard aesthetic. Approximate position: `top: 160px, left: 330px` (to be fine-tuned during implementation).

The card is wrapped in an `<a href="/about/courses/">` tag. Inherit the same `reveal-pin` animation class and `--reveal-delay` pattern as other cards.

## CSS

New class: `.af-courses-card` in `assets/css/components.css`, within the existing pinboard card section alongside `.af-cv-card`.

The hole punch is an absolutely-positioned `<div class="af-courses-card-punch">` sitting outside the card's left edge. It uses `background: #f5f4f2` (the pinboard canvas background color) to fake a punch-through, with a `1px solid rgba(0,0,0,0.09)` border.

## Courses Page

**File:** `content/about/courses/index.md` (already exists)  
**Template:** `layouts/_default/single.html` (no changes needed)  
**URL:** `/about/courses/`

The page already contains the Spring 2026 course list. The user will expand it over time with historical semesters in plain markdown. No template changes required.

## Out of Scope

- Making other pinboard cards (notebook, photos, book) clickable
- CV card PDF link
- Bilingual (`index.en.md`) course content sync — user handles manually
