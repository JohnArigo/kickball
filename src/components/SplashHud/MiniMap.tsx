import { useMemo } from 'react'
import './MiniMap.css'
import type { OrgNode } from '../../data/types'
import type { ZoomState } from '../../types/zoom'
import { getPathToNode } from '../../utils/nodePathUtils'

type MiniMapProps = {
  nodes: Map<string, OrgNode>
  rootId: string
  branchIds: string[]
  zoomState: ZoomState
  onNavigate: (nodeId: string, path: string[]) => void
}

type MiniMapNode = {
  id: string
  name: string
  level: number
  status: OrgNode['status']
  children: MiniMapNode[]
}

export const MiniMap = ({ nodes, rootId, branchIds, zoomState, onNavigate }: MiniMapProps) => {
  const miniMapNodes = useMemo(() => {
    const result: MiniMapNode[] = []
    const root = nodes.get(rootId)
    if (!root) return result

    result.push({
      id: root.id,
      name: root.name,
      level: 0,
      status: root.status,
      children: [],
    })

    for (const branchId of branchIds) {
      const branch = nodes.get(branchId)
      if (!branch) continue
      const branchNode: MiniMapNode = {
        id: branch.id,
        name: branch.name,
        level: 1,
        status: branch.status,
        children: [],
      }
      for (const divId of branch.childrenIds.slice(0, 4)) {
        const div = nodes.get(divId)
        if (!div) continue
        branchNode.children.push({
          id: div.id,
          name: div.name,
          level: 2,
          status: div.status,
          children: [],
        })
      }
      result.push(branchNode)
    }

    return result
  }, [branchIds, nodes, rootId])

  const handleNodeClick = (nodeId: string) => {
    const path = getPathToNode(nodeId, nodes, rootId)
    onNavigate(nodeId, path)
  }

  return (
    <div className="mini-map">
      <div className="mini-map-header">
        <span className="mini-map-title">Overview</span>
      </div>
      <svg viewBox="0 0 120 120" className="mini-map-svg">
        <MiniMapRadial
          nodes={miniMapNodes}
          zoomPath={zoomState.zoomPath}
          anchorId={zoomState.anchorId}
          onNodeClick={handleNodeClick}
        />
      </svg>
      <div className="mini-map-location">
        <span className="location-dot">o</span>
        <span className="location-name">{nodes.get(zoomState.anchorId)?.name ?? 'Unknown'}</span>
      </div>
    </div>
  )
}

type MiniMapRadialProps = {
  nodes: MiniMapNode[]
  zoomPath: string[]
  anchorId: string
  onNodeClick: (nodeId: string) => void
}

const MiniMapRadial = ({ nodes, zoomPath, anchorId, onNodeClick }: MiniMapRadialProps) => {
  const centerX = 60
  const centerY = 60
  const ringRadii = [0, 25, 45]
  const root = nodes[0]
  const branches = nodes.slice(1)
  const branchAngle = (2 * Math.PI) / Math.max(1, branches.length)

  return (
    <g>
      <circle
        cx={centerX}
        cy={centerY}
        r={ringRadii[1] + 10}
        fill="none"
        stroke="rgba(255,255,255,0.1)"
        strokeWidth={20}
      />
      <circle
        cx={centerX}
        cy={centerY}
        r={ringRadii[2] + 8}
        fill="none"
        stroke="rgba(255,255,255,0.05)"
        strokeWidth={16}
      />
      {root ? (
        <circle
          cx={centerX}
          cy={centerY}
          r={8}
          fill={getStatusColor(root.status)}
          stroke={anchorId === root.id ? '#10b981' : 'transparent'}
          strokeWidth={2}
          className="mini-node clickable"
          onClick={() => onNodeClick(root.id)}
        />
      ) : null}
      {branches.map((branch, i) => {
        const angle = i * branchAngle - Math.PI / 2
        const x = centerX + ringRadii[1] * Math.cos(angle)
        const y = centerY + ringRadii[1] * Math.sin(angle)
        const isInPath = zoomPath.includes(branch.id)
        const isCurrent = anchorId === branch.id
        return (
          <g key={branch.id}>
            <circle
              cx={x}
              cy={y}
              r={6}
              fill={getStatusColor(branch.status)}
              stroke={isCurrent ? '#10b981' : isInPath ? '#8b5cf6' : 'transparent'}
              strokeWidth={2}
              className="mini-node clickable"
              onClick={() => onNodeClick(branch.id)}
            />
            {branch.children.map((div, j) => {
              const divSpread = branchAngle * 0.6
              const divStart = angle - divSpread / 2
              const divAngle = divStart + (j / Math.max(branch.children.length - 1, 1)) * divSpread
              const dx = centerX + ringRadii[2] * Math.cos(divAngle)
              const dy = centerY + ringRadii[2] * Math.sin(divAngle)
              const divIsCurrent = anchorId === div.id
              const divInPath = zoomPath.includes(div.id)
              return (
                <circle
                  key={div.id}
                  cx={dx}
                  cy={dy}
                  r={4}
                  fill={getStatusColor(div.status)}
                  stroke={divIsCurrent ? '#10b981' : divInPath ? '#8b5cf6' : 'transparent'}
                  strokeWidth={1.5}
                  className="mini-node clickable"
                  onClick={() => onNodeClick(div.id)}
                />
              )
            })}
          </g>
        )
      })}
    </g>
  )
}

const getStatusColor = (status: OrgNode['status']) => {
  if (status === 'green') return '#22c55e'
  if (status === 'yellow') return '#eab308'
  return '#ef4444'
}
