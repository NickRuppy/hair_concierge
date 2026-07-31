import { expect, test, type Page } from "@playwright/test"

const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000"

const analysisDraft = {
  version: 3,
  screen: "analysis_bridge",
  history: [
    "texture",
    "thickness",
    "density",
    "early_proof",
    "goals",
    "routine_clarity",
    "result_reliability",
    "adaptation_confidence",
    "current_problems",
  ],
  answers: { texture: "wavy" },
}

const earlyProofDraft = {
  version: 3,
  screen: "early_proof",
  history: ["texture", "thickness", "density"],
  answers: { texture: "wavy", thickness: "normal", density: "medium" },
}

type ActionGeometry = {
  actionBottom: number
  insideTransitionRoot: boolean
  visualBottom: number
  visibleActions: number
}

async function seedDraft(page: Page, draft: typeof analysisDraft | typeof earlyProofDraft) {
  await page.addInitScript((value) => {
    window.localStorage.setItem("chaarlie:personal-plan-quiz-draft:v3", JSON.stringify(value))
    window.localStorage.setItem(
      "chaarlie_cookie_consent_v1",
      JSON.stringify({ essential: true, analytics: false, marketing: false, ts: Date.now() }),
    )
  }, draft)
}

async function visibleActionGeometry(page: Page, label: string): Promise<ActionGeometry> {
  return page.evaluate((buttonLabel) => {
    const visibleButtons = Array.from(document.querySelectorAll("button")).filter(
      (candidate) =>
        candidate.textContent?.trim() === buttonLabel &&
        !candidate.closest('[aria-hidden="true"]') &&
        candidate.getClientRects().length > 0,
    )
    const button = visibleButtons[0]
    if (!button) throw new Error(`Visible action not found: ${buttonLabel}`)

    const action = button.closest<HTMLElement>('[data-personal-plan-bottom-action="viewport"]')
    if (!action || getComputedStyle(action).position !== "fixed") {
      throw new Error(`Fixed viewport action container not found: ${buttonLabel}`)
    }

    return {
      actionBottom: action.getBoundingClientRect().bottom,
      insideTransitionRoot: action.closest("[data-personal-plan-transition-root]") !== null,
      visualBottom:
        (window.visualViewport?.offsetTop ?? 0) +
        (window.visualViewport?.height ?? window.innerHeight),
      visibleActions: visibleButtons.length,
    }
  }, label)
}

test.describe("mobile browser contexts", () => {
  test.use({ hasTouch: true, isMobile: true })

  for (const viewport of [
    { name: "375x667", width: 375, height: 667 },
    { name: "390x844", width: 390, height: 844 },
  ]) {
    test.describe(`personal-plan mobile action containment ${viewport.name}`, () => {
      test.beforeEach(async ({ page }) => {
        await page.setViewportSize(viewport)
      })

      test("keeps the settled analysis action at the visual viewport bottom", async ({ page }) => {
        await seedDraft(page, analysisDraft)
        await page.goto(`${baseUrl}/lp/haarplan`, { waitUntil: "networkidle" })

        const action = page.getByRole("button", { name: "Haaranalyse fortsetzen" })
        await expect(action).toBeVisible()
        await page.waitForTimeout(700)

        const geometry = await visibleActionGeometry(page, "Haaranalyse fortsetzen")
        expect(geometry.insideTransitionRoot).toBe(false)
        expect(Math.abs(geometry.actionBottom - geometry.visualBottom)).toBeLessThanOrEqual(1)
        expect(geometry.visibleActions).toBe(1)
      })

      test("keeps the next action at the visual viewport bottom during a screen transition", async ({
        page,
      }) => {
        await seedDraft(page, earlyProofDraft)
        await page.goto(`${baseUrl}/lp/haarplan`, { waitUntil: "networkidle" })

        const action = page.getByRole("button", { name: "Weiter", exact: true })
        await expect(action).toBeVisible()
        await action.click()

        await expect(page.locator('[data-personal-plan-transition-layer="outgoing"]')).toBeVisible()
        const geometry = await visibleActionGeometry(page, "Weiter")
        expect(geometry.insideTransitionRoot).toBe(false)
        expect(Math.abs(geometry.actionBottom - geometry.visualBottom)).toBeLessThanOrEqual(1)
        expect(geometry.visibleActions).toBe(1)
      })
    })
  }
})

test("keeps the regular desktop action inline", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 800 })
  await seedDraft(page, analysisDraft)
  await page.goto(`${baseUrl}/lp/haarplan`, { waitUntil: "networkidle" })

  const action = page.getByRole("button", { name: "Haaranalyse fortsetzen" })
  await expect(action).toBeVisible()
  await expect(action).toHaveCount(1)

  const placement = await action.evaluate((button) => {
    return {
      insideTransitionRoot: button.closest("[data-personal-plan-transition-root]") !== null,
      visibleButtons: Array.from(document.querySelectorAll("button")).filter(
        (candidate) =>
          candidate.textContent?.trim() === "Haaranalyse fortsetzen" &&
          candidate.getClientRects().length > 0,
      ).length,
    }
  })

  expect(placement.insideTransitionRoot).toBe(true)
  expect(placement.visibleButtons).toBe(1)
})
