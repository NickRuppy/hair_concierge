import assert from "node:assert/strict"
import test from "node:test"

import { buildRoutinePlan } from "../src/lib/routines/planner"
import type { HairProfile } from "../src/lib/types"

function createProfile(overrides: Partial<HairProfile> = {}): HairProfile {
  return {
    id: "profile-1",
    user_id: "user-1",
    hair_texture: "wavy",
    thickness: "fine",
    density: "medium",
    concerns: [],
    products_used: null,
    wash_frequency: "every_2_3_days",
    heat_styling: "never",
    styling_tools: [],
    goals: [],
    cuticle_condition: "smooth",
    protein_moisture_balance: "stretches_bounces",
    scalp_type: "balanced",
    scalp_condition: null,
    chemical_treatment: ["natural"],
    desired_volume: "balanced",
    routine_preference: "balanced",
    current_routine_products: ["shampoo", "conditioner"],
    towel_material: null,
    towel_technique: null,
    drying_method: "air_dry",
    brush_type: null,
    night_protection: [],
    uses_heat_protection: false,
    additional_notes: null,
    conversation_memory: null,
    created_at: "2026-04-17T00:00:00.000Z",
    updated_at: "2026-04-17T00:00:00.000Z",
    ...overrides,
  }
}

test("routine planner treats tangling as a support signal instead of a structural one", () => {
  const plan = buildRoutinePlan(
    createProfile({
      concerns: ["tangling"],
    }),
    "Meine Haare verknoten sehr schnell nach dem Waschen.",
  )

  const leaveInSlot = plan.sections
    .flatMap((section) => section.slots)
    .find((slot) => slot.label === "Leave-in / Finish")

  assert.equal(leaveInSlot?.action, "add")
  assert.equal(
    plan.active_topics.some((topic) => topic.id === "bond_builder"),
    false,
  )
})

test("breakage remains visible in the current routine plan", () => {
  const plan = buildRoutinePlan(
    createProfile({
      concerns: ["breakage"],
      cuticle_condition: "rough",
      current_routine_products: ["shampoo", "conditioner"],
    }),
    "Meine Haare brechen schnell ab.",
  )

  const slots = plan.sections.flatMap((section) => section.slots)
  const leaveInSlot = slots.find((slot) => slot.id === "maintenance-leave-in")
  const bondBuilderSlot = slots.find((slot) => slot.id === "occasional-bond-builder")

  assert.equal(leaveInSlot?.action, "add")
  assert.equal(bondBuilderSlot?.action, "add")
  assert.equal(
    plan.active_topics.some((topic) => topic.id === "bond_builder"),
    true,
  )
})
