import * as THREE from 'three';
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);
const _v1 = new THREE.Vector3();
const _q1 = new THREE.Quaternion();
const BONE_MAP = {
    pelvis: 'pelvis',
    spine1: 'spine_01',
    spine2: 'spine_02',
    chest: 'spine_03',
    neck: 'neck_01',
    head: 'Head',
    clavicleL: 'clavicle_l',
    clavicleR: 'clavicle_r',
    upperArmL: 'upperarm_l',
    upperArmR: 'upperarm_r',
    lowerArmL: 'lowerarm_l',
    lowerArmR: 'lowerarm_r',
    handL: 'hand_l',
    handR: 'hand_r',
    thighL: 'thigh_l',
    thighR: 'thigh_r',
    calfL: 'calf_l',
    calfR: 'calf_r',
    footL: 'foot_l',
    footR: 'foot_r',
    toeL: 'ball_l',
    toeR: 'ball_r',
};
const CHILD = {
    pelvis: 'spine_01',
    spine_01: 'spine_02',
    spine_02: 'spine_03',
    spine_03: 'neck_01',
    neck_01: 'Head',
    Head: 'Head',
    upperarm_l: 'lowerarm_l',
    upperarm_r: 'lowerarm_r',
    lowerarm_l: 'hand_l',
    lowerarm_r: 'hand_r',
    thigh_l: 'calf_l',
    thigh_r: 'calf_r',
    calf_l: 'foot_l',
    calf_r: 'foot_r',
    foot_l: 'ball_l',
    foot_r: 'ball_r',
};
export function buildRig(group, model) {
    group.updateMatrixWorld(true);
    const bones = {};
    const all = new Map();
    model.traverse((o) => {
        const b = o;
        if (b.isBone)
            all.set(b.name, b);
    });
    for (const [k, name] of Object.entries(BONE_MAP)) {
        const b = all.get(name);
        if (b)
            bones[k] = b;
    }
    const restLocal = new Map();
    const restLocalPos = new Map();
    const restPos = new Map();
    const restWorldQ = new Map();
    const restDir = new Map();
    const actorQInv = new THREE.Quaternion();
    group.getWorldQuaternion(actorQInv).invert();
    for (const [name, b] of all) {
        restLocal.set(name, b.quaternion.clone());
        restLocalPos.set(name, b.position.clone());
        const wp = new THREE.Vector3();
        b.getWorldPosition(wp);
        group.worldToLocal(wp);
        restPos.set(name, wp);
        const wq = new THREE.Quaternion();
        b.getWorldQuaternion(wq);
        restWorldQ.set(name, wq.premultiply(actorQInv));
    }
    for (const [name, childName] of Object.entries(CHILD)) {
        const a = restPos.get(name);
        const c = restPos.get(childName);
        if (!a || !c)
            continue;
        restDir.set(name, c.clone().sub(a).normalize());
    }
    const lengths = new Map();
    for (const key of ['upperArmL', 'upperArmR', 'thighL', 'thighR']) {
        const bone = bones[key];
        if (!bone)
            continue;
        const childName = CHILD[bone.name];
        const a = restPos.get(bone.name);
        const b = restPos.get(childName);
        if (a && b)
            lengths.set(key, a.distanceTo(b));
    }
    // capture rest positions of the joints for IK sizes
    return { group, model, bones, restLocal, restLocalPos, restPos, restWorldQ, restDir, lengths };
}
export function resetPose(rig) {
    for (const [name, q] of rig.restLocal) {
        const b = rig.model.getObjectByName(name);
        if (b) {
            b.quaternion.copy(q);
            const lp = rig.restLocalPos.get(name);
            if (lp)
                b.position.copy(lp);
        }
    }
    rig.group.updateMatrixWorld(true);
}
function actorWorldQuat(rig) {
    const q = new THREE.Quaternion();
    rig.group.getWorldQuaternion(q);
    return q;
}
function actorLocalToWorld(rig, p) {
    return rig.group.localToWorld(p.clone());
}
function getActorPos(rig, bone) {
    const p = new THREE.Vector3();
    bone.getWorldPosition(p);
    rig.group.worldToLocal(p);
    return p;
}
function parentActorQuat(rig, bone) {
    const q = new THREE.Quaternion();
    const parent = bone.parent;
    parent.getWorldQuaternion(q);
    const aq = actorWorldQuat(rig);
    return q.premultiply(aq.invert()).normalize();
}
/** Rotate a bone around an axis expressed in character (actor-local) space. */
export function rotateActorAxis(rig, bone, axis, angle) {
    if (Math.abs(angle) < 1e-6)
        return;
    rig.group.updateMatrixWorld(true);
    const pq = parentActorQuat(rig, bone);
    const axisParent = _v1.copy(axis).applyQuaternion(pq.clone().invert()).normalize();
    _q1.setFromAxisAngle(axisParent, angle);
    bone.quaternion.premultiply(_q1);
    bone.updateMatrixWorld(true);
}
/** Move a bone by a delta expressed in character space (used for pelvis height). */
export function translateActor(rig, bone, delta) {
    rig.group.updateMatrixWorld(true);
    const p = getActorPos(rig, bone).add(delta);
    const w = actorLocalToWorld(rig, p);
    const parent = bone.parent;
    parent.worldToLocal(w);
    bone.position.copy(w);
    bone.updateMatrixWorld(true);
    rig.group.updateMatrixWorld(true);
}
/**
 * Align a bone's rest primary axis to a target direction in character space.
 * Twist is inherited from the parent, preserving the hinge orientation.
 */
export function aimBone(rig, bone, target) {
    const name = bone.name;
    const restDir = rig.restDir.get(name);
    const restWQ = rig.restWorldQ.get(name);
    if (!restDir || !restWQ)
        return;
    rig.group.updateMatrixWorld(true);
    const parent = bone.parent;
    const pq = parentActorQuat(rig, bone);
    const parentRest = new THREE.Quaternion();
    parent.getWorldQuaternion(parentRest);
    // parentRest is world; convert to actor space
    const aq = actorWorldQuat(rig);
    parentRest.premultiply(aq.invert()).normalize();
    const parentRestQ = new THREE.Quaternion();
    // parent rest world quaternion was captured earlier, look up by name
    const prq = rig.restWorldQ.get(parent.name) ?? parentRest;
    parentRestQ.copy(prq);
    const parentDelta = pq.clone().multiply(parentRestQ.clone().invert());
    const currentDir = restDir.clone().applyQuaternion(parentDelta).normalize();
    const desired = target.clone().normalize();
    const delta = new THREE.Quaternion().setFromUnitVectors(currentDir, desired);
    const desiredWorld = delta.multiply(parentDelta).multiply(restWQ);
    const local = pq.clone().invert().multiply(desiredWorld);
    bone.quaternion.copy(local);
    bone.updateMatrixWorld(true);
}
/** Analytic two-bone IK in character space. */
export function solveLimb(rig, upper, lower, end, target, pole) {
    const upperBone = rig.bones[upper];
    const lowerBone = rig.bones[lower];
    const endBone = rig.bones[end];
    if (!upperBone || !lowerBone || !endBone)
        return;
    const a = getActorPos(rig, upperBone);
    const restUpper = rig.restPos.get(upperBone.name);
    const restLower = rig.restPos.get(lowerBone.name);
    const restEnd = rig.restPos.get(endBone.name);
    const l1 = restUpper.distanceTo(restLower);
    const l2 = restLower.distanceTo(restEnd);
    const toTarget = target.clone().sub(a);
    let dist = toTarget.length();
    if (dist < 1e-4)
        return;
    dist = Math.min(Math.max(dist, Math.abs(l1 - l2) + 0.001), l1 + l2 - 0.002);
    const dir = toTarget.normalize();
    const cosA = THREE.MathUtils.clamp((l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist), -1, 1);
    const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
    const bend = pole.clone().sub(dir.clone().multiplyScalar(pole.dot(dir)));
    if (bend.lengthSq() < 1e-6)
        bend.set(0, 0.4, 1);
    bend.normalize();
    const joint = a.clone().add(dir.multiplyScalar(l1 * cosA)).add(bend.multiplyScalar(l1 * sinA));
    aimBone(rig, upperBone, joint.clone().sub(a));
    rig.group.updateMatrixWorld(true);
    const jointNow = getActorPos(rig, lowerBone);
    aimBone(rig, lowerBone, target.clone().sub(jointNow));
    rig.group.updateMatrixWorld(true);
}
export function aimFoot(rig, side, forward = 0.8, down = -0.25) {
    const foot = rig.bones[side === 'L' ? 'footL' : 'footR'];
    if (!foot)
        return;
    aimBone(rig, foot, V(0, down, forward).normalize());
}
function setShoulders(rig, lift) {
    rotateActorAxis(rig, rig.bones.clavicleL, V(0, 0, 1), lift);
    rotateActorAxis(rig, rig.bones.clavicleR, V(0, 0, 1), -lift);
}
function headUp(rig, tilt = 0.15, yaw = 0) {
    aimBone(rig, rig.bones.neck, V(0, 1, tilt));
    rig.group.updateMatrixWorld(true);
    aimBone(rig, rig.bones.head, V(Math.sin(yaw), 1, tilt).normalize());
}
function poseArms(rig, left, right, poles = { left: V(0.45, -0.2, -0.4), right: V(-0.45, -0.2, -0.4) }) {
    solveLimb(rig, 'upperArmL', 'lowerArmL', 'handL', left, poles.left);
    solveLimb(rig, 'upperArmR', 'lowerArmR', 'handR', right, poles.right);
}
function runFootTargets(stride, amplitude = 0.52, lift = 0.3) {
    const phase = stride * Math.PI * 2;
    const zL = Math.sin(phase) * amplitude;
    const zR = Math.sin(phase + Math.PI) * amplitude;
    const yL = Math.max(0, Math.cos(phase)) * lift;
    const yR = Math.max(0, Math.cos(phase + Math.PI)) * lift;
    // A run has two flight phases per cycle. Both feet leave the turf together;
    // a walk never does. This is what separates the two gaits visually.
    const flight = Math.max(0, -Math.cos(phase * 2));
    const base = 0.06 + flight * 0.16;
    return {
        left: V(0.17, base + yL, zL),
        right: V(-0.17, base + yR, zR),
        phase,
        flight,
    };
}
/** Tackler: running, committed slide, arrested slide and get-up. */
export function poseTackler(rig, a) {
    resetPose(rig);
    const slide = a.phase === 'slide';
    const rise = a.phase === 'rise';
    const stand = a.phase === 'stand';
    const run = a.phase === 'sprint' || a.phase === 'commit';
    const lower = Math.max(0, 1 - a.comY);
    // body recline around the hips
    rotateActorAxis(rig, rig.bones.pelvis, V(1, 0, 0), a.pitch + (run ? 0.35 : 0));
    rotateActorAxis(rig, rig.bones.pelvis, V(0, 0, 1), a.roll);
    rotateActorAxis(rig, rig.bones.spine1, V(1, 0, 0), slide ? -0.08 : run ? 0.22 : rise ? 0.18 : 0.04);
    rotateActorAxis(rig, rig.bones.spine2, V(1, 0, 0), slide ? -0.08 : 0.05);
    rotateActorAxis(rig, rig.bones.pelvis, V(0, 1, 0), slide ? 0.16 : Math.sin(a.stride * Math.PI * 2) * 0.06);
    translateActor(rig, rig.bones.pelvis, V(0, -(lower + (stand ? 0 : 0.015) + (run ? 0.018 * Math.sin(a.stride * Math.PI * 4) : 0)), 0));
    rig.group.updateMatrixWorld(true);
    if (stand) {
        const idle = Math.sin(a.phaseT * 2.4) * 0.012;
        setShoulders(rig, 0.02);
        poseArms(rig, V(0.23, 0.97 + idle, 0.02), V(-0.23, 0.98 + idle, 0.01));
        solveLimb(rig, 'thighL', 'calfL', 'footL', V(0.17, 0.07, -0.02), V(0.15, 0.3, 1));
        solveLimb(rig, 'thighR', 'calfR', 'footR', V(-0.17, 0.07, 0.02), V(-0.15, 0.3, 1));
        aimFoot(rig, 'L');
        aimFoot(rig, 'R');
        headUp(rig, 0.08, -0.06);
        return;
    }
    if (slide) {
        setShoulders(rig, 0.06);
        const k = THREE.MathUtils.clamp((a.speed - 0.1) / 6.2, 0, 1);
        const hit = a.sinceContact >= 0 ? Math.exp(-a.sinceContact / 0.12) : 0;
        rotateActorAxis(rig, rig.bones.spine2, V(1, 0, 0), 0.1 * hit);
        // the lead leg compresses a little at contact, then follows through
        const reach = 0.88 - 0.12 * hit;
        solveLimb(rig, 'thighR', 'calfR', 'footR', V(-0.2, 0.11 + 0.03 * hit, reach), V(-0.26, 0.3, 1));
        solveLimb(rig, 'thighL', 'calfL', 'footL', V(0.36, 0.08, -0.26), V(0.55, 0.25, 0.45));
        aimFoot(rig, 'R', 1.0, 0.02);
        aimFoot(rig, 'L', 0.25, -0.35);
        poseArms(rig, V(0.45, 0.18, -0.2), V(-0.74, 0.56, 0.3), { left: V(0.55, -0.05, -0.2), right: V(-0.62, 0.05, 0.3) });
        headUp(rig, 0.22, 0.25);
        // the trailing knee folds under; add a little side roll as the slide dies
        rotateActorAxis(rig, rig.bones.pelvis, V(0, 1, 0), (1 - k) * 0.08);
        return;
    }
    if (rise) {
        const k = THREE.MathUtils.clamp(a.phaseT / 0.45, 0, 1);
        const tuck = smooth(THREE.MathUtils.clamp(k / 0.62, 0, 1));
        setShoulders(rig, lerp(0.08, 0.02, k));
        // Push off one hand, tuck the lead leg under and rock up in one motion.
        poseArms(rig, V(0.42 - 0.16 * k, lerp(0.18, 0.92, smooth(k)), lerp(-0.2, 0.02, k)), V(-0.44 + 0.1 * k, lerp(0.34, 0.94, smooth(k)), lerp(0.22, 0.02, k)), { left: V(0.5, 0.02, -0.05), right: V(-0.5, 0.15, 0.2) });
        solveLimb(rig, 'thighL', 'calfL', 'footL', V(lerp(0.34, 0.17, tuck), 0.07, lerp(-0.24, -0.02, tuck)), V(0.35, 0.45, 0.85));
        solveLimb(rig, 'thighR', 'calfR', 'footR', V(lerp(-0.18, -0.17, tuck), 0.07, lerp(0.78, 0.04, tuck)), V(-0.35, 0.45, 0.85));
        aimFoot(rig, 'L', 0.7, -0.2);
        aimFoot(rig, 'R', 0.7, -0.2);
        headUp(rig, 0.14, -0.1);
        return;
    }
    // Sprinting / committing
    const amp = a.phase === 'commit' ? 0.38 : 0.64;
    const feet = runFootTargets(a.stride, amp, a.phase === 'commit' ? 0.24 : 0.46);
    translateActor(rig, rig.bones.pelvis, V(0, 0.1 * feet.flight, 0));
    rotateActorAxis(rig, rig.bones.pelvis, V(0, 1, 0), Math.sin(feet.phase) * 0.12);
    setShoulders(rig, 0.06);
    const armSwingL = Math.sin(feet.phase + Math.PI);
    const armSwingR = Math.sin(feet.phase);
    poseArms(rig, V(0.25, 1.2 + Math.abs(armSwingL) * 0.1, armSwingL * 0.52 - 0.06), V(-0.25, 1.16 + Math.abs(armSwingR) * 0.1, armSwingR * 0.52 - 0.06), { left: V(0.42, 0.05, -0.25), right: V(-0.42, 0.05, -0.25) });
    solveLimb(rig, 'thighL', 'calfL', 'footL', feet.left, V(0.12, 0.45, 1));
    solveLimb(rig, 'thighR', 'calfR', 'footR', feet.right, V(-0.12, 0.45, 1));
    aimFoot(rig, 'L', 0.72, -0.25);
    aimFoot(rig, 'R', 0.72, -0.25);
    headUp(rig, 0.1, 0.05);
    rotateActorAxis(rig, rig.bones.spine2, V(0, 1, 0), Math.sin(feet.phase) * 0.1);
}
/** Carrier: running carry, blended forward fall and a short grounded settle. */
export function poseCarrier(rig, a) {
    resetPose(rig);
    const fall = smooth(THREE.MathUtils.clamp((a.pitch - 0.12) / 1.3, 0, 1));
    const hit = a.sinceContact >= 0 ? Math.exp(-a.sinceContact / 0.11) : 0;
    rotateActorAxis(rig, rig.bones.spine1, V(1, 0, 0), lerp(0.16, 0.25, fall) - 0.08 * hit);
    rotateActorAxis(rig, rig.bones.spine2, V(1, 0, 0), lerp(0.09, 0.18, fall));
    rotateActorAxis(rig, rig.bones.pelvis, V(0, 0, 1), a.roll * 0.34);
    rig.group.updateMatrixWorld(true);
    const feet = runFootTargets(a.stride, 0.56, 0.32);
    translateActor(rig, rig.bones.pelvis, V(0, 0.075 * feet.flight, 0));
    rotateActorAxis(rig, rig.bones.pelvis, V(0, 1, 0), Math.sin(feet.phase) * 0.1);
    setShoulders(rig, lerp(0.03, 0.14, fall));
    const armSwingL = Math.sin(feet.phase + Math.PI);
    const armSwingR = Math.sin(feet.phase);
    let handL = V(0.24, 1.12 + Math.abs(armSwingL) * 0.06, armSwingL * 0.37 - 0.03);
    let handR = V(-0.24, 1.13 + Math.abs(armSwingR) * 0.06, armSwingR * 0.37 - 0.03);
    let footL = feet.left.clone();
    let footR = feet.right.clone();
    if (fall > 0.001) {
        // Authored in world-relative space, then mapped back into the actor frame.
        // This lets the hands keep reaching for the turf as the body tips over.
        const qi = rig.group.quaternion.clone().invert();
        const toLocal = (v) => v.applyQuaternion(qi);
        const brace = THREE.MathUtils.clamp((a.pitch + 0.1) / 1.25, 0, 1);
        const handY = THREE.MathUtils.lerp(0.82, 0.13, brace);
        const handZ = THREE.MathUtils.lerp(0.22, 0.46, brace);
        const braceHandL = toLocal(V(0.36, handY, handZ + 0.04));
        const braceHandR = toLocal(V(-0.3, handY - 0.06, handZ));
        const braceFootL = toLocal(V(0.2, 0.06, -0.11));
        const braceFootR = toLocal(V(-0.2, 0.06, -0.11));
        handL.lerp(braceHandL, fall);
        handR.lerp(braceHandR, fall);
        footL.lerp(braceFootL, fall);
        footR.lerp(braceFootR, fall);
    }
    // The first instant of contact whips the struck right leg and checks the
    // torso; the response decays over ~120 ms before the fall takes over.
    footR.x -= 0.11 * hit;
    footR.z -= 0.09 * hit;
    footR.y += 0.04 * hit;
    solveLimb(rig, 'thighL', 'calfL', 'footL', footL, V(0.16, 0.5, 1));
    solveLimb(rig, 'thighR', 'calfR', 'footR', footR, V(-0.16, 0.5, 1));
    poseArms(rig, handL, handR, { left: V(0.46, 0.02, -0.2), right: V(-0.46, 0.02, -0.2) });
    const footFwd = lerp(0.8, 0.12, fall);
    const footDown = lerp(-0.12, -0.5, fall);
    aimFoot(rig, 'L', footFwd, footDown);
    aimFoot(rig, 'R', footFwd, footDown);
    headUp(rig, lerp(0.08, 0.34, fall) + 0.08 * hit, -0.12 * fall);
}
