import { background, wordField } from "./asciify-field-4.32.8.js";
import { media, QUERIES } from "./media.js";

export function initHomeField() {
  const host = document.querySelector(".site-wrapper");
  const content = document.querySelector(".home-container");
  if (!host || !content) return;

  const reducedMotion = media(QUERIES.reducedMotion);
  const field = background(host, {
    preset: wordField,
    text: "AKI LIU",
    palette: { light: "#737c79", dark: "#81938f" },
    opacity: 0.35,
    cellSize: 13,
    speed: 0.8,
    cursor: reducedMotion.matches ? false : "fluid",
    look: {
      font: '"JetBrains Mono", ui-monospace, monospace',
      fontWeight: 400,
      cellAspect: 0.62,
      glyphScale: 0.9,
      maxPixelRatio: 1.5,
      highlight: "#42979d",
    },
  });

  const canvas = host.querySelector(":scope > canvas[data-ascii-kit]");
  if (!canvas) return;
  canvas.classList.add("home-field");
  host.prepend(canvas);

  reducedMotion.addEventListener("change", (event) => {
    field.update({ cursor: event.matches ? false : "fluid" });
  });
}
