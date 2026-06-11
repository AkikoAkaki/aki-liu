export function initScrollReveal() {
  const targets = document.querySelectorAll(".reveal-on-scroll, .reveal-pin");
  if (!targets.length) return;

  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
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

// Apply one sequence item to the resting base layer: size the frame to the
// image's own aspect ratio (real proportions, no cropping), swap the image,
// and mirror its captions. Shared by the desktop sequence and the mobile
// tap gallery.
function applyAboutCover(root, item) {
  if (!root || !item) return;

  const photo = item.querySelector(".af-sequence-photo");
  if (photo && photo.style.aspectRatio) {
    root.style.aspectRatio = photo.style.aspectRatio;
  }

  const srcImg = item.querySelector("img");
  const baseImg = root.querySelector(".af-photo-base img");
  if (srcImg && baseImg) {
    const nextSrc = srcImg.getAttribute("src");
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

// Mobile: tap the photo to advance to the next image. A random image is shown
// first, and each image keeps its own proportions, so the frame height changes
// as you cycle.
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

  // Mobile cannot hover, so use a tap-to-cycle gallery instead of the
  // hover + wheel sequence.
  if (window.matchMedia("(max-width: 768px)").matches) {
    initAboutImageTap(root, track);
    return;
  }

  const sourceItems = [...track.querySelectorAll(".af-sequence-item")];
  if (!sourceItems.length) return;

  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
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
  // Pick the cover on the client so every visitor (and every reload) gets a
  // different first image. Hugo's build-time shuffle bakes a single image into
  // the static HTML, so without this everyone would see the same cover.
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

  function open() {
    clearTimeout(closeTimer);
    if (active) return;

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
    // If we've drifted into one of the edge copies, recenter to the middle copy
    // first (invisibly). This keeps copies available in both directions at all
    // times, so the sequence loops forever without ever wrapping to the start.
    if (current < sourceCount || current >= sourceCount * (repeatCount - 1)) {
      recenterToMiddle();
    }

    current += direction;
    render(!reduceMotion);
  }

  // Apply the randomly chosen cover to the resting (pointer-away) state.
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

      // Clear accumulated delta after a short pause of 150ms
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

      // Heuristic: Is this a physical mouse wheel tick?
      // Physical wheel ticks typically generate deltaY >= 100 or use non-pixel line/page delta modes,
      // or have clean integer deltaY and are spaced out.
      // A trackpad scroll generates a dense stream of very small fractional deltas (e.g. 1.5, 3.2, 8.0).
      const isMouseWheel =
        event.deltaMode !== 0 ||
        absDelta >= 100 ||
        (Number.isInteger(delta) && absDelta >= 50 && now - lastStepTime > 120);

      if (isMouseWheel) {
        // 1. Mouse wheel ticks: Step instantly with NO cooldown!
        step(delta > 0 ? 1 : -1);
        lastStepTime = now;
        accumulatedDelta = 0;
      } else {
        // 2. Trackpad: Accumulate small events for smooth control
        accumulatedDelta += delta;

        // Introduce a short cooldown (90ms) ONLY for trackpads to keep scrolling smooth
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

  if (!window.matchMedia("(min-width: 881px)").matches) return;

  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  const FLIERS = [
    { name: "coordinates", srcRot: -0.8 },
    { name: "registration", srcRot: 0.8 },
  ];

  const fliers = FLIERS.map((cfg) => {
    const el = document.querySelector(`[data-flier="${cfg.name}"]`);
    const slot = document.querySelector(`[data-slot-for="${cfg.name}"]`);
    const target = document.querySelector(`[data-target-for="${cfg.name}"]`);
    if (!el || !slot || !target) return null;
    return { ...cfg, el, slot, target };
  }).filter(Boolean);

  if (!fliers.length) return;

  // Freeze slot size so layout above doesn't reflow until landing completes
  fliers.forEach((f) => {
    const r = f.el.getBoundingClientRect();
    f.slot.style.minHeight = r.height + "px";
    f.width = r.width;
  });

  let landed = false;
  let topZ = 10;
  const FLIGHT_MS = 950;
  const FLIGHT_EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

  function startFlight() {
    if (landed) return;
    landed = true;

    // 1. MEASURE PHASE 1 (Initial states of elements)
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

    // 2. MUTATE PHASE 1 (Immediate DOM updates for new state)
    // Reparent fliers into the canvas so they are in the target layer
    flierRects.forEach(({ f }) => {
      canvas.appendChild(f.el);
      f.el.classList.add("is-landed");
      f.el.style.transition = "none";
      f.el.style.position = "absolute";
      f.el.style.top = `${Number(f.target.dataset.landTop)}px`;
      f.el.style.left = `${Number(f.target.dataset.landLeft)}px`;
      f.el.style.width = `${f.width}px`;
    });

    // Collapse the summary layout instantly
    summary.classList.add("is-flown");
    canvas.classList.add("is-loaded");

    // 3. MEASURE PHASE 2 (Target/Final states of elements)
    flierRects.forEach((fr) => {
      fr.dst = fr.f.el.getBoundingClientRect();
    });

    const lastSummaryHeight = summary.getBoundingClientRect().height;
    const heightDelta = Math.max(0, firstSummaryHeight - lastSummaryHeight);

    const lastRects = new Map(
      blocks.map((block) => [block, block.getBoundingClientRect()]),
    );

    // 4. ANIMATE PHASE (Apply GPU-accelerated transitions)

    // A. Animate Fliers Flight
    flierRects.forEach(({ f, src, dst }, i) => {
      const stagger = i * 90;
      const dx = src.left - dst.left;
      const dy = src.top - dst.top;
      const landRot = Number(f.target.dataset.landRot);

      // Put flier back to its visual start position relative to the canvas
      f.el.style.transform = `translate(${dx}px, ${dy}px) rotate(${f.srcRot}deg)`;

      // Force reflow for this element so starting transform is registered by the browser
      // eslint-disable-next-line no-unused-expressions
      f.el.offsetWidth;

      setTimeout(
        () => {
          f.el.style.transition = `transform ${FLIGHT_MS}ms ${FLIGHT_EASE}`;
          f.el.style.transform = `rotate(${landRot}deg)`;
        },
        stagger + (reduceMotion ? 0 : 16),
      );

      function onEnd(e) {
        if (e.propertyName !== "transform") return;
        f.el.removeEventListener("transitionend", onEnd);
        f.el.style.transition = "";
        makeDraggable(f.el);
      }
      f.el.addEventListener("transitionend", onEnd);
    });

    // B. Animate Summary Text Blocks
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

      // C. Animate Pinboard Section slide-up (instead of high-overhead height transitions)
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
  io.observe(canvas);

  // === Drag ===
  function makeDraggable(el) {
    if (el.dataset.dragReady === "1") return;
    el.dataset.dragReady = "1";

    // Block native link drag (especially on the courses anchor)
    el.setAttribute("draggable", "false");
    el.addEventListener("dragstart", (e) => e.preventDefault());

    let startX = 0,
      startY = 0;
    let originLeft = 0,
      originTop = 0;
    let pointerId = -1;
    let moved = false;

    el.addEventListener("pointerdown", (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      // Lift to the top of the stack immediately
      topZ += 1;
      el.style.zIndex = String(topZ);

      const r = el.getBoundingClientRect();
      const cr = canvas.getBoundingClientRect();
      originLeft = r.left - cr.left;
      originTop = r.top - cr.top;
      startX = e.clientX;
      startY = e.clientY;
      pointerId = e.pointerId;
      moved = false;
      el.dataset.dragging = "true";
      try {
        el.setPointerCapture(e.pointerId);
      } catch (_) {}
      if (!el.style.width) el.style.width = r.width + "px";
      e.preventDefault();
    });

    el.addEventListener("pointermove", (e) => {
      if (el.dataset.dragging !== "true") return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (!moved && Math.hypot(dx, dy) > 4) moved = true;
      const cr = canvas.getBoundingClientRect();
      const w = el.offsetWidth,
        h = el.offsetHeight;
      // Generous bounds: allow card to extend beyond canvas by up to half its size.
      // This frees up the empty right-side area for dragging.
      const overX = w * 0.6;
      const overY = h * 0.6;
      const nl = Math.max(
        -overX,
        Math.min(cr.width - w + overX, originLeft + dx),
      );
      const nt = Math.max(
        -overY,
        Math.min(cr.height - h + overY, originTop + dy),
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
