export type Level = 'company' | 'branch' | 'division' | 'department' | 'team'
export type Status = 'green' | 'yellow' | 'red'

export type Kpi = {
  key: string
  label: string
  value0to100: number
  weight: number
  trend7d: -1 | 0 | 1
}

export type Explanation = {
  oneLineWhy: string
  topKpiDrivers: string[]
  topChildDrivers: string[]
  topDependencyDrivers: string[]
}

export type OrgNode = {
  id: string
  name: string
  level: Level
  parentId?: string
  childrenIds: string[]
  dependsOn: string[]
  dependedOnBy: string[]
  kpis: Kpi[]
  selfScore: number
  childScore: number
  dependencyPenalty: number
  score: number
  status: Status
  explanation: Explanation
}

export type OrgData = {
  rootId: string
  orderedIds: string[]
  branchIds: string[]
  nodesById: Record<string, OrgNode>
}

export type OrgProfile = 'balanced' | 'small' | 'large'
