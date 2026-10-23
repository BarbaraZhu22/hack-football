"use client";

import { useScene } from "@/lib/scene/SceneProvider";
import { Activity, ArrowDownRight, ArrowUpRight, Bone, Eye, Focus, RotateCcw, ScanLine, Target } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ACTUAL_DECISION, CRITERIA, MATCH, METRICS } from "@/lib/incident";

const CAMERAS = [
  { id: "broadcast", label: "Broadcast", position: [40, 11, 24] },
  { id: "touchline", label: "Touchline", position: [34, 5, 22] },
  { id: "tactical", label: "Tactical", position: [27, 34, 10] },
  { id: "referee", label: "Referee", position: [31, 4, 4] },
  { id: "free", label: "Free orbit", position: [40, 11, 24] },
];

const OVERLAY_LIST = [
  { id: "skeleton", label: "Skeleton rig", icon: Bone, detail: "Expose the joint chain and contact pose." },
  { id: "labels", label: "Player labels", icon: Eye, detail: "Show club and shirt number tags." },
  { id: "trajectory", label: "Movement trails", icon: Activity, detail: "Trace each player's recent path." },
  { id: "forces", label: "Force vector", icon: Focus, detail: "Mark the contact point and impulse direction." },
  { id: "dual", label: "Contact view", icon: ScanLine, detail: "Show a synchronized reverse-angle preview." },
];

export default function TacticsTab() {
  const { run, state } = useScene();

  function setCamera(camera) {
    run([{
      type: "camera.set",
      preset: camera.id,
      position: camera.position,
      lookAt: [27, 0, 10],
    }]);
  }

  function toggleOverlay(key) {
    run([{ type: "pitch.overlay.set", key, enabled: !state.overlays[key] }]);
  }

  function showContactProfile() {
    run([
      { type: "incident.seek", time: state.incident.contactTime },
      { type: "camera.set", preset: "touchline", position: [34, 5, 22], lookAt: [27, 0, 10] },
      { type: "arrow.add", id: "tackler-entry", from: [24.35, 0.22, -3.6], to: [27.9, 0.22, 9.45] },
      { type: "arrow.add", id: "carrier-run", from: [28.48, 0.22, 2.35], to: [27.96, 0.22, 10.02] },
      { type: "highlight", target: "player", id: "6" },
    ]);
  }

  function showBallRelease() {
    run([
      { type: "incident.seek", time: state.incident.contactTime + 0.04 },
      { type: "camera.set", preset: "broadcast", position: [40, 11, 24], lookAt: [29, 0, 12] },
      { type: "arrow.add", id: "ball-release", from: [28.8, 0.2, 10.7], to: [35.2, 0.2, 21] },
      { type: "highlight", target: "player", id: "8" },
    ]);
  }

  function clearOverlays() {
    run([
      { type: "arrow.clear" },
      { type: "highlight", target: "player", id: null },
      ...OVERLAY_LIST.map((overlay) => ({ type: "pitch.overlay.set", key: overlay.id, enabled: overlay.id === "labels" || overlay.id === "trajectory" || overlay.id === "forces" })),
    ]);
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="mb-1 flex items-center gap-2"><Badge>Tactics board</Badge><span className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Scene commands</span></div>
        <h1 className="text-2xl font-semibold tracking-tight">Reconstruct the challenge</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">Use synchronized camera views, movement overlays and scene commands to inspect the side-rear entry and contact profile.</p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-4">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0"><div><CardTitle className="text-base">Camera presets</CardTitle><p className="mt-1 text-xs text-muted-foreground">Choose an angle for the shared 3D scene.</p></div><Target className="size-5 text-primary" /></CardHeader>
            <CardContent className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {CAMERAS.map((camera) => (
                <Button key={camera.id} size="sm" variant={state.camera.preset === camera.id ? "secondary" : "outline"} onClick={() => setCamera(camera)}>{camera.label}</Button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0"><div><CardTitle className="text-base">Analysis overlays</CardTitle><p className="mt-1 text-xs text-muted-foreground">Overlay state and scene position persist when switching tabs.</p></div><Badge variant="outline">{Object.values(state.overlays).filter(Boolean).length} active</Badge></CardHeader>
            <CardContent className="space-y-2">
              {OVERLAY_LIST.map((overlay) => {
                const Icon = overlay.icon;
                const enabled = state.overlays[overlay.id];
                return (
                  <div key={overlay.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className={`grid size-9 shrink-0 place-items-center rounded-md ${enabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}><Icon className="size-4" /></span>
                      <span className="min-w-0"><b className="block text-sm">{overlay.label}</b><span className="block text-xs text-muted-foreground">{overlay.detail}</span></span>
                    </div>
                    <Button size="sm" variant={enabled ? "secondary" : "outline"} aria-pressed={enabled} onClick={() => toggleOverlay(overlay.id)}>{enabled ? "On" : "Off"}</Button>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Command presets</CardTitle><p className="text-sm text-muted-foreground">These actions use the same scene API as agent responses.</p></CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border p-4">
                <div className="flex items-center gap-2"><ArrowDownRight className="size-4 text-primary" /><b className="text-sm">Side-rear contact</b></div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">Freeze first contact, switch to the touchline view, trace both runs and highlight the tackler.</p>
                <Button size="sm" className="mt-3" onClick={showContactProfile}>Show contact profile</Button>
              </div>
              <div className="rounded-lg border p-4">
                <div className="flex items-center gap-2"><ArrowUpRight className="size-4 text-primary" /><b className="text-sm">Ball release</b></div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">Move 43 ms past player contact and draw the ball's release path away from the challenge.</p>
                <Button size="sm" variant="outline" className="mt-3" onClick={showBallRelease}>Show ball release</Button>
              </div>
              <div className="flex flex-wrap gap-2 md:col-span-2">
                <Button size="sm" variant="outline" onClick={clearOverlays}><RotateCcw className="mr-1 size-4" /> Clear overlays</Button>
                <Button size="sm" variant="ghost" onClick={() => run([{ type: "reset" }])}>Reset scene</Button>
                <span className="self-center text-xs text-muted-foreground">{state.arrows.length} tactical path{state.arrows.length === 1 ? "" : "s"} · {state.incident.time.toFixed(2)} s</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Contact kinematics</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {METRICS.map((metric) => (
                <div key={metric.label} className="rounded-md border p-3"><span className="text-xs text-muted-foreground">{metric.label}</span><div className="mt-1 font-mono text-lg">{metric.value} <span className="text-xs text-muted-foreground">{metric.unit}</span></div><span className="text-[11px] text-muted-foreground">{metric.cue}</span></div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Decision context</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Incident</span><b>{MATCH.incidentId}</b></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Assessment</span><b>Serious foul play</b></div>
              <div className="flex justify-between"><span className="text-muted-foreground">On-field</span><b>{ACTUAL_DECISION.onField}</b></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Panel vote</span><b>{ACTUAL_DECISION.panelVote}</b></div>
              <p className="border-t pt-3 text-xs leading-5 text-muted-foreground">{ACTUAL_DECISION.disclaimer}</p>
            </CardContent>
          </Card>
          <div className="rounded-lg border bg-muted/30 p-3 text-xs leading-5 text-muted-foreground">
            <p className="font-medium text-foreground">Keys</p>
            <p className="mt-1">Space play / pause · ← / → frame step · F freeze contact · 1–5 camera · S skeleton · T trails · K forces · L labels · D dual view</p>
            <p className="mt-2">Criteria cues: {CRITERIA.map((item) => item.label.toLowerCase()).join(" · ")}</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
