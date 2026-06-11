export function initSlotLinks() {
  const canHover = window.matchMedia(
    "(any-hover: hover)",
  ).matches;
  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  if (!canHover || reduceMotion) return;

  const links = document.querySelectorAll(
    ".bio-text a, .now-section a, .connect-section a:not(.connect-pill), .af-now-prose a",
  );

  links.forEach((link) => {
    if (link.dataset.slotInit) return;
    link.dataset.slotInit = "1";

    // Preserve accessibility: store text as aria-label on the link
    const label = link.textContent.trim();
    if (label) link.setAttribute("aria-label", label);

    const originalHTML = link.innerHTML;

    const s1 = document.createElement("span");
    s1.className = "link-slot-text";
    s1.innerHTML = originalHTML;

    const s2 = document.createElement("span");
    s2.className = "link-slot-text link-slot-text--hover";
    s2.innerHTML = originalHTML;
    s2.setAttribute("aria-hidden", "true");

    link.innerHTML = "";
    if (link.matches(".bio-text a, .now-section a, .af-now-prose a")) {
      const mask = document.createElement("span");
      mask.className = "link-slot-mask";
      mask.appendChild(s1);
      mask.appendChild(s2);
      link.appendChild(mask);
    } else {
      link.appendChild(s1);
      link.appendChild(s2);
    }
    link.classList.add("link-slot");
  });
}

export function initMagneticHover(elements, opts) {
  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  const canHover = window.matchMedia(
    "(any-hover: hover)",
  ).matches;
  if (!canHover || reduceMotion || !elements.length) return;

  const mX = opts && opts.magnetX != null ? opts.magnetX : 4;
  const mY = opts && opts.magnetY != null ? opts.magnetY : 3;
  const cX = opts && opts.contentX != null ? opts.contentX : 0;
  const cY = opts && opts.contentY != null ? opts.contentY : 0;

  elements.forEach((el) => {
    const state = {
      active: false,
      settling: false,
      rect: null,
      rafId: 0,
      current: {
        x: 0,
        y: 0,
        contentX: 0,
        contentY: 0,
        cursorX: 0,
        cursorY: 0,
        fill: 0,
        opacity: 0,
      },
      target: {
        x: 0,
        y: 0,
        contentX: 0,
        contentY: 0,
        cursorX: 0,
        cursorY: 0,
        fill: 0,
        opacity: 0,
      },
    };

    el._magnetState = state;

    function setVars() {
      el.style.setProperty(
        "--menu-magnet-x",
        `${state.current.x.toFixed(3)}px`,
      );
      el.style.setProperty(
        "--menu-magnet-y",
        `${state.current.y.toFixed(3)}px`,
      );
      el.style.setProperty(
        "--menu-content-x",
        `${state.current.contentX.toFixed(3)}px`,
      );
      el.style.setProperty(
        "--menu-content-y",
        `${state.current.contentY.toFixed(3)}px`,
      );
      el.style.setProperty(
        "--menu-cursor-x",
        `${state.current.cursorX.toFixed(3)}px`,
      );
      el.style.setProperty(
        "--menu-cursor-y",
        `${state.current.cursorY.toFixed(3)}px`,
      );
      el.style.setProperty(
        "--menu-fill-scale",
        state.current.fill.toFixed(4),
      );
      el.style.setProperty(
        "--menu-fill-opacity",
        state.current.opacity.toFixed(4),
      );
    }

    function resetVars() {
      [
        "--menu-magnet-x",
        "--menu-magnet-y",
        "--menu-content-x",
        "--menu-content-y",
        "--menu-cursor-x",
        "--menu-cursor-y",
        "--menu-fill-scale",
        "--menu-fill-opacity",
      ].forEach((prop) => el.style.removeProperty(prop));
    }

    function updateTarget(event) {
      if (!state.rect) state.rect = el.getBoundingClientRect();
      const relX = Math.max(
        0,
        Math.min(state.rect.width, event.clientX - state.rect.left),
      );
      const relY = Math.max(
        0,
        Math.min(state.rect.height, event.clientY - state.rect.top),
      );
      const xRatio = relX / state.rect.width - 0.5;
      const yRatio = relY / state.rect.height - 0.5;

      state.target.x = xRatio * mX;
      state.target.y = yRatio * mY;
      state.target.contentX = xRatio * cX;
      state.target.contentY = yRatio * cY;
      state.target.cursorX = relX;
      state.target.cursorY = relY;
    }

    function approach(current, target, amount) {
      return current + (target - current) * amount;
    }

    function animate() {
      state.current.x = approach(state.current.x, state.target.x, 0.18);
      state.current.y = approach(state.current.y, state.target.y, 0.18);
      state.current.contentX = approach(
        state.current.contentX,
        state.target.contentX,
        0.22,
      );
      state.current.contentY = approach(
        state.current.contentY,
        state.target.contentY,
        0.22,
      );
      state.current.cursorX = approach(
        state.current.cursorX,
        state.target.cursorX,
        0.26,
      );
      state.current.cursorY = approach(
        state.current.cursorY,
        state.target.cursorY,
        0.26,
      );
      state.current.fill = approach(
        state.current.fill,
        state.target.fill,
        state.active ? 0.34 : 0.2,
      );
      state.current.opacity = approach(
        state.current.opacity,
        state.target.opacity,
        state.active ? 0.28 : 0.18,
      );

      setVars();

      const stillMoving =
        Math.abs(state.current.x - state.target.x) > 0.01 ||
        Math.abs(state.current.y - state.target.y) > 0.01 ||
        Math.abs(state.current.contentX - state.target.contentX) > 0.01 ||
        Math.abs(state.current.contentY - state.target.contentY) > 0.01 ||
        Math.abs(state.current.cursorX - state.target.cursorX) > 0.01 ||
        Math.abs(state.current.cursorY - state.target.cursorY) > 0.01 ||
        Math.abs(state.current.fill - state.target.fill) > 0.005 ||
        Math.abs(state.current.opacity - state.target.opacity) > 0.005;

      if (stillMoving) {
        state.rafId = requestAnimationFrame(animate);
        return;
      }

      state.rafId = 0;
      if (!state.active) {
        state.settling = false;
        el.classList.remove("is-settling");
        resetVars();
      }
    }

    function startAnimation() {
      if (!state.rafId) {
        state.rafId = requestAnimationFrame(animate);
      }
    }

    const hideCursor = opts && opts.hideCursor === true;

    el.addEventListener("pointerenter", (event) => {
      if (
        event.pointerType &&
        event.pointerType !== "mouse" &&
        event.pointerType !== "pen"
      )
        return;

      state.active = true;
      state.settling = false;
      state.rect = el.getBoundingClientRect();
      updateTarget(event);

      state.current.cursorX = state.target.cursorX;
      state.current.cursorY = state.target.cursorY;
      state.current.fill = 0;
      state.current.opacity = 0;
      state.target.fill = 1;
      state.target.opacity = 1;

      el.classList.add("is-magnetic");
      el.classList.remove("is-settling");
      if (hideCursor) document.body.classList.add("menu-cursor-hidden");
      setVars();
      startAnimation();
    });

    el.addEventListener("pointermove", (event) => {
      if (!state.active) return;
      updateTarget(event);
      startAnimation();
    });

    el.addEventListener("pointerleave", () => {
      state.active = false;
      state.settling = true;
      state.rect = null;
      state.target.x = 0;
      state.target.y = 0;
      state.target.contentX = 0;
      state.target.contentY = 0;
      state.target.fill = 0;
      state.target.opacity = 0;

      el.classList.remove("is-magnetic");
      el.classList.add("is-settling");
      if (hideCursor) document.body.classList.remove("menu-cursor-hidden");
      startAnimation();
    });
  });
}

export function resetMagneticHover(elements) {
  document.body.classList.remove("menu-cursor-hidden");
  elements.forEach((el) => {
    const state = el._magnetState;
    if (state && state.rafId) {
      cancelAnimationFrame(state.rafId);
      state.rafId = 0;
    }
    if (state) {
      state.active = false;
      state.settling = false;
      state.rect = null;
      Object.keys(state.current).forEach((key) => {
        state.current[key] = 0;
        state.target[key] = 0;
      });
    }
    el.classList.remove("is-magnetic", "is-settling");
    [
      "--menu-magnet-x",
      "--menu-magnet-y",
      "--menu-content-x",
      "--menu-content-y",
      "--menu-cursor-x",
      "--menu-cursor-y",
      "--menu-fill-scale",
      "--menu-fill-opacity",
    ].forEach((prop) => el.style.removeProperty(prop));
  });
}

export function initExpandingMenu() {
  const menuBar = document.getElementById("menu-bar");
  const menuTrigger = document.getElementById("menu-trigger");
  const menuPanel = document.getElementById("menu-panel");
  if (!menuBar || !menuTrigger) return;

  const canHover = window.matchMedia(
    "(any-hover: hover)",
  ).matches;
  const magneticLinks = menuPanel
    ? [...menuPanel.querySelectorAll(".menu-link")]
    : [];
  let lastScrollY = window.scrollY || 0;
  let scrollRafId = 0;
  const hideThreshold = 24;

  function getCollapsedHeight() {
    const computed = window.getComputedStyle(menuBar);
    return parseFloat(computed.height) || 68;
  }

  function syncOpenHeight() {
    if (!menuPanel) return;

    const collapsedHeight = getCollapsedHeight();
    const panelHeight = menuPanel.scrollHeight;
    const nextHeight = Math.max(collapsedHeight, panelHeight);
    menuBar.style.setProperty("--menu-open-height", `${nextHeight}px`);
  }

  function open() {
    syncOpenHeight();
    menuBar.classList.add("is-animating");
    menuBar.classList.add("is-open");
    menuBar.classList.remove("is-scrolled-away");
    menuTrigger.setAttribute("aria-expanded", "true");
    if (menuPanel) menuPanel.setAttribute("aria-hidden", "false");

    setTimeout(() => {
      menuBar.classList.remove("is-animating");
    }, 420);
  }

  function close() {
    resetMagneticLinks();
    menuBar.style.setProperty(
      "--menu-open-height",
      `${menuBar.getBoundingClientRect().height}px`,
    );
    menuBar.classList.add("is-animating");
    requestAnimationFrame(() => {
      menuBar.classList.remove("is-open");
    });
    menuTrigger.setAttribute("aria-expanded", "false");
    if (menuPanel) menuPanel.setAttribute("aria-hidden", "true");

    setTimeout(() => {
      menuBar.classList.remove("is-animating");
    }, 420);
  }

  window.addEventListener("site:close-all", close);

  function updateScrollState() {
    scrollRafId = 0;

    if (menuBar.classList.contains("is-open")) {
      lastScrollY = window.scrollY || 0;
      menuBar.classList.remove("is-scrolled-away");
      return;
    }

    const currentScrollY = window.scrollY || 0;
    const delta = currentScrollY - lastScrollY;

    if (currentScrollY <= hideThreshold) {
      menuBar.classList.remove("is-scrolled-away");
    } else if (delta > 1) {
      menuBar.classList.add("is-scrolled-away");
    } else if (delta < -1) {
      menuBar.classList.remove("is-scrolled-away");
    }

    lastScrollY = currentScrollY;
  }

  if (canHover) {
    menuBar.addEventListener("pointerenter", (event) => {
      if (
        event.pointerType &&
        event.pointerType !== "mouse" &&
        event.pointerType !== "pen"
      )
        return;
      if (!menuBar.classList.contains("is-open")) {
        open();
      }
    });

    menuBar.addEventListener("pointerleave", (event) => {
      if (
        event.pointerType &&
        event.pointerType !== "mouse" &&
        event.pointerType !== "pen"
      )
        return;
      if (menuBar.classList.contains("is-open")) {
        close();
      }
    });
  }

  function initMagneticLinks() {
    initMagneticHover(magneticLinks, {
      magnetX: 8,
      magnetY: 5,
      contentX: 15,
      contentY: 9,
      hideCursor: true,
    });
  }

  function resetMagneticLinks() {
    resetMagneticHover(magneticLinks);
  }

  menuTrigger.addEventListener("click", (e) => {
    e.stopPropagation();
    if (canHover && menuBar.matches(":hover")) return;
    menuBar.classList.contains("is-open") ? close() : open();
  });

  // Close on click outside
  document.addEventListener("click", (e) => {
    if (
      menuBar.classList.contains("is-open") &&
      !menuBar.contains(e.target)
    ) {
      close();
    }
  });

  // Close on Escape
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });

  window.addEventListener(
    "scroll",
    () => {
      if (scrollRafId) return;
      scrollRafId = requestAnimationFrame(updateScrollState);
    },
    { passive: true },
  );

  window.addEventListener("resize", () => {
    if (menuBar.classList.contains("is-open")) {
      syncOpenHeight();
    }
    resetMagneticLinks();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) resetMagneticLinks();
  });

  initMagneticLinks();
  updateScrollState();
}
