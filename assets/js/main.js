import { initExpandingMenu, initMagneticHover } from "./modules/menu.js";
import { initFooterRevealFallback } from "./modules/footer-reveal.js";
import { initTableWrapping } from "./modules/post-enhancements.js";
import { initPrefetcher } from "./modules/prefetch.js";
import { initSearchLoader } from "./modules/search-loader.js";

import { renderMath } from "./modules/katex.js";
const searchSrc = document.currentScript?.dataset.searchSrc;

document.addEventListener("DOMContentLoaded", () => {
  const generalMagnetEls = [
    ...document.querySelectorAll(
      ".data-link, .mb-tag-chip, .menu-trigger",
    ),
  ];
  initMagneticHover(generalMagnetEls, { magnetX: 4, magnetY: 3 });

  initExpandingMenu();
  initTableWrapping();
  initFooterRevealFallback();
  initSearchLoader(searchSrc);
  initPrefetcher();
  if (typeof window.renderMathInElement === "function") renderMath(document.body);
});
