import type { DepEdge, NodeId, OrgNode } from './hudModel'
import { RCL, levelIndex } from './constants'

export type FocusTargetsResult = {
  targets: { id: NodeId; weight: number; ring: number; intensity01: number; landingPath?: string[] }[]
  primaryTargets: { id: NodeId; weight: number }[]
  secondaryTargets: { id: NodeId; weight: number }[]
  expandedNodeIds: Set<NodeId>
}

const easeOut = (t: number) => Math.pow(t, 0.7)
const buildAncestorChain = (nodeId: NodeId, nodeById: Record<string, OrgNode>) => {
  const chain: NodeId[] = []
  let current = nodeById[nodeId]
  while (current) {
    chain.push(current.id)
    if (!current.parentId) break
    current = nodeById[current.parentId]
  }
  return chain
}

export const computeFocusTargetsAndExpansion = (
  focusNodeId: NodeId | null,
  nodes: OrgNode[],
  edges: DepEdge[],
  visibleLevel = RCL,
): FocusTargetsResult => {
  const expandedNodeIds = new Set<NodeId>()
  if (!focusNodeId) {
    return { targets: [], primaryTargets: [], secondaryTargets: [], expandedNodeIds }
  }

  const nodeById = nodes.reduce<Record<string, OrgNode>>((acc, node) => {
    acc[node.id] = node
    return acc
  }, {})

  const focusEdges = edges.filter((edge) => edge.fromId === focusNodeId && edge.weight > 0)

  if (focusEdges.length === 0) {
    const focusNode = nodeById[focusNodeId]
    if (focusNode) {
      buildAncestorChain(focusNode.id, nodeById).forEach((id) => expandedNodeIds.add(id))
      focusNode.childrenIds.forEach((childId) => expandedNodeIds.add(childId))
    }
    return { targets: [], primaryTargets: [], secondaryTargets: [], expandedNodeIds }
  }

  const landingTargets = focusEdges.map((edge) => {
    const landing = edge.toPath && edge.toPath.length > 0 ? edge.toPath[edge.toPath.length - 1] : edge.toId
    const landingNode = nodeById[landing]
    const landingPath = edge.toPath && edge.toPath.length > 0 ? edge.toPath : buildAncestorChain(landing, nodeById)
    let visibleTarget = landingNode?.id ?? landing
    let current = landingNode
    while (current && levelIndex(current.level) > visibleLevel) {
      if (!current.parentId) break
      current = nodeById[current.parentId]
      if (current) visibleTarget = current.id
    }
    return {
      id: visibleTarget,
      weight: edge.weight,
      ring: current?.level === 'branch' ? 0 : current?.level === 'division' ? 1 : current?.level === 'department' ? 2 : 3,
      landingPath,
    }
  })

  const maxWeightByRing = landingTargets.reduce<Record<number, number>>((acc, target) => {
    acc[target.ring] = Math.max(acc[target.ring] ?? 0, target.weight)
    return acc
  }, {})

  const targets = landingTargets.map((target) => {
    const maxWeight = maxWeightByRing[target.ring] || 1
    const t = maxWeight > 0 ? target.weight / maxWeight : 0
    return {
      ...target,
      intensity01: easeOut(t),
    }
  })

  const sorted = [...targets].sort((a, b) => b.weight - a.weight)
  const primaryTargets = sorted.slice(0, 4).map((target) => ({ id: target.id, weight: target.weight }))
  const secondaryTargets = sorted.slice(4).map((target) => ({ id: target.id, weight: target.weight }))

  const focusNode = nodeById[focusNodeId]
  if (focusNode) {
    buildAncestorChain(focusNode.id, nodeById).forEach((id) => expandedNodeIds.add(id))
    focusNode.childrenIds.forEach((childId) => expandedNodeIds.add(childId))
  }

  landingTargets.forEach((target) => {
    const landingNode = nodeById[target.id]
    if (!landingNode) return
    buildAncestorChain(landingNode.id, nodeById).forEach((id) => {
      const node = nodeById[id]
      if (!node) return
      if (levelIndex(node.level) <= visibleLevel) {
        expandedNodeIds.add(id)
      }
    })
  })

  // Always keep ring-0 functions visible
  nodes
    .filter((node) => node.level === 'branch')
    .forEach((node) => expandedNodeIds.add(node.id))

  return { targets, primaryTargets, secondaryTargets, expandedNodeIds }
}
