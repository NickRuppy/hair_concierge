import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Where a scanned/matched catalog product currently sits for this user, outside the
 * evaluated-verdict question itself. `"merkliste"` = saved to the scan wishlist
 * (`scan_wishlist`). `"routine"` = claimed as owned/in-use (`user_products`, an owned +
 * matched row), no matter which surface created that row. `null` = neither.
 *
 * Both states are independent tables a product could in principle occupy at once; when
 * that happens this reports `"merkliste"` first (matches the brief's listed check order).
 * That priority is a minor UX call, not a hard invariant — but `scan_move_saved_product`
 * deliberately repeats it, so the state a move returns never contradicts the next read.
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

/** Which of the two exclusive save destinations the user picked. */
export type ScanSaveKind = "routine" | "merkliste"

/**
 * The save sheet's two destinations are exclusive, so saving is a MOVE: write the
 * destination, drop the source. Both halves plus the post-write state read happen
 * inside `scan_move_saved_product` (migration 20260904150000), i.e. one transaction
 * serialised per user+product. Doing it as two client calls let two concurrent
 * opposite moves delete each other's freshly inserted row, and made a failed cleanup
 * indistinguishable from a failed save.
 *
 * Everything this helper adds is the call and a shape check: any RPC error or payload
 * that is not a recognised outcome throws rather than being reported as a save, so the
 * route can never answer 200 for a move that did not happen.
 *
 * Eligibility for the move itself (active lifecycle, not quarantined, no `origin` gate)
 * lives in the RPC — see `catalog-eligibility.ts`'s header for how it differs from the
 * narrower search/resolve rule.
 */
export async function moveScanSavedProduct(
  client: SupabaseClient,
  userId: string,
  productId: string,
  kind: ScanSaveKind,
): Promise<ScanSaveResult> {
  const { data, error } = await client.rpc("scan_move_saved_product", {
    p_user_id: userId,
    p_product_id: productId,
    p_kind: kind,
  })
  if (error) throw new Error("scan_move_failed")
  return parseMoveResult(data)
}

function parseMoveResult(payload: unknown): ScanSaveResult {
  if (!payload || typeof payload !== "object") throw new Error("scan_move_failed")
  const { outcome, savedState } = payload as { outcome?: unknown; savedState?: unknown }
  if (outcome === "product_not_found" || outcome === "product_not_saveable") return { outcome }
  if (outcome !== "saved") throw new Error("scan_move_failed")
  return { outcome, savedState: parseSavedState(savedState) }
}

function parseSavedState(payload: unknown): ScanSavedStatePayload {
  if (!payload || typeof payload !== "object") throw new Error("scan_move_failed")
  const { state, managedByScan } = payload as { state?: unknown; managedByScan?: unknown }
  const isState = state === null || state === "merkliste" || state === "routine"
  if (!isState || typeof managedByScan !== "boolean") throw new Error("scan_move_failed")
  return { state, managedByScan }
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
 * Outcome of a move: 404 on `product_not_found`, 409 on `product_not_saveable`. `saved`
 * carries the state read back after the writes, so the caller never has to guess — in
 * particular "already owned via Stage-3" reports the truthful `managedByScan: false`
 * instead of pretending the scan flow just created the row.
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
