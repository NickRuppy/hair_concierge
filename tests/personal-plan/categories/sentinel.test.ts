import assert from "node:assert/strict"
import test from "node:test"

import { STAGE1_CATEGORY_ORDER } from "../../../src/lib/personal-plan/types"

test("personal-plan category suite discovers nested tests", () => {
  assert.equal(STAGE1_CATEGORY_ORDER.length, 10)
})
