import type { Stage3CriterionResult } from "../contracts"
import { CATEGORY_ROLE_POLICIES } from "../authorities"
import type { Stage3AuthorityInput, Stage3CategoryProductFacts } from "./contracts"
import type { FitAxis, FitAxisReasonInput, FitGate } from "./fit-evaluator"
import { evaluateFit } from "./fit-evaluator"
import { commonUnknownFacts, criterion } from "./shared"

export const THICKNESSES = ["fine", "normal", "coarse"] as const
export const WEIGHTS = ["light", "medium", "rich"] as const
export const CARE_DIRECTIONS = ["protein", "balanced", "moisture"] as const

// Catalogs store the middle weight as medium and strong cleansing as clarifying.
export function cleansingValue(value: string | null): string | null {
  return value === "clarifying" ? "strong" : value
}

export function directionalReason(scale: readonly string[], higher: string, lower: string) {
  return ({ productValues, target }: FitAxisReasonInput): string => {
    let nearest = Infinity
    let delta = 0
    for (const product of productValues)
      for (const wanted of target) {
        const difference = scale.indexOf(product) - scale.indexOf(wanted)
        if (Math.abs(difference) < nearest) {
          nearest = Math.abs(difference)
          delta = difference
        }
      }
    return delta > 0 ? higher : lower
  }
}

export const thicknessReason = directionalReason(
  THICKNESSES,
  "Eher für kräftigeres Haar gedacht",
  "Eher für feines Haar gedacht",
)
export const weightReason = directionalReason(
  WEIGHTS,
  "Für dein Haar eher schwer",
  "Für dein Haar eher leicht",
)
export const careDirectionReason = directionalReason(
  CARE_DIRECTIONS,
  "Mehr Feuchtigkeit als dein Haar gerade braucht",
  "Mehr Protein als dein Haar gerade braucht",
)

export function commonFitGates(
  input: Pick<Stage3AuthorityInput, "category" | "role" | "capturedProductId">,
  facts: Stage3CategoryProductFacts,
): FitGate[] {
  const prefix = input.category
  const protocol = facts.protocols.find((item) => item.role === input.role)
  return [
    {
      id: `${prefix}.safety`,
      label: "Verträglichkeit",
      outcome: facts.knownReaction === null ? "unknown" : facts.knownReaction ? "fail" : "pass",
      reason: "Für dieses Produkt ist eine Unverträglichkeit bekannt.",
    },
    {
      id: `${prefix}.lifecycle`,
      label: "Verfügbarkeit",
      outcome:
        !facts.isActive ||
        // Owned oils can be usable without being eligible for new recommendations.
        (!facts.recommendable &&
          !(input.category === "oil" && input.capturedProductId === facts.productId)) ||
        (facts.lifecycleStatus !== null && facts.lifecycleStatus !== "active")
          ? "fail"
          : facts.lifecycleStatus === null
            ? "unknown"
            : "pass",
      reason: "Das Produkt ist nicht aktiv verfügbar.",
    },
    {
      id: "verified_protocol",
      label: "Anwendungsprotokoll",
      outcome: protocol?.status === "verified_complete" ? "pass" : "unknown",
    },
  ]
}

export function evaluateCriteria(
  input: Pick<Stage3AuthorityInput, "category" | "role" | "capturedProductId">,
  facts: Stage3CategoryProductFacts,
  gates: FitGate[],
  axes: FitAxis[],
  missingFactKeys: Record<string, string[]> = {},
) {
  const missing = commonUnknownFacts({ ...input, productFacts: facts } as Stage3AuthorityInput)
  const evaluation = evaluateFit({
    gates: [...gates, ...missing.map((id): FitGate => ({ id, label: id, outcome: "unknown" }))],
    axes,
  })
  // Criterion IDs are internal; missing-fact names are a scanner/native wire contract.
  const wireKeys: Record<string, string[]> = {
    [`${input.category}.safety`]: ["known_reaction"],
    [`${input.category}.lifecycle`]: ["lifecycle_status"],
    ...missingFactKeys,
  }
  for (const gate of gates)
    if (gate.outcome === "unknown") missing.push(...(wireKeys[gate.id] ?? [gate.id]))
  for (const axis of evaluation.axisOutcomes)
    if (axis.steps === null) missing.push(...(wireKeys[axis.id] ?? [axis.id]))
  const criteria = [
    ...gates
      .filter((gate) => gate.outcome === "fail")
      .map((gate) => criterion(gate.id, gate.label, "fail", gate.reason ?? gate.label)),
    ...evaluation.axisOutcomes.map((outcome, index) =>
      criterion(
        outcome.id,
        axes[index].label,
        outcome.steps === null
          ? "unknown"
          : outcome.steps === 0
            ? "pass"
            : outcome.steps === 1
              ? "caution"
              : "fail",
        outcome.reason ??
          (outcome.steps === 0 ? "Entspricht deinem Bedarf." : "Noch nicht geprüft."),
      ),
    ),
  ]
  return {
    verdict: evaluation.verdict,
    missing,
    criteria:
      evaluation.verdict === "mismatch"
        ? criteria.filter((item) => item.result !== "pass")
        : criteria,
  }
}

/** Gates-only adapters retain their existing criterion rows and missing-fact wire keys.
 * Spec §§2–4, ruled 2026-10-12: a known failed gate wins over incomplete facts.
 */
export function evaluateGateCriteria(
  input: Pick<Stage3AuthorityInput, "category" | "role" | "capturedProductId">,
  facts: Stage3CategoryProductFacts,
  criteria: Stage3CriterionResult[],
  missing: string[],
  axes: FitAxis[] = [],
) {
  const prefix = input.category === "deep_cleansing_shampoo" ? "deep_cleansing" : input.category
  const common = commonFitGates(input, facts)
    .filter((gate) => gate.id !== "verified_protocol")
    .map((gate) => ({ ...gate, id: gate.id.replace(input.category, prefix) }))
  const gates: FitGate[] = [
    ...common,
    {
      id: `${prefix}.category`,
      label: "Produktrolle",
      outcome: facts.category === input.category ? "pass" : "fail",
      reason: "Das Produkt deckt diese Produktrolle nicht ab.",
    },
    {
      id: `${prefix}.role`,
      label: "Produktrolle",
      outcome: CATEGORY_ROLE_POLICIES[input.category].allowedRoles.some(
        (role) => role === input.role,
      )
        ? "pass"
        : "fail",
      reason: "Das Produkt deckt diese Produktrolle nicht ab.",
    },
    ...criteria
      .filter((row) => !axes.some((axis) => axis.id === row.criterionId))
      .map((row) => ({
        id: row.criterionId,
        label: row.label,
        outcome: row.result === "caution" ? ("pass" as const) : row.result,
        reason: row.explanation,
      })),
    ...missing.map((id) => ({ id, label: id, outcome: "unknown" as const })),
  ]
  const evaluation = evaluateFit({ gates, axes })
  const rows = [...criteria]
  for (const gate of gates) {
    if (
      gate.outcome === "fail" &&
      !rows.some((row) => row.criterionId === gate.id && row.result === "fail")
    )
      rows.push(criterion(gate.id, gate.label, "fail", gate.reason ?? gate.label))
  }
  for (const outcome of evaluation.axisOutcomes) {
    const row = rows.find((row) => row.criterionId === outcome.id)
    if (!row) continue
    row.result =
      outcome.steps === null
        ? "unknown"
        : outcome.steps === 0
          ? "pass"
          : outcome.steps === 1
            ? "caution"
            : "fail"
    if (outcome.reason) row.explanation = outcome.reason
  }
  return { verdict: evaluation.verdict, criteria: rows, missing }
}
