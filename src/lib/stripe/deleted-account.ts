import type Stripe from "stripe"
import type { SupabaseClient } from "@supabase/supabase-js"
import { recordPostDeletionRefund } from "@/lib/account-deletion/post-deletion-refund"
import { reportDeletedAccountSubscriptionCancelled } from "@/lib/observability/account-deletion"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ENDED = new Set(["canceled", "incomplete_expired"])

async function anonymized(
  supabase: SupabaseClient,
  table: "leads" | "trial_enrollments",
  id?: string | null,
) {
  if (!id || !UUID.test(id)) return null
  const { data, error } = await supabase
    .from(table)
    .select("anonymized_at")
    .eq("id", id)
    .maybeSingle()
  if (error) throw error
  return (data as { anonymized_at?: string | null } | null)?.anonymized_at ?? null
}

/**
 * I-2: the subscription belongs to a live account after all — already bound to a billing row,
 * or paid by the Stripe customer of an existing profile (e.g. its lead was anonymized only by
 * an email match with a deleted account). Then this is not a deleted account's checkout.
 */
async function boundToLiveAccount(
  supabase: SupabaseClient,
  subscriptionId: string,
  customerId: string | null,
) {
  const billing = await supabase
    .from("billing_subscriptions")
    .select("id")
    .eq("provider", "stripe")
    .eq("provider_subscription_id", subscriptionId)
    .maybeSingle()
  if (billing.error) throw billing.error
  if (billing.data) return true
  if (!customerId) return false
  const profile = await supabase
    .from("profiles")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle()
  if (profile.error) throw profile.error
  return Boolean(profile.data)
}

/**
 * A Stripe checkout/subscription whose lead or trial enrollment belongs to an account that
 * was deleted (anonymized in place). A still billable subscription is recorded for a full
 * refund (R-a: the customer never had access), cancelled at once (no proration) and
 * reported; the caller acknowledges the event without activation, so no new account is
 * provisioned from the payer email.
 */
export async function cancelDeletedAccountStripeSubscription(
  input: {
    eventType: string
    subscriptionId: string | null
    metadata: Record<string, string> | null | undefined
  },
  deps: {
    supabase: SupabaseClient
    stripe: { subscriptions: Pick<Stripe["subscriptions"], "retrieve" | "cancel"> }
    report?: typeof reportDeletedAccountSubscriptionCancelled
    /** Test seam; production records via the service-role RPC. */
    recordRefund?: (subscriptionId: string, paymentsFrom: string) => Promise<void>
  },
): Promise<boolean> {
  // The anonymization time is the deletion time: R-a refunds only payments from then on.
  const deletedAt =
    (await anonymized(deps.supabase, "trial_enrollments", input.metadata?.trial_enrollment_id)) ??
    (await anonymized(deps.supabase, "leads", input.metadata?.lead_id))
  if (!deletedAt) return false
  if (input.subscriptionId) {
    const subscription = await deps.stripe.subscriptions.retrieve(input.subscriptionId)
    const customer = subscription.customer
    const customerId = typeof customer === "string" ? customer : (customer?.id ?? null)
    if (await boundToLiveAccount(deps.supabase, input.subscriptionId, customerId)) return false
    if (!ENDED.has(subscription.status)) {
      // Recorded before the cancel: a retried webhook finds the subscription ended.
      await (
        deps.recordRefund ??
        ((id: string, from: string) => recordPostDeletionRefund(deps.supabase, "stripe", id, from))
      )(input.subscriptionId, deletedAt)
      await deps.stripe.subscriptions.cancel(input.subscriptionId, {
        prorate: false,
        invoice_now: false,
      })
      ;(deps.report ?? reportDeletedAccountSubscriptionCancelled)({
        provider: "stripe",
        eventType: input.eventType,
      })
    }
  }
  console.info("[stripe] event for a deleted account acknowledged", { eventType: input.eventType })
  return true
}
