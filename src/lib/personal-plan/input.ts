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
} from "./types"

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

export type ParsedSupportedPersonalPlanQuizEnvelope =
  | { ok: true; envelope: SupportedPersonalPlanQuizEnvelope }
  | {
      ok: false
      error: {
        code: "invalid_quiz_envelope" | "unsupported_quiz_version"
        quizVersion: number | null
      }
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
  envelope: SupportedPersonalPlanQuizEnvelope,
  options: {
    artifactId: string
    projection: "initial_quiz" | "refined_post_plan"
    routine?: PlanRoutineContext
  },
): PlanProfile {
  const routine = options.routine
    ? { ...INITIAL_UNKNOWN_ROUTINE_CONTEXT, ...options.routine }
    : INITIAL_UNKNOWN_ROUTINE_CONTEXT
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

export function hashSupportedPersonalPlanQuizEnvelope(
  envelope: SupportedPersonalPlanQuizEnvelope,
): string {
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
