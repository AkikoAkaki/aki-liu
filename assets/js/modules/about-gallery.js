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
  let carousel = null;
  let expanded = false;
  let wantsOpen = false;
  let coverRequest = 0;
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

  async function updateCover() {
    const request = ++coverRequest;
    const selected = index;
    if (!(await loadImage(selected)) || request !== coverRequest) return;
    const item = items[selected];
    cover.src = images[selected].src;
    cover.alt = images[selected].alt;
    if (!expanded) root.style.aspectRatio = item.querySelector(".af-sequence-photo").style.aspectRatio;
    root.querySelectorAll("[data-cover-caption]").forEach((caption) => {
      caption.textContent = item.querySelector(`[data-caption="${caption.dataset.coverCaption}"]`).textContent;
    });
    status.textContent = `${selected + 1} / ${items.length} · ${cover.alt}`;
    loadImage(selected - 1);
    loadImage(selected + 1);
  }

  function selected() {
    if (carousel) index = carousel.selectedScrollSnap();
    root.dataset.currentIndex = String(index);
    items.forEach((item, position) => item.classList.toggle("is-current", position === index));
    updateCover();
  }

  function goTo(position) {
    if (carousel) carousel.scrollTo(wrap(position), reducedMotion.matches);
    else {
      index = wrap(position);
      selected();
    }
  }

  async function open() {
    if (!carousel) return;
    wantsOpen = true;
    const ready = await loadImage(index);
    if (!ready || !wantsOpen || !carousel) return;
    images.forEach((_, position) => loadImage(position));
    const rect = root.getBoundingClientRect();
    const center = rect.top + rect.height / 2;
    // Loop boundaries stay outside the visible strip, even when the cover is off-center.
    viewport.style.height = `${Math.ceil(2 * Math.max(center, innerHeight - center) + 56)}px`;
    carousel.reInit({ startIndex: index });
    expanded = true;
    root.classList.add("is-sequence-open");
    document.body.classList.add("about-sequence-open");
  }

  function close() {
    wantsOpen = false;
    expanded = false;
    root.classList.remove("is-sequence-open");
    document.body.classList.remove("about-sequence-open");
    updateCover();
  }

  function configure() {
    close();
    carousel?.destroy();
    carousel = null;
    const useSequence = desktop.matches && !reducedMotion.matches;
    root.classList.toggle("is-tap-gallery", !useSequence);
    if (useSequence) {
      carousel = EmblaCarousel(viewport, {
        container: track,
        axis: "y",
        align: "center",
        loop: true,
        startIndex: index,
        duration: 24,
        watchDrag: false,
        watchFocus: false,
      });
      carousel.on("select", selected).on("reInit", selected);
    }
    selected();
  }

  root.querySelector("[data-gallery-prev]").addEventListener("click", () => goTo(index - 1));
  root.querySelector("[data-gallery-next]").addEventListener("click", () => goTo(index + 1));
  root.addEventListener("pointerenter", open);
  root.addEventListener("pointerleave", () => {
    if (!root.contains(document.activeElement)) close();
  });
  root.addEventListener("focusin", open);
  root.addEventListener("focusout", (event) => {
    if (!root.contains(event.relatedTarget)) close();
  });
  root.addEventListener("click", (event) => {
    if (event.target.closest("button")) return;
    if (carousel) open();
    else goTo(index + 1);
  });
  root.addEventListener("keydown", (event) => {
    if (event.ctrlKey || event.altKey || event.metaKey) return;
    switch (event.key) {
      case "ArrowUp": case "ArrowLeft": goTo(index - 1); break;
      case "ArrowDown": case "ArrowRight": goTo(index + 1); break;
      case "Home": goTo(0); break;
      case "End": goTo(items.length - 1); break;
      case "Escape": close(); break;
      default: return;
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
    // A burst includes the touchpad's momentum tail; reversing starts a new gesture.
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
