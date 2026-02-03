import './HudTooltip.css'
import type { OrgNode } from '../../data/types'

type HudTooltipProps = {
  node: OrgNode | null
  x: number
  y: number
}

export const HudTooltip = ({ node, x, y }: HudTooltipProps) => {
  if (!node) return null
  return (
    <div className={`hud-tooltip status-${node.status}`} style={{ left: x + 12, top: y + 12 }}>
      <div className="hud-tooltip__title">{node.name}</div>
      <div className="hud-tooltip__meta">
        <span className="hud-tooltip__status">{node.status.toUpperCase()}</span>
        <span className="hud-tooltip__score">{node.score}</span>
      </div>
      <div className="hud-tooltip__why">{node.explanation.oneLineWhy}</div>
    </div>
  )
}
