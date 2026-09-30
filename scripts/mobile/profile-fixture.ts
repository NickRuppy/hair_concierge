import type { SupabaseClient } from "@supabase/supabase-js"
import { buildLegacyQuizStage1Source } from "../../src/lib/personal-plan/input"
import { computeNeedPlan } from "../../src/lib/personal-plan/compute-stage1"
import { hashPersonalPlanNeedVersionInput } from "../../src/lib/personal-plan/persistence"
import { PERSONAL_PLAN_STAGE1_COMPUTATION_VERSION } from "../../src/lib/personal-plan/persistence/stage1-service"
import { createRefinedNeedSnapshot } from "../../src/lib/personal-plan/refinement/production-persistence-gateway"
import { deriveStage2TriggerContext } from "../../src/lib/personal-plan/refinement/stage1-adapter"
import { resolveAssumedAnswers } from "../../src/lib/personal-plan/refinement/assumed-defaults"
import { proposedProductPortfolioSchema } from "../../src/lib/personal-plan/products/contracts"
import { compileInitialRoutineCandidate } from "../../src/lib/personal-plan/routine-candidate-compiler"
import { routinePayloadV1Schema } from "../../src/lib/personal-plan/routine/contracts"
import { semanticHash } from "../../src/lib/personal-plan/routine/canonicalize"
import type { QuizAnswers } from "../../src/lib/quiz/types"

export const mobileProfileFixtureAnswers: QuizAnswers = {
  structure: "wavy",
  thickness: "fine",
  density: "medium",
  hair_length: "long",
  fingertest: "rau",
  pulltest: "stretches_bounces",
  scalp_type: "ausgeglichen",
  has_scalp_issue: false,
  treatment: ["natur"],
  concerns: ["dryness"],
  goals: ["moisture"],
}
export const mobileProfileFixtureProfile = {
  hair_texture: "wavy",
  thickness: "fine",
  density: "medium",
  hair_length: "long",
  cuticle_condition: "rough",
  protein_moisture_balance: "stretches_bounces",
  scalp_type: "balanced",
  scalp_condition: null,
  chemical_treatment: ["natural"],
  concerns: ["dryness"],
  goals: ["moisture"],
}
export const MOBILE_PROFILE_FIXTURE_IDS = {
  freeLead: "00000000-0000-4000-8200-000000000001",
  detailedLead: "00000000-0000-4000-8200-000000000002",
  plan: "00000000-0000-4000-8200-000000000003",
  initial: "00000000-0000-4000-8200-000000000004",
  refined: "00000000-0000-4000-8200-000000000005",
  refinement: "00000000-0000-4000-8200-000000000006",
  userProduct: "00000000-0000-4000-8200-000000000007",
  productDraft: "00000000-0000-4000-8200-000000000008",
  portfolio: "00000000-0000-4000-8200-000000000009",
  routine: "00000000-0000-4000-8200-000000000010",
  subscription: "00000000-0000-4000-8200-000000000011",
}

export const MOBILE_PROFILE_GUARD_TABLES = [
  "personal_plans",
  "personal_plan_need_versions",
  "personal_plan_refinement_drafts",
  "user_products",
  "personal_plan_product_drafts",
  "personal_plan_portfolio_versions",
  "personal_plan_routine_versions",
  "personal_plan_routine_proposals",
  "personal_plan_routine_source_change_outbox",
  "billing_subscriptions",
] as const

/** Synthetic local-only sources. Call once on a fresh product test stack. */
export async function seedMobileProfileFixtures(
  client: SupabaseClient,
  userIds: { free: string; detailed: string; incomplete: string },
) {
  const url = new URL((client as unknown as { supabaseUrl: string }).supabaseUrl)
  if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
    throw new Error("mobile_fixture_requires_loopback_supabase")
  if (new Set(Object.values(userIds)).size !== 3)
    throw new Error("mobile_fixture_requires_distinct_users")
  const insert = async (
    table: string,
    rows: Record<string, unknown> | Record<string, unknown>[],
  ) => {
    const { error } = await client.from(table).insert(rows)
    if (error) throw new Error(`mobile_fixture_${table}: ${error.message}`)
  }
  const ids = MOBILE_PROFILE_FIXTURE_IDS
  // Existing billing schema/reader authority, explicitly marked local test so
  // provider reconciliation never treats this as a real Stripe subscription.
  await insert("billing_subscriptions", {
    id: ids.subscription,
    user_id: userIds.detailed,
    provider: "stripe",
    provider_subscription_id: "sub_local_ios_scanner_detailed",
    provider_status: "active",
    entitlement_status: "active",
    interval: "year",
    current_period_end: "2027-09-12T00:00:00.000Z",
    cancel_at_period_end: false,
    metadata: { local_test: true, seed_source: "mobile_profile_fixture" },
  })
  await insert("hair_profiles", [
    { user_id: userIds.free, ...mobileProfileFixtureProfile },
    { user_id: userIds.detailed, ...mobileProfileFixtureProfile },
    { user_id: userIds.incomplete, hair_texture: "straight", thickness: "fine" },
  ])
  await insert("leads", [
    {
      id: ids.freeLead,
      user_id: userIds.free,
      name: "Lokaler Scan-Test",
      email: "ios-free@example.invalid",
      quiz_kind: "legacy",
      quiz_answers: mobileProfileFixtureAnswers,
      marketing_consent: false,
    },
    {
      id: ids.detailedLead,
      user_id: userIds.detailed,
      name: "Lokaler Feinschliff-Test",
      email: "ios-detailed@example.invalid",
      quiz_kind: "legacy",
      quiz_answers: mobileProfileFixtureAnswers,
      marketing_consent: false,
    },
  ])
  const source = buildLegacyQuizStage1Source({
    leadId: ids.detailedLead,
    answers: mobileProfileFixtureAnswers,
  })
  const computed = computeNeedPlan({
    rawEnvelope: source,
    artifactId: ids.detailedLead,
    projection: "initial_quiz",
    computationVersion: PERSONAL_PLAN_STAGE1_COMPUTATION_VERSION,
    createdAt: "2026-09-12T00:00:00.000Z",
  })
  if (computed.status !== "ready") throw new Error("mobile_fixture_initial_failed")
  const triggerContext = deriveStage2TriggerContext(computed.snapshot)
  const resolved = resolveAssumedAnswers({
    triggerContext,
    answers: {
      currentProductCategories: ["shampoo", "conditioner"],
      wetWashFrequency: "weekly_3_4x",
      towel: { material: "mikrofaser", technique: "gentle_press" },
      dryingRoutes: ["ordinary_blow_dry"],
      additionalHeatTools: [],
      heatEvents: { "heat:ordinary_blow_dry": { frequency: "weekly_3_4x" } },
      nightProtection: [],
    },
  })
  const refined = createRefinedNeedSnapshot({
    baseInitialNeedVersionId: ids.initial,
    preparedArtifactSourceId: ids.detailedLead,
    baseInputSnapshot: source as never,
    triggerContext,
    answers: resolved.answers,
    completedQuestionIds: resolved.orderedQuestionIds,
    createdAt: computed.snapshot.createdAt,
  })
  await insert("personal_plans", { id: ids.plan, user_id: userIds.detailed })
  await insert("personal_plan_need_versions", {
    id: ids.initial,
    user_id: userIds.detailed,
    personal_plan_id: ids.plan,
    kind: "initial",
    stage1_source_kind: "legacy_quiz_lead",
    stage1_source_lead_id: ids.detailedLead,
    schema_version: 1,
    computation_version: computed.snapshot.computationVersion,
    input_hash: hashPersonalPlanNeedVersionInput({
      schemaVersion: 1,
      computationVersion: computed.snapshot.computationVersion,
      inputSnapshot: source as never,
    }),
    input_snapshot: source,
    output_snapshot: computed.snapshot,
  })
  await insert("personal_plan_need_versions", {
    id: ids.refined,
    user_id: userIds.detailed,
    personal_plan_id: ids.plan,
    kind: "refined",
    parent_need_version_id: ids.initial,
    schema_version: refined.schemaVersion,
    computation_version: refined.computationVersion,
    input_hash: refined.inputHash,
    input_snapshot: refined.inputSnapshot,
    output_snapshot: refined.outputSnapshot,
  })
  await insert("personal_plan_refinement_drafts", {
    id: ids.refinement,
    user_id: userIds.detailed,
    personal_plan_id: ids.plan,
    base_initial_need_version_id: ids.initial,
    schema_version: 1,
    answers: resolved.answers,
    completed_question_ids: resolved.orderedQuestionIds,
    answer_provenance: Object.fromEntries(
      resolved.orderedQuestionIds.map((id) => [
        id,
        resolved.assumedQuestionIds.includes(id) ? "assumed" : "user",
      ]),
    ),
    status: "complete",
    result_refined_need_version_id: ids.refined,
    revision: 1,
  })
  const { error } = await client
    .from("personal_plans")
    .update({
      current_initial_need_version_id: ids.initial,
      current_refined_need_version_id: ids.refined,
    })
    .eq("id", ids.plan)
  if (error) throw new Error(`mobile_fixture_plan_head: ${error.message}`)
  // Nonempty paid-state guard. Requires seedMobileCatalogFixture first. The
  // historical portfolio and actual routine compiler/schema are reused; this
  // does not exercise or grant paid enrollment, and never calls a paid RPC.
  const productId = "10000000-0000-4000-8000-000000000004"
  const role = refined.outputSnapshot.decisions.find((decision) => decision.category === "shampoo")!
    .roles[0]
  const decisionKey = `shampoo:${role}`
  const portfolio = proposedProductPortfolioSchema.parse({
    schemaVersion: 1,
    portfolioVersionId: ids.portfolio,
    personalPlanId: ids.plan,
    refinedVersionId: ids.refined,
    sourceDraftRevision: 0,
    categoryResolutions: [
      {
        decisionKey,
        category: "shampoo",
        role,
        verdict: "ideal",
        choiceState: "owned_active",
        capturedProductId: ids.userProduct,
        executable: true,
        gapPreserved: false,
      },
    ],
    ownedProducts: [
      {
        capturedProductId: ids.userProduct,
        userProductId: ids.userProduct,
        productId,
        displayName: "Chaarlie Local Sanftes Shampoo",
        category: "shampoo",
        role,
        frequencyRange: "weekly_3_4x",
        choiceState: "owned_active",
        sourceDecisionKey: decisionKey,
      },
    ],
    pendingProducts: [],
    plannedPurchases: [],
    uncoveredRoles: [],
    createdAt: computed.snapshot.createdAt,
  })
  const candidate = await compileInitialRoutineCandidate({
    userId: userIds.detailed,
    personalPlanId: ids.plan,
    productDraftId: ids.productDraft,
    expectedRevision: 0,
    expectedSourceRevision: 0,
    portfolioSchemaVersion: 1,
    portfolioSnapshot: portfolio as never,
    refinedNeedSnapshot: refined.outputSnapshot,
  })
  const payload = routinePayloadV1Schema.parse({
    ...(candidate.payload as Record<string, unknown>),
    versionId: ids.routine,
  })
  await insert("user_products", {
    id: ids.userProduct,
    user_id: userIds.detailed,
    category: "shampoo",
    catalog_product_id: productId,
    brand_text: "Chaarlie Local",
    product_name_text: "Sanftes Shampoo",
    identity_status: "matched",
    ownership_status: "owned",
    intake_source: "local_mobile_fixture",
  })
  await insert("personal_plan_product_drafts", {
    id: ids.productDraft,
    user_id: userIds.detailed,
    personal_plan_id: ids.plan,
    refined_need_version_id: ids.refined,
    contract_version: 1,
    status: "completed",
    revision: 1,
    pass: "ready_for_routine",
  })
  await insert("personal_plan_portfolio_versions", {
    id: ids.portfolio,
    user_id: userIds.detailed,
    personal_plan_id: ids.plan,
    refined_need_version_id: ids.refined,
    source_product_draft_id: ids.productDraft,
    source_product_draft_revision: 0,
    schema_version: 1,
    category_authority_versions: candidate.authorityVersions,
    content_hash: semanticHash(portfolio),
    snapshot: portfolio,
  })
  await insert("personal_plan_routine_versions", {
    id: ids.routine,
    user_id: userIds.detailed,
    personal_plan_id: ids.plan,
    source_refined_need_version_id: ids.refined,
    source_portfolio_version_id: ids.portfolio,
    source_product_draft_id: ids.productDraft,
    source_product_draft_revision: 0,
    schema_version: 1,
    compiler_version: candidate.compilerVersion,
    authority_versions: candidate.authorityVersions,
    source_fingerprint: candidate.sourceFingerprint,
    payload_hash: semanticHash(payload),
    payload,
  })
  const { error: routineError } = await client
    .from("personal_plans")
    .update({ active_routine_version_id: ids.routine })
    .eq("id", ids.plan)
  if (routineError) throw new Error(`mobile_fixture_routine_head: ${routineError.message}`)
  return ids
}
