import { z } from "zod"

import { normalizeBrushTypeValues } from "@/lib/profile/brush-type"
import { HEAT_STYLING_LEVELS } from "@/lib/vocabulary/frequencies"
import {
  BRUSH_TYPES,
  DRYING_METHODS,
  NIGHT_PROTECTIONS,
  TOWEL_MATERIALS,
  TOWEL_TECHNIQUES,
} from "@/lib/vocabulary/onboarding-care"
import { STYLING_TOOLS } from "@/lib/vocabulary/profile-labels"
import {
  deriveCareHabitsColumns,
  type CareHabitsDerivedColumns,
} from "@/lib/user-facts/derive-legacy-columns"
import {
  legacyColumnsToCareHabits,
  selectsOnlyDryerSources,
  type LegacyCareHabitColumns,
} from "@/lib/user-facts/backfill/legacy-columns-to-care-habits"
import { getSelectedStage2HeatEventSources } from "@/lib/personal-plan/refinement/heat-events"
import type { UserFacts } from "@/lib/user-facts/read"
import {
  CARE_HABITS_SCHEMA_VERSION,
  careHabitsPatchSchema,
  careHabitsV1Schema,
  type CareHabitsPatch,
  type CareHabitsV1,
  type DomainProvenance,
  type FieldProvenanceValue,
} from "@/lib/user-facts/schema"

/**
 * Clean-switch task 6 (plan 2026-09-30 §4): the onboarding screens (heat tools, frequency,
 * protection, towel, drying, brush, night) used to upsert eight `hair_profiles` care columns
 * from the browser. They now post the same legacy column values to `POST /api/profile/care-habits`
 * and this module turns them into a `care_habits` hand edit for `user_facts_save_v1` — which then
 * derives the eight columns itself.
 *
 * The conversion from the legacy vocabulary is the ONE existing one
 * (`legacyColumnsToCareHabits`); nothing here is a second table. What this module adds is only
 * hand-edit semantics, like `buildHandEditFacts` does for the diagnostics editors:
 *  - a value the step does not name is never touched (partial step = partial patch);
 *  - only a document field whose value changed is written and re-marked `user`;
 *  - a save that changes none of the document fields the step owns is not an edit: nothing is
 *    written (fix round 4 I5: decided on the document, not on the derived columns, so a real
 *    answer the columns cannot show — `air_dry` next to a dryer — is still stored);
 *  - drying routes the tool list cannot express (`air_dry`) are kept unless the step names a
 *    different drying method (I4);
 *  - the product owner's decisions 1 and 2 (Nick 2026-09-30) apply on the fly through the one
 *    conversion: „Nie“ with tools stores no tools; dryer-only with „Ja“ owns `heat_protectant`;
 *  - a row that has legacy columns but no document gets its whole converted base written with the
 *    edit (the door derives all eight columns from the document, so a partial document would
 *    blank the columns the step did not name).
 *
 * Deterministic and I/O-free.
 */

/** A list answer: string members outside the vocabulary are dropped (a stale stored value the
 * step hydrated must never fail the save, fix round 4 M1), duplicates collapse, order is kept. */
const knownList = <Value extends string>(vocabulary: readonly Value[]) =>
  z
    .array(z.string())
    .transform((list) =>
      [...new Set(list)].filter((item): item is Value =>
        (vocabulary as readonly string[]).includes(item),
      ),
    )

/** A single answer: a string outside the vocabulary reads as "not answered in this step" (M1). */
const knownValue = <Value extends string>(vocabulary: readonly Value[]) =>
  z
    .string()
    .transform((value): Value | undefined =>
      (vocabulary as readonly string[]).includes(value) ? (value as Value) : undefined,
    )

/** The payload: the legacy column values one onboarding step submits. Unnamed = unchanged.
 * Wrong types, unknown keys and an empty body are rejected; a stale VALUE is not (M1). */
export const onboardingCareSchema = z
  .record(z.string(), z.unknown())
  .refine((body) => Object.keys(body).length > 0, { message: "Keine Antworten zum Speichern" })
  .pipe(
    z
      .object({
        styling_tools: knownList(STYLING_TOOLS),
        heat_styling: knownValue(HEAT_STYLING_LEVELS),
        uses_heat_protection: z.boolean().nullable(),
        towel_material: knownValue(TOWEL_MATERIALS).nullable(),
        towel_technique: knownValue(TOWEL_TECHNIQUES).nullable(),
        drying_method: knownValue(DRYING_METHODS).nullable(),
        brush_type: knownList(BRUSH_TYPES).nullable(),
        night_protection: knownList(NIGHT_PROTECTIONS),
      })
      .partial()
      .strict(),
  )

export type OnboardingCareValues = z.infer<typeof onboardingCareSchema>

export type OnboardingCareStoredFacts = Pick<UserFacts, "careHabits" | "provenance">

export type OnboardingCareFactsWrite = {
  patch: CareHabitsPatch
  provenance: DomainProvenance
  /** The eight columns `user_facts_save_v1` derives from the merged document — what the row will
   * hold after the write (the TS oracle, parity-tested against the SQL). */
  columns: CareHabitsDerivedColumns
  /** Set when the save changes none of the document fields the step owns: not an edit, write
   * nothing. */
  unchanged?: true
}

/** `user_facts_save_v1`'s merge for `care_habits`: the patch over the document, a top-level null
 * clears the field. Throws when the result is not a valid document. */
export function mergeCareHabitsPatch(
  old: CareHabitsV1 | null,
  patch: CareHabitsPatch,
): CareHabitsV1 {
  const next: Record<string, unknown> = { ...(old ?? {}), ...patch }
  for (const [key, value] of Object.entries(patch)) if (value === null) delete next[key]
  return careHabitsV1Schema.parse(next)
}

type LegacyRowColumns = LegacyCareHabitColumns & { brush_type: unknown }

function text(value: unknown): string | null {
  return typeof value === "string" ? value : null
}

function list(value: unknown): string[] | null {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : null
}

/** The document a row without `care_habits` stands for: its legacy columns through the one
 * existing conversion, plus the brush types (`brush_type` -> `brushesCombs`, as the backfill lifts
 * them). */
function careHabitsFromRow(row: Record<string, unknown>): CareHabitsV1 {
  const columns: LegacyRowColumns = {
    towel_material: text(row.towel_material),
    towel_technique: text(row.towel_technique),
    drying_method: text(row.drying_method),
    styling_tools: list(row.styling_tools),
    heat_styling: text(row.heat_styling),
    uses_heat_protection:
      typeof row.uses_heat_protection === "boolean" ? row.uses_heat_protection : null,
    night_protection: list(row.night_protection),
    brush_type: row.brush_type,
  }
  const brushes = normalizeBrushTypeValues(columns.brush_type)
  return careHabitsV1Schema.parse({
    ...legacyColumnsToCareHabits(columns),
    ...(brushes ? { brushesCombs: brushes } : {}),
  })
}

function canonical(value: unknown): string {
  const sorted = (input: unknown): unknown => {
    if (Array.isArray(input)) {
      return input.every((item) => typeof item === "string") ? [...input].sort() : input.map(sorted)
    }
    if (input && typeof input === "object") {
      return Object.fromEntries(
        Object.entries(input as Record<string, unknown>)
          .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
          .map(([key, inner]) => [key, sorted(inner)]),
      )
    }
    return input ?? null
  }
  return JSON.stringify(sorted(value))
}

const same = (a: unknown, b: unknown) => canonical(a) === canonical(b)

type HeatEvents = NonNullable<CareHabitsV1["heatEvents"]>

/** The heat events after the step. The one conversion fans the row's single level and single
 * protection flag out over every selected source; that is only applied where this step actually
 * changed the level / the flag, or where a source has no answer yet. A source that stays selected
 * keeps what she answered per source (the Feinschliff asks per source), and a source that is no
 * longer selected drops out. */
function heatEventsAfter(input: {
  converted: HeatEvents
  reference: CareHabitsV1
  refColumns: CareHabitsDerivedColumns
  values: OnboardingCareValues
}): HeatEvents {
  const { converted, reference, refColumns, values } = input
  const levelNamed = values.heat_styling !== undefined
  const levelChanged = levelNamed && values.heat_styling !== refColumns.heat_styling
  const protectionNamed = values.uses_heat_protection !== undefined
  const protectionChanged =
    protectionNamed && (values.uses_heat_protection ?? false) !== refColumns.uses_heat_protection

  const events: Record<string, HeatEvents[keyof HeatEvents]> = {}
  for (const [id, event] of Object.entries(converted) as Array<
    [keyof HeatEvents, NonNullable<HeatEvents[keyof HeatEvents]>]
  >) {
    const before = reference.heatEvents?.[id]
    const frequency = levelChanged || !before ? event.frequency : before.frequency
    const protection =
      protectionNamed && (protectionChanged || before?.protectionConsistency === undefined)
        ? event.protectionConsistency
        : before?.protectionConsistency
    events[id] = { frequency, ...(protection ? { protectionConsistency: protection } : {}) }
  }
  return events as HeatEvents
}

type DryingRoutes = NonNullable<CareHabitsV1["dryingRoutes"]>

/** Routes the legacy tool list expresses (`blow_dryer`, `diffuser`); every other route (`air_dry`)
 * only the drying step can name. */
const TOOL_ROUTES = new Set<string>(["ordinary_blow_dry", "diffuser_or_airflow_shaping"])

/** I4: the routes after the step. The legacy model has ONE drying method, so the conversion
 * rebuilds the routes from it and the tools; that replaces the stored routes only when the step
 * names a different drying method. Otherwise the stored routes the tool list cannot express stay,
 * in their stored order, beside the ones the (possibly edited) tool list and method give. */
function dryingRoutesAfter(input: {
  converted: CareHabitsV1["dryingRoutes"]
  reference: CareHabitsV1
  refColumns: CareHabitsDerivedColumns
  values: OnboardingCareValues
}): CareHabitsV1["dryingRoutes"] {
  const { converted, reference, refColumns, values } = input
  const methodReplaced =
    values.drying_method !== undefined && values.drying_method !== refColumns.drying_method
  if (methodReplaced || !reference.dryingRoutes) return converted
  const next = converted ?? []
  const routes: DryingRoutes = reference.dryingRoutes.filter(
    (route) => !TOOL_ROUTES.has(route) || next.includes(route),
  )
  for (const route of next) if (!routes.includes(route)) routes.push(route)
  return routes
}

const sourcesKey = (careHabits: Pick<CareHabitsV1, "dryingRoutes" | "additionalHeatTools">) =>
  getSelectedStage2HeatEventSources({
    ...(careHabits.dryingRoutes ? { dryingRoutes: [...careHabits.dryingRoutes] } : {}),
    ...(careHabits.additionalHeatTools
      ? { additionalHeatTools: [...careHabits.additionalHeatTools] }
      : {}),
  }).join(",")

export function buildOnboardingCareFacts(input: {
  values: OnboardingCareValues
  /** The care_habits document and provenance the row holds; `null` = no row. */
  stored: OnboardingCareStoredFacts | null
  /** The `hair_profiles` row as read (`to_jsonb`), for its legacy columns when it has no
   * document. */
  row: Record<string, unknown> | null
  now: string
}): OnboardingCareFactsWrite {
  const { values } = input
  const storedDocument = input.stored?.careHabits ?? null
  const base = storedDocument || !input.row ? null : careHabitsFromRow(input.row)
  const reference: CareHabitsV1 = storedDocument ?? base ?? {}
  const refColumns = deriveCareHabitsColumns(reference)

  // What the legacy model would hold after this step: the row as it is, the named values over it.
  const effective: LegacyCareHabitColumns = {
    towel_material: refColumns.towel_material,
    towel_technique: refColumns.towel_technique,
    drying_method: refColumns.drying_method,
    styling_tools: refColumns.styling_tools,
    heat_styling: refColumns.heat_styling,
    uses_heat_protection: refColumns.uses_heat_protection,
    night_protection: refColumns.night_protection,
  }
  if (values.styling_tools !== undefined) effective.styling_tools = values.styling_tools
  if (values.heat_styling !== undefined) effective.heat_styling = values.heat_styling
  if (values.uses_heat_protection !== undefined) {
    effective.uses_heat_protection = values.uses_heat_protection
  }
  if (values.towel_material !== undefined) effective.towel_material = values.towel_material
  if (values.towel_technique !== undefined) effective.towel_technique = values.towel_technique
  if (values.drying_method !== undefined) effective.drying_method = values.drying_method
  if (values.night_protection !== undefined) effective.night_protection = values.night_protection
  // Decision 1 („Nie“ with tools = no tools) is about a „Nie“ she gives. A derived `never` only
  // says no source was selected before — it is no answer about tools she picks now; the frequency
  // step asks for their level.
  if (
    values.heat_styling === undefined &&
    effective.heat_styling === "never" &&
    (effective.styling_tools?.length ?? 0) > 0
  ) {
    effective.heat_styling = null
  }
  const converted = legacyColumnsToCareHabits(effective)

  // The document fields this step owns, with the value they should hold (null = clear).
  const desired: Record<string, unknown> = {}
  if (values.towel_material !== undefined || values.towel_technique !== undefined) {
    desired.towel = converted.towel ?? null
  }
  if (values.night_protection !== undefined)
    desired.nightProtection = converted.nightProtection ?? null
  if (values.brush_type !== undefined) desired.brushesCombs = values.brush_type
  if (
    values.styling_tools !== undefined ||
    values.heat_styling !== undefined ||
    values.uses_heat_protection !== undefined ||
    values.drying_method !== undefined
  ) {
    const dryingRoutes = dryingRoutesAfter({
      converted: converted.dryingRoutes,
      reference,
      refColumns,
      values,
    })
    desired.dryingRoutes = dryingRoutes ?? null
    desired.additionalHeatTools = converted.additionalHeatTools ?? null
    if (converted.heatEvents !== undefined) {
      desired.heatEvents = heatEventsAfter({
        converted: converted.heatEvents,
        reference,
        refColumns,
        values,
      })
    }

    // Decision 2 on the fly: with only dryer/diffuser sources the protection answer lives in
    // `currentProductCategories` (the existing slot). Touched only when she answers protection
    // here or her heat sources change — never on a re-save of an unrelated heat step.
    const after = {
      ...(dryingRoutes ? { dryingRoutes } : {}),
      ...(converted.additionalHeatTools
        ? { additionalHeatTools: converted.additionalHeatTools }
        : {}),
    }
    const sourcesChanged = sourcesKey(after) !== sourcesKey(reference)
    if (
      (values.uses_heat_protection !== undefined || sourcesChanged) &&
      selectsOnlyDryerSources(after)
    ) {
      const owned = reference.currentProductCategories ?? []
      if (effective.uses_heat_protection === true && !owned.includes("heat_protectant")) {
        desired.currentProductCategories = [...owned, "heat_protectant"]
      } else if (values.uses_heat_protection === false && owned.includes("heat_protectant")) {
        const rest = owned.filter((category) => category !== "heat_protectant")
        // Only the heat protectant was known: „Nein“ leaves the list unanswered, it does not
        // claim she uses none of the products.
        desired.currentProductCategories = rest.length > 0 ? rest : null
      }
    }
  }

  const changes: Record<string, unknown> = {}
  for (const [field, value] of Object.entries(desired)) {
    // No heat events and an empty set of them are the same thing (never a written "never").
    const before =
      field === "heatEvents"
        ? (reference.heatEvents ?? {})
        : (reference as Record<string, unknown>)[field]
    if (!same(before, value)) changes[field] = value
  }

  if (Object.keys(changes).length === 0) {
    return {
      patch: {},
      provenance: {
        source: { kind: "onboarding" },
        schemaVersion: CARE_HABITS_SCHEMA_VERSION,
        at: input.now,
      },
      columns: refColumns,
      unchanged: true,
    }
  }

  const fields: Record<string, FieldProvenanceValue> = {}
  const patch: Record<string, unknown> = {}
  if (base) {
    // No document yet: the whole converted base goes in, marked like the backfill marks it.
    for (const [field, value] of Object.entries(base)) {
      patch[field] = value
      fields[field] = "unknown_historical"
    }
  }
  for (const [field, value] of Object.entries(changes)) {
    if (value === null) {
      if (base) delete patch[field]
      else patch[field] = null
      delete fields[field]
      continue
    }
    patch[field] = value
    fields[field] = "user"
  }

  const validPatch = careHabitsPatchSchema.parse(patch)
  return {
    patch: validPatch,
    provenance: {
      source: { kind: "onboarding" },
      schemaVersion: CARE_HABITS_SCHEMA_VERSION,
      at: input.now,
      ...(Object.keys(fields).length > 0 ? { fields } : {}),
    },
    columns: deriveCareHabitsColumns(mergeCareHabitsPatch(storedDocument, validPatch)),
  }
}
