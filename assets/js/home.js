import { initHomeHoverPreview } from "./modules/home-preview.js";
import { matches, QUERIES } from "./modules/media.js";

const homeScript = document.currentScript;

document.addEventListener("DOMContentLoaded", () => {
  initExpandableCards();
  initHomeHoverPreview();
  loadHomeField();
  const navContent = document.querySelector(".nav-panel-content");
  const leftCol = document.querySelector(".work-column:not(.nav-panel-column)");
  if (!navContent || !leftCol) return;

  function updateNavGap() {
    if (!matches(QUERIES.homeDesktop)) {
      navContent.style.removeProperty("--nav-flow-gap");
      return;
    }
    const groups = navContent.querySelectorAll(".nav-panel-group");
    const list = navContent.querySelector(".nav-panel-list");
    if (!list) return;

    let groupsH = 0;
    groups.forEach((group) => { groupsH += group.getBoundingClientRect().height; });

    const listH = list.getBoundingClientRect().height;
    const free = Math.max(0, listH - groupsH);

    let slots = Math.max(0, groups.length - 1);
    groups.forEach((group) => {
      const sub = group.querySelectorAll(".nav-panel-subitem").length;
      if (sub > 1) slots += sub - 1;
    });

    const gap = slots > 0 ? Math.max(6, Math.round(free / slots)) : 12;
    navContent.style.setProperty("--nav-flow-gap", gap + "px");
  }

  let raf = 0;
  function schedule() {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      updateNavGap();
    });
  }

  window.addEventListener("resize", schedule);
  schedule();
  if (window.ResizeObserver) {
    const observer = new ResizeObserver(schedule);
    observer.observe(leftCol);
    observer.observe(navContent);
  }
});

function initExpandableCards() {
    const cardHeaders = document.querySelectorAll(".now-card-header");
    cardHeaders.forEach((button) => {
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

// The field library is the largest script on the page. Fetch and start it
// once the page has loaded and the main thread is idle, so it never delays
// the first paint or early input.
function loadHomeField() {
  const src = homeScript?.dataset.fieldSrc;
  if (!src) return;
  const start = () => {
    const script = document.createElement("script");
    script.src = src;
    script.integrity = homeScript.dataset.fieldIntegrity;
    document.head.append(script);
  };
  const whenIdle = () => {
    if ("requestIdleCallback" in window) requestIdleCallback(start, { timeout: 1000 });
    else setTimeout(start, 50);
  };
  if (document.readyState === "complete") whenIdle();
  else window.addEventListener("load", whenIdle, { once: true });
}
