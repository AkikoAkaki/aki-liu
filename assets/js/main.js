import { initArchiveFilter } from "./modules/archive-filter.js";
import { initExpandingMenu, initMagneticHover } from "./modules/menu.js";
import { initFooterReveal, initTableWrapping } from "./modules/post-enhancements.js";
import { initPrefetcher } from "./modules/prefetch.js";
import { initSearchPalette } from "./modules/search-palette.js";

import { renderMath } from "./modules/katex.js";

document.addEventListener("DOMContentLoaded", () => {
  const generalMagnetEls = [
    ...document.querySelectorAll(
      ".data-link, .mb-tag-chip, .menu-trigger",
    ),
  ];
  initMagneticHover(generalMagnetEls, { magnetX: 4, magnetY: 3 });

  initExpandingMenu();
  initTableWrapping();
  initArchiveFilter();
  initSearchPalette();
  initFooterReveal();
  initPrefetcher();
  if (typeof window.renderMathInElement === "function") renderMath(document.body);
});
