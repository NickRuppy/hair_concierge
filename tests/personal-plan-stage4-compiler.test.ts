import assert from "node:assert/strict"
import test from "node:test"

import {
  applyRoutineEdits,
  hashRoutineSemantics,
  type RoutineCompiledPayload,
  type RoutineEditOperation,
} from "../src/lib/personal-plan/routine-candidate-compiler"

const payload = {
  schemaVersion: 1,
  planId: "plan-a",
  versionId: "pending-sql-assignment",
  parentVersionId: null,
  source: {
    refinedVersionId: "refined-a",
    productPortfolioVersionId: "pending-sql-assignment",
    sourceFingerprint: "source",
    compilerVersion: "personal-plan-routine-compiler.v1",
    authorityVersions: {},
  },
  intent: {
    schemaVersion: 1,
    categories: [
      {
        category: "conditioner",
        inclusion: "included",
        inclusionSource: "stage3",
        assignments: [
          {
            assignmentKey: "assignment:conditioner:conditioner_rinse_out:captured-a",
            role: "conditioner_rinse_out",
            productRef: { kind: "owned", capturedProductId: "captured-a", productId: "product-a" },
            cadenceOverride: null,
            fitDecision: "standard",
          },
        ],
      },
    ],
  },
  sections: [],
  items: [
    {
      itemKey: "item:conditioner:conditioner_rinse_out:captured-a",
      assignmentKey: "assignment:conditioner:conditioner_rinse_out:captured-a",
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
        capturedProductId: "captured-a",
        productId: "product-a",
        displayName: "Conditioner",
      },
      cadence: { recommended: null, userOverride: null, displayKey: "personal_plan.cadence.none" },
      sourceDecisionKeys: ["decision:conditioner"],
      authorityRuleIds: [],
      executable: true,
    },
  ],
} as unknown as RoutineCompiledPayload

test("routine edits preserve assessment, rebuild sections, and do not mutate the input", () => {
  const operations: RoutineEditOperation[] = [
    { kind: "category_inclusion", category: "conditioner", inclusion: "excluded" },
    {
      kind: "cadence_override",
      assignmentKey: "assignment:conditioner:conditioner_rinse_out:captured-a",
      cadenceOverride: "weekly_2x",
    },
  ]
  const edited = applyRoutineEdits(payload, operations)

  assert.equal(edited.items[0].state.systemAssessment, "basis")
  assert.equal(edited.items[0].state.inclusion, "excluded")
  assert.equal(edited.items[0].executable, false)
  assert.equal(edited.items[0].cadence.userOverride, "weekly_2x")
  assert.deepEqual(edited.sections, [
    { key: "basis", itemKeys: ["item:conditioner:conditioner_rinse_out:captured-a"] },
    { key: "optional", itemKeys: [] },
  ])
  assert.equal(payload.items[0].state.inclusion, "included")
})

test("routine edits reject a role that is invalid for its category", () => {
  assert.throws(
    () =>
      applyRoutineEdits(payload, [
        {
          kind: "assignment_role",
          assignmentKey: "assignment:conditioner:conditioner_rinse_out:captured-a",
          role: "dry_finish",
        },
      ]),
    /routine_candidate_invalid_role:conditioner:dry_finish/,
  )
})

test("replacement preserves stable assignment identity and hydrates the frozen product label", () => {
  const candidate = structuredClone(payload)
  candidate.intent.categories[0].assignments.push({
    assignmentKey: "assignment:conditioner:conditioner_rinse_out:captured-b",
    role: "conditioner_rinse_out",
    productRef: { kind: "owned", capturedProductId: "captured-b", productId: "product-b" },
    cadenceOverride: null,
    fitDecision: "standard",
  })
  candidate.items.push({
    ...structuredClone(candidate.items[0]),
    itemKey: "item:conditioner:conditioner_rinse_out:captured-b",
    assignmentKey: "assignment:conditioner:conditioner_rinse_out:captured-b",
    product: {
      kind: "owned",
      capturedProductId: "captured-b",
      productId: "product-b",
      displayName: "Conditioner B",
    },
  })

  const replaced = applyRoutineEdits(candidate, [
    {
      kind: "assignment_replace",
      assignmentKey: "assignment:conditioner:conditioner_rinse_out:captured-a",
      productRef: { kind: "owned", capturedProductId: "captured-b", productId: "product-b" },
    },
  ])
  assert.equal(
    replaced.items[0].assignmentKey,
    "assignment:conditioner:conditioner_rinse_out:captured-a",
  )
  assert.equal(replaced.items[0].product.displayName, "Conditioner B")
  assert.equal(
    payload.items[0].assignmentKey,
    "assignment:conditioner:conditioner_rinse_out:captured-a",
  )

  const removed = applyRoutineEdits(payload, [
    {
      kind: "assignment_remove",
      assignmentKey: "assignment:conditioner:conditioner_rinse_out:captured-a",
    },
  ])
  assert.deepEqual(removed.items, [])
  assert.deepEqual(removed.sections, [
    { key: "basis", itemKeys: [] },
    { key: "optional", itemKeys: [] },
  ])
})

test("multiple edits target the stable original assignment regardless of operation order", () => {
  const edited = applyRoutineEdits(payload, [
    {
      kind: "assignment_replace",
      assignmentKey: "assignment:conditioner:conditioner_rinse_out:captured-a",
      productRef: { kind: "none" },
    },
    {
      kind: "cadence_override",
      assignmentKey: "assignment:conditioner:conditioner_rinse_out:captured-a",
      cadenceOverride: "weekly_2x",
    },
  ])

  assert.equal(edited.items[0].assignmentKey, payload.items[0].assignmentKey)
  assert.equal(edited.items[0].product.kind, "none")
  assert.equal(edited.items[0].cadence.userOverride, "weekly_2x")
})

test("semantic hash ignores persistence placeholders and product display data", () => {
  const persisted = structuredClone(payload)
  persisted.versionId = "routine-version-123"
  persisted.source.productPortfolioVersionId = "portfolio-version-123"
  persisted.createdAt = "2026-08-08T10:00:00.000Z"
  persisted.items[0].product = {
    ...persisted.items[0].product,
    displayName: "Neuer Anzeigename",
  } as (typeof persisted.items)[0]["product"]
  assert.equal(hashRoutineSemantics(payload), hashRoutineSemantics(persisted))
})
