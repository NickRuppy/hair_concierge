import { pathToFileURL } from "node:url"
import type { SupabaseClient } from "@supabase/supabase-js"

import {
  activateVerifiedPayPalOrderIntent,
  tryMarkPayPalOrderIntentCaptured,
  verifyPayPalOneTimePaymentForRecovery,
  type PayPalOneTimeRecoveryVerification,
} from "@/lib/paypal/order-activation"
import {
  ensureOneTimeCheckoutAccount,
  verifyCheckoutSessionForActivation,
  verifyStripeOneTimePaymentForRecovery,
} from "@/lib/stripe/checkout-activation"
import { findPersonalPlanOneTimeConsentById } from "@/lib/billing/personal-plan-one-time-consents"
import { resolveOneTimePurchaseAccessState } from "@/lib/billing/purchases"
import type {
  BillingOneTimePurchaseRow,
  BillingProvider,
  OneTimeAccessState,
} from "@/lib/billing/types"
import type { VerifiedOneTimePayment } from "@/lib/billing/personal-plan-one-time-activation"

export type OneTimeRecoveryProvider = Extract<BillingProvider, "stripe" | "paypal">

export type RecoveryRequest = {
  provider: OneTimeRecoveryProvider
  apply: boolean
  confirmSession?: string
  stripeSessionId?: string
  paypalToken?: string
  paypalOrderId?: string
  paypalCaptureId?: string
}

export type NormalizedRecoveryTarget =
  | {
      provider: "stripe"
      kind: "stripe_checkout_session"
      confirmationValue: string
      stripeSessionId: string
    }
  | {
      provider: "paypal"
      kind: "paypal_token"
      confirmationValue: string
      paypalToken: string
    }
  | {
      provider: "paypal"
      kind: "paypal_order_capture"
      confirmationValue: string
      paypalOrderId: string
      paypalCaptureId: string
    }

export type RecoveryVerification = {
  payment: VerifiedOneTimePayment
  canonicalConsentMatch: boolean
  existingPurchaseFound?: boolean
  raw?: unknown
}

export type ReconciliationReceipt = {
  purchasePersisted: boolean
  purchaseBoundToUser: boolean
  consentBoundToUser: boolean
  confirmationAccepted: boolean
  planDeliveryRecorded: boolean
  firstAccessRecorded: boolean
  accessState: OneTimeAccessState
  fulfillmentJobCount: number
  canonicalOutboxCount: number
  analyticsDeliveryCounts: {
    total: number
    pending: number
    processing: number
    delivered: number
    failed: number
    failedPermanent: number
  }
}

export type RecoveryCommandReceipt = {
  ok: true
  mode: "dry-run" | "apply"
  provider: OneTimeRecoveryProvider
  targetKind: NormalizedRecoveryTarget["kind"]
  amount: "29.99"
  currency: "EUR"
  paidAtPresent: boolean
  canonicalConsentMatch: boolean
  existingPurchaseFound: boolean
  applyGuardSatisfied: boolean
  reconciliation: ReconciliationReceipt
}

export type OneTimeRecoveryDependencies = {
  verifyStripe: (
    target: Extract<NormalizedRecoveryTarget, { provider: "stripe" }>,
  ) => Promise<RecoveryVerification>
  activateStripe: (
    target: Extract<NormalizedRecoveryTarget, { provider: "stripe" }>,
    verification: RecoveryVerification,
  ) => Promise<unknown>
  verifyPayPal: (
    target: Extract<NormalizedRecoveryTarget, { provider: "paypal" }>,
  ) => Promise<RecoveryVerification>
  activatePayPal: (
    target: Extract<NormalizedRecoveryTarget, { provider: "paypal" }>,
    verification: RecoveryVerification,
  ) => Promise<unknown>
  readReceipt: (
    payment: VerifiedOneTimePayment,
    verification: RecoveryVerification,
  ) => Promise<ReconciliationReceipt>
}

export class OneTimeRecoveryCommandError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = "OneTimeRecoveryCommandError"
  }
}

export function parseOneTimeRecoveryArgs(argv: string[]): RecoveryRequest {
  const request: RecoveryRequest = { provider: "stripe", apply: false }
  for (const arg of argv) {
    const [key, rawValue] = splitArg(arg)
    switch (key) {
      case "--provider":
        if (rawValue !== "stripe" && rawValue !== "paypal") {
          throw new OneTimeRecoveryCommandError(
            "invalid_provider",
            "Provider must be stripe or paypal",
          )
        }
        request.provider = rawValue
        break
      case "--stripe-session":
        request.stripeSessionId = requireArgValue(key, rawValue)
        break
      case "--paypal-token":
        request.paypalToken = requireArgValue(key, rawValue)
        break
      case "--paypal-order":
        request.paypalOrderId = requireArgValue(key, rawValue)
        break
      case "--paypal-capture":
        request.paypalCaptureId = requireArgValue(key, rawValue)
        break
      case "--confirm-session":
        request.confirmSession = requireArgValue(key, rawValue)
        break
      case "--apply":
        if (rawValue)
          throw new OneTimeRecoveryCommandError("invalid_apply", "--apply takes no value")
        request.apply = true
        break
      default:
        throw new OneTimeRecoveryCommandError("unknown_argument", "Unknown recovery argument")
    }
  }
  return request
}

export async function runOneTimeRecoveryCommand(
  request: RecoveryRequest,
  deps: OneTimeRecoveryDependencies,
): Promise<RecoveryCommandReceipt> {
  assertPersonalPlanPricingExperimentIsDark()
  const target = normalizeRecoveryTarget(request)
  if (request.confirmSession && !request.apply) {
    throw new OneTimeRecoveryCommandError(
      "confirm_without_apply",
      "--confirm-session is only valid with --apply",
    )
  }
  if (request.apply && request.confirmSession !== target.confirmationValue) {
    throw new OneTimeRecoveryCommandError(
      "apply_confirmation_mismatch",
      "Apply requires --confirm-session to exactly match the explicit target",
    )
  }

  const verification =
    target.provider === "stripe" ? await deps.verifyStripe(target) : await deps.verifyPayPal(target)
  assertVerifiedFixedOffer(verification.payment, target.provider)

  if (request.apply) {
    if (target.provider === "stripe") await deps.activateStripe(target, verification)
    else await deps.activatePayPal(target, verification)
  }

  const reconciliation = await deps.readReceipt(verification.payment, verification)
  return {
    ok: true,
    mode: request.apply ? "apply" : "dry-run",
    provider: target.provider,
    targetKind: target.kind,
    amount: "29.99",
    currency: "EUR",
    paidAtPresent: Number.isFinite(Date.parse(verification.payment.paidAt)),
    canonicalConsentMatch: verification.canonicalConsentMatch,
    existingPurchaseFound: verification.existingPurchaseFound || reconciliation.purchasePersisted,
    applyGuardSatisfied: request.apply,
    reconciliation,
  }
}

export function assertPersonalPlanPricingExperimentIsDark(
  value = process.env.PERSONAL_PLAN_PRICING_EXPERIMENT_ENABLED,
): void {
  if (value === undefined || value === "false") return
  throw new OneTimeRecoveryCommandError(
    "personal_plan_pricing_experiment_enabled",
    "One-time recovery requires PERSONAL_PLAN_PRICING_EXPERIMENT_ENABLED to be unset or exact false",
  )
}

export function normalizeRecoveryTarget(request: RecoveryRequest): NormalizedRecoveryTarget {
  const stripeSessionId = clean(request.stripeSessionId)
  const paypalToken = clean(request.paypalToken)
  const paypalOrderId = clean(request.paypalOrderId)
  const paypalCaptureId = clean(request.paypalCaptureId)
  const hasPayPalPair = Boolean(paypalOrderId || paypalCaptureId)

  if (request.provider === "stripe") {
    if (!stripeSessionId) {
      throw new OneTimeRecoveryCommandError(
        "missing_stripe_session",
        "Stripe recovery requires --stripe-session",
      )
    }
    if (paypalToken || hasPayPalPair) {
      throw new OneTimeRecoveryCommandError(
        "ambiguous_provider_identifiers",
        "Stripe recovery cannot include PayPal identifiers",
      )
    }
    return {
      provider: "stripe",
      kind: "stripe_checkout_session",
      confirmationValue: stripeSessionId,
      stripeSessionId,
    }
  }

  if (stripeSessionId) {
    throw new OneTimeRecoveryCommandError(
      "ambiguous_provider_identifiers",
      "PayPal recovery cannot include a Stripe session",
    )
  }
  if (paypalToken && hasPayPalPair) {
    throw new OneTimeRecoveryCommandError(
      "ambiguous_paypal_identifiers",
      "PayPal recovery requires either token or order plus capture, not both",
    )
  }
  if (paypalToken) {
    return {
      provider: "paypal",
      kind: "paypal_token",
      confirmationValue: paypalToken,
      paypalToken,
    }
  }
  if (paypalOrderId && paypalCaptureId) {
    return {
      provider: "paypal",
      kind: "paypal_order_capture",
      confirmationValue: `${paypalOrderId}:${paypalCaptureId}`,
      paypalOrderId,
      paypalCaptureId,
    }
  }
  throw new OneTimeRecoveryCommandError(
    "missing_paypal_identifier",
    "PayPal recovery requires --paypal-token or both --paypal-order and --paypal-capture",
  )
}

export async function createLiveOneTimeRecoveryDependencies(): Promise<OneTimeRecoveryDependencies> {
  const [{ createAdminClient }, { getStripe }, { getPremiumTierId }, { linkQuizToProfile }] =
    await Promise.all([
      import("@/lib/supabase/admin"),
      import("@/lib/stripe/client"),
      import("@/lib/billing/tier-ids"),
      import("@/lib/quiz/link-to-profile"),
    ])
  const supabase = createAdminClient()
  const stripe = getStripe()

  return {
    verifyStripe: async (target) => {
      const verification = await withSuppressedProviderConsole(() =>
        verifyStripeOneTimePaymentForRecovery(target.stripeSessionId, stripe, supabase),
      )
      return {
        payment: verification.payment,
        canonicalConsentMatch: verification.refs.consentId === verification.payment.consentId,
        raw: verification,
      }
    },
    activateStripe: async (target) => {
      return withSuppressedProviderConsole(async () => {
        const session = await verifyCheckoutSessionForActivation(target.stripeSessionId, stripe)
        return ensureOneTimeCheckoutAccount(session, {
          supabase,
          stripe,
          premiumTierId: await getPremiumTierId(supabase),
          linkQuizToProfile,
        })
      })
    },
    verifyPayPal: async (target) => {
      const verification = await withSuppressedProviderConsole(() =>
        verifyPayPalOneTimePaymentForRecovery({
          supabase,
          token: target.kind === "paypal_token" ? target.paypalToken : undefined,
          orderId: target.kind === "paypal_order_capture" ? target.paypalOrderId : undefined,
          captureId: target.kind === "paypal_order_capture" ? target.paypalCaptureId : undefined,
        }),
      )
      return {
        payment: verification.payment,
        canonicalConsentMatch: verification.consent.id === verification.payment.consentId,
        existingPurchaseFound: Boolean(verification.existingPurchase),
        raw: verification,
      }
    },
    activatePayPal: async (_target, verification) => {
      const raw = verification.raw as PayPalOneTimeRecoveryVerification | undefined
      if (!raw) {
        throw new OneTimeRecoveryCommandError(
          "paypal_verification_missing",
          "PayPal apply requires a provider verification result",
        )
      }
      return withSuppressedProviderConsole(async () => {
        const intent = raw.intent.provider_capture_id
          ? raw.intent
          : ((await tryMarkPayPalOrderIntentCaptured(
              supabase,
              raw.intent.token,
              verification.payment.providerTransactionId,
            )) ?? raw.intent)
        return activateVerifiedPayPalOrderIntent(
          intent,
          {
            captureId: verification.payment.providerTransactionId,
            orderId: verification.payment.providerOrderId,
            paidAt: verification.payment.paidAt,
          },
          {
            supabase,
            linkQuizToProfile,
          },
        )
      })
    },
    readReceipt: async (payment) => readOneTimeRecoveryReceipt(supabase, payment),
  }
}

export async function readOneTimeRecoveryReceipt(
  supabase: SupabaseClient,
  payment: VerifiedOneTimePayment,
): Promise<ReconciliationReceipt> {
  const purchases = await selectRows<BillingOneTimePurchaseRow>(
    supabase,
    "billing_one_time_purchases",
    [
      ["provider", payment.provider],
      ["provider_transaction_id", payment.providerTransactionId],
    ],
  )
  const purchase = purchases[0] ?? null
  const consent = await findPersonalPlanOneTimeConsentById(supabase, payment.consentId)

  const jobs = purchase
    ? await selectRows<{ status?: string }>(supabase, "personal_plan_one_time_fulfillment_jobs", [
        ["purchase_id", purchase.id],
      ])
    : []

  const purchaseCompletedEventAnchor =
    payment.provider === "stripe" ? payment.providerOrderId : payment.providerTransactionId
  const canonicalOutbox = await selectRows<{ id: string }>(supabase, "billing_analytics_outbox", [
    ["event_key", `${payment.provider}:purchase_completed:${purchaseCompletedEventAnchor}`],
  ])
  const deliveryRows =
    canonicalOutbox.length === 1
      ? await selectRows<{ status?: string }>(supabase, "billing_analytics_deliveries", [
          ["outbox_id", canonicalOutbox[0].id],
        ])
      : []

  const accessState =
    purchase && consent ? resolveOneTimePurchaseAccessState({ purchase, consent }) : "none"

  return {
    purchasePersisted: Boolean(purchase),
    purchaseBoundToUser: Boolean(purchase?.user_id),
    consentBoundToUser: Boolean(consent?.user_id),
    confirmationAccepted:
      consent?.confirmation_status === "sent" || consent?.confirmation_status === "delivered",
    planDeliveryRecorded: Boolean(
      consent?.delivered_at &&
      consent.generated_content_sha256 &&
      consent.delivery_provider &&
      consent.delivery_reference,
    ),
    firstAccessRecorded: Boolean(consent?.first_accessed_at),
    accessState,
    fulfillmentJobCount: jobs.length,
    canonicalOutboxCount: canonicalOutbox.length,
    analyticsDeliveryCounts: countAnalyticsDeliveryStatuses(deliveryRows),
  }
}

function assertVerifiedFixedOffer(
  payment: VerifiedOneTimePayment,
  provider: OneTimeRecoveryProvider,
) {
  if (
    payment.provider !== provider ||
    payment.amountMinor !== 2999 ||
    payment.currency !== "eur" ||
    !Number.isFinite(Date.parse(payment.paidAt))
  ) {
    throw new OneTimeRecoveryCommandError(
      "verified_payment_mismatch",
      "Provider verification did not return the fixed one-time offer payment",
    )
  }
}

async function selectRows<T>(
  supabase: SupabaseClient,
  table: string,
  filters: Array<[string, unknown]>,
): Promise<T[]> {
  let query = supabase.from(table).select("*")
  for (const [key, value] of filters) query = query.eq(key, value)
  const { data, error } = await query
  if (error) throw error
  return (data as T[] | null) ?? []
}

function countAnalyticsDeliveryStatuses(rows: Array<{ status?: string }>) {
  return rows.reduce(
    (counts, row) => {
      counts.total += 1
      if (row.status === "pending") counts.pending += 1
      else if (row.status === "processing") counts.processing += 1
      else if (row.status === "delivered") counts.delivered += 1
      else if (row.status === "failed") counts.failed += 1
      else if (row.status === "failed_permanent") counts.failedPermanent += 1
      return counts
    },
    {
      total: 0,
      pending: 0,
      processing: 0,
      delivered: 0,
      failed: 0,
      failedPermanent: 0,
    },
  )
}

function splitArg(arg: string): [string, string | undefined] {
  const index = arg.indexOf("=")
  if (index === -1) return [arg, undefined]
  return [arg.slice(0, index), arg.slice(index + 1)]
}

function requireArgValue(key: string, value: string | undefined): string {
  const trimmed = clean(value)
  if (!trimmed) {
    throw new OneTimeRecoveryCommandError("missing_argument_value", `${key} requires a value`)
  }
  return trimmed
}

function clean(value: string | undefined | null): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

function sanitizedCliError(error: unknown) {
  if (error instanceof OneTimeRecoveryCommandError) {
    return { code: error.code, type: error.name }
  }
  if (error && typeof error === "object" && "code" in error) {
    return { code: String((error as { code?: unknown }).code), type: error.constructor.name }
  }
  return { code: "one_time_recovery_failed", type: error instanceof Error ? error.name : "Error" }
}

async function withSuppressedProviderConsole<T>(work: () => Promise<T>): Promise<T> {
  const original = {
    info: console.info,
    warn: console.warn,
    error: console.error,
  }
  console.info = () => undefined
  console.warn = () => undefined
  console.error = () => undefined
  try {
    return await work()
  } finally {
    console.info = original.info
    console.warn = original.warn
    console.error = original.error
  }
}

async function main() {
  try {
    const deps = await createLiveOneTimeRecoveryDependencies()
    const receipt = await runOneTimeRecoveryCommand(
      parseOneTimeRecoveryArgs(process.argv.slice(2)),
      deps,
    )
    console.log(JSON.stringify(receipt, null, 2))
  } catch (error) {
    console.error(JSON.stringify({ ok: false, error: sanitizedCliError(error) }, null, 2))
    process.exitCode = 1
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main()
}
