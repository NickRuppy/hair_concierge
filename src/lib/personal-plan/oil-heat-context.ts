import type { InitialNeedPlanSnapshot, PlanHeatToolUseEvent } from "./types"

export const OIL_WASH_FAMILY_DAY_TYPES = [
  "wash_day",
  "intensive_care_day",
  "bond_repair_day",
  "clarifying_wash_day",
] as const

type OilHeatDayType = (typeof OIL_WASH_FAMILY_DAY_TYPES)[number] | "styling_day"
type OilHeatEvent = Pick<PlanHeatToolUseEvent, "tool" | "route">

/**
 * Which days a heat event happens on: blow-drying with a hair dryer belongs to the wash family
 * (it follows a wash), hot tools and airflow stylers to the Styling-Tag. `null`: unmapped tool.
 * Shared by the Oil carrier and (Nomi consult finish T6) Heat protection placement.
 */
export function heatEventDayContext(event: OilHeatEvent): "wash_family" | "styling_day" | null {
  return oilHeatEventContext(event)
}

function oilHeatEventContext(event: OilHeatEvent): "wash_family" | "styling_day" | null {
  if (event.tool === "hair_dryer" && event.route === "airflow_shaping") {
    return "wash_family"
  }
  if (
    event.route === "direct_contact_heat" ||
    (event.route === "airflow_shaping" &&
      (event.tool === "dryer_brush" || event.tool === "hot_air_styler"))
  ) {
    return "styling_day"
  }
  return null
}

export function oilProtocolSupportsHeatEvent(
  compatibleDayTypes: readonly string[],
  event: OilHeatEvent,
): boolean {
  const context = oilHeatEventContext(event)
  if (context === "wash_family") {
    // Stage 3 knows the event's wash-family route but not its eventual exact
    // day assignment. Credit the Oil only when its reviewed protocol is safe
    // on every day that route can land on; a subset must keep standalone Heat.
    return OIL_WASH_FAMILY_DAY_TYPES.every((dayType) => compatibleDayTypes.includes(dayType))
  }
  return context === "styling_day" && compatibleDayTypes.includes("styling_day")
}

export function oilHeatEventMatchesDay(dayType: OilHeatDayType, event: OilHeatEvent): boolean {
  const context = oilHeatEventContext(event)
  return context === "wash_family"
    ? OIL_WASH_FAMILY_DAY_TYPES.includes(dayType as (typeof OIL_WASH_FAMILY_DAY_TYPES)[number])
    : context === "styling_day" && dayType === "styling_day"
}

export function heatEventsFromNeedSnapshot(
  snapshot: InitialNeedPlanSnapshot,
): InitialNeedPlanSnapshot["assessments"]["heatExposure"]["events"] {
  return (snapshot as Partial<InitialNeedPlanSnapshot>).assessments?.heatExposure?.events ?? []
}

/**
 * The ONE rule for which refined heat event counts as an activating heat step for a
 * heat-activated product (Leave-In v1.2, S3 Q3). Shaping airflow (diffuser, dryer brush,
 * hot-air styler) and hot tools count.
 *
 * Plain blow-drying (`ordinary_airflow`) does not count: Neqi's reviewed workflow
 * requires blow-drying with brush/tension. Q11=B excludes HEAT&GLOW from activation.
 */
export function activatingHeatRouteForEvent(
  event: Pick<PlanHeatToolUseEvent, "tool" | "route">,
): "airflow_shaping" | "direct_contact_heat" | null {
  if (event.route === "airflow_shaping" || event.route === "direct_contact_heat") return event.route
  return null
}

/**
 * The user's heat routes for Stage-3 heat-activation checks: the distinct activating routes
 * of the refined heat events (`activatingHeatRouteForEvent`). Sorted for a stable input.
 */
export function stage3HeatRoutesFromSnapshot(
  snapshot: InitialNeedPlanSnapshot,
): Array<"airflow_shaping" | "direct_contact_heat"> {
  const routes = new Set(
    heatEventsFromNeedSnapshot(snapshot).map((event) => activatingHeatRouteForEvent(event)),
  )
  return (["airflow_shaping", "direct_contact_heat"] as const).filter((route) => routes.has(route))
}
