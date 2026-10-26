export function initPrefetcher() {
    const conn = navigator.connection;
    if (conn && (conn.saveData || /2g|3g/.test(conn.effectiveType))) {
        return;
    }

    const prefetchedUrls = new Set();
    let hoverTimeout = null;

    function isPrefetchable(link) {
        if (!link || !link.href) return false;
        
        try {
            const url = new URL(link.href);
            
            if (url.origin !== window.location.origin) return false;
            
            if (url.pathname === window.location.pathname && url.hash) return false;
            
            if (link.target === '_blank') return false;
            
            const idx = url.pathname.lastIndexOf('.');
            if (idx !== -1) {
                const ext = url.pathname.substring(idx).toLowerCase();
                const ignoredExtensions = ['.pdf', '.zip', '.png', '.jpg', '.jpeg', '.gif', '.mp4', '.xml', '.json', '.txt', '.gz', '.svg'];
                if (ignoredExtensions.some(ignored => ext.endsWith(ignored))) return false;
            }
            
            if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
            
            if (prefetchedUrls.has(url.pathname)) return false;
            
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

    document.body.addEventListener('mouseover', (e) => {
        const link = e.target.closest('a');
        if (!link || !isPrefetchable(link)) return;

        if (hoverTimeout) clearTimeout(hoverTimeout);

        hoverTimeout = setTimeout(() => {
            const url = new URL(link.href);
            doPrefetch(url.pathname);
        }, 65);
    }, { passive: true });

    document.body.addEventListener('mouseout', () => {
        if (hoverTimeout) {
            clearTimeout(hoverTimeout);
        }
    }, { passive: true });

    document.body.addEventListener('touchstart', (e) => {
        const link = e.target.closest('a');
        if (!link || !isPrefetchable(link)) return;

        const url = new URL(link.href);
        doPrefetch(url.pathname);
    }, { passive: true });
}
