import assert from "node:assert/strict"
import test from "node:test"
import { renderToStaticMarkup } from "react-dom/server"

import { RoutinePage } from "@/components/routine/personal-plan/routine-page"
import {
  isRoutinePayloadV2,
  routinePayloadSchema,
  routinePayloadV1Schema,
  routinePayloadV2Schema,
  routineToolAssets,
  routineToolOccurrences,
  type PersonalPlanRoutineView,
  type RoutinePayloadV1,
} from "@/lib/personal-plan/routine/contracts"
import { hashRoutineSemantics } from "@/lib/personal-plan/routine-candidate-compiler"
import type { RoutineCompiledPayload } from "@/lib/personal-plan/routine-candidate-compiler"
import { applyRoutineEdits } from "@/lib/personal-plan/routine/editor"
import {
  atDayAnchor,
  type ToolAsset,
  type ToolOccurrence,
} from "@/lib/personal-plan/tools/contracts"

const PLAN_ID = "11111111-1111-4111-8111-111111111111"
const REFINED_ID = "22222222-2222-4222-8222-222222222222"

const V1_PAYLOAD: RoutinePayloadV1 = {
  schemaVersion: 1,
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
  createdAt: "2026-08-21T00:00:00.000Z",
}

const TOOL_ASSET: ToolAsset = {
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

const TOOL_OCCURRENCES: ToolOccurrence[] = [
  {
    occurrenceKey: "occurrence:tool:brushes_combs:detangling_foundation:wash_day_post_wash",
    assetKey: TOOL_ASSET.assetKey,
    routeKey: "tool:brushes_combs:detangling_foundation",
    capability: "detangle",
    anchor: atDayAnchor("post_rinse_towel_dry"),
    sessionKey: null,
    executable: true,
    conditionalReason: null,
  },
  {
    occurrenceKey: "occurrence:tool:brushes_combs:specialized_brush_job:styling_session",
    assetKey: TOOL_ASSET.assetKey,
    routeKey: "tool:brushes_combs:specialized_brush_job",
    capability: "airflow_shape",
    anchor: atDayAnchor("styling_session"),
    sessionKey: null,
    executable: true,
    conditionalReason: null,
  },
]

const V2_PAYLOAD = {
  ...V1_PAYLOAD,
  schemaVersion: 2 as const,
  toolAssets: [TOOL_ASSET],
  toolOccurrences: TOOL_OCCURRENCES,
  toolGuidance: [],
}

test("strict V1 stays strict and still loads unchanged through the union", () => {
  assert.equal(routinePayloadV1Schema.safeParse(V1_PAYLOAD).success, true)
  assert.equal(
    routinePayloadV1Schema.safeParse({ ...V1_PAYLOAD, toolAssets: [] }).success,
    false,
    "V1 must not be weakened with unknown keys",
  )
  const parsed = routinePayloadSchema.parse(V1_PAYLOAD)
  assert.equal(parsed.schemaVersion, 1)
  assert.equal(isRoutinePayloadV2(parsed), false)
  assert.deepEqual(routineToolAssets(parsed), [])
})

test("strict V2 requires the Tool arrays and rejects unknown keys", () => {
  assert.equal(routinePayloadV2Schema.safeParse(V2_PAYLOAD).success, true)
  const { toolOccurrences: _dropped, ...missing } = V2_PAYLOAD
  assert.equal(routinePayloadV2Schema.safeParse(missing).success, false)
  assert.equal(routinePayloadV2Schema.safeParse({ ...V2_PAYLOAD, somethingElse: 1 }).success, false)
  const parsed = routinePayloadSchema.parse(V2_PAYLOAD)
  assert.equal(isRoutinePayloadV2(parsed), true)
  assert.equal(routineToolAssets(parsed).length, 1)
})

test("a Tool asset can never carry cadence, reorder or acquisition state", () => {
  for (const forbidden of ["cadence", "replacementCadence", "reorder", "acquiredAt", "price"]) {
    assert.equal(
      routinePayloadV2Schema.safeParse({
        ...V2_PAYLOAD,
        toolAssets: [{ ...TOOL_ASSET, [forbidden]: "weekly_2x" }],
      }).success,
      false,
      `${forbidden} must be rejected on a durable Tool asset`,
    )
  }
})

test("one asset supports many occurrences and stays one Routine row", () => {
  const parsed = routinePayloadSchema.parse(V2_PAYLOAD)
  assert.equal(routineToolAssets(parsed).length, 1)
  assert.equal(routineToolOccurrences(parsed).length, 2)
  assert.equal(
    new Set(routineToolOccurrences(parsed).map((occurrence) => occurrence.assetKey)).size,
    1,
  )
})

test("a V2 Routine with no Tool rows hashes exactly like its V1 equivalent", () => {
  const v1 = hashRoutineSemantics(V1_PAYLOAD as unknown as RoutineCompiledPayload)
  const emptyV2 = hashRoutineSemantics({
    ...V1_PAYLOAD,
    schemaVersion: 2,
    toolAssets: [],
    toolOccurrences: [],
    toolGuidance: [],
  } as unknown as RoutineCompiledPayload)
  assert.equal(emptyV2, v1, "enabling the rollout alone must not fabricate a successor")

  const withTools = hashRoutineSemantics(V2_PAYLOAD as unknown as RoutineCompiledPayload)
  assert.notEqual(withTools, v1, "real Tool data is semantically meaningful")
  assert.equal(
    withTools,
    hashRoutineSemantics(V2_PAYLOAD as unknown as RoutineCompiledPayload),
    "hashing is deterministic",
  )
})

test("editing a Routine preserves its Tool authority untouched", () => {
  const edited = applyRoutineEdits(V2_PAYLOAD as unknown as RoutineCompiledPayload, [
    { kind: "category_inclusion", category: "shampoo", inclusion: "excluded" },
  ])
  assert.deepEqual(edited.toolAssets, [TOOL_ASSET])
  assert.deepEqual(edited.toolOccurrences, TOOL_OCCURRENCES)
  assert.equal(edited.schemaVersion, 2)
  assert.equal(edited.intent.categories[0].inclusion, "excluded", "the product edit still applies")
})

function viewFor(payload: unknown): PersonalPlanRoutineView {
  return {
    status: "active",
    personalPlanId: PLAN_ID,
    planRevision: 1,
    sourceRevision: 1,
    activeVersion: { id: "routine-1", payload: routinePayloadSchema.parse(payload) },
    pendingProposal: null,
    productPresentation: { catalogProducts: [] },
  }
}

test("Deine Tools renders after the product sections and never as a consumable", () => {
  const markup = renderToStaticMarkup(<RoutinePage view={viewFor(V2_PAYLOAD)} />)
  assert.ok(markup.includes("data-routine-tool-section"))
  assert.ok(markup.includes("Deine Tools"))
  assert.ok(markup.includes("Grobzinkiger Kamm"))
  assert.ok(markup.includes("Nutze deins"))
  assert.ok(markup.indexOf("Deine Basis") < markup.indexOf("Deine Tools"), "products stay first")
  const toolSection = markup.slice(markup.indexOf("data-routine-tool-section"))
  for (const forbidden of ["läuft bald aus", "Nachbestellen", "Nachkaufen", "Vorrat"]) {
    assert.equal(toolSection.includes(forbidden), false, `${forbidden} must not appear on a Tool`)
  }
})

test("a V1 Routine renders exactly as today with no Tool section", () => {
  const markup = renderToStaticMarkup(<RoutinePage view={viewFor(V1_PAYLOAD)} />)
  assert.equal(markup.includes("data-routine-tool-section"), false)
  assert.equal(markup.includes("Deine Tools"), false)
})

test("one physical Tool appears once in Routine even with several occurrences", () => {
  const markup = renderToStaticMarkup(<RoutinePage view={viewFor(V2_PAYLOAD)} />)
  const rows = markup.match(/data-routine-tool-row=/g) ?? []
  assert.equal(rows.length, 1)
})
