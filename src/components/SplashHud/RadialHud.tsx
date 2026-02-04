import './RadialHud.css'
import { describeArc, midAngle, polarToCartesian } from './hudMath'
import type { OrgData, OrgNode, Status } from '../../data/types'
import type { PressureMark } from '../../data/derivePressureMarks'
import type { DirectedDependencyEdge } from '../../data/deriveFunctionEdges'

export type HoverInfo = {
  nodeId: string
  x: number
  y: number
} | null

type RadialHudProps = {
  org: OrgData
  treeNodes: import('../../data/hudModel').OrgNode[]
  focusNodeId: string
  targetIds: Set<string>
  visibleIds: Set<string>
  activeTab: 'overview' | 'dependencies' | 'root'
  selectedBranchId: string
  selectedDivisionId: string
  selectedDepartmentId: string
  highlightedPath: string[]
  pressureMarks: PressureMark[]
  dependencyEdges: DirectedDependencyEdge[]
  pressureMode: boolean
  showSecondaryPressure: boolean
  showCrossRingTicks: boolean
  onlyAlerted: boolean
  explodeAll: boolean
  onSelectBranch: (id: string) => void
  onSelectDivision: (id: string) => void
  onSelectDepartment: (id: string) => void
  onHover: (info: HoverInfo) => void
  onHoverOut: () => void
}

const statusClass = (status: Status) => `status-${status}`

const getBranchId = (node: OrgNode | undefined, nodes: Record<string, OrgNode>) => {
  let current = node
  while (current && current.level !== 'branch') {
    current = current.parentId ? nodes[current.parentId] : undefined
  }
  return current?.id
}

const splitLabel = (label: string) => {
  const words = label.split(' ').filter(Boolean)
  if (words.length <= 2) return [label]
  const mid = Math.ceil(words.length / 2)
  return [words.slice(0, mid).join(' '), words.slice(mid).join(' ')]
}

const shouldDim = (node: OrgNode, onlyAlerted: boolean, highlightedPath: string[]) => {
  if (!onlyAlerted) return false
  if (highlightedPath.includes(node.id)) return false
  return node.status === 'green'
}

export const RadialHud = ({
  org,
  treeNodes,
  focusNodeId,
  targetIds,
  visibleIds,
  activeTab,
  selectedBranchId,
  selectedDivisionId,
  selectedDepartmentId,
  highlightedPath,
  pressureMarks,
  dependencyEdges,
  pressureMode,
  showSecondaryPressure,
  showCrossRingTicks,
  onlyAlerted,
  explodeAll,
  onSelectBranch,
  onSelectDivision,
  onSelectDepartment,
  onHover,
  onHoverOut,
}: RadialHudProps) => {
  const { nodesById, branchIds } = org
  const size = 760
  const center = size / 2
  const padding = 40
  const outerMost = center - padding - 14
  const ring0Nodes = treeNodes.filter((node) => node.level === 'branch' && visibleIds.has(node.id))
  const ring1Nodes = treeNodes.filter((node) => node.level === 'division' && visibleIds.has(node.id))
  const ring2Nodes = treeNodes.filter((node) => node.level === 'department' && visibleIds.has(node.id))
  const ring3Nodes = treeNodes.filter((node) => node.level === 'team' && visibleIds.has(node.id))
  const hasDivisions = ring1Nodes.length > 0
  const hasDepartments = ring2Nodes.length > 0
  const hasTeams = ring3Nodes.length > 0

  const ring4Outer = outerMost
  const ring4Inner = ring4Outer - (hasTeams ? 24 : 0)
  const ring3Outer = ring4Inner - (hasTeams ? 8 : 0)
  const ring3Inner = ring3Outer - 28
  const ring2Outer = ring3Inner - 8
  const ring2Inner = ring2Outer - 36
  const ring1Outer = ring2Inner - 10
  const ring1Inner = ring1Outer - 120
  const outerRing = hasTeams ? ring4Outer : ring3Outer

  const divisionsByBranch = ring1Nodes.reduce<Record<string, import('../../data/hudModel').OrgNode[]>>((acc, node) => {
    if (!node.parentId) return acc
    if (!acc[node.parentId]) acc[node.parentId] = []
    acc[node.parentId].push(node)
    return acc
  }, {})

  const departmentsByDivision = ring2Nodes.reduce<Record<string, import('../../data/hudModel').OrgNode[]>>((acc, node) => {
    if (!node.parentId) return acc
    if (!acc[node.parentId]) acc[node.parentId] = []
    acc[node.parentId].push(node)
    return acc
  }, {})

  const teamsByDepartment = ring3Nodes.reduce<Record<string, import('../../data/hudModel').OrgNode[]>>((acc, node) => {
    if (!node.parentId) return acc
    if (!acc[node.parentId]) acc[node.parentId] = []
    acc[node.parentId].push(node)
    return acc
  }, {})

  const branchAngle = 360 / ring0Nodes.length
  const branchWedges = ring0Nodes
    .sort((a, b) => a.sortIndex - b.sortIndex)
    .map((branch, index) => {
      const startAngle = index * branchAngle
      const endAngle = startAngle + branchAngle
      return { branchId: branch.id, startAngle, endAngle }
    })

  const isVisible = (id: string) => visibleIds.has(id)

  const makeChildWedges = (
    startAngle: number,
    endAngle: number,
    childIds: string[],
    gap: number,
  ) => {
    if (childIds.length === 0) return []
    const totalGap = gap * (childIds.length - 1)
    const span = Math.max(0, endAngle - startAngle - totalGap)
    const childSpan = span / childIds.length
    return childIds.map((id, index) => {
      const childStart = startAngle + index * (childSpan + gap)
      const childEnd = childStart + childSpan
      return { id, startAngle: childStart, endAngle: childEnd }
    })
  }

  const divisionWedgesByBranch = branchWedges.reduce<Record<string, { id: string; startAngle: number; endAngle: number }[]>>(
    (acc, branch) => {
      const childIds = (divisionsByBranch[branch.branchId] ?? [])
        .map((node) => node.id)
        .filter((id) => isVisible(id))
      acc[branch.branchId] = makeChildWedges(branch.startAngle, branch.endAngle, childIds, 0.6)
      return acc
    },
    {},
  )

  const departmentWedgesByDivision = Object.values(divisionWedgesByBranch).flat().reduce<
    Record<string, { id: string; startAngle: number; endAngle: number }[]>
  >((acc, wedge) => {
    const childIds = (departmentsByDivision[wedge.id] ?? [])
      .map((node) => node.id)
      .filter((id) => isVisible(id))
    acc[wedge.id] = makeChildWedges(wedge.startAngle, wedge.endAngle, childIds, 0.6)
    return acc
  }, {})

  const teamWedgesByDepartment = Object.values(departmentWedgesByDivision).flat().reduce<
    Record<string, { id: string; startAngle: number; endAngle: number }[]>
  >((acc, wedge) => {
    const childIds = (teamsByDepartment[wedge.id] ?? [])
      .map((node) => node.id)
      .filter((id) => isVisible(id))
    acc[wedge.id] = makeChildWedges(wedge.startAngle, wedge.endAngle, childIds, 0.6)
    return acc
  }, {})


  const pressureByTarget = pressureMarks.reduce<Record<string, PressureMark>>((acc, mark) => {
    acc[mark.targetNodeId] = mark
    return acc
  }, {})

  const getVisualState = (id: string) =>
    pressureMode && focusNodeId && activeTab === 'dependencies'
      ? id === focusNodeId
        ? 'focus'
        : targetIds.has(id)
          ? 'target'
          : 'nonTarget'
      : 'default'

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

  const arrowPaths = dependencyEdges.map((edge) => {
    const fromBranch = branchWedges.find((wedge) => wedge.branchId === edge.fromId)
    const toBranch = branchWedges.find((wedge) => wedge.branchId === edge.toId)
    if (!fromBranch || !toBranch) return null
    const fromAngle = midAngle(fromBranch.startAngle, fromBranch.endAngle)
    const toAngle = midAngle(toBranch.startAngle, toBranch.endAngle)
    const from = polarToCartesian(center, center, ring1Inner + 12, fromAngle)
    const to = polarToCartesian(center, center, ring1Inner + 12, toAngle)
    const mid = polarToCartesian(center, center, ring1Inner - 24, midAngle(fromAngle, toAngle))
    const dockOuter = polarToCartesian(center, center, ring1Inner + 18, toAngle)
    return {
      id: edge.id,
      weight: edge.weight,
      d: `M ${from.x} ${from.y} Q ${mid.x} ${mid.y} ${to.x} ${to.y}`,
      dock: { x1: to.x, y1: to.y, x2: dockOuter.x, y2: dockOuter.y },
    }
  }).filter(Boolean) as { id: string; weight: number; d: string; dock: { x1: number; y1: number; x2: number; y2: number } }[]

  return (
    <div className="radial-hud" aria-label="Org health radial">
      <svg viewBox={`0 0 ${size} ${size}`} role="img">
        <defs>
          <filter id="hudGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="pressGlow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
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

        {explodeAll && hasDivisions ? (
          <g className="hud-branch-guides">
            {branchWedges.map(({ branchId, startAngle, endAngle }) => {
              const dividerStart = polarToCartesian(center, center, ring1Inner, startAngle)
              const dividerEnd = polarToCartesian(center, center, outerRing + 12, startAngle)
              const outline = describeArc(center, center, outerRing + 6, ring2Inner - 6, startAngle, endAngle)
              return (
                <g key={`guide-${branchId}`}>
                  <path className="hud-branch-outline" d={outline} />
                  <line
                    className="hud-branch-divider"
                    x1={dividerStart.x}
                    y1={dividerStart.y}
                    x2={dividerEnd.x}
                    y2={dividerEnd.y}
                  />
                </g>
              )
            })}
          </g>
        ) : null}

        <circle className="hud-grid" cx={center} cy={center} r={ring1Inner - 6} />
        <circle className="hud-grid" cx={center} cy={center} r={ring1Inner + 18} />
        {hasDivisions ? <circle className="hud-grid" cx={center} cy={center} r={ring2Outer + 10} /> : null}
        {hasDepartments ? <circle className="hud-grid" cx={center} cy={center} r={ring3Outer + 10} /> : null}
        {hasTeams ? <circle className="hud-grid" cx={center} cy={center} r={ring4Outer + 10} /> : null}

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

        {branchWedges.map(({ branchId, startAngle, endAngle }) => {
          const node = nodesById[branchId]
          const path = describeArc(center, center, ring1Outer, ring1Inner, startAngle, endAngle)
          const isSelected = branchId === selectedBranchId
          const isHighlighted = highlightedPath.includes(branchId)
          const mark = pressureByTarget[branchId]
          const showPressure =
            pressureMode && mark && (showSecondaryPressure || mark.tier === 'primary') && activeTab === 'dependencies'
          const visualState = getVisualState(branchId)
          const dim = shouldDim(node, onlyAlerted, highlightedPath)
          const labelAngle = midAngle(startAngle, endAngle)
          const labelRadius = ring1Inner + (ring1Outer - ring1Inner) * 0.52
          const labelPoint = polarToCartesian(center, center, labelRadius, labelAngle)
          const labelLines = splitLabel(node.name)
          const pressureStyles = mark ? getPressureStyles(mark) : null
          const bandOuter = mark ? ring1Outer + 6 + (mark.intensity01 * 8) : ring1Outer + 6
          const bandInner = ring1Outer + 2
          const liftPx = pressureStyles?.lift ?? 0
          const liftX = Math.cos((labelAngle - 90) * (Math.PI / 180)) * liftPx
          const liftY = Math.sin((labelAngle - 90) * (Math.PI / 180)) * liftPx
          return (
            <g
              key={branchId}
              className="hud-branch-group"
              data-visual={visualState}
              style={{
                transform: showPressure ? `translate(${liftX}px, ${liftY}px)` : undefined,
                transition: 'transform 200ms ease-out',
                ['--press-intensity' as string]: mark?.intensity01 ?? 0,
                ['--dx' as string]: `${liftX}px`,
                ['--dy' as string]: `${liftY}px`,
              }}
            >
              {pressureMode && visualState === 'focus' ? (
                <path
                  d={describeArc(center, center, ring1Outer + 6, ring1Inner - 6, startAngle, endAngle)}
                  className="focusRing"
                />
              ) : null}
              {showPressure && mark ? (
                <>
                  <path
                    d={path}
                    className="pressureHalo"
                    style={{
                      filter: `drop-shadow(0 0 ${pressureStyles?.shadowBlur ?? 6}px rgba(0,0,0,0.45))`,
                    }}
                  />
                  <path
                    d={path}
                    className="pressureStroke"
                  />
                  <path
                    d={describeArc(center, center, bandOuter, bandInner, startAngle, endAngle)}
                    className="pressureBand"
                  />
                  {showCrossRingTicks && mark.crossRing ? (
                    <line
                      className="pressureTick"
                      x1={polarToCartesian(center, center, ring1Outer + 14, labelAngle).x}
                      y1={polarToCartesian(center, center, ring1Outer + 14, labelAngle).y}
                      x2={polarToCartesian(center, center, ring1Outer + 24, labelAngle).x}
                      y2={polarToCartesian(center, center, ring1Outer + 24, labelAngle).y}
                    />
                  ) : null}
                </>
              ) : null}
              <path
                d={path}
                className={`hud-wedge ${statusClass(node.status)} ${isSelected ? 'is-selected' : ''} ${isHighlighted ? 'is-highlight' : ''} ${dim ? 'is-dim' : ''}`}
                data-visual={visualState}
                onMouseEnter={(event) => onHover({ nodeId: branchId, x: event.clientX, y: event.clientY })}
                onMouseMove={(event) => onHover({ nodeId: branchId, x: event.clientX, y: event.clientY })}
                onMouseLeave={onHoverOut}
                onClick={() => onSelectBranch(branchId)}
              />
              <text
                x={labelPoint.x}
                y={labelPoint.y}
                className={`hud-branch-label ${dim ? 'is-dim' : ''}`}
                textAnchor="middle"
                dominantBaseline="middle"
              >
                <title>{node.name}</title>
                {labelLines.map((line, idx) => (
                  <tspan key={`${branchId}-line-${idx}`} x={labelPoint.x} dy={idx === 0 ? '-0.35em' : '1.1em'}>
                    {line}
                  </tspan>
                ))}
              </text>
            </g>
          )
        })}

        {Object.values(divisionWedgesByBranch).flat().map(({ id, startAngle, endAngle }) => {
          const node = nodesById[id]
          const path = describeArc(center, center, ring2Outer, ring2Inner, startAngle, endAngle)
          const isSelected = id === selectedDivisionId
          const isHighlighted = highlightedPath.includes(id)
          const dim = shouldDim(node, onlyAlerted, highlightedPath)
          const mark = pressureByTarget[id]
          const showPressure =
            pressureMode && mark && (showSecondaryPressure || mark.tier === 'primary') && activeTab === 'dependencies'
          const visualState = getVisualState(id)
          const pressureStyles = mark ? getPressureStyles(mark) : null
          const labelAngle = midAngle(startAngle, endAngle)
          const liftPx = pressureStyles?.lift ?? 0
          const liftX = Math.cos((labelAngle - 90) * (Math.PI / 180)) * liftPx
          const liftY = Math.sin((labelAngle - 90) * (Math.PI / 180)) * liftPx
          const bandOuter = ring2Outer + 6 + (mark?.intensity01 ?? 0) * 8
          const bandInner = ring2Outer + 2
          return (
            <g
              key={id}
              className="hud-inner-group"
              data-visual={visualState}
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
                </>
              ) : null}
              <path
                d={path}
                className={`hud-wedge hud-wedge--inner ${statusClass(node.status)} ${isSelected ? 'is-selected' : ''} ${isHighlighted ? 'is-highlight' : ''} ${dim ? 'is-dim' : ''}`}
                data-visual={visualState}
                onMouseEnter={(event) => onHover({ nodeId: id, x: event.clientX, y: event.clientY })}
                onMouseMove={(event) => onHover({ nodeId: id, x: event.clientX, y: event.clientY })}
                onMouseLeave={onHoverOut}
                onClick={() => onSelectDivision(id)}
              />
            </g>
          )
        })}

        {Object.values(departmentWedgesByDivision).flat().map(({ id, startAngle, endAngle }) => {
          const node = nodesById[id]
          const path = describeArc(center, center, ring3Outer, ring3Inner, startAngle, endAngle)
          const isSelected = id === selectedDepartmentId
          const isHighlighted = highlightedPath.includes(id)
          const dim = shouldDim(node, onlyAlerted, highlightedPath)
          const mark = pressureByTarget[id]
          const showPressure =
            pressureMode && mark && (showSecondaryPressure || mark.tier === 'primary') && activeTab === 'dependencies'
          const visualState = getVisualState(id)
          const pressureStyles = mark ? getPressureStyles(mark) : null
          const labelAngle = midAngle(startAngle, endAngle)
          const liftPx = pressureStyles?.lift ?? 0
          const liftX = Math.cos((labelAngle - 90) * (Math.PI / 180)) * liftPx
          const liftY = Math.sin((labelAngle - 90) * (Math.PI / 180)) * liftPx
          const bandOuter = ring3Outer + 6 + (mark?.intensity01 ?? 0) * 8
          const bandInner = ring3Outer + 2
          return (
            <g
              key={id}
              className="hud-inner-group"
              data-visual={visualState}
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
                </>
              ) : null}
              <path
                d={path}
                className={`hud-wedge hud-wedge--outer ${statusClass(node.status)} ${isSelected ? 'is-selected' : ''} ${isHighlighted ? 'is-highlight' : ''} ${dim ? 'is-dim' : ''}`}
                data-visual={visualState}
                onMouseEnter={(event) => onHover({ nodeId: id, x: event.clientX, y: event.clientY })}
                onMouseMove={(event) => onHover({ nodeId: id, x: event.clientX, y: event.clientY })}
                onMouseLeave={onHoverOut}
                onClick={() => onSelectDepartment(id)}
              />
            </g>
          )
        })}

        {hasTeams
          ? Object.values(teamWedgesByDepartment).flat().map(({ id, startAngle, endAngle }) => {
              const node = nodesById[id]
              const path = describeArc(center, center, ring4Outer, ring4Inner, startAngle, endAngle)
              const isHighlighted = highlightedPath.includes(id)
              const dim = shouldDim(node, onlyAlerted, highlightedPath)
              const mark = pressureByTarget[id]
              const showPressure =
                pressureMode && mark && (showSecondaryPressure || mark.tier === 'primary') && activeTab === 'dependencies'
              const visualState = getVisualState(id)
              const pressureStyles = mark ? getPressureStyles(mark) : null
              const labelAngle = midAngle(startAngle, endAngle)
              const liftPx = pressureStyles?.lift ?? 0
              const liftX = Math.cos((labelAngle - 90) * (Math.PI / 180)) * liftPx
              const liftY = Math.sin((labelAngle - 90) * (Math.PI / 180)) * liftPx
              const bandOuter = ring4Outer + 6 + (mark?.intensity01 ?? 0) * 8
              const bandInner = ring4Outer + 2
              return (
                <g
                  key={id}
                  className="hud-inner-group"
                  data-visual={visualState}
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
                    </>
                  ) : null}
                  <path
                    d={path}
                    className={`hud-wedge hud-wedge--outer ${statusClass(node.status)} ${isHighlighted ? 'is-highlight' : ''} ${dim ? 'is-dim' : ''}`}
                    data-visual={visualState}
                    onMouseEnter={(event) => onHover({ nodeId: id, x: event.clientX, y: event.clientY })}
                    onMouseMove={(event) => onHover({ nodeId: id, x: event.clientX, y: event.clientY })}
                    onMouseLeave={onHoverOut}
                  />
                </g>
              )
            })
          : null}

        <circle className="hud-core" cx={center} cy={center} r={ring1Inner - 18} />

        {hasDepartments || hasTeams ? (
          <g className="hud-ticks">
            {Array.from({ length: 72 }).map((_, index) => {
              const angle = (360 / 72) * index
              const outer = polarToCartesian(center, center, outerRing + 12, angle)
              const inner = polarToCartesian(center, center, outerRing + (index % 3 === 0 ? 2 : 6), angle)
              return (
                <line
                  key={`tick-${angle}`}
                  x1={inner.x}
                  y1={inner.y}
                  x2={outer.x}
                  y2={outer.y}
                />
              )
            })}
          </g>
        ) : null}
      </svg>
    </div>
  )
}

export const branchIdForNode = (node: OrgNode | undefined, nodes: Record<string, OrgNode>) =>
  getBranchId(node, nodes)
