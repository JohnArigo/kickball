export interface ZoomState {
  anchorId: string
  zoomLevel: number
  visibleDepth: number
  zoomPath: string[]
}

export type ZoomAction =
  | { type: 'ZOOM_IN'; targetId: string }
  | { type: 'ZOOM_OUT' }
  | { type: 'ZOOM_TO'; targetId: string; path: string[] }
  | { type: 'RESET' }

export const DEFAULT_VISIBLE_DEPTH = 3
