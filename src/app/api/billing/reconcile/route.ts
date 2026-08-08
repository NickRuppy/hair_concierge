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
import {
  monitorPaidOneTimeAccess,
  type PaidAccessMonitorFailure,
  type PaidAccessMonitorFinding,
} from "@/lib/billing/paid-access-monitor"
import { linkQuizToProfile } from "@/lib/quiz/link-to-profile"
import type { processPayPalOneTimeFulfillmentJob } from "@/lib/paypal/order-activation"
import type { getStripe } from "@/lib/stripe/client"
import type { processStripeOneTimeFulfillmentJob } from "@/lib/stripe/checkout-activation"
import { getStripeTierIds } from "@/lib/stripe/tier-ids"
import {
  emptyPaymentIntegrityCounters,
  flushPaymentMonitorTelemetry,
  reportPaidAccessFinding,
  reportPaidAccessMonitorFailure,
  runPaidAccessMonitorBranch,
  runPaymentIntegrityBranch,
  safeBearerTokenMatches,
  type RunPaidAccessMonitor,
  type RunPaymentIntegrity,
} from "@/app/api/billing/payment-monitor/route"
import { captureServerPaymentCheckIn } from "@/lib/observability/payment-server"

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
  runPaidAccessMonitor?: RunPaidAccessMonitor
  captureCheckIn?: Parameters<typeof runPaymentIntegrityBranch>[0]["captureCheckIn"]
  requireCheckInReceipt?: boolean
  flushTelemetry?: Parameters<typeof runPaymentIntegrityBranch>[0]["flushTelemetry"]
  reportMonitorFailure?: (failure: PaymentIntegrityMonitorFailure) => unknown
  reportPaidAccessFinding?: (finding: PaidAccessMonitorFinding) => unknown
  reportPaidAccessMonitorFailure?: (failure: PaidAccessMonitorFailure) => unknown
  clock?: () => number
  browserRecoveryCleanup?: (limit: number) => Promise<BrowserRecoveryCleanupResult>
}

type BrowserRecoveryCleanupResult = {
  quizDrafts: { ok: boolean; purged: number }
  resultReturns: { ok: boolean; purged: number }
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
      runPaidAccessMonitor: ({ now }) =>
        monitorPaidOneTimeAccess({
          supabase,
          now,
        }),
      reportPaidAccessFinding,
      reportPaidAccessMonitorFailure,
      requireCheckInReceipt: true,
    }),
  )
}

export async function handleBillingReconcile(request: Request, deps: ReconcileDeps) {
  const secret = deps.cronSecret
  if (!safeBearerTokenMatches(request.headers.get("authorization"), secret)) {
    return { status: 401, body: { error: "unauthorized" } }
  }

  const now = deps.now ?? new Date()
  const oneTimeBranch =
    deps.oneTimeFulfillmentRetryEnabled === true
      ? await runOneTimeFulfillmentBranch(deps)
      : { ok: true, result: undefined }

  const integrity = deps.runPaymentIntegrity
    ? runPaymentIntegrityBranch({
        monitorSlug: "payment-integrity-daily",
        deadlineMs: PAYMENT_INTEGRITY_DAILY_DEADLINE_MS,
        runPaymentIntegrity: deps.runPaymentIntegrity,
        captureCheckIn: deps.captureCheckIn ?? captureServerPaymentCheckIn,
        requireCheckInReceipt: deps.requireCheckInReceipt === true,
        flushTelemetry: deps.flushTelemetry ?? flushPaymentMonitorTelemetry,
        reportMonitorFailure: deps.reportMonitorFailure,
        now: () => now,
        clock: deps.clock,
      })
    : Promise.resolve({
        ok: false,
        summary: {
          status: "error" as const,
          counters: emptyPaymentIntegrityCounters(),
        },
      })
  const entitlement = runEntitlementBranch(deps, now)
  const analytics =
    deps.analyticsRetryEnabled === true
      ? runAnalyticsBranch(deps)
      : Promise.resolve({ ok: true, result: undefined })

  const paidAccess = deps.runPaidAccessMonitor
    ? runPaidAccessMonitorBranch({
        runPaidAccessMonitor: deps.runPaidAccessMonitor,
        flushTelemetry: deps.flushTelemetry ?? flushPaymentMonitorTelemetry,
        reportFinding: deps.reportPaidAccessFinding,
        reportMonitorFailure: deps.reportPaidAccessMonitorFailure,
        now,
      })
    : Promise.resolve({ ok: true, summary: undefined })
  const browserRecoveryCleanup = (
    deps.browserRecoveryCleanup ?? ((limit) => runBrowserRecoveryCleanup(deps.supabase, limit))
  )(500).catch(() => ({
    quizDrafts: { ok: false, purged: 0 },
    resultReturns: { ok: false, purged: 0 },
  }))
  const [
    integrityBranch,
    paidAccessBranch,
    entitlementBranch,
    analyticsBranch,
    browserRecoveryCleanupResult,
  ] = await Promise.all([integrity, paidAccess, entitlement, analytics, browserRecoveryCleanup])

  const body: Record<string, unknown> = {
    ...entitlementBranch.result,
    paymentIntegrity: integrityBranch.summary,
    browserRecoveryCleanup: browserRecoveryCleanupResult,
  }
  if (paidAccessBranch.summary) body.paidAccess = paidAccessBranch.summary

  if (oneTimeBranch.result) body.oneTimeFulfillmentRetry = oneTimeBranch.result

  if (deps.analyticsRetryEnabled === true) {
    body.analyticsRetry = analyticsBranch.result
  }

  if (!entitlementBranch.ok) body.entitlements = { status: "error" }
  const status =
    integrityBranch.ok &&
    paidAccessBranch.ok &&
    entitlementBranch.ok &&
    analyticsBranch.ok &&
    oneTimeBranch.ok &&
    integrityBranch.summary.status === "completed"
      ? 200
      : 500

  return { status, body }
}

export async function runBrowserRecoveryCleanup(
  supabase: SupabaseClient,
  limit: number,
): Promise<BrowserRecoveryCleanupResult> {
  const purge = async (rpcName: string) => {
    try {
      const { data, error } = await supabase.rpc(rpcName, { p_limit: limit })
      if (error) throw error
      return { ok: true, purged: typeof data === "number" ? data : 0 }
    } catch {
      return { ok: false, purged: 0 }
    }
  }

  const [quizDrafts, resultReturns] = await Promise.all([
    purge("purge_expired_personal_plan_quiz_drafts"),
    purge("purge_expired_personal_plan_result_returns"),
  ])
  return { quizDrafts, resultReturns }
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
