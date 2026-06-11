import { initAboutFlightAndDrag, initAboutImageSequence, initScrollReveal } from "./modules/about-page.js";
import { initArchiveFilter } from "./modules/archive-filter.js";
import { initFluidEngine } from "./modules/fluid-init.js";
import { initHomeHoverPreview } from "./modules/home-preview.js";
import { initExpandingMenu, initMagneticHover, initSlotLinks } from "./modules/menu.js";
import { initExpandableCards, initFooterReveal, initTableWrapping } from "./modules/post-enhancements.js";
import { initPrefetcher } from "./modules/prefetch.js";
import { initSearchPalette } from "./modules/search-palette.js";
import { initSearchPlaceholder } from "./modules/search-placeholder.js";
import { initThemePersistence } from "./modules/theme.js";

initThemePersistence();

document.addEventListener("DOMContentLoaded", () => {
  // Initialization order mirrors the former single-file DOMContentLoaded sequence.
  initScrollReveal();
  initAboutImageSequence();
  initAboutFlightAndDrag();

  const generalMagnetEls = [
    ...document.querySelectorAll(
      ".bio-text a, .now-section a, .connect-section a:not(.connect-pill), .data-link, " +
        ".mb-tag-chip, .mb-card-tag, .menu-trigger, .af-now-prose a",
    ),
  ];
  initMagneticHover(generalMagnetEls, { magnetX: 4, magnetY: 3 });

  initExpandingMenu();
  initTableWrapping();
  initSearchPlaceholder();
  initArchiveFilter();
  initExpandableCards();
  initHomeHoverPreview();
  initSearchPalette();
  initSlotLinks();
  initFooterReveal();
  initFluidEngine();
  initPrefetcher();
});
