import { redirect } from "next/navigation"
import { after } from "next/server"
import { createHash } from "node:crypto"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { captureCheckoutException } from "@/lib/observability/checkout"
import { linkQuizToProfile } from "@/lib/quiz/link-to-profile"
import {
  ensurePayPalCheckoutAccountForToken,
  PayPalCheckoutActivationError,
} from "@/lib/paypal/checkout-activation"
import { getPremiumTierId } from "@/lib/billing/tier-ids"
import {
  getCheckoutFirstTimeDestinationOptionsFromAccount,
  getAuthenticatedCheckoutSuccessRedirect,
  getCheckoutFirstTimeDestination,
  resolvePersonalPlanCheckoutReadiness,
  resolveCheckoutFirstTimeDestination,
  type CheckoutFirstTimeDestination,
} from "@/lib/billing/checkout-success-redirect"
import { findPayPalCheckoutIntentByToken } from "@/lib/paypal/checkout-intents"
import { sanitizeReactivationReturnDestination } from "@/lib/reactivation/return-destination"
import { getPersonalPlanNewBuyerCohortCutoff } from "@/lib/personal-plan/release"
import { isPersonalPlanAppV1AllowedForUser } from "@/lib/personal-plan/rollout-access"
import {
  findOneTimePurchaseEntitlementForUser,
  resolveOneTimePurchaseAccessState,
} from "@/lib/billing/purchases"
import { markMembershipReactivationCheckoutCompleted } from "@/lib/reactivation/checkout-reservations"
import { getStripe } from "@/lib/stripe/client"
import {
  CheckoutActivationError,
  ensureCheckoutAccount,
  ensureOneTimeCheckoutAccount,
  verifyCheckoutSessionForActivation,
} from "@/lib/stripe/checkout-activation"
import { buildCheckoutPurchaseAnalytics } from "@/lib/stripe/purchase-analytics"
import { recoverPayPalOrderActivation } from "@/lib/paypal/order-activation"
import { WelcomeClient } from "./welcome-client"

export const dynamic = "force-dynamic"

export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{
    provider?: string
    purchase?: string
    return_state?: string
    session_id?: string
    token?: string
  }>
}) {
  const { provider, purchase, return_state, session_id, token } = await searchParams
  if (provider === "paypal") {
    if (purchase === "one_time") {
      const returnState =
        return_state === "failed_permanent" || return_state === "revoked" ? return_state : undefined
      return renderPayPalOneTimeWelcome(token, returnState)
    }
    return renderPayPalWelcome(token)
  }

  if (!session_id) redirect("/")
  return renderStripeWelcome(session_id)
}

async function renderStripeWelcome(session_id: string) {
  const stripe = getStripe()
  let session
  try {
    session = await verifyCheckoutSessionForActivation(session_id, stripe)
  } catch (err) {
    if (err instanceof CheckoutActivationError) {
      captureCheckoutException(err, {
        provider: "stripe",
        stage: "checkout_return",
        source: "welcome",
        stripeSessionId: session_id,
        reason: err.code,
      })

      // Activation validation can fail after Stripe has already captured a
      // one-time payment. Re-read the provider session before falling back to
      // pricing so we never invite a paid buyer to purchase again.
      const recoveredSession = await stripe.checkout.sessions.retrieve(session_id).catch(() => null)
      if (recoveredSession?.mode === "payment" && recoveredSession.payment_status === "paid") {
        return (
          <WelcomeClient
            activationSource={{
              provider: "stripe",
              sessionId: session_id,
              purchaseKind: "one_time",
            }}
            email={
              recoveredSession.customer_details?.email ??
              recoveredSession.customer_email ??
              undefined
            }
            mode="pending"
            oneTimeReturnState={oneTimeReturnStateFromError(err)}
            purchase={null}
            sessionId={session_id}
          />
        )
      }
      redirect("/pricing")
    }
    throw err
  }

  const email = session.customer_details?.email
  if (!email) redirect("/")
  const isOneTimePurchase = session.metadata?.product_kind === "personal_plan_once"
  const admin = createAdminClient()
  const firstTimeDestination = await resolveCheckoutFirstTimeDestination(
    admin,
    session.metadata?.lead_id,
    session.metadata?.checkout_context,
  )
  const purchaseAnalytics = isOneTimePurchase
    ? null
    : await buildCheckoutPurchaseAnalytics(session, stripe).catch((err) => {
        console.error("[welcome] purchase analytics unavailable:", err)
        captureCheckoutException(err, {
          provider: "stripe",
          stage: "checkout_return",
          source: "welcome",
          stripeSessionId: session_id,
          reason: "purchase_analytics_unavailable",
        })
        return null
      })

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (isOneTimePurchase) {
    const source = {
      provider: "stripe" as const,
      sessionId: session_id,
      purchaseKind: "one_time" as const,
    }
    const oneTimeDestination = await resolveCheckoutFirstTimeDestination(
      admin,
      session.metadata?.lead_id,
      session.metadata?.checkout_context,
    )
    let account
    try {
      account = await ensureOneTimeCheckoutAccount(session, {
        supabase: admin,
        stripe,
        premiumTierId: await getPremiumTierId(admin),
        linkQuizToProfile,
        defer: after,
      })
    } catch (err) {
      captureCheckoutException(err, {
        provider: "stripe",
        stage: "checkout_return",
        source: "welcome",
        stripeSessionId: session_id,
        reason: err instanceof CheckoutActivationError ? err.code : "one_time_activation_failed",
      })
      return (
        <WelcomeClient
          activationSource={source}
          email={email}
          mode="pending"
          oneTimeReturnState={oneTimeReturnStateFromError(err)}
          purchase={null}
          activationRedirectTo={oneTimeDestination}
          sessionId={session_id}
        />
      )
    }
    if (account.state !== "active") {
      return (
        <WelcomeClient
          activationSource={source}
          email={account.email}
          mode="pending"
          purchase={null}
          activationRedirectTo={oneTimeDestination}
          sessionId={session_id}
        />
      )
    }
    const accountDestination = await resolveOneTimePersonalPlanDestination(admin, {
      userId: account.userId,
      leadId: account.leadId ?? session.metadata?.lead_id,
      checkoutContext: account.checkoutContext ?? session.metadata?.checkout_context,
      destinationOptions: getCheckoutFirstTimeDestinationOptionsFromAccount(account),
    })

    if (user?.email?.toLowerCase() === account.email.toLowerCase()) {
      const redirectTo = await resolveAuthenticatedCheckoutRedirect(
        supabase,
        user.id,
        null,
        accountDestination,
      )
      return (
        <WelcomeClient
          activationSource={source}
          email={account.email}
          purchase={null}
          redirectTo={redirectTo}
          activationRedirectTo={accountDestination}
          sessionId={session_id}
        />
      )
    }

    return (
      <WelcomeClient
        activationSource={source}
        email={account.email}
        purchase={null}
        activationRedirectTo={accountDestination}
        sessionId={session_id}
      />
    )
  }

  if (user?.email?.toLowerCase() === email.toLowerCase()) {
    const account = await ensureCheckoutAccount(session, {
      supabase: admin,
      stripe,
      premiumTierId: await getPremiumTierId(admin),
      linkQuizToProfile,
    })
    if (
      session.metadata?.checkout_context === "membership_reactivation" &&
      session.metadata.reactivation_reservation_id
    ) {
      await markMembershipReactivationCheckoutCompleted(
        admin,
        session.metadata.reactivation_reservation_id,
        user.id,
      ).catch((error) => {
        console.warn("[welcome] Stripe reactivation reservation completion failed", error)
      })
    }
    const returnDestination =
      session.metadata?.checkout_context === "membership_reactivation"
        ? sanitizeReactivationReturnDestination(session.metadata.return_destination)
        : null
    const redirectTo = await resolveAuthenticatedCheckoutRedirect(
      supabase,
      user.id,
      returnDestination,
      await resolveCheckoutFirstTimeDestination(
        admin,
        account.leadId ?? session.metadata?.lead_id,
        account.checkoutContext ?? session.metadata?.checkout_context,
        getCheckoutFirstTimeDestinationOptionsFromAccount(account),
      ),
    )
    return (
      <WelcomeClient
        activationSource={{
          provider: "stripe",
          sessionId: session_id,
          purchaseKind: isOneTimePurchase ? "one_time" : undefined,
        }}
        email={email}
        purchase={purchaseAnalytics}
        redirectTo={redirectTo}
        activationRedirectTo={firstTimeDestination}
        sessionId={session_id}
      />
    )
  }

  return (
    <WelcomeClient
      activationSource={{
        provider: "stripe",
        sessionId: session_id,
        purchaseKind: isOneTimePurchase ? "one_time" : undefined,
      }}
      email={email}
      purchase={purchaseAnalytics}
      activationRedirectTo={firstTimeDestination}
      sessionId={session_id}
    />
  )
}

async function renderPayPalOneTimeWelcome(
  token: string | undefined,
  returnState?: "failed_permanent" | "revoked",
) {
  if (!token) redirect("/")

  const admin = createAdminClient()
  let activation
  try {
    activation = await recoverPayPalOrderActivation(token, {
      supabase: admin,
      linkQuizToProfile,
      defer: after,
    })
  } catch (err) {
    captureCheckoutException(err, {
      provider: "paypal",
      stage: "checkout_return",
      source: "welcome",
      paypalTokenPresent: true,
      reason:
        err instanceof PayPalCheckoutActivationError ? err.code : "one_time_activation_failed",
    })
    return (
      <WelcomeClient
        activationSource={{ provider: "paypal", token, purchaseKind: "one_time" }}
        analyticsId={paypalCheckoutAnalyticsId(token)}
        mode="pending"
        oneTimeReturnState={returnState ?? "support_needed"}
        purchase={null}
      />
    )
  }
  const source = { provider: "paypal" as const, token, purchaseKind: "one_time" as const }

  if (activation.status !== "active") {
    const intent = activation.intent
    if (typeof intent === "string") {
      return (
        <WelcomeClient
          activationSource={source}
          analyticsId={paypalCheckoutAnalyticsId(token)}
          mode="pending"
          purchase={null}
        />
      )
    }
    const checkoutContext =
      typeof intent.metadata?.checkout_context === "string"
        ? intent.metadata.checkout_context
        : null
    const firstTimeDestination = await resolveCheckoutFirstTimeDestination(
      admin,
      intent.lead_id,
      checkoutContext,
    )
    return (
      <WelcomeClient
        activationSource={source}
        analyticsId={paypalCheckoutAnalyticsId(token)}
        mode="pending"
        purchase={null}
        activationRedirectTo={firstTimeDestination}
      />
    )
  }

  const account = activation.account
  const firstTimeDestination = await resolveOneTimePersonalPlanDestination(admin, {
    userId: account.userId,
    leadId: account.leadId,
    checkoutContext: account.checkoutContext,
    destinationOptions: getCheckoutFirstTimeDestinationOptionsFromAccount(account),
  })
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user?.email?.toLowerCase() === account.email.toLowerCase()) {
    const redirectTo = await resolveAuthenticatedCheckoutRedirect(
      supabase,
      user.id,
      null,
      firstTimeDestination,
    )
    return (
      <WelcomeClient
        activationSource={source}
        analyticsId={paypalCheckoutAnalyticsId(token)}
        email={account.email}
        purchase={null}
        redirectTo={redirectTo}
        activationRedirectTo={firstTimeDestination}
      />
    )
  }

  return (
    <WelcomeClient
      activationSource={source}
      analyticsId={paypalCheckoutAnalyticsId(token)}
      email={account.email}
      purchase={null}
      activationRedirectTo={firstTimeDestination}
    />
  )
}

function oneTimeReturnStateFromError(error: unknown): "revoked" | "support_needed" {
  return error instanceof CheckoutActivationError &&
    error.code === "checkout_one_time_charge_revoked"
    ? "revoked"
    : "support_needed"
}

async function renderPayPalWelcome(token: string | undefined) {
  if (!token) redirect("/")

  const admin = createAdminClient()
  const activation = await ensurePayPalCheckoutAccountForToken(token, {
    supabase: admin,
    premiumTierId: await getPremiumTierId(admin),
    linkQuizToProfile,
  }).catch((err) => {
    if (err instanceof PayPalCheckoutActivationError) {
      captureCheckoutException(err, {
        provider: "paypal",
        stage: "checkout_return",
        source: "welcome",
        paypalTokenPresent: true,
        reason: err.code,
      })
      redirect("/pricing")
    }
    throw err
  })

  if (activation.status === "duplicate") {
    return (
      <WelcomeClient
        activationSource={{ provider: "paypal", token }}
        analyticsId={paypalCheckoutAnalyticsId(token)}
        mode="duplicate"
        purchase={null}
      />
    )
  }

  if (activation.status === "pending") {
    return (
      <WelcomeClient
        activationSource={{ provider: "paypal", token }}
        analyticsId={paypalCheckoutAnalyticsId(token)}
        mode="pending"
        purchase={null}
      />
    )
  }

  const intent = await findPayPalCheckoutIntentByToken(admin, token)
  const checkoutContext =
    typeof intent?.metadata?.checkout_context === "string" ? intent.metadata.checkout_context : null
  const firstTimeDestination = await resolveCheckoutFirstTimeDestination(
    admin,
    intent?.lead_id,
    checkoutContext,
    getCheckoutFirstTimeDestinationOptionsFromAccount(activation),
  )

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user?.email?.toLowerCase() === activation.email.toLowerCase()) {
    const returnDestination =
      intent?.metadata?.checkout_context === "membership_reactivation"
        ? sanitizeReactivationReturnDestination(
            typeof intent.metadata.return_destination === "string"
              ? intent.metadata.return_destination
              : null,
          )
        : null
    if (
      intent?.metadata?.checkout_context === "membership_reactivation" &&
      typeof intent.metadata.reactivation_reservation_id === "string"
    ) {
      await markMembershipReactivationCheckoutCompleted(
        admin,
        intent.metadata.reactivation_reservation_id,
        user.id,
      ).catch((error) => {
        console.warn("[welcome] PayPal reactivation reservation completion failed", error)
      })
    }
    const redirectTo = await resolveAuthenticatedCheckoutRedirect(
      supabase,
      user.id,
      returnDestination,
      firstTimeDestination,
    )
    return (
      <WelcomeClient
        activationSource={{ provider: "paypal", token }}
        analyticsId={paypalCheckoutAnalyticsId(token)}
        email={activation.email}
        providerSubscriberEmail={activation.providerSubscriberEmail}
        purchase={null}
        redirectTo={redirectTo}
        activationRedirectTo={firstTimeDestination}
      />
    )
  }

  return (
    <WelcomeClient
      activationSource={{ provider: "paypal", token }}
      analyticsId={paypalCheckoutAnalyticsId(token)}
      email={activation.email}
      providerSubscriberEmail={activation.providerSubscriberEmail}
      purchase={null}
      activationRedirectTo={firstTimeDestination}
    />
  )
}

async function resolveAuthenticatedCheckoutRedirect(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  reactivationReturnDestination: string | null,
  firstTimeDestination: CheckoutFirstTimeDestination,
) {
  const { data, error } = await supabase
    .from("profiles")
    .select("onboarding_completed")
    .eq("id", userId)
    .maybeSingle()

  if (error) {
    console.warn("[welcome] could not resolve existing onboarding state", error)
    return reactivationReturnDestination ?? firstTimeDestination
  }

  return getAuthenticatedCheckoutSuccessRedirect(
    data?.onboarding_completed,
    reactivationReturnDestination,
    firstTimeDestination,
  )
}

async function resolveOneTimePersonalPlanDestination(
  admin: ReturnType<typeof createAdminClient>,
  input: {
    userId: string
    leadId?: string | null
    checkoutContext?: string | null
    destinationOptions?: Parameters<typeof resolveCheckoutFirstTimeDestination>[3]
  },
): Promise<CheckoutFirstTimeDestination> {
  const delayedProvisioningDestination = await resolveCheckoutFirstTimeDestination(
    admin,
    input.leadId,
    input.checkoutContext,
    input.destinationOptions,
  )
  if (
    !delayedProvisioningDestination.startsWith("/plan-bereit?lead=") ||
    input.destinationOptions?.legacyQuizFuturePurchaseEligible
  ) {
    return delayedProvisioningDestination
  }
  try {
    const entitlement = await findOneTimePurchaseEntitlementForUser(admin, input.userId)
    const artifactLeadId = entitlement?.consent?.lead_id ?? null
    let preparedArtifactAttached = false
    if (artifactLeadId) {
      const { data, error } = await admin
        .from("personal_plan_prepared_artifacts")
        .select("id")
        .eq("user_id", input.userId)
        .eq("lead_id", artifactLeadId)
        .eq("status", "attached")
        .maybeSingle()
      if (error) throw error
      preparedArtifactAttached = Boolean(data)
    }
    const readiness = resolvePersonalPlanCheckoutReadiness({
      appEnabled: await isPersonalPlanAppV1AllowedForUser(input.userId, admin as never),
      accessState: resolveOneTimePurchaseAccessState(entitlement),
      paidAt: entitlement?.purchase.paid_at ?? null,
      artifactLeadId,
      preparedArtifactAttached,
      cohortCutoff: getPersonalPlanNewBuyerCohortCutoff(),
    })
    return getCheckoutFirstTimeDestination("personal_plan", input.leadId, input.checkoutContext, {
      personalPlanActivationReady: readiness.activationReady,
      personalPlanLegacy: readiness.legacy,
      ...input.destinationOptions,
    })
  } catch (error) {
    console.warn("[welcome] Personal Plan route readiness unavailable", error)
    return delayedProvisioningDestination
  }
}

function paypalCheckoutAnalyticsId(token: string): string {
  return `paypal:${createHash("sha256").update(token).digest("hex").slice(0, 16)}`
}
