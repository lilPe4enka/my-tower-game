import * as THREE from 'three';

// ============ ИМПОРТЫ МОДУЛЕЙ ============
import { safeGetItem, safeSetItem, safeParseInt, PARTICLE_LIMITS, enforceParticleLimits, showModalSafe, hideModalSafe, isAnyModalOpen, setupGlobalErrorHandler, validateArray, validateObject } from './utils.js?v=18';
import { GAME_CONFIG, LIMITS, GAME_MODES, GAME_STATES, GAME_MODE_NAMES, BLOCK_TYPES, BLOCK_COLORS, BLOCK_GLOW_COLORS, STORAGE_KEYS, DEFAULTS, xpForNextLevel, getAdaptiveD, CONFETTI_COLORS, MILESTONE_COLORS, LEAD_NOTES, FEATURE_NAMES } from './constants.js?v=18';
import { getComboTier, applyComboMultiplier, checkTierUpgrade, formatComboDisplay } from './combo-system.js?v=18';
import { applyTransition, getTransitionForScreen, staggerElements, flashTransition } from './transitions.js?v=18';
import { loadMissions, updateMissionProgress, claimMissionReward, getMissionsStats, formatMissionReward, getMissionProgress, getMissionRerollCost, rerollDailyMissions } from './missions.js?v=18';
import { getPrestigeCount, getPrestigeBonus, setPrestigeBonus, canPrestige, getPrestigeProgress, performPrestige, resetProgressForPrestige, rollPrestigeChestReward, applyPrestigeReward, formatPrestigeBonus, PRESTIGE_SKINS, PRESTIGE_CONFIG, checkNewMilestones } from './prestige.js?v=18';
import { getCachedTexture, clearTextureCache, throttle, updateDOMText, updateDOMStyle, updateDOMClass, updateFpsCounter, getCurrentFps } from './performance.js?v=18';
import { saveLastFocus, restoreLastFocus, trapFocus, releaseFocusTrap, setupEscapeKeyHandler, removeEscapeKeyHandler, updateAriaAttributes, announceToScreenReader, addDecorativeStars, normalizeFontSizes, animateElementsSequentially, addCloseButtonToModal } from './accessibility.js?v=18';
import { getCurrentEvent, getEventProgress, getAvailableRewards, claimEventReward, getEventStats, formatEventDate, isEventsSystemActive, getEventDay, EVENT_SKINS } from './seasonal-events.js?v=18';
import { createEnvironmentParticles, updateEnvironmentParticles, getParticlesForBackground, removeEnvironmentParticles } from './environment-particles.js?v=18';
import { MINIGAMES, canPlayMinigame, recordMinigamePlay, getCooldownRemaining, getRemainingDailyPlays, formatCooldown, createMinigame, calculateMinigameReward } from './minigames.js?v=18';
import { initCloudSync, scheduleCloudSave, flushCloudSave, getCloudStatus, isCloudStorageAvailable } from './cloud-storage.js?v=18';
import { UPGRADES, MAX_UPGRADE_LEVEL, loadUpgrades, getUpgradeLevel, getUpgradePrice, buyUpgrade, getUpgradeBonuses, getUpgradesProgress } from './upgrades.js?v=18';
import { canSpinWheel, getTimeUntilNextSpin, createWheelController } from './wheel.js?v=18';
import { initAtmosphereLayers, updateAtmosphereLayers, disposeAtmosphereLayers } from './atmosphere.js?v=18';

setupGlobalErrorHandler();

// ============ TELEGRAM & HAPTICS ============
const TELEGRAM_APP_URL = 'https://t.me/YOUR_BOT_USERNAME/app'; // замени на реальную ссылку на Mini App
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

    // Подстраховка для iOS / Swiftgram в полноэкранном режиме, если клиент не прислал contentSafeAreaInset
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent) || tg?.platform === 'ios';
    if (tg && contentTop === 0 && (tg.isFullscreen || isIOS)) {
        contentTop = 48;
    }

    if (safeTop > 0) root.style.setProperty('--safe-top', `${safeTop}px`);
    root.style.setProperty('--tg-content-top', `${contentTop}px`);
    if (safeBottom > 0) root.style.setProperty('--safe-bottom', `${safeBottom}px`);
}

function syncTelegramTheme(hexColor) {
    if (!tg || !hexColor) return;
    try {
        if (typeof tg.setHeaderColor === 'function' && tg.isVersionAtLeast('6.1')) {
            tg.setHeaderColor(hexColor);
        }
        if (typeof tg.setBackgroundColor === 'function' && tg.isVersionAtLeast('6.1')) {
            tg.setBackgroundColor(hexColor);
        }
        if (typeof tg.setBottomBarColor === 'function' && tg.isVersionAtLeast('7.10')) {
            tg.setBottomBarColor(hexColor);
        }
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
        if (openModal) {
            handleModalDismiss(openModal);
        } else if (gameState === GAME_STATES.PLAYING || gameState === GAME_STATES.PAUSED) {
            togglePause();
        } else if (gameState === GAME_STATES.MENU && currentMenuTab !== 'play') {
            switchMenuTab('play');
        }
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
    const wrapped = (e) => {
        const now = Date.now();
        if (now - lastFire < 300) return;
        lastFire = now;
        if (audioCtx && audioCtx.state === 'running') playSound('ui_click');
        if (e.cancelable !== false) e.stopPropagation();
        try { handler(e); } catch (err) { console.error('Handler:', err); }
    };
    el.addEventListener('click', wrapped);
}

// ============ МОДАЛКИ (с переходами) ============
function handleModalDismiss(el) {
    if (el === secondChanceOverlay && secondChanceActive) {
        declineSecondChance();
        return;
    }
    if (el === pauseScreen && gameState === GAME_STATES.PAUSED) {
        togglePause();
        return;
    }
    if (el === gameOverEl) {
        goToMenu();
        return;
    }
    if (el === powerupsScreen) {
        pendingGameMode = null;
    }
    if (el === minigamesScreen) {
        stopActiveMinigame();
        stopMinigamesCooldownTimer();
    }
    if (el === wheelScreen) {
        if (wheelTimerInterval) { clearInterval(wheelTimerInterval); wheelTimerInterval = null; }
    }
    hideModal(el);
}

async function showModal(el) {
    if (!el || el.classList.contains('open')) return;
    saveLastFocus();
    const screenId = el.id;
    const transitionType = getTransitionForScreen(screenId);
    el.classList.add('open');
    updateTelegramBackButton();
    await applyTransition(el, transitionType, 'in');
    updateAriaAttributes(el, true);
    const modalContent = el.querySelector('.modal-content');
    if (modalContent) {
        trapFocus(modalContent);
        addCloseButtonToModal(modalContent, () => handleModalDismiss(el));
        const animatableElements = modalContent.querySelectorAll('.ach-item, .skin-item, .customize-item, .powerup-item, .lb-attempt, .quest-chip, .mission-item, .event-reward-item');
        if (animatableElements.length > 0 && animatableElements.length < 30) staggerElements(animatableElements, 40);
    }
    setupEscapeKeyHandler(el, () => handleModalDismiss(el));
    const title = el.querySelector('h1, h2');
    if (title) announceToScreenReader(`Открыто: ${title.textContent}`);
    if (['chest-screen', 'daily-screen', 'prestige-confirm-screen'].includes(el.id)) {
        const content = el.querySelector('.modal-content');
        if (content) addDecorativeStars(content, 15);
    }
    playSound('screen_transition');
}

async function hideModal(el, { restoreMenu = true } = {}) {
    if (!el || !el.classList.contains('open')) return;
    const screenId = el.id;
    const transitionType = getTransitionForScreen(screenId);
    await applyTransition(el, transitionType, 'out');
    el.classList.remove('open');
    updateAriaAttributes(el, false);
    const modalContent = el.querySelector('.modal-content');
    if (modalContent) releaseFocusTrap(modalContent);
    removeEscapeKeyHandler(el);
    restoreLastFocus();
    announceToScreenReader('Диалог закрыт');
    if (restoreMenu && gameState === GAME_STATES.MENU && !document.querySelector('.screen.modal.open')) {
        startScreen.style.display = 'flex';
        updateCoinUI();
    }
    updateTelegramBackButton();
}

// ============ КОНТЕНТ ============
const BASE_COLORS = ['#FF1744', '#F50057', '#D500F9', '#651FFF', '#2979FF', '#00B0FF', '#00E5FF', '#1DE9B6', '#00E676', '#FFEA00', '#FF9100', '#FF3D00'];

const SKINS = {
    default: { name: 'Классика', price: 0, colors: BASE_COLORS },
    food: { name: 'Еда', price: 180, colors: ['#FF5722', '#FF9800', '#FFC107', '#E64A19', '#FF6F00', '#D84315', '#F57C00'] },
    cats: { name: 'Котики', price: 260, colors: ['#FF4081', '#F06292', '#E91E63', '#C2185B', '#AB47BC', '#CE93D8'] },
    pixel: { name: 'Пиксель', price: 320, colors: ['#FF004D', '#FFA300', '#FFEC27', '#00E436', '#29ADFF', '#83769C'] },
    animals: { name: 'Звери', price: 380, colors: ['#8D6E63', '#6D4C41', '#795548', '#5D4037', '#8BC34A', '#689F38', '#558B2F'] },
    ice: { name: 'Лёд', price: 450, colors: ['#81D4FA', '#4FC3F7', '#29B6F6', '#03A9F4', '#039BE5', '#0288D1'], modifiers: { speedMult: 1.3, coinMult: 1.2 } },
    stone: { name: 'Камень', price: 450, colors: ['#757575', '#616161', '#424242', '#546E7A', '#455A64', '#37474F'], modifiers: { speedMult: 0.85, scoreMult: 1.2 } },
    space: { name: 'Космос', price: 500, colors: ['#1A237E', '#283593', '#311B92', '#4527A0', '#512DA8', '#01579B', '#0D47A1'] },
    fire: { name: 'Огонь', price: 550, colors: ['#FF5722', '#FF3D00', '#E64A19', '#F4511E', '#D84315', '#BF360C'], modifiers: { fireChance: 0.05 } },
    ocean: { name: 'Океан', price: 650, colors: ['#0288D1', '#0277BD', '#01579B', '#006064', '#00838F', '#0097A7', '#26C6DA'] },
    emerald: { name: 'Изумруд', price: 700, colors: ['#004D40', '#00695C', '#00796B', '#00897B', '#009688', '#26A69A'], modifiers: { coinMult: 1.15 } },
    retro: { name: 'Ретро 8-бит', price: 800, colors: ['#00C853', '#00B248', '#00897B', '#00BFA5', '#76FF03', '#AA00FF'] },
    ruby: { name: 'Рубин', price: 900, colors: ['#880E4F', '#AD1457', '#C2185B', '#D81B60', '#E91E63', '#FF4081'], modifiers: { scoreMult: 1.15 } },
    neon: { name: 'Неон', price: 1000, colors: ['#E91E63', '#9C27B0', '#3F51B5', '#00BCD4', '#8BC34A', '#FFEB3B', '#FF4081', '#00E5FF'] },
    ice_skin: { name: 'Ледяной', price: 1100, colors: ['#E0FFFF', '#AFEEEE', '#87CEEB', '#4682B4', '#5F9EA0', '#B0E0E6'], effect: 'ice', modifiers: { speedMult: 0.9, coinMult: 1.15 } },
    amethyst: { name: 'Аметист', price: 1150, colors: ['#4A148C', '#6A1B9A', '#7B1FA2', '#8E24AA', '#AB47BC', '#CE93D8'], modifiers: { xpMult: 1.2 } },
    fire_skin: { name: 'Пламя', price: 1250, colors: ['#FF4500', '#FF6347', '#FF7F50', '#FFA07A', '#DC143C', '#B22222'], effect: 'fire', modifiers: { fireChance: 0.08 } },
    holographic: { name: 'Голограмма', price: 1400, colors: ['#00FFFF', '#FF00FF', '#FFFF00', '#00FF00', '#FF0080', '#0080FF'], effect: 'holographic', modifiers: { scoreMult: 1.15 } },
    cyberpunk: { name: 'Киберпанк', price: 1500, colors: ['#F72585', '#B5179E', '#7209B7', '#3A0CA3', '#4361EE', '#4CC9F0'], effect: 'neon', modifiers: { coinMult: 1.2 } },
    neon_skin: { name: 'Неон+', price: 1600, colors: ['#FF00FF', '#00FFFF', '#FFFF00', '#FF0080', '#800080', '#00CED1'], effect: 'neon', modifiers: { scoreMult: 1.2 } },
    magma: { name: 'Магма', price: 1750, colors: ['#210909', '#590D0D', '#A4161A', '#E5383B', '#FF6B00', '#FFD166'], effect: 'fire', modifiers: { fireChance: 0.1, scoreMult: 1.15 } },
    crystal: { name: 'Кристалл', price: 1900, colors: ['#CAF0F8', '#90E0EF', '#00B4D8', '#0077B6', '#03045E', '#ADE8F4'], effect: 'ice', modifiers: { speedMult: 0.85, xpMult: 1.2 } },
    galaxy_skin: { name: 'Галактика', price: 2000, colors: ['#191970', '#4B0082', '#8A2BE2', '#9370DB', '#663399', '#483D8B'], effect: 'stars', modifiers: { xpMult: 1.25 } },
    void: { name: 'Бездна', price: 2400, colors: ['#10002B', '#240046', '#3C096C', '#5A189A', '#7B2CBF', '#C77DFF'], effect: 'stars', modifiers: { scoreMult: 1.25 } },
    aurora_skin: { name: 'Сияние', price: 2800, colors: ['#00F5D4', '#00BBF9', '#9B5DE5', '#F15BB5', '#FEE440', '#06D6A0'], effect: 'holographic', modifiers: { coinMult: 1.25, xpMult: 1.2 } },
    midas: { name: 'Мидас', price: 3500, colors: ['#FFF3B0', '#FFE066', '#FFD700', '#FFB703', '#FB8500', '#D4AF37'], effect: 'holographic', modifiers: { coinMult: 1.35, scoreMult: 1.2 } },
    legend: { name: 'Легенда', price: 999999, notBuyable: true, colors: ['#FFD700', '#FFA000', '#FF6F00', '#F57C00', '#FFEB3B', '#FFC107'] },
    ...PRESTIGE_SKINS,
    ...EVENT_SKINS,
};

const PALETTES = {
    standard: { name: 'Классика', price: 0, colors: BASE_COLORS },
    pastel: { name: 'Пастель', price: 150, colors: ['#FFB3BA', '#FFDFBA', '#FFFFBA', '#BAFFC9', '#BAE1FF', '#E0BBE4', '#FFC8DD', '#CDEAC0'] },
    mono: { name: 'Монохром', price: 180, colors: ['#F5F5F5', '#E0E0E0', '#BDBDBD', '#9E9E9E', '#757575', '#616161', '#424242', '#212121'] },
    forest: { name: 'Лес', price: 200, colors: ['#2E7D32', '#388E3C', '#43A047', '#4CAF50', '#66BB6A', '#81C784', '#A5D6A7', '#1B5E20'] },
    coffee: { name: 'Кофе', price: 220, colors: ['#3E2723', '#4E342E', '#5D4037', '#6D4C41', '#8D6E63', '#A1887F', '#BCAAA4', '#D7CCC8'] },
    neon: { name: 'Неон', price: 240, colors: ['#FF0080', '#FF8C00', '#FFD700', '#00FF88', '#00D4FF', '#0080FF', '#8B00FF', '#FF00FF'] },
    sunset: { name: 'Закат', price: 260, colors: ['#FF6B6B', '#FF8A65', '#FFB74D', '#FFD54F', '#FFA726', '#F4511E', '#D84315', '#FF7043'] },
    sakura_pal: { name: 'Сакура', price: 280, colors: ['#FFF0F3', '#FFCCD5', '#FFB3C1', '#FF8FA3', '#FF758F', '#FF4D6D', '#C9184A', '#A4133C'] },
    dark: { name: 'Тёмная', price: 300, colors: ['#212121', '#424242', '#616161', '#1A237E', '#283593', '#4A148C', '#311B92', '#004D40'] },
    winter: { name: 'Зима', price: 300, colors: ['#E1F5FE', '#B3E5FC', '#81D4FA', '#4FC3F7', '#29B6F6', '#03A9F4', '#0288D1', '#01579B'] },
    ice_cream: { name: 'Мороженое', price: 310, colors: ['#FFADAD', '#FFD6A5', '#FDFFB6', '#CAFFBF', '#9BF6FF', '#A0C4FF', '#BDB2FF', '#FFC6FF'] },
    candy: { name: 'Конфета', price: 320, colors: ['#F48FB1', '#F06292', '#BA68C8', '#CE93D8', '#E1BEE7', '#F8BBD0', '#FCE4EC', '#FFCDD2'] },
    emerald_pal: { name: 'Изумруд', price: 340, colors: ['#D8F3DC', '#B7E4C7', '#95D5B2', '#74C69D', '#52B788', '#40916C', '#2D6A4F', '#1B4332'] },
    fire_pal: { name: 'Пламя', price: 360, colors: ['#FFEB3B', '#FFC107', '#FF9800', '#FF5722', '#F44336', '#E91E63', '#C2185B', '#880E4F'] },
    autumn_pal: { name: 'Осень', price: 360, colors: ['#8B4513', '#A0522D', '#CD853F', '#DEB887', '#F4A460', '#D2691E', '#B8860B', '#DAA520'] },
    toxic: { name: 'Токсик', price: 380, colors: ['#CCFF00', '#9EF01A', '#70E000', '#38B000', '#008000', '#007200', '#006400', '#004B23'] },
    cyber: { name: 'Кибер', price: 400, colors: ['#00E5FF', '#00B8D4', '#0091EA', '#6200EA', '#AA00FF', '#D500F9', '#FF1744', '#F50057'] },
    ocean_pal: { name: 'Океан', price: 400, colors: ['#006994', '#0099CC', '#33CCCC', '#66D9D9', '#99E6E6', '#C2F0F0', '#E0FFFF', '#AFEEEE'] },
    candy_pal: { name: 'Конфеты', price: 420, colors: ['#FF69B4', '#FFB6C1', '#DDA0DD', '#EE82EE', '#DA70D6', '#BA55D3', '#9370DB', '#8A2BE2'] },
    retro_wave: { name: 'Синтвейв', price: 450, colors: ['#FF007F', '#FF4D6D', '#FF758F', '#7209B7', '#560BAD', '#480CA8', '#3F37C9', '#4CC9F0'] },
    rainbow: { name: 'Радуга', price: 480, colors: ['#FF0000', '#FF7F00', '#FFFF00', '#00FF00', '#0000FF', '#4B0082', '#9400D3', '#FF1493'] },
    galaxy: { name: 'Галактика', price: 520, colors: ['#311B92', '#4527A0', '#512DA8', '#5E35B1', '#7B1FA2', '#8E24AA', '#9C27B0', '#4A148C'] },
    gold_pal: { name: 'Золото', price: 600, colors: ['#FFF8E1', '#FFECB3', '#FFE082', '#FFD54F', '#FFCA28', '#FFC107', '#FFB300', '#FF8F00'] },
    royal: { name: 'Королевская', price: 750, colors: ['#240046', '#3C096C', '#5A189A', '#7B2CBF', '#FFD700', '#FFB703', '#E0AAFF', '#C77DFF'] },
};

const BACKGROUNDS = {
    default: { name: 'Стандарт', price: 0, colors: ['#FDE2E4', '#E2ECE9', '#D0E6F9', '#F9E2D0', '#2B2D42'] },
    sunset: { name: 'Закат', price: 220, colors: ['#FFB88C', '#FF9A8B', '#FF6B6B', '#FFD5A0', '#6A1B9A'] },
    desert: { name: 'Пустыня', price: 250, colors: ['#FDE68A', '#FCD34D', '#F59E0B', '#B45309', '#78350F'] },
    night: { name: 'Ночь', price: 300, colors: ['#0F172A', '#1E293B', '#1E1B4B', '#312E81', '#020617'], stars: true },
    forest: { name: 'Лес', price: 300, colors: ['#D9F99D', '#A3E635', '#65A30D', '#365314', '#1A2E05'] },
    snow: { name: 'Снега', price: 320, colors: ['#F0F9FF', '#E0F2FE', '#BAE6FD', '#7DD3FC', '#0C4A6E'] },
    bamboo: { name: 'Бамбук', price: 340, colors: ['#E9F5DB', '#CFE1B9', '#B5C99A', '#97A97C', '#718355'] },
    ocean: { name: 'Океан', price: 360, colors: ['#87CEEB', '#4A90E2', '#2E5C8A', '#1E3A5F', '#0A1E3F'] },
    sakura: { name: 'Сакура', price: 400, colors: ['#FDF2F8', '#FCE7F3', '#FBCFE8', '#F9A8D4', '#BE185D'] },
    twilight: { name: 'Сумерки', price: 420, colors: ['#2D1E2F', '#4E2A4F', '#7B3F61', '#A95C68', '#1A111D'] },
    city: { name: 'Город', price: 450, colors: ['#B0B0C0', '#9090A0', '#707080', '#505060', '#303040'] },
    glacier: { name: 'Ледник', price: 480, colors: ['#CAF0F8', '#90E0EF', '#48CAE4', '#0096C7', '#023E8A'] },
    lava: { name: 'Лава', price: 500, colors: ['#450A0A', '#7F1D1D', '#991B1B', '#B91C1C', '#1C0A0A'] },
    cyber: { name: 'Кибер', price: 520, colors: ['#0A0118', '#1E1B4B', '#4C1D95', '#7C3AED', '#2E1065'], stars: true },
    cloud_kingdom: { name: 'Облака', price: 550, colors: ['#E0F4FF', '#C2E7FF', '#A2D2FF', '#BDE0FE', '#8ECAE6'] },
    aurora: { name: 'Сияние', price: 580, colors: ['#0B3A5C', '#155E75', '#0E7490', '#4A1D96', '#1E1B4B'], stars: true },
    space: { name: 'Космос', price: 650, colors: ['#0a0020', '#200040', '#300060', '#400080', '#050010'], stars: true },
    candy_land: { name: 'Конфетная страна', price: 650, colors: ['#FFB6C1', '#FFC0CB', '#FFD1DC', '#FFE4E1', '#FF69B4'] },
    neon_city: { name: 'Неон-сити', price: 680, colors: ['#120458', '#2A0A5E', '#52057B', '#892CDC', '#0D0221'], stars: true },
    underwater: { name: 'Подводный', price: 720, colors: ['#006994', '#0099CC', '#33CCCC', '#66D9D9', '#0A1E3F'] },
    deep_sea: { name: 'Бездна океана', price: 780, colors: ['#001219', '#002838', '#003F5C', '#005F73', '#000814'] },
    volcano: { name: 'Вулкан', price: 850, colors: ['#8B0000', '#B22222', '#FF4500', '#FF6347', '#2F1B14'] },
    aurora_bg: { name: 'Северное сияние', price: 950, colors: ['#0B3D91', '#1E90FF', '#00FF7F', '#9370DB', '#1E1B4B'], stars: true },
    nebula: { name: 'Туманность', price: 1100, colors: ['#10002B', '#240046', '#3C096C', '#7209B7', '#08001A'], stars: true },
    golden_palace: { name: 'Золотой замок', price: 1400, colors: ['#3D2B1F', '#5C4033', '#8B6508', '#B8860B', '#24170E'], stars: true },
};

const SEASONS = [
    { months: [12, 1, 2], name: 'Зима', icon: '❄️', coinMult: 1.2, xpMult: 1.0 },
    { months: [3, 4, 5], name: 'Весна', icon: '🌸', coinMult: 1.0, xpMult: 1.15 },
    { months: [6, 7, 8], name: 'Лето', icon: '☀️', coinMult: 1.1, xpMult: 1.1 },
    { months: [9, 10, 11], name: 'Осень', icon: '🍂', coinMult: 1.15, xpMult: 1.0 },
];

const DAILY_CHALLENGES = [
    { id: 'golden_only', name: 'Золотой дождь', desc: 'Только золотые блоки', icon: '👑', modifiers: { onlyType: 'golden' } },
    { id: 'bomb_only', name: 'Минное поле', desc: 'Только бомбы', icon: '💣', modifiers: { onlyType: 'bomb' } },
    { id: 'ice_only', name: 'Гололёд', desc: 'Только лёд', icon: '❄️', modifiers: { onlyType: 'ice' } },
    { id: 'rainbow_only', name: 'Радуга', desc: 'Только радужные', icon: '🌈', modifiers: { onlyType: 'rainbow' } },
    { id: 'normal_only', name: 'Обыденность', desc: 'Только обычные', icon: '🍕', modifiers: { onlyType: 'normal' } },
    { id: 'crumble_only', name: 'Хрупкий мир', desc: 'Только хрупкие', icon: '🧱', modifiers: { onlyType: 'crumble' } },
    { id: 'fast_1_5', name: 'Турбо', desc: 'Скорость x1.5', icon: '⚡', modifiers: { speedMult: 1.5 } },
    { id: 'fast_2', name: 'Гипер-турбо', desc: 'Скорость x2', icon: '💨', modifiers: { speedMult: 2.0 } },
    { id: 'slow_0_7', name: 'Медитация', desc: 'Скорость x0.7', icon: '🧘', modifiers: { speedMult: 0.7 } },
    { id: 'rocket_start', name: 'Ракета', desc: 'Быстрый старт', icon: '🎯', modifiers: { startSpeed: 0.3 } },
    { id: 'lazy_start', name: 'Ленивый', desc: 'Медленный старт', icon: '🐌', modifiers: { startSpeed: 0.08 } },
    { id: 'double_score', name: 'x2 очки', desc: 'Все очки удвоены', icon: '✨', modifiers: { scoreMult: 2 } },
    { id: 'half_score', name: 'x0.5 очки', desc: 'Все очки пополам', icon: '📉', modifiers: { scoreMult: 0.5 } },
    { id: 'triple_score', name: 'x3 очки', desc: 'Все очки утроены', icon: '🌟', modifiers: { scoreMult: 3 } },
    { id: 'double_coins', name: 'x2 монеты', desc: 'Монеты удвоены', icon: '💰', modifiers: { coinMult: 2 } },
    { id: 'triple_coins', name: 'x3 монеты', desc: 'Монеты утроены', icon: '💎', modifiers: { coinMult: 3 } },
    { id: 'double_xp', name: 'x2 опыт', desc: 'Опыт удвоен', icon: '⭐', modifiers: { xpMult: 2 } },
    { id: 'small_start', name: 'Малыш', desc: 'Маленький стартовый блок', icon: '🐜', modifiers: { baseSize: 2.5 } },
    { id: 'big_start', name: 'Гигант', desc: 'Огромный стартовый блок', icon: '🐘', modifiers: { baseSize: 6 } },
    { id: 'one_shot', name: 'Один шанс', desc: 'Промах = конец', icon: '💀', modifiers: { noCut: true } },
    { id: 'no_fury', name: 'Без ярости', desc: 'Ярость не активируется', icon: '😴', modifiers: { noFury: true } },
    { id: 'fast_accel', name: 'Разгон', desc: 'Ускорение x2', icon: '🚀', modifiers: { accelMult: 2 } },
    { id: 'slow_accel', name: 'Плавный', desc: 'Ускорение x0.5', icon: '🌊', modifiers: { accelMult: 0.5 } },
    { id: 'time_30', name: 'Спринт', desc: 'Таймер 30 сек', icon: '⏱', modifiers: { timeLimit: 30 } },
    { id: 'time_90', name: 'Марафон', desc: 'Таймер 90 сек', icon: '🕐', modifiers: { timeLimit: 90 } },
    { id: 'glass_cannon', name: 'Стекл. пушка', desc: 'x3 очки, но 1 промах', icon: '🔮', modifiers: { scoreMult: 3, noCut: true } },
    { id: 'hardcore', name: 'Хардкор', desc: 'Быстро + 1 промах', icon: '☠️', modifiers: { speedMult: 1.5, noCut: true } },
    { id: 'rush', name: 'Спешка', desc: 'Быстро + x2 очки', icon: '🔥', modifiers: { speedMult: 1.3, scoreMult: 2 } },
    { id: 'rich', name: 'Богатый день', desc: 'x3 монеты + x2 очки', icon: '🤑', modifiers: { coinMult: 3, scoreMult: 2 } },
    { id: 'no_bombs', name: 'Без бомб', desc: 'Бомбы не выпадают', icon: '🚫', modifiers: { noBombs: true } },
    { id: 'no_golden', name: 'Без золота', desc: 'Золотые не выпадают', icon: '💤', modifiers: { noGolden: true } },
    { id: 'no_specials', name: 'Только база', desc: 'Только обычные блоки', icon: '⬜', modifiers: { noSpecials: true } },
    { id: 'no_combo', name: 'Без серии', desc: 'Серия не увеличивается', icon: '🧊', modifiers: { noCombo: true } },
    { id: 'time_20', name: 'Спринт-20', desc: 'Таймер 20 сек', icon: '⏱', modifiers: { timeLimit: 20 } },
    { id: 'time_45', name: 'Быстрый', desc: 'Таймер 45 сек', icon: '🕐', modifiers: { timeLimit: 45 } },
    { id: 'time_120', name: 'Долгий', desc: 'Таймер 120 сек', icon: '⏳', modifiers: { timeLimit: 120 } },
    { id: 'score_x5', name: 'x5 очки', desc: 'Все очки x5', icon: '💥', modifiers: { scoreMult: 5 } },
    { id: 'score_x10', name: 'x10 очки', desc: 'Все очки x10', icon: '🌟', modifiers: { scoreMult: 10 } },
    { id: 'coin_x5', name: 'x5 монеты', desc: 'Монеты x5', icon: '💰', modifiers: { coinMult: 5 } },
    { id: 'xp_x3', name: 'x3 опыт', desc: 'Опыт x3', icon: '📈', modifiers: { xpMult: 3 } },
    { id: 'tiny_blocks', name: 'Крохи', desc: 'Блоки 1.5', icon: '🐜', modifiers: { baseSize: 1.5 } },
    { id: 'huge_blocks', name: 'Мастодонт', desc: 'Блоки 8', icon: '🐘', modifiers: { baseSize: 8 } },
    { id: 'turbo_1_8', name: 'Форсаж', desc: 'Скорость x1.8', icon: '🏎️', modifiers: { speedMult: 1.8 } },
    { id: 'ice_skate', name: 'Скольжение', desc: 'Все блоки как лёд', icon: '⛸️', modifiers: { allIce: true } },
    { id: 'tight_perfect', name: 'Строгий идеал', desc: 'Идеал 0.05 вместо 0.15', icon: '🔍', modifiers: { tightThreshold: 0.05 } },
    { id: 'ultra_soft', name: 'Прощает', desc: 'Идеал 0.4 (легче)', icon: '🎈', modifiers: { tightThreshold: 0.4 } },
    { id: 'night_mode', name: 'Ночной', desc: 'Тёмный фон', icon: '🌙', modifiers: { forceBg: 'night' } },
    { id: 'rainbow_palace', name: 'Радужный', desc: 'Радужная палитра', icon: '🌈', modifiers: { forcePalette: 'rainbow' } },
    { id: 'speed_accel_x4', name: 'Гипер-разгон', desc: 'Ускорение x4', icon: '🚀', modifiers: { accelMult: 4 } },
];

const POWERUP_DEFS = {
    foundation: { icon: '🧱', name: 'Фундамент',   desc: 'Стартовый блок шире на 35%',    price: 120 },
    focus:      { icon: '🎯', name: 'Точный глаз', desc: 'Зона идеала в 3.5 раза шире',   price: 150 },
    luck:       { icon: '🍀', name: 'Удача',       desc: 'x2 редких, без бомб и хрупких', price: 180 },
    multiplier: { icon: '💰', name: 'Множитель',   desc: 'x2 монет за всю игру',          price: 200 }
};

let currentAchCategory = 'all';

const ACHIEVEMENTS = [
    // === ОБЩИЕ (general) ===
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

    // === КЛАССИКА (classic) ===
    { id: 'classic_20', category: 'classic', name: 'Классик', desc: '20 очков в «Классике»', icon: '🎮', reward: 40, check: () => (stats.modeMax?.classic || 0) >= 20 },
    { id: 'classic_50', category: 'classic', name: 'Архитектор', desc: '50 очков в «Классике»', icon: '🏛️', reward: 90, check: () => (stats.modeMax?.classic || 0) >= 50 },
    { id: 'classic_100', category: 'classic', name: 'Гранд-архитектор', desc: '100 очков в «Классике»', icon: '🗼', reward: 200, check: () => (stats.modeMax?.classic || 0) >= 100 },

    // === НА ВРЕМЯ (time) ===
    { id: 'time_20', category: 'time', name: 'Спринтер', desc: '20 очков в режиме «На время»', icon: '⏱', reward: 40, check: () => (stats.modeMax?.time || 0) >= 20 },
    { id: 'time_45', category: 'time', name: 'Молния', desc: '45 очков в режиме «На время»', icon: '⚡', reward: 100, check: () => (stats.modeMax?.time || 0) >= 45 },
    { id: 'time_80', category: 'time', name: 'Повелитель секунд', desc: '80 очков в режиме «На время»', icon: '⏳', reward: 220, check: () => (stats.modeMax?.time || 0) >= 80 },

    // === ТОЧНОСТЬ (precision) ===
    { id: 'precision_10', category: 'precision', name: 'Без права на ошибку', desc: '10 очков в «Точности»', icon: '🎯', reward: 60, check: () => (stats.modeMax?.precision || 0) >= 10 },
    { id: 'precision_25', category: 'precision', name: 'Хирург', desc: '25 очков в «Точности»', icon: '🩺', reward: 140, check: () => (stats.modeMax?.precision || 0) >= 25 },
    { id: 'precision_50', category: 'precision', name: 'Абсолютный лазер', desc: '50 очков в «Точности»', icon: '💎', reward: 300, check: () => (stats.modeMax?.precision || 0) >= 50 },

    // === ШТОРМ (storm) ===
    { id: 'storm_15', category: 'storm', name: 'Против ветра', desc: '15 очков в «Шторме»', icon: '🌪', reward: 50, check: () => (stats.modeMax?.storm || 0) >= 15 },
    { id: 'storm_35', category: 'storm', name: 'Укротитель бури', desc: '35 очков в «Шторме»', icon: '🌩️', reward: 120, check: () => (stats.modeMax?.storm || 0) >= 35 },
    { id: 'storm_70', category: 'storm', name: 'Око урагана', desc: '70 очков в «Шторме»', icon: '🌀', reward: 250, check: () => (stats.modeMax?.storm || 0) >= 70 },

    // === БЕСКОНЕЧНЫЙ (endless) ===
    { id: 'endless_30', category: 'endless', name: 'Марафонец', desc: '30 очков в «Бесконечном»', icon: '♾️', reward: 50, check: () => (stats.modeMax?.endless || 0) >= 30 },
    { id: 'endless_75', category: 'endless', name: 'Стальной ритм', desc: '75 очков в «Бесконечном»', icon: '🚀', reward: 140, check: () => (stats.modeMax?.endless || 0) >= 75 },
    { id: 'endless_150', category: 'endless', name: 'За гранью скорости', desc: '150 очков в «Бесконечном»', icon: '🌌', reward: 300, check: () => (stats.modeMax?.endless || 0) >= 150 },

    // === ЗЕРКАЛЬНЫЙ (mirror) ===
    { id: 'mirror_15', category: 'mirror', name: 'Зазеркалье', desc: '15 очков в «Зеркальном»', icon: '🪞', reward: 50, check: () => (stats.modeMax?.mirror || 0) >= 15 },
    { id: 'mirror_35', category: 'mirror', name: 'Мастер отражений', desc: '35 очков в «Зеркальном»', icon: '✨', reward: 120, check: () => (stats.modeMax?.mirror || 0) >= 35 },
    { id: 'mirror_65', category: 'mirror', name: 'Король зеркал', desc: '65 очков в «Зеркальном»', icon: '👑', reward: 240, check: () => (stats.modeMax?.mirror || 0) >= 65 },

    // === ПРОГРЕСС И АКТИВНОСТИ (progress) ===
    { id: 'skins_3', category: 'progress', name: 'Коллекционер', desc: 'Открой 3 облика', icon: '🎨', reward: 40, check: () => unlockedSkins.length >= 3 },
    { id: 'skins_10', category: 'progress', name: 'Модник', desc: 'Открой 10 обликов', icon: '🧥', reward: 120, check: () => unlockedSkins.length >= 10 },
    { id: 'skins_all', category: 'progress', name: 'Все облики', desc: 'Собери все основные облики', icon: '🏆', reward: 500, special: 'legend', check: () => {
        const buyable = Object.keys(SKINS).filter(k => k !== 'legend' && !SKINS[k].notBuyable && !SKINS[k].prestigeOnly && !SKINS[k].eventOnly);
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
];

// ============ STATE ============
const IS_MOBILE = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || window.innerWidth < 768;
let lowPerfMode = false;
let lastPerfCheck = 0;
let lowFpsStrikes = 0;
let rafId = null;

const BLOCK_SIZE = GAME_CONFIG.BLOCK_SIZE;
const BLOCK_HEIGHT = GAME_CONFIG.BLOCK_HEIGHT;
const BASE_SPEED = GAME_CONFIG.BASE_SPEED;

let dynamicMaxSpeed = GAME_CONFIG.DEFAULT_MAX_SPEED;
let scene, camera, renderer, musicGain, windGain;
let bgStarsGroup = null;
let blocks = [], debris = [], confetti = [];
let currentBlock, nextBlockData, direction = 1;
let score = 0, combo = 0;

let coins = safeParseInt(safeGetItem(STORAGE_KEYS.COINS, '0'), 0);
let sessionCoins = 0, sessionXP = 0;
let highScore = safeParseInt(safeGetItem(STORAGE_KEYS.HIGH_SCORE, '0'), 0);
let bestHeight = safeParseInt(safeGetItem('towerBestHeight', String(highScore)), highScore);
let recordLineGroup = null;
let recordLinePassed = false;

let currentSkin = (typeof safeGetItem(STORAGE_KEYS.SKIN, 'default') === 'string') ? safeGetItem(STORAGE_KEYS.SKIN, 'default') : 'default';
let unlockedSkins = validateArray(safeGetItem(STORAGE_KEYS.SKINS, ['default']), ['default']);
let currentPalette = (typeof safeGetItem(STORAGE_KEYS.PALETTE, 'standard') === 'string') ? safeGetItem(STORAGE_KEYS.PALETTE, 'standard') : 'standard';
let unlockedPalettes = validateArray(safeGetItem(STORAGE_KEYS.PALETTES, ['standard']), ['standard']);
let currentBackground = (typeof safeGetItem(STORAGE_KEYS.BACKGROUND, 'default') === 'string') ? safeGetItem(STORAGE_KEYS.BACKGROUND, 'default') : 'default';
let unlockedBackgrounds = validateArray(safeGetItem(STORAGE_KEYS.BACKGROUNDS, ['default']), ['default']);
let unlockedFeatures = validateObject(safeGetItem(STORAGE_KEYS.FEATURES, {}), {});

let gameState = GAME_STATES.MENU, gameMode = GAME_MODES.CLASSIC;
let currentMenuTab = 'play';
let currentShopTab = 'skins';
let windStrength = 0, windDirection = 1, windGustTimer = null;
let movingAxis = 'x', currentSpeed = BASE_SPEED;
let currentBaseSize = BLOCK_SIZE;
let perfectWaves = [];
let perfectWaveTexture = null;
let currentBiomeIndex = 0, targetBgColor = new THREE.Color(BACKGROUNDS.default.colors[0]), shakeIntensity = 0;
let cameraZoomPulse = 0;
let timeLeft = GAME_CONFIG.DEFAULT_TIME_LIMIT, timeAttackTimer = null;
let showTutorialHint = !safeGetItem(STORAGE_KEYS.TUTORIAL_SHOWN, false);
let clock = new THREE.Clock();
let newQuestsTimeout = null, quests = [];
let isFury = false, furyBlocksLeft = 0;
let glowTexture = null;
let dailyModifiers = {};
let dailyChallengeActive = false;
let savedBgBeforeDaily = null;
let savedPaletteBeforeDaily = null;
let currentLbMode = GAME_MODES.CLASSIC;

let secondChanceUsed = false;
let secondChanceActive = false;
let secondChanceEndTime = 0;
let secondChanceRaf = null;
let resumeDelayTimer = null;

let overviewActive = false;
let overviewTargetZoom = 1;
let overviewTargetY = 0;
let overviewSkipped = false;
let overviewSkipReadyAt = 0;

let wheelController = null;
let wheelTimerInterval = null;

const DEFAULT_SETTINGS = { ...DEFAULTS.SETTINGS };
const DEFAULT_STATS = { ...DEFAULTS.STATS, missionsCompleted: 0, eventsRewards: 0 };

let settings = { ...DEFAULT_SETTINGS, ...validateObject(safeGetItem(STORAGE_KEYS.SETTINGS, null), DEFAULT_SETTINGS) };
function saveSettings() { safeSetItem(STORAGE_KEYS.SETTINGS, settings); scheduleCloudSave(); }

let stats = { ...DEFAULT_STATS, ...validateObject(safeGetItem(STORAGE_KEYS.STATS, null), DEFAULT_STATS) };
if (stats.missionsCompleted === undefined) stats.missionsCompleted = 0;
if (stats.eventsRewards === undefined) stats.eventsRewards = 0;
if (!stats.modeMax || typeof stats.modeMax !== 'object') stats.modeMax = {};
if (!stats.modeGames || typeof stats.modeGames !== 'object') stats.modeGames = {};
if (stats.wheelSpins === undefined) stats.wheelSpins = 0;
if (stats.minigamesWon === undefined) stats.minigamesWon = 0;
if (stats.upgradesBought === undefined) stats.upgradesBought = 0;
function saveStats() { safeSetItem(STORAGE_KEYS.STATS, stats); scheduleCloudSave(); }

let totalScoreAllTime = safeParseInt(safeGetItem(STORAGE_KEYS.TOTAL_SCORE, '0'), 0);
function saveTotalScore() { safeSetItem(STORAGE_KEYS.TOTAL_SCORE, String(totalScoreAllTime)); }

let recentScores = validateArray(safeGetItem(STORAGE_KEYS.RECENT_SCORES, []), []);
function saveRecentScores() { safeSetItem(STORAGE_KEYS.RECENT_SCORES, recentScores); }

let unlockedAchievements = validateArray(safeGetItem(STORAGE_KEYS.ACHIEVEMENTS, []), []);
function saveAchievements() { safeSetItem(STORAGE_KEYS.ACHIEVEMENTS, unlockedAchievements); scheduleCloudSave(); }

let xpTotal = safeParseInt(safeGetItem(STORAGE_KEYS.XP, '0'), 0);
let level = safeParseInt(safeGetItem(STORAGE_KEYS.LEVEL, '1'), 1);
function saveLevelProgress() {
    safeSetItem(STORAGE_KEYS.XP, String(xpTotal));
    safeSetItem(STORAGE_KEYS.LEVEL, String(level));
    scheduleCloudSave();
}

let streak = safeParseInt(safeGetItem(STORAGE_KEYS.STREAK, '0'), 0);
let lastVisitDate = safeGetItem(STORAGE_KEYS.LAST_VISIT, '') || '';
let dailyRewardPending = false, dailyRewardAmount = 0;
let leaderboard = validateArray(safeGetItem(STORAGE_KEYS.LEADERBOARD, []), []);
function saveLeaderboard() { safeSetItem(STORAGE_KEYS.LEADERBOARD, leaderboard); }

// Переносим прошлые рекорды из leaderboard в stats.modeMax для достижений по режимам
leaderboard.forEach(e => {
    if (e.mode && e.score > (stats.modeMax[e.mode] || 0)) {
        stats.modeMax[e.mode] = e.score;
    }
});

let ownedPowerups = {
    ...DEFAULTS.POWERUPS,
    ...validateObject(safeGetItem(STORAGE_KEYS.POWERUPS, null), {})
};
// Конвертация старых способностей, если они были у игрока
if (ownedPowerups.magnet || ownedPowerups.freeze || ownedPowerups.ghost) {
    ownedPowerups.foundation = (ownedPowerups.foundation || 0) + (ownedPowerups.magnet || 0);
    ownedPowerups.focus = (ownedPowerups.focus || 0) + (ownedPowerups.freeze || 0);
    ownedPowerups.luck = (ownedPowerups.luck || 0) + (ownedPowerups.ghost || 0);
    delete ownedPowerups.magnet;
    delete ownedPowerups.freeze;
    delete ownedPowerups.ghost;
    safeSetItem(STORAGE_KEYS.POWERUPS, ownedPowerups);
}
function savePowerups() { safeSetItem(STORAGE_KEYS.POWERUPS, ownedPowerups); scheduleCloudSave(); }

let activePowerups = { ...DEFAULTS.ACTIVE_POWERUPS };
let lastUsedPowerups = { ...DEFAULTS.ACTIVE_POWERUPS };
let pendingGameMode = null;
let gameOverTimers = [];

function clearGameOverTimers() {
    gameOverTimers.forEach(id => clearTimeout(id));
    gameOverTimers = [];
}

let chests = validateArray(safeGetItem(STORAGE_KEYS.CHESTS, []), []);
function saveChests() { safeSetItem(STORAGE_KEYS.CHESTS, chests); scheduleCloudSave(); }

let currentMusicPhase = 1;

// Миссии, события и мини-игры
let missions = [];
let missionsTimerInterval = null;
let currentEvent = null;
let eventNotificationInterval = null;
let activeMinigame = null;
let minigamesCooldownInterval = null;

function getMusicPhase() {
    if (isFury) return 4;
    if (score >= GAME_CONFIG.MUSIC_PHASE_3_SCORE) return 3;
    if (score >= GAME_CONFIG.MUSIC_PHASE_2_SCORE) return 2;
    return 1;
}

function getCurrentSeason() {
    const m = new Date().getMonth() + 1;
    return SEASONS.find(s => s.months.includes(m)) || SEASONS[0];
}

function getSkinModifiers() { return (SKINS[currentSkin] && SKINS[currentSkin].modifiers) || {}; }
function getPaletteColors() { return (PALETTES[currentPalette] || PALETTES.standard).colors; }
function getBgColors() { return (BACKGROUNDS[currentBackground] || BACKGROUNDS.default).colors; }

const QUESTS_POOL = [
    { type: 'perfect', target: 3, text: '🎯 Точность x3', reward: 15 },
    { type: 'perfect', target: 5, text: '🎯 Точность x5', reward: 25 },
    { type: 'perfect', target: 8, text: '🎯 Точность x8', reward: 35 },
    { type: 'perfect', target: 10, text: '🎯 Точность x10', reward: 45 },
    { type: 'perfect', target: 15, text: '🎯 Точность x15', reward: 60 },
    { type: 'perfect', target: 20, text: '🎯 Точность x20', reward: 80 },
    { type: 'stack', target: 10, text: '🏗️ Высота 10', reward: 25 },
    { type: 'stack', target: 15, text: '🏗️ Высота 15', reward: 35 },
    { type: 'stack', target: 20, text: '🏗️ Высота 20', reward: 50 },
    { type: 'stack', target: 25, text: '🏗️ Высота 25', reward: 70 },
    { type: 'stack', target: 30, text: '🏗️ Высота 30', reward: 90 },
    { type: 'combo', target: 2, text: '🔥 Серия x2', reward: 15 },
    { type: 'combo', target: 3, text: '🔥 Серия x3', reward: 25 },
    { type: 'combo', target: 5, text: '🔥 Серия x5', reward: 45 },
    { type: 'combo', target: 7, text: '🔥 Серия x7', reward: 70 },
    { type: 'cut', target: 5, text: '✂️ 5 срезов', reward: 15 },
    { type: 'cut', target: 10, text: '✂️ 10 срезов', reward: 30 },
    { type: 'cut', target: 20, text: '✂️ 20 срезов', reward: 60 },
    { type: 'games', target: 2, text: '🎮 2 игры', reward: 15 },
    { type: 'games', target: 5, text: '🎮 5 игр', reward: 30 },
    { type: 'golden', target: 1, text: '👑 1 золотой', reward: 20 },
    { type: 'golden', target: 3, text: '👑 3 золотых', reward: 50 },
    { type: 'bomb', target: 1, text: '💣 1 бомба', reward: 20 },
    { type: 'ice', target: 1, text: '❄️ 1 лёд', reward: 20 },
    { type: 'fury', target: 1, text: '💥 1 ярость', reward: 40 },
    { type: 'time_game', target: 1, text: '⏱️ 1 на время', reward: 20 },
    { type: 'secret', target: 1, text: '🌟 1 секретный', reward: 30 },
    { type: 'secret', target: 3, text: '🌟 3 секретных', reward: 80 },
];

// ============ DOM ============
const $ = id => document.getElementById(id);
const splashScreen = $('splash-screen');
const restartPowerupsBtn = $('restart-powerups-btn');
const scoreEl = $('score'), highScoreEl = $('high-score'), gameCoinsEl = $('game-coins');
const gameOverEl = $('game-over'), pauseScreen = $('pause-screen');
const rulesScreen = $('rules-screen'), startScreen = $('start-screen');
const achScreen = $('achievements-screen'), lbScreen = $('leaderboard-screen');
const settingsScreen = $('settings-screen'), dailyScreen = $('daily-screen');
const powerupsScreen = $('powerups-screen'), chestScreen = $('chest-screen');
const prestigeConfirmScreen = $('prestige-confirm-screen');
const prestigeChestScreen = $('prestige-chest-screen');
const eventScreen = $('event-screen');
const minigamesScreen = $('minigames-screen');
const minigamesStatusEl = $('minigames-status');
const minigamesListEl = $('minigames-list');
const minigameStageEl = $('minigame-stage');
const minigameResultEl = $('minigame-result');
const upgradesListEl = $('upgrades-list');
const wheelScreen = $('wheel-screen');
const wheelCanvas = $('wheel-canvas');
const wheelStatusEl = $('wheel-status');
const wheelResultEl = $('wheel-result');
const wheelSpinBtn = $('wheel-spin-btn');
const wheelBannerDescEl = $('wheel-banner-desc');
const wheelBannerDotEl = $('wheel-banner-dot');
const rerollMissionsBtn = $('reroll-missions-btn');
const secondChanceOverlay = $('second-chance-overlay');
const secondChanceSubEl = $('second-chance-sub');
const secondChanceTimerFill = $('second-chance-timer-fill');
const secondChanceBuyBtn = $('second-chance-buy');
const secondChanceSkipBtn = $('second-chance-skip');
const towerHeightBanner = $('tower-height-banner');
const towerHeightMetersEl = $('tower-height-meters');
const towerHeightCompareEl = $('tower-height-compare');
const gameOverHeightEl = $('game-over-height');
const perfectText = $('perfect-text'), comboText = $('combo-text'), milestoneText = $('milestone-text'), bonusText = $('bonus-text');
const levelupPopup = $('levelup-popup'), achievementPopup = $('achievement-popup');
const finalScoreVal = $('final-score-val'), gameCoinsEarnedEl = $('game-coins-earned'), gameXPEarnedEl = $('game-xp-earned');
const timerEl = $('timer'), modeLabel = $('mode-label');
const windIndicatorEl = $('wind-indicator'), windFillEl = $('wind-fill');
const questsEl = $('quests'), muteBtn = $('mute-btn'), pauseBtn = $('pause-btn'), menuToggleBtn = $('menu-toggle-btn');
const tutorialEl = $('tutorial');
const screenFlash = $('screen-flash'), skinListEl = $('skin-list'), menuCoinsEl = $('menu-coins');
const shopProgressEl = $('shop-progress');
const colorsListEl = $('colors-list'), backgroundsListEl = $('backgrounds-list');
const achListEl = $('ach-list'), achProgressEl = $('ach-progress');
const menuLevelNum = $('menu-level-num'), menuXPFill = $('menu-xp-fill'), menuXPText = $('menu-xp-text');
const menuStreakEl = $('menu-streak');
const dailyStreakText = $('daily-streak-text'), dailyCoinsReward = $('daily-coins-reward'), dailySubText = $('daily-sub-text');
const activePowerupsEl = $('active-powerups');
const dailyBannerEl = $('daily-challenge-banner'), dailyNameEl = $('daily-name'), dailyDescEl = $('daily-desc'), dailyIconEl = $('daily-icon'), dailyPlayBtn = $('daily-play-btn');
const seasonPillEl = $('season-pill');
const victoryCrownEl = $('victory-crown');

const comboIndicatorEl = $('combo-indicator');
const comboProgressFillEl = $('combo-progress-fill');
const comboMultiplierTextEl = $('combo-multiplier-text');
const missionsListEl = $('missions-list');
const missionsStatsTextEl = $('missions-stats-text');
const missionsAvailableTextEl = $('missions-available-text');
const missionsTimerEl = $('missions-timer');
const missionsBadgeEl = $('missions-badge');
const prestigeSectionEl = $('prestige-section');
const prestigeCountBadgeEl = $('prestige-count-badge');
const prestigeProfileBadgeEl = $('prestige-profile-badge');
const prestigeCountDisplayEl = $('prestige-count-display');
const prestigeBonusTextEl = $('prestige-bonus-text');
const prestigeProgressFillEl = $('prestige-progress-fill');
const prestigeProgressTextEl = $('prestige-progress-text');
const prestigeActivateBtnEl = $('prestige-activate-btn');
const prestigeCoinsPreviewEl = $('prestige-coins-preview');
const prestigeChestsPreviewEl = $('prestige-chests-preview');
const prestigeBonusPreviewEl = $('prestige-bonus-preview');
const prestigeConfirmBtn = $('prestige-confirm-btn');
const prestigeCancelBtn = $('prestige-cancel-btn');
const prestigeChestIconEl = $('prestige-chest-icon');
const prestigeRewardTextEl = $('prestige-reward-text');
const openPrestigeChestBtn = $('open-prestige-chest-btn');
const closePrestigeChestBtn = $('close-prestige-chest');
const eventBannerEl = $('event-banner');
const eventIconEl = $('event-icon');
const eventLabelEl = $('event-label');
const eventNameEl = $('event-name');
const eventDescEl = $('event-desc');
const eventBadgeEl = $('event-badge');
const eventProgressFillEl = $('event-progress-fill');
const eventProgressTextEl = $('event-progress-text');
const eventModalIconEl = $('event-modal-icon');
const eventTitleEl = $('event-title');
const eventModalDescEl = $('event-modal-desc');
const eventModalDatesEl = $('event-modal-dates');
const eventRewardsTimelineEl = $('event-rewards-timeline');

let pendingPrestigeRewards = [];

if (highScoreEl) highScoreEl.innerText = `РЕКОРД: ${highScore}`;

// ============ СЕЗОН ============
function initSeason() {
    const season = getCurrentSeason();
    const bonusParts = [];
    if (season.coinMult > 1) bonusParts.push(`+${Math.round((season.coinMult - 1) * 100)}% 🪙`);
    if (season.xpMult > 1) bonusParts.push(`+${Math.round((season.xpMult - 1) * 100)}% опыта`);
    if (bonusParts.length > 0 && seasonPillEl) {
        seasonPillEl.innerText = `${season.icon} ${season.name} ${bonusParts.join(' ')}`;
        seasonPillEl.style.display = 'block';
    }
}

// ============ DAILY CHALLENGE ============
function getDailyChallenge() {
    const today = new Date();
    const seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
    return DAILY_CHALLENGES[seed % DAILY_CHALLENGES.length];
}

function getDailyChallengeStatus() {
    return safeGetItem(STORAGE_KEYS.DAILY_CHALLENGE_DATE, null) === new Date().toDateString();
}

function markDailyChallengePlayed() {
    safeSetItem(STORAGE_KEYS.DAILY_CHALLENGE_DATE, new Date().toDateString());
    stats.dailyCompleted = (stats.dailyCompleted || 0) + 1;
    saveStats();
    checkAchievements();
}

function renderDailyChallenge() {
    if (!dailyBannerEl) return;
    const challenge = getDailyChallenge();
    dailyNameEl.innerText = challenge.name;
    dailyDescEl.innerText = challenge.desc;
    dailyIconEl.innerText = challenge.icon;
    const played = getDailyChallengeStatus();
    if (played) {
        dailyBannerEl.classList.add('played');
        dailyPlayBtn.innerText = '✓';
        dailyPlayBtn.disabled = true;
    } else {
        dailyBannerEl.classList.remove('played');
        dailyPlayBtn.innerText = 'ИГРАТЬ';
        dailyPlayBtn.disabled = false;
    }
}

function startDailyChallenge() {
    if (getDailyChallengeStatus()) return;
    const challenge = getDailyChallenge();
    dailyChallengeActive = true;
    dailyModifiers = challenge.modifiers;
    gameMode = GAME_MODES.CLASSIC;
    markDailyChallengePlayed();
    renderDailyChallenge();
    startGame(GAME_MODES.CLASSIC);
}

function restoreDailyVisuals() {
    if (savedBgBeforeDaily) {
        currentBackground = savedBgBeforeDaily;
        savedBgBeforeDaily = null;
        applyBackground();
    }
    if (savedPaletteBeforeDaily) {
        currentPalette = savedPaletteBeforeDaily;
        savedPaletteBeforeDaily = null;
    }
}

// ============ КОМБО-ИНДИКАТОР ============
function updateComboIndicator() {
    if (!comboIndicatorEl) return;
    const display = formatComboDisplay(combo);
    if (combo === 0) {
        comboIndicatorEl.classList.remove('active');
        return;
    }
    comboIndicatorEl.classList.add('active');
    comboIndicatorEl.style.setProperty('--combo-color', display.color);
    if (comboMultiplierTextEl) {
        updateDOMText(comboMultiplierTextEl, display.text);
        comboMultiplierTextEl.style.color = display.color;
    }
    if (comboProgressFillEl) {
        updateDOMStyle(comboProgressFillEl, 'width', `${Math.min(100, display.progress * 100)}%`);
        updateDOMStyle(comboProgressFillEl, 'background', display.color);
    }
}

// ============ МОНЕТЫ (с пулом DOM-элементов) ============
let coinPopupAnchor = { x: window.innerWidth / 2, y: 120 };
const COIN_POPUP_POOL = [];
const COIN_POPUP_POOL_SIZE = 6;
let coinPopupPoolIdx = 0;

function cacheCoinPopupAnchor() {
    if (!gameCoinsEl) return;
    const rect = gameCoinsEl.getBoundingClientRect();
    if (rect.width > 0) {
        coinPopupAnchor.x = rect.left + rect.width / 2;
        coinPopupAnchor.y = rect.bottom + 4;
    }
}

function addCoins(amount) {
    if (amount <= 0) return;
    let mult = 1;
    if (activePowerups.multiplier && gameState === GAME_STATES.PLAYING) mult *= 2;
    if (dailyModifiers.coinMult) mult *= dailyModifiers.coinMult;
    const skinMods = getSkinModifiers();
    if (skinMods.coinMult) mult *= skinMods.coinMult;
    const season = getCurrentSeason();
    if (season.coinMult) mult *= season.coinMult;
    const prestigeBonus = getPrestigeBonus();
    if (prestigeBonus.coinMult > 0) mult *= (1 + prestigeBonus.coinMult);
    if (prestigeBonus.allMult > 0) mult *= (1 + prestigeBonus.allMult);
    const upg = getUpgradeBonuses();
    if (upg.coinMult > 0) mult *= (1 + upg.coinMult);
    amount = Math.round(amount * mult);
    coins += amount; sessionCoins += amount;
    safeSetItem(STORAGE_KEYS.COINS, coins);
    scheduleCloudSave();
    updateCoinUI(); showCoinPopup(amount);
    updateMissionProgress(missions, 'coins', amount);
    if (gameCoinsEl) {
        gameCoinsEl.classList.remove('coin-pulse');
        requestAnimationFrame(() => gameCoinsEl.classList.add('coin-pulse'));
    }
    announceToScreenReader(`Получено ${amount} монет`);
}

function showCoinPopup(amount) {
    if (COIN_POPUP_POOL.length === 0) {
        for (let i = 0; i < COIN_POPUP_POOL_SIZE; i++) {
            const el = document.createElement('div');
            el.className = 'coin-popup';
            el.style.display = 'none';
            el.addEventListener('animationend', () => {
                el.style.display = 'none';
            });
            document.body.appendChild(el);
            COIN_POPUP_POOL.push(el);
        }
    }

    const popup = COIN_POPUP_POOL[coinPopupPoolIdx];
    coinPopupPoolIdx = (coinPopupPoolIdx + 1) % COIN_POPUP_POOL_SIZE;

    popup.textContent = `+${amount} 🪙`;
    popup.style.left = coinPopupAnchor.x + 'px';
    popup.style.top = coinPopupAnchor.y + 'px';
    popup.style.animation = 'none';
    popup.style.display = 'block';
    requestAnimationFrame(() => {
        popup.style.animation = '';
    });
}

// ============ XP & LEVEL ============
function addXP(amount) {
    if (amount <= 0) return;
    let mult = 1;
    if (dailyModifiers.xpMult) mult *= dailyModifiers.xpMult;
    const skinMods = getSkinModifiers();
    if (skinMods.xpMult) mult *= skinMods.xpMult;
    const season = getCurrentSeason();
    if (season.xpMult) mult *= season.xpMult;
    const prestigeBonus = getPrestigeBonus();
    if (prestigeBonus.xpMult > 0) mult *= (1 + prestigeBonus.xpMult);
    if (prestigeBonus.allMult > 0) mult *= (1 + prestigeBonus.allMult);
    const upg = getUpgradeBonuses();
    if (upg.xpMult > 0) mult *= (1 + upg.xpMult);
    amount = Math.round(amount * mult);
    xpTotal += amount; sessionXP += amount;
    updateMissionProgress(missions, 'xp', amount);
    const oldLevel = level;
    while (xpTotal >= xpForNextLevel(level) && level < LIMITS.MAX_LEVEL) {
        xpTotal -= xpForNextLevel(level);
        level++;
        addCoins(GAME_CONFIG.COINS_LEVEL_UP);
        showPopup(levelupPopup, `🏅 УРОВЕНЬ ${level}! +${GAME_CONFIG.COINS_LEVEL_UP} 🪙`, 2000);
        playSound('milestone');
        triggerHaptic('success');
        checkAchievements();
    }
    if (level > oldLevel) handleLevelMilestones(oldLevel, level);
    saveLevelProgress();
    updateLevelUI();
}

function updateLevelUI() {
    const nextXP = xpForNextLevel(level);
    updateDOMText(menuLevelNum, level);
    updateDOMStyle(menuXPFill, 'width', Math.min(100, (xpTotal / nextXP) * 100) + '%');
    updateDOMText(menuXPText, `${xpTotal} / ${nextXP} опыта`);
    updatePrestigeUI();
}

// ============ STREAK ============
function checkDailyStreak() {
    const today = new Date().toDateString();
    if (today === lastVisitDate) return;
    const lastDate = lastVisitDate ? new Date(lastVisitDate) : null;
    const todayDate = new Date(today);
    let dayDiff = 999;
    if (lastDate) dayDiff = Math.floor((todayDate - lastDate) / (1000 * 60 * 60 * 24));
    if (dayDiff === 1) streak++;
    else streak = 1;
    lastVisitDate = today;
    safeSetItem(STORAGE_KEYS.LAST_VISIT, lastVisitDate);
    safeSetItem(STORAGE_KEYS.STREAK, streak);
    scheduleCloudSave();
    dailyRewardAmount = Math.min(100, 10 + (streak - 1) * 5);
    dailyRewardPending = true;
    if (streak % 3 === 0 || streak === 7 || streak === 30 || streak === 100) addChest('daily', { streak });
    updateStreakUI();
    updateMissionProgress(missions, 'streak', streak, true);
}

function updateStreakUI() {
    if (!menuStreakEl) return;
    if (streak > 0) {
        updateDOMText(menuStreakEl, `🔥 ${streak}`);
        menuStreakEl.classList.remove('hidden');
    } else {
        menuStreakEl.classList.add('hidden');
    }
}

function showDailyReward() {
    if (!dailyRewardPending) return;
    dailyStreakText.innerText = `🔥 День ${streak} подряд!`;
    dailyCoinsReward.innerText = `+${dailyRewardAmount} 🪙`;
    if (streak === 1) dailySubText.innerText = 'Заходи каждый день — награда растёт!';
    else if (streak < 7) dailySubText.innerText = `Следующий день: +${Math.min(100, 10 + streak * 5)} 🪙`;
    else dailySubText.innerText = '🔥 Максимальная награда!';
    showModal(dailyScreen);
}

// ============ АЧИВКИ ============
function checkAchievements() {
    let newUnlocked = false;
    ACHIEVEMENTS.forEach(a => {
        if (unlockedAchievements.includes(a.id)) return;
        try {
            if (a.check()) {
                unlockedAchievements.push(a.id);
                newUnlocked = true;
                const rewardAmount = a.reward || 20;
                addCoins(rewardAmount);
                showPopup(achievementPopup, `${a.icon} ${a.name}!`, 2000);
                playSound('quest');
                triggerHaptic('success');
                if (a.special === 'legend' && !unlockedSkins.includes('legend')) {
                    unlockedSkins.push('legend');
                    safeSetItem(STORAGE_KEYS.SKINS, unlockedSkins);
                    setTimeout(() => showPopup(bonusText, '👑 ОБЛИК «ЛЕГЕНДА»!', 2500), 2200);
                }
                if (a.feature) {
                    unlockedFeatures[a.feature] = true;
                    safeSetItem(STORAGE_KEYS.FEATURES, unlockedFeatures);
                    setTimeout(() => showPopup(bonusText, `✨ ${FEATURE_NAMES[a.feature]}!`, 2500), 2200);
                }
            }
        } catch (e) {}
    });
    if (newUnlocked) saveAchievements();
}

function renderAchievements() {
    if (!achListEl) return;
    document.querySelectorAll('.ach-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.achCat === currentAchCategory);
    });
    const list = currentAchCategory === 'all'
        ? ACHIEVEMENTS
        : ACHIEVEMENTS.filter(a => a.category === currentAchCategory);

    achListEl.innerHTML = '';
    list.forEach(a => {
        const unlocked = unlockedAchievements.includes(a.id);
        const div = document.createElement('div');
        div.className = 'ach-item' + (unlocked ? ' unlocked' : '');
        const rewardTag = !unlocked && a.reward ? `<span class="ach-reward-tag">+${a.reward} 🪙</span>` : '';
        div.innerHTML = `<span class="ach-icon">${a.icon}</span><div class="ach-info"><span class="ach-name">${a.name}${unlocked ? ' ✓' : ''}</span><span class="ach-desc">${a.desc}</span></div>${rewardTag}`;
        achListEl.appendChild(div);
    });

    const unlockedInView = list.filter(a => unlockedAchievements.includes(a.id)).length;
    if (achProgressEl) {
        achProgressEl.innerText = currentAchCategory === 'all'
            ? `${unlockedAchievements.length}/${ACHIEVEMENTS.length}`
            : `${unlockedInView}/${list.length}`;
    }
}

// ============ LEADERBOARD ============
function addToLeaderboard(scoreValue, mode) {
    if (!Number.isFinite(scoreValue) || scoreValue <= 0) return;
    leaderboard.push({
        score: Math.floor(scoreValue),
        mode,
        date: new Date().toLocaleDateString('ru-RU'),
        ts: Date.now()
    });
    if (leaderboard.length > LIMITS.MAX_LEADERBOARD_ENTRIES) {
        leaderboard.sort((a, b) => (b.ts || 0) - (a.ts || 0));
        leaderboard = leaderboard.slice(0, LIMITS.MAX_LEADERBOARD_ENTRIES);
    }
    saveLeaderboard();
}

function renderLeaderboard() {
    document.querySelectorAll('.lb-mode-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.mode === currentLbMode);
    });
    const modeEntries = leaderboard.filter(e => e.mode === currentLbMode);
    const bestValEl = document.getElementById('lb-best-value');
    const bestSubEl = document.getElementById('lb-best-sub');
    if (modeEntries.length > 0) {
        const sorted = [...modeEntries].sort((a, b) => b.score - a.score);
        const best = sorted[0];
        if (bestValEl) bestValEl.innerText = best.score;
        if (bestSubEl) bestSubEl.innerText = `Установлен ${best.date}`;
    } else {
        if (bestValEl) bestValEl.innerText = '0';
        if (bestSubEl) bestSubEl.innerText = 'Играй, чтобы установить рекорд';
    }
    const recentEntries = [...modeEntries].sort((a, b) => (b.ts || 0) - (a.ts || 0)).slice(0, 5);
    const attemptsEl = document.getElementById('lb-attempts');
    if (!attemptsEl) return;
    attemptsEl.innerHTML = '';
    if (recentEntries.length === 0) {
        attemptsEl.innerHTML = '<div class="lb-empty-attempts">Пока нет попыток в этом режиме</div>';
        return;
    }
    const bestScore = Math.max(...modeEntries.map(e => e.score));
    let bestShown = false;
    recentEntries.forEach((entry, i) => {
        const isBest = !bestShown && entry.score === bestScore;
        if (isBest) bestShown = true;
        const div = document.createElement('div');
        div.className = 'lb-attempt' + (isBest ? ' best' : '');
        div.innerHTML = `<span class="lb-attempt-rank">${i + 1}.</span><span class="lb-attempt-score">${entry.score}${isBest ? ' <span class="lb-attempt-badge">РЕКОРД</span>' : ''}</span><span class="lb-attempt-date">${entry.date}</span>`;
        attemptsEl.appendChild(div);
    });
}

// ============ SMART DIFFICULTY ============
function trackGameScore(gameScore) {
    if (!Number.isFinite(gameScore) || gameScore < 0) return;
    recentScores.push(Math.floor(gameScore));
    if (recentScores.length > LIMITS.MAX_RECENT_SCORES) recentScores.shift();
    saveRecentScores();
}

function getSmartDifficultyMultiplier() {
    if (recentScores.length < 3) return 1.0;
    const avg = recentScores.reduce((a, b) => a + b, 0) / recentScores.length;
    if (avg < 12) return 0.90;
    if (avg < 18) return 0.95;
    if (avg > 45) return 1.08;
    if (avg > 35) return 1.04;
    return 1.0;
}

// ============ НАСТРОЙКИ ============
function updateSettingsUI() {
    const tMusic = $('toggle-music');
    const tSfx = $('toggle-sfx');
    const tHap = $('toggle-haptics');
    if (tMusic) { tMusic.dataset.on = settings.musicEnabled; tMusic.innerText = settings.musicEnabled ? 'ВКЛ' : 'ВЫКЛ'; }
    if (tSfx) { tSfx.dataset.on = settings.sfxEnabled; tSfx.innerText = settings.sfxEnabled ? 'ВКЛ' : 'ВЫКЛ'; }
    if (tHap) { tHap.dataset.on = settings.hapticsEnabled; tHap.innerText = settings.hapticsEnabled ? 'ВКЛ' : 'ВЫКЛ'; }
    if (muteBtn) muteBtn.innerText = (settings.musicEnabled || settings.sfxEnabled) ? '🔊' : '🔇';
    updateCloudStatusUI();
}

// ============ AUDIO (компрессор, пентатоника, эхо) ============
let audioCtx = null, noiseBuffer = null;
let masterSfxGain = null, sfxDelayNode = null, sfxDelayWet = null;
let musicPlaying = false, musicBeat = 0, musicTempo = 110, musicTimeout = null;

const PENTATONIC_SCALE = [
    523.25, 587.33, 659.25, 783.99, 880.00,
    1046.50, 1174.66, 1318.51, 1567.98, 1760.00,
    2093.00, 2349.32, 2637.02
];

function initAudio() {
    if (!audioCtx) {
        try {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const size = audioCtx.sampleRate * 1.0;
            noiseBuffer = audioCtx.createBuffer(1, size, audioCtx.sampleRate);
            const data = noiseBuffer.getChannelData(0);
            for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;

            const compressor = audioCtx.createDynamicsCompressor();
            compressor.threshold.value = -14;
            compressor.knee.value = 18;
            compressor.ratio.value = 4;
            compressor.attack.value = 0.004;
            compressor.release.value = 0.15;
            compressor.connect(audioCtx.destination);

            masterSfxGain = audioCtx.createGain();
            masterSfxGain.gain.value = 0.9;
            masterSfxGain.connect(compressor);

            sfxDelayNode = audioCtx.createDelay(0.5);
            sfxDelayNode.delayTime.value = 0.16;
            const delayFeedback = audioCtx.createGain();
            delayFeedback.gain.value = 0.28;
            const delayFilter = audioCtx.createBiquadFilter();
            delayFilter.type = 'lowpass';
            delayFilter.frequency.value = 2400;
            sfxDelayWet = audioCtx.createGain();
            sfxDelayWet.gain.value = 0.22;

            sfxDelayNode.connect(delayFilter);
            delayFilter.connect(delayFeedback);
            delayFeedback.connect(sfxDelayNode);
            delayFilter.connect(sfxDelayWet);
            sfxDelayWet.connect(compressor);

            musicGain = audioCtx.createGain();
            musicGain.gain.value = 0.11;
            musicGain.connect(compressor);

            windGain = audioCtx.createGain();
            windGain.gain.value = 0;
            windGain.connect(compressor);
            const windOsc = audioCtx.createBufferSource();
            windOsc.buffer = noiseBuffer;
            windOsc.loop = true;
            const windFilter = audioCtx.createBiquadFilter();
            windFilter.type = 'lowpass';
            windFilter.frequency.value = 380;
            windOsc.connect(windFilter);
            windFilter.connect(windGain);
            windOsc.start();
        } catch (e) {}
    }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
}

function playSound(type, level = 0) {
    if (!settings.sfxEnabled || !audioCtx || audioCtx.state === 'suspended') return;
    try {
        const now = audioCtx.currentTime;
        const dest = masterSfxGain || audioCtx.destination;

        const tone = (freq, endFreq, wave, dur, vol, delay = 0, useEcho = false, cutoff = 2800) => {
            const osc = audioCtx.createOscillator();
            const g = audioCtx.createGain();
            const filter = audioCtx.createBiquadFilter();
            osc.type = wave;
            osc.frequency.setValueAtTime(freq, now + delay);
            if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, now + delay + dur);
            filter.type = 'lowpass';
            filter.frequency.value = cutoff;
            g.gain.setValueAtTime(0.0001, now + delay);
            g.gain.linearRampToValueAtTime(vol, now + delay + 0.012);
            g.gain.exponentialRampToValueAtTime(0.0008, now + delay + dur);
            osc.connect(filter);
            filter.connect(g);
            g.connect(dest);
            if (useEcho && sfxDelayNode) g.connect(sfxDelayNode);
            osc.start(now + delay);
            osc.stop(now + delay + dur + 0.02);
        };

        const noise = (dur, vol, delay = 0, freq = 1000, filterType = 'bandpass') => {
            const src = audioCtx.createBufferSource();
            src.buffer = noiseBuffer;
            const filter = audioCtx.createBiquadFilter();
            const g = audioCtx.createGain();
            filter.type = filterType;
            filter.frequency.value = freq;
            g.gain.setValueAtTime(vol, now + delay);
            g.gain.exponentialRampToValueAtTime(0.001, now + delay + dur);
            src.connect(filter);
            filter.connect(g);
            g.connect(dest);
            src.start(now + delay);
            src.stop(now + delay + dur + 0.02);
        };

        if (type === 'ui_click') {
            tone(480, 680, 'sine', 0.04, 0.06, 0, false, 1800);
        } else if (type === 'buy') {
            tone(987.77, null, 'sine', 0.12, 0.18, 0, true);
            tone(1318.51, null, 'triangle', 0.24, 0.2, 0.07, true);
        } else if (type === 'drop') {
            tone(155, 52, 'sine', 0.13, 0.34, 0, false, 600);
            tone(320, 140, 'triangle', 0.06, 0.12, 0, false, 1400);
            noise(0.055, 0.14, 0, 1600, 'bandpass');
        } else if (type === 'perfect') {
            const idx = Math.min(Math.max(0, level - 1), PENTATONIC_SCALE.length - 1);
            const root = PENTATONIC_SCALE[idx];
            tone(root, null, 'triangle', 0.34, 0.24, 0, true, 4000);
            tone(root * 1.5, null, 'sine', 0.28, 0.11, 0.015, true, 5000);
            tone(root * 0.5, null, 'sine', 0.18, 0.14, 0, false, 900);
        } else if (type === 'record_break') {
            [523.25, 659.25, 783.99, 1046.50, 1318.51, 1567.98].forEach((f, i) => {
                tone(f, null, 'triangle', 0.38, 0.22, i * 0.065, true, 5000);
            });
            tone(2093.00, null, 'sine', 0.55, 0.18, 0.4, true, 6000);
        } else if (type === 'milestone') {
            [392.00, 523.25, 659.25, 783.99].forEach((f, i) => tone(f, null, 'triangle', 0.42, 0.16, i * 0.08, true));
        } else if (type === 'bomb') {
            tone(110, 26, 'sawtooth', 0.45, 0.35, 0, false, 450);
            tone(65, 22, 'sine', 0.5, 0.38, 0, false, 200);
            noise(0.42, 0.38, 0, 650, 'lowpass');
        } else if (type === 'gameover') {
            [329.63, 293.66, 246.94, 196.00].forEach((f, i) => {
                tone(f, f * 0.94, 'triangle', 0.36, 0.18, i * 0.11, true, 1600);
            });
        } else if (type === 'quest') {
            tone(659.25, null, 'sine', 0.18, 0.2, 0, true);
            tone(783.99, null, 'sine', 0.22, 0.2, 0.09, true);
            tone(1046.5, null, 'triangle', 0.38, 0.22, 0.18, true);
        } else if (type === 'fury') {
            tone(220, 880, 'sawtooth', 0.45, 0.16, 0, true, 3200);
            tone(330, 1108, 'triangle', 0.45, 0.14, 0.04, true, 3600);
        } else if (type === 'secret') {
            [523.25, 659.25, 783.99, 1046.5, 1318.51].forEach((f, i) => tone(f, null, 'sine', 0.32, 0.2, i * 0.055, true));
        } else if (type === 'gust') {
            tone(180, 720, 'sine', 0.65, 0.08, 0, false, 1200);
            noise(0.55, 0.2, 0, 900, 'bandpass');
        } else if (type === 'chest') {
            [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, null, 'triangle', 0.36, 0.2, i * 0.09, true));
            tone(1318.51, null, 'sine', 0.55, 0.24, 0.42, true);
        } else if (type === 'victory') {
            [523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98].forEach((f, i) => tone(f, null, 'triangle', 0.48, 0.2, i * 0.085, true));
        } else if (type === 'combo_2x') {
            tone(523.25, null, 'triangle', 0.16, 0.2, 0, true);
            tone(659.25, null, 'triangle', 0.2, 0.2, 0.07, true);
        } else if (type === 'combo_3x') {
            [523.25, 659.25, 783.99].forEach((f, i) => tone(f, null, 'triangle', 0.2, 0.21, i * 0.065, true));
        } else if (type === 'combo_5x') {
            [523.25, 659.25, 783.99, 1046.50].forEach((f, i) => tone(f, null, 'triangle', 0.24, 0.23, i * 0.055, true));
        } else if (type === 'combo_super') {
            [523.25, 659.25, 783.99, 1046.50, 1318.51].forEach((f, i) => tone(f, null, 'triangle', 0.22, 0.24, i * 0.05, true));
        } else if (type === 'combo_ultra') {
            [523.25, 659.25, 783.99, 1046.50, 1318.51, 1567.98].forEach((f, i) => tone(f, null, 'sine', 0.22, 0.25, i * 0.04, true));
            tone(2093, null, 'sine', 0.45, 0.18, 0.24, true);
        } else if (type === 'combo_insane') {
            [523.25, 659.25, 783.99, 1046.50, 1318.51, 1567.98, 2093].forEach((f, i) => tone(f, null, 'triangle', 0.2, 0.26, i * 0.035, true));
            tone(2637, null, 'sine', 0.5, 0.22, 0.25, true);
        } else if (type === 'mission_complete') {
            [523.25, 659.25, 783.99, 1046.50].forEach((f, i) => tone(f, null, 'triangle', 0.22, 0.22, i * 0.075, true));
            tone(1318.51, null, 'sine', 0.4, 0.2, 0.32, true);
        } else if (type === 'prestige_activate') {
            [523.25, 659.25, 783.99, 1046.50, 1318.51, 1567.98, 2093.00].forEach((f, i) => tone(f, null, 'sine', 0.22, 0.24, i * 0.05, true));
            tone(2637, null, 'triangle', 0.75, 0.26, 0.38, true);
        } else if (type === 'event_start') {
            [392.00, 523.25, 659.25, 783.99, 1046.50].forEach((f, i) => tone(f, null, 'triangle', 0.25, 0.2, i * 0.09, true));
        } else if (type === 'event_reward') {
            tone(659.25, null, 'sine', 0.16, 0.22, 0, true);
            tone(783.99, null, 'sine', 0.18, 0.22, 0.09, true);
            tone(1046.50, null, 'triangle', 0.32, 0.22, 0.18, true);
        } else if (type === 'screen_transition') {
            tone(520, 740, 'sine', 0.08, 0.07, 0, false, 1800);
        } else if (type === 'notification') {
            tone(880, null, 'sine', 0.1, 0.18, 0, true);
            tone(1174.66, null, 'sine', 0.16, 0.18, 0.09, true);
        } else if (type === 'unlock') {
            [523.25, 659.25, 783.99, 1046.50, 1318.51].forEach((f, i) => tone(f, null, 'sine', 0.18, 0.2, i * 0.065, true));
        }
    } catch (e) {}
}

function playKick() {
    if (!audioCtx || !settings.musicEnabled) return;
    try {
        const osc = audioCtx.createOscillator(), g = audioCtx.createGain();
        osc.frequency.setValueAtTime(140, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.12);
        g.gain.setValueAtTime(0.25, audioCtx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.12);
        osc.connect(g); g.connect(musicGain); osc.start();
        osc.stop(audioCtx.currentTime + 0.12);
    } catch (e) {}
}

function playHat() {
    if (!audioCtx || !settings.musicEnabled) return;
    try {
        const src = audioCtx.createBufferSource(); src.buffer = noiseBuffer;
        const filter = audioCtx.createBiquadFilter(); filter.type = 'highpass'; filter.frequency.value = 6000;
        const g = audioCtx.createGain();
        g.gain.setValueAtTime(0.06, audioCtx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.04);
        src.connect(filter); filter.connect(g); g.connect(musicGain);
        src.start(); src.stop(audioCtx.currentTime + 0.04);
    } catch (e) {}
}

function playBass() {
    if (!audioCtx || !settings.musicEnabled) return;
    try {
        const osc = audioCtx.createOscillator(), g = audioCtx.createGain();
        osc.type = 'triangle'; osc.frequency.setValueAtTime(65, audioCtx.currentTime);
        g.gain.setValueAtTime(0.15, audioCtx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
        osc.connect(g); g.connect(musicGain); osc.start();
        osc.stop(audioCtx.currentTime + 0.2);
    } catch (e) {}
}

function playLeadNote(idx) {
    if (!audioCtx || !settings.musicEnabled) return;
    try {
        const now = audioCtx.currentTime;
        const osc = audioCtx.createOscillator(), g = audioCtx.createGain();
        osc.type = 'sine'; osc.frequency.setValueAtTime(LEAD_NOTES[idx], now);
        g.gain.setValueAtTime(0.05, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc.connect(g); g.connect(musicGain); osc.start(now); osc.stop(now + 0.35);
    } catch (e) {}
}

function playFuryLead() {
    if (!audioCtx || !settings.musicEnabled) return;
    try {
        const now = audioCtx.currentTime;
        const osc = audioCtx.createOscillator(), g = audioCtx.createGain();
        const filter = audioCtx.createBiquadFilter();
        osc.type = 'sawtooth'; osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(440, now + 0.15);
        filter.type = 'lowpass'; filter.frequency.value = 3000;
        g.gain.setValueAtTime(0.08, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        osc.connect(filter); filter.connect(g); g.connect(musicGain);
        osc.start(now); osc.stop(now + 0.2);
    } catch (e) {}
}

function musicTick() {
    if (!musicPlaying || !settings.musicEnabled || gameState !== GAME_STATES.PLAYING) return;
    currentMusicPhase = getMusicPhase();
    const beat = musicBeat % 8;
    if (currentMusicPhase === 4) {
        if (beat % 2 === 0) playKick();
        if (beat === 1 || beat === 3 || beat === 5 || beat === 7) playHat();
        if (beat === 0 || beat === 4) playBass();
        if (beat === 2 || beat === 6) playFuryLead();
    } else {
        if (beat === 0 || beat === 3 || beat === 4) playKick();
        if (beat === 2 || beat === 6) playHat();
        if (currentMusicPhase >= 2 && (beat === 0 || beat === 4)) playBass();
        if (currentMusicPhase >= 3) {
            if (beat === 1) playLeadNote(0);
            if (beat === 3) playLeadNote(1);
            if (beat === 5) playLeadNote(2);
            if (beat === 7) playLeadNote(3);
        }
    }
    musicBeat++;
    musicTimeout = setTimeout(musicTick, (60000 / musicTempo) / 2);
}

function startMusic() {
    if (musicPlaying || !settings.musicEnabled) return;
    initAudio(); if (!audioCtx) return;
    musicPlaying = true; musicBeat = 0; musicTempo = GAME_CONFIG.MUSIC_BASE_TEMPO;
    musicTick();
}

function stopMusic() {
    musicPlaying = false;
    if (musicTimeout) { clearTimeout(musicTimeout); musicTimeout = null; }
}

// ============ QUESTS ============
function generateNewQuests() {
    const pool = [...QUESTS_POOL]; quests = [];
    for (let i = 0; i < 3; i++) {
        const idx = Math.floor(Math.random() * pool.length);
        const q = pool.splice(idx, 1)[0];
        quests.push({ ...q, current: 0, done: false });
    }
    saveQuests(); renderQuests();
}

function loadQuests() {
    const today = new Date().toDateString();
    const saved = safeGetItem(STORAGE_KEYS.QUESTS, null);
    if (saved && saved.date === today && saved.quests?.length === 3) { quests = saved.quests; renderQuests(); }
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
            q.done = true;
            addCoins(q.reward);
            playSound('quest');
            showPopup(bonusText, `🎁 ЗАДАНИЕ +${q.reward} 🪙`, 1500);
            triggerHaptic('success');
        }
    });
    if (changed) { saveQuests(); renderQuests(); }
    if (quests.every(q => q.done) && !newQuestsTimeout) {
        newQuestsTimeout = setTimeout(() => {
            newQuestsTimeout = null; generateNewQuests();
            showPopup(bonusText, '🌟 НОВЫЕ ЗАДАНИЯ!', 1500);
            playSound('quest'); triggerHaptic('success');
        }, 1500);
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
    const coinsText = `🪙 ${coins}`;
    updateDOMText(menuCoinsEl, coinsText);
    updateDOMText(gameCoinsEl, `🪙 ${gameState === GAME_STATES.PLAYING ? sessionCoins : coins}`);
    updateRerollMissionsBtn();
}

// ============ ВКЛАДКИ МЕНЮ, МАГАЗИН, АПГРЕЙДЫ И КОЛЕСО ============
function switchMenuTab(tabName) {
    currentMenuTab = tabName;
    document.querySelectorAll('.nav-tab-btn').forEach(btn => {
        const isActive = btn.dataset.menuTab === tabName;
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-selected', String(isActive));
    });
    document.querySelectorAll('.tab-pane').forEach(pane => {
        pane.classList.toggle('active', pane.id === `tab-${tabName}`);
    });

    const viewport = $('tab-viewport');
    if (viewport) viewport.scrollTop = 0;

    if (tabName === 'shop') {
        renderShop();
        switchShopTab(currentShopTab);
    } else if (tabName === 'tasks') {
        renderMissions();
        updateChestUI();
        updateWheelUI();
    } else if (tabName === 'profile') {
        updateLevelUI();
        updatePrestigeUI();
    }
    updateTelegramBackButton();
}

function getEffectIcon(effect) {
    const icons = { holographic: '🌈', fire: '🔥', ice: '❄️', neon: '💡', stars: '✨' };
    return icons[effect] || '';
}

function formatSkinModifiers(modifiers) {
    if (!modifiers) return '';
    const chips = [];
    if (modifiers.coinMult && modifiers.coinMult !== 1) {
        chips.push(`<span class="skin-mod-chip">🪙 +${Math.round((modifiers.coinMult - 1) * 100)}% монет</span>`);
    }
    if (modifiers.scoreMult && modifiers.scoreMult !== 1) {
        chips.push(`<span class="skin-mod-chip">🏆 +${Math.round((modifiers.scoreMult - 1) * 100)}% очков</span>`);
    }
    if (modifiers.xpMult && modifiers.xpMult !== 1) {
        chips.push(`<span class="skin-mod-chip">✨ +${Math.round((modifiers.xpMult - 1) * 100)}% опыта</span>`);
    }
    if (modifiers.speedMult && modifiers.speedMult !== 1) {
        const pct = Math.round((modifiers.speedMult - 1) * 100);
        const isFaster = pct > 0;
        chips.push(`<span class="skin-mod-chip${isFaster ? ' warn' : ''}">${isFaster ? '⚡' : '🐢'} ${isFaster ? '+' : ''}${pct}% скорость</span>`);
    }
    if (modifiers.fireChance) {
        chips.push(`<span class="skin-mod-chip warn">🔥 ${Math.round(modifiers.fireChance * 100)}% поджог</span>`);
    }
    return chips.length ? `<div class="skin-mods">${chips.join('')}</div>` : '';
}

function getSecondChanceCost() {
    const { secondChanceDiscount } = getUpgradeBonuses();
    return Math.max(10, Math.round(GAME_CONFIG.SECOND_CHANCE_COST * (1 - secondChanceDiscount)));
}

function renderUpgrades() {
    if (!upgradesListEl) return;
    upgradesListEl.innerHTML = '';
    UPGRADES.forEach(u => {
        const lvl = getUpgradeLevel(u.id);
        const isMax = lvl >= MAX_UPGRADE_LEVEL;
        const price = getUpgradePrice(u);
        const canBuy = !isMax && coins >= price;

        const pips = Array.from({ length: MAX_UPGRADE_LEVEL }, (_, i) =>
            `<span class="upgrade-pip${i < lvl ? ' filled' : ''}"></span>`
        ).join('');

        let btnHtml = '';
        if (isMax) btnHtml = `<button class="upgrade-buy-btn maxed" disabled>MAX</button>`;
        else if (canBuy) btnHtml = `<button class="upgrade-buy-btn" data-upgrade-id="${u.id}">${price} 🪙</button>`;
        else btnHtml = `<button class="upgrade-buy-btn locked" disabled>${price} 🪙</button>`;

        const div = document.createElement('div');
        div.className = 'upgrade-item' + (isMax ? ' maxed' : '');
        div.innerHTML = `
            <div class="upgrade-icon">${u.icon}</div>
            <div class="upgrade-info">
                <div class="upgrade-head">
                    <span class="upgrade-name">${u.name}</span>
                    ${lvl > 0 ? `<span class="upgrade-bonus">${u.formatBonus(lvl)}</span>` : ''}
                </div>
                <span class="upgrade-desc">${u.desc}</span>
                <div class="upgrade-pips">${pips}</div>
            </div>
            ${btnHtml}
        `;
        upgradesListEl.appendChild(div);
    });

    upgradesListEl.querySelectorAll('button.upgrade-buy-btn[data-upgrade-id]').forEach(btn => {
        safeClick(btn, () => {
            const res = buyUpgrade(btn.dataset.upgradeId, coins);
            if (res.success) {
                coins -= res.price;
                safeSetItem(STORAGE_KEYS.COINS, coins);
                stats.upgradesBought = (stats.upgradesBought || 0) + 1;
                saveStats();
                scheduleCloudSave();
                updateCoinUI();
                renderUpgrades();
                switchShopTab('upgrades');
                playSound('buy');
                triggerHaptic('success');
                showPopup(bonusText, `${res.upgrade.icon} ${res.upgrade.name} ур. ${res.newLevel}!`, 1200);
                checkAchievements();
            } else {
                triggerHaptic('error');
            }
        });
    });
}

function updateWheelUI() {
    const ready = canSpinWheel();
    if (wheelBannerDescEl) {
        wheelBannerDescEl.textContent = ready
            ? 'Бесплатный спин доступен!'
            : `Следующий спин через ${getTimeUntilNextSpin()}`;
    }
    if (wheelBannerDotEl) wheelBannerDotEl.classList.toggle('hidden', !ready);
    if (wheelStatusEl) {
        wheelStatusEl.textContent = ready
            ? '✨ Крути бесплатно и забирай приз!'
            : `⏳ Следующий спин через: ${getTimeUntilNextSpin()}`;
    }
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
                    const keys = Object.keys(POWERUP_DEFS);
                    const pk = keys[Math.floor(Math.random() * keys.length)];
                    ownedPowerups[pk] = (ownedPowerups[pk] || 0) + seg.value;
                    savePowerups();
                    if (wheelResultEl) wheelResultEl.textContent = `Выигрыш: ${POWERUP_DEFS[pk].icon} ${POWERUP_DEFS[pk].name}!`;
                } else if (seg.type === 'chest') {
                    addChest('wheel', { rare: Boolean(seg.rare) });
                    if (wheelResultEl) wheelResultEl.textContent = seg.rare ? '✨ Выигрыш: РЕДКИЙ СУНДУК!' : '📦 Выигрыш: СУНДУК!';
                }
                stats.wheelSpins = (stats.wheelSpins || 0) + 1;
                saveStats();
                playSound(seg.jackpot || seg.rare ? 'victory' : 'chest');
                triggerHaptic('success');
                updateWheelUI();
                checkAchievements();
            },
        });
    } else {
        wheelController.draw();
    }
    updateWheelUI();
    showModal(wheelScreen);
    if (wheelTimerInterval) clearInterval(wheelTimerInterval);
    wheelTimerInterval = setInterval(updateWheelUI, 1000);
}

function closeWheelModal() {
    if (wheelTimerInterval) { clearInterval(wheelTimerInterval); wheelTimerInterval = null; }
    hideModal(wheelScreen);
}

function renderShop() {
    if (!skinListEl) return;
    skinListEl.innerHTML = '';
    const buyableCount = Object.keys(SKINS).filter(k => !SKINS[k].notBuyable).length;
    const unlockedBuyable = unlockedSkins.filter(k => !SKINS[k] || !SKINS[k].notBuyable).length;
    if (shopProgressEl) shopProgressEl.innerText = `Открыто: ${unlockedBuyable}/${buyableCount}${unlockedSkins.includes('legend') ? ' + 👑 Легенда' : ''}`;
    for (const [key, skin] of Object.entries(SKINS)) {
        if (key === 'legend' && !unlockedSkins.includes('legend')) continue;
        if ((skin.prestigeOnly || skin.eventOnly) && !unlockedSkins.includes(key)) continue;
        const isUnlocked = unlockedSkins.includes(key);
        const isEquipped = currentSkin === key;
        const canBuy = coins >= skin.price && !skin.notBuyable;
        const div = document.createElement('div');
        div.className = 'skin-item';
        let btnHtml = '';
        if (isEquipped) btnHtml = `<button class="equipped">ВЫБРАНО</button>`;
        else if (isUnlocked) btnHtml = `<button class="equip" data-skin="${key}">ВЫБРАТЬ</button>`;
        else if (skin.notBuyable) btnHtml = `<button class="buy locked" disabled>🏆</button>`;
        else if (canBuy) btnHtml = `<button class="buy" data-skin="${key}" data-price="${skin.price}">${skin.price} 🪙</button>`;
        else btnHtml = `<button class="buy locked" disabled>${skin.price} 🪙</button>`;
        const colorDots = skin.colors.slice(0, 5).map(c => `<span style="background:${c}"></span>`).join('');
        const effectBadge = skin.effect ? `<span class="skin-effect-badge">${getEffectIcon(skin.effect)}</span>` : '';
        const modsHtml = formatSkinModifiers(skin.modifiers);
        div.innerHTML = `<div class="skin-info"><span class="skin-preview ${skin.effect || ''}" style="background:linear-gradient(135deg,${skin.colors[0]},${skin.colors[1] || skin.colors[0]});border-radius:8px;padding:4px;position:relative;">${effectBadge}</span><div class="skin-details"><span class="skin-name">${skin.name}</span>${modsHtml}<div class="skin-colors">${colorDots}</div></div></div>${btnHtml}`;
        skinListEl.appendChild(div);
    }
    skinListEl.querySelectorAll('button.equip').forEach(btn => {
        safeClick(btn, () => {
            currentSkin = btn.dataset.skin;
            safeSetItem(STORAGE_KEYS.SKIN, currentSkin);
            scheduleCloudSave();
            applySkinEffect();
            renderShop();
        });
    });
    skinListEl.querySelectorAll('button.buy').forEach(btn => {
        if (btn.disabled) return;
        safeClick(btn, () => {
            const price = parseInt(btn.dataset.price);
            if (coins >= price) {
                coins -= price; safeSetItem(STORAGE_KEYS.COINS, coins);
                const skin = btn.dataset.skin;
                unlockedSkins.push(skin); safeSetItem(STORAGE_KEYS.SKINS, unlockedSkins);
                currentSkin = skin; safeSetItem(STORAGE_KEYS.SKIN, currentSkin);
                scheduleCloudSave();
                applySkinEffect();
                updateCoinUI(); renderShop(); playSound('buy'); triggerHaptic('success');
                checkAchievements();
            } else { triggerHaptic('error'); }
        });
    });
    renderUpgrades();
    renderCustomize('colors');
    renderCustomize('backgrounds');
}

function applySkinEffect() {
    document.body.classList.remove('skin-fire-active', 'skin-ice-active', 'skin-neon-active', 'skin-galaxy-active', 'skin-holographic-active');
    const skin = SKINS[currentSkin];
    if (!skin || !skin.effect) return;
    document.body.classList.add(`skin-${skin.effect}-active`);
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
        const isUnlocked = unlocked.includes(key);
        const isEquipped = current === key;
        const canBuy = coins >= item.price;
        const div = document.createElement('div');
        div.className = 'customize-item';
        let previewHtml = '';
        if (type === 'colors') {
            previewHtml = `<div class="customize-colors">${item.colors.slice(0, 5).map(c => `<span style="background:${c}"></span>`).join('')}</div>`;
        } else {
            previewHtml = `<div class="customize-preview" style="background:linear-gradient(135deg, ${item.colors[0]} 0%, ${item.colors[2] || item.colors[1]} 100%);">${item.stars ? '⭐' : '🌅'}</div>`;
        }
        let btnHtml = '';
        if (isEquipped) btnHtml = `<button class="equipped">✓</button>`;
        else if (isUnlocked) btnHtml = `<button class="equip" data-key="${key}">ВЫБРАТЬ</button>`;
        else if (canBuy) btnHtml = `<button class="buy" data-key="${key}" data-price="${item.price}">${item.price} 🪙</button>`;
        else btnHtml = `<button class="buy locked" disabled>${item.price} 🪙</button>`;
        const statusText = isEquipped ? 'Активно' : isUnlocked ? 'Открыто' : 'Не куплено';
        const statusClass = isEquipped ? 'customize-status active' : 'customize-status';
        div.innerHTML = `${previewHtml}<div class="customize-info"><span class="customize-name">${item.name}</span><span class="${statusClass}">${statusText}</span></div>${btnHtml}`;
        listEl.appendChild(div);
    }
    listEl.querySelectorAll('button.equip').forEach(btn => {
        safeClick(btn, () => {
            safeSetItem(currentKey, btn.dataset.key);
            scheduleCloudSave();
            if (type === 'colors') currentPalette = btn.dataset.key;
            else { currentBackground = btn.dataset.key; applyBackground(); }
            renderCustomize(type);
        });
    });
    listEl.querySelectorAll('button.buy').forEach(btn => {
        if (btn.disabled) return;
        safeClick(btn, () => {
            const price = parseInt(btn.dataset.price);
            if (coins >= price) {
                coins -= price; safeSetItem(STORAGE_KEYS.COINS, coins);
                unlocked.push(btn.dataset.key); safeSetItem(saveKey, unlocked);
                safeSetItem(currentKey, btn.dataset.key);
                scheduleCloudSave();
                if (type === 'colors') currentPalette = btn.dataset.key;
                else { currentBackground = btn.dataset.key; applyBackground(); }
                updateCoinUI(); renderCustomize(type); playSound('buy'); triggerHaptic('success');
            } else { triggerHaptic('error'); }
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
        const buyableCount = Object.keys(SKINS).filter(k => !SKINS[k].notBuyable).length;
        const unlockedBuyable = unlockedSkins.filter(k => !SKINS[k] || !SKINS[k].notBuyable).length;
        shopProgressEl.innerText = `Открыто: ${unlockedBuyable}/${buyableCount}`;
    } else if (tab === 'upgrades') {
        const prog = getUpgradesProgress();
        shopProgressEl.innerText = `Улучшено: ${prog.current}/${prog.total}`;
    } else if (tab === 'colors') {
        shopProgressEl.innerText = `Открыто палитр: ${unlockedPalettes.length}/${Object.keys(PALETTES).length}`;
    } else {
        shopProgressEl.innerText = `Открыто фонов: ${unlockedBackgrounds.length}/${Object.keys(BACKGROUNDS).length}`;
    }
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
        if (lowPerfMode) {
            removeEnvironmentParticles(scene);
        } else {
            const particleType = getParticlesForBackground(currentBackground);
            createEnvironmentParticles(scene, particleType, { density: IS_MOBILE ? 0.45 : 0.85 });
        }
    }
}

function createStars() {
    const geo = new THREE.BufferGeometry();
    const positions = [];
    for (let i = 0; i < 300; i++) positions.push((Math.random() - 0.5) * 200, Math.random() * 150, (Math.random() - 0.5) * 200);
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.6, transparent: true, opacity: 0.9 });
    bgStarsGroup = new THREE.Points(geo, mat);
    bgStarsGroup.userData.isStars = true;
    scene.add(bgStarsGroup);
}

// ============ POWERUPS ============
function showPowerupSelection(mode) {
    pendingGameMode = mode;
    activePowerups = { ...DEFAULTS.ACTIVE_POWERUPS };
    startScreen.style.display = 'none';
    showModal(powerupsScreen);
    renderPowerupList();
}

function renderPowerupList() {
    const list = $('powerup-list');
    if (!list) return;
    list.innerHTML = '';
    for (const [key, def] of Object.entries(POWERUP_DEFS)) {
        const owned = ownedPowerups[key] || 0;
        const canBuy = coins >= def.price;
        const isActive = activePowerups[key];
        const item = document.createElement('div');
        item.className = 'powerup-item';
        if (isActive) item.classList.add('active');
        if (!isActive && owned === 0 && !canBuy) item.classList.add('disabled');
        let actionHtml = '';
        if (isActive) actionHtml = '<span class="pw-active">✓ АКТИВНО</span>';
        else if (owned > 0) actionHtml = `<span class="pw-count">x${owned}</span>`;
        else actionHtml = `<span class="pw-price">${def.price} 🪙</span>`;
        item.innerHTML = `<span class="pw-icon">${def.icon}</span><div class="pw-info"><span class="pw-name">${def.name}</span><span class="pw-desc">${def.desc}</span></div>${actionHtml}`;
        safeClick(item, () => {
            if (isActive) activePowerups[key] = false;
            else if (owned > 0) activePowerups[key] = true;
            else if (canBuy) {
                coins -= def.price; safeSetItem(STORAGE_KEYS.COINS, coins);
                ownedPowerups[key] = 1; savePowerups();
                activePowerups[key] = true; updateCoinUI(); playSound('buy');
            } else { triggerHaptic('error'); return; }
            renderPowerupList();
        });
        list.appendChild(item);
    }
}

function startGameWithPowerups() {
    for (const key in activePowerups) {
        if (activePowerups[key]) ownedPowerups[key] = Math.max(0, (ownedPowerups[key] || 0) - 1);
    }
    savePowerups();
    lastUsedPowerups = { ...activePowerups };
    hideModal(powerupsScreen, { restoreMenu: false });
    const mode = pendingGameMode;
    pendingGameMode = null;
    startGame(mode);
}

function getPowerupReplayInfo() {
    const keys = Object.keys(lastUsedPowerups).filter(k => lastUsedPowerups[k] && POWERUP_DEFS[k]);
    if (keys.length === 0) return null;
    let totalCost = 0;
    const icons = [];
    keys.forEach(k => {
        icons.push(POWERUP_DEFS[k].icon);
        if ((ownedPowerups[k] || 0) <= 0) totalCost += POWERUP_DEFS[k].price;
    });
    return { keys, icons: icons.join(''), totalCost, canAfford: coins >= totalCost };
}

function updatePowerupReplayButton() {
    if (!restartPowerupsBtn) return;
    const supportsPowerups = (gameMode === GAME_MODES.CLASSIC || gameMode === GAME_MODES.TIME);
    const info = supportsPowerups ? getPowerupReplayInfo() : null;
    if (!info) {
        restartPowerupsBtn.style.display = 'none';
        return;
    }
    restartPowerupsBtn.style.display = 'block';
    restartPowerupsBtn.disabled = !info.canAfford;
    restartPowerupsBtn.textContent = info.totalCost > 0
        ? `⚡ ЗАНОВО ${info.icons} (${info.totalCost} 🪙)`
        : `⚡ ЗАНОВО С ${info.icons} (ИЗ ЗАПАСА)`;
}

function restartWithSamePowerups() {
    const info = getPowerupReplayInfo();
    if (!info || !info.canAfford) { triggerHaptic('error'); return; }
    if (info.totalCost > 0) {
        coins -= info.totalCost;
        safeSetItem(STORAGE_KEYS.COINS, coins);
        playSound('buy');
    }
    info.keys.forEach(k => {
        if ((ownedPowerups[k] || 0) > 0) ownedPowerups[k]--;
    });
    savePowerups();
    updateCoinUI();
    activePowerups = { ...lastUsedPowerups };
    hideModal(gameOverEl, { restoreMenu: false });
    startGame(gameMode);
}

function updateActivePowerupsUI() {
    if (!activePowerupsEl) return;
    activePowerupsEl.innerHTML = '';
    for (const [key, isActive] of Object.entries(activePowerups)) {
        if (isActive && POWERUP_DEFS[key]) {
            const badge = document.createElement('div');
            badge.className = 'pu-active-badge';
            badge.innerText = POWERUP_DEFS[key].icon;
            activePowerupsEl.appendChild(badge);
        }
    }
}

// ============ CHESTS ============
function addChest(type, meta = {}) {
    const isRare = Boolean(meta.rare) || Math.random() < 0.1;
    chests.push({ type, isRare, ...meta, id: Date.now() + Math.random() });
    saveChests(); updateChestUI();
    if (isRare) { showPopup(bonusText, '✨ РЕДКИЙ СУНДУК!', 2200); triggerHaptic('success'); }
    else showPopup(bonusText, '📦 НОВЫЙ СУНДУК!', 1500);
    playSound('quest');
}

function updateChestUI() {
    const count = chests.length;
    const hasRare = chests.some(c => c.isRare);
    const container = $('chest-btn-container');
    const badge = $('chest-count-badge');
    if (container && badge) {
        if (count > 0) {
            container.style.display = 'block';
            badge.innerText = count;
            if (hasRare) badge.classList.add('rare'); else badge.classList.remove('rare');
        } else container.style.display = 'none';
    }
    updateMissionsBadge();
}

function rollChestReward(isRare = false) {
    const mult = isRare ? 3 : 1;
    const r = Math.random();
    const lockedSkins = Object.keys(SKINS).filter(s => !unlockedSkins.includes(s) && !SKINS[s].notBuyable);
    if (lockedSkins.length === 0 || r < 0.55) {
        const amounts = [50, 80, 100, 150, 200];
        const amount = amounts[Math.floor(Math.random() * amounts.length)] * mult;
        return { type: 'coins', amount, text: `+${amount} 🪙${isRare ? ' ✨' : ''}` };
    } else if (r < 0.85) {
        const puKeys = Object.keys(POWERUP_DEFS);
        const pu = puKeys[Math.floor(Math.random() * puKeys.length)];
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
    const hasRare = chests[0].isRare;
    $('chest-sub').innerText = hasRare ? '✨ РЕДКИЙ СУНДУК! x3 награда!' : `Осталось сундуков: ${chests.length}`;
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
        else if (reward.type === 'powerup') {
            ownedPowerups[reward.powerup] = (ownedPowerups[reward.powerup] || 0) + reward.count;
            savePowerups();
        } else if (reward.type === 'skin') {
            unlockedSkins.push(reward.skin);
            safeSetItem(STORAGE_KEYS.SKINS, unlockedSkins);
            scheduleCloudSave();
            checkAchievements();
        }
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
    if (coins < cost) {
        triggerHaptic('error');
        return;
    }
    missions.forEach(m => {
        if (m.completed && !m.claimed) {
            claimMissionReward(m.id, missions, addCoins, addXP, (type, meta) => addChest(type, meta));
            stats.missionsCompleted = (stats.missionsCompleted || 0) + 1;
        }
    });
    saveStats();

    coins -= cost;
    safeSetItem(STORAGE_KEYS.COINS, coins);
    scheduleCloudSave();

    missions = rerollDailyMissions(missions);
    renderMissions();
    updateMissionsBadge();
    updateCoinUI();
    playSound('buy');
    triggerHaptic('success');
    showPopup(bonusText, '🔄 НОВЫЕ МИССИИ ДНЯ!', 1200);
    checkAchievements();
}

function renderMissions() {
    if (!missionsListEl) return;
    missionsListEl.innerHTML = '';
    missions.forEach((mission, index) => {
        const progress = getMissionProgress(mission);
        const isCompleted = mission.completed;
        const isClaimed = mission.claimed;
        const item = document.createElement('div');
        item.className = 'mission-item';
        if (isCompleted && !isClaimed) item.classList.add('completed');
        if (isClaimed) item.classList.add('claimed');
        if (index < 3) { item.classList.add('new'); item.style.animationDelay = `${index * 0.08}s`; }
        let actionHtml = '';
        if (isClaimed) actionHtml = '<span class="mission-claimed-badge">✓ Получено</span>';
        else if (isCompleted) actionHtml = `<button class="mission-claim-btn" data-mission-id="${mission.id}">ЗАБРАТЬ</button>`;
        item.innerHTML = `<div class="mission-icon">${mission.icon}</div><div class="mission-info"><span class="mission-text">${mission.text}</span><div class="mission-progress-bar"><div class="mission-progress-fill" style="width: ${progress}%"></div></div><span class="mission-progress-text">${mission.current} / ${mission.target}</span></div><div class="mission-reward"><span class="mission-reward-text">${formatMissionReward(mission.reward)}</span>${actionHtml}</div>`;
        missionsListEl.appendChild(item);
    });
    missionsListEl.querySelectorAll('.mission-claim-btn').forEach(btn => {
        safeClick(btn, () => {
            const missionId = btn.dataset.missionId;
            const result = claimMissionReward(missionId, missions, addCoins, addXP, (type, meta) => addChest(type, meta));
            if (result.success) {
                const item = btn.closest('.mission-item');
                item.classList.add('just-completed');
                item.classList.remove('completed');
                item.classList.add('claimed');
                stats.missionsCompleted = (stats.missionsCompleted || 0) + 1;
                saveStats();
                setTimeout(() => { renderMissions(); updateMissionsBadge(); updateCoinUI(); }, 600);
                playSound('mission_complete');
                triggerHaptic('success');
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
    const mStats = getMissionsStats(missions);
    const totalPending = mStats.available + chests.length + (canSpinWheel() ? 1 : 0);
    if (totalPending > 0) {
        missionsBadgeEl.textContent = totalPending;
        missionsBadgeEl.classList.remove('hidden');
    } else missionsBadgeEl.classList.add('hidden');
}

function startMissionsTimer() {
    if (missionsTimerInterval) clearInterval(missionsTimerInterval);
    function updateTimer() {
        if (!missionsTimerEl) return;
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        const diff = tomorrow - now;
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        missionsTimerEl.textContent = `Обновление через: ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
    updateTimer();
    missionsTimerInterval = setInterval(updateTimer, 1000);
}

function stopMissionsTimer() {
    if (missionsTimerInterval) { clearInterval(missionsTimerInterval); missionsTimerInterval = null; }
}

// ============ ПРЕСТИЖ ============
function updatePrestigeUI() {
    const prestigeCount = getPrestigeCount();
    const bonus = getPrestigeBonus();
    const progress = getPrestigeProgress(level);
    const available = canPrestige(level);
    if (prestigeSectionEl) prestigeSectionEl.style.display = level >= 50 || prestigeCount > 0 ? 'block' : 'none';
    if (prestigeProfileBadgeEl && prestigeCountBadgeEl) {
        if (prestigeCount > 0) { prestigeProfileBadgeEl.style.display = 'inline-flex'; prestigeCountBadgeEl.textContent = prestigeCount; }
        else prestigeProfileBadgeEl.style.display = 'none';
    }
    if (prestigeCountDisplayEl) prestigeCountDisplayEl.textContent = prestigeCount;
    if (prestigeBonusTextEl) {
        const bonusText = formatPrestigeBonus(bonus);
        prestigeBonusTextEl.textContent = bonusText ? `Бонусы: ${bonusText}` : 'Бонусы: —';
    }
    if (prestigeProgressFillEl) prestigeProgressFillEl.style.width = `${progress}%`;
    if (prestigeProgressTextEl) {
        if (available) { prestigeProgressTextEl.textContent = '⭐ ГОТОВ К ПРЕСТИЖУ!'; prestigeProgressTextEl.style.color = 'var(--orange)'; }
        else { prestigeProgressTextEl.textContent = `${level} / ${PRESTIGE_CONFIG.REQUIRED_LEVEL} уровня`; prestigeProgressTextEl.style.color = ''; }
    }
    if (prestigeActivateBtnEl) {
        if (available) { prestigeActivateBtnEl.disabled = false; prestigeActivateBtnEl.textContent = '⭐ АКТИВИРОВАТЬ ПРЕСТИЖ'; }
        else { prestigeActivateBtnEl.disabled = true; prestigeActivateBtnEl.textContent = `🔒 ДОСТУПНО С ${PRESTIGE_CONFIG.REQUIRED_LEVEL} УРОВНЯ`; }
    }
}

function showPrestigeConfirm() {
    if (!canPrestige(level)) return;
    const currentCount = getPrestigeCount();
    const newCount = currentCount + 1;
    const coinsReward = PRESTIGE_CONFIG.BASE_COINS_REWARD * newCount;
    const chestsReward = PRESTIGE_CONFIG.BASE_CHESTS_REWARD + Math.floor(newCount / 2);
    const newBonusText = `+${Math.round(PRESTIGE_CONFIG.BONUS_PER_PRESTIGE.coinMult * 100)}% 🪙, +${Math.round(PRESTIGE_CONFIG.BONUS_PER_PRESTIGE.xpMult * 100)}% ⭐, +${Math.round(PRESTIGE_CONFIG.BONUS_PER_PRESTIGE.scoreMult * 100)}% 🏗️`;
    if (prestigeCoinsPreviewEl) prestigeCoinsPreviewEl.textContent = `+${coinsReward} монет`;
    if (prestigeChestsPreviewEl) prestigeChestsPreviewEl.textContent = `+${chestsReward} престиж-сундуков`;
    if (prestigeBonusPreviewEl) prestigeBonusPreviewEl.textContent = newBonusText;
    showModal(prestigeConfirmScreen);
}

function activatePrestige() {
    const result = performPrestige();
    if (!result.success) return;
    addCoins(result.coinsReward);
    pendingPrestigeRewards = [];
    for (let i = 0; i < result.chestsReward; i++) pendingPrestigeRewards.push(rollPrestigeChestReward());
    resetProgressForPrestige();
    level = 1; xpTotal = 0; highScore = 0; bestHeight = 0; totalScoreAllTime = 0; recentScores = [];
    safeSetItem('towerBestHeight', '0');
    stats.maxScore = 0; stats.maxCombo = 0; stats.maxTimeScore = 0;
    saveLevelProgress(); saveStats(); saveTotalScore(); saveRecentScores();
    flushCloudSave();
    updateLevelUI(); updatePrestigeUI();
    if (highScoreEl) highScoreEl.innerText = `РЕКОРД: ${highScore}`;
    hideModal(prestigeConfirmScreen, { restoreMenu: false });
    playSound('prestige_activate');
    triggerHaptic('success');
    flashTransition('rgba(255, 215, 0, 0.7)', 500);
    setTimeout(() => showPrestigeChestOpening(), 800);
}

function showPrestigeChestOpening() {
    if (pendingPrestigeRewards.length === 0) {
        hideModal(prestigeChestScreen);
        startScreen.style.display = 'flex';
        updateCoinUI();
        return;
    }
    startScreen.style.display = 'none';
    showModal(prestigeChestScreen);
    if (prestigeChestIconEl) {
        prestigeChestIconEl.textContent = '🎁';
        prestigeChestIconEl.style.animation = 'prestigeChestFloat 3s ease-in-out infinite';
    }
    if (prestigeRewardTextEl) { prestigeRewardTextEl.textContent = ''; prestigeRewardTextEl.className = 'prestige-reward-text'; }
    if (openPrestigeChestBtn) openPrestigeChestBtn.style.display = 'block';
    if (closePrestigeChestBtn) closePrestigeChestBtn.style.display = 'none';
    const remaining = pendingPrestigeRewards.length;
    const subEl = document.getElementById('prestige-chest-sub');
    if (subEl) subEl.textContent = remaining === 1 ? 'Последний сундук!' : `Осталось сундуков: ${remaining}`;
}

function openPrestigeChest() {
    if (pendingPrestigeRewards.length === 0) return;
    const reward = pendingPrestigeRewards.shift();
    if (prestigeChestIconEl) prestigeChestIconEl.style.animation = 'chestOpenBurst 1s forwards';
    if (openPrestigeChestBtn) openPrestigeChestBtn.style.display = 'none';
    setTimeout(() => {
        applyPrestigeReward(reward, {
            addCoins: (amount) => addCoins(amount),
            addPowerup: (pu, count) => { ownedPowerups[pu] = (ownedPowerups[pu] || 0) + count; savePowerups(); },
            addSkin: (skinId) => { if (!unlockedSkins.includes(skinId)) { unlockedSkins.push(skinId); safeSetItem(STORAGE_KEYS.SKINS, unlockedSkins); scheduleCloudSave(); } },
            addChest: (type, meta) => addChest(type, meta),
            addPermanentBuff: (effect, value) => {
                const bonus = getPrestigeBonus();
                if (effect === 'coin_boost') bonus.coinMult += value;
                else if (effect === 'xp_boost') bonus.xpMult += value;
                else if (effect === 'all_boost') bonus.allMult += value;
                setPrestigeBonus(bonus);
                scheduleCloudSave();
            },
        });
        if (prestigeChestIconEl) {
            prestigeChestIconEl.textContent = reward.legendary ? '✨' : '🎁';
            prestigeChestIconEl.style.animation = '';
        }
        if (prestigeRewardTextEl) {
            prestigeRewardTextEl.textContent = reward.text;
            prestigeRewardTextEl.className = 'prestige-reward-text' + (reward.legendary ? ' legendary' : '');
        }
        playSound(reward.legendary ? 'victory' : 'chest');
        triggerHaptic('success');
        if (pendingPrestigeRewards.length > 0) {
            if (openPrestigeChestBtn) { openPrestigeChestBtn.textContent = 'ОТКРЫТЬ ЕЩЁ'; openPrestigeChestBtn.style.display = 'block'; }
        } else if (closePrestigeChestBtn) closePrestigeChestBtn.style.display = 'block';
        updateCoinUI(); updatePrestigeUI();
    }, 1000);
}

function handleLevelMilestones(oldLevel, newLevel) {
    const newMilestones = checkNewMilestones(oldLevel, newLevel);
    newMilestones.forEach((milestoneLevel, index) => {
        setTimeout(() => {
            showMilestoneNotification(milestoneLevel);
            addChest('milestone', { level: milestoneLevel, rare: true });
            playSound('chest');
            triggerHaptic('success');
        }, index * 1500);
    });
}

function showMilestoneNotification(milestoneLevel) {
    const notification = document.createElement('div');
    notification.className = 'milestone-notification';
    notification.innerHTML = `<div class="milestone-notification-icon">📦</div><div class="milestone-notification-title">УРОВЕНЬ ${milestoneLevel}!</div><div class="milestone-notification-desc">Ты получил редкий сундук!</div>`;
    document.body.appendChild(notification);
    requestAnimationFrame(() => notification.classList.add('show'));
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 500);
    }, 2500);
}

// ============ СОБЫТИЯ ============
function initEvents() {
    if (!isEventsSystemActive()) {
        console.log('[Events] System not yet active (starts 1.11.2026)');
        return;
    }
    currentEvent = getCurrentEvent();
    renderEventBanner();
    if (eventNotificationInterval) clearInterval(eventNotificationInterval);
    eventNotificationInterval = setInterval(() => {
        const newEvent = getCurrentEvent();
        if (newEvent?.id !== currentEvent?.id) {
            currentEvent = newEvent;
            renderEventBanner();
            if (newEvent) showEventNotification(newEvent);
        } else {
            renderEventBanner();
        }
    }, 5 * 60 * 1000);
}

function renderEventBanner() {
    if (!eventBannerEl) return;
    if (!currentEvent) { eventBannerEl.style.display = 'none'; return; }
    eventBannerEl.style.display = 'block';
    eventBannerEl.style.setProperty('--event-color', currentEvent.color);
    eventBannerEl.style.setProperty('--event-color-dark', shadeEventColor(currentEvent.color, -30));
    if (currentEvent.isHoliday) eventBannerEl.classList.add('holiday');
    else eventBannerEl.classList.remove('holiday');
    if (eventIconEl) eventIconEl.textContent = currentEvent.icon;
    if (eventLabelEl) eventLabelEl.textContent = currentEvent.isHoliday ? 'ПРАЗДНИК' : 'СЕЗОН';
    if (eventNameEl) eventNameEl.textContent = currentEvent.name;
    if (eventDescEl) eventDescEl.textContent = currentEvent.description;
    const progress = getEventProgress(currentEvent);
    const evStats = getEventStats(currentEvent);
    if (eventBadgeEl) {
        eventBadgeEl.textContent = `${evStats.claimed}/${evStats.total}`;
        if (currentEvent.isHoliday) eventBadgeEl.classList.add('holiday-badge');
        else eventBadgeEl.classList.remove('holiday-badge');
    }
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
    const rewards = getAvailableRewards(currentEvent);
    rewards.forEach((reward) => {
        const item = document.createElement('div');
        item.className = 'event-reward-item';
        if (reward.isClaimed) item.classList.add('claimed');
        else if (reward.isAvailable) item.classList.add('available');
        else item.classList.add('locked');
        let actionHtml = '';
        if (reward.isClaimed) actionHtml = '<span class="event-claimed-badge">✓ Получено</span>';
        else if (reward.canClaim) actionHtml = `<button class="event-claim-btn" data-reward-index="${reward.index}">ЗАБРАТЬ</button>`;
        else actionHtml = `<span class="event-locked-badge">День ${reward.day}</span>`;
        const rewardTypeIcon = { coins: '🪙', powerup: '⚡', skin: '🎨', chest: '📦' }[reward.type] || '🎁';
        item.innerHTML = `<div class="event-reward-day">${reward.day}</div><div class="event-reward-content"><span class="event-reward-text">${rewardTypeIcon} ${reward.text}</span><span class="event-reward-sub">${reward.isAvailable ? 'Доступно' : `Откроется на день ${reward.day}`}</span></div><div class="event-reward-action">${actionHtml}</div>`;
        eventRewardsTimelineEl.appendChild(item);
    });
    eventRewardsTimelineEl.querySelectorAll('.event-claim-btn').forEach(btn => {
        safeClick(btn, () => {
            const rewardIndex = parseInt(btn.dataset.rewardIndex);
            const result = claimEventReward(currentEvent.id, rewardIndex, {
                addCoins: (amount) => addCoins(amount),
                addPowerup: (pu, count) => { ownedPowerups[pu] = (ownedPowerups[pu] || 0) + count; savePowerups(); },
                addSkin: (skinId) => { if (!unlockedSkins.includes(skinId)) { unlockedSkins.push(skinId); safeSetItem(STORAGE_KEYS.SKINS, unlockedSkins); scheduleCloudSave(); } },
                addChest: (type, meta) => addChest(type, meta),
            });
            if (result.success) {
                stats.eventsRewards = (stats.eventsRewards || 0) + 1;
                saveStats();
                playSound('event_reward');
                triggerHaptic('success');
                showPopup(bonusText, `🎁 ${result.reward.text}`, 1500);
                renderEventRewardsTimeline();
                renderEventBanner();
                updateCoinUI();
                checkAchievements();
            }
        });
    });
}

function showEventNotification(event) {
    const notification = document.createElement('div');
    notification.className = 'event-notification';
    notification.style.setProperty('--event-color', event.color);
    notification.style.setProperty('--event-color-dark', shadeEventColor(event.color, -30));
    notification.innerHTML = `<div class="event-notification-icon">${event.icon}</div><div class="event-notification-title">${event.name}</div><div class="event-notification-desc">${event.description}</div>`;
    document.body.appendChild(notification);
    requestAnimationFrame(() => notification.classList.add('show'));
    playSound('event_start');
    triggerHaptic('success');
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 500);
    }, 3500);
}

function shadeEventColor(hex, percent) {
    hex = hex.replace('#', '');
    const num = parseInt(hex, 16);
    let r = (num >> 16) + percent;
    let g = ((num >> 8) & 0x00FF) + percent;
    let b = (num & 0x0000FF) + percent;
    r = Math.max(0, Math.min(255, r));
    g = Math.max(0, Math.min(255, g));
    b = Math.max(0, Math.min(255, b));
    return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

// ============ МИНИ-ИГРЫ ============
function stopActiveMinigame() {
    if (activeMinigame && typeof activeMinigame.destroy === 'function') {
        activeMinigame.destroy();
    }
    activeMinigame = null;
}

function stopMinigamesCooldownTimer() {
    if (minigamesCooldownInterval) {
        clearInterval(minigamesCooldownInterval);
        minigamesCooldownInterval = null;
    }
}

function renderMinigamesList() {
    if (!minigamesListEl || !minigamesStatusEl) return;
    stopActiveMinigame();
    minigameStageEl.style.display = 'none';
    minigameStageEl.innerHTML = '';
    minigameResultEl.style.display = 'none';
    minigamesListEl.style.display = 'flex';

    const status = canPlayMinigame();
    const playsLeft = getRemainingDailyPlays();

    if (status.canPlay) {
        minigamesStatusEl.classList.remove('cooldown');
        minigamesStatusEl.textContent = `🎮 Доступно сегодня: ${playsLeft} / 10`;
    } else if (status.reason === 'cooldown') {
        minigamesStatusEl.classList.add('cooldown');
        minigamesStatusEl.textContent = `⏳ Перезарядка: ${formatCooldown(getCooldownRemaining())} · Осталось: ${playsLeft}`;
    } else {
        minigamesStatusEl.classList.add('cooldown');
        minigamesStatusEl.textContent = '🌙 Дневной лимит мини-игр исчерпан. Возвращайся завтра!';
    }

    minigamesListEl.innerHTML = '';
    MINIGAMES.forEach(mg => {
        const card = document.createElement('div');
        card.className = 'minigame-card' + (status.canPlay ? '' : ' disabled');
        card.innerHTML = `
            <div class="minigame-card-icon" style="background:${mg.color}">${mg.icon}</div>
            <div class="minigame-card-info">
                <span class="minigame-card-name">${mg.name}</span>
                <span class="minigame-card-desc">${mg.desc}</span>
                <span class="minigame-card-reward">до +${Math.round(mg.reward.coins * 1.5)} 🪙 · +${Math.round(mg.reward.xp * 1.5)} ⭐</span>
            </div>
            <button class="minigame-play-btn" data-mg-id="${mg.id}" ${status.canPlay ? '' : 'disabled'}>ИГРАТЬ</button>
        `;
        minigamesListEl.appendChild(card);
    });

    minigamesListEl.querySelectorAll('.minigame-play-btn').forEach(btn => {
        if (btn.disabled) return;
        safeClick(btn, () => startMinigame(btn.dataset.mgId));
    });
}

function startMinigame(gameId) {
    const gameDef = MINIGAMES.find(m => m.id === gameId);
    if (!gameDef || !canPlayMinigame().canPlay) return;

    stopMinigamesCooldownTimer();
    minigamesListEl.style.display = 'none';
    minigameResultEl.style.display = 'none';
    minigameStageEl.style.display = 'block';
    minigamesStatusEl.textContent = `${gameDef.icon} ${gameDef.name}`;

    activeMinigame = createMinigame(gameId, minigameStageEl, (result) => {
        activeMinigame = null;
        recordMinigamePlay();
        const reward = calculateMinigameReward(gameDef, result);

        if (reward.coins > 0) addCoins(reward.coins);
        if (reward.xp > 0) addXP(reward.xp);
        if (result.success) {
            stats.minigamesWon = (stats.minigamesWon || 0) + 1;
            saveStats();
            checkAchievements();
        }

        playSound(result.success ? 'quest' : 'drop');
        triggerHaptic(result.success ? 'success' : 'light');

        minigameStageEl.style.display = 'none';
        minigameResultEl.style.display = 'flex';
        minigameResultEl.innerHTML = `
            <div class="minigame-result-title">${result.success ? '🎉 Отлично!' : '👍 Неплохо!'}</div>
            <div class="minigame-result-msg">${result.message}</div>
            <div class="minigame-result-reward">+${reward.coins} 🪙 &nbsp;·&nbsp; +${reward.xp} ⭐</div>
            <button id="minigame-back-btn" class="btn-primary">К СПИСКУ ИГР</button>
        `;
        safeClick($('minigame-back-btn'), () => {
            renderMinigamesList();
            startMinigamesCooldownTimer();
        });
    });
}

function startMinigamesCooldownTimer() {
    stopMinigamesCooldownTimer();
    minigamesCooldownInterval = setInterval(() => {
        if (!minigamesScreen?.classList.contains('open') || activeMinigame) {
            stopMinigamesCooldownTimer();
            return;
        }
        const status = canPlayMinigame();
        if (status.reason === 'cooldown') {
            minigamesStatusEl.textContent = `⏳ Перезарядка: ${formatCooldown(getCooldownRemaining())} · Осталось: ${getRemainingDailyPlays()}`;
        } else if (status.canPlay && minigamesListEl.style.display !== 'none') {
            renderMinigamesList();
            stopMinigamesCooldownTimer();
        }
    }, 1000);
}
// ============ ОБЛАЧНЫЕ СОХРАНЕНИЯ ============
function updateCloudStatusUI() {
    const statusEl = $('cloud-sync-status');
    const syncBtn = $('cloud-sync-btn');
    if (statusEl) statusEl.textContent = getCloudStatus();
    if (syncBtn) {
        const available = isCloudStorageAvailable();
        syncBtn.dataset.on = String(available);
        syncBtn.disabled = !available;
        syncBtn.textContent = available ? 'СИНХР.' : 'НЕТ';
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
    currentSkin = (typeof safeGetItem(STORAGE_KEYS.SKIN, 'default') === 'string') ? safeGetItem(STORAGE_KEYS.SKIN, 'default') : 'default';
    unlockedSkins = validateArray(safeGetItem(STORAGE_KEYS.SKINS, ['default']), ['default']);
    currentPalette = (typeof safeGetItem(STORAGE_KEYS.PALETTE, 'standard') === 'string') ? safeGetItem(STORAGE_KEYS.PALETTE, 'standard') : 'standard';
    unlockedPalettes = validateArray(safeGetItem(STORAGE_KEYS.PALETTES, ['standard']), ['standard']);
    currentBackground = (typeof safeGetItem(STORAGE_KEYS.BACKGROUND, 'default') === 'string') ? safeGetItem(STORAGE_KEYS.BACKGROUND, 'default') : 'default';
    unlockedBackgrounds = validateArray(safeGetItem(STORAGE_KEYS.BACKGROUNDS, ['default']), ['default']);
    unlockedFeatures = validateObject(safeGetItem(STORAGE_KEYS.FEATURES, {}), {});
    settings = { ...DEFAULT_SETTINGS, ...validateObject(safeGetItem(STORAGE_KEYS.SETTINGS, null), DEFAULT_SETTINGS) };
    stats = { ...DEFAULT_STATS, ...validateObject(safeGetItem(STORAGE_KEYS.STATS, null), DEFAULT_STATS) };
    if (!stats.modeMax || typeof stats.modeMax !== 'object') stats.modeMax = {};
    if (!stats.modeGames || typeof stats.modeGames !== 'object') stats.modeGames = {};
    if (stats.wheelSpins === undefined) stats.wheelSpins = 0;
    if (stats.minigamesWon === undefined) stats.minigamesWon = 0;
    if (stats.upgradesBought === undefined) stats.upgradesBought = 0;

    unlockedAchievements = validateArray(safeGetItem(STORAGE_KEYS.ACHIEVEMENTS, []), []);
    leaderboard = validateArray(safeGetItem(STORAGE_KEYS.LEADERBOARD, []), []);
    ownedPowerups = { ...DEFAULTS.POWERUPS, ...validateObject(safeGetItem(STORAGE_KEYS.POWERUPS, null), {}) };
    chests = validateArray(safeGetItem(STORAGE_KEYS.CHESTS, []), []);
    totalScoreAllTime = safeParseInt(safeGetItem(STORAGE_KEYS.TOTAL_SCORE, '0'), 0);
    recentScores = validateArray(safeGetItem(STORAGE_KEYS.RECENT_SCORES, []), []);

    loadUpgrades();

    if (highScoreEl) highScoreEl.innerText = `РЕКОРД: ${highScore}`;
    updateCoinUI();
    updateLevelUI();
    updateStreakUI();
    updateChestUI();
    updateWheelUI();
    updateSettingsUI();
    applyBackground();
    applySkinEffect();
    if (currentMenuTab === 'shop') renderShop();
    if (currentMenuTab === 'tasks') renderMissions();
}

// ============ THREE.JS & ОПТИМИЗАЦИЯ ============
const SHARED_UNIT_BOX_GEO = new THREE.BoxGeometry(1, 1, 1);
const BLOCK_MATERIAL_CACHE = new Map();
const DEBRIS_MATERIAL_CACHE = new Map();

const PARTICLE_GEOS = {
    confetti: new THREE.BoxGeometry(0.18, 0.18, 0.05),
    bomb: new THREE.BoxGeometry(0.24, 0.24, 0.24),
    wave: new THREE.PlaneGeometry(1, 1),
};
const PARTICLE_MAT_CACHE = new Map();

function getParticleMaterial(color) {
    if (!PARTICLE_MAT_CACHE.has(color)) {
        PARTICLE_MAT_CACHE.set(color, new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
    }
    return PARTICLE_MAT_CACHE.get(color);
}

function getDebrisMaterial(color) {
    if (!DEBRIS_MATERIAL_CACHE.has(color)) {
        DEBRIS_MATERIAL_CACHE.set(color, new THREE.MeshLambertMaterial({ color }));
    }
    return DEBRIS_MATERIAL_CACHE.get(color);
}

function clearBlockMaterialCache() {
    BLOCK_MATERIAL_CACHE.forEach(mats => {
        if (Array.isArray(mats)) mats.forEach(m => m.dispose());
    });
    BLOCK_MATERIAL_CACHE.clear();
}

function createGlowTexture() {
    const c = document.createElement('canvas');
    c.width = 64; c.height = 64;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.45)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(c);
    tex.needsUpdate = true;
    return tex;
}

function createPerfectWaveTexture() {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 128;
    const ctx = c.getContext('2d');
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 10;
    ctx.strokeRect(8, 8, 112, 112);
    const tex = new THREE.CanvasTexture(c);
    tex.needsUpdate = true;
    return tex;
}

function createTexture(colorHex, type = BLOCK_TYPES.NORMAL) {
    const key = `${currentSkin}_${type}_${colorHex}_${unlockedFeatures.redTheme ? 1 : 0}`;
    return getCachedTexture(key, () => {
        const c = document.createElement('canvas');
        c.width = 128; c.height = 128;
        const ctx = c.getContext('2d');

        ctx.fillStyle = colorHex;
        ctx.fillRect(0, 0, 128, 128);

        if (type === BLOCK_TYPES.BOMB) {
            ctx.fillStyle = '#141414';
            ctx.fillRect(0, 0, 128, 128);
            ctx.strokeStyle = '#FF1744';
            ctx.lineWidth = 14;
            for (let i = -128; i < 256; i += 32) {
                ctx.beginPath();
                ctx.moveTo(i, 0);
                ctx.lineTo(i + 128, 128);
                ctx.stroke();
            }
            ctx.font = 'bold 48px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('💣', 64, 66);
        } else if (type === BLOCK_TYPES.GOLDEN) {
            const grad = ctx.createLinearGradient(0, 0, 128, 128);
            grad.addColorStop(0, '#FFF59D');
            grad.addColorStop(0.5, '#FFD54F');
            grad.addColorStop(1, '#FFB300');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, 128, 128);
            ctx.strokeStyle = 'rgba(255,255,255,0.65)';
            ctx.lineWidth = 8;
            ctx.strokeRect(8, 8, 112, 112);
        } else if (type === BLOCK_TYPES.ICE) {
            const grad = ctx.createLinearGradient(0, 0, 128, 128);
            grad.addColorStop(0, '#E0F7FA');
            grad.addColorStop(1, '#00B8D4');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, 128, 128);
            ctx.strokeStyle = 'rgba(255,255,255,0.75)';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(16, 30); ctx.lineTo(112, 18);
            ctx.moveTo(20, 92); ctx.lineTo(104, 72);
            ctx.stroke();
        } else if (type === BLOCK_TYPES.CRUMBLE) {
            ctx.fillStyle = '#5D4037';
            ctx.fillRect(0, 0, 128, 128);
            ctx.strokeStyle = '#3E2723';
            ctx.lineWidth = 5;
            ctx.beginPath();
            ctx.moveTo(12, 18); ctx.lineTo(54, 62); ctx.lineTo(36, 110);
            ctx.moveTo(54, 62); ctx.lineTo(108, 44);
            ctx.moveTo(76, 60); ctx.lineTo(116, 108);
            ctx.stroke();
        } else if (type === BLOCK_TYPES.RAINBOW) {
            const grad = ctx.createLinearGradient(0, 0, 128, 0);
            grad.addColorStop(0, '#FF1744');
            grad.addColorStop(0.25, '#FFEA00');
            grad.addColorStop(0.5, '#00E676');
            grad.addColorStop(0.75, '#00B0FF');
            grad.addColorStop(1, '#D500F9');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, 128, 128);
        } else if (type === BLOCK_TYPES.DRAGON) {
            const grad = ctx.createLinearGradient(0, 0, 128, 128);
            grad.addColorStop(0, '#B71C1C');
            grad.addColorStop(0.5, '#FF6D00');
            grad.addColorStop(1, '#FFD600');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, 128, 128);
            ctx.font = 'bold 46px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('🐉', 64, 66);
        } else if (type === BLOCK_TYPES.DIAMOND) {
            const grad = ctx.createLinearGradient(0, 0, 128, 128);
            grad.addColorStop(0, '#E0F7FA');
            grad.addColorStop(0.5, '#00E5FF');
            grad.addColorStop(1, '#006064');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, 128, 128);
            ctx.font = 'bold 46px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('💎', 64, 66);
        } else {
            // Базовый объёмный градиент
            const grad = ctx.createLinearGradient(0, 0, 0, 128);
            grad.addColorStop(0, 'rgba(255,255,255,0.22)');
            grad.addColorStop(0.5, 'rgba(255,255,255,0)');
            grad.addColorStop(1, 'rgba(0,0,0,0.2)');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, 128, 128);

            // Уникальный процедурный рисунок под выбранный облик
            if (currentSkin === 'pixel' || currentSkin === 'retro') {
                ctx.fillStyle = 'rgba(0,0,0,0.16)';
                for (let x = 0; x < 128; x += 16) ctx.fillRect(x, 0, 2, 128);
                for (let y = 0; y < 128; y += 16) ctx.fillRect(0, y, 128, 2);
                ctx.fillStyle = 'rgba(255,255,255,0.38)';
                ctx.fillRect(6, 6, 10, 10);
                ctx.fillRect(22, 6, 6, 6);
            } else if (currentSkin === 'cyberpunk' || currentSkin === 'neon' || currentSkin === 'neon_skin') {
                ctx.fillStyle = 'rgba(10, 8, 24, 0.55)';
                ctx.fillRect(8, 8, 112, 112);
                ctx.strokeStyle = '#00F5FF';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(14, 34); ctx.lineTo(48, 34); ctx.lineTo(64, 52); ctx.lineTo(114, 52);
                ctx.moveTo(14, 92); ctx.lineTo(74, 92); ctx.lineTo(92, 74); ctx.lineTo(114, 74);
                ctx.stroke();
                ctx.fillStyle = '#FF2A85';
                ctx.beginPath();
                ctx.arc(48, 34, 4, 0, Math.PI * 2);
                ctx.arc(92, 74, 4, 0, Math.PI * 2);
                ctx.fill();
            } else if (currentSkin === 'magma' || currentSkin === 'fire' || currentSkin === 'fire_skin') {
                ctx.strokeStyle = 'rgba(255, 220, 60, 0.85)';
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.moveTo(10, 26); ctx.lineTo(46, 54); ctx.lineTo(34, 98);
                ctx.moveTo(46, 54); ctx.lineTo(96, 36); ctx.lineTo(118, 66);
                ctx.moveTo(72, 46); ctx.lineTo(90, 114);
                ctx.stroke();
            } else if (currentSkin === 'ice' || currentSkin === 'ice_skin' || currentSkin === 'crystal') {
                ctx.fillStyle = 'rgba(255,255,255,0.28)';
                ctx.beginPath();
                ctx.moveTo(0, 0); ctx.lineTo(78, 0); ctx.lineTo(0, 78); ctx.closePath();
                ctx.fill();
                ctx.strokeStyle = 'rgba(255,255,255,0.65)';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(24, 110); ctx.lineTo(108, 24);
                ctx.moveTo(58, 116); ctx.lineTo(118, 56);
                ctx.stroke();
            } else if (currentSkin === 'stone') {
                ctx.strokeStyle = 'rgba(0,0,0,0.28)';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(0, 42); ctx.lineTo(128, 42);
                ctx.moveTo(0, 86); ctx.lineTo(128, 86);
                ctx.moveTo(64, 0); ctx.lineTo(64, 42);
                ctx.moveTo(32, 42); ctx.lineTo(32, 86);
                ctx.moveTo(96, 42); ctx.lineTo(96, 86);
                ctx.moveTo(64, 86); ctx.lineTo(64, 128);
                ctx.stroke();
            } else if (currentSkin === 'space' || currentSkin === 'galaxy_skin' || currentSkin === 'void') {
                const neb = ctx.createRadialGradient(64, 64, 6, 64, 64, 58);
                neb.addColorStop(0, 'rgba(180, 120, 255, 0.38)');
                neb.addColorStop(1, 'rgba(0, 0, 0, 0)');
                ctx.fillStyle = neb;
                ctx.fillRect(0, 0, 128, 128);
                ctx.fillStyle = '#FFFFFF';
                [[18,22,2.5],[98,28,2],[42,76,1.8],[108,94,2.8],[26,106,1.6],[74,48,2.2],[62,108,1.5]].forEach(([x,y,r]) => {
                    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
                });
            } else if (currentSkin === 'ocean') {
                ctx.strokeStyle = 'rgba(255,255,255,0.34)';
                ctx.lineWidth = 4;
                for (let row = 28; row <= 100; row += 36) {
                    ctx.beginPath();
                    for (let x = 0; x <= 128; x += 8) {
                        const y = row + Math.sin((x / 128) * Math.PI * 4) * 7;
                        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
                    }
                    ctx.stroke();
                }
            } else if (currentSkin === 'emerald' || currentSkin === 'ruby' || currentSkin === 'amethyst') {
                ctx.strokeStyle = 'rgba(255,255,255,0.45)';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(64, 14); ctx.lineTo(114, 64); ctx.lineTo(64, 114); ctx.lineTo(14, 64); ctx.closePath();
                ctx.stroke();
                ctx.fillStyle = 'rgba(255,255,255,0.18)';
                ctx.beginPath();
                ctx.moveTo(64, 14); ctx.lineTo(114, 64); ctx.lineTo(64, 64); ctx.closePath();
                ctx.fill();
            } else if (currentSkin === 'holographic' || currentSkin === 'aurora_skin') {
                const holo = ctx.createLinearGradient(0, 0, 128, 128);
                holo.addColorStop(0, 'rgba(0,255,255,0.38)');
                holo.addColorStop(0.33, 'rgba(255,0,255,0.32)');
                holo.addColorStop(0.66, 'rgba(255,255,0,0.32)');
                holo.addColorStop(1, 'rgba(0,255,150,0.38)');
                ctx.fillStyle = holo;
                ctx.fillRect(0, 0, 128, 128);
            } else if (currentSkin === 'midas' || currentSkin === 'legend') {
                ctx.strokeStyle = 'rgba(255, 250, 200, 0.85)';
                ctx.lineWidth = 5;
                ctx.strokeRect(10, 10, 108, 108);
                ctx.lineWidth = 2;
                ctx.strokeRect(20, 20, 88, 88);
                ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
                ctx.beginPath();
                ctx.moveTo(64, 38); ctx.lineTo(84, 64); ctx.lineTo(64, 90); ctx.lineTo(44, 64); ctx.closePath();
                ctx.fill();
            } else if (currentSkin === 'food' || currentSkin === 'cats' || currentSkin === 'animals') {
                ctx.fillStyle = 'rgba(255,255,255,0.22)';
                [[28,28],[96,32],[64,66],[30,98],[98,96]].forEach(([x,y]) => {
                    ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2); ctx.fill();
                });
            }

            ctx.strokeStyle = 'rgba(255,255,255,0.22)';
            ctx.lineWidth = 4;
            ctx.strokeRect(2, 2, 124, 124);
        }

        const tex = new THREE.CanvasTexture(c);
        tex.needsUpdate = true;
        return tex;
    });
}

function initThree() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(getBgColors()[0]);

    const aspect = window.innerWidth / window.innerHeight;
    const d = getAdaptiveD(aspect);
    camera = new THREE.OrthographicCamera(-d * aspect, d * aspect, d, -d, 1, 1000);
    camera.position.set(12, 12, 12);
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ antialias: !IS_MOBILE, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, IS_MOBILE ? 1.5 : 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    const ambient = new THREE.AmbientLight(0xffffff, 0.72);
    scene.add(ambient);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.65);
    dirLight.position.set(10, 22, 14);
    scene.add(dirLight);

    glowTexture = createGlowTexture();
    perfectWaveTexture = createPerfectWaveTexture();

    applyBackground();
    applySkinEffect();
}

function createBlockMesh(w, h, d, color, type = BLOCK_TYPES.NORMAL) {
    const cacheKey = `${currentSkin}_${type}_${color}_${unlockedFeatures.redTheme ? 1 : 0}`;
    let materials = BLOCK_MATERIAL_CACHE.get(cacheKey);

    if (!materials) {
        const tex = createTexture(color, type);
        let sideOpts = { map: tex };
        let topOpts = { color: color };
        if (type === BLOCK_TYPES.GOLDEN) {
            sideOpts.emissive = new THREE.Color(0xFFB300); sideOpts.emissiveIntensity = 0.5;
            topOpts.emissive = new THREE.Color(0xFFB300); topOpts.emissiveIntensity = 0.5;
            topOpts.color = new THREE.Color(0xFFC107);
        } else if (type === BLOCK_TYPES.BOMB) {
            sideOpts.emissive = new THREE.Color(0xFF0000); sideOpts.emissiveIntensity = 0.6;
            topOpts.emissive = new THREE.Color(0xFF0000); topOpts.emissiveIntensity = 0.6;
            topOpts.color = new THREE.Color(0x330000);
        } else if (type === BLOCK_TYPES.ICE) {
            sideOpts.transparent = true; sideOpts.opacity = 0.9;
            topOpts.transparent = true; topOpts.opacity = 0.9;
            sideOpts.emissive = new THREE.Color(0x00E5FF); sideOpts.emissiveIntensity = 0.5;
            topOpts.emissive = new THREE.Color(0x00E5FF); topOpts.emissiveIntensity = 0.5;
        } else if (type === BLOCK_TYPES.CRUMBLE) {
            sideOpts.emissive = new THREE.Color(0x5D4037); sideOpts.emissiveIntensity = 0.3;
            topOpts.emissive = new THREE.Color(0x5D4037); topOpts.emissiveIntensity = 0.3;
        } else if (type === BLOCK_TYPES.RAINBOW) {
            sideOpts.emissive = new THREE.Color(0xFF00FF); sideOpts.emissiveIntensity = 0.5;
            topOpts.emissive = new THREE.Color(0xFF00FF); topOpts.emissiveIntensity = 0.5;
            topOpts.color = new THREE.Color(0xFF00FF);
        } else if (type === BLOCK_TYPES.DRAGON) {
            sideOpts.emissive = new THREE.Color(0xFF6600); sideOpts.emissiveIntensity = 0.7;
            topOpts.emissive = new THREE.Color(0xFF6600); topOpts.emissiveIntensity = 0.7;
            topOpts.color = new THREE.Color(0xB71C1C);
        } else if (type === BLOCK_TYPES.DIAMOND) {
            sideOpts.emissive = new THREE.Color(0x00BCD4); sideOpts.emissiveIntensity = 0.6;
            topOpts.emissive = new THREE.Color(0x00BCD4); topOpts.emissiveIntensity = 0.6;
            topOpts.color = new THREE.Color(0x00BCD4);
        } else {
            sideOpts.emissive = new THREE.Color(color); sideOpts.emissiveIntensity = 0.12;
            topOpts.emissive = new THREE.Color(color); topOpts.emissiveIntensity = 0.12;
            if (unlockedFeatures.redTheme) {
                sideOpts.emissive = new THREE.Color(0xFF4444);
                sideOpts.emissiveIntensity = 0.2;
            }
        }
        const side = new THREE.MeshLambertMaterial(sideOpts);
        const top = new THREE.MeshLambertMaterial(topOpts);
        materials = [side, side, top, top, side, side];
        BLOCK_MATERIAL_CACHE.set(cacheKey, materials);
    }

    const mesh = new THREE.Mesh(SHARED_UNIT_BOX_GEO, materials);
    mesh.scale.set(w, h, d);
    mesh.userData = {
        w,
        d,
        blockType: type,
        sharedGeometry: true,
        sharedMaterial: true,
    };

    if (type !== BLOCK_TYPES.NORMAL && type !== BLOCK_TYPES.CRUMBLE) {
        const glowColor = BLOCK_GLOW_COLORS[type];
        const isSecret = type === BLOCK_TYPES.RAINBOW || type === BLOCK_TYPES.DRAGON || type === BLOCK_TYPES.DIAMOND;
        const opacity = isSecret ? 0.9 : 0.7;
        const scale = isSecret ? 7 : 5.5;
        const spriteMat = new THREE.SpriteMaterial({
            map: glowTexture, color: glowColor, transparent: true,
            blending: THREE.AdditiveBlending, depthWrite: false, opacity
        });
        const sprite = new THREE.Sprite(spriteMat);
        sprite.scale.set(scale / Math.max(0.2, w), scale / Math.max(0.2, h), 1);
        sprite.renderOrder = -1;
        mesh.add(sprite);
        mesh.userData.glowSprite = sprite;
    }
    return mesh;
}

function getBlockVisuals(type, stepIndex = blocks.length) {
    if (type !== BLOCK_TYPES.NORMAL && BLOCK_COLORS[type]) {
        return { color: BLOCK_COLORS[type] };
    }
    const palette = currentPalette !== 'standard'
        ? getPaletteColors()
        : (SKINS[currentSkin]?.colors || BASE_COLORS);
    return { color: palette[stepIndex % palette.length] };
}

function generateNextBlockData() {
    let type = BLOCK_TYPES.NORMAL;
    if (dailyModifiers.onlyType) {
        type = dailyModifiers.onlyType;
    } else if (dailyModifiers.allIce) {
        type = BLOCK_TYPES.ICE;
    } else if (!dailyModifiers.noSpecials && blocks.length >= 2) {
        const luckMult = (activePowerups.luck ? 2 : 1) * (1 + getUpgradeBonuses().luckMult);
        const r = Math.random();
        const secretChance = 0.015 * luckMult;
        const goldChance = dailyModifiers.noGolden ? 0 : 0.09 * luckMult;
        const iceChance = 0.08;
        const bombChance = (dailyModifiers.noBombs || activePowerups.luck) ? 0 : 0.07;
        const crumbleChance = (score >= 15 && !activePowerups.luck && !dailyModifiers.noBombs) ? 0.06 : 0;

        if (r < secretChance) {
            const secrets = [BLOCK_TYPES.RAINBOW, BLOCK_TYPES.DRAGON, BLOCK_TYPES.DIAMOND];
            type = secrets[Math.floor(Math.random() * secrets.length)];
        } else if (r < secretChance + goldChance) {
            type = BLOCK_TYPES.GOLDEN;
        } else if (r < secretChance + goldChance + iceChance) {
            type = BLOCK_TYPES.ICE;
        } else if (r < secretChance + goldChance + iceChance + bombChance) {
            type = BLOCK_TYPES.BOMB;
        } else if (r < secretChance + goldChance + iceChance + bombChance + crumbleChance) {
            type = BLOCK_TYPES.CRUMBLE;
        }
    }

    const { color } = getBlockVisuals(type, blocks.length + 1);
    return { type, color };
}

function updateNextBlockPreview(type, color) {
    const preview = $('next-block-preview');
    if (!preview) return;
    preview.style.background = color;
    preview.textContent = '';
    preview.style.display = 'flex';
    preview.style.alignItems = 'center';
    preview.style.justifyContent = 'center';
    preview.style.fontSize = '18px';
    if (type === BLOCK_TYPES.BOMB) preview.textContent = '💣';
    else if (type === BLOCK_TYPES.GOLDEN) preview.textContent = '👑';
    else if (type === BLOCK_TYPES.ICE) preview.textContent = '❄️';
    else if (type === BLOCK_TYPES.CRUMBLE) preview.textContent = '🧱';
    else if (type === BLOCK_TYPES.RAINBOW) preview.textContent = '🌈';
    else if (type === BLOCK_TYPES.DRAGON) preview.textContent = '🐉';
    else if (type === BLOCK_TYPES.DIAMOND) preview.textContent = '💎';
}

function disposeMesh(mesh) {
    if (!mesh) return;
    if (mesh.userData?.glowSprite) {
        if (mesh.userData.glowSprite.material) mesh.userData.glowSprite.material.dispose();
        mesh.remove(mesh.userData.glowSprite);
    }
    if (!mesh.userData?.sharedGeometry && mesh.geometry) mesh.geometry.dispose();
    if (!mesh.userData?.sharedMaterial && mesh.material) {
        if (Array.isArray(mesh.material)) mesh.material.forEach(m => m.dispose());
        else mesh.material.dispose();
    }
    scene.remove(mesh);
}

function disposeRecordLine() {
    if (!recordLineGroup) return;
    recordLineGroup.traverse(obj => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
            if (obj.material.map) obj.material.map.dispose();
            obj.material.dispose();
        }
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
    const y = targetHeight * BLOCK_HEIGHT + BLOCK_HEIGHT * 0.5;
    group.position.set(0, y, 0);

    const half = currentBaseSize * 0.5 + 0.7;
    const pts = [
        new THREE.Vector3(-half, 0, -half),
        new THREE.Vector3(half, 0, -half),
        new THREE.Vector3(half, 0, half),
        new THREE.Vector3(-half, 0, half),
    ];
    const lineGeo = new THREE.BufferGeometry().setFromPoints(pts);
    const lineMat = new THREE.LineBasicMaterial({ color: 0xFFD700, transparent: true, opacity: 0.9 });
    const ring = new THREE.LineLoop(lineGeo, lineMat);
    group.add(ring);

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(255, 215, 0, 0.95)';
    ctx.beginPath();
    ctx.roundRect(6, 8, 244, 48, 24);
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.fillStyle = '#4A3200';
    ctx.font = '900 24px Rubik, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`👑 РЕКОРД: ${highScore}`, 128, 33);

    const spriteTex = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: spriteTex, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.position.set(half + 1.8, 0.45, -half * 0.4);
    sprite.scale.set(4.4, 1.1, 1);
    group.add(sprite);

    group.userData = { ringMat: lineMat, sprite };
    scene.add(group);
    recordLineGroup = group;
}

function clearScene() {
    blocks.forEach(disposeMesh);
    debris.forEach(disposeMesh);
    confetti.forEach(disposeMesh);
    perfectWaves.forEach(w => {
        if (w.material) w.material.dispose();
        scene.remove(w);
    });
    disposeRecordLine();
    disposeAtmosphereLayers(scene);
    if (currentBlock) { disposeMesh(currentBlock); currentBlock = null; }
    blocks = [];
    debris = [];
    confetti = [];
    perfectWaves = [];
}

// ============ ШТОРМ (ВЕТЕР) ============
function updateWindUI() {
    if (!windIndicatorEl || !windFillEl) return;
    if (gameMode !== GAME_MODES.STORM || gameState !== GAME_STATES.PLAYING) {
        windIndicatorEl.style.display = 'none';
        return;
    }
    windIndicatorEl.style.display = 'flex';
    const pct = Math.min(100, Math.round((Math.abs(windStrength) / 0.085) * 100));
    windFillEl.style.width = `${pct}%`;
    const leftEl = $('wind-left');
    const rightEl = $('wind-right');
    if (leftEl) leftEl.classList.toggle('active', windDirection < 0 && windStrength > 0.005);
    if (rightEl) rightEl.classList.toggle('active', windDirection > 0 && windStrength > 0.005);
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
    if (windGain && audioCtx) {
        try { windGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.15); } catch (e) {}
    }
    updateWindUI();
}

// ============ ПОПАПЫ ============
const popupTimers = new WeakMap();
function showPopup(el, text, duration = 900) {
    if (!el) return;
    el.innerText = text;
    el.classList.remove('show-popup');
    const prev = popupTimers.get(el);
    if (prev) clearTimeout(prev);
    requestAnimationFrame(() => {
        el.classList.add('show-popup');
        const id = setTimeout(() => {
            el.classList.remove('show-popup');
            popupTimers.delete(el);
        }, duration);
        popupTimers.set(el, id);
    });
}

function triggerScreenFlash(duration = 120) {
    if (!screenFlash) return;
    screenFlash.style.opacity = '0.55';
    setTimeout(() => { screenFlash.style.opacity = '0'; }, duration);
}

// ============ СТАРТ ИГРЫ ============
function createBaseBlock() {
    const { color } = getBlockVisuals(BLOCK_TYPES.NORMAL, 0);
    const base = createBlockMesh(currentBaseSize, BLOCK_HEIGHT, currentBaseSize, color, BLOCK_TYPES.NORMAL);
    base.position.set(0, 0, 0);
    Object.assign(base.userData, { w: currentBaseSize, d: currentBaseSize, color, blockType: BLOCK_TYPES.NORMAL });
    scene.add(base);
    blocks.push(base);
}

function spawnNewBlock(overrideSize = null) {
    const top = blocks[blocks.length - 1];
    movingAxis = blocks.length % 2 === 1 ? 'x' : 'z';
    let { type, color } = nextBlockData;
    nextBlockData = generateNextBlockData();
    updateNextBlockPreview(nextBlockData.type, nextBlockData.color);

    // После «Второго шанса» гарантированно даём безопасный блок
    if (overrideSize && (type === BLOCK_TYPES.BOMB || type === BLOCK_TYPES.CRUMBLE)) {
        type = BLOCK_TYPES.NORMAL;
        color = getBlockVisuals(BLOCK_TYPES.NORMAL).color;
    }

    const w = overrideSize ? overrideSize.w : top.userData.w;
    const d = overrideSize ? overrideSize.d : top.userData.d;
    const mirrorSign = gameMode === GAME_MODES.MIRROR ? -1 : 1;
    let sx = top.position.x, sz = top.position.z;
    if (movingAxis === 'x') sx = (direction === 1 ? -GAME_CONFIG.MOVE_RANGE : GAME_CONFIG.MOVE_RANGE) * mirrorSign;
    else sz = (direction === 1 ? -GAME_CONFIG.MOVE_RANGE : GAME_CONFIG.MOVE_RANGE) * mirrorSign;

    currentBlock = createBlockMesh(w, BLOCK_HEIGHT, d, color, type);
    currentBlock.position.set(sx, top.position.y + BLOCK_HEIGHT, sz);
    Object.assign(currentBlock.userData, { w, d, moving: true, color, blockType: type, squash: 1 });
    scene.add(currentBlock);
}

function startGame(mode = gameMode) {
    clearGameOverTimers();
    if (secondChanceRaf) { cancelAnimationFrame(secondChanceRaf); secondChanceRaf = null; }
    if (resumeDelayTimer) { clearTimeout(resumeDelayTimer); resumeDelayTimer = null; }
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

    if (dailyModifiers.forceBg && !savedBgBeforeDaily) {
        savedBgBeforeDaily = currentBackground;
        currentBackground = dailyModifiers.forceBg;
        applyBackground();
    }
    if (dailyModifiers.forcePalette && !savedPaletteBeforeDaily) {
        savedPaletteBeforeDaily = currentPalette;
        currentPalette = dailyModifiers.forcePalette;
    }

    clearScene();
    score = 0; combo = 0; sessionCoins = 0; sessionXP = 0;
    direction = 1; isFury = false; furyBlocksLeft = 0;
    secondChanceUsed = false; secondChanceActive = false;
    overviewActive = false; overviewSkipped = false;
    shakeIntensity = 0; cameraZoomPulse = 0;
    currentBiomeIndex = 0;

    const upg = getUpgradeBonuses();
    let baseSize = dailyModifiers.baseSize || BLOCK_SIZE;
    if (activePowerups.foundation) baseSize *= 1.35;
    baseSize *= (1 + upg.baseSizeMult);
    currentBaseSize = baseSize;

    const skinMods = getSkinModifiers();
    const smartMult = getSmartDifficultyMultiplier();
    let startSpeed = dailyModifiers.startSpeed || BASE_SPEED;
    if (gameMode === GAME_MODES.STORM) startSpeed *= 1.1;
    if (gameMode === GAME_MODES.MIRROR) startSpeed *= 1.15;
    if (dailyModifiers.speedMult) startSpeed *= dailyModifiers.speedMult;
    if (skinMods.speedMult) startSpeed *= skinMods.speedMult;
    currentSpeed = startSpeed * smartMult;
    dynamicMaxSpeed = gameMode === GAME_MODES.ENDLESS
        ? GAME_CONFIG.ENDLESS_MAX_SPEED
        : GAME_CONFIG.DEFAULT_MAX_SPEED;

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
        modeLabel.innerText = dailyChallengeActive
            ? `📅 ${getDailyChallenge().name.toUpperCase()}`
            : (GAME_MODE_NAMES[gameMode] || 'КЛАССИКА');
    }
    updateCoinUI();
    updateComboIndicator();
    updateActivePowerupsUI();
    cacheCoinPopupAnchor();

    const timeLimit = dailyModifiers.timeLimit || (gameMode === GAME_MODES.TIME ? GAME_CONFIG.DEFAULT_TIME_LIMIT + upg.extraTime : 0);
    if (timeLimit > 0 && timerEl) {
        timeLeft = timeLimit;
        timerEl.style.display = 'block';
        timerEl.innerText = `⏱ ${timeLeft}`;
        timeAttackTimer = setInterval(() => {
            if (gameState !== GAME_STATES.PLAYING) return;
            timeLeft--;
            timerEl.innerText = `⏱ ${timeLeft}`;
            if (timeLeft <= 0) {
                clearInterval(timeAttackTimer);
                timeAttackTimer = null;
                triggerGameOver();
            }
        }, 1000);
    } else if (timerEl) {
        timerEl.style.display = 'none';
    }

    if (tutorialEl) {
        tutorialEl.style.display = showTutorialHint ? 'block' : 'none';
    }

    initAudio();
    startMusic();
    startWindSystem();
    startRenderLoop();

    createBaseBlock();
    createRecordLine();
    initAtmosphereLayers(scene, BLOCK_HEIGHT, lowPerfMode);
    nextBlockData = generateNextBlockData();
    spawnNewBlock();

    stats.totalGames = (stats.totalGames || 0) + 1;
    stats.modeGames[gameMode] = (stats.modeGames[gameMode] || 0) + 1;
    saveStats();
    updateQuest('games', 1);
    if (gameMode === GAME_MODES.TIME) updateQuest('time_game', 1);
    updateMissionProgress(missions, 'games', 1);
    updateTelegramBackButton();
}

// ============ ЭФФЕКТЫ И ЧАСТИЦЫ ============
function createDebris(diff, origSize, newSize, axis, top) {
    const dSize = origSize - newSize;
    if (dSize <= 0.01) return;
    const dw = axis === 'x' ? dSize : currentBlock.userData.w;
    const dd = axis === 'z' ? dSize : currentBlock.userData.d;
    const mesh = new THREE.Mesh(SHARED_UNIT_BOX_GEO, getDebrisMaterial(currentBlock.userData.color));
    mesh.scale.set(dw, BLOCK_HEIGHT, dd);
    let px = currentBlock.position.x, pz = currentBlock.position.z;
    if (axis === 'x') px = diff > 0 ? top.position.x + (origSize / 2) + (dSize / 2) : top.position.x - (origSize / 2) - (dSize / 2);
    else pz = diff > 0 ? top.position.z + (origSize / 2) + (dSize / 2) : top.position.z - (origSize / 2) - (dSize / 2);
    mesh.position.set(axis === 'x' ? px : currentBlock.position.x, currentBlock.position.y, axis === 'z' ? pz : currentBlock.position.z);
    mesh.userData = {
        sharedGeometry: true,
        sharedMaterial: true,
        vel: new THREE.Vector3(axis === 'x' ? (diff > 0 ? 0.15 : -0.15) : 0, 0.1, axis === 'z' ? (diff > 0 ? 0.15 : -0.15) : 0),
        rotSpeed: new THREE.Vector3((Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3)
    };
    scene.add(mesh);
    debris.push(mesh);
    enforceParticleLimits(debris, lowPerfMode ? 12 : PARTICLE_LIMITS.MAX_DEBRIS, disposeMesh);
}

function spawnPerfectWave(x, y, z, w, d, color = '#FFFFFF') {
    if (lowPerfMode) return;
    const mat = new THREE.MeshBasicMaterial({
        map: perfectWaveTexture,
        color: unlockedFeatures.goldenTrail ? '#FFD700' : color,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        side: THREE.DoubleSide,
    });
    const wave = new THREE.Mesh(PARTICLE_GEOS.wave, mat);
    wave.rotation.x = -Math.PI / 2;
    wave.position.set(x, y - BLOCK_HEIGHT * 0.45, z);
    wave.scale.set(w * 1.05, d * 1.05, 1);
    wave.userData = { age: 0, baseW: w, baseD: d };
    scene.add(wave);
    perfectWaves.push(wave);
}

function spawnConfetti(count = 16, originPos = null) {
    if (lowPerfMode) count = Math.min(count, 6);
    const top = originPos || (blocks.length > 0 ? blocks[blocks.length - 1].position : new THREE.Vector3(0, 0, 0));
    for (let i = 0; i < count; i++) {
        const color = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
        const m = new THREE.Mesh(PARTICLE_GEOS.confetti, getParticleMaterial(color));
        m.position.set(
            top.x + (Math.random() - 0.5) * 2.5,
            top.y + 0.5 + Math.random() * 1.5,
            top.z + (Math.random() - 0.5) * 2.5
        );
        m.userData = {
            sharedGeometry: true,
            sharedMaterial: true,
            vel: new THREE.Vector3((Math.random() - 0.5) * 0.28, 0.18 + Math.random() * 0.25, (Math.random() - 0.5) * 0.28),
            rot: new THREE.Vector3(Math.random() * 0.3, Math.random() * 0.3, Math.random() * 0.3),
            life: 1.0,
        };
        scene.add(m);
        confetti.push(m);
    }
    enforceParticleLimits(confetti, lowPerfMode ? 24 : PARTICLE_LIMITS.MAX_CONFETTI, disposeMesh);
}

function spawnBombParticles() {
    const pos = currentBlock ? currentBlock.position : new THREE.Vector3(0, 0, 0);
    const colors = ['#FF1744', '#FF9100', '#FFD600', '#212121'];
    const count = lowPerfMode ? 8 : 18;
    for (let i = 0; i < count; i++) {
        const m = new THREE.Mesh(PARTICLE_GEOS.bomb, getParticleMaterial(colors[i % colors.length]));
        m.position.copy(pos);
        m.userData = {
            sharedGeometry: true,
            sharedMaterial: true,
            vel: new THREE.Vector3((Math.random() - 0.5) * 0.4, 0.15 + Math.random() * 0.35, (Math.random() - 0.5) * 0.4),
            rot: new THREE.Vector3(Math.random() * 0.4, Math.random() * 0.4, Math.random() * 0.4),
            life: 0.9,
        };
        scene.add(m);
        confetti.push(m);
    }
    shakeIntensity = Math.max(shakeIntensity, 0.65);
    triggerScreenFlash(160);
    enforceParticleLimits(confetti, lowPerfMode ? 24 : PARTICLE_LIMITS.MAX_CONFETTI, disposeMesh);
}

function activateFury() {
    if (dailyModifiers.noFury) return;
    isFury = true;
    furyBlocksLeft = GAME_CONFIG.FURY_BLOCKS;
    document.body.classList.add('fury-active');
    showPopup(comboText, '🔥 РЕЖИМ ЯРОСТИ! x2 ОЧКИ', 1400);
    playSound('fury');
    triggerHaptic('heavy');
    stats.totalFury = (stats.totalFury || 0) + 1;
    saveStats();
    updateQuest('fury', 1);
    updateMissionProgress(missions, 'fury', 1);
    checkAchievements();
}

function triggerMilestone(points) {
    const bgColors = getBgColors();
    const newBiome = Math.floor(points / 10) % bgColors.length;
    if (newBiome !== currentBiomeIndex) {
        currentBiomeIndex = newBiome;
        targetBgColor.set(bgColors[newBiome]);
        document.body.style.background = bgColors[newBiome];
        syncTelegramTheme(bgColors[newBiome]);
    }
    showPopup(milestoneText, `🎉 ${points} ЭТАЖЕЙ!`, 1200);
    playSound('milestone');
    spawnConfetti(22);
    triggerHaptic('success');
}

// ============ ВТОРОЙ ШАНС ============
function canOfferSecondChance() {
    if (secondChanceUsed || secondChanceActive) return false;
    if (dailyChallengeActive || gameMode === GAME_MODES.PRECISION) return false;
    if (coins < getSecondChanceCost()) return false;
    const nearRecord = highScore > 0 && score >= Math.max(5, highScore - GAME_CONFIG.SECOND_CHANCE_NEAR_RECORD);
    return score >= GAME_CONFIG.SECOND_CHANCE_MIN_SCORE || nearRecord;
}

function offerSecondChance(reason = 'miss') {
    secondChanceActive = true;
    gameState = GAME_STATES.PAUSED;
    document.body.classList.remove('in-game');
    if (timeAttackTimer) { clearInterval(timeAttackTimer); timeAttackTimer = null; }

    if (secondChanceSubEl) {
        if (reason === 'crumble') {
            secondChanceSubEl.textContent = '🧱 Хрупкий блок разрушился от идеала! Продолжить с этого места?';
        } else {
            const diff = highScore - score;
            secondChanceSubEl.textContent = (highScore > 0 && diff > 0 && diff <= GAME_CONFIG.SECOND_CHANCE_NEAR_RECORD)
                ? `Промах! До рекорда всего ${diff} — продолжи с этого места!`
                : `Промах! Отличная башня (${score} очк.) — продолжить?`;
        }
    }
    if (secondChanceBuyBtn) {
        secondChanceBuyBtn.textContent = `💖 ПРОДОЛЖИТЬ (${getSecondChanceCost()} 🪙)`;
    }

    showModal(secondChanceOverlay);
    secondChanceEndTime = performance.now() + GAME_CONFIG.SECOND_CHANCE_DURATION;

    function tickTimer(now) {
        if (!secondChanceActive) return;
        const left = Math.max(0, secondChanceEndTime - now);
        const pct = left / GAME_CONFIG.SECOND_CHANCE_DURATION;
        if (secondChanceTimerFill) secondChanceTimerFill.style.transform = `scaleX(${pct})`;
        if (left <= 0) {
            declineSecondChance();
            return;
        }
        secondChanceRaf = requestAnimationFrame(tickTimer);
    }
    secondChanceRaf = requestAnimationFrame(tickTimer);
}

function acceptSecondChance() {
    const cost = getSecondChanceCost();
    if (!secondChanceActive || coins < cost) {
        declineSecondChance();
        return;
    }
    secondChanceActive = false;
    secondChanceUsed = true;
    if (secondChanceRaf) { cancelAnimationFrame(secondChanceRaf); secondChanceRaf = null; }

    coins -= cost;
    safeSetItem(STORAGE_KEYS.COINS, coins);
    scheduleCloudSave();
    updateCoinUI();

    if (currentBlock) { disposeMesh(currentBlock); currentBlock = null; }
    hideModal(secondChanceOverlay, { restoreMenu: false });

    gameState = GAME_STATES.PLAYING;
    document.body.classList.add('in-game');
    combo = 0;
    updateComboIndicator();

    // Новый блок на 50–60% меньше начального (40–50% от currentBaseSize)
    const rescueScale = 0.4 + Math.random() * 0.1;
    const rescueSize = currentBaseSize * rescueScale;
    spawnNewBlock({ w: rescueSize, d: rescueSize });

    if (gameMode === GAME_MODES.TIME && timeLeft > 0) {
        timeAttackTimer = setInterval(() => {
            if (gameState !== GAME_STATES.PLAYING) return;
            timeLeft--;
            if (timerEl) timerEl.innerText = `⏱ ${timeLeft}`;
            if (timeLeft <= 0) {
                clearInterval(timeAttackTimer);
                timeAttackTimer = null;
                triggerGameOver();
            }
        }, 1000);
    }

    playSound('quest');
    triggerHaptic('success');
    showPopup(bonusText, '💖 ВТОРОЙ ШАНС!', 1200);
    updateTelegramBackButton();
}

function declineSecondChance() {
    if (!secondChanceActive) return;
    secondChanceActive = false;
    secondChanceUsed = true;
    if (secondChanceRaf) { cancelAnimationFrame(secondChanceRaf); secondChanceRaf = null; }
    hideModal(secondChanceOverlay, { restoreMenu: false });
    triggerGameOver();
}

// ============ ОБЗОР БАШНИ И GAME OVER ============
const HEIGHT_LANDMARKS = [
    { m: 3, text: 'Выше жирафа 🦒' },
    { m: 10, text: 'Как 3-этажный дом 🏠' },
    { m: 20, text: 'Как Статуя Свободы (постамент) 🗽' },
    { m: 35, text: 'Выше 10-этажки 🏢' },
    { m: 55, text: 'Как Пизанская башня 🗼' },
    { m: 90, text: 'Как Биг-Бен 🕰️' },
    { m: 140, text: 'Как Пирамида Хеопса 🔺' },
    { m: 220, text: 'Почти Эйфелева башня 🗼' },
    { m: 320, text: 'Выше Эйфелевой башни ✨' },
];

function getHeightComparison(meters) {
    let label = 'Хорошее начало! 🌱';
    for (const lm of HEIGHT_LANDMARKS) {
        if (meters >= lm.m) label = lm.text;
    }
    return label;
}

function showTowerHeightBanner(meters) {
    if (!towerHeightBanner) return;
    if (towerHeightMetersEl) towerHeightMetersEl.textContent = `🏗️ Высота: ${meters} м`;
    if (towerHeightCompareEl) towerHeightCompareEl.textContent = getHeightComparison(meters);
    towerHeightBanner.classList.add('show');
}

function hideTowerHeightBanner() {
    if (towerHeightBanner) towerHeightBanner.classList.remove('show');
}

function skipTowerOverview() {
    if (gameState !== GAME_STATES.GAMEOVER || !overviewActive || overviewSkipped) return;
    if (performance.now() < overviewSkipReadyAt) return;
    overviewSkipped = true;
    clearGameOverTimers();
    hideTowerHeightBanner();
    playLoseAnimation();
    gameOverTimers.push(setTimeout(() => showModal(gameOverEl), 120));
}

function playLoseAnimation() {
    if (currentBlock && !currentBlock.userData.falling) {
        currentBlock.userData.falling = true;
    }
    shakeIntensity = Math.max(shakeIntensity, 0.55);
}

function triggerGameOver() {
    if (gameState === GAME_STATES.GAMEOVER) return;
    gameState = GAME_STATES.GAMEOVER;
    document.body.classList.remove('in-game', 'fury-active');
    stopMusic();
    stopWindSystem();
    if (timeAttackTimer) { clearInterval(timeAttackTimer); timeAttackTimer = null; }

    playSound('gameover');
    triggerHaptic('error');

    const isNewRecord = score > highScore;
    if (isNewRecord) {
        highScore = score;
        safeSetItem(STORAGE_KEYS.HIGH_SCORE, highScore);
        if (highScoreEl) highScoreEl.innerText = `РЕКОРД: ${highScore}`;
        if (victoryCrownEl) {
            victoryCrownEl.classList.remove('show');
            requestAnimationFrame(() => victoryCrownEl.classList.add('show'));
            playSound('victory');
        }
    }

    const builtMeters = Math.max(0, blocks.length - 1);
    if (builtMeters > bestHeight) {
        bestHeight = builtMeters;
        safeSetItem('towerBestHeight', String(bestHeight));
    }

    if (score > (stats.maxScore || 0)) stats.maxScore = score;
    if (score > (stats.modeMax[gameMode] || 0)) stats.modeMax[gameMode] = score;
    if (gameMode === GAME_MODES.TIME && score > (stats.maxTimeScore || 0)) stats.maxTimeScore = score;
    saveStats();

    totalScoreAllTime += score;
    saveTotalScore();
    trackGameScore(score);
    addToLeaderboard(score, gameMode);

    const xpEarned = Math.max(5, Math.round(score * 3 + combo * 2));
    addXP(xpEarned);
    updateMissionProgress(missions, 'score', score, true);
    checkAchievements();
    flushCloudSave();

    if (finalScoreVal) finalScoreVal.innerText = score;
    if (gameCoinsEarnedEl) gameCoinsEarnedEl.innerText = `+${sessionCoins} 🪙 за игру`;
    if (gameXPEarnedEl) gameXPEarnedEl.innerText = `+${sessionXP} опыта`;
    if (gameOverHeightEl) gameOverHeightEl.innerText = builtMeters > 0 ? `🏗️ Высота: ${builtMeters} м · ${getHeightComparison(builtMeters)}` : '';
    const nrEl = $('new-record');
    if (nrEl) nrEl.style.display = isNewRecord ? 'block' : 'none';

    restoreDailyVisuals();
    dailyChallengeActive = false;
    dailyModifiers = {};
    updatePowerupReplayButton();

    clearGameOverTimers();
    if (builtMeters >= 3) {
        const aspect = window.innerWidth / window.innerHeight;
        const d = getAdaptiveD(aspect);
        const topY = blocks.length > 0 ? blocks[blocks.length - 1].position.y : 0;
        overviewTargetY = topY * 0.5;
        overviewTargetZoom = Math.max(0.24, Math.min(1, (d * 1.45) / Math.max(1, topY + 5)));
        overviewActive = true;
        overviewSkipped = false;
        overviewSkipReadyAt = performance.now() + 250;
        blocks.forEach(b => { b.visible = true; });
        showTowerHeightBanner(builtMeters);

        gameOverTimers.push(setTimeout(() => {
            hideTowerHeightBanner();
            playLoseAnimation();
        }, 1650));
        gameOverTimers.push(setTimeout(() => showModal(gameOverEl), 2050));
    } else {
        playLoseAnimation();
        gameOverTimers.push(setTimeout(() => showModal(gameOverEl), 450));
    }
    updateTelegramBackButton();
}

// ============ ОСНОВНОЙ ХОД (DROP BLOCK) ============
function dropBlock() {
    if (gameState !== GAME_STATES.PLAYING || !currentBlock || !currentBlock.userData.moving) return;

    if (showTutorialHint) {
        showTutorialHint = false;
        safeSetItem(STORAGE_KEYS.TUTORIAL_SHOWN, true);
        if (tutorialEl) tutorialEl.style.display = 'none';
    }

    currentBlock.userData.moving = false;
    const top = blocks[blocks.length - 1];
    const bType = currentBlock.userData.blockType;
    const prevColor = currentBlock.userData.color;

    const diffX = currentBlock.position.x - top.position.x;
    const diffZ = currentBlock.position.z - top.position.z;
    const absDiffX = Math.abs(diffX);
    const absDiffZ = Math.abs(diffZ);
    const maxDiff = movingAxis === 'x' ? absDiffX : absDiffZ;
    const sizeX = currentBlock.userData.w;
    const sizeZ = currentBlock.userData.d;

    const minOverlap = 0.08;
    const missX = movingAxis === 'x' && absDiffX >= sizeX - minOverlap;
    const missZ = movingAxis === 'z' && absDiffZ >= sizeZ - minOverlap;
    const precisionMode = (gameMode === GAME_MODES.PRECISION);
    const noCutActive = dailyModifiers.noCut || precisionMode;

    const upg = getUpgradeBonuses();
    let perfectThreshold = dailyModifiers.tightThreshold || GAME_CONFIG.PERFECT_THRESHOLD;
    if (activePowerups.focus) {
        const activeSize = movingAxis === 'x' ? sizeX : sizeZ;
        perfectThreshold = Math.min(Math.max(perfectThreshold * 3.5, 0.55), activeSize * 0.45);
    }
    perfectThreshold *= (1 + upg.perfectMult);

    const isDiamondAuto = (bType === BLOCK_TYPES.DIAMOND && !missX && !missZ);

    if (missX || missZ) {
        currentBlock.userData.falling = true;
        if (canOfferSecondChance()) { offerSecondChance('miss'); return; }
        triggerGameOver();
        return;
    }

    if (noCutActive && !isDiamondAuto && maxDiff >= perfectThreshold) {
        currentBlock.userData.falling = true;
        triggerGameOver();
        return;
    }

    if (bType === BLOCK_TYPES.CRUMBLE && maxDiff < perfectThreshold) {
        currentBlock.position.x = top.position.x;
        currentBlock.position.z = top.position.z;
        playSound('bomb');
        spawnBombParticles();
        if (canOfferSecondChance()) { offerSecondChance('crumble'); return; }
        triggerGameOver();
        return;
    }

    const isPerfect = isDiamondAuto || maxDiff < perfectThreshold;
    const skinMods = getSkinModifiers();
    const prestigeBonus = getPrestigeBonus();
    let basePoints = 1;

    if (isPerfect) {
        currentBlock.position.x = top.position.x;
        currentBlock.position.z = top.position.z;
        currentBlock.userData.squash = 0;

        if (!dailyModifiers.noCombo) {
            const oldCombo = combo;
            combo++;
            if (combo > (stats.maxCombo || 0)) stats.maxCombo = combo;
            const upgrade = checkTierUpgrade(oldCombo, combo);
            if (upgrade) {
                playSound(upgrade.sound);
                showPopup(comboText, `${upgrade.name}! x${upgrade.multiplier}`, 1100);
            }
            if (combo >= 5) {
                cameraZoomPulse = Math.min(0.055, 0.025 + (combo - 5) * 0.004);
            }
        }

        // Восстановление ширины каждые 5 идеалов подряд
        if (combo > 0 && combo % 5 === 0 && (sizeX < currentBaseSize - 0.05 || sizeZ < currentBaseSize - 0.05)) {
            const newW = Math.min(currentBaseSize, sizeX + 0.35);
            const newD = Math.min(currentBaseSize, sizeZ + 0.35);
            const pos = currentBlock.position.clone();
            disposeMesh(currentBlock);
            const grown = createBlockMesh(newW, BLOCK_HEIGHT, newD, prevColor, bType);
            grown.position.copy(pos);
            Object.assign(grown.userData, { w: newW, d: newD, color: prevColor, blockType: bType, squash: 0 });
            scene.add(grown);
            currentBlock = grown;
            showPopup(bonusText, '✨ ШИРИНА +', 900);
        }

        if (combo === GAME_CONFIG.FURY_THRESHOLD && !isFury) activateFury();

        if (bType === BLOCK_TYPES.GOLDEN) { basePoints = 3; addCoins(5); stats.totalGolden = (stats.totalGolden || 0) + 1; updateQuest('golden', 1); }
        else if (bType === BLOCK_TYPES.BOMB) { basePoints = 2; stats.totalBomb = (stats.totalBomb || 0) + 1; updateQuest('bomb', 1); }
        else if (bType === BLOCK_TYPES.ICE) { basePoints = 2; stats.totalIce = (stats.totalIce || 0) + 1; updateQuest('ice', 1); }
        else if (bType === BLOCK_TYPES.RAINBOW) { basePoints = 10; addCoins(15); playSound('secret'); stats.totalSecret = (stats.totalSecret || 0) + 1; updateQuest('secret', 1); }
        else if (bType === BLOCK_TYPES.DRAGON) { basePoints = 10; spawnConfetti(20); playSound('secret'); stats.totalSecret = (stats.totalSecret || 0) + 1; updateQuest('secret', 1); }
        else if (bType === BLOCK_TYPES.DIAMOND) { basePoints = 5; addCoins(8); playSound('secret'); stats.totalSecret = (stats.totalSecret || 0) + 1; updateQuest('secret', 1); }
        else { addCoins(2); }

        if (gameMode === GAME_MODES.TIME && timerEl) {
            timeLeft += 2;
            timerEl.innerText = `⏱ ${timeLeft}`;
        }
        if (gameMode === GAME_MODES.STORM) {
            windStrength = Math.max(0.01, windStrength * 0.72);
            updateWindUI();
        }

        blocks.push(currentBlock);
        spawnPerfectWave(currentBlock.position.x, currentBlock.position.y, currentBlock.position.z, currentBlock.userData.w, currentBlock.userData.d, prevColor);
        playSound('perfect', combo);
        triggerHaptic('medium');
        showPopup(perfectText, combo > 1 ? `ИДЕАЛЬНО x${combo}` : 'ИДЕАЛЬНО!', 750);

        stats.totalPerfect = (stats.totalPerfect || 0) + 1;
        updateQuest('perfect', 1);
        updateQuest('combo', combo, true);
        updateMissionProgress(missions, 'perfect', 1);
        updateMissionProgress(missions, 'combo', combo, true);
    } else {
        combo = 0;
        if (isFury) {
            isFury = false;
            furyBlocksLeft = 0;
            document.body.classList.remove('fury-active');
        }

        const newW = movingAxis === 'x' ? sizeX - absDiffX : sizeX;
        const newD = movingAxis === 'z' ? sizeZ - absDiffZ : sizeZ;

        if (newW < 0.08 || newD < 0.08) {
            currentBlock.userData.falling = true;
            if (canOfferSecondChance()) { offerSecondChance('miss'); return; }
            triggerGameOver();
            return;
        }

        const origSize = movingAxis === 'x' ? sizeX : sizeZ;
        const newSize = movingAxis === 'x' ? newW : newD;
        const diff = movingAxis === 'x' ? diffX : diffZ;
        createDebris(diff, origSize, newSize, movingAxis, top);

        const finalW = gameMode === GAME_MODES.ENDLESS ? Math.min(currentBaseSize, newW + (sizeX - newW) * 0.35) : newW;
        const finalD = gameMode === GAME_MODES.ENDLESS ? Math.min(currentBaseSize, newD + (sizeZ - newD) * 0.35) : newD;

        const newX = movingAxis === 'x' ? top.position.x + diffX / 2 : currentBlock.position.x;
        const newZ = movingAxis === 'z' ? top.position.z + diffZ / 2 : currentBlock.position.z;
        const posY = currentBlock.position.y;

        disposeMesh(currentBlock);
        const nm = createBlockMesh(finalW, BLOCK_HEIGHT, finalD, prevColor, BLOCK_TYPES.NORMAL);
        nm.position.set(newX, posY, newZ);
        Object.assign(nm.userData, { w: finalW, d: finalD, color: prevColor, blockType: BLOCK_TYPES.NORMAL, squash: 0 });
        scene.add(nm);
        blocks.push(nm);
        currentBlock = nm;

        if (bType === BLOCK_TYPES.BOMB) {
            basePoints = -1;
            playSound('bomb');
            spawnBombParticles();
            triggerHaptic('error');
            showPopup(bonusText, '💥 ВЗРЫВ! -1', 900);
        } else {
            playSound('drop');
            triggerHaptic('light');
            shakeIntensity = Math.max(shakeIntensity, 0.14);
            addCoins(1);
        }

        updateQuest('cut', 1);
    }

    // Расчёт очков
    let pointsGain = basePoints;
    if (pointsGain > 0) {
        pointsGain = applyComboMultiplier(pointsGain, combo);
        if (combo >= 2 && upg.comboScoreMult > 0) pointsGain *= (1 + upg.comboScoreMult);
        if (isFury) pointsGain *= 2;
        if (dailyModifiers.scoreMult) pointsGain *= dailyModifiers.scoreMult;
        if (skinMods.scoreMult) pointsGain *= skinMods.scoreMult;
        if (prestigeBonus.scoreMult > 0) pointsGain *= (1 + prestigeBonus.scoreMult);
        if (prestigeBonus.allMult > 0) pointsGain *= (1 + prestigeBonus.allMult);
        pointsGain = Math.max(1, Math.round(pointsGain));
    }

    const prevScore = score;
    score = Math.max(0, score + pointsGain);
    if (scoreEl) {
        scoreEl.innerText = score;
        scoreEl.classList.remove('score-pop');
        requestAnimationFrame(() => scoreEl.classList.add('score-pop'));
    }

    // Пробитие 3D-линии рекорда
    if (!recordLinePassed && recordLineGroup && (score > highScore || (blocks.length - 1) > bestHeight)) {
        recordLinePassed = true;
        if (recordLineGroup.userData?.ringMat) {
            recordLineGroup.userData.ringMat.color.setHex(0x00E676);
            recordLineGroup.userData.ringMat.opacity = 0.45;
        }
        playSound('record_break');
        spawnConfetti(28, recordLineGroup.position);
        showPopup(milestoneText, '👑 РЕКОРД ПОБИТ!', 1500);
        triggerHaptic('success');
    }

    if (isFury) {
        furyBlocksLeft--;
        if (furyBlocksLeft <= 0) {
            isFury = false;
            document.body.classList.remove('fury-active');
        }
    }

    if (Math.floor(score / 10) > Math.floor(prevScore / 10) && score >= 10) {
        triggerMilestone(Math.floor(score / 10) * 10);
    }

    updateComboIndicator();
    updateQuest('stack', blocks.length - 1, true);
    updateMissionProgress(missions, 'blocks', 1);

    if (blocks.length > 32) {
        blocks[blocks.length - 33].visible = false;
    }

    let accel = GAME_CONFIG.SPEED_INCREMENT * (dailyModifiers.accelMult || 1);
    if (gameMode === GAME_MODES.ENDLESS) accel *= 2;
    currentSpeed = Math.min(dynamicMaxSpeed, currentSpeed + accel);
    musicTempo = Math.min(155, GAME_CONFIG.MUSIC_BASE_TEMPO + score * 0.45);

    direction *= -1;
    spawnNewBlock();
}

// ============ НАВИГАЦИЯ И ПАУЗА ============
function togglePause() {
    if (gameState === GAME_STATES.PLAYING) {
        gameState = GAME_STATES.PAUSED;
        document.body.classList.remove('in-game');
        stopMusic();
        showModal(pauseScreen);
    } else if (gameState === GAME_STATES.PAUSED && pauseScreen.classList.contains('open')) {
        hideModal(pauseScreen, { restoreMenu: false });
        gameState = GAME_STATES.PLAYING;
        document.body.classList.add('in-game');
        clock.getDelta();
        startMusic();
        updateTelegramBackButton();
    }
}

function goToMenu() {
    clearGameOverTimers();
    if (secondChanceRaf) { cancelAnimationFrame(secondChanceRaf); secondChanceRaf = null; }
    if (resumeDelayTimer) { clearTimeout(resumeDelayTimer); resumeDelayTimer = null; }
    if (timeAttackTimer) { clearInterval(timeAttackTimer); timeAttackTimer = null; }

    gameState = GAME_STATES.MENU;
    secondChanceActive = false;
    overviewActive = false;
    overviewSkipped = false;
    cameraZoomPulse = 0;
    document.body.classList.remove('in-game', 'fury-active');

    stopMusic();
    stopWindSystem();
    hideTowerHeightBanner();
    restoreDailyVisuals();
    dailyChallengeActive = false;
    dailyModifiers = {};

    document.querySelectorAll('.screen.modal.open').forEach(m => {
        m.classList.remove('open');
        updateAriaAttributes(m, false);
    });

    clearScene();
    clearBlockMaterialCache();
    clearTextureCache();
    stopRenderLoop();

    const bgColors = getBgColors();
    document.body.style.background = bgColors[0];
    syncTelegramTheme('#FFE5EC');

    startScreen.style.display = 'flex';
    updateCoinUI();
    updateLevelUI();
    updateChestUI();
    updateWheelUI();
    updateMissionsBadge();
    renderDailyChallenge();
    if (currentMenuTab === 'shop') renderShop();
    if (currentMenuTab === 'tasks') renderMissions();
    updateTelegramBackButton();
}

// ============ КАМЕРА И ЦИКЛ РЕНДЕРА ============
function updateCamera(dt = 1) {
    if (!camera) return;

    if (overviewActive) {
        camera.position.y += ((overviewTargetY + 12) - camera.position.y) * Math.min(1, 0.08 * dt);
        camera.zoom += (overviewTargetZoom - camera.zoom) * Math.min(1, 0.08 * dt);
        camera.lookAt(0, overviewTargetY, 0);
        camera.updateProjectionMatrix();
        return;
    }

    const targetY = blocks.length > 0 ? blocks[blocks.length - 1].position.y : 0;
    camera.position.y += ((targetY + 12) - camera.position.y) * Math.min(1, 0.1 * dt);
    camera.lookAt(0, targetY, 0);

    if (cameraZoomPulse > 0.0005 || Math.abs(camera.zoom - 1) > 0.0005) {
        cameraZoomPulse *= Math.pow(0.84, dt);
        if (cameraZoomPulse < 0.0005) cameraZoomPulse = 0;
        const targetZoom = 1 + cameraZoomPulse;
        camera.zoom += (targetZoom - camera.zoom) * Math.min(1, 0.28 * dt);
        camera.updateProjectionMatrix();
    }

    if (shakeIntensity > 0.01) {
        camera.position.x = 12 + (Math.random() - 0.5) * shakeIntensity;
        camera.position.z = 12 + (Math.random() - 0.5) * shakeIntensity;
        shakeIntensity *= Math.pow(0.85, dt);
    } else {
        camera.position.x = 12;
        camera.position.z = 12;
        shakeIntensity = 0;
    }
}

function startRenderLoop() {
    if (rafId !== null) return;
    clock.getDelta();
    rafId = requestAnimationFrame(animate);
}

function stopRenderLoop() {
    if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
    }
}

function animate() {
    if (document.hidden || (gameState === GAME_STATES.MENU && startScreen && startScreen.style.display !== 'none')) {
        rafId = null;
        return;
    }
    rafId = requestAnimationFrame(animate);

    const rawDelta = clock.getDelta();
    const dt = Math.min(rawDelta * 60, 2.5);

    updateFpsCounter();
    const now = performance.now();
    if (now - lastPerfCheck > 2000) {
        lastPerfCheck = now;
        const fps = getCurrentFps();
        if (fps > 0 && fps < 34) {
            lowFpsStrikes++;
            if (lowFpsStrikes >= 2 && !lowPerfMode) {
                lowPerfMode = true;
                removeEnvironmentParticles(scene);
                disposeAtmosphereLayers(scene);
                renderer.setPixelRatio(1);
            }
        } else {
            lowFpsStrikes = 0;
        }
    }

    if (scene && scene.background) {
        scene.background.lerp(targetBgColor, Math.min(1, 0.03 * dt));
    }

    if (gameState === GAME_STATES.PLAYING && currentBlock && currentBlock.userData.moving) {
        let speed = currentSpeed;
        if (currentBlock.userData.blockType === BLOCK_TYPES.ICE) speed *= 1.45;
        if (isFury) speed *= 0.6;

        const step = speed * direction * dt;
        const windPush = (gameMode === GAME_MODES.STORM ? windStrength * windDirection * dt : 0);

        if (movingAxis === 'x') {
            currentBlock.position.x += step + windPush;
            if (currentBlock.position.x > GAME_CONFIG.MOVE_RANGE) {
                currentBlock.position.x = GAME_CONFIG.MOVE_RANGE;
                direction = -1;
            } else if (currentBlock.position.x < -GAME_CONFIG.MOVE_RANGE) {
                currentBlock.position.x = -GAME_CONFIG.MOVE_RANGE;
                direction = 1;
            }
        } else {
            currentBlock.position.z += step + windPush;
            if (currentBlock.position.z > GAME_CONFIG.MOVE_RANGE) {
                currentBlock.position.z = GAME_CONFIG.MOVE_RANGE;
                direction = -1;
            } else if (currentBlock.position.z < -GAME_CONFIG.MOVE_RANGE) {
                currentBlock.position.z = -GAME_CONFIG.MOVE_RANGE;
                direction = 1;
            }
        }
    }

    if (currentBlock && currentBlock.userData.falling) {
        currentBlock.position.y -= 0.32 * dt;
        currentBlock.rotation.x += 0.06 * dt;
        currentBlock.rotation.z += 0.04 * dt;
    }

    for (let i = Math.max(0, blocks.length - 5); i < blocks.length; i++) {
        const b = blocks[i];
        if (b.userData.squash !== undefined && b.userData.squash < 1) {
            b.userData.squash += 0.1 * dt;
            if (b.userData.squash > 1) b.userData.squash = 1;
            const scaleY = 1 - Math.sin(b.userData.squash * Math.PI) * 0.3;
            const scaleXZ = 1 + Math.sin(b.userData.squash * Math.PI) * 0.15;
            b.scale.set(b.userData.w * scaleXZ, BLOCK_HEIGHT * scaleY, b.userData.d * scaleXZ);
        }
    }

    for (let i = debris.length - 1; i >= 0; i--) {
        const dMesh = debris[i];
        dMesh.userData.vel.y -= 0.018 * dt;
        dMesh.position.addScaledVector(dMesh.userData.vel, dt);
        dMesh.rotation.x += dMesh.userData.rotSpeed.x * dt;
        dMesh.rotation.y += dMesh.userData.rotSpeed.y * dt;
        dMesh.rotation.z += dMesh.userData.rotSpeed.z * dt;
        if (dMesh.position.y < camera.position.y - 28) {
            disposeMesh(dMesh);
            debris.splice(i, 1);
        }
    }

    for (let i = confetti.length - 1; i >= 0; i--) {
        const c = confetti[i];
        c.userData.vel.y -= 0.012 * dt;
        c.position.addScaledVector(c.userData.vel, dt);
        c.rotation.x += c.userData.rot.x * dt;
        c.rotation.y += c.userData.rot.y * dt;
        c.userData.life -= 0.016 * dt;
        if (c.userData.life <= 0) {
            disposeMesh(c);
            confetti.splice(i, 1);
        }
    }

    for (let i = perfectWaves.length - 1; i >= 0; i--) {
        const w = perfectWaves[i];
        w.userData.age += 0.055 * dt;
        const t = w.userData.age;
        w.scale.set(w.userData.baseW * (1.05 + t * 0.75), w.userData.baseD * (1.05 + t * 0.75), 1);
        w.material.opacity = Math.max(0, 0.9 * (1 - t));
        if (t >= 1) {
            w.material.dispose();
            scene.remove(w);
            perfectWaves.splice(i, 1);
        }
    }

    if (recordLineGroup && !recordLinePassed && recordLineGroup.userData?.sprite) {
        recordLineGroup.userData.sprite.position.y = 0.45 + Math.sin(now * 0.004) * 0.16;
    }

    if (!lowPerfMode) {
        updateEnvironmentParticles(rawDelta);
        updateAtmosphereLayers(rawDelta, Math.max(0, blocks.length - 1), BLOCK_HEIGHT);
    }

    updateCamera(dt);
    renderer.render(scene, camera);
}

// ============ RESIZE & INPUT ============
const onResize = throttle(() => {
    if (!camera || !renderer) return;
    const aspect = window.innerWidth / window.innerHeight;
    const d = getAdaptiveD(aspect);
    camera.left = -d * aspect;
    camera.right = d * aspect;
    camera.top = d;
    camera.bottom = -d;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    cacheCoinPopupAnchor();
    if (gameState === GAME_STATES.MENU) renderer.render(scene, camera);
}, 120);

window.addEventListener('resize', onResize);

function handleInput(e) {
    const target = e.target;
    if (target && target.closest && target.closest('button, .mode-btn, .mini-mode-btn, #top-right-controls, .modal, .powerup-item, .daily-challenge-banner, .lb-mode-tab, .event-banner, .ach-tab')) return;
    if (target && target.closest && target.closest('#start-screen, #game-over, #second-chance-overlay, #pause-screen, #rules-screen, #achievements-screen, #leaderboard-screen, #settings-screen, #daily-screen, #powerups-screen, #chest-screen, #prestige-confirm-screen, #prestige-chest-screen, #event-screen, #minigames-screen, #wheel-screen')) return;
    if (isAnyModalOpen()) return;
    if (gameState === GAME_STATES.PLAYING) {
        if (e.type === 'touchstart') e.preventDefault();
        dropBlock();
    } else if (gameState === GAME_STATES.GAMEOVER && overviewActive) {
        if (e.type === 'touchstart') e.preventDefault();
        skipTowerOverview();
    }
}

window.addEventListener('touchstart', handleInput, { passive: false });
window.addEventListener('mousedown', handleInput);

window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'Enter') {
        if (gameState === GAME_STATES.PLAYING && !isAnyModalOpen()) {
            e.preventDefault();
            dropBlock();
        } else if (gameState === GAME_STATES.GAMEOVER && !isAnyModalOpen() && overviewActive) {
            e.preventDefault();
            skipTowerOverview();
        } else if (gameState === GAME_STATES.GAMEOVER && gameOverEl && gameOverEl.classList.contains('open')) {
            e.preventDefault();
            activePowerups = { ...DEFAULTS.ACTIVE_POWERUPS };
            hideModal(gameOverEl, { restoreMenu: false });
            startGame();
        }
    } else if (e.code === 'KeyP' || e.code === 'Escape') {
        if (gameState === GAME_STATES.PLAYING || (gameState === GAME_STATES.PAUSED && pauseScreen.classList.contains('open'))) {
            e.preventDefault();
            togglePause();
        }
    }
});

document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        stopRenderLoop();
        if (gameState === GAME_STATES.PLAYING) togglePause();
        flushCloudSave();
    } else {
        if (gameState !== GAME_STATES.MENU) startRenderLoop();
    }
});

window.addEventListener('pagehide', () => { flushCloudSave(); });

// ============ ПРИВЯЗКА КНОПОК ============
function shareChallenge() {
    const text = `Я построил башню высотой ${score} в «Башне хайпа»! 🏗️ Сможешь побить мой рекорд?`;
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(TELEGRAM_APP_URL)}&text=${encodeURIComponent(text)}`;
    try {
        if (tg && typeof tg.openTelegramLink === 'function') {
            tg.openTelegramLink(shareUrl);
        } else if (navigator.share) {
            navigator.share({ title: 'Башня хайпа', text, url: TELEGRAM_APP_URL }).catch(() => {});
        } else {
            window.open(shareUrl, '_blank');
        }
    } catch (e) {}
}

function bindEvents() {
    // Навигация по 4 вкладкам
    document.querySelectorAll('.nav-tab-btn').forEach(btn => {
        safeClick(btn, () => switchMenuTab(btn.dataset.menuTab));
    });

    // Вкладки магазина
    document.querySelectorAll('.shop-tab').forEach(tab => {
        safeClick(tab, () => switchShopTab(tab.dataset.tab));
    });

    // Вкладки таблицы рекордов
    document.querySelectorAll('.lb-mode-tab').forEach(tab => {
        safeClick(tab, () => {
            currentLbMode = tab.dataset.mode;
            renderLeaderboard();
        });
    });

    // Вкладки достижений
    document.querySelectorAll('.ach-tab').forEach(tab => {
        safeClick(tab, () => {
            currentAchCategory = tab.dataset.achCat;
            renderAchievements();
        });
    });

    // Режимы игры
    safeClick($('btn-classic'), () => showPowerupSelection(GAME_MODES.CLASSIC));
    safeClick($('btn-time'), () => showPowerupSelection(GAME_MODES.TIME));
    document.querySelectorAll('.mini-mode-btn').forEach(btn => {
        safeClick(btn, () => {
            activePowerups = { ...DEFAULTS.ACTIVE_POWERUPS };
            startGame(btn.dataset.mode);
        });
    });
    safeClick(dailyPlayBtn, startDailyChallenge);

    // Игровые контролы
    safeClick(pauseBtn, togglePause);
    safeClick(menuToggleBtn, goToMenu);
    safeClick(muteBtn, () => {
        const turnOn = !(settings.musicEnabled || settings.sfxEnabled);
        settings.musicEnabled = turnOn;
        settings.sfxEnabled = turnOn;
        saveSettings();
        updateSettingsUI();
        if (turnOn && gameState === GAME_STATES.PLAYING) startMusic();
        else stopMusic();
    });

    // Game Over & Второй шанс & Пауза
    safeClick(restartPowerupsBtn, restartWithSamePowerups);
    safeClick($('restart-btn'), () => {
        activePowerups = { ...DEFAULTS.ACTIVE_POWERUPS };
        hideModal(gameOverEl, { restoreMenu: false });
        startGame();
    });
    safeClick($('menu-btn'), goToMenu);
    safeClick($('challenge-btn'), shareChallenge);
    safeClick(secondChanceBuyBtn, acceptSecondChance);
    safeClick(secondChanceSkipBtn, declineSecondChance);
    safeClick($('pause-resume'), togglePause);
    safeClick($('pause-menu'), goToMenu);

    // Способности
    safeClick($('start-with-powerups'), startGameWithPowerups);
    safeClick($('close-powerups'), () => {
        pendingGameMode = null;
        hideModal(powerupsScreen);
    });

    // Профиль и модалки
    safeClick($('ach-btn'), () => { renderAchievements(); showModal(achScreen); });
    safeClick($('close-achievements'), () => hideModal(achScreen));

    safeClick($('lb-btn'), () => { renderLeaderboard(); showModal(lbScreen); });
    safeClick($('close-leaderboard'), () => hideModal(lbScreen));

    safeClick($('rules-btn'), () => showModal(rulesScreen));
    safeClick($('close-rules'), () => hideModal(rulesScreen));

    safeClick($('settings-btn'), () => { updateSettingsUI(); showModal(settingsScreen); });
    safeClick($('close-settings'), () => hideModal(settingsScreen));

    safeClick($('toggle-music'), () => {
        settings.musicEnabled = !settings.musicEnabled;
        saveSettings();
        updateSettingsUI();
        if (!settings.musicEnabled) stopMusic();
    });
    safeClick($('toggle-sfx'), () => {
        settings.sfxEnabled = !settings.sfxEnabled;
        saveSettings();
        updateSettingsUI();
    });
    safeClick($('toggle-haptics'), () => {
        settings.hapticsEnabled = !settings.hapticsEnabled;
        saveSettings();
        updateSettingsUI();
        if (settings.hapticsEnabled) triggerHaptic('light');
    });
    safeClick($('cloud-sync-btn'), async () => {
        const statusEl = $('cloud-sync-status');
        if (statusEl) statusEl.textContent = 'Синхронизация...';
        await flushCloudSave();
        updateCloudStatusUI();
        triggerHaptic('success');
    });

    // Ежедневная награда
    safeClick($('claim-daily'), () => {
        if (dailyRewardPending) {
            dailyRewardPending = false;
            addCoins(dailyRewardAmount);
            playSound('quest');
            triggerHaptic('success');
        }
        hideModal(dailyScreen);
    });

    // Сундуки
    safeClick($('chest-btn'), showChestOpening);
    safeClick($('open-chest-btn'), openChest);
    safeClick($('close-chest'), () => hideModal(chestScreen));

    // Престиж
    safeClick(prestigeActivateBtnEl, showPrestigeConfirm);
    safeClick(prestigeConfirmBtn, activatePrestige);
    safeClick(prestigeCancelBtn, () => hideModal(prestigeConfirmScreen));
    safeClick(openPrestigeChestBtn, openPrestigeChest);
    safeClick(closePrestigeChestBtn, () => hideModal(prestigeChestScreen));

    // События
    safeClick(eventBannerEl, showEventDetails);
    safeClick($('close-event'), () => hideModal(eventScreen));

    // Реролл миссий дня
    safeClick(rerollMissionsBtn, handleRerollMissions);

    // Колесо удачи
    safeClick($('wheel-btn'), openWheelModal);
    safeClick($('close-wheel'), closeWheelModal);
    safeClick(wheelSpinBtn, () => {
        if (!wheelController || wheelController.isSpinning() || !canSpinWheel()) return;
        wheelSpinBtn.disabled = true;
        wheelSpinBtn.textContent = 'КРУТИТСЯ...';
        wheelController.spin();
    });

    // Мини-игры
    safeClick($('minigames-btn'), () => {
        renderMinigamesList();
        showModal(minigamesScreen);
        startMinigamesCooldownTimer();
    });
    safeClick($('close-minigames'), () => {
        stopActiveMinigame();
        stopMinigamesCooldownTimer();
        hideModal(minigamesScreen);
    });
}

// ============ INIT ============
function init() {
    initThree();
    loadUpgrades();
    bindEvents();
    initSeason();
    loadQuests();
    initMissions();
    initEvents();
    checkDailyStreak();
    renderDailyChallenge();
    updateCoinUI();
    updateLevelUI();
    updateStreakUI();
    updateChestUI();
    updateWheelUI();
    updateSettingsUI();
    normalizeFontSizes();
    syncTelegramTheme('#FFE5EC');

    if (renderer && scene && camera) {
        renderer.render(scene, camera);
    }

    if (splashScreen) {
        requestAnimationFrame(() => {
            splashScreen.classList.add('splash-hidden');
            setTimeout(() => splashScreen.remove(), 450);
        });
    }

    if (dailyRewardPending) {
        setTimeout(showDailyReward, 450);
    }

    initCloudSync(() => {
        reloadFromLocalAfterCloudMerge();
        updateCloudStatusUI();
    }).then(() => updateCloudStatusUI());
}

init();
