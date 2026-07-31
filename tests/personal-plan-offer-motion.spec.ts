import { expect, test, type Page } from "@playwright/test"

const labPath = "/labs/offer-page?variant=personal-plan"
const offerViewports = [
  { width: 320, height: 568 },
  { width: 360, height: 800 },
  { width: 375, height: 812 },
  { width: 390, height: 844 },
  { width: 1280, height: 800 },
]

async function openPersonalPlanLab(page: Page, pricingArm: "membership" | "one_time") {
  await page.goto(`${labPath}&pricingArm=${pricingArm}`, { waitUntil: "domcontentloaded" })
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
          .filter((animation) => animation.playState === "running")
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
    await expect(stickyCta).toHaveAttribute("data-offer-sticky-state", "before_pricing")
    await expect(stickyCta).toHaveText("Angebot ansehen")
    const beforeBox = await stickyCta.boundingBox()
    expect(beforeBox?.width).toBeGreaterThanOrEqual(142)
    expect(beforeBox?.width).toBeLessThanOrEqual(146)

    await stickyCta.click()
    await expect(page.locator("#pricing")).toBeFocused({ timeout: 2_000 })
    await expect(stickyCta).toHaveAttribute("data-offer-sticky-state", "after_pricing")

    await expect(stickyCta).toHaveAttribute("data-offer-destination", "checkout")
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

  test("one-time sticky CTA never invents a billing interval after pricing is reached", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 740 })
    await openPersonalPlanLab(page, "one_time")

    const stickyCta = page.locator("[data-offer-sticky-cta]")
    await expect(stickyCta).toHaveAttribute("data-offer-destination", "pricing")
    await revealPricing(page)
    await expect(stickyCta).toHaveAttribute("data-offer-destination", "checkout")
    await expect(stickyCta).not.toHaveAttribute("data-offer-selected-interval")
    await expect(stickyCta).toContainText("Haarplan · 29,99 €")
    await expect(stickyCta).toContainText("Zur Zahlung")
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
