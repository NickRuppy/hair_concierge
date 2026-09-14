import { expect, test, type Page } from "@playwright/test"

const refinementEnabled = process.env.SCANNER_FUNNEL_REFINEMENT_ENABLED === "true"

async function isolateQuizStartTelemetry(page: Page) {
  await page.route("**/api/funnel/session", async (route) => {
    if (route.request().method() !== "POST") return route.continue()
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        funnelSessionId: "isolated-entry-session",
        funnelPackageKey: "scan_v1",
      }),
    })
  })
}

test.describe("scanner refinement attributed quiz entry", () => {
  test.skip(
    !refinementEnabled,
    "requires SCANNER_FUNNEL_REFINEMENT_ENABLED=true in the server under test",
  )

  test("/lp/scan retains its scanner session and campaign while redirecting straight to quiz", async ({
    page,
  }) => {
    // The browser's quiz-start telemetry is exercised by this navigation, but
    // this entry contract has no local persistence fixture. Keep it non-live:
    // the proxy cookie and the GET below remain real, while the write-only
    // milestone endpoint is isolated.
    await isolateQuizStartTelemetry(page)
    await page.goto("/lp/scan?utm_source=instagram&utm_campaign=scanner-entry&fbclid=click-1")

    await expect(page).toHaveURL(
      /\/quiz\?utm_source=instagram&utm_campaign=scanner-entry&fbclid=click-1$/,
    )
    await expect(page.getByRole("note")).toContainText("Damit der Scanner zu deinem Haar passt.")
    await expect(page.getByRole("note")).toContainText("10 kurze Fragen · ca. 2 Minuten")
    await expect(page.getByRole("button", { name: "Zurück" })).toHaveCount(0)

    const contextResponse = await page.request.get("/api/funnel/session")
    await expect(contextResponse).toBeOK()
    const context = await contextResponse.json()
    expect(context).toEqual({
      enabled: true,
      funnelPackageKey: "scan_v1",
      funnelSessionId: expect.any(String),
    })
    const cookies = await page.context().cookies()
    const touch = cookies.find((cookie) => cookie.name === "chaarlie_funnel_touch")
    expect(touch).toBeDefined()
    const payload = JSON.parse(
      Buffer.from(touch!.value.split(".")[0], "base64url").toString(),
    ).payload
    expect(payload).toMatchObject({
      sessionId: context.funnelSessionId,
      entryPath: "/lp/scan",
      utmSource: "instagram",
      utmCampaign: "scanner-entry",
      fbclid: "click-1",
    })
  })

  test("prefetch does not consume attribution before the real navigation", async ({ page }) => {
    await isolateQuizStartTelemetry(page)
    test.setTimeout(45000)
    const prefetch = await page.request.get("/lp/scan?utm_source=instagram&utm_campaign=prefetch", {
      timeout: 15000,
      maxRedirects: 0,
      headers: { purpose: "prefetch" },
    })
    expect(prefetch.status()).toBe(307)
    expect(
      (await page.context().cookies()).some((cookie) => cookie.name === "chaarlie_funnel_session"),
    ).toBe(false)
    await page.goto("/lp/scan?utm_source=instagram&utm_campaign=prefetch")
    await expect(page.getByRole("note")).toContainText("Damit der Scanner zu deinem Haar passt.")
    const response = await page.request.get("/api/funnel/session")
    expect(await response.json()).toMatchObject({ enabled: true, funnelPackageKey: "scan_v1" })
  })

  test("a saved scanner draft resumes without the entry explainer and keeps later back navigation", async ({
    page,
  }) => {
    await isolateQuizStartTelemetry(page)
    await page.addInitScript(() => {
      window.localStorage.setItem(
        "chaarlie:quiz-draft:v1",
        JSON.stringify({
          version: 2,
          savedAt: Date.now(),
          step: 3,
          answers: { structure: "wavy" },
          funnelPackageKey: "scan_v1",
        }),
      )
    })

    await page.goto("/lp/scan?utm_source=instagram&utm_campaign=scanner-resume")

    await expect(page.getByText("2/10", { exact: true })).toBeVisible()
    await expect(page.getByRole("note")).toHaveCount(0)
    await page.getByRole("button", { name: "Zurück" }).click()
    await expect(page.getByText("1/10", { exact: true })).toBeVisible()
    await expect(page.getByRole("note")).toContainText("Damit der Scanner zu deinem Haar passt.")
  })
})
