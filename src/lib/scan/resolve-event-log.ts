import type { SupabaseClient } from "@supabase/supabase-js"

import { canonicalizeGtin } from "@/lib/product-identity/normalize"

export type ScanResolveOutcome = "hit" | "miss" | "pending_submission" | "quarantined" | "invalid"

export type ScanResolveEvent = {
  userId: string
  identifierType: string
  rawValue: string
  outcome: ScanResolveOutcome
  matchedProductId: string | null
}

/**
 * Fail-open attempt log: one row per barcode resolve attempt in
 * `scan_resolve_events` (service-role-only). The miss ranking over
 * `canonical_value` is the EAN-backfill priority list; a logging failure must
 * never break the scan itself, so every error path is swallowed after a warn.
 */
export async function recordScanResolveEvent(
  client: SupabaseClient,
  event: ScanResolveEvent,
): Promise<void> {
  try {
    const { error } = await client.from("scan_resolve_events").insert({
      user_id: event.userId,
      identifier_type: event.identifierType,
      raw_value: event.rawValue,
      canonical_value: canonicalizeGtin(event.rawValue),
      outcome: event.outcome,
      matched_product_id: event.matchedProductId,
    })
    if (error) console.warn("scan_resolve_event_log_failed", { message: error.message })
  } catch (cause) {
    console.warn("scan_resolve_event_log_failed", { cause })
  }
}
