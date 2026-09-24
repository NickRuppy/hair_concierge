import assert from "node:assert/strict"
import test from "node:test"

import {
  DISCOVERY_RESEARCH_STATUS_COPY,
  discoveryResearchCandidateIds,
  discoveryResearchLinks,
  discoveryResearchStatus,
  discoveryResearchSubmissionInput,
  resolveDiscoveryResearchProduct,
  withDiscoveryResearchLinks,
  type DiscoveryResearchState,
  type DiscoverySubmissionOutcome,
} from "../src/lib/discovery/research-status"
import type { DiscoveryIntakeItem } from "../src/lib/discovery/refined-routine"

/**
 * The cockpit's research read, as pure functions: what a captured product's research
 * state is called in the call („Eingetragene Produkte“), whether „Recherche starten“ may
 * act on it and how, and which approved research the cockpit treats as the item's
 * product without writing anything (auto-link).
 */

const ids = {
  item: "50000000-0000-4000-8000-000000000001",
  submission: "60000000-0000-4000-8000-000000000001",
  job: "70000000-0000-4000-8000-000000000001",
  approved: "30000000-0000-4000-8000-000000000009",
  owned: "30000000-0000-4000-8000-000000000003",
}

// A valid EAN-13 (GS1 check digit 1).
const EAN = "4006381333931"

function item(overrides: Partial<DiscoveryIntakeItem> = {}): DiscoveryIntakeItem {
  return {
    id: ids.item,
    category: "shampoo",
    source: "name_research",
    brandText: "Balea",
    productNameText: "Frische Shampoo",
    barcodeIdentifier: null,
    productId: null,
    productSubmissionId: ids.submission,
    createdAt: "2026-09-20T10:00:00.000Z",
    ...overrides,
  }
}

function state(input: {
  submission?: DiscoverySubmissionOutcome | null
  job?: {
    id: string
    status: string
    attemptCount: number
    maxAttempts: number
    lockedAt?: string | null
  } | null
  eligible?: string[]
  checkedAt?: string
}): DiscoveryResearchState {
  return {
    checkedAt: input.checkedAt,
    submissions: new Map(input.submission ? [[ids.submission, input.submission]] : []),
    latestJobs: new Map(input.job ? [[ids.submission, input.job]] : []),
    eligible: new Set(input.eligible ?? []),
  }
}

const open = (status = "researching"): DiscoverySubmissionOutcome => ({
  status,
  approvedProductId: null,
})

// --- the shared resolver (reconcile CLI + cockpit auto-link) ------------------

test("only a resolved status with an eligible product resolves", () => {
  const eligible = new Set([ids.approved])
  assert.deepEqual(
    resolveDiscoveryResearchProduct(
      { status: "approved", approvedProductId: ids.approved },
      eligible,
    ),
    { outcome: "resolved", productId: ids.approved },
  )
  assert.deepEqual(
    resolveDiscoveryResearchProduct(
      { status: "matched_existing", approvedProductId: ids.approved },
      eligible,
    ),
    { outcome: "resolved", productId: ids.approved },
  )
  // Approved, but deactivated or quarantined since.
  assert.deepEqual(
    resolveDiscoveryResearchProduct(
      { status: "approved", approvedProductId: ids.approved },
      new Set(),
    ),
    { outcome: "ineligible", productId: ids.approved },
  )
  // An id left behind by a review that backed away is no verdict.
  for (const status of ["rejected", "needs_more_info"]) {
    assert.deepEqual(
      resolveDiscoveryResearchProduct({ status, approvedProductId: ids.approved }, eligible),
      { outcome: "not_approved", productId: ids.approved },
    )
  }
  // Still pending, or a submission that is not there at all.
  assert.deepEqual(resolveDiscoveryResearchProduct(open("pending_review"), eligible), {
    outcome: "pending",
    productId: null,
  })
  assert.deepEqual(resolveDiscoveryResearchProduct(undefined, eligible), {
    outcome: "pending",
    productId: null,
  })
})

test("eligibility is only asked about resolved submissions' products", () => {
  const submissions = new Map<string, DiscoverySubmissionOutcome>([
    ["a", { status: "approved", approvedProductId: "p-a" }],
    ["b", { status: "rejected", approvedProductId: "p-b" }],
    ["c", { status: "researching", approvedProductId: null }],
    ["d", { status: "matched_existing", approvedProductId: "p-a" }],
  ])
  assert.deepEqual(discoveryResearchCandidateIds(submissions), ["p-a"])
})

// --- auto-link --------------------------------------------------------------

test("approved, eligible research becomes the item's effective product — nothing else does", () => {
  const approvedItem = item()
  const rejectedItem = item({ id: "rejected", productSubmissionId: "s-rejected" })
  const pendingItem = item({ id: "pending", productSubmissionId: "s-pending" })
  const ineligibleItem = item({ id: "ineligible", productSubmissionId: "s-ineligible" })
  const ownedItem = item({ id: "owned", productId: ids.owned, productSubmissionId: "s-owned" })
  const declined = item({
    id: "none",
    source: "none",
    brandText: null,
    productNameText: null,
    productSubmissionId: null,
  })
  const researchState: DiscoveryResearchState = {
    submissions: new Map([
      [ids.submission, { status: "approved", approvedProductId: ids.approved }],
      ["s-rejected", { status: "rejected", approvedProductId: ids.approved }],
      ["s-pending", { status: "pending_review", approvedProductId: null }],
      ["s-ineligible", { status: "approved", approvedProductId: "gone" }],
      ["s-owned", { status: "approved", approvedProductId: ids.approved }],
    ]),
    latestJobs: new Map(),
    eligible: new Set([ids.approved]),
  }
  const items = [approvedItem, rejectedItem, pendingItem, ineligibleItem, ownedItem, declined]

  const links = discoveryResearchLinks(items, researchState)
  // Her own captured product always wins over research; only the open row is linked.
  assert.deepEqual([...links.entries()], [[ids.item, ids.approved]])

  const effective = withDiscoveryResearchLinks(items, links)
  assert.equal(effective[0]!.productId, ids.approved)
  assert.equal(effective[4]!.productId, ids.owned)
  assert.deepEqual(effective.slice(1, 4), [rejectedItem, pendingItem, ineligibleItem])
  // No new field: the item stays exactly the hashed shape it always was.
  assert.deepEqual(Object.keys(effective[0]!).sort(), Object.keys(approvedItem).sort())
  // And the inputs are not mutated.
  assert.equal(approvedItem.productId, null)
})

// --- status mapping ---------------------------------------------------------

function status(entry: DiscoveryIntakeItem, researchState: DiscoveryResearchState | null) {
  const result = discoveryResearchStatus(entry, researchState)
  return { ...result, label: DISCOVERY_RESEARCH_STATUS_COPY[result.kind] }
}

test("a catalog product is „Im Katalog“, with nothing to start", () => {
  const result = status(item({ productId: ids.owned, productSubmissionId: null }), null)
  assert.equal(result.label, "Im Katalog")
  assert.equal(result.action, null)
})

test("approved research reads „Freigegeben“; approved-but-ineligible says why it is not used", () => {
  const approved = { status: "approved", approvedProductId: ids.approved }
  assert.equal(
    status(item(), state({ submission: approved, eligible: [ids.approved] })).label,
    "Freigegeben",
  )
  const blocked = status(item(), state({ submission: approved }))
  assert.equal(blocked.label, "Freigegeben – im Katalog gesperrt")
  assert.equal(blocked.action, null)
})

test("closed research is named and offers nothing", () => {
  const rejected = status(item(), state({ submission: open("rejected") }))
  assert.equal(rejected.label, "Abgelehnt")
  assert.equal(rejected.action, null)
  const withdrawn = status(item(), state({ submission: open("cancelled_by_user") }))
  assert.equal(withdrawn.label, "Zurückgezogen")
  assert.equal(withdrawn.action, null)
})

test("an active job names its stage in short German and offers nothing", () => {
  const cases: Array<[string, string]> = [
    ["queued", "In Recherche – wartet"],
    ["running", "In Recherche – läuft"],
    ["waiting_for_review", "In Recherche – wartet auf Freigabe"],
    ["waiting_for_rework", "In Recherche – Nacharbeit"],
    ["publish_preflight", "In Recherche – wird veröffentlicht"],
    ["publishing", "In Recherche – wird veröffentlicht"],
  ]
  for (const [jobStatus, label] of cases) {
    const result = status(
      item(),
      state({
        submission: open(),
        job: { id: ids.job, status: jobStatus, attemptCount: 1, maxAttempts: 3 },
      }),
    )
    assert.equal(result.label, label, jobStatus)
    assert.equal(result.action, null, jobStatus)
  }
})

test("a failed or blocked job is retried — the enqueue RPC would hand the stuck job back", () => {
  for (const [jobStatus, label] of [
    ["failed", "Recherche fehlgeschlagen"],
    ["blocked", "Recherche blockiert"],
  ] as const) {
    const result = status(
      item(),
      state({
        submission: open(),
        job: { id: ids.job, status: jobStatus, attemptCount: 1, maxAttempts: 3 },
      }),
    )
    assert.equal(result.label, label)
    assert.deepEqual(result.action, { type: "retry", jobId: ids.job })
  }
})

test("a job out of attempts is named as such and offers no button a worker would never honour", () => {
  // The retry RPC re-queues without resetting attempt_count, and the claim RPC only takes
  // attempt_count < max_attempts: a retry here would read „wartet" forever.
  for (const jobStatus of ["failed", "blocked", "queued", "waiting_for_rework"]) {
    const result = status(
      item(),
      state({
        submission: open(),
        job: { id: ids.job, status: jobStatus, attemptCount: 3, maxAttempts: 3 },
      }),
    )
    assert.equal(result.label, "Recherche ausgeschöpft – im Review-Center neu anstoßen", jobStatus)
    assert.equal(result.action, null, jobStatus)
  }
  // Still one attempt left: a failed job is retried as before.
  const retryable = status(
    item(),
    state({
      submission: open(),
      job: { id: ids.job, status: "failed", attemptCount: 2, maxAttempts: 3 },
    }),
  )
  assert.deepEqual(retryable.action, { type: "retry", jobId: ids.job })
  // A running job has already been claimed (the claim counts the attempt): still running.
  const running = status(
    item(),
    state({
      submission: open(),
      job: { id: ids.job, status: "running", attemptCount: 3, maxAttempts: 3 },
    }),
  )
  assert.equal(running.label, "In Recherche – läuft")
})

test("a final-attempt running job whose lease expired is exhausted; a live lease still runs", () => {
  const checkedAt = "2026-09-24T12:00:00.000Z"
  const running = (lockedAt: string | null, attemptCount = 3) =>
    status(
      item(),
      state({
        submission: open(),
        job: { id: ids.job, status: "running", attemptCount, maxAttempts: 3, lockedAt },
        checkedAt,
      }),
    )
  // Worker died on the last attempt: the claim would reclaim it as stale, but only below
  // max_attempts — so it would read „läuft" forever.
  const stale = running("2026-09-24T11:49:59.000Z")
  assert.equal(stale.label, "Recherche ausgeschöpft – im Review-Center neu anstoßen")
  assert.equal(stale.action, null)
  assert.equal(running(null).label, "Recherche ausgeschöpft – im Review-Center neu anstoßen")
  // Lease younger than ten minutes: still running.
  assert.equal(running("2026-09-24T11:55:00.000Z").label, "In Recherche – läuft")
  // An expired lease with attempts left is the claim's job to pick up again: still „läuft".
  assert.equal(running("2026-09-24T11:00:00.000Z", 2).label, "In Recherche – läuft")
})

test("an open submission with no live job is enqueued", () => {
  for (const job of [
    null,
    { id: ids.job, status: "done", attemptCount: 1, maxAttempts: 3 },
    { id: ids.job, status: "cancelled", attemptCount: 1, maxAttempts: 3 },
  ]) {
    const result = status(item(), state({ submission: open("pending_review"), job }))
    assert.equal(result.label, "Recherche nicht gestartet")
    assert.deepEqual(result.action, { type: "enqueue", submissionId: ids.submission })
  }
})

test("the review's own states win over a finished job", () => {
  const review = status(
    item(),
    state({
      submission: open("ready_for_review"),
      job: { id: ids.job, status: "done", attemptCount: 1, maxAttempts: 3 },
    }),
  )
  assert.equal(review.label, "In Recherche – wartet auf Freigabe")
  assert.equal(review.action, null)

  const question = status(item(), state({ submission: open("needs_more_info") }))
  assert.equal(question.label, "Rückfrage")
  assert.deepEqual(question.action, { type: "enqueue", submissionId: ids.submission })
})

test("an item without a submission creates one — when there is enough to research", () => {
  const barcodeOnly = status(
    item({
      source: "barcode_unknown",
      brandText: null,
      productNameText: null,
      barcodeIdentifier: EAN,
      productSubmissionId: null,
    }),
    state({}),
  )
  assert.equal(barcodeOnly.label, "Nur Barcode – keine Recherche")
  assert.deepEqual(barcodeOnly.action, { type: "create_submission" })

  const typed = status(item({ productSubmissionId: null }), state({}))
  assert.equal(typed.label, "Keine Recherche")
  assert.deepEqual(typed.action, { type: "create_submission" })

  // A name without a brand, and no usable barcode: the name lane needs both.
  const thin = status(
    item({ brandText: null, productSubmissionId: null, barcodeIdentifier: "12345678" }),
    state({}),
  )
  assert.equal(thin.label, "Zu wenig Angaben für eine Recherche")
  assert.equal(thin.action, null)
})

test("an unreadable research state says so and offers nothing", () => {
  const result = status(item(), null)
  assert.equal(result.label, "Status gerade nicht lesbar")
  assert.equal(result.action, null)
  // A submission id with no row behind it is not guessed at either.
  const missing = status(item(), state({}))
  assert.equal(missing.label, "Recherche-Status unbekannt")
  assert.equal(missing.action, null)
})

test("the submission a research start creates uses the scan lanes' own inputs", () => {
  assert.deepEqual(
    discoveryResearchSubmissionInput(
      item({ barcodeIdentifier: EAN, brandText: null, productNameText: null }),
    ),
    { category: "shampoo", identifier: EAN, brandText: null, productNameText: null },
  )
  // An invalid barcode falls back to the name lane, which needs brand AND name.
  assert.deepEqual(discoveryResearchSubmissionInput(item({ barcodeIdentifier: "12345678" })), {
    category: "shampoo",
    identifier: null,
    brandText: "Balea",
    productNameText: "Frische Shampoo",
  })
  assert.equal(discoveryResearchSubmissionInput(item({ brandText: null })), null)
  assert.equal(
    discoveryResearchSubmissionInput(
      item({ source: "none", brandText: null, productNameText: null }),
    ),
    null,
  )
})

test("F1: a research start uses the PRODUCT TYPE, never her usage; a legacy row falls back to its tile", () => {
  // A conditioner she uses as a mask is researched as a conditioner.
  assert.equal(
    discoveryResearchSubmissionInput(item({ category: "mask", productType: "conditioner" }))
      ?.category,
    "conditioner",
  )
  // Legacy (tile model): no product type — the tile was also what research got then.
  assert.equal(discoveryResearchSubmissionInput(item({ category: "mask" }))?.category, "mask")
  // Type known, usage unknown: still researchable, as the type.
  assert.equal(
    discoveryResearchSubmissionInput(item({ category: null as never, productType: "leave_in" }))
      ?.category,
    "leave_in",
  )
  // „Weiß ich nicht": neither — nothing to research until the cockpit sets the type.
  assert.equal(
    discoveryResearchSubmissionInput(item({ category: null as never, productSubmissionId: null })),
    null,
  )
})
