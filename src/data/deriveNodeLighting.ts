import type { OrgNode } from './types'
import type { LightingState, NodeLighting } from '../types/lighting'

const LIGHTING_CONFIG: Record<LightingState, Omit<NodeLighting, 'state'>> = {
  default: {
    opacity: 0.7,
    brightness: 1,
    saturation: 0.9,
    glowColor: null,
    glowIntensity: 0,
    borderWidth: 1,
    borderColor: 'var(--border-default)',
  },
  selected: {
    opacity: 1,
    brightness: 1.1,
    saturation: 1,
    glowColor: 'var(--accent-selection-glow)',
    glowIntensity: 12,
    borderWidth: 2.5,
    borderColor: 'var(--accent-selection)',
  },
  child: {
    opacity: 0.95,
    brightness: 1.05,
    saturation: 1,
    glowColor: 'var(--accent-children-glow)',
    glowIntensity: 6,
    borderWidth: 2,
    borderColor: 'var(--accent-children)',
  },
  grandchild: {
    opacity: 0.85,
    brightness: 1,
    saturation: 0.95,
    glowColor: null,
    glowIntensity: 0,
    borderWidth: 1.5,
    borderColor: 'var(--border-subtle)',
  },
  parent: {
    opacity: 0.85,
    brightness: 1,
    saturation: 0.95,
    glowColor: null,
    glowIntensity: 0,
    borderWidth: 2,
    borderColor: 'var(--accent-lineage)',
  },
  ancestor: {
    opacity: 0.75,
    brightness: 0.95,
    saturation: 0.9,
    glowColor: null,
    glowIntensity: 0,
    borderWidth: 1.5,
    borderColor: 'var(--border-subtle)',
  },
  sibling: {
    opacity: 0.45,
    brightness: 0.9,
    saturation: 0.7,
    glowColor: null,
    glowIntensity: 0,
    borderWidth: 1,
    borderColor: 'var(--border-subtle)',
  },
  dimmed: {
    opacity: 0.35,
    brightness: 0.85,
    saturation: 0.6,
    glowColor: null,
    glowIntensity: 0,
    borderWidth: 1,
    borderColor: 'var(--border-subtle)',
  },
}

const getLightingForState = (state: LightingState): NodeLighting => ({
  state,
  ...LIGHTING_CONFIG[state],
})

export const deriveAllNodeLighting = (
  visibleIds: Set<string>,
  selectedNodeId: string | null,
  nodes: Map<string, OrgNode>,
): Map<string, NodeLighting> => {
  const lightingMap = new Map<string, NodeLighting>()

  if (!selectedNodeId || !visibleIds.has(selectedNodeId)) {
    visibleIds.forEach((id) => lightingMap.set(id, getLightingForState('default')))
    return lightingMap
  }

  const selectedNode = nodes.get(selectedNodeId)
  if (!selectedNode) {
    visibleIds.forEach((id) => lightingMap.set(id, getLightingForState('default')))
    return lightingMap
  }

  const childIds = new Set(selectedNode.childrenIds)
  const grandchildIds = new Set<string>()
  selectedNode.childrenIds.forEach((childId) => {
    const child = nodes.get(childId)
    child?.childrenIds.forEach((grandId) => grandchildIds.add(grandId))
  })

  const parentId = selectedNode.parentId
  const ancestorIds = new Set<string>()
  let cursor = parentId ? nodes.get(parentId) : undefined
  while (cursor && cursor.parentId) {
    ancestorIds.add(cursor.parentId)
    cursor = cursor.parentId ? nodes.get(cursor.parentId) : undefined
  }

  const siblingIds = new Set<string>()
  if (parentId) {
    const parent = nodes.get(parentId)
    parent?.childrenIds.forEach((id) => {
      if (id !== selectedNodeId) siblingIds.add(id)
    })
  }

  visibleIds.forEach((id) => {
    let state: LightingState = 'dimmed'

    if (id === selectedNodeId) {
      state = 'selected'
    } else if (childIds.has(id)) {
      state = 'child'
    } else if (grandchildIds.has(id)) {
      state = 'grandchild'
    } else if (id === parentId) {
      state = 'parent'
    } else if (ancestorIds.has(id)) {
      state = 'ancestor'
    } else if (siblingIds.has(id)) {
      state = 'sibling'
    }

    lightingMap.set(id, getLightingForState(state))
  })

  return lightingMap
}
