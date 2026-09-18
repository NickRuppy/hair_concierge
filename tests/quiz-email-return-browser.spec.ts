import { expect, test } from "@playwright/test"

test("recognized return stays on the ordinary quiz and Edit resumes prefilled answers", async ({
  page,
}, testInfo) => {
  await page.route("**/api/quiz/email-return/context", async (route) => {
    await route.fulfill({ contentType: "application/json", body: '{"status":"resolved"}' })
  })
  await page.route("**/api/quiz/email-return/choose", async (route) => {
    expect(route.request().method()).toBe("POST")
    expect(route.request().postDataJSON()).toEqual({ choice: "edit" })
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        status: "edit",
        answers: { structure: "wavy", thickness: "normal", hair_length: "medium" },
      }),
    })
  })

  await page.goto("/quiz?return=ready")
  const dialog = page.getByRole("dialog", { name: "Du hast das Quiz schon gemacht." })
  await expect(dialog).toBeVisible()
  // The question remains visibly behind the modal, but is intentionally inert
  // and therefore absent from the accessibility tree until a choice is made.
  await expect(page.locator("h1")).toContainText(
    "Welche Haarstruktur haben die meisten deiner Haare?",
  )
  await expect(dialog.getByRole("button", { name: "Mit meinen Antworten weiter" })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath("return-dialog-desktop.png") })
  await dialog.getByRole("button", { name: "Antworten bearbeiten" }).click()

  await expect(page).toHaveURL(/\/quiz$/)
  await expect(dialog).toHaveCount(0)
  const draft = await page.evaluate(() =>
    JSON.parse(window.localStorage.getItem("chaarlie:quiz-draft:v1") ?? "null"),
  )
  expect(draft).toMatchObject({
    step: 2,
    answers: { structure: "wavy", thickness: "normal", hair_length: "medium" },
    funnelPackageKey: "customerio_scan_return_v1",
  })
})

test("the return prompt fits a small phone without hiding either decision", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.route("**/api/quiz/email-return/context", async (route) => {
    await route.fulfill({ contentType: "application/json", body: '{"status":"resolved"}' })
  })
  await page.goto("/quiz?return=ready")
  const dialog = page.getByRole("dialog", { name: "Du hast das Quiz schon gemacht." })
  await expect(dialog).toBeVisible()
  const bounds = await dialog.boundingBox()
  expect(bounds).not.toBeNull()
  expect(bounds!.x).toBeGreaterThanOrEqual(0)
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390)
  await expect(dialog.getByRole("button", { name: "Mit meinen Antworten weiter" })).toBeInViewport()
  await expect(dialog.getByRole("button", { name: "Antworten bearbeiten" })).toBeInViewport()
  await page.screenshot({ path: testInfo.outputPath("return-dialog-mobile.png") })
})

test("a link revoked while the prompt is open releases the ordinary quiz", async ({ page }) => {
  await page.route("**/api/quiz/email-return/context", async (route) => {
    await route.fulfill({ contentType: "application/json", body: '{"status":"resolved"}' })
  })
  await page.route("**/api/quiz/email-return/choose", async (route) => {
    await route.fulfill({
      status: 410,
      contentType: "application/json",
      body: '{"status":"invalid"}',
    })
  })
  await page.goto("/quiz?return=ready")
  const dialog = page.getByRole("dialog", { name: "Du hast das Quiz schon gemacht." })
  await expect(dialog).toBeVisible()
  await dialog.getByRole("button", { name: "Mit meinen Antworten weiter" }).click()
  await expect(dialog).toHaveCount(0)
  await expect(
    page.getByRole("heading", { name: "Welche Haarstruktur haben die meisten deiner Haare?" }),
  ).toBeVisible()
  await expect(page.getByRole("status")).toContainText(
    "Deine gespeicherten Antworten konnten über diesen Link nicht geöffnet werden.",
  )
  await expect(page).toHaveURL(/\/quiz\?return=invalid$/)
})
