import { BONDBUILDER_TIMING_UNMET_RULE_PREFIX } from "@/lib/personal-plan/products/authority/categories/bondbuilder"

import type { RoutinePayloadV1 } from "./contracts"

type RoutineItem = RoutinePayloadV1["items"][number]

const REQUESTED_DE = {
  before_wash: "Vor dem Waschen",
  after_wash: "Nach dem Waschen",
} as const

const ACTUAL_DE = {
  before_wash: "Kommt vor dem Waschen ins Haar.",
  after_wash: "Kommt nach dem Waschen ins Haar.",
  overnight: "Kommt abends ins Haar und bleibt über Nacht drin.",
} as const

/**
 * The one neutral routine-card line for a planned Bondbuilder whose stated timing could not be
 * met (X1): „Nach dem Waschen gerade nicht möglich. Kommt vor dem Waschen ins Haar." No line when
 * the answer is met, for owned products, or when the actual use is unknown. Explicit picks never
 * carry the unmet rule (the gateway persists them as `validated_standalone`).
 */
export function bondbuilderTimingNoteDe(item: RoutineItem): string | null {
  if (item.category !== "bondbuilder" || item.product.kind !== "planned") return null
  const ruleId = item.authorityRuleIds.find((id: string) =>
    id.startsWith(BONDBUILDER_TIMING_UNMET_RULE_PREFIX),
  )
  if (!ruleId) return null
  const [requested, actual] = ruleId.slice(BONDBUILDER_TIMING_UNMET_RULE_PREFIX.length).split(".")
  const requestedDe = REQUESTED_DE[requested as keyof typeof REQUESTED_DE]
  const actualDe = ACTUAL_DE[actual as keyof typeof ACTUAL_DE]
  if (!requestedDe || !actualDe || requested === actual) return null
  return `${requestedDe} gerade nicht möglich. ${actualDe}`
}
