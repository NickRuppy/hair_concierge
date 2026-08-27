import { expect, test, type Page } from "@playwright/test"

const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000"

const analysisDraft = {
  version: 4,
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
  version: 4,
  screen: "early_proof",
  history: ["texture", "thickness", "density"],
  answers: { texture: "wavy", thickness: "normal", density: "medium" },
}

const scalpConcernsDraft = {
  version: 4,
  screen: "scalp_concerns",
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
    "analysis_bridge",
    "hair_length",
    "hair_surface",
    "elastic_response",
    "midpoint_profile",
    "chemical_treatments",
    "scalp_oiliness",
  ],
  answers: { texture: "wavy", thickness: "normal", density: "medium" },
}

type ActionGeometry = {
  actionBottom: number
  insideTransitionRoot: boolean
  visualBottom: number
  visibleActions: number
}

async function seedDraft(
  page: Page,
  draft: typeof analysisDraft | typeof earlyProofDraft | typeof scalpConcernsDraft,
) {
  await page.addInitScript((value) => {
    window.localStorage.setItem("chaarlie:personal-plan-quiz-draft:v4", JSON.stringify(value))
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

test("keeps the Optional Idealplan action and Back target contained on mobile WebKit", async ({
  page,
}) => {
  test.skip(
    process.env.CI_PERSONAL_PLAN_STAGE3_LAB_ENABLED !== "true",
    "The deterministic Personal Plan lab is explicitly gated.",
  )
  await page.setViewportSize({ width: 320, height: 700 })
  await page.goto("/labs/personal-plan-start")
  await page.getByRole("button", { name: "Optionale Empfehlungen" }).click()

  const nav = page.getByRole("navigation", { name: "Idealplan-Seiten" })
  const action = nav.getByRole("button", { name: "Zu deiner Routine" })
  const geometry = await action.evaluate((button) => {
    const bounds = button.getBoundingClientRect()
    const nav = button.closest("nav")!.getBoundingClientRect()
    return {
      left: bounds.left,
      right: bounds.right,
      navBottom: nav.bottom,
      viewportBottom:
        (window.visualViewport?.offsetTop ?? 0) +
        (window.visualViewport?.height ?? window.innerHeight),
      width: window.innerWidth,
    }
  })
  expect(geometry.left).toBeGreaterThanOrEqual(0)
  expect(geometry.right).toBeLessThanOrEqual(geometry.width)
  expect(Math.abs(geometry.navBottom - geometry.viewportBottom)).toBeLessThanOrEqual(1)
  await expect(nav.getByRole("button")).toHaveCount(1)
  const back = page.getByRole("button", { name: "Zur Basis" })
  await expect(back).toBeVisible()
  expect(await back.evaluate((button) => button.getBoundingClientRect().width)).toBe(48)
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

// Der Proof-Screen ist der laengste Screen der Analyse (Bild, Zahl, Zitat).
// Wenn seine Inline-CTA auf einem normalen Laptop-Viewport unter die Kante
// rutscht, sieht ein Teil der Nutzer den Weiter-Button erst nach dem Scrollen.
test("keeps the early proof action inside the 1440x900 viewport", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await seedDraft(page, earlyProofDraft)
  await page.goto(`${baseUrl}/lp/haarplan`, { waitUntil: "networkidle" })

  const action = page.getByRole("button", { name: "Weiter", exact: true })
  await expect(action).toBeVisible()

  const geometry = await action.evaluate((button) => {
    const container = button.closest<HTMLElement>('[data-personal-plan-bottom-action="inline"]')
    return {
      actionBottom: button.getBoundingClientRect().bottom,
      inline: container !== null && getComputedStyle(container).position !== "fixed",
      viewportHeight: window.innerHeight,
    }
  })

  expect(geometry.inline).toBe(true)
  expect(geometry.actionBottom).toBeLessThanOrEqual(geometry.viewportHeight)
})

// Die Kopfhaut-Frage ist die einzige mit einer eigenen "Nichts davon"-Karte.
// Sie ist eine echte Antwort (schaltet Weiter frei), aber kein Shortcut: sie
// darf nie selbst navigieren und muss sich gegen die echten Optionen ausschliessen.
test("scalp concerns: 'Nichts davon' toggles as a stateful answer without navigating", async ({
  page,
}) => {
  await seedDraft(page, scalpConcernsDraft)
  await page.goto(`${baseUrl}/lp/haarplan`, { waitUntil: "networkidle" })

  const heading = page.getByRole("heading", { name: "Was trifft aktuell auf deine Kopfhaut zu?" })
  await expect(heading).toBeVisible()

  const none = page.getByRole("button", { name: /^Nichts davon/ })
  const dryDandruff = page.getByRole("button", { name: /^Trockene Schuppen/ })
  const forward = page.getByRole("button", { name: /Weiter$/ })

  await expect(none).toHaveAttribute("aria-pressed", "false")
  await expect(forward).toBeDisabled()

  await none.click()
  await expect(none).toHaveAttribute("aria-pressed", "true")
  await expect(forward).toBeEnabled()
  // Kein Shortcut: der Screen bleibt stehen, weitergehen tut nur "Weiter".
  await expect(heading).toBeVisible()

  await none.click()
  await expect(none).toHaveAttribute("aria-pressed", "false")
  await expect(forward).toBeDisabled()
  await expect(heading).toBeVisible()

  await none.click()
  await expect(none).toHaveAttribute("aria-pressed", "true")
  await dryDandruff.click()
  await expect(dryDandruff).toHaveAttribute("aria-pressed", "true")
  await expect(none).toHaveAttribute("aria-pressed", "false")
  await expect(forward).toBeEnabled()
  await expect(heading).toBeVisible()
})
