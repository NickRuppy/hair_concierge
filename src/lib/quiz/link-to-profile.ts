import { createAdminClient } from "@/lib/supabase/admin"
import type { QuizAnswers } from "./types"

/** Map quiz goal slugs to the German labels used in hair_profiles.goals */
const GOAL_SLUG_MAP: Record<string, string> = {
  spliss: "Spliss",
  frizz: "Weniger Frizz",
  kein_volumen: "Mehr Volumen",
  zu_viel_volumen: "Zu viel Volumen",
  glanzlos: "Mehr Glanz",
  kopfhaut: "Gesunde Kopfhaut",
  haarausfall: "Haarwachstum",
}

/**
 * After a user authenticates, link their quiz lead data to their profile.
 *
 * Strategy:
 *  1. Try direct lead ID lookup (if leadId passed from quiz CTA)
 *  2. Fall back to email lookup (most recent unlinked lead)
 *  3. Create/update hair_profiles with mapped quiz data
 *  4. Set leads.user_id to mark the lead as linked
 */
export async function linkQuizToProfile(
  userId: string,
  email: string | undefined,
  leadId?: string
) {
  const admin = createAdminClient()

  // --- Find the lead ---
  let lead: { id: string; quiz_answers: QuizAnswers; user_id: string | null } | null = null

  // Primary: direct ID lookup
  if (leadId) {
    const { data } = await admin
      .from("leads")
      .select("id, quiz_answers, user_id")
      .eq("id", leadId)
      .is("user_id", null)
      .single()
    lead = data
  }

  // Fallback: email lookup (most recent unlinked)
  if (!lead && email) {
    const { data } = await admin
      .from("leads")
      .select("id, quiz_answers, user_id")
      .eq("email", email.toLowerCase())
      .is("user_id", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .single()
    lead = data
  }

  // No matching lead — user didn't come from quiz
  if (!lead) return

  const answers = lead.quiz_answers
  if (!answers) return

  // --- Map quiz answers to hair_profiles columns ---
  const profileData: Record<string, unknown> = {
    user_id: userId,
  }

  if (answers.structure) profileData.hair_type = answers.structure
  if (answers.thickness) profileData.hair_texture = answers.thickness
  if (answers.fingertest) profileData.cuticle_condition = answers.fingertest
  if (answers.pulltest) profileData.protein_moisture_balance = answers.pulltest
  if (answers.scalp) profileData.scalp_type = answers.scalp
  if (answers.treatment) profileData.chemical_treatment = answers.treatment

  if (answers.goals) {
    profileData.goals = answers.goals.map(
      (slug) => GOAL_SLUG_MAP[slug] ?? slug
    )
  }

  // --- Check if hair_profiles row already exists ---
  const { data: existing } = await admin
    .from("hair_profiles")
    .select("id, hair_type, hair_texture, goals")
    .eq("user_id", userId)
    .single()

  if (existing) {
    // Only fill NULL fields for hair_type/hair_texture, always write diagnostic columns
    const updates: Record<string, unknown> = {}

    if (!existing.hair_type && profileData.hair_type)
      updates.hair_type = profileData.hair_type
    if (!existing.hair_texture && profileData.hair_texture)
      updates.hair_texture = profileData.hair_texture
    if (existing.goals?.length === 0 && profileData.goals)
      updates.goals = profileData.goals

    // Always write the new diagnostic fields
    if (profileData.cuticle_condition)
      updates.cuticle_condition = profileData.cuticle_condition
    if (profileData.protein_moisture_balance)
      updates.protein_moisture_balance = profileData.protein_moisture_balance
    if (profileData.scalp_type)
      updates.scalp_type = profileData.scalp_type
    if (profileData.chemical_treatment)
      updates.chemical_treatment = profileData.chemical_treatment

    if (Object.keys(updates).length > 0) {
      await admin
        .from("hair_profiles")
        .update(updates)
        .eq("id", existing.id)
    }
  } else {
    // Create new hair_profiles row
    await admin.from("hair_profiles").insert(profileData)
  }

  // --- Link the lead to the user ---
  await admin
    .from("leads")
    .update({ user_id: userId })
    .eq("id", lead.id)
}
