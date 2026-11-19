// optimization.js — оптимизация загрузки

export function preloadCriticalResources() {
    const criticalAssets = [
        { url: 'https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;700;900&display=swap', as: 'style' },
    ];
    
    criticalAssets.forEach(({ url, as }) => {
        const link = document.createElement('link');
        link.rel = 'preload';
        link.href = url;
        link.as = as;
        link.crossOrigin = 'anonymous';
        document.head.appendChild(link);
    });
}

const moduleCache = new Map();

export async function lazyLoadModule(modulePath) {
    if (moduleCache.has(modulePath)) {
        return moduleCache.get(modulePath);
    }
    
    try {
        const module = await import(modulePath);
        moduleCache.set(modulePath, module);
        return module;
    } catch (err) {
        console.error(`[Optimization] Failed to load module: ${modulePath}`, err);
        return null;
    }
}

export function prefetchScripts(urls) {
    urls.forEach(url => {
        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.href = url;
        link.as = 'script';
        document.head.appendChild(link);
    });
}

export function lazyLoadImages() {
    if (!('IntersectionObserver' in window)) return;
    
    const imageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                if (img.dataset.src) {
                    img.src = img.dataset.src;
                    img.removeAttribute('data-src');
                    imageObserver.unobserve(img);
                }
            }
        });
    });
    
    document.querySelectorAll('img[data-src]').forEach(img => {
        imageObserver.observe(img);
    });
}

export function onVisible(callback, options = {}) {
    if (!('IntersectionObserver' in window)) {
        callback();
        return;
    }
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                callback();
                observer.disconnect();
            }
        });
    }, options);
    
    return observer;
}

export function onScrollThrottled(callback, delay = 100) {
    let ticking = false;
    
    window.addEventListener('scroll', () => {
        if (!ticking) {
            window.requestAnimationFrame(() => {
                callback();
                ticking = false;
            });
            ticking = true;
        }
    }, { passive: true });
}

export function getConnectionQuality() {
    if ('connection' in navigator) {
        const conn = navigator.connection;
        return {
            effectiveType: conn.effectiveType,
            downlink: conn.downlink,
            rtt: conn.rtt,
            saveData: conn.saveData,
        };
    }
    return {
        effectiveType: '4g',
        downlink: 10,
        rtt: 50,
        saveData: false,
    };
}

export function shouldLoadHeavyAssets() {
    const conn = getConnectionQuality();
    return conn.effectiveType === '4g' && !conn.saveData;
}

const computationCache = new Map();
const MAX_CACHE_SIZE = 100;

export function cachedComputation(key, computeFn) {
    if (computationCache.has(key)) {
        return computationCache.get(key);
    }
    
    const result = computeFn();
    
    if (computationCache.size >= MAX_CACHE_SIZE) {
        const firstKey = computationCache.keys().next().value;
        computationCache.delete(firstKey);
    }
    
    computationCache.set(key, result);
    return result;
}

export function pauseAnimationsWhenHidden() {
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            document.body.classList.add('animations-paused');
        } else {
            document.body.classList.remove('animations-paused');
        }
    });
}

export function initOptimizations() {
    preloadCriticalResources();
    lazyLoadImages();
    pauseAnimationsWhenHidden();
    
    if (shouldLoadHeavyAssets()) {
        prefetchScripts([
            './postprocessing.js',
            './environment-particles.js',
        ]);
    }
    
    console.log('[Optimization] Initialized. Connection:', getConnectionQuality().effectiveType);
}
