import {
  computeStage3PathState,
} from "./state-machine"
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
  type Stage3UncoveredRole,
} from "./contracts"

type CreatePortfolioOptions = {
  portfolioVersionId: string
  createdAt: string
}

export function createProposedProductPortfolio(
  draft: Stage3ProductDraft,
  requirements: Stage3CategoryRequirement[],
  options: CreatePortfolioOptions,
): ProposedProductPortfolio {
  const pathState = computeStage3PathState(draft, requirements)
  if (!pathState.canCreatePortfolio) {
    throw new Error("Cannot create portfolio from incomplete draft")
  }

  const productsById = new Map(draft.products.map((product) => [product.capturedProductId, product]))
  const categoryResolutions: Stage3CategoryResolution[] = []
  const ownedProducts: Stage3OwnedProduct[] = []
  const plannedPurchases: Stage3PlannedPurchase[] = []
  const pendingProducts: Stage3PendingProduct[] = []
  const uncoveredRoles: Stage3UncoveredRole[] = []

  for (const decision of draft.decisions) {
    const product = decision.capturedProductId ? productsById.get(decision.capturedProductId) : undefined
    const executable =
      isExecutableChoice(decision.choiceState) && product?.identity.kind === "catalog_product"
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

    if (executable && product?.identity.kind === "catalog_product") {
      const choiceState = decision.choiceState as "owned_active" | "owned_override"
      ownedProducts.push({
        capturedProductId: product.capturedProductId,
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
      plannedPurchases,
      pendingProducts,
      uncoveredRoles,
    )
  }

  return {
    schemaVersion: 1,
    portfolioVersionId: options.portfolioVersionId,
    personalPlanId: draft.personalPlanId,
    refinedVersionId: draft.refinedVersionId,
    sourceDraftRevision: draft.revision,
    categoryResolutions,
    ownedProducts,
    plannedPurchases,
    pendingProducts,
    uncoveredRoles,
    createdAt: options.createdAt,
  }
}

function projectNonExecutableDecision(
  draft: Stage3ProductDraft,
  decision: Stage3ProductDecision,
  product: Stage3ProductDraft["products"][number] | undefined,
  plannedPurchases: Stage3PlannedPurchase[],
  pendingProducts: Stage3PendingProduct[],
  uncoveredRoles: Stage3UncoveredRole[],
): void {
  if (decision.choiceState === "planned_purchase" && decision.recommendation) {
    plannedPurchases.push({
      plannedPurchaseId: `planned:${decision.category}:${decision.role ?? "category"}`,
      category: decision.category,
      role: decision.role,
      recommendationId: decision.recommendation.recommendationId,
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

  if (decision.choiceState === "pending_review" && product?.identity.kind === "pending_submission") {
    pendingProducts.push({
      capturedProductId: product.capturedProductId,
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
    return
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
