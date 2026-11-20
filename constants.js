// constants.js — все константы и конфигурация

// ============ ИГРОВАЯ КОНФИГУРАЦИЯ ============
export const GAME_CONFIG = {
    BLOCK_SIZE: 4,
    BLOCK_HEIGHT: 1,
    BASE_SPEED: 0.16,
    DEFAULT_MAX_SPEED: 0.45,
    ENDLESS_MAX_SPEED: 0.7,
    SPEED_ACCELERATION: 0.004,
    MOVE_RANGE: 15,
    PERFECT_THRESHOLD: 0.15,
    TIGHT_THRESHOLD: 0.05,
    SOFT_THRESHOLD: 0.4,

    POINTS_NORMAL: 1,
    POINTS_GOLDEN: 3,
    POINTS_BOMB: 2,
    POINTS_ICE: 2,
    POINTS_RAINBOW: 10,
    POINTS_DRAGON: 10,
    POINTS_DIAMOND: 5,
    FURY_MULTIPLIER: 2,

    COINS_NORMAL: 1,
    COINS_PERFECT: 2,
    COINS_GOLDEN_BONUS: 2,
    COINS_BOMB_BONUS: 1,
    COINS_ICE_BONUS: 1,
    COINS_SECRET_BONUS: 3,
    COINS_LEVEL_UP: 50,
    COINS_MILESTONE: 5,
    COINS_FIRE_BONUS: 3,

    PROB_RAINBOW: 0.005,
    PROB_DRAGON: 0.010,
    PROB_DIAMOND: 0.015,
    PROB_GOLDEN: 0.075,
    PROB_BOMB: 0.135,
    PROB_ICE: 0.195,
    PROB_CRUMBLE: 0.235,

    DEFAULT_TIME_LIMIT: 60,
    TIME_BONUS_PERFECT: 2,
    WIND_GUST_MIN_INTERVAL: 7000,
    WIND_GUST_MAX_INTERVAL: 4000,

    FURY_COMBO_REQUIRED: 5,
    FURY_BLOCKS_COUNT: 3,
    FURY_SPEED_MULTIPLIER: 0.6,

    MUSIC_BASE_TEMPO: 110,
    MUSIC_MAX_TEMPO: 160,
    MUSIC_TEMPO_INCREMENT: 5,
    MUSIC_PHASE_2_SCORE: 15,
    MUSIC_PHASE_3_SCORE: 30,

    CAMERA_OFFSET_X: 20,
    CAMERA_OFFSET_Y: 25,
    CAMERA_OFFSET_Z: 20,
    CAMERA_LOOK_OFFSET_Y: 2,
    CAMERA_LERP_FACTOR: 0.1,
    CAMERA_SHAKE_DECAY: 0.85,

    SHAKE_BOMB: 0.5,
    SHAKE_DRAGON: 1.0,
    SHAKE_FIRE: 0.6,
    SHAKE_GAMEOVER: 0.8,
    SHAKE_GUST: 0.35,
};

export const LIMITS = {
    MAX_LEVEL: 100,
    MAX_LEADERBOARD_ENTRIES: 100,
    MAX_RECENT_SCORES: 10,
    MAX_CHESTS: 50,
    MAX_QUESTS: 3,
    MAX_DEBRIS: 150,
    MAX_CONFETTI: 400,
    MAX_TEXTURE_CACHE: 50,
    MIN_FONT_SIZE: 14,
    FPS_CHECK_INTERVAL: 3000,
    FPS_LOW_THRESHOLD: 30,
    FPS_HIGH_THRESHOLD: 55,
};

export const GAME_MODES = {
    CLASSIC: 'classic',
    TIME: 'time',
    PRECISION: 'precision',
    STORM: 'storm',
    ENDLESS: 'endless',
    MIRROR: 'mirror',
};

export const GAME_STATES = {
    MENU: 'menu',
    PLAYING: 'playing',
    PAUSED: 'paused',
    GAMEOVER: 'gameover',
};

export const GAME_MODE_NAMES = {
    [GAME_MODES.CLASSIC]: 'КЛАССИКА',
    [GAME_MODES.TIME]: 'НА ВРЕМЯ',
    [GAME_MODES.PRECISION]: '🎯 ТОЧНОСТЬ',
    [GAME_MODES.STORM]: '🌪 ШТОРМ',
    [GAME_MODES.ENDLESS]: '♾️ БЕСКОНЕЧНЫЙ',
    [GAME_MODES.MIRROR]: '🪞 ЗЕРКАЛЬНЫЙ',
};

export const BLOCK_TYPES = {
    NORMAL: 'normal',
    GOLDEN: 'golden',
    BOMB: 'bomb',
    ICE: 'ice',
    CRUMBLE: 'crumble',
    RAINBOW: 'rainbow',
    DRAGON: 'dragon',
    DIAMOND: 'diamond',
};

export const BLOCK_COLORS = {
    [BLOCK_TYPES.GOLDEN]: '#FFC107',
    [BLOCK_TYPES.BOMB]: '#FF1744',
    [BLOCK_TYPES.ICE]: '#00E5FF',
    [BLOCK_TYPES.CRUMBLE]: '#5D4037',
    [BLOCK_TYPES.RAINBOW]: '#FF00FF',
    [BLOCK_TYPES.DRAGON]: '#B71C1C',
    [BLOCK_TYPES.DIAMOND]: '#00BCD4',
};

export const BLOCK_GLOW_COLORS = {
    [BLOCK_TYPES.GOLDEN]: 0xFFD700,
    [BLOCK_TYPES.BOMB]: 0xFF1744,
    [BLOCK_TYPES.ICE]: 0x00E5FF,
    [BLOCK_TYPES.RAINBOW]: 0xFF00FF,
    [BLOCK_TYPES.DRAGON]: 0xFF6600,
    [BLOCK_TYPES.DIAMOND]: 0x00BCD4,
};

export const STORAGE_KEYS = {
    COINS: 'towerCoins',
    HIGH_SCORE: 'towerHighScore',
    SKIN: 'towerSkin',
    SKINS: 'towerSkins',
    PALETTE: 'towerPalette',
    PALETTES: 'towerUnlockedPalettes',
    BACKGROUND: 'towerBackground',
    BACKGROUNDS: 'towerUnlockedBackgrounds',
    FEATURES: 'towerFeatures',
    SETTINGS: 'towerSettings',
    STATS: 'towerStats',
    TOTAL_SCORE: 'towerTotalScore',
    RECENT_SCORES: 'towerRecentScores',
    ACHIEVEMENTS: 'towerAchievements',
    XP: 'towerXP',
    LEVEL: 'towerLevel',
    STREAK: 'towerStreak',
    LAST_VISIT: 'towerLastVisit',
    LEADERBOARD: 'towerLeaderboard',
    POWERUPS: 'towerPowerups',
    CHESTS: 'towerChests',
    QUESTS: 'towerQuests',
    TUTORIAL_SHOWN: 'towerTutorialShown',
    DAILY_CHALLENGE_DATE: 'towerDailyChallengeDate',
    DAILY_GAME_CHEST: 'towerDailyGameChest',
};

export const DEFAULTS = {
    COINS: 0,
    HIGH_SCORE: 0,
    SKIN: 'default',
    PALETTE: 'standard',
    BACKGROUND: 'default',
    LEVEL: 1,
    XP: 0,
    STREAK: 0,
    SETTINGS: {
        musicEnabled: true,
        sfxEnabled: true,
        hapticsEnabled: true,
    },
    STATS: {
        totalGames: 0, totalPerfect: 0, totalGolden: 0, totalBomb: 0,
        totalIce: 0, totalFury: 0, totalSecret: 0, maxScore: 0,
        maxCombo: 0, maxTimeScore: 0, dailyCompleted: 0,
    },
    POWERUPS: { foundation: 0, focus: 0, luck: 0, multiplier: 0 },
    ACTIVE_POWERUPS: { foundation: false, focus: false, luck: false, multiplier: false },
};

export function xpForNextLevel(level) {
    return 100 + (level - 1) * 50;
}

export function getAdaptiveD(aspect) {
    if (aspect < 0.6) return 16;
    if (aspect < 0.8) return 13;
    if (aspect < 1.0) return 11;
    return 10;
}

export const CONFETTI_COLORS = [0xFFD700, 0xFF6B9D, 0x4ECDC4, 0xA855F7, 0x4FACFE, 0xFFD93D];
export const MILESTONE_COLORS = ['#FF1744', '#F50057', '#D500F9', '#651FFF', '#2979FF', '#00B0FF', '#00E5FF', '#1DE9B6', '#00E676', '#FFEA00', '#FF9100', '#FF3D00'];
export const LEAD_NOTES = [523.25, 659.25, 783.99, 1046.50];
export const FEATURE_NAMES = { goldenTrail: 'Золотой след', redTheme: 'Красная тема' };