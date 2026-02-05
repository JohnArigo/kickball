export type LightingState =
  | 'default'
  | 'selected'
  | 'child'
  | 'grandchild'
  | 'parent'
  | 'ancestor'
  | 'sibling'
  | 'dimmed'

export type NodeLighting = {
  state: LightingState
  opacity: number
  brightness: number
  saturation: number
  glowColor: string | null
  glowIntensity: number
  borderWidth: number
  borderColor: string
}
