import * as THREE from 'three';
import { resetPose, translateActor } from './pose';
const MAP = [
    ['Hips', 'pelvis'],
    ['Spine', 'spine1'],
    ['Spine1', 'spine2'],
    ['Spine2', 'chest'],
    ['Neck', 'neck'],
    ['Head', 'head'],
    ['LeftShoulder', 'clavicleL'],
    ['LeftArm', 'upperArmL'],
    ['LeftForeArm', 'lowerArmL'],
    ['LeftHand', 'handL'],
    ['RightShoulder', 'clavicleR'],
    ['RightArm', 'upperArmR'],
    ['RightForeArm', 'lowerArmR'],
    ['RightHand', 'handR'],
    ['LeftUpLeg', 'thighL'],
    ['LeftLeg', 'calfL'],
    ['LeftFoot', 'footL'],
    ['LeftToeBase', 'toeL'],
    ['RightUpLeg', 'thighR'],
    ['RightLeg', 'calfR'],
    ['RightFoot', 'footR'],
    ['RightToeBase', 'toeR'],
];
const norm = (n) => n.replace(/^mixamorig:?/i, '').replace(/[^a-z0-9]/gi, '').toLowerCase();
export function createRunPlayer(gltf) {
    const scene = gltf.scene.clone(true);
    scene.updateMatrixWorld(true);
    const bones = new Map();
    scene.traverse((o) => { if (norm(o.name))
        bones.set(norm(o.name), o); });
    const hip = bones.get('hips');
    if (!hip)
        throw new Error('Mixamo run rig is missing Hips');
    const restQ = new Map();
    for (const [name, bone] of bones) {
        const q = new THREE.Quaternion();
        bone.getWorldQuaternion(q);
        restQ.set(name, q);
    }
    const hp = new THREE.Vector3();
    hip.getWorldPosition(hp);
    const clip = gltf.animations[0];
    const mixer = new THREE.AnimationMixer(scene);
    const action = mixer.clipAction(clip);
    action.play();
    action.setEffectiveWeight(1);
    action.clampWhenFinished = true;
    return { scene, mixer, action, duration: clip.duration, bones, restQ, restHipY: hip.position.y, hipScale: 1 / Math.max(0.001, hp.y) };
}
export function setRunTime(player, time) {
    player.action.time = THREE.MathUtils.clamp(time, 0, player.duration - 1e-4);
    player.mixer.update(0);
    player.scene.updateMatrixWorld(true);
}
const _a = new THREE.Quaternion();
const _b = new THREE.Quaternion();
const _c = new THREE.Quaternion();
const _d = new THREE.Quaternion();
const _av = new THREE.Quaternion();
export function retargetRun(player, rig) {
    resetPose(rig);
    const hip = player.bones.get('hips');
    const pelvis = rig.bones.pelvis;
    if (hip && pelvis) {
        const dy = (hip.position.y - player.restHipY) * player.hipScale;
        translateActor(rig, pelvis, new THREE.Vector3(0, THREE.MathUtils.clamp(dy, -0.6, 0.6), 0));
    }
    rig.group.updateMatrixWorld(true);
    rig.group.getWorldQuaternion(_a);
    _av.copy(_a).invert();
    for (const [src, key] of MAP) {
        const sb = player.bones.get(norm(src));
        const tb = rig.bones[key];
        if (!sb || !tb)
            continue;
        const sr = player.restQ.get(norm(src));
        const tr = rig.restWorldQ.get(tb.name);
        if (!sr || !tr)
            continue;
        sb.getWorldQuaternion(_b);
        _c.copy(_b).multiply(_d.copy(sr).invert());
        _d.copy(_c).multiply(tr);
        const parent = tb.parent;
        parent.getWorldQuaternion(_b);
        _b.premultiply(_av);
        _c.copy(_b).invert().multiply(_d);
        tb.quaternion.copy(_c);
        tb.updateMatrixWorld(true);
    }
    rig.group.updateMatrixWorld(true);
}
