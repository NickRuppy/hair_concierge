import assert from "node:assert/strict"
import test from "node:test"

import {
  buildProductApplicationPointerV2,
  PRODUCT_INTAKE_V2_PRODUCT_ID_PLACEHOLDER,
} from "../src/lib/product-intake/catalog-enrichment/stage5-v2-builder"
import type { ApplicationGuidanceProtocolV1 } from "../src/lib/routines/personal-plan/application/contracts"

function protocol(
  overrides: Omit<Partial<ApplicationGuidanceProtocolV1>, "protocolFacts"> & {
    protocolFacts?: Partial<ApplicationGuidanceProtocolV1["protocolFacts"]>
  } = {},
): ApplicationGuidanceProtocolV1 {
  const { protocolFacts, ...protocolOverrides } = overrides
  return {
    schemaVersion: 1,
    guidanceKey: "fixture-shampoo",
    protocolVersion: 1,
    locale: "de",
    scope: {
      kind: "product",
      category: "shampoo",
      productId: "10000000-0000-4000-8000-000000000001",
    },
    role: "cleanse",
    applicationFamily: "standard_rinse_out_cleanse",
    compatibleDayTypes: ["wash_day"],
    exactGuidanceRequired: true,
    sequence: { anchor: "wet_cleanse", before: [], after: [], conflictsWith: [] },
    requirements: {
      requiredCatalogFacts: [],
      requiredProtocolFacts: [],
      requiredProfileFacts: [],
    },
    steps: [
      {
        stepKey: "apply",
        action: "apply_product",
        copyTemplateDe: "Auf die nasse Kopfhaut geben und einmassieren.",
      },
      { stepKey: "rinse", action: "rinse", copyTemplateDe: "Gründlich ausspülen." },
    ],
    evidence: [
      {
        sourceUrl: "https://example.test/product",
        sourceType: "manufacturer",
        checkedAt: "2026-08-13",
      },
    ],
    ...protocolOverrides,
    protocolFacts: {
      applicationArea: "scalp_roots",
      rinse: "rinse_out",
      contactTimeSeconds: null,
      conditionerRelationship: "not_applicable",
      reapplication: "none",
      amount: null,
      cautions: [],
      ...protocolFacts,
    },
  }
}

test("ordinary products derive one canonical pointer without product-name or product-ID rules", () => {
  const first = buildProductApplicationPointerV2({
    sourceRole: "shampoo_everyday",
    guidancePayload: protocol(),
  })
  const second = buildProductApplicationPointerV2({
    sourceRole: "shampoo_everyday",
    guidancePayload: protocol({
      scope: {
        kind: "product",
        category: "shampoo",
        productId: "20000000-0000-4000-8000-000000000002",
      },
    }),
  })

  assert.deepEqual(first.exactSteps, [])
  assert.equal(first.workflowId, null)
  assert.deepEqual(first.facts.contactTime, null)
  assert.deepEqual(
    { ...first, scope: { ...first.scope, productId: "normalized" } },
    { ...second, scope: { ...second.scope, productId: "normalized" } },
  )
})

test("conditioner timing is derived from reviewed V1 facts", () => {
  const pointer = buildProductApplicationPointerV2({
    sourceRole: "conditioner_rinse_out",
    guidancePayload: protocol({
      scope: {
        kind: "product",
        category: "conditioner",
        productId: "30000000-0000-4000-8000-000000000003",
      },
      role: "condition",
      applicationFamily: "standard_rinse_out_conditioning",
      protocolFacts: {
        applicationArea: "lengths_ends",
        contactTimeSeconds: 180,
        sharedTemplateContactTime: "include",
      },
    }),
  })

  assert.deepEqual(pointer.facts.contactTime, { kind: "seconds", seconds: 180 })
})

test("reviewed exact workflow, typed amount, caution codes, and exact copy survive derivation", () => {
  const pointer = buildProductApplicationPointerV2({
    sourceRole: "specialized_bond_treatment",
    guidancePayload: protocol({
      scope: {
        kind: "product",
        category: "bondbuilder",
        productId: "40000000-0000-4000-8000-000000000004",
      },
      role: "bond_repair",
      applicationFamily: "post_shampoo_timed_leave_in",
      protocolFacts: {
        applicationArea: "lengths_ends",
        rinse: "leave_in",
        contactTimeSeconds: 240,
        workflowId: "k18_leave_in_molecular_repair",
        cautionCodes: ["cosmetic_claim_only", "stop_on_irritation"],
        amount: { kind: "pumps", minimum: 1, maximum: 3 },
      },
      steps: [
        {
          stepKey: "apply-k18",
          action: "apply_product",
          copyTemplateDe:
            "1–3 Pumpstöße für das gesamte Haar verwenden und von den Spitzen nach oben gleichmäßig einarbeiten.",
        },
      ],
    }),
  })

  assert.equal(pointer.workflowId, "k18_leave_in_molecular_repair")
  assert.deepEqual(pointer.facts.amount, { kind: "pumps", minimum: 1, maximum: 3 })
  assert.deepEqual(pointer.cautionCodes, ["cosmetic_claim_only", "stop_on_irritation"])
  assert.equal(pointer.exactSteps[0]?.copyDe.includes("1–3 Pumpstöße"), true)
})

test("Product Intake placeholder is validated through a UUID sentinel and restored", () => {
  const pointer = buildProductApplicationPointerV2({
    sourceRole: "shampoo_everyday",
    guidancePayload: protocol({
      scope: {
        kind: "product",
        category: "shampoo",
        productId: PRODUCT_INTAKE_V2_PRODUCT_ID_PLACEHOLDER,
      } as ApplicationGuidanceProtocolV1["scope"],
    }),
  })

  assert.equal(pointer.scope.productId, PRODUCT_INTAKE_V2_PRODUCT_ID_PLACEHOLDER)
})

test("reviewed Leave-in post-style use remains a distinct dry-hair pointer", () => {
  const pointer = buildProductApplicationPointerV2({
    sourceRole: "post_wash_leave_in",
    guidancePayload: protocol({
      scope: {
        kind: "product",
        category: "leave_in",
        productId: "50000000-0000-4000-8000-000000000005",
      },
      role: "leave_in",
      applicationFamily: "post_style_finish",
      compatibleDayTypes: ["styling_day"],
      sequence: { anchor: "dry_finish", before: [], after: [], conflictsWith: [] },
      protocolFacts: {
        applicationArea: "lengths_ends",
        rinse: "leave_in",
      },
    }),
  })

  assert.equal(pointer.applicationFamily, "post_style_finish")
  assert.equal(pointer.facts.applicationState, "dry_hair")
})
