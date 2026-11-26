// contracts.js — система контрактов (ставок за монеты перед игрой)

export const CONTRACTS = [
    {
        id: 'score_25_clean',
        icon: '🏗️',
        name: 'Чистый подъём',
        desc: 'Набрать 25+ очков без бустов',
        stake: 80,
        reward: 220,
        noPowerups: true,
        type: 'score',
        target: 25,
    },
    {
        id: 'score_45_clean',
        icon: '🗼',
        name: 'Вызов высоте',
        desc: 'Набрать 45+ очков без бустов',
        stake: 150,
        reward: 450,
        noPowerups: true,
        type: 'score',
        target: 45,
    },
    {
        id: 'combo_6',
        icon: '🔥',
        name: 'Ритм-машина',
        desc: 'Собрать серию x6 за один забег',
        stake: 100,
        reward: 280,
        noPowerups: false,
        type: 'combo',
        target: 6,
    },
    {
        id: 'combo_10',
        icon: '⚡',
        name: 'Стальные нервы',
        desc: 'Собрать серию x10 за один забег',
        stake: 200,
        reward: 650,
        noPowerups: false,
        type: 'combo',
        target: 10,
    },
    {
        id: 'perfect_15',
        icon: '🎯',
        name: 'Ювелир',
        desc: 'Сделать 15 идеалов за одну игру',
        stake: 120,
        reward: 340,
        noPowerups: false,
        type: 'perfect',
        target: 15,
    },
    {
        id: 'antigrav_20',
        icon: '🪐',
        name: 'Повелитель орбиты',
        desc: 'Набрать 20+ очков в «Антигравитации»',
        stake: 120,
        reward: 380,
        noPowerups: false,
        onlyMode: 'antigravity',
        type: 'score',
        target: 20,
    },
];

export function getContractById(id) {
    return CONTRACTS.find(c => c.id === id) || null;
}

export function getContractsForMode(mode) {
    return CONTRACTS.filter(c => !c.onlyMode || c.onlyMode === mode);
}

export function createContractTracker(contract) {
    if (!contract) return null;
    return {
        contract,
        current: 0,
        completed: false,
        paidOut: false,
    };
}

export function updateContractTracker(tracker, { score = 0, combo = 0, runPerfects = 0 } = {}) {
    if (!tracker || tracker.completed) return { justCompleted: false };
    const { type, target } = tracker.contract;

    if (type === 'score') tracker.current = Math.max(tracker.current, score);
    else if (type === 'combo') tracker.current = Math.max(tracker.current, combo);
    else if (type === 'perfect') tracker.current = Math.max(tracker.current, runPerfects);

    if (tracker.current >= target) {
        tracker.completed = true;
        return { justCompleted: true, reward: tracker.contract.reward };
    }
    return { justCompleted: false };
}

export function formatContractHUD(tracker) {
    if (!tracker) return '';
    const { icon, target, reward } = tracker.contract;
    if (tracker.completed) {
        return `✅ ${icon} Контракт выполнен (+${reward} 🪙)`;
    }
    return `📜 ${icon} ${Math.min(tracker.current, target)}/${target} → ${reward} 🪙`;
}
