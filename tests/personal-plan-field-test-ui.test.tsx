import assert from "node:assert/strict"
import test from "node:test"
import { renderToStaticMarkup } from "react-dom/server"

import { PersonalPlanFieldTestBanner } from "../src/components/personal-plan-quiz/personal-plan-quiz"
import { PersonalPlanOffer } from "../src/components/personal-plan-offer/personal-plan-offer"

test("field-test quiz presents the approved persistent German banner", () => {
  const html = renderToStaticMarkup(<PersonalPlanFieldTestBanner surface="quiz" />)

  assert.match(html, /Kostenloser Chaarlie Produkttest · keine Zahlung erforderlich/)
  assert.match(html, /data-personal-plan-field-test-banner="quiz"/)
})

test("field-test offer replaces all payment presentation with the free activation card", () => {
  const html = renderToStaticMarkup(
    <PersonalPlanOffer
      entryContext="quiz_completion"
      fieldTest
      leadId="11111111-1111-4111-8111-111111111111"
      model={{
        planTitle: "Dein Haarplan",
        planFitStatement: "Passt zu dir.",
        diagnosticRows: [
          {
            id: "one",
            title: "Eins",
            todayLabel: "Heute",
            potentialLabel: "Ziel",
            todaySegments: 1,
            potentialSegments: 2,
            summary: "Text",
          },
          {
            id: "two",
            title: "Zwei",
            todayLabel: "Heute",
            potentialLabel: "Ziel",
            todaySegments: 1,
            potentialSegments: 2,
            summary: "Text",
          },
          {
            id: "three",
            title: "Drei",
            todayLabel: "Heute",
            potentialLabel: "Ziel",
            todaySegments: 1,
            potentialSegments: 2,
            summary: "Text",
          },
        ],
      }}
    />,
  )

  assert.match(html, /data-personal-plan-field-test-card=""/)
  assert.match(html, /0 €/)
  assert.match(html, /Keine Zahlungsdaten · kein Abo · zeitlich begrenzter Testzugang/)
  assert.doesNotMatch(html, /data-offer-checkout|Stripe|PayPal/)
  assert.doesNotMatch(html, /nach dem Kauf|Rückerstattung|Geld-zurück-Garantie/)
})
