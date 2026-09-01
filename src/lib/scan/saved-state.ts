import type { SupabaseClient } from "@supabase/supabase-js"

import { isProductSearchQuarantined } from "./catalog-eligibility"

/**
 * Where a scanned/matched catalog product currently sits for this user, outside the
 * evaluated-verdict question itself. `"merkliste"` = saved to the scan wishlist
 * (`scan_wishlist`). `"routine"` = claimed as owned/in-use (`user_products`, an owned +
 * matched row), no matter which surface created that row. `null` = neither.
 *
 * Both states are independent tables a product could in principle occupy at once; when
 * that happens this reports `"merkliste"` first (matches the brief's listed check order).
 * That priority is a minor UX call, not a hard invariant.
 */
export type ScanSavedState = "merkliste" | "routine" | null

/**
 * The saved state plus who owns the row. `"routine"` is reported for ANY owned row so the
 * sheet tells the truth ("✓ In deiner Routine" for a product the user really does use),
 * but only a row the scan flow itself created (`intake_source: "scan"`) may be removed
 * from here — a Stage-3 or product-intake row is managed by that surface, and offering an
 * "Entfernen" that silently does nothing would be a lie. `managedByScan` carries that
 * distinction to the UI; the remove paths below enforce it server-side.
 */
export type ScanSavedStatePayload = {
  state: ScanSavedState
  managedByScan: boolean
}

const NOT_SAVED: ScanSavedStatePayload = { state: null, managedByScan: false }

export async function loadScanSavedState(
  client: SupabaseClient,
  userId: string,
  productId: string,
): Promise<ScanSavedStatePayload> {
  const { data: wishlistRow, error: wishlistError } = await client
    .from("scan_wishlist")
    .select("id")
    .eq("user_id", userId)
    .eq("product_id", productId)
    .maybeSingle()
  if (wishlistError) throw new Error("scan_saved_state_lookup_failed")
  // `scan_wishlist` exists only for the scan surface, so a row here is always ours.
  if (wishlistRow) return { state: "merkliste", managedByScan: true }

  const routine = await loadOwnedRoutineRows(client, userId, productId)
  if (routine.length === 0) return NOT_SAVED
  return {
    state: "routine",
    managedByScan: routine.some((row) => row.intake_source === "scan"),
  }
}

type OwnedRoutineRow = { id: string; intake_source: string | null }

/** Every owned+matched `user_products` row for this catalog product, whatever created it. */
async function loadOwnedRoutineRows(
  client: SupabaseClient,
  userId: string,
  productId: string,
): Promise<OwnedRoutineRow[]> {
  const { data, error } = await client
    .from("user_products")
    .select("id, intake_source")
    .eq("user_id", userId)
    .eq("catalog_product_id", productId)
    .eq("identity_status", "matched")
    .eq("ownership_status", "owned")
  if (error) throw new Error("scan_saved_state_lookup_failed")
  return (data ?? []) as OwnedRoutineRow[]
}

/**
 * A Merkliste entry points at a catalog product the scan surface will later re-resolve
 * and offer to buy, so it gets the same front gate as the routine save: the product must
 * still be active, and ruling R7's disposition quarantine applies here too. Both save
 * kinds are lifecycle-active-and-not-quarantined gates only (2026-09-01) — the routine
 * save's "already owned" branch below is a reporting concern, not an extra eligibility
 * check bookmarking would need.
 */
export async function saveScanWishlistProduct(
  client: SupabaseClient,
  userId: string,
  productId: string,
): Promise<ScanSaveResult> {
  const { data: product, error: productError } = await client
    .from("products")
    .select("id")
    .eq("id", productId)
    .eq("is_active", true)
    .eq("lifecycle_status", "active")
    .maybeSingle()
  if (productError) throw new Error("scan_wishlist_save_failed")
  if (!product) return { outcome: "product_not_found" }

  if (await isProductSearchQuarantined(client, productId)) {
    return { outcome: "product_not_saveable" }
  }

  const { error } = await client
    .from("scan_wishlist")
    .insert({ user_id: userId, product_id: productId })
  if (error && !isUniqueViolation(error)) throw new Error("scan_wishlist_save_failed")
  return { outcome: "saved", savedState: { state: "merkliste", managedByScan: true } }
}

/** Every `scan_wishlist` row belongs to the scan surface, so this can never be refused. */
export async function removeScanWishlistProduct(
  client: SupabaseClient,
  userId: string,
  productId: string,
): Promise<ScanRemoveResult> {
  const { error } = await client
    .from("scan_wishlist")
    .delete()
    .eq("user_id", userId)
    .eq("product_id", productId)
  if (error) throw new Error("scan_wishlist_remove_failed")
  return { outcome: "removed" }
}

/**
 * Outcome of either save kind: 404 on `product_not_found`, 409 on `product_not_saveable`.
 * `saved` carries the resulting state so the caller never has to guess — in particular
 * "already owned via Stage-3" reports the truthful `managedByScan: false` instead of
 * pretending the scan flow just created the row.
 */
export type ScanSaveResult =
  | { outcome: "saved"; savedState: ScanSavedStatePayload }
  | { outcome: "product_not_found" }
  | { outcome: "product_not_saveable" }

/**
 * `not_removable_here` = the row exists but another surface owns it (Stage-3 / product
 * intake). The scan sheet must say so rather than run a delete that matches nothing.
 */
export type ScanRemoveResult = { outcome: "removed" } | { outcome: "not_removable_here" }

type ActiveProductRow = {
  id: string
  name: string | null
  brand: string | null
  category_key: string
}

/**
 * "Ich benutze das schon" for a scanned catalog product. Mirrors the fields the
 * `personal_plan_create_or_reuse_user_product` RPC writes (identity_status: "matched",
 * ownership_status: "owned") but is a direct insert rather than that RPC, so the created
 * row can carry `intake_source: "scan"` — the RPC hardcodes `"catalog_search"`, which
 * would make a scan-created row indistinguishable from a Stage-3 catalog-search row and
 * defeat the scan-scoped DELETE below. The category schema allows several owned products
 * per category (see migration 20260808062620's opening comment), so this never needs to
 * touch or replace an existing different product in the same category — it only ever
 * adds this exact product, or no-ops if it's already owned.
 *
 * Ruling R7 (relaxed 2026-09-01, product ruling: users must never hit a save dead end
 * — 18 active `user_submitted` products were being blocked here): a disposition-
 * quarantined product is refused, same as the RPC, but `origin` no longer gates a
 * first-time save — any lifecycle-active, non-quarantined product is saveable
 * regardless of who submitted it. This is intentionally wider than the RPC's own
 * `origin = 'curated' OR already owned` predicate (`catalog-eligibility.ts`'s doc
 * comment still describes that narrower RPC rule; scan no longer mirrors it here).
 */
export async function saveScanRoutineProduct(
  client: SupabaseClient,
  userId: string,
  productId: string,
): Promise<ScanSaveResult> {
  const { data: product, error: productError } = await client
    .from("products")
    .select("id, name, brand, category_key")
    .eq("id", productId)
    .eq("is_active", true)
    .eq("lifecycle_status", "active")
    .maybeSingle()
  if (productError) throw new Error("scan_routine_save_failed")
  const activeProduct = product as ActiveProductRow | null
  if (!activeProduct) return { outcome: "product_not_found" }

  if (await isProductSearchQuarantined(client, productId)) {
    return { outcome: "product_not_saveable" }
  }

  const existing = await loadOwnedRoutineRows(client, userId, productId)
  if (existing.length > 0) {
    // Already in the routine. Report the state that actually exists — inserting a second
    // scan-owned row just to make `managedByScan` true would fake a save that never
    // happened and hand the user an "Entfernen" that deletes half of the truth.
    return {
      outcome: "saved",
      savedState: {
        state: "routine",
        managedByScan: existing.some((row) => row.intake_source === "scan"),
      },
    }
  }

  const { error: insertError } = await client.from("user_products").insert({
    user_id: userId,
    category: activeProduct.category_key,
    catalog_product_id: productId,
    brand_text: activeProduct.brand,
    product_name_text: activeProduct.name,
    identity_status: "matched",
    ownership_status: "owned",
    intake_source: "scan",
  })
  if (insertError && !isUniqueViolation(insertError)) throw new Error("scan_routine_save_failed")
  return { outcome: "saved", savedState: { state: "routine", managedByScan: true } }
}

/**
 * Only ever removes a row this same helper created (`intake_source: "scan"`) — a routine
 * slot filled via Stage-3 catalog search or product intake is untouched. When such a
 * foreign row is the only thing holding the product in the routine, this reports
 * `not_removable_here` instead of running a delete that matches nothing and returning a
 * success the UI would render as "removed".
 */
export async function removeScanRoutineProduct(
  client: SupabaseClient,
  userId: string,
  productId: string,
): Promise<ScanRemoveResult> {
  const owned = await loadOwnedRoutineRows(client, userId, productId)
  if (owned.length > 0 && !owned.some((row) => row.intake_source === "scan")) {
    return { outcome: "not_removable_here" }
  }

  const { error } = await client
    .from("user_products")
    .delete()
    .eq("user_id", userId)
    .eq("catalog_product_id", productId)
    .eq("intake_source", "scan")
    .eq("ownership_status", "owned")
  if (error) throw new Error("scan_routine_remove_failed")
  return { outcome: "removed" }
}

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false
  const err = error as { code?: unknown; message?: unknown }
  const text = String(err.message ?? "").toLowerCase()
  return err.code === "23505" || text.includes("duplicate") || text.includes("unique")
}
