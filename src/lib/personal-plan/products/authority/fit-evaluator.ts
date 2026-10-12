import type { Stage3FitVerdict } from "../contracts"

export type FitGate = {
  id: string
  label: string
  outcome: "pass" | "fail" | "unknown"
  reason?: string
}

export type FitAxis = {
  id: string
  label: string
  scale: readonly string[]
  productValues: readonly string[] | null
  direction?: "symmetric" | "at_or_above_is_zero"
} & (
  | { targetValue: string | null; acceptedTargets?: never }
  | { acceptedTargets: readonly string[]; targetValue?: never }
)

export type FitEvaluationInput = {
  gates: readonly FitGate[]
  axes: readonly FitAxis[]
}

export type FitAxisOutcome = {
  id: string
  steps: number | null
  reason?: string
}

export type FitEvaluation = {
  verdict: Stage3FitVerdict
  /** Sum of known step distances, rather than the number of non-zero axes. */
  missCount: number
  axisOutcomes: FitAxisOutcome[]
  reasons: string[]
}

function axisSteps(axis: FitAxis): number | null {
  const targets = axis.acceptedTargets ?? (axis.targetValue == null ? [] : [axis.targetValue])
  if (!axis.productValues?.length || !targets.length) return null

  const productIndices = axis.productValues.map((value) => axis.scale.indexOf(value))
  const targetIndices = targets.map((value) => axis.scale.indexOf(value))
  // An unrecognised member is a missing fact, even beside recognised members.
  if (productIndices.includes(-1) || targetIndices.includes(-1)) return null

  let nearest = Infinity
  for (const productIndex of productIndices) {
    for (const targetIndex of targetIndices) {
      const distance =
        axis.direction === "at_or_above_is_zero"
          ? Math.max(0, targetIndex - productIndex)
          : Math.abs(productIndex - targetIndex)
      nearest = Math.min(nearest, distance)
    }
  }
  return nearest
}

/**
 * Spec §4, ruled 2026-10-12: failed gates win, then a known additive
 * distance >= 2 wins, then missing facts yield unknown. Ideal/supportive
 * require complete facts; a known mismatch cannot be rescued by missing data.
 * Reasons retain gate input order followed by axis input order.
 */
export function evaluateFit(input: FitEvaluationInput): FitEvaluation {
  const failedGates = input.gates.filter((gate) => gate.outcome === "fail")
  const reasons = failedGates.map((gate) => gate.reason ?? gate.label)
  const axisOutcomes = input.axes.map((axis): FitAxisOutcome => {
    const steps = axisSteps(axis)
    if (steps === null || steps === 0) return { id: axis.id, steps }
    const reason = `${axis.label}: ${steps} ${steps === 1 ? "Schritt" : "Schritte"} vom Ziel entfernt.`
    reasons.push(reason)
    return { id: axis.id, steps, reason }
  })
  const missCount = axisOutcomes.reduce((sum, axis) => sum + (axis.steps ?? 0), 0)
  const hasMissingFacts =
    input.gates.some((gate) => gate.outcome === "unknown") ||
    axisOutcomes.some((axis) => axis.steps === null)
  const verdict: Stage3FitVerdict =
    failedGates.length > 0 || missCount >= 2
      ? "mismatch"
      : hasMissingFacts
        ? "unknown"
        : missCount === 1
          ? "supportive"
          : "ideal"
  return { verdict, missCount, axisOutcomes, reasons }
}
