import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const welcomeClientSource = readFileSync(
  new URL("../src/app/welcome/welcome-client.tsx", import.meta.url),
  "utf8",
)

/**
 * The post-checkout bridge (founder sign-offs 02.09.2026, #503 and Follow-up A,
 * plans/2026-09-02-follow-up-transitions.md): a buyer redirected into the
 * Personal Plan continues through the destination's own loading frame instead
 * of the generic "Weiterleitung..." screen — /plan-bereit buyers get the
 * opening frame plus the beat marker, activation-ready /plan-start buyers get
 * the plan-start opening shell plus the armed stage entrance.
 */
test("plan-bereit redirects paint the opening frame and stamp the beat marker", () => {
  assert.match(welcomeClientSource, /redirectTo\.startsWith\("\/plan-bereit"\)/)
  assert.match(welcomeClientSource, /<PlanOpeningStartMarker \/>/)
  assert.match(welcomeClientSource, /markPlanOpeningStart\(\)/)
  assert.match(welcomeClientSource, /<PlanBereitArrival phase="loading"/)
})

test("activation-ready plan-start redirects share the choreography instead of the Weiterleitung flash", () => {
  assert.match(welcomeClientSource, /const opensPlanStart = redirectTo === "\/plan-start"/)
  assert.match(welcomeClientSource, /<PlanStartEntranceMarker \/>/)
  assert.match(welcomeClientSource, /markPersonalPlanStageNavigation\("\/plan-start"\)/)
  assert.match(welcomeClientSource, /<PlanStartOpening noscriptFallback=/)
})

test("other redirect targets keep the generic confirmation screen and no-JS keeps a real link", () => {
  assert.match(welcomeClientSource, /Weiterleitung\.\.\./)
  assert.match(welcomeClientSource, /Weiter zu deinem Plan/)
  assert.match(welcomeClientSource, /href=\{redirectTo\}/)
})
