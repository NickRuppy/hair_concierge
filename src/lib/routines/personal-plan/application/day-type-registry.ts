import type {
  ApplicationDayTypeKey,
  NormalizedProfile,
  NormalizedRoutineItem,
  SemanticRole,
} from "./contracts"
import {
  heatEventDayContext,
  OIL_WASH_FAMILY_DAY_TYPES,
  oilHeatEventMatchesDay,
} from "@/lib/personal-plan/oil-heat-context"

export const CANONICAL_APPLICATION_DAY_RULES: Record<
  ApplicationDayTypeKey,
  {
    requiredRoles: readonly SemanticRole[]
    alwaysRelevantRoles: readonly SemanticRole[]
    acceptedRoles: readonly SemanticRole[]
  }
> = {
  wash_day: {
    requiredRoles: ["cleanse"],
    alwaysRelevantRoles: ["cleanse", "condition", "leave_in"],
    acceptedRoles: [
      "cleanse",
      "condition",
      "leave_in",
      "heat_protection",
      "scalp_care",
      "styling",
      "finish",
    ],
  },
  intensive_care_day: {
    requiredRoles: ["cleanse", "intensive_care"],
    alwaysRelevantRoles: ["cleanse", "intensive_care"],
    acceptedRoles: [
      "cleanse",
      "intensive_care",
      "condition",
      "leave_in",
      "heat_protection",
      "scalp_care",
      "styling",
      "finish",
    ],
  },
  bond_repair_day: {
    requiredRoles: ["bond_repair"],
    alwaysRelevantRoles: ["bond_repair"],
    acceptedRoles: [
      "bond_repair",
      "cleanse",
      "condition",
      "leave_in",
      "heat_protection",
      "styling",
      "finish",
    ],
  },
  clarifying_wash_day: {
    requiredRoles: ["reset_cleanse"],
    alwaysRelevantRoles: ["reset_cleanse"],
    acceptedRoles: [
      "reset_cleanse",
      "condition",
      "intensive_care",
      "leave_in",
      "heat_protection",
      "styling",
      "finish",
    ],
  },
  refresh_day: {
    requiredRoles: ["refresh", "leave_in", "styling"],
    alwaysRelevantRoles: ["refresh"],
    acceptedRoles: ["refresh", "leave_in", "styling", "heat_protection", "finish"],
  },
  between_wash_care_day: {
    requiredRoles: ["leave_in", "finish"],
    alwaysRelevantRoles: ["leave_in", "finish"],
    acceptedRoles: ["leave_in", "finish", "styling", "heat_protection"],
  },
  styling_day: {
    requiredRoles: ["styling", "heat_protection"],
    alwaysRelevantRoles: ["styling", "heat_protection"],
    acceptedRoles: ["styling", "heat_protection", "leave_in", "finish"],
  },
  rest_day: { requiredRoles: [], alwaysRelevantRoles: [], acceptedRoles: [] },
}

export function routineItemsForDay(
  key: ApplicationDayTypeKey,
  items: readonly NormalizedRoutineItem[],
) {
  return items.filter(
    (item) =>
      CANONICAL_APPLICATION_DAY_RULES[key].acceptedRoles.includes(item.role) &&
      heatOccurrenceBelongsToDay(key, item),
  )
}

/**
 * A heat-protection occurrence (one per heat event, `materializeHeatOccurrences`) belongs only
 * to the days its event happens on — protection before blow-drying on wash days, before the
 * iron on the Styling-Tag, none on a care or refresh day without heat (Nomi consult finish
 * T6). Items without a mapped event keep today's placement.
 */
function heatOccurrenceBelongsToDay(
  key: ApplicationDayTypeKey,
  item: NormalizedRoutineItem,
): boolean {
  if (item.role !== "heat_protection") return true
  const tool = item.catalogFacts.heatEventTool
  const route = item.catalogFacts.heatEventRoute
  if (typeof tool !== "string" || typeof route !== "string") return true
  const context = heatEventDayContext({ tool, route } as Parameters<typeof heatEventDayContext>[0])
  if (context === null) return true
  return context === "wash_family"
    ? (OIL_WASH_FAMILY_DAY_TYPES as readonly string[]).includes(key)
    : key === "styling_day"
}

export function isAlwaysRelevantRoleForDay(
  key: ApplicationDayTypeKey,
  role: SemanticRole,
): boolean {
  return CANONICAL_APPLICATION_DAY_RULES[key].alwaysRelevantRoles.includes(role)
}

export function heatEventMatchesOilCarrierDay(
  key: ApplicationDayTypeKey,
  heatEvents: NonNullable<NormalizedProfile["heatEvents"]>,
): boolean {
  if (
    key !== "wash_day" &&
    key !== "intensive_care_day" &&
    key !== "bond_repair_day" &&
    key !== "clarifying_wash_day" &&
    key !== "styling_day"
  ) {
    return false
  }
  return heatEvents.some((event) => oilHeatEventMatchesDay(key, event))
}
