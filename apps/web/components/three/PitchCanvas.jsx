"use client";

import { useEffect, useRef, useState } from "react";
import { Scan } from "lucide-react";
import styles from "./ViewportChrome.module.css";
import { Scene } from "@/components/three/Scene";
import ViewportChrome from "@/components/three/ViewportChrome";
import { useScene } from "@/lib/scene/SceneProvider";

export default function PitchCanvas({ sim, timeRef, onFreeze, viewportParts }) {
  const { state, run } = useScene();
  const previousLoaderSetting = useRef(viewportParts.loading);
  const [loaded, setLoaded] = useState(false);
  const [loaderHidden, setLoaderHidden] = useState(false);
  const [loaderFading, setLoaderFading] = useState(false);
  const [progress, setProgress] = useState(6);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setProgress((value) => value < 88 ? Math.min(88, value + Math.random() * 9) : value);
    }, 260);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!loaded) return undefined;
    setProgress(100);
    setLoaderFading(true);
    const timer = window.setTimeout(() => setLoaderHidden(true), 450);
    return () => window.clearTimeout(timer);
  }, [loaded]);

  useEffect(() => {
    if (viewportParts.loading && !previousLoaderSetting.current) {
      setLoaderHidden(false);
      setLoaderFading(false);
    } else if (!viewportParts.loading) {
      setLoaderHidden(true);
    }
    previousLoaderSetting.current = viewportParts.loading;
  }, [loaded, viewportParts.loading]);

  const onReady = () => setLoaded(true);

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
        time={state.incident.time}
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
        onFreeze={onFreeze}
        parts={viewportParts}
      />
      {viewportParts.loading && !loaderHidden && (
        <div className={`${styles.stageLoader} ${loaderFading ? styles.stageLoaderDone : ""}`}>
          <div className={styles.loadInner}>
            <div className={styles.loadEmblem}>
              <div className={`${styles.ring} ${styles.ringOne}`} />
              <div className={`${styles.ring} ${styles.ringTwo}`} />
              <div className={`${styles.ring} ${styles.ringThree}`} />
              <Scan size={24} />
            </div>
            <span className={styles.eyebrow}>ARBITER RECONSTRUCTION ENGINE</span>
            <h2>Building the incident twin</h2>
            <p>Loading rig · calibrating pitch · solving contact</p>
            <div className={styles.loadBar}><span style={{ width: `${progress}%` }} /></div>
            <div className={styles.loadRow}>
              <span>{progress < 100 ? "ASSEMBLING SCENE" : "READY"}</span>
              <b>{Math.min(100, Math.round(progress))}%</b>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
