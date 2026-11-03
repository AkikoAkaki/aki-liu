import { initExpandingMenu, initMagneticHover } from "./modules/menu.js";
import { initTableWrapping } from "./modules/post-enhancements.js";
import { initPrefetcher } from "./modules/prefetch.js";
import { initLocalVideos } from "./modules/video-loading.js";
import { initSearchLoader } from "./modules/search-loader.js";

import { initResourceMode } from "./modules/resource-mode.js";
initResourceMode();
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
  initLocalVideos();
  initSearchLoader(searchSrc);
  initPrefetcher();
});
