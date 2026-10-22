import { useEffect, useState } from 'react'
import {
  Activity,
  Axis3D,
  Bone,
  Camera,
  Crosshair,
  Eye,
  EyeOff,
  Focus,
  Gauge,
  Layers3,
  Move3D,
  PersonStanding,
  Route,
  Scan,
  ShieldCheck,
  SplitSquareHorizontal,
  Target,
  Users,
} from 'lucide-react'
import { Scene } from '../three/Scene'
import { Minimap } from './Minimap'
import type { CameraPreset } from '../data/incident'
import type { Simulation } from '../sim/engine'

const CAMERAS: { id: CameraPreset; label: string; key: string; icon: React.ReactNode }[] = [
  { id: 'broadcast', label: 'Broadcast', key: '1', icon: <Camera size={13} /> },
  { id: 'touchline', label: 'Touchline', key: '2', icon: <Move3D size={13} /> },
  { id: 'tactical', label: 'Tactical', key: '3', icon: <Target size={13} /> },
  { id: 'referee', label: 'Referee', key: '4', icon: <PersonStanding size={13} /> },
  { id: 'free', label: 'Free', key: '5', icon: <Axis3D size={13} /> },
]

export interface OverlayState {
  skeleton: boolean
  labels: boolean
  trajectory: boolean
  forces: boolean
  dual: boolean
}

export function Viewport({
  sim,
  timeRef,
  time,
  cameraPreset,
  onCamera,
  overlays,
  onOverlay,
  onFreeze,
  onReady,
}: {
  sim: Simulation
  timeRef: React.MutableRefObject<number>
  time: number
  cameraPreset: CameraPreset
  onCamera: (c: CameraPreset) => void
  overlays: OverlayState
  onOverlay: (key: keyof OverlayState) => void
  onFreeze: () => void
  onReady: () => void
}) {
  const [loaded, setLoaded] = useState(false)
  const [progress, setProgress] = useState(6)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const t = setInterval(() => setProgress((p) => (p < 88 ? p + Math.random() * 9 : p)), 260)
    return () => clearInterval(t)
  }, [])
  useEffect(() => {
    if (loaded) {
      setProgress(100)
      const t = setTimeout(() => setMounted(true), 400)
      return () => clearTimeout(t)
    }
  }, [loaded])

  const frozen = Math.abs(time - sim.contactT) < 0.035

  return (
    <section className="stage">
      <div className="stage-frame">
        <Scene
          sim={sim}
          timeRef={timeRef}
          cameraPreset={cameraPreset}
          showSkeleton={overlays.skeleton}
          showLabels={overlays.labels}
          showTrajectory={overlays.trajectory}
          showForces={overlays.forces}
          dual={overlays.dual}
          onReady={() => {
            setLoaded(true)
            onReady()
          }}
        />

        {/* top-left incident identity */}
        <div className="stage-title">
          <div className="incident-tag">
            <span className="live-dot" /> INCIDENT 04 · <b>78:42</b>
          </div>
          <h1>Serious foul play<span>?</span></h1>
          <p>Late sliding challenge · contact above the ankle · no ball first</p>
          <div className="stage-meta">
            <span>MCI 2–1 ARS</span>
            <i />
            <span>ETIHAD STADIUM</span>
            <i />
            <span>REVIEW COMPLETE</span>
          </div>
        </div>

        {/* calibration / render badge */}
        <div className="stage-status">
          <span className="status-line"><i /> SYNTHETIC TRACK</span>
          <span>100 FPS</span>
          <span>±2.8 CM</span>
          <span className="engine">WEBGL · IK RIG</span>
        </div>

        {/* cameras */}
        <div className="camera-dock">
          <div className="dock-label"><Scan size={12} /> CAMERA</div>
          <div className="camera-buttons">
            {CAMERAS.map((c) => (
              <button
                key={c.id}
                className={cameraPreset === c.id ? 'on' : ''}
                onClick={() => onCamera(c.id)}
                title={`${c.label} (${c.key})`}
              >
                {c.icon}
                <span>{c.label}</span>
                <kbd>{c.key}</kbd>
              </button>
            ))}
          </div>
        </div>

        {/* overlay controls */}
        <div className="overlay-dock">
          <button className={overlays.skeleton ? 'on' : ''} onClick={() => onOverlay('skeleton')}>
            <Bone size={13} /> <span>Skeleton</span><kbd>S</kbd>
          </button>
          <button className={overlays.trajectory ? 'on' : ''} onClick={() => onOverlay('trajectory')}>
            <Route size={13} /> <span>Trails</span><kbd>T</kbd>
          </button>
          <button className={overlays.forces ? 'on' : ''} onClick={() => onOverlay('forces')}>
            <Activity size={13} /> <span>Forces</span><kbd>K</kbd>
          </button>
          <button className={overlays.labels ? 'on' : ''} onClick={() => onOverlay('labels')}>
            {overlays.labels ? <Eye size={13} /> : <EyeOff size={13} />} <span>Tags</span><kbd>L</kbd>
          </button>
          <button className={overlays.dual ? 'on' : ''} onClick={() => onOverlay('dual')}>
            <SplitSquareHorizontal size={13} /> <span>Dual</span><kbd>D</kbd>
          </button>
        </div>

        {/* left event read */}
        <div className="event-card">
          <div className="event-card-head"><Crosshair size={13} /> CONTACT ENVELOPE</div>
          <div className="event-rows">
            <div><span>Point of contact</span><b>0.31 m</b></div>
            <div><span>Closing speed</span><b>{sim.meta.speed.closing.toFixed(1)} <small>m/s</small></b></div>
            <div><span>Peak load</span><b>{(sim.impact.peakForce / 1000).toFixed(1)} <small>kN</small></b></div>
            <div><span>Ball contact</span><b className="danger">+{Math.round(sim.impact.ballDelay * 1000)} <small>ms</small></b></div>
          </div>
          <button className="event-freeze" onClick={onFreeze}><Focus size={12} /> FREEZE CONTACT</button>
        </div>

        {/* minimap */}
        <Minimap sim={sim} time={time} preset={cameraPreset} />

        {/* freeze state */}
        {frozen && (
          <div className="freeze-badge">
            <span className="freeze-bars"><i /><i /><i /></span>
            FRAME HELD · 100 FPS
          </div>
        )}

        {/* dual view frame */}
        {overlays.dual && (
          <div className="inset-frame">
            <div className="inset-head">
              <span><i /> CONTACT CAM</span>
              <span className="rec">REVERSE · SYNC</span>
            </div>
            <div className="inset-corners">
              <i /><i /><i /><i />
            </div>
            <div className="inset-foot">
              <span>REVERSE ANGLE · ACHILLES</span>
              <span>ANGLE 02 · CAL ±2.8 CM</span>
            </div>
            <div className="inset-crosshair" />
          </div>
        )}

        {/* frame decorations */}
        <div className="frame-corners"><i /><i /><i /><i /></div>
        <div className="stage-vignette" />
        <div className="stage-grain" />
        <div className="stage-footer">
          <span><ShieldCheck size={12} /> RF-7829 / CAM 02</span>
          <span><Layers3 size={12} /> 65-JOINT IK · CONTACT SOLVER</span>
          <span className="credit">MODEL · QUATERNIUS CC0</span>
          <span><Gauge size={12} /> 120 HZ DETERMINISTIC</span>
          <span className="right"><Users size={12} /> 2 TRACKED SUBJECTS</span>
        </div>

        {!mounted && (
          <div className={`stage-loader ${loaded ? 'done' : ''}`}>
            <div className="load-inner">
              <div className="load-emblem">
                <div className="ring r1" /><div className="ring r2" /><div className="ring r3" />
                <Scan size={24} />
              </div>
              <span className="eyebrow">ARBITER RECONSTRUCTION ENGINE</span>
              <h2>Building the incident twin</h2>
              <p>Loading rig · calibrating pitch · solving contact</p>
              <div className="load-bar"><span style={{ width: `${progress}%` }} /></div>
              <div className="load-row"><span>{progress < 100 ? 'ASSEMBLING SCENE' : 'READY'}</span><b>{Math.min(100, Math.round(progress))}%</b></div>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
