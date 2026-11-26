// cloud-storage.js — синхронизация с Telegram.WebApp.CloudStorage и встроенный глобальный вайп

import { safeGetItem, safeSetItem } from './utils.js?v=18';
import { STORAGE_KEYS } from './constants.js?v=18';

export const WIPE_VERSION = '2026_11_first_wipe_v1';
const WIPE_LOCAL_KEY = 'towerWipeVersion';
const CLOUD_WIPE_KEY = 'tower_wipe_ver';
const CLOUD_SNAPSHOT_KEY = 'tower_save_v2';

// Дедлайн выдачи эксклюзивного скина: 27.11.2026 23:59:59 МСК (UTC+3)
const FIRST_WIPE_SKIN_ID = 'first_wipe_leg';
const FIRST_WIPE_COMPENSATION_COINS = 500;
const FIRST_WIPE_DEADLINE_MS = new Date('2026-11-27T23:59:59+03:00').getTime();

// Все ключи localStorage, которые входят в облачное сохранение
const SYNCED_KEYS = [
    STORAGE_KEYS.COINS,
    STORAGE_KEYS.HIGH_SCORE,
    STORAGE_KEYS.SKIN,
    STORAGE_KEYS.SKINS,
    STORAGE_KEYS.PALETTE,
    STORAGE_KEYS.PALETTES,
    STORAGE_KEYS.BACKGROUND,
    STORAGE_KEYS.BACKGROUNDS,
    STORAGE_KEYS.FEATURES,
    STORAGE_KEYS.SETTINGS,
    STORAGE_KEYS.STATS,
    STORAGE_KEYS.ACHIEVEMENTS,
    STORAGE_KEYS.XP,
    STORAGE_KEYS.LEVEL,
    STORAGE_KEYS.STREAK,
    STORAGE_KEYS.LAST_VISIT,
    STORAGE_KEYS.POWERUPS,
    STORAGE_KEYS.CHESTS,
    STORAGE_KEYS.TOTAL_SCORE,
    'towerBestHeight',
    'towerUpgrades',
    'towerPrestigeCount',
    'towerPrestigeBonus',
    'towerLastWheelSpinDate',
];

let saveTimer = null;
let cloudStatusText = 'Не доступно';
let pendingCloudWipe = false;

function getCloudStorage() {
    const tg = window.Telegram?.WebApp;
    if (tg?.CloudStorage && tg.isVersionAtLeast('6.9')) return tg.CloudStorage;
    return null;
}

export function isCloudStorageAvailable() {
    return Boolean(getCloudStorage());
}

export function getCloudStatus() {
    return cloudStatusText;
}

/**
 * Запускается синхронно в самом начале game.js ДО чтения прогресса.
 * Полностью очищает localStorage, выдаёт 500 монет и (до 27.11.2026 23:59 МСК) скин «Первый вайп».
 */
export function runGlobalWipeIfNeeded() {
    if (safeGetItem(WIPE_LOCAL_KEY, '') === WIPE_VERSION) {
        return { wiped: false, gotSkin: false, coins: 0 };
    }

    // 1. Полный сброс всех локальных данных (достижения, скины, фоны, цвета, улучшения, настройки и т.д.)
    try {
        localStorage.clear();
    } catch (e) {}

    // 2. Ставим метку пройденного вайпа
    safeSetItem(WIPE_LOCAL_KEY, WIPE_VERSION);

    // 3. Компенсация: 500 монет
    safeSetItem(STORAGE_KEYS.COINS, FIRST_WIPE_COMPENSATION_COINS);

    // 4. Эксклюзивный легендарный скин «Первый вайп» (только до 27.11.2026 23:59:59 МСК)
    const gotSkin = Date.now() <= FIRST_WIPE_DEADLINE_MS;
    if (gotSkin) {
        safeSetItem(STORAGE_KEYS.SKINS, ['default', FIRST_WIPE_SKIN_ID]);
        safeSetItem(STORAGE_KEYS.SKIN, FIRST_WIPE_SKIN_ID);
    } else {
        safeSetItem(STORAGE_KEYS.SKINS, ['default']);
        safeSetItem(STORAGE_KEYS.SKIN, 'default');
    }

    pendingCloudWipe = true;
    return { wiped: true, gotSkin, coins: FIRST_WIPE_COMPENSATION_COINS };
}

function buildLocalSnapshot() {
    const data = {};
    for (const key of SYNCED_KEYS) {
        if (!key) continue;
        const raw = localStorage.getItem(key);
        if (raw !== null) data[key] = raw;
    }
    return JSON.stringify(data);
}

function applyCloudSnapshot(jsonStr) {
    if (!jsonStr) return false;
    try {
        const parsed = JSON.parse(jsonStr);
        if (!parsed || typeof parsed !== 'object') return false;
        for (const [key, val] of Object.entries(parsed)) {
            if (typeof val === 'string') localStorage.setItem(key, val);
        }
        safeSetItem(WIPE_LOCAL_KEY, WIPE_VERSION);
        return true;
    } catch (e) {
        return false;
    }
}

function cloudGetItems(cs, keys) {
    return new Promise((resolve) => {
        cs.getItems(keys, (err, values) => resolve(err ? null : values));
    });
}

function cloudGetKeys(cs) {
    return new Promise((resolve) => {
        cs.getKeys((err, keys) => resolve(err ? [] : (Array.isArray(keys) ? keys : [])));
    });
}

function cloudRemoveItems(cs, keys) {
    if (!keys || keys.length === 0) return Promise.resolve();
    return new Promise((resolve) => {
        cs.removeItems(keys, () => resolve());
    });
}

function cloudSetItem(cs, key, value) {
    return new Promise((resolve) => {
        cs.setItem(key, String(value), (err) => resolve(!err));
    });
}

export async function flushCloudSave() {
    if (saveTimer) {
        clearTimeout(saveTimer);
        saveTimer = null;
    }
    const cs = getCloudStorage();
    if (!cs) {
        cloudStatusText = 'Локально (без Telegram)';
        return false;
    }
    try {
        const payload = buildLocalSnapshot();
        // Ограничение Telegram CloudStorage: 4096 байт на ключ
        if (payload.length > 4000) {
            cloudStatusText = 'Слишком большой сейв';
            return false;
        }
        const ok1 = await cloudSetItem(cs, CLOUD_WIPE_KEY, WIPE_VERSION);
        const ok2 = await cloudSetItem(cs, CLOUD_SNAPSHOT_KEY, payload);
        if (ok1 && ok2) {
            const t = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
            cloudStatusText = `Сохранено в ${t}`;
            return true;
        }
        cloudStatusText = 'Ошибка сохранения';
        return false;
    } catch (e) {
        cloudStatusText = 'Ошибка облака';
        return false;
    }
}

export function scheduleCloudSave() {
    if (!isCloudStorageAvailable()) return;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
        saveTimer = null;
        flushCloudSave();
    }, 1500);
}

export async function initCloudSync(onMerge) {
    const cs = getCloudStorage();
    if (!cs) {
        cloudStatusText = 'Локально (без Telegram)';
        return;
    }

    cloudStatusText = 'Синхронизация...';
    const items = await cloudGetItems(cs, [CLOUD_WIPE_KEY, CLOUD_SNAPSHOT_KEY]);
    const cloudWipeVer = items?.[CLOUD_WIPE_KEY] || '';
    const cloudSnap = items?.[CLOUD_SNAPSHOT_KEY] || '';

    // Случай 1: В облаке старые данные (до вайпа) — полностью вычищаем все ключи облака и пишем чистый профиль
    if (cloudWipeVer !== WIPE_VERSION) {
        const allKeys = await cloudGetKeys(cs);
        if (allKeys.length > 0) {
            await cloudRemoveItems(cs, allKeys);
        }
        pendingCloudWipe = false;
        await flushCloudSave();
        return;
    }

    // Случай 2: В облаке уже ЕСТЬ актуальный профиль после вайпа (например, игрок зашёл со второго устройства)
    if (cloudSnap) {
        const localScore = parseInt(localStorage.getItem(STORAGE_KEYS.HIGH_SCORE) || '0', 10) || 0;
        const localLevel = parseInt(localStorage.getItem(STORAGE_KEYS.LEVEL) || '1', 10) || 1;
        let cloudScore = 0;
        let cloudLevel = 1;
        try {
            const parsed = JSON.parse(cloudSnap);
            cloudScore = parseInt(parsed[STORAGE_KEYS.HIGH_SCORE] || '0', 10) || 0;
            cloudLevel = parseInt(parsed[STORAGE_KEYS.LEVEL] || '1', 10) || 1;
        } catch (e) {}

        if (pendingCloudWipe || cloudLevel > localLevel || cloudScore > localScore) {
            applyCloudSnapshot(cloudSnap);
            pendingCloudWipe = false;
            if (typeof onMerge === 'function') onMerge();
            cloudStatusText = 'Загружено из облака';
            return;
        }
    }

    pendingCloudWipe = false;
    await flushCloudSave();
}
