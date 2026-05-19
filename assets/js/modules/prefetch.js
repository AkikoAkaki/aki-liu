export function initPrefetcher() {
    // 1. Connection check - do not prefetch on low speed or save-data modes
    const conn = navigator.connection;
    if (conn && (conn.saveData || /2g|3g/.test(conn.effectiveType))) {
        return;
    }

    const prefetchedUrls = new Set();
    let hoverTimeout = null;

    // Helper to audit link prefetch capability
    function isPrefetchable(link) {
        if (!link || !link.href) return false;
        
        try {
            const url = new URL(link.href);
            
            // Check same origin
            if (url.origin !== window.location.origin) return false;
            
            // Check same page anchor link (no network reload needed)
            if (url.pathname === window.location.pathname && url.hash) return false;
            
            // Skip targets intended for new tabs
            if (link.target === '_blank') return false;
            
            // Ignore non-HTML static resources
            const idx = url.pathname.lastIndexOf('.');
            if (idx !== -1) {
                const ext = url.pathname.substring(idx).toLowerCase();
                const ignoredExtensions = ['.pdf', '.zip', '.png', '.jpg', '.jpeg', '.gif', '.mp4', '.xml', '.json', '.txt', '.gz', '.svg'];
                if (ignoredExtensions.some(ignored => ext.endsWith(ignored))) return false;
            }
            
            // Strict http/https checking
            if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
            
            // Skip already prefetched pages
            if (prefetchedUrls.has(url.pathname)) return false;
            
            // Ignore development publish API endpoints
            if (url.pathname.includes('/microblog/server/')) return false;

            return true;
        } catch (_) {
            return false;
        }
    }

    function doPrefetch(urlPath) {
        if (prefetchedUrls.has(urlPath)) return;
        
        const linkElem = document.createElement('link');
        linkElem.rel = 'prefetch';
        linkElem.href = urlPath;
        document.head.appendChild(linkElem);
        
        prefetchedUrls.add(urlPath);
    }

    // Event delegation on body for hover prefetching
    document.body.addEventListener('mouseover', (e) => {
        const link = e.target.closest('a');
        if (!link || !isPrefetchable(link)) return;

        if (hoverTimeout) clearTimeout(hoverTimeout);

        hoverTimeout = setTimeout(() => {
            const url = new URL(link.href);
            doPrefetch(url.pathname);
        }, 65); // 65ms hover threshold
    }, { passive: true });

    document.body.addEventListener('mouseout', (e) => {
        const link = e.target.closest('a');
        if (link && hoverTimeout) {
            clearTimeout(hoverTimeout);
        }
    }, { passive: true });

    // Touchstart logic for instant prefetch trigger on mobile touch down
    document.body.addEventListener('touchstart', (e) => {
        const link = e.target.closest('a');
        if (!link || !isPrefetchable(link)) return;

        const url = new URL(link.href);
        doPrefetch(url.pathname);
    }, { passive: true });
}
