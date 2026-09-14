import { pathToFileURL } from "node:url"
import type Stripe from "stripe"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createAdminClient } from "../../src/lib/supabase/admin"
import { verifyPayPalPriorPaidMembership } from "../../src/lib/paypal/prior-paid-history"
import { readPayPalTrialRuntime } from "../../src/lib/paypal/trial-runtime"
import { isTestMarkedBillingSubscriptionRow } from "../../src/lib/billing/entitlements"
import { findBillingSubscriptionByProviderId } from "../../src/lib/billing/subscriptions"
import { recordPriorPaidMembershipHistory } from "../../src/lib/billing/trial-prior-paid-history"
import { getStripe } from "../../src/lib/stripe/client"
import { readTrialRuntime, type TrialRuntime } from "../../src/lib/billing/trial-runtime"
import {
  reconcileStripePriorPaidMembership,
  StripePaidHistoryReviewRequired,
} from "../../src/lib/stripe/trial-prior-paid-history"

export function parseTrialHistoryBackfillArguments(argv: string[]) {
  const options = new Map<string, string>()
  for (const arg of argv) {
    const match = /^(--provider|--after|--limit|--subscription|--from|--to)=(.+)$/.exec(arg)
    if (["--apply", "--list"].includes(arg) && !options.has(arg)) options.set(arg, "true")
    else if (match && !options.has(match[1]!)) options.set(match[1]!, match[2]!)
    else throw new Error("Use --provider=stripe [--limit=20] [--after=in_cursor] [--apply]")
  }
  if (options.get("--provider") === "paypal") {
    const limit = Number(options.get("--limit") ?? "20"),
      after = options.get("--after")
    if (options.has("--list")) {
      if (
        [...options.keys()].some(
          (key) => !["--provider", "--list", "--limit", "--after"].includes(key),
        ) ||
        !Number.isSafeInteger(limit) ||
        limit < 1 ||
        limit > 100 ||
        (after && !/^[0-9a-f-]{36}$/i.test(after))
      )
        throw new Error("Invalid PayPal inventory page")
      return { provider: "paypal" as const, action: "list" as const, limit, after, apply: false }
    }
    const subscriptionId = options.get("--subscription"),
      from = options.get("--from"),
      to = options.get("--to")
    if (
      [...options.keys()].some(
        (key) => !["--provider", "--subscription", "--from", "--to", "--apply"].includes(key),
      ) ||
      !subscriptionId ||
      !/^I-[A-Z0-9]+$/.test(subscriptionId) ||
      !from ||
      !to ||
      !Number.isFinite(Date.parse(from)) ||
      !Number.isFinite(Date.parse(to)) ||
      Date.parse(to) <= Date.parse(from) ||
      Date.parse(to) - Date.parse(from) > 31 * 86400000 ||
      Date.parse(to) > Date.now()
    )
      throw new Error("Use a PayPal subscription and bounded past --from/--to window")
    return {
      provider: "paypal" as const,
      action: "window" as const,
      subscriptionId,
      from,
      to,
      apply: options.has("--apply"),
    }
  }
  if (
    options.get("--provider") !== "stripe" ||
    [...options.keys()].some(
      (key) => !["--provider", "--after", "--limit", "--apply"].includes(key),
    )
  )
    throw new Error("Choose --provider=stripe or --provider=paypal")
  const limit = Number(options.get("--limit") ?? "20")
  const after = options.get("--after")
  if (
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > 100 ||
    (after && !/^in_[A-Za-z0-9_]+$/.test(after))
  )
    throw new Error("Invalid bounded page or cursor")
  return { provider: "stripe" as const, apply: options.has("--apply"), limit, after }
}

/** One bounded provider page; safe output contains counts and opaque review IDs only. */
export async function runTrialHistoryBackfill(
  argv: string[],
  deps: {
    stripe?: Stripe
    supabase: SupabaseClient
    runtime?: TrialRuntime | null
    paypalRuntime?: ReturnType<typeof readPayPalTrialRuntime>
    verifyPayPal?: typeof verifyPayPalPriorPaidMembership
    recordHistory?: typeof recordPriorPaidMembershipHistory
    reconcile?: typeof reconcileStripePriorPaidMembership
  },
) {
  const options = parseTrialHistoryBackfillArguments(argv)
  const runtime = deps.runtime === undefined ? readTrialRuntime() : deps.runtime
  if (!runtime) throw new Error("Trial identity processing is not approved/configured")
  if (options.provider === "paypal") {
    const paypal = deps.paypalRuntime === undefined ? readPayPalTrialRuntime() : deps.paypalRuntime
    if (!paypal || paypal.trial.livemode !== runtime.livemode)
      throw new Error("PayPal history runtime is unavailable")
    if (options.action === "list") {
      let query = deps.supabase
        .from("billing_subscriptions")
        .select("id,provider_subscription_id")
        .eq("provider", "paypal")
        .order("id")
        .limit(options.limit + 1)
      if (options.after) query = query.gt("id", options.after)
      const { data, error } = await query
      if (error || !Array.isArray(data))
        throw new Error("PayPal canonical history inventory unavailable")
      const hasMore = data.length > options.limit,
        rows = data.slice(0, options.limit)
      return {
        provider: "paypal",
        mode: "inventory",
        rows,
        hasMore,
        nextCursor: hasMore ? rows.at(-1)!.id : null,
        pageComplete: true,
      }
    }
    const billing = await findBillingSubscriptionByProviderId(
      deps.supabase,
      "paypal",
      options.subscriptionId,
    )
    if (billing && isTestMarkedBillingSubscriptionRow(billing))
      return {
        provider: "paypal",
        mode: options.apply ? "apply" : "dry-run",
        subscriptionId: options.subscriptionId,
        status: "excluded_test",
        excludedTest: 1,
        payments: 0,
        pageComplete: true,
        nextCursor: null,
      }
    if (!billing?.user_id || !billing.provider_customer_id)
      throw new Error("PayPal canonical owner requires review")
    const owner = await deps.supabase.auth.admin.getUserById(billing.user_id)
    if (
      owner.error ||
      owner.data.user?.id !== billing.user_id ||
      !owner.data.user.email_confirmed_at ||
      !owner.data.user.email
    )
      throw new Error("PayPal verified owner requires review")
    const proof = await (deps.verifyPayPal ?? verifyPayPalPriorPaidMembership)({
      subscriptionId: options.subscriptionId,
      expectedPayerId: billing.provider_customer_id,
      expectedAppId: paypal.appId,
      from: options.from,
      to: options.to,
    })
    if (
      !proof.complete ||
      proof.agreementId !== options.subscriptionId ||
      proof.providerCustomerId !== billing.provider_customer_id ||
      proof.from !== options.from ||
      proof.to !== options.to
    )
      throw new Error("PayPal bounded history proof mismatch")
    if (options.apply)
      for (const payment of proof.payments)
        await (deps.recordHistory ?? recordPriorPaidMembershipHistory)(deps.supabase, {
          runtime,
          source: { provider: "paypal", agreementId: proof.agreementId },
          userId: billing.user_id,
          verifiedEmail: owner.data.user.email,
          amountMinor: payment.amountMinor,
          paidAt: new Date(payment.occurredAt),
          paymentIdentity: {
            kind: "paypal_payer",
            namespace: `${paypal.appId}:${runtime.livemode ? "live" : "test"}`,
            value: proof.providerCustomerId,
          },
        })
    return {
      provider: "paypal",
      mode: options.apply ? "apply" : "dry-run",
      subscriptionId: proof.agreementId,
      from: proof.from,
      to: proof.to,
      subscriptionCreatedAt: proof.subscriptionCreatedAt,
      payments: proof.payments.length,
      excludedTest: 0,
      pageComplete: true,
      nextWindowFrom: proof.to,
    }
  }
  if (!deps.stripe) throw new Error("Stripe history client unavailable")
  const account = await deps.stripe.accounts.retrieve(null)
  if (account.id !== runtime.stripeAccountId) throw new Error("Stripe runtime merchant mismatch")
  const page = await deps.stripe.invoices.list({
    status: "paid",
    limit: options.limit,
    ...(options.after ? { starting_after: options.after } : {}),
  })
  if (
    !Array.isArray(page.data) ||
    typeof page.has_more !== "boolean" ||
    page.data.length > options.limit ||
    (page.has_more && page.data.length === 0) ||
    new Set(page.data.map((invoice) => invoice.id)).size !== page.data.length ||
    page.data.some(
      (invoice) => !/^in_[A-Za-z0-9_]+$/.test(invoice.id) || invoice.livemode !== runtime.livemode,
    )
  )
    throw new Error("Stripe history page requires reconciliation")
  let verified = 0,
    skipped = 0,
    excludedTest = 0,
    payments = 0,
    cardPayments = 0
  const review: { invoiceId: string; reason: string }[] = []
  for (const invoice of page.data) {
    try {
      const result = await (deps.reconcile ?? reconcileStripePriorPaidMembership)(
        { invoiceId: invoice.id, apply: options.apply },
        { stripe: deps.stripe, supabase: deps.supabase, runtime },
      )
      if (result.status === "processing_disabled")
        throw new Error("History processing configuration changed")
      if (result.status === "excluded_test") excludedTest++
      else if (result.status === "not_paid_membership") skipped++
      else {
        verified++
        payments += result.payments
        cardPayments += result.cardPayments
      }
    } catch (error) {
      if (!(error instanceof StripePaidHistoryReviewRequired)) throw error
      review.push({ invoiceId: invoice.id, reason: error.reason })
    }
  }
  return {
    provider: "stripe",
    mode: options.apply ? "apply" : "dry-run",
    merchantId: runtime.stripeAccountId,
    livemode: runtime.livemode,
    examined: page.data.length,
    verified,
    skipped,
    excludedTest,
    payments,
    cardPayments,
    review,
    pageComplete: review.length === 0,
    hasMore: page.has_more,
    nextCursor: page.has_more ? page.data.at(-1)!.id : null,
  }
}

async function main() {
  // Validate before constructing configured clients. Secrets remain inside their
  // established server clients; this command never prints them or raw identities.
  const options = parseTrialHistoryBackfillArguments(process.argv.slice(2))
  const result = await runTrialHistoryBackfill(process.argv.slice(2), {
    ...(options.provider === "stripe" ? { stripe: getStripe() } : {}),
    supabase: createAdminClient(),
  })
  console.log(JSON.stringify(result, null, 2))
  if (!result.pageComplete) process.exitCode = 2
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main().catch(() => {
    console.error(
      "Trial history page failed; no completion checkpoint was issued. Re-run the same page after resolving service configuration or provider/storage failure.",
    )
    process.exitCode = 1
  })
