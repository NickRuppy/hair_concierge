import type { SupabaseClient } from "@supabase/supabase-js"
import { hasCompletedQuizDiagnostics } from "@/lib/quiz/completion"
import { canLinkDirectQuizLead } from "@/lib/quiz/link-to-profile"

type PersonalPlanLead = {
  email: string
  id: string
  quiz_kind: string
  user_id: string | null
}

type PersonalPlanReadiness = {
  ready: boolean
  leadId: string | null
}

type FieldTestEnrollmentRow = {
  id?: unknown
  user_id?: unknown
  lead_id?: unknown
  status?: unknown
  expires_at?: unknown
  revoked_at?: unknown
  manual_access_grant_id?: unknown
  manual_access_grants?: unknown
}

type ManualAccessGrantRow = {
  id?: unknown
  user_id?: unknown
  reason?: unknown
  expires_at?: unknown
  revoked_at?: unknown
}

function remainsActiveAfter(value: unknown, now: Date): boolean {
  return (
    typeof value === "string" &&
    !Number.isNaN(new Date(value).getTime()) &&
    new Date(value).getTime() > now.getTime()
  )
}

async function hasActiveFieldTestEnrollment(
  supabase: SupabaseClient,
  userId: string,
  leadId: string,
  now: Date = new Date(),
): Promise<boolean> {
  const { data, error } = await supabase
    .from("personal_plan_test_enrollments")
    .select(
      "id,user_id,lead_id,status,expires_at,revoked_at,manual_access_grant_id,manual_access_grants!inner(id,user_id,reason,expires_at,revoked_at)",
    )
    .eq("user_id", userId)
    .eq("lead_id", leadId)
    .eq("status", "active")
    .maybeSingle()
  if (error) {
    throw new Error(`personal plan field-test enrollment lookup failed: ${error.message}`)
  }
  const enrollment = (data as FieldTestEnrollmentRow | null) ?? null
  const grant = enrollment?.manual_access_grants as ManualAccessGrantRow | null
  return Boolean(
    enrollment &&
    typeof enrollment.id === "string" &&
    enrollment.user_id === userId &&
    enrollment.lead_id === leadId &&
    enrollment.status === "active" &&
    enrollment.revoked_at === null &&
    remainsActiveAfter(enrollment.expires_at, now) &&
    typeof enrollment.manual_access_grant_id === "string" &&
    grant &&
    grant.id === enrollment.manual_access_grant_id &&
    grant.user_id === userId &&
    grant.reason === "tester" &&
    grant.revoked_at === null &&
    remainsActiveAfter(grant.expires_at, now),
  )
}

export async function findPersonalPlanLead(
  supabase: SupabaseClient,
  userId: string,
  email?: string | null,
  leadId?: string | null,
): Promise<PersonalPlanLead | null> {
  if (leadId) {
    const exact = await supabase
      .from("leads")
      .select("id, email, quiz_kind, user_id")
      .eq("id", leadId)
      .eq("quiz_kind", "personal_plan")
      .maybeSingle()

    if (exact.error) {
      throw new Error(`personal plan exact lead lookup failed: ${exact.error.message}`)
    }
    if (!exact.data) return null
    const lead = exact.data as PersonalPlanLead
    if (
      canLinkDirectQuizLead(
        { email: lead.email, userId: lead.user_id },
        { email: email ?? undefined, userId },
      ) ||
      (await hasActiveFieldTestEnrollment(supabase, userId, leadId))
    ) {
      return exact.data as PersonalPlanLead
    }
    return null
  }

  const owned = await supabase
    .from("leads")
    .select("id, email, quiz_kind, user_id")
    .eq("quiz_kind", "personal_plan")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (owned.error) {
    throw new Error(`personal plan lead lookup failed: ${owned.error.message}`)
  }
  if (owned.data) return owned.data as PersonalPlanLead
  return null
}

export async function loadPersonalPlanReadiness(
  supabase: SupabaseClient,
  userId: string,
  email?: string | null,
  leadId?: string | null,
): Promise<PersonalPlanReadiness> {
  const lead = await findPersonalPlanLead(supabase, userId, email, leadId)
  if (!lead) return { ready: false, leadId: null }

  const [artifact, profile] = await Promise.all([
    supabase
      .from("personal_plan_prepared_artifacts")
      .select("id")
      .eq("lead_id", lead.id)
      .eq("user_id", userId)
      .eq("status", "attached")
      .maybeSingle(),
    supabase
      .from("hair_profiles")
      .select(
        "hair_texture, thickness, density, cuticle_condition, protein_moisture_balance, scalp_type, scalp_condition, chemical_treatment, concerns",
      )
      .eq("user_id", userId)
      .maybeSingle(),
  ])

  if (artifact.error) {
    throw new Error(`personal plan artifact readiness failed: ${artifact.error.message}`)
  }
  if (profile.error) {
    throw new Error(`personal plan profile readiness failed: ${profile.error.message}`)
  }

  return {
    ready: Boolean(artifact.data) && hasCompletedQuizDiagnostics(profile.data),
    leadId: lead.id,
  }
}
