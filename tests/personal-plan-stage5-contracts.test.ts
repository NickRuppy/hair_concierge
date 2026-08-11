import assert from "node:assert/strict"
import test from "node:test"

import {
  APPLICATION_DAY_TYPE_KEYS,
  applicationGuidanceProtocolSchema,
  normalizedApplicationInputSchema,
} from "../src/lib/routines/personal-plan/application/contracts"

test("Stage 5 exposes exactly the eight canonical day keys", () => {
  assert.deepEqual(APPLICATION_DAY_TYPE_KEYS, [
    "wash_day",
    "intensive_care_day",
    "bond_repair_day",
    "clarifying_wash_day",
    "refresh_day",
    "between_wash_care_day",
    "styling_day",
    "rest_day",
  ])
})

test("Stage 5 ports reject incomplete and untrusted routine items", () => {
  const base = {
    routineItems: [
      {
        itemId: "item-1",
        productId: "11111111-1111-4111-8111-111111111111",
        productName: "Sanftes Shampoo",
        category: "shampoo",
        role: "cleanse",
        inclusion: "included",
        availability: "owned",
        executable: true,
      },
    ],
    profile: { length: "medium", density: "medium", thickness: "normal" },
    dayTypes: APPLICATION_DAY_TYPE_KEYS.map((key, index) => ({ key, sortOrder: index + 1 })),
  }

  assert.equal(normalizedApplicationInputSchema.safeParse(base).success, true)
  assert.equal(
    normalizedApplicationInputSchema.safeParse({
      ...base,
      routineItems: [{ ...base.routineItems[0], productId: "not-a-canonical-uuid" }],
    }).success,
    false,
  )
})

test("Stage 5 runtime input rejects missing and malformed canonical day definitions", () => {
  const base = {
    routineItems: [],
    profile: {},
    dayTypes: APPLICATION_DAY_TYPE_KEYS.map((key, index) => ({ key, sortOrder: index + 1 })),
  }

  assert.equal(
    normalizedApplicationInputSchema.safeParse({
      ...base,
      dayTypes: base.dayTypes.slice(1),
    }).success,
    false,
  )
  assert.equal(
    normalizedApplicationInputSchema.safeParse({
      ...base,
      dayTypes: base.dayTypes.map((definition, index) =>
        index === 1 ? { ...definition, sortOrder: 1 } : definition,
      ),
    }).success,
    false,
  )
  assert.equal(
    normalizedApplicationInputSchema.safeParse({
      ...base,
      dayTypes: [...base.dayTypes.slice(0, 7), { key: "not_a_day", sortOrder: 8 }],
    }).success,
    false,
  )
})

test("guidance rejects unknown keys, invalid product scopes, and invalid versions", () => {
  const protocol = {
    schemaVersion: 1,
    guidanceKey: "shampoo-base",
    protocolVersion: 1,
    locale: "de",
    scope: { kind: "application_family", category: "shampoo" },
    role: "cleanse",
    applicationFamily: "standard_rinse_out_cleanse",
    compatibleDayTypes: ["wash_day"],
    exactGuidanceRequired: false,
    sequence: { anchor: "wet_cleanse", before: [], after: [], conflictsWith: [] },
    requirements: { requiredCatalogFacts: [], requiredProtocolFacts: [], requiredProfileFacts: [] },
    protocolFacts: {
      applicationArea: "scalp_roots",
      rinse: "rinse_out",
      contactTimeSeconds: null,
      conditionerRelationship: "not_applicable",
      reapplication: "none",
      amount: { kind: "qualitative", copyDe: "Eine kleine Menge verwenden." },
      cautions: [],
    },
    steps: [
      { stepKey: "cleanse", action: "apply_product", copyTemplateDe: "Auf die Kopfhaut geben." },
    ],
    evidence: [
      {
        sourceUrl: "https://example.com/shampoo",
        sourceType: "manufacturer",
        checkedAt: "2026-08-08",
      },
    ],
  }

  assert.equal(applicationGuidanceProtocolSchema.safeParse(protocol).success, true)
  assert.equal(
    applicationGuidanceProtocolSchema.safeParse({
      ...protocol,
      evidence: [
        {
          sourceUrl: "https://www.dm.de/example-shampoo",
          sourceType: "retailer",
          checkedAt: "2026-08-10",
        },
      ],
    }).success,
    true,
  )
  assert.equal(
    applicationGuidanceProtocolSchema.safeParse({
      ...protocol,
      protocolFacts: {
        ...protocol.protocolFacts,
        cautions: ["Nicht in die Augen bringen."],
      },
    }).success,
    false,
  )
  assert.equal(
    applicationGuidanceProtocolSchema.safeParse({ ...protocol, protocolVersion: 0 }).success,
    false,
  )
  assert.equal(
    applicationGuidanceProtocolSchema.safeParse({
      ...protocol,
      steps: [
        ...protocol.steps,
        { stepKey: "second-pass", action: "apply_product", copyTemplateDe: "Erneut auftragen." },
      ],
    }).success,
    false,
  )
  assert.equal(
    applicationGuidanceProtocolSchema.safeParse({
      ...protocol,
      steps: [{ stepKey: "wait", action: "wait", copyTemplateDe: "Kurz warten." }],
    }).success,
    false,
  )
  assert.equal(
    applicationGuidanceProtocolSchema.safeParse({
      ...protocol,
      scope: { kind: "product", category: "shampoo" },
    }).success,
    false,
  )
  assert.equal(
    applicationGuidanceProtocolSchema.safeParse({ ...protocol, unknown: true }).success,
    false,
  )
})
