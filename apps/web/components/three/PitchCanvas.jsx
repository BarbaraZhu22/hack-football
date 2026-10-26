"use client";

import { Scene } from "@/components/three/Scene";
import styles from "@/components/pitch/ViewportChrome.module.css";
import ViewportChrome from "@/components/pitch/ViewportChrome";
import { useScene } from "@/lib/scene/SceneProvider";

export default function PitchCanvas({ sim, timeRef, time, viewportParts, onReady }) {
  const { state, run } = useScene();

  return (
    <div className={styles.stageFrame}>
      <div className={styles.sceneLayer}>
        <Scene
          sim={sim}
          timeRef={timeRef}
          cameraPreset={state.camera.preset}
          showSkeleton={state.overlays.skeleton}
          showLabels={state.overlays.labels}
          showTrajectory={state.overlays.trajectory}
          showForces={state.overlays.forces}
          dual={false}
          onReady={onReady}
        />
      </div>
      <ViewportChrome
        sim={sim}
        time={time ?? state.incident.time}
        cameraPreset={state.camera.preset}
        onCamera={(preset) => {
          const option = {
            broadcast: [40, 11, 24],
            touchline: [34, 5, 22],
            tactical: [27, 34, 10],
            referee: [31, 4, 4],
            free: [40, 11, 24],
          }[preset];
          run([{ type: "camera.set", preset, position: option, lookAt: [27, 0, 10] }]);
        }}
        overlays={state.overlays}
        onOverlay={(key) => run([{ type: "pitch.overlay.set", key, enabled: !state.overlays[key] }])}
        parts={viewportParts}
      />
    </div>
  );
}
