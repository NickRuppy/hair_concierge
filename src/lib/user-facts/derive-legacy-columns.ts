import {
  CONCERN_TO_PROFILE_CONCERN_MAP,
  GOAL_TO_PROFILE_GOAL_MAP,
  resolveVolumeBalanceGoal,
} from "@/lib/quiz/normalization"
import { deriveDesiredVolumeFromGoals } from "@/lib/hair-profile/derived"
import {
  getSelectedStage2HeatEventSources,
  createStage2HeatEventId,
} from "@/lib/personal-plan/refinement/heat-events"
import { chooseHigherProductFrequency, type ProductFrequency } from "@/lib/vocabulary/frequencies"
import type { HeatProtectionConsistency } from "@/lib/personal-plan/refinement/types"

import type { CareHabitsV1, DiagnosticsV1 } from "./schema"
import {
  CHEMICAL_TREATMENT_TO_COLUMN,
  DRYING_ROUTE_TO_DRYING_METHOD,
  HAIR_SURFACE_TO_CUTICLE_CONDITION,
  HEAT_SOURCE_TO_STYLING_TOOL,
  PRODUCT_FREQUENCY_TO_HEAT_STYLING,
  SCALP_CONCERN_PRIORITY,
  SCALP_CONCERN_TO_SCALP_CONDITION,
} from "./legacy-vocabulary"

/**
 * Pure derivation of the narrow legacy `hair_profiles` columns from the jsonb fact
 * domains (`DiagnosticsV1` / `CareHabitsV1`). This is the specification oracle for
 * the program: task 3 re-implements the same rules in SQL and runs a parity test
 * against this module's test rows, and task 5's onboarding writer consumes the
 * inverse tables in `legacy-vocabulary.ts`. No I/O, no `server-only`, no zod
 * parsing — inputs are already typed.
 */

export type DiagnosticsDerivedColumns = {
  hair_texture: string | null
  thickness: string | null
  density: string | null
  hair_length: string | null
  cuticle_condition: string | null
  protein_moisture_balance: string | null
  scalp_type: string | null
  scalp_condition: string | null
  // Controller ruling 2026-09-15 (task-2-3-amendment-brief.md): legacy readers
  // rely on the historical `NOT NULL DEFAULT '{}'` contract for these three
  // columns (`HairProfile` types them non-nullable; unguarded `.includes`/
  // `.length` call sites in section-config.ts, get-user-context.ts,
  // load-advisor-guidance.ts), so an absent fact projects as `[]`, never
  // `null`, for these three legacy projections. Everything else (scalars,
  // styling_tools/night_protection/brush_type) keeps the absent -> null rule.
  chemical_treatment: string[]
  concerns: string[]
  goals: string[]
  desired_volume: "more" | "less" | null
  /** Main #611 (F1): her stated main problem in the `concerns` column vocabulary — see
   * `derivePrimaryConcern`. */
  primary_concern: string | null
}

export type CareHabitsDerivedColumns = {
  drying_method: string | null
  heat_styling: string | null
  styling_tools: string[] | null
  uses_heat_protection: boolean
  towel_material: string | null
  towel_technique: string | null
  night_protection: string[] | null
  brush_type: string[] | null
}

/**
 * Maps every value of `values` through `map`, preserving input order, dropping
 * unmapped values, and deduping the mapped output (first occurrence wins).
 * `undefined` input (the field was never answered) becomes `null`; `[]` stays `[]`.
 */
function mapVocabularyArray(
  values: readonly string[] | undefined,
  map: Readonly<Partial<Record<string, string>>>,
): string[] | null {
  if (values === undefined) return null

  const seen = new Set<string>()
  const result: string[] = []
  for (const value of values) {
    const mapped = map[value]
    if (mapped === undefined || seen.has(mapped)) continue
    seen.add(mapped)
    result.push(mapped)
  }
  return result
}

function deriveScalpCondition(scalpConcerns: readonly string[] | undefined): string | null {
  if (!scalpConcerns || scalpConcerns.length === 0) return null

  for (const concern of SCALP_CONCERN_PRIORITY) {
    if (scalpConcerns.includes(concern)) return SCALP_CONCERN_TO_SCALP_CONDITION[concern]
  }
  return null
}

function deriveGoals(diagnostics: DiagnosticsV1): string[] {
  // Controller ruling 2026-09-15: absent -> [], not null (see DiagnosticsDerivedColumns).
  if (diagnostics.goals === undefined) return []

  const seen = new Set<string>()
  const result: string[] = []
  for (const value of diagnostics.goals) {
    const mapped =
      value === "volume_balance"
        ? resolveVolumeBalanceGoal({
            thickness: diagnostics.thickness,
            density: diagnostics.density,
            structure: diagnostics.texture,
          })
        : (GOAL_TO_PROFILE_GOAL_MAP[value] ?? null)

    if (!mapped || seen.has(mapped)) continue
    seen.add(mapped)
    result.push(mapped)
  }
  return result
}

/**
 * `hair_profiles.primary_concern` (main #611, F1), mirroring `buildProfilePrimaryConcern`
 * (`src/lib/quiz/link-to-profile.ts`), which the quiz link used to write directly: her explicit
 * pick while it is one of `currentConcerns`, else her only concern, else nothing — projected
 * into the same legacy vocabulary as `concerns`, `null` when it has no legacy equivalent
 * (low_shine, lost_shape, low_volume_or_weighed_down). Absent `currentConcerns` -> `null`
 * (the `concerns` column is `[]` then, and the column's trigger would drop any pick anyway).
 */
function derivePrimaryConcern(diagnostics: DiagnosticsV1): string | null {
  const concerns = diagnostics.currentConcerns
  if (!concerns || concerns.length === 0) return null
  const stated =
    diagnostics.primaryConcern && concerns.includes(diagnostics.primaryConcern)
      ? diagnostics.primaryConcern
      : concerns.length === 1
        ? concerns[0]
        : null
  return stated ? (CONCERN_TO_PROFILE_CONCERN_MAP[stated] ?? null) : null
}

export function deriveDiagnosticsColumns(diagnostics: DiagnosticsV1): DiagnosticsDerivedColumns {
  const goals = deriveGoals(diagnostics)

  return {
    hair_texture: diagnostics.texture ?? null,
    thickness: diagnostics.thickness ?? null,
    density: diagnostics.density ?? null,
    hair_length: diagnostics.hairLength ?? null,
    cuticle_condition: diagnostics.hairSurface
      ? (HAIR_SURFACE_TO_CUTICLE_CONDITION[diagnostics.hairSurface] ?? null)
      : null,
    protein_moisture_balance: diagnostics.elasticResponse ?? null,
    scalp_type: diagnostics.scalpOiliness ?? null,
    scalp_condition: deriveScalpCondition(diagnostics.scalpConcerns),
    // Controller ruling 2026-09-15: absent -> [], not null (see DiagnosticsDerivedColumns).
    chemical_treatment:
      mapVocabularyArray(diagnostics.chemicalTreatments, CHEMICAL_TREATMENT_TO_COLUMN) ?? [],
    concerns: mapVocabularyArray(diagnostics.currentConcerns, CONCERN_TO_PROFILE_CONCERN_MAP) ?? [],
    goals,
    // `deriveDesiredVolumeFromGoals` with a `null` fallback only ever returns
    // "more" | "less" | null (never "balanced": that value only ever comes from
    // the fallback slot, which is `null` here).
    desired_volume: deriveDesiredVolumeFromGoals(goals, null) as "more" | "less" | null,
    primary_concern: derivePrimaryConcern(diagnostics),
  }
}

function deriveDryingMethod(dryingRoutes: CareHabitsV1["dryingRoutes"]): string | null {
  if (!dryingRoutes || dryingRoutes.length === 0) return null

  const priority: NonNullable<CareHabitsV1["dryingRoutes"]>[number][] = [
    "diffuser_or_airflow_shaping",
    "ordinary_blow_dry",
    "air_dry",
  ]
  for (const route of priority) {
    if (dryingRoutes.includes(route)) return DRYING_ROUTE_TO_DRYING_METHOD[route]
  }
  return null
}

type HeatColumns = Pick<
  CareHabitsDerivedColumns,
  "heat_styling" | "styling_tools" | "uses_heat_protection"
>

function deriveHeatColumns(careHabits: CareHabitsV1): HeatColumns {
  if (careHabits.dryingRoutes === undefined && careHabits.additionalHeatTools === undefined) {
    return { heat_styling: null, styling_tools: null, uses_heat_protection: false }
  }

  const selectedSources = getSelectedStage2HeatEventSources(careHabits)

  if (selectedSources.length === 0) {
    return { heat_styling: "never", styling_tools: [], uses_heat_protection: false }
  }

  const heatEvents = careHabits.heatEvents ?? {}

  let highestFrequency: ProductFrequency | null = null
  const protectionValues: HeatProtectionConsistency[] = []
  for (const source of selectedSources) {
    const event = heatEvents[createStage2HeatEventId(source)]
    if (!event) continue
    highestFrequency = chooseHigherProductFrequency(highestFrequency, event.frequency)
    if (event.protectionConsistency !== undefined) {
      protectionValues.push(event.protectionConsistency)
    }
  }

  const heat_styling = highestFrequency ? PRODUCT_FREQUENCY_TO_HEAT_STYLING[highestFrequency] : null

  // Emitted in CANONICAL `STAGE2_HEAT_EVENT_SOURCES` order, regardless of the order
  // `dryingRoutes`/`additionalHeatTools` were given in: a derived projection must not
  // depend on click order, so the value is a stable function of the selected set alone
  // (needed for stable `changed` detection and trivial SQL parity in task 3). Controller
  // ruling 2026-09-15, task-2-brief.md rule 11 (amended). `selectedSources` is already in
  // that canonical order (`getSelectedStage2HeatEventSources` filters
  // `STAGE2_HEAT_EVENT_SOURCES` in place), so a single pass over it is sufficient.
  const styling_tools = mapVocabularyArray(selectedSources, HEAT_SOURCE_TO_STYLING_TOOL) ?? []

  const uses_heat_protection =
    protectionValues.length > 0 && protectionValues.every((value) => value === "always")

  return { heat_styling, styling_tools, uses_heat_protection }
}

export function deriveCareHabitsColumns(careHabits: CareHabitsV1): CareHabitsDerivedColumns {
  const heatColumns = deriveHeatColumns(careHabits)

  return {
    drying_method: deriveDryingMethod(careHabits.dryingRoutes),
    ...heatColumns,
    towel_material: careHabits.towel?.material ?? null,
    towel_technique: careHabits.towel?.technique ?? null,
    night_protection:
      careHabits.nightProtection === undefined ? null : [...careHabits.nightProtection],
    brush_type: careHabits.brushesCombs === undefined ? null : [...careHabits.brushesCombs],
  }
}

export function deriveLegacyColumns(input: {
  diagnostics: DiagnosticsV1 | null
  careHabits: CareHabitsV1 | null
}): Partial<DiagnosticsDerivedColumns & CareHabitsDerivedColumns> {
  return {
    ...(input.diagnostics ? deriveDiagnosticsColumns(input.diagnostics) : {}),
    ...(input.careHabits ? deriveCareHabitsColumns(input.careHabits) : {}),
  }
}
