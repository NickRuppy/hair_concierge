import type { BillingInterval } from "@/lib/stripe/intervals"

export type AnalyticsValue = string | number | boolean | null | string[] | number[] | boolean[]
export type AnalyticsPayload = Record<string, AnalyticsValue | undefined>

export type FunnelAnalyticsEnvelope = {
  funnelEventId?: string | null
  funnelSessionId?: string | null
  funnelPackageKey?: string | null
}

export type OfferEntryContext =
  | "quiz_completion"
  | "saved_result"
  | "routine_return"
  | "result_email"
export type CheckoutContext = "membership_reactivation"
export type CheckoutPresentation = "inline" | "overlay"
export type CheckoutStartTrigger = "automatic_mount" | "explicit_provider_action"

export type OfferAnalyticsContext = FunnelAnalyticsEnvelope & {
  conditionerModuleId?: string | null
  entryContext: OfferEntryContext
  focusRoutine: boolean
  leadId?: string | null
  needLane?: string | null
  offerRevision: string
  offerVariant: string
  offerViewId: string
  shampooModuleId?: string | null
  suggestedCategory?: string | null
}

export type OfferSectionId =
  | "hero"
  | "personalized_analysis"
  | "personal_plan_diagnosis"
  | "personal_plan_complete_plan"
  | "personal_plan_method"
  | "personal_plan_before_after"
  | "personal_plan_survey"
  | "founder_letter"
  | "mini_routine"
  | "locked_routine"
  | "unlock_explanation"
  | "product_story_chat"
  | "product_story_chat_answer"
  | "product_story_routine"
  | "product_story_products"
  | "testimonials"
  | "subscription_explanation"
  | "pricing"
  | "guarantee"
  | "faq"
  | "final_cta"

export type OfferCtaId =
  | "sticky_header"
  | "analysis_continue"
  | "routine_continue"
  | "support_continue"
  | "locked_plan"
  | "pricing_primary"
  | "change_plan"
  | "final"

export type OfferEngagementReason = "cta_clicked" | "faq_opened" | "section_depth"

export type OfferChapterId = "analysis" | "routine" | "support" | "pricing"
export type OfferDetailType = "analysis_marker" | "routine_product" | "locked_routine_card"

export type CheckoutFailureStage =
  | "configuration"
  | "duplicate_access"
  | "provider_intent"
  | "provider_session"
  | "provider_approval"

export function claimCheckoutFailure(
  seen: Set<string>,
  checkoutAttemptId: string,
  provider: "stripe" | "paypal",
  failureStage: CheckoutFailureStage,
  errorCode: string,
) {
  const key = [checkoutAttemptId, provider, failureStage, errorCode].join(":")
  if (seen.has(key)) return false
  seen.add(key)
  return true
}

export type OfferCommerceProperties = {
  currency: string
  interval: BillingInterval
  planId: string
  value: number
}

export type AppEventMap = {
  chat_product_recommendation_shown: {
    productCount: number
  }
  checkout_start_failed: OfferAnalyticsContext &
    OfferCommerceProperties & {
      checkoutAttemptId: string
      errorCode: string
      failureStage: CheckoutFailureStage
      provider: "stripe" | "paypal"
      retryable: boolean
    }
  // Technical prewarm telemetry only. This intentionally carries no funnel,
  // checkout-attempt, customer, or marketing attribution identifiers.
  checkout_prepared: {
    interval: BillingInterval
    planId: string
    preparationDurationMs: number
    preparationId: string
    walletAvailable: boolean
  }
  checkout_started: FunnelAnalyticsEnvelope &
    Partial<OfferAnalyticsContext> & {
      checkoutAttemptId?: string
      checkoutContext?: CheckoutContext
      checkoutPresentation?: CheckoutPresentation
      checkoutStartTrigger?: CheckoutStartTrigger
      currency?: string
      interval?: BillingInterval | null
      leadId?: string | null
      planId?: string
      provider: "stripe" | "paypal"
      source: "pricing_page" | "quiz_result_offer"
      value?: number
    }
  first_chat_message: Record<string, never>
  onboarding_completed: {
    userId: string
  }
  offer_chapter_revealed: OfferAnalyticsContext & {
    chapterId: OfferChapterId
    chapterIndex: 1 | 2 | 3 | 4
    revealGeneration: number
  }
  offer_checkout_opened: OfferAnalyticsContext &
    OfferCommerceProperties & {
      availableProviders: string[]
      checkoutAttemptId: string
      checkoutPresentation: CheckoutPresentation
      openIndex: number
    }
  offer_cta_clicked: OfferAnalyticsContext & {
    ctaId: OfferCtaId
    destination: string
    interactionIndex: number
    selectedInterval?: BillingInterval
    sourceSection: OfferSectionId
  }
  offer_detail_opened: OfferAnalyticsContext & {
    detailId: string
    detailIndex: number
    detailInteractionIndex: number
    detailType: OfferDetailType
    sourceSection: OfferSectionId
  }
  offer_engaged: OfferAnalyticsContext & {
    distinctSectionCount: number
    reason: OfferEngagementReason
    sourceSection?: OfferSectionId
  }
  offer_faq_opened: OfferAnalyticsContext & {
    faqId: string
    faqIndex: number
    openIndex?: number
  }
  offer_payment_method_selected: OfferAnalyticsContext &
    OfferCommerceProperties & {
      checkoutAttemptId: string
      paymentMethodType?: "apple_pay" | "payment_element"
      provider: "stripe" | "paypal"
      selectionIndex: number
    }
  offer_plan_selected: OfferAnalyticsContext &
    OfferCommerceProperties & {
      isDefault: boolean
      previousInterval: BillingInterval
      selectionIndex: number
    }
  offer_section_viewed: OfferAnalyticsContext & {
    sectionId: OfferSectionId
    sectionIndex: number
  }
  offer_viewed: FunnelAnalyticsEnvelope & Partial<OfferAnalyticsContext>
  pricing_viewed: FunnelAnalyticsEnvelope &
    Partial<OfferAnalyticsContext> & {
      availableIntervals?: string[]
      checkoutContext?: CheckoutContext
      leadId?: string | null
      offerRevision?: string
      offerVariant?: string
      offerViewId?: string
      pricingRevision?: string
      selectedInterval?: BillingInterval
      source: "pricing_page" | "quiz_result_offer_pricing"
    }
  purchase_completed: FunnelAnalyticsEnvelope & {
    checkoutSessionId: string
    currency: string
    interval: string
    planId: string
    paymentMethodType?: string
    value: number
  }
  personal_plan_quiz_screen_viewed: {
    quizVersion: "v2"
    screenId: string
    sectionId: string
  }
  personal_plan_result_reveal_completed: {
    leadId: string
    stepCount: number
  }
  personal_plan_result_reveal_step_viewed: {
    daysFromStart: number
    leadId: string
    stepIndex: number
  }
  quiz_completed: FunnelAnalyticsEnvelope & {
    hairLength?: string
    hairTexture?: string
    leadId?: string | null
    scalpCondition?: string | null
    scalpType?: string | null
    thickness?: string
  }
  quiz_goals_selected: {
    count: number
  }
  quiz_lead_captured: FunnelAnalyticsEnvelope & {
    leadId: string
    marketingConsent: boolean
  }
  quiz_started: FunnelAnalyticsEnvelope & {
    stepName: string
    stepNumber: number
  }
  quiz_step_viewed: {
    stepName: string
    stepNumber: number
  }
  subscription_started: {
    checkoutSessionId: string
  }
}

export type AppEventName = keyof AppEventMap

export type AppEventPayload<E extends AppEventName = AppEventName> = AppEventMap[E]
