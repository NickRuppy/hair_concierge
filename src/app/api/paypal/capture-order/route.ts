import { NextResponse } from "next/server"
import { z } from "zod"

import { captureAndActivatePayPalOrder } from "@/lib/paypal/order-activation"
import { PayPalCheckoutActivationError } from "@/lib/paypal/checkout-activation"
import { linkQuizToProfile } from "@/lib/quiz/link-to-profile"
import { createAdminClient } from "@/lib/supabase/admin"

const PayPalCaptureOrderRequestSchema = z.object({ token: z.string().min(20).max(200) }).strict()

export async function POST(request: Request) {
  const parsed = PayPalCaptureOrderRequestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 })

  try {
    const result = await captureAndActivatePayPalOrder(parsed.data.token, {
      supabase: createAdminClient(),
      linkQuizToProfile,
    })
    return NextResponse.json({
      token: result.intent.token,
      captured: true,
      welcomeUrl: `/welcome?provider=paypal&purchase=one_time&token=${encodeURIComponent(
        result.intent.token,
      )}`,
    })
  } catch (error) {
    if (error instanceof PayPalCheckoutActivationError) {
      return NextResponse.json({ error: error.code }, { status: 409 })
    }
    throw error
  }
}
