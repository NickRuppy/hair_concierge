import assert from "node:assert/strict"
import test from "node:test"

import type {
  DiscoveryCockpitStepView,
  DiscoveryCockpitUnassignedView,
  DiscoveryCockpitVerdictView,
  DiscoveryCockpitView,
} from "../src/lib/discovery/cockpit"
import type { DiscoveryVerdictStatus } from "../src/lib/discovery/load-participant-verdicts"
import {
  deriveBuckets,
  derivePrepChecklist,
  RUNSHEET_PREP_RULES,
  runsheetVerdictFit,
  type RunsheetBuckets,
} from "../src/lib/discovery/runsheet"
import type { PersonalPlanCategory } from "../src/lib/personal-plan/products/contracts"
import type { ScanPresentedVerdictPayload, ScanVerdict } from "../src/lib/scan/types"

/**
 * The call runsheet's pure derivations (consult-runsheet T2): the cockpit view re-sorted into
 * the Phase-3 decision buckets, and the „Vor dem Call" checklist. Both are read-only
 * consumers of the cockpit read model — every fixture here is deep-frozen, so any write to
 * the view (above all to `unassigned`, which the finalize gates and the PDF redirect read)
 * throws instead of passing silently.
 */

// --- fixtures ----------------------------------------------------------------------

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const key of Object.keys(value as object)) {
      deepFreeze((value as Record<string, unknown>)[key])
    }
  }
  return value
}

function inCatalog(verdict: ScanVerdict): DiscoveryCockpitVerdictView {
  return {
    status: "verdict",
    product: { id: "p", name: "P", brand: null } as never,
    payload: {
      kind: "in_catalog",
      verdict,
      verdictLabel: verdict,
      verdictTitle: verdict,
      status: "neutral",
      subtitle: "",
      evaluatedRole: null,
      evaluatedRoleLabel: null,
      dimensions: [],
      criteria: [],
      coverage: null,
      fitNarrative: null,
      alternatives: [],
    } satisfies ScanPresentedVerdictPayload,
    propertyRows: [],
  }
}

function notNeeded(mode: "not_needed" | "deferred"): DiscoveryCockpitVerdictView {
  return {
    status: "verdict",
    product: { id: "p", name: "P", brand: null } as never,
    payload: {
      kind: "not_needed",
      mode,
      status: "neutral",
      headline: "",
      subtitle: "",
      reasons: [],
      dimensions: [],
      coveredBy: [],
    },
    propertyRows: [],
  }
}

type StepInput = Partial<DiscoveryCockpitStepView> & {
  decisionKey: string
  category: PersonalPlanCategory
}

function step(input: StepInput): DiscoveryCockpitStepView {
  return {
    categoryLabel: input.category,
    roleLabel: input.category,
    roleDescription: null,
    frequencyLabel: "2× pro Woche",
    depth: null,
    section: "basis",
    outcome: input.intakeItemId ? "undecided" : "ideal",
    ownedLabel: input.intakeItemId ? `Owned ${input.intakeItemId}` : null,
    intakeItemId: null,
    ownedProductId: input.intakeItemId ? `product-${input.intakeItemId}` : null,
    ownedUsageRole: null,
    stepEntryCount: 1,
    ownedFrequencyLabel: null,
    canDrop: false,
    unanswered: false,
    verdict: null,
    swapOptions: [],
    swapProductId: null,
    swapProductLabel: null,
    idealRecommendation: null,
    recommendationLabel: null,
    ownedUsageLabel: null,
    ownedImageUrl: null,
    swapProductImageUrl: null,
    recommendationImageUrl: null,
    usageDifference: null,
    ...input,
  }
}

function recommendation(productId: string, label: string) {
  return {
    productId,
    name: label,
    brand: null,
    label,
    verdictLabel: "Passt",
    origin: "ideal_recommendation" as const,
    propertyRows: null,
  }
}

function emptyStepWithRecommendation(
  decisionKey: string,
  category: PersonalPlanCategory,
  productId: string,
): DiscoveryCockpitStepView {
  const label = `Empfehlung ${productId}`
  return step({
    decisionKey,
    category,
    outcome: "ideal",
    idealRecommendation: recommendation(productId, label),
    recommendationLabel: label,
  })
}

function unassigned(
  itemId: string,
  reason: DiscoveryCockpitUnassignedView["reason"],
  category: PersonalPlanCategory | null,
): DiscoveryCockpitUnassignedView {
  return { itemId, category, label: `Label ${itemId}`, reason, usageLabel: null, imageUrl: null }
}

function view(
  steps: DiscoveryCockpitStepView[],
  unassignedEntries: DiscoveryCockpitUnassignedView[] = [],
): DiscoveryCockpitView {
  return deepFreeze({
    intakeProducts: [],
    researchStatusAvailable: true,
    steps,
    unassigned: unassignedEntries,
    declinedCategories: [],
    unansweredCategories: [],
    sourceHash: "hash",
    recommendationBrandsAvailable: true,
    application: null,
    applicationAvailable: true,
    applicationGaps: [],
    heatStyling: null,
    heatProtectionAsk: false,
    routineSource: "quiz_only",
  })
}

function keysOf(buckets: RunsheetBuckets, bucket: keyof RunsheetBuckets) {
  return buckets[bucket].map((entry) => `${entry.kind}:${entry.intakeItemId ?? entry.decisionKey}`)
}

/**
 * Nomi: bleached, hair „reißt sofort", four captured products — a conditioner still in
 * research, a mask and a shampoo the engine grades as not fitting, a leave-in that fits —
 * and open steps the Idealplan fills with its own recommendations.
 */
function nomiView(): DiscoveryCockpitView {
  return view(
    [
      step({
        decisionKey: "shampoo:base",
        category: "shampoo",
        intakeItemId: "item-shampoo",
        verdict: inCatalog("mismatch"),
      }),
      emptyStepWithRecommendation("conditioner:base", "conditioner", "rec-conditioner"),
      step({
        decisionKey: "mask:base",
        category: "mask",
        intakeItemId: "item-mask",
        verdict: inCatalog("mismatch"),
      }),
      step({
        decisionKey: "leave_in:base",
        category: "leave_in",
        intakeItemId: "item-leave-in",
        verdict: inCatalog("ideal"),
      }),
      emptyStepWithRecommendation("heat_protectant:base", "heat_protectant", "rec-heat"),
    ],
    [unassigned("item-conditioner", "research_pending", "conditioner")],
  )
}

// --- deriveBuckets -----------------------------------------------------------------

test("Nomi: research-pending conditioner is klären, not-fitting products and open steps go to tauschen oder neu", () => {
  const buckets = deriveBuckets(nomiView())

  assert.deepEqual(keysOf(buckets, "klaeren"), ["unassigned:item-conditioner"])
  assert.deepEqual(keysOf(buckets, "behalten"), ["owned:item-leave-in"])
  assert.deepEqual(keysOf(buckets, "tauschenOderNeu"), [
    "owned:item-shampoo",
    "neu:conditioner:base",
    "owned:item-mask",
    "neu:heat_protectant:base",
  ])
  assert.deepEqual(buckets.weglassen, [])
  assert.deepEqual(buckets.styling, [])

  // Nothing is decided yet: every entry is a proposal.
  for (const bucket of ["behalten", "tauschenOderNeu", "klaeren"] as const) {
    for (const entry of buckets[bucket]) assert.equal(entry.proposed, true)
  }

  const shampoo = buckets.tauschenOderNeu[0]!
  assert.equal(shampoo.kind, "owned")
  if (shampoo.kind === "owned") {
    assert.equal(shampoo.intakeItemId, "item-shampoo")
    assert.equal(shampoo.decisionKey, "shampoo:base")
    assert.equal(shampoo.category, "shampoo")
    assert.equal(shampoo.decision, null)
    assert.equal(shampoo.verdictFit, "does_not_fit")
    assert.equal(shampoo.swapProductId, null)
  }

  const conditioner = buckets.tauschenOderNeu[1]!
  assert.equal(conditioner.kind, "neu")
  if (conditioner.kind === "neu") {
    assert.equal(conditioner.intakeItemId, null)
    assert.equal(conditioner.decisionKey, "conditioner:base")
    assert.equal(conditioner.category, "conditioner")
    assert.equal(conditioner.productId, "rec-conditioner")
    assert.equal(conditioner.label, "Empfehlung rec-conditioner")
  }

  const klaeren = buckets.klaeren[0]!
  assert.equal(klaeren.kind, "unassigned")
  if (klaeren.kind === "unassigned") {
    assert.equal(klaeren.intakeItemId, "item-conditioner")
    assert.equal(klaeren.decisionKey, null)
    assert.equal(klaeren.category, "conditioner")
    assert.equal(klaeren.reason, "research_pending")
  }
})

test("an empty bucket stays an empty array (nothing qualifies for weglassen)", () => {
  const buckets = deriveBuckets(
    view([
      step({
        decisionKey: "shampoo:base",
        category: "shampoo",
        intakeItemId: "item-a",
        verdict: inCatalog("ideal"),
      }),
    ]),
  )
  assert.deepEqual(buckets.weglassen, [])
  assert.deepEqual(buckets.tauschenOderNeu, [])
  assert.deepEqual(buckets.klaeren, [])
  assert.deepEqual(keysOf(buckets, "behalten"), ["owned:item-a"])
})

test("an unresearched item in an occupied category is klären; the bound entry keeps its bucket; unassigned is untouched", () => {
  const unassignedEntries = [
    unassigned("item-conditioner-new", "research_pending", "conditioner"),
    unassigned("item-unknown", "category_unknown", null),
  ]
  const snapshot = structuredClone(unassignedEntries)
  const input = view(
    [
      step({
        decisionKey: "conditioner:base",
        category: "conditioner",
        intakeItemId: "item-conditioner-bound",
        verdict: inCatalog("ideal"),
      }),
    ],
    unassignedEntries,
  )
  const before = input.unassigned

  const buckets = deriveBuckets(input)

  assert.deepEqual(keysOf(buckets, "klaeren"), [
    "unassigned:item-conditioner-new",
    "unassigned:item-unknown",
  ])
  assert.deepEqual(keysOf(buckets, "behalten"), ["owned:item-conditioner-bound"])
  // The gate projection: same array, same entries, same content — nothing re-homed.
  assert.equal(input.unassigned, before)
  assert.equal(input.unassigned.length, 2)
  assert.equal(input.unassigned[0], unassignedEntries[0])
  assert.deepEqual(input.unassigned, snapshot)
  // The derived structure is new — mutating it cannot reach the view.
  assert.notEqual(buckets.klaeren as unknown, input.unassigned as unknown)
})

test("same step with two products: independent keep and swap outcomes stay two entries", () => {
  const buckets = deriveBuckets(
    view([
      step({
        decisionKey: "conditioner:base",
        category: "conditioner",
        intakeItemId: "item-a",
        outcome: "kept",
        stepEntryCount: 2,
        verdict: inCatalog("mismatch"),
      }),
      step({
        decisionKey: "conditioner:base",
        category: "conditioner",
        intakeItemId: "item-b",
        outcome: "swapped",
        stepEntryCount: 2,
        verdict: inCatalog("ideal"),
        swapProductId: "swap-target",
        swapProductLabel: "Brand Swap Target",
      }),
      step({
        decisionKey: "conditioner:base",
        category: "conditioner",
        intakeItemId: "item-c",
        outcome: "dropped",
        stepEntryCount: 3,
        verdict: inCatalog("ideal"),
      }),
    ]),
  )

  // A recorded decision wins over the verdict — both ways round.
  assert.deepEqual(keysOf(buckets, "behalten"), ["owned:item-a"])
  assert.deepEqual(keysOf(buckets, "tauschenOderNeu"), ["owned:item-b"])
  assert.deepEqual(keysOf(buckets, "weglassen"), ["owned:item-c"])

  const kept = buckets.behalten[0]!
  const swapped = buckets.tauschenOderNeu[0]!
  const dropped = buckets.weglassen[0]!
  assert.equal(kept.decisionKey, "conditioner:base")
  assert.equal(swapped.decisionKey, "conditioner:base")
  assert.notEqual(kept.intakeItemId, swapped.intakeItemId)
  for (const entry of [kept, swapped, dropped]) assert.equal(entry.proposed, false)

  assert.equal(kept.kind === "owned" && kept.decision, "keep")
  assert.equal(dropped.kind === "owned" && dropped.decision, "drop")
  assert.equal(swapped.kind, "owned")
  if (swapped.kind === "owned") {
    assert.equal(swapped.decision, "swap")
    assert.equal(swapped.swapProductId, "swap-target")
    assert.equal(swapped.swapProductLabel, "Brand Swap Target")
  }
})

test("an empty step: a decided swap is a decided neu; a kept empty step and one without recommendation yield nothing", () => {
  const buckets = deriveBuckets(
    view([
      step({
        decisionKey: "mask:base",
        category: "mask",
        outcome: "swapped",
        swapProductId: "chosen-mask",
        swapProductLabel: "Chosen Mask",
        idealRecommendation: recommendation("rec-mask", "Rec Mask"),
      }),
      step({ decisionKey: "oil:base", category: "oil", outcome: "kept" }),
      step({ decisionKey: "leave_in:base", category: "leave_in", outcome: "ideal" }),
    ]),
  )
  assert.equal(buckets.tauschenOderNeu.length, 1)
  const entry = buckets.tauschenOderNeu[0]!
  assert.equal(entry.kind, "neu")
  assert.equal(entry.proposed, false)
  if (entry.kind === "neu") {
    assert.equal(entry.productId, "chosen-mask")
    assert.equal(entry.label, "Chosen Mask")
  }
  assert.deepEqual(buckets.behalten, [])
  assert.deepEqual(buckets.weglassen, [])
})

test("products outside the Idealroutine are weglassen proposals; styling is listed apart from the buckets", () => {
  const buckets = deriveBuckets(
    view(
      [emptyStepWithRecommendation("shampoo:base", "shampoo", "rec-shampoo")],
      [
        unassigned("item-dry-shampoo", "no_ideal_step", "dry_shampoo"),
        unassigned("item-gel", "styling_not_evaluated", null),
      ],
    ),
  )
  assert.deepEqual(keysOf(buckets, "weglassen"), ["unassigned:item-dry-shampoo"])
  assert.equal(buckets.weglassen[0]!.proposed, true)
  assert.deepEqual(keysOf(buckets, "styling"), ["unassigned:item-gel"])
  assert.deepEqual(buckets.klaeren, [])
})

test("legacy view with no steps and no unassigned products derives empty buckets", () => {
  const buckets = deriveBuckets(view([]))
  assert.deepEqual(buckets, {
    behalten: [],
    weglassen: [],
    tauschenOderNeu: [],
    klaeren: [],
    styling: [],
  })
})

// --- verdict mapping (totality) -----------------------------------------------------

const VERDICT_CASES: Array<{
  name: string
  verdict: DiscoveryCockpitVerdictView | null
  fit: "fits" | "does_not_fit" | "uncertain"
  bucket: "behalten" | "tauschenOderNeu"
}> = [
  { name: "no verdict row", verdict: null, fit: "uncertain", bucket: "tauschenOderNeu" },
  { name: "in_catalog ideal", verdict: inCatalog("ideal"), fit: "fits", bucket: "behalten" },
  {
    name: "in_catalog supportive",
    verdict: inCatalog("supportive"),
    fit: "fits",
    bucket: "behalten",
  },
  {
    name: "in_catalog mismatch",
    verdict: inCatalog("mismatch"),
    fit: "does_not_fit",
    bucket: "tauschenOderNeu",
  },
  {
    name: "in_catalog unknown",
    verdict: inCatalog("unknown"),
    fit: "uncertain",
    bucket: "tauschenOderNeu",
  },
  {
    name: "not_needed (settled)",
    verdict: notNeeded("not_needed"),
    fit: "does_not_fit",
    bucket: "tauschenOderNeu",
  },
  {
    name: "not_needed (deferred)",
    verdict: notNeeded("deferred"),
    fit: "uncertain",
    bucket: "tauschenOderNeu",
  },
  ...(
    [
      ["product_unavailable", "uncertain"],
      ["quarantined", "uncertain"],
      ["target_mismatch", "does_not_fit"],
      ["decision_missing", "uncertain"],
      ["unavailable", "uncertain"],
    ] as const satisfies ReadonlyArray<
      readonly [Exclude<DiscoveryVerdictStatus, "verdict">, "uncertain" | "does_not_fit"]
    >
  ).map(([status, fit]) => ({
    name: `status ${status}`,
    verdict: { status } as DiscoveryCockpitVerdictView,
    fit,
    bucket: "tauschenOderNeu" as const,
  })),
]

for (const entry of VERDICT_CASES) {
  test(`verdict mapping: ${entry.name} → ${entry.fit} → ${entry.bucket} (proposed)`, () => {
    assert.equal(runsheetVerdictFit(entry.verdict), entry.fit)
    const buckets = deriveBuckets(
      view([
        step({
          decisionKey: "shampoo:base",
          category: "shampoo",
          intakeItemId: "item",
          verdict: entry.verdict,
        }),
      ]),
    )
    assert.equal(buckets[entry.bucket].length, 1)
    const derived = buckets[entry.bucket][0]!
    assert.equal(derived.proposed, true)
    assert.equal(derived.kind === "owned" && derived.verdictFit, entry.fit)
  })
}

test("verdict mapping covers every DiscoveryVerdictStatus", () => {
  const statuses: Record<DiscoveryVerdictStatus, true> = {
    verdict: true,
    product_unavailable: true,
    quarantined: true,
    target_mismatch: true,
    decision_missing: true,
    unavailable: true,
  }
  const covered = new Set<string>(VERDICT_CASES.map((entry) => entry.verdict?.status ?? "none"))
  for (const status of Object.keys(statuses)) assert.ok(covered.has(status), status)
  const scanVerdicts: Record<ScanVerdict, true> = {
    ideal: true,
    supportive: true,
    mismatch: true,
    unknown: true,
  }
  for (const verdict of Object.keys(scanVerdicts)) {
    assert.ok(
      VERDICT_CASES.some(
        (entry) =>
          entry.verdict?.status === "verdict" &&
          entry.verdict.payload.kind === "in_catalog" &&
          entry.verdict.payload.verdict === verdict,
      ),
      verdict,
    )
  }
})

// --- derivePrepChecklist -----------------------------------------------------------

test("Nomi: research item, missing score, bleach cadence, detangling and shop question — in rule order", () => {
  const input = nomiView()
  const checklist = derivePrepChecklist({
    view: input,
    intakeItems: [{ id: "item-conditioner", barcodeIdentifier: "4005900123456" }],
    callSheet: { baselineScore: null },
    profile: {
      chemicalTreatments: ["bleached"],
      elasticity: "snaps",
      primaryConcern: "dry_lengths",
    },
  })

  assert.deepEqual(
    checklist.map((item) => item.id),
    [
      "research_open:item-conditioner",
      "score_missing",
      "ask_bleach_cadence",
      "ask_detangling",
      "ask_where_she_shops",
    ],
  )
  const research = checklist[0]!
  assert.equal(research.kind, "research_open")
  if (research.kind === "research_open") {
    assert.equal(research.intakeItemId, "item-conditioner")
    assert.equal(research.label, "Label item-conditioner")
    assert.equal(research.category, "conditioner")
    assert.equal(research.gtin, "4005900123456")
  }
  const bleach = checklist[2]!
  assert.equal(bleach.kind === "ask_bleach_cadence" && bleach.treatments.join(), "bleached")
  const detangling = checklist[3]!
  assert.deepEqual(detangling.kind === "ask_detangling" && detangling.triggers, [
    "elasticity_snaps",
  ])
})

test("legacy enrollment: no call-sheet row, no profile, no intake items → score_missing + the standing question", () => {
  const checklist = derivePrepChecklist({ view: view([]) })
  assert.deepEqual(
    checklist.map((item) => item.id),
    ["score_missing", "ask_where_she_shops"],
  )
  assert.deepEqual(
    derivePrepChecklist({ view: view([]), callSheet: null, profile: null }).map((item) => item.id),
    ["score_missing", "ask_where_she_shops"],
  )
})

test("a recorded baseline score clears score_missing", () => {
  const ids = derivePrepChecklist({ view: view([]), callSheet: { baselineScore: 4 } }).map(
    (item) => item.id,
  )
  assert.deepEqual(ids, ["ask_where_she_shops"])
})

test("research_open lists only research_pending entries, never category_unknown or styling", () => {
  const checklist = derivePrepChecklist({
    view: view(
      [],
      [
        unassigned("item-r", "research_pending", "mask"),
        unassigned("item-u", "category_unknown", null),
        unassigned("item-s", "styling_not_evaluated", null),
        unassigned("item-n", "no_ideal_step", "shampoo"),
      ],
    ),
    callSheet: { baselineScore: 7 },
  })
  assert.deepEqual(
    checklist.map((item) => item.id),
    ["research_open:item-r", "ask_where_she_shops"],
  )
  const research = checklist[0]!
  assert.equal(research.kind === "research_open" && research.gtin, null)
})

test("ask_bleach_cadence reads every treatment vocabulary (hair_profiles, snapshot, quiz) and ignores the rest", () => {
  const ask = (chemicalTreatments: string[] | null) =>
    derivePrepChecklist({
      view: view([]),
      callSheet: { baselineScore: 5 },
      profile: { chemicalTreatments },
    }).some((item) => item.id === "ask_bleach_cadence")

  for (const treatment of ["bleached", "lightened", "blondiert", "colored", "gefaerbt"]) {
    assert.equal(ask([treatment]), true, treatment)
  }
  for (const treatment of ["natural", "natur", "permed", "chemically_straightened"]) {
    assert.equal(ask([treatment]), false, treatment)
  }
  assert.equal(ask([]), false)
  assert.equal(ask(null), false)
})

test("ask_detangling fires on „reißt sofort“ (snaps) or a damage-related main concern", () => {
  const detangling = (profile: Parameters<typeof derivePrepChecklist>[0]["profile"]) =>
    derivePrepChecklist({ view: view([]), callSheet: { baselineScore: 5 }, profile }).find(
      (item) => item.kind === "ask_detangling",
    )

  const both = detangling({ elasticity: "snaps", primaryConcern: "breakage" })
  assert.deepEqual(both?.kind === "ask_detangling" && both.triggers, [
    "elasticity_snaps",
    "damage_concern",
  ])
  for (const concern of ["hair_damage", "breakage", "split_ends"] as const) {
    const item = detangling({ elasticity: "stretches_bounces", primaryConcern: concern })
    assert.deepEqual(item?.kind === "ask_detangling" && item.triggers, ["damage_concern"], concern)
    assert.equal(item?.kind === "ask_detangling" && item.primaryConcern, concern)
  }
  assert.equal(
    detangling({ elasticity: "stretches_stays", primaryConcern: "dry_lengths" }),
    undefined,
  )
  assert.equal(detangling({ elasticity: null, primaryConcern: null }), undefined)
  assert.equal(detangling({}), undefined)
})

test("the rule list is the stable, ordered seed of the consult knowledge base", () => {
  assert.deepEqual(
    RUNSHEET_PREP_RULES.map((rule) => rule.id),
    [
      "research_open",
      "score_missing",
      "ask_bleach_cadence",
      "ask_detangling",
      "ask_where_she_shops",
    ],
  )
})
