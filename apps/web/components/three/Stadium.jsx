"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";

const SIDE_TIERS = [
  { id: "lower", rows: 7, start: 42.5, step: 1.85, y: 1.35, rise: 1.08, depth: 2 },
  { id: "middle", rows: 7, start: 56.7, step: 1.35, y: 9.4, rise: 1, depth: 1.45 },
  { id: "upper", rows: 7, start: 67.2, step: 0.95, y: 17.2, rise: 0.85, depth: 1.2 },
];

const END_TIERS = [
  { id: "lower", rows: 7, start: 57.6, step: 1.72, y: 1.2, rise: 1.02, depth: 1.55 },
  { id: "middle", rows: 7, start: 69.6, step: 1.35, y: 9.2, rise: 1, depth: 1.2 },
  { id: "upper", rows: 7, start: 79.5, step: 0.95, y: 17, rise: 0.9, depth: 1 },
];

const SIDE_SECTIONS = [-39, -13, 13, 39];
const END_SECTIONS = [-26, 0, 26];
const SEAT_COLORS = ["#247db0", "#176b9b", "#135986"];

function buildCrowdPeople() {
  const people = [];
  const shirts = ["#eef3f5", "#43a1d1", "#176ca1", "#c93e49", "#d7b957", "#93bac9", "#314b5b"];
  let index = 0;

  const addLine = (startX, startZ, endX, endZ, seatTopY) => {
    const dx = endX - startX;
    const dz = endZ - startZ;
    const length = Math.hypot(dx, dz);
    const count = Math.max(1, Math.floor((length - 0.8) / 0.56));
    for (let i = 0; i < count; i++) {
      const fraction = (i + 0.5) / count;
      const jitter = ((index * 37) % 11 - 5) * 0.012;
      const t = Math.min(0.99, Math.max(0.01, fraction + jitter));
      people.push({
        x: startX + dx * t,
        z: startZ + dz * t,
        y: seatTopY,
        shirt: shirts[(index * 13 + Math.floor(index / 7)) % shirts.length],
        skin: index % 3 === 0 ? "#e3b18d" : index % 3 === 1 ? "#bd8567" : "#8d604d",
        scale: 0.9 + (index % 5) * 0.03,
      });
      index += 1;
    }
  };

  for (const sign of [1, -1]) {
    SIDE_TIERS.forEach((tier) => {
      for (let row = 0; row < tier.rows; row++) {
        const distance = tier.start + row * tier.step;
        const seatTop = tier.y + row * tier.rise + 0.45;
        for (const section of SIDE_SECTIONS) {
          addLine(
            sign * (distance - 0.18), section - 11.5,
            sign * (distance - 0.18), section + 11.5,
            seatTop,
          );
        }
      }
    });

    END_TIERS.forEach((tier) => {
      for (let row = 0; row < tier.rows; row++) {
        const distance = tier.start + row * tier.step;
        const seatTop = tier.y + row * tier.rise + 0.44;
        for (const section of END_SECTIONS) {
          addLine(
            section - 11.5, sign * (distance - 0.16),
            section + 11.5, sign * (distance - 0.16),
            seatTop,
          );
        }
      }
    });
  }

  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      SIDE_TIERS.forEach((sideTier, tierIndex) => {
        const endTier = END_TIERS[tierIndex];
        for (let row = 0; row < sideTier.rows; row++) {
          const startX = sx * (sideTier.start + row * sideTier.step);
          const startZ = sz * 51;
          const endX = sx * 38;
          const endZ = sz * (endTier.start + row * endTier.step);
          const seatTop = (
            sideTier.y + row * sideTier.rise +
            endTier.y + row * endTier.rise
          ) / 2 + 0.45;
          addLine(startX, startZ, endX, endZ, seatTop);
        }
      });
    }
  }

  return people;
}

function CrowdPeople({ people }) {
  const torsoRef = useRef(null);
  const headRef = useRef(null);
  const torsoGeometry = useMemo(() => new THREE.CapsuleGeometry(0.15, 0.34, 1, 5), []);
  const headGeometry = useMemo(() => new THREE.SphereGeometry(0.13, 6, 5), []);
  const torsoMaterial = useMemo(() => new THREE.MeshStandardMaterial({ roughness: 0.86 }), []);
  const headMaterial = useMemo(() => new THREE.MeshStandardMaterial({ roughness: 0.9 }), []);

  useLayoutEffect(() => {
    if (!torsoRef.current || !headRef.current) return;
    const torso = torsoRef.current;
    const head = headRef.current;
    const pose = new THREE.Object3D();

    people.forEach((person, index) => {
      pose.scale.setScalar(person.scale);
      pose.position.set(person.x, person.y + 0.3 * person.scale, person.z);
      pose.updateMatrix();
      torso.setMatrixAt(index, pose.matrix);
      torso.setColorAt(index, new THREE.Color(person.shirt));

      pose.position.set(person.x, person.y + 0.66 * person.scale, person.z);
      pose.updateMatrix();
      head.setMatrixAt(index, pose.matrix);
      head.setColorAt(index, new THREE.Color(person.skin));
    });

    torso.instanceMatrix.needsUpdate = true;
    head.instanceMatrix.needsUpdate = true;
    if (torso.instanceColor) torso.instanceColor.needsUpdate = true;
    if (head.instanceColor) head.instanceColor.needsUpdate = true;
    torso.computeBoundingSphere();
    head.computeBoundingSphere();
  }, [people]);

  return (
    <group>
      <instancedMesh ref={torsoRef} args={[torsoGeometry, torsoMaterial, people.length]} castShadow={false} />
      <instancedMesh ref={headRef} args={[headGeometry, headMaterial, people.length]} castShadow={false} />
    </group>
  );
}

function AdBoard({ axis, sign, ads }) {
  const isSideline = axis === "x";
  const rotationY = isSideline ? -sign * Math.PI / 2 : sign > 0 ? Math.PI : 0;
  const center = isSideline
    ? [sign * 39.8, 0.5, 0]
    : [0, 0.5, sign * 54.8];
  const length = isSideline ? 102 : 72;
  const caseSize = isSideline ? [0.3, 0.96, length] : [length, 0.96, 0.3];
  const screenPosition = isSideline
    ? [sign * 39.63, 0.52, 0]
    : [0, 0.52, sign * 54.63];

  return (
    <group>
      <mesh position={center} receiveShadow>
        <boxGeometry args={caseSize} />
        <meshStandardMaterial color="#10181b" roughness={0.55} metalness={0.2} />
      </mesh>
      <mesh position={screenPosition} rotation={[0, rotationY, 0]}>
        <planeGeometry args={[length, 0.76]} />
        <meshBasicMaterial map={ads} toneMapped={false} />
      </mesh>
    </group>
  );
}

function CrowdBand({ position, rotation, size, texture }) {
  return (
    <mesh position={position} rotation={rotation}>
      <planeGeometry args={size} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

function SeatMaterial({ row, tier }) {
  const base = SEAT_COLORS[tier];
  return (
    <meshStandardMaterial
      color={row % 3 === 0 ? base : SEAT_COLORS[(tier + 1) % SEAT_COLORS.length]}
      roughness={0.84}
      metalness={0.01}
    />
  );
}

function SideStand({ sign, crowd, crowdRows, ribbon, screenTex }) {
  const planeRotation = [0, -sign * Math.PI / 2, 0];

  return (
    <group>
      <mesh position={[sign * 74.5, 12, 0]} receiveShadow>
        <boxGeometry args={[5, 24, 124]} />
        <meshStandardMaterial color="#101c22" roughness={0.92} />
      </mesh>
      <mesh position={[sign * 77, 15, 0]}>
        <boxGeometry args={[1.8, 30, 124]} />
        <meshStandardMaterial color="#101a1e" roughness={0.95} />
      </mesh>
      <mesh position={[sign * 76, 15.5, 0]} rotation={planeRotation}>
        <planeGeometry args={[120, 25]} />
        <meshBasicMaterial map={crowd} color="#d7e2df" toneMapped={false} />
      </mesh>
      {SIDE_TIERS.flatMap((tier, tierIndex) => Array.from({ length: tier.rows }, (_, row) => {
        const distance = tier.start + row * tier.step;
        const y = tier.y + row * tier.rise;
        return SIDE_SECTIONS.map((z, section) => (
          <group key={`side-${sign}-${tier.id}-row-${row}-section-${section}`}>
            <mesh position={[sign * distance, y, z]} receiveShadow>
              <boxGeometry args={[tier.depth, 0.9, 24]} />
              <SeatMaterial row={row} tier={tierIndex} />
            </mesh>
            <CrowdBand
              position={[sign * (distance - tier.depth / 2 - 0.025), y, z]}
              rotation={planeRotation}
              size={[24, 0.9]}
              texture={crowdRows}
            />
          </group>
        ));
      }))}
      {[-52, -26, 0, 26, 52].map((z) => (
        <mesh key={`side-${sign}-column-${z}`} position={[sign * 72, 14, z]}>
          <boxGeometry args={[0.8, 28, 0.8]} />
          <meshStandardMaterial color="#18262b" metalness={0.35} roughness={0.62} />
        </mesh>
      ))}
      <mesh position={[sign * 62.5, 25.6, 0]}>
        <boxGeometry args={[34, 0.8, 126]} />
        <meshStandardMaterial color="#0b1115" roughness={0.7} metalness={0.35} />
      </mesh>
      {[
        [42.25, 1.55, 102],
        [55.7, 8.55, 106],
        [66.2, 16.25, 112],
      ].map(([x, y, length], i) => (
        <mesh key={`side-${sign}-ribbon-${i}`} position={[sign * x, y, 0]} rotation={planeRotation}>
          <planeGeometry args={[length, 0.34]} />
          <meshBasicMaterial map={ribbon} toneMapped={false} />
        </mesh>
      ))}
      {sign > 0 && (
        <group position={[sign * 43.2, 7.4, 8]} rotation={planeRotation}>
          <mesh>
            <planeGeometry args={[7.7, 4]} />
            <meshBasicMaterial color="#03090b" />
          </mesh>
          <mesh position={[0, 0, 0.035]}>
            <planeGeometry args={[7.2, 3.6]} />
            <meshBasicMaterial map={screenTex} toneMapped={false} />
          </mesh>
        </group>
      )}
    </group>
  );
}

function EndStand({ sign, crowd, crowdRows, ribbon }) {
  const panelRotation = [0, sign > 0 ? Math.PI : 0, 0];

  return (
    <group>
      <mesh position={[0, 15, sign * 92]}>
        <boxGeometry args={[94, 30, 1.8]} />
        <meshStandardMaterial color="#101a1e" roughness={0.95} />
      </mesh>
      <mesh position={[0, 15.5, sign * 90.9]} rotation={panelRotation}>
        <planeGeometry args={[90, 25]} />
        <meshBasicMaterial map={crowd} color="#d7e2df" toneMapped={false} />
      </mesh>
      {END_TIERS.flatMap((tier, tierIndex) => Array.from({ length: tier.rows }, (_, row) => {
        const distance = tier.start + row * tier.step;
        const y = tier.y + row * tier.rise;
        return END_SECTIONS.map((x, section) => (
          <group key={`end-${sign}-${tier.id}-row-${row}-section-${section}`}>
            <mesh position={[x, y, sign * distance]} receiveShadow>
              <boxGeometry args={[24, 0.88, tier.depth]} />
              <SeatMaterial row={row} tier={tierIndex} />
            </mesh>
            <CrowdBand
              position={[x, y, sign * (distance - tier.depth / 2 - 0.025)]}
              rotation={panelRotation}
              size={[24, 0.88]}
              texture={crowdRows}
            />
          </group>
        ));
      }))}
      {[-42, -21, 0, 21, 42].map((x) => (
        <mesh key={`end-${sign}-column-${x}`} position={[x, 14, sign * 88]}>
          <boxGeometry args={[0.8, 28, 0.8]} />
          <meshStandardMaterial color="#18262b" metalness={0.35} roughness={0.62} />
        </mesh>
      ))}
      <mesh position={[0, 25.6, sign * 80]}>
        <boxGeometry args={[98, 0.8, 26]} />
        <meshStandardMaterial color="#0b1115" roughness={0.7} metalness={0.35} />
      </mesh>
      {[68.7, 78.8].map((distance, i) => (
        <mesh key={`end-${sign}-ribbon-${i}`} position={[0, i === 0 ? 8.55 : 16.25, sign * distance]} rotation={panelRotation}>
          <planeGeometry args={[72, 0.34]} />
          <meshBasicMaterial map={ribbon} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

function CornerLink({ sx, sz, crowdRows }) {
  const wallLength = Math.hypot(32, 30);
  const wallRotation = Math.atan2(-sz * 30, -sx * 32);

  return (
    <group>
      <mesh position={[sx * 61, 15, sz * 77]} rotation={[0, wallRotation, 0]}>
        <boxGeometry args={[wallLength, 30, 1.8]} />
        <meshStandardMaterial color="#101a1e" roughness={0.95} />
      </mesh>
      {SIDE_TIERS.flatMap((sideTier, tierIndex) => {
        const endTier = END_TIERS[tierIndex];
        return Array.from({ length: sideTier.rows }, (_, row) => {
          const startX = sx * (sideTier.start + row * sideTier.step);
          const startZ = sz * 51;
          const endX = sx * 38;
          const endZ = sz * (endTier.start + row * endTier.step);
          const dx = endX - startX;
          const dz = endZ - startZ;
          const length = Math.hypot(dx, dz);
          const rotationY = Math.atan2(-dz, dx);
          const normalSign = sx * sz;
          const normalX = Math.sin(rotationY) * normalSign;
          const normalZ = Math.cos(rotationY) * normalSign;
          const centerX = (startX + endX) / 2;
          const centerZ = (startZ + endZ) / 2;
          const y = (
            sideTier.y + row * sideTier.rise +
            endTier.y + row * endTier.rise
          ) / 2;
          const crowdRotation = rotationY + (normalSign < 0 ? Math.PI : 0);
          const seatDepth = 1.8;

          return (
            <group key={`corner-${sx}-${sz}-${sideTier.id}-row-${row}`}>
              <mesh position={[centerX, y, centerZ]} rotation={[0, rotationY, 0]} receiveShadow>
                <boxGeometry args={[length, 0.9, seatDepth]} />
                <SeatMaterial row={row} tier={tierIndex} />
              </mesh>
              <CrowdBand
                position={[centerX + normalX * (seatDepth / 2 + 0.025), y, centerZ + normalZ * (seatDepth / 2 + 0.025)]}
                rotation={[0, crowdRotation, 0]}
                size={[length, 0.9]}
                texture={crowdRows}
              />
            </group>
          );
        });
      })}
    </group>
  );
}

function CornerCanopy({ sx, sz }) {
  return (
    <mesh position={[sx * 62, 25.6, sz * 65]}>
      <boxGeometry args={[34, 0.8, 10]} />
      <meshStandardMaterial color="#0b1115" roughness={0.7} metalness={0.35} />
    </mesh>
  );
}

function FloodlightTower({ sx, sz }) {
  return (
    <group position={[sx * 72, 26, sz * 60]}>
      <mesh position={[0, 7, 0]}>
        <cylinderGeometry args={[0.15, 0.25, 14, 8]} />
        <meshStandardMaterial color="#1d2a30" metalness={0.7} roughness={0.45} />
      </mesh>
      <mesh position={[0, 8.2, 0.22]}>
        <boxGeometry args={[4.6, 1.5, 0.4]} />
        <meshStandardMaterial color="#102027" metalness={0.6} roughness={0.4} />
      </mesh>
      {[-1.4, 0, 1.4].map((dx) => (
        <mesh key={`flood-${sx}-${sz}-${dx}`} position={[dx, 8.2, 0.45]}>
          <planeGeometry args={[0.75, 1.05]} />
          <meshBasicMaterial color="#fff6db" toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

export function Stadium({ crowd, crowdRows, ads, ribbon, screenTex }) {
  const people = useMemo(buildCrowdPeople, []);

  return (
    <group>
      {[1, -1].map((sign) => (
        <group key={`side-${sign}`}>
          <SideStand sign={sign} crowd={crowd} crowdRows={crowdRows} ribbon={ribbon} screenTex={screenTex} />
          <AdBoard axis="x" sign={sign} ads={ads} />
        </group>
      ))}
      {[1, -1].map((sign) => (
        <group key={`end-${sign}`}>
          <EndStand sign={sign} crowd={crowd} crowdRows={crowdRows} ribbon={ribbon} />
          <AdBoard axis="z" sign={sign} ads={ads} />
        </group>
      ))}
      {[-1, 1].flatMap((sx) => [-1, 1].map((sz) => (
        <group key={`corner-${sx}-${sz}`}>
          <CornerLink sx={sx} sz={sz} crowdRows={crowdRows} />
          <CornerCanopy sx={sx} sz={sz} />
          <FloodlightTower sx={sx} sz={sz} />
        </group>
      )))}
      <CrowdPeople people={people} />
    </group>
  );
}
