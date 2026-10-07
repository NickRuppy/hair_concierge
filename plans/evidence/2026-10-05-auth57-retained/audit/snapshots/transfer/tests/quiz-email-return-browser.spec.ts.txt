import { expect, test, type Page } from "@playwright/test"

import { encodeFunnelContext, FUNNEL_SESSION_COOKIE } from "../src/lib/funnel/cookie"

const RETURN_PACKAGE = "customerio_scan_return_v1"
const COMPLETE_ANSWERS = {
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
}

async function openReturnedLeadCapture(
  page: Page,
  baseURL: string,
  editContext: Record<string, unknown> = {
    status: "resolved",
    lead: { name: "Nick", email: "nick@example.com", marketingConsent: true },
  },
) {
  const secret = process.env.FUNNEL_COOKIE_SIGNING_SECRET
  if (!secret) throw new Error("FUNNEL_COOKIE_SIGNING_SECRET is required for this browser test")
  const funnelCookie = await encodeFunnelContext(
    {
      visitorId: "20000000-0000-4000-8000-000000000002",
      sessionId: "30000000-0000-4000-8000-000000000003",
      packageKey: RETURN_PACKAGE,
      issuedAt: Date.now(),
    },
    secret,
  )
  await page
    .context()
    .addCookies([{ name: FUNNEL_SESSION_COOKIE, value: funnelCookie, url: baseURL }])
  await page.addInitScript(
    ({ answers, packageKey }) => {
      window.localStorage.setItem(
        "chaarlie:quiz-draft:v1",
        JSON.stringify({
          version: 2,
          savedAt: Date.now(),
          step: 9,
          answers,
          funnelPackageKey: packageKey,
        }),
      )
    },
    { answers: COMPLETE_ANSWERS, packageKey: RETURN_PACKAGE },
  )
  await page.route(/\/api\/quiz\/email-return\/context\?mode=edit$/, async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(editContext),
    })
  })
  await page.goto("/quiz")
}

test("recognized return stays on the ordinary quiz and Edit resumes prefilled answers", async ({
  page,
}, testInfo) => {
  await page.route("**/api/quiz/email-return/context", async (route) => {
    await route.fulfill({ contentType: "application/json", body: '{"status":"resolved"}' })
  })
  await page.route("**/api/quiz/email-return/choose", async (route) => {
    expect(route.request().method()).toBe("POST")
    expect(route.request().postDataJSON()).toEqual({ choice: "edit" })
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        status: "edit",
        answers: { structure: "wavy", thickness: "normal", hair_length: "medium" },
      }),
    })
  })

  await page.goto("/quiz?return=ready")
  const dialog = page.getByRole("dialog", { name: "Du hast das Quiz schon gemacht." })
  await expect(dialog).toBeVisible()
  // The question remains visibly behind the modal, but is intentionally inert
  // and therefore absent from the accessibility tree until a choice is made.
  await expect(page.locator("h1")).toContainText(
    "Welche Haarstruktur haben die meisten deiner Haare?",
  )
  await expect(dialog.getByRole("button", { name: "Mit meinen Antworten weiter" })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath("return-dialog-desktop.png") })
  await dialog.getByRole("button", { name: "Antworten bearbeiten" }).click()

  await expect(page).toHaveURL(/\/quiz$/)
  await expect(dialog).toHaveCount(0)
  const draft = await page.evaluate(() =>
    JSON.parse(window.localStorage.getItem("chaarlie:quiz-draft:v1") ?? "null"),
  )
  expect(draft).toMatchObject({
    step: 2,
    answers: { structure: "wavy", thickness: "normal", hair_length: "medium" },
    funnelPackageKey: "customerio_scan_return_v1",
  })
})

test("the return prompt fits a small phone without hiding either decision", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.route("**/api/quiz/email-return/context", async (route) => {
    await route.fulfill({ contentType: "application/json", body: '{"status":"resolved"}' })
  })
  await page.goto("/quiz?return=ready")
  const dialog = page.getByRole("dialog", { name: "Du hast das Quiz schon gemacht." })
  await expect(dialog).toBeVisible()
  const bounds = await dialog.boundingBox()
  expect(bounds).not.toBeNull()
  expect(bounds!.x).toBeGreaterThanOrEqual(0)
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390)
  await expect(dialog.getByRole("button", { name: "Mit meinen Antworten weiter" })).toBeInViewport()
  await expect(dialog.getByRole("button", { name: "Antworten bearbeiten" })).toBeInViewport()
  await page.screenshot({ path: testInfo.outputPath("return-dialog-mobile.png") })
})

test("a link revoked while the prompt is open releases the ordinary quiz", async ({ page }) => {
  await page.route("**/api/quiz/email-return/context", async (route) => {
    await route.fulfill({ contentType: "application/json", body: '{"status":"resolved"}' })
  })
  await page.route("**/api/quiz/email-return/choose", async (route) => {
    await route.fulfill({
      status: 410,
      contentType: "application/json",
      body: '{"status":"invalid"}',
    })
  })
  await page.goto("/quiz?return=ready")
  const dialog = page.getByRole("dialog", { name: "Du hast das Quiz schon gemacht." })
  await expect(dialog).toBeVisible()
  await dialog.getByRole("button", { name: "Mit meinen Antworten weiter" }).click()
  await expect(dialog).toHaveCount(0)
  await expect(
    page.getByRole("heading", { name: "Welche Haarstruktur haben die meisten deiner Haare?" }),
  ).toBeVisible()
  await expect(page.getByRole("status")).toContainText(
    "Deine gespeicherten Antworten konnten über diesen Link nicht geöffnet werden.",
  )
  await expect(page).toHaveURL(/\/quiz\?return=invalid$/)
})

test("Edit prefills the existing name and email screens and reuses same-address consent", async ({
  page,
  baseURL,
}) => {
  if (!baseURL) throw new Error("Playwright baseURL is required")
  let submitted: Record<string, unknown> | null = null
  await page.route("**/api/quiz/lead", async (route) => {
    submitted = route.request().postDataJSON() as Record<string, unknown>
    await route.fulfill({ contentType: "application/json", body: '{"leadId":"lead-returned"}' })
  })
  await openReturnedLeadCapture(page, baseURL)

  const name = page.getByPlaceholder("Dein Vorname")
  await expect(name).toHaveValue("Nick")
  await page.getByRole("button", { name: "Weiter zum Ergebnis" }).click()
  const email = page.getByPlaceholder("name@beispiel.de")
  await expect(email).toHaveValue("nick@example.com")
  await page.getByRole("button", { name: "Weiter", exact: true }).click()

  await expect.poll(() => submitted).not.toBeNull()
  expect(submitted).toMatchObject({
    name: "Nick",
    email: "nick@example.com",
    marketingConsent: true,
    marketingConsentSource: "inherited",
  })
  await expect(page.getByText("Dürfen wir dir Haarpflege-Tipps schicken?")).toHaveCount(0)
})

test("Edit asks the existing consent question when the prefilled email changes", async ({
  page,
  baseURL,
}) => {
  if (!baseURL) throw new Error("Playwright baseURL is required")
  let submitted = false
  await page.route("**/api/quiz/lead", async (route) => {
    submitted = true
    await route.fulfill({ contentType: "application/json", body: '{"leadId":"unexpected"}' })
  })
  await openReturnedLeadCapture(page, baseURL)

  await page.getByRole("button", { name: "Weiter zum Ergebnis" }).click()
  const email = page.getByPlaceholder("name@beispiel.de")
  await email.fill("new@example.com")
  await page.getByRole("button", { name: "Weiter", exact: true }).click()

  await expect(page.getByText("Dürfen wir dir Haarpflege-Tipps schicken?")).toBeVisible()
  expect(submitted).toBe(false)
})

test("Edit remains completable through normal identity screens when prefill is unavailable", async ({
  page,
  baseURL,
}) => {
  if (!baseURL) throw new Error("Playwright baseURL is required")
  await openReturnedLeadCapture(page, baseURL, { status: "unavailable" })

  await expect(page.getByPlaceholder("Dein Vorname")).toHaveValue("")
  await expect(page.getByRole("button", { name: "Weiter zum Ergebnis" })).toBeDisabled()
})
