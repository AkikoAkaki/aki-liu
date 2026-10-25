// Pure search helpers for the search palette: no DOM access, no module state.
import { escapeHtml, tagToSlug } from "./dom-utils.js";

// Adds the lower-cased fields that scoring reads.
export function prepareRecord(r) {
  return {
    ...r,
    _titleLower: (r.title || "").toLowerCase(),
    _bodyLower: (r.body || "").toLowerCase(),
    _summaryLower: (r.summary || "").toLowerCase(),
    _tagsLower: (r.tags || []).map((t) => String(t).toLowerCase()),
  };
}

// ---------- Tokenization ----------
function isCJK(s) {
  return /[\u3400-\u9fff\uf900-\ufaff]/.test(s);
}

export function tokenize(query) {
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
    } else {
      tokens.push(part);
    }
  }
  return [...new Set(tokens)];
}

// ---------- Scoring ----------
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

// Records must come from prepareRecord().
export function searchRecords(records, tokens, lang) {
  if (!records || !tokens.length) return [];
  const hits = [];
  for (const rec of records) {
    if (rec.lang !== lang) continue;
    const s = scoreRecord(rec, tokens);
    if (s > 0) hits.push({ rec, s });
  }
  hits.sort(
    (a, b) => b.s - a.s || (b.rec.date || "").localeCompare(a.rec.date || ""),
  );
  return hits.slice(0, 30).map((h) => h.rec);
}

// ---------- Tags ----------
// Display label for the i-th tag of a record; labels come from the index
// (rendered by partials/tag-label.html), falling back to the raw tag.
export function recordTagLabel(rec, i) {
  return (rec.tagLabels && rec.tagLabels[i]) || String(rec.tags[i]);
}

// Tags used by records in `lang`, keyed by slug, most used first.
export function collectTags(records, lang, query) {
  const counts = new Map();
  for (const r of records || []) {
    if (r.lang !== lang) continue;
    (r.tags || []).forEach((t, i) => {
      const slug = tagToSlug(t);
      const entry = counts.get(slug) || {
        slug,
        raw: String(t),
        label: recordTagLabel(r, i),
        count: 0,
      };
      entry.count++;
      counts.set(slug, entry);
    });
  }
  const q = (query || "").toLowerCase();
  return [...counts.values()]
    .filter(
      (t) =>
        !q ||
        t.raw.toLowerCase().includes(q) ||
        t.label.toLowerCase().includes(q),
    )
    .sort((a, b) => b.count - a.count || a.raw.localeCompare(b.raw));
}

// ---------- Snippet + highlight ----------
export function highlight(text, tokens) {
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

export function makeSnippet(rec, tokens, len) {
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
