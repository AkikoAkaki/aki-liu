import { QUERIES } from "./media.js";

// CSS variable, state field, unit, decimals, settle threshold, easing [hovering, leaving].
const MAGNET_VARS = [
  ["--menu-magnet-x", "x", "px", 3, 0.01, [0.18, 0.18]],
  ["--menu-magnet-y", "y", "px", 3, 0.01, [0.18, 0.18]],
  ["--menu-content-x", "contentX", "px", 3, 0.01, [0.22, 0.22]],
  ["--menu-content-y", "contentY", "px", 3, 0.01, [0.22, 0.22]],
  ["--menu-cursor-x", "cursorX", "px", 3, 0.01, [0.26, 0.26]],
  ["--menu-cursor-y", "cursorY", "px", 3, 0.01, [0.26, 0.26]],
  ["--menu-fill-scale", "fill", "", 4, 0.005, [0.34, 0.2]],
  ["--menu-fill-opacity", "opacity", "", 4, 0.005, [0.28, 0.18]],
];

const isMouseLike = (event) => !event.pointerType || event.pointerType === "mouse" || event.pointerType === "pen";
const restingMotion = () => Object.fromEntries(MAGNET_VARS.map(([, field]) => [field, 0]));

function initMagneticHover(elements, { magnetX = 4, magnetY = 3, contentX = 0, contentY = 0, hideCursor = false } = {}) {
  if (!matchMedia(QUERIES.hover).matches || matchMedia(QUERIES.reducedMotion).matches) return [];

  return elements.map((el) => {
    let active = false;
    let rect = null;
    let rafId = 0;
    let current = restingMotion();
    let target = restingMotion();
    const written = new Map();

    function writeVars() {
      for (const [name, field, unit, decimals] of MAGNET_VARS) {
        const value = current[field].toFixed(decimals) + unit;
        if (written.get(name) === value) continue;
        written.set(name, value);
        el.style.setProperty(name, value);
      }
    }

    function clearMotion() {
      cancelAnimationFrame(rafId);
      rafId = 0;
      active = false;
      rect = null;
      current = restingMotion();
      target = restingMotion();
      written.clear();
      el.classList.remove("is-magnetic", "is-settling");
      MAGNET_VARS.forEach(([name]) => el.style.removeProperty(name));
    }

    function updateTarget(event) {
      if (!rect) rect = el.getBoundingClientRect();
      const relX = Math.max(0, Math.min(rect.width, event.clientX - rect.left));
      const relY = Math.max(0, Math.min(rect.height, event.clientY - rect.top));
      const xRatio = relX / rect.width - 0.5;
      const yRatio = relY / rect.height - 0.5;
      target.x = xRatio * magnetX;
      target.y = yRatio * magnetY;
      target.contentX = xRatio * contentX;
      target.contentY = yRatio * contentY;
      target.cursorX = relX;
      target.cursorY = relY;
    }

    function animate() {
      let moving = false;
      for (const [, field, , , threshold, easing] of MAGNET_VARS) {
        current[field] += (target[field] - current[field]) * easing[active ? 0 : 1];
        if (Math.abs(current[field] - target[field]) > threshold) moving = true;
      }
      writeVars();
      rafId = moving ? requestAnimationFrame(animate) : 0;
      if (!moving && !active) clearMotion();
    }

    function startAnimation() {
      if (!rafId) rafId = requestAnimationFrame(animate);
    }

    el.addEventListener("pointerenter", (event) => {
      if (!isMouseLike(event)) return;
      active = true;
      rect = el.getBoundingClientRect();
      updateTarget(event);
      current.cursorX = target.cursorX;
      current.cursorY = target.cursorY;
      current.fill = 0;
      current.opacity = 0;
      target.fill = 1;
      target.opacity = 1;
      el.classList.add("is-magnetic");
      el.classList.remove("is-settling");
      if (hideCursor) document.body.classList.add("menu-cursor-hidden");
      writeVars();
      startAnimation();
    });

    el.addEventListener("pointermove", (event) => {
      if (!active) return;
      updateTarget(event);
      startAnimation();
    });

    el.addEventListener("pointerleave", () => {
      active = false;
      rect = null;
      target.x = 0;
      target.y = 0;
      target.contentX = 0;
      target.contentY = 0;
      target.fill = 0;
      target.opacity = 0;
      el.classList.remove("is-magnetic");
      el.classList.add("is-settling");
      if (hideCursor) document.body.classList.remove("menu-cursor-hidden");
      startAnimation();
    });

    return () => {
      clearMotion();
      if (hideCursor) document.body.classList.remove("menu-cursor-hidden");
    };
  });
}

// Elements marked data-magnetic in templates get the effect on first hover.
export function initMagneticElements() {
  const seen = new WeakSet();
  document.addEventListener("pointerover", (event) => {
    const element = event.target.closest("[data-magnetic]");
    if (!element || seen.has(element)) return;
    seen.add(element);
    initMagneticHover([element]);
  }, { capture: true, passive: true });
}

export function initExpandingMenu() {
  const menuBar = document.getElementById("menu-bar");
  const menuTrigger = document.getElementById("menu-trigger");
  const menuPanel = document.getElementById("menu-panel");
  const canHover = matchMedia(QUERIES.hover).matches;
  const magneticLinks = [...menuPanel.querySelectorAll(".menu-link")];
  // Unset until the first scroll. Reading scrollY here would force a layout
  // while the page is still loading.
  let lastScrollY = null;
  let scrollRafId = 0;
  const hideThreshold = 24;
  let magneticResets = null;

  function getCollapsedHeight() {
    const computed = window.getComputedStyle(menuBar);
    return parseFloat(computed.height) || 68;
  }

  function syncOpenHeight() {
    const collapsedHeight = getCollapsedHeight();
    const panelHeight = menuPanel.scrollHeight;
    const nextHeight = Math.max(collapsedHeight, panelHeight);
    menuBar.style.setProperty("--menu-open-height", `${nextHeight}px`);
  }

  function open() {
    magneticResets ??= initMagneticHover(magneticLinks, { magnetX: 8, magnetY: 5, contentX: 15, contentY: 9, hideCursor: true });
    syncOpenHeight();
    menuBar.classList.add("is-animating");
    menuBar.classList.add("is-open");
    menuBar.classList.remove("is-scrolled-away");
    menuTrigger.setAttribute("aria-expanded", "true");
    menuPanel.setAttribute("aria-hidden", "false");

    setTimeout(() => {
      menuBar.classList.remove("is-animating");
    }, 420);
  }

  function close() {
    if (!menuBar.classList.contains("is-open")) return;
    resetMagneticLinks();
    menuBar.style.setProperty(
      "--menu-open-height",
      `${menuBar.getBoundingClientRect().height}px`,
    );
    menuBar.classList.add("is-animating");
    requestAnimationFrame(() => {
      menuBar.classList.remove("is-open");
    });
    menuTrigger.setAttribute("aria-expanded", "false");
    menuPanel.setAttribute("aria-hidden", "true");

    setTimeout(() => {
      menuBar.classList.remove("is-animating");
    }, 420);
  }

  window.addEventListener("site:close-all", close);

  function updateScrollState() {
    scrollRafId = 0;

    if (
      menuBar.classList.contains("is-open") ||
      menuBar.classList.contains("is-search")
    ) {
      lastScrollY = window.scrollY || 0;
      menuBar.classList.remove("is-scrolled-away");
      return;
    }

    const currentScrollY = window.scrollY || 0;
    const delta = lastScrollY === null ? 0 : currentScrollY - lastScrollY;

    if (currentScrollY <= hideThreshold) {
      menuBar.classList.remove("is-scrolled-away");
    } else if (delta > 1) {
      menuBar.classList.add("is-scrolled-away");
    } else if (delta < -1) {
      menuBar.classList.remove("is-scrolled-away");
    }

    lastScrollY = currentScrollY;
  }

  if (canHover) {
    menuBar.addEventListener("pointerenter", (event) => {
      if (isMouseLike(event) && !menuBar.classList.contains("is-open")) {
        open();
      }
    });

    menuBar.addEventListener("pointerleave", (event) => {
      if (isMouseLike(event)) close();
    });
  }

  function resetMagneticLinks() {
    magneticResets?.forEach((reset) => reset());
  }

  menuTrigger.addEventListener("click", (e) => {
    e.stopPropagation();
    if (canHover && menuBar.matches(":hover")) return;
    menuBar.classList.contains("is-open") ? close() : open();
  });

  document.addEventListener("click", (e) => {
    if (!menuBar.contains(e.target)) close();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });

  window.addEventListener(
    "scroll",
    () => {
      if (scrollRafId) return;
      scrollRafId = requestAnimationFrame(updateScrollState);
    },
    { passive: true },
  );

  window.addEventListener("resize", () => {
    if (menuBar.classList.contains("is-open")) {
      syncOpenHeight();
    }
    resetMagneticLinks();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) resetMagneticLinks();
  });
}
