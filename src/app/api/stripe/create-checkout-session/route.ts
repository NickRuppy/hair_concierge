import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { createClient } from "@supabase/supabase-js"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { getStripe, PRICE_IDS } from "@/lib/stripe/client"
import type { BillingInterval } from "@/lib/stripe/intervals"

export const runtime = "nodejs"

const BodySchema = z.object({
  interval: z.enum(["month", "quarter", "year"]),
  // Accept null too — the client sends `leadId: null` when there's no ?lead=
  // in the URL (resubscribe path). `.optional()` alone rejects null.
  leadId: z.string().uuid().nullable().optional(),
})

export async function POST(req: NextRequest) {
  const parsed = BodySchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: "bad request" }, { status: 400 })
  }
  const { interval, leadId } = parsed.data

  const priceId = PRICE_IDS[interval as BillingInterval]
  if (!priceId) {
    return NextResponse.json({ error: "price not configured" }, { status: 500 })
  }

  // Identity resolution: prefer existing Stripe customer > email > 400
  // Priority: leadId email → authed user's stripe_customer_id → authed user's email → 400
  let customerId: string | undefined
  let customerEmail: string | undefined

  if (leadId) {
    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } },
    )
    const { data } = await adminSupabase
      .from("leads")
      .select("email")
      .eq("id", leadId)
      .maybeSingle()
    customerEmail = data?.email ?? undefined
  } else {
    // Resubscribe / direct-entry path — lock to the authenticated user's identity
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

    if (user) {
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
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    ui_mode: "embedded",
    line_items: [{ price: priceId, quantity: 1 }],
    // Pass customer OR customer_email — never both (Stripe rejects that combination)
    ...(customerId ? { customer: customerId } : { customer_email: customerEmail }),
    return_url: `${origin}/welcome?session_id={CHECKOUT_SESSION_ID}`,
    automatic_tax: { enabled: true },
    consent_collection: { terms_of_service: "required" },
    custom_text: {
      terms_of_service_acceptance: {
        message:
          "Ich stimme zu, dass der Zugriff auf das Abo sofort beginnt und ich damit mein 14-tägiges Widerrufsrecht verliere (§ 356 Abs. 4 BGB).",
      },
    },
    metadata: leadId ? { lead_id: leadId } : undefined,
  })

  return NextResponse.json({ client_secret: session.client_secret })
}
