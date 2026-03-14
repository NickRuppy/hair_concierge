import { createAdminClient } from "@/lib/supabase/admin"
import type { QuizAnswers } from "./types"
import { normalizeStoredQuizAnswers } from "./normalization"

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
  console.log("[linkQuizToProfile] start", { userId, email, leadId })

  const admin = createAdminClient()

  // --- Find the lead ---
  let lead: { id: string; quiz_answers: QuizAnswers | Record<string, unknown> | null; user_id: string | null } | null = null

  // Primary: direct ID lookup
  if (leadId) {
    const { data, error } = await admin
      .from("leads")
      .select("id, quiz_answers, user_id")
      .eq("id", leadId)
      .single()

    if (error && error.code !== "PGRST116") {
      throw new Error(`Lead lookup by id failed: ${error.message}`)
    }

    // Allow re-linking if the lead already belongs to this user (partial-link recovery)
    if (data && (data.user_id === null || data.user_id === userId)) {
      lead = data
    }
  }

  // Fallback: email lookup (most recent unlinked)
  if (!lead && email) {
    const { data, error } = await admin
      .from("leads")
      .select("id, quiz_answers, user_id")
      .eq("email", email.toLowerCase())
      .is("user_id", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .single()

    if (error && error.code !== "PGRST116") {
      throw new Error(`Lead lookup by email failed: ${error.message}`)
    }
    lead = data
  }

  // No matching lead — user didn't come from quiz
  if (!lead) {
    console.log("[linkQuizToProfile] no matching lead found, skipping")
    return
  }

  const answers = normalizeStoredQuizAnswers(lead.quiz_answers)
  if (!answers) {
    console.log("[linkQuizToProfile] lead has no quiz_answers, skipping")
    return
  }

  console.log("[linkQuizToProfile] found lead", lead.id, "with answers:", Object.keys(answers))

  // --- Map quiz answers to hair_profiles columns ---
  const profileData: Record<string, unknown> = {
    user_id: userId,
  }

  if (answers.structure) profileData.hair_texture = answers.structure
  if (answers.thickness) profileData.thickness = answers.thickness
  // Map quiz cuticle condition keys to English
  const CUTICLE_MAP: Record<string, string> = {
    glatt: "smooth",
    leicht_uneben: "slightly_rough",
    rau: "rough",
  }
  if (answers.fingertest) profileData.cuticle_condition = CUTICLE_MAP[answers.fingertest] ?? answers.fingertest
  if (answers.pulltest) profileData.protein_moisture_balance = answers.pulltest

  // Map quiz scalp keys to English
  const SCALP_TYPE_MAP: Record<string, string> = {
    fettig: "oily",
    ausgeglichen: "balanced",
    trocken: "dry",
  }
  const SCALP_CONDITION_MAP: Record<string, string> = {
    keine: "none",
    schuppen: "dandruff",
    trockene_schuppen: "dry_flakes",
    gereizt: "irritated",
  }

  if (answers.scalp_type) {
    profileData.scalp_type = SCALP_TYPE_MAP[answers.scalp_type] ?? answers.scalp_type
  }
  if (answers.scalp_condition) {
    profileData.scalp_condition = SCALP_CONDITION_MAP[answers.scalp_condition] ?? answers.scalp_condition
  }

  // Map quiz chemical treatment keys to English
  const TREATMENT_MAP: Record<string, string> = {
    natur: "natural",
    gefaerbt: "colored",
    blondiert: "bleached",
  }
  if (answers.treatment) {
    profileData.chemical_treatment = answers.treatment.map(
      (t: string) => TREATMENT_MAP[t] ?? t
    )
  }

  // --- Check if hair_profiles row already exists ---
  const { data: existing, error: fetchErr } = await admin
    .from("hair_profiles")
    .select("id")
    .eq("user_id", userId)
    .single()

  if (fetchErr && fetchErr.code !== "PGRST116") {
    throw new Error(`hair_profiles lookup failed: ${fetchErr.message}`)
  }

  if (existing) {
    const updates = { ...profileData }
    delete updates.user_id

    if (Object.keys(updates).length > 0) {
      const { error: updateErr } = await admin
        .from("hair_profiles")
        .update(updates)
        .eq("id", existing.id)
      if (updateErr) {
        throw new Error(`hair_profiles update failed: ${updateErr.message}`)
      }
      console.log("[linkQuizToProfile] updated existing profile", existing.id)
    }
  } else {
    // Create new hair_profiles row
    const { error: insertErr } = await admin.from("hair_profiles").insert(profileData)
    if (insertErr) {
      throw new Error(`hair_profiles insert failed: ${insertErr.message}`)
    }
    console.log("[linkQuizToProfile] created new profile for user", userId)
  }

  // --- Link the lead to the user ---
  const { error: linkErr } = await admin
    .from("leads")
    .update({ user_id: userId, status: "linked" })
    .eq("id", lead.id)
  if (linkErr) {
    throw new Error(`leads.user_id update failed: ${linkErr.message}`)
  }

  console.log("[linkQuizToProfile] done — lead", lead.id, "linked to user", userId)
}
