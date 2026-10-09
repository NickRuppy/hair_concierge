import type { ProfileConcern } from "@/lib/vocabulary"

import { hasCompletedQuizDiagnostics } from "./completion"
import { normalizeStoredQuizAnswers, projectQuizAnswersToLegacyVocabulary } from "./normalization"
import { resolveStatedPrimaryConcern } from "./primary-concern"
import type { QuizAnswers } from "./types"

/**
 * Frozen reproduction of what the pre-central-profile writers stored in the `hair_profiles`
 * columns. Nothing writes the profile through this projection any more; facts are written
 * only through `user_facts_save_v1`.
 * Remaining consumers: the Plan-bereit completeness gate (`src/app/plan-bereit/readiness.ts`),
 * the backfill's hand-edit detection (`src/lib/user-facts/backfill/detect-hand-edits.ts`),
 * golden/oracle tests and `scripts/mobile/profile-edit-postgres-check.ts`. Do not add new callers.
 */

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

/**
 * `hair_profiles.primary_concern` (F1): her stated main problem in the same legacy
 * vocabulary as `concerns` — `null` when she stated none or it has no legacy equivalent.
 *
 * Deliberately NOT part of `buildProfileDataFromQuizAnswers`: that projection is also the
 * mobile registration/edit patch, whose RPC accepted only a fixed column list. Only the
 * quiz link carried it.
 */
export function buildProfilePrimaryConcern(
  answers: Pick<QuizAnswers, "concerns" | "primary_concern">,
): ProfileConcern | null {
  const stated = resolveStatedPrimaryConcern(answers)
  if (!stated) return null
  return projectQuizAnswersToLegacyVocabulary({ concerns: [stated] }).concerns[0] ?? null
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
