import { test, expect } from "@playwright/test"
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for quiz E2E tests")
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

test.describe.serial("Quiz to onboarding E2E", () => {
  const email = `playwright-quiz-${Date.now()}@hairconscierge.test`
  const password = "Playwright123!"
  const fullName = "Playwright Quiz"
  let userId: string | null = null
  let firstLeadId: string | null = null
  let rerunLeadId: string | null = null

  async function fetchLatestLead() {
    const { data, error } = await admin
      .from("leads")
      .select("id, email, status, ai_insight, user_id, quiz_answers")
      .eq("email", email)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) throw error
    return data
  }

  async function fetchHairProfile() {
    if (!userId) return null

    const { data, error } = await admin
      .from("hair_profiles")
      .select("hair_texture, thickness, density, cuticle_condition, protein_moisture_balance, scalp_type, scalp_condition, chemical_treatment, desired_volume, goals, post_wash_actions, routine_preference, current_routine_products, wash_frequency")
      .eq("user_id", userId)
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
      throw new Error("Failed to create E2E user")
    }

    const { error: profileError } = await admin
      .from("profiles")
      .upsert(
        {
          id: userId,
          email,
          full_name: fullName,
        },
        { onConflict: "id" }
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

  test("quiz hands off into onboarding and persists linked diagnostics", async ({
    page,
  }) => {
    await test.step("Complete the quiz and lead capture", async () => {
      await page.goto("/quiz", { waitUntil: "networkidle" })

      await page.getByRole("button", { name: /QUIZ STARTEN/i }).click()
      await expect(page.getByText("HAARTEXTUR", { exact: false })).toBeVisible()

      await page.getByText("Wellig").first().click()
      await expect(page.getByText("2/6")).toBeVisible()

      await page.getByText("Mittel").first().click()
      await expect(page.getByText("3/6")).toBeVisible()

      await page.getByText("Leicht uneben").click()
      await expect(page.getByText("4/6")).toBeVisible()

      await page.getByText("Dehnt sich, bleibt ausgeleiert").click()
      await expect(page.getByText("5/6")).toBeVisible()

      await expect(
        page.getByText("SIND DEINE HAARE CHEMISCH BEHANDELT?", { exact: false })
      ).toBeVisible()

      const naturCard = page.locator(".quiz-card", { hasText: "Naturhaar" })
      const coloredCard = page.locator(".quiz-card", {
        hasText: "Gefaerbt / Getoent",
      })
      const bleachedCard = page.locator(".quiz-card", {
        hasText: "Blondiert / Aufgehellt",
      })

      await naturCard.click()
      await expect(
        page.locator(".quiz-card-active", { hasText: "Naturhaar" })
      ).toHaveCount(1)

      await coloredCard.click()
      await expect(
        page.locator(".quiz-card-active", { hasText: "Naturhaar" })
      ).toHaveCount(0)

      await bleachedCard.click()
      await expect(
        page.locator(".quiz-card-active", { hasText: "Gefaerbt / Getoent" })
      ).toHaveCount(1)
      await expect(
        page.locator(".quiz-card-active", { hasText: "Blondiert / Aufgehellt" })
      ).toHaveCount(1)

      await page.getByRole("button", { name: /^WEITER$/ }).click()

      // Scalp question (6/6)
      await expect(page.getByText("6/6")).toBeVisible()
      await page
        .locator(".quiz-card")
        .filter({ has: page.getByText(/^Trocken$/) })
        .click()
      await expect(
        page.getByText("BESCHWERDEN WIE SCHUPPEN", { exact: false })
      ).toBeVisible()
      await page.getByRole("button", { name: "JA" }).click()
      await page.getByText("Trockene Schuppen").click()

      await page.getByPlaceholder("Dein Vorname").fill("Playwright")
      await page.getByRole("button", { name: /^WEITER$/ }).click()

      await page.getByPlaceholder("name@beispiel.de").fill(email)
      await page.getByRole("button", { name: /^WEITER$/ }).click()

      await page
        .getByRole("button", { name: /JA, WEITER ZU MEINEM PLAN/i })
        .click()
    })

    await test.step("Verify the lead is analyzed before auth", async () => {
      await expect(
        page.getByRole("button", { name: /ZIELE UND ROUTINE FESTLEGEN/i })
      ).toBeVisible({ timeout: 45_000 })

      await expect
        .poll(async () => {
          const lead = await fetchLatestLead()
          return lead?.status ?? null
        }, { timeout: 30_000 })
        .toBe("analyzed")

      await expect
        .poll(async () => {
          const lead = await fetchLatestLead()
          return typeof lead?.ai_insight === "string" && lead.ai_insight.length > 0
        }, { timeout: 30_000 })
        .toBe(true)
    })

    await test.step("Authenticate via inline auth on quiz-welcome", async () => {
      // Advance from results to welcome (step 14 — inline auth)
      await page
        .getByRole("button", { name: /ZIELE UND ROUTINE FESTLEGEN/i })
        .click()

      // Welcome page now shows inline dark auth form
      await expect(
        page.getByText("PROFIL SPEICHERN", { exact: false })
      ).toBeVisible({ timeout: 15_000 })

      // Switch to login tab and authenticate
      await page.getByRole("tab", { name: "Anmelden" }).click()
      await page.locator('input[type="email"]:visible').fill(email)
      await page.locator('input[type="password"]:visible').fill(password)
      await page.getByRole("button", { name: /^Anmelden$/ }).click()

      // Should land on onboarding (single-page flow)
      await page.waitForURL(/\/onboarding(\?.*)?$/, {
        timeout: 30_000,
        waitUntil: "domcontentloaded",
      })
    })

    await test.step("Complete onboarding flow through goals and verify database state", async () => {
      // Welcome screen
      await expect(page.getByRole("button", { name: /LOS GEHT/i })).toBeVisible({ timeout: 10_000 })
      await page.getByRole("button", { name: /LOS GEHT/i }).click()

      // Products basics: select Conditioner
      await expect(page.getByText("Deine Basis-Produkte", { exact: false })).toBeVisible({ timeout: 10_000 })
      await page.getByRole("button", { name: /^Conditioner$/i }).click()
      await page.getByRole("button", { name: /^Weiter$/i }).click()

      // Products extras: skip
      await expect(page.getByText("Weitere Produkte", { exact: false })).toBeVisible({ timeout: 10_000 })
      await page.getByRole("button", { name: /Nichts davon/i }).click()

      // Product drilldown: conditioner — select a frequency
      await expect(page.getByText("Dein Conditioner", { exact: false })).toBeVisible({ timeout: 10_000 })
      await page.getByRole("button", { name: /1-2x pro Woche/i }).click()
      await page.getByRole("button", { name: /^Weiter$/i }).click()

      // Heat tools: skip (no heat tools)
      await expect(page.getByText("Welche Hitzetools nutzt du?", { exact: false })).toBeVisible({ timeout: 10_000 })
      await page.getByRole("button", { name: /Nichts davon/i }).click()

      // Interstitial: continue
      await expect(page.getByText("Fast geschafft!", { exact: false })).toBeVisible({ timeout: 10_000 })
      await page.getByRole("button", { name: /^Weiter$/i }).click()

      // Towel material: select Frottee (single-select, auto-advances)
      await expect(page.getByText("Womit trocknest du dein Haar?", { exact: false })).toBeVisible({ timeout: 10_000 })
      await page.getByRole("button", { name: /Frottee-Handtuch/i }).click()

      // Towel technique: select Rubbeln (single-select, auto-advances)
      await expect(page.getByText("Wie trocknest du?", { exact: false })).toBeVisible({ timeout: 10_000 })
      await page.getByRole("button", { name: /^Rubbeln$/i }).click()

      // Drying method: select Lufttrocknen (multi-select, needs Weiter)
      await expect(page.getByText("Wie trocknest du dein Haar?", { exact: false })).toBeVisible({ timeout: 10_000 })
      await page.getByRole("button", { name: /Lufttrocknen/i }).click()
      await page.getByRole("button", { name: /^Weiter$/i }).click()

      // Brush type: select Grobzinkiger Kamm (single-select, auto-advances)
      await expect(page.getByText("Welche Bürste", { exact: false })).toBeVisible({ timeout: 10_000 })
      await page.getByRole("button", { name: /Grobzinkiger Kamm/i }).click()

      // Night protection: skip
      await expect(page.getByText("Wie schützt du dein Haar nachts?", { exact: false })).toBeVisible({ timeout: 10_000 })
      await page.getByRole("button", { name: /Nichts davon/i }).click()

      // Goals page: select goals from the chip grid
      await expect(
        page.getByText("Deine Haarziele", { exact: false })
      ).toBeVisible({ timeout: 10_000 })
      await page.getByRole("button", { name: /Mehr Volumen/i }).click()
      await page.getByRole("button", { name: /Mehr Glanz/i }).click()
      await page.getByRole("button", { name: /^Weiter$/ }).click()

      // Celebration popup
      await expect(page.getByRole("button", { name: /ZUM CHAT/i })).toBeVisible({ timeout: 10_000 })
      await page.getByRole("button", { name: /ZUM CHAT/i }).click()

      // Should land on chat
      await page.waitForURL("**/chat", { timeout: 30_000 })

      // Verify lead is linked
      await expect
        .poll(async () => {
          const lead = await fetchLatestLead()
          return lead?.status ?? null
        }, { timeout: 30_000 })
        .toBe("linked")

      await expect
        .poll(async () => {
          const lead = await fetchLatestLead()
          return lead?.user_id ?? null
        }, { timeout: 30_000 })
        .toBe(userId)

      await expect
        .poll(async () => {
          const lead = await fetchLatestLead()
          return lead?.id ?? null
        }, { timeout: 30_000 })
        .not.toBeNull()

      // Verify hair profile data
      await expect
        .poll(async () => {
          const profile = await fetchHairProfile()
          return profile?.desired_volume ?? null
        }, { timeout: 30_000 })
        .toBe("more")

      const hairProfile = await fetchHairProfile()

      expect(hairProfile).toMatchObject({
        hair_texture: "wavy",
        thickness: "normal",
        cuticle_condition: "slightly_rough",
        protein_moisture_balance: "stretches_stays",
        scalp_type: "dry",
        scalp_condition: "dry_flakes",
        desired_volume: "more",
      })
      expect(hairProfile?.chemical_treatment).toEqual(["colored", "bleached"])
      expect(hairProfile?.goals).toEqual(expect.arrayContaining(["shine", "volume"]))
      expect(hairProfile?.post_wash_actions).toEqual(["air_dry"])
      expect(hairProfile?.current_routine_products).toEqual(["conditioner"])

      firstLeadId = (await fetchLatestLead())?.id ?? null
      expect(firstLeadId).not.toBeNull()
    })
  })

  test("existing account can retake the quiz and overwrite diagnostic profile fields", async ({
    page,
  }) => {
    await test.step("Confirm the first quiz run is linked", async () => {
      const initialProfile = await fetchHairProfile()

      expect(initialProfile).toMatchObject({
        hair_texture: "wavy",
        thickness: "normal",
        cuticle_condition: "slightly_rough",
        protein_moisture_balance: "stretches_stays",
        scalp_type: "dry",
        scalp_condition: "dry_flakes",
        desired_volume: "more",
      })
      expect(initialProfile?.chemical_treatment).toEqual(["colored", "bleached"])
      expect(initialProfile?.goals).toEqual(expect.arrayContaining(["shine", "volume"]))
      expect(initialProfile?.post_wash_actions).toEqual(["air_dry"])
      expect(initialProfile?.current_routine_products).toEqual(["conditioner"])
      expect(firstLeadId).not.toBeNull()
    })

    await test.step("Retake the quiz with different diagnostics", async () => {
      await page.goto("/quiz", { waitUntil: "networkidle" })

      await page.getByRole("button", { name: /QUIZ STARTEN/i }).click()
      await page.getByText("Glatt").first().click()
      await page.getByText("Fein").first().click()
      await page.getByText("Glatt wie Glas").click()
      await page.getByText("Reisst sofort").click()

      await page
        .locator(".quiz-card")
        .filter({ has: page.getByText(/^Fettig$/) })
        .click()
      await page.getByRole("button", { name: "NEIN" }).click()

      await expect(
        page.getByText("SIND DEINE HAARE CHEMISCH BEHANDELT?", { exact: false })
      ).toBeVisible()

      const naturCard = page.locator(".quiz-card", { hasText: "Naturhaar" })
      const coloredCard = page.locator(".quiz-card", {
        hasText: "Gefaerbt / Getoent",
      })

      await coloredCard.click()
      await expect(
        page.locator(".quiz-card-active", { hasText: "Gefaerbt / Getoent" })
      ).toHaveCount(1)

      await naturCard.click()
      await expect(
        page.locator(".quiz-card-active", { hasText: "Naturhaar" })
      ).toHaveCount(1)
      await expect(
        page.locator(".quiz-card-active", { hasText: "Gefaerbt / Getoent" })
      ).toHaveCount(0)

      await page.getByRole("button", { name: /^WEITER$/ }).click()
      await page.getByPlaceholder("Dein Vorname").fill("Playwright Return")
      await page.getByRole("button", { name: /^WEITER$/ }).click()
      await page.getByPlaceholder("name@beispiel.de").fill(email)
      await page.getByRole("button", { name: /^WEITER$/ }).click()
      await page
        .getByRole("button", { name: /JA, WEITER ZU MEINEM PLAN/i })
        .click()

      await expect(
        page.getByRole("button", { name: /ZIELE UND ROUTINE FESTLEGEN/i })
      ).toBeVisible({ timeout: 45_000 })
    })

    await test.step("Log back in via inline auth and relink the new lead", async () => {
      // Advance to welcome (inline auth)
      await page
        .getByRole("button", { name: /ZIELE UND ROUTINE FESTLEGEN/i })
        .click()

      await expect(
        page.getByText("PROFIL SPEICHERN", { exact: false })
      ).toBeVisible({ timeout: 15_000 })

      // Log in with existing credentials
      await page.getByRole("tab", { name: "Anmelden" }).click()
      await page.locator('input[type="email"]:visible').fill(email)
      await page.locator('input[type="password"]:visible').fill(password)
      await page.getByRole("button", { name: /^Anmelden$/ }).click()

      // Returning user with completed onboarding: lead is linked during the
      // /onboarding server-side load, then redirect to /chat since onboarding_completed is true
      await page.waitForURL("**/chat", {
        timeout: 30_000,
        waitUntil: "domcontentloaded",
      })
    })

    await test.step("Verify the latest lead links and diagnostics are overwritten", async () => {
      await expect
        .poll(async () => {
          const lead = await fetchLatestLead()
          return lead?.status ?? null
        }, { timeout: 30_000 })
        .toBe("linked")

      await expect
        .poll(async () => {
          const lead = await fetchLatestLead()
          return lead?.id ?? null
        }, { timeout: 30_000 })
        .not.toBe(firstLeadId)

      await expect
        .poll(async () => {
          const lead = await fetchLatestLead()
          return lead?.user_id ?? null
        }, { timeout: 30_000 })
        .toBe(userId)

      rerunLeadId = (await fetchLatestLead())?.id ?? null
      expect(rerunLeadId).not.toBeNull()
      expect(rerunLeadId).not.toBe(firstLeadId)

      // Diagnostic fields should be overwritten with the new quiz answers
      await expect
        .poll(async () => {
          const profile = await fetchHairProfile()
          return profile?.hair_texture ?? null
        }, { timeout: 30_000 })
        .toBe("straight")

      const hairProfile = await fetchHairProfile()

      expect(hairProfile).toMatchObject({
        hair_texture: "straight",
        thickness: "fine",
        cuticle_condition: "smooth",
        protein_moisture_balance: "snaps",
        scalp_type: "oily",
        scalp_condition: "none",
        // Goals and onboarding data from first run remain (user hasn't re-submitted onboarding)
        desired_volume: "more",
      })
      expect(hairProfile?.chemical_treatment).toEqual(["natural"])
      // Goals stay from first run since user didn't re-save goals page
      expect(hairProfile?.goals).toEqual(expect.arrayContaining(["shine", "volume"]))
      expect(hairProfile?.post_wash_actions).toEqual(["air_dry"])
      expect(hairProfile?.current_routine_products).toEqual(["conditioner"])
    })
  })
})
