import { createHash } from "node:crypto"
import type Stripe from "stripe"
import type { SupabaseClient } from "@supabase/supabase-js"
import { upsertBillingSubscription } from "@/lib/billing/subscriptions"
import { intervalFromPrice } from "./intervals"

export interface CheckoutActivationDeps {
  supabase: SupabaseClient
  stripe: Stripe
  premiumTierId: string
  linkQuizToProfile?: (userId: string, email: string | undefined, leadId?: string) => Promise<void>
  profileLinkMode?: "await" | "defer" | "skip"
  defer?: (work: () => void | Promise<void>) => void
  now?: () => Date
}

export type CheckoutActivationErrorCode =
  | "checkout_session_id_missing"
  | "checkout_session_missing_id"
  | "checkout_session_incomplete"
  | "checkout_session_email_missing"
  | "checkout_session_customer_missing"
  | "checkout_session_subscription_missing"
  | "checkout_session_unpaid"
  | "checkout_subscription_inactive"
  | "checkout_subscription_expired"
  | "checkout_user_race_unresolved"

export class CheckoutActivationError extends Error {
  code: CheckoutActivationErrorCode

  constructor(code: CheckoutActivationErrorCode, message: string) {
    super(message)
    this.name = "CheckoutActivationError"
    this.code = code
  }
}

export interface CheckoutAccountResult {
  userId: string
  email: string
  canSetInitialPassword: boolean
}

interface ProfileRow {
  id: string
  email?: string | null
  stripe_customer_id?: string | null
}

interface SubscriptionProfilePatch {
  email: string
  stripe_customer_id: string
  stripe_subscription_id: string
  subscription_status: "active"
  subscription_interval: string | null
  current_period_end: string
  subscription_tier_id: string
}

/** Shape we actually read from the retrieved subscription. */
export interface RetrievedSub {
  id: string
  status?: string
  current_period_end?: number
  items: {
    data: Array<{
      current_period_end?: number
      price: {
        interval?: string
        interval_count?: number
        recurring?: { interval: string; interval_count: number }
      }
    }>
  }
}

interface ValidCheckoutSession {
  id: string
  email: string
  customerId: string
  subscriptionId: string
}

export async function verifyCheckoutSessionForActivation(
  sessionId: string,
  stripe?: Stripe,
): Promise<Stripe.Checkout.Session> {
  if (!sessionId) {
    throw new CheckoutActivationError(
      "checkout_session_id_missing",
      "checkout session id is required",
    )
  }

  const stripeClient = stripe ?? (await import("./client")).getStripe()
  const session = await measureCheckoutStep("stripe.checkout.sessions.retrieve", () =>
    stripeClient.checkout.sessions.retrieve(sessionId),
  )
  assertValidCheckoutSession(session)
  return session
}

export async function ensureCheckoutAccount(
  session: Stripe.Checkout.Session,
  deps: CheckoutActivationDeps,
): Promise<CheckoutAccountResult> {
  const startedAt = Date.now()
  const valid = assertValidCheckoutSession(session)
  const sessionHash = checkoutSessionHash(valid.id).slice(0, 12)
  const sub = (await measureCheckoutStep("stripe.subscriptions.retrieve", () =>
    deps.stripe.subscriptions.retrieve(valid.subscriptionId, {
      expand: ["items.data.price"],
    }),
  )) as unknown as RetrievedSub
  assertCurrentCheckoutSubscription(sub, deps.now?.() ?? new Date())

  const existingProfile = await measureCheckoutStep("profiles.findExisting", () =>
    findExistingProfile(deps, valid.email, valid.customerId),
  )

  let userId: string
  let canSetInitialPassword = false

  if (existingProfile) {
    userId = existingProfile.id
    canSetInitialPassword = await canSetPasswordForCheckoutSession(deps, userId, valid.id)
  } else {
    const created = await measureCheckoutStep("auth.createCheckoutUser", () =>
      createCheckoutUser(deps, valid.email, valid.id, valid.customerId),
    )
    if (created.created) {
      userId = created.userId
      canSetInitialPassword = true
    } else {
      userId = created.userId
    }
  }

  const price = sub.items.data[0].price
  const interval = intervalFromPrice({
    interval: price.recurring?.interval ?? price.interval ?? "",
    interval_count: price.recurring?.interval_count ?? price.interval_count ?? 1,
  })

  await measureCheckoutStep("profiles.upsertSubscription", () =>
    upsertSubscriptionProfile(deps, userId, {
      email: valid.email,
      stripe_customer_id: valid.customerId,
      stripe_subscription_id: sub.id,
      subscription_status: "active",
      subscription_interval: interval,
      current_period_end: subPeriodEndIso(sub),
      subscription_tier_id: deps.premiumTierId,
    }),
  )

  await measureCheckoutStep("billing.upsertSubscription", () =>
    upsertBillingSubscription(deps.supabase, {
      user_id: userId,
      provider: "stripe",
      provider_customer_id: valid.customerId,
      provider_subscription_id: sub.id,
      provider_status: sub.status ?? "active",
      entitlement_status: stripeEntitlementStatus(sub.status),
      interval,
      current_period_end: subPeriodEndIso(sub),
      cancel_at_period_end: false,
      metadata: { checkout_session_id: valid.id },
    }),
  )

  await linkCheckoutQuizProfile(session, deps, userId, valid.email)

  console.info("[checkout-activation] account ensured", {
    sessionHash,
    userId,
    profileLinkMode: deps.profileLinkMode ?? "await",
    durationMs: Date.now() - startedAt,
  })

  return { userId, email: valid.email, canSetInitialPassword }
}

async function measureCheckoutStep<T>(label: string, work: () => Promise<T>): Promise<T> {
  const startedAt = Date.now()
  try {
    return await work()
  } finally {
    console.info("[checkout-activation] step", {
      label,
      durationMs: Date.now() - startedAt,
    })
  }
}

async function linkCheckoutQuizProfile(
  session: Stripe.Checkout.Session,
  deps: CheckoutActivationDeps,
  userId: string,
  email: string,
) {
  if (!deps.linkQuizToProfile || deps.profileLinkMode === "skip") return

  const leadId = session.metadata?.lead_id || undefined
  const work = async () => {
    const startedAt = Date.now()
    try {
      await deps.linkQuizToProfile?.(userId, email, leadId)
      console.info("[checkout-activation] quiz profile linked", {
        userId,
        hasLeadId: Boolean(leadId),
        durationMs: Date.now() - startedAt,
      })
    } catch (err) {
      console.error("[stripe] linkQuizToProfile failed:", err)
    }
  }

  if (deps.profileLinkMode === "defer" && deps.defer) {
    deps.defer(work)
    return
  }

  await work()
}

function assertCurrentCheckoutSubscription(sub: RetrievedSub, now: Date) {
  if (sub.status && sub.status !== "active") {
    throw new CheckoutActivationError(
      "checkout_subscription_inactive",
      "checkout subscription is not active",
    )
  }

  const periodEnd = subPeriodEndIso(sub)
  if (new Date(periodEnd).getTime() <= now.getTime()) {
    throw new CheckoutActivationError(
      "checkout_subscription_expired",
      "checkout subscription period has expired",
    )
  }
}

/**
 * In Stripe API version 2025-08-27.basil, current_period_end moved from the
 * Subscription root to each SubscriptionItem. Read item first, fall back to
 * root for older API versions.
 */
export function subPeriodEndIso(sub: RetrievedSub): string {
  const itemEnd = sub.items.data[0]?.current_period_end
  const rootEnd = sub.current_period_end
  const unix = itemEnd ?? rootEnd
  if (typeof unix !== "number" || Number.isNaN(unix)) {
    throw new Error("subscription has no current_period_end on item or root")
  }
  return new Date(unix * 1000).toISOString()
}

export function stripeEntitlementStatus(status: string | undefined) {
  if (status === "past_due") return "past_due"
  if (status === "incomplete" || status === "incomplete_expired") return "incomplete"
  if (status && status !== "active" && status !== "trialing") return "canceled"
  return "active"
}

function assertValidCheckoutSession(session: Stripe.Checkout.Session): ValidCheckoutSession {
  if (!session.id) {
    throw new CheckoutActivationError("checkout_session_missing_id", "checkout session has no id")
  }
  if (session.status !== "complete") {
    throw new CheckoutActivationError(
      "checkout_session_incomplete",
      "checkout session is not complete",
    )
  }
  const email = session.customer_details?.email
  if (!email) {
    throw new CheckoutActivationError(
      "checkout_session_email_missing",
      "checkout session has no customer email",
    )
  }
  if (typeof session.customer !== "string") {
    throw new CheckoutActivationError(
      "checkout_session_customer_missing",
      "checkout session customer is missing",
    )
  }
  if (typeof session.subscription !== "string") {
    throw new CheckoutActivationError(
      "checkout_session_subscription_missing",
      "checkout session subscription is missing",
    )
  }
  if (session.payment_status === "unpaid") {
    throw new CheckoutActivationError(
      "checkout_session_unpaid",
      "checkout session payment is unpaid",
    )
  }

  return {
    id: session.id,
    email,
    customerId: session.customer,
    subscriptionId: session.subscription,
  }
}

async function findExistingProfile(
  deps: CheckoutActivationDeps,
  email: string,
  customerId: string,
): Promise<ProfileRow | null> {
  const [byEmail, byCustomer] = await Promise.all([
    findProfileBy(deps, "email", email),
    findProfileBy(deps, "stripe_customer_id", customerId),
  ])
  if (byEmail) return byEmail
  return byCustomer
}

async function findProfileBy(
  deps: CheckoutActivationDeps,
  column: "email" | "stripe_customer_id",
  value: string,
): Promise<ProfileRow | null> {
  const { data, error } = await deps.supabase
    .from("profiles")
    .select("id, email, stripe_customer_id")
    .eq(column, value)
    .maybeSingle()
  if (error) throw new Error(`profile lookup failed: ${error.message}`)
  return data as ProfileRow | null
}

async function upsertSubscriptionProfile(
  deps: CheckoutActivationDeps,
  userId: string,
  patch: SubscriptionProfilePatch,
) {
  const { error } = await deps.supabase.from("profiles").upsert(
    {
      id: userId,
      ...patch,
    },
    { onConflict: "id" },
  )

  if (error) {
    throw new Error(`profile upsert failed: ${error.message}`)
  }
}

async function createCheckoutUser(
  deps: CheckoutActivationDeps,
  email: string,
  sessionId: string,
  customerId: string,
): Promise<{ userId: string; created: boolean }> {
  const { data, error } = await deps.supabase.auth.admin.createUser({
    email,
    email_confirm: true,
    app_metadata: {
      checkout_activation_session_hash: checkoutSessionHash(sessionId),
    },
  })

  if (!error && data.user) return { userId: data.user.id, created: true }

  if (isDuplicateUserError(error)) {
    const existingProfile = await findExistingProfile(deps, email, customerId)
    if (existingProfile) return { userId: existingProfile.id, created: false }

    const existingAuthUserId = await findAuthUserIdByEmail(deps, email)
    if (existingAuthUserId) return { userId: existingAuthUserId, created: false }

    throw new CheckoutActivationError(
      "checkout_user_race_unresolved",
      "createUser reported a duplicate email but no existing user could be found",
    )
  }

  throw new Error(`createUser failed: ${error?.message ?? "unknown"}`)
}

function checkoutSessionHash(sessionId: string): string {
  return createHash("sha256").update(sessionId).digest("hex")
}

async function canSetPasswordForCheckoutSession(
  deps: CheckoutActivationDeps,
  userId: string,
  sessionId: string,
): Promise<boolean> {
  const user = await getAuthUserById(deps, userId)
  if (!user) return false

  const appMetadata = isRecord(user.app_metadata) ? user.app_metadata : {}
  if (Object.prototype.hasOwnProperty.call(appMetadata, "password_initialized_at")) return false

  return appMetadata.checkout_activation_session_hash === checkoutSessionHash(sessionId)
}

async function getAuthUserById(
  deps: CheckoutActivationDeps,
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
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

async function findAuthUserIdByEmail(
  deps: CheckoutActivationDeps,
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
