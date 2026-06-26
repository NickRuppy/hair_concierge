import { BRUSH_TYPES, type BrushType } from "@/lib/vocabulary"

const MECHANICAL_STRESS_DRIVER_BY_BRUSH: Partial<Record<BrushType, string>> = {
  paddle: "high_stress_brush",
  round: "high_stress_brush",
}

const FRICTION_SIGNAL_BRUSHES = new Set<BrushType>(["paddle", "round", "boar_bristle"])

const MECHANICAL_STRESS_SCORE_BY_BRUSH: Partial<Record<BrushType, number>> = {
  paddle: 1,
  round: 1,
}

const VALID_BRUSH_TYPES = new Set<string>(BRUSH_TYPES)

function uniqueBrushTypes(brushTypes: readonly BrushType[]): BrushType[] {
  return [...new Set(brushTypes)]
}

export function normalizeBrushTypeValues(value: unknown): BrushType[] | null {
  if (value === null || value === undefined) return null
  if (value === "none_regular") return []
  if (Array.isArray(value)) {
    return uniqueBrushTypes(
      value.filter((item): item is BrushType => VALID_BRUSH_TYPES.has(String(item))),
    )
  }
  if (typeof value === "string" && VALID_BRUSH_TYPES.has(value)) return [value as BrushType]
  return null
}

export function hasMechanicalStressBrush(
  brushTypes: readonly BrushType[] | null | undefined,
): boolean {
  return Boolean(brushTypes?.some((brushType) => brushType in MECHANICAL_STRESS_SCORE_BY_BRUSH))
}

export function hasBrushFrictionSignal(
  brushTypes: readonly BrushType[] | null | undefined,
): boolean {
  return Boolean(brushTypes?.some((brushType) => FRICTION_SIGNAL_BRUSHES.has(brushType)))
}

export function getBrushMechanicalStressContribution(
  brushTypes: readonly BrushType[] | null | undefined,
): { score: number; drivers: string[] } {
  const uniqueBrushes = uniqueBrushTypes(brushTypes ?? [])
  const drivers = [
    ...new Set(
      uniqueBrushes
        .map((brushType) => MECHANICAL_STRESS_DRIVER_BY_BRUSH[brushType])
        .filter((driver): driver is string => Boolean(driver)),
    ),
  ]
  const score = uniqueBrushes.reduce(
    (total, brushType) => total + (MECHANICAL_STRESS_SCORE_BY_BRUSH[brushType] ?? 0),
    0,
  )

  return {
    score: Math.min(score, 2),
    drivers,
  }
}
