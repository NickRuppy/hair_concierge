import { expect, test } from "@playwright/test"

test("Stage 3 announces its heading without Safari's outline on static text", async ({ page }) => {
  await page.goto("/labs/personal-plan/stage-3")
  const heading = page.getByRole("heading", { name: "Dein Conditioner" })
  await expect(heading).toBeVisible()
  await expect
    .poll(() => heading.evaluate((element) => document.activeElement === element))
    .toBe(true)
  await expect
    .poll(() => heading.evaluate((element) => getComputedStyle(element).outlineStyle))
    .toBe("none")
})
