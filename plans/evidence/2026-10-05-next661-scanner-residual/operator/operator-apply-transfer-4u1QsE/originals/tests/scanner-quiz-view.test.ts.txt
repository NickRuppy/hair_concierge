import assert from "node:assert/strict"
import test from "node:test"
import { postHogDestination } from "../src/lib/analytics/destinations/posthog"
import { posthog } from "../src/lib/analytics/runtime/posthog"
import { eventRoutes } from "../src/lib/analytics/routes"
import { createScannerQuizViewTracker } from "../src/lib/analytics/scanner-quiz-view"

test("scanner quiz view emits once with event-time timestamp only for scan_v1", async () => {
  const events: unknown[] = []
  const tracker = createScannerQuizViewTracker({
    bootstrap: async () => ({
      entryPath: "/lp/scan",
      funnelPackageKey: "scan_v1",
      funnelSessionId: "session-1",
      isInternalTest: true,
      issuedAt: Date.parse("2026-09-15T09:30:00.000Z"),
      testKind: "field_test",
      utmCampaign: "scanner-launch",
      utmContent: "video-a",
      utmMedium: "paid_social",
      utmSource: "meta",
      utmTerm: "haarausfall",
    }),
    createId: () => "view-1",
    now: () => "2026-09-15T10:00:00.000Z",
    track: ((_: string, payload: unknown) => events.push(payload)) as never,
  })
  tracker({ displayedFunnelPackageKey: "scan_v1", step: 17, resumed: true })
  tracker({ displayedFunnelPackageKey: "scan_v1", step: 18, resumed: true })
  await Promise.resolve()
  assert.deepEqual(events, [
    {
      entryAt: "2026-09-15T09:30:00.000Z",
      entryPath: "/lp/scan",
      funnelEventId: "view-1",
      funnelPackageKey: "scan_v1",
      funnelSessionId: "session-1",
      isResumed: true,
      isInternalTest: true,
      quizStep: 17,
      quizViewId: "view-1",
      scannerTrackingVersion: 1,
      testKind: "field_test",
      utmCampaign: "scanner-launch",
      utmContent: "video-a",
      utmMedium: "paid_social",
      utmSource: "meta",
      utmTerm: "haarausfall",
      viewedAt: "2026-09-15T10:00:00.000Z",
    },
  ])
})

test("an ordinary displayed quiz never emits even if a late lookup identifies scan_v1", async () => {
  const events: unknown[] = []
  createScannerQuizViewTracker({
    bootstrap: async () => ({ funnelPackageKey: "scan_v1", funnelSessionId: "session-2" }),
    track: ((_: string, payload: unknown) => events.push(payload)) as never,
  })({ displayedFunnelPackageKey: "organic_v1", step: 2, resumed: false })
  await Promise.resolve()
  assert.deepEqual(events, [])
})

test("a no-longer-current scanner mount is not backdated after context resolves", async () => {
  const events: unknown[] = []
  let resolveContext: (value: { funnelPackageKey: string; funnelSessionId: string }) => void
  const context = new Promise<{ funnelPackageKey: string; funnelSessionId: string }>((resolve) => {
    resolveContext = resolve
  })
  let current = true
  const tracker = createScannerQuizViewTracker({
    bootstrap: () => context,
    track: ((_: string, payload: unknown) => events.push(payload)) as never,
  })
  tracker({
    displayedFunnelPackageKey: "scan_v1",
    isCurrent: () => current,
    step: 2,
    resumed: false,
  })
  current = false
  resolveContext!({ funnelPackageKey: "scan_v1", funnelSessionId: "session-2" })
  await Promise.resolve()
  assert.deepEqual(events, [])
})

test("a failed context lookup retries with the original mount snapshot", async () => {
  const events: unknown[] = []
  let calls = 0
  const tracker = createScannerQuizViewTracker({
    bootstrap: async () => {
      calls += 1
      return calls === 1 ? null : { funnelPackageKey: "scan_v1", funnelSessionId: "session-3" }
    },
    createId: () => "view-retry",
    now: () => "2026-09-15T10:15:00.000Z",
    retry: (callback) => callback(),
    track: ((_: string, payload: unknown) => events.push(payload)) as never,
  })

  tracker({ displayedFunnelPackageKey: "scan_v1", step: 4, resumed: false })
  for (let index = 0; index < 4; index += 1) await Promise.resolve()
  assert.equal(calls, 2)
  assert.deepEqual(events, [
    {
      funnelEventId: "view-retry",
      funnelPackageKey: "scan_v1",
      funnelSessionId: "session-3",
      isResumed: false,
      quizStep: 4,
      quizViewId: "view-retry",
      scannerTrackingVersion: 1,
      viewedAt: "2026-09-15T10:15:00.000Z",
    },
  ])
})

test("each rendered mount gets one distinct scanner view", async () => {
  const events: unknown[] = []
  let nextId = 0
  const options = {
    bootstrap: async () => ({ funnelPackageKey: "scan_v1", funnelSessionId: "session-4" }),
    createId: () => `view-${++nextId}`,
    track: ((_: string, payload: unknown) => events.push(payload)) as never,
  }
  const firstMount = createScannerQuizViewTracker(options)
  const secondMount = createScannerQuizViewTracker(options)

  firstMount({ displayedFunnelPackageKey: "scan_v1", step: 2, resumed: false })
  firstMount({ displayedFunnelPackageKey: "scan_v1", step: 3, resumed: true })
  secondMount({ displayedFunnelPackageKey: "scan_v1", step: 6, resumed: true })
  await Promise.resolve()

  assert.deepEqual(
    (events as Array<{ quizViewId: string; quizStep: number }>).map(({ quizViewId, quizStep }) => ({
      quizStep,
      quizViewId,
    })),
    [
      { quizStep: 2, quizViewId: "view-1" },
      { quizStep: 6, quizViewId: "view-2" },
    ],
  )
})

test("scanner quiz views are PostHog-only and map their bounded snapshot", () => {
  assert.deepEqual(eventRoutes.scanner_quiz_viewed, {
    customerio: false,
    meta: false,
    posthog: true,
  })
  const calls: Array<{ eventName: string; properties: Record<string, unknown> }> = []
  const originalCapture = posthog.capture
  posthog.capture = ((eventName: string, properties: Record<string, unknown>) => {
    calls.push({ eventName, properties })
    return true
  }) as typeof posthog.capture
  try {
    postHogDestination.track("scanner_quiz_viewed", {
      entryAt: "2026-09-15T09:30:00.000Z",
      entryPath: "/lp/scan",
      funnelEventId: "view-5",
      funnelPackageKey: "scan_v1",
      funnelSessionId: "session-5",
      isInternalTest: false,
      isResumed: false,
      quizStep: 2,
      quizViewId: "view-5",
      scannerTrackingVersion: 1,
      testKind: "partner",
      utmCampaign: "scanner-launch",
      utmMedium: "paid_social",
      utmSource: "meta",
      viewedAt: "2026-09-15T10:00:00.000Z",
    })
  } finally {
    posthog.capture = originalCapture
  }
  assert.deepEqual(calls, [
    {
      eventName: "scanner_quiz_viewed",
      properties: {
        $insert_id: "view-5",
        entry_at: "2026-09-15T09:30:00.000Z",
        entry_path: "/lp/scan",
        funnel_package_key: "scan_v1",
        funnel_session_id: "session-5",
        is_internal_test: false,
        is_resumed: false,
        quiz_step: 2,
        quiz_view_id: "view-5",
        scanner_tracking_version: 1,
        test_kind: "partner",
        utm_campaign: "scanner-launch",
        utm_medium: "paid_social",
        utm_source: "meta",
        viewed_at: "2026-09-15T10:00:00.000Z",
      },
    },
  ])
})

test("incomplete scanner metadata retries before capture and persistent failure emits no view", async () => {
  for (const recover of [true, false]) {
    let calls = 0
    const events: unknown[] = []
    const tracker = createScannerQuizViewTracker({
      bootstrap: async () => ({
        funnelSessionId: "session-partial",
        funnelPackageKey: "scan_v1",
        analyticsContextReady: ++calls > 1 && recover,
        ...(calls > 1 && recover ? { isInternalTest: true, utmSource: "meta" } : {}),
      }),
      retry: (callback) => callback(),
      track: ((_: string, payload: unknown) => events.push(payload)) as never,
    })
    tracker({ displayedFunnelPackageKey: "scan_v1", step: 2, resumed: false })
    for (let i = 0; i < 10; i += 1) await Promise.resolve()
    assert.equal(events.length, recover ? 1 : 0)
    assert.equal(calls, recover ? 2 : 3)
    if (recover) assert.equal((events[0] as { isInternalTest: boolean }).isInternalTest, true)
  }
})
