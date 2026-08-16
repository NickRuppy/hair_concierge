import { expect, test } from "@playwright/test"

test.skip(
  process.env.CI_PERSONAL_PLAN_STAGE3_LAB_ENABLED !== "true",
  "The deterministic Routine editor lab is explicitly gated.",
)

test("dirty Routine Back opens an immediately visible discard sheet at 320px", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 })
  await page.goto("/labs/personal-plan-routine-editor")

  const journeyHeader = page.locator('[data-personal-plan-journey-header="true"]')
  await expect
    .poll(() => journeyHeader.evaluate((header) => getComputedStyle(header).top))
    .toBe("56px")

  await page.getByLabel("Kategorie einplanen").uncheck()
  await page.getByRole("button", { name: "Zur Routine" }).click()

  const dialog = page.getByRole("dialog")
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole("heading", { name: "Änderungen verwerfen?" })).toBeVisible()
  await expect
    .poll(async () => {
      const bounds = await dialog.boundingBox()
      return Boolean(
        bounds &&
        bounds.x >= 0 &&
        bounds.x + bounds.width <= 320 &&
        bounds.y >= 0 &&
        bounds.y + bounds.height <= 700,
      )
    })
    .toBe(true)

  await dialog.getByRole("button", { name: "Weiter bearbeiten" }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByRole("button", { name: "Zur Routine" })).toBeFocused()
})
