import { z } from "zod"
import type { QuizAnswers } from "@/lib/quiz/types"
import { quizAnswersSchema } from "@/lib/quiz/validators"
import { currentLegacyAnswers } from "@/lib/scan/scanner-context"
import { mobileEditProfilePatch } from "./profile-edit-contract"

const groups = [
  "structure",
  "thickness",
  "density",
  "hair_length",
  "fingertest",
  "pulltest",
  "treatment",
  "scalp_type",
  "concerns",
  "goals",
] as const
const columns: Record<(typeof groups)[number], string[]> = {
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
const partialAnswersSchema = z
  .object(
    Object.fromEntries(
      Object.entries(quizAnswersSchema.shape).map(([key, schema]) => [key, schema.optional()]),
    ),
  )
  .strict()
export const profileCompletionRequestSchema = z
  .object({
    requestId: z.uuid(),
    expectedProfileRevision: z
      .string()
      .regex(/^(0|[1-9][0-9]*)$/)
      .max(19),
    answers: partialAnswersSchema,
  })
  .strict()

/** Sparse factual reversal only. No normalization/defaults may turn absence into an answer. */
export function storedProfileQuizAnswers(
  profile: Record<string, unknown> | null,
): Partial<QuizAnswers> {
  if (!profile) return {}
  const answers = currentLegacyAnswers(profile)
  if (
    profile.scalp_type == null ||
    profile.scalp_type === "" ||
    profile.scalp_condition === undefined
  )
    answers.has_scalp_issue = undefined
  return Object.fromEntries(Object.entries(answers).filter(([, value]) => value !== undefined))
}
export function missingProfileQuestions(profile: Record<string, unknown> | null): string[] {
  const answers = storedProfileQuizAnswers(profile)
  return groups.filter((key) => {
    const parsed = quizAnswersSchema.shape[key].safeParse(answers[key])
    if (
      !parsed.success ||
      parsed.data === undefined ||
      (key === "goals" && (!Array.isArray(parsed.data) || parsed.data.length === 0))
    )
      return true
    if (key === "scalp_type")
      return (
        typeof answers.has_scalp_issue !== "boolean" ||
        (answers.has_scalp_issue &&
          !quizAnswersSchema.shape.scalp_condition.safeParse(answers.scalp_condition).success) ||
        (answers.has_scalp_issue && !answers.scalp_condition)
      )
    return false
  })
}
export function mergeMissingProfileAnswers(
  profile: Record<string, unknown> | null,
  input: Partial<QuizAnswers>,
): { answers: QuizAnswers; patch: Record<string, unknown> } {
  const submitted = partialAnswersSchema.parse(input) as Partial<QuizAnswers>
  const missing = missingProfileQuestions(profile)
  const merged: Record<string, unknown> = { ...storedProfileQuizAnswers(profile) }
  for (const id of missing) {
    merged[id] = submitted[id as keyof QuizAnswers]
    if (id === "scalp_type") {
      merged.has_scalp_issue = submitted.has_scalp_issue
      if (submitted.has_scalp_issue) merged.scalp_condition = submitted.scalp_condition
      else delete merged.scalp_condition
    }
    if (id === "concerns" && submitted.concerns_other_text !== undefined)
      merged.concerns_other_text = submitted.concerns_other_text
  }
  const answers = quizAnswersSchema.refine((a) => Boolean(a.goals?.length)).parse(merged)
  const projected = mobileEditProfilePatch(answers)
  const allowed = new Set(missing.flatMap((id) => columns[id as (typeof groups)[number]]))
  return {
    answers,
    patch: Object.fromEntries(Object.entries(projected).filter(([key]) => allowed.has(key))),
  }
}
