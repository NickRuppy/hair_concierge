import assert from "node:assert/strict"
import test from "node:test"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import {
  TrialPaidRecoveryTerms,
  parseTrialPaidRecoveryView,
  type TrialPaidRecoveryView,
} from "../src/components/profile/trial-paid-recovery-actions"
const view: TrialPaidRecoveryView = {
  enrollmentId: "22222222-2222-4222-8222-222222222222",
  revision: 0,
  originalTrialEndAt: "2026-01-08T10:00:00Z",
  paidThroughAt: null,
  cancelAtPeriodEnd: true,
  kind: "recover_unpaid",
  pendingOperation: null,
  offer: { interval: "year", currency: "EUR", firstAmountMinor: 6999, renewalAmountMinor: 9999 },
}
test("unpaid confirmation explicitly begins paid access only after payment with full period and no new trial", () => {
  const html = renderToStaticMarkup(
    <TrialPaidRecoveryTerms view={view} kind="recover_unpaid" />,
  ).replace(/\u00a0/g, " ")
  assert.match(html, /69,99/)
  assert.match(html, /99,99/)
  assert.match(html, /bestätigten Zahlung/)
  assert.match(html, /voller Jahreszeitraum/)
  assert.match(html, /keine weitere kostenlose Testphase/)
})
test("paid date repair confirmation preserves coverage and shows only the next renewal amount", () => {
  const paid = { ...view, kind: "repair_paid" as const, paidThroughAt: "2026-10-14T10:00:00Z" }
  const html = renderToStaticMarkup(
    <TrialPaidRecoveryTerms view={paid} kind="repair_paid" />,
  ).replace(/\u00a0/g, " ")
  assert.match(html, /bereits bezahlt/)
  assert.match(html, /14\.10\.2026/)
  assert.match(html, /Heute wird nichts zusätzlich abgebucht/)
  assert.match(html, /99,99/)
  assert.doesNotMatch(html, /69,99/)
})
test("invalid or mixed paid recovery state fails closed before confirmation", () => {
  assert.ok(parseTrialPaidRecoveryView(view, view.enrollmentId))
  for (const extra of [
    { enrollmentId: "other" },
    { revision: -1 },
    { kind: "free_trial" },
    { kind: "repair_paid", paidThroughAt: null },
    { offer: { ...view.offer, currency: "USD" } },
  ])
    assert.equal(parseTrialPaidRecoveryView({ ...view, ...extra }, view.enrollmentId), null)
})
