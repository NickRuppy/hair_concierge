import {
  BRUSH_TYPES,
  NIGHT_PROTECTIONS,
  type BrushType,
  type NightProtection,
  type TowelMaterial,
  type TowelTechnique,
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
  Stage2AnswerProvenance,
  Stage2QuestionId,
  NightWear,
} from "../refinement/types"
import {
  createStage2HeatEventId,
  getSelectedStage2HeatEventSources,
  getStage2HeatEventDefinition,
  requiresStage2HeatProtection,
} from "../refinement/heat-events"
import {
  ADDITIONAL_HEAT_TOOLS,
  DRYING_ROUTES,
  HEAT_PROTECTION_CONSISTENCIES,
} from "../refinement/types"
import type { CareHabitsV1, FieldProvenanceValue } from "@/lib/user-facts/schema"

import {
  isToolAnswerOnlyForm,
  sortToolReportedForms,
  TOOL_ANSWER_ONLY_FORMS_BY_FAMILY,
  TOOL_FAMILIES,
  TOOL_PRODUCT_TYPES_BY_FAMILY,
  TOOL_REPORTED_FORMS_BY_FAMILY,
  toolProductTypesOf,
  type ToolFamily,
  type ToolOwnershipProvenance,
  type ToolProductType,
  type ToolReportedForm,
} from "./contracts"
import {
  TOOL_FORM_PAGES,
  TOOL_OVERVIEW_FAMILY_ORDER,
  toolFormCareKey,
  toolFormPage,
  toolFormPagesOfFamily,
  type ToolFormPageKey,
} from "./labels"

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
  /**
   * Per-field refinement of a `reported` slice (read-time view, port fix round 1): the care
   * facts listed here were supplied as assumptions, so — exactly like an `assumed` slice, but
   * for that field only — they still shape the routes yet never project ownership or explicit
   * absence. Absent or empty: every field follows `provenance`.
   */
  assumedFields?: readonly ToolCareFactField[]
  /**
   * The legacy brush answer (`care_habits.brushesCombs`, onboarding `brush_type`), read only by
   * the read-time view (port fix round 2). Projected as DERIVED brush forms — like a Föhn from
   * the drying route — never as reported ownership, which stays with the brush pages (D5/H2).
   * Absent or `null`: unknown.
   */
  brushesCombs?: readonly BrushType[] | null
}

export type ToolCareProvenance = "reported" | "assumed"

/** The care facts that project Tool ownership (`careInventoryEntries`). */
export type ToolCareFactField =
  | "dryingRoutes"
  | "additionalHeatTools"
  | "towelMaterial"
  | "nightProtection"
  | "brushesCombs"

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
 * `explicit_none` with no forms.
 *
 * The raw `fingers` token still survives in the inventory and is readable
 * through `inventoryFor`, but no rule reads it today: `B01`/`B03`'s finger
 * exception is carried entirely by the length gate, and the stripping performed
 * here is what fixtures 10, 11 and 56 actually guard.
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
  for (const [family, entry] of careInventoryEntries(care)) {
    inventory[family] = entry.forms
  }
  return inventory
}

/**
 * The Feinschliff pre-fill (UI starting value and the assumption rules): the engine projection
 * plus the answer-only cards a care answer names — a stored `towel.material = frottee` ticks
 * „Frottee-Handtuch", a stored „Mit Diffusor" drying route ticks „Diffusor-Aufsatz". The engine
 * projection itself (`projectToolInventoryFromCareFacts`) stays token-free, so route ownership
 * is unchanged (fixture 21, `D4`). Direct acceptance's assumed defaults pre-fill nothing.
 */
export function projectToolPrefillFromCareFacts(
  care: ToolCareFacts,
): Partial<Record<ToolFamily, ToolReportedForm[]>> {
  if (care.provenance === "assumed") return {}
  const prefill: Partial<Record<ToolFamily, ToolReportedForm[]>> = {
    ...projectToolInventoryFromCareFacts(care),
  }
  const add = (family: ToolFamily, form: ToolReportedForm) => {
    prefill[family] = sortToolReportedForms(family, [...(prefill[family] ?? []), form])
  }
  const assumed = new Set(care.assumedFields ?? [])
  if (care.towelMaterial === "frottee" && !assumed.has("towelMaterial")) {
    add("drying_textiles", "frottee")
  }
  if (care.dryingRoutes?.includes("diffuser_or_airflow_shaping") && !assumed.has("dryingRoutes")) {
    add("airflow", "diffuser")
  }
  return prefill
}

/**
 * Where each projected family's evidence came from (`D4`, clarified 2026-08-25).
 *
 * Provenance follows **what the answer is**, not which store it arrived through.
 * A care answer that NAMES a concrete thing — `additionalHeatTools`,
 * `nightProtection`, `towel.material`, and every „Nichts davon"-class answer to
 * one of them — is a `reported` fact: „Ich schlafe auf einem Satin-Bonnet" is a
 * report wherever it was asked. Only a **behaviour projection** that infers an
 * unnamed device is `derived`: today only `dryingRoutes → hair_dryer` („du föhnst"
 * proves a dryer exists but names none). The `loose_tied` / `pineapple` night
 * TECHNIQUES project nothing since Rev. 6 (they have their own night question).
 *
 * Both facts are read off the same projection pass, so the two can never drift.
 */
export function projectToolCareProvenance(care: ToolCareFacts): ToolCareProvenanceByFamily {
  const provenance: ToolCareProvenanceByFamily = {}
  for (const [family, entry] of careInventoryEntries(care)) {
    provenance[family] = entry.provenance
  }
  return provenance
}

export type ToolCareProvenanceByFamily = Partial<Record<ToolFamily, ToolOwnershipProvenance>>

type CareInventoryEntry = { forms: ToolProductType[]; provenance: ToolOwnershipProvenance }

/**
 * Existing canonical answers preselect the visual inventory, each entry carrying
 * the provenance of the answer it came from.
 */
function careInventoryEntries(care: ToolCareFacts): [ToolFamily, CareInventoryEntry][] {
  const entries = new Map<ToolFamily, CareInventoryEntry>()
  // Direct acceptance's planning defaults are not the user's answers. Reading
  // them as inventory would fabricate "du besitzt ein Mikrofaser-Handtuch" and
  // three explicit "du besitzt nichts" answers the user never gave. Everything
  // stays `unknown` until they actually resolve it in Feinschliff.
  if (care.provenance === "assumed") return []
  // The same rule per field: an assumed fact inside a reported slice projects nothing.
  const assumed = new Set(care.assumedFields ?? [])
  const dryingRoutes = assumed.has("dryingRoutes") ? null : care.dryingRoutes
  const additionalHeatTools = assumed.has("additionalHeatTools") ? null : care.additionalHeatTools
  const towelMaterial = assumed.has("towelMaterial") ? null : care.towelMaterial
  const nightProtection = assumed.has("nightProtection") ? null : care.nightProtection
  const brushesCombs = assumed.has("brushesCombs") ? null : (care.brushesCombs ?? null)

  // `D2`: `[]` is unanswered, never „ich lufttrockne". `D4`: reporting the
  // behaviour reports the device, but air-drying is not a claim about owning or
  // not owning a dryer — so the air-dry-only branch projects NOTHING and the
  // route's ownership honestly stays `unknown` (fixtures 3, 4).
  if (dryingRoutes && dryingRoutes.length > 0) {
    const usesAirflow = dryingRoutes.some(
      (route) => route === "ordinary_blow_dry" || route === "diffuser_or_airflow_shaping",
    )
    // The one true behaviour projection: a device is inferred, never named.
    if (usesAirflow) entries.set("airflow", { forms: ["hair_dryer"], provenance: "derived" })
  }

  if (additionalHeatTools) {
    entries.set("heated_styling", {
      forms: additionalHeatTools.flatMap(mapAdditionalHeatTool),
      provenance: "reported",
    })
    // A hot-air brush or multi-styler is airflow, not direct-contact heat.
    const airflowForms = additionalHeatTools.flatMap(mapAdditionalHeatToolAirflow)
    if (airflowForms.length > 0) {
      // A named form outranks the behaviour stand-in: provenance records the
      // stronger `reported`.
      entries.set("airflow", {
        forms: dedupe([...(entries.get("airflow")?.forms ?? []), ...airflowForms]),
        provenance: "reported",
      })
    }
  }

  if (towelMaterial) {
    const forms = mapTowelMaterial(towelMaterial)
    // `D4`: „Frottee" is a towel the user OWNS. There is no terry product type,
    // so the honest projection is no entry at all — writing `[]` would store
    // „du besitzt kein Trocknungstextil", a sentence the user never said
    // (fixtures 21, 104, 113). `no_towel` stays a real explicit none.
    if (forms.length > 0 || towelMaterial === "no_towel") {
      entries.set("drying_textiles", { forms, provenance: "reported" })
    }
  }

  // The legacy brush answer names brushes, but it predates the brush pages and was never an
  // ownership answer to them: its forms are DERIVED, like the Föhn above. An empty or
  // fingers-only answer projects nothing — a derived fact never proves absence.
  if (brushesCombs) {
    const forms = dedupe(brushesCombs.flatMap(mapBrushType))
    if (forms.length > 0) entries.set("brushes_combs", { forms, provenance: "derived" })
  }

  // Rev. 6 (fix round 1): a night TECHNIQUE („locker zusammengebunden", „Pineapple") is a
  // behaviour with its own Gewohnheiten question (`night_wear`). It projects no thing — in
  // particular no soft tie, which is pre-ticked only when the member names it herself — so a
  // technique-only answer leaves the night family unknown (fixtures 74, 102). An empty answer is
  // a real „Nichts davon" and stays an explicit none.
  if (nightProtection) {
    const forms = dedupe(nightProtection.flatMap(mapNightProtection))
    if (forms.length > 0 || nightProtection.length === 0) {
      entries.set("night_protection", { forms, provenance: "reported" })
    }
  }

  return [...entries]
}

/** Night answers that describe how the hair is worn, not a product that is owned. */
const NIGHT_PROTECTION_TECHNIQUES = new Set<NightProtection>(["loose_tied", "pineapple"])

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

/**
 * Inverse of the §4 brush map (`TOOL_FORM_CARE_FACTS[form].brushType`). `fingers` is an
 * answer-only token, never a product, so it projects nothing (`D9b`).
 */
const BRUSH_TYPE_PRODUCT_TYPES: Record<BrushType, ToolProductType | null> = {
  wide_tooth_comb: "wide_tooth_comb",
  detangling: "detangling_brush",
  paddle: "paddle_brush",
  round: "round_brush",
  boar_bristle: "boar_bristle",
  fingers: null,
}

function mapBrushType(brush: BrushType): ToolProductType[] {
  const form = BRUSH_TYPE_PRODUCT_TYPES[brush]
  return form ? [form] : []
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
      // Techniques, not things (Rev. 6): they come from the night question, never a soft tie.
      return []
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

// --- per-page answers, the derived care facts and the reported-ownership oracle ----------
//
// Hair Tools port (plan `plans/2026-10-09-hair-tools-port.md` Rev. 5 §4). The Feinschliff
// stores ONE answer per product-form page (`toolForms[pageKey]`), never per family. The
// thing-facts Gewohnheiten used to ask for — further heat tools, towel material, night
// protection — are derived from those pages (`careFactsFromToolInventory`), and brushes feed
// the legacy `brushesCombs` slot.

/** The part of the refinement answers the Tool trip owns. */
export type ToolAnswerState = Pick<
  PersonalPlanRefinementAnswersV1,
  "toolFamiliesWithSomething" | "toolForms"
>

function isOrderedSubset(value: unknown, order: readonly string[]): boolean {
  if (!Array.isArray(value)) return false
  if (new Set(value).size !== value.length) return false
  let last = -1
  for (const item of value) {
    const index = typeof item === "string" ? order.indexOf(item) : -1
    if (index <= last) return false
    last = index
  }
  return true
}

/** `tools_overview`: an ordered, duplicate-free subset of the wash-day family order. */
export function isToolOverviewAnswerValid(value: unknown): value is ToolFamily[] {
  return isOrderedSubset(value, TOOL_OVERVIEW_FAMILY_ORDER)
}

/**
 * `tools:<pageKey>`: an ordered (canonical FAMILY order), duplicate-free subset of the forms
 * that page offers. `[]` is the page's „Nichts davon".
 */
export function isToolPageAnswerValid(
  pageKey: ToolFormPageKey,
  value: unknown,
): value is ToolReportedForm[] {
  const page = toolFormPage(pageKey)
  if (!page) return false
  const offered = new Set<string>(page.forms)
  const order = TOOL_REPORTED_FORMS_BY_FAMILY[page.family].filter((form) => offered.has(form))
  return isOrderedSubset(value, order)
}

/**
 * Family view of the per-page answers: every family with at least one stored page, its pages
 * unioned in canonical order. Says nothing about whether the family is complete — see
 * `resolvedToolInventory` for that.
 */
export function toolFormsByFamily(answers: ToolAnswerState): ToolInventory {
  const inventory: ToolInventory = {}
  for (const family of TOOL_FAMILIES) {
    const pages = toolFormPagesOfFamily(family)
      .map((page) => answers.toolForms?.[page.pageKey])
      .filter((forms): forms is ToolReportedForm[] => Array.isArray(forms))
    if (pages.length === 0) continue
    inventory[family] = sortToolReportedForms(family, pages.flat())
  }
  return inventory
}

/**
 * The families the Tool trip has settled, for the derivation: nothing before the overview is
 * answered; afterwards an unticked family is an explicit none (`D3a`) and a ticked family is
 * settled once every one of its pages holds a valid answer.
 */
export function resolvedToolInventory(answers: ToolAnswerState): ToolInventory {
  if (!isToolOverviewAnswerValid(answers.toolFamiliesWithSomething)) return {}
  const ticked = new Set<ToolFamily>(answers.toolFamiliesWithSomething)
  const inventory: ToolInventory = {}
  for (const family of TOOL_FAMILIES) {
    if (!ticked.has(family)) {
      inventory[family] = []
      continue
    }
    const pages = toolFormPagesOfFamily(family).map((page) => ({
      pageKey: page.pageKey,
      forms: answers.toolForms?.[page.pageKey],
    }))
    if (!pages.every(({ pageKey, forms }) => isToolPageAnswerValid(pageKey, forms))) continue
    inventory[family] = sortToolReportedForms(
      family,
      pages.flatMap(({ forms }) => forms ?? []),
    )
  }
  return inventory
}

/**
 * What one reported form means for the care facts Gewohnheiten no longer asks for. Total over
 * every reported form: `{}` is an explicit "maps to nothing".
 *
 * - `additionalHeatTool`: the heat source the form opens (`heat:<source>`), via
 *   `additionalHeatTools`. The Föhn opens no additional heat tool: its heat event comes from
 *   the drying route the user picks in Gewohnheiten (`ordinary_blow_dry`, or
 *   `diffuser_airflow_shaping` through „Mit Diffusor").
 * - `dryingRoutes`: the drying routes Gewohnheiten offers because the form is owned
 *   (`air_dry` is always offered). „Mit Diffusor" is offered only for the answer-only
 *   `diffuser` card („Diffusor-Aufsatz").
 * - `towelMaterial` / `nightProtection` / `brushType`: the existing vocabulary value.
 */
export type ToolFormCareFact = {
  additionalHeatTool?: AdditionalHeatTool
  dryingRoutes?: readonly DryingRoute[]
  towelMaterial?: TowelMaterial
  nightProtection?: NightProtection
  brushType?: BrushType
}

export const TOOL_FORM_CARE_FACTS = {
  // airflow
  hair_dryer: { dryingRoutes: ["ordinary_blow_dry"] },
  diffuser: { dryingRoutes: ["diffuser_or_airflow_shaping"] },
  hot_air_brush: { additionalHeatTool: "dryer_brush", dryingRoutes: ["ordinary_blow_dry"] },
  air_multi_styler: { additionalHeatTool: "hot_air_styler", dryingRoutes: ["ordinary_blow_dry"] },
  // heated_styling
  flat_iron: { additionalHeatTool: "straightener" },
  curling_iron: { additionalHeatTool: "curling_or_wave_iron" },
  curling_wand: { additionalHeatTool: "curling_or_wave_iron" },
  wave_iron: { additionalHeatTool: "curling_or_wave_iron" },
  automatic_curler: { additionalHeatTool: "curling_or_wave_iron" },
  heated_rollers: { additionalHeatTool: "thermal_rollers" },
  heated_brush: { additionalHeatTool: "straightener" },
  heated_multi_styler: { additionalHeatTool: "curling_or_wave_iron" },
  // heatless_styling — no heat
  heatless_curling_band: {},
  setting_roller: {},
  foam_roller: {},
  flexi_rod: {},
  setting_former: {},
  // brushes_combs → legacy `brushesCombs` (forms without a legacy value drop out of that slot)
  wide_tooth_comb: { brushType: "wide_tooth_comb" },
  detangling_brush: { brushType: "detangling" },
  paddle_brush: { brushType: "paddle" },
  vent_brush: {},
  round_brush: { brushType: "round" },
  boar_bristle: { brushType: "boar_bristle" },
  styling_brush: {},
  hair_pick: {},
  sectioning_comb: {},
  fingers: { brushType: "fingers" },
  // securing_sectioning, wash_application — no care fact
  soft_hair_tie: {},
  scrunchie: {},
  claw_clip: {},
  sectioning_clip: {},
  root_volume_clip: {},
  hair_pin: {},
  headband: {},
  scalp_brush: {},
  applicator_bottle: {},
  applicator_comb: {},
  water_spray_bottle: {},
  // night_protection
  pillowcase: { nightProtection: "silk_satin_pillow" },
  bonnet: { nightProtection: "silk_satin_bonnet" },
  length_tip_sleeve: { nightProtection: "length_tip_accessory" },
  // Rev. 6: a soft tie is a THING. How the hair is worn (`loose_tied` / `pineapple`) comes from
  // the Gewohnheiten question „Wie trägst du dein Haar nachts?" (`nightWear`), never from the tie.
  soft_night_tie: {},
  // drying_textiles — the inverse of the existing pre-fill projection (`mapTowelMaterial`)
  microfiber_towel: { towelMaterial: "mikrofaser" },
  frottee: { towelMaterial: "frottee" },
  smooth_cotton_cloth: { towelMaterial: "tshirt" },
  drying_wrap: { towelMaterial: "turban_mikrofaser" },
} as const satisfies Record<ToolReportedForm, ToolFormCareFact>

/** Which textile names the towel material when several are owned. */
const TOWEL_MATERIAL_PRIORITY: readonly ToolReportedForm[] = [
  "microfiber_towel",
  "smooth_cotton_cloth",
  "drying_wrap",
  "frottee",
]

/** The care facts the tool inventory decides. A key is present only when it is derived. */
export type ToolDerivedCareFacts = {
  additionalHeatTools?: AdditionalHeatTool[]
  towelMaterial?: TowelMaterial
  nightProtection?: NightProtection[]
  brushesCombs?: BrushType[]
}

function known(inventory: ToolInventory, family: ToolFamily): ToolReportedForm[] | null {
  const forms = inventory[family]
  return Array.isArray(forms) ? forms : null
}

function careFactOf(form: ToolReportedForm): ToolFormCareFact {
  return TOOL_FORM_CARE_FACTS[form]
}

function inOrder<T extends string>(values: Iterable<T>, order: readonly T[]): T[] {
  const selected = new Set(values)
  return order.filter((value) => selected.has(value))
}

/**
 * The Gewohnheiten thing-facts a settled inventory derives (plan §4 „Derived thing-fields").
 * A family that is unknown (absent / `null`) derives nothing.
 *
 * - `additionalHeatTools` once BOTH `airflow` and `heated_styling` are known.
 * - `towelMaterial` once `drying_textiles` is known: `[]` (or an unticked section) is
 *   `no_towel`; several textiles → a suitable one wins over Frottee
 *   (`TOWEL_MATERIAL_PRIORITY`), so a reported suitable textile never reads as an upgrade case.
 * - `nightProtection` once `night_protection` is known (`[]` = none).
 * - `brushesCombs` once `brushes_combs` is known (forms without a legacy value drop out).
 */
export function careFactsFromToolInventory(inventory: ToolInventory): ToolDerivedCareFacts {
  const facts: ToolDerivedCareFacts = {}
  const airflow = known(inventory, "airflow")
  const heated = known(inventory, "heated_styling")
  if (airflow && heated) {
    facts.additionalHeatTools = inOrder(
      [...airflow, ...heated].flatMap((form) => {
        const tool = careFactOf(form).additionalHeatTool
        return tool ? [tool] : []
      }),
      ADDITIONAL_HEAT_TOOLS,
    )
  }
  const textiles = known(inventory, "drying_textiles")
  if (textiles) {
    const owned = new Set<ToolReportedForm>(textiles)
    const lead = TOWEL_MATERIAL_PRIORITY.find((form) => owned.has(form))
    facts.towelMaterial = lead ? (careFactOf(lead).towelMaterial ?? "no_towel") : "no_towel"
  }
  const night = known(inventory, "night_protection")
  if (night) {
    facts.nightProtection = inOrder(
      night.flatMap((form) => {
        const protection = careFactOf(form).nightProtection
        return protection ? [protection] : []
      }),
      NIGHT_PROTECTIONS,
    )
  }
  const brushes = known(inventory, "brushes_combs")
  if (brushes) {
    facts.brushesCombs = inOrder(
      brushes.flatMap((form) => {
        const brush = careFactOf(form).brushType
        return brush ? [brush] : []
      }),
      BRUSH_TYPES,
    )
  }
  return facts
}

/** The night technique a `nightWear` answer adds to `nightProtection` („Offen" adds none). */
const NIGHT_WEAR_TECHNIQUE: Record<NightWear, NightProtection | null> = {
  open: null,
  loose_tied: "loose_tied",
  pineapple: "pineapple",
}

/**
 * Rev. 6 — things vs behaviour: the derived `nightProtection` list is the night THINGS the tools
 * night page derives plus the TECHNIQUE of the night question. Until `nightWear` is answered the
 * technique the member already had (`previous`, her earlier night answer) stays in place, like
 * every other earlier answer before its new question is settled.
 */
export function nightProtectionWithWear(
  things: readonly NightProtection[],
  nightWear: NightWear | undefined,
  previous: readonly NightProtection[] | undefined,
): NightProtection[] {
  const techniques =
    nightWear !== undefined
      ? [NIGHT_WEAR_TECHNIQUE[nightWear]].filter(
          (technique): technique is NightProtection => technique !== null,
        )
      : (previous ?? []).filter((protection) => NIGHT_PROTECTION_TECHNIQUES.has(protection))
  return inOrder([...things, ...techniques], NIGHT_PROTECTIONS)
}

/**
 * The `nightWear` a stored `nightProtection` list implies, or `undefined` when it names no
 * technique (then „Offen" and „unanswered" cannot be told apart). When both techniques are
 * stored (the old multi-select), Pineapple wins: it is the more specific way to wear the hair.
 */
export function nightWearFromNightProtection(
  nightProtection: readonly NightProtection[] | null | undefined,
): Exclude<NightWear, "open"> | undefined {
  if (!nightProtection) return undefined
  if (nightProtection.includes("pineapple")) return "pineapple"
  if (nightProtection.includes("loose_tied")) return "loose_tied"
  return undefined
}

/**
 * The `nightWear` an EARLIER night answer (the pre-Rev.-6 multi-select, which offered both
 * techniques) stands for: its technique, else „Offen" — she was asked and chose neither. Unlike
 * `nightWearFromNightProtection` this reads an answered list as complete; `undefined` only when
 * there is no list at all.
 */
export function nightWearFromEarlierNightAnswer(
  nightProtection: readonly NightProtection[] | null | undefined,
): NightWear | undefined {
  if (!Array.isArray(nightProtection)) return undefined
  return nightWearFromNightProtection(nightProtection) ?? "open"
}

/**
 * The drying routes Gewohnheiten offers for a settled `airflow` family: `air_dry` always, the
 * rest per owned form (`TOOL_FORM_CARE_FACTS[form].dryingRoutes`). `null` while `airflow` is
 * unknown — every route stays offered then.
 */
export function dryingRouteOptionsFromToolInventory(
  inventory: ToolInventory,
): DryingRoute[] | null {
  const airflow = known(inventory, "airflow")
  if (!airflow) return null
  return inOrder(
    ["air_dry", ...airflow.flatMap((form) => careFactOf(form).dryingRoutes ?? [])],
    DRYING_ROUTES,
  )
}

// --- the reported-ownership oracle (`D5`) ------------------------------------------------

type ReportedPage = { forms: ToolReportedForm[] }

/**
 * Family inventory from the pages that count as REPORTED. A family is listed when one of its
 * pages names forms (the union of the reported pages), or — as an explicit none — when every
 * one of its pages is reported. Anything else stays unknown.
 */
function inventoryFromReportedPages(
  reported: Partial<Record<ToolFormPageKey, ReportedPage>>,
): ToolInventory {
  const inventory: ToolInventory = {}
  for (const family of TOOL_FAMILIES) {
    const pages = toolFormPagesOfFamily(family)
    const present = pages
      .map((page) => reported[page.pageKey])
      .filter((page): page is ReportedPage => page !== undefined)
    if (present.length === 0) continue
    const forms = sortToolReportedForms(
      family,
      present.flatMap((page) => page.forms),
    )
    if (forms.length > 0 || present.length === pages.length) inventory[family] = forms
  }
  return inventory
}

/**
 * Reported ownership from a refinement draft (`D5`): a page counts iff its own question id
 * completed with `user` provenance, or the overview completed as `user` and the page's family
 * is unticked (→ `[]`). Assumed answers never enter the inventory.
 */
export function reportedToolInventory(input: {
  answers: ToolAnswerState
  completedQuestionIds: readonly Stage2QuestionId[]
  answerProvenance: Stage2AnswerProvenance
}): ToolInventory {
  const completed = new Set(input.completedQuestionIds)
  const isUser = (id: Stage2QuestionId) =>
    completed.has(id) && input.answerProvenance[id] !== "assumed"
  const overviewUser =
    isUser("tools_overview") && isToolOverviewAnswerValid(input.answers.toolFamiliesWithSomething)
  const ticked = new Set<ToolFamily>(input.answers.toolFamiliesWithSomething ?? [])
  const reported: Partial<Record<ToolFormPageKey, ReportedPage>> = {}
  for (const page of TOOL_FORM_PAGES) {
    if (overviewUser && !ticked.has(page.family)) {
      reported[page.pageKey] = { forms: [] }
      continue
    }
    const forms = input.answers.toolForms?.[page.pageKey]
    if (isUser(`tools:${page.pageKey}`) && isToolPageAnswerValid(page.pageKey, forms)) {
      reported[page.pageKey] = { forms }
    }
  }
  return inventoryFromReportedPages(reported)
}

/**
 * Reported ownership from the stored `care_habits` facts — the same rule over the per-page
 * keys (`toolForms_<family>_<n>`) and their field provenance.
 */
export function reportedToolInventoryFromFacts(
  careHabits: Partial<CareHabitsV1> | null,
  fieldProvenance: Record<string, FieldProvenanceValue> | undefined,
): ToolInventory {
  if (!careHabits) return {}
  const facts = careHabits as Record<string, unknown>
  const overview = facts.toolFamiliesWithSomething
  const overviewUser =
    fieldProvenance?.toolFamiliesWithSomething === "user" && isToolOverviewAnswerValid(overview)
  const ticked = new Set<ToolFamily>(overviewUser ? (overview as ToolFamily[]) : [])
  const reported: Partial<Record<ToolFormPageKey, ReportedPage>> = {}
  for (const page of TOOL_FORM_PAGES) {
    if (overviewUser && !ticked.has(page.family)) {
      reported[page.pageKey] = { forms: [] }
      continue
    }
    const key = toolFormCareKey(page.pageKey)
    const forms = sortToolReportedForms(
      page.family,
      Array.isArray(facts[key]) ? (facts[key] as string[]) : [],
    )
    if (fieldProvenance?.[key] === "user" && Array.isArray(facts[key])) {
      if (isToolPageAnswerValid(page.pageKey, forms)) reported[page.pageKey] = { forms }
    }
  }
  return inventoryFromReportedPages(reported)
}
