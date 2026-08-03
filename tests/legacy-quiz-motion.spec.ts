import { expect, test, type Page } from "@playwright/test"

const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000"

type TransitionSnapshot = {
  activeDirection: string | null
  activeHeading: string | null
  duplicateIds: string[]
  outgoingDirection: string | null
  outgoingHeading: string | null
  outgoingHiddenFromAT: string | null
  outgoingInert: boolean
  outgoingOptionAnimationName: string | null
  outgoingOptionOpacity: string | null
  progressInitialWidth: string | null
  progressTransitionDuration: string | null
}

async function openFreshQuiz(page: Page) {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "chaarlie_cookie_consent_v1",
      JSON.stringify({ essential: true, analytics: false, marketing: false, ts: Date.now() }),
    )
    window.localStorage.removeItem("chaarlie:quiz-draft:v1")
  })
  await page.goto(`${baseUrl}/quiz`, { waitUntil: "networkidle" })
  await expect(
    page.getByRole("heading", {
      name: "Welche Haarstruktur haben die meisten deiner Haare?",
    }),
  ).toBeVisible()
}

async function armTransitionCapture(page: Page) {
  await page.evaluate(() => {
    const quizWindow = window as Window & {
      __legacyQuizTransition?: Promise<TransitionSnapshot | null>
    }
    quizWindow.__legacyQuizTransition = new Promise((resolve) => {
      let settled = false
      let timeoutId = 0
      const observer = new MutationObserver(() => {
        const outgoing = document.querySelector<HTMLElement>(
          '[data-personal-plan-transition-layer="outgoing"]',
        )
        const active = document.querySelector<HTMLElement>(
          '[data-personal-plan-transition-layer="active"]',
        )
        if (!outgoing || !active) return

        const ids = Array.from(
          document.querySelectorAll<HTMLElement>("[id]"),
          (element) => element.id,
        )
        const progressFill = active.querySelector<HTMLElement>("[data-legacy-quiz-progress-fill]")
        const outgoingOption = outgoing.querySelector<HTMLElement>(".animate-fade-in-up")
        settled = true
        window.clearTimeout(timeoutId)
        observer.disconnect()
        resolve({
          activeDirection: active.getAttribute("data-personal-plan-transition-direction"),
          activeHeading: active.querySelector("h1,h2")?.textContent ?? null,
          duplicateIds: ids.filter((id, index) => ids.indexOf(id) !== index),
          outgoingDirection: outgoing.getAttribute("data-personal-plan-transition-direction"),
          outgoingHeading: outgoing.querySelector("h1,h2")?.textContent ?? null,
          outgoingHiddenFromAT: outgoing.getAttribute("aria-hidden"),
          outgoingInert: outgoing.hasAttribute("inert"),
          outgoingOptionAnimationName: outgoingOption
            ? window.getComputedStyle(outgoingOption).animationName
            : null,
          outgoingOptionOpacity: outgoingOption
            ? window.getComputedStyle(outgoingOption).opacity
            : null,
          progressInitialWidth: progressFill?.style.width ?? null,
          progressTransitionDuration: progressFill
            ? window.getComputedStyle(progressFill).transitionDuration
            : null,
        })
      })
      timeoutId = window.setTimeout(() => {
        if (settled) return
        observer.disconnect()
        resolve(null)
      }, 2_000)
      observer.observe(document.documentElement, { childList: true, subtree: true })
    })
  })
}

async function readTransitionCapture(page: Page) {
  return page.evaluate(() => {
    const quizWindow = window as Window & {
      __legacyQuizTransition?: Promise<TransitionSnapshot | null>
    }
    return quizWindow.__legacyQuizTransition
  })
}

test.describe("@ci legacy quiz motion", () => {
  test("uses the Personal Plan two-layer transition and smooth progress timing", async ({
    page,
  }) => {
    await openFreshQuiz(page)
    await armTransitionCapture(page)

    await page.getByRole("button", { name: "Wellig", exact: true }).click()
    const transition = await readTransitionCapture(page)

    expect(transition).not.toBeNull()
    expect(transition).toMatchObject({
      activeDirection: "forward",
      activeHeading: "Wie dick fühlt sich ein einzelnes Haar bei dir meistens an?",
      duplicateIds: [],
      outgoingDirection: "forward",
      outgoingHeading: "Welche Haarstruktur haben die meisten deiner Haare?",
      outgoingHiddenFromAT: "true",
      outgoingInert: true,
      outgoingOptionAnimationName: "none",
      outgoingOptionOpacity: "1",
      progressInitialWidth: "10%",
      progressTransitionDuration: "0.5s",
    })

    await expect(page.locator('[data-personal-plan-transition-layer="outgoing"]')).toHaveCount(0)
    await armTransitionCapture(page)
    await page.getByRole("button", { name: "Zurück" }).click()
    const backTransition = await readTransitionCapture(page)

    expect(backTransition).toMatchObject({
      activeDirection: "back",
      activeHeading: "Welche Haarstruktur haben die meisten deiner Haare?",
      outgoingDirection: "back",
      outgoingHeading: "Wie dick fühlt sich ein einzelnes Haar bei dir meistens an?",
      outgoingOptionAnimationName: "none",
      outgoingOptionOpacity: "1",
      progressInitialWidth: "20%",
    })
  })

  test("renders a labelled real profile image on the organic landing", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" })
    await expect(page.getByRole("img", { name: "Beispielprofil mit welligem Haar" })).toBeVisible()
    await expect(page.getByText("Beispielprofil", { exact: true })).toBeVisible()
    const width = await page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }))
    expect(width.scroll).toBeLessThanOrEqual(width.client)
  })
})
