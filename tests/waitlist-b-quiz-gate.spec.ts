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

test.describe("retired waitlist entry points", () => {
  test("keeps homepage quiz links unchanged", async ({ page }) => {
    await openWithConsentSettled(page, "/")

    await expect(page.getByRole("link", { name: "Analyse starten", exact: true })).toHaveCount(2)
    await expect(page.locator('[data-landing-hero-cta][href="/quiz"]')).toHaveCount(1)
    await expect(page.locator('a[href="/quiz"]')).toHaveCount(3)
  })

  test("shows the closed registration state at the legacy B alias", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await openWithConsentSettled(page, "/warteliste/b")

    await expect(
      page.getByRole("heading", { name: "Die Anmeldung zur Warteliste ist geschlossen." }),
    ).toBeVisible()
    await expect(page.locator("form")).toHaveCount(0)
    await expect(page.locator("[data-quiz-gate-trigger]")).toHaveCount(0)
    await expect(page.getByText("Impressum", { exact: true })).toBeVisible()
    await expect(page.getByText("Datenschutz", { exact: true })).toBeVisible()
    await expect(page.getByText("AGB", { exact: true })).toBeVisible()
    await expect(page.getByText("Widerruf", { exact: true })).toBeVisible()
  })

  test("email survey access remains available for existing signups", async ({ page }) => {
    await openWithConsentSettled(page, `/api/waitlist/survey-access?token=${"a".repeat(64)}`)

    const expectedOrigin = new URL(baseUrl)
    const localHosts = new Set(["127.0.0.1", "localhost"])
    await expect(page).toHaveURL(
      (url) =>
        url.protocol === expectedOrigin.protocol &&
        url.port === expectedOrigin.port &&
        (localHosts.has(expectedOrigin.hostname)
          ? localHosts.has(url.hostname)
          : url.hostname === expectedOrigin.hostname) &&
        url.pathname === "/warteliste/umfrage" &&
        url.search === "" &&
        url.hash === "",
    )
    await expect(page.getByRole("heading", { name: "Dein Platz ist fast gesichert" })).toBeVisible()
  })
})
