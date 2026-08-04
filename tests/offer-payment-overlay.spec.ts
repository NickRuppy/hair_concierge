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
  // Mobile WebKit does not focus a button merely because it was tapped. Make
  // the pre-open focus owner explicit so restoration is deterministic.
  await trigger.focus()
  await expect(trigger).toBeFocused()
  await trigger.click()
  const checkout = page.getByRole("dialog", { name: "Sicher bezahlen" })
  await expect(checkout).toBeVisible()
  await waitForMotion(page)
  return { checkout, scrollBefore }
}

async function expectMobilePaymentContainment(page: Page, appleState?: "load-error") {
  await page.goto(appleState ? `${labPath}&apple=${appleState}` : labPath, {
    waitUntil: "domcontentloaded",
  })
  await expect(page.locator("[data-payment-overlay-lab-ready]")).toHaveAttribute(
    "data-payment-overlay-lab-ready",
    "true",
  )
  await page.getByRole("button", { name: "Ja, jetzt starten" }).click()
  const checkout = page.getByRole("dialog", { name: "Sicher bezahlen" })
  await expect(checkout).toBeVisible()
  await waitForMotion(page)

  if (appleState === "load-error") {
    await expect(
      checkout.getByRole("status", { name: "Apple Pay ist derzeit nicht verfügbar" }),
    ).toBeVisible()
  } else {
    await expect(checkout.getByTestId("apple-pay-row")).toBeVisible()
  }

  const geometry = await page.evaluate(() => {
    const documentElement = document.documentElement
    const scrollSurface = document.querySelector<HTMLElement>("[data-offer-payment-scroll-surface]")
    const dialog = scrollSurface?.closest<HTMLElement>('[role="dialog"]')
    const paymentRows = Array.from(
      document.querySelectorAll<HTMLElement>("[data-offer-payment-step]"),
    )
    const paymentCard = document.querySelector<HTMLElement>(
      '[data-offer-payment-step="payment_element"]',
    )
    const cta = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find((button) =>
      button.textContent?.includes("Kostenpflichtig abonnieren"),
    )
    const surfaceRect = scrollSurface?.getBoundingClientRect()
    const edges = (element: HTMLElement | undefined | null) => {
      const rect = element?.getBoundingClientRect()
      return rect && surfaceRect
        ? { left: rect.left - surfaceRect.left, right: surfaceRect.right - rect.right }
        : null
    }

    return {
      document: {
        clientWidth: documentElement.clientWidth,
        scrollWidth: documentElement.scrollWidth,
      },
      dialog: dialog ? { clientWidth: dialog.clientWidth, scrollWidth: dialog.scrollWidth } : null,
      scrollSurface: scrollSurface
        ? { clientWidth: scrollSurface.clientWidth, scrollWidth: scrollSurface.scrollWidth }
        : null,
      paymentRows: paymentRows.map((row) => ({
        clientWidth: row.clientWidth,
        scrollWidth: row.scrollWidth,
        edges: edges(row),
      })),
      paymentCard: paymentCard
        ? {
            clientWidth: paymentCard.clientWidth,
            scrollWidth: paymentCard.scrollWidth,
            edges: edges(paymentCard),
          }
        : null,
      cta: cta
        ? { clientWidth: cta.clientWidth, scrollWidth: cta.scrollWidth, edges: edges(cta) }
        : null,
    }
  })

  expect(geometry.document.scrollWidth).toBeLessThanOrEqual(geometry.document.clientWidth)
  expect(geometry.dialog?.scrollWidth).toBeLessThanOrEqual(geometry.dialog?.clientWidth ?? 0)
  expect(geometry.scrollSurface?.scrollWidth).toBeLessThanOrEqual(
    geometry.scrollSurface?.clientWidth ?? 0,
  )
  expect(geometry.paymentRows).not.toHaveLength(0)
  for (const row of geometry.paymentRows) {
    expect(row.scrollWidth).toBeLessThanOrEqual(row.clientWidth)
    expect(row.edges?.left).toBeGreaterThanOrEqual(-0.5)
    expect(row.edges?.right).toBeGreaterThanOrEqual(-0.5)
  }
  for (const element of [geometry.paymentCard, geometry.cta]) {
    expect(element).not.toBeNull()
    expect(element!.scrollWidth).toBeLessThanOrEqual(element!.clientWidth)
    expect(element!.edges?.left).toBeGreaterThanOrEqual(-0.5)
    expect(element!.edges?.right).toBeGreaterThanOrEqual(-0.5)
  }
}

test.describe("@ci offer payment overlay", () => {
  test("pristine dismissal is immediate while entered card input stays protected until confirmed", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(`${labPath}&dismissal=pristine`, { waitUntil: "domcontentloaded" })
    await expect(page.locator("[data-payment-overlay-lab-ready]")).toHaveAttribute(
      "data-payment-overlay-lab-ready",
      "true",
    )

    const trigger = page.getByRole("button", { name: "Ja, jetzt starten" })
    await trigger.click()
    let checkout = page.getByRole("dialog", { name: "Sicher bezahlen" })
    await expect(checkout).toBeVisible()
    await checkout.getByRole("button", { name: "Zahlung schließen" }).click()
    await expect(checkout).toBeHidden()
    await expect(page.getByRole("alertdialog", { name: "Zahlung abbrechen?" })).toHaveCount(0)

    await trigger.click()
    checkout = page.getByRole("dialog", { name: "Sicher bezahlen" })
    const cardNumber = checkout.getByPlaceholder("1234 1234 1234 1234")
    await cardNumber.fill("4242")
    await checkout.getByRole("button", { name: "Zahlung schließen" }).click()
    const confirmation = page.getByRole("alertdialog", { name: "Zahlung abbrechen?" })
    await expect(confirmation).toBeVisible()

    await page.getByRole("button", { name: "Weiter bezahlen" }).click()
    await expect(confirmation).toBeHidden()
    await expect(cardNumber).toHaveValue("4242")

    await checkout.getByRole("button", { name: "Zahlung schließen" }).click()
    await page.getByRole("button", { name: "Zahlung abbrechen" }).click()
    await expect(checkout).toBeHidden()

    await trigger.click()
    checkout = page.getByRole("dialog", { name: "Sicher bezahlen" })
    await expect(checkout.getByPlaceholder("1234 1234 1234 1234")).toHaveValue("")
    await checkout.getByRole("button", { name: "Plan ändern" }).click()
    await expect(checkout).toBeHidden()
    await expect(page.getByRole("alertdialog", { name: "Zahlung abbrechen?" })).toHaveCount(0)
    await expect(page.getByTestId("last-outcome")).toContainText("Planänderung bestätigt")
  })

  test("payment content stays contained in the mobile viewport matrix", async ({ page }) => {
    for (const viewport of [
      { width: 320, height: 568 },
      { width: 360, height: 800 },
      { width: 375, height: 812 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(viewport)
      await expectMobilePaymentContainment(page)
      await expectMobilePaymentContainment(page, "load-error")
    }
  })

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
    await expect
      .poll(() =>
        page.evaluate(() =>
          Boolean(document.activeElement?.closest('[data-testid="selected-plan-card"]')),
        ),
      )
      .toBe(true)
    await expect(page.getByTestId("last-outcome")).toContainText("Zahlung abgebrochen")
  })

  test("handle dismissal keeps the exact 80px/81px boundary and snaps the sheet back", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    const { checkout } = await openCheckoutAtNonzeroScroll(page)
    const handle = checkout.locator("[data-bottom-sheet-handle]")
    const handleBox = await handle.boundingBox()
    expect(handleBox).not.toBeNull()

    const startX = Math.round(handleBox!.x + handleBox!.width / 2)
    const startY = Math.round(handleBox!.y + handleBox!.height / 2)
    const dragHandle = async (distance: number) => {
      await page.mouse.move(startX, startY)
      await page.mouse.down()
      await page.mouse.move(startX, startY + distance, { steps: 4 })
      await page.mouse.up()
    }

    await dragHandle(80)
    await expect(page.getByRole("alertdialog", { name: "Zahlung abbrechen?" })).toHaveCount(0)
    await expect(checkout).toBeVisible()

    await dragHandle(81)

    await expect(page.getByRole("alertdialog", { name: "Zahlung abbrechen?" })).toBeVisible()
    await expect.poll(async () => (await checkout.boundingBox())?.y).toBeGreaterThanOrEqual(47)
    await expect.poll(async () => (await checkout.boundingBox())?.y).toBeLessThanOrEqual(49)
  })

  test("payment descendants never start the 81px-120px dismissal gesture", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    const { checkout } = await openCheckoutAtNonzeroScroll(page)
    const descendants = [
      checkout.getByRole("button", { name: "Apple Pay", exact: true }),
      checkout.getByTestId("paypal-button"),
      checkout.getByPlaceholder("1234 1234 1234 1234"),
      checkout.locator('[data-offer-payment-step="payment_element"]'),
    ]
    const distances = [81, 100, 120, 120]

    for (const [index, descendant] of descendants.entries()) {
      const box = await descendant.boundingBox()
      expect(box).not.toBeNull()
      const startX = Math.round(box!.x + Math.min(8, box!.width / 2))
      const startY = Math.round(box!.y + Math.min(8, box!.height / 2))
      await page.mouse.move(startX, startY)
      await page.mouse.down()
      await page.mouse.move(startX, startY + distances[index], { steps: 4 })
      await page.mouse.up()
      await expect(page.getByRole("alertdialog", { name: "Zahlung abbrechen?" })).toHaveCount(0)
      await expect(checkout).toBeVisible()
    }
  })

  test("first browser Back dismisses checkout on the same result and second Back is not guarded", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(`${labPath}&dismissal=pristine`, { waitUntil: "domcontentloaded" })
    await page.getByRole("button", { name: "Nur essentielle" }).click()
    await page.getByRole("button", { name: "Ja, jetzt starten" }).click()
    const checkout = page.getByRole("dialog", { name: "Sicher bezahlen" })
    await expect(checkout).toBeVisible()
    await waitForMotion(page)
    const url = page.url()
    await page.goBack()
    await expect(checkout).toBeHidden()
    expect(page.url()).toBe(url)
    await page.goBack()
    expect(page.url()).not.toBe(url)
  })

  test("continuing after an engaged browser Back restores exactly one checkout guard", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(labPath, { waitUntil: "domcontentloaded" })
    await page.getByRole("button", { name: "Nur essentielle" }).click()
    await page.getByRole("button", { name: "Ja, jetzt starten" }).click()
    const checkout = page.getByRole("dialog", { name: "Sicher bezahlen" })
    const confirmation = page.getByRole("alertdialog", { name: "Zahlung abbrechen?" })
    const url = page.url()

    await page.goBack()
    await expect(confirmation).toBeVisible()
    expect(page.url()).toBe(url)

    await page.getByRole("button", { name: "Weiter bezahlen" }).click()
    await expect(confirmation).toBeHidden()
    await expect(checkout).toBeVisible()
    expect(page.url()).toBe(url)

    await page.goBack()
    await expect(confirmation).toBeVisible()
    expect(page.url()).toBe(url)
  })

  test("stale checkout history state cannot leave a reopened checkout unguarded", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(`${labPath}&history=previous`, { waitUntil: "domcontentloaded" })
    await page.goto(labPath, { waitUntil: "domcontentloaded" })
    await page.getByRole("button", { name: "Nur essentielle" }).click()
    await page.evaluate(() => {
      window.history.replaceState({ __chaarlieOfferCheckout: "open-v1" }, "", window.location.href)
    })

    await page.getByRole("button", { name: "Ja, jetzt starten" }).click()
    const checkout = page.getByRole("dialog", { name: "Sicher bezahlen" })
    const confirmation = page.getByRole("alertdialog", { name: "Zahlung abbrechen?" })
    const resultUrl = page.url()

    await page.goBack()
    await expect(confirmation).toBeVisible()
    expect(page.url()).toBe(resultUrl)

    await page.getByRole("button", { name: "Zahlung abbrechen" }).click()
    await expect(checkout).toBeHidden()
    expect(page.url()).toBe(resultUrl)
  })

  test("browser Back during a non-Back confirmation still restores the checkout guard", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(labPath, { waitUntil: "domcontentloaded" })
    await page.getByRole("button", { name: "Nur essentielle" }).click()
    await page.getByRole("button", { name: "Ja, jetzt starten" }).click()
    const checkout = page.getByRole("dialog", { name: "Sicher bezahlen" })
    const confirmation = page.getByRole("alertdialog", { name: "Zahlung abbrechen?" })
    const url = page.url()

    await checkout.getByRole("button", { name: "Zahlung schließen" }).click()
    await expect(confirmation).toBeVisible()

    await page.goBack()
    await expect(confirmation).toBeVisible()
    expect(page.url()).toBe(url)

    await page.getByRole("button", { name: "Weiter bezahlen" }).click()
    await expect(confirmation).toBeHidden()
    await expect(checkout).toBeVisible()

    await page.goBack()
    await expect(confirmation).toBeVisible()
    expect(page.url()).toBe(url)
  })

  test("engagement rerenders do not consume or duplicate the checkout history sentinel", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const historyCounts = { push: 0, back: 0 }
      const pushState = window.history.pushState.bind(window.history)
      const back = window.history.back.bind(window.history)
      window.history.pushState = (...args) => {
        historyCounts.push += 1
        return pushState(...args)
      }
      window.history.back = () => {
        historyCounts.back += 1
        return back()
      }
      ;(
        window as Window & { __checkoutHistoryCounts?: typeof historyCounts }
      ).__checkoutHistoryCounts = historyCounts
    })
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(`${labPath}&dismissal=pristine`, { waitUntil: "domcontentloaded" })
    await page.getByRole("button", { name: "Nur essentielle" }).click()
    await page.getByRole("button", { name: "Ja, jetzt starten" }).click()
    const checkout = page.getByRole("dialog", { name: "Sicher bezahlen" })
    await expect(checkout).toBeVisible()
    const beforeEngagement = await page.evaluate(
      () =>
        (window as unknown as { __checkoutHistoryCounts: { push: number; back: number } })
          .__checkoutHistoryCounts,
    )
    await checkout.getByPlaceholder("1234 1234 1234 1234").fill("4242")
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window as unknown as { __checkoutHistoryCounts: { push: number; back: number } })
              .__checkoutHistoryCounts,
        ),
      )
      .toEqual(beforeEngagement)
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

  test("wallet confirmation bypasses card readiness while card submission stays disabled", async ({
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
    const cardButton = checkout
      .locator('[data-offer-payment-step="payment_element"]')
      .getByRole("button")

    await expect(cardButton).toBeDisabled()
    await expect(checkout.getByTestId("paypal-button")).toBeEnabled()

    await checkout.getByRole("button", { name: "Apple Pay", exact: true }).click()

    await expect(diagnostic).toHaveAttribute("data-confirmation-count", "1")
    await expect(diagnostic).toHaveAttribute("data-payment-failed-count", "0")
    await expect(diagnostic).toHaveAttribute("data-provider-lock", "stripe")
    await expect(checkout.getByTestId("paypal-button")).toBeDisabled()
    await expect(cardButton).toBeDisabled()
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
    await expect(checkout.getByRole("status", { name: "Apple Pay wird geladen" })).toHaveCount(0)
    const paypal = checkout.getByTestId("paypal-button")
    await expect(paypal).toBeVisible()
    await expect(checkout.getByText("Karte & weitere")).toBeVisible()
    const applePayWrapper = checkout.locator('[data-offer-payment-element="apple_pay"]')
    const paymentFlow = applePayWrapper.locator("..")
    const [paymentFlowBox, paypalRowBox] = await Promise.all([
      paymentFlow.boundingBox(),
      checkout.getByTestId("paypal-row").boundingBox(),
    ])
    expect(paymentFlowBox).not.toBeNull()
    expect(paypalRowBox).not.toBeNull()
    expect(Math.abs(paypalRowBox!.y - paymentFlowBox!.y)).toBeLessThan(1)
    const paymentRows = await checkout
      .locator("[data-offer-payment-step]")
      .evaluateAll((elements) =>
        elements.map((element) => element.getAttribute("data-offer-payment-step")),
      )
    expect(paymentRows).toEqual(["paypal", "payment_element"])
  })

  test("an Apple-capable browser accepts Stripe's unavailable result without a false delay", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.addInitScript(() => {
      Object.defineProperty(window, "ApplePaySession", {
        configurable: true,
        value: { canMakePayments: () => true },
      })
    })
    await page.goto(`${labPath}&apple=unavailable`, { waitUntil: "domcontentloaded" })
    await expect(page.locator("[data-payment-overlay-lab-ready]")).toHaveAttribute(
      "data-payment-overlay-lab-ready",
      "true",
    )
    await page.getByRole("button", { name: "Ja, jetzt starten" }).click()
    const checkout = page.getByRole("dialog", { name: "Sicher bezahlen" })
    const applePayWrapper = checkout.locator('[data-offer-payment-element="apple_pay"]')

    await expect(applePayWrapper).toHaveAttribute(
      "data-offer-apple-pay-availability",
      "unavailable",
    )
    await expect(checkout.getByRole("status", { name: "Apple Pay wird geladen" })).toHaveCount(0)
    await expect(
      checkout.getByRole("status", { name: "Apple Pay ist derzeit nicht verfügbar" }),
    ).toHaveCount(0)
    await expect(checkout.getByTestId("paypal-button")).toBeEnabled()
  })

  test("Apple Pay becomes the first prominent option when availability arrives after readiness", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.addInitScript(() => {
      Object.defineProperty(window, "ApplePaySession", {
        configurable: true,
        value: { canMakePayments: () => true },
      })
    })
    await page.goto(`${labPath}&apple=delayed`, { waitUntil: "domcontentloaded" })
    await expect(page.locator("[data-payment-overlay-lab-ready]")).toHaveAttribute(
      "data-payment-overlay-lab-ready",
      "true",
    )
    await page.getByRole("button", { name: "Ja, jetzt starten" }).click()
    const checkout = page.getByRole("dialog", { name: "Sicher bezahlen" })
    const applePayWrapper = checkout.locator('[data-offer-payment-element="apple_pay"]')

    await expect(checkout.getByRole("status", { name: "Apple Pay wird geladen" })).toBeVisible()
    await expect(applePayWrapper).toHaveCSS("visibility", "hidden")
    const pendingApplePayBox = await applePayWrapper.boundingBox()
    const paypalRow = checkout.getByTestId("paypal-row")
    const pendingPayPalOffset = await paypalRow.evaluate((element) => {
      const parent = element.parentElement
      if (!parent) return null
      return element.getBoundingClientRect().top - parent.getBoundingClientRect().top
    })
    expect(pendingApplePayBox).not.toBeNull()
    expect(pendingPayPalOffset).not.toBeNull()
    expect(pendingApplePayBox!.height).toBeGreaterThanOrEqual(52)

    await expect(checkout.getByTestId("apple-pay-row")).toBeVisible()
    await expect(checkout.getByRole("status", { name: "Apple Pay wird geladen" })).toHaveCount(0)
    const readyPayPalOffset = await paypalRow.evaluate((element) => {
      const parent = element.parentElement
      if (!parent) return null
      return element.getBoundingClientRect().top - parent.getBoundingClientRect().top
    })
    expect(readyPayPalOffset).not.toBeNull()
    expect(readyPayPalOffset!).toBeCloseTo(pendingPayPalOffset!, 0)
    const paymentRows = await checkout
      .locator("[data-offer-payment-step]")
      .evaluateAll((elements) =>
        elements.map((element) => element.getAttribute("data-offer-payment-step")),
      )
    expect(paymentRows).toEqual(["apple_pay", "paypal", "payment_element"])
  })

  test("a temporary Apple Pay availability loss can recover within the same checkout", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(`${labPath}&apple=flapping`, { waitUntil: "domcontentloaded" })
    await expect(page.locator("[data-payment-overlay-lab-ready]")).toHaveAttribute(
      "data-payment-overlay-lab-ready",
      "true",
    )
    await page.getByRole("button", { name: "Ja, jetzt starten" }).click()
    const checkout = page.getByRole("dialog", { name: "Sicher bezahlen" })
    const applePayWrapper = checkout.locator('[data-offer-payment-element="apple_pay"]')

    await expect(applePayWrapper).toHaveAttribute(
      "data-offer-apple-pay-availability",
      "unavailable",
    )
    await expect(checkout.getByRole("button", { name: "Apple Pay", exact: true })).toBeVisible()
    await expect(applePayWrapper).toHaveAttribute("data-offer-apple-pay-availability", "available")
  })

  test("a silent Apple Pay iframe stops loading and leaves the fallback methods usable", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.addInitScript(() => {
      Object.defineProperty(window, "ApplePaySession", {
        configurable: true,
        value: { canMakePayments: () => true },
      })
    })
    await page.goto(`${labPath}&apple=silent`, { waitUntil: "domcontentloaded" })
    await expect(page.locator("[data-payment-overlay-lab-ready]")).toHaveAttribute(
      "data-payment-overlay-lab-ready",
      "true",
    )
    await page.getByRole("button", { name: "Ja, jetzt starten" }).click()
    const checkout = page.getByRole("dialog", { name: "Sicher bezahlen" })
    const paypalRow = checkout.getByTestId("paypal-row")

    await expect(checkout.getByRole("status", { name: "Apple Pay wird geladen" })).toBeVisible()
    const pendingPayPalOffset = await paypalRow.evaluate((element) => {
      const parent = element.parentElement
      if (!parent) return null
      return element.getBoundingClientRect().top - parent.getBoundingClientRect().top
    })
    await expect(checkout.getByRole("status", { name: "Apple Pay wird geladen" })).toHaveCount(0, {
      timeout: 7_000,
    })
    await expect(
      checkout.getByRole("status", { name: "Apple Pay ist derzeit nicht verfügbar" }),
    ).toBeVisible()
    const failedPayPalOffset = await paypalRow.evaluate((element) => {
      const parent = element.parentElement
      if (!parent) return null
      return element.getBoundingClientRect().top - parent.getBoundingClientRect().top
    })
    expect(pendingPayPalOffset).not.toBeNull()
    expect(failedPayPalOffset).not.toBeNull()
    expect(failedPayPalOffset!).toBeCloseTo(pendingPayPalOffset!, 0)
    await expect(checkout.getByTestId("apple-pay-row")).toHaveCount(0)
    await expect(checkout.getByTestId("paypal-button")).toBeEnabled()
    await expect(
      checkout.getByRole("button", { name: "Kostenpflichtig abonnieren · 34,99 €" }),
    ).toBeEnabled()
  })

  test("a late Apple Pay response cannot reinsert the row after the timeout", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.addInitScript(() => {
      Object.defineProperty(window, "ApplePaySession", {
        configurable: true,
        value: { canMakePayments: () => true },
      })
    })
    await page.goto(`${labPath}&apple=late`, { waitUntil: "domcontentloaded" })
    await expect(page.locator("[data-payment-overlay-lab-ready]")).toHaveAttribute(
      "data-payment-overlay-lab-ready",
      "true",
    )
    await page.getByRole("button", { name: "Ja, jetzt starten" }).click()
    const checkout = page.getByRole("dialog", { name: "Sicher bezahlen" })
    const applePayWrapper = checkout.locator('[data-offer-payment-element="apple_pay"]')

    await expect(checkout.getByRole("status", { name: "Apple Pay wird geladen" })).toBeVisible()
    await expect(checkout.getByRole("status", { name: "Apple Pay wird geladen" })).toHaveCount(0, {
      timeout: 7_000,
    })
    await expect(applePayWrapper).toHaveAttribute("data-offer-apple-pay-availability", "failed")
    await page.waitForTimeout(1_000)
    await expect(applePayWrapper).toHaveAttribute("data-offer-apple-pay-availability", "failed")
    await expect(checkout.getByTestId("apple-pay-row")).toBeHidden()
    await expect(checkout.getByTestId("paypal-button")).toBeEnabled()
  })

  test("an Apple Pay load error removes the placeholder and keeps fallbacks usable", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.addInitScript(() => {
      Object.defineProperty(window, "ApplePaySession", {
        configurable: true,
        value: { canMakePayments: () => true },
      })
    })
    await page.goto(`${labPath}&apple=load-error`, { waitUntil: "domcontentloaded" })
    await expect(page.locator("[data-payment-overlay-lab-ready]")).toHaveAttribute(
      "data-payment-overlay-lab-ready",
      "true",
    )
    await page.getByRole("button", { name: "Ja, jetzt starten" }).click()
    const checkout = page.getByRole("dialog", { name: "Sicher bezahlen" })

    await expect(checkout.getByRole("status", { name: "Apple Pay wird geladen" })).toHaveCount(0)
    await expect(
      checkout.getByRole("status", { name: "Apple Pay ist derzeit nicht verfügbar" }),
    ).toBeVisible()
    await expect(checkout.getByTestId("apple-pay-row")).toHaveCount(0)
    await expect(checkout.getByTestId("paypal-button")).toBeEnabled()
  })

  test("a stalled checkout session cannot leave the Apple Pay loader spinning forever", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(`${labPath}&apple=checkout-loading`, { waitUntil: "domcontentloaded" })
    await expect(page.locator("[data-payment-overlay-lab-ready]")).toHaveAttribute(
      "data-payment-overlay-lab-ready",
      "true",
    )
    await page.getByRole("button", { name: "Ja, jetzt starten" }).click()
    const checkout = page.getByRole("dialog", { name: "Sicher bezahlen" })

    await expect(checkout.getByRole("status", { name: "Apple Pay wird geladen" })).toBeVisible()
    await expect(checkout.getByRole("status", { name: "Apple Pay wird geladen" })).toHaveCount(0, {
      timeout: 12_000,
    })
    await expect(
      checkout.getByRole("button", {
        name: "Zahlungsoptionen konnten nicht geladen werden. Erneut versuchen",
      }),
    ).toBeVisible()
    await checkout
      .getByRole("button", {
        name: "Zahlungsoptionen konnten nicht geladen werden. Erneut versuchen",
      })
      .click()
    await expect(
      checkout.getByRole("button", { name: "Kostenpflichtig abonnieren · 34,99 €" }),
    ).toBeEnabled()
    await expect(checkout.getByRole("button", { name: "Apple Pay", exact: true })).toBeVisible()
  })

  test("a stalled Stripe checkout cannot reset an active PayPal provider lock", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(`${labPath}&apple=checkout-loading`, { waitUntil: "domcontentloaded" })
    await expect(page.locator("[data-payment-overlay-lab-ready]")).toHaveAttribute(
      "data-payment-overlay-lab-ready",
      "true",
    )
    await page.getByRole("button", { name: "Ja, jetzt starten" }).click()
    const checkout = page.getByRole("dialog", { name: "Sicher bezahlen" })
    await checkout.getByTestId("paypal-button").click()

    await expect(
      checkout.getByRole("status", {
        name: "Zahlungsoptionen konnten nicht geladen werden",
      }),
    ).toBeVisible({ timeout: 12_000 })
    await expect(
      checkout.getByRole("button", {
        name: "Zahlungsoptionen konnten nicht geladen werden. Erneut versuchen",
      }),
    ).toHaveCount(0)
    await expect(checkout.getByTestId("checkout-attempt-diagnostic")).toHaveAttribute(
      "data-provider-lock",
      "paypal",
    )
  })

  test("a late checkout success does not restart the absolute Apple Pay loading deadline", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.addInitScript(() => {
      Object.defineProperty(window, "ApplePaySession", {
        configurable: true,
        value: { canMakePayments: () => true },
      })
    })
    await page.goto(`${labPath}&apple=slow-checkout`, { waitUntil: "domcontentloaded" })
    await expect(page.locator("[data-payment-overlay-lab-ready]")).toHaveAttribute(
      "data-payment-overlay-lab-ready",
      "true",
    )
    await page.getByRole("button", { name: "Ja, jetzt starten" }).click()
    const checkout = page.getByRole("dialog", { name: "Sicher bezahlen" })

    await expect(checkout.getByRole("status", { name: "Apple Pay wird geladen" })).toBeVisible()
    await expect(
      checkout.getByRole("status", { name: "Apple Pay ist derzeit nicht verfügbar" }),
    ).toBeVisible({ timeout: 11_500 })
  })

  test("query-gated Express DOM probe mounts visibly and records geometry", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(`${labPath}&apple=unavailable&wallet_debug=1&wallet_probe=express_dom`, {
      waitUntil: "domcontentloaded",
    })
    await expect(page.locator("[data-payment-overlay-lab-ready]")).toHaveAttribute(
      "data-payment-overlay-lab-ready",
      "true",
    )
    await page.getByRole("button", { name: "Ja, jetzt starten" }).click()
    const checkout = page.getByRole("dialog", { name: "Sicher bezahlen" })
    const applePayWrapper = checkout.locator('[data-offer-payment-element="apple_pay"]')

    await expect(applePayWrapper).toHaveCSS("visibility", "visible")
    const debugSummary = checkout.getByText(/DOM-Probe aktiv/)
    await expect(debugSummary).toBeVisible()
    await debugSummary.click()
    await expect(checkout.getByText(/express_dom_snapshot/)).toBeVisible()
    await expect(checkout.getByText(/probe=forced_visible/)).toBeVisible()
    await expect(checkout.getByText(/host=\d+x\d+/)).toBeVisible()
  })

  test("query-gated prewarm keeps the stateful payment child mounted without an inactive modal", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(`${labPath}&lifecycle=prewarm`, { waitUntil: "domcontentloaded" })
    await expect(page.locator("[data-payment-overlay-lab-ready]")).toHaveAttribute(
      "data-payment-overlay-lab-ready",
      "true",
    )

    const paymentChild = page.getByTestId("prewarmed-payment-child")
    await expect(paymentChild).toBeAttached()
    await expect(paymentChild).toBeHidden()
    const identityBeforeOpen = await paymentChild.getAttribute("data-payment-child-mount-id")
    const mountCountBeforeOpen = await paymentChild.getAttribute("data-payment-child-mount-count")
    expect(identityBeforeOpen).toBeTruthy()
    expect(mountCountBeforeOpen).toBeTruthy()

    const inactiveState = await paymentChild.evaluate((child) => {
      const panel = child.closest("[data-bottom-sheet-panel]")
      const root = child.closest(".bottom-sheet-root")
      const background = document
        .querySelector('[data-testid="offer-page-background"]')
        ?.closest("main")
      return {
        backdropPresent: Boolean(root?.querySelector(".bottom-sheet-backdrop")),
        bodyPosition: document.body.style.position,
        panelInert: panel?.hasAttribute("inert"),
        panelRole: panel?.getAttribute("role"),
        rootAriaHidden: root?.getAttribute("aria-hidden"),
        rootVisibility: root ? getComputedStyle(root).visibility : null,
        backgroundAriaHidden: background?.getAttribute("aria-hidden"),
        backgroundInert: background?.hasAttribute("inert"),
        childContainsFocus: child.contains(document.activeElement),
      }
    })
    expect(inactiveState).toEqual({
      backdropPresent: false,
      bodyPosition: "",
      panelInert: true,
      panelRole: null,
      rootAriaHidden: null,
      rootVisibility: "hidden",
      backgroundAriaHidden: null,
      backgroundInert: false,
      childContainsFocus: false,
    })

    await page.getByRole("button", { name: "Ja, jetzt starten" }).click()
    const checkout = page.getByRole("dialog", { name: "Sicher bezahlen" })
    await expect(checkout).toBeVisible()
    await expect(paymentChild).toHaveAttribute("data-payment-child-mount-id", identityBeforeOpen!)
    await expect(paymentChild).toHaveAttribute(
      "data-payment-child-mount-count",
      mountCountBeforeOpen!,
    )
    const paymentOrder = await checkout
      .locator("[data-offer-payment-step]")
      .evaluateAll((steps) => steps.map((step) => step.getAttribute("data-offer-payment-step")))
    expect(paymentOrder.slice(0, 2)).toEqual(["apple_pay", "paypal"])

    await checkout.getByRole("button", { name: "Zahlung schließen" }).click()
    await page.getByRole("button", { name: "Zahlung abbrechen" }).click()
    await expect(checkout).toHaveCount(0)
    await expect(paymentChild).toBeHidden()
    await expect(paymentChild).toHaveAttribute("data-payment-child-mount-id", identityBeforeOpen!)
    await expect(paymentChild).toHaveAttribute(
      "data-payment-child-mount-count",
      mountCountBeforeOpen!,
    )
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

  test("Apple Pay Express onConfirm returns the checkout promise", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(`${labPath}&confirm=deferred`, { waitUntil: "domcontentloaded" })
    await expect(page.locator("[data-payment-overlay-lab-ready]")).toHaveAttribute(
      "data-payment-overlay-lab-ready",
      "true",
    )
    await page.getByRole("button", { name: "Ja, jetzt starten" }).click()
    const checkout = page.getByRole("dialog", { name: "Sicher bezahlen" })
    const diagnostic = checkout.getByTestId("checkout-attempt-diagnostic")

    await checkout.getByRole("button", { name: "Apple Pay", exact: true }).click()

    await expect(diagnostic).toHaveAttribute("data-apple-pay-confirm-return", "thenable_pending")
    await expect(diagnostic).toHaveAttribute("data-confirmation-count", "1")
    await checkout
      .getByRole("button", { name: "Stripe-Bestätigung abschließen simulieren" })
      .click()
    await expect(diagnostic).toHaveAttribute("data-apple-pay-confirm-return", "thenable_settled")
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
