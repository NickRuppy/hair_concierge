import { after, NextResponse } from "next/server"
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
      defer: after,
    })
    return NextResponse.json({
      token: result.intent.token,
      captured: true,
      activationStatus: result.status,
      welcomeUrl: `/welcome?provider=paypal&purchase=one_time&token=${encodeURIComponent(
        result.intent.token,
      )}`,
    })
  } catch (error) {
    if (error instanceof PayPalCheckoutActivationError) {
      if (error.code === "paypal_order_capture_pending") {
        return NextResponse.json(
          {
            error: error.code,
            status: "pending",
            welcomeUrl: `/welcome?provider=paypal&purchase=one_time&token=${encodeURIComponent(
              parsed.data.token,
            )}`,
          },
          { status: 202 },
        )
      }
      return NextResponse.json({ error: error.code }, { status: 409 })
    }
    throw error
  }
}
