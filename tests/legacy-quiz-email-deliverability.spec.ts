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
  test("shows invited-account correction and keeps the email editable", async ({ page }) => {
    await page.route("**/api/quiz/lead", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        status: 422,
        body: JSON.stringify({
          code: "invited_email_mismatch",
          error: "Bitte verwende die E-Mail-Adresse deines eingeladenen Kontos.",
        }),
      })
    })
    await openEmailCapture(page)
    const email = page.getByPlaceholder("name@beispiel.de")
    await email.fill("different@gmail.com")
    await page.getByRole("button", { name: "Weiter" }).click()
    await page.getByRole("button", { name: "Nein, nur meine Auswertung schicken" }).click()
    await expect(page.locator("#legacy-quiz-email-error")).toHaveText(
      "Bitte verwende die E-Mail-Adresse deines eingeladenen Kontos.",
    )
    await expect(email).toBeFocused()
    await email.fill("invited@gmail.com")
    await expect(page.locator("#legacy-quiz-email-error")).toHaveCount(0)
  })
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

    // The consent question was already answered before the rejection, so the
    // corrected address must resubmit with that answer instead of asking again.
    await page.getByRole("button", { name: "Weiter" }).click()
    await expect(consentNo).toHaveCount(0)
    await expect(page.getByRole("button", { name: "Ja, zeig mir meine Analyse" })).toBeVisible({
      timeout: 15_000,
    })
    expect(submissionCount).toBe(2)
  })

  // A Back attempt while the consent submission is still in flight must not win
  // a race against the pending response: the header button is disabled, and a
  // real browser-back (hardware/OS gesture) must not advance the sub-step
  // either, or the stale-closure recovery below would land on the name screen.
  test("Back during an in-flight submission is ignored and recovery still lands on the e-mail step", async ({
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
      markFirstRequestReceived()
      await firstResponseGate
      await route.fulfill({
        contentType: "application/json",
        status: 422,
        body: JSON.stringify(rejectedLeadResponse),
      })
    })

    await openEmailCapture(page)
    const email = page.getByPlaceholder("name@beispiel.de")
    await email.fill("legacy.test@example.com")
    await page.getByRole("button", { name: "Weiter" }).click()
    await page.getByRole("button", { name: "Nein, nur meine Auswertung schicken" }).click()
    await firstRequestReceived

    const backButton = page.getByRole("button", { name: "Zurück" })
    await expect(backButton).toBeDisabled()

    // A real browser-back during the in-flight request (hardware/OS gesture) —
    // the disabled header button already blocks a click, so this exercises the
    // `handleBack` guard directly.
    await page.goBack()

    // Still mid-flight on the consent step: unmoved, buttons still disabled.
    await expect(
      page.getByRole("button", { name: "Ja, weiter zu meiner Auswertung" }),
    ).toBeDisabled()
    await expect(page.getByRole("heading", { name: "Wie heißt du?" })).toHaveCount(0)

    releaseFirstResponse()

    await expect(page.getByRole("heading", { name: "Deine E-Mail Adresse" })).toBeVisible()
    await expect(page.locator("#legacy-quiz-email-error")).toContainText(
      "Diese E-Mail-Domain kann keine E-Mails empfangen",
    )
    await expect(page.getByRole("heading", { name: "Wie heißt du?" })).toHaveCount(0)
    expect(submissionCount).toBe(1)
  })

  // The retry is submitted from the e-mail step, so the recovery may not lean on
  // the Back button any more: that would step on to the name screen and wipe the
  // very message the second rejection just wrote.
  test("a second rejection keeps the user on the e-mail step with the message", async ({
    page,
  }) => {
    let submissionCount = 0
    await page.route("**/api/quiz/lead", async (route) => {
      submissionCount += 1
      await route.fulfill({
        contentType: "application/json",
        status: 422,
        body: JSON.stringify(rejectedLeadResponse),
      })
    })

    await openEmailCapture(page)
    const email = page.getByPlaceholder("name@beispiel.de")
    const error = page.locator("#legacy-quiz-email-error")
    await email.fill("legacy.test@gmail.vom")
    await page.getByRole("button", { name: "Weiter" }).click()
    await page.getByRole("button", { name: "Nein, nur meine Auswertung schicken" }).click()

    await expect(page.getByRole("heading", { name: "Deine E-Mail Adresse" })).toBeVisible()
    await expect(error).toContainText("Diese E-Mail-Domain kann keine E-Mails empfangen")

    // Retry with a second undeliverable address, straight from the e-mail step.
    await email.fill("legacy.test@gmail.vpm")
    await expect(error).toHaveCount(0)
    await page.getByRole("button", { name: "Weiter" }).click()

    await expect.poll(() => submissionCount).toBe(2)
    await expect(page.getByRole("heading", { name: "Deine E-Mail Adresse" })).toBeVisible()
    await expect(page.getByRole("heading", { name: "Wie heißt du?" })).toHaveCount(0)
    await expect(error).toContainText("Diese E-Mail-Domain kann keine E-Mails empfangen")
    await expect(
      page.getByRole("button", { name: /Korrektur übernehmen.*legacy\.test@gmail\.com/i }),
    ).toBeVisible()
    await expect(email).toHaveValue("legacy.test@gmail.vpm")
  })

  // The kept consent belongs to the submission being corrected. Back ends that
  // recovery, so the next address is a fresh submission and must ask again.
  test("Back after a rejection asks the consent question again", async ({ page }) => {
    const submittedConsents: unknown[] = []
    await page.route("**/api/quiz/lead", async (route) => {
      const payload = route.request().postDataJSON() as { marketingConsent?: unknown }
      submittedConsents.push(payload.marketingConsent)
      if (submittedConsents.length === 1) {
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
        body: JSON.stringify({ leadId: "legacy-consent-reset-lead" }),
      })
    })

    await openEmailCapture(page)
    const email = page.getByPlaceholder("name@beispiel.de")
    await email.fill("legacy.test@gmail.vom")
    await page.getByRole("button", { name: "Weiter" }).click()
    await page.getByRole("button", { name: "Nein, nur meine Auswertung schicken" }).click()
    await expect(page.locator("#legacy-quiz-email-error")).toBeVisible()

    // Back to the name step and forward again: a new submission, not a recovery.
    await page.getByRole("button", { name: "Zurück" }).click()
    await expect(page.getByRole("heading", { name: "Wie heißt du?" })).toBeVisible()
    await page.getByRole("button", { name: "Weiter zum Ergebnis" }).click()
    await expect(page.getByRole("heading", { name: "Deine E-Mail Adresse" })).toBeVisible()
    await page.getByPlaceholder("name@beispiel.de").fill("legacy.test@gmail.com")
    await page.getByRole("button", { name: "Weiter" }).click()

    const consentYes = page.getByRole("button", { name: "Ja, weiter zu meiner Auswertung" })
    await expect(consentYes).toBeVisible()
    await consentYes.click()
    await expect.poll(() => submittedConsents).toEqual([false, true])
  })

  test("an invalid address is named on blur and the CTA stays a dimmed button", async ({
    page,
  }) => {
    await openEmailCapture(page)
    const email = page.getByPlaceholder("name@beispiel.de")
    const weiter = page.getByRole("button", { name: "Weiter" })

    // Empty and untouched: button-shaped and dimmed, no accusation yet.
    await expect(weiter).toBeDisabled()
    await expect(weiter).toHaveClass(/quiz-btn-primary/)
    await expect(page.locator("#legacy-quiz-email-error")).toHaveCount(0)

    await email.fill("maria@@test")
    await email.blur()
    await expect(page.locator("#legacy-quiz-email-error")).toHaveText(
      "Bitte eine gültige E-Mail-Adresse eingeben.",
    )
    await expect(email).toHaveAttribute("aria-invalid", "true")
    await expect(weiter).toBeDisabled()
    await expect(weiter).toHaveClass(/quiz-btn-primary/)

    await email.fill("maria@beispiel.de")
    await expect(page.locator("#legacy-quiz-email-error")).toHaveCount(0)
    await expect(weiter).toBeEnabled()
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
