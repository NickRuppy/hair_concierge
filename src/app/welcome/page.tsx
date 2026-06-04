import { redirect } from "next/navigation"
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
import { getStripe } from "@/lib/stripe/client"
import {
  CheckoutActivationError,
  ensureCheckoutAccount,
  verifyCheckoutSessionForActivation,
} from "@/lib/stripe/checkout-activation"
import { buildCheckoutPurchaseAnalytics } from "@/lib/stripe/purchase-analytics"
import { WelcomeClient } from "./welcome-client"

export const dynamic = "force-dynamic"

export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ provider?: string; session_id?: string; token?: string }>
}) {
  const { provider, session_id, token } = await searchParams
  if (provider === "paypal") {
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
      redirect("/pricing")
    }
    throw err
  }

  const email = session.customer_details?.email
  if (!email) redirect("/")
  const purchaseAnalytics = await buildCheckoutPurchaseAnalytics(session, stripe).catch((err) => {
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
  if (user?.email?.toLowerCase() === email.toLowerCase()) {
    const admin = createAdminClient()
    await ensureCheckoutAccount(session, {
      supabase: admin,
      stripe,
      premiumTierId: await getPremiumTierId(admin),
      linkQuizToProfile,
    })
    return (
      <WelcomeClient
        activationSource={{ provider: "stripe", sessionId: session_id }}
        email={email}
        purchase={purchaseAnalytics}
        redirectTo="/onboarding"
        sessionId={session_id}
      />
    )
  }

  return (
    <WelcomeClient
      activationSource={{ provider: "stripe", sessionId: session_id }}
      email={email}
      purchase={purchaseAnalytics}
      sessionId={session_id}
    />
  )
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

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user?.email?.toLowerCase() === activation.email.toLowerCase()) {
    return (
      <WelcomeClient
        activationSource={{ provider: "paypal", token }}
        analyticsId={paypalCheckoutAnalyticsId(token)}
        email={activation.email}
        providerSubscriberEmail={activation.providerSubscriberEmail}
        purchase={null}
        redirectTo="/onboarding"
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
    />
  )
}

function paypalCheckoutAnalyticsId(token: string): string {
  return `paypal:${createHash("sha256").update(token).digest("hex").slice(0, 16)}`
}
