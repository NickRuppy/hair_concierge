import assert from "node:assert/strict"
import test from "node:test"

import { compileApplicationViewV2 } from "../src/lib/routines/personal-plan/application/compiler-v2"
import { APPLICATION_DAY_TYPE_KEYS } from "../src/lib/routines/personal-plan/application/contracts"
import type { ProductApplicationPointerV2 } from "../src/lib/routines/personal-plan/application/contracts-v2"
import { SHARED_APPLICATION_TEMPLATES_V2 } from "../src/lib/routines/personal-plan/application/shared-templates-v2"

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
