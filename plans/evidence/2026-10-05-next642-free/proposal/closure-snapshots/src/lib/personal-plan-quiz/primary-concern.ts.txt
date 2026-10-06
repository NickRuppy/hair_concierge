import type { DiagnosticConcern, PersonalPlanDiagnosticInput } from "@/lib/quiz/diagnostic-input"
import { resolveStatedPrimaryConcern } from "@/lib/quiz/primary-concern"

/**
 * The personal-plan quiz's view of her stated main problem (F1): the `primaryConcern`
 * pick when it is still one of `currentConcerns`, else her only concern, else `null`.
 * Replaces the retired inferred `resolvePrimaryPersonalPlanConcern` ranking.
 */
export function resolveStatedPersonalPlanConcern(
  answers: Pick<PersonalPlanDiagnosticInput, "currentConcerns" | "primaryConcern">,
): DiagnosticConcern | null {
  // Both quizzes share one concern vocabulary (`PERSONAL_PLAN_QUIZ_CONCERNS` =
  // `DIAGNOSTIC_CONCERNS`), so the resolver's answer is always a diagnostic concern.
  return resolveStatedPrimaryConcern({
    concerns: answers.currentConcerns,
    primary_concern: answers.primaryConcern,
  }) as DiagnosticConcern | null
}
