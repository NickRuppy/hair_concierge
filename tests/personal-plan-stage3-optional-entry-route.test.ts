import assert from "node:assert/strict"
import test from "node:test"

import {
  createStage3OptionalEntryRouteHandler,
  type Stage3OptionalEntryRouteDeps,
} from "../src/app/api/personal-plan/stage-3/optional-entry/route"
import { Stage3AuthoritySnapshotError } from "../src/lib/personal-plan/products/authority/snapshot"
import { CATEGORY_ROLE_POLICIES } from "../src/lib/personal-plan/products/authorities"
import { Stage3BootstrapContractError } from "../src/lib/personal-plan/products/bootstrap-response"
import { stage3DecisionKey } from "../src/lib/personal-plan/products/contracts"
import type { Stage3AuthorityEvaluation } from "../src/lib/personal-plan/products/authority/contracts"
import type { Stage3FitComparison } from "../src/lib/personal-plan/products/fit-comparison"
import type { Stage3DraftResponse } from "../src/lib/personal-plan/products/gateway"
import { createHttpStage3ProductsGateway } from "../src/lib/personal-plan/products/http-gateway"
import { buildStage3Bootstrap } from "../src/lib/personal-plan/products/stage2-entry-adapter"

const stage3Access = {
  kind: "personal_plan",
  frontier: "stage3",
  allowed: {
    stage1: true,
    stage2: true,
    stage3: true,
    stage4: false,
    stage5: false,
  },
  nextHref: "/plan-start",
  personalPlanId: "11111111-1111-4111-8111-111111111111",
} as const

const authorityVersions = Object.fromEntries(
  Object.entries(CATEGORY_ROLE_POLICIES).map(([category, policy]) => [
    category,
    policy.authorityVersion,
  ]),
) as { [K in keyof typeof CATEGORY_ROLE_POLICIES]: string }

const draftResponse: Stage3DraftResponse = {
  status: "active",
  requirements: [
    {
      category: "shampoo",
      requiredRoles: ["shampoo_everyday"],
      needSummary: "Basisreinigung",
      authorityVersion: CATEGORY_ROLE_POLICIES.shampoo.authorityVersion,
    },
  ],
  draft: {
    schemaVersion: 1,
    status: "active",
    authorityVersions: { shampoo: CATEGORY_ROLE_POLICIES.shampoo.authorityVersion },
    draftId: "22222222-2222-4222-8222-222222222222",
    userId: "owner-1",
    personalPlanId: "11111111-1111-4111-8111-111111111111",
    refinedVersionId: "33333333-3333-4333-8333-333333333333",
    staleRefinedVersionId: null,
    revision: 0,
    pass: "product_capture",
    orderedCategories: ["shampoo"],
    categoryCursor: "shampoo",
    products: [],
    roleAssignments: [],
    uncoveredRoles: [],
    decisions: [],
    completedCaptureCategories: [],
    completedDecisionKeys: [],
    createdAt: "2026-08-28T00:00:00.000Z",
    updatedAt: "2026-08-28T00:00:00.000Z",
    authoritySnapshot: {
      schemaVersion: 1,
      refinedNeedVersionId: "33333333-3333-4333-8333-333333333333",
      refinedInputHash: "fixture-input-hash",
      categoryDecisions: [],
      coverage: [],
      orderedCategories: ["shampoo"],
      inventoryOnlyCategories: [],
      authorityVersions,
    },
  },
}

function deps(overrides: Partial<Stage3OptionalEntryRouteDeps> = {}): Stage3OptionalEntryRouteDeps {
  return {
    enabled: () => true,
    getUserId: async () => "owner-1",
    loadJourneyAccess: async () => stage3Access,
    checkRateLimit: async () => ({ allowed: true }),
    openOptionalInventory: async () => draftResponse,
    gatewayFor: () => ({
      prepareLoadedDraft: async (loaded) => loaded,
      reviewDecisionBundles: async () => [],
    }),
    ...overrides,
  }
}

function request(body: unknown) {
  return new Request("http://test/api/personal-plan/stage-3/optional-entry", {
    method: "POST",
    body: JSON.stringify(body),
  })
}

function decisionReadyDraftResponse(): Stage3DraftResponse {
  return {
    ...draftResponse,
    draft: {
      ...draftResponse.draft,
      pass: "product_decisions",
      categoryCursor: null,
      uncoveredRoles: [
        { category: "shampoo", role: "shampoo_everyday", reason: "no_product_owned" },
      ],
    },
  }
}

const decisionSubjectKey = stage3DecisionKey("shampoo", "shampoo_everyday", null)
const authorityEvaluation = { subjectKey: decisionSubjectKey } as Stage3AuthorityEvaluation
const fitComparison = {
  schemaVersion: 1,
  mode: "unavailable",
  category: "shampoo",
  role: "shampoo_everyday",
  subjectKey: decisionSubjectKey,
  sourceIdentity: null,
  products: [],
  alternatives: [],
  dimensions: [],
  reason: "no_exact_product",
} as Stage3FitComparison

test("optional Stage 3 entry preserves app/auth/stage/rate gates before opening inventory", async () => {
  let response = await createStage3OptionalEntryRouteHandler(deps({ enabled: () => false }))(
    request({
      personalPlanId: "11111111-1111-4111-8111-111111111111",
      refinedVersionId: "33333333-3333-4333-8333-333333333333",
    }),
  )
  assert.deepEqual(
    [response.status, await response.json()],
    [404, { error: "personal_plan_not_available" }],
  )
  assert.equal(response.headers.get("Cache-Control"), "no-store")

  response = await createStage3OptionalEntryRouteHandler(deps({ getUserId: async () => null }))(
    request({
      personalPlanId: "11111111-1111-4111-8111-111111111111",
      refinedVersionId: "33333333-3333-4333-8333-333333333333",
    }),
  )
  assert.deepEqual([response.status, await response.json()], [401, { error: "unauthorized" }])

  let opens = 0
  response = await createStage3OptionalEntryRouteHandler(
    deps({
      loadJourneyAccess: async () => ({
        ...stage3Access,
        allowed: { ...stage3Access.allowed, stage3: false },
      }),
      openOptionalInventory: async () => {
        opens += 1
        return draftResponse
      },
    }),
  )(
    request({
      personalPlanId: "11111111-1111-4111-8111-111111111111",
      refinedVersionId: "33333333-3333-4333-8333-333333333333",
    }),
  )
  assert.deepEqual([response.status, await response.json()], [409, { error: "stage_not_ready" }])
  assert.equal(opens, 0)

  response = await createStage3OptionalEntryRouteHandler(
    deps({ checkRateLimit: async () => ({ allowed: false }) }),
  )(
    request({
      personalPlanId: "11111111-1111-4111-8111-111111111111",
      refinedVersionId: "33333333-3333-4333-8333-333333333333",
    }),
  )
  assert.deepEqual([response.status, await response.json()], [429, { error: "rate_limited" }])
  assert.match(response.headers.get("Retry-After") ?? "", /^\d+$/)
})

test("optional Stage 3 entry accepts only plan/refined ids and derives the owner server-side", async () => {
  const calls: unknown[] = []
  const handler = createStage3OptionalEntryRouteHandler(
    deps({
      openOptionalInventory: async (input) => {
        calls.push(input)
        return draftResponse
      },
    }),
  )

  let response = await handler(
    request({
      personalPlanId: "11111111-1111-4111-8111-111111111111",
      refinedVersionId: "33333333-3333-4333-8333-333333333333",
      userId: "forged",
    }),
  )
  assert.deepEqual([response.status, await response.json()], [400, { error: "invalid_request" }])

  response = await handler(
    request({
      personalPlanId: "11111111-1111-4111-8111-111111111111",
      refinedVersionId: "33333333-3333-4333-8333-333333333333",
    }),
  )
  assert.equal(response.status, 200)
  assert.match(response.headers.get("Server-Timing") ?? "", /operation;dur=/)
  assert.deepEqual(calls, [
    {
      userId: "owner-1",
      personalPlanId: "11111111-1111-4111-8111-111111111111",
      refinedVersionId: "33333333-3333-4333-8333-333333333333",
    },
  ])
  assert.deepEqual((await response.json()).requirements, draftResponse.requirements)
})

test("optional Stage 3 entry returns the complete bootstrap envelope", async () => {
  const response = await createStage3OptionalEntryRouteHandler(deps())(
    request({
      personalPlanId: "11111111-1111-4111-8111-111111111111",
      refinedVersionId: "33333333-3333-4333-8333-333333333333",
    }),
  )

  assert.equal(response.status, 200)
  const body = await response.json()
  assert.deepEqual(body.authorityEvaluations, [])
  assert.deepEqual(body.fitComparisons, [])
})

test("optional Stage 3 entry returns an aligned authoritative review bundle for a decision-ready draft", async () => {
  const reviewCalls: string[] = []
  const preparedRevision = decisionReadyDraftResponse().draft.revision + 1
  const response = await createStage3OptionalEntryRouteHandler(
    deps({
      openOptionalInventory: async () => decisionReadyDraftResponse(),
      gatewayFor: () => ({
        prepareLoadedDraft: async (loaded) => ({
          ...loaded,
          draft: { ...loaded.draft, revision: preparedRevision },
        }),
        reviewDecisionBundles: async ({ draftId }) => {
          reviewCalls.push(draftId)
          return [{ authorityEvaluation, fitComparison }]
        },
      }),
    }),
  )(
    request({
      personalPlanId: "11111111-1111-4111-8111-111111111111",
      refinedVersionId: "33333333-3333-4333-8333-333333333333",
    }),
  )

  assert.equal(response.status, 200)
  const body = await response.json()
  assert.equal(body.draft.revision, preparedRevision)
  assert.deepEqual(reviewCalls, [draftResponse.draft.draftId])
  assert.deepEqual(body.authorityEvaluations, [authorityEvaluation])
  assert.deepEqual(body.fitComparisons, [fitComparison])
})

test("incomplete optional review bundles preserve the canonical GET contract fallback", async (context) => {
  const info = context.mock.method(console, "info", () => {})
  const handler = createStage3OptionalEntryRouteHandler(
    deps({ openOptionalInventory: async () => decisionReadyDraftResponse() }),
  )
  const direct = await handler(
    request({
      personalPlanId: "11111111-1111-4111-8111-111111111111",
      refinedVersionId: "33333333-3333-4333-8333-333333333333",
    }),
  )
  assert.deepEqual(
    [direct.status, await direct.json()],
    [
      409,
      {
        error: "stage3_bootstrap_contract_violation",
        violation: "incomplete_decision_reviews",
      },
    ],
  )
  assert.equal(info.mock.calls.length, 1)
  const [event, details] = info.mock.calls[0].arguments
  assert.equal(event, "personal_plan_stage3_optional_entry_api")
  assert.equal((details as { code: string }).code, "incomplete_decision_reviews")
  const serialized = JSON.stringify(details)
  assert.equal(serialized.includes("owner-1"), false)
  assert.equal(serialized.includes(draftResponse.draft.draftId), false)

  const gateway = createHttpStage3ProductsGateway({
    fetch: (url, init) => handler(new Request(`http://test${String(url)}`, init)),
  })
  await assert.rejects(
    () =>
      gateway.openOptionalInventory!({
        personalPlanId: "11111111-1111-4111-8111-111111111111",
        refinedVersionId: "33333333-3333-4333-8333-333333333333",
      }),
    (error: unknown) =>
      error instanceof Stage3BootstrapContractError &&
      error.violation === "incomplete_decision_reviews",
  )
})

test("the actual optional route JSON passes the HTTP parser and Stage 3 bootstrap adapter", async () => {
  const handler = createStage3OptionalEntryRouteHandler(deps())
  const gateway = createHttpStage3ProductsGateway({
    fetch: (url, init) => handler(new Request(`http://test${String(url)}`, init)),
  })

  const response = await gateway.openOptionalInventory!({
    personalPlanId: "11111111-1111-4111-8111-111111111111",
    refinedVersionId: "33333333-3333-4333-8333-333333333333",
  })
  const bootstrap = buildStage3Bootstrap(response, {
    personalPlanId: "11111111-1111-4111-8111-111111111111",
    refinedVersionId: "33333333-3333-4333-8333-333333333333",
  })

  assert.equal(bootstrap.draft.draftId, draftResponse.draft.draftId)
  assert.deepEqual(bootstrap.authorityEvaluations, [])
  assert.deepEqual(bootstrap.fitComparisons, [])
})

test("optional Stage 3 entry maps and logs stale refined-source conflicts without disclosing drafts", async (context) => {
  const info = context.mock.method(console, "info", () => {})
  const response = await createStage3OptionalEntryRouteHandler(
    deps({
      openOptionalInventory: async () => {
        throw new Stage3AuthoritySnapshotError("stale_refined_source")
      },
    }),
  )(
    request({
      personalPlanId: "11111111-1111-4111-8111-111111111111",
      refinedVersionId: "33333333-3333-4333-8333-333333333333",
    }),
  )

  assert.deepEqual(
    [response.status, await response.json()],
    [409, { error: "stale_refined_source" }],
  )
  const [event, details] = info.mock.calls[0].arguments
  assert.equal(event, "personal_plan_stage3_optional_entry_api")
  assert.equal((details as { code: string }).code, "stale_refined_source")
  assert.equal(JSON.stringify(details).includes(draftResponse.draft.draftId), false)
})

test("optional Stage 3 entry logs an unknown operation failure without disclosing its message", async (context) => {
  const info = context.mock.method(console, "info", () => {})
  const response = await createStage3OptionalEntryRouteHandler(
    deps({
      openOptionalInventory: async () => {
        throw new Error(`private failure for ${draftResponse.draft.draftId}`)
      },
    }),
  )(
    request({
      personalPlanId: "11111111-1111-4111-8111-111111111111",
      refinedVersionId: "33333333-3333-4333-8333-333333333333",
    }),
  )

  assert.deepEqual(
    [response.status, await response.json()],
    [503, { error: "temporarily_unavailable" }],
  )
  const [event, details] = info.mock.calls[0].arguments
  assert.equal(event, "personal_plan_stage3_optional_entry_api")
  assert.equal((details as { code: string }).code, "temporarily_unavailable")
  assert.equal(JSON.stringify(details).includes(draftResponse.draft.draftId), false)
})
