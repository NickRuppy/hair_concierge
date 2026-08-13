import { buildStage3EntryContext } from "./stage2-entry-adapter"
import type {
  PersonalPlanCategory,
  Stage3CategoryCaptureCandidate,
  Stage3CatalogSearchResult,
  Stage3CategoryRequirement,
  Stage3CapturedProduct,
  Stage3CapturedUncoveredRole,
  Stage3ProductDecision,
  Stage3ProductDraft,
  Stage3RoleAssignment,
  ProposedProductPortfolio,
} from "./contracts"
import { deriveStage3DecisionSubjects } from "./contracts"
import type {
  Stage3CompletionReceiptResponse,
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
  finalizeCaptureCategory,
  markRoleUncovered,
  recordProductDecision,
  removeCapturedProduct,
  repairCursorlessCaptureDraft,
  replaceCaptureCategorySnapshot,
  replaceCategoryRoleAssignments,
  reopenCaptureCategory,
} from "./state-machine"
import type {
  RoutineCandidateCompiler,
  RoutineProposalStager,
} from "@/lib/personal-plan/routine-proposal-stager"
import type { RoutineCadenceAuthorityReader } from "@/lib/personal-plan/routine/cadence-authority"
import type { InitialNeedPlanSnapshot } from "@/lib/personal-plan/types"
import type { Stage3DecisionSubject } from "./contracts"
import type { Stage3AuthorityFactBundle } from "./authority/catalog-facts"
import type {
  Stage3AuthorityEvaluation,
  Stage3EvaluationContext,
  Stage3AuthorityInput,
  Stage3AuthoritySemanticIntent,
} from "./authority/contracts"
import { evaluateStage3Authority } from "./authority/evaluate"
import { requireCurrentAuthoritySnapshot, Stage3AuthoritySnapshotError } from "./authority/snapshot"
import { reportPersonalPlanTransitionTiming } from "@/lib/personal-plan/transition-performance"
import { expectedShampooBucket } from "./authority/categories/shampoo"
import { classifyStage3DesiredState, stage3DraftsSemanticallyEqual } from "./recovery-desired-state"
import {
  buildStage3FitComparison,
  type Stage3FitComparison,
  type Stage3SelectedComparisonCandidate,
} from "./fit-comparison"

export type Stage3AssessmentSearchContext = {
  hairThickness: "fine" | "normal" | "coarse"
  requiredRoles: string[]
  shampooTargets: Array<{ thickness: string; shampooBucket: string; scalpRoute: string }>
  conditionerTarget: { thickness: string; careDirection: string } | null
}

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
    | { outcome: "stale_source"; draft: Stage3ProductDraft }
  >
  search(input: {
    userId: string
    category: PersonalPlanCategory
    query: string
    requestToken: number
    assessmentContext: Stage3AssessmentSearchContext
  }): Promise<Stage3CatalogSearchResult>
  resolveOwnedCatalogProduct(input: {
    userId: string
    candidateId: string
    category: PersonalPlanCategory
  }): Promise<{
    userProductId: string
    productId: string
    displayName: string
    imageUrl?: string | null
    category: PersonalPlanCategory
  } | null>
  loadCurrentCatalogProduct(input: {
    userId: string
    userProductId: string
    productId: string
    category: PersonalPlanCategory
  }): Promise<{
    userProductId: string
    productId: string
    displayName: string
    imageUrl?: string | null
    category: PersonalPlanCategory
  } | null>
  resolveOwnedPendingProduct?(input: {
    userId: string
    userProductId: string
    submissionId: string
    category: PersonalPlanCategory
  }): Promise<{
    userProductId: string
    submissionId: string
    displayName: string
    reviewStatus: "pending_review" | "needs_more_info"
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
  loadCompletionReceipt?(input: { userId: string; draftId: string }): Promise<{
    portfolio: ProposedProductPortfolio
    productPortfolioVersionId: string
    routineVersionId: string
    routineProposalId: string | null
  } | null>
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
    context: Stage3EvaluationContext
  }): Promise<Stage3AuthorityFactBundle>
  loadDraft(input: { userId: string; draftId: string }): Promise<Stage3ProductDraft | null>
}

export type Stage3ProductionGatewayOptions = {
  userId: string
  persistence: Stage3ProductionPersistence
  /** Omitted in production until Stage 4 supplies the real compiler. */
  compiler?: RoutineCandidateCompiler
  stager?: RoutineProposalStager
  cadenceAuthorityReader?: RoutineCadenceAuthorityReader
  now?: () => string
}

export type Stage3AuthorityProductionGateway = Stage3ProductsGateway & {
  evaluateDecisions(input: { draftId: string }): Promise<Stage3AuthorityEvaluation[]>
  reviewDecisionBundles(input: { draftId: string }): Promise<Stage3DecisionReviewBundle[]>
  resolveDecision(input: {
    draftId: string
    expectedRevision: number
    intent: Stage3AuthoritySemanticIntent
  }): Promise<Stage3MutationResponse>
  resolveDecisions(input: {
    draftId: string
    expectedRevision: number
    intents: Stage3AuthoritySemanticIntent[]
  }): Promise<Stage3MutationResponse>
}

export type Stage3DecisionReviewBundle = {
  authorityEvaluation: Stage3AuthorityEvaluation
  fitComparison: Stage3FitComparison
}

export function createProductionStage3ProductsGateway(
  options: Stage3ProductionGatewayOptions,
): Stage3AuthorityProductionGateway {
  const now = options.now ?? (() => new Date().toISOString())
  let cached: { draft: Stage3ProductDraft; requirements: Stage3CategoryRequirement[] } | null = null

  async function repairLoadedDraft(input: {
    draft: Stage3ProductDraft
    requirements: Stage3CategoryRequirement[]
  }) {
    let loaded = input
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const repaired = repairCursorlessCaptureDraft(loaded.draft, now())
      if (repaired === loaded.draft) return loaded
      const saved = await options.persistence.save({
        userId: options.userId,
        draftId: loaded.draft.draftId,
        expectedRevision: loaded.draft.revision,
        draft: repaired,
      })
      if (saved.outcome === "stale_source") {
        cached = null
        throw new Stage3AuthoritySnapshotError("stale_refined_source")
      }
      loaded = { ...loaded, draft: saved.draft }
      if (saved.outcome === "saved") return loaded
    }
    throw new Error("stage3_resume_repair_conflict")
  }

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

  async function assertCurrentRefinedSource(draft: Stage3ProductDraft) {
    const currentRefinedVersionId = await options.persistence.loadCurrentRefinedVersionId({
      userId: options.userId,
      personalPlanId: draft.personalPlanId,
    })
    if (currentRefinedVersionId !== draft.refinedVersionId) {
      cached = null
      throw new Stage3AuthoritySnapshotError("stale_refined_source")
    }
  }

  async function authoritativeReview(
    draft: Stage3ProductDraft,
    subjectKey: string,
    context: Stage3EvaluationContext,
  ): Promise<Stage3DecisionReviewBundle & { authorityInput: Stage3AuthorityInput }> {
    const snapshot = requireCurrentAuthoritySnapshot(draft)

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
      context,
    })

    const authorityInput = {
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
    } as Stage3AuthorityInput
    const authorityEvaluation = evaluateStage3Authority(authorityInput)
    return {
      authorityInput,
      authorityEvaluation,
      fitComparison: buildStage3FitComparison(authorityInput, authorityEvaluation),
    }
  }

  async function authoritativeEvaluation(
    draft: Stage3ProductDraft,
    subjectKey: string,
    context: Stage3EvaluationContext,
  ): Promise<Stage3AuthorityEvaluation> {
    return (await authoritativeReview(draft, subjectKey, context)).authorityEvaluation
  }

  async function loadEvaluationContext(
    draft: Stage3ProductDraft,
  ): Promise<Stage3EvaluationContext> {
    const authoritySnapshot = requireCurrentAuthoritySnapshot(draft)
    const [currentRefinedVersionId, refinedNeedSnapshot] = await Promise.all([
      options.persistence.loadCurrentRefinedVersionId({
        userId: options.userId,
        personalPlanId: draft.personalPlanId,
      }),
      options.persistence.loadRefinedNeedSnapshot({
        userId: options.userId,
        personalPlanId: draft.personalPlanId,
        refinedVersionId: draft.refinedVersionId,
      }),
    ])
    const projection = refinedNeedSnapshot?.profile?.source?.projection
    const hairThickness = refinedNeedSnapshot?.profile?.hair?.thickness
    if (
      currentRefinedVersionId !== draft.refinedVersionId ||
      refinedNeedSnapshot.inputHash !== authoritySnapshot.refinedInputHash ||
      projection !== "refined_post_plan" ||
      !hairThickness ||
      !["fine", "normal", "coarse"].includes(hairThickness)
    ) {
      throw new Stage3AuthoritySnapshotError("stale_refined_source")
    }
    return {
      currentRefinedVersionId,
      refinedNeedSnapshot,
      hairThickness,
    }
  }

  async function rehydrateCompletionDraft(
    draft: Stage3ProductDraft,
  ): Promise<Stage3ProductDraft | null> {
    const products = await Promise.all(
      draft.products.map(async (product) => {
        if (product.identity.kind !== "catalog_product") return product
        const currentProduct = await options.persistence.loadCurrentCatalogProduct({
          userId: options.userId,
          userProductId: product.userProductId,
          productId: product.identity.productId,
          category: product.identity.category,
        })
        if (
          !currentProduct ||
          currentProduct.userProductId !== product.userProductId ||
          currentProduct.productId !== product.identity.productId ||
          currentProduct.category !== product.identity.category
        ) {
          return null
        }
        return {
          ...product,
          identity: {
            ...product.identity,
            displayName: currentProduct.displayName,
            imageUrl: currentProduct.imageUrl ?? null,
          },
        }
      }),
    )
    if (products.some((product) => product === null)) return null
    return { ...draft, products: products as Stage3CapturedProduct[] }
  }

  async function completionDecisionsRemainCurrent(
    draft: Stage3ProductDraft,
    context: Stage3EvaluationContext,
  ): Promise<boolean> {
    const reviews = await Promise.all(
      deriveStage3DecisionSubjects(draft).map((subject) =>
        authoritativeReview(draft, subject.decisionKey, context),
      ),
    )
    const reviewsBySubject = new Map(
      reviews.map((review) => [review.authorityEvaluation.subjectKey, review]),
    )
    return draft.decisions.every((decision) => {
      const review = reviewsBySubject.get(decision.decisionKey)
      if (!review) return false
      const evaluation = review.authorityEvaluation
      const action = authorityActionForDecision(decision)
      if (!action) return false
      if (action === "select_replacement") {
        const candidate = review.fitComparison.alternatives.find(
          (item) => item.productId === decision.recommendation?.productId,
        )
        return (
          candidate !== undefined &&
          decision.authorityEvidence?.recommendationFactFingerprint === candidate.factFingerprint
        )
      }
      if (!evaluation.allowedActions.includes(action as never)) return false
      if (
        (decision.choiceState === "owned_active" || decision.choiceState === "owned_override") &&
        evaluation.status !== "known"
      ) {
        return false
      }
      if (decision.choiceState === "pending_review" && evaluation.status !== "pending") return false
      if (decision.choiceState === "planned_purchase") {
        return (
          evaluation.status === "known" &&
          evaluation.recommendation?.productId === decision.recommendation?.productId
        )
      }
      return true
    })
  }

  return {
    async loadOrCreate(input): Promise<Stage3DraftResponse> {
      const loaded = await repairLoadedDraft(
        await options.persistence.loadOrCreate({
          userId: options.userId,
          personalPlanId: input.personalPlanId,
          refinedVersionId: input.refinedVersionId,
        }),
      )
      cached = loaded
      return {
        status: loaded.draft.status,
        draft: loaded.draft,
        requirements: loaded.requirements,
      }
    },

    async search(input): Promise<Stage3SearchResponse> {
      if (!input.draftId) throw new Error("stage3_search_draft_required")
      const loaded = await current(input.draftId)
      const context = await loadEvaluationContext(loaded.draft)
      const categoryDecision = effectiveStage3CategoryDecisions(loaded.draft).find(
        (decision) => decision.category === input.category,
      )
      const requirement = loaded.requirements.find(
        (candidate) => candidate.category === input.category,
      )
      if (!categoryDecision || !requirement) {
        throw new Stage3AuthoritySnapshotError("stale_authority_snapshot")
      }
      const target = categoryDecision.target
      const shampooTargets =
        target?.category === "shampoo"
          ? requirement.requiredRoles.flatMap((role) => {
              const shampooBucket = expectedShampooBucket({
                role,
                target,
              })
              return shampooBucket
                ? [
                    {
                      thickness: context.hairThickness,
                      shampooBucket,
                      scalpRoute: target.scalpRoute,
                    },
                  ]
                : []
            })
          : []
      const conditionerTarget =
        target?.category === "conditioner"
          ? {
              thickness: context.hairThickness,
              careDirection: target.careDirection,
            }
          : null
      const result = await options.persistence.search({
        ...input,
        userId: options.userId,
        assessmentContext: {
          hairThickness: context.hairThickness,
          requiredRoles: requirement.requiredRoles,
          shampooTargets,
          conditionerTarget,
        },
      })
      return { status: "ready", requestToken: input.requestToken, result }
    },

    async mutate(input): Promise<Stage3MutationResponse> {
      const loaded = await current(input.draftId)
      const draft = loaded.draft
      if (draft.status !== "active") {
        return { status: "conflict", latestDraft: draft }
      }
      // A semantic replay may legitimately avoid a second CAS write, but it
      // must still prove that this draft belongs to the plan's current refined
      // source before returning a canonical receipt.
      await assertCurrentRefinedSource(draft)
      const next = await applyMutation(
        options.persistence,
        options.userId,
        draft,
        input.mutation,
        loaded.requirements,
        now,
      )
      if (stage3DraftsSemanticallyEqual(draft, next)) return { status: "saved", draft }
      if (draft.revision !== input.expectedRevision)
        return { status: "conflict", latestDraft: draft }
      if (input.mutation.type === "replace_capture_category" && next !== draft) {
        const category = input.mutation.category
        const assignedProductIds = new Set(
          next.roleAssignments
            .filter((assignment) => assignment.category === category)
            .map((assignment) => assignment.capturedProductId),
        )
        if (assignedProductIds.size > 0) {
          const subjects = deriveStage3DecisionSubjects(next).filter(
            (subject) =>
              subject.category === category &&
              subject.capturedProductId !== null &&
              assignedProductIds.has(subject.capturedProductId),
          )
          const subjectProductIds = new Set(subjects.map((subject) => subject.capturedProductId))
          if ([...assignedProductIds].some((productId) => !subjectProductIds.has(productId))) {
            throw new Stage3AuthorityMutationError("stage3_authority_candidate_invalid")
          }
          const context = await loadEvaluationContext(next)
          const evaluatedSubjects = await Promise.all(
            subjects.map((subject) =>
              authoritativeEvaluation(next, subject.decisionKey, context).then((evaluation) => ({
                subject,
                evaluation,
              })),
            ),
          )
          const productsById = new Map(
            next.products.map((product) => [product.capturedProductId, product]),
          )
          if (
            evaluatedSubjects.some(({ subject, evaluation }) => {
              const product = subject.capturedProductId
                ? productsById.get(subject.capturedProductId)
                : null
              if (!product) return true
              return product.identity.kind === "pending_submission"
                ? evaluation.status !== "pending"
                : evaluation.status !== "known"
            })
          ) {
            throw new Stage3AuthorityMutationError("stage3_authority_candidate_invalid")
          }
        }
      }
      if (input.mutation.type === "replace_capture_category" && next === draft) {
        return { status: "saved", draft }
      }
      const saved = await options.persistence.save({
        userId: options.userId,
        draftId: draft.draftId,
        expectedRevision: input.expectedRevision,
        draft: next,
      })
      if (saved.outcome === "stale_source") {
        cached = null
        throw new Stage3AuthoritySnapshotError("stale_refined_source")
      }
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

    async loadCompletionReceipt(input): Promise<Stage3CompletionReceiptResponse> {
      const loaded = await current(input.draftId)
      const receipt = await completionReceiptForDraft(loaded.draft)
      if (!receipt) throw new Stage3ProductionUnavailableError()
      return receipt
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
      let completionDraft = draft
      if (draft.status === "completed") {
        const receipt = await completionReceiptForDraft(draft)
        if (receipt) return receipt
      }
      let refinedNeedSnapshot: InitialNeedPlanSnapshot
      let expectedSourceRevision: number
      if (draft.status === "completed") {
        ;[refinedNeedSnapshot, expectedSourceRevision] = await Promise.all([
          options.persistence.loadRefinedNeedSnapshot({
            userId: options.userId,
            personalPlanId: draft.personalPlanId,
            refinedVersionId: draft.refinedVersionId,
          }),
          options.persistence.loadSourceRevision({
            userId: options.userId,
            personalPlanId: draft.personalPlanId,
          }),
        ])
      } else {
        const rehydrated = await rehydrateCompletionDraft(draft)
        if (!rehydrated) return { status: "not_ready", draft }
        const [context, sourceRevision] = await Promise.all([
          loadEvaluationContext(rehydrated),
          options.persistence.loadSourceRevision({
            userId: options.userId,
            personalPlanId: draft.personalPlanId,
          }),
        ])
        if (!(await completionDecisionsRemainCurrent(rehydrated, context))) {
          return { status: "not_ready", draft }
        }
        completionDraft = rehydrated
        refinedNeedSnapshot = context.refinedNeedSnapshot
        expectedSourceRevision = sourceRevision
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
          portfolio = createProposedProductPortfolio(completionDraft, loaded.requirements, {
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
      const cadenceAuthorityFacts = options.cadenceAuthorityReader
        ? await options.cadenceAuthorityReader.load({
            productIds: [
              ...portfolio.ownedProducts.map((product) => product.productId),
              ...portfolio.plannedPurchases.map((product) => product.productId),
            ],
          })
        : []
      // SQL compares this freshly read source token while holding the plan row
      // lock before writing; active drafts were also re-evaluated above.
      const candidate = await options.compiler.compile({
        userId: options.userId,
        personalPlanId: draft.personalPlanId,
        productDraftId: draft.draftId,
        expectedRevision: input.expectedRevision,
        expectedSourceRevision,
        portfolioSchemaVersion: portfolio.schemaVersion,
        portfolioSnapshot: portfolio as never,
        refinedNeedSnapshot,
        cadenceAuthorityFacts,
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
      if (staged.status === "stale_source") {
        cached = null
        throw new Stage3AuthoritySnapshotError("stale_refined_source")
      }
      if (staged.status === "revision_conflict" || staged.status === "source_revision_conflict") {
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
      const context = await loadEvaluationContext(loaded.draft)
      return Promise.all(
        deriveStage3DecisionSubjects(loaded.draft).map((subject) =>
          authoritativeEvaluation(loaded.draft, subject.decisionKey, context),
        ),
      )
    },
    async reviewDecisionBundles(input) {
      const loaded = await current(input.draftId)
      const context = await loadEvaluationContext(loaded.draft)
      const reviews = await Promise.all(
        deriveStage3DecisionSubjects(loaded.draft).map((subject) =>
          authoritativeReview(loaded.draft, subject.decisionKey, context),
        ),
      )
      return reviews.map(({ authorityEvaluation, fitComparison }) => ({
        authorityEvaluation,
        fitComparison,
      }))
    },
    async resolveDecision(input) {
      return resolveAuthorityDecisions({ ...input, intents: [input.intent] })
    },
    async resolveDecisions(input) {
      return resolveAuthorityDecisions(input)
    },
  }

  async function completionReceiptForDraft(
    draft: Stage3ProductDraft,
  ): Promise<Stage3CompletionReceiptResponse | null> {
    if (draft.status !== "completed" || !options.persistence.loadCompletionReceipt) return null
    const receipt = await options.persistence.loadCompletionReceipt({
      userId: options.userId,
      draftId: draft.draftId,
    })
    if (!receipt) return null
    return {
      status: "ready_for_routine",
      draft,
      portfolio: receipt.portfolio,
      personalPlanId: draft.personalPlanId,
      refinedVersionId: draft.refinedVersionId,
      productPortfolioVersionId: receipt.productPortfolioVersionId,
      routineProposalId: receipt.routineProposalId,
      next: { stage: 4, href: "/routine" },
    }
  }

  async function resolveAuthorityDecisions(input: {
    draftId: string
    expectedRevision: number
    intents: Stage3AuthoritySemanticIntent[]
  }): Promise<Stage3MutationResponse> {
    const operation =
      input.intents.length === 1 ? "stage3_authority_single" : "stage3_authority_batch"
    let phaseStartedAt = performance.now()
    const loaded = await current(input.draftId)
    reportPersonalPlanTransitionTiming({
      layer: "server",
      operation: `${operation}_canonical_draft`,
      outcome: "success",
      durationMs: performance.now() - phaseStartedAt,
    })
    const draft = loaded.draft
    if (draft.status !== "active") {
      return { status: "conflict", latestDraft: draft }
    }
    if (input.intents.length === 0) {
      throw new Stage3AuthorityMutationError("stage3_authority_subject_invalid")
    }
    const seenSubjectKeys = new Set<string>()
    for (const intent of input.intents) {
      if (seenSubjectKeys.has(intent.subjectKey)) {
        throw new Stage3AuthorityMutationError("stage3_authority_subject_invalid")
      }
      seenSubjectKeys.add(intent.subjectKey)
    }
    phaseStartedAt = performance.now()
    const context = await loadEvaluationContext(draft)
    reportPersonalPlanTransitionTiming({
      layer: "server",
      operation: `${operation}_source_context`,
      outcome: "success",
      durationMs: performance.now() - phaseStartedAt,
    })
    const desired = classifyStage3DesiredState(draft, input.intents)
    if (desired === "satisfied") return { status: "saved", draft }
    if (desired === "different" || draft.revision !== input.expectedRevision) {
      return { status: "conflict", latestDraft: draft }
    }
    const subjectsByKey = new Map(
      deriveStage3DecisionSubjects(draft).map((subject) => [subject.decisionKey, subject]),
    )
    const subjects = input.intents.map((intent) => {
      const subject = subjectsByKey.get(intent.subjectKey)
      if (!subject) throw new Stage3AuthorityMutationError("stage3_authority_subject_invalid")
      return subject
    })
    phaseStartedAt = performance.now()
    const reviews = await Promise.all(
      subjects.map((subject) => authoritativeReview(draft, subject.decisionKey, context)),
    )
    reportPersonalPlanTransitionTiming({
      layer: "server",
      operation: `${operation}_authority_facts`,
      outcome: "success",
      durationMs: performance.now() - phaseStartedAt,
    })

    const snapshot = requireCurrentAuthoritySnapshot(draft)
    const decisions = input.intents.map((intent, index) => {
      const review = reviews[index]!
      const evaluation = review.authorityEvaluation
      if (
        intent.action !== "select_replacement" &&
        !evaluation.allowedActions.includes(intent.action as never)
      ) {
        throw new Stage3AuthorityMutationError("stage3_authority_action_invalid")
      }
      const selectedCandidate = validateSelectedCandidate(intent, review)
      return buildAuthorityDecision(
        subjects[index]!,
        intent,
        evaluation,
        snapshot,
        selectedCandidate,
      )
    })
    const folded = decisions.reduce(recordProductDecision, draft)
    const next = { ...folded, revision: draft.revision + 1, updatedAt: now() }
    phaseStartedAt = performance.now()
    const saved = await options.persistence.save({
      userId: options.userId,
      draftId: draft.draftId,
      expectedRevision: input.expectedRevision,
      draft: next,
    })
    reportPersonalPlanTransitionTiming({
      layer: "server",
      operation: `${operation}_cas_save`,
      outcome: saved.outcome,
      durationMs: performance.now() - phaseStartedAt,
    })
    if (saved.outcome === "stale_source") {
      cached = null
      throw new Stage3AuthoritySnapshotError("stale_refined_source")
    }
    cached = { ...loaded, draft: saved.draft }
    return saved.outcome === "saved"
      ? { status: "saved", draft: saved.draft }
      : { status: "conflict", latestDraft: saved.draft }
  }
}

export class Stage3AuthorityMutationError extends Error {
  constructor(
    public readonly code:
      | "stage3_authority_subject_invalid"
      | "stage3_authority_action_invalid"
      | "stage3_authority_candidate_invalid"
      | "stage3_replacement_candidate_invalid",
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
  review: Stage3DecisionReviewBundle,
): Stage3SelectedComparisonCandidate | null {
  const evaluation = review.authorityEvaluation
  if (intent.action === "select_replacement") {
    const candidate = intent.selectedCandidateId
      ? (review.fitComparison.alternatives.find(
          (alternative) => alternative.productId === intent.selectedCandidateId,
        ) ?? null)
      : null
    if (!candidate) {
      throw new Stage3AuthorityMutationError("stage3_replacement_candidate_invalid")
    }
    if (
      !intent.selectedCandidateFactFingerprint ||
      intent.selectedCandidateFactFingerprint !== candidate.factFingerprint
    ) {
      throw new Stage3AuthorityMutationError("stage3_replacement_candidate_invalid")
    }
    return candidate
  }
  if (intent.action === "plan_recommendation") {
    if (
      evaluation.status !== "known" ||
      !evaluation.recommendation ||
      intent.selectedCandidateFactFingerprint !== undefined ||
      (intent.selectedCandidateId !== undefined &&
        intent.selectedCandidateId !== evaluation.recommendation.productId)
    ) {
      throw new Stage3AuthorityMutationError("stage3_authority_candidate_invalid")
    }
    return null
  }
  if (
    intent.selectedCandidateId !== undefined ||
    intent.selectedCandidateFactFingerprint !== undefined
  ) {
    throw new Stage3AuthorityMutationError("stage3_authority_candidate_invalid")
  }
  return null
}

function authorityActionForDecision(
  decision: Stage3ProductDecision,
): Stage3AuthoritySemanticIntent["action"] | null {
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
  return null
}

function buildAuthorityDecision(
  subject: ReturnType<typeof deriveStage3DecisionSubjects>[number],
  intent: Stage3AuthoritySemanticIntent,
  evaluation: Stage3AuthorityEvaluation,
  snapshot: NonNullable<Stage3ProductDraft["authoritySnapshot"]>,
  selectedCandidate: Stage3SelectedComparisonCandidate | null = null,
): Stage3ProductDecision {
  const known = evaluation.status === "known" ? evaluation : null
  const criteria =
    evaluation.status === "known" || evaluation.status === "unknown" ? evaluation.criteria : []
  const choiceState = choiceStateForAuthorityAction(intent.action)
  const recommendation =
    intent.action === "select_replacement"
      ? (selectedCandidate?.recommendation ?? null)
      : intent.action === "plan_recommendation"
        ? (known?.recommendation ?? null)
        : null

  return {
    decisionKey: subject.decisionKey,
    category: subject.category,
    role: subject.role,
    capturedProductId: subject.capturedProductId,
    verdict: known?.verdict ?? "unknown",
    choiceState,
    criterionResults: criteria,
    recommendation,
    limitationAcknowledged: intent.action === "acknowledge_override",
    resolutionAction: intent.action,
    authorityEvidence: {
      schemaVersion: 1,
      subjectKey: subject.decisionKey,
      refinedNeedVersionId: snapshot.refinedNeedVersionId,
      refinedInputHash: snapshot.refinedInputHash,
      authorityVersion: snapshot.authorityVersions[subject.category],
      productFactFingerprint: known?.productFactFingerprint ?? null,
      recommendationFactFingerprint:
        selectedCandidate?.factFingerprint ?? known?.recommendationFactFingerprint ?? null,
      coverageRuleIds: evaluation.coverageRuleIds,
    },
  }
}

function choiceStateForAuthorityAction(
  action: Stage3AuthoritySemanticIntent["action"],
): Stage3ProductDecision["choiceState"] {
  switch (action) {
    case "keep_owned":
      return "owned_active"
    case "acknowledge_override":
      return "owned_override"
    case "plan_recommendation":
    case "select_replacement":
      return "planned_purchase"
    case "keep_pending":
      return "pending_review"
    case "leave_uncovered":
      return "unassigned"
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
    case "replace_capture_category": {
      const snapshot = requireCurrentAuthoritySnapshot(draft)
      if (
        mutation.refinedNeedVersionId !== draft.refinedVersionId ||
        mutation.refinedInputHash !== snapshot.refinedInputHash ||
        mutation.categoryAuthorityVersion !== snapshot.authorityVersions[mutation.category] ||
        mutation.categoryAuthorityVersion !== draft.authorityVersions[mutation.category]
      ) {
        throw new Stage3AuthoritySnapshotError("stale_authority_snapshot")
      }
      return withUpdatedAt(
        await rehydrateCaptureCategorySnapshot(
          persistence,
          userId,
          draft,
          mutation.category,
          mutation.candidates,
          mutation.uncoveredRoles,
          requirements,
        ),
      )
    }
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
      const existing = draft.products.find(
        (product) => product.userProductId === owned.userProductId,
      )
      if (existing) {
        const isExactReplay =
          existing.capturedProductId === owned.userProductId &&
          existing.identity.kind === "catalog_product" &&
          existing.identity.productId === owned.productId &&
          existing.identity.category === owned.category &&
          existing.frequencyRange === mutation.frequencyRange &&
          existing.ownership === "owned" &&
          existing.source === "catalog_search"
        if (isExactReplay) return draft
        throw new Error("stage3_catalog_capture_conflict")
      }
      return withUpdatedAt(
        addCapturedProduct(draft, {
          capturedProductId: owned.userProductId,
          userProductId: owned.userProductId,
          identity: {
            kind: "catalog_product",
            productId: owned.productId,
            displayName: owned.displayName,
            category: owned.category,
            imageUrl: owned.imageUrl ?? null,
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
    case "finalize_capture_category":
      return withUpdatedAt(
        finalizeCaptureCategory(
          draft,
          mutation.category,
          mutation.assignments,
          mutation.uncoveredRoles,
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

async function rehydrateCaptureCategorySnapshot(
  persistence: Stage3ProductionPersistence,
  userId: string,
  draft: Stage3ProductDraft,
  category: PersonalPlanCategory,
  candidates: Stage3CategoryCaptureCandidate[],
  uncoveredRoles: Stage3CapturedUncoveredRole[],
  requirements: Stage3CategoryRequirement[],
): Promise<Stage3ProductDraft> {
  if (!draft.orderedCategories.includes(category) || draft.categoryCursor !== category) {
    throw new Error("stage3_capture_category_unavailable")
  }
  const ids = new Set<string>()
  const resolved: Stage3CapturedProduct[] = []
  const assignments: Stage3RoleAssignment[] = []
  for (const candidate of candidates) {
    const identityKey =
      candidate.kind === "catalog"
        ? `catalog:${candidate.candidateId}`
        : `pending:${candidate.userProductId}:${candidate.submissionId}`
    if (ids.has(identityKey)) throw new Error("stage3_capture_snapshot_duplicate_candidate")
    ids.add(identityKey)
    const product =
      candidate.kind === "catalog"
        ? await resolveCatalogCapture(persistence, userId, category, candidate)
        : await resolvePendingCapture(persistence, userId, category, candidate)
    resolved.push(product)
    if (candidate.roles.length > 0) {
      assignments.push({
        capturedProductId: product.capturedProductId,
        category,
        roles: candidate.roles,
      })
    }
  }

  return replaceCaptureCategorySnapshot(
    draft,
    category,
    resolved,
    assignments,
    uncoveredRoles,
    effectiveStage3Requirements(requirements, draft),
  )
}

async function resolveCatalogCapture(
  persistence: Stage3ProductionPersistence,
  userId: string,
  category: PersonalPlanCategory,
  candidate: Extract<Stage3CategoryCaptureCandidate, { kind: "catalog" }>,
): Promise<Stage3CapturedProduct> {
  const owned = await persistence.resolveOwnedCatalogProduct({
    userId,
    candidateId: candidate.candidateId,
    category,
  })
  if (!owned || owned.category !== category) throw new Error("stage3_catalog_candidate_unavailable")
  return {
    capturedProductId: owned.userProductId,
    userProductId: owned.userProductId,
    identity: {
      kind: "catalog_product",
      productId: owned.productId,
      displayName: owned.displayName,
      category,
      imageUrl: owned.imageUrl ?? null,
    },
    frequencyRange: candidate.frequencyRange,
    ownership: "owned",
    source: "catalog_search",
  }
}

async function resolvePendingCapture(
  persistence: Stage3ProductionPersistence,
  userId: string,
  category: PersonalPlanCategory,
  candidate: Extract<Stage3CategoryCaptureCandidate, { kind: "pending" }>,
): Promise<Stage3CapturedProduct> {
  const owned = await persistence.resolveOwnedPendingProduct?.({
    userId,
    userProductId: candidate.userProductId,
    submissionId: candidate.submissionId,
    category,
  })
  if (!owned || owned.category !== category) throw new Error("stage3_pending_candidate_unavailable")
  return {
    capturedProductId: owned.userProductId,
    userProductId: owned.userProductId,
    identity: {
      kind: "pending_submission",
      submissionId: owned.submissionId,
      displayName: owned.displayName,
      category,
      reviewStatus: owned.reviewStatus,
    },
    frequencyRange: candidate.frequencyRange,
    ownership: "owned",
    source: "intake_fallback",
  }
}

// Keep this import live and intentional: adapters build requirements from the
// current refined snapshot, never fixture authorities.
export const deriveStage3RequirementsFromRefinedNeed = buildStage3EntryContext
