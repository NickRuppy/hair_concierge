import { expect, test, type Page } from "@playwright/test"

const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000"
const labEnabled = process.env.CI_SCANNER_REFINEMENT_LAB_ENABLED === "true"

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

      const bottomCta = page.locator('[data-offer-cta="sticky_bottom"]')
      await expect(bottomCta).toHaveCount(1)
      await bottomCta.click()
      await expect(page.locator("#pricing")).toBeInViewport()

      const dockGeometry = await purchaseGeometry(page)
      expect(dockGeometry.separate).toBe(true)
      expect(dockGeometry.dockTop - dockGeometry.whatsappBottom).toBeCloseTo(12, 0)

      const whatsapp = page.getByRole("link", { name: "Frage per WhatsApp stellen" })
      await expect(whatsapp).toHaveCount(1)
      await expect(whatsapp).toHaveAttribute("href", "https://wa.me/message/NIQW4GQHV7UTD1")
      await expect(whatsapp).toHaveAttribute("target", "_blank")
      await expect(whatsapp).toHaveAttribute("rel", "noopener")
      await expect(page.getByText("WhatsApp-Kontakt noch nicht verfügbar")).toHaveCount(0)

      const zoom = page.getByRole("button", {
        name: "Scan-Ergebnis für ein Beispielprofil vergrößern",
      })
      await expect(zoom).toHaveCount(1)
      await zoom.click()
      const exampleDialog = page.getByRole("dialog", { name: "Scan-Ergebnis · Beispielprofil" })
      await expect(exampleDialog).toBeVisible()
      await expect(exampleDialog.locator("img")).toHaveAttribute("width", "390")
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
