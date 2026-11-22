// cloud-storage.js — облачные сохранения через Telegram.WebApp.CloudStorage

import { safeGetItem, safeSetItem, safeParseInt, validateArray, validateObject } from './utils.js';
import { STORAGE_KEYS, DEFAULTS } from './constants.js';
import * as PrestigeMod from './prestige.js';
import * as EventsMod from './seasonal-events.js';

const PRESTIGE_COUNT_KEY = PrestigeMod.PRESTIGE_CONFIG?.STORAGE_KEY || 'towerPrestigeCount';
const PRESTIGE_BONUS_KEY = PrestigeMod.PRESTIGE_CONFIG?.BONUS_KEY || 'towerPrestigeBonus';
const MILESTONES_KEY = PrestigeMod.LEVEL_MILESTONE_CONFIG?.STORAGE_KEY || 'towerLevelMilestones';
const EVENTS_CLAIMED_KEY = EventsMod.EVENTS_CONFIG?.CLAIMED_KEY || 'towerEventRewardsClaimed';

const CLOUD_KEYS = {
    CORE: 'save_core',
    INVENTORY: 'save_inventory',
    META: 'save_meta',
};

const LOCAL_UPDATED_KEY = 'towerCloudUpdatedAt';
const MAX_KEY_BYTES = 3900;
const SAVE_DEBOUNCE_MS = 3500;

let saveTimer = null;
let isSyncing = false;
let lastCloudStatus = 'Локально (вне Telegram)';

export function isCloudStorageAvailable() {
    const tg = window.Telegram?.WebApp;
    return Boolean(tg && tg.CloudStorage && typeof tg.isVersionAtLeast === 'function' && tg.isVersionAtLeast('6.9'));
}

export function getCloudStatus() {
    return lastCloudStatus;
}

function getByteLength(str) {
    try {
        return new TextEncoder().encode(str).length;
    } catch (e) {
        return str.length * 2;
    }
}

function cloudGetItems(keys) {
    return new Promise((resolve) => {
        const tg = window.Telegram?.WebApp;
        if (!isCloudStorageAvailable()) return resolve(null);
        try {
            tg.CloudStorage.getItems(keys, (err, values) => {
                if (err) {
                    console.warn('[CloudStorage] Ошибка чтения:', err);
                    resolve(null);
                } else {
                    resolve(values || {});
                }
            });
        } catch (e) {
            console.warn('[CloudStorage] Исключение при чтении:', e);
            resolve(null);
        }
    });
}

function cloudSetItem(key, value) {
    return new Promise((resolve) => {
        const tg = window.Telegram?.WebApp;
        if (!isCloudStorageAvailable()) return resolve(false);
        try {
            tg.CloudStorage.setItem(key, value, (err, stored) => {
                if (err) {
                    console.warn(`[CloudStorage] Ошибка записи "${key}":`, err);
                    resolve(false);
                } else {
                    resolve(Boolean(stored));
                }
            });
        } catch (e) {
            console.warn(`[CloudStorage] Исключение при записи "${key}":`, e);
            resolve(false);
        }
    });
}

function parseJsonSafe(raw) {
    if (!raw || typeof raw !== 'string') return null;
    try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (e) {
        return null;
    }
}

function unionArrays(a, b) {
    return Array.from(new Set([...validateArray(a, []), ...validateArray(b, [])]));
}

function mergeEventRewards(a, b) {
    const objA = validateObject(a, {});
    const objB = validateObject(b, {});
    const result = { ...objA };
    for (const [k, list] of Object.entries(objB)) {
        result[k] = unionArrays(result[k], list);
    }
    return result;
}

function collectLocalPayload() {
    const updatedAt = safeParseInt(safeGetItem(LOCAL_UPDATED_KEY, '0'), 0);

    const core = {
        v: 1,
        t: updatedAt,
        c: safeParseInt(safeGetItem(STORAGE_KEYS.COINS, '0'), 0),
        hs: safeParseInt(safeGetItem(STORAGE_KEYS.HIGH_SCORE, '0'), 0),
        lv: safeParseInt(safeGetItem(STORAGE_KEYS.LEVEL, '1'), 1),
        xp: safeParseInt(safeGetItem(STORAGE_KEYS.XP, '0'), 0),
        st: safeParseInt(safeGetItem(STORAGE_KEYS.STREAK, '0'), 0),
        lvDate: safeGetItem(STORAGE_KEYS.LAST_VISIT, '') || '',
        sk: safeGetItem(STORAGE_KEYS.SKIN, 'default') || 'default',
        pl: safeGetItem(STORAGE_KEYS.PALETTE, 'standard') || 'standard',
        bg: safeGetItem(STORAGE_KEYS.BACKGROUND, 'default') || 'default',
        pr: safeParseInt(safeGetItem(PRESTIGE_COUNT_KEY, '0'), 0),
        prB: validateObject(safeGetItem(PRESTIGE_BONUS_KEY, {}), {}),
        set: { ...DEFAULTS.SETTINGS, ...validateObject(safeGetItem(STORAGE_KEYS.SETTINGS, {}), {}) },
    };

    const inventory = {
        v: 1,
        t: updatedAt,
        sks: validateArray(safeGetItem(STORAGE_KEYS.SKINS, ['default']), ['default']),
        pls: validateArray(safeGetItem(STORAGE_KEYS.PALETTES, ['standard']), ['standard']),
        bgs: validateArray(safeGetItem(STORAGE_KEYS.BACKGROUNDS, ['default']), ['default']),
        pw: { ...DEFAULTS.POWERUPS, ...validateObject(safeGetItem(STORAGE_KEYS.POWERUPS, {}), {}) },
        ach: validateArray(safeGetItem(STORAGE_KEYS.ACHIEVEMENTS, []), []),
        ft: validateObject(safeGetItem(STORAGE_KEYS.FEATURES, {}), {}),
        ms: validateArray(safeGetItem(MILESTONES_KEY, []), []),
        ev: validateObject(safeGetItem(EVENTS_CLAIMED_KEY, {}), {}),
    };

    const fullLb = validateArray(safeGetItem(STORAGE_KEYS.LEADERBOARD, []), []);
    const compactLb = [...fullLb]
        .sort((a, b) => (b.ts || 0) - (a.ts || 0))
        .slice(0, 35);

    const chests = validateArray(safeGetItem(STORAGE_KEYS.CHESTS, []), []).slice(0, 30);

    const meta = {
        v: 1,
        t: updatedAt,
        sts: validateObject(safeGetItem(STORAGE_KEYS.STATS, {}), {}),
        tot: safeParseInt(safeGetItem(STORAGE_KEYS.TOTAL_SCORE, '0'), 0),
        rec: validateArray(safeGetItem(STORAGE_KEYS.RECENT_SCORES, []), []).slice(-10),
        ch: chests,
        lb: compactLb,
    };

    return { core, inventory, meta };
}

function isFreshLocalProfile(local) {
    const games = local.meta.sts?.totalGames || 0;
    return games === 0
        && local.core.c === 0
        && local.core.lv <= 1
        && local.core.xp === 0
        && local.core.pr === 0
        && local.inventory.sks.length <= 1;
}

function applyPayloadToLocal({ core, inventory, meta }) {
    if (core) {
        safeSetItem(STORAGE_KEYS.COINS, core.c ?? 0);
        safeSetItem(STORAGE_KEYS.HIGH_SCORE, core.hs ?? 0);
        safeSetItem(STORAGE_KEYS.LEVEL, String(core.lv ?? 1));
        safeSetItem(STORAGE_KEYS.XP, String(core.xp ?? 0));
        safeSetItem(STORAGE_KEYS.STREAK, core.st ?? 0);
        safeSetItem(STORAGE_KEYS.LAST_VISIT, core.lvDate || '');
        safeSetItem(STORAGE_KEYS.SKIN, core.sk || 'default');
        safeSetItem(STORAGE_KEYS.PALETTE, core.pl || 'standard');
        safeSetItem(STORAGE_KEYS.BACKGROUND, core.bg || 'default');
        safeSetItem(PRESTIGE_COUNT_KEY, core.pr ?? 0);
        safeSetItem(PRESTIGE_BONUS_KEY, validateObject(core.prB, {}));
        safeSetItem(STORAGE_KEYS.SETTINGS, { ...DEFAULTS.SETTINGS, ...validateObject(core.set, {}) });
    }
    if (inventory) {
        safeSetItem(STORAGE_KEYS.SKINS, validateArray(inventory.sks, ['default']));
        safeSetItem(STORAGE_KEYS.PALETTES, validateArray(inventory.pls, ['standard']));
        safeSetItem(STORAGE_KEYS.BACKGROUNDS, validateArray(inventory.bgs, ['default']));
        safeSetItem(STORAGE_KEYS.POWERUPS, { ...DEFAULTS.POWERUPS, ...validateObject(inventory.pw, {}) });
        safeSetItem(STORAGE_KEYS.ACHIEVEMENTS, validateArray(inventory.ach, []));
        safeSetItem(STORAGE_KEYS.FEATURES, validateObject(inventory.ft, {}));
        safeSetItem(MILESTONES_KEY, validateArray(inventory.ms, []));
        safeSetItem(EVENTS_CLAIMED_KEY, validateObject(inventory.ev, {}));
    }
    if (meta) {
        safeSetItem(STORAGE_KEYS.STATS, validateObject(meta.sts, {}));
        safeSetItem(STORAGE_KEYS.TOTAL_SCORE, String(meta.tot ?? 0));
        safeSetItem(STORAGE_KEYS.RECENT_SCORES, validateArray(meta.rec, []));
        safeSetItem(STORAGE_KEYS.CHESTS, validateArray(meta.ch, []));
        safeSetItem(STORAGE_KEYS.LEADERBOARD, validateArray(meta.lb, []));
    }
    const ts = Math.max(core?.t || 0, inventory?.t || 0, meta?.t || 0, Date.now());
    safeSetItem(LOCAL_UPDATED_KEY, String(ts));
}

function mergePayloads(cloud, local) {
    const now = Date.now();

    if (isFreshLocalProfile(local)) {
        return {
            core: { ...local.core, ...cloud.core },
            inventory: { ...local.inventory, ...cloud.inventory },
            meta: { ...local.meta, ...cloud.meta },
        };
    }

    const cloudNewer = (cloud.core?.t || 0) > (local.core?.t || 0);
    const newerCore = cloudNewer ? cloud.core : local.core;
    const newerInv = (cloud.inventory?.t || 0) > (local.inventory?.t || 0) ? cloud.inventory : local.inventory;
    const newerMeta = (cloud.meta?.t || 0) > (local.meta?.t || 0) ? cloud.meta : local.meta;

    const cPr = cloud.core?.pr || 0;
    const lPr = local.core?.pr || 0;
    const cloudAhead = cPr > lPr
        || (cPr === lPr && (cloud.core?.lv || 1) > (local.core?.lv || 1))
        || (cPr === lPr && (cloud.core?.lv || 1) === (local.core?.lv || 1) && (cloud.core?.xp || 0) > (local.core?.xp || 0));
    const progCore = cloudAhead ? cloud.core : local.core;

    const mergedCore = {
        ...newerCore,
        t: now,
        hs: Math.max(cloud.core?.hs || 0, local.core?.hs || 0),
        pr: progCore.pr || 0,
        lv: progCore.lv || 1,
        xp: progCore.xp || 0,
        prB: {
            coinMult: Math.max(cloud.core?.prB?.coinMult || 0, local.core?.prB?.coinMult || 0),
            xpMult: Math.max(cloud.core?.prB?.xpMult || 0, local.core?.prB?.xpMult || 0),
            scoreMult: Math.max(cloud.core?.prB?.scoreMult || 0, local.core?.prB?.scoreMult || 0),
            allMult: Math.max(cloud.core?.prB?.allMult || 0, local.core?.prB?.allMult || 0),
        },
    };

    const mergedFeatures = { ...validateObject(cloud.inventory?.ft, {}), ...validateObject(local.inventory?.ft, {}) };
    for (const k of Object.keys(mergedFeatures)) {
        mergedFeatures[k] = Boolean(cloud.inventory?.ft?.[k] || local.inventory?.ft?.[k]);
    }

    const mergedInventory = {
        v: 1,
        t: now,
        sks: unionArrays(cloud.inventory?.sks, local.inventory?.sks),
        pls: unionArrays(cloud.inventory?.pls, local.inventory?.pls),
        bgs: unionArrays(cloud.inventory?.bgs, local.inventory?.bgs),
        pw: newerInv?.pw || local.inventory.pw,
        ach: unionArrays(cloud.inventory?.ach, local.inventory?.ach),
        ft: mergedFeatures,
        ms: unionArrays(cloud.inventory?.ms, local.inventory?.ms),
        ev: mergeEventRewards(cloud.inventory?.ev, local.inventory?.ev),
    };

    const mergedStats = { ...validateObject(cloud.meta?.sts, {}), ...validateObject(local.meta?.sts, {}) };
    for (const k of Object.keys(mergedStats)) {
        const a = Number(cloud.meta?.sts?.[k]) || 0;
        const b = Number(local.meta?.sts?.[k]) || 0;
        mergedStats[k] = Math.max(a, b);
    }

    const lbMap = new Map();
    [...validateArray(cloud.meta?.lb, []), ...validateArray(local.meta?.lb, [])].forEach((entry) => {
        if (entry && typeof entry.score === 'number') {
            const key = `${entry.mode}_${entry.ts || entry.date}_${entry.score}`;
            if (!lbMap.has(key)) lbMap.set(key, entry);
        }
    });
    const mergedLb = Array.from(lbMap.values())
        .sort((a, b) => (b.ts || 0) - (a.ts || 0))
        .slice(0, 35);

    const mergedMeta = {
        v: 1,
        t: now,
        sts: mergedStats,
        tot: Math.max(cloud.meta?.tot || 0, local.meta?.tot || 0),
        rec: newerMeta?.rec || local.meta.rec,
        ch: newerMeta?.ch || local.meta.ch,
        lb: mergedLb,
    };

    return { core: mergedCore, inventory: mergedInventory, meta: mergedMeta };
}

function serializeWithCap(obj, trimFn) {
    let str = JSON.stringify(obj);
    if (getByteLength(str) <= MAX_KEY_BYTES) return str;
    if (typeof trimFn === 'function') {
        const trimmed = trimFn(obj);
        str = JSON.stringify(trimmed);
    }
    return getByteLength(str) <= MAX_KEY_BYTES ? str : null;
}

export async function flushCloudSave() {
    if (saveTimer) {
        clearTimeout(saveTimer);
        saveTimer = null;
    }
    safeSetItem(LOCAL_UPDATED_KEY, String(Date.now()));

    if (!isCloudStorageAvailable() || isSyncing) return false;
    isSyncing = true;

    try {
        const { core, inventory, meta } = collectLocalPayload();

        const coreStr = serializeWithCap(core);
        const invStr = serializeWithCap(inventory);
        const metaStr = serializeWithCap(meta, (m) => ({
            ...m,
            lb: (m.lb || []).slice(0, 15),
            ch: (m.ch || []).slice(0, 15),
        }));

        const tasks = [];
        if (coreStr) tasks.push(cloudSetItem(CLOUD_KEYS.CORE, coreStr));
        if (invStr) tasks.push(cloudSetItem(CLOUD_KEYS.INVENTORY, invStr));
        if (metaStr) tasks.push(cloudSetItem(CLOUD_KEYS.META, metaStr));

        const results = await Promise.all(tasks);
        const ok = results.length > 0 && results.every(Boolean);
        lastCloudStatus = ok
            ? `Сохранено в ${new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`
            : 'Ошибка сохранения';
        return ok;
    } finally {
        isSyncing = false;
    }
}

export function scheduleCloudSave() {
    safeSetItem(LOCAL_UPDATED_KEY, String(Date.now()));
    if (!isCloudStorageAvailable()) return;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
        saveTimer = null;
        flushCloudSave();
    }, SAVE_DEBOUNCE_MS);
}

export async function initCloudSync(onMergedCallback) {
    if (!isCloudStorageAvailable()) {
        lastCloudStatus = 'Локально (вне Telegram)';
        return false;
    }

    lastCloudStatus = 'Синхронизация...';
    const raw = await cloudGetItems([CLOUD_KEYS.CORE, CLOUD_KEYS.INVENTORY, CLOUD_KEYS.META]);
    if (!raw) {
        lastCloudStatus = 'Нет связи с облаком';
        return false;
    }

    const cloudCore = parseJsonSafe(raw[CLOUD_KEYS.CORE]);
    const cloudInv = parseJsonSafe(raw[CLOUD_KEYS.INVENTORY]);
    const cloudMeta = parseJsonSafe(raw[CLOUD_KEYS.META]);
    const hasCloudData = Boolean(cloudCore || cloudInv || cloudMeta);

    const local = collectLocalPayload();

    if (!hasCloudData) {
        await flushCloudSave();
        return false;
    }

    const merged = mergePayloads(
        { core: cloudCore || {}, inventory: cloudInv || {}, meta: cloudMeta || {} },
        local
    );
    applyPayloadToLocal(merged);

    if (typeof onMergedCallback === 'function') {
        onMergedCallback();
    }

    await flushCloudSave();
    return true;
}
