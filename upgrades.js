// upgrades.js — система постоянных апгрейдов за монеты

import { safeGetItem, safeSetItem, validateObject } from './utils.js?v=17';

export const UPGRADES_STORAGE_KEY = 'towerPermanentUpgrades';
export const MAX_UPGRADE_LEVEL = 5;

export const UPGRADES = [
    {
        id: 'greed',
        icon: '🪙',
        name: 'Жадность',
        desc: '+5% к получаемым монетам',
        basePrice: 300,
        perLevel: 0.05,
        formatBonus: (lvl) => `+${lvl * 5}% 🪙`,
    },
    {
        id: 'scholar',
        icon: '⭐',
        name: 'Опытный',
        desc: '+5% к получаемому опыту',
        basePrice: 300,
        perLevel: 0.05,
        formatBonus: (lvl) => `+${lvl * 5}% XP`,
    },
    {
        id: 'safety_net',
        icon: '💖',
        name: 'Запас прочности',
        desc: '-10% к цене «Второго шанса»',
        basePrice: 320,
        perLevel: 0.10,
        formatBonus: (lvl) => `-${lvl * 10}% цена`,
    },
    {
        id: 'wide_base',
        icon: '🧱',
        name: 'Широкая база',
        desc: '+2% к стартовому размеру блока',
        basePrice: 350,
        perLevel: 0.02,
        formatBonus: (lvl) => `+${lvl * 2}% база`,
    },
    {
        id: 'eagle_eye',
        icon: '🎯',
        name: 'Орлиный глаз',
        desc: '+4% к зоне идеального попадания',
        basePrice: 350,
        perLevel: 0.04,
        formatBonus: (lvl) => `+${lvl * 4}% зона`,
    },
    {
        id: 'fortune',
        icon: '🍀',
        name: 'Фортуна',
        desc: '+8% к шансу золотых и секретных блоков',
        basePrice: 380,
        perLevel: 0.08,
        formatBonus: (lvl) => `+${lvl * 8}% удача`,
    },
    {
        id: 'combo_master',
        icon: '🔥',
        name: 'Мастер комбо',
        desc: '+4% к очкам во время серий (x2+)',
        basePrice: 400,
        perLevel: 0.04,
        formatBonus: (lvl) => `+${lvl * 4}% очки`,
    },
    {
        id: 'time_keeper',
        icon: '⏱️',
        name: 'Хранитель времени',
        desc: '+2 сек к старту в режиме «На время»',
        basePrice: 320,
        perLevel: 2,
        formatBonus: (lvl) => `+${lvl * 2} сек`,
    },
    {
        id: 'wind_breaker',
        icon: '🌪️',
        name: 'Волнорез',
        desc: '-6% к силе ветра в «Шторме»',
        basePrice: 320,
        perLevel: 0.06,
        formatBonus: (lvl) => `-${lvl * 6}% ветер`,
    },
];

let upgradeLevels = {};

export function loadUpgrades() {
    const saved = validateObject(safeGetItem(UPGRADES_STORAGE_KEY, {}), {});
    upgradeLevels = {};
    UPGRADES.forEach(u => {
        const raw = Number(saved[u.id] || 0);
        upgradeLevels[u.id] = Math.max(0, Math.min(MAX_UPGRADE_LEVEL, Math.floor(raw)));
    });
    return upgradeLevels;
}

export function saveUpgrades() {
    safeSetItem(UPGRADES_STORAGE_KEY, upgradeLevels);
}

export function getUpgradeLevel(id) {
    return upgradeLevels[id] || 0;
}

// Прогрессивный рост цены: ~300 -> 560 -> 1030 -> 1900 -> 3520
export function getUpgradePrice(upgrade) {
    const lvl = getUpgradeLevel(upgrade.id);
    if (lvl >= MAX_UPGRADE_LEVEL) return null;
    const raw = upgrade.basePrice * Math.pow(1.85, lvl);
    return Math.round(raw / 10) * 10;
}

export function buyUpgrade(id, currentCoins) {
    const upgrade = UPGRADES.find(u => u.id === id);
    if (!upgrade) return { success: false };
    const lvl = getUpgradeLevel(id);
    if (lvl >= MAX_UPGRADE_LEVEL) return { success: false, reason: 'max' };
    const price = getUpgradePrice(upgrade);
    if (currentCoins < price) return { success: false, reason: 'coins', price };

    upgradeLevels[id] = lvl + 1;
    saveUpgrades();
    return { success: true, price, newLevel: upgradeLevels[id], upgrade };
}

export function getUpgradeBonuses() {
    return {
        coinMult: getUpgradeLevel('greed') * 0.05,
        xpMult: getUpgradeLevel('scholar') * 0.05,
        secondChanceDiscount: getUpgradeLevel('safety_net') * 0.10,
        baseSizeMult: getUpgradeLevel('wide_base') * 0.02,
        perfectMult: getUpgradeLevel('eagle_eye') * 0.04,
        luckMult: getUpgradeLevel('fortune') * 0.08,
        comboScoreMult: getUpgradeLevel('combo_master') * 0.04,
        extraTime: getUpgradeLevel('time_keeper') * 2,
        windResist: getUpgradeLevel('wind_breaker') * 0.06,
    };
}

export function getUpgradesProgress() {
    const total = UPGRADES.length * MAX_UPGRADE_LEVEL;
    const current = UPGRADES.reduce((sum, u) => sum + getUpgradeLevel(u.id), 0);
    return { current, total };
}
