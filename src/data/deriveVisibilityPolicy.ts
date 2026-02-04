import type { DepEdge, NodeId, OrgNode } from './hudModel'

export type VisibilityPolicy = {
  visibleIds: Set<NodeId>
  expandedMajorOrgIds: Set<NodeId>
  visibleLevel: number
}

const levelIndex = (level: OrgNode['level']) =>
  level === 'company' ? 0 : level === 'branch' ? 1 : level === 'division' ? 2 : level === 'department' ? 3 : 4

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

export const deriveVisibilityPolicy = (
  activeTab: 'overview' | 'dependencies' | 'root',
  focusStack: NodeId[],
  nodes: OrgNode[],
  edges: DepEdge[],
  contextExplodeEnabled: boolean,
  visibleLevel = 3,
): VisibilityPolicy => {
  const visibleIds = new Set<NodeId>()
  const expandedMajorOrgIds = new Set<NodeId>()

  const nodeById = nodes.reduce<Record<string, OrgNode>>((acc, node) => {
    acc[node.id] = node
    return acc
  }, {})

  const focusNodeId = focusStack.at(-1)
  const focusNode = focusNodeId ? nodeById[focusNodeId] : undefined

  if (activeTab === 'dependencies' && contextExplodeEnabled) {
    nodes
      .filter((node) => levelIndex(node.level) <= visibleLevel)
      .forEach((node) => visibleIds.add(node.id))

    if (focusNode) {
      const focusChain = buildAncestorChain(focusNode.id, nodeById)
      focusChain.forEach((id) => visibleIds.add(id))
      if (levelIndex(focusNode.level) >= visibleLevel) {
        focusNode.childrenIds.forEach((childId) => visibleIds.add(childId))
      }
    }
  } else {
    if (focusNode) {
      const focusChain = buildAncestorChain(focusNode.id, nodeById)
      focusChain.forEach((id) => visibleIds.add(id))
      focusNode.childrenIds.forEach((childId) => visibleIds.add(childId))
    }
  }

  edges
    .filter((edge) => edge.fromId === focusNodeId && edge.weight > 0)
    .forEach((edge) => {
      const landing = edge.toPath && edge.toPath.length > 0 ? edge.toPath[edge.toPath.length - 1] : edge.toId
      const chain = buildAncestorChain(landing, nodeById)
      chain.forEach((id) => {
        const node = nodeById[id]
        if (!node) return
        if (levelIndex(node.level) <= visibleLevel) {
          visibleIds.add(id)
        }
      })
    })

  nodes
    .filter((node) => node.level === 'branch')
    .forEach((node) => {
      visibleIds.add(node.id)
      if (visibleIds.has(node.id)) {
        expandedMajorOrgIds.add(node.id)
      }
    })

  nodes.forEach((node) => {
    if (visibleIds.has(node.id)) {
      expandedMajorOrgIds.add(node.majorOrgId)
    }
  })

  return { visibleIds, expandedMajorOrgIds, visibleLevel }
}
