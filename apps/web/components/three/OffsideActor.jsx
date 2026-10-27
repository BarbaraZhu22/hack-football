"use client";

import { CANVAS_FONT_FAMILY } from "@/lib/typography";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame, useLoader, useThree } from "@react-three/fiber";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import * as THREE from "three";
import { prepareHero } from "./kit";
import { buildRig } from "./actions/pose";
import { buildSkeletonOverlay } from "./Actor";
import { getBodyModelUrl, getClipUrl } from "./actions/catalog";
import { createRunPlayer, retargetRun, setRunTime } from "./actions/retarget";
import { sampleOffsideFrame } from "@/lib/offside-simulation";
import {
  OFFSIDE_ELIGIBLE_BODY_PARTS,
  measureLeadingBodyPointZ,
} from "@/lib/offside-assessment";
import {
  calculateBallisticReleaseVelocity,
  calculateOffsideKick,
  OFFSIDE_PASS_FLIGHT_DURATION,
} from "@/lib/offside-ball-physics";

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const smooth = (t) => t * t * (3 - 2 * t);
const KICK_CONTACT_SPEED_MULTIPLIER = 1.95;
function carryBallPosition(sim, time, target = new THREE.Vector3(), frameBuffer) {
  const frame = sampleOffsideFrame(sim, clamp(time, 0, sim.contactT), frameBuffer);
  const lead = 0.25 + 0.14 * smooth(clamp(time / sim.contactT, 0, 1));
  return target.set(frame.passer.x - 0.2, 0.12, frame.passer.z + lead);
}

function applyPoseAtTime({ sim, time, role, actorGroup, rig, runPlayer, passPlayer, poseBuffer, sampledFrame }) {
  const poseTime = clamp(time, 0, sim.contactT);
  const frame = sampledFrame ?? sampleOffsideFrame(sim, poseTime);
  const actor = frame[role];
  actorGroup.position.set(actor.x, 0, actor.z);
  actorGroup.rotation.set(0, actor.yaw, 0);

  const phaseOffset = role === "passer" ? 0.08 : role === "receiver" ? 0.33 : 0.55;
  setRunTime(runPlayer, (poseTime * 1.55 + phaseOffset) % runPlayer.duration);
  retargetRun(runPlayer, rig);

  if (role === "passer" && passPlayer && poseTime >= sim.passStartT) {
    const runPose = poseBuffer.bones;
    for (const item of runPose) item.quaternion.copy(item.bone.quaternion);
    const runPelvisPosition = poseBuffer.pelvisPosition.copy(rig.bones.pelvis.position);
    const localPassTime = clamp(poseTime - sim.passStartT, 0, sim.passLocalReleaseT);
    setRunTime(passPlayer, localPassTime);
    retargetRun(passPlayer, rig);
    const blend = smooth(clamp(localPassTime / 0.14, 0, 1));
    if (blend < 1) {
      for (const item of runPose) item.bone.quaternion.slerp(item.quaternion, 1 - blend);
      rig.bones.pelvis.position.lerp(runPelvisPosition, 1 - blend);
    }
  }

  actorGroup.updateMatrixWorld(true);
  return actor;
}

function sampleKickBallAtTime(time, options) {
  const toe = sampleToeAtTime(time, options);
  const actor = sampleOffsideFrame(options.sim, clamp(time, 0, options.sim.contactT)).passer;
  const forward = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), actor.yaw);
  const ball = toe.addScaledVector(forward, 0.11);
  ball.y = Math.max(0.115, ball.y + 0.035);
  return ball;
}

function sampleToeAtTime(time, { sim, actorGroup, rig, runPlayer, passPlayer, role, poseBuffer }) {
  const savedPosition = actorGroup.position.clone();
  const savedQuaternion = actorGroup.quaternion.clone();
  const savedBones = [];
  rig.model.traverse((object) => {
    if (object.isBone) savedBones.push({
      bone: object,
      position: object.position.clone(),
      quaternion: object.quaternion.clone(),
    });
  });

  applyPoseAtTime({ sim, time, role, actorGroup, rig, runPlayer, passPlayer, poseBuffer });
  const toe = new THREE.Vector3();
  (rig.bones.toeR ?? rig.bones.footR)?.getWorldPosition(toe);

  actorGroup.position.copy(savedPosition);
  actorGroup.quaternion.copy(savedQuaternion);
  for (const item of savedBones) {
    item.bone.position.copy(item.position);
    item.bone.quaternion.copy(item.quaternion);
  }
  actorGroup.updateMatrixWorld(true);
  return toe;
}

function makeLabel(side, role) {
  const color = side === "home" ? "#6CABDD" : "#EF0107";
  const name = side === "home" ? "MAN CITY" : "ARSENAL";
  const number = role === "defender" ? "16" : role === "passer" ? "8" : "9";
  const roleLabel = role === "passer" ? "Passer" : role === "receiver" ? "Runner" : "Defender";
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, 1024, 256);
  ctx.fillStyle = "rgba(3,8,10,0.82)";
  ctx.beginPath();
  ctx.roundRect(26, 36, 972, 152, 28);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.16)";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(26, 36, 18, 152, [28, 0, 0, 28]);
  ctx.fill();
  ctx.fillStyle = "#f4f7f6";
  ctx.font = `800 64px ${CANVAS_FONT_FAMILY}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(name, 78, 102);
  ctx.fillStyle = "#a8b5b6";
  ctx.font = `600 34px ${CANVAS_FONT_FAMILY}`;
  ctx.fillText(roleLabel.toUpperCase(), 80, 154);
  ctx.textAlign = "right";
  ctx.fillStyle = color;
  ctx.font = `800 90px ${CANVAS_FONT_FAMILY}`;
  ctx.fillText(number, 962, 118);
  ctx.fillStyle = "rgba(3,8,10,0.82)";
  ctx.beginPath();
  ctx.moveTo(494, 188);
  ctx.lineTo(530, 188);
  ctx.lineTo(512, 218);
  ctx.closePath();
  ctx.fill();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  }));
  sprite.scale.set(1.22, 0.305, 1);
  sprite.layers.set(3);
  sprite.renderOrder = 20;
  return sprite;
}

function makeShadowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createRadialGradient(128, 128, 8, 128, 128, 120);
  gradient.addColorStop(0, "rgba(0,0,0,0.75)");
  gradient.addColorStop(0.55, "rgba(0,0,0,0.32)");
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(canvas);
}

export function OffsideActor({ sim, timeRef, role, side, showSkeleton, showLabels, lineRef, ballStateRef }) {
  const gltf = useLoader(GLTFLoader, getBodyModelUrl());
  const runGltf = useLoader(GLTFLoader, getClipUrl("run"));
  const passFbx = useLoader(FBXLoader, getClipUrl("soccerPass"));
  const scene = useThree((state) => state.scene);
  const prepared = useMemo(() => prepareHero(gltf, side), [gltf, side]);
  const shadowTexture = useMemo(makeShadowTexture, []);
  const runPlayer = useMemo(() => createRunPlayer(runGltf), [runGltf]);
  const passPlayer = useMemo(
    () => role === "passer"
      ? createRunPlayer({ scene: passFbx, animations: passFbx.animations })
      : null,
    [passFbx, role],
  );
  const floatingLabel = useMemo(() => makeLabel(side, role), [role, side]);
  const group = useRef(null);
  const rigRef = useRef(null);
  const shadowRef = useRef(null);
  const skeletonRef = useRef(null);
  const poseBufferRef = useRef(null);
  const lineBonesRef = useRef([]);
  const linePointsRef = useRef([]);
  const lineForwardRef = useRef(new THREE.Vector3());
  const headWorldRef = useRef(new THREE.Vector3());
  const sampledFrameRef = useRef({});
  const ballFrameRef = useRef({});
  const lastPoseTimeRef = useRef(Number.NaN);
  const ballScratchRef = useRef({
    toe: new THREE.Vector3(),
    forward: new THREE.Vector3(),
    kickBall: new THREE.Vector3(),
    dribbleBall: new THREE.Vector3(),
    ballPosition: new THREE.Vector3(),
  });

  useLayoutEffect(() => {
    if (!group.current) return undefined;
    const rig = buildRig(group.current, prepared.scene);
    rigRef.current = rig;
    const poseBones = [];
    rig.model.traverse((object) => {
      if (object.isBone) poseBones.push({ bone: object, quaternion: new THREE.Quaternion() });
    });
    poseBufferRef.current = { bones: poseBones, pelvisPosition: new THREE.Vector3() };
    if (role === "defender" || role === "receiver") {
      lineBonesRef.current = OFFSIDE_ELIGIBLE_BODY_PARTS
        .map(([key, extent]) => rig.bones[key] ? { bone: rig.bones[key], extent } : null)
        .filter(Boolean);
      linePointsRef.current = lineBonesRef.current.map(() => new THREE.Vector3());
    }
    const skeleton = buildSkeletonOverlay();
    skeleton.group.visible = false;
    skeleton.group.layers.mask = group.current.layers.mask;
    scene.add(skeleton.group);
    skeletonRef.current = skeleton;
    group.current.add(floatingLabel);
    return () => {
      scene.remove(skeleton.group);
      if (group.current) group.current.remove(floatingLabel);
    };
  }, [floatingLabel, prepared, role, scene]);

  useEffect(() => {
    if (skeletonRef.current) skeletonRef.current.group.visible = showSkeleton;
  }, [showSkeleton]);

  useEffect(() => {
    floatingLabel.visible = showLabels;
  }, [floatingLabel, showLabels]);

  useFrame(() => {
    const rig = rigRef.current;
    const actorGroup = group.current;
    if (!rig || !actorGroup) return;

    const time = timeRef.current;
    if (time === lastPoseTimeRef.current) return;
    lastPoseTimeRef.current = time;
    const poseTime = Math.min(time, sim.contactT);
    const frame = sampleOffsideFrame(sim, poseTime, sampledFrameRef.current);
    applyPoseAtTime({ sim, time: poseTime, role, actorGroup, rig, runPlayer, passPlayer, poseBuffer: poseBufferRef.current, sampledFrame: frame });

    if ((role === "defender" || role === "receiver") && lineRef?.current) {
      const forward = actorGroup.getWorldDirection(lineForwardRef.current);
      const leadingBodyZ = measureLeadingBodyPointZ(
        lineBonesRef.current,
        linePointsRef.current,
        forward.z,
      );
      if (role === "receiver") {
        lineRef.current.receiverLeadingPointZ = leadingBodyZ;
      } else {
        lineRef.current.secondLastOpponentLeadingPointZ = leadingBodyZ;
      }
    }

    if (role === "passer" && ballStateRef?.current) {
      const state = ballStateRef.current;
      const { toe, forward, kickBall, dribbleBall, ballPosition } = ballScratchRef.current;
      (rig.bones.toeR ?? rig.bones.footR)?.getWorldPosition(toe);
      forward.set(0, 0, 1).applyQuaternion(actorGroup.quaternion);
      kickBall.copy(toe).addScaledVector(forward, 0.11);
      kickBall.y = Math.max(0.115, kickBall.y + 0.035);
      carryBallPosition(sim, poseTime, dribbleBall, ballFrameRef.current);
      const contactTravelDuration = 0.16;
      const contactProgress = clamp((poseTime - (sim.contactT - contactTravelDuration)) / contactTravelDuration, 0, 1);
      const kickBlend = 1 - (1 - contactProgress) ** 3;
      const forwardAlignment = ballPosition.copy(kickBall).sub(dribbleBall).dot(forward);
      // Keep the carry moving forward through contact, then let the foot guide the
      // ball a short distance forward and upward before the release frame freezes.
      const contactLead = clamp(forwardAlignment, 0, 0.38) * KICK_CONTACT_SPEED_MULTIPLIER;
      ballPosition.copy(dribbleBall).addScaledVector(forward, contactLead * kickBlend);
      const contactLift = clamp(kickBall.y - dribbleBall.y, 0.16, 0.3) * KICK_CONTACT_SPEED_MULTIPLIER;
      ballPosition.y += contactLift * kickBlend;
      const previousTime = state.previousTime;
      if (previousTime !== null && poseTime > previousTime + 1e-5 && poseTime - previousTime < 0.08) {
        state.velocity.copy(ballPosition).sub(state.previousPosition).divideScalar(poseTime - previousTime);
      } else {
        const velocityStep = 1 / 240;
        const beforeTime = Math.max(0, poseTime - velocityStep);
        const afterTime = Math.min(sim.contactT, poseTime + velocityStep);
        const before = carryBallPosition(sim, beforeTime, ballScratchRef.current.before ?? (ballScratchRef.current.before = new THREE.Vector3()), ballFrameRef.current);
        const after = carryBallPosition(sim, afterTime, ballScratchRef.current.after ?? (ballScratchRef.current.after = new THREE.Vector3()), ballFrameRef.current);
        state.velocity.copy(after).sub(before).divideScalar(Math.max(1e-5, afterTime - beforeTime));
      }
      state.position.copy(ballPosition);
      if (time < sim.contactT - 1e-4) {
        state.released = false;
        state.impulse.set(0, 0, 0);
        state.impulseMagnitude = 0;
      } else if (!state.released) {
        state.contactPosition.copy(ballPosition);
        const sampleOptions = { sim, actorGroup, rig, runPlayer, passPlayer, role, poseBuffer: poseBufferRef.current };
        let footVelocity = new THREE.Vector3();
        if (state.previousTime !== null && poseTime > state.previousTime + 1e-5 && poseTime - state.previousTime < 0.08) {
          footVelocity.copy(kickBall).sub(state.previousKickPosition).divideScalar(poseTime - state.previousTime);
        } else if (poseTime > sim.passStartT + 1e-4) {
          const velocityStep = Math.min(1 / 120, poseTime - sim.passStartT);
          const previousKickBall = sampleKickBallAtTime(poseTime - velocityStep, sampleOptions);
          footVelocity.copy(kickBall).sub(previousKickBall).divideScalar(velocityStep);
        }
        const incomingBallVelocity = state.velocity.clone();
        const relativeSwing = footVelocity.clone().sub(incomingBallVelocity);
        const strikeNormal = relativeSwing.lengthSq() > 1e-5
          ? relativeSwing.normalize()
          : forward.clone().add(new THREE.Vector3(0, 0.12, 0)).normalize();
        if (strikeNormal.dot(forward) < 0.12) {
          strikeNormal.lerp(forward.clone().add(new THREE.Vector3(0, 0.12, 0)).normalize(), 0.72).normalize();
        }
        strikeNormal.y = THREE.MathUtils.clamp(strikeNormal.y, 0.58, 0.68);
        strikeNormal.normalize();
        const receiver = sampleOffsideFrame(sim, sim.contactT).receiver;
        const receiverForward = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), receiver.yaw);
        const flightTarget = new THREE.Vector3(receiver.x, 0.11, receiver.z).addScaledVector(receiverForward, 5);
        flightTarget.y = 0.11;
        const targetReleaseVelocity = calculateBallisticReleaseVelocity(
          ballPosition,
          flightTarget,
          OFFSIDE_PASS_FLIGHT_DURATION,
        );
        const kick = calculateOffsideKick(incomingBallVelocity, footVelocity, strikeNormal, targetReleaseVelocity);
        state.footVelocity.copy(footVelocity);
        state.impulseNormal.set(kick.normal.x, kick.normal.y, kick.normal.z);
        state.impulse.set(kick.impulse.x, kick.impulse.y, kick.impulse.z);
        state.impulseMagnitude = kick.impulseMagnitude;
        state.closingSpeed = kick.closingSpeed;
        state.contactDuration = kick.contactDuration;
        state.averageForce = kick.averageForce;
        state.releaseVelocity.set(kick.releaseVelocity.x, kick.releaseVelocity.y, kick.releaseVelocity.z);
        state.released = true;
      }
      state.previousPosition.copy(ballPosition);
      state.previousKickPosition.copy(kickBall);
      state.previousTime = poseTime;
      if (lineRef?.current) {
        lineRef.current.ballCurrentZ = state.position.z;
      }
    }

    if (rig.bones.head) {
      const headPosition = headWorldRef.current;
      rig.bones.head.getWorldPosition(headPosition);
      actorGroup.worldToLocal(headPosition);
      floatingLabel.position.set(headPosition.x, headPosition.y + 0.38, headPosition.z);
    }
    if (skeletonRef.current) {
      skeletonRef.current.group.layers.mask = actorGroup.layers.mask;
      if (skeletonRef.current.group.visible) skeletonRef.current.update(rig);
    }
    if (shadowRef.current) {
      shadowRef.current.position.set(0, 0.025, 0);
      shadowRef.current.rotation.set(0, 0, 0);
    }
  });

  return (
    <group ref={group}>
      <primitive object={prepared.scene} />
      <mesh ref={shadowRef} position={[0, 0.025, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={2}>
        <planeGeometry args={[1.25, 0.75]} />
        <meshBasicMaterial map={shadowTexture} transparent opacity={0.5} depthWrite={false} />
      </mesh>
    </group>
  );
}
