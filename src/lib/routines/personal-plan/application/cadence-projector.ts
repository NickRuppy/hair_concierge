import type { ApplicationDayTypeKey, NormalizedRoutineItem, SemanticRole } from "./contracts"

type ProjectApplicationCadenceInput = {
  routineItems: readonly NormalizedRoutineItem[]
  compiledDayKeys: readonly ApplicationDayTypeKey[]
}

const DEFINING_ROLE_BY_DAY: Partial<Record<ApplicationDayTypeKey, SemanticRole>> = {
  wash_day: "cleanse",
  intensive_care_day: "intensive_care",
  bond_repair_day: "bond_repair",
  clarifying_wash_day: "reset_cleanse",
  refresh_day: "refresh",
}

const STATIC_CADENCE_BY_DAY: Partial<Record<ApplicationDayTypeKey, string>> = {
  between_wash_care_day: "Bei Bedarf",
  styling_day: "Beim Stylen",
  rest_day: "Immer möglich",
}

function compareRoutineItems(left: NormalizedRoutineItem, right: NormalizedRoutineItem) {
  const leftOrder = left.routineOrder ?? Number.MAX_SAFE_INTEGER
  const rightOrder = right.routineOrder ?? Number.MAX_SAFE_INTEGER
  return leftOrder - rightOrder || left.itemId.localeCompare(right.itemId)
}

/** Projects frozen Stage 4 cadence onto application days without catalog reads or re-resolution. */
export function projectApplicationCadenceByDay({
  routineItems,
  compiledDayKeys,
}: ProjectApplicationCadenceInput): Partial<Record<ApplicationDayTypeKey, string>> {
  const result: Partial<Record<ApplicationDayTypeKey, string>> = {}
  const orderedItems = [...routineItems].sort(compareRoutineItems)

  for (const dayKey of compiledDayKeys) {
    const staticCadence = STATIC_CADENCE_BY_DAY[dayKey]
    if (staticCadence) {
      result[dayKey] = staticCadence
      continue
    }
    const definingRole = DEFINING_ROLE_BY_DAY[dayKey]
    const cadence = definingRole
      ? orderedItems.find(
          (item) => item.role === definingRole && typeof item.effectiveCadenceDe === "string",
        )?.effectiveCadenceDe
      : undefined
    if (cadence) result[dayKey] = cadence
    else if (dayKey === "refresh_day") result[dayKey] = "Bei Bedarf"
  }

  return result
}
