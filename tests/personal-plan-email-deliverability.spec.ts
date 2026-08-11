import { expect, test, type Page } from "@playwright/test"

import {
  EMAIL_DELIVERABILITY_REJECTION_MESSAGE,
  type EmailDeliverabilityRejectionResponse,
} from "../src/lib/email-deliverability-shared"

const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000"

const personalPlanDraft = {
  version: 4,
  screen: "email_capture",
  history: ["texture", "daily_time", "plan_loading"],
  answers: { texture: "wavy", hairLength: "medium", goals: ["moisture"] },
}

const preparedPlanClaim = {
  artifactId: "deliverability-artifact",
  claimToken: "deliverability-claim",
  answersKey: JSON.stringify(personalPlanDraft.answers),
  expiresAt: "2099-01-01T00:00:00.000Z",
}

const rejectionResponse = {
  error: EMAIL_DELIVERABILITY_REJECTION_MESSAGE,
  reason: "no_mx",
  suggestion: "max.mustermann@gmail.com",
} satisfies EmailDeliverabilityRejectionResponse

const emailHeading = /Wohin dürfen wir/i
const consentHeading = /Dürfen wir dir Haarpflege-Tipps/i

async function openEmailCapture(page: Page) {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.route("**/api/funnel/session", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      status: 200,
      body: JSON.stringify({
        enabled: false,
        funnelPackageKey: null,
        funnelSessionId: null,
      }),
    })
  })
  await page.route("**/api/quiz/personal-plan-draft", async (route) => {
    await route.fulfill({ contentType: "application/json", status: 404, body: "{}" })
  })
  await page.addInitScript(
    ({ draft, claim }) => {
      window.localStorage.setItem(
        "chaarlie_cookie_consent_v1",
        JSON.stringify({ essential: true, analytics: false, marketing: false, ts: Date.now() }),
      )
      window.localStorage.setItem("chaarlie:personal-plan-quiz-draft:v4", JSON.stringify(draft))
      window.sessionStorage.setItem(
        "chaarlie:personal-plan-quiz-prepared:v1",
        JSON.stringify(claim),
      )
    },
    { draft: personalPlanDraft, claim: preparedPlanClaim },
  )
  await page.goto(`${baseUrl}/lp/haarplan`, { waitUntil: "networkidle" })
  await expect(page.getByRole("heading", { name: emailHeading })).toBeVisible()
}

/** Zaehlt die Aufrufe, merkt sich die gesendete Adresse, antwortet nach `plan`. */
async function routeJson(
  page: Page,
  url: string,
  plan: (call: number) => { status: number; body: unknown },
  counter: { calls: number; emails: unknown[] },
) {
  await page.route(url, async (route) => {
    counter.calls += 1
    counter.emails.push(route.request().postDataJSON()?.email)
    const { status, body } = plan(counter.calls)
    await route.fulfill({
      contentType: "application/json",
      status,
      body: JSON.stringify(body),
    })
  })
}

const leadAccepted = {
  status: 200,
  body: { leadId: "deliverability-lead", attributionAttached: false },
}

test.describe("@ci personal-plan email deliverability recovery", () => {
  test("A: the precheck rejects before the consent question is ever asked", async ({ page }) => {
    const precheck = { calls: 0, emails: [] as unknown[] }
    const lead = { calls: 0, emails: [] as unknown[] }
    await routeJson(
      page,
      "**/api/quiz/personal-plan-email-precheck",
      (call) =>
        call === 1 ? { status: 422, body: rejectionResponse } : { status: 200, body: { ok: true } },
      precheck,
    )
    await routeJson(page, "**/api/quiz/personal-plan-lead", () => leadAccepted, lead)

    await openEmailCapture(page)
    const email = page.getByLabel("E-Mail-Adresse")
    await email.fill("max.mustermann@gmail.vom")
    await page.getByRole("button", { name: "Weiter zu meiner Auswertung" }).click()

    const error = page.locator("#personal-plan-email-error")
    await expect(error).toContainText("Diese E-Mail-Domain kann keine E-Mails empfangen")
    // Die Consent-Frage darf auf diesem Pfad nie erscheinen.
    await expect(page.getByRole("heading", { name: consentHeading })).toHaveCount(0)
    await expect(page.getByRole("heading", { name: emailHeading })).toBeVisible()
    await expect(email).toBeFocused()
    await expect(email).toHaveAttribute("aria-invalid", "true")
    const errorId = await error.getAttribute("id")
    expect(errorId).toBeTruthy()
    await expect(email).toHaveAttribute("aria-describedby", errorId!)
    expect(lead.calls).toBe(0)

    await page.getByRole("button", { name: "max.mustermann@gmail.com", exact: true }).click()
    await expect(email).toHaveValue("max.mustermann@gmail.com")
    await expect(error).toHaveCount(0)
    await expect(email).toHaveAttribute("aria-invalid", "false")
    await expect(email).not.toHaveAttribute("aria-describedby", /.+/)

    await page.getByRole("button", { name: "Weiter zu meiner Auswertung" }).click()
    await expect(page.getByRole("heading", { name: consentHeading })).toBeVisible()
    await page.getByRole("button", { name: "Nein, nur meine Auswertung schicken" }).click()
    await expect(page).toHaveURL(/\/result\/deliverability-lead\/reveal$/)
    expect(precheck.calls).toBe(2)
    expect(lead.calls).toBe(1)
  })

  test("B: the lead backstop keeps the consent answer instead of asking twice", async ({
    page,
  }) => {
    const precheck = { calls: 0, emails: [] as unknown[] }
    const lead = { calls: 0, emails: [] as unknown[] }
    await routeJson(
      page,
      "**/api/quiz/personal-plan-email-precheck",
      () => ({ status: 200, body: { ok: true } }),
      precheck,
    )
    await routeJson(
      page,
      "**/api/quiz/personal-plan-lead",
      (call) => (call === 1 ? { status: 422, body: rejectionResponse } : leadAccepted),
      lead,
    )

    await openEmailCapture(page)
    const email = page.getByLabel("E-Mail-Adresse")
    await email.fill("max.mustermann@beispiel.de")
    await page.getByRole("button", { name: "Weiter zu meiner Auswertung" }).click()
    await expect(page.getByRole("heading", { name: consentHeading })).toBeVisible()
    await page.getByRole("button", { name: "Nein, nur meine Auswertung schicken" }).click()

    const error = page.locator("#personal-plan-email-error")
    await expect(page.getByRole("heading", { name: emailHeading })).toBeVisible()
    await expect(error).toContainText("Diese E-Mail-Domain kann keine E-Mails empfangen")
    await expect(email).toBeFocused()
    await expect(email).toHaveAttribute("aria-invalid", "true")
    const errorId = await error.getAttribute("id")
    expect(errorId).toBeTruthy()
    await expect(email).toHaveAttribute("aria-describedby", errorId!)
    expect(lead.calls).toBe(1)

    await email.fill("max.mustermann@gmail.com")
    await expect(error).toHaveCount(0)
    await page.getByRole("button", { name: "Weiter zu meiner Auswertung" }).click()

    // Die Zustimmung wurde bereits gegeben: direkt speichern, keine zweite Frage.
    await expect(page).toHaveURL(/\/result\/deliverability-lead\/reveal$/)
    expect(lead.calls).toBe(2)
    expect(precheck.calls).toBe(2)
    expect(await page.getByRole("heading", { name: consentHeading }).count()).toBe(0)
    // Der zweite Versuch traegt die geprüfte, korrigierte Adresse.
    expect(lead.emails).toEqual(["max.mustermann@beispiel.de", "max.mustermann@gmail.com"])
  })

  test("C: a failing precheck lets the lead through instead of blocking it", async ({ page }) => {
    const lead = { calls: 0, emails: [] as unknown[] }
    await page.route("**/api/quiz/personal-plan-email-precheck", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1200))
      await route.abort("failed")
    })
    await routeJson(page, "**/api/quiz/personal-plan-lead", () => leadAccepted, lead)

    await openEmailCapture(page)
    await page.getByLabel("E-Mail-Adresse").fill("max.mustermann@beispiel.de")
    const submit = page.getByRole("button", { name: "Weiter zu meiner Auswertung" })
    await submit.click()

    // Waehrend der Pruefung: gesperrt und sichtbar beschaeftigt.
    const busySubmit = page.getByRole("button", { name: "E-Mail wird geprüft…" })
    await expect(busySubmit).toBeDisabled()
    await expect(submit).toHaveCount(0)

    await expect(page.getByRole("heading", { name: consentHeading })).toBeVisible()
    await page.getByRole("button", { name: "Ja, weiter zu meiner Auswertung" }).click()
    await expect(page).toHaveURL(/\/result\/deliverability-lead\/reveal$/)
    expect(lead.calls).toBe(1)
  })

  test("D: a precheck answered after an edit does not overwrite the new address", async ({
    page,
  }) => {
    const postedLeadEmails: unknown[] = []
    let precheckCalls = 0
    await page.route("**/api/quiz/personal-plan-email-precheck", async (route) => {
      precheckCalls += 1
      if (precheckCalls === 1) {
        // Antwort trifft erst ein, wenn das Feld schon eine andere Adresse hat.
        await new Promise((resolve) => setTimeout(resolve, 1500))
        await route.fulfill({
          contentType: "application/json",
          status: 422,
          body: JSON.stringify(rejectionResponse),
        })
        return
      }
      await route.fulfill({
        contentType: "application/json",
        status: 200,
        body: JSON.stringify({ ok: true }),
      })
    })
    await page.route("**/api/quiz/personal-plan-lead", async (route) => {
      postedLeadEmails.push(route.request().postDataJSON()?.email)
      await route.fulfill({
        contentType: "application/json",
        status: leadAccepted.status,
        body: JSON.stringify(leadAccepted.body),
      })
    })

    await openEmailCapture(page)
    const email = page.getByLabel("E-Mail-Adresse")
    await email.fill("max.mustermann@gmail.vom")
    await page.getByRole("button", { name: "Weiter zu meiner Auswertung" }).click()
    await expect(page.getByRole("button", { name: "E-Mail wird geprüft…" })).toBeVisible()

    // Waehrend die Pruefung laeuft: Adresse korrigieren.
    await email.fill("max.mustermann@web.de")
    await expect(page.getByRole("button", { name: "Weiter zu meiner Auswertung" })).toBeEnabled()

    // Das verspaetete 422 gehoert zur alten Adresse und muss folgenlos bleiben.
    await page.waitForTimeout(1500)
    await expect(email).toHaveValue("max.mustermann@web.de")
    await expect(page.locator("#personal-plan-email-error")).toHaveCount(0)
    await expect(
      page.getByRole("button", { name: "max.mustermann@gmail.com", exact: true }),
    ).toHaveCount(0)
    await expect(page.getByRole("heading", { name: consentHeading })).toHaveCount(0)

    // Die neue Adresse laeuft ganz normal durch.
    await page.getByRole("button", { name: "Weiter zu meiner Auswertung" }).click()
    await expect(page.getByRole("heading", { name: consentHeading })).toBeVisible()
    await page.getByRole("button", { name: "Nein, nur meine Auswertung schicken" }).click()
    await expect(page).toHaveURL(/\/result\/deliverability-lead\/reveal$/)
    // Gespeichert wird die geprüfte Adresse, nicht die verworfene.
    expect(postedLeadEmails).toEqual(["max.mustermann@web.de"])
  })

  test("manual editing clears the stale server error and suggestion", async ({ page }) => {
    const precheck = { calls: 0, emails: [] as unknown[] }
    await routeJson(
      page,
      "**/api/quiz/personal-plan-email-precheck",
      () => ({ status: 422, body: rejectionResponse }),
      precheck,
    )

    await openEmailCapture(page)
    const email = page.getByLabel("E-Mail-Adresse")
    await email.fill("max.mustermann@gmail.vom")
    await page.getByRole("button", { name: "Weiter zu meiner Auswertung" }).click()
    await expect(page.locator("#personal-plan-email-error")).toBeVisible()
    await expect(
      page.getByRole("button", { name: "max.mustermann@gmail.com", exact: true }),
    ).toBeVisible()

    await email.fill("max.mustermann@beispiel.de")
    await expect(page.locator("#personal-plan-email-error")).toHaveCount(0)
    await expect(
      page.getByRole("button", { name: "max.mustermann@gmail.com", exact: true }),
    ).toHaveCount(0)
  })
})
