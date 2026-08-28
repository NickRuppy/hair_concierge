import assert from "node:assert/strict"
import test from "node:test"

import { resolvePlanStartPageState } from "../src/app/plan-start/page"
import { resolveRoutinePage } from "../src/app/routine/page"
import { CATEGORY_ROLE_POLICIES } from "../src/lib/personal-plan/products/authorities"
import { requireCurrentAuthoritySnapshot } from "../src/lib/personal-plan/products/authority/snapshot"
import type {
  PersonalPlanCategory,
  Stage3ProductDraft,
} from "../src/lib/personal-plan/products/contracts"
import { resolveStage3ProductLoadResolution } from "../src/lib/personal-plan/products/product-load-resolution"
import { buildStage3EntryContext } from "../src/lib/personal-plan/products/stage2-entry-adapter"
import {
  createSupabasePersonalPlanJourneyAccessLoader,
  loadPersonalPlanStage2AccessWithDeps,
  loadPersonalPlanJourneyAccessWithDeps,
  type PersonalPlanJourneyAccessLoaderDeps,
} from "../src/lib/personal-plan/journey-access-loader"
import type { InitialNeedPlanSnapshot } from "../src/lib/personal-plan/types"

function refinedSnapshot(): InitialNeedPlanSnapshot {
  return {
    inputHash: "refined-input-hash-1",
    coverage: [],
    profile: { source: { projection: "refined_post_plan" } },
    renderedOrder: ["shampoo"],
    decisions: [
      {
        category: "shampoo",
        roles: [CATEGORY_ROLE_POLICIES.shampoo.allowedRoles[0]],
      },
    ],
  } as unknown as InitialNeedPlanSnapshot
}

function productLoadOverlayFixture(options?: { deepCleansingStartsInBase?: boolean }): {
  snapshot: InitialNeedPlanSnapshot
  draft: Stage3ProductDraft
} {
  const baseCategories: PersonalPlanCategory[] = ["shampoo", "conditioner", "leave_in", "oil"]
  if (options?.deepCleansingStartsInBase) baseCategories.push("deep_cleansing_shampoo")
  const snapshot = {
    inputHash: "refined-product-load-input-hash",
    coverage: [],
    profile: {
      source: { projection: "refined_post_plan" },
      concerns: [],
      scalp: {
        oiliness: options?.deepCleansingStartsInBase ? "oily" : "balanced",
        concerns: [],
      },
      hair: { thickness: "normal" },
      routine: {
        shampooFrequency: { state: "known", value: "weekly_3_4x" },
        currentProductLoad: {
          state: "known",
          value: {
            categories: [...baseCategories],
            oilPurposes: ["dry_finish"],
          },
        },
      },
    },
    renderedOrder: [...baseCategories],
    decisions: baseCategories.map((category) =>
      category === "deep_cleansing_shampoo"
        ? {
            category,
            needTier: "optional",
            roles: ["residue_reset"],
            frequency: {
              kind: "unscheduled_as_needed",
              roles: ["residue_reset"],
              boundary: "bei_bedarf",
            },
          }
        : {
            category,
            roles: [CATEGORY_ROLE_POLICIES[category].allowedRoles[0]],
          },
    ),
  } as unknown as InitialNeedPlanSnapshot
  const context = buildStage3EntryContext(snapshot, {
    personalPlanId: "plan-1",
    refinedVersionId: "refined-1",
  })
  const leaveIn = {
    capturedProductId: "leave-in-1",
    userProductId: "user-product-leave-in-1",
    identity: {
      kind: "catalog_product" as const,
      productId: "catalog-leave-in-1",
      displayName: "Leave-in",
      category: "leave_in" as const,
    },
    frequencyRange: "weekly_2x" as const,
    ownership: "owned" as const,
    source: "catalog_search" as const,
  }
  const baseDraft: Stage3ProductDraft = {
    schemaVersion: 1,
    status: "active",
    authorityVersions: Object.fromEntries(
      context.orderedCategories.map((item) => [item.category, item.authorityVersion]),
    ),
    draftId: "draft-1",
    userId: "user-1",
    personalPlanId: "plan-1",
    refinedVersionId: "refined-1",
    staleRefinedVersionId: null,
    revision: 9,
    pass: "product_decisions",
    orderedCategories: [...baseCategories],
    categoryCursor: null,
    products: [leaveIn],
    roleAssignments: [
      {
        capturedProductId: leaveIn.capturedProductId,
        category: "leave_in",
        roles: ["post_wash_leave_in"],
      },
    ],
    uncoveredRoles: [],
    decisions: [],
    completedCaptureCategories: [...baseCategories],
    completedDecisionKeys: [],
    createdAt: "2026-08-12T09:00:00.000Z",
    updatedAt: "2026-08-12T09:58:23.880Z",
    authoritySnapshot: context.authoritySnapshot,
  }
  const productLoadResolution = resolveStage3ProductLoadResolution(baseDraft)
  assert.ok(productLoadResolution)
  assert.deepEqual(
    productLoadResolution.requirements.map((item) => item.category),
    ["deep_cleansing_shampoo"],
  )
  return {
    snapshot,
    draft: {
      ...baseDraft,
      orderedCategories: productLoadResolution.requirements.reduce(
        (categories, requirement) =>
          categories.includes(requirement.category)
            ? categories
            : [...categories, requirement.category],
        [...baseDraft.orderedCategories],
      ),
      productLoadResolution,
    },
  }
}

async function projectJourneyDraft(
  draft: Stage3ProductDraft,
): Promise<Awaited<ReturnType<PersonalPlanJourneyAccessLoaderDeps["loadCurrentProductDraft"]>>> {
  const admin = {
    from(table: string) {
      assert.equal(table, "personal_plan_product_drafts")
      const builder = {
        select: () => builder,
        eq: () => builder,
        neq: () => builder,
        maybeSingle: async () => ({
          data: {
            status: draft.status,
            refined_need_version_id: draft.refinedVersionId,
            category_authority_versions: draft.authorityVersions,
            payload: draft,
          },
          error: null,
        }),
      }
      return builder
    },
  }

  return createSupabasePersonalPlanJourneyAccessLoader(admin).loadCurrentProductDraft(
    draft.userId,
    draft.personalPlanId,
    draft.refinedVersionId,
  )
}

function deps(
  overrides: Partial<PersonalPlanJourneyAccessLoaderDeps> = {},
): PersonalPlanJourneyAccessLoaderDeps {
  const snapshot = refinedSnapshot()
  return {
    loadEntitlement: async () => ({
      accessState: "active" as const,
      qualifiedAt: "2026-08-08T00:00:00Z",
      artifactLeadId: "lead-1",
    }),
    cohortCutoff: () => new Date("2026-08-01T00:00:00Z"),
    appEnabled: () => true,
    appRollout: () => "all",
    stage2Enabled: () => true,
    stage3Enabled: () => true,
    stage4Enabled: () => true,
    loadPreparedArtifact: async () => ({ id: "artifact-1" }),
    loadPlan: async () => ({
      id: "plan-1",
      currentInitialNeedVersionId: "initial-1",
      currentRefinedNeedVersionId: "refined-1",
      productDraftCompleted: false,
      pendingRoutineProposalId: "proposal-1",
      activeRoutineVersionId: null,
    }),
    loadCurrentRefinedNeed: async () => snapshot,
    loadCurrentProductDraft: async () => ({
      status: "completed" as const,
      refinedVersionId: "refined-1",
      orderedCategories: ["shampoo"] as const,
      authorityVersions: { shampoo: CATEGORY_ROLE_POLICIES.shampoo.authorityVersion },
      authoritySnapshot: {
        schemaVersion: 1 as const,
        refinedNeedVersionId: "refined-1",
        refinedInputHash: snapshot.inputHash,
        categoryDecisions: snapshot.decisions,
        coverage: snapshot.coverage,
        orderedCategories: ["shampoo"] as const,
        authorityVersions: Object.fromEntries(
          Object.entries(CATEGORY_ROLE_POLICIES).map(([category, policy]) => [
            category,
            policy.authorityVersion,
          ]),
        ) as never,
      },
      productLoadResolution: undefined,
      products: [],
      roleAssignments: [],
    }),
    loadIsInternal: async () => false,
    ...overrides,
  }
}

test("Stage 2 access keeps the app rollout gate and stops before later-stage authority reads", async () => {
  let entitlementReads = 0
  const excluded = await loadPersonalPlanStage2AccessWithDeps(
    deps({
      appRollout: () => "internal",
      loadIsInternal: async () => false,
      loadEntitlement: async () => {
        entitlementReads += 1
        throw new Error("must not read entitlement for excluded users")
      },
    }),
    "customer-1",
  )
  assert.deepEqual(excluded, { allowed: false })
  assert.equal(entitlementReads, 0)

  let refinedReads = 0
  let draftReads = 0
  let stage3Reads = 0
  let stage4Reads = 0
  const access = await loadPersonalPlanStage2AccessWithDeps(
    deps({
      loadCurrentRefinedNeed: async () => {
        refinedReads += 1
        throw new Error("must not load refined need")
      },
      loadCurrentProductDraft: async () => {
        draftReads += 1
        throw new Error("must not load draft")
      },
      stage3Enabled: () => {
        stage3Reads += 1
        throw new Error("must not read Stage 3 flag")
      },
      stage4Enabled: () => {
        stage4Reads += 1
        throw new Error("must not read Stage 4 flag")
      },
    }),
    "owner-1",
  )
  assert.deepEqual(access, { allowed: true })
  assert.equal(refinedReads, 0)
  assert.equal(draftReads, 0)
  assert.equal(stage3Reads, 0)
  assert.equal(stage4Reads, 0)
})

test("Stage 2 access remains fail-closed for incomplete owner source facts and throws on reads", async () => {
  assert.deepEqual(
    await loadPersonalPlanStage2AccessWithDeps(deps({ appEnabled: () => false }), "owner-1"),
    { allowed: false },
  )

  for (const accessState of ["paid_pending", "none", "revoked"] as const) {
    assert.deepEqual(
      await loadPersonalPlanStage2AccessWithDeps(
        deps({
          loadEntitlement: async () => ({
            accessState,
            qualifiedAt: "2026-08-08T00:00:00Z",
            artifactLeadId: "lead-1",
          }),
        }),
        "owner-1",
      ),
      { allowed: false },
    )
  }
  assert.deepEqual(
    await loadPersonalPlanStage2AccessWithDeps(
      deps({
        loadEntitlement: async () => ({
          accessState: "active",
          qualifiedAt: "2026-07-31T23:59:59Z",
          artifactLeadId: "lead-1",
        }),
      }),
      "owner-1",
    ),
    { allowed: false },
  )
  assert.deepEqual(
    await loadPersonalPlanStage2AccessWithDeps(deps({ stage2Enabled: () => false }), "owner-1"),
    { allowed: false },
  )

  for (const override of [
    { loadPreparedArtifact: async () => null },
    {
      loadPlan: async () => ({
        id: "plan-1",
        currentInitialNeedVersionId: null,
        currentRefinedNeedVersionId: "refined-1",
        productDraftCompleted: false,
        pendingRoutineProposalId: null,
        activeRoutineVersionId: null,
      }),
    },
  ]) {
    assert.deepEqual(await loadPersonalPlanStage2AccessWithDeps(deps(override), "owner-1"), {
      allowed: false,
    })
  }

  await assert.rejects(
    () =>
      loadPersonalPlanStage2AccessWithDeps(
        deps({
          loadPreparedArtifact: async () => {
            throw new Error("artifact database unavailable")
          },
        }),
        "owner-1",
      ),
    /artifact database unavailable/,
  )
})

test("internal app rollout excludes non-internal users before plan data is read", async () => {
  let entitlementReads = 0
  const access = await loadPersonalPlanJourneyAccessWithDeps(
    deps({
      appRollout: () => "internal",
      loadIsInternal: async () => false,
      loadEntitlement: async () => {
        entitlementReads += 1
        throw new Error("must not read entitlement for excluded users")
      },
    }),
    "customer-1",
  )

  assert.deepEqual(access, { kind: "legacy" })
  assert.equal(entitlementReads, 0)
})

test("internal app rollout admits the internal owner to the regular journey", async () => {
  const access = await loadPersonalPlanJourneyAccessWithDeps(
    deps({ appRollout: () => "internal", loadIsInternal: async () => true }),
    "nick-1",
  )

  assert.equal(access.kind, "personal_plan")
})

test("loader derives the frontier only from owner-scoped entitlement, source, plan and current authority facts", async () => {
  const access = await loadPersonalPlanJourneyAccessWithDeps(deps(), "user-1")
  assert.equal(access.kind, "personal_plan")
  if (access.kind !== "personal_plan") throw new Error("expected Personal Plan access")
  assert.equal(access.frontier, "stage4")
  assert.equal(access.allowed.stage3, true)
  assert.equal(access.allowed.stage4, true)
})

test("journey access accepts a current Stage 3 draft with a valid product-load overlay", async () => {
  const { snapshot, draft } = productLoadOverlayFixture()
  const projectedDraft = await projectJourneyDraft(draft)
  const access = await loadPersonalPlanJourneyAccessWithDeps(
    deps({
      loadCurrentRefinedNeed: async () => snapshot,
      loadCurrentProductDraft: async () => projectedDraft,
      loadPlan: async () => ({
        id: "plan-1",
        currentInitialNeedVersionId: "initial-1",
        currentRefinedNeedVersionId: "refined-1",
        productDraftCompleted: false,
        pendingRoutineProposalId: null,
        activeRoutineVersionId: null,
      }),
    }),
    "user-1",
  )

  assert.equal(access.kind, "personal_plan")
  if (access.kind !== "personal_plan") throw new Error("expected Personal Plan access")
  assert.equal(access.frontier, "stage3")
  assert.equal(access.allowed.stage3, true)
})

test("journey access accepts a product-load upgrade of an existing base category", async () => {
  const { snapshot, draft } = productLoadOverlayFixture({ deepCleansingStartsInBase: true })
  assert.equal(
    draft.orderedCategories.filter((category) => category === "deep_cleansing_shampoo").length,
    1,
  )
  const access = await loadPersonalPlanJourneyAccessWithDeps(
    deps({
      loadCurrentRefinedNeed: async () => snapshot,
      loadCurrentProductDraft: async () => draft,
      loadPlan: async () => ({
        id: "plan-1",
        currentInitialNeedVersionId: "initial-1",
        currentRefinedNeedVersionId: "refined-1",
        productDraftCompleted: false,
        pendingRoutineProposalId: null,
        activeRoutineVersionId: null,
      }),
    }),
    "user-1",
  )

  assert.equal(access.kind, "personal_plan")
  if (access.kind !== "personal_plan") throw new Error("expected Personal Plan access")
  assert.equal(access.frontier, "stage3")
  assert.equal(access.allowed.stage3, true)
})

test("journey access still rejects a semantically stale product-load overlay", async () => {
  const { snapshot, draft } = productLoadOverlayFixture()
  const staleDraft = {
    ...draft,
    products: draft.products.map((product) => ({
      ...product,
      frequencyRange: "monthly_1x" as const,
    })),
  }
  assert.throws(() => requireCurrentAuthoritySnapshot(staleDraft), /stale_product_load_resolution/)
  const access = await loadPersonalPlanJourneyAccessWithDeps(
    deps({
      loadCurrentRefinedNeed: async () => snapshot,
      loadCurrentProductDraft: async () => staleDraft,
    }),
    "user-1",
  )

  assert.equal(access.kind, "personal_plan")
  if (access.kind !== "personal_plan") throw new Error("expected Personal Plan access")
  assert.equal(access.frontier, "stage2")
  assert.equal(access.allowed.stage3, false)
})

test("full journey access reports non-identifying Stage 3 sub-phase timings in dependency order", async () => {
  const timings: Array<{ operation: string; outcome: string; durationMs: number }> = []
  const clockValues = [0, 5, 10, 15, 20, 25]

  const access = await loadPersonalPlanJourneyAccessWithDeps(
    deps({
      now: () => {
        const value = clockValues.shift()
        if (value === undefined) throw new Error("unexpected clock read")
        return value
      },
      reportStage3AccessTiming: (timing) => timings.push(timing),
    }),
    "user-1",
  )

  assert.equal(access.kind, "personal_plan")
  assert.deepEqual(timings, [
    { operation: "stage3_access_entitlement", outcome: "eligible", durationMs: 5 },
    { operation: "stage3_access_artifact_plan", outcome: "ready", durationMs: 5 },
    { operation: "stage3_access_refined_draft", outcome: "ready", durationMs: 5 },
  ])
  assert.equal(JSON.stringify(timings).includes("user-1"), false)
  assert.equal(JSON.stringify(timings).includes("plan-1"), false)
})

test("full journey access stops access timing after an early entitlement denial", async () => {
  const timings: Array<{ operation: string; outcome: string; durationMs: number }> = []
  const clockValues = [10, 16]

  const access = await loadPersonalPlanJourneyAccessWithDeps(
    deps({
      loadEntitlement: async () => ({
        accessState: "paid_pending",
        qualifiedAt: "2026-08-08T00:00:00Z",
        artifactLeadId: "lead-1",
      }),
      now: () => clockValues.shift() ?? 99,
      reportStage3AccessTiming: (timing) => timings.push(timing),
      loadPreparedArtifact: async () => {
        throw new Error("must not load artifact after denial")
      },
    }),
    "user-1",
  )

  assert.deepEqual(access, { kind: "paid_pending", recoveryHref: "/plan-bereit" })
  assert.deepEqual(timings, [
    { operation: "stage3_access_entitlement", outcome: "denied", durationMs: 6 },
  ])
})

test("full journey access reports the reached sub-phase when a dependency throws", async () => {
  const timings: Array<{ operation: string; outcome: string; durationMs: number }> = []
  const clockValues = [0, 4, 5, 12]

  await assert.rejects(
    () =>
      loadPersonalPlanJourneyAccessWithDeps(
        deps({
          loadPreparedArtifact: async () => {
            throw new Error("artifact database unavailable")
          },
          now: () => clockValues.shift() ?? 99,
          reportStage3AccessTiming: (timing) => timings.push(timing),
        }),
        "user-1",
      ),
    /artifact database unavailable/,
  )

  assert.deepEqual(timings, [
    { operation: "stage3_access_entitlement", outcome: "eligible", durationMs: 4 },
    { operation: "stage3_access_artifact_plan", outcome: "error", durationMs: 7 },
  ])
})

test("the narrow Stage 2 access read never emits Stage 3 access timing", async () => {
  const timings: Array<{ operation: string; outcome: string; durationMs: number }> = []

  assert.deepEqual(
    await loadPersonalPlanStage2AccessWithDeps(
      deps({ reportStage3AccessTiming: (timing) => timings.push(timing) }),
      "user-1",
    ),
    { allowed: true },
  )
  assert.deepEqual(timings, [])
})

test("loader starts independent current refined-need and product-draft reads together", async () => {
  let releaseRefined!: () => void
  const refinedPending = new Promise<void>((resolve) => {
    releaseRefined = resolve
  })
  let draftStarted = false
  const accessPending = loadPersonalPlanJourneyAccessWithDeps(
    deps({
      loadCurrentRefinedNeed: async () => {
        await refinedPending
        return refinedSnapshot()
      },
      loadCurrentProductDraft: async (...args) => {
        draftStarted = true
        return deps().loadCurrentProductDraft(...args)
      },
    }),
    "user-1",
  )

  await new Promise((resolve) => setImmediate(resolve))
  const startedTogether = draftStarted
  releaseRefined()
  const access = await accessPending

  assert.equal(access.kind, "personal_plan")
  assert.equal(startedTogether, true)
})

test("loader starts independent prepared-artifact and plan reads together", async () => {
  let releaseArtifact!: () => void
  const artifactPending = new Promise<void>((resolve) => {
    releaseArtifact = resolve
  })
  let planStarted = false
  const accessPending = loadPersonalPlanJourneyAccessWithDeps(
    deps({
      loadPreparedArtifact: async () => {
        await artifactPending
        return { id: "artifact-1" }
      },
      loadPlan: async (...args) => {
        planStarted = true
        return deps().loadPlan(...args)
      },
    }),
    "user-1",
  )

  await new Promise((resolve) => setImmediate(resolve))
  const startedTogether = planStarted
  releaseArtifact()
  const access = await accessPending

  assert.equal(access.kind, "personal_plan")
  assert.equal(startedTogether, true)
})

test("loader keeps paid-pending buyers on the compact wait route and throws on authoritative read failure", async () => {
  const pending = await loadPersonalPlanJourneyAccessWithDeps(
    deps({
      loadEntitlement: async () => ({
        accessState: "paid_pending",
        qualifiedAt: "2026-08-08T00:00:00Z",
        artifactLeadId: "lead-1",
      }),
    }),
    "user-1",
  )
  assert.deepEqual(pending, { kind: "paid_pending", recoveryHref: "/plan-bereit" })

  const pendingWithoutArtifactLead = await loadPersonalPlanJourneyAccessWithDeps(
    deps({
      loadEntitlement: async () => ({
        accessState: "paid_pending",
        qualifiedAt: "2026-08-08T00:00:00Z",
        artifactLeadId: null,
      }),
    }),
    "user-1",
  )
  assert.deepEqual(pendingWithoutArtifactLead, {
    kind: "paid_pending",
    recoveryHref: "/plan-bereit",
  })

  await assert.rejects(
    () =>
      loadPersonalPlanJourneyAccessWithDeps(
        deps({
          loadPlan: async () => {
            throw new Error("db failed")
          },
        }),
        "user-1",
      ),
    /db failed/,
  )
})

test("full journey keeps an active enrollment without an attached artifact lead on legacy routing", async () => {
  const access = await loadPersonalPlanJourneyAccessWithDeps(
    deps({
      loadEntitlement: async () => ({
        accessState: "active",
        qualifiedAt: "2026-08-08T00:00:00Z",
        artifactLeadId: null,
      }),
    }),
    "user-1",
  )

  assert.deepEqual(access, { kind: "legacy" })
})

test("a valid refined source admits Stage 3 before a draft exists and while its current draft is active", async () => {
  const noDraft = await loadPersonalPlanJourneyAccessWithDeps(
    deps({
      loadPlan: async () => ({
        id: "plan-1",
        currentInitialNeedVersionId: "initial-1",
        currentRefinedNeedVersionId: "refined-1",
        productDraftCompleted: false,
        pendingRoutineProposalId: null,
        activeRoutineVersionId: null,
      }),
      loadCurrentProductDraft: async () => null,
    }),
    "user-1",
  )
  assert.equal(noDraft.kind, "personal_plan")
  if (noDraft.kind !== "personal_plan") throw new Error("expected Personal Plan access")
  assert.equal(noDraft.allowed.stage3, true)
  assert.equal(noDraft.allowed.stage4, false)

  const activeDraft = await loadPersonalPlanJourneyAccessWithDeps(
    deps({
      loadCurrentProductDraft: async () => ({
        ...(await deps().loadCurrentProductDraft("user-1", "plan-1", "refined-1"))!,
        status: "active",
      }),
    }),
    "user-1",
  )
  assert.equal(activeDraft.kind, "personal_plan")
  if (activeDraft.kind !== "personal_plan") throw new Error("expected Personal Plan access")
  assert.equal(activeDraft.allowed.stage3, true)
  assert.equal(activeDraft.allowed.stage4, false)
})

test("an accepted Routine keeps Stage 4/5 reachable while a malformed successor resumes at the Stage 2 bridge", async () => {
  for (const loadCurrentRefinedNeed of [
    async () => {
      throw new Error("successor refined source unavailable")
    },
    async () => ({ malformed: true }) as unknown as InitialNeedPlanSnapshot,
  ]) {
    const access = await loadPersonalPlanJourneyAccessWithDeps(
      deps({
        loadPlan: async () => ({
          id: "plan-1",
          currentInitialNeedVersionId: "initial-1",
          currentRefinedNeedVersionId: "refined-successor-2",
          productDraftCompleted: false,
          pendingRoutineProposalId: null,
          activeRoutineVersionId: "routine-version-accepted-1",
        }),
        loadCurrentRefinedNeed,
      }),
      "user-1",
    )

    assert.equal(access.kind, "personal_plan")
    if (access.kind !== "personal_plan") throw new Error("expected Personal Plan access")
    assert.equal(access.allowed.stage4, true)
    assert.equal(access.allowed.stage5, true)
    assert.equal(access.allowed.stage3, false)

    assert.deepEqual(
      await resolvePlanStartPageState({
        enabled: () => true,
        stage2Enabled: () => true,
        getUserId: async () => "user-1",
        loadJourneyAccess: async () => access,
        loadExistingRefinementSession: async () =>
          ({
            status: "complete",
            completedHandoff: { refinedVersionId: "refined-successor-2" },
          }) as never,
      }),
      // `allowed.stage4` is asserted true above — this owner has an accepted
      // Routine — so the journey carries the post-accept origin.
      { state: "production", initialJourney: { stage: "stage2", planAccepted: true } },
    )
  }
})

test("an accepted active Routine retains Stage 3 when its current successor authority is valid", async () => {
  const access = await loadPersonalPlanJourneyAccessWithDeps(
    deps({
      loadPlan: async () => ({
        id: "plan-1",
        currentInitialNeedVersionId: "initial-1",
        currentRefinedNeedVersionId: "refined-1",
        productDraftCompleted: false,
        pendingRoutineProposalId: null,
        activeRoutineVersionId: "routine-version-accepted-1",
      }),
    }),
    "user-1",
  )

  assert.equal(access.kind, "personal_plan")
  if (access.kind !== "personal_plan") throw new Error("expected Personal Plan access")
  assert.equal(access.allowed.stage3, true)
  assert.equal(access.allowed.stage4, true)
  assert.equal(access.allowed.stage5, true)
})

test("the Routine page reads and renders an accepted Routine when only its successor Stage 3 access is degraded", async () => {
  const access = await loadPersonalPlanJourneyAccessWithDeps(
    deps({
      loadPlan: async () => ({
        id: "plan-1",
        currentInitialNeedVersionId: "initial-1",
        currentRefinedNeedVersionId: "refined-successor-2",
        productDraftCompleted: false,
        pendingRoutineProposalId: null,
        activeRoutineVersionId: "routine-version-accepted-1",
      }),
      loadCurrentRefinedNeed: async () => {
        throw new Error("successor refined source unavailable")
      },
    }),
    "user-1",
  )
  assert.equal(access.kind, "personal_plan")
  if (access.kind !== "personal_plan") throw new Error("expected Personal Plan access")
  assert.equal(access.allowed.stage3, false)
  assert.equal(access.allowed.stage4, true)

  let readInput: { userId: string; enabled: boolean } | null = null
  const page = await resolveRoutinePage({
    getUserId: async () => "user-1",
    loadJourneyAccess: async () => access,
    stage4Enabled: () => true,
    readView: async (input) => {
      readInput = input
      return {
        status: "active",
        activeVersion: { id: "routine-version-accepted-1" },
      } as never
    },
  })

  assert.deepEqual(readInput, { userId: "user-1", enabled: true })
  assert.equal(page.kind, "personal_plan")
  if (page.kind === "personal_plan") {
    assert.equal(page.view.activeVersion?.id, "routine-version-accepted-1")
  }
})

test("a pending proposal remains fail-closed when its successor source is unavailable", async () => {
  await assert.rejects(
    () =>
      loadPersonalPlanJourneyAccessWithDeps(
        deps({
          loadPlan: async () => ({
            id: "plan-1",
            currentInitialNeedVersionId: "initial-1",
            currentRefinedNeedVersionId: "refined-successor-2",
            productDraftCompleted: true,
            pendingRoutineProposalId: "proposal-pending-1",
            activeRoutineVersionId: null,
          }),
          loadCurrentRefinedNeed: async () => {
            throw new Error("successor refined source unavailable")
          },
        }),
        "user-1",
      ),
    /successor refined source unavailable/,
  )
})

test("Supabase draft selection ignores stale rows while retaining a current row, and treats stale-only as absent", async () => {
  const loadDraft = (rows: Array<Record<string, unknown>>) => {
    const predicates: Array<[string, unknown]> = []
    const admin = {
      from(table: string) {
        const builder = {
          select: () => builder,
          eq: (column: string, value: unknown) => {
            predicates.push([column, value])
            return builder
          },
          neq: (column: string, value: unknown) => {
            predicates.push([column, `neq:${String(value)}`])
            return builder
          },
          maybeSingle: async () => {
            const nonStale = predicates.some(
              ([column, value]) => column === "status" && value === "neq:stale",
            )
            const matching =
              table === "personal_plan_product_drafts" && nonStale
                ? rows.filter((row) => row.status !== "stale")
                : rows
            return { data: matching[0] ?? null, error: null }
          },
        }
        return builder
      },
    }
    return {
      load: createSupabasePersonalPlanJourneyAccessLoader(admin).loadCurrentProductDraft,
      predicates,
    }
  }

  const current = {
    status: "active",
    refined_need_version_id: "refined-1",
    category_authority_versions: {},
    payload: {
      orderedCategories: [],
      products: [{ capturedProductId: "product-1" }],
      roleAssignments: [{ capturedProductId: "product-1" }],
      productLoadResolution: { schemaVersion: 1 },
    },
  }
  const stale = { ...current, status: "stale" }
  const mixed = loadDraft([stale, current])
  const loaded = await mixed.load("user-1", "plan-1", "refined-1")
  assert.equal(loaded?.status, "active")
  assert.deepEqual(loaded?.products, current.payload.products)
  assert.deepEqual(loaded?.roleAssignments, current.payload.roleAssignments)
  assert.deepEqual(loaded?.productLoadResolution, current.payload.productLoadResolution)
  assert.deepEqual(mixed.predicates.at(-1), ["status", "neq:stale"])

  const staleOnly = loadDraft([stale])
  assert.equal(await staleOnly.load("user-1", "plan-1", "refined-1"), null)
  assert.deepEqual(staleOnly.predicates.at(-1), ["status", "neq:stale"])
})

test("Supabase loader keeps every journey fact owner and aggregate scoped", async () => {
  const snapshot = refinedSnapshot()
  const queries: Array<{ table: string; predicates: Array<[string, unknown]> }> = []
  const responses: Record<string, unknown> = {
    billing_one_time_purchases: [
      {
        id: "purchase-1",
        user_id: "user-1",
        consent_id: "consent-1",
        product_kind: "personal_plan_once",
        status: "paid",
        paid_at: "2026-08-08T00:00:00Z",
      },
    ],
    personal_plan_one_time_checkout_consents: {
      id: "consent-1",
      lead_id: "lead-1",
      user_id: "user-1",
      product_kind: "personal_plan_once",
      confirmation_status: "delivered",
      generation_started_at: "2026-08-08T00:00:00Z",
      generation_completed_at: "2026-08-08T00:00:00Z",
      generated_content_sha256: "hash",
      delivery_provider: "test",
      delivery_reference: "delivery-1",
      delivered_at: "2026-08-08T00:00:00Z",
    },
    leads: { quiz_kind: "personal_plan", user_id: "user-1" },
    personal_plan_prepared_artifacts: { id: "artifact-1" },
    personal_plans: {
      id: "plan-1",
      current_initial_need_version_id: "initial-1",
      current_refined_need_version_id: "refined-1",
      pending_routine_proposal_id: "proposal-1",
      active_routine_version_id: null,
    },
    personal_plan_need_versions: { output_snapshot: snapshot },
    personal_plan_product_drafts: {
      status: "completed",
      refined_need_version_id: "refined-1",
      category_authority_versions: Object.fromEntries(
        Object.entries(CATEGORY_ROLE_POLICIES).map(([category, policy]) => [
          category,
          policy.authorityVersion,
        ]),
      ),
      payload: {
        orderedCategories: ["shampoo"],
        authoritySnapshot: {
          schemaVersion: 1,
          refinedNeedVersionId: "refined-1",
          refinedInputHash: snapshot.inputHash,
          categoryDecisions: snapshot.decisions,
          coverage: snapshot.coverage,
          orderedCategories: ["shampoo"],
          authorityVersions: Object.fromEntries(
            Object.entries(CATEGORY_ROLE_POLICIES).map(([category, policy]) => [
              category,
              policy.authorityVersion,
            ]),
          ),
        },
      },
    },
    profiles: { is_admin: true },
  }
  const admin = {
    from(table: string) {
      const query = { table, predicates: [] as Array<[string, unknown]> }
      queries.push(query)
      const builder = {
        select: () => builder,
        eq: (column: string, value: unknown) => {
          query.predicates.push([column, value])
          return builder
        },
        neq: (column: string, value: unknown) => {
          query.predicates.push([column, `neq:${String(value)}`])
          return builder
        },
        maybeSingle: async () => ({ data: responses[table] ?? null, error: null }),
        then: (onfulfilled: (value: { data: unknown; error: null }) => unknown) =>
          Promise.resolve(onfulfilled({ data: responses[table] ?? null, error: null })),
      }
      return builder
    },
  }
  const loader = createSupabasePersonalPlanJourneyAccessLoader(admin)
  assert.equal(
    (await loader.loadEntitlement("user-1")).accessState,
    "active",
    JSON.stringify(queries),
  )
  const access = await loadPersonalPlanJourneyAccessWithDeps(
    {
      ...loader,
      cohortCutoff: () => new Date("2026-08-01T00:00:00Z"),
      appEnabled: () => true,
      appRollout: () => "all",
      stage2Enabled: () => true,
      stage3Enabled: () => true,
      stage4Enabled: () => true,
    },
    "user-1",
  )
  assert.equal(access.kind, "personal_plan")

  const predicatesFor = (table: string) =>
    queries.find((query) => query.table === table)?.predicates ?? []
  assert.deepEqual(predicatesFor("personal_plan_prepared_artifacts"), [
    ["user_id", "user-1"],
    ["lead_id", "lead-1"],
    ["status", "attached"],
  ])
  assert.deepEqual(predicatesFor("personal_plans"), [["user_id", "user-1"]])
  assert.deepEqual(predicatesFor("personal_plan_need_versions"), [
    ["id", "refined-1"],
    ["user_id", "user-1"],
    ["personal_plan_id", "plan-1"],
    ["kind", "refined"],
  ])
  assert.deepEqual(predicatesFor("personal_plan_product_drafts"), [
    ["user_id", "user-1"],
    ["personal_plan_id", "plan-1"],
    ["refined_need_version_id", "refined-1"],
    ["status", "neq:stale"],
  ])
  assert.deepEqual(predicatesFor("profiles"), [])

  queries.length = 0
  await loadPersonalPlanJourneyAccessWithDeps(
    {
      ...loader,
      cohortCutoff: () => new Date("2026-08-01T00:00:00Z"),
      appEnabled: () => true,
      appRollout: () => "all",
      stage2Enabled: () => true,
      stage3Enabled: () => true,
      stage4Enabled: () => true,
    },
    "user-1",
  )
  assert.equal(
    queries.some((query) => query.table === "profiles"),
    false,
  )
})
