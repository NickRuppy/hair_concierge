import type {
  NightProtection,
  TowelMaterial,
  TowelTechnique,
} from "@/lib/vocabulary/onboarding-care"

import type {
  AdditionalHeatTool,
  DryingRoute,
  PersonalPlanRefinementAnswersV1,
} from "../refinement/types"

import {
  TOOL_FAMILIES,
  TOOL_PRODUCT_TYPES_BY_FAMILY,
  type ToolFamily,
  type ToolProductType,
} from "./contracts"

/**
 * Care facts the Tool engine may read. Every field is tri-state: `null` means the
 * user has not answered yet and must never be normalized to "no". These are
 * projected losslessly from the canonical Stage-2 answers — Tools never asks a
 * fact the refinement already owns.
 */
export type ToolCareFacts = {
  dryingRoutes: DryingRoute[] | null
  additionalHeatTools: AdditionalHeatTool[] | null
  towelMaterial: TowelMaterial | null
  towelTechnique: TowelTechnique | null
  nightProtection: NightProtection[] | null
  /**
   * Where these answers came from.
   *
   * `reported` — the user answered them in Feinschliff. They are evidence of
   * what the user owns.
   *
   * `assumed` — direct acceptance supplied them as disclosed planning defaults
   * ("Lufttrocknen, kein Föhnen", "Mikrofaser-Handtuch", …). The user saw and
   * accepted those defaults, so they may shape WHICH routes the plan contains —
   * but they are NOT evidence of ownership and must never produce
   * `owned_generic` or `explicit_none`.
   */
  provenance: ToolCareProvenance
}

export type ToolCareProvenance = "reported" | "assumed"

export const EMPTY_TOOL_CARE_FACTS: ToolCareFacts = {
  dryingRoutes: null,
  additionalHeatTools: null,
  towelMaterial: null,
  towelTechnique: null,
  nightProtection: null,
  provenance: "reported",
}

/**
 * Broad reported ownership per family.
 *
 * - key absent or `null` → `unknown` (skipped, migrated, or never submitted);
 * - `[]` → the user explicitly reported none in that family;
 * - non-empty → one or more recognizable forms are reported.
 */
export type ToolInventory = Partial<Record<ToolFamily, ToolProductType[] | null>>

export function inventoryFor(
  inventory: ToolInventory,
  family: ToolFamily,
): ToolProductType[] | null {
  const value = inventory[family]
  return value === undefined ? null : value
}

/** `null` stays unknown; only a submitted answer becomes explicit none. */
export function projectToolCareFacts(
  answers: PersonalPlanRefinementAnswersV1 | undefined,
  provenance: ToolCareProvenance = "reported",
): ToolCareFacts {
  if (!answers) return { ...EMPTY_TOOL_CARE_FACTS, provenance }
  return {
    provenance,
    dryingRoutes: answers.dryingRoutes ? [...answers.dryingRoutes] : null,
    additionalHeatTools: answers.additionalHeatTools ? [...answers.additionalHeatTools] : null,
    towelMaterial: answers.towel?.material ?? null,
    towelTechnique: answers.towel?.technique ?? null,
    nightProtection: answers.nightProtection ? [...answers.nightProtection] : null,
  }
}

/**
 * Existing canonical answers preselect the visual inventory. Drying routes, heat
 * tools, towel material and Night Protection are already known — asking for them
 * again inside the Tool trip would ask the same fact twice.
 */
export function projectToolInventoryFromCareFacts(care: ToolCareFacts): ToolInventory {
  const inventory: ToolInventory = {}
  // Direct acceptance's planning defaults are not the user's answers. Reading
  // them as inventory would fabricate "du besitzt ein Mikrofaser-Handtuch" and
  // three explicit "du besitzt nichts" answers the user never gave. Everything
  // stays `unknown` until they actually resolve it in Feinschliff.
  if (care.provenance === "assumed") return inventory

  if (care.dryingRoutes) {
    const usesAirflow = care.dryingRoutes.some(
      (route) => route === "ordinary_blow_dry" || route === "diffuser_or_airflow_shaping",
    )
    inventory.airflow = usesAirflow ? ["hair_dryer"] : []
  }

  if (care.additionalHeatTools) {
    inventory.heated_styling = care.additionalHeatTools.flatMap(mapAdditionalHeatTool)
    // A hot-air brush or multi-styler is airflow, not direct-contact heat.
    const airflowForms = care.additionalHeatTools.flatMap(mapAdditionalHeatToolAirflow)
    if (airflowForms.length > 0) {
      inventory.airflow = dedupe([...(inventory.airflow ?? []), ...airflowForms])
    }
  }

  if (care.towelMaterial) {
    inventory.drying_textiles = mapTowelMaterial(care.towelMaterial)
  }

  if (care.nightProtection) {
    inventory.night_protection = dedupe(care.nightProtection.flatMap(mapNightProtection))
  }

  return inventory
}

function dedupe(values: readonly ToolProductType[]): ToolProductType[] {
  return [...new Set(values)]
}

function mapAdditionalHeatTool(tool: AdditionalHeatTool): ToolProductType[] {
  switch (tool) {
    case "straightener":
      return ["flat_iron"]
    case "curling_or_wave_iron":
      return ["curling_iron"]
    case "thermal_rollers":
      return ["heated_rollers"]
    case "dryer_brush":
    case "hot_air_styler":
      return []
  }
}

function mapAdditionalHeatToolAirflow(tool: AdditionalHeatTool): ToolProductType[] {
  switch (tool) {
    case "dryer_brush":
      return ["hot_air_brush"]
    case "hot_air_styler":
      return ["air_multi_styler"]
    default:
      return []
  }
}

function mapTowelMaterial(material: TowelMaterial): ToolProductType[] {
  switch (material) {
    case "mikrofaser":
      return ["microfiber_towel"]
    case "turban_mikrofaser":
      return ["drying_wrap"]
    case "tshirt":
      return ["smooth_cotton_cloth"]
    case "frottee":
    case "no_towel":
      // Terry towelling is not one of the eight recognizable Tool forms, and
      // "no towel" is an explicit none. Neither reports a suitable textile.
      return []
  }
}

function mapNightProtection(protection: NightProtection): ToolProductType[] {
  switch (protection) {
    case "silk_satin_pillow":
      return ["pillowcase"]
    case "silk_satin_bonnet":
      return ["bonnet"]
    case "length_tip_accessory":
      return ["length_tip_sleeve"]
    case "loose_tied":
    case "pineapple":
      // Application routes, not product types. A soft tie may support them.
      return ["soft_night_tie"]
  }
}

export function isKnownToolProductType(
  family: ToolFamily,
  value: string,
): value is ToolProductType {
  return (TOOL_PRODUCT_TYPES_BY_FAMILY[family] as readonly string[]).includes(value)
}

export function normalizeToolInventory(raw: unknown): ToolInventory {
  if (!raw || typeof raw !== "object") return {}
  const source = raw as Record<string, unknown>
  const inventory: ToolInventory = {}
  for (const family of TOOL_FAMILIES) {
    const value = source[family]
    if (value === undefined || value === null) continue
    if (!Array.isArray(value)) continue
    inventory[family] = value.filter(
      (item): item is ToolProductType =>
        typeof item === "string" && isKnownToolProductType(family, item),
    )
  }
  return inventory
}
