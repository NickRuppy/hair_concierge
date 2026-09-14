import assert from "node:assert/strict"
import test from "node:test"
import { getPayPalAccessToken, getPayPalAppId } from "../src/lib/paypal/client"

test("trial app identity comes from the same OAuth response as the cached token", async () => {
  const previousFetch = globalThis.fetch
  const previous = {
    environment: process.env.PAYPAL_ENVIRONMENT,
    client: process.env.PAYPAL_CLIENT_ID,
    secret: process.env.PAYPAL_CLIENT_SECRET,
  }
  process.env.PAYPAL_ENVIRONMENT = "live"
  process.env.PAYPAL_CLIENT_ID = "local-fixture-client"
  process.env.PAYPAL_CLIENT_SECRET = "local-fixture-secret"
  let oauthCalls = 0
  globalThis.fetch = async (url, init) => {
    assert.equal(url, "https://api-m.paypal.com/v1/oauth2/token")
    assert.equal(init?.method, "POST")
    oauthCalls += 1
    return Response.json({
      access_token: "local-fixture-token",
      app_id: "APP-local-fixture",
      expires_in: 3600,
    })
  }
  try {
    assert.equal(await getPayPalAccessToken(), "local-fixture-token")
    assert.equal(await getPayPalAppId(), "APP-local-fixture")
    assert.equal(oauthCalls, 1)
  } finally {
    globalThis.fetch = previousFetch
    for (const [key, value] of [
      ["PAYPAL_ENVIRONMENT", previous.environment],
      ["PAYPAL_CLIENT_ID", previous.client],
      ["PAYPAL_CLIENT_SECRET", previous.secret],
    ]) {
      if (value === undefined) delete process.env[key!]
      else process.env[key!] = value
    }
  }
})
