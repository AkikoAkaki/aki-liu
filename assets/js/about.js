import { media, QUERIES } from "./modules/media.js";
import { initAboutGallery } from "./modules/about-gallery.js";
import { initAboutPinboard } from "./modules/about-pinboard.js";

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
  initAboutPinboard();
  initScrollReveal();
});
