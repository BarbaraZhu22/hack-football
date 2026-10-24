import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Preload } from '@react-three/drei';
import * as THREE from 'three';
import { Pitch } from './Pitch';
import { Actor } from './Actor';
import { Ball } from './Ball';
import { MotionOverlay } from './Overlay';
import { KITS } from './kit';
import { sampleFrame } from '@/lib/incident-simulation';
const BG = '#071210';
const PRESETS = {
    broadcast: { pos: [19.9, 4.2, 7.2], target: [27.55, 0.82, 10.0], fov: 40 },
    touchline: { pos: [22.55, 1.95, 15.05], target: [27.65, 0.82, 10.05], fov: 34 },
    tactical: { pos: [27.25, 11.2, 12.2], target: [27.25, 0.35, 9.85], fov: 36 },
    referee: { pos: [30.7, 1.55, 4.9], target: [27.55, 0.9, 10.3], fov: 37 },
};
function SceneContents({ sim, timeRef, cameraPreset, showSkeleton, showLabels, showTrajectory, showForces, dual, contactView, onReady, }) {
    const { gl, scene, camera, size } = useThree();
    const controls = useRef(null);
    const contactCamera = useMemo(() => {
        const c = new THREE.PerspectiveCamera(34, 360 / 226, 0.04, 80);
        c.position.set(32.4, 1.35, 8.1);
        c.lookAt(new THREE.Vector3(27.7, 0.55, 10.3));
        return c;
    }, []);
    useEffect(() => {
        onReady?.();
        camera.layers.enable(3);
        contactCamera.layers.disable(3);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    useEffect(() => {
        gl.setClearColor(BG);
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.08;
        gl.shadowMap.type = THREE.PCFShadowMap;
    }, [gl]);
    useFrame((_, dt) => {
        if (!(camera instanceof THREE.PerspectiveCamera))
            return;
        if (contactView) {
            camera.position.set(32.4, 1.35, 8.1);
            camera.lookAt(new THREE.Vector3(27.7, 0.55, 10.3));
            camera.fov = 34;
            camera.updateProjectionMatrix();
            return;
        }
        if (cameraPreset === 'free') {
            if (controls.current)
                controls.current.enabled = true;
        }
        else {
            if (controls.current)
                controls.current.enabled = false;
            const p = PRESETS[cameraPreset];
            const k = 1 - Math.exp(-dt * 3.2);
            // Broadcast cameras pan with the action; keep the calibration anchor fixed
            // at the contact frame so the investigative view is reproducible.
            const frame = sampleFrame(sim, timeRef.current);
            const cf = sim.frames[Math.round(sim.contactT * 120)];
            const chasing = timeRef.current < sim.contactT - 0.08;
            const wA = chasing ? 0.58 : 0.5;
            const focusNow = new THREE.Vector3(frame.tackler.x * wA + frame.carrier.x * (1 - wA), 0, frame.tackler.z * wA + frame.carrier.z * (1 - wA));
            const focusContact = new THREE.Vector3((cf.tackler.x + cf.carrier.x) / 2, 0, (cf.tackler.z + cf.carrier.z) / 2);
            const pan = focusNow.sub(focusContact);
            pan.x = THREE.MathUtils.clamp(pan.x, -5.5, 5.5);
            pan.z = THREE.MathUtils.clamp(pan.z, -12.5, 6.5);
            const goalPos = new THREE.Vector3(...p.pos).add(pan);
            const goalTarget = new THREE.Vector3(...p.target).add(pan);
            const sinceContact = THREE.MathUtils.clamp((timeRef.current - sim.contactT) / 1.3, 0, 1);
            goalTarget.y += (0.62 - goalTarget.y) * sinceContact * 0.72;
            if (chasing)
                goalTarget.y += 0.26;
            const separation = Math.hypot(frame.tackler.x - frame.carrier.x, frame.tackler.z - frame.carrier.z);
            const maxPull = cameraPreset === 'touchline' || cameraPreset === 'referee' ? 6.2 : 4.4;
            const pullBack = THREE.MathUtils.clamp((separation - 1.1) * 0.9, 0, maxPull);
            const viewDir = goalPos.clone().sub(goalTarget).normalize();
            goalPos.addScaledVector(viewDir, pullBack);
            camera.position.lerp(goalPos, k);
            camera.lookAt(goalTarget);
            camera.fov += (p.fov - camera.fov) * k;
            camera.updateProjectionMatrix();
            if (controls.current)
                controls.current.target.lerp(goalTarget, k);
        }
        // Reverse-angle contact camera, synchronised to the same clock.
        contactCamera.aspect = 360 / 226;
        contactCamera.position.set(32.4, 1.35, 8.1);
        contactCamera.lookAt(new THREE.Vector3(27.7, 0.55, 10.3));
        contactCamera.updateProjectionMatrix();
    });
    // Custom double-view render: main camera full-frame, contact cam in a PIP.
    useFrame(() => {
        const w = size.width;
        const h = size.height;
        gl.setScissorTest(false);
        gl.setViewport(0, 0, w, h);
        gl.setClearColor(BG, 1);
        gl.clear(true, true, false);
        gl.render(scene, camera);
        if (dual) {
            const iw = 360;
            const ih = 226;
            const x = w - iw - 22;
            const y = 22;
            gl.setScissorTest(true);
            gl.setViewport(x, y, iw, ih);
            gl.setScissor(x, y, iw, ih);
            gl.setClearColor('#06100e', 1);
            gl.clear(true, true, false);
            gl.render(scene, contactCamera);
            gl.setScissorTest(false);
        }
    }, 1);
    return (_jsxs(_Fragment, { children: [_jsx("fogExp2", { attach: "fog", args: ['#071413', 0.0062] }), _jsx("hemisphereLight", { args: ['#cfe7ff', '#0b2a1d', 0.92] }), _jsx("directionalLight", { position: [42, 34, 18], intensity: 3.0, color: "#fff3db", castShadow: true, "shadow-mapSize-width": 2048, "shadow-mapSize-height": 2048, "shadow-camera-left": -28, "shadow-camera-right": 28, "shadow-camera-top": 28, "shadow-camera-bottom": -28, "shadow-camera-near": 1, "shadow-camera-far": 90, "shadow-bias": -0.00025, "shadow-normalBias": 0.035 }), _jsx("directionalLight", { position: [-24, 18, -12], intensity: 1.15, color: "#5bb6ff" }), _jsx("directionalLight", { position: [18, 8, 30], intensity: 0.85, color: "#ffb66e" }), _jsx("spotLight", { position: [34, 22, 8], angle: 0.75, penumbra: 0.85, intensity: 100, color: "#e4f5ff", distance: 80 }), _jsx(Pitch, {}), _jsx(Actor, { sim: sim, timeRef: timeRef, role: "tackler", side: "home", kit: KITS.home, showSkeleton: showSkeleton, showLabels: showLabels }), _jsx(Actor, { sim: sim, timeRef: timeRef, role: "carrier", side: "away", kit: KITS.away, showSkeleton: showSkeleton, showLabels: showLabels }), _jsx(Ball, { sim: sim, timeRef: timeRef }), _jsx(MotionOverlay, { sim: sim, timeRef: timeRef, showForces: showForces, showTrajectory: showTrajectory }), _jsx(OrbitControls, { ref: controls, makeDefault: true, enabled: cameraPreset === 'free', target: [27.35, 0.78, 10.25], enableDamping: true, dampingFactor: 0.06, minDistance: 2.5, maxDistance: 45, maxPolarAngle: Math.PI / 2 - 0.04 }), _jsx(Preload, { all: true })] }));
}
export function Scene({ sim, timeRef, cameraPreset, showSkeleton, showLabels, showTrajectory, showForces, dual, contactView = false, onReady, }) {
    return (_jsx(Canvas, { shadows: "basic", dpr: [1, 2], gl: { antialias: true, alpha: false, powerPreference: 'high-performance', stencil: false }, camera: { position: [19.9, 4.2, 7.2], fov: 40, near: 0.1, far: 360 }, onCreated: ({ gl }) => {
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.toneMappingExposure = 1.08;
        }, children: _jsx(Suspense, { fallback: null, children: _jsx(SceneContents, { sim: sim, timeRef: timeRef, cameraPreset: cameraPreset, showSkeleton: showSkeleton, showLabels: showLabels, showTrajectory: showTrajectory, showForces: showForces, dual: dual, contactView: contactView, onReady: onReady }) }) }));
}
