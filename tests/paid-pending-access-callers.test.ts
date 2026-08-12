import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const read = (path: string) => readFileSync(path, "utf8")

const middlewareSource = read("src/lib/supabase/middleware.ts")
const pricingSource = read("src/app/pricing/page.tsx")
const readyPageSource = read("src/app/plan-bereit/page.tsx")
const readyStatusSource = read("src/app/plan-bereit/status/route.ts")
const billingAccessSource = read("src/app/api/billing/access/route.ts")

test("protected browser and API gates distinguish paid pending from expired access", () => {
  assert.match(middlewareSource, /resolveOneTimeAccessState/)
  assert.match(middlewareSource, /Promise\.all\(/)
  assert.match(middlewareSource, /oneTimeAccessState === "paid_pending"/)
  assert.match(middlewareSource, /error: "activation_pending"/)
  assert.match(middlewareSource, /status: 409/)
  assert.match(middlewareSource, /url\.pathname = "\/plan-bereit"/)
  assert.match(middlewareSource, /error: "subscription_required"/)

  assert.ok(
    middlewareSource.indexOf('oneTimeAccessState === "paid_pending"') <
      middlewareSource.indexOf('error: "subscription_required"'),
  )
})

test("pricing keeps active access behavior and sends paid pending buyers to plan-bereit", () => {
  assert.match(pricingSource, /hasCurrentAppAccess/)
  assert.match(pricingSource, /resolveOneTimeAccessState/)
  assert.match(pricingSource, /if \(active\) redirect\("\/profile#mitgliedschaft"\)/)
  assert.match(
    pricingSource,
    /oneTimeAccessState === "paid_pending"[\s\S]*redirect\("\/plan-bereit"\)/,
  )
  assert.match(pricingSource, /redirect\(`\/reactivate\?\$\{params\.toString\(\)\}`\)/)

  assert.ok(
    pricingSource.indexOf('if (active) redirect("/profile#mitgliedschaft")') <
      pricingSource.indexOf('oneTimeAccessState === "paid_pending"'),
  )
})

test("plan-bereit renders the waiting surface for paid pending and keeps inactive fallback", () => {
  assert.match(readyPageSource, /resolveOneTimeAccessState/)
  assert.match(
    readyPageSource,
    /resolvePlanBereitAccessSurface\(\{[\s\S]*active,[\s\S]*oneTimeAccessState,[\s\S]*hasLead: false/,
  )
  assert.match(readyPageSource, /case "paid_pending_recovery":/)
  assert.match(readyPageSource, /return <PersonalPlanPaidPendingRecovery/)
  assert.match(
    readyPageSource,
    /<PersonalPlanReadyClient[\s\S]*leadId=\{canonicalLeadId\}[\s\S]*nextHref="\/plan-start"/,
  )
  assert.match(readyPageSource, /isPersonalPlanAppV1AllowedForUser\(user\.id\)/)
  assert.match(readyPageSource, /if \(!rollout\.allowed\) \{[\s\S]*redirect\("\/onboarding"\)/)
  assert.ok(
    readyPageSource.indexOf('case "paid_pending_recovery"') <
      readyPageSource.indexOf('case "ready"'),
  )
})

test("plan-bereit status returns paid pending as a successful status, not subscription required", () => {
  assert.match(readyStatusSource, /resolveOneTimeAccessState/)
  assert.match(readyStatusSource, /\{ status: "paid_pending" \}/)
  assert.match(readyStatusSource, /Cache-Control": "private, no-store"/)
  assert.match(readyStatusSource, /\{ status: "forbidden" \}/)
  assert.match(readyStatusSource, /status: 403/)

  assert.ok(
    readyStatusSource.indexOf('{ status: "paid_pending" }') <
      readyStatusSource.indexOf('{ status: "forbidden" }'),
  )
})

test("billing access API preserves hasAccess and exposes activation state additively", () => {
  assert.match(billingAccessSource, /hasAccess/)
  assert.match(billingAccessSource, /activationPending/)
  assert.match(billingAccessSource, /oneTimeAccessState/)
  assert.match(billingAccessSource, /oneTimeAccessState === "paid_pending"/)
  assert.match(
    billingAccessSource,
    /\{ hasAccess: false, activationPending: false, oneTimeAccessState: "none" \}/,
  )
})
