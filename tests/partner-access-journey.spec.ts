import { expect, test } from "@playwright/test"

test("creator invitation stays personal and lets the recipient correct the email", async ({
  page,
}) => {
  await page.goto("/labs/partner-access", { waitUntil: "domcontentloaded" })

  await expect(page.getByRole("heading", { name: "Hi Lea, dein Zugang ist bereit." })).toBeVisible()
  await expect(page.getByText("lea@studio-example.de", { exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: "Los geht’s" })).toBeVisible()
  await expect(
    page.getByText("Damit erstellst du dein Chaarlie Konto mit dieser E-Mail.", { exact: true }),
  ).toBeVisible()

  await page.getByRole("button", { name: "Nicht deine E-Mail? Ändern" }).click()
  await expect(page.getByRole("heading", { name: "E-Mail ändern" })).toBeVisible()
  await expect(
    page.getByText("Wir senden dir einen Bestätigungslink.", { exact: true }),
  ).toBeVisible()
  await expect(page.getByLabel("E-Mail", { exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: "Bestätigungslink senden" })).toBeVisible()

  await page.getByRole("button", { name: "Abbrechen" }).click()
  await expect(page.getByRole("button", { name: "Los geht’s" })).toBeVisible()
})

test("creator invite and activation card fit a narrow phone viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })

  await page.goto("/labs/partner-access", { waitUntil: "domcontentloaded" })
  await expect(page.getByRole("button", { name: "Los geht’s" })).toBeVisible()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true)

  await page.goto("/labs/offer-page?scenario=partner", { waitUntil: "domcontentloaded" })
  await expect(
    page.getByRole("heading", { name: "Dein Chaarlie Zugang ist bereit." }),
  ).toBeVisible()
  await expect(page.getByRole("button", { name: "Zugang aktivieren" })).toBeVisible()
  await expect(page.getByText("Für dich kostenlos", { exact: true })).toBeVisible()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true)
})
