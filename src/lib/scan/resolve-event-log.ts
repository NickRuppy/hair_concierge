import type { SupabaseClient } from "@supabase/supabase-js"

import { canonicalizeGtin } from "@/lib/product-identity/normalize"

export type ScanResolveLookupOutcome = "hit" | "miss" | "quarantined" | "invalid"

type LegacyScanResolveOutcome = ScanResolveLookupOutcome | "pending_submission"

export type ScanResolveTerminalOutcome =
  | "invalid_identifier"
  | "unknown_product"
  | "pending_submission"
  | "resolved"
  | "profile_ineligible"
  | "temporarily_unavailable"

export type ScanResolveFailureStage =
  | "identifier_lookup"
  | "quarantine_lookup"
  | "submission_lookup"
  | "profile_context"
  | "decision"
  | "product_facts"
  | "verdict"
  | "post_verdict_load"
  | "alternative_filter"
  | "response_build"

export type ScanResolveAttempt = {
  attemptId: string
  userId: string
  identifierType: string
  rawValue: string
}

export type ScanResolveAttemptCompletion = {
  attemptId: string
  lookupOutcome: ScanResolveLookupOutcome | null
  terminalOutcome: ScanResolveTerminalOutcome
  matchedProductId: string | null
  failureStage: ScanResolveFailureStage | null
}

/**
 * Opaque client-independent ID for the attempt row started before validation
 * or any expensive resolution.
 */
export function createScanResolveAttemptId(): string {
  return crypto.randomUUID()
}

/** Fail-open start: telemetry failures must never break scanning. */
export async function recordScanResolveAttempt(
  client: SupabaseClient,
  attempt: ScanResolveAttempt,
): Promise<void> {
  try {
    const { error } = await client.from("scan_resolve_events").insert({
      id: attempt.attemptId,
      user_id: attempt.userId,
      identifier_type: attempt.identifierType,
      raw_value: attempt.rawValue,
      canonical_value: canonicalizeGtin(attempt.rawValue),
      // Nullable under the expand migration; completion dual-writes this
      // legacy field while existing reporting migrates to v2 fields.
      outcome: null,
    })
    if (error) console.warn("scan_resolve_attempt_start_failed", { message: error.message })
  } catch (cause) {
    console.warn("scan_resolve_attempt_start_failed", { cause })
  }
}

function legacyOutcomeFor(
  lookupOutcome: ScanResolveLookupOutcome | null,
  terminalOutcome: ScanResolveTerminalOutcome,
): LegacyScanResolveOutcome | null {
  if (terminalOutcome === "invalid_identifier") return "invalid"
  if (terminalOutcome === "pending_submission") return "pending_submission"
  if (terminalOutcome === "unknown_product") {
    return lookupOutcome === "quarantined" ? "quarantined" : "miss"
  }
  return lookupOutcome === "hit" ? "hit" : null
}

/**
 * First terminal write wins: a retry or late failure cannot overwrite a
 * completed attempt. This is deliberately fail-open for the scan request.
 */
export async function completeScanResolveAttempt(
  client: SupabaseClient,
  completion: ScanResolveAttemptCompletion,
): Promise<void> {
  try {
    const { error } = await client
      .from("scan_resolve_events")
      .update({
        lookup_outcome: completion.lookupOutcome,
        terminal_outcome: completion.terminalOutcome,
        matched_product_id: completion.matchedProductId,
        failure_stage: completion.failureStage,
        completed_at: new Date().toISOString(),
        outcome: legacyOutcomeFor(completion.lookupOutcome, completion.terminalOutcome),
      })
      .eq("id", completion.attemptId)
      .is("completed_at", null)
    if (error) console.warn("scan_resolve_attempt_completion_failed", { message: error.message })
  } catch (cause) {
    console.warn("scan_resolve_attempt_completion_failed", { cause })
  }
}
