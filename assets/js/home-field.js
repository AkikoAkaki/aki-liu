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

start();
