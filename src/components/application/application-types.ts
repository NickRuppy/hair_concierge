import type {
  ApplicationDayTypeKey,
  PersonalPlanCategory,
} from "@/lib/routines/personal-plan/application/contracts"
import type { ToolShelfSlotView, ToolUseSectionView } from "@/lib/personal-plan/tools/application"

export type { ToolShelfSlotView, ToolUseSectionView }

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
  imageUrl: string | null
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
  reason: "no_product_chosen" | "catalog_unavailable"
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
  | ToolUseSectionView

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
  shelf: ApplicationShelfSlotView[]
}

export type ApplicationShelfSlotView =
  | ToolShelfSlotView
  | {
      kind: "product"
      productId: string
      productName: string
      imageUrl: string | null
      category: PersonalPlanCategory
      status: "confirmed" | "provisional"
    }
  | {
      kind: "open"
      category: PersonalPlanCategory
      categoryLabelDe: string
      reason: "no_product_chosen" | "catalog_unavailable"
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
