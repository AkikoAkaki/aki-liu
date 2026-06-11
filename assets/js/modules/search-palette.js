export function initSearchPalette() {
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
        id: "go-notes",
        label: lang === "en" ? "Go to Notes" : "前往 Notes",
        hint: "/notes",
        icon: "arrow",
        action: () =>
          navigate(lang === "en" ? "/en/notes/" : "/notes/"),
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
