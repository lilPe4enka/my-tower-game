// postprocessing.js — эффекты пост-обработки (bloom, vignette, chromatic aberration)

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// ============ КАСТОМНЫЙ ШЕЙДЕР VIGNETTE ============
const VignetteShader = {
    uniforms: {
        'tDiffuse': { value: null },
        'offset': { value: 1.0 },
        'darkness': { value: 1.2 },
    },
    vertexShader: /* glsl */`
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: /* glsl */`
        uniform sampler2D tDiffuse;
        uniform float offset;
        uniform float darkness;
        varying vec2 vUv;
        void main() {
            vec4 texel = texture2D(tDiffuse, vUv);
            vec2 uv = (vUv - vec2(0.5)) * vec2(offset);
            float vignette = 1.0 - dot(uv, uv);
            texel.rgb *= smoothstep(0.8, offset * 0.5, vignette * darkness);
            gl_FragColor = texel;
        }
    `,
};

// ============ КАСТОМНЫЙ ШЕЙДЕР ХРОМАТИЧЕСКОЙ АБЕРРАЦИИ ============
const ChromaticAberrationShader = {
    uniforms: {
        'tDiffuse': { value: null },
        'amount': { value: 0.003 },
        'angle': { value: 0.0 },
    },
    vertexShader: /* glsl */`
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: /* glsl */`
        uniform sampler2D tDiffuse;
        uniform float amount;
        uniform float angle;
        varying vec2 vUv;
        void main() {
            vec2 offset = amount * vec2(cos(angle), sin(angle));
            float r = texture2D(tDiffuse, vUv + offset).r;
            float g = texture2D(tDiffuse, vUv).g;
            float b = texture2D(tDiffuse, vUv - offset).b;
            gl_FragColor = vec4(r, g, b, 1.0);
        }
    `,
};

// ============ КОНФИГУРАЦИЯ КАЧЕСТВА ============
export const QUALITY_PRESETS = {
    low: {
        bloom: { strength: 0.3, radius: 0.3, threshold: 0.9 },
        vignette: { offset: 1.0, darkness: 0.8 },
        chromatic: { amount: 0.0 },
        pixelRatio: 1,
    },
    medium: {
        bloom: { strength: 0.5, radius: 0.4, threshold: 0.85 },
        vignette: { offset: 1.0, darkness: 1.0 },
        chromatic: { amount: 0.0015 },
        pixelRatio: 1.5,
    },
    high: {
        bloom: { strength: 0.7, radius: 0.5, threshold: 0.8 },
        vignette: { offset: 1.0, darkness: 1.2 },
        chromatic: { amount: 0.003 },
        pixelRatio: 2,
    },
    ultra: {
        bloom: { strength: 0.9, radius: 0.6, threshold: 0.75 },
        vignette: { offset: 1.0, darkness: 1.4 },
        chromatic: { amount: 0.005 },
        pixelRatio: Math.min(window.devicePixelRatio, 2),
    },
};

// ============ СОСТОЯНИЕ ============
let composer = null;
let bloomPass = null;
let vignettePass = null;
let chromaticPass = null;
let currentQuality = 'high';
let isMobile = false;
let postProcessingEnabled = true;

// ============ ОПРЕДЕЛЕНИЕ МОБИЛЬНОГО УСТРОЙСТВА ============
function detectMobile() {
    const ua = navigator.userAgent || navigator.vendor || window.opera;
    const isMobileUA = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua.toLowerCase());
    const isSmallScreen = window.innerWidth < 768;
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    return isMobileUA || (isSmallScreen && isTouchDevice);
}

// ============ ИНИЦИАЛИЗАЦИЯ ============
export function initPostProcessing(renderer, scene, camera) {
    isMobile = detectMobile();
    
    if (isMobile) {
        currentQuality = 'medium';
    }
    
    try {
        composer = new EffectComposer(renderer);
        
        const renderPass = new RenderPass(scene, camera);
        composer.addPass(renderPass);
        
        const preset = QUALITY_PRESETS[currentQuality];
        bloomPass = new UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            preset.bloom.strength,
            preset.bloom.radius,
            preset.bloom.threshold
        );
        composer.addPass(bloomPass);
        
        vignettePass = new ShaderPass(VignetteShader);
        vignettePass.uniforms['offset'].value = preset.vignette.offset;
        vignettePass.uniforms['darkness'].value = preset.vignette.darkness;
        composer.addPass(vignettePass);
        
        if (!isMobile || currentQuality === 'high' || currentQuality === 'ultra') {
            chromaticPass = new ShaderPass(ChromaticAberrationShader);
            chromaticPass.uniforms['amount'].value = preset.chromatic.amount;
            composer.addPass(chromaticPass);
        }
        
        const outputPass = new OutputPass();
        composer.addPass(outputPass);
        
        composer.setPixelRatio(preset.pixelRatio);
        
        postProcessingEnabled = true;
        console.log(`[PostProcessing] Initialized with quality: ${currentQuality}, mobile: ${isMobile}`);
        
        return composer;
    } catch (err) {
        console.warn('[PostProcessing] Failed to initialize, falling back to direct rendering:', err);
        postProcessingEnabled = false;
        return null;
    }
}

// ============ РЕНДЕРИНГ ============
export function renderWithPostProcessing() {
    if (postProcessingEnabled && composer) {
        composer.render();
    }
}

// ============ УПРАВЛЕНИЕ КАЧЕСТВОМ ============
export function setQuality(quality) {
    if (!QUALITY_PRESETS[quality]) {
        console.warn(`[PostProcessing] Unknown quality preset: ${quality}`);
        return;
    }
    
    currentQuality = quality;
    const preset = QUALITY_PRESETS[quality];
    
    if (bloomPass) {
        bloomPass.strength = preset.bloom.strength;
        bloomPass.radius = preset.bloom.radius;
        bloomPass.threshold = preset.bloom.threshold;
    }
    
    if (vignettePass) {
        vignettePass.uniforms['offset'].value = preset.vignette.offset;
        vignettePass.uniforms['darkness'].value = preset.vignette.darkness;
    }
    
    if (chromaticPass) {
        chromaticPass.uniforms['amount'].value = preset.chromatic.amount;
    }
    
    if (composer) {
        composer.setPixelRatio(preset.pixelRatio);
    }
    
    console.log(`[PostProcessing] Quality set to: ${quality}`);
}

export function getQuality() {
    return currentQuality;
}

export function getAvailableQualities() {
    return Object.keys(QUALITY_PRESETS);
}

// ============ ВКЛ/ВЫКЛ ЭФФЕКТОВ ============
export function setBloomEnabled(enabled) {
    if (bloomPass) bloomPass.enabled = enabled;
}

export function setVignetteEnabled(enabled) {
    if (vignettePass) vignettePass.enabled = enabled;
}

export function setChromaticEnabled(enabled) {
    if (chromaticPass) chromaticPass.enabled = enabled;
}

export function setPostProcessingEnabled(enabled) {
    postProcessingEnabled = enabled;
}

export function isPostProcessingEnabled() {
    return postProcessingEnabled;
}

// ============ ДИНАМИЧЕСКИЕ ЭФФЕКТЫ ============
export function setFuryBloom(active) {
    if (!bloomPass) return;
    const preset = QUALITY_PRESETS[currentQuality];
    if (active) {
        bloomPass.strength = preset.bloom.strength * 1.8;
        bloomPass.threshold = preset.bloom.threshold * 0.7;
    } else {
        bloomPass.strength = preset.bloom.strength;
        bloomPass.threshold = preset.bloom.threshold;
    }
}

export function setShakeChromatic(intensity) {
    if (!chromaticPass) return;
    const preset = QUALITY_PRESETS[currentQuality];
    chromaticPass.uniforms['amount'].value = preset.chromatic.amount + intensity * 0.01;
}

export function setGameOverVignette(active) {
    if (!vignettePass) return;
    const preset = QUALITY_PRESETS[currentQuality];
    if (active) {
        vignettePass.uniforms['darkness'].value = preset.vignette.darkness * 1.8;
    } else {
        vignettePass.uniforms['darkness'].value = preset.vignette.darkness;
    }
}

// ============ ОБНОВЛЕНИЕ РАЗМЕРОВ ============
export function resizePostProcessing(width, height) {
    if (composer) {
        composer.setSize(width, height);
    }
    if (bloomPass) {
        bloomPass.setSize(width, height);
    }
}

// ============ АДАПТИВНОЕ КАЧЕСТВО ============
let fpsHistory = [];
let lastQualityCheck = 0;
const QUALITY_CHECK_INTERVAL = 3000;

export function adaptiveQualityCheck(currentFps) {
    const now = performance.now();
    if (now - lastQualityCheck < QUALITY_CHECK_INTERVAL) return;
    lastQualityCheck = now;
    
    fpsHistory.push(currentFps);
    if (fpsHistory.length > 5) fpsHistory.shift();
    
    const avgFps = fpsHistory.reduce((a, b) => a + b, 0) / fpsHistory.length;
    
    if (avgFps < 25 && currentQuality !== 'low') {
        const qualities = ['ultra', 'high', 'medium', 'low'];
        const currentIndex = qualities.indexOf(currentQuality);
        if (currentIndex < qualities.length - 1) {
            const newQuality = qualities[currentIndex + 1];
            console.warn(`[PostProcessing] Low FPS (${avgFps.toFixed(1)}), downgrading to ${newQuality}`);
            setQuality(newQuality);
        }
    } else if (avgFps > 55 && currentQuality !== 'ultra' && !isMobile) {
        const qualities = ['low', 'medium', 'high', 'ultra'];
        const currentIndex = qualities.indexOf(currentQuality);
        if (currentIndex > 0) {
            const newQuality = qualities[currentIndex - 1];
            console.log(`[PostProcessing] High FPS (${avgFps.toFixed(1)}), upgrading to ${newQuality}`);
            setQuality(newQuality);
        }
    }
}

// ============ УТИЛИТЫ ============
export function isMobileDevice() {
    return isMobile;
}

export function disposePostProcessing() {
    if (composer) {
        composer.passes.forEach(pass => {
            if (pass.dispose) pass.dispose();
        });
        composer = null;
    }
    bloomPass = null;
    vignettePass = null;
    chromaticPass = null;
    postProcessingEnabled = false;
}
