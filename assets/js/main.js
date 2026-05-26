import { FluidEngine } from "./modules/fluid-engine.js";
import { initPrefetcher } from "./modules/prefetch.js";

(function () {
  // --- Theme persistence (run before paint where possible) ---
  try {
    const stored = localStorage.getItem("theme");
    if (stored === "dark" || stored === "light") {
      document.documentElement.setAttribute("data-theme", stored);
    }
  } catch (_) {
    /* localStorage unavailable */
  }

  const FONT_MONO = '"JetBrains Mono", "Geist Mono", monospace';
  const STAGGER = 35;

  function staggerFontChange(chars, applyChange) {
    return chars.map((char, i) =>
      setTimeout(() => {
        applyChange(char);
      }, i * STAGGER),
    );
  }

  document.addEventListener("DOMContentLoaded", () => {
    // --- Scroll reveal (About + future fancy pages) ---
    initScrollReveal();

    // --- About image sequence ---
    initAboutImageSequence();


    // --- About flight + drag (Coordinates/Registration → pinboard) ---
    initAboutFlightAndDrag();

    // --- Magnetic hover: links & tags ---
    const generalMagnetEls = [
      ...document.querySelectorAll(
        ".bio-text a, .now-section a, .connect-section a:not(.connect-pill), .data-link, " +
          ".mb-tag-chip, .mb-card-tag, .menu-trigger, .af-now-prose a",
      ),
    ];
    initMagneticHover(generalMagnetEls, { magnetX: 4, magnetY: 3 });

    // --- Expanding Menu ---
    initExpandingMenu();

    // --- Table wrapping for responsive tables ---
    initTableWrapping();

    // --- Search placeholder animation ---
    const searchBar = document.querySelector(".archive-search");
    if (searchBar) {
      const input = searchBar.querySelector(".search-input");
      const fakePlaceholder = searchBar.querySelector(
        ".search-fake-placeholder",
      );
      if (fakePlaceholder && input) {
        let searchTimers = [];
        let searchDebounce = null;
        let isHidden = false;
        let isPlaceholderWrapped = false;

        function initPlaceholder() {
          if (isPlaceholderWrapped) return;
          const text = fakePlaceholder.textContent;
          fakePlaceholder.innerHTML = "";
          [...text].forEach((char) => {
            if (char === " ") {
              fakePlaceholder.appendChild(document.createTextNode(char));
            } else {
              const span = document.createElement("span");
              span.className = "link-char";
              span.textContent = char;
              fakePlaceholder.appendChild(span);
            }
          });
          isPlaceholderWrapped = true;
        }

        function getChars() {
          return [...fakePlaceholder.querySelectorAll(".link-char")];
        }

        function cancelSearch() {
          searchTimers.forEach(clearTimeout);
          searchTimers = [];
        }

        function animateToMono() {
          initPlaceholder();
          cancelSearch();
          const chars = getChars();
          searchTimers = staggerFontChange(chars, (char) => {
            char.style.fontFamily = FONT_MONO;
          });
        }

        function animateToSans() {
          if (!isPlaceholderWrapped) return;
          cancelSearch();
          const chars = getChars().reverse();
          searchTimers = staggerFontChange(chars, (char) => {
            char.style.fontFamily = "";
          });
        }

        searchBar.addEventListener("mouseenter", () => {
          clearTimeout(searchDebounce);
          searchDebounce = setTimeout(() => {
            if (!isHidden) animateToMono();
          }, 20);
        });

        searchBar.addEventListener("mouseleave", () => {
          clearTimeout(searchDebounce);
          searchDebounce = setTimeout(() => {
            if (!isHidden) animateToSans();
          }, 20);
        });

        searchBar.addEventListener("click", () => input.focus());

        input.addEventListener("focus", () => {
          if (!isHidden) {
            isHidden = true;
            cancelSearch();
            fakePlaceholder.classList.add("is-hiding");
          }
        });

        fakePlaceholder.addEventListener("animationend", () => {
          if (isHidden) fakePlaceholder.style.opacity = "0";
        });

        input.addEventListener("blur", () => {
          if (input.value === "") {
            isHidden = false;
            fakePlaceholder.classList.remove("is-hiding");
            fakePlaceholder.style.opacity = "";
            if (isPlaceholderWrapped) {
              getChars().forEach((char) => {
                char.style.fontFamily = "";
              });
            }
          }
        });
      }
    }

    // --- Archive filtering + hover preview ---
    const archiveList = document.querySelector(
      ".archive-list[data-archive-filter-root]",
    );
    const archiveItems = archiveList
      ? [...archiveList.querySelectorAll(".archive-item")]
      : [];
    if (archiveItems.length > 0) {
      const previewContainer = document.getElementById(
        "archive-preview-container",
      );
      if (previewContainer) previewContainer.innerHTML = "";

      let currentHoverNode = null;
      let leaveTimeout = null;
      let renderToken = 0;
      let filterToken = 0;

      function injectContent(item) {
        if (!previewContainer || item.hidden) return false;
        const previewData = item.querySelector(".item-preview-data");
        if (!previewData) return false;
        previewContainer.classList.remove("is-truncated");
        previewContainer.innerHTML = previewData.innerHTML;
        previewContainer.dataset.href = previewData.dataset.href || "";
        previewContainer
          .querySelectorAll("figure.local-video, video, audio, iframe")
          .forEach((el) => el.remove());
        return true;
      }

      async function fitPreview(token) {
        if (!previewContainer) return;
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
        if (!previewContainer || item.hidden) return;
        const token = ++renderToken;
        if (!injectContent(item)) return;
        await fitPreview(token);
        if (token === renderToken) {
          previewContainer.style.opacity = "1";
        }
      }

      function clearPreview() {
        if (leaveTimeout) clearTimeout(leaveTimeout);
        currentHoverNode = null;
        renderToken++;
        if (!previewContainer) return;
        previewContainer.style.opacity = "0";
        previewContainer.classList.remove("is-truncated");
        previewContainer.innerHTML = "";
        delete previewContainer.dataset.href;
      }

      if (previewContainer) {
        let resizeRaf = 0;
        const resizeObserver = new ResizeObserver(() => {
          if (!currentHoverNode) return;
          if (resizeRaf) cancelAnimationFrame(resizeRaf);
          resizeRaf = requestAnimationFrame(() => {
            if (currentHoverNode) renderForItem(currentHoverNode);
          });
        });
        const rightCols = document.querySelector(".archive-right-cols");
        if (rightCols) resizeObserver.observe(rightCols);
      }

      archiveItems.forEach((item) => {
        item.addEventListener("mouseenter", () => {
          if (item.hidden || !previewContainer) return;
          if (leaveTimeout) clearTimeout(leaveTimeout);

          if (currentHoverNode === item) {
            previewContainer.style.opacity = "1";
            return;
          }

          currentHoverNode = item;
          previewContainer.style.opacity = "0";
          setTimeout(() => {
            if (currentHoverNode === item) renderForItem(item);
          }, 100);
        });

        item.addEventListener("mouseleave", () => {
          if (currentHoverNode === item) {
            leaveTimeout = setTimeout(() => {
              previewContainer.style.opacity = "0";
              currentHoverNode = null;
              renderToken++;
              setTimeout(() => {
                if (!currentHoverNode) {
                  previewContainer.classList.remove("is-truncated");
                  previewContainer.innerHTML = "";
                  delete previewContainer.dataset.href;
                }
              }, 200);
            }, 150);
          }
        });
      });

      const isFilterableArchive =
        archiveList && !document.body.classList.contains("section-microblog");
      if (isFilterableArchive) {
        const tagControls = [
          ...document.querySelectorAll(".archive-tag-item[data-tag]"),
        ];
        const yearControls = [
          ...document.querySelectorAll(".archive-year-item[data-year]"),
        ];
        const entryStat = document.querySelector(
          '[data-archive-stat="entries"]',
        );
        const yearStat = document.querySelector('[data-archive-stat="years"]');
        const reduceMotionQuery = window.matchMedia(
          "(prefers-reduced-motion: reduce)",
        );
        const selectedTags = new Set();
        const selectedYears = new Set();
        const validTags = new Set(
          tagControls
            .map((el) => normalizeToken(el.dataset.tag))
            .filter(Boolean),
        );
        const validYears = new Set(
          yearControls
            .map((el) => normalizeYear(el.dataset.year))
            .filter(Boolean),
        );
        const initialTags = parseList(archiveList.dataset.archiveInitialTags)
          .map(normalizeToken)
          .filter((tag) => validTags.has(tag));

        function normalizeToken(value) {
          return String(value || "")
            .trim()
            .toLowerCase();
        }

        function normalizeYear(value) {
          const year = String(value || "").trim();
          return /^\d{4}$/.test(year) ? year : "";
        }

        function parseList(value) {
          return String(value || "")
            .split(",")
            .map((part) => part.trim())
            .filter(Boolean);
        }

        function itemTags(item) {
          return parseList(item.dataset.archiveTags).map(normalizeToken);
        }

        function itemYear(item) {
          return normalizeYear(item.dataset.archiveYear);
        }

        function readFiltersFromURL(useInitialTags) {
          const params = new URLSearchParams(window.location.search);
          const urlTags = parseList(params.get("tags"))
            .map(normalizeToken)
            .filter((tag) => validTags.has(tag));
          const urlYears = parseList(params.get("years"))
            .map(normalizeYear)
            .filter((year) => validYears.has(year));
          const tags =
            urlTags.length || params.has("tags") || !useInitialTags
              ? urlTags
              : initialTags;

          selectedTags.clear();
          selectedYears.clear();
          tags.forEach((tag) => selectedTags.add(tag));
          urlYears.forEach((year) => selectedYears.add(year));
        }

        function matchesFilters(item) {
          const tags = itemTags(item);
          const year = itemYear(item);
          const matchesTag =
            selectedTags.size === 0 ||
            tags.some((tag) => selectedTags.has(tag));
          const matchesYear =
            selectedYears.size === 0 || selectedYears.has(year);
          return matchesTag && matchesYear;
        }

        function matchingItems() {
          return archiveItems.filter(matchesFilters);
        }

        function updateFilterControls() {
          tagControls.forEach((el) => {
            el.classList.toggle(
              "active",
              selectedTags.has(normalizeToken(el.dataset.tag)),
            );
          });
          yearControls.forEach((el) => {
            el.classList.toggle(
              "active",
              selectedYears.has(normalizeYear(el.dataset.year)),
            );
          });
        }

        function updateStats(items) {
          if (entryStat) entryStat.textContent = String(items.length);
          if (yearStat) {
            const years = new Set(items.map(itemYear).filter(Boolean));
            yearStat.textContent = String(years.size);
          }
        }

        function syncURL(replace) {
          const url = new URL(window.location.href);
          const tags = [...selectedTags].sort();
          const years = [...selectedYears].sort().reverse();
          if (tags.length) {
            url.searchParams.set("tags", tags.join(","));
          } else {
            url.searchParams.delete("tags");
          }
          if (years.length) {
            url.searchParams.set("years", years.join(","));
          } else {
            url.searchParams.delete("years");
          }

          const next = url.pathname + (url.search ? url.search : "") + url.hash;
          const current =
            window.location.pathname +
            window.location.search +
            window.location.hash;
          if (next !== current) {
            const state = { archiveTags: tags, archiveYears: years };
            if (replace) {
              history.replaceState(state, "", next);
            } else {
              history.pushState(state, "", next);
            }
          }
        }

        function captureRects(items) {
          const rects = new Map();
          items.forEach((item) =>
            rects.set(item, item.getBoundingClientRect()),
          );
          return rects;
        }

        function animateReflow(beforeRects, items) {
          items.forEach((item) => {
            const before = beforeRects.get(item);
            if (!before || typeof item.animate !== "function") return;
            const after = item.getBoundingClientRect();
            const dx = before.left - after.left;
            const dy = before.top - after.top;
            if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
            item.animate(
              [
                { transform: `translate3d(${dx}px, ${dy}px, 0)` },
                { transform: "translate3d(0, 0, 0)" },
              ],
              {
                duration: 260,
                easing: "cubic-bezier(0.22, 1, 0.36, 1)",
              },
            );
          });
        }

        function animateEntering(items) {
          items.forEach((item) => {
            if (typeof item.animate !== "function") {
              item.style.opacity = "";
              item.style.transform = "";
              return;
            }
            const animation = item.animate(
              [
                { opacity: 0, transform: "translateY(6px)" },
                { opacity: 1, transform: "translateY(0)" },
              ],
              {
                duration: 220,
                easing: "cubic-bezier(0.22, 1, 0.36, 1)",
              },
            );
            animation.addEventListener(
              "finish",
              () => {
                item.style.opacity = "";
                item.style.transform = "";
              },
              { once: true },
            );
          });
        }

        function finishFilterTransition(
          token,
          beforeRects,
          toShow,
          matchedSet,
        ) {
          if (token !== filterToken) return;
          toShow.forEach((item) => {
            item.hidden = false;
            item.style.opacity = "0";
            item.style.transform = "translateY(6px)";
          });

          requestAnimationFrame(() => {
            if (token !== filterToken) return;
            const matched = archiveItems.filter((item) => matchedSet.has(item));
            animateReflow(beforeRects, matched);
            animateEntering(toShow);
          });
        }

        function applyFilters(options = {}) {
          const token = ++filterToken;
          const animate =
            options.animate !== false && !reduceMotionQuery.matches;
          const matched = matchingItems();
          const matchedSet = new Set(matched);
          const visibleBefore = archiveItems.filter((item) => !item.hidden);
          const beforeRects = captureRects(visibleBefore);
          const toHide = visibleBefore.filter((item) => !matchedSet.has(item));
          const toShow = matched.filter((item) => item.hidden);

          updateFilterControls();
          updateStats(matched);
          clearPreview();
          if (options.updateURL) syncURL(Boolean(options.replaceURL));

          if (!animate) {
            archiveItems.forEach((item) => {
              item.hidden = !matchedSet.has(item);
              item.classList.remove("is-filter-leaving");
              item.style.opacity = "";
              item.style.transform = "";
            });
            return;
          }

          if (!toHide.length) {
            finishFilterTransition(token, beforeRects, toShow, matchedSet);
            return;
          }

          toHide.forEach((item) => item.classList.add("is-filter-leaving"));
          window.setTimeout(() => {
            if (token !== filterToken) return;
            toHide.forEach((item) => {
              item.hidden = true;
              item.classList.remove("is-filter-leaving");
            });
            finishFilterTransition(token, beforeRects, toShow, matchedSet);
          }, 190);
        }

        tagControls.forEach((control) => {
          control.addEventListener("click", (event) => {
            event.preventDefault();
            const tag = normalizeToken(control.dataset.tag);
            if (!validTags.has(tag)) return;
            if (selectedTags.has(tag)) {
              selectedTags.delete(tag);
            } else {
              selectedTags.add(tag);
            }
            applyFilters({ updateURL: true });
          });
        });

        yearControls.forEach((control) => {
          control.addEventListener("click", (event) => {
            event.preventDefault();
            const year = normalizeYear(control.dataset.year);
            if (!validYears.has(year)) return;
            if (selectedYears.has(year)) {
              selectedYears.delete(year);
            } else {
              selectedYears.add(year);
            }
            applyFilters({ updateURL: true });
          });
        });

        window.addEventListener("popstate", () => {
          readFiltersFromURL(false);
          applyFilters({ animate: true });
        });

        const hadURLTags = new URLSearchParams(window.location.search).has(
          "tags",
        );
        readFiltersFromURL(true);
        applyFilters({
          animate: false,
          updateURL: initialTags.length > 0 && !hadURLTags,
          replaceURL: true,
        });
      }
    }

    // --- Expandable card toggle ---
    const cardHeaders = document.querySelectorAll(".now-card-header");
    cardHeaders.forEach((button) => {
      button.addEventListener("click", () => {
        const card = button.parentElement;
        card.classList.toggle("is-expanded");
        card.classList.toggle("is-collapsed");
      });
    });

    // --- Home work-item hover preview ---
    initHomeHoverPreview();

    // --- Search + Command Palette ---
    initSearchPalette();

    // --- Slot machine links ---
    initSlotLinks();

    // --- Footer Reveal ---
    initFooterReveal();

    // --- Fluid Engine WebGL ---
    initFluidEngine();

    // --- Smart Link Prefetch ---
    initPrefetcher();
  });

  function initHomeHoverPreview() {
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

  function initFluidEngine() {
    const wrapper = document.querySelector(".author-name-svg-wrapper");
    const intro = document.querySelector(".intro");
    if (!wrapper || !intro) return;

    const engine = new FluidEngine(intro, wrapper);
    if (!engine.init()) return;

    // Dynamic observer: handles Hero.svg load, web font loading, and responsive shifts
    if (window.ResizeObserver) {
      const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
            engine.handleResize();
          }
        }
      });
      resizeObserver.observe(wrapper);
    }

    // Throttle WebGL rendering based on viewport visibility
    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              engine.start();
            } else {
              engine.pause();
            }
          });
        },
        { threshold: 0.0, rootMargin: "100px 0px 100px 0px" },
      );
      observer.observe(intro);
    } else {
      engine.start();
    }

    // Smoothly interpolate background if data-theme toggles at runtime
    const themeObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === "data-theme") {
          engine.updateThemeColor();
        }
      });
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
  }

  function initScrollReveal() {
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

  function initAboutImageSequence() {
    const root = document.querySelector("[data-about-sequence]");
    const track = document.querySelector("[data-about-sequence-track]");
    if (!root || !track) return;

    // Disable about image sequence on mobile
    if (window.matchMedia("(max-width: 768px)").matches) return;

    const sourceItems = [...track.querySelectorAll(".af-sequence-item")];
    if (!sourceItems.length) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const sourceCount = sourceItems.length;
    const anchorSourceIndex = Math.max(
      0,
      sourceItems.findIndex((item) => item.classList.contains("is-anchor")),
    );
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
    let current = middleSet * sourceCount + anchorSourceIndex;
    let closeTimer = 0;
    let resetTimer = 0;
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

      if (!animate) {
        requestAnimationFrame(() => setTransition(true));
      }
    }

    function render(animate = true) {
      items.forEach((item, index) => {
        item.classList.toggle("is-current", index === current);
      });
      centerCurrent(animate);
    }

    function resetToMiddleIfNeeded() {
      if (current >= sourceCount && current < sourceCount * (repeatCount - 1))
        return;

      const sequenceIndex = Number(items[current]?.dataset.sequenceIndex || 0);
      current = middleSet * sourceCount + sequenceIndex;
      render(false);
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
      current += direction;
      if (current < 0) current = items.length - 1;
      if (current >= items.length) current = 0;

      render(!reduceMotion);
      clearTimeout(resetTimer);
      resetTimer = setTimeout(resetToMiddleIfNeeded, reduceMotion ? 0 : 300);
    }

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

  function initAboutFlightAndDrag() {
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

  function initSlotLinks() {
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

  function initMagneticHover(elements, opts) {
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

  function resetMagneticHover(elements) {
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

  function initTableWrapping() {
    document.querySelectorAll(".post-content table").forEach((table) => {
      if (table.parentNode?.nodeType === Node.ELEMENT_NODE && table.parentNode.classList.contains("table-wrapper")) return;
      const wrapper = document.createElement("div");
      wrapper.className = "table-wrapper";
      table.parentNode.insertBefore(wrapper, table);
      wrapper.appendChild(table);
    });
  }

  function initExpandingMenu() {
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

  function initSearchPalette() {
    const root = document.getElementById("menu-search-panel");
    const triggers = document.querySelectorAll("[data-search-trigger]");
    if (!root) return;

    const lang = (document.documentElement.lang || "zh")
      .toLowerCase()
      .startsWith("en")
      ? "en"
      : "zh";
    const indexUrl =
      lang === "en" ? "/en/search-index.json" : "/search-index.json";
    const isMac = /Mac|iPhone|iPad/i.test(navigator.userAgent || "");

    let panel = null;
    let inputEl = null;
    let listEl = null;
    let previewEl = null;
    let modeHintEl = null;
    let indexCache = null;
    let indexPromise = null;
    let isOpen = false;
    let selectedIdx = 0;
    let currentItems = [];
    let currentTokens = [];
    let lastQuery = "";

    // ---------- Index loading ----------
    function loadIndex() {
      if (indexCache) return Promise.resolve(indexCache);
      if (indexPromise) return indexPromise;
      indexPromise = fetch(indexUrl, { credentials: "same-origin" })
        .then((r) => (r.ok ? r.json() : []))
        .then((records) => {
          indexCache = records.map((r) => ({
            ...r,
            _titleLower: (r.title || "").toLowerCase(),
            _bodyLower: (r.body || "").toLowerCase(),
            _summaryLower: (r.summary || "").toLowerCase(),
            _tagsLower: (r.tags || []).map((t) => String(t).toLowerCase()),
          }));
          return indexCache;
        })
        .catch(() => {
          indexCache = [];
          return indexCache;
        });
      return indexPromise;
    }

    // ---------- Tokenization ----------
    function isCJK(s) {
      return /[㐀-鿿豈-﫿]/.test(s);
    }

    function tokenize(query) {
      const q = (query || "").toLowerCase().trim();
      if (!q) return [];
      const tokens = [];
      const parts = q.split(/[\s　]+/).filter(Boolean);
      for (const part of parts) {
        if (isCJK(part)) {
          if (part.length === 1) tokens.push(part);
          else
            for (let i = 0; i < part.length - 1; i++)
              tokens.push(part.substring(i, i + 2));
        } else if (part.length >= 2) {
          tokens.push(part);
        } else if (part.length === 1) {
          tokens.push(part);
        }
      }
      return [...new Set(tokens)];
    }

    function countHits(haystack, needle) {
      if (!haystack || !needle) return 0;
      let count = 0,
        idx = 0;
      while ((idx = haystack.indexOf(needle, idx)) !== -1) {
        count++;
        idx += needle.length;
      }
      return count;
    }

    function scoreRecord(rec, tokens) {
      let total = 0;
      for (const t of tokens) {
        const titleHits = countHits(rec._titleLower, t);
        const tagHits = rec._tagsLower.reduce(
          (a, tag) => a + (tag.includes(t) ? 1 : 0),
          0,
        );
        const summaryHits = countHits(rec._summaryLower, t);
        const bodyHits = countHits(rec._bodyLower, t);
        if (!(titleHits || tagHits || summaryHits || bodyHits)) return 0; // require every token to land somewhere
        total += titleHits * 5 + tagHits * 3 + summaryHits * 2 + bodyHits * 1;
      }
      return total;
    }

    function searchRecords(query) {
      if (!indexCache) return [];
      const tokens = tokenize(query);
      if (!tokens.length) return [];
      const hits = [];
      for (const rec of indexCache) {
        if (rec.lang !== lang) continue;
        const s = scoreRecord(rec, tokens);
        if (s > 0) hits.push({ rec, s });
      }
      hits.sort(
        (a, b) =>
          b.s - a.s || (b.rec.date || "").localeCompare(a.rec.date || ""),
      );
      return hits.slice(0, 30).map((h) => h.rec);
    }

    // ---------- Snippet + highlight ----------
    function escapeHtml(s) {
      return String(s).replace(
        /[<>&"']/g,
        (c) =>
          ({
            "<": "&lt;",
            ">": "&gt;",
            "&": "&amp;",
            '"': "&quot;",
            "'": "&#39;",
          })[c],
      );
    }

    function highlight(text, tokens) {
      const escaped = escapeHtml(text);
      if (!tokens.length) return escaped;
      const sorted = [...new Set(tokens)].sort((a, b) => b.length - a.length);
      const pattern = sorted
        .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
        .join("|");
      if (!pattern) return escaped;
      const re = new RegExp("(" + pattern + ")", "gi");
      return escaped.replace(re, "<mark>$1</mark>");
    }

    function makeSnippet(rec, tokens, len) {
      const body = rec.body || rec.summary || "";
      const lower = rec._bodyLower || rec._summaryLower || "";
      if (!body) return "";
      let pos = -1;
      for (const t of tokens) {
        const i = lower.indexOf(t);
        if (i !== -1 && (pos === -1 || i < pos)) pos = i;
      }
      const span = len || 160;
      if (pos === -1) {
        const head = body.slice(0, span);
        return escapeHtml(head) + (body.length > span ? "…" : "");
      }
      const half = Math.floor(span / 2);
      const start = Math.max(0, pos - half);
      const end = Math.min(body.length, pos + half + (span - half));
      let text = body.slice(start, end);
      if (start > 0) text = "…" + text;
      if (end < body.length) text = text + "…";
      return highlight(text, tokens);
    }

    // ---------- Commands ----------
    function navigate(url) {
      location.href = url;
    }

    function toggleTheme() {
      const html = document.documentElement;
      const current = html.getAttribute("data-theme");
      let next;
      if (current === "dark") next = "light";
      else if (current === "light") next = "dark";
      else
        next = window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "light"
          : "dark";
      html.setAttribute("data-theme", next);
      try {
        localStorage.setItem("theme", next);
      } catch (_) {}
      close();
    }

    function switchLang(target) {
      const path = location.pathname || "/";
      let newPath;
      if (target === "en") {
        newPath =
          path.startsWith("/en/") || path === "/en"
            ? path
            : "/en" + (path.startsWith("/") ? path : "/" + path);
      } else {
        newPath = path.replace(/^\/en(\/|$)/, "/");
      }
      navigate(newPath + (location.hash || ""));
    }

    function buildCommands(query) {
      const otherLang = lang === "zh" ? "en" : "zh";
      const list = [
        {
          id: "go-home",
          label: lang === "en" ? "Go to Home" : "回到首页",
          hint: "/",
          icon: "home",
          action: () => navigate("/"),
        },
        {
          id: "go-ideas",
          label: lang === "en" ? "Go to Ideas" : "前往 Ideas",
          hint: "/ideas",
          icon: "arrow",
          action: () => navigate(lang === "en" ? "/en/ideas/" : "/ideas/"),
        },
        {
          id: "go-textlab",
          label: lang === "en" ? "Go to Text Lab" : "前往 Text Lab",
          hint: "/textlab",
          icon: "arrow",
          action: () => navigate(lang === "en" ? "/en/textlab/" : "/textlab/"),
        },
        {
          id: "go-technical",
          label: lang === "en" ? "Go to Technical" : "前往 Technical",
          hint: "/technical",
          icon: "arrow",
          action: () =>
            navigate(lang === "en" ? "/en/technical/" : "/technical/"),
        },
        {
          id: "go-microblog",
          label: lang === "en" ? "Go to Microblog" : "前往 Microblog",
          hint: "/microblog",
          icon: "arrow",
          action: () =>
            navigate(lang === "en" ? "/en/microblog/" : "/microblog/"),
        },
        {
          id: "go-influences",
          label: lang === "en" ? "Go to Influences" : "前往 Influences",
          hint: "/influences",
          icon: "arrow",
          action: () =>
            navigate(lang === "en" ? "/en/influences/" : "/influences/"),
        },
        {
          id: "theme",
          label: lang === "en" ? "Toggle dark mode" : "切换深色模式",
          hint: "⇧⌘L",
          icon: "theme",
          action: toggleTheme,
        },
        {
          id: "lang",
          label: otherLang === "en" ? "Switch to English" : "切换到中文",
          hint: "lang",
          icon: "lang",
          action: () => switchLang(otherLang),
        },
        {
          id: "tags",
          label: lang === "en" ? "Browse tags" : "浏览标签",
          hint: "#",
          icon: "tag",
          action: () => {
            inputEl.value = "#";
            render("#");
            inputEl.focus();
          },
        },
      ];
      if (!query) return list;
      const q = query.toLowerCase();
      return list.filter(
        (c) => c.label.toLowerCase().includes(q) || c.id.includes(q),
      );
    }

    function buildTags(query) {
      if (!indexCache) return [];
      const counts = new Map();
      for (const r of indexCache) {
        if (r.lang !== lang) continue;
        for (const t of r.tags || []) {
          const key = String(t);
          counts.set(key, (counts.get(key) || 0) + 1);
        }
      }
      const q = (query || "").toLowerCase();
      return [...counts.entries()]
        .filter(([t]) => !q || t.toLowerCase().includes(q))
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([tag, count]) => ({
          type: "tag",
          label: tag,
          count,
          action: () =>
            navigate(
              "/tags/" +
                encodeURIComponent(tag.toLowerCase().replace(/\s+/g, "-")) +
                "/",
            ),
        }));
    }

    // ---------- Render ----------
    const ICONS = {
      search:
        '<svg class="search-input-icon" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
      arrow:
        '<svg class="sr-icon" viewBox="0 0 24 24"><path d="M5 12h14M13 5l7 7-7 7"/></svg>',
      home: '<svg class="sr-icon" viewBox="0 0 24 24"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1z"/></svg>',
      theme:
        '<svg class="sr-icon" viewBox="0 0 24 24"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
      lang: '<svg class="sr-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>',
      tag: '<svg class="sr-icon" viewBox="0 0 24 24"><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/></svg>',
      doc: '<svg class="sr-icon" viewBox="0 0 24 24"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6"/></svg>',
    };

    function render(query) {
      lastQuery = query;
      const trimmed = (query || "").trim();
      currentTokens = [];
      let mode = "search";
      let items = [];

      if (trimmed.startsWith(">")) {
        mode = "command";
        const q = trimmed.slice(1).trim();
        items = buildCommands(q).map((c) => ({ type: "command", cmd: c }));
      } else if (trimmed.startsWith("#")) {
        mode = "tag";
        const q = trimmed.slice(1).trim();
        items = buildTags(q);
      } else if (trimmed === "") {
        mode = "search";
        items = buildCommands("")
          .slice(0, 6)
          .map((c) => ({ type: "command", cmd: c }));
      } else {
        mode = "search";
        currentTokens = tokenize(trimmed);
        const recs = searchRecords(trimmed);
        items = recs.map((r) => ({ type: "result", record: r }));
        const ctxCmds = buildCommands(trimmed).slice(0, 1);
        if (ctxCmds.length && items.length) {
          items = [
            ...ctxCmds.map((c) => ({ type: "command", cmd: c })),
            ...items,
          ];
        }
      }

      currentItems = items;
      selectedIdx = 0;
      modeHintEl.textContent =
        mode === "command"
          ? "CMD"
          : mode === "tag"
            ? "TAG"
            : trimmed === ""
              ? "START"
              : "SEARCH";
      renderList();
      renderPreview();
    }

    function renderList() {
      if (!currentItems.length) {
        listEl.innerHTML =
          '<li class="search-empty">' +
          (lang === "en"
            ? "No matches. Try fewer words, or <em>type ></em> for commands."
            : "暂无匹配。试试更少的关键词，或输入 <em>></em> 进入命令。") +
          "</li>";
        return;
      }
      const html = currentItems
        .map((item, idx) => {
          const sel = idx === selectedIdx ? " is-selected" : "";
          if (item.type === "result") {
            const r = item.record;
            const title = highlight(r.title || "(untitled)", currentTokens);
            const meta = `${escapeHtml(r.section || "")} · ${escapeHtml(r.date || "")}`;
            const snip = makeSnippet(r, currentTokens, 120);
            return `<li class="search-result${sel}" data-idx="${idx}">
                        ${ICONS.doc}
                        <div class="sr-body">
                            <div class="sr-title">${title}</div>
                            <div class="sr-meta">${meta}</div>
                            <div class="search-result-mobile-snippet">${snip}</div>
                        </div>
                        <span class="sr-trail">↩</span>
                    </li>`;
          }
          if (item.type === "command") {
            const c = item.cmd;
            return `<li class="search-result is-command${sel}" data-idx="${idx}">
                        ${ICONS[c.icon] || ICONS.arrow}
                        <div class="sr-body">
                            <div class="sr-title">${escapeHtml(c.label)}</div>
                            <div class="sr-meta">${lang === "en" ? "COMMAND" : "命令"}</div>
                        </div>
                        <span class="sr-trail">${escapeHtml(c.hint || "")}</span>
                    </li>`;
          }
          if (item.type === "tag") {
            return `<li class="search-result is-tag${sel}" data-idx="${idx}">
                        ${ICONS.tag}
                        <div class="sr-body">
                            <div class="sr-title">#${escapeHtml(item.label)}</div>
                            <div class="sr-meta">${item.count} ${lang === "en" ? (item.count === 1 ? "post" : "posts") : "篇"}</div>
                        </div>
                        <span class="sr-trail">↩</span>
                    </li>`;
          }
          return "";
        })
        .join("");
      listEl.innerHTML = html;
    }

    function renderPreview() {
      const item = currentItems[selectedIdx];
      if (!item) {
        previewEl.innerHTML = `<div class="search-preview-empty">${lang === "en" ? "Select an item to preview." : "选中条目即可预览。"}</div>`;
        return;
      }
      if (item.type === "result") {
        const r = item.record;
        const snip = makeSnippet(r, currentTokens, 280);
        const tagsHtml = (r.tags || [])
          .map((t) => `<span>#${escapeHtml(t)}</span>`)
          .join("");
        previewEl.innerHTML = `
                    <div class="preview-meta">${escapeHtml(r.section || "")} · ${escapeHtml(r.date || "")}</div>
                    <h3 class="preview-title">${highlight(r.title || "", currentTokens)}</h3>
                    ${r.summary ? `<p class="preview-summary">${escapeHtml(r.summary)}</p>` : ""}
                    ${snip ? `<p class="preview-snippet">${snip}</p>` : ""}
                    ${tagsHtml ? `<div class="preview-tags">${tagsHtml}</div>` : ""}
                `;
      } else if (item.type === "command") {
        const c = item.cmd;
        previewEl.innerHTML = `
                    <div class="preview-meta">${lang === "en" ? "COMMAND" : "命令"}</div>
                    <h3 class="preview-title">${escapeHtml(c.label)}</h3>
                    <p class="preview-summary">${escapeHtml(c.hint || "")}</p>
                `;
      } else if (item.type === "tag") {
        previewEl.innerHTML = `
                    <div class="preview-meta">${lang === "en" ? "TAG" : "标签"}</div>
                    <h3 class="preview-title">#${escapeHtml(item.label)}</h3>
                    <p class="preview-summary">${item.count} ${lang === "en" ? (item.count === 1 ? "post tagged" : "posts tagged") : "篇相关文章"}</p>
                `;
      }
    }

    // ---------- Panel construction ----------
    function buildPanel() {
      const modKey = isMac ? "⌘K" : "Ctrl K";
      root.innerHTML = `
                <div class="search-overlay" data-search-overlay></div>
                <div class="search-panel" role="dialog" aria-modal="true" aria-label="Search">
                    <div class="search-pane-left">
                        <div class="search-inputbar">
                            ${ICONS.search}
                            <input class="search-input" type="text"
                                   placeholder="${lang === "en" ? "Search posts, > for commands, # for tags" : "搜索文章, > 输入命令, # 浏览标签"}"
                                   autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">
                            <span class="search-mode-hint" data-mode-hint>START</span>
                            <kbd class="search-esc">esc</kbd>
                        </div>
                        <ul class="search-results" role="listbox"></ul>
                        <div class="search-foot">
                            <span><kbd>↑↓</kbd>${lang === "en" ? "navigate" : "导航"}</span>
                            <span><kbd>↩</kbd>${lang === "en" ? "open" : "打开"}</span>
                            <span><kbd>esc</kbd>${lang === "en" ? "close" : "关闭"}</span>
                            <span class="search-foot-spacer"></span>
                            <span><kbd>${modKey}</kbd>${lang === "en" ? "toggle" : "开合"}</span>
                        </div>
                    </div>
                    <div class="search-pane-right">
                        <div class="search-preview"></div>
                    </div>
                </div>
            `;
      panel = root.querySelector(".search-panel");
      inputEl = root.querySelector(".search-input");
      listEl = root.querySelector(".search-results");
      previewEl = root.querySelector(".search-preview");
      modeHintEl = root.querySelector("[data-mode-hint]");

      inputEl.addEventListener("input", (e) => render(e.target.value));

      root
        .querySelector("[data-search-overlay]")
        .addEventListener("click", close);

      listEl.addEventListener("mouseover", (e) => {
        const li = e.target.closest(".search-result");
        if (!li) return;
        const idx = parseInt(li.dataset.idx, 10);
        if (Number.isFinite(idx) && idx !== selectedIdx) {
          selectedIdx = idx;
          renderList();
          renderPreview();
        }
      });

      listEl.addEventListener("click", (e) => {
        const li = e.target.closest(".search-result");
        if (!li) return;
        const idx = parseInt(li.dataset.idx, 10);
        activate(idx);
      });
    }

    function activate(idx) {
      const item = currentItems[idx];
      if (!item) return;
      if (item.type === "result") {
        navigate(item.record.url);
      } else if (item.type === "command") {
        item.cmd.action();
      } else if (item.type === "tag") {
        item.action();
      }
    }

    function scrollSelectedIntoView() {
      const el = listEl.querySelector(".search-result.is-selected");
      if (el) el.scrollIntoView({ block: "nearest" });
    }

    // ---------- Open / close ----------
    function open() {
      if (isOpen) return;
      if (!panel) buildPanel();
      isOpen = true;

      const menuBar = document.getElementById("menu-bar");
      if (menuBar) menuBar.classList.add("is-search");

      // Force browser layout so the newly injected DOM elements
      // register their initial CSS state (e.g., blur(0px)) before transitioning.
      void root.offsetWidth;

      document.body.classList.add("search-open");
      inputEl.value = "";
      render("");
      requestAnimationFrame(() => inputEl.focus());
      loadIndex().then(() => {
        if (isOpen) render(inputEl.value);
      });
    }

    function close() {
      if (!isOpen) return;
      isOpen = false;

      const menuBar = document.getElementById("menu-bar");
      if (menuBar) menuBar.classList.remove("is-search");

      document.body.classList.remove("search-open");
      if (inputEl) inputEl.blur();
    }

    window.addEventListener("site:close-all", close);

    function toggle() {
      isOpen ? close() : open();
    }

    // ---------- Global keys ----------
    document.addEventListener("keydown", (e) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        e.stopPropagation();
        toggle();
        return;
      }
      if (!isOpen) return;
      if (e.key === "Tab") {
        const focusable = panel.querySelectorAll(
          'input, button, a[href], [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length) {
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        close();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        if (currentItems.length && selectedIdx < currentItems.length - 1) {
          selectedIdx++;
          renderList();
          renderPreview();
          scrollSelectedIntoView();
        }
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (selectedIdx > 0) {
          selectedIdx--;
          renderList();
          renderPreview();
          scrollSelectedIntoView();
        }
      } else if (e.key === "Enter") {
        e.preventDefault();
        activate(selectedIdx);
      }
    });

    // ---------- Triggers ----------
    document.addEventListener("click", (e) => {
      if (!isOpen) return;
      const menuBar = document.getElementById("menu-bar");
      // If click is outside menu bar, close search
      if (menuBar && !menuBar.contains(e.target)) {
        close();
      }
    });

    triggers.forEach((t) => {
      t.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle();
      });
    });

    // Also handle the main menu-trigger as a close button when search is open
    const menuTrigger = document.getElementById("menu-trigger");
    if (menuTrigger) {
      menuTrigger.addEventListener(
        "click",
        (e) => {
          const isMenuOpen = document
            .getElementById("menu-bar")
            .classList.contains("is-open");
          if (isOpen || isMenuOpen) {
            e.preventDefault();
            e.stopPropagation();
            window.dispatchEvent(new CustomEvent("site:close-all"));
          }
        },
        true,
      ); // Use capture to intercept before initExpandingMenu
    }

    // Display the platform-correct kbd hint inside the SEARCH nav entry.
    document
      .querySelectorAll(
        "[data-search-trigger] .menu-kbd, [data-search-trigger] .nav-kbd",
      )
      .forEach((k) => {
        k.textContent = isMac ? "⌘K" : "Ctrl K";
      });
  }

  function initFooterReveal() {
    const footer = document.querySelector(".site-footer");
    const wrapper = document.querySelector(".site-wrapper");
    if (!footer || !wrapper) return;

    let footerHeight = 0;

    function updateLayout() {
      footerHeight = footer.offsetHeight;
      wrapper.style.marginBottom = footerHeight + "px";
      onScroll();
    }

    const ro = new ResizeObserver(() => {
      requestAnimationFrame(updateLayout);
    });
    ro.observe(footer);

    let isAnimating = false;

    function onScroll() {
      const maxScroll = Math.max(
        0,
        document.documentElement.scrollHeight - window.innerHeight,
      );
      let scrollBottom = maxScroll - window.scrollY;
      if (scrollBottom < 0) scrollBottom = 0;

      const revealDistance = Math.max(1, footerHeight);

      // Only reveal when the user has actually scrolled toward the bottom.
      // Without the scrollY guard, short pages (and microblog before its feed
      // fetches) hit this branch on first paint and snap from scaleX(1) to
      // scaleX(0.956) the moment JS runs, which reads as a flicker.
      if (
        scrollBottom <= footerHeight &&
        footerHeight > 0 &&
        window.scrollY > 0
      ) {
        let progress = 1 - scrollBottom / revealDistance;
        if (progress < 0) progress = 0;
        if (progress > 1) progress = 1;

        // Quartic Ease Out for smoother non-linear curve
        const eased = 1 - Math.pow(1 - progress, 4);
        const radius = 40 * eased; // from square slowly to round
        const scaleX = 1 - 0.044 * eased;

        wrapper.style.setProperty("--footer-reveal-radius", radius + "px");
        wrapper.style.transform = "scaleX(" + scaleX + ")";
        wrapper.style.boxShadow = "none";
      } else {
        wrapper.style.transform = "none";
        wrapper.style.boxShadow = "none";
        wrapper.style.setProperty("--footer-reveal-radius", "0px");
      }
      isAnimating = false;
    }

    window.addEventListener(
      "scroll",
      () => {
        if (!isAnimating) {
          isAnimating = true;
          requestAnimationFrame(onScroll);
        }
      },
      { passive: true },
    );

    updateLayout();
  }

})();
