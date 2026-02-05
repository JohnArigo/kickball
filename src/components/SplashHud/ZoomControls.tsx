import './ZoomControls.css'
import type { ZoomState } from '../../types/zoom'

type ZoomControlsProps = {
  zoomState: ZoomState
  canZoomIn: boolean
  canZoomOut: boolean
  onZoomIn: () => void
  onZoomOut: () => void
  onReset: () => void
}

export const ZoomControls = ({
  zoomState,
  canZoomIn,
  canZoomOut,
  onZoomIn,
  onZoomOut,
  onReset,
}: ZoomControlsProps) => (
  <div className="zoom-controls">
    <button
      className="zoom-btn zoom-out"
      onClick={onZoomOut}
      disabled={!canZoomOut}
      title="Zoom out (scroll down or ESC)"
      aria-label="Zoom out"
    >
      -
    </button>
    <span className="zoom-level" title="Current zoom level">
      L{zoomState.zoomLevel}
    </span>
    <button
      className="zoom-btn zoom-in"
      onClick={onZoomIn}
      disabled={!canZoomIn}
      title="Zoom in (double-click or scroll up)"
      aria-label="Zoom in"
    >
      +
    </button>
    {zoomState.zoomLevel > 0 ? (
      <button
        className="zoom-btn zoom-reset"
        onClick={onReset}
        title="Reset to top level"
        aria-label="Reset zoom"
      >
        R
      </button>
    ) : null}
  </div>
)
