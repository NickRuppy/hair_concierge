import assert from "node:assert/strict"
import test from "node:test"

import { compileApplicationView } from "../src/lib/routines/personal-plan/application/compiler"
import type {
  ApplicationGuidanceProtocolV1,
  NormalizedApplicationInput,
} from "../src/lib/routines/personal-plan/application/contracts"

const ids = [
  "11111111-1111-4111-8111-111111111111",
  "22222222-2222-4222-8222-222222222222",
  "33333333-3333-4333-8333-333333333333",
]
const dayTypes = [
  "wash_day",
  "intensive_care_day",
  "bond_repair_day",
  "clarifying_wash_day",
  "refresh_day",
  "between_wash_care_day",
  "styling_day",
  "rest_day",
] as const

function protocol(
  category: ApplicationGuidanceProtocolV1["scope"]["category"],
  role: ApplicationGuidanceProtocolV1["role"],
  family: ApplicationGuidanceProtocolV1["applicationFamily"],
  dayType: ApplicationGuidanceProtocolV1["compatibleDayTypes"][number],
  anchor: ApplicationGuidanceProtocolV1["sequence"]["anchor"],
): ApplicationGuidanceProtocolV1 {
  return {
    schemaVersion: 1,
    guidanceKey: `${category}-${role}`,
    protocolVersion: 1,
    locale: "de",
    scope: { kind: "application_family", category },
    role,
    applicationFamily: family,
    compatibleDayTypes: [dayType],
    exactGuidanceRequired: false,
    sequence: { anchor, before: [], after: [], conflictsWith: [] },
    requirements: { requiredCatalogFacts: [], requiredProtocolFacts: [], requiredProfileFacts: [] },
    protocolFacts: {
      applicationArea: "all_hair",
      rinse: "leave_in",
      contactTimeSeconds: null,
      conditionerRelationship: "not_applicable",
      reapplication: "none",
      amount: { kind: "qualitative", copyDe: "Sparsam verwenden." },
      cautions: [],
    },
    steps: [
      { stepKey: "apply", action: "apply_product", copyTemplateDe: "Gleichmäßig verteilen." },
    ],
    evidence: [
      { sourceUrl: "https://example.com", sourceType: "manufacturer", checkedAt: "2026-08-08" },
    ],
  }
}

function input(items: NormalizedApplicationInput["routineItems"]): NormalizedApplicationInput {
  return {
    routineItems: items,
    unresolvedRoutineItems: [],
    profile: { thickness: "normal" },
    dayTypes: dayTypes.map((key, index) => ({ key, sortOrder: index + 1 })),
  }
}

const shampoo = {
  itemId: "shampoo",
  productId: ids[0],
  productName: "Shampoo",
  category: "shampoo" as const,
  role: "cleanse" as const,
  inclusion: "included" as const,
  availability: "owned" as const,
  executable: true as const,
  catalogFacts: {},
}
const conditioner = {
  itemId: "conditioner",
  productId: ids[1],
  productName: "Conditioner",
  category: "conditioner" as const,
  role: "condition" as const,
  inclusion: "included" as const,
  availability: "owned" as const,
  executable: true as const,
  catalogFacts: {},
}
const leaveInAndHeat = {
  itemId: "leavein",
  productId: ids[2],
  productName: "Schutzspray",
  category: "leave_in" as const,
  role: "leave_in" as const,
  inclusion: "included" as const,
  availability: "owned" as const,
  executable: true as const,
  applicationInstanceKey: "after-wash",
  catalogFacts: {},
}

test("compiler builds canonical complete days, deduplicates a multi-role application, and keeps Pausentag", () => {
  const result = compileApplicationView({
    input: input([
      shampoo,
      conditioner,
      leaveInAndHeat,
      { ...leaveInAndHeat, itemId: "heat", role: "heat_protection" },
    ]),
    protocols: [
      protocol("shampoo", "cleanse", "standard_rinse_out_cleanse", "wash_day", "wet_cleanse"),
      protocol(
        "conditioner",
        "condition",
        "standard_rinse_out_conditioning",
        "wash_day",
        "post_cleanse_rinse_off",
      ),
      protocol("leave_in", "leave_in", "post_wash_booster", "wash_day", "damp_leave_on"),
      {
        ...protocol("leave_in", "heat_protection", "pre_heat_damp", "wash_day", "damp_leave_on"),
        guidanceKey: "leave-in-exact-heat",
        scope: { kind: "product", category: "leave_in", productId: ids[2] },
      },
    ],
  })
  assert.deepEqual(
    result.days.map((day) => day.key),
    ["wash_day", "rest_day"],
  )
  assert.deepEqual(
    result.days[0].productBlocks.map((block) => block.productName),
    ["Shampoo", "Conditioner", "Schutzspray"],
  )
  assert.deepEqual(result.days[0].productBlocks[2].roles, ["heat_protection", "leave_in"])
  assert.equal(
    result.days[0].productBlocks[2].noteDe,
    "Diese Anwendung übernimmt zugleich deinen Hitzeschutz.",
  )
  assert.deepEqual(result.days[0].outerSequence[0], {
    kind: "state_transition",
    fromAnchor: "dry",
    toAnchor: "wet_cleanse",
    copyDe: "Haare gründlich mit Wasser anfeuchten.",
  })
})

test("compiler fails the affected day closed when conditioner relationships conflict", () => {
  const shampooProtocol = protocol(
    "shampoo",
    "cleanse",
    "standard_rinse_out_cleanse",
    "intensive_care_day",
    "wet_cleanse",
  )
  shampooProtocol.protocolFacts.conditionerRelationship = "conditioner_before"
  const maskProtocol = protocol(
    "mask",
    "intensive_care",
    "post_shampoo_rinse_out_mask",
    "intensive_care_day",
    "timed_treatment",
  )
  maskProtocol.guidanceKey = "mask-exact-conflicting-conditioner-order"
  maskProtocol.scope = { kind: "product", category: "mask", productId: ids[2] }
  maskProtocol.exactGuidanceRequired = true
  maskProtocol.protocolFacts.conditionerRelationship = "conditioner_after"

  const result = compileApplicationView({
    input: input([
      shampoo,
      conditioner,
      {
        ...leaveInAndHeat,
        itemId: "mask",
        productName: "Maske",
        category: "mask",
        role: "intensive_care",
      },
    ]),
    protocols: [
      shampooProtocol,
      protocol(
        "conditioner",
        "condition",
        "standard_rinse_out_conditioning",
        "intensive_care_day",
        "post_cleanse_rinse_off",
      ),
      maskProtocol,
    ],
  })

  assert.equal(
    result.days.some((day) => day.key === "intensive_care_day"),
    false,
  )
  assert.deepEqual(
    result.failures.find((failure) => failure.dayType === "intensive_care_day"),
    { dayType: "intensive_care_day", reason: "conditioner_relationship_conflict" },
  )
})

test("an intensive-care Mask with replacement guidance suppresses Conditioner and keeps Mask instructions", () => {
  const maskProtocol = protocol(
    "mask",
    "intensive_care",
    "post_shampoo_rinse_out_mask",
    "intensive_care_day",
    "post_cleanse_rinse_off",
  )
  maskProtocol.guidanceKey = "mask-exact-replaces-conditioner"
  maskProtocol.scope = { kind: "product", category: "mask", productId: ids[2] }
  maskProtocol.exactGuidanceRequired = true
  maskProtocol.protocolFacts.rinse = "rinse_out"
  maskProtocol.protocolFacts.conditionerRelationship = "replaces_conditioner"
  maskProtocol.steps = [
    { stepKey: "apply-mask", action: "apply_product", copyTemplateDe: "Maske auftragen." },
    { stepKey: "wait-mask", action: "wait", copyTemplateDe: "3 Minuten einwirken lassen." },
    { stepKey: "rinse-mask", action: "rinse", copyTemplateDe: "Gründlich ausspülen." },
  ]

  const result = compileApplicationView({
    input: input([
      shampoo,
      conditioner,
      {
        ...leaveInAndHeat,
        itemId: "mask",
        productName: "Intensiv-Maske",
        category: "mask",
        role: "intensive_care",
      },
    ]),
    protocols: [
      protocol(
        "shampoo",
        "cleanse",
        "standard_rinse_out_cleanse",
        "intensive_care_day",
        "wet_cleanse",
      ),
      protocol(
        "conditioner",
        "condition",
        "standard_rinse_out_conditioning",
        "intensive_care_day",
        "post_cleanse_rinse_off",
      ),
      maskProtocol,
    ],
  })
  const day = result.days.find(({ key }) => key === "intensive_care_day")

  assert.deepEqual(
    day?.productBlocks.map(({ productName }) => productName),
    ["Shampoo", "Intensiv-Maske"],
  )
  assert.deepEqual(day?.productBlocks[1]?.steps, [
    { stepKey: "apply-mask", action: "apply_product", copyDe: "Maske auftragen." },
    { stepKey: "wait-mask", action: "wait", copyDe: "3 Minuten einwirken lassen." },
    { stepKey: "rinse-mask", action: "rinse", copyDe: "Gründlich ausspülen." },
  ])
})

test("compiler keeps separately reapplied heat events distinct and fails closed on incompatible exact product steps", () => {
  const heatRole = {
    ...leaveInAndHeat,
    itemId: "heat",
    role: "heat_protection" as const,
    applicationInstanceKey: "pre-heat",
  }
  const leaveProtocol = protocol(
    "leave_in",
    "leave_in",
    "post_wash_booster",
    "wash_day",
    "damp_leave_on",
  )
  const exactHeat = {
    ...protocol("leave_in", "heat_protection", "pre_heat_damp", "wash_day", "damp_leave_on"),
    guidanceKey: "exact-heat",
    scope: { kind: "product" as const, category: "leave_in" as const, productId: ids[2] },
    protocolFacts: {
      ...protocol("leave_in", "heat_protection", "pre_heat_damp", "wash_day", "damp_leave_on")
        .protocolFacts,
      reapplication: "each_separate_heat_event" as const,
    },
  }
  const separatelyApplied = compileApplicationView({
    input: input([shampoo, leaveInAndHeat, heatRole]),
    protocols: [
      protocol("shampoo", "cleanse", "standard_rinse_out_cleanse", "wash_day", "wet_cleanse"),
      leaveProtocol,
      exactHeat,
    ],
  })
  assert.equal(
    separatelyApplied.days[0].productBlocks.filter((block) => block.productId === ids[2]).length,
    2,
  )

  const incompatibleExactLeave = {
    ...leaveProtocol,
    guidanceKey: "exact-leave-conflict",
    scope: { kind: "product" as const, category: "leave_in" as const, productId: ids[2] },
    steps: [
      {
        stepKey: "leave",
        action: "apply_product" as const,
        copyTemplateDe: "Nur als Leave-in anwenden.",
      },
    ],
  }
  const incompatibleExactHeat = {
    ...exactHeat,
    protocolFacts: { ...exactHeat.protocolFacts, reapplication: "none" as const },
    steps: [
      {
        stepKey: "heat",
        action: "apply_product" as const,
        copyTemplateDe: "Vor dem Föhnen anwenden.",
      },
    ],
  }
  const conflicted = compileApplicationView({
    input: input([shampoo, leaveInAndHeat, heatRole]),
    protocols: [
      protocol("shampoo", "cleanse", "standard_rinse_out_cleanse", "wash_day", "wet_cleanse"),
      incompatibleExactLeave,
      incompatibleExactHeat,
    ],
  })
  assert.ok(
    conflicted.failures.some(
      (failure) => failure.dayType === "wash_day" && failure.reason === "product_guidance_conflict",
    ),
  )
})

test("compiler is invariant to shuffled items and protocols and suppresses incomplete days", () => {
  const protocols = [
    protocol("shampoo", "cleanse", "standard_rinse_out_cleanse", "wash_day", "wet_cleanse"),
    protocol(
      "conditioner",
      "condition",
      "standard_rinse_out_conditioning",
      "wash_day",
      "post_cleanse_rinse_off",
    ),
  ]
  const first = compileApplicationView({ input: input([shampoo, conditioner]), protocols })
  const shuffled = compileApplicationView({
    input: input([conditioner, shampoo]),
    protocols: [...protocols].reverse(),
  })
  assert.deepEqual(shuffled, first)
  assert.deepEqual(
    first.days.map((day) => day.key),
    ["wash_day", "rest_day"],
  )
})

test("standard and reset cleansing render a single application pass", () => {
  const result = compileApplicationView({
    input: input([shampoo]),
    protocols: [
      protocol("shampoo", "cleanse", "standard_rinse_out_cleanse", "wash_day", "wet_cleanse"),
    ],
  })
  assert.equal(
    result.days[0].productBlocks[0].steps.filter((step) => step.action === "apply_product").length,
    1,
  )
})

test("compiler inserts the wetting action when a pre-wash product precedes cleansing", () => {
  const preWashOil = {
    ...leaveInAndHeat,
    itemId: "pre-wash-oil",
    productId: "44444444-4444-4444-8444-444444444444",
    productName: "Pflegeöl",
    category: "oil" as const,
    role: "finish" as const,
    applicationInstanceKey: "pre-wash-oil",
  }
  const result = compileApplicationView({
    input: input([preWashOil, shampoo]),
    protocols: [
      protocol("oil", "finish", "pre_wash_lengths_treatment", "wash_day", "pre_wash"),
      protocol("shampoo", "cleanse", "standard_rinse_out_cleanse", "wash_day", "wet_cleanse"),
    ],
  })

  assert.deepEqual(result.days[0].outerSequence[1], {
    kind: "state_transition",
    fromAnchor: "pre_wash",
    toAnchor: "wet_cleanse",
    copyDe: "Haare gründlich mit Wasser anfeuchten.",
  })
})

test("compiler keeps resolved products in protocol-anchor order when Routine order differs", () => {
  const preWashOil = {
    ...leaveInAndHeat,
    itemId: "pre-wash-oil",
    productId: "44444444-4444-4444-8444-444444444444",
    productName: "Pflegeöl",
    category: "oil" as const,
    role: "finish" as const,
    applicationInstanceKey: "pre-wash-oil",
    routineOrder: 30,
  }
  const result = compileApplicationView({
    input: input([
      { ...shampoo, routineOrder: 10 },
      { ...leaveInAndHeat, routineOrder: 20 },
      preWashOil,
    ] as never),
    protocols: [
      protocol("oil", "finish", "pre_wash_lengths_treatment", "wash_day", "pre_wash"),
      protocol("shampoo", "cleanse", "standard_rinse_out_cleanse", "wash_day", "wet_cleanse"),
      protocol("leave_in", "leave_in", "post_wash_booster", "wash_day", "damp_leave_on"),
    ],
  })

  assert.deepEqual(
    result.days[0].outerSequence
      .filter((step) => step.kind === "product")
      .map((step) => step.block.productName),
    ["Pflegeöl", "Shampoo", "Schutzspray"],
  )
})

test("compiler suppresses a cyclic anchor graph with an internal failure reason", () => {
  const cleanse = protocol(
    "shampoo",
    "cleanse",
    "standard_rinse_out_cleanse",
    "wash_day",
    "wet_cleanse",
  )
  const condition = protocol(
    "conditioner",
    "condition",
    "standard_rinse_out_conditioning",
    "wash_day",
    "post_cleanse_rinse_off",
  )
  cleanse.sequence.before = ["post_cleanse_rinse_off"]
  condition.sequence.before = ["wet_cleanse"]
  const result = compileApplicationView({
    input: input([shampoo, conditioner]),
    protocols: [cleanse, condition],
  })
  assert.deepEqual(
    result.days.map((day) => day.key),
    ["rest_day"],
  )
  assert.ok(
    result.failures.some(
      (failure) => failure.dayType === "wash_day" && failure.reason === "ordering_cycle",
    ),
  )
})

test("compiler honors non-cyclic sequence edges and fails closed on conflicts", () => {
  const cleanse = protocol(
    "shampoo",
    "cleanse",
    "standard_rinse_out_cleanse",
    "wash_day",
    "wet_cleanse",
  )
  const condition = protocol(
    "conditioner",
    "condition",
    "standard_rinse_out_conditioning",
    "wash_day",
    "post_cleanse_rinse_off",
  )
  condition.sequence.before = ["wet_cleanse"]
  const ordered = compileApplicationView({
    input: input([shampoo, conditioner]),
    protocols: [cleanse, condition],
  })
  assert.deepEqual(
    ordered.days[0].productBlocks.map((block) => block.productName),
    ["Conditioner", "Shampoo"],
  )

  condition.sequence.before = []
  condition.sequence.conflictsWith = ["wet_cleanse"]
  const conflicted = compileApplicationView({
    input: input([shampoo, conditioner]),
    protocols: [cleanse, condition],
  })
  assert.deepEqual(
    conflicted.days.map((day) => day.key),
    ["rest_day"],
  )
  assert.ok(conflicted.failures.some((failure) => failure.reason === "anchor_conflict"))
})

test("an unresolved relevant product becomes a local gap while unrelated days remain usable", () => {
  const dryShampoo = {
    ...shampoo,
    itemId: "dry-shampoo",
    productId: "44444444-4444-4444-8444-444444444444",
    productName: "Trockenshampoo",
    category: "dry_shampoo" as const,
    role: "refresh" as const,
  }
  const result = compileApplicationView({
    input: input([shampoo, conditioner, dryShampoo]),
    protocols: [
      protocol("shampoo", "cleanse", "standard_rinse_out_cleanse", "wash_day", "wet_cleanse"),
      protocol("dry_shampoo", "refresh", "aerosol_spray", "refresh_day", "dry_finish"),
    ],
  })
  assert.deepEqual(
    result.days.map((day) => day.key),
    ["wash_day", "refresh_day", "rest_day"],
  )
  assert.ok(
    result.days
      .find((day) => day.key === "wash_day")
      ?.outerSequence.some((step) => step.kind === "unresolved_product"),
  )
})

test("unrelated Dry Shampoo guidance does not suppress a complete Waschtag", () => {
  const dryShampoo = {
    ...shampoo,
    itemId: "unresolved-dry-shampoo",
    productId: "55555555-5555-4555-8555-555555555555",
    productName: "Trockenshampoo",
    category: "dry_shampoo" as const,
    role: "refresh" as const,
  }
  const result = compileApplicationView({
    input: input([shampoo, dryShampoo]),
    protocols: [
      protocol("shampoo", "cleanse", "standard_rinse_out_cleanse", "wash_day", "wet_cleanse"),
    ],
  })
  assert.deepEqual(
    result.days.map((day) => day.key),
    ["wash_day", "rest_day"],
  )
})

test("compiler keeps reviewed guidance for a provisional product inside the day sequence", () => {
  const provisionalConditioner = {
    ...conditioner,
    availability: "planned" as const,
    executable: false as const,
    routineOrder: 20,
  }
  const result = compileApplicationView({
    input: input([
      { ...shampoo, routineOrder: 10 },
      provisionalConditioner,
      { ...leaveInAndHeat, routineOrder: 30 },
    ] as never),
    protocols: [
      protocol("shampoo", "cleanse", "standard_rinse_out_cleanse", "wash_day", "wet_cleanse"),
      protocol(
        "conditioner",
        "condition",
        "standard_rinse_out_conditioning",
        "wash_day",
        "post_cleanse_rinse_off",
      ),
      protocol("leave_in", "leave_in", "post_wash_booster", "wash_day", "damp_leave_on"),
    ],
  })

  const washDay = result.days.find((day) => day.key === "wash_day")
  assert.ok(washDay)
  assert.deepEqual(
    washDay.productBlocks.map((block) => [block.productName, block.status]),
    [
      ["Shampoo", "confirmed"],
      ["Conditioner", "provisional"],
      ["Schutzspray", "confirmed"],
    ],
  )
})

test("compiler retains a local unresolved product gap without hiding independent reviewed steps", () => {
  const result = compileApplicationView({
    input: input([
      { ...shampoo, routineOrder: 10 },
      { ...conditioner, availability: "planned", executable: false, routineOrder: 20 },
      { ...leaveInAndHeat, routineOrder: 30 },
    ] as never),
    protocols: [
      protocol("shampoo", "cleanse", "standard_rinse_out_cleanse", "wash_day", "wet_cleanse"),
      protocol("leave_in", "leave_in", "post_wash_booster", "wash_day", "damp_leave_on"),
    ],
  })

  const washDay = result.days.find((day) => day.key === "wash_day")
  assert.ok(washDay)
  assert.deepEqual(
    washDay.outerSequence
      .filter((step) => step.kind !== "state_transition")
      .map((step) => step.kind),
    ["product", "unresolved_product", "product"],
  )
  assert.equal(washDay.productBlocks.length, 2)
  assert.deepEqual(
    washDay.outerSequence
      .filter((step) => step.kind === "state_transition")
      .map((step) => [step.fromAnchor, step.toAnchor, step.copyDe]),
    [
      ["dry", "wet_cleanse", "Haare gründlich mit Wasser anfeuchten."],
      ["wet_cleanse", "damp_leave_on", "Im handtuchtrockenen Haar weitermachen."],
    ],
  )
  assert.equal(
    result.failures.some((failure) => failure.dayType === "wash_day"),
    false,
  )
})

test("compiler keeps an identity-free Routine position between reviewed products", () => {
  const result = compileApplicationView({
    input: {
      ...input([
        { ...shampoo, routineOrder: 0 },
        { ...leaveInAndHeat, routineOrder: 2 },
      ] as never),
      unresolvedRoutineItems: [
        {
          itemId: "pending-conditioner",
          category: "conditioner",
          role: "condition",
          routineOrder: 1,
          applicationInstanceKey: "assignment:pending-conditioner",
        },
      ],
    },
    protocols: [
      protocol("shampoo", "cleanse", "standard_rinse_out_cleanse", "wash_day", "wet_cleanse"),
      protocol("leave_in", "leave_in", "post_wash_booster", "wash_day", "damp_leave_on"),
    ],
  })

  const washDay = result.days.find((day) => day.key === "wash_day")
  assert.ok(washDay)
  assert.deepEqual(
    washDay.outerSequence
      .filter((step) => step.kind !== "state_transition")
      .map((step) =>
        step.kind === "unresolved_product" ? [step.kind, step.block.productName] : step.kind,
      ),
    ["product", ["unresolved_product", null], "product"],
  )
})

test("Heat uses one direct event by default and repeats only when exact guidance requires it", () => {
  const heatItem = {
    ...leaveInAndHeat,
    itemId: "planned-heat",
    productName: "Vorgemerkter Hitzeschutz",
    category: "heat_protectant" as const,
    role: "heat_protection" as const,
    sourceRoutineRole: "pre_heat_protection",
    availability: "planned" as const,
    executable: false,
    catalogFacts: { applicationState: "either", reapplication: "not_stated" },
  }
  const heatProfile = {
    thickness: "normal" as const,
    heatEvents: [
      { id: "heat:dryer", tool: "hair_dryer", route: "airflow_shaping" as const },
      {
        id: "heat:straightener",
        tool: "straightener",
        route: "direct_contact_heat" as const,
      },
    ],
  }
  const exactDry = {
    ...protocol(
      "heat_protectant",
      "heat_protection",
      "dry_hair_protection",
      "styling_day",
      "dry_pre_heat",
    ),
    guidanceKey: "exact-heat-dry",
    scope: { kind: "product" as const, category: "heat_protectant" as const, productId: ids[2] },
  }
  const exactDamp = {
    ...exactDry,
    guidanceKey: "exact-heat-damp",
    applicationFamily: "damp_hair_protection" as const,
    sequence: { ...exactDry.sequence, anchor: "damp_leave_on" as const },
  }
  const once = compileApplicationView({
    input: { ...input([heatItem] as never), profile: heatProfile } as never,
    protocols: [exactDamp, exactDry],
  })
  const onceDay = once.days.find((day) => day.key === "styling_day")
  assert.ok(onceDay)
  assert.equal(onceDay.productBlocks.length, 1)
  assert.deepEqual(onceDay.productBlocks[0]!.heatEventIds, ["heat:straightener"])

  const dampOnly = compileApplicationView({
    input: {
      ...input([
        {
          ...heatItem,
          catalogFacts: { applicationState: "damp", reapplication: "not_stated" },
        },
      ] as never),
      profile: heatProfile,
    } as never,
    protocols: [exactDamp],
  })
  const dampDay = dampOnly.days.find((day) => day.key === "styling_day")
  assert.ok(dampDay)
  assert.deepEqual(dampDay.productBlocks[0]!.heatEventIds, ["heat:dryer"])

  const repeated = compileApplicationView({
    input: {
      ...input([
        {
          ...heatItem,
          catalogFacts: { applicationState: "either", reapplication: "required" },
        },
      ] as never),
      profile: heatProfile,
    } as never,
    protocols: [
      {
        ...exactDamp,
        protocolFacts: {
          ...exactDamp.protocolFacts,
          reapplication: "each_separate_heat_event" as const,
        },
      },
      {
        ...exactDry,
        protocolFacts: {
          ...exactDry.protocolFacts,
          reapplication: "each_separate_heat_event" as const,
        },
      },
    ],
  })
  const repeatedDay = repeated.days.find((day) => day.key === "styling_day")
  assert.ok(repeatedDay)
  assert.equal(repeatedDay.productBlocks.length, 2)
})
