// wheel.js — ежедневное Колесо удачи на HiDPI Canvas

import { safeGetItem, safeSetItem } from './utils.js?v=17';

const WHEEL_LAST_SPIN_KEY = 'towerWheelLastSpinDate';

export const WHEEL_SEGMENTS = [
    { label: '+50 🪙',   color: '#FF6B9D', textColor: '#FFFFFF', type: 'coins',   value: 50,  weight: 22 },
    { label: '+100 🪙',  color: '#4ECDC4', textColor: '#FFFFFF', type: 'coins',   value: 100, weight: 18 },
    { label: '⚡ Буст',   color: '#A855F7', textColor: '#FFFFFF', type: 'powerup', value: 1,   weight: 16 },
    { label: '+150 ⭐',  color: '#4FACFE', textColor: '#FFFFFF', type: 'xp',      value: 150, weight: 16 },
    { label: '+200 🪙',  color: '#FFA94D', textColor: '#FFFFFF', type: 'coins',   value: 200, weight: 12 },
    { label: '📦 Сундук', color: '#06D6A0', textColor: '#FFFFFF', type: 'chest',   rare: false, weight: 9 },
    { label: '✨ Редкий', color: '#FF477E', textColor: '#FFFFFF', type: 'chest',   rare: true,  weight: 5 },
    { label: '💎 500 🪙', color: '#FFD93D', textColor: '#4A3200', type: 'coins',   value: 500, jackpot: true, weight: 2 },
];

export function canSpinWheel() {
    return safeGetItem(WHEEL_LAST_SPIN_KEY, '') !== new Date().toDateString();
}

export function markWheelSpun() {
    safeSetItem(WHEEL_LAST_SPIN_KEY, new Date().toDateString());
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

function rollWeightedSegmentIndex() {
    const total = WHEEL_SEGMENTS.reduce((sum, seg) => sum + seg.weight, 0);
    let r = Math.random() * total;
    for (let i = 0; i < WHEEL_SEGMENTS.length; i++) {
        r -= WHEEL_SEGMENTS[i].weight;
        if (r <= 0) return i;
    }
    return 0;
}

export function createWheelController(canvas, { onTick, onFinish } = {}) {
    const SIZE = 270;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(SIZE * dpr);
    canvas.height = Math.round(SIZE * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const count = WHEEL_SEGMENTS.length;
    const arc = (Math.PI * 2) / count;
    let currentAngle = 0;
    let spinning = false;
    let rafId = null;

    function draw() {
        const cx = SIZE / 2;
        const cy = SIZE / 2;
        const r = SIZE / 2 - 12;

        ctx.clearRect(0, 0, SIZE, SIZE);

        // Внешняя рамка
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, r + 6, 0, Math.PI * 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.shadowColor = 'rgba(74, 68, 88, 0.2)';
        ctx.shadowBlur = 12;
        ctx.fill();
        ctx.restore();

        // Секторы
        for (let i = 0; i < count; i++) {
            const start = currentAngle + i * arc;
            const end = start + arc;
            const seg = WHEEL_SEGMENTS[i];

            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.arc(cx, cy, r, start, end);
            ctx.closePath();
            ctx.fillStyle = seg.color;
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = 'rgba(255,255,255,0.85)';
            ctx.stroke();

            // Подпись сектора
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(start + arc / 2);
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = seg.textColor;
            ctx.font = '900 13px Rubik, sans-serif';
            ctx.fillText(seg.label, r - 14, 0);
            ctx.restore();
        }

        // Декоративные точки по ободу
        for (let i = 0; i < count; i++) {
            const a = currentAngle + i * arc;
            ctx.beginPath();
            ctx.arc(cx + Math.cos(a) * (r + 2), cy + Math.sin(a) * (r + 2), 3, 0, Math.PI * 2);
            ctx.fillStyle = '#FFD93D';
            ctx.fill();
        }

        // Центральный диск
        ctx.beginPath();
        ctx.arc(cx, cy, 24, 0, Math.PI * 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#FF6B9D';
        ctx.stroke();

        ctx.fillStyle = '#FF6B9D';
        ctx.font = '900 18px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🎰', cx, cy + 1);
    }

    function spin() {
        if (spinning || !canSpinWheel()) return false;
        spinning = true;
        markWheelSpun();

        const targetIndex = rollWeightedSegmentIndex();
        const pointerAngle = -Math.PI / 2; // стрелка сверху (12 часов)
        const desiredMod = pointerAngle - (targetIndex + 0.5) * arc;
        const currentMod = currentAngle % (Math.PI * 2);
        let delta = desiredMod - currentMod;
        while (delta < 0) delta += Math.PI * 2;

        const extraSpins = (5 + Math.floor(Math.random() * 2)) * Math.PI * 2;
        const jitter = (Math.random() - 0.5) * arc * 0.55;
        const startAngle = currentAngle;
        const totalDelta = extraSpins + delta + jitter;

        const duration = 4200;
        const startTime = performance.now();
        let lastSegTick = Math.floor(startAngle / arc);

        function easeOutQuart(t) {
            return 1 - Math.pow(1 - t, 4);
        }

        function animateSpin(now) {
            const elapsed = now - startTime;
            const t = Math.min(1, elapsed / duration);
            currentAngle = startAngle + totalDelta * easeOutQuart(t);

            const currentSegTick = Math.floor(currentAngle / arc);
            if (currentSegTick !== lastSegTick) {
                lastSegTick = currentSegTick;
                if (onTick) onTick();
            }

            draw();

            if (t < 1) {
                rafId = requestAnimationFrame(animateSpin);
            } else {
                spinning = false;
                rafId = null;
                if (onFinish) onFinish(WHEEL_SEGMENTS[targetIndex]);
            }
        }

        rafId = requestAnimationFrame(animateSpin);
        return true;
    }

    function destroy() {
        if (rafId) {
            cancelAnimationFrame(rafId);
            rafId = null;
        }
        spinning = false;
    }

    draw();

    return {
        draw,
        spin,
        destroy,
        isSpinning: () => spinning,
    };
}
