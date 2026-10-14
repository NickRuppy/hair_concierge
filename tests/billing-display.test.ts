import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import { formatBillingDate } from "../src/lib/billing/display"

test("manage subscription button resets loading after request failures", () => {
  const source = readFileSync("src/components/profile/manage-subscription-button.tsx", "utf8")

  assert.match(source, /try \{/)
  assert.match(source, /catch \{/)
  assert.match(source, /setLoading\(false\)/)
  assert.match(source, /Konnte Portal nicht öffnen\./)
})

test("billing renewal dates use German formatting and an empty-state dash", () => {
  const renewalAt = new Date(2026, 9, 20, 12, 0, 0).toISOString()
  assert.equal(formatBillingDate(renewalAt), "20.10.2026")
  assert.equal(formatBillingDate(null), "—")
  assert.equal(formatBillingDate(undefined), "—")
  assert.equal(formatBillingDate(""), "—")
})
