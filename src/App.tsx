import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, Copy, Download, FileJson, X } from 'lucide-react'
import { Header } from './components/Header'
import { ToolRail, type RailTool } from './components/ToolRail'
import { Viewport, type OverlayState } from './components/Viewport'
import { AnalysisPanel, type AnalysisTab } from './components/AnalysisPanel'
import { Timeline } from './components/Timeline'
import { buildSimulation } from './sim/engine'
import { ACTUAL_DECISION, COMPARISONS, CRITERIA, LAW_LINKS, MATCH, METRICS, type CameraPreset, type Criterion } from './data/incident'
import './styles.css'

const SRC = {
  title: 'ARBITER — Premier League incident review',
  generated: new Date().toISOString(),
  engine: 'arbiter-recon v2.4 / deterministic contact solver',
  seed: 7829,
}

function download(name: string, content: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

function buildReport() {
  return {
    incident: {
      id: MATCH.incidentId,
      competition: MATCH.competition,
      match: `${MATCH.home.code} ${MATCH.score[0]}–${MATCH.score[1]} ${MATCH.away.code}`,
      stadium: MATCH.stadium,
      clock: MATCH.clock,
      description: 'Late sliding challenge from side-rear. Studs-first contact above the right ankle; no clean ball contact.',
    },
    assessment: {
      recommendation: 'RED CARD — serious foul play (Law 12.2)',
      onField: ACTUAL_DECISION.onField,
      final: ACTUAL_DECISION.final,
      confidence: ACTUAL_DECISION.confidence,
      severityIndex: 0.87,
      threshold: 0.72,
      penalty: 'On-field call one tier lenient. No VAR intervention.',
      analysis: ACTUAL_DECISION.analysis,
      bias: ACTUAL_DECISION.bias,
      consistency: ACTUAL_DECISION.consistency,
    },
    criteria: CRITERIA.map((c) => ({ criterion: c.label, status: c.status, law: c.law, reading: c.reading, detail: c.detail })),
    metrics: METRICS,
    laws: LAW_LINKS.map((l) => ({ ref: l.ref, title: l.title, url: l.url })),
    comparisons: COMPARISONS.map((c) => ({ context: c.context, fixture: c.fixture, similarity: c.similar, outcome: c.outcome, note: c.note })),
    provenance: {
      ...SRC,
      disclaimer: ACTUAL_DECISION.disclaimer,
      note: 'All tracking, ball physics, panel votes and comparisons are synthetic and were generated for this demonstration.',
    },
  }
}

function buildMarkdown() {
  const r = buildReport()
  return `# ${r.incident.match} — Incident ${r.incident.id}

**${r.incident.competition} · ${r.incident.clock} · ${r.incident.stadium}**

${r.incident.description}

## Recommendation
**${r.assessment.recommendation}** · confidence ${Math.round(r.assessment.confidence * 100)}%

- On-field: ${r.assessment.onField} → final: ${r.assessment.final}
- Severity: ${r.assessment.severityIndex} (red threshold ${r.assessment.threshold})
- ${r.assessment.penalty}
- ${r.assessment.bias}

${r.assessment.analysis}

## Criteria
${r.criteria.map((c) => `- **${c.criterion}** (${c.status}) — ${c.reading}. ${c.detail}`).join('\n')}

## Metrics
${r.metrics.map((m) => `- ${m.label}: ${m.value} ${m.unit} (${m.cue})`).join('\n')}

## Laws
${r.laws.map((l) => `- ${l.ref} — ${l.title}: ${l.url}`).join('\n')}

## Comparators
${r.comparisons.map((c) => `- ${c.context} · ${c.fixture} · ${Math.round(c.similarity * 100)}% similar · ${c.outcome}. ${c.note}`).join('\n')}

## Provenance
${r.provenance.engine} · seed ${r.provenance.seed} · generated ${r.provenance.generated}

> ${r.provenance.note}
`
}

function ExportModal({ onClose, onToast }: { onClose: () => void; onToast: (s: string) => void }) {
  const [note, setNote] = useState('')
  const report = useMemo(buildReport, [])
  return (
    <div className="modal-backdrop" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal report">
        <div className="modal-head">
          <div>
            <span className="eyebrow">DECISION BUNDLE · RF-7829-04</span>
            <h2>Incident review export</h2>
            <p>One-page evidence package with criteria, sanctions, law references and provenance.</p>
          </div>
          <button className="modal-x" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="report-scroll">
          <div className="report-banner">
            <div>
              <span>RECOMMENDATION</span>
              <b>RED CARD</b>
              <small>Serious foul play · Law 12.2</small>
            </div>
            <div className="report-score">
              <span>{MATCH.home.code} {MATCH.score[0]} : {MATCH.score[1]} {MATCH.away.code}</span>
              <b>{MATCH.clock}</b>
              <small>{MATCH.stadium}</small>
            </div>
            <div className="report-conf">
              <span>CONFIDENCE</span>
              <b>{Math.round(ACTUAL_DECISION.confidence * 100)}%</b>
              <small>SEVERITY 0.87 / 1.00</small>
            </div>
          </div>

          <div className="report-grid">
            <section>
              <h3>Assessment</h3>
              <p>{ACTUAL_DECISION.analysis}</p>
              <p className="muted">{ACTUAL_DECISION.bias}</p>
            </section>
            <section>
              <h3>Sanction path</h3>
              <div className="report-kv"><span>On-field</span><b className="yellow">YELLOW</b></div>
              <div className="report-kv"><span>Model</span><b className="red">RED</b></div>
              <div className="report-kv"><span>Panel vote</span><b>{ACTUAL_DECISION.panelVote}</b></div>
              <div className="report-kv"><span>Clear & obvious</span><b>MET · 0.91</b></div>
            </section>
          </div>

          <section>
            <h3>Criteria ledger</h3>
            <table className="report-table">
              <thead><tr><th>Criterion</th><th>Status</th><th>Reading</th></tr></thead>
              <tbody>
                {report.criteria.map((c) => (
                  <tr key={c.criterion}>
                    <td>{c.criterion}</td>
                    <td><span className={`status-pill ${c.status}`}>{c.status}</span></td>
                    <td>{c.reading}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <div className="report-grid">
            <section>
              <h3>Law references</h3>
              {report.laws.map((l) => (
                <a className="report-law" href={l.url} target="_blank" rel="noreferrer" key={l.ref}>
                  <span>{l.ref}</span><b>{l.title}</b><Download size={12} />
                </a>
              ))}
            </section>
            <section>
              <h3>Similar incidents</h3>
              {report.comparisons.slice(0, 3).map((c) => (
                <div className="report-cmp" key={c.context}>
                  <span>{c.context}</span><b className={c.outcome === 'RED' ? 'red' : 'yellow'}>{c.outcome}</b><small>{Math.round(c.similarity * 100)}% sim.</small>
                </div>
              ))}
            </section>
          </div>

          <section>
            <h3>Reviewer note</h3>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note for the decision bundle…" />
          </section>
          <p className="report-disclaimer">{ACTUAL_DECISION.disclaimer} {report.provenance.engine} · seed 7829.</p>
        </div>
        <div className="modal-foot">
          <span>Generated {new Date().toLocaleString()}</span>
          <div>
            <button className="btn ghost" onClick={() => { navigator.clipboard?.writeText(JSON.stringify({ ...report, reviewerNote: note }, null, 2)); onToast('Decision JSON copied to clipboard') }}>
              <Copy size={14} /> Copy JSON
            </button>
            <button className="btn ghost" onClick={() => download('RF-7829-04-decision.md', buildMarkdown() + (note ? `\n\n**Reviewer note:** ${note}\n` : ''), 'text/markdown')}>
              <Download size={14} /> Markdown
            </button>
            <button className="btn primary" onClick={() => download('RF-7829-04-decision.json', JSON.stringify({ ...report, reviewerNote: note }, null, 2), 'application/json')}>
              <FileJson size={14} /> Download JSON
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const sim = useMemo(buildSimulation, [])
  const timeRef = useRef(sim.contactT)
  const playingRef = useRef(false)
  const [time, setTime] = useState(sim.contactT)
  const [playing, setPlaying] = useState(false)
  const [rate, setRate] = useState(1)
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('touchline')
  const [overlays, setOverlays] = useState<OverlayState>({ skeleton: false, labels: true, trajectory: true, forces: true, dual: true })
  const [tab, setTab] = useState<AnalysisTab>('decision')
  const [rail, setRail] = useState<RailTool>('review')
  const [selectedCriterion, setSelectedCriterion] = useState<string | null>('contact-point')
  const [exportOpen, setExportOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let raf = 0
    let last = performance.now()
    let uiAcc = 0
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      if (playingRef.current) {
        let next = timeRef.current + dt * (rate || 1)
        if (next >= sim.duration) next = 0
        timeRef.current = next
      }
      uiAcc += dt
      if (uiAcc > 0.045) {
        setTime(timeRef.current)
        uiAcc = 0
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [rate, sim.duration])

  const seek = useCallback((t: number) => {
    timeRef.current = Math.max(0, Math.min(sim.duration, t))
    setTime(timeRef.current)
  }, [sim.duration])

  const setPaused = useCallback((p: boolean) => {
    playingRef.current = p
    setPlaying(p)
  }, [])

  const togglePlay = useCallback(() => {
    if (playingRef.current) setPaused(false)
    else {
      if (timeRef.current > sim.duration - 0.02) seek(0)
      setPaused(true)
    }
  }, [seek, setPaused, sim.duration])

  const playIncident = useCallback(() => {
    seek(0.15)
    setPaused(true)
    setCameraPreset('broadcast')
  }, [seek, setPaused])

  const freezeContact = useCallback(() => {
    setPaused(false)
    seek(sim.contactT)
    setCameraPreset('touchline')
  }, [seek, setPaused, sim.contactT])

  const jump = useCallback((t: number) => {
    setPaused(false)
    seek(t)
  }, [seek, setPaused])

  const onCriterion = useCallback((c: Criterion) => {
    setSelectedCriterion(c.id)
    setCameraPreset(c.camera)
    setPaused(false)
    seek(c.time)
    if (c.overlay === 'force') setOverlays((o) => ({ ...o, forces: true, trajectory: true }))
    if (c.overlay === 'contact') setOverlays((o) => ({ ...o, forces: false, trajectory: false }))
    if (c.overlay === 'skeleton') setOverlays((o) => ({ ...o, skeleton: true }))
  }, [seek, setPaused])

  const toggleOverlay = useCallback((key: keyof OverlayState) => {
    setOverlays((o) => ({ ...o, [key]: !o[key] }))
  }, [])

  const onRail = useCallback((tool: RailTool) => {
    setRail(tool)
    if (tool === 'review') {
      setTab('decision')
      setCameraPreset('broadcast')
      jump(sim.contactT)
    } else if (tool === 'decision') setTab('decision')
    else if (tool === 'laws') setTab('laws')
    else if (tool === 'compare') setTab('compare')
    else if (tool === 'biomech') {
      setTab('motion')
      setOverlays((o) => ({ ...o, skeleton: true }))
    } else if (tool === 'notes') setExportOpen(true)
  }, [jump, sim.contactT])

  const showToast = useCallback((message: string) => {
    setToast(message)
    setTimeout(() => setToast(null), 2600)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return
      if (e.code === 'Space') { e.preventDefault(); togglePlay() }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); setPaused(false); seek(timeRef.current - 1 / 60) }
      else if (e.key === 'ArrowRight') { e.preventDefault(); setPaused(false); seek(timeRef.current + 1 / 60) }
      else if (e.key.toLowerCase() === 'f') freezeContact()
      else if (e.key.toLowerCase() === 's') toggleOverlay('skeleton')
      else if (e.key.toLowerCase() === 't') toggleOverlay('trajectory')
      else if (e.key.toLowerCase() === 'k') toggleOverlay('forces')
      else if (e.key.toLowerCase() === 'l') toggleOverlay('labels')
      else if (e.key.toLowerCase() === 'd') toggleOverlay('dual')
      else if (e.key === '1') setCameraPreset('broadcast')
      else if (e.key === '2') setCameraPreset('touchline')
      else if (e.key === '3') setCameraPreset('tactical')
      else if (e.key === '4') setCameraPreset('referee')
      else if (e.key === '5') setCameraPreset('free')
      else if (e.key === 'Home') { seek(0); setPaused(false) }
      else if (e.key === 'Escape') setExportOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [freezeContact, seek, setPaused, toggleOverlay, togglePlay])

  return (
    <div className="app">
      <Header onExport={() => setExportOpen(true)} onPlay={playIncident} />
      <div className="workspace">
        <ToolRail active={rail} onSelect={onRail} onShare={() => { navigator.clipboard?.writeText(window.location.href); showToast('Review link copied') }} />
        <Viewport
          sim={sim}
          timeRef={timeRef}
          time={time}
          cameraPreset={cameraPreset}
          onCamera={setCameraPreset}
          overlays={overlays}
          onOverlay={toggleOverlay}
          onFreeze={freezeContact}
          onReady={() => setReady(true)}
        />
        <AnalysisPanel
          tab={tab}
          onTab={(t) => setTab(t)}
          selectedCriterion={selectedCriterion}
          onCriterion={onCriterion}
          onJump={jump}
          onToggleSkeleton={() => toggleOverlay('skeleton')}
          skeletonOn={overlays.skeleton}
        />
      </div>
      <Timeline
        sim={sim}
        time={time}
        playing={playing}
        rate={rate}
        onPlay={togglePlay}
        onSeek={seek}
        onRate={setRate}
        onFreeze={freezeContact}
        onStep={(dir) => { setPaused(false); seek(timeRef.current + dir / 60) }}
        onReset={() => { seek(0); setPaused(false) }}
      />

      {exportOpen && <ExportModal onClose={() => setExportOpen(false)} onToast={showToast} />}
      {toast && <div className="toast"><Check size={14} /> {toast}</div>}
      <div className={`boot-hint ${ready ? 'ready' : ''}`}>{ready ? '' : 'PREPARING RECONSTRUCTION'}</div>
    </div>
  )
}
