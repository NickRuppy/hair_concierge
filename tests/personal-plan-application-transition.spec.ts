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

async function pauseTransitionAnimations(page: Page) {
  await page.addStyleTag({
    content: ".personal-plan-view-transition-layer { animation-play-state: paused !important; }",
  })
}

async function transitionMetrics(page: Page, selector: string) {
  return page.locator(selector).evaluate((element) => {
    const style = window.getComputedStyle(element)
    const matrix = new DOMMatrixReadOnly(style.transform)
    return {
      animationDuration: style.animationDuration,
      animationName: style.animationName,
      opacity: style.opacity,
      translateX: matrix.m41,
    }
  })
}

test("programmatic post-payment changes use the quiz fade, retain no old-height tail, and finish at 200ms", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 400 })
  await page.emulateMedia({ reducedMotion: "no-preference" })
  await page.goto("/labs/personal-plan-view-transition")
  await page.clock.install({ time: new Date("2026-08-28T12:00:00Z") })
  await page.clock.pauseAt(new Date("2026-08-28T12:00:01Z"))
  await pauseTransitionAnimations(page)
  const overviewDocumentHeight = await page.evaluate(() => document.documentElement.scrollHeight)

  await page
    .getByRole("button", { name: "Detail programmatisch öffnen" })
    .evaluate((button) => (button as HTMLButtonElement).click())

  const root = page.locator("[data-personal-plan-view-transition]")
  const incoming = ".personal-plan-view-transition-incoming[data-transition-direction=forward]"
  const outgoing = ".personal-plan-view-transition-outgoing[data-transition-direction=forward]"
  await expect(root).toHaveAttribute("data-personal-plan-view-transition", "quiz")
  await expect(page.locator(incoming)).toHaveCount(1)
  await expect(page.locator(outgoing)).toHaveCount(1)

  expect(await transitionMetrics(page, incoming)).toEqual({
    animationDuration: "0.2s",
    animationName: "personalPlanScreenEnterForward",
    opacity: "0",
    translateX: 8,
  })
  expect(await transitionMetrics(page, outgoing)).toEqual({
    animationDuration: "0.16s",
    animationName: "personalPlanScreenExitForward",
    opacity: "1",
    translateX: 0,
  })

  // The 2,400px outgoing overview is a visual layer only. The shorter incoming
  // detail owns layout while both layers overlap, including document height.
  expect(await root.evaluate((element) => element.getBoundingClientRect().height)).toBeLessThan(
    1_300,
  )
  const documentHeightDuring = await page.evaluate(() => document.documentElement.scrollHeight)
  expect(documentHeightDuring).toBeLessThan(overviewDocumentHeight)

  await page.clock.runFor(199)
  expect(await page.locator(".personal-plan-view-transition-outgoing").count()).toBe(1)
  await page.clock.runFor(1)
  expect(await page.locator(".personal-plan-view-transition-outgoing").count()).toBe(0)
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(
    documentHeightDuring,
  )
  await expect(page.getByRole("heading", { name: "Programmatisches Detail" })).toBeFocused()

  await page
    .getByRole("button", { name: "Übersicht programmatisch öffnen" })
    .evaluate((button) => (button as HTMLButtonElement).click())
  const reverseIncoming =
    ".personal-plan-view-transition-incoming[data-transition-direction=reverse]"
  const reverseOutgoing =
    ".personal-plan-view-transition-outgoing[data-transition-direction=reverse]"
  expect(await transitionMetrics(page, reverseIncoming)).toEqual({
    animationDuration: "0.2s",
    animationName: "personalPlanScreenEnterBack",
    opacity: "0",
    translateX: -8,
  })
  expect(await transitionMetrics(page, reverseOutgoing)).toEqual({
    animationDuration: "0.16s",
    animationName: "personalPlanScreenExitBack",
    opacity: "1",
    translateX: 0,
  })
})

test("Anwendung stage arrival uses the quiz entrance once inside a stationary clipping boundary", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: "no-preference" })
  await page.addInitScript(() => {
    const samples: {
      animation: string
      duration: string
      clip: string
      transform: string
      overflow: boolean
    }[] = []
    Reflect.set(window, "stageEntrySamples", samples)
    new MutationObserver(() => {
      const entry = document.querySelector('[data-personal-plan-stage-entrance="/anwendung"]')
      if (!entry?.parentElement) return
      samples.push({
        animation: getComputedStyle(entry).animationName,
        duration: getComputedStyle(entry).animationDuration,
        clip: getComputedStyle(entry.parentElement).overflowX,
        transform: getComputedStyle(entry.parentElement).transform,
        overflow: document.documentElement.scrollWidth > window.innerWidth,
      })
    }).observe(document, { subtree: true, attributes: true, childList: true })
  })
  await page.goto("/")
  await page.evaluate(() => {
    window.sessionStorage.setItem(
      "chaarlie:personal-plan:stage-navigation:v1",
      JSON.stringify({ version: 1, destination: "/anwendung", createdAt: Date.now() }),
    )
  })
  await openLab(page)

  await expect
    .poll(() => page.evaluate(() => Reflect.get(window, "stageEntrySamples").length))
    .toBeGreaterThan(0)
  const samples = await page.evaluate(() => Reflect.get(window, "stageEntrySamples"))
  for (const sample of samples) {
    expect(sample).toEqual({
      animation: "personalPlanScreenEnterForward",
      duration: "0.2s",
      clip: "clip",
      transform: "none",
      overflow: false,
    })
  }
  await expect(page.locator("[data-personal-plan-view-transition]")).toHaveAttribute(
    "data-personal-plan-transition-active",
    "false",
  )

  await expect(page.locator('[data-personal-plan-stage-entrance="/anwendung"]')).toHaveCount(0)
  await page.reload()
  await expect.poll(() => page.evaluate(() => window.history.scrollRestoration)).toBe("manual")
  expect(await page.evaluate(() => Reflect.get(window, "stageEntrySamples"))).toEqual([])
})

test("Anwendung reuses loaded guidance for day, Back, and Forward", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 400 })
  await page.addInitScript(() => {
    window.history.scrollRestoration = "auto"
  })
  const applicationRscRequests: string[] = []
  page.on("request", (request) => {
    if (request.headers().rsc === "1" || request.url().includes("_rsc=")) {
      applicationRscRequests.push(request.url())
    }
  })
  await openLab(page)
  // Task 2.7: the journey header (and its "Zur Routine" / "Alle Tage" Back
  // controls) retired from Anwendung — the Bottom-Nav and the browser's own
  // Back/Forward carry that navigation now.
  await expect(page.locator('[data-personal-plan-journey-header="true"]')).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => window.history.scrollRestoration)).toBe("manual")
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

  // No in-page "Alle Tage" control anymore (Task 2.7) — the browser's own
  // Back reaches the overview, restoring scroll and focus exactly the same.
  await page.goBack()
  await expect(page).toHaveURL(labPath)
  await expect(page.locator("[data-personal-plan-application-root]")).toHaveAttribute(
    "data-application-router-pathname",
    labPath,
  )
  await expect(page.getByRole("heading", { name: "Anwendung" })).toBeFocused()
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(overviewScrollY)
  expect(applicationRscRequests).toEqual([])

  await page.getByRole("link", { name: /Waschtag:/ }).click()
  await page.goBack()
  await expect(page).toHaveURL(labPath)

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

test("programmatic viewKey transitions preserve the outgoing view scroll", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 400 })
  await page.goto("/labs/personal-plan-view-transition")

  await page
    .getByRole("button", { name: "Detail programmatisch öffnen" })
    .evaluate((button) => (button as HTMLButtonElement).click())
  const overviewScrollY = Number(
    await page.locator("[data-programmatic-transition-lab]").getAttribute("data-outgoing-scroll-y"),
  )
  expect(overviewScrollY).toBeGreaterThan(0)
  await expect(page.getByRole("heading", { name: "Programmatisches Detail" })).toBeFocused()

  await page
    .getByRole("button", { name: "Übersicht programmatisch öffnen" })
    .evaluate((button) => (button as HTMLButtonElement).click())
  const detailScrollY = Number(
    await page.locator("[data-programmatic-transition-lab]").getAttribute("data-outgoing-scroll-y"),
  )
  expect(detailScrollY).toBeGreaterThan(0)
  await expect(page.getByRole("heading", { name: "Programmatische Übersicht" })).toBeFocused()
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(overviewScrollY)

  await page
    .getByRole("button", { name: "Detail programmatisch öffnen" })
    .evaluate((button) => (button as HTMLButtonElement).click())
  await expect(page.getByRole("heading", { name: "Programmatisches Detail" })).toBeFocused()
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(detailScrollY)

  await page.getByRole("button", { name: "Übergang entfernen" }).click()
  await expect.poll(() => page.evaluate(() => window.history.scrollRestoration)).toBe("auto")
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

test("day click at the first interactive instant renders the day view (pre history-patch)", async ({
  page,
}) => {
  // Regression for a CI-only flake: Next installs its history.pushState patch (which feeds
  // usePathname) in a passive effect on the root router, while the app becomes interactive one
  // effect phase earlier — when PersonalPlanViewTransition's layout effect sets
  // history.scrollRestoration = "manual". A click landing in that window used to change the URL
  // via the unpatched pushState and strand the overview on screen forever. Clicking synchronously
  // at the scrollRestoration flip deterministically exercises that window.
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "chaarlie_cookie_consent_v1",
      JSON.stringify({ essential: true, analytics: false, marketing: false, ts: Date.now() }),
    )
    const descriptor = Object.getOwnPropertyDescriptor(History.prototype, "scrollRestoration")
    if (!descriptor?.get || !descriptor.set) return
    const originalSet = descriptor.set
    let clicked = false
    Object.defineProperty(History.prototype, "scrollRestoration", {
      configurable: true,
      get: descriptor.get,
      set(value: ScrollRestoration) {
        originalSet.call(this, value)
        if (value === "manual" && !clicked) {
          const link = document.querySelector<HTMLAnchorElement>('a[href$="/wash_day"]')
          if (link) {
            clicked = true
            link.click()
          }
        }
      },
    })
  })
  await page.goto(labPath)

  await expect(page).toHaveURL(`${labPath}/wash_day`)
  await expect(page.getByRole("heading", { name: "Waschtag" })).toBeFocused()

  // The in-page "← Anwendung" Back must also work from this pre-patch state.
  await page.getByRole("link", { name: "← Anwendung" }).click()
  await expect(page).toHaveURL(labPath)
  await expect(page.getByRole("heading", { name: "Anwendung" })).toBeVisible()
})

test("the in-day Anwendung link returns to the overview after a day visit", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await openLab(page)
  await expect.poll(() => page.evaluate(() => window.history.scrollRestoration)).toBe("manual")

  await page.getByRole("link", { name: /Waschtag:/ }).click()
  await expect(page.locator("[data-personal-plan-application-root]")).toHaveAttribute(
    "data-application-router-pathname",
    `${labPath}/wash_day`,
  )

  await page.getByRole("link", { name: "← Anwendung" }).click()
  await expect(page).toHaveURL(labPath)
  await expect(page.getByRole("heading", { name: "Anwendung" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Waschtag" })).toHaveCount(0)
})

test("reduced motion keeps the same history and focus contract without animation", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await openLab(page)
  // As in the main history test, wait for the client transition owner before clicking.
  await expect.poll(() => page.evaluate(() => window.history.scrollRestoration)).toBe("manual")
  await page.getByRole("link", { name: /Waschtag:/ }).click()

  await expect(page).toHaveURL(`${labPath}/wash_day`)
  await expect(page.getByRole("heading", { name: "Waschtag" })).toBeFocused()
  await expect(page.locator(".personal-plan-view-transition-layer")).toHaveCSS(
    "animation-name",
    "none",
  )
})
