import type {
  NightProtection,
  TowelMaterial,
  TowelTechnique,
} from "@/lib/vocabulary/onboarding-care"

import type {
  AdditionalHeatTool,
  DryingRoute,
  HeatProtectionConsistency,
  PersonalPlanRefinementAnswersV1,
  Stage2HeatEventQuestionId,
  Stage2HeatEventRoute,
  Stage2HeatEventSource,
  Stage2HeatEventTool,
} from "../refinement/types"
import {
  createStage2HeatEventId,
  getSelectedStage2HeatEventSources,
  getStage2HeatEventDefinition,
  requiresStage2HeatProtection,
} from "../refinement/heat-events"
import { HEAT_PROTECTION_CONSISTENCIES } from "../refinement/types"

import {
  isToolAnswerOnlyForm,
  TOOL_ANSWER_ONLY_FORMS_BY_FAMILY,
  TOOL_FAMILIES,
  TOOL_PRODUCT_TYPES_BY_FAMILY,
  toolProductTypesOf,
  type ToolFamily,
  type ToolProductType,
  type ToolReportedForm,
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
   * The Stage-2 heat events the user's own answers selected (`D9a`).
   *
   * `null` means the refinement was never answered. Each entry is decoded per
   * `R1`: `protectionConsistency` is carried only by the sources that may still
   * be asked for it, so a value stored under the old contract for
   * `diffuser_airflow_shaping` arrives as `null` and nothing can derive from it.
   */
  heatEvents: ToolHeatEventFact[] | null
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
  heatEvents: null,
  provenance: "reported",
}

/**
 * Broad reported ownership per family.
 *
 * - key absent or `null` → `unknown` (skipped, migrated, or never submitted);
 * - `[]` → the user explicitly reported none in that family;
 * - non-empty → one or more recognizable forms are reported.
 *
 * Values are `ToolReportedForm`, so a family may carry an answer-only token
 * („Nur Finger", `D9b`) beside its real forms. Route logic reads
 * `reportedFormsFor`, which strips those tokens: they are answers, never
 * products.
 */
export type ToolInventory = Partial<Record<ToolFamily, ToolReportedForm[] | null>>

/**
 * What the plan itself projects from care behaviours. Never contains an
 * answer-only token: a behaviour can imply a device, never an answer.
 */
export type ToolDerivedInventory = Partial<Record<ToolFamily, ToolProductType[]>>

/** The raw answer, answer-only tokens included. `null` means unanswered. */
export function inventoryFor(
  inventory: ToolInventory,
  family: ToolFamily,
): ToolReportedForm[] | null {
  const value = inventory[family]
  return value === undefined ? null : value
}

/**
 * The reported forms the plan may reason about as products (`D9b`).
 *
 * A fingers-only answer therefore reads as `[]` here: the user answered, and
 * what they own is no product. That is exactly the ruled route-level state —
 * `explicit_none` with no forms — while the `fingers` answer itself survives in
 * the inventory for the finger exceptions in `B01`/`B03`/`B04`.
 */
export function reportedFormsFor(
  inventory: ToolInventory,
  family: ToolFamily,
): ToolProductType[] | null {
  const raw = inventoryFor(inventory, family)
  return raw === null ? null : toolProductTypesOf(raw)
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
    heatEvents: projectToolHeatEvents(answers),
  }
}

// --- heat events and heat-protection coverage (`D9a` + `R1`) -----------------

export type ToolHeatEventFact = {
  id: Stage2HeatEventQuestionId
  source: Stage2HeatEventSource
  tool: Stage2HeatEventTool
  route: Stage2HeatEventRoute
  /** `null` whenever the source may not carry the answer (`R1`) or never did. */
  protectionConsistency: HeatProtectionConsistency | null
}

/**
 * `R1` (ruled 2026-08-24): the diffuser source raises no heat-protection
 * question, because `D2a` reads it as diffuser drying and `A11` puts diffuser
 * drying at tier `not_needed`. Per `D8` the change is decoded rather than
 * migrated: a row completed under the old contract stays complete, and the value
 * it stored for that source is ignored on read.
 */
export function readsProtectionConsistency(source: Stage2HeatEventSource): boolean {
  if (source === "diffuser_airflow_shaping") return false
  return requiresStage2HeatProtection(source)
}

/** Lenient projection: an incomplete event is still a selected event. */
export function projectToolHeatEvents(
  answers: PersonalPlanRefinementAnswersV1,
): ToolHeatEventFact[] | null {
  if (!answers.dryingRoutes && !answers.additionalHeatTools) return null
  return getSelectedStage2HeatEventSources(answers).map((source) => {
    const id = createStage2HeatEventId(source)
    const stored = answers.heatEvents?.[id]?.protectionConsistency
    const usable =
      readsProtectionConsistency(source) &&
      stored !== undefined &&
      HEAT_PROTECTION_CONSISTENCIES.includes(stored)
    return {
      id,
      source,
      ...getStage2HeatEventDefinition(source),
      protectionConsistency: usable ? stored : null,
    }
  })
}

/** `A11` tier per heat event, reconciled with `D2a`: diffuser drying is a diffuser. */
export type ToolHeatProtectionTier = "not_needed" | "optional" | "basis"

export type ToolHeatProtectionEvent = {
  eventId: Stage2HeatEventQuestionId
  source: Stage2HeatEventSource
  tier: ToolHeatProtectionTier
  /** Only `always` counts (`D9a`). A `not_needed` tier has nothing to cover. */
  covered: boolean
  /** `sometimes`: „mach's konsequent" at tier „empfohlen", never an accusation. */
  consistencyNudge: boolean
  protectionConsistency: HeatProtectionConsistency | null
}

export function toolHeatProtectionTier(source: Stage2HeatEventSource): ToolHeatProtectionTier {
  // `D2a`: `diffuser_airflow_shaping` is diffuser drying, so it takes the
  // diffuser tier and not the generic `airflow_shaping` one.
  if (source === "diffuser_airflow_shaping") return "not_needed"
  switch (getStage2HeatEventDefinition(source).route) {
    case "ordinary_airflow":
      return "not_needed"
    case "airflow_shaping":
      return "optional"
    case "direct_contact_heat":
      return "basis"
  }
}

/**
 * Heat-protection coverage, judged per heat event (`D9a`, reverses `H15`).
 *
 * The legacy `uses_heat_protection` boolean stays unread. Only `always` counts
 * as covered; `sometimes` is a consistency nudge at „empfohlen"; `no`/`unsure`
 * leave the dependency uncovered. Copy stays at „empfohlen/sinnvoll" and never
 * becomes „nötig, sonst Schaden" — the measured benefit exists only at flat-iron
 * temperatures.
 */
export function toolHeatProtectionEvents(care: ToolCareFacts): ToolHeatProtectionEvent[] {
  if (!care.heatEvents) return []
  return care.heatEvents.map((event) => {
    const tier = toolHeatProtectionTier(event.source)
    if (tier === "not_needed") {
      return {
        eventId: event.id,
        source: event.source,
        tier,
        covered: true,
        consistencyNudge: false,
        protectionConsistency: null,
      }
    }
    return {
      eventId: event.id,
      source: event.source,
      tier,
      covered: event.protectionConsistency === "always",
      consistencyNudge: event.protectionConsistency === "sometimes",
      protectionConsistency: event.protectionConsistency,
    }
  })
}

/** The portfolio result is the union of the uncovered events (`D9a`). */
export function uncoveredToolHeatProtectionEvents(care: ToolCareFacts): ToolHeatProtectionEvent[] {
  return toolHeatProtectionEvents(care).filter((event) => !event.covered)
}

/**
 * Existing canonical answers preselect the visual inventory. Drying routes, heat
 * tools, towel material and Night Protection are already known — asking for them
 * again inside the Tool trip would ask the same fact twice.
 */
export function projectToolInventoryFromCareFacts(care: ToolCareFacts): ToolDerivedInventory {
  const inventory: ToolDerivedInventory = {}
  // Direct acceptance's planning defaults are not the user's answers. Reading
  // them as inventory would fabricate "du besitzt ein Mikrofaser-Handtuch" and
  // three explicit "du besitzt nichts" answers the user never gave. Everything
  // stays `unknown` until they actually resolve it in Feinschliff.
  if (care.provenance === "assumed") return inventory

  // `D2`: `[]` is unanswered, never „ich lufttrockne". `D4`: reporting the
  // behaviour reports the device, but air-drying is not a claim about owning or
  // not owning a dryer — so the air-dry-only branch projects NOTHING and the
  // route's ownership honestly stays `unknown` (fixtures 3, 4).
  if (care.dryingRoutes && care.dryingRoutes.length > 0) {
    const usesAirflow = care.dryingRoutes.some(
      (route) => route === "ordinary_blow_dry" || route === "diffuser_or_airflow_shaping",
    )
    if (usesAirflow) inventory.airflow = ["hair_dryer"]
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
    const forms = mapTowelMaterial(care.towelMaterial)
    // `D4`: „Frottee" is a towel the user OWNS. There is no terry product type,
    // so the honest projection is no entry at all — writing `[]` would store
    // „du besitzt kein Trocknungstextil", a sentence the user never said
    // (fixtures 21, 104, 113). `no_towel` stays a real explicit none.
    if (forms.length > 0) inventory.drying_textiles = forms
    else if (care.towelMaterial === "no_towel") inventory.drying_textiles = []
  }

  if (care.nightProtection) {
    inventory.night_protection = dedupe(care.nightProtection.flatMap(mapNightProtection))
  }

  return inventory
}

function dedupe(values: readonly ToolProductType[]): ToolProductType[] {
  return [...new Set(values)]
}

/**
 * Forms projected as a generic stand-in for a behaviour rather than as a named
 * answer.
 *
 * „Du föhnst" proves a drying device exists; it does not name one. So when the
 * user's own airflow answer names a form, that form IS the device they dry with
 * and the stand-in must not be unioned in beside it — otherwise one physical
 * Air Multi-Styler becomes „ein Föhn und ein Air Multi-Styler" and leads the
 * card with a Föhn the user never mentioned (fixtures 22, 38).
 *
 * A NAMED derivation is different and does survive: `additionalHeatTools`,
 * `nightProtection` and `towel.material` each name a concrete form, so a Tool
 * page answer adds to them rather than replacing them (fixture 124).
 */
const BEHAVIOUR_STAND_IN_FORMS: Partial<Record<ToolFamily, readonly ToolProductType[]>> = {
  airflow: ["hair_dryer"],
}

/**
 * Merge per form, never replace per family (`D3c`, ruled 2026-08-24).
 *
 * An answered Tool page **adds and confirms** forms; the care-derived evidence
 * survives it. The old `{...derived, ...reported}` spread replaced the whole
 * family, so a user who reported a Glätteisen in Feinschliff and then ticked
 * „Lockenstab" on the Tool page silently lost the Glätteisen (fixture 124).
 *
 * The one thing that does replace: an explicit `[]`. „Nichts davon" is a real
 * answer about the whole family and must win over a projection.
 */
export function mergeToolInventories(
  derived: ToolDerivedInventory,
  reported: ToolInventory,
): ToolInventory {
  const merged: ToolInventory = { ...derived }
  for (const family of TOOL_FAMILIES) {
    const answer = reported[family]
    if (answer === undefined) continue
    if (answer === null || answer.length === 0) {
      merged[family] = answer
      continue
    }
    const standIns = BEHAVIOUR_STAND_IN_FORMS[family] ?? []
    const derivedForms = (derived[family] ?? []).filter((form) => !standIns.includes(form))
    merged[family] = [...new Set<ToolReportedForm>([...answer, ...derivedForms])]
  }
  return merged
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

/** A real form for this family, or one of its answer-only tokens (`D9b`). */
export function isKnownToolReportedForm(
  family: ToolFamily,
  value: string,
): value is ToolReportedForm {
  if (isKnownToolProductType(family, value)) return true
  const tokens = TOOL_ANSWER_ONLY_FORMS_BY_FAMILY[family]
  return Boolean(tokens && isToolAnswerOnlyForm(value) && tokens.includes(value))
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
      (item): item is ToolReportedForm =>
        typeof item === "string" && isKnownToolReportedForm(family, item),
    )
  }
  return inventory
}
