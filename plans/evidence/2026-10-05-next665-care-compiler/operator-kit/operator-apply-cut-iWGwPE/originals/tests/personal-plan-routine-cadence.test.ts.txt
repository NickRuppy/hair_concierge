import assert from "node:assert/strict"
import test from "node:test"

import {
  effectiveRoutineCadenceCopyDe,
  resolveRoutineItemCadence,
  type RoutineCadenceResolutionInput,
} from "../src/lib/personal-plan/routine/cadence"
import { createSupabaseRoutineCadenceAuthorityReader } from "../src/lib/personal-plan/routine/cadence-authority"

const base = (
  overrides: Partial<RoutineCadenceResolutionInput> = {},
): RoutineCadenceResolutionInput => ({
  category: "bondbuilder",
  role: "specialized_bond_treatment",
  productId: "bond-1",
  recommended: { kind: "product_protocol_course" },
  userOverride: null,
  authorityFacts: [],
  ...overrides,
})

test("uses exact Bondbuilder courses only for the selected matching product and role", () => {
  const resolved = resolveRoutineItemCadence(
    base({
      authorityFacts: [
        {
          productId: "bond-1",
          category: "bondbuilder",
          role: "specialized_bond_treatment",
          cadence: { kind: "label_course", copy_de: "4 Anwendungen, dann 4 Haarwäschen Pause." },
        },
      ],
    }),
  )

  assert.deepEqual(resolved, {
    copyDe: "4 Anwendungen, dann 4 Haarwäschen Pause.",
    source: "exact_product_protocol",
  })
})

test("normalizes approved legacy Scalp Care cadence and preserves fallback provenance", () => {
  assert.deepEqual(
    resolveRoutineItemCadence(
      base({
        category: "scalp_care",
        role: "density_claim_tonic",
        productId: "scalp-1",
        recommended: { kind: "role_keyed_product_protocol" },
        authorityFacts: [
          {
            productId: "scalp-1",
            category: "scalp_care",
            role: "density_claim_tonic",
            cadence: {
              type: "weekly_range",
              source: "manufacturer",
              min_per_week: 5,
              max_per_week: 7,
            },
          },
        ],
      }),
    ),
    { copyDe: "5 bis 7 Mal pro Woche anwenden.", source: "exact_product_protocol" },
  )
  assert.deepEqual(
    resolveRoutineItemCadence(
      base({
        category: "scalp_care",
        role: "scalp_comfort",
        productId: "scalp-2",
        recommended: { kind: "role_keyed_product_protocol" },
        authorityFacts: [
          {
            productId: "scalp-2",
            category: "scalp_care",
            role: "scalp_comfort",
            cadence: { type: "as_needed", source: "category_fallback" },
          },
        ],
      }),
    ),
    { copyDe: "Bei Bedarf", source: "category_fallback" },
  )
})

test("never promotes mismatched or suitability-only protocol cadence and keeps the generic fallback", () => {
  const resolved = resolveRoutineItemCadence(
    base({
      authorityFacts: [
        {
          productId: "other-product",
          category: "bondbuilder",
          role: "specialized_bond_treatment",
          cadence: { kind: "label_course", copy_de: "Falsches Produkt" },
        },
        {
          productId: "bond-1",
          category: "bondbuilder",
          role: "specialized_bond_treatment",
          cadence: { kind: "label_timing", copy_de: "Vor der Haarwäsche" },
        },
      ],
    }),
  )
  assert.deepEqual(resolved, {
    copyDe: "Nach Herstellerangabe",
    source: "safe_generic_fallback",
    gapCode: "exact_product_cadence_unavailable",
  })
  assert.equal(
    effectiveRoutineCadenceCopyDe({
      recommended: { kind: "product_protocol_course" },
      userOverride: "daily_1x",
      resolved,
      role: "specialized_bond_treatment",
    }),
    "Täglich",
  )
})

test("keeps category-owned cadence authoritative even when an exact protocol has a schedule", () => {
  assert.deepEqual(
    resolveRoutineItemCadence(
      base({
        category: "mask",
        role: "intensive_conditioning_mask",
        productId: "mask-1",
        recommended: { kind: "mask_regular_interval", baseInterval: "weekly_1x" },
        authorityFacts: [
          {
            productId: "mask-1",
            category: "mask",
            role: "intensive_conditioning_mask",
            cadence: { kind: "label_schedule", copy_de: "Täglich" },
          },
        ],
      }),
    ),
    { copyDe: "1× pro Woche", source: "category" },
  )
})

test("formats every category-owned cadence kind without consulting product protocols", () => {
  const cases: Array<{
    category: RoutineCadenceResolutionInput["category"]
    recommended: unknown
    role?: RoutineCadenceResolutionInput["role"]
    expected: string
  }> = [
    {
      category: "shampoo",
      recommended: { kind: "wet_wash_total", target: "weekly_2x" },
      expected: "2× pro Woche",
    },
    {
      category: "conditioner",
      recommended: { kind: "after_each_eligible_wash" },
      expected: "Nach jeder Haarwäsche",
    },
    {
      category: "heat_protectant",
      recommended: { kind: "event_based" },
      expected: "Vor jeder passenden Hitze-Anwendung",
    },
    {
      category: "deep_cleansing_shampoo",
      recommended: { kind: "every_nth_wash", every: 3 },
      expected: "Bei jeder dritten Haarwäsche",
    },
    {
      category: "dry_shampoo",
      recommended: { kind: "unscheduled_as_needed" },
      expected: "Bei Bedarf",
    },
    {
      category: "mask",
      recommended: { kind: "mask_regular_interval", baseInterval: "biweekly_1x" },
      expected: "Etwa alle 2 Wochen",
    },
    {
      category: "oil",
      recommended: {
        kind: "role_based_wash_linked",
        roleFrequencies: [
          { role: "pre_wash_fibre_treatment", cadence: "before_every_compatible_wash" },
        ],
      },
      role: "pre_wash_fibre_treatment",
      expected: "Vor jeder Haarwäsche",
    },
  ]

  for (const entry of cases) {
    const resolved = resolveRoutineItemCadence(
      base({
        category: entry.category,
        role: entry.role ?? "dry_finish",
        recommended: entry.recommended,
        authorityFacts: [
          {
            productId: "bond-1",
            category: "oil",
            role: entry.role ?? "dry_finish",
            cadence: { kind: "label_schedule", copy_de: "Must not win" },
          },
        ],
      }),
    )
    assert.equal(resolved?.copyDe, entry.expected)
    assert.equal(resolved?.source, "category")
  }
})

test("accepts the explicit delegated canonical cadence vocabulary only", () => {
  for (const cadenceKind of [
    "label_course",
    "label_schedule",
    "frequency",
    "weekly_range",
    "wash_event",
  ]) {
    assert.deepEqual(
      resolveRoutineItemCadence(
        base({
          authorityFacts: [
            {
              productId: "bond-1",
              category: "bondbuilder",
              role: "specialized_bond_treatment",
              cadence: { kind: cadenceKind, copy_de: `Bond ${cadenceKind}` },
            },
          ],
        }),
      ),
      { copyDe: `Bond ${cadenceKind}`, source: "exact_product_protocol" },
    )
  }

  for (const cadenceKind of [
    "daily",
    "daily_or_twice_daily_as_needed",
    "weekly_range",
    "as_needed",
    "label_schedule",
  ]) {
    assert.deepEqual(
      resolveRoutineItemCadence(
        base({
          category: "scalp_care",
          role: "scalp_comfort",
          productId: "scalp-1",
          recommended: { kind: "role_keyed_product_protocol" },
          authorityFacts: [
            {
              productId: "scalp-1",
              category: "scalp_care",
              role: "scalp_comfort",
              cadence: { kind: cadenceKind, copy_de: `Scalp ${cadenceKind}` },
            },
          ],
        }),
      ),
      { copyDe: `Scalp ${cadenceKind}`, source: "exact_product_protocol" },
    )
  }
})

test("rejects unsupported, blank, malformed, and wrong-role delegated cadence", () => {
  for (const cadence of [
    { kind: "label_suitability", copy_de: "Geeignet" },
    { kind: "label_daily_suitable", copy_de: "Täglich geeignet" },
    { kind: "label_timing", copy_de: "Abends" },
    { kind: "label_course", copy_de: "   " },
    { type: "weekly_range", source: "manufacturer", min_per_week: 7, max_per_week: 5 },
    { type: "daily", source: "unknown", copy_de: "Arbitrary prose" },
  ]) {
    const resolved = resolveRoutineItemCadence(
      base({
        authorityFacts: [
          {
            productId: "bond-1",
            category: "bondbuilder",
            role: "specialized_bond_treatment",
            cadence,
          },
        ],
      }),
    )
    assert.equal(resolved?.source, "safe_generic_fallback")
    assert.equal(resolved?.copyDe, "Nach Herstellerangabe")
  }

  const wrongRole = resolveRoutineItemCadence(
    base({
      authorityFacts: [
        {
          productId: "bond-1",
          category: "bondbuilder",
          role: "dry_finish",
          cadence: { kind: "label_course", copy_de: "Wrong role" },
        },
      ],
    }),
  )
  assert.equal(wrongRole?.source, "safe_generic_fallback")
})

test("fails closed instead of choosing arbitrarily between duplicate exact cadence rows", () => {
  const resolved = resolveRoutineItemCadence(
    base({
      authorityFacts: [
        {
          productId: "bond-1",
          category: "bondbuilder",
          role: "specialized_bond_treatment",
          cadence: { kind: "label_course", copy_de: "First" },
        },
        {
          productId: "bond-1",
          category: "bondbuilder",
          role: "specialized_bond_treatment",
          cadence: { kind: "label_course", copy_de: "Second" },
        },
      ],
    }),
  )

  assert.equal(resolved?.source, "safe_generic_fallback")
  assert.equal(resolved?.copyDe, "Nach Herstellerangabe")
})

test("normalizes the approved legacy daily Scalp Care shape", () => {
  assert.deepEqual(
    resolveRoutineItemCadence(
      base({
        category: "scalp_care",
        role: "density_claim_tonic",
        productId: "scalp-daily",
        recommended: { kind: "role_keyed_product_protocol" },
        authorityFacts: [
          {
            productId: "scalp-daily",
            category: "scalp_care",
            role: "density_claim_tonic",
            cadence: { type: "daily", source: "manufacturer", preferred_time: "evening" },
          },
        ],
      }),
    ),
    { copyDe: "Täglich anwenden.", source: "exact_product_protocol" },
  )
})

test("preserves legacy display fallbacks for old accepted Routine payloads", () => {
  assert.equal(
    effectiveRoutineCadenceCopyDe({
      recommended: null,
      userOverride: null,
      role: "conditioner_rinse_out",
      displayKey: "personal_plan.cadence.none",
    }),
    "Nach Bedarf",
  )
  assert.equal(
    effectiveRoutineCadenceCopyDe({
      recommended: { kind: "role_based_wash_linked", roleFrequencies: [] },
      userOverride: null,
      role: "dry_finish",
    }),
    "Passend zu deiner Haarwäsche",
  )
})

test("fails closed when exact-product cadence authority cannot be read", async () => {
  const databaseError = new Error("protocol authority unavailable")
  const reader = createSupabaseRoutineCadenceAuthorityReader({
    from() {
      return {
        select() {
          return this
        },
        async in() {
          return { data: null, error: databaseError }
        },
      }
    },
  })

  await assert.rejects(() => reader.load({ productIds: ["bond-1"] }), databaseError)
})
