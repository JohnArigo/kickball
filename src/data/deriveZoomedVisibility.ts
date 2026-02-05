import type { OrgNode } from './types'
import type { ZoomState } from '../types/zoom'

export type ZoomedVisibilityResult = {
  visibleIds: Set<string>
  ringAssignments: Map<string, number>
  lineagePath: string[]
}

const MAX_VISIBLE_DEPTH = 3

export const deriveZoomedVisibility = (
  zoomState: ZoomState,
  nodes: Map<string, OrgNode>,
  selectedNodeId: string | null,
): ZoomedVisibilityResult => {
  const { anchorId, visibleDepth } = zoomState
  const visibleIds = new Set<string>()
  const ringAssignments = new Map<string, number>()

  const anchorNode = nodes.get(anchorId)
  if (!anchorNode) return { visibleIds, ringAssignments, lineagePath: [] }

  visibleIds.add(anchorId)
  ringAssignments.set(anchorId, 0)

  const depthLimit = Math.min(MAX_VISIBLE_DEPTH, Math.max(0, visibleDepth))
  let currentRing: string[] = [anchorId]
  for (let ring = 1; ring <= depthLimit; ring += 1) {
    const nextRing: string[] = []
    for (const parentId of currentRing) {
      const parent = nodes.get(parentId)
      if (!parent) continue
      for (const childId of parent.childrenIds) {
        visibleIds.add(childId)
        ringAssignments.set(childId, ring)
        nextRing.push(childId)
      }
    }
    currentRing = nextRing
    if (currentRing.length === 0) break
  }

  const lineagePath = selectedNodeId ? computeLineage(selectedNodeId, anchorId, nodes) : []

  return { visibleIds, ringAssignments, lineagePath }
}

const computeLineage = (
  nodeId: string,
  anchorId: string,
  nodes: Map<string, OrgNode>,
) => {
  const path: string[] = []
  let current = nodes.get(nodeId)

  while (current) {
    path.unshift(current.id)
    if (current.id === anchorId) break
    current = current.parentId ? nodes.get(current.parentId) : undefined
  }

  if (path[0] !== anchorId) return []
  return path
}
