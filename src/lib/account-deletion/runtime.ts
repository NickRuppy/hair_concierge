import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import { readTrialEffectiveContract } from "@/lib/billing/trial-effective-contract"
import { trackCustomerIoServerEvent } from "@/lib/customerio/server"
import { reportAccountDeletionCleanupFailure } from "@/lib/observability/account-deletion"
import { cancelPayPalSubscription, retrievePayPalSubscription } from "@/lib/paypal/subscriptions"
import { PRODUCT_INTAKE_BUCKET } from "@/lib/product-intake/image-validation"
import { getStripe } from "@/lib/stripe/client"
import type { AccountDeletionDeps, WebSubscription } from "./service"

const STRIPE_ENDED = new Set(["canceled", "incomplete_expired"])
const PAYPAL_ENDED = new Set(["CANCELLED", "EXPIRED"])
/** PayPal only cancels agreements that can still bill. */
const PAYPAL_CANCELLABLE = new Set(["ACTIVE", "SUSPENDED"])

type StripeSubscriptions = {
  retrieve(id: string): Promise<{ status: string }>
  cancel(id: string, params: { prorate: boolean; invoice_now: boolean }): Promise<unknown>
}
type PayPalSubscriptions = {
  retrieve(id: string): Promise<{ status?: string }>
  cancel(id: string, reason: string): Promise<void>
}

/** A1: immediate cancellation, no proration; already-ended agreements are a no-op. */
export async function cancelWebSubscriptionWith(
  subscription: WebSubscription,
  providers: { stripe: () => StripeSubscriptions; paypal: PayPalSubscriptions },
): Promise<void> {
  if (subscription.provider === "stripe") {
    const stripe = providers.stripe()
    let current: { status: string }
    try {
      current = await stripe.retrieve(subscription.id)
    } catch (error) {
      if ((error as { code?: unknown }).code === "resource_missing") return
      throw error
    }
    if (STRIPE_ENDED.has(current.status)) return
    await stripe.cancel(subscription.id, { prorate: false, invoice_now: false })
    return
  }
  const current = await providers.paypal.retrieve(subscription.id)
  if (!PAYPAL_CANCELLABLE.has(current.status ?? "")) return
  await providers.paypal.cancel(subscription.id, "Chaarlie-Konto gelöscht")
}

async function deletePostHogPerson(distinctId: string): Promise<void> {
  const key = process.env.POSTHOG_PERSONAL_API_KEY
  if (!key) throw new Error("POSTHOG_PERSONAL_API_KEY is not set")
  const host = process.env.POSTHOG_API_HOST ?? "https://eu.posthog.com"
  const project = process.env.POSTHOG_PROJECT_ID ?? "126788"
  const response = await fetch(`${host}/api/projects/${project}/persons/bulk_delete/`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ distinct_ids: [distinctId], delete_events: true }),
    signal: AbortSignal.timeout(10_000),
  })
  if (!response.ok) throw new Error(`PostHog person deletion failed: ${response.status}`)
}

export function createAccountDeletionDeps(client: SupabaseClient): AccountDeletionDeps {
  return {
    rpc: (name, args) => client.rpc(name, args),
    async listWebSubscriptions(userId) {
      const [billing, trials] = await Promise.all([
        client
          .from("billing_subscriptions")
          .select("provider,provider_subscription_id,provider_status")
          .eq("user_id", userId)
          .in("provider", ["stripe", "paypal"]),
        client
          .from("trial_enrollments")
          .select("id")
          .eq("user_id", userId)
          .not("provider_agreement_id", "is", null),
      ])
      if (billing.error || trials.error) throw new Error("Web subscription lookup failed")
      const found = new Map<string, WebSubscription>()
      for (const row of billing.data ?? []) {
        if (STRIPE_ENDED.has(row.provider_status) || PAYPAL_ENDED.has(row.provider_status)) continue
        found.set(`${row.provider}:${row.provider_subscription_id}`, {
          provider: row.provider,
          id: row.provider_subscription_id,
        })
      }
      // A trial's effective agreement may not be mirrored yet (or was replaced by management).
      for (const trial of trials.data ?? []) {
        const contract = await readTrialEffectiveContract(client, trial.id)
        if (contract.agreementId)
          found.set(`${contract.provider}:${contract.agreementId}`, {
            provider: contract.provider,
            id: contract.agreementId,
          })
      }
      return [...found.values()]
    },
    cancelWebSubscription: (subscription) =>
      cancelWebSubscriptionWith(subscription, {
        stripe: () => getStripe().subscriptions,
        paypal: { retrieve: retrievePayPalSubscription, cancel: cancelPayPalSubscription },
      }),
    async removeStorageObjects(paths) {
      const { error } = await client.storage.from(PRODUCT_INTAKE_BUCKET).remove(paths)
      if (error) throw error
    },
    async deleteCustomerIoPerson(identifier, messageId) {
      // Customer.io Data Pipelines semantic event: deletes the person from the workspace.
      const result = await trackCustomerIoServerEvent({
        userId: identifier,
        event: "User Deleted",
        properties: {},
        messageId,
      })
      if (!result.ok) throw new Error("Customer.io person deletion failed")
    },
    deletePostHogPerson,
    reportCleanupFailure: reportAccountDeletionCleanupFailure,
  }
}
