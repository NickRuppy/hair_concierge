import { expect, test } from "@playwright/test"

// This E2E is intentionally skipped by default.
// Run manually:
//   terminal 1: npm run dev
//   terminal 2: stripe listen --forward-to localhost:3000/api/stripe/webhook
//   terminal 3: npx playwright test tests/stripe-subscription-e2e.spec.ts --headed
// Then remove .skip from the describe block below for the run.

const TEST_EMAIL = `e2e-${Date.now()}@hair-concierge-test.local`

test.describe.skip("Stripe subscription golden path (manual)", () => {
  test("quiz → pricing → stripe test card → welcome shows magic-link", async ({ page }) => {
    test.setTimeout(120_000)

    // 1. Open the landing / quiz to establish a session
    await page.goto("/quiz")

    // 2. Seed a lead via the existing API so /pricing has a leadId + email
    const leadRes = await page.request.post("/api/quiz/lead", {
      data: { email: TEST_EMAIL, name: "E2E" },
    })
    expect(leadRes.ok()).toBeTruthy()
    const lead = await leadRes.json()
    const leadId = lead.id ?? lead.leadId
    expect(leadId).toBeTruthy()

    // 3. Navigate to pricing and choose monthly (first button is Monatlich)
    await page.goto(`/pricing?lead=${leadId}`)
    await page
      .getByRole("button", { name: /Jetzt starten/i })
      .first()
      .click()

    // 4. The embedded Stripe iframe loads on /pricing/checkout — fill the card
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

    // 5. Submit
    await page.getByRole("button", { name: /Abonnieren|Subscribe|Pay|Bezahlen/i }).click()

    // 6. After redirect, welcome page should be visible with the magic-link copy
    await page.waitForURL(/\/welcome\?session_id=/, { timeout: 60_000 })
    await expect(page.getByText(/Zahlung erfolgreich/i)).toBeVisible()
    await expect(page.getByText(TEST_EMAIL)).toBeVisible()
  })
})
