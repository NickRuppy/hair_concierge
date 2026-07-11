import { posthog } from "@/providers/posthog-provider"
import type {
  AnalyticsPayload,
  AppEventMap,
  AppEventName,
  FunnelAnalyticsEnvelope,
} from "../events"

function cleanAnalyticsPayload(payload: AnalyticsPayload) {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined),
  ) as Record<string, NonNullable<AnalyticsPayload[string]> | null>
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
    })
    return true
  },
}
