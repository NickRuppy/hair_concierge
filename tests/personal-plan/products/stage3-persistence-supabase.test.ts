import assert from "node:assert/strict"
import test from "node:test"

import {
  loadStage3AuthorityFactBundle,
  loadStage3HeatCarrierCoverage,
  loadStage3RecommendationCandidates,
} from "../../../src/lib/personal-plan/products/authority/catalog-facts"
import { loadCatalogBatchSnapshot } from "../../../src/lib/personal-plan/products/authority/catalog-batching"
import type { Stage3ProductDraft } from "../../../src/lib/personal-plan/products/contracts"
import { CATEGORY_ROLE_POLICIES } from "../../../src/lib/personal-plan/products/authorities"
import {
  createSupabaseStage3ProductionPersistence,
  openSupabaseStage3OptionalInventory,
} from "../../../src/lib/personal-plan/products/stage3-persistence-supabase"
import { createStage3Draft } from "../../../src/lib/personal-plan/products/state-machine"

const shampooSearchContext = {
  hairThickness: "normal" as const,
  requiredRoles: ["shampoo_everyday"],
  shampooTargets: [{ thickness: "normal", shampooBucket: "normal", scalpRoute: "balanced" }],
  conditionerTarget: null,
}

const optionalInventoryRefinedSnapshot = {
  inputHash: "a".repeat(64),
  profile: {
    source: { projection: "refined_post_plan" },
    concerns: [],
    scalp: { oiliness: "balanced", concerns: [] },
    hair: { thickness: "normal" },
    routine: {
      currentProductLoad: {
        state: "known",
        value: { categories: ["shampoo", "conditioner"], oilPurposes: [] },
      },
      shampooFrequency: { state: "known", value: "weekly_2x" },
    },
  },
  renderedOrder: ["shampoo", "conditioner"],
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
    {
      category: "conditioner",
      resolution: "resolved",
      needTier: "basis",
      roles: ["conditioner_rinse_out"],
      target: {
        category: "conditioner",
        roles: ["conditioner_rinse_out"],
      },
      frequency: null,
      reasons: [],
      executionState: "available",
      executionPauseReason: null,
      deferredFacts: [],
    },
  ],
  coverage: [],
}

test("optional inventory entry imports only through the dedicated handoff RPC", async () => {
  const calls: Array<{ table?: string; name?: string; args?: Record<string, unknown> }> = []
  const client = {
    from(table: string) {
      calls.push({ table })
      const chain = {
        select: () => chain,
        eq: () => chain,
        in: () => chain,
        order: () => chain,
        limit: () => chain,
        maybeSingle: async () => {
          if (table === "personal_plans") {
            return {
              data: {
                enrollment_purchase_source_id: "44444444-4444-4444-8444-444444444444",
                active_routine_version_id: "55555555-5555-4555-8555-555555555555",
                legacy_prefill_v1: { stage2: { outcome: "applied" } },
              },
              error: null,
            }
          }
          if (table === "personal_plan_migration_enrollments") {
            return {
              data: { id: "44444444-4444-4444-8444-444444444444" },
              error: null,
            }
          }
          if (table === "personal_plan_need_versions") {
            return {
              data: { id: "refined-1", output_snapshot: optionalInventoryRefinedSnapshot },
              error: null,
            }
          }
          if (table === "personal_plan_refinement_drafts") {
            return {
              data: {
                id: "handoff-1",
                module_projections: {
                  products: { needVersionId: "refined-1", stage3Handoff: true },
                },
              },
              error: null,
            }
          }
          if (table === "personal_plan_product_drafts") {
            return { data: null, error: null }
          }
          throw new Error(`unexpected maybeSingle for ${table}`)
        },
        then(resolve: (value: unknown) => unknown) {
          if (table === "user_product_usage") {
            return Promise.resolve({
              data: [
                {
                  id: "usage-1",
                  category: "shampoo",
                  product_name: "Exact Shampoo",
                  frequency_range: "weekly_2x",
                  product_id: "11111111-1111-4111-8111-111111111111",
                },
                {
                  id: "usage-2",
                  category: "conditioner",
                  product_name: "Retired Conditioner",
                  frequency_range: "weekly_2x",
                  product_id: "33333333-3333-4333-8333-333333333333",
                },
              ],
              error: null,
            }).then(resolve)
          }
          if (table === "personal_plan_product_search_dispositions") {
            return Promise.resolve({
              data: [{ product_id: "33333333-3333-4333-8333-333333333333" }],
              error: null,
            }).then(resolve)
          }
          if (table === "products") {
            return Promise.resolve({
              data: [
                {
                  id: "11111111-1111-4111-8111-111111111111",
                  brand: "Exact",
                  name: "Exact Shampoo",
                  category_key: "shampoo",
                  image_url: null,
                  thumbnail_image_url: null,
                  is_active: true,
                  lifecycle_status: "active",
                  origin: "curated",
                  product_line: null,
                },
                {
                  id: "33333333-3333-4333-8333-333333333333",
                  brand: "Retired",
                  name: "Retired Conditioner",
                  category_key: "conditioner",
                  image_url: null,
                  thumbnail_image_url: null,
                  is_active: true,
                  lifecycle_status: "active",
                  origin: "curated",
                  product_line: null,
                },
              ],
              error: null,
            }).then(resolve)
          }
          return Promise.resolve({ data: [], error: null }).then(resolve)
        },
      }
      return chain
    },
    async rpc(name: string, args: Record<string, unknown>) {
      calls.push({ name, args })
      assert.equal(name, "personal_plan_open_optional_inventory_v1")
      const payload = args.p_payload as Record<string, unknown>
      assert.deepEqual(args.p_exact_inventory, [
        {
          usageId: "usage-1",
          productId: "11111111-1111-4111-8111-111111111111",
          displayName: "Exact Shampoo",
          category: "shampoo",
          frequencyRange: "weekly_2x",
        },
      ])
      assert.deepEqual(payload.legacyPrefillHints, {
        schemaVersion: 1,
        sourceFingerprint: args.p_source_fingerprint,
        categories: {
          conditioner: [
            {
              kind: "search_name",
              usageId: "usage-2",
              category: "conditioner",
              productName: "Retired Conditioner",
            },
          ],
        },
      })
      return {
        data: {
          outcome: "ready",
          draft: {
            id: "draft-optional",
            user_id: "owner-1",
            personal_plan_id: "plan-1",
            refined_need_version_id: "refined-1",
            status: "active",
            revision: 0,
            contract_version: 1,
            category_authority_versions: args.p_category_authority_versions,
            pass: "product_capture",
            cursor: {
              categoryCursor: "shampoo",
              completedCaptureCategories: [],
              completedDecisionKeys: [],
            },
            payload: {
              ...payload,
              products: [
                {
                  capturedProductId: "legacy-prefill:usage-1",
                  userProductId: "22222222-2222-4222-8222-222222222222",
                  identity: {
                    kind: "catalog_product",
                    productId: "11111111-1111-4111-8111-111111111111",
                    displayName: "Exact Shampoo",
                    category: "shampoo",
                    imageUrl: null,
                  },
                  frequencyRange: "weekly_2x",
                  ownership: "owned",
                  source: "existing_inventory",
                },
              ],
            },
            created_at: "2026-08-28T00:00:00.000Z",
            updated_at: "2026-08-28T00:00:00.000Z",
          },
        },
        error: null,
      }
    },
  }

  const result = await openSupabaseStage3OptionalInventory(client as never, {
    userId: "owner-1",
    personalPlanId: "plan-1",
    refinedVersionId: "refined-1",
  })

  assert.equal(result.status, "active")
  assert.equal(result.draft.products[0]?.source, "existing_inventory")
  assert.equal(result.draft.products[0]?.userProductId, "22222222-2222-4222-8222-222222222222")
  assert.equal(result.requirements[0]?.category, "shampoo")
  assert.deepEqual(result.draft.legacyPrefillHints, {
    schemaVersion: 1,
    sourceFingerprint: result.draft.legacyPrefillHints?.sourceFingerprint,
    categories: {
      conditioner: [
        {
          kind: "search_name",
          usageId: "usage-2",
          category: "conditioner",
          productName: "Retired Conditioner",
        },
      ],
    },
  })
  assert.equal(
    calls.some((call) => call.table === "hair_profiles"),
    false,
  )
  assert.equal(
    calls.some((call) => call.name === "personal_plan_create_or_load_product_draft"),
    false,
  )
})

test("optional inventory entry falls back to generic Stage 3 draft opening without a migration binding", async () => {
  const calls: Array<{ table?: string; name?: string; args?: Record<string, unknown> }> = []
  const client = {
    from(table: string) {
      calls.push({ table })
      const chain = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: async () => {
          if (table === "personal_plans") {
            return {
              data: {
                enrollment_purchase_source_id: null,
                active_routine_version_id: null,
                legacy_prefill_v1: { stage2: { outcome: "applied" } },
              },
              error: null,
            }
          }
          if (table === "personal_plan_need_versions") {
            return {
              data: { id: "refined-1", output_snapshot: optionalInventoryRefinedSnapshot },
              error: null,
            }
          }
          throw new Error(`unexpected maybeSingle for ${table}`)
        },
      }
      return chain
    },
    async rpc(name: string, args: Record<string, unknown>) {
      calls.push({ name, args })
      assert.equal(name, "personal_plan_create_or_load_product_draft")
      return {
        data: {
          id: "draft-generic",
          user_id: "owner-1",
          personal_plan_id: "plan-1",
          refined_need_version_id: "refined-1",
          status: "active",
          revision: 0,
          contract_version: 1,
          category_authority_versions: args.p_category_authority_versions,
          pass: "product_capture",
          cursor: {
            categoryCursor: "shampoo",
            completedCaptureCategories: [],
            completedDecisionKeys: [],
          },
          payload: args.p_payload,
          created_at: "2026-08-28T00:00:00.000Z",
          updated_at: "2026-08-28T00:00:00.000Z",
        },
        error: null,
      }
    },
  }

  const result = await openSupabaseStage3OptionalInventory(client as never, {
    userId: "owner-1",
    personalPlanId: "plan-1",
    refinedVersionId: "refined-1",
  })

  assert.equal(result.status, "active")
  assert.equal(result.draft.draftId, "draft-generic")
  assert.deepEqual(
    calls.flatMap((call) => (call.table ? [call.table] : [])),
    ["personal_plans", "personal_plan_need_versions"],
  )
  assert.equal(
    calls.some((call) => call.table === "personal_plan_migration_enrollments"),
    false,
  )
  assert.equal(
    calls.some((call) => call.table === "user_product_usage"),
    false,
  )
  assert.equal(
    calls.some((call) => call.name === "personal_plan_open_optional_inventory_v1"),
    false,
  )
})

test("optional inventory entry does not read legacy inventory after the Stage 3 receipt was consumed", async () => {
  const calls: Array<{ table?: string; name?: string; args?: Record<string, unknown> }> = []
  const client = {
    from(table: string) {
      calls.push({ table })
      const chain = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: async () => {
          if (table === "personal_plans") {
            return {
              data: {
                enrollment_purchase_source_id: "44444444-4444-4444-8444-444444444444",
                active_routine_version_id: "55555555-5555-4555-8555-555555555555",
                legacy_prefill_v1: { stage3Inventory: { outcome: "imported" } },
              },
              error: null,
            }
          }
          if (table === "personal_plan_need_versions") {
            return {
              data: { id: "refined-2", output_snapshot: optionalInventoryRefinedSnapshot },
              error: null,
            }
          }
          if (table === "user_product_usage") {
            throw new Error("legacy inventory must not be read after receipt consumption")
          }
          throw new Error(`unexpected maybeSingle for ${table}`)
        },
      }
      return chain
    },
    async rpc(name: string, args: Record<string, unknown>) {
      calls.push({ name, args })
      assert.equal(name, "personal_plan_create_or_load_product_draft")
      const payload = args.p_payload as Record<string, unknown>
      assert.deepEqual(payload.products, [])
      return {
        data: {
          id: "draft-new-refined",
          user_id: "owner-1",
          personal_plan_id: "plan-1",
          refined_need_version_id: "refined-2",
          status: "active",
          revision: 0,
          contract_version: 1,
          category_authority_versions: args.p_category_authority_versions,
          pass: "product_capture",
          cursor: {
            categoryCursor: "shampoo",
            completedCaptureCategories: [],
            completedDecisionKeys: [],
          },
          payload,
          created_at: "2026-08-28T00:00:00.000Z",
          updated_at: "2026-08-28T00:00:00.000Z",
        },
        error: null,
      }
    },
  }

  const result = await openSupabaseStage3OptionalInventory(client as never, {
    userId: "owner-1",
    personalPlanId: "plan-1",
    refinedVersionId: "refined-2",
  })

  assert.equal(result.draft.draftId, "draft-new-refined")
  assert.equal(
    calls.some((call) => call.table === "personal_plan_migration_enrollments"),
    false,
  )
  assert.equal(
    calls.some((call) => call.table === "user_product_usage"),
    false,
  )
  assert.equal(
    calls.some((call) => call.name === "personal_plan_open_optional_inventory_v1"),
    false,
  )
})

test("optional inventory entry consumes a skipped receipt without reading legacy rows when a Stage 3 draft exists", async () => {
  const calls: Array<{ table?: string; name?: string; args?: Record<string, unknown> }> = []
  const client = {
    from(table: string) {
      calls.push({ table })
      const chain = {
        select: () => chain,
        eq: () => chain,
        in: () => chain,
        order: () => chain,
        limit: () => chain,
        maybeSingle: async () => {
          if (table === "personal_plans") {
            return {
              data: {
                enrollment_purchase_source_id: "44444444-4444-4444-8444-444444444444",
                active_routine_version_id: "55555555-5555-4555-8555-555555555555",
                legacy_prefill_v1: { stage2: { outcome: "applied" } },
              },
              error: null,
            }
          }
          if (table === "personal_plan_migration_enrollments") {
            return {
              data: { id: "44444444-4444-4444-8444-444444444444" },
              error: null,
            }
          }
          if (table === "personal_plan_need_versions") {
            return {
              data: { id: "refined-1", output_snapshot: optionalInventoryRefinedSnapshot },
              error: null,
            }
          }
          if (table === "personal_plan_refinement_drafts") {
            return {
              data: {
                id: "handoff-1",
                module_projections: {
                  products: { needVersionId: "refined-1", stage3Handoff: true },
                },
              },
              error: null,
            }
          }
          if (table === "personal_plan_product_drafts") {
            return { data: { id: "draft-existing" }, error: null }
          }
          if (table === "user_product_usage") {
            throw new Error("legacy inventory must not be read when a Stage 3 draft already exists")
          }
          throw new Error(`unexpected maybeSingle for ${table}`)
        },
      }
      return chain
    },
    async rpc(name: string, args: Record<string, unknown>) {
      calls.push({ name, args })
      assert.equal(name, "personal_plan_open_optional_inventory_v1")
      assert.deepEqual(args.p_exact_inventory, [])
      assert.equal(args.p_source_fingerprint, "legacy-prefill-v1:skipped-existing-stage3")
      return {
        data: {
          outcome: "ready",
          draft: {
            id: "draft-existing",
            user_id: "owner-1",
            personal_plan_id: "plan-1",
            refined_need_version_id: "refined-1",
            status: "active",
            revision: 2,
            contract_version: 1,
            category_authority_versions: args.p_category_authority_versions,
            pass: "product_capture",
            cursor: {
              categoryCursor: "conditioner",
              completedCaptureCategories: ["shampoo"],
              completedDecisionKeys: [],
            },
            payload: {
              ...(args.p_payload as Record<string, unknown>),
              products: [],
              categoryCursor: "conditioner",
              completedCaptureCategories: ["shampoo"],
            },
            created_at: "2026-08-28T00:00:00.000Z",
            updated_at: "2026-08-28T00:00:00.000Z",
          },
        },
        error: null,
      }
    },
  }

  const result = await openSupabaseStage3OptionalInventory(client as never, {
    userId: "owner-1",
    personalPlanId: "plan-1",
    refinedVersionId: "refined-1",
  })

  assert.equal(result.draft.draftId, "draft-existing")
  assert.deepEqual(result.draft.products, [])
  assert.equal(
    calls.some((call) => call.table === "user_product_usage"),
    false,
  )
  assert.equal(
    calls.some((call) => call.table === "products"),
    false,
  )
})

test("optional inventory entry finds the exact products handoff instead of trusting the newest refinement draft", async () => {
  const calls: Array<{ table?: string; name?: string; args?: Record<string, unknown> }> = []
  const handoffFilters: Array<[string, unknown]> = []
  const client = {
    from(table: string) {
      calls.push({ table })
      const chain = {
        select: () => chain,
        eq: (column: string, value: unknown) => {
          if (table === "personal_plan_refinement_drafts") handoffFilters.push([column, value])
          return chain
        },
        in: () => chain,
        order: () => chain,
        limit: () => chain,
        maybeSingle: async () => {
          if (table === "personal_plans") {
            return {
              data: {
                enrollment_purchase_source_id: "44444444-4444-4444-8444-444444444444",
                legacy_prefill_v1: { stage2: { outcome: "applied" } },
              },
              error: null,
            }
          }
          if (table === "personal_plan_migration_enrollments") {
            return { data: { id: "44444444-4444-4444-8444-444444444444" }, error: null }
          }
          if (table === "personal_plan_need_versions") {
            return {
              data: { id: "refined-1", output_snapshot: optionalInventoryRefinedSnapshot },
              error: null,
            }
          }
          if (table === "personal_plan_refinement_drafts") {
            const hasExactNeed = handoffFilters.some(
              ([column, value]) =>
                column === "module_projections->products->>needVersionId" && value === "refined-1",
            )
            const hasStage3Handoff = handoffFilters.some(
              ([column, value]) =>
                column === "module_projections->products->>stage3Handoff" && value === "true",
            )
            return hasExactNeed && hasStage3Handoff
              ? { data: { id: "older-valid-products-handoff" }, error: null }
              : {
                  data: {
                    id: "newer-unrelated-habits-draft",
                    module_projections: {
                      products: { needVersionId: "other-refined", stage3Handoff: false },
                    },
                  },
                  error: null,
                }
          }
          if (table === "personal_plan_product_drafts") return { data: null, error: null }
          throw new Error(`unexpected maybeSingle for ${table}`)
        },
        then(resolve: (value: unknown) => unknown) {
          if (table === "user_product_usage")
            return Promise.resolve({ data: [], error: null }).then(resolve)
          if (table === "products") return Promise.resolve({ data: [], error: null }).then(resolve)
          if (table === "personal_plan_product_search_dispositions") {
            return Promise.resolve({ data: [], error: null }).then(resolve)
          }
          if (table === "user_products")
            return Promise.resolve({ data: [], error: null }).then(resolve)
          return Promise.resolve({ data: [], error: null }).then(resolve)
        },
      }
      return chain
    },
    async rpc(name: string, args: Record<string, unknown>) {
      calls.push({ name, args })
      assert.equal(name, "personal_plan_open_optional_inventory_v1")
      return {
        data: {
          outcome: "ready",
          draft: {
            id: "draft-optional",
            user_id: "owner-1",
            personal_plan_id: "plan-1",
            refined_need_version_id: "refined-1",
            status: "active",
            revision: 0,
            contract_version: 1,
            category_authority_versions: args.p_category_authority_versions,
            pass: "product_capture",
            cursor: {
              categoryCursor: "shampoo",
              completedCaptureCategories: [],
              completedDecisionKeys: [],
            },
            payload: args.p_payload,
            created_at: "2026-08-28T00:00:00.000Z",
            updated_at: "2026-08-28T00:00:00.000Z",
          },
        },
        error: null,
      }
    },
  }

  const result = await openSupabaseStage3OptionalInventory(client as never, {
    userId: "owner-1",
    personalPlanId: "plan-1",
    refinedVersionId: "refined-1",
  })

  assert.equal(result.draft.draftId, "draft-optional")
  assert.equal(
    handoffFilters.some(
      ([column, value]) =>
        column === "module_projections->products->>needVersionId" && value === "refined-1",
    ),
    true,
  )
  assert.equal(
    handoffFilters.some(
      ([column, value]) =>
        column === "module_projections->products->>stage3Handoff" && value === "true",
    ),
    true,
  )
})

test("optional inventory entry fails closed when SQL rejects the paid migration source", async () => {
  const rpcNames: string[] = []
  const client = {
    from(table: string) {
      const chain = {
        select: () => chain,
        eq: () => chain,
        in: () => chain,
        order: () => chain,
        limit: () => chain,
        maybeSingle: async () => {
          if (table === "personal_plans") {
            return {
              data: {
                enrollment_purchase_source_id: "44444444-4444-4444-8444-444444444444",
                legacy_prefill_v1: { stage2: { outcome: "applied" } },
              },
              error: null,
            }
          }
          if (table === "personal_plan_migration_enrollments") {
            return { data: { id: "44444444-4444-4444-8444-444444444444" }, error: null }
          }
          if (table === "personal_plan_need_versions") {
            return {
              data: { id: "refined-1", output_snapshot: optionalInventoryRefinedSnapshot },
              error: null,
            }
          }
          if (table === "personal_plan_refinement_drafts")
            return { data: { id: "handoff-1" }, error: null }
          if (table === "personal_plan_product_drafts") return { data: null, error: null }
          throw new Error(`unexpected maybeSingle for ${table}`)
        },
        then(resolve: (value: unknown) => unknown) {
          return Promise.resolve({ data: [], error: null }).then(resolve)
        },
      }
      return chain
    },
    async rpc(name: string) {
      rpcNames.push(name)
      assert.equal(name, "personal_plan_open_optional_inventory_v1")
      return { data: { outcome: "invalid_source" }, error: null }
    },
  }

  await assert.rejects(
    () =>
      openSupabaseStage3OptionalInventory(client as never, {
        userId: "owner-1",
        personalPlanId: "plan-1",
        refinedVersionId: "refined-1",
      }),
    /stage3_optional_inventory_open_rejected/,
  )
  assert.deepEqual(rpcNames, ["personal_plan_open_optional_inventory_v1"])
})

test("draft hydration drops malformed legacy prefill hints without rejecting the draft", async () => {
  const client = {
    from(table: string) {
      const chain = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: async () => {
          if (table === "personal_plans") {
            return {
              data: { enrollment_purchase_source_id: null, legacy_prefill_v1: null },
              error: null,
            }
          }
          if (table === "personal_plan_need_versions") {
            return {
              data: { id: "refined-1", output_snapshot: optionalInventoryRefinedSnapshot },
              error: null,
            }
          }
          throw new Error(`unexpected maybeSingle for ${table}`)
        },
      }
      return chain
    },
    async rpc(name: string, args: Record<string, unknown>) {
      assert.equal(name, "personal_plan_create_or_load_product_draft")
      return {
        data: {
          id: "draft-generic",
          user_id: "owner-1",
          personal_plan_id: "plan-1",
          refined_need_version_id: "refined-1",
          status: "active",
          revision: 0,
          contract_version: 1,
          category_authority_versions: args.p_category_authority_versions,
          pass: "product_capture",
          cursor: {
            categoryCursor: "shampoo",
            completedCaptureCategories: [],
            completedDecisionKeys: [],
          },
          payload: {
            ...(args.p_payload as Record<string, unknown>),
            legacyPrefillHints: {
              schemaVersion: 1,
              sourceFingerprint: "legacy-prefill-v1:sha256:" + "f".repeat(64),
              categories: {
                shampoo: [{ kind: "search_name", usageId: "usage-1", category: "conditioner" }],
              },
            },
          },
          created_at: "2026-08-28T00:00:00.000Z",
          updated_at: "2026-08-28T00:00:00.000Z",
        },
        error: null,
      }
    },
  }

  const result = await openSupabaseStage3OptionalInventory(client as never, {
    userId: "owner-1",
    personalPlanId: "plan-1",
    refinedVersionId: "refined-1",
  })

  assert.equal(result.draft.draftId, "draft-generic")
  assert.equal(result.draft.legacyPrefillHints, undefined)
})

test("completed receipt selects the earliest routine when successors share its portfolio", async () => {
  const filtersByTable = new Map<string, Map<string, unknown>>()
  const limitedTables = new Set<string>()
  const orderByTable = new Map<string, { column: string; ascending: boolean }>()
  const portfolio = {
    schemaVersion: 1,
    portfolioVersionId: "portfolio-initial",
    personalPlanId: "plan-1",
    refinedVersionId: "refined-1",
    sourceDraftRevision: 5,
    categoryResolutions: [],
    ownedProducts: [],
    plannedPurchases: [],
    pendingProducts: [],
    uncoveredRoles: [],
    createdAt: "2026-08-08T00:00:00.000Z",
  }
  const client = {
    from(table: string) {
      const filters = new Map<string, unknown>()
      filtersByTable.set(table, filters)
      const chain = {
        select: () => chain,
        eq: (column: string, value: unknown) => {
          filters.set(column, value)
          return chain
        },
        order: (column: string, options: { ascending: boolean }) => {
          orderByTable.set(table, { column, ascending: options.ascending })
          return chain
        },
        limit: () => {
          limitedTables.add(table)
          return chain
        },
        maybeSingle: async () => {
          if (table === "personal_plan_portfolio_versions") {
            return { data: { id: "portfolio-initial", snapshot: portfolio }, error: null }
          }
          if (table === "personal_plan_routine_versions") {
            return filters.get("source_portfolio_version_id") === "portfolio-initial" &&
              limitedTables.has(table)
              ? { data: { id: "routine-initial" }, error: null }
              : { data: null, error: { message: "multiple routines share the portfolio" } }
          }
          if (table === "personal_plan_routine_proposals") {
            return { data: { id: "proposal-initial" }, error: null }
          }
          throw new Error(`unexpected table ${table}`)
        },
      }
      return chain
    },
  }
  const persistence = createSupabaseStage3ProductionPersistence(client as never)

  const receipt = await persistence.loadCompletionReceipt?.({
    userId: "owner-1",
    draftId: "draft-shared-by-successor",
  })

  assert.equal(receipt?.productPortfolioVersionId, "portfolio-initial")
  assert.equal(receipt?.routineVersionId, "routine-initial")
  assert.equal(receipt?.routineProposalId, "proposal-initial")
  assert.equal(
    filtersByTable.get("personal_plan_routine_versions")?.get("source_portfolio_version_id"),
    "portfolio-initial",
  )
  assert.equal(
    filtersByTable.get("personal_plan_routine_versions")?.has("source_product_draft_id"),
    false,
  )
  assert.deepEqual(orderByTable.get("personal_plan_routine_versions"), {
    column: "created_at",
    ascending: true,
  })
  assert.equal(limitedTables.has("personal_plan_routine_versions"), true)
})

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

function legacyShampooRefreshDraft(refinedSnapshot: { decisions: unknown[] }): Stage3ProductDraft {
  return createStage3Draft({
    draftId: "draft-1",
    userId: "owner-1",
    personalPlanId: "plan-1",
    refinedVersionId: "refined-1",
    requirements: [
      {
        category: "shampoo",
        requiredRoles: ["shampoo_everyday"],
        needSummary: "Reinigung",
        authorityVersion: "personal-plan.shampoo.v3",
      },
    ],
    authoritySnapshot: {
      schemaVersion: 1,
      refinedNeedVersionId: "refined-1",
      refinedInputHash: "refined-input-hash",
      categoryDecisions: refinedSnapshot.decisions as never,
      coverage: [],
      orderedCategories: ["shampoo"],
      authorityVersions: {
        ...Object.fromEntries(
          Object.entries(CATEGORY_ROLE_POLICIES).map(([category, policy]) => [
            category,
            policy.authorityVersion,
          ]),
        ),
        shampoo: "personal-plan.shampoo.v3",
      } as never,
    },
    now: "2026-08-08T00:00:00.000Z",
  })
}

test("authority refresh preserves captured state through the dedicated CAS boundary", async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = []
  const refinedSnapshot = {
    inputHash: "refined-input-hash",
    profile: {
      source: { projection: "refined_post_plan" },
      hair: { thickness: "normal" },
    },
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
    coverage: [],
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
      calls.push({ name, args })
      return {
        data: {
          outcome: "saved",
          draft: {
            id: "draft-1",
            user_id: "owner-1",
            personal_plan_id: "plan-1",
            refined_need_version_id: "refined-1",
            status: "active",
            revision: 5,
            pass: (args.p_payload as Record<string, unknown>).pass,
            category_authority_versions: args.p_category_authority_versions,
            cursor: args.p_cursor,
            payload: args.p_payload,
            created_at: "2026-08-08T00:00:00.000Z",
            updated_at: "2026-08-15T10:00:00.000Z",
          },
        },
        error: null,
      }
    },
  }
  const persistence = createSupabaseStage3ProductionPersistence(client as never) as ReturnType<
    typeof createSupabaseStage3ProductionPersistence
  > & {
    refreshAuthorityDraft(input: {
      userId: string
      draftId: string
      expectedRevision: number
      personalPlanId: string
      refinedVersionId: string
      draft: Stage3ProductDraft
    }): Promise<{ outcome: string; draft: Stage3ProductDraft }>
  }
  const legacyDraft = legacyShampooRefreshDraft(refinedSnapshot)
  legacyDraft.products = [
    {
      capturedProductId: "captured-shampoo",
      userProductId: "user-product-shampoo",
      identity: {
        kind: "catalog_product",
        productId: "catalog-shampoo",
        displayName: "Mein Shampoo",
        category: "shampoo",
      },
      frequencyRange: "weekly_2x",
      ownership: "owned",
      source: "catalog_search",
    },
  ]

  const result = await persistence.refreshAuthorityDraft({
    userId: "owner-1",
    draftId: "draft-1",
    expectedRevision: 4,
    personalPlanId: "plan-1",
    refinedVersionId: "refined-1",
    draft: legacyDraft,
  })

  assert.equal(result.outcome, "saved")
  assert.equal(calls.length, 1)
  assert.equal(calls[0]?.name, "personal_plan_refresh_product_draft_authority")
  assert.equal(calls[0]?.args.p_expected_revision, 4)
  assert.equal(
    (calls[0]?.args.p_category_authority_versions as Record<string, string>).shampoo,
    "personal-plan.shampoo.v4",
  )
  assert.equal(
    (
      (calls[0]?.args.p_payload as Record<string, unknown>).authoritySnapshot as {
        authorityVersions: Record<string, string>
      }
    ).authorityVersions.shampoo,
    "personal-plan.shampoo.v4",
  )
  assert.deepEqual(result.draft.decisions, [])
  assert.deepEqual(result.draft.products, legacyDraft.products)
})

test("authority refresh fails closed when SQL rejects a non-exact legacy transition", async () => {
  const refinedSnapshot = {
    inputHash: "refined-input-hash",
    profile: { source: { projection: "refined_post_plan" }, hair: { thickness: "normal" } },
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
    coverage: [],
  }
  const client = {
    from() {
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
    async rpc() {
      return { data: { outcome: "invalid_source" }, error: null }
    },
  }
  const persistence = createSupabaseStage3ProductionPersistence(client as never)
  const legacyDraft = legacyShampooRefreshDraft(refinedSnapshot)

  await assert.rejects(
    () =>
      persistence.refreshAuthorityDraft!({
        userId: "owner-1",
        draftId: "draft-1",
        expectedRevision: 4,
        personalPlanId: "plan-1",
        refinedVersionId: "refined-1",
        draft: legacyDraft,
      }),
    /stage3_authority_refresh_rejected/,
  )
})

test("draft creation turns an RPC stale source into a typed refined-source restart", async () => {
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
    coverage: [],
  }
  const client = {
    from() {
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
    async rpc() {
      return { data: { outcome: "stale_source" }, error: null }
    },
  }
  const persistence = createSupabaseStage3ProductionPersistence(client as never)

  await assert.rejects(
    () =>
      persistence.loadOrCreate({
        userId: "owner-1",
        personalPlanId: "plan-1",
        refinedVersionId: "refined-1",
      }),
    (error: unknown) =>
      error instanceof Error &&
      error.name === "Stage3AuthoritySnapshotError" &&
      error.message === "stale_refined_source",
  )
})

test("owned-product search presents one brand plus the complete line and product title", async () => {
  const client = {
    async rpc(name: string, args: { p_query: string }) {
      assert.equal(name, "personal_plan_search_assessment_products_v2")
      const rows = [
        {
          product_id: "ogx-renewing",
          brand_name: "OGX",
          product_line_name: "Renewing + Argan Oil of Morocco",
          product_name: "OGX Renewing + Argan Oil of Morocco Shampoo",
          image_url: "https://example.test/ogx.webp",
          sort_order: 1,
          category_key: "shampoo",
          assessment_status: "ready",
          assessment_reason_codes: [],
          total_capped: false,
        },
        {
          product_id: "balea-professional",
          brand_name: "Balea",
          product_line_name: "Professional",
          product_name: "Balea Professional Shampoo Tiefenreinigung",
          image_url: null,
          sort_order: 2,
          category_key: "shampoo",
          assessment_status: "ready",
          assessment_reason_codes: [],
          total_capped: false,
        },
      ]
      return {
        data: rows.filter((row) =>
          `${row.brand_name} ${row.product_line_name} ${row.product_name}`
            .toLocaleLowerCase()
            .includes(args.p_query.toLocaleLowerCase()),
        ),
        error: null,
      }
    },
  }

  const persistence = createSupabaseStage3ProductionPersistence(client as never)
  const ogx = await persistence.search({
    userId: "owner-1",
    category: "shampoo",
    query: "ogx renewing",
    requestToken: 1,
    assessmentContext: shampooSearchContext,
  })
  const balea = await persistence.search({
    userId: "owner-1",
    category: "shampoo",
    query: "balea professional",
    requestToken: 2,
    assessmentContext: shampooSearchContext,
  })

  assert.deepEqual(
    ogx.candidates.map((candidate) => [candidate.brandName, candidate.displayName]),
    [["OGX", "Renewing + Argan Oil of Morocco Shampoo"]],
  )
  assert.deepEqual(
    balea.candidates.map((candidate) => [candidate.brandName, candidate.displayName]),
    [["Balea", "Professional Shampoo Tiefenreinigung"]],
  )
})

test("owned-product search delegates active identity and assessment readiness to the set-based RPC", async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = []
  const client = {
    async rpc(name: string, args: Record<string, unknown>) {
      calls.push({ name, args })
      return {
        data: [
          {
            product_id: "ogx-renewing",
            category_key: "shampoo",
            brand_name: "OGX",
            product_line_name: "Renewing + Argan Oil of Morocco",
            product_name: "Shampoo",
            image_url: "https://example.test/ogx.webp",
            sort_order: 1,
            assessment_status: "ready",
            assessment_reason_codes: [],
            total_capped: false,
          },
          {
            product_id: "pending-shampoo",
            category_key: "shampoo",
            brand_name: "Acme",
            product_line_name: null,
            product_name: "Unvollständiges Shampoo",
            image_url: null,
            sort_order: 2,
            assessment_status: "pending_analysis",
            assessment_reason_codes: ["missing_required_spec"],
            total_capped: false,
          },
        ],
        error: null,
      }
    },
  }

  const persistence = createSupabaseStage3ProductionPersistence(client as never)
  const result = await persistence.search({
    userId: "owner-1",
    category: "shampoo",
    query: "ogx",
    requestToken: 4,
    assessmentContext: shampooSearchContext,
  })

  assert.deepEqual(calls, [
    {
      name: "personal_plan_search_assessment_products_v2",
      args: {
        p_user_id: "owner-1",
        p_category: "shampoo",
        p_query: "ogx",
        p_limit: 8,
        p_context: shampooSearchContext,
      },
    },
  ])
  assert.deepEqual(
    result.candidates.map((candidate) => ({
      brand: candidate.brandName,
      name: candidate.displayName,
      status: candidate.assessmentStatus,
      reasons: candidate.assessmentReasonCodes,
    })),
    [
      {
        brand: "OGX",
        name: "Renewing + Argan Oil of Morocco Shampoo",
        status: "ready",
        reasons: [],
      },
      {
        brand: "Acme",
        name: "Unvollständiges Shampoo",
        status: "pending_analysis",
        reasons: ["missing_required_spec"],
      },
    ],
  )
})

test("thumbnail-enabled search calls v3 and keeps canonical and compact URLs separate", async () => {
  const calls: string[] = []
  const client = {
    async rpc(name: string) {
      calls.push(name)
      return {
        data: [
          {
            product_id: "sante-conditioner",
            category_key: "conditioner",
            brand_name: "Sante",
            product_line_name: null,
            product_name: "Deep Repair Conditioner",
            image_url: "https://example.test/canonical.webp",
            thumbnail_image_url: "https://example.test/thumbnail.webp",
            sort_order: 1,
            assessment_status: "ready",
            assessment_reason_codes: [],
            total_capped: false,
          },
        ],
        error: null,
      }
    },
  }

  const persistence = createSupabaseStage3ProductionPersistence(client as never, {
    thumbnailsEnabled: true,
  })
  const result = await persistence.search({
    userId: "owner-1",
    category: "conditioner",
    query: "sante",
    requestToken: 9,
    assessmentContext: { ...shampooSearchContext, conditionerTarget: null },
  })

  assert.deepEqual(calls, ["personal_plan_search_assessment_products_v3"])
  assert.equal(result.candidates[0]?.imageUrl, "https://example.test/canonical.webp")
  assert.equal(result.candidates[0]?.thumbnailImageUrl, "https://example.test/thumbnail.webp")
})

test("selected owned-product resolution persists the complete brand, line, and title identity", async () => {
  let selectedColumns = ""
  const client = {
    from(table: string) {
      assert.equal(table, "products")
      const chain = {
        select: (columns: string) => {
          selectedColumns = columns
          return chain
        },
        eq: () => chain,
        maybeSingle: async () => ({
          data: {
            id: "ogx-renewing",
            brand: "OGX",
            name: "OGX Renewing + Argan Oil of Morocco Shampoo",
            product_line: { canonical_name: "Renewing + Argan Oil of Morocco" },
            image_url: "https://example.test/ogx.webp",
            category_key: "shampoo",
            is_active: true,
            lifecycle_status: "active",
          },
          error: null,
        }),
      }
      return chain
    },
    async rpc(name: string) {
      assert.equal(name, "personal_plan_create_or_reuse_user_product")
      return {
        data: {
          outcome: "ready",
          userProduct: {
            id: "owned-1",
            catalog_product_id: "ogx-renewing",
            category: "shampoo",
          },
        },
        error: null,
      }
    },
  }

  const persistence = createSupabaseStage3ProductionPersistence(client as never)
  const resolved = await persistence.resolveOwnedCatalogProduct({
    userId: "owner-1",
    category: "shampoo",
    candidateId: "ogx-renewing",
  })

  assert.match(selectedColumns, /brand/)
  assert.match(selectedColumns, /product_lines\(canonical_name\)/)
  assert.equal(resolved?.displayName, "OGX Renewing + Argan Oil of Morocco Shampoo")
})

test("direct Stage 3 capture cannot claim another owner's submitted catalog product", async () => {
  let createOrReuseCalled = false
  const client = {
    from(table: string) {
      const chain = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: async () =>
          table === "products"
            ? {
                data: {
                  id: "submitted-1",
                  brand: "Private Brand",
                  name: "Private Shampoo",
                  image_url: null,
                  category_key: "shampoo",
                  origin: "user_submitted",
                  is_active: true,
                  lifecycle_status: "active",
                  product_line: null,
                },
                error: null,
              }
            : { data: null, error: null },
      }
      return chain
    },
    async rpc() {
      createOrReuseCalled = true
      return { data: null, error: null }
    },
  }
  const persistence = createSupabaseStage3ProductionPersistence(client as never)

  const resolved = await persistence.resolveOwnedCatalogProduct({
    userId: "owner-1",
    category: "shampoo",
    candidateId: "submitted-1",
  })

  assert.equal(resolved, null)
  assert.equal(createOrReuseCalled, false)
})

test("completion identity lookup is owner-bound and restores brand, line, and saleable title", async () => {
  const selectedByTable = new Map<string, string>()
  const client = {
    from(table: string) {
      const chain = {
        select: (columns: string) => {
          selectedByTable.set(table, columns)
          return chain
        },
        eq: () => chain,
        maybeSingle: async () =>
          table === "user_products"
            ? {
                data: {
                  id: "owned-1",
                  catalog_product_id: "ogx-renewing",
                  category: "shampoo",
                  identity_status: "matched",
                  ownership_status: "owned",
                },
                error: null,
              }
            : {
                data: {
                  id: "ogx-renewing",
                  brand: "OGX",
                  name: "OGX Renewing + Argan Oil of Morocco Shampoo",
                  product_line: { canonical_name: "Renewing + Argan Oil of Morocco" },
                  image_url: "https://example.test/ogx.webp",
                  category_key: "shampoo",
                  is_active: true,
                  lifecycle_status: "active",
                },
                error: null,
              },
      }
      return chain
    },
  }

  const persistence = createSupabaseStage3ProductionPersistence(client as never)
  const resolved = await persistence.loadCurrentCatalogProduct({
    userId: "owner-1",
    userProductId: "owned-1",
    productId: "ogx-renewing",
    category: "shampoo",
  })

  assert.match(selectedByTable.get("user_products") ?? "", /ownership_status/)
  assert.match(selectedByTable.get("products") ?? "", /product_lines\(canonical_name\)/)
  assert.deepEqual(resolved, {
    userProductId: "owned-1",
    productId: "ogx-renewing",
    displayName: "OGX Renewing + Argan Oil of Morocco Shampoo",
    imageUrl: "https://example.test/ogx.webp",
    category: "shampoo",
  })
})

test("thumbnail-enabled current product lookup exposes an ephemeral compact URL", async () => {
  const client = {
    from(table: string) {
      const chain = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: async () =>
          table === "user_products"
            ? {
                data: {
                  id: "owned-1",
                  catalog_product_id: "catalog-1",
                  category: "conditioner",
                  identity_status: "matched",
                  ownership_status: "owned",
                },
                error: null,
              }
            : {
                data: {
                  id: "catalog-1",
                  brand: "Sante",
                  name: "Conditioner",
                  image_url: "https://example.test/canonical.webp",
                  thumbnail_image_url: "https://example.test/thumbnail.webp",
                  category_key: "conditioner",
                  is_active: true,
                  lifecycle_status: "active",
                  product_line: null,
                },
                error: null,
              },
      }
      return chain
    },
  }
  const persistence = createSupabaseStage3ProductionPersistence(client as never, {
    thumbnailsEnabled: true,
  })

  const resolved = await persistence.loadCurrentCatalogProduct({
    userId: "owner-1",
    userProductId: "owned-1",
    productId: "catalog-1",
    category: "conditioner",
  })

  assert.equal(resolved?.thumbnailImageUrl, "https://example.test/thumbnail.webp")
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

test("a guarded save exposes refined-source drift without fabricating an obsolete SQL draft", async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = []
  const client = {
    async rpc(name: string, args: Record<string, unknown>) {
      calls.push({ name, args })
      return { data: { outcome: "stale_source" }, error: null }
    },
  }
  const draft = conditionerAuthorityDraft()
  const persistence = createSupabaseStage3ProductionPersistence(client as never)

  const result = await persistence.save({
    userId: draft.userId,
    draftId: draft.draftId,
    expectedRevision: draft.revision,
    draft,
  })

  assert.equal(result.outcome, "stale_source")
  assert.equal(result.draft, draft)
  assert.equal(calls[0]?.name, "personal_plan_save_product_draft")
  assert.equal(calls[0]?.args.p_expected_revision, draft.revision)
})

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

function completeCatalogFactClient(
  rowsByTable: Record<string, readonly Record<string, unknown>[]>,
  calls: Array<{
    table: string
    range: [number, number] | null
    inIds: string[] | null
    exactCount: boolean
  }>,
  options: {
    countOffsetByTable?: Partial<Record<string, number>>
    errorTables?: readonly string[]
  } = {},
) {
  return {
    from(table: string) {
      const filters = new Map<string, unknown>()
      let inFilter: { column: string; values: string[] } | null = null
      let exactCount = false
      let selectedColumns = "*"
      let limit: number | null = null
      const materialize = (range: [number, number] | null) => {
        let rows = [...(rowsByTable[table] ?? [])]
        for (const [column, value] of filters) {
          rows = rows.filter((row) => row[column] === value)
        }
        if (inFilter) {
          const activeFilter = inFilter
          rows = rows.filter((row) =>
            activeFilter.values.includes(String(row[activeFilter.column])),
          )
        }
        const count = rows.length + (options.countOffsetByTable?.[table] ?? 0)
        const bounded = range
          ? rows.slice(range[0], range[1] + 1)
          : limit === null
            ? rows
            : rows.slice(0, limit)
        const selected =
          selectedColumns === "*"
            ? bounded
            : bounded.map((row) =>
                Object.fromEntries(
                  selectedColumns
                    .split(",")
                    .map((column) => column.trim())
                    .filter((column) => column in row)
                    .map((column) => [column, row[column]]),
                ),
              )
        calls.push({
          table,
          range,
          inIds: inFilter ? [...inFilter.values] : null,
          exactCount,
        })
        return {
          data: selected,
          error: options.errorTables?.includes(table) ? { code: "fixture_error" } : null,
          count: exactCount ? count : null,
        }
      }
      const chain = {
        select: (columns: string, options?: { count?: string }) => {
          selectedColumns = columns
          exactCount = options?.count === "exact"
          return chain
        },
        eq: (column: string, value: unknown) => {
          filters.set(column, value)
          return chain
        },
        in: (column: string, values: string[]) => {
          inFilter = { column, values: [...values] }
          return chain
        },
        order: () => chain,
        limit: (value: number) => {
          limit = value
          return chain
        },
        range: async (from: number, to: number) => materialize([from, to]),
        then: <T>(resolve: (value: unknown) => T | PromiseLike<T>) =>
          Promise.resolve(materialize(null)).then(resolve),
      }
      return chain
    },
  }
}

test("multi-row batch sources page to exact completion", async () => {
  const calls: Array<{
    table: string
    range: [number, number] | null
    inIds: string[] | null
    exactCount: boolean
  }> = []
  const rows = Array.from({ length: 550 }, (_, index) => ({
    product_id: "candidate-1",
    sequence: index,
  }))

  const snapshot = await loadCatalogBatchSnapshot(
    completeCatalogFactClient({ product_shampoo_specs: rows }, calls) as never,
    [
      {
        table: "product_shampoo_specs",
        key: "product_id",
        select: "*",
        cardinality: "many",
        orderBy: ["product_id", "sequence"],
      },
    ],
    ["candidate-1"],
    { chunkSize: 100, pageSize: 500 },
  )

  assert.equal(snapshot?.get("product_shampoo_specs")?.get("candidate-1")?.length, 550)
  assert.deepEqual(
    calls.map((call) => call.range),
    [
      [0, 499],
      [500, 999],
    ],
  )
})

test("complete candidate hydration crosses product pages and bounded fact chunks", async () => {
  const productCount = 505
  const products = Array.from({ length: productCount }, (_, index) => {
    const id = `shampoo-${String(index + 1).padStart(4, "0")}`
    return {
      id,
      name: `Shampoo ${index + 1}`,
      image_url: null,
      category_key: "shampoo",
      is_active: true,
      lifecycle_status: "active",
      is_chaarlie_recommended: true,
      suitable_thicknesses: ["normal"],
      sort_order: index + 1,
      price_eur: null,
      price_checked_at: null,
      purchase_link_status: null,
      net_content_value: null,
      net_content_unit: null,
    }
  })
  const rowsByTable = {
    products,
    product_shampoo_specs: products.map((product) => ({
      product_id: product.id,
      thickness: "normal",
      shampoo_bucket: "normal",
      scalp_route: "balanced",
      cleansing_intensity: "gentle",
    })),
    product_application_protocols: [],
    application_guidance_protocols: products.map((product) => ({
      product_id: product.id,
      id: `guidance-${product.id}`,
      role_key: "shampoo_everyday",
      protocol_version: 1,
      verified_at: "2026-08-14T00:00:00.000Z",
      updated_at: "2026-08-14T00:00:00.000Z",
      scope_kind: "product",
      status: "active",
      locale: "de",
    })),
  }
  const calls: Array<{
    table: string
    range: [number, number] | null
    inIds: string[] | null
    exactCount: boolean
  }> = []
  const draft = shampooAuthorityDraft()
  const candidates = await loadStage3RecommendationCandidates(
    completeCatalogFactClient(rowsByTable, calls) as never,
    {
      draft,
      subject: {
        decisionKey: "decision:shampoo:shampoo_everyday:owned-shampoo-1",
        category: "shampoo",
        role: "shampoo_everyday",
        capturedProductId: "owned-shampoo-1",
        subjectKind: "captured_product",
      },
      context: normalRefinedContext as never,
    },
  )

  assert.equal(candidates.length, productCount)
  assert.equal(candidates.at(-1)?.productId, "shampoo-0505")
  assert.deepEqual(
    calls.filter((call) => call.table === "products").map((call) => call.range),
    [
      [0, 499],
      [500, 999],
    ],
  )
  assert.deepEqual(
    calls
      .filter((call) => call.table === "product_shampoo_specs")
      .map((call) => call.inIds?.length),
    [100, 100, 100, 100, 100, 5],
  )
  assert.equal(
    calls.every((call) => call.exactCount),
    true,
  )
})

test("canonical authority loading preserves deterministic fingerprints", async () => {
  const rowsByTable = {
    products: [
      {
        id: "candidate-1",
        name: "Candidate",
        image_url: null,
        category_key: "shampoo",
        is_active: true,
        lifecycle_status: "active",
        is_chaarlie_recommended: true,
        suitable_thicknesses: ["normal"],
        sort_order: 1,
      },
    ],
    product_shampoo_specs: [
      {
        product_id: "candidate-1",
        thickness: "normal",
        shampoo_bucket: "normal",
        scalp_route: "balanced",
        cleansing_intensity: "gentle",
      },
    ],
    product_application_protocols: [
      {
        product_id: "candidate-1",
        role: "shampoo_dandruff",
        guidance_payload: null,
        application_stage: null,
        application_state: null,
        placement: null,
        contact_time_seconds: null,
        rinse_action: null,
        reapplication: null,
        source_label: "Manufacturer",
        source_url: "https://example.com/shampoo",
        updated_at: "2026-08-14T00:00:00.000Z",
      },
    ],
    application_guidance_protocols: [
      {
        product_id: "candidate-1",
        id: "guidance-1",
        role_key: "shampoo_everyday",
        protocol_version: 1,
        verified_at: "2026-08-14T00:00:00.000Z",
        updated_at: "2026-08-14T00:00:00.000Z",
        scope_kind: "product",
        status: "active",
        locale: "de",
      },
    ],
  }
  const input = {
    draft: shampooAuthorityDraft(),
    subject: {
      decisionKey: "decision:shampoo:shampoo_everyday:owned-1",
      category: "shampoo",
      role: "shampoo_everyday",
      capturedProductId: null,
      subjectKind: "uncovered_role",
    },
    context: normalRefinedContext,
  } as const

  const [first, second] = await Promise.all([
    loadStage3RecommendationCandidates(
      completeCatalogFactClient(rowsByTable, []) as never,
      {
        ...input,
      } as never,
    ),
    loadStage3RecommendationCandidates(
      completeCatalogFactClient(rowsByTable, []) as never,
      {
        ...input,
      } as never,
    ),
  ])

  assert.equal(first.length, 1)
  assert.equal(second.length, 1)
  assert.equal(first[0]?.factFingerprint, second[0]?.factFingerprint)
  assert.deepEqual(first[0]?.protocols, second[0]?.protocols)
})

test("direct preview candidate loading remains bounded to the legacy catalog path", async () => {
  const products = Array.from({ length: 13 }, (_, index) => ({
    id: `preview-shampoo-${String(index + 1).padStart(2, "0")}`,
    name: `Preview Shampoo ${index + 1}`,
    image_url: null,
    category_key: "shampoo",
    is_active: true,
    lifecycle_status: "active",
    is_chaarlie_recommended: true,
    suitable_thicknesses: ["normal"],
    sort_order: index + 1,
  }))
  const calls: Array<{
    table: string
    range: [number, number] | null
    inIds: string[] | null
    exactCount: boolean
  }> = []
  const candidates = await loadStage3RecommendationCandidates(
    completeCatalogFactClient(
      {
        products,
        product_shampoo_specs: products.map((product) => ({
          product_id: product.id,
          thickness: "normal",
          shampoo_bucket: "normal",
          scalp_route: "balanced",
          cleansing_intensity: "gentle",
        })),
        product_application_protocols: [],
        application_guidance_protocols: products.map((product) => ({
          product_id: product.id,
          id: `guidance-${product.id}`,
          role_key: "shampoo_everyday",
          protocol_version: 1,
          verified_at: "2026-08-14T00:00:00.000Z",
          updated_at: "2026-08-14T00:00:00.000Z",
          scope_kind: "product",
          status: "active",
          locale: "de",
        })),
      },
      calls,
    ) as never,
    {
      category: "shampoo",
      hairThickness: "normal",
      role: "shampoo_everyday",
      shampooTarget: {
        category: "shampoo",
        roles: ["shampoo_everyday"],
        scalpRoute: "balanced",
        everydayConstraint: "standard",
        requiresTargetedDandruffCapability: false,
      },
      conditionerTarget: null,
    },
  )

  assert.equal(candidates.length, 12)
  assert.equal(candidates.at(-1)?.productId, "preview-shampoo-12")
  assert.equal(
    calls.some((call) => call.range !== null || call.inIds !== null || call.exactCount),
    false,
  )
})

test("explicit direct audit loading reads the complete catalogue with exact cardinality", async () => {
  const products = Array.from({ length: 13 }, (_, index) => ({
    id: `audit-shampoo-${String(index + 1).padStart(2, "0")}`,
    name: `Audit Shampoo ${index + 1}`,
    image_url: null,
    category_key: "shampoo",
    is_active: true,
    lifecycle_status: "active",
    is_chaarlie_recommended: true,
    suitable_thicknesses: ["normal"],
    sort_order: index + 1,
  }))
  const calls: Array<{
    table: string
    range: [number, number] | null
    inIds: string[] | null
    exactCount: boolean
  }> = []
  const candidates = await loadStage3RecommendationCandidates(
    completeCatalogFactClient(
      {
        products,
        product_shampoo_specs: products.map((product) => ({
          product_id: product.id,
          thickness: "normal",
          shampoo_bucket: "normal",
          scalp_route: "balanced",
          cleansing_intensity: "gentle",
        })),
        product_application_protocols: [],
        application_guidance_protocols: products.map((product) => ({
          product_id: product.id,
          id: `guidance-${product.id}`,
          role_key: "shampoo_everyday",
          protocol_version: 1,
          verified_at: "2026-08-14T00:00:00.000Z",
          updated_at: "2026-08-14T00:00:00.000Z",
          scope_kind: "product",
          status: "active",
          locale: "de",
        })),
      },
      calls,
    ) as never,
    {
      category: "shampoo",
      hairThickness: "normal",
      role: "shampoo_everyday",
      shampooTarget: {
        category: "shampoo",
        roles: ["shampoo_everyday"],
        scalpRoute: "balanced",
        everydayConstraint: "standard",
        requiresTargetedDandruffCapability: false,
      },
      conditionerTarget: null,
      completeCatalog: true,
    },
  )

  assert.equal(candidates.length, 13)
  assert.equal(candidates.at(-1)?.productId, "audit-shampoo-13")
  assert.equal(calls.find((call) => call.table === "products")?.exactCount, true)
  assert.ok(calls.some((call) => call.inIds?.length === 13))
})

test("complete hydration fails closed when exact product cardinality is not satisfied", async () => {
  await assert.rejects(
    () =>
      loadStage3RecommendationCandidates(
        completeCatalogFactClient(
          {
            products: [
              {
                id: "candidate-1",
                name: "Candidate",
                category_key: "shampoo",
                is_active: true,
                lifecycle_status: "active",
                is_chaarlie_recommended: true,
                suitable_thicknesses: ["normal"],
                sort_order: 1,
              },
            ],
          },
          [],
          { countOffsetByTable: { products: 1 } },
        ) as never,
        {
          draft: shampooAuthorityDraft(),
          subject: {
            decisionKey: "decision:shampoo:shampoo_everyday:owned-1",
            category: "shampoo",
            role: "shampoo_everyday",
            capturedProductId: null,
            subjectKind: "uncovered_role",
          },
          context: normalRefinedContext,
        } as never,
      ),
    /stage3_authority_catalog_unavailable/,
  )
})

test("complete hydration uses the category-specific batch source for every category", async () => {
  const scenarios = [
    {
      category: "shampoo",
      role: "shampoo_everyday",
      table: "product_shampoo_specs",
      rows: {
        product_shampoo_specs: [
          {
            product_id: "candidate-1",
            thickness: "normal",
            shampoo_bucket: "normal",
            scalp_route: "balanced",
            cleansing_intensity: "gentle",
          },
        ],
      },
      categoryDecision: shampooAuthorityDraft().authoritySnapshot!.categoryDecisions[0],
    },
    {
      category: "conditioner",
      role: "conditioner_rinse_out",
      table: "product_conditioner_specs",
      rows: {
        product_conditioner_specs: [
          {
            product_id: "candidate-1",
            thickness: "normal",
            protein_moisture_balance: "balanced",
          },
        ],
        product_conditioner_rerank_specs: [
          {
            product_id: "candidate-1",
            weight: "light",
            repair_level: "medium",
            balance_direction: "balanced",
          },
        ],
      },
      categoryDecision: conditionerAuthorityDraft().authoritySnapshot!.categoryDecisions[0],
    },
    {
      category: "leave_in",
      role: "post_wash_leave_in",
      table: "product_leave_in_specs",
      rows: {
        product_leave_in_specs: [
          {
            product_id: "candidate-1",
            format: "spray",
            weight: "light",
            care_direction: "balanced",
            repair_support_level: "medium",
            plan_roles: ["post_wash_leave_in"],
            provides_heat_protection: false,
            functional_benefits: ["conditioning"],
            application_stage: ["post_wash"],
          },
        ],
      },
    },
    {
      category: "heat_protectant",
      role: "pre_heat_protection",
      table: "product_heat_protectant_specs",
      rows: {
        product_heat_protectant_specs: [
          { product_id: "candidate-1", format: "spray", provides_heat_protection: true },
        ],
      },
    },
    {
      category: "oil",
      role: "dry_finish",
      table: "product_oil_specs",
      rows: {
        product_oil_specs: [
          {
            product_id: "candidate-1",
            role_support: ["dry_finish"],
            weight: "light",
            provides_heat_protection: false,
          },
        ],
        product_oil_eligibility: [{ product_id: "candidate-1", thickness: "normal" }],
      },
    },
    {
      category: "mask",
      role: "intensive_conditioning_mask",
      table: "product_mask_specs",
      rows: {
        product_mask_specs: [
          {
            product_id: "candidate-1",
            weight: "medium",
            balance_direction: "balanced",
            repair_support_level: "medium",
            functional_benefits: ["conditioning"],
          },
        ],
      },
    },
    {
      category: "scalp_care",
      role: "scalp_comfort",
      table: "product_scalp_care_specs",
      rows: {
        product_scalp_care_specs: [
          {
            product_id: "candidate-1",
            primary_role: "scalp_comfort",
            presentation_format: "serum",
            rinse_mode: "leave_in",
          },
        ],
      },
    },
    {
      category: "dry_shampoo",
      role: "root_refresh_bridge",
      table: "product_dry_shampoo_specs",
      rows: {
        product_dry_shampoo_specs: [
          {
            product_id: "candidate-1",
            primary_effect: "oil_absorption",
            hair_color_fit: "all",
            scalp_sensitivity_fit: "standard",
            format: "aerosol",
          },
        ],
      },
    },
    {
      category: "bondbuilder",
      role: "specialized_bond_treatment",
      table: "product_bondbuilder_specs",
      rows: {
        product_bondbuilder_specs: [
          {
            product_id: "candidate-1",
            application_mode: "rinse_out",
            treatment_mode: "standalone",
            product_format: "treatment",
            usage_protocol: "weekly",
          },
        ],
        product_relationships: [],
      },
    },
    {
      category: "deep_cleansing_shampoo",
      role: "residue_reset",
      table: "product_deep_cleansing_shampoo_specs",
      rows: {
        product_deep_cleansing_shampoo_specs: [
          {
            product_id: "candidate-1",
            reset_focus: "product_sebum_buildup",
            scalp_type_focus: "balanced",
            color_treated_suitability: "suitable",
          },
        ],
      },
    },
  ] as const

  for (const scenario of scenarios) {
    const calls: Array<{
      table: string
      range: [number, number] | null
      inIds: string[] | null
      exactCount: boolean
    }> = []
    const product = {
      id: "candidate-1",
      name: "Candidate",
      category_key: scenario.category,
      is_active: true,
      lifecycle_status: "active",
      is_chaarlie_recommended: true,
      suitable_thicknesses: ["normal"],
      sort_order: 1,
    }
    const candidates = await loadStage3RecommendationCandidates(
      completeCatalogFactClient(
        {
          products: [product],
          ...scenario.rows,
          product_application_protocols: [],
          application_guidance_protocols: [
            {
              product_id: "candidate-1",
              id: "guidance-1",
              role_key: scenario.role,
              scope_kind: "product",
              status: "active",
              locale: "de",
            },
          ],
        },
        calls,
      ) as never,
      {
        draft: shampooAuthorityDraft(),
        subject: {
          decisionKey: `decision:${scenario.category}:${scenario.role}:owned-1`,
          category: scenario.category,
          role: scenario.role,
          capturedProductId: null,
          subjectKind: "uncovered_role",
        } as never,
        context: normalRefinedContext as never,
        categoryDecision: "categoryDecision" in scenario ? scenario.categoryDecision : undefined,
      },
    )

    assert.equal(candidates.length, 1, scenario.category)
    assert.equal(
      calls.some((call) => call.table === scenario.table && call.inIds?.[0] === "candidate-1"),
      true,
      scenario.category,
    )
    assert.equal(
      candidates[0]?.protocols.some((protocol) => protocol.status === "verified_complete"),
      true,
    )
  }
})

test("heat-carrier coverage batches assigned product facts and protocols", async () => {
  const calls: Array<{
    table: string
    range: [number, number] | null
    inIds: string[] | null
    exactCount: boolean
  }> = []
  const coverage = await loadStage3HeatCarrierCoverage(
    completeCatalogFactClient(
      {
        products: [
          {
            id: "leave-in-carrier",
            name: "Leave-in Carrier",
            category_key: "leave_in",
            is_active: true,
            lifecycle_status: "active",
            is_chaarlie_recommended: true,
            suitable_thicknesses: ["normal"],
            sort_order: 1,
          },
        ],
        product_leave_in_specs: [
          {
            product_id: "leave-in-carrier",
            format: "spray",
            weight: "light",
            care_direction: "moisture",
            repair_support_level: "medium",
            plan_roles: ["pre_heat_application"],
            provides_heat_protection: true,
            functional_benefits: [],
            application_stage: ["pre_heat"],
          },
        ],
        product_application_protocols: [],
        application_guidance_protocols: [
          {
            product_id: "leave-in-carrier",
            id: "guidance-1",
            role_key: "pre_heat_application",
            scope_kind: "product",
            status: "active",
            locale: "de",
          },
        ],
      },
      calls,
    ) as never,
    {
      ...shampooAuthorityDraft(),
      products: [
        {
          capturedProductId: "captured-carrier",
          identity: {
            kind: "catalog_product",
            productId: "leave-in-carrier",
            displayName: "Leave-in Carrier",
            category: "leave_in",
          },
        },
      ],
      roleAssignments: [
        {
          capturedProductId: "captured-carrier",
          category: "leave_in",
          roles: ["pre_heat_application"],
        },
      ],
    } as never,
    ["direct_contact_heat"],
  )

  assert.deepEqual(coverage, {
    carrierCategory: "leave_in",
    verifiedRoutes: ["direct_contact_heat"],
  })
  assert.equal(
    calls.filter((call) => call.table === "products" && call.inIds?.[0] === "leave-in-carrier")
      .length,
    1,
  )
  assert.equal(
    calls.some(
      (call) => call.table === "product_leave_in_specs" && call.inIds?.[0] === "leave-in-carrier",
    ),
    true,
  )
})

test("batched singleton specs preserve maybeSingle duplicate failure semantics", async () => {
  const product = {
    id: "candidate-1",
    name: "Duplicate Leave-in",
    category_key: "leave_in",
    is_active: true,
    lifecycle_status: "active",
    is_chaarlie_recommended: true,
    suitable_thicknesses: ["normal"],
    sort_order: 1,
  }
  await assert.rejects(
    () =>
      loadStage3RecommendationCandidates(
        completeCatalogFactClient(
          {
            products: [product],
            product_leave_in_specs: [
              { product_id: "candidate-1", format: "spray" },
              { product_id: "candidate-1", format: "cream" },
            ],
            product_application_protocols: [],
            application_guidance_protocols: [],
          },
          [],
        ) as never,
        {
          draft: shampooAuthorityDraft(),
          subject: {
            decisionKey: "decision:leave_in:post_wash_leave_in:owned-1",
            category: "leave_in",
            role: "post_wash_leave_in",
            capturedProductId: null,
            subjectKind: "uncovered_role",
          },
          context: normalRefinedContext,
        } as never,
      ),
    /stage3_authority_spec_unavailable/,
  )
})

test("request-scoped persistence coalesces identical complete-catalog candidate loads", async () => {
  const calls: Array<{
    table: string
    range: [number, number] | null
    inIds: string[] | null
    exactCount: boolean
  }> = []
  const client = completeCatalogFactClient(
    {
      products: [
        {
          id: "candidate-1",
          name: "Candidate",
          category_key: "shampoo",
          is_active: true,
          lifecycle_status: "active",
          is_chaarlie_recommended: true,
          suitable_thicknesses: ["normal"],
          sort_order: 1,
        },
      ],
      product_shampoo_specs: [
        {
          product_id: "candidate-1",
          thickness: "normal",
          shampoo_bucket: "normal",
          scalp_route: "balanced",
          cleansing_intensity: "gentle",
        },
      ],
      product_application_protocols: [],
      application_guidance_protocols: [
        {
          product_id: "candidate-1",
          id: "guidance-1",
          role_key: "shampoo_everyday",
          scope_kind: "product",
          status: "active",
          locale: "de",
        },
      ],
    },
    calls,
  )
  const persistence = createSupabaseStage3ProductionPersistence(client as never)
  const draft = {
    ...shampooAuthorityDraft(),
    products: [],
    roleAssignments: [],
  }
  const input = {
    userId: draft.userId,
    draft,
    subject: {
      decisionKey: "decision:shampoo:shampoo_everyday:uncovered",
      category: "shampoo",
      role: "shampoo_everyday",
      capturedProductId: null,
      subjectKind: "uncovered_role",
    },
    heatRoutes: [],
    context: normalRefinedContext,
  } as unknown as Parameters<typeof persistence.loadAuthorityFacts>[0]

  const [first, second] = await Promise.all([
    persistence.loadAuthorityFacts(input),
    persistence.loadAuthorityFacts(input),
  ])

  assert.equal(first.recommendationCandidates.length, 1)
  assert.equal(second.recommendationCandidates.length, 1)
  assert.equal(calls.filter((call) => call.table === "products").length, 1)

  const fineInput = {
    ...input,
    context: { ...normalRefinedContext, hairThickness: "fine" },
  } as unknown as Parameters<typeof persistence.loadAuthorityFacts>[0]
  await persistence.loadAuthorityFacts(fineInput)
  assert.equal(
    calls.filter((call) => call.table === "products").length,
    2,
    "a distinct authority context must not reuse the candidate snapshot",
  )
})

test("default Stage 3 persistence loads the complete catalogue canonically", async () => {
  const products = Array.from({ length: 13 }, (_, index) => ({
    id: `candidate-${String(index + 1).padStart(2, "0")}`,
    name: `Candidate ${index + 1}`,
    category_key: "shampoo",
    is_active: true,
    lifecycle_status: "active",
    is_chaarlie_recommended: true,
    suitable_thicknesses: ["normal"],
    sort_order: index + 1,
  }))
  const client = completeCatalogFactClient(
    {
      products,
      product_shampoo_specs: products.map((product) => ({
        product_id: product.id,
        thickness: "normal",
        shampoo_bucket: "normal",
        scalp_route: "balanced",
        cleansing_intensity: "gentle",
      })),
      product_application_protocols: [],
      application_guidance_protocols: products.map((product) => ({
        product_id: product.id,
        id: `guidance-${product.id}`,
        role_key: "shampoo_everyday",
        scope_kind: "product",
        status: "active",
        locale: "de",
      })),
    },
    [],
  )
  const persistence = createSupabaseStage3ProductionPersistence(client as never)
  const draft = {
    ...shampooAuthorityDraft(),
    products: [],
    roleAssignments: [],
  }

  const bundle = await persistence.loadAuthorityFacts({
    userId: draft.userId,
    draft,
    subject: {
      decisionKey: "decision:shampoo:shampoo_everyday:uncovered",
      category: "shampoo",
      role: "shampoo_everyday",
      capturedProductId: null,
      subjectKind: "uncovered_role",
    },
    heatRoutes: [],
    context: normalRefinedContext,
  } as never)

  assert.equal(bundle.recommendationCandidates.length, 13)
})

test("candidate and heat-carrier failures are observed together without an orphaned rejection", async () => {
  const client = completeCatalogFactClient({}, [], { errorTables: ["products"] })
  const persistence = createSupabaseStage3ProductionPersistence(client as never)
  const draft = {
    ...shampooAuthorityDraft(),
    products: [
      {
        capturedProductId: "captured-carrier",
        identity: {
          kind: "catalog_product",
          productId: "leave-in-carrier",
          displayName: "Leave-in Carrier",
          category: "leave_in",
        },
      },
    ],
    roleAssignments: [
      {
        capturedProductId: "captured-carrier",
        category: "leave_in",
        roles: ["pre_heat_application"],
      },
    ],
  }

  await assert.rejects(
    () =>
      persistence.loadAuthorityFacts({
        userId: draft.userId,
        draft,
        subject: {
          decisionKey: "decision:shampoo:shampoo_everyday:uncovered",
          category: "shampoo",
          role: "shampoo_everyday",
          capturedProductId: null,
          subjectKind: "uncovered_role",
        },
        heatRoutes: ["direct_contact_heat"],
        context: normalRefinedContext,
      } as never),
    /stage3_authority_catalog_unavailable|stage3_authority_spec_unavailable/,
  )
  await new Promise((resolve) => setImmediate(resolve))
})

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
    targetFit: "matched",
  })
})

test("authority facts translate an irritation need into the stored irritated route", async () => {
  const bundle = await loadStage3AuthorityFactBundle(
    shampooAuthorityFactClient([
      {
        thickness: "normal",
        shampoo_bucket: "irritationen",
        scalp_route: "irritated",
        cleansing_intensity: "gentle",
      },
    ]) as never,
    {
      draft: shampooAuthorityDraft({
        scalpRoute: "balanced",
        everydayConstraint: "irritation_compatible",
      }),
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
    shampooBucket: "irritationen",
    scalpRoute: "irritated",
    cleansingIntensity: "gentle",
    targetFit: "matched",
  })
})

test("authority facts consistently use the derived irritation route", async () => {
  const bundle = await loadStage3AuthorityFactBundle(
    shampooAuthorityFactClient([
      {
        thickness: "normal",
        shampoo_bucket: "irritationen",
        scalp_route: "irritated",
        cleansing_intensity: "gentle",
      },
    ]) as never,
    {
      draft: shampooAuthorityDraft({
        scalpRoute: "balanced",
        everydayConstraint: "irritation_compatible",
      }),
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
    shampooBucket: "irritationen",
    scalpRoute: "irritated",
    cleansingIntensity: "gentle",
    targetFit: "matched",
  })
})

for (const route of [
  {
    name: "oily",
    scalpRoute: "oily" as const,
    everydayConstraint: "standard" as const,
    role: "shampoo_everyday" as const,
    bucket: "dehydriert-fettig",
    catalogScalpRoute: "oily",
  },
  {
    name: "dry",
    scalpRoute: "dry" as const,
    everydayConstraint: "gentle_dry_scalp" as const,
    role: "shampoo_everyday" as const,
    bucket: "trocken",
    catalogScalpRoute: "dry",
  },
  {
    name: "irritation",
    scalpRoute: "balanced" as const,
    everydayConstraint: "irritation_compatible" as const,
    role: "shampoo_everyday" as const,
    bucket: "irritationen",
    catalogScalpRoute: "irritated",
  },
  {
    name: "balanced",
    scalpRoute: "balanced" as const,
    everydayConstraint: "standard" as const,
    role: "shampoo_everyday" as const,
    bucket: "normal",
    catalogScalpRoute: "balanced",
  },
  {
    name: "dandruff",
    scalpRoute: "oily" as const,
    everydayConstraint: "standard" as const,
    role: "shampoo_dandruff" as const,
    bucket: "schuppen",
    catalogScalpRoute: "dandruff",
  },
]) {
  test(`Shampoo catalog selection uses the exact signed ${route.name} bucket`, async () => {
    const bundle = await loadStage3AuthorityFactBundle(
      shampooAuthorityFactClient([
        {
          thickness: "normal",
          shampoo_bucket: route.bucket,
          scalp_route: route.catalogScalpRoute,
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
  assert.equal(bundle.productFacts.spec.targetFit, "unknown")
})

test("complete nonmatching Shampoo rows load as a known semantic mismatch", async () => {
  const bundle = await loadStage3AuthorityFactBundle(
    shampooAuthorityFactClient([
      {
        thickness: "normal",
        shampoo_bucket: "trocken",
        scalp_route: "dry",
        cleansing_intensity: "gentle",
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
  assert.equal(bundle.productFacts.spec.targetFit, "known_mismatch")
  assert.deepEqual(bundle.productFacts.comparisonObservations, {
    cleansingIntensity: "gentle",
    supportedScalpRoutes: ["dry"],
  })
})

test("Shampoo comparison observations are row-order invariant and do not change authority fingerprints", async () => {
  const rows = [
    {
      thickness: "normal",
      shampoo_bucket: "trocken",
      scalp_route: "dry",
      cleansing_intensity: "gentle",
    },
    {
      thickness: "fine",
      shampoo_bucket: "normal",
      scalp_route: "balanced",
      cleansing_intensity: "gentle",
    },
  ]
  const load = (specs: Record<string, unknown>[]) =>
    loadStage3AuthorityFactBundle(
      shampooAuthorityFactClient(specs) as never,
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

  const [first, second] = await Promise.all([load(rows), load([...rows].reverse())])
  assert.equal(first.productFacts?.category, "shampoo")
  assert.equal(second.productFacts?.category, "shampoo")
  if (first.productFacts?.category !== "shampoo" || second.productFacts?.category !== "shampoo")
    return
  assert.deepEqual(first.productFacts.comparisonObservations, {
    cleansingIntensity: "gentle",
    supportedScalpRoutes: ["balanced", "dry"],
  })
  assert.deepEqual(
    first.productFacts.comparisonObservations,
    second.productFacts.comparisonObservations,
  )
  assert.equal(first.productFacts.factFingerprint, second.productFacts.factFingerprint)
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
    targetFit: "matched",
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
  assert.equal(bundle.productFacts.spec.targetFit, "matched")
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
  assert.equal(bundle.productFacts.spec.targetFit, "unknown")
})

test("complete nonmatching Conditioner rows load as a known semantic mismatch", async () => {
  const bundle = await loadStage3AuthorityFactBundle(
    authorityFactClient([
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
  assert.equal(bundle.productFacts.spec.targetFit, "known_mismatch")
  assert.equal(bundle.productFacts.spec.balanceDirection, "moisture")
})

function maskAuthorityDraft(): Stage3ProductDraft {
  const base = conditionerAuthorityDraft()
  return {
    ...base,
    authorityVersions: { mask: "mask-v3" },
    orderedCategories: ["mask"],
    categoryCursor: "mask",
    products: [
      {
        ...base.products[0]!,
        capturedProductId: "owned-mask-1",
        userProductId: "user-mask-1",
        identity: {
          kind: "catalog_product",
          productId: "mask-1",
          displayName: "Explizite Maske",
          category: "mask",
        },
      },
    ],
    roleAssignments: [
      {
        capturedProductId: "owned-mask-1",
        category: "mask",
        roles: ["intensive_conditioning_mask"],
      },
    ],
    completedCaptureCategories: ["mask"],
    authoritySnapshot: {
      ...base.authoritySnapshot!,
      categoryDecisions: [
        {
          category: "mask",
          resolution: "resolved",
          needTier: "basis",
          roles: ["intensive_conditioning_mask"],
          target: {
            category: "mask",
            roles: ["intensive_conditioning_mask"],
            needStrength: "standard",
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
      orderedCategories: ["mask"],
    },
  }
}

function leaveInAuthorityDraft(): Stage3ProductDraft {
  const base = conditionerAuthorityDraft()
  return {
    ...base,
    authorityVersions: { leave_in: "leave-in-v3" },
    orderedCategories: ["leave_in"],
    categoryCursor: "leave_in",
    products: [
      {
        ...base.products[0]!,
        capturedProductId: "owned-leave-in-1",
        userProductId: "user-leave-in-1",
        identity: {
          kind: "catalog_product",
          productId: "leave-in-1",
          displayName: "Explizites Leave-in",
          category: "leave_in",
        },
      },
    ],
    roleAssignments: [
      {
        capturedProductId: "owned-leave-in-1",
        category: "leave_in",
        roles: ["post_wash_leave_in"],
      },
    ],
    completedCaptureCategories: ["leave_in"],
    authoritySnapshot: {
      ...base.authoritySnapshot!,
      categoryDecisions: [
        {
          category: "leave_in",
          resolution: "resolved",
          needTier: "basis",
          roles: ["post_wash_leave_in"],
          target: {
            category: "leave_in",
            roles: ["post_wash_leave_in"],
            weight: "light",
            careDirection: "moisture",
            repairSupportLevel: "high",
            functions: [{ function: "detangle", priority: 3, ownership: "required" }],
            conditionerReplacementEligible: false,
          },
          frequency: null,
          reasons: [],
          executionState: "available",
          executionPauseReason: null,
          deferredFacts: [],
        },
      ],
      orderedCategories: ["leave_in"],
    },
  }
}

function singleSpecAuthorityFactClient(
  category: "mask" | "leave_in",
  productId: string,
  specRow: Record<string, unknown>,
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
                  name: category === "mask" ? "Explizite Maske" : "Explizites Leave-in",
                  category_key: category,
                  is_active: true,
                  lifecycle_status: "active",
                  is_chaarlie_recommended: true,
                  suitable_thicknesses: ["normal"],
                },
                error: null,
              }
            : { data: [], error: null }
        }
        if (table === "product_mask_specs" || table === "product_leave_in_specs") {
          return { data: specRow, error: null }
        }
        if (table === "product_application_protocols") {
          return {
            data: [
              {
                role: category === "mask" ? "intensive_conditioning_mask" : "post_wash_leave_in",
                guidance_payload: null,
                application_stage: category === "mask" ? "post_shampoo" : "towel_dry",
                application_state: null,
                placement: "lengths_ends",
                contact_time_seconds: category === "mask" ? 300 : null,
                rinse_action: category === "mask" ? "rinse_out" : null,
                reapplication: null,
                source_label: "Fixture",
                source_url: "https://example.com",
                updated_at: "2026-08-11T09:00:00.000Z",
              },
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
        maybeSingle: async () => result(),
        then: <T>(resolve: (value: unknown) => T | PromiseLike<T>) =>
          Promise.resolve(result()).then(resolve),
      }
      return chain
    },
  }
}

test("Mask authority facts load v3 repair and functional benefits explicitly", async () => {
  const bundle = await loadStage3AuthorityFactBundle(
    singleSpecAuthorityFactClient("mask", "mask-1", {
      weight: "light",
      balance_direction: "moisture",
      repair_support_level: "medium",
      functional_benefits: ["detangling_slip"],
    }) as never,
    {
      draft: maskAuthorityDraft(),
      subject: {
        decisionKey: "decision:mask:intensive_conditioning_mask:owned-mask-1",
        category: "mask",
        role: "intensive_conditioning_mask",
        capturedProductId: "owned-mask-1",
        subjectKind: "captured_product",
      },
      heatRoutes: [],
      context: normalRefinedContext,
    } as never,
  )

  assert.equal(bundle.productFacts?.category, "mask")
  if (bundle.productFacts?.category !== "mask") return
  assert.equal(bundle.productFacts.spec.repairSupportLevel, "medium")
  assert.deepEqual(bundle.productFacts.spec.functionalBenefits, ["detangling_slip"])
})

test("Leave-in authority facts load plan-facing v3 columns instead of legacy roles", async () => {
  const bundle = await loadStage3AuthorityFactBundle(
    singleSpecAuthorityFactClient("leave_in", "leave-in-1", {
      format: "cream",
      weight: "light",
      care_direction: "moisture",
      repair_support_level: "high",
      roles: ["styling_prep"],
      plan_roles: ["post_wash_leave_in"],
      provides_heat_protection: false,
      care_benefits: ["detangling"],
      functional_benefits: ["detangle"],
      application_stage: ["towel_dry"],
    }) as never,
    {
      draft: leaveInAuthorityDraft(),
      subject: {
        decisionKey: "decision:leave_in:post_wash_leave_in:owned-leave-in-1",
        category: "leave_in",
        role: "post_wash_leave_in",
        capturedProductId: "owned-leave-in-1",
        subjectKind: "captured_product",
      },
      heatRoutes: [],
      context: normalRefinedContext,
    } as never,
  )

  assert.equal(bundle.productFacts?.category, "leave_in")
  if (bundle.productFacts?.category !== "leave_in") return
  assert.equal(bundle.productFacts.spec.careDirection, "moisture")
  assert.equal(bundle.productFacts.spec.repairSupportLevel, "high")
  assert.deepEqual(bundle.productFacts.spec.roles, ["post_wash_leave_in"])
  assert.deepEqual(bundle.productFacts.spec.careBenefits, ["detangle"])
})

test("Oil combines every eligibility row while its product spec stays singular", async () => {
  const base = conditionerAuthorityDraft()
  const draft: Stage3ProductDraft = {
    ...base,
    authorityVersions: { oil: "personal-plan.oil.v2" },
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
          return {
            data: {
              provides_heat_protection: false,
              weight: "light",
              role_support: ["pre_wash_fibre_treatment", "dry_finish"],
            },
            error: null,
          }
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
    leave_on_fibre_conditioning: false,
    dry_finish: true,
    pre_heat_protection: false,
  })
  assert.equal(bundle.productFacts.spec.weight, "light")
  assert.equal(bundle.productFacts.spec.targetThicknessEligible, true)
  assert.equal(oilEligibilityMaybeSingleCalls, 0)
  assert.ok(oilSpecMaybeSingleCalls >= 1)
})
