import { escapeHtml } from "./escape-html.js";
import { fetchJson } from "./fetch-cache.js";
import { isImeEvent, isSearchShortcut, SHORTCUT_LABEL } from "./search-shortcut.js";
import {
  collectTags,
  highlight,
  makeSnippet,
  prepareRecord,
  searchRecords,
  tokenize,
} from "./search-core.js";

const TEXT = {
  en: {
    goHome: "Go to Home",
    goTo: (label) => `Go to ${label}`,
    toggleDark: "Toggle dark mode",
    switchLang: "Switch to English",
    browseTags: "Browse tags",
    start: "Search posts, type > for commands, or # for tags.",
    loadFailed: "Search could not load.",
    retry: "Retry",
    loading: "Loading search…",
    noMatches: "No matches. Try fewer words, or <em>type ></em> for commands.",
    command: "COMMAND",
    tag: "TAG",
    posts: (count) => `${count} ${count === 1 ? "post" : "posts"}`,
    postsTagged: (count) => `${count} ${count === 1 ? "post tagged" : "posts tagged"}`,
    selectToPreview: "Select an item to preview.",
    search: "Search",
    placeholder: "Search posts, > for commands, # for tags",
    results: "Search results",
    navigate: "navigate",
    open: "open",
    close: "close",
    toggle: "toggle",
  },
  zh: {
    goHome: "回到首页",
    goTo: (label) => `前往 ${label}`,
    toggleDark: "切换深色模式",
    switchLang: "切换到中文",
    browseTags: "浏览标签",
    start: "输入关键词搜索文章，输入 > 执行命令，输入 # 浏览标签。",
    loadFailed: "搜索加载失败。",
    retry: "重试",
    loading: "正在加载搜索…",
    noMatches: "暂无匹配。试试更少的关键词，或输入 <em>></em> 进入命令。",
    command: "命令",
    tag: "标签",
    posts: (count) => `${count} 篇`,
    postsTagged: (count) => `${count} 篇相关文章`,
    selectToPreview: "选中条目即可预览。",
    search: "搜索",
    placeholder: "搜索文章, > 输入命令, # 浏览标签",
    results: "搜索结果",
    navigate: "导航",
    open: "打开",
    close: "关闭",
    toggle: "开合",
  },
};

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

const ENTER_TRAIL = icon("enter", "sr-trail-icon");

export function initSearchPalette() {
  const root = document.getElementById("menu-search-panel");
  const menuBar = document.getElementById("menu-bar");
  const menuTrigger = document.getElementById("menu-trigger");

  const lang = document.documentElement.lang.toLowerCase().startsWith("en") ? "en" : "zh";
  const text = TEXT[lang];
  const nav = JSON.parse(root.dataset.nav);

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

  function loadIndex() {
    if (indexCache) return Promise.resolve(indexCache);
    if (indexPromise) return indexPromise;
    indexError = false;
    indexPromise = fetchJson(root.dataset.indexUrl)
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
    const next = html.getAttribute("data-theme") === "dark" ? "light" : "dark";
    html.setAttribute("data-theme", next);
    try {
      localStorage.setItem("theme", next);
    } catch (_) {}
    close();
  }

  function resultItem(record, tokens) {
    const meta = `${escapeHtml(record.section)} · ${escapeHtml(record.date)}`;
    return {
      rowClass: "",
      icon: "doc",
      title: highlight(record.title || "(untitled)", tokens),
      meta,
      snippet: makeSnippet(record, tokens, 120),
      trail: ENTER_TRAIL,
      preview() {
        const snip = makeSnippet(record, tokens, 280);
        const tags = record.tags.map((tag) => `<span>#${escapeHtml(tag.label)}</span>`).join("");
        return `
          <div class="preview-meta">${meta}</div>
          <h3 class="preview-title">${highlight(record.title || "", tokens)}</h3>
          ${snip ? `<div class="preview-snippet">${snip.split(/\n+/).filter((paragraph) => paragraph.trim()).map((paragraph) => `<p>${paragraph}</p>`).join("")}</div>` : ""}
          ${tags ? `<div class="preview-tags">${tags}</div>` : ""}`;
      },
      activate: () => navigate(record.url),
    };
  }

  function commandItem({ label, hint, icon: iconName, action }) {
    return {
      rowClass: " is-command",
      icon: iconName,
      title: escapeHtml(label),
      meta: text.command,
      trail: escapeHtml(hint),
      preview: () => `
          <div class="preview-meta">${text.command}</div>
          <h3 class="preview-title">${escapeHtml(label)}</h3>
          <p class="preview-summary">${escapeHtml(hint)}</p>`,
      activate: action,
    };
  }

  function tagItem({ slug, label, count }) {
    return {
      rowClass: " is-tag",
      icon: "tag",
      title: `#${escapeHtml(label)}`,
      meta: text.posts(count),
      trail: ENTER_TRAIL,
      preview: () => `
          <div class="preview-meta">${text.tag}</div>
          <h3 class="preview-title">#${escapeHtml(label)}</h3>
          <p class="preview-summary">${text.postsTagged(count)}</p>`,
      activate: () => navigate(root.dataset.tagsUrl + encodeURIComponent(slug) + "/"),
    };
  }

  function commandItems(query) {
    const commands = [
      ...nav.map(({ id, label, url }) => ({
        id: `go-${id}`,
        label: id === "home" ? text.goHome : text.goTo(label),
        hint: id === "home" ? url : `/${id}`,
        icon: id,
        action: () => navigate(url),
      })),
      { id: "theme", label: text.toggleDark, hint: "", icon: "theme", action: toggleTheme },
      { id: "lang", label: lang === "en" ? TEXT.zh.switchLang : TEXT.en.switchLang, hint: "lang", icon: "lang", action: () => navigate(root.dataset.languageUrl) },
      {
        id: "tags",
        label: text.browseTags,
        hint: "#",
        icon: "tag",
        action: () => {
          inputEl.value = "#";
          render("#");
          inputEl.focus();
        },
      },
    ];
    const q = query.toLowerCase();
    return commands
      .filter((c) => !q || c.label.toLowerCase().includes(q) || c.id.includes(q))
      .map(commandItem);
  }

  function render(query) {
    const trimmed = query.trim();
    if (trimmed.startsWith(">")) {
      currentItems = commandItems(trimmed.slice(1).trim());
      modeHintEl.textContent = "CMD";
    } else if (trimmed.startsWith("#")) {
      currentItems = indexCache ? collectTags(indexCache, lang, trimmed.slice(1).trim()).map(tagItem) : [];
      modeHintEl.textContent = "TAG";
    } else {
      const tokens = tokenize(trimmed);
      currentItems = searchRecords(indexCache, tokens, lang).map((record) => resultItem(record, tokens));
      modeHintEl.textContent = trimmed === "" ? "START" : "SEARCH";
    }
    selectedIdx = 0;
    renderList();
    syncSelection();
    renderPreview();
  }

  function emptyListHtml() {
    const value = inputEl.value.trim();
    if (!value) return `<li class="search-empty">${text.start}</li>`;
    if (!indexCache && !value.startsWith(">")) {
      return indexError
        ? `<li class="search-empty">${text.loadFailed} <button type="button" data-search-retry>${text.retry}</button></li>`
        : `<li class="search-empty" role="status">${text.loading}</li>`;
    }
    return `<li class="search-empty">${text.noMatches}</li>`;
  }

  function renderList() {
    if (!currentItems.length) {
      inputEl.removeAttribute("aria-activedescendant");
      listEl.innerHTML = emptyListHtml();
      return;
    }
    listEl.innerHTML = currentItems.map((item, idx) => {
      const selected = idx === selectedIdx;
      return `<li class="search-result${item.rowClass}${selected ? " is-selected" : ""}" data-idx="${idx}" id="search-result-${idx}" role="option" aria-selected="${selected}">
                      ${icon(item.icon)}
                      <div class="sr-body">
                          <div class="sr-title">${item.title}</div>
                          <div class="sr-meta">${item.meta}</div>
                          ${item.snippet === undefined ? "" : `<div class="search-result-snippet">${item.snippet}</div>`}
                      </div>
                      <span class="sr-trail">${item.trail}</span>
                  </li>`;
    }).join("");
  }

  function renderPreview() {
    const item = currentItems[selectedIdx];
    previewEl.innerHTML = item ? item.preview() : `<div class="search-preview-empty">${text.selectToPreview}</div>`;
  }

  function buildPanel() {
    root.innerHTML = `
              <div class="search-overlay" data-search-overlay></div>
              <div class="search-panel" role="dialog" aria-modal="true" aria-label="Search">
                  <div class="search-pane-left">
                      <div class="search-inputbar">
                          ${icon("search", "search-input-icon")}
                          <input class="search-input" type="text"
                                 role="combobox" aria-label="${text.search}" aria-autocomplete="list" aria-controls="search-results" aria-expanded="false"
                                 placeholder="${text.placeholder}"
                                 autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">
                          <span class="search-mode-hint" data-mode-hint>START</span>
                          <kbd class="search-esc">esc</kbd>
                      </div>
                      <ul class="search-results" id="search-results" role="listbox" aria-label="${text.results}"></ul>
                      <div class="search-foot">
                          <span><kbd>${icon("up", "kbd-icon")}${icon("down", "kbd-icon")}</kbd>${text.navigate}</span>
                          <span><kbd>${icon("enter", "kbd-icon")}</kbd>${text.open}</span>
                          <span><kbd>esc</kbd>${text.close}</span>
                          <span class="search-foot-spacer"></span>
                          <span><kbd>${SHORTCUT_LABEL}</kbd>${text.toggle}</span>
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
    root.querySelector("[data-search-overlay]").addEventListener("click", close);

    listEl.addEventListener("mouseover", (e) => {
      const li = e.target.closest(".search-result");
      if (!li) return;
      const idx = parseInt(li.dataset.idx, 10);
      if (idx !== selectedIdx) selectItem(idx);
    });

    listEl.addEventListener("click", (e) => {
      if (e.target.closest("[data-search-retry]")) {
        loadIndex();
        render(inputEl.value);
        inputEl.focus();
        return;
      }
      const li = e.target.closest(".search-result");
      if (li) currentItems[parseInt(li.dataset.idx, 10)]?.activate();
    });
  }

  function selectItem(idx, scroll = false) {
    selectedIdx = idx;
    syncSelection();
    renderPreview();
    if (scroll) listEl.children[selectedIdx].scrollIntoView({ block: "nearest" });
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
    menuBar.classList.remove("is-scrolled-away");
    menuBar.classList.add("is-search");

    // Register the injected DOM's initial CSS state (e.g. blur(0px)) before it transitions.
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
    menuBar.classList.remove("is-search");
    document.body.classList.remove("search-open");
    inputEl.setAttribute("aria-expanded", "false");
    const target = returnFocus instanceof HTMLElement &&
      returnFocus !== document.body && !returnFocus.closest("#menu-panel") &&
      returnFocus.checkVisibility({ visibilityProperty: true })
      ? returnFocus
      : menuTrigger;
    target.focus({ preventScroll: true });
    root.setAttribute("aria-hidden", "true");
  }

  window.addEventListener("site:close-all", close);

  function toggle() {
    isOpen ? close() : open();
  }

  document.addEventListener("keydown", (e) => {
    if (isImeEvent(e)) return;
    if (isSearchShortcut(e)) {
      e.preventDefault();
      e.stopPropagation();
      toggle();
      return;
    }
    if (!isOpen) return;
    if (e.key === "Tab") {
      const focusable = panel.querySelectorAll('input, button, a[href], [tabindex]:not([tabindex="-1"])');
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (selectedIdx < currentItems.length - 1) selectItem(selectedIdx + 1, true);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (selectedIdx > 0) selectItem(selectedIdx - 1, true);
    } else if (e.key === "Enter") {
      if (e.target.closest("[data-search-retry]")) return;
      e.preventDefault();
      currentItems[selectedIdx]?.activate();
    }
  });

  document.addEventListener("click", (e) => {
    if (isOpen && !e.composedPath().includes(menuBar)) close();
  });

  document.querySelectorAll("[data-search-trigger]").forEach((t) => {
    t.addEventListener("pointerenter", loadIndex, { passive: true });
    t.addEventListener("pointerdown", loadIndex, { passive: true });
    t.addEventListener("focus", loadIndex);
    t.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggle();
    });
  });

  menuTrigger.addEventListener("click", (e) => {
    if (isOpen || menuBar.classList.contains("is-open")) {
      e.preventDefault();
      e.stopPropagation();
      window.dispatchEvent(new CustomEvent("site:close-all"));
    }
  }, true);

  return { open };
}
