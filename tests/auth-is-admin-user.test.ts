import assert from "node:assert/strict"
import test from "node:test"

import { isAdminUser } from "@/lib/auth/is-admin-user"

function profileClient(result: { data: unknown; error: unknown } | "throw") {
  const calls: string[] = []
  const client = {
    from(table: string) {
      calls.push(`from:${table}`)
      return {
        select(columns: string) {
          calls.push(`select:${columns}`)
          return {
            eq(column: string, value: string) {
              calls.push(`eq:${column}:${value}`)
              return {
                async maybeSingle() {
                  if (result === "throw") throw new Error("network down")
                  return result
                },
              }
            },
          }
        },
      }
    },
  }
  return { client: client as never, calls }
}

test("reads only the caller's own profiles.is_admin flag", async () => {
  const { client, calls } = profileClient({ data: { is_admin: true }, error: null })
  assert.equal(await isAdminUser("user-1", client), true)
  assert.deepEqual(calls, ["from:profiles", "select:is_admin", "eq:id:user-1"])
})

test("a false or missing flag is not admin", async () => {
  assert.equal(
    await isAdminUser("u", profileClient({ data: { is_admin: false }, error: null }).client),
    false,
  )
  assert.equal(await isAdminUser("u", profileClient({ data: {}, error: null }).client), false)
  assert.equal(await isAdminUser("u", profileClient({ data: null, error: null }).client), false)
})

test("only the boolean true counts (no truthy coercion)", async () => {
  for (const value of ["true", 1, "yes", {}]) {
    assert.equal(
      await isAdminUser("u", profileClient({ data: { is_admin: value }, error: null }).client),
      false,
    )
  }
})

test("any read error or thrown failure fails closed", async () => {
  assert.equal(
    await isAdminUser(
      "u",
      profileClient({ data: { is_admin: true }, error: { message: "rls" } }).client,
    ),
    false,
  )
  assert.equal(await isAdminUser("u", profileClient("throw").client), false)
})
