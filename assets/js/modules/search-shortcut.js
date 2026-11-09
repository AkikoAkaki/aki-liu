export const SHORTCUT_LABEL = /Mac|iPhone|iPad/i.test(navigator.userAgent) ? "⌘K" : "Ctrl K";

export function isImeEvent(event) {
  return event.isComposing || event.keyCode === 229;
}

export function isSearchShortcut(event) {
  return (event.metaKey || event.ctrlKey) && event.key?.toLowerCase() === "k";
}
