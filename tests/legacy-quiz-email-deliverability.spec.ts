import { expect, test, type Page } from "@playwright/test"

import {
  EMAIL_DELIVERABILITY_REJECTION_MESSAGE,
  type EmailDeliverabilityRejectionResponse,
} from "../src/lib/email-deliverability-shared"

const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000"

const legacyQuizDraft = {
  version: 1,
  savedAt: Date.now(),
  step: 9,
  answers: {
    structure: "wavy",
    thickness: "fine",
    density: "medium",
    hair_length: "medium",
    fingertest: "leicht_uneben",
    pulltest: "stretches_bounces",
    scalp_type: "ausgeglichen",
    has_scalp_issue: false,
    concerns: ["dryness"],
    treatment: ["natur"],
    goals: ["shine"],
  },
}

const rejectedLeadResponse = {
  error: EMAIL_DELIVERABILITY_REJECTION_MESSAGE,
  reason: "no_mx",
  suggestion: "legacy.test@gmail.com",
} satisfies EmailDeliverabilityRejectionResponse

async function openEmailCapture(page: Page) {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.addInitScript((draft) => {
    window.localStorage.setItem(
      "chaarlie_cookie_consent_v1",
      JSON.stringify({ essential: true, analytics: false, marketing: false, ts: Date.now() }),
    )
    window.localStorage.setItem("chaarlie:quiz-draft:v1", JSON.stringify(draft))
  }, legacyQuizDraft)
  await page.goto(`${baseUrl}/quiz`, { waitUntil: "networkidle" })
  await expect(page.getByRole("heading", { name: "Wie heißt du?" })).toBeVisible()
  await page.getByPlaceholder("Dein Vorname").fill("Legacy Test")
  await page.getByRole("button", { name: "Weiter zum Ergebnis" }).click()
  await expect(page.getByRole("heading", { name: "Deine E-Mail Adresse" })).toBeVisible()
}

test.describe("@ci legacy quiz email deliverability recovery", () => {
  test("keeps saving bounded and returns a rejected address to editable recovery", async ({
    page,
  }) => {
    let submissionCount = 0
    let releaseFirstResponse!: () => void
    let markFirstRequestReceived!: () => void
    const firstResponseGate = new Promise<void>((resolve) => {
      releaseFirstResponse = resolve
    })
    const firstRequestReceived = new Promise<void>((resolve) => {
      markFirstRequestReceived = resolve
    })

    await page.route("**/api/quiz/lead", async (route) => {
      submissionCount += 1
      if (submissionCount === 1) {
        markFirstRequestReceived()
        await firstResponseGate
        await route.fulfill({
          contentType: "application/json",
          status: 422,
          body: JSON.stringify(rejectedLeadResponse),
        })
        return
      }
      await route.fulfill({
        contentType: "application/json",
        status: 200,
        body: JSON.stringify({ leadId: "legacy-deliverability-lead" }),
      })
    })

    await openEmailCapture(page)
    const email = page.getByPlaceholder("name@beispiel.de")
    await email.fill("legacy.test@gmail.vom")
    await expect(
      page.getByRole("button", { name: /Meintest du.*legacy\.test@gmail\.com/i }),
    ).toBeVisible()
    await page.getByRole("button", { name: "Weiter" }).click()

    const consentNo = page.getByRole("button", {
      name: "Nein, nur meine Auswertung schicken",
    })
    await consentNo.click()
    await firstRequestReceived
    const savingButton = page.getByRole("button", { name: "Wird gespeichert…" })
    await expect(savingButton).toBeDisabled()
    await expect(
      page.getByRole("button", { name: "Ja, weiter zu meiner Auswertung" }),
    ).toBeDisabled()
    await expect(savingButton).toBeVisible()
    releaseFirstResponse()

    await expect(page.getByRole("heading", { name: "Deine E-Mail Adresse" })).toBeVisible()
    const error = page.locator("#legacy-quiz-email-error")
    await expect(email).toBeFocused()
    await expect(email).toHaveAttribute("aria-invalid", "true")
    await expect(error).toContainText("Diese E-Mail-Domain kann keine E-Mails empfangen")
    await expect(email).toHaveAttribute("aria-describedby", "legacy-quiz-email-error")

    await page
      .getByRole("button", { name: /Korrektur übernehmen.*legacy\.test@gmail\.com/i })
      .click()
    await expect(email).toHaveValue("legacy.test@gmail.com")
    await expect(error).toHaveCount(0)
    await expect(email).toHaveAttribute("aria-invalid", "false")
    await expect(email).not.toHaveAttribute("aria-describedby", /.+/)

    await page.getByRole("button", { name: "Weiter" }).click()
    await page.getByRole("button", { name: "Nein, nur meine Auswertung schicken" }).click()
    await expect(page.getByText("Deine Angaben sind gespeichert", { exact: true })).toBeVisible()
    expect(submissionCount).toBe(2)
  })

  test("manual editing clears a stale server error and suggestion", async ({ page }) => {
    await page.route("**/api/quiz/lead", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        status: 422,
        body: JSON.stringify(rejectedLeadResponse),
      })
    })

    await openEmailCapture(page)
    const email = page.getByPlaceholder("name@beispiel.de")
    await email.fill("legacy.test@gmail.vom")
    await page.getByRole("button", { name: "Weiter" }).click()
    await page.getByRole("button", { name: "Nein, nur meine Auswertung schicken" }).click()
    await expect(page.locator("#legacy-quiz-email-error")).toBeVisible()

    await email.fill("legacy.test@gmail.com")
    await expect(page.locator("#legacy-quiz-email-error")).toHaveCount(0)
    await expect(
      page.getByRole("button", { name: /Korrektur übernehmen.*legacy\.test@gmail\.com/i }),
    ).toHaveCount(0)
  })
})
