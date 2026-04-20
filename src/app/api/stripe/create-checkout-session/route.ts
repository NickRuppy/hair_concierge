import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { createClient } from "@supabase/supabase-js"
import { getStripe, PRICE_IDS } from "@/lib/stripe/client"
import type { BillingInterval } from "@/lib/stripe/intervals"

export const runtime = "nodejs"

const BodySchema = z.object({
  interval: z.enum(["month", "quarter", "year"]),
  leadId: z.string().uuid().optional(),
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

  let customerEmail: string | undefined
  if (leadId) {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } },
    )
    const { data } = await supabase.from("leads").select("email").eq("id", leadId).maybeSingle()
    customerEmail = data?.email ?? undefined
  }

  const origin = req.nextUrl.origin
  const stripe = getStripe()
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    ui_mode: "embedded",
    line_items: [{ price: priceId, quantity: 1 }],
    customer_email: customerEmail ?? undefined,
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
