import type { SupabaseClient } from "@supabase/supabase-js"

import { shoppingBudgetSchema, type ShoppingBudget } from "@/lib/user-facts/schema"

import type { RoutinePayloadV1 } from "./contracts"

/**
 * The saved shopping budget for the Routine edit gate (Task 6).
 *
 * Narrow on purpose: `loadUserFacts` throws on a corrupt facts document and loads far more than
 * this needs. A missing row, a missing `budget` key or a value that does not parse is `null`
 * ("no budget saved" — the gate asks). A failed READ throws, so callers can tell "nothing saved"
 * from "could not find out": the page then renders without a gate, the proposal route answers 503
 * instead of asking a member who may already have answered.
 */
export async function loadRoutineShoppingBudget(
  admin: Pick<SupabaseClient, "from">,
  userId: string,
): Promise<ShoppingBudget | null> {
  const { data, error } = await admin
    .from("hair_profiles")
    .select("shopping_preferences")
    .eq("user_id", userId)
    .maybeSingle()
  if (error) throw error
  const preferences = (data as { shopping_preferences?: unknown } | null)?.shopping_preferences
  if (!preferences || typeof preferences !== "object") return null
  const parsed = shoppingBudgetSchema.safeParse((preferences as { budget?: unknown }).budget)
  return parsed.success ? parsed.data : null
}

/** Product ids of the accepted routine's included, planned (= still to buy) products. */
export function plannedRoutineProductIds(payload: RoutinePayloadV1 | null | undefined): string[] {
  const ids = new Set<string>()
  for (const item of payload?.items ?? []) {
    if (item.state.inclusion !== "included") continue
    if (item.product.kind === "planned" && item.product.productId) ids.add(item.product.productId)
  }
  return [...ids]
}

/**
 * Known package prices (EUR) for those products, keyed by product id. Fail-open and
 * presentation-only: any error, a missing or non-finite price yields no entry, so the summary
 * notice simply does not count that product. A price never gates anything.
 */
export async function loadRoutineProductPricesEur(
  admin: Pick<SupabaseClient, "from">,
  productIds: readonly string[],
): Promise<Record<string, number>> {
  const ids = [...new Set(productIds.filter(Boolean))].slice(0, 64)
  if (ids.length === 0) return {}
  try {
    const { data, error } = await admin.from("products").select("id, price_eur").in("id", ids)
    if (error || !Array.isArray(data)) return {}
    const prices: Record<string, number> = {}
    for (const row of data as { id?: unknown; price_eur?: unknown }[]) {
      if (typeof row.id !== "string") continue
      const price = typeof row.price_eur === "string" ? Number(row.price_eur) : row.price_eur
      if (typeof price === "number" && Number.isFinite(price) && price > 0) prices[row.id] = price
    }
    return prices
  } catch {
    return {}
  }
}

/** The accepted products whose known package price is above a capped budget's limit. */
export function countRoutineProductsOverBudget(input: {
  payload: RoutinePayloadV1 | null | undefined
  budget: ShoppingBudget | null | undefined
  pricesEur: Readonly<Record<string, number>> | undefined
}): number {
  const { budget, pricesEur } = input
  if (!budget || budget.kind !== "capped" || !pricesEur) return 0
  return plannedRoutineProductIds(input.payload).filter((productId) => {
    const price = pricesEur[productId]
    return typeof price === "number" && Number.isFinite(price) && price > budget.limitEur
  }).length
}

export const ROUTINE_BUDGET_GATE_CONTEXT_LINE =
  "Kurz eine Frage, dann geht es mit deiner Änderung weiter."

export const ROUTINE_BUDGET_NOTICE_REVIEW_LABEL = "Neue Vorschläge ansehen"

export function routineOverBudgetNoticeText(count: number): string | null {
  if (!Number.isInteger(count) || count < 1) return null
  return count === 1
    ? "Ein Produkt liegt über deinem Budget. Es bleibt, bis du neue Vorschläge übernimmst."
    : `${count} Produkte liegen über deinem Budget. Sie bleiben, bis du neue Vorschläge übernimmst.`
}

/** The proposal route's safety-net answer when the flag is on and no budget is saved. */
export const ROUTINE_BUDGET_REQUIRED_ERROR = "budget_required"
