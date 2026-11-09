import { initHomeHoverPreview } from "./modules/home-preview.js";
import { QUERIES } from "./modules/media.js";

document.addEventListener("DOMContentLoaded", () => {
  initExpandableCards();
  initHomeHoverPreview();
  initNavPanelGap();
});

function initNavPanelGap() {
  const navContent = document.querySelector(".nav-panel-content");
  const leftCol = document.querySelector(".work-column:not(.nav-panel-column)");
  const list = navContent.querySelector(".nav-panel-list");
  const groups = navContent.querySelectorAll(".nav-panel-group");

  let raf = 0, pendingGap = null;
  function writeGap(value) {
    pendingGap = value;
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      if (pendingGap === null) navContent.style.removeProperty("--nav-flow-gap");
      else navContent.style.setProperty("--nav-flow-gap", pendingGap);
    });
  }

  function updateNavGap() {
    if (!matchMedia(QUERIES.homeDesktop).matches) {
      writeGap(null);
      return;
    }
    let groupsH = 0;
    groups.forEach((group) => { groupsH += group.getBoundingClientRect().height; });
    const free = Math.max(0, list.getBoundingClientRect().height - groupsH);

    let slots = Math.max(0, groups.length - 1);
    groups.forEach((group) => {
      const sub = group.querySelectorAll(".nav-panel-subitem").length;
      if (sub > 1) slots += sub - 1;
    });

    writeGap((slots > 0 ? Math.max(6, Math.round(free / slots)) : 12) + "px");
  }

  window.addEventListener("resize", updateNavGap);
  const observer = new ResizeObserver(updateNavGap);
  observer.observe(leftCol);
  observer.observe(navContent);
}

function initExpandableCards() {
  document.querySelectorAll(".now-card-header").forEach((button) => {
    const card = button.parentElement;
    const panel = document.getElementById(button.getAttribute("aria-controls"));
    button.addEventListener("click", () => {
      const expanded = button.getAttribute("aria-expanded") !== "true";
      if (!expanded && panel.contains(document.activeElement)) {
        button.focus({ preventScroll: true });
      }
      button.setAttribute("aria-expanded", String(expanded));
      panel.inert = !expanded;
      card.classList.toggle("is-expanded", expanded);
      card.classList.toggle("is-collapsed", !expanded);
    });
  });
}
