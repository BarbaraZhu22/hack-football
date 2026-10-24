import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useLoader, useThree } from '@react-three/fiber';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as THREE from 'three';
import { prepareHero } from './kit';
import { buildRig, poseCarrier, poseTackler } from './actions/pose';
import { BODY_MODEL_URL, getClipUrl } from './actions/catalog';
import { sampleFrame } from '@/lib/incident-simulation';
import { createRunPlayer, retargetRun, setRunTime } from './actions/retarget';
function makeLabelTexture(name, number, color, role) {
    const c = document.createElement('canvas');
    c.width = 1024;
    c.height = 256;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, 1024, 256);
    // halo
    ctx.fillStyle = 'rgba(3,8,10,0.82)';
    const r = 28;
    ctx.beginPath();
    ctx.roundRect(26, 36, 972, 152, r);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.lineWidth = 3;
    ctx.stroke();
    // team bar
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(26, 36, 18, 152, [r, 0, 0, r]);
    ctx.fill();
    ctx.fillStyle = '#f4f7f6';
    ctx.font = '800 64px Inter, Helvetica, Arial, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, 78, 102);
    ctx.font = '600 34px Inter, Helvetica, Arial, sans-serif';
    ctx.fillStyle = '#a8b5b6';
    ctx.fillText(role.toUpperCase(), 80, 154);
    ctx.textAlign = 'right';
    ctx.fillStyle = color;
    ctx.font = '800 90px Inter, Helvetica, Arial, sans-serif';
    ctx.fillText(number, 962, 118);
    // pointer
    ctx.fillStyle = 'rgba(3,8,10,0.82)';
    ctx.beginPath();
    ctx.moveTo(494, 188);
    ctx.lineTo(530, 188);
    ctx.lineTo(512, 218);
    ctx.closePath();
    ctx.fill();
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
}
const SKELETON_PAIRS = [
    ['pelvis', 'spine_01'], ['spine_01', 'spine_02'], ['spine_02', 'spine_03'], ['spine_03', 'neck_01'], ['neck_01', 'Head'],
    ['spine_03', 'clavicle_l'], ['clavicle_l', 'upperarm_l'], ['upperarm_l', 'lowerarm_l'], ['lowerarm_l', 'hand_l'],
    ['spine_03', 'clavicle_r'], ['clavicle_r', 'upperarm_r'], ['upperarm_r', 'lowerarm_r'], ['lowerarm_r', 'hand_r'],
    ['pelvis', 'thigh_l'], ['thigh_l', 'calf_l'], ['calf_l', 'foot_l'], ['foot_l', 'ball_l'],
    ['pelvis', 'thigh_r'], ['thigh_r', 'calf_r'], ['calf_r', 'foot_r'], ['foot_r', 'ball_r'],
];
function buildSkeletonOverlay() {
    const group = new THREE.Group();
    group.renderOrder = 18;
    const boneMat = new THREE.MeshBasicMaterial({
        color: '#8cecff',
        transparent: true,
        opacity: 0.78,
        depthTest: false,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
    });
    const jointMat = new THREE.MeshBasicMaterial({
        color: '#d8fff0',
        transparent: true,
        opacity: 0.92,
        depthTest: false,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
    });
    const boneGeo = new THREE.CylinderGeometry(0.016, 0.016, 1, 6, 1, true);
    const jointGeo = new THREE.SphereGeometry(0.035, 8, 6);
    const bones = SKELETON_PAIRS.map(() => {
        const mesh = new THREE.Mesh(boneGeo, boneMat);
        mesh.frustumCulled = false;
        mesh.renderOrder = 18;
        group.add(mesh);
        return mesh;
    });
    const joints = SKELETON_PAIRS.map(() => {
        const mesh = new THREE.Mesh(jointGeo, jointMat);
        mesh.frustumCulled = false;
        mesh.renderOrder = 19;
        group.add(mesh);
        return mesh;
    });
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const mid = new THREE.Vector3();
    const dir = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const update = (rig) => {
        for (let i = 0; i < SKELETON_PAIRS.length; i++) {
            const [an, bn] = SKELETON_PAIRS[i];
            const ba = rig.model.getObjectByName(an);
            const bb = rig.model.getObjectByName(bn);
            if (!ba || !bb)
                continue;
            ba.getWorldPosition(a);
            bb.getWorldPosition(b);
            mid.copy(a).add(b).multiplyScalar(0.5);
            dir.copy(b).sub(a);
            const len = dir.length();
            const bone = bones[i];
            bone.position.copy(mid);
            bone.scale.set(1, Math.max(0.01, len), 1);
            bone.quaternion.copy(q.setFromUnitVectors(up, dir.normalize()));
            const j = joints[i];
            j.position.copy(a);
        }
        const last = joints[joints.length - 1];
        const lastBone = rig.model.getObjectByName(SKELETON_PAIRS[SKELETON_PAIRS.length - 1][1]);
        if (lastBone) {
            lastBone.getWorldPosition(b);
            last.position.copy(b);
        }
    };
    return { group, update };
}
export function Actor({ sim, timeRef, role, side, kit, showSkeleton, showLabels }) {
    const gltf = useLoader(GLTFLoader, BODY_MODEL_URL);
    const runGltf = useLoader(GLTFLoader, getClipUrl('run'));
    const scene = useThree((state) => state.scene);
    const runPlayer = useMemo(() => createRunPlayer(runGltf), [runGltf]);
    const prepared = useMemo(() => prepareHero(gltf, side), [gltf, side]);
    const group = useRef(null);
    const rigRef = useRef(null);
    const skeletonRef = useRef(null);
    const labelRef = useRef(null);
    const headRef = useRef(null);
    const shadowRef = useRef(null);
    const shadowTex = useMemo(() => {
        const c = document.createElement('canvas');
        c.width = c.height = 256;
        const ctx = c.getContext('2d');
        const g = ctx.createRadialGradient(128, 128, 8, 128, 128, 120);
        g.addColorStop(0, 'rgba(0,0,0,0.75)');
        g.addColorStop(0.55, 'rgba(0,0,0,0.32)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 256, 256);
        return new THREE.CanvasTexture(c);
    }, []);
    const label = useMemo(() => {
        const tex = makeLabelTexture(side === 'home' ? 'MAN CITY' : 'ARSENAL', kit.number, side === 'home' ? '#6CABDD' : '#EF0107', role === 'tackler' ? 'Tackler · #6' : 'Carrier · #8');
        const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false });
        const sprite = new THREE.Sprite(mat);
        sprite.layers.set(3);
        sprite.scale.set(1.24, 0.31, 1);
        sprite.renderOrder = 20;
        return sprite;
    }, [side, kit.number, role]);
    labelRef.current = label;
    useLayoutEffect(() => {
        if (!group.current)
            return;
        const rig = buildRig(group.current, prepared.scene);
        rigRef.current = rig;
        headRef.current = rig.bones.head;
        const skel = buildSkeletonOverlay();
        skel.group.visible = showSkeleton;
        skel.group.layers.mask = group.current.layers.mask;
        scene.add(skel.group);
        skeletonRef.current = skel;
        group.current.add(label);
        // Number decals are omitted; the kit colour blocks are the priority at analysis distance.
        return () => {
            if (group.current) {
                scene.remove(skel.group);
                group.current.remove(label);
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [prepared, scene]);
    useEffect(() => {
        if (skeletonRef.current)
            skeletonRef.current.group.visible = showSkeleton;
        prepared.scene.traverse((o) => {
            const m = o;
            if (!m.isMesh && !m.isSkinnedMesh)
                return;
            const mats = Array.isArray(m.material) ? m.material : [m.material];
            for (const mat of mats) {
                if (!mat)
                    continue;
                const mm = mat;
                mm.transparent = showSkeleton;
                mm.opacity = showSkeleton ? 0.32 : 1;
                mm.depthWrite = !showSkeleton;
                mm.needsUpdate = true;
            }
        });
    }, [showSkeleton, prepared]);
    useEffect(() => {
        label.visible = showLabels;
    }, [showLabels, label]);
    useFrame(() => {
        const rig = rigRef.current;
        const g = group.current;
        if (!rig || !g)
            return;
        const f = sampleFrame(sim, timeRef.current);
        const a = role === 'tackler' ? f.tackler : f.carrier;
        g.position.set(a.x, 0, a.z);
        const runEnd = role === 'tackler' ? sim.contactT - 0.34 : sim.contactT - 0.03;
        const runFade = 0.18;
        const runBlend = THREE.MathUtils.clamp((runEnd - timeRef.current) / runFade, 0, 1);
        if (role === 'carrier') {
            const qy = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), a.yaw);
            const qx = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), a.pitch * (1 - runBlend));
            const qz = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), a.roll * (1 - runBlend));
            g.quaternion.copy(qy).multiply(qx).multiply(qz);
        }
        else {
            g.rotation.set(0, a.yaw, 0);
        }
        if (runBlend > 0.001) {
            const rate = 1.15 + a.speed * 0.15;
            setRunTime(runPlayer, (timeRef.current * rate) % runPlayer.duration);
            retargetRun(runPlayer, rig);
            if (runBlend < 0.999) {
                const saved = [];
                rig.model.traverse((o) => {
                    if (o.isBone)
                        saved.push({ bone: o, q: o.quaternion.clone() });
                });
                const pelvisPos = rig.bones.pelvis.position.clone();
                if (role === 'tackler')
                    poseTackler(rig, a);
                else
                    poseCarrier(rig, a);
                for (const item of saved)
                    item.bone.quaternion.slerp(item.q, runBlend);
                rig.bones.pelvis.position.lerp(pelvisPos, runBlend);
                rig.group.updateMatrixWorld(true);
            }
        }
        else if (role === 'tackler')
            poseTackler(rig, a);
        else
            poseCarrier(rig, a);
        if (shadowRef.current) {
            shadowRef.current.position.set(a.x, 0.025, a.z);
            shadowRef.current.scale.set(1.0 + (role === 'tackler' && (a.phase === 'slide') ? 0.55 : 0.2), 1, 1);
            shadowRef.current.rotation.z = role === 'tackler' ? a.yaw : a.yaw;
        }
        if (headRef.current) {
            const p = new THREE.Vector3();
            headRef.current.getWorldPosition(p);
            g.worldToLocal(p);
            label.position.set(p.x, p.y + 0.38, p.z);
        }
        const sk = skeletonRef.current;
        if (sk) {
            sk.group.layers.mask = g.layers.mask;
            if (sk.group.visible)
                sk.update(rig);
        }
    });
    return (_jsxs(_Fragment, { children: [_jsx("group", { ref: group, children: _jsx("primitive", { object: prepared.scene }) }), _jsxs("mesh", { ref: shadowRef, rotation: [-Math.PI / 2, 0, 0], position: [0, 0.025, 0], renderOrder: 2, children: [_jsx("planeGeometry", { args: [1.25, 0.75] }), _jsx("meshBasicMaterial", { map: shadowTex, transparent: true, opacity: 0.5, depthWrite: false })] })] }));
}
