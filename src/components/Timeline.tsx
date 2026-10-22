import { useMemo, useRef } from 'react'
import { Pause, Play, Repeat, RotateCcw, SkipBack, SkipForward, Snowflake } from 'lucide-react'
import type { Simulation } from '../sim/engine'

const COLORS = {
  tackler: '#7dd8ff',
  carrier: '#ff7b7b',
  ball: '#d8ff9e',
  official: '#ffd166',
}

function matchClock(t: number) {
  const base = 78 * 60 + 42
  const total = base + t
  const m = Math.floor(total / 60)
  const s = Math.floor(total % 60)
  const cs = Math.floor((total % 1) * 100)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`
}

function tc(t: number) {
  const m = Math.floor(t / 60)
  const s = Math.floor(t % 60)
  const ms = Math.floor((t % 1) * 1000)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`
}

const LANES = [
  { id: 'tackler', label: 'TACKLER', sub: 'MCI · 6', color: COLORS.tackler },
  { id: 'carrier', label: 'CARRIER', sub: 'ARS · 8', color: COLORS.carrier },
  { id: 'ball', label: 'BALL', sub: 'NIKE FLIGHT', color: COLORS.ball },
  { id: 'official', label: 'OFFICIAL', sub: 'REF · A. TAYLOR', color: COLORS.official },
] as const


export function Timeline({
  sim,
  time,
  playing,
  rate,
  onPlay,
  onSeek,
  onRate,
  onFreeze,
  onStep,
  onReset,
}: {
  sim: Simulation
  time: number
  playing: boolean
  rate: number
  onPlay: () => void
  onSeek: (t: number) => void
  onRate: (r: number) => void
  onFreeze: () => void
  onStep: (dir: number) => void
  onReset: () => void
}) {
  const laneRef = useRef<HTMLDivElement>(null)
  const raf = useRef<number | null>(null)
  const pct = (t: number) => `${(t / sim.duration) * 100}%`
  const activeEvent = useMemo(() => {
    let e = sim.events[0]
    for (const ev of sim.events) if (ev.t <= time) e = ev
    return e
  }, [sim.events, time])

  const phases: Record<string, { start: number; end: number; color: string; label: string }[]> = useMemo(() => {
    const c = sim.contactT
    return {
      tackler: [
        { start: 0, end: c - 0.64, color: '#2e829c', label: 'SPRINT' },
        { start: c - 0.64, end: c - 0.34, color: '#5ca8c0', label: 'COMMIT' },
        { start: c - 0.34, end: c + 0.9, color: '#b98a3e', label: 'SLIDE' },
        { start: c + 0.9, end: c + 1.22, color: '#3b6260', label: 'RECOVER' },
        { start: c + 1.22, end: sim.duration, color: '#263d3b', label: 'UP' },
      ],
      carrier: [
        { start: 0, end: c, color: '#b04d4d', label: 'CARRY' },
        { start: c, end: c + 0.86, color: '#d95f58', label: 'FALL' },
        { start: c + 0.86, end: sim.duration, color: '#68312e', label: 'GROUNDED' },
      ],
      ball: [
        { start: 0, end: c + 0.043, color: '#618d47', label: 'ROLL' },
        { start: c + 0.043, end: c + 0.55, color: '#a7d56a', label: 'FLIGHT' },
        { start: c + 0.55, end: c + 0.9, color: '#7b9b56', label: 'BOUNCE' },
        { start: c + 0.9, end: sim.duration, color: '#3c4b33', label: 'OUT' },
      ],
      official: [
        { start: 0, end: c + 1.18, color: '#6f5c33', label: 'PLAY ON' },
        { start: c + 1.18, end: sim.duration, color: '#c49c43', label: 'WHISTLE' },
      ],
    }
  }, [sim.contactT, sim.duration])

  const seekFromPointer = (clientX: number) => {
    const el = laneRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const k = Math.max(0, Math.min(1, (clientX - r.left) / r.width))
    onSeek(k * sim.duration)
  }

  const startDrag = (e: React.PointerEvent) => {
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
    seekFromPointer(e.clientX)
    const move = (ev: PointerEvent) => seekFromPointer(ev.clientX)
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      if (raf.current) cancelAnimationFrame(raf.current)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const ticks = Array.from({ length: Math.floor(sim.duration) + 1 }, (_, i) => i)

  return (
    <section className="timeline">
      <div className="timeline-top">
        <div className="transport">
          <button className="t-btn" onClick={onReset} title="Restart (Home)">
            <RotateCcw size={14} />
          </button>
          <button className="t-btn" onClick={() => onStep(-1)} title="Previous frame (←)">
            <SkipBack size={14} />
          </button>
          <button className={`t-btn play ${playing ? 'is-playing' : ''}`} onClick={onPlay} title="Play / pause (Space)">
            {playing ? <Pause size={15} /> : <Play size={15} fill="currentColor" />}
          </button>
          <button className="t-btn" onClick={() => onStep(1)} title="Next frame (→)">
            <SkipForward size={14} />
          </button>
          <button className="t-btn freeze" onClick={onFreeze} title="Freeze at contact (F)">
            <Snowflake size={14} />
            <span>FREEZE</span>
          </button>
        </div>

        <div className="timecode-block">
          <span className="timecode">{tc(time)}</span>
          <span className="match-time">{matchClock(time)}</span>
          <span className="time-unit">MATCH CLOCK</span>
        </div>

        <div className="event-readout">
          <span className="event-kicker">ACTIVE ANCHOR</span>
          <b>{activeEvent.label}</b>
          <span className="event-src">{activeEvent.detail}</span>
        </div>

        <div className="timeline-options">
          <div className="speed-seg">
            {[0.25, 0.5, 1].map((s) => (
              <button key={s} className={rate === s ? 'on' : ''} onClick={() => onRate(s)}>
                {s}×
              </button>
            ))}
          </div>
          <button className="t-btn loop on" title="Loop enabled">
            <Repeat size={13} />
          </button>
          <div className="fps-badge">120 <span>HZ PHYS</span></div>
        </div>
      </div>

      <div className="timeline-body">
        <div className="lane-labels">
          <div className="lane-label head">EVENT LANES</div>
          {LANES.map((l) => (
            <div className="lane-label" key={l.id}>
              <i style={{ background: l.color }} />
              <div>
                <b>{l.label}</b>
                <span>{l.sub}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="lane-stage" ref={laneRef} onPointerDown={startDrag}>
          <div className="ruler">
            {ticks.map((t) => (
              <span className="tick" key={t} style={{ left: pct(t) }}>
                <i />
                {t}s
              </span>
            ))}
            <div className="event-flags">
              {sim.events.map((ev, i) => (
                <button
                  key={ev.id}
                  className={`event-flag ${ev.id === activeEvent.id ? 'active' : ''} ${ev.tone}`}
                  style={{ left: pct(ev.t), top: `${(i % 2) * 19}px` }}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation()
                    onSeek(ev.t)
                  }}
                >
                  <i />
                  {ev.short}
                  <span>{tc(ev.t)}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="lanes">
            {LANES.map((lane) => (
              <div className="lane" key={lane.id}>
                <div className="lane-grid">
                  {[0, 25, 50, 75, 100].map((p) => (
                    <i key={p} style={{ left: `${p}%` }} />
                  ))}
                </div>
                {phases[lane.id].map((ph, i) => (
                  <div
                    key={i}
                    className="phase"
                    style={{
                      left: `${(ph.start / sim.duration) * 100}%`,
                      width: `${((ph.end - ph.start) / sim.duration) * 100}%`,
                      background: ph.color,
                    }}
                  >
                    <span>{ph.label}</span>
                  </div>
                ))}
                {sim.events
                  .filter((ev) => ev.lane === lane.id)
                  .map((ev) => (
                    <button
                      key={ev.id}
                      className="lane-pip"
                      style={{ left: pct(ev.t), background: COLORS[lane.id] }}
                      onClick={(e) => {
                        e.stopPropagation()
                        onSeek(ev.t)
                      }}
                      title={`${ev.label} — ${tc(ev.t)}`}
                    />
                  ))}
              </div>
            ))}
          </div>

          <div className="playhead" style={{ left: pct(time) }}>
            <div className="playhead-top" />
            <div className="playhead-time">{tc(time)}</div>
          </div>
        </div>
      </div>

      <div className="timeline-foot">
        <span>SEED 7829</span>
        <span>TRACK RATE 100 FPS</span>
        <span>BALL IMU 500 HZ</span>
        <span className="spacer" />
        <span>FRAME {Math.round(time * 100)} / {Math.round(sim.duration * 100)}</span>
        <span>REPROJECTION ±2.8 CM</span>
      </div>
    </section>
  )
}
