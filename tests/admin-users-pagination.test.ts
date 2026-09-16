import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"
import test from "node:test"
import ts from "typescript"
import vm from "node:vm"

const require = createRequire(import.meta.url)
const routeSource = readFileSync(
  new URL("../src/app/api/admin/users/route.ts", import.meta.url),
  "utf8",
)

type Route = (request: Request) => Promise<Response>

function loadRoute({
  user = { id: "admin" } as { id: string } | null,
  isAdmin = true,
  users = [],
  total = users.length,
}: {
  user?: { id: string } | null
  isAdmin?: boolean
  users?: Array<{ id: string }>
  total?: number
} = {}): { GET: Route; calls: Array<unknown[]> } {
  const calls: Array<unknown[]> = []
  const profileQuery = {
    select: () => profileQuery,
    eq: () => profileQuery,
    single: async () => ({ data: isAdmin ? { is_admin: true } : { is_admin: false } }),
    order: (...args: unknown[]) => {
      calls.push(["order", ...args])
      return profileQuery
    },
    range: async (...args: unknown[]) => {
      calls.push(["range", ...args])
      return { data: users, count: total, error: null }
    },
  }
  const billingQuery = {
    select: () => billingQuery,
    in: () => billingQuery,
    order: async () => ({ data: [], error: null }),
  }
  const mocks: Record<string, unknown> = {
    "@/lib/supabase/server": {
      createClient: async () => ({
        auth: { getUser: async () => ({ data: { user } }) },
        from: (table: string) => {
          assert.equal(table, "profiles")
          return profileQuery
        },
      }),
    },
    "@/lib/supabase/admin": {
      createAdminClient: () => ({ from: () => billingQuery }),
    },
  }
  const code = ts.transpileModule(routeSource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText
  const module = { exports: {} as { GET: Route } }
  vm.runInThisContext(`(function(require,module,exports){${code}\n})`, {
    filename: path.resolve("src/app/api/admin/users/route.ts"),
  })(
    (specifier: string) =>
      mocks[specifier] ??
      require(specifier.startsWith("@/") ? path.resolve("src", specifier.slice(2)) : specifier),
    module,
    module.exports,
  )
  return { GET: module.exports.GET, calls }
}

test("admin users pagination rejects unauthenticated and non-admin callers before listing profiles", async () => {
  const unauthenticated = loadRoute({ user: null })
  const forbidden = loadRoute({ isAdmin: false })

  assert.equal(
    (await unauthenticated.GET(new Request("https://example.test/api/admin/users"))).status,
    401,
  )
  assert.equal(
    (await forbidden.GET(new Request("https://example.test/api/admin/users"))).status,
    403,
  )
  assert.deepEqual(unauthenticated.calls, [])
  assert.deepEqual(forbidden.calls, [])
})

test("admin users pagination uses bounded default and nonzero ranges, preserves the database total, and breaks timestamp ties by id", async () => {
  const first = loadRoute({
    users: Array.from({ length: 50 }, (_, index) => ({ id: `u-${index}` })),
    total: 123,
  })
  const firstResponse = await first.GET(new Request("https://example.test/api/admin/users"))
  assert.equal(firstResponse.status, 200)
  assert.deepEqual(await firstResponse.json(), {
    users: Array.from({ length: 50 }, (_, index) => ({
      id: `u-${index}`,
      current_billing_subscription: null,
    })),
    total: 123,
  })
  assert.deepEqual(first.calls, [
    ["order", "created_at", { ascending: false }],
    ["order", "id", { ascending: false }],
    ["range", 0, 49],
  ])

  const older = loadRoute({ users: [{ id: "oldest" }], total: 123 })
  const olderResponse = await older.GET(
    new Request("https://example.test/api/admin/users?limit=999&offset=100"),
  )
  assert.equal(olderResponse.status, 200)
  assert.deepEqual(older.calls, [
    ["order", "created_at", { ascending: false }],
    ["order", "id", { ascending: false }],
    ["range", 100, 199],
  ])
  assert.equal(((await olderResponse.json()) as { total: number }).total, 123)
})

test("admin users pagination clamps malformed, negative, and oversized query values at the API boundary", async () => {
  const route = loadRoute()
  await route.GET(new Request("https://example.test/api/admin/users?limit=not-a-number&offset=-4"))
  assert.deepEqual(route.calls.slice(-3), [
    ["order", "created_at", { ascending: false }],
    ["order", "id", { ascending: false }],
    ["range", 0, 49],
  ])
})
