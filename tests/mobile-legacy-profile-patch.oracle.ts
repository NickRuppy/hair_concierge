import { deriveDesiredVolumeFromGoals } from "../src/lib/hair-profile/derived"
import { mergeMissingProfileAnswers } from "../src/lib/mobile/profile-completion-contract"
import { buildProfileDataFromQuizAnswers } from "../src/lib/quiz/legacy-profile-projection"
import { projectQuizAnswersToLegacyVocabulary } from "../src/lib/quiz/normalization"
import type { QuizAnswers } from "../src/lib/quiz/types"

/**
 * TEST ORACLE ONLY. The column patches the two iOS SQL writers stored BEFORE the clean switch
 * (`mobileEditProfilePatch` and `mergeMissingProfileAnswers(...).patch`, removed from `src/` in
 * clean-switch fix round 1, item A). The golden tests compare what `user_facts_save_v1` derives
 * against these, and the old-vs-new delta tests feed them to the pre-switch SQL functions.
 * Verbatim copies — never "fix" them to match the new behaviour.
 */
export function legacyMobileEditProfilePatch(answers: QuizAnswers): Record<string, unknown> {
  const goals = projectQuizAnswersToLegacyVocabulary(answers).goals
  return {
    ...buildProfileDataFromQuizAnswers(answers),
    goals,
    desired_volume: deriveDesiredVolumeFromGoals(goals, null),
  }
}

const COLUMNS_BY_GROUP: Record<string, string[]> = {
  structure: ["hair_texture"],
  thickness: ["thickness"],
  density: ["density"],
  hair_length: ["hair_length"],
  fingertest: ["cuticle_condition"],
  pulltest: ["protein_moisture_balance"],
  treatment: ["chemical_treatment"],
  scalp_type: ["scalp_type", "scalp_condition"],
  concerns: ["concerns"],
  goals: ["goals", "desired_volume"],
}

/** The pre-switch registration "missing" patch: the edit patch of the merged answers, limited
 * to the columns of the groups that were missing. */
export function legacyMissingProfilePatch(
  profile: Record<string, unknown> | null,
  input: Partial<QuizAnswers>,
): { answers: QuizAnswers; patch: Record<string, unknown> } {
  const merged = mergeMissingProfileAnswers(profile, input)
  const allowed = new Set(merged.missing.flatMap((group) => COLUMNS_BY_GROUP[group] ?? []))
  return {
    answers: merged.answers,
    patch: Object.fromEntries(
      Object.entries(legacyMobileEditProfilePatch(merged.answers)).filter(([key]) =>
        allowed.has(key),
      ),
    ),
  }
}
