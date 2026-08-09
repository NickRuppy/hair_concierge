import "server-only"

import {
  findOneTimePurchaseEntitlementForUser,
  resolveOneTimePurchaseAccessState,
} from "@/lib/billing/purchases"
import { PERSONAL_PLAN_LAUNCH_PRICING_CATALOG } from "@/lib/billing/pricing-catalog"
import { findCurrentBillingSubscriptionsForUser } from "@/lib/billing/subscriptions"
import type { OneTimeAccessState, SupabaseBillingClient } from "@/lib/billing/types"

export type PersonalPlanEnrollment = {
  accessState: OneTimeAccessState
  sourceId: string | null
  paidAt: string | null
  artifactLeadId: string | null
  sourceKind: "one_time" | "launch_subscription" | null
}

type CorrelationRow = {
  lead_id?: unknown
  purchase_completed_at?: unknown
}

type LeadRow = {
  quiz_kind?: unknown
}

type EnrollmentQueryBuilder = {
  select: (columns: string) => EnrollmentQueryBuilder
  eq: (column: string, value: unknown) => EnrollmentQueryBuilder
  maybeSingle: () => Promise<{ data: unknown; error: unknown }>
}

type EnrollmentSupabaseClient = {
  from: (table: string) => EnrollmentQueryBuilder
}

function emptyEnrollment(accessState: OneTimeAccessState = "none"): PersonalPlanEnrollment {
  return {
    accessState,
    sourceId: null,
    paidAt: null,
    artifactLeadId: null,
    sourceKind: null,
  }
}

function metadataString(metadata: Record<string, unknown>, key: string): string | null {
  const value = metadata[key]
  return typeof value === "string" && value.trim() ? value.trim() : null
}

/**
 * Resolves the single paid source that owns a Personal Plan. Memberships are
 * accepted only when their provider purchase is correlated to one exact
 * Personal Plan quiz lead; user or email proximity is never sufficient.
 */
export async function findPersonalPlanEnrollmentForUser(
  supabase: SupabaseBillingClient,
  userId: string,
  now: Date = new Date(),
): Promise<PersonalPlanEnrollment> {
  const oneTime = await findOneTimePurchaseEntitlementForUser(supabase, userId)
  const oneTimeState = resolveOneTimePurchaseAccessState(oneTime)
  if (oneTimeState === "active" && oneTime?.consent?.lead_id) {
    return {
      accessState: "active",
      sourceId: oneTime.purchase.id,
      paidAt: oneTime.purchase.paid_at,
      artifactLeadId: oneTime.consent.lead_id,
      sourceKind: "one_time",
    }
  }

  const subscriptions = await findCurrentBillingSubscriptionsForUser(supabase, userId, now)
  const subscription = subscriptions.find(
    (candidate) =>
      metadataString(candidate.metadata, "pricing_catalog") ===
      PERSONAL_PLAN_LAUNCH_PRICING_CATALOG,
  )
  if (!subscription) {
    return emptyEnrollment(oneTimeState)
  }

  const purchaseReference =
    subscription.provider === "paypal"
      ? subscription.provider_subscription_id
      : metadataString(subscription.metadata, "checkout_session_id")
  if (!purchaseReference) return emptyEnrollment(oneTimeState)

  const enrollmentClient = supabase as unknown as EnrollmentSupabaseClient
  const { data: correlationData, error: correlationError } = await enrollmentClient
    .from("funnel_sessions")
    .select("lead_id,purchase_completed_at")
    .eq("user_id", userId)
    .eq("purchase_provider", subscription.provider)
    .eq("purchase_reference", purchaseReference)
    .maybeSingle()
  if (correlationError) throw correlationError

  const correlation = (correlationData as CorrelationRow | null) ?? null
  const leadId = typeof correlation?.lead_id === "string" ? correlation.lead_id : null
  const paidAt =
    typeof correlation?.purchase_completed_at === "string"
      ? correlation.purchase_completed_at
      : null
  if (!leadId || !paidAt) return emptyEnrollment(oneTimeState)

  const { data: leadData, error: leadError } = await enrollmentClient
    .from("leads")
    .select("quiz_kind")
    .eq("id", leadId)
    .maybeSingle()
  if (leadError) throw leadError
  if ((leadData as LeadRow | null)?.quiz_kind !== "personal_plan") {
    return emptyEnrollment(oneTimeState)
  }

  return {
    accessState: "active",
    sourceId: subscription.id,
    paidAt,
    artifactLeadId: leadId,
    sourceKind: "launch_subscription",
  }
}
