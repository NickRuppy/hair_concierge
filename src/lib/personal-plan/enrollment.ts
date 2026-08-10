import "server-only"

import {
  findOneTimePurchaseEntitlementForUser,
  resolveOneTimePurchaseAccessState,
} from "@/lib/billing/purchases"
import { PERSONAL_PLAN_LAUNCH_PRICING_CATALOG } from "@/lib/billing/pricing-catalog"
import { findCurrentBillingSubscriptionsForUser } from "@/lib/billing/subscriptions"
import type { OneTimeAccessState, SupabaseBillingClient } from "@/lib/billing/types"
import { isMissingPersonalPlanFieldTestRelation } from "@/lib/personal-plan-field-test/errors"

export type PersonalPlanEnrollment = {
  accessState: OneTimeAccessState
  sourceId: string | null
  paidAt: string | null
  qualifiedAt: string | null
  artifactLeadId: string | null
  sourceKind: "one_time" | "launch_subscription" | "field_test" | null
}

type CorrelationRow = {
  lead_id?: unknown
  purchase_completed_at?: unknown
}

type LeadRow = {
  quiz_kind?: unknown
}

type FieldTestEnrollmentRow = {
  id?: unknown
  user_id?: unknown
  lead_id?: unknown
  manual_access_grant_id?: unknown
  status?: unknown
  activated_at?: unknown
  expires_at?: unknown
  revoked_at?: unknown
  manual_access_grants?: unknown
}

type ManualAccessGrantRow = {
  id?: unknown
  user_id?: unknown
  reason?: unknown
  expires_at?: unknown
  revoked_at?: unknown
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
    qualifiedAt: null,
    artifactLeadId: null,
    sourceKind: null,
  }
}

function metadataString(metadata: Record<string, unknown>, key: string): string | null {
  const value = metadata[key]
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function futureTimestamp(value: unknown, now: Date): string | null {
  if (typeof value !== "string") return null
  const timestamp = new Date(value)
  return !Number.isNaN(timestamp.getTime()) && timestamp.getTime() > now.getTime() ? value : null
}

function resolveActiveFieldTestEnrollment(
  row: FieldTestEnrollmentRow | null,
  userId: string,
  now: Date,
): PersonalPlanEnrollment | null {
  if (!row || row.status !== "active" || row.revoked_at !== null) return null
  const sourceId = typeof row.id === "string" ? row.id : null
  const leadId = typeof row.lead_id === "string" ? row.lead_id : null
  const activatedAt = typeof row.activated_at === "string" ? row.activated_at : null
  const enrollmentExpiresAt = futureTimestamp(row.expires_at, now)
  const grant = row.manual_access_grants as ManualAccessGrantRow | null
  if (
    !sourceId ||
    !leadId ||
    !activatedAt ||
    !enrollmentExpiresAt ||
    row.user_id !== userId ||
    typeof row.manual_access_grant_id !== "string" ||
    !grant ||
    grant.id !== row.manual_access_grant_id ||
    grant.user_id !== userId ||
    grant.reason !== "tester" ||
    grant.revoked_at !== null ||
    !futureTimestamp(grant.expires_at, now)
  ) {
    return null
  }
  return {
    accessState: "active",
    sourceId,
    paidAt: null,
    qualifiedAt: activatedAt,
    artifactLeadId: leadId,
    sourceKind: "field_test",
  }
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
      qualifiedAt: oneTime.purchase.paid_at,
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
  if (subscription) {
    const purchaseReference =
      subscription.provider === "paypal"
        ? subscription.provider_subscription_id
        : metadataString(subscription.metadata, "checkout_session_id")
    if (purchaseReference) {
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
      if (leadId && paidAt) {
        const { data: leadData, error: leadError } = await enrollmentClient
          .from("leads")
          .select("quiz_kind")
          .eq("id", leadId)
          .maybeSingle()
        if (leadError) throw leadError
        if ((leadData as LeadRow | null)?.quiz_kind === "personal_plan") {
          return {
            accessState: "active",
            sourceId: subscription.id,
            paidAt,
            qualifiedAt: paidAt,
            artifactLeadId: leadId,
            sourceKind: "launch_subscription",
          }
        }
      }
    }
  }

  const enrollmentClient = supabase as unknown as EnrollmentSupabaseClient
  const { data: fieldTestData, error: fieldTestError } = await enrollmentClient
    .from("personal_plan_test_enrollments")
    .select(
      "id,user_id,lead_id,manual_access_grant_id,status,activated_at,expires_at,revoked_at,manual_access_grants!inner(id,user_id,reason,expires_at,revoked_at)",
    )
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle()
  if (fieldTestError) {
    if (isMissingPersonalPlanFieldTestRelation(fieldTestError)) return emptyEnrollment(oneTimeState)
    throw fieldTestError
  }
  return (
    resolveActiveFieldTestEnrollment(
      (fieldTestData as FieldTestEnrollmentRow | null) ?? null,
      userId,
      now,
    ) ?? emptyEnrollment(oneTimeState)
  )
}
