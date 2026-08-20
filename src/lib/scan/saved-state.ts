import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Where a scanned/matched catalog product currently sits for this user, outside the
 * evaluated-verdict question itself. `"merkliste"` = saved to the scan wishlist
 * (`scan_wishlist`). `"routine"` = claimed as owned/in-use (`user_products`, an owned +
 * matched row). `null` = neither.
 *
 * Both states are independent tables a product could in principle occupy at once; when
 * that happens this reports `"merkliste"` first (matches the brief's listed check order).
 * That priority is a minor UX call, not a hard invariant — worth revisiting once Task 8's
 * result sheet defines whether the two states are meant to be mutually exclusive.
 */
export type ScanSavedState = "merkliste" | "routine" | null

export async function loadScanSavedState(
  client: SupabaseClient,
  userId: string,
  productId: string,
): Promise<ScanSavedState> {
  const { data: wishlistRow, error: wishlistError } = await client
    .from("scan_wishlist")
    .select("id")
    .eq("user_id", userId)
    .eq("product_id", productId)
    .maybeSingle()
  if (wishlistError) throw new Error("scan_saved_state_lookup_failed")
  if (wishlistRow) return "merkliste"

  const { data: routineRow, error: routineError } = await client
    .from("user_products")
    .select("id")
    .eq("user_id", userId)
    .eq("catalog_product_id", productId)
    .eq("ownership_status", "owned")
    .maybeSingle()
  if (routineError) throw new Error("scan_saved_state_lookup_failed")
  if (routineRow) return "routine"

  return null
}

export async function saveScanWishlistProduct(
  client: SupabaseClient,
  userId: string,
  productId: string,
): Promise<void> {
  const { error } = await client
    .from("scan_wishlist")
    .insert({ user_id: userId, product_id: productId })
  if (error && !isUniqueViolation(error)) throw new Error("scan_wishlist_save_failed")
}

export async function removeScanWishlistProduct(
  client: SupabaseClient,
  userId: string,
  productId: string,
): Promise<void> {
  const { error } = await client
    .from("scan_wishlist")
    .delete()
    .eq("user_id", userId)
    .eq("product_id", productId)
  if (error) throw new Error("scan_wishlist_remove_failed")
}

export type ScanRoutineSaveResult = { outcome: "saved" } | { outcome: "product_not_found" }

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
 */
export async function saveScanRoutineProduct(
  client: SupabaseClient,
  userId: string,
  productId: string,
): Promise<ScanRoutineSaveResult> {
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

  const { data: existing, error: existingError } = await client
    .from("user_products")
    .select("id")
    .eq("user_id", userId)
    .eq("catalog_product_id", productId)
    .eq("ownership_status", "owned")
    .maybeSingle()
  if (existingError) throw new Error("scan_routine_save_failed")
  if (existing) return { outcome: "saved" }

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
  return { outcome: "saved" }
}

/**
 * Only ever removes a row this same helper created (`intake_source: "scan"`) — a routine
 * slot filled via Stage-3 catalog search or product intake is untouched, per the brief's
 * "remove only a scan-created row" instruction.
 */
export async function removeScanRoutineProduct(
  client: SupabaseClient,
  userId: string,
  productId: string,
): Promise<void> {
  const { error } = await client
    .from("user_products")
    .delete()
    .eq("user_id", userId)
    .eq("catalog_product_id", productId)
    .eq("intake_source", "scan")
    .eq("ownership_status", "owned")
  if (error) throw new Error("scan_routine_remove_failed")
}

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false
  const err = error as { code?: unknown; message?: unknown }
  const text = String(err.message ?? "").toLowerCase()
  return err.code === "23505" || text.includes("duplicate") || text.includes("unique")
}
