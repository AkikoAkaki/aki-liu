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
  // Template tag links use Hugo urlize; keep this convention aligned.
  return String(tag).toLowerCase().replace(/\s+/g, "-");
}
