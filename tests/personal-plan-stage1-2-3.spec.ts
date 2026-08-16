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
