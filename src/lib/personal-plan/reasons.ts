import type { PlanReasonFact } from "./types"

export function normalizeReasonSalience(reasons: readonly PlanReasonFact[]): PlanReasonFact[] {
  const seen = new Set<string>()
  let primaryCount = 0
  const normalized: PlanReasonFact[] = []

  for (const reason of reasons) {
    if (seen.has(reason.id)) continue
    seen.add(reason.id)

    if (reason.salience === "primary") {
      if (primaryCount >= 2) {
        normalized.push({ ...reason, salience: "secondary" })
        continue
      }
      primaryCount += 1
    }

    normalized.push(reason)
  }

  return normalized
}
