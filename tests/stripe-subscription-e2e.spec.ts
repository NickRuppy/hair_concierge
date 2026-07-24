import { expect, test } from "@playwright/test"

// This E2E is intentionally skipped by default.
// Run manually:
//   terminal 1: npm run dev
//   terminal 2: stripe listen --forward-to localhost:3000/api/stripe/webhook
//   terminal 3: npx playwright test tests/stripe-subscription-e2e.spec.ts --headed
// Then remove .skip from the describe block below for the run.
//
// Manual golden path:
//   quiz result offer page -> selected plan CTA -> inline Stripe iframe -> /welcome

const TEST_EMAIL = `e2e-${Date.now()}@chaarlie-test.local`

test.describe.skip("Stripe subscription golden path (manual)", () => {
  test("quiz result offer → stripe test card → welcome shows magic-link", async ({ page }) => {
    test.setTimeout(120_000)

    // 1. Complete the quiz until the owner-facing result offer page appears.
    await page.goto("/quiz")
    await page.getByRole("button", { name: /QUIZ STARTEN/i }).click()
    await page.getByText("Wellig").first().click()
    await page.getByText("Mittel").first().click()
    await page.getByText("Mittlere Dichte").click()
    await page.getByText("Leicht uneben").click()
    await page.getByText("Dehnt sich, bleibt ausgeleiert").click()
    await page.locator(".quiz-card", { hasText: "Naturhaar" }).click()
    await page.getByRole("button", { name: /^Weiter$/i }).click()
    await page
      .locator(".quiz-card")
      .filter({ has: page.getByText(/^Trocken$/) })
      .click()
    await page.getByRole("button", { name: "NEIN" }).click()
    await page.getByText("Trockenheit").click()
    await page.getByRole("button", { name: /^Weiter$/i }).click()
    await page.getByRole("button", { name: /Mehr Glanz/i }).click()
    await page.getByRole("button", { name: /^Weiter$/i }).click()
    await page.getByPlaceholder("Dein Vorname").fill("E2E")
    await page.getByRole("button", { name: /^Weiter$/i }).click()
    await page.getByPlaceholder("name@beispiel.de").fill(TEST_EMAIL)
    await page.getByRole("button", { name: /^Weiter$/i }).click()
    await page.getByRole("button", { name: /JA, WEITER ZU MEINEM PLAN/i }).click()
    await expect(page.getByText("Deine Angaben sind gespeichert", { exact: true })).toBeVisible({
      timeout: 45_000,
    })
    await expect(
      page.getByText("E2E, wir stellen deine Haaranalyse zusammen.", { exact: true }),
    ).toBeVisible()
    await expect(
      page.getByText("Wir verbinden deine Angaben zu Haar, Zielen und Problemen.", {
        exact: true,
      }),
    ).toBeVisible()
    await expect(
      page.getByRole("heading", {
        name: "E2E, deine Haaranalyse ist bereit.",
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
    await page.waitForURL(/\/result\/[^/?#]+/, { timeout: 15_000 })
    expect(new URL(page.url()).searchParams.get("entry")).toBe("quiz_completion")
    await expect(
      page.getByRole("heading", { name: /das ist deine persönliche Haaranalyse/i }),
    ).toBeVisible()
    await expect(page.getByText(/Warum Chaarlie ein Abo ist/i)).toHaveCount(0)
    await page.getByRole("button", { name: "Ja, lass uns loslegen", exact: true }).click()
    await page.getByRole("button", { name: "Ja, zeig mir Chaarlie", exact: true }).click()
    await page.getByRole("button", { name: "Ja, mit Chaarlie starten", exact: true }).click()

    // 2. Start checkout from the result offer page's selected plan CTA.
    await page.getByRole("button", { name: /Jetzt starten.*34,99.*Quartal/i }).click()

    // 3. The embedded Stripe iframe loads inline on the result page.
    await expect(page.getByRole("button", { name: /Plan ändern/i })).toBeVisible({
      timeout: 15_000,
    })
    const frame = page.frameLocator("iframe[name^='__privateStripeFrame']").first()
    await frame.getByLabel(/Kartennummer|Card number/i).fill("4242 4242 4242 4242")
    await frame.getByLabel(/MM \/ JJ|MM \/ YY|Ablauf|Expiration/i).fill("12 / 34")
    await frame.getByLabel(/CVC|Prüfziffer/i).fill("123")
    await frame
      .getByLabel(/PLZ|ZIP|Postleitzahl/i)
      .fill("10115")
      .catch(() => {
        // PLZ field may not appear depending on Stripe locale
      })
    // Accept the § 355 BGB withdrawal-waiver checkbox that Stripe renders
    await frame.getByRole("checkbox").first().check()

    // 4. Submit
    await frame.getByRole("button", { name: /Abonnieren|Subscribe|Pay|Bezahlen/i }).click()

    // 5. After redirect, welcome page should be visible with the magic-link copy.
    await page.waitForURL(/\/welcome\?session_id=/, { timeout: 60_000 })
    await expect(page.getByText(/Zahlung erfolgreich/i)).toBeVisible()
    await expect(page.getByText(TEST_EMAIL)).toBeVisible()
  })
})
