import assert from "node:assert/strict"
import test from "node:test"

import {
  applicationGuidanceProtocolSchema,
  EXACT_APPLICATION_WORKFLOW_IDS_V2,
  HEAT_ACTIVATED_WORKFLOW_CATEGORIES,
  type ApplicationGuidanceProtocolV1,
} from "../src/lib/routines/personal-plan/application/contracts"
import {
  productApplicationPointerV2Schema,
  type ProductApplicationPointerV2,
} from "../src/lib/routines/personal-plan/application/contracts-v2"

/**
 * S3 §5.1: the reviewed exact workflow `heat_activated_verified_product`. Every superRefine
 * rule (V1 payload and V2 pointer) gets one failing case next to one passing baseline.
 */

const productId = "42a2fe20-bd7e-49a3-a880-8ae89015a5c9"

function v1(
  overrides: Omit<Partial<ApplicationGuidanceProtocolV1>, "protocolFacts"> & {
    protocolFacts?: Partial<ApplicationGuidanceProtocolV1["protocolFacts"]>
  } = {},
): ApplicationGuidanceProtocolV1 {
  const { protocolFacts, ...rest } = overrides
  return {
    schemaVersion: 1,
    guidanceKey: `heat-activated-verified-product-${productId}-pre_heat_damp`,
    protocolVersion: 1,
    locale: "de",
    scope: { kind: "product", category: "leave_in", productId },
    role: "heat_protection",
    applicationFamily: "pre_heat_damp",
    compatibleDayTypes: [
      "wash_day",
      "intensive_care_day",
      "bond_repair_day",
      "clarifying_wash_day",
      "styling_day",
    ],
    exactGuidanceRequired: true,
    sequence: { anchor: "damp_leave_on", before: ["heat_tool"], after: [], conflictsWith: [] },
    requirements: {
      requiredCatalogFacts: [],
      requiredProtocolFacts: [],
      requiredProfileFacts: ["heatEvents"],
    },
    steps: [
      { stepKey: "section", action: "section", copyTemplateDe: "Das Haar in Partien teilen." },
      { stepKey: "apply", action: "apply_product", copyTemplateDe: "Das Spray sprühen." },
      { stepKey: "activate", action: "tool", copyTemplateDe: "Jede Partie föhnen." },
    ],
    evidence: [
      {
        sourceUrl: "https://neqi-hair.com/products/diamond-glass-ultimate-styling-spray",
        sourceType: "manufacturer",
        checkedAt: "2026-10-09",
      },
    ],
    ...rest,
    protocolFacts: {
      applicationArea: "lengths_ends",
      rinse: "leave_in",
      contactTimeSeconds: null,
      conditionerRelationship: "not_applicable",
      reapplication: "each_separate_heat_event",
      amount: { kind: "qualitative", copyDe: "großzügig" },
      workflowId: "heat_activated_verified_product",
      heatActivationRequired: true,
      cautions: [],
      ...protocolFacts,
    },
  }
}

function v2(overrides: Partial<ProductApplicationPointerV2> = {}): ProductApplicationPointerV2 {
  return {
    schemaVersion: 2,
    contractKind: "product_pointer",
    scope: { kind: "product", category: "leave_in", productId },
    sourceRole: "pre_heat_protection",
    role: "heat_protection",
    applicationFamily: "pre_heat_damp",
    facts: {
      applicationState: "damp_hair",
      applicationArea: "hair_lengths_ends",
      rinse: "leave_in",
      contactTime: null,
      amount: { kind: "qualitative", value: "generous" },
      heat: {
        supportedStates: ["damp_hair"],
        activationRequired: true,
        maximumClaimedTemperatureC: null,
        reapplication: "each_separate_heat_event",
      },
      conditionerPolicy: "not_applicable",
    },
    workflowId: "heat_activated_verified_product",
    requiredCompanionProductId: null,
    runtimeBlockerCode: null,
    exactSteps: [
      { stepKey: "section", action: "section", copyDe: "Das Haar in Partien teilen." },
      { stepKey: "apply", action: "apply_product", copyDe: "Das Spray sprühen." },
      { stepKey: "activate", action: "tool", copyDe: "Jede Partie föhnen." },
    ],
    cautionCodes: [],
    evidence: [
      {
        sourceUrl: "https://neqi-hair.com/products/diamond-glass-ultimate-styling-spray",
        sourceType: "manufacturer",
        checkedAt: "2026-10-09",
      },
    ],
    ...overrides,
  }
}

const v1Fails = (payload: unknown) =>
  assert.equal(applicationGuidanceProtocolSchema.safeParse(payload).success, false)
const v2Fails = (pointer: unknown) =>
  assert.equal(productApplicationPointerV2Schema.safeParse(pointer).success, false)

test("heat_activated_verified_product is a registered exact workflow for leave_in only", () => {
  assert.ok(
    (EXACT_APPLICATION_WORKFLOW_IDS_V2 as readonly string[]).includes(
      "heat_activated_verified_product",
    ),
  )
  assert.deepEqual([...HEAT_ACTIVATED_WORKFLOW_CATEGORIES], ["leave_in"])
})

test("V1 baseline damp and dry heat-activated payloads parse", () => {
  assert.equal(applicationGuidanceProtocolSchema.safeParse(v1()).success, true)
  assert.equal(
    applicationGuidanceProtocolSchema.safeParse(
      v1({
        applicationFamily: "pre_heat_dry",
        compatibleDayTypes: ["refresh_day"],
        sequence: { anchor: "dry_pre_heat", before: ["heat_tool"], after: [], conflictsWith: [] },
      }),
    ).success,
    true,
  )
})

test("V1 rejects a heat-activated payload with the wrong family", () => {
  v1Fails(v1({ applicationFamily: "damp_hair_protection" }))
  v1Fails(v1({ applicationFamily: "post_wash_damp_conditioning" }))
})

test("V1 rejects a heat-activated payload with the wrong anchor or no heat_tool before", () => {
  v1Fails(
    v1({
      sequence: { anchor: "dry_pre_heat", before: ["heat_tool"], after: [], conflictsWith: [] },
    }),
  )
  v1Fails(v1({ sequence: { anchor: "damp_leave_on", before: [], after: [], conflictsWith: [] } }))
})

test("V1 rejects a heat-activated payload whose days drift from the runtime", () => {
  v1Fails(v1({ compatibleDayTypes: ["wash_day", "refresh_day"] }))
})

test("V1 rejects a heat-activated payload without a tool step after the application", () => {
  v1Fails(
    v1({
      steps: [{ stepKey: "apply", action: "apply_product", copyTemplateDe: "Das Spray sprühen." }],
    }),
  )
  v1Fails(
    v1({
      steps: [
        { stepKey: "activate", action: "tool", copyTemplateDe: "Föhnen." },
        { stepKey: "apply", action: "apply_product", copyTemplateDe: "Das Spray sprühen." },
      ],
    }),
  )
})

test("V1 rejects a heat-activated payload with two applications", () => {
  v1Fails(
    v1({
      steps: [
        { stepKey: "apply", action: "apply_product", copyTemplateDe: "Sprühen." },
        { stepKey: "apply-2", action: "apply_product", copyTemplateDe: "Nochmals sprühen." },
        { stepKey: "activate", action: "tool", copyTemplateDe: "Föhnen." },
      ],
    }),
  )
})

test("V1 rejects a heat-activated payload with a rinse step present", () => {
  v1Fails(
    v1({
      steps: [
        { stepKey: "apply", action: "apply_product", copyTemplateDe: "Sprühen." },
        { stepKey: "activate", action: "tool", copyTemplateDe: "Föhnen." },
        { stepKey: "rinse", action: "rinse", copyTemplateDe: "Ausspülen." },
      ],
    }),
  )
  v1Fails(v1({ protocolFacts: { rinse: "rinse_out" } }))
})

test("V1 rejects a heat-activated payload with no manufacturer evidence", () => {
  v1Fails(
    v1({
      evidence: [
        {
          sourceUrl: "https://www.dm.de/p/d/3080142/neqi-leave-in-spray-diamond-glass-ultimate",
          sourceType: "retailer",
          checkedAt: "2026-10-09",
        },
      ],
    }),
  )
})

test("V1 rejects a heat-activated payload whose category is not allowed", () => {
  v1Fails(v1({ scope: { kind: "product", category: "heat_protectant", productId } }))
  v1Fails(v1({ scope: { kind: "application_family", category: "leave_in" } }))
  v1Fails(v1({ role: "leave_in" }))
})

test("V1 rejects a heat-activated payload missing the workflow fact", () => {
  v1Fails(v1({ protocolFacts: { heatActivationRequired: undefined } }))
  v1Fails(v1({ protocolFacts: { heatActivationRequired: false } }))
  v1Fails(v1({ exactGuidanceRequired: false }))
})

test("V1 heatActivationRequired is reserved for the heat-activated workflow", () => {
  v1Fails(v1({ protocolFacts: { workflowId: null } }))
})

test("V2 baseline heat-activated pointer parses", () => {
  assert.equal(productApplicationPointerV2Schema.safeParse(v2()).success, true)
})

test("V2 rejects a heat-activated pointer with the wrong family or state", () => {
  v2Fails(v2({ applicationFamily: "either_state_protection" }))
  v2Fails(
    v2({
      facts: {
        ...v2().facts,
        heat: { ...v2().facts.heat!, supportedStates: ["damp_hair", "dry_hair"] },
      },
    }),
  )
  v2Fails(
    v2({
      applicationFamily: "pre_heat_dry",
      facts: { ...v2().facts, applicationState: "dry_hair" },
    }),
  )
})

test("V2 rejects a heat-activated pointer without a tool step", () => {
  v2Fails(v2({ exactSteps: [{ stepKey: "apply", action: "apply_product", copyDe: "Sprühen." }] }))
})

test("V2 rejects a heat-activated pointer with a rinse step present", () => {
  v2Fails(
    v2({
      exactSteps: [
        { stepKey: "apply", action: "apply_product", copyDe: "Sprühen." },
        { stepKey: "activate", action: "tool", copyDe: "Föhnen." },
        { stepKey: "rinse", action: "rinse", copyDe: "Ausspülen." },
      ],
    }),
  )
  v2Fails(v2({ facts: { ...v2().facts, rinse: "rinse_out" } }))
})

test("V2 rejects a heat-activated pointer with no manufacturer evidence", () => {
  v2Fails(
    v2({
      evidence: [
        {
          sourceUrl: "https://www.dm.de/p/d/3080142/neqi-leave-in-spray-diamond-glass-ultimate",
          sourceType: "retailer",
          checkedAt: "2026-10-09",
        },
      ],
    }),
  )
})

test("V2 rejects a heat-activated pointer whose category or role is not allowed", () => {
  v2Fails(v2({ scope: { kind: "product", category: "heat_protectant", productId } }))
  v2Fails(v2({ sourceRole: "post_wash_leave_in" }))
})

test("V2 rejects a heat-activated pointer missing the activation fact", () => {
  v2Fails(
    v2({ facts: { ...v2().facts, heat: { ...v2().facts.heat!, activationRequired: false } } }),
  )
  v2Fails(v2({ facts: { ...v2().facts, heat: null } }))
})
