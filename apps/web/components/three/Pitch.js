import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo } from 'react';
import * as THREE from 'three';
import { Stadium } from './Stadium';
function seeded(seed) {
    let s = seed;
    return () => {
        s = (s * 16807) % 2147483647;
        return (s - 1) / 2147483646;
    };
}
function makeGrassTexture() {
    const W = 2048;
    const H = 3072;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const ctx = c.getContext('2d');
    const rand = seeded(7829);
    // Deep, slightly blue evening turf.
    ctx.fillStyle = '#123d27';
    ctx.fillRect(0, 0, W, H);
    const stripe = H / 20;
    for (let i = 0; i < 20; i++) {
        ctx.fillStyle = i % 2 === 0 ? '#16482d' : '#123f28';
        ctx.fillRect(0, i * stripe, W, stripe);
    }
    // Grass grain: short, low-contrast strokes.
    for (let i = 0; i < 46000; i++) {
        const x = rand() * W;
        const y = rand() * H;
        const a = 0.025 + rand() * 0.075;
        ctx.strokeStyle = rand() > 0.5 ? `rgba(122,190,120,${a})` : `rgba(5,35,20,${a})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + rand() * 2 - 1, y - 2 - rand() * 4);
        ctx.stroke();
    }
    // Broad mowing/weather bands.
    ctx.globalCompositeOperation = 'multiply';
    for (let i = 0; i < 9; i++) {
        const x = rand() * W;
        const y = rand() * H;
        const r = 100 + rand() * 300;
        const grd = ctx.createRadialGradient(x, y, 0, x, y, r);
        grd.addColorStop(0, 'rgba(23,55,35,0.18)');
        grd.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    // Pitch markings, drawn in metres then converted.
    const ppmX = W / 68;
    const ppmZ = H / 105;
    const mx = (x) => (x / 68) * W;
    const mz = (z) => ((z + 52.5) / 105) * H;
    ctx.strokeStyle = 'rgba(248,250,242,0.92)';
    ctx.fillStyle = 'rgba(248,250,242,0.92)';
    ctx.lineWidth = Math.max(3, 0.12 * ppmX);
    ctx.lineCap = 'round';
    const box = (x, z, w, d) => ctx.strokeRect(mx(x), mz(z), w * ppmX, d * ppmZ);
    // touchlines and goal lines
    ctx.strokeRect(mx(0.14), mz(-52.36), 67.72 * ppmX, 104.72 * ppmZ);
    // halfway
    ctx.beginPath();
    ctx.moveTo(mx(0.14), mz(0));
    ctx.lineTo(mx(67.86), mz(0));
    ctx.stroke();
    // centre circle and spot
    ctx.beginPath();
    ctx.ellipse(mx(34), mz(0), 9.15 * ppmX, 9.15 * ppmZ, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(mx(34), mz(0), 0.18 * ppmX, 0, Math.PI * 2);
    ctx.fill();
    // both ends
    for (const dir of [-1, 1]) {
        const goalZ = dir === -1 ? -52.5 : 52.5;
        const sixteenZ = dir === -1 ? -52.5 : 36.0;
        const sixZ = dir === -1 ? -52.5 : 47.0;
        box(13.84, sixteenZ, 40.32, 16.5);
        box(24.84, sixZ, 18.32, 5.5);
        // penalty spot
        const spotZ = goalZ - dir * 11;
        ctx.beginPath();
        ctx.arc(mx(34), mz(spotZ), 0.17 * ppmX, 0, Math.PI * 2);
        ctx.fill();
        // penalty arc clipped visually by drawing only outside the box
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, W, H);
        if (dir === 1)
            ctx.rect(mx(13.84), mz(36.0), 40.32 * ppmX, 16.5 * ppmZ);
        else
            ctx.rect(mx(13.84), 0, 40.32 * ppmX, 16.5 * ppmZ);
        ctx.clip('evenodd');
        ctx.beginPath();
        ctx.ellipse(mx(34), mz(spotZ), 9.15 * ppmX, 9.15 * ppmZ, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        // goal itself
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        ctx.lineWidth = Math.max(2, 0.1 * ppmX);
        ctx.strokeRect(mx(30.34), mz(goalZ - dir * 0.1), 7.32 * ppmX, dir * 2 * ppmZ);
        ctx.restore();
    }
    // corner arcs
    for (const [x, z, a] of [
        [0, -52.5, 0],
        [68, -52.5, Math.PI / 2],
        [68, 52.5, Math.PI],
        [0, 52.5, -Math.PI / 2],
    ]) {
        ctx.beginPath();
        ctx.arc(mx(x), mz(z), 1 * ppmX, a, a + Math.PI / 2);
        ctx.stroke();
    }
    // wear near the technical areas and incident zone
    ctx.globalCompositeOperation = 'multiply';
    for (const [x, z, r] of [
        [27.5, 9.7, 3.2],
        [4, 0, 2.6],
        [34, -40, 3.6],
    ]) {
        const g = ctx.createRadialGradient(mx(x), mz(z), 0, mx(x), mz(z), r * ppmX);
        g.addColorStop(0, 'rgba(112,92,55,0.34)');
        g.addColorStop(0.55, 'rgba(150,126,80,0.15)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(mx(x), mz(z), r * ppmX, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
}
function makeGrassNormal() {
    const N = 256;
    const c = document.createElement('canvas');
    c.width = c.height = N;
    const ctx = c.getContext('2d');
    const rand = seeded(119);
    ctx.fillStyle = 'rgb(128,128,255)';
    ctx.fillRect(0, 0, N, N);
    for (let i = 0; i < 9000; i++) {
        const x = rand() * N;
        const y = rand() * N;
        const v = 118 + Math.floor(rand() * 20);
        ctx.fillStyle = `rgba(${v},${v},255,0.42)`;
        ctx.fillRect(x, y, 1, 1 + rand() * 2);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(90, 140);
    tex.anisotropy = 4;
    return tex;
}
export function makeCrowdTexture() {
    const W = 2048;
    const H = 512;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const ctx = c.getContext('2d');
    const rand = seeded(612);
    ctx.fillStyle = '#172326';
    ctx.fillRect(0, 0, W, H);
    // concourse aisles
    for (let i = 0; i < 9; i++) {
        ctx.fillStyle = '#141f24';
        ctx.fillRect((i / 9) * W, 0, 18, H);
    }
    const palette = ['#d9e4ea', '#2b4a66', '#8a1d26', '#e0c25e', '#4a5d61', '#102432', '#a6bfcb'];
    for (let row = 0; row < 36; row++) {
        const y = 8 + row * 14;
        for (let i = 0; i < 330; i++) {
            const x = rand() * W;
            ctx.fillStyle = palette[Math.floor(rand() * palette.length)];
            ctx.globalAlpha = 0.45 + rand() * 0.55;
            ctx.fillRect(x, y + rand() * 4, 3 + rand() * 3, 3 + rand() * 4);
        }
    }
    ctx.globalAlpha = 1;
    const grd = ctx.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, 'rgba(5,12,16,0.6)');
    grd.addColorStop(0.5, 'rgba(5,12,16,0.04)');
    grd.addColorStop(1, 'rgba(5,12,16,0.72)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, W, H);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.repeat.set(2.4, 1);
    tex.anisotropy = 4;
    return tex;
}
export function makeCrowdRowTexture() {
    const W = 2048;
    const H = 128;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const ctx = c.getContext('2d');
    const rand = seeded(9451);
    const palette = ['#e7edf0', '#397ca8', '#153e61', '#c53c44', '#d1b35d', '#8fb1c0', '#202f3c'];

    // A transparent seated-crowd strip sized for the visible riser of each row.
    for (let i = 0; i < 72; i++) {
        const x = (i + 0.5) * W / 72 + (rand() - 0.5) * 9;
        const baseY = 119 + rand() * 8;
        const bodyColor = palette[Math.floor(rand() * palette.length)];
        const skinColor = rand() > 0.5 ? '#c99472' : '#e0b08b';
        const bodyWidth = 18 + rand() * 8;
        const bodyHeight = 43 + rand() * 14;

        ctx.globalAlpha = 0.82 + rand() * 0.18;
        ctx.fillStyle = bodyColor;
        ctx.beginPath();
        ctx.moveTo(x - bodyWidth * 0.72, baseY - bodyHeight + 18);
        ctx.quadraticCurveTo(x, baseY - bodyHeight - 2, x + bodyWidth * 0.72, baseY - bodyHeight + 18);
        ctx.lineTo(x + bodyWidth * 0.58, baseY - 3);
        ctx.lineTo(x - bodyWidth * 0.58, baseY - 3);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = skinColor;
        ctx.beginPath();
        ctx.arc(x + (rand() - 0.5) * 3, baseY - bodyHeight + 10, 7 + rand() * 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(7,13,18,0.34)';
        ctx.fillRect(x - bodyWidth * 0.55, baseY - 2, bodyWidth * 1.1, 4);
    }
    ctx.globalAlpha = 1;

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.anisotropy = 8;
    return tex;
}
function makeAdTexture() {
    const W = 2048;
    const H = 160;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const ctx = c.getContext('2d');
    const boards = [
        ['#092430', '#bfe4ee', 'PREMIER LEAGUE'],
        ['#13272c', '#dce9df', 'ETIHAD'],
        ['#0b1e21', '#8fdac0', 'MATCH REVIEW'],
        ['#65171c', '#f1e8d6', 'NO ROOM FOR RACISM'],
        ['#0d2020', '#b9d6c7', 'SKELE·TRACK'],
    ];
    const w = W / boards.length;
    boards.forEach(([bg, fg, text], i) => {
        ctx.fillStyle = bg;
        ctx.fillRect(i * w, 0, w + 2, H);
        ctx.fillStyle = fg;
        ctx.font = '700 58px Inter, Helvetica, Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, i * w + w / 2, H / 2 + 2);
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        ctx.fillRect(i * w, 0, 2, H);
    });
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.anisotropy = 8;
    return tex;
}
function makeRibbonTexture() {
    const W = 2048;
    const H = 96;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#071615';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#9af0d2';
    ctx.font = '600 38px IBM Plex Mono, monospace';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < 5; i++) {
        ctx.globalAlpha = 0.72;
        ctx.fillText(i % 2 === 0 ? 'PREMIER LEAGUE  ·  MATCH REVIEW' : 'MCI 2 — 1 ARS  ·  78:32', 24 + i * 420, H / 2);
    }
    ctx.globalAlpha = 1;
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.repeat.set(1.5, 1);
    return tex;
}
function makeScreenTexture() {
    const W = 1024;
    const H = 512;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#071917');
    g.addColorStop(1, '#0c2523');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(169,241,215,.18)';
    ctx.lineWidth = 3;
    ctx.strokeRect(18, 18, W - 36, H - 36);
    ctx.fillStyle = '#95b9ab';
    ctx.font = '500 28px IBM Plex Mono, monospace';
    ctx.fillText('PREMIER LEAGUE · MATCH CENTRE', 50, 76);
    ctx.fillStyle = '#e8f5ee';
    ctx.font = '700 94px Inter, Helvetica, Arial, sans-serif';
    ctx.fillText('MCI', 60, 226);
    ctx.fillStyle = '#a7f4d4';
    ctx.fillText('2 : 1', 300, 226);
    ctx.fillStyle = '#ff7f73';
    ctx.fillText('ARS', 610, 226);
    ctx.fillStyle = '#96a9a0';
    ctx.font = '500 28px IBM Plex Mono, monospace';
    ctx.fillText('78:32  ·  SECOND HALF  ·  VAR CHECK', 62, 306);
    ctx.fillStyle = 'rgba(183,244,212,.12)';
    ctx.fillRect(50, 352, W - 100, 2);
    ctx.fillStyle = '#d7e8de';
    ctx.font = '500 25px IBM Plex Mono, monospace';
    ctx.fillText('INCIDENT REVIEW  ·  SERIOUS FOUL PLAY', 62, 410);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}
function Goal({ z, dir }) {
    const posts = useMemo(() => {
        const x0 = -3.66;
        const x1 = 3.66;
        const h = 2.44;
        return { x0, x1, h };
    }, []);
    const mat = new THREE.MeshStandardMaterial({ color: '#edf7f1', roughness: 0.4, metalness: 0.25 });
    return (_jsxs("group", { position: [0, 0, z], children: [[posts.x0, posts.x1].map((x) => (_jsx("mesh", { position: [x, posts.h / 2, 0], material: mat, castShadow: true, children: _jsx("cylinderGeometry", { args: [0.06, 0.06, posts.h, 10] }) }, x))), _jsx("mesh", { position: [0, posts.h, 0], rotation: [0, 0, Math.PI / 2], material: mat, castShadow: true, children: _jsx("cylinderGeometry", { args: [0.06, 0.06, 7.32, 10] }) }), _jsxs("mesh", { position: [0, 1.22, -dir * 0.9], rotation: [0, 0, 0], children: [_jsx("planeGeometry", { args: [7.2, 2.3] }), _jsx("meshBasicMaterial", { color: "#9eb9b2", transparent: true, opacity: 0.14, side: THREE.DoubleSide })] })] }));
}
export function Pitch() {
    const grass = useMemo(makeGrassTexture, []);
    const normal = useMemo(makeGrassNormal, []);
    const crowd = useMemo(makeCrowdTexture, []);
    const crowdRows = useMemo(makeCrowdRowTexture, []);
    const ads = useMemo(makeAdTexture, []);
    const ribbon = useMemo(makeRibbonTexture, []);
    const screenTex = useMemo(makeScreenTexture, []);
    return _jsxs("group", {
        children: [
            _jsxs("mesh", {
                rotation: [-Math.PI / 2, 0, 0],
                receiveShadow: true,
                children: [
                    _jsx("planeGeometry", { args: [68, 105] }),
                    _jsx("meshStandardMaterial", {
                        map: grass,
                        normalMap: normal,
                        normalScale: new THREE.Vector2(0.42, 0.42),
                        roughness: 0.93,
                        metalness: 0.0,
                        color: "#d6e9d9",
                    }),
                ],
            }),
            _jsxs("mesh", {
                rotation: [-Math.PI / 2, 0, 0],
                position: [0, -0.02, 0],
                receiveShadow: true,
                children: [
                    _jsx("planeGeometry", { args: [184, 202] }),
                    _jsx("meshStandardMaterial", { color: "#0b241a", roughness: 1 }),
                ],
            }),
            _jsx(Goal, { z: -52.3, dir: -1 }),
            _jsx(Goal, { z: 52.3, dir: 1 }),
            _jsx(Stadium, { crowd, crowdRows, ads, ribbon, screenTex }),
        ],
    });
}
