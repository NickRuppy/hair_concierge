import { createHash } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { BillingInterval } from "@/lib/billing/types"
import { mirrorBillingSubscriptionToProfile } from "@/lib/billing/entitlements"
import {
  findCurrentBillingSubscriptionForUser,
  upsertBillingSubscription,
} from "@/lib/billing/subscriptions"
import {
  findPayPalCheckoutIntentByToken,
  isPayPalCheckoutIntentExpired,
  markPayPalCheckoutIntentActivated,
} from "./checkout-intents"
import {
  toBillingSubscriptionInputFromPayPal,
  type PayPalSubscription,
} from "./subscription-shapes"
import { getPayPalIntervalForPlanId } from "./plans"

export interface PayPalCheckoutActivationDeps {
  supabase: SupabaseClient
  premiumTierId: string
  activationKey?: string
  accountEmail?: string | null
  interval?: BillingInterval
  leadId?: string | null
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
  | "paypal_user_race_unresolved"
  | "paypal_checkout_intent_missing"
  | "paypal_checkout_intent_expired"
  | "paypal_existing_access"

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
    }
  | { status: "pending" }
  | { status: "duplicate" }

type ProfileRow = {
  id: string
  email?: string | null
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
  if (isPayPalCheckoutIntentExpired(intent)) {
    throw new PayPalCheckoutActivationError(
      "paypal_checkout_intent_expired",
      "PayPal checkout intent is expired",
    )
  }
  if (intent.status === "duplicate") return { status: "duplicate" }
  if (!intent.provider_subscription_id) return { status: "pending" }

  const subscription = await verifyPayPalSubscriptionForActivation(intent.provider_subscription_id)
  const result = await ensurePayPalCheckoutAccount(subscription, {
    ...deps,
    activationKey: token,
    accountEmail: intent.email ?? null,
    interval: intent.interval,
    leadId: intent.lead_id,
  })
  if (result.status === "active") {
    await markPayPalCheckoutIntentActivated(deps.supabase, token)
  }
  return result
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
  const accountEmail = deps.accountEmail?.trim().toLowerCase() || valid.email.toLowerCase()
  const interval = deps.interval ?? intervalFromPlanId(valid.planId)
  const activationKey = deps.activationKey ?? valid.id
  const existingProfile = await findProfileByEmail(deps, accountEmail)

  let userId: string
  let canSetInitialPassword = false

  if (existingProfile) {
    userId = existingProfile.id
    await assertNoDifferentCurrentSubscription(deps, userId, valid.id)
    canSetInitialPassword = await canSetPasswordForPayPalSubscription(deps, userId, activationKey)
  } else {
    const created = await createPayPalCheckoutUser(deps, accountEmail, activationKey)
    if (!created.created) await assertNoDifferentCurrentSubscription(deps, created.userId, valid.id)
    if (created.created) {
      userId = created.userId
      canSetInitialPassword = true
    } else {
      userId = created.userId
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

  return {
    status: "active",
    userId,
    email: accountEmail,
    providerSubscriberEmail: billingRow.provider_subscriber_email,
    canSetInitialPassword,
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
  email: string
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
    accountEmail?.trim().toLowerCase() ||
    subscription.subscriber?.email_address?.trim().toLowerCase()
  if (!email) {
    throw new PayPalCheckoutActivationError(
      "paypal_subscription_email_missing",
      "PayPal checkout activation has no Chaarlie or subscriber email",
    )
  }

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

function intervalFromPlanId(planId: string): BillingInterval {
  const interval = getPayPalIntervalForPlanId(planId)
  if (interval) return interval
  throw new PayPalCheckoutActivationError(
    "paypal_subscription_interval_unknown",
    "PayPal subscription plan id does not match a configured interval",
  )
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

async function canSetPasswordForPayPalSubscription(
  deps: PayPalCheckoutActivationDeps,
  userId: string,
  activationKey: string,
): Promise<boolean> {
  const user = await getAuthUserById(deps, userId)
  if (!user) return false

  const appMetadata = isRecord(user.app_metadata) ? user.app_metadata : {}
  if (Object.prototype.hasOwnProperty.call(appMetadata, "password_initialized_at")) return false

  return (
    appMetadata.checkout_activation_session_hash === paypalCheckoutActivationHash(activationKey)
  )
}

async function getAuthUserById(
  deps: PayPalCheckoutActivationDeps,
  userId: string,
): Promise<{ app_metadata?: unknown } | null> {
  const admin = deps.supabase.auth.admin as unknown as {
    getUserById?: (userId: string) => Promise<{
      data?: { user?: { app_metadata?: unknown } | null }
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
