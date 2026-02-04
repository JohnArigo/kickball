import type { DepEdge, OrgNode } from './hudModel'

const hashString = (value: string) => {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

const buildAncestorPath = (nodeId: string, nodeById: Record<string, OrgNode>) => {
  const path: string[] = []
  let current = nodeById[nodeId]
  while (current) {
    path.push(current.id)
    if (!current.parentId) break
    current = nodeById[current.parentId]
  }
  return path.reverse()
}

export const buildMockCrossLevelDeps = (nodes: OrgNode[]): DepEdge[] => {
  const nodeById = nodes.reduce<Record<string, OrgNode>>((acc, node) => {
    acc[node.id] = node
    return acc
  }, {})

  const divisions = nodes.filter((node) => node.level === 'division')
  const departments = nodes.filter((node) => node.level === 'department')
  const teams = nodes.filter((node) => node.level === 'team')

  const edges: DepEdge[] = []

  const pickTarget = (pool: OrgNode[], seed: number) => pool[seed % pool.length]

  divisions.forEach((division) => {
    const seed = hashString(division.id)
    if (seed % 3 !== 0) return
    const pool = departments.filter((node) => node.majorOrgId !== division.majorOrgId)
    if (pool.length === 0) return
    const target = pickTarget(pool, seed)
    const weight = 4 + (seed % 7)
    edges.push({
      id: `${division.id}__${target.id}`,
      fromId: division.id,
      toId: target.id,
      weight,
      toPath: buildAncestorPath(target.id, nodeById),
    })
  })

  departments.forEach((department) => {
    const seed = hashString(department.id)
    if (seed % 4 !== 0) return
    const pool = teams.filter((node) => node.majorOrgId !== department.majorOrgId)
    if (pool.length === 0) return
    const target = pickTarget(pool, seed)
    const weight = 3 + (seed % 8)
    edges.push({
      id: `${department.id}__${target.id}`,
      fromId: department.id,
      toId: target.id,
      weight,
      toPath: buildAncestorPath(target.id, nodeById),
    })
  })

  teams.forEach((team) => {
    const seed = hashString(team.id)
    if (seed % 5 !== 0) return
    const pool = divisions.filter((node) => node.majorOrgId !== team.majorOrgId)
    if (pool.length === 0) return
    const target = pickTarget(pool, seed)
    const weight = 2 + (seed % 9)
    edges.push({
      id: `${team.id}__${target.id}`,
      fromId: team.id,
      toId: target.id,
      weight,
      toPath: buildAncestorPath(target.id, nodeById),
    })
  })

  return edges
}
