export function initHomeHoverPreview() {
  const scope = document.querySelector("[data-home-preview-scope]");
  const preview = document.querySelector("[data-home-hover-preview]");
  if (!scope || !preview) return;

  const canHover = window.matchMedia(
    "(any-hover: hover)",
  ).matches;
  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  if (!canHover) return;

  const allItems = Array.from(
    scope.querySelectorAll(".work-item"),
  );
  const items = allItems.filter((item) => item.hasAttribute("data-preview"));
  const layers = Array.from(
    preview.querySelectorAll("[data-home-preview-layer]"),
  );
  if (!items.length || layers.length < 2) return;

  const intentDelayMs = reduceMotion ? 0 : 35;
  let intentTimer = 0;
  let hoverToken = 0;
  let activeItem = null;
  let activeLayerIndex = 0;
  let currentUrl = "";
  let latestPointerX = 0;
  let latestPointerY = 0;
  let positionRaf = 0;
  let previewWidth = 0;
  let previewHeight = 0;
  let currentPreviewImage = null;

  items.forEach((item) => {
    const url = item.getAttribute("data-preview");
    if (!url) return;
    const preload = new Image();
    preload.decoding = "async";
    preload.src = url;
  });

  function clearIntent() {
    if (!intentTimer) return;
    window.clearTimeout(intentTimer);
    intentTimer = 0;
  }

  function setActiveItem(item) {
    allItems.forEach((candidate) => {
      candidate.classList.toggle("is-preview-active", candidate === item);
    });
    activeItem = item;
  }

  function applyPreviewSize(image) {
    if (!image || !image.naturalWidth || !image.naturalHeight) return;

    const maxWidth = Math.min(320, window.innerWidth * 0.45);
    const maxHeight = window.innerHeight * 0.6;
    const scale = Math.min(
      maxWidth / image.naturalWidth,
      maxHeight / image.naturalHeight,
      1,
    );
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));

    preview.style.width = width + "px";
    preview.style.height = height + "px";
    previewWidth = width;
    previewHeight = height;
    currentPreviewImage = image;
  }

  function measurePreview() {
    const rect = preview.getBoundingClientRect();
    if (rect.width > 0) previewWidth = rect.width;
    if (rect.height > 0) previewHeight = rect.height;
  }

  function placePreview() {
    positionRaf = 0;

    const gap = 8; // 缩小间距，让预览图更贴合鼠标，完美位于鼠标右上角
    const margin = 12;
    const maxX = window.innerWidth - previewWidth - margin;
    const x = Math.max(margin, Math.min(latestPointerX + gap, maxX));
    const y = Math.max(margin, latestPointerY - previewHeight - gap);

    preview.style.setProperty("--home-preview-x", `${Math.round(x)}px`);
    preview.style.setProperty("--home-preview-y", `${Math.round(y)}px`);
  }

  function schedulePosition(event) {
    latestPointerX = event.clientX;
    latestPointerY = event.clientY;
    if (positionRaf) return;
    positionRaf = requestAnimationFrame(placePreview);
  }

  function isClearlyOutsideScope(event) {
    const tolerance = 36;
    const boundary = scope.querySelector(".work-grid") || scope;
    const rect = boundary.getBoundingClientRect();
    return (
      event.clientX < rect.left - tolerance ||
      event.clientX > rect.right + tolerance ||
      event.clientY < rect.top - tolerance ||
      event.clientY > rect.bottom + tolerance
    );
  }

  function handleDocumentPointerMove(event) {
    if (
      !activeItem &&
      !intentTimer &&
      !preview.classList.contains("is-visible")
    ) {
      return;
    }

    if (isClearlyOutsideScope(event)) {
      hidePreview();
    }
  }

  function showPreview(item, token) {
    if (!item || token !== hoverToken || activeItem !== item) return;

    const url = item.getAttribute("data-preview");
    if (!url) return;

    // 隐藏 Page Preview，避免重叠！
    document.dispatchEvent(new CustomEvent("hide-page-preview"));

    if (url !== currentUrl) {
      const nextLayerIndex = activeLayerIndex === 0 ? 1 : 0;
      const activeLayer = layers[activeLayerIndex];
      const nextLayer = layers[nextLayerIndex];

      currentUrl = url;
      nextLayer.src = url;
      nextLayer.alt =
        item.querySelector(".work-item-title")?.textContent?.trim() || "";

      const syncSizeAndPosition = () => {
        applyPreviewSize(nextLayer);
        measurePreview();
        placePreview();
      };

      if (nextLayer.complete && nextLayer.naturalWidth > 0) {
        syncSizeAndPosition();
      } else {
        nextLayer.addEventListener("load", syncSizeAndPosition, {
          once: true,
        });
      }

      nextLayer.classList.add("is-active");
      activeLayer.classList.remove("is-active");
      activeLayerIndex = nextLayerIndex;
    }

    measurePreview();
    placePreview();
    preview.classList.add("is-visible");
  }

  function schedulePreview(item) {
    const token = ++hoverToken;
    clearIntent();
    setActiveItem(item);
    intentTimer = window.setTimeout(() => {
      intentTimer = 0;
      showPreview(item, token);
    }, intentDelayMs);
  }

  function hidePreview() {
    clearIntent();
    if (positionRaf) {
      cancelAnimationFrame(positionRaf);
      positionRaf = 0;
    }
    hoverToken++;
    activeItem = null;
    currentUrl = "";
    allItems.forEach((item) => item.classList.remove("is-preview-active"));
    preview.classList.remove("is-visible");
  }

  allItems.forEach((item) => {
    item.addEventListener("mouseenter", (event) => {
      schedulePosition(event);
      if (item.hasAttribute("data-preview")) {
        schedulePreview(item);
      } else {
        hidePreview();
      }
    });
    item.addEventListener("mousemove", schedulePosition);
    item.addEventListener("focusin", () => {
      if (item.hasAttribute("data-preview")) {
        schedulePreview(item);
      } else {
        hidePreview();
      }
    });
  });

  scope.addEventListener("mousemove", schedulePosition);
  scope.addEventListener("mouseleave", hidePreview);
  scope.addEventListener("focusout", (event) => {
    if (!scope.contains(event.relatedTarget)) hidePreview();
  });

  document.addEventListener("pointermove", handleDocumentPointerMove, {
    passive: true,
  });
  document.addEventListener("hide-home-preview", hidePreview);
  window.addEventListener(
    "resize",
    () => {
      if (currentPreviewImage) {
        applyPreviewSize(currentPreviewImage);
        measurePreview();
      }
    },
    { passive: true },
  );
  measurePreview();
}
