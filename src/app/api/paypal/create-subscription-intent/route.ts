import { NextResponse } from "next/server"
import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { assertCanStartCheckout, assertCanStartCheckoutForEmail } from "@/lib/billing/subscriptions"
import {
  createPayPalCheckoutIntent,
  type PayPalCheckoutSource,
} from "@/lib/paypal/checkout-intents"
import type { BillingInterval } from "@/lib/billing/types"
import { getPayPalPlanId } from "@/lib/paypal/plans"

export const runtime = "nodejs"

const BodySchema = z.object({
  interval: z.enum(["month", "quarter", "year"]),
  leadId: z.string().uuid().nullable().optional(),
  source: z.enum(["pricing_page", "quiz_result_offer"]),
})

const ACCESS_CONFLICT_ERROR = "checkout_access_already_exists"

export async function POST(request: Request) {
  if (process.env.NEXT_PUBLIC_PAYPAL_ENABLED !== "true") {
    return NextResponse.json({ error: "paypal disabled" }, { status: 404 })
  }

  const parsed = BodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "bad request" }, { status: 400 })
  }

  const { interval, leadId, source } = parsed.data
  let planId: string
  try {
    planId = getPayPalPlanId(interval)
  } catch {
    return NextResponse.json({ error: "paypal plan not configured" }, { status: 500 })
  }

  const admin = createAdminClient()
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user?.id) {
    const conflict = await toConflictResponse(assertCanStartCheckout(admin, user.id))
    if (conflict) return conflict
  }

  let email = user?.email ?? null
  if (leadId) {
    const { data, error } = await admin.from("leads").select("email").eq("id", leadId).maybeSingle()
    if (error) throw error
    email = typeof data?.email === "string" ? data.email : email
  }

  if (email) {
    const conflict = await toConflictResponse(assertCanStartCheckoutForEmail(admin, email))
    if (conflict) return conflict
  }

  const intent = await createPayPalCheckoutIntent(admin, {
    interval: interval as BillingInterval,
    source: source as PayPalCheckoutSource,
    leadId: leadId ?? null,
    email,
    userId: user?.id ?? null,
  })

  return NextResponse.json({ token: intent.token, planId })
}

async function toConflictResponse(
  promise: Promise<void>,
): Promise<NextResponse<{ error: typeof ACCESS_CONFLICT_ERROR }> | null> {
  try {
    await promise
    return null
  } catch (error) {
    if (error instanceof Error && error.message.includes("already has access")) {
      return NextResponse.json({ error: ACCESS_CONFLICT_ERROR }, { status: 409 })
    }
    throw error
  }
}
