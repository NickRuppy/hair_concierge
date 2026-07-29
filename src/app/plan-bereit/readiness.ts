import type { SupabaseClient } from "@supabase/supabase-js"
import { hasCompletedQuizDiagnostics } from "@/lib/quiz/completion"

type PersonalPlanLead = {
  id: string
  user_id: string | null
}

type PersonalPlanReadiness = {
  ready: boolean
  leadId: string | null
}

export async function findPersonalPlanLead(
  supabase: SupabaseClient,
  userId: string,
  email?: string | null,
): Promise<PersonalPlanLead | null> {
  const owned = await supabase
    .from("leads")
    .select("id, user_id")
    .eq("quiz_kind", "personal_plan")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (owned.error) {
    throw new Error(`personal plan lead lookup failed: ${owned.error.message}`)
  }
  if (owned.data) return owned.data as PersonalPlanLead
  if (!email) return null

  const unlinked = await supabase
    .from("leads")
    .select("id, user_id")
    .eq("quiz_kind", "personal_plan")
    .eq("email", email.toLowerCase())
    .is("user_id", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (unlinked.error) {
    throw new Error(`personal plan lead recovery lookup failed: ${unlinked.error.message}`)
  }
  return (unlinked.data as PersonalPlanLead | null) ?? null
}

export async function loadPersonalPlanReadiness(
  supabase: SupabaseClient,
  userId: string,
  email?: string | null,
): Promise<PersonalPlanReadiness> {
  const lead = await findPersonalPlanLead(supabase, userId, email)
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
