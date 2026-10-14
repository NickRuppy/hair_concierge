import type { SupabaseClient } from "@supabase/supabase-js"

import { shoppingBudgetSchema, type ShoppingBudget } from "@/lib/user-facts/schema"

/**
 * The saved per-package shopping budget for the scanner hot path.
 *
 * Deliberately narrow and fail-open: a scan must never break because the budget could not be
 * read. `loadUserFacts` is not used here — it throws on a corrupt domain, which is the right
 * behaviour for the profile and the wrong one for a scan. Any error, a missing row or a value
 * that does not parse returns `null` ("no budget"), and the scan behaves exactly as without one.
 */
export async function loadScanShoppingBudget(
  admin: SupabaseClient,
  userId: string,
): Promise<ShoppingBudget | null> {
  try {
    const { data, error } = await admin
      .from("hair_profiles")
      .select("shopping_preferences")
      .eq("user_id", userId)
      .maybeSingle()
    if (error || !data) return null
    const preferences = (data as { shopping_preferences?: unknown }).shopping_preferences
    if (!preferences || typeof preferences !== "object") return null
    const parsed = shoppingBudgetSchema.safeParse((preferences as { budget?: unknown }).budget)
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

export type ScanShoppingBudgetDeps = {
  isShoppingBudgetEnabled: () => boolean
  loadShoppingBudget: (admin: SupabaseClient, userId: string) => Promise<ShoppingBudget | null>
}

/**
 * Flag-gated and fail-open at the call site too: an injected loader that throws must degrade to
 * "no budget" exactly like the real one does, so the routes never fail because of the budget.
 */
export async function loadScanBudgetForRequest(
  deps: ScanShoppingBudgetDeps,
  admin: SupabaseClient,
  userId: string,
): Promise<ShoppingBudget | null> {
  try {
    if (!deps.isShoppingBudgetEnabled()) return null
    return await deps.loadShoppingBudget(admin, userId)
  } catch {
    return null
  }
}
