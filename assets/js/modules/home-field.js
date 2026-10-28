import { media, QUERIES } from "./media.js";
import { characters, makeAtlas } from "./home-field-atlas.js";

export async function initHomeField(workerSrc, fallbackSrc) {
  const host = document.querySelector(".site-wrapper");
  if (!host || !document.querySelector(".home-container")) return;
  const offscreen = workerSrc && HTMLCanvasElement.prototype.transferControlToOffscreen && typeof Worker === "function";
  const createFieldRenderer = offscreen ? null : (await import(fallbackSrc)).createFieldRenderer;
  const canvas = document.createElement("canvas");
  canvas.className = "home-field";
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.cssText = "opacity:0.35;pointer-events:none;border-radius:inherit;z-index:-1";
  host.style.isolation = "isolate";
  host.prepend(canvas);
  const reduced = media(QUERIES.reducedMotion);
  let worker = null, renderer = null, surface = null;
  let disposed = false, version = 0, sizeKey = "", pointerFrame = 0;
  let initialized = false, latestPointer = null;
  let width = 0, height = 0;

  function send(message, transfer = []) {
    if (disposed) return;
    if (worker) worker.postMessage(message, transfer);
    else if (message.type === "init") {
      renderer?.destroy();
      renderer = createFieldRenderer(canvas, message.settings, receive);
    } else if (message.type === "update") renderer?.update(message.settings);
    else if (message.type === "pointer") renderer?.pointer(message.point);
  }
  function receive(message) {
    if (disposed) return;
    if (message.type === "ready") canvas.classList.add("is-ready");
    else if (message.type === "restore") geometry(true).catch(fail);
    else if (message.type === "unsupported") dispose();
    else if (message.type === "error") fail(new Error(message.message));
  }
  function state() {
    return {
      dark: document.documentElement.dataset.theme === "dark",
      mobile: innerWidth < 760,
      reduced: reduced.matches,
      visible: !document.hidden,
    };
  }
  async function geometry(restart = false) {
    if (!width || !height || disposed) return;
    const ratio = Math.min(devicePixelRatio || 1, 1.5, Math.sqrt(8294400 / (width * height)));
    const key = `${width}:${height}:${ratio}`;
    if (!restart && key === sizeKey) return;
    sizeKey = key;
    const current = ++version;
    const cellHeight = Math.max(2, Math.round(13 * ratio));
    const cellWidth = Math.max(2, Math.round(cellHeight * 0.62));
    const atlas = await makeAtlas(cellWidth, cellHeight);
    if (disposed || current !== version) { atlas.close(); return; }
    const settings = {
      ...state(), width: Math.max(1, Math.round(width * ratio)), height: Math.max(1, Math.round(height * ratio)),
      cellWidth, cellHeight, columns: characters.length, characters: characters.length, atlas,
    };
    const message = { type: !initialized || restart ? "init" : "update", settings };
    const transfer = [atlas];
    if (surface) { message.canvas = surface; transfer.push(surface); surface = null; }
    send(message, transfer);
    initialized = true;
  }
  function syncState() { if (initialized) send({ type: "update", settings: state() }); }
  function move(event) {
    if (reduced.matches) return;
    latestPointer = event;
    if (pointerFrame) return;
    pointerFrame = requestAnimationFrame(() => {
      pointerFrame = 0;
      const rect = canvas.getBoundingClientRect();
      const x = (latestPointer.clientX - rect.left) / rect.width;
      const y = 1 - (latestPointer.clientY - rect.top) / rect.height;
      send({ type: "pointer", point: x >= -0.05 && x <= 1.05 && y >= -0.05 && y <= 1.05 ? [x, y] : null });
    });
  }
  function leave() {
    if (pointerFrame) cancelAnimationFrame(pointerFrame);
    pointerFrame = 0;
    send({ type: "pointer", point: null });
  }
  function resized(entries) {
    if (entries?.[0]) {
      width = Math.round(entries[0].contentRect.width);
      height = Math.round(entries[0].contentRect.height);
    }
    geometry().catch(fail);
  }
  function pageHide(event) { if (event.persisted) send({ type: "update", settings: { visible: false } }); else dispose(); }
  function fail(error) { console.error("Homepage field:", error); dispose(); }
  function dispose() {
    if (disposed) return;
    disposed = true;
    if (pointerFrame) cancelAnimationFrame(pointerFrame);
    worker?.terminate(); renderer?.destroy(); canvas.remove();
    observer.disconnect(); theme.disconnect();
    host.removeEventListener("pointermove", move); host.removeEventListener("pointerleave", leave);
    reduced.removeEventListener("change", syncState);
    document.removeEventListener("visibilitychange", syncState);
    window.removeEventListener("resize", resized); window.removeEventListener("pagehide", pageHide); window.removeEventListener("pageshow", syncState);
  }
  const observer = new ResizeObserver(resized);
  const theme = new MutationObserver(syncState);
  if (offscreen) {
    worker = new Worker(workerSrc, { name: "homepage-field" });
    worker.onmessage = ({ data }) => receive(data);
    worker.onerror = fail;
    surface = canvas.transferControlToOffscreen();
    canvas.dataset.renderer = "worker-field";
  } else canvas.dataset.renderer = "direct-field";
  observer.observe(canvas);
  theme.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  reduced.addEventListener("change", syncState);
  host.addEventListener("pointermove", move, { passive: true });
  host.addEventListener("pointerleave", leave, { passive: true });
  document.addEventListener("visibilitychange", syncState);
  window.addEventListener("resize", resized);
  window.addEventListener("pagehide", pageHide);
  window.addEventListener("pageshow", syncState);
}
