import type { BillingInterval } from "@/lib/stripe/intervals"

export type AnalyticsValue = string | number | boolean | null | string[] | number[] | boolean[]
export type AnalyticsPayload = Record<string, AnalyticsValue | undefined>

export type AppEventMap = {
  chat_product_recommendation_shown: {
    productCount: number
  }
  checkout_started: {
    interval?: BillingInterval | null
    leadId?: string | null
    provider: "stripe" | "paypal"
    source: "pricing_page" | "quiz_result_offer"
  }
  first_chat_message: Record<string, never>
  onboarding_completed: {
    userId: string
  }
  pricing_viewed: {
    leadId?: string | null
    source: "pricing_page" | "quiz_result_offer_pricing"
  }
  purchase_completed: {
    checkoutSessionId: string
    currency: string
    interval: string
    planId: string
    paymentMethodType?: string
    value: number
  }
  quiz_completed: {
    hairTexture?: string
    leadId?: string | null
    scalpCondition?: string | null
    scalpType?: string | null
    thickness?: string
  }
  quiz_goals_selected: {
    count: number
  }
  quiz_lead_captured: {
    leadId: string
    marketingConsent: boolean
  }
  quiz_started: {
    stepName: string
    stepNumber: number
  }
  quiz_step_viewed: {
    stepName: string
    stepNumber: number
  }
  result_page_viewed: {
    leadId: string
  }
  result_shared: {
    leadId?: string | null
    method: "copy_link" | "native" | "open_result"
    source: "public_result" | "quiz_result"
  }
  subscription_started: {
    checkoutSessionId: string
  }
}

export type AppEventName = keyof AppEventMap

export type AppEventPayload<E extends AppEventName = AppEventName> = AppEventMap[E]
