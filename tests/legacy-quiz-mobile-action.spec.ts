import { expect, test, type Page } from "@playwright/test"

const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000"

const completeAnswers = {
  structure: "wavy",
  thickness: "fine",
  density: "medium",
  hair_length: "medium",
  fingertest: "leicht_uneben",
  pulltest: "stretches_bounces",
  treatment: ["natur"],
  scalp_type: "ausgeglichen",
  has_scalp_issue: false,
  concerns: [],
}

async function openFreshQuiz(page: Page, viewport: { width: number; height: number }) {
  await page.setViewportSize(viewport)
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "chaarlie_cookie_consent_v1",
      JSON.stringify({ essential: true, analytics: false, marketing: false, ts: Date.now() }),
    )
    window.localStorage.removeItem("chaarlie:quiz-draft:v1")
  })
  await page.goto(`${baseUrl}/quiz`, { waitUntil: "networkidle" })
}

async function openDraft(
  page: Page,
  step: number,
  viewport: { width: number; height: number },
  answerOverrides: Record<string, unknown> = {},
) {
  const answers = {
    ...completeAnswers,
    ...(step === 7 ? { treatment: [] } : {}),
    ...answerOverrides,
  }
  await page.setViewportSize(viewport)
  await page.addInitScript(
    ({ answers, draftStep }) => {
      window.localStorage.setItem(
        "chaarlie_cookie_consent_v1",
        JSON.stringify({ essential: true, analytics: false, marketing: false, ts: Date.now() }),
      )
      window.localStorage.setItem(
        "chaarlie:quiz-draft:v1",
        JSON.stringify({ version: 1, savedAt: Date.now(), step: draftStep, answers }),
      )
    },
    { answers, draftStep: step },
  )
  await page.goto(`${baseUrl}/quiz`, { waitUntil: "networkidle" })
}

async function visibleActionGeometry(page: Page) {
  return page.evaluate(() => {
    const visibleButtons = Array.from(document.querySelectorAll("button")).filter(
      (candidate) =>
        candidate.textContent?.trim().endsWith("Weiter") &&
        !candidate.closest('[aria-hidden="true"]') &&
        candidate.getClientRects().length > 0,
    )
    const button = visibleButtons[0]
    if (!button) throw new Error("Visible Weiter action not found")

    const action = button.closest<HTMLElement>('[data-quiz-bottom-action="viewport"]')
    if (!action || getComputedStyle(action).position !== "fixed") {
      throw new Error("Fixed viewport action container not found")
    }

    return {
      actionBottom: action.getBoundingClientRect().bottom,
      actionTop: action.getBoundingClientRect().top,
      buttonBottom: button.getBoundingClientRect().bottom,
      fixedBottom: getComputedStyle(action).bottom,
      insideTransitionRoot: action.closest("[data-personal-plan-transition-root]") !== null,
      layoutBottom: window.innerHeight,
      paddingBottom: Number.parseFloat(getComputedStyle(action).paddingBottom),
      rootScrollPaddingBottom: getComputedStyle(document.documentElement).scrollPaddingBottom,
      visualBottom:
        (window.visualViewport?.offsetTop ?? 0) +
        (window.visualViewport?.height ?? window.innerHeight),
      visibleActions: visibleButtons.length,
    }
  })
}

test.describe("@ci regular quiz mobile parity", () => {
  test.use({ hasTouch: true, isMobile: true })

  test("fits all four texture choices in the fresh 390x844 first frame", async ({ page }) => {
    await openFreshQuiz(page, { width: 390, height: 844 })

    await expect(page.getByRole("note")).toContainText(
      "Lass uns deine Haare verstehen — Schritt für Schritt.",
    )
    await expect(
      page.getByText(
        "Wenn deine Längen chemisch geglättet oder dauergewellt sind, hilft der unbehandelte Ansatz als Orientierung.",
        { exact: false },
      ),
    ).toBeVisible()

    const optionNames = ["Glatt", "Wellig", "Lockig", "Kraus"]
    for (const name of optionNames) {
      await expect(page.getByRole("button", { name, exact: true })).toBeVisible()
    }

    const geometry = await page.evaluate((names) => {
      const visualBottom =
        (window.visualViewport?.offsetTop ?? 0) +
        (window.visualViewport?.height ?? window.innerHeight)
      return names.map((name) => {
        const label = Array.from(document.querySelectorAll<HTMLElement>("span")).find(
          (candidate) => candidate.textContent?.trim() === name,
        )
        const button = label?.closest("button")
        if (!button) throw new Error(`Option not found: ${name}`)
        const rect = button.getBoundingClientRect()
        return { bottom: rect.bottom, height: rect.height, visualBottom }
      })
    }, optionNames)

    for (const option of geometry) {
      expect(option.height).toBeLessThanOrEqual(185)
      expect(option.bottom).toBeLessThanOrEqual(option.visualBottom + 1)
    }
  })

  test("keeps thickness descriptions visible on mobile", async ({ page }) => {
    await openDraft(page, 3, { width: 390, height: 844 })

    await expect(page.getByText("Kaum spürbar – dünner als ein Nähfaden")).toBeVisible()
    await expect(page.getByText("Spürbar – ähnlich wie ein Nähfaden")).toBeVisible()
    await expect(page.getByText("Deutlich spürbar – dicker als ein Nähfaden")).toBeVisible()
  })

  test("uses the newer quiz's short-height grid density at 375x667", async ({ page }) => {
    await openFreshQuiz(page, { width: 375, height: 667 })

    const geometry = await page
      .getByRole("button", { name: "Glatt", exact: true })
      .evaluate((button) => {
        const imageFrame = button.querySelector("img")?.parentElement
        if (!imageFrame) throw new Error("Texture image frame not found")
        return {
          buttonHeight: button.getBoundingClientRect().height,
          imageHeight: imageFrame.getBoundingClientRect().height,
        }
      })
    expect(geometry.buttonHeight).toBeLessThanOrEqual(153)
    expect(geometry.imageHeight).toBeLessThanOrEqual(113)
  })

  for (const viewport of [
    { name: "375x667", width: 375, height: 667 },
    { name: "390x844", width: 390, height: 844 },
  ]) {
    test(`pins the treatment action and clears final content at ${viewport.name}`, async ({
      page,
    }) => {
      await openDraft(page, 7, viewport)
      await expect(
        page.getByRole("heading", { name: "Sind deine Haare chemisch behandelt?" }),
      ).toBeVisible()

      const viewportAction = page.locator('[data-quiz-bottom-action="viewport"]')
      const nextButton = viewportAction.locator("button")
      await expect(nextButton).toBeVisible()
      await expect(nextButton).toBeDisabled()

      const geometry = await visibleActionGeometry(page)
      expect(geometry.insideTransitionRoot).toBe(false)
      expect(geometry.fixedBottom).toBe("0px")
      expect(geometry.actionBottom).toBeGreaterThanOrEqual(geometry.visualBottom)
      expect(geometry.actionBottom - geometry.visualBottom).toBeLessThanOrEqual(24)
      expect(geometry.paddingBottom).toBeGreaterThanOrEqual(12)
      expect(geometry.rootScrollPaddingBottom).not.toBe("auto")
      expect(geometry.buttonBottom).toBeLessThanOrEqual(geometry.visualBottom + 8)
      expect(geometry.visibleActions).toBe(1)

      await page.getByRole("button", { name: "Naturhaar", exact: true }).click()
      await expect(nextButton).toBeEnabled()
      await expect(nextButton).toContainText("1 ausgewählt · Weiter")
      await page.locator("[data-quiz-bottom-clearance]").scrollIntoViewIfNeeded()

      const clearance = await page.evaluate(() => {
        const action = document.querySelector<HTMLElement>('[data-quiz-bottom-action="viewport"]')
        const spacer = document.querySelector<HTMLElement>("[data-quiz-bottom-clearance]")
        if (!spacer || !action) throw new Error("Clearance geometry not found")
        return {
          actionHeight: action.getBoundingClientRect().height,
          clearanceHeight: spacer.getBoundingClientRect().height,
        }
      })
      expect(clearance.clearanceHeight).toBeGreaterThanOrEqual(clearance.actionHeight)
    })
  }

  test("renders the aligned scalp question and answer scale", async ({ page }) => {
    await openDraft(page, 7, { width: 390, height: 844 })
    await page.getByRole("button", { name: "Naturhaar", exact: true }).click()
    await page.locator('[data-quiz-bottom-action="viewport"]').locator("button").click()

    await expect(
      page.getByRole("heading", { name: "Wie fühlt sich deine Kopfhaut normalerweise an?" }),
    ).toBeVisible()
    await expect(
      page.getByText(
        "Denk dabei an deine Kopfhaut und Ansätze – nicht an trockene Längen oder Spitzen.",
      ),
    ).toBeVisible()
    await expect(page.getByRole("button", { name: "Eher fettig", exact: true })).toBeVisible()
    await expect(page.getByRole("button", { name: "Ausgeglichen", exact: true })).toBeVisible()
    await expect(page.getByRole("button", { name: "Eher trocken", exact: true })).toBeVisible()
  })

  test("keeps exactly one fixed action while concerns transition to goals", async ({ page }) => {
    await openDraft(page, 8, { width: 390, height: 844 })
    await page.getByRole("button", { name: "Trockene oder strohige Längen", exact: true }).click()

    const action = page.locator('[data-quiz-bottom-action="viewport"]').locator("button")
    await expect(action).toBeEnabled()
    await action.click()

    await expect(page.locator('[data-personal-plan-transition-layer="outgoing"]')).toBeVisible()
    const geometry = await visibleActionGeometry(page)
    expect(geometry.insideTransitionRoot).toBe(false)
    expect(geometry.fixedBottom).toBe("0px")
    expect(geometry.actionBottom).toBeGreaterThanOrEqual(geometry.visualBottom)
    expect(geometry.actionBottom - geometry.visualBottom).toBeLessThanOrEqual(24)
    expect(geometry.paddingBottom).toBeGreaterThanOrEqual(12)
    expect(geometry.buttonBottom).toBeLessThanOrEqual(geometry.visualBottom + 8)
    expect(geometry.visibleActions).toBe(1)
    await expect(
      page.getByRole("heading", { name: "Was wünschst du dir für deine Wellen?" }),
    ).toBeVisible()
  })

  test("uses plain German Locken wording for coily goals", async ({ page }) => {
    await openDraft(page, 8, { width: 390, height: 844 }, { structure: "coily" })
    await page.getByRole("button", { name: "Trockene oder strohige Längen", exact: true }).click()
    await page.locator('[data-quiz-bottom-action="viewport"]').locator("button").click()

    await expect(
      page.getByRole("heading", { name: "Was wünschst du dir für deine Locken?" }),
    ).toBeVisible()
  })

  test("keeps the concerns note usable without changing the fixed footer height", async ({
    page,
  }) => {
    await openDraft(page, 8, { width: 375, height: 667 })
    const action = page.locator('[data-quiz-bottom-action="viewport"]')
    const initialHeight = await action.evaluate((element) => element.getBoundingClientRect().height)

    await page.getByRole("button", { name: "Etwas anderes", exact: true }).click()
    const note = page.getByLabel("Eigene Notiz")
    await expect(note).toBeFocused()
    await note.fill("Stumpf nach dem Föhnen")
    await page.waitForTimeout(500)
    await expect(note).toBeFocused()
    await expect(action.locator("button")).toBeEnabled()

    await page.getByRole("button", { name: "Wenig Glanz", exact: true }).click()
    await expect(action.locator("button")).toContainText("2 ausgewählt")

    const other = page.getByRole("button", { name: "Etwas anderes", exact: true })
    await other.click()
    await expect(other).toHaveAttribute("aria-pressed", "false")
    await expect(note).toBeHidden()
    await expect(action.locator("button")).toBeEnabled()
    await expect(action.locator("button")).toContainText("1 ausgewählt")

    await other.click()
    await expect(other).toHaveAttribute("aria-pressed", "true")
    await expect(note).toHaveValue("Stumpf nach dem Föhnen")
    await expect(action.locator("button")).toBeEnabled()
    await expect(action.locator("button")).toContainText("2 ausgewählt")
    await page.waitForTimeout(500)

    const focusedGeometry = await page.evaluate(() => {
      const textarea = document.querySelector<HTMLElement>("#quiz-concerns-other-text")
      const footer = document.querySelector<HTMLElement>('[data-quiz-bottom-action="viewport"]')
      if (!textarea || !footer) throw new Error("Concerns note geometry not found")
      return {
        footerHeight: footer.getBoundingClientRect().height,
        footerTop: footer.getBoundingClientRect().top,
        textareaBottom: textarea.getBoundingClientRect().bottom,
      }
    })
    expect(focusedGeometry.footerHeight).toBe(initialHeight)
    expect(focusedGeometry.textareaBottom).toBeLessThanOrEqual(focusedGeometry.footerTop)

    await page.locator("[data-quiz-bottom-clearance]").scrollIntoViewIfNeeded()
    const clearance = await page.evaluate(() => {
      const footer = document.querySelector<HTMLElement>('[data-quiz-bottom-action="viewport"]')
      const spacer = document.querySelector<HTMLElement>("[data-quiz-bottom-clearance]")
      if (!spacer || !footer) throw new Error("Concerns clearance geometry not found")
      return {
        footerHeight: footer.getBoundingClientRect().height,
        clearanceHeight: spacer.getBoundingClientRect().height,
      }
    })
    expect(clearance.clearanceHeight).toBeGreaterThanOrEqual(clearance.footerHeight)
  })

  test("does not refocus or scroll a saved concern note after Back", async ({ page }) => {
    await openDraft(
      page,
      12,
      { width: 390, height: 844 },
      {
        concerns_other_text: "Stumpf nach dem Föhnen",
      },
    )

    await page.getByRole("button", { name: "Zurück" }).click()
    await expect(page.getByRole("heading", { name: "Was beschäftigt dich gerade?" })).toBeVisible()
    const initialScrollY = await page.evaluate(() => window.scrollY)
    await page.waitForTimeout(650)

    await expect(page.getByLabel("Eigene Notiz")).not.toBeFocused()
    const landing = await page.evaluate(() => ({
      activeTag: document.activeElement?.tagName,
      scrollY: window.scrollY,
    }))
    expect(landing.activeTag).toBe("H2")
    // Mobile WebKit may make a small final adjustment while focusing the heading,
    // but the saved textarea must not trigger the previous scroll-to-bottom jump.
    expect(Math.abs(landing.scrollY - initialScrollY)).toBeLessThanOrEqual(32)
  })

  test("keeps the regular desktop action inline", async ({ page }) => {
    await openDraft(page, 7, { width: 1024, height: 800 })

    const inline = page.locator('[data-quiz-bottom-action="inline"]')
    await expect(inline.locator("button")).toBeVisible()
    await expect(page.locator('[data-quiz-bottom-action="viewport"]')).toBeHidden()
    await expect(page.locator("[data-quiz-bottom-clearance]")).toBeHidden()

    const placement = await inline.evaluate((element) => ({
      insideTransitionRoot: element.closest("[data-personal-plan-transition-root]") !== null,
      visibleWeiterButtons: Array.from(document.querySelectorAll("button")).filter(
        (candidate) =>
          candidate.textContent?.trim().endsWith("Weiter") && candidate.getClientRects().length > 0,
      ).length,
    }))
    expect(placement.insideTransitionRoot).toBe(true)
    expect(placement.visibleWeiterButtons).toBe(1)
  })

  test("centers a short desktop footer across the single-column quiz", async ({ page }) => {
    await openDraft(page, 7, { width: 1280, height: 700 })

    const geometry = await page
      .locator('[data-quiz-bottom-action="viewport"]')
      .evaluate((action) => {
        const button = action.querySelector("button")
        if (!button) throw new Error("Short desktop action button not found")
        return {
          actionLeft: action.getBoundingClientRect().left,
          actionRight: action.getBoundingClientRect().right,
          buttonLeft: button.getBoundingClientRect().left,
          layoutWidth: document.documentElement.clientWidth,
          viewportWidth: window.innerWidth,
        }
      })
    expect(geometry.actionLeft).toBe(0)
    // WebKit may reserve a narrow scrollbar gutter for the scrollable question column.
    expect(Math.abs(geometry.actionRight - geometry.layoutWidth)).toBeLessThanOrEqual(8)
    expect(geometry.buttonLeft).toBeLessThan(geometry.viewportWidth / 2)
  })

  test("silently restores a draft and maps browser Back to the previous quiz screen", async ({
    page,
  }) => {
    await openDraft(page, 7, { width: 390, height: 844 })
    await expect(
      page.getByRole("heading", { name: "Sind deine Haare chemisch behandelt?" }),
    ).toBeVisible()
    await expect(page.getByText("Angefangener Haar-Check")).toHaveCount(0)

    await page.goBack()
    await expect(page.getByRole("heading", { name: "Wie elastisch ist dein Haar?" })).toBeVisible()
    await expect(page).toHaveURL(/\/quiz$/)
  })

  test("keeps browser Forward from desynchronizing the rendered quiz screen", async ({ page }) => {
    await openDraft(page, 7, { width: 390, height: 844 })
    await page.goBack()
    await expect(page.getByRole("heading", { name: "Wie elastisch ist dein Haar?" })).toBeVisible()

    await page.goForward()
    await expect(page.getByRole("heading", { name: "Wie elastisch ist dein Haar?" })).toBeVisible()

    await page.goBack()
    await expect(
      page.getByRole("heading", { name: "Wie fühlt sich deine Haaroberfläche an?" }),
    ).toBeVisible()
  })

  test("maps browser Back through the scalp question's in-place phase", async ({ page }) => {
    await openDraft(
      page,
      6,
      { width: 390, height: 844 },
      { scalp_type: undefined, has_scalp_issue: undefined },
    )
    await page.getByRole("button", { name: "Ausgeglichen", exact: true }).click()
    await expect(
      page.getByRole("heading", {
        name: "Hast du zusätzlich Beschwerden wie Schuppen, Juckreiz oder Rötungen?",
      }),
    ).toBeVisible()

    await page.goBack()
    await expect(page.getByRole("button", { name: "Eher fettig", exact: true })).toBeVisible()
    await expect(page.getByRole("button", { name: "Eher trocken", exact: true })).toBeVisible()
    await expect(
      page.getByRole("heading", {
        name: "Hast du zusätzlich Beschwerden wie Schuppen, Juckreiz oder Rötungen?",
      }),
    ).toBeHidden()
  })

  test("uses a centered desktop question column without the split brand panel", async ({
    page,
  }) => {
    await openFreshQuiz(page, { width: 1280, height: 800 })

    await expect(page.getByText("Chaarlie", { exact: true })).toHaveCount(0)
    const column = await page
      .locator("[data-personal-plan-transition-root]")
      .evaluate((element) => element.getBoundingClientRect())
    expect(column.width).toBeLessThanOrEqual(640)
    expect(Math.abs(column.left + column.width / 2 - 640)).toBeLessThanOrEqual(2)
  })
})
