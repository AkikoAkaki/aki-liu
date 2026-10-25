import { loadKatex, renderMath } from "./katex.js";

// Hover preview for archive lists. Preview bodies come from one fingerprinted
// JSON per language (layouts/partials/archive-preview-index.html), fetched the
// first time the pointer enters the list. Returns clear() for the filter.
export function initArchivePreview(archiveList, archiveItems) {
  const previewContainer = document.getElementById("archive-preview-container");
  const previewSrc = archiveList.dataset.archivePreviewSrc;
  if (!previewContainer || !previewSrc) return { clear() {} };
  previewContainer.innerHTML = "";

  const katexBase = archiveList.dataset.katexBase || "/lib/katex/";
  let previewsReady = null;
  let currentHoverNode = null;
  let leaveTimeout = null;
  let hoverTimeout = null;
  let renderToken = 0;

  function loadPreviews() {
    if (!previewsReady) {
      previewsReady = fetch(previewSrc)
        .then((response) => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return response.json();
        })
        .then((entries) => new Map(entries.map((entry) => [entry.url, entry])))
        .catch((error) => {
          previewsReady = null;
          throw error;
        });
    }
    return previewsReady;
  }

  function itemURL(item) {
    return item.querySelector("a.item-title")?.getAttribute("href") || "";
  }

  function injectContent(entry) {
    const title = document.createElement("h4");
    title.className = "preview-title";
    title.textContent = entry.title;
    // Parse into an inert template so media is removed before it can load.
    const template = document.createElement("template");
    template.innerHTML = entry.html;
    template.content
      .querySelectorAll("figure.local-video, video, audio, iframe")
      .forEach((el) => el.remove());
    const summary = document.createElement("div");
    summary.className = "preview-summary raw-content-preview";
    summary.append(template.content);

    previewContainer.classList.remove("is-truncated");
    previewContainer.replaceChildren(title, summary);
    if (entry.math) {
      try {
        renderMath(previewContainer);
      } catch (e) {}
    }
  }

  async function fitPreview(token) {
    const summary = previewContainer.querySelector(".preview-summary");
    if (!summary) {
      previewContainer.classList.remove("is-truncated");
      return;
    }

    if (document.fonts && document.fonts.ready) {
      try {
        await document.fonts.ready;
      } catch (e) {}
    }
    if (token !== renderToken) return;

    const imgs = Array.from(summary.querySelectorAll("img"));
    await Promise.all(
      imgs.map((img) => {
        if (img.complete) return Promise.resolve();
        return new Promise((resolve) => {
          img.addEventListener("load", resolve, { once: true });
          img.addEventListener("error", resolve, { once: true });
        });
      }),
    );
    if (token !== renderToken) return;

    const liveSummary = previewContainer.querySelector(".preview-summary");
    if (!liveSummary || liveSummary !== summary) return;

    previewContainer.classList.toggle(
      "is-truncated",
      previewContainer.scrollHeight > previewContainer.clientHeight + 1,
    );
  }

  async function renderForItem(item) {
    if (item.hidden) return;
    const token = ++renderToken;
    let entry;
    try {
      entry = (await loadPreviews()).get(itemURL(item));
      if (entry?.math) await loadKatex(katexBase);
    } catch (e) {
      return;
    }
    if (token !== renderToken || !entry || item.hidden) return;
    injectContent(entry);
    await fitPreview(token);
    if (token === renderToken) {
      previewContainer.style.opacity = "1";
    }
  }

  function clear() {
    if (leaveTimeout) clearTimeout(leaveTimeout);
    if (hoverTimeout) clearTimeout(hoverTimeout);
    currentHoverNode = null;
    renderToken++;
    previewContainer.style.opacity = "0";
    previewContainer.classList.remove("is-truncated");
    previewContainer.innerHTML = "";
  }

  archiveList.addEventListener(
    "pointerenter",
    () => loadPreviews().catch(() => {}),
    { once: true },
  );

  let resizeRaf = 0;
  const resizeObserver = new ResizeObserver(() => {
    if (!currentHoverNode) return;
    if (resizeRaf) cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(() => {
      if (currentHoverNode) fitPreview(renderToken);
    });
  });
  const rightCols = document.querySelector(".archive-right-cols");
  if (rightCols) resizeObserver.observe(rightCols);

  archiveItems.forEach((item) => {
    item.addEventListener("mouseenter", () => {
      if (item.hidden) return;
      if (leaveTimeout) clearTimeout(leaveTimeout);
      if (hoverTimeout) clearTimeout(hoverTimeout);

      if (currentHoverNode === item) {
        previewContainer.style.opacity = "1";
        return;
      }

      currentHoverNode = item;
      previewContainer.style.opacity = "0";
      hoverTimeout = setTimeout(() => {
        hoverTimeout = null;
        if (currentHoverNode === item) renderForItem(item);
      }, 100);
    });

    item.addEventListener("mouseleave", () => {
      if (hoverTimeout) {
        clearTimeout(hoverTimeout);
        hoverTimeout = null;
        // A cancelled render must be scheduled again on re-entry.
        if (currentHoverNode === item) currentHoverNode = null;
      }
      if (currentHoverNode === item) {
        leaveTimeout = setTimeout(() => {
          previewContainer.style.opacity = "0";
          currentHoverNode = null;
          renderToken++;
          setTimeout(() => {
            if (!currentHoverNode) {
              previewContainer.classList.remove("is-truncated");
              previewContainer.innerHTML = "";
            }
          }, 200);
        }, 150);
      }
    });
  });

  return { clear };
}
