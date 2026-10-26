import { matches, media, QUERIES } from "./modules/media.js";

export function initScrollReveal() {
  const targets = document.querySelectorAll(".reveal-on-scroll, .reveal-pin");
  if (!targets.length) return;

  const reduceMotion = matches(QUERIES.reducedMotion);
  if (reduceMotion || !("IntersectionObserver" in window)) {
    targets.forEach((el) => el.classList.add("is-revealed"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-revealed");
          observer.unobserve(entry.target);
        }
      });
    },
    { rootMargin: "0px 0px -10% 0px", threshold: 0.05 },
  );

  targets.forEach((el) => observer.observe(el));
}

function applyAboutCover(root, item) {
  if (!root || !item) return;

  const photo = item.querySelector(".af-sequence-photo");
  if (photo && photo.style.aspectRatio) {
    root.style.aspectRatio = photo.style.aspectRatio;
  }

  const srcImg = item.querySelector("img");
  const baseImg = root.querySelector(".af-photo-base img");
  if (srcImg && baseImg) {
    const nextSrc = srcImg.dataset.src || srcImg.getAttribute("src");
    if (nextSrc && baseImg.getAttribute("src") !== nextSrc) {
      baseImg.src = nextSrc;
      baseImg.alt = srcImg.getAttribute("alt") || "";
    }
  }

  [
    [
      ".af-sequence-caption--left",
      [".af-sequence-caption-kicker", ".af-sequence-caption-text"],
    ],
    [
      ".af-sequence-caption--right",
      [
        ".af-sequence-caption-kicker",
        ".af-sequence-caption-text",
        ".af-sequence-caption-note",
      ],
    ],
  ].forEach(([side, parts]) => {
    const from = item.querySelector(side);
    const to = root.querySelector(`.af-default-caption${side}`);
    if (!from || !to) return;
    parts.forEach((sel) => {
      const a = from.querySelector(sel);
      const b = to.querySelector(sel);
      if (a && b) b.textContent = a.textContent;
    });
  });
}

function initAboutImageTap(root, track) {
  const items = [...track.querySelectorAll(".af-sequence-item")];
  if (!items.length) return;

  let current = Math.floor(Math.random() * items.length);
  applyAboutCover(root, items[current]);

  root.classList.add("is-tap-gallery");
  root.addEventListener("click", () => {
    current = (current + 1) % items.length;
    applyAboutCover(root, items[current]);
  });
}

export function initAboutImageSequence() {
  const root = document.querySelector("[data-about-sequence]");
  const track = document.querySelector("[data-about-sequence-track]");
  if (!root || !track) return;

  if (matches(QUERIES.mobile)) {
    initAboutImageTap(root, track);
    return;
  }

  const sourceItems = [...track.querySelectorAll(".af-sequence-item")];
  if (!sourceItems.length) return;

  const reduceMotion = matches(QUERIES.reducedMotion);
  const sourceCount = sourceItems.length;
  const repeatCount = 5;
  const middleSet = Math.floor(repeatCount / 2);

  track.innerHTML = "";
  for (let set = 0; set < repeatCount; set += 1) {
    sourceItems.forEach((item, index) => {
      const clone = item.cloneNode(true);
      clone.dataset.sequenceIndex = String(index);
      track.appendChild(clone);
    });
  }

  const items = [...track.querySelectorAll(".af-sequence-item")];
  let active = false;
  const initialSourceIndex = Math.floor(Math.random() * sourceCount);
  let current = middleSet * sourceCount + initialSourceIndex;
  let closeTimer = 0;
  let accumulatedDelta = 0;
  let lastStepTime = 0;
  let deltaClearTimer = 0;

  function setTransition(enabled) {
    track.style.transition = enabled && !reduceMotion ? "" : "none";
  }

  function centerCurrent(animate) {
    const target = items[current];
    if (!target) return;

    setTransition(animate);
    const itemCenter = target.offsetTop + target.offsetHeight / 2;
    track.style.setProperty("--sequence-y", `${-itemCenter}px`);
  }

  function render(animate = true) {
    items.forEach((item, index) => {
      item.classList.toggle("is-current", index === current);
    });
    centerCurrent(animate);
  }

  // Silently jump back to the equivalent item in the middle copy. Because that
  // item is a visually identical clone, the reposition is invisible. A forced
  // reflow commits the jump instantly so the following animated step glides from
  // the middle copy instead of animating across the whole track.
  function recenterToMiddle() {
    const sequenceIndex = Number(items[current]?.dataset.sequenceIndex || 0);
    current = middleSet * sourceCount + sequenceIndex;
    render(false);
    void track.offsetHeight;
  }

  let imagesLoaded = false;
  function loadSequenceImages() {
    if (imagesLoaded) return;
    imagesLoaded = true;
    track.querySelectorAll("img[data-src]").forEach((img) => {
      img.src = img.dataset.src;
    });
  }

  function open() {
    clearTimeout(closeTimer);
    if (active) return;

    loadSequenceImages();
    active = true;
    root.classList.add("is-sequence-open");
    document.body.classList.add("about-sequence-open");
    render(false);
    requestAnimationFrame(() => render(!reduceMotion));
  }

  function close() {
    closeTimer = setTimeout(() => {
      active = false;
      root.classList.remove("is-sequence-open");
      document.body.classList.remove("about-sequence-open");
    }, 50);
  }

  function step(direction) {
    if (current < sourceCount || current >= sourceCount * (repeatCount - 1)) {
      recenterToMiddle();
    }

    current += direction;
    render(!reduceMotion);
  }

  applyAboutCover(root, items[current]);

  root.addEventListener("pointerenter", open);
  root.addEventListener("click", open);
  root.addEventListener("pointerleave", close);

  root.addEventListener(
    "wheel",
    (event) => {
      if (!active) return;

      event.preventDefault();
      const now = performance.now();
      const delta = event.deltaY;
      const absDelta = Math.abs(delta);

      clearTimeout(deltaClearTimer);
      deltaClearTimer = setTimeout(() => {
        accumulatedDelta = 0;
      }, 150);

      if (reduceMotion) {
        if (now - lastStepTime < 100) return;
        step(delta > 0 ? 1 : -1);
        lastStepTime = now;
        return;
      }

      const isMouseWheel =
        event.deltaMode !== 0 ||
        absDelta >= 100 ||
        (Number.isInteger(delta) && absDelta >= 50 && now - lastStepTime > 120);

      if (isMouseWheel) {
        step(delta > 0 ? 1 : -1);
        lastStepTime = now;
        accumulatedDelta = 0;
      } else {
        accumulatedDelta += delta;

        const cooldown = 90;
        if (now - lastStepTime < cooldown) {
          return;
        }

        const threshold = 30;
        if (Math.abs(accumulatedDelta) >= threshold) {
          const direction = accumulatedDelta > 0 ? 1 : -1;
          step(direction);
          lastStepTime = now;
          accumulatedDelta = 0;
        }
      }
    },
    { passive: false },
  );

  document.addEventListener(
    "mousemove",
    (event) => {
      if (!active) return;

      const rect = root.getBoundingClientRect();
      const isInside =
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom;

      if (isInside) {
        clearTimeout(closeTimer);
      } else {
        close();
      }
    },
    { passive: true },
  );

  window.addEventListener("resize", () => {
    if (active) render(false);
  });
}

export function initAboutFlightAndDrag() {
  const canvas = document.getElementById("about-pinboard-canvas");
  const summary = document.getElementById("about-summary");
  if (!canvas || !summary) return;

  const desktop = media(QUERIES.aboutDesktop);

  const reduceMotion = matches(QUERIES.reducedMotion);

  const FLIERS = [
    { name: "coordinates", srcRot: -0.8 },
    { name: "registration", srcRot: 0.8 },
  ];

  const fliers = FLIERS.map((cfg) => {
    const el = document.querySelector(`[data-flier="${cfg.name}"]`);
    const slot = document.querySelector(`[data-slot-for="${cfg.name}"]`);
    const target = document.querySelector(`[data-target-for="${cfg.name}"]`);
    if (!el || !slot || !target) return null;
    return { ...cfg, el, slot, target, originalStyle: el.getAttribute("style") };
  }).filter(Boolean);

  if (!fliers.length) return;

  let landed = false;
  let topZ = 40;
  const FLIGHT_MS = 950;
  const FLIGHT_EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

  function startFlight() {
    if (landed || !desktop.matches) return;
    landed = true;

    fliers.forEach((f) => {
      f.slot.style.minHeight = `${f.el.offsetHeight}px`;
      f.width = f.el.offsetWidth;
    });
    const canvasRect = canvas.getBoundingClientRect();
    const scaleX = canvasRect.width / canvas.offsetWidth;
    const scaleY = canvasRect.height / canvas.offsetHeight;

    const flierRects = fliers.map((f) => {
      return {
        f,
        src: f.el.getBoundingClientRect()
      };
    });

    const blocks = [
      ...summary.querySelectorAll(
        ".af-now-block--primary, .af-now-block--secondary",
      ),
    ];
    const firstSummaryHeight = summary.getBoundingClientRect().height;
    const firstRects = new Map(
      blocks.map((block) => [block, block.getBoundingClientRect()]),
    );

    flierRects.forEach(({ f }) => {
      canvas.appendChild(f.el);
      f.el.classList.add("is-landed");
      f.el.style.transition = "none";
      f.el.style.position = "absolute";
      f.el.style.top = `${Number(f.target.dataset.landTop)}px`;
      f.el.style.left = `${Number(f.target.dataset.landLeft)}px`;
      f.el.style.width = `${f.width}px`;
    });

    summary.classList.add("is-flown");
    canvas.classList.add("is-loaded");

    flierRects.forEach((fr) => {
      fr.dst = fr.f.el.getBoundingClientRect();
    });

    const lastSummaryHeight = summary.getBoundingClientRect().height;
    const heightDelta = Math.max(0, firstSummaryHeight - lastSummaryHeight);

    const lastRects = new Map(
      blocks.map((block) => [block, block.getBoundingClientRect()]),
    );


    flierRects.forEach(({ f, src, dst }, i) => {
      const stagger = i * 90;
      const dx = (src.left - dst.left) / scaleX;
      const dy = (src.top - dst.top) / scaleY;
      const landRot = Number(f.target.dataset.landRot);

      f.el.style.transform = `translate(${dx}px, ${dy}px) rotate(${f.srcRot}deg)`;

      // Force reflow for this element so starting transform is registered by the browser
      // eslint-disable-next-line no-unused-expressions
      f.el.offsetWidth;

      if (reduceMotion) {
        f.el.style.transform = `rotate(${landRot}deg)`;
        f.el.style.transition = "";
        makeDraggable(f.el);
        return;
      }

      f.timer = setTimeout(
        () => {
          f.el.style.transition = `transform ${FLIGHT_MS}ms ${FLIGHT_EASE}`;
          f.el.style.transform = `rotate(${landRot}deg)`;
        },
        stagger + (reduceMotion ? 0 : 16),
      );

      function onEnd(e) {
        if (e.propertyName !== "transform") return;
        f.el.removeEventListener("transitionend", onEnd);
        f.onEnd = null;
        f.el.style.transition = "";
        makeDraggable(f.el);
      }
      f.onEnd = onEnd;
      f.el.addEventListener("transitionend", onEnd);
    });

    if (!reduceMotion) {
      blocks.forEach((block) => {
        const first = firstRects.get(block);
        const last = lastRects.get(block);
        if (!first || !last) return;

        const dx = first.left - last.left;
        const dy = first.top - last.top;

        block.animate(
          [
            {
              transform: `translate(${dx}px, ${dy}px)`,
              opacity: 0.92,
            },
            {
              transform: "translate(0, 0)",
              opacity: 1,
            },
          ],
          {
            duration: 680,
            easing: "cubic-bezier(0.22, 1, 0.36, 1)",
            fill: "both",
          },
        );
      });

      if (heightDelta > 1) {
        const pinboard = document.querySelector(".af-pinboard-section");
        if (pinboard) {
          pinboard.style.transform = `translateY(${heightDelta}px)`;
          pinboard.style.transition = "none";

          // eslint-disable-next-line no-unused-expressions
          pinboard.offsetWidth;

          pinboard.style.transition =
            "transform 680ms cubic-bezier(0.22, 1, 0.36, 1)";
          pinboard.style.transform = "translateY(0px)";

          const cleanUp = () => {
            pinboard.style.transform = "";
            pinboard.style.transition = "";
          };
          pinboard.addEventListener("transitionend", cleanUp, { once: true });
        }
      }
    }
  }

  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.15) {
          startFlight();
          io.disconnect();
          break;
        }
      }
    },
    { threshold: [0, 0.15, 0.3] },
  );
  function syncLayout() {
    if (desktop.matches) {
      io.observe(canvas);
      return;
    }
    io.unobserve(canvas);
    landed = false;
    fliers.forEach((f) => {
      clearTimeout(f.timer);
      if (f.onEnd) f.el.removeEventListener("transitionend", f.onEnd);
      f.onEnd = null;
      f.slot.appendChild(f.el);
      f.el.classList.remove("is-landed");
      f.el.setAttribute("style", f.originalStyle);
      delete f.el.dataset.dragging;
      f.slot.style.minHeight = "";
    });
    summary.classList.remove("is-flown");
    canvas.classList.remove("is-loaded");
    summary.querySelectorAll(".af-now-block").forEach((block) => {
      block.getAnimations().forEach((animation) => animation.cancel());
    });
  }
  desktop.addEventListener("change", syncLayout);
  syncLayout();

  function makeDraggable(el) {
    if (el.dataset.dragReady === "1") return;
    el.dataset.dragReady = "1";

    el.setAttribute("draggable", "false");
    el.addEventListener("dragstart", (e) => e.preventDefault());

    let startX = 0,
      startY = 0;
    let originLeft = 0,
      originTop = 0;
    let pointerId = -1;
    let moved = false;
    let scaleX = 1,
      scaleY = 1;

    el.addEventListener("pointerdown", (e) => {
      if (!desktop.matches || !canvas.contains(el)) return;
      if (e.button !== undefined && e.button !== 0) return;
      topZ += 1;
      el.style.zIndex = String(topZ);

      const cr = canvas.getBoundingClientRect();
      scaleX = cr.width / canvas.offsetWidth;
      scaleY = cr.height / canvas.offsetHeight;
      originLeft = el.offsetLeft;
      originTop = el.offsetTop;
      startX = e.clientX;
      startY = e.clientY;
      pointerId = e.pointerId;
      moved = false;
      el.dataset.dragging = "true";
      try {
        el.setPointerCapture(e.pointerId);
      } catch (_) {}
      e.preventDefault();
    });

    el.addEventListener("pointermove", (e) => {
      if (el.dataset.dragging !== "true") return;
      const screenDx = e.clientX - startX;
      const screenDy = e.clientY - startY;
      const dx = screenDx / scaleX;
      const dy = screenDy / scaleY;
      if (!moved && Math.hypot(screenDx, screenDy) > 4) moved = true;
      const w = el.offsetWidth,
        h = el.offsetHeight;
      const overX = w * 0.6;
      const overY = h * 0.6;
      const nl = Math.max(
        Math.min(-overX, originLeft),
        Math.min(
          Math.max(canvas.offsetWidth - w + overX, originLeft),
          originLeft + dx,
        ),
      );
      const nt = Math.max(
        Math.min(-overY, originTop),
        Math.min(
          Math.max(canvas.offsetHeight - h + overY, originTop),
          originTop + dy,
        ),
      );
      el.style.left = `${nl}px`;
      el.style.top = `${nt}px`;
    });

    const end = (e) => {
      if (el.dataset.dragging !== "true") return;
      el.dataset.dragging = "false";
      try {
        el.releasePointerCapture(pointerId);
      } catch (_) {}
      if (moved) {
        el.dataset.suppressClick = "1";
        setTimeout(() => {
          delete el.dataset.suppressClick;
        }, 0);
      }
    };
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);

    el.addEventListener(
      "click",
      (e) => {
        if (el.dataset.suppressClick === "1") {
          e.preventDefault();
          e.stopPropagation();
        }
      },
      true,
    );
  }

  canvas.querySelectorAll("[data-card-id]").forEach(makeDraggable);
}

document.addEventListener("DOMContentLoaded", () => {
  initScrollReveal();
  initAboutImageSequence();
  initAboutFlightAndDrag();
});
