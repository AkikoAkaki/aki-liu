import { initExpandingMenu, initMagneticHover } from "./modules/menu.js";
import { initFooterRevealFallback } from "./modules/footer-reveal.js";
import { initTableWrapping } from "./modules/post-enhancements.js";
import { initPrefetcher } from "./modules/prefetch.js";
import { initSearchLoader } from "./modules/search-loader.js";

import { renderMath } from "./modules/katex.js";
const searchSrc = document.currentScript?.dataset.searchSrc;

document.addEventListener("DOMContentLoaded", () => {
  const magnets = new WeakSet();
  document.addEventListener("pointerover", (event) => {
    const element = event.target.closest(".mb-tag-chip");
    if (!element || magnets.has(element)) return;
    magnets.add(element);
    initMagneticHover([element], { magnetX: 4, magnetY: 3 });
  }, { capture: true, passive: true });

  initExpandingMenu();
  initTableWrapping();
  initFooterRevealFallback();
  initSearchLoader(searchSrc);
  initPrefetcher();
  if (typeof window.renderMathInElement === "function") renderMath(document.body);
});
