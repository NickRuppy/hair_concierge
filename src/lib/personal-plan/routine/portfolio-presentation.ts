import {
  parseProposedProductPortfolio,
  type Stage3RetainedOwnedProduct,
} from "../products/contracts"

type Query = {
  select: (columns: string) => Query
  eq: (column: string, value: string) => Query
  maybeSingle: () => Promise<{ data: unknown; error: unknown }>
}

export type PortfolioPresentationReadClient = { from: (table: string) => Query }

export type PortfolioPresentation = {
  schemaVersion: 1 | 2 | 3
  plannedPurchaseDecisionKeys: string[]
  retainedOwnedProducts: Stage3RetainedOwnedProduct[]
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
  const portfolio = parseProposedProductPortfolio(row.snapshot)
  if (portfolio.portfolioVersionId !== portfolioVersionId || portfolio.personalPlanId !== planId) {
    return null
  }
  const retainedOwnedProductsByDecision =
    portfolio.schemaVersion === 3 ? (portfolio.retainedOwnedProducts ?? []) : []
  const retainedOwnedProducts = [
    ...new Map(
      retainedOwnedProductsByDecision.map((product) => [product.userProductId, product]),
    ).values(),
  ]
  return {
    schemaVersion: portfolio.schemaVersion,
    plannedPurchaseDecisionKeys:
      portfolio.schemaVersion === 3
        ? portfolio.plannedPurchases.flatMap((purchase) =>
            typeof purchase.sourceDecisionKey === "string" ? [purchase.sourceDecisionKey] : [],
          )
        : [],
    retainedOwnedProducts,
  }
}

export function routinePresentationLabels(presentation: PortfolioPresentation | null) {
  const isV3 = presentation?.schemaVersion === 3
  return {
    plannedLabelFor(sourceDecisionKeys: readonly string[]) {
      return isV3 &&
        sourceDecisionKeys.some((key) => presentation.plannedPurchaseDecisionKeys.includes(key))
        ? "Noch kaufen"
        : null
    },
    fitLabelFor(fitDecision: string) {
      return isV3 && fitDecision === "informed_override" ? "Mit Einschränkung" : null
    },
  }
}
