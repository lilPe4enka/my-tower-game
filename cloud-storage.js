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
