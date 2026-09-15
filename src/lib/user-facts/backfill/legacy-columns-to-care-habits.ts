import {
  createStage2HeatEventId,
  getSelectedStage2HeatEventSources,
  requiresStage2HeatProtection,
} from "@/lib/personal-plan/refinement/heat-events"
import type {
  AdditionalHeatTool,
  DryingRoute,
  HeatEventAnswer,
} from "@/lib/personal-plan/refinement/types"
import type { HeatStyling } from "@/lib/vocabulary/frequencies"
import type { DryingMethod } from "@/lib/vocabulary/onboarding-care"
import {
  TOWEL_MATERIALS,
  normalizeNightProtectionValues,
  normalizeTowelTechniqueValue,
  type TowelMaterial,
} from "@/lib/vocabulary/onboarding-care"
import type { StylingTool } from "@/lib/vocabulary/profile-labels"

import {
  DRYING_METHOD_TO_DRYING_ROUTE,
  HEAT_STYLING_TO_PRODUCT_FREQUENCY,
  STYLING_TOOL_TO_HEAT_INPUT,
} from "../legacy-vocabulary"
import { careHabitsV1Schema, type CareHabitsV1 } from "../schema"

/**
 * Backfill-only import of the narrow legacy `hair_profiles` care columns into a PARTIAL
 * `CareHabitsV1` document. Used ONLY for users with no refined need version at all — while
 * any refined version exists, `resolve-stage2-head.ts` decodes the immutable Stage-2 head
 * instead and these columns are never consulted for habits (plan §4a F24/F25).
 *
 * Deliberately lossy, and never inventing: the legacy model carries ONE `heat_styling` level
 * and ONE `uses_heat_protection` flag for the whole row, so those two are fanned out
 * identically over every heat source the row selects; a null column omits its field.
 * `brushesCombs` is NOT produced here — `brush_type` is lifted for every user (refined or
 * not) by `plan-row.ts`, because no Stage-2 version ever carried a brush answer.
 *
 * Pure: no I/O, no `server-only`.
 */

export type LegacyCareHabitColumns = {
  towel_material: string | null
  towel_technique: string | null
  drying_method: string | null
  styling_tools: string[] | null
  heat_styling: string | null
  uses_heat_protection: boolean | null
  night_protection: string[] | null
}

const TOWEL_MATERIAL_VALUES = new Set<string>(TOWEL_MATERIALS)

function translateTowel(columns: LegacyCareHabitColumns): CareHabitsV1["towel"] | undefined {
  const material = columns.towel_material
  if (material === null || !TOWEL_MATERIAL_VALUES.has(material)) return undefined
  // `no_towel` has no technique to record (the same rule `legacy-prefill.ts` applies).
  if (material === "no_towel") return { material: material as TowelMaterial }
  const technique = normalizeTowelTechniqueValue(columns.towel_technique)
  return technique
    ? { material: material as TowelMaterial, technique }
    : { material: material as TowelMaterial }
}

type HeatInputs = {
  dryingRoutes: DryingRoute[] | undefined
  additionalHeatTools: AdditionalHeatTool[] | undefined
}

/**
 * `drying_method` and `styling_tools` BOTH feed `dryingRoutes` (the legacy `diffuser` tool is
 * a drying route natively, not an additional tool), so the two are unioned. A route or tool
 * list is only emitted when at least one of the two columns actually carries a value: a null
 * pair means "never asked", while `styling_tools = []` is a real "no tools" answer and is
 * preserved as an empty list.
 */
function translateHeatInputs(columns: LegacyCareHabitColumns): HeatInputs {
  if (columns.drying_method === null && columns.styling_tools === null) {
    return { dryingRoutes: undefined, additionalHeatTools: undefined }
  }

  const routes: DryingRoute[] = []
  const tools: AdditionalHeatTool[] = []
  const addRoute = (route: DryingRoute) => {
    if (!routes.includes(route)) routes.push(route)
  }

  const methodRoute = columns.drying_method
    ? DRYING_METHOD_TO_DRYING_ROUTE[columns.drying_method as DryingMethod]
    : undefined
  if (methodRoute) addRoute(methodRoute)

  for (const tool of columns.styling_tools ?? []) {
    const heatInput = STYLING_TOOL_TO_HEAT_INPUT[tool as StylingTool]
    if (!heatInput) continue
    if ("dryingRoute" in heatInput) addRoute(heatInput.dryingRoute)
    else if (!tools.includes(heatInput.tool)) tools.push(heatInput.tool)
  }

  return {
    dryingRoutes: routes,
    additionalHeatTools: columns.styling_tools === null ? undefined : tools,
  }
}

function translateHeatEvents(
  columns: LegacyCareHabitColumns,
  heatInputs: HeatInputs,
): CareHabitsV1["heatEvents"] | undefined {
  if (columns.heat_styling === null) return undefined
  if (!(columns.heat_styling in HEAT_STYLING_TO_PRODUCT_FREQUENCY)) return undefined

  const frequency = HEAT_STYLING_TO_PRODUCT_FREQUENCY[columns.heat_styling as HeatStyling]
  // `never` is a real answer meaning "no heat events at all", not a missing one.
  if (frequency === null) return {}

  const events: Record<string, HeatEventAnswer> = {}
  for (const source of getSelectedStage2HeatEventSources({
    ...(heatInputs.dryingRoutes ? { dryingRoutes: heatInputs.dryingRoutes } : {}),
    ...(heatInputs.additionalHeatTools
      ? { additionalHeatTools: heatInputs.additionalHeatTools }
      : {}),
  })) {
    // Only the sources whose route actually asks about heat protection get the flag; the
    // single legacy `uses_heat_protection` boolean is the only evidence there is, and a null
    // one (legacy rows written before the column existed) stays unanswered rather than
    // becoming a guessed "no".
    const protectionConsistency =
      requiresStage2HeatProtection(source) && columns.uses_heat_protection !== null
        ? columns.uses_heat_protection
          ? ("always" as const)
          : ("no" as const)
        : undefined
    events[createStage2HeatEventId(source)] = {
      frequency,
      ...(protectionConsistency ? { protectionConsistency } : {}),
    }
  }
  return events as CareHabitsV1["heatEvents"]
}

export function legacyColumnsToCareHabits(columns: LegacyCareHabitColumns): CareHabitsV1 {
  const heatInputs = translateHeatInputs(columns)
  const towel = translateTowel(columns)
  const heatEvents = translateHeatEvents(columns, heatInputs)
  const nightProtection = normalizeNightProtectionValues(columns.night_protection)

  return careHabitsV1Schema.parse({
    ...(towel ? { towel } : {}),
    ...(heatInputs.dryingRoutes ? { dryingRoutes: heatInputs.dryingRoutes } : {}),
    ...(heatInputs.additionalHeatTools
      ? { additionalHeatTools: heatInputs.additionalHeatTools }
      : {}),
    ...(heatEvents ? { heatEvents } : {}),
    ...(nightProtection ? { nightProtection } : {}),
  })
}
