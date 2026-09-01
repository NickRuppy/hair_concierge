import assert from "node:assert/strict"
import test from "node:test"

import { createPartnerQuizContextGetHandler } from "../src/app/api/partner-access/quiz-context/route"
import {
  getPartnerQuizContextLookupKey,
  hasPartnerAccessQuizHint,
  isPartnerQuizEntrySearch,
  parsePartnerQuizContextPayload,
} from "../src/lib/partner-access/quiz-context"

const funnelContext = {
  visitorId: "20000000-0000-4000-8000-000000000002",
  sessionId: "30000000-0000-4000-8000-000000000003",
  packageKey: "default_organic",
  issuedAt: 1,
}

function cookieStore() {
  return { get: (name: string) => ({ value: `${name}-value` }) }
}

test("creator quiz context returns only the server-authorized invitation identity", async () => {
  const handler = createPartnerQuizContextGetHandler({
    cookies: async () => cookieStore(),
    resolveFunnelCookieContext: async () => funnelContext,
    resolvePartnerJourney: async ({ funnelContext: received }) => {
      assert.deepEqual(received, funnelContext)
      return {
        kind: "authorized",
        invitationId: "10000000-0000-4000-8000-000000000001",
        userId: "creator-user",
        name: "Lea Sommer",
        email: "lea@example.test",
        funnelSessionId: funnelContext.sessionId,
      }
    },
  })

  const response = await handler()
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), {
    status: "creator",
    name: "Lea Sommer",
    email: "lea@example.test",
  })
})

test("creator quiz context distinguishes ordinary and temporarily unavailable journeys", async () => {
  for (const [kind, expected] of [
    ["none", { status: "regular" }],
    ["unavailable", { status: "unavailable" }],
  ] as const) {
    const handler = createPartnerQuizContextGetHandler({
      cookies: async () => cookieStore(),
      resolveFunnelCookieContext: async () => funnelContext,
      resolvePartnerJourney: async () => ({ kind }),
    })
    assert.deepEqual(await (await handler()).json(), expected)
  }
})

test("creator quiz context parser and metadata hint fail closed", () => {
  assert.equal(
    hasPartnerAccessQuizHint({
      app_metadata: { partner_access_invitation_id: "10000000-0000-4000-8000-000000000001" },
    }),
    true,
  )
  assert.equal(hasPartnerAccessQuizHint({ app_metadata: {} }), false)
  assert.equal(isPartnerQuizEntrySearch("?partner=1"), true)
  assert.equal(isPartnerQuizEntrySearch("?partner=0"), false)
  assert.equal(isPartnerQuizEntrySearch("?partner=1&email=other@example.test"), true)
  assert.deepEqual(
    parsePartnerQuizContextPayload({
      status: "creator",
      name: " Lea Sommer ",
      email: " LEA@Example.Test ",
    }),
    { status: "creator", name: "Lea Sommer", email: "lea@example.test" },
  )
  assert.deepEqual(parsePartnerQuizContextPayload({ status: "creator", name: "", email: "bad" }), {
    status: "unavailable",
  })
  assert.deepEqual(parsePartnerQuizContextPayload({ status: "regular" }), { status: "regular" })
  assert.deepEqual(parsePartnerQuizContextPayload(null), { status: "unavailable" })
})

test("only a stable creator hint triggers context lookup", () => {
  assert.equal(
    getPartnerQuizContextLookupKey({
      authLoading: true,
      hasMetadataHint: false,
      search: "",
      userId: null,
    }),
    "checking",
  )
  assert.equal(
    getPartnerQuizContextLookupKey({
      authLoading: true,
      hasMetadataHint: false,
      search: "?partner=1",
      userId: null,
    }),
    "marker",
  )
  assert.equal(
    getPartnerQuizContextLookupKey({
      authLoading: false,
      hasMetadataHint: true,
      search: "",
      userId: "creator-user",
    }),
    "user:creator-user",
  )
  assert.equal(
    getPartnerQuizContextLookupKey({
      authLoading: false,
      hasMetadataHint: false,
      search: "",
      userId: "regular-user",
    }),
    "regular",
  )
})
