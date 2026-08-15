import { expect, test, type Page } from "@playwright/test"

const lab = (scenario: string) => `/labs/personal-plan-stage-2?scenario=${scenario}`

async function openLab(page: Page, scenario: string) {
  await page.goto(lab(scenario))
}

async function begin(page: Page, scenario = "ready") {
  await openLab(page, scenario)
  await page.getByRole("button", { name: /Feinschliff starten/ }).click()
  await expect(page.getByRole("heading", { level: 2 })).toBeFocused()
}

const continueButton = (page: Page) => page.getByRole("button", { name: "Weiter", exact: true })

async function chooseAndContinue(page: Page, name: RegExp | string) {
  await page.getByRole("button", { name, exact: typeof name === "string" }).click()
  await expect(continueButton(page)).toBeEnabled()
  await continueButton(page).click()
}

async function chooseNoneAndContinue(page: Page, label = "Nichts davon") {
  const none = page.getByRole("button", { name: label, exact: true })
  await none.click()
  await expect(none).toHaveAttribute("aria-pressed", "true")
  await expect(continueButton(page)).toBeEnabled()
  await continueButton(page).click()
}

const frequencyLabelLines = [
  ["<1×/", "Monat"],
  ["1×/", "Monat"],
  ["Alle 2", "Wochen"],
  ["1×/", "Woche"],
  ["2×/", "Woche"],
  ["3–4×/", "Woche"],
  ["5–6×/", "Woche"],
  ["1×/", "Tag"],
] as const

async function expectFrequencyLabelsAligned(page: Page) {
  await page.evaluate(async () => {
    await Promise.all(
      document.getAnimations().map((animation) => animation.finished.catch(() => {})),
    )
  })
  const labels = page.locator("[data-slider-stop-label]")
  await expect(labels).toHaveCount(frequencyLabelLines.length)

  for (let index = 0; index < frequencyLabelLines.length; index += 1) {
    const marker = page.locator(`[data-slider-stop-marker][data-slider-stop-index="${index}"]`)
    const label = labels.nth(index)
    const [markerBox, labelBox] = await Promise.all([marker.boundingBox(), label.boundingBox()])
    expect(markerBox).not.toBeNull()
    expect(labelBox).not.toBeNull()
    expect(
      Math.abs(markerBox!.x + markerBox!.width / 2 - (labelBox!.x + labelBox!.width / 2)),
    ).toBeLessThanOrEqual(1)
    expect(labelBox!.x).toBeGreaterThanOrEqual(0)
    const labelRight = labelBox!.x + labelBox!.width
    expect(
      labelRight,
      `frequency label ${index} ends at ${labelRight}px in a ${page.viewportSize()!.width}px viewport`,
    ).toBeLessThanOrEqual(page.viewportSize()!.width)
    await expect(label.locator('[data-slider-label-line="1"]')).toHaveText(
      frequencyLabelLines[index][0],
    )
    await expect(label.locator('[data-slider-label-line="2"]')).toHaveText(
      frequencyLabelLines[index][1],
    )
  }

  const noHorizontalOverflow = await page
    .locator("html")
    .evaluate((element: HTMLElement) => element.scrollWidth <= element.clientWidth)
  expect(noHorizontalOverflow).toBe(true)
}

async function finishNeutral(page: Page, shampooAlreadySelected = false) {
  if (shampooAlreadySelected) await continueButton(page).click()
  else await chooseAndContinue(page, "Shampoo")
  await chooseAndContinue(page, "2×/Woche")
  await chooseAndContinue(page, "Kein Handtuch oder Tuch")
  await chooseNoneAndContinue(page)
  await chooseNoneAndContinue(page)
  await chooseNoneAndContinue(page)
}

test.describe("Stage 2 refinement Labs preview", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem(
        "chaarlie_cookie_consent_v1",
        JSON.stringify({ essential: true, analytics: false, marketing: false, ts: Date.now() }),
      )
    })
  })

  test("ready completes the neutral journey only after saving and exposes an opaque bridge", async ({
    page,
  }) => {
    await begin(page)
    await expect(page.getByRole("heading", { name: "Welche Produkte nutzt du?" })).toBeVisible()
    await expect(continueButton(page)).toBeDisabled()

    const shampoo = page.getByRole("button", { name: "Shampoo", exact: true })
    await shampoo.focus()
    await page.keyboard.press("Enter")
    await expect(shampoo).toHaveAttribute("aria-pressed", "true")
    await expect(continueButton(page)).toBeEnabled()
    await continueButton(page).click()
    await expect(page.getByText("Deine Antwort wird sicher gespeichert.")).toHaveCount(0)
    await expect(
      page.getByRole("heading", { name: "Wie oft wäschst du deine Haare nass?" }),
    ).toBeVisible()

    await page.getByRole("button", { name: "Zurück" }).click()
    await finishNeutral(page, true)

    const bridge = page.locator("[data-refined-version-id]")
    await expect(bridge).toBeVisible()
    await expect(page.locator("[data-stage2-next-href]")).toHaveAttribute(
      "data-stage2-next-href",
      "/plan-start",
    )
    await expect(bridge.locator("a")).toHaveCount(0)
    await expect(bridge).not.toContainText(/Ergebnis|Veränderung|Karte|Delta/i)
    await page.getByRole("button", { name: /Produkte erfassen/ }).click()
    await expect(page).toHaveURL(/scenario=ready/)
  })

  test("keeps every wet-wash label centered on its marker across mobile and desktop widths", async ({
    page,
  }) => {
    await begin(page)
    await chooseAndContinue(page, "Shampoo")

    for (const width of [375, 390, 430, 1280]) {
      await page.setViewportSize({ width, height: width === 1280 ? 900 : 844 })
      await expectFrequencyLabelsAligned(page)
    }

    const slider = page.getByRole("slider", { name: "Häufigkeit der Haarwäsche" })
    await page.getByRole("button", { name: "1×/Woche" }).click()
    await expect(slider).toHaveAttribute("aria-valuetext", "1x/Woche")
    await expect(page.getByText("1x/Woche", { exact: true })).toBeVisible()
    await slider.press("ArrowRight")
    await expect(slider).toHaveAttribute("aria-valuetext", "2x/Woche")
    await slider.press("Home")
    await expect(slider).toHaveAttribute("aria-valuetext", "Seltener als 1x/Monat")
    await slider.press("End")
    await expect(slider).toHaveAttribute("aria-valuetext", "Täglich")
    await page.locator('[data-slider-stop-marker="weekly_1x"]').click()
    await expect(slider).toHaveAttribute("aria-valuetext", "1x/Woche")

    await page.getByRole("button", { name: /Ich wasche meine Haare nicht nass/ }).click()
    await expect(slider).not.toHaveAttribute("aria-valuenow")
  })

  test("conditional journey keeps ordered heat events separate and never renders a result", async ({
    page,
  }) => {
    await begin(page, "conditional")
    await chooseAndContinue(page, "Öl")
    await chooseAndContinue(page, "2×/Woche")
    await page.getByRole("button", { name: "Brennend, schmerzhaft oder entzündet" }).click()
    await expect(page.getByText(/kosmetische Kopfhaut-Empfehlungen pausieren/i)).toBeVisible()
    await continueButton(page).click()
    await chooseAndContinue(page, "Ja, gelegentlich zwischen den Wäschen")
    await chooseAndContinue(page, "Braun")
    await chooseAndContinue(page, "Im trockenen Haar als Finish")
    await page.getByRole("button", { name: "Mikrofaser-Handtuch" }).click()
    await page.getByRole("button", { name: "Sanft ausdrücken / scrunchen" }).click()
    await continueButton(page).click()
    await page.getByRole("button", { name: "Lufttrocknen" }).click()
    await page.getByRole("button", { name: "Diffusor oder formender Luftstrom" }).click()
    await continueButton(page).click()
    await chooseAndContinue(page, "Glätteisen")

    await expect(
      page.getByRole("heading", { name: /Wie oft nutzt du Diffusor oder formenden Luftstrom/ }),
    ).toBeVisible()
    await page.getByRole("button", { name: "2x/Woche" }).click()
    await page.getByRole("button", { name: "Immer" }).click()
    await continueButton(page).click()
    await expect(
      page.getByRole("heading", { name: /Wie oft nutzt du das Glätteisen/ }),
    ).toBeVisible()
    await page.getByRole("button", { name: "2x/Woche" }).click()
    await page.getByRole("button", { name: "Manchmal" }).click()
    await continueButton(page).click()
    await chooseNoneAndContinue(page)
    await expect(page.locator("[data-refined-version-id]")).toBeVisible()
    await expect(page.getByText(/Ergebnis|Veränderungskarte|dein Ergebnis/i)).toHaveCount(0)
  })

  test("save failure retains the local choice and retry advances", async ({ page }) => {
    await begin(page, "save-error")
    const shampoo = page.getByRole("button", { name: "Shampoo", exact: true })
    await shampoo.click()
    await continueButton(page).click()
    await expect(page.getByText("Deine Antwort wird sicher gespeichert.")).toHaveCount(0)
    await expect(page.getByRole("alert").filter({ hasText: /nicht geklappt/i })).toBeVisible()
    await expect(page.getByText("Nicht gespeichert", { exact: true })).toBeVisible()
    await expect(shampoo).toHaveAttribute("aria-pressed", "true")
    await expect(page.getByRole("button", { name: "Erneut versuchen" })).toBeVisible()
    await page.getByRole("button", { name: "Erneut versuchen" }).click()
    await expect(
      page.getByRole("heading", { name: "Wie oft wäschst du deine Haare nass?" }),
    ).toBeVisible()
  })

  test("complete failure preserves the saved revision and retries completion directly", async ({
    page,
  }) => {
    await begin(page, "complete-error")
    await finishNeutral(page)
    await expect(
      page.getByRole("alert").filter({ hasText: /Übergabe hat gerade nicht geklappt/i }),
    ).toBeVisible()
    await expect(page.getByRole("button", { name: "Übergabe erneut versuchen" })).toBeVisible()
    await page.getByRole("button", { name: "Übergabe erneut versuchen" }).click()

    const bridge = page.locator("[data-refined-version-id]")
    await expect(bridge).toBeVisible()
    await expect(bridge).toHaveAttribute(
      "data-refined-version-id",
      /fixture-refined-stage2-fixture-v1-r6/,
    )
  })

  test("revision conflict reloads canonical progress instead of retaining stale local selection", async ({
    page,
  }) => {
    await begin(page, "conflict")
    await page.getByRole("button", { name: "Shampoo", exact: true }).click()
    await continueButton(page).click()
    await expect(page.getByText("Deine Antwort wird sicher gespeichert.")).toHaveCount(0)
    await expect(
      page.getByRole("alert").filter({ hasText: /neuere gespeicherte Antworten/i }),
    ).toBeVisible()
    await expect(page.getByRole("heading", { name: "Welche Produkte nutzt du?" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Shampoo", exact: true })).toHaveAttribute(
      "aria-pressed",
      "false",
    )
    await chooseAndContinue(page, "Shampoo")
    await expect(
      page.getByRole("heading", { name: "Wie oft wäschst du deine Haare nass?" }),
    ).toBeVisible()
  })

  test("resume and completed fixtures preserve their canonical entry points", async ({ page }) => {
    await openLab(page, "resume")
    await expect(page.getByText("Du machst bei der ersten offenen Frage weiter.")).toBeVisible()
    await expect(page.getByText("Aktuelle Produktarten")).toHaveCount(0)
    await page.getByRole("button", { name: /offenen Frage fortfahren/ }).click()
    await expect(
      page.getByRole("heading", { name: "Was schützt dein Haar nachts meistens?" }),
    ).toBeVisible()

    await openLab(page, "complete")
    await expect(page.locator("[data-refined-version-id]")).toBeVisible()
    await page.getByRole("button", { name: "Zur letzten Frage" }).click()
    await expect(
      page.getByRole("heading", { name: "Was schützt dein Haar nachts meistens?" }),
    ).toBeVisible()
    const none = page.getByRole("button", { name: "Nichts davon", exact: true })
    await expect(none).toHaveAttribute("aria-pressed", "true")
    await continueButton(page).click()
    await expect(
      page.getByRole("alert").filter({ hasText: /neuere gespeicherte Antworten/i }),
    ).toHaveCount(0)
    await expect(page.locator("[data-refined-version-id]")).toBeVisible()
  })

  test("mobile dock portals cleanly without horizontal overflow; tablet and desktop do not", async ({
    page,
  }) => {
    for (const width of [375, 768, 1280]) {
      await page.setViewportSize({ width, height: 812 })
      await begin(page)
      const dock = page.locator("[data-stage2-mobile-dock=portal]")
      if (width === 375) {
        await expect(dock).toHaveCount(1)
        expect(await dock.evaluate((element) => element.parentElement === document.body)).toBe(true)
        expect(
          await dock.evaluate((element) => {
            const rect = element.getBoundingClientRect()
            return rect.bottom >= window.innerHeight - 2 && rect.top < window.innerHeight
          }),
        ).toBe(true)
        const lastChoice = page.getByRole("button", { name: /Keine weiteren; ersetzt die Auswahl/ })
        await lastChoice.scrollIntoViewIfNeeded()
        expect(
          await lastChoice.evaluate(
            (element, dockSelector) =>
              element.getBoundingClientRect().bottom <=
              document.querySelector(dockSelector)!.getBoundingClientRect().top,
            "[data-stage2-mobile-dock=portal]",
          ),
        ).toBe(true)
        expect(
          await page
            .locator("body")
            .evaluate(
              (body) =>
                document.documentElement.scrollWidth <= window.innerWidth &&
                body.scrollWidth <= window.innerWidth,
            ),
        ).toBe(true)
      } else {
        await expect(dock).toHaveCount(0)
        if (width === 1280) {
          await expect(
            page.getByRole("heading", { name: "Welche Produkte nutzt du?" }),
          ).toBeInViewport()
        }
        expect(
          await page
            .locator("body")
            .evaluate(
              (body) =>
                document.documentElement.scrollWidth <= window.innerWidth &&
                body.scrollWidth <= window.innerWidth,
            ),
        ).toBe(true)
      }
    }
  })

  test("mobile dock offsets the cookie banner without prior consent and keeps Continue clickable", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.addInitScript(() => {
      window.localStorage.removeItem("chaarlie_cookie_consent_v1")
    })
    await begin(page)

    const dock = page.locator("[data-stage2-mobile-dock=portal]")
    const banner = page.getByRole("dialog", { name: "Cookie-Einstellungen" })
    await expect(dock).toBeVisible()
    await expect(banner).toBeVisible({ timeout: 2_500 })

    const geometry = await page.evaluate(() => {
      const dock = document.querySelector<HTMLElement>("[data-stage2-mobile-dock=portal]")
      const banner = document.querySelector<HTMLElement>(
        '[role="dialog"][aria-label="Cookie-Einstellungen"]',
      )
      const dockRect = dock?.getBoundingClientRect()
      const bannerRect = banner?.getBoundingClientRect()
      return {
        banner: bannerRect && {
          bottom: bannerRect.bottom,
          top: bannerRect.top,
        },
        dock: dockRect && {
          height: dockRect.height,
          top: dockRect.top,
        },
        offset: getComputedStyle(document.documentElement)
          .getPropertyValue("--landing-sticky-cta-offset")
          .trim(),
      }
    })
    expect(geometry.dock).not.toBeNull()
    expect(geometry.banner).not.toBeNull()
    expect(Number.parseInt(geometry.offset, 10)).toBeGreaterThanOrEqual(
      Math.floor(geometry.dock!.height),
    )
    expect(geometry.banner!.bottom).toBeLessThanOrEqual(geometry.dock!.top - 4)

    await page.getByRole("button", { name: "Shampoo", exact: true }).click()
    await continueButton(page).click()
    await expect(
      page.getByRole("heading", { name: "Wie oft wäschst du deine Haare nass?" }),
    ).toBeVisible()
    await expect(dock).toHaveCount(1)
    await expect(dock).toBeVisible()
    await expect(banner).toBeVisible()
    await expect
      .poll(() =>
        page.evaluate(() => {
          const currentDock = document.querySelector<HTMLElement>(
            "[data-stage2-mobile-dock=portal]",
          )
          const currentBanner = document.querySelector<HTMLElement>(
            '[role="dialog"][aria-label="Cookie-Einstellungen"]',
          )
          if (!currentDock || !currentBanner) return false
          return (
            currentBanner.getBoundingClientRect().bottom <=
            currentDock.getBoundingClientRect().top - 4
          )
        }),
      )
      .toBe(true)
  })

  test("unknown preview scenarios return 404", async ({ page }) => {
    await openLab(page, "not-a-scenario")
    await expect(page.getByText("404")).toBeVisible()
  })
})
