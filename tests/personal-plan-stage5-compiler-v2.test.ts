import assert from "node:assert/strict"
import test from "node:test"

import { compileApplicationViewV2 as compileApplicationViewV2Impl } from "../src/lib/routines/personal-plan/application/compiler-v2"
import { APPLICATION_DAY_TYPE_KEYS } from "../src/lib/routines/personal-plan/application/contracts"
import type { ProductApplicationPointerV2 } from "../src/lib/routines/personal-plan/application/contracts-v2"
import { SHARED_APPLICATION_TEMPLATES_V2 } from "../src/lib/routines/personal-plan/application/shared-templates-v2"

const compileApplicationViewV2 = compileApplicationViewV2Impl

const productId = "30000000-0000-4000-8000-000000000001"
const shampooProductId = "30000000-0000-4000-8000-000000000002"

function pointer(
  overrides: Partial<ProductApplicationPointerV2> = {},
): ProductApplicationPointerV2 {
  return {
    schemaVersion: 2,
    contractKind: "product_pointer",
    scope: { kind: "product", category: "shampoo", productId },
    sourceRole: "shampoo_everyday",
    role: "cleanse",
    applicationFamily: "standard_rinse_out_cleanse",
    facts: {
      applicationState: "wet_hair",
      applicationArea: "scalp_roots",
      rinse: "rinse_out",
      contactTime: null,
      amount: null,
      heat: null,
      conditionerPolicy: "not_applicable",
    },
    workflowId: null,
    requiredCompanionProductId: null,
    runtimeBlockerCode: null,
    exactSteps: [],
    cautionCodes: [],
    evidence: [
      {
        sourceUrl: "https://example.com/product",
        sourceType: "manufacturer",
        checkedAt: "2026-08-12",
      },
    ],
    ...overrides,
  }
}

function input(category = "shampoo", role = "cleanse") {
  const supportingShampoo =
    category === "shampoo"
      ? []
      : [
          {
            itemId: "item-shampoo",
            productId: shampooProductId,
            productName: "Canonical shampoo",
            category: "shampoo",
            role: "cleanse",
            inclusion: "included" as const,
            availability: "owned" as const,
            executable: true,
            applicationInstanceKey: "item-shampoo",
            catalogFacts: {},
          },
        ]
  return {
    routineItems: [
      ...supportingShampoo,
      {
        itemId: "item-1",
        productId,
        productName: "OGX Renewing + Argan Oil of Morocco Shampoo",
        category,
        role,
        inclusion: "included" as const,
        availability: "owned" as const,
        executable: true,
        applicationInstanceKey: "item-1",
        catalogFacts: {},
      },
    ],
    unresolvedRoutineItems: [],
    profile: {},
    dayTypes: APPLICATION_DAY_TYPE_KEYS.map((key, index) => ({ key, sortOrder: index + 1 })),
  } as never
}

function supportingShampooPointer() {
  return pointer({
    scope: { kind: "product", category: "shampoo", productId: shampooProductId },
  })
}

test("V2 compiler renders OGX through canonical shampoo copy only", () => {
  const result = compileApplicationViewV2({
    input: input(),
    familyTemplates: SHARED_APPLICATION_TEMPLATES_V2,
    productPointers: [pointer()],
  })

  assert.deepEqual(result.pointerIssues, [])
  const washDay = result.days.find(({ key }) => key === "wash_day")
  assert.ok(washDay)
  const block = washDay.productBlocks[0]
  assert.ok(block)
  assert.deepEqual(
    block.steps.map(({ copyDe }) => copyDe),
    [
      "Haare und Kopfhaut vollständig anfeuchten.",
      "Eine kleine Menge auf die Kopfhaut geben und sanft einmassieren. Die Längen werden beim Ausspülen mitgereinigt.",
      "Gründlich ausspülen.",
    ],
  )
  assert.doesNotMatch(JSON.stringify(block.steps), /OGX|Conditioner/i)
  const visibleWettingSteps = washDay.outerSequence
    .flatMap((step) =>
      step.kind === "state_transition"
        ? [step.copyDe]
        : step.kind === "product"
          ? step.block.steps.map(({ copyDe }) => copyDe)
          : [],
    )
    .filter((copyDe) => /anfeuchten/.test(copyDe))
  assert.deepEqual(visibleWettingSteps, ["Haare und Kopfhaut vollständig anfeuchten."])
})

test("use-case coverage omits an active product with missing pointer authority instead of rendering a partial card", () => {
  const result = compileApplicationViewV2({
    input: input("leave_in", "leave_in"),
    familyTemplates: SHARED_APPLICATION_TEMPLATES_V2,
    productPointers: [supportingShampooPointer()],
  })

  assert.deepEqual(result.pointerIssues, [
    { productId, role: "leave_in", reason: "missing_pointer" },
  ])
  assert.equal(
    result.days.some((day) =>
      day.outerSequence.some(
        (entry) =>
          (entry.kind === "product" || entry.kind === "unresolved_product") &&
          entry.block.productId === productId,
      ),
    ),
    false,
  )
})

test("V2 compiler renders towel-drying once when the Leave-in protocol already owns it", () => {
  const result = compileApplicationViewV2({
    input: input("leave_in", "leave_in"),
    familyTemplates: SHARED_APPLICATION_TEMPLATES_V2,
    productPointers: [
      supportingShampooPointer(),
      pointer({
        scope: { kind: "product", category: "leave_in", productId },
        sourceRole: "leave_in",
        role: "leave_in",
        applicationFamily: "post_wash_booster",
        facts: {
          ...pointer().facts,
          applicationState: "damp_hair",
          applicationArea: "hair_lengths_ends",
          rinse: "leave_in",
        },
      }),
    ],
  })

  assert.deepEqual(result.pointerIssues, [])
  const washDay = result.days.find(({ key }) => key === "wash_day")
  assert.ok(washDay)
  const visibleTowelDryingSteps = washDay.outerSequence
    .flatMap((step) =>
      step.kind === "state_transition"
        ? [step.copyDe]
        : step.kind === "product"
          ? step.block.steps.map(({ copyDe }) => copyDe)
          : [],
    )
    .filter((copyDe) => /handtuch/i.test(copyDe))
  assert.deepEqual(visibleTowelDryingSteps, ["Das Haar nach dem Waschen sanft handtuchtrocknen."])
})

test("V2 compiler keeps the wetting fallback for an exact shampoo workflow without one", () => {
  const result = compileApplicationViewV2({
    input: input(),
    familyTemplates: SHARED_APPLICATION_TEMPLATES_V2,
    productPointers: [
      pointer({
        applicationFamily: "targeted_treatment_shampoo",
        facts: {
          ...pointer().facts,
          contactTime: { kind: "seconds", seconds: 180 },
        },
        workflowId: "swiss_o_par_tea_tree_two_pass",
        exactSteps: [
          {
            stepKey: "first-cleanse",
            action: "apply_product",
            copyDe: "Das Haar mit dem Kurshampoo einschäumen und durchwaschen.",
          },
          { stepKey: "rinse", action: "rinse", copyDe: "Ausspülen." },
        ],
      }),
    ],
  })

  assert.deepEqual(result.pointerIssues, [])
  const washDay = result.days.find(({ key }) => key === "wash_day")
  assert.ok(washDay)
  assert.deepEqual(washDay.outerSequence[0], {
    kind: "state_transition",
    fromAnchor: "dry",
    toAnchor: "wet_cleanse",
    copyDe: "Haare gründlich mit Wasser anfeuchten.",
  })
})

test("V2 compiler interpolates a reviewed contact time without product prose", () => {
  const result = compileApplicationViewV2({
    input: input("conditioner", "condition"),
    familyTemplates: SHARED_APPLICATION_TEMPLATES_V2,
    productPointers: [
      supportingShampooPointer(),
      pointer({
        scope: { kind: "product", category: "conditioner", productId },
        role: "condition",
        applicationFamily: "standard_rinse_out_conditioning",
        facts: {
          ...pointer().facts,
          applicationArea: "hair_lengths_ends",
          contactTime: { kind: "seconds", seconds: 60 },
          conditionerPolicy: "not_applicable",
        },
      }),
    ],
  })

  const block = result.days
    .find(({ key }) => key === "wash_day")
    ?.productBlocks.find((entry) => entry.productId === productId)
  assert.ok(block)
  assert.ok(block.steps.some(({ copyDe }) => copyDe === "1 Minute einwirken lassen."))
})

test("V2 compiler fails a mask closed when its required time is absent", () => {
  const result = compileApplicationViewV2({
    input: input("mask", "intensive_care"),
    familyTemplates: SHARED_APPLICATION_TEMPLATES_V2,
    productPointers: [
      supportingShampooPointer(),
      pointer({
        scope: { kind: "product", category: "mask", productId },
        role: "intensive_care",
        applicationFamily: "post_shampoo_rinse_out_mask",
        facts: {
          ...pointer().facts,
          applicationArea: "hair_lengths_ends",
          conditionerPolicy: "replaces_conditioner",
        },
      }),
    ],
  })

  assert.deepEqual(result.pointerIssues, [
    { productId, role: "intensive_care", reason: "missing_contact_time" },
  ])
  assert.equal(
    result.days
      .find(({ key }) => key === "intensive_care_day")
      ?.productBlocks.some((entry) => entry.productId === productId) ?? false,
    false,
  )
})

test("V2 compiler renders only allow-listed exact workflow steps", () => {
  const exact = pointer({
    scope: { kind: "product", category: "bondbuilder", productId },
    role: "bond_repair",
    applicationFamily: "post_shampoo_timed_leave_in",
    facts: {
      ...pointer().facts,
      applicationState: "damp_hair",
      applicationArea: "hair_lengths_ends",
      rinse: "leave_in",
      contactTime: { kind: "seconds", seconds: 240 },
      conditionerPolicy: "no_conditioner",
    },
    workflowId: "k18_leave_in_molecular_repair",
    exactSteps: [
      { stepKey: "apply", action: "apply_product", copyDe: "1–3 Pumpstöße einarbeiten." },
      { stepKey: "wait", action: "wait", copyDe: "4 Minuten warten und nicht ausspülen." },
    ],
  })
  const result = compileApplicationViewV2({
    input: input("bondbuilder", "bond_repair"),
    familyTemplates: SHARED_APPLICATION_TEMPLATES_V2,
    productPointers: [supportingShampooPointer(), exact],
  })

  assert.deepEqual(result.pointerIssues, [])
  assert.deepEqual(
    result.days
      .find(({ key }) => key === "bond_repair_day")
      ?.productBlocks.find((entry) => entry.productId === productId)?.steps,
    [
      { stepKey: "apply", action: "apply_product", copyDe: "1–3 Pumpstöße einarbeiten." },
      { stepKey: "wait", action: "wait", copyDe: "4 Minuten warten und nicht ausspülen." },
    ],
  )
})

test("V2 compiler selects canonical damp or dry heat copy for each heat event", () => {
  const applicationInput = input("heat_protectant", "heat_protection") as never as {
    profile: Record<string, unknown>
  }
  applicationInput.profile = {
    heatEvents: [
      { id: "dryer", tool: "hair_dryer", route: "airflow_shaping" },
      { id: "iron", tool: "straightener", route: "direct_contact_heat" },
    ],
  }
  const result = compileApplicationViewV2({
    input: applicationInput as never,
    familyTemplates: SHARED_APPLICATION_TEMPLATES_V2,
    productPointers: [
      supportingShampooPointer(),
      pointer({
        scope: { kind: "product", category: "heat_protectant", productId },
        role: "heat_protection",
        applicationFamily: "either_state_protection",
        facts: {
          ...pointer().facts,
          applicationState: "damp_hair",
          applicationArea: "root_to_tip_hair",
          rinse: "leave_in",
          heat: {
            supportedStates: ["damp_hair", "dry_hair"],
            activationRequired: false,
            maximumClaimedTemperatureC: null,
            reapplication: "each_separate_heat_event",
          },
        },
      }),
    ],
  })

  assert.deepEqual(result.pointerIssues, [])
  const copies = result.days
    .find(({ key }) => key === "styling_day")
    ?.productBlocks.filter((block) => block.productId === productId)
    .flatMap((block) => block.steps.map(({ copyDe }) => copyDe))
  assert.deepEqual(copies, [
    "Gleichmäßig auf handtuchtrockenem Haar verteilen. Erst danach föhnen oder stylen.",
    "Gleichmäßig auf vollständig trockenem Haar verteilen. Erst danach das heiße Tool verwenden.",
  ])
})

test("V2 compiler gives every conventional Leave-in dry and damp between-wash methods", () => {
  const result = compileApplicationViewV2({
    input: input("leave_in", "leave_in"),
    familyTemplates: SHARED_APPLICATION_TEMPLATES_V2,
    productPointers: [
      supportingShampooPointer(),
      pointer({
        scope: { kind: "product", category: "leave_in", productId },
        sourceRole: "post_wash_leave_in",
        role: "leave_in",
        applicationFamily: "post_wash_damp_conditioning",
        facts: {
          ...pointer().facts,
          applicationState: "damp_hair",
          applicationArea: "hair_lengths_ends",
          rinse: "leave_in",
        },
      }),
    ],
  })

  assert.deepEqual(result.pointerIssues, [])
  assert.ok(
    result.days
      .find(({ key }) => key === "wash_day")
      ?.productBlocks.some((block) => block.productId === productId),
  )
  const refreshBlocks =
    result.days
      .find(({ key }) => key === "refresh_day")
      ?.productBlocks.filter((block) => block.productId === productId) ?? []
  assert.equal(refreshBlocks.length, 1)
  assert.deepEqual(
    refreshBlocks[0]?.steps
      .filter(({ action }) => action === "section")
      .map(({ copyDe }) => copyDe),
    ["Nach dem Anfeuchten (empfohlen)", "Auf trockenem Haar"],
  )
  assert.ok(
    refreshBlocks[0]?.steps.some(
      ({ copyDe }) =>
        copyDe ===
        "Die betroffenen Längen und Spitzen leicht anfeuchten. Eine sehr kleine Menge in den Händen verteilen und gezielt in Längen und Spitzen einarbeiten. Ansatz und Kopfhaut aussparen. Nicht ausspülen.",
    ),
  )
})

test("V2 compiler adapts the dry between-wash method to a cream on fine hair", () => {
  const applicationInput = input("leave_in", "leave_in") as never as {
    routineItems: Array<{ productId: string; catalogFacts: Record<string, unknown> }>
    profile: { thickness?: string }
  }
  applicationInput.routineItems.find((item) => item.productId === productId)!.catalogFacts = {
    format: "cream",
  }
  applicationInput.profile = { thickness: "fine" }

  const result = compileApplicationViewV2({
    input: applicationInput as never,
    familyTemplates: SHARED_APPLICATION_TEMPLATES_V2,
    productPointers: [
      supportingShampooPointer(),
      pointer({
        scope: { kind: "product", category: "leave_in", productId },
        sourceRole: "post_wash_leave_in",
        role: "leave_in",
        applicationFamily: "post_wash_damp_conditioning",
        facts: {
          ...pointer().facts,
          applicationState: "damp_hair",
          applicationArea: "hair_lengths_ends",
          rinse: "leave_in",
        },
      }),
    ],
  })

  const steps = result.days
    .find(({ key }) => key === "refresh_day")
    ?.productBlocks.find((block) => block.productId === productId)?.steps
  assert.ok(steps)
  assert.ok(
    steps.some(({ copyDe }) => copyDe.includes("vollständig zwischen den Handflächen verreiben")),
  )
  assert.ok(steps.some(({ copyDe }) => copyDe.includes("besonders sparsam")))
})

test("V2 compiler gives a conventional finishing Oil one dry-first between-wash card", () => {
  const result = compileApplicationViewV2({
    input: input("oil", "finish"),
    familyTemplates: SHARED_APPLICATION_TEMPLATES_V2,
    productPointers: [
      supportingShampooPointer(),
      pointer({
        scope: { kind: "product", category: "oil", productId },
        sourceRole: "dry_finish",
        role: "finish",
        applicationFamily: "dry_finish",
        facts: {
          ...pointer().facts,
          applicationState: "dry_hair",
          applicationArea: "hair_lengths_ends",
          rinse: "leave_in",
        },
      }),
    ],
  })

  assert.deepEqual(result.pointerIssues, [])
  const refreshBlocks =
    result.days
      .find(({ key }) => key === "between_wash_care_day")
      ?.productBlocks.filter((block) => block.productId === productId) ?? []
  assert.equal(refreshBlocks.length, 1)
  assert.deepEqual(
    refreshBlocks[0]?.steps
      .filter(({ action }) => action === "section")
      .map(({ copyDe }) => copyDe),
    ["Auf trockenem Haar (empfohlen)", "Nach leichtem Anfeuchten"],
  )
  assert.ok(
    refreshBlocks[0]?.steps.some(({ copyDe }) =>
      copyDe.includes("mit feuchten Händen leicht anfeuchten"),
    ),
  )
})

test("V2 compiler generalizes a conventional damp Oil role and adapts rich Oil dosage", () => {
  const applicationInput = input("oil", "leave_in") as never as {
    routineItems: Array<{ productId: string; catalogFacts: Record<string, unknown> }>
    profile: { thickness?: string; density?: string }
  }
  applicationInput.routineItems.find((item) => item.productId === productId)!.catalogFacts = {
    weight: "rich",
  }
  applicationInput.profile = { thickness: "fine", density: "low" }

  const result = compileApplicationViewV2({
    input: applicationInput as never,
    familyTemplates: SHARED_APPLICATION_TEMPLATES_V2,
    productPointers: [
      supportingShampooPointer(),
      pointer({
        scope: { kind: "product", category: "oil", productId },
        sourceRole: "leave_on_fibre_conditioning",
        role: "leave_in",
        applicationFamily: "post_wash_damp_conditioning",
        facts: {
          ...pointer().facts,
          applicationState: "damp_hair",
          applicationArea: "hair_lengths_ends",
          rinse: "leave_in",
        },
      }),
    ],
  })

  assert.deepEqual(result.pointerIssues, [])
  const steps = result.days
    .find(({ key }) => key === "refresh_day")
    ?.productBlocks.find((block) => block.productId === productId)?.steps
  assert.ok(steps)
  assert.ok(steps.some(({ copyDe }) => copyDe.includes("Mit 1 Tropfen")))
  assert.ok(steps.some(({ copyDe }) => copyDe.includes("reichhaltigen Öl")))
  assert.ok(steps.some(({ copyDe }) => copyDe.includes("besonders sparsam")))
})

test("V2 compiler groups one Oil selected for finish and leave-in roles only once", () => {
  const applicationInput = input("oil", "finish") as never as {
    routineItems: Array<Record<string, unknown>>
  }
  const oilItem = applicationInput.routineItems.find((item) => item.productId === productId)!
  applicationInput.routineItems.push({
    ...oilItem,
    itemId: "item-oil-leave-in",
    role: "leave_in",
    applicationInstanceKey: "assignment-oil-leave-in",
  })
  const dryFinish = pointer({
    scope: { kind: "product", category: "oil", productId },
    sourceRole: "dry_finish",
    role: "finish",
    applicationFamily: "dry_finish",
    facts: {
      ...pointer().facts,
      applicationState: "dry_hair",
      applicationArea: "hair_lengths_ends",
      rinse: "leave_in",
    },
  })
  const dampLeaveIn = pointer({
    ...dryFinish,
    sourceRole: "leave_on_fibre_conditioning",
    role: "leave_in",
    applicationFamily: "post_wash_damp_conditioning",
    facts: { ...dryFinish.facts, applicationState: "damp_hair" },
  })

  const result = compileApplicationViewV2({
    input: applicationInput as never,
    familyTemplates: SHARED_APPLICATION_TEMPLATES_V2,
    productPointers: [supportingShampooPointer(), dryFinish, dampLeaveIn],
  })

  assert.deepEqual(result.pointerIssues, [])
  const blocks =
    result.days
      .find(({ key }) => key === "between_wash_care_day")
      ?.productBlocks.filter((block) => block.productId === productId) ?? []
  assert.equal(blocks.length, 1)
  assert.deepEqual(new Set(blocks[0]?.roles), new Set(["finish", "leave_in"]))
})

test("V2 compiler applies integrated Oil heat copy after washing for an airflow dryer", () => {
  const applicationInput = input("oil", "leave_in") as never as {
    routineItems: Array<Record<string, unknown>>
    profile: Record<string, unknown>
  }
  const oilItem = applicationInput.routineItems.find((item) => item.productId === productId)!
  oilItem.sourceRoutineRole = "leave_on_fibre_conditioning"
  oilItem.catalogFacts = { provides_heat_protection: true }
  applicationInput.profile = {
    heatEvents: [{ id: "heat:dryer", tool: "hair_dryer", route: "airflow_shaping" }],
  }
  const leaveOnOil = pointer({
    scope: { kind: "product", category: "oil", productId },
    sourceRole: "leave_on_fibre_conditioning",
    role: "leave_in",
    applicationFamily: "post_wash_damp_conditioning",
    facts: {
      ...pointer().facts,
      applicationState: "damp_hair",
      applicationArea: "hair_lengths_ends",
      rinse: "leave_in",
    },
  })

  const result = compileApplicationViewV2({
    input: applicationInput as never,
    familyTemplates: SHARED_APPLICATION_TEMPLATES_V2,
    productPointers: [supportingShampooPointer(), leaveOnOil],
  })

  assert.deepEqual(result.pointerIssues, [])
  const block = result.days
    .find(({ key }) => key === "wash_day")
    ?.productBlocks.find((candidate) => candidate.productId === productId)
  assert.ok(block)
  assert.equal(block.noteDe, null)
  assert.equal(
    block.steps.filter(({ action }) => action === "apply_product").at(-1)?.copyDe,
    "Sparsam in handtuchtrockene Längen und Spitzen verteilen. Nicht ausspülen. Diese Anwendung schützt beim unmittelbar folgenden Styling zugleich vor Hitze.",
  )
})

test("V2 compiler does not synthesize a damp leave-on Oil onto a direct-heat styling day", () => {
  const applicationInput = input("oil", "leave_in") as never as {
    routineItems: Array<Record<string, unknown>>
    profile: Record<string, unknown>
  }
  const oilItem = applicationInput.routineItems.find((item) => item.productId === productId)!
  oilItem.sourceRoutineRole = "leave_on_fibre_conditioning"
  oilItem.catalogFacts = { provides_heat_protection: true }
  applicationInput.profile = {
    heatEvents: [{ id: "heat:iron", tool: "straightener", route: "direct_contact_heat" }],
  }
  const leaveOnOil = pointer({
    scope: { kind: "product", category: "oil", productId },
    sourceRole: "leave_on_fibre_conditioning",
    role: "leave_in",
    applicationFamily: "post_wash_damp_conditioning",
    facts: {
      ...pointer().facts,
      applicationState: "damp_hair",
      applicationArea: "hair_lengths_ends",
      rinse: "leave_in",
    },
  })

  const result = compileApplicationViewV2({
    input: applicationInput as never,
    familyTemplates: SHARED_APPLICATION_TEMPLATES_V2,
    productPointers: [supportingShampooPointer(), leaveOnOil],
  })

  assert.deepEqual(result.pointerIssues, [])
  assert.equal(
    result.days
      .find(({ key }) => key === "styling_day")
      ?.productBlocks.some((candidate) => candidate.productId === productId) ?? false,
    false,
  )
})

test("V2 compiler does not generalize pre-wash-only, heat-only, or scalp-only Oils", () => {
  const preWash = compileApplicationViewV2({
    input: input("oil", "intensive_care"),
    familyTemplates: SHARED_APPLICATION_TEMPLATES_V2,
    productPointers: [
      supportingShampooPointer(),
      pointer({
        scope: { kind: "product", category: "oil", productId },
        sourceRole: "pre_wash_fibre_treatment",
        role: "intensive_care",
        applicationFamily: "pre_wash_lengths_treatment",
        facts: {
          ...pointer().facts,
          applicationState: "pre_wash_dry_hair",
          applicationArea: "hair_lengths_ends",
          rinse: "follow_with_shampoo",
          contactTime: { kind: "label_directed" },
        },
      }),
    ],
  })
  const heatOnly = compileApplicationViewV2({
    input: input("oil", "heat_protection"),
    familyTemplates: SHARED_APPLICATION_TEMPLATES_V2,
    productPointers: [
      supportingShampooPointer(),
      pointer({
        scope: { kind: "product", category: "oil", productId },
        sourceRole: "pre_heat_protection",
        role: "heat_protection",
        applicationFamily: "pre_heat_damp",
        facts: {
          ...pointer().facts,
          applicationState: "damp_hair",
          applicationArea: "root_to_tip_hair",
          rinse: "leave_in",
          heat: {
            supportedStates: ["damp_hair"],
            activationRequired: true,
            maximumClaimedTemperatureC: null,
            reapplication: "none",
          },
        },
      }),
    ],
  })
  const scalpOnly = compileApplicationViewV2({
    input: input("oil", "finish"),
    familyTemplates: SHARED_APPLICATION_TEMPLATES_V2,
    productPointers: [
      supportingShampooPointer(),
      pointer({
        scope: { kind: "product", category: "oil", productId },
        sourceRole: "dry_finish",
        role: "finish",
        applicationFamily: "dry_finish",
        facts: {
          ...pointer().facts,
          applicationState: "dry_hair",
          applicationArea: "scalp_roots",
          rinse: "leave_in",
        },
      }),
    ],
  })

  for (const result of [preWash, heatOnly]) {
    assert.equal(
      result.days
        .find(({ key }) => key === "refresh_day")
        ?.productBlocks.some((block) => block.productId === productId) ?? false,
      false,
    )
  }
  assert.equal(
    scalpOnly.days
      .find(({ key }) => key === "between_wash_care_day")
      ?.productBlocks.some((block) => block.productId === productId) ?? false,
    false,
  )
})

test("V2 compiler does not generalize a companion-bound Leave-in protocol", () => {
  const result = compileApplicationViewV2({
    input: input("leave_in", "leave_in"),
    familyTemplates: SHARED_APPLICATION_TEMPLATES_V2,
    productPointers: [
      supportingShampooPointer(),
      pointer({
        scope: { kind: "product", category: "leave_in", productId },
        sourceRole: "post_wash_leave_in",
        role: "leave_in",
        applicationFamily: "post_wash_damp_conditioning",
        facts: {
          ...pointer().facts,
          applicationState: "damp_hair",
          applicationArea: "hair_lengths_ends",
          rinse: "leave_in",
        },
        requiredCompanionProductId: shampooProductId,
      }),
    ],
  })

  assert.equal(
    result.days
      .find(({ key }) => key === "refresh_day")
      ?.productBlocks.some((block) => block.productId === productId) ?? false,
    false,
  )
})

test("V2 compiler renders one Leave-in across each researched application context", () => {
  const postWash = pointer({
    scope: { kind: "product", category: "leave_in", productId },
    sourceRole: "post_wash_leave_in",
    role: "leave_in",
    applicationFamily: "post_wash_damp_conditioning",
    facts: {
      ...pointer().facts,
      applicationState: "damp_hair",
      applicationArea: "hair_lengths_ends",
      rinse: "leave_in",
    },
  })
  const dryRefresh = pointer({
    ...postWash,
    applicationFamily: "between_wash_dry_care",
    facts: { ...postWash.facts, applicationState: "dry_hair" },
  })

  const result = compileApplicationViewV2({
    input: input("leave_in", "leave_in"),
    familyTemplates: SHARED_APPLICATION_TEMPLATES_V2,
    productPointers: [supportingShampooPointer(), postWash, dryRefresh],
  })

  assert.deepEqual(result.pointerIssues, [])
  assert.ok(
    result.days
      .find(({ key }) => key === "wash_day")
      ?.productBlocks.some((block) => block.productId === productId),
  )
  assert.ok(
    result.days
      .find(({ key }) => key === "refresh_day")
      ?.productBlocks.some((block) => block.productId === productId),
  )
})

test("V2 compiler groups researched dry and damp refresh methods under one product", () => {
  const base = pointer({
    scope: { kind: "product", category: "leave_in", productId },
    sourceRole: "post_wash_leave_in",
    role: "leave_in",
    applicationFamily: "between_wash_dry_care",
    facts: {
      ...pointer().facts,
      applicationState: "dry_hair",
      applicationArea: "hair_lengths_ends",
      rinse: "leave_in",
    },
  })
  const result = compileApplicationViewV2({
    input: input("leave_in", "leave_in"),
    familyTemplates: SHARED_APPLICATION_TEMPLATES_V2,
    productPointers: [
      supportingShampooPointer(),
      base,
      {
        ...base,
        applicationFamily: "between_wash_damp_refresh",
        facts: { ...base.facts, applicationState: "damp_hair" },
      },
    ],
  })

  assert.deepEqual(result.pointerIssues, [])
  const blocks =
    result.days
      .find(({ key }) => key === "refresh_day")
      ?.productBlocks.filter((block) => block.productId === productId) ?? []
  assert.equal(blocks.length, 1)
  assert.deepEqual(
    blocks[0]?.steps.filter(({ action }) => action === "section").map(({ copyDe }) => copyDe),
    ["Nach dem Anfeuchten (empfohlen)", "Auf trockenem Haar"],
  )
})
