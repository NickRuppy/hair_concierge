import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { createClient } from "@supabase/supabase-js"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { assertCanStartCheckout, assertCanStartCheckoutForEmail } from "@/lib/billing/subscriptions"
import { captureCheckoutException } from "@/lib/observability/checkout"
import { FUNNEL_SESSION_COOKIE, FUNNEL_TOUCH_COOKIE } from "@/lib/funnel/cookie"
import type { FunnelCookieContext } from "@/lib/funnel/cookie"
import {
  recordFunnelEvent,
  assertPersonalPlanOneTimeCheckoutAuthorized,
  resolveFunnelCookieContext,
  resolveFunnelContextForLead,
  resolvePendingFunnelTouchValue,
} from "@/lib/funnel/server"
import {
  bindPersonalPlanOneTimeConsentProviderReference,
  createPersonalPlanOneTimeCheckoutConsent,
  PERSONAL_PLAN_ONE_TIME_CONSENT_COPY_VERSION,
} from "@/lib/billing/personal-plan-one-time-consents"
import { getStripe, PRICE_IDS } from "@/lib/stripe/client"
import { buildStripeCheckoutSessionParams } from "@/lib/stripe/checkout-session-params"
import type { BillingInterval } from "@/lib/stripe/intervals"
import { getStripePricingPlan } from "@/lib/stripe/pricing-plans"
import {
  getPersonalPlanOnceStripePriceId,
  PERSONAL_PLAN_ONCE_KIND,
  PERSONAL_PLAN_ONCE_PRODUCT,
} from "@/lib/billing/offer-products"
import {
  acquireMembershipReactivationCheckout,
  bindMembershipReactivationProviderReference,
  claimMembershipReactivationProvider,
  expireMembershipReactivationCheckoutReservation,
  markMembershipReactivationReconciliationRequired,
  MembershipReactivationCheckoutConflictError,
  type MembershipReactivationCheckoutReservation,
} from "@/lib/reactivation/checkout-reservations"
import { sanitizeReactivationReturnDestination } from "@/lib/reactivation/return-destination"
import { createHash, randomBytes, timingSafeEqual } from "node:crypto"
import type Stripe from "stripe"

const PREPARED_CHECKOUT_MINIMUM_TTL_SECONDS = 30 * 60
const PREPARED_CHECKOUT_EXPIRY_MARGIN_SECONDS = 60
export const PREPARED_SESSION_UNAVAILABLE = "prepared_checkout_unavailable"
type CheckoutCommerceInterval = BillingInterval | "one_time"
type CheckoutAnalyticsPlan =
  | ReturnType<typeof getStripePricingPlan>
  | typeof PERSONAL_PLAN_ONCE_PRODUCT

export const runtime = "nodejs"

export const StripeCheckoutSessionRequestSchema = z
  .object({
    interval: z.enum(["month", "quarter", "year"]).optional(),
    purchaseKind: z.literal(PERSONAL_PLAN_ONCE_KIND).optional(),
    consentAccepted: z.literal(true).optional(),
    consentCopyVersion: z.string().optional(),
    funnelSessionId: z.string().uuid().optional(),
    // Accept null too — the client sends `leadId: null` when there's no ?lead=
    // in the URL (resubscribe path). `.optional()` alone rejects null.
    leadId: z.string().uuid().nullable().optional(),
    source: z.enum(["pricing_page", "quiz_result_offer"]).default("pricing_page"),
    funnelEventId: z.string().uuid().optional(),
    checkoutAttemptId: z.string().uuid().optional(),
    checkoutContext: z.literal("membership_reactivation").optional(),
    returnDestination: z.string().max(500).optional(),
    presentation: z.literal("offer_overlay_elements").optional(),
    action: z.enum(["create", "prepare", "claim"]).default("create"),
    preparationId: z.string().uuid().optional(),
    preparationToken: z.string().min(32).max(256).optional(),
    preparedSessionId: z.string().startsWith("cs_").optional(),
  })
  .strict()
  .superRefine(
    (
      {
        action,
        checkoutAttemptId,
        checkoutContext,
        consentAccepted,
        consentCopyVersion,
        funnelEventId,
        funnelSessionId,
        interval,
        leadId,
        preparationId,
        preparationToken,
        preparedSessionId,
        presentation,
        purchaseKind,
        returnDestination,
        source,
      },
      context,
    ) => {
      if (purchaseKind === PERSONAL_PLAN_ONCE_KIND) {
        if (interval !== undefined) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: "one-time checkout cannot include a subscription interval",
            path: ["interval"],
          })
        }
        const hasCanonicalConsent =
          consentAccepted === true &&
          consentCopyVersion === PERSONAL_PLAN_ONE_TIME_CONSENT_COPY_VERSION
        const hasValidActionContract =
          action === "prepare"
            ? Boolean(
                preparationId &&
                !checkoutAttemptId &&
                !funnelEventId &&
                consentAccepted === undefined &&
                consentCopyVersion === undefined,
              )
            : action === "claim"
              ? Boolean(
                  preparationId &&
                  preparationToken &&
                  preparedSessionId &&
                  checkoutAttemptId &&
                  funnelEventId &&
                  hasCanonicalConsent,
                )
              : false
        if (
          source !== "quiz_result_offer" ||
          presentation !== "offer_overlay_elements" ||
          !leadId ||
          !funnelSessionId ||
          !hasValidActionContract ||
          checkoutContext ||
          returnDestination
        ) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: "invalid one-time personal-plan checkout contract",
            path: ["purchaseKind"],
          })
        }
      } else if (!interval) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "subscription checkout requires an interval",
          path: ["interval"],
        })
      }
      if (presentation === "offer_overlay_elements" && source !== "quiz_result_offer") {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "offer Elements presentation requires quiz_result_offer source",
          path: ["presentation"],
        })
      }
      if (
        presentation === "offer_overlay_elements" &&
        (checkoutContext === "membership_reactivation" || returnDestination !== undefined)
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "offer Elements presentation cannot be used for reactivation",
          path: ["presentation"],
        })
      }
      if (action === "prepare") {
        if (presentation !== "offer_overlay_elements" || source !== "quiz_result_offer") {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: "prepared checkout is limited to the offer Elements presentation",
            path: ["action"],
          })
        }
        if (!preparationId) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: "prepared checkout requires a preparation id",
            path: ["preparationId"],
          })
        }
        if (checkoutAttemptId || funnelEventId || checkoutContext || returnDestination) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: "prepared checkout cannot claim an attempt or reactivation",
            path: ["action"],
          })
        }
      }
      if (action === "claim") {
        if (presentation !== "offer_overlay_elements" || source !== "quiz_result_offer") {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: "prepared checkout claims are limited to the offer Elements presentation",
            path: ["action"],
          })
        }
        if (
          !preparationId ||
          !preparationToken ||
          !preparedSessionId ||
          !checkoutAttemptId ||
          !funnelEventId
        ) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: "prepared checkout claim is incomplete",
            path: ["action"],
          })
        }
        if (checkoutContext || returnDestination) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: "prepared checkout claims cannot reactivate memberships",
            path: ["action"],
          })
        }
      }
    },
  )

export function isOfferElementsCheckoutEnabled(
  environment: {
    NEXT_PUBLIC_OFFER_PAYMENT_OVERLAY_ENABLED?: string
    NEXT_PUBLIC_STRIPE_EXPRESS_CHECKOUT_ENABLED?: string
  } = {
    NEXT_PUBLIC_OFFER_PAYMENT_OVERLAY_ENABLED:
      process.env.NEXT_PUBLIC_OFFER_PAYMENT_OVERLAY_ENABLED,
    NEXT_PUBLIC_STRIPE_EXPRESS_CHECKOUT_ENABLED:
      process.env.NEXT_PUBLIC_STRIPE_EXPRESS_CHECKOUT_ENABLED,
  },
) {
  return (
    environment.NEXT_PUBLIC_OFFER_PAYMENT_OVERLAY_ENABLED === "true" &&
    environment.NEXT_PUBLIC_STRIPE_EXPRESS_CHECKOUT_ENABLED === "true"
  )
}

export function isOfferCheckoutPrewarmEnabled(
  environment: { NEXT_PUBLIC_OFFER_CHECKOUT_PREWARM_ENABLED?: string } = {
    NEXT_PUBLIC_OFFER_CHECKOUT_PREWARM_ENABLED:
      process.env.NEXT_PUBLIC_OFFER_CHECKOUT_PREWARM_ENABLED,
  },
) {
  return environment.NEXT_PUBLIC_OFFER_CHECKOUT_PREWARM_ENABLED === "true"
}

export function shouldRecordFunnelForCheckoutAction(action: "create" | "prepare" | "claim") {
  return action !== "prepare"
}

export function reusableOneTimeStripeSessionClientSecret(
  session: Pick<Stripe.Checkout.Session, "client_secret" | "status">,
): string | null {
  return session.status === "open" && typeof session.client_secret === "string"
    ? session.client_secret
    : null
}

export function classifyOneTimeStripeSessionRecovery(
  session: Pick<Stripe.Checkout.Session, "client_secret" | "status">,
):
  | { type: "reuse"; clientSecret: string }
  | { type: "replace" }
  | { type: "complete" }
  | { type: "invalid" } {
  const clientSecret = reusableOneTimeStripeSessionClientSecret(session)
  if (clientSecret) return { type: "reuse", clientSecret }
  if (session.status === "expired") return { type: "replace" }
  if (session.status === "complete") return { type: "complete" }
  return { type: "invalid" }
}

export function preparedCheckoutExpiresAt(nowSeconds = Math.floor(Date.now() / 1000)) {
  // Stripe rejects Checkout Session expiries at its exact 30-minute floor when request latency
  // advances the server clock. Keep the user-facing lifetime short while retaining a safe margin.
  return (
    nowSeconds + PREPARED_CHECKOUT_MINIMUM_TTL_SECONDS + PREPARED_CHECKOUT_EXPIRY_MARGIN_SECONDS
  )
}

export async function POST(req: NextRequest) {
  const parsed = StripeCheckoutSessionRequestSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "bad request" }, { status: 400 })
  }
  const {
    interval,
    purchaseKind,
    funnelSessionId,
    leadId,
    source,
    funnelEventId,
    checkoutAttemptId,
    checkoutContext,
    action,
    preparationId,
    preparationToken,
    preparedSessionId,
    returnDestination: rawReturnDestination,
    presentation,
  } = parsed.data
  const isOneTimePurchase = purchaseKind === PERSONAL_PLAN_ONCE_KIND
  if (presentation === "offer_overlay_elements" && !isOfferElementsCheckoutEnabled()) {
    return NextResponse.json({ error: "bad request" }, { status: 400 })
  }
  if (action !== "create" && !isOfferCheckoutPrewarmEnabled()) {
    return NextResponse.json({ error: "not found" }, { status: 404 })
  }
  const isPreparation = action === "prepare"
  const subscriptionInterval = interval as BillingInterval
  const commerceInterval = isOneTimePurchase ? "one_time" : subscriptionInterval
  const analyticsPlan = isOneTimePurchase
    ? PERSONAL_PLAN_ONCE_PRODUCT
    : getStripePricingPlan(subscriptionInterval)

  const priceId = isOneTimePurchase
    ? getPersonalPlanOnceStripePriceId()
    : PRICE_IDS[subscriptionInterval]
  if (!priceId) {
    captureCheckoutException(new Error("Stripe price not configured"), {
      provider: "stripe",
      stage: "stripe_checkout_session_create",
      source: "pricing_page",
      interval: commerceInterval as never,
      leadId,
      status: 500,
      reason: "price_not_configured",
    })
    return NextResponse.json({ error: "price not configured" }, { status: 500 })
  }

  try {
    // Identity resolution: prefer existing Stripe customer > email > 400
    // Priority: leadId email → authed user's stripe_customer_id → authed user's email → 400
    let customerId: string | undefined
    let customerEmail: string | undefined
    let resolvedLeadId: string | null = null

    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: () => {},
        },
      },
    )
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const authenticatedUserId = user?.id
    let adminSupabase: ReturnType<typeof createBillingAdminClient> | null = null
    const getAdminSupabase = () => {
      adminSupabase ??= createBillingAdminClient()
      return adminSupabase
    }
    let reactivationReservation: MembershipReactivationCheckoutReservation | null = null
    let oneTimeConsentId: string | null = null
    let oneTimeProviderLocked: "stripe" | null = null

    if (isOneTimePurchase) {
      // Re-fetches the persisted arm; browser fields only select this guarded path.
      const authorization = await assertPersonalPlanOneTimeCheckoutAuthorized({
        leadId: leadId!,
        funnelSessionId,
      })
      if (isPreparation) {
        const { data: existing, error: lookupError } = await getAdminSupabase()
          .from("personal_plan_one_time_checkout_consents")
          .select("id, stripe_checkout_session_id, paypal_order_id")
          .eq("lead_id", authorization.leadId)
          .eq("funnel_session_id", authorization.sessionId)
          .eq("product_kind", PERSONAL_PLAN_ONCE_KIND)
          .maybeSingle()
        if (lookupError) throw lookupError
        if (existing?.paypal_order_id) {
          return NextResponse.json({ error: "payment provider already selected" }, { status: 409 })
        }
        if (existing?.stripe_checkout_session_id) {
          oneTimeProviderLocked = "stripe"
          const existingSession = await getStripe().checkout.sessions.retrieve(
            existing.stripe_checkout_session_id,
          )
          const recovery = classifyOneTimeStripeSessionRecovery(existingSession)
          if (recovery.type === "reuse") {
            return NextResponse.json({
              status: "recovered",
              client_secret: recovery.clientSecret,
              session_id: existingSession.id,
              expires_at: existingSession.expires_at,
              provider_locked: "stripe",
            })
          }
          if (recovery.type === "complete") {
            return NextResponse.json({ error: "checkout already completed" }, { status: 409 })
          }
          if (recovery.type !== "replace") {
            throw new Error("Existing one-time Stripe Session is not recoverable")
          }
        }
      } else {
        try {
          const consent = await createPersonalPlanOneTimeCheckoutConsent(getAdminSupabase(), {
            leadId: authorization.leadId,
            funnelSessionId: authorization.sessionId,
            offerVariant: authorization.offerVariant,
            userId: authenticatedUserId ?? null,
          })
          oneTimeConsentId = consent.id
        } catch (error) {
          // A retry must recover the immutable evidence/session, never create a second consent.
          const { data: existing, error: lookupError } = await getAdminSupabase()
            .from("personal_plan_one_time_checkout_consents")
            .select("id, stripe_checkout_session_id, paypal_order_id")
            .eq("lead_id", authorization.leadId)
            .eq("funnel_session_id", authorization.sessionId)
            .eq("product_kind", PERSONAL_PLAN_ONCE_KIND)
            .maybeSingle()
          if (lookupError || !existing) throw error
          if (existing.paypal_order_id) {
            return NextResponse.json(
              { error: "payment provider already selected" },
              { status: 409 },
            )
          }
          if (existing.stripe_checkout_session_id) {
            if (action === "claim") {
              if (existing.stripe_checkout_session_id === preparedSessionId) {
                oneTimeConsentId = existing.id
              } else {
                const existingSession = await getStripe().checkout.sessions.retrieve(
                  existing.stripe_checkout_session_id,
                )
                const recovery = classifyOneTimeStripeSessionRecovery(existingSession)
                if (recovery.type === "complete") {
                  return NextResponse.json({ error: "checkout already completed" }, { status: 409 })
                }
                if (recovery.type !== "replace") {
                  return NextResponse.json(
                    { error: "payment provider already selected" },
                    { status: 409 },
                  )
                }
                oneTimeConsentId = existing.id
              }
            } else if (action === "create") {
              const existingSession = await getStripe().checkout.sessions.retrieve(
                existing.stripe_checkout_session_id,
              )
              const recovery = classifyOneTimeStripeSessionRecovery(existingSession)
              if (recovery.type === "reuse") {
                return NextResponse.json({ client_secret: recovery.clientSecret })
              }
              if (recovery.type === "complete") {
                return NextResponse.json({ error: "checkout already completed" }, { status: 409 })
              }
              if (recovery.type !== "replace") {
                throw new Error("Existing one-time Stripe Session is not reusable")
              }
            } else {
              return NextResponse.json(
                { error: "payment provider already selected" },
                { status: 409 },
              )
            }
          }
          oneTimeConsentId = existing.id
        }
      }
    }

    if (checkoutContext === "membership_reactivation") {
      if (!authenticatedUserId || !checkoutAttemptId || leadId) {
        return NextResponse.json({ error: "authenticated reactivation required" }, { status: 401 })
      }
    }

    if (authenticatedUserId) {
      const adminSupabase = getAdminSupabase()
      const conflictResponse = await createStripeCheckoutAccessConflictResponse(
        adminSupabase,
        authenticatedUserId,
        user.email,
      )
      if (conflictResponse) {
        return isPreparation ? preparedCheckoutUnavailable() : conflictResponse
      }
      if (user?.email) {
        const emailConflictResponse = await createStripeCheckoutEmailAccessConflictResponse(
          adminSupabase,
          user.email,
        )
        if (emailConflictResponse) {
          return isPreparation ? preparedCheckoutUnavailable() : emailConflictResponse
        }
      }

      if (checkoutContext === "membership_reactivation" && checkoutAttemptId) {
        const returnDestination = sanitizeReactivationReturnDestination(rawReturnDestination)
        try {
          reactivationReservation = await acquireMembershipReactivationCheckout(adminSupabase, {
            userId: authenticatedUserId,
            checkoutAttemptId,
            interval: subscriptionInterval,
            returnDestination,
          })
          reactivationReservation = await claimMembershipReactivationProvider(
            adminSupabase,
            reactivationReservation.id,
            authenticatedUserId,
            "stripe",
          )
        } catch (error) {
          if (error instanceof MembershipReactivationCheckoutConflictError) {
            return NextResponse.json(
              { error: "reactivation_checkout_in_progress" },
              { status: 409 },
            )
          }
          throw error
        }
      }
    }

    if (leadId) {
      const adminSupabase = getAdminSupabase()
      const { data, error } = await adminSupabase
        .from("leads")
        .select("email")
        .eq("id", leadId)
        .maybeSingle()
      if (error) {
        console.error("[stripe] lead lookup failed before Checkout creation", {
          leadId,
          error,
        })
        captureCheckoutException(error, {
          provider: "stripe",
          stage: "stripe_checkout_session_create",
          source: "pricing_page",
          interval: commerceInterval as never,
          leadId,
          status: 500,
          reason: "lead_lookup_failed",
        })
        return isPreparation
          ? preparedCheckoutUnavailable()
          : NextResponse.json({ error: "lead lookup failed" }, { status: 500 })
      }
      customerEmail = data?.email ?? undefined
      if (customerEmail) {
        resolvedLeadId = leadId
        const conflictResponse = await createStripeCheckoutEmailAccessConflictResponse(
          adminSupabase,
          customerEmail,
          { includeEmail: false },
        )
        if (conflictResponse) {
          return isPreparation ? preparedCheckoutUnavailable() : conflictResponse
        }
      }
    }

    if (!customerId && !customerEmail) {
      // Resubscribe, direct-entry, or stale lead path — lock to the authenticated user's identity.
      if (user?.id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("stripe_customer_id")
          .eq("id", user.id)
          .single()

        if (profile?.stripe_customer_id) {
          customerId = profile.stripe_customer_id
        } else {
          customerEmail = user.email
        }
      } else {
        return isPreparation
          ? preparedCheckoutUnavailable()
          : NextResponse.json({ error: "identity required" }, { status: 400 })
      }
    }

    const origin = req.nextUrl.origin
    const stripe = getStripe()

    if (action === "claim") {
      return claimPreparedCheckoutSession({
        stripe,
        interval: commerceInterval,
        priceId,
        source,
        presentation,
        leadId: resolvedLeadId,
        userId: authenticatedUserId,
        customerId,
        customerEmail,
        preparationId: preparationId!,
        preparationToken: preparationToken!,
        preparedSessionId: preparedSessionId!,
        checkoutAttemptId: checkoutAttemptId!,
        funnelEventId: funnelEventId!,
        analyticsPlan,
        oneTimeConsentId,
        adminSupabase: isOneTimePurchase ? getAdminSupabase() : undefined,
        funnelSessionId: isOneTimePurchase ? funnelSessionId : undefined,
        cookieStore,
        userIdForFunnel: user?.id,
      })
    }

    if (reactivationReservation?.provider_reference) {
      const providerReference = reactivationReservation.provider_reference
      try {
        const existingSession = await stripe.checkout.sessions.retrieve(providerReference)
        if (existingSession.status === "expired") {
          await expireMembershipReactivationCheckoutReservation(getAdminSupabase(), {
            reservationId: reactivationReservation.id,
            userId: authenticatedUserId!,
            providerReference,
          })
          return NextResponse.json({ error: "reactivation_checkout_terminal" }, { status: 409 })
        }
        if (!existingSession.client_secret) throw new Error("existing session has no client secret")
        return NextResponse.json({ client_secret: existingSession.client_secret })
      } catch (error) {
        if (isDefinitivelyMissingStripeResource(error)) {
          await expireMembershipReactivationCheckoutReservation(getAdminSupabase(), {
            reservationId: reactivationReservation.id,
            userId: authenticatedUserId!,
            providerReference,
          })
          return NextResponse.json({ error: "reactivation_checkout_terminal" }, { status: 409 })
        }
        await markMembershipReactivationReconciliationRequired(
          getAdminSupabase(),
          reactivationReservation.id,
        ).catch(() => {})
        captureCheckoutException(error, {
          provider: "stripe",
          stage: "stripe_checkout_session_create",
          source,
          interval: commerceInterval as never,
          reason: "reactivation_session_reconciliation_required",
        })
        return NextResponse.json({ error: "reactivation_checkout_unavailable" }, { status: 409 })
      }
    }
    const funnelContext = !shouldRecordFunnelForCheckoutAction(action)
      ? null
      : ((await resolveFunnelCookieContext(cookieStore.get(FUNNEL_SESSION_COOKIE)?.value)) ??
        (await resolveFunnelContextForLead(resolvedLeadId)))
    const funnelTouch = funnelContext
      ? await resolvePendingFunnelTouchValue(
          cookieStore.get(FUNNEL_TOUCH_COOKIE)?.value,
          funnelContext,
        )
      : null

    const preparationTokenForResponse = isPreparation ? createPreparedCheckoutToken() : null
    const preparedMetadata = isPreparation
      ? buildPreparedCheckoutMetadata({
          preparationId: preparationId!,
          preparationTokenHash: hashPreparedCheckoutToken(preparationTokenForResponse!),
          interval: commerceInterval,
          priceId,
          source,
          presentation,
          identityHash: createPreparedCheckoutIdentityHash({
            authenticatedUserId,
            resolvedLeadId,
            customerId,
            customerEmail,
          }),
        })
      : undefined
    const params = buildStripeCheckoutSessionParams({
      checkoutKind: isOneTimePurchase ? PERSONAL_PLAN_ONCE_KIND : "subscription",
      origin,
      priceId,
      customerId,
      customerEmail,
      leadId: resolvedLeadId,
      funnelSessionId: funnelContext?.sessionId,
      funnelPackageKey: funnelContext?.packageKey,
      checkoutContext,
      returnDestination: reactivationReservation?.return_destination,
      reactivationReservationId: reactivationReservation?.id,
      presentation: presentation === "offer_overlay_elements" ? "elements" : "embedded_page",
      ...(!isPreparation && (checkoutAttemptId || oneTimeConsentId)
        ? {
            metadata: {
              ...(checkoutAttemptId ? { checkout_attempt_id: checkoutAttemptId } : {}),
              ...(oneTimeConsentId ? { personal_plan_once_consent_id: oneTimeConsentId } : {}),
            },
          }
        : {}),
      ...(isPreparation
        ? {
            expiresAt: preparedCheckoutExpiresAt(),
            metadata: preparedMetadata,
          }
        : {}),
    })
    const session = await stripe.checkout.sessions.create(
      params,
      reactivationReservation
        ? { idempotencyKey: `membership-reactivation:${reactivationReservation.id}` }
        : isPreparation
          ? { idempotencyKey: `offer-elements-preparation:${preparationId}` }
          : isOneTimePurchase
            ? { idempotencyKey: `personal-plan-once:${checkoutAttemptId}` }
            : undefined,
    )
    if (reactivationReservation) {
      await bindMembershipReactivationProviderReference(
        getAdminSupabase(),
        reactivationReservation.id,
        session.id,
      )
    }
    if (oneTimeConsentId) {
      await bindPersonalPlanOneTimeConsentProviderReference(getAdminSupabase(), oneTimeConsentId, {
        stripeCheckoutSessionId: session.id,
      })
    }

    if (isPreparation) {
      if (!session.client_secret || !preparationTokenForResponse) {
        throw new Error("prepared Stripe checkout session has no client secret")
      }
      // Stripe can replay the idempotent Session for the same preparation ID.
      // Never hand back a fresh token that cannot claim that existing Session.
      if (
        !hasMatchingToken(
          session.metadata?.checkout_preparation_token_hash,
          preparationTokenForResponse,
        )
      ) {
        return preparedCheckoutUnavailable()
      }
      return NextResponse.json({
        status: "prepared",
        client_secret: session.client_secret,
        session_id: session.id,
        preparation_token: preparationTokenForResponse,
        expires_at: session.expires_at,
        ...(oneTimeProviderLocked ? { provider_locked: oneTimeProviderLocked } : {}),
      })
    }

    const funnelRecorded = funnelContext
      ? await recordFunnelEvent({
          context: funnelContext,
          eventId: funnelEventId ?? crypto.randomUUID(),
          milestone: "checkout_started",
          leadId: resolvedLeadId,
          userId: user?.id,
          checkoutProvider: "stripe",
          checkoutReference: session.id,
          touch: funnelTouch,
          properties: {
            source,
            interval: commerceInterval as never,
            ...(checkoutAttemptId ? { checkout_attempt_id: checkoutAttemptId } : {}),
            ...(checkoutContext ? { checkout_context: checkoutContext } : {}),
            currency: analyticsPlan.currency,
            plan_id: analyticsPlan.analyticsId,
            value: analyticsPlan.amount,
          },
        })
          .then(() => true)
          .catch((error) => {
            console.warn("[funnel] Stripe checkout tracking failed", error)
            return false
          })
      : false

    const response = NextResponse.json({ client_secret: session.client_secret })
    if (funnelTouch && funnelRecorded) {
      response.cookies.set(FUNNEL_TOUCH_COOKIE, "", { path: "/", maxAge: 0 })
    }
    return response
  } catch (error) {
    captureCheckoutException(error, {
      provider: "stripe",
      stage: "stripe_checkout_session_create",
      source: "pricing_page",
      interval: commerceInterval as never,
      leadId,
    })
    throw error
  }
}

function isDefinitivelyMissingStripeResource(error: unknown) {
  if (!error || typeof error !== "object") return false
  const candidate = error as { code?: unknown; statusCode?: unknown }
  return candidate.code === "resource_missing" || candidate.statusCode === 404
}

export function preparedCheckoutUnavailablePayload() {
  return { status: "unavailable" as const, reason: PREPARED_SESSION_UNAVAILABLE }
}

function preparedCheckoutUnavailable() {
  // Clients deliberately receive one outcome for identity, expiry, and token failures.
  // Detailed causes are safe to add to server-only diagnostics without becoming an oracle.
  return NextResponse.json(preparedCheckoutUnavailablePayload())
}

function createPreparedCheckoutToken() {
  return randomBytes(32).toString("base64url")
}

export function hashPreparedCheckoutToken(token: string) {
  return createHash("sha256").update(token).digest("hex")
}

function createPreparedCheckoutIdentityHash(input: {
  authenticatedUserId?: string
  resolvedLeadId?: string | null
  customerId?: string
  customerEmail?: string
}) {
  const identity = input.authenticatedUserId
    ? `user:${input.authenticatedUserId}`
    : input.resolvedLeadId
      ? `lead:${input.resolvedLeadId}`
      : input.customerId
        ? `customer:${input.customerId}`
        : `email:${input.customerEmail?.trim().toLowerCase() ?? ""}`
  return createHash("sha256").update(identity).digest("hex")
}

function buildPreparedCheckoutMetadata(input: {
  preparationId: string
  preparationTokenHash: string
  interval: CheckoutCommerceInterval
  priceId: string
  source: "pricing_page" | "quiz_result_offer"
  presentation?: "offer_overlay_elements"
  identityHash: string
}) {
  return {
    checkout_preparation_id: input.preparationId,
    checkout_preparation_token_hash: input.preparationTokenHash,
    checkout_preparation_status: "prepared",
    checkout_preparation_interval: input.interval,
    checkout_preparation_price_id: input.priceId,
    checkout_preparation_source: input.source,
    checkout_preparation_presentation: input.presentation ?? "",
    checkout_preparation_identity_hash: input.identityHash,
  }
}

function hasMatchingToken(expectedHash: string | undefined, token: string) {
  if (!expectedHash || !/^[a-f0-9]{64}$/.test(expectedHash)) return false
  const expected = Buffer.from(expectedHash, "hex")
  const actual = Buffer.from(hashPreparedCheckoutToken(token), "hex")
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

export function validatePreparedCheckoutClaim(input: {
  metadata: Record<string, string>
  sessionStatus: string | null
  expiresAt: number
  nowSeconds: number
  lineItemPriceId?: string
  preparationId: string
  preparationToken: string
  interval: CheckoutCommerceInterval
  priceId: string
  source: "pricing_page" | "quiz_result_offer"
  presentation?: "offer_overlay_elements"
  identityHash: string
  checkoutAttemptId: string
  funnelEventId: string
  oneTimeConsentId?: string | null
}): { ok: true; alreadyClaimed: boolean } | { ok: false; reason: "invalid" | "stale" } {
  const expected = {
    checkout_preparation_id: input.preparationId,
    checkout_preparation_interval: input.interval,
    checkout_preparation_price_id: input.priceId,
    checkout_preparation_source: input.source,
    checkout_preparation_presentation: input.presentation ?? "",
    checkout_preparation_identity_hash: input.identityHash,
  }
  const metadataMatches = Object.entries(expected).every(
    ([key, value]) => input.metadata[key] === value,
  )
  if (
    input.sessionStatus !== "open" ||
    input.expiresAt <= input.nowSeconds ||
    !metadataMatches ||
    input.lineItemPriceId !== input.priceId
  ) {
    return { ok: false, reason: "stale" }
  }
  if (!hasMatchingToken(input.metadata.checkout_preparation_token_hash, input.preparationToken)) {
    return { ok: false, reason: "invalid" }
  }
  if (input.metadata.checkout_preparation_status === "claimed") {
    if (
      input.metadata.checkout_attempt_id !== input.checkoutAttemptId ||
      input.metadata.checkout_funnel_event_id !== input.funnelEventId ||
      (input.oneTimeConsentId &&
        input.metadata.personal_plan_once_consent_id !== input.oneTimeConsentId)
    ) {
      return { ok: false, reason: "invalid" }
    }
    return { ok: true, alreadyClaimed: true }
  }
  if (input.metadata.checkout_preparation_status !== "prepared") {
    return { ok: false, reason: "stale" }
  }
  return { ok: true, alreadyClaimed: false }
}

export function hasMatchingPreparedCheckoutClaim(
  metadata: Record<string, string>,
  checkoutAttemptId: string,
  funnelEventId: string,
  oneTimeConsentId?: string | null,
) {
  return (
    metadata.checkout_preparation_status === "claimed" &&
    metadata.checkout_attempt_id === checkoutAttemptId &&
    metadata.checkout_funnel_event_id === funnelEventId &&
    (!oneTimeConsentId || metadata.personal_plan_once_consent_id === oneTimeConsentId)
  )
}

export function preparedCheckoutClaimIdempotencyKey(preparationId: string) {
  return `offer-elements-claim:${preparationId}`
}

type OneTimeConsentAttributionRow = {
  id: string
  lead_id: string
  funnel_session_id: string
  product_kind: string
  offer_variant: string
}

type OneTimeConsentFunnelSessionRow = {
  id: string
  lead_id: string | null
  visitor_id: string
  package_key: string
  offer_variant: string
  first_seen_at: string
}

type OneTimeConsentFunnelContext = FunnelCookieContext & {
  leadId: string
  offerVariant: "personal-plan-one-time-v1"
}

export function resolveOneTimeConsentFunnelContext(input: {
  consentId: string
  expectedLeadId: string | null
  expectedFunnelSessionId: string | null
  consent: OneTimeConsentAttributionRow | null
  funnelSession: OneTimeConsentFunnelSessionRow | null
}): OneTimeConsentFunnelContext | null {
  const { consent, funnelSession } = input
  if (
    !consent ||
    !funnelSession ||
    consent.id !== input.consentId ||
    consent.product_kind !== PERSONAL_PLAN_ONCE_KIND ||
    consent.offer_variant !== "personal-plan-one-time-v1" ||
    (input.expectedLeadId !== null && consent.lead_id !== input.expectedLeadId) ||
    (input.expectedFunnelSessionId !== null &&
      consent.funnel_session_id !== input.expectedFunnelSessionId) ||
    funnelSession.id !== consent.funnel_session_id ||
    funnelSession.lead_id !== consent.lead_id ||
    funnelSession.offer_variant !== consent.offer_variant
  ) {
    return null
  }

  const issuedAt = Date.parse(funnelSession.first_seen_at)
  if (!Number.isFinite(issuedAt)) return null
  return {
    visitorId: funnelSession.visitor_id,
    sessionId: funnelSession.id,
    packageKey: funnelSession.package_key,
    issuedAt,
    leadId: consent.lead_id,
    offerVariant: consent.offer_variant,
  }
}

export function canonicalOneTimeClaimMetadata(context: OneTimeConsentFunnelContext) {
  return {
    lead_id: context.leadId,
    funnel_session_id: context.sessionId,
    funnel_package_key: context.packageKey,
    offer_variant: context.offerVariant,
  }
}

export function hasCanonicalOneTimeClaimMetadata(
  metadata: Record<string, string>,
  context: OneTimeConsentFunnelContext,
) {
  return Object.entries(canonicalOneTimeClaimMetadata(context)).every(
    ([key, value]) => metadata[key] === value,
  )
}

export function canonicalOneTimeClaimMetadataPatch(
  metadata: Record<string, string>,
  context: OneTimeConsentFunnelContext,
): Record<string, string> | null {
  const patch: Record<string, string> = {}
  for (const [key, value] of Object.entries(canonicalOneTimeClaimMetadata(context))) {
    if (metadata[key] === undefined) {
      patch[key] = value
    } else if (metadata[key] !== value) {
      return null
    }
  }
  return patch
}

export function validatePreparedCheckoutCanonicalMetadataRepair(input: {
  metadata: Record<string, string>
  sessionStatus: string | null
  lineItemPriceId?: string
  preparationId: string
  preparationToken: string
  interval: CheckoutCommerceInterval
  priceId: string
  source: "pricing_page" | "quiz_result_offer"
  presentation?: "offer_overlay_elements"
  identityHash: string
  checkoutAttemptId: string
  funnelEventId: string
  oneTimeConsentId: string
  context: OneTimeConsentFunnelContext
}): { ok: true; patch: Record<string, string> } | { ok: false } {
  const expected = {
    checkout_preparation_id: input.preparationId,
    checkout_preparation_interval: input.interval,
    checkout_preparation_price_id: input.priceId,
    checkout_preparation_source: input.source,
    checkout_preparation_presentation: input.presentation ?? "",
    checkout_preparation_identity_hash: input.identityHash,
    checkout_preparation_status: "claimed",
    checkout_attempt_id: input.checkoutAttemptId,
    checkout_funnel_event_id: input.funnelEventId,
    personal_plan_once_consent_id: input.oneTimeConsentId,
  }
  const metadataMatches = Object.entries(expected).every(
    ([key, value]) => input.metadata[key] === value,
  )
  if (
    input.sessionStatus !== "complete" ||
    input.lineItemPriceId !== input.priceId ||
    !metadataMatches ||
    !hasMatchingToken(input.metadata.checkout_preparation_token_hash, input.preparationToken)
  ) {
    return { ok: false }
  }
  const patch = canonicalOneTimeClaimMetadataPatch(input.metadata, input.context)
  return patch ? { ok: true, patch } : { ok: false }
}

async function loadOneTimeConsentFunnelContext(input: {
  adminSupabase: ReturnType<typeof createBillingAdminClient>
  consentId: string
  expectedLeadId: string | null
  expectedFunnelSessionId: string | null
}): Promise<OneTimeConsentFunnelContext | null> {
  const { data: consent, error: consentError } = await input.adminSupabase
    .from("personal_plan_one_time_checkout_consents")
    .select("id, lead_id, funnel_session_id, product_kind, offer_variant")
    .eq("id", input.consentId)
    .maybeSingle()
  if (consentError || !consent) return null

  const { data: funnelSession, error: funnelSessionError } = await input.adminSupabase
    .from("funnel_sessions")
    .select("id, lead_id, visitor_id, package_key, offer_variant, first_seen_at")
    .eq("id", consent.funnel_session_id)
    .maybeSingle()
  if (funnelSessionError) return null

  return resolveOneTimeConsentFunnelContext({
    consentId: input.consentId,
    expectedLeadId: input.expectedLeadId,
    expectedFunnelSessionId: input.expectedFunnelSessionId,
    consent,
    funnelSession,
  })
}

async function claimPreparedCheckoutSession(input: {
  stripe: Stripe
  interval: CheckoutCommerceInterval
  priceId: string
  source: "pricing_page" | "quiz_result_offer"
  presentation?: "offer_overlay_elements"
  leadId: string | null
  userId?: string
  customerId?: string
  customerEmail?: string
  preparationId: string
  preparationToken: string
  preparedSessionId: string
  checkoutAttemptId: string
  funnelEventId: string
  analyticsPlan: CheckoutAnalyticsPlan
  cookieStore: Awaited<ReturnType<typeof cookies>>
  userIdForFunnel?: string
  oneTimeConsentId?: string | null
  adminSupabase?: ReturnType<typeof createBillingAdminClient>
  funnelSessionId?: string | null
}) {
  let session: Stripe.Checkout.Session
  try {
    session = await input.stripe.checkout.sessions.retrieve(input.preparedSessionId, {
      expand: ["line_items"],
    })
  } catch (error) {
    if (isDefinitivelyMissingStripeResource(error)) return preparedCheckoutUnavailable()
    throw error
  }

  const metadata = session.metadata ?? {}
  const identityHash = createPreparedCheckoutIdentityHash({
    authenticatedUserId: input.userId,
    resolvedLeadId: input.leadId,
    customerId: input.customerId,
    customerEmail: input.customerEmail,
  })
  const lineItemPrice = session.line_items?.data[0]?.price
  const resolvedLineItemPrice =
    typeof lineItemPrice === "string" ? lineItemPrice : lineItemPrice?.id
  const oneTimeConsentFunnelContext =
    input.oneTimeConsentId && input.adminSupabase
      ? await loadOneTimeConsentFunnelContext({
          adminSupabase: input.adminSupabase,
          consentId: input.oneTimeConsentId,
          expectedLeadId: input.leadId,
          expectedFunnelSessionId: input.funnelSessionId ?? null,
        })
      : undefined
  if (input.oneTimeConsentId && !oneTimeConsentFunnelContext) return preparedCheckoutUnavailable()

  const validation = validatePreparedCheckoutClaim({
    metadata,
    sessionStatus: session.status,
    expiresAt: session.expires_at,
    nowSeconds: Math.floor(Date.now() / 1000),
    lineItemPriceId: resolvedLineItemPrice,
    preparationId: input.preparationId,
    preparationToken: input.preparationToken,
    interval: input.interval,
    priceId: input.priceId,
    source: input.source,
    presentation: input.presentation,
    identityHash,
    checkoutAttemptId: input.checkoutAttemptId,
    funnelEventId: input.funnelEventId,
    oneTimeConsentId: input.oneTimeConsentId,
  })
  if (!validation.ok) {
    if (input.oneTimeConsentId && oneTimeConsentFunnelContext) {
      const repairValidation = validatePreparedCheckoutCanonicalMetadataRepair({
        metadata,
        sessionStatus: session.status,
        lineItemPriceId: resolvedLineItemPrice,
        preparationId: input.preparationId,
        preparationToken: input.preparationToken,
        interval: input.interval,
        priceId: input.priceId,
        source: input.source,
        presentation: input.presentation,
        identityHash,
        checkoutAttemptId: input.checkoutAttemptId,
        funnelEventId: input.funnelEventId,
        oneTimeConsentId: input.oneTimeConsentId,
        context: oneTimeConsentFunnelContext,
      })
      if (repairValidation.ok) {
        const repaired = await repairCanonicalOneTimeClaimMetadata({
          stripe: input.stripe,
          sessionId: session.id,
          preparationId: input.preparationId,
          metadata,
          patch: repairValidation.patch,
        })
        if (!repaired || !hasCanonicalOneTimeClaimMetadata(repaired, oneTimeConsentFunnelContext)) {
          return preparedCheckoutUnavailable()
        }
        if (input.adminSupabase) {
          await bindPersonalPlanOneTimeConsentProviderReference(
            input.adminSupabase,
            input.oneTimeConsentId,
            { stripeCheckoutSessionId: session.id },
          )
        }
        return NextResponse.json({ error: "checkout already completed" }, { status: 409 })
      }
    }
    return preparedCheckoutUnavailable()
  }

  if (validation.alreadyClaimed) {
    if (oneTimeConsentFunnelContext) {
      const patch = canonicalOneTimeClaimMetadataPatch(metadata, oneTimeConsentFunnelContext)
      if (!patch) return preparedCheckoutUnavailable()
      const repaired = await repairCanonicalOneTimeClaimMetadata({
        stripe: input.stripe,
        sessionId: session.id,
        preparationId: input.preparationId,
        metadata,
        patch,
      })
      if (!repaired || !hasCanonicalOneTimeClaimMetadata(repaired, oneTimeConsentFunnelContext)) {
        return preparedCheckoutUnavailable()
      }
    }
    if (input.oneTimeConsentId && input.adminSupabase) {
      await bindPersonalPlanOneTimeConsentProviderReference(
        input.adminSupabase,
        input.oneTimeConsentId,
        { stripeCheckoutSessionId: session.id },
      )
    }
    const funnelResult = await recordPreparedCheckoutStarted({
      interval: input.interval,
      source: input.source,
      leadId: input.leadId,
      userId: input.userIdForFunnel,
      checkoutAttemptId: input.checkoutAttemptId,
      funnelEventId: input.funnelEventId,
      sessionId: session.id,
      analyticsPlan: input.analyticsPlan,
      cookieStore: input.cookieStore,
      funnelContext: oneTimeConsentFunnelContext ?? undefined,
    })
    const response = NextResponse.json({
      client_secret: session.client_secret,
      session_id: session.id,
      status: "claimed",
    })
    if (funnelResult.consumeTouch) {
      response.cookies.set(FUNNEL_TOUCH_COOKIE, "", { path: "/", maxAge: 0 })
    }
    return response
  }
  if (!session.client_secret) {
    return preparedCheckoutUnavailable()
  }

  const funnelContextForMetadata =
    oneTimeConsentFunnelContext ??
    (await resolveFunnelCookieContext(input.cookieStore.get(FUNNEL_SESSION_COOKIE)?.value)) ??
    (await resolveFunnelContextForLead(input.leadId))
  let claimedSession: Stripe.Checkout.Session
  try {
    claimedSession = await input.stripe.checkout.sessions.update(
      session.id,
      {
        metadata: {
          ...metadata,
          checkout_preparation_status: "claimed",
          checkout_attempt_id: input.checkoutAttemptId,
          checkout_funnel_event_id: input.funnelEventId,
          ...(input.oneTimeConsentId
            ? { personal_plan_once_consent_id: input.oneTimeConsentId }
            : {}),
          ...(oneTimeConsentFunnelContext
            ? canonicalOneTimeClaimMetadata(oneTimeConsentFunnelContext)
            : funnelContextForMetadata
              ? {
                  funnel_session_id: funnelContextForMetadata.sessionId,
                  funnel_package_key: funnelContextForMetadata.packageKey,
                }
              : {}),
        },
      },
      { idempotencyKey: preparedCheckoutClaimIdempotencyKey(input.preparationId) },
    )
  } catch (error) {
    console.warn("[stripe] prepared checkout claim update unavailable", {
      preparationId: input.preparationId,
      error: error instanceof Error ? error.message : "unknown",
    })
    return preparedCheckoutUnavailable()
  }
  if (
    !hasMatchingPreparedCheckoutClaim(
      claimedSession.metadata ?? {},
      input.checkoutAttemptId,
      input.funnelEventId,
      input.oneTimeConsentId,
    ) ||
    (oneTimeConsentFunnelContext &&
      !hasCanonicalOneTimeClaimMetadata(claimedSession.metadata ?? {}, oneTimeConsentFunnelContext))
  ) {
    return preparedCheckoutUnavailable()
  }
  if (input.oneTimeConsentId && input.adminSupabase) {
    await bindPersonalPlanOneTimeConsentProviderReference(
      input.adminSupabase,
      input.oneTimeConsentId,
      { stripeCheckoutSessionId: session.id },
    )
  }
  const funnelResult = await recordPreparedCheckoutStarted({
    interval: input.interval,
    source: input.source,
    leadId: input.leadId,
    userId: input.userIdForFunnel,
    checkoutAttemptId: input.checkoutAttemptId,
    funnelEventId: input.funnelEventId,
    sessionId: session.id,
    analyticsPlan: input.analyticsPlan,
    cookieStore: input.cookieStore,
    funnelContext: oneTimeConsentFunnelContext ?? undefined,
  })

  const response = NextResponse.json({
    client_secret: session.client_secret,
    session_id: session.id,
    status: "claimed",
  })
  if (funnelResult.consumeTouch) {
    response.cookies.set(FUNNEL_TOUCH_COOKIE, "", { path: "/", maxAge: 0 })
  }
  return response
}

async function repairCanonicalOneTimeClaimMetadata(input: {
  stripe: Stripe
  sessionId: string
  preparationId: string
  metadata: Record<string, string>
  patch: Record<string, string>
}): Promise<Record<string, string> | null> {
  if (Object.keys(input.patch).length === 0) return input.metadata
  try {
    const updatedSession = await input.stripe.checkout.sessions.update(
      input.sessionId,
      {
        metadata: {
          ...input.metadata,
          ...input.patch,
        },
      },
      { idempotencyKey: `${preparedCheckoutClaimIdempotencyKey(input.preparationId)}:canonical` },
    )
    return updatedSession.metadata ?? null
  } catch (error) {
    console.warn("[stripe] prepared checkout canonical metadata repair unavailable", {
      preparationId: input.preparationId,
      error: error instanceof Error ? error.message : "unknown",
    })
    return null
  }
}

async function recordPreparedCheckoutStarted(input: {
  interval: CheckoutCommerceInterval
  source: "pricing_page" | "quiz_result_offer"
  leadId: string | null
  userId?: string
  checkoutAttemptId: string
  funnelEventId: string
  sessionId: string
  analyticsPlan: CheckoutAnalyticsPlan
  cookieStore: Awaited<ReturnType<typeof cookies>>
  funnelContext?: FunnelCookieContext
}) {
  const funnelContext =
    input.funnelContext ??
    (await resolveFunnelCookieContext(input.cookieStore.get(FUNNEL_SESSION_COOKIE)?.value)) ??
    (await resolveFunnelContextForLead(input.leadId))
  if (!funnelContext) return { consumeTouch: false }
  const funnelTouch = await resolvePendingFunnelTouchValue(
    input.cookieStore.get(FUNNEL_TOUCH_COOKIE)?.value,
    funnelContext,
  )
  const funnelRecorded = await recordFunnelEvent({
    context: funnelContext,
    eventId: input.funnelEventId,
    milestone: "checkout_started",
    leadId: input.leadId,
    userId: input.userId,
    checkoutProvider: "stripe",
    checkoutReference: input.sessionId,
    touch: funnelTouch,
    properties: {
      source: input.source,
      interval: input.interval,
      checkout_attempt_id: input.checkoutAttemptId,
      currency: input.analyticsPlan.currency,
      plan_id: input.analyticsPlan.analyticsId,
      value: input.analyticsPlan.amount,
    },
  })
    .then(() => true)
    .catch((error) => {
      console.warn("[funnel] prepared Stripe checkout claim tracking failed", error)
      return false
    })
  return { consumeTouch: Boolean(funnelTouch && funnelRecorded) }
}

export async function createStripeCheckoutEmailAccessConflictResponse(
  supabase: Parameters<typeof assertCanStartCheckoutForEmail>[0],
  email: string,
  options: { includeEmail?: boolean } = {},
): Promise<NextResponse<{ error: "checkout_access_already_exists"; email?: string }> | null> {
  try {
    await assertCanStartCheckoutForEmail(supabase, email)
    return null
  } catch (error) {
    if (error instanceof Error && error.message.includes("already has access")) {
      return NextResponse.json(
        {
          error: "checkout_access_already_exists",
          ...(options.includeEmail === false ? {} : { email }),
        },
        { status: 409 },
      )
    }
    throw error
  }
}

function createBillingAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false },
    },
  )
}

export async function createStripeCheckoutAccessConflictResponse(
  supabase: Parameters<typeof assertCanStartCheckout>[0],
  userId: string,
  email?: string | null,
): Promise<NextResponse<{ error: "checkout_access_already_exists"; email?: string }> | null> {
  try {
    await assertCanStartCheckout(supabase, userId)
    return null
  } catch (error) {
    if (error instanceof Error && error.message.includes("already has access")) {
      return NextResponse.json(
        { error: "checkout_access_already_exists", ...(email ? { email } : {}) },
        { status: 409 },
      )
    }
    throw error
  }
}
