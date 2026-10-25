"use client";

import dynamic from "next/dynamic";
import { Component, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLoader } from "@react-three/fiber";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import {
  Axis3D,
  Camera,
  ChevronDown,
  Move3D,
  Pause,
  Play,
  RotateCcw,
  Snowflake,
  Target,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MATCH } from "@/lib/incident";
import { ACTIVE_INCIDENT_ID, INCIDENTS, RATINGS } from "@/lib/incidents";
import { buildSimulation } from "@/lib/incident-simulation";
import { buildOffsideSimulation } from "@/lib/offside-simulation";
import { useScene } from "@/lib/scene/SceneProvider";
import { getBodyModelUrl, getClipUrl } from "@/components/three/actions/catalog";
import { ContactEnvelope, OffsideEnvelope } from "@/components/pitch/ViewportChrome";
import Minimap from "@/components/pitch/ViewportMinimap";
import viewportStyles from "@/components/pitch/ViewportChrome.module.css";

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

// Self-healing wrapper for the two WebGL viewports. A long dev session can
// leave a dynamic import pointing at a stale chunk or an aborted asset fetch,
// which surfaces as a permanently blank viewport. The boundary catches hard
// errors, the watchdog remounts a viewport that never produced a live canvas,
// and both retry a limited number of times before surfacing a message.
const SCENE_READY_TIMEOUT_MS = 4000;
const SCENE_MAX_RETRIES = 3;

// Populates the shared suspense cache for the two gltf assets. Effects in
// this component only run once the loads have resolved, so onReady fires
// exactly when the cache is warm.
function AssetWarmup({ onReady }) {
  useLoader(GLTFLoader, getBodyModelUrl());
  useLoader(GLTFLoader, getClipUrl("run"));
  useEffect(() => {
    onReady();
  }, [onReady]);
  return null;
}

class SceneErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { crashed: false };
  }

  static getDerivedStateFromError() {
    return { crashed: true };
  }

  componentDidCatch(error) {
    if (typeof console !== "undefined" && console.warn) {
      console.warn("Viewport boundary caught an error:", error);
    }
    if (this.props.onCrash) this.props.onCrash();
  }

  render() {
    if (this.state.crashed) return this.props.fallback ?? null;
    return this.props.children;
  }
}

function SceneSlot({ label, children }) {
  const [attempt, setAttempt] = useState(0);
  const hostRef = useRef(null);
  const exhausted = attempt >= SCENE_MAX_RETRIES;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const host = hostRef.current;
      const canvas = host ? host.querySelector("canvas") : null;
      const live = canvas && canvas.width > 0 && canvas.height > 0;
      if (!exhausted && !live) {
        setAttempt((value) => value + 1);
      }
    }, SCENE_READY_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [attempt, exhausted]);

  const retry = useCallback(() => {
    if (!exhausted) {
      window.setTimeout(() => setAttempt((value) => value + 1), 400);
    }
  }, [exhausted]);

  return (
    <div ref={hostRef} className="h-full">
      <SceneErrorBoundary
        key={attempt}
        onCrash={retry}
        fallback={
          <div className="grid h-full place-items-center rounded-lg border bg-muted/30 p-4 text-center text-xs text-muted-foreground">
            {label} could not start.{exhausted ? " Reload the page to retry." : " Retrying…"}
          </div>
        }
      >
        {children}
      </SceneErrorBoundary>
    </div>
  );
}

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
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(0.5);
  const [incidentId, setIncidentId] = useState(ACTIVE_INCIDENT_ID);
  const [offsideTime, setOffsideTime] = useState(0);
  const [canWarmAssets, setCanWarmAssets] = useState(false);
  const previousIncidentIdRef = useRef(incidentId);
  const searchParams = useSearchParams();
  const incident = INCIDENTS.find((item) => item.id === incidentId) ?? INCIDENTS[0];
  const incidentActive = incident.status === "active";
  const isOffside = incidentId === "offside";
  const simulation = useMemo(
    () => isOffside ? buildOffsideSimulation() : buildSimulation(),
    [isOffside],
  );
  const time = isOffside ? offsideTime : state.incident.time;
  const contactTime = isOffside ? simulation.contactT : state.incident.contactTime;
  const timeRef = useRef(time);
  const activeEvent = simulation.events.reduce(
    (current, event) => (event.t <= time ? event : current),
    simulation.events[0],
  );

  timeRef.current = time;

  useEffect(() => {
    setCanWarmAssets(true);
  }, []);

  const seek = useCallback((nextTime) => {
    const boundedTime = Math.max(0, Math.min(simulation.duration, Number(nextTime) || 0));
    if (isOffside) {
      setOffsideTime(boundedTime);
    } else {
      run([{ type: "incident.seek", time: boundedTime }]);
    }
  }, [isOffside, run, simulation.duration]);

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
    const frameInterval = isOffside ? 1 / 60 : 1 / 24;
    const advance = (now) => {
      const delta = Math.min(0.05, (now - last) / 1000);
      last = now;
      elapsed += delta;
      if (elapsed >= frameInterval) {
        let next = timeRef.current + elapsed * rate;
        if (next >= simulation.duration) {
          if (isOffside) {
            next = simulation.duration;
            setPlaying(false);
          } else {
            next = 0;
          }
        }
        timeRef.current = next;
        seek(next);
        elapsed = 0;
      }
      request = requestAnimationFrame(advance);
    };

    request = requestAnimationFrame(advance);
    return () => cancelAnimationFrame(request);
  }, [isOffside, playing, rate, seek, simulation.duration]);

  useEffect(() => {
    const onKeyDown = (event) => {
      const target = event.target;
      if (target instanceof HTMLElement && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      if (event.code === "Space") {
        event.preventDefault();
        if (isOffside && !playing && timeRef.current >= simulation.duration) seek(0);
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
        seek(contactTime);
      } else {
        const overlay = OVERLAYS.find((item) => item.shortcut.toLowerCase() === event.key.toLowerCase());
        if (overlay) toggleOverlay(overlay.key);
        const camera = CAMERA_OPTIONS[Number(event.key) - 1];
        if (camera) setCamera(camera.id);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [contactTime, isOffside, playing, seek, setCamera, simulation.duration, toggleOverlay]);

  // Deep link support: /pitch?incident=offside preselects that incident when
  // arriving from an overview event point.
  useEffect(() => {
    const param = searchParams.get("incident");
    if (param && INCIDENTS.some((item) => item.id === param)) {
      setIncidentId(param);
    }
  }, [searchParams]);

  useEffect(() => {
    setPlaying(false);
    if (incidentId === "offside") {
      setOffsideTime(0);
      setCamera("broadcast");
    } else if (previousIncidentIdRef.current === "offside") {
      setCamera("touchline");
    }
    previousIncidentIdRef.current = incidentId;
  }, [incidentId, setCamera]);

  // Mount the WebGL viewports only after the page shell has settled and the
  // gltf assets are warm in the shared loader cache. Mounting the viewports
  // while the assets are still cold - which is what a direct load or refresh
  // does - leaves the actor rigs in a broken state. Warming the cache first
  // routes every entry point through the same reliable path that switching
  // incidents already uses.
  const [shellReady, setShellReady] = useState(false);
  const [assetsReady, setAssetsReady] = useState(false);
  const handleAssetsReady = useCallback(() => setAssetsReady(true), []);
  useEffect(() => {
    const timer = window.setTimeout(() => setShellReady(true), 300);
    return () => window.clearTimeout(timer);
  }, []);

  // The contact camera mounts shortly after the main viewport instead of in
  // the same commit. Creating both WebGL contexts simultaneously is flaky at
  // load time (one of the two silently fails); staggering them reproduces the
  // reliable sequential path that users observe when switching incidents.
  const viewportLive = incidentActive && shellReady && assetsReady;
  const [contactMounted, setContactMounted] = useState(false);
  useEffect(() => {
    if (!viewportLive) {
      setContactMounted(false);
      return undefined;
    }
    const timer = window.setTimeout(() => setContactMounted(true), 350);
    return () => window.clearTimeout(timer);
  }, [viewportLive]);

  const incidentSwitcher = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="min-w-0 gap-2">
          <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: RATINGS[incident.rating].color }} />
          <span className="truncate">{incident.label}</span>
          <ChevronDown className="size-4 shrink-0 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel>Controversial decisions</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={incidentId} onValueChange={setIncidentId}>
          {INCIDENTS.map((item) => (
            <DropdownMenuRadioItem key={item.id} value={item.id} className="gap-2">
              <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: RATINGS[item.rating].color }} />
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              {item.status === "active" ? null : (
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Soon</span>
              )}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  function playIncident() {
    seek(isOffside ? 0 : 0.15);
    setCamera("broadcast");
    setPlaying(true);
  }

  function freezeContact() {
    seek(contactTime);
    setCamera(isOffside ? "broadcast" : "touchline");
    setPlaying(false);
  }

  function togglePlayback() {
    if (!playing && isOffside && time >= simulation.duration) seek(0);
    setPlaying((value) => !value);
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {incidentSwitcher}
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
        {canWarmAssets && incidentActive ? (
          <SceneErrorBoundary onCrash={handleAssetsReady} fallback={null}>
            <Suspense fallback={null}>
              <AssetWarmup onReady={handleAssetsReady} />
            </Suspense>
          </SceneErrorBoundary>
        ) : null}

        <div className="flex min-h-0 flex-col gap-3">
          <Card className="relative aspect-[2/1] min-h-[340px] shrink-0 overflow-hidden border-0 bg-transparent p-0 shadow-none">
            {viewportLive ? (
              <SceneSlot label="Incident view">
                <PitchCanvas sim={simulation} timeRef={timeRef} time={time} onFreeze={freezeContact} viewportParts={STAGE_PARTS} />
              </SceneSlot>
            ) : null}
          </Card>

          <Card>
            <CardContent className="space-y-3 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Button size="icon" variant="outline" aria-label="Restart incident" onClick={() => { setPlaying(false); seek(0); }}><RotateCcw className="size-4" /></Button>
                <Button size="icon" variant="outline" aria-label="Step back one frame" onClick={() => { setPlaying(false); seek(time - 1 / 60); }}><span className="text-sm">−1</span></Button>
                <Button size="icon" aria-label={playing ? "Pause" : "Play"} onClick={togglePlayback}>{playing ? <Pause className="size-4" /> : <Play className="size-4" />}</Button>
                <Button size="icon" variant="outline" aria-label="Step forward one frame" onClick={() => { setPlaying(false); seek(time + 1 / 60); }}><span className="text-sm">+1</span></Button>
                <Button size="sm" variant="outline" onClick={freezeContact}><Snowflake className="mr-1 size-4" /> {isOffside ? "Freeze pass" : "Freeze contact"}</Button>
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
          {isOffside
            ? <OffsideEnvelope sim={simulation} onFreeze={freezeContact} variant="panel" />
            : <ContactEnvelope sim={simulation} onFreeze={freezeContact} variant="panel" />}

          <div className={`${viewportStyles.insetFrame} ${viewportStyles.insetFramePanel}`}>
            <div className={viewportStyles.contactSceneLayer}>
              {contactMounted ? (
                <SceneSlot label={isOffside ? "Pass camera" : "Contact camera"}>
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
                </SceneSlot>
              ) : null}
            </div>
            <div className={viewportStyles.insetHead}>
              <span><i /> {isOffside ? "PASS CAM" : "CONTACT CAM"}</span>
              <span className={viewportStyles.recording}>REVERSE · SYNC</span>
            </div>
            <div className={viewportStyles.insetCorners}><i /><i /><i /><i /></div>
            <div className={viewportStyles.insetFoot}>
              <span>{isOffside ? "REVERSE ANGLE · PASS RELEASE" : "REVERSE ANGLE · ACHILLES"}</span>
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
