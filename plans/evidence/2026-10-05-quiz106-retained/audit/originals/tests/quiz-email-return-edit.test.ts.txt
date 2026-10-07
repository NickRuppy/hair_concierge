import assert from "node:assert/strict"
import test from "node:test"

import { createQuizEmailReturnContextHandler } from "../src/app/api/quiz/email-return/context/route"
import {
  canInheritQuizEmailReturnConsent,
  parseQuizEmailReturnEditIdentity,
} from "../src/lib/quiz/email-return-edit"

const identity = {
  leadId: "10000000-0000-4000-8000-000000000001",
  name: "",
  email: "nick@example.com",
  marketingConsent: true,
  consentTimestamp: "2026-05-28T10:00:00.000Z",
}

test("Edit context returns token-bound identity only for the email-return funnel session", async () => {
  const get = createQuizEmailReturnContextHandler({
    cookieStore: async () => ({ get: () => ({ value: "matching-cookie" }) }) as never,
    resolveSource: async () => ({ status: "resolved" }) as never,
    resolveIdentity: async () => ({ status: "resolved", identity }),
    resolveFunnel: async () => ({
      visitorId: "20000000-0000-4000-8000-000000000002",
      sessionId: "30000000-0000-4000-8000-000000000003",
      packageKey: "customerio_scan_return_v1",
      issuedAt: Date.now(),
    }),
  })

  const response = await get(
    new Request("https://chaarlie.de/api/quiz/email-return/context?mode=edit"),
  )
  assert.deepEqual(await response.json(), {
    status: "resolved",
    lead: { name: "", email: "nick@example.com", marketingConsent: true },
  })

  const parse = parseQuizEmailReturnEditIdentity({
    status: "resolved",
    lead: { name: "", email: " Nick@Example.com ", marketingConsent: true },
  })
  assert.deepEqual(parse, { name: "", email: "nick@example.com", marketingConsent: true })
  assert.equal(canInheritQuizEmailReturnConsent(parse, "NICK@example.com", false), true)
  assert.equal(canInheritQuizEmailReturnConsent(parse, "other@example.com", false), false)
  assert.equal(canInheritQuizEmailReturnConsent(parse, "nick@example.com", true), false)
})

test("Edit context withholds identity before an email-return choice session exists", async () => {
  let identityReads = 0
  const get = createQuizEmailReturnContextHandler({
    cookieStore: async () => ({ get: () => ({ value: "cookie" }) }) as never,
    resolveSource: async () => ({ status: "resolved" }) as never,
    resolveIdentity: async () => {
      identityReads++
      return { status: "resolved", identity }
    },
    resolveFunnel: async () => null,
  })

  const response = await get(
    new Request("https://chaarlie.de/api/quiz/email-return/context?mode=edit"),
  )
  assert.deepEqual(await response.json(), { status: "invalid" })
  assert.equal(identityReads, 0)
})
