import EmblaCarousel from "./vendor-embla-8.6.0.js";
import { media, QUERIES } from "./media.js";

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
  let anchorIndex = index;
  let carousel = null;
  let expanded = false;
  let pointerInside = false;
  let keyboardActive = false;
  let openRequest = 0;
  let coverRequest = 0;
  let coverTransition = null;
  let gesture = { time: 0, direction: 0, distance: 0, consumed: false };

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
      describe(position);
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
    if (carousel) carousel.scrollTo(wrap(position));
    else {
      index = wrap(position);
      selected();
      showCover(index, true);
    }
  }

  async function open() {
    if (!carousel || expanded) return;
    const request = ++openRequest;
    const ready = await Promise.all(images.map((_, position) => loadImage(position)));
    if (request !== openRequest || !carousel || !ready[index] || (!pointerInside && !keyboardActive)) return;
    const rect = root.getBoundingClientRect();
    const center = rect.top + rect.height / 2;
    // Include all visible neighbors before asking Embla to position its loop boundaries.
    viewport.style.height = `${Math.ceil(2 * Math.max(center, innerHeight - center) + 56)}px`;
    carousel.reInit({ startIndex: index });
    expanded = true;
    describe(index);
    root.classList.remove("is-sequence-closing");
    root.classList.add("is-sequence-open");
    document.body.classList.add("about-sequence-open");
  }

  function close(immediate = false) {
    const wasExpanded = expanded;
    openRequest += 1;
    expanded = false;
    root.classList.remove("is-sequence-open");
    if (carousel) describe(anchorIndex);
    if (immediate) {
      root.classList.remove("is-sequence-closing");
      document.body.classList.remove("about-sequence-open");
      return;
    }
    if (!wasExpanded && !root.classList.contains("is-sequence-closing")) return;
    root.classList.add("is-sequence-closing");
    Promise.allSettled(viewport.getAnimations().map((animation) => animation.finished)).then(() => {
      if (expanded) return;
      root.classList.remove("is-sequence-closing");
      document.body.classList.remove("about-sequence-open");
    });
  }

  function configure() {
    close(true);
    coverTransition?.animations.forEach((animation) => animation.finish());
    carousel?.destroy();
    carousel = null;
    anchorIndex = index;
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
    if (!expanded || event.ctrlKey || event.metaKey || !event.cancelable ||
        Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    event.preventDefault();
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? root.clientHeight : 1;
    const distance = event.deltaY * unit;
    const direction = Math.sign(distance);
    const time = performance.now();
    if (time - gesture.time > 160 || direction !== gesture.direction) {
      gesture = { time, direction, distance: 0, consumed: false };
    }
    gesture.time = time;
    gesture.distance += distance;
    if (!gesture.consumed && Math.abs(gesture.distance) >= 48) {
      gesture.consumed = true;
      goTo(index + direction);
    }
  }, { passive: false });
  desktop.addEventListener("change", configure);
  reducedMotion.addEventListener("change", configure);
  configure();
  root.classList.add("is-gallery-ready");
}
