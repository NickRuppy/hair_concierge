import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import test from "node:test"
import { NextRequest } from "next/server"
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime"
import { renderToStaticMarkup } from "react-dom/server"

import { createDiscoveryDecisionsHandler } from "../src/app/api/admin/beratung/[enrollmentId]/decisions/route"
import {
  DiscoveryCallCockpit,
  discoveryDecisionWriteOutcome,
} from "../src/components/discovery/cockpit/discovery-call-cockpit"
import { DiscoveryRoutineDocument } from "../src/components/discovery/print/discovery-routine-document"
import { discoveryApplicationCandidates } from "../src/lib/discovery/application"
import {
  buildDiscoveryCockpitView,
  discoveryCockpitSwapOptionIds,
  discoveryOwnedProductIdentities,
  discoveryStaleDecisionKeysForUsageChange,
  type DiscoveryCallDecisionInput,
  type DiscoveryCallDecisionResult,
  type DiscoveryCallIntake,
  type DiscoveryCockpitModel,
} from "../src/lib/discovery/cockpit"
import type { DiscoveryIdealStep } from "../src/lib/discovery/load-ideal-routine"
import type { DiscoveryParticipantVerdict } from "../src/lib/discovery/load-participant-verdicts"
import {
  composeDiscoveryRefinedRoutine,
  reduceIntakeItemsToSteps,
  type DiscoveryCallDecision,
  type DiscoveryIntakeItem,
} from "../src/lib/discovery/refined-routine"
import type { ScanCatalogPresentationRow } from "../src/lib/scan/product-presentation"
import type { ScanPresentedVerdictPayload } from "../src/lib/scan/types"

/**
 * Batch 9 (plan `plans/discovery-multi-product/plan.md` Rev. 2): several of her products in
 * one Idealplan step. A same-category product that found no step of its own joins the first
 * step of its category as a further entry — one verdict and one decision per product — and a
 * routine with 0–1 products per step keeps exactly what it printed and fingerprinted before.
 */

export const ids = {
  enrollment: "3f1a6f2e-2b44-4a1e-9a1a-6f2e2b444a1e",
  intake: "40000000-0000-4000-8000-000000000001",
  user: "20000000-0000-4000-8000-000000000002",
  shampooA: "30000000-0000-4000-8000-000000000001",
  shampooB: "30000000-0000-4000-8000-000000000002",
  conditioner: "30000000-0000-4000-8000-000000000003",
  swapShampoo: "30000000-0000-4000-8000-000000000004",
  swapConditioner: "30000000-0000-4000-8000-000000000005",
  idealLeaveIn: "30000000-0000-4000-8000-000000000006",
  swapShampooTwo: "30000000-0000-4000-8000-000000000007",
  itemA: "50000000-0000-4000-8000-000000000001",
  itemB: "50000000-0000-4000-8000-000000000002",
  itemCond: "50000000-0000-4000-8000-000000000003",
}

export function step(
  overrides: Partial<DiscoveryIdealStep> & Pick<DiscoveryIdealStep, "decisionKey" | "category">,
): DiscoveryIdealStep {
  return {
    role: "shampoo_everyday",
    section: "basis",
    categoryLabel: "Shampoo",
    roleLabel: "Hauptreinigung",
    roleDescription: "Regelmäßige Reinigung für deine Kopfhaut.",
    frequencyLabel: "3× / Woche",
    preview: null,
    ...overrides,
  }
}

export const SH = "decision:shampoo:shampoo_everyday:gap"
export const COND = "decision:conditioner:conditioner_rinse_out:gap"
export const LEAVE = "decision:leave_in:post_wash_leave_in:gap"

export const shampooStep = step({ decisionKey: SH, category: "shampoo" })
export const conditionerStep = step({
  decisionKey: COND,
  category: "conditioner",
  role: "conditioner_rinse_out",
  categoryLabel: "Conditioner",
  roleLabel: "Pflege nach der Reinigung",
  roleDescription: "Pflegt und entwirrt die Längen nach der Haarwäsche.",
  frequencyLabel: "nach jeder Wäsche",
})
export const leaveInStep = step({
  decisionKey: LEAVE,
  category: "leave_in",
  role: "post_wash_leave_in",
  categoryLabel: "Leave-in",
  roleLabel: "Pflege ohne Ausspülen",
  roleDescription: "Gibt den Längen Pflege, die im Haar bleibt.",
  frequencyLabel: "nach jeder Wäsche",
  preview: {
    kind: "recommendation",
    category: "leave_in",
    role: "post_wash_leave_in",
    decisionKey: LEAVE,
    productId: ids.idealLeaveIn,
    productName: "Garnier Fructis Hair Food Leave-in",
    imageUrl: "https://catalog.example/leave-in.jpg",
    verdict: "ideal",
    authorityVersion: "v1",
    factFingerprint: "fp",
    commerce: {
      priceEur: null,
      purchaseLinkStatus: null,
      netContentValue: null,
      netContentUnit: null,
      priceLabel: null,
      netContentLabel: null,
      availabilityLabel: null,
      productUrl: null,
      affiliateDisclosure: null,
    },
    reasoning: { productCriteria: "Leicht.", fit: "Passt.", frequency: "nach jeder Wäsche" },
  },
})

export const STEPS = [shampooStep, conditionerStep, leaveInStep]

export function item(
  overrides: Partial<DiscoveryIntakeItem> & Pick<DiscoveryIntakeItem, "id">,
): DiscoveryIntakeItem {
  return {
    category: "shampoo",
    source: "catalog_search",
    brandText: null,
    productNameText: null,
    barcodeIdentifier: null,
    productId: null,
    productSubmissionId: null,
    createdAt: "2026-09-20T10:00:00.000Z",
    ...overrides,
  }
}

/** Her first shampoo (captured first, so the first pass binds it) — used twice a week. */
export const shampooA = item({
  id: ids.itemA,
  productId: ids.shampooA,
  brandText: "Elvital",
  productNameText: "Hyaluron Pure",
  frequency: "weekly_2x",
})
/** Her second shampoo — used more often, so it is listed first in the step. */
export const shampooB = item({
  id: ids.itemB,
  productId: ids.shampooB,
  brandText: "Balea",
  productNameText: "Repair Shampoo",
  createdAt: "2026-09-20T11:00:00.000Z",
  frequency: "weekly_3_4x",
})
export const conditioner = item({
  id: ids.itemCond,
  category: "conditioner",
  productId: ids.conditioner,
  brandText: "Gliss Kur",
  productNameText: "Aqua Revive Spülung",
  createdAt: "2026-09-20T10:01:00.000Z",
})

export function catalogRow(id: string, name: string, brand: string, category: string) {
  return {
    id,
    name,
    brand,
    category,
    imageUrl: null,
    priceEur: null,
    currency: null,
    affiliateLink: null,
    purchaseLinkStatus: null,
    priceCheckedAt: null,
  } as ScanCatalogPresentationRow
}

const SWAP_ROWS = [
  catalogRow(ids.swapShampoo, "Leichte Frische Shampoo", "Guhl", "shampoo"),
  catalogRow(ids.swapShampooTwo, "Mildes Shampoo", "Alverde", "shampoo"),
  catalogRow(ids.swapConditioner, "Feuchtigkeit & Glanz Spülung", "Guhl", "conditioner"),
]

function payloadWith(alternatives: string[]): ScanPresentedVerdictPayload {
  return {
    kind: "in_catalog",
    verdict: "supportive",
    verdictLabel: "Passt mit Einschränkung",
    verdictTitle: "Passt mit Einschränkung zu deinem Haar",
    status: "pending",
    subtitle: "2 von 3 Zielbereichen getroffen",
    evaluatedRole: "shampoo_everyday",
    evaluatedRoleLabel: "Hauptreinigung",
    dimensions: [],
    criteria: [],
    coverage: null,
    fitNarrative: null,
    alternatives: alternatives.map((productId) => ({
      productId,
      displayName: SWAP_ROWS.find((row) => row.id === productId)?.name ?? productId,
      imageUrl: null,
      priceLabel: null,
      netContentLabel: null,
      verdict: "ideal",
      verdictLabel: "Passt",
      brand: SWAP_ROWS.find((row) => row.id === productId)?.brand ?? null,
      purchaseUrl: null,
    })),
  }
}

function verdictFor(
  entry: DiscoveryIntakeItem,
  name: string,
  alternatives: string[],
): DiscoveryParticipantVerdict {
  return {
    itemId: entry.id,
    productId: entry.productId!,
    status: "verdict",
    product: {
      productId: entry.productId!,
      name,
      brand: entry.brandText,
      category: entry.category!,
      categoryLabel: "Shampoo",
      imageUrl: null,
      priceLabel: null,
      purchaseUrl: null,
    },
    payload: payloadWith(alternatives),
  }
}

export const VERDICTS: DiscoveryParticipantVerdict[] = [
  verdictFor(shampooA, "Hyaluron Pure Shampoo", [ids.swapShampoo, ids.swapShampooTwo]),
  verdictFor(shampooB, "Repair Shampoo", [ids.swapShampoo, ids.swapShampooTwo]),
  verdictFor(conditioner, "Aqua Revive Spülung", [ids.swapConditioner]),
]

export function modelOf(
  items: DiscoveryIntakeItem[],
  decisions: DiscoveryCallDecision[] = [],
  steps: DiscoveryIdealStep[] = STEPS,
): DiscoveryCockpitModel {
  const verdicts = VERDICTS.filter((verdict) => items.some((entry) => entry.id === verdict.itemId))
  const used = new Set(
    decisions.flatMap((entry) => (entry.swapProductId ? [entry.swapProductId] : [])),
  )
  return {
    status: "ready",
    steps,
    verdicts,
    previewSource: { personalPlanId: `discovery:${ids.intake}`, sourceNeedVersionId: "v1" },
    routine: composeDiscoveryRefinedRoutine({
      steps,
      items,
      decisions,
      swapProducts: SWAP_ROWS.filter((row) => used.has(row.id)),
      recommendationProducts: [
        catalogRow(ids.idealLeaveIn, "Fructis Hair Food Leave-in", "Garnier", "leave_in"),
      ],
      ownedProducts: discoveryOwnedProductIdentities(verdicts),
    }),
    recommendationProducts: [
      catalogRow(ids.idealLeaveIn, "Fructis Hair Food Leave-in", "Garnier", "leave_in"),
    ],
    recommendationBrandsAvailable: true,
  }
}

function keep(decisionKey: string, intakeItemId: string | null): DiscoveryCallDecision {
  return { decisionKey, decision: "keep", swapProductId: null, intakeItemId }
}

function swap(
  decisionKey: string,
  intakeItemId: string | null,
  swapProductId: string,
): DiscoveryCallDecision {
  return { decisionKey, decision: "swap", swapProductId, intakeItemId }
}

/** A call with one product per step: what every legacy (pre-batch-9) sheet looked like. */
export const SINGLE_ITEMS = [shampooA, conditioner]
export const SINGLE_DECISIONS = [keep(SH, ids.itemA), swap(COND, ids.itemCond, ids.swapConditioner)]

function renderDocument(model: DiscoveryCockpitModel): string {
  return renderToStaticMarkup(
    <DiscoveryRoutineDocument
      name="Lena M."
      view={buildDiscoveryCockpitView(model)}
      finalizedAt="2026-09-22T12:00:00.000Z"
    />,
  )
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex")
}

/**
 * Re-pinned in the verdict-layer fix wave (P1): the recommendation's `commerce` (price,
 * availability, link) left the fingerprint, so every routine with a recommendation preview moved
 * once — an accepted one-time drift for finalized sheets. Previous pin: e21b1bc4…0c4c0.
 */
const SINGLE_HASH = "69f9974079d8f4fcd7c049402ea22d0f35f45c9adfd33f8cb1fd2fa992781e0d"
const SINGLE_PDF_SHA = "038e9e0a87cab9411d1275f4b4855f9981cfaa2756058d3fd9d79125e9f2d812"

// --- D1: binding ------------------------------------------------------------------------

function entriesOf(items: DiscoveryIntakeItem[], steps: DiscoveryIdealStep[] = STEPS) {
  const reduction = reduceIntakeItemsToSteps(steps, items)
  return {
    bindings: reduction.bindings.map((binding) => [
      binding.step.decisionKey,
      binding.item?.id ?? null,
    ]),
    unassigned: reduction.unassignedIntakeProducts.map((entry) => [entry.item.id, entry.reason]),
  }
}

test("two shampoos share the one shampoo step as two adjacent entries, most frequent first", () => {
  const { bindings, unassigned } = entriesOf([shampooA, shampooB, conditioner])
  assert.deepEqual(bindings, [
    [SH, ids.itemB],
    [SH, ids.itemA],
    [COND, ids.itemCond],
    [LEAVE, null],
  ])
  assert.deepEqual(unassigned, [])
})

test("entry order: known frequency descending, unknown/unasked after, then the binding order", () => {
  const unasked = item({ id: "sh-unasked", productId: "p-unasked" })
  const dunno = item({
    id: "sh-dunno",
    productId: "p-dunno",
    source: "barcode",
    frequency: "unknown",
    createdAt: "2026-09-20T12:00:00.000Z",
  })
  const daily = item({
    id: "sh-daily",
    productId: "p-daily",
    frequency: "daily_1x",
    createdAt: "2026-09-20T13:00:00.000Z",
  })
  const { bindings } = entriesOf([unasked, dunno, daily, shampooA])
  assert.deepEqual(
    bindings.filter(([key]) => key === SH).map(([, id]) => id),
    // daily > 2×/week; then the binding order (barcode before catalog) for the unknown ones.
    ["sh-daily", ids.itemA, "sh-dunno", "sh-unasked"],
  )
})

const OIL_PRE = "decision:oil:pre_wash_fibre_treatment:gap"
const OIL_DRY = "decision:oil:dry_finish:gap"
const OIL_STEPS = [
  step({ decisionKey: OIL_PRE, category: "oil", role: "pre_wash_fibre_treatment" }),
  step({ decisionKey: OIL_DRY, category: "oil", role: "dry_finish" }),
]

test("a role-bound leftover joins its own role step; a role or category without a step stays outside", () => {
  const oil = (id: string, overrides: Partial<DiscoveryIntakeItem> = {}) =>
    item({ id, category: "oil", productId: `p-${id}`, ...overrides })
  const { bindings, unassigned } = entriesOf(
    [
      oil("dry-1", { usageRole: "dry_finish" }),
      oil("dry-2", { usageRole: "dry_finish", createdAt: "2026-09-20T11:00:00.000Z" }),
      // No damp-hair oil step in this Idealplan.
      oil("damp", { usageRole: "leave_on_fibre_conditioning" }),
      oil("plain-1", { createdAt: "2026-09-20T09:00:00.000Z" }),
      oil("plain-2", { createdAt: "2026-09-20T09:30:00.000Z" }),
      // No mask step at all.
      item({ id: "mask", category: "mask", productId: "p-mask" }),
    ],
    OIL_STEPS,
  )
  assert.deepEqual(bindings, [
    // A role-less leftover joins the FIRST step of its category.
    [OIL_PRE, "plain-1"],
    [OIL_PRE, "plain-2"],
    [OIL_DRY, "dry-1"],
    [OIL_DRY, "dry-2"],
  ])
  assert.deepEqual(unassigned, [
    ["damp", "no_ideal_step"],
    ["mask", "no_ideal_step"],
  ])
})

// --- D2/D3: composition and fingerprint ----------------------------------------------------

test("each product carries its own decision: keep one, drop the other; nothing else moves", () => {
  const routine = composeDiscoveryRefinedRoutine({
    steps: STEPS,
    items: [shampooA, shampooB],
    decisions: [
      keep(SH, ids.itemA),
      { decisionKey: SH, decision: "drop", swapProductId: null, intakeItemId: ids.itemB },
    ],
    swapProducts: [],
  })
  assert.deepEqual(
    routine.steps.map((entry) => [entry.step.decisionKey, entry.item?.id ?? null, entry.outcome]),
    [
      [SH, ids.itemB, "dropped"],
      [SH, ids.itemA, "kept"],
      [COND, null, "ideal"],
      [LEAVE, null, "ideal"],
    ],
  )
  assert.deepEqual(routine.unassignedIntakeProducts, [])
})

test("undecided extras stay undecided — a decision about one product never carries to its sibling", () => {
  const routine = composeDiscoveryRefinedRoutine({
    steps: STEPS,
    items: [shampooA, shampooB],
    decisions: [swap(SH, ids.itemA, ids.swapShampoo)],
    swapProducts: [SWAP_ROWS[0]!],
  })
  const shampoo = routine.steps.filter((entry) => entry.step.decisionKey === SH)
  assert.deepEqual(
    shampoo.map((entry) => [entry.item?.id, entry.outcome, entry.swapProductId]),
    [
      [ids.itemB, "undecided", null],
      [ids.itemA, "swapped", ids.swapShampoo],
    ],
  )
})

test("a null-item decision applies only while its step is empty (P2-1)", () => {
  const onEmpty = composeDiscoveryRefinedRoutine({
    steps: STEPS,
    items: [],
    decisions: [swap(SH, null, ids.swapShampoo)],
    swapProducts: [SWAP_ROWS[0]!],
  })
  assert.equal(onEmpty.steps[0]!.outcome, "swapped")

  // A product binds there later: the old empty-step decision is inert, the product undecided.
  const bound = composeDiscoveryRefinedRoutine({
    steps: STEPS,
    items: [shampooA],
    decisions: [swap(SH, null, ids.swapShampoo)],
    swapProducts: [SWAP_ROWS[0]!],
  })
  assert.deepEqual(
    bound.steps.filter((entry) => entry.step.decisionKey === SH).map((entry) => entry.outcome),
    ["undecided"],
  )
})

test("a routine with one product per step keeps its pre-batch-9 fingerprint (pinned)", () => {
  assert.equal(modelOf(SINGLE_ITEMS, SINGLE_DECISIONS).routine.sourceHash, SINGLE_HASH)
})

test("a routine with a same-category extra fingerprints differently — on purpose", () => {
  const withExtra = modelOf([...SINGLE_ITEMS, shampooB], SINGLE_DECISIONS)
  assert.notEqual(withExtra.routine.sourceHash, SINGLE_HASH)
})

// --- usage changes: set-based stale keys -----------------------------------------------------

test("a usage change stales every step whose SET of products changes, siblings included", () => {
  const model = modelOf([shampooA, shampooB, conditioner])
  // Her second shampoo is really a conditioner: the shampoo step loses one, the conditioner
  // step gains one — both are re-decided.
  assert.deepEqual(
    discoveryStaleDecisionKeysForUsageChange(model, {
      itemId: ids.itemB,
      category: "conditioner",
      role: null,
      productType: null,
    }),
    [COND, SH].sort(),
  )
  // A move into a category without a step: only the step it left.
  assert.deepEqual(
    discoveryStaleDecisionKeysForUsageChange(model, {
      itemId: ids.itemA,
      category: "mask",
      role: null,
      productType: null,
    }),
    [SH],
  )
})

// --- D4: the cockpit view ---------------------------------------------------------------

test("the view: one entry per product, its frequency, the step's size and who may be dropped", () => {
  const view = buildDiscoveryCockpitView(
    modelOf(
      [shampooA, shampooB, conditioner],
      [{ decisionKey: SH, decision: "drop", swapProductId: null, intakeItemId: ids.itemB }],
    ),
  )
  assert.deepEqual(
    view.steps.map((entry) => [
      entry.decisionKey,
      entry.intakeItemId,
      entry.stepEntryCount,
      entry.canDrop,
      entry.ownedFrequencyLabel,
    ]),
    [
      [SH, ids.itemB, 2, true, "3–4× pro Woche"],
      // Its sibling is dropped: dropping this one too would leave the step empty.
      [SH, ids.itemA, 2, false, "2× pro Woche"],
      [COND, ids.itemCond, 1, false, null],
      [LEAVE, null, 1, false, null],
    ],
  )
  assert.deepEqual(discoveryCockpitSwapOptionIds(view, SH, ids.itemA), [
    ids.swapShampoo,
    ids.swapShampooTwo,
  ])
  assert.equal(
    discoveryCockpitSwapOptionIds(view, SH, "50000000-0000-4000-8000-0000000000ff"),
    null,
  )
})

test("the Idealplan fallback is never offered when she owns that product anywhere in the step", () => {
  const ideal = catalogRow(ids.swapShampoo, "Leichte Frische Shampoo", "Guhl", "shampoo")
  const leaveInPick = leaveInStep.preview
  assert.equal(leaveInPick?.kind, "recommendation")
  const withPick = step({
    decisionKey: SH,
    category: "shampoo",
    preview: {
      ...(leaveInPick as Extract<typeof leaveInPick, { kind: "recommendation" }>),
      category: "shampoo",
      role: "shampoo_everyday",
      decisionKey: SH,
      productId: ideal.id,
    },
  })
  const owned = item({
    id: "owns-ideal",
    productId: ideal.id,
    createdAt: "2026-09-20T12:00:00.000Z",
  })
  const plain = item({ id: "no-verdict", productId: "p-plain" })
  const model = modelOf([plain, owned], [], [withPick])
  const view = buildDiscoveryCockpitView({ ...model, verdicts: [] })
  for (const entry of view.steps) assert.deepEqual(entry.swapOptions, [])
})

// --- D2: the decisions route ----------------------------------------------------------------

const submittedIntake: DiscoveryCallIntake = {
  id: ids.intake,
  enrollmentId: ids.enrollment,
  userId: ids.user,
  state: "submitted",
  submittedAt: "2026-09-20T18:41:00.000Z",
  callFinalizedAt: null,
  finalizedSourceHash: null,
}

function decisionRoute(
  model: DiscoveryCockpitModel,
  answer: (input: DiscoveryCallDecisionInput) => DiscoveryCallDecisionResult = (input) => ({
    outcome: "stored",
    decision: {
      decisionKey: input.decisionKey,
      decision: input.decision,
      swapProductId: input.swapProductId,
      intakeItemId: input.intakeItemId,
    },
  }),
) {
  const written: DiscoveryCallDecisionInput[] = []
  const handler = createDiscoveryDecisionsHandler({
    flagEnabled: () => true,
    requireAdmin: async () => ({ userId: "admin-1" }),
    createAdminClient: () => ({}) as never,
    loadIntake: async () => submittedIntake,
    loadModel: async () => model,
    setDecision: async (input: DiscoveryCallDecisionInput) => {
      written.push(input)
      return answer(input)
    },
  })
  const post = async (body: unknown) => {
    const response = await handler(
      new NextRequest(`https://chaarlie.de/api/admin/beratung/${ids.enrollment}/decisions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
      { params: Promise.resolve({ enrollmentId: ids.enrollment }) },
    )
    const json = (await response.json()) as { code?: string }
    return { status: response.status, code: json.code }
  }
  return { post, written }
}

const TWO_SHAMPOOS = () => modelOf([shampooA, shampooB, conditioner])

test("route: the client names (step, product); the server writes it with the step's siblings", async () => {
  const { post, written } = decisionRoute(TWO_SHAMPOOS())
  assert.equal(
    (await post({ decisionKey: SH, intakeItemId: ids.itemA, decision: "keep" })).status,
    200,
  )
  assert.equal(
    (
      await post({
        decisionKey: SH,
        intakeItemId: ids.itemB,
        decision: "swap",
        swapProductId: ids.swapShampooTwo,
      })
    ).status,
    200,
  )
  assert.equal(
    (await post({ decisionKey: SH, intakeItemId: ids.itemB, decision: "drop" })).status,
    200,
  )
  assert.deepEqual(written, [
    {
      intakeId: ids.intake,
      decisionKey: SH,
      decision: "keep",
      swapProductId: null,
      intakeItemId: ids.itemA,
      siblings: [{ itemId: ids.itemB, category: "shampoo", usageRole: null }],
      expectedCategory: "shampoo",
      expectedUsageRole: null,
    },
    {
      intakeId: ids.intake,
      decisionKey: SH,
      decision: "swap",
      swapProductId: ids.swapShampooTwo,
      intakeItemId: ids.itemB,
      siblings: [{ itemId: ids.itemA, category: "shampoo", usageRole: null }],
      expectedCategory: "shampoo",
      expectedUsageRole: null,
    },
    {
      intakeId: ids.intake,
      decisionKey: SH,
      decision: "drop",
      swapProductId: null,
      intakeItemId: ids.itemB,
      siblings: [{ itemId: ids.itemA, category: "shampoo", usageRole: null }],
      expectedCategory: "shampoo",
      expectedUsageRole: null,
    },
  ])
})

test("route: an old tab without intakeItemId works for a single-product step only", async () => {
  const { post, written } = decisionRoute(TWO_SHAMPOOS())
  const single = await post({ decisionKey: COND, decision: "keep" })
  assert.equal(single.status, 200)
  assert.equal(written[0]!.intakeItemId, ids.itemCond)
  assert.deepEqual(written[0]!.siblings, [])
  assert.equal(written[0]!.expectedCategory, "conditioner")
  // An empty step: the one entry with no product — and no usage to re-check.
  assert.equal((await post({ decisionKey: LEAVE, decision: "keep" })).status, 200)
  assert.equal(written[1]!.intakeItemId, null)
  assert.equal(written[1]!.expectedCategory, null)
  assert.equal(written[1]!.expectedUsageRole, null)

  const ambiguous = await post({ decisionKey: SH, decision: "keep" })
  assert.deepEqual(ambiguous, { status: 409, code: "item_required" })
  assert.equal(written.length, 2)
})

test("route: a product that is not in that step, an unknown step, a foreign swap target are refused", async () => {
  const { post, written } = decisionRoute(TWO_SHAMPOOS())
  assert.deepEqual(await post({ decisionKey: SH, intakeItemId: ids.itemCond, decision: "keep" }), {
    status: 409,
    code: "unknown_item",
  })
  assert.deepEqual(
    await post({ decisionKey: "decision:mask:x:gap", intakeItemId: null, decision: "keep" }),
    { status: 400, code: "unknown_decision_key" },
  )
  assert.deepEqual(
    await post({
      decisionKey: COND,
      intakeItemId: ids.itemCond,
      decision: "swap",
      swapProductId: ids.swapShampoo,
    }),
    { status: 400, code: "swap_not_offered" },
  )
  assert.equal(written.length, 0)
})

test("route: „Weglassen“ only in a step with ≥2 products, and never the last one", async () => {
  const { post, written } = decisionRoute(
    modelOf(
      [shampooA, shampooB, conditioner],
      [{ decisionKey: SH, decision: "drop", swapProductId: null, intakeItemId: ids.itemB }],
    ),
  )
  assert.deepEqual(
    await post({ decisionKey: COND, intakeItemId: ids.itemCond, decision: "drop" }),
    {
      status: 409,
      code: "drop_single",
    },
  )
  assert.deepEqual(await post({ decisionKey: LEAVE, intakeItemId: null, decision: "drop" }), {
    status: 409,
    code: "drop_single",
  })
  assert.deepEqual(await post({ decisionKey: SH, intakeItemId: ids.itemA, decision: "drop" }), {
    status: 409,
    code: "drop_last",
  })
  assert.equal(written.length, 0)
  assert.deepEqual(
    await post({
      decisionKey: SH,
      intakeItemId: ids.itemA,
      decision: "drop",
      swapProductId: ids.swapShampoo,
    }),
    { status: 400, code: "invalid_body" },
  )
})

test("route: the locked write's own refusals come back as 409s", async () => {
  for (const outcome of ["drop_last", "swap_taken", "finalized", "stale_binding"] as const) {
    const { post } = decisionRoute(TWO_SHAMPOOS(), () => ({ outcome }))
    assert.deepEqual(await post({ decisionKey: SH, intakeItemId: ids.itemA, decision: "keep" }), {
      status: 409,
      code: outcome,
    })
  }
})

// --- D5: application candidates ------------------------------------------------------------

test("application: the step's first entry keeps the decision key, a further one its own id", () => {
  const model = modelOf(
    [shampooA, shampooB, conditioner],
    [keep(SH, ids.itemA), swap(SH, ids.itemB, ids.swapShampoo), keep(COND, ids.itemCond)],
  )
  const candidates = discoveryApplicationCandidates(model.routine)
  assert.deepEqual(
    candidates.map((entry) => [
      entry.itemId,
      entry.applicationInstanceKey,
      entry.productId,
      entry.routineOrder,
    ]),
    [
      [SH, SH, ids.swapShampoo, 0],
      [`${SH}#${ids.itemA}`, `${SH}#${ids.itemA}`, ids.shampooA, 1],
      [COND, COND, ids.conditioner, 2],
      [LEAVE, LEAVE, ids.idealLeaveIn, 3],
    ],
  )
})

test("application: a dropped product prints nothing; two entries printing one product print it once", () => {
  const dropped = modelOf(
    [shampooA, shampooB],
    [
      keep(SH, ids.itemA),
      { decisionKey: SH, decision: "drop", swapProductId: null, intakeItemId: ids.itemB },
    ],
  )
  assert.deepEqual(
    discoveryApplicationCandidates(dropped.routine).map((entry) => entry.productId),
    [ids.shampooA, ids.idealLeaveIn],
  )
  // She keeps shampoo A, and her other shampoo is swapped to that very product.
  const twice = modelOf(
    [shampooA, shampooB],
    [keep(SH, ids.itemA), { ...swap(SH, ids.itemB, ids.shampooA) }],
  )
  const rows = discoveryApplicationCandidates({
    steps: twice.routine.steps.map((entry) =>
      entry.item?.id === ids.itemB
        ? {
            ...entry,
            swapProduct: catalogRow(ids.shampooA, "Hyaluron Pure Shampoo", "Elvital", "shampoo"),
            swapProductLabel: "Elvital Hyaluron Pure Shampoo",
          }
        : entry,
    ),
  })
  assert.deepEqual(
    rows.filter((entry) => entry.category === "shampoo").map((entry) => entry.productId),
    [ids.shampooA],
  )
})

// --- D5: the participant's sheet -----------------------------------------------------------

test("PDF: a single-product routine prints byte-identically to before (pinned)", () => {
  assert.equal(sha256(renderDocument(modelOf(SINGLE_ITEMS, SINGLE_DECISIONS))), SINGLE_PDF_SHA)
})

test("PDF: one step, her products in it — kept, swapped or open — each with her frequency", () => {
  const markup = renderDocument(
    modelOf(
      [shampooA, shampooB, conditioner],
      [swap(SH, ids.itemB, ids.swapShampoo), keep(COND, ids.itemCond)],
    ),
  )
  // Still three numbered steps.
  assert.equal(markup.split('class="dcp-num"').length - 1, 3)
  assert.ok(markup.includes("3 Schritte"))
  assert.ok(markup.includes("Guhl Leichte Frische Shampoo"))
  assert.ok(markup.includes(" · 3–4× pro Woche"))
  // Her undecided shampoo is „Noch offen" inside the step, not „Brauchst du nicht mehr".
  assert.ok(markup.includes("Noch offen – Empfehlung folgt"))
  assert.ok(!markup.includes("Brauchst du nicht mehr"))
  // The shelf lists both shampoos.
  assert.ok(markup.includes("3 Produkte in deiner Routine"))
})

test("PDF: only an explicit drop files a same-category product under „Brauchst du nicht mehr“", () => {
  const markup = renderDocument(
    modelOf(
      [shampooA, shampooB, conditioner],
      [
        keep(SH, ids.itemA),
        { decisionKey: SH, decision: "drop", swapProductId: null, intakeItemId: ids.itemB },
        keep(COND, ids.itemCond),
      ],
    ),
  )
  assert.ok(markup.includes("Brauchst du nicht mehr"))
  const dropSection = markup.slice(markup.indexOf("Brauchst du nicht mehr"))
  assert.ok(dropSection.includes("Balea Repair Shampoo"))
  // One product left in the step: printed as before, without a frequency to tell apart.
  assert.ok(!markup.includes(" · 2× pro Woche"))
  // The dropped one is not on the shelf.
  assert.ok(markup.includes("2 Produkte in deiner Routine — 2 bleiben."))
})

test("PDF: two different products with the same printed name both print (dedupe is by product id)", () => {
  const model = modelOf(
    [shampooA, shampooB],
    [swap(SH, ids.itemA, ids.swapShampoo), swap(SH, ids.itemB, ids.swapShampooTwo)],
  )
  const view = buildDiscoveryCockpitView(model)
  const sameName = {
    ...view,
    steps: view.steps.map((entry) =>
      entry.intakeItemId === ids.itemB
        ? { ...entry, swapProductLabel: "Guhl Leichte Frische Shampoo" }
        : entry,
    ),
  }
  const markup = renderToStaticMarkup(
    <DiscoveryRoutineDocument name="Lena M." view={sameName} finalizedAt={null} />,
  )
  const routine = markup.slice(0, markup.indexOf("Deine bisherigen Produkte"))
  assert.equal(routine.split("Guhl Leichte Frische Shampoo").length - 1, 2)
})

test("PDF: two entries printing the same product print it once", () => {
  const model = modelOf(
    [shampooA, shampooB],
    [swap(SH, ids.itemA, ids.swapShampoo), swap(SH, ids.itemB, ids.swapShampooTwo)],
  )
  const view = buildDiscoveryCockpitView(model)
  const same = {
    ...view,
    steps: view.steps.map((entry) =>
      entry.intakeItemId === ids.itemB
        ? {
            ...entry,
            swapProductId: ids.swapShampoo,
            swapProductLabel: "Guhl Leichte Frische Shampoo",
          }
        : entry,
    ),
  }
  const markup = renderToStaticMarkup(
    <DiscoveryRoutineDocument name="Lena M." view={same} finalizedAt={null} />,
  )
  const routine = markup.slice(0, markup.indexOf("Deine bisherigen Produkte"))
  assert.equal(routine.split("Guhl Leichte Frische Shampoo").length - 1, 1)
})

// --- D4: the cockpit ------------------------------------------------------------------------

function renderCockpit(model: DiscoveryCockpitModel): string {
  const router = { refresh() {}, push() {}, replace() {}, prefetch() {}, back() {}, forward() {} }
  return renderToStaticMarkup(
    <AppRouterContext.Provider value={router as never}>
      <DiscoveryCallCockpit
        enrollmentId={ids.enrollment}
        steps={buildDiscoveryCockpitView(model).steps}
        submitted
        initialFinalizedAt={null}
      />
    </AppRouterContext.Provider>,
  )
}

test("cockpit: two products in one step, each with its own radio group, „Weglassen“ only there", () => {
  const markup = renderCockpit(modelOf([shampooA, shampooB, conditioner], [keep(SH, ids.itemA)]))
  const names = [...markup.matchAll(/<input type="radio"[^>]*name="([^"]+)"/g)].map(
    (match) => match[1],
  )
  const groups = [...new Set(names)]
  assert.deepEqual(groups, [
    `decision-${SH}:${ids.itemB}`,
    `decision-${SH}:${ids.itemA}`,
    `decision-${COND}:${ids.itemCond}`,
    `decision-${LEAVE}:-`,
  ])
  // Runsheet (consult-runsheet T3): entries are filed per product into the buckets, each
  // carrying its step anchor — the step's role label once per entry of the step.
  assert.equal(markup.split(">Hauptreinigung<").length - 1, 2)
  // „Weglassen" is offered on the two shampoo entries only (the bucket heading aside).
  assert.equal(markup.split('value="drop"').length - 1, 2)
  assert.ok(markup.includes("3–4× pro Woche"))
  assert.ok(markup.includes("2× pro Woche"))
  // Her kept shampoo A is checked; B is undecided — independent selections.
  const checkedKeep = [...markup.matchAll(/name="([^"]+)" checked="" value="keep"/g)].map(
    (match) => match[1],
  )
  assert.deepEqual(checkedKeep, [`decision-${SH}:${ids.itemA}`])
})

test("cockpit: a single-product step shows no „Weglassen“ and no frequency line", () => {
  const markup = renderCockpit(modelOf(SINGLE_ITEMS, SINGLE_DECISIONS))
  // No „Weglassen" choice (the runsheet's bucket heading is not one).
  assert.ok(!markup.includes('value="drop"'))
  assert.ok(!markup.includes("2× pro Woche"))
})

test("cockpit: a dropped entry starts selected on „Weglassen“; the refusals read as write errors", () => {
  const markup = renderCockpit(
    modelOf(
      [shampooA, shampooB],
      [{ decisionKey: SH, decision: "drop", swapProductId: null, intakeItemId: ids.itemB }],
    ),
  )
  assert.match(markup, new RegExp(`name="decision-${SH}:${ids.itemB}" checked="" value="drop"`))
  // Its sibling may not follow: that would empty the step.
  assert.match(
    markup,
    new RegExp(`disabled="" [^>]*name="decision-${SH}:${ids.itemA}" value="drop"`),
  )
  assert.equal(discoveryDecisionWriteOutcome(false, { code: "drop_last" }).rollback, true)
})

test("route: each sibling travels with its OWN composed usage — raw roles may differ in one step", async () => {
  const preWash = item({
    id: "50000000-0000-4000-8000-0000000000c1",
    category: "conditioner",
    productId: "30000000-0000-4000-8000-0000000000c1",
    usageRole: "pre_wash_conditioner",
    createdAt: "2026-09-20T12:00:00.000Z",
  })
  const { post, written } = decisionRoute(modelOf([conditioner, preWash]))
  const response = await post({ decisionKey: COND, intakeItemId: ids.itemCond, decision: "drop" })
  assert.equal(response.status, 200)
  assert.deepEqual(written[0]!.siblings, [
    { itemId: preWash.id, category: "conditioner", usageRole: "pre_wash_conditioner" },
  ])
  assert.equal(written[0]!.expectedCategory, "conditioner")
  assert.equal(written[0]!.expectedUsageRole, null)
})
