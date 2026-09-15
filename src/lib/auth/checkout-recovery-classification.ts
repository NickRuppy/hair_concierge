import {
  CheckoutRecoveryError,
  type CheckoutRecoveryCode,
} from "@/lib/auth/checkout-activation-outcome"

const invalidActivationReferenceCodes = new Set([
  "checkout_session_id_missing",
  "paypal_checkout_intent_missing",
  "paypal_checkout_intent_expired",
])

const persistentProviderFailureCodes = new Set([
  "checkout_subscription_inactive",
  "checkout_subscription_expired",
  "checkout_ownership_conflict",
  "checkout_moderator_reset_cutoff",
  "checkout_user_race_unresolved",
  "checkout_reactivation_pending_binding",
  "paypal_subscription_period_missing",
  "paypal_subscription_interval_unknown",
  "paypal_subscription_plan_mismatch",
  "paypal_user_race_unresolved",
  "paypal_existing_subscription_owner_missing",
  "paypal_existing_subscription_owner_mismatch",
])

/** Maps stable provider facts to the serializable recovery contract. */
export function classifyCheckoutRecoveryError(error: unknown): CheckoutRecoveryCode | null {
  if (error instanceof CheckoutRecoveryError) return error.code
  const code = getErrorCode(error)
  if (!code) return null
  if (
    [
      "checkout_session_incomplete",
      "checkout_session_unpaid",
      "paypal_subscription_inactive",
    ].includes(code)
  )
    return "checkout_incomplete"
  if (code === "resource_missing" || invalidActivationReferenceCodes.has(code)) {
    return "activation_link_invalid"
  }
  if (persistentProviderFailureCodes.has(code)) return "trial_reconciliation_required"
  return null
}

function getErrorCode(error: unknown): string | null {
  if (typeof error !== "object" || error === null) return null
  const code = (error as { code?: unknown }).code
  return typeof code === "string" ? code : null
}
