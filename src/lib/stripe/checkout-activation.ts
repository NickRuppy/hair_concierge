import { createHash } from "node:crypto"
import type Stripe from "stripe"
import type { SupabaseClient } from "@supabase/supabase-js"
import { upsertBillingSubscription } from "@/lib/billing/subscriptions"
import { upsertOneTimePurchase } from "@/lib/billing/purchases"
import {
  findPersonalPlanOneTimeConsentByStripeCheckoutSessionId,
  recordPersonalPlanOneTimeConfirmation,
} from "@/lib/billing/personal-plan-one-time-consents"
import { sendPersonalPlanOneTimeConfirmation } from "@/lib/customerio/personal-plan-one-time-confirmation"
import {
  getPersonalPlanOnceStripePriceId,
  PERSONAL_PLAN_ONCE_KIND,
  PERSONAL_PLAN_ONCE_PRODUCT,
} from "@/lib/billing/offer-products"
import { intervalFromPrice } from "./intervals"

export interface CheckoutActivationDeps {
  supabase: SupabaseClient
  stripe: Stripe
  premiumTierId: string
  linkQuizToProfile?: (userId: string, email: string | undefined, leadId?: string) => Promise<void>
  profileLinkMode?: "await" | "defer" | "skip"
  defer?: (work: () => void | Promise<void>) => void
  now?: () => Date
  sendOneTimeConfirmation?: typeof sendPersonalPlanOneTimeConfirmation
}

export type CheckoutActivationErrorCode =
  | "checkout_session_id_missing"
  | "checkout_session_missing_id"
  | "checkout_session_incomplete"
  | "checkout_session_email_missing"
  | "checkout_session_customer_missing"
  | "checkout_session_subscription_missing"
  | "checkout_session_unpaid"
  | "checkout_preparation_unclaimed"
  | "checkout_subscription_inactive"
  | "checkout_subscription_expired"
  | "checkout_user_race_unresolved"
  | "checkout_one_time_invalid"
  | "checkout_one_time_payment_intent_missing"
  | "checkout_one_time_consent_missing"
  | "checkout_one_time_confirmation_failed"

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
  leadId?: string
  checkoutContext?: string
  subscriptionInterval?: string
  stripeCustomerId?: string
  stripeSubscriptionId?: string
  subscriptionStatus?: string
}

export interface OneTimeCheckoutAccountResult extends CheckoutAccountResult {
  paymentIntentId: string
  chargeId?: string
}

export type OneTimeCheckoutActivationDeps = CheckoutActivationDeps

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
    stripeClient.checkout.sessions.retrieve(sessionId, {
      expand: ["line_items.data.price", "payment_intent.latest_charge"],
    }),
  )
  if (session.metadata?.product_kind === PERSONAL_PLAN_ONCE_KIND) {
    assertOneTimeCheckoutSession(session as OneTimeSession)
    return session
  }
  assertCheckoutSessionShape(session)
  assertCheckoutPaymentAuthorized(session)
  assertCheckoutPreparationClaimed(session)
  return session
}

export async function ensureCheckoutAccount(
  session: Stripe.Checkout.Session,
  deps: CheckoutActivationDeps,
): Promise<CheckoutAccountResult> {
  const startedAt = Date.now()
  const valid = assertCheckoutSessionShape(session)
  const sessionHash = checkoutSessionHash(valid.id).slice(0, 12)
  assertCheckoutPaymentAuthorized(session)
  assertCheckoutPreparationClaimed(session)
  const sub = await retrieveCheckoutSubscription(deps.stripe, valid.subscriptionId)
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
      metadata: {
        checkout_session_id: valid.id,
        payment_status: session.payment_status ?? "unknown",
      },
    }),
  )

  await linkCheckoutQuizProfile(session, deps, userId, valid.email)

  console.info("[checkout-activation] account ensured", {
    sessionHash,
    userId,
    profileLinkMode: deps.profileLinkMode ?? "await",
    durationMs: Date.now() - startedAt,
  })

  return {
    userId,
    email: valid.email,
    canSetInitialPassword,
    leadId: session.metadata?.lead_id || undefined,
    checkoutContext: session.metadata?.checkout_context || undefined,
    subscriptionInterval: interval,
    stripeCustomerId: valid.customerId,
    stripeSubscriptionId: sub.id,
    subscriptionStatus: sub.status ?? "active",
  }
}

/** Activates the one-time personal-plan entitlement without touching subscription state. */
export async function ensureOneTimeCheckoutAccount(
  session: Stripe.Checkout.Session,
  deps: OneTimeCheckoutActivationDeps,
): Promise<OneTimeCheckoutAccountResult> {
  const verified = await retrieveOneTimeCheckoutSession(session, deps.stripe)
  const valid = assertOneTimeCheckoutSession(verified)
  const existingProfile = await findExistingProfile(deps, valid.email, valid.customerId)
  const created = existingProfile
    ? { userId: existingProfile.id, created: false }
    : await createCheckoutUser(deps, valid.email, valid.id, valid.customerId)
  const userId = created.userId
  const canSetInitialPassword = created.created
    ? true
    : await canSetPasswordForCheckoutSession(deps, userId, valid.id)

  const consent = await findPersonalPlanOneTimeConsentByStripeCheckoutSessionId(
    deps.supabase,
    valid.id,
  )
  if (!consent) {
    throw new CheckoutActivationError(
      "checkout_one_time_consent_missing",
      "one-time checkout consent is missing",
    )
  }
  if (consent.confirmation_status !== "sent" && consent.confirmation_status !== "delivered") {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
    try {
      const confirmation = await (
        deps.sendOneTimeConfirmation ?? sendPersonalPlanOneTimeConfirmation
      )({
        email: valid.email,
        consent: {
          text: consent.consent_text,
          version: consent.copy_version,
          acceptedAt: consent.accepted_at,
        },
        payment: { provider: "stripe", reference: valid.id },
        supportUrl: new URL("/kontakt", siteUrl).toString(),
        withdrawalUrl: new URL("/widerruf", siteUrl).toString(),
        resultUrl: verified.metadata?.lead_id
          ? new URL(`/result/${encodeURIComponent(verified.metadata.lead_id)}`, siteUrl).toString()
          : undefined,
      })
      await recordPersonalPlanOneTimeConfirmation(deps.supabase, consent.id, {
        provider: "stripe",
        reference: confirmation.confirmationReference,
        status: "sent",
      })
    } catch {
      await recordPersonalPlanOneTimeConfirmation(deps.supabase, consent.id, {
        provider: "stripe",
        reference: `stripe:${valid.id}:confirmation_failed`,
        status: "failed",
      }).catch(() => {})
      throw new CheckoutActivationError(
        "checkout_one_time_confirmation_failed",
        "one-time checkout confirmation could not be sent",
      )
    }
  }

  await upsertOneTimeProfile(deps, userId, valid.email, valid.customerId)
  await upsertOneTimePurchase(deps.supabase, {
    user_id: userId,
    provider: "stripe",
    provider_transaction_id: valid.paymentIntentId,
    provider_customer_id: valid.customerId,
    provider_order_id: valid.id,
    amount_minor: PERSONAL_PLAN_ONCE_PRODUCT.amountMinor,
    currency: "eur",
    status: "paid",
    paid_at: new Date((verified.created ?? Math.floor(Date.now() / 1000)) * 1000).toISOString(),
    metadata: {
      checkout_session_id: valid.id,
      ...(valid.chargeId ? { stripe_charge_id: valid.chargeId } : {}),
    },
  })
  await linkCheckoutQuizProfile(verified, deps, userId, valid.email)
  return {
    userId,
    email: valid.email,
    canSetInitialPassword,
    leadId: verified.metadata?.lead_id || undefined,
    checkoutContext: verified.metadata?.checkout_context || undefined,
    stripeCustomerId: valid.customerId,
    paymentIntentId: valid.paymentIntentId,
    chargeId: valid.chargeId,
  }
}

type OneTimeSession = Stripe.Checkout.Session & {
  payment_intent?: string | { id?: string; latest_charge?: string | { id?: string } | null } | null
  line_items?: { data?: Array<{ price?: { id?: string } | null }> } | null
}

async function retrieveOneTimeCheckoutSession(session: Stripe.Checkout.Session, stripe: Stripe) {
  if (!session.id)
    throw new CheckoutActivationError("checkout_session_missing_id", "checkout session has no id")
  return (await stripe.checkout.sessions.retrieve(session.id, {
    expand: ["line_items.data.price", "payment_intent.latest_charge"],
  })) as OneTimeSession
}

function assertOneTimeCheckoutSession(session: OneTimeSession) {
  const email = session.customer_details?.email
  const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id
  const paymentIntentId = stripeObjectId(session.payment_intent)
  const chargeId =
    typeof session.payment_intent === "object"
      ? stripeObjectId(session.payment_intent?.latest_charge)
      : null
  const expectedPriceId = getPersonalPlanOnceStripePriceId()
  const lineItemPriceIds =
    session.line_items?.data?.map((item) => item.price?.id).filter(Boolean) ?? []
  if (
    session.metadata?.product_kind !== PERSONAL_PLAN_ONCE_KIND ||
    session.mode !== "payment" ||
    session.status !== "complete" ||
    session.payment_status !== "paid" ||
    session.amount_total !== PERSONAL_PLAN_ONCE_PRODUCT.amountMinor ||
    session.currency?.toLowerCase() !== "eur" ||
    !expectedPriceId ||
    lineItemPriceIds.length !== 1 ||
    lineItemPriceIds[0] !== expectedPriceId ||
    !email ||
    !customerId
  ) {
    throw new CheckoutActivationError(
      "checkout_one_time_invalid",
      "one-time checkout session failed validation",
    )
  }
  if (!paymentIntentId) {
    throw new CheckoutActivationError(
      "checkout_one_time_payment_intent_missing",
      "one-time checkout session has no payment intent",
    )
  }
  return { id: session.id!, email, customerId, paymentIntentId, chargeId: chargeId ?? undefined }
}

function stripeObjectId(value: string | { id?: string } | null | undefined): string | null {
  return typeof value === "string" ? value : (value?.id ?? null)
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

async function retrieveCheckoutSubscription(
  stripe: Stripe,
  subscriptionId: string,
): Promise<RetrievedSub> {
  return (await measureCheckoutStep("stripe.subscriptions.retrieve", () =>
    stripe.subscriptions.retrieve(subscriptionId, {
      expand: ["items.data.price"],
    }),
  )) as unknown as RetrievedSub
}

function assertCheckoutSessionShape(session: Stripe.Checkout.Session): ValidCheckoutSession {
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
  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : isRecord(session.subscription) && typeof session.subscription.id === "string"
        ? session.subscription.id
        : null
  if (!subscriptionId) {
    throw new CheckoutActivationError(
      "checkout_session_subscription_missing",
      "checkout session subscription is missing",
    )
  }

  return {
    id: session.id,
    email,
    customerId: session.customer,
    subscriptionId,
  }
}

function assertCheckoutPaymentAuthorized(session: Stripe.Checkout.Session) {
  if (session.payment_status === "paid") return
  if (session.payment_status === "no_payment_required") return

  throw new CheckoutActivationError(
    "checkout_session_unpaid",
    "checkout session payment is not paid",
  )
}

function assertCheckoutPreparationClaimed(session: Stripe.Checkout.Session) {
  const metadata = session.metadata
  if (!metadata || !Object.keys(metadata).some((key) => key.startsWith("checkout_preparation_"))) {
    return
  }

  if (
    metadata.checkout_preparation_status === "claimed" &&
    isUuid(metadata.checkout_preparation_id) &&
    isUuid(metadata.checkout_attempt_id) &&
    isUuid(metadata.checkout_funnel_event_id)
  ) {
    return
  }

  throw new CheckoutActivationError(
    "checkout_preparation_unclaimed",
    "prepared checkout session must be claimed before activation",
  )
}

function isUuid(value: string | undefined): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value ?? "")
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

async function upsertOneTimeProfile(
  deps: CheckoutActivationDeps,
  userId: string,
  email: string,
  customerId: string,
) {
  const { error } = await deps.supabase
    .from("profiles")
    .upsert({ id: userId, email, stripe_customer_id: customerId }, { onConflict: "id" })
  if (error) throw new Error(`profile upsert failed: ${error.message}`)
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
