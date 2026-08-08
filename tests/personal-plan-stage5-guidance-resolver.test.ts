import assert from "node:assert/strict"
import test from "node:test"

import type {
  ApplicationGuidanceProtocolV1,
  NormalizedRoutineItem,
} from "../src/lib/routines/personal-plan/application/contracts"
import { resolveApplicationGuidance } from "../src/lib/routines/personal-plan/application/guidance-resolver"

const uuid = "11111111-1111-4111-8111-111111111111"

function item(overrides: Partial<NormalizedRoutineItem> = {}): NormalizedRoutineItem {
  return {
    itemId: "item-1",
    productId: uuid,
    productName: "Pflege-Spray",
    category: "leave_in",
    role: "leave_in",
    inclusion: "included",
    availability: "owned",
    executable: true,
    catalogFacts: { format: "spray" },
    ...overrides,
  }
}

function protocol(
  overrides: Partial<ApplicationGuidanceProtocolV1> = {},
): ApplicationGuidanceProtocolV1 {
  return {
    schemaVersion: 1,
    guidanceKey: "leave-in-base",
    protocolVersion: 1,
    locale: "de",
    scope: { kind: "application_family", category: "leave_in" },
    role: "leave_in",
    applicationFamily: "post_wash_booster",
    compatibleDayTypes: ["wash_day"],
    exactGuidanceRequired: false,
    sequence: { anchor: "damp_leave_on", before: [], after: [], conflictsWith: [] },
    requirements: {
      requiredCatalogFacts: ["format"],
      requiredProtocolFacts: [],
      requiredProfileFacts: [],
    },
    protocolFacts: {
      applicationArea: "lengths_ends",
      rinse: "leave_in",
      contactTimeSeconds: null,
      conditionerRelationship: "not_applicable",
      reapplication: "none",
      amount: { kind: "qualitative", copyDe: "Sparsam verwenden." },
      cautions: [],
    },
    steps: [
      { stepKey: "apply", action: "apply_product", copyTemplateDe: "In Längen und Spitzen geben." },
    ],
    evidence: [
      {
        sourceUrl: "https://example.com/protocol",
        sourceType: "manufacturer",
        checkedAt: "2026-08-08",
      },
    ],
    ...overrides,
  }
}

test("exact product guidance takes precedence over a family protocol", () => {
  const result = resolveApplicationGuidance({
    item: item(),
    dayType: "wash_day",
    protocols: [
      protocol(),
      protocol({
        guidanceKey: "exact",
        scope: { kind: "product", category: "leave_in", productId: uuid },
        steps: [
          {
            stepKey: "exact",
            action: "apply_product",
            copyTemplateDe: "Als Spray gleichmäßig verteilen.",
          },
        ],
      }),
    ],
  })
  assert.equal(result.status, "resolved")
  if (result.status === "resolved") assert.equal(result.protocol.guidanceKey, "exact")
})

test("required exact guidance fails closed instead of falling through to family guidance", () => {
  const result = resolveApplicationGuidance({
    item: item({ category: "bondbuilder", role: "bond_repair" }),
    dayType: "bond_repair_day",
    protocols: [
      protocol({
        scope: { kind: "application_family", category: "bondbuilder" },
        role: "bond_repair",
        applicationFamily: "pre_shampoo_single_treatment",
        compatibleDayTypes: ["bond_repair_day"],
      }),
    ],
  })
  assert.deepEqual(result, { status: "unresolved", reason: "exact_guidance_required" })
})

test("targeted shampoo, pre-heat, Mask, and between-wash care never borrow family guidance", () => {
  for (const [candidate, dayType] of [
    [
      item({ category: "shampoo", role: "cleanse", sourceRoutineRole: "shampoo_dandruff" }),
      "wash_day",
    ],
    [
      item({
        category: "heat_protectant",
        role: "heat_protection",
        sourceRoutineRole: "pre_heat_protection",
      }),
      "styling_day",
    ],
    [item({ category: "mask", role: "intensive_care" }), "intensive_care_day"],
    [item({ category: "leave_in", role: "leave_in" }), "between_wash_care_day"],
  ] as const) {
    const family = protocol({
      scope: { kind: "application_family", category: candidate.category },
      role: candidate.role,
      compatibleDayTypes: [dayType],
    })
    assert.deepEqual(
      resolveApplicationGuidance({ item: candidate, dayType, protocols: [family] }),
      {
        status: "unresolved",
        reason: "exact_guidance_required",
      },
    )
    const exact = {
      ...family,
      guidanceKey: `${family.guidanceKey}-exact`,
      scope: { kind: "product", category: candidate.category, productId: candidate.productId },
    } as ApplicationGuidanceProtocolV1
    assert.equal(
      resolveApplicationGuidance({ item: candidate, dayType, protocols: [exact] }).status,
      "resolved",
    )
  }
})

test("coarse foam-or-liquid dry shampoo needs an exact format disambiguation", () => {
  const result = resolveApplicationGuidance({
    item: item({
      category: "dry_shampoo",
      role: "refresh",
      catalogFacts: { format: "foam_or_liquid" },
    }),
    dayType: "refresh_day",
    protocols: [
      protocol({
        scope: { kind: "application_family", category: "dry_shampoo" },
        role: "refresh",
        applicationFamily: "foam",
        compatibleDayTypes: ["refresh_day"],
      }),
    ],
  })
  assert.deepEqual(result, { status: "unresolved", reason: "format_disambiguation_required" })
})

test("dry shampoo family guidance must match the catalog-backed physical format", () => {
  const result = resolveApplicationGuidance({
    item: item({
      category: "dry_shampoo",
      role: "refresh",
      catalogFacts: {
        format: "powder",
        formatResolution: { status: "resolved", applicationFamily: "powder" },
      },
    }),
    dayType: "refresh_day",
    protocols: [
      protocol({
        scope: { kind: "application_family", category: "dry_shampoo" },
        role: "refresh",
        applicationFamily: "aerosol_spray",
        compatibleDayTypes: ["refresh_day"],
      }),
    ],
  })

  assert.deepEqual(result, { status: "unresolved", reason: "application_family_mismatch" })
})

test("duplicate active exact guidance fails closed instead of choosing by key order", () => {
  const exactScope = { kind: "product", category: "leave_in", productId: uuid } as const
  const result = resolveApplicationGuidance({
    item: item(),
    dayType: "wash_day",
    protocols: [
      protocol({ guidanceKey: "exact-a", scope: exactScope }),
      protocol({ guidanceKey: "exact-b", scope: exactScope }),
    ],
  })

  assert.deepEqual(result, { status: "unresolved", reason: "ambiguous_exact_guidance" })
})

test("duplicate compatible family guidance fails closed instead of choosing by key order", () => {
  const result = resolveApplicationGuidance({
    item: item(),
    dayType: "wash_day",
    protocols: [protocol({ guidanceKey: "family-a" }), protocol({ guidanceKey: "family-b" })],
  })

  assert.deepEqual(result, { status: "unresolved", reason: "ambiguous_family_guidance" })
})

test("resolver rejects a protocol missing a required catalog fact", () => {
  const result = resolveApplicationGuidance({
    item: item({ catalogFacts: {} }),
    dayType: "wash_day",
    protocols: [protocol()],
  })
  assert.deepEqual(result, { status: "unresolved", reason: "missing_catalog_fact:format" })
})

test("resolver requires declared profile facts instead of rendering a hypothetical branch", () => {
  const requiredThickness = protocol({
    requirements: {
      requiredCatalogFacts: ["format"],
      requiredProtocolFacts: [],
      requiredProfileFacts: ["thickness"],
    },
  })

  assert.deepEqual(
    resolveApplicationGuidance({
      item: item(),
      dayType: "wash_day",
      profile: {},
      protocols: [requiredThickness],
    }),
    { status: "unresolved", reason: "missing_profile_fact:thickness" },
  )

  const resolved = resolveApplicationGuidance({
    item: item(),
    dayType: "wash_day",
    profile: { thickness: "fine" },
    protocols: [requiredThickness],
  })
  assert.equal(resolved.status, "resolved")
})

test("an incomplete exact protocol cannot fall through to a complete family protocol", () => {
  const result = resolveApplicationGuidance({
    item: item(),
    dayType: "wash_day",
    protocols: [
      protocol(),
      protocol({
        guidanceKey: "exact-incomplete",
        scope: { kind: "product", category: "leave_in", productId: uuid },
        requirements: {
          requiredCatalogFacts: ["manufacturer_amount"],
          requiredProtocolFacts: [],
          requiredProfileFacts: [],
        },
      }),
    ],
  })
  assert.deepEqual(result, {
    status: "unresolved",
    reason: "missing_catalog_fact:manufacturer_amount",
  })
})
