import { expect, test, type Page } from "@playwright/test"

const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000"

async function openWithConsentSettled(page: Page, path: string) {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "chaarlie_cookie_consent_v1",
      JSON.stringify({ essential: true, analytics: false, marketing: false, ts: Date.now() }),
    )
  })
  await page.goto(`${baseUrl}${path}`, { waitUntil: "networkidle" })
}

async function openGate(page: Page) {
  const heroTrigger = page.locator("[data-landing-hero-cta]")
  await expect(heroTrigger).toHaveCount(1)
  await heroTrigger.click()
  const dialog = page.getByRole("dialog", {
    name: "Aktuell nehmen wir keine neuen Auswertungen an",
  })
  await expect(dialog).toBeVisible()
  return dialog
}

test.describe("waitlist B quiz gate", () => {
  test("keeps the homepage quiz links unchanged", async ({ page }) => {
    await openWithConsentSettled(page, "/")

    await expect(page.getByRole("link", { name: "Analyse starten", exact: true })).toHaveCount(2)
    await expect(page.locator('[data-landing-hero-cta][href="/quiz"]')).toHaveCount(1)
    await expect(page.locator('a[href="/quiz"]')).toHaveCount(3)
  })

  test("opens the accessible modal from every quiz action and restores focus", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await openWithConsentSettled(page, "/warteliste/b")

    await expect(page.locator('a[href="/quiz"]')).toHaveCount(0)
    await expect(page.getByText("Impressum", { exact: true })).toBeVisible()
    await expect(page.getByText("Datenschutz", { exact: true })).toBeVisible()
    await expect(page.getByText("AGB", { exact: true })).toBeVisible()
    await expect(page.getByText("Widerruf", { exact: true })).toBeVisible()
    await expect(page.getByText("Sonntag, 9. August,", { exact: false })).toHaveCount(0)

    const triggers = page.locator("[data-quiz-gate-trigger]")
    const triggerCount = await triggers.count()
    expect(triggerCount).toBe(4)

    for (let index = 0; index < triggerCount; index += 1) {
      const trigger = triggers.nth(index)
      await trigger.click()

      const dialog = page.getByRole("dialog", {
        name: "Aktuell nehmen wir keine neuen Auswertungen an",
      })
      await expect(dialog).toBeVisible()
      await expect(dialog).toHaveAttribute("aria-modal", "true")
      await expect(page.getByLabel("Dein Vorname")).toBeFocused()
      await expect(page.getByText("Sonntag, 9. August,", { exact: false })).toHaveCount(1)

      if (index === 1) {
        await page.getByRole("button", { name: "Schließen" }).click()
      } else if (index === 2) {
        await page.locator("[data-dialog-overlay]").click({ position: { x: 5, y: 5 } })
      } else {
        await page.keyboard.press("Escape")
      }

      await expect(dialog).toBeHidden()
      await expect(trigger).toBeFocused()
    }
  })

  test("routes a new signup with its opaque token directly to thanks", async ({ page }) => {
    await page.route("**/api/waitlist", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, duplicate: false, surveyToken: "opaque-test-token" }),
      })
    })
    await openWithConsentSettled(page, "/warteliste/b")
    await openGate(page)

    await page.getByLabel("Dein Vorname").fill("Lea")
    await page.getByLabel("Deine E-Mail-Adresse").fill("lea@example.com")
    await page.getByRole("button", { name: "Platz vormerken" }).click()

    await expect(page).toHaveURL(/\/warteliste\/danke$/)
    await expect
      .poll(() =>
        page.evaluate(() => window.sessionStorage.getItem("chaarlie_waitlist_survey_token")),
      )
      .toBe("opaque-test-token")
  })

  test("sends a duplicate to thanks without issuing a new survey token", async ({ page }) => {
    await page.route("**/api/waitlist", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, duplicate: true }),
      })
    })
    await openWithConsentSettled(page, "/warteliste/b")
    await openGate(page)

    await page.getByLabel("Dein Vorname").fill("Lea")
    await page.getByLabel("Deine E-Mail-Adresse").fill("lea@example.com")
    await page.getByRole("button", { name: "Platz vormerken" }).click()

    await expect(page).toHaveURL(/\/warteliste\/danke$/)
    expect(
      await page.evaluate(() => window.sessionStorage.getItem("chaarlie_waitlist_survey_token")),
    ).toBeNull()
  })

  test("email survey access removes the capability from the visible URL", async ({ page }) => {
    await openWithConsentSettled(page, `/api/waitlist/survey-access?token=${"a".repeat(64)}`)

    await expect(page).toHaveURL(`${baseUrl}/warteliste/umfrage`)
    await expect(page.getByRole("heading", { name: "Dein Platz ist fast gesichert" })).toBeVisible()
  })

  test("shows the existing rate-limit and service errors without navigating", async ({ page }) => {
    for (const scenario of [
      { status: 429, error: "Zu viele Versuche. Bitte warte kurz und probiere es erneut." },
      { status: 503, error: "Der Service ist gerade nicht erreichbar. Bitte versuch es erneut." },
    ]) {
      await page.route("**/api/waitlist", async (route) => {
        await route.fulfill({
          status: scenario.status,
          contentType: "application/json",
          body: JSON.stringify({ error: scenario.error }),
        })
      })
      await openWithConsentSettled(page, "/warteliste/b")
      await openGate(page)

      await page.getByLabel("Dein Vorname").fill("Lea")
      await page.getByLabel("Deine E-Mail-Adresse").fill("lea@example.com")
      await page.getByRole("button", { name: "Platz vormerken" }).click()

      await expect(page.getByRole("alert")).toHaveText(scenario.error)
      await expect(page).toHaveURL(/\/warteliste\/b$/)
      await page.unroute("**/api/waitlist")
    }
  })
})
