# KaTeX Localization & Zero-Dependency Math Design Plan

**Date:** 2026-05-19
**Status:** Validated & Approved

## 1. Overview & Motivation
The current math formula rendering relies on loading KaTeX CSS, JS, and auto-render scripts dynamically from a third-party jsDelivr CDN.
While functional, this approach introduces performance bottlenecks (DNS lookups, TCP handshakes, TLS setup) and can fail in regions where CDN nodes are blocked or slow.

To achieve 100% stable math rendering with zero-dependency publishing and maintaining complete purity of Markdown source files, this plan details the self-hosting of all KaTeX assets (JS, CSS, and Brotli-compressed WOFF2 fonts) directly in the local Git repository under `/static/lib/katex/`.

## 2. Technical Architecture & Constraints

### 2.1 zero-dependency Publishing Compatibility
To strictly preserve the "No Node.js, no npm" publishing constraints:
* All assets are downloaded *once* on the developer machine using a PowerShell helper script (`scripts/download-katex.ps1`) and committed to Git.
* Vercel builds continue utilizing standard Go-based Hugo (`hugo --gc --minify`) with no modifications to Vercel configurations or pipeline scripts.

### 2.2 Lightweight WOFF2 Font Subsetting
Instead of downloading outdated `.ttf` and `.woff` fonts:
* Only Brotli-compressed `.woff2` font files are self-hosted.
* This compresses the total assets payload down to ~200KB, making it highly light and perfectly cached by Vercel CDN under standard immutable headers.

### 2.3 Non-Blocking Hydration
To eliminate any Layout Shifts (CLS):
* KaTeX stylesheet `katex.min.css` is loaded inline in the `<head>` to reserve formula heights immediately.
* Shaders/scripts `katex.min.js` and `auto-render.min.js` are loaded using the `defer` non-blocking attribute, performing asynchronous hydration only when the core page text has painted.

## 3. Implementation Steps
1. **Scaffold Downloader**: Write a robust PowerShell downloader `download-katex.ps1` under `scripts/`.
2. **Execute Downloader**: Execute the script to fetch all `woff2` fonts, CSS, and JS assets locally.
3. **Template Refactoring**: Modify `layouts/partials/head/katex.html` to reference local `lib/katex/` paths instead of CDN links.
4. **Validation**: Audit network requests and verify mathematical equations render perfectly offline.
