'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawnSync, exec } = require('child_process');
const url = require('url');

const PORT = 3737;
const ROOT = path.join(__dirname, '..');
const UI_FILE = path.join(__dirname, 'microblog-ui.html');
const TEMP_DIR = path.join(__dirname, '.temp-uploads');
const CONTENT_DIR = path.join(ROOT, 'content', 'microblog');

fs.mkdirSync(TEMP_DIR, { recursive: true });

function getLocalISO() {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const offset = -now.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  const oh = pad(Math.floor(Math.abs(offset) / 60));
  const om = pad(Math.abs(offset) % 60);
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
    `T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}${sign}${oh}:${om}`;
}

function scanTags() {
  const tags = new Set();
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === 'index.md') {
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
  walk(CONTENT_DIR);
  return [...tags].sort();
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
  const result = spawnSync('git', args, { cwd, encoding: 'utf8', shell: true });
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || 'git 命令失败').trim());
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
      const { content, tags } = JSON.parse(body);

      const now = new Date();
      const pad = n => String(n).padStart(2, '0');
      const year = String(now.getFullYear());
      const month = pad(now.getMonth() + 1);
      const day = pad(now.getDate());
      const slug = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
      const dirName = `${day}-${slug}`;
      const postDir = path.join(CONTENT_DIR, year, month, dirName);

      fs.mkdirSync(postDir, { recursive: true });

      // Move any referenced temp images into the post directory
      const imgRefs = [...content.matchAll(/!\[.*?\]\(([^)]+)\)/g)].map(m => m[1]);
      for (const ref of imgRefs) {
        const tempPath = path.join(TEMP_DIR, ref);
        if (fs.existsSync(tempPath)) {
          fs.renameSync(tempPath, path.join(postDir, ref));
        }
      }

      const isoDate = getLocalISO();
      const tagsStr = tags.length ? `[${tags.map(t => `"${t}"`).join(', ')}]` : '[]';
      const frontMatter = `---\ndate: ${isoDate}\nslug: ${slug}\ntags: ${tagsStr}\ndraft: false\n---\n\n${content.trim()}\n`;

      fs.writeFileSync(path.join(postDir, 'index.md'), frontMatter, 'utf8');

      const relDir = `content/microblog/${year}/${month}/${dirName}`;
      const commitMsg = `microblog: ${year}-${month}-${day} ${slug.slice(0, 2)}:${slug.slice(2, 4)}`;

      gitRun(['add', relDir], ROOT);
      gitRun(['commit', '-m', commitMsg], ROOT);
      gitRun(['push'], ROOT);

      console.log(`[OK] ${relDir}`);
      return sendJSON(res, { ok: true, slug, dir: relDir });
    } catch (e) {
      console.error('[FAIL]', e.message);
      return sendJSON(res, { ok: false, error: e.message }, 500);
    }
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Microblog → http://localhost:${PORT}`);
  exec(`start http://localhost:${PORT}`);
});
