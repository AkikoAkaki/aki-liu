(function () {
    const root = document.querySelector('.microblog-page');
    if (!root) return;

    const feedURL = root.dataset.feedUrl || '/microblog/feed.json';
    const deck = root.querySelector('.microblog-deck');
    const tagBar = root.querySelector('[data-mb-tag-bar]');
    const totalEl = root.querySelector('[data-mb-total]');
    const PAGE_SIZE = 30;
    const STAGGER_MS = 40;
    const COMPRESSION_THRESHOLD = 0.96;

    let feedData = null;
    let feedPromise = null;
    let columnSeq = 1;
    let compressionFrame = 0;
    const COLUMN_REFLOW_MS = 300;
    const layoutAnimations = new WeakMap();

    function loadFeed() {
        if (feedData) return Promise.resolve(feedData);
        if (feedPromise) return feedPromise;
        feedPromise = fetch(feedURL, { credentials: 'same-origin' })
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                feedData = data && Array.isArray(data.entries) ? data : { entries: [], tags: [] };
                return feedData;
            })
            .catch(() => {
                feedData = { entries: [], tags: [] };
                return feedData;
            });
        return feedPromise;
    }

    function escapeHtml(s) {
        return String(s == null ? '' : s).replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c]));
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

    function entriesForTag(tag) {
        if (!feedData) return [];
        if (!tag) return feedData.entries;
        const lower = String(tag).toLowerCase();
        return feedData.entries.filter(e => (e.tags || []).some(t => String(t).toLowerCase() === lower));
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

    function renderTagChips(tags) {
        if (!tags || !tags.length) return '';
        const chips = tags.map(t => {
            const slug = String(t).toLowerCase().replace(/\s+/g, '-');
            return `<a class="mb-card-tag" href="?cols=${encodeURIComponent(slug)}" data-mb-tag="${escapeHtml(slug)}" data-mb-tag-label="${escapeHtml(t)}">
                <span class="item-dot" data-tag="${escapeHtml(slug)}"></span>${escapeHtml(t)}
            </a>`;
        }).join('');
        return `<div class="mb-card-tags">${chips}</div>`;
    }

    function renderCard(entry) {
        const card = document.createElement('article');
        card.className = 'mb-card';
        card.dataset.mbId = entry.id || entry.slug || '';
        card.innerHTML = `
            <header class="mb-card-header">
                <div class="mb-card-meta">
                    <time class="mb-card-date" datetime="${escapeHtml(entry.date)}">${formatDate(entry.date)}</time>
                    ${renderTagChips(entry.tags)}
                </div>
                <a class="mb-card-permalink" href="${escapeHtml(entry.url)}" aria-label="Open fragment">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>
                </a>
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
        slice.forEach((entry, i) => {
            const card = renderCard(entry);
            card.style.setProperty('--mb-stagger-delay', `${i * STAGGER_MS}ms`);
            card.classList.add('is-entering');
            frag.appendChild(card);
        });
        feedEl.appendChild(frag);
        requestAnimationFrame(() => {
            feedEl.querySelectorAll('.mb-card.is-entering').forEach(c => {
                c.classList.add('is-entered');
                c.classList.remove('is-entering');
            });
        });
        const nextIdx = startIdx + slice.length;
        column.dataset.mbNextIdx = String(nextIdx);
        const done = nextIdx >= entries.length;
        const sentinel = column.querySelector('[data-mb-sentinel]');
        if (sentinel) sentinel.dataset.mbDone = done ? 'true' : 'false';
        return done;
    }

    function hydrateColumn(column, tag) {
        const entries = entriesForTag(tag);
        const countEl = column.querySelector('[data-mb-column-count]');
        if (countEl) countEl.textContent = entries.length;
        const feedEl = column.querySelector('[data-mb-feed]');
        if (feedEl) feedEl.innerHTML = '';
        column.dataset.mbNextIdx = '0';

        if (!entries.length) {
            const empty = document.createElement('div');
            empty.className = 'mb-column-empty';
            empty.textContent = tag ? `Nothing tagged #${tag} yet.` : 'Nothing yet.';
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
        }, { root: getScrollRoot(column), rootMargin: '400px 0px' });
        observer.observe(sentinel);
        observers.set(column, observer);
    }

    function getScrollRoot(column) {
        return column.classList.contains('mb-column-main') ? null : column;
    }

    function updateColumnCompression() {
        if (!deck) return;
        if (window.matchMedia('(max-width: 768px)').matches) {
            deck.classList.remove('is-compressed');
            return;
        }

        deck.classList.remove('is-compressed');
        void deck.offsetWidth;

        const columns = [...deck.querySelectorAll('.mb-column')];
        const gap = parseFloat(getComputedStyle(deck).columnGap || getComputedStyle(deck).gap) || 0;
        const totalColumnWidth = columns.reduce((sum, column) => sum + column.getBoundingClientRect().width, 0)
            + Math.max(0, columns.length - 1) * gap;
        const shouldCompress = columns.length > 1 && totalColumnWidth > deck.clientWidth * COMPRESSION_THRESHOLD;
        deck.classList.toggle('is-compressed', shouldCompress);
    }

    function scheduleColumnCompression() {
        if (compressionFrame) cancelAnimationFrame(compressionFrame);
        compressionFrame = requestAnimationFrame(() => {
            compressionFrame = 0;
            updateColumnCompression();
        });
    }

    function getActiveColumns() {
        return [...deck.querySelectorAll('.mb-column:not(.mb-column-ghost)')];
    }

    function captureColumnRects(columns = getActiveColumns()) {
        const rects = new Map();
        columns.forEach(column => {
            rects.set(column, column.getBoundingClientRect());
        });
        return rects;
    }

    function animateColumnReflow(beforeRects, columns = getActiveColumns()) {
        columns.forEach(column => {
            if (!beforeRects.has(column)) return;
            if (column.classList.contains('is-entering') || column.classList.contains('is-leaving')) return;
            if (typeof column.animate !== 'function') return;

            const before = beforeRects.get(column);
            const after = column.getBoundingClientRect();
            const deltaX = before.left - after.left;
            const deltaY = before.top - after.top;

            if (Math.abs(deltaX) < 0.5 && Math.abs(deltaY) < 0.5) return;

            const existing = layoutAnimations.get(column);
            if (existing) existing.cancel();

            const animation = column.animate(
                [
                    { transform: `translate3d(${deltaX}px, ${deltaY}px, 0)` },
                    { transform: 'translate3d(0, 0, 0)' }
                ],
                {
                    duration: COLUMN_REFLOW_MS,
                    easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
                    fill: 'both'
                }
            );

            layoutAnimations.set(column, animation);
            const clear = () => {
                if (layoutAnimations.get(column) === animation) {
                    layoutAnimations.delete(column);
                }
            };
            animation.addEventListener('finish', clear, { once: true });
            animation.addEventListener('cancel', clear, { once: true });
        });
    }

    function openTagColumn(tagLabel) {
        const slug = String(tagLabel || '').toLowerCase().replace(/\s+/g, '-');
        if (!slug) return;
        const existing = deck.querySelector(`.mb-column[data-mb-tag="${CSS.escape(slug)}"]`);
        if (existing) {
            existing.classList.add('is-pulsing');
            setTimeout(() => existing.classList.remove('is-pulsing'), 600);
            return existing;
        }

        const column = document.createElement('section');
        column.className = 'mb-column mb-column-tag is-entering';
        column.dataset.mbColumnId = `tag-${columnSeq++}`;
        column.dataset.mbTag = slug;
        column.innerHTML = `
            <div class="mb-column-header">
                <span class="mb-column-title">#${escapeHtml(tagLabel)}</span>
                <span class="mb-column-count" data-mb-column-count>0</span>
                <button class="mb-column-close" type="button" data-mb-close aria-label="Close column">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><path d="M17 7L7 17"/><path d="M7 7l10 10"/></svg>
                </button>
            </div>
            <div class="mb-column-feed" data-mb-feed></div>
            <div class="mb-column-sentinel" data-mb-sentinel aria-hidden="true"></div>
        `;
        deck.appendChild(column);
        hydrateColumn(column, slug);
        void column.getBoundingClientRect();
        scheduleColumnCompression();
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                column.classList.remove('is-entering');
                column.classList.add('is-entered');
            });
        });
        column.querySelector('[data-mb-close]').addEventListener('click', () => closeTagColumn(column));
        syncURL();
        return column;
    }

    function closeTagColumn(column) {
        if (!column || column.classList.contains('mb-column-main')) return;
        const beforeRects = captureColumnRects();
        column.classList.add('is-leaving');

        setTimeout(() => {
            column.remove();
            updateColumnCompression();
            animateColumnReflow(beforeRects);
            syncURL();
        }, COLUMN_REFLOW_MS);
    }

    function syncURL() {
        const slugs = getActiveColumns()
            .filter(c => c.classList.contains('mb-column-tag'))
            .map(c => c.dataset.mbTag)
            .filter(Boolean);
        const url = new URL(window.location.href);
        if (slugs.length) {
            url.searchParams.set('cols', slugs.join(','));
        } else {
            url.searchParams.delete('cols');
        }
        
        // Update active state in sidebar
        document.querySelectorAll('.archive-tag-item').forEach(el => {
            if (slugs.includes(el.dataset.tag)) {
                el.classList.add('active');
            } else {
                el.classList.remove('active');
            }
        });

        const next = url.pathname + (url.search ? url.search : '') + url.hash;
        if (next !== window.location.pathname + window.location.search + window.location.hash) {
            history.pushState({ cols: slugs }, '', next);
        }
    }

    function restoreFromURL() {
        const params = new URLSearchParams(window.location.search);
        const cols = (params.get('cols') || '').split(',').map(s => s.trim()).filter(Boolean);
        if (!cols.length) return;
        const tags = feedData.tags || [];
        cols.forEach(slug => {
            const label = tags.find(t => String(t).toLowerCase().replace(/\s+/g, '-') === slug) || slug;
            openTagColumn(label);
        });
    }

    function bindTagBar() {
        if (!tagBar) return;
        tagBar.addEventListener('click', e => {
            const chip = e.target.closest('[data-mb-tag]');
            if (!chip) return;
            e.preventDefault();
            openTagColumn(chip.dataset.mbTagLabel || chip.dataset.mbTag);
        });
    }

    function bindSidebarTags() {
        const sidebar = document.querySelector('.archive-tags-list');
        if (!sidebar) return;
        sidebar.addEventListener('click', e => {
            const tagItem = e.target.closest('.archive-tag-item');
            if (!tagItem) return;
            e.preventDefault();
            const labelEl = tagItem.querySelector('.tag-name');
            const label = labelEl ? labelEl.textContent.trim() : tagItem.dataset.tag;
            openTagColumn(label);
        });
    }

    function bindCardTagClicks() {
        deck.addEventListener('click', e => {
            const tag = e.target.closest('.mb-card-tag');
            if (!tag) return;
            e.preventDefault();
            openTagColumn(tag.dataset.mbTagLabel || tag.dataset.mbTag);
        });
    }

    function bindPopstate() {
        window.addEventListener('popstate', () => {
            deck.querySelectorAll('.mb-column-tag').forEach(c => c.remove());
            scheduleColumnCompression();
            restoreFromURL();
        });
    }

    function bindResize() {
        window.addEventListener('resize', scheduleColumnCompression);
    }

    function init() {
        const mainColumn = deck.querySelector('.mb-column-main');
        loadFeed().then(data => {
            if (totalEl) totalEl.textContent = data.entries.length;
            if (mainColumn) hydrateColumn(mainColumn, '');
            restoreFromURL();
            scheduleColumnCompression();
        });
        bindTagBar();
        bindSidebarTags();
        bindCardTagClicks();
        bindPopstate();
        bindResize();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
