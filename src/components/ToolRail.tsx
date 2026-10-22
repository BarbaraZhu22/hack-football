import { BookOpen, Bone, GitCompare, LayoutDashboard, Settings, StickyNote, ScanLine, Crosshair, Share2 } from 'lucide-react'

export type RailTool = 'review' | 'decision' | 'laws' | 'compare' | 'biomech' | 'notes'

const TOOLS: { id: RailTool; label: string; icon: React.ReactNode }[] = [
  { id: 'review', label: '3D review', icon: <ScanLine size={19} /> },
  { id: 'decision', label: 'Decision', icon: <LayoutDashboard size={19} /> },
  { id: 'laws', label: 'Law library', icon: <BookOpen size={19} /> },
  { id: 'compare', label: 'Comparisons', icon: <GitCompare size={19} /> },
  { id: 'biomech', label: 'Biomechanics', icon: <Bone size={19} /> },
  { id: 'notes', label: 'Review notes', icon: <StickyNote size={19} /> },
]

export function ToolRail({
  active,
  onSelect,
  onShare,
}: {
  active: RailTool
  onSelect: (t: RailTool) => void
  onShare: () => void
}) {
  return (
    <nav className="toolrail">
      <div className="toolrail-top">
        <div className="rail-label">WORKSPACE</div>
        {TOOLS.map((t) => (
          <button
            key={t.id}
            className={`rail-btn ${active === t.id ? 'active' : ''}`}
            onClick={() => onSelect(t.id)}
            aria-label={t.label}
          >
            {t.icon}
            <span className="rail-tip">{t.label}</span>
          </button>
        ))}
      </div>
      <div className="toolrail-bottom">
        <button className="rail-btn" aria-label="Data source">
          <Crosshair size={18} />
          <span className="rail-tip">Calibration</span>
        </button>
        <button className="rail-btn" onClick={onShare} aria-label="Share">
          <Share2 size={18} />
          <span className="rail-tip">Share review</span>
        </button>
        <button className="rail-btn" aria-label="Settings">
          <Settings size={18} />
          <span className="rail-tip">Settings</span>
        </button>
        <div className="rail-divider" />
        <div className="operator">
          <span>JR</span>
          <i />
        </div>
      </div>
    </nav>
  )
}
