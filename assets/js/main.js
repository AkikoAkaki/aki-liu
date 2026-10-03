import { initAboutFlightAndDrag, initAboutImageSequence, initScrollReveal } from "./modules/about-page.js";
import { initArchiveFilter } from "./modules/archive-filter.js";
import { initFluidEngine } from "./modules/fluid-init.js";
import { initHomeHoverPreview } from "./modules/home-preview.js";
import { initExpandingMenu, initMagneticHover, initSlotLinks } from "./modules/menu.js";
import { initExpandableCards, initFooterReveal, initTableWrapping } from "./modules/post-enhancements.js";
import { initPrefetcher } from "./modules/prefetch.js";
import { initSearchPalette } from "./modules/search-palette.js";

document.addEventListener("DOMContentLoaded", () => {
  initScrollReveal();
  initAboutImageSequence();
  initAboutFlightAndDrag();

  const generalMagnetEls = [
    ...document.querySelectorAll(
      ".bio-text a, .now-section a, .data-link, " +
        ".mb-tag-chip, .menu-trigger, .af-now-prose a",
    ),
  ];
  initMagneticHover(generalMagnetEls, { magnetX: 4, magnetY: 3 });

  initExpandingMenu();
  initTableWrapping();
  initArchiveFilter();
  initExpandableCards();
  initHomeHoverPreview();
  initSearchPalette();
  initSlotLinks();
  initFooterReveal();
  initFluidEngine();
  initPrefetcher();
});
