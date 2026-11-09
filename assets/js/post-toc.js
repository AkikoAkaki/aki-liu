import { QUERIES } from './modules/media.js';

const drawerMode = () => matchMedia(QUERIES.tablet).matches;
const sidebarMode = () => !matchMedia(QUERIES.tocCollapsed).matches;

document.addEventListener('DOMContentLoaded', () => {
    // Microblog entries with headings load this script but render no TOC.
    const toc = document.querySelector('.post-toc--sidebar');
    if (!toc) return;
    markTocLevels(toc);
    initTocTracking(toc);
    initTocDrawer(toc);
});

function markTocLevels(toc) {
    const directLink = (li) => Array.from(li.children).find((child) => child.tagName === 'A');
    const hasLinkedAncestor = (li) => {
        for (let parent = li.parentElement.closest('li'); parent && toc.contains(parent); parent = parent.parentElement.closest('li')) {
            if (directLink(parent)) return true;
        }
        return false;
    };
    const linkedItems = Array.from(toc.querySelectorAll('li')).filter(directLink);
    const mainItems = linkedItems.filter((li) => !hasLinkedAncestor(li));
    linkedItems.forEach((li) => li.classList.add(mainItems.includes(li) ? 'toc-main-li' : 'toc-sub-li'));
    mainItems.forEach((li) => {
        if (li.querySelector('.toc-sub-li')) li.classList.add('has-subitems');
    });
    mainItems.at(-1)?.classList.add('is-last-main');
}

function initTocTracking(toc) {
    const postContent = document.querySelector('.post-content');
    const layoutTop = (element) => {
        let top = 0;
        for (; element; element = element.offsetParent) top += element.offsetTop;
        return top;
    };
    let sidebarStartTop = 0;
    let sidebarCenterTop = 24;
    const positionSidebar = () => {
        if (!sidebarMode()) return;
        const progress = Math.min(1, Math.max(0, window.scrollY) / (window.innerHeight * 0.5));
        const top = sidebarStartTop < sidebarCenterTop
            ? sidebarStartTop + (sidebarCenterTop - sidebarStartTop) * progress
            : sidebarCenterTop;
        const nextTop = `${top}px`;
        if (toc.style.getPropertyValue('--toc-sticky-top') !== nextTop) {
            toc.style.setProperty('--toc-sticky-top', nextTop);
        }
    };
    const fitSidebar = () => {
        if (!sidebarMode()) {
            toc.style.removeProperty('--toc-max-height');
            toc.style.removeProperty('--toc-sticky-top');
            return;
        }
        const viewportGap = 24;
        const nextHeight = `${Math.max(1, window.innerHeight - viewportGap * 2)}px`;
        if (toc.style.getPropertyValue('--toc-max-height') !== nextHeight) {
            toc.style.setProperty('--toc-max-height', nextHeight);
        }
        sidebarCenterTop = Math.max(viewportGap, (window.innerHeight - toc.offsetHeight) / 2);
        sidebarStartTop = layoutTop(postContent);
        positionSidebar();
    };

    const links = Array.from(toc.querySelectorAll('a'));
    const headingForLink = (link) => {
        const href = link.getAttribute('href');
        if (!href || !href.startsWith('#')) return null;
        const id = href.slice(1);
        try {
            return document.getElementById(decodeURIComponent(id)) || document.getElementById(id);
        } catch (e) {
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
            window.scrollTo({
                top: target.getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.25,
                behavior: matchMedia(QUERIES.reducedMotion).matches ? 'instant' : 'smooth',
            });
        });
    });

    let headingTops = [];
    let activeHeading = null;
    const highlightActiveHeading = () => {
        const boundary = window.scrollY + window.innerHeight * 0.26;
        let low = 0, high = headingTops.length;
        while (low < high) {
            const middle = (low + high) >>> 1;
            if (headingTops[middle] <= boundary) low = middle + 1;
            else high = middle;
        }
        const current = low ? headings[low - 1] : null;
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
        requestAnimationFrame(() => {
            positionSidebar();
            highlightActiveHeading();
            ticking = false;
        });
        ticking = true;
    };
    const onLayoutChange = () => {
        fitSidebar();
        const scrollTop = window.scrollY;
        headingTops = headings.map((heading) => heading.getBoundingClientRect().top + scrollTop);
        onScrollOrResize();
    };

    window.addEventListener('scroll', onScrollOrResize, { passive: true });
    window.addEventListener('resize', onLayoutChange);
    window.addEventListener('load', onLayoutChange);
    document.fonts.ready.then(onLayoutChange);
    new ResizeObserver(onLayoutChange).observe(toc.querySelector('.post-toc-content'));
    new ResizeObserver(onLayoutChange).observe(postContent);
    onLayoutChange();
}

function initTocDrawer(toc) {
    const content = toc.querySelector('.post-toc-content');
    const toggle = toc.querySelector('.post-toc-toggle');
    const isOpen = () => toc.classList.contains('is-drawer-open');

    const setOpen = (open) => {
        const hadFocus = content.contains(document.activeElement);
        toc.classList.toggle('is-drawer-open', open);
        toggle.setAttribute('aria-expanded', String(open));
        content.inert = drawerMode() && !open;
        if (drawerMode() && !open && hadFocus) toggle.focus({ preventScroll: true });
    };
    setOpen(isOpen());
    matchMedia(QUERIES.tablet).addEventListener('change', () => setOpen(false));

    const dismissHint = initSwipeHint();
    const openFromGesture = () => {
        setOpen(true);
        dismissHint();
    };

    let touchStartX = 0;
    let touchStartY = 0;
    let trackingTouch = false;
    document.addEventListener('touchstart', (e) => {
        trackingTouch = false;
        if (!drawerMode() || e.touches.length !== 1) return;
        const scrolling = e.target.closest('pre, .table-wrapper, .katex-display, input, textarea, select, [contenteditable="true"]');
        if (scrolling && (scrolling.matches('input, textarea, select, [contenteditable="true"]') || scrolling.scrollWidth > scrolling.clientWidth)) return;
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        trackingTouch = true;
        dismissHint();
    }, { passive: true });

    document.addEventListener('touchend', (e) => {
        if (!trackingTouch || !e.changedTouches.length) return;
        trackingTouch = false;
        if (!drawerMode()) return;
        const deltaX = e.changedTouches[0].clientX - touchStartX;
        const deltaY = e.changedTouches[0].clientY - touchStartY;
        if (Math.abs(deltaX) <= Math.abs(deltaY) * 1.2 || Math.abs(deltaX) <= 30) return;
        if (deltaX < 0 && !isOpen()) {
            if (touchStartX > window.innerWidth * 0.25) openFromGesture();
        } else if (deltaX > 0 && isOpen()) {
            setOpen(false);
        }
    }, { passive: true });
    document.addEventListener('touchcancel', () => { trackingTouch = false; }, { passive: true });

    document.addEventListener('click', (e) => {
        if (!drawerMode()) return;
        if (isOpen()) {
            if (!toc.contains(e.target)) setOpen(false);
            return;
        }
        if (e.target.closest('a, button, input, textarea, select, [contenteditable="true"]')) return;
        if (e.clientX > window.innerWidth - 32 && e.clientY > window.innerHeight * 0.1 && e.clientY < window.innerHeight * 0.9) {
            openFromGesture();
        }
    });

    toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        setOpen(!isOpen());
        dismissHint();
    });

    toc.addEventListener('click', (e) => {
        if (!drawerMode() || isOpen()) return;
        openFromGesture();
        e.stopPropagation();
    });

    toc.querySelectorAll('nav a').forEach((link) => {
        link.addEventListener('click', () => {
            if (drawerMode()) setTimeout(() => setOpen(false), 150);
        });
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && drawerMode() && isOpen()) setOpen(false);
    });
    window.addEventListener('scroll', dismissHint, { passive: true });
}

function initSwipeHint() {
    const HINT_KEY = 'toc-drawer-hint-seen';
    let hint = null;
    let timer = null;

    const dismiss = () => {
        if (!hint || !hint.classList.contains('is-visible')) return;
        hint.classList.remove('is-visible');
        try { localStorage.setItem(HINT_KEY, 'true'); } catch (e) {}
        clearTimeout(timer);
        setTimeout(() => {
            hint?.remove();
            hint = null;
        }, 400);
    };

    setTimeout(() => {
        try { if (localStorage.getItem(HINT_KEY)) return; } catch (e) {}
        if (!drawerMode()) return;
        hint = document.createElement('div');
        hint.className = 'toc-drawer-hint';
        hint.setAttribute('aria-hidden', 'true');
        hint.textContent = document.documentElement.lang === 'en' ? '← Swipe for TOC' : '← 侧滑查看目录';
        document.body.appendChild(hint);
        setTimeout(() => hint?.classList.add('is-visible'), 1000);
        timer = setTimeout(dismiss, 5000);
    }, 300);

    return dismiss;
}
