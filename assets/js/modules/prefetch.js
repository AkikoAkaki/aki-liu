import { isResourceConstrained } from './resource-mode.js';

export function initPrefetcher() {
  const prefetchedUrls = new Set();
  let hoverTimeout;
  const supportsRules = typeof HTMLScriptElement.supports === 'function' &&
    HTMLScriptElement.supports('speculationrules');

  function allowed() {
    const connection = navigator.connection;
    return !document.hidden && !isResourceConstrained() &&
      !/^(slow-2g|2g|3g)$/.test(connection?.effectiveType) &&
      prefetchedUrls.size < 3;
  }

  function targetUrl(link) {
    if (!link?.href || link.hasAttribute('download') ||
        (link.target && link.target !== '_self') || link.dataset.noPrefetch !== undefined) return;
    try {
      const url = new URL(link.href, location.href);
      // Only static page URLs: no downloads, query actions, or same-page anchors.
      if (!/^https?:$/.test(url.protocol) || url.origin !== location.origin ||
          url.search || url.pathname === location.pathname ||
          (!url.pathname.endsWith('/') && !url.pathname.endsWith('.html'))) return;
      url.hash = '';
      if (!prefetchedUrls.has(url.href)) return url.href;
    } catch (_) {}
  }

  function prefetch(link) {
    if (!allowed()) return;
    const href = targetUrl(link);
    if (!href) return;
    const node = document.createElement(supportsRules ? 'script' : 'link');
    if (supportsRules) {
      node.type = 'speculationrules';
      node.textContent = JSON.stringify({ prefetch: [{ urls: [href] }] });
    } else {
      node.rel = 'prefetch';
      node.href = href;
    }
    document.head.appendChild(node);
    prefetchedUrls.add(href);
  }

  document.body.addEventListener('mouseover', (event) => {
    clearTimeout(hoverTimeout);
    const link = event.target.closest('a');
    if (allowed() && targetUrl(link)) hoverTimeout = setTimeout(() => prefetch(link), 100);
  }, { passive: true });
  document.body.addEventListener('mouseout', () => clearTimeout(hoverTimeout), { passive: true });
  document.body.addEventListener('focusin', (event) => prefetch(event.target.closest('a')));
  document.body.addEventListener('touchstart', (event) => prefetch(event.target.closest('a')), { passive: true });
}
