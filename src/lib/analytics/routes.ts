import type { AppEventName } from "./events"

type AppEventRoute = {
  customerio: boolean
  meta: boolean
  posthog: boolean
}

export const eventRoutes = {
  chat_product_recommendation_shown: { customerio: true, meta: false, posthog: true },
  checkout_started: { customerio: true, meta: true, posthog: true },
  first_chat_message: { customerio: true, meta: false, posthog: true },
  onboarding_completed: { customerio: true, meta: false, posthog: true },
  pricing_viewed: { customerio: true, meta: true, posthog: true },
  purchase_completed: { customerio: false, meta: true, posthog: true },
  quiz_completed: { customerio: true, meta: true, posthog: true },
  quiz_goals_selected: { customerio: true, meta: false, posthog: true },
  quiz_lead_captured: { customerio: false, meta: true, posthog: true },
  quiz_started: { customerio: true, meta: true, posthog: true },
  quiz_step_viewed: { customerio: true, meta: true, posthog: true },
  subscription_started: { customerio: false, meta: true, posthog: true },
} satisfies Record<AppEventName, AppEventRoute>
