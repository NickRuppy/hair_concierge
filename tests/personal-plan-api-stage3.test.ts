import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import {
  createStage3RouteHandlers,
  type Stage3RouteDeps,
} from "../src/app/api/personal-plan/stage-3/route"
import {
  createStage3CompleteRouteHandler,
  createStage3CompleteRouteHandlers,
} from "../src/app/api/personal-plan/stage-3/complete/route"
import { createStage3SearchRouteHandler } from "../src/app/api/personal-plan/stage-3/search/route"
import type { PersonalPlanJourneyAccess } from "../src/lib/personal-plan/journey-access"
import { Stage3AuthoritySnapshotError } from "../src/lib/personal-plan/products/authority/snapshot"

const draft = {
  schemaVersion: 1 as const,
  status: "active" as const,
  authorityVersions: {},
  draftId: "11111111-1111-4111-8111-111111111111",
  userId: "owner-1",
  personalPlanId: "22222222-2222-4222-8222-222222222222",
  refinedVersionId: "33333333-3333-4333-8333-333333333333",
  staleRefinedVersionId: null,
  revision: 2,
  pass: "product_capture" as const,
  orderedCategories: ["shampoo" as const],
  categoryCursor: "shampoo",
  products: [],
  roleAssignments: [],
  uncoveredRoles: [],
  decisions: [],
  completedCaptureCategories: [],
  completedDecisionKeys: [],
  createdAt: "2026-08-08T00:00:00.000Z",
  updatedAt: "2026-08-08T00:00:00.000Z",
}
const requirements = [
  {
    category: "shampoo" as const,
    requiredRoles: ["shampoo_everyday" as const],
    needSummary: "Reinigung",
    authorityVersion: "personal-plan.shampoo.v1",
  },
]

const stage3Access: PersonalPlanJourneyAccess = {
  kind: "personal_plan",
  personalPlanId: draft.personalPlanId,
  frontier: "stage3",
  nextHref: "/plan-start",
  allowed: { stage1: true, stage2: true, stage3: true, stage4: false, stage5: false },
}

test("Stage 3 search requires and forwards the owner draft context", async () => {
  let received: Record<string, unknown> | null = null
  const handler = createStage3SearchRouteHandler({
    enabled: () => true,
    getUserId: async () => "owner-1",
    loadJourneyAccess: async () => stage3Access,
    checkRateLimit: async () => ({ allowed: true }),
    search: async (_userId, input) => {
      received = input
      return { status: "ready" }
    },
  })

  const missing = await handler(
    new Request(
      "http://test/api/personal-plan/stage-3/search?category=shampoo&q=ogx&requestToken=1",
    ),
  )
  assert.equal(missing.status, 400)

  const response = await handler(
    new Request(
      `http://test/api/personal-plan/stage-3/search?draftId=${draft.draftId}&category=shampoo&q=ogx&requestToken=2`,
    ),
  )
  assert.equal(response.status, 200)
  assert.deepEqual(received, {
    draftId: draft.draftId,
    category: "shampoo",
    query: "ogx",
    requestToken: 2,
  })
})

function deps(overrides: Partial<Stage3RouteDeps> = {}): Stage3RouteDeps {
  return {
    enabled: () => true,
    getUserId: async () => "owner-1",
    loadJourneyAccess: async () => stage3Access,
    checkRateLimit: async () => ({ allowed: true }),
    gatewayFor: (userId) => ({
      loadOrCreate: async (input) => ({
        status: "active",
        draft: {
          ...draft,
          userId,
          personalPlanId: input.personalPlanId,
          refinedVersionId: input.refinedVersionId,
        },
        requirements,
      }),
      mutate: async () => ({ status: "saved", draft }),
      search: async () => ({
        status: "ready",
        requestToken: 1,
        result: { query: "ab", category: "shampoo", candidates: [], totalCapped: false },
      }),
      invalidateForRefinedVersion: async () => ({ status: "active", draft, requirements }),
      complete: async () => {
        throw new Error("not used")
      },
    }),
    ...overrides,
  }
}

test("Stage 3 fails closed before rate-limit and gateway work without current refined authority", async () => {
  let rateChecks = 0
  let gatewayCalls = 0
  const response = await createStage3RouteHandlers(
    deps({
      loadJourneyAccess: async () => ({
        kind: "personal_plan",
        personalPlanId: draft.personalPlanId,
        frontier: "stage2",
        nextHref: "/plan-start",
        allowed: { stage1: true, stage2: true, stage3: false, stage4: false, stage5: false },
      }),
      checkRateLimit: async () => {
        rateChecks += 1
        return { allowed: true }
      },
      gatewayFor: () => {
        gatewayCalls += 1
        return deps().gatewayFor("owner-1")
      },
    }),
  ).PATCH(
    new Request("http://test/api/personal-plan/stage-3", {
      method: "PATCH",
      body: JSON.stringify({
        draftId: draft.draftId,
        expectedRevision: draft.revision,
        mutation: { type: "remove_captured_product", capturedProductId: "x" },
      }),
    }),
  )
  assert.deepEqual([response!.status, await response!.json()], [409, { error: "stage_not_ready" }])
  assert.equal(rateChecks, 0)
  assert.equal(gatewayCalls, 0)
})

test("Stage 3 main boundary preserves flag, auth, validation and per-owner rate-limit outcomes", async () => {
  const url = `http://test/api/personal-plan/stage-3?personalPlanId=${draft.personalPlanId}&refinedVersionId=${draft.refinedVersionId}`
  let response = await createStage3RouteHandlers(deps({ enabled: () => false })).GET(
    new Request(url),
  )
  assert.deepEqual(
    [response!.status, await response!.json()],
    [404, { error: "personal_plan_not_available" }],
  )
  response = await createStage3RouteHandlers(deps({ getUserId: async () => null })).GET(
    new Request(url),
  )
  assert.deepEqual([response!.status, await response!.json()], [401, { error: "unauthorized" }])
  response = await createStage3RouteHandlers(deps()).GET(
    new Request("http://test/api/personal-plan/stage-3"),
  )
  assert.deepEqual([response!.status, await response!.json()], [400, { error: "invalid_request" }])
  response = await createStage3RouteHandlers(
    deps({
      checkRateLimit: async (id) => {
        assert.equal(id, "owner-1")
        return { allowed: false }
      },
    }),
  ).PATCH(
    new Request(url, {
      method: "PATCH",
      body: JSON.stringify({
        draftId: draft.draftId,
        expectedRevision: 2,
        mutation: { type: "remove_captured_product", capturedProductId: "x" },
      }),
    }),
  )
  assert.equal(response!.status, 429)
  assert.match(response!.headers.get("Retry-After") ?? "", /^[1-9][0-9]?$/)
})

test("Stage 3 PATCH applies aggregate and parsed-family limits with fixed-window retry timing", async () => {
  const configs: Array<{ prefix: string; limit: number }> = []
  const response = await createStage3RouteHandlers(
    deps({
      checkRateLimit: async (_id, config) => {
        configs.push({ prefix: config.prefix, limit: config.limit })
        return { allowed: false }
      },
    }),
  ).PATCH(
    new Request("http://test/api/personal-plan/stage-3", {
      method: "PATCH",
      body: JSON.stringify({
        draftId: draft.draftId,
        expectedRevision: draft.revision,
        mutation: { type: "reopen_capture_category", category: "shampoo" },
      }),
    }),
  )
  assert.equal(response!.status, 429)
  assert.deepEqual(configs, [{ prefix: "personal-plan-stage3-mutation", limit: 90 }])
  assert.match(response!.headers.get("Retry-After") ?? "", /^[1-9][0-9]?$/)
  assert.match(response!.headers.get("Server-Timing") ?? "", /rate_limit;dur=/)
})

test("Stage 3 PATCH consumes the capture and decision family budgets after the aggregate", async () => {
  const configs: Array<{ prefix: string; limit: number }> = []
  const handlers = createStage3RouteHandlers(
    deps({
      checkRateLimit: async (_id, config) => {
        configs.push({ prefix: config.prefix, limit: config.limit })
        return { allowed: true }
      },
      gatewayFor: (userId) =>
        ({
          ...deps().gatewayFor(userId),
          resolveDecision: async () => ({ status: "saved", draft }),
        }) as never,
    }),
  )
  let response = await handlers.PATCH(
    new Request("http://test/api/personal-plan/stage-3", {
      method: "PATCH",
      body: JSON.stringify({
        draftId: draft.draftId,
        expectedRevision: draft.revision,
        mutation: { type: "reopen_capture_category", category: "shampoo" },
      }),
    }),
  )
  assert.equal(response!.status, 200)
  response = await handlers.PATCH(
    new Request("http://test/api/personal-plan/stage-3", {
      method: "PATCH",
      body: JSON.stringify({
        draftId: draft.draftId,
        expectedRevision: draft.revision,
        intent: {
          type: "resolve_decision",
          subjectKey: "decision:shampoo:shampoo_everyday:capture-a",
          action: "keep_owned",
        },
      }),
    }),
  )
  assert.equal(response!.status, 200)
  assert.deepEqual(configs, [
    { prefix: "personal-plan-stage3-mutation", limit: 90 },
    { prefix: "personal-plan-stage3-capture", limit: 30 },
    { prefix: "personal-plan-stage3-mutation", limit: 90 },
    { prefix: "personal-plan-stage3-decision", limit: 60 },
  ])
})

test("Stage 3 completion translates internal not_ready and includes timing on early rate limits", async () => {
  const rateLimited = createStage3CompleteRouteHandler({
    enabled: () => true,
    getUserId: async () => "owner-1",
    loadJourneyAccess: async () => stage3Access,
    checkRateLimit: async () => ({ allowed: false }),
    complete: async () => ({ status: "not_ready", draft }),
  } as never)
  let response = await rateLimited(
    new Request("http://test/api/personal-plan/stage-3/complete", { method: "POST", body: "{}" }),
  )
  assert.equal(response.status, 429)
  assert.match(response.headers.get("Server-Timing") ?? "", /rate_limit;dur=/)
  assert.match(response.headers.get("Retry-After") ?? "", /^[1-9][0-9]?$/)

  const notReady = createStage3CompleteRouteHandler({
    enabled: () => true,
    getUserId: async () => "owner-1",
    loadJourneyAccess: async () => stage3Access,
    checkRateLimit: async () => ({ allowed: true }),
    complete: async () => ({ status: "not_ready", draft }),
  } as never)
  response = await notReady(
    new Request("http://test/api/personal-plan/stage-3/complete", {
      method: "POST",
      body: JSON.stringify({ draftId: draft.draftId, expectedRevision: draft.revision }),
    }),
  )
  assert.deepEqual(
    [response.status, await response.json()],
    [409, { error: "completion_not_ready" }],
  )
})

test("Stage 3 completion receipt is read-only and not mutation rate limited", async () => {
  let rateChecks = 0
  let receivedOwner = ""
  let receivedDraftId = ""
  const handlers = createStage3CompleteRouteHandlers({
    enabled: () => true,
    getUserId: async () => "owner-1",
    loadJourneyAccess: async () => stage3Access,
    checkRateLimit: async () => {
      rateChecks += 1
      return { allowed: false }
    },
    loadCompletionReceipt: async (userId, input) => {
      receivedOwner = userId
      receivedDraftId = input.draftId
      return {
        status: "ready_for_routine",
        draft: { ...draft, status: "completed", pass: "ready_for_routine" },
        portfolio: { schemaVersion: 1, portfolioVersionId: "portfolio-1" },
        personalPlanId: draft.personalPlanId,
        refinedVersionId: draft.refinedVersionId,
        productPortfolioVersionId: "portfolio-1",
        routineProposalId: "routine-proposal-1",
        next: { stage: 4, href: "/routine" },
      } as never
    },
    complete: async () => {
      throw new Error("not used")
    },
  })

  const response = await handlers.GET(
    new Request(`http://test/api/personal-plan/stage-3/complete?draftId=${draft.draftId}`),
  )
  const body = (await response.json()) as Record<string, unknown>

  assert.equal(response.status, 200)
  assert.equal(body.status, "ready_for_routine")
  assert.equal(receivedOwner, "owner-1")
  assert.equal(receivedDraftId, draft.draftId)
  assert.equal(rateChecks, 0)
})

test("Stage 3 main boundary derives owner server-side and maps conflicts", async () => {
  let owner = ""
  const handlers = createStage3RouteHandlers(
    deps({
      gatewayFor: (userId) => {
        owner = userId
        return {
          ...deps().gatewayFor(userId),
          mutate: async () => ({ status: "conflict", latestDraft: draft }),
        }
      },
    }),
  )
  const response = await handlers.PATCH(
    new Request("http://test/api/personal-plan/stage-3", {
      method: "PATCH",
      body: JSON.stringify({
        draftId: draft.draftId,
        expectedRevision: 2,
        mutation: { type: "remove_captured_product", capturedProductId: "x" },
      }),
    }),
  )
  assert.equal(owner, "owner-1")
  assert.deepEqual(
    [response!.status, await response!.json()],
    [409, { error: "revision_conflict", latestDraft: draft }],
  )
})

test("Stage 3 accepts an identifier-only atomic category replacement and rejects display text", async () => {
  let received: unknown = null
  const handlers = createStage3RouteHandlers(
    deps({
      gatewayFor: (userId) => ({
        ...deps().gatewayFor(userId),
        mutate: async (input) => {
          received = input.mutation
          return { status: "saved", draft }
        },
      }),
    }),
  )
  const mutation = {
    type: "replace_capture_category",
    category: "shampoo",
    refinedNeedVersionId: draft.refinedVersionId,
    refinedInputHash: "hash-a",
    categoryAuthorityVersion: "personal-plan.shampoo.v1",
    candidates: [
      {
        kind: "catalog",
        candidateId: "catalog-a",
        frequencyRange: "weekly_2x",
        roles: ["shampoo_everyday"],
      },
    ],
    uncoveredRoles: [],
  }
  let response = await handlers.PATCH(
    new Request("http://test/api/personal-plan/stage-3", {
      method: "PATCH",
      body: JSON.stringify({ draftId: draft.draftId, expectedRevision: draft.revision, mutation }),
    }),
  )
  assert.equal(response!.status, 200)
  assert.deepEqual(received, mutation)

  response = await handlers.PATCH(
    new Request("http://test/api/personal-plan/stage-3", {
      method: "PATCH",
      body: JSON.stringify({
        draftId: draft.draftId,
        expectedRevision: draft.revision,
        mutation: {
          ...mutation,
          candidates: [{ ...mutation.candidates[0], displayName: "forged" }],
        },
      }),
    }),
  )
  assert.equal(response!.status, 400)
})

test("Stage 3 GET is not mutation-rate-limited and PATCH rejects forged/server-only payloads", async () => {
  let rateChecks = 0
  const handlers = createStage3RouteHandlers(
    deps({
      checkRateLimit: async () => {
        rateChecks += 1
        return { allowed: true }
      },
    }),
  )
  const url = `http://test/api/personal-plan/stage-3?personalPlanId=${draft.personalPlanId}&refinedVersionId=${draft.refinedVersionId}`
  let response = await handlers.GET(new Request(url))
  assert.equal(response!.status, 200)
  assert.equal(rateChecks, 0)

  response = await handlers.PATCH(
    new Request(url, {
      method: "PATCH",
      body: JSON.stringify({
        draftId: draft.draftId,
        expectedRevision: 2,
        mutation: {
          type: "capture_pending_submission",
          userProductId: "forged",
          submissionId: "forged",
          displayName: "forged",
          category: "shampoo",
          reviewStatus: "pending_review",
          frequencyRange: "weekly_1x",
        },
      }),
    }),
  )
  assert.deepEqual([response!.status, await response!.json()], [400, { error: "invalid_request" }])
  assert.equal(rateChecks, 0)

  response = await handlers.PATCH(
    new Request(url, {
      method: "PATCH",
      body: JSON.stringify({
        draftId: draft.draftId,
        expectedRevision: 2,
        mutation: {
          type: "record_decision",
          decision: {
            decisionKey: "decision:shampoo:shampoo_everyday:forged",
            category: "shampoo",
            role: "shampoo_everyday",
            capturedProductId: "forged",
            verdict: "ideal",
            choiceState: "owned_active",
            criterionResults: [],
            recommendation: null,
            limitationAcknowledged: false,
          },
        },
      }),
    }),
  )
  assert.deepEqual([response!.status, await response!.json()], [400, { error: "invalid_request" }])
})

test("Stage 3 GET exposes the authoritative refined requirements", async () => {
  const url = `http://test/api/personal-plan/stage-3?personalPlanId=${draft.personalPlanId}&refinedVersionId=${draft.refinedVersionId}`
  const response = await createStage3RouteHandlers(deps()).GET(new Request(url))
  const body = await response!.json()
  assert.deepEqual(body.requirements, requirements)
  assert.deepEqual(body.authorityEvaluations, [])
})

test("Stage 3 GET exposes server authority projections after capture", async () => {
  let evaluatedDraftId = ""
  const response = await createStage3RouteHandlers(
    deps({
      gatewayFor: (userId) => ({
        ...deps().gatewayFor(userId),
        loadOrCreate: async () => ({
          status: "active",
          draft: { ...draft, pass: "product_decisions" as const },
          requirements,
        }),
        evaluateDecisions: async ({ draftId }) => {
          evaluatedDraftId = draftId
          return [
            {
              status: "unknown" as const,
              category: "shampoo" as const,
              subjectKey: "decision:shampoo:shampoo_everyday:capture-a",
              missingFacts: ["verified_protocol"],
              criteria: [],
              allowedActions: ["leave_uncovered" as const],
              coverageRuleIds: [],
            },
          ]
        },
      }),
    }),
  ).GET(
    new Request(
      `http://test/api/personal-plan/stage-3?personalPlanId=${draft.personalPlanId}&refinedVersionId=${draft.refinedVersionId}`,
    ),
  )
  const body = await response!.json()
  assert.equal(response!.status, 200)
  assert.equal(evaluatedDraftId, draft.draftId)
  assert.equal(body.authorityEvaluations[0]?.status, "unknown")
})

test("Stage 3 GET preserves stale refined authority as a recoverable conflict", async () => {
  const response = await createStage3RouteHandlers(
    deps({
      gatewayFor: (userId) => ({
        ...deps().gatewayFor(userId),
        loadOrCreate: async () => ({
          status: "active",
          draft: { ...draft, pass: "product_decisions" as const },
          requirements,
        }),
        evaluateDecisions: async () => {
          throw new Stage3AuthoritySnapshotError("stale_refined_source")
        },
      }),
    }),
  ).GET(
    new Request(
      `http://test/api/personal-plan/stage-3?personalPlanId=${draft.personalPlanId}&refinedVersionId=${draft.refinedVersionId}`,
    ),
  )

  assert.deepEqual(
    [response!.status, await response!.json()],
    [409, { error: "stale_refined_source" }],
  )
})

test("Stage 3 GET returns a refined-source restart when draft creation sees a moved pointer", async () => {
  const response = await createStage3RouteHandlers(
    deps({
      gatewayFor: (userId) => ({
        ...deps().gatewayFor(userId),
        loadOrCreate: async () => {
          throw new Stage3AuthoritySnapshotError("stale_refined_source")
        },
      }),
    }),
  ).GET(
    new Request(
      `http://test/api/personal-plan/stage-3?personalPlanId=${draft.personalPlanId}&refinedVersionId=${draft.refinedVersionId}`,
    ),
  )

  assert.deepEqual(
    [response!.status, await response!.json()],
    [409, { error: "stale_refined_source" }],
  )
})

test("Stage 3 completion returns a refined-source restart rather than a revision conflict", async () => {
  const handler = createStage3CompleteRouteHandler({
    enabled: () => true,
    getUserId: async () => "owner-1",
    loadJourneyAccess: async () => stage3Access,
    checkRateLimit: async () => ({ allowed: true }),
    complete: async () => {
      throw new Stage3AuthoritySnapshotError("stale_refined_source")
    },
  } as never)
  const response = await handler(
    new Request("http://test/api/personal-plan/stage-3/complete", {
      method: "POST",
      body: JSON.stringify({ draftId: draft.draftId, expectedRevision: draft.revision }),
    }),
  )

  assert.deepEqual(
    [response.status, await response.json()],
    [409, { error: "stale_refined_source" }],
  )
})

test("Stage 3 PATCH preserves a stale refined source without retrying the obsolete mutation", async () => {
  let mutationCalls = 0
  const response = await createStage3RouteHandlers(
    deps({
      gatewayFor: (userId) => ({
        ...deps().gatewayFor(userId),
        mutate: async () => {
          mutationCalls += 1
          throw new Stage3AuthoritySnapshotError("stale_refined_source")
        },
      }),
    }),
  ).PATCH(
    new Request("http://test/api/personal-plan/stage-3", {
      method: "PATCH",
      body: JSON.stringify({
        draftId: draft.draftId,
        expectedRevision: draft.revision,
        mutation: { type: "remove_captured_product", capturedProductId: "capture-a" },
      }),
    }),
  )

  assert.equal(mutationCalls, 1)
  assert.deepEqual(
    [response!.status, await response!.json()],
    [409, { error: "stale_refined_source" }],
  )
})

test("Stage 3 PATCH accepts semantic decision intent without accepting a client decision", async () => {
  let received: unknown = null
  const response = await createStage3RouteHandlers(
    deps({
      gatewayFor: (userId) =>
        ({
          ...deps().gatewayFor(userId),
          resolveDecision: async (input: unknown) => {
            received = input
            return { status: "saved", draft }
          },
        }) as never,
    }),
  ).PATCH(
    new Request("http://test/api/personal-plan/stage-3", {
      method: "PATCH",
      body: JSON.stringify({
        draftId: draft.draftId,
        expectedRevision: draft.revision,
        intent: {
          type: "resolve_decision",
          subjectKey: "decision:shampoo:shampoo_everyday:capture-a",
          action: "keep_owned",
        },
      }),
    }),
  )
  assert.equal(response!.status, 200)
  assert.match(response!.headers.get("Server-Timing") ?? "", /auth;dur=/)
  assert.match(response!.headers.get("Server-Timing") ?? "", /journey;dur=/)
  assert.match(response!.headers.get("Server-Timing") ?? "", /rate_limit;dur=/)
  assert.match(response!.headers.get("Server-Timing") ?? "", /gateway;dur=/)
  assert.deepEqual(received, {
    draftId: draft.draftId,
    expectedRevision: draft.revision,
    intent: {
      type: "resolve_decision",
      subjectKey: "decision:shampoo:shampoo_everyday:capture-a",
      action: "keep_owned",
    },
  })
})

test("Stage 3 PATCH accepts one revision-safe semantic decision batch", async () => {
  let received: unknown = null
  const response = await createStage3RouteHandlers(
    deps({
      gatewayFor: (userId) =>
        ({
          ...deps().gatewayFor(userId),
          resolveDecisions: async (input: unknown) => {
            received = input
            return { status: "saved", draft }
          },
        }) as never,
    }),
  ).PATCH(
    new Request("http://test/api/personal-plan/stage-3", {
      method: "PATCH",
      body: JSON.stringify({
        draftId: draft.draftId,
        expectedRevision: draft.revision,
        intents: [
          {
            type: "resolve_decision",
            subjectKey: "decision:shampoo:shampoo_everyday:capture-a",
            action: "keep_owned",
          },
          {
            type: "resolve_decision",
            subjectKey: "decision:conditioner:conditioner_rinse_out:capture-b",
            action: "keep_owned",
          },
        ],
      }),
    }),
  )
  assert.equal(response!.status, 200)
  assert.deepEqual(received, {
    draftId: draft.draftId,
    expectedRevision: draft.revision,
    intents: [
      {
        type: "resolve_decision",
        subjectKey: "decision:shampoo:shampoo_everyday:capture-a",
        action: "keep_owned",
      },
      {
        type: "resolve_decision",
        subjectKey: "decision:conditioner:conditioner_rinse_out:capture-b",
        action: "keep_owned",
      },
    ],
  })
})

test("Stage 3 PATCH accepts one atomic complete category-role replacement", async () => {
  let received: unknown = null
  const response = await createStage3RouteHandlers(
    deps({
      gatewayFor: (userId) => ({
        ...deps().gatewayFor(userId),
        mutate: async (input) => {
          received = input
          return { status: "saved", draft }
        },
      }),
    }),
  ).PATCH(
    new Request("http://test/api/personal-plan/stage-3", {
      method: "PATCH",
      body: JSON.stringify({
        draftId: draft.draftId,
        expectedRevision: draft.revision,
        mutation: {
          type: "replace_category_role_assignments",
          category: "shampoo",
          assignments: [
            {
              capturedProductId: "shampoo-primary",
              category: "shampoo",
              roles: ["shampoo_everyday"],
            },
          ],
        },
      }),
    }),
  )

  assert.equal(response!.status, 200)
  assert.deepEqual(received, {
    draftId: draft.draftId,
    expectedRevision: draft.revision,
    mutation: {
      type: "replace_category_role_assignments",
      category: "shampoo",
      assignments: [
        {
          capturedProductId: "shampoo-primary",
          category: "shampoo",
          roles: ["shampoo_everyday"],
        },
      ],
    },
  })
})

test("Stage 3 PATCH accepts atomic capture finalization with assignments and gaps", async () => {
  let received: unknown = null
  const response = await createStage3RouteHandlers(
    deps({
      gatewayFor: (userId) => ({
        ...deps().gatewayFor(userId),
        mutate: async (input) => {
          received = input
          return { status: "saved", draft }
        },
      }),
    }),
  ).PATCH(
    new Request("http://test/api/personal-plan/stage-3", {
      method: "PATCH",
      body: JSON.stringify({
        draftId: draft.draftId,
        expectedRevision: draft.revision,
        mutation: {
          type: "finalize_capture_category",
          category: "shampoo",
          assignments: [],
          uncoveredRoles: [
            { category: "shampoo", role: "shampoo_everyday", reason: "no_product_owned" },
          ],
        },
      }),
    }),
  )

  assert.equal(response!.status, 200)
  assert.deepEqual(received, {
    draftId: draft.draftId,
    expectedRevision: draft.revision,
    mutation: {
      type: "finalize_capture_category",
      category: "shampoo",
      assignments: [],
      uncoveredRoles: [
        { category: "shampoo", role: "shampoo_everyday", reason: "no_product_owned" },
      ],
    },
  })
})

test("Stage 3 PATCH rejects the legacy partial per-product role mutation", async () => {
  const response = await createStage3RouteHandlers(deps()).PATCH(
    new Request("http://test/api/personal-plan/stage-3", {
      method: "PATCH",
      body: JSON.stringify({
        draftId: draft.draftId,
        expectedRevision: draft.revision,
        mutation: {
          type: "assign_roles",
          capturedProductId: "shampoo-primary",
          category: "shampoo",
          roles: ["shampoo_everyday"],
        },
      }),
    }),
  )

  assert.deepEqual([response!.status, await response!.json()], [400, { error: "invalid_request" }])
})

test("production Stage 3 completion composes the deterministic compiler and one-RPC stager", async () => {
  const source = await readFile(
    new URL("../src/app/api/personal-plan/stage-3/complete/route.ts", import.meta.url),
    "utf8",
  )
  assert.match(source, /compiler:\s*createInitialRoutineCandidateCompiler\(\)/)
  assert.match(source, /stager:\s*createRoutineProposalStagerRpcAdapter\(\{\s*client:/)
})
