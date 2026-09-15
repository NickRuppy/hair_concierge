import type { DiagnosticConcern, DiagnosticGoal } from "@/lib/quiz/diagnostic-input"
import type { Goal, ProfileConcern } from "@/lib/vocabulary"
import type {
  ChemicalTreatment,
  CuticleCondition,
  ScalpCondition,
} from "@/lib/vocabulary/profile-labels"
import { z } from "zod"

import {
  CHEMICAL_TREATMENT_TO_COLUMN,
  HAIR_SURFACE_TO_CUTICLE_CONDITION,
  SCALP_CONCERN_TO_SCALP_CONDITION,
  type ChemicalTreatmentInput,
  type HairSurfaceInput,
  type ScalpConcernInput,
} from "../legacy-vocabulary"
import { diagnosticsV1Schema, type DiagnosticsV1 } from "../schema"

/**
 * Backfill-only import of the narrow legacy `hair_profiles` diagnostics columns into a
 * PARTIAL `DiagnosticsV1` document, for users who have neither a personal-plan artifact nor
 * a legacy lead to project from (the `columns` branch of P4's artifact -> lead -> columns
 * precedence).
 *
 * Deliberately lossy (H3/P4 approve a lossy import): the legacy columns are themselves a
 * projection of richer quiz answers, so legacy-only values with no native equivalent
 * (`dandruff`/`oily_scalp` concerns, `healthier_hair`/`color_protection` goals) are DROPPED
 * rather than guessed at, and a null column omits its field rather than inventing a default.
 * The one exception is `scalp_condition`, whose `null` is a real answer in the legacy model
 * ("no scalp issue", `link-to-profile.ts` writes null when `has_scalp_issue === false`) and
 * therefore imports as `scalpConcerns: []`, not as an absent field.
 *
 * Pure: no I/O, no `server-only`.
 */

export type LegacyDiagnosticColumns = {
  hair_texture: string | null
  thickness: string | null
  density: string | null
  hair_length: string | null
  cuticle_condition: string | null
  protein_moisture_balance: string | null
  scalp_type: string | null
  scalp_condition: string | null
  chemical_treatment: string[] | null
  concerns: string[] | null
  goals: string[] | null
}

/** Inverses of the task-2 forward tables, built from those tables so the two can never drift.
 * All three forward maps are injective, so the inverse is a function. */
function invert<Key extends string, Value extends string>(
  forward: Record<Key, Value>,
): Partial<Record<Value, Key>> {
  return Object.fromEntries(Object.entries(forward).map(([key, value]) => [value, key])) as Partial<
    Record<Value, Key>
  >
}

const CUTICLE_CONDITION_TO_HAIR_SURFACE: Partial<Record<CuticleCondition, HairSurfaceInput>> =
  invert(HAIR_SURFACE_TO_CUTICLE_CONDITION)

const SCALP_CONDITION_TO_SCALP_CONCERN: Partial<Record<ScalpCondition, ScalpConcernInput>> = invert(
  SCALP_CONCERN_TO_SCALP_CONDITION,
)

const COLUMN_TO_CHEMICAL_TREATMENT: Partial<Record<ChemicalTreatment, ChemicalTreatmentInput>> =
  invert(CHEMICAL_TREATMENT_TO_COLUMN)

/**
 * Many-to-one legacy concern/goal projections have no computable inverse, so these two tables
 * are written out. They mirror `CONCERN_TO_PROFILE_CONCERN_MAP` / `GOAL_TO_PROFILE_GOAL_MAP`
 * (`src/lib/quiz/normalization.ts`) collapsed onto the native vocabulary, plus the
 * legacy-only values (`thinning`, `strengthen`, `less_split_ends`) that map onto the nearest
 * native family. `dandruff`/`oily_scalp` and `healthier_hair`/`color_protection` have no
 * native equivalent at all and are dropped.
 */
const COLUMN_CONCERN_TO_DIAGNOSTIC_CONCERN: Partial<Record<ProfileConcern, DiagnosticConcern>> = {
  hair_damage: "hair_damage",
  breakage: "breakage",
  split_ends: "split_ends",
  tangling: "tangling",
  dryness: "dry_lengths",
  frizz: "frizz_flyaways",
  hair_loss: "hair_loss_or_thinning",
  thinning: "hair_loss_or_thinning",
}

const COLUMN_GOAL_TO_DIAGNOSTIC_GOAL: Partial<Record<Goal, DiagnosticGoal>> = {
  moisture: "moisture",
  shine: "shine",
  less_frizz: "frizz_surface",
  curl_definition: "shape_definition",
  anti_breakage: "strength_ends",
  strengthen: "strength_ends",
  less_split_ends: "strength_ends",
  healthy_scalp: "scalp_balance",
  volume: "volume_balance",
  less_volume: "volume_balance",
}

/** A null column is "never answered" -> the field is omitted; a value the native vocabulary
 * does not know is dropped for the same reason (never coerced into a neighbouring value). */
function parseScalar<Schema extends z.ZodType>(
  schema: Schema,
  value: string | null,
): z.infer<Schema> | undefined {
  if (value === null) return undefined
  const result = schema.safeParse(value)
  return result.success ? result.data : undefined
}

function mapArray<Mapped extends string>(
  values: readonly string[] | null,
  table: Partial<Record<string, Mapped>>,
): Mapped[] | undefined {
  if (values === null) return undefined
  const seen = new Set<Mapped>()
  const mapped: Mapped[] = []
  for (const value of values) {
    const target = table[value]
    if (target === undefined || seen.has(target)) continue
    seen.add(target)
    mapped.push(target)
  }
  return mapped
}

function translateScalpCondition(value: string | null): ScalpConcernInput[] | undefined {
  // See the module doc: a null `scalp_condition` is the legacy model's "no scalp issue".
  if (value === null) return []
  const concern = SCALP_CONDITION_TO_SCALP_CONCERN[value as ScalpCondition]
  return concern ? [concern] : []
}

/** True when the row carries at least one legacy diagnostics answer. A row with nothing in
 * any of the 11 columns must NOT get a synthesised diagnostics document (it would claim
 * knowledge the row does not have and would bump `facts_revision` past the backfill guard). */
export function hasLegacyDiagnosticSignal(columns: LegacyDiagnosticColumns): boolean {
  return (
    columns.hair_texture !== null ||
    columns.thickness !== null ||
    columns.density !== null ||
    columns.hair_length !== null ||
    columns.cuticle_condition !== null ||
    columns.protein_moisture_balance !== null ||
    columns.scalp_type !== null ||
    columns.scalp_condition !== null ||
    (columns.chemical_treatment?.length ?? 0) > 0 ||
    (columns.concerns?.length ?? 0) > 0 ||
    (columns.goals?.length ?? 0) > 0
  )
}

export function legacyColumnsToDiagnostics(
  columns: LegacyDiagnosticColumns,
  options: { leadId?: string },
): DiagnosticsV1 {
  const shape = diagnosticsV1Schema.shape
  const hairSurface = columns.cuticle_condition
    ? CUTICLE_CONDITION_TO_HAIR_SURFACE[columns.cuticle_condition as CuticleCondition]
    : undefined
  const chemicalTreatments = mapArray(columns.chemical_treatment, COLUMN_TO_CHEMICAL_TREATMENT)
  const currentConcerns = mapArray(columns.concerns, COLUMN_CONCERN_TO_DIAGNOSTIC_CONCERN)
  const goals = mapArray(columns.goals, COLUMN_GOAL_TO_DIAGNOSTIC_GOAL)

  return diagnosticsV1Schema.parse({
    ...defined("texture", parseScalar(shape.texture, columns.hair_texture)),
    ...defined("thickness", parseScalar(shape.thickness, columns.thickness)),
    ...defined("density", parseScalar(shape.density, columns.density)),
    ...defined("hairLength", parseScalar(shape.hairLength, columns.hair_length)),
    ...defined("hairSurface", hairSurface),
    ...defined(
      "elasticResponse",
      parseScalar(shape.elasticResponse, columns.protein_moisture_balance),
    ),
    ...defined("scalpOiliness", parseScalar(shape.scalpOiliness, columns.scalp_type)),
    ...defined("scalpConcerns", translateScalpCondition(columns.scalp_condition)),
    ...defined("chemicalTreatments", chemicalTreatments),
    ...defined("currentConcerns", currentConcerns),
    ...defined("goals", goals),
    source: {
      kind: "legacy_columns" as const,
      version: 1 as const,
      ...(options.leadId ? { leadId: options.leadId } : {}),
      // Stored VERBATIM, like every other diagnostics source's `raw` (F26): the caller's own
      // column snapshot object, not a reconstruction.
      raw: columns,
    },
  })
}

function defined<Key extends string, Value>(
  key: Key,
  value: Value | undefined,
): Partial<Record<Key, Value>> {
  return value === undefined ? {} : ({ [key]: value } as Record<Key, Value>)
}
