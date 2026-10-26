// Edge-color and footer-reveal check for iOS Safari 26.
//
// Safari 26 paints its status bar and toolbar areas from fixed elements that
// touch the screen edges. This script ports WebKit's selection logic
// (LocalFrameView::fixedContainerEdges and Page::updateFixedContainerEdges)
// to JavaScript and runs it in headless Chromium at iPhone 16 Pro size.
//
// Usage (after scripts/check.ps1 has built public_test/):
//   node scripts/edge-check.mjs [siteDir]
// Set EDGE_CHECK_BROWSER to a Chrome or Edge executable if auto-detect fails.
// Exits 1 when any check fails. Final acceptance still needs a real iPhone.

import { spawn } from "node:child_process";
import { createReadStream, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { extname, join, resolve } from "node:path";

const siteDir = resolve(process.argv[2] || "public_test");
if (!existsSync(join(siteDir, "index.html"))) {
  console.error(`No built site at ${siteDir}. Run scripts/check.ps1 or hugo --destination public_test first.`);
  process.exit(2);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- static server ----------
const types = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".json": "application/json", ".svg": "image/svg+xml", ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".woff2": "font/woff2", ".mp4": "video/mp4" };
const server = createServer((req, res) => {
  let path = join(siteDir, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (existsSync(path) && statSync(path).isDirectory()) path = join(path, "index.html");
  if (!path.startsWith(siteDir) || !existsSync(path)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": types[extname(path)] || "application/octet-stream" });
  createReadStream(path).pipe(res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;

// ---------- headless browser over CDP ----------
const browserPath = [
  process.env.EDGE_CHECK_BROWSER,
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].find((p) => p && existsSync(p));
if (!browserPath) {
  console.error("No Chrome or Edge found. Set EDGE_CHECK_BROWSER.");
  server.close();
  process.exit(2);
}
const profile = mkdtempSync(join(tmpdir(), "edge-check-"));
const browser = spawn(browserPath, ["--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "--no-first-run", "about:blank"], { stdio: "ignore" });
let devtoolsPort;
for (let i = 0; i < 100 && !devtoolsPort; i++) {
  await sleep(100);
  const file = join(profile, "DevToolsActivePort");
  if (existsSync(file)) devtoolsPort = readFileSync(file, "utf8").split("\n")[0].trim();
}
const browserExited = new Promise((r) => browser.once("exit", r));
const finish = async (code) => {
  browser.kill();
  server.close();
  await Promise.race([browserExited, sleep(5000)]);
  rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  process.exit(code);
};
if (!devtoolsPort) { console.error("Browser did not start."); await finish(2); }

const target = (await (await fetch(`http://127.0.0.1:${devtoolsPort}/json/list`)).json()).find((t) => t.type === "page");
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r));
let nextId = 0;
const pending = new Map();
ws.addEventListener("message", (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
const send = (method, params = {}) => new Promise((r) => { const id = ++nextId; pending.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
const evaluate = async (expression) => {
  const { result } = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || "evaluation failed");
  return result.result.value;
};
const open = async (path, { width, height, mobile, theme }) => {
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: mobile ? 3 : 1, mobile });
  await send("Page.navigate", { url: origin + path });
  await sleep(800);
  await evaluate(`localStorage.setItem('theme', '${theme}')`);
  await send("Page.reload", {});
  await sleep(1500);
  await evaluate(`document.documentElement.style.scrollBehavior = 'auto'`);
};
const scrollTo = (fraction) => evaluate(`(async () => {
  window.__edgeState && (window.__edgeState.userScrolled = true);
  for (let i = 0; i < 2; i++) { scrollTo(0, (document.documentElement.scrollHeight - innerHeight) * ${fraction}); await new Promise(r => setTimeout(r, 300)); }
})()`);

// ---------- WebKit edge sampler (runs in the page) ----------
const sampler = `(() => {
  const MARGIN = 4, THIN = 10, NEARLY_TRANSPARENT = 0.1;
  const W = innerWidth, H = innerHeight;
  const rect = { x: MARGIN, y: MARGIN, w: W - 2 * MARGIN, h: H - 2 * MARGIN };
  const alpha = (c) => { const m = c.match(/rgba?\\(([^)]+)\\)/); if (!m) return 0; const p = m[1].split(/[ ,\\/]+/).filter(Boolean).map(Number); return p.length > 3 ? p[3] : 1; };
  const horizontal = (side) => side === "top" || side === "bottom";
  const adjacent = { top: "right", right: "bottom", bottom: "left", left: "top" };
  const compare = (side, el) => {
    const r = el.getBoundingClientRect();
    const viewport = horizontal(side) ? Math.min(rect.w, W) : Math.min(rect.h, H);
    const length = horizontal(side) ? r.width : r.height;
    return length < viewport * 0.9 ? "Smaller" : length < viewport * 1.05 ? "Similar" : "Larger";
  };
  const hasBackground = (cs) => alpha(cs.backgroundColor) > 0 || cs.backgroundImage !== "none";
  const hidden = (el, cs) => cs.visibility !== "visible" || +cs.opacity < NEARLY_TRANSPARENT ||
    (!hasBackground(cs) && cs.backdropFilter === "none" && !el.firstElementChild && !el.textContent.trim() && !/^(img|video|canvas|iframe|svg)$/i.test(el.tagName));
  const backgroundFor = (side, el, cs) => {
    const r = el.getBoundingClientRect();
    if (r.width <= THIN || r.height <= THIN || hidden(el, cs) || compare(side, el) === "Smaller") return null;
    return alpha(cs.backgroundColor) > 0 ? cs.backgroundColor : null;
  };
  const classify = (side, el) => {
    const cs = getComputedStyle(el);
    if (cs.position !== "fixed" && cs.position !== "sticky") return ["NotFixedOrSticky", cs];
    if (hidden(el, cs)) return ["Hidden", cs];
    const along = compare(side, el), across = compare(adjacent[side], el);
    const color = backgroundFor(side, el, cs);
    const dimming = along !== "Smaller" && across !== "Smaller" && hasBackground(cs) && !el.firstElementChild && !!color && alpha(color) < 1;
    if (along === "Smaller") return [across !== "Smaller" ? "Candidate" : "TooSmall", cs];
    if (!dimming && across === "Larger") return ["TooLarge", cs];
    if (along === "Similar" && across === "Similar" && parseInt(cs.zIndex) < 0) return ["NegativeZIndex", cs];
    return ["Candidate", cs];
  };
  const hit = (x, y, ignorePointerEvents) => {
    let style;
    if (ignorePointerEvents) { style = document.createElement("style"); style.textContent = "*,*::before,*::after{pointer-events:auto!important}"; document.head.appendChild(style); }
    const el = document.elementFromPoint(x, y);
    style?.remove();
    return el;
  };
  const find = (side, ignorePointerEvents) => {
    const el = hit(rect.x + rect.w / 2, side === "top" ? rect.y : rect.y + rect.h, ignorePointerEvents);
    let color = null, multiple = false, backdrop = false, retry = false;
    for (let a = el; a && a.nodeType === 1; a = a.parentElement) {
      const [type, cs] = classify(side, a);
      if (type !== "Hidden") {
        if (cs.backdropFilter && cs.backdropFilter !== "none") backdrop = true;
        else { const c = backgroundFor(side, a, cs); if (c) { if (!color) color = c; else if (color !== c) multiple = true; } }
      }
      if (["Hidden", "TooLarge", "NegativeZIndex"].includes(type)) retry = cs.pointerEvents === "none";
      if (type === "Candidate") return { container: a, color: backdrop || multiple ? null : color };
    }
    return { retry };
  };
  const name = (el) => el.tagName.toLowerCase() + (typeof el.className === "string" && el.className.trim() ? "." + el.className.trim().split(/\\s+/).join(".") : "");
  const state = (window.__edgeState ||= { userScrolled: false });
  const out = {};
  for (const side of ["top", "bottom"]) {
    const previous = state[side];
    if (side === "top" && state.userScrolled) { out.top = previous ? previous.result : { container: null }; continue; }
    let r = find(side, true);
    if (r.retry) r = find(side, false);
    if (!r.container && previous?.el.isConnected) {
      const cs = getComputedStyle(previous.el);
      const tag = previous.el.tagName;
      if (cs.display !== "none" && (cs.visibility === "visible" || (side === "top" && tag === "HEADER") || (side === "bottom" && tag === "FOOTER"))) {
        out[side] = { ...previous.result, persisted: true };
        continue;
      }
    }
    const result = r.container ? { container: name(r.container), color: r.color } : { container: null };
    state[side] = r.container ? { el: r.container, result } : null;
    out[side] = result;
  }
  return out;
})()`;

// ---------- checks ----------
const failures = [];
const fail = (where, message) => failures.push(`${where}: ${message}`);

const firstArticle = (() => {
  const dir = join(siteDir, "textlab");
  const slug = existsSync(dir) && readdirSync(dir).find((d) => existsSync(join(dir, d, "index.html")) && d !== "page");
  return slug ? `/textlab/${slug}/` : null;
})();
const pages = ["/", firstArticle, "/textlab/", "/about/", "/microblog/", "/dashboard/", "/notes/"]
  .filter((p) => p && existsSync(join(siteDir, p, "index.html")));
const phone = { width: 402, height: 874, mobile: true };

for (const theme of ["light", "dark"]) {
  for (const path of pages) {
    const where = `${theme} ${path}`;
    await open(path, { ...phone, theme });
    const bg = await evaluate(`getComputedStyle(document.querySelector('.site-wrapper')).backgroundColor`);

    // Status bar: a real fixed element must give Safari the page color.
    const atLoad = await evaluate(sampler);
    if (!atLoad.top.container) fail(where, "top: no fixed container, page content shows under the status bar");
    else if (atLoad.top.color !== bg) fail(where, `top: Safari extends ${atLoad.top.color ?? "a sampled color"} from ${atLoad.top.container}, page is ${bg}`);

    // Toolbar: no fixed container at the bottom edge while reading, before or after visiting the footer.
    for (const [step, fraction] of [["middle", 0.5], ["bottom", 1], ["middle after footer", 0.5], ["top after footer", 0]]) {
      await scrollTo(fraction);
      const edges = await evaluate(sampler);
      if (fraction !== 1 && edges.bottom.container) {
        fail(where, `${step}: toolbar takes ${edges.bottom.color ?? "a sampled color"} from ${edges.bottom.container}${edges.bottom.persisted ? " (kept from an earlier visit)" : ""}`);
      }
      if (fraction === 1) {
        const end = await evaluate(`(() => {
          const scrollers = [document.body, ...document.querySelectorAll('body *')].filter(e => /auto|scroll/.test(getComputedStyle(e).overflowY) && e.scrollHeight > e.clientHeight + 1 && !e.closest('.menu-bar'));
          return {
            footerBottom: Math.round(document.querySelector('.site-footer').getBoundingClientRect().bottom),
            radius: getComputedStyle(document.querySelector('.site-wrapper')).borderBottomLeftRadius,
            curve: getComputedStyle(document.documentElement).getPropertyValue('--footer-curve').trim(),
            scrollers: scrollers.map(e => e.tagName.toLowerCase() + '.' + String(e.className).trim().split(/\\s+/)[0] + ' (+' + (e.scrollHeight - e.clientHeight) + 'px)'),
          };
        })()`);
        if (Math.abs(end.footerBottom - phone.height) > 1) fail(where, `page does not end at the footer (footer bottom ${end.footerBottom}px of ${phone.height}px)`);
        if (end.radius !== (end.curve || "40px")) fail(where, `page corners at the end are ${end.radius}, expected ${end.curve || "40px"}`);
        if (end.scrollers.length) fail(where, `nested scroll containers can trap touch scrolling: ${end.scrollers.join(", ")}`);
      }
    }
  }
}

// Reveal animation follows the scroll: start state mid-page, end state at the bottom.
if (firstArticle) {
  for (const viewport of [{ ...phone, narrows: false }, { width: 850, height: 900, mobile: false, narrows: false }, { width: 1440, height: 900, mobile: false, narrows: true }]) {
    const where = `reveal ${viewport.width}px`;
    await open(firstArticle, { ...viewport, theme: "light" });
    const state = () => evaluate(`(() => { const s = getComputedStyle(document.querySelector('.site-wrapper')); return { radius: s.borderBottomLeftRadius, transform: s.transform }; })()`);
    // Start state: footer fully below the screen (skipped if the page is too short for that).
    const beforeFooter = await evaluate(`(async () => {
      const y = document.querySelector('.site-footer').getBoundingClientRect().top + scrollY - innerHeight - 100;
      if (y <= 0) return false;
      scrollTo(0, y); await new Promise(r => setTimeout(r, 300)); return true;
    })()`);
    if (beforeFooter) {
      const start = await state();
      if (start.radius !== "0px") fail(where, `corners are ${start.radius} before the footer is visible, expected 0px`);
    }
    await scrollTo(1);
    const bottom = await state();
    if (bottom.radius === "0px") fail(where, "corners stay square at the bottom");
    const narrowed = /^matrix\(0\.9/.test(bottom.transform);
    if (narrowed !== viewport.narrows) fail(where, viewport.narrows ? "page does not narrow at the bottom" : `page narrows at the bottom (${bottom.transform})`);
  }
}

ws.close();

console.log(`edge-check: ${pages.length} pages x 2 themes at 402x874, reveal at 402/850/1440px`);
if (failures.length) {
  console.log(`FAIL (${failures.length})`);
  for (const f of failures) console.log("  - " + f);
  await finish(1);
}
console.log("PASS");
await finish(0);
