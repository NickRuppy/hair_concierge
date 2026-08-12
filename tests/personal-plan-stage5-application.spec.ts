import { expect, test } from "@playwright/test"
import { createClient } from "@supabase/supabase-js"
import { execFileSync } from "node:child_process"

import { computeNeedPlan } from "../src/lib/personal-plan/compute-stage1"
import { buildStage3EntryContext } from "../src/lib/personal-plan/products/stage2-entry-adapter"
import { createRefinedNeedSnapshot } from "../src/lib/personal-plan/refinement/production-persistence-gateway"
import { routinePayloadV1Schema } from "../src/lib/personal-plan/routine/contracts"
import { COMPLETE_V3_PLAN_ENVELOPE } from "./personal-plan/fixtures"

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
const leadId = "15000000-0000-4000-8000-000000000001"
const funnelSessionId = "16000000-0000-4000-8000-000000000001"
const consentId = "17000000-0000-4000-8000-000000000001"
const purchaseId = "18000000-0000-4000-8000-000000000001"
const artifactId = "19000000-0000-4000-8000-000000000001"
const recoveryLeadId = "15000000-0000-4000-8000-000000000002"
const recoveryFunnelSessionId = "16000000-0000-4000-8000-000000000002"
const recoveryConsentId = "17000000-0000-4000-8000-000000000002"
const recoveryPurchaseId = "18000000-0000-4000-8000-000000000002"
const recoveryArtifactId = "19000000-0000-4000-8000-000000000002"
const postCutoffPaidAt = "2026-08-09T08:00:00.000Z"
const canonicalDiagnostics = {
  structure: "wavy",
  thickness: "fine",
  density: "medium",
  hair_length: "long",
  fingertest: "rau",
  pulltest: "stretches_stays",
  scalp_type: "ausgeglichen",
  has_scalp_issue: true,
  scalp_condition: "gereizt",
  concerns: ["dryness", "split_ends"],
  treatment: ["gefaerbt"],
  goals: ["moisture", "shine"],
}

type BrowserSeedClient = {
  from: (table: string) => {
    insert: (row: Record<string, unknown>) => PromiseLike<{ error: { message: string } | null }>
  }
}

function requiredEnvironment(name: string) {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is required for the isolated Stage 5 browser test`)
  return value
}

function seedCanonicalProductGuidance(
  rows: Array<{
    productId: string
    sourceGuidanceKey: string
    guidanceKey: string
    role: "shampoo_everyday" | "conditioner_rinse_out"
  }>,
) {
  const literal = (value: string) => value.replaceAll("'", "''")
  const sql = rows
    .map(
      ({ productId, sourceGuidanceKey, guidanceKey, role }) => `
DO $seed$
DECLARE
  inserted_count integer;
BEGIN
  INSERT INTO public.application_guidance_protocols (
    id, guidance_key, protocol_version, locale, scope_kind, category_key, role_key,
    product_id, application_family, payload, status, verified_at
  )
  SELECT
    gen_random_uuid(), '${literal(guidanceKey)}', source.protocol_version, source.locale,
    'product', source.category_key, NULL, '${literal(productId)}'::uuid,
    source.application_family,
    jsonb_set(
      jsonb_set(
        jsonb_set(source.payload, '{guidanceKey}', to_jsonb('${literal(guidanceKey)}'::text)),
        '{scope}', jsonb_build_object('kind', 'product', 'category', source.category_key, 'productId', '${literal(productId)}')
      ),
      '{role}', 'null'::jsonb
    ),
    source.status, source.verified_at
  FROM public.application_guidance_protocols AS source
  WHERE source.guidance_key = '${literal(sourceGuidanceKey)}'
    AND source.scope_kind = 'application_family'
    AND source.status = 'active';

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  IF inserted_count <> 1 THEN
    RAISE EXCEPTION 'expected one source guidance row for ${literal(sourceGuidanceKey)}';
  END IF;

  INSERT INTO public.product_application_protocols (
    product_id, category, role, source_url, source_text, guidance_payload
  )
  SELECT
    '${literal(productId)}'::uuid, source.category_key, '${literal(role)}',
    source.payload#>>'{evidence,0,sourceUrl}',
    'Canonical browser-test protocol derived from the verified family guidance.',
    jsonb_set(
      jsonb_set(
        jsonb_set(source.payload, '{guidanceKey}', to_jsonb('${literal(guidanceKey)}'::text)),
        '{scope}', jsonb_build_object('kind', 'product', 'category', source.category_key, 'productId', '${literal(productId)}')
      ),
      '{role}', to_jsonb('${literal(role)}'::text)
    )
  FROM public.application_guidance_protocols AS source
  WHERE source.guidance_key = '${literal(sourceGuidanceKey)}'
    AND source.scope_kind = 'application_family'
    AND source.status = 'active';

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  IF inserted_count <> 1 THEN
    RAISE EXCEPTION 'expected one canonical protocol row for ${literal(sourceGuidanceKey)}';
  END IF;
END
$seed$;
`,
    )
    .join("\n")

  execFileSync(
    "docker",
    [
      "exec",
      "-i",
      "supabase_db_hc_personal_plan_stage5_browser",
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
    ],
    { input: sql, stdio: ["pipe", "pipe", "pipe"] },
  )
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
      authorityVersions: {
        shampoo: "stage5-browser-v1",
        conditioner: "stage5-browser-v1",
        leave_in: "stage5-browser-v1",
      },
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
                kind: "planned",
                plannedPurchaseId: "planned-conditioner",
                productId: conditionerId,
              },
              cadenceOverride: null,
              fitDecision: "standard",
            },
          ],
        },
        {
          category: "leave_in",
          inclusion: "included",
          inclusionSource: "stage3",
          assignments: [
            {
              assignmentKey: "assignment:leave-in:pending",
              role: "post_wash_leave_in",
              productRef: {
                kind: "pending_review",
                capturedProductId: "captured-pending-leave-in",
                submissionId: "submission-pending-leave-in",
              },
              cadenceOverride: null,
              fitDecision: "standard",
            },
          ],
        },
      ],
    },
    sections: [
      {
        key: "basis",
        itemKeys: ["item:shampoo:everyday", "item:conditioner:rinse-out", "item:leave-in:pending"],
      },
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
          availability: "planned",
          fitDecision: "standard",
        },
        product: {
          kind: "planned",
          plannedPurchaseId: "planned-conditioner",
          productId: conditionerId,
          displayName: "Leichter Conditioner",
        },
        cadence: { recommended: null, userOverride: null, displayKey: "weekly_2x" },
        sourceDecisionKeys: ["decision:conditioner:rinse-out"],
        authorityRuleIds: ["conditioner.browser.rinse-out"],
        executable: false,
      },
      {
        itemKey: "item:leave-in:pending",
        assignmentKey: "assignment:leave-in:pending",
        category: "leave_in",
        role: "post_wash_leave_in",
        purposeKey: "post_wash_leave_in",
        roleOrder: 0,
        state: {
          systemAssessment: "basis",
          inclusion: "included",
          availability: "pending_review",
          fitDecision: "standard",
        },
        product: {
          kind: "pending_review",
          submissionId: "submission-pending-leave-in",
          displayName: "Ungeprüftes Leave-in",
        },
        cadence: { recommended: null, userOverride: null, displayKey: "weekly_2x" },
        sourceDecisionKeys: ["decision:leave-in:pending"],
        authorityRuleIds: ["leave-in.browser.pending"],
        executable: false,
      },
    ],
    createdAt: "2026-08-08T08:00:00.000Z",
  })
}

async function seedQualifyingPersonalPlanJourney(admin: BrowserSeedClient, userId: string) {
  const initial = computeNeedPlan({
    rawEnvelope: COMPLETE_V3_PLAN_ENVELOPE,
    artifactId,
    projection: "initial_quiz",
    computationVersion: "stage5-browser-v1",
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
      name: "Stage 5 Browser",
      email,
      quiz_kind: "personal_plan",
      quiz_answers: COMPLETE_V3_PLAN_ENVELOPE,
    }),
    admin.from("funnel_sessions").insert({
      id: funnelSessionId,
      visitor_id: "1a000000-0000-4000-8000-000000000001",
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
      canonical_profile: canonicalDiagnostics,
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
      confirmation_reference: "stage5-browser-confirmation",
      confirmation_sent_at: postCutoffPaidAt,
      confirmation_delivered_at: postCutoffPaidAt,
      generation_started_at: postCutoffPaidAt,
      generation_completed_at: postCutoffPaidAt,
      generated_content_sha256: "e".repeat(64),
      delivery_provider: "test",
      delivery_reference: "stage5-browser-delivery",
      delivered_at: postCutoffPaidAt,
    })
  if (consentError) throw new Error(consentError.message)
  const { error: purchaseError } = await admin.from("billing_one_time_purchases").insert({
    id: purchaseId,
    user_id: userId,
    consent_id: consentId,
    provider: "stripe",
    product_kind: "personal_plan_once",
    provider_transaction_id: "stage5-browser-purchase",
    amount_minor: 2999,
    currency: "eur",
    status: "paid",
    paid_at: postCutoffPaidAt,
  })
  if (purchaseError) throw new Error(purchaseError.message)
  return { initial, refined, entry }
}

async function seedQualifyingBuyerWithoutRoutine(
  admin: BrowserSeedClient,
  userId: string,
  recoveryEmail: string,
) {
  const requiredRows = [
    admin.from("leads").insert({
      id: recoveryLeadId,
      user_id: userId,
      name: "Stage 5 Recovery Browser",
      email: recoveryEmail,
      quiz_kind: "personal_plan",
      quiz_answers: COMPLETE_V3_PLAN_ENVELOPE,
    }),
    admin.from("funnel_sessions").insert({
      id: recoveryFunnelSessionId,
      visitor_id: "1a000000-0000-4000-8000-000000000002",
      user_id: userId,
      lead_id: recoveryLeadId,
      package_key: "meta_personal_plan_v1",
      channel: "direct",
      quiz_variant: "personal_plan_v3",
      purchase_completed_at: postCutoffPaidAt,
    }),
    admin.from("personal_plan_prepared_artifacts").insert({
      id: recoveryArtifactId,
      answer_hash: "f".repeat(64),
      claim_token_hash: "a".repeat(64),
      quiz_answers: COMPLETE_V3_PLAN_ENVELOPE,
      canonical_profile: canonicalDiagnostics,
      fallback_metadata: {},
      priorities: [],
      diagnostic_scores: {},
      public_offer_model: {},
      locked_plan: { version: 1 },
      status: "attached",
      lead_id: recoveryLeadId,
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
      id: recoveryConsentId,
      lead_id: recoveryLeadId,
      funnel_session_id: recoveryFunnelSessionId,
      user_id: userId,
      product_kind: "personal_plan_once",
      offer_variant: "personal_plan_one_time_v1",
      copy_version: "purchase_context_refund_v1",
      consent_text: "Test purchase context",
      consent_text_sha256: "b".repeat(64),
      accepted_at: postCutoffPaidAt,
      confirmation_provider: "test",
      confirmation_status: "delivered",
      confirmation_reference: "stage5-recovery-confirmation",
      confirmation_sent_at: postCutoffPaidAt,
      confirmation_delivered_at: postCutoffPaidAt,
      generation_started_at: postCutoffPaidAt,
      generation_completed_at: postCutoffPaidAt,
      generated_content_sha256: "c".repeat(64),
      delivery_provider: "test",
      delivery_reference: "stage5-recovery-delivery",
      delivered_at: postCutoffPaidAt,
    })
  if (consentError) throw new Error(consentError.message)
  const { error: purchaseError } = await admin.from("billing_one_time_purchases").insert({
    id: recoveryPurchaseId,
    user_id: userId,
    consent_id: recoveryConsentId,
    provider: "stripe",
    product_kind: "personal_plan_once",
    provider_transaction_id: "stage5-recovery-purchase",
    amount_minor: 2999,
    currency: "eur",
    status: "paid",
    paid_at: postCutoffPaidAt,
  })
  if (purchaseError) throw new Error(purchaseError.message)
}

async function seedAcceptedRoutine(userId: string) {
  const admin = createClient(
    requiredEnvironment("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnvironment("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
  const journey = await seedQualifyingPersonalPlanJourney(
    admin as unknown as BrowserSeedClient,
    userId,
  )
  const operations = [
    admin.from("products").insert([
      {
        id: shampooId,
        name: "Sanftes Shampoo",
        brand: "E2E",
        category: "shampoo",
        category_key: "shampoo",
        origin: "curated",
        is_active: false,
        lifecycle_status: "active",
        is_chaarlie_recommended: false,
        suitable_thicknesses: ["fine"],
        sort_order: 10,
      },
      {
        id: conditionerId,
        name: "Leichter Conditioner",
        brand: "E2E",
        category: "conditioner",
        category_key: "conditioner",
        origin: "curated",
        is_active: false,
        lifecycle_status: "active",
        is_chaarlie_recommended: false,
        suitable_thicknesses: ["fine"],
        suitable_concerns: ["feuchtigkeit"],
        sort_order: 20,
      },
    ]),
    admin.from("personal_plans").insert({ id: planId, user_id: userId }),
  ]
  for (const operation of operations) {
    const { error } = await operation
    if (error) throw new Error(error.message)
  }
  const productFacts = [
    admin.from("product_shampoo_specs").insert({
      product_id: shampooId,
      thickness: "fine",
      shampoo_bucket: "normal",
      scalp_route: "balanced",
      cleansing_intensity: "regular",
    }),
    admin.from("product_conditioner_specs").upsert(
      {
        product_id: conditionerId,
        thickness: "fine",
        protein_moisture_balance: "snaps",
      },
      { onConflict: "product_id,thickness,protein_moisture_balance" },
    ),
    admin.from("product_conditioner_rerank_specs").insert({
      product_id: conditionerId,
      weight: "light",
      repair_level: "low",
      balance_direction: "moisture",
    }),
  ]
  for (const operation of productFacts) {
    const { error } = await operation
    if (error) throw new Error(error.message)
  }
  seedCanonicalProductGuidance([
    {
      productId: shampooId,
      sourceGuidanceKey: "shampoo-standard-rinse-out-cleanse",
      guidanceKey: `stage5-browser-shampoo-${shampooId}`,
      role: "shampoo_everyday",
    },
    {
      productId: conditionerId,
      sourceGuidanceKey: "conditioner-standard-rinse-out-conditioning",
      guidanceKey: `stage5-browser-conditioner-${conditionerId}`,
      role: "conditioner_rinse_out",
    },
  ])
  const { error: activationError } = await admin
    .from("products")
    .update({ is_active: true, is_chaarlie_recommended: true })
    .in("id", [shampooId, conditionerId])
  if (activationError) throw new Error(activationError.message)
  const { error: initialError } = await admin.from("personal_plan_need_versions").insert({
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
  })
  if (initialError) throw new Error(initialError.message)
  const { error: refinedError } = await admin.from("personal_plan_need_versions").insert({
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
  })
  if (refinedError) throw new Error(refinedError.message)
  const { error: draftError } = await admin.from("personal_plan_product_drafts").insert({
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
    category_authority_versions: {
      shampoo: "stage5-browser-v1",
      conditioner: "stage5-browser-v1",
      leave_in: "stage5-browser-v1",
    },
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
    authority_versions: {
      shampoo: "stage5-browser-v1",
      conditioner: "stage5-browser-v1",
      leave_in: "stage5-browser-v1",
    },
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
  await expect(page.getByRole("heading", { name: "Anwendung", exact: true })).toBeVisible({
    timeout: 15_000,
  })
  const washDayCard = page.getByRole("link", { name: /^Waschtag/ })
  await expect(washDayCard).toBeVisible()
  await expect(page.getByText("Dein Plan wird noch vervollständigt")).toBeVisible()
  await expect(washDayCard).toContainText("1 Produkt vorläufig")
  await expect(washDayCard).toContainText("1 Anwendungsdetail offen")
  await page.screenshot({ path: testInfo.outputPath("overview-mobile-320.png"), fullPage: true })

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/anwendung/wash_day")
  await expect(page.getByRole("heading", { name: "Waschtag", exact: true })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Sanftes Shampoo", exact: true })).toBeVisible()
  await expect(
    page.getByRole("heading", { name: "Leichter Conditioner", exact: true }),
  ).toBeVisible()
  await expect(page.getByText("Vorläufig", { exact: true }).first()).toBeVisible()
  await expect(page.getByText(/seine Anwendung ist bereits bekannt/).first()).toBeVisible()
  await expect(page.getByRole("heading", { name: "Produkt noch offen" }).first()).toBeVisible()
  await expect(
    page.getByText(/Für diese Kategorie fehlen noch ein bestätigtes Produkt/).first(),
  ).toBeVisible()
  await expect(page.getByText("Ungeprüftes Leave-in", { exact: true })).toHaveCount(0)
  await expect(page.getByRole("link", { name: "Alle Tage" })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath("wash-day-mobile-top-390.png") })
  const lastApplicationContent = page
    .locator("p:visible")
    .filter({ hasText: "Für diese Kategorie fehlen noch ein bestätigtes Produkt" })
    .first()
  await lastApplicationContent.scrollIntoViewIfNeeded()
  const [lastContentBox, navigationBox] = await Promise.all([
    lastApplicationContent.boundingBox(),
    page.getByRole("navigation", { name: "Personal-Plan-Navigation" }).boundingBox(),
  ])
  expect(lastContentBox).not.toBeNull()
  expect(navigationBox).not.toBeNull()
  expect(lastContentBox!.y + lastContentBox!.height).toBeLessThanOrEqual(navigationBox!.y)
  await page.screenshot({ path: testInfo.outputPath("wash-day-mobile-bottom-390.png") })

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

test("new buyer without a plan resumes at readiness without exposing application content", async ({
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
  await seedQualifyingBuyerWithoutRoutine(
    admin as unknown as BrowserSeedClient,
    created.user.id,
    recoveryEmail,
  )

  await page.goto("/auth?next=/anwendung")
  const loginTab = page.getByRole("tab", { name: "Anmelden" })
  if (await loginTab.isVisible()) await loginTab.click()
  await page.locator('input[type="email"]:visible').fill(recoveryEmail)
  await page.locator('input[type="password"]:visible').fill(password)
  await page.getByRole("button", { name: "Anmelden", exact: true }).click()
  await page.waitForURL("**/plan-bereit")
  await expect(
    page.getByRole("heading", { name: "Das empfehlen wir für dein Haar." }),
  ).toBeVisible()
  await expect(
    page.getByRole("link", { name: "Bedarfsplan ansehen", exact: true }),
  ).toHaveAttribute("href", "/plan-start")
  await expect(page.getByText("Waschtag", { exact: true })).toHaveCount(0)
})
