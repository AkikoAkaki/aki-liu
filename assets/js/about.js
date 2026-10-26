import { gsap } from "./modules/vendor-gsap-3.13.0.js";
import { media, QUERIES } from "./modules/media.js";
import { initAboutGallery } from "./modules/about-gallery.js";
import { initAboutPinboard } from "./modules/about-pinboard.js";

function initScrollReveal() {
  const motion = media(QUERIES.reducedMotion);
  const targets = document.querySelectorAll(".af-page .reveal-on-scroll, .af-page .reveal-pin");
  const animations = new Set();
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(({ target, isIntersecting }) => {
      if (!isIntersecting) return;
      observer.unobserve(target);
      target.classList.add("is-revealed");
      if (motion.matches) return;
      const animation = gsap.fromTo(target, { opacity: 0, y: 14 }, {
        opacity: 1,
        y: 0,
        duration: 0.48,
        delay: parseFloat(target.style.getPropertyValue("--reveal-delay") || "0") / 1000,
        ease: "power2.out",
        clearProps: "opacity,transform",
        onComplete: () => animations.delete(animation),
      });
      animations.add(animation);
    });
  }, { rootMargin: "0px 0px -24px 0px", threshold: 0 });

  targets.forEach((target) => observer.observe(target));
  motion.addEventListener("change", () => {
    if (!motion.matches) return;
    animations.forEach((animation) => animation.progress(1));
    animations.clear();
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initAboutGallery();
  initAboutPinboard();
  initScrollReveal();
});
