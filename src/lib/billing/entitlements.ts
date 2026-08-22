import type {
  BillingEntitlementStatus,
  BillingSubscriptionInput,
  BillingSubscriptionRow,
  SupabaseBillingClient,
} from "./types"
import { findCurrentBillingSubscriptionForUser, isFutureIso } from "./subscriptions"
import { stripeEntitlementStatus } from "@/lib/stripe/checkout-activation"
import {
  derivePayPalPaidThroughDate,
  mapPayPalSubscriptionStatus,
  type PayPalSubscription,
} from "@/lib/paypal/subscriptions"

type MirrorableBillingSubscription = BillingSubscriptionInput | BillingSubscriptionRow

/** Minimal shape read off a Stripe subscription retrieved for expired-active
 * reconcile — deliberately narrower than the checkout-activation `RetrievedSub`
 * type since this path never needs `items.data[].price`. */
export type StripeSubscriptionTruthSource = {
  status?: string
  current_period_end?: number
  cancel_at_period_end?: boolean
  cancel_at?: number | null
  items?: { data: Array<{ current_period_end?: number }> }
}

export type RetrieveStripeSubscriptionForReconcile = (
  subscriptionId: string,
) => Promise<StripeSubscriptionTruthSource>

export type RetrievePayPalSubscriptionForReconcile = (
  subscriptionId: string,
) => Promise<PayPalSubscription>

export const DEFAULT_EXPIRED_ACTIVE_RECONCILE_PROVIDER_CALL_CAP = 25
export const DEFAULT_EXPIRED_ACTIVE_RECONCILE_DEADLINE_MS = 20_000

/**
 * Candidate threshold for the expired-active reconcile branch below.
 * Deliberately much tighter than EXPIRED_ENTITLEMENT_GRACE_MS (24h, imported
 * from subscriptions.ts), which is the access-check grace period. If
 * candidacy used the same 24h threshold, a once-daily cron would only ever
 * look at a row AFTER it already fell out of the access grace and locked
 * the customer out. This lag buffer instead makes a row a candidate as soon
 * as its local current_period_end has passed (plus a small buffer to avoid
 * false positives from normal renewal-webhook timing jitter), so the nightly
 * run gets a full ~23h window to refresh provider truth and correct a missed
 * webhook *before* the access grace ever expires. The access-check grace
 * itself is untouched by this constant.
 */
export const EXPIRED_ACTIVE_RECONCILE_LAG_MS = 60 * 60 * 1000

const TEST_MARKER_METADATA_KEYS = [
  "qa_seed",
  "ci_seed",
  "is_internal_test",
  "seeded_by",
  "local_test",
  "seed_source",
] as const
const TEST_MARKER_SOURCES = new Set([
  "chat_eval_ci",
  "local_dev_login_clean_test",
  "codex_link_card_test",
])
const TEST_MARKER_STRIPE_ACCOUNT_FRAGMENT = "K0IN8ErFeg"

export type ExpiredActiveReconcileCounters = {
  candidates: number
  skippedTest: number
  checked: number
  updated: number
  canceled: number
  providerErrors: number
  providerCallCap: number
  capped: boolean
  deadlineHit: boolean
}

/**
 * True for billing_subscriptions rows that are QA/CI seeds, local-dev test
 * rows, or test checkouts rather than real customers.
 *
 * Must stay in sync with is_test in
 * supabase/migrations/20260822140000_billing_subscriptions_classified_views.sql
 * (this predicate intentionally omits that view's `backfilled_from_profiles`
 * marker — backfilled rows belong to real profiles and still need their
 * provider truth checked here).
 */
export function isTestMarkedBillingSubscriptionRow(
  row: Pick<BillingSubscriptionRow, "metadata" | "provider_subscription_id">,
): boolean {
  const metadata = row.metadata ?? {}
  if (TEST_MARKER_METADATA_KEYS.some((key) => key in metadata)) return true
  const source = typeof metadata.source === "string" ? metadata.source : ""
  if (TEST_MARKER_SOURCES.has(source)) return true
  if (row.provider_subscription_id?.includes(TEST_MARKER_STRIPE_ACCOUNT_FRAGMENT)) return true
  const checkoutSessionId =
    typeof metadata.checkout_session_id === "string" ? metadata.checkout_session_id : ""
  if (checkoutSessionId.startsWith("cs_test_")) return true
  return false
}

export async function mirrorBillingSubscriptionToProfile(
  supabase: SupabaseBillingClient,
  subscription: MirrorableBillingSubscription,
  premiumTierId: string,
  options: { freeTierId?: string } = {},
): Promise<void> {
  const profileStatus = profileStatusForSubscription(subscription)
  const patch: Record<string, unknown> = {
    subscription_status: profileStatus,
    subscription_interval: subscription.interval ?? null,
    current_period_end: subscription.current_period_end ?? null,
  }

  if (profileStatus === "active" || profileStatus === "past_due") {
    patch.subscription_tier_id = premiumTierId
  } else if (profileStatus === "canceled" || profileStatus === "incomplete") {
    patch.subscription_tier_id = options.freeTierId ?? null
  }

  const { error } = await supabase.from("profiles").update(patch).eq("id", subscription.user_id)
  if (error) throw error
}

export async function reconcileExpiredBillingEntitlements(
  supabase: SupabaseBillingClient,
  options: {
    freeTierId: string
    now?: Date
    getPremiumTierId?: () => Promise<string>
    retrieveStripeSubscription?: RetrieveStripeSubscriptionForReconcile
    retrievePayPalSubscription?: RetrievePayPalSubscriptionForReconcile
    providerCallCap?: number
    deadlineMs?: number
    clock?: () => number
  },
): Promise<{ downgraded: number; expiredActive?: ExpiredActiveReconcileCounters }> {
  const now = options.now ?? new Date()
  const { data, error } = await supabase
    .from("billing_subscriptions")
    .select("*")
    .eq("entitlement_status", "canceled")

  if (error) throw error

  const expiredRows = ((data as BillingSubscriptionRow[] | null) ?? []).filter(
    (row) => !row.current_period_end || !isFutureIso(row.current_period_end, now),
  )

  let downgraded = 0

  for (const row of expiredRows) {
    const currentSubscription = await findCurrentBillingSubscriptionForUser(
      supabase,
      row.user_id,
      now,
    )
    if (currentSubscription && currentSubscription.id !== row.id) continue

    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        subscription_status: "canceled",
        subscription_tier_id: options.freeTierId,
      })
      .eq("id", row.user_id)

    if (profileError) throw profileError
    downgraded += 1
  }

  const expiredActive = await reconcileExpiredActiveEntitlementsAgainstProviderTruth(
    supabase,
    now,
    options,
  )

  return { downgraded, expiredActive }
}

/**
 * Second reconcile branch: billing_subscriptions rows still marked
 * active/past_due locally whose current_period_end lapsed more than
 * EXPIRED_ACTIVE_RECONCILE_LAG_MS ago. This threshold is intentionally much
 * tighter than EXPIRED_ENTITLEMENT_GRACE_MS (the 24h window that keeps a
 * stale row "current" for access checks — see hasCurrentBillingAccess in
 * subscriptions.ts): candidacy must fire well before the access grace
 * expires, so a missed webhook gets corrected by the next nightly run
 * *before* the customer is ever locked out, not after.
 */
async function reconcileExpiredActiveEntitlementsAgainstProviderTruth(
  supabase: SupabaseBillingClient,
  now: Date,
  options: {
    freeTierId: string
    getPremiumTierId?: () => Promise<string>
    retrieveStripeSubscription?: RetrieveStripeSubscriptionForReconcile
    retrievePayPalSubscription?: RetrievePayPalSubscriptionForReconcile
    providerCallCap?: number
    deadlineMs?: number
    clock?: () => number
  },
): Promise<ExpiredActiveReconcileCounters> {
  const providerCallCap =
    options.providerCallCap ?? DEFAULT_EXPIRED_ACTIVE_RECONCILE_PROVIDER_CALL_CAP
  const deadlineMs = options.deadlineMs ?? DEFAULT_EXPIRED_ACTIVE_RECONCILE_DEADLINE_MS
  const clock = options.clock ?? Date.now
  const deadlineAt = clock() + deadlineMs

  const counters: ExpiredActiveReconcileCounters = {
    candidates: 0,
    skippedTest: 0,
    checked: 0,
    updated: 0,
    canceled: 0,
    providerErrors: 0,
    providerCallCap,
    capped: false,
    deadlineHit: false,
  }

  const { data, error } = await supabase
    .from("billing_subscriptions")
    .select("*")
    .in("entitlement_status", ["active", "past_due"])
  if (error) throw error

  const lapsedCandidates = ((data as BillingSubscriptionRow[] | null) ?? []).filter(
    (row) =>
      row.current_period_end != null &&
      Date.parse(row.current_period_end) < now.getTime() - EXPIRED_ACTIVE_RECONCILE_LAG_MS,
  )
  counters.candidates = lapsedCandidates.length

  const realCandidates: BillingSubscriptionRow[] = []
  for (const row of lapsedCandidates) {
    if (isTestMarkedBillingSubscriptionRow(row)) {
      counters.skippedTest += 1
      console.info("[billing] reconcile expired-active: skipping test-marked row", {
        id: row.id,
        provider: row.provider,
      })
      continue
    }
    realCandidates.push(row)
  }

  if (realCandidates.length > providerCallCap) counters.capped = true
  const boundedCandidates = realCandidates.slice(0, providerCallCap)

  for (const row of boundedCandidates) {
    if (clock() >= deadlineAt) {
      counters.deadlineHit = true
      break
    }
    counters.checked += 1

    let truth: ProviderSubscriptionTruth
    try {
      truth =
        row.provider === "stripe"
          ? normalizeStripeSubscriptionTruth(
              await ensureStripeSubscriptionRetriever(options.retrieveStripeSubscription)(
                row.provider_subscription_id,
              ),
              row,
            )
          : normalizePayPalSubscriptionTruth(
              await ensurePayPalSubscriptionRetriever(options.retrievePayPalSubscription)(
                row.provider_subscription_id,
              ),
              row,
            )
    } catch (err) {
      counters.providerErrors += 1
      console.error("[billing] reconcile expired-active: provider lookup failed", {
        provider: row.provider,
        subscriptionId: row.provider_subscription_id,
        error: err,
      })
      continue
    }

    if (truth.entitlementStatus === "active" || truth.entitlementStatus === "past_due") {
      await updateBillingSubscriptionProviderTruth(supabase, row, {
        entitlement_status: truth.entitlementStatus,
        provider_status: truth.providerStatus,
        current_period_end: truth.currentPeriodEnd,
        cancel_at_period_end: truth.cancelAtPeriodEnd,
      })
      counters.updated += 1
    } else {
      const updatedRow = await updateBillingSubscriptionProviderTruth(supabase, row, {
        entitlement_status: "canceled",
        provider_status: truth.providerStatus,
        current_period_end: truth.currentPeriodEnd,
        // Preserve provider-signaled paid-through access: a canceled row
        // only keeps hasCurrentBillingAccess true until current_period_end
        // when cancel_at_period_end is also true (subscriptions.ts:302), so
        // dropping this here would revoke access the customer already paid
        // for. See normalizeStripeSubscriptionTruth /
        // normalizePayPalSubscriptionTruth for how this is derived per
        // provider.
        cancel_at_period_end: truth.cancelAtPeriodEnd,
      })
      counters.canceled += 1

      // The row itself is corrected above regardless, but if the user
      // already holds another current subscription (e.g. they re-subscribed
      // after this row lapsed at the provider), never overwrite a live
      // paying customer's profile with this stale row's canceled state.
      const currentSubscription = await findCurrentBillingSubscriptionForUser(
        supabase,
        row.user_id,
        now,
      )
      if (currentSubscription && currentSubscription.id !== row.id) continue

      const profileStatus = profileStatusForSubscription(updatedRow)
      let premiumTierId = ""
      if (profileStatus === "active" || profileStatus === "past_due") {
        // Only a still-current profile status (e.g. cancel_at_period_end
        // with a future current_period_end) needs a premium tier id at all.
        premiumTierId = (await options.getPremiumTierId?.()) ?? ""
        if (!premiumTierId) {
          // Never write an empty-string tier id to profiles — skip the
          // mirror for this row rather than corrupting subscription_tier_id.
          counters.providerErrors += 1
          console.error(
            "[billing] reconcile expired-active: skipping profile mirror — no premium tier id available for a still-current canceled row",
            { id: updatedRow.id, userId: updatedRow.user_id },
          )
          continue
        }
      }

      await mirrorBillingSubscriptionToProfile(supabase, updatedRow, premiumTierId, {
        freeTierId: options.freeTierId,
      })
    }
  }

  return counters
}

type ProviderSubscriptionTruth = {
  entitlementStatus: BillingEntitlementStatus
  providerStatus: string
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
}

function ensureStripeSubscriptionRetriever(
  retriever: RetrieveStripeSubscriptionForReconcile | undefined,
): RetrieveStripeSubscriptionForReconcile {
  if (!retriever) {
    throw new Error("stripe subscription retriever not configured for expired-active reconcile")
  }
  return retriever
}

function ensurePayPalSubscriptionRetriever(
  retriever: RetrievePayPalSubscriptionForReconcile | undefined,
): RetrievePayPalSubscriptionForReconcile {
  if (!retriever) {
    throw new Error("paypal subscription retriever not configured for expired-active reconcile")
  }
  return retriever
}

function normalizeStripeSubscriptionTruth(
  sub: StripeSubscriptionTruthSource,
  row: BillingSubscriptionRow,
): ProviderSubscriptionTruth {
  const entitlementStatus = stripeEntitlementStatus(sub.status)
  const providerStatus = sub.status ?? row.provider_status
  const providerPeriodEnd = stripeSubscriptionPeriodEndIso(sub)
  return {
    entitlementStatus,
    providerStatus,
    currentPeriodEnd: providerPeriodEnd ?? row.current_period_end,
    // Read straight off provider truth, same expression
    // handleSubscriptionUpdated uses for the live Stripe webhook
    // (src/lib/stripe/webhook-handlers.ts) — a subscription can be
    // "canceled" (or still active) with a scheduled/paid-through
    // cancellation, and that must survive into the row we write here.
    cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end || sub.cancel_at != null),
  }
}

function stripeSubscriptionPeriodEndIso(sub: StripeSubscriptionTruthSource): string | null {
  const itemEnd = sub.items?.data?.[0]?.current_period_end
  const unix = itemEnd ?? sub.current_period_end
  return typeof unix === "number" && Number.isFinite(unix)
    ? new Date(unix * 1000).toISOString()
    : null
}

// mapPayPalSubscriptionStatus defaults unknown/missing status to
// "incomplete" (correct for its other callers, e.g. checkout activation,
// where an unrecognized status should not be treated as active). Reusing
// that default here would route an ambiguous provider response straight
// into the lapsed/cancel branch below and revoke a paying customer. So this
// reconcile path classifies PayPal's raw status itself, only ever calling
// the shared mapper on a status already confirmed to be current, and fails
// closed (provider error, row untouched) on anything else — without
// changing the shared mapper's behavior for its existing callers.
const PAYPAL_CURRENT_STATUSES = new Set(["ACTIVE", "SUSPENDED"])

function normalizePayPalSubscriptionTruth(
  sub: PayPalSubscription,
  row: BillingSubscriptionRow,
): ProviderSubscriptionTruth {
  const status = sub.status
  const providerPeriodEnd = derivePayPalPaidThroughDate(sub)
  const currentPeriodEnd = providerPeriodEnd ?? row.current_period_end

  if (status && PAYPAL_CURRENT_STATUSES.has(status)) {
    return {
      entitlementStatus: mapPayPalSubscriptionStatus(status),
      providerStatus: status,
      currentPeriodEnd,
      cancelAtPeriodEnd: false,
    }
  }
  // Mirror the live PayPal webhook handler's exact convention for these two
  // terminal statuses (src/lib/paypal/webhook-handlers.ts,
  // BILLING.SUBSCRIPTION.CANCELLED / .EXPIRED): CANCELLED is a user-initiated
  // cancellation that still grants access through the already-paid period
  // (cancel_at_period_end: true, paid-through end preserved); EXPIRED means
  // the subscription's billing cycles actually ran out, so there is no
  // residual access to preserve.
  if (status === "CANCELLED") {
    return {
      entitlementStatus: "canceled",
      providerStatus: status,
      currentPeriodEnd,
      cancelAtPeriodEnd: true,
    }
  }
  if (status === "EXPIRED") {
    return {
      entitlementStatus: "canceled",
      providerStatus: status,
      currentPeriodEnd,
      cancelAtPeriodEnd: false,
    }
  }

  throw new Error(
    `paypal subscription status is not a known current/terminal state: ${status ?? "<missing>"}`,
  )
}

async function updateBillingSubscriptionProviderTruth(
  supabase: SupabaseBillingClient,
  row: BillingSubscriptionRow,
  patch: {
    entitlement_status: BillingEntitlementStatus
    provider_status: string
    current_period_end: string | null
    cancel_at_period_end: boolean
  },
): Promise<BillingSubscriptionRow> {
  const fullPatch = { ...patch, updated_at: new Date().toISOString() }
  const { error } = await supabase.from("billing_subscriptions").update(fullPatch).eq("id", row.id)
  if (error) throw error
  return { ...row, ...fullPatch }
}

function profileStatusForSubscription(subscription: MirrorableBillingSubscription) {
  if (
    subscription.entitlement_status === "canceled" &&
    subscription.cancel_at_period_end &&
    isFutureIso(subscription.current_period_end ?? null)
  ) {
    return "active"
  }

  return subscription.entitlement_status
}
