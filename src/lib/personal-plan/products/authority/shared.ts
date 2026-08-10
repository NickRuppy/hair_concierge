import type { PersonalPlanCategory, Stage3CriterionResult } from "../contracts"
import type {
  Stage3AuthorityEvaluation,
  Stage3AuthorityInput,
  Stage3AuthorityProtocolFact,
  Stage3KnownAuthorityEvaluation,
} from "./contracts"

export function coverageRuleIds<C extends PersonalPlanCategory>(
  input: Stage3AuthorityInput<C>,
): string[] {
  return [...new Set(input.coverage.map((fact) => fact.ruleId))].sort()
}

export function criterion(
  criterionId: string,
  label: string,
  result: Stage3CriterionResult["result"],
  explanation: string,
): Stage3CriterionResult {
  return { criterionId, label, result, explanation }
}

export function unsupportedEvaluation<C extends PersonalPlanCategory>(
  input: Stage3AuthorityInput<C>,
  reason: string,
): Stage3AuthorityEvaluation {
  return {
    status: "unsupported",
    category: input.category,
    subjectKey: input.subjectKey,
    reason,
    allowedActions: [],
    coverageRuleIds: coverageRuleIds(input),
  }
}

export function pendingEvaluation<C extends PersonalPlanCategory>(
  input: Stage3AuthorityInput<C>,
): Stage3AuthorityEvaluation {
  return {
    status: "pending",
    category: input.category,
    subjectKey: input.subjectKey,
    reason: "product_intake_pending",
    allowedActions: ["keep_pending", "leave_uncovered"],
    coverageRuleIds: coverageRuleIds(input),
  }
}

export function unknownEvaluation<C extends PersonalPlanCategory>(
  input: Stage3AuthorityInput<C>,
  missingFacts: string[],
  criteria: Stage3CriterionResult[] = [],
): Stage3AuthorityEvaluation {
  return {
    status: "unknown",
    category: input.category,
    subjectKey: input.subjectKey,
    missingFacts: [...new Set(missingFacts)].sort(),
    criteria,
    allowedActions: ["leave_uncovered"],
    coverageRuleIds: coverageRuleIds(input),
  }
}

export function knownEvaluation<C extends PersonalPlanCategory>(
  input: Stage3AuthorityInput<C>,
  value: Omit<
    Stage3KnownAuthorityEvaluation,
    "status" | "category" | "subjectKey" | "coverageRuleIds"
  >,
): Stage3KnownAuthorityEvaluation {
  return {
    status: "known",
    category: input.category,
    subjectKey: input.subjectKey,
    coverageRuleIds: coverageRuleIds(input),
    ...value,
  }
}

export function protocolForRole<C extends PersonalPlanCategory>(
  input: Stage3AuthorityInput<C>,
): Stage3AuthorityProtocolFact | null {
  return input.productFacts?.protocols.find((protocol) => protocol.role === input.role) ?? null
}

export function commonUnknownFacts<C extends PersonalPlanCategory>(
  input: Stage3AuthorityInput<C>,
  options: { requiresSuitableThickness?: boolean } = {},
): string[] {
  const facts = input.productFacts
  if (!facts) return input.capturedProductId ? ["catalog_product_facts"] : []
  const missing: string[] = []
  if (facts.lifecycleStatus === null) missing.push("lifecycle_status")
  if (
    options.requiresSuitableThickness !== false &&
    (facts.suitableThicknesses === null || facts.suitableThicknesses.length === 0)
  ) {
    missing.push("suitable_thicknesses")
  }
  if (facts.knownReaction === null) missing.push("known_reaction")
  return missing
}

export function isPendingIdentity<C extends PersonalPlanCategory>(
  input: Stage3AuthorityInput<C>,
): boolean {
  return input.subjectIdentity?.kind === "pending_submission"
}

export function hasValidTarget<C extends PersonalPlanCategory>(
  input: Stage3AuthorityInput<C>,
): boolean {
  return input.categoryDecision.target?.category === input.category
}

export function isInactiveOrRetired<C extends PersonalPlanCategory>(
  input: Stage3AuthorityInput<C>,
): boolean {
  const facts = input.productFacts
  return Boolean(facts && (!facts.isActive || facts.lifecycleStatus !== "active"))
}
