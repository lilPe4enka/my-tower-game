function reloadStateFromStorage() {
    coins = safeParseInt(safeGetItem(STORAGE_KEYS.COINS, '0'), 0);
    highScore = safeParseInt(safeGetItem(STORAGE_KEYS.HIGH_SCORE, '0'), 0);
    level = safeParseInt(safeGetItem(STORAGE_KEYS.LEVEL, '1'), 1);
    xpTotal = safeParseInt(safeGetItem(STORAGE_KEYS.XP, '0'), 0);
    streak = safeParseInt(safeGetItem(STORAGE_KEYS.STREAK, '0'), 0);
    lastVisitDate = safeGetItem(STORAGE_KEYS.LAST_VISIT, '') || '';

    currentSkin = safeGetItem(STORAGE_KEYS.SKIN, 'default') || 'default';
    unlockedSkins = validateArray(safeGetItem(STORAGE_KEYS.SKINS, ['default']), ['default']);
    currentPalette = safeGetItem(STORAGE_KEYS.PALETTE, 'standard') || 'standard';
    unlockedPalettes = validateArray(safeGetItem(STORAGE_KEYS.PALETTES, ['standard']), ['standard']);
    currentBackground = safeGetItem(STORAGE_KEYS.BACKGROUND, 'default') || 'default';
    unlockedBackgrounds = validateArray(safeGetItem(STORAGE_KEYS.BACKGROUNDS, ['default']), ['default']);
    unlockedFeatures = validateObject(safeGetItem(STORAGE_KEYS.FEATURES, {}), {});

    settings = { ...DEFAULT_SETTINGS, ...validateObject(safeGetItem(STORAGE_KEYS.SETTINGS, null), DEFAULT_SETTINGS) };
    stats = { ...DEFAULT_STATS, ...validateObject(safeGetItem(STORAGE_KEYS.STATS, null), DEFAULT_STATS) };
    totalScoreAllTime = safeParseInt(safeGetItem(STORAGE_KEYS.TOTAL_SCORE, '0'), 0);
    recentScores = validateArray(safeGetItem(STORAGE_KEYS.RECENT_SCORES, []), []);
    unlockedAchievements = validateArray(safeGetItem(STORAGE_KEYS.ACHIEVEMENTS, []), []);
    leaderboard = validateArray(safeGetItem(STORAGE_KEYS.LEADERBOARD, []), []);
    ownedPowerups = { ...DEFAULTS.POWERUPS, ...validateObject(safeGetItem(STORAGE_KEYS.POWERUPS, null), {}) };
    chests = validateArray(safeGetItem(STORAGE_KEYS.CHESTS, []), []);

    highScoreEl.innerText = `РЕКОРД: ${highScore}`;
    updateCoinUI();
    updateLevelUI();
    updateStreakUI();
    updateChestUI();
    updateSettingsUI();
    renderEventBanner();

    // Если игрок ещё не начал раунд, сразу применяем визуал из облака
    if (gameState === GAME_STATES.MENU) {
        applySkinEffect();
        applyBackground();
        if (currentMenuTab === 'shop') renderShop();
    }
    updateCloudStatusUI();
}

function updateCloudStatusUI() {
    const statusEl = $('cloud-sync-status');
    if (statusEl) statusEl.textContent = getCloudStatus();
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
