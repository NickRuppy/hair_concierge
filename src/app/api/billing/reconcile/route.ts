import { NextResponse } from "next/server"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { dispatchBillingAnalyticsDueWithStats } from "@/lib/billing/analytics-outbox"
import { reconcileExpiredBillingEntitlements } from "@/lib/billing/entitlements"
import {
  reconcilePersonalPlanOneTimeFulfillmentRetries,
  type PersonalPlanOneTimeFulfillmentDispatchers,
} from "@/lib/billing/one-time-fulfillment-reconcile"
import type {
  BillingAnalyticsDestination,
  PersonalPlanOneTimeFulfillmentJobRow,
} from "@/lib/billing/types"
import { linkQuizToProfile } from "@/lib/quiz/link-to-profile"
import type { processPayPalOneTimeFulfillmentJob } from "@/lib/paypal/order-activation"
import type { getStripe } from "@/lib/stripe/client"
import type { processStripeOneTimeFulfillmentJob } from "@/lib/stripe/checkout-activation"
import { getStripeTierIds } from "@/lib/stripe/tier-ids"

export const runtime = "nodejs"
export const maxDuration = 60

const ANALYTICS_DESTINATIONS: BillingAnalyticsDestination[] = [
  "customerio",
  "posthog",
  "meta",
  "funnel",
]

type ReconcileDeps = {
  supabase: SupabaseClient
  getFreeTierId: (supabase: SupabaseClient) => Promise<string>
  cronSecret?: string
  now?: Date
  reconcileEntitlements?: typeof reconcileExpiredBillingEntitlements
  analyticsRetryEnabled?: boolean
  dispatchAnalyticsDue?: typeof dispatchBillingAnalyticsDueWithStats
  oneTimeFulfillmentRetryEnabled?: boolean
  reconcileOneTimeFulfillmentRetries?: typeof reconcilePersonalPlanOneTimeFulfillmentRetries
  oneTimeFulfillmentDispatchers?: PersonalPlanOneTimeFulfillmentDispatchers
  oneTimeFulfillmentRuntime?: OneTimeFulfillmentRuntime
}

type StripeOneTimeFulfillmentProcessor = typeof processStripeOneTimeFulfillmentJob
type PayPalOneTimeFulfillmentProcessor = typeof processPayPalOneTimeFulfillmentJob

type OneTimeFulfillmentRuntime = {
  linkQuizToProfile: typeof linkQuizToProfile
  loadPayPalProcessor: () => Promise<{
    processPayPalOneTimeFulfillmentJob?: PayPalOneTimeFulfillmentProcessor
  }>
  loadStripeProcessor: () => Promise<{
    getStripe: typeof getStripe
    processStripeOneTimeFulfillmentJob?: StripeOneTimeFulfillmentProcessor
  }>
}

export async function GET(request: Request) {
  const supabase: SupabaseClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )

  return toNextResponse(
    await handleBillingReconcile(request, {
      supabase,
      getFreeTierId,
      cronSecret: process.env.CRON_SECRET,
      analyticsRetryEnabled: process.env.BILLING_ANALYTICS_RETRY_ENABLED === "true",
      dispatchAnalyticsDue: dispatchBillingAnalyticsDueWithStats,
      oneTimeFulfillmentRetryEnabled:
        process.env.PERSONAL_PLAN_ONE_TIME_FULFILLMENT_RETRY_ENABLED === "true",
    }),
  )
}

export async function handleBillingReconcile(request: Request, deps: ReconcileDeps) {
  const secret = deps.cronSecret
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return { status: 401, body: { error: "unauthorized" } }
  }

  const freeTierId = await deps.getFreeTierId(deps.supabase)
  const reconcileEntitlements = deps.reconcileEntitlements ?? reconcileExpiredBillingEntitlements
  const result = await reconcileEntitlements(deps.supabase, {
    freeTierId,
    now: deps.now,
  })

  const body: Record<string, unknown> = { ...result }

  if (deps.oneTimeFulfillmentRetryEnabled === true) {
    const reconcileOneTimeFulfillmentRetries =
      deps.reconcileOneTimeFulfillmentRetries ?? reconcilePersonalPlanOneTimeFulfillmentRetries
    body.oneTimeFulfillmentRetry = await reconcileOneTimeFulfillmentRetries({
      supabase: deps.supabase,
      dispatchers: deps.oneTimeFulfillmentDispatchers ?? defaultOneTimeFulfillmentDispatchers(deps),
    })
  }

  if (deps.analyticsRetryEnabled !== true) return { status: 200, body }

  const dispatchAnalyticsDue = deps.dispatchAnalyticsDue ?? dispatchBillingAnalyticsDueWithStats
  const settled = await Promise.allSettled(
    ANALYTICS_DESTINATIONS.map((destination) =>
      dispatchAnalyticsDue(deps.supabase, { destination, limit: 10 }),
    ),
  )
  const analyticsRetry = Object.fromEntries(
    ANALYTICS_DESTINATIONS.map((destination, index) => {
      const destinationResult = settled[index]
      return [
        destination,
        destinationResult.status === "fulfilled"
          ? destinationResult.value
          : {
              processed: 0,
              delivered: 0,
              failed: 0,
              error: errorMessage(destinationResult.reason),
            },
      ]
    }),
  )

  return { status: 200, body: { ...body, analyticsRetry } }
}

async function getFreeTierId(supabase: SupabaseClient): Promise<string> {
  return (await getStripeTierIds(supabase)).freeTierId
}

function toNextResponse(result: { status: number; body: Record<string, unknown> }) {
  return NextResponse.json(result.body, { status: result.status })
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

export function defaultOneTimeFulfillmentDispatchers(
  deps: ReconcileDeps,
): PersonalPlanOneTimeFulfillmentDispatchers {
  const runtime = deps.oneTimeFulfillmentRuntime ?? defaultOneTimeFulfillmentRuntime

  return {
    stripe: async (job: PersonalPlanOneTimeFulfillmentJobRow) => {
      const stripeModule = await runtime.loadStripeProcessor()
      if (!stripeModule.processStripeOneTimeFulfillmentJob) {
        throw new Error("Stripe one-time fulfillment retry processor is unavailable")
      }
      return stripeModule.processStripeOneTimeFulfillmentJob(job, {
        supabase: deps.supabase,
        stripe: stripeModule.getStripe(),
        premiumTierId: "",
        linkQuizToProfile: runtime.linkQuizToProfile,
        now: deps.now ? () => deps.now! : undefined,
      })
    },
    paypal: async (job: PersonalPlanOneTimeFulfillmentJobRow) => {
      const paypalModule = await runtime.loadPayPalProcessor()
      if (!paypalModule.processPayPalOneTimeFulfillmentJob) {
        throw new Error("PayPal one-time fulfillment retry processor is unavailable")
      }
      return paypalModule.processPayPalOneTimeFulfillmentJob(job, {
        supabase: deps.supabase,
        linkQuizToProfile: runtime.linkQuizToProfile,
        now: deps.now ? () => deps.now! : undefined,
        siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
      })
    },
  }
}

const defaultOneTimeFulfillmentRuntime: OneTimeFulfillmentRuntime = {
  linkQuizToProfile,
  loadPayPalProcessor: async () => import("@/lib/paypal/order-activation"),
  loadStripeProcessor: async () => {
    const [stripeModule, stripeClientModule] = await Promise.all([
      import("@/lib/stripe/checkout-activation"),
      import("@/lib/stripe/client"),
    ])
    return {
      processStripeOneTimeFulfillmentJob: stripeModule.processStripeOneTimeFulfillmentJob,
      getStripe: stripeClientModule.getStripe,
    }
  },
}
