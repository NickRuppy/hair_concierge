import {
  parseProposedProductPortfolio,
  type Stage3DecisionDeferralReason,
  type Stage3RetainedInventoryProduct,
  type Stage3RetainedOwnedProduct,
} from "../products/contracts"

type Query = {
  select: (columns: string) => Query
  eq: (column: string, value: string) => Query
  maybeSingle: () => Promise<{ data: unknown; error: unknown }>
}

export type PortfolioPresentationReadClient = { from: (table: string) => Query }

export type PortfolioPresentation = {
  schemaVersion: 1 | 2 | 3 | 4
  plannedPurchaseDecisionKeys: string[]
  retainedOwnedProducts: Stage3RetainedOwnedProduct[]
  /** Informational only; never used to construct Routine assignments. */
  retainedInventoryProducts?: Stage3RetainedInventoryProduct[]
  /**
   * Server-derived deferral reason for a server `leave_uncovered` decision
   * (Stage-3, `STAGE3_DECISION_DEFERRAL_REASONS`), keyed by the decision's
   * `linkedDecisionKey` — the same key a compiled Routine item carries in its
   * own `sourceDecisionKeys`. The Routine compiler never reads
   * `uncoveredRoles` (a deferred role compiles to a plain excluded item with
   * no reason attached), so the Routine surface reads this map alongside the
   * compiled payload instead of threading the reason through the immutable
   * Routine schema. Absent for a decision key with no server-derived reason
   * (a user-excluded category, an ordinary planned-but-not-acquired gap,
   * etc.) — those keep the existing generic excluded-item copy. Optional so
   * every existing `PortfolioPresentation` literal (tests, other readers)
   * keeps compiling; readers must treat a missing map the same as an empty
   * one.
   */
  deferredRoleReasons?: Record<string, Stage3DecisionDeferralReason>
}

export async function loadOwnerPortfolioPresentation(
  client: PortfolioPresentationReadClient,
  userId: string,
  planId: string,
  portfolioVersionId: string,
): Promise<PortfolioPresentation | null> {
  const { data, error } = await client
    .from("personal_plan_portfolio_versions")
    .select("id, snapshot")
    .eq("id", portfolioVersionId)
    .eq("user_id", userId)
    .eq("personal_plan_id", planId)
    .maybeSingle()
  if (error) throw error
  if (!data || typeof data !== "object") return null

  const row = data as { id?: unknown; snapshot?: unknown }
  if (row.id !== portfolioVersionId) return null
  const portfolio = parseProposedProductPortfolio(row.snapshot, { includeV4: true })
  if (portfolio.portfolioVersionId !== portfolioVersionId || portfolio.personalPlanId !== planId) {
    return null
  }
  const retainedOwnedProductsByDecision =
    portfolio.schemaVersion === 3 || portfolio.schemaVersion === 4
      ? (portfolio.retainedOwnedProducts ?? [])
      : []
  const retainedOwnedProducts = [
    ...new Map(
      retainedOwnedProductsByDecision.map((product) => [product.userProductId, product]),
    ).values(),
  ]
  const deferredRoleReasons = Object.fromEntries(
    portfolio.uncoveredRoles.flatMap((uncoveredRole) =>
      uncoveredRole.deferralReason
        ? [[uncoveredRole.linkedDecisionKey, uncoveredRole.deferralReason] as const]
        : [],
    ),
  )
  return {
    schemaVersion: portfolio.schemaVersion,
    plannedPurchaseDecisionKeys:
      portfolio.schemaVersion === 3 || portfolio.schemaVersion === 4
        ? portfolio.plannedPurchases.flatMap((purchase) =>
            typeof purchase.sourceDecisionKey === "string" ? [purchase.sourceDecisionKey] : [],
          )
        : [],
    retainedOwnedProducts,
    deferredRoleReasons,
    retainedInventoryProducts:
      portfolio.schemaVersion === 4 ? portfolio.retainedInventoryProducts : [],
  }
}

export function routinePresentationLabels(presentation: PortfolioPresentation | null) {
  const hasReplacementPresentation =
    presentation?.schemaVersion === 3 || presentation?.schemaVersion === 4
  return {
    plannedLabelFor(sourceDecisionKeys: readonly string[]) {
      return hasReplacementPresentation &&
        sourceDecisionKeys.some((key) => presentation.plannedPurchaseDecisionKeys.includes(key))
        ? "Noch kaufen"
        : null
    },
    fitLabelFor(fitDecision: string) {
      return hasReplacementPresentation && fitDecision === "informed_override"
        ? "Mit Einschränkung"
        : null
    },
  }
}
