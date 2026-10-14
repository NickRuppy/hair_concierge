import assert from "node:assert/strict"
import test from "node:test"

import { bondbuilderTimingNoteDe } from "../src/lib/personal-plan/routine/bondbuilder-timing-note"
import type { RoutinePayloadV1 } from "../src/lib/personal-plan/routine/contracts"

type RoutineItem = RoutinePayloadV1["items"][number]

function bondbuilderItem(
  authorityRuleIds: string[],
  product: RoutineItem["product"] = {
    kind: "planned",
    plannedPurchaseId: "planned:bond",
    productId: "olaplex-3plus",
    displayName: "OLAPLEX No.3PLUS",
  },
): RoutineItem {
  return {
    itemKey: "item:bondbuilder:specialized_bond_treatment:gap",
    assignmentKey: "assignment:bondbuilder",
    category: "bondbuilder",
    role: "specialized_bond_treatment",
    purposeKey: "specialized_bond_treatment",
    roleOrder: 0,
    state: {
      systemAssessment: "basis",
      inclusion: "included",
      availability: "planned",
      fitDecision: "standard",
    },
    product,
    cadence: { recommended: null, userOverride: null, displayKey: "personal_plan.cadence.none" },
    sourceDecisionKeys: [],
    authorityRuleIds,
    executable: false,
  } as unknown as RoutineItem
}

test("each unmet suffix maps to its exact line (X1: one neutral line)", () => {
  const cases: Array<[string, string]> = [
    [
      "after_wash.before_wash",
      "Nach dem Waschen gerade nicht möglich. Kommt vor dem Waschen ins Haar.",
    ],
    [
      "before_wash.after_wash",
      "Vor dem Waschen gerade nicht möglich. Kommt nach dem Waschen ins Haar.",
    ],
    [
      "before_wash.overnight",
      "Vor dem Waschen gerade nicht möglich. Kommt abends ins Haar und bleibt über Nacht drin.",
    ],
    [
      "after_wash.overnight",
      "Nach dem Waschen gerade nicht möglich. Kommt abends ins Haar und bleibt über Nacht drin.",
    ],
  ]
  for (const [suffix, line] of cases) {
    assert.equal(
      bondbuilderTimingNoteDe(
        bondbuilderItem(["bondbuilder.need.basis", `bondbuilder.stage3.timing_unmet.${suffix}`]),
      ),
      line,
    )
  }
})

test("no line when the preference is met, for explicit picks, owned products or other categories", () => {
  for (const ruleId of [
    "bondbuilder.stage3.validated_standalone",
    "bondbuilder.stage3.tie_default",
    "bondbuilder.stage3.tie_ordered",
  ]) {
    assert.equal(bondbuilderTimingNoteDe(bondbuilderItem([ruleId])), null)
  }
  // Owned product: the plan keeps her product; the unmet rule never applies.
  assert.equal(
    bondbuilderTimingNoteDe(
      bondbuilderItem(["bondbuilder.stage3.timing_unmet.after_wash.before_wash"], {
        kind: "owned",
        userProductId: "owned-1",
        productId: "olaplex-3plus",
        displayName: "OLAPLEX No.3PLUS",
      } as never),
    ),
    null,
  )
  // Unknown actual timing: nothing honest to say.
  assert.equal(
    bondbuilderTimingNoteDe(
      bondbuilderItem(["bondbuilder.stage3.timing_unmet.after_wash.unknown"]),
    ),
    null,
  )
  assert.equal(
    bondbuilderTimingNoteDe({
      ...bondbuilderItem(["bondbuilder.stage3.timing_unmet.after_wash.before_wash"]),
      category: "mask",
    } as RoutineItem),
    null,
  )
})
