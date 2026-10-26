import { escapeHtml } from "./dom-utils.js";
import { matches, QUERIES } from "./media.js";
import {
  collectTags,
  highlight,
  makeSnippet,
  prepareRecord,
  recordTagLabel,
  searchRecords,
  tokenize,
} from "./search-core.js";

export function initSearchPalette() {
  const root = document.getElementById("menu-search-panel");
  const triggers = document.querySelectorAll("[data-search-trigger]");
  if (!root) return;

  const lang = (document.documentElement.lang || "zh")
    .toLowerCase()
    .startsWith("en")
    ? "en"
    : "zh";
  const indexUrl = root.dataset.indexUrl;
  const sectionUrls = JSON.parse(root.dataset.sections || "{}");
  const isMac = /Mac|iPhone|iPad/i.test(navigator.userAgent || "");

  let panel = null;
  let inputEl = null;
  let listEl = null;
  let previewEl = null;
  let modeHintEl = null;
  let indexCache = null;
  let indexPromise = null;
  let indexError = false;
  let isOpen = false;
  let returnFocus = null;
  let selectedIdx = 0;
  let currentItems = [];
  let currentTokens = [];

  function loadIndex() {
    if (indexCache) return Promise.resolve(indexCache);
    if (indexPromise) return indexPromise;
    indexError = false;
    indexPromise = fetch(indexUrl, { credentials: "same-origin" })
      .then((r) => {
        if (!r.ok) throw new Error(`Search index: HTTP ${r.status}`);
        return r.json();
      })
      .then((records) => {
        indexCache = records.map(prepareRecord);
        return indexCache;
      })
      .catch(() => {
        indexError = true;
        return [];
      })
      .finally(() => {
        indexPromise = null;
        if (isOpen) render(inputEl.value);
      });
    return indexPromise;
  }

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
      next = matches(QUERIES.darkScheme)
        ? "light"
        : "dark";
    html.setAttribute("data-theme", next);
    try {
      localStorage.setItem("theme", next);
    } catch (_) {}
    close();
  }

  function switchLang() {
    navigate(root.dataset.languageUrl);
  }

  function buildCommands(query) {
    const otherLang = lang === "zh" ? "en" : "zh";
    const list = [
      {
        id: "go-home",
        label: lang === "en" ? "Go to Home" : "回到首页",
        hint: root.dataset.homeUrl,
        icon: "home",
        action: () => navigate(root.dataset.homeUrl),
      },
      {
        id: "go-textlab",
        label: lang === "en" ? "Go to Text Lab" : "前往 Text Lab",
        hint: "/textlab",
        icon: "textlab",
        action: () => navigate(sectionUrls.textlab),
      },
      {
        id: "go-notes",
        label: lang === "en" ? "Go to Notes" : "前往 Notes",
        hint: "/notes",
        icon: "notes",
        action: () => navigate(sectionUrls.notes),
      },
      {
        id: "go-weeknotes",
        label: lang === "en" ? "Go to Weeknotes" : "前往 Weeknotes",
        hint: "/weeknotes",
        icon: "weeknotes",
        action: () => navigate(sectionUrls.weeknotes),
      },
      {
        id: "go-microblog",
        label: lang === "en" ? "Go to Microblog" : "前往 Microblog",
        hint: "/microblog",
        icon: "microblog",
        action: () => navigate(sectionUrls.microblog),
      },
      {
        id: "go-influences",
        label: lang === "en" ? "Go to Influences" : "前往 Influences",
        hint: "/influences",
        icon: "influences",
        action: () => navigate(sectionUrls.influences),
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
        action: switchLang,
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
    return collectTags(indexCache, lang, query).map(({ slug, label, count }) => ({
      type: "tag",
      label,
      count,
      action: () =>
        navigate(root.dataset.tagsUrl + encodeURIComponent(slug) + "/"),
    }));
  }

  // One stroke set on a 24px grid; size, weight, and caps come from search.css.
  const ICON_PATHS = {
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    home: '<path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z"/>',
    textlab: '<path d="M12 20h8"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    notes: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h3"/>',
    weeknotes: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
    microblog: '<path d="M20 11.5a7.5 7.5 0 0 1-10.9 6.7L4 20l1.6-4.6A7.5 7.5 0 1 1 20 11.5z"/>',
    influences: '<path d="M12 7.5V20M12 7.5A3.5 3.5 0 0 0 8.5 4H4v13h5a3 3 0 0 1 3 3M12 7.5A3.5 3.5 0 0 1 15.5 4H20v13h-5a3 3 0 0 0-3 3"/>',
    theme: '<path d="M19.5 14.5A7.5 7.5 0 1 1 9.5 4.5a6 6 0 0 0 10 10z"/>',
    lang: '<circle cx="12" cy="12" r="8"/><path d="M4 12h16M12 4a12 12 0 0 1 0 16M12 4a12 12 0 0 0 0 16"/>',
    tag: '<path d="M4 4h7.2l8.3 8.3a1.5 1.5 0 0 1 0 2.1l-5.1 5.1a1.5 1.5 0 0 1-2.1 0L4 11.2z"/><circle cx="8.5" cy="8.5" r="1"/>',
    doc: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
    enter: '<path d="M9 10l-5 5 5 5"/><path d="M20 4v7a4 4 0 0 1-4 4H4"/>',
    up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
    down: '<path d="M12 5v14M6 13l6 6 6-6"/>',
  };

  function icon(name, className = "sr-icon") {
    return `<svg class="${className}" viewBox="0 0 24 24" aria-hidden="true">${ICON_PATHS[name] || ICON_PATHS.doc}</svg>`;
  }

  function render(query) {
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
    } else {
      mode = "search";
      currentTokens = tokenize(trimmed);
      const recs = searchRecords(indexCache, currentTokens, lang);
      items = recs.map((r) => ({ type: "result", record: r }));
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
    syncSelection();
    renderPreview();
  }

  function renderList() {
    if (!currentItems.length) {
      inputEl.removeAttribute("aria-activedescendant");
      if (!inputEl.value.trim()) {
        listEl.innerHTML = `<li class="search-empty">${lang === "en" ? "Search posts, type > for commands, or # for tags." : "输入关键词搜索文章，输入 > 执行命令，输入 # 浏览标签。"}</li>`;
        return;
      }
      if (!indexCache && !inputEl.value.trim().startsWith(">")) {
        listEl.innerHTML = indexError
          ? `<li class="search-empty">${lang === "en" ? "Search could not load." : "搜索加载失败。"} <button type="button" data-search-retry>${lang === "en" ? "Retry" : "重试"}</button></li>`
          : `<li class="search-empty" role="status">${lang === "en" ? "Loading search…" : "正在加载搜索…"}</li>`;
        return;
      }
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
          return `<li class="search-result${sel}" data-idx="${idx}" id="search-result-${idx}" role="option" aria-selected="${idx === selectedIdx}">
                      ${icon("doc")}
                      <div class="sr-body">
                          <div class="sr-title">${title}</div>
                          <div class="sr-meta">${meta}</div>
                          <div class="search-result-snippet">${snip}</div>
                      </div>
                      <span class="sr-trail">${icon("enter", "sr-trail-icon")}</span>
                  </li>`;
        }
        if (item.type === "command") {
          const c = item.cmd;
          return `<li class="search-result is-command${sel}" data-idx="${idx}" id="search-result-${idx}" role="option" aria-selected="${idx === selectedIdx}">
                      ${icon(c.icon)}
                      <div class="sr-body">
                          <div class="sr-title">${escapeHtml(c.label)}</div>
                          <div class="sr-meta">${lang === "en" ? "COMMAND" : "命令"}</div>
                      </div>
                      <span class="sr-trail">${escapeHtml(c.hint || "")}</span>
                  </li>`;
        }
        if (item.type === "tag") {
          return `<li class="search-result is-tag${sel}" data-idx="${idx}" id="search-result-${idx}" role="option" aria-selected="${idx === selectedIdx}">
                      ${icon("tag")}
                      <div class="sr-body">
                          <div class="sr-title">#${escapeHtml(item.label)}</div>
                          <div class="sr-meta">${item.count} ${lang === "en" ? (item.count === 1 ? "post" : "posts") : "篇"}</div>
                      </div>
                      <span class="sr-trail">${icon("enter", "sr-trail-icon")}</span>
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
        .map((_, i) => `<span>#${escapeHtml(recordTagLabel(r, i))}</span>`)
        .join("");
      previewEl.innerHTML = `
                  <div class="preview-meta">${escapeHtml(r.section || "")} · ${escapeHtml(r.date || "")}</div>
                  <h3 class="preview-title">${highlight(r.title || "", currentTokens)}</h3>
                  ${snip ? `<div class="preview-snippet">${snip.split(/\n+/).filter((paragraph) => paragraph.trim()).map((paragraph) => `<p>${paragraph}</p>`).join("")}</div>` : ""}
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

  function buildPanel() {
    const modKey = isMac ? "⌘K" : "Ctrl K";
    root.innerHTML = `
              <div class="search-overlay" data-search-overlay></div>
              <div class="search-panel" role="dialog" aria-modal="true" aria-label="Search">
                  <div class="search-pane-left">
                      <div class="search-inputbar">
                          ${icon("search", "search-input-icon")}
                          <input class="search-input" type="text"
                                 role="combobox" aria-label="${lang === "en" ? "Search" : "搜索"}" aria-autocomplete="list" aria-controls="search-results" aria-expanded="false"
                                 placeholder="${lang === "en" ? "Search posts, > for commands, # for tags" : "搜索文章, > 输入命令, # 浏览标签"}"
                                 autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">
                          <span class="search-mode-hint" data-mode-hint>START</span>
                          <kbd class="search-esc">esc</kbd>
                      </div>
                      <ul class="search-results" id="search-results" role="listbox" aria-label="${lang === "en" ? "Search results" : "搜索结果"}"></ul>
                      <div class="search-foot">
                          <span><kbd>${icon("up", "kbd-icon")}${icon("down", "kbd-icon")}</kbd>${lang === "en" ? "navigate" : "导航"}</span>
                          <span><kbd>${icon("enter", "kbd-icon")}</kbd>${lang === "en" ? "open" : "打开"}</span>
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
        selectItem(idx);
      }
    });

    listEl.addEventListener("click", (e) => {
      if (e.target.closest("[data-search-retry]")) {
        loadIndex();
        render(inputEl.value);
        inputEl.focus();
        return;
      }
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

  function selectItem(idx, scroll = false) {
    selectedIdx = idx;
    const el = listEl.children[selectedIdx];
    syncSelection();
    renderPreview();
    if (scroll) el.scrollIntoView({ block: "nearest" });
  }

  function syncSelection() {
    listEl.querySelectorAll("[role='option']").forEach((el, idx) => {
      const selected = idx === selectedIdx;
      el.classList.toggle("is-selected", selected);
      el.setAttribute("aria-selected", String(selected));
      if (selected) inputEl.setAttribute("aria-activedescendant", el.id);
    });
  }

  function open() {
    if (isOpen) return;
    if (!panel) buildPanel();
    returnFocus = document.activeElement;
    isOpen = true;
    root.setAttribute("aria-hidden", "false");
    inputEl.setAttribute("aria-expanded", "true");

    const menuBar = document.getElementById("menu-bar");
    if (menuBar) {
      menuBar.classList.remove("is-scrolled-away");
      menuBar.classList.add("is-search");
    }

    // Force browser layout so the newly injected DOM elements
    // register their initial CSS state (e.g., blur(0px)) before transitioning.
    void root.offsetWidth;

    document.body.classList.add("search-open");
    inputEl.value = "";
    loadIndex();
    render("");
    requestAnimationFrame(() => {
      if (isOpen) inputEl.focus();
    });
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;

    const menuBar = document.getElementById("menu-bar");
    if (menuBar) menuBar.classList.remove("is-search");

    document.body.classList.remove("search-open");
    inputEl.setAttribute("aria-expanded", "false");
    const target = returnFocus instanceof HTMLElement &&
      returnFocus !== document.body && !returnFocus.closest("#menu-panel") &&
      returnFocus.checkVisibility({ visibilityProperty: true })
      ? returnFocus
      : document.getElementById("menu-trigger");
    target?.focus({ preventScroll: true });
    root.setAttribute("aria-hidden", "true");
  }

  window.addEventListener("site:close-all", close);

  function toggle() {
    isOpen ? close() : open();
  }

  document.addEventListener("keydown", (e) => {
    if (e.isComposing || e.keyCode === 229) return;
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
        selectItem(selectedIdx + 1, true);
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (selectedIdx > 0) {
        selectItem(selectedIdx - 1, true);
      }
    } else if (e.key === "Enter") {
      if (e.target.closest("[data-search-retry]")) return;
      e.preventDefault();
      activate(selectedIdx);
    }
  });

  document.addEventListener("click", (e) => {
    if (!isOpen) return;
    const menuBar = document.getElementById("menu-bar");
    if (menuBar && !e.composedPath().includes(menuBar)) {
      close();
    }
  });

  triggers.forEach((t) => {
    t.addEventListener("pointerenter", loadIndex, { passive: true });
    t.addEventListener("pointerdown", loadIndex, { passive: true });
    t.addEventListener("focus", loadIndex);

    t.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggle();
    });
  });

  const menuTrigger = document.getElementById("menu-trigger");
  if (menuTrigger) {
    menuTrigger.addEventListener(
      "click",
      (e) => {
        const menuBarEl = document.getElementById("menu-bar");
        if (!menuBarEl) return;
        const isMenuOpen = menuBarEl.classList.contains("is-open");
        if (isOpen || isMenuOpen) {
          e.preventDefault();
          e.stopPropagation();
          window.dispatchEvent(new CustomEvent("site:close-all"));
        }
      },
      true,
    );
  }

  document
    .querySelectorAll(
      "[data-search-trigger] .menu-kbd, [data-search-trigger] .nav-kbd",
    )
    .forEach((k) => {
      k.textContent = isMac ? "⌘K" : "Ctrl K";
    });
}
