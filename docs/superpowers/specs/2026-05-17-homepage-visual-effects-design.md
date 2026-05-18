# Homepage Visual Effects Design

**Date:** 2026-05-17  
**Goal:** Add visual impact to the homepage without restructuring the layout. Three sequential effects, each implemented and tested independently.

## Problem

The homepage feels too static on load. The hero name ("AKI LIU" SVG) has no entrance drama, and the page feels flat after loading. The content below the fold (work grid, now cards) is less of an issue.

## Constraints

- Do not restructure layout or change any content
- Each effect is self-contained and reversible
- Keep the clean editorial aesthetic — effects should feel intentional, not decorative noise
- Mobile must not break

---

## Effect 1: Reveal Entrance Animation

**What:** On page load, the "AKI LIU" hero SVG is revealed by a clip-path or mask that sweeps left-to-right over ~0.8s. The bio text fades in with a ~0.2s delay after the name finishes. After the animation completes, the page is completely static.

**Implementation:**
- Wrap the `.author-name-svg-wrapper` in a clip-path animation using CSS `@keyframes`
- Use `clip-path: inset(0 100% 0 0)` → `clip-path: inset(0 0% 0 0)` for the sweep
- Bio paragraphs get `opacity: 0` initially, then `animation: fadeIn` delayed after name reveal
- Respect `prefers-reduced-motion`: skip animation, show everything immediately

**Files:** `assets/css/components.css`, possibly `layouts/index.html` for a wrapper class

---

## Effect 2: Film Grain Overlay

**What:** After Effect 1 is stable, add a subtle animated film grain texture over the entire page background. The grain is a small looping canvas or SVG filter that makes the white feel "alive" rather than flat.

**Implementation:**
- SVG `<feTurbulence>` filter applied to a full-page `::before` pseudo-element, very low opacity (3-6%)
- Or: a small `<canvas>` element fixed behind content, drawing random noise per frame at low opacity
- The grain does not sit on top of text — z-index carefully managed so it stays as background texture
- Respect `prefers-reduced-motion`: static grain (no animation, just a fixed texture) or none at all

**Files:** `assets/css/components.css`, possibly a small inline `<script>` in `layouts/index.html`

---

## Effect 3: Cursor Parallax on Hero Name

**What:** The hero SVG responds to mouse position with a very subtle parallax offset (~4px max travel). Moving the mouse right shifts the SVG slightly left, creating a sense of depth and three-dimensionality. The page always feels "alive."

**Implementation:**
- JS listener on `mousemove` on the home container (or `document`)
- Map cursor position to `-4px … +4px` offset on both axes using `transform: translate()`
- Smooth with `lerp` or CSS `transition: transform 0.15s ease-out`
- On mobile/touch: no effect (touch devices have no persistent cursor)
- Respect `prefers-reduced-motion`: no transform applied

**Files:** `assets/js/main.js` or a `<script>` block in `layouts/index.html`

---

## Order of Implementation

1. Effect 1 (entrance animation) — biggest perceived impact, easiest to validate
2. Effect 2 (film grain) — layered on top, adds atmosphere
3. Effect 3 (parallax) — final layer, adds ongoing interactivity

Each effect should be reviewed visually before proceeding to the next.
