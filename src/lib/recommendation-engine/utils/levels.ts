import type { DamageLevel } from "@/lib/recommendation-engine/types"

const DAMAGE_LEVEL_RANK: Record<DamageLevel, number> = {
  none: 0,
  low: 1,
  moderate: 2,
  high: 3,
  severe: 4,
}

export function scoreToDamageLevel(score: number): DamageLevel {
  if (score <= 0) return "none"
  if (score <= 1) return "low"
  if (score <= 3) return "moderate"
  if (score <= 5) return "high"
  return "severe"
}

export function maxDamageLevel(...levels: DamageLevel[]): DamageLevel {
  return levels.reduce((current, next) =>
    DAMAGE_LEVEL_RANK[next] > DAMAGE_LEVEL_RANK[current] ? next : current,
  )
}
