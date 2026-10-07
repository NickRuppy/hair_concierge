import assert from "node:assert/strict"
import test from "node:test"
import { parsePayPalTrialTransactions } from "../src/lib/paypal/trial-runtime"

test("live HTTP200 empty-object transaction response is a valid empty window", () => {
  // Sanitized production observation, 2026-09-14: HTTP200, Object.keys(body)=[], body={}.
  // PayPal's published transactions_list schema has no required properties.
  assert.deepEqual(parsePayPalTrialTransactions({}), [])
  assert.deepEqual(
    parsePayPalTrialTransactions({ transactions: [], total_items: 0, total_pages: 0 }),
    [],
  )
})
test("empty-window compatibility never hides malformed, omitted-positive, or incomplete pages", () => {
  for (const value of [
    null,
    [],
    "",
    { name: "RATE_LIMIT_REACHED" },
    { total_items: 1, total_pages: 1 },
    { transactions: null },
    { transactions: [], total_items: 1 },
    { transactions: [], total_pages: 2 },
  ])
    assert.throws(() => parsePayPalTrialTransactions(value), /reconciliation/)
})
test("nonempty complete transaction lists retain exact payment evidence", () => {
  const transactions = [
    {
      id: "sale",
      status: "COMPLETED",
      time: "2026-09-14T10:00:00Z",
      amount_with_breakdown: { gross_amount: { currency_code: "EUR", value: "9.99" } },
    },
  ]
  assert.deepEqual(
    parsePayPalTrialTransactions({ transactions, total_items: 1, total_pages: 1 }),
    transactions,
  )
})
