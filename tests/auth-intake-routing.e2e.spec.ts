import { test, expect } from "@playwright/test"
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for intake routing E2E tests",
  )
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

test.describe.serial("Authenticated intake routing", () => {
  const email = `playwright-intake-${Date.now()}@hairconscierge.test`
  const password = "Playwright123!"
  const fullName = "Playwright Intake"
  let userId: string | null = null

  async function fetchLatestLead() {
    const { data, error } = await admin
      .from("leads")
      .select("id, status, user_id")
      .eq("email", email)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) throw error
    return data
  }

  test.beforeAll(async () => {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    })

    if (error) throw error
    userId = data.user?.id ?? null

    if (!userId) {
      throw new Error("Failed to create intake E2E user")
    }

    const { error: profileError } = await admin.from("profiles").upsert(
      {
        id: userId,
        email,
        full_name: fullName,
      },
      { onConflict: "id" },
    )

    if (profileError) throw profileError
  })

  test.afterAll(async () => {
    await admin.from("leads").delete().eq("email", email)

    if (!userId) return

    await admin.from("user_product_usage").delete().eq("user_id", userId)
    await admin.from("hair_profiles").delete().eq("user_id", userId)
    await admin.from("profiles").delete().eq("id", userId)
    await admin.auth.admin.deleteUser(userId)
  })

  test("login routes quizless users to /quiz instead of /onboarding", async ({ page }) => {
    await page.goto("/auth", { waitUntil: "networkidle" })
    await page.locator('input[type="email"]:visible').fill(email)
    await page.locator('input[type="password"]:visible').fill(password)
    await page.getByRole("button", { name: /^Anmelden$/ }).click()

    await page.waitForURL("**/quiz", {
      timeout: 30_000,
      waitUntil: "domcontentloaded",
    })

    await expect(page.getByRole("button", { name: /Quiz starten/i })).toBeVisible()
  })
})
