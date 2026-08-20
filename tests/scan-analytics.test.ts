import assert from "node:assert/strict"
import test from "node:test"

import { postHogDestination } from "../src/lib/analytics/destinations/posthog"
import { eventRoutes } from "../src/lib/analytics/routes"
import { posthog } from "../src/lib/analytics/runtime/posthog"
import {
  createConsentAwareScanAnalytics,
  noOpScanAnalytics,
  type ScanAnalyticsPort,
} from "../src/lib/scan/scan-analytics"

/**
 * Fixture values below stay inside the real domains the scan surface emits:
 * `snapshotSource` is `ScanSnapshotSource` ("refined" | "initial"), and
 * `scan_buy_clicked.verdict` is a `ScanVerdict`, a `ScanNeedMode` ("not_needed" |
 * "deferred"), or "merkliste" for a buy click out of the Merkliste sheet.
 */
const scanEventNames = [
  "scan_started",
  "scan_decoded",
  "scan_result_shown",
  "scan_not_found",
  "scan_submission_created",
  "scan_fallback_search_used",
  "scan_saved",
  "scan_buy_clicked",
] as const

test("Scan analytics is PostHog-only", () => {
  for (const eventName of scanEventNames) {
    assert.deepEqual(eventRoutes[eventName], { customerio: false, meta: false, posthog: true })
  }
})

test("noOpScanAnalytics never forwards events", () => {
  const calls: unknown[] = []
  const originalCapture = posthog.capture
  posthog.capture = ((...args: unknown[]) => {
    calls.push(args)
    return true
  }) as typeof posthog.capture

  try {
    noOpScanAnalytics.track("scan_started", {})
    noOpScanAnalytics.track("scan_buy_clicked", { verdict: "ideal" })
  } finally {
    posthog.capture = originalCapture
  }

  assert.equal(calls.length, 0)
})

test("Scan analytics factory only fires with analytics consent", () => {
  const calls: Array<{ eventName: string; payload: object }> = []
  const recordingTrackAppEvent = ((eventName: string, payload: object) =>
    calls.push({ eventName, payload })) as ScanAnalyticsPort["track"]

  const declined = createConsentAwareScanAnalytics({
    loadConsent: () => ({ essential: true, analytics: false, marketing: false, ts: 0 }),
    trackAppEvent: recordingTrackAppEvent,
  })
  declined.track("scan_started", {})
  declined.track("scan_buy_clicked", { verdict: "ideal" })
  assert.equal(calls.length, 0)

  const unset = createConsentAwareScanAnalytics({
    loadConsent: () => null,
    trackAppEvent: recordingTrackAppEvent,
  })
  unset.track("scan_started", {})
  assert.equal(calls.length, 0)

  const consented = createConsentAwareScanAnalytics({
    loadConsent: () => ({ essential: true, analytics: true, marketing: false, ts: 0 }),
    trackAppEvent: recordingTrackAppEvent,
  })
  consented.track("scan_started", {})
  consented.track("scan_decoded", { msToDecode: 812, format: "ean_13" })
  consented.track("scan_result_shown", {
    verdict: "ideal",
    category: "shampoo",
    inCatalog: true,
    snapshotSource: "refined",
  })
  consented.track("scan_not_found", {})
  consented.track("scan_submission_created", { category: "conditioner" })
  consented.track("scan_fallback_search_used", { trigger: "timeout" })
  consented.track("scan_saved", { kind: "routine", verdict: "ideal" })
  consented.track("scan_buy_clicked", { verdict: "mismatch" })

  assert.deepEqual(calls, [
    { eventName: "scan_started", payload: {} },
    { eventName: "scan_decoded", payload: { msToDecode: 812, format: "ean_13" } },
    {
      eventName: "scan_result_shown",
      payload: {
        verdict: "ideal",
        category: "shampoo",
        inCatalog: true,
        snapshotSource: "refined",
      },
    },
    { eventName: "scan_not_found", payload: {} },
    { eventName: "scan_submission_created", payload: { category: "conditioner" } },
    { eventName: "scan_fallback_search_used", payload: { trigger: "timeout" } },
    { eventName: "scan_saved", payload: { kind: "routine", verdict: "ideal" } },
    { eventName: "scan_buy_clicked", payload: { verdict: "mismatch" } },
  ])
})

test("Scan events map to PostHog with the documented snake_case properties", () => {
  const originalCapture = posthog.capture
  const calls: unknown[][] = []
  posthog.capture = ((...args: unknown[]) => {
    calls.push(args)
    return true
  }) as typeof posthog.capture

  try {
    postHogDestination.track("scan_started", {})
    postHogDestination.track("scan_decoded", { msToDecode: 900, format: "ean_8" })
    postHogDestination.track("scan_result_shown", {
      verdict: "not_needed",
      category: "oil",
      inCatalog: false,
      snapshotSource: "initial",
    })
    postHogDestination.track("scan_not_found", {})
    postHogDestination.track("scan_submission_created", { category: "mask" })
    postHogDestination.track("scan_fallback_search_used", { trigger: "manual" })
    postHogDestination.track("scan_saved", { kind: "merkliste", verdict: "supportive" })
    postHogDestination.track("scan_buy_clicked", { verdict: "merkliste" })
  } finally {
    posthog.capture = originalCapture
  }

  assert.deepEqual(calls, [
    ["scan_started", {}],
    ["scan_decoded", { ms_to_decode: 900, format: "ean_8" }],
    [
      "scan_result_shown",
      { verdict: "not_needed", category: "oil", in_catalog: false, snapshot_source: "initial" },
    ],
    ["scan_not_found", {}],
    ["scan_submission_created", { category: "mask" }],
    ["scan_fallback_search_used", { trigger: "manual" }],
    ["scan_saved", { kind: "merkliste", verdict: "supportive" }],
    ["scan_buy_clicked", { verdict: "merkliste" }],
  ])
})
