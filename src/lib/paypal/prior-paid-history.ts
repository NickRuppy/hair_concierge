import { isTestMarkedBillingSubscriptionRow } from "../billing/entitlements"
import { findBillingSubscriptionByProviderId } from "../billing/subscriptions"
import "server-only"
import { getPayPalAppId } from "./client"
import { retrievePayPalTrialSubscription, listPayPalTrialTransactions } from "./trial-runtime"

export type PayPalPriorPaidHistoryInput = {
  subscriptionId: string
  expectedPayerId: string
  expectedAppId: string
  from: string
  to: string
}
export type PayPalPriorPaidHistoryResult = {
  provider: "paypal"
  providerCustomerId: string
  agreementId: string
  subscriptionCreatedAt: string
  from: string
  to: string
  complete: true
  payments: Array<{ id: string; occurredAt: string; amountMinor: number; currency: "EUR" }>
}
/** Read-only bounded provider proof. The shared backfill pipeline owns authenticated user identity and claim writes. */
export async function verifyPayPalPriorPaidMembership(
  input: PayPalPriorPaidHistoryInput,
  deps: {
    attestApp?: typeof getPayPalAppId
    retrieve?: typeof retrievePayPalTrialSubscription
    transactions?: typeof listPayPalTrialTransactions
  } = {},
): Promise<PayPalPriorPaidHistoryResult> {
  const from = Date.parse(input.from),
    to = Date.parse(input.to)
  if (
    !input.subscriptionId ||
    !input.expectedPayerId ||
    !input.expectedAppId ||
    !Number.isFinite(from) ||
    !Number.isFinite(to) ||
    to <= from ||
    to - from > 31 * 86400000 ||
    to > Date.now()
  )
    throw new Error("PayPal history requires a bounded past window")
  if ((await (deps.attestApp ?? getPayPalAppId)()) !== input.expectedAppId)
    throw new Error("PayPal history app mismatch")
  const subscription = await (deps.retrieve ?? retrievePayPalTrialSubscription)(
    input.subscriptionId,
  )
  if (
    subscription.id !== input.subscriptionId ||
    subscription.subscriber?.payer_id !== input.expectedPayerId ||
    !Number.isFinite(Date.parse(subscription.create_time ?? ""))
  )
    throw new Error("PayPal history agreement owner mismatch")
  const transactions = await (deps.transactions ?? listPayPalTrialTransactions)(
    input.subscriptionId,
    input.from,
    input.to,
  )
  const payments: PayPalPriorPaidHistoryResult["payments"] = [],
    seen = new Set<string>()
  for (const t of transactions) {
    if (t.status !== "COMPLETED") continue
    const gross = t.amount_with_breakdown?.gross_amount,
      time = Date.parse(t.time ?? "")
    if (
      !t.id ||
      seen.has(t.id) ||
      !Number.isFinite(time) ||
      time < from ||
      time > to ||
      gross?.currency_code !== "EUR" ||
      !/^\d+(\.\d{1,2})?$/.test(gross.value ?? "")
    )
      throw new Error("PayPal history payment requires reconciliation")
    seen.add(t.id)
    const amountMinor = Math.round(Number(gross!.value) * 100)
    if (!Number.isSafeInteger(amountMinor)) throw new Error("PayPal history payment amount invalid")
    if (amountMinor > 0)
      payments.push({
        id: t.id,
        occurredAt: new Date(time).toISOString(),
        amountMinor,
        currency: "EUR",
      })
  }
  return {
    provider: "paypal",
    providerCustomerId: input.expectedPayerId,
    agreementId: input.subscriptionId,
    subscriptionCreatedAt: new Date(subscription.create_time!).toISOString(),
    from: input.from,
    to: input.to,
    complete: true,
    payments,
  }
}

/** Legacy sale callbacks continuously backfill strong claims once the reviewed trial identity runtime is configured. */
export async function recordLegacyPayPalPaidMembershipHistory(
  input: {
    subscriptionId: string
    userId: string
    expectedPayerId: string
    saleId: string
    saleAt: string
  },
  deps: {
    supabase: import("@supabase/supabase-js").SupabaseClient
    runtime?: import("./trial-checkout").PayPalTrialRuntime
    attestApp?: typeof getPayPalAppId
    retrieve?: typeof retrievePayPalTrialSubscription
    transactions?: typeof listPayPalTrialTransactions
  },
) {
  const { readPayPalTrialRuntime } = await import("./trial-runtime")
  const runtime = deps.runtime ?? readPayPalTrialRuntime()
  if (!runtime) return
  const billing = await findBillingSubscriptionByProviderId(
    deps.supabase,
    "paypal",
    input.subscriptionId,
  )
  if (
    !billing ||
    billing.user_id !== input.userId ||
    billing.provider_customer_id !== input.expectedPayerId
  )
    throw new Error("PayPal paid history canonical owner mismatch")
  if (isTestMarkedBillingSubscriptionRow(billing)) return
  const { data, error } = await deps.supabase.auth.admin.getUserById(input.userId)
  if (error || !data.user || data.user.id !== input.userId)
    throw new Error("PayPal paid history authenticated owner unavailable")
  const from = new Date(Date.parse(input.saleAt) - 86400000).toISOString(),
    to = new Date(Math.min(Date.now(), Date.parse(input.saleAt) + 86400000)).toISOString()
  const proof = await verifyPayPalPriorPaidMembership(
    {
      subscriptionId: input.subscriptionId,
      expectedPayerId: input.expectedPayerId,
      expectedAppId: runtime.appId,
      from,
      to,
    },
    deps,
  )
  const payment = proof.payments.find((p) => p.id === input.saleId)
  if (!payment) throw new Error("PayPal paid history completed sale unavailable")
  const { recordPriorPaidMembershipHistory } = await import("../billing/trial-prior-paid-history")
  await recordPriorPaidMembershipHistory(deps.supabase, {
    runtime: runtime.trial,
    userId: input.userId,
    verifiedEmail: data.user.email_confirmed_at ? data.user.email : null,
    paidAt: new Date(payment.occurredAt),
    amountMinor: payment.amountMinor,
    paymentIdentity: {
      kind: "paypal_payer",
      namespace: `${runtime.appId}:${runtime.trial.livemode ? "live" : "test"}`,
      value: proof.providerCustomerId,
    },
    source: { provider: "paypal", agreementId: input.subscriptionId },
  })
}
