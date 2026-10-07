import { NextResponse } from "next/server"
import { safeBearerTokenMatches } from "@/app/api/billing/payment-monitor/route"
import { createAdminClient } from "@/lib/supabase/admin"
import { getStripe } from "@/lib/stripe/client"
import { reconcileStripeTrialContinuations } from "@/lib/stripe/trial-continuation-reconcile"
import { reconcileStripePaidCancellations } from "@/lib/stripe/trial-management"
import { reconcileStripeTrialManagementApprovals } from "@/lib/stripe/trial-management-approval"

import { reconcileStripeTrialPaidRecoveries } from "@/lib/stripe/trial-paid-recovery"

export const runtime = "nodejs"
export const maxDuration = 60

export async function handleStripeTrialContinuationReconcile(
  request: Request,
  deps: {
    cronSecret?: string
    reconcile: () => ReturnType<typeof reconcileStripeTrialContinuations>
  },
) {
  if (!safeBearerTokenMatches(request.headers.get("authorization"), deps.cronSecret)) {
    return { status: 401, body: { error: "unauthorized" } }
  }
  try {
    return { status: 200, body: { stripeTrialContinuation: await deps.reconcile() } }
  } catch {
    return { status: 500, body: { error: "stripe_trial_continuation_retry_failed" } }
  }
}

export async function GET(request: Request) {
  const result = await handleStripeTrialContinuationReconcile(request, {
    cronSecret: process.env.CRON_SECRET,
    reconcile: async () => {
      const client = createAdminClient()
      const stripe = getStripe()
      const continuation = await reconcileStripeTrialContinuations({
        rpc: (name, args) => client.rpc(name, args),
        stripe,
      })
      const paidCancellation = await reconcileStripePaidCancellations({ client, stripe })
      const trialManagement = await reconcileStripeTrialManagementApprovals({ client, stripe })
      const paidRecovery = await reconcileStripeTrialPaidRecoveries({ client, stripe })
      return { ...continuation, paidCancellation, trialManagement, paidRecovery }
    },
  })
  return NextResponse.json(result.body, { status: result.status })
}
