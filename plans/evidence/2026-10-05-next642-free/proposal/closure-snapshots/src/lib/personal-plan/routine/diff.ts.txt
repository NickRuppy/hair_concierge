import { canonicalJson } from "./canonicalize"
import type {
  RoutineCompiledPayload,
  RoutineEditOperation,
  RoutineProposalDelta,
} from "../routine-candidate-compiler"

function touched(operation: RoutineEditOperation): string {
  return operation.kind === "category_inclusion"
    ? `category:${operation.category}`
    : operation.assignmentKey
}

function explanation(operation: RoutineEditOperation): string {
  return `personal_plan.routine.edit.${operation.kind}`
}

export function diffRoutinePayloads(
  previous: RoutineCompiledPayload,
  next: RoutineCompiledPayload,
  operations: readonly RoutineEditOperation[],
): RoutineProposalDelta {
  const operationByKey = new Map(operations.map((operation) => [touched(operation), operation]))
  const previousItems = new Map(previous.items.map((item) => [item.itemKey, item]))
  const nextItems = new Map(next.items.map((item) => [item.itemKey, item]))
  const direct: RoutineProposalDelta["direct"] = []
  const consequential: RoutineProposalDelta["consequential"] = []
  let unchangedItemCount = 0
  const keys = new Set([...previousItems.keys(), ...nextItems.keys()])
  for (const key of [...keys].sort()) {
    const before = previousItems.get(key)
    const after = nextItems.get(key)
    if (before && after && canonicalJson(before) === canonicalJson(after)) {
      unchangedItemCount += 1
      continue
    }
    const operation = operationByKey.get(before?.assignmentKey ?? after?.assignmentKey ?? "")
    const change = {
      kind: before && after ? "changed" : before ? "removed" : "added",
      itemKey: key,
      explanationKey: operation ? explanation(operation) : "personal_plan.routine.recomputed",
    } as const
    ;(operation ? direct : consequential).push(change)
  }
  for (const operation of operations.filter((entry) => entry.kind === "category_inclusion")) {
    const key = touched(operation)
    const before = previous.intent.categories.find(
      (category) => category.category === operation.category,
    )
    const after = next.intent.categories.find(
      (category) => category.category === operation.category,
    )
    if (before && after && before.inclusion !== after.inclusion)
      direct.push({ kind: "changed", itemKey: key, explanationKey: explanation(operation) })
  }
  return { schemaVersion: 1, direct, consequential, unchangedItemCount }
}
