import { createHash } from "node:crypto"
import { markMembershipReactivationCheckoutCompleted } from "@/lib/reactivation/checkout-reservations"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { BillingInterval, BillingSubscriptionRow } from "@/lib/billing/types"
import { mirrorBillingSubscriptionToProfile } from "@/lib/billing/entitlements"
import {
  findBillingSubscriptionByProviderId,
  findCurrentBillingSubscriptionForUser,
  upsertBillingSubscription,
} from "@/lib/billing/subscriptions"
import {
  findPayPalCheckoutIntentByToken,
  isPayPalCheckoutIntentExpired,
  markPayPalCheckoutIntentActivated,
  type PayPalCheckoutIntentRow,
} from "./checkout-intents"
import {
  toBillingSubscriptionInputFromPayPal,
  type PayPalSubscription,
} from "./subscription-shapes"
import { getPayPalIntervalForPlanId } from "./plans"
import { resolveLegacyQuizFuturePurchaseEligibility } from "@/lib/personal-plan/legacy-cutover-eligibility"
import type { CheckoutRecoveryCode } from "@/lib/auth/checkout-activation-outcome"

export interface PayPalCheckoutActivationDeps {
  supabase: SupabaseClient
  premiumTierId: string
  retrievePayPalSubscription?: (subscriptionId: string) => Promise<PayPalSubscription>
  activationKey?: string
  accountEmail?: string | null
  interval?: BillingInterval
  expectedPlanId?: string | null
  expectedPlanIdRequired?: boolean
  leadId?: string | null
  checkoutContext?: string | null
  linkQuizToProfile?: (userId: string, email: string | undefined, leadId?: string) => Promise<void>
  profileLinkMode?: "await" | "defer" | "skip"
  defer?: (work: () => void | Promise<void>) => void
}

export type PayPalCheckoutActivationErrorCode =
  | "paypal_subscription_id_missing"
  | "paypal_subscription_missing_id"
  | "paypal_subscription_email_missing"
  | "paypal_subscription_inactive"
  | "paypal_subscription_period_missing"
  | "paypal_subscription_interval_unknown"
  | "paypal_subscription_plan_mismatch"
  | "paypal_user_race_unresolved"
  | "paypal_existing_subscription_owner_missing"
  | "paypal_existing_subscription_owner_mismatch"
  | "paypal_checkout_intent_missing"
  | "paypal_checkout_intent_expired"
  | "paypal_existing_access"
  | "paypal_order_intent_missing"
  | "paypal_order_intent_expired"
  | "paypal_order_capture_pending"
  | "paypal_order_capture_incomplete"
  | "paypal_order_confirmation_failed"

export class PayPalCheckoutActivationError extends Error {
  code: PayPalCheckoutActivationErrorCode

  constructor(code: PayPalCheckoutActivationErrorCode, message: string) {
    super(message)
    this.name = "PayPalCheckoutActivationError"
    this.code = code
  }
}

export type PayPalCheckoutAccountResult =
  | {
      status: "active"
      userId: string
      email: string
      providerSubscriberEmail: string | null
      canSetInitialPassword: boolean
      leadId?: string | null
      checkoutContext?: string | null
      legacyQuizFuturePurchaseEligible?: boolean
      trialEnrollmentId?: string
      authorizationSucceededAt?: string
      trialEndAt?: string
    }
  | { status: "pending" }
  | { status: "duplicate"; recoveryCode?: CheckoutRecoveryCode }

type ProfileRow = {
  id: string
  email?: string | null
}

export async function ensurePayPalOneTimePurchaseAccount(
  deps: PayPalCheckoutActivationDeps,
  input: { email: string; activationKey: string; leadId?: string | null; paidAt?: string | null },
): Promise<Extract<PayPalCheckoutAccountResult, { status: "active" }>> {
  const email = input.email.trim().toLowerCase()
  const existing = await findProfileByEmail(deps, email)
  const created = existing ? null : await createPayPalCheckoutUser(deps, email, input.activationKey)
  const userId = existing?.id ?? created!.userId
  const canSetInitialPassword = existing
    ? await canSetInitialPasswordForPayPalCheckout(deps.supabase, userId, input.activationKey)
    : created!.created
  await upsertSubscriptionProfile(deps, userId, { email })
  if (deps.linkQuizToProfile && input.leadId)
    await deps.linkQuizToProfile(userId, email, input.leadId)
  return {
    status: "active",
    userId,
    email,
    providerSubscriberEmail: null,
    canSetInitialPassword,
    leadId: input.leadId ?? null,
    checkoutContext: null,
    legacyQuizFuturePurchaseEligible: await resolveLegacyQuizFuturePurchaseEligibility(
      deps.supabase,
      { userId, leadId: input.leadId, paidAt: input.paidAt, provider: "paypal" },
    ),
  }
}

export async function verifyPayPalSubscriptionForActivation(
  subscriptionId: string,
): Promise<PayPalSubscription> {
  if (!subscriptionId) {
    throw new PayPalCheckoutActivationError(
      "paypal_subscription_id_missing",
      "PayPal subscription id is required",
    )
  }

  const { retrievePayPalSubscription } = await import("./subscriptions")
  const subscription = await retrievePayPalSubscription(subscriptionId)
  if (!subscription.id) {
    throw new PayPalCheckoutActivationError(
      "paypal_subscription_missing_id",
      "PayPal subscription has no id",
    )
  }
  return subscription
}

export async function ensurePayPalCheckoutAccountForToken(
  token: string,
  deps: PayPalCheckoutActivationDeps,
): Promise<PayPalCheckoutAccountResult> {
  const intent = await findPayPalCheckoutIntentByToken(deps.supabase, token)
  if (!intent) {
    throw new PayPalCheckoutActivationError(
      "paypal_checkout_intent_missing",
      "PayPal checkout intent is missing",
    )
  }
  if (Object.keys(intent.metadata ?? {}).some((key) => key.startsWith("trial_"))) {
    const { ensurePayPalTrialCheckoutAccount } = await import("./trial-account-admission")
    return ensurePayPalTrialCheckoutAccount(intent, deps)
  }
  if (isPayPalCheckoutIntentExpired(intent)) {
    throw new PayPalCheckoutActivationError(
      "paypal_checkout_intent_expired",
      "PayPal checkout intent is expired",
    )
  }
  if (intent.status === "duplicate") return { status: "duplicate" }
  if (!intent.provider_subscription_id) return { status: "pending" }

  const subscription = await (
    deps.retrievePayPalSubscription ?? verifyPayPalSubscriptionForActivation
  )(intent.provider_subscription_id)
  const result = await ensurePayPalCheckoutAccount(subscription, {
    ...deps,
    activationKey: token,
    accountEmail: intent.email ?? null,
    interval: intent.interval,
    expectedPlanId:
      typeof intent.metadata.paypal_plan_id === "string" ? intent.metadata.paypal_plan_id : null,
    expectedPlanIdRequired: Object.hasOwn(intent.metadata, "paypal_plan_id"),
    leadId: intent.lead_id,
    checkoutContext:
      typeof intent.metadata.checkout_context === "string"
        ? intent.metadata.checkout_context
        : null,
  })
  if (result.status === "active") {
    if (intent.reactivation_reservation_id != null) {
      const billingRow = await findBillingSubscriptionByProviderId(
        deps.supabase,
        "paypal",
        subscription.id!,
      )
      await completePayPalReactivationCheckout(deps.supabase, {
        intent,
        subscription,
        activation: result,
        billingRow,
      })
    } else {
      await markPayPalCheckoutIntentActivated(deps.supabase, token)
    }
  }
  return result
}

/** Close only the local intent that owns this verified, durable subscription activation. */
export async function completePayPalReactivationCheckout(
  supabase: SupabaseClient,
  input: {
    intent: PayPalCheckoutIntentRow | null
    subscription: PayPalSubscription
    activation: PayPalCheckoutAccountResult
    billingRow: BillingSubscriptionRow | null
  },
): Promise<void> {
  const { intent, subscription, activation, billingRow } = input
  if (!intent || intent.reactivation_reservation_id == null) return
  const reservationId = intent.reactivation_reservation_id
  if (activation.status !== "active" || subscription.status !== "ACTIVE") return

  // Re-read the durable intent, then guard its activation mark against concurrent quarantine.
  const current = await findPayPalCheckoutIntentByToken(supabase, intent.token)
  if (
    !current ||
    current.id !== intent.id ||
    current.reactivation_reservation_id !== reservationId ||
    !["created", "approved", "activated"].includes(current.status) ||
    current.metadata.checkout_context !== "membership_reactivation" ||
    current.metadata.reactivation_reservation_id !== reservationId ||
    !current.user_id ||
    current.user_id !== activation.userId ||
    !billingRow ||
    billingRow.user_id !== current.user_id ||
    billingRow.provider !== "paypal" ||
    billingRow.entitlement_status !== "active" ||
    current.provider_subscription_id !== subscription.id ||
    billingRow.provider_subscription_id !== subscription.id
  ) {
    throw new PayPalCheckoutActivationError(
      "paypal_existing_subscription_owner_mismatch",
      "PayPal reactivation binding does not match verified activation",
    )
  }
  const { data: activatedIntent, error } = await supabase
    .from("paypal_checkout_intents")
    .update({ status: "activated", updated_at: new Date().toISOString() })
    .eq("id", current.id)
    .eq("reactivation_reservation_id", reservationId)
    .eq("user_id", current.user_id)
    .eq("provider_subscription_id", subscription.id!)
    .in("status", ["created", "approved", "activated"])
    .select("id")
    .maybeSingle()
  if (error) throw error
  if (!activatedIntent) {
    throw new PayPalCheckoutActivationError(
      "paypal_existing_subscription_owner_mismatch",
      "PayPal reactivation intent changed before activation was recorded",
    )
  }
  await markMembershipReactivationCheckoutCompleted(supabase, reservationId, current.user_id, {
    provider: "paypal",
    providerReference: current.id,
  })
}

export async function ensurePayPalCheckoutAccount(
  subscription: PayPalSubscription,
  deps: PayPalCheckoutActivationDeps,
): Promise<PayPalCheckoutAccountResult> {
  const status = subscription.status ?? ""
  if (status === "APPROVAL_PENDING" || status === "APPROVED") return { status: "pending" }
  if (status !== "ACTIVE") {
    throw new PayPalCheckoutActivationError(
      "paypal_subscription_inactive",
      "PayPal subscription is not active",
    )
  }

  const valid = assertActivePayPalSubscription(subscription, deps.accountEmail)
  const existingBilling = await findBillingSubscriptionByProviderId(
    deps.supabase,
    "paypal",
    valid.id,
  )
  const explicitAccountEmail = normalizeEmail(deps.accountEmail)
  let accountEmail: string
  let interval: BillingInterval
  const activationKey = deps.activationKey ?? valid.id

  let userId: string
  let canSetInitialPassword = false

  if (existingBilling) {
    userId = existingBilling.user_id
    interval = deps.interval ?? existingBilling.interval ?? intervalFromPlanId(valid.planId)
    accountEmail = await resolveExistingPayPalSubscriptionOwnerEmail(deps, userId)
    if (explicitAccountEmail && explicitAccountEmail !== accountEmail) {
      throw new PayPalCheckoutActivationError(
        "paypal_existing_subscription_owner_mismatch",
        "PayPal checkout account email does not match the existing subscription owner",
      )
    }
  } else {
    assertNewLegacyPayPalCheckoutPlan(subscription, {
      expectedInterval: deps.interval,
      expectedPlanId: deps.expectedPlanId,
      expectedPlanIdRequired: deps.expectedPlanIdRequired,
    })
    if (!valid.email) {
      throw new PayPalCheckoutActivationError(
        "paypal_subscription_email_missing",
        "PayPal checkout activation has no Chaarlie or subscriber email",
      )
    }
    accountEmail = valid.email
    interval = deps.interval ?? intervalFromPlanId(valid.planId)
    const existingProfile = await findProfileByEmail(deps, accountEmail)

    if (existingProfile) {
      userId = existingProfile.id
      await assertNoDifferentCurrentSubscription(deps, userId, valid.id)
      canSetInitialPassword = await canSetInitialPasswordForPayPalCheckout(
        deps.supabase,
        userId,
        activationKey,
      )
    } else {
      const created = await createPayPalCheckoutUser(deps, accountEmail, activationKey)
      if (!created.created)
        await assertNoDifferentCurrentSubscription(deps, created.userId, valid.id)
      userId = created.userId
      canSetInitialPassword = created.created
    }
  }

  await upsertSubscriptionProfile(deps, userId, {
    email: accountEmail,
    subscription_status: "active",
    subscription_interval: interval,
    current_period_end: valid.periodEnd,
    subscription_tier_id: deps.premiumTierId,
  })

  const billingRow = await upsertBillingSubscription(
    deps.supabase,
    toBillingSubscriptionInputFromPayPal(subscription, userId, interval),
  )
  await mirrorBillingSubscriptionToProfile(deps.supabase, billingRow, deps.premiumTierId)
  await linkPayPalQuizProfile(subscription, deps, userId, accountEmail)
  const legacyQuizFuturePurchaseEligible = await resolveLegacyQuizFuturePurchaseEligibility(
    deps.supabase,
    {
      userId,
      leadId: deps.leadId,
      paidAt: subscription.start_time ?? null,
      provider: "paypal",
    },
  )

  return {
    status: "active",
    userId,
    email: accountEmail,
    providerSubscriberEmail: billingRow.provider_subscriber_email,
    canSetInitialPassword,
    leadId: deps.leadId ?? null,
    checkoutContext: deps.checkoutContext ?? null,
    legacyQuizFuturePurchaseEligible,
  }
}

async function assertNoDifferentCurrentSubscription(
  deps: PayPalCheckoutActivationDeps,
  userId: string,
  providerSubscriptionId: string,
) {
  const current = await findCurrentBillingSubscriptionForUser(deps.supabase, userId)
  if (!current) return
  if (current.provider === "paypal" && current.provider_subscription_id === providerSubscriptionId)
    return
  throw new PayPalCheckoutActivationError(
    "paypal_existing_access",
    "Chaarlie account already has current subscription access",
  )
}

export function paypalCheckoutActivationId(subscriptionId: string): string {
  return `paypal:${subscriptionId}`
}

export function paypalCheckoutActivationHash(subscriptionId: string): string {
  return createHash("sha256").update(paypalCheckoutActivationId(subscriptionId)).digest("hex")
}

function assertActivePayPalSubscription(
  subscription: PayPalSubscription,
  accountEmail?: string | null,
): {
  id: string
  email: string | null
  planId: string
  periodEnd: string
} {
  if (!subscription.id) {
    throw new PayPalCheckoutActivationError(
      "paypal_subscription_missing_id",
      "PayPal subscription has no id",
    )
  }

  const email =
    normalizeEmail(accountEmail) ?? normalizeEmail(subscription.subscriber?.email_address)

  const periodEnd = subscription.billing_info?.next_billing_time
  if (!periodEnd) {
    throw new PayPalCheckoutActivationError(
      "paypal_subscription_period_missing",
      "PayPal subscription has no next billing time",
    )
  }

  return {
    id: subscription.id,
    email,
    planId: subscription.plan_id ?? "",
    periodEnd,
  }
}

function normalizeEmail(email: string | null | undefined): string | null {
  return email?.trim().toLowerCase() || null
}

function intervalFromPlanId(planId: string): BillingInterval {
  const interval = getPayPalIntervalForPlanId(planId)
  if (interval) return interval
  throw new PayPalCheckoutActivationError(
    "paypal_subscription_interval_unknown",
    "PayPal subscription plan id does not match a configured interval",
  )
}

export function assertNewLegacyPayPalCheckoutPlan(
  subscription: PayPalSubscription,
  expected: {
    expectedInterval?: BillingInterval
    expectedPlanId?: string | null
    expectedPlanIdRequired?: boolean
  },
): BillingInterval {
  const planId = subscription.plan_id?.trim() ?? ""
  const interval = intervalFromPlanId(planId)
  if (expected.expectedInterval && expected.expectedInterval !== interval) {
    throw new PayPalCheckoutActivationError(
      "paypal_subscription_plan_mismatch",
      "PayPal subscription plan interval does not match the checkout intent",
    )
  }
  const expectedPlanId = expected.expectedPlanId?.trim()
  if (expected.expectedPlanIdRequired && !expectedPlanId) {
    throw new PayPalCheckoutActivationError(
      "paypal_subscription_plan_mismatch",
      "PayPal checkout intent has an invalid stored plan id",
    )
  }
  if (expectedPlanId && expectedPlanId !== planId) {
    throw new PayPalCheckoutActivationError(
      "paypal_subscription_plan_mismatch",
      "PayPal subscription plan id does not match the checkout intent",
    )
  }
  return interval
}

async function findProfileByEmail(
  deps: PayPalCheckoutActivationDeps,
  email: string,
): Promise<ProfileRow | null> {
  const { data, error } = await deps.supabase
    .from("profiles")
    .select("id, email")
    .eq("email", email.toLowerCase())
    .maybeSingle()
  if (error) throw new Error(`profile lookup failed: ${error.message}`)
  return data as ProfileRow | null
}

async function findProfileById(
  deps: PayPalCheckoutActivationDeps,
  userId: string,
): Promise<ProfileRow | null> {
  const { data, error } = await deps.supabase
    .from("profiles")
    .select("id, email")
    .eq("id", userId)
    .maybeSingle()
  if (error) throw new Error(`profile lookup failed: ${error.message}`)
  return data as ProfileRow | null
}

async function resolveExistingPayPalSubscriptionOwnerEmail(
  deps: PayPalCheckoutActivationDeps,
  userId: string,
): Promise<string> {
  const profile = await findProfileById(deps, userId)
  const profileEmail = normalizeEmail(profile?.email)
  if (profileEmail) return profileEmail

  const authUser = await getAuthUserById(deps.supabase, userId)
  const authEmail = normalizeEmail(authUser?.email)
  if (authEmail) return authEmail

  throw new PayPalCheckoutActivationError(
    "paypal_existing_subscription_owner_missing",
    "PayPal subscription owner identity is unavailable",
  )
}

async function upsertSubscriptionProfile(
  deps: PayPalCheckoutActivationDeps,
  userId: string,
  patch: Record<string, unknown>,
) {
  const { error } = await deps.supabase.from("profiles").upsert(
    {
      id: userId,
      ...patch,
    },
    { onConflict: "id" },
  )

  if (error) throw new Error(`profile upsert failed: ${error.message}`)
}

async function createPayPalCheckoutUser(
  deps: PayPalCheckoutActivationDeps,
  email: string,
  activationKey: string,
): Promise<{ userId: string; created: boolean }> {
  const { data, error } = await deps.supabase.auth.admin.createUser({
    email,
    email_confirm: true,
    app_metadata: {
      checkout_activation_session_hash: paypalCheckoutActivationHash(activationKey),
    },
  })

  if (!error && data.user) return { userId: data.user.id, created: true }

  if (isDuplicateUserError(error)) {
    const existingProfile = await findProfileByEmail(deps, email)
    if (existingProfile) return { userId: existingProfile.id, created: false }

    const existingAuthUserId = await findAuthUserIdByEmail(deps, email)
    if (existingAuthUserId) return { userId: existingAuthUserId, created: false }

    throw new PayPalCheckoutActivationError(
      "paypal_user_race_unresolved",
      "createUser reported a duplicate email but no existing user could be found",
    )
  }

  throw new Error(`createUser failed: ${error?.message ?? "unknown"}`)
}

export async function canSetInitialPasswordForPayPalCheckout(
  supabase: SupabaseClient,
  userId: string,
  activationKey: string,
): Promise<boolean> {
  const user = await getAuthUserById(supabase, userId)
  if (!user) return false

  const appMetadata = isRecord(user.app_metadata) ? user.app_metadata : {}
  if (Object.prototype.hasOwnProperty.call(appMetadata, "password_initialized_at")) return false

  return (
    appMetadata.checkout_activation_session_hash === paypalCheckoutActivationHash(activationKey)
  )
}

async function getAuthUserById(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ email?: string | null; app_metadata?: unknown } | null> {
  const admin = supabase.auth.admin as unknown as {
    getUserById?: (userId: string) => Promise<{
      data?: { user?: { email?: string | null; app_metadata?: unknown } | null }
      error?: { message?: string } | null
    }>
  }

  if (typeof admin.getUserById !== "function") return null
  const { data, error } = await admin.getUserById(userId)
  if (error) throw new Error(`getUserById failed: ${error.message ?? "unknown"}`)
  return data?.user ?? null
}

async function findAuthUserIdByEmail(
  deps: PayPalCheckoutActivationDeps,
  email: string,
): Promise<string | null> {
  const admin = deps.supabase.auth.admin as unknown as {
    listUsers?: (params?: { page?: number; perPage?: number }) => Promise<{
      data?: { users?: Array<{ id: string; email?: string | null }> }
      error?: { message?: string } | null
    }>
  }

  if (typeof admin.listUsers !== "function") return null
  const { data, error } = await admin.listUsers({ page: 1, perPage: 1000 })
  if (error) throw new Error(`listUsers failed: ${error.message ?? "unknown"}`)

  const normalized = email.toLowerCase()
  return data?.users?.find((user) => user.email?.toLowerCase() === normalized)?.id ?? null
}

async function linkPayPalQuizProfile(
  subscription: PayPalSubscription,
  deps: PayPalCheckoutActivationDeps,
  userId: string,
  email: string,
) {
  if (!deps.linkQuizToProfile || deps.profileLinkMode === "skip") return

  const leadId =
    deps.leadId ?? (deps.activationKey ? undefined : subscription.custom_id || undefined)
  const work = async () => {
    try {
      await deps.linkQuizToProfile?.(userId, email, leadId)
    } catch (err) {
      console.error("[paypal] linkQuizToProfile failed:", err)
    }
  }

  if (deps.profileLinkMode === "defer" && deps.defer) {
    deps.defer(work)
    return
  }

  await work()
}

function isDuplicateUserError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false
  const err = error as { message?: unknown; code?: unknown; status?: unknown }
  const text = `${String(err.message ?? "")} ${String(err.code ?? "")}`.toLowerCase()
  return (
    text.includes("already registered") ||
    text.includes("already exists") ||
    text.includes("duplicate") ||
    text.includes("email_exists") ||
    text.includes("user_already_exists") ||
    err.status === 422
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/** Reuse checkout identity and password capability without writing a paid entitlement. */
export async function ensurePayPalTrialAccountIdentity(
  intent: PayPalCheckoutIntentRow,
  deps: PayPalCheckoutActivationDeps,
  ownedUserId: string | null,
): Promise<Extract<PayPalCheckoutAccountResult, { status: "active" }>> {
  const email = normalizeEmail(intent.email)
  if (!email)
    throw new PayPalCheckoutActivationError(
      "paypal_subscription_email_missing",
      "PayPal trial account email missing",
    )
  const ownerId = ownedUserId ?? intent.user_id
  if (ownedUserId && intent.user_id && ownedUserId !== intent.user_id)
    throw new Error("PayPal trial account owner mismatch")
  let userId: string
  let canSetInitialPassword: boolean
  if (ownerId) {
    if ((await resolveExistingPayPalSubscriptionOwnerEmail(deps, ownerId)) !== email)
      throw new Error("PayPal trial account email mismatch")
    userId = ownerId
    canSetInitialPassword = await canSetInitialPasswordForPayPalCheckout(
      deps.supabase,
      userId,
      intent.token,
    )
  } else {
    const existing = await findProfileByEmail(deps, email)
    if (existing) {
      userId = existing.id
      canSetInitialPassword = await canSetInitialPasswordForPayPalCheckout(
        deps.supabase,
        userId,
        intent.token,
      )
    } else {
      const created = await createPayPalCheckoutUser(deps, email, intent.token)
      userId = created.userId
      canSetInitialPassword = created.created
    }
  }
  await upsertSubscriptionProfile(deps, userId, { email })
  return {
    status: "active",
    userId,
    email,
    canSetInitialPassword,
    providerSubscriberEmail: null,
    leadId: intent.lead_id,
    checkoutContext:
      typeof intent.metadata.checkout_context === "string"
        ? intent.metadata.checkout_context
        : null,
    legacyQuizFuturePurchaseEligible: false,
  }
}
