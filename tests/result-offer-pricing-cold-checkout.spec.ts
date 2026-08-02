import { expect, test } from "@playwright/test"

const labPath = "/labs/offer-page?variant=payment-cold-checkout"

async function openLab(page: import("@playwright/test").Page, scenario: string) {
  await page.goto(`${labPath}&scenario=${scenario}`)
  await expect(page.getByTestId("payment-cold-checkout-lab")).toBeVisible()
}

test.describe("@ci cold checkout lifecycle", () => {
  test("does no provider work before explicit open and starts a fresh attempt on open", async ({
    page,
  }) => {
    await openLab(page, "loading")
    const diagnostic = page.getByTestId("cold-diagnostic")
    await expect(diagnostic).toHaveAttribute("data-stripe-started", "false")
    await page.getByTestId("cold-final-cta").click()
    await expect(diagnostic).toHaveAttribute("data-attempt-count", "1")
    await expect(diagnostic).toHaveAttribute("data-stripe-started", "true")
    await expect(page.getByTestId("cold-stripe-loading")).toBeVisible()
    await expect(page.getByTestId("cold-paypal")).toBeVisible()
  })

  test("renders ready and unavailable Apple Pay states without removing PayPal", async ({
    page,
  }) => {
    await openLab(page, "ready")
    await page.getByTestId("cold-final-cta").click()
    await expect(page.getByTestId("cold-apple-pay")).toBeVisible()
    await expect(page.getByTestId("cold-paypal")).toBeVisible()

    await openLab(page, "unavailable")
    await page.getByTestId("cold-final-cta").click()
    await expect(page.getByTestId("cold-apple-pay-unavailable")).toBeVisible()
    await expect(page.getByTestId("cold-paypal")).toBeVisible()
  })

  test("keeps PayPal usable after Stripe failure and retries into a ready state", async ({
    page,
  }) => {
    await openLab(page, "failure")
    await page.getByTestId("cold-final-cta").click()
    await expect(page.getByTestId("cold-stripe-failure")).toBeVisible()
    await expect(page.getByTestId("cold-paypal")).toBeVisible()
    await page.getByTestId("cold-stripe-retry").click()
    await expect(page.getByTestId("cold-apple-pay")).toBeVisible()
  })

  test("one-time waits for consent before Stripe work", async ({ page }) => {
    await openLab(page, "one-time")
    await page.getByTestId("cold-final-cta").click()
    await expect(page.getByTestId("cold-diagnostic")).toHaveAttribute(
      "data-stripe-started",
      "false",
    )
    await expect(page.getByTestId("cold-paypal")).toBeVisible()
    await page.getByTestId("cold-consent").check()
    await expect(page.getByTestId("cold-diagnostic")).toHaveAttribute("data-stripe-started", "true")
  })
})
