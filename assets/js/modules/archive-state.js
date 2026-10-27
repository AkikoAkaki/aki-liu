const tokens = (value) => (value || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

export function archiveEntries(list) {
  return [...list.querySelectorAll(":scope > .archive-item")].map((element) => ({
    element,
    tags: tokens(element.dataset.archiveTags),
    year: element.dataset.archiveYear,
  }));
}

export function readArchiveFilters(list) {
  const params = new URLSearchParams(location.search);
  const initialTags = tokens(list.dataset.archiveInitialTags);
  const validTags = new Set([...tokens(list.dataset.archiveValidTags), ...initialTags]);
  const validYears = new Set(tokens(list.dataset.archiveValidYears));
  return {
    tags: new Set((params.has("tags") ? tokens(params.get("tags")) : initialTags).filter((tag) => validTags.has(tag))),
    years: new Set(tokens(params.get("years")).filter((year) => validYears.has(year))),
  };
}

export function matchesArchiveFilters(entry, filters) {
  return (!filters.tags.size || entry.tags.some((tag) => filters.tags.has(tag))) &&
    (!filters.years.size || filters.years.has(entry.year));
}

export function updateArchiveView(entries, filters) {
  const matched = entries.filter((entry) => matchesArchiveFilters(entry, filters));
  const visible = new Set(matched);
  entries.forEach((entry) => { entry.element.hidden = !visible.has(entry); });

  document.querySelectorAll(".archive-tag-item[data-tag], .archive-year-item[data-year]").forEach((control) => {
    const active = control.dataset.tag !== undefined
      ? filters.tags.has(control.dataset.tag)
      : filters.years.has(control.dataset.year);
    control.classList.toggle("active", active);
    if (control.getAttribute("role") === "button") control.setAttribute("aria-pressed", String(active));
  });

  const entryStat = document.querySelector('[data-archive-stat="entries"]');
  const yearStat = document.querySelector('[data-archive-stat="years"]');
  if (entryStat) entryStat.textContent = String(matched.length);
  if (yearStat) yearStat.textContent = String(new Set(matched.map((entry) => entry.year)).size);
  return matched;
}

export function syncArchiveURL(list, filters) {
  const url = new URL(location.href);
  const tags = [...filters.tags].sort();
  const years = [...filters.years].sort().reverse();
  if (tags.length || list.dataset.archiveInitialTags) url.searchParams.set("tags", tags.join(","));
  else url.searchParams.delete("tags");
  if (years.length) url.searchParams.set("years", years.join(","));
  else url.searchParams.delete("years");
  const next = url.pathname + url.search + url.hash;
  if (next !== location.pathname + location.search + location.hash) history.pushState(null, "", next);
}
