import { expect, test } from "@playwright/test"

import { STAGE1_STAGE2_LAB_ENVELOPE } from "../src/app/labs/personal-plan-stage-1-2/fixture"
import { prepareStage3EntryContextForLab } from "../src/app/labs/personal-plan-stage-1-2/integration"
import { computeNeedPlan } from "../src/lib/personal-plan/compute-stage1"
import { createStage2RefinementSession } from "../src/lib/personal-plan/refinement/session"

const labPath = "/labs/personal-plan-start"
const productionCompositionLabPath = `${labPath}?scenario=production-composition`
const personalPlanId = "20000000-0000-4000-8000-000000000001"
const refinedVersionId = "30000000-0000-4000-8000-000000000001"
const productDraftId = "40000000-0000-4000-8000-000000000001"

const computed = computeNeedPlan({
  rawEnvelope: STAGE1_STAGE2_LAB_ENVELOPE,
  artifactId: "10000000-0000-4000-8000-000000000001",
  projection: "initial_quiz",
  computationVersion: "stage1-v1",
  createdAt: "2026-08-08T12:00:00.000Z",
})
if (computed.status !== "ready") throw new Error("production browser fixture failed to compute")

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
  test("preserves the signed mobile Basis and Optional journey with one direct Stage 2 handoff", async ({
    page,
  }) => {
    const freshRefinement = createStage2RefinementSession({
      pathVersion: "stage2-fixture-v1",
      triggerContext: completedRefinement.triggerContext,
    })
    await page.route("**/api/personal-plan/stage-2", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(freshRefinement),
      }),
    )
    await page.setViewportSize({ width: 375, height: 844 })
    await page.goto(labPath)

    await expect(page.getByRole("heading", { name: "Deine Basis" })).toBeVisible()
    const basisCards = page.locator("[data-plan-start-card-list] article")
    await expect(basisCards).not.toHaveCount(0)
    await expect(
      page.locator('[data-plan-start-card-list] article[data-plan-start-card-preview="example"]'),
    ).toHaveCount(await basisCards.count())
    await expect(basisCards.getByText("Beispiel", { exact: true })).toHaveCount(
      await basisCards.count(),
    )
    await basisCards.first().getByRole("button").click()
    await expect(basisCards.first().getByText("Warum das zu deinem Haar passt")).toBeVisible()
    await page.getByRole("button", { name: "Optionale Empfehlungen" }).click()
    await expect(page.getByRole("heading", { name: "Zusätzlich sinnvoll" })).toBeVisible()
    const optionalCards = page.locator("[data-plan-start-card-list] article")
    await expect(
      page.locator('[data-plan-start-card-list] article[data-plan-start-card-preview="example"]'),
    ).toHaveCount(await optionalCards.count())
    await expect(page.locator('[data-plan-start-screen="transition"]')).toHaveCount(0)
    await page.getByRole("button", { name: "Plan verfeinern" }).click()
    await expect(
      page.getByRole("heading", { name: "Welche Produktarten benutzt du aktuell?" }),
    ).toBeVisible()
    await expect(
      page.getByRole("heading", { name: "Jetzt machen wir ihn zu deinem." }),
    ).toHaveCount(0)
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
          outputSnapshot: computed.snapshot,
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
    await page.getByRole("button", { name: "Plan verfeinern" }).click()
    await expect(page.getByRole("heading", { name: "Deine Produktarten" })).toBeVisible()
    await page.getByRole("button", { name: "Produktarten bestätigen" }).click()
    await expect(page.getByRole("heading", { name: "Dein Shampoo" })).toBeVisible()
    await expect(
      page.getByText(preparedStage3Entry.orderedCategories[0]!.needSummary),
    ).toBeVisible()
  })
})
