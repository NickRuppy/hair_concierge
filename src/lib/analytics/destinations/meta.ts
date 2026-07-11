import {
  trackMetaCheckoutStarted,
  trackMetaLeadCaptured,
  trackMetaPricingViewed,
  trackMetaPurchaseConfirmed,
  trackMetaQuizCompleted,
  trackMetaQuizStarted,
  trackMetaQuizStepViewed,
  trackMetaSubscriptionConfirmed,
} from "@/lib/meta-pixel"
import type { AppEventMap, AppEventName } from "../events"

export const metaDestination = {
  track<E extends AppEventName>(eventName: E, payload: AppEventMap[E]) {
    switch (eventName) {
      case "checkout_started": {
        const data = payload as AppEventMap["checkout_started"]
        return trackMetaCheckoutStarted(
          data.source,
          data.interval ?? null,
          data.funnelEventId,
          data.funnelPackageKey,
        )
      }
      case "pricing_viewed": {
        const data = payload as AppEventMap["pricing_viewed"]
        return trackMetaPricingViewed(data.source, data.funnelEventId, data.funnelPackageKey)
      }
      case "purchase_completed": {
        const data = payload as AppEventMap["purchase_completed"]
        return trackMetaPurchaseConfirmed({
          contentId: data.planId,
          currency: data.currency,
          eventId: data.checkoutSessionId,
          interval: data.interval,
          paymentMethodType: data.paymentMethodType,
          value: data.value,
        })
      }
      case "quiz_completed": {
        const data = payload as AppEventMap["quiz_completed"]
        return trackMetaQuizCompleted(data.funnelEventId, data.funnelPackageKey)
      }
      case "quiz_lead_captured": {
        const data = payload as AppEventMap["quiz_lead_captured"]
        return trackMetaLeadCaptured(
          data.marketingConsent,
          data.funnelEventId,
          data.funnelPackageKey,
        )
      }
      case "quiz_started": {
        const data = payload as AppEventMap["quiz_started"]
        return trackMetaQuizStarted(
          data.stepName,
          data.stepNumber,
          data.funnelEventId,
          data.funnelPackageKey,
        )
      }
      case "quiz_step_viewed": {
        const data = payload as AppEventMap["quiz_step_viewed"]
        return trackMetaQuizStepViewed(data.stepName, data.stepNumber)
      }
      case "subscription_started": {
        const data = payload as AppEventMap["subscription_started"]
        return trackMetaSubscriptionConfirmed(data.checkoutSessionId)
      }
      default:
        return false
    }
  },
}
