import { after, NextResponse, type NextRequest } from "next/server"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { getStripe } from "@/lib/stripe/client"
import {
  handleCheckoutSessionCompleted,
  handleSubscriptionUpdated,
  handleSubscriptionDeleted,
  handleInvoicePaymentFailed,
  findProfileByStripeCustomerId,
} from "@/lib/stripe/webhook-handlers"
import { getStripeTierIds } from "@/lib/stripe/tier-ids"
import { linkQuizToProfile as defaultLinkQuizToProfile } from "@/lib/quiz/link-to-profile"
import type Stripe from "stripe"
import {
  identifyCustomerIoServerPerson,
  logCustomerIoServerResult,
  trackCustomerIoServerEvent,
  type CustomerIoServerProperties,
} from "@/lib/customerio/server"
import {
  buildCustomerIoCheckoutCompletedSync,
  buildCustomerIoInvoicePaymentFailedSync,
  buildCustomerIoSubscriptionLifecycleSync,
  type CustomerIoLifecycleEvent,
} from "@/lib/customerio/stripe-lifecycle"

export const runtime = "nodejs" // raw body required; edge runtime buffers differently

async function getPremiumTierId(supabase: SupabaseClient) {
  return (await getStripeTierIds(supabase)).premiumTierId
}

async function getFreeTierId(supabase: SupabaseClient) {
  return (await getStripeTierIds(supabase)).freeTierId
}

function stripeId(value: string | { id?: string } | null | undefined) {
  if (typeof value === "string") return value
  return value?.id
}

function stripeEventTimestamp(event: Stripe.Event) {
  return typeof event.created === "number"
    ? new Date(event.created * 1000).toISOString()
    : new Date().toISOString()
}

function scheduleCustomerIoLifecycle(
  defer: (work: () => void | Promise<void>) => void,
  label: string,
  work: () => Promise<void>,
) {
  defer(async () => {
    try {
      await work()
    } catch (error) {
      console.warn("[customerio:stripe]", label, error)
    }
  })
}

async function dispatchCustomerIoLifecycle(sync: {
  userId: string
  identifyTraits?: CustomerIoServerProperties
  identifyMessageId?: string
  events?: CustomerIoLifecycleEvent[]
}) {
  if (sync.identifyTraits && sync.identifyMessageId) {
    const identifyResult = await identifyCustomerIoServerPerson({
      userId: sync.userId,
      traits: sync.identifyTraits,
      messageId: sync.identifyMessageId,
      timestamp: sync.events?.[0]?.timestamp,
    })
    logCustomerIoServerResult(`identify ${sync.identifyMessageId}`, identifyResult)
  }

  for (const event of sync.events ?? []) {
    const eventResult = await trackCustomerIoServerEvent({
      userId: sync.userId,
      event: event.event,
      properties: event.properties,
      messageId: event.messageId,
      timestamp: event.timestamp,
    })
    logCustomerIoServerResult(`track ${event.event} ${event.messageId}`, eventResult)
  }
}

type StripeWebhookEventDeps = {
  supabase: SupabaseClient
  stripe: Stripe
  defer?: (work: () => void | Promise<void>) => void
  getFreeTierId?: (supabase: SupabaseClient) => Promise<string>
  getPremiumTierId?: (supabase: SupabaseClient) => Promise<string>
  linkQuizToProfile?: typeof defaultLinkQuizToProfile
}

export async function handleStripeWebhookEvent(event: Stripe.Event, deps: StripeWebhookEventDeps) {
  const {
    supabase,
    stripe,
    defer = after,
    getFreeTierId: resolveFreeTierId = getFreeTierId,
    getPremiumTierId: resolvePremiumTierId = getPremiumTierId,
    linkQuizToProfile = defaultLinkQuizToProfile,
  } = deps
  const timestamp = stripeEventTimestamp(event)

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as unknown as Stripe.Checkout.Session
      const activation = await handleCheckoutSessionCompleted(session, {
        supabase,
        stripe,
        premiumTierId: await resolvePremiumTierId(supabase),
        linkQuizToProfile,
        profileLinkMode: "defer",
        defer,
      })
      scheduleCustomerIoLifecycle(defer, `checkout ${session.id}`, async () => {
        if (
          !activation.subscriptionInterval ||
          !activation.stripeCustomerId ||
          !activation.stripeSubscriptionId ||
          !activation.subscriptionStatus
        ) {
          return
        }
        const sync = buildCustomerIoCheckoutCompletedSync({
          email: activation.email,
          interval: activation.subscriptionInterval,
          planId: `premium_${activation.subscriptionInterval}`,
          session,
          stripeEventId: event.id,
          subscriptionStatus: activation.subscriptionStatus,
          timestamp,
          userId: activation.userId,
        })
        await dispatchCustomerIoLifecycle(sync)
      })
      break
    }
    case "customer.subscription.updated": {
      const subscription = event.data.object as unknown as Stripe.Subscription
      await handleSubscriptionUpdated(subscription, {
        supabase,
      })
      scheduleCustomerIoLifecycle(defer, `subscription updated ${subscription.id}`, async () => {
        const customerId = stripeId(subscription.customer)
        if (!customerId) return
        const profile = await findProfileByStripeCustomerId(supabase, customerId)
        if (!profile?.id) return
        const sync = buildCustomerIoSubscriptionLifecycleSync({
          email: profile.email,
          eventType: "subscription_updated",
          interval: profile.subscription_interval,
          status: profile.subscription_status ?? subscription.status,
          stripeCustomerId: customerId,
          stripeEventId: event.id,
          stripeSubscriptionId: subscription.id,
          timestamp,
          userId: profile.id,
        })
        await dispatchCustomerIoLifecycle({
          userId: sync.userId,
          identifyTraits: sync.identifyTraits,
          identifyMessageId: sync.identifyMessageId,
          events: [sync.event],
        })
      })
      break
    }
    case "customer.subscription.deleted": {
      const subscription = event.data.object as unknown as Stripe.Subscription
      await handleSubscriptionDeleted(subscription, {
        supabase,
        freeTierId: await resolveFreeTierId(supabase),
      })
      scheduleCustomerIoLifecycle(defer, `subscription deleted ${subscription.id}`, async () => {
        const customerId = stripeId(subscription.customer)
        if (!customerId) return
        const profile = await findProfileByStripeCustomerId(supabase, customerId)
        if (!profile?.id) return
        const sync = buildCustomerIoSubscriptionLifecycleSync({
          email: profile.email,
          eventType: "subscription_cancelled",
          interval: profile.subscription_interval,
          status: profile.subscription_status ?? "canceled",
          stripeCustomerId: customerId,
          stripeEventId: event.id,
          stripeSubscriptionId: subscription.id,
          timestamp,
          userId: profile.id,
        })
        await dispatchCustomerIoLifecycle({
          userId: sync.userId,
          identifyTraits: sync.identifyTraits,
          identifyMessageId: sync.identifyMessageId,
          events: [sync.event],
        })
      })
      break
    }
    case "invoice.payment_failed": {
      const invoice = event.data.object as unknown as Stripe.Invoice
      await handleInvoicePaymentFailed(invoice)
      scheduleCustomerIoLifecycle(defer, `payment failed ${invoice.id}`, async () => {
        const customerId = stripeId(invoice.customer)
        if (!customerId) return
        const profile = await findProfileByStripeCustomerId(supabase, customerId)
        if (!profile?.id) return
        const sync = buildCustomerIoInvoicePaymentFailedSync({
          email: profile.email,
          invoice,
          stripeEventId: event.id,
          timestamp,
          userId: profile.id,
        })
        await dispatchCustomerIoLifecycle({
          userId: sync.userId,
          identifyTraits: sync.identifyTraits,
          identifyMessageId: sync.identifyMessageId,
          events: [sync.event],
        })
      })
      break
    }
    default:
      console.warn("[stripe] unhandled event type:", event.type)
  }
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
    await handleStripeWebhookEvent(event, { supabase, stripe })
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
