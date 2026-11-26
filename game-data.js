// game-data.js — статический контент игры (скины, палитры, фоны, испытания, квесты)

import { PRESTIGE_SKINS } from './prestige.js?v=18';
import { EVENT_SKINS } from './seasonal-events.js?v=18';

export const BASE_COLORS = [
    '#FF1744', '#F50057', '#D500F9', '#651FFF', '#2979FF', '#00B0FF',
    '#00E5FF', '#1DE9B6', '#00E676', '#FFEA00', '#FF9100', '#FF3D00'
];

export const SKIN_RARITIES = {
    common:    { label: 'Обычный',     color: '#78909C', bg: '#ECEFF1', order: 0 },
    rare:      { label: 'Редкий',      color: '#1E88E5', bg: '#E3F2FD', order: 1 },
    epic:      { label: 'Эпический',   color: '#8E24AA', bg: '#F3E5F5', order: 2 },
    legendary: { label: 'Легендарный', color: '#E65100', bg: '#FFF8E1', order: 3 },
};

export const SKINS = {
    // === ОБЫЧНЫЕ (без текстур и бафов, только цвета) ===
    default:      { name: 'Классика',  rarity: 'common', price: 0,    pattern: 'none', colors: BASE_COLORS },
    pastel_basic: { name: 'Пастель',   rarity: 'common', price: 200,  pattern: 'none', colors: ['#FFB3BA', '#FFDFBA', '#FFFFBA', '#BAFFC9', '#BAE1FF', '#E0BBE4'] },
    forest_basic: { name: 'Хвоя',      rarity: 'common', price: 350,  pattern: 'none', colors: ['#2E7D32', '#43A047', '#66BB6A', '#81C784', '#558B2F', '#33691E'] },
    sunset_basic: { name: 'Закат',     rarity: 'common', price: 500,  pattern: 'none', colors: ['#FF6B6B', '#FF8E53', '#FFB74D', '#FFD54F', '#FF7043', '#D84315'] },
    berry_basic:  { name: 'Ягода',     rarity: 'common', price: 650,  pattern: 'none', colors: ['#AD1457', '#D81B60', '#EC407A', '#F48FB1', '#880E4F', '#C2185B'] },
    mono_basic:   { name: 'Графит',    rarity: 'common', price: 800,  pattern: 'none', colors: ['#ECEFF1', '#CFD8DC', '#90A4AE', '#607D8B', '#455A64', '#263238'] },
    acid_basic:   { name: 'Кислота',   rarity: 'common', price: 1000, pattern: 'none', colors: ['#CCFF00', '#00FF9D', '#00E5FF', '#FF00AA', '#FFE600', '#7B2CBF'] },

    // === РЕДКИЕ (простые текстуры + лёгкие бафы) ===
    polka_rare:   { name: 'Горошек',   rarity: 'rare', price: 1500, pattern: 'dots',    colors: ['#FF4081', '#FF80AB', '#F50057', '#AB47BC', '#CE93D8'], modifiers: { coinMult: 1.04 } },
    stripe_rare:  { name: 'Полосы',    rarity: 'rare', price: 2200, pattern: 'stripes', colors: ['#2979FF', '#448AFF', '#00B0FF', '#40C4FF', '#536DFE'], modifiers: { xpMult: 1.05 } },
    brick_rare:   { name: 'Кирпич',    rarity: 'rare', price: 3000, pattern: 'bricks',  colors: ['#8D6E63', '#795548', '#6D4C41', '#A1887F', '#5D4037'], modifiers: { scoreMult: 1.05 } },
    wave_rare:    { name: 'Прибой',    rarity: 'rare', price: 4000, pattern: 'waves',   colors: ['#0288D1', '#03A9F4', '#26C6DA', '#00ACC1', '#00838F'], modifiers: { coinMult: 1.06, xpMult: 1.04 } },
    grid_rare:    { name: 'Пиксель',   rarity: 'rare', price: 5000, pattern: 'grid',    colors: ['#00E676', '#00C853', '#69F0AE', '#1DE9B6', '#00BFA5'], modifiers: { scoreMult: 1.06, coinMult: 1.04 } },
    frost_rare:   { name: 'Иней',      rarity: 'rare', price: 6000, pattern: 'frost',   colors: ['#E0F7FA', '#B2EBF2', '#80DEEA', '#4DD0E1', '#26C6DA'], modifiers: { speedMult: 0.95, xpMult: 1.08 } },

    // === ЭПИЧЕСКИЕ (сложные текстуры + ~20% бафы) ===
    emerald_epic: { name: 'Изумруд',   rarity: 'epic', price: 8000,  pattern: 'gem',     effect: 'ice',         colors: ['#004D40', '#00695C', '#00897B', '#26A69A', '#4DB6AC'], modifiers: { coinMult: 1.18, xpMult: 1.10 } },
    magma_epic:   { name: 'Магма',     rarity: 'epic', price: 9500,  pattern: 'magma',   effect: 'fire',        colors: ['#3E0000', '#8E0000', '#D50000', '#FF3D00', '#FF9100'], modifiers: { scoreMult: 1.20, coinMult: 1.10 } },
    cyber_epic:   { name: 'Киберпанк', rarity: 'epic', price: 11500, pattern: 'circuit', effect: 'neon',        colors: ['#F72585', '#B5179E', '#7209B7', '#4361EE', '#4CC9F0'], modifiers: { coinMult: 1.22, xpMult: 1.15 } },
    galaxy_epic:  { name: 'Галактика', rarity: 'epic', price: 13000, pattern: 'stars',   effect: 'stars',       colors: ['#10002B', '#240046', '#3C096C', '#7B2CBF', '#C77DFF'], modifiers: { xpMult: 1.25, scoreMult: 1.15 } },
    aurora_epic:  { name: 'Сияние',    rarity: 'epic', price: 15000, pattern: 'holo',    effect: 'holographic', colors: ['#00F5D4', '#00BBF9', '#9B5DE5', '#F15BB5', '#FEE440'], modifiers: { coinMult: 1.22, scoreMult: 1.18, xpMult: 1.15 } },

    // === ЛЕГЕНДАРНЫЕ (только Колесо удачи — 2% шанс) ===
    first_wipe_leg: {name: 'Первый вайп', rarity: 'legendary', price: 0, notBuyable: true, exclusiveOnly: true, pattern: 'first_wipe', effect: 'holographic', colors: ['#1A0B2E', '#2D1457', '#FFB300', '#00F5D4', '#FF2A85', '#FFD700'], modifiers: { coinMult: 1.05, xpMult: 1.05 } },
    midas_leg:    { name: 'Король Мидас', rarity: 'legendary', price: 0, notBuyable: true, wheelOnly: true, pattern: 'royal',   effect: 'holographic', colors: ['#FFF3B0', '#FFE066', '#FFD700', '#FFB703', '#FB8500'], modifiers: { coinMult: 1.45, scoreMult: 1.25 } },
    phoenix_leg:  { name: 'Феникс',       rarity: 'legendary', price: 0, notBuyable: true, wheelOnly: true, pattern: 'phoenix', effect: 'fire',        colors: ['#FFD600', '#FFAB00', '#FF6D00', '#DD2C00', '#B71C1C'], modifiers: { scoreMult: 1.40, xpMult: 1.35 } },
    chrono_leg:   { name: 'Хронос',       rarity: 'legendary', price: 0, notBuyable: true, wheelOnly: true, pattern: 'chrono',  effect: 'ice',         colors: ['#E0F7FA', '#80DEEA', '#00E5FF', '#00B0FF', '#2962FF'], modifiers: { speedMult: 0.85, scoreMult: 1.30, coinMult: 1.30 } },
    astral_leg:   { name: 'Астрал',       rarity: 'legendary', price: 0, notBuyable: true, wheelOnly: true, pattern: 'astral',  effect: 'stars',       colors: ['#1A0033', '#4A0080', '#7B2CBF', '#E0AAFF', '#00F5D4'], modifiers: { coinMult: 1.35, scoreMult: 1.35, xpMult: 1.40 } },

    // Наградной скин за коллекцию + престиж и события
    legend: { name: 'Легенда', rarity: 'legendary', price: 999999, notBuyable: true, pattern: 'royal', effect: 'holographic', colors: ['#FFD700', '#FFA000', '#FF6F00', '#F57C00', '#FFEB3B'], modifiers: { coinMult: 1.40, scoreMult: 1.40, xpMult: 1.40 } },
    ...PRESTIGE_SKINS,
    ...EVENT_SKINS,
};
export const PALETTES = {
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

export const BACKGROUNDS = {
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

export const SEASONS = [
    { months: [12, 1, 2], name: 'Зима', icon: '❄️', coinMult: 1.2, xpMult: 1.0 },
    { months: [3, 4, 5], name: 'Весна', icon: '🌸', coinMult: 1.0, xpMult: 1.15 },
    { months: [6, 7, 8], name: 'Лето', icon: '☀️', coinMult: 1.1, xpMult: 1.1 },
    { months: [9, 10, 11], name: 'Осень', icon: '🍂', coinMult: 1.15, xpMult: 1.0 },
];

export const DAILY_CHALLENGES = [
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

export const POWERUP_DEFS = {
    foundation: { icon: '🧱', name: 'Фундамент',   desc: 'Стартовый блок шире на 35%',    price: 120 },
    focus:      { icon: '🎯', name: 'Точный глаз', desc: 'Зона идеала в 3.5 раза шире',   price: 150 },
    luck:       { icon: '🍀', name: 'Удача',       desc: 'x2 редких, без бомб и хрупких', price: 180 },
    multiplier: { icon: '💰', name: 'Множитель',   desc: 'x2 монет за всю игру',          price: 200 }
};

export const QUESTS_POOL = [
    // Точность и серии
    { type: 'perfect', target: 3,  text: '🎯 Идеал x3',        reward: 15 },
    { type: 'perfect', target: 5,  text: '🎯 Идеал x5',        reward: 25 },
    { type: 'perfect', target: 8,  text: '🎯 Идеал x8',        reward: 35 },
    { type: 'perfect', target: 12, text: '🎯 Идеал x12',       reward: 50 },
    { type: 'perfect', target: 20, text: '🎯 Идеал x20',       reward: 80 },
    { type: 'perfect_run', target: 5,  text: '🏹 5 идеалов за игру',  reward: 35 },
    { type: 'perfect_run', target: 10, text: '🏹 10 идеалов за игру', reward: 70 },
    { type: 'perfect_start', target: 3, text: '🚀 Старт: 3 идеала',   reward: 35 },
    { type: 'perfect_start', target: 5, text: '☄️ Старт: 5 идеалов',  reward: 65 },
    { type: 'combo', target: 2, text: '🔥 Серия x2',           reward: 15 },
    { type: 'combo', target: 3, text: '🔥 Серия x3',           reward: 25 },
    { type: 'combo', target: 5, text: '🔥 Серия x5',           reward: 45 },
    { type: 'combo', target: 7, text: '🔥 Серия x7',           reward: 70 },
    { type: 'combo', target: 10, text: '⚡ Серия x10',         reward: 100 },

    // Высота и очки за забег
    { type: 'stack', target: 10, text: '🏗️ Высота 10',         reward: 25 },
    { type: 'stack', target: 15, text: '🏗️ Высота 15',         reward: 35 },
    { type: 'stack', target: 20, text: '🏗️ Высота 20',         reward: 50 },
    { type: 'stack', target: 25, text: '🏗️ Высота 25',         reward: 70 },
    { type: 'stack', target: 35, text: '🗼 Высота 35',         reward: 100 },
    { type: 'score_run', target: 30, text: '🏆 30 очк. за игру', reward: 40 },
    { type: 'score_run', target: 60, text: '👑 60 очк. за игру', reward: 85 },
    { type: 'clean_score', target: 15, text: '🧘 15 без бустов', reward: 30 },
    { type: 'clean_score', target: 30, text: '🥋 30 без бустов', reward: 65 },

    // Особые блоки и механики
    { type: 'cut', target: 5,  text: '✂️ 5 срезов',            reward: 15 },
    { type: 'cut', target: 10, text: '✂️ 10 срезов',           reward: 30 },
    { type: 'cut', target: 20, text: '✂️ 20 срезов',           reward: 60 },
    { type: 'golden', target: 1, text: '👑 1 золотой',         reward: 20 },
    { type: 'golden', target: 3, text: '👑 3 золотых',         reward: 50 },
    { type: 'bomb', target: 1,   text: '💣 1 бомба',           reward: 25 },
    { type: 'bomb', target: 3,   text: '💣 3 бомбы',           reward: 65 },
    { type: 'ice', target: 1,    text: '❄️ 1 лёд',             reward: 20 },
    { type: 'ice', target: 3,    text: '❄️ 3 льда',            reward: 55 },
    { type: 'crumble_cut', target: 1, text: '🧱 Срежь хрупкий',   reward: 35 },
    { type: 'crumble_cut', target: 3, text: '🧱 Срежь 3 хрупких', reward: 80 },
    { type: 'width_grow', target: 1,  text: '✨ Расширь блок',    reward: 40 },
    { type: 'width_grow', target: 2,  text: '✨ Расширь блок x2', reward: 75 },
    { type: 'fury', target: 1,   text: '💥 1 ярость',          reward: 40 },
    { type: 'fury', target: 2,   text: '👹 2 ярости',          reward: 80 },
    { type: 'secret', target: 1, text: '🌟 1 секретный',       reward: 35 },
    { type: 'secret', target: 3, text: '🔮 3 секретных',       reward: 90 },

    // Режимы, бусты и контракты
    { type: 'games', target: 2, text: '🎮 2 игры',             reward: 15 },
    { type: 'games', target: 5, text: '🎮 5 игр',              reward: 35 },
    { type: 'time_game', target: 1,       text: '⏱️ 1 на время',       reward: 25 },
    { type: 'storm_score', target: 15,    text: '🌪️ 15 в Шторме',      reward: 50 },
    { type: 'mirror_score', target: 15,   text: '🪞 15 в Зеркальном',  reward: 50 },
    { type: 'precision_score', target: 8, text: '🎯 8 в Точности',     reward: 65 },
    { type: 'antigrav_rot', target: 1,    text: '🪐 Поворот 90°',      reward: 55 },
    { type: 'powerup_use', target: 1,     text: '⚡ Запусти буст',      reward: 30 },
    { type: 'contract_win', target: 1,    text: '📜 Выполни контракт', reward: 60 },
];

export const HEIGHT_LANDMARKS = [
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

export function getHeightComparison(meters) {
    let label = 'Хорошее начало! 🌱';
    for (const lm of HEIGHT_LANDMARKS) {
        if (meters >= lm.m) label = lm.text;
    }
    return label;
}
