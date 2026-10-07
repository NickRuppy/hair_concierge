import { adaptPersonalPlanAnswersForOffer } from "@/lib/personal-plan-quiz/offer-adapter"
import type { PersonalPlanQuizAnswers } from "@/lib/personal-plan-quiz/types"
import { normalizeMigrationQuizPrefillAnswers } from "./migration-prefill-init"
import type { QuizAnswers } from "./types"

/** Only validated saved answers are copied into a new regular-quiz edit. */
export function projectQuizEmailReturnPrefill(
  quizKind: "legacy" | "personal_plan",
  stored: unknown,
): QuizAnswers {
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) return {}
  if (quizKind === "legacy") {
    return normalizeMigrationQuizPrefillAnswers(stored as Record<string, unknown>)
  }

  // Submitted older Personal Plan envelopes can lack fields required by today's
  // strict schema. Edit can still prefill each fact actually present; the new
  // regular quiz validates the full result before saving.
  const envelope = stored as Record<string, unknown>
  if (
    envelope.kind !== "personal_plan" ||
    (envelope.version !== 2 && envelope.version !== 3) ||
    !envelope.answers ||
    typeof envelope.answers !== "object" ||
    Array.isArray(envelope.answers)
  )
    return {}
  const raw = envelope.answers as Record<string, unknown>
  const source = {
    ...raw,
    goals: Array.isArray(raw.goals)
      ? raw.goals.filter((value) => typeof value === "string")
      : undefined,
    currentConcerns: Array.isArray(raw.currentConcerns)
      ? [
          ...new Set(
            raw.currentConcerns.flatMap((value) => {
              if (typeof value !== "string") return []
              if (value === "dry_dull_lengths") return ["dry_lengths"]
              if (value === "breakage_or_split_ends") return ["breakage", "split_ends"]
              if (value === "scalp_imbalance") return []
              return [value]
            }),
          ),
        ]
      : undefined,
    chemicalTreatments: Array.isArray(raw.chemicalTreatments)
      ? raw.chemicalTreatments.filter((value) => typeof value === "string")
      : undefined,
    scalpConcerns: Array.isArray(raw.scalpConcerns)
      ? raw.scalpConcerns.filter((value) => typeof value === "string")
      : undefined,
  } as PersonalPlanQuizAnswers
  const converted = adaptPersonalPlanAnswersForOffer(source)
  const answers = { ...converted.answers }
  if (converted.fallbackMetadata.elasticityFallback) delete answers.pulltest
  if (converted.fallbackMetadata.scalpFallback) delete answers.scalp_type
  if (!source.chemicalTreatments?.length) delete answers.treatment
  if (!source.scalpConcerns) {
    delete answers.has_scalp_issue
    delete answers.scalp_condition
  }
  if (!source.goals?.length && !source.currentConcerns?.length) delete answers.goals
  return normalizeMigrationQuizPrefillAnswers(answers)
}
