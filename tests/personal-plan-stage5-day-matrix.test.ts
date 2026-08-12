import assert from "node:assert/strict"
import test from "node:test"

import { compileApplicationView } from "../src/lib/routines/personal-plan/application/compiler"
import type {
  ApplicationGuidanceProtocolV1,
  NormalizedApplicationInput,
  NormalizedRoutineItem,
} from "../src/lib/routines/personal-plan/application/contracts"

const DAY_TYPES = [
  "wash_day",
  "intensive_care_day",
  "bond_repair_day",
  "clarifying_wash_day",
  "refresh_day",
  "between_wash_care_day",
  "styling_day",
  "rest_day",
] as const

function input(routineItems: NormalizedRoutineItem[]): NormalizedApplicationInput {
  return {
    routineItems,
    unresolvedRoutineItems: [],
    profile: { thickness: "normal", dryingRoute: "blow_dry" },
    dayTypes: DAY_TYPES.map((key, index) => ({ key, sortOrder: index + 1 })),
  }
}

function item(
  overrides: Pick<
    NormalizedRoutineItem,
    "itemId" | "productId" | "productName" | "category" | "role"
  > &
    Partial<NormalizedRoutineItem> = {
    itemId: "fallback-item",
    productId: "00000000-0000-4000-8000-000000000001",
    productName: "Fallback",
    category: "shampoo",
    role: "cleanse",
  },
): NormalizedRoutineItem {
  return {
    inclusion: "included",
    availability: "owned",
    executable: true,
    catalogFacts: {},
    ...overrides,
  }
}

function protocol(
  overrides: Pick<
    ApplicationGuidanceProtocolV1,
    | "guidanceKey"
    | "scope"
    | "role"
    | "applicationFamily"
    | "compatibleDayTypes"
    | "sequence"
    | "steps"
  > &
    Partial<ApplicationGuidanceProtocolV1>,
): ApplicationGuidanceProtocolV1 {
  return {
    schemaVersion: 1,
    protocolVersion: 1,
    locale: "de",
    exactGuidanceRequired: false,
    requirements: { requiredCatalogFacts: [], requiredProtocolFacts: [], requiredProfileFacts: [] },
    protocolFacts: {
      applicationArea: "all_hair",
      rinse: "leave_in",
      contactTimeSeconds: null,
      conditionerRelationship: "not_applicable",
      reapplication: "none",
      amount: { kind: "qualitative", copyDe: "Wie angegeben dosieren." },
      cautions: [],
    },
    evidence: [
      {
        sourceUrl: "https://example.com/stage5",
        sourceType: "manufacturer",
        checkedAt: "2026-08-08",
      },
    ],
    ...overrides,
  }
}

function day(result: ReturnType<typeof compileApplicationView>, key: (typeof DAY_TYPES)[number]) {
  const compiled = result.days.find((candidate) => candidate.key === key)
  assert.ok(compiled, `expected ${key} to compile: ${JSON.stringify(result)}`)
  return compiled
}

test("the full canonical-day fixture compiles each customer-visible day in canonical order", () => {
  const shampoo = item({
    itemId: "wash-shampoo",
    productId: "11111111-1111-4111-8111-111111111111",
    productName: "Sanftes Shampoo",
    category: "shampoo",
    role: "cleanse",
  })
  const conditioner = item({
    itemId: "wash-conditioner",
    productId: "22222222-2222-4222-8222-222222222222",
    productName: "Täglicher Conditioner",
    category: "conditioner",
    role: "condition",
  })
  const mask = item({
    itemId: "intensive-mask",
    productId: "33333333-3333-4333-8333-333333333333",
    productName: "Intensiv-Maske",
    category: "mask",
    role: "intensive_care",
  })
  const k18 = item({
    itemId: "bond-k18",
    productId: "44444444-4444-4444-8444-444444444444",
    productName: "K18 Leave-In",
    category: "bondbuilder",
    role: "bond_repair",
  })
  const reset = item({
    itemId: "clarifying-reset",
    productId: "55555555-5555-4555-8555-555555555555",
    productName: "Reset Shampoo",
    category: "deep_cleansing_shampoo",
    role: "reset_cleanse",
  })
  const refresh = item({
    itemId: "refresh-roots",
    productId: "66666666-6666-4666-8666-666666666666",
    productName: "Root Refresh",
    category: "dry_shampoo",
    role: "refresh",
    catalogFacts: { format: "aerosol" },
  })
  const dryCare = item({
    itemId: "dry-care-oil",
    productId: "77777777-7777-4777-8777-777777777777",
    productName: "Trockenpflege Öl",
    category: "oil",
    role: "finish",
  })
  const styling = item({
    itemId: "styling-cream",
    productId: "88888888-8888-4888-8888-888888888888",
    productName: "Styling Creme",
    category: "styling",
    role: "styling",
  })
  const heat = item({
    itemId: "styling-heat",
    productId: "99999999-9999-4999-8999-999999999999",
    productName: "Hitzeschutz",
    category: "heat_protectant",
    role: "heat_protection",
  })

  const result = compileApplicationView({
    input: input([shampoo, conditioner, mask, k18, reset, refresh, dryCare, styling, heat]),
    protocols: [
      protocol({
        guidanceKey: "wash-shampoo",
        scope: { kind: "application_family", category: "shampoo" },
        role: "cleanse",
        applicationFamily: "standard_rinse_out_cleanse",
        compatibleDayTypes: ["wash_day", "intensive_care_day", "bond_repair_day"],
        sequence: { anchor: "wet_cleanse", before: [], after: [], conflictsWith: [] },
        steps: [
          {
            stepKey: "shampoo",
            action: "apply_product",
            copyTemplateDe: "Einmal Shampoo auftragen und ausspülen.",
          },
        ],
      }),
      protocol({
        guidanceKey: "wash-conditioner",
        scope: { kind: "application_family", category: "conditioner" },
        role: "condition",
        applicationFamily: "standard_rinse_out_conditioning",
        compatibleDayTypes: [
          "wash_day",
          "intensive_care_day",
          "bond_repair_day",
          "clarifying_wash_day",
        ],
        sequence: { anchor: "post_cleanse_rinse_off", before: [], after: [], conflictsWith: [] },
        steps: [
          {
            stepKey: "conditioner",
            action: "apply_product",
            copyTemplateDe: "Conditioner in die Längen geben.",
          },
        ],
      }),
      protocol({
        guidanceKey: "intensive-mask",
        scope: { kind: "product", category: "mask", productId: mask.productId },
        role: "intensive_care",
        applicationFamily: "post_shampoo_rinse_out_mask",
        compatibleDayTypes: ["intensive_care_day", "clarifying_wash_day"],
        sequence: { anchor: "post_cleanse_rinse_off", before: [], after: [], conflictsWith: [] },
        protocolFacts: {
          applicationArea: "lengths_ends",
          rinse: "rinse_out",
          contactTimeSeconds: 300,
          conditionerRelationship: "conditioner_after",
          reapplication: "none",
          amount: { kind: "qualitative", copyDe: "Großzügig verwenden." },
          cautions: [],
        },
        steps: [
          { stepKey: "mask", action: "apply_product", copyTemplateDe: "Maske auftragen." },
          { stepKey: "wait", action: "wait", copyTemplateDe: "Fünf Minuten einwirken lassen." },
          { stepKey: "rinse", action: "rinse", copyTemplateDe: "Gründlich ausspülen." },
        ],
      }),
      protocol({
        guidanceKey: "k18-exact",
        scope: { kind: "product", category: "bondbuilder", productId: k18.productId },
        role: "bond_repair",
        applicationFamily: "post_shampoo_timed_leave_in",
        compatibleDayTypes: ["bond_repair_day"],
        exactGuidanceRequired: true,
        sequence: { anchor: "timed_treatment", before: [], after: [], conflictsWith: [] },
        protocolFacts: {
          applicationArea: "all_hair",
          rinse: "leave_in",
          contactTimeSeconds: 240,
          conditionerRelationship: "no_conditioner",
          reapplication: "none",
          amount: { kind: "qualitative", copyDe: "1 bis 3 Pumpstöße verwenden." },
          cautions: [],
        },
        steps: [
          { stepKey: "towel-dry", action: "dry", copyTemplateDe: "Mit dem Handtuch trocknen." },
          {
            stepKey: "apply",
            action: "apply_product",
            copyTemplateDe: "1 bis 3 Pumpstöße einarbeiten.",
          },
          { stepKey: "wait", action: "wait", copyTemplateDe: "Vier Minuten warten." },
        ],
      }),
      protocol({
        guidanceKey: "reset-cleanse",
        scope: { kind: "application_family", category: "deep_cleansing_shampoo" },
        role: "reset_cleanse",
        applicationFamily: "reset_cleanse",
        compatibleDayTypes: ["clarifying_wash_day"],
        sequence: { anchor: "wet_cleanse", before: [], after: [], conflictsWith: [] },
        steps: [
          {
            stepKey: "reset",
            action: "apply_product",
            copyTemplateDe: "Reset Shampoo einmal anwenden und ausspülen.",
          },
        ],
      }),
      protocol({
        guidanceKey: "root-refresh",
        scope: { kind: "application_family", category: "dry_shampoo" },
        role: "refresh",
        applicationFamily: "aerosol_spray",
        compatibleDayTypes: ["refresh_day"],
        sequence: { anchor: "dry_finish", before: [], after: [], conflictsWith: [] },
        protocolFacts: {
          applicationArea: "scalp_roots",
          rinse: "leave_in",
          contactTimeSeconds: null,
          conditionerRelationship: "not_applicable",
          reapplication: "none",
          amount: { kind: "qualitative", copyDe: "Gezielt verwenden." },
          cautions: [],
        },
        steps: [
          {
            stepKey: "roots",
            action: "apply_product",
            copyTemplateDe: "Nur am Ansatz aufsprühen.",
          },
        ],
      }),
      protocol({
        guidanceKey: "dry-care-oil",
        scope: { kind: "product", category: "oil", productId: dryCare.productId },
        role: "finish",
        applicationFamily: "dry_finish",
        compatibleDayTypes: ["refresh_day", "between_wash_care_day"],
        sequence: { anchor: "dry_finish", before: [], after: [], conflictsWith: [] },
        steps: [
          {
            stepKey: "oil",
            action: "apply_product",
            copyTemplateDe: "Auf trockenes Haar in die Spitzen geben.",
          },
        ],
      }),
      protocol({
        guidanceKey: "styling-cream",
        scope: { kind: "application_family", category: "styling" },
        role: "styling",
        applicationFamily: "styling_product",
        compatibleDayTypes: ["styling_day"],
        sequence: { anchor: "dry_pre_heat", before: [], after: [], conflictsWith: [] },
        steps: [
          { stepKey: "style", action: "apply_product", copyTemplateDe: "Styling Creme verteilen." },
        ],
      }),
      protocol({
        guidanceKey: "styling-heat",
        scope: { kind: "product", category: "heat_protectant", productId: heat.productId },
        role: "heat_protection",
        applicationFamily: "dry_hair_protection",
        compatibleDayTypes: [
          "wash_day",
          "intensive_care_day",
          "bond_repair_day",
          "clarifying_wash_day",
          "refresh_day",
          "between_wash_care_day",
          "styling_day",
        ],
        sequence: { anchor: "heat_tool", before: [], after: [], conflictsWith: [] },
        protocolFacts: {
          applicationArea: "all_hair",
          rinse: "leave_in",
          contactTimeSeconds: null,
          conditionerRelationship: "not_applicable",
          reapplication: "each_separate_heat_event",
          amount: { kind: "qualitative", copyDe: "Gleichmäßig verwenden." },
          cautions: [],
        },
        steps: [
          {
            stepKey: "protect",
            action: "apply_product",
            copyTemplateDe: "Vor jedem separaten Hitze-Ereignis erneut auftragen.",
          },
          { stepKey: "tool", action: "tool", copyTemplateDe: "Mit dem Styling-Tool arbeiten." },
        ],
      }),
    ],
  })

  assert.deepEqual(
    result.days.map((candidate) => candidate.key),
    DAY_TYPES,
  )
  assert.equal(
    day(result, "wash_day")
      .productBlocks.filter((block) => block.category === "shampoo")[0]
      .steps.filter((step) => step.action === "apply_product").length,
    1,
  )
  assert.equal(
    day(result, "clarifying_wash_day").productBlocks.some(
      (block) => block.productId === shampoo.productId,
    ),
    false,
  )
  assert.equal(
    day(result, "clarifying_wash_day")
      .productBlocks.filter((block) => block.productId === reset.productId)[0]
      .steps.filter((step) => step.action === "apply_product").length,
    1,
  )
  assert.deepEqual(
    day(result, "intensive_care_day").productBlocks.map((block) => block.productName),
    ["Sanftes Shampoo", "Intensiv-Maske", "Täglicher Conditioner", "Hitzeschutz"],
  )
  assert.deepEqual(
    day(result, "bond_repair_day").productBlocks.map((block) => block.productName),
    ["Sanftes Shampoo", "K18 Leave-In", "Hitzeschutz"],
  )
  assert.match(
    day(result, "bond_repair_day")
      .productBlocks.find((block) => block.productName === "K18 Leave-In")!
      .steps.map((step) => step.copyDe)
      .join(" "),
    /Vier Minuten/,
  )
  assert.equal(day(result, "rest_day").productBlocks.length, 0)
})

test("refresh keeps roots and lengths independent, and dry care stays explicitly partial without verified dry-use guidance", () => {
  const roots = item({
    itemId: "roots",
    productId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    productName: "Ansatz Refresh",
    category: "dry_shampoo",
    role: "refresh",
    catalogFacts: { format: "aerosol" },
  })
  const lengths = item({
    itemId: "lengths",
    productId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    productName: "Längen Refresh",
    category: "styling",
    role: "styling",
  })
  const unverifiedLeaveIn = item({
    itemId: "unverified-dry-leave-in",
    productId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    productName: "Unverifiziertes Leave-In",
    category: "leave_in",
    role: "leave_in",
  })
  const protocols = [
    protocol({
      guidanceKey: "roots",
      scope: { kind: "application_family", category: "dry_shampoo" },
      role: "refresh",
      applicationFamily: "aerosol_spray",
      compatibleDayTypes: ["refresh_day"],
      sequence: { anchor: "dry_finish", before: [], after: [], conflictsWith: [] },
      steps: [
        { stepKey: "roots", action: "apply_product", copyTemplateDe: "Nur am Ansatz anwenden." },
      ],
    }),
    protocol({
      guidanceKey: "lengths",
      scope: { kind: "application_family", category: "styling" },
      role: "styling",
      applicationFamily: "styling_product",
      compatibleDayTypes: ["refresh_day"],
      sequence: { anchor: "dry_finish", before: [], after: [], conflictsWith: [] },
      steps: [
        {
          stepKey: "lengths",
          action: "apply_product",
          copyTemplateDe: "Nur in den Längen auffrischen.",
        },
      ],
    }),
    protocol({
      guidanceKey: "leave-in-wash-only",
      scope: { kind: "application_family", category: "leave_in" },
      role: "leave_in",
      applicationFamily: "post_wash_booster",
      compatibleDayTypes: ["wash_day"],
      sequence: { anchor: "damp_leave_on", before: [], after: [], conflictsWith: [] },
      steps: [
        {
          stepKey: "wash-only",
          action: "apply_product",
          copyTemplateDe: "Nur nach der Wäsche anwenden.",
        },
      ],
    }),
  ]

  const rootsOnly = compileApplicationView({ input: input([roots]), protocols })
  const lengthsOnly = compileApplicationView({ input: input([lengths]), protocols })
  const both = compileApplicationView({ input: input([roots, lengths]), protocols })
  const dryCareRejected = compileApplicationView({ input: input([unverifiedLeaveIn]), protocols })

  assert.deepEqual(
    day(rootsOnly, "refresh_day").productBlocks.map((block) => block.productName),
    ["Ansatz Refresh"],
  )
  assert.deepEqual(
    day(lengthsOnly, "refresh_day").productBlocks.map((block) => block.productName),
    ["Längen Refresh"],
  )
  assert.deepEqual(
    day(both, "refresh_day").productBlocks.map((block) => block.productName),
    ["Ansatz Refresh", "Längen Refresh"],
  )
  const partialDryCareDay = day(dryCareRejected, "between_wash_care_day")
  assert.equal(partialDryCareDay.isPartial, true)
  assert.ok(
    partialDryCareDay.outerSequence.some(
      (step) =>
        step.kind === "unresolved_product" && step.block.productId === unverifiedLeaveIn.productId,
    ),
  )
  assert.equal(
    dryCareRejected.failures.some((failure) => failure.dayType === "between_wash_care_day"),
    false,
  )
})

test("multi-role product dedupes once, preserves separately re-applied heat protection, and an incomplete day is isolated as partial", () => {
  const multitasker = item({
    itemId: "leave-in",
    productId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    productName: "Schutz-Milch",
    category: "leave_in",
    role: "leave_in",
    applicationInstanceKey: "after-wash",
  })
  const heatRole = item({
    ...multitasker,
    itemId: "heat-role",
    role: "heat_protection",
    applicationInstanceKey: "pre-heat",
  })
  const shampoo = item({
    itemId: "complete-wash",
    productId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    productName: "Komplett Shampoo",
    category: "shampoo",
    role: "cleanse",
  })
  const incompleteReset = item({
    itemId: "missing-reset",
    productId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
    productName: "Ohne Protokoll",
    category: "deep_cleansing_shampoo",
    role: "reset_cleanse",
  })
  const result = compileApplicationView({
    input: input([multitasker, heatRole, shampoo, incompleteReset]),
    protocols: [
      protocol({
        guidanceKey: "leave-in",
        scope: { kind: "application_family", category: "leave_in" },
        role: "leave_in",
        applicationFamily: "post_wash_booster",
        compatibleDayTypes: ["wash_day"],
        sequence: { anchor: "damp_leave_on", before: [], after: [], conflictsWith: [] },
        steps: [
          { stepKey: "leave-in", action: "apply_product", copyTemplateDe: "Als Pflege auftragen." },
        ],
      }),
      protocol({
        guidanceKey: "heat",
        scope: { kind: "product", category: "leave_in", productId: multitasker.productId },
        role: "heat_protection",
        applicationFamily: "pre_heat_damp",
        compatibleDayTypes: ["wash_day"],
        sequence: { anchor: "damp_leave_on", before: [], after: [], conflictsWith: [] },
        protocolFacts: {
          applicationArea: "all_hair",
          rinse: "leave_in",
          contactTimeSeconds: null,
          conditionerRelationship: "not_applicable",
          reapplication: "none",
          amount: { kind: "qualitative", copyDe: "Erneut anwenden." },
          cautions: [],
        },
        steps: [
          {
            stepKey: "heat",
            action: "apply_product",
            copyTemplateDe:
              "Vor dem Föhnen auftragen und vor einem späteren Hot-Tool erneut anwenden.",
          },
        ],
      }),
      protocol({
        guidanceKey: "shampoo",
        scope: { kind: "application_family", category: "shampoo" },
        role: "cleanse",
        applicationFamily: "standard_rinse_out_cleanse",
        compatibleDayTypes: ["wash_day"],
        sequence: { anchor: "wet_cleanse", before: [], after: [], conflictsWith: [] },
        steps: [{ stepKey: "wash", action: "apply_product", copyTemplateDe: "Einmal waschen." }],
      }),
    ],
  })

  const block = day(result, "wash_day").productBlocks.find(
    (candidate) => candidate.productId === multitasker.productId,
  )
  assert.ok(block)
  assert.deepEqual(block.roles, ["heat_protection", "leave_in"])
  assert.equal(
    day(result, "wash_day").productBlocks.filter(
      (candidate) => candidate.productId === multitasker.productId,
    ).length,
    1,
  )
  assert.match(block.steps.map((step) => step.copyDe).join(" "), /späteren Hot-Tool erneut/)
  const partialClarifyingDay = day(result, "clarifying_wash_day")
  assert.equal(partialClarifyingDay.isPartial, true)
  assert.ok(
    partialClarifyingDay.outerSequence.some(
      (step) =>
        step.kind === "unresolved_product" && step.block.productId === incompleteReset.productId,
    ),
  )
  assert.equal(
    result.failures.some((failure) => failure.dayType === "clarifying_wash_day"),
    false,
  )
  assert.ok(result.days.some((candidate) => candidate.key === "wash_day"))
})
