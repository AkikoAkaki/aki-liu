import { escapeHtml } from "./modules/dom-utils.js";
import { matches, QUERIES } from "./modules/media.js";
import { loadKatex, renderMath } from "./modules/katex.js";

const root = document.querySelector('.microblog-page');
if (root) initMicroblog(root);

function initMicroblog(root) {
    const deck = root.querySelector('.microblog-deck');
    const PAGE_SIZE = 30;
    const columns = new Map();
    const images = new WeakSet();
    const mathCards = new WeakSet();
    let sequence = 0;
    let feed;
    const chunks = new Map();

    const observer = new IntersectionObserver(entries => {
        for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            const state = columns.get(entry.target.closest('.mb-column').dataset.mbColumnId);
            if (state?.wanted && state.phase === 'ready') loadMore(state);
        }
    }, { rootMargin: '400px 0px' });

    function enhanceCards(element) {
        for (const image of element.querySelectorAll('img[data-mb-image]')) {
            if (images.has(image)) continue;
            images.add(image);
            const show = () => image.classList.remove('is-loading');
            const ready = () => image.decode().catch(() => {}).then(show);
            if (image.complete) {
                if (image.naturalWidth) ready();
                continue;
            }
            image.classList.add('is-loading');
            image.addEventListener('load', ready, { once: true });
            image.addEventListener('error', show, { once: true });
        }
        const pending = [...element.querySelectorAll('[data-mb-math]')].filter(card => !mathCards.has(card));
        if (pending.length) {
            pending.forEach(card => mathCards.add(card));
            loadKatex(root.dataset.katexBase).then(() => {
                pending.filter(card => card.isConnected).forEach(renderMath);
            }).catch(() => pending.forEach(card => mathCards.delete(card)));
        }
    }

    function readChunk(entries) {
        if (!Array.isArray(entries)) throw new Error('Invalid microblog entries');
        const seen = new Set();
        for (const entry of entries) {
            if (!entry || typeof entry.id !== 'string' || typeof entry.html !== 'string'
                || typeof entry.year !== 'string' || !Array.isArray(entry.tags)
                || !entry.tags.every(tag => typeof tag === 'string') || seen.has(entry.id)) {
                throw new Error('Invalid microblog entry');
            }
            seen.add(entry.id);
        }
        return entries;
    }

    function loadChunk(url) {
        if (!chunks.has(url)) {
            const request = fetch(url, { credentials: 'same-origin' }).then(response => {
                if (!response.ok) throw new Error(`Microblog page request failed: ${response.status}`);
                return response.json();
            }).then(readChunk).catch(error => { chunks.delete(url); throw error; });
            chunks.set(url, request);
        }
        return chunks.get(url);
    }

    function loadFeed() {
        return feed ??= JSON.parse(root.querySelector('[data-mb-feed-index]').textContent);
    }

    function updateControls(state, message = '') {
        const element = state.element;
        const loading = state.phase === 'loading';
        element.setAttribute('aria-busy', String(loading));
        const button = element.querySelector('[data-mb-more]');
        button.hidden = state.done;
        button.disabled = loading;
        button.textContent = state.phase === 'error' ? 'Retry' : loading ? 'Loading…' : 'Load more';
        element.querySelector('[data-mb-status]').textContent = message;
    }

    async function loadMore(state) {
        if (!state.wanted || state.done || state.phase === 'loading') return;
        state.phase = 'loading';
        updateControls(state, state.next ? '' : 'Loading entries…');
        try {
            const data = loadFeed();
            if (columns.get(state.id) !== state) return;
            const column = data.columns[state.type === 'all' ? '__all__' : state.id];
            if (!column) throw new Error('Unknown microblog column');
            const url = column.pages[Math.floor(state.next / PAGE_SIZE)];
            const entries = url ? await loadChunk(url) : [];
            if (columns.get(state.id) !== state) return;
            const fragment = document.createDocumentFragment();
            for (const entry of entries) {
                const template = document.createElement('template');
                template.innerHTML = entry.html;
                fragment.appendChild(template.content);
            }
            enhanceCards(fragment);
            state.element.querySelector('[data-mb-feed]').appendChild(fragment);
            state.next += entries.length;
            state.done = state.next >= column.count;
            state.phase = 'ready';
            state.element.querySelector('[data-mb-column-count]').textContent = column.count;
            state.element.querySelector('[data-mb-column-unit]').textContent = column.count === 1 ? 'Entry' : 'Entries';
            updateControls(state, column.count ? '' : 'Nothing here yet.');
            if (state.done) observer.unobserve(state.sentinel);
            else if (state.wanted) observer.observe(state.sentinel);
        } catch (_) {
            if (columns.get(state.id) !== state) return;
            state.phase = 'error';
            updateControls(state, 'Unable to load more entries. Your current entries are still available.');
        }
    }

    function animate(state, frames, finish = () => {}) {
        state.animation?.cancel();
        state.animation = null;
        if (matches(QUERIES.reducedMotion)) {
            finish();
            return;
        }
        const animation = state.element.animate(frames, {
            duration: 300,
            easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
            fill: 'both'
        });
        state.animation = animation;
        animation.finished.then(() => {
            if (state.animation !== animation) return;
            state.animation = null;
            animation.cancel();
            finish();
        }, () => {});
    }

    function syncURL(push = true) {
        const wanted = [...columns.values()].filter(state => state.type !== 'all' && state.wanted);
        const url = new URL(location.href);
        for (const [parameter, type] of [['cols', 'tag'], ['years', 'year']]) {
            const keys = wanted.filter(state => state.type === type).map(state => state.key);
            if (keys.length) url.searchParams.set(parameter, keys.join(','));
            else url.searchParams.delete(parameter);
        }
        if (wanted.some(state => state.type === 'tag') && wanted.some(state => state.type === 'year')) {
            url.searchParams.set('order', wanted.map(state => state.id).join(','));
        } else url.searchParams.delete('order');
        const next = url.pathname + url.search + url.hash;
        if (next !== location.pathname + location.search + location.hash) {
            history[push ? 'pushState' : 'replaceState'](null, '', next);
        }
        syncSidebar();
    }

    function syncSidebar() {
        for (const item of document.querySelectorAll('.archive-tag-item, .archive-year-item')) {
            const state = columns.get(item.dataset.year ? `year:${item.dataset.year}` : `tag:${item.dataset.tag}`);
            const active = !!state?.wanted;
            item.classList.toggle('active', active);
            item.setAttribute('aria-expanded', String(active));
            if (state) item.setAttribute('aria-controls', state.element.id);
            else item.removeAttribute('aria-controls');
        }
    }

    function destroy(state) {
        state.animation?.cancel();
        observer.unobserve(state.sentinel);
        columns.delete(state.id);
        state.element.remove();
    }

    function closeColumn(state, push = true) {
        if (!state.wanted || state.type === 'all') return;
        const style = getComputedStyle(state.element);
        const from = { opacity: style.opacity, transform: style.transform };
        state.wanted = false;
        if (state.element.contains(document.activeElement)) {
            const selector = state.type === 'year' ? `.archive-year-item[data-year="${CSS.escape(state.key)}"]`
                : `.archive-tag-item[data-tag="${CSS.escape(state.key)}"]`;
            [...document.querySelectorAll(selector)].find(item => item.getClientRects().length)?.focus({ preventScroll: true });
        }
        state.element.inert = true;
        state.element.setAttribute('aria-hidden', 'true');
        state.element.classList.add('is-leaving');
        observer.unobserve(state.sentinel);
        if (push) syncURL();
        animate(state, [from, { opacity: 0, transform: 'translate3d(24px, 0, 0)' }], () => {
            if (!state.wanted) destroy(state);
        });
    }

    function labelFor(type, key) {
        if (type === 'year') return key;
        const item = document.querySelector(`.archive-tag-item[data-tag="${CSS.escape(key)}"] .tag-name`);
        return item?.textContent.trim() || feed?.tags[key] || key;
    }

    function openColumn(type, key, push = true) {
        const id = `${type}:${key}`;
        let state = columns.get(id);
        if (state) {
            if (!state.wanted) {
                const style = getComputedStyle(state.element);
                const from = { opacity: style.opacity, transform: style.transform };
                state.wanted = true;
                state.element.inert = false;
                state.element.removeAttribute('aria-hidden');
                state.element.classList.remove('is-leaving');
                animate(state, [from, { opacity: 1, transform: 'none' }]);
                if (!state.done) observer.observe(state.sentinel);
                if (push) syncURL();
            }
            return state;
        }
        const label = labelFor(type, key);
        const element = document.createElement('section');
        element.className = `mb-column mb-column-${type}`;
        element.dataset.mbColumnId = id;
        element.id = `microblog-column-${++sequence}`;
        element.setAttribute('aria-label', label);
        element.innerHTML = `
            <div class="mb-column-content">
                <div class="mb-column-header">
                    <h2 class="mb-column-title">${escapeHtml(label)}</h2>
                    <span class="mb-column-meta"><span data-mb-column-count>…</span> <span data-mb-column-unit>Entries</span></span>
                    <button class="mb-column-close" type="button" data-mb-close aria-label="Close ${escapeHtml(label)} column">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" width="14" height="14" aria-hidden="true"><path d="M17 7L7 17M7 7l10 10"/></svg>
                    </button>
                </div>
                <div class="mb-column-feed" data-mb-feed></div>
                <div class="mb-column-sentinel" data-mb-sentinel aria-hidden="true"></div>
                <div class="mb-column-controls">
                    <button class="mb-feed-more" type="button" data-mb-more>Load more</button>
                    <p class="mb-column-status" data-mb-status role="status" aria-live="polite"></p>
                </div>
            </div>`;
        state = { id, type, key, element, wanted: true, phase: 'ready', next: 0, done: false,
            sentinel: element.querySelector('[data-mb-sentinel]'), animation: null };
        columns.set(id, state);
        deck.appendChild(element);
        loadMore(state);
        animate(state, [{ opacity: 0, transform: 'translate3d(24px, 0, 0)' }, { opacity: 1, transform: 'none' }]);
        if (push) syncURL();
        return state;
    }

    function restoreURL() {
        const parameters = new URLSearchParams(location.search);
        const wanted = new Map();
        for (const [parameter, type, selector, attribute] of [
            ['cols', 'tag', '.archive-tag-item', 'tag'], ['years', 'year', '.archive-year-item', 'year']
        ]) {
            const known = new Set([...document.querySelectorAll(selector)].map(item => item.dataset[attribute]));
            for (const key of (parameters.get(parameter) || '').split(',')) {
                if (known.has(key)) wanted.set(`${type}:${key}`, { type, key });
            }
        }
        const ordered = new Map();
        for (const id of (parameters.get('order') || '').split(',')) {
            if (wanted.has(id)) ordered.set(id, wanted.get(id));
        }
        for (const [id, spec] of wanted) ordered.set(id, spec);
        for (const state of [...columns.values()]) {
            if (state.type !== 'all' && (!ordered.has(state.id) || !state.wanted)) destroy(state);
        }
        for (const { type, key } of ordered.values()) openColumn(type, key, false);
        const main = columns.get('__all__');
        const sorted = new Map([['__all__', main]]);
        for (const id of ordered.keys()) sorted.set(id, columns.get(id));
        columns.clear();
        for (const [id, state] of sorted) {
            columns.set(id, state);
            if (deck.children[columns.size - 1] !== state.element) deck.appendChild(state.element);
        }
        syncURL(false);
    }

    const mainElement = deck.querySelector('.mb-column-main');
    const mainState = { id: '__all__', type: 'all', key: '', element: mainElement, wanted: true,
        phase: 'ready', next: mainElement.querySelectorAll('.mb-card').length,
        done: false, animation: null, sentinel: mainElement.querySelector('[data-mb-sentinel]') };
    mainElement.id = 'microblog-column-all';
    mainState.done = mainState.next >= Number(mainElement.querySelector('[data-mb-column-count]').textContent);
    columns.set(mainState.id, mainState);
    updateControls(mainState);
    enhanceCards(mainElement);
    if (!mainState.done) observer.observe(mainState.sentinel);

    document.addEventListener('click', event => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        const button = event.target.closest('[data-mb-close], [data-mb-more]');
        if (button && deck.contains(button)) {
            const state = columns.get(button.closest('.mb-column').dataset.mbColumnId);
            if (button.hasAttribute('data-mb-close')) closeColumn(state);
            else loadMore(state);
            return;
        }
        const item = event.target.closest('.archive-tag-item, .archive-year-item, .mb-card-tag-dot');
        if (!item) return;
        event.preventDefault();
        const type = item.dataset.year ? 'year' : 'tag';
        const key = item.dataset.year || item.dataset.tag || item.dataset.mbTag;
        const state = columns.get(`${type}:${key}`);
        if (state?.wanted && !item.classList.contains('mb-card-tag-dot')) closeColumn(state);
        else openColumn(type, key);
    });
    window.addEventListener('popstate', restoreURL);
    restoreURL();
}
