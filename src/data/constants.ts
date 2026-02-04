import type { OrgNode } from './hudModel'

export const LEVEL = {
  COMPANY: 0,
  MAJOR_ORG: 1,
  DIVISION: 2,
  TEAM: 3,
  OFFICE: 4,
} as const

export const CEL = LEVEL.DIVISION
export const RCL = CEL
export const FDD = 1
export const MAX_REVEALS = 5

export type LevelType = typeof LEVEL[keyof typeof LEVEL]

export const levelIndex = (level: OrgNode['level']): LevelType => {
  switch (level) {
    case 'company':
      return LEVEL.COMPANY
    case 'branch':
      return LEVEL.MAJOR_ORG
    case 'division':
      return LEVEL.DIVISION
    case 'department':
      return LEVEL.TEAM
    case 'team':
      return LEVEL.OFFICE
    default:
      return LEVEL.COMPANY
  }
}
