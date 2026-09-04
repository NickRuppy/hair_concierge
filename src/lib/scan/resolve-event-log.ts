import type { SupabaseClient } from "@supabase/supabase-js"

import { canonicalizeGtin } from "@/lib/product-identity/normalize"
import { captureScanException } from "@/lib/observability/scan"

export type ScanResolveLookupOutcome = "hit" | "miss" | "quarantined" | "invalid"

export type ScanResolveTerminalOutcome =
  | "invalid_identifier"
  | "unknown_product"
  | "pending_submission"
  | "resolved"
  | "verdict_unknown"
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

const ATTEMPT_LOG_CAPTURE_THROTTLE_MS = 60_000

/** Module-level so repeated failures across requests in the same process share one window. */
let attemptLogCaptureThrottleUntilMs = 0

/** Test-only: clears the throttle window so the next write failure captures again. */
export function resetAttemptLogCaptureThrottleForTests(): void {
  attemptLogCaptureThrottleUntilMs = 0
}

/**
 * A systemic attempt-log failure (RLS/schema regression) must not go unnoticed just because
 * both writers are fail-open. Capped at once per 60s per process so a sustained outage pages
 * once instead of flooding Sentry on every scan.
 */
function reportAttemptLogFailure(
  error: unknown,
  captureException: typeof captureScanException,
): void {
  const now = Date.now()
  if (now < attemptLogCaptureThrottleUntilMs) return
  attemptLogCaptureThrottleUntilMs = now + ATTEMPT_LOG_CAPTURE_THROTTLE_MS
  captureException(error, {
    route: "resolve",
    status: 200,
    reason: "attempt_log_write_failed",
  })
}

/** Fail-open start: telemetry failures must never break scanning. */
export async function recordScanResolveAttempt(
  client: SupabaseClient,
  attempt: ScanResolveAttempt,
  captureException: typeof captureScanException = captureScanException,
): Promise<void> {
  try {
    const { error } = await client.from("scan_resolve_events").insert({
      id: attempt.attemptId,
      user_id: attempt.userId,
      identifier_type: attempt.identifierType,
      raw_value: attempt.rawValue,
      canonical_value: canonicalizeGtin(attempt.rawValue),
    })
    if (error) {
      console.warn("scan_resolve_attempt_start_failed", { message: error.message })
      reportAttemptLogFailure(new Error(error.message), captureException)
    }
  } catch (cause) {
    console.warn("scan_resolve_attempt_start_failed", { cause })
    reportAttemptLogFailure(cause, captureException)
  }
}

/**
 * First terminal write wins: a retry or late failure cannot overwrite a
 * completed attempt. This is deliberately fail-open for the scan request.
 */
export async function completeScanResolveAttempt(
  client: SupabaseClient,
  completion: ScanResolveAttemptCompletion,
  captureException: typeof captureScanException = captureScanException,
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
      })
      .eq("id", completion.attemptId)
      .is("completed_at", null)
    if (error) {
      console.warn("scan_resolve_attempt_completion_failed", { message: error.message })
      reportAttemptLogFailure(new Error(error.message), captureException)
    }
  } catch (cause) {
    console.warn("scan_resolve_attempt_completion_failed", { cause })
    reportAttemptLogFailure(cause, captureException)
  }
}
