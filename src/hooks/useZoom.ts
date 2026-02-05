import { useCallback, useReducer } from 'react'
import { DEFAULT_VISIBLE_DEPTH, type ZoomAction, type ZoomState } from '../types/zoom'

const zoomReducer = (state: ZoomState, action: ZoomAction): ZoomState => {
  switch (action.type) {
    case 'ZOOM_IN': {
      if (!action.targetId) return state
      return {
        ...state,
        anchorId: action.targetId,
        zoomLevel: state.zoomLevel + 1,
        zoomPath: [...state.zoomPath, action.targetId],
      }
    }
    case 'ZOOM_OUT': {
      if (state.zoomPath.length <= 1) return state
      const nextPath = state.zoomPath.slice(0, -1)
      return {
        ...state,
        anchorId: nextPath[nextPath.length - 1],
        zoomLevel: Math.max(0, state.zoomLevel - 1),
        zoomPath: nextPath,
      }
    }
    case 'ZOOM_TO': {
      return {
        ...state,
        anchorId: action.targetId,
        zoomLevel: Math.max(0, action.path.length - 1),
        zoomPath: action.path,
      }
    }
    case 'RESET': {
      const rootId = state.zoomPath[0]
      return {
        anchorId: rootId,
        zoomLevel: 0,
        visibleDepth: DEFAULT_VISIBLE_DEPTH,
        zoomPath: [rootId],
      }
    }
    default:
      return state
  }
}

export const useZoom = (rootId: string) => {
  const initialState: ZoomState = {
    anchorId: rootId,
    zoomLevel: 0,
    visibleDepth: DEFAULT_VISIBLE_DEPTH,
    zoomPath: [rootId],
  }

  const [zoomState, dispatch] = useReducer(zoomReducer, initialState)

  const zoomIn = useCallback((targetId: string) => {
    dispatch({ type: 'ZOOM_IN', targetId })
  }, [])

  const zoomOut = useCallback(() => {
    dispatch({ type: 'ZOOM_OUT' })
  }, [])

  const zoomTo = useCallback((targetId: string, path: string[]) => {
    dispatch({ type: 'ZOOM_TO', targetId, path })
  }, [])

  const resetZoom = useCallback(() => {
    dispatch({ type: 'RESET' })
  }, [])

  return {
    zoomState,
    zoomIn,
    zoomOut,
    zoomTo,
    resetZoom,
  }
}
