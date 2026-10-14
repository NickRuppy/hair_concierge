import assert from "node:assert/strict"
import test from "node:test"

import { postHogDestination } from "../src/lib/analytics/destinations/posthog"
import { posthog } from "../src/lib/analytics/runtime/posthog"
import { eventRoutes } from "../src/lib/analytics/routes"

const context = {
  entryContext: "quiz_completion" as const,
  focusRoutine: false,
  funnelPackageKey: "scan_v1",
  funnelSessionId: "scanner-session",
  isInternalTest: false,
  leadId: "lead-1",
  offerRevision: "scan_regal_refinement_v20",
  offerVariant: "scan-regal-v1",
  offerViewId: "offer-view-1",
  testKind: null,
}

test("scanner offer content events are PostHog-only", () => {
  for (const eventName of ["offer_content_interacted", "offer_content_viewed"] as const)
    assert.deepEqual(eventRoutes[eventName], {
      customerio: false,
      meta: false,
      posthog: true,
    })
})

test("scanner offer content interactions retain the offer envelope and omit an absent section", () => {
  const calls: { eventName: string; properties: Record<string, unknown> }[] = []
  const originalCapture = posthog.capture
  posthog.capture = ((eventName: string, properties: Record<string, unknown>) => {
    calls.push({ eventName, properties })
    return true
  }) as typeof posthog.capture

  try {
    postHogDestination.track("offer_content_interacted", {
      ...context,
      action: "clicked",
      actionIndex: 3,
      contentType: "scanner_whatsapp",
      funnelEventId: "event-1",
      placement: "floating",
    })
    postHogDestination.track("offer_content_viewed", {
      ...context,
      contentId: "chat",
      contentType: "scanner_benefit_carousel",
      funnelEventId: "event-2",
      sourceSection: "product_tour",
    })
  } finally {
    posthog.capture = originalCapture
  }

  assert.equal(calls.length, 2)
  assert.equal(calls[0].eventName, "offer_content_interacted")
  assert.deepEqual(
    {
      action: calls[0].properties.action,
      actionIndex: calls[0].properties.action_index,
      contentType: calls[0].properties.content_type,
      offerViewId: calls[0].properties.offer_view_id,
      placement: calls[0].properties.placement,
      sourceSection: calls[0].properties.source_section,
    },
    {
      action: "clicked",
      actionIndex: 3,
      contentType: "scanner_whatsapp",
      offerViewId: "offer-view-1",
      placement: "floating",
      sourceSection: undefined,
    },
  )
  assert.equal(calls[0].properties.$insert_id, "event-1")
  assert.equal(calls[0].properties.funnel_session_id, "scanner-session")
  assert.equal(calls[0].properties.funnel_package_key, "scan_v1")

  assert.equal(calls[1].eventName, "offer_content_viewed")
  assert.deepEqual(
    {
      contentId: calls[1].properties.content_id,
      contentType: calls[1].properties.content_type,
      sourceSection: calls[1].properties.source_section,
    },
    {
      contentId: "chat",
      contentType: "scanner_benefit_carousel",
      sourceSection: "product_tour",
    },
  )
  assert.equal(calls[1].properties.$insert_id, "event-2")
})
