"use client";

import { useEffect, useMemo, useRef } from "react";
import { Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  calculateBallisticReleaseVelocity,
  makeOffsideBallFlightPath,
  OFFSIDE_PASS_FLIGHT_DURATION,
} from "@/lib/offside-ball-physics";

function makeImpulseLabel() {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 192;
  const ctx = canvas.getContext("2d");
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  }));
  sprite.scale.set(1.75, 0.33, 1);
  sprite.renderOrder = 30;
  sprite.userData.write = (text) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "rgba(4,10,10,0.86)";
    ctx.beginPath();
    ctx.roundRect(12, 30, 1000, 124, 22);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = "#ffd166";
    ctx.font = "700 40px Inter, Helvetica, Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 512, 94);
    texture.needsUpdate = true;
  };
  sprite.userData.write("BALL IMPULSE");
  return sprite;
}

function makeArrow(color) {
  const arrow = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), new THREE.Vector3(), 0.8, color, 0.19, 0.1);
  for (const material of [arrow.line.material, arrow.cone.material]) {
    material.depthTest = false;
    material.depthWrite = false;
    material.transparent = true;
    material.opacity = 0.95;
  }
  arrow.renderOrder = 34;
  arrow.visible = false;
  return arrow;
}

function DynamicBallTrajectory({ sim, ballStateRef }) {
  const predictedPath = useMemo(() => {
    const releaseFrame = sim.frames[sim.frames.length - 1];
    const start = {
      x: releaseFrame.passer.x - 0.2,
      y: 0.28,
      z: releaseFrame.passer.z + 0.48,
    };
    const receiverForward = new THREE.Vector3(0, 0, 1).applyAxisAngle(
      new THREE.Vector3(0, 1, 0),
      releaseFrame.receiver.yaw,
    );
    const target = new THREE.Vector3(
      releaseFrame.receiver.x,
      0.11,
      releaseFrame.receiver.z,
    ).addScaledVector(receiverForward, 5);
    target.y = 0.11;
    const velocity = calculateBallisticReleaseVelocity(start, target, OFFSIDE_PASS_FLIGHT_DURATION);
    return makeOffsideBallFlightPath(start, velocity, OFFSIDE_PASS_FLIGHT_DURATION, 48);
  }, [sim]);
  const geom = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(49 * 3), 3));
    geometry.setDrawRange(0, 0);
    return geometry;
  }, []);
  const material = useMemo(() => new THREE.LineDashedMaterial({
    color: "#c9ff99",
    transparent: true,
    opacity: 0.78,
    dashSize: 0.3,
    gapSize: 0.18,
    depthWrite: false,
  }), []);
  const line = useMemo(() => new THREE.Line(geom, material), [geom, material]);
  useFrame(() => {
    const state = ballStateRef.current;
    const points = state?.released
      ? makeOffsideBallFlightPath(
          state.contactPosition,
          state.releaseVelocity,
          OFFSIDE_PASS_FLIGHT_DURATION,
          48,
        )
      : predictedPath;
    const attribute = geom.getAttribute("position");
    points.forEach(([x, y, z], index) => attribute.setXYZ(index, x, y, z));
    attribute.needsUpdate = true;
    geom.setDrawRange(0, points.length);
    geom.computeBoundingSphere();
    line.computeLineDistances();
    line.layers.set(3);
  });
  return <primitive object={line} />;
}

export function OffsideMotionOverlay({ sim, timeRef, ballStateRef, showTrajectory, showForces }) {
  const annotationGroup = useRef(null);
  const impulseArrow = useMemo(() => makeArrow(0xffcf5c), []);
  const velocityArrow = useMemo(() => makeArrow(0xb9ffd9), []);
  const impulseLabel = useMemo(makeImpulseLabel, []);
  const paths = useMemo(() => {
    const passer = [];
    const receiver = [];
    const defender = [];
    const ball = [];
    sim.frames.forEach((frame, index) => {
      if (index % 5 !== 0 && index !== sim.frames.length - 1) return;
      passer.push([frame.passer.x, 0.045, frame.passer.z]);
      receiver.push([frame.receiver.x, 0.045, frame.receiver.z]);
      defender.push([frame.defender.x, 0.045, frame.defender.z]);
      const lead = 0.25 + 0.14 * (frame.t / sim.contactT) ** 2 * (3 - 2 * (frame.t / sim.contactT));
      ball.push([frame.passer.x - 0.2, 0.12, frame.passer.z + lead]);
    });
    return { passer, receiver, defender, ball };
  }, [sim]);

  useEffect(() => {
    annotationGroup.current?.traverse((object) => object.layers.set(3));
  });

  useFrame(() => {
    const state = ballStateRef.current;
    const active = showForces && timeRef.current >= sim.contactT - 0.06 && state?.released;
    impulseArrow.visible = Boolean(active && state.impulseMagnitude > 0.02);
    velocityArrow.visible = Boolean(active);
    impulseLabel.visible = Boolean(active);
    if (!active) return;

    const start = state.contactPosition;
    const impulseLength = THREE.MathUtils.clamp(state.impulseMagnitude * 0.28, 0.28, 1.5);
    const normal = state.impulseNormal;
    impulseArrow.position.set(start.x, start.y + 0.05, start.z);
    impulseArrow.setDirection(new THREE.Vector3(normal.x, normal.y, normal.z).normalize());
    impulseArrow.setLength(impulseLength, 0.19, 0.1);

    const velocity = state.releaseVelocity;
    const velocityLength = THREE.MathUtils.clamp(velocity.length() * 0.12, 0.36, 1.5);
    velocityArrow.position.set(start.x, start.y + 0.08, start.z);
    velocityArrow.setDirection(velocity.clone().normalize());
    velocityArrow.setLength(velocityLength, 0.17, 0.08);
    impulseLabel.position.set(start.x + 0.65, start.y + 0.68, start.z + 0.2);
    const labelText = `IMPULSE ${state.impulseMagnitude.toFixed(1)} N·s · Δv ${(state.impulseMagnitude / 0.43).toFixed(1)} m/s · F̄ ${state.averageForce.toFixed(0)} N`;
    if (impulseLabel.userData.currentText !== labelText) {
      impulseLabel.userData.write(labelText);
      impulseLabel.userData.currentText = labelText;
    }
  });

  return (
    <group ref={annotationGroup}>
      {showTrajectory && <>
        <Line points={paths.passer} color="#ff9f9b" lineWidth={1.5} dashed dashSize={0.32} gapSize={0.24} transparent opacity={0.62} />
        <Line points={paths.receiver} color="#ff7b7b" lineWidth={1.4} dashed dashSize={0.3} gapSize={0.24} transparent opacity={0.52} />
        <Line points={paths.defender} color="#7dd8ff" lineWidth={1.4} dashed dashSize={0.3} gapSize={0.24} transparent opacity={0.52} />
        <Line points={paths.ball} color="#e2ffc0" lineWidth={1.8} dashed dashSize={0.3} gapSize={0.18} transparent opacity={0.74} />
        <DynamicBallTrajectory sim={sim} ballStateRef={ballStateRef} />
      </>}
      {showForces && <>
        <primitive object={impulseArrow} />
        <primitive object={velocityArrow} />
        <primitive object={impulseLabel} />
      </>}
    </group>
  );
}
