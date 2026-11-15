import * as THREE from 'three';

// ============ TELEGRAM & HAPTICS ============
const tg = window.Telegram?.WebApp;
if (tg) {
    try {
        tg.ready(); tg.expand();
        if (tg.isVersionAtLeast('7.7')) tg.disableVerticalSwipes();
        tg.onEvent('viewportChanged', () => { if (typeof onResize === 'function') onResize(); });
    } catch (err) {}
}

function triggerHaptic(type = 'light') {
    try {
        if (tg?.HapticFeedback) { if (type === 'error') tg.HapticFeedback.notificationOccurred('error'); else if (type === 'success') tg.HapticFeedback.notificationOccurred('success'); else tg.HapticFeedback.impactOccurred(type); }
        else if (navigator.vibrate) { if (type === 'error') navigator.vibrate([100, 50, 100]); else navigator.vibrate(50); }
    } catch (err) {}
}

function safeClick(el, handler) {
    if (!el) return;
    let lastFire = 0;
    const wrapped = (e) => { const now = Date.now(); if (now - lastFire < 300) return; lastFire = now; if (e.cancelable !== false) e.stopPropagation(); try { handler(e); } catch(err) { console.error('Handler error:', err); } };
    el.addEventListener('click', wrapped); el.addEventListener('touchend', wrapped, { passive: true });
}

// ============ КОНТЕНТ ============
const BASE_COLORS = ['#FF1744', '#F50057', '#D500F9', '#651FFF', '#2979FF', '#00B0FF', '#00E5FF', '#1DE9B6', '#00E676', '#FFEA00', '#FF9100', '#FF3D00'];
const BASE_EMOJIS = ['🥟', '🥛', '🌭', '💩', '🤡', '👽', '😭', '🍕', '🍔', '🍩', '🔥', '🥴', '🐷', '🎉', '🦄', '🍦', '🧠', '💀', '🤮', '👻', '🦍', '🍆', '💸'];
const BASE_TEXTS = ['БОРЩ', 'КЕФИР', 'ПЕЛЬМЕНИ', 'СОСИС', 'КРИНЖ', 'ЖИЗА', 'ПОХУДЕТЬ', 'ТУПЕЕ', 'БАТЯ', 'МАТЬ', 'ХАЙП', 'СКУФ', 'ИПОТЕКА', 'ЗАРПЛАТА', 'ДЕДЛАЙН', 'СПАТЬ', 'ПИВО', 'ДРАТУТИ', 'АЛЛО', 'ПРИВЕТ'];

const SKINS = {
    default: { name: 'Классика', price: 0, emojis: BASE_EMOJIS, colors: BASE_COLORS, texts: BASE_TEXTS },
    food: { name: 'Еда', price: 80, emojis: ['🍕','🍔','🍟','🌮','🌯','🍣','🍤','🍜','🍝','🍞','🥐','🧀','🥞','🥓','🍗','🍖','🥩','🍰','🧁','🍫'], colors: ['#FF5722','#FF9800','#FFC107','#E64A19','#FF6F00','#D84315','#F57C00'], texts: ['ПИЦЦА','БУРГЕР','СУШИ','ПАСТА','ХЛЕБ','СЫР','БЕКОН','КУРИЦА','СТЕЙК','ШАУРМА','БЛИНЫ','КОТЛЕТА','КЕКС','ШОКОЛАД'] },
    cats: { name: 'Котики', price: 120, emojis: ['🐱','😺','😸','😹','😻','😼','😽','🙀','😿','😾'], colors: ['#FF4081','#F06292','#E91E63','#C2185B','#AB47BC','#CE93D8'], texts: ['МЯУ','МУР','КОТИК','ЛАПКИ','ХВОСТ','УСЫ','КОРМ','РЫБА','СОН','МЯСО'] },
    animals: { name: 'Звери', price: 180, emojis: ['🦁','🐯','🐻','🐼','🐨','🐸','🐵','🦊','🐺','🦝','🦔','🐹','🐰','🐿️','🦇','🐗','🦒','🦓'], colors: ['#8D6E63','#6D4C41','#795548','#5D4037','#8BC34A','#689F38','#558B2F'], texts: ['ЛЕВ','ТИГР','МЕДВЕДЬ','ПАНДА','ЛИСА','ВОЛК','ЗАЯЦ','ЁЖ','СЛОН','ЖИРАФ','КРОКОДИЛ','ЗЕБРА','ОБЕЗЬЯНА'] },
    space: { name: 'Космос', price: 250, emojis: ['🌍','🌕','🚀','👾','🛸','⭐','🪐','🌌','☄️','👨‍🚀','🌟','✨','💫','🌠'], colors: ['#1A237E','#283593','#311B92','#4527A0','#512DA8','#01579B','#0D47A1'], texts: ['МАРС','ЛУНА','САТУРН','НЛО','ЗВЕЗДА','КОСМОС','ОРБИТА','ГРАВИТАЦИЯ','ВАКУУМ','СКАФАНДР','ГАЛАКТИКА'] },
    ocean: { name: 'Океан', price: 320, emojis: ['🐠','🐟','🐡','🦈','🐬','🐳','🐋','🦑','🐙','🦀','🦞','🦐','🐚','🌊'], colors: ['#0288D1','#0277BD','#01579B','#006064','#00838F','#0097A7','#26C6DA'], texts: ['РЫБА','АКУЛА','ДЕЛЬФИН','КИТ','ОСЬМИНОГ','КРАБ','РАК','КРЕВЕТКА','РАКОВИНА','ВОЛНА','МЕДУЗА','КОРАЛЛ'] },
    retro: { name: 'Ретро 8-бит', price: 400, emojis: ['👾','🕹️','💾','📼','📟','📺','🎮','🖥️','💿','🎧'], colors: ['#00C853','#00B248','#00897B','#00BFA5','#76FF03','#AA00FF'], texts: ['PIXEL','GAME','RETRO','8-BIT','ATARI','NINTENDO','SEGA','TETRIS','JOYSTICK','CRT','ARCADE'] },
    neon: { name: 'Неон', price: 500, emojis: ['💎','🔮','🎆','🎇','✨','💫','🌟','⚡','🌈','🎊'], colors: ['#E91E63','#9C27B0','#3F51B5','#00BCD4','#8BC34A','#FFEB3B','#FF4081','#00E5FF'], texts: ['НЕОН','СВЕТ','ЛАЗЕР','РАДУГА','БЛЕСК','СИЯНИЕ','ФЛЭШ','ИМПУЛЬС','ЭНЕРГИЯ','ВСПЫШКА'] }
};

const BIOMES = [{ bg: '#FDE2E4' }, { bg: '#E2ECE9' }, { bg: '#D0E6F9' }, { bg: '#F9E2D0' }, { bg: '#2B2D42' }];

const BLOCK_SIZE = 4, BLOCK_HEIGHT = 1, BASE_SPEED = 0.16, MAX_SPEED = 0.45;
let scene, camera, renderer, musicGain, windGain;
let blocks = [], debris = [], confetti = [];
let currentBlock, nextBlockData, direction = 1;
let score = 0, combo = 0;
let coins = parseInt(localStorage.getItem('towerCoins')) || 0;
let sessionCoins = 0;
let highScore = parseInt(localStorage.getItem('towerHighScore')) || 0;
let currentSkin = localStorage.getItem('towerSkin') || 'default';
let unlockedSkins = JSON.parse(localStorage.getItem('towerSkins') || '["default"]');
let gameState = 'menu', gameMode = 'classic';
let movingAxis = 'x', currentSpeed = BASE_SPEED;
let currentBiomeIndex = 0, targetBgColor = new THREE.Color(BIOMES[0].bg), shakeIntensity = 0;
let timeLeft = 60, timeAttackTimer = null;
let showTutorialHint = !localStorage.getItem('towerTutorialShown');
let isMuted = localStorage.getItem('towerMuted') === 'true';
let clock = new THREE.Clock();
let newQuestsTimeout = null, quests = [];
let isFury = false, furyBlocksLeft = 0;
let glowTexture = null;

const QUESTS_POOL = [
    { type: 'perfect', target: 3, text: '🎯 Точность x3', reward: 15 },
    { type: 'perfect', target: 5, text: '🎯 Точность x5', reward: 25 },
    { type: 'perfect', target: 8, text: '🎯 Точность x8', reward: 35 },
    { type: 'perfect', target: 10, text: '🎯 Точность x10', reward: 45 },
    { type: 'perfect', target: 15, text: '🎯 Точность x15', reward: 60 },
    { type: 'perfect', target: 20, text: '🎯 Точность x20', reward: 80 },
    { type: 'stack', target: 10, text: '🏗️ Высота 10', reward: 25 },
    { type: 'stack', target: 15, text: '🏗️ Высота 15', reward: 35 },
    { type: 'stack', target: 20, text: '🏗️ Высота 20', reward: 50 },
    { type: 'stack', target: 25, text: '🏗️ Высота 25', reward: 70 },
    { type: 'stack', target: 30, text: '🏗️ Высота 30', reward: 90 },
    { type: 'stack', target: 40, text: '🏗️ Высота 40', reward: 130 },
    { type: 'combo', target: 2, text: '🔥 Комбо x2', reward: 15 },
    { type: 'combo', target: 3, text: '🔥 Комбо x3', reward: 25 },
    { type: 'combo', target: 5, text: '🔥 Комбо x5', reward: 45 },
    { type: 'combo', target: 7, text: '🔥 Комбо x7', reward: 70 },
    { type: 'cut', target: 5, text: '✂️ 5 срезов', reward: 15 },
    { type: 'cut', target: 10, text: '✂️ 10 срезов', reward: 30 },
    { type: 'cut', target: 15, text: '✂️ 15 срезов', reward: 45 },
    { type: 'cut', target: 20, text: '✂️ 20 срезов', reward: 60 },
    { type: 'games', target: 2, text: '🎮 2 игры', reward: 15 },
    { type: 'games', target: 3, text: '🎮 3 игры', reward: 20 },
    { type: 'games', target: 5, text: '🎮 5 игр', reward: 30 },
    { type: 'games', target: 10, text: '🎮 10 игр', reward: 60 },
    { type: 'golden', target: 1, text: '👑 1 золотой', reward: 20 },
    { type: 'golden', target: 2, text: '👑 2 золотых', reward: 35 },
    { type: 'golden', target: 3, text: '👑 3 золотых', reward: 50 },
    { type: 'bomb', target: 1, text: '💣 1 бомба', reward: 20 },
    { type: 'bomb', target: 2, text: '💣 2 бомбы', reward: 40 },
    { type: 'ice', target: 1, text: '❄️ 1 лёд', reward: 20 },
    { type: 'ice', target: 2, text: '❄️ 2 льда', reward: 35 },
    { type: 'fury', target: 1, text: '💥 1 ярость', reward: 40 },
    { type: 'fury', target: 2, text: '💥 2 ярости', reward: 80 },
    { type: 'time_game', target: 1, text: '⏱️ 1 на время', reward: 20 },
    { type: 'time_game', target: 3, text: '⏱️ 3 на время', reward: 60 },
];

// ============ DOM ============
const $ = id => document.getElementById(id);
const scoreEl = $('score'), highScoreEl = $('high-score'), gameCoinsEl = $('game-coins');
const gameOverEl = $('game-over'), pauseScreen = $('pause-screen'), shopScreen = $('shop-screen'), rulesScreen = $('rules-screen'), startScreen = $('start-screen');
const perfectText = $('perfect-text'), comboText = $('combo-text'), milestoneText = $('milestone-text'), bonusText = $('bonus-text');
const finalScoreVal = $('final-score-val'), gameCoinsEarnedEl = $('game-coins-earned'), timerEl = $('timer'), modeLabel = $('mode-label');
const questsEl = $('quests'), muteBtn = $('mute-btn'), pauseBtn = $('pause-btn'), menuToggleBtn = $('menu-toggle-btn');
const tutorialEl = $('tutorial'), nextBlockEmoji = $('next-block-emoji');
const screenFlash = $('screen-flash'), coinsBalanceEl = $('coins-balance'), skinListEl = $('skin-list'), menuCoinsEl = $('menu-coins');
const shopProgressEl = $('shop-progress');

highScoreEl.innerText = `РЕКОРД: ${highScore}`;
updateCoinUI();

// ============ МОНЕТЫ ============
function addCoins(amount) {
    if (amount <= 0) return;
    coins += amount; sessionCoins += amount;
    localStorage.setItem('towerCoins', coins);
    updateCoinUI(); showCoinPopup(amount);
    gameCoinsEl.classList.remove('coin-pulse');
    void gameCoinsEl.offsetWidth;
    gameCoinsEl.classList.add('coin-pulse');
}
function showCoinPopup(amount) {
    const popup = document.createElement('div');
    popup.className = 'coin-popup';
    popup.textContent = `+${amount} 🪙`;
    const rect = gameCoinsEl.getBoundingClientRect();
    popup.style.left = (rect.left + rect.width / 2) + 'px';
    popup.style.top = (rect.bottom + 4) + 'px';
    document.body.appendChild(popup);
    setTimeout(() => popup.remove(), 900);
}

// ============ AUDIO ============
let audioCtx = null, noiseBuffer = null;
let musicPlaying = false, musicBeat = 0, musicTempo = 110, musicTimeout = null;

function initAudio() {
    if (!audioCtx) {
        try {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const size = audioCtx.sampleRate * 1.0;
            noiseBuffer = audioCtx.createBuffer(1, size, audioCtx.sampleRate);
            const data = noiseBuffer.getChannelData(0);
            for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;
            musicGain = audioCtx.createGain(); musicGain.gain.value = 0.12; musicGain.connect(audioCtx.destination);
            windGain = audioCtx.createGain(); windGain.gain.value = 0; windGain.connect(audioCtx.destination);
            const windOsc = audioCtx.createBufferSource(); windOsc.buffer = noiseBuffer; windOsc.loop = true;
            const windFilter = audioCtx.createBiquadFilter(); windFilter.type = 'lowpass'; windFilter.frequency.value = 400;
            windOsc.connect(windFilter); windFilter.connect(windGain); windOsc.start();
        } catch(e) {}
    }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
}

function playSound(type, level = 0) {
    if (isMuted || !audioCtx || audioCtx.state === 'suspended') return;
    try {
        const now = audioCtx.currentTime; const master = audioCtx.createGain(); master.connect(audioCtx.destination);
        const tone = (freq, endFreq, wave, dur, vol, delay = 0) => {
            const osc = audioCtx.createOscillator(); const g = audioCtx.createGain(); const filter = audioCtx.createBiquadFilter();
            osc.type = wave; osc.frequency.setValueAtTime(freq, now + delay);
            if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, now + delay + dur);
            filter.type = 'lowpass'; filter.frequency.value = 2000;
            g.gain.setValueAtTime(0, now + delay); g.gain.linearRampToValueAtTime(vol, now + delay + 0.02); g.gain.exponentialRampToValueAtTime(0.001, now + delay + dur);
            osc.connect(filter); filter.connect(g); g.connect(master); osc.start(now + delay); osc.stop(now + delay + dur);
        };
        const noise = (dur, vol, delay = 0) => {
            const src = audioCtx.createBufferSource(); src.buffer = noiseBuffer; const filter = audioCtx.createBiquadFilter(); const g = audioCtx.createGain();
            filter.type = 'bandpass'; filter.frequency.value = 1000;
            g.gain.setValueAtTime(vol, now + delay); g.gain.exponentialRampToValueAtTime(0.01, now + delay + dur);
            src.connect(filter); filter.connect(g); g.connect(master); src.start(now + delay);
        };
        if (type === 'drop') { tone(90, 40, 'sine', 0.15, 0.35); noise(0.08, 0.1); }
        else if (type === 'perfect') { const mult = Math.pow(1.059, Math.min(level, 12)); tone(523.25 * mult, null, 'sine', 0.4, 0.25); tone(659.25 * mult, null, 'sine', 0.4, 0.18); }
        else if (type === 'milestone') { [261.63, 329.63, 392.00, 523.25].forEach((f, i) => tone(f, null, 'triangle', 0.5, 0.12, i * 0.1)); }
        else if (type === 'bomb') { noise(0.4, 0.4); tone(120, 30, 'sawtooth', 0.4, 0.3); }
        else if (type === 'gameover') { tone(200, 80, 'triangle', 0.8, 0.25); tone(150, 60, 'triangle', 0.8, 0.18, 0.1); }
        else if (type === 'quest') { tone(659.25, null, 'sine', 0.2, 0.2); tone(783.99, null, 'sine', 0.3, 0.2, 0.1); tone(1046.5, null, 'sine', 0.4, 0.2, 0.2); }
        else if (type === 'fury') { tone(440, 880, 'sawtooth', 0.5, 0.15); tone(554, 1108, 'sawtooth', 0.5, 0.1); }
    } catch(e) {}
}

function playKick() { if (!audioCtx || isMuted) return; try { const osc = audioCtx.createOscillator(), g = audioCtx.createGain(); osc.frequency.setValueAtTime(140, audioCtx.currentTime); osc.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.12); g.gain.setValueAtTime(0.25, audioCtx.currentTime); g.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.12); osc.connect(g); g.connect(musicGain); osc.start(); osc.stop(audioCtx.currentTime + 0.12); } catch(e) {} }
function playHat() { if (!audioCtx || isMuted) return; try { const src = audioCtx.createBufferSource(); src.buffer = noiseBuffer; const filter = audioCtx.createBiquadFilter(); filter.type = 'highpass'; filter.frequency.value = 6000; const g = audioCtx.createGain(); g.gain.setValueAtTime(0.06, audioCtx.currentTime); g.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.04); src.connect(filter); filter.connect(g); g.connect(musicGain); src.start(); src.stop(audioCtx.currentTime + 0.04); } catch(e) {} }
function playBass() { if (!audioCtx || isMuted) return; try { const osc = audioCtx.createOscillator(), g = audioCtx.createGain(); osc.type = 'triangle'; osc.frequency.setValueAtTime(65, audioCtx.currentTime); g.gain.setValueAtTime(0.15, audioCtx.currentTime); g.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2); osc.connect(g); g.connect(musicGain); osc.start(); osc.stop(audioCtx.currentTime + 0.2); } catch(e) {} }

function musicTick() {
    if (!musicPlaying || isMuted || gameState !== 'playing') return;
    const beat = musicBeat % 8;
    if (beat === 0 || beat === 3 || beat === 4) playKick();
    if (beat === 2 || beat === 6) playHat();
    if (beat === 0 || beat === 4) playBass();
    musicBeat++;
    musicTimeout = setTimeout(musicTick, (60000 / musicTempo) / 2);
}
function startMusic() { if (musicPlaying || isMuted) return; initAudio(); if (!audioCtx) return; musicPlaying = true; musicBeat = 0; musicTempo = 110; musicTick(); }
function stopMusic() { musicPlaying = false; if (musicTimeout) { clearTimeout(musicTimeout); musicTimeout = null; } }

// ============ QUESTS ============
function generateNewQuests() {
    const pool = [...QUESTS_POOL]; quests = [];
    for (let i = 0; i < 3; i++) {
        const idx = Math.floor(Math.random() * pool.length);
        const q = pool.splice(idx, 1)[0];
        quests.push({ ...q, current: 0, done: false });
    }
    saveQuests(); renderQuests();
}
function loadQuests() {
    const today = new Date().toDateString();
    const saved = JSON.parse(localStorage.getItem('towerQuests') || 'null');
    if (saved && saved.date === today && saved.quests?.length === 3) { quests = saved.quests; renderQuests(); }
    else { generateNewQuests(); }
}
function saveQuests() { localStorage.setItem('towerQuests', JSON.stringify({ date: new Date().toDateString(), quests })); }

function updateQuest(type, value, isMax = false) {
    let changed = false;
    quests.forEach(q => {
        if (q.type !== type || q.done) return;
        if (isMax) { if (value > q.current) { q.current = Math.min(q.target, value); changed = true; } }
        else { q.current = Math.min(q.target, q.current + value); changed = true; }
        if (q.current >= q.target && !q.done) {
            q.done = true;
            addCoins(q.reward);
            playSound('quest');
            showPopup(bonusText, `🎁 КВЕСТ +${q.reward} 🪙`, 1500);
            triggerHaptic('success');
        }
    });
    if (changed) { saveQuests(); renderQuests(); }
    if (quests.every(q => q.done) && !newQuestsTimeout) {
        newQuestsTimeout = setTimeout(() => {
            newQuestsTimeout = null; generateNewQuests();
            showPopup(bonusText, '🌟 НОВЫЕ КВЕСТЫ!', 1500); playSound('quest'); triggerHaptic('success');
        }, 1500);
    }
}
function renderQuests() {
    questsEl.innerHTML = '';
    quests.forEach(q => {
        const chip = document.createElement('div');
        chip.className = 'quest-chip' + (q.done ? ' done' : '');
        chip.textContent = q.done ? '✅ ' + q.text : `${q.text} ${q.current}/${q.target}`;
        questsEl.appendChild(chip);
    });
}
function updateCoinUI() {
    coinsBalanceEl.innerText = `🪙 ${coins}`;
    menuCoinsEl.innerText = `🪙 ${coins}`;
    gameCoinsEl.innerText = `🪙 ${coins}`;
}

// ============ SHOP ============
function renderShop() {
    skinListEl.innerHTML = '';
    shopProgressEl.innerText = `Открыто скинов: ${unlockedSkins.length}/${Object.keys(SKINS).length}`;
    for (const [key, skin] of Object.entries(SKINS)) {
        const isUnlocked = unlockedSkins.includes(key);
        const isEquipped = currentSkin === key;
        const canBuy = coins >= skin.price;
        const div = document.createElement('div'); div.className = 'skin-item';
        let btnHtml = '';
        if (isEquipped) btnHtml = `<button class="equipped">НАДЕТО</button>`;
        else if (isUnlocked) btnHtml = `<button class="equip" data-skin="${key}">НАДЕТЬ</button>`;
        else if (canBuy) btnHtml = `<button class="buy" data-skin="${key}" data-price="${skin.price}">${skin.price} 🪙</button>`;
        else btnHtml = `<button class="buy locked" disabled>${skin.price} 🪙</button>`;
        const colorDots = skin.colors.slice(0, 5).map(c => `<span style="background:${c}"></span>`).join('');
        div.innerHTML = `
            <div class="skin-info">
                <span class="skin-preview">${skin.emojis[0]}</span>
                <div class="skin-details">
                    <span class="skin-name">${skin.name}</span>
                    <div class="skin-colors">${colorDots}</div>
                </div>
            </div>
            ${btnHtml}
        `;
        skinListEl.appendChild(div);
    }
    skinListEl.querySelectorAll('button.equip').forEach(btn => {
        safeClick(btn, () => { currentSkin = btn.dataset.skin; localStorage.setItem('towerSkin', currentSkin); renderShop(); });
    });
    skinListEl.querySelectorAll('button.buy').forEach(btn => {
        if (btn.disabled) return;
        safeClick(btn, () => {
            const price = parseInt(btn.dataset.price);
            if (coins >= price) {
                coins -= price; localStorage.setItem('towerCoins', coins);
                const skin = btn.dataset.skin;
                unlockedSkins.push(skin); localStorage.setItem('towerSkins', JSON.stringify(unlockedSkins));
                currentSkin = skin; localStorage.setItem('towerSkin', currentSkin);
                updateCoinUI(); renderShop(); triggerHaptic('success');
            } else { triggerHaptic('error'); }
        });
    });
}

// ============ THREE.JS ============
function getAdaptiveD(aspect) {
    if (aspect < 0.6) return 16;
    if (aspect < 0.8) return 13;
    if (aspect < 1.0) return 11;
    return 10;
}

function initThree() {
    scene = new THREE.Scene(); scene.background = new THREE.Color(BIOMES[0].bg); scene.fog = new THREE.FogExp2(BIOMES[0].bg, 0.02);
    const aspect = window.innerWidth / window.innerHeight;
    const d = getAdaptiveD(aspect);
    camera = new THREE.OrthographicCamera(-d*aspect, d*aspect, d, -d, 1, 1000);
    camera.position.set(20, 25, 20); camera.lookAt(0, 0, 0);
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(renderer.domElement);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x222222, 0.6));
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2); dirLight.position.set(10, 20, 10);
    dirLight.castShadow = true; dirLight.shadow.camera.left = -20; dirLight.shadow.camera.right = 20;
    dirLight.shadow.camera.top = 20; dirLight.shadow.camera.bottom = -20;
    dirLight.shadow.mapSize.set(1024, 1024); scene.add(dirLight);
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', () => setTimeout(onResize, 100));
    glowTexture = createGlowTexture();
}

function disposeMesh(mesh) {
    if (!mesh) return;
    if (mesh.geometry) mesh.geometry.dispose();
    if (Array.isArray(mesh.material)) mesh.material.forEach(m => { if (m.map) m.map.dispose(); m.dispose(); });
    else if (mesh.material) { if (mesh.material.map) mesh.material.map.dispose(); mesh.material.dispose(); }
}

function createGlowTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.3, 'rgba(255,255,255,0.6)');
    grad.addColorStop(0.7, 'rgba(255,255,255,0.15)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
}

// ============ ТЕКСТУРЫ (эмодзи+текст поверх цвета) ============
function createTexture(emoji, text, color, type = 'normal') {
    const c = document.createElement('canvas'); c.width = c.height = 512;
    const ctx = c.getContext('2d');
    
    if (type === 'golden') {
        const grad = ctx.createLinearGradient(0, 0, 512, 512);
        grad.addColorStop(0, '#FFE082'); grad.addColorStop(0.3, '#FFD700'); grad.addColorStop(0.6, '#FFC107'); grad.addColorStop(1, '#FF8F00');
        ctx.fillStyle = grad; ctx.fillRect(0,0,512,512);
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(150,0); ctx.lineTo(0,150); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(512,512); ctx.lineTo(362,512); ctx.lineTo(512,362); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#8D6E00'; ctx.lineWidth = 20; ctx.strokeRect(10,10,492,492);
    } else if (type === 'bomb') {
        ctx.fillStyle = '#1A0000'; ctx.fillRect(0,0,512,512);
        ctx.save(); ctx.beginPath(); ctx.rect(0,0,512,512); ctx.clip();
        ctx.strokeStyle = '#FF1744'; ctx.lineWidth = 80;
        for(let i=-512; i<1024; i+=140) { ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i+512,512); ctx.stroke(); }
        ctx.restore();
        ctx.strokeStyle = '#FF5252'; ctx.lineWidth = 25; ctx.strokeRect(12.5,12.5,487,487);
        ctx.fillStyle = 'rgba(255,82,82,0.25)'; ctx.fillRect(0,0,512,512);
    } else if (type === 'ice') {
        ctx.fillStyle = '#00E5FF'; ctx.fillRect(0,0,512,512);
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(200,0); ctx.lineTo(0,200); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = 10;
        for(let i=0; i<10; i++) { ctx.beginPath(); ctx.moveTo(Math.random()*512, Math.random()*512); ctx.lineTo(Math.random()*512, Math.random()*512); ctx.stroke(); }
        ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 25; ctx.strokeRect(12.5,12.5,487,487);
    } else if (type === 'crumble') {
        ctx.fillStyle = '#5D4037'; ctx.fillRect(0,0,512,512);
        ctx.strokeStyle = '#1A0A00'; ctx.lineWidth = 20;
        for(let i=0; i<15; i++) { ctx.beginPath(); ctx.moveTo(Math.random()*512, Math.random()*512); ctx.lineTo(Math.random()*512, Math.random()*512); ctx.stroke(); }
        ctx.strokeStyle = '#8D6E63'; ctx.lineWidth = 25; ctx.strokeRect(12.5,12.5,487,487);
    } else {
        ctx.fillStyle = color; ctx.fillRect(0,0,512,512);
        ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 15; ctx.strokeRect(7.5,7.5,497,497);
        const grad = ctx.createLinearGradient(0,0,0,512);
        grad.addColorStop(0, 'rgba(255,255,255,0.15)');
        grad.addColorStop(1, 'rgba(0,0,0,0.15)');
        ctx.fillStyle = grad; ctx.fillRect(0,0,512,512);
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;

    // Эмодзи с белым контуром (эффект наклейки поверх цвета)
    ctx.font = '260px Arial, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
    ctx.shadowColor = '#FFFFFF';
    ctx.shadowBlur = 0;
    const outlineOffsets = [
        [-12,0],[12,0],[0,-12],[0,12],
        [-9,-9],[9,-9],[-9,9],[9,9],
        [-6,0],[6,0],[0,-6],[0,6]
    ];
    for (const [dx, dy] of outlineOffsets) {
        ctx.shadowOffsetX = dx; ctx.shadowOffsetY = dy;
        ctx.fillText(emoji, 256, 195);
    }
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
    ctx.fillText(emoji, 256, 195);

    // Текст: белая обводка + тёмная заливка
    ctx.font = '900 100px "Rubik", sans-serif';
    ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 26;
    ctx.strokeText(text, 256, 445);
    ctx.fillStyle = type === 'golden' ? '#3E2723' : '#1A0A00';
    ctx.fillText(text, 256, 445);
    
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    return tex;
}

function createBlockMesh(w, h, d, color, emoji, text, type = 'normal') {
    const geo = new THREE.BoxGeometry(w, h, d); const tex = createTexture(emoji, text, color, type);
    let sideOpts = { map: tex, roughness: 0.45, metalness: 0.1 };
    let topOpts = { color: color, roughness: 0.5 };
    if (type === 'golden') {
        sideOpts.emissive = new THREE.Color(0xFFB300); sideOpts.emissiveIntensity = 0.5;
        topOpts.emissive = new THREE.Color(0xFFB300); topOpts.emissiveIntensity = 0.5; topOpts.color = new THREE.Color(0xFFC107);
    } else if (type === 'bomb') {
        sideOpts.emissive = new THREE.Color(0xFF0000); sideOpts.emissiveIntensity = 0.6;
        topOpts.emissive = new THREE.Color(0xFF0000); topOpts.emissiveIntensity = 0.6; topOpts.color = new THREE.Color(0x330000);
    } else if (type === 'ice') {
        sideOpts.transparent = true; sideOpts.opacity = 0.9; topOpts.transparent = true; topOpts.opacity = 0.9;
        sideOpts.emissive = new THREE.Color(0x00E5FF); sideOpts.emissiveIntensity = 0.5;
        topOpts.emissive = new THREE.Color(0x00E5FF); topOpts.emissiveIntensity = 0.5;
    } else if (type === 'crumble') {
        sideOpts.emissive = new THREE.Color(0x5D4037); sideOpts.emissiveIntensity = 0.3;
        topOpts.emissive = new THREE.Color(0x5D4037); topOpts.emissiveIntensity = 0.3;
    } else {
        sideOpts.emissive = new THREE.Color(color); sideOpts.emissiveIntensity = 0.12;
        topOpts.emissive = new THREE.Color(color); topOpts.emissiveIntensity = 0.12;
    }
    const side = new THREE.MeshStandardMaterial(sideOpts); const top = new THREE.MeshStandardMaterial(topOpts);
    const mesh = new THREE.Mesh(geo, [side, side, top, top, side, side]);
    mesh.castShadow = true; mesh.receiveShadow = true; mesh.userData.blockType = type;
    if (type !== 'normal' && type !== 'crumble') {
        const glowColors = { golden: 0xFFD700, bomb: 0xFF1744, ice: 0x00E5FF };
        const spriteMat = new THREE.SpriteMaterial({ map: glowTexture, color: glowColors[type], transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.7 });
        const sprite = new THREE.Sprite(spriteMat);
        sprite.scale.set(5.5, 5.5, 1); sprite.renderOrder = -1;
        mesh.add(sprite); mesh.userData.glowSprite = sprite;
    }
    return mesh;
}

function rollBlockType() {
    if (score < 5) return 'normal';
    const r = Math.random();
    if (r < 0.06) return 'golden';
    if (r < 0.12) return 'bomb';
    if (r < 0.18) return 'ice';
    if (r < 0.22 && score > 15) return 'crumble';
    return 'normal';
}

function getBlockVisuals(type, skinKey) {
    const skin = SKINS[skinKey] || SKINS.default;
    const rndColor = skin.colors[Math.floor(Math.random() * skin.colors.length)];
    const rndEmoji = skin.emojis[Math.floor(Math.random() * skin.emojis.length)];
    const rndText = skin.texts[Math.floor(Math.random() * skin.texts.length)];
    switch(type) {
        case 'golden': return { color: '#FFC107', emoji: '👑', text: 'ЗОЛОТО' };
        case 'bomb': return { color: '#FF1744', emoji: '💣', text: 'БУМ' };
        case 'ice': return { color: '#00E5FF', emoji: '❄️', text: 'ЛЕД' };
        case 'crumble': return { color: '#5D4037', emoji: '🧱', text: 'ХРУПКИЙ' };
        default: return { color: rndColor, emoji: rndEmoji, text: rndText };
    }
}

function generateNextBlockData() {
    const type = rollBlockType();
    const { color, emoji, text } = getBlockVisuals(type, currentSkin);
    return { type, color, emoji, text };
}

function createBaseBlock() {
    nextBlockData = generateNextBlockData();
    const base = createBlockMesh(BLOCK_SIZE, BLOCK_HEIGHT, BLOCK_SIZE, '#FF1744', '🏗️', 'БАЗА', 'normal');
    base.position.set(0, 0, 0); scene.add(base); blocks.push(base);
    spawnNewBlock();
}

function spawnNewBlock() {
    const top = blocks[blocks.length - 1];
    if (score > 30) movingAxis = 'diag';
    else movingAxis = blocks.length % 2 === 1 ? 'x' : 'z';
    const { type, color, emoji, text } = nextBlockData;
    nextBlockData = generateNextBlockData();
    nextBlockEmoji.innerText = nextBlockData.emoji;
    const w = top.geometry.parameters.width, d = top.geometry.parameters.depth;
    let sx = top.position.x, sz = top.position.z;
    if (movingAxis === 'x') sx = direction === 1 ? -15 : 15;
    else if (movingAxis === 'z') sz = direction === 1 ? -15 : 15;
    else if (movingAxis === 'diag') { sx = direction === 1 ? -15 : 15; sz = direction === 1 ? -15 : 15; }
    currentBlock = createBlockMesh(w, BLOCK_HEIGHT, d, color, emoji, text, type);
    currentBlock.position.set(sx, top.position.y + BLOCK_HEIGHT, sz);
    currentBlock.userData = { w, d, moving: true, color, emoji, text, blockType: type, squash: 1 };
    scene.add(currentBlock);
}

// ============ GAME LOGIC ============
function showPopup(el, text, duration = 800) { if (!el) return; if (text) el.innerText = text; el.classList.add('show-popup'); setTimeout(() => el.classList.remove('show-popup'), duration); }
function flashScreen() { if(screenFlash){screenFlash.style.opacity = '0.6'; setTimeout(() => screenFlash.style.opacity = '0', 100);} }

function dropBlock() {
    if (gameState !== 'playing' || !currentBlock?.userData.moving) return;
    if (showTutorialHint) { tutorialEl.style.display = 'none'; localStorage.setItem('towerTutorialShown', 'true'); showTutorialHint = false; }
    currentBlock.userData.moving = false;
    const top = blocks[blocks.length - 1];
    const bType = currentBlock.userData.blockType;
    let diffX = 0, diffZ = 0, sizeX = currentBlock.geometry.parameters.width, sizeZ = currentBlock.geometry.parameters.depth;
    if (movingAxis === 'x') diffX = currentBlock.position.x - top.position.x;
    else if (movingAxis === 'z') diffZ = currentBlock.position.z - top.position.z;
    else if (movingAxis === 'diag') { diffX = currentBlock.position.x - top.position.x; diffZ = currentBlock.position.z - top.position.z; }
    const absDiffX = Math.abs(diffX), absDiffZ = Math.abs(diffZ);
    const maxDiff = Math.max(absDiffX, absDiffZ);
    
    if ((movingAxis === 'x' || movingAxis === 'diag') && absDiffX >= sizeX / 2) { currentBlock.userData.falling = true; triggerGameOver(); return; }
    if ((movingAxis === 'z' || movingAxis === 'diag') && absDiffZ >= sizeZ / 2) { currentBlock.userData.falling = true; triggerGameOver(); return; }
    if (bType === 'crumble' && maxDiff < 0.15) { currentBlock.position.x = top.position.x; currentBlock.position.z = top.position.z; spawnBombParticles(); triggerGameOver(); return; }

    if (maxDiff < 0.15) {
        currentBlock.position.x = top.position.x; currentBlock.position.z = top.position.z;
        combo++;
        let points = 1;
        if (bType === 'golden') { points = 3; updateQuest('golden', 1); }
        else if (bType === 'bomb') { points = 2; updateQuest('bomb', 1); }
        else if (bType === 'ice') { points = 2; updateQuest('ice', 1); }
        if (bType === 'bomb') { playSound('bomb'); showPopup(bonusText, '💥 БУМ! +2', 1000); shakeIntensity = 0.5; }
        else { playSound('perfect', combo); if (bType === 'golden') showPopup(bonusText, '👑 ЗОЛОТО +3', 900); else if (bType === 'ice') showPopup(bonusText, '❄️ ЛЕД +2', 900); else showPopup(perfectText, null, 600); }
        flashScreen();
        if (gameMode === 'time') { timeLeft += 2; updateTimerDisplay(); }
        if (combo >= 5 && !isFury) { isFury = true; furyBlocksLeft = 3; document.body.classList.add('fury-active'); playSound('fury'); showPopup(milestoneText, '🔥 ЯРОСТЬ! x2', 2000); updateQuest('fury', 1); }
        if (combo > 1 && !isFury) showPopup(comboText, `КОМБО x${combo}`, 800);
        if (isFury) points *= 2;
        updateQuest('perfect', 1); updateQuest('combo', combo, true); triggerHaptic('light');
        const oldScore = score; score += points;
        checkMilestone(oldScore, score); triggerPerfectParticles();
        let coinReward = 2;
        if (bType === 'golden') coinReward += 2;
        else if (bType === 'bomb') coinReward += 1;
        else if (bType === 'ice') coinReward += 1;
        addCoins(coinReward);
    } else {
        combo = 0; updateQuest('cut', 1);
        if (bType === 'bomb') { score = Math.max(0, score - 1); playSound('bomb'); shakeIntensity = 0.5; showPopup(bonusText, '💣 -1 ОЧКО', 900); spawnBombParticles(); triggerHaptic('error'); }
        else { playSound('drop'); triggerHaptic('light'); }
        let cutAxis = movingAxis === 'diag' ? (absDiffX > absDiffZ ? 'x' : 'z') : movingAxis;
        let cutDiff = cutAxis === 'x' ? diffX : diffZ;
        let origSize = cutAxis === 'x' ? sizeX : sizeZ;
        let newSize = origSize - Math.abs(cutDiff);
        createDebris(cutDiff, origSize, newSize, cutAxis, top);
        const w = cutAxis === 'x' ? newSize : currentBlock.userData.w;
        const d = cutAxis === 'z' ? newSize : currentBlock.userData.d;
        const prevColor = currentBlock.userData.color, prevEmoji = currentBlock.userData.emoji, prevText = currentBlock.userData.text;
        scene.remove(currentBlock); disposeMesh(currentBlock);
        const nm = createBlockMesh(w, BLOCK_HEIGHT, d, prevColor, prevEmoji, prevText, 'normal');
        let targetX = top.position.x, targetZ = top.position.z;
        if (cutAxis === 'x') targetX = top.position.x + (diffX > 0 ? (origSize-newSize)/2 : -(origSize-newSize)/2);
        if (cutAxis === 'z') targetZ = top.position.z + (diffZ > 0 ? (origSize-newSize)/2 : -(origSize-newSize)/2);
        nm.position.set(targetX, currentBlock.position.y, targetZ);
        nm.userData = { w, d, color: prevColor, emoji: prevEmoji, text: prevText, blockType: 'normal', squash: 1 };
        currentBlock = nm;
        if (bType !== 'bomb') score++;
        addCoins(1);
    }
    currentBlock.userData.squash = 0;
    if (isFury) { furyBlocksLeft--; if (furyBlocksLeft <= 0) { isFury = false; document.body.classList.remove('fury-active'); } }
    updateScoreUI();
    currentSpeed = Math.min(MAX_SPEED, BASE_SPEED + score * 0.004);
    musicTempo = Math.min(160, 110 + Math.floor(score / 10) * 5);
    blocks.push(currentBlock); scene.add(currentBlock); spawnNewBlock();
}

function updateScoreUI() { scoreEl.innerText = score; scoreEl.classList.add('score-pop'); setTimeout(() => scoreEl.classList.remove('score-pop'), 150); updateQuest('stack', score, true); }
function checkMilestone(oldScore, newScore) { const oldM = Math.floor(oldScore / 10); const newM = Math.floor(newScore / 10); if (newM > oldM) triggerMilestone(newM * 10); }

function triggerPerfectParticles() {
    for (let i = 0; i < 12; i++) {
        const p = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), new THREE.MeshBasicMaterial({ color: 0x06D6A0 }));
        p.position.copy(currentBlock.position); p.position.y += 0.5;
        p.userData = { vel: new THREE.Vector3((Math.random()-0.5)*0.6, Math.random()*0.6+0.2, (Math.random()-0.5)*0.6), life: 1.0 };
        scene.add(p); debris.push(p);
    }
}
function spawnBombParticles() {
    for (let i = 0; i < 20; i++) {
        const p = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), new THREE.MeshBasicMaterial({ color: i % 2 ? 0xFF1744 : 0xFFC107 }));
        p.position.copy(currentBlock.position);
        p.userData = { vel: new THREE.Vector3((Math.random()-0.5)*1.2, Math.random()*0.8+0.3, (Math.random()-0.5)*1.2), life: 1.0 };
        scene.add(p); debris.push(p);
    }
}
function triggerMilestone(points) {
    playSound('milestone'); triggerHaptic('success');
    const newBiome = Math.floor(points / 10) % BIOMES.length; currentBiomeIndex = newBiome;
    targetBgColor.set(BIOMES[newBiome].bg); document.body.style.background = BIOMES[newBiome].bg;
    showPopup(milestoneText, `${points} ЭТАЖЕЙ!`, 1500);
    addCoins(5);
    const topPos = blocks[blocks.length - 1].position;
    for (let i = 0; i < 40; i++) {
        const piece = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.02), new THREE.MeshBasicMaterial({ color: BASE_COLORS[Math.floor(Math.random() * BASE_COLORS.length)] }));
        piece.position.set(topPos.x + (Math.random()-0.5)*2, topPos.y + 2, topPos.z + (Math.random()-0.5)*2);
        const angle = Math.random() * Math.PI * 2; const speed = Math.random() * 0.3 + 0.1;
        piece.userData = { vel: new THREE.Vector3(Math.cos(angle)*speed, Math.random()*0.6+0.3, Math.sin(angle)*speed), rotSpeed: new THREE.Vector3(Math.random()*0.3, Math.random()*0.3, Math.random()*0.3) };
        scene.add(piece); confetti.push(piece);
    }
}
function createDebris(diff, origSize, newSize, axis, top) {
    const dSize = origSize - newSize;
    const geo = new THREE.BoxGeometry(axis === 'x' ? dSize : currentBlock.userData.w, BLOCK_HEIGHT, axis === 'z' ? dSize : currentBlock.userData.d);
    const mat = new THREE.MeshStandardMaterial({ color: currentBlock.userData.color, roughness: 0.5 });
    const mesh = new THREE.Mesh(geo, mat); mesh.castShadow = true;
    let px = currentBlock.position.x, pz = currentBlock.position.z;
    if (axis === 'x') px = diff > 0 ? top.position.x + (origSize/2) + (dSize/2) : top.position.x - (origSize/2) - (dSize/2);
    else pz = diff > 0 ? top.position.z + (origSize/2) + (dSize/2) : top.position.z - (origSize/2) - (dSize/2);
    mesh.position.set(axis === 'x' ? px : currentBlock.position.x, currentBlock.position.y, axis === 'z' ? pz : currentBlock.position.z);
    mesh.userData = { vel: new THREE.Vector3(axis === 'x' ? (diff > 0 ? 0.15 : -0.15) : 0, 0.1, axis === 'z' ? (diff > 0 ? 0.15 : -0.15) : 0), rotSpeed: new THREE.Vector3((Math.random()-0.5)*0.3, (Math.random()-0.5)*0.3, (Math.random()-0.5)*0.3) };
    scene.add(mesh); debris.push(mesh);
}

function updateCamera() {
    if (!blocks.length) return;
    const top = blocks[blocks.length - 1];
    const ty = top.position.y, tx = top.position.x * 0.5, tz = top.position.z * 0.5;
    camera.position.x += (tx + 20 - camera.position.x) * 0.1;
    camera.position.y += (ty + 25 - camera.position.y) * 0.1;
    camera.position.z += (tz + 20 - camera.position.z) * 0.1;
    camera.lookAt(tx, ty + 2, tz);
    if (shakeIntensity > 0.01) { camera.position.x += (Math.random()-0.5) * shakeIntensity; camera.position.y += (Math.random()-0.5) * shakeIntensity; camera.position.z += (Math.random()-0.5) * shakeIntensity; shakeIntensity *= 0.85; }
}

function animate() {
    requestAnimationFrame(animate);
    const time = clock.getElapsedTime();
    if (audioCtx && windGain && gameState === 'playing') {
        const windVol = Math.min(0.15, score * 0.005);
        try { windGain.gain.setTargetAtTime(windVol, audioCtx.currentTime, 0.5); } catch(e) {}
    } else if (windGain && audioCtx) {
        try { windGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.5); } catch(e) {}
    }
    blocks.forEach(b => {
        const bt = b.userData.blockType;
        if (bt === 'golden' || bt === 'bomb' || bt === 'ice') {
            const pulse = bt === 'bomb' ? (0.5 + Math.sin(time * 6) * 0.3) : (0.4 + Math.sin(time * 4) * 0.2);
            b.material.forEach(m => { if (m.emissive) m.emissiveIntensity = pulse; });
            if (b.userData.glowSprite) b.userData.glowSprite.material.opacity = 0.4 + Math.sin(time * 4) * 0.3;
        }
    });
    if (gameState === 'playing' && currentBlock?.userData.moving) {
        let speed = currentSpeed;
        if (isFury) speed *= 0.6;
        if (currentBlock.userData.blockType === 'ice') speed = Math.min(speed * 1.8, 0.6);
        let delta = speed * direction;
        if (score > 20 && !isFury) delta += Math.sin(performance.now() * 0.003) * 0.02;
        if (movingAxis === 'x') { currentBlock.position.x += delta; if (currentBlock.position.x > 15) direction = -1; if (currentBlock.position.x < -15) direction = 1; }
        else if (movingAxis === 'z') { currentBlock.position.z += delta; if (currentBlock.position.z > 15) direction = -1; if (currentBlock.position.z < -15) direction = 1; }
        else if (movingAxis === 'diag') {
            currentBlock.position.x += delta; currentBlock.position.z += delta * 0.8;
            if (currentBlock.position.x > 15 || currentBlock.position.z > 15) direction = -1;
            if (currentBlock.position.x < -15 || currentBlock.position.z < -15) direction = 1;
        }
    }
    blocks.forEach(b => {
        if (b.userData.squash !== undefined && b.userData.squash < 1) {
            b.userData.squash += 0.1;
            if (b.userData.squash > 1) b.userData.squash = 1;
            const scaleY = 1 - Math.sin(b.userData.squash * Math.PI) * 0.3;
            const scaleXZ = 1 + Math.sin(b.userData.squash * Math.PI) * 0.15;
            b.scale.set(scaleXZ, scaleY, scaleXZ);
        }
    });
    if (currentBlock?.userData.falling) { currentBlock.position.y -= 0.3; currentBlock.rotation.x += 0.05; currentBlock.rotation.z += 0.05; }
    for (let i = debris.length - 1; i >= 0; i--) {
        const d = debris[i]; d.position.add(d.userData.vel); d.userData.vel.y -= 0.02;
        if (d.userData.rotSpeed) { d.rotation.x += d.userData.rotSpeed.x; d.rotation.y += d.userData.rotSpeed.y; d.rotation.z += d.userData.rotSpeed.z; }
        if (d.userData.life !== undefined) { d.userData.life -= 0.02; d.scale.setScalar(d.userData.life); if (d.userData.life <= 0) { scene.remove(d); disposeMesh(d); debris.splice(i, 1); continue; } }
        if (d.position.y < camera.position.y - 40) { scene.remove(d); disposeMesh(d); debris.splice(i, 1); }
    }
    for (let i = confetti.length - 1; i >= 0; i--) {
        const c = confetti[i]; c.position.add(c.userData.vel); c.userData.vel.y -= 0.015; c.userData.vel.x *= 0.98; c.userData.vel.z *= 0.98;
        c.rotation.x += c.userData.rotSpeed.x; c.rotation.y += c.userData.rotSpeed.y; c.rotation.z += c.userData.rotSpeed.z;
        if (c.position.y < camera.position.y - 40) { scene.remove(c); disposeMesh(c); confetti.splice(i, 1); }
    }
    if (gameState === 'playing' || gameState === 'gameover') updateCamera();
    scene.background.lerp(targetBgColor, 0.05);
    renderer.render(scene, camera);
}

function clearScene() {
    blocks.forEach(b => { scene.remove(b); disposeMesh(b); });
    debris.forEach(d => { scene.remove(d); disposeMesh(d); });
    confetti.forEach(c => { scene.remove(c); disposeMesh(c); });
    blocks = []; debris = []; confetti = []; currentBlock = null;
}
function saveCurrentScoreIfNeeded() {
    if (score > 0 && score > highScore) { highScore = score; localStorage.setItem('towerHighScore', highScore); highScoreEl.innerText = `РЕКОРД: ${highScore}`; }
}

function startGame(mode) {
    try {
        initAudio(); stopMusic(); clearScene();
        if (mode) gameMode = mode;
        score = 0; combo = 0; sessionCoins = 0; isFury = false; furyBlocksLeft = 0; document.body.classList.remove('fury-active');
        scoreEl.innerText = score; direction = 1; currentSpeed = BASE_SPEED; musicTempo = 110; gameState = 'playing'; currentBiomeIndex = 0;
        targetBgColor.set(BIOMES[0].bg); scene.background.set(BIOMES[0].bg); document.body.style.background = BIOMES[0].bg;
        document.body.classList.add('in-game');
        if (timeAttackTimer) { clearInterval(timeAttackTimer); timeAttackTimer = null; }
        if (gameMode === 'time') {
            timeLeft = 60; timerEl.style.display = 'block'; updateTimerDisplay();
            timeAttackTimer = setInterval(() => { if (gameState !== 'playing') return; timeLeft--; updateTimerDisplay(); if (timeLeft <= 0) { clearInterval(timeAttackTimer); timeAttackTimer = null; triggerGameOver(); } }, 1000);
        } else { timerEl.style.display = 'none'; }
        modeLabel.innerText = { classic: 'КЛАССИКА', time: 'НА ВРЕМЯ' }[gameMode];
        startScreen.style.display = 'none'; gameOverEl.style.display = 'none'; pauseScreen.style.display = 'none';
        camera.position.set(20, 25, 20); camera.lookAt(0, 0, 0);
        if (showTutorialHint) tutorialEl.style.display = 'block';
        createBaseBlock(); startMusic(); updateQuest('games', 1);
    } catch(err) {
        console.error('startGame error:', err);
        gameState = 'menu'; startScreen.style.display = 'flex'; gameOverEl.style.display = 'none'; pauseScreen.style.display = 'none';
    }
}

function goToMenu() {
    if (gameState === 'playing') saveCurrentScoreIfNeeded();
    stopMusic(); clearScene(); gameState = 'menu';
    document.body.classList.remove('in-game', 'fury-active');
    if (timeAttackTimer) { clearInterval(timeAttackTimer); timeAttackTimer = null; }
    gameOverEl.style.display = 'none'; pauseScreen.style.display = 'none'; shopScreen.style.display = 'none'; rulesScreen.style.display = 'none'; startScreen.style.display = 'flex';
    scene.background.set(BIOMES[0].bg); document.body.style.background = BIOMES[0].bg;
    camera.position.set(20, 25, 20); camera.lookAt(0, 0, 0);
    if (windGain && audioCtx) try { windGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.5); } catch(e) {}
    updateCoinUI();
}

function triggerGameOver() {
    if (gameState === 'gameover') return;
    gameState = 'gameover'; playSound('gameover'); stopMusic(); shakeIntensity = 0.8;
    document.body.classList.remove('in-game', 'fury-active');
    if (timeAttackTimer) { clearInterval(timeAttackTimer); timeAttackTimer = null; }
    if (gameMode === 'time' && score > 0) updateQuest('time_game', 1);
    finalScoreVal.innerText = score;
    if (sessionCoins > 0) {
        gameCoinsEarnedEl.innerText = `+${sessionCoins} 🪙 за игру`;
        gameCoinsEarnedEl.style.display = 'block';
    } else { gameCoinsEarnedEl.style.display = 'none'; }
    setTimeout(() => { gameOverEl.style.display = 'flex'; }, 800);
    triggerHaptic('error');
}

function togglePause() {
    if (gameState === 'playing') {
        gameState = 'paused'; pauseScreen.style.display = 'flex';
        document.body.classList.remove('in-game');
        if (timeAttackTimer) clearInterval(timeAttackTimer);
    } else if (gameState === 'paused') {
        gameState = 'playing'; pauseScreen.style.display = 'none';
        document.body.classList.add('in-game');
        if (gameMode === 'time') {
            timeAttackTimer = setInterval(() => { if (gameState !== 'playing') return; timeLeft--; updateTimerDisplay(); if (timeLeft <= 0) { clearInterval(timeAttackTimer); triggerGameOver(); } }, 1000);
        }
    }
}

function handleInput(e) {
    const target = e.target;
    if (target && target.closest && target.closest('button, .mode-btn, #top-right-controls, .modal')) return;
    if (target && target.closest && target.closest('#start-screen, #game-over, #pause-screen, #shop-screen, #rules-screen')) return;
    if (gameState === 'playing') {
        if (e.type === 'touchstart') e.preventDefault();
        dropBlock();
    }
}
window.addEventListener('mousedown', handleInput);
window.addEventListener('touchstart', handleInput, { passive: false });

function bindModeButton(id, mode) {
    const btn = document.getElementById(id);
    if (!btn) return;
    const handle = (e) => {
        if (e) { if (e.cancelable !== false) e.stopPropagation(); e.preventDefault(); }
        if (gameState === 'playing') return;
        startGame(mode);
    };
    btn.addEventListener('click', handle);
    btn.addEventListener('touchend', handle, { passive: false });
}
bindModeButton('btn-classic', 'classic');
bindModeButton('btn-time', 'time');

safeClick($('restart-btn'), () => startGame());
safeClick($('menu-btn'), () => goToMenu());
safeClick(pauseBtn, () => togglePause());
safeClick($('pause-resume'), () => togglePause());
safeClick($('pause-menu'), () => goToMenu());
safeClick(menuToggleBtn, () => { if (gameState === 'playing' || gameState === 'paused') goToMenu(); });
safeClick($('shop-btn'), () => { renderShop(); shopScreen.style.display = 'flex'; startScreen.style.display = 'none'; });
safeClick($('close-shop'), () => { shopScreen.style.display = 'none'; startScreen.style.display = 'flex'; updateCoinUI(); });
safeClick($('rules-btn'), () => { rulesScreen.style.display = 'flex'; startScreen.style.display = 'none'; });
safeClick($('close-rules'), () => { rulesScreen.style.display = 'none'; startScreen.style.display = 'flex'; });
safeClick($('challenge-btn'), () => {
    const text = `Я построил башню на ${score} этажей в MEGA HYPE! Слабо побить мой рекорд? 🏗️`;
    const url = window.location.href;
    if (tg) tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`);
    else window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`, '_blank');
});
safeClick(muteBtn, () => {
    isMuted = !isMuted; localStorage.setItem('towerMuted', isMuted);
    muteBtn.innerText = isMuted ? '🔇' : '🔊';
    if (isMuted) { stopMusic(); if (windGain && audioCtx) try { windGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.1); } catch(e) {} } else if (gameState === 'playing') startMusic();
});
muteBtn.innerText = isMuted ? '🔇' : '🔊';

function onResize() {
    if (!camera || !renderer) return;
    const aspect = window.innerWidth / window.innerHeight;
    const d = getAdaptiveD(aspect);
    camera.left = -d * aspect; camera.right = d * aspect;
    camera.top = d; camera.bottom = -d;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}
function updateTimerDisplay() { timerEl.innerText = `⏱ ${timeLeft}`; timerEl.style.color = timeLeft <= 10 ? '#EF476F' : '#06D6A0'; }

// ============ INIT ============
initThree();
loadQuests();
animate();