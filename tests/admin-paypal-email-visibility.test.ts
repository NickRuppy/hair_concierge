import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"
import vm from "node:vm"
import test from "node:test"
import ts from "typescript"

const require = createRequire(import.meta.url)

const adminUsersRouteSource = readFileSync(
  new URL("../src/app/api/admin/users/route.ts", import.meta.url),
  "utf8",
)
const adminUsersPageSource = readFileSync(
  new URL("../src/app/admin/users/page.tsx", import.meta.url),
  "utf8",
)

test("admin users API merges visible billing subscription data with provider subscriber email", async () => {
  const users = [{ id: "user-visible", email: "chaarlie@example.test" }, { id: "user-expired" }]
  const visible = {
    user_id: users[0].id,
    provider: "paypal",
    provider_subscriber_email: "paypal@example.test",
    entitlement_status: "active",
    current_period_end: null,
    metadata: {},
  }
  const expired = {
    ...visible,
    user_id: users[1].id,
    current_period_end: "2020-01-01T00:00:00Z",
  }
  let selected = ""
  const filters: unknown[] = []
  const profileQuery = {
    select: () => profileQuery,
    eq: () => profileQuery,
    single: async () => ({ data: { is_admin: true } }),
    order: () => profileQuery,
    range: async () => ({ data: users, count: users.length, error: null }),
  }
  const billingQuery = {
    select: (columns: string) => {
      selected = columns
      return billingQuery
    },
    in: (key: string, values: string[]) => {
      filters.push([key, values])
      return billingQuery
    },
    order: async () => ({
      data: [visible, expired].map((row) =>
        selected === "*"
          ? row
          : Object.fromEntries(
              Object.entries(row).filter(([key]) =>
                selected
                  .split(",")
                  .map((column) => column.trim())
                  .includes(key),
              ),
            ),
      ),
      error: null,
    }),
  }
  const leadFilters: unknown[] = []
  const leadsQuery = {
    select: () => leadsQuery,
    in: (key: string, values: string[]) => {
      leadFilters.push([key, values])
      return leadsQuery
    },
    order: async () => ({
      data: [{ email: "chaarlie@example.test", name: "Marie", created_at: "2026-01-01" }],
      error: null,
    }),
  }
  const mocks: Record<string, unknown> = {
    "@/lib/supabase/server": {
      createClient: async () => ({
        auth: { getUser: async () => ({ data: { user: { id: "admin" } } }) },
        from: (table: string) => {
          assert.equal(table, "profiles")
          return profileQuery
        },
      }),
    },
    "@/lib/supabase/admin": {
      createAdminClient: () => ({
        from: (table: string) => {
          if (table === "leads") return leadsQuery
          assert.equal(table, "billing_subscriptions")
          return billingQuery
        },
      }),
    },
  }
  const filename = path.resolve("src/app/api/admin/users/route.ts")
  const code = ts.transpileModule(adminUsersRouteSource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText
  const module = { exports: {} as { GET: (request: Request) => Promise<Response> } }
  vm.runInThisContext(`(function(require,module,exports){${code}\n})`, { filename })(
    (specifier: string) =>
      mocks[specifier] ??
      require(specifier.startsWith("@/") ? path.resolve("src", specifier.slice(2)) : specifier),
    module,
    module.exports,
  )
  const response = await module.exports.GET(new Request("https://example.test/api/admin/users"))
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), {
    users: [
      {
        ...users[0],
        display_name: "Marie",
        display_name_source: "quiz_lead",
        intake_state: "needs_quiz",
        current_billing_subscription: visible,
        billing_summary: {
          status: "active",
          trial_ends_at: null,
          period_end: null,
          provider_subscriber_email: "paypal@example.test",
        },
      },
      {
        ...users[1],
        display_name: null,
        display_name_source: null,
        intake_state: "needs_quiz",
        current_billing_subscription: expired,
        billing_summary: {
          status: "expired",
          trial_ends_at: null,
          period_end: "2020-01-01T00:00:00Z",
          provider_subscriber_email: "paypal@example.test",
        },
      },
    ],
    total: 2,
  })
  assert.deepEqual(filters, [
    ["user_id", users.map((user) => user.id)],
    ["entitlement_status", ["active", "past_due", "canceled"]],
  ])
  assert.deepEqual(leadFilters, [["email", ["chaarlie@example.test"]]])
})

test("admin users API returns a controlled response if billing lookup fails", () => {
  assert.match(
    adminUsersRouteSource,
    /try \{[\s\S]*billingByUserId = await loadRelevantBillingByUserId/,
  )
  assert.match(adminUsersRouteSource, /billing lookup failed/)
  assert.match(adminUsersRouteSource, /fehler\("Laden", "der Abo-Daten"\)/)
})

test("admin users API clamps pagination before querying profile and billing rows", () => {
  assert.match(adminUsersRouteSource, /const MAX_LIMIT = 100/)
  assert.match(adminUsersRouteSource, /parseBoundedInteger\(searchParams\.get\("limit"\)/)
  assert.match(adminUsersRouteSource, /parseBoundedInteger\(searchParams\.get\("offset"\)/)
})

test("admin users table shows Chaarlie and PayPal emails in the existing contact column", () => {
  assert.match(
    adminUsersPageSource,
    /current_billing_subscription\?: BillingSubscriptionRow \| null/,
  )
  assert.match(adminUsersPageSource, /Chaarlie-E-Mail/)
  assert.match(adminUsersPageSource, /PayPal-E-Mail/)
  assert.match(adminUsersPageSource, /const paypalEmail = getPayPalEmail\(user\)/)
  assert.match(adminUsersPageSource, /Kontakt/)
})

test("admin users table hides PayPal email when it matches the Chaarlie email", () => {
  assert.match(
    adminUsersPageSource,
    /subscriberEmail\.toLowerCase\(\) === user\.email\?\.trim\(\)\.toLowerCase\(\)/,
  )
})
