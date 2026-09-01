import { expect, test } from "@playwright/test"

const completeAnswers = {
  structure: "wavy",
  thickness: "normal",
  density: "medium",
  hair_length: "long",
  fingertest: "rau",
  pulltest: "stretches_bounces",
  scalp_type: "ausgeglichen",
  has_scalp_issue: false,
  concerns: ["frizz", "dryness"],
  treatment: ["natur"],
  goals: ["less_frizz", "shine"],
}

async function seedFinalQuestionDraft(page: import("@playwright/test").Page) {
  await page.addInitScript((answers) => {
    window.localStorage.setItem(
      "chaarlie_cookie_consent_v1",
      JSON.stringify({ essential: true, analytics: false, marketing: false, ts: Date.now() }),
    )
    window.localStorage.setItem(
      "chaarlie:quiz-draft:v1",
      JSON.stringify({ version: 1, savedAt: Date.now(), step: 12, answers }),
    )
  }, completeAnswers)
}

test("creator invitation stays personal and lets the recipient correct the email", async ({
  page,
}) => {
  await page.goto("/labs/partner-access", { waitUntil: "domcontentloaded" })

  await expect(page.getByRole("heading", { name: "Hi Lea, dein Zugang ist bereit." })).toBeVisible()
  await expect(page.getByText("lea@studio-example.de", { exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: "Los geht’s" })).toBeVisible()
  await expect(
    page.getByText("Damit erstellst du dein Chaarlie Konto mit dieser E-Mail.", { exact: true }),
  ).toBeVisible()

  await page.getByRole("button", { name: "Nicht deine E-Mail? Ändern" }).click()
  await expect(page.getByRole("heading", { name: "E-Mail ändern" })).toBeVisible()
  await expect(
    page.getByText("Wir senden dir einen Bestätigungslink.", { exact: true }),
  ).toBeVisible()
  await expect(page.getByLabel("E-Mail", { exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: "Bestätigungslink senden" })).toBeVisible()

  await page.getByRole("button", { name: "Abbrechen" }).click()
  await expect(page.getByRole("button", { name: "Los geht’s" })).toBeVisible()
})

test("creator invite and activation card fit a narrow phone viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })

  await page.goto("/labs/partner-access", { waitUntil: "domcontentloaded" })
  await expect(page.getByRole("button", { name: "Los geht’s" })).toBeVisible()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true)

  await page.goto("/labs/offer-page?scenario=partner", { waitUntil: "domcontentloaded" })
  await expect(page.getByRole("heading", { name: "Dein Zugang ist bereit." })).toBeVisible()
  await expect(page.getByRole("button", { name: "Meinen Plan öffnen" })).toHaveCount(3)
  await expect(page.getByText("Für dich kostenlos", { exact: true })).toHaveCount(0)
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true)
})

test("@ci verified creator skips duplicate identity and Back returns to the final question", async ({
  page,
}) => {
  await seedFinalQuestionDraft(page)
  await page.route("**/api/partner-access/quiz-context", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      status: 200,
      body: JSON.stringify({
        status: "creator",
        name: "Lea Sommer",
        email: "lea@example.test",
      }),
    })
  })

  await page.goto("/quiz?partner=1", { waitUntil: "networkidle" })
  await expect(page.getByRole("heading", { name: /Was wünschst du dir/ })).toBeVisible()
  await page.getByRole("button", { name: /Weiter$/ }).click()

  await expect(
    page.getByRole("heading", { name: "Dürfen wir dir Haarpflege-Tipps schicken?" }),
  ).toBeVisible()
  await expect(page.getByPlaceholder("Dein Vorname")).toHaveCount(0)
  await expect(page.getByPlaceholder("name@beispiel.de")).toHaveCount(0)

  await page.getByRole("button", { name: "Zurück" }).click()
  await expect(page.getByRole("heading", { name: /Was wünschst du dir/ })).toBeVisible()
})

test("@ci ordinary quiz keeps its existing name and email sequence", async ({ page }) => {
  await seedFinalQuestionDraft(page)
  let creatorContextRequests = 0
  await page.route("**/api/partner-access/quiz-context", async (route) => {
    creatorContextRequests += 1
    await route.abort()
  })

  await page.goto("/quiz", { waitUntil: "networkidle" })
  await page.getByRole("button", { name: /Weiter$/ }).click()

  await expect(page.getByPlaceholder("Dein Vorname")).toBeVisible()
  await page.getByPlaceholder("Dein Vorname").fill("Lea")
  await page.getByRole("button", { name: "Weiter zum Ergebnis" }).click()
  await expect(page.getByPlaceholder("name@beispiel.de")).toBeVisible()
  expect(creatorContextRequests).toBe(0)
})
