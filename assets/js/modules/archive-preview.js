import { loadKatex, renderMath } from "./katex.js";
import { media, QUERIES } from "./media.js";

export function initArchivePreview(list) {
  const container = document.getElementById("archive-preview-container");
  const source = list.dataset.archivePreviewSrc;
  if (!container || !source) return { clear() {} };

  const enabled = media("(min-width: 1201px)");
  const reducedMotion = media(QUERIES.reducedMotion);
  const panel = container.closest(".site-sidebar-right");
  const katexBase = list.dataset.katexBase;
  let previews = null;
  let hoveredItem = null;
  let focusedItem = null;
  let desiredItem = null;
  let renderedItem = null;
  let panelHovered = false;
  let hoverTimer = 0;
  let leaveTimer = 0;
  let fitFrame = 0;
  let requestToken = 0;
  let content = null;
  const transitions = [];

  function loadPreviews() {
    if (!previews) {
      previews = fetch(source)
        .then((response) => {
          if (!response.ok) throw new Error("HTTP " + response.status);
          return response.json();
        })
        .then((entries) => new Map(entries.map((entry) => [entry.url, entry])))
        .catch((error) => {
          previews = null;
          throw error;
        });
    }
    return previews;
  }

  function fitPreview() {
    if (fitFrame) return;
    fitFrame = requestAnimationFrame(() => {
      fitFrame = 0;
      container.classList.toggle("is-truncated", Boolean(content && content.scrollHeight > container.clientHeight + 1));
    });
  }

  const observer = new ResizeObserver(fitPreview);
  observer.observe(container);
  container.addEventListener("load", fitPreview, true);
  container.addEventListener("error", fitPreview, true);

  function cancelTransition() {
    transitions.splice(0).forEach((animation) => animation.cancel());
    container.querySelector(".preview-outgoing")?.remove();
  }

  function buildContent(entry) {
    const next = document.createElement("div");
    next.className = "preview-content";
    const title = document.createElement("h4");
    title.className = "preview-title";
    title.textContent = entry.title;
    const template = document.createElement("template");
    template.innerHTML = entry.html;
    // An inert template prevents discarded media from starting requests.
    template.content.querySelectorAll("figure.local-video, video, audio, iframe").forEach((element) => element.remove());
    template.content.querySelectorAll("[id]").forEach((element) => element.removeAttribute("id"));
    const summary = document.createElement("div");
    summary.className = "preview-summary raw-content-preview";
    summary.append(template.content);
    next.append(title, summary);
    if (entry.math) renderMath(next);
    return next;
  }

  async function render(item, token) {
    let entry;
    try {
      const url = item.querySelector(".item-title").getAttribute("href");
      entry = (await loadPreviews()).get(url);
      if (entry?.math) await loadKatex(katexBase);
    } catch {
      if (token === requestToken) desiredItem = null;
      return;
    }
    if (token !== requestToken || item.hidden || !entry || !enabled.matches) return;

    const next = buildContent(entry);
    cancelTransition();
    const previous = content;
    if (previous) observer.unobserve(previous);
    content = next;
    renderedItem = item;
    container.replaceChildren(next);
    observer.observe(next);
    fitPreview();

    if (!reducedMotion.matches) {
      transitions.push(next.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: "ease-out" }));
      if (previous) {
        previous.classList.add("preview-outgoing");
        previous.inert = true;
        previous.setAttribute("aria-hidden", "true");
        container.append(previous);
        const fade = previous.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 140, fill: "forwards" });
        transitions.push(fade);
        fade.addEventListener("finish", () => previous.remove(), { once: true });
      }
    }
  }

  function clear() {
    clearTimeout(hoverTimer);
    clearTimeout(leaveTimer);
    requestToken++;
    desiredItem = null;
    renderedItem = null;
    hoveredItem = null;
    focusedItem = null;
    panelHovered = false;
    cancelTransition();
    if (content) observer.unobserve(content);
    content = null;
    container.replaceChildren();
    container.classList.remove("is-truncated");
  }

  function updateTarget() {
    clearTimeout(leaveTimer);
    if (!enabled.matches) return;
    const item = focusedItem || hoveredItem;
    if (!item) {
      if (panelHovered || panel.contains(document.activeElement)) return;
      clearTimeout(hoverTimer);
      hoverTimer = 0;
      requestToken++;
      desiredItem = renderedItem;
      leaveTimer = setTimeout(clear, 150);
      return;
    }
    if (item.hidden) return;
    if (desiredItem === item) {
      if (focusedItem && hoverTimer) {
        clearTimeout(hoverTimer);
        hoverTimer = 0;
        render(item, requestToken);
      }
      return;
    }
    clearTimeout(hoverTimer);
    hoverTimer = 0;
    desiredItem = item;
    const token = ++requestToken;
    if (renderedItem === item) return;
    if (focusedItem) render(item, token);
    else hoverTimer = setTimeout(() => {
      hoverTimer = 0;
      render(item, token);
    }, 100);
  }

  function itemFrom(node) {
    if (!(node instanceof Element)) return null;
    const item = node.closest(".archive-item");
    return item && item.parentElement === list ? item : null;
  }

  list.addEventListener("pointerenter", (event) => {
    if (enabled.matches && event.pointerType !== "touch") loadPreviews().catch(() => {});
  }, { passive: true });
  list.addEventListener("pointerover", (event) => {
    if (event.pointerType === "touch") return;
    hoveredItem = itemFrom(event.target);
    updateTarget();
  }, { passive: true });
  list.addEventListener("pointerout", (event) => {
    if (event.pointerType === "touch") return;
    hoveredItem = itemFrom(event.relatedTarget);
    updateTarget();
  }, { passive: true });
  list.addEventListener("focusin", (event) => {
    focusedItem = itemFrom(event.target);
    updateTarget();
  });
  list.addEventListener("focusout", (event) => {
    focusedItem = itemFrom(event.relatedTarget);
    updateTarget();
  });
  panel.addEventListener("pointerenter", () => { panelHovered = true; updateTarget(); });
  panel.addEventListener("pointerleave", () => { panelHovered = false; updateTarget(); });
  panel.addEventListener("focusin", () => { clearTimeout(leaveTimer); });
  panel.addEventListener("focusout", () => { queueMicrotask(updateTarget); });
  enabled.addEventListener("change", () => {
    clear();
    if (enabled.matches) {
      focusedItem = itemFrom(document.activeElement);
      updateTarget();
    }
  });
  reducedMotion.addEventListener("change", cancelTransition);
  return { clear };
}
