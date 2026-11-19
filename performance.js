// performance.js — оптимизации производительности

// ============ КЭШ ТЕКСТУР ============
const textureCache = new Map();
const MAX_TEXTURE_CACHE = 50;

export function getCachedTexture(color, type, createFn) {
    const key = `${color}-${type}`;
    if (textureCache.has(key)) {
        return textureCache.get(key);
    }
    const texture = createFn();
    if (textureCache.size >= MAX_TEXTURE_CACHE) {
        const firstKey = textureCache.keys().next().value;
        const oldTexture = textureCache.get(firstKey);
        if (oldTexture && oldTexture.dispose) oldTexture.dispose();
        textureCache.delete(firstKey);
    }
    textureCache.set(key, texture);
    return texture;
}

export function clearTextureCache() {
    textureCache.forEach(tex => {
        if (tex && tex.dispose) tex.dispose();
    });
    textureCache.clear();
}

// ============ THROTTLE И DEBOUNCE ============
export function throttle(fn, delay) {
    let lastCall = 0;
    return function(...args) {
        const now = performance.now();
        if (now - lastCall >= delay) {
            lastCall = now;
            return fn.apply(this, args);
        }
    };
}

export function debounce(fn, delay) {
    let timeout = null;
    return function(...args) {
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(() => {
            fn.apply(this, args);
            timeout = null;
        }, delay);
    };
}

// ============ КЭШ DOM-ОБНОВЛЕНИЙ ============
const domCache = new WeakMap();

export function updateDOMText(element, newText) {
    if (!element) return;
    const str = String(newText);
    if (domCache.get(element) === str) return;
    domCache.set(element, str);
    element.innerText = str;
}

export function updateDOMStyle(element, prop, value) {
    if (!element) return;
    const key = `${element.id || element.className}-${prop}`;
    const cacheKey = { key };
    if (domCache.get(cacheKey) === value) return;
    domCache.set(cacheKey, value);
    element.style[prop] = value;
}

export function updateDOMClass(element, className, force) {
    if (!element) return;
    const key = `${element.id || element.className}-${className}`;
    const cacheKey = { key };
    const current = domCache.get(cacheKey);
    if (current === force) return;
    domCache.set(cacheKey, force);
    element.classList.toggle(className, force);
}

// ============ FPS МОНИТОР ============
let frameCount = 0;
let lastFpsUpdate = performance.now();
let currentFps = 60;

export function updateFpsCounter() {
    frameCount++;
    const now = performance.now();
    if (now - lastFpsUpdate >= 1000) {
        currentFps = Math.round((frameCount * 1000) / (now - lastFpsUpdate));
        frameCount = 0;
        lastFpsUpdate = now;
    }
    return currentFps;
}

export function getCurrentFps() { return currentFps; }

// ============ MEMOIZE ============
export function memoize(fn, keyFn = null) {
    const cache = new Map();
    const MAX_CACHE = 100;
    return function(...args) {
        const key = keyFn ? keyFn(...args) : JSON.stringify(args);
        if (cache.has(key)) return cache.get(key);
        const result = fn.apply(this, args);
        if (cache.size >= MAX_CACHE) {
            const firstKey = cache.keys().next().value;
            cache.delete(firstKey);
        }
        cache.set(key, result);
        return result;
    };
}