// combo-system.js — система комбо-множителей

export const COMBO_TIERS = [
    { threshold: 5,  mult: 2,  name: 'x2 КОМБО',    color: '#FFD93D', icon: '⚡', sound: 'combo_2x' },
    { threshold: 10, mult: 3,  name: 'x3 КОМБО',    color: '#FFA94D', icon: '🔥', sound: 'combo_3x' },
    { threshold: 15, mult: 5,  name: 'x5 МЕГА',     color: '#EF476F', icon: '💥', sound: 'combo_5x' },
    { threshold: 20, mult: 8,  name: 'x8 СУПЕР',    color: '#A855F7', icon: '🌟', sound: 'combo_super' },
    { threshold: 25, mult: 12, name: 'x12 УЛЬТРА',  color: '#FF00FF', icon: '💎', sound: 'combo_ultra' },
    { threshold: 30, mult: 20, name: 'x20 БЕЗУМИЕ', color: '#00FFFF', icon: '👑', sound: 'combo_insane' }
];

export function getComboTier(combo) {
    for (let i = COMBO_TIERS.length - 1; i >= 0; i--) {
        if (combo >= COMBO_TIERS[i].threshold) {
            return { ...COMBO_TIERS[i], tierIndex: i };
        }
    }
    return null;
}

export function getNextComboTier(combo) {
    for (const tier of COMBO_TIERS) {
        if (combo < tier.threshold) return tier;
    }
    return null;
}

export function applyComboMultiplier(basePoints, combo) {
    const tier = getComboTier(combo);
    if (!tier) return { points: basePoints, multiplier: 1, tier: null };
    return {
        points: Math.round(basePoints * tier.mult),
        multiplier: tier.mult,
        tier: tier
    };
}

export function checkTierUpgrade(oldCombo, newCombo) {
    const oldTier = getComboTier(oldCombo);
    const newTier = getComboTier(newCombo);
    if (newTier && (!oldTier || newTier.threshold > oldTier.threshold)) {
        return newTier;
    }
    return null;
}

export function formatComboDisplay(combo) {
    const tier = getComboTier(combo);
    const next = getNextComboTier(combo);
    
    if (!tier) {
        if (next) {
            return {
                text: `Серия ${combo}`,
                progress: combo / next.threshold,
                nextThreshold: next.threshold,
                color: '#EF476F'
            };
        }
        return { text: `Серия ${combo}`, progress: 1, color: '#EF476F' };
    }
    
    const progress = next ? (combo - tier.threshold) / (next.threshold - tier.threshold) : 1;
    return {
        text: `${tier.icon} ${tier.name}`,
        progress: progress,
        multiplier: tier.mult,
        color: tier.color,
        nextThreshold: next ? next.threshold : null
    };
}