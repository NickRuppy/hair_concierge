import { cookies } from "next/headers"
import { after, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"
import type Stripe from "stripe"
import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/admin"
import { findCurrentBillingSubscriptionForUser } from "@/lib/billing/subscriptions"
import {
  PlanChangeError,
  advancePlanChange,
  assertPlanChangeEligible,
  claimPlanChange,
  findPlanChangeByOperationId,
  mergePendingPlanChangeMetadata,
  recordPlanChangePhase,
} from "@/lib/billing/plan-change"
import { reconcileStalePayPalPlanChanges } from "@/lib/paypal/stale-plan-change"
import { getStripe } from "@/lib/stripe/client"
import {
  StripePlanChangeAmbiguousError,
  StripePlanChangeConflictError,
  StripePlanChangePartialError,
  reconcileStripePlanChange,
  scheduleStripePlanChange,
} from "@/lib/stripe/subscription-plan-change"
import {
  PayPalPlanChangeAmbiguousError,
  PayPalPlanChangeConflictError,
  initiatePayPalPlanChange,
} from "@/lib/paypal/subscription-plan-change"
import type { BillingPlanChangeRow, BillingSubscriptionRow } from "@/lib/billing/types"

export const runtime = "nodejs"

const requestSchema = z.object({
  targetInterval: z.enum(["month", "quarter", "year"]),
  operationId: z.string().uuid(),
})

type DeferWork = (work: () => void | Promise<void>) => void

export type ChangePlanDeps = {
  userId: string
  admin: SupabaseClient
  stripe: Stripe
  defer: DeferWork
  findSubscription: typeof findCurrentBillingSubscriptionForUser
  reconcileStalePayPal: typeof reconcileStalePayPalPlanChanges
  claim: typeof claimPlanChange
  advance: typeof advancePlanChange
  findByOperationId: typeof findPlanChangeByOperationId
  mergeMetadata: typeof mergePendingPlanChangeMetadata
  recordPhase: typeof recordPlanChangePhase
  scheduleStripe: typeof scheduleStripePlanChange
  reconcileStripe: typeof reconcileStripePlanChange
  initiatePayPal: typeof initiatePayPalPlanChange
}

export async function POST(request: Request) {
  const cookieStore = await cookies()
  const auth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
  )
  const {
    data: { user },
  } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 })

  return handleChangePlan(request, {
    userId: user.id,
    admin: createAdminClient(),
    stripe: getStripe(),
    defer: after,
    findSubscription: findCurrentBillingSubscriptionForUser,
    reconcileStalePayPal: reconcileStalePayPalPlanChanges,
    claim: claimPlanChange,
    advance: advancePlanChange,
    findByOperationId: findPlanChangeByOperationId,
    mergeMetadata: mergePendingPlanChangeMetadata,
    recordPhase: recordPlanChangePhase,
    scheduleStripe: scheduleStripePlanChange,
    reconcileStripe: reconcileStripePlanChange,
    initiatePayPal: initiatePayPalPlanChange,
  })
}

export async function handleChangePlan(request: Request, deps: ChangePlanDeps) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 })
  }

  const { admin } = deps
  let operation: BillingPlanChangeRow | null = null
  let providerMutation:
    | {
        provider: "stripe"
        scheduleId: string
        targetId: string
        effectiveAt: string
      }
    | {
        provider: "paypal"
        targetId: string
        approvalUrl: string
        effectiveAt: string
      }
    | null = null
  try {
    const subscription = await deps.findSubscription(admin, deps.userId)
    if (!subscription) {
      throw new PlanChangeError(
        "no_manageable_subscription",
        "Es wurde kein aktives Abo gefunden.",
        404,
      )
    }
    assertPlanChangeEligible(subscription, parsed.data.targetInterval)
    await deps.reconcileStalePayPal(admin, subscription, { deps: { defer: deps.defer } })
    operation = await deps.claim(admin, {
      operationId: parsed.data.operationId,
      subscription,
      targetInterval: parsed.data.targetInterval,
    })

    if (operation.status === "failed") {
      return NextResponse.json(
        {
          error: "plan_change_failed",
          message: "Der vorherige Versuch ist fehlgeschlagen. Bitte versuche es erneut.",
        },
        { status: 409 },
      )
    }
    if (operation.status === "reconciling" && subscription.provider === "stripe") {
      if (!operation.provider_resource_id) {
        throw new StripePlanChangeConflictError(
          "stripe_schedule_missing",
          "Stripe reconciliation schedule is missing",
        )
      }
      const reconciliation = await deps.reconcileStripe({
        stripe: deps.stripe,
        subscriptionId: subscription.provider_subscription_id,
        currentInterval: subscription.interval,
        targetInterval: operation.target_interval,
        operationId: operation.operation_id,
        scheduleId: operation.provider_resource_id,
      })
      if (reconciliation.outcome === "closed") {
        operation = await deps.advance(admin, {
          operationId: operation.operation_id,
          expectedStatus: "reconciling",
          status: "failed",
          failureCode: "stripe_schedule_closed_during_reconciliation",
        })
        await recordPlanChangePhasesSafely(admin, operation, ["failed"], deps)
        return NextResponse.json(
          {
            error: "plan_change_failed",
            message: "Der vorherige Versuch ist fehlgeschlagen. Bitte versuche es erneut.",
          },
          { status: 409 },
        )
      }
      operation = await deps.advance(admin, {
        operationId: operation.operation_id,
        expectedStatus: "reconciling",
        status: "scheduled",
        providerResourceId: reconciliation.scheduleId,
        providerTargetId: reconciliation.targetPriceId,
        effectiveAt: reconciliation.effectiveAt,
      })
      await recordScheduledPlanChangeSideEffects(admin, subscription, operation, deps, false)
      return NextResponse.json(operationResponse(operation))
    }
    if (operation.status !== "pending_provider") {
      return NextResponse.json(operationResponse(operation))
    }
    if (subscription.provider === "stripe") {
      const scheduled = await deps.scheduleStripe({
        stripe: deps.stripe,
        subscriptionId: subscription.provider_subscription_id,
        currentInterval: subscription.interval,
        targetInterval: parsed.data.targetInterval,
        operationId: parsed.data.operationId,
      })
      providerMutation = {
        provider: "stripe",
        scheduleId: scheduled.scheduleId,
        targetId: scheduled.targetPriceId,
        effectiveAt: scheduled.effectiveAt,
      }
      operation = await deps.advance(admin, {
        operationId: operation.operation_id,
        expectedStatus: "pending_provider",
        status: "scheduled",
        providerResourceId: scheduled.scheduleId,
        providerTargetId: scheduled.targetPriceId,
        effectiveAt: scheduled.effectiveAt,
      })
      await recordScheduledPlanChangeSideEffects(admin, subscription, operation, deps)
      return NextResponse.json(operationResponse(operation))
    }

    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin).replace(
      /\/$/,
      "",
    )
    const callback = `${siteUrl}/api/billing/change-plan/paypal/return?operationId=${encodeURIComponent(operation.operation_id)}`
    const cancel = `${siteUrl}/api/billing/change-plan/paypal/cancel?operationId=${encodeURIComponent(operation.operation_id)}`
    const revision = await deps.initiatePayPal({
      subscriptionId: subscription.provider_subscription_id,
      currentInterval: subscription.interval,
      targetInterval: parsed.data.targetInterval,
      operationId: operation.operation_id,
      returnUrl: callback,
      cancelUrl: cancel,
    })
    providerMutation = {
      provider: "paypal",
      targetId: revision.targetPlanId,
      approvalUrl: revision.approvalUrl,
      effectiveAt: revision.effectiveAt,
    }
    operation = await deps.advance(admin, {
      operationId: operation.operation_id,
      expectedStatus: "pending_provider",
      status: "pending_approval",
      providerTargetId: revision.targetPlanId,
      effectiveAt: revision.effectiveAt,
      metadata: { approval_url: revision.approvalUrl },
    })
    await recordPendingApprovalSideEffects(admin, subscription, operation, deps)
    return NextResponse.json(operationResponse(operation))
  } catch (error) {
    const ambiguousProviderMutation =
      error instanceof StripePlanChangeAmbiguousError ||
      error instanceof PayPalPlanChangeAmbiguousError
    if (ambiguousProviderMutation && operation?.status === "pending_provider") {
      console.error("[billing:plan-change] provider response is ambiguous; operation retained", {
        userId: deps.userId,
        operationId: operation.operation_id,
        provider: operation.provider,
        error: error.message,
      })
      await recordPlanChangePhasesSafely(admin, operation, ["requested"], deps)
      return NextResponse.json(
        {
          error: "provider_response_ambiguous",
          message: "Die Antwort des Zahlungsanbieters ist noch unklar. Bitte versuche es erneut.",
          ...operationResponse(operation),
        },
        { status: 503 },
      )
    }
    if (operation?.status === "pending_provider") {
      try {
        operation = await handleProviderFailure(admin, operation, error, providerMutation, deps)
      } catch {
        // The first transition may have committed even if its response was lost.
        // Re-read the ledger before returning the open operation to the client.
        operation =
          (await deps
            .findByOperationId(admin, operation.operation_id, operation.user_id)
            .catch(() => null)) ?? operation
      }
    }
    if (operation?.status === "failed") {
      await recordPlanChangePhasesSafely(admin, operation, ["requested", "failed"], deps)
    } else if (operation?.status === "reconciling") {
      await recordPlanChangePhasesSafely(admin, operation, ["requested", "approved"], deps)
    } else if (operation?.status === "pending_provider") {
      await recordPlanChangePhasesSafely(admin, operation, ["requested"], deps)
    }
    if (
      operation &&
      (providerMutation ||
        (error instanceof StripePlanChangePartialError && !error.cleanupSucceeded))
    ) {
      console.error("[billing:plan-change] provider mutation requires reconciliation", {
        userId: deps.userId,
        operationId: parsed.data.operationId,
        status: operation.status,
        error: error instanceof Error ? error.message : String(error),
      })
      return NextResponse.json(operationResponse(operation, providerMutation), { status: 202 })
    }
    const known =
      error instanceof PlanChangeError ||
      error instanceof StripePlanChangeConflictError ||
      error instanceof PayPalPlanChangeConflictError
    console.error("[billing:plan-change] request failed", {
      userId: deps.userId,
      operationId: parsed.data.operationId,
      code: known && "code" in error ? error.code : "provider_error",
      error: error instanceof Error ? error.message : String(error),
    })
    if (error instanceof PlanChangeError) {
      return NextResponse.json(
        { error: error.code, message: error.message },
        { status: error.status },
      )
    }
    if (known) {
      return NextResponse.json(
        { error: error.code, message: "Der Wechsel konnte nicht vorgemerkt werden." },
        { status: 409 },
      )
    }
    return NextResponse.json(
      { error: "plan_change_failed", message: "Bitte versuche es später erneut." },
      { status: 502 },
    )
  }
}

async function recordPendingApprovalSideEffects(
  admin: SupabaseClient,
  subscription: BillingSubscriptionRow,
  operation: BillingPlanChangeRow,
  deps: ChangePlanDeps,
) {
  try {
    await deps.mergeMetadata(admin, subscription, operation)
  } catch (error) {
    // The ledger already contains the approval URL and provider-confirmed date.
    // Do not turn auxiliary metadata failure into a duplicate provider revision.
    console.error("[billing:plan-change] pending approval metadata failed", {
      operationId: operation.operation_id,
      error: error instanceof Error ? error.message : String(error),
    })
  }
  await recordPlanChangePhasesSafely(admin, operation, ["requested"], deps)
}

async function recordScheduledPlanChangeSideEffects(
  admin: SupabaseClient,
  subscription: BillingSubscriptionRow,
  operation: BillingPlanChangeRow,
  deps: ChangePlanDeps,
  includeRequested = true,
) {
  try {
    await deps.mergeMetadata(admin, subscription, operation)
  } catch (error) {
    // The atomic ledger is the source of truth once the provider mutation has
    // succeeded. Auxiliary metadata and analytics must not turn a scheduled
    // change into a client-visible failure that invites a duplicate retry.
    console.error("[billing:plan-change] scheduled side effects failed", {
      operationId: operation.operation_id,
      error: error instanceof Error ? error.message : String(error),
    })
  }
  await recordPlanChangePhasesSafely(
    admin,
    operation,
    [...(includeRequested ? (["requested"] as const) : []), "approved"],
    deps,
  )
}

async function recordPlanChangePhasesSafely(
  admin: SupabaseClient,
  operation: BillingPlanChangeRow,
  phases: Array<"requested" | "approved" | "failed" | "applied">,
  deps: Pick<ChangePlanDeps, "defer" | "recordPhase">,
) {
  for (const phase of phases) {
    try {
      await deps.recordPhase(admin, operation, phase, { defer: deps.defer })
    } catch (error) {
      console.error("[billing:plan-change] analytics phase failed", {
        operationId: operation.operation_id,
        phase,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }
}

async function handleProviderFailure(
  admin: SupabaseClient,
  operation: BillingPlanChangeRow,
  error: unknown,
  providerMutation:
    | {
        provider: "stripe"
        scheduleId: string
        targetId: string
        effectiveAt: string
      }
    | {
        provider: "paypal"
        targetId: string
        approvalUrl: string
        effectiveAt: string
      }
    | null,
  deps: Pick<ChangePlanDeps, "advance">,
) {
  const partial = error instanceof StripePlanChangePartialError
  const status = providerMutation || (partial && !error.cleanupSucceeded) ? "reconciling" : "failed"
  const advanced = await deps.advance(admin, {
    operationId: operation.operation_id,
    expectedStatus: "pending_provider",
    status,
    providerResourceId:
      providerMutation?.provider === "stripe"
        ? providerMutation.scheduleId
        : partial
          ? error.scheduleId
          : undefined,
    providerTargetId: providerMutation?.targetId,
    effectiveAt: providerMutation?.effectiveAt,
    metadata:
      providerMutation?.provider === "paypal"
        ? { approval_url: providerMutation.approvalUrl }
        : undefined,
    failureCode: providerMutation
      ? providerMutation.provider === "stripe"
        ? "local_persistence_after_stripe_schedule"
        : "local_persistence_after_paypal_revision"
      : error && typeof error === "object" && "code" in error
        ? String((error as { code?: unknown }).code ?? "provider_error")
        : "provider_error",
  })
  return advanced
}

function operationResponse(
  operation: BillingPlanChangeRow,
  providerMutation?:
    | {
        provider: "stripe"
        scheduleId: string
        targetId: string
        effectiveAt: string
      }
    | {
        provider: "paypal"
        targetId: string
        approvalUrl: string
        effectiveAt: string
      }
    | null,
) {
  const approvalUrl =
    operation.metadata?.approval_url ??
    (providerMutation?.provider === "paypal" ? providerMutation.approvalUrl : undefined)
  return {
    status: operation.status,
    targetInterval: operation.target_interval,
    effectiveAt: providerMutation?.effectiveAt ?? operation.effective_at,
    approvalUrl: typeof approvalUrl === "string" ? approvalUrl : undefined,
  }
}
