import './ZoomBreadcrumb.css'
import type { OrgNode } from '../../data/types'
import type { ZoomState } from '../../types/zoom'

type ZoomBreadcrumbProps = {
  zoomState: ZoomState
  nodes: Map<string, OrgNode>
  onZoomTo: (nodeId: string, path: string[]) => void
  onReset: () => void
}

export const ZoomBreadcrumb = ({ zoomState, nodes, onZoomTo, onReset }: ZoomBreadcrumbProps) => {
  const { zoomPath } = zoomState

  const handleCrumbClick = (index: number) => {
    if (index === 0) {
      onReset()
      return
    }
    const targetId = zoomPath[index]
    const nextPath = zoomPath.slice(0, index + 1)
    onZoomTo(targetId, nextPath)
  }

  return (
    <nav className="zoom-breadcrumb" aria-label="Zoom navigation">
      <span className="breadcrumb-icon">LOC</span>
      <ol className="breadcrumb-list">
        {zoomPath.map((nodeId, index) => {
          const node = nodes.get(nodeId)
          const isLast = index === zoomPath.length - 1
          const name = node?.name ?? 'Unknown'
          return (
            <li key={nodeId} className="breadcrumb-item">
              {index > 0 ? <span className="breadcrumb-separator">{'>'}</span> : null}
              {isLast ? (
                <span className="breadcrumb-current">{name}</span>
              ) : (
                <button
                  className="breadcrumb-link"
                  onClick={() => handleCrumbClick(index)}
                  title={`Zoom to ${name}`}
                >
                  {name}
                </button>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
