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

async function openUncoveredConditionerLab(page: Page) {
  await page.goto(`${baseUrl}${labPath}?scenario=uncovered-conditioner`)
  await expect(page.getByRole("heading", { name: "Wähle deinen Conditioner" })).toBeVisible()
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

async function expectUncoveredChooserToFitViewport(page: Page) {
  const viewport = page.viewportSize()
  expect(viewport).not.toBeNull()
  const noHorizontalOverflow = await page
    .locator("html")
    .evaluate((element: HTMLElement) => element.scrollWidth <= element.clientWidth)
  expect(noHorizontalOverflow).toBe(true)

  const cta = page.getByRole("button", { name: "Dieses Produkt einplanen" })
  const box = await cta.boundingBox()
  expect(box).not.toBeNull()
  expect(box!.x).toBeGreaterThanOrEqual(0)
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width)
}

test.describe("Personal Plan products lab", () => {
  test.use({ viewport: { width: 375, height: 844 }, hasTouch: true })

  test("keeps the mobile-first product journey customer-facing while reaching the routine handoff", async ({
    page,
  }) => {
    await openStage3Lab(page)
    await expect(page.locator("body")).not.toContainText(/\b(?:Pass\s*[12]|Stage\s*3|Part)\b/i)

    await searchAndSelect(page, "Balance", "Chaarlie Fixture Conditioner Balance")
    await page.getByRole("button", { name: /Weiteres Conditioner hinzufügen/ }).click()
    await searchAndSelect(page, "Soft Care", "Chaarlie Fixture Conditioner Soft Care")
    await page.getByRole("button", { name: "Weiter", exact: true }).click()
    await expect(page.getByRole("heading", { name: /Dein Öl/ })).toBeVisible()
    await searchAndSelect(page, "Length Seal", "Chaarlie Fixture Oil Length Seal")
    await page.getByRole("button", { name: "Weiter", exact: true }).click()
    await expect(page.getByRole("heading", { name: "Wofür nutzt du dein Öl?" })).toBeVisible()
    await page.getByRole("checkbox", { name: /Oil Length Seal: Vor der Haarwäsche/ }).check()
    await page.getByRole("checkbox", { name: /Oil Length Seal: Im feuchten Haar/ }).check()
    await page.getByRole("checkbox", { name: /Oil Length Seal: Im trockenen Haar/ }).check()
    await page.getByRole("button", { name: "Auswahl übernehmen" }).click()

    await expect(page.getByRole("heading", { name: /Dein Kopfhautprodukt/ })).toBeVisible()
    await page.getByRole("searchbox", { name: "Produkt suchen" }).fill("unbekanntes tonic")
    // Pinnt auch die Typografie: deutsche Anfuehrungszeichen „…“, kein
    // gemischtes ‚…' aus einer frueheren Kopie des Satzes.
    await expect(page.getByRole("status")).toContainText(
      "Wir haben dein Produkt nicht gefunden. Füge es über „Produkt hinzufügen“ einfach selbst hinzu.",
    )
    await page.getByRole("button", { name: "Nicht dabei? Produkt hinzufügen" }).click()
    await page.getByLabel("Produktname").fill("Kopfhaut-Tonic")
    await page.getByRole("button", { name: "1x/Woche" }).click()
    await page.getByRole("button", { name: "Produkt speichern" }).click()
    await expect(page.getByText("Analyse läuft", { exact: true })).toBeVisible()
    await page.getByRole("button", { name: "Weiter", exact: true }).click()

    await expect(page.getByRole("heading", { name: /Dein Hitzeschutz/ })).toBeVisible()
    await page.getByRole("searchbox", { name: "Produkt suchen" }).fill("unbekannter hitzeschutz")
    await expect(page.getByRole("status")).toContainText(/Wir haben dein Produkt nicht gefunden/i)
    await page.getByRole("button", { name: "Nicht dabei? Produkt hinzufügen" }).click()
    await page.getByLabel("Produktname").fill("Hitzeschutz Spray")
    await page.getByRole("button", { name: "1x/Woche" }).click()
    await page.getByRole("button", { name: "Produkt speichern" }).click()
    await expect(page.getByText("Analyse läuft", { exact: true })).toBeVisible()
    await page.getByRole("button", { name: "Weiter", exact: true }).click()

    await expect(page.getByRole("heading", { name: /im Vergleich/ })).toBeVisible()
    await expect(page.getByText("Alternative 1 von 3", { exact: true })).toBeVisible()
    await expect(page.getByRole("columnheader", { name: "Deins" })).toBeVisible()
    await expect(page.getByRole("columnheader", { name: "Ziel" })).toBeVisible()
    await expect(page.getByText(/Ausgewählter Prüfpunkt/)).toBeVisible()
    await page.getByRole("button", { name: "Nächste Alternative" }).click()
    await expect(page.getByText("Alternative 2 von 3", { exact: true })).toBeVisible()
    // Candidate navigation is presentation-only. The explicit primary action
    // remains the sole persistence boundary.
    await page.getByRole("button", { name: "Mein Produkt behalten" }).click()
    await expect(page.getByRole("heading", { name: /im Vergleich/ })).toBeVisible()
    await expect(page.getByText("Conditioner Soft Care", { exact: true })).toBeVisible()
    await page.getByRole("button", { name: "Diese Alternative wählen" }).click()
    await expect(page.getByText("Oil Length Seal", { exact: true })).toBeVisible()
    await page.getByRole("button", { name: "Mein Produkt behalten" }).click()
    await page.getByRole("button", { name: "Mein Produkt behalten" }).click()
    await page.getByRole("button", { name: "Mein Produkt behalten" }).click()
    await expect(page.getByText("Kopfhaut-Tonic", { exact: true })).toBeVisible()
    await page.getByRole("button", { name: /Auf Analyse warten/ }).click()
    const noHorizontalOverflow = await page
      .locator("html")
      .evaluate((element: HTMLElement) => element.scrollWidth <= element.clientWidth)
    expect(noHorizontalOverflow).toBe(true)
    await expect(page.getByText("Hitzeschutz Spray", { exact: true })).toBeVisible()
    await page.getByRole("button", { name: /Auf Analyse warten/ }).click()

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
    const hasNoHorizontalOverflow = await page
      .locator("html")
      .evaluate((element) => element.scrollWidth <= element.clientWidth)
    expect(hasNoHorizontalOverflow).toBe(true)
  })

  test("offers a missing Conditioner directly and plans the third verified product", async ({
    page,
  }) => {
    await openUncoveredConditionerLab(page)

    const choiceCards = page
      .getByRole("region", { name: "Wähle deinen Conditioner" })
      .locator("article")
    await expect(choiceCards.nth(0).getByText("Beste Passung", { exact: true })).toBeVisible()
    await expect(choiceCards.nth(1).getByText("Alternative 1", { exact: true })).toBeVisible()
    await expect(page.getByText("Produkt suchen", { exact: true })).not.toBeVisible()
    await expect(page.getByText("Alternative 1 von 2", { exact: true })).toBeVisible()

    await expectUncoveredChooserToFitViewport(page)
    await page.setViewportSize({ width: 400, height: 844 })
    await expectUncoveredChooserToFitViewport(page)
    await page.setViewportSize({ width: 1440, height: 900 })
    await expectUncoveredChooserToFitViewport(page)
    await page.setViewportSize({ width: 375, height: 844 })

    await page.getByRole("button", { name: "Nächste Alternative" }).click()
    await expect(page.getByText("Alternative 2 von 2", { exact: true })).toBeVisible()
    await page
      .getByRole("button", { name: "Conditioner Leichte Pflege als Auswahl markieren" })
      .click()
    await page.getByRole("button", { name: "Dieses Produkt einplanen" }).click()

    await page.waitForURL(
      (url) => url.pathname === "/auth" && url.searchParams.get("next") === "/routine",
    )
  })
})
