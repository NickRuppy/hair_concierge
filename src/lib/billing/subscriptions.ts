import type {
  BillingEntitlementStatus,
  BillingProvider,
  BillingSubscriptionInput,
  BillingSubscriptionRow,
  SupabaseBillingClient,
} from "./types"
import { findCurrentOneTimePurchaseForUser, resolveOneTimeAccessStateForUser } from "./purchases"
import { resolveBillingTrialAccess } from "./trial-access-projection"

type LegacyProfileSubscription = {
  id: string
  subscription_status: string | null
  current_period_end: string | null
}

export interface ManualAccessGrantRow {
  id: string
  user_id: string | null
  email: string | null
  expires_at: string | null
  revoked_at: string | null
}

const OPEN_ENTITLEMENTS = new Set<BillingEntitlementStatus>(["active", "past_due"])
const ACCESS_ALREADY_EXISTS_ERROR = "User already has access through an existing subscription"
export class CheckoutAccessAlreadyExistsError extends Error {
  constructor() {
    super(ACCESS_ALREADY_EXISTS_ERROR)
    this.name = "CheckoutAccessAlreadyExistsError"
  }
}

/**
 * Grace window after `current_period_end` during which a row with an OPEN
 * entitlement (active/past_due) still grants access, absorbing the delay
 * between a payment lapsing and the provider webhook updating the row.
 *
 * Must stay in sync with is_current in
 * supabase/migrations/20260822140000_billing_subscriptions_classified_views.sql
 */
export const EXPIRED_ENTITLEMENT_GRACE_MS = 24 * 60 * 60 * 1000

export async function upsertBillingSubscription(
  supabase: SupabaseBillingClient,
  input: BillingSubscriptionInput,
): Promise<BillingSubscriptionRow> {
  const now = new Date().toISOString()
  const existing = await findBillingSubscriptionByProviderId(
    supabase,
    input.provider,
    input.provider_subscription_id,
  )
  const {
    provider_subscriber_email,
    cancel_scheduled_at,
    trial_enrollment_id,
    metadata: inputMetadata,
    ...subscriptionInput
  } = input
  if (
    existing?.trial_enrollment_id != null &&
    trial_enrollment_id !== undefined &&
    trial_enrollment_id !== existing.trial_enrollment_id
  ) {
    throw new Error("Billing trial enrollment link cannot be reassigned or cleared")
  }
  const preservedTrialEnrollmentId =
    trial_enrollment_id !== undefined ? trial_enrollment_id : existing?.trial_enrollment_id
  const row = {
    provider_customer_id: existing?.provider_customer_id ?? null,
    provider_subscriber_email:
      provider_subscriber_email !== undefined
        ? provider_subscriber_email
        : (existing?.provider_subscriber_email ?? null),
    interval: existing?.interval ?? null,
    current_period_end: existing?.current_period_end ?? null,
    cancel_at_period_end: existing?.cancel_at_period_end ?? false,
    cancel_scheduled_at:
      cancel_scheduled_at !== undefined
        ? cancel_scheduled_at
        : (existing?.cancel_scheduled_at ?? null),
    cancelled_at: existing?.cancelled_at ?? null,
    ...(preservedTrialEnrollmentId != null
      ? { trial_enrollment_id: preservedTrialEnrollmentId }
      : {}),
    metadata: {
      ...(existing?.metadata ?? {}),
      ...(inputMetadata ?? {}),
    },
    ...subscriptionInput,
    updated_at: now,
  }

  const { data, error } = await supabase
    .from("billing_subscriptions")
    .upsert(row, { onConflict: "provider,provider_subscription_id" })
    .select("*")
    .single()

  if (error) throw error
  return data as BillingSubscriptionRow
}

export async function findBillingSubscriptionByProviderId(
  supabase: SupabaseBillingClient,
  provider: BillingProvider,
  providerSubscriptionId: string,
): Promise<BillingSubscriptionRow | null> {
  const { data, error } = await supabase
    .from("billing_subscriptions")
    .select("*")
    .eq("provider", provider)
    .eq("provider_subscription_id", providerSubscriptionId)
    .maybeSingle()

  if (error) throw error
  return (data as BillingSubscriptionRow | null) ?? null
}

export async function findCurrentBillingSubscriptionForUser(
  supabase: SupabaseBillingClient,
  userId: string,
  now: Date = new Date(),
): Promise<BillingSubscriptionRow | null> {
  return (await findCurrentBillingSubscriptionsForUser(supabase, userId, now))[0] ?? null
}

export async function findCurrentBillingSubscriptionsForUser(
  supabase: SupabaseBillingClient,
  userId: string,
  now: Date = new Date(),
): Promise<BillingSubscriptionRow[]> {
  const rows = (await findBillingSubscriptionsForUser(supabase, userId)).filter((row) =>
    hasCurrentBillingAccess(row, now),
  )
  rows.sort((left, right) => {
    const statusDelta =
      entitlementPriority(left.entitlement_status) - entitlementPriority(right.entitlement_status)
    if (statusDelta !== 0) return statusDelta
    return compareNullableIsoDesc(left.current_period_end, right.current_period_end)
  })

  return rows
}

export async function findVisibleBillingSubscriptionForUser(
  supabase: SupabaseBillingClient,
  userId: string,
  now: Date = new Date(),
): Promise<BillingSubscriptionRow | null> {
  const { data, error } = await supabase
    .from("billing_subscriptions")
    // Keep the server-derived trial projection intact; `*` also lets code
    // deployed before the migration continue to read legacy rows safely.
    .select("*")
    .eq("user_id", userId)
    .in("entitlement_status", ["active", "past_due", "canceled"])
    .order("current_period_end", { ascending: false })

  if (error) throw error
  const rows = ((data as BillingSubscriptionRow[] | null) ?? []).filter(
    (row) => !row.metadata?.trial_management_superseded_by && hasCurrentBillingAccess(row, now),
  )
  return rows[0] ?? null
}

export async function assertCanStartCheckout(
  supabase: SupabaseBillingClient,
  userId: string,
  now: Date = new Date(),
): Promise<void> {
  const rows = await findBillingSubscriptionsForUser(supabase, userId)
  if (rows.some((row) => hasCurrentBillingAccess(row, now))) {
    throw new CheckoutAccessAlreadyExistsError()
  }

  const oneTimeAccessState = await resolveOneTimeAccessStateForUser(supabase, userId)
  if (oneTimeAccessState === "active" || oneTimeAccessState === "paid_pending") {
    throw new CheckoutAccessAlreadyExistsError()
  }

  const manualGrant = await findCurrentManualAccessGrant(supabase, { userId }, now)
  if (manualGrant) {
    throw new CheckoutAccessAlreadyExistsError()
  }

  // An expired or malformed trial cohort must not recover access from the
  // legacy profile mirror. It may still start an explicitly paid checkout.
  if (hasTrialAccessMarker(rows, now)) return

  const { data, error } = await supabase
    .from("profiles")
    .select("id, subscription_status, current_period_end")
    .eq("id", userId)
    .maybeSingle()

  if (error) throw error
  const profile = data as LegacyProfileSubscription | null

  if (profile && hasCurrentLegacyProfileAccess(profile, now)) {
    throw new CheckoutAccessAlreadyExistsError()
  }
}

export async function assertCanStartCheckoutForEmail(
  supabase: SupabaseBillingClient,
  email: string,
  now: Date = new Date(),
): Promise<void> {
  const manualGrant = await findCurrentManualAccessGrant(supabase, { email }, now)
  if (manualGrant) {
    throw new CheckoutAccessAlreadyExistsError()
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, subscription_status, current_period_end")
    .ilike("email", email)
    .maybeSingle()

  if (error) throw error
  const profile = data as LegacyProfileSubscription | null
  if (!profile?.id) return

  await assertCanStartCheckout(supabase, profile.id, now)
}

export async function hasCurrentAppAccess(
  supabase: SupabaseBillingClient,
  lookup: { userId: string; email?: string | null },
  now: Date = new Date(),
): Promise<boolean> {
  const rows = await findBillingSubscriptionsForUser(supabase, lookup.userId)
  if (rows.some((row) => hasCurrentBillingAccess(row, now))) return true

  const purchase = await findCurrentOneTimePurchaseForUser(supabase, lookup.userId)
  if (purchase) return true

  const manualGrant = await findCurrentManualAccessGrant(supabase, lookup, now)
  if (manualGrant) return true

  if (hasTrialAccessMarker(rows, now)) return false

  const { data, error } = await supabase
    .from("profiles")
    .select("subscription_status, current_period_end")
    .eq("id", lookup.userId)
    .maybeSingle()

  if (error) throw error
  const profile = data as LegacyProfileSubscription | null
  return profile ? hasCurrentLegacyProfileAccess(profile, now) : false
}

/**
 * Product access from provider billing, one-time purchases, and legacy
 * profiles only; it is not a revenue classification. Active verified trials
 * are included so partner/fresh-start resets keep independently saved work.
 * Manual grants are deliberately excluded so a revoked field-test grant
 * cannot be mistaken for an independent entitlement.
 */
export async function hasCurrentPaidAppAccess(
  supabase: SupabaseBillingClient,
  lookup: { userId: string },
  now: Date = new Date(),
): Promise<boolean> {
  const rows = await findBillingSubscriptionsForUser(supabase, lookup.userId)
  if (rows.some((row) => hasCurrentBillingAccess(row, now))) return true
  const purchase = await findCurrentOneTimePurchaseForUser(supabase, lookup.userId)
  if (purchase) return true
  if (hasTrialAccessMarker(rows, now)) return false
  const { data, error } = await supabase
    .from("profiles")
    .select("subscription_status, current_period_end")
    .eq("id", lookup.userId)
    .maybeSingle()
  if (error) throw error
  const profile = data as LegacyProfileSubscription | null
  return profile ? hasCurrentLegacyProfileAccess(profile, now) : false
}

/**
 * An active partner ("Partnerzugang") grant is, like a provider subscription
 * or one-time purchase, an independent entitlement that does not depend on
 * a moderator/field-test membership — so it must count alongside
 * `hasCurrentPaidAppAccess` wherever a moderator's ended/unavailable state
 * recomputes `hasIndependentPaidEntitlement` (middleware.ts, entitlements/
 * access.ts). Deliberately narrower than `findCurrentManualAccessGrant`:
 * only an unrevoked, non-expiring (`expires_at IS NULL`) `reason = 'partner'`
 * row counts. The query never reads `partner_access_invitations`, so "a revoked
 * invitation never keeps counting" holds only because `revoke_partner_access`
 * revokes the invitation's `current_manual_access_grant_id` in the same
 * statement — the grant row itself is the sole source of truth here.
 */
export async function hasCurrentPartnerAccess(
  supabase: SupabaseBillingClient,
  lookup: { userId: string },
): Promise<boolean> {
  const { data, error } = await supabase
    .from("manual_access_grants")
    .select("id")
    .eq("user_id", lookup.userId)
    .eq("reason", "partner")
    .is("expires_at", null)
    .is("revoked_at", null)
    .limit(1)
    .maybeSingle()
  if (error) {
    if (isMissingManualAccessGrantsTableError(error)) return false
    throw error
  }
  return Boolean(data)
}

export async function findCurrentManualAccessGrant(
  supabase: SupabaseBillingClient,
  lookup: { userId?: string | null; email?: string | null },
  now: Date = new Date(),
): Promise<ManualAccessGrantRow | null> {
  const grants: ManualAccessGrantRow[] = []

  if (lookup.userId) {
    const { data, error } = await supabase
      .from("manual_access_grants")
      .select("id, user_id, email, expires_at, revoked_at")
      .eq("user_id", lookup.userId)

    if (error) {
      if (isMissingManualAccessGrantsTableError(error)) return null
      throw error
    }
    grants.push(...((data as ManualAccessGrantRow[] | null) ?? []))
  }

  const email = lookup.email?.trim().toLowerCase()
  if (email) {
    const { data, error } = await supabase
      .from("manual_access_grants")
      .select("id, user_id, email, expires_at, revoked_at")
      .eq("email", email)

    if (error) {
      if (isMissingManualAccessGrantsTableError(error)) return null
      throw error
    }
    grants.push(...((data as ManualAccessGrantRow[] | null) ?? []))
  }

  const current = grants.filter((grant) => hasCurrentManualAccess(grant, now))
  current.sort((left, right) => compareNullableIsoDesc(left.expires_at, right.expires_at))
  return current[0] ?? null
}

function isMissingManualAccessGrantsTableError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false
  const candidate = error as { code?: unknown; message?: unknown }
  const code = typeof candidate.code === "string" ? candidate.code : ""
  const message = typeof candidate.message === "string" ? candidate.message : ""
  return (code === "PGRST205" || code === "42P01") && message.includes("manual_access_grants")
}

export function hasCurrentManualAccess(
  grant: Pick<ManualAccessGrantRow, "expires_at" | "revoked_at">,
  now: Date = new Date(),
): boolean {
  if (grant.revoked_at) return false
  return !grant.expires_at || isFutureIso(grant.expires_at, now)
}

export function hasCurrentBillingAccess(
  row: BillingSubscriptionRow,
  now: Date = new Date(),
): boolean {
  const trialAccess = resolveBillingTrialAccess(row, now)
  if (trialAccess !== null) return trialAccess.hasAccess

  if (OPEN_ENTITLEMENTS.has(row.entitlement_status)) {
    // Null current_period_end is legacy/incomplete billing_subscriptions
    // data (e.g. rows backfilled from profiles before a first webhook ever
    // populated the period) — there's no period end to measure a grace
    // window against, so preserve the pre-existing status-only behavior.
    if (row.current_period_end == null) return true
    return isWithinExpiryGrace(row.current_period_end, now)
  }
  return (
    row.entitlement_status === "canceled" &&
    row.cancel_at_period_end &&
    isFutureIso(row.current_period_end, now)
  )
}

async function findBillingSubscriptionsForUser(
  supabase: SupabaseBillingClient,
  userId: string,
): Promise<BillingSubscriptionRow[]> {
  const { data, error } = await supabase
    .from("billing_subscriptions")
    .select("*")
    .eq("user_id", userId)
  if (error) throw error
  return (data as BillingSubscriptionRow[] | null) ?? []
}

/**
 * True when any billing row belongs to the trial cohort, including an expired
 * or malformed projection. Callers that did not already load billing rows can
 * use this to avoid restoring legacy profile-derived access for that cohort.
 */
export async function hasTrialBillingHistory(
  supabase: SupabaseBillingClient,
  userId: string,
  now: Date = new Date(),
): Promise<boolean> {
  return hasTrialAccessMarker(await findBillingSubscriptionsForUser(supabase, userId), now)
}

function hasTrialAccessMarker(rows: BillingSubscriptionRow[], now: Date): boolean {
  return rows.some((row) => resolveBillingTrialAccess(row, now) !== null)
}

export function hasCurrentLegacyProfileAccess(
  profile: Pick<LegacyProfileSubscription, "subscription_status" | "current_period_end">,
  now: Date = new Date(),
): boolean {
  if (profile.subscription_status === "active" || profile.subscription_status === "past_due") {
    // Same null-period-end fallback as hasCurrentBillingAccess above.
    if (profile.current_period_end == null) return true
    return isWithinExpiryGrace(profile.current_period_end, now)
  }
  return profile.subscription_status === "canceled" && isFutureIso(profile.current_period_end, now)
}

export function isFutureIso(value: string | null | undefined, now: Date = new Date()): boolean {
  if (!value) return false
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) && timestamp > now.getTime()
}

function isWithinExpiryGrace(periodEndIso: string, now: Date): boolean {
  const timestamp = Date.parse(periodEndIso)
  if (!Number.isFinite(timestamp)) return false
  return timestamp >= now.getTime() - EXPIRED_ENTITLEMENT_GRACE_MS
}

function entitlementPriority(status: BillingEntitlementStatus): number {
  if (status === "active") return 0
  if (status === "past_due") return 1
  if (status === "incomplete") return 2
  return 3
}

function compareNullableIsoDesc(left: string | null, right: string | null): number {
  if (left === right) return 0
  if (!left) return 1
  if (!right) return -1
  return right.localeCompare(left)
}
