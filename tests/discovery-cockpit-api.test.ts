import assert from "node:assert/strict"
import test from "node:test"
import { NextRequest, NextResponse } from "next/server"

import { createDiscoveryDecisionsHandler } from "../src/app/api/admin/beratung/[enrollmentId]/decisions/route"
import { createDiscoveryFinalizeHandler } from "../src/app/api/admin/beratung/[enrollmentId]/finalize/route"
import { composeRunsheetProducts } from "../src/components/discovery/cockpit/runsheet-products"
import {
  buildDiscoveryCockpitView,
  discoveryOwnedProductIdentities,
  discoveryResearchOpenItems,
  type DiscoveryCallDecisionInput,
  type DiscoveryCallIntake,
  type DiscoveryCockpitModel,
} from "../src/lib/discovery/cockpit"
import type { DiscoveryIdealStep } from "../src/lib/discovery/load-ideal-routine"
import type { DiscoveryParticipantVerdict } from "../src/lib/discovery/load-participant-verdicts"
import { composeDiscoveryRefinedRoutine } from "../src/lib/discovery/refined-routine"
import type { ScanPresentedVerdictPayload } from "../src/lib/scan/types"

/**
 * The two cockpit endpoints, driven through their REAL guard and their real composition
 * (only the loaders are faked), because the contract lives in the order of the checks:
 * flag, admin, intake, freeze, body, composition, allow-list.
 */

const ids = {
  enrollment: "3f1a6f2e-2b44-4a1e-9a1a-6f2e2b444a1e",
  intake: "40000000-0000-4000-8000-000000000001",
  user: "20000000-0000-4000-8000-000000000002",
  owned: "30000000-0000-4000-8000-000000000003",
  alternative: "30000000-0000-4000-8000-00000000000a",
  ideal: "30000000-0000-4000-8000-00000000000c",
  stranger: "30000000-0000-4000-8000-0000000000ff",
  item: "50000000-0000-4000-8000-000000000005",
}

const DECISION_KEY = "decision:shampoo:shampoo_everyday:gap"
const OIL_KEY = "decision:oil:dry_finish:gap"

const submittedIntake: DiscoveryCallIntake = {
  id: ids.intake,
  enrollmentId: ids.enrollment,
  userId: ids.user,
  state: "submitted",
  submittedAt: "2026-09-20T18:41:00.000Z",
  callFinalizedAt: null,
  finalizedSourceHash: null,
}

const step: DiscoveryIdealStep = {
  decisionKey: DECISION_KEY,
  category: "shampoo",
  role: "shampoo_everyday",
  section: "basis",
  categoryLabel: "Shampoo",
  roleLabel: "Hauptreinigung",
  roleDescription: "Kopfhaut waschen",
  frequencyLabel: "3× / Woche",
  preview: null,
}

const intakeItem = {
  id: ids.item,
  category: "shampoo" as const,
  source: "catalog_search" as const,
  brandText: "Elvital",
  productNameText: "Hyaluron Pure",
  barcodeIdentifier: null,
  productId: ids.owned,
  productSubmissionId: null,
  createdAt: "2026-09-20T10:00:00.000Z",
}

const verdictPayload: ScanPresentedVerdictPayload = {
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
  alternatives: [
    {
      productId: ids.alternative,
      displayName: "Guhl Leichte Frische Shampoo",
      imageUrl: null,
      priceLabel: null,
      netContentLabel: null,
      verdict: "ideal",
      verdictLabel: "Passt",
      brand: "Guhl",
      purchaseUrl: null,
    },
  ],
}

const verdict: DiscoveryParticipantVerdict = {
  itemId: ids.item,
  productId: ids.owned,
  status: "verdict",
  product: {
    productId: ids.owned,
    name: "Elvital Hyaluron Pure Shampoo",
    brand: "L'Oréal Elvital",
    category: "shampoo",
    categoryLabel: "Shampoo",
    imageUrl: null,
    priceLabel: null,
    purchaseUrl: null,
  },
  payload: verdictPayload,
}

function readyModel(): DiscoveryCockpitModel {
  return {
    status: "ready",
    steps: [step],
    verdicts: [verdict],
    previewSource: { personalPlanId: `discovery:${ids.intake}`, sourceNeedVersionId: "v1" },
    routine: composeDiscoveryRefinedRoutine({
      steps: [step],
      items: [intakeItem],
      decisions: [],
      swapProducts: [],
      ownedProducts: discoveryOwnedProductIdentities([verdict]),
    }),
    recommendationProducts: [],
    recommendationBrandsAvailable: true,
  }
}

type Deps = Record<string, unknown>

function baseDeps(overrides: Deps = {}): Deps {
  return {
    flagEnabled: () => true,
    requireAdmin: async () => ({ userId: "admin-1" }),
    createAdminClient: () => ({}) as never,
    loadIntake: async () => submittedIntake,
    loadModel: async () => readyModel(),
    ...overrides,
  }
}

function decisionRequest(body: unknown) {
  return new NextRequest(`https://chaarlie.de/api/admin/beratung/${ids.enrollment}/decisions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

function finalizeRequest(body: unknown) {
  return new NextRequest(`https://chaarlie.de/api/admin/beratung/${ids.enrollment}/finalize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

const params = { params: Promise.resolve({ enrollmentId: ids.enrollment }) }

async function code(response: Response): Promise<string | undefined> {
  return ((await response.json()) as { code?: string }).code
}

// --- the gate -------------------------------------------------------------------

test("the kill switch hides the endpoint, and the shared admin gate's own answer is passed through", async () => {
  const off = await createDiscoveryDecisionsHandler(baseDeps({ flagEnabled: () => false }))(
    decisionRequest({ decisionKey: DECISION_KEY, decision: "keep" }),
    { params: Promise.resolve({ enrollmentId: ids.enrollment }) },
  )
  assert.equal(off.status, 404)

  for (const status of [401, 403]) {
    const refused = await createDiscoveryDecisionsHandler(
      baseDeps({
        requireAdmin: async () => ({
          response: NextResponse.json({ error: "Nicht erlaubt." }, { status }),
        }),
      }),
    )(decisionRequest({ decisionKey: DECISION_KEY, decision: "keep" }), {
      params: Promise.resolve({ enrollmentId: ids.enrollment }),
    })
    assert.equal(refused.status, status)
  }
})

test("an enrollment without an intake is a 404, and the admin client is only built after the gate", async () => {
  let clients = 0
  const response = await createDiscoveryDecisionsHandler(
    baseDeps({
      requireAdmin: async () => ({
        response: NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 }),
      }),
      createAdminClient: () => {
        clients += 1
        return {} as never
      },
    }),
  )(decisionRequest({ decisionKey: DECISION_KEY, decision: "keep" }), {
    params: Promise.resolve({ enrollmentId: ids.enrollment }),
  })
  assert.equal(response.status, 401)
  assert.equal(clients, 0)

  const missing = await createDiscoveryDecisionsHandler(baseDeps({ loadIntake: async () => null }))(
    decisionRequest({ decisionKey: DECISION_KEY, decision: "keep" }),
    { params: Promise.resolve({ enrollmentId: ids.enrollment }) },
  )
  assert.equal(missing.status, 404)
  assert.equal(await code(missing), "not_found")
})

// --- decisions ------------------------------------------------------------------

function stored(input: DiscoveryCallDecisionInput) {
  return {
    outcome: "stored" as const,
    decision: {
      decisionKey: input.decisionKey,
      decision: input.decision,
      swapProductId: input.decision === "swap" ? input.swapProductId : null,
      intakeItemId: input.intakeItemId,
    },
  }
}

test("a keep is stored with the binding the server computed; a product not in the step is refused", async () => {
  const written: DiscoveryCallDecisionInput[] = []
  const handler = createDiscoveryDecisionsHandler(
    baseDeps({
      setDecision: async (input: DiscoveryCallDecisionInput) => {
        written.push(input)
        return stored(input)
      },
    }),
  )
  const named = await handler(
    decisionRequest({ decisionKey: DECISION_KEY, intakeItemId: ids.item, decision: "keep" }),
    params,
  )
  assert.equal(named.status, 200)
  // A deployed old tab names only the step: fine while the step holds one product.
  const oldTab = await handler(
    decisionRequest({ decisionKey: DECISION_KEY, decision: "keep" }),
    params,
  )
  assert.equal(oldTab.status, 200)
  const foreign = await handler(
    decisionRequest({
      decisionKey: DECISION_KEY,
      decision: "keep",
      intakeItemId: "50000000-0000-4000-8000-0000000000ff",
    }),
    params,
  )
  assert.equal(foreign.status, 409)
  assert.equal(await code(foreign), "unknown_item")

  const expected = {
    intakeId: ids.intake,
    decisionKey: DECISION_KEY,
    decision: "keep",
    swapProductId: null,
    intakeItemId: ids.item,
    siblings: [],
    expectedCategory: "shampoo",
    expectedUsageRole: null,
  }
  assert.deepEqual(written, [expected, expected])
})

test("a swap must name a product the cockpit displayed for that very step", async () => {
  const written: DiscoveryCallDecisionInput[] = []
  const handler = createDiscoveryDecisionsHandler(
    baseDeps({
      setDecision: async (input: DiscoveryCallDecisionInput) => {
        written.push(input)
        return stored(input)
      },
    }),
  )

  const offered = await handler(
    decisionRequest({
      decisionKey: DECISION_KEY,
      intakeItemId: ids.item,
      decision: "swap",
      swapProductId: ids.alternative,
    }),
    params,
  )
  assert.equal(offered.status, 200)

  const stranger = await handler(
    decisionRequest({
      decisionKey: DECISION_KEY,
      intakeItemId: ids.item,
      decision: "swap",
      swapProductId: ids.stranger,
    }),
    params,
  )
  assert.equal(stranger.status, 400)
  assert.equal(await code(stranger), "swap_not_offered")

  assert.deepEqual(
    written.map((entry) => entry.swapProductId),
    [ids.alternative],
  )
})

test("a decision key the Idealplan does not carry is refused", async () => {
  const response = await createDiscoveryDecisionsHandler(
    baseDeps({
      setDecision: async () => {
        throw new Error("must not write an orphan decision")
      },
    }),
  )(decisionRequest({ decisionKey: OIL_KEY, decision: "keep" }), params)
  assert.equal(response.status, 400)
  assert.equal(await code(response), "unknown_decision_key")
})

test("a malformed body is refused before anything is composed", async () => {
  let composed = 0
  const handler = createDiscoveryDecisionsHandler(
    baseDeps({
      loadModel: async () => {
        composed += 1
        return readyModel()
      },
      setDecision: async () => {
        throw new Error("must not write")
      },
    }),
  )
  for (const body of [
    {},
    { decisionKey: DECISION_KEY, decision: "maybe" },
    // swap without a target, and keep with one: the pair is part of the schema.
    { decisionKey: DECISION_KEY, decision: "swap" },
    { decisionKey: DECISION_KEY, decision: "keep", swapProductId: ids.alternative },
    { decisionKey: DECISION_KEY, decision: "swap", swapProductId: "not-a-uuid" },
    // „Weglassen" never names a swap target; a product is named by its uuid.
    { decisionKey: DECISION_KEY, decision: "drop", swapProductId: ids.alternative },
    { decisionKey: DECISION_KEY, decision: "keep", intakeItemId: "item-1" },
  ]) {
    const response = await handler(decisionRequest(body), params)
    assert.equal(response.status, 400, JSON.stringify(body))
    assert.equal(await code(response), "invalid_body")
  }
  assert.equal(composed, 0)
})

test("a draft intake takes decisions, as it always did — only finalising needs a submit", async () => {
  const written: DiscoveryCallDecisionInput[] = []
  const response = await createDiscoveryDecisionsHandler(
    baseDeps({
      loadIntake: async () => ({ ...submittedIntake, state: "draft", submittedAt: null }),
      setDecision: async (input: DiscoveryCallDecisionInput) => {
        written.push(input)
        return stored(input)
      },
    }),
  )(
    decisionRequest({ decisionKey: DECISION_KEY, intakeItemId: ids.item, decision: "keep" }),
    params,
  )
  assert.equal(response.status, 200)
  assert.equal(written.length, 1)
})

test("decisions are frozen while the call is finalised", async () => {
  const response = await createDiscoveryDecisionsHandler(
    baseDeps({
      loadIntake: async () => ({
        ...submittedIntake,
        callFinalizedAt: "2026-09-22T12:00:00.000Z",
        finalizedSourceHash: "hash-1",
      }),
      setDecision: async () => {
        throw new Error("must not write while finalised")
      },
    }),
  )(decisionRequest({ decisionKey: DECISION_KEY, decision: "keep" }), params)
  assert.equal(response.status, 409)
  assert.equal(await code(response), "finalized")
})

test("a routine that cannot be composed refuses the write instead of guessing", async () => {
  for (const status of ["no_usable_source", "temporarily_unavailable"] as const) {
    const response = await createDiscoveryDecisionsHandler(
      baseDeps({
        loadModel: async () => ({ status }),
        setDecision: async () => {
          throw new Error("must not write without a routine")
        },
      }),
    )(decisionRequest({ decisionKey: DECISION_KEY, decision: "keep" }), params)
    assert.equal(response.status, 503)
    assert.equal(await code(response), status)
  }
})

// --- finalize -------------------------------------------------------------------

test("finalize stores the hash of the routine as composed right now", async () => {
  const calls: Array<{ intakeId: string; sourceHash: string }> = []
  const expected = composeDiscoveryRefinedRoutine({
    steps: [step],
    items: [intakeItem],
    decisions: [],
    swapProducts: [],
    ownedProducts: discoveryOwnedProductIdentities([verdict]),
  }).sourceHash

  const response = await createDiscoveryFinalizeHandler(
    baseDeps({
      now: () => "2026-09-22T12:00:00.000Z",
      finalize: async (input: { intakeId: string; sourceHash: string }) => {
        calls.push({ intakeId: input.intakeId, sourceHash: input.sourceHash })
        return {
          ...submittedIntake,
          callFinalizedAt: "2026-09-22T12:00:00.000Z",
          finalizedSourceHash: input.sourceHash,
        }
      },
    }),
  )(finalizeRequest({ finalized: true }), params)

  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), {
    callFinalizedAt: "2026-09-22T12:00:00.000Z",
    finalizedSourceHash: expected,
  })
  assert.deepEqual(calls, [{ intakeId: ids.intake, sourceHash: expected }])
})

test("finalize refuses a composition whose recommendation brands could not be read", async () => {
  const response = await createDiscoveryFinalizeHandler(
    baseDeps({
      loadModel: async () => ({ ...readyModel(), recommendationBrandsAvailable: false }),
      finalize: async () => {
        throw new Error("a degraded hash must never be stored")
      },
    }),
  )(finalizeRequest({ finalized: true }), params)
  assert.equal(response.status, 503)
  assert.deepEqual(await response.json(), { code: "unavailable" })
})

test("finalize requires a submitted intake, both before and inside the write", async () => {
  const draft = await createDiscoveryFinalizeHandler(
    baseDeps({
      loadIntake: async () => ({ ...submittedIntake, state: "draft", submittedAt: null }),
      finalize: async () => {
        throw new Error("must not finalize a draft")
      },
    }),
  )(finalizeRequest({ finalized: true }), params)
  assert.equal(draft.status, 409)
  assert.equal(await code(draft), "not_submitted")

  // The state changed between the read and the write: the UPDATE's own predicate matched
  // nothing, which must read as the same refusal rather than a success.
  const raced = await createDiscoveryFinalizeHandler(baseDeps({ finalize: async () => null }))(
    finalizeRequest({ finalized: true }),
    params,
  )
  assert.equal(raced.status, 409)
  assert.equal(await code(raced), "not_submitted")
})

test("un-finalize clears the pair and needs no composition at all", async () => {
  let composed = 0
  const response = await createDiscoveryFinalizeHandler(
    baseDeps({
      loadIntake: async () => ({
        ...submittedIntake,
        callFinalizedAt: "2026-09-22T12:00:00.000Z",
        finalizedSourceHash: "hash-1",
      }),
      loadModel: async () => {
        composed += 1
        return readyModel()
      },
      finalize: async () => {
        throw new Error("must not finalize")
      },
      unfinalize: async () => ({ ...submittedIntake }),
    }),
  )(finalizeRequest({ finalized: false }), params)

  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { callFinalizedAt: null, finalizedSourceHash: null })
  assert.equal(composed, 0)
})

test("research gate (F1/F4): finalize refuses while the runsheet shows her product in research inside its step", async () => {
  // Her scanned conditioner is in research; the Idealroutine has an empty conditioner step,
  // so the runsheet's display join fills that step with „noch in Recherche".
  const conditionerStep: DiscoveryIdealStep = {
    ...step,
    decisionKey: "decision:conditioner:conditioner_rinse_out:gap",
    category: "conditioner",
    role: "conditioner_rinse_out",
    categoryLabel: "Conditioner",
  }
  const scanned = {
    ...intakeItem,
    id: "50000000-0000-4000-8000-000000000006",
    category: "conditioner" as const,
    source: "barcode_unknown" as const,
    brandText: null,
    productNameText: null,
    barcodeIdentifier: "0850018802659",
    productId: null,
  }
  const model: DiscoveryCockpitModel = {
    ...readyModel(),
    steps: [step, conditionerStep],
    routine: composeDiscoveryRefinedRoutine({
      steps: [step, conditionerStep],
      items: [intakeItem, scanned],
      decisions: [],
      swapProducts: [],
      ownedProducts: discoveryOwnedProductIdentities([verdict]),
    }),
  }
  const view = buildDiscoveryCockpitView(model)
  const display = composeRunsheetProducts({ steps: view.steps, unassigned: view.unassigned })
  assert.ok(
    display.tauschenOderNeu.some(
      (entry) => entry.step.category === "conditioner" && entry.research !== null,
    ),
  )
  assert.deepEqual(
    discoveryResearchOpenItems(view).map((entry) => entry.itemId),
    [scanned.id],
  )

  const response = await createDiscoveryFinalizeHandler(
    baseDeps({
      loadModel: async () => model,
      finalize: async () => {
        throw new Error("a call with a product in research must never be finalised")
      },
    }),
  )(finalizeRequest({ finalized: true }), params)
  assert.equal(response.status, 409)
  assert.deepEqual(await response.json(), { code: "research_open" })
})

test("finalize refuses a body that is not the boolean", async () => {
  const response = await createDiscoveryFinalizeHandler(
    baseDeps({
      finalize: async () => {
        throw new Error("must not finalize")
      },
    }),
  )(finalizeRequest({ finalized: "yes" }), params)
  assert.equal(response.status, 400)
  assert.equal(await code(response), "invalid_body")
})
