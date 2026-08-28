import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { renderToStaticMarkup } from "react-dom/server"

import { ResultPageClient } from "../src/app/result/[leadId]/result-client"
import type { QuizAnswers } from "../src/lib/quiz/types"

const quizAnswers: QuizAnswers = {
  structure: "wavy",
  thickness: "normal",
  fingertest: "leicht_uneben",
  pulltest: "stretches_bounces",
  concerns: ["dryness"],
  goals: ["shine"],
}

/**
 * BLOCKER 1 (Codex whole-branch review). This is the LEGACY paid branch, and it
 * kept routing entitled users into `/onboarding` after round 1 fixed only the
 * `quizKind="personal_plan"` branch.
 *
 * It is reachable, not dead: an eligible legacy source becomes a Personal-Plan
 * frontier via the legacy-quiz cutover (`frontier-routing-loader.ts:55`), while
 * the frontier redirect deliberately EXEMPTS `/onboarding` paths
 * (`frontier-routing.ts:40`) — so nothing bounced the cutover cohort back out
 * of the retired flow.
 */
test("result page client sends manually granted users to their plan, not the retired onboarding", () => {
  const html = renderToStaticMarkup(
    <ResultPageClient
      leadId="11111111-1111-4111-8111-111111111111"
      name="Lea"
      quizAnswers={quizAnswers}
      focusRoutine={false}
      hasAccess
    />,
  )

  assert.match(html, /SO KOMMEN WIR DEINEM HAARZIEL NÄHER/i)
  assert.match(html, /href="\/routine"/)
  assert.doesNotMatch(html, /\/onboarding/)
  assert.doesNotMatch(html, /Angebot:/i)
})

test("the legacy paid action is frontier-agnostic — a retake returnTo cannot resurrect onboarding", () => {
  const html = renderToStaticMarkup(
    <ResultPageClient
      leadId="11111111-1111-4111-8111-111111111111"
      name="Lea"
      quizAnswers={quizAnswers}
      focusRoutine={false}
      hasAccess
      returnTo="/profile?section=routine"
    />,
  )

  // `/routine` is correct for every paid cohort: the middleware's frontier
  // redirect lands each of them on the surface they have actually reached.
  assert.match(html, /href="\/routine"/)
  assert.doesNotMatch(html, /\/onboarding/)
  assert.doesNotMatch(html, /returnTo=/)
})

test("the step-11 compatibility surface pushes the plan, not the retired onboarding", () => {
  const source = readFileSync(
    new URL("../src/components/quiz/quiz-results.tsx", import.meta.url),
    "utf8",
  )

  assert.doesNotMatch(source, /\/onboarding/)
  assert.match(source, /router\.push\("\/routine"\)/)
})

test("result page client passes persisted quiz answers into the organic offer", () => {
  const html = renderToStaticMarkup(
    <ResultPageClient
      leadId="11111111-1111-4111-8111-111111111111"
      name="Lea"
      quizAnswers={{ ...quizAnswers, density: "medium", scalp_type: "ausgeglichen" }}
      focusRoutine={false}
      focusTarget="unlock-plan"
      hasAccess={false}
    />,
  )

  assert.match(html, /Dein Haarplan ist bereit/i)
  assert.match(html, /Deine Ausgangslage/i)
  assert.match(html, /Die Highlights deines Plans/i)
  assert.match(html, /id="personal_plan_complete_plan"/i)
  assert.match(html, /id="pricing"/i)
})

test("result restart waits for a successful reset before clearing browser state and navigating", () => {
  const offerSource = readFileSync(
    new URL("../src/components/personal-plan-offer/personal-plan-offer.tsx", import.meta.url),
    "utf8",
  )

  assert.match(offerSource, /fetch\("\/api\/quiz\/personal-plan-result-return\/reset",/)
  assert.match(offerSource, /credentials: "same-origin"/)
  assert.match(offerSource, /response\.status !== 204/)
  assert.match(offerSource, /clearPersonalPlanQuizDraft/)
  assert.match(offerSource, /clearPersonalPlanPreparedPlanClaim/)
  assert.match(offerSource, /window\.location\.replace\("\/lp\/haarplan"\)/)
  const resetStatusCheck = offerSource.indexOf("response.status !== 204")
  const localDraftClear = offerSource.indexOf("clearPersonalPlanQuizDraft", resetStatusCheck)
  assert.ok(
    resetStatusCheck < localDraftClear,
    "browser data must only be cleared after the reset endpoint confirms 204",
  )
  assert.ok(
    localDraftClear < offerSource.indexOf('window.location.replace("/lp/haarplan")'),
    "navigation must follow local cleanup",
  )
  assert.match(offerSource, /Restricted browser contexts can block access/)
  assert.doesNotMatch(offerSource, /local result return reset failed/)
  assert.match(offerSource, /Das hat gerade nicht geklappt\. Bitte versuche es noch einmal\./)
  assert.doesNotMatch(offerSource, /fresh=1/)
})
