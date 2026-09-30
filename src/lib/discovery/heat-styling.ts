import { z } from "zod"

import {
  createStage2HeatEventId,
  getSelectedStage2HeatEventSources,
  projectStage2HeatEvents,
  type ProjectedStage2HeatEvent,
} from "@/lib/personal-plan/refinement/heat-events"
import {
  ADDITIONAL_HEAT_TOOLS,
  DRYING_ROUTES,
  HEAT_PROTECTION_CONSISTENCIES,
  STAGE2_HEAT_EVENT_SOURCES,
  type AdditionalHeatTool,
  type DryingRoute,
  type HeatProtectionConsistency,
  type Stage2HeatEventQuestionId,
  type Stage2HeatEventSource,
} from "@/lib/personal-plan/refinement/types"
import { PRODUCT_FREQUENCIES, type ProductFrequency } from "@/lib/vocabulary/frequencies"

import { DISCOVERY_FREQUENCY_LABELS } from "./frequency"

/**
 * Batch 7 (plan `plans/discovery-refinement-b7/plan.md` Rev. 3, §2.1 item 5, §2.2): her
 * „Hitze & Styling" answers, stored whole in `discovery_intakes.heat_styling`. Pure and
 * client-safe.
 *
 * The vocabulary is production Feinschliff's (`refinement/types.ts`, `heat-events.ts`), so
 * the routine engine reads the answers exactly as it reads a refined participant's:
 *   - „Keiner dieser Wege" = `dryingRoutes: []` (production `allowNone`);
 *   - „Keine weiteren Tools" = `additionalHeatTools: []`;
 *   - one heat event per heat source the routes and tools imply (air drying implies none),
 *     keyed `heat:<source>`, with a concrete `ProductFrequency` (no „Weiß ich nicht") and a
 *     `protectionConsistency` iff the source needs heat protection (plain föhnen does not).
 * No towel / night / scalp answers (ruling F3.2).
 */

export type DiscoveryHeatEventAnswer = {
  frequency: ProductFrequency
  protectionConsistency?: HeatProtectionConsistency
}

export type DiscoveryHeatStylingV1 = {
  dryingRoutes: DryingRoute[]
  additionalHeatTools: AdditionalHeatTool[]
  heatEvents: Partial<Record<Stage2HeatEventQuestionId, DiscoveryHeatEventAnswer>>
}

const HEAT_EVENT_KEYS = STAGE2_HEAT_EVENT_SOURCES.map(createStage2HeatEventId)

function unique<T>(values: readonly T[]): boolean {
  return new Set(values).size === values.length
}

const heatEventAnswerSchema = z
  .object({
    frequency: z.enum(PRODUCT_FREQUENCIES),
    protectionConsistency: z.enum(HEAT_PROTECTION_CONSISTENCIES).optional(),
  })
  .strict()

/** Shape only; `parseDiscoveryHeatStyling` adds the cross-field event rules. */
export const discoveryHeatStylingSchema = z
  .object({
    dryingRoutes: z.array(z.enum(DRYING_ROUTES)).refine(unique),
    additionalHeatTools: z.array(z.enum(ADDITIONAL_HEAT_TOOLS)).refine(unique),
    heatEvents: z
      .record(z.string(), heatEventAnswerSchema)
      .refine((events) =>
        Object.keys(events).every((key) => (HEAT_EVENT_KEYS as string[]).includes(key)),
      ),
  })
  .strict()

export type DiscoveryHeatStylingParse =
  | { ok: true; value: DiscoveryHeatStylingV1 }
  | { ok: false; reason: "invalid_shape" | "invalid_events" }

/** The heat sources her routes and tools imply, in production order. */
export function discoveryHeatEventSources(heat: DiscoveryHeatStylingV1): Stage2HeatEventSource[] {
  return getSelectedStage2HeatEventSources(heat)
}

/**
 * Production's own projection (`projectStage2HeatEvents`) over her answers: throws on a
 * missing event, a protection answer where none belongs, or one missing where it does.
 */
export function projectDiscoveryHeatEvents(
  heat: DiscoveryHeatStylingV1,
): ProjectedStage2HeatEvent[] {
  return projectStage2HeatEvents(heat)
}

/**
 * The whole-object validation the heat-styling route runs: the shape, then exactly one
 * event per implied heat source — no extra keys — each complete per production's projection.
 */
export function parseDiscoveryHeatStyling(raw: unknown): DiscoveryHeatStylingParse {
  const parsed = discoveryHeatStylingSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, reason: "invalid_shape" }
  const value = parsed.data as DiscoveryHeatStylingV1
  const expected = discoveryHeatEventSources(value).map(createStage2HeatEventId)
  const given = Object.keys(value.heatEvents)
  if (given.length !== expected.length || !given.every((key) => expected.includes(key as never))) {
    return { ok: false, reason: "invalid_events" }
  }
  try {
    projectDiscoveryHeatEvents(value)
  } catch {
    return { ok: false, reason: "invalid_events" }
  }
  return { ok: true, value }
}

/**
 * A stored `discovery_intakes.heat_styling` as the readers see it: `null` when not asked —
 * and when a stored value no longer validates (asked again), never a failure.
 */
export function readDiscoveryHeatStyling(value: unknown): DiscoveryHeatStylingV1 | null {
  if (value === null || value === undefined) return null
  const parsed = parseDiscoveryHeatStyling(value)
  return parsed.ok ? parsed.value : null
}

// --- Cockpit block ---------------------------------------------------------------------

const DRYING_LABELS: Record<DryingRoute, string> = {
  air_dry: "Lufttrocknen",
  ordinary_blow_dry: "Gewöhnlich föhnen",
  diffuser_or_airflow_shaping: "Diffusor oder formender Luftstrom",
}

const NO_DRYING_ROUTE = "Keiner dieser Wege"

const HEAT_SOURCE_LABELS: Record<Stage2HeatEventSource, string> = {
  ordinary_blow_dry: "Föhnen",
  diffuser_airflow_shaping: "Diffusor",
  dryer_brush: "Föhnbürste",
  hot_air_styler: "Heißluft-Multistyler",
  straightener: "Glätteisen",
  curling_or_wave_iron: "Lockenstab oder Welleneisen",
  thermal_rollers: "Thermo-Wickler",
}

const PROTECTION_LABELS: Record<HeatProtectionConsistency, string> = {
  always: "Hitzeschutz: immer",
  sometimes: "Hitzeschutz: manchmal",
  no: "Hitzeschutz: nein",
  unsure: "Hitzeschutz: unsicher",
}

export type DiscoveryHeatStylingSummary = {
  /** Her drying routes on one line, „Keiner dieser Wege" when none. */
  drying: string
  /** One row per heat source: föhnen, diffusor and each tool. */
  tools: Array<{ label: string; frequency: string; protection: string | null }>
}

/** The cockpit's compact „Hitze & Styling" block — internal copy, Nick's register. */
export function describeDiscoveryHeatStyling(
  heat: DiscoveryHeatStylingV1,
): DiscoveryHeatStylingSummary {
  const routes = DRYING_ROUTES.filter((route) => heat.dryingRoutes.includes(route))
  return {
    drying:
      routes.length > 0 ? routes.map((route) => DRYING_LABELS[route]).join(" · ") : NO_DRYING_ROUTE,
    tools: discoveryHeatEventSources(heat).flatMap((source) => {
      const answer = heat.heatEvents[createStage2HeatEventId(source)]
      if (!answer) return []
      return [
        {
          label: HEAT_SOURCE_LABELS[source],
          frequency: DISCOVERY_FREQUENCY_LABELS[answer.frequency],
          protection: answer.protectionConsistency
            ? PROTECTION_LABELS[answer.protectionConsistency]
            : null,
        },
      ]
    }),
  }
}
