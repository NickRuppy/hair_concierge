import type { ApplicationDayTypeKey } from "@/lib/routines/personal-plan/application/contracts"

export type ApplicationProductActionView = {
  actionKey: string
  copyDe: string
}

export type ApplicationProductStepView = {
  kind: "product"
  stepKey: string
  applicationInstanceKey: string
  productId: string
  productName: string
  categoryLabelDe: string
  purposeDe: string
  actions: ApplicationProductActionView[]
  coverageNoteDe: string | null
  status: "confirmed" | "provisional"
  provisionalReason: "product_selection" | "application_review" | null
}

export type ApplicationUnresolvedProductStepView = {
  kind: "unresolved_product"
  stepKey: string
  applicationInstanceKey: string
  productId: string | null
  productName: string | null
  categoryLabelDe: string
}

export type ApplicationTransitionStepView = {
  kind: "transition"
  stepKey: string
  copyDe: string
}

export type ApplicationOuterStepView =
  | ApplicationProductStepView
  | ApplicationUnresolvedProductStepView
  | ApplicationTransitionStepView

export type ApplicationDayView = {
  dayType: ApplicationDayTypeKey
  sortOrder: number
  labelDe: string
  summaryDe: string
  cadenceDe: string | null
  steps: ApplicationOuterStepView[]
  isPartial: boolean
  provisionalProductCount: number
  unresolvedProductCount: number
}

export type ApplicationRecoveryKind =
  | "feature_disabled"
  | "not_ready"
  | "no_active_routine"
  | "unavailable"

export type ApplicationRecoveryView =
  | { state: ApplicationRecoveryKind }
  | { state: "day_unavailable"; overviewHref: "/anwendung" }

export type ApplicationPageView =
  | { state: "ready"; days: ApplicationDayView[]; selectedDayType?: ApplicationDayTypeKey }
  | { state: "no_complete_day"; restDay: ApplicationDayView }
  | ApplicationRecoveryView
