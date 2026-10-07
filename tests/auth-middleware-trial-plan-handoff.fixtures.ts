import assert from "node:assert/strict"
import { NextRequest } from "next/server"

import { hasCurrentBillingAccess } from "../src/lib/billing/subscriptions"
import type { BillingSubscriptionRow } from "../src/lib/billing/types"
import { loadPersonalPlanRoutingFrontierForUser } from "../src/lib/personal-plan/frontier-routing-loader"
import { createUpdateSession, type UpdateSessionDependencies } from "../src/lib/supabase/middleware"

const userId = "00000000-0000-4000-8000-000000000011"
const now = new Date("2026-09-16T08:00:00Z")
const completeHairProfile = {
  hair_texture: "straight",
  thickness: "fine",
  density: "medium",
  cuticle_condition: "slightly_rough",
  protein_moisture_balance: "snaps",
  scalp_type: "dry",
  scalp_condition: null,
  chemical_treatment: ["natural"],
  concerns: [],
}

export function trialRow(provider: "stripe" | "paypal"): BillingSubscriptionRow {
  return {
    id: "billing-1",
    user_id: userId,
    provider,
    provider_customer_id: "customer-1",
    provider_subscriber_email: null,
    provider_subscription_id: "subscription-1",
    provider_status: provider === "stripe" ? "trialing" : "ACTIVE",
    entitlement_status: "active",
    interval: "month",
    current_period_end: "2026-09-23T06:51:07Z",
    cancel_at_period_end: false,
    cancelled_at: null,
    cancel_scheduled_at: null,
    created_at: "2026-09-16T06:51:07Z",
    updated_at: "2026-09-16T06:51:07Z",
    metadata: { trial_cohort: "trial_v1" },
    trial_enrollment_id: "trial-1",
    trial_access_facts: {
      version: 1,
      enrollmentId: "trial-1",
      admissionStatus: "active",
      authorizationSucceededAt: "2026-09-16T06:51:07Z",
      originalTrialEndAt: "2026-09-23T06:51:07Z",
      firstPaymentSucceededAt: null,
      paidThroughAt: null,
      renewalGraceEndsAt: null,
      renewalPaymentFailed: false,
      cancelAtPeriodEnd: false,
      accessRevoked: false,
    },
  }
}

type Scenario = {
  provider?: "stripe" | "paypal"
  row?: BillingSubscriptionRow
  planState?: "active" | "pending" | "incomplete" | "unprepared"
  source?: "trial" | "legacy" | "unavailable" | "ineligible"
  manualAccessOnly?: boolean
  billingUnavailable?: boolean
}

/** Database/network boundaries only: billing policy, frontier loader and middleware stay real. */
export function scenario(input: Scenario = {}) {
  const row = input.row ?? trialRow(input.provider ?? "stripe")
  const state = input.planState ?? "active"
  const plan = {
    current_initial_need_version_id: state === "unprepared" ? null : "initial-1",
    current_refined_need_version_id: state === "unprepared" ? null : "refined-1",
    active_routine_version_id: state === "active" ? "routine-1" : null,
    pending_routine_proposal_id: state === "pending" ? "proposal-1" : null,
  }
  const calls = { paid: 0, frontier: 0 }
  const client = {
    auth: {
      getUser: async () => ({ data: { user: { id: userId, app_metadata: {} } }, error: null }),
    },
    rpc: async (name: string) => {
      if (input.source === "unavailable") throw new Error("routing source unavailable")
      if (name === "personal_plan_get_own_partner_routing_source")
        return { data: null, error: null }
      assert.equal(name, "personal_plan_get_own_routing_source")
      return {
        data:
          input.source === "legacy"
            ? null
            : {
                source_kind: "trial",
                qualified_at: "2026-09-16T06:51:07Z",
                quiz_source_kind: "legacy",
                plan,
              },
        error: null,
      }
    },
    from(table: string) {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => {
              if (table === "profiles")
                return { data: { onboarding_completed: false }, error: null }
              if (table === "hair_profiles") return { data: completeHairProfile, error: null }
              if (table === "personal_plans") return { data: plan, error: null }
              throw new Error(`Unexpected table ${table}`)
            },
          }),
        }),
      }
    },
  }
  const deps: UpdateSessionDependencies = {
    createServerClient: (() =>
      client) as unknown as UpdateSessionDependencies["createServerClient"],
    hasCurrentAppAccess: async () =>
      Boolean(input.manualAccessOnly) || hasCurrentBillingAccess(row, now),
    hasCurrentPaidAppAccess: async () => {
      calls.paid++
      if (input.billingUnavailable) throw new Error("billing unavailable")
      return !input.manualAccessOnly && hasCurrentBillingAccess(row, now)
    },
    hasTrialBillingHistory: async () => row.trial_enrollment_id != null,
    resolveOneTimeAccessState: async () => "none",
    resolveModeratorAccess: async () => "none",
    getRouteEnvironment: () => ({ nodeEnv: "test", localDevLoginEnabled: false }),
    loadPersonalPlanRoutingFrontier: async () => {
      calls.frontier++
      return loadPersonalPlanRoutingFrontierForUser(client as never, userId, {
        cohortCutoff: () => new Date("2026-09-15T00:00:00Z"),
        legacyQuizCutoverEnabled: () => input.source !== "ineligible",
        migrationEnabled: () => false,
        appAllowedForUser: async () => true,
      })
    },
  }
  const middleware = createUpdateSession(deps)
  return {
    request: (path: string) => middleware(new NextRequest(`https://chaarlie.de${path}`)),
    calls,
  }
}
