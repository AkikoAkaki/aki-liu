import { gsap } from "./vendor-gsap-3.13.0.js";
import { Flip } from "./vendor-flip-3.13.0.js";
import { Draggable } from "./vendor-draggable-3.13.0.js";
import { QUERIES } from "./media.js";

gsap.registerPlugin(Flip, Draggable);

export function initAboutPinboard() {
  const canvas = document.getElementById("about-pinboard-canvas");
  const summary = document.getElementById("about-summary");
  if (!canvas || !summary) return;
  const blocks = [...summary.querySelectorAll(".af-now-block")];
  const layoutStyles = new Map([summary, canvas, ...blocks].map((el) => [el, el.style.cssText]));
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
      summary.style.removeProperty("height");
      canvas.style.removeProperty("height");
      canvas.style.removeProperty("min-height");
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
      const firstRects = blocks.map((block) => block.getBoundingClientRect());
      const summaryHeight = summary.offsetHeight;
      const canvasHeight = canvas.offsetHeight;
      const blockWidths = blocks.map((block) => block.offsetWidth);
      const state = context.conditions.reduced ? null : Flip.getState(fliers.map(({ el }) => el));
      const widths = fliers.map(({ el }) => el.offsetWidth);

      // Reserve the old flow before moving cards; text keeps its original wrapping.
      summary.style.height = `${summaryHeight}px`;
      summary.style.setProperty("--summary-width", `${Math.max(...blockWidths)}px`);
      canvas.style.height = `${canvasHeight}px`;
      canvas.style.minHeight = "0px";
      blocks.forEach((block, position) => { block.style.width = `${blockWidths[position]}px`; });

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

      summary.style.removeProperty("height");
      const finalSummaryHeight = summary.offsetHeight;
      summary.style.height = `${summaryHeight}px`;
      canvas.style.removeProperty("height");
      canvas.style.removeProperty("min-height");
      const finalCanvasHeight = canvas.offsetHeight;
      canvas.style.height = `${canvasHeight}px`;
      canvas.style.minHeight = "0px";

      if (context.conditions.reduced) {
        finishFlight();
        return;
      }
      const timing = { duration: 0.78, ease: "power3.inOut" };
      flight = gsap.timeline({ onComplete: finishFlight });
      blocks.forEach((block, position) => {
        const first = firstRects[position];
        const last = block.getBoundingClientRect();
        flight.fromTo(block, { x: first.left - last.left, y: first.top - last.top },
          { x: 0, y: 0, ...timing, clearProps: "transform" }, 0);
      });
      flight.to(summary, { height: finalSummaryHeight, ...timing }, 0);
      flight.to(canvas, { height: finalCanvasHeight, ...timing }, 0);
      flight.add(Flip.from(state, { ...timing, scale: false }), 0);
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
      }
      drags.forEach((drag, el) => drag.applyBounds(bounds(el)));
    });
    resize.observe(canvas);

    return () => {
      observer.disconnect();
      resize.disconnect();
      flight?.kill();
      drags.forEach((drag) => drag.kill());
      fliers.forEach(({ el, slot }) => slot.appendChild(el));
      cards.forEach((el) => {
        el.style.cssText = originalStyles.get(el);
        el.classList.remove("is-flying");
        delete el.dataset.dragging;
      });
      layoutStyles.forEach((style, el) => { el.style.cssText = style; });
      summary.classList.remove("is-flown");
      canvas.classList.remove("is-loaded");
      delete canvas.dataset.phase;
    };
  });
}
