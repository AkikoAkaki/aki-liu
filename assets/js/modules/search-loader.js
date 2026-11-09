import { isImeEvent, isSearchShortcut, SHORTCUT_LABEL } from "./search-shortcut.js";

export function initSearchLoader(src) {
  const root = document.getElementById("menu-search-panel");
  const triggers = [...document.querySelectorAll("[data-search-trigger]")];
  const intentTargets = [...triggers, document.getElementById("menu-trigger")];
  let loading, wanted = false;
  triggers.forEach((t) => t.querySelectorAll(".menu-kbd").forEach((k) => { k.textContent = SHORTCUT_LABEL; }));

  function warm() {
    if (!loading) loading = import(src).then(({ initSearchPalette }) => {
      const api = initSearchPalette();
      document.removeEventListener("keydown", key, true);
      document.removeEventListener("click", click, true);
      intentTargets.forEach((t) => {
        t.removeEventListener("pointerenter", warm);
        t.removeEventListener("focus", warm);
      });
      if (wanted) api.open();
    }).catch((error) => {
      loading = null;
      wanted = false;
      console.error("Search:", error);
    }).finally(() => root.removeAttribute("aria-busy"));
  }
  function request() { wanted = !wanted; root.setAttribute("aria-busy", "true"); warm(); }
  function key(e) {
    if (isImeEvent(e)) return;
    if (isSearchShortcut(e)) {
      e.preventDefault(); e.stopImmediatePropagation(); request();
    } else if (e.key === "Escape") wanted = false;
  }
  function click(e) {
    if (!e.target.closest("[data-search-trigger]")) return;
    e.preventDefault(); e.stopImmediatePropagation(); request();
  }
  document.addEventListener("keydown", key, true);
  document.addEventListener("click", click, true);
  intentTargets.forEach((t) => {
    t.addEventListener("pointerenter", warm, { passive: true });
    t.addEventListener("focus", warm);
  });
}
