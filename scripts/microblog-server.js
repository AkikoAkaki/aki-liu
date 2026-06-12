'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawnSync, exec } = require('child_process');
const url = require('url');

const PORT = 3737;
const ROOT = path.join(__dirname, '..');
const CONTENT_ROOT = path.resolve(ROOT, 'content');
const ARTICLE_SECTIONS = new Set(['ideas', 'notes', 'textlab', 'influences']);
const CONTENT_SECTIONS = ['ideas', 'notes', 'textlab', 'influences', 'microblog'];
const KNOWN_FRONTMATTER_FIELDS = new Set(['title', 'date', 'slug', 'tags', 'draft', 'math', 'enableKaTeX']);
const UI_FILE = path.join(__dirname, 'microblog-ui.html');
const TEMP_DIR = path.join(__dirname, '.temp-uploads');

function getLocalISO(customDate) {
  const now = customDate ? new Date(customDate) : new Date();
  const pad = n => String(n).padStart(2, '0');
  const offset = -now.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  const oh = pad(Math.floor(Math.abs(offset) / 60));
  const om = pad(Math.abs(offset) % 60);
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
    `T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}${sign}${oh}:${om}`;
}

function unquoteFrontMatterString(value) {
  if (value.length < 2) return value;
  const first = value[0];
  const last = value[value.length - 1];

  if (first === '"' && last === '"') {
    try {
      return JSON.parse(value);
    } catch (_) {
      return value.slice(1, -1).replace(/\\"/g, '"');
    }
  }

  if (first === "'" && last === "'") {
    return value.slice(1, -1).replace(/''/g, "'");
  }

  return value;
}

function splitInlineArray(value) {
  const inner = value.slice(1, -1).trim();
  if (!inner) return [];

  const items = [];
  let current = '';
  let quote = '';
  let escaping = false;

  for (const char of inner) {
    if (escaping) {
      current += char;
      escaping = false;
      continue;
    }

    if (quote === '"' && char === '\\') {
      current += char;
      escaping = true;
      continue;
    }

    if ((char === '"' || char === "'") && !quote) {
      quote = char;
      current += char;
      continue;
    }

    if (char === quote) {
      quote = '';
      current += char;
      continue;
    }

    if (char === ',' && !quote) {
      items.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  if (current.trim()) {
    items.push(current.trim());
  }

  return items.map(item => parseFrontMatterValue('', item)).filter(item => item !== '');
}

function parseFrontMatterValue(_key, rawValue) {
  const value = rawValue.trim();
  if (!value) return '';
  if (value.startsWith('[') && value.endsWith(']')) return splitInlineArray(value);
  if (/^(true|false)$/i.test(value)) return /^true$/i.test(value);
  return unquoteFrontMatterString(value);
}

function parseYamlFrontMatter(rawFrontmatter) {
  const data = {};
  let pendingArrayKey = null;

  rawFrontmatter.split(/\r\n|\n|\r/).forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;

    if (pendingArrayKey && /^\s*-\s+/.test(line)) {
      data[pendingArrayKey].push(parseFrontMatterValue(pendingArrayKey, line.replace(/^\s*-\s+/, '')));
      return;
    }

    pendingArrayKey = null;
    if (/^\s/.test(line)) return;

    const separatorIndex = line.indexOf(':');
    if (separatorIndex === -1) return;

    const key = line.slice(0, separatorIndex).trim();
    if (!KNOWN_FRONTMATTER_FIELDS.has(key)) return;

    const rawValue = line.slice(separatorIndex + 1);
    if (!rawValue.trim() && key === 'tags') {
      data[key] = [];
      pendingArrayKey = key;
      return;
    }

    data[key] = parseFrontMatterValue(key, rawValue);
  });

  return data;
}

function parseTomlFrontMatter(rawFrontmatter) {
  const data = {};

  rawFrontmatter.split(/\r\n|\n|\r/).forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;

    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) return;

    const key = line.slice(0, separatorIndex).trim();
    if (!KNOWN_FRONTMATTER_FIELDS.has(key)) return;

    data[key] = parseFrontMatterValue(key, line.slice(separatorIndex + 1));
  });

  return data;
}

function parseKnownFrontMatter(rawFrontmatter, delimiter) {
  return delimiter === 'toml'
    ? parseTomlFrontMatter(rawFrontmatter)
    : parseYamlFrontMatter(rawFrontmatter);
}

function readLineAt(text, offset) {
  if (offset >= text.length) return null;

  for (let index = offset; index < text.length; index += 1) {
    const char = text[index];
    if (char === '\r' || char === '\n') {
      const newline = char === '\r' && text[index + 1] === '\n' ? '\r\n' : char;
      return {
        text: text.slice(offset, index),
        newline,
        end: index + newline.length,
      };
    }
  }

  return {
    text: text.slice(offset),
    newline: '',
    end: text.length,
  };
}

function emptyFrontMatterResult(text) {
  return {
    delimiter: null,
    delimiterType: null,
    openingDelimiter: null,
    closingDelimiter: null,
    openingLine: '',
    openingNewline: '',
    closingLine: '',
    closingNewline: '',
    rawFrontmatter: '',
    data: {},
    body: text,
    content: text.trim(),
  };
}

function parseFrontMatter(text) {
  const openingMatch = text.match(/^((?:---|\+\+\+)[ \t]*)(\r\n|\n|\r)/);
  if (!openingMatch) return emptyFrontMatterResult(text);

  const openingLine = openingMatch[1];
  const marker = openingLine.trim();
  const openingNewline = openingMatch[2];
  const delimiter = marker === '+++' ? 'toml' : 'yaml';
  const frontmatterStart = openingMatch[0].length;
  let offset = frontmatterStart;

  while (offset <= text.length) {
    const line = readLineAt(text, offset);
    if (!line) break;

    if (line.text.trim() === marker) {
      const rawFrontmatter = text.slice(frontmatterStart, offset);
      const body = text.slice(line.end);

      return {
        delimiter,
        delimiterType: delimiter,
        openingDelimiter: marker,
        closingDelimiter: marker,
        openingLine,
        openingNewline,
        closingLine: line.text,
        closingNewline: line.newline,
        rawFrontmatter,
        data: parseKnownFrontMatter(rawFrontmatter, delimiter),
        body,
        content: body.trim(),
      };
    }

    offset = line.end;
  }

  return emptyFrontMatterResult(text);
}

function reconstructFrontMatter(parsed) {
  if (!parsed.delimiter) return parsed.body;
  return `${parsed.openingLine}${parsed.openingNewline}${parsed.rawFrontmatter}` +
    `${parsed.closingLine}${parsed.closingNewline}${parsed.body}`;
}

function resolveContentPath(relPath) {
  if (typeof relPath !== 'string' || !relPath.trim()) {
    throw new Error('Invalid path');
  }

  const targetPath = path.resolve(ROOT, relPath);
  const relativeToContent = path.relative(CONTENT_ROOT, targetPath);
  if (relativeToContent === '' || relativeToContent.startsWith('..') || path.isAbsolute(relativeToContent)) {
    throw new Error('Invalid path');
  }

  return {
    absPath: targetPath,
    relPath: path.relative(ROOT, targetPath).replace(/\\/g, '/'),
  };
}

function toRepoPath(absPath) {
  return path.relative(ROOT, absPath).replace(/\\/g, '/');
}

function asString(value) {
  return value === undefined || value === null ? '' : String(value);
}

function isTruthyValue(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return /^(true|yes|1)$/i.test(value.trim());
  return false;
}

function normalizeTags(value) {
  if (Array.isArray(value)) {
    return value.map(tag => asString(tag).trim()).filter(Boolean);
  }

  if (typeof value === 'string') {
    return value.split(',').map(tag => tag.trim()).filter(Boolean);
  }

  return [];
}

function collapseWhitespace(text) {
  return asString(text).replace(/\s+/g, ' ').trim();
}

function stripMarkdownForPreview(text) {
  return collapseWhitespace(text)
    .replace(/!\[[^\]]*]\([^)]+\)/g, '')
    .replace(/\[([^\]]+)]\([^)]+\)/g, '$1')
    .replace(/[`*_>#-]/g, '')
    .trim();
}

function truncateText(text, maxLength = 240) {
  const clean = stripMarkdownForPreview(text);
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, maxLength - 3).trim()}...`;
}

function firstNonEmptyLine(text) {
  return asString(text).split(/\r\n|\n|\r/).map(line => line.trim()).find(Boolean) || '';
}

function maxMtimeIso(filePaths) {
  const mtimes = filePaths
    .filter(filePath => fs.existsSync(filePath))
    .map(filePath => fs.statSync(filePath).mtimeMs);

  if (!mtimes.length) return null;
  return new Date(Math.max(...mtimes)).toISOString();
}

function readParsedContentFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const parsed = parseFrontMatter(raw);
  const stat = fs.statSync(filePath);

  return {
    path: toRepoPath(filePath),
    delimiter: parsed.delimiter,
    frontmatter: parsed.data,
    rawFrontmatter: parsed.rawFrontmatter,
    body: parsed.body,
    mtime: stat.mtime.toISOString(),
  };
}

function scanTags() {
  const tags = new Set();
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name === 'index.md' || entry.name === 'index.en.md') {
        const content = fs.readFileSync(full, 'utf8');
        normalizeTags(parseFrontMatter(content).data.tags).forEach(tag => tags.add(tag));
      }
    }
  }
  walk(path.join(ROOT, 'content'));
  return [...tags].sort();
}

function scanAllPosts() {
  const posts = [];
  // Keep in sync with layouts/_default/searchindex.json and search palette commands.
  const sections = ['microblog', 'ideas', 'notes', 'textlab', 'influences'];
  
  function walk(dir, section) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const hasIndexMd = entries.some(e => e.isFile() && e.name === 'index.md');
    
    if (hasIndexMd) {
      const relPath = path.relative(ROOT, dir).replace(/\\/g, '/');
      const zhPath = path.join(dir, 'index.md');
      const enPath = path.join(dir, 'index.en.md');
      
      const zhContent = fs.readFileSync(zhPath, 'utf8');
      const hasEn = fs.existsSync(enPath);
      const enContent = hasEn ? fs.readFileSync(enPath, 'utf8') : '';
      
      const zhParsed = parseFrontMatter(zhContent);
      const enParsed = hasEn ? parseFrontMatter(enContent) : null;
      
      posts.push({
        type: section === 'microblog' ? 'microblog' : 'article',
        section,
        relPath,
        dirName: path.basename(dir),
        title: zhParsed.data.title || '',
        titleEn: enParsed ? (enParsed.data.title || '') : '',
        date: zhParsed.data.date || '',
        slug: zhParsed.data.slug || '',
        draft: zhParsed.data.draft === true || zhParsed.data.draft === 'true',
        tags: zhParsed.data.tags || [],
        math: zhParsed.data.math === true || zhParsed.data.math === 'true' || zhParsed.data.enableKaTeX === true || zhParsed.data.enableKaTeX === 'true',
        content: zhParsed.content,
        contentEn: enParsed ? enParsed.content : '',
        hasEn
      });
      return;
    }
    
    for (const entry of entries) {
      if (entry.isDirectory()) {
        walk(path.join(dir, entry.name), section);
      }
    }
  }
  
  for (const sec of sections) {
    walk(path.join(ROOT, 'content', sec), sec);
  }
  
  return posts.sort((a, b) => {
    const dateA = new Date(a.date.split('T')[0]);
    const dateB = new Date(b.date.split('T')[0]);
    return dateB - dateA;
  });
}

function getArticleUrl(section, bundleSlug, frontmatter) {
  const slug = asString(frontmatter.slug).trim() || bundleSlug;
  if (bundleSlug === section) return `/${section}/`;
  return `/${section}/${slug}/`;
}

function getMicroblogParts(dir) {
  const relative = path.relative(path.join(CONTENT_ROOT, 'microblog'), dir).replace(/\\/g, '/');
  const match = relative.match(/^(\d{4})\/(\d{2})\/(\d{2}-\d{6})$/);
  if (!match) return null;

  return {
    year: match[1],
    month: match[2],
    bundleName: match[3],
    time: match[3].slice(3),
  };
}

function buildContentItem(section, dir) {
  const zhPath = path.join(dir, 'index.md');
  if (!fs.existsSync(zhPath)) return null;

  const enPath = path.join(dir, 'index.en.md');
  const hasEnglish = fs.existsSync(enPath);
  const zhFile = readParsedContentFile(zhPath);
  const enFile = hasEnglish ? readParsedContentFile(enPath) : null;
  const zh = zhFile.frontmatter;
  const en = enFile ? enFile.frontmatter : {};
  const bundleSlug = path.basename(dir);
  const kind = section === 'microblog' ? 'microblog' : 'article';
  const tags = normalizeTags(zh.tags).length ? normalizeTags(zh.tags) : normalizeTags(en.tags);
  const draft = isTruthyValue(zh.draft) || isTruthyValue(en.draft);
  const math = isTruthyValue(zh.math) || isTruthyValue(zh.enableKaTeX) ||
    isTruthyValue(en.math) || isTruthyValue(en.enableKaTeX);
  const date = asString(zh.date || en.date);
  let id;
  let itemUrl;
  let titleZh;
  let titleEn;
  let excerpt;

  if (kind === 'microblog') {
    const parts = getMicroblogParts(dir);
    if (!parts) return null;

    const slug = asString(zh.slug).trim() || parts.time;
    const zhFirstLine = truncateText(firstNonEmptyLine(zhFile.body), 160);
    const enFirstLine = enFile ? truncateText(firstNonEmptyLine(enFile.body), 160) : '';
    const fallbackTitle = `(no text) · ${parts.time}`;

    id = `microblog/${parts.year}/${parts.month}/${parts.bundleName}`;
    itemUrl = `/microblog/${slug}/`;
    titleZh = zhFirstLine || fallbackTitle;
    titleEn = enFirstLine;
    excerpt = titleZh;
  } else {
    id = `${section}/${bundleSlug}`;
    itemUrl = getArticleUrl(section, bundleSlug, zh);
    titleZh = asString(zh.title);
    titleEn = asString(en.title);
    excerpt = truncateText(firstNonEmptyLine(zhFile.body)) || titleZh || titleEn || '';
  }

  return {
    id,
    section,
    kind,
    path: toRepoPath(dir),
    url: itemUrl,
    date,
    draft,
    math,
    tags,
    title: {
      zh: titleZh,
      en: titleEn,
    },
    hasEnglish,
    excerpt,
    searchText: collapseWhitespace([
      titleZh,
      titleEn,
      zhFile.body,
      enFile ? enFile.body : '',
      tags.join(' '),
    ].filter(Boolean).join('\n')),
    mtime: maxMtimeIso([zhPath, enPath]),
  };
}

function walkContentBundles(section, visitor) {
  const sectionDir = path.join(CONTENT_ROOT, section);
  if (!fs.existsSync(sectionDir)) return;

  function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const hasIndexMd = entries.some(entry => entry.isFile() && entry.name === 'index.md');

    if (hasIndexMd) {
      visitor(dir);
      return;
    }

    for (const entry of entries) {
      if (entry.isDirectory()) {
        walk(path.join(dir, entry.name));
      }
    }
  }

  walk(sectionDir);
}

function scanContentItems() {
  const items = [];

  CONTENT_SECTIONS.forEach(section => {
    walkContentBundles(section, dir => {
      const item = buildContentItem(section, dir);
      if (item) items.push(item);
    });
  });

  return items.sort((a, b) => {
    const timeA = Date.parse(a.date) || 0;
    const timeB = Date.parse(b.date) || 0;
    if (timeA !== timeB) return timeB - timeA;
    return a.id.localeCompare(b.id);
  });
}

function isSafeContentId(id) {
  if (typeof id !== 'string' || !id.trim()) return false;
  if (id.includes('\\') || id.includes('..') || id.includes(':')) return false;
  if (path.isAbsolute(id) || id.startsWith('/')) return false;

  const parts = id.split('/');
  if (parts[0] === 'microblog') {
    return parts.length === 4 &&
      /^\d{4}$/.test(parts[1]) &&
      /^\d{2}$/.test(parts[2]) &&
      /^\d{2}-\d{6}$/.test(parts[3]);
  }

  return parts.length === 2 &&
    ARTICLE_SECTIONS.has(parts[0]) &&
    /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(parts[1]);
}

function resolveContentItem(id) {
  if (!isSafeContentId(id)) {
    const error = new Error('Invalid content id');
    error.statusCode = 400;
    throw error;
  }

  const item = scanContentItems().find(candidate => candidate.id === id);
  if (!item) {
    const error = new Error('Content item not found');
    error.statusCode = 404;
    throw error;
  }

  const bundleDir = path.resolve(ROOT, item.path);
  const relativeToContent = path.relative(CONTENT_ROOT, bundleDir);
  if (relativeToContent.startsWith('..') || path.isAbsolute(relativeToContent)) {
    const error = new Error('Invalid content path');
    error.statusCode = 400;
    throw error;
  }

  return { item, bundleDir };
}

function getContentDetail(id) {
  const { item, bundleDir } = resolveContentItem(id);
  const zhPath = path.join(bundleDir, 'index.md');
  const enPath = path.join(bundleDir, 'index.en.md');
  const files = {
    zh: readParsedContentFile(zhPath),
  };

  if (fs.existsSync(enPath)) {
    files.en = readParsedContentFile(enPath);
  }

  return { item, files };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function sendJSON(res, data, status = 200) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(body);
}

function gitRun(args, cwd) {
  if (process.env.TEST_MODE === 'true') {
    console.log(`[TEST MOCK GIT] git ${args.join(' ')}`);
    return 'mock git output';
  }
  const result = spawnSync('git', args, { cwd, encoding: 'utf8', shell: false });
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || 'git failed').trim());
  }
  return result.stdout;
}

function gitRead(args) {
  const result = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8', shell: false });
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || 'git failed').trim());
  }
  return result.stdout.trim();
}

function isEnvEnabled(name) {
  return /^(1|true|yes)$/i.test(process.env[name] || '');
}

function getRepoStatus() {
  const branch = process.env.TEST_MODE === 'true' && process.env.MICROBLOG_TEST_BRANCH
    ? process.env.MICROBLOG_TEST_BRANCH
    : gitRead(['rev-parse', '--abbrev-ref', 'HEAD']);

  return {
    branch,
    isMain: branch === 'main',
    noPush: isEnvEnabled('MICROBLOG_NO_PUSH'),
    dirty: gitRead(['status', '--porcelain']).length > 0,
    lastCommit: gitRead(['log', '-1', '--pretty=format:%h %s']),
  };
}

function getCurrentBranch() {
  if (process.env.TEST_MODE === 'true' && process.env.MICROBLOG_TEST_BRANCH) {
    return process.env.MICROBLOG_TEST_BRANCH;
  }

  return gitRun(['rev-parse', '--abbrev-ref', 'HEAD'], ROOT).trim();
}

function getPublishSafety() {
  const branch = getCurrentBranch();
  if (branch === 'main') {
    throw new Error('Console publish is blocked on main. Switch to a branch or use scripts/new-microblog.ps1 for file-only drafting.');
  }

  return {
    branch,
    noPush: isEnvEnabled('MICROBLOG_NO_PUSH'),
  };
}

function runPrePushCheck() {
  if (process.env.TEST_MODE === 'true') {
    if (isEnvEnabled('MICROBLOG_TEST_CHECK_FAIL')) {
      throw new Error('TEST_MODE pre-push check failed');
    }
    console.log('[TEST MOCK CHECK] powershell -NoProfile -ExecutionPolicy Bypass -File scripts/check.ps1');
    return 'mock check output';
  }

  const checkScript = path.join(ROOT, 'scripts', 'check.ps1');
  const shellCandidates = process.platform === 'win32' ? ['powershell', 'pwsh'] : ['pwsh', 'powershell'];

  for (const shellName of shellCandidates) {
    const result = spawnSync(shellName, [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      checkScript,
    ], { cwd: ROOT, encoding: 'utf8', shell: false });

    if (result.error && result.error.code === 'ENOENT') {
      continue;
    }

    if (result.error) {
      throw result.error;
    }

    if (result.status !== 0) {
      throw new Error((result.stderr || result.stdout || 'pre-push check failed').trim());
    }

    return result.stdout;
  }

  throw new Error('Unable to run scripts/check.ps1: PowerShell was not found.');
}

function pushWithSafety(policy) {
  if (policy.noPush) {
    const message = `Push skipped because MICROBLOG_NO_PUSH=1 on branch ${policy.branch}.`;
    console.log(`[SKIP] ${message}`);
    return { pushed: false, message };
  }

  runPrePushCheck();
  gitRun(['push'], ROOT);
  return { pushed: true, message: `Pushed branch ${policy.branch}.` };
}

const MIME = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.png': 'image/png', '.gif': 'image/gif',
  '.webp': 'image/webp', '.svg': 'image/svg+xml',
};

function formatFrontmatterValue(key, value, delimiter) {
  if (delimiter === 'toml') {
    if (key === 'tags') {
      const arr = Array.isArray(value) ? value : normalizeTags(value);
      return `[${arr.map(t => `"${String(t).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`).join(', ')}]`;
    }
    if (typeof value === 'boolean') return String(value);
    const str = String(value);
    return `"${str.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }
  if (key === 'tags') {
    const arr = Array.isArray(value) ? value : normalizeTags(value);
    if (!arr.length) return '[]';
    return `[${arr.map(t => `"${String(t).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`).join(', ')}]`;
  }
  if (typeof value === 'boolean') return String(value);
  if (typeof value === 'number') return String(value);
  const str = String(value);
  if (!str) return '""';
  const needsQuoting = (
    /^[\s]/.test(str) || /[\s]$/.test(str) ||
    /^[{[\]!|>'"%@`]/.test(str) ||
    /:\s/.test(str) ||
    str === 'true' || str === 'false' || str === 'null' || str === '~'
  );
  if (key === 'title' || needsQuoting) {
    return `"${str.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }
  return str;
}

function applyFrontmatterUpdates(rawFm, delimiter, updates) {
  if (!rawFm || !updates || !Object.keys(updates).length) return rawFm;
  const handled = new Set();
  let result = rawFm;
  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) continue;
    const isTOML = delimiter === 'toml';
    const formatted = formatFrontmatterValue(key, value, delimiter);
    const newLine = isTOML ? `${key} = ${formatted}` : `${key}: ${formatted}`;
    let matched = false;
    if (!isTOML) {
      const blockRe = new RegExp(`^${key}:[ \\t]*\\r?\\n(?:[ \\t]+-[^\\r\\n]*\\r?\\n)+`, 'm');
      if (blockRe.test(result)) {
        result = result.replace(blockRe, newLine + '\n');
        matched = true;
      }
    }
    if (!matched) {
      const inlineRe = isTOML
        ? new RegExp(`^${key}[ \\t]*=[ \\t]*[^\\r\\n]*$`, 'm')
        : new RegExp(`^${key}:[ \\t]*[^\\r\\n]*$`, 'm');
      if (inlineRe.test(result)) {
        result = result.replace(inlineRe, newLine);
        matched = true;
      }
    }
    if (matched) handled.add(key);
  }
  const sep = delimiter === 'toml' ? ' = ' : ': ';
  const toAppend = Object.entries(updates)
    .filter(([k, v]) => v !== undefined && !handled.has(k))
    .map(([k, v]) => `${k}${sep}${formatFrontmatterValue(k, v, delimiter)}`);
  if (toAppend.length) {
    if (!result.match(/[\r\n]$/)) result += '\n';
    result += toAppend.join('\n') + '\n';
  }
  return result;
}

function atomicWriteFile(filePath, content) {
  const tmpPath = filePath + '.tmp';
  try {
    fs.writeFileSync(tmpPath, content, 'utf8');
    fs.renameSync(tmpPath, filePath);
  } catch (err) {
    try { fs.unlinkSync(tmpPath); } catch (_) {}
    throw err;
  }
}

const server = http.createServer(async (req, res) => {
  const { pathname } = url.parse(req.url);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    return res.end();
  }

  if (req.method === 'GET' && pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(fs.readFileSync(UI_FILE));
  }

  if (req.method === 'GET' && pathname === '/api/health') {
    return sendJSON(res, { ok: true, version: 'content-studio-v1' });
  }

  if (req.method === 'GET' && pathname === '/api/status') {
    try {
      return sendJSON(res, getRepoStatus());
    } catch (e) {
      return sendJSON(res, { error: e.message }, 500);
    }
  }

  if (req.method === 'GET' && pathname === '/api/content') {
    try {
      return sendJSON(res, scanContentItems());
    } catch (e) {
      return sendJSON(res, { error: e.message }, 500);
    }
  }

  if (req.method === 'GET' && pathname.startsWith('/api/content/')) {
    try {
      let id;
      try {
        id = decodeURIComponent(pathname.slice('/api/content/'.length));
      } catch (_) {
        const error = new Error('Invalid content id');
        error.statusCode = 400;
        throw error;
      }
      return sendJSON(res, getContentDetail(id));
    } catch (e) {
      return sendJSON(res, { error: e.message }, e.statusCode || 500);
    }
  }

  if (req.method === 'PUT' && pathname.startsWith('/api/content/')) {
    try {
      let id;
      try {
        id = decodeURIComponent(pathname.slice('/api/content/'.length));
      } catch (_) {
        return sendJSON(res, { ok: false, error: 'Invalid content id' }, 400);
      }
      const bodyBuf = await readBody(req);
      let payload;
      try { payload = JSON.parse(bodyBuf.toString('utf8')); } catch (_) {
        return sendJSON(res, { ok: false, error: 'Invalid JSON' }, 400);
      }

      const { item, bundleDir } = resolveContentItem(id);
      const kind = item.kind;
      const zhPath = path.join(bundleDir, 'index.md');
      const enPath = path.join(bundleDir, 'index.en.md');
      const enExists = fs.existsSync(enPath);
      const baseMtime = payload.baseMtime || {};
      const filesPayload = payload.files || {};
      const zhPayload = filesPayload.zh || {};
      const enPayload = filesPayload.en || {};
      const zhFmPayload = zhPayload.frontmatter || {};

      // Read zh file + mtime conflict check
      if (!fs.existsSync(zhPath)) {
        return sendJSON(res, { ok: false, error: 'Content file not found' }, 404);
      }
      const zhStat = fs.statSync(zhPath);
      if (baseMtime.zh && zhStat.mtime.toISOString() !== baseMtime.zh) {
        return sendJSON(res, { ok: false, state: 'conflict', error: 'File changed outside Content Studio' }, 409);
      }
      const zhParsed = parseFrontMatter(fs.readFileSync(zhPath, 'utf8'));

      // Read en file + mtime conflict check
      let enParsed = null;
      if (enExists) {
        const enStat = fs.statSync(enPath);
        if (baseMtime.en && enStat.mtime.toISOString() !== baseMtime.en) {
          return sendJSON(res, { ok: false, state: 'conflict', error: 'File changed outside Content Studio' }, 409);
        }
        enParsed = parseFrontMatter(fs.readFileSync(enPath, 'utf8'));
      }

      // Build zh frontmatter updates
      const zhUpdates = {};
      if (kind === 'article' && typeof zhFmPayload.title === 'string') zhUpdates.title = zhFmPayload.title;
      if (kind === 'article' && typeof zhFmPayload.date === 'string' && zhFmPayload.date) zhUpdates.date = zhFmPayload.date;
      if (zhFmPayload.tags !== undefined) zhUpdates.tags = normalizeTags(zhFmPayload.tags);
      if (typeof zhFmPayload.draft === 'boolean') zhUpdates.draft = zhFmPayload.draft;
      if (kind === 'article' && typeof zhFmPayload.math === 'boolean') {
        zhUpdates['enableKaTeX' in zhParsed.data ? 'enableKaTeX' : 'math'] = zhFmPayload.math;
      }

      const newZhBody = typeof zhPayload.body === 'string' ? zhPayload.body : zhParsed.body;
      const newZhRawFm = applyFrontmatterUpdates(zhParsed.rawFrontmatter, zhParsed.delimiter, zhUpdates);
      const newZhContent = reconstructFrontMatter({ ...zhParsed, rawFrontmatter: newZhRawFm, body: newZhBody });

      // Build en file update if it exists
      let newEnContent = null;
      if (enExists && enParsed) {
        const enFmPayload = enPayload.frontmatter || {};
        const enUpdates = {};
        if (kind === 'article' && typeof enFmPayload.title === 'string') enUpdates.title = enFmPayload.title;
        if ('date' in enParsed.data && kind === 'article' && typeof zhFmPayload.date === 'string' && zhFmPayload.date) enUpdates.date = zhFmPayload.date;
        if ('tags' in enParsed.data && zhFmPayload.tags !== undefined) enUpdates.tags = normalizeTags(zhFmPayload.tags);
        if ('draft' in enParsed.data && typeof zhFmPayload.draft === 'boolean') enUpdates.draft = zhFmPayload.draft;
        if (kind === 'article' && typeof zhFmPayload.math === 'boolean') {
          if ('enableKaTeX' in enParsed.data) enUpdates.enableKaTeX = zhFmPayload.math;
          else if ('math' in enParsed.data) enUpdates.math = zhFmPayload.math;
        }
        const newEnBody = typeof enPayload.body === 'string' ? enPayload.body : enParsed.body;
        const newEnRawFm = applyFrontmatterUpdates(enParsed.rawFrontmatter, enParsed.delimiter, enUpdates);
        newEnContent = reconstructFrontMatter({ ...enParsed, rawFrontmatter: newEnRawFm, body: newEnBody });
      }

      // Atomic writes
      atomicWriteFile(zhPath, newZhContent);
      if (newEnContent !== null) atomicWriteFile(enPath, newEnContent);

      const refreshed = getContentDetail(id);
      console.log(`[SAVE] ${id}`);
      return sendJSON(res, { ok: true, state: 'saved', item: refreshed.item, files: refreshed.files, message: 'Saved locally. Not committed or pushed.' });
    } catch (e) {
      if (e.statusCode === 409) return sendJSON(res, { ok: false, state: 'conflict', error: e.message }, 409);
      console.error('[SAVE FAIL]', e.message);
      return sendJSON(res, { ok: false, error: e.message }, e.statusCode || 500);
    }
  }

  if (req.method === 'GET' && pathname === '/api/tags') {
    return sendJSON(res, { tags: scanTags() });
  }

  if (req.method === 'GET' && pathname === '/api/posts') {
    try {
      return sendJSON(res, { posts: scanAllPosts() });
    } catch (e) {
      return sendJSON(res, { error: e.message }, 500);
    }
  }

  if (req.method === 'GET' && pathname.startsWith('/uploads/')) {
    const filename = path.basename(pathname.slice(9));
    const filePath = path.join(TEMP_DIR, filename);
    if (fs.existsSync(filePath)) {
      const ext = path.extname(filename).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      return res.end(fs.readFileSync(filePath));
    }
    res.writeHead(404);
    return res.end('Not found');
  }

  if (req.method === 'POST' && pathname === '/api/upload-image') {
    try {
      const body = await readBody(req);
      const { filename, data } = JSON.parse(body);
      const ext = path.extname(filename).toLowerCase() || '.jpg';
      const safeName = `img-${Date.now()}${ext}`;
      fs.writeFileSync(path.join(TEMP_DIR, safeName), Buffer.from(data, 'base64'));
      return sendJSON(res, { filename: safeName });
    } catch (e) {
      return sendJSON(res, { error: e.message }, 500);
    }
  }

  if (req.method === 'POST' && pathname === '/api/publish') {
    try {
      const body = await readBody(req);
      const {
        type,
        section,
        relPath,
        title,
        titleEn,
        content,
        contentEn,
        tags,
        draft,
        math,
        date
      } = JSON.parse(body);

      const publishPolicy = getPublishSafety();

      let targetDir = '';
      let isEdit = false;
      let finalRelPath = '';
      let finalSlug = '';

      if (relPath) {
        // Edit existing post
        let resolvedPath;
        try {
          resolvedPath = resolveContentPath(relPath);
        } catch (_) {
          return sendJSON(res, { ok: false, error: 'Invalid path' }, 400);
        }
        targetDir = resolvedPath.absPath;
        if (!fs.existsSync(targetDir)) {
          return sendJSON(res, { ok: false, error: 'Target directory not found for editing' }, 400);
        }
        isEdit = true;
        finalRelPath = resolvedPath.relPath;
        const parts = finalRelPath.split('/');
        finalSlug = parts[parts.length - 1];
        if (type === 'microblog' && finalSlug.includes('-')) {
          finalSlug = finalSlug.split('-')[1];
        }
      } else {
        // Create new post
        const now = new Date();
        const pad = n => String(n).padStart(2, '0');
        
        if (type === 'microblog') {
          const year = String(now.getFullYear());
          const month = pad(now.getMonth() + 1);
          const day = pad(now.getDate());
          const slug = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
          const dirName = `${day}-${slug}`;
          targetDir = path.join(ROOT, 'content', 'microblog', year, month, dirName);
          finalRelPath = `content/microblog/${year}/${month}/${dirName}`;
          finalSlug = slug;
        } else {
          // Article slug generation or sanitization
          let slug = '';
          if (titleEn) {
            slug = titleEn.toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/(^-|-$)/g, '');
          }
          if (!slug) {
            slug = `post-${Date.now()}`;
          }
          const sec = section || 'ideas';
          if (!ARTICLE_SECTIONS.has(sec)) {
            return sendJSON(res, { ok: false, error: 'Invalid section' }, 400);
          }
          targetDir = path.join(ROOT, 'content', sec, slug);
          finalRelPath = `content/${sec}/${slug}`;
          finalSlug = slug;
        }
      }

      fs.mkdirSync(targetDir, { recursive: true });

      // Move any referenced temp images into the post directory
      const allContent = content + '\n' + (contentEn || '');
      const imgRefs = [...allContent.matchAll(/!\[.*?\]\(([^)]+)\)/g)].map(m => m[1]);
      for (const ref of imgRefs) {
        if (ref.startsWith('img-')) {
          const tempPath = path.join(TEMP_DIR, ref);
          if (fs.existsSync(tempPath)) {
            fs.renameSync(tempPath, path.join(targetDir, ref));
          }
        }
      }

      const isoDate = getLocalISO(date);
      const tagsStr = tags && tags.length ? `[${tags.map(t => `"${t}"`).join(', ')}]` : '[]';

      // 1. Write Chinese index.md
      let zhFront = '';
      if (type === 'microblog') {
        zhFront = `---\ndate: ${isoDate}\nslug: ${finalSlug}\ntags: ${tagsStr}\ndraft: ${!!draft}\n---\n\n${content.trim()}\n`;
      } else {
        zhFront = `---\ntitle: "${title.replace(/"/g, '\\"')}"\ndate: ${isoDate.split('T')[0]}\ntags: ${tagsStr}\ndraft: ${!!draft}\n`;
        if (math) {
          zhFront += `math: true\n`;
        }
        zhFront += `---\n\n${content.trim()}\n`;
      }
      fs.writeFileSync(path.join(targetDir, 'index.md'), zhFront, 'utf8');

      // 2. Write English index.en.md (if provided for articles)
      if (type !== 'microblog') {
        const enPath = path.join(targetDir, 'index.en.md');
        if (contentEn && contentEn.trim()) {
          let enFront = `---\ntitle: "${titleEn.replace(/"/g, '\\"')}"\ndate: ${isoDate.split('T')[0]}\ntags: ${tagsStr}\ndraft: ${!!draft}\n`;
          if (math) {
            enFront += `math: true\n`;
          }
          enFront += `---\n\n${contentEn.trim()}\n`;
          fs.writeFileSync(enPath, enFront, 'utf8');
        } else if (fs.existsSync(enPath)) {
          // If english file existed but now cleared, remove it
          fs.unlinkSync(enPath);
        }
      }

      const actionText = isEdit ? 'edit' : 'create';
      const commitMsg = `${type}: ${actionText} ${finalRelPath}`;

      gitRun(['add', finalRelPath], ROOT);
      gitRun(['commit', '-m', commitMsg], ROOT);
      const pushResult = pushWithSafety(publishPolicy);

      console.log(`[OK] ${finalRelPath}`);
      return sendJSON(res, { ok: true, slug: finalSlug, dir: finalRelPath, branch: publishPolicy.branch, pushed: pushResult.pushed, message: pushResult.message });
    } catch (e) {
      console.error('[FAIL]', e.message);
      return sendJSON(res, { ok: false, error: e.message }, 500);
    }
  }

  if (req.method === 'POST' && pathname === '/api/delete') {
    try {
      const body = await readBody(req);
      const { relPath } = JSON.parse(body);
      const publishPolicy = getPublishSafety();

      let resolvedPath;
      try {
        resolvedPath = resolveContentPath(relPath);
      } catch (_) {
        return sendJSON(res, { ok: false, error: 'Invalid path' }, 400);
      }

      const targetDir = resolvedPath.absPath;
      const finalRelPath = resolvedPath.relPath;
      if (!fs.existsSync(targetDir)) {
        return sendJSON(res, { ok: false, error: 'Path not found' }, 404);
      }

      // Delete folder from disk
      fs.rmSync(targetDir, { recursive: true, force: true });

      // Git add -A to track deletion, commit, push
      gitRun(['add', '-A', finalRelPath], ROOT);
      gitRun(['commit', '-m', `delete: ${path.basename(finalRelPath)}`], ROOT);
      const pushResult = pushWithSafety(publishPolicy);

      console.log(`[OK] Deleted ${finalRelPath}`);
      return sendJSON(res, { ok: true, branch: publishPolicy.branch, pushed: pushResult.pushed, message: pushResult.message });
    } catch (e) {
      console.error('[FAIL]', e.message);
      return sendJSON(res, { ok: false, error: e.message }, 500);
    }
  }

  res.writeHead(404);
  res.end('Not found');
});

function startServer() {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
  return server.listen(PORT, '127.0.0.1', () => {
    console.log(`Microblog Console running at http://localhost:${PORT}`);
    if (process.env.TEST_MODE !== 'true') {
      exec(`start http://localhost:${PORT}`);
    }
  });
}

if (require.main === module) {
  startServer();
}

module.exports = {
  parseFrontMatter,
  reconstructFrontMatter,
  scanContentItems,
  getContentDetail,
  getRepoStatus,
  startServer,
};
