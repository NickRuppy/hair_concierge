import { expect, test, type Page } from "@playwright/test"

const labPath = "/labs/offer-page?variant=personal-plan"
const offerViewports = [
  { width: 320, height: 568 },
  { width: 360, height: 800 },
  { width: 375, height: 812 },
  { width: 390, height: 844 },
  { width: 1280, height: 800 },
]

async function openPersonalPlanLab(
  page: Page,
  pricingArm: "membership" | "one_time",
  options: { expressElements?: "off"; overlay?: "off" } = {},
) {
  const expressElements = options.expressElements
    ? `&expressElements=${options.expressElements}`
    : ""
  const overlay = options.overlay ? `&overlay=${options.overlay}` : ""
  await page.goto(`${labPath}&pricingArm=${pricingArm}${expressElements}${overlay}`, {
    waitUntil: "domcontentloaded",
  })
  await expect(page.getByRole("heading", { name: "Dein Haarplan ist bereit." })).toBeVisible()
  await expect(page.locator("[data-personal-plan-offer-client-ready]")).toHaveAttribute(
    "data-personal-plan-offer-client-ready",
    "true",
  )
}

async function revealPricing(page: Page) {
  await page.locator("#pricing").scrollIntoViewIfNeeded()
  await expect(page.locator("[data-offer-sticky-state='after_pricing']")).toBeVisible({
    timeout: 5_000,
  })
}

async function enableApplePayCapability(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(window, "ApplePaySession", {
      configurable: true,
      value: { canMakePayments: () => true },
    })
  })
}

async function stubPayPalSdk(page: Page) {
  await page.route("**/sdk/js?**", async (route) => {
    await route.fulfill({
      body: `
        window.paypal = {
          Buttons: function (options) {
            return {
              close: function () { return Promise.resolve(); },
              isEligible: function () { return true; },
              render: function (container) {
                var actions = {
                  disable: function () { return Promise.resolve(); },
                  enable: function () { return Promise.resolve(); }
                };
                if (options.onInit) options.onInit({}, actions);
                var button = document.createElement("button");
                button.setAttribute("aria-label", "PayPal");
                button.textContent = "PayPal";
                container.appendChild(button);
                return Promise.resolve();
              },
              updateProps: function () {}
            };
          }
        };
      `,
      contentType: "application/javascript",
      status: 200,
    })
  })
}

test.describe("@ci personal plan offer motion hooks", () => {
  test("sticky header keeps its footprint and page containment across the viewport matrix", async ({
    page,
  }) => {
    for (const viewport of offerViewports) {
      await page.setViewportSize(viewport)
      await openPersonalPlanLab(page, "membership")
      const stickyCta = page.locator("[data-offer-sticky-cta]")
      const beforeBox = await stickyCta.boundingBox()

      await revealPricing(page)
      const afterBox = await stickyCta.boundingBox()
      const geometry = await page.evaluate(() => {
        const header = document.querySelector("main > div.sticky")
        const wordmark = header?.querySelector("a")
        const cta = header?.querySelector<HTMLElement>("[data-offer-sticky-cta]")
        const rect = (element: Element | null | undefined) => element?.getBoundingClientRect()
        const wordmarkRect = rect(wordmark)
        const ctaRect = rect(cta)
        return {
          clientWidth: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth,
          wordmarkRight: wordmarkRect?.right,
          ctaLeft: ctaRect?.left,
        }
      })

      expect(beforeBox).not.toBeNull()
      expect(afterBox).not.toBeNull()
      expect(afterBox!.width).toBeCloseTo(beforeBox!.width, 1)
      expect(afterBox!.height).toBeCloseTo(beforeBox!.height, 1)
      expect(beforeBox!.height).toBeCloseTo(44, 1)
      expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth)
      expect(geometry.wordmarkRight).toBeLessThanOrEqual(geometry.ctaLeft ?? 0)

      await page.waitForTimeout(650)
      const repeatingMotion = await page.evaluate(() =>
        document
          .getAnimations()
          .filter(
            (animation) =>
              animation.playState === "running" &&
              animation.effect?.getTiming().iterations === Number.POSITIVE_INFINITY,
          )
          .map((animation) => animation.effect?.getTiming().iterations),
      )
      expect(repeatingMotion).toEqual([])
    }
  })

  test("membership sticky CTA keeps fixed mobile geometry and switches from pricing to checkout", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 740 })
    await openPersonalPlanLab(page, "membership")

    const stickyCta = page.locator("[data-offer-sticky-cta]")
    await expect(stickyCta).toHaveAttribute("data-offer-destination", "pricing")
    await expect(stickyCta).toHaveAttribute("data-offer-source-section", "hero")
    await expect(stickyCta).toHaveAttribute("data-offer-sticky-state", "before_pricing")
    await expect(stickyCta).toHaveText("Angebot ansehen")
    const beforeBox = await stickyCta.boundingBox()
    expect(beforeBox?.width).toBeGreaterThanOrEqual(142)
    expect(beforeBox?.width).toBeLessThanOrEqual(146)

    await stickyCta.click()
    await expect(page.locator("#pricing")).toBeFocused({ timeout: 2_000 })
    await expect(stickyCta).toHaveAttribute("data-offer-sticky-state", "after_pricing")

    await expect(stickyCta).toHaveAttribute("data-offer-destination", "checkout")
    await expect(stickyCta).toHaveAttribute("data-offer-source-section", "pricing")
    await expect(stickyCta).toHaveAttribute("data-offer-selected-interval", "quarter")
    await expect(stickyCta).toContainText("Quartal · €34,99")
    await expect(stickyCta).toContainText("Zur Zahlung")
    const afterBox = await stickyCta.boundingBox()
    expect(afterBox?.width).toBeCloseTo(beforeBox?.width ?? 144, 1)

    await page.getByRole("button", { name: /Monatlich/ }).click()
    await expect(stickyCta).toHaveAttribute("data-offer-selected-interval", "month")
    await expect(stickyCta).toContainText("Monatlich · €14,99")

    await stickyCta.click()
    await expect(page.getByRole("dialog", { name: "Sicher bezahlen" })).toBeVisible({
      timeout: 10_000,
    })
  })

  test("membership readiness stays pristine for immediate close and plan change", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.route("**/api/stripe/create-checkout-session", async (route) => {
      await route.fulfill({
        body: JSON.stringify({ error: "synthetic lab response" }),
        contentType: "application/json",
        status: 503,
      })
    })
    await openPersonalPlanLab(page, "membership")
    await revealPricing(page)

    const stickyCta = page.locator("[data-offer-sticky-cta]")
    await stickyCta.click()
    let checkout = page.getByRole("dialog", { name: "Sicher bezahlen" })
    await expect(checkout).toBeVisible({ timeout: 10_000 })
    await checkout.getByRole("button", { name: "Zahlung schließen" }).click()
    await expect(checkout).toBeHidden()
    await expect(page.getByRole("alertdialog", { name: "Zahlung abbrechen?" })).toHaveCount(0)

    await stickyCta.click()
    checkout = page.getByRole("dialog", { name: "Sicher bezahlen" })
    await expect(checkout).toBeVisible({ timeout: 10_000 })
    await checkout.getByRole("button", { name: "Plan ändern" }).click()
    await expect(checkout).toBeHidden()
    await expect(page.getByRole("alertdialog", { name: "Zahlung abbrechen?" })).toHaveCount(0)
  })

  test("one-time sticky CTA never invents a billing interval after pricing is reached", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 740 })
    await openPersonalPlanLab(page, "one_time")

    const stickyCta = page.locator("[data-offer-sticky-cta]")
    await expect(stickyCta).toHaveAttribute("data-offer-destination", "pricing")
    await expect(stickyCta).toHaveAttribute("data-offer-source-section", "hero")
    await revealPricing(page)
    await expect(stickyCta).toHaveAttribute("data-offer-destination", "checkout")
    await expect(stickyCta).toHaveAttribute("data-offer-source-section", "pricing")
    await expect(stickyCta).not.toHaveAttribute("data-offer-selected-interval")
    await expect(stickyCta).toContainText("Haarplan · 29,99 €")
    await expect(stickyCta).toContainText("Zur Zahlung")
  })

  test("personal-plan offer never starts provider work before checkout opens", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await enableApplePayCapability(page)
    let checkoutPreparationRequests = 0
    await page.route("**/api/stripe/create-checkout-session", async (route) => {
      checkoutPreparationRequests += 1
      await route.fulfill({
        body: JSON.stringify({ error: "synthetic lab response" }),
        contentType: "application/json",
        status: 503,
      })
    })

    for (const pricingArm of ["one_time", "membership"] as const) {
      await openPersonalPlanLab(page, pricingArm)
      await revealPricing(page)
      await page.waitForTimeout(500)
    }

    expect(checkoutPreparationRequests).toBe(0)
  })

  for (const disabledGate of ["express", "overlay"] as const) {
    test(`one-time Stripe containment is PayPal-only with ${disabledGate} off`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 390, height: 844 })
      await stubPayPalSdk(page)
      let stripeRequests = 0
      await page.route("**/api/stripe/create-checkout-session", async (route) => {
        stripeRequests += 1
        await route.abort()
      })
      await openPersonalPlanLab(
        page,
        "one_time",
        disabledGate === "express" ? { expressElements: "off" } : { overlay: "off" },
      )

      const openCheckout = page.getByRole("button", {
        name: "Haarplan für €29,99 freischalten",
      })
      await openCheckout.scrollIntoViewIfNeeded()
      await openCheckout.click()
      const checkout = page.getByRole("dialog", { name: "Sicher bezahlen" })

      await expect(checkout.locator('[data-offer-payment-option="paypal"]')).toBeVisible()
      await expect(checkout.locator('[data-offer-payment-placeholder="paypal"]')).toHaveCount(0)
      await expect(checkout.locator('[data-offer-payment-placeholder="apple_pay"]')).toHaveCount(0)
      await expect(checkout.getByRole("button", { name: "Mit Karte bezahlen" })).toHaveCount(0)
      await checkout.getByRole("checkbox").check()
      await expect(checkout.locator('[data-offer-payment-placeholder="paypal"]')).toHaveCount(0)
      await expect(checkout.getByRole("button", { name: "PayPal" })).toBeVisible()
      expect(stripeRequests).toBe(0)
    })
  }

  test("one-time checkout dismisses pristine state directly and protects consent or provider engagement", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.route("**/api/stripe/create-checkout-session", async (route) => {
      await route.fulfill({
        body: JSON.stringify({ error: "synthetic lab response" }),
        contentType: "application/json",
        status: 503,
      })
    })
    await openPersonalPlanLab(page, "one_time")
    const openCheckout = page.getByRole("button", {
      name: "Haarplan für €29,99 freischalten",
    })
    await openCheckout.scrollIntoViewIfNeeded()

    await openCheckout.click()
    let checkout = page.getByRole("dialog", { name: "Sicher bezahlen" })
    await expect(checkout).toBeVisible()
    await checkout.getByRole("button", { name: "Zahlung schließen" }).last().click()
    await expect(checkout).toBeHidden()
    await expect(page.getByRole("alertdialog", { name: "Zahlung abbrechen?" })).toHaveCount(0)

    await openCheckout.click()
    checkout = page.getByRole("dialog", { name: "Sicher bezahlen" })
    let consent = checkout.getByRole("checkbox")
    await consent.check()
    await checkout.getByRole("button", { name: "Zahlung schließen" }).last().click()
    const confirmation = page.getByRole("alertdialog", { name: "Zahlung abbrechen?" })
    await expect(confirmation).toBeVisible()
    await page.getByRole("button", { name: "Weiter bezahlen" }).click()
    await expect(consent).toBeChecked()
    await checkout.getByRole("button", { name: "Zahlung schließen" }).last().click()
    await page.getByRole("button", { name: "Zahlung abbrechen" }).click()
    await expect(checkout).toBeHidden()

    await openCheckout.click()
    checkout = page.getByRole("dialog", { name: "Sicher bezahlen" })
    consent = checkout.getByRole("checkbox")
    await expect(consent).not.toBeChecked()
    await consent.check()
    await checkout.getByRole("button", { name: "Mit Karte bezahlen" }).click()
    await checkout.getByRole("button", { name: "Zahlung schließen" }).last().click()
    await expect(confirmation).toBeVisible()
  })

  test("FAQ disclosure remains native and supports keyboard reversal", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await openPersonalPlanLab(page, "membership")

    const faq = page.locator("[data-offer-faq='personal-plan-1']")
    const summary = faq.locator("summary")
    await expect(faq).not.toHaveAttribute("open")
    await summary.focus()
    await page.keyboard.press("Enter")
    await expect(faq).toHaveAttribute("open", "")
    await expect(faq).toHaveAttribute("data-offer-faq-state", "open")

    await page.keyboard.press(" ")
    await expect(faq).not.toHaveAttribute("open")
    await expect(faq).toHaveAttribute("data-offer-faq-state", "closed")

    await summary.click()
    await summary.click()
    await expect(faq).not.toHaveAttribute("open")
  })

  test("reduced motion keeps pricing, sticky summary, and FAQ state changes immediate", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" })
    await page.setViewportSize({ width: 390, height: 844 })
    await openPersonalPlanLab(page, "membership")
    await revealPricing(page)

    const stickySummary = page.locator("[data-offer-sticky-summary]")
    await expect(stickySummary).toHaveCSS("animation-name", "none")
    await page.getByRole("button", { name: /Monatlich/ }).click()
    await expect(page.locator("[data-offer-plan-cta-content]")).toHaveCSS("animation-name", "none")

    const faq = page.locator("[data-offer-faq='personal-plan-1']")
    await faq.locator("summary").click()
    await expect(faq).toHaveAttribute("open", "")
    await expect(faq).toHaveCSS("transition-duration", "0s")
    expect(await faq.getAttribute("style")).toBeNull()
    await faq.locator("summary").click()
    await expect(faq).not.toHaveAttribute("open")
  })
})
