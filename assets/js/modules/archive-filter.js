export function initArchiveFilter() {
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
        if (typeof renderMathInElement === "function") {
          try {
            renderMathInElement(previewContainer, {
              delimiters: [
                { left: "$$", right: "$$", display: true },
                { left: "\\(", right: "\\)", display: false },
                { left: "\\[", right: "\\]", display: true },
                { left: "$", right: "$", display: false },
              ],
              throwOnError: false,
            });
          } catch (e) {}
        }
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
}
