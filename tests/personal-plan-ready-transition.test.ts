import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  canContinueToPersonalPlan,
  PERSONAL_PLAN_READY_POLL_INTERVAL_MS,
  PERSONAL_PLAN_READY_POLL_LIMIT,
} from "../src/app/plan-bereit/transition"
import { resolvePlanBereitAccessSurface } from "../src/app/plan-bereit/page"

test("backend readiness enables the CTA on the first successful poll", () => {
  assert.equal(canContinueToPersonalPlan("ready"), true)
  assert.equal(canContinueToPersonalPlan("checking"), false)
  assert.equal(canContinueToPersonalPlan("timeout"), false)
  assert.equal(canContinueToPersonalPlan("missing_source_facts"), false)
  assert.equal(canContinueToPersonalPlan("source_pending"), false)
})

test("readiness polling remains bounded to thirty seconds", () => {
  assert.equal(PERSONAL_PLAN_READY_POLL_INTERVAL_MS, 1_500)
  assert.equal(PERSONAL_PLAN_READY_POLL_LIMIT, 20)
  assert.equal(PERSONAL_PLAN_READY_POLL_INTERVAL_MS * PERSONAL_PLAN_READY_POLL_LIMIT, 30_000)
})

test("an active buyer waits for exact subscription correlation instead of entering onboarding", () => {
  assert.equal(
    resolvePlanBereitAccessSurface({
      active: true,
      oneTimeAccessState: "none",
      hasLead: false,
      hasRequestedLead: true,
    }),
    "source_pending",
  )
  assert.equal(
    resolvePlanBereitAccessSurface({
      active: true,
      oneTimeAccessState: "none",
      hasLead: false,
      hasRequestedLead: true,
      sourceLookupUnavailable: true,
    }),
    "transient_error",
  )
})

test("readiness failures are recoverable and the ready CTA stays explicit", () => {
  const route = readFileSync(
    new URL("../src/app/plan-bereit/status/route.ts", import.meta.url),
    "utf8",
  )
  const client = readFileSync(
    new URL("../src/app/plan-bereit/personal-plan-ready-client.tsx", import.meta.url),
    "utf8",
  )
  const readiness = readFileSync(
    new URL("../src/app/plan-bereit/readiness.ts", import.meta.url),
    "utf8",
  )

  assert.match(route, /\{ status: "transient_error" \}/)
  assert.match(route, /status: 500/)
  assert.doesNotMatch(route, /catch \(error\)[\s\S]*\{ status: "source_pending" \}/)
  assert.match(route, /export async function PATCH/)
  assert.match(route, /updateMissingPlanBereitSourceFact/)
  assert.match(client, /!response\.ok \|\| body\.status === "transient_error"/)
  assert.match(client, /method: attempts === 1 \? "POST" : "GET"/)
  assert.match(client, /\/plan-bereit\/status\?lead=/)
  assert.doesNotMatch(client, /window\.location\.assign\(nextHref\)/)
  assert.match(client, /<Link[\s\S]*href=\{nextHref\}[\s\S]*Bedarfsplan ansehen/)
  assert.match(client, /missingHairLength\.question/)
  assert.match(readiness, /Wie lang sind deine Haare aktuell/)
  assert.match(client, /method: "PATCH"/)
  assert.doesNotMatch(client, /storyComplete && readiness === "ready"/)
  assert.match(client, /data-personal-plan-ready-preview/)
  assert.match(client, /Das empfehlen wir für dein Haar\./)
  assert.match(client, /Basierend auf deinen Quiz-Antworten\./)
  assert.match(client, /Wir bereiten deinen Haarplan vor\./)
  assert.doesNotMatch(client, /PERSONAL_PLAN_READY_MESSAGES/)
  assert.doesNotMatch(client, /personalPlanStoryIndexAt/)
  assert.doesNotMatch(client, /setInterval/)
  assert.doesNotMatch(client, /Zuerst siehst du, was dein Haar laut deinem Quiz braucht/)
  assert.doesNotMatch(client, /wirklich zu deinem/)
  assert.match(route, /loadPlanBereitReadiness\(admin, readinessInput\)/)
  assert.match(readiness, /\.eq\("id", leadId\)/)
  assert.match(readiness, /canLinkDirectQuizLead/)
  assert.match(readiness, /\.upsert\(output, \{ onConflict: "user_id" \}\)/)
  assert.doesNotMatch(readiness, /hair_profiles insert failed/)
  assert.doesNotMatch(readiness, /\.eq\("email", email\.toLowerCase\(\)\)/)
})
