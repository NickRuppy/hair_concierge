import { expect, test } from "@playwright/test"
import { createClient } from "@supabase/supabase-js"

import { routinePayloadV1Schema } from "../src/lib/personal-plan/routine/contracts"

const email = "stage5-browser@hairconscierge.test"
const password = "Stage5Browser!2026"
const planId = "25000000-0000-4000-8000-000000000001"
const initialNeedId = "35000000-0000-4000-8000-000000000001"
const refinedNeedId = "35000000-0000-4000-8000-000000000002"
const draftId = "45000000-0000-4000-8000-000000000001"
const portfolioId = "55000000-0000-4000-8000-000000000001"
const routineId = "65000000-0000-4000-8000-000000000001"
const shampooId = "85000000-0000-4000-8000-000000000001"
const conditionerId = "85000000-0000-4000-8000-000000000002"

function requiredEnvironment(name: string) {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is required for the isolated Stage 5 browser test`)
  return value
}

function routinePayload() {
  return routinePayloadV1Schema.parse({
    schemaVersion: 1,
    planId,
    versionId: routineId,
    parentVersionId: null,
    source: {
      refinedVersionId: refinedNeedId,
      productPortfolioVersionId: portfolioId,
      sourceFingerprint: "a".repeat(64),
      compilerVersion: "stage5-browser-v1",
      authorityVersions: { shampoo: "stage5-browser-v1", conditioner: "stage5-browser-v1" },
    },
    intent: {
      schemaVersion: 1,
      categories: [
        {
          category: "shampoo",
          inclusion: "included",
          inclusionSource: "stage3",
          assignments: [
            {
              assignmentKey: "assignment:shampoo:everyday",
              role: "shampoo_everyday",
              productRef: {
                kind: "owned",
                capturedProductId: "captured-shampoo",
                productId: shampooId,
              },
              cadenceOverride: null,
              fitDecision: "standard",
            },
          ],
        },
        {
          category: "conditioner",
          inclusion: "included",
          inclusionSource: "stage3",
          assignments: [
            {
              assignmentKey: "assignment:conditioner:rinse-out",
              role: "conditioner_rinse_out",
              productRef: {
                kind: "owned",
                capturedProductId: "captured-conditioner",
                productId: conditionerId,
              },
              cadenceOverride: null,
              fitDecision: "standard",
            },
          ],
        },
      ],
    },
    sections: [
      { key: "basis", itemKeys: ["item:shampoo:everyday", "item:conditioner:rinse-out"] },
      { key: "optional", itemKeys: [] },
    ],
    items: [
      {
        itemKey: "item:shampoo:everyday",
        assignmentKey: "assignment:shampoo:everyday",
        category: "shampoo",
        role: "shampoo_everyday",
        purposeKey: "shampoo_everyday",
        roleOrder: 0,
        state: {
          systemAssessment: "basis",
          inclusion: "included",
          availability: "owned",
          fitDecision: "standard",
        },
        product: {
          kind: "owned",
          capturedProductId: "captured-shampoo",
          productId: shampooId,
          displayName: "Sanftes Shampoo",
        },
        cadence: { recommended: null, userOverride: null, displayKey: "weekly_2x" },
        sourceDecisionKeys: ["decision:shampoo:everyday"],
        authorityRuleIds: ["shampoo.browser.everyday"],
        executable: true,
      },
      {
        itemKey: "item:conditioner:rinse-out",
        assignmentKey: "assignment:conditioner:rinse-out",
        category: "conditioner",
        role: "conditioner_rinse_out",
        purposeKey: "conditioner_rinse_out",
        roleOrder: 0,
        state: {
          systemAssessment: "basis",
          inclusion: "included",
          availability: "owned",
          fitDecision: "standard",
        },
        product: {
          kind: "owned",
          capturedProductId: "captured-conditioner",
          productId: conditionerId,
          displayName: "Leichter Conditioner",
        },
        cadence: { recommended: null, userOverride: null, displayKey: "weekly_2x" },
        sourceDecisionKeys: ["decision:conditioner:rinse-out"],
        authorityRuleIds: ["conditioner.browser.rinse-out"],
        executable: true,
      },
    ],
    createdAt: "2026-08-08T08:00:00.000Z",
  })
}

async function seedAcceptedRoutine(userId: string) {
  const admin = createClient(
    requiredEnvironment("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnvironment("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
  const operations = [
    admin.from("products").insert([
      {
        id: shampooId,
        name: "Sanftes Shampoo",
        category: "shampoo",
        category_key: "shampoo",
        is_active: true,
        lifecycle_status: "active",
      },
      {
        id: conditionerId,
        name: "Leichter Conditioner",
        category: "conditioner",
        category_key: "conditioner",
        is_active: true,
        lifecycle_status: "active",
      },
    ]),
    admin.from("personal_plans").insert({ id: planId, user_id: userId }),
  ]
  for (const operation of operations) {
    const { error } = await operation
    if (error) throw new Error(error.message)
  }
  const { error: initialError } = await admin.from("personal_plan_need_versions").insert({
    id: initialNeedId,
    user_id: userId,
    personal_plan_id: planId,
    kind: "initial",
    schema_version: 1,
    computation_version: "stage5-browser-v1",
    input_hash: "1".repeat(64),
    input_snapshot: {},
    output_snapshot: {},
  })
  if (initialError) throw new Error(initialError.message)
  const { error: refinedError } = await admin.from("personal_plan_need_versions").insert({
    id: refinedNeedId,
    user_id: userId,
    personal_plan_id: planId,
    kind: "refined",
    parent_need_version_id: initialNeedId,
    schema_version: 1,
    computation_version: "stage5-browser-v1",
    input_hash: "2".repeat(64),
    input_snapshot: {},
    output_snapshot: {
      profile: { hair: { length: "medium", density: "medium", thickness: "normal" } },
    },
  })
  if (refinedError) throw new Error(refinedError.message)
  const { error: draftError } = await admin.from("personal_plan_product_drafts").insert({
    id: draftId,
    user_id: userId,
    personal_plan_id: planId,
    refined_need_version_id: refinedNeedId,
    contract_version: 1,
    category_authority_versions: { shampoo: "stage5-browser-v1", conditioner: "stage5-browser-v1" },
    pass: "ready_for_routine",
    payload: {},
    status: "completed",
  })
  if (draftError) throw new Error(draftError.message)
  const { error: portfolioError } = await admin.from("personal_plan_portfolio_versions").insert({
    id: portfolioId,
    user_id: userId,
    personal_plan_id: planId,
    refined_need_version_id: refinedNeedId,
    source_product_draft_id: draftId,
    source_product_draft_revision: 0,
    schema_version: 1,
    category_authority_versions: { shampoo: "stage5-browser-v1", conditioner: "stage5-browser-v1" },
    content_hash: "3".repeat(64),
    snapshot: {
      schemaVersion: 1,
      portfolioVersionId: portfolioId,
      personalPlanId: planId,
      refinedVersionId: refinedNeedId,
      sourceDraftRevision: 0,
      categoryResolutions: [],
      ownedProducts: [],
      plannedPurchases: [],
      pendingProducts: [],
      uncoveredRoles: [],
      createdAt: "2026-08-08T08:00:00.000Z",
    },
  })
  if (portfolioError) throw new Error(portfolioError.message)
  const { error: routineError } = await admin.from("personal_plan_routine_versions").insert({
    id: routineId,
    user_id: userId,
    personal_plan_id: planId,
    source_refined_need_version_id: refinedNeedId,
    source_portfolio_version_id: portfolioId,
    source_product_draft_id: draftId,
    source_product_draft_revision: 0,
    schema_version: 1,
    compiler_version: "stage5-browser-v1",
    authority_versions: { shampoo: "stage5-browser-v1", conditioner: "stage5-browser-v1" },
    source_fingerprint: "a".repeat(64),
    payload_hash: "4".repeat(64),
    payload: routinePayload(),
  })
  if (routineError) throw new Error(routineError.message)
  const { error: pointerError } = await admin
    .from("personal_plans")
    .update({
      current_initial_need_version_id: initialNeedId,
      current_refined_need_version_id: refinedNeedId,
      active_routine_version_id: routineId,
      revision: 1,
    })
    .eq("id", planId)
  if (pointerError) throw new Error(pointerError.message)
  return admin
}

test("accepted Routine renders Anwendung overview and a bookmarkable day without application persistence", async ({
  page,
}, testInfo) => {
  test.skip(
    process.env.PERSONAL_PLAN_STAGE5_ISOLATED_BROWSER !== "1",
    "run through the isolated Stage 5 browser harness",
  )
  const admin = createClient(
    requiredEnvironment("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnvironment("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Stage 5 Browser" },
  })
  if (createError || !created.user) throw new Error(createError?.message ?? "browser user missing")
  const { error: profileError } = await admin.from("profiles").upsert(
    {
      id: created.user.id,
      email,
      full_name: "Stage 5 Browser",
      onboarding_completed: true,
      onboarding_step: "celebration",
      subscription_status: "active",
      subscription_interval: "month",
      current_period_end: new Date(Date.now() + 86_400_000).toISOString(),
    },
    { onConflict: "id" },
  )
  if (profileError) throw new Error(profileError.message)
  await seedAcceptedRoutine(created.user.id)

  await page.setViewportSize({ width: 320, height: 844 })
  await page.goto("/auth?next=/anwendung")
  const loginTab = page.getByRole("tab", { name: "Anmelden" })
  if (await loginTab.isVisible()) await loginTab.click()
  await page.locator('input[type="email"]:visible').fill(email)
  await page.locator('input[type="password"]:visible').fill(password)
  await page.getByRole("button", { name: "Anmelden", exact: true }).click()
  await page.waitForURL("**/anwendung")
  await expect(page.getByRole("heading", { name: "Anwendung", exact: true })).toBeVisible()
  await expect(page.getByRole("link", { name: "Waschtag" })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath("overview-mobile-320.png"), fullPage: true })

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/anwendung/wash_day")
  await expect(page.getByRole("heading", { name: "Waschtag", exact: true })).toBeVisible()
  await expect(page.getByText("Sanftes Shampoo", { exact: true })).toBeVisible()
  await expect(page.getByText("Leichter Conditioner", { exact: true })).toBeVisible()
  await expect(page.getByRole("link", { name: "Alle Tage" })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath("wash-day-mobile-390.png"), fullPage: true })

  const { data: before, error: beforeError } = await admin
    .from("personal_plans")
    .select("revision,active_routine_version_id")
    .eq("id", planId)
    .single()
  if (beforeError) throw new Error(beforeError.message)
  await page.getByRole("link", { name: "Alle Tage" }).click()
  await page.waitForURL("**/anwendung")
  await page.setViewportSize({ width: 1440, height: 900 })
  await expect(page.getByRole("heading", { name: "Anwendung", exact: true })).toBeVisible()
  await expect(page.getByRole("link", { name: "Waschtag" })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath("overview-desktop-1440.png"), fullPage: true })
  const { data: after, error: afterError } = await admin
    .from("personal_plans")
    .select("revision,active_routine_version_id")
    .eq("id", planId)
    .single()
  if (afterError) throw new Error(afterError.message)
  expect(after).toEqual(before)
})

test("owner without an accepted Routine gets a recovery path without exposing application content", async ({
  page,
}) => {
  test.skip(
    process.env.PERSONAL_PLAN_STAGE5_ISOLATED_BROWSER !== "1",
    "run through the isolated Stage 5 browser harness",
  )
  const admin = createClient(
    requiredEnvironment("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnvironment("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
  const recoveryEmail = "stage5-browser-no-routine@hairconscierge.test"
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: recoveryEmail,
    password,
    email_confirm: true,
  })
  if (createError || !created.user) {
    throw new Error(createError?.message ?? "recovery browser user missing")
  }
  const { error: profileError } = await admin.from("profiles").upsert(
    {
      id: created.user.id,
      email: recoveryEmail,
      onboarding_completed: true,
      onboarding_step: "celebration",
      subscription_status: "active",
      subscription_interval: "month",
      current_period_end: new Date(Date.now() + 86_400_000).toISOString(),
    },
    { onConflict: "id" },
  )
  if (profileError) throw new Error(profileError.message)

  await page.goto("/auth?next=/anwendung")
  const loginTab = page.getByRole("tab", { name: "Anmelden" })
  if (await loginTab.isVisible()) await loginTab.click()
  await page.locator('input[type="email"]:visible').fill(recoveryEmail)
  await page.locator('input[type="password"]:visible').fill(password)
  await page.getByRole("button", { name: "Anmelden", exact: true }).click()
  await page.waitForURL("**/anwendung")
  await expect(page.getByRole("heading", { name: "Bestätige zuerst deine Routine" })).toBeVisible()
  await expect(page.getByRole("link", { name: "Routine prüfen" })).toHaveAttribute(
    "href",
    "/routine",
  )
  await expect(page.getByText("Waschtag", { exact: true })).toHaveCount(0)
})
