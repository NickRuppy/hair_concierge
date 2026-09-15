import { classifyCheckoutRecoveryError } from "@/lib/auth/checkout-recovery-classification"
import { captureCheckoutException } from "@/lib/observability/checkout"
import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getPremiumTierId } from "@/lib/billing/tier-ids"
import { linkQuizToProfile } from "@/lib/quiz/link-to-profile"
import {
  ensurePayPalCheckoutAccountForToken,
  PayPalCheckoutActivationError,
} from "@/lib/paypal/checkout-activation"
import {
  CheckoutRecoveryError,
  checkoutRecoveryResponse,
} from "@/lib/auth/checkout-activation-outcome"

export const runtime = "nodejs"

const INVALID_REQUEST_ERROR = "PayPal-Aktivierung konnte nicht geprüft werden."

type PayPalActivationStatusDeps = {
  createAdminClient: typeof createAdminClient
  getPremiumTierId: typeof getPremiumTierId
  linkQuizToProfile: typeof linkQuizToProfile
  ensurePayPalCheckoutAccountForToken: typeof ensurePayPalCheckoutAccountForToken
}

export async function GET(request: Request) {
  return handlePayPalActivationStatus(request, {
    createAdminClient,
    getPremiumTierId,
    linkQuizToProfile,
    ensurePayPalCheckoutAccountForToken,
  })
}

export async function handlePayPalActivationStatus(
  request: Request,
  deps: PayPalActivationStatusDeps,
) {
  const url = new URL(request.url)
  const token = url.searchParams.get("token")?.trim()
  if (!token) {
    return NextResponse.json({ error: INVALID_REQUEST_ERROR }, { status: 400 })
  }

  try {
    const admin = deps.createAdminClient()
    const activation = await deps.ensurePayPalCheckoutAccountForToken(token, {
      supabase: admin,
      premiumTierId: await deps.getPremiumTierId(admin),
      linkQuizToProfile: deps.linkQuizToProfile,
    })

    if (activation.status === "pending") {
      return NextResponse.json({ status: "pending" })
    }
    if (activation.status === "duplicate") {
      if (activation.recoveryCode) {
        const recovery = checkoutRecoveryResponse(activation.recoveryCode)
        return NextResponse.json(
          { status: "recovery", ...recovery.body },
          { status: recovery.status },
        )
      }
      return NextResponse.json({ status: "duplicate" })
    }

    return NextResponse.json({ status: "active", email: activation.email })
  } catch (err) {
    const recoveryCode = classifyCheckoutRecoveryError(err)
    if (recoveryCode) {
      if (recoveryCode === "trial_reconciliation_required") {
        captureCheckoutException(err instanceof CheckoutRecoveryError ? (err.cause ?? err) : err, {
          provider: "paypal",
          stage: "checkout_return",
          source: "welcome",
          reason: recoveryCode,
          status: 503,
        })
      }
      const recovery = checkoutRecoveryResponse(recoveryCode)
      return NextResponse.json(
        { status: "recovery", ...recovery.body },
        { status: recovery.status },
      )
    }
    if (err instanceof PayPalCheckoutActivationError) {
      return NextResponse.json({ error: INVALID_REQUEST_ERROR }, { status: 400 })
    }

    console.error("[paypal.activation-status] failed:", err)
    return NextResponse.json({ error: INVALID_REQUEST_ERROR }, { status: 500 })
  }
}
