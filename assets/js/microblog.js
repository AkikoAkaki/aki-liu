import { escapeHtml, tagToSlug } from "./modules/dom-utils.js";
import { matches, QUERIES } from "./modules/media.js";

(function () {
    const root = document.querySelector('.microblog-page');
    if (!root) return;

    const feedURL = root.dataset.feedUrl || '/microblog/feed.json';
    const deck = root.querySelector('.microblog-deck');
    const PAGE_SIZE = 30;

    let feedData = null;
    let feedPromise = null;
    let columnSeq = 1;
    const COLUMN_REFLOW_MS = 300;
    const columnAnimations = new WeakMap();

    function loadFeed() {
        if (feedData) return Promise.resolve(feedData);
        if (feedPromise) return feedPromise;
        feedPromise = fetch(feedURL, { credentials: 'same-origin' })
            .then(r => {
                if (!r.ok) throw new Error(`Feed request failed: ${r.status}`);
                return r.json();
            })
            .then(data => {
                if (!data || !Array.isArray(data.entries)) throw new Error('Invalid feed');
                feedData = data;
                return feedData;
            })
            .finally(() => {
                feedPromise = null;
            });
        return feedPromise;
    }

    function loadColumn(column, tag, year = '', onLoaded = () => {}) {
        column.setAttribute('aria-busy', 'true');
        const feedEl = column.querySelector('[data-mb-feed]');
        feedEl.replaceChildren();
        loadFeed().then(() => {
            if (!column.isConnected) return;
            hydrateColumn(column, tag, year);
            onLoaded();
        }).catch(() => {
            if (!column.isConnected) return;
            const message = document.createElement('div');
            message.className = 'mb-column-empty';
            message.setAttribute('role', 'alert');
            message.textContent = 'Unable to load entries. ';
            const retry = document.createElement('button');
            retry.type = 'button';
            retry.className = 'mb-feed-retry';
            retry.textContent = 'Retry';
            retry.addEventListener('click', () => loadColumn(column, tag, year, onLoaded));
            message.appendChild(retry);
            feedEl.replaceChildren(message);
        }).finally(() => {
            column.removeAttribute('aria-busy');
        });
    }

    function formatDate(iso) {
        try {
            const d = new Date(iso);
            if (isNaN(d.getTime())) return iso;
            const pad = n => String(n).padStart(2, '0');
            return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} · ${pad(d.getHours())}:${pad(d.getMinutes())}`;
        } catch (_) {
            return iso;
        }
    }

    function entriesForTag(slug) {
        if (!feedData) return [];
        if (!slug) return feedData.entries;
        return feedData.entries.filter(e => (e.tags || []).some(t => tagToSlug(t) === slug));
    }

    function tagLabel(slug, fallback = slug) {
        const el = document.querySelector(`.archive-tag-item[data-tag="${CSS.escape(slug)}"] .tag-name`);
        return el ? el.textContent.trim() : fallback;
    }

    function entriesForYear(year) {
        if (!feedData) return [];
        return feedData.entries.filter(e => {
            const d = new Date(e.date);
            return !isNaN(d.getTime()) && String(d.getFullYear()) === String(year);
        });
    }

    function buildImageGrid(images) {
        if (!images || !images.length) return '';
        const n = images.length;
        const cls = n === 1 ? 'is-one'
            : n === 2 ? 'is-two'
            : n === 3 ? 'is-three'
            : n === 4 ? 'is-four'
            : 'is-many';
        const visible = n > 5 ? images.slice(0, 4) : images;
        const overflow = n > 5 ? n - 4 : 0;
        const cells = visible.map((img, i) => {
            const ratio = img.w && img.h ? `${img.w} / ${img.h}` : '4 / 3';
            const overflowBadge = (overflow > 0 && i === visible.length - 1)
                ? `<span class="mb-img-overflow">+${overflow}</span>`
                : '';
            return `<div class="mb-img-cell" style="--mb-img-ratio: ${ratio}">
                <img src="${escapeHtml(img.src)}" alt="${escapeHtml(img.alt || '')}" loading="lazy" decoding="async" width="${img.w || ''}" height="${img.h || ''}">
                ${overflowBadge}
            </div>`;
        }).join('');
        return `<div class="mb-card-images ${cls}" data-mb-image-count="${n}">${cells}</div>`;
    }

    function renderTagDots(tags) {
        if (!tags || !tags.length) return '';
        const dots = tags.map(t => {
            const slug = tagToSlug(t);
            const label = tagLabel(slug, t);
            return `<a class="mb-card-tag-dot" href="?cols=${encodeURIComponent(slug)}" data-mb-tag="${escapeHtml(slug)}" data-mb-tag-label="${escapeHtml(label)}" title="${escapeHtml(label)}">
                <span class="item-dot" data-tag="${escapeHtml(slug)}"></span>
            </a>`;
        }).join('');
        return `<div class="mb-card-tag-dots">${dots}</div>`;
    }

    function renderCard(entry) {
        const card = document.createElement('article');
        card.className = 'mb-card';
        card.dataset.mbId = entry.id || entry.slug || '';
        card.innerHTML = `
            <header class="mb-card-header">
                <div class="mb-card-meta">
                    <div class="mb-card-date-wrapper">
                        <time class="mb-card-date" datetime="${escapeHtml(entry.date)}">${formatDate(entry.date)}</time>
                        ${renderTagDots(entry.tags)}
                    </div>
                </div>
            </header>
            <div class="mb-card-body">${entry.html || ''}</div>
            ${buildImageGrid(entry.images)}
        `;
        return card;
    }

    function appendBatch(column, entries, startIdx) {
        const feedEl = column.querySelector('[data-mb-feed]');
        if (!feedEl) return;
        const slice = entries.slice(startIdx, startIdx + PAGE_SIZE);
        const frag = document.createDocumentFragment();
        slice.forEach(entry => {
            frag.appendChild(renderCard(entry));
        });
        feedEl.appendChild(frag);
        const nextIdx = startIdx + slice.length;
        column.dataset.mbNextIdx = String(nextIdx);
        const done = nextIdx >= entries.length;
        const sentinel = column.querySelector('[data-mb-sentinel]');
        if (sentinel) sentinel.dataset.mbDone = done ? 'true' : 'false';
    }

    function hydrateColumn(column, tag, year = '') {
        const entries = year ? entriesForYear(year) : entriesForTag(tag);
        const countEl = column.querySelector('[data-mb-column-count]');
        if (countEl) countEl.textContent = entries.length;
        const unitEl = column.querySelector('[data-mb-column-unit]');
        if (unitEl) unitEl.textContent = entries.length === 1 ? 'Entry' : 'Entries';
        
        const feedEl = column.querySelector('[data-mb-feed]');
        if (feedEl) feedEl.innerHTML = '';
        column.dataset.mbNextIdx = '0';

        if (!entries.length) {
            const empty = document.createElement('div');
            empty.className = 'mb-column-empty';
            empty.textContent = year ? `Nothing in ${year} yet.`
                : tag ? `Nothing tagged #${tag} yet.` : 'Nothing yet.';
            feedEl.appendChild(empty);
            const sentinel = column.querySelector('[data-mb-sentinel]');
            if (sentinel) sentinel.dataset.mbDone = 'true';
            return;
        }

        appendBatch(column, entries, 0);
        attachInfiniteScroll(column, entries);
    }

    const observers = new WeakMap();
    function attachInfiniteScroll(column, entries) {
        const sentinel = column.querySelector('[data-mb-sentinel]');
        if (!sentinel) return;
        const existing = observers.get(column);
        if (existing) existing.disconnect();
        const observer = new IntersectionObserver(handles => {
            handles.forEach(entry => {
                if (!entry.isIntersecting) return;
                if (sentinel.dataset.mbDone === 'true') return;
                const next = parseInt(column.dataset.mbNextIdx || '0', 10);
                appendBatch(column, entries, next);
            });
        }, { root: null, rootMargin: '400px 0px' });
        observer.observe(sentinel);
        observers.set(column, observer);
    }

    function getActiveColumns() {
        return [...deck.querySelectorAll('.mb-column:not(.is-leaving)')];
    }

    function captureColumnRects(columns = getActiveColumns()) {
        const rects = new Map();
        columns.forEach(column => {
            rects.set(column, column.getBoundingClientRect());
        });
        return rects;
    }

    function animateColumn(column, keyframes, onFinish = () => {}) {
        columnAnimations.get(column)?.cancel();
        columnAnimations.delete(column);
        if (matches(QUERIES.reducedMotion)) {
            onFinish();
            return;
        }

        const animation = column.animate(keyframes, {
            duration: COLUMN_REFLOW_MS,
            easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
            fill: 'both'
        });
        columnAnimations.set(column, animation);
        animation.finished.then(() => {
            if (columnAnimations.get(column) !== animation) return;
            columnAnimations.delete(column);
            animation.cancel();
            onFinish();
        }, () => {});
    }

    function revealColumn(column) {
        const style = getComputedStyle(column);
        const from = { opacity: style.opacity, transform: style.transform };
        column.classList.remove('is-leaving');
        column.inert = false;
        animateColumn(column, [from, { opacity: 1, transform: 'none' }]);
    }

    function showColumn(column) {
        const left = column.offsetLeft;
        if (left >= deck.scrollLeft && left + column.offsetWidth <= deck.scrollLeft + deck.clientWidth) return;
        const inset = parseFloat(getComputedStyle(deck).paddingLeft) || 0;
        deck.scrollTo({
            left: left - inset,
            behavior: matches(QUERIES.reducedMotion) ? 'instant' : 'smooth'
        });
    }

    function animateColumnReflow(beforeRects) {
        const moves = getActiveColumns().map(column => ({
            column,
            before: beforeRects.get(column),
            after: column.getBoundingClientRect()
        }));
        moves.forEach(({ column, before, after }) => {
            if (!before) return;
            const deltaX = before.left - after.left;
            const deltaY = before.top - after.top;

            if (Math.abs(deltaX) < 0.5 && Math.abs(deltaY) < 0.5) return;

            animateColumn(column,
                [
                    { transform: `translate3d(${deltaX}px, ${deltaY}px, 0)` },
                    { transform: 'translate3d(0, 0, 0)' }
                ]
            );
        });
    }

    function openColumn(type, key, label = key, updateHistory = true) {
        const value = type === 'year' ? String(key) : tagToSlug(key || '');
        if (!value) return;
        const existing = deck.querySelector(`.mb-column[data-mb-${type}="${CSS.escape(value)}"]`);
        if (existing) {
            if (existing.classList.contains('is-leaving')) {
                revealColumn(existing);
                syncURL(updateHistory);
            }
            if (updateHistory) showColumn(existing);
            existing.classList.add('is-pulsing');
            setTimeout(() => existing.classList.remove('is-pulsing'), 600);
            return existing;
        }

        const column = document.createElement('section');
        column.className = `mb-column mb-column-${type}`;
        column.dataset.mbColumnId = `${type}-${columnSeq++}`;
        column.setAttribute(`data-mb-${type}`, value);
        column.innerHTML = `
            <div class="mb-column-content">
                <div class="mb-column-header">
                    <span class="mb-column-title">${escapeHtml(label)}</span>
                    <span class="mb-column-meta"><span class="mb-column-count" data-mb-column-count>0</span> <span data-mb-column-unit>Entries</span></span>
                    <button class="mb-column-close" type="button" data-mb-close aria-label="Close column">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><path d="M17 7L7 17"/><path d="M7 7l10 10"/></svg>
                    </button>
                </div>
                <div class="mb-column-feed" data-mb-feed></div>
                <div class="mb-column-sentinel" data-mb-sentinel aria-hidden="true"></div>
            </div>
        `;
        deck.appendChild(column);
        loadColumn(column, type === 'tag' ? value : '', type === 'year' ? value : '');
        animateColumn(column, [
            { opacity: 0, transform: 'translate3d(24px, 0, 0)' },
            { opacity: 1, transform: 'none' }
        ]);
        if (updateHistory) showColumn(column);
        column.querySelector('[data-mb-close]').addEventListener('click', () => closeColumn(column));
        syncURL(updateHistory);
        return column;
    }

    function closeColumn(column) {
        if (!column || column.classList.contains('mb-column-main') || column.classList.contains('is-leaving')) return;
        const style = getComputedStyle(column);
        const from = { opacity: style.opacity, transform: style.transform };
        column.classList.add('is-leaving');
        column.inert = true;
        syncURL();
        animateColumn(column, [from, { opacity: 0, transform: 'translate3d(24px, 0, 0)' }], () => {
            const beforeRects = captureColumnRects();
            observers.get(column)?.disconnect();
            column.remove();
            animateColumnReflow(beforeRects);
        });
    }

    function syncURL(updateHistory = true) {
        const slugs = getActiveColumns()
            .filter(c => c.classList.contains('mb-column-tag'))
            .map(c => c.dataset.mbTag)
            .filter(Boolean);
        const years = getActiveColumns()
            .filter(c => c.classList.contains('mb-column-year'))
            .map(c => c.dataset.mbYear)
            .filter(Boolean);

        const url = new URL(window.location.href);
        if (slugs.length) {
            url.searchParams.set('cols', slugs.join(','));
        } else {
            url.searchParams.delete('cols');
        }
        if (years.length) {
            url.searchParams.set('years', years.join(','));
        } else {
            url.searchParams.delete('years');
        }

        document.querySelectorAll('.archive-tag-item').forEach(el => {
            el.classList.toggle('active', slugs.includes(el.dataset.tag));
        });
        document.querySelectorAll('.archive-year-item').forEach(el => {
            el.classList.toggle('active', years.includes(el.dataset.year));
        });

        const next = url.pathname + (url.search ? url.search : '') + url.hash;
        if (updateHistory && next !== window.location.pathname + window.location.search + window.location.hash) {
            history.pushState({ cols: slugs, years }, '', next);
        }
    }

    function restoreFromURL() {
        const params = new URLSearchParams(window.location.search);
        const cols = (params.get('cols') || '').split(',').map(s => s.trim()).filter(Boolean);
        const years = (params.get('years') || '').split(',').map(s => s.trim()).filter(Boolean);
        const tags = feedData ? feedData.tags || [] : [];
        cols.forEach(slug => {
            const raw = tags.find(t => tagToSlug(t) === slug) || slug;
            openColumn('tag', slug, tagLabel(slug, raw), false);
        });
        years.forEach(year => openColumn('year', year, year, false));
        syncURL(false);
    }

    function bindSidebarTags() {
        const sidebar = document.querySelector('.archive-tags-list');
        if (!sidebar) return;
        sidebar.addEventListener('click', e => {
            const tagItem = e.target.closest('.archive-tag-item');
            if (!tagItem) return;
            e.preventDefault();
            openColumn('tag', tagItem.dataset.tag, tagLabel(tagItem.dataset.tag));
        });
    }

    function bindSidebarYears() {
        document.querySelectorAll('.archive-years-list').forEach(list => {
            list.addEventListener('click', e => {
                const yearItem = e.target.closest('.archive-year-item');
                if (!yearItem || !yearItem.dataset.year) return;
                e.preventDefault();
                openColumn('year', yearItem.dataset.year);
            });
        });
    }

    function bindCardTagClicks() {
        deck.addEventListener('click', e => {
            const tag = e.target.closest('.mb-card-tag-dot');
            if (!tag) return;
            e.preventDefault();
            openColumn('tag', tag.dataset.mbTag, tag.dataset.mbTagLabel || tag.dataset.mbTag);
        });
    }

    function bindPopstate() {
        window.addEventListener('popstate', () => {
            deck.querySelectorAll('.mb-column-tag, .mb-column-year').forEach(column => {
                columnAnimations.get(column)?.cancel();
                observers.get(column)?.disconnect();
                column.remove();
            });
            restoreFromURL();
        });
    }

    function init() {
        const mainColumn = deck.querySelector('.mb-column-main');
        loadColumn(mainColumn, '', '', () => {
            restoreFromURL();
        });
        bindSidebarTags();
        bindSidebarYears();
        bindCardTagClicks();
        bindPopstate();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
