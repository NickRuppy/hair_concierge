export type PersonalPlanDiagnosticDimension = {
  id: string
  title: string
  todayLabel: string
  potentialLabel: string
  todaySegments: 1 | 2 | 3
  potentialSegments: 1 | 2 | 3
  summary: string
}

export type PersonalPlanOfferModel = {
  planTitle: string
  profileLine?: string
  diagnosticRows: [
    PersonalPlanDiagnosticDimension,
    PersonalPlanDiagnosticDimension,
    PersonalPlanDiagnosticDimension,
  ]
  planFitStatement: string
}
