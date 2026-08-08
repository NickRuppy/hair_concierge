import { expect, test } from "@playwright/test"

import { STAGE1_STAGE2_LAB_ENVELOPE } from "../src/app/labs/personal-plan-stage-1-2/fixture"
import { computeNeedPlan } from "../src/lib/personal-plan/compute-stage1"
import { createStage2RefinementSession } from "../src/lib/personal-plan/refinement/session"

const labPath = "/labs/personal-plan-start"
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
  pathVersion: "stage2-v1",
  triggerContext: {
    relevantCategories: ["shampoo", "mask", "heat_protectant"],
    hasReportedIrritatedScalp: false,
    dryShampooBridgeEligibility: "ineligible",
  },
  answers: {
    currentProductCategories: ["shampoo"],
    wetWashFrequency: "weekly_2x",
    towel: { material: "no_towel" },
    dryingRoutes: [],
    additionalHeatTools: [],
    nightProtection: [],
  },
  completedQuestionIds: [
    "current_product_categories",
    "wet_wash_frequency",
    "towel_handling",
    "drying_routes",
    "additional_heat_tools",
    "night_protection",
  ],
  revision: 6,
  status: "complete",
  completedHandoff: { refinedVersionId, nextHref: "/plan-start/produkte" },
})

test.describe("production-shaped Personal Plan Stage 1 surface", () => {
  test("preserves the signed mobile Basis, Optional and transition journey", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 844 })
    await page.goto(labPath)

    await expect(page.getByRole("heading", { name: "Deine Basis" })).toBeVisible()
    await expect(page.locator("[data-plan-start-card-list] article")).not.toHaveCount(0)
    await page.getByRole("button", { name: "Optionale Empfehlungen" }).click()
    await expect(page.getByRole("heading", { name: "Zusätzlich sinnvoll" })).toBeVisible()
    await page.getByRole("button", { name: "Plan wirklich zu meinem machen" }).click()
    await expect(
      page.getByRole("heading", { name: "Jetzt machen wir sie zu deiner." }),
    ).toBeVisible()
  })

  test("contains the reviewed surface at desktop without horizontal overflow", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto(labPath)
    await expect(page.getByRole("heading", { name: "Deine Basis" })).toBeVisible()
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true)
  })

  test("authenticated production composition resumes Stage 2 and hands authoritative roles to Stage 3", async ({
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
          requirements: [
            {
              category: "shampoo",
              requiredRoles: ["shampoo_everyday"],
              needSummary: "Sanfte Reinigung für deinen Waschrhythmus.",
              authorityVersion: "personal-plan.shampoo.v1",
            },
          ],
          draft: {
            schemaVersion: 1,
            status: "active",
            authorityVersions: { shampoo: "personal-plan.shampoo.v1" },
            draftId: productDraftId,
            userId: "authenticated-owner",
            personalPlanId,
            refinedVersionId,
            staleRefinedVersionId: null,
            revision: 0,
            pass: "product_capture",
            orderedCategories: ["shampoo"],
            categoryCursor: "shampoo",
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

    await page.goto("/plan-start")
    await expect(page.getByRole("heading", { name: "Deine Basis" })).toBeVisible()
    await page.getByRole("button", { name: "Optionale Empfehlungen" }).click()
    await page.getByRole("button", { name: "Plan wirklich zu meinem machen" }).click()
    await page.getByRole("button", { name: "Produkte abgleichen" }).click()
    await expect(page.locator("[data-refined-version-id]")).toHaveAttribute(
      "data-refined-version-id",
      refinedVersionId,
    )
    await page.getByRole("button", { name: /Produkte erfassen/ }).click()
    await expect(page.getByRole("heading", { name: "Welche Produkte nutzt du?" })).toBeVisible()
    await page.getByRole("button", { name: "Produkte suchen" }).click()
    await expect(page.getByRole("heading", { name: "Dein Shampoo" })).toBeVisible()
    await expect(page.getByText("Sanfte Reinigung für deinen Waschrhythmus.")).toBeVisible()
  })
})
