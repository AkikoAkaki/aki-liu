import { initHomeField } from "./modules/home-field.js";

const workerSrc = document.currentScript?.dataset.workerSrc;
const fallbackSrc = document.currentScript?.dataset.fallbackSrc;

function start() {
  if (document.hidden) {
    document.addEventListener("visibilitychange", start, { once: true });
    return;
  }
  initHomeField(workerSrc, fallbackSrc).catch((error) => console.error("Homepage field:", error));
}

// Let the intro reveal finish before the field claims the GPU; the canvas
// fades in on its first frame, so starting later does not make it pop.
const intro = document.querySelector(".intro")?.getAnimations?.({ subtree: true }) || [];
const idle = (fn) => (window.requestIdleCallback ? requestIdleCallback(fn, { timeout: 300 }) : setTimeout(fn, 0));
Promise.race([
  Promise.allSettled(intro.map((animation) => animation.finished)),
  new Promise((resolve) => setTimeout(resolve, 1500)),
]).then(() => idle(start));
