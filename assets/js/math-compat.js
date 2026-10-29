import { loadKatexRuntime, renderMath } from "./modules/katex.js";

const base = document.currentScript.dataset.katexBase;
loadKatexRuntime(base).then(() => {
  renderMath(document.querySelector(".post-content") || document.body);
}).catch(() => {});
