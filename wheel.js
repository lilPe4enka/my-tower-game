// wheel.js — Колесо удачи с взвешенными шансами (2% на легендарный облик)

import { safeGetItem, safeSetItem } from './utils.js?v=18';

const WHEEL_STORAGE_KEY = 'towerLastWheelSpinDate';

export const WHEEL_SEGMENTS = [
    { label: '+40 🪙',      type: 'coins',          value: 40,  color: '#FF8A65', weight: 24 },
    { label: '+100 ⭐',     type: 'xp',             value: 100, color: '#4FC3F7', weight: 18 },
    { label: '+80 🪙',      type: 'coins',          value: 80,  color: '#FFD54F', weight: 18 },
    { label: '⚡ Буст',     type: 'powerup',        value: 1,   color: '#BA68C8', weight: 14 },
    { label: '+150 🪙',     type: 'coins',          value: 150, color: '#81C784', weight: 10 },
    { label: '📦 Сундук',   type: 'chest',          rare: false,color: '#64B5F6', weight: 10 },
    { label: '✨ Редкий',   type: 'chest',          rare: true, color: '#FF6B9D', weight: 4  },
    { label: '👑 Легенда',  type: 'legendary_skin', jackpot: true, color: '#FFB300', weight: 2 },
];

export function canSpinWheel() {
    return safeGetItem(WHEEL_STORAGE_KEY, '') !== new Date().toDateString();
}

export function getTimeUntilNextSpin() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const diff = Math.max(0, tomorrow - now);
    const h = String(Math.floor(diff / 3600000)).padStart(2, '0');
    const m = String(Math.floor((diff % 3600000) / 60000)).padStart(2, '0');
    const s = String(Math.floor((diff % 60000) / 1000)).padStart(2, '0');
    return `${h}:${m}:${s}`;
}

function pickWeightedIndex() {
    const total = WHEEL_SEGMENTS.reduce((sum, s) => sum + s.weight, 0);
    let r = Math.random() * total;
    for (let i = 0; i < WHEEL_SEGMENTS.length; i++) {
        r -= WHEEL_SEGMENTS[i].weight;
        if (r <= 0) return i;
    }
    return 0;
}

export function createWheelController(canvas, { onTick, onFinish } = {}) {
    const ctx = canvas.getContext('2d');
    const count = WHEEL_SEGMENTS.length;
    const arc = (Math.PI * 2) / count;
    let angle = 0;
    let spinning = false;

    function draw() {
        const w = canvas.width, h = canvas.height;
        const cx = w / 2, cy = h / 2, radius = Math.min(cx, cy) - 8;
        ctx.clearRect(0, 0, w, h);

        for (let i = 0; i < count; i++) {
            const seg = WHEEL_SEGMENTS[i];
            const start = angle + i * arc;
            const end = start + arc;

            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.arc(cx, cy, radius, start, end);
            ctx.closePath();
            ctx.fillStyle = seg.color;
            ctx.fill();
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 3;
            ctx.stroke();

            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(start + arc / 2);
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = seg.jackpot ? '#4A2800' : '#FFFFFF';
            ctx.font = seg.jackpot ? '900 13px Rubik, sans-serif' : '800 13px Rubik, sans-serif';
            ctx.fillText(seg.label, radius - 14, 0);
            ctx.restore();
        }

        // Центральный круг
        ctx.beginPath();
        ctx.arc(cx, cy, 20, 0, Math.PI * 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();
        ctx.strokeStyle = '#FF6B9D';
        ctx.lineWidth = 4;
        ctx.stroke();
    }

    function spin() {
        if (spinning || !canSpinWheel()) return;
        spinning = true;
        safeSetItem(WHEEL_STORAGE_KEY, new Date().toDateString());

        const winIdx = pickWeightedIndex();
        // Указатель сверху (-Math.PI / 2)
        const targetCenter = -Math.PI / 2 - (winIdx * arc + arc / 2);
        const jitter = (Math.random() - 0.5) * arc * 0.65;
        const fullSpins = (5 + Math.floor(Math.random() * 2)) * Math.PI * 2;
        const startAngle = angle;
        const finalAngle = startAngle + fullSpins + ((targetCenter + jitter - startAngle) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);

        const duration = 4200;
        const startTime = performance.now();
        let lastSector = -1;

        function frame(now) {
            const t = Math.min(1, (now - startTime) / duration);
            const ease = 1 - Math.pow(1 - t, 3.5);
            angle = startAngle + (finalAngle - startAngle) * ease;
            draw();

            const curSector = Math.floor(((-angle - Math.PI / 2) % (Math.PI * 2) + Math.PI * 2) / arc) % count;
            if (curSector !== lastSector) {
                lastSector = curSector;
                if (typeof onTick === 'function') onTick();
            }

            if (t < 1) {
                requestAnimationFrame(frame);
            } else {
                spinning = false;
                if (typeof onFinish === 'function') onFinish(WHEEL_SEGMENTS[winIdx]);
            }
        }
        requestAnimationFrame(frame);
    }

    draw();
    return { draw, spin, isSpinning: () => spinning };
}
