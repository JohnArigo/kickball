export type NodeId = string
export type RingId = number

export type HudNode = {
  id: NodeId
  label: string
  ring: RingId
  parentId?: NodeId
  status: 'green' | 'yellow' | 'red'
  score?: number
}

export type DepEdge = {
  id: string
  fromId: NodeId
  toId: NodeId
  weight: number
  kind?: 'dependency' | 'blocker' | 'enabler'
}

export type PressureMark = {
  targetNodeId: NodeId
  ring: RingId
  weight: number
  intensity01: number
  tier: 'primary' | 'secondary'
  crossRing: boolean
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

const easeOut = (t: number) => Math.pow(t, 0.7)

export const derivePressureMarks = (
  focusNodeId: NodeId | null,
  nodes: HudNode[],
  edges: DepEdge[],
): PressureMark[] => {
  if (!focusNodeId) return []
  const nodeById = nodes.reduce<Record<string, HudNode>>((acc, node) => {
    acc[node.id] = node
    return acc
  }, {})

  const focusNode = nodeById[focusNodeId]
  if (!focusNode) return []

  const focusEdges = edges.filter((edge) => edge.fromId === focusNodeId && edge.weight >= 1 && edge.weight <= 10)
  if (focusEdges.length === 0) return []

  const edgesByRing = focusEdges.reduce<Record<number, DepEdge[]>>((acc, edge) => {
    const targetRing = nodeById[edge.toId]?.ring ?? focusNode.ring
    if (!acc[targetRing]) acc[targetRing] = []
    acc[targetRing].push(edge)
    return acc
  }, {})

  return Object.entries(edgesByRing).flatMap(([ringKey, ringEdges]) => {
    const ring = Number(ringKey)
    const maxWeight = Math.max(...ringEdges.map((edge) => edge.weight))
    const sorted = [...ringEdges].sort((a, b) => b.weight - a.weight)
    return sorted.map((edge, index) => {
      const t = maxWeight > 0 ? edge.weight / maxWeight : 0
      const intensity01 = clamp01(easeOut(t))
      return {
        targetNodeId: edge.toId,
        ring,
        weight: edge.weight,
        intensity01,
        tier: index < 4 ? 'primary' : 'secondary',
        crossRing: ring !== focusNode.ring,
      }
    })
  })
}
