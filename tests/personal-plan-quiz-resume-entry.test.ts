import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

function read(path: string) {
  return readFileSync(path, "utf8")
}

test("personal-plan resume entry resolves or exchanges before landing rendering and tracking", () => {
  const landing = read("src/app/lp/[slug]/page.tsx")
  const resolveIndex = landing.indexOf("const landingState = await")
  const exchangeIndex = landing.indexOf("/api/quiz/personal-plan-draft/resume?")
  const renderIndex = landing.lastIndexOf("renderLandingVariant")
  const trackingIndex = landing.indexOf("<LandingTracking />")

  assert.ok(resolveIndex >= 0)
  assert.ok(exchangeIndex > resolveIndex)
  assert.ok(renderIndex > exchangeIndex)
  assert.ok(trackingIndex > renderIndex)
  assert.match(landing, /redirect\("\/lp\/haarplan"\)/)
  assert.match(
    landing,
    /\/api\/quiz\/personal-plan-draft\/resume\?\$\{PERSONAL_PLAN_QUIZ_RESUME_QUERY_KEY\}=/,
  )
  assert.doesNotMatch(landing, /returnTo|redirectTo|new URL\(resumeToken/i)
})

test("resume entry preserves the deployed strict cross-origin referrer policy", () => {
  const nextConfig = read("next.config.ts")
  assert.match(nextConfig, /Referrer-Policy", value: "strict-origin-when-cross-origin"/)
})

test("a resumed landing cannot overwrite the original funnel first-touch summary", () => {
  const funnelMigration = read(
    "supabase/migrations/20260730120000_add_funnel_session_quiz_variant.sql",
  )
  assert.match(
    funnelMigration,
    /first_touch = CASE[\s\S]*WHEN sessions\.first_touch = '\{\}'::jsonb THEN EXCLUDED\.first_touch[\s\S]*ELSE sessions\.first_touch/,
  )
})

test("resume rollout remains exact-true gated until the deployed token-log preflight is complete", () => {
  const flags = read("src/lib/funnel/flags.ts")
  const plan = read("plans/2026-07-31-silent-cross-browser-quiz-resume.md")

  assert.match(flags, /PERSONAL_PLAN_QUIZ_CROSS_BROWSER_RESUME_ENABLED === "true"/)
  assert.match(plan, /Sentry\/Vercel|infrastructure request logs/i)
  assert.match(plan, /hard rollout blocker/i)
})
