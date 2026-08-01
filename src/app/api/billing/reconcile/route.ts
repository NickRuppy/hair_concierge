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
import type { PaymentIntegrityMonitorFailure } from "@/lib/billing/payment-integrity"
import { linkQuizToProfile } from "@/lib/quiz/link-to-profile"
import type { processPayPalOneTimeFulfillmentJob } from "@/lib/paypal/order-activation"
import type { getStripe } from "@/lib/stripe/client"
import type { processStripeOneTimeFulfillmentJob } from "@/lib/stripe/checkout-activation"
import { getStripeTierIds } from "@/lib/stripe/tier-ids"
import {
  capturePaymentIntegrityCheckIn,
  emptyPaymentIntegrityCounters,
  runPaymentIntegrityBranch,
  safeBearerTokenMatches,
  type RunPaymentIntegrity,
} from "@/app/api/billing/payment-monitor/route"

export const runtime = "nodejs"
export const maxDuration = 60

const ANALYTICS_DESTINATIONS: BillingAnalyticsDestination[] = [
  "customerio",
  "posthog",
  "meta",
  "funnel",
]
const PAYMENT_INTEGRITY_DAILY_DEADLINE_MS = 20_000
const PAYMENT_INTEGRITY_RUNTIME_MODULE = "@/lib/billing/payment-integrity-runtime"

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
  runPaymentIntegrity?: RunPaymentIntegrity
  captureCheckIn?: Parameters<typeof runPaymentIntegrityBranch>[0]["captureCheckIn"]
  reportMonitorFailure?: (failure: PaymentIntegrityMonitorFailure) => unknown
  clock?: () => number
}

type PaymentIntegrityRuntimeModule = {
  createPaymentIntegrityRunner?: () => RunPaymentIntegrity | Promise<RunPaymentIntegrity>
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
      runPaymentIntegrity: async (input) => {
        const runner = await loadPaymentIntegrityRunner()
        return runner(input)
      },
    }),
  )
}

export async function handleBillingReconcile(request: Request, deps: ReconcileDeps) {
  const secret = deps.cronSecret
  if (!safeBearerTokenMatches(request.headers.get("authorization"), secret)) {
    return { status: 401, body: { error: "unauthorized" } }
  }

  const now = deps.now ?? new Date()
  const integrity = deps.runPaymentIntegrity
    ? runPaymentIntegrityBranch({
        monitorSlug: "payment-integrity-daily",
        deadlineMs: PAYMENT_INTEGRITY_DAILY_DEADLINE_MS,
        runPaymentIntegrity: deps.runPaymentIntegrity,
        captureCheckIn: deps.captureCheckIn ?? capturePaymentIntegrityCheckIn,
        reportMonitorFailure: deps.reportMonitorFailure,
        now: () => now,
        clock: deps.clock,
      })
    : Promise.resolve({
        ok: false,
        summary: { status: "error" as const, counters: emptyPaymentIntegrityCounters() },
      })
  const entitlement = runEntitlementBranch(deps, now)
  const oneTimeFulfillment =
    deps.oneTimeFulfillmentRetryEnabled === true
      ? runOneTimeFulfillmentBranch(deps)
      : Promise.resolve({ ok: true, result: undefined })
  const analytics =
    deps.analyticsRetryEnabled === true
      ? runAnalyticsBranch(deps)
      : Promise.resolve({ ok: true, result: undefined })

  const [integrityBranch, entitlementBranch, oneTimeBranch, analyticsBranch] = await Promise.all([
    integrity,
    entitlement,
    oneTimeFulfillment,
    analytics,
  ])

  const body: Record<string, unknown> = {
    ...entitlementBranch.result,
    paymentIntegrity: integrityBranch.summary,
  }

  if (oneTimeBranch.result) body.oneTimeFulfillmentRetry = oneTimeBranch.result

  if (deps.analyticsRetryEnabled === true) {
    body.analyticsRetry = analyticsBranch.result
  }

  if (!entitlementBranch.ok) body.entitlements = { status: "error" }
  const status =
    integrityBranch.ok &&
    entitlementBranch.ok &&
    analyticsBranch.ok &&
    oneTimeBranch.ok &&
    integrityBranch.summary.status === "completed"
      ? 200
      : 500

  return { status, body }
}

async function runEntitlementBranch(deps: ReconcileDeps, now: Date) {
  try {
    const freeTierId = await deps.getFreeTierId(deps.supabase)
    const reconcileEntitlements = deps.reconcileEntitlements ?? reconcileExpiredBillingEntitlements
    return {
      ok: true,
      result: await reconcileEntitlements(deps.supabase, {
        freeTierId,
        now,
      }),
    }
  } catch {
    return { ok: false, result: { downgraded: 0 } }
  }
}

async function runOneTimeFulfillmentBranch(deps: ReconcileDeps) {
  try {
    const reconcileOneTimeFulfillmentRetries =
      deps.reconcileOneTimeFulfillmentRetries ?? reconcilePersonalPlanOneTimeFulfillmentRetries
    return {
      ok: true,
      result: await reconcileOneTimeFulfillmentRetries({
        supabase: deps.supabase,
        dispatchers:
          deps.oneTimeFulfillmentDispatchers ?? defaultOneTimeFulfillmentDispatchers(deps),
      }),
    }
  } catch {
    return { ok: false, result: { status: "error" } }
  }
}

async function runAnalyticsBranch(deps: ReconcileDeps) {
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
              status: "error",
            },
      ]
    }),
  )

  return {
    ok: settled.every((destinationResult) => destinationResult.status === "fulfilled"),
    result: analyticsRetry,
  }
}

async function getFreeTierId(supabase: SupabaseClient): Promise<string> {
  return (await getStripeTierIds(supabase)).freeTierId
}

function toNextResponse(result: { status: number; body: Record<string, unknown> }) {
  return NextResponse.json(result.body, { status: result.status })
}

async function loadPaymentIntegrityRunner(): Promise<RunPaymentIntegrity> {
  const runtimeModule = (await import(
    PAYMENT_INTEGRITY_RUNTIME_MODULE
  )) as PaymentIntegrityRuntimeModule
  const createRunner = runtimeModule.createPaymentIntegrityRunner
  if (typeof createRunner !== "function") throw new Error("payment_integrity_runtime_missing")
  return createRunner()
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
