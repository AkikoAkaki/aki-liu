# WebGL Fluid Engine Refactor Design Plan

**Date:** 2026-05-19
**Status:** Validated & Approved

## 1. Overview & Motivation
The current homepage features a high-quality WebGL fluid noise shader implemented as an inline script within `layouts/index.html`. 
While visually stunning, the current implementation lacks lifecycle management, leading to unconditional rendering (wasting CPU/GPU battery when scrolled out of view), potential memory leaks due to unmanaged window event listeners, and code pollution within the HTML structure.

This refactor aims to extract the WebGL logic into a decoupled, highly cohesive ES6 Module class (`FluidEngine`), achieving a zero-footprint HTML architecture and implementing crucial performance throttles (via `IntersectionObserver` and `prefers-reduced-motion`).

## 2. Architecture & Components

### 2.1 File Structure Changes
* **`layouts/index.html`**: Purged of all inline WebGL scripting. Retains only the pure DOM wrapper (`.author-name-svg-wrapper`).
* **`assets/js/modules/fluid-engine.js` (NEW)**: Encapsulates the WebGL context, shader compilation, buffers, and the render loop logic inside a clean ES6 `FluidEngine` class.
* **`assets/js/main.js`**: Instantiates `FluidEngine`, binds it to the DOM, and controls its lifecycle via an `IntersectionObserver`.

### 2.2 The `FluidEngine` Class API
* **`constructor(containerNode)`**: Accepts the wrapper DOM node, checks for reduced motion preference.
* **`init()`**: Sets up the `<canvas>`, compiles vertex/fragment shaders, allocates VBOs, and binds resize debouncing.
* **`start()` / `pause()`**: Safe controllers for the `requestAnimationFrame` render loop.
* **`updateThemeColor()`**: Smooth interpolation function triggered when CSS variable `--bg-rgb` changes (theme toggle).
* **`destroy()`**: Releases WebGL context, unbinds mouse/resize events, and removes canvas to prevent memory leaks.

## 3. Performance & UX Considerations

### 3.1 IntersectionObserver Sleep Mode (GPGPU Battery Saver)
The primary controller in `main.js` will monitor the visibility of the hero container.
* When `isIntersecting` is true (visible): Call `engine.start()`.
* When `isIntersecting` is false (scrolled past): Call `engine.pause()` to immediately drop frame processing to 0ms.

### 3.2 Reduced Motion Fallback
If the user's OS has `prefers-reduced-motion: reduce` enabled:
* The engine skips `start()` looping entirely.
* It executes a single `gl.drawArrays` pass during `init()` to render a beautiful static noise frame.

### 3.3 Context Loss & Tab Throttling
* Listen to `webglcontextlost` and `webglcontextrestored` to ensure the canvas does not go blank silently.
* `visibilitychange` listeners are optional since modern browsers throttle `requestAnimationFrame` natively in background tabs, but combining it with `IntersectionObserver` provides robust coverage.

## 4. Implementation Steps
1. **Module Creation**: Scaffold `fluid-engine.js` with the class structure and migrate physics/shader code.
2. **Controller Wiring**: Import the module into `main.js`, configure `IntersectionObserver`, and test rendering in isolated development environment.
3. **Cleanup**: Remove inline scripts from `index.html`.
4. **Validation**: Test theme transitions, resize elasticity, and verify GPU profiling drops to zero when scrolled away.
