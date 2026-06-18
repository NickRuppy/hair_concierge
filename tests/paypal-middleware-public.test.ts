import assert from "node:assert/strict"
import test from "node:test"
import { NextRequest, NextResponse } from "next/server"
import { redirectWithSupabaseCookies, updateSession } from "../src/lib/supabase/middleware"

test("allows unauthenticated marketing pages through the proxy without auth lookup", async () => {
  const response = await updateSession(new NextRequest("https://chaarlie.de/"))

  assert.equal(response.status, 200)
  assert.equal(response.headers.get("location"), null)
})

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

test("preserves refreshed Supabase cookies on middleware redirects", () => {
  const supabaseResponse = NextResponse.next()
  supabaseResponse.cookies.set("sb-test-auth-token", "fresh", {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
  })

  const response = redirectWithSupabaseCookies("https://chaarlie.de/pricing", supabaseResponse)

  assert.equal(response.status, 307)
  assert.equal(response.headers.get("location"), "https://chaarlie.de/pricing")
  assert.match(response.headers.get("set-cookie") ?? "", /sb-test-auth-token=fresh/)
  assert.match(response.headers.get("set-cookie") ?? "", /HttpOnly/)
})
