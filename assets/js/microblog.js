(function () {
    const root = document.querySelector('.microblog-page');
    if (!root) return;

    const feedURL = root.dataset.feedUrl || '/microblog/feed.json';
    const deck = root.querySelector('.microblog-deck');
    const tagBar = root.querySelector('[data-mb-tag-bar]');
    const totalEl = root.querySelector('[data-mb-total]');
    const PAGE_SIZE = 30;
    const STAGGER_MS = 40;

    let feedData = null;
    let feedPromise = null;
    let columnSeq = 1;

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
        const chips = tags.map(t => `<a class="mb-card-tag" href="?cols=${encodeURIComponent(String(t).toLowerCase().replace(/\s+/g, '-'))}" data-mb-tag="${escapeHtml(String(t).toLowerCase().replace(/\s+/g, '-'))}" data-mb-tag-label="${escapeHtml(t)}">#${escapeHtml(t)}</a>`).join('');
        return `<div class="mb-card-tags">${chips}</div>`;
    }

    function renderCard(entry) {
        const card = document.createElement('article');
        card.className = 'mb-card';
        card.dataset.mbId = entry.id || entry.slug || '';
        card.innerHTML = `
            <header class="mb-card-header">
                <time class="mb-card-date" datetime="${escapeHtml(entry.date)}">${formatDate(entry.date)}</time>
            </header>
            <div class="mb-card-body">${entry.html || ''}</div>
            ${buildImageGrid(entry.images)}
            ${renderTagChips(entry.tags)}
            <footer class="mb-card-footer">
                <a class="mb-card-permalink" href="${escapeHtml(entry.url)}" aria-label="Open fragment">
                    <span>open</span>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><path d="M5 12h14"/><polyline points="12 5 19 12 12 19"/></svg>
                </a>
            </footer>
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

    function openTagColumn(tagLabel) {
        const slug = String(tagLabel || '').toLowerCase().replace(/\s+/g, '-');
        if (!slug) return;
        const existing = deck.querySelector(`.mb-column[data-mb-tag="${CSS.escape(slug)}"]`);
        if (existing) {
            existing.scrollIntoView({ behavior: 'smooth', inline: 'end', block: 'nearest' });
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
        requestAnimationFrame(() => {
            column.classList.remove('is-entering');
            column.classList.add('is-entered');
            column.scrollIntoView({ behavior: 'smooth', inline: 'end', block: 'nearest' });
        });
        hydrateColumn(column, slug);
        column.querySelector('[data-mb-close]').addEventListener('click', () => closeTagColumn(column));
        syncURL();
        return column;
    }

    function closeTagColumn(column) {
        if (!column || column.classList.contains('mb-column-main')) return;
        column.classList.add('is-leaving');
        setTimeout(() => {
            column.remove();
            syncURL();
        }, 280);
    }

    function syncURL() {
        const slugs = [...deck.querySelectorAll('.mb-column-tag')].map(c => c.dataset.mbTag).filter(Boolean);
        const url = new URL(window.location.href);
        if (slugs.length) {
            url.searchParams.set('cols', slugs.join(','));
        } else {
            url.searchParams.delete('cols');
        }
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
            restoreFromURL();
        });
    }

    function init() {
        const mainColumn = deck.querySelector('.mb-column-main');
        loadFeed().then(data => {
            if (totalEl) totalEl.textContent = data.entries.length;
            if (mainColumn) hydrateColumn(mainColumn, '');
            restoreFromURL();
        });
        bindTagBar();
        bindCardTagClicks();
        bindPopstate();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
