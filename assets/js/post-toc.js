import { matches, QUERIES } from './modules/media.js';

document.addEventListener('DOMContentLoaded', function () {
    const tocs = document.querySelectorAll('.post-toc');
    if (!tocs.length) return;

    const directLink = (li) => Array.from(li.children).find((child) => child.tagName === 'A');
    const hasLinkedAncestor = (li, root) => {
        let parent = li.parentElement ? li.parentElement.closest('li') : null;
        while (parent && root.contains(parent)) {
            if (directLink(parent)) return true;
            parent = parent.parentElement ? parent.parentElement.closest('li') : null;
        }
        return false;
    };

    tocs.forEach((toc) => {
        const linkedItems = Array.from(toc.querySelectorAll('li')).filter(directLink);
        const mainItems = [];

        linkedItems.forEach((li) => {
            li.classList.remove('toc-main-li', 'toc-sub-li', 'has-subitems', 'is-last-main');
            const isSubitem = hasLinkedAncestor(li, toc);
            li.classList.add(isSubitem ? 'toc-sub-li' : 'toc-main-li');
            if (!isSubitem) mainItems.push(li);
        });

        mainItems.forEach((li) => {
            if (li.querySelector('.toc-sub-li')) li.classList.add('has-subitems');
        });

        if (mainItems.length) {
            mainItems[mainItems.length - 1].classList.add('is-last-main');
        }
    });

    const fitSidebarToc = () => {
        const sidebarToc = document.querySelector('.post-toc--sidebar');
        if (!sidebarToc) return;

        if (matches(QUERIES.tocCollapsed)) {
            sidebarToc.style.removeProperty('--toc-max-height');
            sidebarToc.style.removeProperty('--toc-sticky-top');
            return;
        }

        if (!sidebarToc.dataset.baseTop) {
            sidebarToc.dataset.baseTop = `${parseFloat(getComputedStyle(sidebarToc).top) || 0}`;
        }
        if (!sidebarToc.dataset.normalTop) {
            sidebarToc.dataset.normalTop = `${sidebarToc.offsetTop || (sidebarToc.getBoundingClientRect().top + window.scrollY)}`;
        }

        const rect = sidebarToc.getBoundingClientRect();
        const viewportGap = 24;
        const baseTop = parseFloat(sidebarToc.dataset.baseTop) || 0;
        const normalTop = parseFloat(sidebarToc.dataset.normalTop) || 0;
        const centeredTop = Math.max(viewportGap, (baseTop + viewportGap) / 2);
        const isStuck = window.scrollY >= normalTop - centeredTop;
        const stickyTop = isStuck ? centeredTop : baseTop;
        const availableHeight = Math.max(1, window.innerHeight - (isStuck ? stickyTop : rect.top) - viewportGap);

        const nextTop = `${Math.floor(stickyTop)}px`;
        const nextHeight = `${Math.floor(availableHeight)}px`;
        if (sidebarToc.style.getPropertyValue('--toc-sticky-top') !== nextTop) {
            sidebarToc.style.setProperty('--toc-sticky-top', nextTop);
        }
        if (sidebarToc.style.getPropertyValue('--toc-max-height') !== nextHeight) {
            sidebarToc.style.setProperty('--toc-max-height', nextHeight);
        }
    };

    const links = Array.from(document.querySelectorAll('.post-toc a'));
    const headingForLink = (link) => {
        const href = link.getAttribute('href');
        if (!href || !href.startsWith('#')) return null;
        const id = href.slice(1);
        try {
            return document.getElementById(decodeURIComponent(id)) || document.getElementById(id);
        } catch(e) {
            return document.getElementById(id);
        }
    };
    const entries = links.map((link) => ({ link, heading: headingForLink(link) }));
    const headings = [...new Set(entries.map(({ heading }) => heading).filter(Boolean))];

    links.forEach((link) => {
        link.addEventListener('click', (e) => {
            if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
            const target = headingForLink(link);
            if (!target) return;
            e.preventDefault();
            if (location.hash !== link.hash) history.pushState(null, '', link.hash);
            const targetPosition = target.getBoundingClientRect().top + window.scrollY;
            window.scrollTo({
                top: targetPosition - window.innerHeight * 0.25,
                behavior: matches(QUERIES.reducedMotion) ? 'instant' : 'smooth',
            });
        });
    });

    let activeHeading = null;
    const highlightActiveHeading = () => {
        let current = null;
        const readingLine = window.innerHeight * 0.26;

        for (let i = headings.length - 1; i >= 0; i--) {
            if (headings[i].getBoundingClientRect().top <= readingLine) {
                current = headings[i];
                break;
            }
        }

        if (current === activeHeading) return;
        activeHeading = current;
        entries.forEach(({ link, heading }) => {
            const active = current !== null && heading === current;
            link.classList.toggle('is-active', active);
            if (active) link.setAttribute('aria-current', 'location');
            else link.removeAttribute('aria-current');
        });
    };

    let ticking = false;
    const onScrollOrResize = () => {
        if (ticking) return;
        window.requestAnimationFrame(() => {
            fitSidebarToc();
            highlightActiveHeading();
            ticking = false;
        });
        ticking = true;
    };

    window.addEventListener('scroll', onScrollOrResize, { passive: true });
    window.addEventListener('resize', onScrollOrResize);
    if (document.fonts) document.fonts.ready.then(onScrollOrResize);

    setTimeout(() => {
        fitSidebarToc();
        highlightActiveHeading();
    }, 100);
    window.addEventListener('load', () => {
        setTimeout(() => {
            fitSidebarToc();
            highlightActiveHeading();
        }, 150);
    });

    const sidebarToc = document.querySelector('.post-toc--sidebar');
    if (sidebarToc) {
        let touchStartX = 0;
        let touchStartY = 0;
        let trackingTouch = false;
        const drawerContent = sidebarToc.querySelector('.post-toc-content');
        const setDrawerOpen = (open) => {
            sidebarToc.classList.toggle('is-drawer-open', open);
            if (drawerContent) drawerContent.inert = matches(QUERIES.tablet) && !open;
        };
        setDrawerOpen(sidebarToc.classList.contains('is-drawer-open'));
        window.matchMedia(QUERIES.tablet).addEventListener('change', () => setDrawerOpen(false));

        const HINT_KEY = 'toc-drawer-hint-seen';
        let hintEl = null;
        let hintTimer = null;

        const dismissHint = () => {
            if (hintEl && hintEl.classList.contains('is-visible')) {
                hintEl.classList.remove('is-visible');
                try { localStorage.setItem(HINT_KEY, 'true'); } catch(e) {}
                clearTimeout(hintTimer);
                setTimeout(() => {
                    if (hintEl) {
                        hintEl.remove();
                        hintEl = null;
                    }
                }, 400);
            }
        };

        const initTooltip = () => {
            try { if (localStorage.getItem(HINT_KEY)) return; } catch(e) {}

            const isMobile = matches(QUERIES.tablet);
            if (!isMobile) return;

            const lang = document.documentElement.lang || 'zh';
            const hintText = lang === 'en' ? '← Swipe for TOC' : '← 侧滑查看目录';

            hintEl = document.createElement('div');
            hintEl.className = 'toc-drawer-hint';
            hintEl.setAttribute('aria-hidden', 'true');
            hintEl.textContent = hintText;
            document.body.appendChild(hintEl);

            setTimeout(() => {
                if (hintEl) hintEl.classList.add('is-visible');
            }, 1000);

            hintTimer = setTimeout(dismissHint, 5000);
        };

        setTimeout(initTooltip, 300);

        document.addEventListener('touchstart', (e) => {
            trackingTouch = false;
            if (!matches(QUERIES.tablet) || e.touches.length !== 1) return;
            const scrollingContent = e.target.closest('pre, .table-wrapper, .katex-display, input, textarea, select, [contenteditable="true"]');
            if (scrollingContent && (scrollingContent.matches('input, textarea, select, [contenteditable="true"]') || scrollingContent.scrollWidth > scrollingContent.clientWidth)) return;
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
            trackingTouch = true;
            
            dismissHint();
        }, { passive: true });

        const handleTouchEnd = (e) => {
            if (!trackingTouch || !e.changedTouches.length) return;
            trackingTouch = false;
            const touchEndX = e.changedTouches[0].clientX;
            const touchEndY = e.changedTouches[0].clientY;
            const deltaX = touchEndX - touchStartX;
            const deltaY = touchEndY - touchStartY;

            const isMobile = matches(QUERIES.tablet);
            if (!isMobile) return;

            if (Math.abs(deltaX) > Math.abs(deltaY) * 1.2 && Math.abs(deltaX) > 30) {
                const isOpen = sidebarToc.classList.contains('is-drawer-open');
                if (deltaX < 0 && !isOpen) {
                    if (touchStartX > window.innerWidth * 0.25) {
                        setDrawerOpen(true);
                        dismissHint();
                    }
                } else if (deltaX > 0 && isOpen) {
                    setDrawerOpen(false);
                }
            }
        };

        document.addEventListener('touchend', handleTouchEnd, { passive: true });
        document.addEventListener('touchcancel', () => { trackingTouch = false; }, { passive: true });

        document.addEventListener('click', (e) => {
            const isMobile = matches(QUERIES.tablet);
            if (!isMobile) return;

            const isOpen = sidebarToc.classList.contains('is-drawer-open');
            const clickedToc = sidebarToc.contains(e.target);

            if (isOpen) {
                if (!clickedToc) {
                    setDrawerOpen(false);
                }
            } else {
                if (e.target.closest('a, button, input, textarea, select, [contenteditable="true"]')) return;
                if (e.clientX > window.innerWidth - 32 && e.clientY > window.innerHeight * 0.1 && e.clientY < window.innerHeight * 0.9) {
                    setDrawerOpen(true);
                    dismissHint();
                }
            }
        });

        sidebarToc.addEventListener('click', (e) => {
            const isMobile = matches(QUERIES.tablet);
            if (!isMobile) return;

            const isOpen = sidebarToc.classList.contains('is-drawer-open');
            if (!isOpen) {
                setDrawerOpen(true);
                dismissHint();
                e.stopPropagation();
            }
        });

        const tocLinks = sidebarToc.querySelectorAll('nav a');
        tocLinks.forEach((link) => {
            link.addEventListener('click', () => {
                const isMobile = matches(QUERIES.tablet);
                if (isMobile) {
                    setTimeout(() => {
                        setDrawerOpen(false);
                    }, 150);
                }
            });
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && matches(QUERIES.tablet) && sidebarToc.classList.contains('is-drawer-open')) {
                setDrawerOpen(false);
            }
        });
        window.addEventListener('scroll', dismissHint, { passive: true });
    }
});
