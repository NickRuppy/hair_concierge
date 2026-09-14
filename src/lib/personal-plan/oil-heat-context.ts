import type { InitialNeedPlanSnapshot, PlanHeatToolUseEvent } from "./types"

export const OIL_WASH_FAMILY_DAY_TYPES = [
  "wash_day",
  "intensive_care_day",
  "bond_repair_day",
  "clarifying_wash_day",
] as const

type OilHeatDayType = (typeof OIL_WASH_FAMILY_DAY_TYPES)[number] | "styling_day"
type OilHeatEvent = Pick<PlanHeatToolUseEvent, "tool" | "route">

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
