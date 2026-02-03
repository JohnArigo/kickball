import './HudSidePanel.css'
import type { OrgNode } from '../../data/types'

type DependencyItem = {
  name: string
  status: string
  penalty: number
}

type HudSidePanelProps = {
  company: OrgNode
  branch: OrgNode
  division: OrgNode
  department: OrgNode
  team: OrgNode
  showDependencies: boolean
  onlyAlerted: boolean
  explodeAll: boolean
  onToggleDependencies: () => void
  onToggleAlerted: () => void
  onToggleExplodeAll: () => void
  onRootCause: () => void
  upstream: DependencyItem[]
}

export const HudSidePanel = ({
  company,
  branch,
  division,
  department,
  team,
  showDependencies,
  onlyAlerted,
  explodeAll,
  onToggleDependencies,
  onToggleAlerted,
  onToggleExplodeAll,
  onRootCause,
  upstream,
}: HudSidePanelProps) => {
  const rootCause = `Company is ${company.status} because ${branch.name} is ${branch.status} driven by ${division.name} -> ${department.name} -> ${team.name}.`
  const rootCauseCompact = `${branch.name} ${branch.status} -> ${division.name} -> ${department.name} -> ${team.name}`

  const kpiDriver = department.explanation.topKpiDrivers[0]
  const childDriver = division.explanation.topChildDrivers[0]
  const dependencyDriver = showDependencies ? branch.explanation.topDependencyDrivers[0] : undefined

  return (
    <aside className="hud-panel">
      <div className="hud-panel__controls">
        <button className={`hud-toggle ${showDependencies ? 'is-on' : ''}`} onClick={onToggleDependencies}>
          <span className="hud-toggle__pill" />
          <span>Show Dependencies</span>
        </button>
        <button className={`hud-toggle ${explodeAll ? 'is-on' : ''}`} onClick={onToggleExplodeAll}>
          <span className="hud-toggle__pill" />
          <span>Explode All</span>
        </button>
        <button className={`hud-chip ${onlyAlerted ? 'is-on' : ''}`} onClick={onToggleAlerted}>
          Only Red/Yellow
        </button>
        <button className="hud-root-button" onClick={onRootCause}>
          Root Cause
        </button>
      </div>

      <div className="hud-panel__body">
        <div className="hud-panel__section">
          <h3>Root Cause</h3>
          <p className="hud-panel__root" title={rootCause}>{rootCause}</p>
          <p className="hud-panel__root hud-panel__root--compact" title={rootCauseCompact}>
            {rootCauseCompact}
          </p>
        </div>

        <div className="hud-panel__section">
          <h4>Drivers (cause to effect)</h4>
          <ul>
            {kpiDriver ? <li title={kpiDriver}>KPI drag to {kpiDriver}</li> : null}
            {childDriver ? <li title={childDriver}>Weak child to {childDriver}</li> : null}
            {dependencyDriver ? <li title={dependencyDriver}>Dependency hit to {dependencyDriver}</li> : null}
          </ul>
        </div>

        {showDependencies ? (
          <div className="hud-panel__section hud-panel__section--deps">
            <h4>Upstream blockers</h4>
            {upstream.length === 0 ? (
              <p className="hud-panel__empty">No active blockers.</p>
            ) : (
              <ul className="hud-panel__deps">
                {upstream.map((dep) => (
                  <li key={dep.name} className={`status-${dep.status}`} title={`${dep.name} ${dep.status} -${dep.penalty}`}>
                    <span>{dep.name}</span>
                    <span>{dep.status.toUpperCase()}</span>
                    <span>-{dep.penalty}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </div>
    </aside>
  )
}
