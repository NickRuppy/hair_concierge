import { test, expect } from "@playwright/test"
import { createClient } from "@supabase/supabase-js"

const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000"
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const cookieConsentStorageKey = "chaarlie_cookie_consent_v1"

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for profile smoke tests",
  )
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function upsertHairProfileWithDryingCompat(payload: Record<string, unknown>) {
  const { error } = await admin.from("hair_profiles").upsert(payload, { onConflict: "user_id" })

  if (error?.code === "22P02" && typeof payload.drying_method === "string") {
    const { error: retryError } = await admin.from("hair_profiles").upsert(
      {
        ...payload,
        drying_method: [payload.drying_method],
      },
      { onConflict: "user_id" },
    )

    if (!retryError) return
    throw retryError
  }

  if (error) throw error
}

test.describe.serial("@ci Profile page smoke", () => {
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
        onboarding_step: "celebration",
        stripe_customer_id: `cus_smoke_${userId}`,
        subscription_status: "active",
        current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      },
      { onConflict: "id" },
    )

    if (profileError) throw profileError

    const { error: billingError } = await admin.from("billing_subscriptions").upsert(
      {
        user_id: userId,
        provider: "stripe",
        provider_customer_id: `cus_smoke_${userId}`,
        provider_subscription_id: `sub_smoke_${userId}`,
        provider_status: "active",
        entitlement_status: "active",
        interval: "month",
        current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        cancel_at_period_end: false,
        metadata: { ci_seed: "profile-page-smoke" },
      },
      { onConflict: "provider,provider_subscription_id" },
    )

    if (billingError && billingError.code !== "PGRST205") throw billingError

    await upsertHairProfileWithDryingCompat({
      user_id: userId,
      hair_texture: "wavy",
      thickness: "fine",
      density: "medium",
      hair_length: "long",
      concerns: [],
      heat_styling: "once_weekly",
      styling_tools: ["flat_iron"],
      uses_heat_protection: true,
      cuticle_condition: "smooth",
      protein_moisture_balance: "stretches_bounces",
      scalp_type: "oily",
      scalp_condition: null,
      chemical_treatment: ["bleached"],
      towel_material: "frottee",
      towel_technique: "gentle_press",
      drying_method: "air_dry",
      brush_type: "wide_tooth_comb",
      night_protection: [],
      goals: ["shine", "volume"],
      desired_volume: "more",
    })

    const { error: productUsageError } = await admin.from("user_product_usage").insert([
      {
        user_id: userId,
        category: "shampoo",
        product_name: "Daily Shampoo",
        frequency_range: "weekly_1x",
      },
      {
        user_id: userId,
        category: "conditioner",
        product_name: "Curl Conditioner",
        frequency_range: "weekly_1x",
      },
      {
        user_id: userId,
        category: "dry_shampoo",
        product_name: "Dry Refresh",
        frequency_range: "less_than_monthly",
      },
    ])

    if (productUsageError) throw productUsageError
  })

  test.afterAll(async () => {
    if (!userId) return

    await admin.from("user_product_usage").delete().eq("user_id", userId)
    await admin.from("billing_subscriptions").delete().eq("user_id", userId)
    await admin.from("hair_profiles").delete().eq("user_id", userId)
    await admin.from("profiles").delete().eq("id", userId)
    await admin.from("user_memory_entries").delete().eq("user_id", userId)
    await admin.from("user_memory_settings").delete().eq("user_id", userId)
    await admin.auth.admin.deleteUser(userId)
  })

  test("journey sections mirror the live flow and edit routes land on the right step", async ({
    page,
  }) => {
    await page.addInitScript((storageKey) => {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({
          essential: true,
          analytics: false,
          marketing: false,
          ts: Date.now(),
        }),
      )
    }, cookieConsentStorageKey)

    await page.goto(`${baseUrl}/auth?email=${encodeURIComponent(email)}`, {
      waitUntil: "networkidle",
    })
    await expect(page.getByText("chaarlie").first()).toBeVisible({ timeout: 15000 })

    const emailInput = page.locator('input[type="email"]:visible')
    const passwordInput = page.locator('input[type="password"]:visible')
    await emailInput.fill("")
    await emailInput.pressSequentially(email)
    await passwordInput.fill("")
    await passwordInput.pressSequentially(password)
    const loginButton = page.getByRole("button", { name: /^Anmelden$/ })
    await expect(emailInput).toHaveValue(email)
    await expect(passwordInput).toHaveValue(password)
    await expect(loginButton).toBeEnabled()
    await loginButton.click()
    await page.waitForURL(/\/(chat|profile|pricing)(\?.*)?$/, { timeout: 30000 })

    await page.goto(`${baseUrl}/profile`, { waitUntil: "domcontentloaded" })
    await expect(page.getByRole("heading", { name: "Mein Profil" })).toBeVisible()
    await expect(page.locator("#profile-section-quiz")).toBeVisible()

    const sectionPositions = await Promise.all([
      page.locator("#profile-section-quiz").boundingBox(),
      page.locator("#profile-section-products").boundingBox(),
      page.locator("#profile-section-styling").boundingBox(),
      page.locator("#profile-section-routine").boundingBox(),
      page.locator("#profile-section-goals").boundingBox(),
      page.locator("#profile-section-memory").boundingBox(),
    ])

    for (const box of sectionPositions) {
      expect(box).not.toBeNull()
    }

    expect(sectionPositions[0]!.y).toBeLessThan(sectionPositions[1]!.y)
    expect(sectionPositions[1]!.y).toBeLessThan(sectionPositions[2]!.y)
    expect(sectionPositions[2]!.y).toBeLessThan(sectionPositions[3]!.y)
    expect(sectionPositions[3]!.y).toBeLessThan(sectionPositions[4]!.y)
    expect(sectionPositions[4]!.y).toBeLessThan(sectionPositions[5]!.y)

    await expect(page.getByText("So baut sich dein Profil auf")).toHaveCount(0)
    await expect(page.getByText("Basis-Produkte")).toHaveCount(0)
    await expect(page.getByText("Weitere Produkte")).toHaveCount(0)
    await expect(page.getByText("Aus Haar-Check")).toHaveCount(0)
    await expect(page.getByText("Aus Onboarding")).toHaveCount(0)
    await expect(page.locator("#profile-section-quiz").getByText("10/10 vollständig")).toBeVisible()
    await expect(
      page.getByRole("button").filter({ hasText: "Haarlänge" }).filter({ hasText: "Lang" }),
    ).toBeVisible()
    await expect(
      page
        .getByRole("button")
        .filter({ hasText: "Haardichte" })
        .filter({ hasText: "Mittlere Dichte" }),
    ).toBeVisible()

    const memorySwitch = page.getByRole("switch", { name: "Erinnerungen aktivieren" })
    await expect(memorySwitch).toHaveAttribute("aria-checked", "true")

    const chemicalTreatmentsCard = page
      .getByRole("button")
      .filter({ hasText: "Chemische Behandlungen" })
      .first()
    await chemicalTreatmentsCard.click()
    await expect(page).toHaveURL(`${baseUrl}/profile`)
    await expect(page.getByText("Haar-Check direkt im Profil aktualisieren")).toBeVisible()
    await expect(page.getByRole("button", { name: "Haar-Check speichern" })).toBeVisible()
    await page.getByRole("radio", { name: "Viele Haare" }).click()
    await page.getByRole("button", { name: "Keine Beschwerden" }).click()
    await page.getByRole("button", { name: "Naturhaar" }).click()
    await page.getByRole("button", { name: "Haar-Check speichern" }).click()
    await expect(page.getByText("Haar-Check gespeichert").first()).toBeVisible()
    await expect(
      page.getByRole("button").filter({ hasText: "Haardichte" }).getByText("Viele Haare"),
    ).toBeVisible()
    await expect(page.getByText("Keine Beschwerden")).toBeVisible()
    await expect(page.getByText("Naturhaar")).toBeVisible()
    await expect(
      page.getByRole("button").filter({ hasText: "Haar-Bedenken" }).getByText("Nichts davon"),
    ).toBeVisible()

    const { data: densityRow, error: densityError } = await admin
      .from("hair_profiles")
      .select("density")
      .eq("user_id", userId!)
      .single()

    if (densityError) throw densityError
    expect(densityRow?.density).toBe("high")

    await page.getByRole("button", { name: "Ziele bearbeiten", exact: true }).click()
    await page.waitForURL(/\/profile\/edit\/goals(\?.*)?$/, { timeout: 15000 })
    await expect(page.getByText("Deine Haarziele", { exact: false })).toBeVisible()
    await page.getByRole("button", { name: "Speichern und zurück zum Profil" }).click()
    await page.waitForURL(/\/profile$/, { timeout: 30000 })
    await expect(page.getByRole("heading", { name: "Mein Profil" })).toBeVisible()

    const { data: goalsCleanupRow, error: goalsCleanupError } = await admin
      .from("hair_profiles")
      .select("desired_volume")
      .eq("user_id", userId!)
      .single()

    if (goalsCleanupError) throw goalsCleanupError
    expect(goalsCleanupRow?.desired_volume).toBeNull()

    const { data: routineRows, error: routineRowsError } = await admin
      .from("user_product_usage")
      .select("category")
      .eq("user_id", userId!)

    if (routineRowsError) throw routineRowsError
    expect((routineRows ?? []).map((row) => row.category).sort()).toEqual(
      expect.arrayContaining(["conditioner", "dry_shampoo", "shampoo"]),
    )

    const shampooDetailRow = page
      .getByRole("button")
      .filter({ hasText: "Shampoo" })
      .filter({ hasText: "Daily Shampoo" })
    await shampooDetailRow.first().click()
    await page.waitForURL(
      /\/onboarding\?step=product_drilldown&returnTo=%2Fprofile&category=shampoo&editMode=single-step$/,
      { timeout: 15000 },
    )
    await expect(page.getByText("Dein Shampoo", { exact: false })).toBeVisible()
    await page.locator('input[placeholder="z.B. Produktname oder Marke"]').fill("Edited Shampoo")
    await page.getByRole("button", { name: "5-6x/Woche" }).click()
    await page.getByRole("button", { name: "Speichern und zurück zum Profil" }).click()
    await page.waitForURL(/\/profile$/, { timeout: 30000 })
    await expect(page.getByText("Edited Shampoo").first()).toBeVisible()
    await expect(page.getByText("5-6x/Woche").first()).toBeVisible()

    const { data: shampooUsageRow, error: shampooUsageError } = await admin
      .from("user_product_usage")
      .select("frequency_range")
      .eq("user_id", userId!)
      .eq("category", "shampoo")
      .single()

    if (shampooUsageError) throw shampooUsageError
    expect(shampooUsageRow?.frequency_range).toBe("weekly_5_6x")

    const towelMaterialCard = page
      .getByRole("button")
      .filter({ hasText: "Handtuch-Material" })
      .filter({ hasText: "Frottee-Handtuch" })
    await towelMaterialCard.first().click()
    await page.waitForURL(
      /\/onboarding\?step=towel_material&returnTo=%2Fprofile&editMode=single-step$/,
      { timeout: 15000 },
    )
    await page.getByRole("button", { name: "Mikrofaser-Handtuch" }).click()
    await page.waitForURL(/\/profile$/, { timeout: 30000 })
    await expect(page.getByText("Mikrofaser-Handtuch")).toBeVisible()

    const heatFrequencyCard = page
      .getByRole("button")
      .filter({ hasText: "Styling-Frequenz" })
      .filter({ hasText: "1x pro Woche" })
    await heatFrequencyCard.first().click()
    await page.waitForURL(
      /\/onboarding\?step=heat_frequency&returnTo=%2Fprofile&editMode=single-step$/,
      { timeout: 15000 },
    )
    await page.getByRole("button", { name: "Mehrmals pro Woche" }).click()
    await page.waitForURL(/\/profile$/, { timeout: 30000 })
    await expect(
      page
        .getByRole("button")
        .filter({ hasText: "Styling-Frequenz" })
        .filter({ hasText: "Mehrmals pro Woche" })
        .first(),
    ).toBeVisible()

    await page.goto(`${baseUrl}/profile`, { waitUntil: "domcontentloaded" })
    await page.setViewportSize({ width: 390, height: 844 })
    await page.reload({ waitUntil: "domcontentloaded" })
    await expect(page.getByRole("heading", { name: "Mein Profil" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Produkte bearbeiten" })).toBeVisible()

    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    )
    expect(hasHorizontalOverflow).toBe(false)
  })
})
