import assert from "node:assert/strict"
import test from "node:test"

import {
  applicationFamilyTemplateV2Schema,
  productApplicationPointerV2Schema,
} from "../src/lib/routines/personal-plan/application/contracts-v2"

const evidence = [
  {
    sourceUrl: "https://example.com/directions",
    sourceType: "manufacturer",
    checkedAt: "2026-08-12",
  },
]

const shampooTemplate = {
  schemaVersion: 2,
  contractKind: "family_template",
  guidanceKey: "shampoo.standard-scalp-cleanse.v2",
  protocolVersion: 2,
  locale: "de",
  scope: { kind: "application_family", category: "shampoo" },
  role: "cleanse",
  applicationFamily: "standard_rinse_out_cleanse",
  compatibleDayTypes: ["wash_day"],
  sequence: { anchor: "wet_cleanse", before: [], after: [], conflictsWith: [] },
  steps: [
    {
      stepKey: "wet",
      action: "section",
      copyTemplateDe: "Haare und Kopfhaut vollständig anfeuchten.",
    },
    {
      stepKey: "cleanse",
      action: "apply_product",
      copyTemplateDe:
        "Eine kleine Menge auf die Kopfhaut geben und sanft einmassieren. Die Längen werden beim Ausspülen mitgereinigt.",
    },
    {
      stepKey: "rinse",
      action: "rinse",
      copyTemplateDe: "Gründlich ausspülen.",
    },
  ],
  evidence,
}

const ogxPointer = {
  schemaVersion: 2,
  contractKind: "product_pointer",
  scope: {
    kind: "product",
    category: "shampoo",
    productId: "30000000-0000-4000-8000-000000000001",
  },
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
  evidence,
}

test("V2 ordinary product pointers select a shared family and cannot own visible prose", () => {
  assert.equal(productApplicationPointerV2Schema.parse(ogxPointer).workflowId, null)
  assert.equal(
    productApplicationPointerV2Schema.safeParse({
      ...ogxPointer,
      exactSteps: [
        {
          stepKey: "ogx-copy",
          action: "apply_product",
          copyDe: "Bespoke OGX wording must never render.",
        },
      ],
    }).success,
    false,
  )
})

test("V2 family templates allow only reviewed interpolation variables", () => {
  assert.equal(applicationFamilyTemplateV2Schema.safeParse(shampooTemplate).success, true)
  assert.equal(
    applicationFamilyTemplateV2Schema.safeParse({
      ...shampooTemplate,
      guidanceKey: "conditioner.standard-rinse-out.v2",
      scope: { kind: "application_family", category: "conditioner" },
      role: "condition",
      applicationFamily: "standard_rinse_out_conditioning",
      steps: [
        {
          stepKey: "wait",
          action: "wait",
          copyTemplateDe: "{{contact_time_de}} einwirken lassen.",
        },
      ],
    }).success,
    true,
  )
  assert.equal(
    applicationFamilyTemplateV2Schema.safeParse({
      ...shampooTemplate,
      steps: [
        {
          stepKey: "marketing",
          action: "apply_product",
          copyTemplateDe: "Mit {{manufacturer_claim}} anwenden.",
        },
      ],
    }).success,
    false,
  )
})

test("V2 rejects category-incompatible family pointers", () => {
  assert.equal(
    productApplicationPointerV2Schema.safeParse({
      ...ogxPointer,
      applicationFamily: "standard_rinse_out_conditioning",
    }).success,
    false,
  )
})

test("V2 exact visible steps require one of the five reviewed workflow IDs", () => {
  const exact = {
    ...ogxPointer,
    applicationFamily: "targeted_treatment_shampoo",
    workflowId: "swiss_o_par_tea_tree_two_pass",
    exactSteps: [
      {
        stepKey: "second-pass",
        action: "apply_product",
        copyDe: "Ein zweites Mal auftragen und drei Minuten einwirken lassen.",
      },
    ],
  }
  assert.equal(productApplicationPointerV2Schema.safeParse(exact).success, true)
  assert.equal(
    productApplicationPointerV2Schema.safeParse({
      ...exact,
      workflowId: "sixth_unreviewed_workflow",
    }).success,
    false,
  )
})

test("V2 product pointers accept only bounded caution codes", () => {
  assert.equal(
    productApplicationPointerV2Schema.safeParse({
      ...ogxPointer,
      cautionCodes: ["stop_on_irritation"],
    }).success,
    true,
  )
  assert.equal(
    productApplicationPointerV2Schema.safeParse({
      ...ogxPointer,
      cautionCodes: ["free text caution"],
    }).success,
    false,
  )
})
