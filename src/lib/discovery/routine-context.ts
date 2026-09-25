import type { PersonalPlanCategory } from "@/lib/personal-plan/products/contracts"
import {
  INITIAL_UNKNOWN_ROUTINE_CONTEXT,
  STAGE1_CATEGORY_ORDER,
  type PlanCurrentProductLoad,
  type PlanRoutineContext,
} from "@/lib/personal-plan/types"

import type { DiscoveryUsageRole } from "./classify"
import { mostFrequentDiscoveryFrequency, type DiscoveryItemFrequency } from "./frequency"
import { projectDiscoveryHeatEvents, type DiscoveryHeatStylingV1 } from "./heat-styling"

/**
 * Batch 7 (plan `plans/discovery-refinement-b7/plan.md` Rev. 3, §2.3; ruling F3.3): the
 * Idealroutine uses her checklist answers. Pure, client-safe.
 *
 * Built directly from the intake — NOT through `buildPlanRoutineContextFromCompletedRefinement`,
 * whose completeness contract requires towel/night answers the checklist deliberately does
 * not collect:
 *
 *  - `shampooFrequency` — her MOST frequent shampoo (usage category `shampoo`); unknown when
 *    no shampoo carries a known frequency;
 *  - `heatToolUse` — production's heat projection over her heat answers; unknown when she
 *    was not asked (the heat protectant then stays deferred, as in the quiz-only plan);
 *  - `currentProductLoad` — the usage categories of her products and the oil purposes of
 *    their roles;
 *  - everything else stays unknown — never asked here.
 */

/** Where these heat events came from, for the engine's reason trail. */
export const DISCOVERY_HEAT_SOURCE_RULE_IDS = ["discovery_intake:heat_styling"] as const

/** What the builder reads of an intake item (the read model and the view both satisfy it). */
export type DiscoveryRoutineContextItem = {
  source: string
  category: PersonalPlanCategory | null
  usageRole?: DiscoveryUsageRole | null
  frequency?: DiscoveryItemFrequency | null
}

const OIL_PURPOSE_BY_ROLE: Partial<
  Record<DiscoveryUsageRole, PlanCurrentProductLoad["oilPurposes"][number]>
> = {
  pre_wash_fibre_treatment: "prewash_lengths",
  leave_on_fibre_conditioning: "damp_leave_on",
  dry_finish: "dry_finish",
  scalp_flake_oil_adjunct: "scalp",
}

function products<T extends DiscoveryRoutineContextItem>(items: readonly T[]): T[] {
  return items.filter((item) => item.source !== "none")
}

/**
 * The legacy gate (Codex P1-2): only an intake carrying batch-7 answers — heat answers, or
 * any product with a frequency (incl. „Weiß ich nicht") — gets the override. Every legacy
 * intake keeps today's quiz-only computation, and with it its finalised fingerprint.
 */
export function discoveryIntakeHasRoutineAnswers(
  items: readonly DiscoveryRoutineContextItem[],
  heatStyling: DiscoveryHeatStylingV1 | null,
): boolean {
  return (
    heatStyling !== null ||
    products(items).some((item) => item.frequency !== null && item.frequency !== undefined)
  )
}

export function buildDiscoveryRoutineContext(
  items: readonly DiscoveryRoutineContextItem[],
  heatStyling: DiscoveryHeatStylingV1 | null,
): PlanRoutineContext {
  const owned = products(items)
  const shampooFrequency = mostFrequentDiscoveryFrequency(
    owned.filter((item) => item.category === "shampoo").map((item) => item.frequency),
  )
  const categories = new Set(owned.flatMap((item) => (item.category ? [item.category] : [])))
  const purposes = new Set(
    owned.flatMap((item) => {
      const purpose = item.usageRole ? OIL_PURPOSE_BY_ROLE[item.usageRole] : undefined
      return purpose ? [purpose] : []
    }),
  )
  const purposeOrder = Object.values(OIL_PURPOSE_BY_ROLE)

  return {
    ...INITIAL_UNKNOWN_ROUTINE_CONTEXT,
    currentProductLoad: {
      state: "known",
      value: {
        categories: STAGE1_CATEGORY_ORDER.filter((category) => categories.has(category)),
        oilPurposes: purposeOrder.filter(
          (purpose): purpose is NonNullable<typeof purpose> =>
            purpose !== undefined && purposes.has(purpose),
        ),
      },
    },
    shampooFrequency: shampooFrequency
      ? { state: "known", value: shampooFrequency }
      : INITIAL_UNKNOWN_ROUTINE_CONTEXT.shampooFrequency,
    heatToolUse: heatStyling
      ? {
          state: "known",
          value: projectDiscoveryHeatEvents(heatStyling).map((event) => ({
            id: event.id,
            tool: event.tool,
            route: event.route,
            frequency: event.frequency,
            sourceRuleIds: [...DISCOVERY_HEAT_SOURCE_RULE_IDS],
          })),
        }
      : INITIAL_UNKNOWN_ROUTINE_CONTEXT.heatToolUse,
  }
}
