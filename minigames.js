// minigames.js — система мини-игр

import { safeGetItem, safeSetItem } from './utils.js';

export const MINIGAMES_CONFIG = {
    COOLDOWN_KEY: 'towerMinigameCooldown',
    COOLDOWN_MS: 5 * 60 * 1000,
    DAILY_PLAYS_LIMIT: 10,
    DAILY_PLAYS_KEY: 'towerMinigameDailyPlays',
};

export const MINIGAMES = [
    {
        id: 'catch_coin',
        name: 'Поймай монету',
        desc: 'Тапай по падающим монетам за 15 секунд',
        icon: '🪙',
        duration: 15000,
        reward: { coins: 25, xp: 40 },
        color: '#FFB020',
    },
    {
        id: 'guess_color',
        name: 'Угадай цвет',
        desc: 'Угадай цвет следующего блока',
        rounds: 5,
        reward: { coins: 20, xp: 35 },
        color: '#A855F7',
    },
    {
        id: 'quick_tap',
        name: 'Быстрый тап',
        desc: 'Тапни 20 раз за 10 секунд',
        duration: 10000,
        target: 20,
        reward: { coins: 15, xp: 25 },
        color: '#4ECDC4',
    },
    {
        id: 'memory_blocks',
        name: 'Память блоков',
        desc: 'Запомни последовательность цветов',
        rounds: 4,
        reward: { coins: 30, xp: 50 },
        color: '#FF6B9D',
    },
    {
        id: 'reaction_test',
        name: 'Тест реакции',
        desc: 'Тапни как можно быстрее при зелёном сигнале',
        rounds: 3,
        reward: { coins: 20, xp: 35 },
        color: '#06D6A0',
    },
];

export function canPlayMinigame() {
    const lastPlay = safeGetItem(MINIGAMES_CONFIG.COOLDOWN_KEY, 0);
    const now = Date.now();
    
    if (now - lastPlay < MINIGAMES_CONFIG.COOLDOWN_MS) {
        const remaining = MINIGAMES_CONFIG.COOLDOWN_MS - (now - lastPlay);
        return {
            canPlay: false,
            reason: 'cooldown',
            remainingMs: remaining,
        };
    }
    
    const today = new Date().toDateString();
    const playsData = safeGetItem(MINIGAMES_CONFIG.DAILY_PLAYS_KEY, { date: today, count: 0 });
    
    if (playsData.date !== today) {
        safeSetItem(MINIGAMES_CONFIG.DAILY_PLAYS_KEY, { date: today, count: 0 });
        return { canPlay: true };
    }
    
    if (playsData.count >= MINIGAMES_CONFIG.DAILY_PLAYS_LIMIT) {
        return {
            canPlay: false,
            reason: 'daily_limit',
        };
    }
    
    return { canPlay: true };
}

export function recordMinigamePlay() {
    const today = new Date().toDateString();
    safeSetItem(MINIGAMES_CONFIG.COOLDOWN_KEY, Date.now());
    
    const playsData = safeGetItem(MINIGAMES_CONFIG.DAILY_PLAYS_KEY, { date: today, count: 0 });
    if (playsData.date !== today) {
        safeSetItem(MINIGAMES_CONFIG.DAILY_PLAYS_KEY, { date: today, count: 1 });
    } else {
        playsData.count++;
        safeSetItem(MINIGAMES_CONFIG.DAILY_PLAYS_KEY, playsData);
    }
}

export function getCooldownRemaining() {
    const lastPlay = safeGetItem(MINIGAMES_CONFIG.COOLDOWN_KEY, 0);
    const now = Date.now();
    const remaining = MINIGAMES_CONFIG.COOLDOWN_MS - (now - lastPlay);
    return Math.max(0, remaining);
}

export function formatCooldown(ms) {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export const GUESS_COLORS = [
    { name: 'Красный', hex: '#FF1744' },
    { name: 'Синий', hex: '#2979FF' },
    { name: 'Зелёный', hex: '#00E676' },
    { name: 'Жёлтый', hex: '#FFEA00' },
    { name: 'Фиолетовый', hex: '#D500F9' },
    { name: 'Оранжевый', hex: '#FF9100' },
];

export const MEMORY_COLORS = ['#FF1744', '#2979FF', '#00E676', '#FFEA00'];

export function createCatchCoinGame(container, onEnd) {
    const game = {
        score: 0,
        timeLeft: 15,
        coins: [],
        intervalId: null,
        spawnIntervalId: null,
        timerIntervalId: null,
        active: true,
    };
    
    container.innerHTML = `
        <div class="minigame-arena" id="catch-arena">
            <div class="minigame-hud">
                <div class="minigame-score">🪙 <span id="catch-score">0</span></div>
                <div class="minigame-timer">⏱ <span id="catch-timer">15</span></div>
            </div>
        </div>
    `;
    
    const arena = container.querySelector('#catch-arena');
    const scoreEl = container.querySelector('#catch-score');
    const timerEl = container.querySelector('#catch-timer');
    
    function spawnCoin() {
        if (!game.active) return;
        const coin = document.createElement('div');
        coin.className = 'minigame-coin';
        coin.textContent = '🪙';
        
        const arenaRect = arena.getBoundingClientRect();
        const x = Math.random() * (arenaRect.width - 50);
        coin.style.left = x + 'px';
        coin.style.top = '-50px';
        
        coin.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!game.active) return;
            game.score++;
            scoreEl.textContent = game.score;
            coin.classList.add('caught');
            setTimeout(() => coin.remove(), 300);
        });
        
        arena.appendChild(coin);
        game.coins.push(coin);
        
        let y = -50;
        const fallInterval = setInterval(() => {
            if (!game.active) {
                clearInterval(fallInterval);
                return;
            }
            y += 3;
            coin.style.top = y + 'px';
            if (y > arenaRect.height) {
                clearInterval(fallInterval);
                coin.remove();
            }
        }, 30);
        
        coin._fallInterval = fallInterval;
    }
    
    game.timerIntervalId = setInterval(() => {
        game.timeLeft--;
        timerEl.textContent = game.timeLeft;
        if (game.timeLeft <= 0) {
            endGame();
        }
    }, 1000);
    
    game.spawnIntervalId = setInterval(spawnCoin, 600);
    spawnCoin();
    
    function endGame() {
        game.active = false;
        clearInterval(game.timerIntervalId);
        clearInterval(game.spawnIntervalId);
        game.coins.forEach(c => {
            if (c._fallInterval) clearInterval(c._fallInterval);
        });
        
        const success = game.score >= 10;
        const multiplier = success ? 1 : game.score / 10;
        
        onEnd({
            success,
            score: game.score,
            multiplier,
            message: success ? `Поймано ${game.score} монет!` : `Поймано только ${game.score}. Нужно 10+`,
        });
    }
    
    return game;
}

export function createGuessColorGame(container, onEnd) {
    const game = {
        round: 0,
        maxRounds: 5,
        correct: 0,
        currentColor: null,
        active: true,
    };
    
    function renderRound() {
        if (game.round >= game.maxRounds) {
            endGame();
            return;
        }
        
        game.round++;
        const correctColor = GUESS_COLORS[Math.floor(Math.random() * GUESS_COLORS.length)];
        game.currentColor = correctColor;
        
        const options = [...GUESS_COLORS].sort(() => Math.random() - 0.5).slice(0, 4);
        if (!options.find(o => o.hex === correctColor.hex)) {
            options[Math.floor(Math.random() * 4)] = correctColor;
        }
        
        container.innerHTML = `
            <div class="minigame-guess">
                <div class="minigame-round">Раунд ${game.round} / ${game.maxRounds}</div>
                <div class="minigame-correct" style="background:${correctColor.hex}"></div>
                <div class="minigame-question">Какой это цвет?</div>
                <div class="minigame-options">
                    ${options.map(o => `
                        <button class="minigame-option" data-color="${o.hex}" style="background:${o.hex}">
                            ${o.name}
                        </button>
                    `).join('')}
                </div>
                <div class="minigame-progress">✅ ${game.correct} / ${game.round - 1}</div>
            </div>
        `;
        
        container.querySelectorAll('.minigame-option').forEach(btn => {
            btn.addEventListener('click', () => {
                if (!game.active) return;
                const chosen = btn.dataset.color;
                if (chosen === correctColor.hex) {
                    game.correct++;
                    btn.classList.add('correct');
                } else {
                    btn.classList.add('wrong');
                    container.querySelectorAll('.minigame-option').forEach(b => {
                        if (b.dataset.color === correctColor.hex) b.classList.add('correct');
                    });
                }
                container.querySelectorAll('.minigame-option').forEach(b => b.disabled = true);
                
                setTimeout(renderRound, 800);
            });
        });
    }
    
    function endGame() {
        game.active = false;
        const success = game.correct >= 3;
        const multiplier = game.correct / game.maxRounds;
        
        onEnd({
            success,
            score: game.correct,
            multiplier,
            message: `Угадано ${game.correct} из ${game.maxRounds}!`,
        });
    }
    
    renderRound();
    return game;
}

export function createQuickTapGame(container, onEnd) {
    const game = {
        taps: 0,
        target: 20,
        timeLeft: 10,
        timerIntervalId: null,
        active: true,
    };
    
    container.innerHTML = `
        <div class="minigame-tap">
            <div class="minigame-tap-hud">
                <div class="minigame-taps">Тапов: <span id="tap-count">0</span> / ${game.target}</div>
                <div class="minigame-timer">⏱ <span id="tap-timer">10</span></div>
            </div>
            <button class="minigame-tap-btn" id="tap-btn">ТАПАЙ!</button>
            <div class="minigame-progress-bar">
                <div class="minigame-progress-fill" id="tap-progress"></div>
            </div>
        </div>
    `;
    
    const countEl = container.querySelector('#tap-count');
    const timerEl = container.querySelector('#tap-timer');
    const progressEl = container.querySelector('#tap-progress');
    const tapBtn = container.querySelector('#tap-btn');
    
    tapBtn.addEventListener('click', () => {
        if (!game.active) return;
        game.taps++;
        countEl.textContent = game.taps;
        progressEl.style.width = `${Math.min(100, (game.taps / game.target) * 100)}%`;
        
        if (game.taps >= game.target) {
            endGame(true);
        }
    });
    
    game.timerIntervalId = setInterval(() => {
        game.timeLeft--;
        timerEl.textContent = game.timeLeft;
        if (game.timeLeft <= 0) {
            endGame(false);
        }
    }, 1000);
    
    function endGame(completed) {
        game.active = false;
        clearInterval(game.timerIntervalId);
        
        const success = completed;
        const multiplier = game.taps / game.target;
        
        onEnd({
            success,
            score: game.taps,
            multiplier,
            message: completed 
                ? `Успел! ${game.taps} тапов за ${10 - game.timeLeft} сек`
                : `Не успел. Только ${game.taps} тапов`,
        });
    }
    
    return game;
}

export function createMemoryBlocksGame(container, onEnd) {
    const game = {
        round: 0,
        maxRounds: 4,
        correct: 0,
        sequence: [],
        playerSequence: [],
        showing: false,
        active: true,
    };
    
    function renderRound() {
        if (game.round >= game.maxRounds) {
            endGame();
            return;
        }
        
        game.round++;
        game.sequence.push(MEMORY_COLORS[Math.floor(Math.random() * MEMORY_COLORS.length)]);
        game.playerSequence = [];
        
        container.innerHTML = `
            <div class="minigame-memory">
                <div class="minigame-round">Раунд ${game.round} / ${game.maxRounds}</div>
                <div class="minigame-status" id="memory-status">Запоминай...</div>
                <div class="minigame-colors" id="memory-colors">
                    ${MEMORY_COLORS.map(c => `
                        <button class="minigame-color-btn" data-color="${c}" style="background:${c}" disabled></button>
                    `).join('')}
                </div>
                <div class="minigame-sequence" id="memory-sequence"></div>
            </div>
        `;
        
        showSequence();
    }
    
    function showSequence() {
        game.showing = true;
        const buttons = container.querySelectorAll('.minigame-color-btn');
        buttons.forEach(b => b.disabled = true);
        
        const statusEl = container.querySelector('#memory-status');
        statusEl.textContent = 'Запоминай...';
        
        let i = 0;
        const showInterval = setInterval(() => {
            if (i >= game.sequence.length) {
                clearInterval(showInterval);
                game.showing = false;
                statusEl.textContent = 'Твоя очередь!';
                buttons.forEach(b => b.disabled = false);
                setupPlayerInput();
                return;
            }
            
            const color = game.sequence[i];
            const btn = container.querySelector(`[data-color="${color}"]`);
            btn.classList.add('flash');
            setTimeout(() => btn.classList.remove('flash'), 400);
            i++;
        }, 700);
    }
    
    function setupPlayerInput() {
        const buttons = container.querySelectorAll('.minigame-color-btn');
        buttons.forEach(btn => {
            btn.addEventListener('click', () => {
                if (game.showing || !game.active) return;
                
                const color = btn.dataset.color;
                game.playerSequence.push(color);
                
                const seqEl = container.querySelector('#memory-sequence');
                const dot = document.createElement('div');
                dot.className = 'memory-dot';
                dot.style.background = color;
                seqEl.appendChild(dot);
                
                btn.classList.add('flash');
                setTimeout(() => btn.classList.remove('flash'), 200);
                
                const idx = game.playerSequence.length - 1;
                if (game.playerSequence[idx] !== game.sequence[idx]) {
                    game.active = false;
                    endGame();
                    return;
                }
                
                if (game.playerSequence.length === game.sequence.length) {
                    game.correct++;
                    setTimeout(renderRound, 800);
                }
            });
        });
    }
    
    function endGame() {
        game.active = false;
        const success = game.correct >= 2;
        const multiplier = game.correct / game.maxRounds;
        
        onEnd({
            success,
            score: game.correct,
            multiplier,
            message: `Пройдено раундов: ${game.correct} из ${game.maxRounds}`,
        });
    }
    
    renderRound();
    return game;
}

export function createReactionTestGame(container, onEnd) {
    const game = {
        round: 0,
        maxRounds: 3,
        times: [],
        startTime: 0,
        waiting: false,
        active: true,
        timeoutId: null,
    };
    
    function renderRound() {
        if (game.round >= game.maxRounds) {
            endGame();
            return;
        }
        
        game.round++;
        game.waiting = false;
        
        container.innerHTML = `
            <div class="minigame-reaction">
                <div class="minigame-round">Раунд ${game.round} / ${game.maxRounds}</div>
                <div class="minigame-signal" id="reaction-signal">Жди зелёный...</div>
                <div class="minigame-avg" id="reaction-avg">
                    ${game.times.length > 0 ? `Среднее: ${Math.round(game.times.reduce((a,b) => a+b, 0) / game.times.length)} мс` : ''}
                </div>
            </div>
        `;
        
        const signal = container.querySelector('#reaction-signal');
        signal.classList.add('red');
        
        const delay = 1000 + Math.random() * 3000;
        game.timeoutId = setTimeout(() => {
            if (!game.active) return;
            signal.classList.remove('red');
            signal.classList.add('green');
            signal.textContent = 'ТАПАЙ!';
            game.startTime = performance.now();
            game.waiting = true;
        }, delay);
        
        signal.addEventListener('click', handleTap);
    }
    
    function handleTap() {
        if (!game.active) return;
        
        const signal = container.querySelector('#reaction-signal');
        
        if (!game.waiting) {
            signal.textContent = 'Слишком рано! 😅';
            signal.classList.remove('red');
            signal.classList.add('wrong');
            game.times.push(2000);
            setTimeout(renderRound, 1200);
            return;
        }
        
        const reactionTime = performance.now() - game.startTime;
        game.times.push(reactionTime);
        game.waiting = false;
        
        signal.textContent = `${Math.round(reactionTime)} мс`;
        signal.classList.remove('green');
        signal.classList.add('result');
        
        setTimeout(renderRound, 1000);
    }
    
    function endGame() {
        game.active = false;
        if (game.timeoutId) clearTimeout(game.timeoutId);
        
        const avgTime = Math.round(game.times.reduce((a, b) => a + b, 0) / game.times.length);
        const success = avgTime < 500;
        const multiplier = Math.max(0.5, Math.min(1.5, 1 - (avgTime - 300) / 1000));
        
        onEnd({
            success,
            score: avgTime,
            multiplier,
            message: `Средняя реакция: ${avgTime} мс`,
        });
    }
    
    renderRound();
    return game;
}

export function createMinigame(gameId, container, onEnd) {
    switch (gameId) {
        case 'catch_coin': return createCatchCoinGame(container, onEnd);
        case 'guess_color': return createGuessColorGame(container, onEnd);
        case 'quick_tap': return createQuickTapGame(container, onEnd);
        case 'memory_blocks': return createMemoryBlocksGame(container, onEnd);
        case 'reaction_test': return createReactionTestGame(container, onEnd);
        default:
            console.error('Unknown minigame:', gameId);
            return null;
    }
}

export function calculateMinigameReward(gameDef, result) {
    const baseCoins = gameDef.reward.coins;
    const baseXP = gameDef.reward.xp;
    
    const mult = result.multiplier || 1;
    const successBonus = result.success ? 1.5 : 1;
    
    return {
        coins: Math.round(baseCoins * mult * successBonus),
        xp: Math.round(baseXP * mult * successBonus),
    };
}
