import assert from "node:assert/strict"
import test from "node:test"

import { resolvePartnerJourney } from "../src/lib/partner-access/journey"

const intent = {
  invitationId: "10000000-0000-4000-8000-000000000001",
  tokenVersion: 2,
  issuedAt: 1,
  expiresAt: 9_999,
}
const funnelContext = {
  visitorId: "20000000-0000-4000-8000-000000000002",
  sessionId: "30000000-0000-4000-8000-000000000003",
  packageKey: "default_organic" as const,
  issuedAt: 1,
}

function cookie(value = "signed-intent") {
  return { get: () => ({ value }) }
}

function dependencies(overrides: Record<string, unknown> = {}) {
  return {
    decodeIntent: () => intent,
    getUser: async () => ({ id: "creator-user", email: "lea@example.test" }),
    loadInvitation: async () => ({
      normalized_email: "lea@example.test",
      token_version: 2,
      claimed_user_id: "creator-user",
      funnel_session_id: funnelContext.sessionId,
      revoked_at: null,
    }),
    ...overrides,
  }
}

test("stale partner intent never blocks an ordinary quiz journey", async () => {
  for (const resolution of [
    await resolvePartnerJourney(
      { cookies: cookie(), funnelContext },
      dependencies({ decodeIntent: () => null }),
    ),
    await resolvePartnerJourney(
      { cookies: cookie(), funnelContext: { ...funnelContext, packageKey: "personal_plan" } },
      dependencies(),
    ),
    await resolvePartnerJourney(
      { cookies: cookie(), funnelContext },
      dependencies({ getUser: async () => null }),
    ),
    await resolvePartnerJourney(
      { cookies: cookie(), funnelContext },
      dependencies({
        loadInvitation: async () => ({
          normalized_email: "other@example.test",
          token_version: 2,
          claimed_user_id: "other-user",
          funnel_session_id: "other-funnel",
          revoked_at: null,
        }),
      }),
    ),
  ]) {
    assert.deepEqual(resolution, { kind: "none" })
  }
})

test("only the exact claimed creator journey is authorized or revoked", async () => {
  assert.deepEqual(
    await resolvePartnerJourney({ cookies: cookie(), funnelContext }, dependencies()),
    {
      kind: "authorized",
      invitationId: intent.invitationId,
      userId: "creator-user",
      email: "lea@example.test",
      funnelSessionId: funnelContext.sessionId,
    },
  )
  assert.deepEqual(
    await resolvePartnerJourney(
      { cookies: cookie(), funnelContext },
      dependencies({
        loadInvitation: async () => ({
          normalized_email: "lea@example.test",
          token_version: 2,
          claimed_user_id: "creator-user",
          funnel_session_id: funnelContext.sessionId,
          revoked_at: "2026-09-01T12:00:00.000Z",
        }),
      }),
    ),
    { kind: "unavailable" },
  )
})
