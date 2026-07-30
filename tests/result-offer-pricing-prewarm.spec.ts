import { expect, test } from "@playwright/test"

const labPath = "/labs/offer-page?variant=payment-prewarm"

async function openLab(page: import("@playwright/test").Page, scenario: string) {
  await page.addInitScript(() => {
    Object.defineProperty(window, "ApplePaySession", {
      configurable: true,
      value: { canMakePayments: () => true },
    })
  })
  await page.goto(`${labPath}&scenario=${scenario}`, { waitUntil: "domcontentloaded" })
  await expect(page.getByTestId("payment-prewarm-lab")).toBeVisible()
}

function drawer(page: import("@playwright/test").Page) {
  return page.getByRole("dialog", { name: "Sicher bezahlen" })
}

test.describe("@ci result offer pricing prewarm lifecycle", () => {
  test("opens the prepared wallet and PayPal path when readiness precedes the tap", async ({
    page,
  }) => {
    await openLab(page, "ready")
    const diagnostic = page.getByTestId("prewarm-diagnostic")
    await expect(diagnostic).toHaveAttribute("data-wallet-resolved", "true")
    await page.locator("[data-offer-cta='pricing_primary']").click()
    await expect(drawer(page)).toBeVisible()
    await expect(page.getByTestId("prewarm-apple-pay")).toBeVisible()
    await expect(page.getByTestId("prewarm-paypal")).toBeVisible()
    await expect(diagnostic).toHaveAttribute("data-claim-count", "1")
  })

  test("reopens through the cold path without falsely suppressing Apple Pay", async ({ page }) => {
    await openLab(page, "ready")
    const diagnostic = page.getByTestId("prewarm-diagnostic")
    await expect(diagnostic).toHaveAttribute("data-wallet-resolved", "true")
    const cta = page.locator("[data-offer-cta='pricing_primary']")
    await cta.click()
    await expect(drawer(page)).toBeVisible()
    await page.getByRole("button", { name: "Zahlung schließen" }).click()
    await page.getByRole("button", { name: "Zahlung abbrechen" }).click()
    await expect(drawer(page)).toBeHidden()

    await cta.click()
    await expect(drawer(page)).toBeVisible()
    await expect(page.getByTestId("prewarm-payment-checkout")).toHaveAttribute(
      "data-preparation-id",
      "cold",
    )
    await expect(page.getByTestId("prewarm-payment-checkout")).toHaveAttribute(
      "data-suppress-express-wallet",
      "false",
    )
    await expect(page.getByTestId("prewarm-apple-pay")).toBeVisible()
    await expect(diagnostic).toHaveAttribute("data-claim-count", "1")
  })

  test("keeps the pricing CTA busy and the drawer closed until a fast preparation resolves", async ({
    page,
  }) => {
    await openLab(page, "fast")
    await expect(page.getByTestId("prewarm-diagnostic")).toHaveAttribute("data-prepare-count", "1")
    const cta = page.locator("[data-offer-cta='pricing_primary']")
    await cta.click()
    await expect(cta).toBeDisabled()
    await expect(cta).toBeFocused()
    await expect(drawer(page)).toBeHidden()
    await page.getByTestId("prewarm-resolve-preparation").click()
    await expect(drawer(page)).toBeVisible()
    await expect(page.getByTestId("prewarm-apple-pay")).toBeVisible()
  })

  test("keeps the final CTA busy and the drawer closed until a fast preparation resolves", async ({
    page,
  }) => {
    await openLab(page, "fast")
    await expect(page.getByTestId("prewarm-diagnostic")).toHaveAttribute("data-prepare-count", "1")
    const cta = page.getByTestId("prewarm-final-cta")
    await cta.click()
    await expect(cta).toBeDisabled()
    await expect(cta).toBeFocused()
    await expect(cta).toHaveText("Zahlungsoptionen werden vorbereitet …")
    await expect(drawer(page)).toBeHidden()
    await page.getByTestId("prewarm-resolve-preparation").click()
    await expect(drawer(page)).toBeVisible()
    await expect(page.getByTestId("prewarm-apple-pay")).toBeVisible()
  })

  test("uses a wallet-suppressed fallback for unavailable wallet or preparation failure", async ({
    page,
  }) => {
    for (const scenario of ["unavailable", "failure"]) {
      await openLab(page, scenario)
      await expect(page.getByTestId("prewarm-diagnostic")).toHaveAttribute(
        "data-prepare-count",
        "1",
      )
      await page.waitForTimeout(50)
      await page.locator("[data-offer-cta='pricing_primary']").click()
      await expect(drawer(page)).toBeVisible()
      await expect(page.getByTestId("prewarm-paypal")).toBeVisible()
      await expect(page.getByTestId("prewarm-card")).toBeVisible()
      await expect(page.getByTestId("prewarm-apple-pay")).toHaveCount(0)
    }
  })

  test("reuses a prepared session after wallet-only timeout and fences a late wallet result", async ({
    page,
  }) => {
    await openLab(page, "timeout-wallet")
    const diagnostic = page.getByTestId("prewarm-diagnostic")
    await expect(diagnostic).toHaveAttribute("data-prepare-count", "1")
    await page.locator("[data-offer-cta='pricing_primary']").click()
    await expect(drawer(page)).toBeHidden()
    await expect(drawer(page)).toBeVisible({ timeout: 7_000 })
    await expect(page.getByTestId("prewarm-payment-checkout")).toHaveAttribute(
      "data-suppress-express-wallet",
      "true",
    )
    await expect(diagnostic).toHaveAttribute("data-claim-count", "1")
    await expect(diagnostic).toHaveAttribute("data-wallet-resolved", "true", { timeout: 8_000 })
    await expect(page.getByTestId("prewarm-apple-pay")).toHaveCount(0)
  })

  test("uses cold fallback when the preparation misses the deadline", async ({ page }) => {
    await openLab(page, "timeout-cold")
    await expect(page.getByTestId("prewarm-diagnostic")).toHaveAttribute("data-prepare-count", "1")
    await page.locator("[data-offer-cta='pricing_primary']").click()
    await expect(drawer(page)).toBeHidden()
    await expect(drawer(page)).toBeVisible({ timeout: 7_000 })
    await expect(page.getByTestId("prewarm-payment-checkout")).toHaveAttribute(
      "data-preparation-id",
      "cold",
    )
    await expect(page.getByTestId("prewarm-apple-pay")).toHaveCount(0)
  })

  test("invalidates the old preparation after a plan change and contains focus in the drawer", async ({
    page,
  }) => {
    await openLab(page, "plan-change")
    const diagnostic = page.getByTestId("prewarm-diagnostic")
    await expect(diagnostic).toHaveAttribute("data-prepare-count", "1")
    await page.getByRole("button", { name: /Monatlich/ }).click()
    await expect(diagnostic).toHaveAttribute("data-prepare-count", "2", { timeout: 2_000 })
    await page.locator("[data-offer-cta='pricing_primary']").click()
    await expect(drawer(page)).toBeVisible()
    await page.getByTestId("prewarm-card").focus()
    await page.keyboard.press("Tab")
    await expect
      .poll(() => page.evaluate(() => Boolean(document.activeElement?.closest('[role="dialog"]'))))
      .toBe(true)
  })
})
