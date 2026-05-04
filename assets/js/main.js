(function () {
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
                triggerWipe();
            }

            function handleLeave() {
                if (!isInitialized) return;
                cancel();
                const chars = orderedCharsForLeave();
                timers = staggerFontChange(chars, char => {
                    char.style.fontFamily = origFamily;
                    char.style.fontStyle  = origStyle;
                });
                triggerWipe();
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

        // --- Nav description hover ---
        const navLinks = document.querySelectorAll('.nav-links a');
        const descDisplay = document.getElementById('nav-desc');

        navLinks.forEach(link => {
            link.addEventListener('mouseenter', () => {
                const desc = link.getAttribute('data-desc');
                if (desc) {
                    descDisplay.textContent = desc;
                    descDisplay.classList.add('show');
                }
            });
            link.addEventListener('mouseleave', () => {
                descDisplay.classList.remove('show');
            });
        });

        // Replace :has() with class toggle for better style-recalc performance
        const navLinksContainer = document.querySelector('.nav-links');
        if (navLinksContainer) {
            navLinksContainer.addEventListener('mouseenter', () => {
                document.body.classList.add('nav-hovering');
            });
            navLinksContainer.addEventListener('mouseleave', () => {
                document.body.classList.remove('nav-hovering');
            });
        }

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
    });
})();