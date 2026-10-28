import { media, QUERIES } from "./modules/media.js";
import { initAboutGallery } from "./modules/about-gallery.js";
const pinboardSrc = document.currentScript?.dataset.pinboardSrc;

function initPinboardLoader() {
  const canvas = document.getElementById("about-pinboard-canvas");
  if (!canvas || !pinboardSrc) return;
  const desktop = media(QUERIES.aboutDesktop);
  let pending = false;
  let initialized = false;
  const observer = new IntersectionObserver(async entries => {
    if (!desktop.matches || pending || initialized || !entries.some(entry => entry.isIntersecting)) return;
    pending = true;
    try {
      const { initAboutPinboard } = await import(pinboardSrc);
      initAboutPinboard();
      initialized = true;
      observer.disconnect();
      desktop.removeEventListener("change", watch);
    } catch (error) {
      console.error("Pinboard could not load", error);
    } finally { pending = false; }
  }, { rootMargin: "600px 0px" });
  function watch() { observer.unobserve(canvas); observer.observe(canvas); }
  desktop.addEventListener("change", watch);
  watch();
}

function initScrollReveal() {
  const motion = media(QUERIES.reducedMotion);
  const pending = new Set();
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(({ target, isIntersecting }) => {
      if (!isIntersecting) return;
      observer.unobserve(target);
      target.classList.remove("is-enter-pending");
      pending.delete(target);
    });
  }, { threshold: 0 });

  if (!motion.matches) {
    document.querySelectorAll(".af-enter").forEach((target) => {
      // Never hide something the visitor can already see.
      if (target.getBoundingClientRect().top < innerHeight) return;
      target.classList.add("is-enter-pending");
      pending.add(target);
      observer.observe(target);
    });
  }
  motion.addEventListener("change", () => {
    if (!motion.matches) return;
    observer.disconnect();
    pending.forEach((target) => target.classList.remove("is-enter-pending"));
    pending.clear();
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initAboutGallery();
  initPinboardLoader();
  initScrollReveal();
});
