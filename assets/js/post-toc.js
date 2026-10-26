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

        sidebarToc.style.setProperty('--toc-sticky-top', `${Math.floor(stickyTop)}px`);
        sidebarToc.style.setProperty('--toc-max-height', `${Math.floor(availableHeight)}px`);
    };

    const links = Array.from(document.querySelectorAll('.post-toc a'));
    const headings = links
        .map((link) => {
            const id = link.getAttribute('href').slice(1);
            try {
                return document.getElementById(decodeURIComponent(id)) || document.getElementById(id);
            } catch(e) {
                return document.getElementById(id);
            }
        })
        .filter(Boolean);

    const scrollToHeading = (link) => {
        const id = link.getAttribute('href').slice(1);
        try {
            const target = document.getElementById(decodeURIComponent(id)) || document.getElementById(id);
            if (target) {
                const targetPosition = target.getBoundingClientRect().top + window.pageYOffset;
                const offsetPosition = targetPosition - window.innerHeight * 0.25;
                window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
            }
        } catch(e) {}
    };

    links.forEach((link) => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            scrollToHeading(link);
        });
    });

    const highlightActiveHeading = () => {
        let current = null;
        const scrollPos = window.scrollY + window.innerHeight * 0.26;

        for (let i = headings.length - 1; i >= 0; i--) {
            if (headings[i] && headings[i].offsetTop <= scrollPos) {
                current = headings[i];
                break;
            }
        }

        links.forEach((link) => link.classList.remove('is-active'));

        if (current) {
            const currentIdDecoded = decodeURIComponent(current.id);
            const activeLinks = links.filter((link) => {
                const href = link.getAttribute('href');
                if (!href || !href.startsWith('#')) return false;
                try {
                    return decodeURIComponent(href.slice(1)) === currentIdDecoded;
                } catch(e) {
                    return href.slice(1) === current.id;
                }
            });
            
            activeLinks.forEach((link) => {
                link.classList.add('is-active');
            });
        }
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

    window.addEventListener('scroll', onScrollOrResize);
    window.addEventListener('resize', onScrollOrResize);

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

        const HINT_KEY = 'toc-drawer-hint-seen';
        let hintEl = null;
        let hintTimer = null;

        const dismissHint = () => {
            if (hintEl && hintEl.classList.contains('is-visible')) {
                hintEl.classList.remove('is-visible');
                localStorage.setItem(HINT_KEY, 'true');
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
            if (localStorage.getItem(HINT_KEY)) return;

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
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
            
            dismissHint();
        }, { passive: true });

        const handleTouchEnd = (e) => {
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
                        sidebarToc.classList.add('is-drawer-open');
                        dismissHint();
                    }
                } else if (deltaX > 0 && isOpen) {
                    sidebarToc.classList.remove('is-drawer-open');
                }
            }
        };

        document.addEventListener('touchend', handleTouchEnd, { passive: true });
        document.addEventListener('touchcancel', handleTouchEnd, { passive: true });

        document.addEventListener('click', (e) => {
            const isMobile = matches(QUERIES.tablet);
            if (!isMobile) return;

            const isOpen = sidebarToc.classList.contains('is-drawer-open');
            const clickedToc = sidebarToc.contains(e.target);

            if (isOpen) {
                if (!clickedToc) {
                    sidebarToc.classList.remove('is-drawer-open');
                }
            } else {
                if (e.clientX > window.innerWidth - 32 && e.clientY > window.innerHeight * 0.1 && e.clientY < window.innerHeight * 0.9) {
                    sidebarToc.classList.add('is-drawer-open');
                    dismissHint();
                }
            }
        });

        sidebarToc.addEventListener('click', (e) => {
            const isMobile = matches(QUERIES.tablet);
            if (!isMobile) return;

            const isOpen = sidebarToc.classList.contains('is-drawer-open');
            if (!isOpen) {
                sidebarToc.classList.add('is-drawer-open');
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
                        sidebarToc.classList.remove('is-drawer-open');
                    }, 150);
                }
            });
        });

        window.addEventListener('scroll', dismissHint, { passive: true });
    }
});
