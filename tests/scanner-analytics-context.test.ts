import assert from "node:assert/strict"
import test from "node:test"
import { buildScannerAnalyticsContext } from "../src/lib/funnel/analytics-context"

const context = {
  sessionId: "session",
  visitorId: "visitor",
  packageKey: "scan_v1",
  issuedAt: 1000,
}
const touch = {
  sessionId: "session",
  visitorId: "visitor",
  capturedAt: 2000,
  entryPath: "/lp/scan",
  utmSource: "meta",
  utmCampaign: "new-campaign",
  fbclid: "private",
}
test("durable original source wins after touch consumed or replaced; only safe acquisition fields leave server", () => {
  const row = {
    entry_path: "/lp/scan",
    first_touch: { utm_source: "facebook", utm_campaign: "original", fbclid: "private" },
    first_seen_at: "2026-09-15T10:00:00Z",
    is_internal_test: false,
    test_kind: null,
  }
  for (const pending of [null, touch]) {
    const result = buildScannerAnalyticsContext(context, row, pending)
    assert.equal(result.utmSource, "facebook")
    assert.equal(result.utmCampaign, "original")
    assert.equal(result.entryPath, "/lp/scan")
    assert.equal(JSON.stringify(result).includes("private"), false)
  }
})
test("new scanner context uses signed matching touch, never a different journey or failed lookup fallback", () => {
  assert.equal(buildScannerAnalyticsContext(context, null, touch).utmSource, "meta")
  assert.equal(
    buildScannerAnalyticsContext(context, null, { ...touch, sessionId: "other" }).utmSource,
    undefined,
  )
  assert.equal(buildScannerAnalyticsContext(context, null, touch, true).utmSource, undefined)
  assert.equal(
    buildScannerAnalyticsContext({ ...context, packageKey: "default_organic" }, null, touch)
      .utmSource,
    undefined,
  )
})
test("safe source does not reveal raw dynamic paths, querystrings or unsupported values", () => {
  const result = buildScannerAnalyticsContext(
    context,
    {
      entry_path: "/result/private?token=secret",
      first_touch: { utm_campaign: { secret: "value" }, utm_source: "  meta  " },
      is_internal_test: true,
      test_kind: "partner",
    },
    null,
  )
  assert.equal(result.entryPath, undefined)
  assert.equal(result.utmCampaign, undefined)
  assert.equal(result.utmSource, "meta")
  assert.equal(result.isInternalTest, true)
  assert.equal(result.testKind, "partner")
  assert.equal(result.funnelSessionId, "session")
  assert.equal(result.funnelPackageKey, "scan_v1")
})
