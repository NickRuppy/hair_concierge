import { reconcileTrialPaidCancellations } from "@/lib/billing/trial-paid-cancellation"
import { reconcilePayPalTrialCandidateExpiry } from "@/lib/paypal/trial-candidate-expiry"
import { reconcilePayPalTrialCancellation } from "@/lib/paypal/trial-cancellation"
import { retrievePayPalTrialSubscription } from "@/lib/paypal/trial-runtime"
import { cancelPayPalSubscription } from "@/lib/paypal/subscriptions"
import { NextResponse } from "next/server"

import { safeBearerTokenMatches } from "@/app/api/billing/payment-monitor/route"
import { reconcileTrialCancellationProviderOperations } from "@/lib/billing/trial-cancellation-reconcile"
import { createAdminClient } from "@/lib/supabase/admin"
import { getStripe } from "@/lib/stripe/client"
import { reconcileStripeTrialCancellation } from "@/lib/stripe/trial-cancellation"

export const runtime = "nodejs"
export const maxDuration = 60
const STRIPE_RECONCILIATION_TIMEOUT_MS = 45_000

type RetryRouteDeps = {
  cronSecret?: string
  client: ReturnType<typeof createAdminClient>
  reconcile?: typeof reconcileTrialCancellationProviderOperations
  stripe?: typeof getStripe
  expirePayPalCandidates?: () => Promise<unknown>
  retryPaidCancellations?: () => Promise<unknown>
  reconcilePayPal?: Parameters<
    typeof reconcileTrialCancellationProviderOperations
  >[0]["reconcilePayPal"]
}

export async function GET(request: Request) {
  if (!safeBearerTokenMatches(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  const client = createAdminClient()
  return toResponse(
    await handleTrialCancellationReconcile(request, {
      cronSecret: process.env.CRON_SECRET,
      client,
      retryPaidCancellations: () => reconcileTrialPaidCancellations({ client, stripe: getStripe }),
      expirePayPalCandidates: () => reconcilePayPalTrialCandidateExpiry({ supabase: client }),
      reconcilePayPal: ({ declarationId, userId, leaseToken }) =>
        reconcilePayPalTrialCancellation({
          declarationId,
          userId,
          leaseToken,
          rpc: (name, args) => client.rpc(name, args),
          retrieve: retrievePayPalTrialSubscription,
          cancel: cancelPayPalSubscription,
        }),
      stripe: getStripe,
    }),
  )
}

export async function handleTrialCancellationReconcile(request: Request, deps: RetryRouteDeps) {
  if (!safeBearerTokenMatches(request.headers.get("authorization"), deps.cronSecret)) {
    return { status: 401, body: { error: "unauthorized" } }
  }
  try {
    const reconcile = deps.reconcile ?? reconcileTrialCancellationProviderOperations
    const [result, expiry, paidCancellation] = await Promise.all([
      reconcile({
        reconcilePayPal: deps.reconcilePayPal,
        client: deps.client,
        reconcileStripe: ({ declarationId, userId }) =>
          resolveWithin(
            reconcileStripeTrialCancellation({
              declarationId,
              userId,
              rpc: (name, args) => deps.client.rpc(name, args),
              stripe: (deps.stripe ?? getStripe)(),
            }),
            STRIPE_RECONCILIATION_TIMEOUT_MS,
          ),
      }),
      deps.expirePayPalCandidates
        ? resolveWithin(deps.expirePayPalCandidates(), 45000)
        : Promise.resolve(null),
      deps.retryPaidCancellations
        ? resolveWithin(deps.retryPaidCancellations(), 45000)
        : Promise.resolve(null),
    ])
    return {
      status: 200,
      body: {
        cancellationProviderRetry: result,
        ...(expiry === null ? {} : { paypalTrialCandidateExpiry: expiry }),
        ...(paidCancellation === null ? {} : { paidCancellationRetry: paidCancellation }),
      },
    }
  } catch {
    return { status: 500, body: { error: "cancellation_provider_retry_failed" } }
  }
}

function toResponse(result: Awaited<ReturnType<typeof handleTrialCancellationReconcile>>) {
  return NextResponse.json(result.body, { status: result.status })
}

async function resolveWithin<T>(
  operation: Promise<T>,
  timeoutMs: number,
): Promise<T | "in_progress"> {
  let timeout: NodeJS.Timeout | undefined
  try {
    return await Promise.race([
      operation,
      new Promise<"in_progress">((resolve) => {
        timeout = setTimeout(() => resolve("in_progress"), timeoutMs)
      }),
    ])
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}
