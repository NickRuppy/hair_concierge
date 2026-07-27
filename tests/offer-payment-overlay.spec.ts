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
