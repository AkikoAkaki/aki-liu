// Fallback for browsers without animation-timeline: view(). Mirrors the
// footer-reveal keyframes in layout.css so the bottom reveal looks the same.
// When the browser supports view timelines, the CSS animation runs and this
// does nothing.
export function initFooterRevealFallback() {
  if (CSS.supports("animation-timeline: view()")) return;

  const footer = document.querySelector(".site-footer");
  const page = document.querySelector(".site-wrapper");
  const content = footer?.querySelector(".footer-content");
  if (!footer || !page || !content) return;

  const desktop = window.matchMedia("(min-width: 901px)");
  const curve = parseFloat(getComputedStyle(footer).getPropertyValue("--footer-curve")) || 40;
  let frame = 0;
  let pinned = false;

  // While the footer is coming into view, its content is position: fixed to
  // the bottom of the screen. Moving it with a transform on every scroll event
  // lags a frame behind the browser's scrolling and makes it shake.
  // The footer keeps the content's height as bottom padding, kept current
  // when fonts load or the layout changes.
  const holdSpace = () => {
    footer.style.paddingBottom = pinned ? `${content.offsetHeight}px` : "";
  };
  new ResizeObserver(holdSpace).observe(content);

  const setPinned = (next) => {
    if (next === pinned) return;
    pinned = next;
    holdSpace();
    footer.style.clipPath = next ? "inset(0)" : "";
    Object.assign(content.style, next
      ? { position: "fixed", left: "0", right: "0", bottom: "0" }
      : { position: "", left: "", right: "", bottom: "" });
  };

  const update = () => {
    frame = 0;
    // 0 when the footer's top edge reaches the bottom of the screen,
    // 1 when the footer is fully on screen.
    const progress = Math.min(Math.max((window.innerHeight - footer.getBoundingClientRect().top) / footer.offsetHeight, 0), 1);
    const eased = 1 - (1 - progress) ** 3;

    page.style.borderBottomLeftRadius = `${curve * eased}px`;
    page.style.borderBottomRightRadius = `${curve * eased}px`;
    page.style.transform = desktop.matches ? `scaleX(${1 - 0.044 * eased})` : "";
    setPinned(progress < 1);
  };

  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(update);
  };

  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", () => {
    setPinned(false);
    schedule();
  });
  update();
}
