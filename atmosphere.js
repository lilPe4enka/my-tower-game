// atmosphere.js — 3D-слои атмосферы за башней по мере роста высоты

import * as THREE from 'three';

let atmosphereGroup = null;
let clouds = [];
let starsMesh = null;
let meteors = [];
let spaceObjects = [];
let meteorCooldown = 2.5;

// Размещаем объекты позади башни в изометрической проекции камеры (12, y+12, 12)
function setIsoBackgroundPos(obj, targetY, depth, horiz) {
    obj.position.set(
        -depth + horiz * 0.707,
        targetY - depth,
        -depth - horiz * 0.707
    );
}

function createCloudMesh(scale = 1) {
    const group = new THREE.Group();
    const mat = new THREE.MeshLambertMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.78,
    });
    const puffGeo = new THREE.IcosahedronGeometry(1, 0);

    const offsets = [
        [0, 0, 0, 1.35, 0.72, 1.0],
        [-1.05, -0.15, 0.15, 0.95, 0.58, 0.85],
        [1.05, -0.1, -0.1, 1.0, 0.62, 0.85],
    ];

    offsets.forEach(([x, y, z, sx, sy, sz]) => {
        const m = new THREE.Mesh(puffGeo, mat);
        m.position.set(x, y, z);
        m.scale.set(sx, sy, sz);
        group.add(m);
    });

    group.scale.setScalar(scale);
    return group;
}

function createPlanetMesh(radius, colorHex, withRing = false, ringColorHex = 0xFFE082) {
    const group = new THREE.Group();
    const geo = new THREE.IcosahedronGeometry(radius, 1);
    const mat = new THREE.MeshLambertMaterial({
        color: colorHex,
        emissive: colorHex,
        emissiveIntensity: 0.22,
    });
    const sphere = new THREE.Mesh(geo, mat);
    group.add(sphere);

    if (withRing) {
        const ringGeo = new THREE.RingGeometry(radius * 1.35, radius * 1.95, 24);
        const ringMat = new THREE.MeshBasicMaterial({
            color: ringColorHex,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.75,
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = Math.PI * 0.42;
        ring.rotation.y = 0.25;
        group.add(ring);
    }

    return group;
}

function createSatelliteMesh() {
    const group = new THREE.Group();
    const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.9, 0.6, 0.6),
        new THREE.MeshLambertMaterial({ color: 0xECEFF1, emissive: 0x90A4AE, emissiveIntensity: 0.25 })
    );
    const panelMat = new THREE.MeshBasicMaterial({ color: 0x29B6F6 });
    const leftPanel = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 0.55), panelMat);
    leftPanel.position.x = -1.35;
    const rightPanel = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 0.55), panelMat);
    rightPanel.position.x = 1.35;
    group.add(body, leftPanel, rightPanel);
    return group;
}

export function disposeAtmosphereLayers(scene) {
    if (!atmosphereGroup) return;
    atmosphereGroup.traverse(obj => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
            if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
            else obj.material.dispose();
        }
    });
    if (scene) scene.remove(atmosphereGroup);
    atmosphereGroup = null;
    clouds = [];
    starsMesh = null;
    meteors = [];
    spaceObjects = [];
}

export function initAtmosphereLayers(scene, blockHeight = 0.6, lowPerf = false) {
    disposeAtmosphereLayers(scene);
    if (!scene || lowPerf) return;

    atmosphereGroup = new THREE.Group();
    scene.add(atmosphereGroup);

    // 1. Слой облаков: 10–35 м
    const cloudCount = 10;
    for (let i = 0; i < cloudCount; i++) {
        const meter = 10 + (i / (cloudCount - 1)) * 25 + (Math.random() - 0.5) * 2;
        const depth = 13 + Math.random() * 8;
        const horiz = (Math.random() - 0.5) * 22;
        const cloud = createCloudMesh(0.85 + Math.random() * 0.7);
        setIsoBackgroundPos(cloud, meter * blockHeight, depth, horiz);
        cloud.userData = {
            targetY: meter * blockHeight,
            depth,
            horiz,
            speed: (0.45 + Math.random() * 0.65) * (Math.random() < 0.5 ? 1 : -1),
        };
        atmosphereGroup.add(cloud);
        clouds.push(cloud);
    }

    // 2. Слой звёзд: 40–140 м (плавно появляются на высоте от 40 м)
    const starPositions = [];
    for (let i = 0; i < 140; i++) {
        const meter = 40 + Math.random() * 110;
        const depth = 15 + Math.random() * 12;
        const horiz = (Math.random() - 0.5) * 32;
        starPositions.push(
            -depth + horiz * 0.707,
            meter * blockHeight - depth,
            -depth - horiz * 0.707
        );
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({
        color: 0xFFFFFF,
        size: 0.42,
        transparent: true,
        opacity: 0.85,
    });
    starsMesh = new THREE.Points(starGeo, starMat);
    atmosphereGroup.add(starsMesh);

    // 3. Космический слой: планеты и спутник выше 80 м
    const planetDefs = [
        { meter: 84,  depth: 18, horiz: -7.5, radius: 1.9, color: 0xFF8A65, ring: true,  ringColor: 0xFFE082, rot: 0.35 },
        { meter: 102, depth: 20, horiz: 8.0,  radius: 1.4, color: 0x7E57C2, ring: false, ringColor: 0xFFFFFF, rot: -0.4 },
        { meter: 122, depth: 19, horiz: -6.0, radius: 2.2, color: 0x26C6DA, ring: true,  ringColor: 0xB2EBF2, rot: 0.25 },
    ];
    planetDefs.forEach(p => {
        const mesh = createPlanetMesh(p.radius, p.color, p.ring, p.ringColor);
        setIsoBackgroundPos(mesh, p.meter * blockHeight, p.depth, p.horiz);
        mesh.userData = { rotSpeed: p.rot, isSatellite: false };
        atmosphereGroup.add(mesh);
        spaceObjects.push(mesh);
    });

    // Спутник на ~92 м
    const sat = createSatelliteMesh();
    const satY = 92 * blockHeight;
    setIsoBackgroundPos(sat, satY, 15, -10);
    sat.userData = { isSatellite: true, targetY: satY, depth: 15, horiz: -10, speed: 1.4 };
    atmosphereGroup.add(sat);
    spaceObjects.push(sat);
}

function spawnMeteor(currentMeters, blockHeight) {
    if (!atmosphereGroup) return;
    const geo = new THREE.BoxGeometry(0.14, 0.14, 1.8);
    const mat = new THREE.MeshBasicMaterial({
        color: 0xFFF59D,
        transparent: true,
        opacity: 0.95,
    });
    const mesh = new THREE.Mesh(geo, mat);
    const meter = currentMeters + 4 + Math.random() * 8;
    const depth = 14 + Math.random() * 6;
    const startHoriz = 12 + Math.random() * 5;
    setIsoBackgroundPos(mesh, meter * blockHeight, depth, startHoriz);
    mesh.rotation.set(0.3, -Math.PI / 4, -0.45);
    mesh.userData = {
        life: 1.15,
        horiz: startHoriz,
        targetY: meter * blockHeight,
        depth,
        vx: -14,
        vy: -5.5,
    };
    atmosphereGroup.add(mesh);
    meteors.push(mesh);
}

export function updateAtmosphereLayers(rawDelta, currentMeters, blockHeight = 0.6) {
    if (!atmosphereGroup) return;
    const dt = Math.min(rawDelta, 0.05);

    // Облака медленно плывут по горизонтали
    for (let i = 0; i < clouds.length; i++) {
        const c = clouds[i];
        c.userData.horiz += c.userData.speed * dt;
        if (c.userData.horiz > 16) c.userData.horiz = -16;
        if (c.userData.horiz < -16) c.userData.horiz = 16;
        setIsoBackgroundPos(c, c.userData.targetY, c.userData.depth, c.userData.horiz);
    }

    // Мерцание звёзд
    if (starsMesh && starsMesh.material) {
        starsMesh.material.opacity = 0.65 + Math.sin(performance.now() * 0.0025) * 0.25;
    }

    // Метеоры в зоне 40–75 м
    if (currentMeters >= 38 && currentMeters <= 78) {
        meteorCooldown -= dt;
        if (meteorCooldown <= 0 && meteors.length < 2) {
            spawnMeteor(currentMeters, blockHeight);
            meteorCooldown = 2.6 + Math.random() * 3.0;
        }
    }

    for (let i = meteors.length - 1; i >= 0; i--) {
        const m = meteors[i];
        m.userData.life -= dt;
        m.userData.horiz += m.userData.vx * dt;
        m.userData.targetY += m.userData.vy * dt;
        setIsoBackgroundPos(m, m.userData.targetY, m.userData.depth, m.userData.horiz);
        m.material.opacity = Math.max(0, m.userData.life);
        if (m.userData.life <= 0) {
            m.geometry.dispose();
            m.material.dispose();
            atmosphereGroup.remove(m);
            meteors.splice(i, 1);
        }
    }

    // Вращение планет и полёт спутника
    for (let i = 0; i < spaceObjects.length; i++) {
        const obj = spaceObjects[i];
        if (obj.userData.isSatellite) {
            obj.userData.horiz += obj.userData.speed * dt;
            if (obj.userData.horiz > 15) obj.userData.horiz = -15;
            setIsoBackgroundPos(obj, obj.userData.targetY, obj.userData.depth, obj.userData.horiz);
            obj.rotation.y += 0.5 * dt;
            obj.rotation.z = Math.sin(performance.now() * 0.0015) * 0.15;
        } else {
            obj.rotation.y += obj.userData.rotSpeed * dt;
        }
    }
}
