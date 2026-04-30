import assert from "node:assert/strict"
import test from "node:test"

import {
  buildCompareUserLabel,
  filterEligibleCompareUsers,
  projectCompareUserSnapshot,
} from "../src/lib/agent/compare/test-users"

test("filterEligibleCompareUsers keeps only completed users with hair profiles", () => {
  const result = filterEligibleCompareUsers([
    { id: "u1", full_name: "Lea", onboarding_completed: true, has_hair_profile: true },
    { id: "u2", full_name: "Draft", onboarding_completed: false, has_hair_profile: true },
    { id: "u3", full_name: "Empty", onboarding_completed: true, has_hair_profile: false },
  ])

  assert.deepEqual(
    result.map((user) => user.id),
    ["u1"],
  )
})

test("buildCompareUserLabel falls back to a derived summary when names are missing", () => {
  assert.match(
    buildCompareUserLabel({
      id: "13bba2f3-199f-44fd-9112-5e8a3e00b0b7",
      full_name: null,
      hair_texture: "wavy",
      thickness: "normal",
      concerns: ["frizz", "dryness"],
    }),
    /Testnutzer 13bba2f3 · wavy · normal · frizz · dryness/i,
  )
})

test("projectCompareUserSnapshot keeps profile, routine, and memory visible for the lab", () => {
  const snapshot = projectCompareUserSnapshot({
    userId: "user-123",
    routineInventory: [
      {
        category: "conditioner",
        product_name: "Soft Conditioner",
        frequency_range: "3_4x",
      },
    ],
    relevantMemory: [{ id: "m1", kind: "preference", content: "Bitte einfache Routine." }] as never,
    derivedSignals: ["Haardicke: Fein", "Trockene Laengen"],
  })

  assert.equal(snapshot.user_id, "user-123")
  assert.deepEqual(snapshot.derived_signals, ["Haardicke: Fein", "Trockene Laengen"])
  assert.equal(snapshot.routine_inventory[0]?.product_name, "Soft Conditioner")
  assert.equal(snapshot.relevant_memory[0]?.content, "Bitte einfache Routine.")
})
