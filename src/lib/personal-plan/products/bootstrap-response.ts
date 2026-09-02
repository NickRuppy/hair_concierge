import { z } from "zod"

import type { Stage3AuthorityEvaluation } from "./authority/contracts"
import { stage3CategoryRequirementSchema, stage3ProductDraftSchema } from "./contracts"
import type { Stage3FitComparison } from "./fit-comparison"
import type { Stage3BootstrapResponse } from "./gateway"
import { hasCompleteStage3DecisionReviews } from "./stage3-bootstrap-review-contract"

export const STAGE3_BOOTSTRAP_CONTRACT_VIOLATIONS = [
  "invalid_envelope",
  "invalid_draft",
  "invalid_requirements",
  "missing_authority_evaluations",
  "missing_fit_comparisons",
  "invalid_catalog_thumbnails",
  "status_mismatch",
  "plan_mismatch",
  "refined_version_mismatch",
  "missing_authority_snapshot",
  "incomplete_decision_reviews",
] as const

export type Stage3BootstrapContractViolation = (typeof STAGE3_BOOTSTRAP_CONTRACT_VIOLATIONS)[number]

export function isStage3BootstrapContractViolation(
  value: unknown,
): value is Stage3BootstrapContractViolation {
  return (
    typeof value === "string" &&
    STAGE3_BOOTSTRAP_CONTRACT_VIOLATIONS.includes(value as Stage3BootstrapContractViolation)
  )
}

export class Stage3BootstrapContractError extends Error {
  constructor(public readonly violation: Stage3BootstrapContractViolation) {
    super("stage3_bootstrap_contract_violation")
    this.name = "Stage3BootstrapContractError"
  }
}

export function parseStage3BootstrapResponse(
  value: unknown,
  expected: { personalPlanId: string; refinedVersionId: string },
): Stage3BootstrapResponse {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Stage3BootstrapContractError("invalid_envelope")
  }
  const candidate = value as Record<string, unknown>
  const draft = stage3ProductDraftSchema.safeParse(candidate.draft)
  if (!draft.success) throw new Stage3BootstrapContractError("invalid_draft")
  const requirements = z.array(stage3CategoryRequirementSchema).safeParse(candidate.requirements)
  if (!requirements.success) {
    throw new Stage3BootstrapContractError("invalid_requirements")
  }
  if (!Array.isArray(candidate.authorityEvaluations)) {
    throw new Stage3BootstrapContractError("missing_authority_evaluations")
  }
  if (!Array.isArray(candidate.fitComparisons)) {
    throw new Stage3BootstrapContractError("missing_fit_comparisons")
  }
  if (
    candidate.catalogThumbnails !== undefined &&
    (!candidate.catalogThumbnails ||
      typeof candidate.catalogThumbnails !== "object" ||
      Array.isArray(candidate.catalogThumbnails) ||
      Object.values(candidate.catalogThumbnails).some((item) => typeof item !== "string"))
  ) {
    throw new Stage3BootstrapContractError("invalid_catalog_thumbnails")
  }
  if (candidate.status !== draft.data.status) {
    throw new Stage3BootstrapContractError("status_mismatch")
  }
  if (draft.data.personalPlanId !== expected.personalPlanId) {
    throw new Stage3BootstrapContractError("plan_mismatch")
  }
  if (draft.data.refinedVersionId !== expected.refinedVersionId) {
    throw new Stage3BootstrapContractError("refined_version_mismatch")
  }
  if (!draft.data.authoritySnapshot) {
    throw new Stage3BootstrapContractError("missing_authority_snapshot")
  }
  if (
    !hasCompleteStage3DecisionReviews({
      draft: draft.data,
      authorityEvaluations: candidate.authorityEvaluations as Stage3AuthorityEvaluation[],
      fitComparisons: candidate.fitComparisons as Stage3FitComparison[],
    })
  ) {
    throw new Stage3BootstrapContractError("incomplete_decision_reviews")
  }

  return {
    status: draft.data.status,
    draft: draft.data,
    requirements: requirements.data,
    authorityEvaluations: candidate.authorityEvaluations as Stage3AuthorityEvaluation[],
    fitComparisons: candidate.fitComparisons as Stage3FitComparison[],
    ...(candidate.catalogThumbnails
      ? { catalogThumbnails: candidate.catalogThumbnails as Record<string, string> }
      : {}),
  }
}
