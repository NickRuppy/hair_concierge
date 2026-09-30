import { z } from "zod"

import { personalPlanDurableAnswersBaseSchema } from "@/lib/personal-plan-quiz/persistence"
import {
  ADDITIONAL_HEAT_TOOLS,
  DRYING_ROUTES,
  DRY_SHAMPOO_BRIDGE_PREFERENCES,
  DRY_SHAMPOO_VISIBLE_HAIR_COLORS,
  HEAT_PROTECTION_CONSISTENCIES,
  OIL_PURPOSES,
  SCALP_IRRITATION_DETAILS,
  STAGE2_HEAT_EVENT_SOURCES,
  STAGE2_PRODUCT_CATEGORIES,
  WET_WASH_FREQUENCIES,
} from "@/lib/personal-plan/refinement/types"
import { PRODUCT_FREQUENCIES } from "@/lib/vocabulary/frequencies"
import {
  BRUSH_TYPES,
  NIGHT_PROTECTIONS,
  TOWEL_MATERIALS,
  TOWEL_TECHNIQUES,
} from "@/lib/vocabulary/onboarding-care"

/**
 * Pure schema/type layer for the `hair_profiles` user-facts domains
 * (`diagnostics`, `care_habits`, `quiz_context`). No `server-only` import:
 * client code is allowed to import these types/schemas later.
 */

export const USER_FACTS_DOMAINS = ["diagnostics", "care_habits", "quiz_context"] as const
export type UserFactsDomain = (typeof USER_FACTS_DOMAINS)[number]

export const DIAGNOSTICS_SCHEMA_VERSION = 1
export const CARE_HABITS_SCHEMA_VERSION = 1
export const QUIZ_CONTEXT_SCHEMA_VERSION = 1

/** Thrown by the projectors in `project-artifact.ts` / `project-legacy-lead.ts` on unsupported
 * or incomplete input. Projections never synthesize missing answers into a silent partial
 * object — they throw this instead. */
export class UnsupportedUserFactsSourceError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message)
    this.name = "UnsupportedUserFactsSourceError"
  }
}

/** Thrown by `toStage1Source` (task 4 fix round 1) when an EDITED emission is requested for
 * diagnostics missing one or more of the 11 fields a native envelope requires. Stored
 * diagnostics may be partial (controller ruling 2026-09-15), but an edited emission has to
 * synthesize a full envelope from native fields, so completeness is enforced at exactly this
 * boundary rather than silently omitting keys. */
export class UserFactsIncompleteError extends Error {
  constructor(
    message: string,
    readonly missingFields: string[],
  ) {
    super(message)
    this.name = "UserFactsIncompleteError"
  }
}

/** Generic array de-duplication check, mirroring `stringArray`'s dedupe rule in
 * `src/lib/personal-plan-quiz/persistence.ts` without retyping any vocabulary (the element
 * schema is always passed in by the caller). */
function dedupeArray<Element extends z.ZodType>(element: Element) {
  return z.array(element).superRefine((items, context) => {
    if (new Set(items).size !== items.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Werte duerfen nicht doppelt vorkommen",
      })
    }
  })
}

// ---------------------------------------------------------------------------
// diagnostics.source (F26: verbatim envelope preservation)
// ---------------------------------------------------------------------------

const diagnosticsSourceBaseFields = {
  leadId: z.string().min(1),
  artifactId: z.string().min(1).optional(),
  raw: z.unknown(),
  // Wave-1 fix F1 (Nick, 2026-09-30: "newer" means when the quiz was TAKEN): the quiz's own
  // timestamp — `personal_plan_prepared_artifacts.created_at` / `leads.created_at` — as a
  // canonical ISO string. Beside `raw`, never inside it (`raw` is the verbatim envelope).
  // Optional: absent when the quiz time is unknown and on documents written before F1.
  takenAt: z.string().datetime().optional(),
}

/** A database timestamp (`2026-09-22 09:00:00.123456+00`, ISO, …) as the canonical ISO string
 * `takenAt` stores, or `undefined` when it is missing or unreadable. */
export function toTakenAt(value: string | null | undefined): string | undefined {
  if (typeof value !== "string") return undefined
  const time = Date.parse(value)
  return Number.isNaN(time) ? undefined : new Date(time).toISOString()
}

export const diagnosticsSourceSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("personal_plan_v3"),
      version: z.literal(3),
      ...diagnosticsSourceBaseFields,
    })
    .strict(),
  z
    .object({
      kind: z.literal("personal_plan_v2"),
      version: z.literal(2),
      ...diagnosticsSourceBaseFields,
    })
    .strict(),
  z
    .object({
      kind: z.literal("legacy_quiz"),
      version: z.literal(1),
      ...diagnosticsSourceBaseFields,
    })
    .strict(),
  // Backfill-only (controller ruling 2026-09-15): synthesised for users with neither a
  // personal-plan artifact nor a legacy lead, from the legacy `hair_profiles` columns
  // themselves. `leadId` is optional (there may be none) and `raw` is the column snapshot,
  // not a quiz envelope, so `toStage1Source` refuses it outright — see stage1-source.ts.
  z
    .object({
      kind: z.literal("legacy_columns"),
      version: z.literal(1),
      leadId: z.string().min(1).optional(),
      raw: z.unknown(),
    })
    .strict(),
])
export type DiagnosticsSource = z.infer<typeof diagnosticsSourceSchema>

// ---------------------------------------------------------------------------
// DiagnosticsV1
// ---------------------------------------------------------------------------

// Controller ruling 2026-09-15: every field is OPTIONAL except `source` — stored diagnostics
// may be partial (an edit that clears a field, or a legacy-derived row that never carried
// one). Completeness is enforced at the Stage-1 boundary (`parseSupportedStage1Source`), not
// here.
export const diagnosticsV1Schema = z
  .object({
    texture: personalPlanDurableAnswersBaseSchema.shape.texture.optional(),
    thickness: personalPlanDurableAnswersBaseSchema.shape.thickness.optional(),
    density: personalPlanDurableAnswersBaseSchema.shape.density.optional(),
    hairLength: personalPlanDurableAnswersBaseSchema.shape.hairLength.optional(),
    hairSurface: personalPlanDurableAnswersBaseSchema.shape.hairSurface.optional(),
    elasticResponse: personalPlanDurableAnswersBaseSchema.shape.elasticResponse.optional(),
    // Deliberately NOT reusing the base schema's `.min(1)` here: edited or legacy-derived
    // diagnostics can legitimately end up with zero goals/chemical treatments (a user clears
    // the field on edit, or a historical row never carried a value). The enum vocabulary
    // itself (the array element schema) is still reused verbatim from persistence.ts.
    chemicalTreatments: dedupeArray(
      personalPlanDurableAnswersBaseSchema.shape.chemicalTreatments.element,
    ).optional(),
    scalpOiliness: personalPlanDurableAnswersBaseSchema.shape.scalpOiliness.optional(),
    scalpConcerns: personalPlanDurableAnswersBaseSchema.shape.scalpConcerns.optional(),
    goals: dedupeArray(personalPlanDurableAnswersBaseSchema.shape.goals.element).optional(),
    // Migration table M (Nick, 2026-09-30: "keep the stored direction for existing
    // profiles"): the direction of a `volume_balance` goal as the legacy `goals` column stored
    // it (`volume` -> "more", `less_volume` -> "less"). Set ONLY by the legacy-columns backfill;
    // new quiz answers never set it. When present it decides how `volume_balance` derives into
    // the legacy `goals` / `desired_volume` columns; when absent the hair-type resolver does.
    volumeDirection: z.enum(["more", "less"]).optional(),
    currentConcerns: personalPlanDurableAnswersBaseSchema.shape.currentConcerns.optional(),
    // Her stated main problem (main #611, F1): the explicit pick only, as the v3 envelope
    // carries it (`canonicalizePersonalPlanAnswers` keeps it only while it is one of
    // `currentConcerns`). Deliberately NO "must be one of currentConcerns" refine, unlike
    // `concernRecurrence`: main drops a stale pick, never rejects it, so a later
    // `currentConcerns` edit must not start failing writes — the derived
    // `hair_profiles.primary_concern` column ignores a stale pick instead.
    primaryConcern: personalPlanDurableAnswersBaseSchema.shape.primaryConcern,
    concernRecurrence: personalPlanDurableAnswersBaseSchema.shape.concernRecurrence,
    currentConcernsOtherText: personalPlanDurableAnswersBaseSchema.shape.currentConcernsOtherText,
    source: diagnosticsSourceSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.concernRecurrence &&
      value.currentConcerns &&
      !value.currentConcerns.includes(value.concernRecurrence.concernId)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["concernRecurrence", "concernId"],
        message: "Wiederholung muss sich auf ein ausgewaehltes Anliegen beziehen",
      })
    }
  })

export type DiagnosticsV1 = z.infer<typeof diagnosticsV1Schema>

// ---------------------------------------------------------------------------
// QuizContextV1
// ---------------------------------------------------------------------------

export const quizContextV1Schema = z
  .object({
    routineClarity: personalPlanDurableAnswersBaseSchema.shape.routineClarity.optional(),
    resultReliability: personalPlanDurableAnswersBaseSchema.shape.resultReliability.optional(),
    adaptationConfidence:
      personalPlanDurableAnswersBaseSchema.shape.adaptationConfidence.optional(),
    previousAttempts: personalPlanDurableAnswersBaseSchema.shape.previousAttempts.optional(),
    blockers: personalPlanDurableAnswersBaseSchema.shape.blockers.optional(),
    blockersOtherText: personalPlanDurableAnswersBaseSchema.shape.blockersOtherText,
    routineStyle: personalPlanDurableAnswersBaseSchema.shape.routineStyle.optional(),
    meaningfulMoment: personalPlanDurableAnswersBaseSchema.shape.meaningfulMoment.optional(),
  })
  .strict()

export type QuizContextV1 = z.infer<typeof quizContextV1Schema>

// ---------------------------------------------------------------------------
// CareHabitsV1 (full PersonalPlanRefinementAnswersV1 shape + brushesCombs)
// ---------------------------------------------------------------------------

const HEAT_EVENT_QUESTION_IDS = STAGE2_HEAT_EVENT_SOURCES.map((source) => `heat:${source}` as const)

const heatEventAnswerSchema = z
  .object({
    frequency: z.enum(PRODUCT_FREQUENCIES),
    protectionConsistency: z.enum(HEAT_PROTECTION_CONSISTENCIES).optional(),
  })
  .strict()

const towelSchema = z
  .object({
    material: z.enum(TOWEL_MATERIALS),
    technique: z.enum(TOWEL_TECHNIQUES).optional(),
  })
  .strict()

export const careHabitsV1Schema = z
  .object({
    currentProductCategories: dedupeArray(z.enum(STAGE2_PRODUCT_CATEGORIES)).optional(),
    wetWashFrequency: z.enum(WET_WASH_FREQUENCIES).optional(),
    scalpIrritationDetail: z.enum(SCALP_IRRITATION_DETAILS).optional(),
    dryShampooBridgePreference: z.enum(DRY_SHAMPOO_BRIDGE_PREFERENCES).optional(),
    dryShampooVisibleHairColor: z.enum(DRY_SHAMPOO_VISIBLE_HAIR_COLORS).optional(),
    oilPurposes: dedupeArray(z.enum(OIL_PURPOSES)).optional(),
    towel: towelSchema.optional(),
    dryingRoutes: dedupeArray(z.enum(DRYING_ROUTES)).optional(),
    additionalHeatTools: dedupeArray(z.enum(ADDITIONAL_HEAT_TOOLS)).optional(),
    heatEvents: z.partialRecord(z.enum(HEAT_EVENT_QUESTION_IDS), heatEventAnswerSchema).optional(),
    nightProtection: dedupeArray(z.enum(NIGHT_PROTECTIONS)).optional(),
    // Legacy `hair_profiles.brush_type` vocabulary; no Stage-2 version ever carried it (see
    // explore/B-habits.md §10).
    brushesCombs: dedupeArray(z.enum(BRUSH_TYPES)).optional(),
  })
  .strict()

export type CareHabitsV1 = z.infer<typeof careHabitsV1Schema>

// ---------------------------------------------------------------------------
// Provenance
// ---------------------------------------------------------------------------

export const fieldProvenanceValueSchema = z.enum(["user", "assumed", "unknown_historical"])
export type FieldProvenanceValue = z.infer<typeof fieldProvenanceValueSchema>

export const domainProvenanceSchema = z
  .object({
    source: z
      .object({
        kind: z.enum([
          "personal_plan_artifact",
          "legacy_lead",
          "legacy_columns",
          "refined_version",
          "feinschliff_draft",
          "onboarding",
          "profile_editor",
          "account_link",
        ]),
        id: z.string().min(1).optional(),
      })
      .strict(),
    schemaVersion: z.number().int().positive(),
    at: z.string().datetime(),
    editedAt: z.string().datetime().nullable().optional(),
    fields: z.record(z.string(), fieldProvenanceValueSchema).optional(),
    preservedCandidates: z
      .array(
        z
          .object({
            kind: z.enum(["artifact", "lead"]),
            id: z.string().min(1),
            at: z.string().datetime(),
          })
          .strict(),
      )
      .optional(),
  })
  .strict()

export type DomainProvenance = z.infer<typeof domainProvenanceSchema>

// Non-strict: the DB default is `{}` and unknown top-level keys here are harmless.
export const factsProvenanceSchema = z.object({
  diagnostics: domainProvenanceSchema.optional(),
  care_habits: domainProvenanceSchema.optional(),
  quiz_context: domainProvenanceSchema.optional(),
})

export type FactsProvenance = z.infer<typeof factsProvenanceSchema>

// ---------------------------------------------------------------------------
// Patch schemas (task 4: every field optional, and nullable to mean "clear")
// ---------------------------------------------------------------------------

function toPatchSchema<Shape extends z.ZodRawShape>(shape: Shape) {
  const patchShape = Object.fromEntries(
    Object.entries(shape).map(([key, fieldSchema]) => [
      key,
      (fieldSchema as z.ZodType).nullable().optional(),
    ]),
  ) as unknown as { [Key in keyof Shape]: z.ZodOptional<z.ZodNullable<Shape[Key]>> }
  return z.object(patchShape).strict()
}

// `source` is provenance-critical and must never be clearable via a field-level patch: it may
// be omitted (unchanged) or replaced by a full valid source envelope, but never `null`.
export const diagnosticsPatchSchema = toPatchSchema(diagnosticsV1Schema.shape).extend({
  source: diagnosticsSourceSchema.optional(),
})
export type DiagnosticsPatch = z.infer<typeof diagnosticsPatchSchema>

export const careHabitsPatchSchema = toPatchSchema(careHabitsV1Schema.shape)
export type CareHabitsPatch = z.infer<typeof careHabitsPatchSchema>

export const quizContextPatchSchema = toPatchSchema(quizContextV1Schema.shape)
export type QuizContextPatch = z.infer<typeof quizContextPatchSchema>
