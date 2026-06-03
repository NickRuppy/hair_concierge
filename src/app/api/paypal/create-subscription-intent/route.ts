import { NextResponse } from "next/server"
import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { assertCanStartCheckout, assertCanStartCheckoutForEmail } from "@/lib/billing/subscriptions"
import { captureCheckoutException } from "@/lib/observability/checkout"
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
    captureCheckoutException(new Error("PayPal plan not configured"), {
      provider: "paypal",
      stage: "paypal_create_subscription_intent",
      source,
      interval,
      leadId,
      status: 500,
      reason: "plan_not_configured",
    })
    return NextResponse.json({ error: "paypal plan not configured" }, { status: 500 })
  }

  try {
    const admin = createAdminClient()
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user?.id) {
      const conflict = await toConflictResponse(assertCanStartCheckout(admin, user.id), user.email)
      if (conflict) return conflict
    }

    let email = user?.email ?? null
    let resolvedLeadId: string | null = null
    let canExposeConflictEmail = Boolean(user?.email)
    if (leadId) {
      const { data, error } = await admin
        .from("leads")
        .select("email")
        .eq("id", leadId)
        .maybeSingle()
      if (error) throw error
      if (typeof data?.email === "string") {
        email = data.email
        resolvedLeadId = leadId
      }
      canExposeConflictEmail = false
    }

    if (email) {
      const conflict = await toConflictResponse(
        assertCanStartCheckoutForEmail(admin, email),
        canExposeConflictEmail ? email : null,
      )
      if (conflict) return conflict
    }

    const intent = await createPayPalCheckoutIntent(admin, {
      interval: interval as BillingInterval,
      source: source as PayPalCheckoutSource,
      leadId: resolvedLeadId,
      email,
      userId: user?.id ?? null,
    })

    return NextResponse.json({ token: intent.token, planId })
  } catch (error) {
    captureCheckoutException(error, {
      provider: "paypal",
      stage: "paypal_create_subscription_intent",
      source,
      interval,
      leadId,
    })
    throw error
  }
}

async function toConflictResponse(
  promise: Promise<void>,
  email?: string | null,
): Promise<NextResponse<{ error: typeof ACCESS_CONFLICT_ERROR; email?: string }> | null> {
  try {
    await promise
    return null
  } catch (error) {
    if (error instanceof Error && error.message.includes("already has access")) {
      return NextResponse.json(
        { error: ACCESS_CONFLICT_ERROR, ...(email ? { email } : {}) },
        { status: 409 },
      )
    }
    throw error
  }
}
