import assert from "node:assert/strict"
import test from "node:test"

import {
  createBuildOrFixRoutineTool,
  projectRoutinePlan,
} from "../src/lib/agent/tools/build-or-fix-routine"
import type { HairProfile } from "../src/lib/types"

function createProfile(overrides: Partial<HairProfile> = {}): HairProfile {
  return {
    id: "profile-1",
    user_id: "user-1",
    hair_texture: "curly",
    thickness: "normal",
    density: "medium",
    concerns: ["dryness"],
    products_used: null,
    wash_frequency: "every_2_3_days",
    heat_styling: "never",
    styling_tools: [],
    goals: ["moisture"],
    cuticle_condition: "rough",
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
    created_at: "2026-04-22T00:00:00.000Z",
    updated_at: "2026-04-22T00:00:00.000Z",
    ...overrides,
  }
}

test("projectBuildOrFixRoutinePlan projects a thin agent-facing routine payload", () => {
  const result = projectRoutinePlan({
    hairProfile: createProfile(),
    message: "Routine fuer lockiges, trockenes Haar reparieren",
  })

  assert.equal(result.objective, null)
  assert.equal(result.confidence, 1)
  assert.deepEqual(result.missing_info, [])

  const shampooStep = result.steps.find((step) => step.id === "base-shampoo")
  const leaveInStep = result.steps.find((step) => step.id === "maintenance-leave-in")

  assert.deepEqual(shampooStep, {
    id: "base-shampoo",
    label: "Shampoo",
    necessity: "core",
    action: "keep",
    category: "shampoo",
    frequency: "Alle 2-3 Tage",
    reasons: [
      "Shampoo ist bereits ein vorhandener Startpunkt in deiner Routine.",
      "Shampoo bleibt der feste Startpunkt fuer die Kopfhaut und die Waschfrequenz.",
      "Die Kopfhaut ist hier ein echtes Steuersignal (Ausgeglichen).",
    ],
    caveats: [],
    fillable: false,
  })

  assert.equal(leaveInStep?.necessity, "recommended")
  assert.equal(leaveInStep?.action, "add")
  assert.equal(leaveInStep?.category, "leave_in")
  assert.equal(leaveInStep?.fillable, true)
})

test("createBuildOrFixRoutineTool derives machine-readable missing-info from completeness signals", async () => {
  const tool = createBuildOrFixRoutineTool()

  const result = await tool({
    hairProfile: createProfile({
      hair_texture: null,
      scalp_type: null,
      wash_frequency: null,
      current_routine_products: [],
      concerns: [],
      goals: [],
    }),
    message: "Routine bauen",
  })

  assert.equal(result.objective, null)
  assert.equal(result.confidence, 0)
  assert.deepEqual(result.missing_info, [
    {
      key: "hair_texture",
      label: "Haarmuster",
      why_it_matters: "Das Haarmuster legt fest, wie die Basisroutine strukturiert wird.",
      blocking: false,
      expected_type: "HairTexture",
    },
    {
      key: "wash_frequency",
      label: "Waschfrequenz",
      why_it_matters: "Die Waschfrequenz bestimmt, wie oft die Routine wirklich greifen muss.",
      blocking: false,
      expected_type: "WashFrequency",
    },
    {
      key: "current_routine_products",
      label: "Aktuelle Routine",
      why_it_matters:
        "Ohne die vorhandenen Schritte laesst sich nicht sauber sagen, was beibehalten oder ersetzt werden sollte.",
      blocking: false,
      expected_type: "RoutineProduct[]",
    },
  ])
})

test("createBuildOrFixRoutineTool accepts an optional objective and stable hairProfile input", async () => {
  const tool = createBuildOrFixRoutineTool()

  const result = await tool({
    hairProfile: createProfile(),
    message: "Routine fuer lockiges Haar",
  })

  assert.equal(result.objective, null)
  assert.equal(result.steps.length > 0, true)
})

test("projectRoutinePlan keeps missing-info tied to actual fields when only the machine fields are incomplete", () => {
  const result = projectRoutinePlan({
    hairProfile: createProfile({
      scalp_type: "balanced",
      wash_frequency: null,
      current_routine_products: [],
      products_used: "Ich nutze Shampoo und Conditioner",
    }),
    message: "Routine optimieren",
  })

  assert.equal(result.confidence, 0.33)
  assert.deepEqual(result.missing_info, [
    {
      key: "wash_frequency",
      label: "Waschfrequenz",
      why_it_matters: "Die Waschfrequenz bestimmt, wie oft die Routine wirklich greifen muss.",
      blocking: false,
      expected_type: "WashFrequency",
    },
    {
      key: "current_routine_products",
      label: "Aktuelle Routine",
      why_it_matters:
        "Ohne die vorhandenen Schritte laesst sich nicht sauber sagen, was beibehalten oder ersetzt werden sollte.",
      blocking: false,
      expected_type: "RoutineProduct[]",
    },
  ])
})

test("explicit OWC explain requests keep instruction slots optional in the agent projection", () => {
  const result = projectRoutinePlan({
    hairProfile: createProfile(),
    message: "OWC bitte erklaeren",
  })

  const owcStep = result.steps.find((step) => step.id === "base-owc-technique")

  assert.equal(owcStep?.necessity, "optional")
})

test("projectRoutinePlan uses objective to relax inventory requirements for build_routine", () => {
  const hairProfile = createProfile({
    current_routine_products: [],
    products_used: "Ich nutze Shampoo und Conditioner",
  })

  const buildResult = projectRoutinePlan({
    objective: "build_routine",
    hairProfile,
    message: "Hilf mir bitte.",
  })

  const fixResult = projectRoutinePlan({
    objective: "fix_routine",
    hairProfile,
    message: "Hilf mir bitte.",
  })

  assert.deepEqual(buildResult.missing_info, [])
  assert.equal(buildResult.confidence, 1)
  assert.deepEqual(fixResult.missing_info, [
    {
      key: "current_routine_products",
      label: "Aktuelle Routine",
      why_it_matters:
        "Ohne die vorhandenen Schritte laesst sich nicht sauber sagen, was beibehalten oder ersetzt werden sollte.",
      blocking: false,
      expected_type: "RoutineProduct[]",
    },
  ])
  assert.equal(fixResult.confidence, 0.67)
})

test("projectRoutinePlan lets objective steer the projected routine structure", () => {
  const hairProfile = createProfile()

  const buildResult = projectRoutinePlan({
    objective: "build_routine",
    hairProfile,
    message: "Hilf mir bitte.",
  })

  const fixResult = projectRoutinePlan({
    objective: "fix_routine",
    hairProfile,
    message: "Hilf mir bitte.",
  })

  assert.notDeepEqual(
    buildResult.steps.map((step) => step.id),
    fixResult.steps.map((step) => step.id),
  )
})

test("projectRoutinePlan exposes priority context without changing basics scoring", () => {
  const result = projectRoutinePlan({
    objective: "fix_routine",
    message:
      "ich nutze kokosoel jeden tag und hab gehoert, das sei nicht so gut. wie kann ich routine anpassen",
    layer: "basics",
    requestedCategory: "oil",
    hairProfile: createProfile({
      hair_texture: "curly",
      thickness: "normal",
      density: null,
      scalp_type: "balanced",
      scalp_condition: null,
      wash_frequency: "daily",
      products_used: "Shampoo: Old Spice, Oel: Kokosoel, Conditioner: Keine Ahnung",
      current_routine_products: ["shampoo", "oil", "conditioner"],
      goals: ["less_volume", "curl_definition", "healthier_hair"],
      concerns: [],
      drying_method: "air_dry",
    }),
  })

  assert.deepEqual(
    result.steps.map((step) => step.id),
    ["base-shampoo", "base-conditioner", "occasional-hair-reset"],
  )
  assert.equal(result.priority_context?.selected_step_id, "occasional-hair-reset")
  assert.match(result.priority_context?.selected_reason ?? "", /Rueckstaende|Reset|Build-up|Oel/i)
  assert.ok(result.priority_context?.adjacent_levers.some((lever) => lever.category === "leave_in"))
})

test("projectRoutinePlan marks existing shampoo as keep and additions as next steps", () => {
  const result = projectRoutinePlan({
    objective: "build_routine",
    layer: "basics",
    message: "wie mache ich meine haare schoener",
    hairProfile: createProfile({
      hair_texture: "straight",
      thickness: "coarse",
      current_routine_products: ["shampoo"],
      products_used: "Shampoo",
      heat_styling: "daily",
      goals: ["less_split_ends"],
      concerns: [],
    }),
  })

  const shampooStep = result.steps.find((step) => step.category === "shampoo")
  const conditionerStep = result.steps.find((step) => step.category === "conditioner")

  assert.equal(shampooStep?.action, "keep")
  assert.match(shampooStep?.reasons.join(" ") ?? "", /bereits|schon|vorhanden|Startpunkt/i)
  assert.equal(conditionerStep?.action, "add")
  assert.match(conditionerStep?.reasons.join(" ") ?? "", /naechst|hinzufuegen|ergaenzen/i)
})
