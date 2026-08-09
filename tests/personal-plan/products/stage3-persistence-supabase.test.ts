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

function authorityFactClient(conditionerSpecs: Record<string, unknown>[]) {
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
          if (table === "product_conditioner_specs") {
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
    },
  )

  assert.equal(bundle.productFacts?.category, "conditioner")
  if (bundle.productFacts?.category !== "conditioner") return
  assert.equal(bundle.productFacts.knownReaction, false)
  assert.equal(bundle.productFacts.spec.thickness, "normal")
  assert.equal(bundle.productFacts.spec.proteinMoistureBalance, "moisture")
})

test("ambiguous Conditioner specs remain unknown instead of selecting the first row", async () => {
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
    },
  )

  assert.equal(bundle.productFacts?.category, "conditioner")
  if (bundle.productFacts?.category !== "conditioner") return
  assert.equal(bundle.productFacts.spec.thickness, null)
  assert.equal(bundle.productFacts.spec.proteinMoistureBalance, null)
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
    },
  )

  assert.equal(bundle.productFacts?.category, "conditioner")
  if (bundle.productFacts?.category !== "conditioner") return
  assert.equal(bundle.productFacts.spec.thickness, null)
  assert.equal(bundle.productFacts.spec.proteinMoistureBalance, null)
})
