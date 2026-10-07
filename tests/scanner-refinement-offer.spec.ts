import { expect, test, type Page } from "@playwright/test"

const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000"
const labEnabled = process.env.CI_SCANNER_REFINEMENT_LAB_ENABLED === "true"

type CapturedEvent = { eventName: string; properties?: Record<string, unknown> }

async function capturedEvents(page: Page) {
  return page.evaluate(
    () =>
      (window as Window & { __scannerRefinementAnalyticsEvents?: CapturedEvent[] })
        .__scannerRefinementAnalyticsEvents ?? [],
  )
}

async function clearCapturedEvents(page: Page) {
  await page.evaluate(() => {
    ;(
      window as Window & { __scannerRefinementAnalyticsEvents?: CapturedEvent[] }
    ).__scannerRefinementAnalyticsEvents = []
  })
}

test.describe("scanner refinement offer lab", () => {
  test.skip(labEnabled === false, "requires CI_SCANNER_REFINEMENT_LAB_ENABLED=true")

  test.beforeAll(async ({ request }) => {
    // Compile the shared dev routes before interaction: compiling the quiz in
    // parallel can otherwise reload the lab and reset its selected plan.
    for (const path of ["/lp/scan", "/labs/scanner-refinement", "/api/funnel/session"]) {
      const response = await request.get(`${baseUrl}${path}`)
      expect(response.ok()).toBe(true)
    }
  })

  for (const viewport of [
    { name: "320px", width: 320, height: 700 },
    { name: "390px", width: 390, height: 844 },
  ]) {
    test(`${viewport.name}: real offer keeps controls usable and local`, async ({ page }) => {
      test.setTimeout(60000)
      await page.emulateMedia({ reducedMotion: "reduce" })
      await page.addInitScript(() =>
        localStorage.setItem(
          "chaarlie_cookie_consent_v1",
          JSON.stringify({ essential: true, analytics: false, marketing: false, ts: Date.now() }),
        ),
      )
      await page.setViewportSize(viewport)
      await page.goto(`${baseUrl}/labs/scanner-refinement`, { waitUntil: "networkidle" })

      const harness = page.locator("[data-scanner-refinement-hydrated]")
      await expect(harness).toHaveAttribute("data-scanner-refinement-hydrated", "true", {
        timeout: 20_000,
      })
      await clearCapturedEvents(page)
      await expect(page.locator(".sr-offer")).toBeVisible()
      await expect(page.locator("video track[kind='captions'][srclang='de']")).toHaveCount(1)
      await expect(page.locator("video track[kind='captions']")).toHaveAttribute("default", "")

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      )
      expect(overflow).toBeLessThanOrEqual(1)

      const headerCta = page.locator('[data-offer-cta="sticky_header"]')
      await expect(headerCta).toHaveCount(1)
      await headerCta.click()
      await expect(page.locator("#pricing")).toBeInViewport()

      const month = page.locator('[data-trial-offer-plan="month"]')
      await expect(month).toHaveCount(1)
      await expect(month).toBeEnabled()
      await month.click()
      await expect(month).toHaveAttribute("aria-pressed", "true")
      await expect(page.locator('[data-scanner-refinement-selected-interval="month"]')).toHaveCount(
        1,
      )
      await expect(page.locator(".sr-trial-card")).toContainText("dann 9,99 € / Monat")

      const localCheckout = page.locator("[data-trial-offer-continue]")
      await localCheckout.click()
      await expect(page.locator("[data-scanner-refinement-lab-status]")).toContainText(
        "Kein Checkout wurde geöffnet",
      )

      await expect
        .poll(async () => capturedEvents(page))
        .toContainEqual(
          expect.objectContaining({
            eventName: "offer_cta_clicked",
            properties: expect.objectContaining({
              cta_id: "pricing_primary",
              destination: "checkout",
              selected_interval: "month",
              source_section: "pricing",
            }),
          }),
        )

      const bottomCta = page.locator('[data-offer-cta="sticky_bottom"]')
      await expect(bottomCta).toHaveCount(1)
      await bottomCta.click()
      await expect(page.locator("#pricing")).toBeInViewport()

      const zoom = page.getByRole("button", {
        name: "Scan-Ergebnis für ein Beispielprofil vergrößern",
      })
      await expect(zoom).toHaveCount(1)
      await zoom.click()
      const exampleDialog = page.getByRole("dialog", { name: "Scan-Ergebnis · Beispielprofil" })
      await expect(exampleDialog).toBeVisible()
      await expect(exampleDialog.locator("img")).toHaveAttribute("width", "390")
      await page.keyboard.press("Escape")
      await expect(exampleDialog).toBeHidden()

      const carouselButtons = page.locator(".sr-carousel-controls button")
      await expect(carouselButtons).toHaveCount(2)
      await carouselButtons.nth(0).click()
      await carouselButtons.nth(1).click()

      const cards = page.locator(".sr-benefit-track > li")
      await expect(cards).toHaveCount(4)
      for (let index = 0; index < 4; index += 1) {
        await cards.nth(index).scrollIntoViewIfNeeded()
        await page.waitForTimeout(800)
      }
      await cards.nth(0).scrollIntoViewIfNeeded()
      await page.waitForTimeout(800)

      const video = page.locator("video")
      await expect(video).toHaveCount(1)
      await video.dispatchEvent("play")
      await video.dispatchEvent("ended")
      await video.dispatchEvent("error")
      await expect(video).toHaveCount(0)

      await page.evaluate(() => {
        document.addEventListener(
          "click",
          (event) => {
            if ((event.target as Element).closest('a[href^="https://wa.me/"]'))
              event.preventDefault()
          },
          { capture: true },
        )
      })
      const whatsappLinks = page.locator('a[href="https://wa.me/message/NIQW4GQHV7UTD1"]')
      await expect(whatsappLinks).toHaveCount(3)
      for (let index = 0; index < 3; index += 1) await whatsappLinks.nth(index).click()

      await expect
        .poll(async () => capturedEvents(page))
        .toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              eventName: "offer_content_interacted",
              properties: expect.objectContaining({
                content_type: "scanner_example",
                action: "opened",
              }),
            }),
            expect.objectContaining({
              eventName: "offer_content_interacted",
              properties: expect.objectContaining({
                content_type: "scanner_example",
                action: "closed",
              }),
            }),
          ]),
        )
      await expect
        .poll(async () => {
          const events = await capturedEvents(page)
          const content = events.filter((event) => event.eventName === "offer_content_interacted")
          const views = events.filter((event) => event.eventName === "offer_content_viewed")
          return Boolean(
            content.filter((event) => event.properties?.content_type === "scanner_example")
              .length === 2 &&
            content.some(
              (event) =>
                event.properties?.content_type === "scanner_benefit_carousel" &&
                event.properties?.action === "previous",
            ) &&
            content.some(
              (event) =>
                event.properties?.content_type === "scanner_benefit_carousel" &&
                event.properties?.action === "next",
            ) &&
            content.filter((event) => event.properties?.content_type === "scanner_video").length ===
              3 &&
            content.filter((event) => event.properties?.content_type === "scanner_whatsapp")
              .length === 3 &&
            views.length === 4 &&
            new Set(views.map((event) => event.properties?.content_id)).size === 4,
          )
        })
        .toBe(true)

      const events = await capturedEvents(page)
      const content = events.filter((event) => event.eventName === "offer_content_interacted")
      expect(
        content.filter((event) => event.properties?.content_type === "scanner_whatsapp"),
      ).toEqual([
        expect.objectContaining({
          properties: expect.objectContaining({
            placement: "pricing_inline",
            source_section: "pricing",
          }),
        }),
        expect.objectContaining({ properties: expect.objectContaining({ placement: "footer" }) }),
        expect.objectContaining({ properties: expect.objectContaining({ placement: "floating" }) }),
      ])
      for (const event of content.filter(
        (event) => event.properties?.content_type === "scanner_whatsapp",
      )) {
        expect(event.properties?.source_section).not.toBe("faq")
        expect(event.properties).not.toHaveProperty("url")
      }

      const dockGeometry = await purchaseGeometry(page)
      expect(dockGeometry.separate).toBe(true)
      expect(dockGeometry.dockTop - dockGeometry.whatsappBottom).toBeCloseTo(12, 0)

      const whatsapp = page.getByRole("link", { name: "Frage per WhatsApp stellen" })
      await expect(whatsapp).toHaveCount(1)
      await expect(whatsapp).toHaveAttribute("href", "https://wa.me/message/NIQW4GQHV7UTD1")
      await expect(whatsapp).toHaveAttribute("target", "_blank")
      await expect(whatsapp).toHaveAttribute("rel", "noopener")
      await expect(page.getByText("WhatsApp-Kontakt noch nicht verfügbar")).toHaveCount(0)
    })
  }
})

async function purchaseGeometry(page: Page) {
  return page.evaluate(() => {
    const dock = document.querySelector<HTMLElement>(".sr-dock")
    const whatsapp = document.querySelector<HTMLElement>(".sr-whatsapp")
    if (!dock || !whatsapp) throw new Error("Purchase controls missing")
    const dockRect = dock.getBoundingClientRect()
    const whatsappRect = whatsapp.getBoundingClientRect()
    return {
      dockTop: dockRect.top,
      separate: dock !== whatsapp.parentElement,
      whatsappBottom: whatsappRect.bottom,
    }
  })
}
