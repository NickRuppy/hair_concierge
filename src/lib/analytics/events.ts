import type { BillingInterval } from "@/lib/stripe/intervals"
import type { SubscriptionPricingCatalog } from "@/lib/billing/pricing-catalog"
import type { EmailDeliverabilityFailure } from "@/lib/email-deliverability-shared"
import type { PersonalPlanCategory } from "@/lib/personal-plan/products/contracts"
import type { FunnelTestKind } from "@/lib/funnel/journey-kind"

export type AnalyticsValue = string | number | boolean | null | string[] | number[] | boolean[]
export type AnalyticsPayload = Record<string, AnalyticsValue | undefined>

export type FunnelAnalyticsEnvelope = {
  funnelEventId?: string | null
  funnelSessionId?: string | null
  funnelPackageKey?: string | null
  testKind?: FunnelTestKind | null
}

export type OfferEntryContext =
  | "quiz_completion"
  | "quiz_return"
  | "saved_result"
  | "routine_return"
  | "result_email"
export type CheckoutContext = "membership_reactivation"
export type CheckoutPresentation = "inline" | "overlay"
export type CheckoutStartTrigger = "automatic_mount" | "explicit_provider_action"
export type OfferPaymentOption = "apple_pay" | "paypal" | "card_and_more"
export type OfferPaymentOptionProvider = "stripe" | "paypal"

export type OfferAnalyticsContext = FunnelAnalyticsEnvelope & {
  conditionerModuleId?: string | null
  entryContext: OfferEntryContext
  focusRoutine: boolean
  isInternalTest?: boolean
  testKind?: FunnelTestKind | null
  leadId?: string | null
  needLane?: string | null
  offerRevision: string
  offerVariant: string
  offerViewId: string
  pricingCatalog?: SubscriptionPricingCatalog
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
  | "field_test_activation"
  | "partner_access_activation"
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

export type CheckoutPreparationOutcome =
  | "prepared"
  | "prepared_unusable"
  | "wallet_unavailable_or_error"
  | "prepare_failure"
  | "timeout_prepared"
  | "timeout_cold"
  | "prewarm_silent"

export type CheckoutLifecycleTransition =
  | "preparation_started"
  | "prepared_response_received"
  | "client_mounted"
  | "claimed"
  | "opened"
  | "overlay_mounted"
  | "overlay_visible"
  | "overlay_visibility_timeout"
  | "provider_load_started"
  | "provider_ready"
  | "provider_load_timeout"
  | "provider_load_error"
  | "payment_surface_selected"
  | "payment_engaged"
  | "confirm_started"
  | "confirm_failed"
  | "provider_cancelled"
  | "unexpected_navigation"
  | "dismissed"
  | "resumed"
  | "recovery_presented"
  | "recovery_started"
  | "recovery_pending"
  | "recovery_pending_access"
  | "recovery_succeeded"
  | "recovery_failed_permanent"
  | "recovery_revoked"
  | "attempt_ended"

export type CheckoutLifecycleDismissalReason =
  | "close_button"
  | "backdrop"
  | "drag_handle"
  | "escape"
  | "system_back"
  | "plan_changed"

export type CheckoutLifecycleRecoveryReason =
  | "provider_timeout"
  | "provider_load_error"
  | "prepared_checkout_unavailable"
  | "provider_locked"
  | "confirmation_failed"

export type CheckoutLifecycleFailureReason =
  | "overlay_not_visible"
  | "provider_ready_timeout"
  | "provider_load_error"
  | "provider_request_timeout"
  | "malformed_provider_response"
  | "silent_control_outcome"
  | "unexpected_route"

export type CheckoutLifecycleEndReason =
  | "customer_aborted"
  | "plan_changed"
  | "page_teardown"
  | "unexpected_navigation"

export type CheckoutLifecycleLastState = "none" | CheckoutLifecycleTransition

export type WaitlistSignupKind = "new" | "duplicate"
export type WaitlistSurveyCompletion = "completed" | "skipped"
export type WaitlistWhatsAppSurface = "thank_you"

export type PersonalPlanStage3Pass =
  | "product_capture"
  | "need_revision_review"
  | "product_decisions"
export type PersonalPlanStage3StepKey =
  | "capture_orientation"
  | "product_search"
  | "frequency"
  | "role_assignment"
  | "need_revision_review"
  | "fit_orientation"
  | "fit_decision"
  | "inventory_disposition"
  | "stage4_handoff"
export type PersonalPlanStage3SearchInteraction = "results_viewed" | "candidate_selected"
export type PersonalPlanStage3ResultCountBand = "0" | "1_3" | "4_8"
export type PersonalPlanStage3DecisionType =
  | "keep"
  | "override"
  | "plan_purchase"
  | "pending_review"
  | "uncovered"
export type PersonalPlanStage3SaveOutcome = "saved" | "retry" | "conflict"
export type PersonalPlanStage3RecoveryOperation =
  | "capture"
  | "reopen"
  | "decision"
  | "decision_batch"
  | "inventory_disposition"
  | "completion"
export type PersonalPlanStage3RecoveryOutcome =
  | "canonical_satisfied"
  | "resend_succeeded"
  | "manual_check_required"
  | "canonical_conflict"
  | "authority_changed"
  | "rate_limit_wait"
export type PersonalPlanStage3RecoveryFailurePhase =
  | "journey_access"
  | "canonical_draft"
  | "source_context"
  | "authority_facts"
  | "cas_save"
  | "response"
export type PersonalPlanStage3HandoffOutcome =
  | "ready_for_routine"
  | "ready_with_pending"
  | "ready_with_gap"
export type PersonalPlanStage3ReviewAction =
  | "accept_need_revision"
  | "reject_need_revision"
  | "keep_owned"
  | "acknowledge_override"
  | "select_replacement"
  | "keep_pending"
  | "leave_uncovered"
export type PersonalPlanStage3ReviewVerdict =
  | "ideal"
  | "supportive"
  | "mismatch"
  | "unknown"
  | "pending"
  | "unsupported"
  | "need_revision_review"
  | "inventory_disposition"
export type PersonalPlanStage3AlternativeState = "available" | "exhausted" | "not_applicable"

// Stage 4 telemetry is deliberately structural. It must never contain product,
// proposal, plan, user, profile, price, URL, or free-text data.
export type PersonalPlanStage4Surface = "routine_page" | "routine_card" | "routine_detail"
export type PersonalPlanStage4Origin = "routine_page" | "proposal" | "editor" | "sync"
export type PersonalPlanStage4RoutineVariant = "active" | "proposal" | "empty"
export type PersonalPlanStage4ChangeCountBand = "0" | "1" | "2_4" | "5_plus"
export type PersonalPlanStage4ProposalInteraction =
  | "displayed"
  | "dismissed"
  | "accepted"
  | "rejected"
export type PersonalPlanStage4EditorInteraction = "opened" | "submitted"
export type PersonalPlanStage4ItemInteraction =
  | "product_detail_opened"
  | "shop_link_opened"
  | "acquisition_declared"
export type PersonalPlanStage4Outcome = "no_change" | "conflict" | "error"

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

type MembershipCommerceProperties = {
  commerceKind?: "membership"
  currency: string
  interval: BillingInterval
  planId: string
  pricingCatalog?: SubscriptionPricingCatalog
  value: number
}

/** A one-time personal plan is deliberately not a BillingInterval. */
export type OneTimePersonalPlanCommerceProperties = {
  commerceKind: "one_time"
  currency: string
  planId: "personal_plan_once"
  purchaseKind: "personal_plan_once"
  value: number
}

export type OfferCommerceProperties =
  | MembershipCommerceProperties
  | OneTimePersonalPlanCommerceProperties

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
    pageMountToWalletReadyMs: number
    planId: string
    pricingCatalog?: SubscriptionPricingCatalog
    preparationDurationMs: number
    preparationId: string
    walletAvailable: boolean
  }
  // Technical resolved-open/prewarm telemetry only. This intentionally carries
  // no funnel, checkout-attempt, customer, or marketing attribution identifiers.
  checkout_preparation_outcome: {
    outcome: CheckoutPreparationOutcome
    waitDurationMs: number
  }
  checkout_started: FunnelAnalyticsEnvelope &
    Partial<OfferAnalyticsContext> & {
      checkoutAttemptId?: string
      checkoutContext?: CheckoutContext
      checkoutPresentation?: CheckoutPresentation
      checkoutStartTrigger?: CheckoutStartTrigger
      commerceKind?: "membership" | "one_time"
      currency?: string
      interval?: BillingInterval | null
      leadId?: string | null
      planId?: string
      pricingCatalog?: SubscriptionPricingCatalog
      provider: "stripe" | "paypal"
      purchaseKind?: "personal_plan_once"
      source: "pricing_page" | "quiz_result_offer"
      value?: number
    }
  first_chat_message: Record<string, never>
  onboarding_completed: {
    userId: string
  }
  partner_access_activated: FunnelAnalyticsEnvelope & {
    leadId: string
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
  // Diagnostic lifecycle only. It intentionally carries neither funnel nor
  // provider/session/customer identifiers beyond the app-owned attempt ID.
  offer_checkout_lifecycle: {
    checkoutAttemptId: string
    checkoutPresentation: CheckoutPresentation
    commerceKind: "one_time" | "subscription"
    dismissalReason?: CheckoutLifecycleDismissalReason
    elapsedMs: number
    endReason?: CheckoutLifecycleEndReason
    failureReason?: CheckoutLifecycleFailureReason
    lastState: CheckoutLifecycleLastState
    openIndex: number
    option?: OfferPaymentOption
    provider?: OfferPaymentOptionProvider
    recoveryReason?: CheckoutLifecycleRecoveryReason
    transition: CheckoutLifecycleTransition
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
  offer_payment_option_viewed: OfferAnalyticsContext &
    OfferCommerceProperties & {
      checkoutAttemptId: string
      option: OfferPaymentOption
      provider: OfferPaymentOptionProvider
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
      commerceKind?: "membership" | "one_time"
      currency?: string
      leadId?: string | null
      offerRevision?: string
      offerVariant?: string
      offerViewId?: string
      planId?: string
      pricingCatalog?: SubscriptionPricingCatalog
      pricingRevision?: string
      purchaseKind?: "personal_plan_once"
      selectedInterval?: BillingInterval
      source: "pricing_page" | "quiz_result_offer_pricing"
      value?: number
    }
  purchase_completed: FunnelAnalyticsEnvelope & {
    checkoutSessionId: string
    currency: string
    interval: string
    planId: string
    paymentMethodType?: string
    pricingCatalog?: SubscriptionPricingCatalog
    value: number
  }
  personal_plan_quiz_screen_viewed: FunnelAnalyticsEnvelope & {
    quizVersion: "v2"
    screenId: string
    sectionId: string
  }
  personal_plan_result_reveal_completed: {
    completionTrigger: "skip_button" | "timer"
    elapsedMs: number
    leadId: string
    scheduledDurationMs: number
    stepCount: number
    visibleStep: number
  }
  personal_plan_result_reveal_step_viewed: {
    daysFromStart: number
    leadId: string
    stepIndex: number
  }
  // Stage 3 telemetry is deliberately structural: never add raw search/product,
  // image, free-text, criterion, or profile fields to this event family.
  personal_plan_stage3_journey_started: Record<string, never>
  personal_plan_stage3_routine_opened: Record<string, never>
  personal_plan_stage3_flow_viewed: {
    pass: PersonalPlanStage3Pass
    stepKey: PersonalPlanStage3StepKey
  }
  personal_plan_stage3_search_interacted: {
    interaction: PersonalPlanStage3SearchInteraction
    resultCountBand: PersonalPlanStage3ResultCountBand
    selectedCandidatePosition?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8
  }
  personal_plan_stage3_fallback_opened: {
    stepKey: "product_search"
  }
  personal_plan_stage3_thumbnail_fallback: Record<string, never>
  personal_plan_stage3_thumbnail_total_failure: Record<string, never>
  personal_plan_stage3_decision_selected: {
    decisionType: PersonalPlanStage3DecisionType
    stepKey: "fit_decision"
  }
  personal_plan_stage3_save_outcome: {
    outcome: PersonalPlanStage3SaveOutcome
  }
  personal_plan_stage3_recovery_outcome: {
    operation: PersonalPlanStage3RecoveryOperation
    outcome: PersonalPlanStage3RecoveryOutcome
    failurePhase?: PersonalPlanStage3RecoveryFailurePhase
  }
  personal_plan_stage3_handoff: {
    outcome: PersonalPlanStage3HandoffOutcome
  }
  personal_plan_stage3_review_viewed: {
    category: PersonalPlanCategory | null
    verdict: PersonalPlanStage3ReviewVerdict
    alternativeState: PersonalPlanStage3AlternativeState
    position: number
    count: number
  }
  personal_plan_stage3_review_back: {
    category: PersonalPlanCategory
    destination: "previous_review" | "product_capture"
    position: number
    count: number
  }
  personal_plan_stage3_review_completed: { count: number }
  personal_plan_stage3_review_action: {
    category: PersonalPlanCategory | null
    verdict: PersonalPlanStage3ReviewVerdict
    action: PersonalPlanStage3ReviewAction
    position: number
    count: number
  }
  personal_plan_stage4_routine_viewed: {
    surface: "routine_page"
    variant: PersonalPlanStage4RoutineVariant
  }
  personal_plan_stage4_proposal_interacted: {
    changeCountBand: PersonalPlanStage4ChangeCountBand
    interaction: PersonalPlanStage4ProposalInteraction
    origin: "routine_page"
  }
  personal_plan_stage4_editor_interacted: {
    changeCountBand?: PersonalPlanStage4ChangeCountBand
    interaction: PersonalPlanStage4EditorInteraction
    origin: "routine_page"
  }
  personal_plan_stage4_item_interacted: {
    interaction: PersonalPlanStage4ItemInteraction
    surface: Exclude<PersonalPlanStage4Surface, "routine_page">
  }
  personal_plan_stage4_outcome: {
    origin: PersonalPlanStage4Origin
    outcome: PersonalPlanStage4Outcome
  }
  quiz_analysis_commitment: {
    choice: "ja" | "neugierig"
    leadId?: string | null
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
  quiz_email_deliverability_rejected: FunnelAnalyticsEnvelope & {
    /**
     * `precheck` = Pruefung beim Verlassen des E-Mail-Schritts,
     * `lead_submit` = Backstop im Lead-Endpunkt. Optional, weil der
     * Legacy-Funnel nur den Lead-Endpunkt kennt.
     */
    phase?: "precheck" | "lead_submit"
    reason: EmailDeliverabilityFailure
    suggestionPresent: boolean
  }
  quiz_started: FunnelAnalyticsEnvelope & {
    stepName: string
    stepNumber: number
  }
  quiz_step_viewed: {
    stepName: string
    stepNumber: number
  }
  // Scan telemetry is deliberately bounded: no product names, EANs, or free-text.
  // Product identification stays to category + verdict only.
  scan_started: Record<string, never>
  scan_decoded: {
    msToDecode: number
    format: string
  }
  scan_result_shown: {
    verdict: string
    category: string
    inCatalog: boolean
    snapshotSource: string
  }
  scan_not_found: Record<string, never>
  scan_submission_created: {
    category: string
  }
  scan_fallback_search_used: {
    trigger: string
  }
  scan_saved: {
    kind: string
    verdict: string
  }
  scan_buy_clicked: {
    verdict: string
  }
  subscription_started: {
    checkoutSessionId: string
  }
  // Waitlist events deliberately contain only bounded campaign-state properties.
  // Signup identity, survey tokens/results, and attribution remain outside analytics.
  waitlist_signup_completed: {
    signupKind: WaitlistSignupKind
  }
  waitlist_survey_completed: {
    completion: WaitlistSurveyCompletion
  }
  waitlist_whatsapp_clicked: {
    surface: WaitlistWhatsAppSurface
  }
}

export type AppEventName = keyof AppEventMap

export type AppEventPayload<E extends AppEventName = AppEventName> = AppEventMap[E]
