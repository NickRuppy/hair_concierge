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
}

export type ApplicationTransitionStepView = {
  kind: "transition"
  stepKey: string
  copyDe: string
}

export type ApplicationOuterStepView = ApplicationProductStepView | ApplicationTransitionStepView

export type ApplicationDayView = {
  dayType: ApplicationDayTypeKey
  sortOrder: number
  labelDe: string
  summaryDe: string
  cadenceDe: string | null
  steps: ApplicationOuterStepView[]
}

export type ApplicationRecoveryKind =
  | "feature_disabled"
  | "not_ready"
  | "no_active_routine"
  | "unavailable"

export type ApplicationPageView =
  | { state: "ready"; days: ApplicationDayView[]; selectedDayType?: ApplicationDayTypeKey }
  | { state: "no_complete_day"; restDay: ApplicationDayView }
  | { state: ApplicationRecoveryKind }
