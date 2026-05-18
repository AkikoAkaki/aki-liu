# Homepage Effect 1: Entrance Animation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the plain fade-in-up on the hero name with a dramatic left-to-right clip-path reveal, and stagger the bio text in after.

**Architecture:** Pure CSS animation in `assets/css/home.css`. No JS needed. The `.author-name-svg-wrapper` gets a clip-path sweep keyframe. Each `.bio-text` gets a staggered `opacity + translateY` fade. `prefers-reduced-motion` skips all animation.

**Tech Stack:** CSS `@keyframes`, `clip-path: inset()`, `animation-delay`

---

### Task 1: Replace hero name animation with clip-path reveal

**Files:**
- Modify: `assets/css/home.css`

Current state: `.author-name-svg-wrapper` has `opacity: 0` + `animation: fade-in-up 0.8s ease forwards`.

- [ ] **Step 1: Add the reveal keyframe** — add this to the `/* Animation */` block at the top of `home.css`, after the existing `fade-in-up` keyframe:

```css
@keyframes hero-reveal {
    from {
        clip-path: inset(0 100% 0 0);
        opacity: 1;
    }
    to {
        clip-path: inset(0 0% 0 0);
        opacity: 1;
    }
}
```

- [ ] **Step 2: Update `.author-name-svg-wrapper`** — replace its current animation properties:

Change:
```css
opacity: 0;
animation: fade-in-up 0.8s ease forwards;
```
To:
```css
opacity: 1;
clip-path: inset(0 100% 0 0);
animation: hero-reveal 0.9s cubic-bezier(0.16, 1, 0.3, 1) forwards;
animation-delay: 0s;
```

- [ ] **Step 3: Verify in browser** — open the homepage, hard refresh. The name should sweep in left-to-right over ~0.9s. After it finishes the page should be fully static.

---

### Task 2: Stagger bio text after the name finishes

**Files:**
- Modify: `assets/css/home.css`

The `.intro` section currently has its own `fade-in-up` animation. The bio paragraphs inherit from it. We want to detach bio text and give each paragraph its own delayed fade.

- [ ] **Step 1: Remove animation from `.intro`** — the `.intro` rule currently has:

```css
opacity: 0;
animation: fade-in-up 0.6s ease forwards;
animation-delay: 0s;
```

Change to:
```css
opacity: 1;
```

(The name has its own animation now; the intro container should not animate separately.)

- [ ] **Step 2: Add staggered animation to `.bio-text`** — add after the `.bio-text` rule block:

```css
.bio-text {
    opacity: 0;
    animation: fade-in-up 0.5s ease forwards;
}

.intro .bio-text:nth-of-type(1) { animation-delay: 0.75s; }
.intro .bio-text:nth-of-type(2) { animation-delay: 0.9s; }
.intro .bio-text:nth-of-type(3) { animation-delay: 1.05s; }
.intro .bio-text:nth-of-type(4) { animation-delay: 1.2s; }
```

(Delays start at 0.75s — just after the 0.9s name reveal finishes. Extra nth selectors cover up to 4 paragraphs; unused ones are harmless.)

- [ ] **Step 3: Verify in browser** — the name sweeps in, then bio paragraphs fade up one after another with a slight cascade. Total entrance should feel complete by ~1.5s.

---

### Task 3: prefers-reduced-motion + commit

**Files:**
- Modify: `assets/css/home.css`

- [ ] **Step 1: Add reduced-motion override** — find the existing `@media (prefers-reduced-motion: reduce)` block in home.css (or add one at the bottom if absent):

```css
@media (prefers-reduced-motion: reduce) {
    .author-name-svg-wrapper {
        clip-path: none;
        opacity: 1;
        animation: none;
    }
    .bio-text {
        opacity: 1;
        animation: none;
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add assets/css/home.css
git commit -m "feat: add dramatic clip-path entrance animation to hero name"
```
