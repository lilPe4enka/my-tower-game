// prestige.js — система престижа и редких сундуков за уровни

import { safeGetItem, safeSetItem } from './utils.js';

// ============ КОНФИГУРАЦИЯ ПРЕСТИЖА ============
export const PRESTIGE_CONFIG = {
    REQUIRED_LEVEL: 100,
    STORAGE_KEY: 'towerPrestige',
    BONUS_KEY: 'towerPrestigeBonus',
    BASE_COINS_REWARD: 1000,
    BASE_CHESTS_REWARD: 3,
    BONUS_PER_PRESTIGE: {
        coinMult: 0.1,
        xpMult: 0.1,
        scoreMult: 0.05,
    },
    MAX_PRESTIGE: 50,
};

// ============ ДРОП ПРЕСТИЖ-СУНДУКОВ ============
export const PRESTIGE_CHEST_REWARDS = [
    { type: 'coins', min: 500, max: 1500, weight: 40, text: (amt) => `+${amt} 🪙` },
    { type: 'coins', min: 1500, max: 3000, weight: 15, text: (amt) => `+${amt} 🪙 💎`, rare: true },
    { type: 'powerup', powerup: 'foundation', count: 3, weight: 5, text: '🧱 Фундамент x3' },
    { type: 'powerup', powerup: 'focus', count: 3, weight: 5, text: '🎯 Точный глаз x3' },
    { type: 'powerup', powerup: 'luck', count: 3, weight: 5, text: '🍀 Удача x3' },
    { type: 'powerup', powerup: 'multiplier', count: 2, weight: 5, text: '💰 Множитель x2' },
    { type: 'prestige_skin', skinId: 'prestige_bronze', weight: 4, text: '🥉 Бронзовая корона', tier: 1 },
    { type: 'prestige_skin', skinId: 'prestige_silver', weight: 3, text: '🥈 Серебряная корона', tier: 2 },
    { type: 'prestige_skin', skinId: 'prestige_gold', weight: 2, text: '🥇 Золотая корона', tier: 3 },
    { type: 'prestige_skin', skinId: 'prestige_diamond', weight: 1, text: '💎 Алмазная корона', tier: 4 },
    { type: 'permanent_buff', effect: 'coin_boost', value: 0.05, weight: 4, text: '🪙 +5% монет навсегда' },
    { type: 'permanent_buff', effect: 'xp_boost', value: 0.05, weight: 4, text: '⭐ +5% опыта навсегда' },
    { type: 'legendary_skin', skinId: 'prestige_crown', weight: 2, text: '👑 Корона Престижа', legendary: true },
    { type: 'super_boost', effect: 'all_boost', value: 0.1, weight: 1, text: '✨ +10% ко всему навсегда', legendary: true },
    { type: 'mega_chest', count: 5, weight: 2, text: '📦 5 мега-сундуков', legendary: true },
];

// ============ ПРЕСТИЖ-СКИНЫ ============
export const PRESTIGE_SKINS = {
    prestige_bronze: {
        name: 'Бронзовая корона', price: 0, notBuyable: true, prestigeOnly: true, prestigeTier: 1,
        colors: ['#CD7F32', '#B87333', '#A0522D', '#8B4513', '#D2691E', '#BC8F8F'],
        modifiers: { coinMult: 1.05 },
    },
    prestige_silver: {
        name: 'Серебряная корона', price: 0, notBuyable: true, prestigeOnly: true, prestigeTier: 2,
        colors: ['#C0C0C0', '#A9A9A9', '#808080', '#D3D3D3', '#B0C4DE', '#778899'],
        modifiers: { coinMult: 1.1, scoreMult: 1.05 },
    },
    prestige_gold: {
        name: 'Золотая корона', price: 0, notBuyable: true, prestigeOnly: true, prestigeTier: 3,
        colors: ['#FFD700', '#FFA500', '#FF8C00', '#FFB347', '#FFE5B4', '#DAA520'],
        modifiers: { coinMult: 1.15, scoreMult: 1.1, xpMult: 1.05 },
    },
    prestige_diamond: {
        name: 'Алмазная корона', price: 0, notBuyable: true, prestigeOnly: true, prestigeTier: 4,
        colors: ['#E0FFFF', '#AFEEEE', '#40E0D0', '#00CED1', '#008B8B', '#B0E0E6'],
        modifiers: { coinMult: 1.2, scoreMult: 1.15, xpMult: 1.1 },
    },
    prestige_crown: {
        name: 'Корона Престижа', price: 0, notBuyable: true, prestigeOnly: true, prestigeTier: 5, legendary: true,
        colors: ['#FF00FF', '#00FFFF', '#FFFF00', '#FF0080', '#800080', '#008080'],
        modifiers: { coinMult: 1.25, scoreMult: 1.2, xpMult: 1.15 },
    },
};

// ============ ФУНКЦИИ ПРЕСТИЖА ============
export function getPrestigeCount() {
    return safeGetItem(PRESTIGE_CONFIG.STORAGE_KEY, 0);
}

export function setPrestigeCount(count) {
    safeSetItem(PRESTIGE_CONFIG.STORAGE_KEY, count);
}

export function getPrestigeBonus() {
    const bonus = safeGetItem(PRESTIGE_CONFIG.BONUS_KEY, {});
    return {
        coinMult: bonus.coinMult || 0,
        xpMult: bonus.xpMult || 0,
        scoreMult: bonus.scoreMult || 0,
        allMult: bonus.allMult || 0,
    };
}

export function setPrestigeBonus(bonus) {
    safeSetItem(PRESTIGE_CONFIG.BONUS_KEY, bonus);
}

export function canPrestige(level) {
    const count = getPrestigeCount();
    return level >= PRESTIGE_CONFIG.REQUIRED_LEVEL && count < PRESTIGE_CONFIG.MAX_PRESTIGE;
}

export function getPrestigeProgress(level) {
    return Math.min(100, (level / PRESTIGE_CONFIG.REQUIRED_LEVEL) * 100);
}

export function performPrestige() {
    const currentCount = getPrestigeCount();
    const newCount = currentCount + 1;
    
    if (newCount > PRESTIGE_CONFIG.MAX_PRESTIGE) {
        return { success: false, reason: 'max_reached' };
    }
    
    setPrestigeCount(newCount);
    
    const currentBonus = getPrestigeBonus();
    const newBonus = {
        coinMult: currentBonus.coinMult + PRESTIGE_CONFIG.BONUS_PER_PRESTIGE.coinMult,
        xpMult: currentBonus.xpMult + PRESTIGE_CONFIG.BONUS_PER_PRESTIGE.xpMult,
        scoreMult: currentBonus.scoreMult + PRESTIGE_CONFIG.BONUS_PER_PRESTIGE.scoreMult,
        allMult: currentBonus.allMult,
    };
    setPrestigeBonus(newBonus);
    
    const coinsReward = PRESTIGE_CONFIG.BASE_COINS_REWARD * newCount;
    const chestsReward = PRESTIGE_CONFIG.BASE_CHESTS_REWARD + Math.floor(newCount / 2);
    
    return {
        success: true,
        prestigeCount: newCount,
        bonus: newBonus,
        coinsReward,
        chestsReward,
    };
}

export function resetProgressForPrestige() {
    safeSetItem('towerLevel', 1);
    safeSetItem('towerXP', 0);
    safeSetItem('towerHighScore', 0);
    safeSetItem('towerTotalScore', 0);
    safeSetItem('towerRecentScores', []);
    safeSetItem('towerLeaderboard', []);
    
    const stats = safeGetItem('towerStats', {});
    stats.maxScore = 0;
    stats.maxCombo = 0;
    stats.maxTimeScore = 0;
    safeSetItem('towerStats', stats);
}

// ============ РОЛЛ НАГРАДЫ ============
export function rollPrestigeChestReward() {
    const totalWeight = PRESTIGE_CHEST_REWARDS.reduce((sum, r) => sum + r.weight, 0);
    let roll = Math.random() * totalWeight;
    
    for (const reward of PRESTIGE_CHEST_REWARDS) {
        roll -= reward.weight;
        if (roll <= 0) {
            const result = { ...reward };
            if (reward.type === 'coins') {
                const amount = Math.floor(reward.min + Math.random() * (reward.max - reward.min));
                result.amount = amount;
                result.text = reward.text(amount);
            }
            return result;
        }
    }
    
    return { type: 'coins', amount: 500, text: '+500 🪙' };
}

export function applyPrestigeReward(reward, callbacks) {
    const { addCoins, addPowerup, addSkin, addChest, addPermanentBuff } = callbacks;
    
    switch (reward.type) {
        case 'coins':
            if (addCoins) addCoins(reward.amount);
            break;
        case 'powerup':
            if (addPowerup) addPowerup(reward.powerup, reward.count);
            break;
        case 'prestige_skin':
        case 'legendary_skin':
            if (addSkin) addSkin(reward.skinId);
            break;
        case 'permanent_buff':
        case 'super_boost':
            if (addPermanentBuff) addPermanentBuff(reward.effect, reward.value);
            break;
        case 'mega_chest':
            if (addChest) {
                for (let i = 0; i < reward.count; i++) {
                    addChest('mega', { prestige: true });
                }
            }
            break;
    }
}

export function formatPrestigeBonus(bonus) {
    const parts = [];
    if (bonus.coinMult > 0) parts.push(`🪙 +${Math.round(bonus.coinMult * 100)}%`);
    if (bonus.xpMult > 0) parts.push(`⭐ +${Math.round(bonus.xpMult * 100)}%`);
    if (bonus.scoreMult > 0) parts.push(`🏗️ +${Math.round(bonus.scoreMult * 100)}%`);
    if (bonus.allMult > 0) parts.push(`✨ +${Math.round(bonus.allMult * 100)}%`);
    return parts.join('  ');
}

// ============ MILESTONE-СУНДУКИ (каждые 5 уровней) ============
export const LEVEL_MILESTONE_CONFIG = {
    MILESTONE_INTERVAL: 5,
    STORAGE_KEY: 'towerLevelMilestones',
};

export function getClaimedMilestones() {
    return safeGetItem(LEVEL_MILESTONE_CONFIG.STORAGE_KEY, []);
}

export function setClaimedMilestones(milestones) {
    safeSetItem(LEVEL_MILESTONE_CONFIG.STORAGE_KEY, milestones);
}

export function checkNewMilestones(oldLevel, newLevel) {
    const claimed = getClaimedMilestones();
    const newMilestones = [];
    
    for (let lvl = oldLevel + 1; lvl <= newLevel; lvl++) {
        if (lvl % LEVEL_MILESTONE_CONFIG.MILESTONE_INTERVAL === 0 && !claimed.includes(lvl)) {
            newMilestones.push(lvl);
            claimed.push(lvl);
        }
    }
    
    if (newMilestones.length > 0) {
        setClaimedMilestones(claimed);
    }
    
    return newMilestones;
}