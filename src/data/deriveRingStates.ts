export type RingState = 'active' | 'context' | 'suppressed'

export const deriveRingStates = (
  selectedNodeId: string | null,
  ringAssignments: Map<string, number>,
): Map<number, RingState> => {
  const ringStates = new Map<number, RingState>()
  const rings = new Set(ringAssignments.values())

  const selectedRing = selectedNodeId ? ringAssignments.get(selectedNodeId) ?? null : null

  rings.forEach((ring) => {
    if (selectedRing === null) {
      ringStates.set(ring, ring === 0 ? 'active' : 'context')
      return
    }

    if (ring === selectedRing) {
      ringStates.set(ring, 'active')
    } else if (ring === selectedRing + 1) {
      ringStates.set(ring, 'context')
    } else {
      ringStates.set(ring, 'suppressed')
    }
  })

  return ringStates
}
