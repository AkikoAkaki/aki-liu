export function initThemePersistence() {
  // --- Theme persistence (run before paint where possible) ---
  try {
    const stored = localStorage.getItem("theme");
    if (stored === "dark" || stored === "light") {
      document.documentElement.setAttribute("data-theme", stored);
    }
  } catch (_) {
    /* localStorage unavailable */
  }
}
