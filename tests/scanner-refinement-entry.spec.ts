import { gunzipSync } from "node:zlib"
import { expect, test, type Page } from "@playwright/test"

// PostHog suppresses HeadlessChrome as bot traffic; transport is fully intercepted below.
test.use({
  userAgent:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
})

const refinementEnabled = process.env.SCANNER_FUNNEL_REFINEMENT_ENABLED === "true"

async function isolateQuizStartTelemetry(page: Page, failFirstContext = false) {
  let contextRequests = 0
  await page.route("**/api/funnel/session", async (route) => {
    if (route.request().method() === "GET") {
      contextRequests += 1
      if (failFirstContext && contextRequests === 1) {
        await route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({
            enabled: true,
            funnelPackageKey: "scan_v1",
            funnelSessionId: "isolated-entry-session",
            analyticsContextReady: false,
          }),
        })
        return
      }
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          enabled: true,
          analyticsContextReady: true,
          entryPath: "/lp/scan",
          funnelPackageKey: "scan_v1",
          funnelSessionId: "isolated-entry-session",
          issuedAt: Date.parse("2026-09-15T09:30:00.000Z"),
          utmCampaign: "scanner-entry",
          utmSource: "instagram",
        }),
      })
      return
    }
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        funnelSessionId: "isolated-entry-session",
        funnelPackageKey: "scan_v1",
      }),
    })
  })
}

async function capturePostHog(page: Page) {
  const payloads: Record<string, unknown>[] = []
  const applicationOrigin = new URL(process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000")
    .origin
  await page.route("**/*", async (route) => {
    const raw = route.request().postDataBuffer()
    const body =
      raw?.[0] === 0x1f && raw?.[1] === 0x8b ? gunzipSync(raw).toString() : raw?.toString()
    let isAnalyticsBatch = false
    if (body) {
      try {
        const decoded = JSON.parse(body)
        for (const event of Array.isArray(decoded)
          ? decoded
          : (decoded.batch ?? (decoded.event ? [decoded] : []))) {
          if (event.properties) payloads.push(event)
          if (event.event === "scanner_quiz_viewed") isAnalyticsBatch = true
        }
      } catch {
        // SDK bootstrap requests are intentionally inert in this local-only capture.
      }
    }
    const isVendor = new URL(route.request().url()).origin !== applicationOrigin
    if (isVendor || isAnalyticsBatch) {
      await route.fulfill({ contentType: "application/json", body: "{}" })
      return
    }
    await route.fallback()
  })
  return payloads
}

test.describe("scanner refinement attributed quiz entry", () => {
  test.skip(
    !refinementEnabled,
    "requires SCANNER_FUNNEL_REFINEMENT_ENABLED=true in the server under test",
  )

  let postHogPayloads: Record<string, unknown>[] = []
  test.beforeEach(async ({ page }) => {
    // Every test blocks vendor traffic and the browser milestone write endpoint.
    postHogPayloads = await capturePostHog(page)
    await isolateQuizStartTelemetry(page)
  })

  test("/lp/scan retains its scanner session and campaign while redirecting straight to quiz", async ({
    page,
  }) => {
    // Proxy cookies and the APIRequestContext GET below are real;
    // browser telemetry uses the isolated context fixture.
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
    expect(context).toMatchObject({
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
      entryPath: "/lp/scan",
      utmSource: "instagram",
      utmCampaign: "scanner-entry",
      fbclid: "click-1",
    })
  })

  test("prefetch does not consume attribution before the real navigation", async ({ page }) => {
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

  test("scanner quiz sends an attributed page event to the intercepted PostHog transport", async ({
    page,
  }) => {
    test.skip(
      process.env.NEXT_PUBLIC_ENABLE_LOCAL_VENDOR_ANALYTICS !== "true",
      "requires local vendor analytics enabled in both the server and test process; all transport is intercepted",
    )
    await isolateQuizStartTelemetry(page, true)
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => false })
      Object.defineProperty(navigator, "userAgentData", { get: () => undefined })
      window.localStorage.setItem(
        "chaarlie_cookie_consent_v1",
        JSON.stringify({ essential: true, analytics: true, marketing: false, ts: Date.now() }),
      )
    })
    await page.goto("/lp/scan?utm_source=instagram&utm_campaign=scanner-entry&fbclid=click-1")
    await expect(page.getByRole("note")).toContainText("Damit der Scanner zu deinem Haar passt.")
    await expect
      .poll(() => postHogPayloads.find((event) => event.event === "scanner_quiz_viewed"), {
        timeout: 25000,
      })
      .toMatchObject({
        event: "scanner_quiz_viewed",
        properties: expect.objectContaining({
          entry_path: "/lp/scan",
          funnel_package_key: "scan_v1",
          is_resumed: false,
          quiz_step: 2,
          scanner_tracking_version: 1,
          utm_campaign: "scanner-entry",
          utm_source: "instagram",
        }),
      })
  })
})
