import { initHomeField } from "./modules/home-field.js";

const workerSrc = document.currentScript?.dataset.workerSrc;

function start() {
  if (document.hidden) {
    document.addEventListener("visibilitychange", start, { once: true });
    return;
  }
  initHomeField(workerSrc);
}

start();
