import EmblaCarousel from "./vendor-embla-8.6.0.js";
import { media, QUERIES } from "./media.js";

// These scalar tweens retain GSAP's cubic/quartic ease-out without its runtime.
function tweenOffset(motion, { offset, duration, power, onUpdate, onComplete, onInterrupt }) {
  const from = motion.offset;
  const start = performance.now();
  let frame;
  let finished = false;
  function tick(now) {
    const progress = Math.min(1, (now - start) / (duration * 1000));
    motion.offset = from + (offset - from) * (1 - (1 - progress) ** power);
    onUpdate();
    if (progress < 1) frame = requestAnimationFrame(tick);
    else { finished = true; onComplete?.(); }
  }
  frame = requestAnimationFrame(tick);
  return { kill() {
    if (finished) return;
    finished = true;
    cancelAnimationFrame(frame);
    onInterrupt?.();
  } };
}

export function initAboutGallery() {
  const root = document.querySelector("[data-about-sequence]");
  if (!root) return;
  const viewport = root.querySelector(".af-sequence-layer");
  const track = root.querySelector("[data-about-sequence-track]");
  const items = [...track.children];
  const cover = root.querySelector(".af-photo-base img");
  const status = root.querySelector("[data-gallery-status]");
  const desktop = media("(min-width: 769px) and (hover: hover) and (pointer: fine)");
  const reducedMotion = media(QUERIES.reducedMotion);
  const images = items.map((item) => item.querySelector("img"));
  const decoded = new Map();
  let index = Number(root.dataset.initialIndex);
  let coverIndex = index;
  let carousel = null;
  let expanded = false;
  let settling = false;
  let pointerInside = false;
  let keyboardActive = false;
  let openRequest = 0;
  let closeRequest = 0;
  let coverRequest = 0;
  let coverTransition = null;
  let snapTween = null;
  let wheelTween = null;
  const wheelMotion = { offset: 0 };
  let wheelTarget = 0;
  let wheelPosition = 0;

  const wrap = (value) => (value + items.length) % items.length;

  function loadImage(position) {
    const image = images[wrap(position)];
    if (!decoded.has(image)) {
      image.src = image.dataset.src;
      decoded.set(image, image.decode().then(() => true, () => false));
    }
    return decoded.get(image);
  }

  function describe(position) {
    const item = items[position];
    root.querySelectorAll("[data-cover-caption]").forEach((caption) => {
      caption.textContent = item.querySelector(`[data-caption="${caption.dataset.coverCaption}"]`).textContent;
    });
    status.textContent = `${position + 1} / ${items.length} · ${images[position].alt}`;
  }

  async function showCover(position, animate = false) {
    const request = ++coverRequest;
    if (!(await loadImage(position)) || request !== coverRequest) return;
    if (coverTransition) await coverTransition.finished;
    if (request !== coverRequest) return;
    const image = images[position];
    const ratio = items[position].querySelector(".af-sequence-photo").style.aspectRatio;
    const commit = () => {
      cover.src = image.src;
      cover.alt = image.alt;
      coverIndex = position;
      root.style.aspectRatio = ratio;
      if (!expanded || settling) describe(position);
    };

    if (!animate || reducedMotion.matches || coverIndex === position) {
      commit();
    } else {
      const { width, height } = root.getBoundingClientRect();
      const incoming = image.cloneNode();
      incoming.className = "af-photo-incoming";
      incoming.removeAttribute("data-src");
      incoming.alt = "";
      incoming.setAttribute("aria-hidden", "true");
      cover.after(incoming);
      root.style.aspectRatio = ratio;
      const options = { duration: 320, easing: "cubic-bezier(0.22, 1, 0.36, 1)" };
      const animations = [
        root.animate([{ height: `${height}px` }, {
          height: `${width * image.naturalHeight / image.naturalWidth}px`,
        }], options),
        incoming.animate([{ opacity: 0 }, { opacity: 1 }], options),
      ];
      const transition = { animations, finished: null };
      transition.finished = Promise.all(animations.map((animation) => animation.finished)).then(() => {
        commit();
        incoming.remove();
        coverTransition = null;
      });
      coverTransition = transition;
      await transition.finished;
    }
    loadImage(position - 1);
    loadImage(position + 1);
  }

  function selected() {
    if (carousel) index = carousel.selectedScrollSnap();
    root.dataset.currentIndex = String(index);
    items.forEach((item, position) => item.classList.toggle("is-current", position === index));
    if (expanded) describe(index);
  }

  function goTo(position) {
    stopWheel();
    if (carousel) carousel.scrollTo(wrap(position));
    else {
      index = wrap(position);
      selected();
      showCover(index, true);
    }
  }

  function syncScroll() {
    const engine = carousel.internalEngine();
    engine.animation.stop();
    const position = engine.offsetLocation.get();
    engine.location.set(position);
    engine.previousLocation.set(position);
    engine.target.set(position);
    engine.scrollBody.useDuration(0);
    return engine;
  }

  function moveBy(distance) {
    const engine = syncScroll();
    const delta = engine.options.loop ? distance % engine.limit.length : distance;
    engine.scrollTo.distance(delta, false);
  }

  function stopWheel() {
    wheelTween?.kill();
    wheelTween = null;
    wheelMotion.offset = 0;
    wheelTarget = 0;
    wheelPosition = 0;
  }

  function scrollWheel(distance) {
    wheelTarget += distance;
    wheelTween?.kill();
    wheelTween = tweenOffset(wheelMotion, {
      offset: wheelTarget, duration: 0.09, power: 3,
      onUpdate() {
        moveBy(wheelMotion.offset - wheelPosition);
        wheelPosition = wheelMotion.offset;
      },
      onComplete: stopWheel,
    });
  }

  function snapTo(position) {
    const engine = syncScroll();
    const distance = engine.scrollTarget.byIndex(position, 0).distance;
    if (Math.abs(distance) < 0.01) return Promise.resolve();
    const motion = { offset: 0 };
    let previous = 0;
    return new Promise((resolve) => {
      snapTween = tweenOffset(motion, {
        offset: distance, duration: 0.36, power: 4,
        onUpdate() {
          moveBy(motion.offset - previous);
          previous = motion.offset;
        },
        onComplete: resolve,
        onInterrupt: resolve,
      });
    });
  }

  async function open() {
    if (!carousel) return;
    closeRequest += 1;
    snapTween?.kill();
    settling = false;
    if (expanded) return;
    const wasVisible = root.classList.contains("is-sequence-closing");
    const request = ++openRequest;
    const ready = await Promise.all(images.map((_, position) => loadImage(position)));
    if (request !== openRequest || !carousel || !ready[index] || (!pointerInside && !keyboardActive)) return;
    const rect = root.getBoundingClientRect();
    const center = rect.top + rect.height / 2;
    // Include all visible neighbors before asking Embla to position its loop boundaries.
    if (!wasVisible) {
      viewport.style.height = `${Math.ceil(2 * Math.max(center, innerHeight - center) + 56)}px`;
      carousel.reInit({ startIndex: index });
    }
    expanded = true;
    describe(index);
    root.classList.remove("is-sequence-closing");
    root.classList.add("is-sequence-open");
    document.body.classList.add("about-sequence-open");
  }

  async function close(immediate = false) {
    openRequest += 1;
    if (!immediate && (!expanded || settling)) return;
    stopWheel();
    const request = ++closeRequest;
    if (immediate) {
      snapTween?.kill();
      expanded = false;
      settling = false;
      root.classList.remove("is-sequence-open");
      root.classList.remove("is-sequence-closing");
      document.body.classList.remove("about-sequence-open");
      return;
    }
    settling = true;
    const engine = syncScroll();
    const nearest = engine.scrollTarget.byDistance(0, false).index;
    await Promise.all([snapTo(nearest), showCover(nearest, true)]);
    if (request !== closeRequest || !carousel) return;
    expanded = false;
    settling = false;
    root.classList.remove("is-sequence-open");
    root.classList.add("is-sequence-closing");
    Promise.allSettled(viewport.getAnimations().map((animation) => animation.finished)).then(() => {
      if (expanded || request !== closeRequest) return;
      root.classList.remove("is-sequence-closing");
      document.body.classList.remove("about-sequence-open");
    });
  }

  function configure() {
    close(true);
    coverTransition?.animations.forEach((animation) => animation.finish());
    carousel?.destroy();
    carousel = null;
    showCover(index);
    const useSequence = desktop.matches && !reducedMotion.matches;
    root.classList.toggle("is-tap-gallery", !useSequence);
    if (useSequence) {
      carousel = EmblaCarousel(viewport, {
        container: track, axis: "y", align: "center", loop: true,
        startIndex: index, duration: 24, watchDrag: false, watchFocus: false,
      });
      carousel.on("select", selected).on("reInit", selected);
    }
    selected();
  }

  root.addEventListener("pointerenter", () => { pointerInside = true; open(); });
  root.addEventListener("pointerdown", () => { keyboardActive = false; });
  root.addEventListener("pointerleave", () => {
    pointerInside = false;
    if (!keyboardActive) close();
  });
  root.addEventListener("focusin", () => {
    if (!pointerInside && root.matches(":focus-visible")) {
      keyboardActive = true;
      open();
    }
  });
  root.addEventListener("focusout", () => {
    keyboardActive = false;
    if (!pointerInside) close();
  });
  root.addEventListener("click", () => {
    if (!carousel) goTo(index + 1);
  });
  root.addEventListener("keydown", (event) => {
    if (event.ctrlKey || event.altKey || event.metaKey) return;
    if (event.key === "Escape") {
      keyboardActive = false;
      close();
    } else {
      const next = { ArrowUp: index - 1, ArrowLeft: index - 1,
        ArrowDown: index + 1, ArrowRight: index + 1, Home: 0, End: items.length - 1 }[event.key];
      if (next === undefined) return;
      keyboardActive = true;
      open();
      goTo(next);
    }
    event.preventDefault();
  });
  root.addEventListener("wheel", (event) => {
    if (!expanded || (!pointerInside && !keyboardActive) || event.ctrlKey || event.metaKey || !event.cancelable ||
        Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    event.preventDefault();
    closeRequest += 1;
    snapTween?.kill();
    settling = false;
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1;
    const distance = event.deltaY * unit;
    scrollWheel(-distance);
  }, { passive: false });
  desktop.addEventListener("change", configure);
  reducedMotion.addEventListener("change", configure);
  configure();
  root.classList.add("is-gallery-ready");
}
