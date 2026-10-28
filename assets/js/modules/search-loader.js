export function initSearchLoader(src) {
  const root = document.getElementById("menu-search-panel");
  if (!root || !src) return;
  const triggers = [...document.querySelectorAll("[data-search-trigger]")];
  const intentTargets = [...triggers, document.getElementById("menu-trigger")].filter(Boolean);
  let loading, ready = false, wanted = false;
  const shortcut = /Mac|iPhone|iPad/i.test(navigator.userAgent) ? "⌘K" : "Ctrl K";
  triggers.forEach((t) => t.querySelectorAll(".menu-kbd, .nav-kbd").forEach((k) => { k.textContent = shortcut; }));

  function warm() {
    if (!loading) loading = import(src).then(({ initSearchPalette }) => {
      const api = initSearchPalette();
      ready = true;
      document.removeEventListener("keydown", key, true);
      document.removeEventListener("click", click, true);
      window.removeEventListener("site:close-all", cancel);
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
    return loading;
  }
  function request() { wanted = !wanted; root.setAttribute("aria-busy", "true"); warm(); }
  function cancel() { wanted = false; }
  function key(e) {
    if (ready || e.isComposing || e.keyCode === 229) return;
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault(); e.stopImmediatePropagation(); request();
    } else if (e.key === "Escape") cancel();
  }
  function click(e) {
    if (ready || !e.target.closest("[data-search-trigger]")) return;
    e.preventDefault(); e.stopImmediatePropagation(); request();
  }
  document.addEventListener("keydown", key, true);
  document.addEventListener("click", click, true);
  window.addEventListener("site:close-all", cancel);
  intentTargets.forEach((t) => {
    t.addEventListener("pointerenter", warm, { passive: true });
    t.addEventListener("focus", warm);
  });
}
