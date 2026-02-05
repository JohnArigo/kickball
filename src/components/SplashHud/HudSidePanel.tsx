import './HudSidePanel.css'
import type { OrgNode } from '../../data/types'
import type { ZoomState } from '../../types/zoom'
import type { PressureMark } from '../../data/derivePressureMarks'

export type DependencyInfo = {
  id: string
  targetId: string
  weight: number
  landingPath: string[]
  pathFromRoot: string[]
  isVisible: boolean
}

type HudSidePanelProps = {
  selectedNode: OrgNode | null
  lineagePath: string[]
  nodes: Map<string, OrgNode>
  zoomState: ZoomState
  dependencies: DependencyInfo[]
  pressureMarks: Map<string, PressureMark>
  onZoomTo: (nodeId: string, path: string[]) => void
  onNodeSelect: (nodeId: string) => void
}

const formatStatus = (status: OrgNode['status']) => status.toUpperCase()

const buildPathLabel = (path: string[], nodes: Map<string, OrgNode>) =>
  path.map((id) => nodes.get(id)?.name ?? id).join(' > ')

export const HudSidePanel = ({
  selectedNode,
  lineagePath,
  nodes,
  zoomState,
  dependencies,
  pressureMarks,
  onZoomTo,
  onNodeSelect,
}: HudSidePanelProps) => {
  if (!selectedNode) {
    return (
      <aside className="hud-panel">
        <div className="hud-panel__body">
          <p className="hud-panel__empty">Select a node to see details.</p>
        </div>
      </aside>
    )
  }

  const lineageItems = lineagePath.map((id) => ({
    id,
    name: nodes.get(id)?.name ?? id,
  }))

  const zoomPathLabel = zoomState.zoomPath.length > 0
    ? buildPathLabel(zoomState.zoomPath, nodes)
    : ''

  const children = selectedNode.childrenIds
    .map((id) => nodes.get(id))
    .filter((node): node is OrgNode => Boolean(node))

  const strongest = dependencies[0]
  const dependsOnLine = strongest
    ? `Depends on ${nodes.get(strongest.targetId)?.name ?? strongest.targetId}`
    : 'No direct dependencies'
  const strongestLine = strongest
    ? `Strongest: ${nodes.get(strongest.targetId)?.name ?? strongest.targetId} (${strongest.weight}/10)`
    : ''

  return (
    <aside className="hud-panel">
      <div className="hud-panel__body">
        <section className="hud-panel__section">
          <h3 className="hud-panel__title">{selectedNode.name}</h3>
          <div className="hud-panel__summary">
            <span className={`hud-panel__status status-${selectedNode.status}`}>{formatStatus(selectedNode.status)}</span>
            <span className="hud-panel__score">{selectedNode.score}</span>
          </div>
        </section>

        <section className="hud-panel__section">
          <h4>Lineage</h4>
          {lineageItems.length === 0 ? (
            <p className="hud-panel__empty">Selection is outside the current zoom scope.</p>
          ) : (
            <div className="hud-panel__breadcrumb">
              {lineageItems.map((item, index) => {
                const isLast = index === lineageItems.length - 1
                return (
                  <span key={item.id} className="hud-panel__crumb">
                    {index > 0 ? <span className="hud-panel__crumb-sep">&gt;</span> : null}
                    {isLast ? (
                      <span className="hud-panel__crumb-current">{item.name}</span>
                    ) : (
                      <button
                        type="button"
                        className="hud-panel__crumb-link"
                        onClick={() => onNodeSelect(item.id)}
                      >
                        {item.name}
                      </button>
                    )}
                  </span>
                )
              })}
            </div>
          )}
          {zoomPathLabel ? <p className="hud-panel__hint">Zoom path: {zoomPathLabel}</p> : null}
        </section>

        <section className="hud-panel__section">
          <h4>Contains ({children.length})</h4>
          {children.length === 0 ? (
            <p className="hud-panel__empty">No sub-units under this node.</p>
          ) : (
            <ul className="hud-panel__list">
              {children.slice(0, 5).map((child) => (
                <li key={child.id} className={`status-${child.status}`}>
                  <button type="button" className="hud-panel__item-button" onClick={() => onNodeSelect(child.id)}>
                    <span className="hud-panel__dot" />
                    <span className="hud-panel__item-label">{child.name}</span>
                  </button>
                </li>
              ))}
              {children.length > 5 ? (
                <li className="hud-panel__more">+{children.length - 5} more</li>
              ) : null}
            </ul>
          )}
          {children.length > 0 ? <p className="hud-panel__hint">Double-click a node to zoom in.</p> : null}
        </section>

        <section className="hud-panel__section">
          <h4>Dependencies ({dependencies.length})</h4>
          <p className="hud-panel__root" title={dependsOnLine}>{dependsOnLine}</p>
          {strongestLine ? <p className="hud-panel__root" title={strongestLine}>{strongestLine}</p> : null}
          {dependencies.length === 0 ? (
            <p className="hud-panel__empty">No dependencies for this node.</p>
          ) : (
            <ul className="hud-panel__deps">
              {dependencies.map((dep) => {
                const name = nodes.get(dep.targetId)?.name ?? dep.targetId
                const isHighlighted = pressureMarks.has(dep.targetId)
                const landingLabel = buildPathLabel(dep.landingPath, nodes)
                return (
                  <li
                    key={dep.id}
                    className={`status-${nodes.get(dep.targetId)?.status ?? 'green'} ${isHighlighted ? 'is-highlight' : ''}`}
                    title={`${name} ${dep.weight}/10`}
                  >
                    <span className="hud-panel__dot" />
                    <div className="hud-panel__dep-main">
                      <span>{name}</span>
                      <span className="hud-panel__weight">{dep.weight}/10</span>
                    </div>
                    <span className="hud-panel__dep-path">{landingLabel}</span>
                    {!dep.isVisible ? (
                      <button
                        type="button"
                        className="hud-panel__action"
                        onClick={() => onZoomTo(dep.targetId, dep.pathFromRoot)}
                      >
                        Navigate to target
                      </button>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>
    </aside>
  )
}
