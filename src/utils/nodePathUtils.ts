import type { OrgNode } from '../data/types'

export const getPathToNode = (
  nodeId: string,
  nodes: Map<string, OrgNode>,
  rootId: string,
): string[] => {
  const path: string[] = []
  let current = nodes.get(nodeId)
  while (current) {
    path.unshift(current.id)
    if (current.id === rootId) break
    current = current.parentId ? nodes.get(current.parentId) : undefined
  }
  return path
}

export const isAncestor = (
  ancestorId: string,
  descendantId: string,
  nodes: Map<string, OrgNode>,
): boolean => {
  let current = nodes.get(descendantId)
  while (current) {
    if (current.id === ancestorId) return true
    current = current.parentId ? nodes.get(current.parentId) : undefined
  }
  return false
}

export const getDescendants = (
  nodeId: string,
  nodes: Map<string, OrgNode>,
  maxDepth: number,
): Set<string> => {
  const descendants = new Set<string>()

  const traverse = (id: string, depth: number) => {
    if (depth > maxDepth) return
    const node = nodes.get(id)
    if (!node) return
    for (const childId of node.childrenIds) {
      descendants.add(childId)
      traverse(childId, depth + 1)
    }
  }

  traverse(nodeId, 0)
  return descendants
}
