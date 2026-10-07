import { resolveVisibleDiagnosticGoals, type DiagnosticConcern } from "@/lib/quiz/diagnostic-input"
import type { ProfileConcern } from "@/lib/vocabulary"
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
 * projection of richer quiz answers. The translation is the owner-approved migration table M
 * (Nick, 2026-09-30): goals go through THE one legacy-goal rule the quiz itself uses for old
 * answers (`resolveVisibleDiagnosticGoals`), so nothing is dropped — `healthier_hair` becomes
 * `strength_ends`, `color_protection` `shine`; the `oily_scalp` concern is dropped (the scalp
 * type carries oily scalps), a `dandruff` concern is not a hair concern at all but
 * `oily_dandruff` in `scalpConcerns`, and a stored `volume`/`less_volume` goal keeps its
 * direction in `volumeDirection`. A null column omits its field rather than inventing a
 * default.
 *
 * `scalp_condition` is the one column whose `null` can be a real answer rather than an absent
 * one ("no scalp issue": `link-to-profile.ts` writes null when `has_scalp_issue === false`),
 * but only for a row that answered the scalp section at all. Controller ruling 2026-09-16
 * (J2): a null `scalp_condition` imports as `scalpConcerns: []` ONLY when `scalp_type` is
 * non-null; with no `scalp_type` the row never answered and the field is omitted. An
 * unrecognised non-null `scalp_condition` is unknown, not "none", so it is omitted too.
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
  /** Derived from `goals` by the write side; carried here so the backfill's erasure check and
   * the catch-up comparison see every diagnostics-owned column. Read back only to break a tie
   * when the `goals` column stores BOTH `volume` and `less_volume` (table M's
   * `volumeDirection`). */
  desired_volume: string | null
  /** Main #611 (F1), written by the quiz link since 2026-09-25. Optional so snapshots that
   * predate the column still type-check; an absent value reads as `null`. Imported back as
   * `primaryConcern` only when it is one of the imported `currentConcerns` (a sole concern is
   * re-derived by the write side anyway). */
  primary_concern?: string | null
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
 * Migration table M (Nick, 2026-09-30) for concerns, written out because many-to-one legacy
 * projections have no computable inverse. A concern NOT listed is dropped, never coerced into a
 * neighbour: `oily_scalp` (the scalp type carries it). `dandruff` is handled apart (see
 * `DANDRUFF_CONCERN`). Goals have no table here: they use the quiz's own legacy-goal rule,
 * `resolveVisibleDiagnosticGoals` (owner correction, 2026-09-30: one rule in the codebase).
 */
const COLUMN_CONCERN_TO_DIAGNOSTIC_CONCERN: Partial<
  Record<ProfileConcern | (string & {}), DiagnosticConcern>
> = {
  hair_damage: "hair_damage",
  breakage: "breakage",
  split_ends: "split_ends",
  tangling: "tangling",
  dryness: "dry_lengths",
  frizz: "frizz_flyaways",
  hair_loss: "hair_loss_or_thinning",
  thinning: "hair_loss_or_thinning",
}

/** Table M: a legacy `dandruff` concern is a SCALP concern — `oily_dandruff` in
 * `scalpConcerns`, never a hair concern in `currentConcerns`. */
const DANDRUFF_CONCERN = "dandruff"

/** Table M, volume direction ("keep the stored direction for existing profiles"): the legacy
 * `goals` column stored `volume` / `less_volume`, which both collapse onto `volume_balance`.
 * Both stored at once (historically possible) is decided by the profile's own stored
 * `desired_volume` column when it says "less"; otherwise "volume" wins. (Unlike
 * `deriveDesiredVolumeFromGoals`, which only ever looks at the goals and lets "volume" win.) */
function storedVolumeDirection(
  goals: readonly string[] | null,
  desiredVolume: string | null,
): "more" | "less" | undefined {
  if (!goals) return undefined
  const more = goals.includes("volume")
  const less = goals.includes("less_volume")
  if (more && less) return desiredVolume === "less" ? "less" : "more"
  if (more) return "more"
  if (less) return "less"
  return undefined
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

function translateScalpCondition(
  scalpCondition: string | null,
  scalpType: string | null,
): ScalpConcernInput[] | undefined {
  // See the module doc (J2): "no scalp issue" only reads as an answer when the scalp section
  // was answered — `scalp_type` is the evidence for that.
  if (scalpCondition === null) return scalpType === null ? undefined : []
  const concern = SCALP_CONDITION_TO_SCALP_CONCERN[scalpCondition as ScalpCondition]
  return concern ? [concern] : undefined
}

/** `scalp_condition` plus table M's `dandruff` concern (added once, after what the condition
 * already says). */
function translateScalpConcerns(columns: LegacyDiagnosticColumns): ScalpConcernInput[] | undefined {
  const fromCondition = translateScalpCondition(columns.scalp_condition, columns.scalp_type)
  if (!columns.concerns?.includes(DANDRUFF_CONCERN)) return fromCondition
  const scalpConcerns = [...(fromCondition ?? [])]
  if (!scalpConcerns.includes("oily_dandruff")) scalpConcerns.push("oily_dandruff")
  return scalpConcerns
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

export type StoredColumnVolumeDirection = {
  value: "more" | "less"
  /** Which stored column said it: the `goals` column's `volume` / `less_volume`, else (no
   * direction in the goals) `desired_volume`. */
  from: "goals" | "desired_volume"
}

/**
 * Fix round 11 (owner ruling, plan §3 "the stored direction is kept for existing profiles"): the
 * direction the profile's columns store — what the OLD writer resolved at link time for a quiz
 * whose `volume_balance` states none. The goals column first (table M's rule above), else a
 * stored `desired_volume` of `more` / `less`; a `balanced` one is no direction.
 */
export function storedColumnVolumeDirection(
  columns: Pick<LegacyDiagnosticColumns, "goals" | "desired_volume">,
): StoredColumnVolumeDirection | undefined {
  const fromGoals = storedVolumeDirection(columns.goals, columns.desired_volume)
  if (fromGoals) return { value: fromGoals, from: "goals" }
  if (columns.desired_volume === "more" || columns.desired_volume === "less") {
    return { value: columns.desired_volume, from: "desired_volume" }
  }
  return undefined
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
  const goals = columns.goals === null ? undefined : resolveVisibleDiagnosticGoals(columns.goals)
  const volumeDirection = goals?.includes("volume_balance")
    ? storedVolumeDirection(columns.goals, columns.desired_volume)
    : undefined
  const primaryPick = columns.primary_concern
    ? COLUMN_CONCERN_TO_DIAGNOSTIC_CONCERN[columns.primary_concern as ProfileConcern]
    : undefined
  const primaryConcern =
    primaryPick && currentConcerns?.includes(primaryPick) ? primaryPick : undefined

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
    ...defined("scalpConcerns", translateScalpConcerns(columns)),
    ...defined("chemicalTreatments", chemicalTreatments),
    ...defined("currentConcerns", currentConcerns),
    ...defined("primaryConcern", primaryConcern),
    ...defined("goals", goals),
    ...defined("volumeDirection", volumeDirection),
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
