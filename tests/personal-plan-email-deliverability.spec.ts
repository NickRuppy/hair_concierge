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

const rejectedLeadResponse = {
  error: EMAIL_DELIVERABILITY_REJECTION_MESSAGE,
  reason: "no_mx",
  suggestion: "max.mustermann@gmail.com",
} satisfies EmailDeliverabilityRejectionResponse

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
  await expect(page.getByRole("heading", { name: /Wohin dürfen wir/i })).toBeVisible()
}

async function submitRejectedAddress(page: Page) {
  const email = page.getByLabel("E-Mail-Adresse")
  await email.fill("max.mustermann@gmail.vom")
  await page.getByRole("button", { name: "Weiter zu meiner Auswertung" }).click()
  await expect(
    page.getByRole("heading", { name: /Dürfen wir dir Haarpflege-Tipps/i }),
  ).toBeVisible()
  await page.getByRole("button", { name: "Nein, nur meine Auswertung schicken" }).click()
  await expect(page.getByRole("heading", { name: /Wohin dürfen wir/i })).toBeVisible()
  return email
}

test.describe("@ci personal-plan email deliverability recovery", () => {
  test("returns an inaccessible address to a focused, described field and supports correction", async ({
    page,
  }) => {
    let submissionCount = 0
    await page.route("**/api/quiz/personal-plan-lead", async (route) => {
      submissionCount += 1
      if (submissionCount === 1) {
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
        body: JSON.stringify({ leadId: "deliverability-lead", attributionAttached: false }),
      })
    })

    await openEmailCapture(page)
    const email = await submitRejectedAddress(page)
    const error = page.locator("#personal-plan-email-error")

    await expect(email).toBeFocused()
    await expect(email).toHaveAttribute("aria-invalid", "true")
    await expect(error).toContainText("Diese E-Mail-Domain kann keine E-Mails empfangen")
    const errorId = await error.getAttribute("id")
    expect(errorId).toBeTruthy()
    await expect(email).toHaveAttribute("aria-describedby", errorId!)

    await page.getByRole("button", { name: "max.mustermann@gmail.com", exact: true }).click()
    await expect(email).toHaveValue("max.mustermann@gmail.com")
    await expect(error).toHaveCount(0)
    await expect(email).toHaveAttribute("aria-invalid", "false")
    await expect(email).not.toHaveAttribute("aria-describedby", /.+/)

    await page.getByRole("button", { name: "Weiter zu meiner Auswertung" }).click()
    await page.getByRole("button", { name: "Nein, nur meine Auswertung schicken" }).click()
    await expect(page).toHaveURL(/\/result\/deliverability-lead\/reveal$/)
    expect(submissionCount).toBe(2)
  })

  test("manual editing clears the stale server error and suggestion", async ({ page }) => {
    await page.route("**/api/quiz/personal-plan-lead", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        status: 422,
        body: JSON.stringify(rejectedLeadResponse),
      })
    })

    await openEmailCapture(page)
    const email = await submitRejectedAddress(page)
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
