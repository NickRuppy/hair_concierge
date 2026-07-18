import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { NextRequest, NextResponse } from "next/server"
import { redirectWithSupabaseCookies, updateSession } from "../src/lib/supabase/middleware"

test("allows unauthenticated marketing pages through the proxy without auth lookup", async () => {
  const response = await updateSession(new NextRequest("https://chaarlie.de/"))

  assert.equal(response.status, 200)
  assert.equal(response.headers.get("location"), null)
})

test("allows crawl resources through without auth lookup", async () => {
  for (const pathname of [
    "/robots.txt",
    "/sitemap.xml",
    "/opengraph-image",
    "/twitter-image",
    "/api/og/result/example",
  ]) {
    const response = await updateSession(new NextRequest(`https://chaarlie.de${pathname}`))

    assert.equal(response.status, 200)
    assert.equal(response.headers.get("location"), null)
  }
})

test("allows acquisition landing pages and funnel tracking through without auth lookup", async () => {
  for (const pathname of ["/lp/campaign-example", "/api/funnel/session"]) {
    const response = await updateSession(new NextRequest(`https://chaarlie.de${pathname}`))

    assert.equal(response.status, 200)
    assert.equal(response.headers.get("location"), null)
  }
})

test("passes unknown pages and APIs to Next.js without auth lookup", async () => {
  for (const pathname of ["/does-not-exist-seo-check", "/api/does-not-exist-seo-check"]) {
    const response = await updateSession(new NextRequest(`https://chaarlie.de${pathname}`))

    assert.equal(response.status, 200)
    assert.equal(response.headers.get("location"), null)
  }
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

test("lets every configured cron reach route-level auth without a session lookup", async () => {
  const vercelConfig = JSON.parse(
    readFileSync(new URL("../vercel.json", import.meta.url), "utf8"),
  ) as { crons?: Array<{ path: string }> }
  assert.ok(vercelConfig.crons?.length)

  for (const cron of vercelConfig.crons) {
    const response = await updateSession(new NextRequest(`https://chaarlie.de${cron.path}`))

    assert.equal(response.status, 200, cron.path)
    assert.equal(response.headers.get("location"), null, cron.path)
  }
})

test("redirects legacy offer links to the combined result offer with the quiz lead id", async () => {
  const response = await updateSession(
    new NextRequest("https://chaarlie.de/offer?lead_id=lead-123"),
  )

  assert.equal(response.status, 307)
  assert.equal(
    response.headers.get("location"),
    "https://chaarlie.de/result/lead-123?focus=unlock-plan",
  )
})

test("redirects bare legacy offer links to pricing", async () => {
  const response = await updateSession(new NextRequest("https://chaarlie.de/offer"))

  assert.equal(response.status, 307)
  assert.equal(response.headers.get("location"), "https://chaarlie.de/pricing")
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
