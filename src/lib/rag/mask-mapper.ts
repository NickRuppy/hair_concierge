import type { MaskType } from "@/lib/types"

export type MaskConcernCode = "protein" | "feuchtigkeit" | "performance"

export function mapMaskTypeToConcernCode(maskType: MaskType | null): MaskConcernCode | null {
  switch (maskType) {
    case "protein":
      return "protein"
    case "moisture":
      return "feuchtigkeit"
    case "performance":
      return "performance"
    default:
      return null
  }
}

export function buildMaskConcernSearchOrder(maskType: MaskType | null): MaskConcernCode[] {
  const primaryConcern = mapMaskTypeToConcernCode(maskType)
  if (!primaryConcern) return []
  if (primaryConcern === "performance") return ["performance"]
  return [primaryConcern, "performance"]
}
