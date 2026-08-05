import { z } from "zod"
import { createHash, randomBytes } from "node:crypto"

import {
  PERSONAL_PLAN_QUIZ_CONCERNS,
  PERSONAL_PLAN_QUIZ_GOALS,
  PERSONAL_PLAN_QUIZ_KIND,
  PERSONAL_PLAN_QUIZ_VERSION,
  type PersonalPlanQuizAnswers,
  type PersonalPlanQuizSubmissionEnvelope,
} from "./types"

const stringArray = <T extends readonly [string, ...string[]]>(values: T, min = 0) =>
  z
    .array(z.enum(values))
    .min(min)
    .superRefine((items, context) => {
      if (new Set(items).size !== items.length) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Werte duerfen nicht doppelt vorkommen",
        })
      }
    })

const durableAnswersSchema = z
  .object({
    texture: z.enum(["straight", "wavy", "curly", "coily"]),
    thickness: z.enum(["fine", "normal", "coarse"]),
    density: z.enum(["low", "medium", "high"]),
    goals: stringArray(PERSONAL_PLAN_QUIZ_GOALS, 1),
    routineClarity: z.enum(["clear", "partial", "trial_and_error", "none"]),
    resultReliability: z.enum(["mostly", "sometimes", "rarely"]),
    adaptationConfidence: z.enum(["yes", "partly", "no"]),
    currentConcerns: stringArray(PERSONAL_PLAN_QUIZ_CONCERNS),
    concernRecurrence: z
      .object({
        concernId: z.enum(PERSONAL_PLAN_QUIZ_CONCERNS),
        frequency: z.enum(["often", "sometimes", "rather_not"]),
      })
      .strict()
      .optional(),
    hairLength: z.enum(["very_short", "short", "medium", "long", "very_long"]),
    hairSurface: z.enum(["smooth", "slightly_uneven", "rough"]),
    elasticResponse: z.enum(["stretches_bounces", "stretches_stays", "snaps"]),
    chemicalTreatments: stringArray(
      ["natural", "colored", "lightened", "permed", "chemically_straightened"],
      1,
    ),
    scalpOiliness: z.enum(["oily", "balanced", "dry"]),
    scalpConcerns: stringArray(["oily_dandruff", "dry_dandruff", "irritated"]),
    previousAttempts: z.enum([
      "nothing_reliably_worked",
      "some_steps_helped",
      "little_targeted_trial",
      "mostly_works",
    ]),
    blockers: stringArray(
      [
        "conflicting_tips",
        "product_fit",
        "application_uncertainty",
        "different_scalp_and_lengths",
        "routine_too_complex",
        "time_and_cost",
        "consistency",
        "other",
      ],
      1,
    ),
    routineStyle: z.enum([
      "simple_reliable",
      "intentional_caring",
      "flexible_versatile",
      "precise_goal_oriented",
    ]),
    meaningfulMoment: z.enum(["everyday", "work", "social", "going_out", "special_occasions"]),
    blockersOtherText: z.string().trim().max(280).optional(),
    currentConcernsOtherText: z.string().trim().max(50).optional(),
  })
  .strict()
  .superRefine((answers, context) => {
    if (
      answers.concernRecurrence &&
      !answers.currentConcerns.includes(answers.concernRecurrence.concernId)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["concernRecurrence", "concernId"],
        message: "Wiederholung muss sich auf ein ausgewaehltes Anliegen beziehen",
      })
    }
  })

export const personalPlanLeadRequestSchema = z
  .object({
    email: z.string().trim().email("Bitte gib eine gueltige E-Mail-Adresse ein"),
    marketingConsent: z.boolean(),
    answers: durableAnswersSchema,
    preparedPlan: z
      .object({
        artifactId: z.string().uuid(),
        claimToken: z.string().min(40).max(200),
      })
      .strict(),
    funnelEventId: z.string().uuid().optional(),
  })
  .strict()

export type PersonalPlanLeadRequest = z.infer<typeof personalPlanLeadRequestSchema>

export const personalPlanPrepareRequestSchema = z
  .object({
    answers: durableAnswersSchema,
  })
  .strict()

export type PersonalPlanPrepareRequest = z.infer<typeof personalPlanPrepareRequestSchema>

export function normalizePersonalPlanEmail(email: string) {
  return email.trim().toLowerCase()
}

export function canonicalizePersonalPlanAnswers(
  answers: PersonalPlanLeadRequest["answers"] | PersonalPlanPrepareRequest["answers"],
): PersonalPlanQuizSubmissionEnvelope {
  const { currentConcernsOtherText, ...durableAnswers } = answers

  return {
    kind: PERSONAL_PLAN_QUIZ_KIND,
    version: PERSONAL_PLAN_QUIZ_VERSION,
    answers: {
      ...durableAnswers,
      goals: [...answers.goals].sort(),
      currentConcerns: [...answers.currentConcerns].sort(),
      scalpConcerns: [...answers.scalpConcerns].sort() as NonNullable<
        PersonalPlanQuizAnswers["scalpConcerns"]
      >,
      chemicalTreatments: [...answers.chemicalTreatments].sort() as NonNullable<
        PersonalPlanQuizAnswers["chemicalTreatments"]
      >,
      blockers: [...answers.blockers].sort() as NonNullable<PersonalPlanQuizAnswers["blockers"]>,
      ...(currentConcernsOtherText?.trim()
        ? { currentConcernsOtherText: currentConcernsOtherText.trim() }
        : {}),
    },
  }
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(",")}]`
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
    return `{${entries
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(",")}}`
  }
  return JSON.stringify(value)
}

export function hashPersonalPlanAnswers(envelope: PersonalPlanQuizSubmissionEnvelope): string {
  return createHash("sha256").update(stableJson(envelope)).digest("hex")
}

export function createPersonalPlanClaimCredential(): {
  claimToken: string
  claimTokenHash: string
} {
  const claimToken = randomBytes(32).toString("base64url")
  return {
    claimToken,
    claimTokenHash: hashPersonalPlanClaimToken(claimToken),
  }
}

export function hashPersonalPlanClaimToken(claimToken: string): string {
  return createHash("sha256").update(claimToken).digest("hex")
}
