import type { SupabaseClient } from "@supabase/supabase-js"

import { captureScanException } from "@/lib/observability/scan"

import type { ScanDmLookupTelemetry } from "./resolve-event-log"

export type ScanSubmitDmLookupEvent = ScanDmLookupTelemetry & {
  /**
   * The submit route may defer the writer. Preserve lookup time rather than
   * the later drain time when it supplies this value.
   */
  createdAt?: string
}

const SUBMIT_DM_LOOKUP_CAPTURE_THROTTLE_MS = 60_000
let submitDmLookupCaptureThrottleUntilMs = 0

/** Test-only: clears the process-local telemetry warning window. */
export function resetSubmitDmLookupCaptureThrottleForTests(): void {
  submitDmLookupCaptureThrottleUntilMs = 0
}

function reportSubmitDmLookupWriteFailure(captureException: typeof captureScanException): void {
  const now = Date.now()
  if (now < submitDmLookupCaptureThrottleUntilMs) return
  submitDmLookupCaptureThrottleUntilMs = now + SUBMIT_DM_LOOKUP_CAPTURE_THROTTLE_MS
  // Do not send a provider error: it can include a URL or response body.
  captureException(new Error("scan_submit_dm_lookup_event_write_failed"), {
    route: "submit",
    status: 200,
    reason: "submit_dm_lookup_event_write_failed",
    level: "warning",
  })
}

/**
 * Fail-open, service-only submit-side measurement. The row is intentionally
 * unjoinable: no user, GTIN, product, request payload, or submission ID.
 */
export async function recordScanSubmitDmLookupEvent(
  client: SupabaseClient,
  event: ScanSubmitDmLookupEvent,
  captureException: typeof captureScanException = captureScanException,
): Promise<void> {
  try {
    const { error } = await client.from("scan_submit_dm_lookup_events").insert({
      outcome: event.outcome,
      duration_ms: event.durationMs,
      deadline_ms: event.deadlineMs,
      ...(event.createdAt ? { created_at: event.createdAt } : {}),
    })
    if (error) {
      console.warn("scan_submit_dm_lookup_event_write_failed")
      reportSubmitDmLookupWriteFailure(captureException)
    }
  } catch {
    console.warn("scan_submit_dm_lookup_event_write_failed")
    reportSubmitDmLookupWriteFailure(captureException)
  }
}
