import { expect, test, type Page } from "@playwright/test"

const labPath = "/labs/offer-page?variant=payment-overlay"

async function waitForMotion(page: Page) {
  await page.evaluate(async () => {
    await Promise.all(
      document.getAnimations().map((animation) => animation.finished.catch(() => {})),
    )
  })
}

async function openCheckoutAtNonzeroScroll(page: Page) {
  await page.goto(labPath, { waitUntil: "domcontentloaded" })
  await expect(page.locator("[data-payment-overlay-lab-ready]")).toHaveAttribute(
    "data-payment-overlay-lab-ready",
    "true",
  )
  const trigger = page.getByRole("button", { name: "Ja, jetzt starten" })
  await trigger.scrollIntoViewIfNeeded()
  const scrollBefore = await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }))
  expect(scrollBefore.y).toBeGreaterThan(0)
  await trigger.click()
  const checkout = page.getByRole("dialog", { name: "Sicher bezahlen" })
  await expect(checkout).toBeVisible()
  await waitForMotion(page)
  return { checkout, scrollBefore }
}

test.describe("@ci offer payment overlay", () => {
  test("existing cookie settings dialog preserves exact nonzero scroll", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(labPath, { waitUntil: "domcontentloaded" })
    await expect(page.locator("[data-payment-overlay-lab-ready]")).toHaveAttribute(
      "data-payment-overlay-lab-ready",
      "true",
    )
    const trigger = page.getByRole("button", { name: "Ja, jetzt starten" })
    await trigger.scrollIntoViewIfNeeded()
    const scrollBefore = await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }))
    expect(scrollBefore.y).toBeGreaterThan(0)

    const cookieBanner = page.getByRole("dialog", { name: "Cookie-Einstellungen" })
    await expect(cookieBanner).toBeVisible()
    await cookieBanner.getByRole("button", { name: "Einstellungen" }).click()

    const cookieSettings = page.getByRole("dialog", { name: "Cookie-Einstellungen" })
    await expect(
      cookieSettings.getByRole("heading", { name: "Cookie-Einstellungen" }),
    ).toBeVisible()
    await expect(page.locator("body")).toHaveCSS("position", "fixed")
    await expect(page.locator("body")).toHaveCSS("top", `-${scrollBefore.y}px`)

    await cookieSettings.getByRole("button", { name: "Schließen" }).click()
    await expect(cookieSettings.getByRole("heading", { name: "Cookie-Einstellungen" })).toBeHidden()
    await expect
      .poll(() => page.evaluate(() => ({ x: window.scrollX, y: window.scrollY })))
      .toEqual(scrollBefore)
  })

  test("mobile sheet locks the offer, confirms dismissal, and restores exact scroll", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    const { checkout, scrollBefore } = await openCheckoutAtNonzeroScroll(page)
    const checkoutSurface = checkout.locator("[data-offer-payment-scroll-surface]")

    const geometry = await checkout.boundingBox()
    expect(geometry).not.toBeNull()
    expect(geometry?.x).toBeCloseTo(0, 0)
    expect(geometry?.width).toBeCloseTo(390, 0)
    expect(geometry?.y).toBeGreaterThanOrEqual(45)
    expect(geometry?.y).toBeLessThanOrEqual(51)
    expect(geometry?.height).toBeCloseTo(796, 0)

    await expect(page.getByText("Mit PayPal bezahlen")).toBeVisible()
    await expect(page.getByText("Karte & weitere")).toBeVisible()
    await expect(page.getByPlaceholder("1234 1234 1234 1234")).toBeVisible()

    await page.getByRole("button", { name: "Fehlermeldung simulieren" }).click()
    const paymentError = page.getByRole("alert").filter({ hasText: "Zahlung nicht möglich" })
    await expect(paymentError).toBeVisible()
    expect(await paymentError.evaluate((element) => Boolean(element.closest("[inert]")))).toBe(
      false,
    )
    await expect(paymentError.locator("..")).toHaveAttribute("data-modal-layer-exempt", "true")

    const cookieBanner = page.locator('[aria-label="Cookie-Einstellungen"]')
    await expect(cookieBanner).toBeVisible()
    expect(await cookieBanner.evaluate((element) => Boolean(element.closest("[inert]")))).toBe(true)

    const lockState = await page.evaluate(() => ({
      backgroundAriaHidden: document
        .querySelector('[data-testid="offer-page-background"]')
        ?.closest("main")
        ?.getAttribute("aria-hidden"),
      backgroundInert: document
        .querySelector('[data-testid="offer-page-background"]')
        ?.closest("main")
        ?.hasAttribute("inert"),
      bodyPosition: document.body.style.position,
      bodyTop: document.body.style.top,
    }))
    expect(lockState).toEqual({
      backgroundAriaHidden: "true",
      backgroundInert: true,
      bodyPosition: "fixed",
      bodyTop: `-${scrollBefore.y}px`,
    })

    await page.keyboard.press("Escape")
    const confirmation = page.getByRole("alertdialog", { name: "Zahlung abbrechen?" })
    await expect(confirmation).toBeVisible()
    await expect(page.getByRole("button", { name: "Weiter bezahlen" })).toBeFocused()
    await expect(checkoutSurface).toHaveAttribute("aria-hidden", "true")

    await page.getByRole("button", { name: "Weiter bezahlen" }).click()
    await expect(confirmation).toBeHidden()
    await expect(checkoutSurface).toBeFocused()

    await page.mouse.click(12, 12)
    await expect(confirmation).toBeVisible()
    await page.getByRole("button", { name: "Weiter bezahlen" }).click()
    await expect(confirmation).toBeHidden()

    await page.getByRole("button", { name: "Zahlung schließen" }).click()
    await expect(confirmation).toBeVisible()
    await page.getByRole("button", { name: "Zahlung abbrechen" }).click()
    await expect(checkout).toBeHidden()

    await expect
      .poll(() => page.evaluate(() => ({ x: window.scrollX, y: window.scrollY })))
      .toEqual(scrollBefore)
    await expect(page.getByRole("button", { name: "Ja, jetzt starten" })).toBeFocused()
    await expect(page.getByTestId("last-outcome")).toContainText("Zahlung abgebrochen")
  })

  test("mobile swipe requests confirmation and snaps the sheet back", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    const { checkout } = await openCheckoutAtNonzeroScroll(page)
    const handle = checkout.locator("[data-bottom-sheet-handle]")
    const handleBox = await handle.boundingBox()
    expect(handleBox).not.toBeNull()

    await page.mouse.move(handleBox!.x + handleBox!.width / 2, handleBox!.y + handleBox!.height / 2)
    await page.mouse.down()
    await page.mouse.move(handleBox!.x + handleBox!.width / 2, handleBox!.y + 130, { steps: 4 })
    await page.mouse.up()

    await expect(page.getByRole("alertdialog", { name: "Zahlung abbrechen?" })).toBeVisible()
    await expect.poll(async () => (await checkout.boundingBox())?.y).toBeGreaterThanOrEqual(47)
    await expect.poll(async () => (await checkout.boundingBox())?.y).toBeLessThanOrEqual(49)
  })

  test("plan-change confirmation cancels with Escape and restores selected-plan focus", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    const { checkout } = await openCheckoutAtNonzeroScroll(page)
    const confirmation = page.getByRole("alertdialog", { name: "Zahlung abbrechen?" })

    await page.getByRole("button", { name: "Plan ändern" }).click()
    await expect(confirmation).toBeVisible()
    await page.keyboard.press("Escape")
    await expect(confirmation).toBeHidden()
    await expect(checkout).toBeVisible()

    await page.getByRole("button", { name: "Plan ändern" }).click()
    await page.getByRole("button", { name: "Zahlung abbrechen" }).click()
    await expect(checkout).toBeHidden()
    await expect(page.getByTestId("selected-plan-card")).toBeFocused()
    await expect(page.getByTestId("last-outcome")).toContainText("Planänderung bestätigt")
  })

  test("eligible Apple Pay is first, cancellation keeps its attempt stable, and confirmation locks providers", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    const { checkout } = await openCheckoutAtNonzeroScroll(page)
    const diagnostic = checkout.getByTestId("checkout-attempt-diagnostic")

    await expect(checkout.getByTestId("apple-pay-row")).toBeVisible()
    await expect(checkout.getByRole("button", { name: "Apple Pay", exact: true })).toBeVisible()
    await expect(checkout.getByTestId("paypal-button")).toBeVisible()
    await expect(checkout.getByText("Karte & weitere")).toBeVisible()
    await expect(checkout.getByRole("link", { name: "Details ansehen" })).toHaveAttribute(
      "href",
      "/widerruf",
    )
    await expect(checkout.getByRole("checkbox")).toHaveCount(0)

    const order = await checkout
      .locator("[data-offer-payment-step]")
      .evaluateAll((elements) =>
        elements.map((element) => element.getAttribute("data-offer-payment-step")),
      )
    expect(order).toEqual(["apple_pay", "paypal", "payment_element"])
    await expect(diagnostic).toHaveAttribute("data-checkout-attempt-id", "lab-checkout-attempt-1")
    await expect(diagnostic).toHaveAttribute("data-initiate-checkout-count", "1")

    await checkout.getByRole("button", { name: "Apple Pay abbrechen simulieren" }).click()
    await expect(diagnostic).toHaveAttribute("data-apple-cancel-count", "1")
    await expect(diagnostic).toHaveAttribute("data-checkout-attempt-id", "lab-checkout-attempt-1")
    await expect(diagnostic).toHaveAttribute("data-initiate-checkout-count", "1")
    await expect(checkout).toBeVisible()

    await checkout.getByRole("button", { name: "Apple Pay", exact: true }).dblclick()
    await expect(diagnostic).toHaveAttribute("data-provider-lock", "stripe")
    await expect(diagnostic).toHaveAttribute("data-confirmation-count", "1")
    await expect(checkout.getByTestId("paypal-button")).toBeDisabled()
    await expect(
      checkout.locator('[data-offer-payment-step="payment_element"]').getByRole("button"),
    ).toBeDisabled()

    await checkout.getByRole("button", { name: "Verspäteten PayPal-Abbruch simulieren" }).click()
    await expect(diagnostic).toHaveAttribute("data-provider-lock", "stripe")
  })

  test("a guarded wallet confirmation notifies Stripe and leaves providers unlocked", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(`${labPath}&confirm=blocked`, { waitUntil: "domcontentloaded" })
    await expect(page.locator("[data-payment-overlay-lab-ready]")).toHaveAttribute(
      "data-payment-overlay-lab-ready",
      "true",
    )
    await page.getByRole("button", { name: "Ja, jetzt starten" }).click()
    const checkout = page.getByRole("dialog", { name: "Sicher bezahlen" })
    const diagnostic = checkout.getByTestId("checkout-attempt-diagnostic")

    await checkout.getByRole("button", { name: "Apple Pay", exact: true }).click()

    await expect(diagnostic).toHaveAttribute("data-confirmation-count", "0")
    await expect(diagnostic).toHaveAttribute("data-payment-failed-count", "1")
    await expect(diagnostic).toHaveAttribute("data-provider-lock", "unlocked")
    await expect(checkout.getByTestId("paypal-button")).toBeEnabled()
  })

  test("unavailable Apple Pay has no row or gap and leaves PayPal first on desktop", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto(`${labPath}&apple=unavailable`, { waitUntil: "domcontentloaded" })
    await expect(page.locator("[data-payment-overlay-lab-ready]")).toHaveAttribute(
      "data-payment-overlay-lab-ready",
      "true",
    )
    await page.getByRole("button", { name: "Ja, jetzt starten" }).click()
    const checkout = page.getByRole("dialog", { name: "Sicher bezahlen" })
    await expect(checkout).toBeVisible()
    await waitForMotion(page)

    await expect(checkout.getByTestId("apple-pay-row")).toHaveCount(0)
    const paypal = checkout.getByTestId("paypal-button")
    await expect(paypal).toBeVisible()
    await expect(checkout.getByText("Karte & weitere")).toBeVisible()
    const paymentRows = await checkout
      .locator("[data-offer-payment-step]")
      .evaluateAll((elements) =>
        elements.map((element) => element.getAttribute("data-offer-payment-step")),
      )
    expect(paymentRows).toEqual(["paypal", "payment_element"])
  })

  test("fallback confirmation locks duplicate submission once", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    const { checkout } = await openCheckoutAtNonzeroScroll(page)
    const diagnostic = checkout.getByTestId("checkout-attempt-diagnostic")

    await checkout.getByRole("button", { name: "Kostenpflichtig abonnieren · 34,99 €" }).dblclick()
    await expect(diagnostic).toHaveAttribute("data-provider-lock", "stripe")
    await expect(diagnostic).toHaveAttribute("data-confirmation-count", "1")
    await expect(checkout.getByRole("button", { name: "Apple Pay", exact: true })).toBeDisabled()
    await expect(checkout.getByTestId("paypal-button")).toBeDisabled()
  })

  test("a rejected Stripe confirmation shows recovery and releases its provider lock", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto(`${labPath}&confirm=reject`, { waitUntil: "domcontentloaded" })
    await expect(page.locator("[data-payment-overlay-lab-ready]")).toHaveAttribute(
      "data-payment-overlay-lab-ready",
      "true",
    )
    await page.getByRole("button", { name: "Ja, jetzt starten" }).click()
    const checkout = page.getByRole("dialog", { name: "Sicher bezahlen" })
    const diagnostic = checkout.getByTestId("checkout-attempt-diagnostic")

    await checkout.getByRole("button", { name: "Kostenpflichtig abonnieren · 34,99 €" }).click()

    await expect(checkout.getByRole("alert")).toContainText(
      "Die Zahlung konnte nicht bestätigt werden.",
    )
    await expect(diagnostic).toHaveAttribute("data-confirmation-count", "1")
    await expect(diagnostic).toHaveAttribute("data-provider-lock", "unlocked")
    await expect(checkout.getByTestId("paypal-button")).toBeEnabled()
    await expect(
      checkout.getByRole("button", { name: "Kostenpflichtig abonnieren · 34,99 €" }),
    ).toBeEnabled()
  })

  test("desktop modal is centered and a nested dialog retains the page lock", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    const { checkout, scrollBefore } = await openCheckoutAtNonzeroScroll(page)
    const checkoutSurface = checkout.locator("[data-offer-payment-scroll-surface]")

    const geometry = await checkout.boundingBox()
    expect(geometry).not.toBeNull()
    expect(Math.abs(geometry!.x + geometry!.width / 2 - 640)).toBeLessThanOrEqual(1)
    expect(Math.abs(geometry!.y + geometry!.height / 2 - 400)).toBeLessThanOrEqual(1)
    expect(geometry!.width).toBeLessThanOrEqual(620)
    await expect(checkout.locator("[data-bottom-sheet-handle]")).toHaveCount(0)

    await page.getByRole("button", { name: "Doppelzugang simulieren" }).click()
    const duplicateDialog = page.getByRole("dialog", { name: "Aktives Abo gefunden" })
    const checkoutRoot = page.locator(".bottom-sheet-root")
    await expect(duplicateDialog).toBeVisible()
    await expect(checkoutRoot).toHaveAttribute("inert", "")
    await expect(duplicateDialog.getByRole("button", { name: "Schließen" }).first()).toBeFocused()

    await page.keyboard.press("Escape")
    await expect(duplicateDialog).toBeHidden()
    await expect(checkoutRoot).not.toHaveAttribute("inert", "")
    await expect(checkout).toBeVisible()
    await expect(checkoutSurface).toBeFocused()
    await expect(page.locator("body")).toHaveCSS("position", "fixed")
    await expect(page.locator("body")).toHaveCSS("top", `-${scrollBefore.y}px`)

    await page.getByRole("button", { name: "Zahlung schließen" }).click()
    await page.getByRole("button", { name: "Zahlung abbrechen" }).click()
    await expect(checkout).toBeHidden()
    await expect
      .poll(() => page.evaluate(() => ({ x: window.scrollX, y: window.scrollY })))
      .toEqual(scrollBefore)
  })
})
