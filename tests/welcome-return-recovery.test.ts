import assert from "node:assert/strict"
import test from "node:test"
import {
  canonicalWelcomeReturnPath,
  consumeWelcomeReturn,
  rememberWelcomeReturn,
  paypalWelcomeReturnExpiresAt,
} from "../src/app/welcome/return-recovery"

function browser(search = "?session_id=cs_live_original") {
  const values = new Map<string, string>()
  return {
    values,
    sessionStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value)
      },
      removeItem: (key: string) => {
        values.delete(key)
      },
    },
    location: { pathname: "/welcome", search },
  } as unknown as Pick<Window, "sessionStorage" | "location"> & { values: Map<string, string> }
}

test("reload recovers the same Stripe proof, once, without extra query data", () => {
  const b = browser("?session_id=cs_live_original&email=private@example.com&next=https://evil.test")
  assert.equal(rememberWelcomeReturn(b, 1000), true)
  assert.equal(consumeWelcomeReturn(b, 1001), "/welcome?session_id=cs_live_original")
  assert.equal(consumeWelcomeReturn(b, 1002), null)
})

test("PayPal subscription and one-time terminal return keep their original proof and semantics", () => {
  for (const [input, expected] of [
    ["?provider=paypal&token=original", "/welcome?provider=paypal&token=original"],
    [
      "?provider=paypal&token=original&purchase=one_time&return_state=revoked",
      "/welcome?provider=paypal&token=original&purchase=one_time&return_state=revoked",
    ],
  ]) {
    const b = browser(input)
    assert.equal(rememberWelcomeReturn(b, 1000), true)
    assert.equal(consumeWelcomeReturn(b, 1001), expected)
  }
})

test("recovery rejects external paths, missing proofs, wrong providers and invalid session ids", () => {
  for (const path of [
    "https://evil.test/welcome?session_id=cs_x",
    "//evil.test/welcome?session_id=cs_x",
    "/welcome/../auth?session_id=cs_x",
    "/welcome?provider=unknown&session_id=cs_x",
    "/welcome?provider=paypal",
    "/welcome?session_id=not_a_session",
    "/welcome?session_id=cs_x%0A",
  ]) {
    assert.equal(canonicalWelcomeReturnPath(path), null, path)
  }
})

test("expired, future and malformed browser state cannot restore a return", () => {
  for (const value of [
    "not json",
    JSON.stringify({ path: "/welcome?session_id=cs_x", savedAt: 2000 }),
    JSON.stringify({ path: "/welcome?session_id=cs_x", savedAt: -86400000 }),
    JSON.stringify({ path: "https://evil.test", savedAt: 1000 }),
  ]) {
    const b = browser()
    b.values.set("chaarlie:welcome-return:v1", value)
    assert.equal(consumeWelcomeReturn(b, 1000), null)
    assert.equal(b.values.size, 0)
  }
})

test("blocked storage prevents cleanup permission; recovery safely falls back", () => {
  const b = browser()
  Object.defineProperty(b, "sessionStorage", {
    get() {
      throw new Error("blocked")
    },
  })
  assert.equal(rememberWelcomeReturn(b), false)
  assert.equal(consumeWelcomeReturn(b), null)
})

test("legacy PayPal recovery expires at the original intent deadline, not the last render", () => {
  const intent = { expires_at: new Date(2000).toISOString(), metadata: {} }
  const expiresAt = paypalWelcomeReturnExpiresAt(intent)
  assert.equal(expiresAt, 2000)
  const b = browser("?provider=paypal&token=original")
  assert.equal(rememberWelcomeReturn(b, 1000, expiresAt), true)
  assert.equal(consumeWelcomeReturn(b, 1999), "/welcome?provider=paypal&token=original")
  assert.equal(rememberWelcomeReturn(b, 1999, expiresAt), true)
  assert.equal(consumeWelcomeReturn(b, 2000), null)
  assert.equal(rememberWelcomeReturn(b, 2001, expiresAt), false)
  assert.equal(
    paypalWelcomeReturnExpiresAt({ ...intent, metadata: { trial_enrollment_id: "trial" } }),
    undefined,
  )
})

test("oversized encoded PayPal data cannot permit destructive URL cleanup", () => {
  const b = browser("?provider=paypal&token=" + encodeURIComponent("é".repeat(4000)))
  assert.equal(rememberWelcomeReturn(b), false)
  assert.equal(b.values.size, 0)
})

test("labs keep their own URL and do not emit return analytics", () => {
  const b = browser()
  Object.assign(b.location, { pathname: "/labs/offer-page" })
  assert.equal(rememberWelcomeReturn(b), false)
  assert.equal(b.values.size, 0)
})
