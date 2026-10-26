import { escapeHtml, tagToSlug } from "./dom-utils.js";

export function prepareRecord(r) {
  return {
    ...r,
    _titleLower: (r.title || "").toLowerCase(),
    _titleTokens: tokenize(r.title),
    _bodyLower: (r.body || "").toLowerCase(),
    _summaryLower: (r.summary || "").toLowerCase(),
    _tagsLower: (r.tags || []).map((t) => String(t).toLowerCase()),
  };
}

function isCJK(s) {
  return /[\u3400-\u9fff\uf900-\ufaff]/.test(s);
}

export function tokenize(query) {
  const q = (query || "").toLowerCase().trim();
  if (!q) return [];
  const tokens = [];
  const parts = q.match(/[\u3400-\u9fff\uf900-\ufaff]+|[^\u3400-\u9fff\uf900-\ufaff\s]+/g) || [];
  for (const part of parts) {
    if (isCJK(part)) {
      if (part.length === 1) tokens.push(part);
      else
        for (let i = 0; i < part.length - 1; i++)
          tokens.push(part.substring(i, i + 2));
    } else {
      tokens.push(...(part.match(/[\p{L}\p{N}]+(?:[._+#/-][\p{L}\p{N}]+)*[+#]*/gu) || []));
    }
  }
  return [...new Set(tokens)];
}

function findToken(haystack, needle, from = 0) {
  let index = haystack.indexOf(needle, from);
  const word = /[\p{Script=Latin}\p{N}_]/u;
  while (index !== -1) {
    const before = word.test(needle[0]) && word.test(haystack[index - 1] || "");
    if (!before) return index;
    index = haystack.indexOf(needle, index + needle.length);
  }
  return -1;
}

function countHits(haystack, needle) {
  if (!haystack || !needle) return 0;
  let count = 0,
    idx = 0;
  while (count < 3 && (idx = findToken(haystack, needle, idx)) !== -1) {
    count++;
    idx += needle.length;
  }
  return count;
}

function scoreRecord(rec, tokens) {
  let total = 0;
  let titleTerms = 0;
  let tagTerms = 0;
  for (const t of tokens) {
    const titleHits = countHits(rec._titleLower, t);
    const tagHits = rec._tagsLower.reduce(
      (a, tag) => a + (findToken(tag, t) !== -1 ? 1 : 0),
      0,
    );
    const summaryHits = countHits(rec._summaryLower, t);
    const bodyHits = countHits(rec._bodyLower, t);
    if (!(titleHits || tagHits || summaryHits || bodyHits)) return null;
    if (titleHits) titleTerms++;
    if (tagHits) tagTerms++;
    total += titleHits * 5 + tagHits * 3 + summaryHits * 2 + bodyHits * 1;
  }
  const exactTitle = rec._titleTokens.length === tokens.length &&
    rec._titleTokens.every((token, i) => token === tokens[i]);
  const tier = exactTitle ? 3 : titleTerms === tokens.length ? 2 : titleTerms || tagTerms ? 1 : 0;
  return { tier, total };
}

// Records must come from prepareRecord().
export function searchRecords(records, tokens, lang) {
  if (!records || !tokens.length) return [];
  const hits = [];
  for (const rec of records) {
    if (rec.lang !== lang) continue;
    const s = scoreRecord(rec, tokens);
    if (s) hits.push({ rec, ...s });
  }
  hits.sort(
    (a, b) => b.tier - a.tier || b.total - a.total ||
      (b.rec.date || "").localeCompare(a.rec.date || ""),
  );
  return hits.slice(0, 30).map((h) => h.rec);
}

export function recordTagLabel(rec, i) {
  return (rec.tagLabels && rec.tagLabels[i]) || String(rec.tags[i]);
}

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

export function highlight(text, tokens) {
  const lower = text.toLowerCase();
  const ranges = [];
  for (const token of tokens) {
    let index = 0;
    while (token && (index = findToken(lower, token, index)) !== -1) {
      ranges.push([index, index + token.length]);
      index += token.length;
    }
  }
  ranges.sort((a, b) => a[0] - b[0] || b[1] - a[1]);
  const merged = [];
  for (const range of ranges) {
    const previous = merged.at(-1);
    if (previous && range[0] <= previous[1]) previous[1] = Math.max(previous[1], range[1]);
    else merged.push(range);
  }
  let html = "", cursor = 0;
  for (const [start, end] of merged) {
    html += escapeHtml(text.slice(cursor, start)) + "<mark>" + escapeHtml(text.slice(start, end)) + "</mark>";
    cursor = end;
  }
  return html + escapeHtml(text.slice(cursor));
}

export function makeSnippet(rec, tokens, len) {
  const body = (rec.body || rec.summary || "").replace(/\r\n?/g, "\n");
  const lower = body.toLowerCase();
  if (!body) return "";
  let pos = -1;
  for (const t of tokens) {
    const i = findToken(lower, t);
    if (i !== -1 && (pos === -1 || i < pos)) pos = i;
  }
  const span = len || 160;
  if (body.length <= span) return highlight(body, tokens);
  const contentSpan = span - 2;
  const start = Math.max(0, Math.min(pos === -1 ? 0 : pos - Math.floor(contentSpan / 3), body.length - contentSpan));
  const end = Math.min(body.length, start + contentSpan);
  let text = body.slice(start, end);
  if (start > 0) text = "…" + text;
  if (end < body.length) text = text + "…";
  return highlight(text, tokens);
}
