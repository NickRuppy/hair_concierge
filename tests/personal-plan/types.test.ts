import assert from "node:assert/strict"
import test from "node:test"

import { STAGE1_CATEGORY_ORDER } from "../../src/lib/personal-plan/types"

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
