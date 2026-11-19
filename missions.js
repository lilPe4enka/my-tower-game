// missions.js — система ежедневных миссий

import { safeGetItem, safeSetItem } from './utils.js';

// ============ ПУЛ МИССИЙ ============
export const MISSIONS_POOL = [
    // Идеальные попадания
    { id: 'perfect_3', type: 'perfect', target: 3, reward: { coins: 25, xp: 40 }, icon: '🎯', text: 'Сделай 3 идеальных попадания' },
    { id: 'perfect_5', type: 'perfect', target: 5, reward: { coins: 40, xp: 60 }, icon: '🎯', text: 'Сделай 5 идеальных попаданий' },
    { id: 'perfect_10', type: 'perfect', target: 10, reward: { coins: 80, xp: 120 }, icon: '🎯', text: 'Сделай 10 идеальных попаданий' },
    
    // Набор очков
    { id: 'score_15', type: 'score', target: 15, reward: { coins: 30, xp: 50 }, icon: '🏗️', text: 'Набери 15 очков за игру' },
    { id: 'score_30', type: 'score', target: 30, reward: { coins: 60, xp: 100 }, icon: '🏗️', text: 'Набери 30 очков за игру' },
    { id: 'score_50', type: 'score', target: 50, reward: { coins: 100, xp: 180 }, icon: '🏗️', text: 'Набери 50 очков за игру' },
    
    // Специальные блоки
    { id: 'golden_2', type: 'golden', target: 2, reward: { coins: 35, xp: 60 }, icon: '👑', text: 'Поймай 2 золотых блока' },
    { id: 'golden_5', type: 'golden', target: 5, reward: { coins: 70, xp: 120 }, icon: '👑', text: 'Поймай 5 золотых блоков' },
    { id: 'bomb_2', type: 'bomb', target: 2, reward: { coins: 40, xp: 70 }, icon: '💣', text: 'Обезвредь 2 бомбы идеально' },
    { id: 'ice_2', type: 'ice', target: 2, reward: { coins: 35, xp: 60 }, icon: '❄️', text: 'Поймай 2 ледяных блока' },
    { id: 'secret_1', type: 'secret', target: 1, reward: { coins: 100, xp: 200 }, icon: '🌟', text: 'Найди секретный блок' },
    { id: 'secret_2', type: 'secret', target: 2, reward: { coins: 180, xp: 350 }, icon: '🌟', text: 'Найди 2 секретных блока' },
    
    // Комбо
    { id: 'combo_5', type: 'combo', target: 5, reward: { coins: 45, xp: 80 }, icon: '🔥', text: 'Достигни серии x5' },
    { id: 'combo_10', type: 'combo', target: 10, reward: { coins: 80, xp: 150 }, icon: '🔥', text: 'Достигни серии x10' },
    { id: 'combo_15', type: 'combo', target: 15, reward: { coins: 120, xp: 220 }, icon: '🔥', text: 'Достигни серии x15' },
    
    // Игры
    { id: 'games_2', type: 'games', target: 2, reward: { coins: 20, xp: 30 }, icon: '🎮', text: 'Сыграй 2 игры' },
    { id: 'games_5', type: 'games', target: 5, reward: { coins: 50, xp: 80 }, icon: '🎮', text: 'Сыграй 5 игр' },
    
    // Монеты
    { id: 'coins_100', type: 'coins', target: 100, reward: { xp: 150, chest: 1 }, icon: '🪙', text: 'Заработай 100 монет' },
    { id: 'coins_300', type: 'coins', target: 300, reward: { xp: 300, chest: 2 }, icon: '🪙', text: 'Заработай 300 монет' },
    
    // Опыт
    { id: 'xp_200', type: 'xp', target: 200, reward: { coins: 50, chest: 1 }, icon: '⭐', text: 'Получи 200 опыта' },
    { id: 'xp_500', type: 'xp', target: 500, reward: { coins: 100, chest: 2 }, icon: '⭐', text: 'Получи 500 опыта' },
    
    // Ярость
    { id: 'fury_1', type: 'fury', target: 1, reward: { coins: 60, xp: 100 }, icon: '💥', text: 'Активируй ярость' },
    { id: 'fury_3', type: 'fury', target: 3, reward: { coins: 150, xp: 250 }, icon: '💥', text: 'Активируй ярость 3 раза' },
    
    // Режимы
    { id: 'time_game_1', type: 'time_game', target: 1, reward: { coins: 30, xp: 50 }, icon: '⏱️', text: 'Сыграй 1 игру на время' },
    { id: 'storm_game_1', type: 'storm_game', target: 1, reward: { coins: 40, xp: 70 }, icon: '🌪️', text: 'Сыграй 1 игру в шторм' },
    
    // Срезы
    { id: 'cuts_5', type: 'cuts', target: 5, reward: { coins: 25, xp: 40 }, icon: '✂️', text: 'Сделай 5 срезов' },
    { id: 'cuts_15', type: 'cuts', target: 15, reward: { coins: 60, xp: 100 }, icon: '✂️', text: 'Сделай 15 срезов' },
    
    // Серии дней
    { id: 'streak_3', type: 'streak', target: 3, reward: { coins: 80, xp: 120 }, icon: '🔥', text: 'Заходи 3 дня подряд' },
    { id: 'streak_7', type: 'streak', target: 7, reward: { coins: 200, xp: 350, chest: 1 }, icon: '🔥', text: 'Заходи 7 дней подряд' },
];

// ============ КОНФИГУРАЦИЯ ============
export const MISSIONS_CONFIG = {
    MIN_MISSIONS_PER_DAY: 3,
    MAX_MISSIONS_PER_DAY: 5,
    STORAGE_KEY: 'towerDailyMissions',
    DATE_KEY: 'towerDailyMissionsDate',
    CLAIMED_KEY: 'towerDailyMissionsClaimed',
};

// ============ ГЕНЕРАЦИЯ МИССИЙ ============
export function generateDailyMissions() {
    const pool = [...MISSIONS_POOL];
    const count = MISSIONS_CONFIG.MIN_MISSIONS_PER_DAY +
        Math.floor(Math.random() * (MISSIONS_CONFIG.MAX_MISSIONS_PER_DAY - MISSIONS_CONFIG.MIN_MISSIONS_PER_DAY + 1));
    
    const missions = [];
    const usedTypes = new Set();
    
    for (let i = 0; i < count && pool.length > 0; i++) {
        let attempts = 0;
        let selectedIdx = -1;
        
        while (attempts < 20) {
            const idx = Math.floor(Math.random() * pool.length);
            const mission = pool[idx];
            if (!usedTypes.has(mission.type) || attempts > 10) {
                selectedIdx = idx;
                break;
            }
            attempts++;
        }
        
        if (selectedIdx === -1) selectedIdx = Math.floor(Math.random() * pool.length);
        
        const mission = pool.splice(selectedIdx, 1)[0];
        usedTypes.add(mission.type);
        
        missions.push({
            ...mission,
            current: 0,
            completed: false,
            claimed: false,
        });
    }
    
    return missions;
}

// ============ ЗАГРУЗКА/СОХРАНЕНИЕ ============
export function loadMissions() {
    const today = new Date().toDateString();
    const savedDate = safeGetItem(MISSIONS_CONFIG.DATE_KEY, null);
    
    if (savedDate !== today) {
        const missions = generateDailyMissions();
        safeSetItem(MISSIONS_CONFIG.STORAGE_KEY, missions);
        safeSetItem(MISSIONS_CONFIG.DATE_KEY, today);
        safeSetItem(MISSIONS_CONFIG.CLAIMED_KEY, []);
        return missions;
    }
    
    const missions = safeGetItem(MISSIONS_CONFIG.STORAGE_KEY, []);
    const claimed = safeGetItem(MISSIONS_CONFIG.CLAIMED_KEY, []);
    
    if (!Array.isArray(missions)) return [];
    
    missions.forEach(m => {
        if (Array.isArray(claimed) && claimed.includes(m.id)) {
            m.claimed = true;
        }
    });
    
    return missions;
}

export function saveMissions(missions) {
    safeSetItem(MISSIONS_CONFIG.STORAGE_KEY, missions);
    safeSetItem(MISSIONS_CONFIG.DATE_KEY, new Date().toDateString());
    const claimed = missions.filter(m => m.claimed).map(m => m.id);
    safeSetItem(MISSIONS_CONFIG.CLAIMED_KEY, claimed);
}

// ============ ОБНОВЛЕНИЕ ПРОГРЕССА ============
export function updateMissionProgress(missions, type, value, isMax = false) {
    if (!Array.isArray(missions)) return false;
    let changed = false;
    
    missions.forEach(mission => {
        if (mission.type !== type || mission.claimed) return;
        
        if (isMax) {
            if (value > mission.current) {
                mission.current = Math.min(mission.target, value);
                changed = true;
            }
        } else {
            mission.current = Math.min(mission.target, mission.current + value);
            changed = true;
        }
        
        if (mission.current >= mission.target && !mission.completed) {
            mission.completed = true;
            changed = true;
        }
    });
    
    if (changed) saveMissions(missions);
    return changed;
}

// ============ ЗАБРАТЬ НАГРАДУ ============
export function claimMissionReward(missionId, missions, addCoinsFn, addXPFn, addChestFn) {
    const mission = missions.find(m => m.id === missionId);
    if (!mission || !mission.completed || mission.claimed) {
        return { success: false, reason: 'invalid' };
    }
    
    mission.claimed = true;
    saveMissions(missions);
    
    const reward = mission.reward;
    if (reward.coins && addCoinsFn) addCoinsFn(reward.coins);
    if (reward.xp && addXPFn) addXPFn(reward.xp);
    if (reward.chest && addChestFn) {
        for (let i = 0; i < reward.chest; i++) {
            addChestFn('mission', { missionId });
        }
    }
    
    return { success: true, reward };
}

// ============ СТАТИСТИКА ============
export function getMissionsStats(missions) {
    if (!Array.isArray(missions)) return { total: 0, completed: 0, claimed: 0, available: 0 };
    const total = missions.length;
    const completed = missions.filter(m => m.completed).length;
    const claimed = missions.filter(m => m.claimed).length;
    const available = completed - claimed;
    return { total, completed, claimed, available };
}

// ============ ФОРМАТИРОВАНИЕ НАГРАДЫ ============
export function formatMissionReward(reward) {
    const parts = [];
    if (reward.coins) parts.push(`🪙 ${reward.coins}`);
    if (reward.xp) parts.push(`⭐ ${reward.xp}`);
    if (reward.chest) parts.push(`📦 ${reward.chest}`);
    return parts.join('  ');
}

// ============ ПРОГРЕСС ============
export function getMissionProgress(mission) {
    if (!mission || mission.target === 0) return 0;
    return Math.min(100, (mission.current / mission.target) * 100);
}
