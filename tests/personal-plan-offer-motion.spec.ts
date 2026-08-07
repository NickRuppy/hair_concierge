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
            window.__chaarliePayPalMountCount = (window.__chaarliePayPalMountCount || 0) + 1;
            window.__chaarliePayPalOptions = options;
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
                button.addEventListener("click", function () {
                  if (options.createOrder) Promise.resolve(options.createOrder()).catch(function () {});
                });
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
    await expect(stickyCta).toContainText("Haarplan")
    await expect(stickyCta.locator("s")).toHaveText("49,99 €")
    await expect(stickyCta).toContainText("29,99 €")
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
      await expect(checkout.getByRole("checkbox")).toHaveCount(0)
      await expect(checkout.locator('[data-offer-payment-placeholder="paypal"]')).toHaveCount(0)
      await expect(checkout.getByRole("button", { name: "PayPal" })).toBeVisible()
      expect(stripeRequests).toBe(0)
    })
  }

  test("one-time checkout dismisses pristine state directly and protects provider engagement", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await stubPayPalSdk(page)
    await page.route("**/api/stripe/create-checkout-session", async (route) => {
      await route.fulfill({
        body: JSON.stringify({ error: "synthetic lab response" }),
        contentType: "application/json",
        status: 503,
      })
    })
    await page.route("**/api/paypal/create-order-intent", async (route) => {
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
    await expect(checkout.getByRole("checkbox")).toHaveCount(0)
    await checkout.getByRole("button", { name: "PayPal" }).click()
    await checkout.getByRole("button", { name: "Zahlung schließen" }).last().click()
    const confirmation = page.getByRole("alertdialog", { name: "Zahlung abbrechen?" })
    await expect(confirmation).toBeVisible()
    await page.getByRole("button", { name: "Weiter bezahlen" }).click()
    await expect(checkout).toBeVisible()
    await checkout.getByRole("button", { name: "Zahlung schließen" }).last().click()
    await page.getByRole("button", { name: "Zahlung abbrechen" }).click()
    await expect(checkout).toBeHidden()

    await openCheckout.click()
    checkout = page.getByRole("dialog", { name: "Sicher bezahlen" })
    await expect(checkout.getByRole("checkbox")).toHaveCount(0)
    await checkout.getByRole("button", { name: "Zahlung schließen" }).last().click()
    await expect(checkout).toBeHidden()
    await expect(confirmation).toHaveCount(0)
  })

  test("PayPal SDK uncertainty stays pending on the same mounted attempt", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await stubPayPalSdk(page)
    let createOrderCalls = 0
    let statusCalls = 0
    await page.route("**/api/paypal/create-order-intent", async (route) => {
      createOrderCalls += 1
      await route.fulfill({
        body: JSON.stringify({
          orderId: "PAYPAL-ORDER-RECOVERY-1",
          token: "paypal-recovery-token",
        }),
        contentType: "application/json",
        status: 200,
      })
    })
    await page.route("**/api/billing/one-time-activation-status?**", async (route) => {
      statusCalls += 1
      await route.fulfill({
        body: JSON.stringify({ status: "pending" }),
        contentType: "application/json",
        status: 200,
      })
    })

    await openPersonalPlanLab(page, "one_time")
    const openCheckout = page.getByRole("button", {
      name: "Haarplan für €29,99 freischalten",
    })
    await openCheckout.scrollIntoViewIfNeeded()
    await openCheckout.click()
    const checkout = page.getByRole("dialog", { name: "Sicher bezahlen" })
    const paypalButton = checkout.getByRole("button", { name: "PayPal" })
    await paypalButton.click()
    await expect.poll(() => createOrderCalls).toBe(1)

    await page.evaluate(() => {
      const paypalWindow = window as typeof window & {
        __chaarliePayPalOptions?: { onError?: (error: Error) => void }
      }
      paypalWindow.__chaarliePayPalOptions?.onError?.(new Error("synthetic SDK failure"))
    })

    await expect(checkout.getByText("Wir prüfen deine PayPal-Zahlung")).toBeVisible()
    await expect(checkout.getByText("Noch keine Zahlung bestätigt")).toBeVisible({
      timeout: 10_000,
    })
    await expect(
      checkout.getByText(
        "Dieser Zahlungsversuch bleibt PayPal zugeordnet. Nutze unten PayPal, um ihn fortzusetzen.",
      ),
    ).toBeVisible()
    await expect(checkout.getByText("Schließe die Zahlung dort ab.")).toHaveCount(0)
    await expect.poll(() => statusCalls).toBe(3)
    await expect(paypalButton).toBeVisible()
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window as typeof window & { __chaarliePayPalMountCount?: number })
              .__chaarliePayPalMountCount,
        ),
      )
      .toBe(1)
    await expect(checkout.getByText("Zahlung erfolgreich")).toHaveCount(0)

    const manualCheck = checkout.getByRole("button", { name: "Status erneut prüfen" })
    await expect(manualCheck).toBeDisabled()
    await expect(manualCheck).toBeEnabled({ timeout: 4_000 })
    await page.screenshot({
      path: "/tmp/chaarlie-payment-recovery-pending.png",
    })
  })

  test("existing one-time access stops payment and carries the Chaarlie email into login", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await stubPayPalSdk(page)
    await page.route("**/api/stripe/create-checkout-session", async (route) => {
      await route.fulfill({
        body: JSON.stringify({
          error: "checkout_access_already_exists",
          email: "lea@example.com",
        }),
        contentType: "application/json",
        status: 409,
      })
    })

    await openPersonalPlanLab(page, "one_time")
    const openCheckout = page.getByRole("button", {
      name: "Haarplan für €29,99 freischalten",
    })
    await openCheckout.scrollIntoViewIfNeeded()
    await openCheckout.click()

    const existingAccess = page.getByRole("dialog", { name: "Aktiver Zugang gefunden" })
    await expect(existingAccess).toBeVisible()
    await expect(existingAccess.getByText("lea@example.com", { exact: true })).toBeVisible()
    await expect(existingAccess.getByRole("link", { name: "Einloggen" })).toHaveAttribute(
      "href",
      "/auth?email=lea%40example.com",
    )

    const checkout = page.getByRole("dialog", { name: "Sicher bezahlen" })
    await expect(checkout.getByRole("button", { name: "PayPal", exact: true })).toHaveCount(0)
    await expect(checkout.getByRole("button", { name: "Mit Karte bezahlen" })).toHaveCount(0)
    await page.screenshot({
      path: "/tmp/chaarlie-payment-existing-access.png",
    })
  })

  test("a terminal PayPal recovery state hands the customer to support without another payment", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await stubPayPalSdk(page)
    await page.route("**/api/paypal/create-order-intent", async (route) => {
      await route.fulfill({
        body: JSON.stringify({
          orderId: "PAYPAL-ORDER-SUPPORT-1",
          token: "paypal-support-token",
        }),
        contentType: "application/json",
        status: 200,
      })
    })
    await page.route("**/api/billing/one-time-activation-status?**", async (route) => {
      await route.fulfill({
        body: JSON.stringify({ status: "failed_permanent" }),
        contentType: "application/json",
        status: 400,
      })
    })

    await openPersonalPlanLab(page, "one_time")
    const openCheckout = page.getByRole("button", {
      name: "Haarplan für €29,99 freischalten",
    })
    await openCheckout.scrollIntoViewIfNeeded()
    await openCheckout.click()
    const checkout = page.getByRole("dialog", { name: "Sicher bezahlen" })
    await checkout.getByRole("button", { name: "PayPal" }).click()

    await page.evaluate(() => {
      const paypalWindow = window as typeof window & {
        __chaarliePayPalOptions?: { onError?: (error: Error) => void }
      }
      paypalWindow.__chaarliePayPalOptions?.onError?.(new Error("synthetic SDK failure"))
    })

    await page.waitForURL(
      "/welcome?provider=paypal&purchase=one_time&token=paypal-support-token&return_state=failed_permanent",
      { timeout: 10_000 },
    )
    await expect(page.getByRole("heading", { name: "Wir prüfen deinen Zugang" })).toBeVisible()
    await expect(
      page.getByText(
        "Wir konnten deinen Zugang nicht automatisch prüfen. Unser Support hilft dir weiter. Bitte bewahre deine Bestellbestätigung auf.",
      ),
    ).toBeVisible()
    await expect(page.getByRole("link", { name: "Support kontaktieren" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Status erneut prüfen" })).toHaveCount(0)
    await expect(page.getByText("Zahlung erneut")).toHaveCount(0)
    await page.screenshot({ path: "/tmp/chaarlie-payment-support-handoff.png" })
  })

  test("a newly activated customer sees confirmed payment and can choose a login link", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    let magicLinkRequests = 0
    await page.route("**/api/auth/send-magic-link", async (route) => {
      magicLinkRequests += 1
      await route.fulfill({
        body: JSON.stringify({ ok: true }),
        contentType: "application/json",
        status: 200,
      })
    })

    await page.goto("/labs/offer-page?variant=payment-welcome", {
      waitUntil: "domcontentloaded",
    })
    await expect(page.getByText("Zahlung erfolgreich", { exact: true })).toBeVisible()
    await expect(page.getByRole("heading", { name: "Zugang einrichten" })).toBeVisible()
    await expect(page.getByLabel("Chaarlie-E-Mail")).toHaveValue("lea@example.com")
    await expect(page.getByRole("heading", { name: "Mit Passwort fortfahren" })).toBeVisible()
    await expect(page.getByRole("heading", { name: "Ohne Passwort fortfahren" })).toBeVisible()
    await page.screenshot({ path: "/tmp/chaarlie-payment-activation-choice.png" })

    await page.getByRole("button", { name: "Login-Link senden" }).click()
    await expect(page.getByRole("heading", { name: "Check deine E-Mails" })).toBeVisible()
    await expect(page.getByText("Wir haben dir einen Login-Link geschickt.")).toBeVisible()
    expect(magicLinkRequests).toBe(1)
    await page.screenshot({ path: "/tmp/chaarlie-payment-magic-link-sent.png" })
  })

  test("an authenticated returning customer continues into the app instead of payment", async ({
    page,
  }) => {
    test.skip(
      process.env.PLAYWRIGHT_EXPECT_LOCAL_DEV_LOGIN !== "true",
      "run against a local server with LOCAL_DEV_LOGIN_ENABLED=1",
    )
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto("/api/dev/login?next=/profile?membership=reactivated")
    await page.waitForURL("/profile?membership=reactivated", { timeout: 15_000 })
    await expect(page.getByRole("heading", { name: "Mein Profil", level: 1 })).toBeVisible()
    await expect(page.getByRole("heading", { name: "Produkte", level: 2 })).toBeVisible({
      timeout: 10_000,
    })
    await expect(page.getByText("9/10 vollständig", { exact: true })).toBeVisible({
      timeout: 10_000,
    })
    await expect(page.getByText("Zahlung erneut")).toHaveCount(0)
    await page.screenshot({ path: "/tmp/chaarlie-payment-authenticated-handoff.png" })
  })

  test("one-time card selection is single-flight and keeps PayPal available before claim", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await stubPayPalSdk(page)
    let prepareCalls = 0
    await page.route("**/api/stripe/create-checkout-session", async (route) => {
      const body = route.request().postDataJSON() as { action?: unknown }
      if (body.action !== "prepare") {
        await route.fulfill({
          body: JSON.stringify({ error: "unexpected action" }),
          contentType: "application/json",
          status: 400,
        })
        return
      }
      prepareCalls += 1
      await page.waitForTimeout(100)
      await route.fulfill({
        body: JSON.stringify({
          client_secret: "cs_test_single_flight_secret",
          expires_at: Date.now() + 5 * 60_000,
          preparation_token: "prepared-token",
          session_id: "cs_test_single_flight",
          status: "prepared",
        }),
        contentType: "application/json",
        status: 200,
      })
    })

    await openPersonalPlanLab(page, "one_time")
    const openCheckout = page.getByRole("button", {
      name: "Haarplan für €29,99 freischalten",
    })
    await openCheckout.scrollIntoViewIfNeeded()
    await openCheckout.click()
    const checkout = page.getByRole("dialog", { name: "Sicher bezahlen" })

    const cardButton = checkout.getByRole("button", { name: "Mit Karte bezahlen" })
    await expect(cardButton).toBeVisible({ timeout: 10_000 })
    await page.setViewportSize({ width: 391, height: 844 })
    await page.setViewportSize({ width: 390, height: 844 })
    await expect.poll(() => prepareCalls).toBe(1)

    await cardButton.click()
    await expect(checkout.getByRole("button", { name: "PayPal", exact: true })).toBeVisible()
    await expect(
      checkout.getByRole("button", { name: "Stattdessen PayPal verwenden" }),
    ).toBeVisible()
    expect(prepareCalls).toBe(1)
  })

  test("one-time card selection remains available when the PayPal build flag is disabled", async ({
    page,
  }) => {
    test.skip(
      process.env.PLAYWRIGHT_EXPECT_PAYPAL_DISABLED !== "true",
      "run against a server built with NEXT_PUBLIC_PAYPAL_ENABLED=false",
    )
    let prepareCalls = 0
    await page.route("**/api/stripe/create-checkout-session", async (route) => {
      prepareCalls += 1
      await route.fulfill({
        body: JSON.stringify({
          client_secret: "cs_test_paypal_disabled_secret",
          expires_at: Date.now() + 5 * 60_000,
          preparation_token: "prepared-token",
          session_id: "cs_test_paypal_disabled",
          status: "prepared",
        }),
        contentType: "application/json",
        status: 200,
      })
    })

    await openPersonalPlanLab(page, "one_time")
    const openCheckout = page.getByRole("button", {
      name: "Haarplan für €29,99 freischalten",
    })
    await openCheckout.scrollIntoViewIfNeeded()
    await openCheckout.click()
    const checkout = page.getByRole("dialog", { name: "Sicher bezahlen" })

    await expect(checkout.getByRole("button", { name: "Mit Karte bezahlen" })).toBeVisible({
      timeout: 10_000,
    })
    await expect(checkout.getByRole("button", { name: "PayPal", exact: true })).toHaveCount(0)
    expect(prepareCalls).toBe(1)
  })

  test("FAQ disclosure remains native and supports keyboard reversal", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await openPersonalPlanLab(page, "membership")

    const faq = page.locator("[data-offer-faq='new-shampoo-not-enough']")
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

    const faq = page.locator("[data-offer-faq='new-shampoo-not-enough']")
    await faq.locator("summary").click()
    await expect(faq).toHaveAttribute("open", "")
    await expect(faq).toHaveCSS("transition-duration", "0s")
    expect(await faq.getAttribute("style")).toBeNull()
    await faq.locator("summary").click()
    await expect(faq).not.toHaveAttribute("open")
  })
})
