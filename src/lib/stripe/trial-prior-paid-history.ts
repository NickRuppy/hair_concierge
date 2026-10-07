import "server-only"

import type Stripe from "stripe"
import type { SupabaseClient } from "@supabase/supabase-js"
import { isTestMarkedBillingSubscriptionRow } from "../billing/entitlements"
import { findBillingSubscriptionByProviderId } from "../billing/subscriptions"
import { recordPriorPaidMembershipHistory } from "../billing/trial-prior-paid-history"
import { readTrialRuntime, type TrialRuntime } from "../billing/trial-runtime"

export class StripePaidHistoryReviewRequired extends Error {
  constructor(readonly reason: "ownership" | "payment" | "provider_identity") {
    super(`Stripe paid history requires ${reason} review`)
    this.name = "StripePaidHistoryReviewRequired"
  }
}
type Dependencies = {
  stripe: Stripe
  supabase: SupabaseClient
  runtime?: TrialRuntime | null
  now?: Date
  recordHistory?: typeof recordPriorPaidMembershipHistory
}
const objectId = (value: string | { id: string } | null | undefined) =>
  typeof value === "string" ? value : (value?.id ?? null)
function requireFact(
  value: unknown,
  reason: StripePaidHistoryReviewRequired["reason"],
): asserts value {
  if (!value) throw new StripePaidHistoryReviewRequired(reason)
}
function paidAt(value: number | null | undefined, now: Date) {
  requireFact(
    Number.isSafeInteger(value) && value! > 0 && value! * 1000 <= now.getTime(),
    "payment",
  )
  return new Date(value! * 1000)
}

/**
 * Provider reads establish payment and ownership; only the final claim RPC writes.
 * Defaults to dry-run. Account-deletion/missing-owner cases require the trusted
 * rights workflow, never recovery from a charge email or unverified metadata.
 */
export async function reconcileStripePriorPaidMembership(
  input: { invoiceId: string; apply?: boolean },
  deps: Dependencies,
): Promise<{
  status: "processing_disabled" | "not_paid_membership" | "excluded_test" | "verified" | "recorded"
  payments: number
  cardPayments: number
}> {
  const runtime = deps.runtime === undefined ? readTrialRuntime() : deps.runtime
  if (!runtime) return { status: "processing_disabled", payments: 0, cardPayments: 0 }
  requireFact(/^in_[A-Za-z0-9_]+$/.test(input.invoiceId), "payment")
  const now = deps.now ?? new Date()
  const account = await deps.stripe.accounts.retrieve(null)
  requireFact(account.id === runtime.stripeAccountId, "provider_identity")
  const invoice = await deps.stripe.invoices.retrieve(input.invoiceId)
  requireFact(
    invoice.id === input.invoiceId && invoice.livemode === runtime.livemode,
    "provider_identity",
  )
  const legacy = invoice as Stripe.Invoice & { subscription?: string | { id: string } | null }
  const agreementId =
    objectId(invoice.parent?.subscription_details?.subscription) ?? objectId(legacy.subscription)
  if (!agreementId || invoice.amount_paid === 0 || invoice.status !== "paid") {
    return { status: "not_paid_membership", payments: 0, cardPayments: 0 }
  }
  requireFact(
    Number.isSafeInteger(invoice.amount_paid) &&
      invoice.amount_paid > 0 &&
      invoice.amount_remaining === 0,
    "payment",
  )
  const billing = await findBillingSubscriptionByProviderId(deps.supabase, "stripe", agreementId)
  if (billing && isTestMarkedBillingSubscriptionRow(billing))
    return { status: "excluded_test", payments: 0, cardPayments: 0 }
  requireFact(
    billing?.user_id &&
      billing.provider_customer_id &&
      billing.provider_subscription_id === agreementId,
    "ownership",
  )
  const subscription = await deps.stripe.subscriptions.retrieve(agreementId)
  requireFact(
    subscription.id === agreementId && subscription.livemode === runtime.livemode,
    "provider_identity",
  )
  requireFact(
    objectId(subscription.customer) === billing.provider_customer_id &&
      objectId(invoice.customer) === billing.provider_customer_id,
    "ownership",
  )
  const owner = await deps.supabase.auth.admin.getUserById(billing.user_id)
  requireFact(
    !owner.error &&
      owner.data.user?.id === billing.user_id &&
      owner.data.user.email_confirmed_at &&
      owner.data.user.email &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(owner.data.user.email),
    "ownership",
  )
  const verifiedEmail = owner.data.user.email
  const payments = await deps.stripe.invoicePayments.list({
    invoice: invoice.id,
    status: "paid",
    limit: 100,
  })
  requireFact(
    payments.has_more === false && payments.data.length > 0 && payments.data.length <= 100,
    "payment",
  )
  requireFact(
    new Set(payments.data.map((payment) => payment.id)).size === payments.data.length,
    "payment",
  )
  const evidence: { amountMinor: number; paidAt: Date; fingerprint?: string }[] = []
  for (const payment of payments.data) {
    requireFact(
      payment.status === "paid" &&
        payment.livemode === runtime.livemode &&
        objectId(payment.invoice) === invoice.id &&
        payment.currency === invoice.currency &&
        Number.isSafeInteger(payment.amount_paid) &&
        payment.amount_paid! > 0,
      "payment",
    )
    let charge: Stripe.Charge
    if (payment.payment.type === "payment_intent") {
      const intentId = objectId(payment.payment.payment_intent)
      requireFact(intentId, "payment")
      const intent = await deps.stripe.paymentIntents.retrieve(intentId, {
        expand: ["latest_charge"],
      })
      requireFact(
        intent.id === intentId &&
          intent.status === "succeeded" &&
          intent.livemode === runtime.livemode &&
          objectId(intent.customer) === billing.provider_customer_id &&
          intent.currency === invoice.currency &&
          Number.isSafeInteger(intent.amount_received) &&
          intent.amount_received >= payment.amount_paid!,
        "payment",
      )
      requireFact(intent.latest_charge, "payment")
      charge =
        typeof intent.latest_charge === "string"
          ? await deps.stripe.charges.retrieve(intent.latest_charge)
          : intent.latest_charge
      requireFact(objectId(charge.payment_intent) === intentId, "payment")
    } else if (payment.payment.type === "charge") {
      const chargeId = objectId(payment.payment.charge)
      requireFact(chargeId, "payment")
      charge = await deps.stripe.charges.retrieve(chargeId)
      requireFact(charge.id === chargeId, "payment")
    } else {
      // Externally recorded or manually marked paid is not a verified Stripe capture.
      throw new StripePaidHistoryReviewRequired("payment")
    }
    requireFact(
      charge.status === "succeeded" &&
        charge.paid &&
        charge.captured &&
        !charge.disputed &&
        charge.livemode === runtime.livemode &&
        objectId(charge.customer) === billing.provider_customer_id &&
        charge.currency === invoice.currency &&
        Number.isSafeInteger(charge.amount_captured) &&
        charge.amount_captured >= payment.amount_paid!,
      "payment",
    )
    // A later refund does not undo a genuinely used paid membership. Disputed
    // ownership is instead held for review; rights corrections remain available.
    const fingerprint =
      charge.payment_method_details?.type === "card"
        ? charge.payment_method_details.card?.fingerprint
        : undefined
    requireFact(
      fingerprint == null || (fingerprint.trim().length > 0 && fingerprint.length <= 1024),
      "payment",
    )
    evidence.push({
      amountMinor: payment.amount_paid!,
      paidAt: paidAt(payment.status_transitions.paid_at, now),
      ...(fingerprint ? { fingerprint } : {}),
    })
  }
  requireFact(
    evidence.reduce((sum, payment) => sum + payment.amountMinor, 0) === invoice.amount_paid,
    "payment",
  )
  // Finish verification for the entire invoice before the first write. Retrying
  // after an uncertain RPC is safe because consumed claims are idempotent.
  if (input.apply === true) {
    for (const payment of evidence)
      await (deps.recordHistory ?? recordPriorPaidMembershipHistory)(deps.supabase, {
        runtime,
        source: { provider: "stripe", agreementId },
        userId: billing.user_id,
        verifiedEmail,
        amountMinor: payment.amountMinor,
        paidAt: payment.paidAt,
        ...(payment.fingerprint
          ? {
              paymentIdentity: {
                kind: "stripe_card" as const,
                namespace: `${runtime.stripeAccountId}:${runtime.livemode ? "live" : "test"}`,
                value: payment.fingerprint,
              },
            }
          : {}),
      })
  }
  return {
    status: input.apply === true ? "recorded" : "verified",
    payments: evidence.length,
    cardPayments: evidence.filter((payment) => payment.fingerprint).length,
  }
}
