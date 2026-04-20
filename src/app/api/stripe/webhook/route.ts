import { NextResponse, type NextRequest } from "next/server"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { getStripe } from "@/lib/stripe/client"
import {
  handleCheckoutSessionCompleted,
  handleSubscriptionUpdated,
  handleSubscriptionDeleted,
  handleInvoicePaymentFailed,
} from "@/lib/stripe/webhook-handlers"
import { linkQuizToProfile } from "@/lib/quiz/link-to-profile"
import type Stripe from "stripe"

export const runtime = "nodejs" // raw body required; edge runtime buffers differently

async function getTierIds(supabase: SupabaseClient): Promise<{
  freeTierId: string
  premiumTierId: string
}> {
  const { data, error } = await supabase.from("subscription_tiers").select("id, slug")
  if (error) throw new Error(`failed to load subscription_tiers: ${error.message}`)
  const free = data?.find((r: { id: string; slug: string }) => r.slug === "free")?.id
  const premium = data?.find((r: { id: string; slug: string }) => r.slug === "premium")?.id
  if (!free || !premium) throw new Error("subscription_tiers seed rows missing")
  return { freeTierId: free, premiumTierId: premium }
}

export async function POST(req: NextRequest) {
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
  const { freeTierId, premiumTierId } = await getTierIds(supabase)
  const deps = { supabase, stripe, premiumTierId, linkQuizToProfile }
  const deleteDeps = { ...deps, freeTierId }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutSessionCompleted(
          event.data.object as unknown as Stripe.Checkout.Session,
          deps,
        )
        break
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object as unknown as Stripe.Subscription, deps)
        break
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(
          event.data.object as unknown as Stripe.Subscription,
          deleteDeps,
        )
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

  return NextResponse.json({ received: true })
}
