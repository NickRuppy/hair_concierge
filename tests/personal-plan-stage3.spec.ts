import { expect, test, type Page } from "@playwright/test"

const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3217"
const labPath = "/labs/personal-plan/stage-3"

async function openStage3Lab(page: Page) {
  await page.goto(`${baseUrl}${labPath}`)
  await expect(page.getByRole("heading", { name: "Dein Conditioner" })).toBeVisible()
  const cookieDialog = page.getByRole("dialog", { name: "Cookie-Einstellungen" })
  await cookieDialog.waitFor({ state: "visible", timeout: 2_000 }).catch(() => undefined)
  if (await cookieDialog.isVisible()) {
    await cookieDialog.getByRole("button", { name: "Nur essentielle" }).click()
  }
}

async function searchAndSelect(page: Page, query: string, productName: string) {
  const search = page.getByRole("searchbox", { name: "Produkt suchen" })
  await search.fill(query)
  const option = page.getByRole("option", { name: `${productName} auswählen`, exact: true })
  await expect(option).toBeVisible()
  await option.click()
  await page.getByRole("button", { name: /2x\/Woche/ }).click()
}

test.describe("Personal Plan products lab", () => {
  test.use({ viewport: { width: 375, height: 844 }, hasTouch: true })

  test("keeps the mobile-first product journey customer-facing while reaching the routine handoff", async ({
    page,
  }) => {
    await openStage3Lab(page)
    await expect(page.locator("body")).not.toContainText(/\b(?:Pass\s*[12]|Stage\s*3|Part)\b/i)

    await searchAndSelect(page, "Balance", "Conditioner Balance")
    await page.getByRole("button", { name: /Weiteres Conditioner hinzufügen/ }).click()
    await searchAndSelect(page, "Soft Care", "Conditioner Soft Care")
    await page.getByRole("button", { name: "Weiter", exact: true }).click()
    await expect(
      page.getByRole("heading", { name: /Welche Aufgabe hat dein Conditioner/ }),
    ).toBeVisible()
    await page
      .getByRole("checkbox", { name: /Conditioner Balance: Pflege nach der Wäsche/ })
      .check()
    await page
      .getByRole("checkbox", { name: /Conditioner Soft Care: Pflege nach der Wäsche/ })
      .check()
    await page.getByRole("button", { name: "Auswahl übernehmen" }).click()

    await expect(page.getByRole("heading", { name: /Dein Öl/ })).toBeVisible()
    await searchAndSelect(page, "Length Seal", "Oil Length Seal")
    await page.getByRole("button", { name: "Weiter", exact: true }).click()
    await expect(page.getByRole("heading", { name: "Wofür nutzt du dein Öl?" })).toBeVisible()
    await page.getByRole("checkbox", { name: /Oil Length Seal: Vor der Haarwäsche/ }).check()
    await page.getByRole("checkbox", { name: /Oil Length Seal: Im feuchten Haar/ }).check()
    await page.getByRole("checkbox", { name: /Oil Length Seal: Im trockenen Haar/ }).check()
    await page.getByRole("button", { name: "Auswahl übernehmen" }).click()

    await expect(page.getByRole("heading", { name: /Dein Kopfhautprodukt/ })).toBeVisible()
    await page.getByRole("searchbox", { name: "Produkt suchen" }).fill("unbekanntes tonic")
    await expect(page.getByRole("status")).toContainText(/Wir haben dein Produkt nicht gefunden/i)
    await page.getByRole("button", { name: "Nicht dabei? Produkt hinzufügen" }).click()
    await page.getByLabel("Produktname").fill("Kopfhaut-Tonic")
    await page.getByRole("button", { name: "1x/Woche" }).click()
    await page.getByRole("button", { name: "Produkt speichern" }).click()
    await expect(page.getByText(/Noch in Prüfung · gespeichert/i)).toBeVisible()
    await page.getByRole("button", { name: "Weiter", exact: true }).click()

    await expect(page.getByRole("heading", { name: /Dein Hitzeschutz/ })).toBeVisible()
    await page.getByRole("button", { name: "Ich habe dafür kein Produkt" }).click()

    await expect(page.getByRole("heading", { name: "Produkte prüfen" })).toBeVisible()
    await page.getByRole("button", { name: /Conditioner Balance weiterverwenden/ }).click()
    await expect(page.getByText("Passt nicht zu deinem Bedarf", { exact: true })).toBeVisible()
    await page.getByRole("button", { name: /einplanen/ }).click()
    await expect(page.getByText("Noch in Prüfung", { exact: true })).toBeVisible()
    await page.getByRole("button", { name: /Prüfung später fortsetzen/ }).click()
    await expect(page.getByText("Noch nicht beurteilbar", { exact: true })).toBeVisible()
    await page.getByRole("button", { name: /Lücke im Plan markieren/ }).click()

    await page.waitForURL((url) => url.pathname !== labPath)
    await expect(page).not.toHaveURL(new RegExp(`${labPath}$`))
  })

  test("contains the Stage 3 surface on desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await openStage3Lab(page)

    const shell = page.getByRole("main")
    await expect(shell).toBeVisible()
    const box = await shell.boundingBox()
    expect(box?.width).toBeLessThanOrEqual(720)
  })
})
