import { useEffect, useMemo, useRef } from 'react'
import './RadialHud.css'
import { describeArc, midAngle, polarToCartesian } from './hudMath'
import type { OrgNode, Status } from '../../data/types'
import type { PressureMark } from '../../data/derivePressureMarks'
import type { DirectedDependencyEdge } from '../../data/deriveFunctionEdges'
import type { ZoomState } from '../../types/zoom'
import type { NodeLighting } from '../../types/lighting'
import { LineagePath } from './LineagePath'

export type HoverInfo = {
  nodeId: string
  x: number
  y: number
} | null

type RadialHudProps = {
  nodes: Map<string, OrgNode>
  visibleIds: Set<string>
  ringAssignments: Map<string, number>
  zoomState: ZoomState
  selectedNodeId: string | null
  lineagePath: string[]
  nodeLighting: Map<string, NodeLighting>
  pressureMarks: Map<string, PressureMark>
  dependencyEdges: DirectedDependencyEdge[]
  pressureMode: boolean
  showSecondaryPressure: boolean
  showCrossRingTicks: boolean
  onNodeSelect: (id: string) => void
  onNodeZoomIn: (id: string) => void
  onZoomOut: () => void
  onHover: (info: HoverInfo) => void
  onHoverOut: () => void
}

const statusClass = (status: Status) => `status-${status}`

const splitLabel = (label: string) => {
  const words = label.split(' ').filter(Boolean)
  if (words.length <= 2) return [label]
  const mid = Math.ceil(words.length / 2)
  return [words.slice(0, mid).join(' '), words.slice(mid).join(' ')]
}

export const RadialHud = ({
  nodes,
  visibleIds,
  ringAssignments,
  zoomState,
  selectedNodeId,
  lineagePath,
  nodeLighting,
  pressureMarks,
  dependencyEdges,
  pressureMode,
  showSecondaryPressure,
  showCrossRingTicks,
  onNodeSelect,
  onNodeZoomIn,
  onZoomOut,
  onHover,
  onHoverOut,
}: RadialHudProps) => {
  const size = 760
  const center = size / 2
  const padding = 40
  const maxRadius = center - padding
  const hudRef = useRef<HTMLDivElement | null>(null)

  const nodesByRing = useMemo(() => {
    const ringMap = new Map<number, OrgNode[]>()
    visibleIds.forEach((id) => {
      const node = nodes.get(id)
      if (!node) return
      const ring = ringAssignments.get(id) ?? 0
      if (!ringMap.has(ring)) ringMap.set(ring, [])
      ringMap.get(ring)?.push(node)
    })
    ringMap.forEach((ringNodes) => {
      ringNodes.sort((a, b) => {
        const aParent = a.parentId ?? ''
        const bParent = b.parentId ?? ''
        if (aParent !== bParent) return aParent.localeCompare(bParent)
        const aIndex = a.parentId ? nodes.get(a.parentId)?.childrenIds.indexOf(a.id) ?? 0 : 0
        const bIndex = b.parentId ? nodes.get(b.parentId)?.childrenIds.indexOf(b.id) ?? 0 : 0
        return aIndex - bIndex
      })
    })
    return ringMap
  }, [nodes, ringAssignments, visibleIds])

  const maxRing = useMemo(() => {
    const rings = Array.from(ringAssignments.values())
    return rings.length > 0 ? Math.max(...rings) : 0
  }, [ringAssignments])

  const ringCount = Math.max(1, maxRing)
  const ring0Outer = Math.max(60, maxRadius * 0.22)
  const remaining = Math.max(0, maxRadius - ring0Outer)
  const ringThickness = ringCount > 0 ? (remaining / ringCount) * 0.7 : 0
  const ringGap = ringCount > 0 ? (remaining / ringCount) * 0.3 : 0

  const getRingConfig = (ring: number) => {
    if (ring === 0) return { inner: 0, outer: ring0Outer }
    const inner = ring0Outer + ringGap + (ring - 1) * (ringThickness + ringGap)
    return { inner, outer: inner + ringThickness }
  }

  const wedgeMeta = useMemo(() => {
    const meta = new Map<string, { start: number; end: number; ring: number; inner: number; outer: number }>()
    nodesByRing.forEach((ringNodes, ring) => {
      if (ring === 0) return
      const { inner, outer } = getRingConfig(ring)
      const span = 360 / Math.max(1, ringNodes.length)
      ringNodes.forEach((node, index) => {
        const start = index * span
        meta.set(node.id, { start, end: start + span, ring, inner, outer })
      })
    })
    return meta
  }, [nodesByRing, ringCount, ring0Outer, ringGap, ringThickness])

  const getPressureStyles = (mark: PressureMark) => {
    const t = mark.intensity01
    const lerp = (a: number, b: number) => a + (b - a) * t
    return {
      strokeWidth: lerp(1, 3),
      bandSize: lerp(3, 14),
      opacity: lerp(0.22, 0.78),
      lift: lerp(2, 12),
      rimOpacity: lerp(0.25, 0.85),
      shadowOpacity: lerp(0.18, 0.55),
      shadowBlur: lerp(6, 18),
    }
  }

  const anchorNode = nodes.get(zoomState.anchorId)

  const arrowPaths = dependencyEdges
    .map((edge) => {
      const targetMeta = wedgeMeta.get(edge.toId)
      if (!targetMeta) return null
      const targetAngle = midAngle(targetMeta.start, targetMeta.end)
      const targetRadius = targetMeta.inner + (targetMeta.outer - targetMeta.inner) * 0.5
      const to = polarToCartesian(center, center, targetRadius, targetAngle)

      const fromMeta = wedgeMeta.get(edge.fromId)
      const fromAngle = fromMeta ? midAngle(fromMeta.start, fromMeta.end) : targetAngle
      const fromRadius = fromMeta ? fromMeta.inner + (fromMeta.outer - fromMeta.inner) * 0.5 : ring0Outer - 8
      const from = polarToCartesian(center, center, fromRadius, fromAngle)
      const mid = polarToCartesian(center, center, Math.min(fromRadius, targetRadius) - 24, midAngle(fromAngle, targetAngle))
      const dockOuter = polarToCartesian(center, center, targetRadius + 10, targetAngle)

      return {
        id: edge.id,
        weight: edge.weight,
        d: `M ${from.x} ${from.y} Q ${mid.x} ${mid.y} ${to.x} ${to.y}`,
        dock: { x1: to.x, y1: to.y, x2: dockOuter.x, y2: dockOuter.y },
      }
    })
    .filter(Boolean) as { id: string; weight: number; d: string; dock: { x1: number; y1: number; x2: number; y2: number } }[]

  const lineagePoints = useMemo(() => {
    if (!lineagePath.length) return []
    return lineagePath.flatMap((id) => {
      if (id === zoomState.anchorId) {
        return [{ id, x: center, y: center }]
      }
      const meta = wedgeMeta.get(id)
      if (!meta) return []
      const angle = midAngle(meta.start, meta.end)
      const radius = meta.inner + (meta.outer - meta.inner) * 0.55
      const point = polarToCartesian(center, center, radius, angle)
      return [{ id, x: point.x, y: point.y }]
    })
  }, [center, lineagePath, wedgeMeta, zoomState.anchorId])

  useEffect(() => {
    const handler = (event: WheelEvent) => {
      if (!hudRef.current?.contains(event.target as Node)) return
      event.preventDefault()
      if (event.deltaY < 0) {
        const zoomTarget = selectedNodeId ?? zoomState.anchorId
        if (zoomTarget && nodes.get(zoomTarget)?.childrenIds.length) {
          onNodeZoomIn(zoomTarget)
        }
      } else {
        onZoomOut()
      }
    }
    const current = hudRef.current
    current?.addEventListener('wheel', handler, { passive: false })
    return () => current?.removeEventListener('wheel', handler)
  }, [nodes, onNodeZoomIn, onZoomOut, selectedNodeId, zoomState.anchorId])

  return (
    <div className="radial-hud" aria-label="Org health radial" ref={hudRef}>
      <svg
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        onClick={(event) => {
          if (event.target === event.currentTarget) onZoomOut()
        }}
      >
        <defs>
          <filter id="hudGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <marker
            id="hudArrow"
            markerWidth="8"
            markerHeight="8"
            refX="6"
            refY="3"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path d="M 0 0 L 6 3 L 0 6 z" fill="rgba(191, 214, 255, 0.85)" />
          </marker>
        </defs>

        <circle className="hud-grid" cx={center} cy={center} r={ring0Outer + 6} />
        {Array.from({ length: maxRing }).map((_, index) => {
          const ring = index + 1
          const { outer } = getRingConfig(ring)
          return <circle key={`grid-${ring}`} className="hud-grid" cx={center} cy={center} r={outer + 6} />
        })}

        {selectedNodeId === zoomState.anchorId ? (
          <circle className="focusRing" cx={center} cy={center} r={ring0Outer - 6} />
        ) : null}

        {arrowPaths.length > 0 ? (
          <g className="hud-arrow-layer">
            {arrowPaths.map((path) => {
              const strokeWidth = Math.min(3.5, 0.8 + path.weight * 0.2)
              return (
                <g key={path.id}>
                  <path
                    d={path.d}
                    className="hud-arrow"
                    style={{ strokeWidth }}
                    markerEnd="url(#hudArrow)"
                  />
                  <line
                    className="hud-arrow-cap"
                    x1={path.dock.x1}
                    y1={path.dock.y1}
                    x2={path.dock.x2}
                    y2={path.dock.y2}
                    style={{ strokeWidth: Math.max(1, strokeWidth - 0.4) }}
                  />
                </g>
              )
            })}
          </g>
        ) : null}

        {Array.from(nodesByRing.entries())
          .filter(([ring]) => ring > 0)
          .map(([ring, ringNodes]) => {
            const { inner, outer } = getRingConfig(ring)
            const span = 360 / Math.max(1, ringNodes.length)
            return ringNodes.map((node, index) => {
              const startAngle = index * span
              const endAngle = startAngle + span
              const path = describeArc(center, center, outer, inner, startAngle, endAngle)
              const mark = pressureMarks.get(node.id)
              const showPressure = pressureMode && mark && (showSecondaryPressure || mark.tier === 'primary')
              const lighting = nodeLighting.get(node.id)
              const labelAngle = midAngle(startAngle, endAngle)
              const labelRadius = inner + (outer - inner) * 0.55
              const labelPoint = polarToCartesian(center, center, labelRadius, labelAngle)
              const labelLines = splitLabel(node.name)
              const pressureStyles = mark ? getPressureStyles(mark) : null
              const liftPx = pressureStyles?.lift ?? 0
              const liftX = Math.cos((labelAngle - 90) * (Math.PI / 180)) * liftPx
              const liftY = Math.sin((labelAngle - 90) * (Math.PI / 180)) * liftPx
              const bandOuter = outer + 6 + (mark?.intensity01 ?? 0) * 8
              const bandInner = outer + 2
              const strokeColor = lighting?.borderColor ?? 'rgba(255, 255, 255, 0.2)'
              const strokeWidth = lighting?.borderWidth ?? 1

              return (
                <g
                  key={`${ring}-${node.id}`}
                  className="hud-ring-group hud-node"
                  data-lighting={lighting?.state ?? 'default'}
                  style={{
                    transform: showPressure ? `translate(${liftX}px, ${liftY}px)` : undefined,
                    transition: 'transform 200ms ease-out',
                    ['--press-intensity' as string]: mark?.intensity01 ?? 0,
                  }}
                >
                  {showPressure && mark ? (
                    <>
                      <path
                        d={path}
                        className="pressureHalo"
                        style={{
                          filter: `drop-shadow(0 0 ${pressureStyles?.shadowBlur ?? 6}px rgba(0,0,0,0.45))`,
                        }}
                      />
                      <path d={path} className="pressureStroke" />
                      <path
                        d={describeArc(center, center, bandOuter, bandInner, startAngle, endAngle)}
                        className="pressureBand"
                      />
                      {showCrossRingTicks && mark.crossRing ? (
                        <line
                          className="pressureTick"
                          x1={polarToCartesian(center, center, outer + 10, labelAngle).x}
                          y1={polarToCartesian(center, center, outer + 10, labelAngle).y}
                          x2={polarToCartesian(center, center, outer + 20, labelAngle).x}
                          y2={polarToCartesian(center, center, outer + 20, labelAngle).y}
                        />
                      ) : null}
                    </>
                  ) : null}
                  <path
                    d={path}
                    className={`hud-wedge ${ring > 1 ? 'hud-wedge--inner' : ''} ${statusClass(node.status)}`}
                    style={{
                      opacity: lighting?.opacity ?? 0.7,
                      filter: `brightness(${lighting?.brightness ?? 1}) saturate(${lighting?.saturation ?? 0.9})${
                        lighting?.glowColor
                          ? ` drop-shadow(0 0 ${lighting.glowIntensity}px ${lighting.glowColor})`
                          : ''
                      }`,
                      stroke: strokeColor,
                      strokeWidth,
                    }}
                    onMouseEnter={(event) => onHover({ nodeId: node.id, x: event.clientX, y: event.clientY })}
                    onMouseMove={(event) => onHover({ nodeId: node.id, x: event.clientX, y: event.clientY })}
                    onMouseLeave={onHoverOut}
                    onClick={() => onNodeSelect(node.id)}
                    onDoubleClick={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      if (node.childrenIds.length > 0) onNodeZoomIn(node.id)
                    }}
                  />
                  {ring === 1 ? (
                    <text
                      x={labelPoint.x}
                      y={labelPoint.y}
                      className="hud-branch-label"
                      textAnchor="middle"
                      dominantBaseline="middle"
                    >
                      <title>{node.name}</title>
                      {labelLines.map((line, idx) => (
                        <tspan key={`${node.id}-line-${idx}`} x={labelPoint.x} dy={idx === 0 ? '-0.35em' : '1.1em'}>
                          {line}
                        </tspan>
                      ))}
                    </text>
                  ) : null}
                </g>
              )
            })
          })}

        {lineagePoints.length > 1 ? <LineagePath points={lineagePoints} /> : null}

        {anchorNode ? (
          <circle className="hud-core" cx={center} cy={center} r={ring0Outer - 8} />
        ) : null}
      </svg>
    </div>
  )
}
