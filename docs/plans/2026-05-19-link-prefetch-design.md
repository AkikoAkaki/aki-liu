# Smart Link Prefetch Design Plan

**Date:** 2026-05-19
**Status:** Validated & Approved

## 1. Overview & Motivation
Standard Multi-Page Applications (MPAs) suffer from a perceptible network latency transition lag when users click links. To elevate the user experience to sub-100ms perceived transitions (equivalent to a Single Page Application), this design outlines a custom, zero-dependency, vanilla prefetch engine (`initPrefetcher`).

By leveraging the average 200–300ms hover latency on desktop and physical touch duration on mobile, this module dynamically prefetches local HTML pages directly into the browser's HTTP cache.

## 2. Technical Architecture & Constraints

### 2.1 Environmental Guards (Save-Data & Slow Connections)
To be highly ethical regarding user data plans and battery usage, the engine will query the Network Information API before activation. Prefetching is immediately aborted if:
* `navigator.connection.saveData` is `true`.
* `navigator.connection.effectiveType` matches `slow-2g`, `2g`, or `3g`.

### 2.2 Event Listeners & Throttling
1. **Desktop (Hover with Debounce)**:
   * Listen to `mouseover` using global event delegation on `document.body`.
   * Trigger a **65ms timer** on hover. If the cursor leaves or scrolls away before 65ms, the prefetch is cancelled. This prevents redundant bandwidth spikes when users quickly scan list views.
2. **Mobile (Touchstart)**:
   * Listen to `touchstart`. Immediately prefetch on touch initiation, exploiting the ~100ms gap between touchstart and click release to load the resource.

### 2.3 Strict Link Filtering
Only local HTML routes are loaded. The engine discards links that match any of the following filters:
* External links: `link.origin !== window.location.origin`
* Anchors/same-page links: `link.pathname === window.location.pathname && link.hash`
* Target blanks: `link.target === '_blank'`
* Non-HTML resources: file paths matching extensions `.pdf`, `.zip`, `.png`, `.jpg`, `.mp4`, etc.
* Non-HTTP protocols: `mailto:`, `tel:`, `javascript:`, etc.
* Server-side publish hooks: `/microblog/server/`.

## 3. Implementation Steps
1. **Module Creation**: Create `assets/js/modules/prefetch.js` with the clean modular function.
2. **UI Integration**: Import `initPrefetcher` into `assets/js/main.js` and call it on `DOMContentLoaded`.
3. **Verification**: Audit the Network panel in developer tools for `prefetch` resource requests. Validate that low-speed network emulation disables it.
