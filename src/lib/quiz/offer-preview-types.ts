import type {
  CanonicalBalanceTarget,
  CanonicalRepairLevel,
  CanonicalWeight,
} from "@/lib/recommendation-engine/types"
import type { HairThickness } from "@/lib/vocabulary"

import type { QuizNeedLane } from "./need-lane"

export type OfferPreviewScalpRoute = "balanced" | "oily" | "dry" | "dandruff" | "irritated"
export type OfferPreviewCleansingIntensity = "gentle" | "regular"
export type OfferPreviewCategory =
  | "shampoo"
  | "conditioner"
  | "protein_mask"
  | "moisture_mask"
  | "leave_in"
  | "oil"
  | "bondbuilder"

export interface OfferPreviewCadence {
  label: string
  qualifier?: string
}

export interface OfferPreviewNeedProfile {
  shampoo: {
    scalpRoute: OfferPreviewScalpRoute
    thickness: HairThickness
    cleansingIntensity: OfferPreviewCleansingIntensity
    cadence: OfferPreviewCadence
  }
  conditioner: {
    weight: CanonicalWeight
    balance: CanonicalBalanceTarget
    cadence: OfferPreviewCadence
  }
  extra: {
    category: Exclude<OfferPreviewCategory, "shampoo" | "conditioner">
    cadence: OfferPreviewCadence
    variant?: "general" | "curl"
  } | null
}

export interface OfferPreviewProductModule {
  key: string
  catalogProductId: string
  category: OfferPreviewCategory
  name: string
  imageUrl: string
  priority: number
  shampooFit?: {
    scalpRoutes: OfferPreviewScalpRoute[]
    thicknesses: HairThickness[]
    cleansingIntensity: OfferPreviewCleansingIntensity
  }
  conditionerFit?: {
    thicknesses: HairThickness[]
    weights: CanonicalWeight[]
    balances: CanonicalBalanceTarget[]
    repairLevels: CanonicalRepairLevel[]
  }
  approvedCopy: {
    categoryLabel: string
    productNote: string
    provenance: string
  }
}

export interface OfferPreviewProductCard {
  key: string
  category: OfferPreviewCategory
  categoryLabel: string
  name: string
  imageUrl: string
  note: string
  cadence: OfferPreviewCadence
  suggested: boolean
}

export interface OfferPreviewSignal {
  label: string
  conclusion: string
}

export interface QuizOfferPreview {
  lane: QuizNeedLane
  headline: string
  summary: string
  signals: OfferPreviewSignal[]
  needs: OfferPreviewNeedProfile
  products: OfferPreviewProductCard[]
}
