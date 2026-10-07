import assert from "node:assert/strict"
import test from "node:test"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import {
  TrialManagementTerms,
  parseTrialManagementView,
  type TrialManagementView,
} from "../src/components/profile/trial-management-actions"
const view: TrialManagementView = {
  enrollmentId: "22222222-2222-4222-8222-222222222222",
  revision: 0,
  interval: "month",
  originalTrialEndAt: "2090-01-08T10:00:00Z",
  cancelAtPeriodEnd: false,
  canManage: true,
  pendingOperation: null,
  offers: {
    month: { interval: "month", currency: "EUR", firstAmountMinor: 999, renewalAmountMinor: 999 },
    year: { interval: "year", currency: "EUR", firstAmountMinor: 6999, renewalAmountMinor: 9999 },
  },
}
test("real confirmation layout shows selected frozen first and renewal totals with original deadline", () => {
  const html = renderToStaticMarkup(
    <TrialManagementTerms view={view} kind="switch" interval="year" />,
  ).replace(/\u00a0/g, " ")
  assert.match(html, /69,99/)
  assert.match(html, /99,99/)
  assert.match(html, /08\.01\.2090/)
  assert.match(html, /Heute zahlst du nichts/)
  assert.match(html, /bis du kündigst/)
  const month = renderToStaticMarkup(
    <TrialManagementTerms view={view} kind="switch" interval="month" />,
  ).replace(/\u00a0/g, " ")
  assert.match(month, /9,99/)
  assert.doesNotMatch(month, /zweiten Jahr/)
})
test("canceled switch preserves cancellation; restore requires verified confirmation without additional trial days", () => {
  const canceled = { ...view, cancelAtPeriodEnd: true }
  const switched = renderToStaticMarkup(
    <TrialManagementTerms view={canceled} kind="switch" interval="year" />,
  )
  assert.match(switched, /Deine Kündigung bleibt bestehen/)
  assert.match(switched, /Es wird nichts abgebucht/)
  const restored = renderToStaticMarkup(
    <TrialManagementTerms view={canceled} kind="restore" interval="month" />,
  )
  assert.match(restored, /Bis die Fortsetzung bestätigt ist, bleibt deine Kündigung wirksam/)
  assert.match(restored, /endet weiterhin/)
  assert.doesNotMatch(restored, /7 Tage|sieben Tage/)
})
test("malformed or foreign public state cannot produce an actionable confirmation", () => {
  assert.ok(parseTrialManagementView(view, view.enrollmentId))
  for (const mutation of [
    { enrollmentId: "foreign" },
    { revision: -1 },
    { originalTrialEndAt: "invalid" },
    { offers: { ...view.offers, month: { ...view.offers.month, firstAmountMinor: NaN } } },
    { pendingOperation: { operationId: "foreign", kind: "restore", targetInterval: "month" } },
  ])
    assert.equal(parseTrialManagementView({ ...view, ...mutation }, view.enrollmentId), null)
})
