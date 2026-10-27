import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Preload } from '@react-three/drei';
import * as THREE from 'three';
import { Pitch } from './Pitch';
import { Actor } from './Actor';
import { Ball } from './Ball';
import { MotionOverlay } from './Overlay';
import { OffsideActor } from './OffsideActor';
import { OffsideMotionOverlay } from './OffsideMotionOverlay';
import { KITS } from './kit';
import { sampleFrame } from '@/lib/incident-simulation';
import { sampleOffsideFrame } from '@/lib/offside-simulation';
const BG = '#071210';
const PRESETS = {
    broadcast: { pos: [19.9, 4.2, 7.2], target: [27.55, 0.82, 10.0], fov: 40 },
    touchline: { pos: [22.55, 1.95, 15.05], target: [27.65, 0.82, 10.05], fov: 34 },
    tactical: { pos: [27.25, 11.2, 12.2], target: [27.25, 0.35, 9.85], fov: 36 },
    referee: { pos: [30.7, 1.55, 4.9], target: [27.55, 0.9, 10.3], fov: 37 },
};
function OffsideLine({ sim, timeRef, lineRef }) {
    const projection = useRef(null);
    useFrame(() => {
        if (projection.current) {
            projection.current.visible = timeRef.current >= sim.contactT;
            projection.current.position.z = lineRef?.current?.z ?? sim.offside.lineZ;
        }
    });
    return (_jsxs('group', { ref: projection, position: [0, 0, sim.offside.lineZ], children: [
            _jsxs('mesh', { position: [0, 0.075, 0], children: [_jsx('boxGeometry', { args: [68, 0.1, 0.15] }), _jsx('meshBasicMaterial', { color: '#41320d', toneMapped: false })] }),
            _jsxs('mesh', { position: [0, 0.09, 0], children: [_jsx('boxGeometry', { args: [68, 0.035, 0.085] }), _jsx('meshBasicMaterial', { color: '#ffe071', toneMapped: false })] }),
            _jsxs('mesh', { position: [0, 4.75, 0], receiveShadow: false, renderOrder: 3, children: [_jsx('planeGeometry', { args: [68, 9.5] }), _jsx('meshBasicMaterial', { color: '#ffd45e', transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false, toneMapped: false })] }),
        ] }));
}
function SceneContents({ sim, timeRef, cameraPreset, showSkeleton, showLabels, showTrajectory, showForces, dual, contactView, onReady, }) {
    const { gl, scene, camera, size } = useThree();
    const controls = useRef(null);
    const hasReportedFirstFrame = useRef(false);
    const liveFrameRef = useRef({});
    const contactFrameRef = useRef({});
    const reverseFrameRef = useRef({});
    const cameraVectors = useMemo(() => ({
        lookAt: new THREE.Vector3(),
        target: new THREE.Vector3(),
        position: new THREE.Vector3(),
        varTarget: new THREE.Vector3(),
        varPosition: new THREE.Vector3(),
        focusNow: new THREE.Vector3(),
        focusContact: new THREE.Vector3(),
        pan: new THREE.Vector3(),
        anchorShift: new THREE.Vector3(),
        goalPos: new THREE.Vector3(),
        goalTarget: new THREE.Vector3(),
        viewDir: new THREE.Vector3(),
    }), []);
    const isOffside = sim.kind === 'offside';
    const offsideLineRef = useRef(null);
    const offsideBallRef = useRef(null);
    const offsideCameraRef = useRef(null);
    if (isOffside && offsideLineRef.current?.sim !== sim) {
        offsideLineRef.current = { sim, z: sim.offside.lineZ };
        offsideCameraRef.current = {
            sim,
            contactWallTime: null,
            startPosition: null,
            startTarget: null,
            startFov: 30,
        };
        offsideBallRef.current = {
            sim,
            position: new THREE.Vector3(-0.2, 0.12, 0),
            previousPosition: new THREE.Vector3(),
            previousKickPosition: new THREE.Vector3(),
            previousTime: null,
            velocity: new THREE.Vector3(),
            footVelocity: new THREE.Vector3(),
            contactPosition: new THREE.Vector3(),
            releaseVelocity: new THREE.Vector3(),
            impulseNormal: new THREE.Vector3(0, 0.12, 1).normalize(),
            impulse: new THREE.Vector3(),
            impulseMagnitude: 0,
            closingSpeed: 0,
            contactDuration: 0.012,
            averageForce: 0,
            released: false,
        };
    }
    const contactCamera = useMemo(() => {
        const c = new THREE.PerspectiveCamera(34, 360 / 226, 0.04, 80);
        c.position.set(32.4, 1.35, 8.1);
        c.lookAt(new THREE.Vector3(27.7, 0.55, 10.3));
        return c;
    }, []);
    useEffect(() => {
        camera.layers.enable(3);
        contactCamera.layers.disable(3);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    useEffect(() => {
        gl.setClearColor(BG);
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.08;
        gl.shadowMap.enabled = !contactView;
        gl.shadowMap.type = THREE.PCFShadowMap;
    }, [contactView, gl]);
    useFrame((_, dt) => {
        if (!(camera instanceof THREE.PerspectiveCamera))
            return;
        if (contactView) {
            if (isOffside) {
                const frame = sampleOffsideFrame(sim, timeRef.current, liveFrameRef.current);
                const focusX = (frame.receiver.x + frame.defender.x) / 2;
                const focusZ = (frame.passer.z + frame.receiver.z + frame.defender.z) / 3;
                camera.position.set(focusX + 17, 5, focusZ - 8);
                camera.lookAt(cameraVectors.lookAt.set(focusX, 1.15, focusZ));
                camera.fov = 30;
            }
            else {
                camera.position.set(32.4, 1.35, 8.1);
                camera.lookAt(cameraVectors.lookAt.set(27.7, 0.55, 10.3));
                camera.fov = 34;
            }
            camera.updateProjectionMatrix();
            return;
        }
        if (cameraPreset === 'free') {
            const orbit = controls.current;
            if (orbit) {
                orbit.enabled = true;
                const target = orbit.target;
                const minX = -33;
                const maxX = 33;
                const minZ = -51.5;
                const maxZ = 51.5;
                const targetInset = orbit.minDistance + 0.1;
                target.x = THREE.MathUtils.clamp(target.x, minX + targetInset, maxX - targetInset);
                target.z = THREE.MathUtils.clamp(target.z, minZ + targetInset, maxZ - targetInset);

                const offsetX = camera.position.x - target.x;
                const offsetZ = camera.position.z - target.z;
                const horizontalDistance = Math.hypot(offsetX, offsetZ);
                const radius = Math.max(camera.position.distanceTo(target), 1e-6);
                const dirX = horizontalDistance > 1e-6 ? offsetX / horizontalDistance : 0;
                const dirZ = horizontalDistance > 1e-6 ? offsetZ / horizontalDistance : 0;
                let maxHorizontalDistance = Infinity;
                if (dirX > 1e-6)
                    maxHorizontalDistance = Math.min(maxHorizontalDistance, (maxX - target.x) / dirX);
                else if (dirX < -1e-6)
                    maxHorizontalDistance = Math.min(maxHorizontalDistance, (minX - target.x) / dirX);
                if (dirZ > 1e-6)
                    maxHorizontalDistance = Math.min(maxHorizontalDistance, (maxZ - target.z) / dirZ);
                else if (dirZ < -1e-6)
                    maxHorizontalDistance = Math.min(maxHorizontalDistance, (minZ - target.z) / dirZ);

                const horizontalRatio = horizontalDistance / radius;
                const fieldMaxDistance = horizontalRatio > 1e-6
                    ? maxHorizontalDistance / horizontalRatio
                    : 45;
                orbit.maxDistance = Math.max(orbit.minDistance, Math.min(45, fieldMaxDistance));
                if (radius > orbit.maxDistance + 1e-4)
                    orbit.update();
            }
        }
        else {
            if (controls.current) {
                controls.current.enabled = false;
                controls.current.maxDistance = 45;
            }
            if (isOffside && cameraPreset === 'broadcast') {
                const frame = sampleOffsideFrame(sim, timeRef.current, liveFrameRef.current);
                const focusX = (frame.receiver.x + frame.defender.x) / 2;
                const focusZ = (frame.passer.z + frame.receiver.z + frame.defender.z) / 3;
                const { target, position, varTarget, varPosition } = cameraVectors;
                target.set(focusX, 1.15, focusZ);
                position.set(focusX - 17, 5, focusZ + 8);
                let fov = 30;
                const review = offsideCameraRef.current;
                if (timeRef.current >= sim.contactT) {
                    const now = performance.now() / 1000;
                    if (review.contactWallTime === null) {
                        review.contactWallTime = now;
                        review.startPosition = position.clone();
                        review.startTarget = target.clone();
                        review.startFov = fov;
                    }
                    const transitionProgress = THREE.MathUtils.clamp((now - review.contactWallTime - 1) / 1.8, 0, 1);
                    const eased = transitionProgress * transitionProgress * (3 - 2 * transitionProgress);
                    const lineZ = offsideLineRef.current?.z ?? sim.offside.lineZ;
                    varTarget.set(focusX, 1.12, lineZ);
                    varPosition.set(focusX - 38, 6.3, lineZ + 2.2);
                    target.copy(review.startTarget).lerp(varTarget, eased);
                    position.copy(review.startPosition).lerp(varPosition, eased);
                    fov = THREE.MathUtils.lerp(review.startFov, 7.5, eased);
                } else if (review) {
                    review.contactWallTime = null;
                    review.startPosition = null;
                    review.startTarget = null;
                }
                camera.position.copy(position);
                camera.lookAt(target);
                camera.fov = fov;
                camera.updateProjectionMatrix();
                if (controls.current) controls.current.target.copy(target);
                contactCamera.aspect = 360 / 226;
                contactCamera.position.set(focusX + 17, 5, focusZ - 8);
                contactCamera.lookAt(target);
                contactCamera.fov = 30;
                contactCamera.updateProjectionMatrix();
                return;
            }
            const p = PRESETS[cameraPreset];
            const k = 1 - Math.exp(-dt * 3.2);
            // Broadcast cameras pan with the action; keep the calibration anchor fixed
            // at the contact frame so the investigative view is reproducible.
            const frame = isOffside
                ? sampleOffsideFrame(sim, timeRef.current, liveFrameRef.current)
                : sampleFrame(sim, timeRef.current, liveFrameRef.current);
            const cf = isOffside
                ? sampleOffsideFrame(sim, sim.contactT, contactFrameRef.current)
                : sim.frames[Math.round(sim.contactT * 120)];
            const chasing = timeRef.current < sim.contactT - 0.08;
            const wA = chasing ? 0.58 : 0.5;
            const first = isOffside ? frame.passer : frame.tackler;
            const second = isOffside ? frame.receiver : frame.carrier;
            const contactFirst = isOffside ? cf.passer : cf.tackler;
            const contactSecond = isOffside ? cf.receiver : cf.carrier;
            const { focusNow, focusContact, pan, anchorShift, goalPos, goalTarget, viewDir } = cameraVectors;
            if (isOffside) {
                focusNow.set((frame.passer.x + frame.receiver.x + frame.defender.x) / 3, 0, (frame.passer.z + frame.receiver.z + frame.defender.z) / 3);
                focusContact.set((cf.passer.x + cf.receiver.x + cf.defender.x) / 3, 0, (cf.passer.z + cf.receiver.z + cf.defender.z) / 3);
            }
            else {
                focusNow.set(first.x * wA + second.x * (1 - wA), 0, first.z * wA + second.z * (1 - wA));
                focusContact.set((contactFirst.x + contactSecond.x) / 2, 0, (contactFirst.z + contactSecond.z) / 2);
            }
            pan.copy(focusNow).sub(focusContact);
            pan.x = THREE.MathUtils.clamp(pan.x, -5.5, 5.5);
            pan.z = THREE.MathUtils.clamp(pan.z, -12.5, 6.5);
            anchorShift.set(isOffside ? focusContact.x - 27.55 : 0, 0, isOffside ? focusContact.z - 10.0 : 0);
            goalPos.fromArray(p.pos).add(pan).add(anchorShift);
            goalTarget.fromArray(p.target).add(pan).add(anchorShift);
            const sinceContact = THREE.MathUtils.clamp((timeRef.current - sim.contactT) / 1.3, 0, 1);
            goalTarget.y += (0.62 - goalTarget.y) * sinceContact * 0.72;
            if (chasing)
                goalTarget.y += 0.26;
            const separation = isOffside
                ? Math.max(
                    Math.hypot(frame.passer.x - frame.receiver.x, frame.passer.z - frame.receiver.z),
                    Math.hypot(frame.defender.x - frame.receiver.x, frame.defender.z - frame.receiver.z),
                )
                : Math.hypot(frame.tackler.x - frame.carrier.x, frame.tackler.z - frame.carrier.z);
            const maxPull = isOffside ? 14 : cameraPreset === 'touchline' || cameraPreset === 'referee' ? 6.2 : 4.4;
            const pullBack = THREE.MathUtils.clamp((separation - 1.1) * (isOffside ? 1.2 : 0.9), 0, maxPull);
            viewDir.copy(goalPos).sub(goalTarget).normalize();
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
        if (isOffside) {
            const frame = sampleOffsideFrame(sim, timeRef.current, reverseFrameRef.current);
            const focusX = (frame.receiver.x + frame.defender.x) / 2;
            const focusZ = (frame.passer.z + frame.receiver.z + frame.defender.z) / 3;
            contactCamera.position.set(focusX + 17, 5, focusZ - 8);
            contactCamera.lookAt(cameraVectors.lookAt.set(focusX, 1.15, focusZ));
            contactCamera.fov = 30;
        } else {
            contactCamera.position.set(32.4, 1.35, 8.1);
            contactCamera.lookAt(cameraVectors.lookAt.set(27.7, 0.55, 10.3));
            contactCamera.fov = 34;
        }
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
        if (!hasReportedFirstFrame.current && !gl.getContext().isContextLost()) {
            hasReportedFirstFrame.current = true;
            onReady?.();
        }
    }, 1);
    const actors = isOffside
        ? _jsxs(_Fragment, { children: [
            _jsx(OffsideActor, { sim: sim, timeRef: timeRef, role: "passer", side: "away", showSkeleton: showSkeleton, showLabels: showLabels, lineRef: offsideLineRef, ballStateRef: offsideBallRef }, "passer"),
            _jsx(OffsideActor, { sim: sim, timeRef: timeRef, role: "receiver", side: "away", showSkeleton: showSkeleton, showLabels: showLabels, lineRef: offsideLineRef }, "receiver"),
            _jsx(OffsideActor, { sim: sim, timeRef: timeRef, role: "defender", side: "home", showSkeleton: showSkeleton, showLabels: showLabels, lineRef: offsideLineRef }, "defender"),
        ] })
        : _jsxs(_Fragment, { children: [
            _jsx(Actor, { sim: sim, timeRef: timeRef, role: "tackler", side: "home", kit: KITS.home, showSkeleton: showSkeleton, showLabels: showLabels }),
            _jsx(Actor, { sim: sim, timeRef: timeRef, role: "carrier", side: "away", kit: KITS.away, showSkeleton: showSkeleton, showLabels: showLabels }),
        ] });
    const markings = isOffside
        ? _jsxs(_Fragment, { children: [
            _jsx(OffsideLine, { sim: sim, timeRef: timeRef, lineRef: offsideLineRef }),
            _jsx(OffsideMotionOverlay, { sim: sim, timeRef: timeRef, ballStateRef: offsideBallRef, showTrajectory: showTrajectory, showForces: showForces }),
        ] })
        : _jsx(MotionOverlay, { sim: sim, timeRef: timeRef, showForces: showForces, showTrajectory: showTrajectory });
    return (_jsxs(_Fragment, { children: [_jsx("fogExp2", { attach: "fog", args: ['#071413', 0.0062] }), _jsx("hemisphereLight", { args: ['#cfe7ff', '#0b2a1d', 0.92] }), _jsx("directionalLight", { position: [42, 34, 18], intensity: 3.0, color: "#fff3db", castShadow: !contactView, "shadow-mapSize-width": 1024, "shadow-mapSize-height": 1024, "shadow-camera-left": -28, "shadow-camera-right": 28, "shadow-camera-top": 28, "shadow-camera-bottom": -28, "shadow-camera-near": 1, "shadow-camera-far": 90, "shadow-bias": -0.00025, "shadow-normalBias": 0.035 }), _jsx("directionalLight", { position: [-24, 18, -12], intensity: 1.15, color: "#5bb6ff" }), _jsx("directionalLight", { position: [18, 8, 30], intensity: 0.85, color: "#ffb66e" }), _jsx("spotLight", { position: [34, 22, 8], angle: 0.75, penumbra: 0.85, intensity: 100, color: "#e4f5ff", distance: 80 }), _jsx(Pitch, {}), actors, _jsx(Ball, { sim: sim, timeRef: timeRef, offsideBallRef: isOffside ? offsideBallRef : null }), markings, _jsx(OrbitControls, { ref: controls, makeDefault: true, enabled: cameraPreset === 'free', enablePan: false, target: [27.35, 0.78, 10.25], enableDamping: true, dampingFactor: 0.06, minDistance: 2.5, maxDistance: 45, maxPolarAngle: Math.PI / 2 - 0.04 }), _jsx(Preload, { all: true })] }));
}
export function Scene({ sim, timeRef, cameraPreset, showSkeleton, showLabels, showTrajectory, showForces, dual, contactView = false, onReady, }) {
    return (_jsx(Canvas, { shadows: contactView ? false : "basic", dpr: contactView ? 1 : [1, 1.5], gl: { antialias: true, alpha: false, powerPreference: 'high-performance', stencil: false }, camera: { position: [19.9, 4.2, 7.2], fov: 40, near: 0.1, far: 360 }, onCreated: ({ gl }) => {
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.toneMappingExposure = 1.08;
        }, children: _jsx(Suspense, { fallback: null, children: _jsx(SceneContents, { sim: sim, timeRef: timeRef, cameraPreset: cameraPreset, showSkeleton: showSkeleton, showLabels: showLabels, showTrajectory: showTrajectory, showForces: showForces, dual: dual, contactView: contactView, onReady: onReady }) }) }));
}
