// minigames.js — система мини-игр с HiDPI-отрисовкой

import { safeGetItem, safeSetItem } from './utils.js?v=15';

export const MINIGAMES_CONFIG = {
    COOLDOWN_KEY: 'towerMinigameCooldown',
    COOLDOWN_MS: 5 * 60 * 1000,
    DAILY_PLAYS_LIMIT: 10,
    DAILY_PLAYS_KEY: 'towerMinigameDailyPlays',
};

export const MINIGAMES = [
    {
        id: 'pop_lock',
        name: 'Взлом сейфа',
        desc: 'Тапай, когда стрелка в золотой зоне (8 замков)',
        icon: '🔐',
        reward: { coins: 35, xp: 55 },
        color: '#FFB020',
    },
    {
        id: 'treasure_grid',
        name: 'Охота за золотом',
        desc: 'Открывай монеты, обходи 3 бомбы и забирай куш вовремя',
        icon: '🗺️',
        reward: { coins: 40, xp: 50 },
        color: '#F59E0B',
    },
    {
        id: 'dodge_arena',
        name: 'Звёздный дождь',
        desc: 'Лови монеты и уворачивайся от бомб 18 секунд',
        icon: '🚀',
        reward: { coins: 35, xp: 60 },
        color: '#4FACFE',
    },
    {
        id: 'match_pairs',
        name: 'Пары блоков',
        desc: 'Найди все 6 пар за 30 секунд',
        icon: '🃏',
        reward: { coins: 30, xp: 50 },
        color: '#A855F7',
    },
    {
        id: 'timing_bar',
        name: 'Идеальный тайминг',
        desc: 'Останови бегунок точно в центре в 5 раундах',
        icon: '🎯',
        reward: { coins: 30, xp: 45 },
        color: '#06D6A0',
    },
];

export function getRemainingDailyPlays() {
    const today = new Date().toDateString();
    const playsData = safeGetItem(MINIGAMES_CONFIG.DAILY_PLAYS_KEY, { date: today, count: 0 });
    if (!playsData || playsData.date !== today) return MINIGAMES_CONFIG.DAILY_PLAYS_LIMIT;
    return Math.max(0, MINIGAMES_CONFIG.DAILY_PLAYS_LIMIT - (playsData.count || 0));
}

export function canPlayMinigame() {
    const lastPlay = safeGetItem(MINIGAMES_CONFIG.COOLDOWN_KEY, 0);
    const now = Date.now();

    if (now - lastPlay < MINIGAMES_CONFIG.COOLDOWN_MS) {
        return {
            canPlay: false,
            reason: 'cooldown',
            remainingMs: MINIGAMES_CONFIG.COOLDOWN_MS - (now - lastPlay),
        };
    }

    const today = new Date().toDateString();
    const playsData = safeGetItem(MINIGAMES_CONFIG.DAILY_PLAYS_KEY, { date: today, count: 0 });

    if (!playsData || playsData.date !== today) {
        safeSetItem(MINIGAMES_CONFIG.DAILY_PLAYS_KEY, { date: today, count: 0 });
        return { canPlay: true };
    }

    if (playsData.count >= MINIGAMES_CONFIG.DAILY_PLAYS_LIMIT) {
        return { canPlay: false, reason: 'daily_limit' };
    }

    return { canPlay: true };
}

export function recordMinigamePlay() {
    const today = new Date().toDateString();
    safeSetItem(MINIGAMES_CONFIG.COOLDOWN_KEY, Date.now());

    const playsData = safeGetItem(MINIGAMES_CONFIG.DAILY_PLAYS_KEY, { date: today, count: 0 });
    if (!playsData || playsData.date !== today) {
        safeSetItem(MINIGAMES_CONFIG.DAILY_PLAYS_KEY, { date: today, count: 1 });
    } else {
        playsData.count++;
        safeSetItem(MINIGAMES_CONFIG.DAILY_PLAYS_KEY, playsData);
    }
}

export function getCooldownRemaining() {
    const lastPlay = safeGetItem(MINIGAMES_CONFIG.COOLDOWN_KEY, 0);
    return Math.max(0, MINIGAMES_CONFIG.COOLDOWN_MS - (Date.now() - lastPlay));
}

export function formatCooldown(ms) {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function setupHiDPICanvas(canvas, logicalWidth, logicalHeight) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(logicalWidth * dpr);
    canvas.height = Math.round(logicalHeight * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return ctx;
}

// =========================================================
// 1. ВЗЛОМ СЕЙФА (Pop the Lock)
// =========================================================
export function createPopLockGame(container, onEnd) {
    const targetHits = 8;
    const game = {
        active: true,
        rafId: null,
        hits: 0,
        lives: 3,
        angle: -Math.PI / 2,
        dir: 1,
        speed: 2.2,
        targetAngle: Math.PI / 2,
        arcHalf: 0.36,
        flashColor: null,
        flashTimer: 0,
        lastTime: performance.now(),
        destroy() {
            game.active = false;
            if (game.rafId) cancelAnimationFrame(game.rafId);
        },
    };

    container.innerHTML = `
        <div class="mg-lock-wrap">
            <div class="mg-top-hud">
                <span>🔓 <b id="lock-hits">0</b> / ${targetHits}</span>
                <span id="lock-lives">❤️❤️❤️</span>
            </div>
            <canvas id="lock-canvas" class="mg-canvas" width="240" height="240"></canvas>
            <div class="mg-hint">Тапни по кругу, когда стрелка попадёт в золото!</div>
        </div>
    `;

    const canvas = container.querySelector('#lock-canvas');
    const ctx = setupHiDPICanvas(canvas, 240, 240);
    const hitsEl = container.querySelector('#lock-hits');
    const livesEl = container.querySelector('#lock-lives');

    function spawnTarget() {
        const offset = (1.3 + Math.random() * 2.6) * game.dir;
        game.targetAngle = game.angle + offset;
        game.arcHalf = Math.max(0.22, 0.36 - game.hits * 0.018);
    }

    function angleDist(a, b) {
        return Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
    }

    function finish() {
        if (!game.active) return;
        game.destroy();
        const success = game.hits >= targetHits;
        onEnd({
            success,
            score: game.hits,
            multiplier: Math.max(0.3, game.hits / targetHits),
            message: success ? 'Сейф взломан! Все 8 замков открыты!' : `Открыто замков: ${game.hits} из ${targetHits}`,
        });
    }

    function handleTap(e) {
        e.stopPropagation();
        if (!game.active) return;

        if (angleDist(game.angle, game.targetAngle) <= game.arcHalf) {
            game.hits++;
            hitsEl.textContent = game.hits;
            game.dir *= -1;
            game.speed = Math.min(4.6, 2.2 + game.hits * 0.28);
            game.flashColor = '#06D6A0';
            game.flashTimer = 0.22;
            if (game.hits >= targetHits) {
                setTimeout(finish, 200);
            } else {
                spawnTarget();
            }
        } else {
            game.lives--;
            livesEl.textContent = '❤️'.repeat(Math.max(0, game.lives)) || '💔';
            game.flashColor = '#EF476F';
            game.flashTimer = 0.25;
            if (game.lives <= 0) {
                setTimeout(finish, 250);
            }
        }
    }

    canvas.addEventListener('pointerdown', handleTap);
    spawnTarget();

    function draw(now) {
        if (!game.active) return;
        const dt = Math.min((now - game.lastTime) / 1000, 0.05);
        game.lastTime = now;

        game.angle += game.dir * game.speed * dt;
        if (game.flashTimer > 0) game.flashTimer -= dt;

        ctx.clearRect(0, 0, 240, 240);
        const cx = 120, cy = 120, r = 86;

        // Кольцо
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.strokeStyle = '#E9E4F0';
        ctx.lineWidth = 22;
        ctx.stroke();

        // Золотая зона
        ctx.beginPath();
        ctx.arc(cx, cy, r, game.targetAngle - game.arcHalf, game.targetAngle + game.arcHalf);
        ctx.strokeStyle = '#FFB020';
        ctx.lineWidth = 22;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Стрелка-бегунок
        const px = cx + Math.cos(game.angle) * r;
        const py = cy + Math.sin(game.angle) * r;
        ctx.beginPath();
        ctx.arc(px, py, 12, 0, Math.PI * 2);
        ctx.fillStyle = '#4A4458';
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#FFFFFF';
        ctx.stroke();

        // Центр с прогрессом
        ctx.beginPath();
        ctx.arc(cx, cy, 46, 0, Math.PI * 2);
        ctx.fillStyle = game.flashTimer > 0 ? game.flashColor : '#F8F6FA';
        ctx.fill();

        ctx.fillStyle = game.flashTimer > 0 ? '#FFFFFF' : '#4A4458';
        ctx.font = '900 32px Rubik, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(targetHits - game.hits), cx, cy);

        game.rafId = requestAnimationFrame(draw);
    }

    game.rafId = requestAnimationFrame(draw);
    return game;
}

// =========================================================
// 2. ОХОТА ЗА ЗОЛОТОМ (Push-your-luck 4x4)
// =========================================================
export function createTreasureGridGame(container, onEnd) {
    const items = [
        'bomb', 'bomb', 'bomb',
        'gem', 'gem',
        'coin', 'coin', 'coin', 'coin', 'coin', 'coin', 'coin', 'coin', 'coin', 'coin', 'coin',
    ].sort(() => Math.random() - 0.5);

    const safeTotal = 13;
    const game = {
        active: true,
        points: 0,
        openedSafe: 0,
        endTimer: null,
        destroy() {
            game.active = false;
            if (game.endTimer) clearTimeout(game.endTimer);
        },
    };

    container.innerHTML = `
        <div class="mg-grid-wrap">
            <div class="mg-top-hud">
                <span>💰 Очки: <b id="grid-pts">0</b></span>
                <span>💣 Бомб: <b>3</b></span>
            </div>
            <div class="mg-treasure-grid" id="treasure-grid">
                ${items.map((_, idx) => `<button class="mg-tile" data-idx="${idx}">?</button>`).join('')}
            </div>
            <button class="btn-primary mg-cashout-btn" id="grid-cashout" disabled>💰 ЗАБРАТЬ НАГРАДУ</button>
        </div>
    `;

    const ptsEl = container.querySelector('#grid-pts');
    const cashoutBtn = container.querySelector('#grid-cashout');
    const tiles = container.querySelectorAll('.mg-tile');

    function revealAll() {
        tiles.forEach((btn, idx) => {
            if (btn.classList.contains('opened')) return;
            const type = items[idx];
            btn.disabled = true;
            btn.classList.add('revealed');
            btn.textContent = type === 'bomb' ? '💣' : type === 'gem' ? '💎' : '🪙';
        });
    }

    function finish(busted) {
        if (!game.active) return;
        game.destroy();
        if (busted) {
            onEnd({
                success: false,
                score: game.points,
                multiplier: 0.3,
                message: `Бум! Нарвался на бомбу (было ${game.points} очк.)`,
            });
        } else {
            const success = game.points >= 5;
            onEnd({
                success,
                score: game.points,
                multiplier: Math.min(1.6, Math.max(0.4, game.points / 7)),
                message: game.openedSafe === safeTotal
                    ? `ДЖЕКПОТ! Открыто всё поле (${game.points} очк.)!`
                    : `Успешно забрал добычу: ${game.points} очк.!`,
            });
        }
    }

    tiles.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!game.active || btn.classList.contains('opened')) return;
            const idx = Number(btn.dataset.idx);
            const type = items[idx];
            btn.classList.add('opened', type);
            btn.disabled = true;

            if (type === 'bomb') {
                btn.textContent = '💥';
                cashoutBtn.disabled = true;
                revealAll();
                game.endTimer = setTimeout(() => finish(true), 850);
                return;
            }

            const gain = type === 'gem' ? 3 : 1;
            btn.textContent = type === 'gem' ? '💎' : '🪙';
            game.points += gain;
            game.openedSafe++;
            ptsEl.textContent = game.points;
            cashoutBtn.disabled = false;
            cashoutBtn.textContent = `💰 ЗАБРАТЬ (${game.points} очк.)`;

            if (game.openedSafe >= safeTotal) {
                cashoutBtn.disabled = true;
                revealAll();
                game.endTimer = setTimeout(() => finish(false), 600);
            }
        });
    });

    cashoutBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!game.active || game.openedSafe === 0) return;
        revealAll();
        finish(false);
    });

    return game;
}

// =========================================================
// 3. ЗВЁЗДНЫЙ ДОЖДЬ (Аркада на Canvas)
// =========================================================
export function createDodgeArenaGame(container, onEnd) {
    const W = 280, H = 260;
    const game = {
        active: true,
        rafId: null,
        timerId: null,
        timeLeft: 18,
        score: 0,
        lives: 3,
        invuln: 0,
        playerX: W / 2,
        targetX: W / 2,
        entities: [],
        spawnAcc: 0,
        lastTime: performance.now(),
        destroy() {
            game.active = false;
            if (game.rafId) cancelAnimationFrame(game.rafId);
            if (game.timerId) clearInterval(game.timerId);
        },
    };

    container.innerHTML = `
        <div class="mg-dodge-wrap">
            <div class="mg-top-hud">
                <span>🪙 <b id="dodge-score">0</b></span>
                <span id="dodge-lives">❤️❤️❤️</span>
                <span>⏱ <b id="dodge-time">18</b></span>
            </div>
            <canvas id="dodge-canvas" class="mg-canvas mg-dodge-canvas" width="${W}" height="${H}"></canvas>
            <div class="mg-hint">Води пальцем по экрану: лови 🪙, избегай 💣</div>
        </div>
    `;

    const canvas = container.querySelector('#dodge-canvas');
    const ctx = setupHiDPICanvas(canvas, W, H);
    const scoreEl = container.querySelector('#dodge-score');
    const livesEl = container.querySelector('#dodge-lives');
    const timeEl = container.querySelector('#dodge-time');

    function updateTargetFromEvent(e) {
        const rect = canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const relX = ((clientX - rect.left) / rect.width) * W;
        game.targetX = Math.max(20, Math.min(W - 20, relX));
    }

    canvas.addEventListener('pointerdown', (e) => { e.stopPropagation(); updateTargetFromEvent(e); });
    canvas.addEventListener('pointermove', (e) => {
        if (e.buttons > 0 || e.pointerType === 'touch') {
            e.stopPropagation();
            updateTargetFromEvent(e);
        }
    });
    canvas.addEventListener('touchmove', (e) => { e.preventDefault(); e.stopPropagation(); updateTargetFromEvent(e); }, { passive: false });

    function finish() {
        if (!game.active) return;
        game.destroy();
        const success = game.lives > 0 && game.score >= 10;
        onEnd({
            success,
            score: game.score,
            multiplier: Math.min(1.5, Math.max(0.35, game.score / 12)),
            message: game.lives <= 0
                ? `Щиты пробиты! Собрано ${game.score} монет`
                : `Отлично! Собрано ${game.score} монет!`,
        });
    }

    game.timerId = setInterval(() => {
        if (!game.active) return;
        game.timeLeft--;
        timeEl.textContent = game.timeLeft;
        if (game.timeLeft <= 0) finish();
    }, 1000);

    function loop(now) {
        if (!game.active) return;
        const dt = Math.min((now - game.lastTime) / 1000, 0.05);
        game.lastTime = now;

        game.playerX += (game.targetX - game.playerX) * Math.min(1, dt * 16);
        if (game.invuln > 0) game.invuln -= dt;

        game.spawnAcc += dt;
        const spawnEvery = Math.max(0.28, 0.52 - (18 - game.timeLeft) * 0.012);
        if (game.spawnAcc >= spawnEvery) {
            game.spawnAcc = 0;
            const isBomb = Math.random() < 0.36;
            game.entities.push({
                x: 18 + Math.random() * (W - 36),
                y: -16,
                vy: (isBomb ? 145 : 120) + Math.random() * 55,
                r: isBomb ? 13 : 12,
                type: isBomb ? 'bomb' : 'coin',
            });
        }

        // Фон
        const grad = ctx.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, '#141B3A');
        grad.addColorStop(1, '#2B2D5C');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);

        // Объекты
        for (let i = game.entities.length - 1; i >= 0; i--) {
            const o = game.entities[i];
            o.y += o.vy * dt;

            const dx = o.x - game.playerX;
            const dy = o.y - (H - 30);
            if (Math.hypot(dx, dy) < o.r + 15) {
                game.entities.splice(i, 1);
                if (o.type === 'coin') {
                    game.score++;
                    scoreEl.textContent = game.score;
                } else if (game.invuln <= 0) {
                    game.lives--;
                    game.invuln = 0.7;
                    livesEl.textContent = '❤️'.repeat(Math.max(0, game.lives)) || '💔';
                    if (game.lives <= 0) { finish(); return; }
                }
                continue;
            }

            if (o.y > H + 20) {
                game.entities.splice(i, 1);
                continue;
            }

            ctx.beginPath();
            ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2);
            ctx.fillStyle = o.type === 'coin' ? '#FFD93D' : '#EF476F';
            ctx.fill();
            ctx.font = '15px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(o.type === 'coin' ? '🪙' : '💣', o.x, o.y + 1);
        }

        // Игрок
        ctx.save();
        if (game.invuln > 0 && Math.floor(now / 70) % 2 === 0) ctx.globalAlpha = 0.4;
        ctx.fillStyle = '#4ECDC4';
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(game.playerX - 16, H - 44, 32, 28, 8);
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        game.rafId = requestAnimationFrame(loop);
    }

    game.rafId = requestAnimationFrame(loop);
    return game;
}

// =========================================================
// 4. ПАРЫ БЛОКОВ (Memory Match 4x3)
// =========================================================
export function createMatchPairsGame(container, onEnd) {
    const icons = ['👑', '💎', '🐉', '🌈', '❄️', '🔥'];
    const deck = [...icons, ...icons].sort(() => Math.random() - 0.5);

    const game = {
        active: true,
        timeLeft: 30,
        matched: 0,
        combo: 0,
        bonusPts: 0,
        flipped: [],
        locked: false,
        timerId: null,
        flipTimer: null,
        destroy() {
            game.active = false;
            if (game.timerId) clearInterval(game.timerId);
            if (game.flipTimer) clearTimeout(game.flipTimer);
        },
    };

    container.innerHTML = `
        <div class="mg-pairs-wrap">
            <div class="mg-top-hud">
                <span>🃏 Пар: <b id="pairs-count">0</b> / 6</span>
                <span>⏱ <b id="pairs-time">30</b></span>
            </div>
            <div class="mg-pairs-grid">
                ${deck.map((icon, idx) => `<button class="mg-pair-card" data-idx="${idx}" data-icon="${icon}">?</button>`).join('')}
            </div>
        </div>
    `;

    const countEl = container.querySelector('#pairs-count');
    const timeEl = container.querySelector('#pairs-time');
    const cards = container.querySelectorAll('.mg-pair-card');

    function finish() {
        if (!game.active) return;
        game.destroy();
        const success = game.matched === 6;
        const speedBonus = success ? Math.min(0.4, game.timeLeft / 40) : 0;
        onEnd({
            success,
            score: game.matched,
            multiplier: Math.max(0.3, game.matched / 6 + speedBonus),
            message: success
                ? `Все 6 пар найдены! Осталось ${game.timeLeft} сек`
                : `Найдено пар: ${game.matched} из 6`,
        });
    }

    game.timerId = setInterval(() => {
        if (!game.active) return;
        game.timeLeft--;
        timeEl.textContent = game.timeLeft;
        if (game.timeLeft <= 0) finish();
    }, 1000);

    cards.forEach(card => {
        card.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!game.active || game.locked || card.classList.contains('open') || card.classList.contains('matched')) return;

            card.classList.add('open');
            card.textContent = card.dataset.icon;
            game.flipped.push(card);

            if (game.flipped.length === 2) {
                game.locked = true;
                const [a, b] = game.flipped;
                if (a.dataset.icon === b.dataset.icon) {
                    a.classList.add('matched');
                    b.classList.add('matched');
                    game.matched++;
                    game.combo++;
                    countEl.textContent = game.matched;
                    game.flipped = [];
                    game.locked = false;
                    if (game.matched === 6) {
                        game.flipTimer = setTimeout(finish, 350);
                    }
                } else {
                    game.combo = 0;
                    game.flipTimer = setTimeout(() => {
                        if (!game.active) return;
                        a.classList.remove('open');
                        b.classList.remove('open');
                        a.textContent = '?';
                        b.textContent = '?';
                        game.flipped = [];
                        game.locked = false;
                    }, 550);
                }
            }
        });
    });

    return game;
}

// =========================================================
// 5. ИДЕАЛЬНЫЙ ТАЙМИНГ (5 раундов)
// =========================================================
export function createTimingBarGame(container, onEnd) {
    const maxRounds = 5;
    const game = {
        active: true,
        rafId: null,
        nextTimer: null,
        round: 1,
        points: 0,
        pos: 0,
        dir: 1,
        speed: 95,
        zoneCenter: 50,
        greenHalf: 15,
        goldHalf: 5,
        locked: false,
        lastTime: performance.now(),
        destroy() {
            game.active = false;
            if (game.rafId) cancelAnimationFrame(game.rafId);
            if (game.nextTimer) clearTimeout(game.nextTimer);
        },
    };

    container.innerHTML = `
        <div class="mg-timing-wrap">
            <div class="mg-top-hud">
                <span>Раунд <b id="timing-round">1</b> / ${maxRounds}</span>
                <span>⭐ Очки: <b id="timing-pts">0</b></span>
            </div>
            <div class="mg-timing-feedback" id="timing-fb">Попади в золото!</div>
            <div class="mg-timing-track" id="timing-track">
                <div class="mg-timing-green" id="timing-green"></div>
                <div class="mg-timing-gold" id="timing-gold"></div>
                <div class="mg-timing-cursor" id="timing-cursor"></div>
            </div>
            <button class="btn-primary mg-stop-btn" id="timing-stop">🎯 СТОП!</button>
        </div>
    `;

    const roundEl = container.querySelector('#timing-round');
    const ptsEl = container.querySelector('#timing-pts');
    const fbEl = container.querySelector('#timing-fb');
    const greenEl = container.querySelector('#timing-green');
    const goldEl = container.querySelector('#timing-gold');
    const cursorEl = container.querySelector('#timing-cursor');
    const stopBtn = container.querySelector('#timing-stop');

    function setupRound() {
        game.locked = false;
        game.zoneCenter = 28 + Math.random() * 44;
        game.greenHalf = Math.max(9, 16 - (game.round - 1) * 1.6);
        game.goldHalf = Math.max(3.5, 5.5 - (game.round - 1) * 0.45);
        game.speed = 95 + (game.round - 1) * 26;

        roundEl.textContent = game.round;
        fbEl.textContent = 'Попади в золотую зону!';
        fbEl.style.color = '';
        greenEl.style.left = `${game.zoneCenter - game.greenHalf}%`;
        greenEl.style.width = `${game.greenHalf * 2}%`;
        goldEl.style.left = `${game.zoneCenter - game.goldHalf}%`;
        goldEl.style.width = `${game.goldHalf * 2}%`;
    }

    function handleStop(e) {
        e.stopPropagation();
        if (!game.active || game.locked) return;
        game.locked = true;

        const dist = Math.abs(game.pos - game.zoneCenter);
        if (dist <= game.goldHalf) {
            game.points += 2;
            fbEl.textContent = '✨ ИДЕАЛЬНО! +2';
            fbEl.style.color = '#FFB020';
        } else if (dist <= game.greenHalf) {
            game.points += 1;
            fbEl.textContent = '✅ ХОРОШО! +1';
            fbEl.style.color = '#06D6A0';
        } else {
            fbEl.textContent = '❌ МИМО!';
            fbEl.style.color = '#EF476F';
        }
        ptsEl.textContent = game.points;

        game.nextTimer = setTimeout(() => {
            if (!game.active) return;
            if (game.round >= maxRounds) {
                game.destroy();
                const success = game.points >= 6;
                onEnd({
                    success,
                    score: game.points,
                    multiplier: Math.max(0.3, game.points / 8),
                    message: `Набрано ${game.points} из ${maxRounds * 2} очков!`,
                });
            } else {
                game.round++;
                setupRound();
            }
        }, 650);
    }

    stopBtn.addEventListener('pointerdown', handleStop);
    setupRound();

    function tick(now) {
        if (!game.active) return;
        const dt = Math.min((now - game.lastTime) / 1000, 0.05);
        game.lastTime = now;

        if (!game.locked) {
            game.pos += game.dir * game.speed * dt;
            if (game.pos >= 100) { game.pos = 100; game.dir = -1; }
            if (game.pos <= 0) { game.pos = 0; game.dir = 1; }
            cursorEl.style.left = `${game.pos}%`;
        }

        game.rafId = requestAnimationFrame(tick);
    }

    game.rafId = requestAnimationFrame(tick);
    return game;
}

// =========================================================
// ФАБРИКА И НАГРАДЫ
// =========================================================
export function createMinigame(gameId, container, onEnd) {
    switch (gameId) {
        case 'pop_lock': return createPopLockGame(container, onEnd);
        case 'treasure_grid': return createTreasureGridGame(container, onEnd);
        case 'dodge_arena': return createDodgeArenaGame(container, onEnd);
        case 'match_pairs': return createMatchPairsGame(container, onEnd);
        case 'timing_bar': return createTimingBarGame(container, onEnd);
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
