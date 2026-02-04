import './HudSidePanel.css'
import type { OrgNode } from '../../data/types'

type DependencyItem = {
  name: string
  status: string
  weight: number
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
  pressureMode: boolean
  showSecondaryPressure: boolean
  showCrossRingTicks: boolean
  showArrowsExplain: boolean
  panelTab: 'overview' | 'dependencies' | 'root'
  onChangePanelTab: (tab: 'overview' | 'dependencies' | 'root') => void
  showAdvanced: boolean
  onToggleAdvanced: () => void
  dependsOnLine: string
  strongestLine: string
  onToggleDependencies: () => void
  onToggleAlerted: () => void
  onToggleExplodeAll: () => void
  onTogglePressureMode: () => void
  onToggleSecondaryPressure: () => void
  onToggleCrossRingTicks: () => void
  onToggleArrowsExplain: () => void
  onRootCause: () => void
  dependencyHeadline: string
  landingLine: string
  remainingDependencies: { name: string; weight: number }[]
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
  pressureMode,
  showSecondaryPressure,
  showCrossRingTicks,
  showArrowsExplain,
  panelTab,
  onChangePanelTab,
  showAdvanced,
  onToggleAdvanced,
  dependsOnLine,
  strongestLine,
  onToggleDependencies,
  onToggleAlerted,
  onToggleExplodeAll,
  onTogglePressureMode,
  onToggleSecondaryPressure,
  onToggleCrossRingTicks,
  onToggleArrowsExplain,
  onRootCause,
  dependencyHeadline,
  landingLine,
  remainingDependencies,
  upstream,
}: HudSidePanelProps) => {
  const rootCause = `Company is ${company.status} because ${branch.name} is ${branch.status} driven by ${division.name} -> ${department.name} -> ${team.name}.`
  const rootCauseCompact = `${branch.name} ${branch.status} -> ${division.name} -> ${department.name} -> ${team.name}`

  const kpiDriver = department.explanation.topKpiDrivers[0]
  const childDriver = division.explanation.topChildDrivers[0]
  const dependencyDriver = showDependencies ? branch.explanation.topDependencyDrivers[0] : undefined

  return (
    <aside className="hud-panel">
      <div className="hud-panel__tabs">
        <button className={panelTab === 'overview' ? 'is-active' : ''} onClick={() => onChangePanelTab('overview')}>
          Overview
        </button>
        <button className={panelTab === 'dependencies' ? 'is-active' : ''} onClick={() => onChangePanelTab('dependencies')}>
          Dependencies
        </button>
        <button className={panelTab === 'root' ? 'is-active' : ''} onClick={() => onChangePanelTab('root')}>
          Root Cause
        </button>
      </div>

      <div className="hud-panel__body">
        {panelTab === 'overview' ? (
          <>
            <div className="hud-panel__section">
              <h3>Summary</h3>
              <p className="hud-panel__root" title={dependsOnLine}>{dependsOnLine}</p>
              {strongestLine ? <p className="hud-panel__root" title={strongestLine}>{strongestLine}</p> : null}
            </div>
            <div className="hud-panel__section">
              <h4>Drivers (cause to effect)</h4>
              <ul>
                {kpiDriver ? <li title={kpiDriver}>KPI drag to {kpiDriver}</li> : null}
                {childDriver ? <li title={childDriver}>Weak child to {childDriver}</li> : null}
                {dependencyDriver ? <li title={dependencyDriver}>Dependency hit to {dependencyDriver}</li> : null}
              </ul>
            </div>
          </>
        ) : null}

        {panelTab === 'dependencies' ? (
          <>
            <div className="hud-panel__section">
              <h3>Dependencies</h3>
              <p className="hud-panel__root" title={dependencyHeadline}>{dependencyHeadline}</p>
              <p className="hud-panel__root" title={dependsOnLine}>{dependsOnLine}</p>
              {strongestLine ? <p className="hud-panel__root" title={strongestLine}>{strongestLine}</p> : null}
              {landingLine ? <p className="hud-panel__root" title={landingLine}>{landingLine}</p> : null}
            </div>
            <div className="hud-panel__section">
              <div className="hud-panel__controls">
                <button className={`hud-toggle ${pressureMode ? 'is-on' : ''}`} onClick={onTogglePressureMode}>
                  <span className="hud-toggle__pill" />
                  <span>Pressure Mode</span>
                </button>
                <button className={`hud-toggle ${showArrowsExplain ? 'is-on' : ''}`} onClick={onToggleArrowsExplain}>
                  <span className="hud-toggle__pill" />
                  <span>Show Arrows</span>
                </button>
                <button className={`hud-toggle ${showSecondaryPressure ? 'is-on' : ''}`} onClick={onToggleSecondaryPressure}>
                  <span className="hud-toggle__pill" />
                  <span>Show Secondary</span>
                </button>
                <button className={`hud-toggle ${explodeAll ? 'is-on' : ''}`} onClick={onToggleExplodeAll}>
                  <span className="hud-toggle__pill" />
                  <span>Show Departments (All Orgs)</span>
                </button>
                <button className="hud-advanced" onClick={onToggleAdvanced}>
                  {showAdvanced ? 'Hide Advanced' : 'Advanced'}
                </button>
                {showAdvanced ? (
                  <button className={`hud-toggle ${showCrossRingTicks ? 'is-on' : ''}`} onClick={onToggleCrossRingTicks}>
                    <span className="hud-toggle__pill" />
                    <span>Cross-Ring Ticks</span>
                  </button>
                ) : null}
              </div>
            </div>
          </>
        ) : null}

        {panelTab === 'root' ? (
          <>
            <div className="hud-panel__section">
              <h3>Root Cause</h3>
              <p className="hud-panel__root" title={rootCause}>{rootCause}</p>
              <p className="hud-panel__root hud-panel__root--compact" title={rootCauseCompact}>
                {rootCauseCompact}
              </p>
            </div>
          </>
        ) : null}

        {showDependencies && panelTab === 'dependencies' ? (
          <div className="hud-panel__section hud-panel__section--deps">
            <h4>Upstream blockers</h4>
            {upstream.length === 0 ? (
              <p className="hud-panel__empty">No active blockers.</p>
            ) : (
              <ul className="hud-panel__deps">
                {upstream.map((dep) => (
                  <li key={dep.name} className={`status-${dep.status}`} title={`${dep.name} ${dep.status} ${dep.weight}/10`}>
                    <span className="hud-panel__dot" />
                    <span>{dep.name}</span>
                    <span className="hud-panel__weight">{dep.weight}/10</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}

        {showDependencies && panelTab === 'dependencies' && remainingDependencies.length > 0 ? (
          <div className="hud-panel__section">
            <h4>Additional dependencies</h4>
            <ul className="hud-panel__deps">
              {remainingDependencies.map((dep) => (
                <li key={dep.name} title={`${dep.name} ${dep.weight}/10`}>
                  <span className="hud-panel__dot" />
                  <span>{dep.name}</span>
                  <span className="hud-panel__weight">{dep.weight}/10</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </aside>
  )
}
