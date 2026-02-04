import { useEffect, useMemo, useRef, useState } from 'react'
import './SplashHud.css'
import { buildOrg } from '../../data/buildOrg'
import type { OrgData, OrgNode } from '../../data/types'
import { HudSidePanel } from './HudSidePanel'
import { HudTooltip } from './HudTooltip'
import { RadialHud, type HoverInfo } from './RadialHud'
import { DEFAULT_FUNCTION_DEPENDENCIES } from '../../data/functionDependencies'
import { deriveFunctionEdges } from '../../data/deriveFunctionEdges'
import { derivePressureMarks, type DepEdge, type HudNode } from '../../data/derivePressureMarks'
import { computeFocusTargetsAndExpansion } from '../../data/deriveFocusExpansion'
import { deriveVisibilityPolicy } from '../../data/deriveVisibilityPolicy'
import type { OrgNode as HudOrgNode } from '../../data/hudModel'
import { buildMockCrossLevelDeps } from '../../data/mockCrossLevelDeps'

const lowestByScore = (nodes: Record<string, OrgNode>, ids: string[]) => {
  return ids.reduce((lowest, id) => {
    const node = nodes[id]
    if (!lowest) return node
    return node.score < lowest.score ? node : lowest
  }, null as OrgNode | null)
}

const findLowestPath = (org: OrgData) => {
  const company = org.nodesById[org.rootId]
  const worstBranch = lowestByScore(org.nodesById, company.childrenIds) ?? org.nodesById[org.branchIds[0]]
  const worstDivision = worstBranch ? lowestByScore(org.nodesById, worstBranch.childrenIds) : null
  const worstDepartment = worstDivision ? lowestByScore(org.nodesById, worstDivision.childrenIds) : null
  const worstTeam = worstDepartment ? lowestByScore(org.nodesById, worstDepartment.childrenIds) : null

  return {
    branchId: worstBranch?.id ?? org.branchIds[0],
    divisionId: worstDivision?.id ?? worstBranch?.childrenIds[0] ?? '',
    departmentId: worstDepartment?.id ?? worstDivision?.childrenIds[0] ?? '',
    teamId: worstTeam?.id ?? worstDepartment?.childrenIds[0] ?? '',
  }
}

export const SplashHud = ({ seed }: { seed: number }) => {
  const org = useMemo(() => buildOrg(seed), [seed])
  const initialPath = useMemo(() => findLowestPath(org), [org])

  const [selectedBranchId, setSelectedBranchId] = useState(initialPath.branchId)
  const [selectedDivisionId, setSelectedDivisionId] = useState(initialPath.divisionId)
  const [selectedDepartmentId, setSelectedDepartmentId] = useState(initialPath.departmentId)
  const [focusLevel, setFocusLevel] = useState<'branch' | 'division' | 'department'>('branch')
  const [hoverInfo, setHoverInfo] = useState<HoverInfo>(null)
  const [showDependencies, setShowDependencies] = useState(true)
  const [pressureMode, setPressureMode] = useState(true)
  const [showSecondaryPressure, setShowSecondaryPressure] = useState(true)
  const [showCrossRingTicks, setShowCrossRingTicks] = useState(true)
  const [showArrowsExplain, setShowArrowsExplain] = useState(true)
  const [panelTab, setPanelTab] = useState<'overview' | 'dependencies' | 'root'>('dependencies')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [focusStack, setFocusStack] = useState<string[]>([initialPath.branchId])
  const [onlyAlerted, setOnlyAlerted] = useState(false)
  const [explodeAll, setExplodeAll] = useState(false)
  const [expandDepartments, setExpandDepartments] = useState(false)
  const [pulseDrivers, setPulseDrivers] = useState(false)
  const driversRef = useRef<HTMLDivElement | null>(null)

  const selectBranch = (branchId: string) => {
    const branch = org.nodesById[branchId]
    if (!branch) return
    const nextDivision = lowestByScore(org.nodesById, branch.childrenIds)
    const nextDepartment = nextDivision ? lowestByScore(org.nodesById, nextDivision.childrenIds) : null
    setSelectedBranchId(branchId)
    if (nextDivision) setSelectedDivisionId(nextDivision.id)
    if (nextDepartment) setSelectedDepartmentId(nextDepartment.id)
    setFocusStack([branchId])
    setFocusLevel('branch')
  }

  const selectDivision = (divisionId: string) => {
    const division = org.nodesById[divisionId]
    if (!division) return
    const nextDepartment = lowestByScore(org.nodesById, division.childrenIds)
    setSelectedDivisionId(divisionId)
    if (nextDepartment) setSelectedDepartmentId(nextDepartment.id)
    setFocusStack([selectedBranchId, divisionId])
    setFocusLevel('division')
  }

  const selectDepartment = (departmentId: string) => {
    if (!org.nodesById[departmentId]) return
    setSelectedDepartmentId(departmentId)
    setFocusStack([selectedBranchId, selectedDivisionId, departmentId])
    setFocusLevel('department')
  }

  const selectedBranch = org.nodesById[selectedBranchId]
  const selectedDivision = org.nodesById[selectedDivisionId]
  const selectedDepartment = org.nodesById[selectedDepartmentId]
  const selectedTeam = selectedDepartment
    ? lowestByScore(org.nodesById, selectedDepartment.childrenIds) ?? org.nodesById[selectedDepartment.childrenIds[0]]
    : null

  const company = org.nodesById[org.rootId]
  const highlightedPath = [company.id, selectedBranch?.id, selectedDivision?.id, selectedDepartment?.id, selectedTeam?.id].filter(
    Boolean,
  ) as string[]

  const isExpandableBranch = selectedBranch?.name === 'Product & Engineering'
  const allDepartmentsForDivision = selectedDivision?.childrenIds ?? []
  const visibleDepartments = isExpandableBranch && !expandDepartments
    ? [...allDepartmentsForDivision]
        .map((id) => org.nodesById[id])
        .filter(Boolean)
        .sort((a, b) => a.score - b.score)
        .slice(0, 4)
        .map((node) => node.id)
    : allDepartmentsForDivision

  useEffect(() => {
    if (!isExpandableBranch || expandDepartments) return
    if (visibleDepartments.length === 0) return
    if (!visibleDepartments.includes(selectedDepartmentId)) {
      setSelectedDepartmentId(visibleDepartments[0])
    }
  }, [expandDepartments, isExpandableBranch, selectedDepartmentId, visibleDepartments])

  const activeNode = selectedDepartment ?? selectedDivision ?? selectedBranch

  const treeNodes: HudOrgNode[] = Object.values(org.nodesById).map((node) => ({
    id: node.id,
    label: node.name,
    parentId: node.parentId,
    level: node.level,
    majorOrgId: node.level === 'branch' ? node.id : node.parentId ? `branch-${node.id.split('-')[1]}` : node.id,
    childrenIds: node.childrenIds,
    sortIndex: node.parentId ? org.nodesById[node.parentId]?.childrenIds.indexOf(node.id) ?? 0 : 0,
    status: node.status,
    score: node.score,
  }))

  const hudNodes: HudNode[] = treeNodes.map((node) => ({
    id: node.id,
    label: node.label,
    ring: node.level === 'branch' ? 0 : node.level === 'division' ? 1 : node.level === 'department' ? 2 : 3,
    status: node.status,
    score: node.score,
  }))

  const baseEdges: DepEdge[] = deriveFunctionEdges(DEFAULT_FUNCTION_DEPENDENCIES, selectedBranchId).map((edge) => ({
    id: edge.id,
    fromId: edge.fromId,
    toId: edge.toId,
    weight: edge.weight,
  }))

  const mockEdges = buildMockCrossLevelDeps(treeNodes)

  const activeEdges = showDependencies
    ? [...baseEdges, ...mockEdges].filter((edge) => edge.fromId === (focusStack.at(-1) ?? selectedBranchId))
    : []

  const focusNodeId = focusStack.at(-1) ?? selectedBranchId
  const visibility = deriveVisibilityPolicy(
    panelTab,
    focusStack,
    treeNodes,
    activeEdges,
    explodeAll && panelTab === 'dependencies',
    3,
  )
  const focusResult = computeFocusTargetsAndExpansion(focusNodeId, treeNodes, activeEdges, visibility.visibleLevel)
  const pressureMarks = pressureMode
    ? derivePressureMarks(focusNodeId, hudNodes, activeEdges)
    : []

  const sortedEdges = activeEdges.slice().sort((a, b) => b.weight - a.weight)
  const topEdges = sortedEdges.slice(0, 6)
  const remainingEdges = sortedEdges.slice(6)
  const targetIds = new Set(focusResult.targets.map((target) => target.id))
  const strongestTarget = [...focusResult.targets].sort((a, b) => b.weight - a.weight)[0]
  const dependsOnLine = strongestTarget
    ? `Depends on ${org.nodesById[strongestTarget.id]?.name ?? strongestTarget.id}`
    : 'No direct dependencies'
  const strongestLine = strongestTarget
    ? `Strongest: ${org.nodesById[strongestTarget.id]?.name ?? strongestTarget.id} (${strongestTarget.weight}/10)`
    : ''
  const landingLine = strongestTarget?.landingPath && strongestTarget.landingPath.length > 1
    ? `Landing: ${strongestTarget.landingPath.map((id) => org.nodesById[id]?.name ?? id).join(' > ')}`
    : ''

  const upstream = showDependencies
    ? activeEdges
        .map((edge) => ({
          name: org.nodesById[edge.toId]?.name ?? edge.toId,
          status: org.nodesById[edge.toId]?.status ?? 'green',
          weight: edge.weight,
        }))
        .sort((a, b) => b.weight - a.weight)
        .slice(0, 3)
    : []

  const topDependencyNames = activeEdges
    .slice()
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 2)
    .map((edge) => org.nodesById[edge.toId]?.name ?? edge.toId)

  const dependencyHeadline = topDependencyNames.length > 0
    ? `${selectedBranch?.name ?? 'This function'} depends on ${topDependencyNames.join(', ')}.`
    : `${selectedBranch?.name ?? 'This function'} has no direct upstream dependencies.`

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA', 'BUTTON', 'SELECT'].includes(target.tagName)) {
        return
      }

      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        event.preventDefault()
        const direction = event.key === 'ArrowUp' ? -1 : 1
        if (focusLevel === 'branch') {
          const index = org.branchIds.indexOf(selectedBranchId)
          const nextIndex = (index + direction + org.branchIds.length) % org.branchIds.length
          selectBranch(org.branchIds[nextIndex])
        } else if (focusLevel === 'division' && selectedBranch) {
          const divisions = selectedBranch.childrenIds
          const index = divisions.indexOf(selectedDivisionId)
          const nextIndex = (index + direction + divisions.length) % divisions.length
          selectDivision(divisions[nextIndex])
        } else if (focusLevel === 'department' && selectedDivision) {
          const departments = selectedDivision.childrenIds
          const index = departments.indexOf(selectedDepartmentId)
          const nextIndex = (index + direction + departments.length) % departments.length
          selectDepartment(departments[nextIndex])
        }
      }

      if (event.key === 'Enter') {
        if (focusLevel === 'branch' && selectedBranch) {
          const nextDivision = lowestByScore(org.nodesById, selectedBranch.childrenIds)
          if (nextDivision) selectDivision(nextDivision.id)
        } else if (focusLevel === 'division' && selectedDivision) {
          const nextDepartment = lowestByScore(org.nodesById, selectedDivision.childrenIds)
          if (nextDepartment) selectDepartment(nextDepartment.id)
        }
      }

      if (event.key === 'Backspace') {
        if (focusLevel === 'department') {
          setFocusLevel('division')
        } else if (focusLevel === 'division') {
          setFocusLevel('branch')
        }
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [focusLevel, org.branchIds, org.nodesById, selectedBranch, selectedBranchId, selectedDepartmentId, selectedDivision, selectedDivisionId])

  const handleRootCauseJump = () => {
    if (!driversRef.current) return
    driversRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setPulseDrivers(true)
    window.setTimeout(() => setPulseDrivers(false), 900)
  }

  return (
    <div className={`splash-hud ${pressureMode && panelTab === 'dependencies' ? 'is-pressure' : ''}`}>
      <div className="splash-hud__main">
        <div className="splash-hud__radial-shell">
          <RadialHud
            org={org}
            nodes={hudNodes}
            treeNodes={treeNodes}
            selectedBranchId={selectedBranchId}
            selectedDivisionId={selectedDivisionId}
            selectedDepartmentId={selectedDepartmentId}
            visibleDepartmentIds={explodeAll ? undefined : visibleDepartments}
            highlightedPath={highlightedPath}
            pressureMarks={pressureMarks}
            dependencyEdges={showArrowsExplain ? topEdges : []}
            pressureMode={pressureMode}
            showSecondaryPressure={showSecondaryPressure}
            showCrossRingTicks={showCrossRingTicks}
            focusNodeId={focusNodeId}
            targetIds={targetIds}
            expandedNodeIds={focusResult.expandedNodeIds}
            visibleIds={visibility.visibleIds}
            expandedMajorOrgIds={visibility.expandedMajorOrgIds}
            activeTab={panelTab}
            onlyAlerted={onlyAlerted}
            explodeAll={explodeAll}
            showSalesToggle={isExpandableBranch && !explodeAll}
            expandSalesDepartments={expandDepartments}
            onToggleExpandSales={() => setExpandDepartments((prev) => !prev)}
            onSelectBranch={selectBranch}
            onSelectDivision={selectDivision}
            onSelectDepartment={selectDepartment}
            onHover={(info) => setHoverInfo(info)}
            onHoverOut={() => setHoverInfo(null)}
          />
          <div className={`splash-hud__center status-${company.status}`}>
            <div className="splash-hud__label">Company Health</div>
            <div className="splash-hud__score">{company.score}</div>
            <div className="splash-hud__status">{company.status.toUpperCase()}</div>
          </div>
        </div>
      </div>

      {selectedBranch && selectedDivision && selectedDepartment && selectedTeam ? (
        <div
          ref={driversRef}
          className={`splash-hud__side ${pulseDrivers ? 'hud-panel-pulse' : ''}`}
        >
          <HudSidePanel
            company={company}
            branch={selectedBranch}
            division={selectedDivision}
            department={selectedDepartment}
            team={selectedTeam}
            showDependencies={showDependencies}
            onlyAlerted={onlyAlerted}
            explodeAll={explodeAll}
            pressureMode={pressureMode}
            showSecondaryPressure={showSecondaryPressure}
            showCrossRingTicks={showCrossRingTicks}
            showArrowsExplain={showArrowsExplain}
            onToggleDependencies={() => setShowDependencies((prev) => !prev)}
            onToggleAlerted={() => setOnlyAlerted((prev) => !prev)}
            onToggleExplodeAll={() => setExplodeAll((prev) => !prev)}
            onTogglePressureMode={() => setPressureMode((prev) => !prev)}
            onToggleSecondaryPressure={() => setShowSecondaryPressure((prev) => !prev)}
            onToggleCrossRingTicks={() => setShowCrossRingTicks((prev) => !prev)}
            onToggleArrowsExplain={() => setShowArrowsExplain((prev) => !prev)}
            panelTab={panelTab}
            onChangePanelTab={setPanelTab}
            showAdvanced={showAdvanced}
            onToggleAdvanced={() => setShowAdvanced((prev) => !prev)}
            dependsOnLine={dependsOnLine}
            strongestLine={strongestLine}
            onRootCause={handleRootCauseJump}
            dependencyHeadline={dependencyHeadline}
            remainingDependencies={remainingEdges.map((edge) => ({
              name: org.nodesById[edge.toId]?.name ?? edge.toId,
              weight: edge.weight,
            }))}
            landingLine={landingLine}
            upstream={upstream}
          />
        </div>
      ) : null}

      {hoverInfo ? (
        <HudTooltip node={org.nodesById[hoverInfo.nodeId]} x={hoverInfo.x} y={hoverInfo.y} />
      ) : null}
    </div>
  )
}
