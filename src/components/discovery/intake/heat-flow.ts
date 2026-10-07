import {
  discoveryHeatEventSources,
  parseDiscoveryHeatStyling,
  type DiscoveryHeatStylingV1,
} from "@/lib/discovery/heat-styling"
import {
  createStage2HeatEventId,
  requiresStage2HeatProtection,
} from "@/lib/personal-plan/refinement/heat-events"
import type {
  AdditionalHeatTool,
  DryingRoute,
  HeatProtectionConsistency,
  Stage2HeatEventQuestionId,
  Stage2HeatEventSource,
} from "@/lib/personal-plan/refinement/types"
import type { ProductFrequency } from "@/lib/vocabulary/frequencies"

/**
 * „Hitze & Styling" (batch 7, plan Rev. 3 §2.1 item 5; prototype round 6 `hfSteps`): one
 * question per screen, production Feinschliff vocabulary.
 *
 *   drying („Wie trocknet dein Haar meistens?", multi + „Keiner dieser Wege")
 *   tools  („Nutzt du weitere Hitze-Tools?", photo grid + „Keine weiteren Tools")
 *   per heat source: frequency, then protection — only where production asks for it
 *   summary („Alles bereit für unser Gespräch")
 *
 * Pure: the checklist keeps a `DiscoveryHeatDraft` in state; `toDiscoveryHeatStyling` is the
 * whole object the `PUT /api/beratung/intake/heat-styling` route validates.
 */

export type DiscoveryHeatEventDraft = {
  frequency?: ProductFrequency
  protectionConsistency?: HeatProtectionConsistency
}

export type DiscoveryHeatDraft = {
  /** `undefined` = not answered yet; `[]` = „Keiner dieser Wege". */
  dryingRoutes?: DryingRoute[]
  /** `undefined` = not answered yet; `[]` = „Keine weiteren Tools". */
  additionalHeatTools?: AdditionalHeatTool[]
  heatEvents: Partial<Record<Stage2HeatEventQuestionId, DiscoveryHeatEventDraft>>
}

export type DiscoveryHeatStep =
  | { kind: "drying" }
  | { kind: "tools" }
  | { kind: "frequency"; source: Stage2HeatEventSource }
  | { kind: "protection"; source: Stage2HeatEventSource }
  | { kind: "summary" }

export const EMPTY_HEAT_DRAFT: DiscoveryHeatDraft = { heatEvents: {} }

/** A stored answer prefills the flow when she comes back to edit it. */
export function heatDraftFrom(
  saved: DiscoveryHeatStylingV1 | null | undefined,
): DiscoveryHeatDraft {
  if (!saved) return EMPTY_HEAT_DRAFT
  return {
    dryingRoutes: [...saved.dryingRoutes],
    additionalHeatTools: [...saved.additionalHeatTools],
    heatEvents: { ...saved.heatEvents },
  }
}

/** The heat sources her routes and tools imply, in production order. */
export function heatDraftSources(draft: DiscoveryHeatDraft): Stage2HeatEventSource[] {
  return discoveryHeatEventSources({
    dryingRoutes: draft.dryingRoutes ?? [],
    additionalHeatTools: draft.additionalHeatTools ?? [],
    heatEvents: {},
  })
}

export function discoveryHeatSteps(draft: DiscoveryHeatDraft): DiscoveryHeatStep[] {
  const steps: DiscoveryHeatStep[] = [{ kind: "drying" }, { kind: "tools" }]
  for (const source of heatDraftSources(draft)) {
    steps.push({ kind: "frequency", source })
    if (requiresStage2HeatProtection(source)) steps.push({ kind: "protection", source })
  }
  steps.push({ kind: "summary" })
  return steps
}

export function heatStepKey(step: DiscoveryHeatStep): string {
  return step.kind === "frequency" || step.kind === "protection"
    ? `${step.kind}:${step.source}`
    : step.kind
}

/** Only the two multi-selects wait for „Weiter"; single taps advance by themselves. */
export function isHeatStepAnswered(draft: DiscoveryHeatDraft, step: DiscoveryHeatStep): boolean {
  if (step.kind === "drying") return draft.dryingRoutes !== undefined
  if (step.kind === "tools") return draft.additionalHeatTools !== undefined
  const event =
    step.kind === "summary" ? null : draft.heatEvents[createStage2HeatEventId(step.source)]
  if (step.kind === "frequency") return Boolean(event?.frequency)
  if (step.kind === "protection") return Boolean(event?.protectionConsistency)
  return true
}

export function setHeatEvent(
  draft: DiscoveryHeatDraft,
  source: Stage2HeatEventSource,
  patch: DiscoveryHeatEventDraft,
): DiscoveryHeatDraft {
  const id = createStage2HeatEventId(source)
  return {
    ...draft,
    heatEvents: { ...draft.heatEvents, [id]: { ...draft.heatEvents[id], ...patch } },
  }
}

/**
 * The whole object for the PUT — only the events her CURRENT routes and tools imply (a tool
 * she unticked drops its answers), a protection answer only where it belongs. `null` while
 * anything is still open.
 */
export function toDiscoveryHeatStyling(draft: DiscoveryHeatDraft): DiscoveryHeatStylingV1 | null {
  if (!draft.dryingRoutes || !draft.additionalHeatTools) return null
  const heatEvents: DiscoveryHeatStylingV1["heatEvents"] = {}
  for (const source of heatDraftSources(draft)) {
    const id = createStage2HeatEventId(source)
    const event = draft.heatEvents[id]
    if (!event?.frequency) return null
    if (requiresStage2HeatProtection(source)) {
      if (!event.protectionConsistency) return null
      heatEvents[id] = {
        frequency: event.frequency,
        protectionConsistency: event.protectionConsistency,
      }
    } else {
      heatEvents[id] = { frequency: event.frequency }
    }
  }
  const value: DiscoveryHeatStylingV1 = {
    dryingRoutes: [...draft.dryingRoutes],
    additionalHeatTools: [...draft.additionalHeatTools],
    heatEvents,
  }
  return parseDiscoveryHeatStyling(value).ok ? value : null
}

// --- Copy ------------------------------------------------------------------------------------

/** Production Feinschliff's `HEAT_SOURCE_TITLES` („Wie oft nutzt du …?"). */
export const HEAT_SOURCE_QUESTION_OBJECT: Record<Stage2HeatEventSource, string> = {
  ordinary_blow_dry: "gewöhnliches Föhnen",
  diffuser_airflow_shaping: "Diffusor oder formenden Luftstrom",
  dryer_brush: "die Föhnbürste",
  hot_air_styler: "den Hot-Air-Styler",
  straightener: "das Glätteisen",
  curling_or_wave_iron: "Lockenstab oder Welleneisen",
  thermal_rollers: "Thermo-Wickler",
}

/** The final page's short names. */
export const HEAT_SOURCE_SHORT_LABELS: Record<Stage2HeatEventSource, string> = {
  ordinary_blow_dry: "Föhnen",
  diffuser_airflow_shaping: "Diffusor",
  dryer_brush: "Föhnbürste",
  hot_air_styler: "Heißluft-Multistyler",
  straightener: "Glätteisen",
  curling_or_wave_iron: "Lockenstab",
  thermal_rollers: "Thermo-Wickler",
}

/** The production tool photos (`public/images/tools`), one per heat source. */
export const HEAT_SOURCE_IMAGES: Record<Stage2HeatEventSource, string> = {
  ordinary_blow_dry: "/images/tools/blow_dryer.webp",
  diffuser_airflow_shaping: "/images/tools/diffuser.webp",
  dryer_brush: "/images/tools/dryer_brush.webp",
  hot_air_styler: "/images/tools/hot_air_styler.webp",
  straightener: "/images/tools/straightener.webp",
  curling_or_wave_iron: "/images/tools/curling_or_wave_iron.webp",
  thermal_rollers: "/images/tools/thermal_rollers.webp",
}

export const NO_HEAT_STYLING_LABEL = "Kein Hitze-Styling"

/** „Föhnen · Glätteisen" — or „Kein Hitze-Styling" when no heat source is left. */
export function heatSummaryLabel(heat: DiscoveryHeatStylingV1 | DiscoveryHeatDraft): string {
  const sources = heatDraftSources(heat)
  return sources.length > 0
    ? sources.map((source) => HEAT_SOURCE_SHORT_LABELS[source]).join(" · ")
    : NO_HEAT_STYLING_LABEL
}
