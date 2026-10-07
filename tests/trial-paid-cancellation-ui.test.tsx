import assert from "node:assert/strict"
import test from "node:test"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import {
  PaidCancellationConfirmation,
  supportsPaidPeriodCancellation,
} from "../src/components/profile/trial-paid-cancellation"
import type { TrialMembershipState } from "../src/lib/billing/trial-membership"
const state = {
  firstPaymentSucceededAt: "2024-02-29T10:00:00Z",
  paidThroughAt: "2025-02-28T10:00:00Z",
  interval: "year",
} as TrialMembershipState
test("paid cancellation confirmation preserves full paid access through the confirmed date", () => {
  const html = renderToStaticMarkup(
    <PaidCancellationConfirmation paidThroughAt="2026-10-14T10:00:00Z" />,
  )
  assert.match(html, /bereits bezahlten Zugang/)
  assert.match(html, /14\. Oktober 2026/)
  assert.match(html, /verkürzt deinen bezahlten Zugang nicht/)
})
test("first annual period permits cancellation at its end including leap day; later renewal uses statutory path", () => {
  assert.equal(supportsPaidPeriodCancellation(state), true)
  assert.equal(
    supportsPaidPeriodCancellation({ ...state, paidThroughAt: "2026-02-28T10:00:00Z" }),
    false,
  )
  assert.equal(supportsPaidPeriodCancellation({ ...state, firstPaymentSucceededAt: null }), false)
  assert.equal(supportsPaidPeriodCancellation({ ...state, interval: "month" }), true)
})
