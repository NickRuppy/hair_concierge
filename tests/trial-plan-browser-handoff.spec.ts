import { expect, test } from "@playwright/test"

import { scenario } from "./auth-middleware-trial-plan-handoff.fixtures"
import {
  PLAN_START_LAB_PATH,
  planStartExpectedSeenRoles,
  planStartPreviewResponse,
} from "./personal-plan-start-preview.fixtures"

// Isolated boundary test: real plan UI -> real middleware -> destination marker.
// Auth/database and acceptance persistence are fixtures. This does not claim a
// live checkout, rendered server-side Routine page, or production-session test.
for (const provider of ["stripe", "paypal"] as const) {
  test(`${provider} trial: base and optional recommendations enter the routine without legacy onboarding`, async ({
    page,
  }) => {
    const fixture = scenario({ provider })
    const admissions: Array<{ path: string; status: number; location: string | null }> = []
    await page.addInitScript(() => {
      window.localStorage.setItem(
        "chaarlie_cookie_consent_v1",
        JSON.stringify({
          essential: true,
          analytics: false,
          marketing: false,
          ts: Date.now(),
        }),
      )
    })
    await page.route("**/api/personal-plan/stage-1/previews?*", (route) =>
      route.fulfill({
        json: planStartPreviewResponse,
      }),
    )
    await page.route("**/api/personal-plan/accept-ideal-plan", async (route) => {
      expect(route.request().postDataJSON().seenRoles).toEqual(planStartExpectedSeenRoles)
      await route.fulfill({ json: { status: "accepted", next: { stage: 4, href: "/routine" } } })
    })
    await page.route(
      (url) => ["/routine", "/anwendung", "/onboarding"].includes(url.pathname),
      async (route) => {
        const path = new URL(route.request().url()).pathname
        if (path === "/onboarding") {
          await route.fulfill({
            contentType: "text/html; charset=utf-8",
            body: "<h1>Legacy onboarding — regression</h1>",
          })
          return
        }
        const response = await fixture.request(path)
        const location = response.headers.get("location")
        admissions.push({ path, status: response.status, location })
        if (location) {
          await route.fulfill({
            status: response.status,
            headers: { location: new URL(location).pathname },
          })
          return
        }
        await route.fulfill({
          status: response.status,
          contentType: "text/html; charset=utf-8",
          body: `<html lang="de"><body><h1>${path === "/routine" ? "Routine-Zugang bestätigt" : "Anwendungs-Zugang bestätigt"}</h1><a href="/anwendung">Zur Anwendung</a></body></html>`,
        })
      },
    )
    await page.setViewportSize({ width: 375, height: 844 })
    await page.goto(PLAN_START_LAB_PATH)
    await expect(page.getByRole("heading", { name: "Deine Basis" })).toBeVisible()
    await page.getByRole("button", { name: "Optionale Empfehlungen" }).click()
    await expect(page.getByRole("heading", { name: "Zusätzlich sinnvoll" })).toBeVisible()
    await page.getByRole("button", { name: "Zu deiner Routine" }).click()
    await expect(page.getByRole("heading", { name: "Routine-Zugang bestätigt" })).toBeVisible()
    await page.reload()
    await expect(page.getByRole("heading", { name: "Routine-Zugang bestätigt" })).toBeVisible()
    await page.getByRole("link", { name: "Zur Anwendung" }).click()
    await expect(page.getByRole("heading", { name: "Anwendungs-Zugang bestätigt" })).toBeVisible()
    expect(admissions).toEqual([
      { path: "/routine", status: 200, location: null },
      { path: "/routine", status: 200, location: null },
      { path: "/anwendung", status: 200, location: null },
    ])
  })
}
