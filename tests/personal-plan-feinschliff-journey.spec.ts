import { expect, test } from "@playwright/test"

import {
  PLAN_START_LAB_PATH,
  planStartExpectedSeenRoles,
  planStartPreviewResponse,
} from "./personal-plan-start-preview.fixtures"

/**
 * The Feinschliff-Einstieg journey, driven end to end as far as the harness
 * honestly reaches.
 *
 * The full journey is: accept the Idealplan → Routine (refinement banner) →
 * module "products" → Stage 3 → back to the Routine ("Plan aktualisiert" toast)
 * → module "habits" → completion → 4/4 status with the banner gone.
 *
 * It cannot be one uninterrupted browser spec today, and the reason is a single
 * surface: **the Routine is the connective tissue of every hop, and it is not
 * drivable from a lab.** `/routine` (`src/app/routine/page.tsx`) is a server
 * component that resolves its banner from `loadRefinementStatusForUser` through
 * an admin Supabase client, behind `loadAuthenticatedAppNavigationAccess`; the
 * module deep links it emits land on `/plan-start`
 * (`src/app/plan-start/page.tsx`), which returns `unavailable` without a
 * `getUserId()`. Neither read happens in the browser, so `page.route` cannot
 * stand in for them, and no `src/app/labs/*` harness renders either surface.
 * Driving them for real needs `LOCAL_DEV_LOGIN_ENABLED=1` plus a seeded plan in
 * the live Supabase project — a production write path, and nothing CI has.
 *
 * So the chain below is the longest contiguous one that exists: the Idealplan
 * accept, from the first paint through the seen-state payload to the Routine
 * handoff. What follows it is covered surface by surface instead — the banner
 * and toast in `personal-plan-stage4-ui.test.tsx`, the module entries and their
 * Stage-3 handoff in `personal-plan-stage2-refinement.spec.ts` and
 * `personal-plan-stage1-2-3.spec.ts`, the 4/4 status in
 * `personal-plan/refinement/refinement-status.test.ts`. Stitching those into
 * one spec would mean re-mounting a different fixture between hops, i.e.
 * inventing continuity the product does not have here.
 */
test.describe("Feinschliff-Einstieg journey", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem(
        "chaarlie_cookie_consent_v1",
        JSON.stringify({ essential: true, analytics: false, marketing: false, ts: Date.now() }),
      )
    })
  })

  test("accepting the Idealplan waits for its previews and then hands the Routine every role", async ({
    page,
  }) => {
    let releasePreviews = () => {}
    const previewsReleased = new Promise<void>((resolve) => {
      releasePreviews = resolve
    })
    await page.route("**/api/personal-plan/stage-1/previews?*", async (route) => {
      await previewsReleased
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(planStartPreviewResponse),
      })
    })
    const acceptedSeenRoles: unknown[] = []
    await page.route("**/api/personal-plan/accept-ideal-plan", (route) => {
      acceptedSeenRoles.push(JSON.parse(route.request().postData() ?? "{}").seenRoles)
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ status: "accepted", next: { stage: 4, href: "/routine" } }),
      })
    })
    // The Routine itself is out of reach (see the note above); this stands in
    // for it only to prove where the accept actually lands.
    await page.route(
      (url) => url.pathname === "/routine",
      (route) =>
        route.fulfill({
          status: 200,
          contentType: "text/html",
          body: "<html lang='de'><body><h1>Deine Routine</h1></body></html>",
        }),
    )

    await page.setViewportSize({ width: 375, height: 844 })
    await page.goto(PLAN_START_LAB_PATH)
    await expect(page.getByRole("heading", { name: "Deine Basis" })).toBeVisible()
    await page.getByRole("button", { name: "Optionale Empfehlungen" }).click()
    await expect(page.getByRole("heading", { name: "Zusätzlich sinnvoll" })).toBeVisible()

    // B1. The previews ARE the accept payload, so the CTA stays held for as long
    // as they are in flight — including the very first paint, before the effect
    // that fetches them has run.
    const acceptCta = page.getByRole("button", { name: "Zu deiner Routine" })
    await expect(acceptCta).toBeDisabled()
    await expect(acceptCta).toHaveAttribute("aria-busy", "true")
    // Even a click the browser would never deliver to a disabled button must not
    // reach the server: the handler re-derives readiness from the same fact.
    await acceptCta.dispatchEvent("click")
    expect(acceptedSeenRoles).toEqual([])

    releasePreviews()
    await expect(acceptCta).toBeEnabled()
    await expect(acceptCta).toHaveAttribute("aria-busy", "false")
    await acceptCta.click()

    await expect.poll(() => acceptedSeenRoles.length).toBe(1)
    expect(acceptedSeenRoles[0]).toEqual(planStartExpectedSeenRoles)
    expect(planStartExpectedSeenRoles.length).toBeGreaterThan(0)
    await expect(page.getByRole("heading", { name: "Deine Routine" })).toBeVisible()
  })
})
