import './RadialHud.css'
import { describeArc, midAngle, polarToCartesian } from './hudMath'
import type { OrgData, OrgNode, Status } from '../../data/types'

export type HoverInfo = {
  nodeId: string
  x: number
  y: number
} | null

type RadialHudProps = {
  org: OrgData
  selectedBranchId: string
  selectedDivisionId: string
  selectedDepartmentId: string
  visibleDepartmentIds?: string[]
  highlightedPath: string[]
  showDependencies: boolean
  dependencyChord?: { fromBranchId: string; toBranchId: string } | null
  onlyAlerted: boolean
  explodeAll: boolean
  showSalesToggle: boolean
  expandSalesDepartments: boolean
  onToggleExpandSales: () => void
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
  selectedBranchId,
  selectedDivisionId,
  selectedDepartmentId,
  visibleDepartmentIds,
  highlightedPath,
  showDependencies,
  dependencyChord,
  onlyAlerted,
  explodeAll,
  showSalesToggle,
  expandSalesDepartments,
  onToggleExpandSales,
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
  const ring3Outer = center - padding - 14
  const ring3Inner = ring3Outer - 36
  const ring2Outer = ring3Inner - 10
  const ring2Inner = ring2Outer - 36
  const ring1Outer = ring2Inner - 8
  const ring1Inner = ring1Outer - 80

  const branchAngle = 360 / branchIds.length
  const branchWedges = branchIds.map((branchId, index) => {
    const startAngle = index * branchAngle
    const endAngle = startAngle + branchAngle
    return { branchId, startAngle, endAngle }
  })

  const selectedBranch = nodesById[selectedBranchId]
  const selectedDivision = nodesById[selectedDivisionId]

  const divisionIds = explodeAll
    ? branchIds.flatMap((branchId) => nodesById[branchId]?.childrenIds ?? [])
    : selectedBranch?.childrenIds ?? []
  const departmentIds = explodeAll
    ? divisionIds.flatMap((divisionId) => nodesById[divisionId]?.childrenIds ?? [])
    : visibleDepartmentIds ?? selectedDivision?.childrenIds ?? []

  const selectedBranchWedge = branchWedges.find((wedge) => wedge.branchId === selectedBranchId)

  const divisionWedges = explodeAll
    ? divisionIds.map((divisionId, index) => {
        const span = 360 / divisionIds.length
        const startAngle = span * index
        const endAngle = startAngle + span
        return { divisionId, startAngle, endAngle }
      })
    : selectedBranchWedge
      ? divisionIds.map((divisionId, index) => {
          const span = (selectedBranchWedge.endAngle - selectedBranchWedge.startAngle) / divisionIds.length
          const startAngle = selectedBranchWedge.startAngle + span * index
          const endAngle = startAngle + span
          return { divisionId, startAngle, endAngle }
        })
      : []

  const selectedDivisionWedge = divisionWedges.find((wedge) => wedge.divisionId === selectedDivisionId)

  const departmentWedges = explodeAll
    ? departmentIds.map((departmentId, index) => {
        const span = 360 / departmentIds.length
        const startAngle = span * index
        const endAngle = startAngle + span
        return { departmentId, startAngle, endAngle }
      })
    : selectedDivisionWedge
      ? departmentIds.map((departmentId, index) => {
          const span = (selectedDivisionWedge.endAngle - selectedDivisionWedge.startAngle) / departmentIds.length
          const startAngle = selectedDivisionWedge.startAngle + span * index
          const endAngle = startAngle + span
          return { departmentId, startAngle, endAngle }
        })
      : []

  const chordPath = () => {
    if (!dependencyChord) return ''
    const fromBranch = branchWedges.find((wedge) => wedge.branchId === dependencyChord.fromBranchId)
    const toBranch = branchWedges.find((wedge) => wedge.branchId === dependencyChord.toBranchId)
    if (!fromBranch || !toBranch) return ''
    const fromAngle = midAngle(fromBranch.startAngle, fromBranch.endAngle)
    const toAngle = midAngle(toBranch.startAngle, toBranch.endAngle)
    const from = polarToCartesian(center, center, ring1Inner + 8, fromAngle)
    const to = polarToCartesian(center, center, ring1Inner + 8, toAngle)
    const mid = { x: center, y: center }
    return `M ${from.x} ${from.y} Q ${mid.x} ${mid.y} ${to.x} ${to.y}`
  }

  const expandButtonPoint =
    showSalesToggle && selectedDivisionWedge
      ? polarToCartesian(center, center, ring3Outer + 28, midAngle(selectedDivisionWedge.startAngle, selectedDivisionWedge.endAngle))
      : null

  return (
    <div className="radial-hud" aria-label="Org health radial">
      {showSalesToggle ? (
        <button
          className="hud-expand-toggle"
          onClick={onToggleExpandSales}
          style={
            expandButtonPoint
              ? {
                  left: `${(expandButtonPoint.x / size) * 100}%`,
                  top: `${(expandButtonPoint.y / size) * 100}%`,
                }
              : undefined
          }
        >
          {expandSalesDepartments ? 'Collapse Departments' : 'Expand Departments'}
        </button>
      ) : null}
      <svg viewBox={`0 0 ${size} ${size}`} role="img">
        <defs>
          <filter id="hudGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {explodeAll ? (
          <g className="hud-branch-guides">
            {branchWedges.map(({ branchId, startAngle, endAngle }) => {
              const dividerStart = polarToCartesian(center, center, ring1Inner, startAngle)
              const dividerEnd = polarToCartesian(center, center, ring3Outer + 12, startAngle)
              const outline = describeArc(center, center, ring3Outer + 6, ring2Inner - 6, startAngle, endAngle)
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
        <circle className="hud-grid" cx={center} cy={center} r={ring2Outer + 10} />
        <circle className="hud-grid" cx={center} cy={center} r={ring3Outer + 10} />

        {branchWedges.map(({ branchId, startAngle, endAngle }) => {
          const node = nodesById[branchId]
          const path = describeArc(center, center, ring1Outer, ring1Inner, startAngle, endAngle)
          const isSelected = branchId === selectedBranchId
          const isHighlighted = highlightedPath.includes(branchId)
          const dim = shouldDim(node, onlyAlerted, highlightedPath)
          const labelAngle = midAngle(startAngle, endAngle)
          const labelRadius = ring1Inner + (ring1Outer - ring1Inner) * 0.52
          const labelPoint = polarToCartesian(center, center, labelRadius, labelAngle)
          const labelLines = splitLabel(node.name)
          return (
            <g key={branchId} className="hud-branch-group">
              <path
                d={path}
                className={`hud-wedge ${statusClass(node.status)} ${isSelected ? 'is-selected' : ''} ${isHighlighted ? 'is-highlight' : ''} ${dim ? 'is-dim' : ''}`}
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

        {divisionWedges.map(({ divisionId, startAngle, endAngle }) => {
          const node = nodesById[divisionId]
          const path = describeArc(center, center, ring2Outer, ring2Inner, startAngle, endAngle)
          const isSelected = divisionId === selectedDivisionId
          const isHighlighted = highlightedPath.includes(divisionId)
          const dim = shouldDim(node, onlyAlerted, highlightedPath)
          return (
            <path
              key={divisionId}
              d={path}
              className={`hud-wedge hud-wedge--inner ${statusClass(node.status)} ${isSelected ? 'is-selected' : ''} ${isHighlighted ? 'is-highlight' : ''} ${dim ? 'is-dim' : ''}`}
              onMouseEnter={(event) => onHover({ nodeId: divisionId, x: event.clientX, y: event.clientY })}
              onMouseMove={(event) => onHover({ nodeId: divisionId, x: event.clientX, y: event.clientY })}
              onMouseLeave={onHoverOut}
              onClick={() => onSelectDivision(divisionId)}
            />
          )
        })}

        {departmentWedges.map(({ departmentId, startAngle, endAngle }) => {
          const node = nodesById[departmentId]
          const path = describeArc(center, center, ring3Outer, ring3Inner, startAngle, endAngle)
          const isSelected = departmentId === selectedDepartmentId
          const isHighlighted = highlightedPath.includes(departmentId)
          const dim = shouldDim(node, onlyAlerted, highlightedPath)
          return (
            <path
              key={departmentId}
              d={path}
              className={`hud-wedge hud-wedge--outer ${statusClass(node.status)} ${isSelected ? 'is-selected' : ''} ${isHighlighted ? 'is-highlight' : ''} ${dim ? 'is-dim' : ''}`}
              onMouseEnter={(event) => onHover({ nodeId: departmentId, x: event.clientX, y: event.clientY })}
              onMouseMove={(event) => onHover({ nodeId: departmentId, x: event.clientX, y: event.clientY })}
              onMouseLeave={onHoverOut}
              onClick={() => onSelectDepartment(departmentId)}
            />
          )
        })}

        <circle className="hud-core" cx={center} cy={center} r={ring1Inner - 18} />

        {showDependencies && dependencyChord ? <path className="hud-chord" d={chordPath()} /> : null}

        <g className="hud-ticks">
          {Array.from({ length: 72 }).map((_, index) => {
            const angle = (360 / 72) * index
            const outer = polarToCartesian(center, center, ring3Outer + 12, angle)
            const inner = polarToCartesian(center, center, ring3Outer + (index % 3 === 0 ? 2 : 6), angle)
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
      </svg>
    </div>
  )
}

export const branchIdForNode = (node: OrgNode | undefined, nodes: Record<string, OrgNode>) =>
  getBranchId(node, nodes)
