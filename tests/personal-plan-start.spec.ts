import { expect, test } from "@playwright/test"

import { prepareStage3EntryContextForLab } from "../src/app/labs/personal-plan-stage-1-2/integration"
import { createStage2RefinementSession } from "../src/lib/personal-plan/refinement/session"

import {
  PLAN_START_LAB_PATH,
  PLAN_START_LAB_PERSONAL_PLAN_ID,
  planStartLabOptionalCategories,
  planStartLabSnapshot,
  planStartPreviewResponse,
} from "./personal-plan-start-preview.fixtures"

const labPath = PLAN_START_LAB_PATH
const productionCompositionLabPath = `${labPath}?scenario=production-composition`
const personalPlanId = PLAN_START_LAB_PERSONAL_PLAN_ID
const refinedVersionId = "30000000-0000-4000-8000-000000000001"
const productDraftId = "40000000-0000-4000-8000-000000000001"

const previewResponse = planStartPreviewResponse
const optionalCategories = planStartLabOptionalCategories

const completedRefinement = createStage2RefinementSession({
  pathVersion: "stage2-fixture-v1",
  triggerContext: {
    relevantCategories: [
      "shampoo",
      "conditioner",
      "leave_in",
      "oil",
      "mask",
      "bondbuilder",
      "deep_cleansing_shampoo",
    ],
    hasReportedIrritatedScalp: true,
    dryShampooBridgeEligibility: "eligible",
  },
  answers: {
    currentProductCategories: ["shampoo", "conditioner", "oil"],
    wetWashFrequency: "weekly_2x",
    scalpIrritationDetail: "mild_sensitive_or_itchy",
    dryShampooBridgePreference: "accept",
    dryShampooVisibleHairColor: "dark",
    oilPurposes: ["dry_finish"],
    towel: { material: "mikrofaser", technique: "gentle_press" },
    dryingRoutes: ["ordinary_blow_dry"],
    additionalHeatTools: ["straightener"],
    heatEvents: {
      "heat:ordinary_blow_dry": { frequency: "weekly_2x" },
      "heat:straightener": { frequency: "monthly_1x", protectionConsistency: "always" },
    },
    nightProtection: [],
  },
  completedQuestionIds: [
    "current_product_categories",
    "wet_wash_frequency",
    "scalp_irritation_detail",
    "dry_shampoo_bridge_preference",
    "dry_shampoo_visible_hair_color",
    "oil_purposes",
    "towel_handling",
    "drying_routes",
    "additional_heat_tools",
    "heat:ordinary_blow_dry",
    "heat:straightener",
    "night_protection",
  ],
  revision: 12,
  status: "complete",
  completedHandoff: { refinedVersionId, nextHref: "/plan-start" },
})
const preparedStage3Entry = prepareStage3EntryContextForLab({
  session: completedRefinement,
  handoff: completedRefinement.completedHandoff!,
}).entryContext
if (!preparedStage3Entry.authoritySnapshot)
  throw new Error("production browser fixture is missing Stage 3 authority")

test.describe("production-shaped Personal Plan Stage 1 surface", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem(
        "chaarlie_cookie_consent_v1",
        JSON.stringify({ essential: true, analytics: false, marketing: false, ts: Date.now() }),
      )
    })
  })

  test("preserves the signed mobile Basis and Optional journey and accepts into the routine", async ({
    page,
  }) => {
    const requestedImages = new Set<string>()
    const acceptedSeenRoles: unknown[] = []
    await page.route("**/api/personal-plan/accept-ideal-plan", (route) => {
      acceptedSeenRoles.push(JSON.parse(route.request().postData() ?? "{}").seenRoles)
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ status: "accepted", next: { stage: 4, href: "/routine" } }),
      })
    })
    await page.route("**/routine", (route) =>
      route.fulfill({
        status: 200,
        contentType: "text/html",
        body: "<html lang='de'><body><h1>Deine Routine</h1></body></html>",
      }),
    )
    await page.route("**/api/personal-plan/stage-1/previews?*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(previewResponse),
      }),
    )
    await page.route("**/labs/product-images/*.svg", (route) => {
      const category = new URL(route.request().url()).pathname.split("/").pop()?.replace(".svg", "")
      if (category) requestedImages.add(category)
      return route.fulfill({
        status: 200,
        contentType: "image/svg+xml",
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="56" height="140" viewBox="0 0 56 140"><rect x="14" y="4" width="28" height="132" rx="9" fill="#6b50a0"/><rect x="18" y="28" width="20" height="70" rx="4" fill="#f5efff"/></svg>',
      })
    })
    const freshRefinement = createStage2RefinementSession({
      pathVersion: "stage2-fixture-v1",
      triggerContext: completedRefinement.triggerContext,
    })
    let stage2Requests = 0
    await page.route("**/api/personal-plan/stage-2", (route) => {
      stage2Requests += 1
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(freshRefinement),
      })
    })
    await page.setViewportSize({ width: 375, height: 844 })
    await page.goto(labPath)

    await expect(page.getByRole("heading", { name: "Deine Basis" })).toBeVisible()
    // Quantify over card entries, not `<article>` elements: a same-tier role
    // group renders one shared `<article>` shell for several entries, so
    // entry count and article count can legitimately diverge. Every entry —
    // standalone or a group member — still carries its own
    // `data-plan-start-card` hook and its own preview state.
    const basisCards = page.locator("[data-plan-start-card-list] [data-plan-start-card]")
    await expect(basisCards).not.toHaveCount(0)
    await expect(
      page.locator(
        '[data-plan-start-card-list] [data-plan-start-card][data-plan-start-card-preview="example"]',
      ),
    ).toHaveCount(await basisCards.count())
    await expect
      .poll(() => optionalCategories.every((category) => requestedImages.has(category)))
      .toBe(true)
    await basisCards.first().getByRole("button").click()
    const detailSheet = page.getByRole("dialog")
    await expect(detailSheet.getByText("Warum das zu deinem Haar passt")).toBeVisible()
    await page.keyboard.press("Escape")
    await expect(detailSheet).toHaveCount(0)
    await page.getByRole("button", { name: "Optionale Empfehlungen" }).click()
    await page.waitForTimeout(100)
    const actionNav = page.getByRole("navigation", { name: "Plan-Seiten" })
    await expect(actionNav).toHaveCount(1)
    expect(
      await actionNav.evaluate((element) => ({
        parent: element.parentElement?.tagName,
        bottom: Math.round(element.getBoundingClientRect().bottom),
        viewportBottom: window.innerHeight,
      })),
    ).toEqual({ parent: "BODY", bottom: 844, viewportBottom: 844 })
    await expect(page.getByRole("heading", { name: "Zusätzlich sinnvoll" })).toBeVisible()
    // Same entry-based counting as the Basis assertion above.
    const optionalCards = page.locator("[data-plan-start-card-list] [data-plan-start-card]")
    await expect(
      page.locator(
        '[data-plan-start-card-list] [data-plan-start-card][data-plan-start-card-preview="example"]',
      ),
    ).toHaveCount(await optionalCards.count())
    const loadedSlot = optionalCards.first().locator('[data-plan-start-card-image-slot="loaded"]')
    const loadedImage = loadedSlot.locator("img")
    await expect(loadedImage).toBeVisible()
    const imageGeometry = await loadedImage.evaluate((image) => {
      const slot = image.parentElement!.getBoundingClientRect()
      const bounds = image.getBoundingClientRect()
      return {
        complete: (image as HTMLImageElement).complete,
        naturalHeight: (image as HTMLImageElement).naturalHeight,
        naturalWidth: (image as HTMLImageElement).naturalWidth,
        objectFit: getComputedStyle(image).objectFit,
        imageBounds: [bounds.left, bounds.top, bounds.right, bounds.bottom],
        slotBounds: [slot.left, slot.top, slot.right, slot.bottom],
        contained:
          bounds.left >= slot.left - 1 &&
          bounds.right <= slot.right + 1 &&
          bounds.top >= slot.top - 1 &&
          bounds.bottom <= slot.bottom + 1,
      }
    })
    expect(imageGeometry).toMatchObject({ complete: true, objectFit: "contain" })
    expect(imageGeometry.contained, JSON.stringify(imageGeometry)).toBe(true)
    expect(imageGeometry.naturalHeight).toBeGreaterThan(imageGeometry.naturalWidth)
    await expect(actionNav.getByRole("button", { name: "Zur Basis" })).toHaveCount(0)
    const headerBack = page.getByRole("button", { name: "Zur Basis" })
    await expect(headerBack).toBeVisible()
    expect(await headerBack.evaluate((button) => button.getBoundingClientRect().width)).toBe(48)
    expect(stage2Requests).toBe(0)
    await expect(page.locator('[data-plan-start-screen="transition"]')).toHaveCount(0)

    // The fork is gone: the last Idealplan page accepts the plan and lands on
    // the routine, without ever touching the Stage-2 gateway.
    await expect(page.getByRole("button", { name: "Auf meine Produkte abstimmen" })).toHaveCount(0)
    await page.getByRole("button", { name: "Zu deiner Routine" }).click()

    await expect.poll(() => acceptedSeenRoles.length).toBe(1)
    // Every previewed role is pinned in the accept payload, exactly as shown.
    expect(acceptedSeenRoles[0]).toEqual(
      previewResponse.previews.map((preview) => ({
        decisionKey: preview.decisionKey,
        productId: preview.productId,
        factFingerprint: preview.factFingerprint,
      })),
    )
    await expect(page.getByRole("heading", { name: "Deine Routine" })).toBeVisible()
    expect(stage2Requests).toBe(0)
  })

  test("keeps the forward-only Optional action inside 320, 375, and 390px viewports", async ({
    page,
  }) => {
    for (const width of [320, 375, 390]) {
      await page.setViewportSize({ width, height: 700 })
      await page.goto(labPath)
      await page.getByRole("button", { name: "Optionale Empfehlungen" }).click()

      const nav = page.getByRole("navigation", { name: "Plan-Seiten" })
      const action = nav.getByRole("button", { name: "Zu deiner Routine" })
      const geometry = await action.evaluate((button) => {
        const bounds = button.getBoundingClientRect()
        const nav = button.closest("nav")!
        const style = getComputedStyle(nav)
        return {
          left: bounds.left,
          right: bounds.right,
          viewportWidth: window.innerWidth,
          navBottom: nav.getBoundingClientRect().bottom,
          viewportBottom: window.innerHeight,
          paddingTop: parseFloat(style.paddingTop),
          paddingBottom: parseFloat(style.paddingBottom),
        }
      })
      expect(geometry.left).toBeGreaterThanOrEqual(0)
      expect(geometry.right).toBeLessThanOrEqual(geometry.viewportWidth)
      expect(geometry.navBottom).toBe(geometry.viewportBottom)
      expect(geometry.paddingTop).toBe(10)
      expect(geometry.paddingBottom).toBeGreaterThanOrEqual(10)
      await expect(nav.getByRole("button")).toHaveCount(1)
    }
  })

  test("adds a non-zero emulated safe-area inset below the Optional action", async ({
    page,
    context,
  }) => {
    const session = await context.newCDPSession(page)
    try {
      await session.send(
        "Emulation.setSafeAreaInsetsOverride" as never,
        {
          insets: { bottom: 34 },
        } as never,
      )
    } catch (error) {
      test.skip(true, `Pinned Chromium does not support safe-area emulation: ${String(error)}`)
      return
    }

    await page.setViewportSize({ width: 320, height: 700 })
    await page.goto(labPath)
    await page.getByRole("button", { name: "Optionale Empfehlungen" }).click()
    const paddingBottom = await page
      .getByRole("navigation", { name: "Plan-Seiten" })
      .evaluate((nav) => parseFloat(getComputedStyle(nav).paddingBottom))
    expect(paddingBottom).toBe(44)
    await session.send(
      "Emulation.setSafeAreaInsetsOverride" as never,
      {
        insets: {},
      } as never,
    )
  })

  test("retains the Bedarfsplan and offers retry when the plan cannot be accepted", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 700 })
    await page.route("**/api/personal-plan/stage-1/previews?*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(previewResponse),
      }),
    )
    let acceptRequests = 0
    await page.route("**/api/personal-plan/accept-ideal-plan", (route) => {
      acceptRequests += 1
      return route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "temporarily_unavailable" }),
      })
    })

    await page.goto(labPath)
    await page.getByRole("button", { name: "Optionale Empfehlungen" }).click()
    expect(acceptRequests).toBe(0)
    await expect(page.getByRole("heading", { name: "Zusätzlich sinnvoll" })).toBeVisible()

    const acceptButton = page.getByRole("button", { name: "Zu deiner Routine" })
    await acceptButton.click()
    await expect.poll(() => acceptRequests).toBe(1)
    await expect(
      page.getByRole("alert").filter({
        hasText: "Das hat nicht geklappt. Versuche es noch einmal.",
      }),
    ).toBeVisible()
    // The Idealplan stays on screen behind the error, so the user can retry
    // without losing their place.
    await expect(page.getByRole("heading", { name: "Zusätzlich sinnvoll" })).toBeVisible()

    await acceptButton.click()
    await expect.poll(() => acceptRequests).toBe(2)
  })

  test("a seen state that cannot converge retries once, then opens the Feinschliff", async ({
    page,
  }) => {
    let previewRequests = 0
    await page.route("**/api/personal-plan/stage-1/previews?*", (route) => {
      previewRequests += 1
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(previewResponse),
      })
    })
    let acceptRequests = 0
    await page.route("**/api/personal-plan/accept-ideal-plan", (route) => {
      acceptRequests += 1
      return route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({ error: "seen_state_stale" }),
      })
    })
    // The refinement re-entry is a real route; stub only that exact path so the
    // lab's own `/labs/personal-plan-start` page keeps rendering.
    await page.route(
      (url) => url.pathname === "/plan-start",
      (route) =>
        route.fulfill({
          status: 200,
          contentType: "text/html",
          body: "<html lang='de'><body><h1>Feinschliff</h1></body></html>",
        }),
    )

    await page.goto(labPath)
    await page.getByRole("button", { name: "Optionale Empfehlungen" }).click()
    await expect.poll(() => previewRequests).toBeGreaterThan(0)
    const previewsBeforeAccept = previewRequests

    await page.getByRole("button", { name: "Zu deiner Routine" }).click()

    // Two accept attempts (the second after one silent preview re-fetch), then
    // the refinement — which reaches an accepted plan too.
    await expect.poll(() => acceptRequests).toBe(2)
    expect(previewRequests).toBe(previewsBeforeAccept + 1)
    await expect(page.getByRole("heading", { name: "Feinschliff" })).toBeVisible()
    expect(new URL(page.url()).search).toBe("?refine=products")
  })

  /**
   * I1. The previews ARE the accept payload. A preview request that fails must
   * never degrade into `{"seenRoles": []}` — that would defer every role the
   * user was just shown.
   */
  test("previews that fail to load open the Feinschliff instead of accepting an empty seen state", async ({
    page,
  }) => {
    let previewRequests = 0
    await page.route("**/api/personal-plan/stage-1/previews?*", (route) => {
      previewRequests += 1
      return route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "temporarily_unavailable" }),
      })
    })
    const acceptBodies: unknown[] = []
    await page.route("**/api/personal-plan/accept-ideal-plan", (route) => {
      acceptBodies.push(JSON.parse(route.request().postData() ?? "{}"))
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ status: "accepted", next: { stage: 4, href: "/routine" } }),
      })
    })
    await page.route(
      (url) => url.pathname === "/plan-start",
      (route) =>
        route.fulfill({
          status: 200,
          contentType: "text/html",
          body: "<html lang='de'><body><h1>Feinschliff</h1></body></html>",
        }),
    )

    await page.goto(labPath)
    await page.getByRole("button", { name: "Optionale Empfehlungen" }).click()
    // One silent re-fetch before the previews are declared unloadable.
    await expect.poll(() => previewRequests).toBe(2)

    await page.getByRole("button", { name: "Zu deiner Routine" }).click()

    await expect(page.getByRole("heading", { name: "Feinschliff" })).toBeVisible()
    expect(new URL(page.url()).search).toBe("?refine=products")
    expect(acceptBodies).toEqual([])
  })

  /**
   * C1. `acceptance_not_ready` cannot be cleared by re-posting the same payload.
   * Offering a retry there is a dead end; the refinement is the escape hatch.
   */
  test("a plan state that cannot be accepted routes into the Feinschliff without a doomed retry", async ({
    page,
  }) => {
    await page.route("**/api/personal-plan/stage-1/previews?*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(previewResponse),
      }),
    )
    let acceptRequests = 0
    await page.route("**/api/personal-plan/accept-ideal-plan", (route) => {
      acceptRequests += 1
      return route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({ error: "acceptance_not_ready" }),
      })
    })
    await page.route(
      (url) => url.pathname === "/plan-start",
      (route) =>
        route.fulfill({
          status: 200,
          contentType: "text/html",
          body: "<html lang='de'><body><h1>Feinschliff</h1></body></html>",
        }),
    )

    await page.goto(labPath)
    await page.getByRole("button", { name: "Optionale Empfehlungen" }).click()
    await page.getByRole("button", { name: "Zu deiner Routine" }).click()

    await expect(page.getByRole("heading", { name: "Feinschliff" })).toBeVisible()
    expect(new URL(page.url()).search).toBe("?refine=products")
    expect(acceptRequests).toBe(1)
  })

  test("contains the reviewed surface at desktop without horizontal overflow", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto(labPath)
    await expect(page.getByRole("heading", { name: "Deine Basis" })).toBeVisible()
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true)
  })

  test("production-component composition resumes Stage 2 and hands authoritative roles to Stage 3", async ({
    page,
  }) => {
    await page.route("**/api/personal-plan/stage-1", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          status: "completed",
          personalPlanId,
          outputSnapshot: planStartLabSnapshot,
        }),
      }),
    )
    await page.route("**/api/personal-plan/stage-2", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(completedRefinement),
      }),
    )
    await page.route("**/api/personal-plan/stage-3?*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          status: "active",
          requirements: preparedStage3Entry.orderedCategories,
          authorityEvaluations: [],
          draft: {
            schemaVersion: 1,
            status: "active",
            authorityVersions: preparedStage3Entry.authoritySnapshot.authorityVersions,
            authoritySnapshot: preparedStage3Entry.authoritySnapshot,
            draftId: productDraftId,
            userId: "authenticated-owner",
            personalPlanId,
            refinedVersionId,
            staleRefinedVersionId: null,
            revision: 0,
            pass: "product_capture",
            orderedCategories: preparedStage3Entry.authoritySnapshot.orderedCategories,
            categoryCursor: preparedStage3Entry.authoritySnapshot.orderedCategories[0],
            products: [],
            roleAssignments: [],
            uncoveredRoles: [],
            decisions: [],
            completedCaptureCategories: [],
            completedDecisionKeys: [],
            createdAt: "2026-08-08T12:00:00.000Z",
            updatedAt: "2026-08-08T12:00:00.000Z",
          },
        }),
      }),
    )

    await page.goto(productionCompositionLabPath)
    await expect(page.getByRole("heading", { name: "Deine Basis" })).toBeVisible()
    await page.getByRole("button", { name: "Optionale Empfehlungen" }).click()
    // This scenario reports no direct acceptance, so the CTA keeps resuming the
    // already-completed Stage-2 session straight into Stage 3.
    await page.getByRole("button", { name: "Auf meine Produkte abstimmen" }).click()

    await expect(page.getByRole("heading", { name: "Deine Produktarten" })).toHaveCount(0)
    await expect(page.getByRole("heading", { name: "Dein Shampoo" })).toBeVisible()
    await expect
      .poll(() =>
        page
          .locator("main[data-stage3-progress]")
          .evaluate((element) => getComputedStyle(element).transform),
      )
      .toBe("none")
    await expect(
      page.getByText(preparedStage3Entry.orderedCategories[0]!.needSummary),
    ).toBeVisible()
  })
})
