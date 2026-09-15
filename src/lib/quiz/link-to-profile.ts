import { createAdminClient } from "@/lib/supabase/admin"
import {
  DIAGNOSTICS_SCHEMA_VERSION,
  QUIZ_CONTEXT_SCHEMA_VERSION,
  projectArtifactToFacts,
  projectLegacyLeadToFacts,
} from "@/lib/user-facts"
import { saveUserFacts } from "@/lib/user-facts/save"
import { hasCompletedQuizDiagnostics } from "./completion"
import type { QuizAnswers } from "./types"
import { normalizeStoredQuizAnswers, projectQuizAnswersToLegacyVocabulary } from "./normalization"

export function canLinkDirectQuizLead(
  lead: { email: string; userId: string | null },
  account: { email?: string; userId: string },
): boolean {
  if (lead.userId) return lead.userId === account.userId
  if (!account.email) return false
  return lead.email.trim().toLowerCase() === account.email.trim().toLowerCase()
}

export function resolveProfileDensityFromQuizAnswers(answers: QuizAnswers): string | undefined {
  if (answers.density) return answers.density

  const hasCompleteLegacyDiagnostics =
    Boolean(answers.structure) &&
    Boolean(answers.thickness) &&
    Boolean(answers.fingertest) &&
    Boolean(answers.pulltest) &&
    Boolean(answers.scalp_type) &&
    typeof answers.has_scalp_issue === "boolean" &&
    (!answers.has_scalp_issue || Boolean(answers.scalp_condition)) &&
    Array.isArray(answers.treatment) &&
    answers.treatment.length > 0 &&
    Array.isArray(answers.concerns)

  return hasCompleteLegacyDiagnostics ? "medium" : undefined
}

export function buildProfileDataFromQuizAnswers(answers: QuizAnswers): Record<string, unknown> {
  const profileData: Record<string, unknown> = {}

  if (answers.structure) profileData.hair_texture = answers.structure
  if (answers.thickness) profileData.thickness = answers.thickness
  if (answers.hair_length) profileData.hair_length = answers.hair_length
  const density = resolveProfileDensityFromQuizAnswers(answers)
  if (density) profileData.density = density

  // Map quiz cuticle condition keys to English
  const CUTICLE_MAP: Record<string, string> = {
    glatt: "smooth",
    leicht_uneben: "slightly_rough",
    rau: "rough",
  }
  if (answers.fingertest)
    profileData.cuticle_condition = CUTICLE_MAP[answers.fingertest] ?? answers.fingertest
  if (answers.pulltest) profileData.protein_moisture_balance = answers.pulltest

  // Map quiz scalp keys to English
  const SCALP_TYPE_MAP: Record<string, string> = {
    fettig: "oily",
    ausgeglichen: "balanced",
    trocken: "dry",
  }
  const SCALP_CONDITION_MAP: Record<string, string> = {
    schuppen: "dandruff",
    trockene_schuppen: "dry_flakes",
    gereizt: "irritated",
  }

  if (answers.scalp_type) {
    profileData.scalp_type = SCALP_TYPE_MAP[answers.scalp_type] ?? answers.scalp_type
  }
  if (answers.scalp_condition) {
    profileData.scalp_condition =
      SCALP_CONDITION_MAP[answers.scalp_condition] ?? answers.scalp_condition
  } else if (answers.has_scalp_issue === false) {
    profileData.scalp_condition = null
  }
  if (answers.concerns !== undefined) {
    profileData.concerns = projectQuizAnswersToLegacyVocabulary(answers).concerns
  }

  // Map quiz chemical treatment keys to English
  const TREATMENT_MAP: Record<string, string> = {
    natur: "natural",
    gefaerbt: "colored",
    blondiert: "bleached",
    dauerwelle: "permed",
    chemisch_geglaettet: "chemically_straightened",
  }
  if (answers.treatment) {
    profileData.chemical_treatment = answers.treatment.map((t: string) => TREATMENT_MAP[t] ?? t)
  }

  return profileData
}

export function buildProfileDataFromPersonalPlanCanonicalProfile(
  canonicalProfile: unknown,
): Record<string, unknown> {
  if (!isRecord(canonicalProfile)) {
    throw new Error("personal plan has invalid canonical diagnostics")
  }
  const answers = normalizeStoredQuizAnswers(canonicalProfile)
  if (!answers) {
    throw new Error("personal plan has invalid canonical diagnostics")
  }

  const profileData = buildProfileDataFromQuizAnswers(answers)
  const legacyVocabulary = projectQuizAnswersToLegacyVocabulary(answers)
  if (legacyVocabulary.goals.length > 0) {
    profileData.goals = legacyVocabulary.goals
  }

  if (!hasCompletedQuizDiagnostics(profileData)) {
    throw new Error("personal plan has incomplete canonical diagnostics")
  }

  return profileData
}

export type LinkQuizToProfileOptions = {
  /**
   * Historically the FREE-registration binding mode (PR6 review, finding V4):
   * `hair_profiles` writes could CREATE but never overwrite. Task 5a (central
   * user profile PR1) moved every account-link write onto `saveUserFacts` in
   * `create_only` mode UNCONDITIONALLY (F14/F28) — the facts domains a user
   * already has are never overwritten by a link, regardless of this option.
   * Kept only so existing callers keep type-checking; it is now a no-op.
   */
  profileWrite?: "create_only"
  /** Injection seam for tests; production always builds its own admin client. */
  admin?: ReturnType<typeof createAdminClient>
}

/**
 * After a user authenticates, link their quiz lead data to their profile.
 *
 * Strategy:
 *  1. Try direct lead ID lookup (if leadId passed from quiz CTA)
 *  2. Fall back to email lookup (most recent unlinked lead)
 *  3. Project the lead's quiz answers into native diagnostics (+ quiz_context
 *     for a personal-plan lead) and write them via `saveUserFacts` (create_only)
 *  4. Set leads.user_id to mark the lead as linked
 */
export async function linkQuizToProfile(
  userId: string,
  email: string | undefined,
  leadId?: string,
  options?: LinkQuizToProfileOptions,
) {
  console.log("[linkQuizToProfile] start", { userId, email, leadId })

  const admin = options?.admin ?? createAdminClient()

  // --- Find the lead ---
  let lead: {
    id: string
    email: string
    quiz_kind: "legacy" | "personal_plan"
    quiz_answers: QuizAnswers | Record<string, unknown> | null
    user_id: string | null
  } | null = null

  // Primary: direct ID lookup
  if (leadId) {
    const { data, error } = await admin
      .from("leads")
      .select("id, email, quiz_kind, quiz_answers, user_id")
      .eq("id", leadId)
      .single()

    if (error && error.code !== "PGRST116") {
      throw new Error(`Lead lookup by id failed: ${error.message}`)
    }

    if (
      data &&
      !canLinkDirectQuizLead({ email: data.email, userId: data.user_id }, { email, userId })
    ) {
      console.warn("[linkQuizToProfile] direct lead does not match account; trying email fallback")
    } else if (data && (data.quiz_kind === "legacy" || data.quiz_kind === "personal_plan")) {
      // Allow same-user retries so an interrupted profile projection can recover.
      lead = data
    }
  }

  // Fallback: email lookup (most recent unlinked)
  if (!lead && email) {
    const { data, error } = await admin
      .from("leads")
      .select("id, email, quiz_kind, quiz_answers, user_id")
      .eq("email", email.toLowerCase())
      .eq("quiz_kind", "legacy")
      .is("user_id", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .single()

    if (error && error.code !== "PGRST116") {
      throw new Error(`Lead lookup by email failed: ${error.message}`)
    }
    lead = data?.quiz_kind === "legacy" ? data : null
  }

  // No matching lead — user didn't come from quiz
  if (!lead) {
    console.log("[linkQuizToProfile] no matching lead found, skipping")
    return
  }

  // --- Project the lead's quiz answers into the native fact domains and write
  // them through `saveUserFacts` in `create_only` mode (F14/F28): account
  // linking must never overwrite facts the user already has. `hair_profiles`
  // and its legacy columns are derived inside `user_facts_save_v1` itself —
  // this function never touches that table directly any more.
  const nowIso = new Date().toISOString()

  if (lead.quiz_kind === "personal_plan") {
    const { data, error } = await admin.rpc("link_personal_plan_artifact_to_user", {
      p_lead_id: lead.id,
      p_user_id: userId,
    })
    if (error) {
      throw new Error(`personal plan artifact link failed: ${error.message}`)
    }
    const result = Array.isArray(data) ? data[0] : data
    if (!isRecord(result)) {
      throw new Error("personal plan artifact link returned no result")
    }

    // The RPC above no longer hands back the projection: load the attached
    // artifact's own `quiz_answers` envelope (mirrors stage1-supabase.ts:121-130).
    const { data: artifact, error: artifactErr } = await admin
      .from("personal_plan_prepared_artifacts")
      .select("id, quiz_answers")
      .eq("lead_id", lead.id)
      .eq("user_id", userId)
      .eq("status", "attached")
      .maybeSingle()
    if (artifactErr) {
      throw new Error(`attached personal plan artifact lookup failed: ${artifactErr.message}`)
    }
    if (!artifact) {
      throw new Error(`no attached personal plan artifact found for lead ${lead.id} after link`)
    }

    const { diagnostics, quizContext } = projectArtifactToFacts({
      envelope: artifact.quiz_answers,
      artifactId: artifact.id as string,
      leadId: lead.id,
    })

    await saveUserFacts(admin, {
      userId,
      domain: "diagnostics",
      patch: diagnostics,
      provenance: {
        source: { kind: "personal_plan_artifact", id: artifact.id as string },
        schemaVersion: DIAGNOSTICS_SCHEMA_VERSION,
        at: nowIso,
        preservedCandidates: [{ kind: "artifact", id: artifact.id as string, at: nowIso }],
      },
      mode: "create_only",
    })
    await saveUserFacts(admin, {
      userId,
      domain: "quiz_context",
      patch: quizContext,
      provenance: {
        source: { kind: "personal_plan_artifact", id: artifact.id as string },
        schemaVersion: QUIZ_CONTEXT_SCHEMA_VERSION,
        at: nowIso,
      },
      mode: "create_only",
    })
    console.log("[linkQuizToProfile] wrote diagnostics + quiz_context facts for user", userId)
  } else {
    const { diagnostics } = projectLegacyLeadToFacts({
      leadId: lead.id,
      quizAnswers: lead.quiz_answers as QuizAnswers,
    })

    await saveUserFacts(admin, {
      userId,
      domain: "diagnostics",
      patch: diagnostics,
      provenance: {
        source: { kind: "legacy_lead", id: lead.id },
        schemaVersion: DIAGNOSTICS_SCHEMA_VERSION,
        at: nowIso,
        preservedCandidates: [{ kind: "lead", id: lead.id, at: nowIso }],
      },
      mode: "create_only",
    })
    console.log("[linkQuizToProfile] wrote diagnostics facts for user", userId)
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
