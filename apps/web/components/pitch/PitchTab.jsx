"use client";

import dynamic from "next/dynamic";
import { Component, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLoader } from "@react-three/fiber";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";
import {
  Axis3D,
  Camera,
  ChevronDown,
  Move3D,
  Pause,
  Play,
  RotateCcw,
  Scan,
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
import { useIncidentReview } from "@/lib/incident-review-context";
import { useScene } from "@/lib/scene/SceneProvider";
import { getBodyModelUrl, getClipUrl } from "@/components/three/actions/catalog";
import { ContactEnvelope, OffsideEnvelope } from "@/components/pitch/ViewportChrome";
import IncidentTrackingFrame from "@/components/pitch/IncidentTrackingFrame";
import viewportStyles from "@/components/pitch/ViewportChrome.module.css";

const PitchCanvas = dynamic(() => import("@/components/three/PitchCanvas"), {
  ssr: false,
  loading: () => null,
});
const ContactCameraScene = dynamic(() => import("@/components/three/Scene").then((module) => module.Scene), {
  ssr: false,
  loading: () => null,
});

// Self-healing wrapper for the two WebGL viewports. The watchdog waits for a
// rendered frame, listens for context loss, and retries before surfacing an
// actionable message.
const SCENE_READY_TIMEOUT_MS = 4000;
const SCENE_MAX_RETRIES = 3;

function WarmupReady({ onReady }) {
  useEffect(() => {
    onReady();
  }, [onReady]);
  return null;
}

function OffsideAssetWarmup({ onReady }) {
  useLoader(FBXLoader, getClipUrl("soccerPass"));
  return <WarmupReady onReady={onReady} />;
}

// Populate the shared suspense cache before mounting either WebGL canvas.
function AssetWarmup({ incidentId, onReady }) {
  useLoader(GLTFLoader, getBodyModelUrl());
  useLoader(GLTFLoader, getClipUrl("run"));
  return incidentId === "offside"
    ? <OffsideAssetWarmup onReady={onReady} />
    : <WarmupReady onReady={onReady} />;
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
    if (this.props.onCrash) this.props.onCrash(error);
  }

  render() {
    if (this.state.crashed) return this.props.fallback ?? null;
    return this.props.children;
  }
}

function SceneSlot({ label, children, onReady, onFailure }) {
  const [attempt, setAttempt] = useState(0);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const hostRef = useRef(null);
  const retryTimerRef = useRef(null);

  const retry = useCallback(() => {
    setReady(false);
    if (onReady) onReady(false);
    if (attempt >= SCENE_MAX_RETRIES) {
      setFailed(true);
      if (onFailure) onFailure(true);
    } else {
      if (onFailure) onFailure(false);
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = window.setTimeout(() => {
        retryTimerRef.current = null;
        setAttempt((value) => value + 1);
      }, 400);
    }
  }, [attempt, onFailure, onReady]);

  useEffect(() => () => window.clearTimeout(retryTimerRef.current), []);

  const reportReady = useCallback(() => {
    window.clearTimeout(retryTimerRef.current);
    retryTimerRef.current = null;
    setReady(true);
    setFailed(false);
    if (onReady) onReady(true);
    if (onFailure) onFailure(false);
  }, [onFailure, onReady]);

  useEffect(() => {
    if (ready || failed) return undefined;
    const timer = window.setTimeout(() => {
      retry();
    }, SCENE_READY_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [attempt, failed, ready, retry]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    const handleContextLost = (event) => {
      event.preventDefault();
      retry();
    };
    host.addEventListener("webglcontextlost", handleContextLost, true);
    return () => host.removeEventListener("webglcontextlost", handleContextLost, true);
  }, [attempt, retry]);

  const retryManually = useCallback(() => {
    setAttempt(0);
    setReady(false);
    setFailed(false);
    if (onReady) onReady(false);
    if (onFailure) onFailure(false);
  }, [onFailure, onReady]);

  return (
    <div ref={hostRef} className="relative h-full min-h-0">
      {failed ? null : (
        <SceneErrorBoundary key={attempt} onCrash={retry} fallback={null}>
          {children({ onReady: reportReady, attempt })}
        </SceneErrorBoundary>
      )}
      {failed ? (
        <div className="absolute inset-0 z-20 grid place-items-center rounded-panel border bg-muted/30 p-4 text-center">
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">{label} could not start.</p>
            <Button size="sm" variant="outline" onClick={retryManually}>Try again</Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function IncidentLoadingOverlay({ isOffside, fading }) {
  return (
    <div className={`${viewportStyles.stageLoader} ${fading ? viewportStyles.stageLoaderDone : ""}`}>
      <div className={viewportStyles.loadInner}>
        <div className={viewportStyles.loadEmblem}>
          <div className={`${viewportStyles.ring} ${viewportStyles.ringOne}`} />
          <div className={`${viewportStyles.ring} ${viewportStyles.ringTwo}`} />
          <div className={`${viewportStyles.ring} ${viewportStyles.ringThree}`} />
          <Scan size={24} />
        </div>
        <span className={viewportStyles.eyebrow}>ARBITER RECONSTRUCTION ENGINE</span>
        <h2>Building the incident twin</h2>
        <p>{isOffside ? "Loading rig · calibrating pitch · timing pass" : "Loading rig · calibrating pitch · solving contact"}</p>
      </div>
    </div>
  );
}

function clearIncidentAssetCache() {
  useLoader.clear(GLTFLoader, getBodyModelUrl());
  useLoader.clear(GLTFLoader, getClipUrl("run"));
  useLoader.clear(FBXLoader, getClipUrl("soccerPass"));
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
  cameras: true,
  overlays: true,
  contact: false,
  minimap: false,
  frameCorners: true,
  vignette: true,
  grain: true,
  footer: true,
};

function timecode(time) {
  const seconds = Math.floor(time);
  const centiseconds = Math.floor((time - seconds) * 100);
  return `00:0${seconds}.${String(centiseconds).padStart(2, "0")}`;
}

function PlaybackControls({ playing, rate, setRate, setPlaying, seek, simulation, time, timeRef, onTimeChange }) {
  const [displayTime, setDisplayTime] = useState(time);
  const activeEvent = simulation.events.reduce(
    (current, event) => (event.t <= displayTime ? event : current),
    simulation.events[0],
  );

  useEffect(() => {
    if (!playing) {
      setDisplayTime(time);
      return undefined;
    }

    let request = 0;
    let lastUpdate = 0;
    const update = (now) => {
      if (now - lastUpdate >= 1000 / 30) {
        const currentTime = timeRef.current;
        setDisplayTime(currentTime);
        onTimeChange?.(currentTime);
        lastUpdate = now;
      }
      request = requestAnimationFrame(update);
    };
    request = requestAnimationFrame(update);
    return () => cancelAnimationFrame(request);
  }, [onTimeChange, playing, time, timeRef]);

  function togglePlayback() {
    if (!playing && timeRef.current >= simulation.duration) seek(0);
    setPlaying((value) => !value);
  }

  return (
    <Card className="min-h-0 flex-1 overflow-hidden">
      <CardContent className="h-full space-y-3 overflow-y-auto p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button size="icon" variant="outline" aria-label="Restart incident" onClick={() => { setPlaying(false); seek(0); }}><RotateCcw className="size-4" /></Button>
          <Button size="icon" variant="outline" aria-label="Step back one frame" onClick={() => { setPlaying(false); seek(timeRef.current - 1 / 60); }}><span className="text-sm">−1</span></Button>
          <Button size="icon" aria-label={playing ? "Pause" : "Play"} onClick={togglePlayback}>{playing ? <Pause className="size-4" /> : <Play className="size-4" />}</Button>
          <Button size="icon" variant="outline" aria-label="Step forward one frame" onClick={() => { setPlaying(false); seek(timeRef.current + 1 / 60); }}><span className="text-sm">+1</span></Button>
          <span className="ml-1 text-sm tabular-nums">{timecode(displayTime)}</span>
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
          value={displayTime}
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
              <span className="ml-1.5 desk-type-meta opacity-70">{event.t.toFixed(2)}s</span>
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground"><span className="font-medium text-foreground">{activeEvent.label}:</span> {activeEvent.detail}</p>
      </CardContent>
    </Card>
  );
}

export default function PitchTab() {
  const { state, run } = useScene();
  const { setReview } = useIncidentReview();
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(0.5);
  const [incidentId, setIncidentId] = useState(ACTIVE_INCIDENT_ID);
  const [offsideTime, setOffsideTime] = useState(0);
  const [canWarmAssets, setCanWarmAssets] = useState(false);
  const [assetState, setAssetState] = useState({ incidentId: null, status: "idle", attempt: 0, error: null });
  const assetAttemptsRef = useRef(new Map());
  const previousIncidentIdRef = useRef(incidentId);
  const searchParams = useSearchParams();
  const incident = INCIDENTS.find((item) => item.id === incidentId) ?? INCIDENTS[0];
  const incidentActive = incident.status === "active";
  const isOffside = incidentId === "offside";
  const currentAssetState = assetState.incidentId === incidentId ? assetState : null;
  const assetsReady = currentAssetState?.status === "ready";
  const assetsFailed = currentAssetState?.status === "error";
  const warmupAttempt = currentAssetState?.attempt ?? 0;
  const simulation = useMemo(
    () => isOffside ? buildOffsideSimulation() : buildSimulation(),
    [isOffside],
  );
  const time = isOffside ? offsideTime : state.incident.time;
  const contactTime = isOffside ? simulation.contactT : state.incident.contactTime;
  const timeRef = useRef(time);
  const playbackRef = useRef(null);
  const wasPlayingRef = useRef(false);
  const playingIncidentIdRef = useRef(incidentId);
  const activeEvent = simulation.events.reduce(
    (current, event) => (event.t <= time ? event : current),
    simulation.events[0],
  );

  useEffect(() => {
    if (playing) return;
    const event = incidentActive ? activeEvent : null;
    const assessment = incidentActive && isOffside ? simulation.offside : null;
    setReview((current) => {
      const sameEvent = (current?.event?.id ?? null) === (event?.id ?? null);
      const sameEvents = incidentActive
        ? current?.events === simulation.events
        : !current?.events?.length;
      if (
        current?.incident?.id === incident.id
        && sameEvent
        && current?.assessment === assessment
        && sameEvents
      ) {
        return current;
      }
      return {
        incident,
        event,
        events: incidentActive ? simulation.events : [],
        assessment,
      };
    });
  }, [activeEvent, incident, incidentActive, isOffside, playing, setReview, simulation.events, simulation.offside]);

  if (!playing && !wasPlayingRef.current) timeRef.current = time;

  useEffect(() => {
    setCanWarmAssets(true);
  }, []);

  const handleAssetsReady = useCallback(() => {
    assetAttemptsRef.current.delete(incidentId);
    setAssetState({ incidentId, status: "ready", attempt: 0, error: null });
  }, [incidentId]);

  const handleAssetsCrash = useCallback((error) => {
    const attempts = (assetAttemptsRef.current.get(incidentId) ?? 0) + 1;
    assetAttemptsRef.current.set(incidentId, attempts);
    if (attempts <= SCENE_MAX_RETRIES) {
      clearIncidentAssetCache();
      setAssetState({ incidentId, status: "loading", attempt: attempts, error: null });
      return;
    }
    setAssetState({ incidentId, status: "error", attempt: attempts, error });
  }, [incidentId]);

  const retryAssetWarmup = useCallback(() => {
    clearIncidentAssetCache();
    assetAttemptsRef.current.delete(incidentId);
    setAssetState({ incidentId, status: "loading", attempt: 0, error: null });
  }, [incidentId]);

  const seek = useCallback((nextTime) => {
    const boundedTime = Math.max(0, Math.min(simulation.duration, Number(nextTime) || 0));
    timeRef.current = boundedTime;
    if (isOffside) {
      setOffsideTime(boundedTime);
    } else {
      run([{ type: "incident.seek", time: boundedTime }]);
    }
  }, [isOffside, run, simulation.duration]);

  playbackRef.current = { isOffside, rate, duration: simulation.duration };

  useEffect(() => {
    if (playing) {
      if (!wasPlayingRef.current) playingIncidentIdRef.current = incidentId;
      wasPlayingRef.current = true;
      return;
    }
    if (!wasPlayingRef.current) return;
    wasPlayingRef.current = false;
    if (playingIncidentIdRef.current === incidentId) seek(timeRef.current);
  }, [incidentId, playing, seek]);

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

  const uiPressSeqRef = useRef(0);
  useEffect(() => {
    const press = state.uiPress;
    if (!press?.seq || press.seq === uiPressSeqRef.current) return;
    uiPressSeqRef.current = press.seq;
    const button = press.button;
    if (button.startsWith("camera.")) {
      setCamera(button.slice("camera.".length));
      return;
    }
    if (button.startsWith("overlay.")) {
      toggleOverlay(button.slice("overlay.".length));
      return;
    }
    if (button.startsWith("marker.")) {
      const name = button.slice("marker.".length);
      const marker = simulation.events.find((item) => item.short.toLowerCase() === name);
      if (!marker) return;
      setPlaying(false);
      seek(marker.t);
      return;
    }
    if (button.startsWith("rate.")) {
      const speed = Number(button.slice("rate.".length));
      if (speed === 0.25 || speed === 0.5 || speed === 1) setRate(speed);
      return;
    }
    if (button === "transport.play") {
      if (timeRef.current >= simulation.duration) seek(0);
      setPlaying(true);
      return;
    }
    if (button === "transport.pause") {
      setPlaying(false);
      return;
    }
    if (button === "transport.restart") {
      setPlaying(false);
      seek(0);
      return;
    }
    if (button === "transport.step_back") {
      setPlaying(false);
      seek(timeRef.current - 1 / 60);
      return;
    }
    if (button === "transport.step_forward") {
      setPlaying(false);
      seek(timeRef.current + 1 / 60);
    }
  }, [seek, setCamera, simulation.duration, simulation.events, state.uiPress, toggleOverlay]);


  useEffect(() => {
    if (!playing) return undefined;

    let request = 0;
    let last = performance.now();
    const advance = (now) => {
      const playback = playbackRef.current;
      if (!playback) return;
      const delta = Math.min(0.05, (now - last) / 1000);
      last = now;
      let next = timeRef.current + delta * playback.rate;
      if (next >= playback.duration) {
        if (playback.isOffside) {
          timeRef.current = playback.duration;
          setPlaying(false);
          return;
        }
        next = 0;
      }
      timeRef.current = next;
      request = requestAnimationFrame(advance);
    };

    request = requestAnimationFrame(advance);
    return () => cancelAnimationFrame(request);
  }, [playing]);

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
    timeRef.current = incidentId === "offside" ? 0 : state.incident.time;
    if (incidentId === "offside") {
      setOffsideTime(0);
      setCamera("broadcast");
    } else if (previousIncidentIdRef.current === "offside") {
      setCamera("touchline");
    }
    previousIncidentIdRef.current = incidentId;
  }, [incidentId, setCamera]);

  // Mount the WebGL viewports only after the page shell and every asset for
  // the selected incident are ready. This includes the pass clip used only
  // by the offside reconstruction.
  const [shellReady, setShellReady] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setShellReady(true), 300);
    return () => window.clearTimeout(timer);
  }, []);

  const [mainSceneReadyId, setMainSceneReadyId] = useState(null);
  const [contactSceneReadyId, setContactSceneReadyId] = useState(null);
  const [mainSceneFailedId, setMainSceneFailedId] = useState(null);
  const [contactSceneFailedId, setContactSceneFailedId] = useState(null);
  const handleMainSceneReady = useCallback((ready) => {
    setMainSceneReadyId(ready ? incidentId : null);
    if (!ready) setContactSceneReadyId(null);
  }, [incidentId]);
  const handleContactSceneReady = useCallback((ready) => {
    setContactSceneReadyId(ready ? incidentId : null);
  }, [incidentId]);
  const handleMainSceneFailure = useCallback((failed) => {
    setMainSceneFailedId(failed ? incidentId : null);
  }, [incidentId]);
  const handleContactSceneFailure = useCallback((failed) => {
    setContactSceneFailedId(failed ? incidentId : null);
  }, [incidentId]);
  const viewportLive = incidentActive && shellReady && assetsReady;
  const contactMounted = viewportLive && mainSceneReadyId === incidentId;
  const sceneFailed = mainSceneFailedId === incidentId || contactSceneFailedId === incidentId;
  const sceneStarting = incidentActive && !assetsFailed && !sceneFailed && (
    !canWarmAssets || !assetsReady || !shellReady ||
    mainSceneReadyId !== incidentId ||
    (contactMounted && contactSceneReadyId !== incidentId)
  );
  const [startupOverlayHidden, setStartupOverlayHidden] = useState(false);
  useEffect(() => {
    if (sceneStarting) {
      setStartupOverlayHidden(false);
      return undefined;
    }
    const timer = window.setTimeout(() => setStartupOverlayHidden(true), 450);
    return () => window.clearTimeout(timer);
  }, [incidentId, sceneStarting]);

  const incidentSwitcher = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="min-w-0 gap-2">
          <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: RATINGS.red.color }} />
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
              <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: RATINGS.red.color }} />
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              {item.status === "active" ? null : (
                <span className="desk-type-meta uppercase tracking-wider text-muted-foreground">Soon</span>
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

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col gap-4 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {incidentSwitcher}
          <span className="truncate text-xs uppercase tracking-[0.12em] text-muted-foreground">{MATCH.competition} · {MATCH.round}</span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden items-center gap-2 text-xs text-muted-foreground sm:inline-flex">
            <span className="size-2 rounded-full bg-primary" /> Synthetic reconstruction
          </span>
          <Button size="sm" variant="outline" onClick={freezeContact}>
            <Snowflake className="mr-1 size-4" /> {isOffside ? "Freeze pass" : "Freeze contact"}
          </Button>
          <Button size="sm" onClick={playIncident}><Play className="mr-1 size-4" /> Play incident</Button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_255px] lg:grid-rows-[minmax(0,1fr)]">
        {canWarmAssets && incidentActive && !assetsFailed ? (
          <SceneErrorBoundary
            key={`${incidentId}:${warmupAttempt}`}
            onCrash={handleAssetsCrash}
            fallback={null}
          >
            <Suspense fallback={null}>
              <AssetWarmup incidentId={incidentId} onReady={handleAssetsReady} />
            </Suspense>
          </SceneErrorBoundary>
        ) : null}

        <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden">
          <Card className="relative h-[500px] min-h-[500px] max-h-[500px] min-w-0 shrink-0 overflow-hidden border-0 bg-transparent p-0 shadow-none">
            {assetsFailed ? (
              <div className="grid h-full min-h-[340px] place-items-center rounded-panel border bg-muted/30 p-4 text-center">
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">Incident models could not be loaded.</p>
                  <Button size="sm" variant="outline" onClick={retryAssetWarmup}>Retry loading</Button>
                </div>
              </div>
            ) : viewportLive ? (
              <SceneSlot
                label="Incident view"
                onReady={handleMainSceneReady}
                onFailure={handleMainSceneFailure}
              >
                {({ onReady, attempt }) => (
                  <PitchCanvas
                    key={attempt}
                    sim={simulation}
                    timeRef={timeRef}
                    time={time}
                    viewportParts={STAGE_PARTS}
                    onReady={onReady}
                  />
                )}
              </SceneSlot>
            ) : null}
            {incidentActive && (sceneStarting || !startupOverlayHidden) ? (
              <IncidentLoadingOverlay isOffside={isOffside} fading={!sceneStarting} />
            ) : null}
          </Card>

          <PlaybackControls
            playing={playing}
            rate={rate}
            setRate={setRate}
            setPlaying={setPlaying}
            seek={seek}
            simulation={simulation}
            time={time}
            timeRef={timeRef}
            onTimeChange={isOffside ? setOffsideTime : undefined}
          />
        </div>

        <aside className="flex h-full min-h-0 flex-col gap-3 overflow-hidden">
          {isOffside
            ? <OffsideEnvelope sim={simulation} variant="panel" />
            : <ContactEnvelope sim={simulation} variant="panel" />}

          <div className={`${viewportStyles.insetFrame} ${viewportStyles.insetFramePanel}`}>
            <div className={viewportStyles.contactSceneLayer}>
              {contactMounted ? (
                <SceneSlot
                  label={isOffside ? "Pass camera" : "Contact camera"}
                  onReady={handleContactSceneReady}
                  onFailure={handleContactSceneFailure}
                >
                  {({ onReady, attempt }) => (
                    <ContactCameraScene
                      key={attempt}
                      sim={simulation}
                      timeRef={timeRef}
                      cameraPreset={state.camera.preset}
                      showSkeleton={state.overlays.skeleton}
                      showLabels={state.overlays.labels}
                      showTrajectory={state.overlays.trajectory}
                      showForces={state.overlays.forces}
                      dual={false}
                      contactView
                      onReady={onReady}
                    />
                  )}
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

          <IncidentTrackingFrame incident={incident} simulation={simulation} time={time} timeRef={timeRef} playing={playing} />
        </aside>
      </div>
    </div>
  );
}
