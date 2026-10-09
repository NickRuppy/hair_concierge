import type { Stage3AuthoritySemanticIntent } from "@/lib/personal-plan/products/authority/contracts"
import type { Stage3FitComparison } from "@/lib/personal-plan/products/fit-comparison"
import type { Stage3AuthorityEvaluation } from "@/lib/personal-plan/products/authority/contracts"
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

/**
 * Whether the changed local choices need a fresh server projection. With a saved budget the server
 * allocates it over the whole proposal, so every changed product decision (plan, keep, skip) can
 * move other roles' defaults and allowance. Without a budget only Oil can move Heat.
 */
export function shouldRefreshStage3Preview(input: {
  choices: Record<string, Stage3ReviewDraftChoice>
  leaveOnOilDecisionKeys: ReadonlySet<string>
  changedDecisionKeys: readonly string[]
  budgetActive?: boolean
}): boolean {
  if (
    input.budgetActive &&
    input.changedDecisionKeys.some((key) => input.choices[key]?.kind === "decision")
  ) {
    return true
  }
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

export type Stage3PreviewReviewBundle = {
  authorityEvaluation: Stage3AuthorityEvaluation
  fitComparison: Stage3FitComparison
}

/**
 * Merges a read-only projection into the visible review bundles. Without a budget the projection
 * only re-evaluates Heat after a local Oil selection; every other bundle stays the server
 * snapshot. With a budget every returned role bundle replaces its predecessor, because the budget
 * allocation spans the whole proposal.
 */
export function mergeStage3PreviewBundles(input: {
  current: ReadonlyMap<string, Stage3PreviewReviewBundle>
  projection: Extract<Stage3DecisionReviewProjection, { status: "ready" }>
  budgetActive: boolean
}): Map<string, Stage3PreviewReviewBundle> {
  return new Map([
    ...input.current,
    ...input.projection.bundles
      .filter(
        (bundle) => input.budgetActive || bundle.authorityEvaluation.category === "heat_protectant",
      )
      .map((bundle) => [bundle.authorityEvaluation.subjectKey, bundle] as const),
  ])
}

/** Whether a pending local decision is still offered by the current review bundle. */
export function stage3DecisionIntentStillAllowed(
  reviews: ReadonlyMap<string, Stage3PreviewReviewBundle>,
  intent: Stage3AuthoritySemanticIntent,
) {
  const review = reviews.get(intent.subjectKey)
  const evaluation = review?.authorityEvaluation
  if (intent.action === "select_replacement") {
    return Boolean(
      review?.fitComparison.alternatives.some(
        (candidate) =>
          candidate.productId === intent.selectedCandidateId &&
          candidate.factFingerprint === intent.selectedCandidateFactFingerprint,
      ),
    )
  }
  if (!evaluation?.allowedActions.some((allowedAction) => allowedAction === intent.action)) {
    return false
  }
  if (intent.action !== "plan_recommendation") return true
  if (!intent.selectedCandidateId) return false
  return (
    evaluation.status === "known" &&
    evaluation.recommendation?.productId === intent.selectedCandidateId
  )
}

/**
 * Keeps every pending choice the refreshed bundles still allow. A user's own choice is never
 * replaced by a new default; it is dropped only when its role no longer offers it.
 */
export function retainStage3ChoicesAllowedByBundles(input: {
  choices: Record<string, Stage3ReviewDraftChoice>
  order: string[]
  reviews: ReadonlyMap<string, Stage3PreviewReviewBundle>
}): { choices: Record<string, Stage3ReviewDraftChoice>; order: string[]; droppedKeys: string[] } {
  const choices: Record<string, Stage3ReviewDraftChoice> = {}
  const dropped = new Set<string>()
  for (const [decisionKey, choice] of Object.entries(input.choices)) {
    if (
      choice.kind !== "decision" ||
      stage3DecisionIntentStillAllowed(input.reviews, choice.intent)
    )
      choices[decisionKey] = choice
    else dropped.add(decisionKey)
  }
  return {
    choices,
    order: input.order.filter((decisionKey) => Boolean(choices[decisionKey])),
    // Review order first, so the earliest invalidated decision reopens first.
    droppedKeys: [
      ...input.order.filter((decisionKey) => dropped.has(decisionKey)),
      ...[...dropped].filter((decisionKey) => !input.order.includes(decisionKey)),
    ],
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
