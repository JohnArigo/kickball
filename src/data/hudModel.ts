export type NodeId = string

export type OrgNode = {
  id: NodeId
  label: string
  parentId?: NodeId
  level: 'company' | 'branch' | 'division' | 'department' | 'team'
  majorOrgId: NodeId
  childrenIds: NodeId[]
  sortIndex: number
  status: 'green' | 'yellow' | 'red'
  score?: number
}

export type DepEdge = {
  id: string
  fromId: NodeId
  toId: NodeId
  weight: number
  toPath?: NodeId[]
}
