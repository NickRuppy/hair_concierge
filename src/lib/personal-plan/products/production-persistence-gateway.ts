import { buildStage3EntryContext } from "./stage2-entry-adapter"
import type {
  PersonalPlanCategory,
  Stage3CatalogSearchResult,
  Stage3CategoryRequirement,
  Stage3ProductDecision,
  Stage3ProductDraft,
  ProposedProductPortfolio,
} from "./contracts"
import { deriveStage3DecisionSubjects } from "./contracts"
import type {
  Stage3CompleteResponse,
  Stage3DraftResponse,
  Stage3MutationResponse,
  Stage3ProductsGateway,
  Stage3ProductsMutation,
  Stage3SearchResponse,
} from "./gateway"
import { createProposedProductPortfolio } from "./portfolio"
import {
  effectiveStage3CategoryDecisions,
  effectiveStage3Coverage,
  effectiveStage3Requirements,
} from "./product-load-resolution"
import {
  addCapturedProduct,
  assignProductRoles,
  completeCaptureCategory,
  markRoleUncovered,
  recordProductDecision,
  removeCapturedProduct,
  replaceCategoryRoleAssignments,
  reopenCaptureCategory,
} from "./state-machine"
import type {
  RoutineCandidateCompiler,
  RoutineProposalStager,
} from "@/lib/personal-plan/routine-proposal-stager"
import type { InitialNeedPlanSnapshot } from "@/lib/personal-plan/types"
import type { Stage3DecisionSubject } from "./contracts"
import type { Stage3AuthorityFactBundle } from "./authority/catalog-facts"
import type {
  Stage3AuthorityEvaluation,
  Stage3AuthorityInput,
  Stage3AuthoritySemanticIntent,
} from "./authority/contracts"
import { evaluateStage3Authority } from "./authority/evaluate"
import { requireCurrentAuthoritySnapshot, Stage3AuthoritySnapshotError } from "./authority/snapshot"

/**
 * This is deliberately a narrow, injected boundary.  SQL owns draft creation
 * and CAS; the route composition owns the service client.  Keeping it here
 * makes owner isolation and lost-response behaviour testable without a DB.
 */
export type Stage3ProductionPersistence = {
  loadOrCreate(input: {
    userId: string
    personalPlanId: string
    refinedVersionId: string
  }): Promise<{ draft: Stage3ProductDraft; requirements: Stage3CategoryRequirement[] }>
  save(input: {
    userId: string
    draftId: string
    expectedRevision: number
    draft: Stage3ProductDraft
  }): Promise<
    | { outcome: "saved"; draft: Stage3ProductDraft }
    | { outcome: "revision_conflict"; draft: Stage3ProductDraft }
  >
  search(input: {
    userId: string
    category: PersonalPlanCategory
    query: string
    requestToken: number
  }): Promise<Stage3CatalogSearchResult>
  resolveOwnedCatalogProduct(input: {
    userId: string
    candidateId: string
    category: PersonalPlanCategory
  }): Promise<{
    userProductId: string
    productId: string
    displayName: string
    category: PersonalPlanCategory
  } | null>
  loadRequirements(input: {
    userId: string
    personalPlanId: string
    refinedVersionId: string
  }): Promise<Stage3CategoryRequirement[]>
  loadCompletedPortfolio(input: {
    userId: string
    draftId: string
  }): Promise<ProposedProductPortfolio | null>
  loadRefinedNeedSnapshot(input: {
    userId: string
    personalPlanId: string
    refinedVersionId: string
  }): Promise<InitialNeedPlanSnapshot>
  loadSourceRevision(input: { userId: string; personalPlanId: string }): Promise<number>
  loadCurrentRefinedVersionId(input: {
    userId: string
    personalPlanId: string
  }): Promise<string | null>
  loadAuthorityFacts(input: {
    userId: string
    draft: Stage3ProductDraft
    subject: Stage3DecisionSubject
    heatRoutes: string[]
  }): Promise<Stage3AuthorityFactBundle>
  loadDraft(input: { userId: string; draftId: string }): Promise<Stage3ProductDraft | null>
}

export type Stage3ProductionGatewayOptions = {
  userId: string
  persistence: Stage3ProductionPersistence
  /** Omitted in production until Stage 4 supplies the real compiler. */
  compiler?: RoutineCandidateCompiler
  stager?: RoutineProposalStager
  now?: () => string
}

export type Stage3AuthorityProductionGateway = Stage3ProductsGateway & {
  evaluateDecisions(input: { draftId: string }): Promise<Stage3AuthorityEvaluation[]>
  resolveDecision(input: {
    draftId: string
    expectedRevision: number
    intent: Stage3AuthoritySemanticIntent
  }): Promise<Stage3MutationResponse>
}

export function createProductionStage3ProductsGateway(
  options: Stage3ProductionGatewayOptions,
): Stage3AuthorityProductionGateway {
  const now = options.now ?? (() => new Date().toISOString())
  let cached: { draft: Stage3ProductDraft; requirements: Stage3CategoryRequirement[] } | null = null

  async function current(draftId: string) {
    if (cached?.draft.draftId === draftId) return cached
    const draft = await options.persistence.loadDraft({ userId: options.userId, draftId })
    if (!draft) throw new Error("stage3_draft_not_found")
    // A canonical load derives requirements from the refined need without
    // creating another draft. This is essential for lost-response replay of a
    // draft SQL has already completed.
    const requirements = await options.persistence.loadRequirements({
      userId: options.userId,
      personalPlanId: draft.personalPlanId,
      refinedVersionId: draft.refinedVersionId,
    })
    cached = { draft, requirements }
    return cached
  }

  async function authoritativeEvaluation(
    draft: Stage3ProductDraft,
    subjectKey: string,
  ): Promise<Stage3AuthorityEvaluation> {
    const snapshot = requireCurrentAuthoritySnapshot(draft)
    const currentRefinedVersionId = await options.persistence.loadCurrentRefinedVersionId({
      userId: options.userId,
      personalPlanId: draft.personalPlanId,
    })
    if (currentRefinedVersionId !== draft.refinedVersionId) {
      throw new Stage3AuthoritySnapshotError("stale_refined_source")
    }

    const subject = deriveStage3DecisionSubjects(draft).find(
      (candidate) => candidate.decisionKey === subjectKey,
    )
    if (!subject) throw new Stage3AuthorityMutationError("stage3_authority_subject_invalid")
    const effectiveDecisions = effectiveStage3CategoryDecisions(draft)
    const categoryDecision = effectiveDecisions.find(
      (decision) => decision.category === subject.category,
    )
    if (!categoryDecision) throw new Stage3AuthoritySnapshotError("stale_authority_snapshot")
    const captured = subject.capturedProductId
      ? draft.products.find((product) => product.capturedProductId === subject.capturedProductId)
      : null
    const facts = await options.persistence.loadAuthorityFacts({
      userId: options.userId,
      draft,
      subject,
      heatRoutes: qualifyingHeatRoutes(snapshot.categoryDecisions),
    })

    return evaluateStage3Authority({
      category: subject.category,
      authorityVersion: snapshot.authorityVersions[subject.category],
      refinedVersionId: draft.refinedVersionId,
      refinedInputHash: snapshot.refinedInputHash,
      subjectKey: subject.decisionKey,
      role: subject.role,
      capturedProductId: subject.capturedProductId,
      subjectIdentity: captured?.identity ?? null,
      categoryDecision,
      coverage: effectiveStage3Coverage(draft),
      ...facts,
    } as Stage3AuthorityInput)
  }

  return {
    async loadOrCreate(input): Promise<Stage3DraftResponse> {
      const loaded = await options.persistence.loadOrCreate({
        userId: options.userId,
        personalPlanId: input.personalPlanId,
        refinedVersionId: input.refinedVersionId,
      })
      cached = loaded
      return {
        status: loaded.draft.status,
        draft: loaded.draft,
        requirements: loaded.requirements,
      }
    },

    async search(input): Promise<Stage3SearchResponse> {
      const result = await options.persistence.search({ ...input, userId: options.userId })
      return { status: "ready", requestToken: input.requestToken, result }
    },

    async mutate(input): Promise<Stage3MutationResponse> {
      const loaded = await current(input.draftId)
      const draft = loaded.draft
      if (draft.revision !== input.expectedRevision || draft.status !== "active") {
        return { status: "conflict", latestDraft: draft }
      }
      const next = await applyMutation(
        options.persistence,
        options.userId,
        draft,
        input.mutation,
        loaded.requirements,
        now,
      )
      const saved = await options.persistence.save({
        userId: options.userId,
        draftId: draft.draftId,
        expectedRevision: input.expectedRevision,
        draft: next,
      })
      cached = { ...loaded, draft: saved.draft }
      return saved.outcome === "saved"
        ? { status: "saved", draft: saved.draft }
        : { status: "conflict", latestDraft: saved.draft }
    },

    async invalidateForRefinedVersion(input): Promise<Stage3DraftResponse> {
      const loaded = await current(input.draftId)
      return {
        status: loaded.draft.status,
        draft: loaded.draft,
        requirements: loaded.requirements,
      }
    },

    async complete(input): Promise<Stage3CompleteResponse> {
      const loaded = await current(input.draftId)
      const draft = loaded.draft
      if (
        draft.status !== "completed" &&
        (draft.revision !== input.expectedRevision || draft.status !== "active")
      ) {
        return { status: "conflict", latestDraft: draft }
      }
      let portfolio: ProposedProductPortfolio
      try {
        // Rebuild from the canonical server draft, never from completion flags
        // or a client portfolio payload.
        if (draft.status === "completed") {
          const frozen = await options.persistence.loadCompletedPortfolio({
            userId: options.userId,
            draftId: draft.draftId,
          })
          if (!frozen) throw new Stage3ProductionUnavailableError()
          portfolio = frozen
        } else {
          portfolio = createProposedProductPortfolio(draft, loaded.requirements, {
            portfolioVersionId: "pending-sql-assignment",
            createdAt: now(),
          })
        }
      } catch (error) {
        if (
          error instanceof Error &&
          error.message === "Cannot create portfolio from incomplete draft"
        ) {
          return { status: "not_ready", draft }
        }
        throw error
      }

      // No compiler means no stager call and, therefore, no persistence writes.
      if (!options.compiler || !options.stager) {
        throw new Stage3ProductionUnavailableError()
      }
      // Read the trusted compile source immediately before compilation. SQL
      // compares this token while holding the plan row lock before writing.
      const refinedNeedSnapshot = await options.persistence.loadRefinedNeedSnapshot({
        userId: options.userId,
        personalPlanId: draft.personalPlanId,
        refinedVersionId: draft.refinedVersionId,
      })
      const expectedSourceRevision = await options.persistence.loadSourceRevision({
        userId: options.userId,
        personalPlanId: draft.personalPlanId,
      })
      const candidate = await options.compiler.compile({
        userId: options.userId,
        personalPlanId: draft.personalPlanId,
        productDraftId: draft.draftId,
        expectedRevision: input.expectedRevision,
        expectedSourceRevision,
        portfolioSchemaVersion: portfolio.schemaVersion,
        portfolioSnapshot: portfolio as never,
        refinedNeedSnapshot,
      })
      const staged = await options.stager.stage({
        userId: options.userId,
        personalPlanId: draft.personalPlanId,
        productDraftId: draft.draftId,
        expectedRevision: input.expectedRevision,
        expectedSourceRevision,
        portfolio: { schemaVersion: portfolio.schemaVersion, snapshot: portfolio as never },
        candidate,
      })
      if (
        staged.status === "revision_conflict" ||
        staged.status === "source_revision_conflict" ||
        staged.status === "stale_source"
      ) {
        cached = null
        const latest = await options.persistence.loadDraft({
          userId: options.userId,
          draftId: draft.draftId,
        })
        return { status: "conflict", latestDraft: latest ?? draft }
      }
      if (staged.status !== "completed" && staged.status !== "already_completed") {
        throw new Stage3ProductionUnavailableError()
      }
      const completedDraft = (await options.persistence.loadDraft({
        userId: options.userId,
        draftId: draft.draftId,
      })) ?? {
        ...draft,
        status: "completed" as const,
        pass: "ready_for_routine" as const,
        revision: draft.revision + 1,
      }
      cached = { ...loaded, draft: completedDraft }
      return {
        status: "ready_for_routine",
        draft: completedDraft,
        portfolio: { ...portfolio, portfolioVersionId: staged.portfolioVersionId },
        personalPlanId: draft.personalPlanId,
        refinedVersionId: draft.refinedVersionId,
        productPortfolioVersionId: staged.portfolioVersionId,
        routineProposalId: staged.routineProposalId,
        next: { stage: 4, href: "/routine" },
      }
    },
    async evaluateDecisions(input) {
      const loaded = await current(input.draftId)
      return Promise.all(
        deriveStage3DecisionSubjects(loaded.draft).map((subject) =>
          authoritativeEvaluation(loaded.draft, subject.decisionKey),
        ),
      )
    },
    async resolveDecision(input) {
      const loaded = await current(input.draftId)
      const draft = loaded.draft
      if (draft.revision !== input.expectedRevision || draft.status !== "active") {
        return { status: "conflict", latestDraft: draft }
      }
      const subject = deriveStage3DecisionSubjects(draft).find(
        (candidate) => candidate.decisionKey === input.intent.subjectKey,
      )
      if (!subject) throw new Stage3AuthorityMutationError("stage3_authority_subject_invalid")
      const evaluation = await authoritativeEvaluation(draft, subject.decisionKey)
      if (!evaluation.allowedActions.includes(input.intent.action as never)) {
        throw new Stage3AuthorityMutationError("stage3_authority_action_invalid")
      }
      validateSelectedCandidate(input.intent, evaluation)

      const snapshot = requireCurrentAuthoritySnapshot(draft)
      const decision = buildAuthorityDecision(subject, input.intent, evaluation, snapshot)
      const next = { ...recordProductDecision(draft, decision), updatedAt: now() }
      const saved = await options.persistence.save({
        userId: options.userId,
        draftId: draft.draftId,
        expectedRevision: input.expectedRevision,
        draft: next,
      })
      cached = { ...loaded, draft: saved.draft }
      return saved.outcome === "saved"
        ? { status: "saved", draft: saved.draft }
        : { status: "conflict", latestDraft: saved.draft }
    },
  }
}

export class Stage3AuthorityMutationError extends Error {
  constructor(
    public readonly code:
      | "stage3_authority_subject_invalid"
      | "stage3_authority_action_invalid"
      | "stage3_authority_candidate_invalid",
  ) {
    super(code)
    this.name = "Stage3AuthorityMutationError"
  }
}

export class Stage3ProductionUnavailableError extends Error {
  constructor() {
    super("temporarily_unavailable")
    this.name = "Stage3ProductionUnavailableError"
  }
}

function qualifyingHeatRoutes(
  decisions: NonNullable<Stage3ProductDraft["authoritySnapshot"]>["categoryDecisions"],
): string[] {
  const heat = decisions.find((decision) => decision.category === "heat_protectant")
  return heat?.target?.category === "heat_protectant" ? [...heat.target.qualifyingRoutes] : []
}

function validateSelectedCandidate(
  intent: Stage3AuthoritySemanticIntent,
  evaluation: Stage3AuthorityEvaluation,
) {
  if (intent.action === "plan_recommendation") {
    if (
      evaluation.status !== "known" ||
      !evaluation.recommendation ||
      (intent.selectedCandidateId !== undefined &&
        intent.selectedCandidateId !== evaluation.recommendation.productId)
    ) {
      throw new Stage3AuthorityMutationError("stage3_authority_candidate_invalid")
    }
    return
  }
  if (intent.selectedCandidateId !== undefined) {
    throw new Stage3AuthorityMutationError("stage3_authority_candidate_invalid")
  }
}

function buildAuthorityDecision(
  subject: ReturnType<typeof deriveStage3DecisionSubjects>[number],
  intent: Stage3AuthoritySemanticIntent,
  evaluation: Stage3AuthorityEvaluation,
  snapshot: NonNullable<Stage3ProductDraft["authoritySnapshot"]>,
): Stage3ProductDecision {
  const known = evaluation.status === "known" ? evaluation : null
  const criteria =
    evaluation.status === "known" || evaluation.status === "unknown" ? evaluation.criteria : []
  const choiceState: Stage3ProductDecision["choiceState"] =
    intent.action === "keep_owned"
      ? "owned_active"
      : intent.action === "acknowledge_override"
        ? "owned_override"
        : intent.action === "plan_recommendation"
          ? "planned_purchase"
          : intent.action === "keep_pending"
            ? "pending_review"
            : "unassigned"

  return {
    decisionKey: subject.decisionKey,
    category: subject.category,
    role: subject.role,
    capturedProductId: subject.capturedProductId,
    verdict: known?.verdict ?? "unknown",
    choiceState,
    criterionResults: criteria,
    recommendation:
      intent.action === "plan_recommendation" ? (known?.recommendation ?? null) : null,
    limitationAcknowledged: intent.action === "acknowledge_override",
    authorityEvidence: {
      schemaVersion: 1,
      subjectKey: subject.decisionKey,
      refinedNeedVersionId: snapshot.refinedNeedVersionId,
      refinedInputHash: snapshot.refinedInputHash,
      authorityVersion: snapshot.authorityVersions[subject.category],
      productFactFingerprint: known?.productFactFingerprint ?? null,
      recommendationFactFingerprint: known?.recommendationFactFingerprint ?? null,
      coverageRuleIds: evaluation.coverageRuleIds,
    },
  }
}

async function applyMutation(
  persistence: Stage3ProductionPersistence,
  userId: string,
  draft: Stage3ProductDraft,
  mutation: Stage3ProductsMutation,
  requirements: Stage3CategoryRequirement[],
  now: () => string,
): Promise<Stage3ProductDraft> {
  const withUpdatedAt = (value: Stage3ProductDraft) => ({ ...value, updatedAt: now() })
  switch (mutation.type) {
    case "capture_catalog_candidate": {
      const category = draft.orderedCategories.find(
        (candidate) => candidate === draft.categoryCursor,
      )
      if (!category) throw new Error("stage3_capture_category_unavailable")
      // Reaching this mutation is the explicit server-side ownership action;
      // merely searching never calls this persistence seam.
      const owned = await persistence.resolveOwnedCatalogProduct({
        userId,
        candidateId: mutation.candidateId,
        category,
      })
      if (!owned) throw new Error("stage3_catalog_candidate_unavailable")
      return withUpdatedAt(
        addCapturedProduct(draft, {
          capturedProductId: owned.userProductId,
          userProductId: owned.userProductId,
          identity: {
            kind: "catalog_product",
            productId: owned.productId,
            displayName: owned.displayName,
            category: owned.category,
          },
          frequencyRange: mutation.frequencyRange,
          ownership: "owned",
          source: "catalog_search",
        }),
      )
    }
    case "capture_pending_submission": {
      if (!mutation.userProductId) throw new Error("stage3_pending_user_product_unavailable")
      return withUpdatedAt(
        addCapturedProduct(draft, {
          capturedProductId: mutation.userProductId,
          userProductId: mutation.userProductId,
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
        }),
      )
    }
    case "assign_roles":
      return withUpdatedAt(assignProductRoles(draft, mutation))
    case "replace_category_role_assignments":
      return withUpdatedAt(
        replaceCategoryRoleAssignments(
          draft,
          mutation.category,
          mutation.assignments,
          effectiveStage3Requirements(requirements, draft),
        ),
      )
    case "mark_role_uncovered":
      return withUpdatedAt(markRoleUncovered(draft, mutation.uncoveredRole))
    case "complete_capture_category":
      return withUpdatedAt(completeCaptureCategory(draft, mutation.category, requirements))
    case "reopen_capture_category":
      return withUpdatedAt(reopenCaptureCategory(draft, mutation.category))
    case "remove_captured_product":
      return withUpdatedAt(removeCapturedProduct(draft, mutation.capturedProductId))
    case "record_decision":
      throw new Error("stage3_client_decision_rejected")
  }
}

// Keep this import live and intentional: adapters build requirements from the
// current refined snapshot, never fixture authorities.
export const deriveStage3RequirementsFromRefinedNeed = buildStage3EntryContext
