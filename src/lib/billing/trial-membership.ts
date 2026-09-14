import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { parseTrialOfferSnapshot } from "./trial-offer"
import { resolveBillingTrialAccess } from "./trial-access-projection"
import type { MembershipManagementState } from "./types"
import { readTrialEffectiveContract } from "./trial-effective-contract"

export type TrialMembershipState = {
  kind: "trial_membership"
  enrollmentId: string
  phase: "trial" | "paid" | "renewal_grace" | "locked"
  interval: "month" | "year"
  originalTrialEndAt: string
  paidThroughAt: string | null
  firstPaymentSucceededAt: string | null
  cancelAtPeriodEnd: boolean
  canCancelTrial: boolean
  firstAmountMinor: number
  renewalAmountMinor: number
  currency: "EUR"
  managementRevision?: number
}

export type ProfileMembershipState = MembershipManagementState | TrialMembershipState

export function buildTrialMembershipState(
  value: unknown,
  userId: string,
  now: Date,
): ProfileMembershipState {
  const uncertain = { kind: "uncertain" } as const
  if (!value || typeof value !== "object" || Array.isArray(value)) return uncertain
  const row = value as Record<string, unknown>
  if (row.user_id !== userId || typeof row.id !== "string" || row.admission_status !== "active")
    return uncertain
  const offer = parseTrialOfferSnapshot(row.accepted_offer)
  const access = resolveBillingTrialAccess(
    {
      trial_enrollment_id: row.id,
      trial_access_facts: {
        version: 1,
        enrollmentId: row.id,
        admissionStatus: row.admission_status,
        authorizationSucceededAt: row.authorization_succeeded_at,
        originalTrialEndAt: row.original_trial_end_at,
        firstPaymentSucceededAt: row.first_payment_succeeded_at,
        paidThroughAt: row.paid_through_at,
        renewalGraceEndsAt: row.renewal_grace_ends_at,
        renewalPaymentFailed: row.renewal_payment_failed,
        cancelAtPeriodEnd: row.cancel_at_period_end,
        accessRevoked: row.access_revoked,
      },
    },
    now,
  )
  if (
    !offer ||
    !access ||
    access.reason === "invalid_facts" ||
    access.phase === "awaiting_authorization" ||
    typeof row.original_trial_end_at !== "string" ||
    !Number.isFinite(Date.parse(row.original_trial_end_at))
  )
    return uncertain
  return {
    kind: "trial_membership",
    enrollmentId: row.id,
    phase: access.phase,
    interval: offer.interval,
    originalTrialEndAt: row.original_trial_end_at,
    paidThroughAt: row.paid_through_at as string | null,
    firstPaymentSucceededAt: row.first_payment_succeeded_at as string | null,
    cancelAtPeriodEnd: row.cancel_at_period_end as boolean,
    canCancelTrial:
      access.phase === "trial" &&
      !row.cancel_at_period_end &&
      row.first_payment_succeeded_at === null,
    firstAmountMinor: offer.firstAmountMinor,
    renewalAmountMinor: offer.renewalAmountMinor,
    currency: offer.currency,
  }
}

export async function readTrialMembershipState(
  admin: SupabaseClient,
  userId: string,
  enrollmentId?: string | null,
  now = new Date(),
): Promise<ProfileMembershipState | null> {
  let query = admin
    .from("trial_enrollments")
    .select(
      "id,user_id,accepted_offer,admission_status,authorization_succeeded_at,original_trial_end_at,first_payment_succeeded_at,paid_through_at,renewal_grace_ends_at,renewal_payment_failed,cancel_at_period_end,access_revoked",
    )
    .eq("user_id", userId)
  if (enrollmentId) query = query.eq("id", enrollmentId)
  else
    query = query
      .eq("admission_status", "active")
      .order("authorization_succeeded_at", { ascending: false })
      .limit(1)
  const { data, error } = await query.maybeSingle()
  if (error) throw error
  if (!data) return enrollmentId ? { kind: "uncertain" } : null
  const contract = await readTrialEffectiveContract(admin, data.id)
  const state = buildTrialMembershipState({ ...data, accepted_offer: contract.offer }, userId, now)
  return state.kind === "trial_membership"
    ? { ...state, managementRevision: contract.revision }
    : state
}
