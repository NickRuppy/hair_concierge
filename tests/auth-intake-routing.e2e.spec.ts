import { test, expect, type Page } from "@playwright/test"
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

async function hideCookieBanner(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "chaarlie_cookie_consent_v1",
      JSON.stringify({ essential: true, analytics: false, marketing: false, ts: Date.now() }),
    )
  })
}

test.describe.serial("Authenticated intake routing", () => {
  const email = `playwright-intake-${Date.now()}@hairconscierge.test`
  const password = "Playwright123!"
  const fullName = "Playwright Intake"
  let userId: string | null = null

  async function fetchLatestLead() {
    const { data, error } = await admin
      .from("leads")
      .select("id, status, user_id, quiz_answers")
      .eq("email", email)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) throw error
    return data
  }

  async function fetchHairProfileDensity() {
    if (!userId) return null

    const { data, error } = await admin
      .from("hair_profiles")
      .select("density")
      .eq("user_id", userId)
      .maybeSingle()

    if (error) throw error
    return data?.density ?? null
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
        stripe_customer_id: `cus_intake_${userId}`,
        subscription_status: "active",
        current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
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
    await hideCookieBanner(page)
    const visitedUrls: string[] = []
    page.on("framenavigated", (frame) => {
      if (frame === page.mainFrame()) {
        visitedUrls.push(frame.url())
      }
    })

    await page.goto("/auth", { waitUntil: "networkidle" })
    const appOrigin = new URL(page.url()).origin
    await page.locator('input[type="email"]:visible').fill(email)
    await page.locator('input[type="password"]:visible').fill(password)
    await page.getByRole("button", { name: /^Anmelden$/ }).click()

    await page.waitForURL(/\/quiz(\?.*)?$/, {
      timeout: 30_000,
      waitUntil: "domcontentloaded",
    })

    const visitedPathnames = visitedUrls
      .filter((url) => new URL(url).origin === appOrigin)
      .map((url) => new URL(url).pathname)

    expect(visitedPathnames.at(-1)).toBe("/quiz")
    expect(visitedPathnames).not.toContain("/onboarding")
    await expect(page.getByRole("button", { name: "Wellig", exact: true })).toBeVisible()
  })

  test("signed-in quiz completion skips auth and lands in onboarding", async ({ page }) => {
    await hideCookieBanner(page)
    await page.goto("/auth", { waitUntil: "networkidle" })
    await page.locator('input[type="email"]:visible').fill(email)
    await page.locator('input[type="password"]:visible').fill(password)
    await page.getByRole("button", { name: /^Anmelden$/ }).click()

    await page.waitForURL(/\/quiz(\?.*)?$/, {
      timeout: 30_000,
      waitUntil: "domcontentloaded",
    })
    await page.waitForLoadState("networkidle")
    await page.goto("/quiz?mode=retake&returnTo=%2Fprofile", {
      waitUntil: "networkidle",
    })

    await page.getByRole("button", { name: "Wellig", exact: true }).click()
    await page.getByRole("button", { name: "Mittel", exact: true }).click()
    await page.getByRole("button", { name: "Mittlere Dichte", exact: true }).click()
    await page.getByRole("button", { name: "Mittellang", exact: true }).click()
    await page.getByRole("button", { name: "Leicht uneben", exact: true }).click()
    await page.getByRole("button", { name: "Dehnt sich, bleibt ausgeleiert", exact: true }).click()

    await expect(
      page.getByRole("heading", { name: /Sind deine Haare chemisch behandelt/i }),
    ).toBeVisible()
    await page.getByRole("button", { name: "Gefärbt / getönt", exact: true }).click()
    await page.getByRole("button", { name: /^Weiter$/i }).click()

    await page.getByRole("button", { name: "Trocken", exact: true }).click()
    await expect(
      page.getByRole("heading", {
        name: /Hast du zusätzlich Beschwerden wie Schuppen, Juckreiz oder Rötungen/i,
      }),
    ).toBeVisible()
    await page.getByRole("button", { name: "Nein", exact: true }).click()

    await expect(page.getByText(/Welche Haarprobleme/i)).toBeVisible()
    await page.getByRole("button", { name: "Trockenheit", exact: true }).click()
    await page.getByRole("button", { name: /^Weiter$/i }).click()

    await expect(page.getByText("Deine Haarziele", { exact: false })).toBeVisible({
      timeout: 10_000,
    })
    await page.getByRole("button", { name: /Mehr Glanz/i }).click()
    await page.getByRole("button", { name: /^Weiter$/i }).click()

    await page.getByPlaceholder("Dein Vorname").fill("Playwright Intake")
    await page.getByRole("button", { name: /Weiter zum Ergebnis/i }).click()

    await page.getByPlaceholder("name@beispiel.de").fill(email)
    await page.getByRole("button", { name: /^Weiter$/i }).click()

    await page.getByRole("button", { name: /JA, WEITER ZU MEINEM PLAN/i }).click()

    await expect(page.getByText("Deine Angaben sind gespeichert", { exact: true })).toBeVisible({
      timeout: 45_000,
    })
    await expect(
      page.getByText("Playwright Intake, wir stellen deine Haaranalyse zusammen.", { exact: true }),
    ).toBeVisible()
    await expect(
      page.getByText("Wir verbinden deine Angaben zu Haar, Zielen und Problemen.", {
        exact: true,
      }),
    ).toBeVisible()

    const latestLeadBeforeReveal = await fetchLatestLead()
    expect(latestLeadBeforeReveal?.id).toBeTruthy()

    await expect(
      page.getByRole("heading", {
        name: "Playwright Intake, deine Haaranalyse ist bereit.",
        exact: true,
      }),
    ).toBeVisible({ timeout: 45_000 })
    await expect(
      page.getByText("Deine wichtigsten Prioritäten und Routine-Bausteine warten auf dich.", {
        exact: true,
      }),
    ).toBeVisible()
    const revealAnalysis = page.getByRole("button", {
      name: "Meine Haaranalyse ansehen",
      exact: true,
    })
    await expect(revealAnalysis).toBeVisible()

    expect(new URL(page.url()).pathname).toBe("/quiz")
    await page.waitForTimeout(500)
    expect(new URL(page.url()).pathname).toBe("/quiz")

    await revealAnalysis.click()
    await page.waitForURL((url) => url.pathname === `/result/${latestLeadBeforeReveal!.id}`, {
      timeout: 15_000,
    })
    const resultUrl = new URL(page.url())
    expect(resultUrl.searchParams.get("entry")).toBe("quiz_completion")
    expect(resultUrl.searchParams.get("mode")).toBe("retake")
    expect(resultUrl.searchParams.get("returnTo")).toBe("/profile")

    await expect(
      page.getByRole("heading", { name: /So kommen wir deinem Haarziel näher/i }),
    ).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole("heading", { name: /Was dein Haar jetzt braucht/i })).toBeVisible()
    await expect(page.getByRole("button", { name: /MEINE ROUTINE STARTEN/i })).toBeVisible()
    await page.getByRole("button", { name: /MEINE ROUTINE STARTEN/i }).click()

    await page.waitForURL((url) => url.pathname === "/onboarding", {
      timeout: 30_000,
      waitUntil: "domcontentloaded",
    })

    const onboardingUrl = new URL(page.url())
    expect(onboardingUrl.pathname).toBe("/onboarding")
    expect(onboardingUrl.searchParams.get("lead")).toBeTruthy()
    expect(onboardingUrl.searchParams.get("returnTo")).toBe("/profile")

    await expect(page.getByRole("button", { name: /LOS GEHT/i })).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByText("PROFIL SPEICHERN", { exact: false })).toHaveCount(0)

    await expect
      .poll(
        async () => {
          const lead = await fetchLatestLead()
          return lead?.status ?? null
        },
        { timeout: 30_000 },
      )
      .toBe("linked")

    const latestLead = await fetchLatestLead()
    expect(latestLead?.quiz_answers).toMatchObject({ density: "medium", hair_length: "medium" })
    await expect.poll(fetchHairProfileDensity, { timeout: 30_000 }).toBe("medium")
  })
})
