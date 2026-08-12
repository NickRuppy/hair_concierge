import { expect, test } from "@playwright/test"
import { createClient } from "@supabase/supabase-js"

import { computeNeedPlan } from "../src/lib/personal-plan/compute-stage1"
import { buildStage3EntryContext } from "../src/lib/personal-plan/products/stage2-entry-adapter"
import { createRefinedNeedSnapshot } from "../src/lib/personal-plan/refinement/production-persistence-gateway"
import { routinePayloadV1Schema } from "../src/lib/personal-plan/routine/contracts"
import { COMPLETE_V3_PLAN_ENVELOPE } from "./personal-plan/fixtures"

const email = "stage4-browser@hairconscierge.test"
const password = "Stage4Browser!2026"
const planId = "24000000-0000-4000-8000-000000000001"
const initialNeedId = "34000000-0000-4000-8000-000000000001"
const refinedNeedId = "34000000-0000-4000-8000-000000000002"
const draftId = "44000000-0000-4000-8000-000000000001"
const portfolioId = "54000000-0000-4000-8000-000000000001"
const routineId = "64000000-0000-4000-8000-000000000001"
const proposalId = "74000000-0000-4000-8000-000000000001"
const leadId = "14000000-0000-4000-8000-000000000001"
const funnelSessionId = "15000000-0000-4000-8000-000000000001"
const consentId = "16000000-0000-4000-8000-000000000001"
const purchaseId = "17000000-0000-4000-8000-000000000001"
const artifactId = "18000000-0000-4000-8000-000000000001"
const postCutoffPaidAt = "2026-08-09T08:00:00.000Z"

type BrowserSeedClient = {
  from: (table: string) => {
    insert: (row: Record<string, unknown>) => PromiseLike<{ error: { message: string } | null }>
  }
}

function requiredEnvironment(name: string) {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is required for the isolated Stage 4 browser test`)
  return value
}

function initialRoutinePayload() {
  return {
    schemaVersion: 1,
    planId,
    versionId: routineId,
    parentVersionId: null,
    source: {
      refinedVersionId: refinedNeedId,
      productPortfolioVersionId: portfolioId,
      sourceFingerprint: "a".repeat(64),
      compilerVersion: "stage4-browser-v1",
      authorityVersions: { shampoo: "stage4-browser-v1" },
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
                productId: "catalog-shampoo",
              },
              cadenceOverride: null,
              fitDecision: "standard",
            },
          ],
        },
      ],
    },
    sections: [
      { key: "basis", itemKeys: ["item:shampoo:everyday"] },
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
          productId: "catalog-shampoo",
          displayName: "Sanftes Shampoo",
        },
        cadence: {
          recommended: null,
          userOverride: null,
          displayKey: "weekly_2x",
        },
        sourceDecisionKeys: ["decision:shampoo:everyday"],
        authorityRuleIds: ["shampoo.browser.everyday"],
        executable: true,
      },
    ],
    createdAt: "2026-08-08T08:00:00.000Z",
  }
}

async function seedQualifyingPersonalPlanJourney(admin: BrowserSeedClient, userId: string) {
  const initial = computeNeedPlan({
    rawEnvelope: COMPLETE_V3_PLAN_ENVELOPE,
    artifactId,
    projection: "initial_quiz",
    computationVersion: "stage4-browser-v1",
    createdAt: postCutoffPaidAt,
  })
  if (initial.status !== "ready") throw new Error(`initial journey source is ${initial.status}`)
  const refined = createRefinedNeedSnapshot({
    baseInitialNeedVersionId: initialNeedId,
    preparedArtifactSourceId: artifactId,
    baseInputSnapshot: COMPLETE_V3_PLAN_ENVELOPE,
    triggerContext: {
      relevantCategories: initial.snapshot.renderedOrder,
      hasReportedIrritatedScalp: false,
      dryShampooBridgeEligibility: "unknown",
    },
    answers: {
      currentProductCategories: [],
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
    createdAt: postCutoffPaidAt,
  })
  const entry = buildStage3EntryContext(refined.outputSnapshot, {
    personalPlanId: planId,
    refinedVersionId: refinedNeedId,
  })
  const requiredRows = [
    admin.from("leads").insert({
      id: leadId,
      user_id: userId,
      name: "Stage 4 Browser",
      email,
      quiz_kind: "personal_plan",
      quiz_answers: COMPLETE_V3_PLAN_ENVELOPE,
    }),
    admin.from("funnel_sessions").insert({
      id: funnelSessionId,
      visitor_id: "19000000-0000-4000-8000-000000000001",
      user_id: userId,
      lead_id: leadId,
      package_key: "meta_personal_plan_v1",
      channel: "direct",
      quiz_variant: "personal_plan_v3",
      purchase_completed_at: postCutoffPaidAt,
    }),
    admin.from("personal_plan_prepared_artifacts").insert({
      id: artifactId,
      answer_hash: "b".repeat(64),
      claim_token_hash: "c".repeat(64),
      quiz_answers: COMPLETE_V3_PLAN_ENVELOPE,
      canonical_profile: {},
      fallback_metadata: {},
      priorities: [],
      diagnostic_scores: {},
      public_offer_model: {},
      locked_plan: { version: 1 },
      status: "attached",
      lead_id: leadId,
      user_id: userId,
      attached_at: postCutoffPaidAt,
      user_attached_at: postCutoffPaidAt,
      expires_at: "2027-08-09T08:00:00.000Z",
    }),
  ]
  for (const operation of requiredRows) {
    const { error } = await operation
    if (error) throw new Error(error.message)
  }
  const { error: consentError } = await admin
    .from("personal_plan_one_time_checkout_consents")
    .insert({
      id: consentId,
      lead_id: leadId,
      funnel_session_id: funnelSessionId,
      user_id: userId,
      product_kind: "personal_plan_once",
      offer_variant: "personal_plan_one_time_v1",
      copy_version: "purchase_context_refund_v1",
      consent_text: "Test purchase context",
      consent_text_sha256: "d".repeat(64),
      accepted_at: postCutoffPaidAt,
      confirmation_provider: "test",
      confirmation_status: "delivered",
      confirmation_reference: "stage4-browser-confirmation",
      confirmation_sent_at: postCutoffPaidAt,
      confirmation_delivered_at: postCutoffPaidAt,
      generation_started_at: postCutoffPaidAt,
      generation_completed_at: postCutoffPaidAt,
      generated_content_sha256: "e".repeat(64),
      delivery_provider: "test",
      delivery_reference: "stage4-browser-delivery",
      delivered_at: postCutoffPaidAt,
    })
  if (consentError) throw new Error(consentError.message)
  const { error: purchaseError } = await admin.from("billing_one_time_purchases").insert({
    id: purchaseId,
    user_id: userId,
    consent_id: consentId,
    provider: "stripe",
    product_kind: "personal_plan_once",
    provider_transaction_id: "stage4-browser-purchase",
    amount_minor: 2999,
    currency: "eur",
    status: "paid",
    paid_at: postCutoffPaidAt,
  })
  if (purchaseError) throw new Error(purchaseError.message)
  return { initial, refined, entry }
}

async function seedInitialProposal(userId: string) {
  const admin = createClient(
    requiredEnvironment("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnvironment("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
  const journey = await seedQualifyingPersonalPlanJourney(
    admin as unknown as BrowserSeedClient,
    userId,
  )
  const rows: Array<PromiseLike<{ error: { message: string } | null }>> = [
    admin.from("personal_plans").insert({ id: planId, user_id: userId }),
    admin.from("personal_plan_need_versions").insert({
      id: initialNeedId,
      user_id: userId,
      personal_plan_id: planId,
      kind: "initial",
      schema_version: 1,
      prepared_artifact_source_id: artifactId,
      computation_version: journey.initial.snapshot.computationVersion,
      input_hash: journey.initial.snapshot.inputHash,
      input_snapshot: COMPLETE_V3_PLAN_ENVELOPE,
      output_snapshot: journey.initial.snapshot,
    }),
  ]
  for (const operation of rows) {
    const { error } = await operation
    if (error) throw new Error(error.message)
  }
  const inserts = [
    admin.from("personal_plan_need_versions").insert({
      id: refinedNeedId,
      user_id: userId,
      personal_plan_id: planId,
      kind: "refined",
      parent_need_version_id: initialNeedId,
      schema_version: 1,
      prepared_artifact_source_id: artifactId,
      computation_version: journey.refined.computationVersion,
      input_hash: journey.refined.inputHash,
      input_snapshot: journey.refined.inputSnapshot,
      output_snapshot: journey.refined.outputSnapshot,
    }),
    admin.from("personal_plan_product_drafts").insert({
      id: draftId,
      user_id: userId,
      personal_plan_id: planId,
      refined_need_version_id: refinedNeedId,
      contract_version: 1,
      category_authority_versions: journey.entry.authoritySnapshot.authorityVersions,
      pass: "ready_for_routine",
      payload: {
        orderedCategories: journey.entry.authoritySnapshot.orderedCategories,
        authoritySnapshot: journey.entry.authoritySnapshot,
      },
      status: "completed",
    }),
  ]
  for (const operation of inserts) {
    const { error } = await operation
    if (error) throw new Error(error.message)
  }
  const portfolioSnapshot = {
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
  }
  const { error: portfolioError } = await admin.from("personal_plan_portfolio_versions").insert({
    id: portfolioId,
    user_id: userId,
    personal_plan_id: planId,
    refined_need_version_id: refinedNeedId,
    source_product_draft_id: draftId,
    source_product_draft_revision: 0,
    schema_version: 1,
    category_authority_versions: { shampoo: "stage4-browser-v1" },
    content_hash: "3".repeat(64),
    snapshot: portfolioSnapshot,
  })
  if (portfolioError) throw new Error(portfolioError.message)

  const payload = routinePayloadV1Schema.parse(initialRoutinePayload())
  const { error: routineError } = await admin.from("personal_plan_routine_versions").insert({
    id: routineId,
    user_id: userId,
    personal_plan_id: planId,
    source_refined_need_version_id: refinedNeedId,
    source_portfolio_version_id: portfolioId,
    source_product_draft_id: draftId,
    source_product_draft_revision: 0,
    schema_version: 1,
    compiler_version: "stage4-browser-v1",
    authority_versions: { shampoo: "stage4-browser-v1" },
    source_fingerprint: "a".repeat(64),
    payload_hash: "4".repeat(64),
    payload,
  })
  if (routineError) throw new Error(routineError.message)

  const { error: proposalError } = await admin.from("personal_plan_routine_proposals").insert({
    id: proposalId,
    user_id: userId,
    personal_plan_id: planId,
    candidate_routine_version_id: routineId,
    origin: "stage3_completion",
    status: "pending",
    source_revision: 0,
    source_fingerprint: "a".repeat(64),
    proposal_fingerprint: "5".repeat(64),
    delta: {
      schemaVersion: 1,
      direct: [{ kind: "added", itemKey: "item:shampoo:everyday" }],
      consequential: [],
      unchangedItemCount: 0,
    },
  })
  if (proposalError) throw new Error(proposalError.message)

  const { error: pointerError } = await admin
    .from("personal_plans")
    .update({
      current_initial_need_version_id: initialNeedId,
      current_refined_need_version_id: refinedNeedId,
      pending_routine_proposal_id: proposalId,
      revision: 1,
    })
    .eq("id", planId)
  if (pointerError) throw new Error(pointerError.message)
  return admin
}

test("initial confirmation and non-blocking successor review preserve the active Routine", async ({
  page,
}, testInfo) => {
  test.skip(
    process.env.PERSONAL_PLAN_STAGE4_ISOLATED_BROWSER !== "1",
    "run through the isolated Stage 4 browser harness",
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
    user_metadata: { full_name: "Stage 4 Browser" },
  })
  if (createError || !created.user) {
    throw new Error(createError?.message ?? "browser user missing")
  }
  const { error: profileError } = await admin.from("profiles").upsert(
    {
      id: created.user.id,
      email,
      full_name: "Stage 4 Browser",
      onboarding_completed: true,
      onboarding_step: "celebration",
      subscription_status: "active",
      subscription_interval: "month",
      current_period_end: new Date(Date.now() + 86_400_000).toISOString(),
    },
    { onConflict: "id" },
  )
  if (profileError) throw new Error(profileError.message)
  await seedInitialProposal(created.user.id)

  await page.setViewportSize({ width: 1280, height: 900 })
  const applicationOrigin = new URL(process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000")
    .origin
  let attentionRequestCount = 0
  let routineSyncRequestCount = 0
  page.on("request", (request) => {
    const requestUrl = new URL(request.url())
    if (
      requestUrl.origin === applicationOrigin &&
      requestUrl.pathname === "/api/personal-plan/routine/attention" &&
      request.method() === "GET"
    ) {
      attentionRequestCount += 1
    }
    if (
      requestUrl.origin === applicationOrigin &&
      requestUrl.pathname === "/api/personal-plan/routine/sync" &&
      request.method() === "POST"
    ) {
      routineSyncRequestCount += 1
    }
  })
  await page.goto("/auth?next=/routine")
  const loginTab = page.getByRole("tab", { name: "Anmelden" })
  if (await loginTab.isVisible()) await loginTab.click()
  await page.locator('input[type="email"]:visible').fill(email)
  await page.locator('input[type="password"]:visible').fill(password)
  await page.getByRole("button", { name: "Anmelden", exact: true }).click()
  await page.waitForURL("**/routine")
  await expect(page.getByRole("heading", { name: "Routine bestätigen" })).toBeVisible()
  expect(attentionRequestCount).toBe(0)
  expect(routineSyncRequestCount).toBe(0)
  await expect(page.getByText("Routine hat Änderungen zur Prüfung")).toBeAttached()
  await expect(page.getByText("Regelmäßige Reinigung", { exact: true }).last()).toBeVisible()
  await expect(page.getByText("Sanftes Shampoo · hinzugefügt", { exact: true })).toBeVisible()
  await expect(page.getByText("shampoo · everyday", { exact: true })).toHaveCount(0)
  await page.screenshot({ path: testInfo.outputPath("initial-proposal.png"), fullPage: true })
  await page.getByRole("button", { name: "Routine bestätigen" }).click()
  await expect(
    page.getByRole("heading", { name: "Deine Routine ist bereit.", exact: true }),
  ).toBeVisible()
  await expect(page.getByText("Sanftes Shampoo", { exact: true })).toBeVisible()
  await expect(page.getByText("Routine hat Änderungen zur Prüfung")).toHaveCount(0)
  expect(attentionRequestCount).toBe(0)
  await expect.poll(() => routineSyncRequestCount).toBe(1)

  await page.getByRole("button", { name: "Routine anpassen" }).click()
  const inclusion = page.getByRole("checkbox", { name: "Kategorie einplanen" })
  await inclusion.uncheck()
  await page.getByRole("button", { name: "Änderungen prüfen" }).click()
  await expect(page.getByRole("heading", { name: "Routine-Vorschlag prüfen" })).toBeVisible()
  expect(routineSyncRequestCount).toBe(1)
  await expect(page.getByText("Kategorie nicht mehr verwenden", { exact: true })).toBeVisible()
  await expect(
    page.getByText("Sanftes Shampoo · nicht mehr in Verwendung", { exact: true }),
  ).toBeVisible()
  await expect(page.getByText("shampoo · everyday", { exact: true })).toHaveCount(0)
  await page.screenshot({ path: testInfo.outputPath("successor-proposal.png"), fullPage: true })
  const { data: pendingPlan, error: pendingError } = await admin
    .from("personal_plans")
    .select("active_routine_version_id,pending_routine_proposal_id")
    .eq("id", planId)
    .single()
  if (pendingError) throw new Error(pendingError.message)
  expect(pendingPlan.active_routine_version_id).toBe(routineId)
  expect(pendingPlan.pending_routine_proposal_id).not.toBeNull()

  await page.getByRole("button", { name: "Später" }).click()
  await expect(page.getByRole("heading", { name: "Routine-Vorschlag prüfen" })).toHaveCount(0)
  await page.goto("/profile")
  await expect(page.getByText("Routine hat Änderungen zur Prüfung")).toBeAttached()
  await page.locator('a[href="/routine"]').click()
  await expect(page.getByRole("heading", { name: "Routine-Vorschlag prüfen" })).toBeVisible()
  await page.getByRole("button", { name: "Änderungen verwerfen" }).click()

  await expect(
    page.getByRole("heading", { name: "Deine Routine ist bereit.", exact: true }),
  ).toBeVisible()
  await expect(page.getByText("Sanftes Shampoo", { exact: true })).toBeVisible()
  await expect(page.getByText("Routine hat Änderungen zur Prüfung")).toHaveCount(0)
  await expect.poll(() => routineSyncRequestCount).toBe(2)
  const { data: finalPlan, error: finalError } = await admin
    .from("personal_plans")
    .select("active_routine_version_id,pending_routine_proposal_id")
    .eq("id", planId)
    .single()
  if (finalError) throw new Error(finalError.message)
  expect(finalPlan).toEqual({
    active_routine_version_id: routineId,
    pending_routine_proposal_id: null,
  })

  await page.setViewportSize({ width: 375, height: 844 })
  await expect(page.getByRole("navigation", { name: "Personal-Plan-Navigation" })).toBeVisible()
  await expect(page.getByRole("link", { name: "Routine", exact: true })).toBeVisible()
  await expect(page.getByText("Sanftes Shampoo", { exact: true })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath("active-mobile.png"), fullPage: true })
})
