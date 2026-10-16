import type { HairThickness } from "@/lib/vocabulary"

import type { OilWeight } from "./constants"

export function getOilLeaveOnWeightTargets(
  thickness: HairThickness,
  loadSensitive: boolean,
): { weight: OilWeight; acceptedTargets: OilWeight[] } {
  if (thickness === "fine") {
    return { weight: "light", acceptedTargets: ["light"] }
  }

  if (thickness === "normal") {
    return loadSensitive
      ? { weight: "light", acceptedTargets: ["light"] }
      : { weight: "medium", acceptedTargets: ["light", "medium"] }
  }

  return loadSensitive
    ? { weight: "medium", acceptedTargets: ["medium"] }
    : { weight: "rich", acceptedTargets: ["medium", "rich"] }
}
