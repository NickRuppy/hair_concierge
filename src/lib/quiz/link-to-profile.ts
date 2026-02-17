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
  console.log("[linkQuizToProfile] start", { userId, email, leadId })

  const admin = createAdminClient()

  // --- Find the lead ---
  let lead: { id: string; quiz_answers: QuizAnswers; user_id: string | null } | null = null

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

  const answers = lead.quiz_answers
  if (!answers) {
    console.log("[linkQuizToProfile] lead has no quiz_answers, skipping")
    return
  }

  console.log("[linkQuizToProfile] found lead", lead.id, "with answers:", Object.keys(answers))

  // --- Map quiz answers to hair_profiles columns ---
  const profileData: Record<string, unknown> = {
    user_id: userId,
  }

  if (answers.structure) profileData.hair_type = answers.structure
  if (answers.thickness) profileData.hair_texture = answers.thickness
  if (answers.fingertest) profileData.cuticle_condition = answers.fingertest
  if (answers.pulltest) profileData.protein_moisture_balance = answers.pulltest

  // New split scalp fields
  if (answers.scalp_type) {
    profileData.scalp_type = answers.scalp_type
  }
  if (answers.scalp_condition) {
    profileData.scalp_condition = answers.scalp_condition
  }

  // Backwards compat: old leads have { scalp: "fettig" } etc.
  const legacyScalp = (answers as Record<string, unknown>).scalp as string | undefined
  if (legacyScalp && !answers.scalp_type) {
    if (legacyScalp === "fettig_schuppen") {
      profileData.scalp_type = "fettig"
      profileData.scalp_condition = "schuppen"
    } else if (legacyScalp === "unauffaellig") {
      profileData.scalp_type = "ausgeglichen"
      profileData.scalp_condition = "keine"
    } else {
      profileData.scalp_type = legacyScalp
      profileData.scalp_condition = "keine"
    }
  }

  if (answers.treatment) profileData.chemical_treatment = answers.treatment

  if (answers.goals) {
    profileData.goals = answers.goals.map(
      (slug) => GOAL_SLUG_MAP[slug] ?? slug
    )
  }

  // --- Check if hair_profiles row already exists ---
  const { data: existing, error: fetchErr } = await admin
    .from("hair_profiles")
    .select("id, hair_type, hair_texture, goals")
    .eq("user_id", userId)
    .single()

  if (fetchErr && fetchErr.code !== "PGRST116") {
    throw new Error(`hair_profiles lookup failed: ${fetchErr.message}`)
  }

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
    if (profileData.scalp_condition)
      updates.scalp_condition = profileData.scalp_condition
    if (profileData.chemical_treatment)
      updates.chemical_treatment = profileData.chemical_treatment

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
    .update({ user_id: userId })
    .eq("id", lead.id)
  if (linkErr) {
    throw new Error(`leads.user_id update failed: ${linkErr.message}`)
  }

  console.log("[linkQuizToProfile] done — lead", lead.id, "linked to user", userId)
}
