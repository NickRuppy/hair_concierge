import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getPremiumTierId } from "@/lib/billing/tier-ids"
import { linkQuizToProfile } from "@/lib/quiz/link-to-profile"
import {
  ensurePayPalCheckoutAccountForToken,
  PayPalCheckoutActivationError,
} from "@/lib/paypal/checkout-activation"

export const runtime = "nodejs"

const INVALID_REQUEST_ERROR = "PayPal-Aktivierung konnte nicht geprüft werden."

export async function GET(request: Request) {
  const url = new URL(request.url)
  const token = url.searchParams.get("token")?.trim()
  if (!token) {
    return NextResponse.json({ error: INVALID_REQUEST_ERROR }, { status: 400 })
  }

  try {
    const admin = createAdminClient()
    const activation = await ensurePayPalCheckoutAccountForToken(token, {
      supabase: admin,
      premiumTierId: await getPremiumTierId(admin),
      linkQuizToProfile,
    })

    if (activation.status === "pending") {
      return NextResponse.json({ status: "pending" })
    }
    if (activation.status === "duplicate") {
      return NextResponse.json({ status: "duplicate" })
    }

    return NextResponse.json({ status: "active", email: activation.email })
  } catch (err) {
    if (err instanceof PayPalCheckoutActivationError) {
      return NextResponse.json({ error: INVALID_REQUEST_ERROR }, { status: 400 })
    }

    console.error("[paypal.activation-status] failed:", err)
    return NextResponse.json({ error: INVALID_REQUEST_ERROR }, { status: 500 })
  }
}
