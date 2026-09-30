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

const returnTrialPricing = {
  trialDays: 7,
  monthlyAmountMinor: 999,
  annualFirstAmountMinor: 6999,
  annualRenewalAmountMinor: 9999,
}

for (const quizKind of ["legacy", "personal_plan"] as const) {
  test(`verified email return presents the scanner trial for incomplete ${quizKind} answers`, () => {
    const html = renderToStaticMarkup(
      <ResultPageClient
        leadId="11111111-1111-4111-8111-111111111111"
        name="Lea"
        quizKind={quizKind}
        quizAnswers={null}
        focusRoutine={false}
        hasAccess={false}
        returningScannerOffer
        offerVariant="scan-regal-v1"
        trialOfferPricing={returnTrialPricing}
      />,
    )
    assert.match(html, /So funktioniert der Scanner/)
    assert.match(html, /Teste Chaarlie 7 Tage kostenlos/)
    assert.match(html, /nach dem Start deiner Testphase/)
    assert.doesNotMatch(html, /Dein Haarprofil steht|data-organic-diagnostic-row="/)
    assert.match(html, /9,99/)
  })
}

test("email-return presentation preserves existing access and unavailable field tests", () => {
  for (const overrides of [{ hasAccess: true }, { fieldTestUnavailable: true }]) {
    const html = renderToStaticMarkup(
      <ResultPageClient
        leadId="11111111-1111-4111-8111-111111111111"
        name="Lea"
        quizKind="personal_plan"
        quizAnswers={null}
        focusRoutine={false}
        hasAccess={false}
        returningScannerOffer
        offerVariant="scan-regal-v1"
        trialOfferPricing={returnTrialPricing}
        {...overrides}
      />,
    )
    assert.doesNotMatch(html, /So funktioniert der Scanner|Teste Chaarlie/)
  }
})

test("result page client sends manually granted users to onboarding instead of the paid offer", () => {
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
  assert.match(html, /href="\/onboarding\?lead=11111111-1111-4111-8111-111111111111"/)
  assert.doesNotMatch(html, /Angebot:/i)
})

test("result page client preserves a validated retake destination for entitled users", () => {
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

  assert.match(
    html,
    /href="\/onboarding\?lead=11111111-1111-4111-8111-111111111111&amp;returnTo=%2Fprofile%3Fsection%3Droutine"/,
  )
})

test("an entitled existing account still sees its pending partner activation", () => {
  const html = renderToStaticMarkup(
    <ResultPageClient
      leadId="11111111-1111-4111-8111-111111111111"
      name="Lea"
      quizAnswers={quizAnswers}
      focusRoutine={false}
      hasAccess
      partnerAccess={{ activationApiPath: "/api/partner-access/activate" }}
    />,
  )

  assert.match(html, /Dein Zugang ist bereit\./i)
  assert.match(html, /Meinen Plan öffnen/i)
  assert.doesNotMatch(html, /href="\/onboarding\?lead=/)
})

test("revoking partner access does not hide an independent existing entitlement", () => {
  const html = renderToStaticMarkup(
    <ResultPageClient
      leadId="11111111-1111-4111-8111-111111111111"
      name="Lea"
      quizAnswers={quizAnswers}
      focusRoutine={false}
      hasAccess
      partnerAccessUnavailable
    />,
  )

  assert.match(html, /href="\/onboarding\?lead=/)
  assert.doesNotMatch(html, /nicht verfügbar/i)
})

test("partner work does not change the existing regular field-test unavailable state", () => {
  const html = renderToStaticMarkup(
    <ResultPageClient
      leadId="11111111-1111-4111-8111-111111111111"
      name="Lea"
      quizAnswers={quizAnswers}
      focusRoutine={false}
      hasAccess
      regularFieldTestUnavailable
    />,
  )

  assert.match(html, /Dein Testzugang ist gerade nicht verfügbar/i)
  assert.doesNotMatch(html, /href="\/onboarding\?lead=/)
})

test("a returning entitled partner does not create an empty offer-tracking envelope", () => {
  const source = readFileSync(
    new URL("../src/app/result/[leadId]/page.tsx", import.meta.url),
    "utf8",
  )
  assert.match(source, /partnerAuthorization\s*&&\s*baseOfferTracking/)
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
