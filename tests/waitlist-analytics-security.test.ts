import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import { NextRequest } from "next/server"

import nextConfig from "../next.config"
import { postHogDestination } from "../src/lib/analytics/destinations/posthog"
import { posthog } from "../src/lib/analytics/runtime/posthog"
import { eventRoutes } from "../src/lib/analytics/routes"
import { classifyRoute, type RouteEnvironment } from "../src/lib/auth/route-classification"
import {
  parseWaitlistAttribution,
  readStoredWaitlistAttribution,
  readWaitlistAttribution,
  storeWaitlistAttribution,
} from "../src/lib/waitlist/attribution"
import { FUNNEL_SESSION_COOKIE, FUNNEL_TOUCH_COOKIE } from "../src/lib/funnel/cookie"
import { proxy } from "../src/proxy"

const production: RouteEnvironment = {
  nodeEnv: "production",
  localDevLoginEnabled: false,
}

test("waitlist routes are exact public entries and descendants remain protected", () => {
  for (const pathname of [
    "/warteliste",
    "/warteliste/b",
    "/warteliste/umfrage",
    "/warteliste/danke",
    "/api/waitlist",
    "/api/waitlist/survey",
  ]) {
    assert.equal(classifyRoute(pathname, production), "public", pathname)
  }

  for (const pathname of [
    "/warteliste/other",
    "/warteliste/b/other",
    "/api/waitlist/other",
    "/api/waitlist/survey/other",
  ]) {
    assert.equal(classifyRoute(pathname, production), "protected", pathname)
  }
})

test("waitlist pages receive noindex headers", async () => {
  const headers = await nextConfig.headers?.()
  const rule = headers?.find((entry) => entry.source === "/warteliste/:path*")

  assert.deepEqual(rule?.headers, [{ key: "X-Robots-Tag", value: "noindex, nofollow" }])
})

test("quiz-gate entry declares a page-level noindex contract", () => {
  const source = readFileSync("src/app/warteliste/b/page.tsx", "utf8")

  assert.match(source, /robots: \{ index: false, follow: false \}/)
})

test("CSP adds only the exact Typeform script and frame origins", async () => {
  const headers = await nextConfig.headers?.()
  const csp = headers
    ?.flatMap((entry) => entry.headers)
    .find((header) => header.key === "Content-Security-Policy-Report-Only")?.value

  assert.ok(csp)
  const directive = (name: string) => csp.split("; ").find((part) => part.startsWith(name)) ?? ""
  assert.match(directive("script-src"), /https:\/\/embed\.typeform\.com/)
  assert.match(directive("frame-src"), /https:\/\/form\.typeform\.com/)
  assert.doesNotMatch(csp, /https:\/\/\*\.typeform\.com/)
  assert.doesNotMatch(csp, /https:\/\/typeform\.com/)
})

test("waitlist attribution allowlists, caps, persists, and tolerates storage failures", () => {
  const source = new URLSearchParams({
    utm_source: " instagram ",
    utm_campaign: "x".repeat(200),
    email: "not-allowed@example.com",
  })
  assert.deepEqual(parseWaitlistAttribution(source), {
    utmSource: "instagram",
    utmCampaign: "x".repeat(128),
  })

  const values = new Map<string, string>()
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  }
  const attribution = readWaitlistAttribution("?utm_medium=paid_social", storage)
  assert.deepEqual(attribution, { utmMedium: "paid_social" })
  assert.deepEqual(readWaitlistAttribution("", storage), attribution)

  values.set("chaarlie_waitlist_attribution", '{"utmSource":"ok","email":"no"}')
  assert.deepEqual(readStoredWaitlistAttribution(storage), { utmSource: "ok" })

  const unavailableStorage = {
    getItem: () => {
      throw new Error("blocked")
    },
    setItem: () => {
      throw new Error("blocked")
    },
  }
  assert.deepEqual(readWaitlistAttribution("?utm_term=curly", unavailableStorage), {
    utmTerm: "curly",
  })
  assert.doesNotThrow(() => storeWaitlistAttribution({ utmTerm: "curly" }, unavailableStorage))
})

test("waitlist app analytics never emits identifiers or funnel properties", () => {
  assert.deepEqual(eventRoutes.waitlist_signup_completed, {
    customerio: false,
    meta: false,
    posthog: true,
  })
  assert.deepEqual(eventRoutes.waitlist_survey_completed, eventRoutes.waitlist_signup_completed)
  assert.deepEqual(eventRoutes.waitlist_whatsapp_clicked, eventRoutes.waitlist_signup_completed)

  const captured: unknown[][] = []
  const originalCapture = posthog.capture
  posthog.capture = ((...args: unknown[]) => {
    captured.push(args)
    return true
  }) as typeof posthog.capture
  try {
    postHogDestination.track("waitlist_signup_completed", { signupKind: "new" })
    postHogDestination.track("waitlist_survey_completed", { completion: "completed" })
    postHogDestination.track("waitlist_whatsapp_clicked", { surface: "thank_you" })
  } finally {
    posthog.capture = originalCapture
  }

  assert.deepEqual(captured, [
    ["waitlist_signup_completed", { signup_kind: "new" }],
    ["waitlist_survey_completed", { completion: "completed" }],
    ["waitlist_whatsapp_clicked", { surface: "thank_you" }],
  ])
  assert.doesNotMatch(JSON.stringify(captured), /email|token|signup_id|response_id|funnel_/i)
})

test("waitlist tracking keeps funnel and browser Customer.io isolated while gating vendors", () => {
  const source = readFileSync("src/providers/waitlist-tracking-provider.tsx", "utf8")
  assert.doesNotMatch(source, /FunnelContextBootstrap|AnalyticsRuntimeCoordinator|CustomerIo/)
  assert.match(source, /<MetaPixelProvider>/)
  assert.match(source, /initMetaPixel\(\)/)
  assert.match(source, /loadConsent\(\)/)
  assert.match(source, /consent\?\.analytics === true/)
  assert.match(source, /consent\?\.marketing === true/)
  assert.match(source, /COOKIE_CONSENT_CHANGE_EVENT/)
  assert.match(source, /configurePostHogFunnelContext\(Promise\.resolve\(null\)\)/)
})

test("proxy does not create funnel cookies for a waitlist request", async () => {
  const enabled = process.env.FUNNEL_ATTRIBUTION_ENABLED
  const secret = process.env.FUNNEL_COOKIE_SIGNING_SECRET
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const originalFetch = globalThis.fetch
  process.env.FUNNEL_ATTRIBUTION_ENABLED = "true"
  process.env.FUNNEL_COOKIE_SIGNING_SECRET = "waitlist-proxy-test-secret"
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co"
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key"
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ user: null }), {
      headers: { "content-type": "application/json" },
    })
  try {
    const response = await proxy(
      new NextRequest("https://chaarlie.de/warteliste?utm_source=instagram"),
    )
    const cookies = response.headers.get("set-cookie") ?? ""
    assert.doesNotMatch(cookies, new RegExp(`${FUNNEL_SESSION_COOKIE}|${FUNNEL_TOUCH_COOKIE}`))
  } finally {
    if (enabled === undefined) delete process.env.FUNNEL_ATTRIBUTION_ENABLED
    else process.env.FUNNEL_ATTRIBUTION_ENABLED = enabled
    if (secret === undefined) delete process.env.FUNNEL_COOKIE_SIGNING_SECRET
    else process.env.FUNNEL_COOKIE_SIGNING_SECRET = secret
    if (supabaseUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL
    else process.env.NEXT_PUBLIC_SUPABASE_URL = supabaseUrl
    if (supabaseAnonKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = supabaseAnonKey
    globalThis.fetch = originalFetch
  }
})
