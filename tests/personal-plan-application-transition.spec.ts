import { expect, test, type Page } from "@playwright/test"

const labPath = "/labs/personal-plan-application"

async function openLab(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "chaarlie_cookie_consent_v1",
      JSON.stringify({ essential: true, analytics: false, marketing: false, ts: Date.now() }),
    )
  })
  await page.goto(labPath)
}

test("Anwendung reuses loaded guidance for day, Back, and Forward", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 400 })
  const applicationRscRequests: string[] = []
  page.on("request", (request) => {
    if (request.headers().rsc === "1" || request.url().includes("_rsc=")) {
      applicationRscRequests.push(request.url())
    }
  })
  await openLab(page)
  await expect(page.locator("[data-personal-plan-application-root]")).toHaveAttribute(
    "data-application-router-pathname",
    labPath,
  )
  applicationRscRequests.length = 0

  await page.evaluate(() =>
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }),
  )
  const overviewScrollY = await page.evaluate(() => window.scrollY)
  expect(overviewScrollY).toBeGreaterThan(0)
  await page
    .getByRole("link", { name: /Waschtag:/ })
    .evaluate((link) => (link as HTMLElement).click())
  await expect(page).toHaveURL(`${labPath}/wash_day`)
  await expect(page.locator("[data-personal-plan-application-root]")).toHaveAttribute(
    "data-application-router-pathname",
    `${labPath}/wash_day`,
  )
  await expect(page.getByRole("heading", { name: "Waschtag" })).toBeFocused()
  expect(applicationRscRequests).toEqual([])

  await page.evaluate(() =>
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }),
  )
  const dayScrollY = await page.evaluate(() => window.scrollY)
  expect(dayScrollY).toBeGreaterThan(0)

  await page.goBack()
  await expect(page).toHaveURL(labPath)
  await expect(page.locator("[data-personal-plan-application-root]")).toHaveAttribute(
    "data-application-router-pathname",
    labPath,
  )
  await expect(page.getByRole("heading", { name: "Anwendung" })).toBeFocused()
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(overviewScrollY)
  expect(applicationRscRequests).toEqual([])

  await page.goForward()
  await expect(page).toHaveURL(`${labPath}/wash_day`)
  await expect(page.locator("[data-personal-plan-application-root]")).toHaveAttribute(
    "data-application-router-pathname",
    `${labPath}/wash_day`,
  )
  await expect(page.getByRole("heading", { name: "Waschtag" })).toBeFocused()
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(dayScrollY)
  expect(applicationRscRequests).toEqual([])
})

test("direct day deep links and reloads remain server-addressable", async ({ page }) => {
  await openLab(page)
  await page.goto(`${labPath}/wash_day`)

  await expect(page.getByRole("heading", { name: "Waschtag" })).toBeVisible()
  await expect(page.locator("[data-personal-plan-application-root]")).toHaveAttribute(
    "data-application-router-pathname",
    `${labPath}/wash_day`,
  )
  await expect(page.locator("[data-personal-plan-view-transition]")).toHaveAttribute(
    "data-personal-plan-transition-active",
    "false",
  )

  await page.reload()
  await expect(page.getByRole("heading", { name: "Waschtag" })).toBeVisible()
})

test("reduced motion keeps the same history and focus contract without animation", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await openLab(page)
  await page.getByRole("link", { name: /Waschtag:/ }).click()

  await expect(page).toHaveURL(`${labPath}/wash_day`)
  await expect(page.getByRole("heading", { name: "Waschtag" })).toBeFocused()
  await expect(page.locator(".personal-plan-view-transition-layer")).toHaveCSS(
    "animation-name",
    "none",
  )
})
