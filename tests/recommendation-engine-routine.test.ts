import assert from "node:assert/strict"
import test from "node:test"

import { buildRoutinePlan } from "../src/lib/routines/planner"
import {
  LOW_DAMAGE_PROFILE,
  SEVERE_DAMAGE_PROFILE,
} from "./recommendation-engine-foundation.fixtures"

function findSlot(plan: ReturnType<typeof buildRoutinePlan>, slotId: string) {
  return plan.sections.flatMap((section) => section.slots).find((slot) => slot.id === slotId)
}

test("routine planner now reflects shared engine decisions for core care slots", () => {
  const plan = buildRoutinePlan(
    {
      ...SEVERE_DAMAGE_PROFILE,
      current_routine_products: [],
    },
    "Bitte stell mir eine Routine fuer stark strapaziertes Haar zusammen.",
  )

  assert.equal(plan.decision_context.shampoo.targetProfile?.shampooBucket, "normal")
  assert.equal(plan.decision_context.conditioner.targetProfile?.balance, "moisture")
  assert.equal(plan.decision_context.conditioner.targetProfile?.repairLevel, "high")
  assert.equal(plan.decision_context.leave_in.targetProfile?.needBucket, "heat_protect")
  assert.equal(plan.decision_context.leave_in.targetProfile?.stylingContext, "heat_style")
  assert.equal(plan.decision_context.mask.relevant, true)
  assert.equal(plan.decision_context.mask.targetProfile?.balance, "moisture")

  assert.equal(findSlot(plan, "base-conditioner")?.action, "add")
  assert.equal(findSlot(plan, "maintenance-leave-in")?.action, "add")
  assert.equal(findSlot(plan, "occasional-mask")?.action, "add")
})

test("routine planner keeps purpose-driven oil requests inside the routine flow", () => {
  const plan = buildRoutinePlan(
    {
      ...LOW_DAMAGE_PROFILE,
      current_routine_products: [],
    },
    "Ich moechte eine Routine inklusive Hair Oiling vor dem Waschen.",
  )

  const oilSlot = findSlot(plan, "occasional-oil")

  assert.ok(oilSlot)
  assert.equal(oilSlot?.action, "add")
  assert.equal(oilSlot?.category, "oil")
  assert.equal(oilSlot?.product_linkable, true)
})
