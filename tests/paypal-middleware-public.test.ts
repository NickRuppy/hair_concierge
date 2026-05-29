import assert from "node:assert/strict"
import test from "node:test"
import { NextRequest } from "next/server"
import { updateSession } from "../src/lib/supabase/middleware"

test("allows unauthenticated PayPal checkout API calls through the proxy", async () => {
  const response = await updateSession(
    new NextRequest("https://chaarlie.de/api/paypal/create-subscription-intent", {
      method: "POST",
    }),
  )

  assert.equal(response.status, 200)
  assert.equal(response.headers.get("location"), null)
})

test("allows unauthenticated PayPal webhook calls through the proxy", async () => {
  const response = await updateSession(
    new NextRequest("https://chaarlie.de/api/paypal/webhook", {
      method: "POST",
    }),
  )

  assert.equal(response.status, 200)
  assert.equal(response.headers.get("location"), null)
})
