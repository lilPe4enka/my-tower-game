// seasonal-events.js
// Сезонные и праздничные события.
// Старт системы: 01.11.2026. Повторяются ежегодно.

import { safeGetItem, safeSetItem } from './utils.js';

export const EVENTS_CONFIG = {
    START_YEAR: 2026,
    START_MONTH: 11,
    START_DAY: 1,
    CLAIMED_KEY: 'towerEventClaimedRewards',
};

// month: 1-12, day: 1-31
export const SEASONAL_EVENTS = {
    autumn: {
        id: 'autumn',
        type: 'season',
        name: 'Золотая осень',
        icon: '🍂',
        startDate: { month: 9, day: 1 },
        endDate: { month: 11, day: 30 },
        color: '#FF8C42',
        background: 'forest',
        particles: 'leaves',
        description: 'Осенние краски и тёплые награды!',
        rewards: [
            { day: 1, type: 'coins', amount: 50, text: '+50 🪙' },
            { day: 3, type: 'coins', amount: 100, text: '+100 🪙' },
            { day: 7, type: 'powerup', powerup: 'luck', count: 2, text: '🍀 Удача x2' },
            { day: 10, type: 'chest', rare: true, text: '✨ Редкий сундук' },
            { day: 15, type: 'coins', amount: 200, text: '+200 🪙' },
            { day: 21, type: 'skin', skinId: 'autumn_skin', text: '🍁 Осенний скин' },
            { day: 30, type: 'chest', rare: true, text: '✨ Редкий сундук' },
            { day: 45, type: 'skin', skinId: 'harvest', text: '🎃 Урожай' },
            { day: 60, type: 'coins', amount: 500, text: '+500 🪙' },
            { day: 75, type: 'skin', skinId: 'maple', text: '🍁 Клён' },
        ],
    },

    winter: {
        id: 'winter',
        type: 'season',
        name: 'Зимняя сказка',
        icon: '❄️',
        startDate: { month: 12, day: 1 },
        endDate: { month: 2, day: 28 },
        color: '#87CEEB',
        background: 'snow',
        particles: 'snow',
        description: 'Снег, лёд и зимние подарки!',
        rewards: [
            { day: 1, type: 'coins', amount: 50, text: '+50 🪙' },
            { day: 3, type: 'coins', amount: 100, text: '+100 🪙' },
            { day: 5, type: 'powerup', powerup: 'focus', count: 2, text: '🎯 Точный глаз x2' },
            { day: 7, type: 'chest', rare: true, text: '✨ Редкий сундук' },
            { day: 10, type: 'coins', amount: 200, text: '+200 🪙' },
            { day: 14, type: 'skin', skinId: 'winter_skin', text: '🎿 Зимний скин' },
            { day: 21, type: 'chest', rare: true, text: '✨ Редкий сундук' },
            { day: 30, type: 'skin', skinId: 'snowflake', text: '❄️ Снежинка' },
            { day: 45, type: 'coins', amount: 500, text: '+500 🪙' },
            { day: 60, type: 'skin', skinId: 'ice_king', text: '👑 Ледяной король' },
        ],
    },

    spring: {
        id: 'spring',
        type: 'season',
        name: 'Весеннее пробуждение',
        icon: '🌸',
        startDate: { month: 3, day: 1 },
        endDate: { month: 5, day: 31 },
        color: '#FFB6C1',
        background: 'sakura',
        particles: 'sakura',
        description: 'Цветение и весенние бонусы!',
        rewards: [
            { day: 1, type: 'coins', amount: 50, text: '+50 🪙' },
            { day: 3, type: 'coins', amount: 100, text: '+100 🪙' },
            { day: 7, type: 'powerup', powerup: 'foundation', count: 2, text: '🧱 Фундамент x2' },
            { day: 10, type: 'chest', rare: true, text: '✨ Редкий сундук' },
            { day: 15, type: 'coins', amount: 200, text: '+200 🪙' },
            { day: 21, type: 'skin', skinId: 'spring_skin', text: '🌷 Весенний скин' },
            { day: 30, type: 'chest', rare: true, text: '✨ Редкий сундук' },
            { day: 45, type: 'skin', skinId: 'blossom', text: '🌸 Цветение' },
            { day: 60, type: 'coins', amount: 500, text: '+500 🪙' },
            { day: 75, type: 'skin', skinId: 'garden', text: '🌺 Сад' },
        ],
    },

    summer: {
        id: 'summer',
        type: 'season',
        name: 'Летний фестиваль',
        icon: '☀️',
        startDate: { month: 6, day: 1 },
        endDate: { month: 8, day: 31 },
        color: '#FFD93D',
        background: 'sunset',
        particles: 'stardust',
        description: 'Солнце, монеты и летний драйв!',
        rewards: [
            { day: 1, type: 'coins', amount: 100, text: '+100 🪙' },
            { day: 5, type: 'coins', amount: 150, text: '+150 🪙' },
            { day: 10, type: 'powerup', powerup: 'multiplier', count: 3, text: '💰 Множитель x3' },
            { day: 15, type: 'chest', rare: true, text: '✨ Редкий сундук' },
            { day: 20, type: 'coins', amount: 300, text: '+300 🪙' },
            { day: 30, type: 'skin', skinId: 'beach', text: '🏖️ Пляжный скин' },
            { day: 45, type: 'chest', rare: true, text: '✨ Редкий сундук' },
            { day: 60, type: 'skin', skinId: 'sun', text: '☀️ Солнце' },
            { day: 75, type: 'coins', amount: 700, text: '+700 🪙' },
            { day: 90, type: 'skin', skinId: 'tropical', text: '🌴 Тропики' },
        ],
    },
};

export const HOLIDAY_EVENTS = {
    halloween: {
        id: 'halloween',
        type: 'holiday',
        name: 'Хеллоуин',
        icon: '🎃',
        startDate: { month: 10, day: 25 },
        endDate: { month: 11, day: 3 },
        color: '#FF6B1A',
        background: 'night',
        particles: 'stardust',
        description: 'Страшно весёлое время!',
        priority: 10,
        rewards: [
            { day: 1, type: 'coins', amount: 100, text: '+100 🪙' },
            { day: 2, type: 'powerup', powerup: 'luck', count: 3, text: '🍀 Удача x3' },
            { day: 3, type: 'coins', amount: 200, text: '+200 🪙' },
            { day: 5, type: 'skin', skinId: 'pumpkin', text: '🎃 Тыква' },
            { day: 7, type: 'chest', rare: true, text: '✨ Редкий сундук' },
            { day: 10, type: 'skin', skinId: 'witch', text: '🧙 Ведьма' },
        ],
    },

    unity_day: {
        id: 'unity_day',
        type: 'holiday',
        name: 'День единства',
        icon: '🤝',
        startDate: { month: 11, day: 2 },
        endDate: { month: 11, day: 5 },
        color: '#B22222',
        background: 'city',
        particles: 'fire',
        description: 'С Днём народного единства!',
        priority: 7,
        rewards: [
            { day: 1, type: 'coins', amount: 250, text: '+250 🪙' },
            { day: 2, type: 'powerup', powerup: 'foundation', count: 3, text: '🧱 Фундамент x3' },
            { day: 3, type: 'chest', rare: true, text: '✨ Редкий сундук' },
        ],
    },

    newyear: {
        id: 'newyear',
        type: 'holiday',
        name: 'Новый год',
        icon: '🎄',
        startDate: { month: 12, day: 20 },
        endDate: { month: 1, day: 10 },
        color: '#FF1744',
        background: 'snow',
        particles: 'snow',
        description: 'Волшебство Нового года!',
        priority: 15,
        rewards: [
            { day: 1, type: 'coins', amount: 200, text: '+200 🪙' },
            { day: 2, type: 'coins', amount: 300, text: '+300 🪙' },
            { day: 3, type: 'powerup', powerup: 'multiplier', count: 5, text: '💰 Множитель x5' },
            { day: 5, type: 'chest', rare: true, text: '✨ Редкий сундук' },
            { day: 7, type: 'skin', skinId: 'santa', text: '🎅 Санта' },
            { day: 10, type: 'skin', skinId: 'christmas_tree', text: '🎄 Ёлка' },
            { day: 14, type: 'chest', rare: true, text: '✨ Редкий сундук' },
            { day: 21, type: 'skin', skinId: 'reindeer', text: '🦌 Олень' },
        ],
    },

    valentines: {
        id: 'valentines',
        type: 'holiday',
        name: 'День Валентина',
        icon: '💝',
        startDate: { month: 2, day: 10 },
        endDate: { month: 2, day: 16 },
        color: '#FF1493',
        background: 'sakura',
        particles: 'candy',
        description: 'Время любви!',
        priority: 8,
        rewards: [
            { day: 1, type: 'coins', amount: 100, text: '+100 🪙' },
            { day: 3, type: 'coins', amount: 200, text: '+200 🪙' },
            { day: 5, type: 'skin', skinId: 'heart', text: '💖 Сердце' },
            { day: 7, type: 'chest', rare: true, text: '✨ Редкий сундук' },
        ],
    },

    defender_day: {
        id: 'defender_day',
        type: 'holiday',
        name: '23 Февраля',
        icon: '⭐',
        startDate: { month: 2, day: 20 },
        endDate: { month: 2, day: 25 },
        color: '#4A5D23',
        background: 'forest',
        particles: 'stardust',
        description: 'С праздником!',
        priority: 7,
        rewards: [
            { day: 1, type: 'coins', amount: 150, text: '+150 🪙' },
            { day: 3, type: 'powerup', powerup: 'foundation', count: 3, text: '🧱 Фундамент x3' },
            { day: 5, type: 'skin', skinId: 'military', text: '⭐ Военный' },
        ],
    },

    march_8: {
        id: 'march_8',
        type: 'holiday',
        name: '8 Марта',
        icon: '🌷',
        startDate: { month: 3, day: 5 },
        endDate: { month: 3, day: 10 },
        color: '#FF69B4',
        background: 'sakura',
        particles: 'sakura',
        description: 'С Международным женским днём!',
        priority: 8,
        rewards: [
            { day: 1, type: 'coins', amount: 150, text: '+150 🪙' },
            { day: 3, type: 'coins', amount: 250, text: '+250 🪙' },
            { day: 5, type: 'skin', skinId: 'tulip', text: '🌷 Тюльпан' },
        ],
    },

    april_fools: {
        id: 'april_fools',
        type: 'holiday',
        name: 'День смеха',
        icon: '🤡',
        startDate: { month: 4, day: 1 },
        endDate: { month: 4, day: 3 },
        color: '#FFD700',
        background: 'candy_land',
        particles: 'candy',
        description: 'Шутки и веселье!',
        priority: 6,
        rewards: [
            { day: 1, type: 'coins', amount: 444, text: '+444 🪙' },
            { day: 2, type: 'skin', skinId: 'clown', text: '🤡 Клоун' },
            { day: 3, type: 'chest', rare: true, text: '✨ Редкий сундук' },
        ],
    },

    may_day: {
        id: 'may_day',
        type: 'holiday',
        name: '1 Мая',
        icon: '🌼',
        startDate: { month: 5, day: 1 },
        endDate: { month: 5, day: 3 },
        color: '#FF4500',
        background: 'forest',
        particles: 'leaves',
        description: 'С праздником весны!',
        priority: 6,
        rewards: [
            { day: 1, type: 'coins', amount: 200, text: '+200 🪙' },
            { day: 2, type: 'powerup', powerup: 'multiplier', count: 2, text: '💰 Множитель x2' },
            { day: 3, type: 'skin', skinId: 'worker', text: '👷 Рабочий' },
        ],
    },

    victory_day: {
        id: 'victory_day',
        type: 'holiday',
        name: 'День Победы',
        icon: '🎖️',
        startDate: { month: 5, day: 7 },
        endDate: { month: 5, day: 11 },
        color: '#FF8C00',
        background: 'sunset',
        particles: 'fire',
        description: 'С Днём Победы!',
        priority: 9,
        rewards: [
            { day: 1, type: 'coins', amount: 300, text: '+300 🪙' },
            { day: 3, type: 'coins', amount: 500, text: '+500 🪙' },
            { day: 5, type: 'skin', skinId: 'veteran', text: '🎖️ Ветеран' },
        ],
    },

    children_day: {
        id: 'children_day',
        type: 'holiday',
        name: 'День защиты детей',
        icon: '🧸',
        startDate: { month: 6, day: 1 },
        endDate: { month: 6, day: 3 },
        color: '#FF69B4',
        background: 'candy_land',
        particles: 'candy',
        description: 'С Днём защиты детей!',
        priority: 6,
        rewards: [
            { day: 1, type: 'coins', amount: 200, text: '+200 🪙' },
            { day: 2, type: 'powerup', powerup: 'luck', count: 3, text: '🍀 Удача x3' },
            { day: 3, type: 'skin', skinId: 'teddy', text: '🧸 Мишка' },
        ],
    },

    russia_day: {
        id: 'russia_day',
        type: 'holiday',
        name: 'День России',
        icon: '🇷🇺',
        startDate: { month: 6, day: 10 },
        endDate: { month: 6, day: 14 },
        color: '#0039A6',
        background: 'city',
        particles: 'fire',
        description: 'С Днём России!',
        priority: 8,
        rewards: [
            { day: 1, type: 'coins', amount: 300, text: '+300 🪙' },
            { day: 3, type: 'coins', amount: 500, text: '+500 🪙' },
            { day: 5, type: 'skin', skinId: 'russia', text: '🇷🇺 Россия' },
        ],
    },

    knowledge_day: {
        id: 'knowledge_day',
        type: 'holiday',
        name: 'День знаний',
        icon: '📚',
        startDate: { month: 9, day: 1 },
        endDate: { month: 9, day: 3 },
        color: '#4169E1',
        background: 'city',
        particles: 'stardust',
        description: 'С Днём знаний!',
        priority: 6,
        rewards: [
            { day: 1, type: 'coins', amount: 200, text: '+200 🪙' },
            { day: 2, type: 'powerup', powerup: 'focus', count: 3, text: '🎯 Точный глаз x3' },
            { day: 3, type: 'skin', skinId: 'student', text: '🎓 Студент' },
        ],
    },

    teacher_day: {
        id: 'teacher_day',
        type: 'holiday',
        name: 'День учителя',
        icon: '👨‍🏫',
        startDate: { month: 10, day: 3 },
        endDate: { month: 10, day: 7 },
        color: '#8B4513',
        background: 'forest',
        particles: 'leaves',
        description: 'С Днём учителя!',
        priority: 6,
        rewards: [
            { day: 1, type: 'coins', amount: 200, text: '+200 🪙' },
            { day: 3, type: 'coins', amount: 300, text: '+300 🪙' },
            { day: 5, type: 'skin', skinId: 'teacher', text: '👨‍🏫 Учитель' },
        ],
    },
};

// Скины, которые можно получить только в событиях
export const EVENT_SKINS = {
    winter_skin: { name: 'Зимний', price: 0, notBuyable: true, eventOnly: true, colors: ['#E0F7FA', '#B2EBF2', '#80DEEA', '#4DD0E1', '#26C6DA', '#00BCD4'], modifiers: { coinMult: 1.1 } },
    snowflake: { name: 'Снежинка', price: 0, notBuyable: true, eventOnly: true, colors: ['#FFFFFF', '#E0F7FA', '#B2EBF2', '#81D4FA', '#4FC3F7', '#29B6F6'], modifiers: { scoreMult: 1.1 } },
    ice_king: { name: 'Ледяной король', price: 0, notBuyable: true, eventOnly: true, legendary: true, colors: ['#00BCD4', '#00ACC1', '#0097A7', '#00838F', '#006064', '#E0F7FA'], modifiers: { coinMult: 1.2, scoreMult: 1.15 } },

    spring_skin: { name: 'Весенний', price: 0, notBuyable: true, eventOnly: true, colors: ['#F8BBD0', '#F48FB1', '#F06292', '#EC407A', '#E91E63', '#C2185B'] },
    blossom: { name: 'Цветение', price: 0, notBuyable: true, eventOnly: true, colors: ['#FFCDD2', '#EF9A9A', '#E57373', '#FFB6C1', '#FF69B4', '#FF1493'] },
    garden: { name: 'Сад', price: 0, notBuyable: true, eventOnly: true, legendary: true, colors: ['#C8E6C9', '#A5D6A7', '#81C784', '#66BB6A', '#4CAF50', '#388E3C'], modifiers: { xpMult: 1.2 } },

    beach: { name: 'Пляжный', price: 0, notBuyable: true, eventOnly: true, colors: ['#FFE0B2', '#FFCC80', '#FFB74D', '#FFA726', '#FF9800', '#FB8C00'] },
    sun: { name: 'Солнце', price: 0, notBuyable: true, eventOnly: true, colors: ['#FFF59D', '#FFF176', '#FFEE58', '#FFEB3B', '#FDD835', '#FBC02D'], modifiers: { coinMult: 1.1 } },
    tropical: { name: 'Тропики', price: 0, notBuyable: true, eventOnly: true, legendary: true, colors: ['#00E676', '#00C853', '#FFEB3B', '#FF9800', '#E91E63', '#9C27B0'], modifiers: { coinMult: 1.15, scoreMult: 1.1 } },

    autumn_skin: { name: 'Осенний', price: 0, notBuyable: true, eventOnly: true, colors: ['#FFCC80', '#FFB74D', '#FFA726', '#FF9800', '#FB8C00', '#F57C00'] },
    harvest: { name: 'Урожай', price: 0, notBuyable: true, eventOnly: true, colors: ['#FF8A65', '#FF7043', '#FF5722', '#F4511E', '#E64A19', '#D84315'] },
    maple: { name: 'Клён', price: 0, notBuyable: true, eventOnly: true, legendary: true, colors: ['#FF6F00', '#FF8F00', '#FFA000', '#FFB300', '#FFC107', '#FFCA28'], modifiers: { scoreMult: 1.15 } },

    pumpkin: { name: 'Тыква', price: 0, notBuyable: true, eventOnly: true, colors: ['#FF6D00', '#FF9100', '#FFAB00', '#FFD600', '#BF360C', '#3E2723'] },
    witch: { name: 'Ведьма', price: 0, notBuyable: true, eventOnly: true, legendary: true, colors: ['#4A148C', '#6A1B9A', '#7B1FA2', '#8E24AA', '#9C27B0', '#AB47BC'], modifiers: { scoreMult: 1.2 } },

    santa: { name: 'Санта', price: 0, notBuyable: true, eventOnly: true, colors: ['#C62828', '#D32F2F', '#E53935', '#EF5350', '#FFFFFF', '#F5F5F5'] },
    christmas_tree: { name: 'Ёлка', price: 0, notBuyable: true, eventOnly: true, colors: ['#1B5E20', '#2E7D32', '#388E3C', '#43A047', '#FFD700', '#FF1744'], modifiers: { coinMult: 1.15 } },
    reindeer: { name: 'Олень', price: 0, notBuyable: true, eventOnly: true, legendary: true, colors: ['#5D4037', '#6D4C41', '#795548', '#8D6E63', '#A1887F', '#FFD700'], modifiers: { coinMult: 1.2, xpMult: 1.15 } },

    heart: { name: 'Сердце', price: 0, notBuyable: true, eventOnly: true, colors: ['#FF1744', '#F50057', '#FF4081', '#FF80AB', '#FFCDD2', '#FCE4EC'] },
    military: { name: 'Военный', price: 0, notBuyable: true, eventOnly: true, colors: ['#33691E', '#558B2F', '#689F38', '#7CB342', '#8BC34A', '#9CCC65'] },
    tulip: { name: 'Тюльпан', price: 0, notBuyable: true, eventOnly: true, colors: ['#EC407A', '#F06292', '#F48FB1', '#F8BBD0', '#4CAF50', '#66BB6A'] },
    clown: { name: 'Клоун', price: 0, notBuyable: true, eventOnly: true, colors: ['#FF1744', '#FFEB3B', '#00E5FF', '#76FF03', '#FF4081', '#FFD600'] },
    worker: { name: 'Рабочий', price: 0, notBuyable: true, eventOnly: true, colors: ['#FF6F00', '#FF8F00', '#FFA000', '#FFB300', '#FFC107', '#FFCA28'] },
    veteran: { name: 'Ветеран', price: 0, notBuyable: true, eventOnly: true, legendary: true, colors: ['#FF6F00', '#FF8F00', '#FFA000', '#424242', '#616161', '#FFD700'], modifiers: { scoreMult: 1.2 } },
    teddy: { name: 'Мишка', price: 0, notBuyable: true, eventOnly: true, colors: ['#8D6E63', '#A1887F', '#BCAAA4', '#D7CCC8', '#FFCDD2', '#F8BBD0'] },
    russia: { name: 'Россия', price: 0, notBuyable: true, eventOnly: true, legendary: true, colors: ['#FFFFFF', '#0039A6', '#D52B1E', '#0033A0', '#CC0000', '#FFD700'], modifiers: { coinMult: 1.2, scoreMult: 1.15 } },
    student: { name: 'Студент', price: 0, notBuyable: true, eventOnly: true, colors: ['#1976D2', '#1E88E5', '#2196F3', '#42A5F5', '#64B5F6', '#90CAF9'] },
    teacher: { name: 'Учитель', price: 0, notBuyable: true, eventOnly: true, colors: ['#5D4037', '#6D4C41', '#795548', '#8D6E63', '#FFEB3B', '#FFC107'] },
};

export function isEventsSystemActive(date = new Date()) {
    const start = new Date(
        EVENTS_CONFIG.START_YEAR,
        EVENTS_CONFIG.START_MONTH - 1,
        EVENTS_CONFIG.START_DAY
    );
    return date >= start;
}

export function getAllEvents() {
    return { ...SEASONAL_EVENTS, ...HOLIDAY_EVENTS };
}

function isDateInRange(month, day, startDate, endDate) {
    const current = month * 100 + day;
    const start = startDate.month * 100 + startDate.day;
    const end = endDate.month * 100 + endDate.day;

    // Диапазон через Новый год: например 20 декабря — 10 января
    if (start > end) {
        return current >= start || current <= end;
    }

    return current >= start && current <= end;
}

export function isEventActive(event, month, day) {
    return isDateInRange(month, day, event.startDate, event.endDate);
}

function getEventStartYear(event, date = new Date()) {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;

    // Если событие через Новый год и сейчас январь/февраль — старт был в прошлом году
    if (event.startDate.month > event.endDate.month && month <= event.endDate.month) {
        return year - 1;
    }

    return year;
}

function getEventInstanceKey(event, date = new Date()) {
    const startYear = getEventStartYear(event, date);
    return `${event.id}:${startYear}`;
}

function attachEventInstance(event, date = new Date()) {
    const startYear = getEventStartYear(event, date);
    return {
        ...event,
        isHoliday: event.type === 'holiday',
        eventYear: startYear,
        instanceKey: `${event.id}:${startYear}`,
    };
}

export function getCurrentEvent(date = new Date()) {
    if (!isEventsSystemActive(date)) return null;

    const month = date.getMonth() + 1;
    const day = date.getDate();

    const holidays = Object.values(HOLIDAY_EVENTS)
        .sort((a, b) => (b.priority || 0) - (a.priority || 0));

    for (const event of holidays) {
        if (isEventActive(event, month, day)) {
            return attachEventInstance(event, date);
        }
    }

    for (const event of Object.values(SEASONAL_EVENTS)) {
        if (isEventActive(event, month, day)) {
            return attachEventInstance(event, date);
        }
    }

    return null;
}

export function getEventDay(event, date = new Date()) {
    const startYear = event.eventYear || getEventStartYear(event, date);

    const start = new Date(startYear, event.startDate.month - 1, event.startDate.day);
    const current = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    const diffDays = Math.floor((current - start) / (1000 * 60 * 60 * 24)) + 1;
    return Math.max(1, diffDays);
}

export function getEventProgress(event, date = new Date()) {
    const currentDay = getEventDay(event, date);
    const lastRewardDay = event.rewards?.[event.rewards.length - 1]?.day || currentDay;

    return {
        currentDay,
        totalRewards: event.rewards?.length || 0,
        lastRewardDay,
        progress: Math.min(100, (currentDay / lastRewardDay) * 100),
    };
}

function getAllClaimedRewards() {
    const data = safeGetItem(EVENTS_CONFIG.CLAIMED_KEY, {});
    return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
}

function saveAllClaimedRewards(data) {
    safeSetItem(EVENTS_CONFIG.CLAIMED_KEY, data);
}

export function getClaimedRewards(eventOrId, date = new Date()) {
    const allClaimed = getAllClaimedRewards();

    // Новый формат: ключ по году, например winter:2026
    if (typeof eventOrId === 'object' && eventOrId?.instanceKey) {
        return Array.isArray(allClaimed[eventOrId.instanceKey])
            ? allClaimed[eventOrId.instanceKey]
            : [];
    }

    // Если передали строку instanceKey
    if (typeof eventOrId === 'string' && eventOrId.includes(':')) {
        return Array.isArray(allClaimed[eventOrId]) ? allClaimed[eventOrId] : [];
    }

    // Совместимость: если передали просто id текущего события
    const current = getCurrentEvent(date);
    if (current?.id === eventOrId) {
        return Array.isArray(allClaimed[current.instanceKey])
            ? allClaimed[current.instanceKey]
            : [];
    }

    // Старый формат без года
    return Array.isArray(allClaimed[eventOrId]) ? allClaimed[eventOrId] : [];
}

export function getAvailableRewards(event, date = new Date()) {
    if (!event?.rewards) return [];

    const currentDay = getEventDay(event, date);
    const claimed = getClaimedRewards(event, date);

    return event.rewards.map((reward, index) => {
        const isAvailable = currentDay >= reward.day;
        const isClaimed = claimed.includes(index);

        return {
            ...reward,
            index,
            isAvailable,
            isClaimed,
            canClaim: isAvailable && !isClaimed,
        };
    });
}

export function claimEventReward(eventIdOrKey, rewardIndex, callbacks = {}, date = new Date()) {
    const current = getCurrentEvent(date);
    const allEvents = getAllEvents();

    let event = null;

    if (current && (current.id === eventIdOrKey || current.instanceKey === eventIdOrKey)) {
        event = current;
    } else if (typeof eventIdOrKey === 'string' && eventIdOrKey.includes(':')) {
        const [id, yearRaw] = eventIdOrKey.split(':');
        const base = allEvents[id];
        if (base) {
            event = {
                ...base,
                isHoliday: base.type === 'holiday',
                eventYear: Number(yearRaw),
                instanceKey: eventIdOrKey,
            };
        }
    } else if (allEvents[eventIdOrKey]) {
        event = attachEventInstance(allEvents[eventIdOrKey], date);
    }

    if (!event) return { success: false, reason: 'no_event' };
    if (!isEventsSystemActive(date)) return { success: false, reason: 'not_started' };

    const reward = event.rewards?.[rewardIndex];
    if (!reward) return { success: false, reason: 'no_reward' };

    const currentDay = getEventDay(event, date);
    if (currentDay < reward.day) {
        return { success: false, reason: 'too_early' };
    }

    const claimed = getClaimedRewards(event, date);
    if (claimed.includes(rewardIndex)) {
        return { success: false, reason: 'already_claimed' };
    }

    const { addCoins, addPowerup, addSkin, addChest } = callbacks;

    switch (reward.type) {
        case 'coins':
            if (addCoins) addCoins(reward.amount);
            break;

        case 'powerup':
            if (addPowerup) addPowerup(reward.powerup, reward.count);
            break;

        case 'skin':
            if (addSkin) addSkin(reward.skinId);
            break;

        case 'chest':
            if (addChest) {
                addChest('event', {
                    eventId: event.id,
                    eventInstanceKey: event.instanceKey,
                    rare: !!reward.rare,
                });
            }
            break;
    }

    claimed.push(rewardIndex);

    const allClaimed = getAllClaimedRewards();
    allClaimed[event.instanceKey] = claimed;
    saveAllClaimedRewards(allClaimed);

    return { success: true, reward };
}

export function getEventStats(event, date = new Date()) {
    const rewards = getAvailableRewards(event, date);

    return {
        total: rewards.length,
        available: rewards.filter(r => r.isAvailable && !r.isClaimed).length,
        claimed: rewards.filter(r => r.isClaimed).length,
    };
}

export function formatEventDate(event) {
    const monthNames = [
        'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
        'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
    ];

    const start = `${event.startDate.day} ${monthNames[event.startDate.month - 1]}`;
    const end = `${event.endDate.day} ${monthNames[event.endDate.month - 1]}`;

    return `${start} — ${end}`;
}

export function getNextEvent(date = new Date()) {
    const allEvents = Object.values(getAllEvents());
    let next = null;
    let minDays = Infinity;

    for (const event of allEvents) {
        let start = new Date(date.getFullYear(), event.startDate.month - 1, event.startDate.day);

        if (start < date) {
            start = new Date(date.getFullYear() + 1, event.startDate.month - 1, event.startDate.day);
        }

        const days = Math.ceil((start - date) / (1000 * 60 * 60 * 24));

        if (days < minDays) {
            minDays = days;
            next = { ...event, daysUntil: days };
        }
    }

    return next;
}