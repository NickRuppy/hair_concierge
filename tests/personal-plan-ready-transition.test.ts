import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  applyPersonalPlanReadyPollResponse,
  canContinueToPersonalPlan,
  createPersonalPlanReadyPollRequestState,
  takePersonalPlanReadyPollRequest,
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

test("read-only polling escalates to one authoritative link request when the server signals it", () => {
  let requestState = createPersonalPlanReadyPollRequestState("poll")

  const firstPoll = takePersonalPlanReadyPollRequest(requestState)
  assert.equal(firstPoll.method, "GET")
  requestState = applyPersonalPlanReadyPollResponse("link")

  const link = takePersonalPlanReadyPollRequest(requestState)
  assert.equal(link.method, "POST")
  requestState = applyPersonalPlanReadyPollResponse(undefined)

  const nextPoll = takePersonalPlanReadyPollRequest(requestState)
  assert.equal(nextPoll.method, "GET")
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
  const arrival = readFileSync(
    new URL("../src/app/plan-bereit/plan-ready-arrival.tsx", import.meta.url),
    "utf8",
  )

  assert.match(route, /\{ status: "transient_error" \}/)
  assert.match(route, /status: 500/)
  assert.doesNotMatch(route, /catch \(error\)[\s\S]*\{ status: "source_pending" \}/)
  assert.match(route, /export async function PATCH/)
  assert.match(route, /updateMissingPlanBereitSourceFact/)
  assert.match(client, /!response\.ok \|\| body\.status === "transient_error"/)
  assert.match(client, /takePersonalPlanReadyPollRequest/)
  assert.match(client, /\/plan-bereit\/status\?lead=/)
  assert.doesNotMatch(client, /window\.location\.assign\(nextHref\)/)
  assert.match(client, /<PlanBereitArrival[\s\S]*actionHref=\{nextHref\}/)
  assert.match(client, /markPersonalPlanStageNavigation\("\/plan-start"\)/)
  assert.doesNotMatch(client, /PersonalPlanChapterTransition/)
  assert.match(client, /missingHairLength\.question/)
  assert.match(readiness, /Wie lang sind deine Haare aktuell/)
  assert.match(client, /method: "PATCH"/)
  assert.doesNotMatch(client, /storyComplete && readiness === "ready"/)
  assert.doesNotMatch(client, /data-personal-plan-ready-preview/)
  // The arrival screen ends the creation funnel: wordmark-only header, one
  // coral CTA, no chapter list promising Feinschliff/Produkt-Check as steps.
  assert.match(arrival, /Dein Idealplan ist fertig\./)
  assert.match(arrival, /Und das wartet dahinter:/)
  assert.match(arrival, /showStageProgress=\{false\}/)
  assert.doesNotMatch(arrival, /PersonalPlanJourneyOverview/)
  assert.match(client, /Wir bereiten deinen Haarplan vor\./)
  assert.match(client, /Haarplan wird geprüft/)
  assert.match(client, /<noscript>/)
  assert.doesNotMatch(client, /motion-safe:animate-spin/)
  assert.doesNotMatch(client, /Die Aktivierung dauert gerade etwas länger\. Deine Zahlung/)
  assert.doesNotMatch(client, /PERSONAL_PLAN_READY_MESSAGES/)
  assert.doesNotMatch(client, /personalPlanStoryIndexAt/)
  assert.doesNotMatch(client, /setInterval/)
  assert.doesNotMatch(client, /Zuerst siehst du, was dein Haar laut deinem Quiz braucht/)
  assert.match(route, /loadPlanBereitInitialReadiness\(admin, readinessInput\)/)
  assert.match(readiness, /\.eq\("id", leadId\)/)
  assert.match(readiness, /canLinkDirectQuizLead/)
  assert.match(readiness, /\.upsert\(output, \{ onConflict: "user_id" \}\)/)
  assert.doesNotMatch(readiness, /hair_profiles insert failed/)
  assert.doesNotMatch(readiness, /\.eq\("email", email\.toLowerCase\(\)\)/)
})
