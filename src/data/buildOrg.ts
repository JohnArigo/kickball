import { generateOrg, levelOrder } from './generateOrg'
import { computeScores } from './computeScores'
import type { OrgData, OrgProfile } from './types'

export const buildOrg = (seed: number, profile: OrgProfile = 'balanced'): OrgData => {
  const org = generateOrg(seed, profile)
  computeScores(org.nodesById, levelOrder)
  return org
}
