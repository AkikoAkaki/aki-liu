export function escapeHtml(value) {
  return String(value == null ? "" : value).replace(
    /[<>&"']/g,
    (char) =>
      ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        '"': "&quot;",
        "'": "&#39;",
      })[char],
  );
}

export function tagToSlug(tag) {
  return String(tag).toLowerCase().replace(/\s+/g, "-");
}
