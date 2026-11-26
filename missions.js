// missions.js — расширенная система ежедневных миссий (42 миссии, баланс сложности и реролл)

import { safeGetItem, safeSetItem } from './utils.js?v=18';

const MISSIONS_STORAGE_KEY = 'towerDailyMissions';
const MISSIONS_REROLL_KEY = 'towerMissionsReroll';
const DAILY_MISSIONS_COUNT = 5;

const MISSIONS_POOL = [
    // === ЛЁГКИЕ (tier: 'easy') ===
    { id: 'blocks_25',     tier: 'easy',   type: 'blocks',        target: 25,  icon: '🧱', text: 'Поставь 25 блоков',              reward: { coins: 35, xp: 40 } },
    { id: 'perfect_5',     tier: 'easy',   type: 'perfect',       target: 5,   icon: '🎯', text: 'Сделай 5 идеалов',               reward: { coins: 40, xp: 45 } },
    { id: 'games_3',       tier: 'easy',   type: 'games',         target: 3,   icon: '🎮', text: 'Сыграй 3 игры',                  reward: { coins: 40, xp: 50 } },
    { id: 'combo_3',       tier: 'easy',   type: 'combo',         target: 3,   icon: '🔥', text: 'Собери серию x3',                reward: { coins: 45, xp: 50 } },
    { id: 'score_20',      tier: 'easy',   type: 'score',         target: 20,  icon: '🏠', text: 'Набери 20 очков за игру',        reward: { coins: 45, xp: 55 } },
    { id: 'coins_80',      tier: 'easy',   type: 'coins',         target: 80,  icon: '🪙', text: 'Заработай 80 монет',             reward: { coins: 50, xp: 50 } },
    { id: 'xp_120',        tier: 'easy',   type: 'xp',            target: 120, icon: '⭐', text: 'Получи 120 опыта',               reward: { coins: 45, xp: 60 } },
    { id: 'cut_10',        tier: 'easy',   type: 'cut',           target: 10,  icon: '✂️', text: 'Сделай 10 срезов блоков',        reward: { coins: 40, xp: 45 } },
    { id: 'golden_2',      tier: 'easy',   type: 'golden',        target: 2,   icon: '👑', text: 'Поймай 2 золотых идеально',      reward: { coins: 50, xp: 55 } },
    { id: 'ice_2',         tier: 'easy',   type: 'ice',           target: 2,   icon: '❄️', text: 'Поймай 2 льда идеально',         reward: { coins: 50, xp: 55 } },
    { id: 'pstart_3',      tier: 'easy',   type: 'perfect_start', target: 3,   icon: '🚀', text: 'Первые 3 блока игры идеально',   reward: { coins: 55, xp: 55 } },
    { id: 'minigame_1',    tier: 'easy',   type: 'minigame_play', target: 1,   icon: '🎲', text: 'Сыграй 1 мини-игру',             reward: { coins: 45, xp: 50 } },
    { id: 'powerup_1',     tier: 'easy',   type: 'powerup_use',   target: 1,   icon: '⚡', text: 'Используй способность в игре',   reward: { coins: 55, xp: 50 } },
    { id: 'clean_20',      tier: 'easy',   type: 'clean_score',   target: 20,  icon: '🧘', text: '20 очков без способностей',      reward: { coins: 55, xp: 60 } },

    // === СРЕДНИЕ (tier: 'medium') ===
    { id: 'blocks_60',     tier: 'medium', type: 'blocks',          target: 60,  icon: '🏗️', text: 'Поставь 60 блоков',              reward: { coins: 75, xp: 75 } },
    { id: 'perfect_15',    tier: 'medium', type: 'perfect',         target: 15,  icon: '🎯', text: 'Сделай 15 идеалов',              reward: { coins: 85, xp: 85 } },
    { id: 'perfect_run_8', tier: 'medium', type: 'perfect_run',     target: 8,   icon: '🏹', text: '8 идеалов за одну игру',         reward: { coins: 90, xp: 85 } },
    { id: 'games_6',       tier: 'medium', type: 'games',           target: 6,   icon: '🕹️', text: 'Сыграй 6 игр',                   reward: { coins: 75, xp: 85 } },
    { id: 'combo_6',       tier: 'medium', type: 'combo',           target: 6,   icon: '💥', text: 'Собери серию x6',                reward: { coins: 95, xp: 100 } },
    { id: 'score_40',      tier: 'medium', type: 'score',           target: 40,  icon: '🏰', text: 'Набери 40 очков за игру',        reward: { coins: 100, xp: 100 } },
    { id: 'fury_1',        tier: 'medium', type: 'fury',            target: 1,   icon: '😡', text: 'Активируй Ярость 1 раз',         reward: { coins: 75, xp: 80 } },
    { id: 'bomb_2',        tier: 'medium', type: 'bomb',            target: 2,   icon: '💣', text: 'Обезвредь 2 бомбы идеально',     reward: { coins: 85, xp: 80 } },
    { id: 'crumble_2',     tier: 'medium', type: 'crumble_cut',     target: 2,   icon: '🧱', text: 'Аккуратно срежь 2 хрупких блока',reward: { coins: 90, xp: 85 } },
    { id: 'width_grow_2',  tier: 'medium', type: 'width_grow',      target: 2,   icon: '✨', text: 'Расширь блок серией 2 раза',     reward: { coins: 95, xp: 90 } },
    { id: 'storm_20',      tier: 'medium', type: 'storm_score',     target: 20,  icon: '🌪️', text: '20 очков в режиме «Шторм»',      reward: { coins: 95, xp: 90 } },
    { id: 'time_25',       tier: 'medium', type: 'time_score',      target: 25,  icon: '⏱️', text: '25 очков в режиме «На время»',   reward: { coins: 90, xp: 90 } },
    { id: 'mirror_20',     tier: 'medium', type: 'mirror_score',    target: 20,  icon: '🪞', text: '20 очков в «Зеркальном»',        reward: { coins: 95, xp: 90 } },
    { id: 'antigrav_rot1', tier: 'medium', type: 'antigrav_rot',    target: 1,   icon: '🪐', text: 'Переживи поворот в Антиграв.',   reward: { coins: 100, xp: 95 } },
    { id: 'coins_200',     tier: 'medium', type: 'coins',           target: 200, icon: '💰', text: 'Заработай 200 монет',            reward: { coins: 95, xp: 90 } },
    { id: 'minigame_3',    tier: 'medium', type: 'minigame_play',   target: 3,   icon: '🎪', text: 'Сыграй 3 мини-игры',             reward: { coins: 90, xp: 95 } },

    // === СЛОЖНЫЕ / ОСОБЫЕ (tier: 'hard') ===
    { id: 'blocks_120',    tier: 'hard',   type: 'blocks',          target: 120, icon: '🏙️', text: 'Поставь 120 блоков',             reward: { coins: 130, xp: 120 } },
    { id: 'perfect_30',    tier: 'hard',   type: 'perfect',         target: 30,  icon: '💎', text: 'Сделай 30 идеалов',              reward: { coins: 140, xp: 130 } },
    { id: 'combo_10',      tier: 'hard',   type: 'combo',           target: 10,  icon: '⚡', text: 'Собери серию x10',               reward: { coins: 160, chest: true, rare: false } },
    { id: 'score_75',      tier: 'hard',   type: 'score',           target: 75,  icon: '🗼', text: 'Набери 75 очков за игру',        reward: { coins: 150, chest: true, rare: false } },
    { id: 'fury_3',        tier: 'hard',   type: 'fury',            target: 3,   icon: '👹', text: 'Активируй Ярость 3 раза',        reward: { coins: 140, chest: true, rare: false } },
    { id: 'precision_12',  tier: 'hard',   type: 'precision_score', target: 12,  icon: '🩺', text: '12 очков в режиме «Точность»',   reward: { coins: 160, chest: true, rare: false } },
    { id: 'antigrav_35',   tier: 'hard',   type: 'antigrav_score',  target: 35,  icon: '🌌', text: '35 очков в «Антигравитации»',    reward: { coins: 160, chest: true, rare: false } },
    { id: 'clean_45',      tier: 'hard',   type: 'clean_score',     target: 45,  icon: '🥋', text: '45 очков без способностей',      reward: { coins: 150, xp: 130 } },
    { id: 'pstart_6',      tier: 'hard',   type: 'perfect_start',   target: 6,   icon: '☄️', text: 'Первые 6 блоков игры идеально',  reward: { coins: 150, chest: true, rare: false } },
    { id: 'contract_1',    tier: 'hard',   type: 'contract_win',    target: 1,   icon: '📜', text: 'Выполни 1 контракт',             reward: { coins: 140, chest: true, rare: false } },
    { id: 'secret_1',      tier: 'hard',   type: 'secret',          target: 1,   icon: '🌟', text: 'Поймай 1 секретный блок',        reward: { coins: 130, chest: true, rare: true } },
    { id: 'xp_350',        tier: 'hard',   type: 'xp',              target: 350, icon: '🏅', text: 'Получи 350 опыта',               reward: { coins: 110, chest: true, rare: false } },
];

function pickFromTier(tier, count, excludeIds, usedTypes, selected) {
    let pool = MISSIONS_POOL.filter(m => m.tier === tier && !excludeIds.has(m.id));
    if (pool.length < count) {
        pool = MISSIONS_POOL.filter(m => m.tier === tier);
    }
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    let picked = 0;

    for (const m of shuffled) {
        if (picked >= count) break;
        if (usedTypes.has(m.type) || selected.some(s => s.id === m.id)) continue;
        usedTypes.add(m.type);
        selected.push({ ...m, current: 0, completed: false, claimed: false });
        picked++;
    }
    return picked;
}

function generateDailyMissions(excludeIds = []) {
    const excludeSet = new Set(excludeIds);
    const selected = [];
    const usedTypes = new Set();

    // Баланс дня: 2 лёгкие + 2 средние + 1 сложная/особая
    pickFromTier('easy', 2, excludeSet, usedTypes, selected);
    pickFromTier('medium', 2, excludeSet, usedTypes, selected);
    pickFromTier('hard', 1, excludeSet, usedTypes, selected);

    // Страховка на добор до 5 миссий
    const rest = [...MISSIONS_POOL].sort(() => Math.random() - 0.5);
    for (const m of rest) {
        if (selected.length >= DAILY_MISSIONS_COUNT) break;
        if (selected.some(s => s.id === m.id) || usedTypes.has(m.type)) continue;
        usedTypes.add(m.type);
        selected.push({ ...m, current: 0, completed: false, claimed: false });
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
