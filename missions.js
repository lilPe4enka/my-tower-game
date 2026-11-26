// missions.js — система ежедневных миссий с платным обновлением списка

import { safeGetItem, safeSetItem } from './utils.js?v=18';

const MISSIONS_STORAGE_KEY = 'towerDailyMissions';
const MISSIONS_REROLL_KEY = 'towerMissionsReroll';
const DAILY_MISSIONS_COUNT = 5;

const MISSIONS_POOL = [
    // Лёгкие
    { id: 'blocks_25',   type: 'blocks',  target: 25,  icon: '🧱', text: 'Поставь 25 блоков',         reward: { coins: 35, xp: 40 } },
    { id: 'blocks_50',   type: 'blocks',  target: 50,  icon: '🏗️', text: 'Поставь 50 блоков',         reward: { coins: 60, xp: 65 } },
    { id: 'perfect_5',   type: 'perfect', target: 5,   icon: '🎯', text: 'Сделай 5 идеалов',          reward: { coins: 40, xp: 45 } },
    { id: 'perfect_12',  type: 'perfect', target: 12,  icon: '🎯', text: 'Сделай 12 идеалов',         reward: { coins: 75, xp: 80 } },
    { id: 'games_3',     type: 'games',   target: 3,   icon: '🎮', text: 'Сыграй 3 игры',             reward: { coins: 40, xp: 50 } },
    { id: 'games_6',     type: 'games',   target: 6,   icon: '🎲', text: 'Сыграй 6 игр',              reward: { coins: 75, xp: 85 } },
    { id: 'combo_3',     type: 'combo',   target: 3,   icon: '🔥', text: 'Собери серию x3',           reward: { coins: 45, xp: 50 } },
    { id: 'score_20',    type: 'score',   target: 20,  icon: '🏠', text: 'Набери 20 очков за игру',   reward: { coins: 45, xp: 55 } },
    { id: 'coins_80',    type: 'coins',   target: 80,  icon: '🪙', text: 'Заработай 80 монет',        reward: { coins: 50, xp: 50 } },
    { id: 'xp_120',      type: 'xp',      target: 120, icon: '⭐', text: 'Получи 120 опыта',          reward: { coins: 45, xp: 60 } },

    // Средние и сложные
    { id: 'blocks_100',  type: 'blocks',  target: 100, icon: '🏙️', text: 'Поставь 100 блоков',        reward: { coins: 110, xp: 110 } },
    { id: 'perfect_25',  type: 'perfect', target: 25,  icon: '🏹', text: 'Сделай 25 идеалов',         reward: { coins: 120, xp: 120 } },
    { id: 'combo_6',     type: 'combo',   target: 6,   icon: '💥', text: 'Собери серию x6',           reward: { coins: 95, xp: 100 } },
    { id: 'combo_10',    type: 'combo',   target: 10,  icon: '⚡', text: 'Собери серию x10',          reward: { coins: 150, xp: 140 } },
    { id: 'score_40',    type: 'score',   target: 40,  icon: '🏰', text: 'Набери 40 очков за игру',   reward: { coins: 100, xp: 100 } },
    { id: 'score_70',    type: 'score',   target: 70,  icon: '🗼', text: 'Набери 70 очков за игру',   reward: { coins: 140, chest: true, rare: false } },
    { id: 'fury_1',      type: 'fury',    target: 1,   icon: '😡', text: 'Активируй Ярость 1 раз',    reward: { coins: 70, xp: 75 } },
    { id: 'fury_3',      type: 'fury',    target: 3,   icon: '👹', text: 'Активируй Ярость 3 раза',   reward: { coins: 130, chest: true, rare: false } },
    { id: 'coins_200',   type: 'coins',   target: 200, icon: '💰', text: 'Заработай 200 монет',       reward: { coins: 100, xp: 90 } },
    { id: 'xp_300',      type: 'xp',      target: 300, icon: '🌟', text: 'Получи 300 опыта',          reward: { coins: 90, chest: true, rare: false } },
];

function generateDailyMissions(excludeIds = []) {
    const excludeSet = new Set(excludeIds);
    let pool = MISSIONS_POOL.filter(m => !excludeSet.has(m.id));
    if (pool.length < DAILY_MISSIONS_COUNT) {
        pool = [...MISSIONS_POOL];
    }

    // Перемешиваем и стараемся не брать два задания одного типа подряд
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    const selected = [];
    const usedTypes = new Set();

    for (const m of shuffled) {
        if (selected.length >= DAILY_MISSIONS_COUNT) break;
        if (usedTypes.has(m.type)) continue;
        usedTypes.add(m.type);
        selected.push({
            ...m,
            current: 0,
            completed: false,
            claimed: false,
        });
    }

    // Добираем до DAILY_MISSIONS_COUNT, если уникальных типов не хватило
    for (const m of shuffled) {
        if (selected.length >= DAILY_MISSIONS_COUNT) break;
        if (selected.some(s => s.id === m.id)) continue;
        selected.push({
            ...m,
            current: 0,
            completed: false,
            claimed: false,
        });
    }

    saveMissions(selected);
    return selected;
}

export function saveMissions(missions) {
    safeSetItem(MISSIONS_STORAGE_KEY, {
        date: new Date().toDateString(),
        missions,
    });
}

export function loadMissions() {
    const today = new Date().toDateString();
    const saved = safeGetItem(MISSIONS_STORAGE_KEY, null);
    if (saved && saved.date === today && Array.isArray(saved.missions) && saved.missions.length > 0) {
        return saved.missions;
    }
    return generateDailyMissions();
}

export function updateMissionProgress(missions, type, value, isMax = false) {
    if (!Array.isArray(missions) || !value) return false;
    let changed = false;

    for (const m of missions) {
        if (m.type !== type || m.completed) continue;
        if (isMax) {
            if (value > m.current) {
                m.current = Math.min(m.target, Math.floor(value));
                changed = true;
            }
        } else {
            m.current = Math.min(m.target, m.current + Math.floor(value));
            changed = true;
        }
        if (m.current >= m.target) {
            m.completed = true;
        }
    }

    if (changed) saveMissions(missions);
    return changed;
}

export function claimMissionReward(missionId, missions, addCoins, addXP, addChest) {
    if (!Array.isArray(missions)) return { success: false };
    const mission = missions.find(m => m.id === missionId);
    if (!mission || !mission.completed || mission.claimed) {
        return { success: false };
    }

    mission.claimed = true;
    saveMissions(missions);

    const r = mission.reward || {};
    if (r.coins && typeof addCoins === 'function') addCoins(r.coins);
    if (r.xp && typeof addXP === 'function') addXP(r.xp);
    if (r.chest && typeof addChest === 'function') {
        addChest('mission', { rare: Boolean(r.rare) });
    }

    return { success: true, mission };
}

export function getMissionsStats(missions) {
    if (!Array.isArray(missions)) {
        return { total: 0, completed: 0, claimed: 0, available: 0 };
    }
    const total = missions.length;
    const completed = missions.filter(m => m.completed).length;
    const claimed = missions.filter(m => m.claimed).length;
    const available = missions.filter(m => m.completed && !m.claimed).length;
    return { total, completed, claimed, available };
}

export function getMissionProgress(mission) {
    if (!mission || !mission.target) return 0;
    return Math.min(100, Math.round((mission.current / mission.target) * 100));
}

export function formatMissionReward(reward) {
    if (!reward) return '';
    const parts = [];
    if (reward.coins) parts.push(`+${reward.coins} 🪙`);
    if (reward.xp) parts.push(`+${reward.xp} ⭐`);
    if (reward.chest) parts.push(reward.rare ? '✨ Сундук' : '📦 Сундук');
    return parts.join(' · ');
}

// ============ ПЛАТНОЕ ОБНОВЛЕНИЕ МИССИЙ ДНЯ ============
export function getMissionRerollCount() {
    const today = new Date().toDateString();
    const data = safeGetItem(MISSIONS_REROLL_KEY, { date: today, count: 0 });
    if (!data || data.date !== today) return 0;
    return data.count || 0;
}

export function getMissionRerollCost() {
    const count = getMissionRerollCount();
    return Math.min(300, 100 + count * 50);
}

export function recordMissionReroll() {
    const today = new Date().toDateString();
    const count = getMissionRerollCount() + 1;
    safeSetItem(MISSIONS_REROLL_KEY, { date: today, count });
    return count;
}

export function rerollDailyMissions(currentMissions = []) {
    const prevIds = Array.isArray(currentMissions) ? currentMissions.map(m => m.id) : [];
    recordMissionReroll();
    return generateDailyMissions(prevIds);
}
