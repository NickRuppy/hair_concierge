import type {
  Stage3CompleteResponse,
  Stage3DraftResponse,
  Stage3MutationResponse,
  Stage3ProductsGateway,
  Stage3ProductsMutation,
  Stage3SearchResponse,
} from "./gateway"
import type {
  Stage3AuthorityEvaluation,
  Stage3AuthoritySemanticIntent,
} from "./authority/contracts"
import {
  deriveStage3DecisionSubjects,
  stage3CategoryRequirementSchema,
  type PersonalPlanCategory,
  type Stage3CatalogCandidate,
  type Stage3CategoryRequirement,
  type Stage3DecisionSubject,
  type Stage3ProductDecision,
  type Stage3ProductDraft,
} from "./contracts"
import { createProposedProductPortfolio } from "./portfolio"
import {
  addCapturedProduct,
  assignProductRoles,
  completeCaptureCategory,
  createStage3Draft,
  invalidateDraftForRefinedVersion,
  markRoleUncovered,
  recordProductDecision,
  removeCapturedProduct,
  replaceCategoryRoleAssignments,
  reopenCaptureCategory,
} from "./state-machine"

export type { Stage3CategoryRequirement } from "./contracts"

const DEFAULT_SEARCH_DELAY_MS = 250
const MAX_SEARCH_CANDIDATES = 8

type FixtureCatalogRecord = Stage3CatalogCandidate

const FIXTURE_CATALOG: FixtureCatalogRecord[] = [
  {
    candidateId: "fixture-candidate-shampoo-1",
    productId: "fixture-product-shampoo-1",
    displayName: "Sanftes Feuchtigkeits-Shampoo",
    category: "shampoo",
    brandName: "Chaarlie Fixture",
    confidence: "exact",
  },
  {
    candidateId: "fixture-candidate-conditioner-1",
    productId: "fixture-product-conditioner-1",
    displayName: "Conditioner Balance",
    category: "conditioner",
    brandName: "Chaarlie Fixture",
    confidence: "exact",
  },
  {
    candidateId: "fixture-candidate-conditioner-2",
    productId: "fixture-product-conditioner-2",
    displayName: "Conditioner Soft Care",
    category: "conditioner",
    brandName: "Chaarlie Fixture",
    confidence: "likely",
  },
  {
    candidateId: "fixture-candidate-oil-1",
    productId: "fixture-product-oil-1",
    displayName: "Oil Length Seal",
    category: "oil",
    brandName: "Chaarlie Fixture",
    confidence: "exact",
  },
  {
    candidateId: "fixture-candidate-scalp-1",
    productId: "fixture-product-scalp-1",
    displayName: "Scalp Care Serum",
    category: "scalp_care",
    brandName: "Chaarlie Fixture",
    confidence: "exact",
  },
  {
    candidateId: "fixture-candidate-heat-protectant-1",
    productId: "fixture-product-heat-protectant-1",
    displayName: "Hitzeschutz-Spray",
    category: "heat_protectant",
    brandName: "Chaarlie Fixture",
    confidence: "exact",
  },
]

export type FixtureGatewayFailureOperation = "search" | "mutate" | "complete"

export type FixtureStage3GatewayOptions = {
  now?: () => string
  searchDelayMs?: number
  /** Each named operation rejects once, then returns to its normal fixture behavior. */
  failOnce?: readonly FixtureGatewayFailureOperation[]
}

export class FixtureGatewaySimulatedError extends Error {
  readonly operation: FixtureGatewayFailureOperation

  constructor(operation: FixtureGatewayFailureOperation) {
    super(`fixture ${operation} failure`)
    this.name = "FixtureGatewaySimulatedError"
    this.operation = operation
  }
}

type LoadOrCreateInput = {
  draftId: string
  userId: string
  personalPlanId: string
  refinedVersionId: string
  requirements: Stage3CategoryRequirement[]
}

export type FixtureDraftResponse = Stage3DraftResponse

export type FixtureSearchResponse = Stage3SearchResponse

export type FixtureMutation = Stage3ProductsMutation

export type FixtureMutationResponse = Stage3MutationResponse

export type FixtureCompleteResponse = Stage3CompleteResponse

/**
 * Labs-only adapter. It mirrors the production flow's semantic evaluation
 * boundary without importing product facts or authority decisions from the
 * production server.
 */
export type FixtureStage3Gateway = Stage3ProductsGateway & {
  evaluateDecisions(input: { draftId: string }): Promise<Stage3AuthorityEvaluation[]>
  resolveDecision(input: {
    draftId: string
    expectedRevision: number
    intent: Stage3AuthoritySemanticIntent
  }): Promise<Stage3MutationResponse>
}

export function createFixtureStage3Gateway(
  options: FixtureStage3GatewayOptions = {},
): FixtureStage3Gateway {
  const now = options.now ?? (() => new Date().toISOString())
  const searchDelayMs = options.searchDelayMs ?? DEFAULT_SEARCH_DELAY_MS
  const drafts = new Map<string, Stage3ProductDraft>()
  const requirementsByDraftId = new Map<string, Stage3CategoryRequirement[]>()
  const completions = new Map<
    string,
    Extract<FixtureCompleteResponse, { status: "ready_for_routine" }>
  >()
  let nextCapturedProduct = 1
  let nextPortfolio = 1
  let nextRoutineProposal = 1
  const pendingFailures = new Set(options.failOnce)

  async function loadOrCreate(input: LoadOrCreateInput): Promise<FixtureDraftResponse> {
    assertFixtureAuthorityRequirements(input.requirements)
    const existing = drafts.get(input.draftId)
    if (existing) {
      if (existing.refinedVersionId !== input.refinedVersionId && existing.status !== "completed") {
        const stale = invalidateDraftForRefinedVersion(existing, input.refinedVersionId, now())
        drafts.set(stale.draftId, stale)
        return { status: "stale", draft: stale, requirements: input.requirements }
      }
      return { status: existing.status, draft: existing, requirements: input.requirements }
    }
    const draft = createStage3Draft({ ...input, now: now() })
    drafts.set(draft.draftId, draft)
    requirementsByDraftId.set(draft.draftId, input.requirements)
    return { status: "active", draft, requirements: input.requirements }
  }

  async function search(input: {
    category: PersonalPlanCategory
    query: string
    requestToken: number
  }): Promise<FixtureSearchResponse> {
    const query = input.query.trim()
    await delay(searchDelayMs)
    failOnceIfConfigured(pendingFailures, "search")
    const candidates =
      query.length < 2
        ? []
        : FIXTURE_CATALOG.filter(
            (candidate) =>
              candidate.category === input.category &&
              `${candidate.brandName ?? ""} ${candidate.displayName}`
                .toLowerCase()
                .includes(query.toLowerCase()),
          ).slice(0, MAX_SEARCH_CANDIDATES)
    return {
      status: "ready",
      requestToken: input.requestToken,
      result: {
        category: input.category,
        query,
        candidates,
        totalCapped: candidates.length === MAX_SEARCH_CANDIDATES,
      },
    }
  }

  async function mutate(input: {
    draftId: string
    expectedRevision: number
    mutation: FixtureMutation
  }): Promise<FixtureMutationResponse> {
    const draft = requireDraft(drafts, input.draftId)
    if (draft.revision !== input.expectedRevision) return { status: "conflict", latestDraft: draft }
    if (draft.status !== "active") return { status: "conflict", latestDraft: draft }
    failOnceIfConfigured(pendingFailures, "mutate")
    const requirements = requirementsByDraftId.get(input.draftId)
    if (!requirements) throw new Error(`missing requirements for draft ${input.draftId}`)

    const next = {
      ...applyMutation(
        draft,
        input.mutation,
        requirements,
        () => `fixture-captured-${nextCapturedProduct++}`,
      ),
      updatedAt: now(),
    }
    drafts.set(next.draftId, next)
    return { status: "saved", draft: next }
  }

  async function invalidateForRefinedVersion(input: {
    draftId: string
    refinedVersionId: string
  }): Promise<FixtureDraftResponse> {
    const draft = requireDraft(drafts, input.draftId)
    const requirements = requirementsByDraftId.get(input.draftId)
    if (!requirements) throw new Error(`missing requirements for draft ${input.draftId}`)
    const next = invalidateDraftForRefinedVersion(draft, input.refinedVersionId, now())
    drafts.set(next.draftId, next)
    return { status: next.status, draft: next, requirements }
  }

  async function complete(input: {
    draftId: string
    expectedRevision: number
  }): Promise<FixtureCompleteResponse> {
    const draft = requireDraft(drafts, input.draftId)
    const prior = completions.get(input.draftId)
    if (prior) return prior
    if (draft.revision !== input.expectedRevision) return { status: "conflict", latestDraft: draft }
    failOnceIfConfigured(pendingFailures, "complete")
    const requirements = requirementsByDraftId.get(input.draftId)
    if (!requirements) throw new Error(`missing requirements for draft ${input.draftId}`)

    try {
      const portfolioVersionId = `fixture-portfolio-${nextPortfolio++}`
      const portfolio = createProposedProductPortfolio(draft, requirements, {
        portfolioVersionId,
        createdAt: now(),
      })
      const completedDraft: Stage3ProductDraft = {
        ...draft,
        status: "completed",
        pass: "ready_for_routine",
        revision: draft.revision + 1,
        updatedAt: now(),
      }
      const completed: Extract<FixtureCompleteResponse, { status: "ready_for_routine" }> = {
        status: "ready_for_routine",
        draft: completedDraft,
        portfolio,
        personalPlanId: draft.personalPlanId,
        refinedVersionId: draft.refinedVersionId,
        productPortfolioVersionId: portfolioVersionId,
        routineProposalId: `fixture-routine-proposal-${nextRoutineProposal++}`,
        next: { stage: 4, href: "/routine" },
      }
      drafts.set(draft.draftId, completedDraft)
      completions.set(draft.draftId, completed)
      return completed
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "Cannot create portfolio from incomplete draft"
      ) {
        return { status: "not_ready", draft }
      }
      throw error
    }
  }

  async function evaluateDecisions(input: {
    draftId: string
  }): Promise<Stage3AuthorityEvaluation[]> {
    const draft = requireDraft(drafts, input.draftId)
    return deriveStage3DecisionSubjects(draft).map((subject) =>
      evaluateFixtureDecision(draft, subject),
    )
  }

  async function resolveDecision(input: {
    draftId: string
    expectedRevision: number
    intent: Stage3AuthoritySemanticIntent
  }): Promise<Stage3MutationResponse> {
    const draft = requireDraft(drafts, input.draftId)
    if (draft.revision !== input.expectedRevision || draft.status !== "active") {
      return { status: "conflict", latestDraft: draft }
    }
    const subject = deriveStage3DecisionSubjects(draft).find(
      (candidate) => candidate.decisionKey === input.intent.subjectKey,
    )
    if (!subject) throw new Error("fixture authority subject is unavailable")
    const evaluation = evaluateFixtureDecision(draft, subject)
    if (!evaluation.allowedActions.includes(input.intent.action as never)) {
      throw new Error("fixture authority action is unavailable")
    }
    if (
      input.intent.action === "plan_recommendation" &&
      (evaluation.status !== "known" ||
        !evaluation.recommendation ||
        input.intent.selectedCandidateId !== evaluation.recommendation.productId)
    ) {
      throw new Error("fixture recommendation candidate is unavailable")
    }
    if (input.intent.action !== "plan_recommendation" && input.intent.selectedCandidateId) {
      throw new Error("fixture recommendation candidate is unexpected")
    }

    const next = {
      ...recordProductDecision(draft, fixtureAuthorityDecision(subject, evaluation, input.intent)),
      updatedAt: now(),
    }
    drafts.set(next.draftId, next)
    return { status: "saved", draft: next }
  }

  return {
    loadOrCreate,
    search,
    mutate,
    invalidateForRefinedVersion,
    complete,
    evaluateDecisions,
    resolveDecision,
  }
}

function evaluateFixtureDecision(
  draft: Stage3ProductDraft,
  subject: Stage3DecisionSubject,
): Stage3AuthorityEvaluation {
  const product = subject.capturedProductId
    ? draft.products.find((candidate) => candidate.capturedProductId === subject.capturedProductId)
    : null

  if (product?.identity.kind === "pending_submission") {
    return {
      status: "pending",
      category: subject.category,
      subjectKey: subject.decisionKey,
      reason: "product_intake_pending",
      allowedActions: ["keep_pending", "leave_uncovered"],
      coverageRuleIds: ["fixture.pending_product"],
    }
  }

  if (!product) {
    return {
      status: "known",
      category: subject.category,
      subjectKey: subject.decisionKey,
      verdict: "unknown",
      criteria: [],
      allowedActions: ["leave_uncovered"],
      recommendation: null,
      productFactFingerprint: null,
      recommendationFactFingerprint: null,
      coverageRuleIds: ["fixture.uncovered_role"],
    }
  }

  const categoryProducts = draft.products.filter(
    (candidate) => candidate.identity.category === subject.category,
  )
  const productIndex = categoryProducts.findIndex(
    (candidate) => candidate.capturedProductId === subject.capturedProductId,
  )
  // The second Conditioner is intentionally a visible mismatch fixture so the
  // Labs journey demonstrates the semantic recommendation route.
  const mismatch = subject.category === "conditioner" && productIndex === 1
  const recommendation = mismatch
    ? {
        recommendationId: `fixture-recommendation:${subject.decisionKey}`,
        productId: `fixture-recommended:${subject.decisionKey}`,
        category: subject.category,
        role: subject.role,
        displayName: "Leichter Pflege-Conditioner",
        reason: "Passt besser zum Bedarf.",
        authorityRuleId: "fixture.conditioner_balance",
      }
    : null

  return {
    status: "known",
    category: subject.category,
    subjectKey: subject.decisionKey,
    verdict: mismatch ? "mismatch" : "ideal",
    criteria: [
      {
        criterionId: `fixture:${subject.decisionKey}`,
        label: "Bedarf",
        result: mismatch ? "fail" : "pass",
        explanation: mismatch ? "Die Passung weicht ab." : "Der Bedarf wird erfüllt.",
      },
    ],
    allowedActions: mismatch ? ["plan_recommendation", "acknowledge_override"] : ["keep_owned"],
    recommendation,
    productFactFingerprint: `fixture-facts:${subject.decisionKey}`,
    recommendationFactFingerprint: recommendation
      ? `fixture-facts:${recommendation.productId}`
      : null,
    coverageRuleIds: ["fixture.category_fit"],
  }
}

function fixtureAuthorityDecision(
  subject: Stage3DecisionSubject,
  evaluation: Stage3AuthorityEvaluation,
  intent: Stage3AuthoritySemanticIntent,
): Stage3ProductDecision {
  const known = evaluation.status === "known" ? evaluation : null
  const criteria =
    evaluation.status === "known" || evaluation.status === "unknown" ? evaluation.criteria : []

  return {
    decisionKey: subject.decisionKey,
    category: subject.category,
    role: subject.role,
    capturedProductId: subject.capturedProductId,
    verdict: known?.verdict ?? "unknown",
    choiceState:
      intent.action === "keep_owned"
        ? "owned_active"
        : intent.action === "acknowledge_override"
          ? "owned_override"
          : intent.action === "plan_recommendation"
            ? "planned_purchase"
            : intent.action === "keep_pending"
              ? "pending_review"
              : "unassigned",
    criterionResults: criteria,
    recommendation:
      intent.action === "plan_recommendation" ? (known?.recommendation ?? null) : null,
    limitationAcknowledged: intent.action === "acknowledge_override",
  }
}

function applyMutation(
  draft: Stage3ProductDraft,
  mutation: FixtureMutation,
  requirements: Stage3CategoryRequirement[],
  nextCapturedProductId: () => string,
): Stage3ProductDraft {
  switch (mutation.type) {
    case "capture_catalog_candidate": {
      const candidate = FIXTURE_CATALOG.find((entry) => entry.candidateId === mutation.candidateId)
      if (!candidate) throw new Error(`unknown fixture candidate ${mutation.candidateId}`)
      return addCapturedProduct(draft, {
        capturedProductId: nextCapturedProductId(),
        userProductId: `fixture-user-product:${candidate.productId}`,
        identity: {
          kind: "catalog_product",
          productId: candidate.productId,
          displayName: candidate.displayName,
          category: candidate.category,
        },
        frequencyRange: mutation.frequencyRange,
        ownership: "owned",
        source: "catalog_search",
      })
    }
    case "capture_pending_submission":
      return addCapturedProduct(draft, {
        capturedProductId: nextCapturedProductId(),
        userProductId: `fixture-user-product:${mutation.submissionId}`,
        identity: {
          kind: "pending_submission",
          submissionId: mutation.submissionId,
          displayName: mutation.displayName,
          category: mutation.category,
          reviewStatus: mutation.reviewStatus,
        },
        frequencyRange: mutation.frequencyRange,
        ownership: "owned",
        source: "intake_fallback",
      })
    case "assign_roles":
      return assignProductRoles(draft, mutation)
    case "replace_category_role_assignments":
      return replaceCategoryRoleAssignments(
        draft,
        mutation.category,
        mutation.assignments,
        requirements,
      )
    case "mark_role_uncovered":
      return markRoleUncovered(draft, mutation.uncoveredRole)
    case "complete_capture_category":
      return completeCaptureCategory(draft, mutation.category, requirements)
    case "reopen_capture_category":
      return reopenCaptureCategory(draft, mutation.category)
    case "remove_captured_product":
      return removeCapturedProduct(draft, mutation.capturedProductId)
    case "record_decision":
      return recordProductDecision(draft, mutation.decision)
  }
}

function assertFixtureAuthorityRequirements(requirements: Stage3CategoryRequirement[]): void {
  for (const requirement of requirements) {
    if (!stage3CategoryRequirementSchema.safeParse(requirement).success) {
      throw new Error(`requirements for ${requirement.category} do not match fixture authority`)
    }
  }
}

function requireDraft(
  drafts: Map<string, Stage3ProductDraft>,
  draftId: string,
): Stage3ProductDraft {
  const draft = drafts.get(draftId)
  if (!draft) throw new Error(`unknown fixture draft ${draftId}`)
  return draft
}

function delay(ms: number): Promise<void> {
  return ms <= 0 ? Promise.resolve() : new Promise((resolve) => setTimeout(resolve, ms))
}

function failOnceIfConfigured(
  pendingFailures: Set<FixtureGatewayFailureOperation>,
  operation: FixtureGatewayFailureOperation,
): void {
  if (pendingFailures.delete(operation)) throw new FixtureGatewaySimulatedError(operation)
}
