import { createHmac } from "node:crypto"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import type Stripe from "stripe"

import {
  reconcilePaymentIntegrity,
  type PaymentIntegrityCandidate,
  type PaymentIntegrityCandidateList,
  type PaymentIntegrityCommerceKind,
  type PaymentIntegrityFinding,
  type PaymentIntegrityListWindow,
  type PaymentIntegrityLocalAdapter,
  type PaymentIntegrityLocalState,
  type PaymentIntegrityMethod,
  type PaymentIntegrityMonitorFailure,
  type PaymentIntegrityOutcome,
  type PaymentIntegrityProviderAdapter,
  type PaymentIntegrityReporter,
  type PaymentIntegrityResult,
} from "@/lib/billing/payment-integrity"
import { resolvePaymentRuntime, type PaymentRuntime } from "@/lib/billing/payment-runtime-config"
import { capturePaymentFailure, type PaymentFailureReporter } from "@/lib/observability/payment"
import { getStripe } from "@/lib/stripe/client"

export type RunPaymentIntegrityInput = { now: Date; deadlineAt: Date }
export type RunPaymentIntegrity = (
  input: RunPaymentIntegrityInput,
) => Promise<PaymentIntegrityResult>

type QueryableSupabase = Pick<SupabaseClient, "from">

type StripeClient = Pick<Stripe, "checkout" | "invoices">
type StripeListResponse<T> = { data: T[]; has_more?: boolean }
type PayPalRequest = (path: string, init?: RequestInit) => Promise<unknown>

type ProviderReferenceHint = {
  provider: "stripe" | "paypal"
  commerceKind: PaymentIntegrityCommerceKind
  providerSubscriptionId?: string
  providerTransactionId?: string
  providerOrderId?: string
  userId?: string | null
  leadId?: string | null
}

type PaymentIntegrityRuntimeDeps = {
  digestSecret?: string
  paymentRuntime?: PaymentRuntime
  paypalRequest?: PayPalRequest
  reportPaymentFailure?: PaymentFailureReporter
  stripe?: StripeClient
  supabase?: QueryableSupabase
}

const DIGEST_CONTEXT = "payment-integrity-provider-reference-v1"
const STRIPE_PAGE_SIZE = 100
const PROVIDER_REQUEST_TIMEOUT_MS = 10_000
const PAYPAL_PROVIDER_CONCURRENCY = 4
const PAYPAL_RENEWAL_INVENTORY_CAP = 500
const PAYPAL_RENEWAL_EXCLUSION_REASON = "pre_cutover_rest_app"
const ACTIVE_ENTITLEMENT_STATUSES = new Set(["active", "past_due"])
const TERMINAL_ONE_TIME_PURCHASE_STATUSES = new Set(["paid", "refunded", "reversed", "disputed"])

export function createPaymentIntegrityRunner(
  deps: PaymentIntegrityRuntimeDeps = {},
): RunPaymentIntegrity {
  const paymentRuntime =
    deps.paymentRuntime ??
    resolvePaymentRuntime({
      PAYPAL_ENVIRONMENT: process.env.PAYPAL_ENVIRONMENT,
      STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
      VERCEL_ENV: process.env.VERCEL_ENV,
    })
  const supabase = deps.supabase ?? createServiceSupabaseClient()
  const stripe = deps.stripe ?? getStripe()
  const paypalRequest = deps.paypalRequest ?? defaultPayPalRequest
  const digestSecret = deps.digestSecret ?? providerReferenceDigestSecret()
  const referenceHints = new Map<string, ProviderReferenceHint>()

  const digestProviderReference = (
    provider: "stripe" | "paypal",
    commerceKind: PaymentIntegrityCommerceKind,
    reference: string,
    hint: Omit<ProviderReferenceHint, "provider" | "commerceKind"> = {},
  ): string => {
    const digest = createProviderReferenceDigest(digestSecret, provider, commerceKind, reference)
    referenceHints.set(digest, { provider, commerceKind, ...hint })
    return digest
  }

  const reporter = createPaymentIntegrityReporter({
    paymentRuntime,
    reportPaymentFailure: deps.reportPaymentFailure ?? capturePaymentFailure,
  })

  return async ({ now, deadlineAt }) =>
    reconcilePaymentIntegrity({
      now,
      deadlineAt,
      providers: [
        new StripePaymentIntegrityProvider({
          stripe,
          paymentRuntime,
          digestProviderReference,
        }),
        new PayPalPaymentIntegrityProvider({
          supabase,
          paypalRequest,
          paymentRuntime,
          digestProviderReference,
        }),
      ],
      local: new SupabasePaymentIntegrityLocalAdapter({
        supabase,
        referenceHints,
        now,
      }),
      reporter,
    })
}

export function createProviderReferenceDigest(
  secret: string,
  provider: "stripe" | "paypal",
  commerceKind: PaymentIntegrityCommerceKind,
  reference: string,
): string {
  return createHmac("sha256", secret)
    .update(DIGEST_CONTEXT)
    .update("\0")
    .update(provider)
    .update("\0")
    .update(commerceKind)
    .update("\0")
    .update(reference)
    .digest("hex")
}

export function createPaymentIntegrityReporter(input: {
  paymentRuntime: PaymentRuntime
  reportPaymentFailure?: PaymentFailureReporter
}): PaymentIntegrityReporter {
  const reportPaymentFailure = input.reportPaymentFailure ?? capturePaymentFailure

  return {
    reportFinding(finding: PaymentIntegrityFinding) {
      return reportPaymentFailure({
        signal: "payment_integrity_mismatch",
        provider: finding.provider,
        boundary: finding.boundary,
        errorFamily: finding.errorFamily,
        commerceKind: finding.commerceKind,
        origin: "reconciliation",
        method: finding.method,
        truth: finding.truth,
        live: finding.live,
        isInternalTest: finding.isInternalTest,
        userId: finding.userId,
        leadId: finding.leadId,
        checkoutAttemptId: finding.checkoutAttemptId,
        providerReferenceDigest: finding.providerReferenceDigest,
        providerReferencePresent: Boolean(finding.providerReferenceDigest),
        invariant: finding.invariant,
        retryable: "unknown",
      })
    },
    reportMonitorFailure(failure: PaymentIntegrityMonitorFailure) {
      return reportPaymentFailure({
        signal: "payment_monitor_failed",
        provider: failure.provider,
        boundary: "reconciliation",
        errorFamily: failure.errorFamily,
        commerceKind: "unknown",
        origin: "reconciliation",
        method: "unknown",
        truth: "unknown",
        live: providerLive(input.paymentRuntime, failure.provider),
        isInternalTest: false,
        status: failure.reason,
        retryable: "unknown",
      })
    },
  }
}

class StripePaymentIntegrityProvider implements PaymentIntegrityProviderAdapter {
  provider = "stripe" as const

  constructor(
    private readonly deps: {
      stripe: StripeClient
      paymentRuntime: PaymentRuntime
      digestProviderReference: (
        provider: "stripe",
        commerceKind: PaymentIntegrityCommerceKind,
        reference: string,
        hint?: Omit<ProviderReferenceHint, "provider" | "commerceKind">,
      ) => string
    },
  ) {}

  async listCandidates(window: PaymentIntegrityListWindow): Promise<PaymentIntegrityCandidateList> {
    const candidates: PaymentIntegrityCandidate[] = []
    let hasMore = false

    const sessionResult = await this.listCheckoutSessionCandidates(window)
    candidates.push(...sessionResult.candidates)
    hasMore ||= Boolean(sessionResult.hasMore || sessionResult.incomplete)

    if (candidates.length < window.limit && Date.now() < window.deadlineAt.getTime()) {
      const invoiceResult = await this.listInvoiceCandidates({
        ...window,
        limit: window.limit - candidates.length,
      })
      candidates.push(...invoiceResult.candidates)
      hasMore ||= Boolean(invoiceResult.hasMore || invoiceResult.incomplete)
    } else {
      hasMore = true
    }

    return { candidates: dedupeCandidates(candidates).slice(0, window.limit), hasMore }
  }

  private async listCheckoutSessionCandidates(
    window: PaymentIntegrityListWindow,
  ): Promise<PaymentIntegrityCandidateList> {
    const candidates: PaymentIntegrityCandidate[] = []
    let startingAfter: string | undefined
    let hasMore = false

    while (candidates.length < window.limit && Date.now() < window.deadlineAt.getTime()) {
      const remaining = window.limit - candidates.length
      const page = (await withProviderTimeout(
        this.deps.stripe.checkout.sessions.list({
          created: stripeCreatedRange(window),
          expand: ["data.payment_intent", "data.subscription"],
          limit: Math.min(STRIPE_PAGE_SIZE, remaining),
          ...(startingAfter ? { starting_after: startingAfter } : {}),
        }),
        window.deadlineAt,
      )) as unknown as StripeListResponse<Record<string, unknown>>

      for (const session of page.data) {
        const candidate = this.candidateFromCheckoutSession(session)
        if (candidate) candidates.push(candidate)
      }

      if (!page.has_more) break
      const last = page.data.at(-1)
      const lastId = stringValue(last?.id)
      if (!lastId) {
        hasMore = true
        break
      }
      if (candidates.length >= window.limit || Date.now() >= window.deadlineAt.getTime()) {
        hasMore = true
        break
      }
      startingAfter = lastId
    }

    return { candidates, hasMore }
  }

  private async listInvoiceCandidates(
    window: PaymentIntegrityListWindow,
  ): Promise<PaymentIntegrityCandidateList> {
    const candidates: PaymentIntegrityCandidate[] = []
    let startingAfter: string | undefined
    let hasMore = false

    while (candidates.length < window.limit && Date.now() < window.deadlineAt.getTime()) {
      const remaining = window.limit - candidates.length
      const page = (await withProviderTimeout(
        this.deps.stripe.invoices.list({
          created: stripeCreatedRange(window),
          limit: Math.min(STRIPE_PAGE_SIZE, remaining),
          ...(startingAfter ? { starting_after: startingAfter } : {}),
        }),
        window.deadlineAt,
      )) as unknown as StripeListResponse<Record<string, unknown>>

      for (const invoice of page.data) {
        const candidate = this.candidateFromInvoice(invoice)
        if (candidate) candidates.push(candidate)
      }

      if (!page.has_more) break
      const last = page.data.at(-1)
      const lastId = stringValue(last?.id)
      if (!lastId) {
        hasMore = true
        break
      }
      if (candidates.length >= window.limit || Date.now() >= window.deadlineAt.getTime()) {
        hasMore = true
        break
      }
      startingAfter = lastId
    }

    return { candidates, hasMore }
  }

  private candidateFromCheckoutSession(
    session: Record<string, unknown>,
  ): PaymentIntegrityCandidate | null {
    const mode = stringValue(session.mode)
    const metadata = metadataValue(session.metadata)
    const paymentIntent = objectValue(session.payment_intent)
    const subscription = objectValue(session.subscription)
    const subscriptionId = stringValue(session.subscription) ?? stringValue(subscription?.id)
    const checkoutAttemptId =
      safeInternalIdentifier(metadata.checkout_attempt_id) ??
      safeInternalIdentifier(metadata.checkout_attempt)
    const leadId = safeInternalIdentifier(metadata.lead_id)
    const userId = safeInternalIdentifier(metadata.user_id)
    const internalTest = isInternalTestMetadata(metadata)
    const occurredAt = timestampSecondsToDate(session.created)

    if (mode === "subscription" && subscriptionId) {
      const outcome = stripeCheckoutSubscriptionOutcome(session, subscription)
      if (!outcome) return null
      return {
        provider: "stripe",
        commerceKind: "subscription",
        outcome,
        occurredAt,
        checkoutAttemptId,
        providerReferenceDigest: this.deps.digestProviderReference(
          "stripe",
          "subscription",
          subscriptionId,
          { providerSubscriptionId: subscriptionId, userId, leadId },
        ),
        method: stripeMethodFromPaymentIntent(paymentIntent),
        live: this.deps.paymentRuntime.stripeLive,
        isInternalTest: internalTest,
        userId,
        leadId,
      }
    }

    if (mode === "payment" && isPersonalPlanOnce(metadata, paymentIntent)) {
      const paymentIntentId = stringValue(session.payment_intent) ?? stringValue(paymentIntent?.id)
      if (!paymentIntentId) return null
      const outcome = stripeCheckoutOneTimeOutcome(session, paymentIntent)
      if (!outcome) return null
      const sessionId = stringValue(session.id) ?? undefined
      return {
        provider: "stripe",
        commerceKind: "one_time",
        outcome,
        occurredAt,
        checkoutAttemptId,
        providerReferenceDigest: this.deps.digestProviderReference(
          "stripe",
          "one_time",
          sessionId ?? paymentIntentId,
          {
            providerTransactionId: paymentIntentId,
            providerOrderId: sessionId,
            userId,
            leadId,
          },
        ),
        method: stripeMethodFromPaymentIntent(paymentIntent),
        live: this.deps.paymentRuntime.stripeLive,
        isInternalTest: internalTest,
        userId,
        leadId,
      }
    }

    return null
  }

  private candidateFromInvoice(invoice: Record<string, unknown>): PaymentIntegrityCandidate | null {
    const subscriptionId = stripeInvoiceSubscriptionId(invoice)
    if (!subscriptionId) return null

    const outcome = stripeInvoiceOutcome(invoice)
    if (!outcome) return null
    const metadata = metadataValue(invoice.metadata)

    return {
      provider: "stripe",
      commerceKind: "subscription",
      outcome,
      occurredAt: stripeInvoiceOccurredAt(invoice),
      checkoutAttemptId: safeInternalIdentifier(metadata.checkout_attempt_id),
      providerReferenceDigest: this.deps.digestProviderReference(
        "stripe",
        "subscription",
        subscriptionId,
        {
          providerSubscriptionId: subscriptionId,
          userId: safeInternalIdentifier(metadata.user_id),
          leadId: safeInternalIdentifier(metadata.lead_id),
        },
      ),
      method: "unknown",
      live: this.deps.paymentRuntime.stripeLive,
      isInternalTest: isInternalTestMetadata(metadata),
      userId: safeInternalIdentifier(metadata.user_id),
      leadId: safeInternalIdentifier(metadata.lead_id),
    }
  }
}

class PayPalPaymentIntegrityProvider implements PaymentIntegrityProviderAdapter {
  provider = "paypal" as const

  constructor(
    private readonly deps: {
      supabase: QueryableSupabase
      paypalRequest: PayPalRequest
      paymentRuntime: PaymentRuntime
      digestProviderReference: (
        provider: "paypal",
        commerceKind: PaymentIntegrityCommerceKind,
        reference: string,
        hint?: Omit<ProviderReferenceHint, "provider" | "commerceKind">,
      ) => string
    },
  ) {}

  async listCandidates(window: PaymentIntegrityListWindow): Promise<PaymentIntegrityCandidateList> {
    const candidates: PaymentIntegrityCandidate[] = []
    let incomplete = false

    const subscriptionRows = await this.listSubscriptionIntentRows(window)
    const subscriptionScan = await mapProviderRowsWithConcurrency(
      subscriptionRows.slice(0, window.limit),
      window.deadlineAt,
      (row) => this.candidateFromSubscriptionIntent(row, window.deadlineAt),
    )
    incomplete ||= subscriptionScan.incomplete
    for (const candidate of subscriptionScan.results) {
      if (candidate) candidates.push(candidate)
    }

    if (candidates.length < window.limit && Date.now() < window.deadlineAt.getTime()) {
      const renewalCapacity = window.limit - candidates.length
      const renewalRows = await this.listLocalSubscriptionRows()
      const monitoredRenewalRows = renewalRows.filter(
        (row) => !isExcludedInternalPayPalRenewal(row),
      )
      const renewalScan = await mapProviderRowsWithConcurrency(
        monitoredRenewalRows.slice(0, renewalCapacity),
        window.deadlineAt,
        (row) => this.candidatesFromSubscriptionTransactions(row, window),
      )
      incomplete ||= renewalScan.incomplete
      for (const renewalCandidates of renewalScan.results) {
        candidates.push(...renewalCandidates.slice(0, window.limit - candidates.length))
      }
      incomplete ||= monitoredRenewalRows.length > renewalCapacity
      incomplete ||= renewalRows.length > PAYPAL_RENEWAL_INVENTORY_CAP
    } else {
      incomplete = true
    }

    if (candidates.length < window.limit && Date.now() < window.deadlineAt.getTime()) {
      const orderCapacity = window.limit - candidates.length
      const orderRows = await this.listOrderIntentRows({
        ...window,
        limit: orderCapacity,
      })
      const orderScan = await mapProviderRowsWithConcurrency(
        orderRows.slice(0, orderCapacity),
        window.deadlineAt,
        (row) => this.candidateFromOrderIntent(row, window.deadlineAt),
      )
      incomplete ||= orderScan.incomplete
      for (const candidate of orderScan.results) {
        if (candidate) candidates.push(candidate)
      }
      incomplete ||= orderRows.length > orderCapacity
    } else {
      incomplete = true
    }

    return {
      candidates: dedupeCandidates(candidates).slice(0, window.limit),
      hasMore: subscriptionRows.length > window.limit,
      incomplete,
    }
  }

  private async listSubscriptionIntentRows(window: PaymentIntegrityListWindow) {
    const { data, error } = await this.deps.supabase
      .from("paypal_checkout_intents")
      .select("provider_subscription_id, user_id, lead_id, metadata, created_at, updated_at")
      .not("provider_subscription_id", "is", null)
      .gte("created_at", window.lookbackStartedAt.toISOString())
      .lte("created_at", window.now.toISOString())
      .order("created_at", { ascending: false })
      .limit(window.limit + 1)

    if (error) throw error
    return ((data as Array<Record<string, unknown>> | null) ?? []).filter((row) =>
      stringValue(row.provider_subscription_id),
    )
  }

  private async listOrderIntentRows(window: PaymentIntegrityListWindow) {
    const { data, error } = await this.deps.supabase
      .from("paypal_order_intents")
      .select(
        "provider_order_id, provider_capture_id, checkout_attempt_id, user_id, lead_id, metadata, expires_at",
      )
      .gte("expires_at", window.lookbackStartedAt.toISOString())
      .limit(window.limit + 1)

    if (error) {
      if (isMissingPayPalOrderIntentTable(error)) return []
      throw error
    }
    return ((data as Array<Record<string, unknown>> | null) ?? []).filter(
      (row) => stringValue(row.provider_order_id) || stringValue(row.provider_capture_id),
    )
  }

  private async listLocalSubscriptionRows() {
    const { data, error } = await this.deps.supabase
      .from("billing_subscriptions")
      .select("provider_subscription_id, user_id, metadata, updated_at")
      .eq("provider", "paypal")
      .order("updated_at", { ascending: false })
      .limit(PAYPAL_RENEWAL_INVENTORY_CAP + 1)

    if (error) throw error
    return ((data as Array<Record<string, unknown>> | null) ?? []).filter((row) =>
      stringValue(row.provider_subscription_id),
    )
  }

  private async candidateFromSubscriptionIntent(
    row: Record<string, unknown>,
    deadlineAt: Date,
  ): Promise<PaymentIntegrityCandidate | null> {
    const subscriptionId = stringValue(row.provider_subscription_id)
    if (!subscriptionId) return null
    const subscription = (await withProviderTimeout(
      (signal) =>
        this.deps.paypalRequest(`/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}`, {
          signal,
        }),
      deadlineAt,
    )) as Record<string, unknown>
    const outcome = paypalSubscriptionOutcome(subscription)
    if (!outcome) return null
    const metadata = metadataValue(row.metadata)
    const userId = safeInternalIdentifier(row.user_id)
    const leadId = safeInternalIdentifier(row.lead_id)

    return {
      provider: "paypal",
      commerceKind: "subscription",
      outcome,
      occurredAt: paypalOccurredAt(subscription, row),
      providerReferenceDigest: this.deps.digestProviderReference(
        "paypal",
        "subscription",
        subscriptionId,
        {
          providerSubscriptionId: subscriptionId,
          userId,
          leadId,
        },
      ),
      method: "paypal",
      live: this.deps.paymentRuntime.paypalLive,
      isInternalTest: isInternalTestMetadata(metadata),
      userId,
      leadId,
    }
  }

  private async candidatesFromSubscriptionTransactions(
    row: Record<string, unknown>,
    window: PaymentIntegrityListWindow,
  ): Promise<PaymentIntegrityCandidate[]> {
    const subscriptionId = stringValue(row.provider_subscription_id)
    if (!subscriptionId) return []
    const response = (await withProviderTimeout(
      (signal) =>
        this.deps.paypalRequest(
          `/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}/transactions?start_time=${encodeURIComponent(window.lookbackStartedAt.toISOString())}&end_time=${encodeURIComponent(window.now.toISOString())}`,
          { signal },
        ),
      window.deadlineAt,
    )) as Record<string, unknown>
    const transactions = Array.isArray(response.transactions) ? response.transactions : []
    const metadata = metadataValue(row.metadata)
    const userId = safeInternalIdentifier(row.user_id)
    const leadId = safeInternalIdentifier(metadata.lead_id)

    const candidates: PaymentIntegrityCandidate[] = []
    for (const transaction of transactions) {
      const record = objectValue(transaction)
      if (!record) continue
      const outcome = paypalTransactionOutcome(record)
      if (!outcome) continue
      const transactionId = stringValue(record.id)
      const transactionTime = stringValue(record.time)
      const reference = transactionId ?? `${subscriptionId}:${transactionTime ?? "unknown"}`
      candidates.push({
        provider: "paypal",
        commerceKind: "subscription",
        outcome,
        occurredAt: dateOrNow(transactionTime ?? row.updated_at),
        providerReferenceDigest: this.deps.digestProviderReference(
          "paypal",
          "subscription",
          reference,
          {
            providerSubscriptionId: subscriptionId,
            userId,
            leadId,
          },
        ),
        method: "paypal",
        live: this.deps.paymentRuntime.paypalLive,
        isInternalTest: isInternalTestMetadata(metadata),
        userId,
        leadId,
      })
    }
    return candidates
  }

  private async candidateFromOrderIntent(
    row: Record<string, unknown>,
    deadlineAt: Date,
  ): Promise<PaymentIntegrityCandidate | null> {
    const orderId = stringValue(row.provider_order_id)
    const captureId = stringValue(row.provider_capture_id)
    const providerReference = captureId ?? orderId
    if (!providerReference) return null
    const order = orderId
      ? ((await withProviderTimeout(
          (signal) =>
            this.deps.paypalRequest(`/v2/checkout/orders/${encodeURIComponent(orderId)}`, {
              signal,
            }),
          deadlineAt,
        )) as Record<string, unknown>)
      : null
    const outcome = paypalOrderOutcome(order, captureId)
    if (!outcome) return null
    const metadata = metadataValue(row.metadata)
    const userId = safeInternalIdentifier(row.user_id)
    const leadId = safeInternalIdentifier(row.lead_id)

    return {
      provider: "paypal",
      commerceKind: "one_time",
      outcome,
      occurredAt: order ? paypalOccurredAt(order, row) : dateOrNow(row.expires_at),
      checkoutAttemptId: safeInternalIdentifier(row.checkout_attempt_id),
      providerReferenceDigest: this.deps.digestProviderReference(
        "paypal",
        "one_time",
        providerReference,
        {
          providerTransactionId: captureId ?? undefined,
          providerOrderId: orderId ?? undefined,
          userId,
          leadId,
        },
      ),
      method: "paypal",
      live: this.deps.paymentRuntime.paypalLive,
      isInternalTest: isInternalTestMetadata(metadata),
      userId,
      leadId,
    }
  }
}

class SupabasePaymentIntegrityLocalAdapter implements PaymentIntegrityLocalAdapter {
  constructor(
    private readonly deps: {
      supabase: QueryableSupabase
      referenceHints: Map<string, ProviderReferenceHint>
      now: Date
    },
  ) {}

  async getState(candidate: PaymentIntegrityCandidate): Promise<PaymentIntegrityLocalState> {
    const hint = candidate.providerReferenceDigest
      ? this.deps.referenceHints.get(candidate.providerReferenceDigest)
      : undefined

    if (candidate.commerceKind === "subscription") {
      return this.getSubscriptionState(candidate, hint)
    }
    return this.getOneTimeState(hint)
  }

  private async getSubscriptionState(
    candidate: PaymentIntegrityCandidate,
    hint: ProviderReferenceHint | undefined,
  ): Promise<PaymentIntegrityLocalState> {
    if (!hint?.providerSubscriptionId) {
      return { billingSucceeded: false, activeEntitlement: false }
    }

    const { data, error } = await this.deps.supabase
      .from("billing_subscriptions")
      .select("provider_status, entitlement_status, current_period_end, cancel_at_period_end")
      .eq("provider", candidate.provider)
      .eq("provider_subscription_id", hint.providerSubscriptionId)
      .maybeSingle()
    if (error) throw error

    const row = (data as Record<string, unknown> | null) ?? null
    return {
      billingSucceeded: Boolean(row),
      activeEntitlement: Boolean(
        row &&
        isActiveLocalEntitlement(
          stringValue(row.entitlement_status),
          stringValue(row.current_period_end),
          row.cancel_at_period_end === true,
          this.deps.now,
        ),
      ),
    }
  }

  private async getOneTimeState(
    hint: ProviderReferenceHint | undefined,
  ): Promise<PaymentIntegrityLocalState> {
    if (!hint?.providerTransactionId && !hint?.providerOrderId) {
      return { paidOneTimePurchase: false }
    }

    const byTransaction = hint.providerTransactionId
      ? await this.findOneTimePurchase("provider_transaction_id", hint.providerTransactionId)
      : null
    const byOrder =
      !byTransaction && hint.providerOrderId
        ? await this.findOneTimePurchase("provider_order_id", hint.providerOrderId)
        : null

    return {
      paidOneTimePurchase:
        isTerminalOneTimePurchaseStatus(byTransaction?.status) ||
        isTerminalOneTimePurchaseStatus(byOrder?.status),
    }
  }

  private async findOneTimePurchase(
    column: "provider_transaction_id" | "provider_order_id",
    value: string,
  ) {
    const { data, error } = await this.deps.supabase
      .from("billing_one_time_purchases")
      .select("status")
      .eq(column, value)
      .maybeSingle()
    if (error) throw error
    return (data as { status?: string } | null) ?? null
  }
}

function createServiceSupabaseClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false },
    },
  )
}

async function defaultPayPalRequest(path: string, init?: RequestInit): Promise<unknown> {
  const { paypalRequest } = await import("@/lib/paypal/client")
  return paypalRequest<unknown>(path, init)
}

function providerReferenceDigestSecret(): string {
  const secret =
    process.env.PAYMENT_REFERENCE_DIGEST_SECRET ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.PAYMENT_MONITOR_TRIGGER_SECRET
  if (!secret) throw new Error("Payment integrity provider-reference digest secret is not set")
  return secret
}

function providerLive(runtime: PaymentRuntime, provider: "stripe" | "paypal" | "unknown") {
  if (provider === "stripe") return runtime.stripeLive
  if (provider === "paypal") return runtime.paypalLive
  return runtime.stripeLive || runtime.paypalLive
}

function stripeCreatedRange(window: PaymentIntegrityListWindow) {
  return {
    gte: Math.floor(window.lookbackStartedAt.getTime() / 1000),
    lte: Math.floor(window.now.getTime() / 1000),
  }
}

function stripeCheckoutSubscriptionOutcome(
  session: Record<string, unknown>,
  subscription: Record<string, unknown> | null,
): PaymentIntegrityOutcome | null {
  if (session.payment_status === "paid") return "succeeded"
  const status = stringValue(subscription?.status)
  if (status === "active" || status === "trialing") return "succeeded"
  return null
}

function stripeCheckoutOneTimeOutcome(
  session: Record<string, unknown>,
  paymentIntent: Record<string, unknown> | null,
): PaymentIntegrityOutcome | null {
  if (session.payment_status === "paid") return "succeeded"
  const status = stringValue(paymentIntent?.status)
  if (status === "succeeded") return "succeeded"
  if (status === "requires_payment_method" || status === "canceled") return "failed"
  return "pending"
}

function stripeInvoiceOutcome(invoice: Record<string, unknown>): PaymentIntegrityOutcome | null {
  const status = stringValue(invoice.status)
  if (status === "paid") return "succeeded"
  return null
}

function stripeInvoiceSubscriptionId(invoice: Record<string, unknown>): string | null {
  const parent = objectValue(invoice.parent)
  const subscriptionDetails = objectValue(parent?.subscription_details)
  return stripeObjectId(subscriptionDetails?.subscription) ?? stripeObjectId(invoice.subscription)
}

function stripeObjectId(value: unknown): string | null {
  if (typeof value === "string") return value
  return stringValue(objectValue(value)?.id)
}

function stripeInvoiceOccurredAt(invoice: Record<string, unknown>): Date {
  const transitions = objectValue(invoice.status_transitions)
  return timestampSecondsToDate(transitions?.paid_at ?? invoice.created)
}

function stripeMethodFromPaymentIntent(
  paymentIntent: Record<string, unknown> | null,
): PaymentIntegrityMethod {
  const paymentMethod = objectValue(paymentIntent?.payment_method)
  const card = objectValue(paymentMethod?.card)
  const walletType = stringValue(objectValue(card?.wallet)?.type)
  if (walletType === "apple_pay") return "apple_pay"
  if (walletType === "google_pay") return "google_pay"
  if (stringValue(paymentMethod?.type) === "card") return "card"
  return "unknown"
}

function isPersonalPlanOnce(
  sessionMetadata: Record<string, unknown>,
  paymentIntent: Record<string, unknown> | null,
): boolean {
  const intentMetadata = metadataValue(paymentIntent?.metadata)
  return (
    sessionMetadata.product_kind === "personal_plan_once" ||
    intentMetadata.product_kind === "personal_plan_once"
  )
}

function paypalSubscriptionOutcome(subscription: Record<string, unknown>): PaymentIntegrityOutcome {
  const status = stringValue(subscription.status)
  if (status === "ACTIVE") return "succeeded"
  return "pending"
}

function paypalOrderOutcome(
  order: Record<string, unknown> | null,
  captureId: string | null,
): PaymentIntegrityOutcome {
  const capture = findPayPalCapture(order, captureId)
  const captureStatus = stringValue(capture?.status)
  if (captureStatus === "COMPLETED") return "succeeded"
  if (captureStatus === "DECLINED" || captureStatus === "FAILED") return "failed"

  const orderStatus = stringValue(order?.status)
  if (orderStatus === "COMPLETED") return "succeeded"
  if (orderStatus === "VOIDED") return "failed"
  return "pending"
}

function paypalTransactionOutcome(
  transaction: Record<string, unknown>,
): PaymentIntegrityOutcome | null {
  const status = stringValue(transaction.status)
  if (status === "COMPLETED") return "succeeded"
  if (status === "PENDING") return "pending"
  return null
}

function findPayPalCapture(order: Record<string, unknown> | null, captureId: string | null) {
  const units = Array.isArray(order?.purchase_units) ? order.purchase_units : []
  for (const unit of units) {
    const payments = objectValue(objectValue(unit)?.payments)
    const captures = Array.isArray(payments?.captures) ? payments.captures : []
    for (const capture of captures) {
      const candidate = objectValue(capture)
      if (!candidate) continue
      if (!captureId || candidate.id === captureId) return candidate
    }
  }
  return null
}

function paypalOccurredAt(
  providerObject: Record<string, unknown>,
  fallback: Record<string, unknown>,
): Date {
  return dateOrNow(
    providerObject.status_update_time ??
      providerObject.update_time ??
      providerObject.create_time ??
      fallback.updated_at ??
      fallback.created_at ??
      fallback.expires_at,
  )
}

function isActiveLocalEntitlement(
  status: string | null,
  currentPeriodEnd: string | null,
  cancelAtPeriodEnd: boolean,
  now: Date,
): boolean {
  if (status === "canceled" && cancelAtPeriodEnd && isFutureIso(currentPeriodEnd, now)) {
    return true
  }
  if (!status || !ACTIVE_ENTITLEMENT_STATUSES.has(status)) return false
  if (!currentPeriodEnd) return true
  return isFutureIso(currentPeriodEnd, now)
}

function isTerminalOneTimePurchaseStatus(status: string | undefined): boolean {
  return Boolean(status && TERMINAL_ONE_TIME_PURCHASE_STATUSES.has(status))
}

function isFutureIso(value: string | null, now: Date): boolean {
  if (!value) return false
  const ms = Date.parse(value)
  return Number.isFinite(ms) && ms > now.getTime()
}

function dedupeCandidates(candidates: PaymentIntegrityCandidate[]) {
  const seen = new Set<string>()
  const deduped: PaymentIntegrityCandidate[] = []
  for (const candidate of candidates) {
    const key = [
      candidate.provider,
      candidate.commerceKind,
      candidate.outcome,
      candidate.checkoutAttemptId ?? "",
      candidate.providerReferenceDigest ?? "",
    ].join(":")
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(candidate)
  }
  return deduped
}

function isInternalTestMetadata(metadata: Record<string, unknown>): boolean {
  return ["is_internal_test", "internal_test", "production_qa", "qa_test"].some((key) =>
    booleanLike(metadata[key]),
  )
}

function isExcludedInternalPayPalRenewal(row: Record<string, unknown>): boolean {
  const metadata = metadataValue(row.metadata)
  return (
    booleanLike(metadata.is_internal_test) &&
    metadata.payment_monitor_exclusion_reason === PAYPAL_RENEWAL_EXCLUSION_REASON
  )
}

function booleanLike(value: unknown): boolean {
  return value === true || value === "true" || value === "1" || value === 1 || value === "yes"
}

function metadataValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null
}

function safeInternalIdentifier(value: unknown): string | undefined {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{8,128}$/.test(value) ? value : undefined
}

function timestampSecondsToDate(value: unknown): Date {
  return typeof value === "number" && Number.isFinite(value) ? new Date(value * 1000) : new Date()
}

function dateOrNow(value: unknown): Date {
  if (typeof value !== "string") return new Date()
  const ms = Date.parse(value)
  return Number.isFinite(ms) ? new Date(ms) : new Date()
}

async function withProviderTimeout<T>(
  work: Promise<T> | ((signal: AbortSignal) => Promise<T>),
  deadlineAt: Date,
): Promise<T> {
  const timeoutMs = Math.max(
    1,
    Math.min(PROVIDER_REQUEST_TIMEOUT_MS, deadlineAt.getTime() - Date.now()),
  )
  const controller = new AbortController()
  let timeout: NodeJS.Timeout | null = null
  try {
    const pending = typeof work === "function" ? work(controller.signal) : work
    return await Promise.race([
      pending,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => {
          controller.abort()
          reject(new Error("payment_integrity_provider_timeout"))
        }, timeoutMs)
      }),
    ])
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

async function mapProviderRowsWithConcurrency<T, R>(
  rows: T[],
  deadlineAt: Date,
  worker: (row: T) => Promise<R>,
): Promise<{ results: R[]; incomplete: boolean }> {
  if (rows.length === 0) return { results: [], incomplete: false }

  const results: Array<R | undefined> = new Array(rows.length)
  let incomplete = false

  try {
    results[0] = await worker(rows[0])
  } catch {
    incomplete = true
  }

  let nextIndex = 1

  const runWorker = async () => {
    while (Date.now() < deadlineAt.getTime()) {
      const index = nextIndex
      nextIndex += 1
      if (index >= rows.length) return

      try {
        results[index] = await worker(rows[index])
      } catch {
        incomplete = true
      }
    }
    incomplete = true
  }

  const remaining = rows.length - nextIndex
  if (remaining > 0) {
    await Promise.all(
      Array.from({ length: Math.min(PAYPAL_PROVIDER_CONCURRENCY, remaining) }, () => runWorker()),
    )
  }

  if (results.some((result) => result === undefined)) incomplete = true
  return {
    results: results.filter((result): result is R => result !== undefined),
    incomplete,
  }
}

function isMissingPayPalOrderIntentTable(error: unknown): boolean {
  if (!error || typeof error !== "object") return false
  const candidate = error as { code?: unknown; message?: unknown }
  const code = typeof candidate.code === "string" ? candidate.code : ""
  const message = typeof candidate.message === "string" ? candidate.message : ""
  return (code === "PGRST205" || code === "42P01") && message.includes("paypal_order_intents")
}
