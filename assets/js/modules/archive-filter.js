import { initArchivePreview } from "./archive-preview.js";
import {
  archiveEntries,
  readArchiveFilters,
  updateArchiveView,
  syncArchiveURL,
} from "./archive-state.js";
import { media, QUERIES } from "./media.js";

export function initArchiveFilter() {
  const list = document.querySelector("[data-archive-filter-root]");
  if (!list) return;
  const entries = archiveEntries(list);
  const preview = initArchivePreview(list);
  const reducedMotion = media(QUERIES.reducedMotion);
  const controls = [...document.querySelectorAll(".archive-tag-item[data-tag], .archive-year-item[data-year]")];
  const motions = new Map();
  let exitLayer = null;
  let filters = readArchiveFilters(list);

  function cancelMotion() {
    motions.forEach((animation) => animation.cancel());
    motions.clear();
    exitLayer?.remove();
    exitLayer = null;
  }

  function animate(element, keyframes, duration, removeOnFinish = false) {
    const animation = element.animate(keyframes, {
      duration,
      easing: "cubic-bezier(0.22, 1, 0.36, 1)",
    });
    motions.set(element, animation);
    animation.addEventListener("finish", () => {
      if (motions.get(element) !== animation) return;
      motions.delete(element);
      if (removeOnFinish) element.remove();
      if (!motions.size) {
        exitLayer?.remove();
        exitLayer = null;
      }
    }, { once: true });
  }

  function applyFilters(withMotion = true) {
    const moving = withMotion && !reducedMotion.matches;
    const before = new Map();
    if (moving) {
      entries.filter(({ element }) => !element.hidden).forEach(({ element }) => {
        const rect = element.getBoundingClientRect();
        const inViewport = rect.bottom >= 0 && rect.top <= innerHeight;
        before.set(element, {
          rect,
          opacity: inViewport ? Number(getComputedStyle(element).opacity) : 1,
        });
      });
    }

    cancelMotion();
    const matched = updateArchiveView(entries, filters);
    preview.clear();
    if (!moving) return;

    // Read final geometry before starting any animations.
    const after = new Map(matched.map(({ element }) => [element, element.getBoundingClientRect()]));
    const origin = list.getBoundingClientRect();
    before.forEach(({ rect, opacity }, element) => {
      if (!element.hidden || rect.bottom < 0 || rect.top > innerHeight) return;
      if (!exitLayer) {
        exitLayer = document.createElement("div");
        exitLayer.className = "archive-exits";
        exitLayer.inert = true;
        exitLayer.setAttribute("aria-hidden", "true");
        list.append(exitLayer);
      }
      const ghost = element.cloneNode(true);
      ghost.hidden = false;
      ghost.style.left = (rect.left - origin.left) + "px";
      ghost.style.top = (rect.top - origin.top) + "px";
      ghost.style.width = rect.width + "px";
      ghost.style.height = rect.height + "px";
      exitLayer.append(ghost);
      animate(ghost, [
        { opacity, transform: "translateY(0)" },
        { opacity: 0, transform: "translateY(-6px)" },
      ], 160, true);
    });

    matched.forEach(({ element }) => {
      const previous = before.get(element);
      const rect = after.get(element);
      if (rect.bottom < 0 || rect.top > innerHeight) return;
      const dx = previous ? previous.rect.left - rect.left : 0;
      const dy = previous ? previous.rect.top - rect.top : 6;
      const opacity = previous ? previous.opacity : 0;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5 && opacity === 1) return;
      animate(element, [
        { opacity, transform: "translate3d(" + dx + "px," + dy + "px,0)" },
        { opacity: 1, transform: "translate3d(0,0,0)" },
      ], previous ? 260 : 220);
    });
  }

  controls.forEach((control) => {
    control.setAttribute("role", "button");
    control.setAttribute("aria-controls", list.id);
    control.addEventListener("click", (event) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      const selected = control.dataset.tag !== undefined ? filters.tags : filters.years;
      const value = control.dataset.tag ?? control.dataset.year;
      if (selected.has(value)) selected.delete(value);
      else selected.add(value);
      syncArchiveURL(list, filters);
      applyFilters();
    });
    control.addEventListener("keydown", (event) => {
      if (event.key !== " ") return;
      event.preventDefault();
      control.click();
    });
  });

  window.addEventListener("popstate", () => {
    filters = readArchiveFilters(list);
    applyFilters();
  });
  window.addEventListener("resize", cancelMotion, { passive: true });
  reducedMotion.addEventListener("change", cancelMotion);
  applyFilters(false);
}
