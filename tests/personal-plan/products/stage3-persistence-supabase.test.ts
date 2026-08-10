import assert from "node:assert/strict"
import test from "node:test"

import { loadStage3AuthorityFactBundle } from "../../../src/lib/personal-plan/products/authority/catalog-facts"
import type { Stage3ProductDraft } from "../../../src/lib/personal-plan/products/contracts"
import { createSupabaseStage3ProductionPersistence } from "../../../src/lib/personal-plan/products/stage3-persistence-supabase"

test("draft creation persists the server-created immutable authority snapshot in CAS JSON", async () => {
  const createPayloads: Record<string, unknown>[] = []
  const refinedSnapshot = {
    inputHash: "refined-input-hash",
    profile: { source: { projection: "refined_post_plan" } },
    renderedOrder: ["shampoo"],
    decisions: [
      {
        category: "shampoo",
        resolution: "resolved",
        needTier: "basis",
        roles: ["shampoo_everyday"],
        target: {
          category: "shampoo",
          roles: ["shampoo_everyday"],
          scalpRoute: "balanced",
          everydayConstraint: "standard",
          requiresTargetedDandruffCapability: false,
        },
        frequency: null,
        reasons: [],
        executionState: "available",
        executionPauseReason: null,
        deferredFacts: [],
      },
    ],
    coverage: [
      {
        job: "wet_wash_cleansing",
        ruleId: "portfolio.shampoo.primary",
        primaryCategories: ["shampoo"],
        supportingCategories: [],
        outcome: "owned",
      },
    ],
  }
  const client = {
    from(table: string) {
      assert.equal(table, "personal_plan_need_versions")
      const chain = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: async () => ({
          data: { id: "refined-1", output_snapshot: refinedSnapshot },
          error: null,
        }),
      }
      return chain
    },
    async rpc(name: string, args: Record<string, unknown>) {
      assert.equal(name, "personal_plan_create_or_load_product_draft")
      createPayloads.push(args.p_payload as Record<string, unknown>)
      return {
        data: {
          id: "draft-1",
          user_id: "owner-1",
          personal_plan_id: "plan-1",
          refined_need_version_id: "refined-1",
          status: "active",
          revision: 0,
          pass: "product_capture",
          category_authority_versions: args.p_category_authority_versions,
          cursor: {
            categoryCursor: "shampoo",
            completedCaptureCategories: [],
            completedDecisionKeys: [],
          },
          payload: args.p_payload,
          created_at: "2026-08-08T00:00:00.000Z",
          updated_at: "2026-08-08T00:00:00.000Z",
        },
        error: null,
      }
    },
  }

  const persistence = createSupabaseStage3ProductionPersistence(client as never)
  const result = await persistence.loadOrCreate({
    userId: "owner-1",
    personalPlanId: "plan-1",
    refinedVersionId: "refined-1",
  })

  assert.ok(createPayloads[0]?.authoritySnapshot)
  assert.deepEqual(result.draft.authoritySnapshot, createPayloads[0]?.authoritySnapshot)
  assert.equal(result.draft.authoritySnapshot?.refinedInputHash, "refined-input-hash")
  assert.deepEqual(result.draft.authoritySnapshot?.coverage, refinedSnapshot.coverage)
})

function conditionerAuthorityDraft(): Stage3ProductDraft {
  return {
    schemaVersion: 1,
    status: "active",
    authorityVersions: { conditioner: "conditioner-v1" },
    draftId: "draft-1",
    userId: "owner-1",
    personalPlanId: "plan-1",
    refinedVersionId: "refined-1",
    staleRefinedVersionId: null,
    revision: 0,
    pass: "product_decisions",
    orderedCategories: ["conditioner"],
    categoryCursor: "conditioner",
    products: [
      {
        capturedProductId: "owned-1",
        userProductId: "user-product-1",
        identity: {
          kind: "catalog_product",
          productId: "conditioner-1",
          displayName: "Mehrfach spezifizierter Conditioner",
          category: "conditioner",
        },
        frequencyRange: "weekly_2x",
        ownership: "owned",
        source: "catalog_search",
      },
    ],
    roleAssignments: [
      {
        capturedProductId: "owned-1",
        category: "conditioner",
        roles: ["conditioner_rinse_out"],
      },
    ],
    uncoveredRoles: [],
    decisions: [],
    completedCaptureCategories: ["conditioner"],
    completedDecisionKeys: [],
    createdAt: "2026-08-08T00:00:00.000Z",
    updatedAt: "2026-08-08T00:00:00.000Z",
    authoritySnapshot: {
      schemaVersion: 1,
      refinedNeedVersionId: "refined-1",
      refinedInputHash: "input-1",
      authorityVersions: {
        shampoo: "shampoo-v1",
        conditioner: "conditioner-v1",
        leave_in: "leave-in-v1",
        heat_protectant: "heat-v1",
        oil: "oil-v1",
        mask: "mask-v1",
        scalp_care: "scalp-v1",
        dry_shampoo: "dry-shampoo-v1",
        bondbuilder: "bondbuilder-v1",
        deep_cleansing_shampoo: "deep-cleanse-v1",
      },
      categoryDecisions: [
        {
          category: "conditioner",
          resolution: "resolved",
          needTier: "basis",
          roles: ["conditioner_rinse_out"],
          target: {
            category: "conditioner",
            roles: ["conditioner_rinse_out"],
            weight: "light",
            careDirection: "moisture",
            repairSupportLevel: "medium",
            functionalNeeds: [],
          },
          frequency: null,
          reasons: [],
          executionState: "available",
          executionPauseReason: null,
          deferredFacts: [],
        },
      ],
      coverage: [],
      orderedCategories: ["conditioner"],
    },
  }
}

function authorityFactClient(
  conditionerSpecs: Record<string, unknown>[],
  timing: {
    ownedProductPending?: Promise<void>
    onRecommendationQueryStarted?: () => void
  } = {},
) {
  return {
    from(table: string) {
      const filters = new Map<string, unknown>()
      const result = () => {
        if (table === "products") {
          return filters.has("id")
            ? {
                data: {
                  id: "conditioner-1",
                  name: "Mehrfach spezifizierter Conditioner",
                  category_key: "conditioner",
                  is_active: true,
                  lifecycle_status: "active",
                  is_chaarlie_recommended: true,
                  suitable_thicknesses: ["normal"],
                },
                error: null,
              }
            : { data: [], error: null }
        }
        if (table === "product_conditioner_specs") return { data: conditionerSpecs, error: null }
        if (table === "product_conditioner_rerank_specs") {
          return {
            data: {
              weight: "light",
              repair_level: "medium",
              balance_direction: "moisture",
            },
            error: null,
          }
        }
        return { data: [], error: null }
      }
      const chain = {
        select: () => chain,
        eq: (column: string, value: unknown) => {
          filters.set(column, value)
          return chain
        },
        order: () => chain,
        limit: () => chain,
        maybeSingle: async () => {
          if (table === "products" && filters.has("id")) {
            await timing.ownedProductPending
          }
          if (table === "product_conditioner_specs") {
            return { data: null, error: { code: "PGRST116" } }
          }
          return result()
        },
        then: <T>(resolve: (value: unknown) => T | PromiseLike<T>) => {
          if (table === "products" && !filters.has("id")) {
            timing.onRecommendationQueryStarted?.()
          }
          return Promise.resolve(result()).then(resolve)
        },
      }
      return chain
    },
  }
}

test("individual authority evaluation overlaps independent fact reads", async () => {
  let releaseOwnedProduct!: () => void
  const ownedProductPending = new Promise<void>((resolve) => {
    releaseOwnedProduct = resolve
  })
  let recommendationStarted = false
  const bundlePending = loadStage3AuthorityFactBundle(
    authorityFactClient(
      [
        {
          thickness: "normal",
          protein_moisture_balance: "balanced",
        },
      ],
      {
        ownedProductPending,
        onRecommendationQueryStarted: () => {
          recommendationStarted = true
        },
      },
    ) as never,
    {
      draft: conditionerAuthorityDraft(),
      subject: {
        decisionKey: "decision:conditioner:conditioner_rinse_out:owned-1",
        category: "conditioner",
        role: "conditioner_rinse_out",
        capturedProductId: "owned-1",
        subjectKind: "captured_product",
      },
      heatRoutes: [],
      context: normalRefinedContext,
    } as never,
  )

  await new Promise((resolve) => setImmediate(resolve))
  const startedBeforeOwnedProductFinished = recommendationStarted
  releaseOwnedProduct()
  await bundlePending

  assert.equal(startedBeforeOwnedProductFinished, true)
})

function shampooAuthorityDraft(
  overrides: {
    role?: "shampoo_everyday" | "shampoo_dandruff"
    productId?: string
    scalpRoute?: "oily" | "balanced" | "dry"
    everydayConstraint?:
      | "standard"
      | "gentle_dry_scalp"
      | "irritation_compatible"
      | "gentle_dry_scalp_and_irritation_compatible"
  } = {},
): Stage3ProductDraft {
  const role = overrides.role ?? "shampoo_everyday"
  const productId = overrides.productId ?? "shampoo-1"
  const scalpRoute = overrides.scalpRoute ?? "balanced"
  const everydayConstraint = overrides.everydayConstraint ?? "standard"
  const draft = conditionerAuthorityDraft()
  return {
    ...draft,
    authorityVersions: { shampoo: "shampoo-v1" },
    orderedCategories: ["shampoo"],
    categoryCursor: "shampoo",
    products: [
      {
        ...draft.products[0]!,
        capturedProductId: "owned-shampoo-1",
        userProductId: "user-shampoo-1",
        identity: {
          kind: "catalog_product",
          productId,
          displayName: "Mehrfach spezifiziertes Shampoo",
          category: "shampoo",
        },
      },
    ],
    roleAssignments: [
      {
        capturedProductId: "owned-shampoo-1",
        category: "shampoo",
        roles: [role],
      },
    ],
    completedCaptureCategories: ["shampoo"],
    authoritySnapshot: {
      ...draft.authoritySnapshot!,
      categoryDecisions: [
        {
          category: "shampoo",
          resolution: "resolved",
          needTier: "basis",
          roles: [role],
          target: {
            category: "shampoo",
            roles: [role],
            scalpRoute,
            everydayConstraint,
            requiresTargetedDandruffCapability: role === "shampoo_dandruff",
          },
          frequency: null,
          reasons: [],
          executionState: "available",
          executionPauseReason: null,
          deferredFacts: [],
        },
      ],
      orderedCategories: ["shampoo"],
    },
  }
}

function shampooAuthorityFactClient(
  shampooSpecs: Record<string, unknown>[],
  recommendationProducts: Record<string, unknown>[] = [],
  exactProtocols: Record<string, unknown>[] = [],
  productId = "shampoo-1",
) {
  return {
    from(table: string) {
      const filters = new Map<string, unknown>()
      const result = () => {
        if (table === "products") {
          return filters.has("id")
            ? {
                data: {
                  id: productId,
                  name: "Mehrfach spezifiziertes Shampoo",
                  category_key: "shampoo",
                  is_active: true,
                  lifecycle_status: "active",
                  is_chaarlie_recommended: true,
                  suitable_thicknesses: ["normal"],
                },
                error: null,
              }
            : { data: recommendationProducts, error: null }
        }
        if (table === "product_shampoo_specs") return { data: shampooSpecs, error: null }
        if (table === "product_application_protocols") {
          return { data: exactProtocols, error: null }
        }
        return { data: [], error: null }
      }
      const chain = {
        select: () => chain,
        eq: (column: string, value: unknown) => {
          filters.set(column, value)
          return chain
        },
        order: () => chain,
        limit: () => chain,
        maybeSingle: async () => {
          if (table === "product_shampoo_specs" && shampooSpecs.length > 1) {
            return { data: null, error: { code: "PGRST116" } }
          }
          return result()
        },
        then: <T>(resolve: (value: unknown) => T | PromiseLike<T>) =>
          Promise.resolve(result()).then(resolve),
      }
      return chain
    },
  }
}

test("canonical exact guidance makes the matching Stage 3 product role protocol-complete", async () => {
  const productId = "11111111-1111-4111-8111-111111111111"
  const guidancePayload = {
    schemaVersion: 1,
    guidanceKey: `product-shampoo-${productId}`,
    protocolVersion: 1,
    locale: "de",
    scope: { kind: "product", category: "shampoo", productId },
    role: "cleanse",
    applicationFamily: "standard_rinse_out_cleanse",
    compatibleDayTypes: ["wash_day"],
    exactGuidanceRequired: true,
    sequence: {
      anchor: "wet_cleanse",
      before: [],
      after: [],
      conflictsWith: [],
    },
    requirements: {
      requiredCatalogFacts: [],
      requiredProtocolFacts: [],
      requiredProfileFacts: [],
    },
    protocolFacts: {
      applicationArea: "scalp_roots",
      rinse: "rinse_out",
      contactTimeSeconds: null,
      conditionerRelationship: "not_applicable",
      reapplication: "none",
      amount: null,
      cautions: [],
    },
    steps: [
      {
        stepKey: "apply-shampoo",
        action: "apply_product",
        copyTemplateDe: "Ins nasse Haar und auf die Kopfhaut einmassieren.",
      },
      { stepKey: "rinse-shampoo", action: "rinse", copyTemplateDe: "Gründlich ausspülen." },
    ],
    evidence: [
      {
        sourceUrl: "https://example.com/shampoo",
        sourceType: "manufacturer",
        checkedAt: "2026-08-10",
      },
    ],
  }
  const bundle = await loadStage3AuthorityFactBundle(
    shampooAuthorityFactClient(
      [
        {
          thickness: "normal",
          shampoo_bucket: "normal",
          scalp_route: "balanced",
          cleansing_intensity: "regular",
        },
      ],
      [],
      [
        {
          role: "shampoo_everyday",
          guidance_payload: guidancePayload,
          application_stage: null,
          application_state: null,
          placement: null,
          contact_time_seconds: null,
          rinse_action: null,
          reapplication: null,
          source_label: "Manufacturer",
          source_url: "https://example.com/shampoo",
          updated_at: "2026-08-10T09:00:00.000Z",
        },
      ],
      productId,
    ) as never,
    {
      draft: shampooAuthorityDraft({ productId }),
      subject: {
        decisionKey: "decision:shampoo:shampoo_everyday:owned-shampoo-1",
        category: "shampoo",
        role: "shampoo_everyday",
        capturedProductId: "owned-shampoo-1",
        subjectKind: "captured_product",
      },
      heatRoutes: [],
      context: normalRefinedContext,
    } as never,
  )

  assert.equal(
    bundle.productFacts?.protocols.find((protocol) => protocol.role === "shampoo_everyday")?.status,
    "verified_complete",
  )
})

const normalRefinedContext = {
  currentRefinedVersionId: "refined-1",
  hairThickness: "normal",
  refinedNeedSnapshot: {
    inputHash: "input-1",
    profile: {
      source: { projection: "refined_post_plan" },
      hair: { thickness: "normal" },
    },
  },
}

test("authority facts select a contextual Shampoo row without PGRST116", async () => {
  const bundle = await loadStage3AuthorityFactBundle(
    shampooAuthorityFactClient([
      {
        thickness: "fine",
        shampoo_bucket: "normal",
        scalp_route: "balanced",
        cleansing_intensity: "gentle",
      },
      {
        thickness: "normal",
        shampoo_bucket: "normal",
        scalp_route: "balanced",
        cleansing_intensity: "regular",
      },
    ]) as never,
    {
      draft: shampooAuthorityDraft(),
      subject: {
        decisionKey: "decision:shampoo:shampoo_everyday:owned-shampoo-1",
        category: "shampoo",
        role: "shampoo_everyday",
        capturedProductId: "owned-shampoo-1",
        subjectKind: "captured_product",
      },
      heatRoutes: [],
      context: normalRefinedContext,
    } as never,
  )

  assert.equal(bundle.productFacts?.category, "shampoo")
  if (bundle.productFacts?.category !== "shampoo") return
  assert.deepEqual(bundle.productFacts.spec, {
    thickness: "normal",
    shampooBucket: "normal",
    scalpRoute: "balanced",
    cleansingIntensity: "regular",
  })
})

for (const route of [
  {
    name: "oily",
    scalpRoute: "oily" as const,
    everydayConstraint: "standard" as const,
    role: "shampoo_everyday" as const,
    bucket: "dehydriert-fettig",
  },
  {
    name: "dry",
    scalpRoute: "dry" as const,
    everydayConstraint: "gentle_dry_scalp" as const,
    role: "shampoo_everyday" as const,
    bucket: "trocken",
  },
  {
    name: "irritation",
    scalpRoute: "balanced" as const,
    everydayConstraint: "irritation_compatible" as const,
    role: "shampoo_everyday" as const,
    bucket: "irritationen",
  },
  {
    name: "balanced",
    scalpRoute: "balanced" as const,
    everydayConstraint: "standard" as const,
    role: "shampoo_everyday" as const,
    bucket: "normal",
  },
  {
    name: "dandruff",
    scalpRoute: "oily" as const,
    everydayConstraint: "standard" as const,
    role: "shampoo_dandruff" as const,
    bucket: "schuppen",
  },
]) {
  test(`Shampoo catalog selection uses the exact signed ${route.name} bucket`, async () => {
    const bundle = await loadStage3AuthorityFactBundle(
      shampooAuthorityFactClient([
        {
          thickness: "normal",
          shampoo_bucket: route.bucket,
          scalp_route: route.scalpRoute,
          cleansing_intensity: "regular",
        },
      ]) as never,
      {
        draft: shampooAuthorityDraft(route),
        subject: {
          decisionKey: `decision:shampoo:${route.role}:owned-shampoo-1`,
          category: "shampoo",
          role: route.role,
          capturedProductId: "owned-shampoo-1",
          subjectKind: "captured_product",
        },
        heatRoutes: [],
        context: normalRefinedContext,
      } as never,
    )

    assert.equal(bundle.productFacts?.category, "shampoo")
    if (bundle.productFacts?.category !== "shampoo") return
    assert.equal(bundle.productFacts.spec.shampooBucket, route.bucket)
  })
}

test("distinct contextual Shampoo rows remain recoverably unknown", async () => {
  const common = {
    thickness: "normal",
    shampoo_bucket: "normal",
    scalp_route: "balanced",
  }
  const bundle = await loadStage3AuthorityFactBundle(
    shampooAuthorityFactClient([
      { ...common, cleansing_intensity: "gentle" },
      { ...common, cleansing_intensity: "regular" },
    ]) as never,
    {
      draft: shampooAuthorityDraft(),
      subject: {
        decisionKey: "decision:shampoo:shampoo_everyday:owned-shampoo-1",
        category: "shampoo",
        role: "shampoo_everyday",
        capturedProductId: "owned-shampoo-1",
        subjectKind: "captured_product",
      },
      heatRoutes: [],
      context: normalRefinedContext,
    } as never,
  )

  assert.equal(bundle.productFacts?.category, "shampoo")
  if (bundle.productFacts?.category !== "shampoo") return
  assert.equal(bundle.productFacts.spec.thickness, null)
  assert.equal(bundle.productFacts.spec.shampooBucket, null)
  assert.equal(bundle.productFacts.spec.scalpRoute, null)
  assert.equal(bundle.productFacts.spec.cleansingIntensity, null)
})

test("semantically identical contextual Shampoo rows canonicalize to one fact", async () => {
  const row = {
    thickness: "normal",
    shampoo_bucket: "normal",
    scalp_route: "balanced",
    cleansing_intensity: "regular",
  }
  const bundle = await loadStage3AuthorityFactBundle(
    shampooAuthorityFactClient([{ ...row }, { ...row }]) as never,
    {
      draft: shampooAuthorityDraft(),
      subject: {
        decisionKey: "decision:shampoo:shampoo_everyday:owned-shampoo-1",
        category: "shampoo",
        role: "shampoo_everyday",
        capturedProductId: "owned-shampoo-1",
        subjectKind: "captured_product",
      },
      heatRoutes: [],
      context: normalRefinedContext,
    } as never,
  )

  assert.equal(bundle.productFacts?.category, "shampoo")
  if (bundle.productFacts?.category !== "shampoo") return
  assert.deepEqual(bundle.productFacts.spec, {
    thickness: "normal",
    shampooBucket: "normal",
    scalpRoute: "balanced",
    cleansingIntensity: "regular",
  })
})

test("recommendation facts use stable sort order, German name, and product id tie-breaks", async () => {
  const draft = {
    ...shampooAuthorityDraft(),
    products: [],
    roleAssignments: [],
    uncoveredRoles: [
      {
        category: "shampoo" as const,
        role: "shampoo_everyday" as const,
        reason: "no_product_owned" as const,
      },
    ],
  }
  const product = (id: string, name: string, sortOrder: number) => ({
    id,
    name,
    sort_order: sortOrder,
    category_key: "shampoo",
    is_active: true,
    lifecycle_status: "active",
    is_chaarlie_recommended: true,
    suitable_thicknesses: ["normal"],
  })
  const client = shampooAuthorityFactClient(
    [
      {
        thickness: "normal",
        shampoo_bucket: "normal",
        scalp_route: "balanced",
        cleansing_intensity: "regular",
      },
    ],
    [
      product("product-z", "Zeta", 1),
      product("product-late", "Alpha", 2),
      product("product-a", "Alpha", 1),
    ],
  )

  const bundle = await loadStage3AuthorityFactBundle(
    client as never,
    {
      draft,
      subject: {
        decisionKey: "decision:shampoo:shampoo_everyday:gap",
        category: "shampoo",
        role: "shampoo_everyday",
        capturedProductId: null,
        subjectKind: "uncovered_role",
      },
      heatRoutes: [],
      context: normalRefinedContext,
    } as never,
  )

  assert.deepEqual(
    bundle.recommendationCandidates.map((candidate) => candidate.productId),
    ["product-a", "product-z", "product-late"],
  )
})

test("authority facts select the single Conditioner spec matching the signed target", async () => {
  const bundle = await loadStage3AuthorityFactBundle(
    authorityFactClient([
      { thickness: "normal", protein_moisture_balance: "snaps" },
      { thickness: "normal", protein_moisture_balance: "stretches_stays" },
    ]) as never,
    {
      draft: conditionerAuthorityDraft(),
      subject: {
        decisionKey: "decision:conditioner:conditioner_rinse_out:owned-1",
        category: "conditioner",
        role: "conditioner_rinse_out",
        capturedProductId: "owned-1",
        subjectKind: "captured_product",
      },
      heatRoutes: [],
      context: normalRefinedContext,
    } as never,
  )

  assert.equal(bundle.productFacts?.category, "conditioner")
  if (bundle.productFacts?.category !== "conditioner") return
  assert.equal(bundle.productFacts.knownReaction, false)
  assert.equal(bundle.productFacts.spec.thickness, "normal")
  assert.equal(bundle.productFacts.spec.proteinMoistureBalance, "moisture")
})

test("Conditioner selection also filters by the actual refined thickness", async () => {
  const bundle = await loadStage3AuthorityFactBundle(
    authorityFactClient([
      { thickness: "fine", protein_moisture_balance: "snaps" },
      { thickness: "normal", protein_moisture_balance: "snaps" },
    ]) as never,
    {
      draft: conditionerAuthorityDraft(),
      subject: {
        decisionKey: "decision:conditioner:conditioner_rinse_out:owned-1",
        category: "conditioner",
        role: "conditioner_rinse_out",
        capturedProductId: "owned-1",
        subjectKind: "captured_product",
      },
      heatRoutes: [],
      context: normalRefinedContext,
    } as never,
  )

  assert.equal(bundle.productFacts?.category, "conditioner")
  if (bundle.productFacts?.category !== "conditioner") return
  assert.equal(bundle.productFacts.spec.thickness, "normal")
  assert.equal(bundle.productFacts.spec.proteinMoistureBalance, "moisture")
})

test("incomplete Conditioner specs remain unknown", async () => {
  const bundle = await loadStage3AuthorityFactBundle(
    authorityFactClient([{ thickness: "normal", protein_moisture_balance: null }]) as never,
    {
      draft: conditionerAuthorityDraft(),
      subject: {
        decisionKey: "decision:conditioner:conditioner_rinse_out:owned-1",
        category: "conditioner",
        role: "conditioner_rinse_out",
        capturedProductId: "owned-1",
        subjectKind: "captured_product",
      },
      heatRoutes: [],
      context: normalRefinedContext,
    } as never,
  )

  assert.equal(bundle.productFacts?.category, "conditioner")
  if (bundle.productFacts?.category !== "conditioner") return
  assert.equal(bundle.productFacts.spec.thickness, null)
  assert.equal(bundle.productFacts.spec.proteinMoistureBalance, null)
})

test("Oil combines every eligibility row while its product spec stays singular", async () => {
  const base = conditionerAuthorityDraft()
  const draft: Stage3ProductDraft = {
    ...base,
    authorityVersions: { oil: "oil-v1" },
    orderedCategories: ["oil"],
    categoryCursor: "oil",
    products: [
      {
        ...base.products[0]!,
        capturedProductId: "owned-oil-1",
        userProductId: "user-oil-1",
        identity: {
          kind: "catalog_product",
          productId: "oil-1",
          displayName: "Mehrzwecköl",
          category: "oil",
        },
      },
    ],
    roleAssignments: [
      {
        capturedProductId: "owned-oil-1",
        category: "oil",
        roles: ["dry_finish"],
      },
    ],
    completedCaptureCategories: ["oil"],
    authoritySnapshot: {
      ...base.authoritySnapshot!,
      categoryDecisions: [
        {
          category: "oil",
          resolution: "resolved",
          needTier: "basis",
          roles: ["dry_finish"],
          target: {
            category: "oil",
            roles: ["dry_finish"],
            roleTargets: [
              {
                role: "dry_finish",
                tier: "basis",
                weight: "light",
                functionalBenefits: [],
              },
            ],
          },
          frequency: null,
          reasons: [],
          executionState: "available",
          executionPauseReason: null,
          deferredFacts: [],
        },
      ],
      orderedCategories: ["oil"],
    },
  }
  let oilEligibilityMaybeSingleCalls = 0
  let oilSpecMaybeSingleCalls = 0
  const client = {
    from(table: string) {
      const filters = new Map<string, unknown>()
      const result = () => {
        if (table === "products") {
          return filters.has("id")
            ? {
                data: {
                  id: "oil-1",
                  name: "Mehrzwecköl",
                  category_key: "oil",
                  is_active: true,
                  lifecycle_status: "active",
                  is_chaarlie_recommended: true,
                  suitable_thicknesses: ["normal"],
                },
                error: null,
              }
            : { data: [], error: null }
        }
        if (table === "product_oil_specs") {
          return { data: { provides_heat_protection: false }, error: null }
        }
        if (table === "product_oil_eligibility") {
          return {
            data: [
              { thickness: "normal", oil_purpose: "pre_wash_oiling" },
              { thickness: "normal", oil_purpose: "styling_finish" },
            ],
            error: null,
          }
        }
        return { data: [], error: null }
      }
      const chain = {
        select: () => chain,
        eq: (column: string, value: unknown) => {
          filters.set(column, value)
          return chain
        },
        order: () => chain,
        limit: () => chain,
        maybeSingle: async () => {
          if (table === "product_oil_eligibility") oilEligibilityMaybeSingleCalls += 1
          if (table === "product_oil_specs") oilSpecMaybeSingleCalls += 1
          return result()
        },
        then: <T>(resolve: (value: unknown) => T | PromiseLike<T>) =>
          Promise.resolve(result()).then(resolve),
      }
      return chain
    },
  }

  const bundle = await loadStage3AuthorityFactBundle(
    client as never,
    {
      draft,
      subject: {
        decisionKey: "decision:oil:dry_finish:owned-oil-1",
        category: "oil",
        role: "dry_finish",
        capturedProductId: "owned-oil-1",
        subjectKind: "captured_product",
      },
      heatRoutes: [],
      context: normalRefinedContext,
    } as never,
  )

  assert.equal(bundle.productFacts?.category, "oil")
  if (bundle.productFacts?.category !== "oil") return
  assert.deepEqual(bundle.productFacts.spec.roleSupport, {
    pre_wash_fibre_treatment: true,
    dry_finish: true,
  })
  assert.equal(oilEligibilityMaybeSingleCalls, 0)
  assert.ok(oilSpecMaybeSingleCalls >= 1)
})
