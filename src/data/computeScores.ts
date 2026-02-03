import type { OrgNode, Status } from './types'

const statusFromScore = (score: number): Status => {
  if (score >= 80) return 'green'
  if (score >= 60) return 'yellow'
  return 'red'
}

const computeSelfScore = (node: OrgNode) => {
  if (node.kpis.length === 0) return 0
  const totalWeight = node.kpis.reduce((sum, kpi) => sum + kpi.weight, 0)
  if (totalWeight === 0) return 0
  return Math.round(
    node.kpis.reduce(
      (sum, kpi) => sum + kpi.value0to100 * (kpi.weight / totalWeight),
      0,
    ),
  )
}

const computeDependencyPenalty = (node: OrgNode, nodes: Record<string, OrgNode>) => {
  let penalty = 0
  node.dependsOn.forEach((depId) => {
    const dep = nodes[depId]
    if (!dep) return
    if (dep.status === 'red') penalty += 12
    if (dep.status === 'yellow') penalty += 6
  })
  return Math.min(40, penalty)
}

const computeScoresForLevel = (level: string, nodes: Record<string, OrgNode>) => {
  Object.values(nodes)
    .filter((node) => node.level === level)
    .forEach((node) => {
      node.selfScore = computeSelfScore(node)
      if (node.childrenIds.length === 0) {
        node.childScore = node.selfScore
      } else {
        const childScores = node.childrenIds.map((id) => nodes[id]?.score ?? node.selfScore)
        node.childScore = Math.round(
          childScores.reduce((sum, score) => sum + score, 0) / childScores.length,
        )
      }
      node.dependencyPenalty = computeDependencyPenalty(node, nodes)
      node.score = Math.round(
        0.55 * node.selfScore +
          0.35 * node.childScore +
          0.1 * (100 - node.dependencyPenalty),
      )
      if (node.childrenIds.length === 0) {
        node.status = statusFromScore(node.score)
      } else {
        const childStatuses = node.childrenIds
          .map((id) => nodes[id]?.status)
          .filter(Boolean) as Status[]
        if (childStatuses.includes('red')) node.status = 'red'
        else if (childStatuses.includes('yellow')) node.status = 'yellow'
        else node.status = 'green'
      }
    })
}

const summarizeExplanation = (node: OrgNode, nodes: Record<string, OrgNode>) => {
  const kpiDrivers = [...node.kpis]
    .sort((a, b) => a.value0to100 - b.value0to100)
    .slice(0, 3)
    .map((kpi) => `${kpi.label} ${kpi.value0to100}`)

  const childDrivers = node.childrenIds
    .map((id) => nodes[id])
    .filter(Boolean)
    .sort((a, b) => a.score - b.score)
    .slice(0, 3)
    .map((child) => `${child.name} ${child.score}`)

  const dependencyDrivers = node.dependsOn
    .map((id) => nodes[id])
    .filter(Boolean)
    .sort((a, b) => {
      const aPenalty = a.status === 'red' ? 12 : a.status === 'yellow' ? 6 : 0
      const bPenalty = b.status === 'red' ? 12 : b.status === 'yellow' ? 6 : 0
      return bPenalty - aPenalty
    })
    .slice(0, 3)
    .map((dep) => `${dep.name} ${dep.status}`)

  const parts: string[] = []
  if (kpiDrivers.length > 0) parts.push('KPI drag')
  if (childDrivers.length > 0) parts.push('weak child units')
  if (dependencyDrivers.length > 0) parts.push('dependency hits')

  const why =
    parts.length > 0
      ? `Performance is under pressure due to ${parts.join(', ')}.`
      : 'Performance is stable.'

  node.explanation = {
    oneLineWhy: why,
    topKpiDrivers: kpiDrivers,
    topChildDrivers: childDrivers,
    topDependencyDrivers: dependencyDrivers,
  }
}

export const computeScores = (nodes: Record<string, OrgNode>, levelOrder: string[]) => {
  const levels = [...levelOrder].reverse()
  Object.values(nodes).forEach((node) => {
    node.selfScore = computeSelfScore(node)
    node.childScore = node.childrenIds.length ? node.selfScore : node.selfScore
    node.dependencyPenalty = 0
    node.score = Math.round(0.55 * node.selfScore + 0.35 * node.childScore + 0.1 * 100)
    node.status = statusFromScore(node.score)
  })

  for (let pass = 0; pass < 3; pass += 1) {
    levels.forEach((level) => computeScoresForLevel(level, nodes))
  }

  Object.values(nodes).forEach((node) => summarizeExplanation(node, nodes))
}
