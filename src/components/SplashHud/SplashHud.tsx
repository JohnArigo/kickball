import { useEffect, useMemo, useRef, useState } from 'react'
import './SplashHud.css'
import { buildOrg } from '../../data/buildOrg'
import type { OrgData, OrgNode } from '../../data/types'
import { HudSidePanel } from './HudSidePanel'
import { HudTooltip } from './HudTooltip'
import { RadialHud, branchIdForNode, type HoverInfo } from './RadialHud'

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

const penaltyForStatus = (status: string) => {
  if (status === 'red') return 12
  if (status === 'yellow') return 6
  return 0
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
    setFocusLevel('branch')
  }

  const selectDivision = (divisionId: string) => {
    const division = org.nodesById[divisionId]
    if (!division) return
    const nextDepartment = lowestByScore(org.nodesById, division.childrenIds)
    setSelectedDivisionId(divisionId)
    if (nextDepartment) setSelectedDepartmentId(nextDepartment.id)
    setFocusLevel('division')
  }

  const selectDepartment = (departmentId: string) => {
    if (!org.nodesById[departmentId]) return
    setSelectedDepartmentId(departmentId)
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

  const upstream = showDependencies && activeNode
    ? activeNode.dependsOn
        .map((depId) => org.nodesById[depId])
        .filter(Boolean)
        .map((dep) => ({
          name: dep.name,
          status: dep.status,
          penalty: penaltyForStatus(dep.status),
        }))
        .sort((a, b) => b.penalty - a.penalty)
        .slice(0, 3)
    : []

  const strongestDependency = showDependencies && activeNode
    ? activeNode.dependsOn
        .map((depId) => org.nodesById[depId])
        .filter(Boolean)
        .map((dep) => ({ dep, penalty: penaltyForStatus(dep.status) }))
        .sort((a, b) => b.penalty - a.penalty)[0]
    : null

  const dependencyChord = strongestDependency && strongestDependency.penalty > 0
    ? {
        fromBranchId: branchIdForNode(strongestDependency.dep, org.nodesById) ?? selectedBranchId,
        toBranchId: branchIdForNode(activeNode, org.nodesById) ?? selectedBranchId,
      }
    : null

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
    <div className="splash-hud">
      <div className="splash-hud__main">
        <div className="splash-hud__radial-shell">
          <RadialHud
            org={org}
            selectedBranchId={selectedBranchId}
            selectedDivisionId={selectedDivisionId}
            selectedDepartmentId={selectedDepartmentId}
            visibleDepartmentIds={explodeAll ? undefined : visibleDepartments}
            highlightedPath={highlightedPath}
            showDependencies={showDependencies}
            dependencyChord={dependencyChord}
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
            onToggleDependencies={() => setShowDependencies((prev) => !prev)}
            onToggleAlerted={() => setOnlyAlerted((prev) => !prev)}
            onToggleExplodeAll={() => setExplodeAll((prev) => !prev)}
            onRootCause={handleRootCauseJump}
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
