import type { DepEdge, OrgNode } from './hudModel'
import { CEL, FDD, LEVEL, MAX_REVEALS, RCL, levelIndex } from './constants'

export function deriveVisibilityPolicy(
  activeTab: string,
  focusStack: string[],
  nodes: Map<string, OrgNode>,
  branchIds: string[],
  activeEdges: DepEdge[],
  explodeAllEnabled: boolean,
  rootId: string,
): { visibleIds: Set<string> } {
  const visibleIds = new Set<string>()

  visibleIds.add(rootId)
  branchIds.forEach((id) => visibleIds.add(id))

  const isDependencies = activeTab === 'Dependencies'

  if (explodeAllEnabled && isDependencies) {
    applyContextExplodeRules(nodes, visibleIds)
  } else {
    applyFocusModeRules(focusStack, nodes, activeEdges, isDependencies, visibleIds)
  }

  applyFocusDrillDepth(focusStack, nodes, visibleIds)

  return { visibleIds }
}

function applyFocusModeRules(
  focusStack: string[],
  nodes: Map<string, OrgNode>,
  activeEdges: DepEdge[],
  isDependencies: boolean,
  visibleIds: Set<string>,
) {
  if (!focusStack.length) return

  const activeFocusId = focusStack.at(-1)
  if (!activeFocusId) return
  const focusNode = nodes.get(activeFocusId)
  if (!focusNode) return

  let current: OrgNode | undefined = focusNode
  while (current) {
    visibleIds.add(current.id)
    current = current.parentId ? nodes.get(current.parentId) : undefined
  }

  const parent = focusNode.parentId ? nodes.get(focusNode.parentId) : null
  if (parent) {
    parent.childrenIds.forEach((id) => visibleIds.add(id))
  }

  if (!isDependencies) return

  const focusBranchId = getMajorOrgId(focusNode, nodes)
  const sortedEdges = [...activeEdges]
    .map((edge) => ({ edge, weight: edge.weight ?? 5 }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, MAX_REVEALS)

  for (const { edge } of sortedEdges) {
    const landing = resolveLandingNode(edge, nodes)
    if (!landing) continue

    const targetBranchId = getMajorOrgId(landing, nodes)
    if (targetBranchId === focusBranchId) continue

    const revealNode = getRevealTarget(landing, nodes)
    visibleIds.add(revealNode.id)

    let ancestor: OrgNode | undefined = revealNode
    while (ancestor && levelIndex(ancestor.level) > LEVEL.MAJOR_ORG) {
      visibleIds.add(ancestor.id)
      ancestor = ancestor.parentId ? nodes.get(ancestor.parentId) : undefined
    }
  }
}

function applyFocusDrillDepth(
  focusStack: string[],
  nodes: Map<string, OrgNode>,
  visibleIds: Set<string>,
) {
  if (!focusStack.length) return

  const focusNode = nodes.get(focusStack.at(-1) ?? '')
  if (!focusNode) return

  for (const childId of focusNode.childrenIds) {
    const child = nodes.get(childId)
    if (child && levelIndex(child.level) === levelIndex(focusNode.level) + FDD) {
      visibleIds.add(childId)
    }
  }
}

function applyContextExplodeRules(nodes: Map<string, OrgNode>, visibleIds: Set<string>) {
  for (const node of nodes.values()) {
    if (levelIndex(node.level) <= CEL) visibleIds.add(node.id)
  }
}

function getMajorOrgId(node: OrgNode, nodes: Map<string, OrgNode>) {
  let current: OrgNode | undefined = node
  while (current && levelIndex(current.level) > LEVEL.MAJOR_ORG) {
    current = current.parentId ? nodes.get(current.parentId) : undefined
  }
  return current?.id ?? node.id
}

function resolveLandingNode(edge: DepEdge, nodes: Map<string, OrgNode>) {
  if (edge.toPath?.length) {
    const landingId = edge.toPath.at(-1)
    return landingId ? nodes.get(landingId) ?? null : null
  }
  return nodes.get(edge.toId) ?? null
}

function getRevealTarget(landing: OrgNode, nodes: Map<string, OrgNode>) {
  if (levelIndex(landing.level) <= RCL) return landing
  let current: OrgNode | undefined = landing
  while (current && levelIndex(current.level) > RCL) {
    current = current.parentId ? nodes.get(current.parentId) : undefined
  }
  return current ?? landing
}
