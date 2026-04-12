import { test, expect } from "@playwright/test"
import { createClient } from "@supabase/supabase-js"

const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000"
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for profile smoke tests",
  )
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

test.describe.serial("Profile page smoke", () => {
  const email = `playwright-profile-${Date.now()}@hairconscierge.test`
  const password = "Playwright123!"
  const fullName = "Playwright Profile"
  let userId: string | null = null

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
      throw new Error("Failed to create profile smoke user")
    }

    const { error: profileError } = await admin.from("profiles").upsert(
      {
        id: userId,
        email,
        full_name: fullName,
        onboarding_completed: true,
        onboarding_step: "complete",
      },
      { onConflict: "id" },
    )

    if (profileError) throw profileError

    const { error: hairProfileError } = await admin.from("hair_profiles").upsert(
      {
        user_id: userId,
        hair_texture: "wavy",
        thickness: "fine",
        density: "medium",
        concerns: ["frizz"],
        desired_volume: "balanced",
        goals: ["shine"],
        wash_frequency: "every_day",
        heat_styling: "never",
        uses_heat_protection: false,
        current_routine_products: ["shampoo"],
        cuticle_condition: "smooth",
        protein_moisture_balance: "balanced",
        scalp_type: "oily",
        chemical_treatment: ["bleached"],
      },
      { onConflict: "user_id" },
    )

    if (hairProfileError) throw hairProfileError
  })

  test.afterAll(async () => {
    if (!userId) return

    await admin.from("hair_profiles").delete().eq("user_id", userId)
    await admin.from("profiles").delete().eq("id", userId)
    await admin.from("user_memory_entries").delete().eq("user_id", userId)
    await admin.from("user_memory_settings").delete().eq("user_id", userId)
    await admin.auth.admin.deleteUser(userId)
  })

  test("journey sections render and profile editing stays scoped", async ({ page }) => {
    await page.goto(`${baseUrl}/auth`, { waitUntil: "domcontentloaded" })
    await expect(page.getByText("Hair Concierge").first()).toBeVisible({ timeout: 15000 })

    await page.locator('input[type="email"]:visible').fill(email)
    await page.locator('input[type="password"]:visible').fill(password)
    await page.getByRole("button", { name: /^Anmelden$/ }).click()
    await page.waitForURL(/\/chat$/, { timeout: 30000 })

    await page.goto(`${baseUrl}/profile`, { waitUntil: "domcontentloaded" })
    await expect(page.getByRole("heading", { name: "Mein Profil" })).toBeVisible()

    const mainText = await page.locator("main").innerText()
    expect(mainText.indexOf("Deine Ausgangslage")).toBeLessThan(mainText.indexOf("Deine Ziele"))
    expect(mainText.indexOf("Deine Ziele")).toBeLessThan(mainText.indexOf("Dein Alltag"))
    expect(mainText.indexOf("Dein Alltag")).toBeLessThan(
      mainText.indexOf("Was Hair Concierge sich merkt"),
    )

    await expect(page.getByRole("heading", { name: "Diagnose" })).toHaveCount(0)

    const memorySwitch = page.getByRole("switch", { name: "Erinnerungen aktivieren" })
    await expect(memorySwitch).toHaveAttribute("aria-checked", "true")
    await memorySwitch.click()
    await expect(memorySwitch).toHaveAttribute("aria-checked", "false")

    const volumeCard = page.locator('[role="button"]').filter({ hasText: "Gewünschtes Volumen" })
    await volumeCard.first().click()
    await expect(page.getByRole("button", { name: "Haar-Check aktualisieren" })).toBeVisible()
    await expect(page.getByText("Du bearbeitest dein Profil")).toBeVisible()

    await expect(page.getByRole("button", { name: /^Glatt$/ })).toHaveCount(0)
    await expect(page.getByRole("button", { name: /^Wellig$/ })).toHaveCount(0)

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await expect(page.getByRole("button", { name: "Speichern" })).toBeVisible()

    await page.getByRole("radio", { name: /^Mehr$/ }).click()
    await page.getByRole("radio", { name: "Alle 2-3 Tage" }).click()
    await page.getByRole("button", { name: "Speichern" }).click()

    const washCard = page.locator("div.rounded-xl").filter({ hasText: "Wasch-Häufigkeit" })

    await expect(volumeCard.first()).toContainText("Mehr")
    await expect(washCard.first()).toContainText("Alle 2-3 Tage")

    const routineProductsCard = page
      .locator('[role="button"]')
      .filter({ hasText: "Produkte in Routine" })
    await routineProductsCard.first().click()
    await expect(page.getByText("Routine-Details im Fokus")).toBeVisible()

    await page.reload({ waitUntil: "domcontentloaded" })

    await page.setViewportSize({ width: 390, height: 844 })
    await page.reload({ waitUntil: "domcontentloaded" })
    await expect(page.getByRole("heading", { name: "Mein Profil" })).toBeVisible()
    await expect(page.getByText("Deine Ausgangslage")).toBeVisible()

    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    )
    expect(hasHorizontalOverflow).toBe(false)

    const baselineCard = page.locator('[role="button"]').filter({ hasText: "Haartyp" })
    await baselineCard.first().click()
    await expect(page).toHaveURL(/\/profile$/)
    await expect(page.getByRole("button", { name: "Speichern" })).toBeVisible()
  })
})
