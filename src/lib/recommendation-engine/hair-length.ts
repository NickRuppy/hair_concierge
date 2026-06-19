import type { HairLength } from "@/lib/vocabulary"

export type LengthCareIntensity =
  | "unknown"
  | "minimal"
  | "light"
  | "standard"
  | "elevated"
  | "maximum"

export function hasLengthEndsZone(hairLength: HairLength | null | undefined): boolean {
  return hairLength !== "very_short" && hairLength != null
}

export function getLengthCareIntensity(
  hairLength: HairLength | null | undefined,
): LengthCareIntensity {
  switch (hairLength) {
    case "very_short":
      return "minimal"
    case "short":
      return "light"
    case "medium":
      return "standard"
    case "long":
      return "elevated"
    case "very_long":
      return "maximum"
    default:
      return "unknown"
  }
}

export function suppressLengthOnlyCare(hairLength: HairLength | null | undefined): boolean {
  return hairLength === "very_short"
}
