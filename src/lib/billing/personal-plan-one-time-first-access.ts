import {
  findPersonalPlanOneTimeConsentById,
  type PersonalPlanOneTimeCheckoutConsentRow,
} from "./personal-plan-one-time-consents"
import { PERSONAL_PLAN_ONCE_PRODUCT_KIND, resolveOneTimePurchaseAccessState } from "./purchases"
import type { BillingOneTimePurchaseRow, SupabaseBillingClient } from "./types"

/**
 * Records the first authenticated view of the specific plan that was delivered
 * for a one-time purchase. This is evidence only: it never changes access.
 */
export async function recordPersonalPlanOneTimeFirstAccess(
  supabase: SupabaseBillingClient,
  input: { userId: string; leadId: string; at?: string },
): Promise<boolean> {
  const { data, error } = await supabase
    .from("billing_one_time_purchases")
    .select("*")
    .eq("user_id", input.userId)
    .eq("product_kind", PERSONAL_PLAN_ONCE_PRODUCT_KIND)

  if (error) throw error

  const purchases = (data as BillingOneTimePurchaseRow[] | null) ?? []
  for (const purchase of purchases) {
    const consent = await findPersonalPlanOneTimeConsentById(supabase, purchase.consent_id)
    if (!consent || !isMatchingActivePersonalPlanPurchase({ purchase, consent, input })) continue

    const { data: updated, error: updateError } = await supabase
      .from("personal_plan_one_time_checkout_consents")
      .update({ first_accessed_at: input.at ?? new Date().toISOString() })
      .eq("id", consent.id)
      .eq("user_id", input.userId)
      .eq("lead_id", input.leadId)
      .is("first_accessed_at", null)
      .select("id")
      .maybeSingle()

    if (updateError) throw updateError
    return Boolean(updated)
  }

  return false
}

function isMatchingActivePersonalPlanPurchase({
  purchase,
  consent,
  input,
}: {
  purchase: BillingOneTimePurchaseRow
  consent: PersonalPlanOneTimeCheckoutConsentRow
  input: { userId: string; leadId: string }
}): boolean {
  return (
    purchase.product_kind === PERSONAL_PLAN_ONCE_PRODUCT_KIND &&
    consent.lead_id === input.leadId &&
    consent.user_id === input.userId &&
    purchase.user_id === input.userId &&
    resolveOneTimePurchaseAccessState({ purchase, consent }) === "active"
  )
}
