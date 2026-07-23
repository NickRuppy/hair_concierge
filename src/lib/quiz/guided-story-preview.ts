import type {
  OfferPreviewCategory,
  OfferPreviewNeedProfile,
  OfferPreviewProductCard,
} from "./offer-preview-types"
import { buildGuidedStoryProductCards, deriveGuidedStoryNeedProfile } from "./guided-story-products"
import {
  rankGuidedStoryPriorities,
  type GuidedStoryPriority,
  type GuidedStoryPriorityFamily,
} from "./guided-story-priorities"
import type { QuizAnswers } from "./types"

export type GuidedStoryNeedLane = GuidedStoryPriorityFamily | "positive_foundation"

export interface GuidedStoryAnalyticsIdentity {
  needLane: GuidedStoryNeedLane
  shampooModuleId: string
  conditionerModuleId: string
  suggestedCategory: Exclude<OfferPreviewCategory, "shampoo" | "conditioner"> | null
}

export interface QuizGuidedStoryPreview {
  priorities: GuidedStoryPriority[]
  needs: OfferPreviewNeedProfile
  products: OfferPreviewProductCard[]
  analytics: GuidedStoryAnalyticsIdentity
}

export function buildQuizGuidedStoryPreview(rawAnswers: QuizAnswers): QuizGuidedStoryPreview {
  const priorities = rankGuidedStoryPriorities(rawAnswers)
  const needs = deriveGuidedStoryNeedProfile(rawAnswers, priorities)
  const products = buildGuidedStoryProductCards(rawAnswers, priorities)
  const shampoo = products.find((product) => product.category === "shampoo")
  const conditioner = products.find((product) => product.category === "conditioner")

  if (priorities.length !== 3) {
    throw new Error("guided story preview requires exactly three priorities")
  }
  if (!shampoo || !conditioner) {
    throw new Error("guided story preview requires a shampoo and conditioner foundation")
  }

  const primary = priorities[0]!
  return {
    priorities,
    needs,
    products,
    analytics: {
      needLane: primary.isFallback ? "positive_foundation" : primary.family,
      shampooModuleId: shampoo.key,
      conditionerModuleId: conditioner.key,
      suggestedCategory: needs.extra?.category ?? null,
    },
  }
}
