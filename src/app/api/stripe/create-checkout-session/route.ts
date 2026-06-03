import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { createClient } from "@supabase/supabase-js"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { assertCanStartCheckout, assertCanStartCheckoutForEmail } from "@/lib/billing/subscriptions"
import { captureCheckoutException } from "@/lib/observability/checkout"
import { getStripe, PRICE_IDS } from "@/lib/stripe/client"
import { buildStripeCheckoutSessionParams } from "@/lib/stripe/checkout-session-params"
import type { BillingInterval } from "@/lib/stripe/intervals"

export const runtime = "nodejs"

const BodySchema = z.object({
  interval: z.enum(["month", "quarter", "year"]),
  // Accept null too — the client sends `leadId: null` when there's no ?lead=
  // in the URL (resubscribe path). `.optional()` alone rejects null.
  leadId: z.string().uuid().nullable().optional(),
})

export async function POST(req: NextRequest) {
  const parsed = BodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "bad request" }, { status: 400 })
  }
  const { interval, leadId } = parsed.data

  const priceId = PRICE_IDS[interval as BillingInterval]
  if (!priceId) {
    captureCheckoutException(new Error("Stripe price not configured"), {
      provider: "stripe",
      stage: "stripe_checkout_session_create",
      source: "pricing_page",
      interval,
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

    if (authenticatedUserId) {
      const adminSupabase = getAdminSupabase()
      const conflictResponse = await createStripeCheckoutAccessConflictResponse(
        adminSupabase,
        authenticatedUserId,
        user.email,
      )
      if (conflictResponse) return conflictResponse
      if (user?.email) {
        const emailConflictResponse = await createStripeCheckoutEmailAccessConflictResponse(
          adminSupabase,
          user.email,
        )
        if (emailConflictResponse) return emailConflictResponse
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
          interval,
          leadId,
          status: 500,
          reason: "lead_lookup_failed",
        })
        return NextResponse.json({ error: "lead lookup failed" }, { status: 500 })
      }
      customerEmail = data?.email ?? undefined
      if (customerEmail) {
        resolvedLeadId = leadId
        const conflictResponse = await createStripeCheckoutEmailAccessConflictResponse(
          adminSupabase,
          customerEmail,
          { includeEmail: false },
        )
        if (conflictResponse) return conflictResponse
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
        return NextResponse.json({ error: "identity required" }, { status: 400 })
      }
    }

    const origin = req.nextUrl.origin
    const stripe = getStripe()
    const discountCouponId = process.env.STRIPE_DISCOUNT_COUPON_ID
    if (!discountCouponId) {
      // The UI advertises 50%-off discounted prices unconditionally. If the coupon is
      // not configured, Stripe will charge the full anchor price — surface this loudly
      // so a misconfigured environment is obvious in logs.
      console.warn(
        "[stripe] STRIPE_DISCOUNT_COUPON_ID is not set — checkout will charge the full anchor price. Configure the discount coupon in Stripe + env to match the UI.",
      )
    }

    const params = buildStripeCheckoutSessionParams({
      origin,
      priceId,
      customerId,
      customerEmail,
      discountCouponId,
      leadId: resolvedLeadId,
    })
    const session = await stripe.checkout.sessions.create(params)

    return NextResponse.json({ client_secret: session.client_secret })
  } catch (error) {
    captureCheckoutException(error, {
      provider: "stripe",
      stage: "stripe_checkout_session_create",
      source: "pricing_page",
      interval,
      leadId,
    })
    throw error
  }
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
