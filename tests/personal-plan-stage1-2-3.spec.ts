import { expect, test, type Page } from "@playwright/test"

const labPath = "/labs/personal-plan-stage-1-2"
const currentQuestion = (page: Page) =>
  page.locator(".personal-plan-view-transition-layer:not(.personal-plan-view-transition-outgoing)")
const visibleContinueButton = (page: Page) =>
  page.getByRole("button", { name: "Weiter", exact: true })

async function chooseAndContinue(page: Page, name: RegExp | string) {
  await currentQuestion(page)
    .getByRole("button", { name, exact: typeof name === "string" })
    .click()
  await visibleContinueButton(page).click()
}

async function chooseNoneAndContinue(page: Page) {
  await currentQuestion(page).getByRole("button", { name: "Nichts davon", exact: true }).click()
  await visibleContinueButton(page).click()
}

async function completeRefinement(page: Page) {
  await page.getByRole("button", { name: /Feinschliff starten/ }).click()
  await chooseAndContinue(page, "Shampoo")
  await chooseAndContinue(page, "2×/Woche")
  await chooseAndContinue(page, "Leicht empfindlich oder juckend")
  await chooseAndContinue(page, "Nein, lieber nicht")
  await chooseAndContinue(page, "Kein Handtuch oder Tuch")
  await chooseNoneAndContinue(page)
  await chooseNoneAndContinue(page)
  await chooseNoneAndContinue(page)
}

test.describe("Personal Plan Stage 1 to 3 integration lab", () => {
  test.use({ viewport: { width: 375, height: 844 }, hasTouch: true })

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem(
        "chaarlie_cookie_consent_v1",
        JSON.stringify({ essential: true, analytics: false, marketing: false, ts: Date.now() }),
      )
    })
  })

  test("Feinschliff keeps its header and one mobile action stationary while its question uses the quiz fade", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" })
    await page.goto(labPath)
    await page.getByRole("button", { name: /Feinschliff starten/ }).click()
    await page.clock.install({ time: new Date("2026-08-28T12:00:00Z") })
    await page.clock.pauseAt(new Date("2026-08-28T12:00:01Z"))

    const header = page.locator('[data-personal-plan-journey-header="true"]')
    const headerBefore = await header.boundingBox()
    expect(headerBefore).not.toBeNull()
    await page.addStyleTag({
      content: ".personal-plan-view-transition-layer { animation-play-state: paused !important; }",
    })

    await currentQuestion(page)
      .getByRole("button", { name: "Shampoo", exact: true })
      .evaluate((button) => (button as HTMLButtonElement).click())
    await visibleContinueButton(page).evaluate((button) => (button as HTMLButtonElement).click())
    const incoming = page.locator(
      '.personal-plan-view-transition-incoming[data-transition-direction="forward"]',
    )
    const outgoing = page.locator(
      '.personal-plan-view-transition-outgoing[data-transition-direction="forward"]',
    )
    await expect(incoming).toHaveCount(1)
    await expect(outgoing).toHaveCount(1)
    await expect(incoming).toHaveCSS("animation-name", "personalPlanScreenEnterForward")
    await expect(incoming).toHaveCSS("animation-duration", "0.2s")
    await expect(outgoing).toHaveCSS("animation-name", "personalPlanScreenExitForward")
    await expect(outgoing).toHaveCSS("animation-duration", "0.16s")
    await expect(visibleContinueButton(page)).toHaveCount(1)

    const headerDuring = await header.boundingBox()
    expect(headerDuring).not.toBeNull()
    expect(headerDuring!.x).toBe(headerBefore!.x)
    expect(headerDuring!.y).toBe(headerBefore!.y)
  })

  test("hands the completed refinement to product capture and restarts after an edit", async ({
    page,
  }) => {
    await page.goto(labPath)
    await completeRefinement(page)

    const stage3Entry = page.locator("[data-stage3-entry-refined-version-id]")
    await expect(stage3Entry).toBeVisible()
    const firstRefinedVersion = await stage3Entry.getAttribute(
      "data-stage3-entry-refined-version-id",
    )

    await expect(page.getByRole("heading", { name: "Dein Shampoo" })).toBeVisible()
    await expect(stage3Entry.getByText("Gespeichert", { exact: true })).toBeVisible()
    await expect(stage3Entry).toHaveAttribute(
      "data-stage3-entry-refined-version-id",
      firstRefinedVersion!,
    )

    await page.getByRole("button", { name: "Zum Feinschliff" }).click()

    const bridge = page.locator("[data-refined-version-id]")
    await expect(bridge).toBeVisible()
    await page.getByRole("button", { name: "Zur letzten Frage" }).click()
    await page.getByRole("button", { name: "Seidenkissenbezug" }).click()
    await visibleContinueButton(page).click()
    await expect(bridge).toBeVisible()
    const successorVersion = await bridge.getAttribute("data-refined-version-id")
    expect(successorVersion).not.toBe(firstRefinedVersion)

    await page.getByRole("button", { name: /Produkte erfassen/ }).click()
    await expect(page.getByRole("heading", { name: "Dein Shampoo" })).toBeVisible()
    await expect(
      page
        .locator("[data-stage3-entry-refined-version-id]")
        .getByText("Gespeichert", { exact: true }),
    ).toBeVisible()
    await expect(page.locator("[data-stage3-entry-refined-version-id]")).toHaveAttribute(
      "data-stage3-entry-refined-version-id",
      successorVersion!,
    )
  })
})
