import { jsx as _jsx } from "react/jsx-runtime";
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { sampleFrame } from '@/lib/incident-simulation';
import { sampleOffsideFrame } from '@/lib/offside-simulation';
function makeBallTexture() {
    const W = 1024;
    const H = 512;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const ctx = c.getContext('2d');
    const grd = ctx.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, '#f9fbf6');
    grd.addColorStop(0.55, '#eef2e9');
    grd.addColorStop(1, '#dfe7dc');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, W, H);
    const rand = (() => {
        let s = 91;
        return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
    })();
    // pentagon panels, staggered in UV space
    const pent = (cx, cy, r, rot = 0) => {
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
            const a = rot + (i / 5) * Math.PI * 2 - Math.PI / 2;
            const x = cx + Math.cos(a) * r;
            const y = cy + Math.sin(a) * r * 0.82;
            if (i === 0)
                ctx.moveTo(x, y);
            else
                ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fillStyle = '#111815';
        ctx.fill();
        ctx.strokeStyle = 'rgba(30,44,38,0.7)';
        ctx.lineWidth = 7;
        ctx.stroke();
    };
    for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 6; col++) {
            const x = (col + (row % 2) * 0.5) * (W / 6) + W / 12;
            const y = (row + 0.5) * (H / 3);
            if (rand() > 0.15)
                pent(x, y, 56 + rand() * 8, rand() * Math.PI);
        }
    }
    // seams
    ctx.strokeStyle = 'rgba(91,110,99,0.34)';
    ctx.lineWidth = 4;
    for (let i = 0; i < 14; i++) {
        ctx.beginPath();
        ctx.ellipse(W / 2, H / 2, 50 + i * 34, 38 + i * 22, 0.4, 0, Math.PI * 2);
        ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
}
export function Ball({ sim, timeRef, offset = [0, 0, 0], offsideBallRef }) {
    const mesh = useRef(null);
    const sampledFrameRef = useRef({});
    const lastFrameRef = useRef({ sim: null, time: Number.NaN });
    const spinScratch = useMemo(() => ({ quaternion: new THREE.Quaternion(), euler: new THREE.Euler() }), []);
    const tex = useMemo(makeBallTexture, []);
    const mat = useMemo(() => new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 0.34,
        metalness: 0.02,
        envMapIntensity: 0.6,
    }), [tex]);
    useFrame((_, delta) => {
        if (!mesh.current)
            return;
        const time = timeRef.current;
        if (lastFrameRef.current.sim === sim && lastFrameRef.current.time === time)
            return;
        lastFrameRef.current.sim = sim;
        lastFrameRef.current.time = time;
        if (sim.kind === 'offside' && offsideBallRef?.current) {
            const state = offsideBallRef.current;
            const position = state.position;
            mesh.current.position.set(position.x + offset[0], position.y + offset[1], position.z + offset[2]);
            return;
        }
        const f = sim.kind === 'offside'
            ? sampleOffsideFrame(sim, time, sampledFrameRef.current)
            : sampleFrame(sim, time, sampledFrameRef.current);
        const b = f.ball;
        mesh.current.position.set(b.p.x + offset[0], b.p.y + offset[1], b.p.z + offset[2]);
        const spin = spinScratch.quaternion.setFromEuler(spinScratch.euler.set(-b.v.z * delta * 1.8, b.v.x * delta * 0.35, b.v.x * delta * 1.15));
        mesh.current.quaternion.premultiply(spin);
    });
    return (_jsx("mesh", { ref: mesh, castShadow: true, receiveShadow: true, material: mat, children: _jsx("sphereGeometry", { args: [0.11, 40, 28] }) }));
}
