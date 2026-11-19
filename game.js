import * as THREE from 'three';

// ============ ИМПОРТЫ МОДУЛЕЙ ============
import {
    safeGetItem, safeSetItem, safeParseInt,
    PARTICLE_LIMITS, enforceParticleLimits,
    showModalSafe, hideModalSafe, isAnyModalOpen,
    setupGlobalErrorHandler,
    validateArray, validateObject
} from './utils.js';

import {
    GAME_CONFIG, LIMITS, GAME_MODES, GAME_MODE_NAMES,
    BLOCK_TYPES, BLOCK_COLORS, BLOCK_GLOW_COLORS,
    STORAGE_KEYS, DEFAULTS,
    xpForNextLevel, getAdaptiveD,
    CONFETTI_COLORS, MILESTONE_COLORS, LEAD_NOTES, FEATURE_NAMES
} from './constants.js';

import {
    getComboTier, getNextComboTier, applyComboMultiplier,
    checkTierUpgrade, formatComboDisplay
} from './combo-system.js';

import {
    applyTransition, getTransitionForScreen, staggerElements, flashTransition
} from './transitions.js';

import {
    loadMissions, updateMissionProgress, claimMissionReward,
    getMissionsStats, formatMissionReward, getMissionProgress
} from './missions.js';

import {
    getPrestigeCount, getPrestigeBonus, setPrestigeBonus,
    canPrestige, getPrestigeProgress, performPrestige, resetProgressForPrestige,
    rollPrestigeChestReward, applyPrestigeReward, formatPrestigeBonus,
    PRESTIGE_SKINS, PRESTIGE_CONFIG,
    checkNewMilestones, getNextMilestone
} from './prestige.js';

import {
    getCachedTexture, clearTextureCache,
    throttle, updateDOMText, updateDOMStyle, updateDOMClass,
    updateFpsCounter
} from './performance.js';

import {
    saveLastFocus, restoreLastFocus, trapFocus, releaseFocusTrap,
    setupEscapeKeyHandler, removeEscapeKeyHandler,
    updateAriaAttributes, announceToScreenReader,
    addDecorativeStars, normalizeFontSizes, animateElementsSequentially,
    addCloseButtonToModal
} from './accessibility.js';

// Активируем глобальный обработчик ошибок
setupGlobalErrorHandler();

// ============ TELEGRAM & HAPTICS ============
const tg = window.Telegram?.WebApp;
if (tg) {
    try {
        tg.ready(); tg.expand();
        if (tg.isVersionAtLeast('7.7')) tg.disableVerticalSwipes();
        tg.onEvent('viewportChanged', () => { if (typeof onResize === 'function') onResize(); });
    } catch (err) {}
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
        if (e.cancelable !== false) e.stopPropagation();
        try { handler(e); } catch(err) { console.error('Handler:', err); }
    };
    el.addEventListener('click', wrapped);
}

// ============ ХЕЛПЕРЫ МОДАЛОК (с переходами) ============
async function showModal(el) {
    if (!el) return;
    saveLastFocus();
    
    const screenId = el.id;
    const transitionType = getTransitionForScreen(screenId);
    
    el.classList.add('open');
    await applyTransition(el, transitionType, 'in');
    
    updateAriaAttributes(el, true);
    
    const modalContent = el.querySelector('.modal-content');
    if (modalContent) {
        trapFocus(modalContent);
        addCloseButtonToModal(modalContent, () => hideModal(el));
        
        const animatableElements = modalContent.querySelectorAll(
            '.ach-item, .skin-item, .customize-item, .powerup-item, .lb-attempt, .quest-chip, .mission-item'
        );
        if (animatableElements.length > 0 && animatableElements.length < 30) {
            staggerElements(animatableElements, 40);
        }
    }
    
    setupEscapeKeyHandler(el, () => hideModal(el));
    
    const title = el.querySelector('h1, h2');
    if (title) announceToScreenReader(`Открыто: ${title.textContent}`);
    
    if (el.id === 'chest-screen' || el.id === 'daily-screen' || el.id === 'prestige-confirm-screen') {
        const content = el.querySelector('.modal-content');
        if (content) addDecorativeStars(content, 15);
    }
    
    playSound('screen_transition');
}

async function hideModal(el) {
    if (!el) return;
    
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
}

// ============ КОНТЕНТ ============
const BASE_COLORS = ['#FF1744', '#F50057', '#D500F9', '#651FFF', '#2979FF', '#00B0FF', '#00E5FF', '#1DE9B6', '#00E676', '#FFEA00', '#FF9100', '#FF3D00'];

const SKINS = {
    default: { name: 'Классика', price: 0, colors: BASE_COLORS },
    food: { name: 'Еда', price: 80, colors: ['#FF5722','#FF9800','#FFC107','#E64A19','#FF6F00','#D84315','#F57C00'] },
    cats: { name: 'Котики', price: 120, colors: ['#FF4081','#F06292','#E91E63','#C2185B','#AB47BC','#CE93D8'] },
    animals: { name: 'Звери', price: 180, colors: ['#8D6E63','#6D4C41','#795548','#5D4037','#8BC34A','#689F38','#558B2F'] },
    space: { name: 'Космос', price: 250, colors: ['#1A237E','#283593','#311B92','#4527A0','#512DA8','#01579B','#0D47A1'] },
    ocean: { name: 'Океан', price: 320, colors: ['#0288D1','#0277BD','#01579B','#006064','#00838F','#0097A7','#26C6DA'] },
    retro: { name: 'Ретро 8-бит', price: 400, colors: ['#00C853','#00B248','#00897B','#00BFA5','#76FF03','#AA00FF'] },
    neon: { name: 'Неон', price: 500, colors: ['#E91E63','#9C27B0','#3F51B5','#00BCD4','#8BC34A','#FFEB3B','#FF4081','#00E5FF'] },
    ice: { name: 'Лёд', price: 200, colors: ['#81D4FA','#4FC3F7','#29B6F6','#03A9F4','#039BE5','#0288D1'], modifiers: { speedMult: 1.3, coinMult: 1.2 } },
    stone: { name: 'Камень', price: 200, colors: ['#757575','#616161','#424242','#546E7A','#455A64','#37474F'], modifiers: { speedMult: 0.85, scoreMult: 1.2 } },
    fire: { name: 'Огонь', price: 250, colors: ['#FF5722','#FF3D00','#E64A19','#F4511E','#D84315','#BF360C'], modifiers: { fireChance: 0.05 } },
    legend: { name: 'Легенда', price: 999999, notBuyable: true, colors: ['#FFD700','#FFA000','#FF6F00','#F57C00','#FFEB3B','#FFC107'] },
    // Престиж-скины (добавляются из prestige.js)
    ...PRESTIGE_SKINS,
};

const PALETTES = {
    standard: { name: 'Классика', price: 0, colors: BASE_COLORS },
    pastel: { name: 'Пастель', price: 50, colors: ['#FFB3BA', '#FFDFBA', '#FFFFBA', '#BAFFC9', '#BAE1FF', '#E0BBE4', '#FFC8DD', '#CDEAC0'] },
    neon: { name: 'Неон', price: 80, colors: ['#FF0080', '#FF8C00', '#FFD700', '#00FF88', '#00D4FF', '#0080FF', '#8B00FF', '#FF00FF'] },
    dark: { name: 'Тёмная', price: 100, colors: ['#212121', '#424242', '#616161', '#1A237E', '#283593', '#4A148C', '#311B92', '#004D40'] },
    rainbow: { name: 'Радуга', price: 150, colors: ['#FF0000', '#FF7F00', '#FFFF00', '#00FF00', '#0000FF', '#4B0082', '#9400D3', '#FF1493'] },
    sunset: { name: 'Закат', price: 90, colors: ['#FF6B6B', '#FF8A65', '#FFB74D', '#FFD54F', '#FFA726', '#F4511E', '#D84315', '#FF7043'] },
    forest: { name: 'Лес', price: 70, colors: ['#2E7D32', '#388E3C', '#43A047', '#4CAF50', '#66BB6A', '#81C784', '#A5D6A7', '#1B5E20'] },
    candy: { name: 'Конфета', price: 110, colors: ['#F48FB1', '#F06292', '#BA68C8', '#CE93D8', '#E1BEE7', '#F8BBD0', '#FCE4EC', '#FFCDD2'] },
    mono: { name: 'Монохром', price: 60, colors: ['#F5F5F5', '#E0E0E0', '#BDBDBD', '#9E9E9E', '#757575', '#616161', '#424242', '#212121'] },
    cyber: { name: 'Кибер', price: 130, colors: ['#00E5FF', '#00B8D4', '#0091EA', '#6200EA', '#AA00FF', '#D500F9', '#FF1744', '#F50057'] },
    winter: { name: 'Зима', price: 100, colors: ['#E1F5FE', '#B3E5FC', '#81D4FA', '#4FC3F7', '#29B6F6', '#03A9F4', '#0288D1', '#01579B'] },
    fire_pal: { name: 'Пламя', price: 120, colors: ['#FFEB3B', '#FFC107', '#FF9800', '#FF5722', '#F44336', '#E91E63', '#C2185B', '#880E4F'] },
    galaxy: { name: 'Галактика', price: 160, colors: ['#311B92', '#4527A0', '#512DA8', '#5E35B1', '#7B1FA2', '#8E24AA', '#9C27B0', '#4A148C'] },
};

const BACKGROUNDS = {
    default: { name: 'Стандарт', price: 0, colors: ['#FDE2E4', '#E2ECE9', '#D0E6F9', '#F9E2D0', '#2B2D42'] },
    night: { name: 'Ночь', price: 100, colors: ['#0F172A', '#1E293B', '#1E1B4B', '#312E81', '#020617'], stars: true },
    sunset: { name: 'Закат', price: 80, colors: ['#FFB88C', '#FF9A8B', '#FF6B6B', '#FFD5A0', '#6A1B9A'] },
    ocean: { name: 'Океан', price: 120, colors: ['#87CEEB', '#4A90E2', '#2E5C8A', '#1E3A5F', '#0A1E3F'] },
    city: { name: 'Город', price: 150, colors: ['#B0B0C0', '#9090A0', '#707080', '#505060', '#303040'] },
    space: { name: 'Космос', price: 200, colors: ['#0a0020', '#200040', '#300060', '#400080', '#050010'], stars: true },
    aurora: { name: 'Сияние', price: 180, colors: ['#0B3A5C', '#155E75', '#0E7490', '#4A1D96', '#1E1B4B'], stars: true },
    desert: { name: 'Пустыня', price: 90, colors: ['#FDE68A', '#FCD34D', '#F59E0B', '#B45309', '#78350F'] },
    forest: { name: 'Лес', price: 100, colors: ['#D9F99D', '#A3E635', '#65A30D', '#365314', '#1A2E05'] },
    snow: { name: 'Снега', price: 110, colors: ['#F0F9FF', '#E0F2FE', '#BAE6FD', '#7DD3FC', '#0C4A6E'] },
    lava: { name: 'Лава', price: 160, colors: ['#450A0A', '#7F1D1D', '#991B1B', '#B91C1C', '#1C0A0A'] },
    cyber: { name: 'Кибер', price: 170, colors: ['#0A0118', '#1E1B4B', '#4C1D95', '#7C3AED', '#2E1065'], stars: true },
    sakura: { name: 'Сакура', price: 130, colors: ['#FDF2F8', '#FCE7F3', '#FBCFE8', '#F9A8D4', '#BE185D'] },
};

const SEASONS = [
    { months: [12, 1, 2], name: 'Зима', icon: '❄️', coinMult: 1.2, xpMult: 1.0 },
    { months: [3, 4, 5], name: 'Весна', icon: '🌸', coinMult: 1.0, xpMult: 1.15 },
    { months: [6, 7, 8], name: 'Лето', icon: '☀️', coinMult: 1.1, xpMult: 1.1 },
    { months: [9, 10, 11], name: 'Осень', icon: '🍂', coinMult: 1.15, xpMult: 1.0 },
];

// ============ 50 ЧЕЛЛЕНДЖЕЙ ДНЯ ============
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
    { id: 'diag_fast', name: 'Диагональ+', desc: 'Диагональ + быстро', icon: '📐', modifiers: { diagFromStart: true, speedMult: 1.3 } },
    { id: 'ice_skate', name: 'Скольжение', desc: 'Все блоки как лёд', icon: '⛸️', modifiers: { allIce: true } },
    { id: 'tight_perfect', name: 'Строгий идеал', desc: 'Идеал 0.05 вместо 0.15', icon: '🔍', modifiers: { tightThreshold: 0.05 } },
    { id: 'ultra_soft', name: 'Прощает', desc: 'Идеал 0.4 (легче)', icon: '🎈', modifiers: { tightThreshold: 0.4 } },
    { id: 'night_mode', name: 'Ночной', desc: 'Тёмный фон', icon: '🌙', modifiers: { forceBg: 'night' } },
    { id: 'rainbow_palace', name: 'Радужный', desc: 'Радужная палитра', icon: '🌈', modifiers: { forcePalette: 'rainbow' } },
    { id: 'speed_accel_x4', name: 'Гипер-разгон', desc: 'Ускорение x4', icon: '🚀', modifiers: { accelMult: 4 } },
];

const POWERUP_DEFS = {
    magnet:     { icon: '🧲', name: 'Магнит',     desc: '1 блок встанет идеально', price: 50 },
    freeze:     { icon: '❄️', name: 'Заморозка',  desc: 'Медленно 10 секунд',      price: 30 },
    ghost:      { icon: '👻', name: 'Призрак',    desc: 'Прощает 1 промах',        price: 40 },
    multiplier: { icon: '💰', name: 'Множитель',  desc: 'x2 монет за игру',        price: 80 }
};

const ACHIEVEMENTS = [
    { id: 'first_tower', name: 'Первая башня', desc: 'Построй 5 этажей', icon: '🏗️', check: () => stats.maxScore >= 5 },
    { id: 'score_10', name: 'Новичок', desc: '10 очков в игре', icon: '🌱', check: () => stats.maxScore >= 10 },
    { id: 'score_25', name: 'Строитель', desc: '25 очков в игре', icon: '🏠', check: () => stats.maxScore >= 25 },
    { id: 'score_50', name: 'Мастер', desc: '50 очков в игре', icon: '🏰', check: () => stats.maxScore >= 50 },
    { id: 'score_100', name: 'Легенда', desc: '100 очков в игре', icon: '👑', check: () => stats.maxScore >= 100 },
    { id: 'combo_3', name: 'Мастер серий', desc: 'Серия x3', icon: '🔥', check: () => stats.maxCombo >= 3 },
    { id: 'combo_5', name: 'Огненный', desc: 'Серия x5', icon: '💥', check: () => stats.maxCombo >= 5 },
    { id: 'perfect_50', name: 'Снайпер', desc: '50 идеалов', icon: '🎯', check: () => stats.totalPerfect >= 50, reward: 50 },
    { id: 'perfect_200', name: 'Точность', desc: '200 идеалов → золотой след', icon: '🎪', check: () => stats.totalPerfect >= 200, reward: 200, feature: 'goldenTrail' },
    { id: 'games_10', name: 'Игрок', desc: '10 игр', icon: '🎮', check: () => stats.totalGames >= 10 },
    { id: 'games_50', name: 'Заядлый', desc: '50 игр', icon: '🎲', check: () => stats.totalGames >= 50 },
    { id: 'fury_1', name: 'В ярости', desc: 'Активируй ярость', icon: '😡', check: () => stats.totalFury >= 1 },
    { id: 'fury_10', name: 'Берсерк', desc: '10 яростей → красная тема', icon: '👹', check: () => stats.totalFury >= 10, reward: 150, feature: 'redTheme' },
    { id: 'golden_5', name: 'Король золота', desc: '5 идеальных золотых', icon: '💎', check: () => stats.totalGolden >= 5 },
    { id: 'bomb_5', name: 'Сапёр', desc: '5 идеальных бомб', icon: '💣', check: () => stats.totalBomb >= 5 },
    { id: 'ice_5', name: 'Ледокол', desc: '5 идеальных льдов', icon: '❄️', check: () => stats.totalIce >= 5 },
    { id: 'secret_1', name: 'Тайна', desc: 'Поймай секретный блок', icon: '🌟', check: () => stats.totalSecret >= 1 },
    { id: 'secret_10', name: 'Охотник', desc: '10 секретных блоков', icon: '🔮', check: () => stats.totalSecret >= 10 },
    { id: 'skins_3', name: 'Коллекционер', desc: '3 облика', icon: '🎨', check: () => unlockedSkins.length >= 3 },
    { id: 'skins_all', name: 'Все облики', desc: 'Собери все основные облики', icon: '🏆', reward: 500, special: 'legend', check: () => {
        const buyable = Object.keys(SKINS).filter(k => k !== 'legend' && !SKINS[k].notBuyable && !SKINS[k].prestigeOnly);
        return buyable.every(k => unlockedSkins.includes(k));
    }},
    { id: 'rich_500', name: 'Богач', desc: '500 монет', icon: '💰', check: () => coins >= 500 },
    { id: 'level_10', name: 'Ветеран', desc: '10 уровень', icon: '🌟', check: () => level >= 10 },
    { id: 'daily_1', name: 'Испытатель', desc: 'Пройди 1 испытание', icon: '🎯', check: () => stats.dailyCompleted >= 1 },
    { id: 'daily_10', name: 'Мастер испытаний', desc: 'Пройди 10 испытаний', icon: '🏹', check: () => stats.dailyCompleted >= 10, reward: 100 },
    { id: 'prestige_1', name: 'Перерождение', desc: 'Выполни 1 престиж', icon: '⭐', check: () => getPrestigeCount() >= 1, reward: 200 },
    { id: 'missions_10', name: 'Миссионер', desc: 'Выполни 10 миссий', icon: '🎯', check: () => stats.missionsCompleted >= 10, reward: 150 },
];

// ============ STATE ============
const BLOCK_SIZE = GAME_CONFIG.BLOCK_SIZE;
const BLOCK_HEIGHT = GAME_CONFIG.BLOCK_HEIGHT;
const BASE_SPEED = GAME_CONFIG.BASE_SPEED;

let dynamicMaxSpeed = GAME_CONFIG.DEFAULT_MAX_SPEED;
let scene, camera, renderer, musicGain, windGain;
let bgStarsGroup = null;
let blocks = [], debris = [], confetti = [];
let currentBlock, nextBlockData, direction = 1;
let score = 0, combo = 0;

// Безопасная инициализация состояния
let coins = safeParseInt(safeGetItem(STORAGE_KEYS.COINS, '0'), 0);
let sessionCoins = 0, sessionXP = 0;
let highScore = safeParseInt(safeGetItem(STORAGE_KEYS.HIGH_SCORE, '0'), 0);
let currentSkin = (typeof safeGetItem(STORAGE_KEYS.SKIN, 'default') === 'string') ? safeGetItem(STORAGE_KEYS.SKIN, 'default') : 'default';
let unlockedSkins = validateArray(safeGetItem(STORAGE_KEYS.SKINS, ['default']), ['default']);
let currentPalette = (typeof safeGetItem(STORAGE_KEYS.PALETTE, 'standard') === 'string') ? safeGetItem(STORAGE_KEYS.PALETTE, 'standard') : 'standard';
let unlockedPalettes = validateArray(safeGetItem(STORAGE_KEYS.PALETTES, ['standard']), ['standard']);
let currentBackground = (typeof safeGetItem(STORAGE_KEYS.BACKGROUND, 'default') === 'string') ? safeGetItem(STORAGE_KEYS.BACKGROUND, 'default') : 'default';
let unlockedBackgrounds = validateArray(safeGetItem(STORAGE_KEYS.BACKGROUNDS, ['default']), ['default']);
let unlockedFeatures = validateObject(safeGetItem(STORAGE_KEYS.FEATURES, {}), {});

let gameState = GAME_STATES.MENU, gameMode = GAME_MODES.CLASSIC;
let windStrength = 0, windDirection = 1, windGustTimer = null;
let movingAxis = 'x', currentSpeed = BASE_SPEED;
let currentBiomeIndex = 0, targetBgColor = new THREE.Color(BACKGROUNDS.default.colors[0]), shakeIntensity = 0;
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

const DEFAULT_SETTINGS = { ...DEFAULTS.SETTINGS };
const DEFAULT_STATS = { ...DEFAULTS.STATS, missionsCompleted: 0 };

let settings = { ...DEFAULT_SETTINGS, ...validateObject(safeGetItem(STORAGE_KEYS.SETTINGS, null), DEFAULT_SETTINGS) };
function saveSettings() { safeSetItem(STORAGE_KEYS.SETTINGS, settings); }

let stats = { ...DEFAULT_STATS, ...validateObject(safeGetItem(STORAGE_KEYS.STATS, null), DEFAULT_STATS) };
if (stats.missionsCompleted === undefined) stats.missionsCompleted = 0;
function saveStats() { safeSetItem(STORAGE_KEYS.STATS, stats); }

let totalScoreAllTime = safeParseInt(safeGetItem(STORAGE_KEYS.TOTAL_SCORE, '0'), 0);
function saveTotalScore() { safeSetItem(STORAGE_KEYS.TOTAL_SCORE, String(totalScoreAllTime)); }

let recentScores = validateArray(safeGetItem(STORAGE_KEYS.RECENT_SCORES, []), []);
function saveRecentScores() { safeSetItem(STORAGE_KEYS.RECENT_SCORES, recentScores); }

let unlockedAchievements = validateArray(safeGetItem(STORAGE_KEYS.ACHIEVEMENTS, []), []);
function saveAchievements() { safeSetItem(STORAGE_KEYS.ACHIEVEMENTS, unlockedAchievements); }

let xpTotal = safeParseInt(safeGetItem(STORAGE_KEYS.XP, '0'), 0);
let level = safeParseInt(safeGetItem(STORAGE_KEYS.LEVEL, '1'), 1);
function saveLevelProgress() {
    safeSetItem(STORAGE_KEYS.XP, String(xpTotal));
    safeSetItem(STORAGE_KEYS.LEVEL, String(level));
}

let streak = safeParseInt(safeGetItem(STORAGE_KEYS.STREAK, '0'), 0);
let lastVisitDate = safeGetItem(STORAGE_KEYS.LAST_VISIT, '') || '';
let dailyRewardPending = false, dailyRewardAmount = 0;
let leaderboard = validateArray(safeGetItem(STORAGE_KEYS.LEADERBOARD, []), []);
function saveLeaderboard() { safeSetItem(STORAGE_KEYS.LEADERBOARD, leaderboard); }

let ownedPowerups = validateObject(safeGetItem(STORAGE_KEYS.POWERUPS, null), { ...DEFAULTS.POWERUPS });
function savePowerups() { safeSetItem(STORAGE_KEYS.POWERUPS, ownedPowerups); }

let activePowerups = { ...DEFAULTS.ACTIVE_POWERUPS };
let magnetUsed = false, ghostUsed = false, freezeTimer = null, pendingGameMode = null;
let chests = validateArray(safeGetItem(STORAGE_KEYS.CHESTS, []), []);
function saveChests() { safeSetItem(STORAGE_KEYS.CHESTS, chests); }

let currentMusicPhase = 1;

// ============ МИССИИ (STATE) ============
let missions = [];
let missionsTimerInterval = null;

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
const scoreEl = $('score'), highScoreEl = $('high-score'), gameCoinsEl = $('game-coins');
const gameOverEl = $('game-over'), pauseScreen = $('pause-screen'), shopScreen = $('shop-screen');
const rulesScreen = $('rules-screen'), startScreen = $('start-screen');
const achScreen = $('achievements-screen'), lbScreen = $('leaderboard-screen');
const settingsScreen = $('settings-screen'), dailyScreen = $('daily-screen');
const powerupsScreen = $('powerups-screen'), chestScreen = $('chest-screen');
const missionsScreen = $('missions-screen');
const prestigeConfirmScreen = $('prestige-confirm-screen');
const prestigeChestScreen = $('prestige-chest-screen');
const perfectText = $('perfect-text'), comboText = $('combo-text'), milestoneText = $('milestone-text'), bonusText = $('bonus-text');
const levelupPopup = $('levelup-popup'), achievementPopup = $('achievement-popup');
const finalScoreVal = $('final-score-val'), gameCoinsEarnedEl = $('game-coins-earned'), gameXPEarnedEl = $('game-xp-earned');
const timerEl = $('timer'), modeLabel = $('mode-label');
const windIndicatorEl = $('wind-indicator'), windFillEl = $('wind-fill');
const questsEl = $('quests'), muteBtn = $('mute-btn'), pauseBtn = $('pause-btn'), menuToggleBtn = $('menu-toggle-btn');
const tutorialEl = $('tutorial');
const screenFlash = $('screen-flash'), coinsBalanceEl = $('coins-balance'), skinListEl = $('skin-list'), menuCoinsEl = $('menu-coins');
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

// Новые DOM-элементы
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

let pendingPrestigeRewards = [];

highScoreEl.innerText = `РЕКОРД: ${highScore}`;

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

// ============ МОНЕТЫ ============
function addCoins(amount) {
    if (amount <= 0) return;
    let mult = 1;
    if (activePowerups.multiplier && gameState === GAME_STATES.PLAYING) mult *= 2;
    if (dailyModifiers.coinMult) mult *= dailyModifiers.coinMult;
    const skinMods = getSkinModifiers();
    if (skinMods.coinMult) mult *= skinMods.coinMult;
    const season = getCurrentSeason();
    if (season.coinMult) mult *= season.coinMult;
    
    // Бонусы престижа
    const prestigeBonus = getPrestigeBonus();
    if (prestigeBonus.coinMult > 0) mult *= (1 + prestigeBonus.coinMult);
    if (prestigeBonus.allMult > 0) mult *= (1 + prestigeBonus.allMult);
    
    amount = Math.round(amount * mult);
    coins += amount; sessionCoins += amount;
    safeSetItem(STORAGE_KEYS.COINS, coins);
    updateCoinUI(); showCoinPopup(amount);
    updateMissionProgress(missions, 'coins', amount);
    
    gameCoinsEl.classList.remove('coin-pulse');
    void gameCoinsEl.offsetWidth;
    gameCoinsEl.classList.add('coin-pulse');
    
    announceToScreenReader(`Получено ${amount} монет`);
}

function showCoinPopup(amount) {
    const popup = document.createElement('div');
    popup.className = 'coin-popup';
    popup.textContent = `+${amount} 🪙`;
    const rect = gameCoinsEl.getBoundingClientRect();
    popup.style.left = (rect.left + rect.width / 2) + 'px';
    popup.style.top = (rect.bottom + 4) + 'px';
    document.body.appendChild(popup);
    setTimeout(() => popup.remove(), 900);
}

// ============ XP & LEVEL ============
function addXP(amount) {
    if (amount <= 0) return;
    let mult = 1;
    if (dailyModifiers.xpMult) mult *= dailyModifiers.xpMult;
    const season = getCurrentSeason();
    if (season.xpMult) mult *= season.xpMult;
    
    // Бонусы престижа
    const prestigeBonus = getPrestigeBonus();
    if (prestigeBonus.xpMult > 0) mult *= (1 + prestigeBonus.xpMult);
    if (prestigeBonus.allMult > 0) mult *= (1 + prestigeBonus.allMult);
    
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
    
    // Проверяем milestone-сундуки (каждые 5 уровней)
    if (level > oldLevel) {
        handleLevelMilestones(oldLevel, level);
    }
    
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
    dailyRewardAmount = Math.min(100, 10 + (streak - 1) * 5);
    dailyRewardPending = true;
    if (streak % 3 === 0 || streak === 7 || streak === 30 || streak === 100) addChest('daily', { streak });
    updateStreakUI();
    updateMissionProgress(missions, 'streak', streak, true);
}

function updateStreakUI() {
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
    achListEl.innerHTML = '';
    ACHIEVEMENTS.forEach(a => {
        const unlocked = unlockedAchievements.includes(a.id);
        const div = document.createElement('div');
        div.className = 'ach-item' + (unlocked ? ' unlocked' : '');
        div.innerHTML = `<span class="ach-icon">${a.icon}</span><div class="ach-info"><span class="ach-name">${a.name}${unlocked ? ' ✓' : ''}</span><span class="ach-desc">${a.desc}</span></div>`;
        achListEl.appendChild(div);
    });
    achProgressEl.innerText = `${unlockedAchievements.length}/${ACHIEVEMENTS.length}`;
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
        bestValEl.innerText = best.score;
        bestSubEl.innerText = `Установлен ${best.date}`;
    } else {
        bestValEl.innerText = '0';
        bestSubEl.innerText = 'Играй, чтобы установить рекорд';
    }
    const recentEntries = [...modeEntries]
        .sort((a, b) => (b.ts || 0) - (a.ts || 0))
        .slice(0, 5);
    const attemptsEl = document.getElementById('lb-attempts');
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
        div.innerHTML = `
            <span class="lb-attempt-rank">${i + 1}.</span>
            <span class="lb-attempt-score">${entry.score}${isBest ? ' <span class="lb-attempt-badge">РЕКОРД</span>' : ''}</span>
            <span class="lb-attempt-date">${entry.date}</span>
        `;
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
    $('toggle-music').dataset.on = settings.musicEnabled;
    $('toggle-music').innerText = settings.musicEnabled ? 'ВКЛ' : 'ВЫКЛ';
    $('toggle-sfx').dataset.on = settings.sfxEnabled;
    $('toggle-sfx').innerText = settings.sfxEnabled ? 'ВКЛ' : 'ВЫКЛ';
    $('toggle-haptics').dataset.on = settings.hapticsEnabled;
    $('toggle-haptics').innerText = settings.hapticsEnabled ? 'ВКЛ' : 'ВЫКЛ';
    muteBtn.innerText = (settings.musicEnabled || settings.sfxEnabled) ? '🔊' : '🔇';
}

// ============ AUDIO ============
let audioCtx = null, noiseBuffer = null;
let musicPlaying = false, musicBeat = 0, musicTempo = 110, musicTimeout = null;

function initAudio() {
    if (!audioCtx) {
        try {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const size = audioCtx.sampleRate * 1.0;
            noiseBuffer = audioCtx.createBuffer(1, size, audioCtx.sampleRate);
            const data = noiseBuffer.getChannelData(0);
            for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;
            musicGain = audioCtx.createGain(); musicGain.gain.value = 0.12; musicGain.connect(audioCtx.destination);
            windGain = audioCtx.createGain(); windGain.gain.value = 0; windGain.connect(audioCtx.destination);
            const windOsc = audioCtx.createBufferSource(); windOsc.buffer = noiseBuffer; windOsc.loop = true;
            const windFilter = audioCtx.createBiquadFilter(); windFilter.type = 'lowpass'; windFilter.frequency.value = 400;
            windOsc.connect(windFilter); windFilter.connect(windGain); windOsc.start();
        } catch(e) {}
    }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
}

function playSound(type, level = 0) {
    if (!settings.sfxEnabled || !audioCtx || audioCtx.state === 'suspended') return;
    try {
        const now = audioCtx.currentTime;
        const master = audioCtx.createGain();
        master.connect(audioCtx.destination);
        const tone = (freq, endFreq, wave, dur, vol, delay = 0) => {
            const osc = audioCtx.createOscillator();
            const g = audioCtx.createGain();
            const filter = audioCtx.createBiquadFilter();
            osc.type = wave;
            osc.frequency.setValueAtTime(freq, now + delay);
            if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, now + delay + dur);
            filter.type = 'lowpass'; filter.frequency.value = 2000;
            g.gain.setValueAtTime(0, now + delay);
            g.gain.linearRampToValueAtTime(vol, now + delay + 0.02);
            g.gain.exponentialRampToValueAtTime(0.001, now + delay + dur);
            osc.connect(filter); filter.connect(g); g.connect(master);
            osc.start(now + delay); osc.stop(now + delay + dur);
        };
        const noise = (dur, vol, delay = 0) => {
            const src = audioCtx.createBufferSource();
            src.buffer = noiseBuffer;
            const filter = audioCtx.createBiquadFilter();
            const g = audioCtx.createGain();
            filter.type = 'bandpass'; filter.frequency.value = 1000;
            g.gain.setValueAtTime(vol, now + delay);
            g.gain.exponentialRampToValueAtTime(0.01, now + delay + dur);
            src.connect(filter); filter.connect(g); g.connect(master);
            src.start(now + delay);
        };
        
        if (type === 'drop') { tone(90, 40, 'sine', 0.15, 0.35); noise(0.08, 0.1); }
        else if (type === 'perfect') { const mult = Math.pow(1.059, Math.min(level, 12)); tone(523.25 * mult, null, 'sine', 0.4, 0.25); tone(659.25 * mult, null, 'sine', 0.4, 0.18); }
        else if (type === 'milestone') { [261.63, 329.63, 392.00, 523.25].forEach((f, i) => tone(f, null, 'triangle', 0.5, 0.12, i * 0.1)); }
        else if (type === 'bomb') { noise(0.4, 0.4); tone(120, 30, 'sawtooth', 0.4, 0.3); }
        else if (type === 'gameover') { tone(200, 80, 'triangle', 0.8, 0.25); tone(150, 60, 'triangle', 0.8, 0.18, 0.1); }
        else if (type === 'quest') { tone(659.25, null, 'sine', 0.2, 0.2); tone(783.99, null, 'sine', 0.3, 0.2, 0.1); tone(1046.5, null, 'sine', 0.4, 0.2, 0.2); }
        else if (type === 'fury') { tone(440, 880, 'sawtooth', 0.5, 0.15); tone(554, 1108, 'sawtooth', 0.5, 0.1); }
        else if (type === 'secret') { [523.25, 659.25, 783.99, 1046.5, 1318.51].forEach((f, i) => tone(f, null, 'sine', 0.3, 0.2, i * 0.06)); }
        else if (type === 'gust') { tone(200, 900, 'sawtooth', 0.7, 0.08); noise(0.5, 0.22); }
        else if (type === 'chest') { [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, null, 'triangle', 0.4, 0.2, i * 0.1)); tone(1318.51, null, 'sine', 0.6, 0.25, 0.5); }
        else if (type === 'victory') { [523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98].forEach((f, i) => tone(f, null, 'triangle', 0.5, 0.22, i * 0.1)); }
        // Звуки комбо
        else if (type === 'combo_2x') { tone(523.25, null, 'sine', 0.15, 0.2); tone(659.25, null, 'sine', 0.15, 0.2, 0.08); }
        else if (type === 'combo_3x') { tone(523.25, null, 'sine', 0.12, 0.22); tone(659.25, null, 'sine', 0.12, 0.22, 0.07); tone(783.99, null, 'sine', 0.2, 0.22, 0.14); }
        else if (type === 'combo_5x') { tone(523.25, null, 'triangle', 0.1, 0.25); tone(659.25, null, 'triangle', 0.1, 0.25, 0.06); tone(783.99, null, 'triangle', 0.1, 0.25, 0.12); tone(1046.50, null, 'triangle', 0.25, 0.25, 0.18); }
        else if (type === 'combo_super') { [523.25, 659.25, 783.99, 1046.50, 1318.51].forEach((f, i) => tone(f, null, 'triangle', 0.15, 0.25, i * 0.05)); noise(0.3, 0.1, 0.25); }
        else if (type === 'combo_ultra') { [523.25, 659.25, 783.99, 1046.50, 1318.51, 1567.98].forEach((f, i) => tone(f, null, 'sine', 0.12, 0.28, i * 0.04)); tone(2093, null, 'sine', 0.4, 0.2, 0.25); }
        else if (type === 'combo_insane') { [523.25, 659.25, 783.99, 1046.50, 1318.51, 1567.98, 2093].forEach((f, i) => tone(f, null, 'triangle', 0.1, 0.3, i * 0.035)); tone(2637, null, 'sine', 0.5, 0.25, 0.25); noise(0.4, 0.15, 0.3); }
        // Звуки миссий
        else if (type === 'mission_complete') { [523.25, 659.25, 783.99, 1046.50].forEach((f, i) => tone(f, null, 'triangle', 0.2, 0.25, i * 0.08)); tone(1318.51, null, 'sine', 0.4, 0.2, 0.35); }
        // Звуки престижа
        else if (type === 'prestige_activate') { [523.25, 659.25, 783.99, 1046.50, 1318.51, 1567.98, 2093.00].forEach((f, i) => tone(f, null, 'sine', 0.15, 0.25, i * 0.05)); tone(2637, null, 'triangle', 0.8, 0.3, 0.4); noise(0.5, 0.15, 0.5); }
        // Системные звуки
        else if (type === 'screen_transition') { tone(600, 800, 'sine', 0.1, 0.1); tone(800, 1000, 'sine', 0.1, 0.08, 0.05); }
        else if (type === 'notification') { tone(880, null, 'sine', 0.1, 0.2); tone(1174.66, null, 'sine', 0.15, 0.2, 0.1); }
        else if (type === 'unlock') { [523.25, 659.25, 783.99, 1046.50, 1318.51].forEach((f, i) => tone(f, null, 'sine', 0.15, 0.22, i * 0.07)); }
    } catch(e) {}
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
    } catch(e) {}
}

function playHat() {
    if (!audioCtx || !settings.musicEnabled) return;
    try {
        const src = audioCtx.createBufferSource();
        src.buffer = noiseBuffer;
        const filter = audioCtx.createBiquadFilter();
        filter.type = 'highpass'; filter.frequency.value = 6000;
        const g = audioCtx.createGain();
        g.gain.setValueAtTime(0.06, audioCtx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.04);
        src.connect(filter); filter.connect(g); g.connect(musicGain);
        src.start(); src.stop(audioCtx.currentTime + 0.04);
    } catch(e) {}
}

function playBass() {
    if (!audioCtx || !settings.musicEnabled) return;
    try {
        const osc = audioCtx.createOscillator(), g = audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(65, audioCtx.currentTime);
        g.gain.setValueAtTime(0.15, audioCtx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
        osc.connect(g); g.connect(musicGain); osc.start();
        osc.stop(audioCtx.currentTime + 0.2);
    } catch(e) {}
}

function playLeadNote(idx) {
    if (!audioCtx || !settings.musicEnabled) return;
    try {
        const now = audioCtx.currentTime;
        const osc = audioCtx.createOscillator(), g = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(LEAD_NOTES[idx], now);
        g.gain.setValueAtTime(0.05, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc.connect(g); g.connect(musicGain);
        osc.start(now); osc.stop(now + 0.35);
    } catch(e) {}
}

function playFuryLead() {
    if (!audioCtx || !settings.musicEnabled) return;
    try {
        const now = audioCtx.currentTime;
        const osc = audioCtx.createOscillator(), g = audioCtx.createGain();
        const filter = audioCtx.createBiquadFilter();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(440, now + 0.15);
        filter.type = 'lowpass'; filter.frequency.value = 3000;
        g.gain.setValueAtTime(0.08, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        osc.connect(filter); filter.connect(g); g.connect(musicGain);
        osc.start(now); osc.stop(now + 0.2);
    } catch(e) {}
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
    initAudio();
    if (!audioCtx) return;
    musicPlaying = true; musicBeat = 0; musicTempo = GAME_CONFIG.MUSIC_BASE_TEMPO;
    musicTick();
}

function stopMusic() {
    musicPlaying = false;
    if (musicTimeout) { clearTimeout(musicTimeout); musicTimeout = null; }
}

// ============ QUESTS ============
function generateNewQuests() {
    const pool = [...QUESTS_POOL];
    quests = [];
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
    if (saved && saved.date === today && saved.quests?.length === 3) {
        quests = saved.quests; renderQuests();
    } else {
        generateNewQuests();
    }
}

function saveQuests() {
    safeSetItem(STORAGE_KEYS.QUESTS, { date: new Date().toDateString(), quests });
}

function updateQuest(type, value, isMax = false) {
    let changed = false;
    quests.forEach(q => {
        if (q.type !== type || q.done) return;
        if (isMax) {
            if (value > q.current) { q.current = Math.min(q.target, value); changed = true; }
        } else {
            q.current = Math.min(q.target, q.current + value); changed = true;
        }
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
    updateDOMText(coinsBalanceEl, coinsText);
    updateDOMText(menuCoinsEl, coinsText);
    updateDOMText(gameCoinsEl, `🪙 ${gameState === GAME_STATES.PLAYING ? sessionCoins : coins}`);
}

// ============ SHOP ============
function renderShop() {
    skinListEl.innerHTML = '';
    const buyableCount = Object.keys(SKINS).filter(k => !SKINS[k].notBuyable).length;
    const unlockedBuyable = unlockedSkins.filter(k => !SKINS[k] || !SKINS[k].notBuyable).length;
    shopProgressEl.innerText = `Открыто: ${unlockedBuyable}/${buyableCount}${unlockedSkins.includes('legend') ? ' + 👑 Легенда' : ''}`;
    for (const [key, skin] of Object.entries(SKINS)) {
        if (key === 'legend' && !unlockedSkins.includes('legend')) continue;
        if (skin.prestigeOnly && !unlockedSkins.includes(key)) continue;
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
        const modifierHint = skin.modifiers ? `· <span style="color:var(--mint-dark);font-size:10px;font-weight:900">${skin.modifiers.speedMult ? (skin.modifiers.speedMult>1?'⚡ БЫСТРЕЕ':'🐌 МЕДЛЕННЕЕ') : ''} ${skin.modifiers.coinMult ? '+'+Math.round((skin.modifiers.coinMult-1)*100)+'%🪙' : ''} ${skin.modifiers.scoreMult ? '+'+Math.round((skin.modifiers.scoreMult-1)*100)+'%очк' : ''} ${skin.modifiers.fireChance ? '🔥 5%' : ''}</span>` : '';
        div.innerHTML = `<div class="skin-info"><span class="skin-preview" style="background:linear-gradient(135deg,${skin.colors[0]},${skin.colors[1] || skin.colors[0]});border-radius:8px;padding:4px;"></span><div class="skin-details"><span class="skin-name">${skin.name}${modifierHint}</span><div class="skin-colors">${colorDots}</div></div></div>${btnHtml}`;
        skinListEl.appendChild(div);
    }
    skinListEl.querySelectorAll('button.equip').forEach(btn => {
        safeClick(btn, () => {
            currentSkin = btn.dataset.skin;
            safeSetItem(STORAGE_KEYS.SKIN, currentSkin);
            renderShop();
        });
    });
    skinListEl.querySelectorAll('button.buy').forEach(btn => {
        if (btn.disabled) return;
        safeClick(btn, () => {
            const price = parseInt(btn.dataset.price);
            if (coins >= price) {
                coins -= price;
                safeSetItem(STORAGE_KEYS.COINS, coins);
                const skin = btn.dataset.skin;
                unlockedSkins.push(skin);
                safeSetItem(STORAGE_KEYS.SKINS, unlockedSkins);
                currentSkin = skin;
                safeSetItem(STORAGE_KEYS.SKIN, currentSkin);
                updateCoinUI(); renderShop(); triggerHaptic('success');
                checkAchievements();
            } else { triggerHaptic('error'); }
        });
    });
    renderCustomize('colors');
    renderCustomize('backgrounds');
}

function renderCustomize(type) {
    const listEl = type === 'colors' ? colorsListEl : backgroundsListEl;
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
                coins -= price;
                safeSetItem(STORAGE_KEYS.COINS, coins);
                unlocked.push(btn.dataset.key);
                safeSetItem(saveKey, unlocked);
                safeSetItem(currentKey, btn.dataset.key);
                if (type === 'colors') currentPalette = btn.dataset.key;
                else { currentBackground = btn.dataset.key; applyBackground(); }
                updateCoinUI(); renderCustomize(type); triggerHaptic('success');
            } else { triggerHaptic('error'); }
        });
    });
}

function switchShopTab(tab) {
    document.querySelectorAll('.shop-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    skinListEl.style.display = tab === 'skins' ? 'flex' : 'none';
    colorsListEl.style.display = tab === 'colors' ? 'flex' : 'none';
    backgroundsListEl.style.display = tab === 'backgrounds' ? 'flex' : 'none';
    if (tab === 'skins') {
        const buyableCount = Object.keys(SKINS).filter(k => !SKINS[k].notBuyable).length;
        const unlockedBuyable = unlockedSkins.filter(k => !SKINS[k] || !SKINS[k].notBuyable).length;
        shopProgressEl.innerText = `Открыто: ${unlockedBuyable}/${buyableCount}`;
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
    if (bg.stars && !bgStarsGroup) {
        createStars();
    } else if (!bg.stars && bgStarsGroup) {
        scene.remove(bgStarsGroup);
        if (bgStarsGroup.geometry) bgStarsGroup.geometry.dispose();
        if (bgStarsGroup.material) bgStarsGroup.material.dispose();
        bgStarsGroup = null;
    }
}

function createStars() {
    const geo = new THREE.BufferGeometry();
    const positions = [];
    for (let i = 0; i < 300; i++) {
        positions.push((Math.random()-0.5)*200, Math.random()*150, (Math.random()-0.5)*200);
    }
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
            if (isActive) { activePowerups[key] = false; }
            else if (owned > 0) { activePowerups[key] = true; }
            else if (canBuy) {
                coins -= def.price;
                safeSetItem(STORAGE_KEYS.COINS, coins);
                ownedPowerups[key] = 1;
                savePowerups();
                activePowerups[key] = true;
                updateCoinUI();
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
    hideModal(powerupsScreen);
    const mode = pendingGameMode;
    pendingGameMode = null;
    startGame(mode);
}

function updateActivePowerupsUI() {
    activePowerupsEl.innerHTML = '';
    for (const [key, isActive] of Object.entries(activePowerups)) {
        if (isActive) {
            const badge = document.createElement('div');
            badge.className = 'pu-active-badge';
            badge.innerText = POWERUP_DEFS[key].icon;
            activePowerupsEl.appendChild(badge);
        }
    }
}

// ============ CHESTS ============
function addChest(type, meta = {}) {
    const isRare = Math.random() < 0.1;
    chests.push({ type, isRare, ...meta, id: Date.now() + Math.random() });
    saveChests(); updateChestUI();
    if (isRare) {
        showPopup(bonusText, '✨ РЕДКИЙ СУНДУК!', 2200);
        triggerHaptic('success');
    } else {
        showPopup(bonusText, '📦 НОВЫЙ СУНДУК!', 1500);
    }
    playSound('quest');
}

function updateChestUI() {
    const count = chests.length;
    const hasRare = chests.some(c => c.isRare);
    const container = $('chest-btn-container');
    const badge = $('chest-count-badge');
    if (count > 0) {
        container.style.display = 'block';
        badge.innerText = count;
        if (hasRare) badge.classList.add('rare');
        else badge.classList.remove('rare');
    } else {
        container.style.display = 'none';
    }
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
        if (index < 3) {
            item.classList.add('new');
            item.style.animationDelay = `${index * 0.08}s`;
        }
        let actionHtml = '';
        if (isClaimed) {
            actionHtml = '<span class="mission-claimed-badge">✓ Получено</span>';
        } else if (isCompleted) {
            actionHtml = `<button class="mission-claim-btn" data-mission-id="${mission.id}">ЗАБРАТЬ</button>`;
        }
        item.innerHTML = `
            <div class="mission-icon">${mission.icon}</div>
            <div class="mission-info">
                <span class="mission-text">${mission.text}</span>
                <div class="mission-progress-bar">
                    <div class="mission-progress-fill" style="width: ${progress}%"></div>
                </div>
                <span class="mission-progress-text">${mission.current} / ${mission.target}</span>
            </div>
            <div class="mission-reward">
                <span class="mission-reward-text">${formatMissionReward(mission.reward)}</span>
                ${actionHtml}
            </div>
        `;
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
                setTimeout(() => {
                    renderMissions();
                    updateMissionsBadge();
                    updateCoinUI();
                }, 600);
                playSound('mission_complete');
                triggerHaptic('success');
                showPopup(bonusText, '🎁 МИССИЯ ВЫПОЛНЕНА!', 1500);
                checkAchievements();
            }
        });
    });
    
    const mStats = getMissionsStats(missions);
    if (missionsStatsTextEl) {
        missionsStatsTextEl.textContent = `Выполнено: ${mStats.completed}/${mStats.total}`;
    }
    if (missionsAvailableTextEl) {
        missionsAvailableTextEl.textContent = `Доступно наград: ${mStats.available}`;
    }
}

function updateMissionsBadge() {
    if (!missionsBadgeEl) return;
    const mStats = getMissionsStats(missions);
    const available = mStats.available;
    if (available > 0) {
        missionsBadgeEl.textContent = available;
        missionsBadgeEl.classList.remove('hidden');
    } else {
        missionsBadgeEl.classList.add('hidden');
    }
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
    if (missionsTimerInterval) {
        clearInterval(missionsTimerInterval);
        missionsTimerInterval = null;
    }
}

// ============ ПРЕСТИЖ ============
function updatePrestigeUI() {
    const prestigeCount = getPrestigeCount();
    const bonus = getPrestigeBonus();
    const progress = getPrestigeProgress(level);
    const available = canPrestige(level);
    
    if (prestigeSectionEl) {
        prestigeSectionEl.style.display = level >= 50 || prestigeCount > 0 ? 'block' : 'none';
    }
    if (prestigeProfileBadgeEl && prestigeCountBadgeEl) {
        if (prestigeCount > 0) {
            prestigeProfileBadgeEl.style.display = 'inline-flex';
            prestigeCountBadgeEl.textContent = prestigeCount;
        } else {
            prestigeProfileBadgeEl.style.display = 'none';
        }
    }
    if (prestigeCountDisplayEl) {
        prestigeCountDisplayEl.textContent = prestigeCount;
    }
    if (prestigeBonusTextEl) {
        const bonusText = formatPrestigeBonus(bonus);
        prestigeBonusTextEl.textContent = bonusText ? `Бонусы: ${bonusText}` : 'Бонусы: —';
    }
    if (prestigeProgressFillEl) {
        prestigeProgressFillEl.style.width = `${progress}%`;
    }
    if (prestigeProgressTextEl) {
        if (available) {
            prestigeProgressTextEl.textContent = '⭐ ГОТОВ К ПРЕСТИЖУ!';
            prestigeProgressTextEl.style.color = 'var(--orange)';
        } else {
            prestigeProgressTextEl.textContent = `${level} / ${PRESTIGE_CONFIG.REQUIRED_LEVEL} уровня`;
            prestigeProgressTextEl.style.color = '';
        }
    }
    if (prestigeActivateBtnEl) {
        if (available) {
            prestigeActivateBtnEl.disabled = false;
            prestigeActivateBtnEl.textContent = '⭐ АКТИВИРОВАТЬ ПРЕСТИЖ';
        } else {
            prestigeActivateBtnEl.disabled = true;
            prestigeActivateBtnEl.textContent = `🔒 ДОСТУПНО С ${PRESTIGE_CONFIG.REQUIRED_LEVEL} УРОВНЯ`;
        }
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
    for (let i = 0; i < result.chestsReward; i++) {
        pendingPrestigeRewards.push(rollPrestigeChestReward());
    }
    resetProgressForPrestige();
    level = 1;
    xpTotal = 0;
    highScore = 0;
    totalScoreAllTime = 0;
    recentScores = [];
    stats.maxScore = 0;
    stats.maxCombo = 0;
    stats.maxTimeScore = 0;
    saveLevelProgress();
    saveStats();
    saveTotalScore();
    saveRecentScores();
    updateLevelUI();
    updatePrestigeUI();
    highScoreEl.innerText = `РЕКОРД: ${highScore}`;
    hideModal(prestigeConfirmScreen);
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
    if (prestigeRewardTextEl) {
        prestigeRewardTextEl.textContent = '';
        prestigeRewardTextEl.className = 'prestige-reward-text';
    }
    if (openPrestigeChestBtn) openPrestigeChestBtn.style.display = 'block';
    if (closePrestigeChestBtn) closePrestigeChestBtn.style.display = 'none';
    const remaining = pendingPrestigeRewards.length;
    const subEl = document.getElementById('prestige-chest-sub');
    if (subEl) {
        subEl.textContent = remaining === 1 ? 'Последний сундук!' : `Осталось сундуков: ${remaining}`;
    }
}

function openPrestigeChest() {
    if (pendingPrestigeRewards.length === 0) return;
    const reward = pendingPrestigeRewards.shift();
    if (prestigeChestIconEl) {
        prestigeChestIconEl.style.animation = 'chestOpenBurst 1s forwards';
    }
    if (openPrestigeChestBtn) openPrestigeChestBtn.style.display = 'none';
    setTimeout(() => {
        applyPrestigeReward(reward, {
            addCoins: (amount) => addCoins(amount),
            addPowerup: (pu, count) => {
                ownedPowerups[pu] = (ownedPowerups[pu] || 0) + count;
                savePowerups();
            },
            addSkin: (skinId) => {
                if (!unlockedSkins.includes(skinId)) {
                    unlockedSkins.push(skinId);
                    safeSetItem(STORAGE_KEYS.SKINS, unlockedSkins);
                }
            },
            addChest: (type, meta) => addChest(type, meta),
            addPermanentBuff: (effect, value) => {
                const bonus = getPrestigeBonus();
                if (effect === 'coin_boost') bonus.coinMult += value;
                else if (effect === 'xp_boost') bonus.xpMult += value;
                else if (effect === 'all_boost') bonus.allMult += value;
                setPrestigeBonus(bonus);
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
            if (openPrestigeChestBtn) {
                openPrestigeChestBtn.textContent = 'ОТКРЫТЬ ЕЩЁ';
                openPrestigeChestBtn.style.display = 'block';
            }
        } else {
            if (closePrestigeChestBtn) closePrestigeChestBtn.style.display = 'block';
        }
        updateCoinUI();
        updatePrestigeUI();
    }, 1000);
}

function handleLevelMilestones(oldLevel, newLevel) {
    const newMilestones = checkNewMilestones(oldLevel, newLevel);
    newMilestones.forEach((milestoneLevel, index) => {
        setTimeout(() => {
            showMilestoneNotification(milestoneLevel);
            addChest('milestone', { level: milestoneLevel });
            playSound('chest');
            triggerHaptic('success');
        }, index * 1500);
    });
}

function showMilestoneNotification(milestoneLevel) {
    const notification = document.createElement('div');
    notification.className = 'milestone-notification';
    notification.innerHTML = `
        <div class="milestone-notification-icon">📦</div>
        <div class="milestone-notification-title">УРОВЕНЬ ${milestoneLevel}!</div>
        <div class="milestone-notification-desc">Ты получил редкий сундук!</div>
    `;
    document.body.appendChild(notification);
    requestAnimationFrame(() => notification.classList.add('show'));
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 500);
    }, 2500);
}

// ============ THREE.JS ============
function initThree() {
    scene = new THREE.Scene();
    const bg = BACKGROUNDS[currentBackground] || BACKGROUNDS.default;
    scene.background = new THREE.Color(bg.colors[0]);
    scene.fog = new THREE.FogExp2(bg.colors[0], 0.02);
    const aspect = window.innerWidth / window.innerHeight;
    const d = getAdaptiveD(aspect);
    camera = new THREE.OrthographicCamera(-d * aspect, d * aspect, d, -d, 1, 1000);
    camera.position.set(GAME_CONFIG.CAMERA_OFFSET_X, GAME_CONFIG.CAMERA_OFFSET_Y, GAME_CONFIG.CAMERA_OFFSET_Z);
    camera.lookAt(0, 0, 0);
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(renderer.domElement);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x222222, 0.6));
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(10, 20, 10);
    dirLight.castShadow = true;
    dirLight.shadow.camera.left = -20;
    dirLight.shadow.camera.right = 20;
    dirLight.shadow.camera.top = 20;
    dirLight.shadow.camera.bottom = -20;
    dirLight.shadow.mapSize.set(1024, 1024);
    scene.add(dirLight);
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', () => setTimeout(onResize, 100));
    glowTexture = createGlowTexture();
    applyBackground();
}

function disposeMesh(mesh) {
    if (!mesh) return;
    if (mesh.geometry) mesh.geometry.dispose();
    if (Array.isArray(mesh.material)) {
        mesh.material.forEach(m => { if (m.map) m.map.dispose(); m.dispose(); });
    } else if (mesh.material) {
        if (mesh.material.map) mesh.material.map.dispose();
        mesh.material.dispose();
    }
}

function createGlowTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.3, 'rgba(255,255,255,0.6)');
    grad.addColorStop(0.7, 'rgba(255,255,255,0.15)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
}

function shadeColor(hex, percent) {
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

function createTexture(color, type = 'normal') {
    return getCachedTexture(color, type, () => {
        const c = document.createElement('canvas');
        c.width = c.height = 512;
        const ctx = c.getContext('2d');
        if (type === BLOCK_TYPES.GOLDEN) {
            const grad = ctx.createLinearGradient(0, 0, 512, 512);
            grad.addColorStop(0, '#FFE082');
            grad.addColorStop(0.3, '#FFD700');
            grad.addColorStop(0.6, '#FFC107');
            grad.addColorStop(1, '#FF8F00');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, 512, 512);
            ctx.fillStyle = 'rgba(255,255,255,0.7)';
            ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(180, 0); ctx.lineTo(0, 180); ctx.closePath(); ctx.fill();
            ctx.beginPath(); ctx.moveTo(512, 512); ctx.lineTo(332, 512); ctx.lineTo(512, 332); ctx.closePath(); ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 3;
            for (let i = -512; i < 1024; i += 40) {
                ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + 512, 512); ctx.stroke();
            }
            ctx.strokeStyle = '#8D6E00'; ctx.lineWidth = 20; ctx.strokeRect(10, 10, 492, 492);
        } else if (type === BLOCK_TYPES.BOMB) {
            ctx.fillStyle = '#1A0000'; ctx.fillRect(0, 0, 512, 512);
            ctx.save(); ctx.beginPath(); ctx.rect(0, 0, 512, 512); ctx.clip();
            ctx.strokeStyle = '#FF1744'; ctx.lineWidth = 80;
            for (let i = -512; i < 1024; i += 140) {
                ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + 512, 512); ctx.stroke();
            }
            ctx.restore();
            ctx.strokeStyle = '#FF5252'; ctx.lineWidth = 25; ctx.strokeRect(12.5, 12.5, 487, 487);
            ctx.fillStyle = 'rgba(255,82,82,0.2)'; ctx.fillRect(0, 0, 512, 512);
            ctx.fillStyle = 'rgba(255,255,255,0.15)';
            ctx.beginPath(); ctx.arc(256, 256, 100, 0, Math.PI * 2); ctx.fill();
        } else if (type === BLOCK_TYPES.ICE) {
            ctx.fillStyle = '#00E5FF'; ctx.fillRect(0, 0, 512, 512);
            ctx.fillStyle = 'rgba(255,255,255,0.35)';
            ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(220, 0); ctx.lineTo(0, 220); ctx.closePath(); ctx.fill();
            ctx.beginPath(); ctx.moveTo(512, 512); ctx.lineTo(292, 512); ctx.lineTo(512, 292); ctx.closePath(); ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.15)';
            ctx.beginPath(); ctx.moveTo(512, 0); ctx.lineTo(380, 0); ctx.lineTo(512, 150); ctx.closePath(); ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 6;
            for (let i = 0; i < 12; i++) {
                ctx.beginPath(); ctx.moveTo(Math.random() * 512, Math.random() * 512); ctx.lineTo(Math.random() * 512, Math.random() * 512); ctx.stroke();
            }
            ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 25; ctx.strokeRect(12.5, 12.5, 487, 487);
        } else if (type === BLOCK_TYPES.CRUMBLE) {
            ctx.fillStyle = '#5D4037'; ctx.fillRect(0, 0, 512, 512);
            ctx.strokeStyle = '#1A0A00'; ctx.lineWidth = 20;
            for (let i = 0; i < 20; i++) {
                ctx.beginPath(); ctx.moveTo(Math.random() * 512, Math.random() * 512); ctx.lineTo(Math.random() * 512, Math.random() * 512); ctx.stroke();
            }
            ctx.fillStyle = 'rgba(0,0,0,0.2)';
            for (let y = 0; y < 512; y += 60) {
                for (let x = 0; x < 512; x += 100) {
                    const offset = (y / 60) % 2 ? 50 : 0;
                    ctx.fillRect(x + offset, y, 95, 55);
                }
            }
            ctx.strokeStyle = '#8D6E63'; ctx.lineWidth = 25; ctx.strokeRect(12.5, 12.5, 487, 487);
        } else if (type === BLOCK_TYPES.RAINBOW) {
            const grad = ctx.createLinearGradient(0, 0, 512, 512);
            grad.addColorStop(0, '#FF1744');
            grad.addColorStop(0.16, '#FF9100');
            grad.addColorStop(0.33, '#FFEA00');
            grad.addColorStop(0.5, '#00E676');
            grad.addColorStop(0.66, '#00B0FF');
            grad.addColorStop(0.83, '#651FFF');
            grad.addColorStop(1, '#D500F9');
            ctx.fillStyle = grad; ctx.fillRect(0, 0, 512, 512);
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.beginPath(); ctx.arc(140, 140, 70, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(360, 370, 50, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 25; ctx.strokeRect(12.5, 12.5, 487, 487);
        } else if (type === BLOCK_TYPES.DRAGON) {
            const grad = ctx.createLinearGradient(0, 0, 0, 512);
            grad.addColorStop(0, '#FFEB3B');
            grad.addColorStop(0.3, '#FF9800');
            grad.addColorStop(0.7, '#E65100');
            grad.addColorStop(1, '#B71C1C');
            ctx.fillStyle = grad; ctx.fillRect(0, 0, 512, 512);
            ctx.fillStyle = 'rgba(255,235,59,0.4)';
            for (let i = 0; i < 12; i++) {
                ctx.beginPath(); ctx.arc(Math.random() * 512, Math.random() * 512, 30 + Math.random() * 70, 0, Math.PI * 2); ctx.fill();
            }
            ctx.strokeStyle = '#FFEB3B'; ctx.lineWidth = 25; ctx.strokeRect(12.5, 12.5, 487, 487);
        } else if (type === BLOCK_TYPES.DIAMOND) {
            const grad = ctx.createRadialGradient(256, 256, 50, 256, 256, 400);
            grad.addColorStop(0, '#E0F7FA');
            grad.addColorStop(0.5, '#00BCD4');
            grad.addColorStop(1, '#006064');
            ctx.fillStyle = grad; ctx.fillRect(0, 0, 512, 512);
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(230, 0); ctx.lineTo(0, 230); ctx.closePath(); ctx.fill();
            ctx.beginPath(); ctx.moveTo(512, 0); ctx.lineTo(282, 0); ctx.lineTo(512, 230); ctx.closePath(); ctx.fill();
            ctx.beginPath(); ctx.moveTo(0, 512); ctx.lineTo(0, 282); ctx.lineTo(230, 512); ctx.closePath(); ctx.fill();
            ctx.beginPath(); ctx.moveTo(512, 512); ctx.lineTo(282, 512); ctx.lineTo(512, 282); ctx.closePath(); ctx.fill();
            ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 25; ctx.strokeRect(12.5, 12.5, 487, 487);
        } else {
            const grad = ctx.createLinearGradient(0, 0, 0, 512);
            grad.addColorStop(0, color);
            grad.addColorStop(1, shadeColor(color, -20));
            ctx.fillStyle = grad; ctx.fillRect(0, 0, 512, 512);
            ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 2;
            for (let i = 0; i < 512; i += 24) {
                ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + 512, 512); ctx.stroke();
            }
            ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 15; ctx.strokeRect(7.5, 7.5, 497, 497);
            const topGrad = ctx.createLinearGradient(0, 0, 0, 100);
            topGrad.addColorStop(0, 'rgba(255,255,255,0.25)');
            topGrad.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = topGrad; ctx.fillRect(10, 10, 492, 100);
        }
        const tex = new THREE.CanvasTexture(c);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.generateMipmaps = false;
        return tex;
    });
}

function createBlockMesh(w, h, d, color, type = BLOCK_TYPES.NORMAL) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const tex = createTexture(color, type);
    let sideOpts = { map: tex, roughness: 0.45, metalness: 0.1 };
    let topOpts = { color: color, roughness: 0.5 };
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
    const side = new THREE.MeshStandardMaterial(sideOpts);
    const top = new THREE.MeshStandardMaterial(topOpts);
    const mesh = new THREE.Mesh(geo, [side, side, top, top, side, side]);
    mesh.castShadow = true; mesh.receiveShadow = true;
    mesh.userData.blockType = type;
    if (type !== BLOCK_TYPES.NORMAL && type !== BLOCK_TYPES.CRUMBLE) {
        const glowColor = BLOCK_GLOW_COLORS[type];
        const isSecret = type === BLOCK_TYPES.RAINBOW || type === BLOCK_TYPES.DRAGON || type === BLOCK_TYPES.DIAMOND;
        const opacity = isSecret ? 0.9 : 0.7;
        const scale = isSecret ? 7 : 5.5;
        const spriteMat = new THREE.SpriteMaterial({
            map: glowTexture,
            color: glowColor,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            opacity
        });
        const sprite = new THREE.Sprite(spriteMat);
        sprite.scale.set(scale, scale, 1);
        sprite.renderOrder = -1;
        mesh.add(sprite);
        mesh.userData.glowSprite = sprite;
    }
    return mesh;
}

function rollBlockType() {
    if (dailyModifiers.onlyType) return dailyModifiers.onlyType;
    if (dailyModifiers.noSpecials) return BLOCK_TYPES.NORMAL;
    if (score < 5) return BLOCK_TYPES.NORMAL;
    const r = Math.random();
    if (r < GAME_CONFIG.PROB_RAINBOW) return BLOCK_TYPES.RAINBOW;
    if (r < GAME_CONFIG.PROB_DRAGON) return BLOCK_TYPES.DRAGON;
    if (r < GAME_CONFIG.PROB_DIAMOND) return BLOCK_TYPES.DIAMOND;
    if (r < GAME_CONFIG.PROB_GOLDEN) {
        if (dailyModifiers.noGolden) return BLOCK_TYPES.NORMAL;
        return BLOCK_TYPES.GOLDEN;
    }
    if (r < GAME_CONFIG.PROB_BOMB) {
        if (dailyModifiers.noBombs) return BLOCK_TYPES.NORMAL;
        return BLOCK_TYPES.BOMB;
    }
    if (r < GAME_CONFIG.PROB_ICE) return BLOCK_TYPES.ICE;
    if (r < GAME_CONFIG.PROB_CRUMBLE && score > 15) return BLOCK_TYPES.CRUMBLE;
    return BLOCK_TYPES.NORMAL;
}

function getBlockVisuals(type, skinKey) {
    const palette = getPaletteColors();
    const rndColor = palette[Math.floor(Math.random() * palette.length)];
    if (BLOCK_COLORS[type]) return { color: BLOCK_COLORS[type] };
    return { color: rndColor };
}

function generateNextBlockData() {
    const type = rollBlockType();
    const { color } = getBlockVisuals(type, currentSkin);
    return { type, color };
}

function updateNextBlockPreview(type, color) {
    const el = document.getElementById('next-block-preview');
    if (!el) return;
    let bg;
    switch (type) {
        case BLOCK_TYPES.GOLDEN: bg = 'linear-gradient(135deg, #FFE082, #FFC107)'; break;
        case BLOCK_TYPES.BOMB: bg = 'repeating-linear-gradient(45deg, #111, #111 8px, #FF1744 8px, #FF1744 16px)'; break;
        case BLOCK_TYPES.ICE: bg = 'linear-gradient(135deg, #00E5FF, #4FC3F7)'; break;
        case BLOCK_TYPES.CRUMBLE: bg = 'repeating-linear-gradient(45deg, #5D4037, #5D4037 6px, #3E2723 6px, #3E2723 12px)'; break;
        case BLOCK_TYPES.RAINBOW: bg = 'linear-gradient(90deg, #FF1744, #FF9100, #FFEA00, #00E676, #00B0FF, #651FFF, #D500F9)'; break;
        case BLOCK_TYPES.DRAGON: bg = 'linear-gradient(135deg, #FFEB3B, #B71C1C)'; break;
        case BLOCK_TYPES.DIAMOND: bg = 'linear-gradient(135deg, #E0F7FA, #006064)'; break;
        default: bg = color;
    }
    el.style.background = bg;
}

function createBaseBlock() {
    nextBlockData = generateNextBlockData();
    const baseSize = dailyModifiers.baseSize || BLOCK_SIZE;
    const base = createBlockMesh(baseSize, BLOCK_HEIGHT, baseSize, '#FF1744', BLOCK_TYPES.NORMAL);
    base.position.set(0, 0, 0);
    scene.add(base);
    blocks.push(base);
    spawnNewBlock();
}

function spawnNewBlock() {
    const top = blocks[blocks.length - 1];
    if (dailyModifiers.diagFromStart) movingAxis = 'diag';
    else if (score > GAME_CONFIG.DIAGONAL_START_SCORE) movingAxis = 'diag';
    else movingAxis = blocks.length % 2 === 1 ? 'x' : 'z';
    const { type, color } = nextBlockData;
    nextBlockData = generateNextBlockData();
    updateNextBlockPreview(nextBlockData.type, nextBlockData.color);
    const w = top.geometry.parameters.width, d = top.geometry.parameters.depth;
    let sx = top.position.x, sz = top.position.z;
    if (movingAxis === 'x') sx = direction === 1 ? -GAME_CONFIG.MOVE_RANGE : GAME_CONFIG.MOVE_RANGE;
    else if (movingAxis === 'z') sz = direction === 1 ? -GAME_CONFIG.MOVE_RANGE : GAME_CONFIG.MOVE_RANGE;
    else if (movingAxis === 'diag') {
        sx = direction === 1 ? -GAME_CONFIG.MOVE_RANGE : GAME_CONFIG.MOVE_RANGE;
        sz = direction === 1 ? -GAME_CONFIG.MOVE_RANGE : GAME_CONFIG.MOVE_RANGE;
    }
    currentBlock = createBlockMesh(w, BLOCK_HEIGHT, d, color, type);
    currentBlock.position.set(sx, top.position.y + BLOCK_HEIGHT, sz);
    currentBlock.userData = { w, d, moving: true, color, blockType: type, squash: 1 };
    scene.add(currentBlock);
}

// ============ GAME LOGIC ============
function showPopup(el, text, duration = 800) {
    if (!el) return;
    if (text) {
        el.innerText = text;
        announceToScreenReader(text);
    }
    el.classList.add('show-popup');
    setTimeout(() => el.classList.remove('show-popup'), duration);
}

function flashScreen() {
    if (screenFlash) {
        screenFlash.style.opacity = '0.6';
        setTimeout(() => screenFlash.style.opacity = '0', 100);
    }
}

function dropBlock() {
    if (gameState !== GAME_STATES.PLAYING || !currentBlock?.userData.moving) return;
    if (showTutorialHint) {
        tutorialEl.style.display = 'none';
        safeSetItem(STORAGE_KEYS.TUTORIAL_SHOWN, true);
        showTutorialHint = false;
    }
    currentBlock.userData.moving = false;
    const top = blocks[blocks.length - 1];
    const bType = currentBlock.userData.blockType;
    let diffX = 0, diffZ = 0;
    const sizeX = currentBlock.geometry.parameters.width;
    const sizeZ = currentBlock.geometry.parameters.depth;
    if (movingAxis === 'x') diffX = currentBlock.position.x - top.position.x;
    else if (movingAxis === 'z') diffZ = currentBlock.position.z - top.position.z;
    else if (movingAxis === 'diag') {
        diffX = currentBlock.position.x - top.position.x;
        diffZ = currentBlock.position.z - top.position.z;
    }
    let absDiffX = Math.abs(diffX), absDiffZ = Math.abs(diffZ);
    let maxDiff = Math.max(absDiffX, absDiffZ);
    
    if (activePowerups.magnet && !magnetUsed) {
        magnetUsed = true;
        currentBlock.position.x = top.position.x;
        currentBlock.position.z = top.position.z;
        diffX = 0; diffZ = 0; absDiffX = 0; absDiffZ = 0; maxDiff = 0;
        showPopup(bonusText, '🧲 МАГНИТ!', 1200);
    }
    
    if (bType === BLOCK_TYPES.DIAMOND) {
        currentBlock.position.x = top.position.x;
        currentBlock.position.z = top.position.z;
        diffX = 0; diffZ = 0; absDiffX = 0; absDiffZ = 0; maxDiff = 0;
    }
    
    const missX = (movingAxis === 'x' || movingAxis === 'diag') && absDiffX >= sizeX / 2;
    const missZ = (movingAxis === 'z' || movingAxis === 'diag') && absDiffZ >= sizeZ / 2;
    const precisionMode = (gameMode === GAME_MODES.PRECISION);
    const noCutActive = dailyModifiers.noCut || precisionMode;
    const perfectThreshold = dailyModifiers.tightThreshold || GAME_CONFIG.PERFECT_THRESHOLD;
    
    if (activePowerups.ghost && !ghostUsed && (missX || missZ || (noCutActive && maxDiff >= perfectThreshold))) {
        ghostUsed = true;
        showPopup(bonusText, '👻 ПРИЗРАК СПАС!', 1500);
        playSound('quest');
        currentBlock.position.x = top.position.x;
        currentBlock.position.z = top.position.z;
        diffX = 0; diffZ = 0; absDiffX = 0; absDiffZ = 0; maxDiff = 0;
    }
    
    if (missX || missZ) {
        currentBlock.userData.falling = true;
        triggerGameOver();
        return;
    }
    if (noCutActive && maxDiff >= perfectThreshold) {
        currentBlock.userData.falling = true;
        triggerGameOver();
        return;
    }
    if (bType === BLOCK_TYPES.CRUMBLE && maxDiff < perfectThreshold) {
        currentBlock.position.x = top.position.x;
        currentBlock.position.z = top.position.z;
        spawnBombParticles();
        triggerGameOver();
        return;
    }
    
    if (maxDiff < perfectThreshold) {
        currentBlock.position.x = top.position.x;
        currentBlock.position.z = top.position.z;
        if (!dailyModifiers.noCombo) combo++;
        stats.totalPerfect++;
        if (combo > stats.maxCombo) stats.maxCombo = combo;
        let points = 1;
        let isSecret = false;
        if (bType === BLOCK_TYPES.GOLDEN) {
            points = GAME_CONFIG.POINTS_GOLDEN;
            updateQuest('golden', 1);
            stats.totalGolden++;
        } else if (bType === BLOCK_TYPES.BOMB) {
            points = GAME_CONFIG.POINTS_BOMB;
            updateQuest('bomb', 1);
            stats.totalBomb++;
        } else if (bType === BLOCK_TYPES.ICE) {
            points = GAME_CONFIG.POINTS_ICE;
            updateQuest('ice', 1);
            stats.totalIce++;
        } else if (bType === BLOCK_TYPES.RAINBOW) {
            points = GAME_CONFIG.POINTS_RAINBOW;
            isSecret = true;
            stats.totalSecret++;
            updateQuest('secret', 1);
            playSound('secret');
            showPopup(bonusText, `🌈 РАДУГА +${GAME_CONFIG.POINTS_RAINBOW}!`, 1500);
        } else if (bType === BLOCK_TYPES.DRAGON) {
            points = GAME_CONFIG.POINTS_DRAGON;
            isSecret = true;
            stats.totalSecret++;
            updateQuest('secret', 1);
            playSound('secret');
            showPopup(bonusText, `🐉 ДРАКОН +${GAME_CONFIG.POINTS_DRAGON}!`, 1500);
            spawnDragonFire();
            shakeIntensity = GAME_CONFIG.SHAKE_DRAGON;
        } else if (bType === BLOCK_TYPES.DIAMOND) {
            points = GAME_CONFIG.POINTS_DIAMOND;
            isSecret = true;
            stats.totalSecret++;
            updateQuest('secret', 1);
            playSound('secret');
            showPopup(bonusText, `💎 АЛМАЗ +${GAME_CONFIG.POINTS_DIAMOND}!`, 1500);
        }
        
        if (bType === BLOCK_TYPES.BOMB) {
            playSound('bomb');
            showPopup(bonusText, '💥 БУМ! +2', 1000);
            shakeIntensity = GAME_CONFIG.SHAKE_BOMB;
        } else if (bType === BLOCK_TYPES.GOLDEN) {
            playSound('perfect', combo);
            showPopup(bonusText, '👑 ЗОЛОТО +3', 900);
        } else if (bType === BLOCK_TYPES.ICE) {
            playSound('perfect', combo);
            showPopup(bonusText, '❄️ ЛЕД +2', 900);
        } else if (!isSecret) {
            playSound('perfect', combo);
            showPopup(perfectText, null, 600);
        }
        flashScreen();
        
        if (gameMode === GAME_MODES.TIME) {
            timeLeft += GAME_CONFIG.TIME_BONUS_PERFECT;
            updateTimerDisplay();
        }
        if (gameMode === GAME_MODES.STORM) {
            windGustBoost = 0;
            windStrength *= 0.75;
            updateWindUI();
        }
        
        // Проверка ярости
        if (combo >= GAME_CONFIG.FURY_COMBO_REQUIRED && !isFury && !dailyModifiers.noFury) {
            isFury = true;
            furyBlocksLeft = GAME_CONFIG.FURY_BLOCKS_COUNT;
            document.body.classList.add('fury-active');
            playSound('fury');
            showPopup(milestoneText, '🔥 ЯРОСТЬ! x2', 2000);
            updateQuest('fury', 1);
            stats.totalFury++;
            updateMissionProgress(missions, 'fury', 1);
        }
        
        if (combo > 1 && !isFury) showPopup(comboText, `СЕРИЯ x${combo}`, 800);
        
        // Применяем комбо-множитель
        const comboResult = applyComboMultiplier(points, combo);
        points = comboResult.points;
        
        // Проверяем переход на новый тир комбо
        const tierUpgrade = checkTierUpgrade(combo - 1, combo);
        if (tierUpgrade) {
            showPopup(milestoneText, `${tierUpgrade.icon} ${tierUpgrade.name}!`, 1500);
            playSound(tierUpgrade.sound);
            triggerHaptic('success');
            shakeIntensity = 0.3 + tierUpgrade.tierIndex * 0.1;
        }
        
        if (isFury) points *= GAME_CONFIG.FURY_MULTIPLIER;
        if (dailyModifiers.scoreMult) points = Math.round(points * dailyModifiers.scoreMult);
        const skinMods = getSkinModifiers();
        if (skinMods.scoreMult) points = Math.round(points * skinMods.scoreMult);
        
        updateQuest('perfect', 1);
        updateQuest('combo', combo, true);
        updateMissionProgress(missions, 'perfect', 1);
        updateMissionProgress(missions, 'combo', combo, true);
        if (bType === BLOCK_TYPES.GOLDEN) updateMissionProgress(missions, 'golden', 1);
        if (bType === BLOCK_TYPES.BOMB) updateMissionProgress(missions, 'bomb', 1);
        if (bType === BLOCK_TYPES.ICE) updateMissionProgress(missions, 'ice', 1);
        if (isSecret) updateMissionProgress(missions, 'secret', 1);
        
        triggerHaptic('light');
        const oldScore = score;
        score += points;
        updateMissionProgress(missions, 'score', score, true);
        checkMilestone(oldScore, score);
        triggerPerfectParticles();
        
        if (skinMods.fireChance && Math.random() < skinMods.fireChance) {
            spawnDragonFire();
            shakeIntensity = GAME_CONFIG.SHAKE_FIRE;
            addCoins(GAME_CONFIG.COINS_FIRE_BONUS);
            showPopup(bonusText, '🔥 ОГОНЬ!', 1200);
        }
        if (unlockedFeatures.goldenTrail) {
            spawnGoldenTrail(currentBlock.position);
        }
        
        let coinReward = GAME_CONFIG.COINS_PERFECT;
        if (bType === BLOCK_TYPES.GOLDEN) coinReward += GAME_CONFIG.COINS_GOLDEN_BONUS;
        else if (bType === BLOCK_TYPES.BOMB) coinReward += GAME_CONFIG.COINS_BOMB_BONUS;
        else if (bType === BLOCK_TYPES.ICE) coinReward += GAME_CONFIG.COINS_ICE_BONUS;
        else if (isSecret) coinReward += GAME_CONFIG.COINS_SECRET_BONUS;
        addCoins(coinReward);
        
        updateComboIndicator();
    } else {
        combo = 0;
        updateQuest('cut', 1);
        updateMissionProgress(missions, 'cuts', 1);
        updateComboIndicator();
        if (bType === BLOCK_TYPES.BOMB) {
            score = Math.max(0, score - 1);
            playSound('bomb');
            shakeIntensity = GAME_CONFIG.SHAKE_BOMB;
            showPopup(bonusText, '💣 -1 ОЧКО', 900);
            spawnBombParticles();
            triggerHaptic('error');
        } else {
            playSound('drop');
            triggerHaptic('light');
        }
        let cutAxis = movingAxis === 'diag' ? (absDiffX > absDiffZ ? 'x' : 'z') : movingAxis;
        let cutDiff = cutAxis === 'x' ? diffX : diffZ;
        let origSize = cutAxis === 'x' ? sizeX : sizeZ;
        let newSize = origSize - Math.abs(cutDiff);
        if (gameMode === GAME_MODES.ENDLESS) newSize = Math.min(origSize, newSize + 0.4);
        createDebris(cutDiff, origSize, newSize, cutAxis, top);
        const w = cutAxis === 'x' ? newSize : currentBlock.userData.w;
        const d = cutAxis === 'z' ? newSize : currentBlock.userData.d;
        const prevColor = currentBlock.userData.color;
        scene.remove(currentBlock);
        disposeMesh(currentBlock);
        const nm = createBlockMesh(w, BLOCK_HEIGHT, d, prevColor, BLOCK_TYPES.NORMAL);
        let targetX = top.position.x, targetZ = top.position.z;
        if (cutAxis === 'x') targetX = top.position.x + (diffX > 0 ? (origSize - newSize) / 2 : -(origSize - newSize) / 2);
        if (cutAxis === 'z') targetZ = top.position.z + (diffZ > 0 ? (origSize - newSize) / 2 : -(origSize - newSize) / 2);
        nm.position.set(targetX, currentBlock.position.y, targetZ);
        nm.userData = { w, d, color: prevColor, blockType: BLOCK_TYPES.NORMAL, squash: 1 };
        currentBlock = nm;
        if (bType !== BLOCK_TYPES.BOMB) score++;
        addCoins(GAME_CONFIG.COINS_NORMAL);
    }
    
    currentBlock.userData.squash = 0;
    if (isFury) {
        furyBlocksLeft--;
        if (furyBlocksLeft <= 0) {
            isFury = false;
            document.body.classList.remove('fury-active');
        }
    }
    updateScoreUI();
    let accelMult = dailyModifiers.accelMult || 1;
    if (gameMode === GAME_MODES.ENDLESS) accelMult *= 2;
    currentSpeed = Math.min(dynamicMaxSpeed, BASE_SPEED + score * GAME_CONFIG.SPEED_ACCELERATION * accelMult);
    musicTempo = Math.min(GAME_CONFIG.MUSIC_MAX_TEMPO, GAME_CONFIG.MUSIC_BASE_TEMPO + Math.floor(score / 10) * GAME_CONFIG.MUSIC_TEMPO_INCREMENT);
    blocks.push(currentBlock);
    scene.add(currentBlock);
    spawnNewBlock();
}

function updateScoreUI() {
    updateDOMText(scoreEl, score);
    scoreEl.classList.add('score-pop');
    setTimeout(() => scoreEl.classList.remove('score-pop'), 150);
    updateQuest('stack', score, true);
    if (score % 10 === 0 && score > 0) {
        announceToScreenReader(`${score} этажей!`);
    }
}

function checkMilestone(oldScore, newScore) {
    const oldM = Math.floor(oldScore / 10);
    const newM = Math.floor(newScore / 10);
    if (newM > oldM) triggerMilestone(newM * 10);
}

function spawnGoldenTrail(pos) {
    for (let i = 0; i < 6; i++) {
        const p = new THREE.Mesh(
            new THREE.SphereGeometry(0.1, 6, 6),
            new THREE.MeshBasicMaterial({ color: 0xFFD700 })
        );
        p.position.copy(pos);
        p.position.x += (Math.random() - 0.5) * 2;
        p.position.z += (Math.random() - 0.5) * 2;
        p.position.y += 0.5;
        p.userData = {
            vel: new THREE.Vector3((Math.random() - 0.5) * 0.4, Math.random() * 0.5 + 0.2, (Math.random() - 0.5) * 0.4),
            life: 1.0
        };
        scene.add(p);
        debris.push(p);
    }
}

function triggerPerfectParticles() {
    const count = Math.min(12, PARTICLE_LIMITS.MAX_DEBRIS - debris.length);
    for (let i = 0; i < count; i++) {
        const p = new THREE.Mesh(
            new THREE.SphereGeometry(0.15, 8, 8),
            new THREE.MeshBasicMaterial({ color: 0x06D6A0 })
        );
        p.position.copy(currentBlock.position);
        p.position.y += 0.5;
        p.userData = {
            vel: new THREE.Vector3((Math.random() - 0.5) * 0.6, Math.random() * 0.6 + 0.2, (Math.random() - 0.5) * 0.6),
            life: 1.0
        };
        scene.add(p);
        debris.push(p);
    }
}

function spawnBombParticles() {
    const count = Math.min(20, PARTICLE_LIMITS.MAX_DEBRIS - debris.length);
    for (let i = 0; i < count; i++) {
        const p = new THREE.Mesh(
            new THREE.SphereGeometry(0.2, 8, 8),
            new THREE.MeshBasicMaterial({ color: i % 2 ? 0xFF1744 : 0xFFC107 })
        );
        p.position.copy(currentBlock.position);
        p.userData = {
            vel: new THREE.Vector3((Math.random() - 0.5) * 1.2, Math.random() * 0.8 + 0.3, (Math.random() - 0.5) * 1.2),
            life: 1.0
        };
        scene.add(p);
        debris.push(p);
    }
}

function spawnDragonFire() {
    const count = Math.min(30, PARTICLE_LIMITS.MAX_DEBRIS - debris.length);
    for (let i = 0; i < count; i++) {
        const colorChoices = [0xFFEB3B, 0xFF9800, 0xE65100, 0xFF5722];
        const p = new THREE.Mesh(
            new THREE.SphereGeometry(0.25, 8, 8),
            new THREE.MeshBasicMaterial({ color: colorChoices[i % 4] })
        );
        p.position.copy(currentBlock.position);
        p.position.x += (Math.random() - 0.5) * 3;
        p.position.y += Math.random() * 2;
        p.position.z += (Math.random() - 0.5) * 3;
        p.userData = {
            vel: new THREE.Vector3((Math.random() - 0.5) * 0.5, Math.random() * 1.5 + 0.5, (Math.random() - 0.5) * 0.5),
            life: 1.0
        };
        scene.add(p);
        debris.push(p);
    }
}

function triggerMilestone(points) {
    playSound('milestone');
    triggerHaptic('success');
    const bgColors = getBgColors();
    const newBiome = Math.floor(points / 10) % bgColors.length;
    currentBiomeIndex = newBiome;
    targetBgColor.set(bgColors[newBiome]);
    document.body.style.background = bgColors[newBiome];
    showPopup(milestoneText, `${points} ЭТАЖЕЙ!`, 1500);
    addCoins(GAME_CONFIG.COINS_MILESTONE);
    const topPos = blocks[blocks.length - 1].position;
    const count = Math.min(40, PARTICLE_LIMITS.MAX_CONFETTI - confetti.length);
    for (let i = 0; i < count; i++) {
        const piece = new THREE.Mesh(
            new THREE.BoxGeometry(0.2, 0.2, 0.02),
            new THREE.MeshBasicMaterial({ color: MILESTONE_COLORS[Math.floor(Math.random() * MILESTONE_COLORS.length)] })
        );
        piece.position.set(
            topPos.x + (Math.random() - 0.5) * 2,
            topPos.y + 2,
            topPos.z + (Math.random() - 0.5) * 2
        );
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 0.3 + 0.1;
        piece.userData = {
            vel: new THREE.Vector3(Math.cos(angle) * speed, Math.random() * 0.6 + 0.3, Math.sin(angle) * speed),
            rotSpeed: new THREE.Vector3(Math.random() * 0.3, Math.random() * 0.3, Math.random() * 0.3)
        };
        scene.add(piece);
        confetti.push(piece);
    }
}

function createDebris(diff, origSize, newSize, axis, top) {
    const dSize = origSize - newSize;
    if (dSize <= 0.01) return;
    const geo = new THREE.BoxGeometry(
        axis === 'x' ? dSize : currentBlock.userData.w,
        BLOCK_HEIGHT,
        axis === 'z' ? dSize : currentBlock.userData.d
    );
    const mat = new THREE.MeshStandardMaterial({ color: currentBlock.userData.color, roughness: 0.5 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    let px = currentBlock.position.x, pz = currentBlock.position.z;
    if (axis === 'x') px = diff > 0 ? top.position.x + (origSize / 2) + (dSize / 2) : top.position.x - (origSize / 2) - (dSize / 2);
    else pz = diff > 0 ? top.position.z + (origSize / 2) + (dSize / 2) : top.position.z - (origSize / 2) - (dSize / 2);
    mesh.position.set(
        axis === 'x' ? px : currentBlock.position.x,
        currentBlock.position.y,
        axis === 'z' ? pz : currentBlock.position.z
    );
    mesh.userData = {
        vel: new THREE.Vector3(
            axis === 'x' ? (diff > 0 ? 0.15 : -0.15) : 0,
            0.1,
            axis === 'z' ? (diff > 0 ? 0.15 : -0.15) : 0
        ),
        rotSpeed: new THREE.Vector3(
            (Math.random() - 0.5) * 0.3,
            (Math.random() - 0.5) * 0.3,
            (Math.random() - 0.5) * 0.3
        )
    };
    scene.add(mesh);
    debris.push(mesh);
}

// ============ АНИМАЦИИ ============
function playLoseAnimation() {
    const blocksCopy = [...blocks];
    if (currentBlock && currentBlock.parent && !blocksCopy.includes(currentBlock)) {
        blocksCopy.push(currentBlock);
        currentBlock = null;
    }
    blocks = [];
    blocksCopy.forEach((b, i) => {
        setTimeout(() => {
            if (!b.parent) return;
            b.userData.vel = new THREE.Vector3(
                (Math.random() - 0.5) * 0.4,
                -Math.random() * 0.4 - 0.2,
                (Math.random() - 0.5) * 0.4
            );
            b.userData.rotSpeed = new THREE.Vector3(
                (Math.random() - 0.5) * 0.3,
                (Math.random() - 0.5) * 0.3,
                (Math.random() - 0.5) * 0.3
            );
            debris.push(b);
        }, i * 25);
    });
}

function playWinAnimation() {
    playSound('victory');
    triggerHaptic('success');
    if (victoryCrownEl) {
        victoryCrownEl.classList.remove('show');
        void victoryCrownEl.offsetWidth;
        victoryCrownEl.classList.add('show');
        setTimeout(() => victoryCrownEl.classList.remove('show'), 2500);
    }
    const count = Math.min(200, PARTICLE_LIMITS.MAX_CONFETTI - confetti.length);
    for (let i = 0; i < count; i++) {
        const piece = new THREE.Mesh(
            new THREE.BoxGeometry(0.25, 0.25, 0.03),
            new THREE.MeshBasicMaterial({ color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)] })
        );
        piece.position.set(
            (Math.random() - 0.5) * 20,
            camera.position.y - 5 + Math.random() * 5,
            (Math.random() - 0.5) * 20
        );
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 0.5 + 0.15;
        piece.userData = {
            vel: new THREE.Vector3(
                Math.cos(angle) * speed,
                Math.random() * 1.2 + 0.4,
                Math.sin(angle) * speed
            ),
            rotSpeed: new THREE.Vector3(
                Math.random() * 0.5,
                Math.random() * 0.5,
                Math.random() * 0.5
            )
        };
        scene.add(piece);
        confetti.push(piece);
    }
}

// ============ ШТОРМ ============
let windFrame = 0, windGustBoost = 0;
function getStormBaseWind() { return 0.35 + Math.min(0.45, score * 0.012); }

const _updateWindUIInternal = function() {
    if (!windIndicatorEl) return;
    const show = gameMode === GAME_MODES.STORM && (gameState === GAME_STATES.PLAYING || gameState === GAME_STATES.PAUSED);
    updateDOMStyle(windIndicatorEl, 'display', show ? 'flex' : 'none');
    if (!show) return;
    const level = Math.min(1, windStrength / 0.9);
    updateDOMStyle(windFillEl, 'width', `${Math.round(level * 100)}%`);
    updateDOMStyle(windFillEl, 'background', level > 0.6 ? 'linear-gradient(90deg,#FF9100,#FF1744)' : 'linear-gradient(90deg,#00E5FF,#2979FF)');
    updateDOMClass(windIndicatorEl, 'wind-strong', level > 0.6);
    const leftEl = $('wind-left'), rightEl = $('wind-right');
    if (leftEl && rightEl) {
        const active = level > 0.05;
        updateDOMClass(leftEl, 'active', active && windDirection < 0);
        updateDOMClass(rightEl, 'active', active && windDirection > 0);
    }
};
const updateWindUI = throttle(_updateWindUIInternal, 100);

function updateCamera() {
    if (!blocks.length && !debris.length) return;
    const top = blocks.length > 0 ? blocks[blocks.length - 1] : { position: { x: 0, y: 0, z: 0 } };
    const ty = top.position.y, tx = top.position.x * 0.5, tz = top.position.z * 0.5;
    camera.position.x += (tx + GAME_CONFIG.CAMERA_OFFSET_X - camera.position.x) * GAME_CONFIG.CAMERA_LERP_FACTOR;
    camera.position.y += (ty + GAME_CONFIG.CAMERA_OFFSET_Y - camera.position.y) * GAME_CONFIG.CAMERA_LERP_FACTOR;
    camera.position.z += (tz + GAME_CONFIG.CAMERA_OFFSET_Z - camera.position.z) * GAME_CONFIG.CAMERA_LERP_FACTOR;
    camera.lookAt(tx, ty + GAME_CONFIG.CAMERA_LOOK_OFFSET_Y, tz);
    if (shakeIntensity > 0.01) {
        camera.position.x += (Math.random() - 0.5) * shakeIntensity;
        camera.position.y += (Math.random() - 0.5) * shakeIntensity;
        camera.position.z += (Math.random() - 0.5) * shakeIntensity;
        shakeIntensity *= GAME_CONFIG.CAMERA_SHAKE_DECAY;
    }
}

function animate() {
    requestAnimationFrame(animate);
    const time = clock.getElapsedTime();
    updateFpsCounter();
    enforceParticleLimits(scene, debris, confetti, disposeMesh);
    
    if (audioCtx && windGain && gameState === GAME_STATES.PLAYING) {
        const windVol = Math.min(0.15, score * 0.005);
        try { windGain.gain.setTargetAtTime(windVol, audioCtx.currentTime, 0.5); } catch(e) {}
    } else if (windGain && audioCtx) {
        try { windGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.5); } catch(e) {}
    }
    if (bgStarsGroup) bgStarsGroup.rotation.y += 0.0003;
    blocks.forEach(b => {
        const bt = b.userData.blockType;
        if (bt !== BLOCK_TYPES.NORMAL && bt !== BLOCK_TYPES.CRUMBLE) {
            const isSecret = bt === BLOCK_TYPES.RAINBOW || bt === BLOCK_TYPES.DRAGON || bt === BLOCK_TYPES.DIAMOND;
            const pulse = bt === BLOCK_TYPES.BOMB ? (0.5 + Math.sin(time * 6) * 0.3) : (0.4 + Math.sin(time * (isSecret ? 8 : 4)) * 0.2);
            b.material.forEach(m => {
                if (m.emissive) m.emissiveIntensity = pulse + (isSecret ? 0.3 : 0);
            });
            if (b.userData.glowSprite) {
                b.userData.glowSprite.material.opacity = 0.4 + Math.sin(time * (isSecret ? 6 : 4)) * 0.3;
            }
        }
    });
    if (gameState === GAME_STATES.PLAYING && currentBlock?.userData.moving) {
        let speed = currentSpeed;
        if (isFury) speed *= GAME_CONFIG.FURY_SPEED_MULTIPLIER;
        if (currentBlock.userData.blockType === BLOCK_TYPES.ICE || dailyModifiers.allIce) speed = Math.min(speed * 1.8, 0.8);
        let delta = speed * direction;
        if (score > 20 && !isFury) delta += Math.sin(performance.now() * 0.003) * 0.02;
        if (movingAxis === 'x') {
            currentBlock.position.x += delta;
            if (currentBlock.position.x > GAME_CONFIG.MOVE_RANGE) direction = -1;
            if (currentBlock.position.x < -GAME_CONFIG.MOVE_RANGE) direction = 1;
        } else if (movingAxis === 'z') {
            currentBlock.position.z += delta;
            if (currentBlock.position.z > GAME_CONFIG.MOVE_RANGE) direction = -1;
            if (currentBlock.position.z < -GAME_CONFIG.MOVE_RANGE) direction = 1;
        } else if (movingAxis === 'diag') {
            currentBlock.position.x += delta;
            currentBlock.position.z += delta * GAME_CONFIG.DIAG_FACTOR;
            if (currentBlock.position.x > GAME_CONFIG.MOVE_RANGE || currentBlock.position.z > GAME_CONFIG.MOVE_RANGE) direction = -1;
            if (currentBlock.position.x < -GAME_CONFIG.MOVE_RANGE || currentBlock.position.z < -GAME_CONFIG.MOVE_RANGE) direction = 1;
        }
        if (gameMode === GAME_MODES.STORM) {
            const gust = 0.6 + Math.sin(time * 2.3) * 0.6 + Math.sin(time * 5.7) * 0.3;
            delta += windStrength * (windGustBoost > 0 ? 1.4 : 1) * gust * windDirection * 0.1;
        }
    }
    if (gameMode === GAME_MODES.STORM && gameState === GAME_STATES.PLAYING) {
        windGustBoost *= 0.992;
        if (windGustBoost < 0.005) windGustBoost = 0;
        if (windGustBoost === 0) {
            const target = getStormBaseWind();
            windStrength += (target - windStrength) * 0.02;
        } else {
            windStrength += 0.012;
        }
        if (windStrength > 0.9) windStrength = 0.9;
        if (windFrame++ % 3 === 0) updateWindUI();
    }
    blocks.forEach(b => {
        if (b.userData.squash !== undefined && b.userData.squash < 1) {
            b.userData.squash += 0.1;
            if (b.userData.squash > 1) b.userData.squash = 1;
            const scaleY = 1 - Math.sin(b.userData.squash * Math.PI) * 0.3;
            const scaleXZ = 1 + Math.sin(b.userData.squash * Math.PI) * 0.15;
            b.scale.set(scaleXZ, scaleY, scaleXZ);
        }
    });
    if (currentBlock?.userData.falling) {
        currentBlock.position.y -= 0.3;
        currentBlock.rotation.x += 0.05;
        currentBlock.rotation.z += 0.05;
    }
    for (let i = debris.length - 1; i >= 0; i--) {
        const d = debris[i];
        d.position.add(d.userData.vel);
        d.userData.vel.y -= 0.02;
        if (d.userData.rotSpeed) {
            d.rotation.x += d.userData.rotSpeed.x;
            d.rotation.y += d.userData.rotSpeed.y;
            d.rotation.z += d.userData.rotSpeed.z;
        }
        if (d.userData.life !== undefined) {
            d.userData.life -= 0.02;
            d.scale.setScalar(d.userData.life);
            if (d.userData.life <= 0) {
                scene.remove(d);
                disposeMesh(d);
                debris.splice(i, 1);
                continue;
            }
        }
        if (d.position.y < camera.position.y - 40) {
            scene.remove(d);
            disposeMesh(d);
            debris.splice(i, 1);
        }
    }
    for (let i = confetti.length - 1; i >= 0; i--) {
        const c = confetti[i];
        c.position.add(c.userData.vel);
        c.userData.vel.y -= 0.015;
        c.userData.vel.x *= 0.98;
        c.userData.vel.z *= 0.98;
        c.rotation.x += c.userData.rotSpeed.x;
        c.rotation.y += c.userData.rotSpeed.y;
        c.rotation.z += c.userData.rotSpeed.z;
        if (c.position.y < camera.position.y - 40) {
            scene.remove(c);
            disposeMesh(c);
            confetti.splice(i, 1);
        }
    }
    if (gameState === GAME_STATES.PLAYING || gameState === GAME_STATES.GAMEOVER) updateCamera();
    scene.background.lerp(targetBgColor, 0.05);
    renderer.render(scene, camera);
}

function clearScene() {
    blocks.forEach(b => { scene.remove(b); disposeMesh(b); });
    debris.forEach(d => { scene.remove(d); disposeMesh(d); });
    confetti.forEach(c => { scene.remove(c); disposeMesh(c); });
    blocks = []; debris = []; confetti = []; currentBlock = null;
}

// ============ STATE MANAGEMENT ============
function startGame(mode) {
    try {
        initAudio();
        stopMusic();
        clearScene();
        if (mode) gameMode = mode;
        score = 0; combo = 0; sessionCoins = 0; sessionXP = 0;
        isFury = false; furyBlocksLeft = 0;
        document.body.classList.remove('fury-active');
        magnetUsed = false; ghostUsed = false;
        if (freezeTimer) { clearTimeout(freezeTimer); freezeTimer = null; }
        if (showTutorialHint) tutorialEl.style.display = 'block';
        updateActivePowerupsUI();
        updateComboIndicator();
        
        if (dailyChallengeActive) {
            if (dailyModifiers.forceBg && !savedBgBeforeDaily) {
                savedBgBeforeDaily = currentBackground;
                currentBackground = dailyModifiers.forceBg;
                applyBackground();
            }
            if (dailyModifiers.forcePalette && !savedPaletteBeforeDaily) {
                savedPaletteBeforeDaily = currentPalette;
                currentPalette = dailyModifiers.forcePalette;
            }
        }
        dynamicMaxSpeed = gameMode === GAME_MODES.ENDLESS ? GAME_CONFIG.ENDLESS_MAX_SPEED : GAME_CONFIG.DEFAULT_MAX_SPEED;
        windDirection = Math.random() < 0.5 ? -1 : 1;
        windGustBoost = 0;
        windStrength = gameMode === GAME_MODES.STORM ? getStormBaseWind() : 0;
        if (windGustTimer) { clearInterval(windGustTimer); windGustTimer = null; }
        if (gameMode === GAME_MODES.STORM) {
            windGustTimer = setInterval(() => {
                if (gameState !== GAME_STATES.PLAYING) return;
                windGustBoost = 0.45;
                windDirection = Math.random() < 0.35 ? -windDirection : windDirection;
                shakeIntensity = Math.max(shakeIntensity, GAME_CONFIG.SHAKE_GUST);
                playSound('gust');
                showPopup(bonusText, '🌪 ПОРЫВ ВЕТРА!', 1200);
            }, GAME_CONFIG.WIND_GUST_MIN_INTERVAL + Math.random() * GAME_CONFIG.WIND_GUST_MAX_INTERVAL);
        }
        updateWindUI();
        let baseSpeed = BASE_SPEED;
        if (!dailyChallengeActive) baseSpeed *= getSmartDifficultyMultiplier();
        if (dailyModifiers.speedMult) baseSpeed *= dailyModifiers.speedMult;
        if (gameMode === GAME_MODES.STORM) baseSpeed *= 1.1;
        if (gameMode === GAME_MODES.MIRROR) baseSpeed *= 1.15;
        const skinMods = getSkinModifiers();
        if (skinMods.speedMult) baseSpeed *= skinMods.speedMult;
        direction = gameMode === GAME_MODES.MIRROR ? -1 : 1;
        updateDOMText(scoreEl, score);
        currentSpeed = dailyModifiers.startSpeed !== undefined ? dailyModifiers.startSpeed : baseSpeed;
        musicTempo = GAME_CONFIG.MUSIC_BASE_TEMPO;
        gameState = GAME_STATES.PLAYING;
        currentBiomeIndex = 0;
        const bgColors = getBgColors();
        targetBgColor.set(bgColors[0]);
        scene.background.set(bgColors[0]);
        document.body.style.background = bgColors[0];
        document.body.classList.add('in-game');
        if (activePowerups.freeze) {
            currentSpeed *= 0.5;
            freezeTimer = setTimeout(() => {
                if (gameState === GAME_STATES.PLAYING) currentSpeed = Math.min(dynamicMaxSpeed, baseSpeed + score * GAME_CONFIG.SPEED_ACCELERATION);
            }, GAME_CONFIG.FREEZE_DURATION);
        }
        if (timeAttackTimer) { clearInterval(timeAttackTimer); timeAttackTimer = null; }
        const timeLimit = dailyModifiers.timeLimit || (gameMode === GAME_MODES.TIME ? GAME_CONFIG.DEFAULT_TIME_LIMIT : 0);
        if (timeLimit > 0) {
            timeLeft = timeLimit;
            timerEl.style.display = 'block';
            updateTimerDisplay();
            timeAttackTimer = setInterval(() => {
                if (gameState !== GAME_STATES.PLAYING) return;
                timeLeft--;
                updateTimerDisplay();
                if (timeLeft <= 0) {
                    clearInterval(timeAttackTimer);
                    timeAttackTimer = null;
                    triggerGameOver();
                }
            }, 1000);
        } else {
            timerEl.style.display = 'none';
        }
        if (dailyChallengeActive) {
            const ch = getDailyChallenge();
            modeLabel.innerText = `🎯 ${ch.name}`;
        } else {
            modeLabel.innerText = GAME_MODE_NAMES[gameMode] || 'ИГРА';
        }
        startScreen.style.display = 'none';
        hideModal(gameOverEl);
        hideModal(pauseScreen);
        camera.position.set(GAME_CONFIG.CAMERA_OFFSET_X, GAME_CONFIG.CAMERA_OFFSET_Y, GAME_CONFIG.CAMERA_OFFSET_Z);
        camera.lookAt(0, 0, 0);
        const todayStr = new Date().toDateString();
        if (safeGetItem(STORAGE_KEYS.DAILY_GAME_CHEST, null) !== todayStr) {
            safeSetItem(STORAGE_KEYS.DAILY_GAME_CHEST, todayStr);
            setTimeout(() => addChest('daily_game'), 1000);
        }
        createBaseBlock();
        startMusic();
        updateQuest('games', 1);
        updateMissionProgress(missions, 'games', 1);
        if (gameMode === GAME_MODES.TIME) updateMissionProgress(missions, 'time_game', 1);
        if (gameMode === GAME_MODES.STORM) updateMissionProgress(missions, 'storm_game', 1);
    } catch(err) {
        console.error('startGame error:', err);
        gameState = GAME_STATES.MENU;
        startScreen.style.display = 'flex';
    }
}

function resetActivePowerups() {
    activePowerups = { ...DEFAULTS.ACTIVE_POWERUPS };
    if (freezeTimer) { clearTimeout(freezeTimer); freezeTimer = null; }
    updateActivePowerupsUI();
}

function goToMenu() {
    if (gameState === GAME_STATES.PLAYING) saveCurrentScoreIfNeeded();
    stopMusic();
    clearScene();
    clearTextureCache();
    gameState = GAME_STATES.MENU;
    document.body.classList.remove('in-game', 'fury-active');
    if (timeAttackTimer) { clearInterval(timeAttackTimer); timeAttackTimer = null; }
    if (windGustTimer) { clearInterval(windGustTimer); windGustTimer = null; }
    windStrength = 0;
    updateWindUI();
    resetActivePowerups();
    dailyChallengeActive = false;
    dailyModifiers = {};
    restoreDailyVisuals();
    hideModal(gameOverEl);
    hideModal(pauseScreen);
    hideModal(shopScreen);
    hideModal(rulesScreen);
    hideModal(achScreen);
    hideModal(lbScreen);
    hideModal(settingsScreen);
    hideModal(powerupsScreen);
    hideModal(chestScreen);
    hideModal(missionsScreen);
    hideModal(prestigeConfirmScreen);
    hideModal(prestigeChestScreen);
    startScreen.style.display = 'flex';
    const bgColors = getBgColors();
    scene.background.set(bgColors[0]);
    document.body.style.background = bgColors[0];
    camera.position.set(GAME_CONFIG.CAMERA_OFFSET_X, GAME_CONFIG.CAMERA_OFFSET_Y, GAME_CONFIG.CAMERA_OFFSET_Z);
    camera.lookAt(0, 0, 0);
    if (windGain && audioCtx) {
        try { windGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.5); } catch(e) {}
    }
    updateCoinUI();
    updateLevelUI();
    updateStreakUI();
    updateChestUI();
    renderDailyChallenge();
    updateComboIndicator();
    renderMissions();
    updateMissionsBadge();
    stopMissionsTimer();
    startMissionsTimer();
}

function saveCurrentScoreIfNeeded() {
    if (score > 0 && score > highScore) {
        highScore = score;
        safeSetItem(STORAGE_KEYS.HIGH_SCORE, highScore);
        highScoreEl.innerText = `РЕКОРД: ${highScore}`;
    }
}

function triggerGameOver() {
    if (gameState === GAME_STATES.GAMEOVER) return;
    gameState = GAME_STATES.GAMEOVER;
    playSound('gameover');
    stopMusic();
    shakeIntensity = GAME_CONFIG.SHAKE_GAMEOVER;
    document.body.classList.remove('in-game', 'fury-active');
    if (timeAttackTimer) { clearInterval(timeAttackTimer); timeAttackTimer = null; }
    if (windGustTimer) { clearInterval(windGustTimer); windGustTimer = null; }
    windStrength = 0;
    updateWindUI();
    if (freezeTimer) { clearTimeout(freezeTimer); freezeTimer = null; }
    stats.totalGames++;
    if (score > stats.maxScore) stats.maxScore = score;
    if (gameMode === GAME_MODES.TIME && score > stats.maxTimeScore) stats.maxTimeScore = score;
    saveStats();
    totalScoreAllTime += score;
    saveTotalScore();
    trackGameScore(score);
    let earnedXP = score * 5;
    if (dailyModifiers.xpMult) earnedXP = Math.round(earnedXP * dailyModifiers.xpMult);
    addXP(earnedXP);
    if (gameMode === GAME_MODES.TIME && score > 0) updateQuest('time_game', 1);
    addToLeaderboard(score, gameMode);
    finalScoreVal.innerText = score;
    const isNew = score > highScore;
    if (isNew) {
        highScore = score;
        safeSetItem(STORAGE_KEYS.HIGH_SCORE, highScore);
        highScoreEl.innerText = `РЕКОРД: ${highScore}`;
        setTimeout(() => playWinAnimation(), 300);
    }
    $('new-record').style.display = isNew ? 'block' : 'none';
    gameCoinsEarnedEl.innerText = `+${sessionCoins} 🪙 за игру`;
    gameCoinsEarnedEl.style.display = 'block';
    if (earnedXP > 0) {
        gameXPEarnedEl.innerText = `+${earnedXP} опыта`;
        gameXPEarnedEl.style.display = 'block';
    } else {
        gameXPEarnedEl.style.display = 'none';
    }
    setTimeout(() => playLoseAnimation(), 500);
    checkAchievements();
    resetActivePowerups();
    dailyChallengeActive = false;
    dailyModifiers = {};
    restoreDailyVisuals();
    setTimeout(() => showModal(gameOverEl), 900);
    triggerHaptic('error');
}

function togglePause() {
    if (gameState === GAME_STATES.PLAYING) {
        gameState = GAME_STATES.PAUSED;
        showModal(pauseScreen);
        document.body.classList.remove('in-game');
        if (timeAttackTimer) clearInterval(timeAttackTimer);
        if (freezeTimer) clearTimeout(freezeTimer);
    } else if (gameState === GAME_STATES.PAUSED) {
        gameState = GAME_STATES.PLAYING;
        hideModal(pauseScreen);
        document.body.classList.add('in-game');
        const timeLimit = dailyModifiers.timeLimit || (gameMode === GAME_MODES.TIME ? GAME_CONFIG.DEFAULT_TIME_LIMIT : 0);
        if (timeLimit > 0) {
            timeAttackTimer = setInterval(() => {
                if (gameState !== GAME_STATES.PLAYING) return;
                timeLeft--;
                updateTimerDisplay();
                if (timeLeft <= 0) {
                    clearInterval(timeAttackTimer);
                    triggerGameOver();
                }
            }, 1000);
        }
    }
}

// ============ INPUT ============
function handleInput(e) {
    const target = e.target;
    if (target && target.closest && target.closest('button, .mode-btn, .mini-mode-btn, #top-right-controls, .modal, .powerup-item, .daily-challenge-banner, .lb-mode-tab')) return;
    if (target && target.closest && target.closest('#start-screen, #game-over, #pause-screen, #shop-screen, #rules-screen, #achievements-screen, #leaderboard-screen, #settings-screen, #daily-screen, #powerups-screen, #chest-screen, #missions-screen, #prestige-confirm-screen, #prestige-chest-screen')) return;
    if (isAnyModalOpen()) return;
    if (gameState === GAME_STATES.PLAYING) {
        if (e.type === 'touchstart') e.preventDefault();
        dropBlock();
    }
}

window.addEventListener('mousedown', handleInput);
window.addEventListener('touchstart', handleInput, { passive: false });

function bindModeButton(id, mode) {
    const btn = document.getElementById(id);
    if (!btn) return;
    const handle = (e) => {
        if (e) {
            if (e.cancelable !== false) e.stopPropagation();
            e.preventDefault();
        }
        if (gameState === GAME_STATES.PLAYING) return;
        dailyChallengeActive = false;
        dailyModifiers = {};
        showPowerupSelection(mode);
    };
    btn.addEventListener('click', handle);
    btn.addEventListener('touchend', handle, { passive: false });
}

bindModeButton('btn-classic', GAME_MODES.CLASSIC);
bindModeButton('btn-time', GAME_MODES.TIME);

document.querySelectorAll('.mini-mode-btn').forEach(btn => {
    const handle = (e) => {
        if (e) {
            if (e.cancelable !== false) e.stopPropagation();
            e.preventDefault();
        }
        if (gameState === GAME_STATES.PLAYING) return;
        dailyChallengeActive = false;
        dailyModifiers = {};
        activePowerups = { ...DEFAULTS.ACTIVE_POWERUPS };
        startGame(btn.dataset.mode);
    };
    btn.addEventListener('click', handle);
    btn.addEventListener('touchend', handle, { passive: false });
});

// ============ BUTTONS ============
safeClick($('restart-btn'), () => {
    activePowerups = { ...DEFAULTS.ACTIVE_POWERUPS };
    hideModal(gameOverEl);
    startGame();
});
safeClick($('menu-btn'), () => goToMenu());
safeClick(pauseBtn, () => togglePause());
safeClick($('pause-resume'), () => togglePause());
safeClick($('pause-menu'), () => goToMenu());
safeClick(menuToggleBtn, () => {
    if (gameState === GAME_STATES.PLAYING || gameState === GAME_STATES.PAUSED) goToMenu();
});
safeClick($('shop-btn'), () => {
    switchShopTab('skins');
    renderShop();
    showModal(shopScreen);
    startScreen.style.display = 'none';
});
safeClick($('close-shop'), () => {
    hideModal(shopScreen);
    startScreen.style.display = 'flex';
    updateCoinUI();
});
safeClick($('rules-btn'), () => {
    showModal(rulesScreen);
    startScreen.style.display = 'none';
});
safeClick($('close-rules'), () => {
    hideModal(rulesScreen);
    startScreen.style.display = 'flex';
});
safeClick($('ach-btn'), () => {
    renderAchievements();
    showModal(achScreen);
    startScreen.style.display = 'none';
});
safeClick($('close-achievements'), () => {
    hideModal(achScreen);
    startScreen.style.display = 'flex';
});
safeClick($('lb-btn'), () => {
    currentLbMode = GAME_MODES.CLASSIC;
    renderLeaderboard();
    showModal(lbScreen);
    startScreen.style.display = 'none';
});
safeClick($('close-leaderboard'), () => {
    hideModal(lbScreen);
    startScreen.style.display = 'flex';
});
safeClick($('settings-btn'), () => {
    updateSettingsUI();
    showModal(settingsScreen);
    startScreen.style.display = 'none';
});
safeClick($('close-settings'), () => {
    hideModal(settingsScreen);
    startScreen.style.display = 'flex';
});
safeClick($('chest-btn'), () => showChestOpening());
safeClick($('open-chest-btn'), () => openChest());
safeClick($('close-chest'), () => {
    hideModal(chestScreen);
    startScreen.style.display = 'flex';
    updateCoinUI();
});
safeClick($('close-powerups'), () => {
    hideModal(powerupsScreen);
    startScreen.style.display = 'flex';
    pendingGameMode = null;
});
safeClick($('start-with-powerups'), () => startGameWithPowerups());
safeClick(dailyPlayBtn, () => {
    if (!getDailyChallengeStatus()) startDailyChallenge();
});

// Кнопки миссий
safeClick($('missions-btn'), () => {
    renderMissions();
    showModal(missionsScreen);
    startScreen.style.display = 'none';
});
safeClick($('close-missions'), () => {
    hideModal(missionsScreen);
    startScreen.style.display = 'flex';
});

// Кнопки престижа
safeClick(prestigeActivateBtnEl, () => {
    if (canPrestige(level)) showPrestigeConfirm();
});
safeClick(prestigeConfirmBtn, () => activatePrestige());
safeClick(prestigeCancelBtn, () => hideModal(prestigeConfirmScreen));
safeClick(openPrestigeChestBtn, () => openPrestigeChest());
safeClick(closePrestigeChestBtn, () => {
    hideModal(prestigeChestScreen);
    startScreen.style.display = 'flex';
    updateCoinUI();
    updatePrestigeUI();
});

document.querySelectorAll('.shop-tab').forEach(tab => {
    safeClick(tab, () => switchShopTab(tab.dataset.tab));
});
document.querySelectorAll('.lb-mode-tab').forEach(tab => {
    safeClick(tab, () => {
        currentLbMode = tab.dataset.mode;
        renderLeaderboard();
    });
});
safeClick($('toggle-music'), () => {
    settings.musicEnabled = !settings.musicEnabled;
    saveSettings();
    updateSettingsUI();
    if (!settings.musicEnabled) stopMusic();
    else if (gameState === GAME_STATES.PLAYING) startMusic();
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
});
safeClick($('claim-daily'), () => {
    if (dailyRewardPending) {
        addCoins(dailyRewardAmount);
        dailyRewardPending = false;
        playSound('quest');
        triggerHaptic('success');
    }
    hideModal(dailyScreen);
    startScreen.style.display = 'flex';
});
safeClick(muteBtn, () => {
    const allOn = settings.musicEnabled || settings.sfxEnabled;
    if (allOn) {
        settings.musicEnabled = false;
        settings.sfxEnabled = false;
        stopMusic();
        if (windGain && audioCtx) {
            try { windGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.1); } catch(e) {}
        }
    } else {
        settings.musicEnabled = true;
        settings.sfxEnabled = true;
        if (gameState === GAME_STATES.PLAYING) startMusic();
    }
    saveSettings();
    updateSettingsUI();
});
safeClick($('challenge-btn'), () => {
    const text = `Я построил башню на ${score} этажей в игре «Башня хайпа»! Слабо побить мой рекорд? 🏗️`;
    const url = window.location.href;
    if (tg) tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`);
    else window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`, '_blank');
});

function onResize() {
    if (!camera || !renderer) return;
    const aspect = window.innerWidth / window.innerHeight;
    const d = getAdaptiveD(aspect);
    camera.left = -d * aspect;
    camera.right = d * aspect;
    camera.top = d;
    camera.bottom = -d;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function updateTimerDisplay() {
    updateDOMText(timerEl, `⏱ ${timeLeft}`);
    updateDOMStyle(timerEl, 'color', timeLeft <= 10 ? '#EF476F' : '#06D6A0');
}

// ============ INIT ============
initThree();
initSeason();
loadQuests();
updateCoinUI();
updateLevelUI();
updateSettingsUI();
updateChestUI();
updateActivePowerupsUI();
renderDailyChallenge();
initMissions();

// Миграция старых лидербордов
(function migrateLeaderboard() {
    let changed = false;
    leaderboard.forEach((e, i) => {
        if (typeof e.ts !== 'number') {
            e.ts = i;
            changed = true;
        }
    });
    if (changed) saveLeaderboard();
})();

checkDailyStreak();
if (dailyRewardPending) {
    setTimeout(() => showDailyReward(), 400);
}

// Нормализуем размеры шрифтов для консистентности
normalizeFontSizes();

// Добавляем декоративные звёзды на главный экран
const startContent = document.querySelector('.start-content');
if (startContent) addDecorativeStars(startContent, 25);

// Анимируем появление кнопок режимов
const modeButtons = document.querySelectorAll('.mode-btn, .mini-mode-btn');
animateElementsSequentially(modeButtons, 'fadeInUp', 80);

animate();
