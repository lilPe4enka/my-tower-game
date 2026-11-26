import * as THREE from 'three';

// ============ ИМПОРТЫ МОДУЛЕЙ ============
import { safeGetItem, safeSetItem, safeParseInt, PARTICLE_LIMITS, enforceParticleLimits, isAnyModalOpen, setupGlobalErrorHandler, validateArray, validateObject } from './utils.js?v=18';
import { GAME_CONFIG, LIMITS, GAME_MODES, GAME_STATES, GAME_MODE_NAMES, BLOCK_TYPES, BLOCK_COLORS, STORAGE_KEYS, DEFAULTS, xpForNextLevel, getAdaptiveD, CONFETTI_COLORS, FEATURE_NAMES } from './constants.js?v=18';
import { getComboTier, applyComboMultiplier, checkTierUpgrade, formatComboDisplay } from './combo-system.js?v=18';
import { applyTransition, getTransitionForScreen, staggerElements, flashTransition } from './transitions.js?v=18';
import { loadMissions, updateMissionProgress, claimMissionReward, getMissionsStats, formatMissionReward, getMissionProgress, getMissionRerollCost, rerollDailyMissions } from './missions.js?v=23';
import { getPrestigeCount, getPrestigeBonus, setPrestigeBonus, canPrestige, getPrestigeProgress, performPrestige, resetProgressForPrestige, rollPrestigeChestReward, applyPrestigeReward, formatPrestigeBonus, PRESTIGE_CONFIG, checkNewMilestones } from './prestige.js?v=18';
import { throttle, updateDOMText, updateDOMStyle, updateFpsCounter, getCurrentFps } from './performance.js?v=18';
import { saveLastFocus, restoreLastFocus, trapFocus, releaseFocusTrap, setupEscapeKeyHandler, removeEscapeKeyHandler, updateAriaAttributes, announceToScreenReader, addDecorativeStars, normalizeFontSizes, addCloseButtonToModal } from './accessibility.js?v=18';
import { getCurrentEvent, getEventProgress, getAvailableRewards, claimEventReward, getEventStats, formatEventDate, isEventsSystemActive } from './seasonal-events.js?v=18';
import { createEnvironmentParticles, updateEnvironmentParticles, getParticlesForBackground, removeEnvironmentParticles } from './environment-particles.js?v=18';
import { MINIGAMES, canPlayMinigame, recordMinigamePlay, getCooldownRemaining, getRemainingDailyPlays, formatCooldown, createMinigame, calculateMinigameReward } from './minigames.js?v=18';
import { runGlobalWipeIfNeeded, initCloudSync, scheduleCloudSave, flushCloudSave, getCloudStatus, isCloudStorageAvailable } from './cloud-storage.js?v=25';
import { UPGRADES, MAX_UPGRADE_LEVEL, loadUpgrades, getUpgradeLevel, getUpgradePrice, buyUpgrade, getUpgradeBonuses, getUpgradesProgress } from './upgrades.js?v=18';
import { canSpinWheel, getTimeUntilNextSpin, createWheelController } from './wheel.js?v=24';
import { initAtmosphereLayers, updateAtmosphereLayers, disposeAtmosphereLayers } from './atmosphere.js?v=18';

// Вынесенные модули
import { BASE_COLORS, SKINS, SKIN_RARITIES, PALETTES, BACKGROUNDS, SEASONS, DAILY_CHALLENGES, POWERUP_DEFS, QUESTS_POOL, getHeightComparison } from './game-data.js?v=25';
import { configureAudio, isAudioRunning, setMusicTempo, setWindVolume, initAudio, playSound, startMusic, stopMusic } from './audio.js?v=22';
import { SHARED_UNIT_BOX_GEO, PARTICLE_GEOS, getParticleMaterial, getDebrisMaterial, clearVisualCaches, createGlowTexture, createPerfectWaveTexture, createBlockMesh, disposeMesh } from './textures.js?v=25';
import { getContractById, getContractsForMode, createContractTracker, updateContractTracker, formatContractHUD } from './contracts.js?v=22';

setupGlobalErrorHandler();
const wipeResult = runGlobalWipeIfNeeded();

const MODE_ANTIGRAVITY = 'antigravity';
const CAMERA_RADIUS = Math.hypot(12, 12);

const CFG = {
    BLOCK_SIZE: GAME_CONFIG?.BLOCK_SIZE ?? 4,
    BLOCK_HEIGHT: GAME_CONFIG?.BLOCK_HEIGHT ?? 0.6,
    BASE_SPEED: GAME_CONFIG?.BASE_SPEED ?? 0.12,
    DEFAULT_MAX_SPEED: GAME_CONFIG?.DEFAULT_MAX_SPEED ?? 0.34,
    ENDLESS_MAX_SPEED: GAME_CONFIG?.ENDLESS_MAX_SPEED ?? 0.48,
    MOVE_RANGE: GAME_CONFIG?.MOVE_RANGE ?? GAME_CONFIG?.SPAWN_DISTANCE ?? 6.5,
    SPEED_INCREMENT: GAME_CONFIG?.SPEED_INCREMENT ?? 0.004,
    PERFECT_THRESHOLD: GAME_CONFIG?.PERFECT_THRESHOLD ?? 0.15,
    FURY_THRESHOLD: GAME_CONFIG?.FURY_THRESHOLD ?? 5,
    FURY_BLOCKS: GAME_CONFIG?.FURY_BLOCKS ?? 3,
    DEFAULT_TIME_LIMIT: GAME_CONFIG?.DEFAULT_TIME_LIMIT ?? 60,
    COINS_LEVEL_UP: GAME_CONFIG?.COINS_LEVEL_UP ?? 50,
    MUSIC_BASE_TEMPO: GAME_CONFIG?.MUSIC_BASE_TEMPO ?? 110,
    MUSIC_PHASE_2_SCORE: GAME_CONFIG?.MUSIC_PHASE_2_SCORE ?? 15,
    MUSIC_PHASE_3_SCORE: GAME_CONFIG?.MUSIC_PHASE_3_SCORE ?? 35,
    SECOND_CHANCE_COST: GAME_CONFIG?.SECOND_CHANCE_COST ?? 50,
    SECOND_CHANCE_MIN_SCORE: GAME_CONFIG?.SECOND_CHANCE_MIN_SCORE ?? 15,
    SECOND_CHANCE_NEAR_RECORD: GAME_CONFIG?.SECOND_CHANCE_NEAR_RECORD ?? 5,
    SECOND_CHANCE_DURATION: GAME_CONFIG?.SECOND_CHANCE_DURATION ?? 5000,
};

function safeGetAdaptiveD(aspect) {
    try {
        const val = typeof getAdaptiveD === 'function' ? getAdaptiveD(aspect) : 10;
        if (Number.isFinite(val) && val > 0) return val;
    } catch (e) {}
    return aspect < 0.7 ? 12 : 9;
}

// ============ TELEGRAM & HAPTICS ============
const TELEGRAM_APP_URL = 'https://t.me/YOUR_BOT_USERNAME/app';
const tg = window.Telegram?.WebApp;

if (tg) {
    try {
        tg.ready();
        tg.expand();
        if (tg.isVersionAtLeast('7.7')) tg.disableVerticalSwipes();
        tg.onEvent('viewportChanged', () => { if (typeof onResize === 'function') onResize(); });
    } catch (err) {}
}

function syncTelegramSafeAreas() {
    const root = document.documentElement;
    const safeTop = tg?.safeAreaInset?.top || 0;
    let contentTop = tg?.contentSafeAreaInset?.top || 0;
    const safeBottom = tg?.safeAreaInset?.bottom || 0;
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent) || tg?.platform === 'ios';
    if (tg && contentTop === 0 && (tg.isFullscreen || isIOS)) contentTop = 48;
    if (safeTop > 0) root.style.setProperty('--safe-top', `${safeTop}px`);
    root.style.setProperty('--tg-content-top', `${contentTop}px`);
    if (safeBottom > 0) root.style.setProperty('--safe-bottom', `${safeBottom}px`);
}

function syncTelegramTheme(hexColor) {
    if (!tg || !hexColor) return;
    try {
        if (typeof tg.setHeaderColor === 'function' && tg.isVersionAtLeast('6.1')) tg.setHeaderColor(hexColor);
        if (typeof tg.setBackgroundColor === 'function' && tg.isVersionAtLeast('6.1')) tg.setBackgroundColor(hexColor);
        if (typeof tg.setBottomBarColor === 'function' && tg.isVersionAtLeast('7.10')) tg.setBottomBarColor(hexColor);
    } catch (e) {}
}

syncTelegramSafeAreas();
if (tg?.onEvent) {
    tg.onEvent('safeAreaChanged', syncTelegramSafeAreas);
    tg.onEvent('contentSafeAreaChanged', syncTelegramSafeAreas);
    tg.onEvent('viewportChanged', syncTelegramSafeAreas);
}

function updateTelegramBackButton() {
    if (!tg?.BackButton || !tg.isVersionAtLeast('6.1')) return;
    const hasOpenModal = Boolean(document.querySelector('.screen.modal.open'));
    const inGame = gameState === GAME_STATES.PLAYING || gameState === GAME_STATES.PAUSED;
    const onSubTab = gameState === GAME_STATES.MENU && currentMenuTab !== 'play';
    if (hasOpenModal || inGame || onSubTab) tg.BackButton.show();
    else tg.BackButton.hide();
}

if (tg?.BackButton && tg.isVersionAtLeast('6.1')) {
    tg.BackButton.onClick(() => {
        const openModal = document.querySelector('.screen.modal.open');
        if (openModal) handleModalDismiss(openModal);
        else if (gameState === GAME_STATES.PLAYING || gameState === GAME_STATES.PAUSED) togglePause();
        else if (gameState === GAME_STATES.MENU && currentMenuTab !== 'play') switchMenuTab('play');
    });
}

function triggerHaptic(type = 'light') {
    if (!settings.hapticsEnabled) return;
    try {
        if (tg?.HapticFeedback) {
            if (type === 'error') tg.HapticFeedback.notificationOccurred('error');
            else if (type === 'success') tg.HapticFeedback.notificationOccurred('success');
            else tg.HapticFeedback.impactOccurred(type);
        } else if (navigator.vibrate) {
            if (type === 'error') navigator.vibrate([100, 50, 100]);
            else navigator.vibrate(50);
        }
    } catch (err) {}
}

function safeClick(el, handler) {
    if (!el) return;
    let lastFire = 0;
    el.addEventListener('click', (e) => {
        const now = Date.now();
        if (now - lastFire < 300) return;
        lastFire = now;
        if (isAudioRunning()) playSound('ui_click');
        if (e.cancelable !== false) e.stopPropagation();
        try { handler(e); } catch (err) { console.error('Handler:', err); }
    });
}

// ============ МОДАЛКИ ============
function handleModalDismiss(el) {
    if (el === secondChanceOverlay && secondChanceActive) { declineSecondChance(); return; }
    if (el === pauseScreen && gameState === GAME_STATES.PAUSED) { togglePause(); return; }
    if (el === gameOverEl) { goToMenu(); return; }
    if (el === powerupsScreen) { pendingGameMode = null; selectedContractId = null; }
    if (el === minigamesScreen) { stopActiveMinigame(); stopMinigamesCooldownTimer(); }
    if (el === wheelScreen && wheelTimerInterval) { clearInterval(wheelTimerInterval); wheelTimerInterval = null; }
    hideModal(el);
}

async function showModal(el) {
    if (!el || el.classList.contains('open')) return;
    saveLastFocus();
    const transitionType = getTransitionForScreen(el.id);
    el.classList.add('open');
    updateTelegramBackButton();
    await applyTransition(el, transitionType, 'in');
    updateAriaAttributes(el, true);
    const modalContent = el.querySelector('.modal-content');
    if (modalContent) {
        trapFocus(modalContent);
        addCloseButtonToModal(modalContent, () => handleModalDismiss(el));
        const animEls = modalContent.querySelectorAll('.ach-item, .skin-item, .customize-item, .powerup-item, .lb-attempt, .quest-chip, .mission-item, .event-reward-item');
        if (animEls.length > 0 && animEls.length < 30) staggerElements(animEls, 40);
    }
    setupEscapeKeyHandler(el, () => handleModalDismiss(el));
    const title = el.querySelector('h1, h2');
    if (title) announceToScreenReader(`Открыто: ${title.textContent}`);
    if (['chest-screen', 'daily-screen', 'prestige-confirm-screen'].includes(el.id) && modalContent) {
        addDecorativeStars(modalContent, 15);
    }
    playSound('screen_transition');
}

async function hideModal(el, { restoreMenu = true } = {}) {
    if (!el || !el.classList.contains('open')) return;
    const transitionType = getTransitionForScreen(el.id);
    await applyTransition(el, transitionType, 'out');
    el.classList.remove('open');
    updateAriaAttributes(el, false);
    const modalContent = el.querySelector('.modal-content');
    if (modalContent) releaseFocusTrap(modalContent);
    removeEscapeKeyHandler(el);
    restoreLastFocus();
    if (restoreMenu && gameState === GAME_STATES.MENU && !document.querySelector('.screen.modal.open')) {
        startScreen.style.display = 'flex';
        updateCoinUI();
    }
    updateTelegramBackButton();
}

// ============ ДОСТИЖЕНИЯ ============
let currentAchCategory = 'all';

const ACHIEVEMENTS = [
    // Общие
    { id: 'first_tower', category: 'general', name: 'Первая башня', desc: 'Построй 5 этажей', icon: '🏗️', reward: 20, check: () => stats.maxScore >= 5 },
    { id: 'score_10', category: 'general', name: 'Новичок', desc: '10 очков в любой игре', icon: '🌱', reward: 25, check: () => stats.maxScore >= 10 },
    { id: 'score_25', category: 'general', name: 'Строитель', desc: '25 очков в любой игре', icon: '🏠', reward: 40, check: () => stats.maxScore >= 25 },
    { id: 'score_50', category: 'general', name: 'Мастер', desc: '50 очков в любой игре', icon: '🏰', reward: 80, check: () => stats.maxScore >= 50 },
    { id: 'score_100', category: 'general', name: 'Легенда', desc: '100 очков в любой игре', icon: '👑', reward: 150, check: () => stats.maxScore >= 100 },
    { id: 'score_200', category: 'general', name: 'Небоскрёб', desc: '200 очков в любой игре', icon: '🌆', reward: 300, check: () => stats.maxScore >= 200 },
    { id: 'combo_3', category: 'general', name: 'Мастер серий', desc: 'Серия x3', icon: '🔥', reward: 25, check: () => stats.maxCombo >= 3 },
    { id: 'combo_5', category: 'general', name: 'Огненный', desc: 'Серия x5', icon: '💥', reward: 50, check: () => stats.maxCombo >= 5 },
    { id: 'combo_10', category: 'general', name: 'Метроном', desc: 'Серия x10 подряд', icon: '⚡', reward: 120, check: () => stats.maxCombo >= 10 },
    { id: 'combo_20', category: 'general', name: 'Киборг', desc: 'Серия x20 подряд', icon: '🤖', reward: 250, check: () => stats.maxCombo >= 20 },
    { id: 'perfect_50', category: 'general', name: 'Снайпер', desc: '50 идеальных попаданий', icon: '🎯', reward: 50, check: () => stats.totalPerfect >= 50 },
    { id: 'perfect_200', category: 'general', name: 'Точность', desc: '200 идеалов → золотой след', icon: '🎪', reward: 200, feature: 'goldenTrail', check: () => stats.totalPerfect >= 200 },
    { id: 'games_10', category: 'general', name: 'Игрок', desc: 'Сыграй 10 игр', icon: '🎮', reward: 30, check: () => stats.totalGames >= 10 },
    { id: 'games_50', category: 'general', name: 'Заядлый', desc: 'Сыграй 50 игр', icon: '🎲', reward: 100, check: () => stats.totalGames >= 50 },
    { id: 'fury_1', category: 'general', name: 'В ярости', desc: 'Активируй ярость', icon: '😡', reward: 30, check: () => stats.totalFury >= 1 },
    { id: 'fury_10', category: 'general', name: 'Берсерк', desc: '10 яростей → красная тема', icon: '👹', reward: 150, feature: 'redTheme', check: () => stats.totalFury >= 10 },
    { id: 'golden_5', category: 'general', name: 'Король золота', desc: '5 идеальных золотых блоков', icon: '💎', reward: 40, check: () => stats.totalGolden >= 5 },
    { id: 'bomb_5', category: 'general', name: 'Сапёр', desc: '5 идеальных бомб', icon: '💣', reward: 50, check: () => stats.totalBomb >= 5 },
    { id: 'ice_5', category: 'general', name: 'Ледокол', desc: '5 идеальных льдов', icon: '❄️', reward: 40, check: () => stats.totalIce >= 5 },
    { id: 'secret_1', category: 'general', name: 'Тайна', desc: 'Поймай секретный блок', icon: '🌟', reward: 40, check: () => stats.totalSecret >= 1 },
    { id: 'secret_10', category: 'general', name: 'Охотник', desc: '10 секретных блоков', icon: '🔮', reward: 120, check: () => stats.totalSecret >= 10 },

    // По режимам
    { id: 'classic_20', category: 'classic', name: 'Классик', desc: '20 очков в «Классике»', icon: '🎮', reward: 40, check: () => (stats.modeMax?.classic || 0) >= 20 },
    { id: 'classic_50', category: 'classic', name: 'Архитектор', desc: '50 очков в «Классике»', icon: '🏛️', reward: 90, check: () => (stats.modeMax?.classic || 0) >= 50 },
    { id: 'classic_100', category: 'classic', name: 'Гранд-архитектор', desc: '100 очков в «Классике»', icon: '🗼', reward: 200, check: () => (stats.modeMax?.classic || 0) >= 100 },

    { id: 'time_20', category: 'time', name: 'Спринтер', desc: '20 очков в «На время»', icon: '⏱', reward: 40, check: () => (stats.modeMax?.time || 0) >= 20 },
    { id: 'time_45', category: 'time', name: 'Молния', desc: '45 очков в «На время»', icon: '⚡', reward: 100, check: () => (stats.modeMax?.time || 0) >= 45 },
    { id: 'time_80', category: 'time', name: 'Повелитель секунд', desc: '80 очков в «На время»', icon: '⏳', reward: 220, check: () => (stats.modeMax?.time || 0) >= 80 },

    { id: 'precision_10', category: 'precision', name: 'Без права на ошибку', desc: '10 очков в «Точности»', icon: '🎯', reward: 60, check: () => (stats.modeMax?.precision || 0) >= 10 },
    { id: 'precision_25', category: 'precision', name: 'Хирург', desc: '25 очков в «Точности»', icon: '🩺', reward: 140, check: () => (stats.modeMax?.precision || 0) >= 25 },
    { id: 'precision_50', category: 'precision', name: 'Абсолютный лазер', desc: '50 очков в «Точности»', icon: '💎', reward: 300, check: () => (stats.modeMax?.precision || 0) >= 50 },

    { id: 'storm_15', category: 'storm', name: 'Против ветра', desc: '15 очков в «Шторме»', icon: '🌪', reward: 50, check: () => (stats.modeMax?.storm || 0) >= 15 },
    { id: 'storm_35', category: 'storm', name: 'Укротитель бури', desc: '35 очков в «Шторме»', icon: '🌩️', reward: 120, check: () => (stats.modeMax?.storm || 0) >= 35 },
    { id: 'storm_70', category: 'storm', name: 'Око урагана', desc: '70 очков в «Шторме»', icon: '🌀', reward: 250, check: () => (stats.modeMax?.storm || 0) >= 70 },

    { id: 'endless_30', category: 'endless', name: 'Марафонец', desc: '30 очков в «Бесконечном»', icon: '♾️', reward: 50, check: () => (stats.modeMax?.endless || 0) >= 30 },
    { id: 'endless_75', category: 'endless', name: 'Стальной ритм', desc: '75 очков в «Бесконечном»', icon: '🚀', reward: 140, check: () => (stats.modeMax?.endless || 0) >= 75 },
    { id: 'endless_150', category: 'endless', name: 'За гранью скорости', desc: '150 очков в «Бесконечном»', icon: '🌌', reward: 300, check: () => (stats.modeMax?.endless || 0) >= 150 },

    { id: 'mirror_15', category: 'mirror', name: 'Зазеркалье', desc: '15 очков в «Зеркальном»', icon: '🪞', reward: 50, check: () => (stats.modeMax?.mirror || 0) >= 15 },
    { id: 'mirror_35', category: 'mirror', name: 'Мастер отражений', desc: '35 очков в «Зеркальном»', icon: '✨', reward: 120, check: () => (stats.modeMax?.mirror || 0) >= 35 },
    { id: 'mirror_65', category: 'mirror', name: 'Король зеркал', desc: '65 очков в «Зеркальном»', icon: '👑', reward: 240, check: () => (stats.modeMax?.mirror || 0) >= 65 },

    { id: 'antigrav_15', category: 'antigravity', name: 'Выход на орбиту', desc: '15 очков в «Антигравитации»', icon: '🪐', reward: 60, check: () => (stats.modeMax?.antigravity || 0) >= 15 },
    { id: 'antigrav_40', category: 'antigravity', name: 'Невесомость', desc: '40 очков в «Антигравитации»', icon: '👨‍🚀', reward: 150, check: () => (stats.modeMax?.antigravity || 0) >= 40 },
    { id: 'antigrav_75', category: 'antigravity', name: 'Властелин орбит', desc: '75 очков в «Антигравитации»', icon: '🌌', reward: 280, check: () => (stats.modeMax?.antigravity || 0) >= 75 },

    // Прогресс
    { id: 'skins_3', category: 'progress', name: 'Коллекционер', desc: 'Открой 3 облика', icon: '🎨', reward: 40, check: () => unlockedSkins.length >= 3 },
    { id: 'skins_10', category: 'progress', name: 'Модник', desc: 'Открой 10 обликов', icon: '🧥', reward: 120, check: () => unlockedSkins.length >= 10 },
    { id: 'skins_all', category: 'progress', name: 'Все облики', desc: 'Собери все основные облики', icon: '🏆', reward: 500, special: 'legend', check: () => {
        const buyable = Object.keys(SKINS).filter(k => k !== 'legend' && !SKINS[k].notBuyable && !SKINS[k].wheelOnly && !SKINS[k].exclusiveOnly && !SKINS[k].prestigeOnly && !SKINS[k].eventOnly);
        return buyable.every(k => unlockedSkins.includes(k));
    }},
    { id: 'rich_500', category: 'progress', name: 'Богач', desc: 'Накопи 500 монет', icon: '💰', reward: 50, check: () => coins >= 500 },
    { id: 'rich_3000', category: 'progress', name: 'Магнат', desc: 'Накопи 3000 монет', icon: '🏦', reward: 200, check: () => coins >= 3000 },
    { id: 'level_10', category: 'progress', name: 'Ветеран', desc: 'Достигни 10 уровня', icon: '🌟', reward: 80, check: () => level >= 10 },
    { id: 'level_25', category: 'progress', name: 'Элита', desc: 'Достигни 25 уровня', icon: '🎖️', reward: 180, check: () => level >= 25 },
    { id: 'daily_1', category: 'progress', name: 'Испытатель', desc: 'Пройди 1 испытание дня', icon: '📅', reward: 30, check: () => stats.dailyCompleted >= 1 },
    { id: 'daily_10', category: 'progress', name: 'Мастер испытаний', desc: 'Пройди 10 испытаний дня', icon: '🏹', reward: 120, check: () => stats.dailyCompleted >= 10 },
    { id: 'prestige_1', category: 'progress', name: 'Перерождение', desc: 'Выполни 1 престиж', icon: '⭐', reward: 250, check: () => getPrestigeCount() >= 1 },
    { id: 'missions_10', category: 'progress', name: 'Миссионер', desc: 'Выполни 10 миссий дня', icon: '📋', reward: 150, check: () => stats.missionsCompleted >= 10 },
    { id: 'event_1', category: 'progress', name: 'Участник', desc: 'Забери награду из события', icon: '🎉', reward: 100, check: () => stats.eventsRewards >= 1 },
    { id: 'wheel_5', category: 'progress', name: 'Везунчик', desc: 'Крутани Колесо удачи 5 раз', icon: '🎡', reward: 100, check: () => (stats.wheelSpins || 0) >= 5 },
    { id: 'minigames_5', category: 'progress', name: 'Аркадник', desc: 'Выиграй 5 мини-игр', icon: '🕹️', reward: 100, check: () => (stats.minigamesWon || 0) >= 5 },
    { id: 'upgrades_5', category: 'progress', name: 'Инженер', desc: 'Купи 5 постоянных апгрейдов', icon: '🔧', reward: 120, check: () => (stats.upgradesBought || 0) >= 5 },
    { id: 'contracts_3', category: 'progress', name: 'Наёмник', desc: 'Выполни 3 контракта', icon: '📜', reward: 150, check: () => (stats.contractsWon || 0) >= 3 },
];

// ============ STATE ============
const IS_MOBILE = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || window.innerWidth < 768;
let lowPerfMode = false, lastPerfCheck = 0, lowFpsStrikes = 0, rafId = null;

const BLOCK_SIZE = CFG.BLOCK_SIZE;
const BLOCK_HEIGHT = CFG.BLOCK_HEIGHT;
const BASE_SPEED = CFG.BASE_SPEED;

let dynamicMaxSpeed = CFG.DEFAULT_MAX_SPEED;
let scene, camera, renderer;
let bgStarsGroup = null;
let blocks = [], debris = [], confetti = [], perfectWaves = [];
let currentBlock, nextBlockData, direction = 1;
let score = 0, combo = 0, runPerfects = 0;
let runStartPerfects = 0, runStartBroken = false;

let cameraAngle = Math.PI / 4;
let targetCameraAngle = Math.PI / 4;

let selectedContractId = null;
let activeContract = null;

let coins = safeParseInt(safeGetItem(STORAGE_KEYS.COINS, '0'), 0);
let sessionCoins = 0, sessionXP = 0;
let highScore = safeParseInt(safeGetItem(STORAGE_KEYS.HIGH_SCORE, '0'), 0);
let bestHeight = safeParseInt(safeGetItem('towerBestHeight', String(highScore)), highScore);
let recordLineGroup = null, recordLinePassed = false;

let currentSkin = (typeof safeGetItem(STORAGE_KEYS.SKIN, 'default') === 'string') ? safeGetItem(STORAGE_KEYS.SKIN, 'default') : 'default';
if (!SKINS[currentSkin]) currentSkin = 'default';
let unlockedSkins = validateArray(safeGetItem(STORAGE_KEYS.SKINS, ['default']), ['default']);
let currentPalette = (typeof safeGetItem(STORAGE_KEYS.PALETTE, 'standard') === 'string') ? safeGetItem(STORAGE_KEYS.PALETTE, 'standard') : 'standard';
let unlockedPalettes = validateArray(safeGetItem(STORAGE_KEYS.PALETTES, ['standard']), ['standard']);
let currentBackground = (typeof safeGetItem(STORAGE_KEYS.BACKGROUND, 'default') === 'string') ? safeGetItem(STORAGE_KEYS.BACKGROUND, 'default') : 'default';
let unlockedBackgrounds = validateArray(safeGetItem(STORAGE_KEYS.BACKGROUNDS, ['default']), ['default']);
let unlockedFeatures = validateObject(safeGetItem(STORAGE_KEYS.FEATURES, {}), {});

let gameState = GAME_STATES.MENU, gameMode = GAME_MODES.CLASSIC;
let currentMenuTab = 'play', currentShopTab = 'skins';
let windStrength = 0, windDirection = 1, windGustTimer = null;
let movingAxis = 'x', currentSpeed = BASE_SPEED, currentBaseSize = BLOCK_SIZE;
let perfectWaveTexture = null, glowTexture = null;
let currentBiomeIndex = 0, targetBgColor = new THREE.Color(BACKGROUNDS.default.colors[0]);
let shakeIntensity = 0, cameraZoomPulse = 0;
let timeLeft = CFG.DEFAULT_TIME_LIMIT, timeAttackTimer = null;
let showTutorialHint = !safeGetItem(STORAGE_KEYS.TUTORIAL_SHOWN, false);
let clock = new THREE.Clock();
let newQuestsTimeout = null, quests = [];
let isFury = false, furyBlocksLeft = 0;
let dailyModifiers = {}, dailyChallengeActive = false;
let savedBgBeforeDaily = null, savedPaletteBeforeDaily = null;
let currentLbMode = GAME_MODES.CLASSIC;

let secondChanceUsed = false, secondChanceActive = false, secondChanceEndTime = 0, secondChanceRaf = null;
let overviewActive = false, overviewTargetZoom = 1, overviewTargetY = 0, overviewSkipped = false, overviewSkipReadyAt = 0;
let wheelController = null, wheelTimerInterval = null;

const DEFAULT_SETTINGS = { ...DEFAULTS.SETTINGS };
const DEFAULT_STATS = { ...DEFAULTS.STATS, missionsCompleted: 0, eventsRewards: 0, contractsWon: 0 };

let settings = { ...DEFAULT_SETTINGS, ...validateObject(safeGetItem(STORAGE_KEYS.SETTINGS, null), DEFAULT_SETTINGS) };
function saveSettings() { safeSetItem(STORAGE_KEYS.SETTINGS, settings); scheduleCloudSave(); }

let stats = { ...DEFAULT_STATS, ...validateObject(safeGetItem(STORAGE_KEYS.STATS, null), DEFAULT_STATS) };
if (!stats.modeMax || typeof stats.modeMax !== 'object') stats.modeMax = {};
if (!stats.modeGames || typeof stats.modeGames !== 'object') stats.modeGames = {};
if (stats.wheelSpins === undefined) stats.wheelSpins = 0;
if (stats.minigamesWon === undefined) stats.minigamesWon = 0;
if (stats.upgradesBought === undefined) stats.upgradesBought = 0;
if (stats.contractsWon === undefined) stats.contractsWon = 0;
function saveStats() { safeSetItem(STORAGE_KEYS.STATS, stats); scheduleCloudSave(); }

let totalScoreAllTime = safeParseInt(safeGetItem(STORAGE_KEYS.TOTAL_SCORE, '0'), 0);
function saveTotalScore() { safeSetItem(STORAGE_KEYS.TOTAL_SCORE, String(totalScoreAllTime)); }

let recentScores = validateArray(safeGetItem(STORAGE_KEYS.RECENT_SCORES, []), []);
function saveRecentScores() { safeSetItem(STORAGE_KEYS.RECENT_SCORES, recentScores); }

let unlockedAchievements = validateArray(safeGetItem(STORAGE_KEYS.ACHIEVEMENTS, []), []);
function saveAchievements() { safeSetItem(STORAGE_KEYS.ACHIEVEMENTS, unlockedAchievements); scheduleCloudSave(); }

let xpTotal = safeParseInt(safeGetItem(STORAGE_KEYS.XP, '0'), 0);
let level = safeParseInt(safeGetItem(STORAGE_KEYS.LEVEL, '1'), 1);
function saveLevelProgress() { safeSetItem(STORAGE_KEYS.XP, String(xpTotal)); safeSetItem(STORAGE_KEYS.LEVEL, String(level)); scheduleCloudSave(); }

let streak = safeParseInt(safeGetItem(STORAGE_KEYS.STREAK, '0'), 0);
let lastVisitDate = safeGetItem(STORAGE_KEYS.LAST_VISIT, '') || '';
let dailyRewardPending = false, dailyRewardAmount = 0;
let leaderboard = validateArray(safeGetItem(STORAGE_KEYS.LEADERBOARD, []), []);
function saveLeaderboard() { safeSetItem(STORAGE_KEYS.LEADERBOARD, leaderboard); }
leaderboard.forEach(e => { if (e.mode && e.score > (stats.modeMax[e.mode] || 0)) stats.modeMax[e.mode] = e.score; });

let ownedPowerups = { ...DEFAULTS.POWERUPS, ...validateObject(safeGetItem(STORAGE_KEYS.POWERUPS, null), {}) };
function savePowerups() { safeSetItem(STORAGE_KEYS.POWERUPS, ownedPowerups); scheduleCloudSave(); }

let activePowerups = { ...DEFAULTS.ACTIVE_POWERUPS };
let lastUsedPowerups = { ...DEFAULTS.ACTIVE_POWERUPS };
let pendingGameMode = null, gameOverTimers = [];
function clearGameOverTimers() { gameOverTimers.forEach(id => clearTimeout(id)); gameOverTimers = []; }

let chests = validateArray(safeGetItem(STORAGE_KEYS.CHESTS, []), []);
function saveChests() { safeSetItem(STORAGE_KEYS.CHESTS, chests); scheduleCloudSave(); }

let missions = [], missionsTimerInterval = null;
let currentEvent = null, eventNotificationInterval = null;
let activeMinigame = null, minigamesCooldownInterval = null;
let pendingPrestigeRewards = [];

configureAudio({
    isSfxEnabled: () => settings.sfxEnabled,
    isMusicEnabled: () => settings.musicEnabled,
    isPlaying: () => gameState === GAME_STATES.PLAYING,
    getMusicPhase: () => (isFury ? 4 : score >= CFG.MUSIC_PHASE_3_SCORE ? 3 : score >= CFG.MUSIC_PHASE_2_SCORE ? 2 : 1),
});

function getCurrentSeason() { const m = new Date().getMonth() + 1; return SEASONS.find(s => s.months.includes(m)) || SEASONS[0]; }
function getSkinModifiers() { return (SKINS[currentSkin] && SKINS[currentSkin].modifiers) || {}; }
function getPaletteColors() { return (PALETTES[currentPalette] || PALETTES.standard).colors; }
function getBgColors() { return (BACKGROUNDS[currentBackground] || BACKGROUNDS.default).colors; }

// ============ DOM ============
const $ = id => document.getElementById(id);
const splashScreen = $('splash-screen'), restartPowerupsBtn = $('restart-powerups-btn');
const scoreEl = $('score'), highScoreEl = $('high-score'), gameCoinsEl = $('game-coins');
const gameOverEl = $('game-over'), pauseScreen = $('pause-screen'), rulesScreen = $('rules-screen'), startScreen = $('start-screen');
const achScreen = $('achievements-screen'), lbScreen = $('leaderboard-screen'), settingsScreen = $('settings-screen'), dailyScreen = $('daily-screen');
const powerupsScreen = $('powerups-screen'), chestScreen = $('chest-screen');
const prestigeConfirmScreen = $('prestige-confirm-screen'), prestigeChestScreen = $('prestige-chest-screen'), eventScreen = $('event-screen');
const minigamesScreen = $('minigames-screen'), minigamesStatusEl = $('minigames-status'), minigamesListEl = $('minigames-list'), minigameStageEl = $('minigame-stage'), minigameResultEl = $('minigame-result');
const upgradesListEl = $('upgrades-list'), contractListEl = $('contract-list'), contractHudEl = $('contract-hud');
const wheelScreen = $('wheel-screen'), wheelCanvas = $('wheel-canvas'), wheelStatusEl = $('wheel-status'), wheelResultEl = $('wheel-result'), wheelSpinBtn = $('wheel-spin-btn'), wheelBannerDescEl = $('wheel-banner-desc'), wheelBannerDotEl = $('wheel-banner-dot');
const rerollMissionsBtn = $('reroll-missions-btn');
const secondChanceOverlay = $('second-chance-overlay'), secondChanceSubEl = $('second-chance-sub'), secondChanceTimerFill = $('second-chance-timer-fill'), secondChanceBuyBtn = $('second-chance-buy'), secondChanceSkipBtn = $('second-chance-skip');
const towerHeightBanner = $('tower-height-banner'), towerHeightMetersEl = $('tower-height-meters'), towerHeightCompareEl = $('tower-height-compare'), gameOverHeightEl = $('game-over-height');
const perfectText = $('perfect-text'), comboText = $('combo-text'), milestoneText = $('milestone-text'), bonusText = $('bonus-text'), levelupPopup = $('levelup-popup'), achievementPopup = $('achievement-popup');
const finalScoreVal = $('final-score-val'), gameCoinsEarnedEl = $('game-coins-earned'), gameXPEarnedEl = $('game-xp-earned');
const timerEl = $('timer'), modeLabel = $('mode-label'), windIndicatorEl = $('wind-indicator'), windFillEl = $('wind-fill');
const questsEl = $('quests'), muteBtn = $('mute-btn'), pauseBtn = $('pause-btn'), menuToggleBtn = $('menu-toggle-btn'), tutorialEl = $('tutorial'), screenFlash = $('screen-flash');
const skinListEl = $('skin-list'), menuCoinsEl = $('menu-coins'), shopProgressEl = $('shop-progress'), colorsListEl = $('colors-list'), backgroundsListEl = $('backgrounds-list');
const achListEl = $('ach-list'), achProgressEl = $('ach-progress');
const menuLevelNum = $('menu-level-num'), menuXPFill = $('menu-xp-fill'), menuXPText = $('menu-xp-text'), menuStreakEl = $('menu-streak');
const dailyStreakText = $('daily-streak-text'), dailyCoinsReward = $('daily-coins-reward'), dailySubText = $('daily-sub-text'), activePowerupsEl = $('active-powerups');
const dailyBannerEl = $('daily-challenge-banner'), dailyNameEl = $('daily-name'), dailyDescEl = $('daily-desc'), dailyIconEl = $('daily-icon'), dailyPlayBtn = $('daily-play-btn');
const seasonPillEl = $('season-pill'), victoryCrownEl = $('victory-crown');
const comboIndicatorEl = $('combo-indicator'), comboProgressFillEl = $('combo-progress-fill'), comboMultiplierTextEl = $('combo-multiplier-text');
const missionsListEl = $('missions-list'), missionsStatsTextEl = $('missions-stats-text'), missionsAvailableTextEl = $('missions-available-text'), missionsTimerEl = $('missions-timer'), missionsBadgeEl = $('missions-badge');
const prestigeSectionEl = $('prestige-section'), prestigeCountBadgeEl = $('prestige-count-badge'), prestigeProfileBadgeEl = $('prestige-profile-badge'), prestigeCountDisplayEl = $('prestige-count-display'), prestigeBonusTextEl = $('prestige-bonus-text'), prestigeProgressFillEl = $('prestige-progress-fill'), prestigeProgressTextEl = $('prestige-progress-text'), prestigeActivateBtnEl = $('prestige-activate-btn');
const prestigeCoinsPreviewEl = $('prestige-coins-preview'), prestigeChestsPreviewEl = $('prestige-chests-preview'), prestigeBonusPreviewEl = $('prestige-bonus-preview'), prestigeConfirmBtn = $('prestige-confirm-btn'), prestigeCancelBtn = $('prestige-cancel-btn'), prestigeChestIconEl = $('prestige-chest-icon'), prestigeRewardTextEl = $('prestige-reward-text'), openPrestigeChestBtn = $('open-prestige-chest-btn'), closePrestigeChestBtn = $('close-prestige-chest');
const eventBannerEl = $('event-banner'), eventIconEl = $('event-icon'), eventLabelEl = $('event-label'), eventNameEl = $('event-name'), eventDescEl = $('event-desc'), eventBadgeEl = $('event-badge'), eventProgressFillEl = $('event-progress-fill'), eventProgressTextEl = $('event-progress-text');
const eventModalIconEl = $('event-modal-icon'), eventTitleEl = $('event-title'), eventModalDescEl = $('event-modal-desc'), eventModalDatesEl = $('event-modal-dates'), eventRewardsTimelineEl = $('event-rewards-timeline');

if (highScoreEl) highScoreEl.innerText = `РЕКОРД: ${highScore}`;

// ============ СЕЗОН, DAILY, КОМБО, МОНЕТЫ, XP ============
function initSeason() {
    const season = getCurrentSeason();
    const parts = [];
    if (season.coinMult > 1) parts.push(`+${Math.round((season.coinMult - 1) * 100)}% 🪙`);
    if (season.xpMult > 1) parts.push(`+${Math.round((season.xpMult - 1) * 100)}% опыта`);
    if (parts.length > 0 && seasonPillEl) {
        seasonPillEl.innerText = `${season.icon} ${season.name} ${parts.join(' ')}`;
        seasonPillEl.style.display = 'block';
    }
}

function getDailyChallenge() {
    const t = new Date();
    return DAILY_CHALLENGES[(t.getFullYear() * 10000 + (t.getMonth() + 1) * 100 + t.getDate()) % DAILY_CHALLENGES.length];
}
function getDailyChallengeStatus() { return safeGetItem(STORAGE_KEYS.DAILY_CHALLENGE_DATE, null) === new Date().toDateString(); }
function markDailyChallengePlayed() {
    safeSetItem(STORAGE_KEYS.DAILY_CHALLENGE_DATE, new Date().toDateString());
    stats.dailyCompleted = (stats.dailyCompleted || 0) + 1;
    saveStats(); checkAchievements();
}
function renderDailyChallenge() {
    if (!dailyBannerEl) return;
    const ch = getDailyChallenge();
    dailyNameEl.innerText = ch.name; dailyDescEl.innerText = ch.desc; dailyIconEl.innerText = ch.icon;
    const played = getDailyChallengeStatus();
    dailyBannerEl.classList.toggle('played', played);
    dailyPlayBtn.innerText = played ? '✓' : 'ИГРАТЬ';
    dailyPlayBtn.disabled = played;
}
function startDailyChallenge() {
    if (getDailyChallengeStatus()) return;
    dailyChallengeActive = true;
    dailyModifiers = getDailyChallenge().modifiers;
    activeContract = null;
    markDailyChallengePlayed(); renderDailyChallenge();
    startGame(GAME_MODES.CLASSIC);
}
function restoreDailyVisuals() {
    if (savedBgBeforeDaily) { currentBackground = savedBgBeforeDaily; savedBgBeforeDaily = null; applyBackground(); }
    if (savedPaletteBeforeDaily) { currentPalette = savedPaletteBeforeDaily; savedPaletteBeforeDaily = null; }
}

function updateComboIndicator() {
    if (!comboIndicatorEl) return;
    const display = formatComboDisplay(combo);
    if (combo === 0) { comboIndicatorEl.classList.remove('active'); return; }
    comboIndicatorEl.classList.add('active');
    comboIndicatorEl.style.setProperty('--combo-color', display.color);
    if (comboMultiplierTextEl) { updateDOMText(comboMultiplierTextEl, display.text); comboMultiplierTextEl.style.color = display.color; }
    if (comboProgressFillEl) { updateDOMStyle(comboProgressFillEl, 'width', `${Math.min(100, display.progress * 100)}%`); updateDOMStyle(comboProgressFillEl, 'background', display.color); }
}

let coinPopupAnchor = { x: window.innerWidth / 2, y: 120 };
const COIN_POPUP_POOL = [];
let coinPopupPoolIdx = 0;
function cacheCoinPopupAnchor() {
    if (!gameCoinsEl) return;
    const r = gameCoinsEl.getBoundingClientRect();
    if (r.width > 0) { coinPopupAnchor.x = r.left + r.width / 2; coinPopupAnchor.y = r.bottom + 4; }
}

function addCoins(amount, { raw = false } = {}) {
    if (amount <= 0) return;
    if (!raw) {
        let mult = 1;
        if (activePowerups.multiplier && gameState === GAME_STATES.PLAYING) mult *= 2;
        if (dailyModifiers.coinMult) mult *= dailyModifiers.coinMult;
        const skinMods = getSkinModifiers();
        if (skinMods.coinMult) mult *= skinMods.coinMult;
        const season = getCurrentSeason();
        if (season.coinMult) mult *= season.coinMult;
        const pb = getPrestigeBonus();
        if (pb.coinMult > 0) mult *= (1 + pb.coinMult);
        if (pb.allMult > 0) mult *= (1 + pb.allMult);
        const upg = getUpgradeBonuses();
        if (upg.coinMult > 0) mult *= (1 + upg.coinMult);
        amount = Math.round(amount * mult);
    }
    coins += amount; sessionCoins += amount;
    safeSetItem(STORAGE_KEYS.COINS, coins);
    scheduleCloudSave();
    updateCoinUI(); showCoinPopup(amount);
    updateMissionProgress(missions, 'coins', amount);
    if (gameCoinsEl) { gameCoinsEl.classList.remove('coin-pulse'); requestAnimationFrame(() => gameCoinsEl.classList.add('coin-pulse')); }
}

function showCoinPopup(amount) {
    if (COIN_POPUP_POOL.length === 0) {
        for (let i = 0; i < 6; i++) {
            const el = document.createElement('div');
            el.className = 'coin-popup'; el.style.display = 'none';
            el.addEventListener('animationend', () => { el.style.display = 'none'; });
            document.body.appendChild(el); COIN_POPUP_POOL.push(el);
        }
    }
    const popup = COIN_POPUP_POOL[coinPopupPoolIdx];
    coinPopupPoolIdx = (coinPopupPoolIdx + 1) % COIN_POPUP_POOL.length;
    popup.textContent = `+${amount} 🪙`;
    popup.style.left = coinPopupAnchor.x + 'px';
    popup.style.top = coinPopupAnchor.y + 'px';
    popup.style.animation = 'none'; popup.style.display = 'block';
    requestAnimationFrame(() => { popup.style.animation = ''; });
}

function addXP(amount) {
    if (amount <= 0) return;
    let mult = 1;
    if (dailyModifiers.xpMult) mult *= dailyModifiers.xpMult;
    const skinMods = getSkinModifiers();
    if (skinMods.xpMult) mult *= skinMods.xpMult;
    const season = getCurrentSeason();
    if (season.xpMult) mult *= season.xpMult;
    const pb = getPrestigeBonus();
    if (pb.xpMult > 0) mult *= (1 + pb.xpMult);
    if (pb.allMult > 0) mult *= (1 + pb.allMult);
    const upg = getUpgradeBonuses();
    if (upg.xpMult > 0) mult *= (1 + upg.xpMult);
    amount = Math.round(amount * mult);
    xpTotal += amount; sessionXP += amount;
    updateMissionProgress(missions, 'xp', amount);
    const oldLevel = level;
    while (xpTotal >= xpForNextLevel(level) && level < LIMITS.MAX_LEVEL) {
        xpTotal -= xpForNextLevel(level);
        level++;
        addCoins(CFG.COINS_LEVEL_UP);
        showPopup(levelupPopup, `🏅 УРОВЕНЬ ${level}! +${CFG.COINS_LEVEL_UP} 🪙`, 2000);
        playSound('milestone'); triggerHaptic('success'); checkAchievements();
    }
    if (level > oldLevel) handleLevelMilestones(oldLevel, level);
    saveLevelProgress(); updateLevelUI();
}

function updateLevelUI() {
    const nextXP = xpForNextLevel(level);
    updateDOMText(menuLevelNum, level);
    updateDOMStyle(menuXPFill, 'width', Math.min(100, (xpTotal / nextXP) * 100) + '%');
    updateDOMText(menuXPText, `${xpTotal} / ${nextXP} опыта`);
    updatePrestigeUI();
}

function checkDailyStreak() {
    const today = new Date().toDateString();
    if (today === lastVisitDate) return;
    const lastDate = lastVisitDate ? new Date(lastVisitDate) : null;
    const dayDiff = lastDate ? Math.floor((new Date(today) - lastDate) / 86400000) : 999;
    streak = dayDiff === 1 ? streak + 1 : 1;
    lastVisitDate = today;
    safeSetItem(STORAGE_KEYS.LAST_VISIT, lastVisitDate);
    safeSetItem(STORAGE_KEYS.STREAK, streak);
    scheduleCloudSave();
    dailyRewardAmount = Math.min(100, 10 + (streak - 1) * 5);
    dailyRewardPending = true;
    if (streak % 3 === 0 || streak === 7 || streak === 30 || streak === 100) addChest('daily', { streak });
    updateStreakUI();
}

function updateStreakUI() {
    if (!menuStreakEl) return;
    if (streak > 0) { updateDOMText(menuStreakEl, `🔥 ${streak}`); menuStreakEl.classList.remove('hidden'); }
    else menuStreakEl.classList.add('hidden');
}

function showDailyReward() {
    if (!dailyRewardPending) return;
    dailyStreakText.innerText = `🔥 День ${streak} подряд!`;
    dailyCoinsReward.innerText = `+${dailyRewardAmount} 🪙`;
    dailySubText.innerText = streak === 1 ? 'Заходи каждый день — награда растёт!' : streak < 7 ? `Следующий день: +${Math.min(100, 10 + streak * 5)} 🪙` : '🔥 Максимальная награда!';
    showModal(dailyScreen);
}

// ============ АЧИВКИ, LEADERBOARD, НАСТРОЙКИ ============
function checkAchievements() {
    let changed = false;
    ACHIEVEMENTS.forEach(a => {
        if (unlockedAchievements.includes(a.id)) return;
        try {
            if (a.check()) {
                unlockedAchievements.push(a.id); changed = true;
                addCoins(a.reward || 20);
                showPopup(achievementPopup, `${a.icon} ${a.name}!`, 2000);
                playSound('quest'); triggerHaptic('success');
                if (a.special === 'legend' && !unlockedSkins.includes('legend')) {
                    unlockedSkins.push('legend'); safeSetItem(STORAGE_KEYS.SKINS, unlockedSkins);
                    setTimeout(() => showPopup(bonusText, '👑 ОБЛИК «ЛЕГЕНДА»!', 2500), 2200);
                }
                if (a.feature) {
                    unlockedFeatures[a.feature] = true; safeSetItem(STORAGE_KEYS.FEATURES, unlockedFeatures);
                    setTimeout(() => showPopup(bonusText, `✨ ${FEATURE_NAMES[a.feature]}!`, 2500), 2200);
                }
            }
        } catch (e) {}
    });
    if (changed) saveAchievements();
}

function renderAchievements() {
    if (!achListEl) return;
    document.querySelectorAll('.ach-tab').forEach(t => t.classList.toggle('active', t.dataset.achCat === currentAchCategory));
    const list = currentAchCategory === 'all' ? ACHIEVEMENTS : ACHIEVEMENTS.filter(a => a.category === currentAchCategory);
    achListEl.innerHTML = '';
    list.forEach(a => {
        const unlocked = unlockedAchievements.includes(a.id);
        const div = document.createElement('div');
        div.className = 'ach-item' + (unlocked ? ' unlocked' : '');
        const rewardTag = !unlocked && a.reward ? `<span class="ach-reward-tag">+${a.reward} 🪙</span>` : '';
        div.innerHTML = `<span class="ach-icon">${a.icon}</span><div class="ach-info"><span class="ach-name">${a.name}${unlocked ? ' ✓' : ''}</span><span class="ach-desc">${a.desc}</span></div>${rewardTag}`;
        achListEl.appendChild(div);
    });
    if (achProgressEl) {
        const unlockedInView = list.filter(a => unlockedAchievements.includes(a.id)).length;
        achProgressEl.innerText = currentAchCategory === 'all' ? `${unlockedAchievements.length}/${ACHIEVEMENTS.length}` : `${unlockedInView}/${list.length}`;
    }
}

function addToLeaderboard(val, mode) {
    if (!Number.isFinite(val) || val <= 0) return;
    leaderboard.push({ score: Math.floor(val), mode, date: new Date().toLocaleDateString('ru-RU'), ts: Date.now() });
    if (leaderboard.length > LIMITS.MAX_LEADERBOARD_ENTRIES) {
        leaderboard.sort((a, b) => (b.ts || 0) - (a.ts || 0));
        leaderboard = leaderboard.slice(0, LIMITS.MAX_LEADERBOARD_ENTRIES);
    }
    saveLeaderboard();
}

function renderLeaderboard() {
    document.querySelectorAll('.lb-mode-tab').forEach(t => t.classList.toggle('active', t.dataset.mode === currentLbMode));
    const modeEntries = leaderboard.filter(e => e.mode === currentLbMode);
    const bestValEl = $('lb-best-value'), bestSubEl = $('lb-best-sub'), attemptsEl = $('lb-attempts');
    if (modeEntries.length > 0) {
        const best = [...modeEntries].sort((a, b) => b.score - a.score)[0];
        if (bestValEl) bestValEl.innerText = best.score;
        if (bestSubEl) bestSubEl.innerText = `Установлен ${best.date}`;
    } else {
        if (bestValEl) bestValEl.innerText = '0';
        if (bestSubEl) bestSubEl.innerText = 'Играй, чтобы установить рекорд';
    }
    if (!attemptsEl) return;
    attemptsEl.innerHTML = '';
    const recent = [...modeEntries].sort((a, b) => (b.ts || 0) - (a.ts || 0)).slice(0, 5);
    if (recent.length === 0) { attemptsEl.innerHTML = '<div class="lb-empty-attempts">Пока нет попыток в этом режиме</div>'; return; }
    const bestScore = Math.max(...modeEntries.map(e => e.score));
    let bestShown = false;
    recent.forEach((entry, i) => {
        const isBest = !bestShown && entry.score === bestScore;
        if (isBest) bestShown = true;
        const div = document.createElement('div');
        div.className = 'lb-attempt' + (isBest ? ' best' : '');
        div.innerHTML = `<span class="lb-attempt-rank">${i + 1}.</span><span class="lb-attempt-score">${entry.score}${isBest ? ' <span class="lb-attempt-badge">РЕКОРД</span>' : ''}</span><span class="lb-attempt-date">${entry.date}</span>`;
        attemptsEl.appendChild(div);
    });
}

function trackGameScore(s) {
    if (!Number.isFinite(s) || s < 0) return;
    recentScores.push(Math.floor(s));
    if (recentScores.length > LIMITS.MAX_RECENT_SCORES) recentScores.shift();
    saveRecentScores();
}
function getSmartDifficultyMultiplier() {
    if (recentScores.length < 3) return 1.0;
    const avg = recentScores.reduce((a, b) => a + b, 0) / recentScores.length;
    return avg < 12 ? 0.90 : avg < 18 ? 0.95 : avg > 45 ? 1.08 : avg > 35 ? 1.04 : 1.0;
}

function updateSettingsUI() {
    const tM = $('toggle-music'), tS = $('toggle-sfx'), tH = $('toggle-haptics');
    if (tM) { tM.dataset.on = settings.musicEnabled; tM.innerText = settings.musicEnabled ? 'ВКЛ' : 'ВЫКЛ'; }
    if (tS) { tS.dataset.on = settings.sfxEnabled; tS.innerText = settings.sfxEnabled ? 'ВКЛ' : 'ВЫКЛ'; }
    if (tH) { tH.dataset.on = settings.hapticsEnabled; tH.innerText = settings.hapticsEnabled ? 'ВКЛ' : 'ВЫКЛ'; }
    if (muteBtn) muteBtn.innerText = (settings.musicEnabled || settings.sfxEnabled) ? '🔊' : '🔇';
    updateCloudStatusUI();
}

// ============ QUESTS ============
function generateNewQuests() {
    const pool = [...QUESTS_POOL]; quests = [];
    for (let i = 0; i < 3; i++) quests.push({ ...pool.splice(Math.floor(Math.random() * pool.length), 1)[0], current: 0, done: false });
    saveQuests(); renderQuests();
}
function loadQuests() {
    const saved = safeGetItem(STORAGE_KEYS.QUESTS, null);
    if (saved && saved.date === new Date().toDateString() && saved.quests?.length === 3) { quests = saved.quests; renderQuests(); }
    else generateNewQuests();
}
function saveQuests() { safeSetItem(STORAGE_KEYS.QUESTS, { date: new Date().toDateString(), quests }); }
function updateQuest(type, value, isMax = false) {
    let changed = false;
    quests.forEach(q => {
        if (q.type !== type || q.done) return;
        if (isMax) { if (value > q.current) { q.current = Math.min(q.target, value); changed = true; } }
        else { q.current = Math.min(q.target, q.current + value); changed = true; }
        if (q.current >= q.target && !q.done) {
            q.done = true; addCoins(q.reward); playSound('quest');
            showPopup(bonusText, `🎁 ЗАДАНИЕ +${q.reward} 🪙`, 1500); triggerHaptic('success');
        }
    });
    if (changed) { saveQuests(); renderQuests(); }
    if (quests.every(q => q.done) && !newQuestsTimeout) {
        newQuestsTimeout = setTimeout(() => { newQuestsTimeout = null; generateNewQuests(); showPopup(bonusText, '🌟 НОВЫЕ ЗАДАНИЯ!', 1500); playSound('quest'); }, 1500);
    }
}
function renderQuests() {
    if (!questsEl) return;
    questsEl.innerHTML = '';
    quests.forEach(q => {
        const chip = document.createElement('div');
        chip.className = 'quest-chip' + (q.done ? ' done' : '');
        chip.textContent = q.done ? '✅ ' + q.text : `${q.text} ${q.current}/${q.target}`;
        questsEl.appendChild(chip);
    });
}
function updateCoinUI() {
    updateDOMText(menuCoinsEl, `🪙 ${coins}`);
    updateDOMText(gameCoinsEl, `🪙 ${gameState === GAME_STATES.PLAYING ? sessionCoins : coins}`);
    updateRerollMissionsBtn();
}

// ============ МЕНЮ, МАГАЗИН, АПГРЕЙДЫ, КОЛЕСО ============
function switchMenuTab(tabName) {
    currentMenuTab = tabName;
    document.querySelectorAll('.nav-tab-btn').forEach(btn => {
        const active = btn.dataset.menuTab === tabName;
        btn.classList.toggle('active', active); btn.setAttribute('aria-selected', String(active));
    });
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.toggle('active', p.id === `tab-${tabName}`));
    const vp = $('tab-viewport'); if (vp) vp.scrollTop = 0;
    if (tabName === 'shop') { renderShop(); switchShopTab(currentShopTab); }
    else if (tabName === 'tasks') { renderMissions(); updateChestUI(); updateWheelUI(); }
    else if (tabName === 'profile') { updateLevelUI(); updatePrestigeUI(); }
    updateTelegramBackButton();
}

function getEffectIcon(e) { return ({ holographic: '🌈', fire: '🔥', ice: '❄️', neon: '💡', stars: '✨' })[e] || ''; }

function formatSkinModifiers(m) {
    if (!m) return '';
    const chips = [];
    if (m.coinMult && m.coinMult !== 1) chips.push(`<span class="skin-mod-chip">🪙 +${Math.round((m.coinMult - 1) * 100)}% монет</span>`);
    if (m.scoreMult && m.scoreMult !== 1) chips.push(`<span class="skin-mod-chip">🏆 +${Math.round((m.scoreMult - 1) * 100)}% очков</span>`);
    if (m.xpMult && m.xpMult !== 1) chips.push(`<span class="skin-mod-chip">✨ +${Math.round((m.xpMult - 1) * 100)}% опыта</span>`);
    if (m.speedMult && m.speedMult !== 1) {
        const pct = Math.round((m.speedMult - 1) * 100);
        chips.push(`<span class="skin-mod-chip${pct > 0 ? ' warn' : ''}">${pct > 0 ? '⚡' : '🐢'} ${pct > 0 ? '+' : ''}${pct}% скорость</span>`);
    }
    if (m.fireChance) chips.push(`<span class="skin-mod-chip warn">🔥 ${Math.round(m.fireChance * 100)}% поджог</span>`);
    return chips.length ? `<div class="skin-mods">${chips.join('')}</div>` : '';
}

function getSecondChanceCost() {
    return Math.max(10, Math.round(CFG.SECOND_CHANCE_COST * (1 - getUpgradeBonuses().secondChanceDiscount)));
}

function renderUpgrades() {
    if (!upgradesListEl) return;
    upgradesListEl.innerHTML = '';
    UPGRADES.forEach(u => {
        const lvl = getUpgradeLevel(u.id), isMax = lvl >= MAX_UPGRADE_LEVEL, price = getUpgradePrice(u);
        const pips = Array.from({ length: MAX_UPGRADE_LEVEL }, (_, i) => `<span class="upgrade-pip${i < lvl ? ' filled' : ''}"></span>`).join('');
        const btnHtml = isMax ? `<button class="upgrade-buy-btn maxed" disabled>MAX</button>` : coins >= price ? `<button class="upgrade-buy-btn" data-upgrade-id="${u.id}">${price} 🪙</button>` : `<button class="upgrade-buy-btn locked" disabled>${price} 🪙</button>`;
        const div = document.createElement('div');
        div.className = 'upgrade-item' + (isMax ? ' maxed' : '');
        div.innerHTML = `<div class="upgrade-icon">${u.icon}</div><div class="upgrade-info"><div class="upgrade-head"><span class="upgrade-name">${u.name}</span>${lvl > 0 ? `<span class="upgrade-bonus">${u.formatBonus(lvl)}</span>` : ''}</div><span class="upgrade-desc">${u.desc}</span><div class="upgrade-pips">${pips}</div></div>${btnHtml}`;
        upgradesListEl.appendChild(div);
    });
    upgradesListEl.querySelectorAll('button.upgrade-buy-btn[data-upgrade-id]').forEach(btn => {
        safeClick(btn, () => {
            const res = buyUpgrade(btn.dataset.upgradeId, coins);
            if (res.success) {
                coins -= res.price; safeSetItem(STORAGE_KEYS.COINS, coins);
                stats.upgradesBought = (stats.upgradesBought || 0) + 1; saveStats(); scheduleCloudSave();
                updateCoinUI(); renderUpgrades(); switchShopTab('upgrades'); playSound('buy'); triggerHaptic('success');
                showPopup(bonusText, `${res.upgrade.icon} ${res.upgrade.name} ур. ${res.newLevel}!`, 1200);
                checkAchievements();
            } else triggerHaptic('error');
        });
    });
}

function updateWheelUI() {
    const ready = canSpinWheel();
    if (wheelBannerDescEl) wheelBannerDescEl.textContent = ready ? 'Бесплатный спин доступен!' : `Следующий спин через ${getTimeUntilNextSpin()}`;
    if (wheelBannerDotEl) wheelBannerDotEl.classList.toggle('hidden', !ready);
    if (wheelStatusEl) wheelStatusEl.textContent = ready ? '✨ Крути бесплатно и забирай приз!' : `⏳ Следующий спин через: ${getTimeUntilNextSpin()}`;
    if (wheelSpinBtn && (!wheelController || !wheelController.isSpinning())) {
        wheelSpinBtn.disabled = !ready;
        wheelSpinBtn.textContent = ready ? '🎰 КРУТИТЬ БЕСПЛАТНО' : 'УЖЕ ИСПОЛЬЗОВАНО СЕГОДНЯ';
    }
    updateMissionsBadge();
}

function openWheelModal() {
    if (!wheelScreen || !wheelCanvas) return;
    if (wheelResultEl) wheelResultEl.textContent = '';
    if (!wheelController) {
        wheelController = createWheelController(wheelCanvas, {
            onTick: () => playSound('ui_click'),
            onFinish: (seg) => {
                if (seg.type === 'coins') {
                    addCoins(seg.value);
                    if (wheelResultEl) wheelResultEl.textContent = seg.jackpot ? `💎 ДЖЕКПОТ! +${seg.value} 🪙` : `Выигрыш: +${seg.value} 🪙!`;
                } else if (seg.type === 'xp') {
                    addXP(seg.value);
                    if (wheelResultEl) wheelResultEl.textContent = `Выигрыш: +${seg.value} опыта!`;
                } else if (seg.type === 'powerup') {
                    const keys = Object.keys(POWERUP_DEFS), pk = keys[Math.floor(Math.random() * keys.length)];
                    ownedPowerups[pk] = (ownedPowerups[pk] || 0) + seg.value; savePowerups();
                    if (wheelResultEl) wheelResultEl.textContent = `Выигрыш: ${POWERUP_DEFS[pk].icon} ${POWERUP_DEFS[pk].name}!`;
                } else if (seg.type === 'chest') {
                    addChest('wheel', { rare: Boolean(seg.rare) });
                    if (wheelResultEl) wheelResultEl.textContent = seg.rare ? '✨ Выигрыш: РЕДКИЙ СУНДУК!' : '📦 Выигрыш: СУНДУК!';
                } else if (seg.type === 'legendary_skin') {
                    const lockedLegs = Object.keys(SKINS).filter(k => SKINS[k].wheelOnly && !unlockedSkins.includes(k));
                    if (lockedLegs.length > 0) {
                        const winKey = lockedLegs[Math.floor(Math.random() * lockedLegs.length)];
                        unlockedSkins.push(winKey);
                        safeSetItem(STORAGE_KEYS.SKINS, unlockedSkins);
                        scheduleCloudSave();
                        if (wheelResultEl) wheelResultEl.textContent = `👑 ЛЕГЕНДА! Облик «${SKINS[winKey].name}»!`;
                    } else {
                        addCoins(2500, { raw: true });
                        addChest('wheel', { rare: true });
                        if (wheelResultEl) wheelResultEl.textContent = '👑 ВСЕ ЛЕГЕНДЫ СОБРАНЫ! +2500 🪙 и Редкий сундук!';
                    }
                }
                stats.wheelSpins = (stats.wheelSpins || 0) + 1; saveStats();
                playSound(seg.jackpot || seg.rare ? 'victory' : 'chest'); triggerHaptic('success');
                updateWheelUI(); checkAchievements();
            },
        });
    } else wheelController.draw();
    updateWheelUI(); showModal(wheelScreen);
    if (wheelTimerInterval) clearInterval(wheelTimerInterval);
    wheelTimerInterval = setInterval(updateWheelUI, 1000);
}

function closeWheelModal() { if (wheelTimerInterval) { clearInterval(wheelTimerInterval); wheelTimerInterval = null; } hideModal(wheelScreen); }

function renderShop() {
    if (!skinListEl) return;
    skinListEl.innerHTML = '';

    const entries = Object.entries(SKINS)
        .filter(([key, skin]) => {
            if (key === 'legend' && !unlockedSkins.includes('legend')) return false;
            if ((skin.prestigeOnly || skin.eventOnly || skin.exclusiveOnly) && !unlockedSkins.includes(key)) return false;
            return true;
        })
        .sort(([, a], [, b]) => {
            const oa = SKIN_RARITIES[a.rarity || 'common']?.order ?? 0;
            const ob = SKIN_RARITIES[b.rarity || 'common']?.order ?? 0;
            return oa !== ob ? oa - ob : (a.price || 0) - (b.price || 0);
        });

    let lastRarity = null;
    for (const [key, skin] of entries) {
        const rarityKey = skin.rarity || 'common';
        const rarity = SKIN_RARITIES[rarityKey] || SKIN_RARITIES.common;

        if (rarityKey !== lastRarity) {
            lastRarity = rarityKey;
            const sep = document.createElement('div');
            sep.className = `shop-rarity-header rarity-${rarityKey}`;
            sep.textContent = rarityKey === 'legendary' ? `👑 ${rarity.label} · Колесо 2%` : rarity.label;
            skinListEl.appendChild(sep);
        }

        const isUnlocked = unlockedSkins.includes(key);
        const isEquipped = currentSkin === key;
        const canBuy = coins >= skin.price && !skin.notBuyable;

        let btnHtml = '';
        if (isEquipped) btnHtml = `<button class="equipped">ВЫБРАНО</button>`;
        else if (isUnlocked) btnHtml = `<button class="equip" data-skin="${key}">ВЫБРАТЬ</button>`;
        else if (skin.wheelOnly) btnHtml = `<button class="buy wheel-only" disabled>🎡 2%</button>`;
        else if (skin.notBuyable) btnHtml = `<button class="buy locked" disabled>🏆</button>`;
        else if (canBuy) btnHtml = `<button class="buy" data-skin="${key}" data-price="${skin.price}">${skin.price} 🪙</button>`;
        else btnHtml = `<button class="buy locked" disabled>${skin.price} 🪙</button>`;

        const colorDots = skin.colors.slice(0, 5).map(c => `<span style="background:${c}"></span>`).join('');
        const effectBadge = skin.effect ? `<span class="skin-effect-badge">${getEffectIcon(skin.effect)}</span>` : '';
        const div = document.createElement('div');
        div.className = `skin-item rarity-card-${rarityKey}`;
        div.innerHTML = `<div class="skin-info"><span class="skin-preview ${skin.effect || ''}" style="background:linear-gradient(135deg,${skin.colors[0]},${skin.colors[1] || skin.colors[0]});border-radius:8px;padding:4px;position:relative;">${effectBadge}</span><div class="skin-details"><div class="skin-name-row"><span class="skin-name">${skin.name}</span><span class="rarity-pill rarity-${rarityKey}">${rarity.label}</span></div>${formatSkinModifiers(skin.modifiers)}<div class="skin-colors">${colorDots}</div></div></div>${btnHtml}`;
        skinListEl.appendChild(div);
    }

    skinListEl.querySelectorAll('button.equip').forEach(btn => safeClick(btn, () => { currentSkin = btn.dataset.skin; safeSetItem(STORAGE_KEYS.SKIN, currentSkin); scheduleCloudSave(); applySkinEffect(); renderShop(); }));
    skinListEl.querySelectorAll('button.buy').forEach(btn => {
        if (btn.disabled) return;
        safeClick(btn, () => {
            const price = parseInt(btn.dataset.price);
            if (coins >= price) {
                coins -= price; safeSetItem(STORAGE_KEYS.COINS, coins);
                unlockedSkins.push(btn.dataset.skin); safeSetItem(STORAGE_KEYS.SKINS, unlockedSkins);
                currentSkin = btn.dataset.skin; safeSetItem(STORAGE_KEYS.SKIN, currentSkin);
                scheduleCloudSave(); applySkinEffect(); updateCoinUI(); renderShop(); playSound('buy'); triggerHaptic('success'); checkAchievements();
            } else triggerHaptic('error');
        });
    });
    renderUpgrades(); renderCustomize('colors'); renderCustomize('backgrounds');
}

function applySkinEffect() {
    document.body.classList.remove('skin-fire-active', 'skin-ice-active', 'skin-neon-active', 'skin-galaxy-active', 'skin-holographic-active');
    const skin = SKINS[currentSkin];
    if (skin?.effect) document.body.classList.add(`skin-${skin.effect}-active`);
}

function renderCustomize(type) {
    const listEl = type === 'colors' ? colorsListEl : backgroundsListEl;
    if (!listEl) return;
    const data = type === 'colors' ? PALETTES : BACKGROUNDS;
    const current = type === 'colors' ? currentPalette : currentBackground;
    const unlocked = type === 'colors' ? unlockedPalettes : unlockedBackgrounds;
    const saveKey = type === 'colors' ? STORAGE_KEYS.PALETTES : STORAGE_KEYS.BACKGROUNDS;
    const currentKey = type === 'colors' ? STORAGE_KEYS.PALETTE : STORAGE_KEYS.BACKGROUND;
    listEl.innerHTML = '';
    for (const [key, item] of Object.entries(data)) {
        const isUnlocked = unlocked.includes(key), isEquipped = current === key, canBuy = coins >= item.price;
        const previewHtml = type === 'colors' ? `<div class="customize-colors">${item.colors.slice(0, 5).map(c => `<span style="background:${c}"></span>`).join('')}</div>` : `<div class="customize-preview" style="background:linear-gradient(135deg, ${item.colors[0]} 0%, ${item.colors[2] || item.colors[1]} 100%);">${item.stars ? '⭐' : '🌅'}</div>`;
        const btnHtml = isEquipped ? `<button class="equipped">✓</button>` : isUnlocked ? `<button class="equip" data-key="${key}">ВЫБРАТЬ</button>` : canBuy ? `<button class="buy" data-key="${key}" data-price="${item.price}">${item.price} 🪙</button>` : `<button class="buy locked" disabled>${item.price} 🪙</button>`;
        const div = document.createElement('div');
        div.className = 'customize-item';
        div.innerHTML = `${previewHtml}<div class="customize-info"><span class="customize-name">${item.name}</span><span class="customize-status${isEquipped ? ' active' : ''}">${isEquipped ? 'Активно' : isUnlocked ? 'Открыто' : 'Не куплено'}</span></div>${btnHtml}`;
        listEl.appendChild(div);
    }
    listEl.querySelectorAll('button.equip').forEach(btn => safeClick(btn, () => {
        safeSetItem(currentKey, btn.dataset.key); scheduleCloudSave();
        if (type === 'colors') currentPalette = btn.dataset.key; else { currentBackground = btn.dataset.key; applyBackground(); }
        renderCustomize(type);
    }));
    listEl.querySelectorAll('button.buy').forEach(btn => {
        if (btn.disabled) return;
        safeClick(btn, () => {
            const price = parseInt(btn.dataset.price);
            if (coins >= price) {
                coins -= price; safeSetItem(STORAGE_KEYS.COINS, coins);
                unlocked.push(btn.dataset.key); safeSetItem(saveKey, unlocked); safeSetItem(currentKey, btn.dataset.key); scheduleCloudSave();
                if (type === 'colors') currentPalette = btn.dataset.key; else { currentBackground = btn.dataset.key; applyBackground(); }
                updateCoinUI(); renderCustomize(type); playSound('buy'); triggerHaptic('success');
            } else triggerHaptic('error');
        });
    });
}

function switchShopTab(tab) {
    currentShopTab = tab;
    document.querySelectorAll('.shop-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    if (skinListEl) skinListEl.style.display = tab === 'skins' ? 'flex' : 'none';
    if (upgradesListEl) upgradesListEl.style.display = tab === 'upgrades' ? 'flex' : 'none';
    if (colorsListEl) colorsListEl.style.display = tab === 'colors' ? 'flex' : 'none';
    if (backgroundsListEl) backgroundsListEl.style.display = tab === 'backgrounds' ? 'flex' : 'none';
    if (!shopProgressEl) return;
    if (tab === 'skins') {
        const totalVisible = Object.keys(SKINS).filter(k => k !== 'legend' && !SKINS[k].prestigeOnly && !SKINS[k].eventOnly && (!SKINS[k].exclusiveOnly || unlockedSkins.includes(k))).length;
        const unlockedVisible = unlockedSkins.filter(k => SKINS[k] && k !== 'legend' && !SKINS[k].prestigeOnly && !SKINS[k].eventOnly).length;
        shopProgressEl.innerText = `Открыто: ${unlockedVisible}/${totalVisible}`;
    } else if (tab === 'upgrades') {
        const p = getUpgradesProgress(); shopProgressEl.innerText = `Улучшено: ${p.current}/${p.total}`;
    } else if (tab === 'colors') shopProgressEl.innerText = `Открыто палитр: ${unlockedPalettes.length}/${Object.keys(PALETTES).length}`;
    else shopProgressEl.innerText = `Открыто фонов: ${unlockedBackgrounds.length}/${Object.keys(BACKGROUNDS).length}`;
}

function applyBackground() {
    const bg = BACKGROUNDS[currentBackground] || BACKGROUNDS.default;
    targetBgColor.set(bg.colors[0]);
    if (scene) scene.background.set(bg.colors[0]);
    document.body.style.background = bg.colors[0];
    syncTelegramTheme(gameState === GAME_STATES.MENU ? '#FFE5EC' : bg.colors[0]);
    if (bg.stars && !bgStarsGroup) createStars();
    else if (!bg.stars && bgStarsGroup) {
        scene.remove(bgStarsGroup);
        if (bgStarsGroup.geometry) bgStarsGroup.geometry.dispose();
        if (bgStarsGroup.material) bgStarsGroup.material.dispose();
        bgStarsGroup = null;
    }
    if (scene) {
        if (lowPerfMode) { try { removeEnvironmentParticles(scene); } catch (e) {} }
        else { try { createEnvironmentParticles(scene, getParticlesForBackground(currentBackground), { density: IS_MOBILE ? 0.45 : 0.85 }); } catch (e) {} }
    }
}

function createStars() {
    const geo = new THREE.BufferGeometry(), pos = [];
    for (let i = 0; i < 300; i++) pos.push((Math.random() - 0.5) * 200, Math.random() * 150, (Math.random() - 0.5) * 200);
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    bgStarsGroup = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.6, transparent: true, opacity: 0.9 }));
    scene.add(bgStarsGroup);
}

// ============ СПОСОБНОСТИ И КОНТРАКТЫ ============
function showPowerupSelection(mode) {
    pendingGameMode = mode;
    activePowerups = { ...DEFAULTS.ACTIVE_POWERUPS };
    selectedContractId = null;
    startScreen.style.display = 'none';
    showModal(powerupsScreen);
    renderPowerupList();
    renderContractList(mode);
}

function renderPowerupList() {
    const list = $('powerup-list');
    if (!list) return;
    list.innerHTML = '';
    const selContract = getContractById(selectedContractId);
    const blockedByContract = Boolean(selContract?.noPowerups);

    for (const [key, def] of Object.entries(POWERUP_DEFS)) {
        const owned = ownedPowerups[key] || 0, canBuy = coins >= def.price, isActive = activePowerups[key];
        const item = document.createElement('div');
        item.className = 'powerup-item' + (isActive ? ' active' : '') + (blockedByContract || (!isActive && owned === 0 && !canBuy) ? ' disabled' : '');
        const actionHtml = isActive ? '<span class="pw-active">✓ АКТИВНО</span>' : owned > 0 ? `<span class="pw-count">x${owned}</span>` : `<span class="pw-price">${def.price} 🪙</span>`;
        item.innerHTML = `<span class="pw-icon">${def.icon}</span><div class="pw-info"><span class="pw-name">${def.name}</span><span class="pw-desc">${def.desc}</span></div>${actionHtml}`;
        safeClick(item, () => {
            if (blockedByContract) {
                selectedContractId = null;
                renderContractList(pendingGameMode);
            }
            if (isActive) activePowerups[key] = false;
            else if (owned > 0) activePowerups[key] = true;
            else if (canBuy) {
                coins -= def.price; safeSetItem(STORAGE_KEYS.COINS, coins);
                ownedPowerups[key] = 1; savePowerups(); activePowerups[key] = true;
                updateCoinUI(); playSound('buy');
            } else { triggerHaptic('error'); return; }
            renderPowerupList();
            renderContractList(pendingGameMode);
        });
        list.appendChild(item);
    }
}

function renderContractList(mode) {
    if (!contractListEl) return;
    contractListEl.innerHTML = '';
    const list = getContractsForMode(mode);
    const hasPowerups = Object.values(activePowerups).some(Boolean);

    list.forEach(c => {
        const isSelected = selectedContractId === c.id;
        const cantAfford = coins < c.stake;
        const item = document.createElement('div');
        item.className = 'contract-item' + (isSelected ? ' active' : '') + (cantAfford ? ' disabled' : '');
        item.innerHTML = `
            <span class="contract-icon">${c.icon}</span>
            <div class="contract-info">
                <span class="contract-name">${c.name}${isSelected ? ' ✓' : ''}</span>
                <span class="contract-desc">${c.desc}</span>
            </div>
            <div class="contract-nums">
                <span class="contract-stake">-${c.stake} 🪙</span>
                <span class="contract-reward">→ +${c.reward} 🪙</span>
            </div>
        `;
        safeClick(item, () => {
            if (cantAfford) { triggerHaptic('error'); return; }
            if (isSelected) {
                selectedContractId = null;
            } else {
                selectedContractId = c.id;
                if (c.noPowerups && hasPowerups) {
                    activePowerups = { ...DEFAULTS.ACTIVE_POWERUPS };
                }
            }
            renderPowerupList();
            renderContractList(mode);
        });
        contractListEl.appendChild(item);
    });
}

function updateContractHUD() {
    if (!contractHudEl) return;
    if (!activeContract || gameState !== GAME_STATES.PLAYING) {
        contractHudEl.style.display = 'none';
        return;
    }
    contractHudEl.style.display = 'block';
    contractHudEl.classList.toggle('done', activeContract.completed);
    contractHudEl.textContent = formatContractHUD(activeContract);
}

function startGameWithPowerups() {
    for (const key in activePowerups) {
        if (activePowerups[key]) ownedPowerups[key] = Math.max(0, (ownedPowerups[key] || 0) - 1);
    }
    const usedPuCount = Object.values(activePowerups).filter(Boolean).length;
    if (usedPuCount > 0) {
        updateQuest('powerup_use', usedPuCount);
        updateMissionProgress(missions, 'powerup_use', usedPuCount);
    }
    savePowerups();
    lastUsedPowerups = { ...activePowerups };

    const contract = getContractById(selectedContractId);
    if (contract && coins >= contract.stake) {
        coins -= contract.stake;
        safeSetItem(STORAGE_KEYS.COINS, coins);
        scheduleCloudSave();
        updateCoinUI();
        activeContract = createContractTracker(contract);
    } else {
        activeContract = null;
    }
    selectedContractId = null;

    hideModal(powerupsScreen, { restoreMenu: false });
    const mode = pendingGameMode;
    pendingGameMode = null;
    startGame(mode);
}

function getPowerupReplayInfo() {
    const keys = Object.keys(lastUsedPowerups).filter(k => lastUsedPowerups[k] && POWERUP_DEFS[k]);
    if (keys.length === 0) return null;
    let totalCost = 0, icons = [];
    keys.forEach(k => { icons.push(POWERUP_DEFS[k].icon); if ((ownedPowerups[k] || 0) <= 0) totalCost += POWERUP_DEFS[k].price; });
    return { keys, icons: icons.join(''), totalCost, canAfford: coins >= totalCost };
}

function updatePowerupReplayButton() {
    if (!restartPowerupsBtn) return;
    const supports = [GAME_MODES.CLASSIC, GAME_MODES.TIME, MODE_ANTIGRAVITY].includes(gameMode);
    const info = supports ? getPowerupReplayInfo() : null;
    if (!info) { restartPowerupsBtn.style.display = 'none'; return; }
    restartPowerupsBtn.style.display = 'block';
    restartPowerupsBtn.disabled = !info.canAfford;
    restartPowerupsBtn.textContent = info.totalCost > 0 ? `⚡ ЗАНОВО ${info.icons} (${info.totalCost} 🪙)` : `⚡ ЗАНОВО С ${info.icons} (ИЗ ЗАПАСА)`;
}

function restartWithSamePowerups() {
    const info = getPowerupReplayInfo();
    if (!info || !info.canAfford) { triggerHaptic('error'); return; }
    if (info.totalCost > 0) { coins -= info.totalCost; safeSetItem(STORAGE_KEYS.COINS, coins); playSound('buy'); }
    info.keys.forEach(k => { if ((ownedPowerups[k] || 0) > 0) ownedPowerups[k]--; });
    savePowerups(); updateCoinUI();
    activePowerups = { ...lastUsedPowerups };
    const usedPuCount = Object.values(activePowerups).filter(Boolean).length;
    if (usedPuCount > 0) {
        updateQuest('powerup_use', usedPuCount);
        updateMissionProgress(missions, 'powerup_use', usedPuCount);
    }
    activeContract = null;
    hideModal(gameOverEl, { restoreMenu: false });
    startGame(gameMode);
}

function updateActivePowerupsUI() {
    if (!activePowerupsEl) return;
    activePowerupsEl.innerHTML = '';
    for (const [key, isActive] of Object.entries(activePowerups)) {
        if (isActive && POWERUP_DEFS[key]) {
            const b = document.createElement('div');
            b.className = 'pu-active-badge'; b.innerText = POWERUP_DEFS[key].icon;
            activePowerupsEl.appendChild(b);
        }
    }
}
// ============ CHESTS ============
function addChest(type, meta = {}) {
    const isRare = Boolean(meta.rare) || Math.random() < 0.1;
    chests.push({ type, isRare, ...meta, id: Date.now() + Math.random() });
    saveChests(); updateChestUI();
    showPopup(bonusText, isRare ? '✨ РЕДКИЙ СУНДУК!' : '📦 НОВЫЙ СУНДУК!', isRare ? 2200 : 1500);
    if (isRare) triggerHaptic('success');
    playSound('quest');
}

function updateChestUI() {
    const count = chests.length, hasRare = chests.some(c => c.isRare);
    const container = $('chest-btn-container'), badge = $('chest-count-badge');
    if (container && badge) {
        container.style.display = count > 0 ? 'block' : 'none';
        badge.innerText = count;
        badge.classList.toggle('rare', hasRare);
    }
    updateMissionsBadge();
}

function rollChestReward(isRare = false) {
    const mult = isRare ? 3 : 1, r = Math.random();
    const lockedSkins = Object.keys(SKINS).filter(s => !unlockedSkins.includes(s) && !SKINS[s].notBuyable && !SKINS[s].wheelOnly && !SKINS[s].exclusiveOnly);
    if (lockedSkins.length === 0 || r < 0.55) {
        const amount = [50, 80, 100, 150, 200][Math.floor(Math.random() * 5)] * mult;
        return { type: 'coins', amount, text: `+${amount} 🪙${isRare ? ' ✨' : ''}` };
    } else if (r < 0.85) {
        const puKeys = Object.keys(POWERUP_DEFS), pu = puKeys[Math.floor(Math.random() * puKeys.length)];
        const count = (Math.random() < 0.5 ? 1 : 2) * mult;
        return { type: 'powerup', powerup: pu, count, text: `${POWERUP_DEFS[pu].icon} ${POWERUP_DEFS[pu].name} x${count}` };
    } else {
        const skin = lockedSkins[Math.floor(Math.random() * lockedSkins.length)];
        return { type: 'skin', skin, text: `🎨 ${SKINS[skin].name}${isRare ? ' ✨' : ''}` };
    }
}

function showChestOpening() {
    if (chests.length === 0) return;
    startScreen.style.display = 'none';
    showModal(chestScreen);
    $('chest-icon').innerText = '📦';
    $('chest-icon').className = 'chest-icon shaking';
    $('chest-rays').className = 'chest-rays';
    $('chest-reward').innerText = '';
    $('chest-reward').className = 'chest-reward';
    $('open-chest-btn').style.display = 'block';
    $('open-chest-btn').innerText = 'ОТКРЫТЬ';
    $('close-chest').style.display = 'none';
    $('chest-title').innerText = '🎁 Сундук!';
    $('chest-sub').innerText = chests[0].isRare ? '✨ РЕДКИЙ СУНДУК! x3 награда!' : `Осталось сундуков: ${chests.length}`;
}

function openChest() {
    if (chests.length === 0) return;
    const chest = chests.shift();
    saveChests(); updateChestUI();
    const reward = rollChestReward(chest.isRare);
    $('chest-icon').className = 'chest-icon opening';
    $('open-chest-btn').style.display = 'none';
    $('chest-rays').className = 'chest-rays show';
    setTimeout(() => {
        if (reward.type === 'coins') addCoins(reward.amount);
        else if (reward.type === 'powerup') { ownedPowerups[reward.powerup] = (ownedPowerups[reward.powerup] || 0) + reward.count; savePowerups(); }
        else if (reward.type === 'skin') { unlockedSkins.push(reward.skin); safeSetItem(STORAGE_KEYS.SKINS, unlockedSkins); scheduleCloudSave(); checkAchievements(); }
        $('chest-icon').innerText = chest.isRare ? '✨' : '🎁';
        $('chest-icon').className = 'chest-icon';
        $('chest-reward').innerText = reward.text;
        $('chest-reward').className = 'chest-reward show';
        playSound('chest'); triggerHaptic('success');
        if (chests.length > 0) {
            $('chest-sub').innerText = chests[0].isRare ? '✨ Ещё редкий сундук!' : `Осталось: ${chests.length}`;
            $('open-chest-btn').innerText = 'ОТКРЫТЬ ЕЩЁ';
            $('open-chest-btn').style.display = 'block';
        } else {
            $('chest-sub').innerText = 'Все сундуки открыты!';
            $('close-chest').style.display = 'block';
        }
    }, 1000);
}

// ============ МИССИИ ============
function initMissions() {
    missions = loadMissions();
    renderMissions();
    updateMissionsBadge();
    startMissionsTimer();
}

function updateRerollMissionsBtn() {
    if (!rerollMissionsBtn) return;
    const cost = getMissionRerollCost();
    rerollMissionsBtn.textContent = `🔄 Обновить миссии (${cost} 🪙)`;
    rerollMissionsBtn.disabled = coins < cost;
}

function handleRerollMissions() {
    const cost = getMissionRerollCost();
    if (coins < cost) { triggerHaptic('error'); return; }
    missions.forEach(m => {
        if (m.completed && !m.claimed) {
            claimMissionReward(m.id, missions, addCoins, addXP, (type, meta) => addChest(type, meta));
            stats.missionsCompleted = (stats.missionsCompleted || 0) + 1;
        }
    });
    saveStats();
    coins -= cost; safeSetItem(STORAGE_KEYS.COINS, coins); scheduleCloudSave();
    missions = rerollDailyMissions(missions);
    renderMissions(); updateMissionsBadge(); updateCoinUI();
    playSound('buy'); triggerHaptic('success');
    showPopup(bonusText, '🔄 НОВЫЕ МИССИИ ДНЯ!', 1200);
    checkAchievements();
}

function renderMissions() {
    if (!missionsListEl) return;
    missionsListEl.innerHTML = '';
    missions.forEach((mission, index) => {
        const progress = getMissionProgress(mission);
        const item = document.createElement('div');
        item.className = 'mission-item' + (mission.completed && !mission.claimed ? ' completed' : '') + (mission.claimed ? ' claimed' : '');
        if (index < 3) { item.classList.add('new'); item.style.animationDelay = `${index * 0.08}s`; }
        const actionHtml = mission.claimed ? '<span class="mission-claimed-badge">✓ Получено</span>' : mission.completed ? `<button class="mission-claim-btn" data-mission-id="${mission.id}">ЗАБРАТЬ</button>` : '';
        item.innerHTML = `<div class="mission-icon">${mission.icon}</div><div class="mission-info"><span class="mission-text">${mission.text}</span><div class="mission-progress-bar"><div class="mission-progress-fill" style="width:${progress}%"></div></div><span class="mission-progress-text">${mission.current} / ${mission.target}</span></div><div class="mission-reward"><span class="mission-reward-text">${formatMissionReward(mission.reward)}</span>${actionHtml}</div>`;
        missionsListEl.appendChild(item);
    });
    missionsListEl.querySelectorAll('.mission-claim-btn').forEach(btn => {
        safeClick(btn, () => {
            const res = claimMissionReward(btn.dataset.missionId, missions, addCoins, addXP, (type, meta) => addChest(type, meta));
            if (res.success) {
                const item = btn.closest('.mission-item');
                item.classList.add('just-completed', 'claimed'); item.classList.remove('completed');
                stats.missionsCompleted = (stats.missionsCompleted || 0) + 1; saveStats();
                setTimeout(() => { renderMissions(); updateMissionsBadge(); updateCoinUI(); }, 600);
                playSound('mission_complete'); triggerHaptic('success');
                showPopup(bonusText, '🎁 МИССИЯ ВЫПОЛНЕНА!', 1500);
                checkAchievements();
            }
        });
    });
    const mStats = getMissionsStats(missions);
    if (missionsStatsTextEl) missionsStatsTextEl.textContent = `Выполнено: ${mStats.completed}/${mStats.total}`;
    if (missionsAvailableTextEl) missionsAvailableTextEl.textContent = `Доступно наград: ${mStats.available}`;
    updateRerollMissionsBtn();
}

function updateMissionsBadge() {
    if (!missionsBadgeEl) return;
    const totalPending = getMissionsStats(missions).available + chests.length + (canSpinWheel() ? 1 : 0);
    missionsBadgeEl.textContent = totalPending;
    missionsBadgeEl.classList.toggle('hidden', totalPending <= 0);
}

function startMissionsTimer() {
    if (missionsTimerInterval) clearInterval(missionsTimerInterval);
    function updateTimer() {
        if (!missionsTimerEl) return;
        const now = new Date(), tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(0, 0, 0, 0);
        const diff = tomorrow - now;
        const h = String(Math.floor(diff / 3600000)).padStart(2, '0');
        const m = String(Math.floor((diff % 3600000) / 60000)).padStart(2, '0');
        const s = String(Math.floor((diff % 60000) / 1000)).padStart(2, '0');
        missionsTimerEl.textContent = `Обновление через: ${h}:${m}:${s}`;
    }
    updateTimer();
    missionsTimerInterval = setInterval(updateTimer, 1000);
}

// ============ ПРЕСТИЖ ============
function updatePrestigeUI() {
    const count = getPrestigeCount(), bonus = getPrestigeBonus(), progress = getPrestigeProgress(level), available = canPrestige(level);
    if (prestigeSectionEl) prestigeSectionEl.style.display = level >= 50 || count > 0 ? 'block' : 'none';
    if (prestigeProfileBadgeEl && prestigeCountBadgeEl) {
        prestigeProfileBadgeEl.style.display = count > 0 ? 'inline-flex' : 'none';
        prestigeCountBadgeEl.textContent = count;
    }
    if (prestigeCountDisplayEl) prestigeCountDisplayEl.textContent = count;
    if (prestigeBonusTextEl) { const txt = formatPrestigeBonus(bonus); prestigeBonusTextEl.textContent = txt ? `Бонусы: ${txt}` : 'Бонусы: —'; }
    if (prestigeProgressFillEl) prestigeProgressFillEl.style.width = `${progress}%`;
    if (prestigeProgressTextEl) {
        prestigeProgressTextEl.textContent = available ? '⭐ ГОТОВ К ПРЕСТИЖУ!' : `${level} / ${PRESTIGE_CONFIG.REQUIRED_LEVEL} уровня`;
        prestigeProgressTextEl.style.color = available ? 'var(--orange)' : '';
    }
    if (prestigeActivateBtnEl) {
        prestigeActivateBtnEl.disabled = !available;
        prestigeActivateBtnEl.textContent = available ? '⭐ АКТИВИРОВАТЬ ПРЕСТИЖ' : `🔒 ДОСТУПНО С ${PRESTIGE_CONFIG.REQUIRED_LEVEL} УРОВНЯ`;
    }
}

function showPrestigeConfirm() {
    if (!canPrestige(level)) return;
    const newCount = getPrestigeCount() + 1;
    if (prestigeCoinsPreviewEl) prestigeCoinsPreviewEl.textContent = `+${PRESTIGE_CONFIG.BASE_COINS_REWARD * newCount} монет`;
    if (prestigeChestsPreviewEl) prestigeChestsPreviewEl.textContent = `+${PRESTIGE_CONFIG.BASE_CHESTS_REWARD + Math.floor(newCount / 2)} престиж-сундуков`;
    if (prestigeBonusPreviewEl) prestigeBonusPreviewEl.textContent = `+${Math.round(PRESTIGE_CONFIG.BONUS_PER_PRESTIGE.coinMult * 100)}% 🪙, +${Math.round(PRESTIGE_CONFIG.BONUS_PER_PRESTIGE.xpMult * 100)}% ⭐, +${Math.round(PRESTIGE_CONFIG.BONUS_PER_PRESTIGE.scoreMult * 100)}% 🏗️`;
    showModal(prestigeConfirmScreen);
}

function activatePrestige() {
    const result = performPrestige();
    if (!result.success) return;
    addCoins(result.coinsReward);
    pendingPrestigeRewards = Array.from({ length: result.chestsReward }, () => rollPrestigeChestReward());
    resetProgressForPrestige();
    level = 1; xpTotal = 0; highScore = 0; bestHeight = 0; totalScoreAllTime = 0; recentScores = [];
    safeSetItem('towerBestHeight', '0');
    stats.maxScore = 0; stats.maxCombo = 0; stats.maxTimeScore = 0;
    saveLevelProgress(); saveStats(); saveTotalScore(); saveRecentScores(); flushCloudSave();
    updateLevelUI(); updatePrestigeUI();
    if (highScoreEl) highScoreEl.innerText = `РЕКОРД: ${highScore}`;
    hideModal(prestigeConfirmScreen, { restoreMenu: false });
    playSound('prestige_activate'); triggerHaptic('success');
    flashTransition('rgba(255, 215, 0, 0.7)', 500);
    setTimeout(showPrestigeChestOpening, 800);
}

function showPrestigeChestOpening() {
    if (pendingPrestigeRewards.length === 0) { hideModal(prestigeChestScreen); startScreen.style.display = 'flex'; updateCoinUI(); return; }
    startScreen.style.display = 'none';
    showModal(prestigeChestScreen);
    if (prestigeChestIconEl) { prestigeChestIconEl.textContent = '🎁'; prestigeChestIconEl.style.animation = 'prestigeChestFloat 3s ease-in-out infinite'; }
    if (prestigeRewardTextEl) { prestigeRewardTextEl.textContent = ''; prestigeRewardTextEl.className = 'prestige-reward-text'; }
    if (openPrestigeChestBtn) openPrestigeChestBtn.style.display = 'block';
    if (closePrestigeChestBtn) closePrestigeChestBtn.style.display = 'none';
    const subEl = $('prestige-chest-sub');
    if (subEl) subEl.textContent = pendingPrestigeRewards.length === 1 ? 'Последний сундук!' : `Осталось сундуков: ${pendingPrestigeRewards.length}`;
}

function openPrestigeChest() {
    if (pendingPrestigeRewards.length === 0) return;
    const reward = pendingPrestigeRewards.shift();
    if (prestigeChestIconEl) prestigeChestIconEl.style.animation = 'chestOpenBurst 1s forwards';
    if (openPrestigeChestBtn) openPrestigeChestBtn.style.display = 'none';
    setTimeout(() => {
        applyPrestigeReward(reward, {
            addCoins: (a) => addCoins(a),
            addPowerup: (pu, c) => { ownedPowerups[pu] = (ownedPowerups[pu] || 0) + c; savePowerups(); },
            addSkin: (id) => { if (!unlockedSkins.includes(id)) { unlockedSkins.push(id); safeSetItem(STORAGE_KEYS.SKINS, unlockedSkins); scheduleCloudSave(); } },
            addChest: (t, m) => addChest(t, m),
            addPermanentBuff: (effect, value) => {
                const bonus = getPrestigeBonus();
                if (effect === 'coin_boost') bonus.coinMult += value;
                else if (effect === 'xp_boost') bonus.xpMult += value;
                else if (effect === 'all_boost') bonus.allMult += value;
                setPrestigeBonus(bonus); scheduleCloudSave();
            },
        });
        if (prestigeChestIconEl) { prestigeChestIconEl.textContent = reward.legendary ? '✨' : '🎁'; prestigeChestIconEl.style.animation = ''; }
        if (prestigeRewardTextEl) { prestigeRewardTextEl.textContent = reward.text; prestigeRewardTextEl.className = 'prestige-reward-text' + (reward.legendary ? ' legendary' : ''); }
        playSound(reward.legendary ? 'victory' : 'chest'); triggerHaptic('success');
        if (pendingPrestigeRewards.length > 0 && openPrestigeChestBtn) { openPrestigeChestBtn.textContent = 'ОТКРЫТЬ ЕЩЁ'; openPrestigeChestBtn.style.display = 'block'; }
        else if (closePrestigeChestBtn) closePrestigeChestBtn.style.display = 'block';
        updateCoinUI(); updatePrestigeUI();
    }, 1000);
}

function handleLevelMilestones(oldLevel, newLevel) {
    checkNewMilestones(oldLevel, newLevel).forEach((mLvl, i) => {
        setTimeout(() => {
            const n = document.createElement('div');
            n.className = 'milestone-notification';
            n.innerHTML = `<div class="milestone-notification-icon">📦</div><div class="milestone-notification-title">УРОВЕНЬ ${mLvl}!</div><div class="milestone-notification-desc">Ты получил редкий сундук!</div>`;
            document.body.appendChild(n);
            requestAnimationFrame(() => n.classList.add('show'));
            setTimeout(() => { n.classList.remove('show'); setTimeout(() => n.remove(), 500); }, 2500);
            addChest('milestone', { level: mLvl, rare: true });
            playSound('chest'); triggerHaptic('success');
        }, i * 1500);
    });
}

// ============ СОБЫТИЯ ============
function initEvents() {
    if (!isEventsSystemActive()) return;
    currentEvent = getCurrentEvent();
    renderEventBanner();
    if (eventNotificationInterval) clearInterval(eventNotificationInterval);
    eventNotificationInterval = setInterval(() => {
        const nextEv = getCurrentEvent();
        if (nextEv?.id !== currentEvent?.id) {
            currentEvent = nextEv; renderEventBanner();
        } else renderEventBanner();
    }, 5 * 60 * 1000);
}

function shadeEventColor(hex, percent) {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.max(0, Math.min(255, (num >> 16) + percent));
    const g = Math.max(0, Math.min(255, ((num >> 8) & 0x00FF) + percent));
    const b = Math.max(0, Math.min(255, (num & 0x0000FF) + percent));
    return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

function renderEventBanner() {
    if (!eventBannerEl) return;
    if (!currentEvent) { eventBannerEl.style.display = 'none'; return; }
    eventBannerEl.style.display = 'block';
    eventBannerEl.style.setProperty('--event-color', currentEvent.color);
    eventBannerEl.style.setProperty('--event-color-dark', shadeEventColor(currentEvent.color, -30));
    eventBannerEl.classList.toggle('holiday', Boolean(currentEvent.isHoliday));
    if (eventIconEl) eventIconEl.textContent = currentEvent.icon;
    if (eventLabelEl) eventLabelEl.textContent = currentEvent.isHoliday ? 'ПРАЗДНИК' : 'СЕЗОН';
    if (eventNameEl) eventNameEl.textContent = currentEvent.name;
    if (eventDescEl) eventDescEl.textContent = currentEvent.description;
    const progress = getEventProgress(currentEvent), evStats = getEventStats(currentEvent);
    if (eventBadgeEl) { eventBadgeEl.textContent = `${evStats.claimed}/${evStats.total}`; eventBadgeEl.classList.toggle('holiday-badge', Boolean(currentEvent.isHoliday)); }
    if (eventProgressFillEl) eventProgressFillEl.style.width = `${progress.progress}%`;
    if (eventProgressTextEl) eventProgressTextEl.textContent = `День ${progress.currentDay}`;
}

function showEventDetails() {
    if (!currentEvent) return;
    if (eventModalIconEl) eventModalIconEl.textContent = currentEvent.icon;
    if (eventTitleEl) eventTitleEl.textContent = currentEvent.name;
    if (eventModalDescEl) eventModalDescEl.textContent = currentEvent.description;
    if (eventModalDatesEl) eventModalDatesEl.textContent = formatEventDate(currentEvent);
    renderEventRewardsTimeline();
    showModal(eventScreen);
}

function renderEventRewardsTimeline() {
    if (!eventRewardsTimelineEl || !currentEvent) return;
    eventRewardsTimelineEl.innerHTML = '';
    getAvailableRewards(currentEvent).forEach(reward => {
        const item = document.createElement('div');
        item.className = 'event-reward-item ' + (reward.isClaimed ? 'claimed' : reward.isAvailable ? 'available' : 'locked');
        const actionHtml = reward.isClaimed ? '<span class="event-claimed-badge">✓ Получено</span>' : reward.canClaim ? `<button class="event-claim-btn" data-reward-index="${reward.index}">ЗАБРАТЬ</button>` : `<span class="event-locked-badge">День ${reward.day}</span>`;
        const icon = { coins: '🪙', powerup: '⚡', skin: '🎨', chest: '📦' }[reward.type] || '🎁';
        item.innerHTML = `<div class="event-reward-day">${reward.day}</div><div class="event-reward-content"><span class="event-reward-text">${icon} ${reward.text}</span><span class="event-reward-sub">${reward.isAvailable ? 'Доступно' : `Откроется на день ${reward.day}`}</span></div><div class="event-reward-action">${actionHtml}</div>`;
        eventRewardsTimelineEl.appendChild(item);
    });
    eventRewardsTimelineEl.querySelectorAll('.event-claim-btn').forEach(btn => {
        safeClick(btn, () => {
            const res = claimEventReward(currentEvent.id, parseInt(btn.dataset.rewardIndex), {
                addCoins: (a) => addCoins(a),
                addPowerup: (pu, c) => { ownedPowerups[pu] = (ownedPowerups[pu] || 0) + c; savePowerups(); },
                addSkin: (id) => { if (!unlockedSkins.includes(id)) { unlockedSkins.push(id); safeSetItem(STORAGE_KEYS.SKINS, unlockedSkins); scheduleCloudSave(); } },
                addChest: (t, m) => addChest(t, m),
            });
            if (res.success) {
                stats.eventsRewards = (stats.eventsRewards || 0) + 1; saveStats();
                playSound('event_reward'); triggerHaptic('success');
                showPopup(bonusText, `🎁 ${res.reward.text}`, 1500);
                renderEventRewardsTimeline(); renderEventBanner(); updateCoinUI(); checkAchievements();
            }
        });
    });
}

// ============ МИНИ-ИГРЫ И ОБЛАКО ============
function stopActiveMinigame() { if (activeMinigame?.destroy) activeMinigame.destroy(); activeMinigame = null; }
function stopMinigamesCooldownTimer() { if (minigamesCooldownInterval) { clearInterval(minigamesCooldownInterval); minigamesCooldownInterval = null; } }

function renderMinigamesList() {
    if (!minigamesListEl || !minigamesStatusEl) return;
    stopActiveMinigame();
    minigameStageEl.style.display = 'none'; minigameStageEl.innerHTML = '';
    minigameResultEl.style.display = 'none'; minigamesListEl.style.display = 'flex';
    const status = canPlayMinigame(), playsLeft = getRemainingDailyPlays();
    minigamesStatusEl.classList.toggle('cooldown', !status.canPlay);
    minigamesStatusEl.textContent = status.canPlay ? `🎮 Доступно сегодня: ${playsLeft} / 10` : status.reason === 'cooldown' ? `⏳ Перезарядка: ${formatCooldown(getCooldownRemaining())} · Осталось: ${playsLeft}` : '🌙 Дневной лимит мини-игр исчерпан. Возвращайся завтра!';
    minigamesListEl.innerHTML = '';
    MINIGAMES.forEach(mg => {
        const card = document.createElement('div');
        card.className = 'minigame-card' + (status.canPlay ? '' : ' disabled');
        card.innerHTML = `<div class="minigame-card-icon" style="background:${mg.color}">${mg.icon}</div><div class="minigame-card-info"><span class="minigame-card-name">${mg.name}</span><span class="minigame-card-desc">${mg.desc}</span><span class="minigame-card-reward">до +${Math.round(mg.reward.coins * 1.5)} 🪙 · +${Math.round(mg.reward.xp * 1.5)} ⭐</span></div><button class="minigame-play-btn" data-mg-id="${mg.id}" ${status.canPlay ? '' : 'disabled'}>ИГРАТЬ</button>`;
        minigamesListEl.appendChild(card);
    });
    minigamesListEl.querySelectorAll('.minigame-play-btn').forEach(btn => { if (!btn.disabled) safeClick(btn, () => startMinigame(btn.dataset.mgId)); });
}

function startMinigame(gameId) {
    const gameDef = MINIGAMES.find(m => m.id === gameId);
    if (!gameDef || !canPlayMinigame().canPlay) return;
    stopMinigamesCooldownTimer();
    minigamesListEl.style.display = 'none'; minigameResultEl.style.display = 'none'; minigameStageEl.style.display = 'block';
    minigamesStatusEl.textContent = `${gameDef.icon} ${gameDef.name}`;
    activeMinigame = createMinigame(gameId, minigameStageEl, (result) => {
        activeMinigame = null; recordMinigamePlay();
        updateMissionProgress(missions, 'minigame_play', 1);
        const reward = calculateMinigameReward(gameDef, result);
        if (reward.coins > 0) addCoins(reward.coins);
        if (reward.xp > 0) addXP(reward.xp);
        if (result.success) { stats.minigamesWon = (stats.minigamesWon || 0) + 1; saveStats(); checkAchievements(); }
        playSound(result.success ? 'quest' : 'drop'); triggerHaptic(result.success ? 'success' : 'light');
        minigameStageEl.style.display = 'none'; minigameResultEl.style.display = 'flex';
        minigameResultEl.innerHTML = `<div class="minigame-result-title">${result.success ? '🎉 Отлично!' : '👍 Неплохо!'}</div><div class="minigame-result-msg">${result.message}</div><div class="minigame-result-reward">+${reward.coins} 🪙 &nbsp;·&nbsp; +${reward.xp} ⭐</div><button id="minigame-back-btn" class="btn-primary">К СПИСКУ ИГР</button>`;
        safeClick($('minigame-back-btn'), () => { renderMinigamesList(); startMinigamesCooldownTimer(); });
    });
}

function startMinigamesCooldownTimer() {
    stopMinigamesCooldownTimer();
    minigamesCooldownInterval = setInterval(() => {
        if (!minigamesScreen?.classList.contains('open') || activeMinigame) { stopMinigamesCooldownTimer(); return; }
        const st = canPlayMinigame();
        if (st.reason === 'cooldown') minigamesStatusEl.textContent = `⏳ Перезарядка: ${formatCooldown(getCooldownRemaining())} · Осталось: ${getRemainingDailyPlays()}`;
        else if (st.canPlay && minigamesListEl.style.display !== 'none') { renderMinigamesList(); stopMinigamesCooldownTimer(); }
    }, 1000);
}

function updateCloudStatusUI() {
    const statusEl = $('cloud-sync-status'), syncBtn = $('cloud-sync-btn');
    if (statusEl) statusEl.textContent = getCloudStatus();
    if (syncBtn) {
        const av = isCloudStorageAvailable();
        syncBtn.dataset.on = String(av); syncBtn.disabled = !av; syncBtn.textContent = av ? 'СИНХР.' : 'НЕТ';
    }
}

function reloadFromLocalAfterCloudMerge() {
    coins = safeParseInt(safeGetItem(STORAGE_KEYS.COINS, '0'), 0);
    highScore = safeParseInt(safeGetItem(STORAGE_KEYS.HIGH_SCORE, '0'), 0);
    bestHeight = safeParseInt(safeGetItem('towerBestHeight', String(highScore)), highScore);
    level = safeParseInt(safeGetItem(STORAGE_KEYS.LEVEL, '1'), 1);
    xpTotal = safeParseInt(safeGetItem(STORAGE_KEYS.XP, '0'), 0);
    streak = safeParseInt(safeGetItem(STORAGE_KEYS.STREAK, '0'), 0);
    lastVisitDate = safeGetItem(STORAGE_KEYS.LAST_VISIT, '') || '';
    currentSkin = typeof safeGetItem(STORAGE_KEYS.SKIN, 'default') === 'string' ? safeGetItem(STORAGE_KEYS.SKIN, 'default') : 'default';
    if (!SKINS[currentSkin]) currentSkin = 'default';
    unlockedSkins = validateArray(safeGetItem(STORAGE_KEYS.SKINS, ['default']), ['default']);
    currentPalette = typeof safeGetItem(STORAGE_KEYS.PALETTE, 'standard') === 'string' ? safeGetItem(STORAGE_KEYS.PALETTE, 'standard') : 'standard';
    unlockedPalettes = validateArray(safeGetItem(STORAGE_KEYS.PALETTES, ['standard']), ['standard']);
    currentBackground = typeof safeGetItem(STORAGE_KEYS.BACKGROUND, 'default') === 'string' ? safeGetItem(STORAGE_KEYS.BACKGROUND, 'default') : 'default';
    unlockedBackgrounds = validateArray(safeGetItem(STORAGE_KEYS.BACKGROUNDS, ['default']), ['default']);
    unlockedFeatures = validateObject(safeGetItem(STORAGE_KEYS.FEATURES, {}), {});
    settings = { ...DEFAULT_SETTINGS, ...validateObject(safeGetItem(STORAGE_KEYS.SETTINGS, null), DEFAULT_SETTINGS) };
    stats = { ...DEFAULT_STATS, ...validateObject(safeGetItem(STORAGE_KEYS.STATS, null), DEFAULT_STATS) };
    if (!stats.modeMax || typeof stats.modeMax !== 'object') stats.modeMax = {};
    if (!stats.modeGames || typeof stats.modeGames !== 'object') stats.modeGames = {};
    unlockedAchievements = validateArray(safeGetItem(STORAGE_KEYS.ACHIEVEMENTS, []), []);
    leaderboard = validateArray(safeGetItem(STORAGE_KEYS.LEADERBOARD, []), []);
    ownedPowerups = { ...DEFAULTS.POWERUPS, ...validateObject(safeGetItem(STORAGE_KEYS.POWERUPS, null), {}) };
    chests = validateArray(safeGetItem(STORAGE_KEYS.CHESTS, []), []);
    loadUpgrades();
    if (highScoreEl) highScoreEl.innerText = `РЕКОРД: ${highScore}`;
    updateCoinUI(); updateLevelUI(); updateStreakUI(); updateChestUI(); updateWheelUI(); updateSettingsUI();
    applyBackground(); applySkinEffect();
    if (currentMenuTab === 'shop') renderShop();
    if (currentMenuTab === 'tasks') renderMissions();
}

// ============ THREE.JS СЦЕНА ============
function makeBlock(w, h, d, color, type = BLOCK_TYPES.NORMAL) {
    return createBlockMesh(w, h, d, color, type, {
        skin: currentSkin,
        pattern: SKINS[currentSkin]?.pattern || 'none',
        redTheme: Boolean(unlockedFeatures.redTheme),
        glowTexture,
    });
}

function initThree() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(getBgColors()[0]);
    const aspect = window.innerWidth / window.innerHeight;
    const d = safeGetAdaptiveD(aspect);
    camera = new THREE.OrthographicCamera(-d * aspect, d * aspect, d, -d, 1, 1000);
    camera.position.set(12, 12, 12);
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ antialias: !IS_MOBILE, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, IS_MOBILE ? 1.5 : 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.72));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.65);
    dirLight.position.set(10, 22, 14);
    scene.add(dirLight);

    glowTexture = createGlowTexture();
    perfectWaveTexture = createPerfectWaveTexture();
    applyBackground();
    applySkinEffect();
}

function getBlockVisuals(type, stepIndex = blocks.length) {
    if (type !== BLOCK_TYPES.NORMAL && BLOCK_COLORS[type]) return { color: BLOCK_COLORS[type] };
    const palette = currentPalette !== 'standard' ? getPaletteColors() : (SKINS[currentSkin]?.colors || BASE_COLORS);
    return { color: palette[stepIndex % palette.length] };
}

function generateNextBlockData() {
    let type = BLOCK_TYPES.NORMAL;
    if (dailyModifiers.onlyType) type = dailyModifiers.onlyType;
    else if (dailyModifiers.allIce) type = BLOCK_TYPES.ICE;
    else if (!dailyModifiers.noSpecials && blocks.length >= 2) {
        const luckMult = (activePowerups.luck ? 2 : 1) * (1 + getUpgradeBonuses().luckMult);
        const r = Math.random();
        const secretChance = 0.015 * luckMult;
        const goldChance = dailyModifiers.noGolden ? 0 : 0.09 * luckMult;
        const iceChance = 0.08;
        const bombChance = (dailyModifiers.noBombs || activePowerups.luck) ? 0 : 0.07;
        const crumbleChance = (score >= 15 && !activePowerups.luck && !dailyModifiers.noBombs) ? 0.06 : 0;
        if (r < secretChance) type = [BLOCK_TYPES.RAINBOW, BLOCK_TYPES.DRAGON, BLOCK_TYPES.DIAMOND][Math.floor(Math.random() * 3)];
        else if (r < secretChance + goldChance) type = BLOCK_TYPES.GOLDEN;
        else if (r < secretChance + goldChance + iceChance) type = BLOCK_TYPES.ICE;
        else if (r < secretChance + goldChance + iceChance + bombChance) type = BLOCK_TYPES.BOMB;
        else if (r < secretChance + goldChance + iceChance + bombChance + crumbleChance) type = BLOCK_TYPES.CRUMBLE;
    }
    return { type, color: getBlockVisuals(type, blocks.length + 1).color };
}

function updateNextBlockPreview(type, color) {
    const preview = $('next-block-preview');
    if (!preview) return;
    preview.style.background = color;
    preview.style.display = 'flex'; preview.style.alignItems = 'center'; preview.style.justifyContent = 'center'; preview.style.fontSize = '18px';
    preview.textContent = ({ bomb: '💣', golden: '👑', ice: '❄️', crumble: '🧱', rainbow: '🌈', dragon: '🐉', diamond: '💎' })[type] || '';
}

function disposeRecordLine() {
    if (!recordLineGroup) return;
    recordLineGroup.traverse(obj => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) { if (obj.material.map) obj.material.map.dispose(); obj.material.dispose(); }
    });
    scene.remove(recordLineGroup);
    recordLineGroup = null;
}

function createRecordLine() {
    disposeRecordLine();
    recordLinePassed = false;
    const targetHeight = Math.max(bestHeight, 0);
    if (targetHeight < 3 || highScore <= 0) return;
    const group = new THREE.Group();
    group.position.set(0, targetHeight * BLOCK_HEIGHT + BLOCK_HEIGHT * 0.5, 0);
    const half = currentBaseSize * 0.5 + 0.7;
    const pts = [new THREE.Vector3(-half, 0, -half), new THREE.Vector3(half, 0, -half), new THREE.Vector3(half, 0, half), new THREE.Vector3(-half, 0, half)];
    const lineMat = new THREE.LineBasicMaterial({ color: 0xFFD700, transparent: true, opacity: 0.9 });
    group.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), lineMat));

    const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(255, 215, 0, 0.95)'; ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 4;
    if (typeof ctx.roundRect === 'function') { ctx.beginPath(); ctx.roundRect(6, 8, 244, 48, 24); ctx.fill(); ctx.stroke(); }
    else { ctx.fillRect(6, 8, 244, 48); ctx.strokeRect(6, 8, 244, 48); }
    ctx.fillStyle = '#4A3200'; ctx.font = '900 24px Rubik, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(`👑 РЕКОРД: ${highScore}`, 128, 33);

    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthTest: false }));
    sprite.position.set(half + 1.8, 0.45, -half * 0.4); sprite.scale.set(4.4, 1.1, 1);
    group.add(sprite);
    group.userData = { ringMat: lineMat, sprite };
    scene.add(group);
    recordLineGroup = group;
}

function clearScene() {
    blocks.forEach(m => disposeMesh(m, scene));
    debris.forEach(m => disposeMesh(m, scene));
    confetti.forEach(m => disposeMesh(m, scene));
    perfectWaves.forEach(w => { if (w.material) w.material.dispose(); scene.remove(w); });
    disposeRecordLine();
    try { disposeAtmosphereLayers(scene); } catch (e) {}
    if (currentBlock) { disposeMesh(currentBlock, scene); currentBlock = null; }
    blocks = []; debris = []; confetti = []; perfectWaves = [];
}

// ============ ВЕТЕР И ПОПАПЫ ============
function updateWindUI() {
    if (!windIndicatorEl || !windFillEl) return;
    if (gameMode !== GAME_MODES.STORM || gameState !== GAME_STATES.PLAYING) { windIndicatorEl.style.display = 'none'; return; }
    windIndicatorEl.style.display = 'flex';
    const pct = Math.min(100, Math.round((Math.abs(windStrength) / 0.085) * 100));
    windFillEl.style.width = `${pct}%`;
    const l = $('wind-left'), r = $('wind-right');
    if (l) l.classList.toggle('active', windDirection < 0 && windStrength > 0.005);
    if (r) r.classList.toggle('active', windDirection > 0 && windStrength > 0.005);
    windIndicatorEl.classList.toggle('wind-strong', pct >= 65);
}

function startWindSystem() {
    stopWindSystem();
    if (gameMode !== GAME_MODES.STORM) return;
    windStrength = 0.02 * (1 - getUpgradeBonuses().windResist);
    windDirection = Math.random() < 0.5 ? -1 : 1;
    updateWindUI();
    windGustTimer = setInterval(() => {
        if (gameState !== GAME_STATES.PLAYING) return;
        windDirection = Math.random() < 0.5 ? -1 : 1;
        const heightScale = Math.min(1, score / 45);
        windStrength = (0.02 + Math.random() * (0.04 + heightScale * 0.025)) * (1 - getUpgradeBonuses().windResist);
        if (windStrength > 0.055) playSound('gust');
        updateWindUI();
    }, 4500);
}

function stopWindSystem() {
    if (windGustTimer) { clearInterval(windGustTimer); windGustTimer = null; }
    windStrength = 0;
    setWindVolume(0);
    updateWindUI();
}

const popupTimers = new WeakMap();
function showPopup(el, text, duration = 900) {
    if (!el) return;
    el.innerText = text;
    el.classList.remove('show-popup');
    const prev = popupTimers.get(el);
    if (prev) clearTimeout(prev);
    requestAnimationFrame(() => {
        el.classList.add('show-popup');
        popupTimers.set(el, setTimeout(() => { el.classList.remove('show-popup'); popupTimers.delete(el); }, duration));
    });
}
function triggerScreenFlash(duration = 120) {
    if (!screenFlash) return;
    screenFlash.style.opacity = '0.55';
    setTimeout(() => { screenFlash.style.opacity = '0'; }, duration);
}

// ============ СТАРТ ИГРЫ И ХОД ============
function createBaseBlock() {
    const { color } = getBlockVisuals(BLOCK_TYPES.NORMAL, 0);
    const base = makeBlock(currentBaseSize, BLOCK_HEIGHT, currentBaseSize, color, BLOCK_TYPES.NORMAL);
    base.position.set(0, 0, 0);
    Object.assign(base.userData, { w: currentBaseSize, d: currentBaseSize, color, blockType: BLOCK_TYPES.NORMAL });
    scene.add(base); blocks.push(base);
}

function spawnNewBlock(overrideSize = null) {
    const top = blocks[blocks.length - 1];
    movingAxis = blocks.length % 2 === 1 ? 'x' : 'z';
    let { type, color } = nextBlockData;
    nextBlockData = generateNextBlockData();
    updateNextBlockPreview(nextBlockData.type, nextBlockData.color);
    if (overrideSize && (type === BLOCK_TYPES.BOMB || type === BLOCK_TYPES.CRUMBLE)) {
        type = BLOCK_TYPES.NORMAL; color = getBlockVisuals(BLOCK_TYPES.NORMAL).color;
    }
    const w = overrideSize ? overrideSize.w : top.userData.w;
    const d = overrideSize ? overrideSize.d : top.userData.d;
    const mirrorSign = (gameMode === GAME_MODES.MIRROR || (gameMode === MODE_ANTIGRAVITY && Math.floor((blocks.length - 1) / 15) % 2 === 1)) ? -1 : 1;
    let sx = top.position.x, sz = top.position.z;
    if (movingAxis === 'x') sx = (direction === 1 ? -CFG.MOVE_RANGE : CFG.MOVE_RANGE) * mirrorSign;
    else sz = (direction === 1 ? -CFG.MOVE_RANGE : CFG.MOVE_RANGE) * mirrorSign;
    currentBlock = makeBlock(w, BLOCK_HEIGHT, d, color, type);
    currentBlock.position.set(sx, top.position.y + BLOCK_HEIGHT, sz);
    Object.assign(currentBlock.userData, { w, d, moving: true, color, blockType: type, squash: 1 });
    scene.add(currentBlock);
}

function startGame(mode = gameMode) {
    clearGameOverTimers();
    if (secondChanceRaf) { cancelAnimationFrame(secondChanceRaf); secondChanceRaf = null; }
    if (timeAttackTimer) { clearInterval(timeAttackTimer); timeAttackTimer = null; }

    gameMode = mode;
    gameState = GAME_STATES.PLAYING;
    document.body.classList.add('in-game');
    document.body.classList.remove('fury-active');

    startScreen.style.display = 'none';
    hideModal(gameOverEl, { restoreMenu: false });
    hideModal(pauseScreen, { restoreMenu: false });
    hideModal(secondChanceOverlay, { restoreMenu: false });
    hideTowerHeightBanner();

    if (dailyModifiers.forceBg && !savedBgBeforeDaily) { savedBgBeforeDaily = currentBackground; currentBackground = dailyModifiers.forceBg; applyBackground(); }
    if (dailyModifiers.forcePalette && !savedPaletteBeforeDaily) { savedPaletteBeforeDaily = currentPalette; currentPalette = dailyModifiers.forcePalette; }

    clearScene();
    score = 0; combo = 0; runPerfects = 0;
    runStartPerfects = 0; runStartBroken = false;
    sessionCoins = 0; sessionXP = 0;
    direction = 1; isFury = false; furyBlocksLeft = 0;
    secondChanceUsed = false; secondChanceActive = false;
    overviewActive = false; overviewSkipped = false;
    shakeIntensity = 0; cameraZoomPulse = 0; currentBiomeIndex = 0;
    cameraAngle = Math.PI / 4; targetCameraAngle = Math.PI / 4;

    const upg = getUpgradeBonuses();
    let baseSize = dailyModifiers.baseSize || BLOCK_SIZE;
    if (activePowerups.foundation) baseSize *= 1.35;
    baseSize *= (1 + upg.baseSizeMult);
    currentBaseSize = baseSize;

    const skinMods = getSkinModifiers();
    let startSpeed = dailyModifiers.startSpeed || BASE_SPEED;
    if (gameMode === GAME_MODES.STORM) startSpeed *= 1.1;
    if (gameMode === GAME_MODES.MIRROR || gameMode === MODE_ANTIGRAVITY) startSpeed *= 1.12;
    if (dailyModifiers.speedMult) startSpeed *= dailyModifiers.speedMult;
    if (skinMods.speedMult) startSpeed *= skinMods.speedMult;
    currentSpeed = startSpeed * getSmartDifficultyMultiplier();
    dynamicMaxSpeed = gameMode === GAME_MODES.ENDLESS ? CFG.ENDLESS_MAX_SPEED : CFG.DEFAULT_MAX_SPEED;

    const bgColors = getBgColors();
    targetBgColor.set(bgColors[0]);
    if (scene) scene.background.set(bgColors[0]);
    document.body.style.background = bgColors[0];
    syncTelegramTheme(bgColors[0]);

    camera.zoom = 1;
    camera.position.set(12, 12, 12);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();

    if (scoreEl) scoreEl.innerText = '0';
    if (highScoreEl) highScoreEl.innerText = `РЕКОРД: ${highScore}`;
    if (modeLabel) {
        modeLabel.innerText = dailyChallengeActive ? `📅 ${getDailyChallenge().name.toUpperCase()}` : gameMode === MODE_ANTIGRAVITY ? '🪐 АНТИГРАВИТАЦИЯ' : (GAME_MODE_NAMES[gameMode] || 'КЛАССИКА');
    }
    updateCoinUI(); updateComboIndicator(); updateActivePowerupsUI(); updateContractHUD(); cacheCoinPopupAnchor();

    const timeLimit = dailyModifiers.timeLimit || (gameMode === GAME_MODES.TIME ? CFG.DEFAULT_TIME_LIMIT + upg.extraTime : 0);
    if (timeLimit > 0 && timerEl) {
        timeLeft = timeLimit; timerEl.style.display = 'block'; timerEl.innerText = `⏱ ${timeLeft}`;
        timeAttackTimer = setInterval(() => {
            if (gameState !== GAME_STATES.PLAYING) return;
            timeLeft--; timerEl.innerText = `⏱ ${timeLeft}`;
            if (timeLeft <= 0) { clearInterval(timeAttackTimer); timeAttackTimer = null; triggerGameOver(); }
        }, 1000);
    } else if (timerEl) timerEl.style.display = 'none';

    if (tutorialEl) tutorialEl.style.display = showTutorialHint ? 'block' : 'none';

    createBaseBlock();
    createRecordLine();
    try { initAtmosphereLayers(scene, BLOCK_HEIGHT, lowPerfMode); } catch (e) {}
    nextBlockData = generateNextBlockData();
    spawnNewBlock();

    initAudio(); startMusic(CFG.MUSIC_BASE_TEMPO); startWindSystem(); startRenderLoop();

    stats.totalGames = (stats.totalGames || 0) + 1;
    stats.modeGames[gameMode] = (stats.modeGames[gameMode] || 0) + 1;
    saveStats();
    updateQuest('games', 1);
    if (gameMode === GAME_MODES.TIME) updateQuest('time_game', 1);
    updateMissionProgress(missions, 'games', 1);
    updateTelegramBackButton();
}

function createDebris(diff, origSize, newSize, axis, top) {
    const dSize = origSize - newSize;
    if (dSize <= 0.01) return;
    const mesh = new THREE.Mesh(SHARED_UNIT_BOX_GEO, getDebrisMaterial(currentBlock.userData.color));
    mesh.scale.set(axis === 'x' ? dSize : currentBlock.userData.w, BLOCK_HEIGHT, axis === 'z' ? dSize : currentBlock.userData.d);
    const px = axis === 'x' ? (diff > 0 ? top.position.x + origSize / 2 + dSize / 2 : top.position.x - origSize / 2 - dSize / 2) : currentBlock.position.x;
    const pz = axis === 'z' ? (diff > 0 ? top.position.z + origSize / 2 + dSize / 2 : top.position.z - origSize / 2 - dSize / 2) : currentBlock.position.z;
    mesh.position.set(px, currentBlock.position.y, pz);
    mesh.userData = { sharedGeometry: true, sharedMaterial: true, vel: new THREE.Vector3(axis === 'x' ? (diff > 0 ? 0.15 : -0.15) : 0, 0.1, axis === 'z' ? (diff > 0 ? 0.15 : -0.15) : 0), rotSpeed: new THREE.Vector3((Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3) };
    scene.add(mesh); debris.push(mesh);
    enforceParticleLimits(debris, lowPerfMode ? 12 : PARTICLE_LIMITS.MAX_DEBRIS, m => disposeMesh(m, scene));
}

function spawnPerfectWave(x, y, z, w, d, color = '#FFFFFF') {
    if (lowPerfMode) return;
    const wave = new THREE.Mesh(PARTICLE_GEOS.wave, new THREE.MeshBasicMaterial({ map: perfectWaveTexture, color: unlockedFeatures.goldenTrail ? '#FFD700' : color, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }));
    wave.rotation.x = -Math.PI / 2; wave.position.set(x, y - BLOCK_HEIGHT * 0.45, z); wave.scale.set(w * 1.05, d * 1.05, 1);
    wave.userData = { age: 0, baseW: w, baseD: d };
    scene.add(wave); perfectWaves.push(wave);
}

function spawnConfetti(count = 16, originPos = null) {
    if (lowPerfMode) count = Math.min(count, 6);
    const top = originPos || (blocks.length > 0 ? blocks[blocks.length - 1].position : new THREE.Vector3());
    for (let i = 0; i < count; i++) {
        const m = new THREE.Mesh(PARTICLE_GEOS.confetti, getParticleMaterial(CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)]));
        m.position.set(top.x + (Math.random() - 0.5) * 2.5, top.y + 0.5 + Math.random() * 1.5, top.z + (Math.random() - 0.5) * 2.5);
        m.userData = { sharedGeometry: true, sharedMaterial: true, vel: new THREE.Vector3((Math.random() - 0.5) * 0.28, 0.18 + Math.random() * 0.25, (Math.random() - 0.5) * 0.28), rot: new THREE.Vector3(Math.random() * 0.3, Math.random() * 0.3, Math.random() * 0.3), life: 1.0 };
        scene.add(m); confetti.push(m);
    }
    enforceParticleLimits(confetti, lowPerfMode ? 24 : PARTICLE_LIMITS.MAX_CONFETTI, m => disposeMesh(m, scene));
}

function spawnBombParticles() {
    const pos = currentBlock ? currentBlock.position : new THREE.Vector3();
    const colors = ['#FF1744', '#FF9100', '#FFD600', '#212121'];
    for (let i = 0; i < (lowPerfMode ? 8 : 18); i++) {
        const m = new THREE.Mesh(PARTICLE_GEOS.bomb, getParticleMaterial(colors[i % 4]));
        m.position.copy(pos);
        m.userData = { sharedGeometry: true, sharedMaterial: true, vel: new THREE.Vector3((Math.random() - 0.5) * 0.4, 0.15 + Math.random() * 0.35, (Math.random() - 0.5) * 0.4), rot: new THREE.Vector3(Math.random() * 0.4, Math.random() * 0.4, Math.random() * 0.4), life: 0.9 };
        scene.add(m); confetti.push(m);
    }
    shakeIntensity = Math.max(shakeIntensity, 0.65); triggerScreenFlash(160);
    enforceParticleLimits(confetti, lowPerfMode ? 24 : PARTICLE_LIMITS.MAX_CONFETTI, m => disposeMesh(m, scene));
}

function activateFury() {
    if (dailyModifiers.noFury) return;
    isFury = true; furyBlocksLeft = CFG.FURY_BLOCKS;
    document.body.classList.add('fury-active');
    showPopup(comboText, '🔥 РЕЖИМ ЯРОСТИ! x2 ОЧКИ', 1400);
    playSound('fury'); triggerHaptic('heavy');
    stats.totalFury = (stats.totalFury || 0) + 1; saveStats();
    updateQuest('fury', 1); updateMissionProgress(missions, 'fury', 1); checkAchievements();
}

function triggerMilestone(points) {
    const bgColors = getBgColors(), newBiome = Math.floor(points / 10) % bgColors.length;
    if (newBiome !== currentBiomeIndex) {
        currentBiomeIndex = newBiome; targetBgColor.set(bgColors[newBiome]);
        document.body.style.background = bgColors[newBiome]; syncTelegramTheme(bgColors[newBiome]);
    }
    showPopup(milestoneText, `🎉 ${points} ЭТАЖЕЙ!`, 1200);
    playSound('milestone'); spawnConfetti(22); triggerHaptic('success');
}

// ============ ВТОРОЙ ШАНС И GAME OVER ============
function canOfferSecondChance() {
    if (secondChanceUsed || secondChanceActive || dailyChallengeActive || gameMode === GAME_MODES.PRECISION) return false;
    if (coins < getSecondChanceCost()) return false;
    return score >= CFG.SECOND_CHANCE_MIN_SCORE || (highScore > 0 && score >= Math.max(5, highScore - CFG.SECOND_CHANCE_NEAR_RECORD));
}

function offerSecondChance(reason = 'miss') {
    secondChanceActive = true; gameState = GAME_STATES.PAUSED; document.body.classList.remove('in-game');
    if (timeAttackTimer) { clearInterval(timeAttackTimer); timeAttackTimer = null; }
    if (secondChanceSubEl) secondChanceSubEl.textContent = reason === 'crumble' ? '🧱 Хрупкий блок разрушился от идеала! Продолжить?' : `Промах! Отличная башня (${score} очк.) — продолжить?`;
    if (secondChanceBuyBtn) secondChanceBuyBtn.textContent = `💖 ПРОДОЛЖИТЬ (${getSecondChanceCost()} 🪙)`;
    showModal(secondChanceOverlay);
    secondChanceEndTime = performance.now() + CFG.SECOND_CHANCE_DURATION;
    function tick(now) {
        if (!secondChanceActive) return;
        const left = Math.max(0, secondChanceEndTime - now);
        if (secondChanceTimerFill) secondChanceTimerFill.style.transform = `scaleX(${left / CFG.SECOND_CHANCE_DURATION})`;
        if (left <= 0) { declineSecondChance(); return; }
        secondChanceRaf = requestAnimationFrame(tick);
    }
    secondChanceRaf = requestAnimationFrame(tick);
}

function acceptSecondChance() {
    const cost = getSecondChanceCost();
    if (!secondChanceActive || coins < cost) { declineSecondChance(); return; }
    secondChanceActive = false; secondChanceUsed = true;
    if (secondChanceRaf) { cancelAnimationFrame(secondChanceRaf); secondChanceRaf = null; }
    coins -= cost; safeSetItem(STORAGE_KEYS.COINS, coins); scheduleCloudSave(); updateCoinUI();
    if (currentBlock) { disposeMesh(currentBlock, scene); currentBlock = null; }
    hideModal(secondChanceOverlay, { restoreMenu: false });
    gameState = GAME_STATES.PLAYING; document.body.classList.add('in-game'); combo = 0; updateComboIndicator();
    const s = currentBaseSize * (0.4 + Math.random() * 0.1);
    spawnNewBlock({ w: s, d: s });
    if (gameMode === GAME_MODES.TIME && timeLeft > 0) {
        timeAttackTimer = setInterval(() => {
            if (gameState !== GAME_STATES.PLAYING) return;
            timeLeft--; if (timerEl) timerEl.innerText = `⏱ ${timeLeft}`;
            if (timeLeft <= 0) { clearInterval(timeAttackTimer); timeAttackTimer = null; triggerGameOver(); }
        }, 1000);
    }
    playSound('quest'); triggerHaptic('success'); showPopup(bonusText, '💖 ВТОРОЙ ШАНС!', 1200); updateTelegramBackButton();
}

function declineSecondChance() {
    if (!secondChanceActive) return;
    secondChanceActive = false; secondChanceUsed = true;
    if (secondChanceRaf) { cancelAnimationFrame(secondChanceRaf); secondChanceRaf = null; }
    hideModal(secondChanceOverlay, { restoreMenu: false });
    triggerGameOver();
}

function showTowerHeightBanner(meters) {
    if (!towerHeightBanner) return;
    if (towerHeightMetersEl) towerHeightMetersEl.textContent = `🏗️ Высота: ${meters} м`;
    if (towerHeightCompareEl) towerHeightCompareEl.textContent = getHeightComparison(meters);
    towerHeightBanner.classList.add('show');
}
function hideTowerHeightBanner() { if (towerHeightBanner) towerHeightBanner.classList.remove('show'); }
function skipTowerOverview() {
    if (gameState !== GAME_STATES.GAMEOVER || !overviewActive || overviewSkipped || performance.now() < overviewSkipReadyAt) return;
    overviewSkipped = true; clearGameOverTimers(); hideTowerHeightBanner(); playLoseAnimation();
    gameOverTimers.push(setTimeout(() => showModal(gameOverEl), 120));
}
function playLoseAnimation() { if (currentBlock) currentBlock.userData.falling = true; shakeIntensity = Math.max(shakeIntensity, 0.55); }

function triggerGameOver() {
    if (gameState === GAME_STATES.GAMEOVER) return;
    gameState = GAME_STATES.GAMEOVER;
    document.body.classList.remove('in-game', 'fury-active');
    stopMusic(); stopWindSystem();
    if (timeAttackTimer) { clearInterval(timeAttackTimer); timeAttackTimer = null; }
    playSound('gameover'); triggerHaptic('error');

    const isNewRecord = score > highScore;
    if (isNewRecord) {
        highScore = score; safeSetItem(STORAGE_KEYS.HIGH_SCORE, highScore);
        if (highScoreEl) highScoreEl.innerText = `РЕКОРД: ${highScore}`;
        if (victoryCrownEl) { victoryCrownEl.classList.remove('show'); requestAnimationFrame(() => victoryCrownEl.classList.add('show')); playSound('victory'); }
    }
    const builtMeters = Math.max(0, blocks.length - 1);
    if (builtMeters > bestHeight) { bestHeight = builtMeters; safeSetItem('towerBestHeight', String(bestHeight)); }
    if (score > (stats.maxScore || 0)) stats.maxScore = score;
    if (score > (stats.modeMax[gameMode] || 0)) stats.modeMax[gameMode] = score;
    if (gameMode === GAME_MODES.TIME && score > (stats.maxTimeScore || 0)) stats.maxTimeScore = score;
    saveStats(); totalScoreAllTime += score; saveTotalScore(); trackGameScore(score); addToLeaderboard(score, gameMode);

    addXP(Math.max(5, Math.round(score * 3 + combo * 2)));
    updateMissionProgress(missions, 'score', score, true);
    checkAchievements(); flushCloudSave();

    let contractNote = '';
    if (activeContract) {
        contractNote = activeContract.completed
            ? ` · 📜 Контракт +${activeContract.contract.reward} 🪙`
            : ` · 📜 Контракт не выполнен`;
        activeContract = null;
        updateContractHUD();
    }

    if (finalScoreVal) finalScoreVal.innerText = score;
    if (gameCoinsEarnedEl) gameCoinsEarnedEl.innerText = `+${sessionCoins} 🪙 за игру${contractNote}`;
    if (gameXPEarnedEl) gameXPEarnedEl.innerText = `+${sessionXP} опыта`;
    if (gameOverHeightEl) gameOverHeightEl.innerText = builtMeters > 0 ? `🏗️ Высота: ${builtMeters} м · ${getHeightComparison(builtMeters)}` : '';
    const nrEl = $('new-record'); if (nrEl) nrEl.style.display = isNewRecord ? 'block' : 'none';

    restoreDailyVisuals(); dailyChallengeActive = false; dailyModifiers = {};
    updatePowerupReplayButton(); clearGameOverTimers();

    if (builtMeters >= 3) {
        const d = safeGetAdaptiveD(window.innerWidth / window.innerHeight);
        const topY = blocks.length > 0 ? blocks[blocks.length - 1].position.y : 0;
        overviewTargetY = topY * 0.5;
        overviewTargetZoom = Math.max(0.24, Math.min(1, (d * 1.45) / Math.max(1, topY + 5)));
        overviewActive = true; overviewSkipped = false; overviewSkipReadyAt = performance.now() + 250;
        blocks.forEach(b => { b.visible = true; });
        showTowerHeightBanner(builtMeters);
        gameOverTimers.push(setTimeout(() => { hideTowerHeightBanner(); playLoseAnimation(); }, 1650));
        gameOverTimers.push(setTimeout(() => showModal(gameOverEl), 2050));
    } else {
        playLoseAnimation();
        gameOverTimers.push(setTimeout(() => showModal(gameOverEl), 450));
    }
    updateTelegramBackButton();
}

// ============ DROP BLOCK ============
function dropBlock() {
    if (gameState !== GAME_STATES.PLAYING || !currentBlock || !currentBlock.userData.moving) return;
    if (showTutorialHint) { showTutorialHint = false; safeSetItem(STORAGE_KEYS.TUTORIAL_SHOWN, true); if (tutorialEl) tutorialEl.style.display = 'none'; }

    currentBlock.userData.moving = false;
    const top = blocks[blocks.length - 1];
    const bType = currentBlock.userData.blockType, prevColor = currentBlock.userData.color;
    const diffX = currentBlock.position.x - top.position.x, diffZ = currentBlock.position.z - top.position.z;
    const absDiffX = Math.abs(diffX), absDiffZ = Math.abs(diffZ);
    const maxDiff = movingAxis === 'x' ? absDiffX : absDiffZ;
    const sizeX = currentBlock.userData.w, sizeZ = currentBlock.userData.d;

    const missX = movingAxis === 'x' && absDiffX >= sizeX - 0.08;
    const missZ = movingAxis === 'z' && absDiffZ >= sizeZ - 0.08;
    const noCutActive = dailyModifiers.noCut || gameMode === GAME_MODES.PRECISION;

    const upg = getUpgradeBonuses();
    let perfectThreshold = dailyModifiers.tightThreshold || CFG.PERFECT_THRESHOLD;
    if (activePowerups.focus) perfectThreshold = Math.min(Math.max(perfectThreshold * 3.5, 0.55), (movingAxis === 'x' ? sizeX : sizeZ) * 0.45);
    perfectThreshold *= (1 + upg.perfectMult);

    const isDiamondAuto = (bType === BLOCK_TYPES.DIAMOND && !missX && !missZ);
    if (missX || missZ) {
        currentBlock.userData.falling = true;
        if (canOfferSecondChance()) { offerSecondChance('miss'); return; }
        triggerGameOver(); return;
    }
    if (noCutActive && !isDiamondAuto && maxDiff >= perfectThreshold) { currentBlock.userData.falling = true; triggerGameOver(); return; }
    if (bType === BLOCK_TYPES.CRUMBLE && maxDiff < perfectThreshold) {
        currentBlock.position.x = top.position.x; currentBlock.position.z = top.position.z;
        playSound('bomb'); spawnBombParticles();
        if (canOfferSecondChance()) { offerSecondChance('crumble'); return; }
        triggerGameOver(); return;
    }

    const isPerfect = isDiamondAuto || maxDiff < perfectThreshold;
    const skinMods = getSkinModifiers(), prestigeBonus = getPrestigeBonus();
    let basePoints = 1;

    if (isPerfect) {
        currentBlock.position.x = top.position.x; currentBlock.position.z = top.position.z; currentBlock.userData.squash = 0;
        runPerfects++;
        updateQuest('perfect_run', runPerfects, true);
        updateMissionProgress(missions, 'perfect_run', runPerfects, true);
        if (!runStartBroken) {
            runStartPerfects++;
            updateQuest('perfect_start', runStartPerfects, true);
            updateMissionProgress(missions, 'perfect_start', runStartPerfects, true);
        }

        if (!dailyModifiers.noCombo) {
            const oldCombo = combo; combo++;
            if (combo > (stats.maxCombo || 0)) stats.maxCombo = combo;
            const upgrade = checkTierUpgrade(oldCombo, combo);
            if (upgrade) { playSound(upgrade.sound); showPopup(comboText, `${upgrade.name}! x${upgrade.multiplier}`, 1100); }
            if (combo >= 5) cameraZoomPulse = Math.min(0.055, 0.025 + (combo - 5) * 0.004);
        }
        if (combo > 0 && combo % 5 === 0 && (sizeX < currentBaseSize - 0.05 || sizeZ < currentBaseSize - 0.05)) {
            const nw = Math.min(currentBaseSize, sizeX + 0.35), nd = Math.min(currentBaseSize, sizeZ + 0.35), pos = currentBlock.position.clone();
            disposeMesh(currentBlock, scene);
            const grown = makeBlock(nw, BLOCK_HEIGHT, nd, prevColor, bType);
            grown.position.copy(pos); Object.assign(grown.userData, { w: nw, d: nd, color: prevColor, blockType: bType, squash: 0 });
            scene.add(grown); currentBlock = grown; showPopup(bonusText, '✨ ШИРИНА +', 900);
            updateQuest('width_grow', 1);
            updateMissionProgress(missions, 'width_grow', 1);
        }
        if (combo === CFG.FURY_THRESHOLD && !isFury) activateFury();

        if (bType === BLOCK_TYPES.GOLDEN) { basePoints = 3; addCoins(5); stats.totalGolden = (stats.totalGolden || 0) + 1; updateQuest('golden', 1); updateMissionProgress(missions, 'golden', 1); }
        else if (bType === BLOCK_TYPES.BOMB) { basePoints = 2; stats.totalBomb = (stats.totalBomb || 0) + 1; updateQuest('bomb', 1); updateMissionProgress(missions, 'bomb', 1); }
        else if (bType === BLOCK_TYPES.ICE) { basePoints = 2; stats.totalIce = (stats.totalIce || 0) + 1; updateQuest('ice', 1); updateMissionProgress(missions, 'ice', 1); }
        else if (bType === BLOCK_TYPES.RAINBOW) { basePoints = 10; addCoins(15); playSound('secret'); stats.totalSecret = (stats.totalSecret || 0) + 1; updateQuest('secret', 1); updateMissionProgress(missions, 'secret', 1); }
        else if (bType === BLOCK_TYPES.DRAGON) { basePoints = 10; spawnConfetti(20); playSound('secret'); stats.totalSecret = (stats.totalSecret || 0) + 1; updateQuest('secret', 1); updateMissionProgress(missions, 'secret', 1); }
        else if (bType === BLOCK_TYPES.DIAMOND) { basePoints = 5; addCoins(8); playSound('secret'); stats.totalSecret = (stats.totalSecret || 0) + 1; updateQuest('secret', 1); updateMissionProgress(missions, 'secret', 1); }
        else addCoins(2);

        if (gameMode === GAME_MODES.TIME && timerEl) { timeLeft += 2; timerEl.innerText = `⏱ ${timeLeft}`; }
        if (gameMode === GAME_MODES.STORM) { windStrength = Math.max(0.01, windStrength * 0.72); updateWindUI(); }

        blocks.push(currentBlock);
        spawnPerfectWave(currentBlock.position.x, currentBlock.position.y, currentBlock.position.z, currentBlock.userData.w, currentBlock.userData.d, prevColor);
        playSound('perfect', combo); triggerHaptic('medium');
        showPopup(perfectText, combo > 1 ? `ИДЕАЛЬНО x${combo}` : 'ИДЕАЛЬНО!', 750);
        stats.totalPerfect = (stats.totalPerfect || 0) + 1;
        updateQuest('perfect', 1); updateQuest('combo', combo, true);
        updateMissionProgress(missions, 'perfect', 1); updateMissionProgress(missions, 'combo', combo, true);
    } else {
        combo = 0;
        runStartBroken = true;
        if (isFury) { isFury = false; furyBlocksLeft = 0; document.body.classList.remove('fury-active'); }
        const newW = movingAxis === 'x' ? sizeX - absDiffX : sizeX;
        const newD = movingAxis === 'z' ? sizeZ - absDiffZ : sizeZ;
        if (newW < 0.08 || newD < 0.08) {
            currentBlock.userData.falling = true;
            if (canOfferSecondChance()) { offerSecondChance('miss'); return; }
            triggerGameOver(); return;
        }
        createDebris(movingAxis === 'x' ? diffX : diffZ, movingAxis === 'x' ? sizeX : sizeZ, movingAxis === 'x' ? newW : newD, movingAxis, top);
        const finalW = gameMode === GAME_MODES.ENDLESS ? Math.min(currentBaseSize, newW + (sizeX - newW) * 0.35) : newW;
        const finalD = gameMode === GAME_MODES.ENDLESS ? Math.min(currentBaseSize, newD + (sizeZ - newD) * 0.35) : newD;
        const newX = movingAxis === 'x' ? top.position.x + diffX / 2 : currentBlock.position.x;
        const newZ = movingAxis === 'z' ? top.position.z + diffZ / 2 : currentBlock.position.z;
        const posY = currentBlock.position.y;
        disposeMesh(currentBlock, scene);
        const nm = makeBlock(finalW, BLOCK_HEIGHT, finalD, prevColor, BLOCK_TYPES.NORMAL);
        nm.position.set(newX, posY, newZ); Object.assign(nm.userData, { w: finalW, d: finalD, color: prevColor, blockType: BLOCK_TYPES.NORMAL, squash: 0 });
        scene.add(nm); blocks.push(nm); currentBlock = nm;
        if (bType === BLOCK_TYPES.BOMB) { basePoints = -1; playSound('bomb'); spawnBombParticles(); triggerHaptic('error'); showPopup(bonusText, '💥 ВЗРЫВ! -1', 900); }
        else { playSound('drop'); triggerHaptic('light'); shakeIntensity = Math.max(shakeIntensity, 0.14); addCoins(1); }
        updateQuest('cut', 1);
        updateMissionProgress(missions, 'cut', 1);
        if (bType === BLOCK_TYPES.CRUMBLE) {
            updateQuest('crumble_cut', 1);
            updateMissionProgress(missions, 'crumble_cut', 1);
        }
    }

    // Защищённый расчёт очков (без NaN)
    let pointsGain = basePoints;
    if (pointsGain > 0) {
        try {
            const comboRes = applyComboMultiplier(pointsGain, combo);
            if (typeof comboRes === 'number' && Number.isFinite(comboRes)) pointsGain = comboRes;
            else if (comboRes && typeof comboRes === 'object') {
                const val = comboRes.points ?? comboRes.score ?? comboRes.value ?? comboRes.result;
                if (Number.isFinite(val)) pointsGain = val;
                else if (Number.isFinite(comboRes.multiplier)) pointsGain *= comboRes.multiplier;
            } else {
                const tier = typeof getComboTier === 'function' ? getComboTier(combo) : null;
                if (tier && Number.isFinite(tier.multiplier)) pointsGain *= tier.multiplier;
            }
        } catch (e) {}
        if (combo >= 2 && Number.isFinite(upg.comboScoreMult) && upg.comboScoreMult > 0) pointsGain *= (1 + upg.comboScoreMult);
        if (isFury) pointsGain *= 2;
        if (Number.isFinite(dailyModifiers.scoreMult)) pointsGain *= dailyModifiers.scoreMult;
        if (Number.isFinite(skinMods.scoreMult)) pointsGain *= skinMods.scoreMult;
        if (Number.isFinite(prestigeBonus?.scoreMult) && prestigeBonus.scoreMult > 0) pointsGain *= (1 + prestigeBonus.scoreMult);
        if (Number.isFinite(prestigeBonus?.allMult) && prestigeBonus.allMult > 0) pointsGain *= (1 + prestigeBonus.allMult);
        pointsGain = Number.isFinite(pointsGain) ? Math.max(1, Math.round(pointsGain)) : Math.max(1, Math.round(basePoints));
    }

    const prevScore = Number.isFinite(score) ? score : 0;
    score = Math.max(0, prevScore + (Number.isFinite(pointsGain) ? pointsGain : 0));
    if (scoreEl) { scoreEl.innerText = score; scoreEl.classList.remove('score-pop'); requestAnimationFrame(() => scoreEl.classList.add('score-pop')); }

    // Прогресс квестов и миссий по очкам и режимам
    updateQuest('score_run', score, true);
    if (!Object.values(activePowerups).some(Boolean)) {
        updateQuest('clean_score', score, true);
        updateMissionProgress(missions, 'clean_score', score, true);
    }
    if (gameMode === GAME_MODES.STORM) { updateQuest('storm_score', score, true); updateMissionProgress(missions, 'storm_score', score, true); }
    else if (gameMode === GAME_MODES.TIME) { updateMissionProgress(missions, 'time_score', score, true); }
    else if (gameMode === GAME_MODES.PRECISION) { updateQuest('precision_score', score, true); updateMissionProgress(missions, 'precision_score', score, true); }
    else if (gameMode === GAME_MODES.MIRROR) { updateQuest('mirror_score', score, true); updateMissionProgress(missions, 'mirror_score', score, true); }
    else if (gameMode === MODE_ANTIGRAVITY) { updateMissionProgress(missions, 'antigrav_score', score, true); }

    // Режим «Антигравитация»: плавный разворот камеры на 90° каждые 15 этажей
    const floors = blocks.length - 1;
    if (gameMode === MODE_ANTIGRAVITY && floors > 0 && floors % 15 === 0) {
        targetCameraAngle += Math.PI / 2;
        showPopup(bonusText, '🪐 ПОВОРОТ КАМЕРЫ 90°!', 1200);
        playSound('gust');
        triggerHaptic('medium');
        updateQuest('antigrav_rot', 1);
        updateMissionProgress(missions, 'antigrav_rot', 1);
    }

    // Проверка активного контракта
    if (activeContract) {
        const cRes = updateContractTracker(activeContract, { score, combo, runPerfects });
        if (cRes.justCompleted) {
            addCoins(cRes.reward, { raw: true });
            stats.contractsWon = (stats.contractsWon || 0) + 1;
            saveStats();
            playSound('victory'); triggerHaptic('success');
            showPopup(milestoneText, `📜 КОНТРАКТ! +${cRes.reward} 🪙`, 1700);
            updateQuest('contract_win', 1);
            updateMissionProgress(missions, 'contract_win', 1);
            checkAchievements();
        }
        updateContractHUD();
    }

    if (!recordLinePassed && recordLineGroup && (score > highScore || floors > bestHeight)) {
        recordLinePassed = true;
        if (recordLineGroup.userData?.ringMat) { recordLineGroup.userData.ringMat.color.setHex(0x00E676); recordLineGroup.userData.ringMat.opacity = 0.45; }
        playSound('record_break'); spawnConfetti(28, recordLineGroup.position); showPopup(milestoneText, '👑 РЕКОРД ПОБИТ!', 1500); triggerHaptic('success');
    }

    if (isFury) { furyBlocksLeft--; if (furyBlocksLeft <= 0) { isFury = false; document.body.classList.remove('fury-active'); } }
    if (Math.floor(score / 10) > Math.floor(prevScore / 10) && score >= 10) triggerMilestone(Math.floor(score / 10) * 10);

    updateComboIndicator();
    updateQuest('stack', floors, true);
    updateMissionProgress(missions, 'blocks', 1);
    if (blocks.length > 32) blocks[blocks.length - 33].visible = false;

    let accel = CFG.SPEED_INCREMENT * (dailyModifiers.accelMult || 1);
    if (gameMode === GAME_MODES.ENDLESS) accel *= 2;
    currentSpeed = Math.min(dynamicMaxSpeed, currentSpeed + accel);
    setMusicTempo(Math.min(155, CFG.MUSIC_BASE_TEMPO + score * 0.45));

    direction *= -1;
    spawnNewBlock();
}

// ============ НАВИГАЦИЯ, КАМЕРА И ЦИКЛ ============
function togglePause() {
    if (gameState === GAME_STATES.PLAYING) { gameState = GAME_STATES.PAUSED; document.body.classList.remove('in-game'); stopMusic(); showModal(pauseScreen); }
    else if (gameState === GAME_STATES.PAUSED && pauseScreen.classList.contains('open')) {
        hideModal(pauseScreen, { restoreMenu: false }); gameState = GAME_STATES.PLAYING; document.body.classList.add('in-game');
        clock.getDelta(); startMusic(CFG.MUSIC_BASE_TEMPO); updateTelegramBackButton();
    }
}

function goToMenu() {
    clearGameOverTimers();
    if (secondChanceRaf) { cancelAnimationFrame(secondChanceRaf); secondChanceRaf = null; }
    if (timeAttackTimer) { clearInterval(timeAttackTimer); timeAttackTimer = null; }
    gameState = GAME_STATES.MENU; secondChanceActive = false; overviewActive = false; overviewSkipped = false; cameraZoomPulse = 0; activeContract = null;
    document.body.classList.remove('in-game', 'fury-active');
    stopMusic(); stopWindSystem(); hideTowerHeightBanner(); updateContractHUD();
    restoreDailyVisuals(); dailyChallengeActive = false; dailyModifiers = {};
    document.querySelectorAll('.screen.modal.open').forEach(m => { m.classList.remove('open'); updateAriaAttributes(m, false); });
    clearScene(); clearVisualCaches(); stopRenderLoop();
    document.body.style.background = getBgColors()[0]; syncTelegramTheme('#FFE5EC');
    startScreen.style.display = 'flex';
    updateCoinUI(); updateLevelUI(); updateChestUI(); updateWheelUI(); updateMissionsBadge(); renderDailyChallenge();
    if (currentMenuTab === 'shop') renderShop();
    if (currentMenuTab === 'tasks') renderMissions();
    updateTelegramBackButton();
}

function updateCamera(dt = 1) {
    if (!camera) return;
    cameraAngle += (targetCameraAngle - cameraAngle) * Math.min(1, 0.06 * dt);
    const camX = Math.cos(cameraAngle) * CAMERA_RADIUS;
    const camZ = Math.sin(cameraAngle) * CAMERA_RADIUS;

    if (overviewActive) {
        camera.position.set(camX, camera.position.y + ((overviewTargetY + 12) - camera.position.y) * Math.min(1, 0.08 * dt), camZ);
        camera.zoom += (overviewTargetZoom - camera.zoom) * Math.min(1, 0.08 * dt);
        camera.lookAt(0, overviewTargetY, 0);
        camera.updateProjectionMatrix();
        return;
    }

    const targetY = blocks.length > 0 ? blocks[blocks.length - 1].position.y : 0;
    camera.position.y += ((targetY + 12) - camera.position.y) * Math.min(1, 0.1 * dt);
    if (shakeIntensity > 0.01) {
        camera.position.x = camX + (Math.random() - 0.5) * shakeIntensity;
        camera.position.z = camZ + (Math.random() - 0.5) * shakeIntensity;
        shakeIntensity *= Math.pow(0.85, dt);
    } else {
        camera.position.x = camX; camera.position.z = camZ; shakeIntensity = 0;
    }
    camera.lookAt(0, targetY, 0);

    if (cameraZoomPulse > 0.0005 || Math.abs(camera.zoom - 1) > 0.0005) {
        cameraZoomPulse *= Math.pow(0.84, dt);
        if (cameraZoomPulse < 0.0005) cameraZoomPulse = 0;
        camera.zoom += ((1 + cameraZoomPulse) - camera.zoom) * Math.min(1, 0.28 * dt);
        camera.updateProjectionMatrix();
    }
}

function startRenderLoop() { if (rafId !== null) return; clock.getDelta(); rafId = requestAnimationFrame(animate); }
function stopRenderLoop() { if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; } }

function animate() {
    if (document.hidden || (gameState === GAME_STATES.MENU && startScreen && startScreen.style.display !== 'none')) { rafId = null; return; }
    rafId = requestAnimationFrame(animate);
    try {
        const rawDelta = clock.getDelta(), dt = Math.min(rawDelta * 60, 2.5), now = performance.now();
        try {
            updateFpsCounter();
            if (now - lastPerfCheck > 2000) {
                lastPerfCheck = now;
                const fps = getCurrentFps();
                if (fps > 0 && fps < 34) {
                    if (++lowFpsStrikes >= 2 && !lowPerfMode) {
                        lowPerfMode = true;
                        try { removeEnvironmentParticles(scene); } catch (e) {}
                        try { disposeAtmosphereLayers(scene); } catch (e) {}
                        renderer.setPixelRatio(1);
                    }
                } else lowFpsStrikes = 0;
            }
        } catch (e) {}

        if (scene?.background) scene.background.lerp(targetBgColor, Math.min(1, 0.03 * dt));

        if (gameState === GAME_STATES.PLAYING && currentBlock?.userData.moving) {
            let speed = currentSpeed;
            if (currentBlock.userData.blockType === BLOCK_TYPES.ICE) speed *= 1.45;
            if (isFury) speed *= 0.6;
            const step = speed * direction * dt + (gameMode === GAME_MODES.STORM ? windStrength * windDirection * dt : 0);
            if (movingAxis === 'x') {
                currentBlock.position.x += step;
                if (currentBlock.position.x > CFG.MOVE_RANGE) { currentBlock.position.x = CFG.MOVE_RANGE; direction = -1; }
                else if (currentBlock.position.x < -CFG.MOVE_RANGE) { currentBlock.position.x = -CFG.MOVE_RANGE; direction = 1; }
            } else {
                currentBlock.position.z += step;
                if (currentBlock.position.z > CFG.MOVE_RANGE) { currentBlock.position.z = CFG.MOVE_RANGE; direction = -1; }
                else if (currentBlock.position.z < -CFG.MOVE_RANGE) { currentBlock.position.z = -CFG.MOVE_RANGE; direction = 1; }
            }
        }

        if (currentBlock?.userData.falling) { currentBlock.position.y -= 0.32 * dt; currentBlock.rotation.x += 0.06 * dt; currentBlock.rotation.z += 0.04 * dt; }

        for (let i = Math.max(0, blocks.length - 5); i < blocks.length; i++) {
            const b = blocks[i];
            if (b.userData.squash !== undefined && b.userData.squash < 1) {
                b.userData.squash = Math.min(1, b.userData.squash + 0.1 * dt);
                const sy = 1 - Math.sin(b.userData.squash * Math.PI) * 0.3, sxz = 1 + Math.sin(b.userData.squash * Math.PI) * 0.15;
                b.scale.set(b.userData.w * sxz, BLOCK_HEIGHT * sy, b.userData.d * sxz);
            }
        }

        for (let i = debris.length - 1; i >= 0; i--) {
            const m = debris[i]; m.userData.vel.y -= 0.018 * dt; m.position.addScaledVector(m.userData.vel, dt);
            m.rotation.x += m.userData.rotSpeed.x * dt; m.rotation.y += m.userData.rotSpeed.y * dt; m.rotation.z += m.userData.rotSpeed.z * dt;
            if (m.position.y < camera.position.y - 28) { disposeMesh(m, scene); debris.splice(i, 1); }
        }
        for (let i = confetti.length - 1; i >= 0; i--) {
            const c = confetti[i]; c.userData.vel.y -= 0.012 * dt; c.position.addScaledVector(c.userData.vel, dt);
            c.rotation.x += c.userData.rot.x * dt; c.rotation.y += c.userData.rot.y * dt; c.userData.life -= 0.016 * dt;
            if (c.userData.life <= 0) { disposeMesh(c, scene); confetti.splice(i, 1); }
        }
        for (let i = perfectWaves.length - 1; i >= 0; i--) {
            const w = perfectWaves[i]; w.userData.age += 0.055 * dt; const t = w.userData.age;
            w.scale.set(w.userData.baseW * (1.05 + t * 0.75), w.userData.baseD * (1.05 + t * 0.75), 1);
            w.material.opacity = Math.max(0, 0.9 * (1 - t));
            if (t >= 1) { w.material.dispose(); scene.remove(w); perfectWaves.splice(i, 1); }
        }
        if (recordLineGroup && !recordLinePassed && recordLineGroup.userData?.sprite) recordLineGroup.userData.sprite.position.y = 0.45 + Math.sin(now * 0.004) * 0.16;
        if (!lowPerfMode) {
            try { updateEnvironmentParticles(rawDelta); } catch (e) {}
            try { updateAtmosphereLayers(rawDelta, Math.max(0, blocks.length - 1), BLOCK_HEIGHT); } catch (e) {}
        }
        updateCamera(dt);
        renderer.render(scene, camera);
    } catch (err) { console.error('[animate]', err); }
}

// ============ ВВОД, RESIZE И INIT ============
const onResize = throttle(() => {
    if (!camera || !renderer) return;
    const aspect = window.innerWidth / window.innerHeight, d = safeGetAdaptiveD(aspect);
    camera.left = -d * aspect; camera.right = d * aspect; camera.top = d; camera.bottom = -d;
    camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); cacheCoinPopupAnchor();
    if (gameState === GAME_STATES.MENU) renderer.render(scene, camera);
}, 120);
window.addEventListener('resize', onResize);

function handleInput(e) {
    const t = e.target;
    if (t?.closest && t.closest('button, .mode-btn, .mini-mode-btn, #top-right-controls, .modal, .powerup-item, .contract-item, .daily-challenge-banner, .lb-mode-tab, .event-banner, .ach-tab, #start-screen')) return;
    if (isAnyModalOpen()) return;
    if (gameState === GAME_STATES.PLAYING) { if (e.type === 'touchstart') e.preventDefault(); dropBlock(); }
    else if (gameState === GAME_STATES.GAMEOVER && overviewActive) { if (e.type === 'touchstart') e.preventDefault(); skipTowerOverview(); }
}
window.addEventListener('touchstart', handleInput, { passive: false });
window.addEventListener('mousedown', handleInput);
window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'Enter') {
        if (gameState === GAME_STATES.PLAYING && !isAnyModalOpen()) { e.preventDefault(); dropBlock(); }
        else if (gameState === GAME_STATES.GAMEOVER && !isAnyModalOpen() && overviewActive) { e.preventDefault(); skipTowerOverview(); }
        else if (gameState === GAME_STATES.GAMEOVER && gameOverEl?.classList.contains('open')) { e.preventDefault(); activePowerups = { ...DEFAULTS.ACTIVE_POWERUPS }; hideModal(gameOverEl, { restoreMenu: false }); startGame(); }
    } else if ((e.code === 'KeyP' || e.code === 'Escape') && (gameState === GAME_STATES.PLAYING || (gameState === GAME_STATES.PAUSED && pauseScreen.classList.contains('open')))) {
        e.preventDefault(); togglePause();
    }
});
document.addEventListener('visibilitychange', () => {
    if (document.hidden) { stopRenderLoop(); if (gameState === GAME_STATES.PLAYING) togglePause(); flushCloudSave(); }
    else if (gameState !== GAME_STATES.MENU) startRenderLoop();
});
window.addEventListener('pagehide', () => flushCloudSave());

function shareChallenge() {
    const text = `Я построил башню высотой ${score} в «Башне хайпа»! 🏗️ Сможешь побить мой рекорд?`;
    const url = `https://t.me/share/url?url=${encodeURIComponent(TELEGRAM_APP_URL)}&text=${encodeURIComponent(text)}`;
    try {
        if (tg?.openTelegramLink) tg.openTelegramLink(url);
        else if (navigator.share) navigator.share({ title: 'Башня хайпа', text, url: TELEGRAM_APP_URL }).catch(() => {});
        else window.open(url, '_blank');
    } catch (e) {}
}

function bindEvents() {
    document.querySelectorAll('.nav-tab-btn').forEach(b => safeClick(b, () => switchMenuTab(b.dataset.menuTab)));
    document.querySelectorAll('.shop-tab').forEach(t => safeClick(t, () => switchShopTab(t.dataset.tab)));
    document.querySelectorAll('.lb-mode-tab').forEach(t => safeClick(t, () => { currentLbMode = t.dataset.mode; renderLeaderboard(); }));
    document.querySelectorAll('.ach-tab').forEach(t => safeClick(t, () => { currentAchCategory = t.dataset.achCat; renderAchievements(); }));

    safeClick($('btn-classic'), () => showPowerupSelection(GAME_MODES.CLASSIC));
    safeClick($('btn-time'), () => showPowerupSelection(GAME_MODES.TIME));
    document.querySelectorAll('.mini-mode-btn').forEach(btn => {
        safeClick(btn, () => {
            if (btn.dataset.mode === MODE_ANTIGRAVITY) showPowerupSelection(MODE_ANTIGRAVITY);
            else { activePowerups = { ...DEFAULTS.ACTIVE_POWERUPS }; activeContract = null; startGame(btn.dataset.mode); }
        });
    });
    safeClick(dailyPlayBtn, startDailyChallenge);

    safeClick(pauseBtn, togglePause);
    safeClick(menuToggleBtn, goToMenu);
    safeClick(muteBtn, () => {
        const on = !(settings.musicEnabled || settings.sfxEnabled);
        settings.musicEnabled = on; settings.sfxEnabled = on; saveSettings(); updateSettingsUI();
        if (on && gameState === GAME_STATES.PLAYING) startMusic(CFG.MUSIC_BASE_TEMPO); else stopMusic();
    });

    safeClick(restartPowerupsBtn, restartWithSamePowerups);
    safeClick($('restart-btn'), () => { activePowerups = { ...DEFAULTS.ACTIVE_POWERUPS }; activeContract = null; hideModal(gameOverEl, { restoreMenu: false }); startGame(); });
    safeClick($('menu-btn'), goToMenu);
    safeClick($('challenge-btn'), shareChallenge);
    safeClick(secondChanceBuyBtn, acceptSecondChance);
    safeClick(secondChanceSkipBtn, declineSecondChance);
    safeClick($('pause-resume'), togglePause);
    safeClick($('pause-menu'), goToMenu);
    safeClick($('start-with-powerups'), startGameWithPowerups);
    safeClick($('close-powerups'), () => { pendingGameMode = null; selectedContractId = null; hideModal(powerupsScreen); });

    safeClick($('ach-btn'), () => { renderAchievements(); showModal(achScreen); });
    safeClick($('close-achievements'), () => hideModal(achScreen));
    safeClick($('lb-btn'), () => { renderLeaderboard(); showModal(lbScreen); });
    safeClick($('close-leaderboard'), () => hideModal(lbScreen));
    safeClick($('rules-btn'), () => showModal(rulesScreen));
    safeClick($('close-rules'), () => hideModal(rulesScreen));
    safeClick($('settings-btn'), () => { updateSettingsUI(); showModal(settingsScreen); });
    safeClick($('close-settings'), () => hideModal(settingsScreen));
    safeClick($('toggle-music'), () => { settings.musicEnabled = !settings.musicEnabled; saveSettings(); updateSettingsUI(); if (!settings.musicEnabled) stopMusic(); });
    safeClick($('toggle-sfx'), () => { settings.sfxEnabled = !settings.sfxEnabled; saveSettings(); updateSettingsUI(); });
    safeClick($('toggle-haptics'), () => { settings.hapticsEnabled = !settings.hapticsEnabled; saveSettings(); updateSettingsUI(); if (settings.hapticsEnabled) triggerHaptic('light'); });
    safeClick($('cloud-sync-btn'), async () => { const s = $('cloud-sync-status'); if (s) s.textContent = 'Синхронизация...'; await flushCloudSave(); updateCloudStatusUI(); triggerHaptic('success'); });
    safeClick($('claim-daily'), () => { if (dailyRewardPending) { dailyRewardPending = false; addCoins(dailyRewardAmount); playSound('quest'); triggerHaptic('success'); } hideModal(dailyScreen); });
    safeClick($('chest-btn'), showChestOpening);
    safeClick($('open-chest-btn'), openChest);
    safeClick($('close-chest'), () => hideModal(chestScreen));
    safeClick(prestigeActivateBtnEl, showPrestigeConfirm);
    safeClick(prestigeConfirmBtn, activatePrestige);
    safeClick(prestigeCancelBtn, () => hideModal(prestigeConfirmScreen));
    safeClick(openPrestigeChestBtn, openPrestigeChest);
    safeClick(closePrestigeChestBtn, () => hideModal(prestigeChestScreen));
    safeClick(eventBannerEl, showEventDetails);
    safeClick($('close-event'), () => hideModal(eventScreen));
    safeClick(rerollMissionsBtn, handleRerollMissions);
    safeClick($('wheel-btn'), openWheelModal);
    safeClick($('close-wheel'), closeWheelModal);
    safeClick(wheelSpinBtn, () => {
        if (!wheelController || wheelController.isSpinning() || !canSpinWheel()) return;
        wheelSpinBtn.disabled = true; wheelSpinBtn.textContent = 'КРУТИТСЯ...'; wheelController.spin();
    });
    safeClick($('minigames-btn'), () => { renderMinigamesList(); showModal(minigamesScreen); startMinigamesCooldownTimer(); });
    safeClick($('close-minigames'), () => { stopActiveMinigame(); stopMinigamesCooldownTimer(); hideModal(minigamesScreen); });
}

function init() {
    initThree(); loadUpgrades(); bindEvents(); initSeason(); loadQuests(); initMissions(); initEvents();
    checkDailyStreak(); renderDailyChallenge();
    updateCoinUI(); updateLevelUI(); updateStreakUI(); updateChestUI(); updateWheelUI(); updateSettingsUI();
    normalizeFontSizes(); syncTelegramTheme('#FFE5EC');
    if (renderer && scene && camera) renderer.render(scene, camera);
    if (splashScreen) { requestAnimationFrame(() => { splashScreen.classList.add('splash-hidden'); setTimeout(() => splashScreen.remove(), 450); }); }
    if (dailyRewardPending) setTimeout(showDailyReward, 450);

    if (wipeResult.wiped) {
        const msg = wipeResult.gotSkin
            ? '🔥 ОБНОВЛЕНИЕ! +500 🪙 и 👑 «Первый вайп»!'
            : '🔥 ОБНОВЛЕНИЕ! Компенсация +500 🪙!';
        setTimeout(() => {
            showPopup(milestoneText, msg, 3500);
            playSound('victory');
            triggerHaptic('success');
        }, 700);
    }

    initCloudSync(() => { reloadFromLocalAfterCloudMerge(); updateCloudStatusUI(); }).then(updateCloudStatusUI);
}

init();
