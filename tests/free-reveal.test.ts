import assert from "node:assert/strict"
import test from "node:test"

import { consumeFreeReveal, hasUsedFreeReveal } from "../src/lib/entitlements/free-reveal"

type FakeRow = { user_id: string; product_id: string }

/**
 * Stateful fake of `public.scan_free_reveals`: a Map keyed by `user_id`
 * mirrors the table's PRIMARY KEY, so a second insert for the same user
 * fails with the same Postgres unique-violation shape the real accessor
 * checks for (`code: "23505"`). This proves the accessor's atomicity
 * through actual PK-conflict semantics rather than a canned response.
 */
function createFakeFreeRevealClient() {
  const rows = new Map<string, FakeRow>()
  let insertCalls = 0
  let selectCalls = 0

  const client = {
    from: (table: string) => {
      assert.equal(table, "scan_free_reveals")
      return {
        select: (columns: string) => {
          assert.equal(columns, "user_id")
          return {
            eq: (column: string, value: string) => {
              assert.equal(column, "user_id")
              return {
                maybeSingle: async () => {
                  selectCalls += 1
                  const row = rows.get(value)
                  return { data: row ? { user_id: row.user_id } : null, error: null }
                },
              }
            },
          }
        },
        insert: async (values: FakeRow) => {
          insertCalls += 1
          if (rows.has(values.user_id)) {
            return {
              error: {
                code: "23505",
                message: 'duplicate key value violates unique constraint "scan_free_reveals_pkey"',
              },
            }
          }
          rows.set(values.user_id, values)
          return { error: null }
        },
      }
    },
  }

  return {
    client,
    rows,
    get insertCalls() {
      return insertCalls
    },
    get selectCalls() {
      return selectCalls
    },
  }
}

test("hasUsedFreeReveal: false when no row exists for the user", async () => {
  const { client } = createFakeFreeRevealClient()

  const result = await hasUsedFreeReveal(client as never, "user-1")

  assert.equal(result, false)
})

test("hasUsedFreeReveal: true once a reveal has been consumed", async () => {
  const { client } = createFakeFreeRevealClient()

  await consumeFreeReveal(client as never, { userId: "user-1", productId: "product-a" })
  const result = await hasUsedFreeReveal(client as never, "user-1")

  assert.equal(result, true)
})

test("hasUsedFreeReveal: does not leak across users", async () => {
  const { client } = createFakeFreeRevealClient()

  await consumeFreeReveal(client as never, { userId: "user-1", productId: "product-a" })

  assert.equal(await hasUsedFreeReveal(client as never, "user-1"), true)
  assert.equal(await hasUsedFreeReveal(client as never, "user-2"), false)
})

test("consumeFreeReveal: first consume for a user returns consumed", async () => {
  const { client, rows } = createFakeFreeRevealClient()

  const result = await consumeFreeReveal(client as never, {
    userId: "user-1",
    productId: "product-a",
  })

  assert.equal(result, "consumed")
  assert.deepEqual(rows.get("user-1"), { user_id: "user-1", product_id: "product-a" })
})

test("consumeFreeReveal: second consume for the same user returns already_used", async () => {
  const { client, rows } = createFakeFreeRevealClient()

  const first = await consumeFreeReveal(client as never, {
    userId: "user-1",
    productId: "product-a",
  })
  const second = await consumeFreeReveal(client as never, {
    userId: "user-1",
    productId: "product-b",
  })

  assert.equal(first, "consumed")
  assert.equal(second, "already_used")
  // The original row stands -- a second consume never overwrites what the
  // credit was spent on.
  assert.deepEqual(rows.get("user-1"), { user_id: "user-1", product_id: "product-a" })
})

test("consumeFreeReveal: relies on the insert's own PK conflict, never reads first", async () => {
  const fake = createFakeFreeRevealClient()

  await consumeFreeReveal(fake.client as never, { userId: "user-1", productId: "product-a" })
  await consumeFreeReveal(fake.client as never, { userId: "user-1", productId: "product-b" })

  assert.equal(fake.insertCalls, 2)
  assert.equal(fake.selectCalls, 0)
})

test("consumeFreeReveal: different users each get their own one-time credit", async () => {
  const { client } = createFakeFreeRevealClient()

  const userOne = await consumeFreeReveal(client as never, {
    userId: "user-1",
    productId: "product-a",
  })
  const userTwo = await consumeFreeReveal(client as never, {
    userId: "user-2",
    productId: "product-b",
  })

  assert.equal(userOne, "consumed")
  assert.equal(userTwo, "consumed")
})

test("hasUsedFreeReveal: throws on an unexpected lookup error", async () => {
  const client = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null, error: { message: "connection reset" } }),
        }),
      }),
    }),
  }

  await assert.rejects(
    () => hasUsedFreeReveal(client as never, "user-1"),
    /free_reveal_lookup_failed/,
  )
})

test("consumeFreeReveal: throws on an unexpected insert error", async () => {
  const client = {
    from: () => ({
      insert: async () => ({ error: { code: "42501", message: "permission denied" } }),
    }),
  }

  await assert.rejects(
    () => consumeFreeReveal(client as never, { userId: "user-1", productId: "product-a" }),
    /free_reveal_consume_failed/,
  )
})
