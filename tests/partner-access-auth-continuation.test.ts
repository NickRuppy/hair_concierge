import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import { isPartnerAccessReturnPath } from "../src/lib/auth/partner-access-return"
import { handleAuthConfirm } from "../src/app/auth/confirm/route"

test("only the fixed partner continuation is accepted", () => {
  assert.equal(isPartnerAccessReturnPath("/partner/weiter"), true)
  assert.equal(isPartnerAccessReturnPath("/partner/weiter#handoff=signed.intent"), true)
  assert.equal(isPartnerAccessReturnPath("/partner/einladung"), false)
  assert.equal(isPartnerAccessReturnPath("/partner/weiter?next=/chat"), false)
  assert.equal(isPartnerAccessReturnPath("/partner/weiter#handoff="), false)
})

test("partner mailbox proof returns to claim continuation without generic quiz linking", async () => {
  let linkCalls = 0
  let redirected = ""
  const next = "/partner/weiter#handoff=signed.intent"
  await handleAuthConfirm(
    new Request(`https://chaarlie.de/auth/confirm?code=valid&next=${encodeURIComponent(next)}`),
    {
      exchangeCodeForSession: async () => ({ error: null }),
      verifyOtp: async () => ({ error: null }),
      getUser: async () => ({ data: { user: { id: "user", email: "lea@example.test" } } }),
      linkQuizToProfile: async () => {
        linkCalls += 1
      },
      redirect: (url) => {
        redirected = url
        return new Response(null, { status: 302, headers: { location: url } })
      },
    },
  )
  assert.equal(linkCalls, 0)
  assert.equal(redirected, `https://chaarlie.de${next}`)
})

test("partner continuation retries with the in-memory handoff after removing it from the URL", async () => {
  const source = await readFile("src/app/partner/weiter/partner-access-continuation.tsx", "utf8")
  assert.match(source, /handoffRef/)
  assert.match(source, /void continueClaim\(\)/)
  assert.doesNotMatch(source, /window\.location\.reload/)
})
