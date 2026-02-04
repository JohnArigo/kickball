import type { CompanyFunctionDependencies, FunctionId } from './functionDependencies'

export type DirectedDependencyEdge = {
  id: string
  fromId: FunctionId
  toId: FunctionId
  weight: number
}

export const deriveFunctionEdges = (
  dependencies: CompanyFunctionDependencies,
  selectedFunctionId: FunctionId,
): DirectedDependencyEdge[] => {
  const selected = dependencies.company_functions[selectedFunctionId]
  if (!selected) return []

  return Object.entries(selected.line_to)
    .filter(([, weight]) => weight >= 1 && weight <= 10)
    .map(([toId, weight]) => ({
      id: `${selectedFunctionId}__${toId}`,
      fromId: selectedFunctionId,
      toId,
      weight,
    }))
}
