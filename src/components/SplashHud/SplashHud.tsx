import { useCallback, useEffect, useMemo, useState } from 'react'
import './SplashHud.css'
import { buildOrg } from '../../data/buildOrg'
import type { OrgData, OrgNode } from '../../data/types'
import { HudSidePanel, type DependencyInfo } from './HudSidePanel'
import { HudTooltip } from './HudTooltip'
import { RadialHud, type HoverInfo } from './RadialHud'
import { DEFAULT_FUNCTION_DEPENDENCIES } from '../../data/functionDependencies'
import { deriveFunctionEdges } from '../../data/deriveFunctionEdges'
import { derivePressureMarks, type HudNode, type PressureMark } from '../../data/derivePressureMarks'
import type { OrgNode as HudOrgNode, DepEdge } from '../../data/hudModel'
import { buildMockCrossLevelDeps } from '../../data/mockCrossLevelDeps'
import { deriveZoomedVisibility } from '../../data/deriveZoomedVisibility'
import { deriveAllNodeLighting } from '../../data/deriveNodeLighting'
import { useZoom } from '../../hooks/useZoom'
import { ZoomBreadcrumb } from './ZoomBreadcrumb'
import { ZoomControls } from './ZoomControls'
import { MiniMap } from './MiniMap'
import { getPathToNode } from '../../utils/nodePathUtils'

const lowestByScore = (nodes: Record<string, OrgNode>, ids: string[]) => {
  return ids.reduce((lowest, id) => {
    const node = nodes[id]
    if (!lowest) return node
    return node.score < lowest.score ? node : lowest
  }, null as OrgNode | null)
}

const findInitialSelection = (org: OrgData) => {
  const worstBranch = lowestByScore(org.nodesById, org.branchIds)
  return worstBranch?.id ?? org.rootId
}

export const SplashHud = ({ seed }: { seed: number }) => {
  const org = useMemo(() => buildOrg(seed), [seed])
  const orgNodeMap = useMemo(() => new Map(Object.entries(org.nodesById)), [org])
  const { zoomState, zoomIn, zoomOut, zoomTo, resetZoom } = useZoom(org.rootId)
  const initialSelection = useMemo(() => findInitialSelection(org), [org])

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(initialSelection)
  const [hoverInfo, setHoverInfo] = useState<HoverInfo>(null)

  const pressureMode = true
  const showSecondaryPressure = true
  const showCrossRingTicks = true

  useEffect(() => {
    setSelectedNodeId(initialSelection)
  }, [initialSelection])

  const treeNodes: HudOrgNode[] = useMemo(
    () =>
      Object.values(org.nodesById).map((node) => ({
        id: node.id,
        label: node.name,
        parentId: node.parentId,
        level: node.level,
        majorOrgId: node.level === 'branch' ? node.id : node.parentId ? `branch-${node.id.split('-')[1]}` : node.id,
        childrenIds: node.childrenIds,
        sortIndex: node.parentId ? org.nodesById[node.parentId]?.childrenIds.indexOf(node.id) ?? 0 : 0,
        status: node.status,
        score: node.score,
      })),
    [org],
  )

  const selectedNode = selectedNodeId ? org.nodesById[selectedNodeId] : null

  const baseEdges: DepEdge[] = selectedNode && selectedNode.level === 'branch' && selectedNodeId
    ? deriveFunctionEdges(DEFAULT_FUNCTION_DEPENDENCIES, selectedNodeId).map((edge) => ({
        id: edge.id,
        fromId: edge.fromId,
        toId: edge.toId,
        weight: edge.weight,
      }))
    : []

  const mockEdges = buildMockCrossLevelDeps(treeNodes)

  const activeEdges = selectedNodeId
    ? [...baseEdges, ...mockEdges].filter((edge) => edge.fromId === selectedNodeId)
    : []

  const { visibleIds, ringAssignments, lineagePath } = useMemo(
    () => deriveZoomedVisibility(zoomState, orgNodeMap, selectedNodeId),
    [zoomState, orgNodeMap, selectedNodeId],
  )

  const nodeLighting = useMemo(
    () => deriveAllNodeLighting(visibleIds, selectedNodeId, orgNodeMap),
    [visibleIds, selectedNodeId, orgNodeMap],
  )

  const dependencies: DependencyInfo[] = useMemo(() => {
    if (!selectedNodeId) return []

    const targetMap = new Map<string, DependencyInfo>()
    activeEdges.forEach((edge) => {
      const landingId = edge.toPath?.at(-1) ?? edge.toId
      if (!orgNodeMap.has(landingId)) return
      const landingPath = edge.toPath ?? getPathToNode(landingId, orgNodeMap, org.rootId)
      const pathFromRoot = getPathToNode(landingId, orgNodeMap, org.rootId)
      const existing = targetMap.get(landingId)
      if (!existing || edge.weight > existing.weight) {
        targetMap.set(landingId, {
          id: edge.id,
          targetId: landingId,
          weight: edge.weight,
          landingPath,
          pathFromRoot,
          isVisible: visibleIds.has(landingId),
        })
      }
    })

    return Array.from(targetMap.values()).sort((a, b) => b.weight - a.weight)
  }, [activeEdges, org.rootId, orgNodeMap, selectedNodeId, visibleIds])

  const visibleDependencies = dependencies.filter((dep) => dep.isVisible)

  const pressureEdges: DepEdge[] = selectedNodeId
    ? visibleDependencies.map((dep) => ({
        id: `${selectedNodeId}__${dep.targetId}`,
        fromId: selectedNodeId,
        toId: dep.targetId,
        weight: dep.weight,
      }))
    : []

  const pressureHudNodes: HudNode[] = Array.from(ringAssignments.entries()).map(([id, ring]) => ({
    id,
    label: org.nodesById[id]?.name ?? id,
    ring,
    status: org.nodesById[id]?.status ?? 'green',
    score: org.nodesById[id]?.score,
  }))

  const pressureMarksArray = selectedNodeId && pressureMode
    ? derivePressureMarks(selectedNodeId, pressureHudNodes, pressureEdges)
    : []

  const pressureMarks = new Map<string, PressureMark>(
    pressureMarksArray.map((mark) => [mark.targetNodeId, mark]),
  )

  const dependencyEdges = selectedNodeId
    ? visibleDependencies.slice(0, 6).map((dep) => ({
        id: `${selectedNodeId}__${dep.targetId}`,
        fromId: selectedNodeId,
        toId: dep.targetId,
        weight: dep.weight,
      }))
    : []

  const canZoomIn = useMemo(() => {
    if (!selectedNodeId) return false
    return (org.nodesById[selectedNodeId]?.childrenIds.length ?? 0) > 0
  }, [org.nodesById, selectedNodeId])

  const canZoomOut = zoomState.zoomLevel > 0

  const handleNodeSelect = useCallback((id: string) => {
    setSelectedNodeId((prev) => (prev === id ? null : id))
  }, [])

  const handleZoomIn = useCallback((targetId?: string) => {
    const zoomTarget = targetId ?? selectedNodeId
    if (!zoomTarget) return
    const node = org.nodesById[zoomTarget]
    if (!node || node.childrenIds.length === 0) return
    zoomIn(zoomTarget)
    setSelectedNodeId(null)
  }, [org.nodesById, selectedNodeId, zoomIn])

  const handleZoomOut = useCallback(() => {
    zoomOut()
    setSelectedNodeId(null)
  }, [zoomOut])

  const handleZoomTo = useCallback((targetId: string, path: string[]) => {
    zoomTo(targetId, path)
    setSelectedNodeId(null)
  }, [zoomTo])

  const handleResetZoom = useCallback(() => {
    resetZoom()
    setSelectedNodeId(null)
  }, [resetZoom])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA', 'BUTTON', 'SELECT'].includes(target.tagName)) {
        return
      }

      if (event.key === 'Escape' && canZoomOut) {
        event.preventDefault()
        handleZoomOut()
        return
      }

      if (event.key === 'Enter' && canZoomIn) {
        event.preventDefault()
        handleZoomIn()
        return
      }

      if (event.key === 'Home') {
        event.preventDefault()
        handleResetZoom()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [canZoomIn, canZoomOut, handleResetZoom, handleZoomIn, handleZoomOut])

  return (
    <div className={`splash-hud ${pressureMode ? 'is-pressure' : ''}`}>
      <div className="splash-hud__main">
        <div className="hud-top-bar">
          <ZoomBreadcrumb
            zoomState={zoomState}
            nodes={orgNodeMap}
            onZoomTo={handleZoomTo}
            onReset={handleResetZoom}
          />
          <ZoomControls
            zoomState={zoomState}
            canZoomIn={canZoomIn}
            canZoomOut={canZoomOut}
            onZoomIn={() => handleZoomIn()}
            onZoomOut={handleZoomOut}
            onReset={handleResetZoom}
          />
        </div>
        <div className="splash-hud__radial-shell">
          <RadialHud
            nodes={orgNodeMap}
            visibleIds={visibleIds}
            ringAssignments={ringAssignments}
            zoomState={zoomState}
            selectedNodeId={selectedNodeId}
            lineagePath={lineagePath}
            nodeLighting={nodeLighting}
            pressureMarks={pressureMarks}
            dependencyEdges={dependencyEdges}
            pressureMode={pressureMode}
            showSecondaryPressure={showSecondaryPressure}
            showCrossRingTicks={showCrossRingTicks}
            onNodeSelect={handleNodeSelect}
            onNodeZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onHover={(info) => setHoverInfo(info)}
            onHoverOut={() => setHoverInfo(null)}
          />
          {zoomState.anchorId && org.nodesById[zoomState.anchorId] ? (
            <div className={`splash-hud__center status-${org.nodesById[zoomState.anchorId].status}`}>
              <div className="splash-hud__label">{org.nodesById[zoomState.anchorId].name}</div>
              <div className="splash-hud__score">{org.nodesById[zoomState.anchorId].score}</div>
              <div className="splash-hud__status">{org.nodesById[zoomState.anchorId].status.toUpperCase()}</div>
            </div>
          ) : null}
        </div>
        <MiniMap
          nodes={orgNodeMap}
          rootId={org.rootId}
          branchIds={org.branchIds}
          zoomState={zoomState}
          onNavigate={handleZoomTo}
        />
      </div>

      <div className="splash-hud__side">
        <HudSidePanel
          selectedNode={selectedNode}
          lineagePath={lineagePath}
          nodes={orgNodeMap}
          zoomState={zoomState}
          dependencies={dependencies}
          pressureMarks={pressureMarks}
          onZoomTo={handleZoomTo}
          onNodeSelect={handleNodeSelect}
        />
      </div>

      {hoverInfo ? (
        <HudTooltip node={org.nodesById[hoverInfo.nodeId]} x={hoverInfo.x} y={hoverInfo.y} />
      ) : null}
    </div>
  )
}
