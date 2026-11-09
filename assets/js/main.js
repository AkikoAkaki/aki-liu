import { initExpandingMenu, initMagneticElements } from "./modules/menu.js";
import { initCodeCopy, initTableWrapping } from "./modules/post-enhancements.js";
import { initPrefetcher } from "./modules/prefetch.js";
import { initLocalVideos } from "./modules/video-loading.js";
import { initSearchLoader } from "./modules/search-loader.js";
import { initResourceMode } from "./modules/resource-mode.js";

initResourceMode();
const searchSrc = document.currentScript?.dataset.searchSrc;

document.addEventListener("DOMContentLoaded", () => {
  initMagneticElements();
  initExpandingMenu();
  initTableWrapping();
  initCodeCopy();
  initLocalVideos();
  initSearchLoader(searchSrc);
  initPrefetcher();
});
