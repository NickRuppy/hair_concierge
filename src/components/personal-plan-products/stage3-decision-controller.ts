import type { Stage3AuthoritySemanticIntent } from "@/lib/personal-plan/products/authority/contracts"
import {
  deriveStage3DecisionSubjects,
  type Stage3ProductDraft,
} from "@/lib/personal-plan/products/contracts"

type DecisionSubject = ReturnType<typeof deriveStage3DecisionSubjects>[number]

export function unresolvedDecisionSubjects(draft: Stage3ProductDraft): DecisionSubject[] {
  return deriveStage3DecisionSubjects(draft).filter(
    (subject) =>
      subject.subjectKind === "inventory_disposition"
        ? !draft.inventoryDispositions?.some(
            (disposition) =>
              disposition.dispositionKey === subject.decisionKey && disposition.acknowledged,
          )
        : !draft.decisions.some((decision) => decision.decisionKey === subject.decisionKey),
  )
}

export function hasUnresolvedDecisionSubjects(draft: Stage3ProductDraft): boolean {
  return unresolvedDecisionSubjects(draft).length > 0
}

export function authorityDecisionIntent(
  subjectKey: string,
  action: Stage3AuthoritySemanticIntent["action"],
  selectedCandidateId?: string,
  selectedCandidateFactFingerprint?: string,
): Stage3AuthoritySemanticIntent {
  if (
    action === "select_replacement" &&
    (!selectedCandidateId || !selectedCandidateFactFingerprint)
  ) {
    throw new Error("select_replacement requires the viewed candidate and fact fingerprint")
  }
  if (action !== "select_replacement" && selectedCandidateFactFingerprint) {
    throw new Error("candidate fact fingerprint is only valid for select_replacement")
  }
  return {
    type: "resolve_decision",
    subjectKey,
    action,
    ...((action === "plan_recommendation" || action === "select_replacement") && selectedCandidateId
      ? { selectedCandidateId }
      : {}),
    ...(action === "select_replacement" && selectedCandidateFactFingerprint
      ? { selectedCandidateFactFingerprint }
      : {}),
  }
}
