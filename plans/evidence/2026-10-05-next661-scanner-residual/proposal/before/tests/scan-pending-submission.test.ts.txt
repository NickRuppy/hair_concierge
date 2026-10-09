import assert from "node:assert/strict"
import test from "node:test"

import { findOpenScanSubmission } from "../src/lib/scan/pending-submission"

function stubClient(response: { data: unknown; error: unknown }) {
  const filters = new Map<string, unknown>()
  const chain = {
    select: () => chain,
    eq: (column: string, value: unknown) => {
      filters.set(column, value)
      return chain
    },
    in: (column: string, values: unknown) => {
      filters.set(column, values)
      return chain
    },
    order: () => chain,
    limit: () => chain,
    maybeSingle: async () => response,
  }
  const client = {
    from: (table: string) => {
      assert.equal(table, "product_submissions")
      return chain
    },
  }
  return { client, filters }
}

test("findOpenScanSubmission: open submission found", async () => {
  const { client, filters } = stubClient({
    data: { id: "sub-1", status: "researching" },
    error: null,
  })

  const result = await findOpenScanSubmission(client as never, "user-1", "4006381333931")

  assert.deepEqual(result, { submissionId: "sub-1", status: "researching" })
  assert.equal(filters.get("user_id"), "user-1")
  // Every GTIN spelling of the same number (see the variants test below).
  assert.deepEqual(filters.get("scanned_identifier_value"), ["4006381333931", "04006381333931"])
  assert.deepEqual([...(filters.get("status") as string[])].sort(), [
    "needs_more_info",
    "pending_review",
    "ready_for_review",
    "researching",
  ])
})

test("findOpenScanSubmission: no open submission is null", async () => {
  const { client } = stubClient({ data: null, error: null })

  const result = await findOpenScanSubmission(client as never, "user-1", "4006381333931")

  assert.equal(result, null)
})

test("findOpenScanSubmission: queries every GTIN spelling of the same number", async () => {
  const { client, filters } = stubClient({ data: null, error: null })

  await findOpenScanSubmission(client as never, "user-1", "0022796976116")

  assert.deepEqual(filters.get("scanned_identifier_value"), [
    "0022796976116",
    "00022796976116",
    "022796976116",
  ])
})
