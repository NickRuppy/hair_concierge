import assert from "node:assert/strict"
import test from "node:test"
import { renderToStaticMarkup } from "react-dom/server"

import { createDiscoveryCockpitPage } from "../src/app/admin/beratung/[enrollmentId]/page"
import { DiscoveryRoutineDocument } from "../src/components/discovery/print/discovery-routine-document"
import {
  buildDiscoveryCockpitView,
  type DiscoveryCallIntake,
  type DiscoveryCockpitModel,
} from "../src/lib/discovery/cockpit"
import type { DiscoveryEnrollment } from "../src/lib/discovery/enrollment"
import type { DiscoveryIdealStep } from "../src/lib/discovery/load-ideal-routine"
import type { ScanCatalogPresentationRow } from "../src/lib/scan/product-presentation"
import {
  composeDiscoveryRefinedRoutine,
  type DiscoveryIntakeItem,
} from "../src/lib/discovery/refined-routine"

/**
 * A submitted checklist no longer has to cover all ten categories: whatever the
 * participant never touched stays unanswered — no row at all. This follows one such
 * intake through the whole read side: the reduction, the finalize fingerprint, the
 * cockpit (which names the gaps so the call can ask) and the participant's document
 * (which must read like any other).
 */

const ids = {
  enrollment: "3f1a6f2e-2b44-4a1e-9a1a-6f2e2b444a1e",
  intake: "40000000-0000-4000-8000-000000000001",
  user: "20000000-0000-4000-8000-000000000002",
  shampoo: "30000000-0000-4000-8000-000000000003",
  ideal: "30000000-0000-4000-8000-00000000000c",
  shampooItem: "50000000-0000-4000-8000-000000000005",
  oilItem: "50000000-0000-4000-8000-000000000007",
}

function step(
  category: DiscoveryIdealStep["category"],
  overrides: Partial<DiscoveryIdealStep> = {},
): DiscoveryIdealStep {
  return {
    decisionKey: `decision:${category}:role:gap`,
    category,
    role: "shampoo_everyday",
    section: "basis",
    categoryLabel: category,
    roleLabel: `${category} role`,
    roleDescription: `${category} description`,
    frequencyLabel: "1× / Woche",
    preview: null,
    ...overrides,
  }
}

const leaveInStep = step("leave_in", {
  decisionKey: "decision:leave_in:post_wash_leave_in:gap",
  categoryLabel: "Leave-in",
  preview: {
    kind: "recommendation",
    category: "leave_in",
    role: "post_wash_leave_in",
    decisionKey: "decision:leave_in:post_wash_leave_in:gap",
    productId: ids.ideal,
    productName: "Fructis Hair Food Leave-in",
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

// Shampoo is answered with a product, oil with „benutze ich nicht"; leave-in and mask are
// never touched, and neither are the six categories without a step.
const steps = [step("shampoo"), leaveInStep, step("mask"), step("oil")]

const items: DiscoveryIntakeItem[] = [
  {
    id: ids.shampooItem,
    category: "shampoo",
    source: "catalog_search",
    brandText: "Elvital",
    productNameText: "Hyaluron Pure",
    barcodeIdentifier: null,
    productId: ids.shampoo,
    productSubmissionId: null,
    createdAt: "2026-09-20T10:00:00.000Z",
  },
  {
    id: ids.oilItem,
    category: "oil",
    source: "none",
    brandText: null,
    productNameText: null,
    barcodeIdentifier: null,
    productId: null,
    productSubmissionId: null,
    createdAt: "2026-09-20T10:01:00.000Z",
  },
]

const recommendationProducts: ScanCatalogPresentationRow[] = [
  {
    id: ids.ideal,
    name: "Fructis Hair Food Leave-in",
    brand: "Garnier",
    category: "leave_in",
    imageUrl: null,
    priceEur: null,
    currency: null,
    affiliateLink: null,
    purchaseLinkStatus: null,
    priceCheckedAt: null,
  },
]

function routine(forItems: DiscoveryIntakeItem[] = items) {
  return composeDiscoveryRefinedRoutine({
    steps,
    items: forItems,
    decisions: [],
    swapProducts: [],
    recommendationProducts,
  })
}

function model(): DiscoveryCockpitModel {
  return {
    status: "ready",
    steps,
    verdicts: [],
    previewSource: { personalPlanId: `discovery:${ids.intake}`, sourceNeedVersionId: "v1" },
    routine: routine(),
    recommendationProducts,
    recommendationBrandsAvailable: true,
  }
}

test("the reduction keeps unanswered apart from „benutze ich nicht“ — and binds nothing to it", () => {
  const refined = routine()
  assert.deepEqual(refined.declinedCategories, ["oil"])
  assert.deepEqual(refined.unansweredCategories, [
    "conditioner",
    "leave_in",
    "mask",
    "dry_shampoo",
    "deep_cleansing_shampoo",
    "bondbuilder",
    "heat_protectant",
    "scalp_care",
  ])
  assert.deepEqual(refined.unassignedIntakeProducts, [])

  const byCategory = Object.fromEntries(refined.steps.map((entry) => [entry.step.category, entry]))
  // Answered with a product: open for the call's decision.
  assert.equal(byCategory.shampoo.outcome, "undecided")
  // Unanswered steps behave exactly like a declined one: the Idealplan's pick stands.
  assert.equal(byCategory.leave_in.outcome, "ideal")
  assert.equal(byCategory.leave_in.recommendationLabel, "Garnier Fructis Hair Food Leave-in")
  assert.equal(byCategory.mask.outcome, "ideal")
  assert.equal(byCategory.mask.recommendationLabel, null)
  assert.equal(byCategory.oil.outcome, "ideal")
})

test("the finalize fingerprint is stable, and still moves when a gap gets an answer", () => {
  assert.equal(routine().sourceHash, routine().sourceHash)
  const answeredMask = routine([
    ...items,
    {
      id: "50000000-0000-4000-8000-000000000009",
      category: "mask",
      source: "none",
      brandText: null,
      productNameText: null,
      barcodeIdentifier: null,
      productId: null,
      productSubmissionId: null,
      createdAt: "2026-09-20T10:02:00.000Z",
    },
  ])
  assert.notEqual(answeredMask.sourceHash, routine().sourceHash)
  assert.equal(answeredMask.unansweredCategories.includes("mask"), false)
})

const enrollment: DiscoveryEnrollment = {
  enrollmentId: ids.enrollment,
  name: "Lena M.",
  email: "lena@example.test",
  tokenVersion: 1,
  claimedUserId: ids.user,
  claimedAt: "2026-09-19T10:00:00.000Z",
  createdAt: "2026-09-18T10:00:00.000Z",
}

const intake: DiscoveryCallIntake = {
  id: ids.intake,
  enrollmentId: ids.enrollment,
  userId: ids.user,
  state: "submitted",
  submittedAt: "2026-09-20T18:41:00.000Z",
  callFinalizedAt: null,
  finalizedSourceHash: null,
}

async function renderCockpit(state: DiscoveryCallIntake["state"]): Promise<string> {
  const Page = createDiscoveryCockpitPage({
    flagEnabled: () => true,
    requireAdmin: (async () => ({ userId: "admin-1" })) as never,
    createAdminClient: () => ({}) as never,
    loadEnrollment: async () => enrollment,
    loadIntake: async () => ({ ...intake, state }),
    loadModel: async () => model(),
    loadPreflight: async () => ({ status: "ready" }),
  })
  const element = await Page({ params: Promise.resolve({ enrollmentId: ids.enrollment }) })
  return renderToStaticMarkup(element)
}

test("the cockpit names the gaps of a submitted intake, in shelf order, next to the declined line", async () => {
  const markup = await renderCockpit("submitted")
  assert.ok(markup.includes("Öl — benutzt sie nicht. Keine Entscheidung nötig."))
  assert.ok(
    markup.includes(
      "Nicht angegeben: Tiefenreinigung · Conditioner · Maske · Leave-in · Bondbuilder · Kopfhautpflege · Hitzeschutz · Trockenshampoo — im Call fragen.",
    ),
  )
})

test("before submission an open category is just not done yet — no gap line", async () => {
  const markup = await renderCockpit("draft")
  assert.ok(markup.includes("Öl — benutzt sie nicht."))
  assert.ok(!markup.includes("Nicht angegeben"))
})

test("the participant's document reads like any other: gaps get the Idealplan's pick, nothing is dropped", () => {
  const markup = renderToStaticMarkup(
    <DiscoveryRoutineDocument
      name="Lena M."
      view={buildDiscoveryCockpitView(model())}
      finalizedAt="2026-09-22T12:00:00.000Z"
    />,
  )
  // Unanswered leave-in: the Idealplan's recommendation, brand-labelled, as new.
  assert.ok(markup.includes("Garnier Fructis Hair Food Leave-in"))
  assert.ok(markup.includes("dcp-b-new"))
  // Unanswered mask without a recommendation: the ruled open copy.
  assert.ok(markup.includes("Noch offen – Empfehlung folgt"))
  // Nothing she did not bring is filed under „Brauchst du nicht mehr" …
  assert.ok(!markup.includes("Brauchst du nicht mehr"))
  // … and the call's own note about the gaps never reaches the paper.
  assert.ok(!markup.includes("Nicht angegeben"))
  assert.ok(!markup.includes("im Call fragen"))
})
