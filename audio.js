// audio.js — процедурный звук и адаптивная музыка на Web Audio API

import { LEAD_NOTES } from './constants.js?v=18';

let audioCtx = null;
let noiseBuffer = null;
let masterSfxGain = null;
let sfxDelayNode = null;
let sfxDelayWet = null;
let musicGain = null;
let windGain = null;

let musicPlaying = false;
let musicBeat = 0;
let musicTempo = 110;
let musicTimeout = null;

let hooks = {
    isSfxEnabled: () => true,
    isMusicEnabled: () => true,
    isPlaying: () => false,
    getMusicPhase: () => 1,
};

const PENTATONIC_SCALE = [
    523.25, 587.33, 659.25, 783.99, 880.00,
    1046.50, 1174.66, 1318.51, 1567.98, 1760.00,
    2093.00, 2349.32, 2637.02
];

export function configureAudio(config = {}) {
    hooks = { ...hooks, ...config };
}

export function isAudioRunning() {
    return Boolean(audioCtx && audioCtx.state === 'running');
}

export function setMusicTempo(bpm) {
    if (Number.isFinite(bpm) && bpm > 40) musicTempo = bpm;
}

export function setWindVolume(value) {
    if (!windGain || !audioCtx) return;
    try {
        windGain.gain.setTargetAtTime(Math.max(0, Math.min(0.4, value)), audioCtx.currentTime, 0.15);
    } catch (e) {}
}

export function initAudio() {
    if (!audioCtx) {
        try {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const size = audioCtx.sampleRate * 1.0;
            noiseBuffer = audioCtx.createBuffer(1, size, audioCtx.sampleRate);
            const data = noiseBuffer.getChannelData(0);
            for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;

            const compressor = audioCtx.createDynamicsCompressor();
            compressor.threshold.value = -14;
            compressor.knee.value = 18;
            compressor.ratio.value = 4;
            compressor.attack.value = 0.004;
            compressor.release.value = 0.15;
            compressor.connect(audioCtx.destination);

            masterSfxGain = audioCtx.createGain();
            masterSfxGain.gain.value = 0.9;
            masterSfxGain.connect(compressor);

            sfxDelayNode = audioCtx.createDelay(0.5);
            sfxDelayNode.delayTime.value = 0.16;
            const delayFeedback = audioCtx.createGain();
            delayFeedback.gain.value = 0.28;
            const delayFilter = audioCtx.createBiquadFilter();
            delayFilter.type = 'lowpass';
            delayFilter.frequency.value = 2400;
            sfxDelayWet = audioCtx.createGain();
            sfxDelayWet.gain.value = 0.22;

            sfxDelayNode.connect(delayFilter);
            delayFilter.connect(delayFeedback);
            delayFeedback.connect(sfxDelayNode);
            delayFilter.connect(sfxDelayWet);
            sfxDelayWet.connect(compressor);

            musicGain = audioCtx.createGain();
            musicGain.gain.value = 0.11;
            musicGain.connect(compressor);

            windGain = audioCtx.createGain();
            windGain.gain.value = 0;
            windGain.connect(compressor);
            const windOsc = audioCtx.createBufferSource();
            windOsc.buffer = noiseBuffer;
            windOsc.loop = true;
            const windFilter = audioCtx.createBiquadFilter();
            windFilter.type = 'lowpass';
            windFilter.frequency.value = 380;
            windOsc.connect(windFilter);
            windFilter.connect(windGain);
            windOsc.start();
        } catch (e) {}
    }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
}

export function playSound(type, level = 0) {
    if (!hooks.isSfxEnabled() || !audioCtx || audioCtx.state === 'suspended') return;
    try {
        const now = audioCtx.currentTime;
        const dest = masterSfxGain || audioCtx.destination;

        const tone = (freq, endFreq, wave, dur, vol, delay = 0, useEcho = false, cutoff = 2800) => {
            const osc = audioCtx.createOscillator();
            const g = audioCtx.createGain();
            const filter = audioCtx.createBiquadFilter();
            osc.type = wave;
            osc.frequency.setValueAtTime(freq, now + delay);
            if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, now + delay + dur);
            filter.type = 'lowpass';
            filter.frequency.value = cutoff;
            g.gain.setValueAtTime(0.0001, now + delay);
            g.gain.linearRampToValueAtTime(vol, now + delay + 0.012);
            g.gain.exponentialRampToValueAtTime(0.0008, now + delay + dur);
            osc.connect(filter);
            filter.connect(g);
            g.connect(dest);
            if (useEcho && sfxDelayNode) g.connect(sfxDelayNode);
            osc.start(now + delay);
            osc.stop(now + delay + dur + 0.02);
        };

        const noise = (dur, vol, delay = 0, freq = 1000, filterType = 'bandpass') => {
            const src = audioCtx.createBufferSource();
            src.buffer = noiseBuffer;
            const filter = audioCtx.createBiquadFilter();
            const g = audioCtx.createGain();
            filter.type = filterType;
            filter.frequency.value = freq;
            g.gain.setValueAtTime(vol, now + delay);
            g.gain.exponentialRampToValueAtTime(0.001, now + delay + dur);
            src.connect(filter);
            filter.connect(g);
            g.connect(dest);
            src.start(now + delay);
            src.stop(now + delay + dur + 0.02);
        };

        if (type === 'ui_click') {
            tone(480, 680, 'sine', 0.04, 0.06, 0, false, 1800);
        } else if (type === 'buy') {
            tone(987.77, null, 'sine', 0.12, 0.18, 0, true);
            tone(1318.51, null, 'triangle', 0.24, 0.2, 0.07, true);
        } else if (type === 'drop') {
            tone(155, 52, 'sine', 0.13, 0.34, 0, false, 600);
            tone(320, 140, 'triangle', 0.06, 0.12, 0, false, 1400);
            noise(0.055, 0.14, 0, 1600, 'bandpass');
        } else if (type === 'perfect') {
            const idx = Math.min(Math.max(0, level - 1), PENTATONIC_SCALE.length - 1);
            const root = PENTATONIC_SCALE[idx];
            tone(root, null, 'triangle', 0.34, 0.24, 0, true, 4000);
            tone(root * 1.5, null, 'sine', 0.28, 0.11, 0.015, true, 5000);
            tone(root * 0.5, null, 'sine', 0.18, 0.14, 0, false, 900);
        } else if (type === 'record_break') {
            [523.25, 659.25, 783.99, 1046.50, 1318.51, 1567.98].forEach((f, i) => {
                tone(f, null, 'triangle', 0.38, 0.22, i * 0.065, true, 5000);
            });
            tone(2093.00, null, 'sine', 0.55, 0.18, 0.4, true, 6000);
        } else if (type === 'milestone') {
            [392.00, 523.25, 659.25, 783.99].forEach((f, i) => tone(f, null, 'triangle', 0.42, 0.16, i * 0.08, true));
        } else if (type === 'bomb') {
            tone(110, 26, 'sawtooth', 0.45, 0.35, 0, false, 450);
            tone(65, 22, 'sine', 0.5, 0.38, 0, false, 200);
            noise(0.42, 0.38, 0, 650, 'lowpass');
        } else if (type === 'gameover') {
            [329.63, 293.66, 246.94, 196.00].forEach((f, i) => {
                tone(f, f * 0.94, 'triangle', 0.36, 0.18, i * 0.11, true, 1600);
            });
        } else if (type === 'quest') {
            tone(659.25, null, 'sine', 0.18, 0.2, 0, true);
            tone(783.99, null, 'sine', 0.22, 0.2, 0.09, true);
            tone(1046.5, null, 'triangle', 0.38, 0.22, 0.18, true);
        } else if (type === 'fury') {
            tone(220, 880, 'sawtooth', 0.45, 0.16, 0, true, 3200);
            tone(330, 1108, 'triangle', 0.45, 0.14, 0.04, true, 3600);
        } else if (type === 'secret') {
            [523.25, 659.25, 783.99, 1046.5, 1318.51].forEach((f, i) => tone(f, null, 'sine', 0.32, 0.2, i * 0.055, true));
        } else if (type === 'gust') {
            tone(180, 720, 'sine', 0.65, 0.08, 0, false, 1200);
            noise(0.55, 0.2, 0, 900, 'bandpass');
        } else if (type === 'chest') {
            [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, null, 'triangle', 0.36, 0.2, i * 0.09, true));
            tone(1318.51, null, 'sine', 0.55, 0.24, 0.42, true);
        } else if (type === 'victory') {
            [523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98].forEach((f, i) => tone(f, null, 'triangle', 0.48, 0.2, i * 0.085, true));
        } else if (type === 'combo_2x') {
            tone(523.25, null, 'triangle', 0.16, 0.2, 0, true);
            tone(659.25, null, 'triangle', 0.2, 0.2, 0.07, true);
        } else if (type === 'combo_3x') {
            [523.25, 659.25, 783.99].forEach((f, i) => tone(f, null, 'triangle', 0.2, 0.21, i * 0.065, true));
        } else if (type === 'combo_5x') {
            [523.25, 659.25, 783.99, 1046.50].forEach((f, i) => tone(f, null, 'triangle', 0.24, 0.23, i * 0.055, true));
        } else if (type === 'combo_super') {
            [523.25, 659.25, 783.99, 1046.50, 1318.51].forEach((f, i) => tone(f, null, 'triangle', 0.22, 0.24, i * 0.05, true));
        } else if (type === 'combo_ultra') {
            [523.25, 659.25, 783.99, 1046.50, 1318.51, 1567.98].forEach((f, i) => tone(f, null, 'sine', 0.22, 0.25, i * 0.04, true));
            tone(2093, null, 'sine', 0.45, 0.18, 0.24, true);
        } else if (type === 'combo_insane') {
            [523.25, 659.25, 783.99, 1046.50, 1318.51, 1567.98, 2093].forEach((f, i) => tone(f, null, 'triangle', 0.2, 0.26, i * 0.035, true));
            tone(2637, null, 'sine', 0.5, 0.22, 0.25, true);
        } else if (type === 'mission_complete') {
            [523.25, 659.25, 783.99, 1046.50].forEach((f, i) => tone(f, null, 'triangle', 0.22, 0.22, i * 0.075, true));
            tone(1318.51, null, 'sine', 0.4, 0.2, 0.32, true);
        } else if (type === 'prestige_activate') {
            [523.25, 659.25, 783.99, 1046.50, 1318.51, 1567.98, 2093.00].forEach((f, i) => tone(f, null, 'sine', 0.22, 0.24, i * 0.05, true));
            tone(2637, null, 'triangle', 0.75, 0.26, 0.38, true);
        } else if (type === 'event_start') {
            [392.00, 523.25, 659.25, 783.99, 1046.50].forEach((f, i) => tone(f, null, 'triangle', 0.25, 0.2, i * 0.09, true));
        } else if (type === 'event_reward') {
            tone(659.25, null, 'sine', 0.16, 0.22, 0, true);
            tone(783.99, null, 'sine', 0.18, 0.22, 0.09, true);
            tone(1046.50, null, 'triangle', 0.32, 0.22, 0.18, true);
        } else if (type === 'screen_transition') {
            tone(520, 740, 'sine', 0.08, 0.07, 0, false, 1800);
        } else if (type === 'notification') {
            tone(880, null, 'sine', 0.1, 0.18, 0, true);
            tone(1174.66, null, 'sine', 0.16, 0.18, 0.09, true);
        } else if (type === 'unlock') {
            [523.25, 659.25, 783.99, 1046.50, 1318.51].forEach((f, i) => tone(f, null, 'sine', 0.18, 0.2, i * 0.065, true));
        }
    } catch (e) {}
}

function playKick() {
    if (!audioCtx || !hooks.isMusicEnabled()) return;
    try {
        const osc = audioCtx.createOscillator(), g = audioCtx.createGain();
        osc.frequency.setValueAtTime(140, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.12);
        g.gain.setValueAtTime(0.25, audioCtx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.12);
        osc.connect(g); g.connect(musicGain); osc.start();
        osc.stop(audioCtx.currentTime + 0.12);
    } catch (e) {}
}

function playHat() {
    if (!audioCtx || !hooks.isMusicEnabled()) return;
    try {
        const src = audioCtx.createBufferSource(); src.buffer = noiseBuffer;
        const filter = audioCtx.createBiquadFilter(); filter.type = 'highpass'; filter.frequency.value = 6000;
        const g = audioCtx.createGain();
        g.gain.setValueAtTime(0.06, audioCtx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.04);
        src.connect(filter); filter.connect(g); g.connect(musicGain);
        src.start(); src.stop(audioCtx.currentTime + 0.04);
    } catch (e) {}
}

function playBass() {
    if (!audioCtx || !hooks.isMusicEnabled()) return;
    try {
        const osc = audioCtx.createOscillator(), g = audioCtx.createGain();
        osc.type = 'triangle'; osc.frequency.setValueAtTime(65, audioCtx.currentTime);
        g.gain.setValueAtTime(0.15, audioCtx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
        osc.connect(g); g.connect(musicGain); osc.start();
        osc.stop(audioCtx.currentTime + 0.2);
    } catch (e) {}
}

function playLeadNote(idx) {
    if (!audioCtx || !hooks.isMusicEnabled()) return;
    try {
        const now = audioCtx.currentTime;
        const osc = audioCtx.createOscillator(), g = audioCtx.createGain();
        osc.type = 'sine'; osc.frequency.setValueAtTime(LEAD_NOTES[idx], now);
        g.gain.setValueAtTime(0.05, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc.connect(g); g.connect(musicGain); osc.start(now); osc.stop(now + 0.35);
    } catch (e) {}
}

function playFuryLead() {
    if (!audioCtx || !hooks.isMusicEnabled()) return;
    try {
        const now = audioCtx.currentTime;
        const osc = audioCtx.createOscillator(), g = audioCtx.createGain();
        const filter = audioCtx.createBiquadFilter();
        osc.type = 'sawtooth'; osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(440, now + 0.15);
        filter.type = 'lowpass'; filter.frequency.value = 3000;
        g.gain.setValueAtTime(0.08, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        osc.connect(filter); filter.connect(g); g.connect(musicGain);
        osc.start(now); osc.stop(now + 0.2);
    } catch (e) {}
}

function musicTick() {
    if (!musicPlaying || !hooks.isMusicEnabled() || !hooks.isPlaying()) return;
    const phase = hooks.getMusicPhase();
    const beat = musicBeat % 8;
    if (phase === 4) {
        if (beat % 2 === 0) playKick();
        if (beat === 1 || beat === 3 || beat === 5 || beat === 7) playHat();
        if (beat === 0 || beat === 4) playBass();
        if (beat === 2 || beat === 6) playFuryLead();
    } else {
        if (beat === 0 || beat === 3 || beat === 4) playKick();
        if (beat === 2 || beat === 6) playHat();
        if (phase >= 2 && (beat === 0 || beat === 4)) playBass();
        if (phase >= 3) {
            if (beat === 1) playLeadNote(0);
            if (beat === 3) playLeadNote(1);
            if (beat === 5) playLeadNote(2);
            if (beat === 7) playLeadNote(3);
        }
    }
    musicBeat++;
    musicTimeout = setTimeout(musicTick, (60000 / musicTempo) / 2);
}

export function startMusic(baseTempo = 110) {
    if (musicPlaying || !hooks.isMusicEnabled()) return;
    initAudio();
    if (!audioCtx) return;
    musicPlaying = true;
    musicBeat = 0;
    musicTempo = baseTempo;
    musicTick();
}

export function stopMusic() {
    musicPlaying = false;
    if (musicTimeout) {
        clearTimeout(musicTimeout);
        musicTimeout = null;
    }
}
