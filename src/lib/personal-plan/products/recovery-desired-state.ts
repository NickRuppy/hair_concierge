import type { Stage3AuthoritySemanticIntent } from "./authority/contracts"
import type { Stage3ProductDecision, Stage3ProductDraft } from "./contracts"
import type { Stage3ProductsMutation } from "./gateway"

/** A canonical-only classification that clients can use before one bounded resend. */
export type Stage3DesiredState = "satisfied" | "different" | "missing" | "completed"

export function classifyStage3DesiredState(
  draft: Stage3ProductDraft,
  intent:
    | Stage3ProductsMutation
    | Stage3AuthoritySemanticIntent
    | readonly Stage3AuthoritySemanticIntent[],
): Stage3DesiredState {
  if (draft.status === "completed") return "completed"
  if (isIntentList(intent)) return classifyDecisionIntents(draft, intent)
  if ("action" in intent) return classifyDecisionIntents(draft, [intent])
  if (intent.type === "reopen_capture_category") {
    const categoryDecisionsRemain = draft.decisions.some(
      (decision) => decision.category === intent.category,
    )
    return draft.pass === "product_capture" &&
      draft.categoryCursor === intent.category &&
      !draft.completedCaptureCategories.includes(intent.category) &&
      !categoryDecisionsRemain
      ? "satisfied"
      : "missing"
  }
  return "missing"
}

/** Ignores transport-only revision/timestamp churn when comparing canonical state. */
export function stage3DraftsSemanticallyEqual(left: Stage3ProductDraft, right: Stage3ProductDraft) {
  const project = (draft: Stage3ProductDraft) => ({
    ...draft,
    revision: undefined,
    updatedAt: undefined,
  })
  return JSON.stringify(project(left)) === JSON.stringify(project(right))
}

function classifyDecisionIntents(
  draft: Stage3ProductDraft,
  intents: readonly Stage3AuthoritySemanticIntent[],
): Stage3DesiredState {
  let missing = false
  for (const intent of intents) {
    const decision = draft.decisions.find(
      (candidate) => candidate.decisionKey === intent.subjectKey,
    )
    if (!decision) {
      missing = true
      continue
    }
    if (!decisionMatchesIntent(decision, intent)) return "different"
  }
  return missing ? "missing" : "satisfied"
}

function decisionMatchesIntent(
  decision: Stage3ProductDecision,
  intent: Stage3AuthoritySemanticIntent,
) {
  const action = actionForDecision(decision)
  if (action !== intent.action) return false
  if (intent.action === "select_replacement") {
    return (
      intent.selectedCandidateId !== undefined &&
      decision.recommendation?.productId === intent.selectedCandidateId &&
      intent.selectedCandidateFactFingerprint !== undefined &&
      decision.authorityEvidence?.recommendationFactFingerprint ===
        intent.selectedCandidateFactFingerprint
    )
  }
  return (
    intent.action !== "plan_recommendation" ||
    intent.selectedCandidateId === undefined ||
    decision.recommendation?.productId === intent.selectedCandidateId
  )
}

function actionForDecision(
  decision: Stage3ProductDecision,
): Stage3AuthoritySemanticIntent["action"] {
  if (decision.resolutionAction) return decision.resolutionAction
  switch (decision.choiceState) {
    case "owned_active":
      return "keep_owned"
    case "owned_override":
      return "acknowledge_override"
    case "planned_purchase":
      return "plan_recommendation"
    case "pending_review":
      return "keep_pending"
    case "unassigned":
      return "leave_uncovered"
  }
  throw new Error("unknown Stage 3 choice state")
}

function isIntentList(
  intent:
    | Stage3ProductsMutation
    | Stage3AuthoritySemanticIntent
    | readonly Stage3AuthoritySemanticIntent[],
): intent is readonly Stage3AuthoritySemanticIntent[] {
  return Array.isArray(intent)
}
