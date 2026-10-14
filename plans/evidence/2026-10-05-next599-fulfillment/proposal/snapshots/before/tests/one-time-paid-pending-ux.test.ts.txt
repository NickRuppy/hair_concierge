import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"

import {
  PersonalPlanPaidPendingRecovery,
  resolvePlanBereitAccessSurface,
} from "../src/app/plan-bereit/page"

const readyPageSource = readFileSync(
  new URL("../src/app/plan-bereit/page.tsx", import.meta.url),
  "utf8",
)

test("plan-bereit resolves the canonical source from the owned enrollment or pending entitlement", () => {
  assert.match(readyPageSource, /findOneTimePurchaseEntitlementForUser/)
  assert.match(readyPageSource, /findPersonalPlanEnrollmentForUser\(admin, user\.id\)/)
  assert.match(
    readyPageSource,
    /const entitlement = await findOneTimePurchaseEntitlementForUser\(admin, user\.id\)/,
  )
  assert.match(readyPageSource, /canonicalLeadId = entitlement\?\.consent\?\.lead_id \?\? null/)
  assert.match(
    readyPageSource,
    /canonicalLeadId = enrollmentResult\.enrollment\?\.artifactLeadId \?\? null/,
  )
  assert.doesNotMatch(readyPageSource, /findPersonalPlanLead/)
})

test("paid-pending plan-bereit stays on recovery instead of looping to onboarding or pricing", () => {
  const paidPendingBranchStart = readyPageSource.indexOf('case "paid_pending_recovery"')
  const onboardingBranchStart = readyPageSource.indexOf('case "onboarding"', paidPendingBranchStart)
  const paidPendingBranch = readyPageSource.slice(paidPendingBranchStart, onboardingBranchStart)

  assert.ok(paidPendingBranchStart >= 0)
  assert.ok(onboardingBranchStart > paidPendingBranchStart)
  assert.match(paidPendingBranch, /return <PersonalPlanPaidPendingRecovery/)
  assert.doesNotMatch(paidPendingBranch, /redirect\("\/onboarding"\)/)
  assert.doesNotMatch(paidPendingBranch, /redirect\("\/pricing"\)/)
  assert.match(readyPageSource, /Deine Zahlung ist sicher erfasst/)
  assert.match(readyPageSource, /Du musst nichts erneut kaufen/)
  assert.match(readyPageSource, /Status erneut prüfen/)
  assert.match(readyPageSource, /Support kontaktieren/)
})

test("paid-pending access chooses recovery before the normal ready client", () => {
  assert.equal(
    resolvePlanBereitAccessSurface({
      active: false,
      oneTimeAccessState: "paid_pending",
      hasLead: true,
    }),
    "paid_pending_recovery",
  )
  assert.equal(
    resolvePlanBereitAccessSurface({
      active: false,
      oneTimeAccessState: "paid_pending",
      hasLead: false,
    }),
    "paid_pending_recovery",
  )
  assert.equal(
    resolvePlanBereitAccessSurface({ active: false, oneTimeAccessState: "none", hasLead: true }),
    "pricing",
  )
  assert.equal(
    resolvePlanBereitAccessSurface({ active: true, oneTimeAccessState: "none", hasLead: false }),
    "onboarding",
  )
  assert.equal(
    resolvePlanBereitAccessSurface({ active: true, oneTimeAccessState: "active", hasLead: true }),
    "ready",
  )
})

test("paid-pending recovery renders no onboarding, pricing, or duplicate-purchase CTA", () => {
  const html = renderToStaticMarkup(
    React.createElement(PersonalPlanPaidPendingRecovery, {
      canonicalLeadId: "11111111-1111-4111-8111-111111111111",
    }),
  )

  assert.match(html, /Zahlung bestätigt/)
  assert.match(html, /Wir verknüpfen deinen Haarplan/)
  assert.match(html, /Du musst nichts erneut kaufen/)
  assert.match(html, /href="\/plan-bereit\?lead=11111111-1111-4111-8111-111111111111"/)
  assert.doesNotMatch(html, /href="\/pricing"/)
  assert.doesNotMatch(html, /href="\/onboarding"/)
  assert.doesNotMatch(html, /Plan mit Produkten verfeinern/)
  assert.doesNotMatch(html, /Jetzt kaufen/)
})
