import { expect, test, type Page } from "@playwright/test"

const draft = {
  version: 4,
  screen: "plan_loading",
  history: ["texture", "hair_length", "goals"],
  answers: { texture: "wavy", hairLength: "medium", goals: ["moisture"] },
}

async function installDraft(page: Page, savedDraft = draft) {
  await page.route("**/api/funnel/session", (route) =>
    route.fulfill({
      contentType: "application/json",
      status: 200,
      body: JSON.stringify({ enabled: false, funnelPackageKey: null, funnelSessionId: null }),
    }),
  )
  await page.route("**/api/quiz/personal-plan-draft", (route) =>
    route.fulfill({ contentType: "application/json", status: 404, body: "{}" }),
  )
  await page.addInitScript((storedDraft) => {
    window.localStorage.setItem(
      "chaarlie_cookie_consent_v1",
      JSON.stringify({ essential: true, analytics: false, marketing: false, ts: Date.now() }),
    )
    window.localStorage.setItem("chaarlie:personal-plan-quiz-draft:v4", JSON.stringify(storedDraft))
  }, savedDraft)
}

test("the real browser preparation client sends and stores its replay-safe claim", async ({
  page,
}) => {
  const requests: Array<Record<string, unknown>> = []
  await installDraft(page)
  await page.route("**/api/quiz/personal-plan-prepare", async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>
    requests.push(body)
    await route.fulfill({
      contentType: "application/json",
      status: 200,
      body: JSON.stringify({
        artifactId: body.preparationId,
        claimToken: body.claimToken,
        expiresAt: "2099-01-01T00:00:00.000Z",
        status: "ready",
      }),
    })
  })
  await page.goto("/lp/haarplan")
  await expect.poll(() => requests.length).toBe(1)
  expect(requests[0].preparationId).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  )
  expect(requests[0].claimToken).toMatch(/^[A-Za-z0-9_-]{43}$/)
  await expect
    .poll(() =>
      page.evaluate(() => window.sessionStorage.getItem("chaarlie:personal-plan-quiz-prepared:v1")),
    )
    .not.toBeNull()
  expect(
    await page.evaluate(() =>
      window.sessionStorage.getItem("chaarlie:personal-plan-pending-preparation:v1"),
    ),
  ).toBeNull()
})

test("a replay conflict self-heals once with a fresh credential", async ({ page }) => {
  const requests: Array<Record<string, unknown>> = []
  await installDraft(page, {
    ...draft,
    screen: "email_capture",
    history: ["texture", "daily_time", "plan_loading"],
  })
  await page.route("**/api/quiz/personal-plan-prepare", async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>
    requests.push(body)
    if (requests.length === 1) {
      await route.fulfill({ contentType: "application/json", status: 409, body: "{}" })
      return
    }
    await route.fulfill({
      contentType: "application/json",
      status: 200,
      body: JSON.stringify({
        artifactId: body.preparationId,
        claimToken: body.claimToken,
        expiresAt: "2099-01-01T00:00:00.000Z",
        status: "ready",
      }),
    })
  })

  await page.goto("/lp/haarplan")
  await expect.poll(() => requests.length).toBe(2)
  expect(requests[1].preparationId).not.toBe(requests[0].preparationId)
  await expect(page.getByRole("button", { name: "Vorbereitung erneut versuchen" })).toHaveCount(0)
  await expect
    .poll(() =>
      page.evaluate(() => window.sessionStorage.getItem("chaarlie:personal-plan-quiz-prepared:v1")),
    )
    .not.toBeNull()
})

test("a reload after lost responses reuses the same pending credential", async ({ page }) => {
  const requests: Array<Record<string, unknown>> = []
  await installDraft(page, {
    ...draft,
    screen: "email_capture",
    history: ["texture", "daily_time", "plan_loading"],
  })
  await page.route("**/api/quiz/personal-plan-prepare", async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>
    requests.push(body)
    if (requests.length <= 2) {
      await route.abort("failed")
      return
    }
    await route.fulfill({
      contentType: "application/json",
      status: 200,
      body: JSON.stringify({
        artifactId: body.preparationId,
        claimToken: body.claimToken,
        expiresAt: "2099-01-01T00:00:00.000Z",
        status: "ready",
      }),
    })
  })

  await page.goto("/lp/haarplan")
  await expect(page.getByRole("button", { name: "Vorbereitung erneut versuchen" })).toBeVisible()
  await page.reload()
  await expect.poll(() => requests.length).toBe(3)
  expect(requests.map((request) => request.preparationId)).toEqual([
    requests[0].preparationId,
    requests[0].preparationId,
    requests[0].preparationId,
  ])
  expect(requests.map((request) => request.claimToken)).toEqual([
    requests[0].claimToken,
    requests[0].claimToken,
    requests[0].claimToken,
  ])
  await expect
    .poll(() =>
      page.evaluate(() => window.sessionStorage.getItem("chaarlie:personal-plan-quiz-prepared:v1")),
    )
    .not.toBeNull()
})
