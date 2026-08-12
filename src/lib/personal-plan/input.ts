import { createHash } from "node:crypto"
import { z } from "zod"

import {
  personalPlanDurableAnswersBaseSchema,
  personalPlanDurableAnswersSchema,
} from "@/lib/personal-plan-quiz/persistence"
import {
  PERSONAL_PLAN_QUIZ_KIND,
  PERSONAL_PLAN_QUIZ_VERSION,
  type PersonalPlanQuizConcern,
} from "@/lib/personal-plan-quiz/types"
import {
  INITIAL_UNKNOWN_ROUTINE_CONTEXT,
  type PersonalPlanLegacyConcern,
  type PlanCurrentConcern,
  type PlanProfile,
  type PlanRoutineContext,
  type SupportedPersonalPlanQuizEnvelope,
  type LegacyQuizStage1Source,
  type SupportedStage1Source,
} from "./types"
import { canonicalizeQuizAnswers } from "@/lib/quiz/normalization"
import { adaptLegacyQuizAnswersForAssessment } from "@/lib/personal-plan-quiz/offer-adapter"
import type { QuizAnswers } from "@/lib/quiz/types"

const legacyConcernValues = [
  "dry_dull_lengths",
  "frizz_flyaways",
  "low_shine",
  "lost_shape",
  "low_volume_or_weighed_down",
  "breakage_or_split_ends",
  "tangling",
  "scalp_imbalance",
] as const satisfies readonly PersonalPlanLegacyConcern[]

const v3EnvelopeSchema = z
  .object({
    kind: z.literal(PERSONAL_PLAN_QUIZ_KIND),
    version: z.literal(PERSONAL_PLAN_QUIZ_VERSION),
    answers: personalPlanDurableAnswersSchema,
  })
  .strict()

const v2AnswersSchema = personalPlanDurableAnswersBaseSchema
  .omit({ currentConcerns: true, concernRecurrence: true })
  .extend({
    currentConcerns: z.array(z.enum(legacyConcernValues)).optional(),
    concernRecurrence: z.undefined().optional(),
  })
  .strict()

const v2EnvelopeSchema = z
  .object({
    kind: z.literal(PERSONAL_PLAN_QUIZ_KIND),
    version: z.literal(2),
    answers: v2AnswersSchema,
  })
  .strict()

const legacyStage1SourceSchema = z
  .object({
    kind: z.literal("legacy_quiz"),
    version: z.literal(1),
    leadId: z.string().min(1),
    answers: personalPlanDurableAnswersBaseSchema.pick({
      texture: true,
      thickness: true,
      density: true,
      goals: true,
      currentConcerns: true,
      hairLength: true,
      hairSurface: true,
      elasticResponse: true,
      chemicalTreatments: true,
      scalpOiliness: true,
      scalpConcerns: true,
    }),
  })
  .strict()

export type ParsedSupportedPersonalPlanQuizEnvelope =
  | { ok: true; envelope: SupportedPersonalPlanQuizEnvelope }
  | {
      ok: false
      error: {
        code: "invalid_quiz_envelope" | "unsupported_quiz_version"
        quizVersion: number | null
      }
    }

export function buildLegacyQuizStage1Source(input: {
  leadId: string
  answers: QuizAnswers
}): LegacyQuizStage1Source {
  const answers = adaptLegacyQuizAnswersForAssessment(canonicalizeQuizAnswers(input.answers))
  return {
    kind: "legacy_quiz",
    version: 1,
    leadId: input.leadId,
    answers: {
      texture: answers.texture,
      thickness: answers.thickness,
      density: answers.density,
      goals: [...(answers.goals ?? [])].sort(),
      currentConcerns: [...(answers.currentConcerns ?? [])].sort(),
      hairLength: answers.hairLength,
      hairSurface: answers.hairSurface,
      elasticResponse: answers.elasticResponse,
      chemicalTreatments: [...(answers.chemicalTreatments ?? [])].sort(),
      scalpOiliness: answers.scalpOiliness,
      scalpConcerns: [...(answers.scalpConcerns ?? [])].sort(),
    },
  }
}

export function parseSupportedStage1Source(raw: unknown):
  | { ok: true; source: SupportedStage1Source }
  | {
      ok: false
      error: {
        code: "invalid_quiz_envelope" | "unsupported_quiz_version"
        quizVersion: number | null
      }
    } {
  if (raw && typeof raw === "object" && (raw as { kind?: unknown }).kind === "legacy_quiz") {
    const parsed = legacyStage1SourceSchema.safeParse(raw)
    return parsed.success
      ? { ok: true, source: parsed.data as LegacyQuizStage1Source }
      : { ok: false, error: { code: "invalid_quiz_envelope", quizVersion: 1 } }
  }
  const parsed = parseSupportedPersonalPlanQuizEnvelope(raw)
  return parsed.ok ? { ok: true, source: parsed.envelope } : parsed
}

export function parseSupportedPersonalPlanQuizEnvelope(
  raw: unknown,
): ParsedSupportedPersonalPlanQuizEnvelope {
  const version =
    raw && typeof raw === "object" && typeof (raw as { version?: unknown }).version === "number"
      ? (raw as { version: number }).version
      : null

  if (version === 3) {
    const parsed = v3EnvelopeSchema.safeParse(raw)
    return parsed.success
      ? { ok: true, envelope: parsed.data as SupportedPersonalPlanQuizEnvelope }
      : { ok: false, error: { code: "invalid_quiz_envelope", quizVersion: 3 } }
  }

  if (version === 2) {
    const parsed = v2EnvelopeSchema.safeParse(raw)
    return parsed.success
      ? { ok: true, envelope: parsed.data as SupportedPersonalPlanQuizEnvelope }
      : { ok: false, error: { code: "invalid_quiz_envelope", quizVersion: 2 } }
  }

  return {
    ok: false,
    error: { code: "unsupported_quiz_version", quizVersion: version },
  }
}

const V2_CONCERN_MAP: Record<PersonalPlanLegacyConcern, PlanCurrentConcern | null> = {
  dry_dull_lengths: "dry_lengths",
  frizz_flyaways: "frizz_flyaways",
  low_shine: "low_shine",
  lost_shape: "lost_shape",
  low_volume_or_weighed_down: "low_volume_or_weighed_down",
  breakage_or_split_ends: "split_ends",
  tangling: "tangling",
  scalp_imbalance: null,
}

function normalizeV2Concerns(values: readonly PersonalPlanLegacyConcern[] | undefined) {
  const normalized = new Set<PlanCurrentConcern>()
  for (const value of values ?? []) {
    const mapped = V2_CONCERN_MAP[value]
    if (mapped) normalized.add(mapped)
  }
  return [...normalized].sort()
}

export function buildPlanProfile(
  envelope: SupportedStage1Source,
  options: {
    artifactId: string
    projection: "initial_quiz" | "refined_post_plan"
    routine?: PlanRoutineContext
  },
): PlanProfile {
  const routine = options.routine
    ? { ...INITIAL_UNKNOWN_ROUTINE_CONTEXT, ...options.routine }
    : INITIAL_UNKNOWN_ROUTINE_CONTEXT
  if (envelope.kind === "legacy_quiz") {
    const answers = envelope.answers
    return {
      source: { quizVersion: 1, artifactId: envelope.leadId, projection: options.projection },
      hair: {
        texture: answers.texture!,
        thickness: answers.thickness!,
        density: answers.density!,
        length: answers.hairLength!,
        surface: answers.hairSurface!,
        elasticity: answers.elasticResponse!,
        chemicalTreatments: [...(answers.chemicalTreatments ?? [])],
      },
      scalp: {
        oiliness: answers.scalpOiliness!,
        concerns: [...(answers.scalpConcerns ?? [])],
        irritationState: routine.scalpIrritationState,
      },
      goals: [...(answers.goals ?? [])],
      concerns: [...(answers.currentConcerns ?? [])],
      concernRecurrence: { state: "unknown", reason: "concern_recurrence" },
      routine,
    }
  }
  const concerns: PlanCurrentConcern[] =
    envelope.version === 2
      ? normalizeV2Concerns(envelope.answers.currentConcerns)
      : [...(envelope.answers.currentConcerns ?? [])]
  const answers = envelope.answers

  return {
    source: {
      quizVersion: envelope.version,
      artifactId: options.artifactId,
      projection: options.projection,
    },
    hair: {
      texture: answers.texture!,
      thickness: answers.thickness!,
      density: answers.density!,
      length: answers.hairLength!,
      surface: answers.hairSurface!,
      elasticity: answers.elasticResponse!,
      chemicalTreatments: [...(answers.chemicalTreatments ?? [])],
    },
    scalp: {
      oiliness: answers.scalpOiliness!,
      concerns: [...(answers.scalpConcerns ?? [])],
      irritationState: routine.scalpIrritationState,
    },
    goals: [...(answers.goals ?? [])],
    concerns,
    concernRecurrence:
      envelope.version === 3 && envelope.answers.concernRecurrence
        ? { state: "known", value: envelope.answers.concernRecurrence }
        : { state: "unknown", reason: "concern_recurrence" },
    routine,
  }
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(",")}]`
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(",")}}`
  }
  return JSON.stringify(value)
}

export function hashSupportedPersonalPlanQuizEnvelope(envelope: SupportedStage1Source): string {
  return createHash("sha256").update(stableJson(envelope)).digest("hex")
}

export function isV3Concern(value: string): value is PersonalPlanQuizConcern {
  return (
    value === "dry_lengths" ||
    value === "frizz_flyaways" ||
    value === "low_shine" ||
    value === "lost_shape" ||
    value === "low_volume_or_weighed_down" ||
    value === "hair_damage" ||
    value === "hair_loss_or_thinning" ||
    value === "breakage" ||
    value === "split_ends" ||
    value === "tangling"
  )
}
