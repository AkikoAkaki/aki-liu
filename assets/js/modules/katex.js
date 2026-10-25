// Keep delimiters aligned with layouts/partials/head/katex.html.
const KATEX_DELIMITERS = [
  { left: "$$", right: "$$", display: true },
  { left: "\\(", right: "\\)", display: false },
  { left: "\\[", right: "\\]", display: true },
  { left: "$", right: "$", display: false },
];

let katexReady = null;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

// Loads KaTeX from `base` (e.g. "/lib/katex/") once per page.
export function loadKatex(base) {
  if (typeof window.renderMathInElement === "function") {
    return Promise.resolve();
  }
  if (!katexReady) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = base + "katex.min.css";
    document.head.appendChild(link);
    katexReady = loadScript(base + "katex.min.js")
      .then(() => loadScript(base + "auto-render.min.js"))
      .catch((error) => {
        katexReady = null;
        throw error;
      });
  }
  return katexReady;
}

// Call after loadKatex() resolves.
export function renderMath(element) {
  window.renderMathInElement(element, {
    delimiters: KATEX_DELIMITERS,
    throwOnError: false,
  });
}
