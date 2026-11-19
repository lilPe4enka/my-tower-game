// utils.js — утилиты стабильности и безопасности

// ============ БЕЗОПАСНАЯ РАБОТА С LOCALSTORAGE ============
export function safeGetItem(key, defaultValue) {
    try {
        const value = localStorage.getItem(key);
        if (value === null) return defaultValue;
        try {
            return JSON.parse(value);
        } catch (parseErr) {
            return value;
        }
    } catch (e) {
        console.warn(`[localStorage] Ошибка чтения "${key}":`, e);
        return defaultValue;
    }
}

export function safeSetItem(key, value) {
    try {
        localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
        return true;
    } catch (e) {
        console.warn(`[localStorage] Ошибка записи "${key}":`, e);
        if (e.name === 'QuotaExceededError') {
            try {
                const cleanupKeys = ['towerRecentScores', 'towerLeaderboard'];
                cleanupKeys.forEach(k => localStorage.removeItem(k));
                localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
                return true;
            } catch (retryErr) {
                console.error(`[localStorage] Не удалось записать даже после очистки:`, retryErr);
            }
        }
        return false;
    }
}

export function safeParseInt(value, defaultValue = 0) {
    const parsed = parseInt(value);
    return Number.isFinite(parsed) ? parsed : defaultValue;
}

export function safeParseJSON(value, defaultValue) {
    try {
        const parsed = JSON.parse(value);
        return parsed !== null && parsed !== undefined ? parsed : defaultValue;
    } catch (e) {
        return defaultValue;
    }
}

// ============ ЛИМИТЫ ЧАСТИЦ ============
export const PARTICLE_LIMITS = {
    MAX_DEBRIS: 150,
    MAX_CONFETTI: 400,
    MAX_PARTICLES_PER_SPAWN: 50
};

export function enforceParticleLimits(scene, debris, confetti, disposeMesh) {
    while (debris.length > PARTICLE_LIMITS.MAX_DEBRIS) {
        const old = debris.shift();
        if (old && old.parent) {
            scene.remove(old);
            if (disposeMesh) disposeMesh(old);
        }
    }
    while (confetti.length > PARTICLE_LIMITS.MAX_CONFETTI) {
        const old = confetti.shift();
        if (old && old.parent) {
            scene.remove(old);
            if (disposeMesh) disposeMesh(old);
        }
    }
}

// ============ БЛОКИРОВКА МОДАЛОК ============
let activeModal = null;

export function showModalSafe(el) {
    if (!el) return;
    if (activeModal && activeModal !== el) {
        hideModalSafe(activeModal);
    }
    activeModal = el;
    el.classList.add('open');
    requestAnimationFrame(() => {
        const firstFocusable = el.querySelector('button:not([disabled]), [tabindex="0"], input, select, textarea');
        if (firstFocusable) {
            try { firstFocusable.focus({ preventScroll: true }); } catch(e) {}
        }
    });
}

export function hideModalSafe(el) {
    if (!el) return;
    el.classList.remove('open');
    if (activeModal === el) activeModal = null;
}

export function isAnyModalOpen() {
    return activeModal !== null;
}

// ============ ГЛОБАЛЬНАЯ ОБРАБОТКА ОШИБОК ============
export function setupGlobalErrorHandler() {
    window.addEventListener('error', (e) => {
        console.error('[Global Error]', {
            message: e.message,
            filename: e.filename,
            lineno: e.lineno,
            colno: e.colno,
            error: e.error?.stack
        });
    });
    window.addEventListener('unhandledrejection', (e) => {
        console.error('[Unhandled Promise Rejection]', {
            reason: e.reason,
            stack: e.reason?.stack
        });
        e.preventDefault();
    });
}

// ============ ВАЛИДАЦИЯ ДАННЫХ ============
export function validateSkinKey(key, availableSkins) {
    if (!key || !availableSkins[key]) return 'default';
    return key;
}

export function validateArray(value, defaultValue = []) {
    return Array.isArray(value) ? value : defaultValue;
}

export function validateObject(value, defaultValue = {}) {
    return (value && typeof value === 'object' && !Array.isArray(value)) ? value : defaultValue;
}

export function clampNumber(value, min, max, defaultValue = 0) {
    const num = Number(value);
    if (!Number.isFinite(num)) return defaultValue;
    return Math.max(min, Math.min(max, num));
}
