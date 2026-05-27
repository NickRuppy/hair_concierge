import { trackCustomerIoEvent, type CustomerIoProperties } from "@/lib/customerio-tracking"
import type { AppEventMap, AppEventName } from "../events"

function toCustomerIoPayload<E extends AppEventName>(eventName: E, payload: AppEventMap[E]) {
  switch (eventName) {
    case "chat_product_recommendation_shown": {
      const data = payload as AppEventMap["chat_product_recommendation_shown"]
      return { product_count: data.productCount }
    }
    case "checkout_started": {
      const data = payload as AppEventMap["checkout_started"]
      return {
        interval: data.interval,
        lead_id: data.leadId,
        source: data.source,
      }
    }
    case "first_chat_message":
      return {}
    case "onboarding_completed": {
      const data = payload as AppEventMap["onboarding_completed"]
      return { user_id: data.userId }
    }
    case "pricing_viewed": {
      const data = payload as AppEventMap["pricing_viewed"]
      return {
        lead_id: data.leadId,
        source: data.source,
      }
    }
    case "purchase_completed": {
      const data = payload as AppEventMap["purchase_completed"]
      return {
        checkout_session_id: data.checkoutSessionId,
        currency: data.currency.toUpperCase(),
        interval: data.interval,
        payment_method_type: data.paymentMethodType,
        plan_id: data.planId,
        value: data.value,
      }
    }
    case "quiz_completed": {
      const data = payload as AppEventMap["quiz_completed"]
      return {
        hair_texture: data.hairTexture,
        lead_id: data.leadId,
        scalp_condition: data.scalpCondition,
        scalp_type: data.scalpType,
        thickness: data.thickness,
      }
    }
    case "quiz_goals_selected": {
      const data = payload as AppEventMap["quiz_goals_selected"]
      return { count: data.count }
    }
    case "quiz_lead_captured": {
      const data = payload as AppEventMap["quiz_lead_captured"]
      return {
        lead_id: data.leadId,
        marketing_consent: data.marketingConsent,
      }
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
      return { lead_id: data.leadId }
    }
    case "result_shared": {
      const data = payload as AppEventMap["result_shared"]
      return {
        lead_id: data.leadId,
        method: data.method,
        source: data.source,
      }
    }
    case "subscription_started": {
      const data = payload as AppEventMap["subscription_started"]
      return { checkout_session_id: data.checkoutSessionId }
    }
  }
}

export const customerIoDestination = {
  track<E extends AppEventName>(eventName: E, payload: AppEventMap[E]) {
    return trackCustomerIoEvent(
      eventName,
      toCustomerIoPayload(eventName, payload) as CustomerIoProperties,
    )
  },
}
