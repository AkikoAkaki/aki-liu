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
const UI_FILE = path.join(__dirname, 'microblog-ui.html');
const TEMP_DIR = path.join(__dirname, '.temp-uploads');

fs.mkdirSync(TEMP_DIR, { recursive: true });

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

function parseFrontMatterValue(key, rawValue) {
  let val = rawValue.trim();
  if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
  if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
  if (key === 'tags' && val.startsWith('[') && val.endsWith(']')) {
    val = val.slice(1, -1).split(',').map(t => t.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
  } else if (val === 'true') {
    val = true;
  } else if (val === 'false') {
    val = false;
  }
  return val;
}

function parseFrontMatterLine(line) {
  const parts = line.split(':');
  if (parts.length >= 2) {
    const key = parts[0].trim();
    return [key, parseFrontMatterValue(key, parts.slice(1).join(':'))];
  }

  const eqParts = line.split('=');
  if (eqParts.length >= 2) {
    const key = eqParts[0].trim();
    return [key, parseFrontMatterValue(key, eqParts.slice(1).join('='))];
  }

  return null;
}

function parseFrontMatter(text) {
  const data = {};
  let content = text;
  
  const delimiterMatch = text.match(/^(---\r?\n|\+\+\+\r?\n)/);
  if (delimiterMatch) {
    const delim = delimiterMatch[1];
    const rest = text.slice(delim.length);
    const endIdx = rest.indexOf(delim);
    if (endIdx !== -1) {
      const fmText = rest.slice(0, endIdx);
      content = rest.slice(endIdx + delim.length).trim();
      
      fmText.split(/\r?\n/).forEach(line => {
        const parsed = parseFrontMatterLine(line);
        if (parsed) data[parsed[0]] = parsed[1];
      });
    }
  }
  return { data, content };
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
        const m = content.match(/^tags:\s*\[(.*?)\]/m);
        if (m) {
          m[1].split(',').forEach(t => {
            const clean = t.trim().replace(/^["']|["']$/g, '');
            if (clean) tags.add(clean);
          });
        }
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

const MIME = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.png': 'image/png', '.gif': 'image/gif',
  '.webp': 'image/webp', '.svg': 'image/svg+xml',
};

const server = http.createServer(async (req, res) => {
  const { pathname } = url.parse(req.url);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    return res.end();
  }

  if (req.method === 'GET' && pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(fs.readFileSync(UI_FILE));
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
      gitRun(['push'], ROOT);

      console.log(`[OK] ${finalRelPath}`);
      return sendJSON(res, { ok: true, slug: finalSlug, dir: finalRelPath });
    } catch (e) {
      console.error('[FAIL]', e.message);
      return sendJSON(res, { ok: false, error: e.message }, 500);
    }
  }

  if (req.method === 'POST' && pathname === '/api/delete') {
    try {
      const body = await readBody(req);
      const { relPath } = JSON.parse(body);

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
      gitRun(['push'], ROOT);

      console.log(`[OK] Deleted ${finalRelPath}`);
      return sendJSON(res, { ok: true });
    } catch (e) {
      console.error('[FAIL]', e.message);
      return sendJSON(res, { ok: false, error: e.message }, 500);
    }
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Microblog Console running at http://localhost:${PORT}`);
  if (process.env.TEST_MODE !== 'true') {
    exec(`start http://localhost:${PORT}`);
  }
});
