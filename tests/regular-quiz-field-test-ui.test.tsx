import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { renderToStaticMarkup } from "react-dom/server"

import { ResultPageClient } from "../src/app/result/[leadId]/result-client"
import { RegularQuizFieldTestBanner } from "../src/components/regular-quiz-field-test/banner"
import {
  parseRegularQuizFieldTestActivationDestination,
  RegularQuizFieldTestActivationCard,
} from "../src/components/regular-quiz-field-test/activation-card"
import OrganicPlanOfferVariant from "../src/funnels/offers/organic-plan-v1"
import { buildQuizResultNarrative } from "../src/lib/quiz/result-narrative"
import type { QuizAnswers } from "../src/lib/quiz/types"

const quizAnswers: QuizAnswers = {
  structure: "wavy",
  thickness: "normal",
  density: "medium",
  hair_length: "long",
  fingertest: "rau",
  pulltest: "stretches_bounces",
  scalp_type: "ausgeglichen",
  has_scalp_issue: false,
  concerns: ["frizz", "dryness"],
  treatment: ["natur"],
  goals: ["less_frizz", "moisture", "shine"],
}

test("regular quiz field-test banner uses the reviewed persistent German copy", () => {
  const html = renderToStaticMarkup(<RegularQuizFieldTestBanner surface="quiz" />)

  assert.match(html, /Kostenloser Chaarlie Produkttest · keine Zahlung erforderlich/)
  assert.match(html, /data-regular-quiz-field-test-banner="quiz"/)
})

test("regular quiz field-test activation card is payment-free and targets the activation API", () => {
  const html = renderToStaticMarkup(
    <RegularQuizFieldTestActivationCard
      accessDurationHours={168}
      leadId="11111111-1111-4111-8111-111111111111"
    />,
  )

  assert.match(html, /0 €/)
  assert.match(html, /Keine Zahlungsdaten · kein Abo · 7 Tage Testzugang/)
  assert.match(html, /direkt mit deinem Personal Plan verbunden/)
  assert.match(html, /Kostenlos mit Chaarlie fortfahren/)
  assert.match(html, /data-regular-quiz-field-test-activation-card/)
  assert.doesNotMatch(html, /Stripe|PayPal|Checkout|Kauf|Garantie|Onboarding/)
})

test("regular quiz field-test activation consumes the exact server destination contract", () => {
  const destination = "/plan-bereit?lead=11111111-1111-4111-8111-111111111111"

  assert.equal(parseRegularQuizFieldTestActivationDestination({ destination }), destination)
  assert.equal(parseRegularQuizFieldTestActivationDestination({ redirectTo: destination }), null)
  assert.equal(
    parseRegularQuizFieldTestActivationDestination({
      destination: "/onboarding?lead=11111111-1111-4111-8111-111111111111",
    }),
    null,
  )
  assert.equal(parseRegularQuizFieldTestActivationDestination({ destination: "/pricing" }), null)
})

test("regular quiz field-test organic offer replaces all commercial conversion surfaces", () => {
  const narrative = buildQuizResultNarrative(quizAnswers)
  const html = renderToStaticMarkup(
    <OrganicPlanOfferVariant
      entryContext="quiz_completion"
      leadId="11111111-1111-4111-8111-111111111111"
      name="Lea"
      narrative={narrative}
      offerVariant="organic-plan-v1"
      quizAnswers={quizAnswers}
      pricingSlot={<div>Monatlich · €14,99</div>}
      regularFieldTest={{
        accessDurationHours: 168,
        activationApiPath: "/api/quiz/field-test/activate",
        identityMode: "guest",
      }}
    />,
  )

  assert.match(html, /Dein kostenloser Testzugang ist für diese Sitzung reserviert/)
  assert.match(html, /Kostenlos mit Chaarlie fortfahren/)
  assert.match(html, /Keine Zahlungsdaten · kein Abo · 7 Tage Testzugang/)
  assert.match(html, /data-offer-destination="regular_field_test_activation"/)
  assert.match(html, /data-regular-quiz-field-test-activation-card/)
  assert.doesNotMatch(html, /Monatlich|€14,99|Stripe|PayPal|Checkout/i)
  assert.doesNotMatch(html, /Geld-zurück-Garantie|direkt nach dem Kauf|Plan sichern/)
})

test("email-bound moderator organic offer remains free and uses its dedicated activation route", () => {
  const narrative = buildQuizResultNarrative(quizAnswers)
  const html = renderToStaticMarkup(
    <OrganicPlanOfferVariant
      entryContext="quiz_completion"
      leadId="11111111-1111-4111-8111-111111111111"
      name="Lea"
      narrative={narrative}
      offerVariant="organic-plan-v1"
      quizAnswers={quizAnswers}
      pricingSlot={<div>Monatlich · €14,99</div>}
      regularFieldTest={{
        accessDurationHours: 2160,
        activationApiPath: "/api/personal-plan/field-test/moderator/activate-organic",
        identityMode: "email_bound",
      }}
    />,
  )

  assert.match(html, /Starte deinen 90-Tage-Testzugang ab Aktivierung\./)
  assert.match(html, /Dein Plan bleibt in deinem Konto gespeichert\./)
  assert.match(html, /Keine Zahlungsdaten · kein Abo · 90 Tage Testzugang/)
  assert.match(html, /data-offer-destination="moderator_organic_test_activation"/)
  assert.doesNotMatch(
    html,
    /temporären Testgast|siebentägigen|Monatlich|€14,99|Stripe|PayPal|Checkout/i,
  )
})

test("legacy result client fails closed when regular field-test intent lost authorization", () => {
  const html = renderToStaticMarkup(
    <ResultPageClient
      focusRoutine={false}
      hasAccess={false}
      leadId="11111111-1111-4111-8111-111111111111"
      name="Lea"
      quizAnswers={quizAnswers}
      regularFieldTestUnavailable
    />,
  )

  assert.match(html, /Testzugang ist gerade nicht verfügbar/)
  assert.match(html, /Deine Quiz-Antworten und deine Auswertung sind gespeichert/)
  assert.doesNotMatch(html, /Stripe|PayPal|Checkout|Plan sichern|Monatlich/i)
})

test("result and quiz routing consume only server-derived regular field-test state", () => {
  const quizLayoutSource = readFileSync(
    new URL("../src/app/quiz/layout.tsx", import.meta.url),
    "utf8",
  )
  const resultPageSource = readFileSync(
    new URL("../src/app/result/[leadId]/page.tsx", import.meta.url),
    "utf8",
  )
  const fieldTestSessionLayoutSource = readFileSync(
    new URL("../src/app/test/quiz/session/layout.tsx", import.meta.url),
    "utf8",
  )

  assert.doesNotMatch(quizLayoutSource, /cookies\(\)/)
  assert.doesNotMatch(quizLayoutSource, /searchParams/)
  assert.match(resultPageSource, /resolveRegularQuizFieldTestOfferAuthorization/)
  assert.match(resultPageSource, /funnelContext\.testKind === "field_test"/)
  assert.match(resultPageSource, /lead\.quiz_kind === "legacy"/)
  assert.match(resultPageSource, /unavailable: intent && !authorization/)
  assert.match(resultPageSource, /hasRegularQuizFieldTestOfferIntent/)
  assert.match(resultPageSource, /input\.lead\.quiz_kind !== "legacy" \|\| input\.hasAccess/)
  assert.doesNotMatch(resultPageSource, /unavailable: Boolean\(cookieValue \|\| intent\)/)
  assert.match(
    resultPageSource,
    /!isRegularQuizFieldTestEnabled\(\)\) return \{ authorization: null, unavailable: intent \}/,
  )
  assert.match(fieldTestSessionLayoutSource, /redirect\("\/test\/quiz\/beendet"\)/)
  assert.doesNotMatch(fieldTestSessionLayoutSource, /notFound\(\)/)
  assert.match(fieldTestSessionLayoutSource, /index: false/)
})
