import { createSeededRng } from './seededRng'
import type { Kpi, Level, OrgData, OrgNode, OrgProfile } from './types'

const BRANCHES = [
  'Product & Engineering',
  'Sales & Revenue',
  'Customer Success & Support',
  'Marketing & Brand',
  'Operations & Supply Chain',
  'Finance & Legal',
  'People & Culture',
]

const KPI_LIBRARY = [
  'Delivery Reliability',
  'Quality Index',
  'Cycle Time',
  'Pipeline Health',
  'Renewal Rate',
  'Escalation Load',
  'Brand Sentiment',
  'Demand Gen',
  'Fulfillment Speed',
  'Cost Control',
  'Compliance Risk',
  'Talent Retention',
]

const levelOrder: Level[] = [
  'company',
  'branch',
  'division',
  'department',
  'team',
]

const buildKpis = (
  rng: ReturnType<typeof createSeededRng>,
  skew: number,
): Kpi[] => {
  const weights: number[] = []
  for (let i = 0; i < 4; i += 1) {
    weights.push(rng.int(15, 35))
  }
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0)
  return weights.map((weight, index) => {
    const base = rng.int(50 + skew, 96 + skew)
    return {
      key: `kpi-${rng.int(1, 9999)}`,
      label: KPI_LIBRARY[(index + rng.int(0, KPI_LIBRARY.length - 1)) % KPI_LIBRARY.length],
      value0to100: Math.max(20, Math.min(98, base)),
      weight: weight / totalWeight,
      trend7d: rng.pick([-1, 0, 1]),
    }
  })
}

const emptyNode = (
  id: string,
  name: string,
  level: Level,
  parentId?: string,
): OrgNode => ({
  id,
  name,
  level,
  parentId,
  childrenIds: [],
  dependsOn: [],
  dependedOnBy: [],
  kpis: [],
  selfScore: 0,
  childScore: 0,
  dependencyPenalty: 0,
  score: 0,
  status: 'green',
  explanation: {
    oneLineWhy: 'Performance is stable.',
    topKpiDrivers: [],
    topChildDrivers: [],
    topDependencyDrivers: [],
  },
})

const countForLevel = (level: Level, profile: OrgProfile, rng: ReturnType<typeof createSeededRng>) => {
  const ranges = {
    branch: { min: 2, max: 6, target: 3 },
    division: { min: 2, max: 12, target: 4 },
    department: { min: 2, max: 12, target: 5 },
  }
  const range = ranges[level === 'branch' ? 'branch' : level === 'division' ? 'division' : 'department']
  if (profile === 'small') {
    return rng.int(range.min, Math.min(range.target, range.min + 2))
  }
  if (profile === 'large') {
    return rng.int(Math.max(range.target, range.max - 2), range.max)
  }
  const low = Math.max(range.min, range.target - 1)
  const high = Math.min(range.max, range.target + 1)
  return rng.int(low, high)
}

export const generateOrg = (seed: number, profile: OrgProfile = 'balanced'): OrgData => {
  const rng = createSeededRng(seed)
  const nodesById: Record<string, OrgNode> = {}
  const orderedIds: string[] = []
  const branchIds: string[] = []

  const rootId = 'company'
  nodesById[rootId] = emptyNode(rootId, 'Global Holdings', 'company')
  orderedIds.push(rootId)

  const divisionIds: string[] = []
  const departmentIds: string[] = []
  const teamIds: string[] = []

  BRANCHES.forEach((branchName, branchIndex) => {
    const branchId = `branch-${branchIndex + 1}`
    branchIds.push(branchId)
    nodesById[branchId] = emptyNode(branchId, branchName, 'branch', rootId)
    nodesById[rootId].childrenIds.push(branchId)
    orderedIds.push(branchId)

    const divisionsCount = countForLevel('branch', profile, rng)
    for (let d = 0; d < divisionsCount; d += 1) {
      const divisionId = `division-${branchIndex + 1}-${d + 1}`
      divisionIds.push(divisionId)
      nodesById[divisionId] = emptyNode(
        divisionId,
        `${branchName.split(' & ')[0]} Division ${d + 1}`,
        'division',
        branchId,
      )
      nodesById[branchId].childrenIds.push(divisionId)
      orderedIds.push(divisionId)

      const departmentsCount =
        branchName === 'Product & Engineering' ? 10 : countForLevel('division', profile, rng)
      for (let p = 0; p < departmentsCount; p += 1) {
        const deptId = `department-${branchIndex + 1}-${d + 1}-${p + 1}`
        departmentIds.push(deptId)
        nodesById[deptId] = emptyNode(
          deptId,
          `Dept ${d + 1}.${p + 1}`,
          'department',
          divisionId,
        )
        nodesById[divisionId].childrenIds.push(deptId)
        orderedIds.push(deptId)

        const teamsCount = countForLevel('department', profile, rng)
        for (let t = 0; t < teamsCount; t += 1) {
          const teamId = `team-${branchIndex + 1}-${d + 1}-${p + 1}-${t + 1}`
          teamIds.push(teamId)
          nodesById[teamId] = emptyNode(
            teamId,
            `Team ${d + 1}.${p + 1}.${t + 1}`,
            'team',
            deptId,
          )
          nodesById[deptId].childrenIds.push(teamId)
          orderedIds.push(teamId)
        }
      }
    }
  })

  const shuffledBranches = rng.shuffle(branchIds)
  const redBranches = new Set(shuffledBranches.slice(0, 1))
  const yellowBranches = new Set(shuffledBranches.slice(1, 3))
  const greenBranches = new Set(shuffledBranches.slice(3, 7))

  const branchForNodeId = (nodeId: string) => {
    const parts = nodeId.split('-')
    if (parts[0] === 'branch') return nodeId
    if (parts[0] === 'company') return 'company'
    return `branch-${parts[1]}`
  }

  const departmentsForBranch = (branchId: string) =>
    departmentIds.filter((id) => id.split('-')[1] === branchId.split('-')[1])
  const teamsForDepartment = (departmentId: string) =>
    teamIds.filter((id) => id.startsWith(`team-${departmentId.split('-').slice(1, 4).join('-')}-`))

  const redBranchId = [...redBranches][0]
  const redDepartmentId = redBranchId ? rng.pick(departmentsForBranch(redBranchId)) : ''
  const redTeamIds = redDepartmentId ? teamsForDepartment(redDepartmentId) : []

  const yellowTeamIds = new Set(
    rng.shuffle(teamIds)
      .filter((id) => yellowBranches.has(branchForNodeId(id)))
      .slice(0, 12),
  )

  const applyKpis = (nodeId: string) => {
    const node = nodesById[nodeId]
    let skew = 0
    const nodeBranchId = branchForNodeId(nodeId)
    if (greenBranches.has(nodeBranchId)) skew += 24
    if (yellowBranches.has(nodeBranchId)) skew += 4
    if (redBranches.has(nodeBranchId)) skew -= 6
    if (yellowTeamIds.has(nodeId)) skew -= 10
    if (redTeamIds.includes(nodeId)) skew -= 38
    if (node.level === 'team' && rng.next() < 0.06 && redBranches.has(nodeBranchId)) skew -= 8
    if (node.level === 'team' && rng.next() < 0.04 && yellowBranches.has(nodeBranchId)) skew -= 4
    node.kpis = buildKpis(rng, skew)
  }

  orderedIds.forEach((nodeId) => applyKpis(nodeId))

  const addDependency = (fromId: string, toId: string) => {
    if (fromId === toId) return
    const from = nodesById[fromId]
    const to = nodesById[toId]
    if (!from || !to) return
    if (from.dependsOn.includes(toId)) return
    from.dependsOn.push(toId)
    to.dependedOnBy.push(fromId)
  }

  const addDependenciesForLevel = (ids: string[], pool: string[]) => {
    ids.forEach((id) => {
      const count = rng.int(1, 3)
      for (let i = 0; i < count; i += 1) {
        addDependency(id, rng.pick(pool))
      }
    })
  }

  addDependenciesForLevel(divisionIds, divisionIds)
  addDependenciesForLevel(departmentIds, departmentIds)
  addDependenciesForLevel(teamIds, teamIds)

  const crossBranchTeams = teamIds.filter(() => rng.next() < 0.22)
  crossBranchTeams.forEach((id) => {
    const branchIndex = parseInt(id.split('-')[1], 10)
    const otherBranchTeams = teamIds.filter(
      (teamId) => parseInt(teamId.split('-')[1], 10) !== branchIndex,
    )
    if (otherBranchTeams.length > 0) {
      addDependency(id, rng.pick(otherBranchTeams))
    }
  })

  const crossBranchDepartments = departmentIds.filter(() => rng.next() < 0.18)
  crossBranchDepartments.forEach((id) => {
    const branchIndex = parseInt(id.split('-')[1], 10)
    const otherBranchDepartments = departmentIds.filter(
      (deptId) => parseInt(deptId.split('-')[1], 10) !== branchIndex,
    )
    if (otherBranchDepartments.length > 0) {
      addDependency(id, rng.pick(otherBranchDepartments))
    }
  })

  return { rootId, orderedIds, branchIds, nodesById }
}

export { BRANCHES, levelOrder }
