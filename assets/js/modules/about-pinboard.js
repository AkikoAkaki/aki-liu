import { gsap } from "./vendor-gsap-3.13.0.js";
import { Flip } from "./vendor-flip-3.13.0.js";
import { Draggable } from "./vendor-draggable-3.13.0.js";
import { QUERIES } from "./media.js";

gsap.registerPlugin(Flip, Draggable);

export function initAboutPinboard() {
  const canvas = document.getElementById("about-pinboard-canvas");
  const summary = document.getElementById("about-summary");
  if (!canvas || !summary) return;
  const pinboard = canvas.closest(".af-pinboard-section");
  const cards = [...document.querySelectorAll(".af-card-position")];
  cards.forEach((el) => {
    const angle = parseFloat(el.style.getPropertyValue("--pin-rot"));
    el.style.setProperty("--hover-rot", angle < 0 ? "-0.8deg" : "0.8deg");
  });
  const fliers = [...summary.querySelectorAll("[data-flier]")].map((el) => ({
    el,
    slot: el.parentElement,
    target: canvas.querySelector(`[data-target-for="${el.dataset.flier}"]`),
  }));
  const originalStyles = new Map(cards.map((el) => [el, el.style.cssText]));
  const layouts = gsap.matchMedia();

  layouts.add({ desktop: QUERIES.aboutDesktop, reduced: QUERIES.reducedMotion }, (context) => {
    if (!context.conditions.desktop) return;
    const drags = new Map();
    let flight = null;
    let textMotion = [];
    let topZ = 40;
    let phase = "waiting";
    canvas.dataset.phase = phase;

    function bounds(el) {
      const width = el.offsetWidth;
      const height = el.offsetHeight;
      return {
        minX: Math.min(0, -width * 0.6 - el.offsetLeft),
        maxX: Math.max(0, canvas.clientWidth - width * 0.4 - el.offsetLeft),
        minY: Math.min(0, -height * 0.6 - el.offsetTop),
        maxY: Math.max(0, canvas.clientHeight - height * 0.4 - el.offsetTop),
      };
    }

    function makeDraggable(el) {
      const [drag] = Draggable.create(el, {
        type: "x,y",
        cursor: "grab",
        activeCursor: "grabbing",
        minimumMovement: 4,
        dragClickables: true,
        zIndexBoost: false,
        bounds: bounds(el),
        onPress() {
          el.style.zIndex = String(++topZ);
        },
        onDragStart() { el.dataset.dragging = "true"; },
        onRelease() { delete el.dataset.dragging; },
      });
      drags.set(el, drag);
    }

    canvas.querySelectorAll(".af-card-position").forEach(makeDraggable);

    function finishFlight() {
      phase = "landed";
      canvas.dataset.phase = phase;
      fliers.forEach(({ el }) => {
        el.classList.remove("is-flying");
        makeDraggable(el);
      });
    }

    context.add("fly", () => {
      if (phase !== "waiting") return;
      phase = "flying";
      canvas.dataset.phase = phase;
      const blocks = [...summary.querySelectorAll(".af-now-block")];
      const firstRects = blocks.map((block) => block.getBoundingClientRect());
      const elements = [pinboard, ...fliers.map(({ el }) => el)];
      const state = context.conditions.reduced ? null : Flip.getState(elements);
      const widths = fliers.map(({ el }) => el.offsetWidth);

      fliers.forEach(({ el, target }, position) => {
        canvas.appendChild(el);
        el.classList.add("is-flying");
        Object.assign(el.style, {
          position: "absolute",
          top: `${target.dataset.landTop}px`,
          left: `${target.dataset.landLeft}px`,
          width: `${widths[position]}px`,
        });
        el.style.setProperty("--pin-rot", `${target.dataset.landRot}deg`);
      });
      summary.classList.add("is-flown");
      canvas.classList.add("is-loaded");

      if (context.conditions.reduced) {
        finishFlight();
        return;
      }
      // Text adopts its final wrapping once, then moves without scaling the glyphs.
      textMotion = blocks.map((block, position) => {
        const first = firstRects[position];
        const last = block.getBoundingClientRect();
        return block.animate([
          { transform: `translate(${first.left - last.left}px, ${first.top - last.top}px)` },
          { transform: "none" },
        ], { duration: 620, easing: "cubic-bezier(0.65, 0, 0.35, 1)" });
      });
      flight = Flip.from(state, {
        duration: 0.78,
        ease: "power3.inOut",
        nested: true,
        scale: false,
        onComplete: finishFlight,
      });
    });

    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.15)) return;
      observer.disconnect();
      context.fly();
    }, { threshold: 0.15 });
    observer.observe(canvas);

    let canvasWidth = canvas.getBoundingClientRect().width;
    const resize = new ResizeObserver(() => {
      const width = canvas.getBoundingClientRect().width;
      if (Math.abs(width - canvasWidth) < 1) return;
      canvasWidth = width;
      if (phase === "flying") {
        flight?.progress(1);
        textMotion.forEach((animation) => animation.finish());
      }
      drags.forEach((drag, el) => drag.applyBounds(bounds(el)));
    });
    resize.observe(canvas);

    return () => {
      observer.disconnect();
      resize.disconnect();
      flight?.kill();
      textMotion.forEach((animation) => animation.cancel());
      drags.forEach((drag) => drag.kill());
      fliers.forEach(({ el, slot }) => slot.appendChild(el));
      cards.forEach((el) => {
        el.style.cssText = originalStyles.get(el);
        el.classList.remove("is-flying");
        delete el.dataset.dragging;
      });
      summary.classList.remove("is-flown");
      canvas.classList.remove("is-loaded");
      delete canvas.dataset.phase;
    };
  });
}
