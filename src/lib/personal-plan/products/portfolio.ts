import { computeStage3PathState } from "./state-machine"
import {
  isExecutableChoice,
  type ProposedProductPortfolio,
  type Stage3CategoryRequirement,
  type Stage3CategoryResolution,
  type Stage3OwnedProduct,
  type Stage3PendingProduct,
  type Stage3PlannedPurchase,
  type Stage3ProductDecision,
  type Stage3ProductDraft,
  type Stage3RetainedOwnedProduct,
  type Stage3UncoveredRole,
} from "./contracts"
import {
  effectiveStage3Requirements,
  requireCurrentProductLoadResolution,
} from "./product-load-resolution"

type CreatePortfolioOptions = {
  portfolioVersionId: string
  createdAt: string
}

export function createProposedProductPortfolio(
  draft: Stage3ProductDraft,
  requirements: Stage3CategoryRequirement[],
  options: CreatePortfolioOptions,
): ProposedProductPortfolio {
  requireCurrentProductLoadResolution(draft)
  const effectiveRequirements = effectiveStage3Requirements(requirements, draft)
  const pathState = computeStage3PathState(draft, effectiveRequirements)
  if (!pathState.canCreatePortfolio) {
    throw new Error("Cannot create portfolio from incomplete draft")
  }

  const productsById = new Map(
    draft.products.map((product) => [product.capturedProductId, product]),
  )
  const categoryResolutions: Stage3CategoryResolution[] = []
  const ownedProducts: Stage3OwnedProduct[] = []
  const plannedPurchases: Stage3PlannedPurchase[] = []
  const pendingProducts: Stage3PendingProduct[] = []
  const retainedOwnedProducts: Stage3RetainedOwnedProduct[] = []
  const uncoveredRoles: Stage3UncoveredRole[] = []
  const schemaVersion = hasV3ResolutionAction(draft) ? 3 : draft.productLoadResolution ? 2 : 1

  for (const decision of draft.decisions) {
    const product = decision.capturedProductId
      ? productsById.get(decision.capturedProductId)
      : undefined
    const catalogOwned =
      isExecutableChoice(decision.choiceState) && product?.identity.kind === "catalog_product"
    const replacementCatalogProduct =
      isReplacementSelection(decision) && product?.identity.kind === "catalog_product"
    const executable = catalogOwned && !replacementCatalogProduct
    const gapPreserved = !executable

    categoryResolutions.push({
      decisionKey: decision.decisionKey,
      category: decision.category,
      role: decision.role,
      verdict: decision.verdict,
      choiceState: decision.choiceState,
      capturedProductId: decision.capturedProductId,
      executable,
      gapPreserved,
    })

    if (replacementCatalogProduct && product?.identity.kind === "catalog_product") {
      retainedOwnedProducts.push({
        capturedProductId: product.capturedProductId,
        userProductId: product.userProductId,
        productId: product.identity.productId,
        displayName: product.identity.displayName,
        category: decision.category,
        role: decision.role,
        sourceDecisionKey: decision.decisionKey,
        planStatus: "not_used",
      })
      projectSelectedReplacement(decision, plannedPurchases, uncoveredRoles)
      continue
    }

    if (executable && product?.identity.kind === "catalog_product") {
      const choiceState = decision.choiceState as "owned_active" | "owned_override"
      ownedProducts.push({
        capturedProductId: product.capturedProductId,
        userProductId: product.userProductId,
        productId: product.identity.productId,
        displayName: product.identity.displayName,
        category: decision.category,
        role: decision.role,
        frequencyRange: product.frequencyRange,
        choiceState,
        sourceDecisionKey: decision.decisionKey,
      })
      continue
    }

    projectNonExecutableDecision(
      draft,
      decision,
      product,
      schemaVersion === 3,
      plannedPurchases,
      pendingProducts,
      uncoveredRoles,
    )
  }

  return {
    schemaVersion,
    portfolioVersionId: options.portfolioVersionId,
    personalPlanId: draft.personalPlanId,
    refinedVersionId: draft.refinedVersionId,
    sourceDraftRevision: draft.revision,
    categoryResolutions,
    ownedProducts,
    plannedPurchases,
    pendingProducts,
    uncoveredRoles,
    ...(draft.productLoadResolution ? { productLoadResolution: draft.productLoadResolution } : {}),
    ...(schemaVersion === 3 ? { retainedOwnedProducts } : {}),
    createdAt: options.createdAt,
  }
}

function isReplacementSelection(decision: Stage3ProductDecision): boolean {
  return decision.resolutionAction === "select_replacement"
}

function hasV3ResolutionAction(draft: Stage3ProductDraft): boolean {
  return draft.decisions.some(isReplacementSelection)
}

function projectSelectedReplacement(
  decision: Stage3ProductDecision,
  plannedPurchases: Stage3PlannedPurchase[],
  uncoveredRoles: Stage3UncoveredRole[],
): void {
  if (!decision.recommendation) return
  plannedPurchases.push({
    plannedPurchaseId: `planned:${decision.decisionKey}`,
    sourceDecisionKey: decision.decisionKey,
    category: decision.category,
    role: decision.role,
    recommendationId: decision.recommendation.recommendationId,
    productId: decision.recommendation.productId,
    displayName: decision.recommendation.displayName,
    reason: decision.recommendation.reason,
    authorityRuleId: decision.recommendation.authorityRuleId,
  })
  uncoveredRoles.push({
    category: decision.category,
    role: decision.role,
    reason: "planned_purchase_not_acquired",
    linkedDecisionKey: decision.decisionKey,
  })
}

function projectNonExecutableDecision(
  draft: Stage3ProductDraft,
  decision: Stage3ProductDecision,
  product: Stage3ProductDraft["products"][number] | undefined,
  useDecisionKeyedPlannedPurchases: boolean,
  plannedPurchases: Stage3PlannedPurchase[],
  pendingProducts: Stage3PendingProduct[],
  uncoveredRoles: Stage3UncoveredRole[],
): void {
  if (isReplacementSelection(decision)) {
    projectSelectedReplacement(decision, plannedPurchases, uncoveredRoles)
  }

  if (
    decision.choiceState === "planned_purchase" &&
    decision.recommendation &&
    !isReplacementSelection(decision)
  ) {
    plannedPurchases.push({
      plannedPurchaseId: `planned:${decision.category}:${decision.role ?? "category"}`,
      ...(useDecisionKeyedPlannedPurchases ? { sourceDecisionKey: decision.decisionKey } : {}),
      category: decision.category,
      role: decision.role,
      recommendationId: decision.recommendation.recommendationId,
      productId: decision.recommendation.productId,
      displayName: decision.recommendation.displayName,
      reason: decision.recommendation.reason,
      authorityRuleId: decision.recommendation.authorityRuleId,
    })
    uncoveredRoles.push({
      category: decision.category,
      role: decision.role,
      reason: "planned_purchase_not_acquired",
      linkedDecisionKey: decision.decisionKey,
    })
    return
  }

  if (
    (decision.choiceState === "pending_review" || isReplacementSelection(decision)) &&
    product?.identity.kind === "pending_submission"
  ) {
    pendingProducts.push({
      capturedProductId: product.capturedProductId,
      userProductId: product.userProductId,
      submissionId: product.identity.submissionId,
      category: decision.category,
      role: decision.role,
      displayName: product.identity.displayName,
      reviewStatus: product.identity.reviewStatus,
    })
    uncoveredRoles.push({
      category: decision.category,
      role: decision.role,
      reason: "pending_review",
      linkedDecisionKey: decision.decisionKey,
    })
    if (!isReplacementSelection(decision)) return
  }

  if (decision.choiceState === "inactive" || decision.choiceState === "unassigned") {
    const capturedGap = draft.uncoveredRoles.find(
      (uncoveredRole) =>
        uncoveredRole.category === decision.category && uncoveredRole.role === decision.role,
    )
    uncoveredRoles.push({
      category: decision.category,
      role: decision.role,
      reason: capturedGap?.reason ?? decision.choiceState,
      linkedDecisionKey: decision.decisionKey,
    })
  }
}
