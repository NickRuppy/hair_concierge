import assert from "node:assert/strict"
import test from "node:test"

import {
  parseStoredRoutinePayload,
  stripRoutineToolPayload,
} from "@/lib/personal-plan/routine/decode-stored"
import {
  isRoutinePayloadV2,
  routinePayloadSchema,
  routineToolAssets,
  routineToolGuidance,
  routineToolOccurrences,
} from "@/lib/personal-plan/routine/contracts"
import { decodeStoredPlanToolRows } from "@/lib/personal-plan/tools/decode-stored"
import { compileInitialRoutineCandidate } from "@/lib/personal-plan/routine-candidate-compiler"
import {
  loadPersonalPlanActiveRoutineVersion,
  loadPersonalPlanRoutineView,
} from "@/lib/personal-plan/routine/load-view"
import type { PersonalPlanRoutineReadClient } from "@/lib/personal-plan/routine/repository"
import type { InitialNeedPlanSnapshot } from "@/lib/personal-plan/types"

const PLAN_ID = "11111111-1111-4111-8111-111111111111"
const REFINED_ID = "22222222-2222-4222-8222-222222222222"

/**
 * Exactly the product half a branch-era row carries. Reconstructed from
 * `git show 16abe13a:src/lib/personal-plan/routine/contracts.ts` — V1 was
 * unchanged by `D7`, so only the Tool slice below differs from today.
 */
const STORED_PRODUCT_HALF = {
  planId: PLAN_ID,
  versionId: "routine-1",
  parentVersionId: null,
  source: {
    refinedVersionId: REFINED_ID,
    productPortfolioVersionId: "portfolio-1",
    sourceFingerprint: "a".repeat(64),
    compilerVersion: "personal-plan-routine-compiler.v2",
    authorityVersions: { routine: "personal-plan-routine-compiler.v2" },
    renderedOrder: ["shampoo"],
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
            assignmentKey: "assignment:shampoo:shampoo_everyday:none",
            role: "shampoo_everyday",
            productRef: { kind: "none" },
            cadenceOverride: null,
            fitDecision: "standard",
          },
        ],
      },
    ],
  },
  sections: [
    { key: "basis", itemKeys: ["item:shampoo:shampoo_everyday:none"] },
    { key: "optional", itemKeys: [] },
  ],
  items: [
    {
      itemKey: "item:shampoo:shampoo_everyday:none",
      assignmentKey: "assignment:shampoo:shampoo_everyday:none",
      category: "shampoo",
      role: "shampoo_everyday",
      purposeKey: "shampoo_everyday",
      roleOrder: 0,
      state: {
        systemAssessment: "basis",
        inclusion: "included",
        availability: "none",
        fitDecision: "standard",
      },
      product: { kind: "none", displayName: null },
      cadence: { recommended: null, userOverride: null, displayKey: "personal_plan.cadence.none" },
      sourceDecisionKeys: ["decision:shampoo:shampoo_everyday:gap"],
      authorityRuleIds: [],
      executable: false,
    },
  ],
  createdAt: "2026-08-23T00:00:00.000Z",
}

/** `toolAssetSchema` was byte-identical at 16abe13a; only anchors changed. */
const STORED_TOOL_ASSET = {
  assetKey: "asset:brushes_combs:wide_tooth_comb",
  family: "brushes_combs",
  productTypes: ["wide_tooth_comb"],
  capabilities: ["detangle", "distribute_product"],
  ownership: "owned_generic",
  presentationState: "use_yours",
  routeKeys: ["tool:brushes_combs:detangling_foundation"],
  labelKey: "Grobzinkiger Kamm",
  purposeKey: "Zum sanften Entwirren und Verteilen von Produkt",
  imageKey: "wide_tooth_comb",
}

/**
 * The five legacy anchor shapes, and no `sessionKey` anywhere — the exact
 * `toolOccurrenceAnchorSchema` discriminated union of 16abe13a.
 */
const STORED_TOOL_OCCURRENCES = [
  {
    occurrenceKey: "occurrence:detangling_foundation:wash",
    assetKey: STORED_TOOL_ASSET.assetKey,
    routeKey: "tool:brushes_combs:detangling_foundation",
    capability: "detangle",
    anchor: { kind: "wash_day", phase: "wash" },
    executable: true,
    conditionalReason: null,
  },
  {
    occurrenceKey: "occurrence:detangling_foundation:post_wash",
    assetKey: STORED_TOOL_ASSET.assetKey,
    routeKey: "tool:brushes_combs:detangling_foundation",
    capability: "detangle",
    anchor: { kind: "wash_day", phase: "post_wash" },
    executable: true,
    conditionalReason: null,
  },
  {
    occurrenceKey: "occurrence:detangling_foundation:drying",
    assetKey: STORED_TOOL_ASSET.assetKey,
    routeKey: "tool:brushes_combs:detangling_foundation",
    capability: "detangle",
    anchor: { kind: "wash_day", phase: "drying" },
    executable: true,
    conditionalReason: null,
  },
  {
    occurrenceKey: "occurrence:detangling_foundation:styling",
    assetKey: STORED_TOOL_ASSET.assetKey,
    routeKey: "tool:brushes_combs:detangling_foundation",
    capability: "detangle",
    anchor: { kind: "wash_day", phase: "styling" },
    executable: true,
    conditionalReason: null,
  },
  {
    occurrenceKey: "occurrence:detangling_foundation:after_step",
    assetKey: STORED_TOOL_ASSET.assetKey,
    routeKey: "tool:brushes_combs:detangling_foundation",
    capability: "distribute_product",
    anchor: { kind: "after_step", stepKey: "step:conditioner" },
    executable: true,
    conditionalReason: null,
  },
  {
    occurrenceKey: "occurrence:detangling_foundation:before_step",
    assetKey: STORED_TOOL_ASSET.assetKey,
    routeKey: "tool:brushes_combs:detangling_foundation",
    capability: "distribute_product",
    anchor: { kind: "before_step", stepKey: "step:leave_in" },
    executable: true,
    conditionalReason: null,
  },
  {
    occurrenceKey: "occurrence:detangling_foundation:nightly",
    assetKey: STORED_TOOL_ASSET.assetKey,
    routeKey: "tool:brushes_combs:detangling_foundation",
    capability: "detangle",
    anchor: { kind: "nightly" },
    executable: true,
    conditionalReason: null,
  },
  {
    occurrenceKey: "occurrence:detangling_foundation:styling_session",
    assetKey: STORED_TOOL_ASSET.assetKey,
    routeKey: "tool:brushes_combs:detangling_foundation",
    capability: "detangle",
    anchor: { kind: "styling_session" },
    executable: true,
    conditionalReason: null,
  },
]

const STORED_TOOL_GUIDANCE = [
  {
    guidanceKey: "guidance:drying_textiles:towel_technique",
    routeKey: "tool:drying_textiles:towel_technique",
    anchor: { kind: "wash_day", phase: "post_wash" },
    copyKey: "Sanft ausdrücken statt rubbeln",
    strength: "firm" as const,
  },
]

/** A Routine row exactly as 16abe13a wrote it: V2 product half + legacy Tools. */
const STORED_V2_ROW = {
  ...STORED_PRODUCT_HALF,
  schemaVersion: 2,
  toolAssets: [STORED_TOOL_ASSET],
  toolOccurrences: STORED_TOOL_OCCURRENCES,
  toolGuidance: STORED_TOOL_GUIDANCE,
}

test("a stored 16abe13a Routine V2 row loads through the read boundary", () => {
  const payload = parseStoredRoutinePayload(STORED_V2_ROW)
  assert.equal(isRoutinePayloadV2(payload), true, "the Tools slice must survive, not be dropped")
  assert.equal(routineToolAssets(payload).length, 1)
  assert.equal(routineToolOccurrences(payload).length, STORED_TOOL_OCCURRENCES.length)
  assert.deepEqual(
    routineToolOccurrences(payload).map((occurrence) => occurrence.anchor),
    [
      { position: "wet_cleanse", relativeToStep: null },
      { position: "post_rinse_towel_dry", relativeToStep: null },
      { position: "dry_pre_heat", relativeToStep: null },
      { position: "styling_session", relativeToStep: null },
      {
        position: "post_rinse_towel_dry",
        relativeToStep: { side: "after", stepKey: "step:conditioner" },
      },
      {
        position: "post_rinse_towel_dry",
        relativeToStep: { side: "before", stepKey: "step:leave_in" },
      },
      { position: "nightly", relativeToStep: null },
      { position: "styling_session", relativeToStep: null },
    ],
  )
  assert.equal(
    routineToolOccurrences(payload).every((occurrence) => occurrence.sessionKey === null),
    true,
    "a row written before A09 simply has no linked parent session",
  )
  assert.deepEqual(routineToolGuidance(payload)[0]?.anchor, {
    position: "post_rinse_towel_dry",
    relativeToStep: null,
  })
})

test("a today-shaped V2 row is passed through the boundary untouched", () => {
  const current = {
    ...STORED_PRODUCT_HALF,
    schemaVersion: 2,
    toolAssets: [STORED_TOOL_ASSET],
    toolOccurrences: [
      {
        occurrenceKey: "occurrence:detangling_foundation:post_wash",
        assetKey: STORED_TOOL_ASSET.assetKey,
        routeKey: "tool:brushes_combs:detangling_foundation",
        capability: "detangle",
        anchor: { position: "post_rinse_towel_dry", relativeToStep: null },
        sessionKey: "session:detangle",
        executable: true,
        conditionalReason: null,
      },
    ],
    toolGuidance: [],
  }
  const payload = parseStoredRoutinePayload(current)
  assert.equal(routineToolOccurrences(payload)[0]?.sessionKey, "session:detangle")
  assert.deepEqual(routineToolOccurrences(payload)[0]?.anchor, {
    position: "post_rinse_towel_dry",
    relativeToStep: null,
  })
})

test("a garbage Tool slice degrades to a product-only Routine instead of failing", () => {
  const payload = parseStoredRoutinePayload({
    ...STORED_V2_ROW,
    toolOccurrences: [{ occurrenceKey: "occurrence:broken", anchor: { kind: "moon_phase" } }],
  })
  assert.equal(isRoutinePayloadV2(payload), false, "the Routine renders product-only")
  assert.deepEqual(routineToolAssets(payload), [])
  assert.equal(payload.items.length, 1, "the product half is intact")
})

test("a broken product half is still a real failure", () => {
  assert.throws(() =>
    parseStoredRoutinePayload({ ...STORED_V2_ROW, sections: [{ key: "basis", itemKeys: [] }] }),
  )
})

test("a stored V1 row keeps loading unchanged", () => {
  const payload = parseStoredRoutinePayload({ ...STORED_PRODUCT_HALF, schemaVersion: 1 })
  assert.equal(payload.schemaVersion, 1)
  assert.deepEqual(routineToolAssets(payload), [])
})

test("stripping the Tool projection leaves a strict product-only payload", () => {
  const stripped = stripRoutineToolPayload(parseStoredRoutinePayload(STORED_V2_ROW))
  assert.equal(stripped.schemaVersion, 1)
  assert.deepEqual(routineToolAssets(stripped), [])
  assert.deepEqual(routineToolOccurrences(stripped), [])
  assert.equal(stripped.items.length, 1)
  assert.equal(
    stripRoutineToolPayload(stripped).schemaVersion,
    1,
    "stripping a V1 payload is a no-op",
  )
})

test("the plan Tool slice of an old refined snapshot decodes before it is copied", () => {
  const rows = decodeStoredPlanToolRows({
    schemaVersion: 1,
    routes: [],
    assets: [STORED_TOOL_ASSET],
    occurrences: STORED_TOOL_OCCURRENCES,
    guidance: STORED_TOOL_GUIDANCE,
  })
  assert.ok(rows)
  assert.deepEqual(rows.occurrences[0]?.anchor, { position: "wet_cleanse", relativeToStep: null })
  assert.equal(rows.occurrences[0]?.sessionKey, null)
})

test("an invalid plan Tool slice is dropped rather than copied into a V2 Routine", () => {
  assert.equal(
    decodeStoredPlanToolRows({
      schemaVersion: 1,
      assets: [STORED_TOOL_ASSET],
      occurrences: [{ occurrenceKey: "occurrence:broken" }],
      guidance: [],
    }),
    null,
  )
  assert.equal(decodeStoredPlanToolRows(null), null)
})

/**
 * The real Routine read boundary, with the stored row served exactly as the
 * database holds it. This is the path that turned an old dev row into a 503.
 */
function storedRowClient(payload: unknown): PersonalPlanRoutineReadClient {
  return {
    from(table) {
      const query = {
        select() {
          return query
        },
        eq() {
          return query
        },
        async maybeSingle() {
          if (table === "personal_plans") {
            return {
              data: {
                id: PLAN_ID,
                revision: 1,
                source_revision: 1,
                active_routine_version_id: "routine-1",
                pending_routine_proposal_id: null,
              },
              error: null,
            }
          }
          if (table === "personal_plan_routine_versions") {
            return { data: { id: "routine-1", payload }, error: null }
          }
          if (table === "personal_plan_need_versions") {
            return {
              data: { id: REFINED_ID, output_snapshot: { renderedOrder: ["shampoo"] } },
              error: null,
            }
          }
          return { data: null, error: null }
        },
      }
      return query as unknown as ReturnType<PersonalPlanRoutineReadClient["from"]>
    },
  }
}

test("the Routine view loads a stored 16abe13a row instead of collapsing to unavailable", async () => {
  const view = await loadPersonalPlanRoutineView({
    client: storedRowClient(STORED_V2_ROW),
    userId: "owner-1",
    enabled: true,
  })
  if (view.status === "no_personal_plan") throw new Error("unreachable")
  const payload = view.activeVersion?.payload
  assert.ok(payload, "the Routine must load, not throw")
  assert.equal(isRoutinePayloadV2(payload), true)
  assert.deepEqual(routineToolOccurrences(payload)[0]?.anchor, {
    position: "wet_cleanse",
    relativeToStep: null,
  })
})

test("the Stage 5 active-version read decodes the same stored row", async () => {
  const active = await loadPersonalPlanActiveRoutineVersion({
    client: storedRowClient(STORED_V2_ROW),
    userId: "owner-1",
    planId: PLAN_ID,
    activeRoutineVersionId: "routine-1",
  })
  assert.ok(active)
  assert.equal(isRoutinePayloadV2(active.payload), true)
  assert.equal(routineToolOccurrences(active.payload).length, STORED_TOOL_OCCURRENCES.length)
})

test("a Routine whose Tool slice cannot be decoded still renders product-only", async () => {
  const view = await loadPersonalPlanRoutineView({
    client: storedRowClient({
      ...STORED_V2_ROW,
      toolAssets: [{ assetKey: "asset:broken" }],
    }),
    userId: "owner-1",
    enabled: true,
  })
  if (view.status === "no_personal_plan") throw new Error("unreachable")
  assert.ok(view.activeVersion?.payload, "the Tools slice must never 503 the whole Routine")
  assert.equal(isRoutinePayloadV2(view.activeVersion.payload), false)
  assert.equal(view.activeVersion.payload.items.length, 1)
})

function compilerInput(toolPlan: unknown) {
  return {
    userId: "owner-a",
    personalPlanId: PLAN_ID,
    productDraftId: "draft-a",
    expectedRevision: 1,
    expectedSourceRevision: 1,
    portfolioSchemaVersion: 1,
    portfolioSnapshot: {
      schemaVersion: 1,
      portfolioVersionId: "pending-sql-assignment",
      personalPlanId: PLAN_ID,
      refinedVersionId: REFINED_ID,
      sourceDraftRevision: 1,
      categoryResolutions: [],
      unresolvedCategories: [],
      createdAt: "2026-08-23T08:00:00.000Z",
    } as never,
    refinedNeedSnapshot: {
      schemaVersion: 1,
      decisions: [],
      renderedOrder: [],
      ...(toolPlan === undefined ? {} : { toolPlan }),
    } as unknown as InitialNeedPlanSnapshot,
  }
}

test("the compiler decodes a legacy plan Tool slice before embedding it", async () => {
  const candidate = await compileInitialRoutineCandidate(
    compilerInput({
      schemaVersion: 1,
      routes: [],
      assets: [STORED_TOOL_ASSET],
      occurrences: STORED_TOOL_OCCURRENCES,
      guidance: STORED_TOOL_GUIDANCE,
    }),
  )
  const payload = routinePayloadSchema.parse(candidate.payload)
  assert.equal(payload.schemaVersion, 2, "a decodable slice still produces a V2 Routine")
  assert.deepEqual(routineToolOccurrences(payload)[0]?.anchor, {
    position: "wet_cleanse",
    relativeToStep: null,
  })
})

test("the compiler drops an undecodable plan Tool slice instead of embedding it", async () => {
  const candidate = await compileInitialRoutineCandidate(
    compilerInput({
      schemaVersion: 1,
      routes: [],
      assets: [STORED_TOOL_ASSET],
      occurrences: [{ occurrenceKey: "occurrence:broken" }],
      guidance: [],
    }),
  )
  const payload = routinePayloadSchema.parse(candidate.payload)
  assert.equal(
    payload.schemaVersion,
    1,
    "a V2 Routine its own readers would reject is never written",
  )
})

test("a Tools-off snapshot still compiles to a strict V1 Routine", async () => {
  const candidate = await compileInitialRoutineCandidate(compilerInput(undefined))
  assert.equal(routinePayloadSchema.parse(candidate.payload).schemaVersion, 1)
})
