import assert from "node:assert/strict"
import test from "node:test"

import {
  INITIAL_UNKNOWN_ROUTINE_CONTEXT,
  STAGE1_CATEGORY_ORDER,
  canonicalizeInitialSnapshotPayload,
  type InitialNeedPlanSnapshot,
} from "../../src/lib/personal-plan/types"
import { COMPLETE_V3_PLAN_ENVELOPE } from "./fixtures"

test("Stage 1 keeps the approved stable category order", () => {
  assert.deepEqual(STAGE1_CATEGORY_ORDER, [
    "shampoo",
    "conditioner",
    "leave_in",
    "heat_protectant",
    "oil",
    "mask",
    "scalp_care",
    "dry_shampoo",
    "bondbuilder",
    "deep_cleansing_shampoo",
  ])
})

test("the initial routine context represents later facts as typed unknowns", () => {
  assert.deepEqual(INITIAL_UNKNOWN_ROUTINE_CONTEXT, {
    currentProductLoad: { state: "unknown", reason: "current_product_load" },
    shampooFrequency: { state: "unknown", reason: "shampoo_frequency" },
    heatToolUse: { state: "unknown", reason: "heat_tool_use" },
    mechanicalExposureSignals: [],
    dryShampooBridgePreference: {
      state: "unknown",
      reason: "dry_shampoo_bridge_preference",
    },
    scalpIrritationState: { state: "unknown", reason: "scalp_irritation_detail" },
  })
})

test("canonical snapshot comparison excludes generated time but preserves decisions", () => {
  const snapshot = {
    schemaVersion: 1,
    snapshotKind: "initial_need",
    computationVersion: "stage1-test",
    inputHash: "hash",
    createdAt: "2026-08-07T12:00:00.000Z",
    sourceQuiz: COMPLETE_V3_PLAN_ENVELOPE,
    profile: {} as InitialNeedPlanSnapshot["profile"],
    assessments: {} as InitialNeedPlanSnapshot["assessments"],
    decisions: [],
    coverage: [],
    productPreviews: [],
    renderedOrder: [],
    deferredFacts: ["heat_tool_use"],
  } satisfies InitialNeedPlanSnapshot

  assert.deepEqual(canonicalizeInitialSnapshotPayload(snapshot), {
    ...snapshot,
    createdAt: undefined,
  })
})
