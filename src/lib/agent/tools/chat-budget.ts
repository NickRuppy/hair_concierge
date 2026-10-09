import {
  orderStandaloneAlternatives,
  orderTrustPairAlternatives,
  type BudgetCandidate,
} from "@/lib/personal-plan/products/budget-policy"
import { usablePackagePriceEur } from "@/lib/personal-plan/products/fit-comparison"
import { isShoppingBudgetEnabled } from "@/lib/personal-plan/release"
import type { MatchedProduct } from "@/lib/product-matching/matcher"
import type {
  EngineBudgetOrder,
  EngineBudgetOrderMode,
} from "@/lib/recommendation-engine/selection"
import type { HairProfile } from "@/lib/types"
import { shoppingBudgetSchema, type ShoppingBudget } from "@/lib/user-facts/schema"

// Chat reads and respects the saved per-package shopping budget but never changes it (there is no
// write tool). The ordering is the same standalone policy the personal plan uses.

/** The saved budget from the already-loaded profile; null when the flag is off, nothing is saved
 *  or the stored value does not parse. */
export function readSavedShoppingBudget(
  hairProfile: Pick<HairProfile, "shopping_preferences"> | null | undefined,
  environment: Parameters<typeof isShoppingBudgetEnabled>[0] = process.env,
): ShoppingBudget | null {
  if (!isShoppingBudgetEnabled(environment)) return null
  const preferences = hairProfile?.shopping_preferences
  if (!preferences || typeof preferences !== "object" || Array.isArray(preferences)) return null
  const parsed = shoppingBudgetSchema.safeParse((preferences as { budget?: unknown }).budget)
  return parsed.success ? parsed.data : null
}

/** German label the model can quote for the saved budget. */
export function describeShoppingBudget(budget: ShoppingBudget): string {
  if (budget.kind === "uncapped") return "Ohne feste Preisgrenze"
  return budget.allowExceptions
    ? `Bis ${budget.limitEur} € pro Produkt, einzelne dürfen mehr kosten`
    : `Bis ${budget.limitEur} € pro Produkt`
}

export type ChatBudgetOrdering<T extends MatchedProduct = MatchedProduct> = {
  products: T[]
  overBudgetProductIds: Set<string>
  /** Products removed because they have no usable package price under a cap. */
  droppedUnpricedCount: number
}

function toBudgetCandidate(product: MatchedProduct): BudgetCandidate {
  // Inside the Bondbuilder engine (before its cut) products still carry the engine's fit bucket
  // and trust rank, so a cap can order equally trusted products cheaper first.
  const engine = product as MatchedProduct & { _trustRank?: unknown; _fitStatus?: unknown }
  const trustRank = typeof engine._trustRank === "number" ? engine._trustRank : undefined
  return {
    productId: product.id,
    priceEur: usablePackagePriceEur({
      priceEur: product.price_eur,
      purchaseLinkStatus: product.purchase_link_status ?? null,
    }),
    // The standalone ordering keeps the engine's fit order inside each group and ignores these.
    verdict: engine._fitStatus === "ideal" ? "ideal" : "supportive",
    cautionCount: 0,
    needDistances: {},
    ...(trustRank === undefined ? {} : { trustRank }),
  }
}

/** A Bondbuilder list (every product carries Bondbuilder metadata) uses the trust pair. */
function isBondbuilderList(products: readonly MatchedProduct[]): boolean {
  return (
    products.length > 0 &&
    products.every((product) => product.recommendation_meta?.category === "bondbuilder")
  )
}

/**
 * Orders the final per-category list by the standalone budget policy (within budget first, then
 * over-budget; unpriced dropped under a cap). Bondbuilder lists (`trust_pair`, Nick 2026-10-09)
 * instead keep the engine's trust order and lead with the most trusted affordable product next
 * to the most trusted product overall; re-applying it to an already paired list is a no-op.
 * `protectedProductIds` (the user's own products and explicitly targeted ones) keep their
 * original positions and are never flagged or dropped. Uncapped budgets leave the list untouched.
 */
export function applyChatBudgetOrdering<T extends MatchedProduct>(params: {
  products: T[]
  budget: ShoppingBudget
  protectedProductIds: ReadonlySet<string>
  mode?: EngineBudgetOrderMode
}): ChatBudgetOrdering<T> {
  const { products, budget, protectedProductIds } = params
  if (budget.kind !== "capped") {
    return { products, overBudgetProductIds: new Set(), droppedUnpricedCount: 0 }
  }

  const mode = params.mode ?? (isBondbuilderList(products) ? "trust_pair" : "default")
  const free = products.filter((product) => !protectedProductIds.has(product.id))
  const views = (mode === "trust_pair" ? orderTrustPairAlternatives : orderStandaloneAlternatives)(
    free.map(toBudgetCandidate),
    budget,
    free.length,
  )
  const freeById = new Map(free.map((product) => [product.id, product]))
  const ordered = views.map((view) => freeById.get(view.productId)!)
  const overBudgetProductIds = new Set(
    views.filter((view) => view.overBudget).map((view) => view.productId),
  )

  const result = [...ordered]
  products.forEach((product, index) => {
    if (protectedProductIds.has(product.id)) {
      result.splice(Math.min(index, result.length), 0, product)
    }
  })

  return {
    products: result,
    overBudgetProductIds,
    droppedUnpricedCount: free.length - ordered.length,
  }
}

/**
 * The same ordering as a hook for the category engine, applied to its ranked pool BEFORE the
 * final result cut (the engine keeps only a few products, so ordering afterwards would never see
 * an affordable product ranked just below the cut). Only a capped budget produces a hook. The
 * products it drops for lacking a usable price are collected in `droppedProductIds` so the
 * later note still reflects them.
 */
export function createChatBudgetEngineOrder(params: {
  budget: ShoppingBudget
  protectedProductIds: ReadonlySet<string>
}): { order: EngineBudgetOrder; droppedProductIds: Set<string> } | null {
  if (params.budget.kind !== "capped") return null
  const droppedProductIds = new Set<string>()
  const order: EngineBudgetOrder = (products, options) => {
    const ordered = applyChatBudgetOrdering({
      products,
      budget: params.budget,
      protectedProductIds: params.protectedProductIds,
      mode: options?.mode ?? "default",
    }).products
    const keptIds = new Set(ordered.map((product) => product.id))
    for (const product of products) {
      if (!keptIds.has(product.id)) droppedProductIds.add(product.id)
    }
    return ordered
  }
  return { order, droppedProductIds }
}
