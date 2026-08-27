import assert from "node:assert/strict"
import test from "node:test"

import {
  createModeratorFieldTestStartHandler,
  createModeratorFunnelSession,
} from "../src/app/api/personal-plan/field-test/moderator/start/route"

const campaignId = "10000000-0000-4000-8000-000000000001"
const user = { id: "20000000-0000-4000-8000-000000000002", email: "member@example.com" }
const now = Date.UTC(2026, 7, 27, 10, 0, 0)

function request(origin = "https://chaarlie.de") {
  return new Request("https://chaarlie.de/api/personal-plan/field-test/moderator/start", {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify({ campaignId }),
  })
}

function readyMember() {
  return {
    kind: "ready" as const,
    campaign: {
      id: campaignId,
      expiresAt: now + 30 * 24 * 60 * 60 * 1000,
      accessDurationHours: 2160,
    },
    member: { id: "member-1", userId: user.id },
  }
}

test("authenticated exact roster member gets a signed moderator intent and clean landing destination", async () => {
  const calls: string[] = []
  const handler = createModeratorFieldTestStartHandler({
    getUser: async () => user,
    resolveMember: async (input) => {
      assert.deepEqual(input, { campaignId, user })
      return readyMember()
    },
    createFunnelSession: async (input) => {
      assert.deepEqual(input, {
        campaignId,
        userId: user.id,
        visitorId: "40000000-0000-4000-8000-000000000004",
        now,
      })
      calls.push("funnel")
      return "30000000-0000-4000-8000-000000000003"
    },
    createIntent: (input) => {
      assert.equal(input.userId, user.id)
      assert.equal(input.funnelSessionId, "30000000-0000-4000-8000-000000000003")
      calls.push("intent")
      return "signed-intent"
    },
    encodeFunnelContext: async (input) => {
      assert.equal(input.sessionId, "30000000-0000-4000-8000-000000000003")
      calls.push("funnel-cookie")
      return "signed-funnel"
    },
    funnelSecret: () => "funnel-secret",
    campaignCookieSecret: () => "campaign-cookie-secret",
    moderatorIntentSecretConfigured: () => true,
    enabled: () => true,
    now: () => now,
    randomUUID: () => "40000000-0000-4000-8000-000000000004",
  })

  const response = await handler(request())
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { destination: "/lp/haarplan" })
  assert.deepEqual(calls, ["funnel", "intent", "funnel-cookie"])
  assert.match(
    response.headers.get("set-cookie") ?? "",
    /chaarlie_personal_plan_moderator_intent=signed-intent/,
  )
  assert.match(response.headers.get("set-cookie") ?? "", /chaarlie_personal_plan_field_test=/)
  assert.match(response.headers.get("set-cookie") ?? "", /chaarlie_funnel_session=signed-funnel/)
  assert.match(response.headers.get("cache-control") ?? "", /no-store/)
})

test("moderator start persists a schema-complete canonical Meta Personal Plan funnel row", async () => {
  let persisted: Record<string, unknown> | null = null
  const id = await createModeratorFunnelSession(
    {
      campaignId,
      userId: user.id,
      visitorId: "40000000-0000-4000-8000-000000000004",
      now,
    },
    {
      from(table: string) {
        assert.equal(table, "funnel_sessions")
        return {
          insert(row: Record<string, unknown>) {
            persisted = row
            return Promise.resolve({ error: null })
          },
        }
      },
    },
    () => "30000000-0000-4000-8000-000000000003",
  )

  assert.equal(id, "30000000-0000-4000-8000-000000000003")
  assert.deepEqual(persisted, {
    id,
    visitor_id: "40000000-0000-4000-8000-000000000004",
    user_id: user.id,
    package_key: "meta_personal_plan_v1",
    channel: "meta",
    landing_variant: "personal-plan-quiz",
    offer_variant: "personal-plan-v1",
    quiz_variant: "personal-plan-quiz-v1",
    first_seen_at: new Date(now).toISOString(),
    test_kind: "field_test",
    field_test_campaign_id: campaignId,
  })
})

test("wrong accounts and cross-origin requests never create a funnel or intent", async () => {
  let created = 0
  const handler = createModeratorFieldTestStartHandler({
    getUser: async () => user,
    resolveMember: async () => ({ kind: "forbidden" as const }),
    createFunnelSession: async () => {
      created += 1
      return null
    },
  })

  const wrongAccount = await handler(request())
  assert.equal(wrongAccount.status, 403)
  const crossOrigin = await handler(request("https://evil.example"))
  assert.equal(crossOrigin.status, 403)
  assert.equal(created, 0)
})

test("missing signing configuration fails before creating a funnel row", async () => {
  let created = 0
  const handler = createModeratorFieldTestStartHandler({
    getUser: async () => user,
    resolveMember: async () => readyMember(),
    funnelSecret: () => undefined,
    campaignCookieSecret: () => "campaign-cookie-secret",
    moderatorIntentSecretConfigured: () => true,
    enabled: () => true,
    createFunnelSession: async () => {
      created += 1
      return "30000000-0000-4000-8000-000000000003"
    },
  })

  const response = await handler(request())
  assert.equal(response.status, 503)
  assert.equal(created, 0)
})

test("rollout-off stops new ready members before a funnel row is created", async () => {
  let created = 0
  const handler = createModeratorFieldTestStartHandler({
    getUser: async () => user,
    resolveMember: async () => readyMember(),
    enabled: () => false,
    createFunnelSession: async () => {
      created += 1
      return "30000000-0000-4000-8000-000000000003"
    },
  })

  const response = await handler(request())
  assert.equal(response.status, 404)
  assert.equal(created, 0)
})

test("rollout-off preserves return routing for an already active moderator", async () => {
  const handler = createModeratorFieldTestStartHandler({
    getUser: async () => user,
    resolveMember: async () => ({
      kind: "active" as const,
      campaignId,
      expiresAt: new Date(now + 24 * 60 * 60 * 1000).toISOString(),
    }),
    enabled: () => false,
  })

  const response = await handler(request())
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { destination: "/plan-start" })
})
