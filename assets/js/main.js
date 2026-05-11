(function () {
    // --- Theme persistence (run before paint where possible) ---
    try {
        const stored = localStorage.getItem('theme');
        if (stored === 'dark' || stored === 'light') {
            document.documentElement.setAttribute('data-theme', stored);
        }
    } catch (_) { /* localStorage unavailable */ }

    const FONT_SERIF = '"Newsreader", "Playfair Display", serif';
    const FONT_SANS  = '"Switzer", "Inter", sans-serif';
    const FONT_MONO  = '"JetBrains Mono", "Geist Mono", monospace';
    const STAGGER = 35;

    const FONT_MAP = {
        sans:  { family: FONT_SERIF, style: 'italic' },
        mono:  { family: FONT_SANS,  style: 'normal' },
        serif: { family: FONT_MONO,  style: 'normal' },
    };

    function detectType(fontFamily) {
        if (/JetBrains|Mono|Space Mono|Consolas/i.test(fontFamily)) return 'mono';
        if (/Newsreader|Playfair|Garamond/i.test(fontFamily)) return 'serif';
        return 'sans';
    }

    function wrapChars(link) {
        if (link.dataset.charsWrapped) return;
        const walker = document.createTreeWalker(link, NodeFilter.SHOW_TEXT);
        const textNodes = [];
        let node;
        while ((node = walker.nextNode())) textNodes.push(node);

        textNodes.forEach(textNode => {
            const frag = document.createDocumentFragment();
            [...textNode.textContent].forEach(char => {
                if (char === ' ' || char === '\u00a0') {
                    frag.appendChild(document.createTextNode(char));
                } else {
                    const span = document.createElement('span');
                    span.className = 'link-char';
                    span.textContent = char;
                    frag.appendChild(span);
                }
            });
            textNode.parentNode.replaceChild(frag, textNode);
        });

        link.dataset.charsWrapped = 'true';
    }

    function staggerFontChange(chars, applyChange) {
        return chars.map((char, i) => setTimeout(() => {
            applyChange(char);
        }, i * STAGGER));
    }

    document.addEventListener('DOMContentLoaded', () => {
        // --- Link text animation ---
        const links = document.querySelectorAll(
            '.bio-text a, .now-section a, .connect-section a:not(.connect-pill), .data-link, .archive-tag-item, .archive-year-item'
        );

        links.forEach(link => {
            let origFamily, origStyle, target;
            let debounceTimer = null;
            let timers = [];
            let isInitialized = false;

            function init() {
                if (isInitialized) return;
                const computed = getComputedStyle(link);
                origFamily = computed.fontFamily;
                origStyle  = computed.fontStyle;
                target = FONT_MAP[detectType(origFamily)];

                if (link.classList.contains('hover-mono') || link.closest('.archive-filters-container')) {
                    target = { family: FONT_MONO, style: 'normal' };
                }
                if (link.classList.contains('data-link') || link.closest('.bio-text')) {
                    target = { family: FONT_MONO, style: 'normal' };
                }
                wrapChars(link);
                isInitialized = true;
            }

            function orderedCharsForEnter() {
                const chars = [...link.querySelectorAll('.link-char')];
                if (link.classList.contains('archive-year-item')) {
                    chars.reverse();
                }
                return chars;
            }

            function orderedCharsForLeave() {
                const chars = [...link.querySelectorAll('.link-char')].reverse();
                if (link.classList.contains('archive-year-item')) {
                    chars.reverse();
                }
                return chars;
            }

            function triggerWipe() {
                link.classList.remove('link-wiping');
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        link.classList.add('link-wiping');
                    });
                });
            }

            function cancel() {
                timers.forEach(clearTimeout);
                timers = [];
            }

            function handleEnter() {
                init();
                cancel();
                const chars = orderedCharsForEnter();
                timers = staggerFontChange(chars, char => {
                    char.style.fontFamily = target.family;
                    char.style.fontStyle  = target.style;
                });
                if (link.classList.contains('data-link') || link.closest('.bio-text')) {
                    link.style.color = 'var(--color-secondary)';
                } else {
                    triggerWipe();
                }
            }

            function handleLeave() {
                if (!isInitialized) return;
                cancel();
                const chars = orderedCharsForLeave();
                timers = staggerFontChange(chars, char => {
                    char.style.fontFamily = origFamily;
                    char.style.fontStyle  = origStyle;
                });
                if (link.classList.contains('data-link') || link.closest('.bio-text')) {
                    link.style.color = '';
                } else {
                    triggerWipe();
                }
            }

            link.addEventListener('mouseenter', () => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(handleEnter, 20);
            });

            link.addEventListener('mouseleave', () => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(handleLeave, 20);
            });
        });

        // --- Expanding Menu ---
        initExpandingMenu();


        // --- Search placeholder animation ---
        const searchBar = document.querySelector('.archive-search');
        if (searchBar) {
            const input = searchBar.querySelector('.search-input');
            const fakePlaceholder = searchBar.querySelector('.search-fake-placeholder');
            if (fakePlaceholder && input) {
                let searchTimers = [];
                let searchDebounce = null;
                let isHidden = false;
                let isPlaceholderWrapped = false;

                function initPlaceholder() {
                    if (isPlaceholderWrapped) return;
                    const text = fakePlaceholder.textContent;
                    fakePlaceholder.innerHTML = '';
                    [...text].forEach(char => {
                        if (char === ' ') {
                            fakePlaceholder.appendChild(document.createTextNode(char));
                        } else {
                            const span = document.createElement('span');
                            span.className = 'link-char';
                            span.textContent = char;
                            fakePlaceholder.appendChild(span);
                        }
                    });
                    isPlaceholderWrapped = true;
                }

                function getChars() { return [...fakePlaceholder.querySelectorAll('.link-char')]; }

                function cancelSearch() {
                    searchTimers.forEach(clearTimeout);
                    searchTimers = [];
                }

                function animateToMono() {
                    initPlaceholder();
                    cancelSearch();
                    const chars = getChars();
                    searchTimers = staggerFontChange(chars, char => {
                        char.style.fontFamily = FONT_MONO;
                    });
                }

                function animateToSans() {
                    if (!isPlaceholderWrapped) return;
                    cancelSearch();
                    const chars = getChars().reverse();
                    searchTimers = staggerFontChange(chars, char => {
                        char.style.fontFamily = '';
                    });
                }

                searchBar.addEventListener('mouseenter', () => {
                    clearTimeout(searchDebounce);
                    searchDebounce = setTimeout(() => { if (!isHidden) animateToMono(); }, 20);
                });

                searchBar.addEventListener('mouseleave', () => {
                    clearTimeout(searchDebounce);
                    searchDebounce = setTimeout(() => { if (!isHidden) animateToSans(); }, 20);
                });

                searchBar.addEventListener('click', () => input.focus());

                input.addEventListener('focus', () => {
                    if (!isHidden) {
                        isHidden = true;
                        cancelSearch();
                        fakePlaceholder.classList.add('is-hiding');
                    }
                });

                fakePlaceholder.addEventListener('animationend', () => {
                    if (isHidden) fakePlaceholder.style.opacity = '0';
                });

                input.addEventListener('blur', () => {
                    if (input.value === '') {
                        isHidden = false;
                        fakePlaceholder.classList.remove('is-hiding');
                        fakePlaceholder.style.opacity = '';
                        if (isPlaceholderWrapped) {
                            getChars().forEach(char => { char.style.fontFamily = ''; });
                        }
                    }
                });
            }
        }

        // --- Archive desktop bottom stats ---
        const archiveStats = document.querySelector('.archive-sidebar-bottom');
        const archiveBottomHost = document.querySelector('.kind-section .site-sidebar-bottom');
        const archiveCopyright = document.querySelector('.archive-copyright');
        if (archiveStats && archiveBottomHost && archiveCopyright) {
            const desktopQuery = window.matchMedia('(min-width: 481px)');
            let statsRaf = 0;

            function clearArchiveStatsPosition() {
                archiveStats.classList.remove('is-fixed', 'is-bottomed');
                archiveStats.style.left = '';
                archiveStats.style.top = '';
                archiveStats.style.width = '';
                archiveCopyright.style.left = '';
                archiveCopyright.style.top = '';
                archiveCopyright.style.width = '';
            }

            function positionArchiveStats() {
                statsRaf = 0;

                if (!desktopQuery.matches) {
                    clearArchiveStatsPosition();
                    return;
                }

                archiveStats.classList.add('is-fixed');
                archiveStats.classList.remove('is-bottomed');
                archiveStats.style.top = '';

                const hostRect = archiveBottomHost.getBoundingClientRect();
                const hostTop = window.scrollY + hostRect.top;
                const bottomOffset = parseFloat(getComputedStyle(archiveStats).bottom) || 0;
                const maxScrollY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
                const finalStatsBottom = maxScrollY + window.innerHeight - bottomOffset;
                const copyrightTop = finalStatsBottom - hostTop;

                archiveCopyright.style.left = '0px';
                archiveCopyright.style.top = `${copyrightTop}px`;
                archiveCopyright.style.width = `${hostRect.width}px`;

                archiveStats.style.left = `${hostRect.left}px`;
                archiveStats.style.top = '';

                archiveStats.style.width = `${hostRect.width}px`;
            }

            function scheduleArchiveStatsPosition() {
                if (statsRaf) return;
                statsRaf = requestAnimationFrame(positionArchiveStats);
            }

            scheduleArchiveStatsPosition();
            window.addEventListener('scroll', scheduleArchiveStatsPosition, { passive: true });
            window.addEventListener('resize', scheduleArchiveStatsPosition);
            if (desktopQuery.addEventListener) {
                desktopQuery.addEventListener('change', scheduleArchiveStatsPosition);
            } else {
                desktopQuery.addListener(scheduleArchiveStatsPosition);
            }
        }

        // --- Archive hover preview ---
        const archiveItems = document.querySelectorAll('.archive-item');
        if (archiveItems.length > 0) {
            const previewContainer = document.getElementById('archive-preview-container');
            if (!previewContainer) return;

            previewContainer.innerHTML = '';

            let currentHoverNode = null;
            let leaveTimeout = null;
            let renderToken = 0;

            function injectContent(item) {
                const previewData = item.querySelector('.item-preview-data');
                if (!previewData) return false;
                previewContainer.innerHTML = previewData.innerHTML;
                previewContainer.dataset.href = previewData.dataset.href || '';
                previewContainer.querySelectorAll('figure.local-video, video, audio, iframe').forEach(el => el.remove());
                return true;
            }

            function computeBottomLimit() {
                const rightCols = previewContainer.closest('.archive-right-cols');
                const viewportBottom = window.innerHeight;
                if (!rightCols) return viewportBottom - 8;
                const rect = rightCols.getBoundingClientRect();
                const styles = getComputedStyle(rightCols);
                const paddingBottom = parseFloat(styles.paddingBottom) || 0;
                const colsBottom = rect.bottom - paddingBottom;
                return Math.min(colsBottom, viewportBottom) - 8;
            }

            async function fitPreview(token) {
                const summary = previewContainer.querySelector('.preview-summary');
                if (!summary) return;
                const href = previewContainer.dataset.href || '#';

                if (document.fonts && document.fonts.ready) {
                    try { await document.fonts.ready; } catch (e) {}
                }
                if (token !== renderToken) return;

                const imgs = Array.from(summary.querySelectorAll('img'));
                await Promise.all(imgs.map(img => {
                    if (img.complete) return Promise.resolve();
                    return new Promise(resolve => {
                        img.addEventListener('load', resolve, { once: true });
                        img.addEventListener('error', resolve, { once: true });
                    });
                }));
                if (token !== renderToken) return;

                const liveSummary = previewContainer.querySelector('.preview-summary');
                if (!liveSummary || liveSummary !== summary) return;

                const bottomLimit = computeBottomLimit();
                const children = Array.from(summary.children);
                let firstOverflowIndex = -1;
                for (let i = 0; i < children.length; i++) {
                    if (children[i].getBoundingClientRect().bottom > bottomLimit) {
                        firstOverflowIndex = i;
                        break;
                    }
                }

                if (firstOverflowIndex === -1) return;

                for (let i = children.length - 1; i >= firstOverflowIndex; i--) {
                    children[i].remove();
                }

                const marker = document.createElement('a');
                marker.className = 'preview-continuation';
                marker.href = href;
                marker.textContent = '(to be continued)';
                summary.appendChild(marker);

                while (summary.children.length > 1 && marker.getBoundingClientRect().bottom > bottomLimit) {
                    const prev = marker.previousElementSibling;
                    if (!prev) break;
                    prev.remove();
                }
            }

            async function renderForItem(item) {
                const token = ++renderToken;
                if (!injectContent(item)) return;
                await fitPreview(token);
                if (token === renderToken) {
                    previewContainer.style.opacity = '1';
                }
            }

            let resizeRaf = 0;
            const resizeObserver = new ResizeObserver(() => {
                if (!currentHoverNode) return;
                if (resizeRaf) cancelAnimationFrame(resizeRaf);
                resizeRaf = requestAnimationFrame(() => {
                    if (currentHoverNode) renderForItem(currentHoverNode);
                });
            });
            const rightCols = document.querySelector('.archive-right-cols');
            if (rightCols) resizeObserver.observe(rightCols);
            window.addEventListener('resize', () => {
                if (currentHoverNode) renderForItem(currentHoverNode);
            });

            let scrollRaf = 0;
            window.addEventListener('scroll', () => {
                if (!currentHoverNode) return;
                if (scrollRaf) cancelAnimationFrame(scrollRaf);
                scrollRaf = requestAnimationFrame(() => {
                    if (currentHoverNode) renderForItem(currentHoverNode);
                });
            }, { passive: true });

            archiveItems.forEach(item => {
                item.addEventListener('mouseenter', () => {
                    if (leaveTimeout) clearTimeout(leaveTimeout);

                    if (currentHoverNode === item) {
                        previewContainer.style.opacity = '1';
                        return;
                    }

                    currentHoverNode = item;
                    previewContainer.style.opacity = '0';
                    setTimeout(() => {
                        if (currentHoverNode === item) renderForItem(item);
                    }, 100);
                });

                item.addEventListener('mouseleave', () => {
                    if (currentHoverNode === item) {
                        leaveTimeout = setTimeout(() => {
                            previewContainer.style.opacity = '0';
                            currentHoverNode = null;
                            renderToken++;
                            setTimeout(() => {
                                if (!currentHoverNode) {
                                    previewContainer.innerHTML = '';
                                    delete previewContainer.dataset.href;
                                }
                            }, 200);
                        }, 150);
                    }
                });
            });
        }

        // --- Expandable card toggle ---
        const cardHeaders = document.querySelectorAll('.now-card-header');
        cardHeaders.forEach(button => {
            button.addEventListener('click', () => {
                const card = button.parentElement;
                card.classList.toggle('is-expanded');
                card.classList.toggle('is-collapsed');
            });
        });

        // --- Floating Link Preview ---
        const previewLinks = document.querySelectorAll('.work-item[data-preview]');
        if (previewLinks.length > 0) {
            let tooltip = document.createElement('div');
            tooltip.className = 'link-preview-tooltip';
            
            let img = document.createElement('img');
            img.className = 'link-preview-img';
            tooltip.appendChild(img);
            document.body.appendChild(tooltip);

            let hoverTimeout;
            let isHovering = false;
            let currentX = 0, currentY = 0;
            let rafId = null;

            function updatePosition() {
                if (isHovering) {
                    tooltip.style.left = currentX + 'px';
                    tooltip.style.top = currentY + 'px';
                    rafId = requestAnimationFrame(updatePosition);
                }
            }

            previewLinks.forEach(link => {
                link.addEventListener('mouseenter', (e) => {
                    clearTimeout(hoverTimeout);
                    isHovering = true;
                    
                    let previewUrl = link.getAttribute('data-preview');
                    if (previewUrl && !img.src.endsWith(previewUrl)) {
                        img.src = previewUrl;
                    }
                    
                    currentX = e.clientX;
                    currentY = e.clientY;
                    
                    tooltip.classList.add('is-visible');
                    if (!rafId) updatePosition();
                });

                link.addEventListener('mousemove', (e) => {
                    currentX = e.clientX;
                    currentY = e.clientY;
                });

                link.addEventListener('mouseleave', () => {
                    isHovering = false;
                    cancelAnimationFrame(rafId);
                    rafId = null;
                    hoverTimeout = setTimeout(() => {
                        tooltip.classList.remove('is-visible');
                    }, 50);
                });
            });
        }

        // --- Search + Command Palette ---
        initSearchPalette();

        // --- Footer Reveal ---
        initFooterReveal();
    });

    function initExpandingMenu() {
        const menuBar     = document.getElementById('menu-bar');
        const menuTrigger = document.getElementById('menu-trigger');
        const menuPanel   = document.getElementById('menu-panel');
        if (!menuBar || !menuTrigger) return;

        let lastScrollY = window.scrollY || 0;
        let scrollRafId = 0;
        const hideThreshold = 24;

        function getCollapsedHeight() {
            const computed = window.getComputedStyle(menuBar);
            return parseFloat(computed.height) || 68;
        }

        function syncOpenHeight() {
            if (!menuPanel) return;

            const collapsedHeight = getCollapsedHeight();
            const panelHeight = menuPanel.scrollHeight;
            const nextHeight = Math.max(collapsedHeight, panelHeight);
            menuBar.style.setProperty('--menu-open-height', `${nextHeight}px`);
        }

        function open() {
            syncOpenHeight();
            menuBar.classList.add('is-open');
            menuBar.classList.remove('is-scrolled-away');
            menuTrigger.setAttribute('aria-expanded', 'true');
            if (menuPanel) menuPanel.setAttribute('aria-hidden', 'false');
        }

        function close() {
            menuBar.style.setProperty('--menu-open-height', `${menuBar.getBoundingClientRect().height}px`);
            requestAnimationFrame(() => {
                menuBar.classList.remove('is-open');
            });
            menuTrigger.setAttribute('aria-expanded', 'false');
            if (menuPanel) menuPanel.setAttribute('aria-hidden', 'true');
        }

        function updateScrollState() {
            scrollRafId = 0;

            if (menuBar.classList.contains('is-open')) {
                lastScrollY = window.scrollY || 0;
                menuBar.classList.remove('is-scrolled-away');
                return;
            }

            const currentScrollY = window.scrollY || 0;
            const delta = currentScrollY - lastScrollY;

            if (currentScrollY <= hideThreshold) {
                menuBar.classList.remove('is-scrolled-away');
            } else if (delta > 1) {
                menuBar.classList.add('is-scrolled-away');
            } else if (delta < -1) {
                menuBar.classList.remove('is-scrolled-away');
            }

            lastScrollY = currentScrollY;
        }

        menuTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            menuBar.classList.contains('is-open') ? close() : open();
        });

        // Close on click outside
        document.addEventListener('click', (e) => {
            if (menuBar.classList.contains('is-open') && !menuBar.contains(e.target)) {
                close();
            }
        });

        // Close on Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') close();
        });

        window.addEventListener('scroll', () => {
            if (scrollRafId) return;
            scrollRafId = requestAnimationFrame(updateScrollState);
        }, { passive: true });

        window.addEventListener('resize', () => {
            if (menuBar.classList.contains('is-open')) {
                syncOpenHeight();
            }
        });

        updateScrollState();
    }


    function initSearchPalette() {
        const root = document.getElementById('search-root');
        const triggers = document.querySelectorAll('[data-search-trigger]');
        if (!root) return;

        const lang = (document.documentElement.lang || 'zh').toLowerCase().startsWith('en') ? 'en' : 'zh';
        const indexUrl = lang === 'en' ? '/en/search-index.json' : '/search-index.json';
        const isMac = /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent || '');

        let panel = null;
        let inputEl = null;
        let listEl = null;
        let previewEl = null;
        let modeHintEl = null;
        let indexCache = null;
        let indexPromise = null;
        let isOpen = false;
        let selectedIdx = 0;
        let currentItems = [];
        let currentTokens = [];
        let lastQuery = '';

        // ---------- Index loading ----------
        function loadIndex() {
            if (indexCache) return Promise.resolve(indexCache);
            if (indexPromise) return indexPromise;
            indexPromise = fetch(indexUrl, { credentials: 'same-origin' })
                .then(r => r.ok ? r.json() : [])
                .then(records => {
                    indexCache = records.map(r => ({
                        ...r,
                        _titleLower: (r.title || '').toLowerCase(),
                        _bodyLower:  (r.body  || '').toLowerCase(),
                        _summaryLower: (r.summary || '').toLowerCase(),
                        _tagsLower:  (r.tags  || []).map(t => String(t).toLowerCase()),
                    }));
                    return indexCache;
                })
                .catch(() => { indexCache = []; return indexCache; });
            return indexPromise;
        }

        // ---------- Tokenization ----------
        function isCJK(s) { return /[㐀-鿿豈-﫿]/.test(s); }

        function tokenize(query) {
            const q = (query || '').toLowerCase().trim();
            if (!q) return [];
            const tokens = [];
            const parts = q.split(/[\s　]+/).filter(Boolean);
            for (const part of parts) {
                if (isCJK(part)) {
                    if (part.length === 1) tokens.push(part);
                    else for (let i = 0; i < part.length - 1; i++) tokens.push(part.substring(i, i + 2));
                } else if (part.length >= 2) {
                    tokens.push(part);
                } else if (part.length === 1) {
                    tokens.push(part);
                }
            }
            return [...new Set(tokens)];
        }

        function countHits(haystack, needle) {
            if (!haystack || !needle) return 0;
            let count = 0, idx = 0;
            while ((idx = haystack.indexOf(needle, idx)) !== -1) {
                count++; idx += needle.length;
            }
            return count;
        }

        function scoreRecord(rec, tokens) {
            let total = 0;
            for (const t of tokens) {
                const titleHits = countHits(rec._titleLower, t);
                const tagHits = rec._tagsLower.reduce((a, tag) => a + (tag.includes(t) ? 1 : 0), 0);
                const summaryHits = countHits(rec._summaryLower, t);
                const bodyHits = countHits(rec._bodyLower, t);
                if (!(titleHits || tagHits || summaryHits || bodyHits)) return 0; // require every token to land somewhere
                total += titleHits * 5 + tagHits * 3 + summaryHits * 2 + bodyHits * 1;
            }
            return total;
        }

        function searchRecords(query) {
            if (!indexCache) return [];
            const tokens = tokenize(query);
            if (!tokens.length) return [];
            const hits = [];
            for (const rec of indexCache) {
                if (rec.lang !== lang) continue;
                const s = scoreRecord(rec, tokens);
                if (s > 0) hits.push({ rec, s });
            }
            hits.sort((a, b) => b.s - a.s || (b.rec.date || '').localeCompare(a.rec.date || ''));
            return hits.slice(0, 30).map(h => h.rec);
        }

        // ---------- Snippet + highlight ----------
        function escapeHtml(s) {
            return String(s).replace(/[<>&"']/g, c => ({ '<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;' }[c]));
        }

        function highlight(text, tokens) {
            const escaped = escapeHtml(text);
            if (!tokens.length) return escaped;
            const sorted = [...new Set(tokens)].sort((a, b) => b.length - a.length);
            const pattern = sorted.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
            if (!pattern) return escaped;
            const re = new RegExp('(' + pattern + ')', 'gi');
            return escaped.replace(re, '<mark>$1</mark>');
        }

        function makeSnippet(rec, tokens, len) {
            const body = rec.body || rec.summary || '';
            const lower = (rec._bodyLower || rec._summaryLower || '');
            if (!body) return '';
            let pos = -1;
            for (const t of tokens) {
                const i = lower.indexOf(t);
                if (i !== -1 && (pos === -1 || i < pos)) pos = i;
            }
            const window = len || 160;
            if (pos === -1) {
                const head = body.slice(0, window);
                return escapeHtml(head) + (body.length > window ? '…' : '');
            }
            const half = Math.floor(window / 2);
            const start = Math.max(0, pos - half);
            const end = Math.min(body.length, pos + half + (window - half));
            let text = body.slice(start, end);
            if (start > 0) text = '…' + text;
            if (end < body.length) text = text + '…';
            return highlight(text, tokens);
        }

        // ---------- Commands ----------
        function navigate(url) {
            location.href = url;
        }

        function toggleTheme() {
            const html = document.documentElement;
            const current = html.getAttribute('data-theme');
            let next;
            if (current === 'dark') next = 'light';
            else if (current === 'light') next = 'dark';
            else next = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'light' : 'dark';
            html.setAttribute('data-theme', next);
            try { localStorage.setItem('theme', next); } catch (_) {}
            close();
        }

        function switchLang(target) {
            const path = location.pathname || '/';
            let newPath;
            if (target === 'en') {
                newPath = path.startsWith('/en/') || path === '/en' ? path : '/en' + (path.startsWith('/') ? path : '/' + path);
            } else {
                newPath = path.replace(/^\/en(\/|$)/, '/');
            }
            navigate(newPath + (location.hash || ''));
        }

        function buildCommands(query) {
            const otherLang = lang === 'zh' ? 'en' : 'zh';
            const list = [
                { id: 'go-home',       label: lang === 'en' ? 'Go to Home'      : '回到首页',       hint: '/',           icon: 'home', action: () => navigate('/') },
                { id: 'go-ideas',      label: lang === 'en' ? 'Go to Ideas'     : '前往 Ideas',     hint: '/ideas',      icon: 'arrow', action: () => navigate(lang === 'en' ? '/en/ideas/' : '/ideas/') },
                { id: 'go-textlab',    label: lang === 'en' ? 'Go to Text Lab'  : '前往 Text Lab',  hint: '/textlab',    icon: 'arrow', action: () => navigate(lang === 'en' ? '/en/textlab/' : '/textlab/') },
                { id: 'go-technical',  label: lang === 'en' ? 'Go to Technical' : '前往 Technical', hint: '/technical',  icon: 'arrow', action: () => navigate(lang === 'en' ? '/en/technical/' : '/technical/') },
                { id: 'go-influences', label: lang === 'en' ? 'Go to Influences': '前往 Influences', hint: '/influences', icon: 'arrow', action: () => navigate(lang === 'en' ? '/en/influences/' : '/influences/') },
                { id: 'theme',         label: lang === 'en' ? 'Toggle dark mode' : '切换深色模式',  hint: '⇧⌘L',         icon: 'theme', action: toggleTheme },
                { id: 'lang',          label: otherLang === 'en' ? 'Switch to English' : '切换到中文', hint: 'lang',     icon: 'lang',  action: () => switchLang(otherLang) },
                { id: 'tags',          label: lang === 'en' ? 'Browse tags' : '浏览标签',           hint: '#',           icon: 'tag',   action: () => { inputEl.value = '#'; render('#'); inputEl.focus(); } },
            ];
            if (!query) return list;
            const q = query.toLowerCase();
            return list.filter(c => c.label.toLowerCase().includes(q) || c.id.includes(q));
        }

        function buildTags(query) {
            if (!indexCache) return [];
            const counts = new Map();
            for (const r of indexCache) {
                if (r.lang !== lang) continue;
                for (const t of (r.tags || [])) {
                    const key = String(t);
                    counts.set(key, (counts.get(key) || 0) + 1);
                }
            }
            const q = (query || '').toLowerCase();
            return [...counts.entries()]
                .filter(([t]) => !q || t.toLowerCase().includes(q))
                .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
                .map(([tag, count]) => ({
                    type: 'tag',
                    label: tag,
                    count,
                    action: () => navigate('/tags/' + encodeURIComponent(tag.toLowerCase().replace(/\s+/g, '-')) + '/'),
                }));
        }

        // ---------- Render ----------
        const ICONS = {
            search:  '<svg class="search-input-icon" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
            arrow:   '<svg class="sr-icon" viewBox="0 0 24 24"><path d="M5 12h14M13 5l7 7-7 7"/></svg>',
            home:    '<svg class="sr-icon" viewBox="0 0 24 24"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1z"/></svg>',
            theme:   '<svg class="sr-icon" viewBox="0 0 24 24"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
            lang:    '<svg class="sr-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>',
            tag:     '<svg class="sr-icon" viewBox="0 0 24 24"><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/></svg>',
            doc:     '<svg class="sr-icon" viewBox="0 0 24 24"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6"/></svg>',
        };

        function render(query) {
            lastQuery = query;
            const trimmed = (query || '').trim();
            currentTokens = [];
            let mode = 'search';
            let items = [];

            if (trimmed.startsWith('>')) {
                mode = 'command';
                const q = trimmed.slice(1).trim();
                items = buildCommands(q).map(c => ({ type: 'command', cmd: c }));
            } else if (trimmed.startsWith('#')) {
                mode = 'tag';
                const q = trimmed.slice(1).trim();
                items = buildTags(q);
            } else if (trimmed === '') {
                mode = 'search';
                items = buildCommands('').slice(0, 6).map(c => ({ type: 'command', cmd: c }));
            } else {
                mode = 'search';
                currentTokens = tokenize(trimmed);
                const recs = searchRecords(trimmed);
                items = recs.map(r => ({ type: 'result', record: r }));
                const ctxCmds = buildCommands(trimmed).slice(0, 1);
                if (ctxCmds.length && items.length) {
                    items = [...ctxCmds.map(c => ({ type: 'command', cmd: c })), ...items];
                }
            }

            currentItems = items;
            selectedIdx = 0;
            modeHintEl.textContent = mode === 'command' ? 'CMD'
                : mode === 'tag' ? 'TAG'
                : (trimmed === '' ? 'START' : 'SEARCH');
            renderList();
            renderPreview();
        }

        function renderList() {
            if (!currentItems.length) {
                listEl.innerHTML = '<li class="search-empty">' +
                    (lang === 'en' ? 'No matches. Try fewer words, or <em>type ></em> for commands.' : '暂无匹配。试试更少的关键词，或输入 <em>></em> 进入命令。') +
                    '</li>';
                return;
            }
            const html = currentItems.map((item, idx) => {
                const sel = idx === selectedIdx ? ' is-selected' : '';
                if (item.type === 'result') {
                    const r = item.record;
                    const title = highlight(r.title || '(untitled)', currentTokens);
                    const meta = `${escapeHtml(r.section || '')} · ${escapeHtml(r.date || '')}`;
                    const snip = makeSnippet(r, currentTokens, 120);
                    return `<li class="search-result${sel}" data-idx="${idx}">
                        ${ICONS.doc}
                        <div class="sr-body">
                            <div class="sr-title">${title}</div>
                            <div class="sr-meta">${meta}</div>
                            <div class="search-result-mobile-snippet">${snip}</div>
                        </div>
                        <span class="sr-trail">↩</span>
                    </li>`;
                }
                if (item.type === 'command') {
                    const c = item.cmd;
                    return `<li class="search-result is-command${sel}" data-idx="${idx}">
                        ${ICONS[c.icon] || ICONS.arrow}
                        <div class="sr-body">
                            <div class="sr-title">${escapeHtml(c.label)}</div>
                            <div class="sr-meta">${lang === 'en' ? 'COMMAND' : '命令'}</div>
                        </div>
                        <span class="sr-trail">${escapeHtml(c.hint || '')}</span>
                    </li>`;
                }
                if (item.type === 'tag') {
                    return `<li class="search-result is-tag${sel}" data-idx="${idx}">
                        ${ICONS.tag}
                        <div class="sr-body">
                            <div class="sr-title">#${escapeHtml(item.label)}</div>
                            <div class="sr-meta">${item.count} ${lang === 'en' ? (item.count === 1 ? 'post' : 'posts') : '篇'}</div>
                        </div>
                        <span class="sr-trail">↩</span>
                    </li>`;
                }
                return '';
            }).join('');
            listEl.innerHTML = html;
        }

        function renderPreview() {
            const item = currentItems[selectedIdx];
            if (!item) {
                previewEl.innerHTML = `<div class="search-preview-empty">${lang === 'en' ? 'Select an item to preview.' : '选中条目即可预览。'}</div>`;
                return;
            }
            if (item.type === 'result') {
                const r = item.record;
                const snip = makeSnippet(r, currentTokens, 280);
                const tagsHtml = (r.tags || []).map(t => `<span>#${escapeHtml(t)}</span>`).join('');
                previewEl.innerHTML = `
                    <div class="preview-meta">${escapeHtml(r.section || '')} · ${escapeHtml(r.date || '')}</div>
                    <h3 class="preview-title">${highlight(r.title || '', currentTokens)}</h3>
                    ${r.summary ? `<p class="preview-summary">${escapeHtml(r.summary)}</p>` : ''}
                    ${snip ? `<p class="preview-snippet">${snip}</p>` : ''}
                    ${tagsHtml ? `<div class="preview-tags">${tagsHtml}</div>` : ''}
                `;
            } else if (item.type === 'command') {
                const c = item.cmd;
                previewEl.innerHTML = `
                    <div class="preview-meta">${lang === 'en' ? 'COMMAND' : '命令'}</div>
                    <h3 class="preview-title">${escapeHtml(c.label)}</h3>
                    <p class="preview-summary">${escapeHtml(c.hint || '')}</p>
                `;
            } else if (item.type === 'tag') {
                previewEl.innerHTML = `
                    <div class="preview-meta">${lang === 'en' ? 'TAG' : '标签'}</div>
                    <h3 class="preview-title">#${escapeHtml(item.label)}</h3>
                    <p class="preview-summary">${item.count} ${lang === 'en' ? (item.count === 1 ? 'post tagged' : 'posts tagged') : '篇相关文章'}</p>
                `;
            }
        }

        // ---------- Panel construction ----------
        function buildPanel() {
            const modKey = isMac ? '⌘K' : 'Ctrl K';
            root.innerHTML = `
                <div class="search-overlay" data-search-overlay></div>
                <div class="search-panel" role="dialog" aria-modal="true" aria-label="Search">
                    <div class="search-pane-left">
                        <div class="search-inputbar">
                            ${ICONS.search}
                            <input class="search-input" type="text"
                                   placeholder="${lang === 'en' ? 'Search posts, > for commands, # for tags' : '搜索文章, > 输入命令, # 浏览标签'}"
                                   autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">
                            <span class="search-mode-hint" data-mode-hint>START</span>
                            <kbd class="search-esc">esc</kbd>
                        </div>
                        <ul class="search-results" role="listbox"></ul>
                        <div class="search-foot">
                            <span><kbd>↑↓</kbd>${lang === 'en' ? 'navigate' : '导航'}</span>
                            <span><kbd>↩</kbd>${lang === 'en' ? 'open' : '打开'}</span>
                            <span><kbd>esc</kbd>${lang === 'en' ? 'close' : '关闭'}</span>
                            <span class="search-foot-spacer"></span>
                            <span><kbd>${modKey}</kbd>${lang === 'en' ? 'toggle' : '开合'}</span>
                        </div>
                    </div>
                    <div class="search-pane-right">
                        <div class="search-preview"></div>
                    </div>
                </div>
            `;
            panel = root.querySelector('.search-panel');
            inputEl = root.querySelector('.search-input');
            listEl = root.querySelector('.search-results');
            previewEl = root.querySelector('.search-preview');
            modeHintEl = root.querySelector('[data-mode-hint]');

            inputEl.addEventListener('input', e => render(e.target.value));

            root.querySelector('[data-search-overlay]').addEventListener('click', close);

            listEl.addEventListener('mouseover', e => {
                const li = e.target.closest('.search-result');
                if (!li) return;
                const idx = parseInt(li.dataset.idx, 10);
                if (Number.isFinite(idx) && idx !== selectedIdx) {
                    selectedIdx = idx;
                    renderList();
                    renderPreview();
                }
            });

            listEl.addEventListener('click', e => {
                const li = e.target.closest('.search-result');
                if (!li) return;
                const idx = parseInt(li.dataset.idx, 10);
                activate(idx);
            });
        }

        function activate(idx) {
            const item = currentItems[idx];
            if (!item) return;
            if (item.type === 'result') {
                navigate(item.record.url);
            } else if (item.type === 'command') {
                item.cmd.action();
            } else if (item.type === 'tag') {
                item.action();
            }
        }

        function scrollSelectedIntoView() {
            const el = listEl.querySelector('.search-result.is-selected');
            if (el) el.scrollIntoView({ block: 'nearest' });
        }

        // ---------- Open / close ----------
        function open() {
            if (isOpen) return;
            if (!panel) buildPanel();
            isOpen = true;
            
            // Force browser layout so the newly injected DOM elements
            // register their initial CSS state (e.g., blur(0px)) before transitioning.
            void root.offsetWidth;
            
            document.body.classList.add('search-open');
            inputEl.value = '';
            render('');
            requestAnimationFrame(() => inputEl.focus());
            loadIndex().then(() => {
                if (isOpen) render(inputEl.value);
            });
        }

        function close() {
            if (!isOpen) return;
            isOpen = false;
            document.body.classList.remove('search-open');
            if (inputEl) inputEl.blur();
        }

        function toggle() { isOpen ? close() : open(); }

        // ---------- Global keys ----------
        document.addEventListener('keydown', (e) => {
            const mod = e.metaKey || e.ctrlKey;
            if (mod && (e.key === 'k' || e.key === 'K')) {
                e.preventDefault();
                toggle();
                return;
            }
            if (!isOpen) return;
            if (e.key === 'Escape') {
                e.preventDefault();
                close();
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (currentItems.length && selectedIdx < currentItems.length - 1) {
                    selectedIdx++;
                    renderList();
                    renderPreview();
                    scrollSelectedIntoView();
                }
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (selectedIdx > 0) {
                    selectedIdx--;
                    renderList();
                    renderPreview();
                    scrollSelectedIntoView();
                }
            } else if (e.key === 'Enter') {
                e.preventDefault();
                activate(selectedIdx);
            }
        });

        // ---------- Triggers ----------
        triggers.forEach(t => {
            t.addEventListener('click', e => {
                e.preventDefault();
                open();
            });
        });

        // Display the platform-correct kbd hint inside the SEARCH nav entry.
        document.querySelectorAll('[data-search-trigger] .nav-kbd').forEach(k => {
            k.textContent = isMac ? '⌘K' : 'Ctrl K';
        });
    }

    function initFooterReveal() {
        const footer = document.querySelector('.site-footer');
        const wrapper = document.querySelector('.site-wrapper');
        if (!footer || !wrapper) return;

        let footerHeight = 0;

        function updateLayout() {
            footerHeight = footer.offsetHeight;
            wrapper.style.marginBottom = footerHeight + 'px';
            onScroll();
        }

        const ro = new ResizeObserver(() => {
            requestAnimationFrame(updateLayout);
        });
        ro.observe(footer);

        let isAnimating = false;

        function onScroll() {
            const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
            let scrollBottom = maxScroll - window.scrollY;
            if (scrollBottom < 0) scrollBottom = 0;

            const revealDistance = Math.max(1, footerHeight);

            if (scrollBottom <= footerHeight && footerHeight > 0) {
                let progress = 1 - (scrollBottom / revealDistance);
                if (progress < 0) progress = 0;
                if (progress > 1) progress = 1;

                // Quartic Ease Out for smoother non-linear curve
                const eased = 1 - Math.pow(1 - progress, 4);
                const radius = 40 * eased; // from square slowly to round
                const scaleX = 1 - (0.044 * eased);

                wrapper.style.setProperty('--footer-reveal-radius', radius + 'px');
                wrapper.style.transform = 'scaleX(' + scaleX + ')';
                wrapper.style.boxShadow = 'none';
            } else {
                wrapper.style.transform = 'none';
                wrapper.style.boxShadow = 'none';
                wrapper.style.setProperty('--footer-reveal-radius', '0px');
            }
            isAnimating = false;
        }

        window.addEventListener('scroll', () => {
            if (!isAnimating) {
                isAnimating = true;
                requestAnimationFrame(onScroll);
            }
        }, { passive: true });

        updateLayout();
    }
})();
