import { useEffect, useMemo, useRef } from 'react'
import './RadialHud.css'
import { describeArc, midAngle, polarToCartesian, describeArcStroke } from './hudMath'
import type { OrgNode, Status } from '../../data/types'
import type { PressureMark } from '../../data/derivePressureMarks'
import type { DirectedDependencyEdge } from '../../data/deriveFunctionEdges'
import type { ZoomState } from '../../types/zoom'
import { LineagePath } from './LineagePath'
import type { WedgeState } from '../../data/deriveWedgeStates'
import type { RingState } from '../../data/deriveRingStates'

export type HoverInfo = {
  nodeId: string
  x: number
  y: number
} | null

type ArrowPath = {
  id: string
  weight: number
  weightRatio: number
  isPrimary: boolean
  strokeWidth: number
  opacity: number
  from: { x: number; y: number }
  to: { x: number; y: number }
  d: string
  dock: { x1: number; y1: number; x2: number; y2: number }
  gradientId: string
}

type RadialHudProps = {
  nodes: Map<string, OrgNode>
  visibleIds: Set<string>
  ringAssignments: Map<string, number>
  zoomState: ZoomState
  selectedNodeId: string | null
  lineagePath: string[]
  wedgeStates: Map<string, WedgeState>
  ringStates: Map<number, RingState>
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

const splitLabel = (label: string) => {
  const words = label.split(' ').filter(Boolean)
  if (words.length <= 2) return [label]
  const mid = Math.ceil(words.length / 2)
  return [words.slice(0, mid).join(' '), words.slice(mid).join(' ')]
}

const toSignalKey = (status: Status) => (status === 'yellow' ? 'amber' : status)

export const RadialHud = ({
  nodes,
  visibleIds,
  ringAssignments,
  zoomState,
  selectedNodeId,
  lineagePath,
  wedgeStates,
  ringStates,
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

  const getFillColor = (state: WedgeState) => {
    if (state === 'alarm') return 'var(--wedge-fill-base-strong)'
    if (state === 'child') return 'var(--wedge-fill-base-strong)'
    if (state === 'wake') return 'var(--wedge-fill-base-hover)'
    return 'var(--wedge-fill-base)'
  }

  const getFillOpacity = (state: WedgeState) => {
    if (state === 'child') return 'var(--wedge-fill-opacity-selected)'
    if (state === 'alarm') return 'var(--wedge-fill-opacity-hover)'
    if (state === 'wake') return 'var(--wedge-fill-opacity-hover)'
    if (state === 'suppressed') return 'var(--wedge-fill-opacity-suppressed)'
    return 'var(--wedge-fill-opacity-base)'
  }

  const getTintOpacity = (state: WedgeState) => {
    if (state === 'suppressed') return 'var(--status-tint-suppressed)'
    return 'var(--status-tint-base)'
  }

  const getSignalStroke = (state: WedgeState, signalKey: string) => {
    if (state === 'alarm') return `var(--signal-${signalKey})`
    return `var(--signal-${signalKey}-muted)`
  }

  const getSignalWidth = () => {
    return 'var(--edge-sleep)'
  }

  const getLabelColor = (state: WedgeState) => {
    if (state === 'suppressed') return 'var(--wedge-label-color-muted)'
    return 'var(--wedge-label-color)'
  }

  const anchorNode = nodes.get(zoomState.anchorId)

  const maxDependencyWeight = useMemo(() => {
    return dependencyEdges.reduce((max, edge) => Math.max(max, edge.weight), 0)
  }, [dependencyEdges])

  const dependencyTargetWeights = useMemo(() => {
    const weights = new Map<string, number>()
    dependencyEdges.forEach((edge) => {
      const current = weights.get(edge.toId) ?? 0
      if (edge.weight > current) weights.set(edge.toId, edge.weight)
    })
    return weights
  }, [dependencyEdges])

  const dependencySourceIds = useMemo(() => {
    return new Set(dependencyEdges.map((edge) => edge.fromId))
  }, [dependencyEdges])

  const arrowPaths = useMemo<ArrowPath[]>(() => {
    if (!dependencyEdges.length) return []
    const safeMax = maxDependencyWeight || 1
    return dependencyEdges
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
        const mid = polarToCartesian(
          center,
          center,
          Math.min(fromRadius, targetRadius) - 24,
          midAngle(fromAngle, targetAngle),
        )
        const dockOuter = polarToCartesian(center, center, targetRadius + 10, targetAngle)

        const weightRatio = edge.weight / safeMax
        const isPrimary = edge.weight === maxDependencyWeight
        const strokeWidth = Math.min(2.5, 1.8 + weightRatio * 0.7 + (isPrimary ? 0.2 : 0))
        const opacity = Math.min(0.9, 0.4 + weightRatio * 0.4 + (isPrimary ? 0.08 : 0))

        return {
          id: edge.id,
          weight: edge.weight,
          weightRatio,
          isPrimary,
          strokeWidth,
          opacity,
          from,
          to,
          d: `M ${from.x} ${from.y} Q ${mid.x} ${mid.y} ${to.x} ${to.y}`,
          dock: { x1: to.x, y1: to.y, x2: dockOuter.x, y2: dockOuter.y },
          gradientId: `dep-${edge.id}`,
        }
      })
      .filter((value): value is ArrowPath => Boolean(value))
  }, [center, dependencyEdges, maxDependencyWeight, ring0Outer, wedgeMeta])

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
            <path d="M 0 0 L 6 3 L 0 6 z" fill="var(--interaction-stroke)" />
          </marker>
          {arrowPaths.map((path) => (
            <linearGradient
              key={path.id}
              id={path.gradientId}
              gradientUnits="userSpaceOnUse"
              x1={path.from.x}
              y1={path.from.y}
              x2={path.to.x}
              y2={path.to.y}
            >
              <stop offset="0%" stopColor="var(--interaction-stroke-soft)" stopOpacity="0.35" />
              <stop offset="100%" stopColor="var(--interaction-stroke)" stopOpacity={path.opacity} />
            </linearGradient>
          ))}
        </defs>

        <circle className="hud-grid" cx={center} cy={center} r={ring0Outer + 6} />
        {Array.from({ length: maxRing }).map((_, index) => {
          const ring = index + 1
          const { outer } = getRingConfig(ring)
          return <circle key={`grid-${ring}`} className="hud-grid" cx={center} cy={center} r={outer + 6} />
        })}

        {selectedNodeId === zoomState.anchorId && anchorNode ? (
          <circle className="focusRing" cx={center} cy={center} r={ring0Outer - 6} />
        ) : null}

        {lineagePoints.length > 1 ? <LineagePath points={lineagePoints} /> : null}

        {Array.from(nodesByRing.entries())
          .filter(([ring]) => ring > 0)
          .map(([ring, ringNodes]) => {
            const { inner, outer } = getRingConfig(ring)
            const span = 360 / Math.max(1, ringNodes.length)
            const ringState = ringStates.get(ring) ?? 'context'
            return (
              <g key={`ring-${ring}`} className="hud-ring-layer" data-state={ringState}>
                {ringNodes.map((node, index) => {
                  const startAngle = index * span
                  const endAngle = startAngle + span
                  const path = describeArc(center, center, outer, inner, startAngle, endAngle)
                  const mark = pressureMarks.get(node.id)
                  const showPressure = pressureMode && mark && (showSecondaryPressure || mark.tier === 'primary')
                  const state = wedgeStates.get(node.id) ?? 'sleep'
                  const signalKey = toSignalKey(node.status)
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
                  const fill = getFillColor(state)
                  const fillOpacity = getFillOpacity(state)
                  const tintOpacity = getTintOpacity(state)
                  const signalStroke = getSignalStroke(state, signalKey)
                  const signalWidth = getSignalWidth()
                  const labelColor = getLabelColor(state)
                  const showLabel = ring === 1
                  const signalPath = describeArcStroke(center, center, outer, startAngle, endAngle)
                  const structurePath = describeArcStroke(center, center, inner, startAngle, endAngle)
                  const impactPath = describeArcStroke(center, center, inner + 2, startAngle, endAngle)
                  const sourcePath = describeArcStroke(center, center, outer - 2, startAngle, endAngle)
                  const targetWeight = dependencyTargetWeights.get(node.id)
                  const isTarget = targetWeight !== undefined
                  const isSource = dependencySourceIds.has(node.id)
                  const isChild = state === 'child'
                  const targetRatio = isTarget && maxDependencyWeight ? targetWeight / maxDependencyWeight : 0
                  const impactOpacity = Math.min(0.85, 0.35 + targetRatio * 0.4)
                  const impactWidth = Math.max(1, 1 + targetRatio * 1.4)

                  return (
                    <g
                      key={`${ring}-${node.id}`}
                      className="hud-ring-group hud-node"
                      data-wedge-state={state}
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
                              filter: `drop-shadow(0 0 ${pressureStyles?.shadowBlur ?? 6}px var(--accent-pressure-glow))`,
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
                        className={`hud-wedge ${ring > 1 ? 'hud-wedge--inner' : ''}`}
                        fill={fill}
                        fillOpacity={fillOpacity}
                        style={isChild ? { filter: 'brightness(var(--child-brightness-boost))' } : undefined}
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
                      <path
                        d={path}
                        className="hud-wedge-tint"
                        fill={`var(--signal-${signalKey})`}
                        opacity={tintOpacity}
                      />
                      {isChild ? (
                        <>
                          <path d={path} className="hud-child-glow" />
                          <path d={signalPath} className="hud-child-outline-outer" />
                          <path d={structurePath} className="hud-child-outline-inner" />
                        </>
                      ) : null}
                      {isSource ? (
                        <>
                          <path d={path} className="hud-source-fill" />
                          <path d={sourcePath} className="hud-source-outline" />
                        </>
                      ) : null}
                      {isTarget ? (
                        <path
                          d={impactPath}
                          className={`hud-target-impact${targetWeight === maxDependencyWeight ? ' is-strong' : ''}`}
                          strokeWidth={impactWidth}
                          opacity={impactOpacity}
                        />
                      ) : null}
                      {state === 'alarm' ? (
                        <>
                          <path d={path} className="hud-wedge-interaction hud-wedge-interaction--outer" />
                          <path d={path} className="hud-wedge-interaction hud-wedge-interaction--inner" />
                        </>
                      ) : null}
                      {state === 'wake' && selectedNodeId === null ? (
                        <path d={path} className="hud-wedge-interaction hud-wedge-interaction--soft" />
                      ) : null}
                      <path
                        d={signalPath}
                        className="hud-wedge-signal"
                        stroke={signalStroke}
                        strokeWidth={signalWidth}
                      />
                      <path
                        d={structurePath}
                        className="hud-wedge-structure"
                        stroke="var(--border-subtle)"
                        strokeWidth="1"
                      />
                      {showLabel ? (
                        <text
                          x={labelPoint.x}
                          y={labelPoint.y}
                          className="hud-branch-label"
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fill={labelColor}
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
                })}
              </g>
            )
          })}

        {arrowPaths.length > 0 ? (
          <g className="hud-arrow-layer">
            {arrowPaths.map((path) => {
              const impactRadius = path.isPrimary ? 3 : 2
              return (
                <g key={path.id}>
                  <path
                    d={path.d}
                    className="hud-arrow"
                    stroke={`url(#${path.gradientId})`}
                    strokeWidth={path.strokeWidth}
                    opacity={path.opacity}
                    markerEnd="url(#hudArrow)"
                  />
                  <line
                    className="hud-arrow-cap"
                    x1={path.dock.x1}
                    y1={path.dock.y1}
                    x2={path.dock.x2}
                    y2={path.dock.y2}
                    strokeWidth={Math.max(1, path.strokeWidth + 0.4)}
                    opacity={path.opacity}
                  />
                  <circle
                    className="hud-arrow-impact"
                    cx={path.dock.x1}
                    cy={path.dock.y1}
                    r={impactRadius}
                    opacity={path.opacity}
                  />
                </g>
              )
            })}
          </g>
        ) : null}

        {anchorNode ? (
          <circle className="hud-core" cx={center} cy={center} r={ring0Outer - 8} />
        ) : null}
      </svg>
    </div>
  )
}
