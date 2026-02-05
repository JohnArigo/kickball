import type { OrgNode } from './types'

export type WedgeState = 'sleep' | 'wake' | 'alarm' | 'child' | 'suppressed'

export const deriveWedgeStates = (
  visibleIds: Set<string>,
  selectedNodeId: string | null,
  hoveredNodeId: string | null,
  nodes: Map<string, OrgNode>,
): Map<string, WedgeState> => {
  const states = new Map<string, WedgeState>()
  const hasAlarm = Boolean(selectedNodeId && visibleIds.has(selectedNodeId))
  const selectedNode = selectedNodeId ? nodes.get(selectedNodeId) : undefined

  const siblingIds = new Set<string>()
  if (selectedNode?.parentId) {
    const parent = nodes.get(selectedNode.parentId)
    parent?.childrenIds.forEach((id) => {
      if (id !== selectedNodeId) siblingIds.add(id)
    })
  }

  const childIds = new Set(selectedNode?.childrenIds ?? [])

  visibleIds.forEach((id) => {
    let state: WedgeState = 'sleep'

    if (id === selectedNodeId) {
      state = 'alarm'
    } else if (!hasAlarm && hoveredNodeId && id === hoveredNodeId) {
      state = 'wake'
    } else if (hasAlarm && childIds.has(id)) {
      state = 'child'
    } else if (hasAlarm && siblingIds.has(id)) {
      state = 'sleep'
    } else if (hasAlarm) {
      state = 'suppressed'
    }

    states.set(id, state)
  })

  return states
}
