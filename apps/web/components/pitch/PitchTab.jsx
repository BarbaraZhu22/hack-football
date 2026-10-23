"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Axis3D,
  Camera,
  Move3D,
  Pause,
  Play,
  RotateCcw,
  Snowflake,
  Target,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MATCH } from "@/lib/incident";
import { buildSimulation } from "@/lib/incident-simulation";
import { useScene } from "@/lib/scene/SceneProvider";
import { ContactEnvelope } from "@/components/three/ViewportChrome";
import Minimap from "@/components/three/ViewportMinimap";
import viewportStyles from "@/components/three/ViewportChrome.module.css";

const PitchCanvas = dynamic(() => import("@/components/three/PitchCanvas"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[340px] items-center justify-center rounded-lg border bg-muted/30 text-sm text-muted-foreground">
      Loading incident reconstruction…
    </div>
  ),
});
const ContactCameraScene = dynamic(() => import("@/components/three/Scene").then((module) => module.Scene), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-xs text-muted-foreground">Loading contact camera…</div>,
});

const CAMERA_OPTIONS = [
  { id: "broadcast", label: "Broadcast", icon: Camera, position: [40, 11, 24] },
  { id: "touchline", label: "Touchline", icon: Move3D, position: [34, 5, 22] },
  { id: "tactical", label: "Tactical", icon: Target, position: [27, 34, 10] },
  { id: "referee", label: "Referee", icon: Axis3D, position: [31, 4, 4] },
  { id: "free", label: "Free", icon: Axis3D, position: [40, 11, 24] },
];

const OVERLAYS = [
  { key: "skeleton", shortcut: "S" },
  { key: "trajectory", shortcut: "T" },
  { key: "forces", shortcut: "K" },
  { key: "labels", shortcut: "L" },
];

const STAGE_PARTS = {
  identity: true,
  status: true,
  cameras: true,
  overlays: true,
  contact: false,
  minimap: false,
  freeze: true,
  frameCorners: true,
  vignette: true,
  grain: true,
  footer: true,
  loading: true,
};

function timecode(time) {
  const seconds = Math.floor(time);
  const centiseconds = Math.floor((time - seconds) * 100);
  return `00:0${seconds}.${String(centiseconds).padStart(2, "0")}`;
}

export default function PitchTab() {
  const { state, run } = useScene();
  const simulation = useMemo(buildSimulation, []);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(1);
  const timeRef = useRef(state.incident.time);
  const time = state.incident.time;
  const activeEvent = simulation.events.reduce(
    (current, event) => (event.t <= time ? event : current),
    simulation.events[0],
  );

  timeRef.current = time;

  const seek = useCallback((nextTime) => {
    run([{ type: "incident.seek", time: nextTime }]);
  }, [run]);

  const setCamera = useCallback((preset) => {
    const option = CAMERA_OPTIONS.find((item) => item.id === preset) ?? CAMERA_OPTIONS[0];
    run([{
      type: "camera.set",
      preset,
      position: option.position,
      lookAt: [27, 0, 10],
    }]);
  }, [run]);

  const toggleOverlay = useCallback((key) => {
    run([{ type: "pitch.overlay.set", key, enabled: !state.overlays[key] }]);
  }, [run, state.overlays]);


  useEffect(() => {
    if (!playing) return undefined;

    let request = 0;
    let last = performance.now();
    let elapsed = 0;
    const advance = (now) => {
      const delta = Math.min(0.05, (now - last) / 1000);
      last = now;
      elapsed += delta;
      if (elapsed >= 1 / 24) {
        let next = timeRef.current + elapsed * rate;
        if (next >= simulation.duration) next = 0;
        timeRef.current = next;
        seek(next);
        elapsed = 0;
      }
      request = requestAnimationFrame(advance);
    };

    request = requestAnimationFrame(advance);
    return () => cancelAnimationFrame(request);
  }, [playing, rate, seek, simulation.duration]);

  useEffect(() => {
    const onKeyDown = (event) => {
      const target = event.target;
      if (target instanceof HTMLElement && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      if (event.code === "Space") {
        event.preventDefault();
        setPlaying((value) => !value);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        setPlaying(false);
        seek(timeRef.current - 1 / 60);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        setPlaying(false);
        seek(timeRef.current + 1 / 60);
      } else if (event.key.toLowerCase() === "f") {
        setPlaying(false);
        seek(state.incident.contactTime);
      } else {
        const overlay = OVERLAYS.find((item) => item.shortcut.toLowerCase() === event.key.toLowerCase());
        if (overlay) toggleOverlay(overlay.key);
        const camera = CAMERA_OPTIONS[Number(event.key) - 1];
        if (camera) setCamera(camera.id);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [seek, setCamera, state.incident.contactTime, toggleOverlay]);

  function playIncident() {
    seek(0.15);
    setCamera("broadcast");
    setPlaying(true);
  }

  function freezeContact() {
    seek(state.incident.contactTime);
    setCamera("touchline");
    setPlaying(false);
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Badge>3D incident review</Badge>
          <span className="truncate text-xs uppercase tracking-[0.12em] text-muted-foreground">{MATCH.competition} · {MATCH.round}</span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden items-center gap-2 text-xs text-muted-foreground sm:inline-flex">
            <span className="size-2 rounded-full bg-primary" /> Synthetic reconstruction
          </span>
          <Button size="sm" onClick={playIncident}><Play className="mr-1 size-4" /> Play incident</Button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1fr)_255px]">
        <div className="flex min-h-0 flex-col gap-3">
          <Card className="relative aspect-[2/1] min-h-[340px] shrink-0 overflow-hidden border-0 bg-transparent p-0 shadow-none">
            <PitchCanvas sim={simulation} timeRef={timeRef} onFreeze={freezeContact} viewportParts={STAGE_PARTS} />
          </Card>

          <Card>
            <CardContent className="space-y-3 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Button size="icon" variant="outline" aria-label="Restart incident" onClick={() => { setPlaying(false); seek(0); }}><RotateCcw className="size-4" /></Button>
                <Button size="icon" variant="outline" aria-label="Step back one frame" onClick={() => { setPlaying(false); seek(time - 1 / 60); }}><span className="text-sm">−1</span></Button>
                <Button size="icon" aria-label={playing ? "Pause" : "Play"} onClick={() => setPlaying((value) => !value)}>{playing ? <Pause className="size-4" /> : <Play className="size-4" />}</Button>
                <Button size="icon" variant="outline" aria-label="Step forward one frame" onClick={() => { setPlaying(false); seek(time + 1 / 60); }}><span className="text-sm">+1</span></Button>
                <Button size="sm" variant="outline" onClick={freezeContact}><Snowflake className="mr-1 size-4" /> Freeze contact</Button>
                <span className="ml-1 font-mono text-sm tabular-nums">{timecode(time)}</span>
                <span className="text-xs text-muted-foreground">of {timecode(simulation.duration)}</span>
                <div className="ml-auto flex gap-1">
                  {[0.25, 0.5, 1].map((speed) => (
                    <Button key={speed} size="sm" variant={rate === speed ? "secondary" : "ghost"} onClick={() => setRate(speed)}>{speed}×</Button>
                  ))}
                </div>
              </div>
              <input
                aria-label="Incident playback position"
                type="range"
                min="0"
                max={simulation.duration}
                step="0.008333"
                value={time}
                onChange={(event) => { setPlaying(false); seek(Number(event.target.value)); }}
                className="w-full accent-primary"
              />
              <div className="flex flex-wrap gap-1.5">
                {simulation.events.map((event) => (
                  <button
                    type="button"
                    key={event.id}
                    onClick={() => { seek(event.t); setPlaying(false); }}
                    className={`rounded-md border px-2 py-1 text-xs transition ${activeEvent.id === event.id ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
                  >
                    <span className="font-medium">{event.short}</span>
                    <span className="ml-1.5 font-mono text-[10px] opacity-70">{event.t.toFixed(2)}s</span>
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground"><span className="font-medium text-foreground">{activeEvent.label}:</span> {activeEvent.detail}</p>
            </CardContent>
          </Card>
        </div>

        <aside className="flex flex-col gap-3">
          <ContactEnvelope sim={simulation} onFreeze={freezeContact} variant="panel" />

          <div className={`${viewportStyles.insetFrame} ${viewportStyles.insetFramePanel}`}>
            <div className={viewportStyles.contactSceneLayer}>
              <ContactCameraScene
                sim={simulation}
                timeRef={timeRef}
                cameraPreset={state.camera.preset}
                showSkeleton={state.overlays.skeleton}
                showLabels={state.overlays.labels}
                showTrajectory={state.overlays.trajectory}
                showForces={state.overlays.forces}
                dual={false}
                contactView
              />
            </div>
            <div className={viewportStyles.insetHead}>
              <span><i /> CONTACT CAM</span>
              <span className={viewportStyles.recording}>REVERSE · SYNC</span>
            </div>
            <div className={viewportStyles.insetCorners}><i /><i /><i /><i /></div>
            <div className={viewportStyles.insetFoot}>
              <span>REVERSE ANGLE · ACHILLES</span>
              <span>ANGLE 02 · CAL ±2.8 CM</span>
            </div>
            <div className={viewportStyles.insetCrosshair} />
          </div>

          <Minimap sim={simulation} time={time} preset={state.camera.preset} variant="panel" />
        </aside>
      </div>
    </div>
  );
}
