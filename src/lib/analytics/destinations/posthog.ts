import { posthog } from "@/providers/posthog-provider"
import type { AnalyticsPayload, AppEventMap, AppEventName } from "../events"

function cleanAnalyticsPayload(payload: AnalyticsPayload) {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined),
  ) as Record<string, NonNullable<AnalyticsPayload[string]> | null>
}

function toPostHogEventName<E extends AppEventName>(eventName: E, payload: AppEventMap[E]) {
  if (
    eventName === "result_shared" &&
    (payload as AppEventMap["result_shared"]).source === "quiz_result"
  ) {
    return "quiz_result_share_clicked"
  }
  return eventName
}

function toPostHogPayload<E extends AppEventName>(eventName: E, payload: AppEventMap[E]) {
  switch (eventName) {
    case "purchase_completed": {
      const data = payload as AppEventMap["purchase_completed"]
      return {
        checkoutSessionId: data.checkoutSessionId,
        currency: data.currency,
        interval: data.interval,
        paymentMethodType: data.paymentMethodType,
        planId: data.planId,
        value: data.value,
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
      return { marketing_consent: data.marketingConsent }
    }
    case "quiz_started":
    case "quiz_step_viewed": {
      const data = payload as AppEventMap["quiz_started" | "quiz_step_viewed"]
      return {
        step_name: data.stepName,
        step_number: data.stepNumber,
      }
    }
    case "result_page_viewed": {
      const data = payload as AppEventMap["result_page_viewed"]
      return { leadId: data.leadId }
    }
    case "result_shared": {
      const data = payload as AppEventMap["result_shared"]
      return {
        leadId: data.leadId,
        method: data.method,
        source: data.source,
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
    default:
      return payload as AnalyticsPayload
  }
}

export const postHogDestination = {
  track<E extends AppEventName>(eventName: E, payload: AppEventMap[E]) {
    posthog.capture(
      toPostHogEventName(eventName, payload),
      cleanAnalyticsPayload(toPostHogPayload(eventName, payload)),
    )
    return true
  },
}
