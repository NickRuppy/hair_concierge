import assert from "node:assert/strict"
import test from "node:test"

import {
  createBuildOrFixRoutineTool,
  projectRoutinePlan,
} from "../src/lib/agent/tools/build-or-fix-routine"
import {
  adaptRecommendationInputFromPersistence,
  buildEffectiveCareContext,
} from "../src/lib/recommendation-engine"
import type { HairProfile } from "../src/lib/types"

function createProfile(overrides: Partial<HairProfile> = {}): HairProfile {
  return {
    id: "profile-1",
    user_id: "user-1",
    hair_texture: "curly",
    thickness: "normal",
    hair_length: null,
    density: "medium",
    concerns: ["dryness"],
    products_used: null,
    shampoo_frequency: "weekly_3_4x",
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
    frequency: "3-4x/Woche",
    reasons: [
      "Shampoo ist bereits ein vorhandener Startpunkt in deiner Routine.",
      "Shampoo bleibt der feste Startpunkt für die Kopfhaut und die Waschfrequenz.",
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
      shampoo_frequency: null,
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
      key: "shampoo_frequency",
      label: "Shampoo-Rhythmus",
      why_it_matters: "Der Shampoo-Rhythmus bestimmt, wie oft die Routine wirklich greifen muss.",
      blocking: false,
      expected_type: "ProductFrequency",
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
      shampoo_frequency: null,
      current_routine_products: [],
      products_used: "Ich nutze Shampoo und Conditioner",
    }),
    message: "Routine optimieren",
  })

  assert.equal(result.confidence, 0.33)
  assert.deepEqual(result.missing_info, [
    {
      key: "shampoo_frequency",
      label: "Shampoo-Rhythmus",
      why_it_matters: "Der Shampoo-Rhythmus bestimmt, wie oft die Routine wirklich greifen muss.",
      blocking: false,
      expected_type: "ProductFrequency",
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
      shampoo_frequency: "daily_1x",
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
  assert.match(result.priority_context?.selected_reason ?? "", /Rückstände|Reset|Build-up|Öl/i)
  assert.ok(result.priority_context?.adjacent_levers.some((lever) => lever.category === "leave_in"))
})

test("projectRoutinePlan exposes side-by-side CareBalance frequency framing without changing routine steps", () => {
  const result = projectRoutinePlan({
    objective: "fix_routine",
    message: "Mein Ansatz ist platt und ich nutze jeden Tag Oel. Wie anpassen?",
    layer: "basics",
    requestedCategory: "oil",
    hairProfile: createProfile({
      goals: ["volume"],
      current_routine_products: ["shampoo", "conditioner", "oil"],
      products_used: "Shampoo, Conditioner, Oel",
    }),
    routineItems: [
      {
        category: "oil",
        product_name: "Daily Oil",
        frequency_range: "daily_1x",
      },
    ],
  } as Parameters<typeof projectRoutinePlan>[0] & {
    routineItems: Array<{
      category: string
      product_name: string | null
      frequency_range: "daily_1x"
    }>
  })

  assert.deepEqual(
    result.steps.map((step) => step.id),
    ["base-shampoo", "base-conditioner", "occasional-hair-reset"],
  )

  const oilFrame = (
    result as unknown as {
      care_balance_context?: {
        rows: Array<{
          category: string
          action: string
          reason_codes: string[]
          usage_hint: string
          authority: {
            current_turn_category_decision: boolean
          }
        }>
      }
    }
  ).care_balance_context?.rows.find((row) => row.category === "oil")

  assert.equal(oilFrame?.action, "decrease_frequency")
  assert.deepEqual(oilFrame?.reason_codes, ["daily_oil_use", "buildup_or_flatness_pressure"])
  assert.match(oilFrame?.usage_hint ?? "", /weekly_1x|daily_1x|need_based_support/)
  assert.equal(oilFrame?.authority.current_turn_category_decision, true)
  assert.match(JSON.stringify(result), /legacy|comparison|production_decision_context/)
})

test("projectRoutinePlan includes shampoo cadence in care balance context", () => {
  const result = projectRoutinePlan({
    hairProfile: createProfile({
      scalp_type: "oily",
      concerns: ["oily_scalp"],
      current_routine_products: ["shampoo", "conditioner"],
    }),
    routineItems: [
      {
        category: "shampoo",
        product_name: "Existing shampoo",
        frequency_range: "weekly_1x",
      },
    ],
    message: "Soll ich mein Shampoo anders nutzen?",
  })

  const careBalanceContext = result.care_balance_context as
    | {
        shampoo_cadence?: {
          current_frequency: string | null
          target_min: string | null
          target_max: string | null
          target_preferred: string | null
          delta: string
          base_band: string | null
          target_band: string | null
          reason_codes: string[]
          caveat_codes: string[]
        }
      }
    | null
    | undefined

  assert.deepEqual(careBalanceContext?.shampoo_cadence, {
    current_frequency: "weekly_1x",
    target_min: "weekly_2x",
    target_max: "weekly_5_6x",
    target_preferred: "weekly_3_4x",
    delta: "below",
    position_in_range: null,
    base_band: "high",
    target_band: "high",
    reason_codes: ["base_scalp_type_oily", "modifier_up_oily_scalp_concern"],
    caveat_codes: [],
  })
})

test("projectRoutinePlan preserves supplied effective care context in care balance output", () => {
  const hairProfile = createProfile({
    thickness: "coarse",
    goals: ["volume"],
    current_routine_products: ["shampoo", "conditioner", "oil"],
    products_used: "Shampoo, Conditioner, Oel",
  })
  const routineItems = [
    {
      category: "oil",
      product_name: "Daily Oil",
      frequency_range: "daily_1x",
    },
  ] as const
  const adapted = adaptRecommendationInputFromPersistence(hairProfile, [...routineItems])
  const effectiveCareContext = buildEffectiveCareContext(adapted.input, [
    {
      kind: "profile_override",
      field: "thickness",
      value: "fine",
      evidenceQuote: "Actually my hair is fine",
      source: "current_turn",
    },
  ])

  const result = projectRoutinePlan({
    objective: "fix_routine",
    message: "Actually my hair is fine, bitte mach meine Routine leichter.",
    hairProfile,
    routineItems: [...routineItems],
    effectiveCareContext,
  } as Parameters<typeof projectRoutinePlan>[0] & {
    effectiveCareContext: typeof effectiveCareContext
  })

  const careBalanceContext = result.care_balance_context as
    | {
        current_turn_facts?: unknown[]
        conflicts?: Array<{ field_path: string; current_turn_value: unknown }>
      }
    | null
    | undefined

  assert.equal(careBalanceContext?.current_turn_facts?.length, 1)
  assert.ok(
    careBalanceContext?.conflicts?.some(
      (conflict) =>
        conflict.field_path === "profile.thickness" && conflict.current_turn_value === "fine",
    ),
  )
})

test("projectRoutinePlan includes explicit add-step category in basics", () => {
  const result = projectRoutinePlan({
    hairProfile: createProfile({
      hair_texture: "straight",
      thickness: "fine",
      concerns: [],
      goals: [],
      current_routine_products: ["shampoo", "conditioner"],
    }),
    message: "Bau ein Leave-in in meine Routine ein.",
    layer: "basics",
    requestedCategory: "leave_in",
    mutationKind: "add_step",
  })

  assert.deepEqual(
    result.steps.map((step) => step.id),
    ["base-shampoo", "base-conditioner", "maintenance-leave-in"],
  )

  const leaveInStep = result.steps.find((step) => step.id === "maintenance-leave-in")
  assert.equal(leaveInStep?.category, "leave_in")
})

test("projectRoutinePlan uses CareBalance add rows for broad first-add-on basics requests", () => {
  const result = projectRoutinePlan({
    objective: "fix_routine",
    hairProfile: createProfile({
      hair_texture: "wavy",
      thickness: "normal",
      concerns: ["frizz"],
      goals: ["shine"],
      current_routine_products: ["shampoo", "conditioner"],
      products_used: "Shampoo, Conditioner",
      routine_preference: "minimal",
    }),
    message:
      "Ich will meine Routine einfacher machen. Welches Produkt passt fuer den ersten Zusatz?",
    layer: "basics",
  })

  assert.deepEqual(
    result.steps.map((step) => step.id),
    ["base-shampoo", "base-conditioner", "maintenance-leave-in"],
  )

  const leaveInStep = result.steps.find((step) => step.id === "maintenance-leave-in")
  assert.equal(leaveInStep?.category, "leave_in")
  assert.equal(leaveInStep?.action, "add")
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
  assert.match(conditionerStep?.reasons.join(" ") ?? "", /nächst|hinzufügen|ergänzen/i)
})
