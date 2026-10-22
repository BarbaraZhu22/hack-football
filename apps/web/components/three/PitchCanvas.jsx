"use client";

import { Canvas } from "@react-three/fiber";
import { Line, OrbitControls } from "@react-three/drei";

import { useScene } from "@/lib/scene/SceneProvider";

function PitchField() {
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[40, 26]} />
        <meshStandardMaterial color="#2d6a3e" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <planeGeometry args={[38, 24]} />
        <meshStandardMaterial color="#3f8f55" />
      </mesh>
    </>
  );
}

function SceneContent() {
  const { state } = useScene();
  const { camera, players, ball, arrows, highlight } = state;

  return (
    <>
      <color attach="background" args={["#0b1410"]} />
      <ambientLight intensity={0.65} />
      <directionalLight position={[10, 20, 8]} intensity={1.1} />
      <PitchField />

      {players.map((player) => {
        const isHighlighted =
          highlight?.target === "player" && highlight.id === player.id;
        const color = player.team === "away" ? "#60a5fa" : "#f472b6";
        return (
          <mesh
            key={player.id}
            position={player.position}
            scale={isHighlighted ? 1.35 : 1}
          >
            <sphereGeometry args={[0.45, 24, 24]} />
            <meshStandardMaterial color={isHighlighted ? "#fef08a" : color} />
          </mesh>
        );
      })}

      <mesh position={ball.position}>
        <sphereGeometry args={[0.25, 24, 24]} />
        <meshStandardMaterial color="#f8fafc" />
      </mesh>

      {arrows.map((arrow) => (
        <Line
          key={arrow.id}
          points={[arrow.from, arrow.to]}
          color="#fef08a"
          lineWidth={2}
        />
      ))}

      <OrbitControls
        target={camera.lookAt}
        enablePan
        maxPolarAngle={Math.PI / 2.1}
      />
    </>
  );
}

export default function PitchCanvas() {
  const { state } = useScene();

  return (
    <div className="h-full min-h-[320px] w-full overflow-hidden rounded-xl border bg-card">
      <Canvas
        camera={{
          position: state.camera.position,
          fov: 45,
          near: 0.1,
          far: 200,
        }}
      >
        <SceneContent />
      </Canvas>
    </div>
  );
}
