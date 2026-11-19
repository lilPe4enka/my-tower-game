// environment-particles.js
// Частицы окружения: снег, листья, сакура, звёздная пыль, пузыри, огонь и т.д.

import * as THREE from 'three';

export const ENVIRONMENT_PARTICLES = {
    snow: {
        count: 140,
        size: 0.38,
        color: 0xFFFFFF,
        opacity: 0.85,
        spread: { x: 80, y: 60, z: 80 },
        drift: { x: 0.28, y: -0.95, z: 0.18 },
        twinkle: false,
    },

    leaves: {
        count: 70,
        size: 0.45,
        color: 0xFF9800,
        opacity: 0.78,
        spread: { x: 80, y: 60, z: 80 },
        drift: { x: 0.48, y: -0.72, z: 0.28 },
        colorShift: [0xFF9800, 0xFF6F00, 0xD84315, 0xFFC107],
        twinkle: false,
    },

    sakura: {
        count: 90,
        size: 0.38,
        color: 0xFFB6C1,
        opacity: 0.82,
        spread: { x: 80, y: 60, z: 80 },
        drift: { x: 0.38, y: -0.58, z: 0.25 },
        colorShift: [0xFFB6C1, 0xFFC0CB, 0xFFD1DC, 0xFF69B4],
        twinkle: false,
    },

    stardust: {
        count: 120,
        size: 0.24,
        color: 0xFFD700,
        opacity: 0.85,
        spread: { x: 100, y: 80, z: 100 },
        drift: { x: 0.08, y: -0.06, z: 0.08 },
        colorShift: [0xFFD700, 0xFFFFFF, 0x00FFFF, 0xFF00FF],
        twinkle: true,
    },

    bubbles: {
        count: 65,
        size: 0.42,
        color: 0x87CEEB,
        opacity: 0.55,
        spread: { x: 70, y: 55, z: 70 },
        drift: { x: 0.1, y: 0.58, z: 0.1 },
        colorShift: [0x87CEEB, 0x00CED1, 0xE0FFFF],
        twinkle: true,
    },

    fire: {
        count: 85,
        size: 0.35,
        color: 0xFF4500,
        opacity: 0.75,
        spread: { x: 65, y: 45, z: 65 },
        drift: { x: 0.18, y: 1.25, z: 0.18 },
        colorShift: [0xFF4500, 0xFF6347, 0xFFA500, 0xFFD700],
        twinkle: true,
    },

    aurora: {
        count: 55,
        size: 0.85,
        color: 0x00FF7F,
        opacity: 0.36,
        spread: { x: 100, y: 38, z: 100 },
        drift: { x: 0.25, y: 0.04, z: 0.18 },
        colorShift: [0x00FF7F, 0x00CED1, 0x9370DB, 0x4169E1],
        twinkle: true,
    },

    candy: {
        count: 75,
        size: 0.4,
        color: 0xFF69B4,
        opacity: 0.8,
        spread: { x: 80, y: 60, z: 80 },
        drift: { x: 0.25, y: -0.5, z: 0.2 },
        colorShift: [0xFF69B4, 0xFFD700, 0x00CED1, 0xFF1493, 0x76FF03],
        twinkle: false,
    },

    dust: {
        count: 55,
        size: 0.28,
        color: 0xDEB887,
        opacity: 0.45,
        spread: { x: 85, y: 45, z: 85 },
        drift: { x: 0.35, y: -0.18, z: 0.25 },
        twinkle: false,
    },
};

export const BACKGROUND_PARTICLES_MAP = {
    default: null,
    night: 'stardust',
    sunset: 'dust',
    ocean: 'bubbles',
    city: 'dust',
    space: 'stardust',
    aurora: 'aurora',
    desert: 'dust',
    forest: 'leaves',
    snow: 'snow',
    lava: 'fire',
    cyber: 'stardust',
    sakura: 'sakura',

    volcano: 'fire',
    underwater: 'bubbles',
    aurora_bg: 'aurora',
    candy_land: 'candy',
};

let particleGroup = null;
let currentParticleType = null;
let densityMultiplier = 1;

function randomFrom(array) {
    return array[Math.floor(Math.random() * array.length)];
}

function createParticleData(config, index, count) {
    const x = (Math.random() - 0.5) * config.spread.x;
    const y = (Math.random() - 0.5) * config.spread.y;
    const z = (Math.random() - 0.5) * config.spread.z;

    const vx = (Math.random() - 0.5) * config.drift.x;
    const vy = config.drift.y * (0.55 + Math.random() * 0.75);
    const vz = (Math.random() - 0.5) * config.drift.z;

    const color = config.colorShift ? randomFrom(config.colorShift) : config.color;

    return {
        index,
        count,
        position: new THREE.Vector3(x, y, z),
        velocity: new THREE.Vector3(vx, vy, vz),
        color: new THREE.Color(color),
        baseOpacity: config.opacity,
        twinkleOffset: Math.random() * Math.PI * 2,
        twinkleSpeed: 1 + Math.random() * 2,
    };
}

function createParticleMaterial(config) {
    return new THREE.PointsMaterial({
        size: config.size,
        transparent: true,
        opacity: config.opacity,
        vertexColors: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
    });
}

export function createEnvironmentParticles(scene, particleType, options = {}) {
    removeEnvironmentParticles(scene);

    if (!scene || !particleType || !ENVIRONMENT_PARTICLES[particleType]) {
        currentParticleType = null;
        return null;
    }

    densityMultiplier = options.density ?? 1;

    const baseConfig = ENVIRONMENT_PARTICLES[particleType];
    const config = {
        ...baseConfig,
        count: Math.max(0, Math.floor(baseConfig.count * densityMultiplier)),
    };

    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(config.count * 3);
    const colors = new Float32Array(config.count * 3);

    const particles = [];

    for (let i = 0; i < config.count; i++) {
        const data = createParticleData(config, i, config.count);
        particles.push(data);

        positions[i * 3] = data.position.x;
        positions[i * 3 + 1] = data.position.y;
        positions[i * 3 + 2] = data.position.z;

        colors[i * 3] = data.color.r;
        colors[i * 3 + 1] = data.color.g;
        colors[i * 3 + 2] = data.color.b;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = createParticleMaterial(config);
    const points = new THREE.Points(geometry, material);

    points.frustumCulled = false;
    points.renderOrder = -2;

    particleGroup = points;
    particleGroup.userData.type = particleType;
    particleGroup.userData.config = config;
    particleGroup.userData.particles = particles;

    currentParticleType = particleType;

    scene.add(particleGroup);
    return particleGroup;
}

export function removeEnvironmentParticles(scene) {
    if (!particleGroup) return;

    if (scene) scene.remove(particleGroup);

    if (particleGroup.geometry) {
        particleGroup.geometry.dispose();
    }

    if (particleGroup.material) {
        if (particleGroup.material.map) {
            particleGroup.material.map.dispose();
        }
        particleGroup.material.dispose();
    }

    particleGroup = null;
    currentParticleType = null;
}

function resetParticle(data, config) {
    const halfX = config.spread.x / 2;
    const halfY = config.spread.y / 2;
    const halfZ = config.spread.z / 2;

    data.position.x = (Math.random() - 0.5) * config.spread.x;
    data.position.z = (Math.random() - 0.5) * config.spread.z;

    if (config.drift.y < 0) {
        data.position.y = halfY;
    } else if (config.drift.y > 0) {
        data.position.y = -halfY;
    } else {
        data.position.y = (Math.random() - 0.5) * config.spread.y;
    }

    data.velocity.set(
        (Math.random() - 0.5) * config.drift.x,
        config.drift.y * (0.55 + Math.random() * 0.75),
        (Math.random() - 0.5) * config.drift.z
    );

    // Чтобы частицы не уходили слишком далеко по X/Z
    data.position.x = THREE.MathUtils.clamp(data.position.x, -halfX, halfX);
    data.position.z = THREE.MathUtils.clamp(data.position.z, -halfZ, halfZ);
}

export function updateEnvironmentParticles(deltaTime = 0.016, cameraPosition = null) {
    if (!particleGroup || !currentParticleType) return;

    const config = particleGroup.userData.config;
    const particles = particleGroup.userData.particles;

    const positionAttr = particleGroup.geometry.getAttribute('position');
    const colorAttr = particleGroup.geometry.getAttribute('color');

    const time = performance.now() * 0.001;
    const dt = Math.min(deltaTime, 0.05) * 60;

    const halfX = config.spread.x / 2;
    const halfY = config.spread.y / 2;
    const halfZ = config.spread.z / 2;

    for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        p.position.x += p.velocity.x * dt;
        p.position.y += p.velocity.y * dt;
        p.position.z += p.velocity.z * dt;

        if (
            p.position.y < -halfY ||
            p.position.y > halfY ||
            Math.abs(p.position.x) > halfX ||
            Math.abs(p.position.z) > halfZ
        ) {
            resetParticle(p, config);
        }

        positionAttr.setXYZ(i, p.position.x, p.position.y, p.position.z);

        if (config.twinkle) {
            const twinkle = 0.55 + 0.45 * Math.sin(time * p.twinkleSpeed + p.twinkleOffset);
            colorAttr.setXYZ(
                i,
                p.color.r * twinkle,
                p.color.g * twinkle,
                p.color.b * twinkle
            );
        }
    }

    positionAttr.needsUpdate = true;
    if (config.twinkle) colorAttr.needsUpdate = true;

    // Держим частицы вокруг камеры, но не полностью следуем за ней
    if (cameraPosition) {
        particleGroup.position.x = cameraPosition.x * 0.25;
        particleGroup.position.y = cameraPosition.y - 12;
        particleGroup.position.z = cameraPosition.z * 0.25;
    }
}

export function getParticlesForBackground(backgroundId) {
    return BACKGROUND_PARTICLES_MAP[backgroundId] || null;
}

export function setParticleDensity(multiplier = 1) {
    densityMultiplier = Math.max(0, Math.min(2, multiplier));
    // Пересоздание частиц происходит в game.js через applyBackground()
}

export function getParticleDensity() {
    return densityMultiplier;
}

export function isEnvironmentParticlesActive() {
    return particleGroup !== null;
}

export function getCurrentParticleType() {
    return currentParticleType;
}
