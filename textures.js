// textures.js — процедурные текстуры скинов, кэш материалов и 3D-блоки

import * as THREE from 'three';
import { BLOCK_TYPES, BLOCK_GLOW_COLORS } from './constants.js?v=18';

export const SHARED_UNIT_BOX_GEO = new THREE.BoxGeometry(1, 1, 1);

export const PARTICLE_GEOS = {
    confetti: new THREE.BoxGeometry(0.18, 0.18, 0.05),
    bomb: new THREE.BoxGeometry(0.24, 0.24, 0.24),
    wave: new THREE.PlaneGeometry(1, 1),
};

const BLOCK_MATERIAL_CACHE = new Map();
const DEBRIS_MATERIAL_CACHE = new Map();
const LOCAL_TEXTURE_CACHE = new Map();
const PARTICLE_MAT_CACHE = new Map();

export function getParticleMaterial(color) {
    if (!PARTICLE_MAT_CACHE.has(color)) {
        PARTICLE_MAT_CACHE.set(color, new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
    }
    return PARTICLE_MAT_CACHE.get(color);
}

export function getDebrisMaterial(color) {
    if (!DEBRIS_MATERIAL_CACHE.has(color)) {
        DEBRIS_MATERIAL_CACHE.set(color, new THREE.MeshLambertMaterial({ color }));
    }
    return DEBRIS_MATERIAL_CACHE.get(color);
}

export function clearVisualCaches() {
    BLOCK_MATERIAL_CACHE.forEach(mats => {
        if (Array.isArray(mats)) mats.forEach(m => m.dispose());
    });
    BLOCK_MATERIAL_CACHE.clear();

    LOCAL_TEXTURE_CACHE.forEach(tex => {
        if (tex && typeof tex.dispose === 'function') tex.dispose();
    });
    LOCAL_TEXTURE_CACHE.clear();
}

export function createGlowTexture() {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 64;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.45)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(c);
    tex.needsUpdate = true;
    return tex;
}

export function createPerfectWaveTexture() {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 128;
    const ctx = c.getContext('2d');
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 10;
    ctx.strokeRect(8, 8, 112, 112);
    const tex = new THREE.CanvasTexture(c);
    tex.needsUpdate = true;
    return tex;
}

export function createBlockTexture(colorHex, type = BLOCK_TYPES.NORMAL, skin = 'default', redTheme = false, pattern = 'none') {
    const key = `${skin}_${pattern}_${type}_${colorHex}_${redTheme ? 1 : 0}`;
    if (LOCAL_TEXTURE_CACHE.has(key)) return LOCAL_TEXTURE_CACHE.get(key);

    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 128;
    const ctx = c.getContext('2d');

    ctx.fillStyle = colorHex;
    ctx.fillRect(0, 0, 128, 128);

    if (type === BLOCK_TYPES.BOMB) {
        ctx.fillStyle = '#141414';
        ctx.fillRect(0, 0, 128, 128);
        ctx.strokeStyle = '#FF1744';
        ctx.lineWidth = 14;
        for (let i = -128; i < 256; i += 32) {
            ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + 128, 128); ctx.stroke();
        }
        ctx.font = 'bold 48px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('💣', 64, 66);
    } else if (type === BLOCK_TYPES.GOLDEN) {
        const g = ctx.createLinearGradient(0, 0, 128, 128);
        g.addColorStop(0, '#FFF59D'); g.addColorStop(0.5, '#FFD54F'); g.addColorStop(1, '#FFB300');
        ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
        ctx.strokeStyle = 'rgba(255,255,255,0.65)'; ctx.lineWidth = 8; ctx.strokeRect(8, 8, 112, 112);
    } else if (type === BLOCK_TYPES.ICE) {
        const g = ctx.createLinearGradient(0, 0, 128, 128);
        g.addColorStop(0, '#E0F7FA'); g.addColorStop(1, '#00B8D4');
        ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
        ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(16, 30); ctx.lineTo(112, 18); ctx.moveTo(20, 92); ctx.lineTo(104, 72); ctx.stroke();
    } else if (type === BLOCK_TYPES.CRUMBLE) {
        ctx.fillStyle = '#5D4037'; ctx.fillRect(0, 0, 128, 128);
        ctx.strokeStyle = '#3E2723'; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.moveTo(12, 18); ctx.lineTo(54, 62); ctx.lineTo(36, 110);
        ctx.moveTo(54, 62); ctx.lineTo(108, 44); ctx.moveTo(76, 60); ctx.lineTo(116, 108); ctx.stroke();
    } else if (type === BLOCK_TYPES.RAINBOW) {
        const g = ctx.createLinearGradient(0, 0, 128, 0);
        g.addColorStop(0, '#FF1744'); g.addColorStop(0.25, '#FFEA00'); g.addColorStop(0.5, '#00E676'); g.addColorStop(0.75, '#00B0FF'); g.addColorStop(1, '#D500F9');
        ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
    } else if (type === BLOCK_TYPES.DRAGON) {
        const g = ctx.createLinearGradient(0, 0, 128, 128);
        g.addColorStop(0, '#B71C1C'); g.addColorStop(0.5, '#FF6D00'); g.addColorStop(1, '#FFD600');
        ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
        ctx.font = 'bold 46px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('🐉', 64, 66);
    } else if (type === BLOCK_TYPES.DIAMOND) {
        const g = ctx.createLinearGradient(0, 0, 128, 128);
        g.addColorStop(0, '#E0F7FA'); g.addColorStop(0.5, '#00E5FF'); g.addColorStop(1, '#006064');
        ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
        ctx.font = 'bold 46px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('💎', 64, 66);
    } else {
        // Базовое мягкое освещение грани
        const shade = ctx.createLinearGradient(0, 0, 0, 128);
        shade.addColorStop(0, 'rgba(255,255,255,0.16)');
        shade.addColorStop(1, 'rgba(0,0,0,0.16)');
        ctx.fillStyle = shade;
        ctx.fillRect(0, 0, 128, 128);

        // === РЕДКИЕ: простые узоры ===
        if (pattern === 'dots') {
            ctx.fillStyle = 'rgba(255,255,255,0.28)';
            [[26, 26], [96, 26], [64, 64], [26, 102], [96, 102]].forEach(([x, y]) => {
                ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.fill();
            });
        } else if (pattern === 'stripes') {
            ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 10;
            for (let i = -128; i < 256; i += 32) {
                ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + 128, 128); ctx.stroke();
            }
        } else if (pattern === 'bricks') {
            ctx.strokeStyle = 'rgba(0,0,0,0.28)'; ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(0, 42); ctx.lineTo(128, 42); ctx.moveTo(0, 86); ctx.lineTo(128, 86);
            ctx.moveTo(64, 0); ctx.lineTo(64, 42); ctx.moveTo(32, 42); ctx.lineTo(32, 86);
            ctx.moveTo(96, 42); ctx.lineTo(96, 86); ctx.moveTo(64, 86); ctx.lineTo(64, 128);
            ctx.stroke();
        } else if (pattern === 'waves') {
            ctx.strokeStyle = 'rgba(255,255,255,0.34)'; ctx.lineWidth = 4;
            for (let row = 28; row <= 100; row += 36) {
                ctx.beginPath();
                for (let x = 0; x <= 128; x += 8) {
                    const y = row + Math.sin((x / 128) * Math.PI * 4) * 7;
                    if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
                }
                ctx.stroke();
            }
        } else if (pattern === 'grid') {
            ctx.fillStyle = 'rgba(0,0,0,0.16)';
            for (let x = 0; x < 128; x += 16) ctx.fillRect(x, 0, 2, 128);
            for (let y = 0; y < 128; y += 16) ctx.fillRect(0, y, 128, 2);
            ctx.fillStyle = 'rgba(255,255,255,0.35)';
            ctx.fillRect(6, 6, 10, 10); ctx.fillRect(22, 6, 6, 6);
        } else if (pattern === 'frost') {
            ctx.fillStyle = 'rgba(255,255,255,0.28)';
            ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(74, 0); ctx.lineTo(0, 74); ctx.closePath(); ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.65)'; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.moveTo(24, 110); ctx.lineTo(108, 24); ctx.moveTo(58, 116); ctx.lineTo(118, 56); ctx.stroke();
        }
        // === ЭПИЧЕСКИЕ: сложные текстуры ===
        else if (pattern === 'gem') {
            ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.moveTo(64, 14); ctx.lineTo(114, 64); ctx.lineTo(64, 114); ctx.lineTo(14, 64); ctx.closePath(); ctx.stroke();
            ctx.fillStyle = 'rgba(255,255,255,0.2)';
            ctx.beginPath(); ctx.moveTo(64, 14); ctx.lineTo(114, 64); ctx.lineTo(64, 64); ctx.closePath(); ctx.fill();
        } else if (pattern === 'magma') {
            ctx.strokeStyle = 'rgba(255, 225, 70, 0.9)'; ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(10, 26); ctx.lineTo(46, 54); ctx.lineTo(34, 98);
            ctx.moveTo(46, 54); ctx.lineTo(96, 36); ctx.lineTo(118, 66);
            ctx.moveTo(72, 46); ctx.lineTo(90, 114);
            ctx.stroke();
        } else if (pattern === 'circuit') {
            ctx.fillStyle = 'rgba(10, 8, 24, 0.55)'; ctx.fillRect(8, 8, 112, 112);
            ctx.strokeStyle = '#00F5FF'; ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(14, 34); ctx.lineTo(48, 34); ctx.lineTo(64, 52); ctx.lineTo(114, 52);
            ctx.moveTo(14, 92); ctx.lineTo(74, 92); ctx.lineTo(92, 74); ctx.lineTo(114, 74);
            ctx.stroke();
            ctx.fillStyle = '#FF2A85';
            ctx.beginPath(); ctx.arc(48, 34, 4, 0, Math.PI * 2); ctx.arc(92, 74, 4, 0, Math.PI * 2); ctx.fill();
        } else if (pattern === 'stars') {
            const neb = ctx.createRadialGradient(64, 64, 6, 64, 64, 58);
            neb.addColorStop(0, 'rgba(190, 130, 255, 0.42)'); neb.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = neb; ctx.fillRect(0, 0, 128, 128);
            ctx.fillStyle = '#FFFFFF';
            [[18, 22, 2.5], [98, 28, 2], [42, 76, 1.8], [108, 94, 2.8], [26, 106, 1.6], [74, 48, 2.2], [62, 108, 1.5]].forEach(([x, y, r]) => {
                ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
            });
        } else if (pattern === 'holo') {
            const h = ctx.createLinearGradient(0, 0, 128, 128);
            h.addColorStop(0, 'rgba(0,255,255,0.4)'); h.addColorStop(0.33, 'rgba(255,0,255,0.34)');
            h.addColorStop(0.66, 'rgba(255,255,0,0.34)'); h.addColorStop(1, 'rgba(0,255,150,0.4)');
            ctx.fillStyle = h; ctx.fillRect(0, 0, 128, 128);
        }
        // === ЛЕГЕНДАРНЫЕ: орнаменты и символы ===
        else if (pattern === 'royal') {
            ctx.strokeStyle = 'rgba(255, 250, 200, 0.9)'; ctx.lineWidth = 5; ctx.strokeRect(10, 10, 108, 108);
            ctx.lineWidth = 2; ctx.strokeRect(20, 20, 88, 88);
            ctx.fillStyle = 'rgba(255,255,255,0.6)';
            ctx.beginPath(); ctx.moveTo(64, 34); ctx.lineTo(86, 64); ctx.lineTo(64, 94); ctx.lineTo(42, 64); ctx.closePath(); ctx.fill();
        } else if (pattern === 'phoenix') {
            const fg = ctx.createRadialGradient(64, 90, 8, 64, 64, 68);
            fg.addColorStop(0, 'rgba(255, 255, 180, 0.85)'); fg.addColorStop(0.5, 'rgba(255, 110, 0, 0.45)'); fg.addColorStop(1, 'rgba(180, 0, 0, 0)');
            ctx.fillStyle = fg; ctx.fillRect(0, 0, 128, 128);
            ctx.strokeStyle = '#FFF59D'; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.moveTo(18, 96); ctx.quadraticCurveTo(64, 16, 110, 96); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(34, 104); ctx.quadraticCurveTo(64, 42, 94, 104); ctx.stroke();
        } else if (pattern === 'chrono') {
            ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(64, 64, 38, 0, Math.PI * 2); ctx.stroke();
            ctx.beginPath(); ctx.arc(64, 64, 28, 0, Math.PI * 2); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(64, 64); ctx.lineTo(64, 38); ctx.moveTo(64, 64); ctx.lineTo(86, 64); ctx.stroke();
        } else if (pattern === 'astral') {
            const ag = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
            ag.addColorStop(0, 'rgba(0, 245, 212, 0.55)'); ag.addColorStop(0.5, 'rgba(155, 93, 229, 0.35)'); ag.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = ag; ctx.fillRect(0, 0, 128, 128);
            ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(64, 16); ctx.lineTo(74, 54); ctx.lineTo(112, 64); ctx.lineTo(74, 74);
            ctx.lineTo(64, 112); ctx.lineTo(54, 74); ctx.lineTo(16, 64); ctx.lineTo(54, 54); ctx.closePath();
            ctx.stroke();
        } else if (pattern === 'first_wipe') {
            // Тёмная обсидианово-золотая призма
            const bg = ctx.createLinearGradient(0, 0, 128, 128);
            bg.addColorStop(0, 'rgba(18, 6, 36, 0.72)');
            bg.addColorStop(0.5, 'rgba(255, 193, 7, 0.25)');
            bg.addColorStop(1, 'rgba(0, 245, 212, 0.32)');
            ctx.fillStyle = bg;
            ctx.fillRect(0, 0, 128, 128);

            // Диагональные световые лучи
            ctx.strokeStyle = 'rgba(255, 215, 0, 0.35)';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(0, 96); ctx.lineTo(96, 0);
            ctx.moveTo(32, 128); ctx.lineTo(128, 32);
            ctx.stroke();

            // Двойная золотая рамка
            ctx.strokeStyle = '#FFD700';
            ctx.lineWidth = 4;
            ctx.strokeRect(8, 8, 112, 112);
            ctx.strokeStyle = 'rgba(0, 245, 212, 0.8)';
            ctx.lineWidth = 2;
            ctx.strokeRect(16, 16, 96, 96);

            // Центральная печать «перезагрузки» (кристалл в кольце)
            ctx.strokeStyle = '#FFF59D';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.arc(64, 64, 28, 0, Math.PI * 2);
            ctx.stroke();

            const core = ctx.createLinearGradient(44, 44, 84, 84);
            core.addColorStop(0, '#FFFFFF');
            core.addColorStop(0.5, '#FFD700');
            core.addColorStop(1, '#FF2A85');
            ctx.fillStyle = core;
            ctx.beginPath();
            ctx.moveTo(64, 34); ctx.lineTo(84, 64); ctx.lineTo(64, 94); ctx.lineTo(44, 64);
            ctx.closePath();
            ctx.fill();

            // Искры по углам
            ctx.fillStyle = '#FFFFFF';
            [[24, 24, 3], [104, 24, 3], [24, 104, 3], [104, 104, 3]].forEach(([x, y, r]) => {
                ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
            });
        }

        if (pattern !== 'none') {
            ctx.strokeStyle = 'rgba(255,255,255,0.24)';
            ctx.lineWidth = 4;
            ctx.strokeRect(2, 2, 124, 124);
        }
    }

    const tex = new THREE.CanvasTexture(c);
    tex.needsUpdate = true;
    LOCAL_TEXTURE_CACHE.set(key, tex);
    return tex;
}

export function createBlockMesh(w, h, d, color, type = BLOCK_TYPES.NORMAL, { skin = 'default', pattern = 'none', redTheme = false, glowTexture = null } = {}) {
    const cacheKey = `${skin}_${pattern}_${type}_${color}_${redTheme ? 1 : 0}`;
    let materials = BLOCK_MATERIAL_CACHE.get(cacheKey);

    if (!materials) {
        const tex = createBlockTexture(color, type, skin, redTheme, pattern);
        let sideOpts = { map: tex };
        let topOpts = { color };
        if (type === BLOCK_TYPES.GOLDEN) {
            sideOpts.emissive = new THREE.Color(0xFFB300); sideOpts.emissiveIntensity = 0.5;
            topOpts.emissive = new THREE.Color(0xFFB300); topOpts.emissiveIntensity = 0.5;
            topOpts.color = new THREE.Color(0xFFC107);
        } else if (type === BLOCK_TYPES.BOMB) {
            sideOpts.emissive = new THREE.Color(0xFF0000); sideOpts.emissiveIntensity = 0.6;
            topOpts.emissive = new THREE.Color(0xFF0000); topOpts.emissiveIntensity = 0.6;
            topOpts.color = new THREE.Color(0x330000);
        } else if (type === BLOCK_TYPES.ICE) {
            sideOpts.transparent = true; sideOpts.opacity = 0.9;
            topOpts.transparent = true; topOpts.opacity = 0.9;
            sideOpts.emissive = new THREE.Color(0x00E5FF); sideOpts.emissiveIntensity = 0.5;
            topOpts.emissive = new THREE.Color(0x00E5FF); topOpts.emissiveIntensity = 0.5;
        } else if (type === BLOCK_TYPES.CRUMBLE) {
            sideOpts.emissive = new THREE.Color(0x5D4037); sideOpts.emissiveIntensity = 0.3;
            topOpts.emissive = new THREE.Color(0x5D4037); topOpts.emissiveIntensity = 0.3;
        } else if (type === BLOCK_TYPES.RAINBOW) {
            sideOpts.emissive = new THREE.Color(0xFF00FF); sideOpts.emissiveIntensity = 0.5;
            topOpts.emissive = new THREE.Color(0xFF00FF); topOpts.emissiveIntensity = 0.5;
            topOpts.color = new THREE.Color(0xFF00FF);
        } else if (type === BLOCK_TYPES.DRAGON) {
            sideOpts.emissive = new THREE.Color(0xFF6600); sideOpts.emissiveIntensity = 0.7;
            topOpts.emissive = new THREE.Color(0xFF6600); topOpts.emissiveIntensity = 0.7;
            topOpts.color = new THREE.Color(0xB71C1C);
        } else if (type === BLOCK_TYPES.DIAMOND) {
            sideOpts.emissive = new THREE.Color(0x00BCD4); sideOpts.emissiveIntensity = 0.6;
            topOpts.emissive = new THREE.Color(0x00BCD4); topOpts.emissiveIntensity = 0.6;
            topOpts.color = new THREE.Color(0x00BCD4);
        } else {
            const baseGlow = pattern === 'first_wipe' ? 0.24 : pattern === 'none' ? 0.08 : 0.14;
            sideOpts.emissive = new THREE.Color(color); sideOpts.emissiveIntensity = baseGlow;
            topOpts.emissive = new THREE.Color(color); topOpts.emissiveIntensity = baseGlow;
            if (redTheme) { sideOpts.emissive = new THREE.Color(0xFF4444); sideOpts.emissiveIntensity = 0.2; }
        }
        const side = new THREE.MeshLambertMaterial(sideOpts);
        const top = new THREE.MeshLambertMaterial(topOpts);
        materials = [side, side, top, top, side, side];
        BLOCK_MATERIAL_CACHE.set(cacheKey, materials);
    }

    const mesh = new THREE.Mesh(SHARED_UNIT_BOX_GEO, materials);
    mesh.scale.set(w, h, d);
    mesh.userData = { w, d, blockType: type, sharedGeometry: true, sharedMaterial: true };

    if (glowTexture && type !== BLOCK_TYPES.NORMAL && type !== BLOCK_TYPES.CRUMBLE) {
        const glowColor = BLOCK_GLOW_COLORS[type];
        const isSecret = type === BLOCK_TYPES.RAINBOW || type === BLOCK_TYPES.DRAGON || type === BLOCK_TYPES.DIAMOND;
        const spriteMat = new THREE.SpriteMaterial({
            map: glowTexture, color: glowColor, transparent: true,
            blending: THREE.AdditiveBlending, depthWrite: false, opacity: isSecret ? 0.9 : 0.7
        });
        const sprite = new THREE.Sprite(spriteMat);
        const sc = isSecret ? 7 : 5.5;
        sprite.scale.set(sc / Math.max(0.2, w), sc / Math.max(0.2, h), 1);
        sprite.renderOrder = -1;
        mesh.add(sprite);
        mesh.userData.glowSprite = sprite;
    }
    return mesh;
}

export function disposeMesh(mesh, scene) {
    if (!mesh) return;
    if (mesh.userData?.glowSprite) {
        if (mesh.userData.glowSprite.material) mesh.userData.glowSprite.material.dispose();
        mesh.remove(mesh.userData.glowSprite);
    }
    if (!mesh.userData?.sharedGeometry && mesh.geometry) mesh.geometry.dispose();
    if (!mesh.userData?.sharedMaterial && mesh.material) {
        if (Array.isArray(mesh.material)) mesh.material.forEach(m => m.dispose());
        else mesh.material.dispose();
    }
    if (scene) scene.remove(mesh);
}
