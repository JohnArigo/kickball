export type FunctionId = string

export type FunctionDependencyMap = {
  name: string
  line_to: Record<FunctionId, number>
}

export type CompanyFunctionDependencies = {
  company_functions: Record<FunctionId, FunctionDependencyMap>
}

export const COMPANY_FUNCTION_IDS = [
  'branch-1',
  'branch-2',
  'branch-3',
  'branch-4',
  'branch-5',
  'branch-6',
  'branch-7',
] as const

export const DEFAULT_FUNCTION_DEPENDENCIES: CompanyFunctionDependencies = {
  company_functions: {
    'branch-1': {
      name: 'Product & Engineering',
      line_to: {
        'branch-2': 8,
        'branch-5': 6,
        'branch-6': 4,
      },
    },
    'branch-2': {
      name: 'Sales & Revenue',
      line_to: {
        'branch-1': 7,
        'branch-4': 5,
        'branch-6': 6,
      },
    },
    'branch-3': {
      name: 'Customer Success & Support',
      line_to: {
        'branch-1': 7,
        'branch-2': 6,
        'branch-5': 3,
      },
    },
    'branch-4': {
      name: 'Marketing & Brand',
      line_to: {
        'branch-2': 8,
        'branch-1': 5,
        'branch-6': 4,
      },
    },
    'branch-5': {
      name: 'Operations & Supply Chain',
      line_to: {
        'branch-1': 7,
        'branch-6': 5,
        'branch-3': 4,
      },
    },
    'branch-6': {
      name: 'Finance & Legal',
      line_to: {
        'branch-1': 7,
        'branch-2': 4,
        'branch-5': 6,
      },
    },
    'branch-7': {
      name: 'People & Culture',
      line_to: {
        'branch-1': 7,
        'branch-2': 5,
        'branch-4': 4,
      },
    },
  },
}
