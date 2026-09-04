import type { Stage3AuthoritySemanticIntent } from "@/lib/personal-plan/products/authority/contracts"
import type { Stage3DecisionReviewProjection } from "@/lib/personal-plan/products/gateway"
import type { Stage3ReviewDraftChoice } from "@/lib/personal-plan/products/review-draft"

type PreviewSubject = { decisionKey: string; category: string }

export type Stage3PreviewReconciliation = {
  choices: Record<string, Stage3ReviewDraftChoice>
  order: string[]
  locallyResolvedDecisionKeys: ReadonlySet<string>
  autoResolvedIntents: Stage3AuthoritySemanticIntent[]
}

export function clearDependentHeatReviewStateOnOilChange(input: {
  changedLeaveOnOil: boolean
  subjects: PreviewSubject[]
  choices: Record<string, Stage3ReviewDraftChoice>
  order: string[]
}): Pick<Stage3PreviewReconciliation, "choices" | "order"> {
  if (!input.changedLeaveOnOil) return { choices: input.choices, order: input.order }
  const heatDecisionKeys = new Set(
    input.subjects
      .filter((subject) => subject.category === "heat_protectant")
      .map((subject) => subject.decisionKey),
  )
  return {
    choices: Object.fromEntries(
      Object.entries(input.choices).filter(([decisionKey]) => !heatDecisionKeys.has(decisionKey)),
    ) as Record<string, Stage3ReviewDraftChoice>,
    order: input.order.filter((decisionKey) => !heatDecisionKeys.has(decisionKey)),
  }
}

export function isCurrentStage3PreviewGeneration(
  responseGeneration: number,
  currentGeneration: number,
): boolean {
  return responseGeneration === currentGeneration
}

/** Whether the changed local choices need a fresh server projection. */
export function shouldRefreshStage3Preview(input: {
  choices: Record<string, Stage3ReviewDraftChoice>
  leaveOnOilDecisionKeys: ReadonlySet<string>
  changedDecisionKeys: readonly string[]
}): boolean {
  const changedLeaveOnOil = input.changedDecisionKeys.some((key) =>
    input.leaveOnOilDecisionKeys.has(key),
  )
  const hasPlannedLeaveOnOil = [...input.leaveOnOilDecisionKeys].some((key) => {
    const choice = input.choices[key]
    return (
      choice?.kind === "decision" &&
      (choice.intent.action === "plan_recommendation" ||
        choice.intent.action === "select_replacement")
    )
  })
  return changedLeaveOnOil || hasPlannedLeaveOnOil
}

/**
 * Applies a server-authored read-only projection to local review state. The
 * browser merely carries an exact auto intent; it never infers Oil/Heat
 * capability or coverage itself.
 */
export function reconcileStage3PreviewProjection(input: {
  subjects: PreviewSubject[]
  choices: Record<string, Stage3ReviewDraftChoice>
  order: string[]
  previousAutoResolvedIntents: Stage3AuthoritySemanticIntent[]
  projection: Extract<Stage3DecisionReviewProjection, { status: "ready" }>
}): Stage3PreviewReconciliation {
  const autoKeys = new Set(input.projection.autoResolvedIntents.map((intent) => intent.subjectKey))
  const previousAutoKeys = new Set(
    input.previousAutoResolvedIntents.map((intent) => intent.subjectKey),
  )
  const choices = Object.fromEntries(
    Object.entries(input.choices).filter(([decisionKey]) => !previousAutoKeys.has(decisionKey)),
  ) as Record<string, Stage3ReviewDraftChoice>
  const order = [...new Set([...input.order, ...Object.keys(choices)])].filter(
    (decisionKey) =>
      (!previousAutoKeys.has(decisionKey) || autoKeys.has(decisionKey)) &&
      Boolean(choices[decisionKey]),
  )

  return {
    choices,
    order,
    locallyResolvedDecisionKeys: new Set(
      input.subjects
        .filter((subject) => autoKeys.has(subject.decisionKey))
        .map((subject) => subject.decisionKey),
    ),
    autoResolvedIntents: input.projection.autoResolvedIntents,
  }
}

export function stage3ProjectedFinalDecisionIntents(
  choices: Record<string, Stage3ReviewDraftChoice>,
  visibleDecisionKeys: string[],
  autoResolvedIntents: Stage3AuthoritySemanticIntent[],
): Stage3AuthoritySemanticIntent[] {
  return [
    ...visibleDecisionKeys.flatMap((decisionKey) => {
      const choice = choices[decisionKey]
      return choice?.kind === "decision" ? [choice.intent] : []
    }),
    ...autoResolvedIntents,
  ]
}
