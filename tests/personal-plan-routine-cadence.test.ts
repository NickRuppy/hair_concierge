import assert from "node:assert/strict"
import test from "node:test"

import {
  effectiveRoutineCadenceCopyDe,
  resolveRoutineItemCadence,
  type RoutineCadenceResolutionInput,
} from "../src/lib/personal-plan/routine/cadence"
import { createSupabaseRoutineCadenceAuthorityReader } from "../src/lib/personal-plan/routine/cadence-authority"
import { projectBondbuilderCadence } from "../src/lib/bondbuilder-research/cadence-projection"
import { makeBondbuilderProfile, sealProfile } from "./fixtures/bondbuilder-research/profile"

test("research cadence preserves initial wash courses and does not fabricate a conditional default", () => {
  const profile = makeBondbuilderProfile()
  profile.application.cadence.value = {
    status: "source_stated",
    initial: { kind: "consecutive_washes", count: 4 },
    maintenance: { kind: "every_n_washes", minimum: 4, maximum: 4 },
    branches: [],
  }
  sealProfile(profile)
  const cadence = projectBondbuilderCadence(profile)
  assert.equal(cadence?.kind, "label_course")
  assert.equal(cadence?.copy_de, "Bei den ersten 4 Haarwäschen, danach bei jeder 4. Haarwäsche.")
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
  assert.equal(resolved?.source, "exact_product_protocol")
  assert.equal(resolved?.copyDe, cadence?.copy_de)
  profile.application.cadence.value.status = "source_stated_conditional"
  sealProfile(profile)
  assert.equal(projectBondbuilderCadence(profile), null)
  const fallback = resolveRoutineItemCadence(
    base({
      authorityFacts: [
        {
          productId: "bond-1",
          category: "bondbuilder",
          role: "specialized_bond_treatment",
          cadence: null,
        },
      ],
    }),
  )
  assert.deepEqual(fallback, {
    copyDe: "Nach Herstellerangabe",
    source: "safe_generic_fallback",
    gapCode: "exact_product_cadence_unavailable",
  })
})

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
  } as never)

  await assert.rejects(() => reader.load({ productIds: ["bond-1"] }), databaseError)
})

/* ── S4: damage-branched Bondbuilder cadence (Aveda, decisions B1/D-b) ───── */

const DAMAGE_BRANCHED = {
  kind: "damage_branched",
  branches: [
    {
      structural_levels: ["moderate"],
      copy_de: "Einmal pro Woche anwenden.",
      maintenance: { kind: "times_per_week", minimum: 1, maximum: 1 },
      source_ids: ["C03-P07-1"],
    },
    {
      structural_levels: ["high", "severe"],
      copy_de: "An jedem Waschtag anwenden.",
      maintenance: { kind: "every_n_washes", minimum: 1, maximum: 1 },
      source_ids: ["C03-P07-1"],
    },
  ],
  source_ids: ["C03-P07-1"],
  binding_ruling: "decisions.md B1/D-b (Nick, 2026-10-09)",
}

const damageBranched = (
  structuralDamageLevel: RoutineCadenceResolutionInput["structuralDamageLevel"],
  cadence: unknown = DAMAGE_BRANCHED,
) =>
  resolveRoutineItemCadence(
    base({
      structuralDamageLevel,
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

const GENERIC = {
  copyDe: "Nach Herstellerangabe",
  source: "safe_generic_fallback",
  gapCode: "exact_product_cadence_unavailable",
} as const

test("damage-branched cadence: moderate → Einmal pro Woche", () => {
  assert.deepEqual(damageBranched("moderate"), {
    copyDe: "Einmal pro Woche anwenden.",
    source: "exact_product_protocol",
  })
})

test("damage-branched cadence: high and severe → An jedem Waschtag", () => {
  for (const level of ["high", "severe"] as const) {
    assert.deepEqual(damageBranched(level), {
      copyDe: "An jedem Waschtag anwenden.",
      source: "exact_product_protocol",
    })
  }
})

test("damage-branched cadence: none / low / missing level → Nach Herstellerangabe + gap", () => {
  for (const level of ["none", "low", null, undefined] as const) {
    assert.deepEqual(damageBranched(level), GENERIC, String(level))
  }
})

test("damage-branched cadence: malformed branches → generic", () => {
  const branches = DAMAGE_BRANCHED.branches
  const malformed: Record<string, unknown> = {
    "no branches": { ...DAMAGE_BRANCHED, branches: [] },
    "branches not an array": { ...DAMAGE_BRANCHED, branches: "moderate" },
    "overlapping levels": {
      ...DAMAGE_BRANCHED,
      branches: [branches[0], { ...branches[1], structural_levels: ["moderate", "high"] }],
    },
    "empty levels": {
      ...DAMAGE_BRANCHED,
      branches: [{ ...branches[0], structural_levels: [] }, branches[1]],
    },
    "unknown level": {
      ...DAMAGE_BRANCHED,
      branches: [{ ...branches[0], structural_levels: ["medium"] }, branches[1]],
    },
    "blank copy": { ...DAMAGE_BRANCHED, branches: [{ ...branches[0], copy_de: " " }, branches[1]] },
  }
  for (const [name, cadence] of Object.entries(malformed)) {
    assert.deepEqual(damageBranched("moderate", cadence), GENERIC, name)
  }
})

test("the damage level never changes a non-branched cadence or another category", () => {
  const course = { kind: "label_course", copy_de: "Alle ein bis drei Haarwäschen anwenden." }
  assert.deepEqual(damageBranched("severe", course), {
    copyDe: "Alle ein bis drei Haarwäschen anwenden.",
    source: "exact_product_protocol",
  })
  assert.deepEqual(
    resolveRoutineItemCadence(
      base({
        category: "scalp_care",
        role: "scalp_treatment" as never,
        recommended: { kind: "role_keyed_product_protocol", roleFrequencies: [] },
        structuralDamageLevel: "moderate",
        authorityFacts: [
          {
            productId: "bond-1",
            category: "scalp_care",
            role: "scalp_treatment" as never,
            cadence: DAMAGE_BRANCHED,
          },
        ],
      }),
    ),
    GENERIC,
  )
})

test("the cadence reader reads the refined version's damage band, scoped to plan and version", async () => {
  const calls: unknown[] = []
  const reader = createSupabaseRoutineCadenceAuthorityReader({
    from(table: string) {
      calls.push(["from", table])
      const query = {
        select(columns: string) {
          calls.push(["select", columns])
          return query
        },
        eq(column: string, value: string) {
          calls.push(["eq", column, value])
          return query
        },
        async maybeSingle() {
          return { data: { structuralLevel: "severe" }, error: null }
        },
        async in() {
          return { data: [], error: null }
        },
      }
      return query
    },
  } as never)

  assert.equal(
    await reader.loadStructuralDamageLevel?.({ planId: "plan-1", refinedVersionId: "refined-1" }),
    "severe",
  )
  assert.deepEqual(calls, [
    ["from", "personal_plan_need_versions"],
    ["select", "output_snapshot->assessments->damage->>structuralLevel"],
    ["eq", "id", "refined-1"],
    ["eq", "personal_plan_id", "plan-1"],
    ["eq", "kind", "refined"],
  ])
})
