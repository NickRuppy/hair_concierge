import assert from "node:assert/strict"
import test from "node:test"

import { createSupabaseProductIntakeRepository } from "../src/lib/product-intake/repository"

type QueryCall = {
  table: string
  select: string | null
  eq: Array<{ column: string; value: unknown }>
}

function createAdminStub() {
  const calls: QueryCall[] = []

  return {
    calls,
    admin: {
      from(table: string) {
        const call: QueryCall = { table, select: null, eq: [] }
        calls.push(call)

        const query = {
          select(columns: string) {
            call.select = columns
            return query
          },
          eq(column: string, value: unknown) {
            call.eq.push({ column, value })
            return query
          },
          then<TResult1 = unknown, TResult2 = never>(
            onfulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | null,
            onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
          ) {
            const data = table === "products" || table === "product_identifiers" ? [] : null
            return Promise.resolve({ data, error: null }).then(onfulfilled, onrejected)
          },
        }

        return query
      },
    },
  }
}

test("loadCatalog defaults to the user-visible recommended product filter", async () => {
  const { admin, calls } = createAdminStub()
  const repository = createSupabaseProductIntakeRepository(admin as never)

  await repository.loadCatalog()

  const productsCall = calls.find((call) => call.table === "products")
  assert.ok(productsCall)
  assert.deepEqual(productsCall.eq, [
    { column: "is_active", value: true },
    { column: "lifecycle_status", value: "active" },
    { column: "is_chaarlie_recommended", value: true },
  ])
})

test("loadCatalog keeps the intake dedupe path open for all active products", async () => {
  const { admin, calls } = createAdminStub()
  const repository = createSupabaseProductIntakeRepository(admin as never)

  await repository.loadCatalog({ eligibilityMode: "intake_dedupe" })

  const productsCall = calls.find((call) => call.table === "products")
  assert.ok(productsCall)
  assert.deepEqual(productsCall.eq, [{ column: "is_active", value: true }])
})
