import type {
  Stage3AuthorityActionKind,
  Stage3AuthorityEvaluation,
  Stage3AuthoritySemanticIntent,
} from "@/lib/personal-plan/products/authority/contracts"
import {
  deriveStage3DecisionSubjects,
  type Stage3ProductDraft,
} from "@/lib/personal-plan/products/contracts"

type DecisionSubject = ReturnType<typeof deriveStage3DecisionSubjects>[number]

export type Stage3AutomaticOutcome = {
  subject: DecisionSubject
  action: Stage3AuthorityActionKind
}

export type Stage3ClearFit = {
  subject: DecisionSubject
  evaluation: Extract<Stage3AuthorityEvaluation, { status: "known" }>
}

export function automaticOilAuthorityAction(
  subject: DecisionSubject,
  evaluation: Stage3AuthorityEvaluation,
): Stage3AuthorityActionKind | null {
  if (subject.category !== "oil" || evaluation.allowedActions.length !== 1) return null
  const action = evaluation.allowedActions[0]
  if (action === "keep_owned" && evaluation.status === "known" && evaluation.verdict === "ideal") {
    return action
  }
  if (action === "keep_pending" && evaluation.status === "pending") return action
  if (action === "leave_uncovered" && subject.subjectKind === "uncovered_role") return action
  return null
}

export function unresolvedDecisionSubjects(draft: Stage3ProductDraft): DecisionSubject[] {
  return deriveStage3DecisionSubjects(draft).filter(
    (subject) => !draft.decisions.some((decision) => decision.decisionKey === subject.decisionKey),
  )
}

export function hasUnresolvedDecisionSubjects(draft: Stage3ProductDraft): boolean {
  return unresolvedDecisionSubjects(draft).length > 0
}

export function automaticAuthorityOutcomes(
  draft: Stage3ProductDraft,
  evaluations: Stage3AuthorityEvaluation[],
): Stage3AutomaticOutcome[] {
  return unresolvedDecisionSubjects(draft).flatMap((subject) => {
    const evaluation = evaluations.find((candidate) => candidate.subjectKey === subject.decisionKey)
    const action = evaluation ? automaticOilAuthorityAction(subject, evaluation) : null
    return evaluation && action ? [{ subject, action }] : []
  })
}

export function clearFitDecisions(
  draft: Stage3ProductDraft,
  evaluations: Stage3AuthorityEvaluation[],
): Stage3ClearFit[] {
  return unresolvedDecisionSubjects(draft)
    .map((subject) => ({
      subject,
      evaluation: evaluations.find((candidate) => candidate.subjectKey === subject.decisionKey),
    }))
    .filter(
      (item): item is Stage3ClearFit =>
        item.evaluation?.status === "known" &&
        item.evaluation.verdict === "ideal" &&
        item.evaluation.allowedActions.includes("keep_owned"),
    )
}

export function authorityDecisionIntent(
  subjectKey: string,
  action: Stage3AuthoritySemanticIntent["action"],
  selectedCandidateId?: string,
): Stage3AuthoritySemanticIntent {
  return {
    type: "resolve_decision",
    subjectKey,
    action,
    ...((action === "plan_recommendation" || action === "select_replacement") && selectedCandidateId
      ? { selectedCandidateId }
      : {}),
  }
}

export function automaticOutcomeIntents(
  outcomes: Stage3AutomaticOutcome[],
): Stage3AuthoritySemanticIntent[] {
  return outcomes.map(({ subject, action }) => authorityDecisionIntent(subject.decisionKey, action))
}
