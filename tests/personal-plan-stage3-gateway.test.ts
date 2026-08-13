import assert from "node:assert/strict"
import test from "node:test"

import { CATEGORY_ROLE_POLICIES } from "../src/lib/personal-plan/products/authorities"
import { Stage3ProductsGatewayError } from "../src/lib/personal-plan/products/gateway"
import {
  createHttpStage3ProductsGateway,
  parseStage3RevisionConflict,
} from "../src/lib/personal-plan/products/http-gateway"
import { classifyStage3DesiredState } from "../src/lib/personal-plan/products/recovery-desired-state"
import {
  createFixtureStage3Gateway,
  type FixtureStage3Gateway,
  type Stage3CategoryRequirement,
} from "../src/lib/personal-plan/products/fixture-gateway"

const now = "2026-08-07T10:00:00.000Z"
const requirements: Stage3CategoryRequirement[] = [
  {
    category: "conditioner",
    requiredRoles: ["conditioner_rinse_out"],
    needSummary: "Pflege nach jeder Wäsche",
    authorityVersion: CATEGORY_ROLE_POLICIES.conditioner.authorityVersion,
  },
]

function gateway(): FixtureStage3Gateway {
  return createFixtureStage3Gateway({ now: () => now, searchDelayMs: 0 })
}

test("production product failures share the frozen unavailable and snapshot codes", () => {
  for (const code of [
    "temporarily_unavailable",
    "unsupported_snapshot_version",
    "snapshot_too_large",
  ] as const) {
    const error = new Stage3ProductsGatewayError(code)
    assert.equal(error.name, "Stage3ProductsGatewayError")
    assert.equal(error.code, code)
  }
})

test("the HTTP gateway preserves a stale refined source conflict", async () => {
  const subject = createHttpStage3ProductsGateway({
    fetch: async () =>
      new Response(JSON.stringify({ error: "stale_refined_source" }), {
        status: 409,
        headers: { "Content-Type": "application/json" },
      }),
  })

  await assert.rejects(
    () =>
      subject.loadOrCreate({
        draftId: "client-derived",
        userId: "client-derived",
        personalPlanId: "plan-1",
        refinedVersionId: "stale-refined-1",
        requirements: [],
      }),
    (error: unknown) =>
      error instanceof Stage3ProductsGatewayError && error.code === "stale_refined_source",
  )
})

test("the HTTP gateway returns the canonical draft from revision conflicts for mutate and complete", async () => {
  const latestDraft = (await createDraft(gateway())).draft
  const requests: Array<{ url: string; init?: RequestInit }> = []
  const subject = createHttpStage3ProductsGateway({
    fetch: async (url, init) => {
      requests.push({ url: String(url), init })
      return new Response(JSON.stringify({ error: "revision_conflict", latestDraft }), {
        status: 409,
        headers: { "Content-Type": "application/json" },
      })
    },
  })

  const mutation = await subject.mutate({
    draftId: latestDraft.draftId,
    expectedRevision: latestDraft.revision,
    mutation: { type: "complete_capture_category", category: "conditioner" },
  })
  const completion = await subject.complete({
    draftId: latestDraft.draftId,
    expectedRevision: latestDraft.revision,
  })

  assert.deepEqual(mutation, { status: "conflict", latestDraft })
  assert.deepEqual(completion, { status: "conflict", latestDraft })
  assert.deepEqual(
    requests.map(({ url, init }) => [url, init?.method]),
    [
      ["/api/personal-plan/stage-3", "PATCH"],
      ["/api/personal-plan/stage-3/complete", "POST"],
    ],
  )
})

test("the HTTP gateway fails closed when a revision conflict lacks a valid canonical draft", async () => {
  assert.equal(parseStage3RevisionConflict({ error: "revision_conflict", latestDraft: {} }), null)
  const subject = createHttpStage3ProductsGateway({
    fetch: async () =>
      new Response(JSON.stringify({ error: "revision_conflict", latestDraft: { revision: 7 } }), {
        status: 409,
        headers: { "Content-Type": "application/json" },
      }),
  })

  await assert.rejects(
    () =>
      subject.mutate({
        draftId: "11111111-1111-4111-8111-111111111111",
        expectedRevision: 0,
        mutation: { type: "complete_capture_category", category: "conditioner" },
      }),
    (error: unknown) =>
      error instanceof Stage3ProductsGatewayError && error.code === "temporarily_unavailable",
  )
})

test("the HTTP gateway preserves typed status and Retry-After on retryable failures", async () => {
  const subject = createHttpStage3ProductsGateway({
    fetch: async () =>
      new Response(JSON.stringify({ error: "rate_limited" }), {
        status: 429,
        headers: { "Content-Type": "application/json", "Retry-After": "17" },
      }),
  })

  await assert.rejects(
    () =>
      subject.mutate({
        draftId: "11111111-1111-4111-8111-111111111111",
        expectedRevision: 0,
        mutation: { type: "complete_capture_category", category: "conditioner" },
      }),
    (error: unknown) =>
      error instanceof Stage3ProductsGatewayError &&
      error.code === "rate_limited" &&
      error.status === 429 &&
      error.retryAfterSeconds === 17,
  )
})

test("the HTTP decision gateway preserves Retry-After instead of using the raw-fetch fallback", async () => {
  const subject = createHttpStage3ProductsGateway({
    fetch: async () =>
      new Response(JSON.stringify({ error: "rate_limited" }), {
        status: 429,
        headers: { "Content-Type": "application/json", "Retry-After": "23" },
      }),
  })

  await assert.rejects(
    () =>
      subject.resolveDecision!({
        draftId: "11111111-1111-4111-8111-111111111111",
        expectedRevision: 4,
        intent: {
          type: "resolve_decision",
          subjectKey: "decision:conditioner:conditioner_rinse_out:capture-a",
          action: "keep_owned",
        },
      }),
    (error: unknown) =>
      error instanceof Stage3ProductsGatewayError &&
      error.code === "rate_limited" &&
      error.status === 429 &&
      error.retryAfterSeconds === 23,
  )
})

async function createDraft(subject: FixtureStage3Gateway) {
  return subject.loadOrCreate({
    draftId: "draft-1",
    userId: "user-1",
    personalPlanId: "plan-1",
    refinedVersionId: "refined-v1",
    requirements,
  })
}

test("loads or creates a draft from fixture authority requirements and resumes it", async () => {
  const subject = gateway()
  const first = await createDraft(subject)
  const resumed = await createDraft(subject)

  assert.equal(first.status, "active")
  assert.equal(first.draft.revision, 0)
  assert.deepEqual(first.draft.authorityVersions, {
    conditioner: CATEGORY_ROLE_POLICIES.conditioner.authorityVersion,
  })
  assert.equal(resumed.status, "active")
  assert.equal(resumed.draft, first.draft)
})

test("desired-state classification recognises an already-open category and completed draft", async () => {
  const loaded = await createDraft(gateway())
  assert.equal(
    classifyStage3DesiredState(loaded.draft, {
      type: "reopen_capture_category",
      category: "conditioner",
    }),
    "satisfied",
  )
  assert.equal(
    classifyStage3DesiredState(
      { ...loaded.draft, status: "completed" },
      {
        type: "reopen_capture_category",
        category: "conditioner",
      },
    ),
    "completed",
  )
})

test("fixture accepts an already-open category with a stale revision as canonical success", async () => {
  const subject = gateway()
  const loaded = await createDraft(subject)
  const saved = await subject.mutate({
    draftId: loaded.draft.draftId,
    expectedRevision: loaded.draft.revision,
    mutation: { type: "reopen_capture_category", category: "conditioner" },
  })
  assert.equal(saved.status, "saved")
  const replay = await subject.mutate({
    draftId: loaded.draft.draftId,
    expectedRevision: loaded.draft.revision,
    mutation: { type: "reopen_capture_category", category: "conditioner" },
  })
  assert.deepEqual(replay, saved)
})

test("search trims and requires two characters, caps at eight, and echoes request tokens", async () => {
  const subject = createFixtureStage3Gateway({ now: () => now, searchDelayMs: 0 })

  const tooShort = await subject.search({ category: "conditioner", query: " a ", requestToken: 1 })
  assert.deepEqual(tooShort, {
    status: "ready",
    requestToken: 1,
    result: { category: "conditioner", query: "a", candidates: [], totalCapped: false },
  })

  const latest = await subject.search({
    category: "conditioner",
    query: "condition",
    requestToken: 3,
  })
  const stale = await subject.search({
    category: "conditioner",
    query: "condition",
    requestToken: 2,
  })

  assert.equal(latest.status, "ready")
  assert.equal(latest.result.query, "condition")
  assert.ok(latest.result.candidates.length <= 8)
  assert.ok(latest.result.candidates.every((candidate) => candidate.category === "conditioner"))
  assert.equal(stale.status, "ready")
  assert.equal(stale.requestToken, 2)
})

test("fixture search covers Shampoo, Conditioner, Oil, Scalp Care, and Heat Protectant", async () => {
  const subject = gateway()
  const searches = [
    await subject.search({ category: "shampoo", query: "sanft", requestToken: 1 }),
    await subject.search({ category: "conditioner", query: "condition", requestToken: 2 }),
    await subject.search({ category: "oil", query: "oil", requestToken: 3 }),
    await subject.search({ category: "scalp_care", query: "scalp", requestToken: 4 }),
    await subject.search({ category: "heat_protectant", query: "hitz", requestToken: 5 }),
  ]

  for (const response of searches) {
    assert.equal(response.status, "ready")
    assert.equal(response.result.candidates.length > 0, true)
    assert.ok(
      response.result.candidates.every(
        (candidate) => candidate.category === response.result.category,
      ),
    )
  }
})

test("successful mutations stamp updatedAt from the injected clock", async () => {
  const timestamps = ["created", "mutated"]
  const subject = createFixtureStage3Gateway({
    now: () => timestamps.shift() ?? "later",
    searchDelayMs: 0,
  })
  await createDraft(subject)
  const search = await subject.search({
    category: "conditioner",
    query: "condition",
    requestToken: 1,
  })
  assert.equal(search.status, "ready")

  const saved = await subject.mutate({
    draftId: "draft-1",
    expectedRevision: 0,
    mutation: {
      type: "capture_catalog_candidate",
      candidateId: search.result.candidates[0]!.candidateId,
      frequencyRange: "weekly_2x",
    },
  })

  assert.equal(saved.status, "saved")
  assert.equal(saved.draft.updatedAt, "mutated")
})

test("one-shot fixture failures are recoverable and never apply a failed save or completion", async () => {
  const subject = createFixtureStage3Gateway({
    now: () => now,
    searchDelayMs: 0,
    failOnce: ["search", "mutate", "complete"],
  })
  await createDraft(subject)

  await assert.rejects(
    subject.search({ category: "conditioner", query: "condition", requestToken: 1 }),
    /fixture search failure/,
  )
  const search = await subject.search({
    category: "conditioner",
    query: "condition",
    requestToken: 1,
  })
  assert.equal(search.status, "ready")

  const mutation = {
    type: "capture_catalog_candidate" as const,
    candidateId: search.result.candidates[0]!.candidateId,
    frequencyRange: "weekly_2x" as const,
  }
  await assert.rejects(
    subject.mutate({ draftId: "draft-1", expectedRevision: 0, mutation }),
    /fixture mutate failure/,
  )
  const saved = await subject.mutate({ draftId: "draft-1", expectedRevision: 0, mutation })
  assert.equal(saved.status, "saved")
  assert.equal(saved.draft.revision, 1)
  assert.equal(saved.draft.products.length, 1)

  const assigned = await subject.mutate({
    draftId: "draft-1",
    expectedRevision: saved.draft.revision,
    mutation: {
      type: "assign_roles",
      capturedProductId: saved.draft.products[0]!.capturedProductId,
      category: "conditioner",
      roles: ["conditioner_rinse_out"],
    },
  })
  assert.equal(assigned.status, "saved")
  const captureComplete = await subject.mutate({
    draftId: "draft-1",
    expectedRevision: assigned.draft.revision,
    mutation: { type: "complete_capture_category", category: "conditioner" },
  })
  assert.equal(captureComplete.status, "saved")
  const decided = await subject.mutate({
    draftId: "draft-1",
    expectedRevision: captureComplete.draft.revision,
    mutation: {
      type: "record_decision",
      decision: {
        decisionKey: `decision:conditioner:conditioner_rinse_out:${saved.draft.products[0]!.capturedProductId}`,
        category: "conditioner",
        role: "conditioner_rinse_out",
        capturedProductId: saved.draft.products[0]!.capturedProductId,
        verdict: "ideal",
        choiceState: "owned_active",
        criterionResults: [],
        recommendation: null,
        limitationAcknowledged: false,
      },
    },
  })
  assert.equal(decided.status, "saved")

  await assert.rejects(
    subject.complete({ draftId: "draft-1", expectedRevision: decided.draft.revision }),
    /fixture complete failure/,
  )
  const complete = await subject.complete({
    draftId: "draft-1",
    expectedRevision: decided.draft.revision,
  })
  assert.equal(complete.status, "ready_for_routine")
})

test("captures an identity only after explicit mutation and returns revision conflicts for stale saves", async () => {
  const subject = gateway()
  await createDraft(subject)
  const search = await subject.search({
    category: "conditioner",
    query: "condition",
    requestToken: 1,
  })
  assert.equal(search.status, "ready")
  assert.equal(search.result.candidates.length > 0, true)

  const selected = search.result.candidates[0]
  const saved = await subject.mutate({
    draftId: "draft-1",
    expectedRevision: 0,
    mutation: {
      type: "capture_catalog_candidate",
      candidateId: selected.candidateId,
      frequencyRange: "weekly_2x",
    },
  })
  assert.equal(saved.status, "saved")
  assert.equal(saved.draft.products[0]?.identity.kind, "catalog_product")
  assert.equal(saved.draft.products[0]?.identity.productId, selected.productId)

  const conflict = await subject.mutate({
    draftId: "draft-1",
    expectedRevision: 0,
    mutation: { type: "complete_capture_category", category: "conditioner" },
  })
  assert.equal(conflict.status, "conflict")
  assert.equal(conflict.latestDraft.revision, saved.draft.revision)
})

test("Labs fixture evaluates and resolves only semantic Stage 3 decision intents", async () => {
  const subject = gateway()
  await createDraft(subject)
  const search = await subject.search({
    category: "conditioner",
    query: "condition",
    requestToken: 1,
  })
  assert.equal(search.status, "ready")
  const captured = await subject.mutate({
    draftId: "draft-1",
    expectedRevision: 0,
    mutation: {
      type: "capture_catalog_candidate",
      candidateId: search.result.candidates[0]!.candidateId,
      frequencyRange: "weekly_2x",
    },
  })
  assert.equal(captured.status, "saved")
  const assigned = await subject.mutate({
    draftId: "draft-1",
    expectedRevision: captured.draft.revision,
    mutation: {
      type: "assign_roles",
      capturedProductId: captured.draft.products[0]!.capturedProductId,
      category: "conditioner",
      roles: ["conditioner_rinse_out"],
    },
  })
  assert.equal(assigned.status, "saved")
  const completedCapture = await subject.mutate({
    draftId: "draft-1",
    expectedRevision: assigned.draft.revision,
    mutation: { type: "complete_capture_category", category: "conditioner" },
  })
  assert.equal(completedCapture.status, "saved")

  const [evaluation] = await subject.evaluateDecisions({ draftId: "draft-1" })
  assert.equal(evaluation?.status, "known")
  assert.equal(evaluation?.subjectKey.startsWith("decision:conditioner:"), true)
  assert.deepEqual(evaluation?.allowedActions, ["keep_owned"])

  const resolved = await subject.resolveDecision({
    draftId: "draft-1",
    expectedRevision: completedCapture.draft.revision,
    intent: {
      type: "resolve_decision",
      subjectKey: evaluation!.subjectKey,
      action: "keep_owned",
    },
  })
  assert.equal(resolved.status, "saved")
  assert.equal(resolved.draft.decisions[0]?.choiceState, "owned_active")
  assert.equal(resolved.draft.decisions[0]?.decisionKey, evaluation?.subjectKey)
})

test("Labs fixture validates exact replacement candidates without exposing the action to legacy UI", async () => {
  const subject = gateway()
  await createDraft(subject)
  const search = await subject.search({
    category: "conditioner",
    query: "condition",
    requestToken: 1,
  })
  assert.equal(search.status, "ready")
  const firstCapture = await subject.mutate({
    draftId: "draft-1",
    expectedRevision: 0,
    mutation: {
      type: "capture_catalog_candidate",
      candidateId: search.result.candidates[0]!.candidateId,
      frequencyRange: "weekly_2x",
    },
  })
  assert.equal(firstCapture.status, "saved")
  const captured = await subject.mutate({
    draftId: "draft-1",
    expectedRevision: firstCapture.draft.revision,
    mutation: {
      type: "capture_catalog_candidate",
      candidateId: search.result.candidates[1]!.candidateId,
      frequencyRange: "weekly_2x",
    },
  })
  assert.equal(captured.status, "saved")
  const assigned = await subject.mutate({
    draftId: "draft-1",
    expectedRevision: captured.draft.revision,
    mutation: {
      type: "assign_roles",
      capturedProductId: captured.draft.products[1]!.capturedProductId,
      category: "conditioner",
      roles: ["conditioner_rinse_out"],
    },
  })
  assert.equal(assigned.status, "saved")
  const captureComplete = await subject.mutate({
    draftId: "draft-1",
    expectedRevision: assigned.draft.revision,
    mutation: { type: "complete_capture_category", category: "conditioner" },
  })
  assert.equal(captureComplete.status, "saved")

  const [evaluation] = await subject.evaluateDecisions({ draftId: "draft-1" })
  assert.equal(evaluation?.status, "known")
  assert.equal(evaluation?.status === "known" ? evaluation.verdict : null, "mismatch")
  assert.equal(evaluation?.allowedActions.includes("select_replacement"), false)
  const replacementId = `fixture-replacement-2:${evaluation!.subjectKey}`

  await assert.rejects(
    subject.resolveDecision({
      draftId: "draft-1",
      expectedRevision: captureComplete.draft.revision,
      intent: {
        type: "resolve_decision",
        subjectKey: evaluation!.subjectKey,
        action: "select_replacement",
        selectedCandidateId: "fixture-forged-product",
        selectedCandidateFactFingerprint: "fixture-facts:fixture-forged-product",
      },
    }),
    (error: unknown) =>
      error instanceof Stage3ProductsGatewayError &&
      error.code === "stage3_replacement_candidate_invalid" &&
      error.status === 409,
  )

  await assert.rejects(
    subject.resolveDecision({
      draftId: "draft-1",
      expectedRevision: captureComplete.draft.revision,
      intent: {
        type: "resolve_decision",
        subjectKey: evaluation!.subjectKey,
        action: "select_replacement",
        selectedCandidateId: replacementId,
        selectedCandidateFactFingerprint: `fixture-facts:${replacementId}:changed`,
      },
    }),
    (error: unknown) =>
      error instanceof Stage3ProductsGatewayError &&
      error.code === "stage3_replacement_candidate_invalid" &&
      error.status === 409,
  )

  const resolved = await subject.resolveDecision({
    draftId: "draft-1",
    expectedRevision: captureComplete.draft.revision,
    intent: {
      type: "resolve_decision",
      subjectKey: evaluation!.subjectKey,
      action: "select_replacement",
      selectedCandidateId: replacementId,
      selectedCandidateFactFingerprint: `fixture-facts:${replacementId}`,
    },
  })
  assert.equal(resolved.status, "saved")
  assert.equal(resolved.draft.decisions[0]?.choiceState, "planned_purchase")
  assert.equal(resolved.draft.decisions[0]?.resolutionAction, "select_replacement")
  assert.equal(resolved.draft.decisions[0]?.recommendation?.productId, replacementId)
  assert.equal(
    resolved.draft.decisions[0]?.authorityEvidence?.recommendationFactFingerprint,
    `fixture-facts:${replacementId}`,
  )
})

test("invalidates the whole unfinished draft when the refined version changes", async () => {
  const subject = gateway()
  await createDraft(subject)

  const invalidated = await subject.invalidateForRefinedVersion({
    draftId: "draft-1",
    refinedVersionId: "refined-v2",
  })

  assert.equal(invalidated.status, "stale")
  assert.equal(invalidated.draft.status, "stale")
  assert.equal(invalidated.draft.staleRefinedVersionId, "refined-v2")
})

test("records explicit no-product roles as a normal revisioned mutation", async () => {
  const subject = gateway()
  await createDraft(subject)

  const saved = await subject.mutate({
    draftId: "draft-1",
    expectedRevision: 0,
    mutation: {
      type: "mark_role_uncovered",
      uncoveredRole: {
        category: "conditioner",
        role: "conditioner_rinse_out",
        reason: "no_product_owned",
      },
    },
  })

  assert.equal(saved.status, "saved")
  assert.deepEqual(saved.draft.uncoveredRoles, [
    { category: "conditioner", role: "conditioner_rinse_out", reason: "no_product_owned" },
  ])
})

test("exposes category reopen and product removal through revisioned fixture mutations", async () => {
  const subject = gateway()
  await createDraft(subject)
  const search = await subject.search({
    category: "conditioner",
    query: "condition",
    requestToken: 1,
  })
  assert.equal(search.status, "ready")
  const captured = await subject.mutate({
    draftId: "draft-1",
    expectedRevision: 0,
    mutation: {
      type: "capture_catalog_candidate",
      candidateId: search.result.candidates[0]!.candidateId,
      frequencyRange: "weekly_2x",
    },
  })
  assert.equal(captured.status, "saved")
  const reopened = await subject.mutate({
    draftId: "draft-1",
    expectedRevision: captured.draft.revision,
    mutation: { type: "reopen_capture_category", category: "conditioner" },
  })
  assert.equal(reopened.status, "saved")
  assert.equal(reopened.draft.pass, "product_capture")
  assert.equal(reopened.draft.categoryCursor, "conditioner")

  const removed = await subject.mutate({
    draftId: "draft-1",
    expectedRevision: reopened.draft.revision,
    mutation: {
      type: "remove_captured_product",
      capturedProductId: captured.draft.products[0]!.capturedProductId,
    },
  })
  assert.equal(removed.status, "saved")
  assert.equal(removed.draft.products.length, 0)
})

test("completion freezes one opaque portfolio and routine proposal idempotently", async () => {
  const subject = gateway()
  await createDraft(subject)
  const search = await subject.search({
    category: "conditioner",
    query: "condition",
    requestToken: 1,
  })
  assert.equal(search.status, "ready")
  const captured = await subject.mutate({
    draftId: "draft-1",
    expectedRevision: 0,
    mutation: {
      type: "capture_catalog_candidate",
      candidateId: search.result.candidates[0]!.candidateId,
      frequencyRange: "weekly_2x",
    },
  })
  assert.equal(captured.status, "saved")
  const assigned = await subject.mutate({
    draftId: "draft-1",
    expectedRevision: captured.draft.revision,
    mutation: {
      type: "assign_roles",
      capturedProductId: captured.draft.products[0]!.capturedProductId,
      category: "conditioner",
      roles: ["conditioner_rinse_out"],
    },
  })
  assert.equal(assigned.status, "saved")
  const captureComplete = await subject.mutate({
    draftId: "draft-1",
    expectedRevision: assigned.draft.revision,
    mutation: { type: "complete_capture_category", category: "conditioner" },
  })
  assert.equal(captureComplete.status, "saved")
  const decided = await subject.mutate({
    draftId: "draft-1",
    expectedRevision: captureComplete.draft.revision,
    mutation: {
      type: "record_decision",
      decision: {
        decisionKey: `decision:conditioner:conditioner_rinse_out:${captureComplete.draft.products[0]!.capturedProductId}`,
        category: "conditioner",
        role: "conditioner_rinse_out",
        capturedProductId: captureComplete.draft.products[0]!.capturedProductId,
        verdict: "ideal",
        choiceState: "owned_active",
        criterionResults: [],
        recommendation: null,
        limitationAcknowledged: false,
      },
    },
  })
  assert.equal(decided.status, "saved")

  const first = await subject.complete({
    draftId: "draft-1",
    expectedRevision: decided.draft.revision,
  })
  if (first.status !== "ready_for_routine")
    throw new Error(`expected completion, received ${first.status}`)
  const second = await subject.complete({
    draftId: "draft-1",
    expectedRevision: first.draft.revision,
  })
  const resumed = await createDraft(subject)

  assert.match(first.productPortfolioVersionId, /^fixture-portfolio-/)
  assert.ok(first.routineProposalId)
  assert.match(first.routineProposalId, /^fixture-routine-proposal-/)
  assert.equal(second.status, "ready_for_routine")
  assert.equal(second.productPortfolioVersionId, first.productPortfolioVersionId)
  assert.equal(second.routineProposalId, first.routineProposalId)
  assert.equal(resumed.status, "completed")
  assert.equal(resumed.draft.status, "completed")
})
