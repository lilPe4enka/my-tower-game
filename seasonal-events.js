// seasonal-events.js — сезонные (награды каждые 5 дней) и праздничные события

import { safeGetItem, safeSetItem } from './utils.js?v=18';

const EVENTS_CLAIMED_KEY = 'towerEventRewardsClaimed';
const EVENTS_START_DATE = new Date(2026, 10, 1); // 1 ноября 2026

export const EVENT_SKINS = {
    winter_event: {
        name: 'Снежный король',
        price: 999999,
        notBuyable: true,
        eventOnly: true,
        effect: 'ice',
        colors: ['#E0F7FA', '#B2EBF2', '#80DEEA', '#4DD0E1', '#26C6DA', '#00ACC1'],
        modifiers: { coinMult: 1.2, speedMult: 0.92 },
    },
    spring_event: {
        name: 'Сакура',
        price: 999999,
        notBuyable: true,
        eventOnly: true,
        effect: 'holographic',
        colors: ['#FFF0F3', '#FFCCD5', '#FFB3C1', '#FF8FA3', '#FF758F', '#FF4D6D'],
        modifiers: { xpMult: 1.25 },
    },
    summer_event: {
        name: 'Солнечный',
        price: 999999,
        notBuyable: true,
        eventOnly: true,
        effect: 'fire',
        colors: ['#FFF59D', '#FFE082', '#FFD54F', '#FFB300', '#FF8F00', '#FF6F00'],
        modifiers: { coinMult: 1.2, scoreMult: 1.1 },
    },
    autumn_event: {
        name: 'Листопад',
        price: 999999,
        notBuyable: true,
        eventOnly: true,
        effect: 'fire',
        colors: ['#FFE0B2', '#FFB74D', '#FF9800', '#F57C00', '#E65100', '#BF360C'],
        modifiers: { coinMult: 1.15, xpMult: 1.15 },
    },
    newyear_event: {
        name: 'Новогодний',
        price: 999999,
        notBuyable: true,
        eventOnly: true,
        effect: 'stars',
        colors: ['#D50000', '#FF1744', '#00C853', '#00E676', '#FFD600', '#FFFFFF'],
        modifiers: { coinMult: 1.25, xpMult: 1.2 },
    },
    halloween_event: {
        name: 'Тыквенный',
        price: 999999,
        notBuyable: true,
        eventOnly: true,
        effect: 'fire',
        colors: ['#FF6D00', '#FF9100', '#6A1B9A', '#4A148C', '#212121', '#FFD600'],
        modifiers: { scoreMult: 1.2 },
    },
    valentine_event: {
        name: 'Сердечный',
        price: 999999,
        notBuyable: true,
        eventOnly: true,
        effect: 'holographic',
        colors: ['#FF80AB', '#FF4081', '#F50057', '#C51162', '#FCE4EC', '#F48FB1'],
        modifiers: { coinMult: 1.2 },
    },
};

function buildSeasonalRewards(skinId, skinName) {
    return [
        { day: 5,  type: 'coins',   amount: 60,  text: '+60 🪙' },
        { day: 10, type: 'powerup', powerup: 'foundation', count: 1, text: '🧱 Фундамент x1' },
        { day: 15, type: 'coins',   amount: 100, text: '+100 🪙' },
        { day: 20, type: 'chest',   rare: false, text: '📦 Обычный сундук' },
        { day: 25, type: 'coins',   amount: 140, text: '+140 🪙' },
        { day: 30, type: 'powerup', powerup: 'focus', count: 2, text: '🎯 Точный глаз x2' },
        { day: 35, type: 'coins',   amount: 180, text: '+180 🪙' },
        { day: 40, type: 'chest',   rare: true,  text: '✨ Редкий сундук' },
        { day: 45, type: 'skin',    skin: skinId, text: `🎨 Облик «${skinName}»` },
        { day: 50, type: 'coins',   amount: 220, text: '+220 🪙' },
        { day: 55, type: 'powerup', powerup: 'luck', count: 2, text: '🍀 Удача x2' },
        { day: 60, type: 'chest',   rare: true,  text: '✨ Редкий сундук' },
        { day: 65, type: 'coins',   amount: 280, text: '+280 🪙' },
        { day: 70, type: 'powerup', powerup: 'multiplier', count: 2, text: '💰 Множитель x2' },
        { day: 75, type: 'coins',   amount: 350, text: '+350 🪙' },
        { day: 80, type: 'chest',   rare: true,  text: '✨ Редкий сундук' },
        { day: 85, type: 'coins',   amount: 450, text: '+450 🪙' },
        { day: 90, type: 'coins',   amount: 750, text: '👑 Финал сезона: +750 🪙' },
    ];
}

// Праздничные события (имеют приоритет над сезонными)
const HOLIDAY_EVENTS = [
    {
        id: 'new_year',
        name: 'Новогодний марафон',
        description: 'Праздничные подарки каждый день!',
        icon: '🎄',
        color: '#E53935',
        isHoliday: true,
        startMonth: 12, startDay: 25,
        endMonth: 1,    endDay: 7,
        rewards: [
            { day: 1,  type: 'coins',   amount: 100, text: '+100 🪙' },
            { day: 3,  type: 'powerup', powerup: 'luck', count: 2, text: '🍀 Удача x2' },
            { day: 5,  type: 'chest',   rare: true, text: '✨ Редкий сундук' },
            { day: 7,  type: 'skin',    skin: 'newyear_event', text: '🎨 Облик «Новогодний»' },
            { day: 10, type: 'coins',   amount: 250, text: '+250 🪙' },
            { day: 14, type: 'coins',   amount: 500, text: '🎆 Финал праздника: +500 🪙' },
        ],
    },
    {
        id: 'valentines',
        name: 'День влюблённых',
        description: 'Романтические награды и особый облик',
        icon: '💖',
        color: '#FF4081',
        isHoliday: true,
        startMonth: 2, startDay: 12,
        endMonth: 2,   endDay: 16,
        rewards: [
            { day: 1, type: 'coins',   amount: 100, text: '+100 🪙' },
            { day: 3, type: 'skin',    skin: 'valentine_event', text: '🎨 Облик «Сердечный»' },
            { day: 5, type: 'chest',   rare: true, text: '✨ Редкий сундук' },
        ],
    },
    {
        id: 'halloween',
        name: 'Хэллоуин',
        description: 'Жуткие призы и тыквенный облик!',
        icon: '🎃',
        color: '#FF6D00',
        isHoliday: true,
        startMonth: 10, startDay: 25,
        endMonth: 11,   endDay: 2,
        rewards: [
            { day: 1, type: 'coins',   amount: 100, text: '+100 🪙' },
            { day: 3, type: 'powerup', powerup: 'focus', count: 2, text: '🎯 Точный глаз x2' },
            { day: 5, type: 'skin',    skin: 'halloween_event', text: '🎨 Облик «Тыквенный»' },
            { day: 7, type: 'chest',   rare: true, text: '✨ Редкий сундук' },
            { day: 9, type: 'coins',   amount: 350, text: '👻 Финал: +350 🪙' },
        ],
    },
];

// Сезонные события (награды каждые 5 дней — 18 позиций за сезон)
const SEASONAL_EVENTS = [
    {
        id: 'winter_season',
        name: 'Зимний сезон',
        description: 'Награды каждые 5 дней всю зиму!',
        icon: '❄️',
        color: '#039BE5',
        isHoliday: false,
        startMonth: 12, startDay: 1,
        endMonth: 2,    endDay: 28,
        rewards: buildSeasonalRewards('winter_event', 'Снежный король'),
    },
    {
        id: 'spring_season',
        name: 'Весенний сезон',
        description: 'Награды каждые 5 дней всю весну!',
        icon: '🌸',
        color: '#EC407A',
        isHoliday: false,
        startMonth: 3, startDay: 1,
        endMonth: 5,   endDay: 31,
        rewards: buildSeasonalRewards('spring_event', 'Сакура'),
    },
    {
        id: 'summer_season',
        name: 'Летний сезон',
        description: 'Награды каждые 5 дней всё лето!',
        icon: '☀️',
        color: '#FB8C00',
        isHoliday: false,
        startMonth: 6, startDay: 1,
        endMonth: 8,   endDay: 31,
        rewards: buildSeasonalRewards('summer_event', 'Солнечный'),
    },
    {
        id: 'autumn_season',
        name: 'Осенний сезон',
        description: 'Награды каждые 5 дней всю осень!',
        icon: '🍂',
        color: '#E65100',
        isHoliday: false,
        startMonth: 9,  startDay: 1,
        endMonth: 11,   endDay: 30,
        rewards: buildSeasonalRewards('autumn_event', 'Листопад'),
    },
];

const ALL_EVENTS = [...HOLIDAY_EVENTS, ...SEASONAL_EVENTS];

const MONTH_SHORT_RU = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

function isLeapYear(year) {
    return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
}

function getEventDateRange(event, now = new Date()) {
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const wrapsYear = event.startMonth > event.endMonth;

    let startYear = year;
    let endYear = year;

    if (wrapsYear) {
        if (month >= event.startMonth) {
            endYear = year + 1;
        } else {
            startYear = year - 1;
        }
    }

    let endDay = event.endDay;
    if (event.endMonth === 2 && endDay === 28 && isLeapYear(endYear)) {
        endDay = 29;
    }

    const start = new Date(startYear, event.startMonth - 1, event.startDay, 0, 0, 0, 0);
    const end = new Date(endYear, event.endMonth - 1, endDay, 23, 59, 59, 999);
    return { start, end, cycleKey: `${event.id}_${startYear}` };
}

function isDateInEvent(event, now = new Date()) {
    const { start, end } = getEventDateRange(event, now);
    return now >= start && now <= end;
}

export function isEventsSystemActive() {
    return new Date() >= EVENTS_START_DATE;
}

export function getCurrentEvent(now = new Date()) {
    if (!isEventsSystemActive()) return null;
    for (const ev of HOLIDAY_EVENTS) {
        if (isDateInEvent(ev, now)) return ev;
    }
    for (const ev of SEASONAL_EVENTS) {
        if (isDateInEvent(ev, now)) return ev;
    }
    return null;
}

export function getEventDay(event, now = new Date()) {
    if (!event) return 1;
    const { start, end } = getEventDateRange(event, now);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffDays = Math.floor((todayStart - start) / 86400000) + 1;
    const totalDays = Math.floor((new Date(end.getFullYear(), end.getMonth(), end.getDate()) - start) / 86400000) + 1;
    return Math.max(1, Math.min(totalDays, diffDays));
}

export function getEventProgress(event, now = new Date()) {
    if (!event) return { currentDay: 1, totalDays: 1, progress: 0 };
    const { start, end } = getEventDateRange(event, now);
    const totalDays = Math.floor((new Date(end.getFullYear(), end.getMonth(), end.getDate()) - start) / 86400000) + 1;
    const currentDay = getEventDay(event, now);
    const progress = Math.min(100, Math.round((currentDay / Math.max(1, totalDays)) * 100));
    return { currentDay, totalDays, progress };
}

function getClaimedMap() {
    const data = safeGetItem(EVENTS_CLAIMED_KEY, {});
    return (data && typeof data === 'object' && !Array.isArray(data)) ? data : {};
}

function getClaimedIndicesForEvent(event) {
    if (!event) return [];
    const { cycleKey } = getEventDateRange(event);
    const map = getClaimedMap();
    return Array.isArray(map[cycleKey]) ? map[cycleKey] : [];
}

export function getAvailableRewards(event) {
    if (!event || !Array.isArray(event.rewards)) return [];
    const currentDay = getEventDay(event);
    const claimed = getClaimedIndicesForEvent(event);

    return event.rewards.map((reward, index) => {
        const isClaimed = claimed.includes(index);
        const isAvailable = currentDay >= reward.day;
        return {
            ...reward,
            index,
            isClaimed,
            isAvailable,
            canClaim: isAvailable && !isClaimed,
        };
    });
}

export function claimEventReward(eventId, rewardIndex, callbacks = {}) {
    const event = ALL_EVENTS.find(e => e.id === eventId);
    if (!event || !event.rewards[rewardIndex]) return { success: false };

    const reward = event.rewards[rewardIndex];
    const currentDay = getEventDay(event);
    if (currentDay < reward.day) return { success: false, reason: 'locked' };

    const { cycleKey } = getEventDateRange(event);
    const map = getClaimedMap();
    const list = Array.isArray(map[cycleKey]) ? [...map[cycleKey]] : [];
    if (list.includes(rewardIndex)) return { success: false, reason: 'claimed' };

    list.push(rewardIndex);
    map[cycleKey] = list;
    safeSetItem(EVENTS_CLAIMED_KEY, map);

    if (reward.type === 'coins' && typeof callbacks.addCoins === 'function') {
        callbacks.addCoins(reward.amount);
    } else if (reward.type === 'powerup' && typeof callbacks.addPowerup === 'function') {
        callbacks.addPowerup(reward.powerup, reward.count || 1);
    } else if (reward.type === 'skin' && typeof callbacks.addSkin === 'function') {
        callbacks.addSkin(reward.skin);
    } else if (reward.type === 'chest' && typeof callbacks.addChest === 'function') {
        callbacks.addChest('event', { rare: Boolean(reward.rare), eventId });
    }

    return { success: true, reward };
}

export function getEventStats(event) {
    const list = getAvailableRewards(event);
    return {
        total: list.length,
        claimed: list.filter(r => r.isClaimed).length,
        available: list.filter(r => r.canClaim).length,
    };
}

export function formatEventDate(event) {
    if (!event) return '';
    const { start, end } = getEventDateRange(event);
    return `${start.getDate()} ${MONTH_SHORT_RU[start.getMonth()]} — ${end.getDate()} ${MONTH_SHORT_RU[end.getMonth()]}`;
}
