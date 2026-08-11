import { posthog } from "@/lib/analytics/runtime/posthog"
import type {
  AnalyticsPayload,
  AppEventMap,
  AppEventName,
  FunnelAnalyticsEnvelope,
  OfferAnalyticsContext,
} from "../events"
import type { BillingInterval } from "@/lib/stripe/intervals"
import type { SubscriptionPricingCatalog } from "@/lib/billing/pricing-catalog"

function cleanAnalyticsPayload(payload: AnalyticsPayload) {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined),
  ) as Record<string, NonNullable<AnalyticsPayload[string]> | null>
}

function offerContextProperties(data: Partial<OfferAnalyticsContext>) {
  return {
    conditioner_module_id: data.conditionerModuleId,
    entry_context: data.entryContext,
    focus_routine: data.focusRoutine,
    is_internal_test: data.isInternalTest,
    test_kind: data.testKind,
    lead_id: data.leadId,
    need_lane: data.needLane,
    offer_revision: data.offerRevision,
    offer_variant: data.offerVariant,
    offer_view_id: data.offerViewId,
    pricing_catalog: data.pricingCatalog,
    shampoo_module_id: data.shampooModuleId,
    suggested_category: data.suggestedCategory,
  }
}

function commerceProperties(data: {
  commerceKind?: "membership" | "one_time"
  currency?: string
  interval?: BillingInterval | null
  planId?: string
  pricingCatalog?: SubscriptionPricingCatalog
  purchaseKind?: "personal_plan_once"
  value?: number
}) {
  return {
    commerce_kind: data.commerceKind,
    currency: data.currency,
    interval: "interval" in data ? data.interval : undefined,
    plan_id: data.planId,
    pricing_catalog: data.pricingCatalog,
    purchase_kind: "purchaseKind" in data ? data.purchaseKind : undefined,
    value: data.value,
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled PostHog analytics event: ${value}`)
}

function toPostHogPayload(eventName: AppEventName, payload: AppEventMap[AppEventName]) {
  switch (eventName) {
    case "checkout_start_failed": {
      const data = payload as AppEventMap["checkout_start_failed"]
      return {
        ...offerContextProperties(data),
        ...commerceProperties(data),
        checkout_attempt_id: data.checkoutAttemptId,
        error_code: data.errorCode,
        failure_stage: data.failureStage,
        provider: data.provider,
        retryable: data.retryable,
      }
    }
    case "checkout_prepared": {
      const data = payload as AppEventMap["checkout_prepared"]
      return {
        interval: data.interval,
        page_mount_to_wallet_ready_ms: data.pageMountToWalletReadyMs,
        plan_id: data.planId,
        pricing_catalog: data.pricingCatalog,
        preparation_duration_ms: data.preparationDurationMs,
        preparation_id: data.preparationId,
        wallet_available: data.walletAvailable,
      }
    }
    case "checkout_preparation_outcome": {
      const data = payload as AppEventMap["checkout_preparation_outcome"]
      return {
        outcome: data.outcome,
        wait_duration_ms: data.waitDurationMs,
      }
    }
    case "checkout_started": {
      const data = payload as AppEventMap["checkout_started"]
      return {
        ...offerContextProperties(data),
        ...commerceProperties(data),
        checkout_attempt_id: data.checkoutAttemptId,
        checkout_context: data.checkoutContext,
        checkout_presentation: data.checkoutPresentation,
        checkout_start_trigger: data.checkoutStartTrigger,
        leadId: data.leadId,
        provider: data.provider,
        source: data.source,
      }
    }
    case "first_chat_message":
      return payload
    case "purchase_completed": {
      const data = payload as AppEventMap["purchase_completed"]
      return {
        checkoutSessionId: data.checkoutSessionId,
        currency: data.currency,
        interval: data.interval,
        paymentMethodType: data.paymentMethodType,
        planId: data.planId,
        pricing_catalog: data.pricingCatalog,
        value: data.value,
      }
    }
    case "personal_plan_quiz_screen_viewed": {
      const data = payload as AppEventMap["personal_plan_quiz_screen_viewed"]
      return {
        quiz_version: data.quizVersion,
        screen_id: data.screenId,
        section_id: data.sectionId,
      }
    }
    case "quiz_completed": {
      const data = payload as AppEventMap["quiz_completed"]
      return {
        structure: data.hairTexture,
        thickness: data.thickness,
        scalp_type: data.scalpType,
        scalp_condition: data.scalpCondition,
      }
    }
    case "quiz_lead_captured": {
      const data = payload as AppEventMap["quiz_lead_captured"]
      return {
        lead_id: data.leadId,
        marketing_consent: data.marketingConsent,
      }
    }
    case "quiz_email_deliverability_rejected": {
      const data = payload as AppEventMap["quiz_email_deliverability_rejected"]
      return {
        reason: data.reason,
        suggestion_present: data.suggestionPresent,
        // Nur mitschicken, wenn der Aufrufer die Phase kennt. Der
        // Legacy-Funnel setzt sie nicht und soll die Property nicht bekommen.
        ...(data.phase ? { phase: data.phase } : {}),
      }
    }
    case "quiz_goals_selected":
      return payload
    case "quiz_started":
    case "quiz_step_viewed": {
      const data = payload as AppEventMap["quiz_started" | "quiz_step_viewed"]
      return {
        step_name: data.stepName,
        step_number: data.stepNumber,
      }
    }
    case "chat_product_recommendation_shown": {
      const data = payload as AppEventMap["chat_product_recommendation_shown"]
      return { productCount: data.productCount }
    }
    case "onboarding_completed": {
      const data = payload as AppEventMap["onboarding_completed"]
      return { userId: data.userId }
    }
    case "offer_checkout_opened": {
      const data = payload as AppEventMap["offer_checkout_opened"]
      return {
        ...offerContextProperties(data),
        ...commerceProperties(data),
        available_providers: data.availableProviders,
        checkout_attempt_id: data.checkoutAttemptId,
        checkout_presentation: data.checkoutPresentation,
        open_index: data.openIndex,
      }
    }
    case "offer_checkout_lifecycle": {
      const data = payload as AppEventMap["offer_checkout_lifecycle"]
      return {
        checkout_attempt_id: data.checkoutAttemptId,
        checkout_presentation: data.checkoutPresentation,
        commerce_kind: data.commerceKind,
        dismissal_reason: data.dismissalReason,
        elapsed_ms: data.elapsedMs,
        end_reason: data.endReason,
        failure_reason: data.failureReason,
        last_state: data.lastState,
        open_index: data.openIndex,
        option: data.option,
        provider: data.provider,
        recovery_reason: data.recoveryReason,
        transition: data.transition,
      }
    }
    case "offer_chapter_revealed": {
      const data = payload as AppEventMap["offer_chapter_revealed"]
      return {
        ...offerContextProperties(data),
        chapter_id: data.chapterId,
        chapter_index: data.chapterIndex,
        reveal_generation: data.revealGeneration,
      }
    }
    case "offer_cta_clicked": {
      const data = payload as AppEventMap["offer_cta_clicked"]
      return {
        ...offerContextProperties(data),
        cta_id: data.ctaId,
        destination: data.destination,
        interaction_index: data.interactionIndex,
        selected_interval: data.selectedInterval,
        source_section: data.sourceSection,
      }
    }
    case "offer_detail_opened": {
      const data = payload as AppEventMap["offer_detail_opened"]
      return {
        ...offerContextProperties(data),
        detail_id: data.detailId,
        detail_index: data.detailIndex,
        detail_interaction_index: data.detailInteractionIndex,
        detail_type: data.detailType,
        source_section: data.sourceSection,
      }
    }
    case "offer_engaged": {
      const data = payload as AppEventMap["offer_engaged"]
      return {
        ...offerContextProperties(data),
        distinct_section_count: data.distinctSectionCount,
        reason: data.reason,
        source_section: data.sourceSection,
      }
    }
    case "offer_faq_opened": {
      const data = payload as AppEventMap["offer_faq_opened"]
      return {
        ...offerContextProperties(data),
        faq_id: data.faqId,
        faq_index: data.faqIndex,
        open_index: data.openIndex,
      }
    }
    case "offer_payment_method_selected": {
      const data = payload as AppEventMap["offer_payment_method_selected"]
      return {
        ...offerContextProperties(data),
        ...commerceProperties(data),
        checkout_attempt_id: data.checkoutAttemptId,
        payment_method_type: data.paymentMethodType,
        provider: data.provider,
        selection_index: data.selectionIndex,
      }
    }
    case "offer_payment_option_viewed": {
      const data = payload as AppEventMap["offer_payment_option_viewed"]
      return {
        ...offerContextProperties(data),
        ...commerceProperties(data),
        checkout_attempt_id: data.checkoutAttemptId,
        option: data.option,
        provider: data.provider,
      }
    }
    case "offer_plan_selected": {
      const data = payload as AppEventMap["offer_plan_selected"]
      return {
        ...offerContextProperties(data),
        ...commerceProperties(data),
        is_default: data.isDefault,
        previous_interval: data.previousInterval,
        selection_index: data.selectionIndex,
      }
    }
    case "offer_section_viewed": {
      const data = payload as AppEventMap["offer_section_viewed"]
      return {
        ...offerContextProperties(data),
        section_id: data.sectionId,
        section_index: data.sectionIndex,
      }
    }
    case "offer_viewed": {
      const data = payload as AppEventMap["offer_viewed"]
      return {
        ...offerContextProperties(data),
        leadId: data.leadId,
      }
    }
    case "personal_plan_result_reveal_completed": {
      const data = payload as AppEventMap["personal_plan_result_reveal_completed"]
      return {
        completion_trigger: data.completionTrigger,
        elapsed_ms: data.elapsedMs,
        lead_id: data.leadId,
        scheduled_duration_ms: data.scheduledDurationMs,
        step_count: data.stepCount,
        visible_step: data.visibleStep,
      }
    }
    case "personal_plan_result_reveal_step_viewed": {
      const data = payload as AppEventMap["personal_plan_result_reveal_step_viewed"]
      return {
        days_from_start: data.daysFromStart,
        lead_id: data.leadId,
        step_index: data.stepIndex,
      }
    }
    case "personal_plan_stage3_flow_viewed": {
      const data = payload as AppEventMap["personal_plan_stage3_flow_viewed"]
      return { pass: data.pass, step_key: data.stepKey }
    }
    case "personal_plan_stage3_search_interacted": {
      const data = payload as AppEventMap["personal_plan_stage3_search_interacted"]
      return {
        interaction: data.interaction,
        result_count_band: data.resultCountBand,
        selected_candidate_position: data.selectedCandidatePosition,
      }
    }
    case "personal_plan_stage3_fallback_opened": {
      const data = payload as AppEventMap["personal_plan_stage3_fallback_opened"]
      return { step_key: data.stepKey }
    }
    case "personal_plan_stage3_decision_selected": {
      const data = payload as AppEventMap["personal_plan_stage3_decision_selected"]
      return { decision_type: data.decisionType, step_key: data.stepKey }
    }
    case "personal_plan_stage3_save_outcome": {
      const data = payload as AppEventMap["personal_plan_stage3_save_outcome"]
      return { outcome: data.outcome }
    }
    case "personal_plan_stage3_handoff": {
      const data = payload as AppEventMap["personal_plan_stage3_handoff"]
      return { outcome: data.outcome }
    }
    case "personal_plan_stage4_routine_viewed": {
      const data = payload as AppEventMap["personal_plan_stage4_routine_viewed"]
      return { surface: data.surface, variant: data.variant }
    }
    case "personal_plan_stage4_proposal_interacted": {
      const data = payload as AppEventMap["personal_plan_stage4_proposal_interacted"]
      return {
        change_count_band: data.changeCountBand,
        interaction: data.interaction,
        origin: data.origin,
      }
    }
    case "personal_plan_stage4_editor_interacted": {
      const data = payload as AppEventMap["personal_plan_stage4_editor_interacted"]
      return {
        change_count_band: data.changeCountBand,
        interaction: data.interaction,
        origin: data.origin,
      }
    }
    case "personal_plan_stage4_item_interacted": {
      const data = payload as AppEventMap["personal_plan_stage4_item_interacted"]
      return { interaction: data.interaction, surface: data.surface }
    }
    case "personal_plan_stage4_outcome": {
      const data = payload as AppEventMap["personal_plan_stage4_outcome"]
      return { origin: data.origin, outcome: data.outcome }
    }
    case "pricing_viewed": {
      const data = payload as AppEventMap["pricing_viewed"]
      return {
        ...offerContextProperties(data),
        ...commerceProperties(data),
        available_intervals: data.availableIntervals,
        checkout_context: data.checkoutContext,
        leadId: data.leadId,
        offer_revision: data.offerRevision,
        offer_variant: data.offerVariant,
        offer_view_id: data.offerViewId,
        pricing_revision: data.pricingRevision,
        selected_interval: data.selectedInterval,
        source: data.source,
      }
    }
    case "subscription_started":
      return payload
    case "waitlist_signup_completed": {
      const data = payload as AppEventMap["waitlist_signup_completed"]
      return { signup_kind: data.signupKind }
    }
    case "waitlist_survey_completed": {
      const data = payload as AppEventMap["waitlist_survey_completed"]
      return { completion: data.completion }
    }
    case "waitlist_whatsapp_clicked": {
      const data = payload as AppEventMap["waitlist_whatsapp_clicked"]
      return { surface: data.surface }
    }
    default:
      return assertNever(eventName)
  }
}

export const postHogDestination = {
  track<E extends AppEventName>(eventName: E, payload: AppEventMap[E]) {
    const funnel = payload as FunnelAnalyticsEnvelope
    const mapped = cleanAnalyticsPayload(toPostHogPayload(eventName, payload))
    delete mapped.funnelEventId
    delete mapped.funnelSessionId
    delete mapped.funnelPackageKey
    posthog.capture(eventName, {
      ...mapped,
      ...(funnel.funnelEventId ? { $insert_id: funnel.funnelEventId } : {}),
      ...(funnel.funnelSessionId ? { funnel_session_id: funnel.funnelSessionId } : {}),
      ...(funnel.funnelPackageKey ? { funnel_package_key: funnel.funnelPackageKey } : {}),
      ...(funnel.testKind ? { test_kind: funnel.testKind } : {}),
    })
    return true
  },
}
