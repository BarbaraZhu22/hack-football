import { AlertTriangle, ArrowUpRight, Check, ChevronRight, CircleHelp, Scale, Sparkles, X } from 'lucide-react'
import {
  ACTUAL_DECISION,
  COMPARISONS,
  CRITERIA,
  INCIDENT_TAGS,
  LAW_LINKS,
  LEAGUE_DISTRIBUTION,
  MATCH,
  type Criterion,
} from '../data/incident'

export type AnalysisTab = 'decision' | 'laws' | 'compare' | 'motion'

function ConfidenceRing({ value }: { value: number }) {
  const r = 20
  const c = 2 * Math.PI * r
  return (
    <div className="confidence">
      <svg viewBox="0 0 52 52" width="52" height="52">
        <circle cx="26" cy="26" r={r} fill="none" stroke="rgba(255,255,255,.1)" strokeWidth="3" />
        <circle
          cx="26"
          cy="26"
          r={r}
          fill="none"
          stroke="#ffc75f"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={`${c * value} ${c}`}
          transform="rotate(-90 26 26)"
        />
      </svg>
      <div><b>{Math.round(value * 100)}</b><span>%</span><small>CONF.</small></div>
    </div>
  )
}

function StatusIcon({ status }: { status: Criterion['status'] }) {
  if (status === 'met') return <span className="crit-icon met"><Check size={12} /></span>
  if (status === 'partial') return <span className="crit-icon partial"><AlertTriangle size={12} /></span>
  return <span className="crit-icon unmet"><X size={12} /></span>
}

function LawMini({ law }: { law: (typeof LAW_LINKS)[number] }) {
  return (
    <a className="law-mini" href={law.url} target="_blank" rel="noreferrer">
      <div>
        <span className="law-ref">{law.ref}</span>
        <b>{law.title}</b>
      </div>
      <ArrowUpRight size={14} />
    </a>
  )
}

export function AnalysisPanel({
  tab,
  onTab,
  selectedCriterion,
  onCriterion,
  onJump,
  onToggleSkeleton,
  skeletonOn,
}: {
  tab: AnalysisTab
  onTab: (t: AnalysisTab) => void
  selectedCriterion: string | null
  onCriterion: (c: Criterion) => void
  onJump: (t: number) => void
  onToggleSkeleton: () => void
  skeletonOn: boolean
}) {
  return (
    <aside className="analysis">
      <div className="analysis-head">
        <div>
          <span className="eyebrow">INCIDENT ASSESSMENT</span>
          <h2>Discipline review</h2>
        </div>
        <div className="model-tag"><Sparkles size={11} /> MODEL v2.4</div>
      </div>

      <div className="verdict-card">
        <div className="verdict-top">
          <div>
            <span className="eyebrow warm">PANEL RECOMMENDATION</span>
            <div className="verdict-title">RED CARD</div>
            <div className="verdict-sub">Law 12.2 · Serious foul play</div>
          </div>
          <ConfidenceRing value={ACTUAL_DECISION.confidence} />
        </div>
        <div className="call-compare">
          <div>
            <span>ON-FIELD</span>
            <b className="yellow">YELLOW</b>
          </div>
          <div className="call-arrow">→</div>
          <div>
            <span>MODEL</span>
            <b className="red">RED</b>
          </div>
          <div className="delta-chip">−1 TIER · LENIENT</div>
        </div>
        <p className="verdict-copy">
          Studs-first contact above the ankle at 30.6 km/h, with no clean ball contact. The excess-force threshold is
          met on the contact profile and follow-through.
        </p>
        <div className="incident-tags">
          {INCIDENT_TAGS.map((t) => <span key={t}>{t}</span>)}
        </div>

        <div className="severity">
          <div className="severity-head">
            <span>SEVERITY INDEX</span>
            <b>0.87 <small>/ 1.00</small></b>
          </div>
          <div className="sev-track">
            <div className="sev-zone z1" />
            <div className="sev-zone z2" />
            <div className="sev-zone z3" />
            <div className="sev-threshold" style={{ left: '72%' }}><span>RED THRESHOLD</span></div>
            <div className="sev-marker" style={{ left: '87%' }} />
          </div>
          <div className="sev-labels"><span>CARELESS</span><span>RECKLESS</span><span>EXCESSIVE FORCE</span></div>
        </div>
      </div>

      <div className="verdict-inline">
        <span>Closing <b>5.5 m/s</b></span><i /><span>Peak <b>6.0 kN</b></span><i /><span>Contact <b>92 ms</b></span><i /><span>Severity <b>0.87</b></span>
      </div>

      <div className="analysis-tabs">
        {([
          ['decision', 'DECISION'],
          ['laws', 'LAWS'],
          ['compare', 'COMPARE'],
          ['motion', 'MOTION'],
        ] as const).map(([id, label]) => (
          <button key={id} className={tab === id ? 'on' : ''} onClick={() => onTab(id)}>
            {label}
          </button>
        ))}
      </div>

      <div className="analysis-body">
        {tab === 'decision' && (
          <>
            <div className="section-head">
              <span className="eyebrow">CRITERIA LADDER</span>
              <span className="section-count">6 / 6 CONSIDERED</span>
            </div>
            <div className="criteria">
              {CRITERIA.map((c) => (
                <button
                  key={c.id}
                  className={`criterion ${selectedCriterion === c.id ? 'selected' : ''}`}
                  onClick={() => onCriterion(c)}
                >
                  <StatusIcon status={c.status} />
                  <div className="crit-main">
                    <div className="crit-title">
                      <b>{c.label}</b>
                      <span className={`crit-law ${c.status}`}>{c.law}</span>
                    </div>
                    <span className="crit-reading">{c.reading}</span>
                    {selectedCriterion === c.id && <p className="crit-detail">{c.detail}</p>}
                  </div>
                  <ChevronRight size={14} className="crit-arrow" />
                </button>
              ))}
            </div>

            <div className="section-head">
              <span className="eyebrow">WHAT THE OFFICIALS DECIDED</span>
              <span className="section-count">ACTUAL</span>
            </div>
            <div className="actual-card">
              <div className="actual-row">
                <div>
                  <span>ON-FIELD</span>
                  <b className="yellow">YELLOW CARD</b>
                </div>
                <div>
                  <span>FINAL</span>
                  <b className="yellow">UPHELD</b>
                </div>
                <div>
                  <span>PANEL VOTE</span>
                  <b>{ACTUAL_DECISION.panelVote}</b>
                </div>
              </div>
              <p>{ACTUAL_DECISION.analysis}</p>
              <div className="bias-line">
                <Scale size={13} />
                <span>{ACTUAL_DECISION.bias}</span>
              </div>
              <div className="actual-foot">
                <span>{ACTUAL_DECISION.panel}</span>
                <button onClick={() => onJump(4.45)}>Review at whistle <ChevronRight size={12} /></button>
              </div>
            </div>

            <div className="section-head">
              <span className="eyebrow">LAW BASIS</span>
              <button className="link-btn" onClick={() => onTab('laws')}>ALL FIVE <ChevronRight size={12} /></button>
            </div>
            <div className="law-list">
              {LAW_LINKS.map((l) => <LawMini law={l} key={l.ref} />)}
            </div>

            <div className="section-head">
              <span className="eyebrow">NEAREST COMPARATORS</span>
              <button className="link-btn" onClick={() => onTab('compare')}>COMPARE ALL <ChevronRight size={12} /></button>
            </div>
            <div className="compare-preview">
              {COMPARISONS.slice(0, 2).map((c) => (
                <div className="cmp-row" key={c.id}>
                  <span className="cmp-sim">{Math.round(c.similar * 100)}<small>% SIM</small></span>
                  <div>
                    <b>{c.context}</b>
                    <span>{c.note}</span>
                  </div>
                  <span className={`outcome ${c.tone}`}>{c.outcome}</span>
                </div>
              ))}
            </div>

            <div className="disclaimer">
              <CircleHelp size={14} />
              <p>{ACTUAL_DECISION.disclaimer}</p>
            </div>
          </>
        )}

        {tab === 'laws' && (
          <>
            <div className="law-hero">
              <span className="eyebrow warm">IFAB LAWS OF THE GAME · 2025/26</span>
              <h3>Law 12 — Fouls & misconduct</h3>
              <p>
                The incident is assessed along the referee’s three-step threshold: careless (no card), reckless
                (caution) and excessive force / serious foul play (send-off).
              </p>
            </div>
            <div className="law-cards">
              {LAW_LINKS.map((l) => (
                <a className="law-card" href={l.url} target="_blank" rel="noreferrer" key={l.ref}>
                  <div className="law-card-head">
                    <span>{l.ref}</span>
                    <ArrowUpRight size={15} />
                  </div>
                  <b>{l.title}</b>
                  <p>{l.body}</p>
                  <span className="law-link">theifab.com <ArrowUpRight size={11} /></span>
                </a>
              ))}
            </div>
            <div className="ladder-card">
              <span className="eyebrow">THE SANCTION LADDER</span>
              {[
                ['CARELESS', 'No card', 'Lack of attention / no precaution', ''],
                ['RECKLESS', 'Caution · yellow', 'Disregard to danger or consequences', 'active'],
                ['EXCESSIVE FORCE', 'Send-off · red', 'Endangers safety / brutality', 'red active'],
              ].map(([t, s, d, cls]) => (
                <div className={`ladder-row ${cls}`} key={t}>
                  <b>{t}</b><span>{s}</span><small>{d}</small>
                </div>
              ))}
            </div>
            <div className="var-note">
              <b>VAR gate</b>
              <p>{ACTUAL_DECISION.overturnGate}</p>
              <a href="https://www.theifab.com/laws/latest/video-assistant-referee-var-protocol/" target="_blank" rel="noreferrer">
                Read the VAR protocol <ArrowUpRight size={12} />
              </a>
            </div>
          </>
        )}

        {tab === 'compare' && (
          <>
            <div className="distribution-card">
              <div className="dist-head">
                <div>
                  <span className="eyebrow">LEAGUE OUTCOMES</span>
                  <h3>Same contact profile</h3>
                </div>
                <span className="sample">n = 148</span>
              </div>
              <div className="dist-bar">
                {LEAGUE_DISTRIBUTION.map((d) => (
                  <div key={d.label} style={{ width: `${d.value}%`, background: d.color }} title={`${d.label} ${d.value}%`} />
                ))}
              </div>
              <div className="dist-legend">
                {LEAGUE_DISTRIBUTION.map((d) => (
                  <span key={d.label}><i style={{ background: d.color }} />{d.label}<b>{d.value}%</b></span>
                ))}
              </div>
              <p className="dist-copy">
                Above-ankle contact with exposed leading studs is sent off in 68% of the simulated benchmark set. The
                same-match comparator is an outlier, not a precedent.
              </p>
            </div>

            <div className="section-head">
              <span className="eyebrow">INCIDENT NEIGHBOURHOOD</span>
              <span className="section-count">4 MATCHES</span>
            </div>
            <div className="cmp-cards">
              {COMPARISONS.map((c) => (
                <div className="cmp-card" key={c.id}>
                  <div className="cmp-card-top">
                    <div>
                      <span>{c.context}</span>
                      <b>{c.fixture}</b>
                    </div>
                    <span className={`outcome ${c.tone}`}>{c.outcome}</span>
                  </div>
                  <div className="sim-bar"><i style={{ width: `${c.similar * 100}%` }} /><span>{Math.round(c.similar * 100)}% similarity</span></div>
                  <p>{c.note}</p>
                  <div className="cmp-card-foot">
                    <span>{c.source}</span>
                    <button onClick={() => onJump(1.9)}>Open frame <ChevronRight size={11} /></button>
                  </div>
                </div>
              ))}
            </div>
            <div className="compare-note">
              <AlertTriangle size={14} />
              <p>
                Similarity is a weighted vector over contact height, entry angle, stud exposure, speed and ball
                proximity. It is a retrieval aid, not a precedent.
              </p>
            </div>
          </>
        )}

        {tab === 'motion' && (
          <>
            <div className="motion-head">
              <div>
                <span className="eyebrow">BIOMECHANICAL READOUT</span>
                <h3>Contact kinematics</h3>
              </div>
              <button className={`mini-toggle ${skeletonOn ? 'on' : ''}`} onClick={onToggleSkeleton}>
                <span /> SKELETON
              </button>
            </div>
            <div className="kinematics">
              <div className="joint-row"><span>Lead hip flexion</span><b>78°</b><em>limit 120°</em><i style={{ width: '65%' }} /></div>
              <div className="joint-row"><span>Lead knee flexion</span><b>96°</b><em>limit 140°</em><i style={{ width: '69%' }} /></div>
              <div className="joint-row"><span>Ankle plantarflexion</span><b>22°</b><em>limit 50°</em><i style={{ width: '44%' }} /></div>
              <div className="joint-row"><span>Cervical rotation</span><b>18°</b><em>limit 80°</em><i style={{ width: '23%' }} /></div>
            </div>
            <div className="hinge-note"><Check size={12} /> All hinge limits satisfied · no reverse knee / elbow bend</div>
            <div className="speed-chart">
              <div className="chart-head"><span className="eyebrow">CLOSING SPEED</span><b>m/s</b></div>
              <svg viewBox="0 0 340 120" preserveAspectRatio="none">
                {[0, 1, 2, 3].map((i) => <line key={i} x1="0" x2="340" y1={10 + i * 30} y2={10 + i * 30} stroke="rgba(255,255,255,.08)" />)}
                <polyline points="0,96 34,92 68,85 102,76 136,64 170,60 204,54 238,40 272,44 306,62 340,84" fill="none" stroke="#ff7b7b" strokeWidth="2" />
                <polyline points="0,88 34,77 68,70 102,62 136,55 170,52 204,60 238,72 272,89 306,98 340,102" fill="none" stroke="#7dd8ff" strokeWidth="2" />
                <line x1="204" y1="0" x2="204" y2="112" stroke="#ffd166" strokeWidth="1" strokeDasharray="3 3" />
                <text x="208" y="12" fill="#ffd166" fontSize="8" fontFamily="IBM Plex Mono, monospace">CONTACT</text>
              </svg>
              <div className="chart-legend"><span><i className="home" /> TACKLER</span><span><i className="away" /> CARRIER</span><span>0 – 3.3 s</span></div>
            </div>
            <div className="model-note">
              <b>Model disclosure</b>
              <p>
                The lead-up run is a retargeted Mixamo clip. The 65-joint contact pose uses two-bone IK; the carrier’s angular fall is integrated from the ankle impulse and gravity torque. Peak force is a heuristic band (±18%), not a measured load.
              </p>
            </div>
            <div className="contact-facts">
              <div><span>Contact height</span><b>0.31 m</b></div>
              <div><span>Impulse</span><b>239 N·s</b></div>
              <div><span>Relative angle</span><b>31°</b></div>
              <div><span>Ball delay</span><b>43 ms</b></div>
            </div>
          </>
        )}
      </div>

      <div className="analysis-foot">
        <span>{MATCH.incidentId}</span>
        <span>SIMULATED · NOT A REAL PGMOL DECISION</span>
      </div>
    </aside>
  )
}
