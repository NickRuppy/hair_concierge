import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const adminUsersRouteSource = readFileSync(
  new URL("../src/app/api/admin/users/route.ts", import.meta.url),
  "utf8",
)
const adminUsersPageSource = readFileSync(
  new URL("../src/app/admin/users/page.tsx", import.meta.url),
  "utf8",
)

test("admin users API merges visible billing subscription data with provider subscriber email", () => {
  assert.match(adminUsersRouteSource, /createAdminClient/)
  assert.match(adminUsersRouteSource, /loadVisibleBillingByUserId/)
  assert.match(adminUsersRouteSource, /provider_subscriber_email/)
  assert.match(adminUsersRouteSource, /hasCurrentBillingAccess/)
  assert.match(adminUsersRouteSource, /current_billing_subscription/)
})

test("admin users API returns a controlled response if billing lookup fails", () => {
  assert.match(
    adminUsersRouteSource,
    /try \{[\s\S]*billingByUserId = await loadVisibleBillingByUserId/,
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
