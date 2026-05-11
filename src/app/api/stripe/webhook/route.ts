import { after, NextResponse, type NextRequest } from "next/server"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { getStripe } from "@/lib/stripe/client"
import {
  handleCheckoutSessionCompleted,
  handleSubscriptionUpdated,
  handleSubscriptionDeleted,
  handleInvoicePaymentFailed,
} from "@/lib/stripe/webhook-handlers"
import { getStripeTierIds } from "@/lib/stripe/tier-ids"
import { linkQuizToProfile } from "@/lib/quiz/link-to-profile"
import type Stripe from "stripe"

export const runtime = "nodejs" // raw body required; edge runtime buffers differently

async function getPremiumTierId(supabase: SupabaseClient) {
  return (await getStripeTierIds(supabase)).premiumTierId
}

async function getFreeTierId(supabase: SupabaseClient) {
  return (await getStripeTierIds(supabase)).freeTierId
}

export async function POST(req: NextRequest) {
  const startedAt = Date.now()
  const sig = req.headers.get("stripe-signature")
  const body = await req.text()
  if (!sig) return new NextResponse("missing signature", { status: 400 })

  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) return new NextResponse("server misconfigured", { status: 500 })

  const stripe = getStripe()
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret)
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown"
    return new NextResponse(`signature verification failed: ${message}`, { status: 400 })
  }

  const supabase: SupabaseClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutSessionCompleted(
          event.data.object as unknown as Stripe.Checkout.Session,
          {
            supabase,
            stripe,
            premiumTierId: await getPremiumTierId(supabase),
            linkQuizToProfile,
            profileLinkMode: "defer",
            defer: (work) => after(work),
          },
        )
        break
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object as unknown as Stripe.Subscription, {
          supabase,
        })
        break
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as unknown as Stripe.Subscription, {
          supabase,
          freeTierId: await getFreeTierId(supabase),
        })
        break
      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(event.data.object as unknown as Stripe.Invoice)
        break
      default:
        console.warn("[stripe] unhandled event type:", event.type)
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown"
    console.error("[stripe] handler error:", err)
    return new NextResponse(`handler error: ${message}`, { status: 500 })
  }

  console.info("[stripe:webhook] handled", {
    eventId: event.id,
    type: event.type,
    durationMs: Date.now() - startedAt,
  })

  return NextResponse.json({ received: true })
}
