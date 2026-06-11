import { FluidEngine } from "./fluid-engine.js";

export function initFluidEngine() {
  const wrapper = document.querySelector(".author-name-svg-wrapper");
  const intro = document.querySelector(".intro");
  if (!wrapper || !intro) return;

  const engine = new FluidEngine(intro, wrapper);
  if (!engine.init()) return;
  let introVisible = false;

  function startIfVisible() {
    if (document.visibilityState === "hidden" || !introVisible) return;
    engine.start();
  }

  function handleVisibilityChange() {
    if (document.visibilityState === "hidden") {
      engine.pause();
      return;
    }
    startIfVisible();
  }

  // Dynamic observer: handles Hero.svg load, web font loading, and responsive shifts
  if (window.ResizeObserver) {
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
          engine.handleResize();
        }
      }
    });
    resizeObserver.observe(wrapper);
  }

  // Throttle WebGL rendering based on viewport visibility
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          introVisible = entry.isIntersecting;
          if (entry.isIntersecting) {
            startIfVisible();
          } else {
            engine.pause();
          }
        });
      },
      { threshold: 0.0, rootMargin: "100px 0px 100px 0px" },
    );
    observer.observe(intro);
  } else {
    introVisible = true;
    startIfVisible();
  }

  document.addEventListener("visibilitychange", handleVisibilityChange);

  // Smoothly interpolate background if data-theme toggles at runtime
  const themeObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.attributeName === "data-theme") {
        engine.updateThemeColor();
      }
    });
  });
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
}
