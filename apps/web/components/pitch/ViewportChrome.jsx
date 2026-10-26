"use client";

import {
  Activity,
  Axis3D,
  Bone,
  Camera,
  Crosshair,
  Eye,
  EyeOff,
  Gauge,
  Layers3,
  Move3D,
  PersonStanding,
  Route,
  Scan,
  ShieldCheck,
  Target,
  Users,
} from "lucide-react";

import { MATCH } from "@/lib/incident";
import styles from "./ViewportChrome.module.css";
import Minimap from "./ViewportMinimap";

const CAMERAS = [
  { id: "broadcast", label: "Broadcast", key: "1", icon: Camera },
  { id: "touchline", label: "Touchline", key: "2", icon: Move3D },
  { id: "tactical", label: "Tactical", key: "3", icon: Target },
  { id: "referee", label: "Referee", key: "4", icon: PersonStanding },
  { id: "free", label: "Free", key: "5", icon: Axis3D },
];

export default function ViewportChrome({
  sim,
  time,
  cameraPreset,
  onCamera,
  overlays,
  onOverlay,
  parts,
}) {
  const offside = sim.kind === "offside";
  const frozen = offside
    ? time >= sim.contactT
    : Math.abs(time - sim.contactT) < 0.035;

  return (
    <>
      {parts.identity && (
        <div className={styles.stageTitle}>
          <div className={styles.incidentTag}>
          <span className={styles.liveDot} /> INCIDENT {offside ? "02" : "04"} · <b>{offside ? "27:10" : MATCH.clock}</b>
          </div>
          <h2>{offside ? "Offside position" : "Serious foul play"}<span>?</span></h2>
          <p>{offside ? "Pass release · second-last-opponent line" : "Late sliding challenge · contact above the ankle · no ball first"}</p>
          <div className={styles.stageMeta}>
            <span>MCI {MATCH.score[0]}–{MATCH.score[1]} ARS</span>
            <i />
            <span>{MATCH.stadium.toUpperCase()}</span>
            <i />
            <span>REVIEW COMPLETE</span>
          </div>
        </div>
      )}

      {parts.cameras && (
        <div className={styles.cameraDock}>
          <div className={styles.dockLabel}><Scan size={12} /> CAMERA</div>
          <div className={styles.cameraButtons}>
            {CAMERAS.map((camera) => {
              const Icon = camera.icon;
              return (
                <button
                  key={camera.id}
                  className={cameraPreset === camera.id ? styles.on : ""}
                  onClick={() => onCamera(camera.id)}
                  aria-label={`${camera.label} camera, shortcut ${camera.key}`}
                  aria-pressed={cameraPreset === camera.id}
                >
                  <Icon size={13} />
                  <span>{camera.label}</span>
                  <kbd>{camera.key}</kbd>
                  <span className={styles.buttonTooltip} aria-hidden="true">{camera.label} · {camera.key}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {parts.overlays && (
        <div className={styles.overlayDock}>
          <button className={overlays.skeleton ? styles.on : ""} onClick={() => onOverlay("skeleton")} aria-pressed={overlays.skeleton} aria-label="Skeleton overlay, shortcut S">
            <Bone size={13} /> <span>Skeleton</span><kbd>S</kbd><span className={styles.buttonTooltip} aria-hidden="true">Skeleton · S</span>
          </button>
          <button className={overlays.trajectory ? styles.on : ""} onClick={() => onOverlay("trajectory")} aria-pressed={overlays.trajectory} aria-label="Trails overlay, shortcut T">
            <Route size={13} /> <span>Trails</span><kbd>T</kbd><span className={styles.buttonTooltip} aria-hidden="true">Trails · T</span>
          </button>
          <button className={overlays.forces ? styles.on : ""} onClick={() => onOverlay("forces")} aria-pressed={overlays.forces} aria-label="Forces overlay, shortcut K">
            <Activity size={13} /> <span>Forces</span><kbd>K</kbd><span className={styles.buttonTooltip} aria-hidden="true">Forces · K</span>
          </button>
          <button className={overlays.labels ? styles.on : ""} onClick={() => onOverlay("labels")} aria-pressed={overlays.labels} aria-label="Tags overlay, shortcut L">
            {overlays.labels ? <Eye size={13} /> : <EyeOff size={13} />} <span>Tags</span><kbd>L</kbd><span className={styles.buttonTooltip} aria-hidden="true">Tags · L</span>
          </button>
        </div>
      )}

      {parts.contact && <ContactEnvelope sim={sim} />}

      {parts.minimap && <Minimap sim={sim} time={time} preset={cameraPreset} />}

      {parts.freeze && frozen && (
        <div className={styles.freezeBadge}>
          <span className={styles.freezeBars}><i /><i /><i /></span>
          {offside ? "PASS RELEASE" : "FRAME HELD"} · 100 FPS
        </div>
      )}

      {parts.frameCorners && <div className={styles.frameCorners}><i /><i /><i /><i /></div>}
      {parts.vignette && <div className={styles.stageVignette} />}
      {parts.grain && <div className={styles.stageGrain} />}

      {parts.footer && (
        <div className={styles.stageFooter}>
          <span><ShieldCheck size={12} /> RF-7829 / CAM 02</span>
          <span><Layers3 size={12} /> 65-JOINT IK · {offside ? "PASS RETARGET" : "CONTACT SOLVER"}</span>
          <span className={styles.credit}>MODEL · QUATERNIUS CC0</span>
          <span><Gauge size={12} /> 120 HZ DETERMINISTIC</span>
          <span className={styles.footerRight}><Users size={12} /> {offside ? 3 : 2} TRACKED SUBJECTS</span>
        </div>
      )}
    </>
  );
}

export function ContactEnvelope({ sim, variant = "viewport" }) {
  const className = variant === "panel" ? styles.eventCardPanel : styles.eventCard;

  return (
    <section className={className}>
      <div className={styles.eventCardHead}><Crosshair size={13} /> CONTACT ENVELOPE</div>
      <div className={styles.eventRows}>
        <div><span>Point of contact</span><b>{sim.impact.point.y.toFixed(2)} <small>m</small></b></div>
        <div><span>Closing speed</span><b>{sim.meta.speed.closing.toFixed(1)} <small>m/s</small></b></div>
        <div><span>Peak contact force</span><b>{(sim.impact.peakForce / 1000).toFixed(1)} <small>kN</small></b></div>
        <div><span>Contact duration</span><b>{Math.round(sim.impact.duration * 1000)} <small>ms</small></b></div>
        <div><span>Severity index</span><b>0.87 <small>/1</small></b></div>
        <div><span>Ball contact</span><b className={styles.danger}>+{Math.round(sim.impact.ballDelay * 1000)} <small>ms</small></b></div>
      </div>
    </section>
  );
}

export function OffsideEnvelope({ sim, variant = "viewport" }) {
  const className = variant === "panel" ? styles.eventCardPanel : styles.eventCard;
  const margin = sim.offside.receiverMargin;

  return (
    <section className={className}>
      <div className={styles.eventCardHead}><Crosshair size={13} /> OFFSIDE REVIEW</div>
      <div className={styles.eventRows}>
        <div><span>Review frame</span><b>PASS RELEASE</b></div>
        <div><span>Second-last opponent</span><b>MCI #16</b></div>
        <div><span>Receiver position</span><b className={margin > 0 ? styles.danger : ""}>{margin > 0 ? "OFFSIDE" : "ONSIDE"}</b></div>
        <div><span>Goalward margin</span><b>{margin >= 0 ? "+" : ""}{margin.toFixed(2)} <small>m</small></b></div>
      </div>
    </section>
  );
}
