import { Download, Share2, Radio } from 'lucide-react'
import { MATCH } from '../data/incident'

function Crest({ code, color }: { code: string; color: string }) {
  return (
    <span className="crest" style={{ background: color }}>
      <svg viewBox="0 0 24 28" aria-hidden="true">
        <path d="M12 1 22 5v9.4c0 6.1-4.2 10.4-10 12.6C6.2 24.8 2 20.5 2 14.4V5L12 1Z" fill="rgba(255,255,255,.17)" />
        <path d="M12 4.2 19 7v7.2c0 4.5-2.9 7.8-7 9.7-4.1-1.9-7-5.2-7-9.7V7l7-2.8Z" fill="none" stroke="rgba(255,255,255,.55)" strokeWidth="1" />
      </svg>
      <b>{code}</b>
    </span>
  )
}

export function Header({ onExport, onPlay }: { onExport: () => void; onPlay: () => void }) {
  return (
    <header className="topbar">
      <div className="brand">
        <div className="brand-glyph" aria-hidden="true">
          <svg viewBox="0 0 38 38">
            <path d="M19 2 35 10.5v17L19 36 3 27.5v-17L19 2Z" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <path d="M12 26V12h7a5 5 0 0 1 0 10h-4l7 4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="square" />
            <circle cx="27.5" cy="10.5" r="1.7" fill="currentColor" />
          </svg>
        </div>
        <div className="brand-word">
          <div>ARBITER<span className="brand-dot">.</span></div>
          <small>INCIDENT INTELLIGENCE</small>
        </div>
      </div>

      <div className="match-strip">
        <div className="comp">
          <span>{MATCH.competition}</span>
          <i />
          <span>{MATCH.round}</span>
        </div>
        <div className="scoreline">
          <Crest code={MATCH.home.code} color={MATCH.home.color} />
          <strong>{MATCH.home.code}</strong>
          <b className="score">{MATCH.score[0]}</b>
          <span className="score-sep">:</span>
          <b className="score">{MATCH.score[1]}</b>
          <strong>{MATCH.away.code}</strong>
          <Crest code={MATCH.away.code} color={MATCH.away.color} />
        </div>
        <div className="match-clock">
          <span className="clock">{MATCH.clock}</span>
          <span className="half">2ND HALF</span>
        </div>
      </div>

      <div className="topbar-actions">
        <div className="sim-badge">
          <Radio size={12} />
          SYNTHETIC FEED
        </div>
        <button className="btn ghost" onClick={onPlay} title="Play the incident">
          <span className="play-dot" /> Play incident
        </button>
        <button className="btn icon" aria-label="Share">
          <Share2 size={15} />
        </button>
        <button className="btn primary" onClick={onExport}>
          <Download size={15} /> Export bundle
        </button>
      </div>
    </header>
  )
}
