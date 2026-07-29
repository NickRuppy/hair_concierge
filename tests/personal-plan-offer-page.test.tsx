import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { renderToStaticMarkup } from "react-dom/server"

import { ResultPageClient } from "../src/app/result/[leadId]/result-client"
import { parsePersonalPlanOfferModel } from "../src/components/personal-plan-offer/model"
import type { PersonalPlanOfferModel } from "../src/components/personal-plan-offer/types"

const publicOfferModel: PersonalPlanOfferModel = {
  diagnosticRows: [
    {
      id: "surface",
      potentialLabel: "ruhig & glänzend",
      potentialSegments: 3,
      summary: "Dein Plan bringt Pflege und Styling in eine klare Reihenfolge.",
      title: "Oberfläche & Glanz",
      todayLabel: "unruhig",
      todaySegments: 1,
    },
    {
      id: "moisture",
      potentialLabel: "ausgeglichen",
      potentialSegments: 3,
      summary: "Die Pflege wird so aufgebaut, dass Längen genug bekommen.",
      title: "Feuchtigkeit & Pflegebalance",
      todayLabel: "wechselhaft",
      todaySegments: 2,
    },
    {
      id: "routine",
      potentialLabel: "klar",
      potentialSegments: 3,
      summary: "Dein Plan hilft dir, diese Stärke zuverlässig zu erhalten.",
      title: "Routine-Sicherheit",
      todayLabel: "unklar",
      todaySegments: 1,
    },
  ],
  planFitStatement: "Dein Haar braucht keine kompliziertere Pflege. Es braucht eine klare Routine.",
  planTitle: "Plan für ruhige Längen und klaren Glanz",
  profileLine: "Glatt · normal · empfindliche Kopfhaut",
}

test("personal plan offer renders approved hierarchy without personalized product details", () => {
  const html = renderToStaticMarkup(
    <ResultPageClient
      entryContext="quiz_completion"
      focusRoutine={false}
      hasAccess={false}
      leadId="11111111-1111-4111-8111-111111111111"
      name="Lea"
      personalPlanOffer={publicOfferModel}
      quizAnswers={null}
      quizKind="personal_plan"
    />,
  )

  assert.match(html, /Lea, dein Haarplan ist bereit/i)
  assert.doesNotMatch(html, /Persönlicher Haarpflegeplan|perfekten Haarplan/i)
  assert.doesNotMatch(html, /Plan für ruhige Längen und klaren Glanz/i)
  assert.doesNotMatch(
    html,
    /Beispielansicht|Deine Haarpflege|Dein passendes Shampoo|Dein passender Conditioner|Dein passendes Leave-in|Deine Reihenfolge/i,
  )
  assert.doesNotMatch(html, /🔒|GESPERRT/i)
  assert.match(html, /Symbolische heutige Haarsituation/i)
  assert.match(html, /Symbolisches Haarziel/i)
  assert.match(html, /Oberfläche &amp; Glanz/i)
  assert.match(html, /Feuchtigkeit &amp; Pflegebalance/i)
  assert.match(html, /Routine-Sicherheit/i)
  assert.match(html, /Heute/i)
  assert.match(html, /Dein Ziel/i)
  assert.equal((html.match(/>Heute</g) ?? []).length, 1)
  assert.equal((html.match(/>Dein Ziel</g) ?? []).length, 1)
  assert.doesNotMatch(html, /Dein Potenzial/i)
  assert.match(html, /Viel Potenzial/i)
  assert.match(html, /Gute Basis/i)
  assert.match(html, /Optimal/i)
  assert.doesNotMatch(html, />Stark<|diese Stärke/i)
  assert.doesNotMatch(html, /unruhig|wechselhaft|ruhig &amp; glänzend/i)
  assert.match(html, /Dein kompletter Haarpflegeplan/i)
  assert.match(html, /before-after-generic\.webp/i)
  assert.match(html, /Zugtest/i)
  assert.match(html, /Struktur &amp; Elastizität/i)
  assert.match(html, /Oberflächentest/i)
  assert.match(html, /Haaroberfläche &amp; Glanz/i)
  assert.match(html, /Kopfhaut-Check/i)
  assert.match(html, /Typ &amp; Zustand/i)
  assert.match(html, /Produktabgleich/i)
  assert.match(html, /Passende Pflege aus unserer Datenbank/i)
  assert.match(html, /Daraus entstehen deine Produktauswahl, Reihenfolge und Anwendung/i)
  assert.match(html, /Monatlich/i)
  assert.match(html, /€14,99/i)
  assert.match(html, /Quartal/i)
  assert.match(html, /€34,99/i)
  assert.match(html, /Beliebteste Wahl/i)
  assert.match(html, /Jährlich/i)
  assert.match(html, /€99,99/i)
  assert.match(html, /82%/i)
  assert.match(html, /73%/i)
  assert.match(html, /63%/i)
  assert.match(html, /4\.024 Antworten/i)
  assert.match(html, /Kim · Endlich verstehe ich meine Haare/i)
  assert.match(html, /Kerstin · Echte Antworten bekommen/i)
  assert.match(html, /Sarah · Nie wieder googeln vorm Regal/i)
  assert.match(html, /14 Tage Geld-zurück-Garantie/i)
  assert.match(html, /Dein Plan zu schöneren Haaren in 30 Tagen/i)
  assert.match(html, /Warum reicht nicht einfach ein neues Shampoo/i)
  assert.match(html, /Ist der Plan wirklich auf mein Haar abgestimmt/i)
  assert.match(html, /Was bekomme ich genau/i)
  assert.match(html, /Kann ich meine bisherigen Produkte weiterverwenden/i)
  assert.match(html, /Was passiert direkt nach dem Kauf/i)
  assert.equal((html.match(/data-offer-faq=/g) ?? []).length, 5)
  assert.doesNotMatch(html, /Ist Chat oder Haartagebuch Teil davon/i)
  assert.match(html, /data-offer-section="personal_plan_diagnosis"/)
  assert.match(html, /data-offer-section="personal_plan_complete_plan"/)
  assert.match(html, /data-offer-section="personal_plan_method"/)
  assert.match(html, /data-offer-section="personal_plan_survey"/)
  assert.equal((html.match(/data-offer-cta="sticky_header"/g) ?? []).length, 1)
  assert.equal((html.match(/data-offer-cta="final"/g) ?? []).length, 1)
  assert.doesNotMatch(html, /Neqi Peptide Power|Alle 2–3 Haarwäschen|Kopfhautserum|Dry\.Shampoo/i)
  assert.doesNotMatch(html, /conditionerModuleId|shampooModuleId|suggestedCategory|needLane/)
})

test("personal plan result shows recovery instead of falling through to legacy offer", () => {
  const html = renderToStaticMarkup(
    <ResultPageClient
      entryContext="quiz_completion"
      focusRoutine={false}
      hasAccess={false}
      leadId="11111111-1111-4111-8111-111111111111"
      name="Lea"
      personalPlanOffer={null}
      quizAnswers={null}
      quizKind="personal_plan"
    />,
  )

  assert.match(html, /Dein Ergebnis ist noch nicht vollständig bereit/i)
  assert.doesNotMatch(html, /Shampoo · Beispiel|Deine Analyse ist der Anfang/i)
})

test("personal plan public model parser accepts raw artifact model only", () => {
  assert.deepEqual(parsePersonalPlanOfferModel(publicOfferModel), publicOfferModel)
  assert.deepEqual(
    parsePersonalPlanOfferModel({ public_offer_model: publicOfferModel }),
    publicOfferModel,
  )
  assert.equal(
    parsePersonalPlanOfferModel({
      public_offer_model: {
        diagnostic_rows: [],
        plan_fit_statement: publicOfferModel.planFitStatement,
        plan_title: publicOfferModel.planTitle,
      },
    }),
    null,
  )
})

test("pricing exposes a narrow external checkout request seam", () => {
  const pricingSource = readFileSync(
    new URL("../src/components/quiz/result-offer-pricing.tsx", import.meta.url),
    "utf8",
  )
  assert.match(pricingSource, /openCheckoutRequestId\?: number/)
  assert.match(pricingSource, /if \(!openCheckoutRequestId\) return/)
  assert.match(pricingSource, /openCheckout\(\)/)
})

test("personal plan analytics use their own revision label", () => {
  const offerSource = readFileSync(
    new URL("../src/components/personal-plan-offer/personal-plan-offer.tsx", import.meta.url),
    "utf8",
  )

  assert.match(offerSource, /const PERSONAL_PLAN_OFFER_REVISION = "personal_plan_v1"/)
  assert.match(offerSource, /offerRevision=\{PERSONAL_PLAN_OFFER_REVISION\}/)
  assert.doesNotMatch(offerSource, /GUIDED_STORY_OFFER_REVISION/)
})

test("personal plan result reads only the attached public artifact model", () => {
  const pageSource = readFileSync(
    new URL("../src/app/result/[leadId]/page.tsx", import.meta.url),
    "utf8",
  )
  assert.match(pageSource, /\.from\("personal_plan_prepared_artifacts"\)/)
  assert.match(pageSource, /\.select\("public_offer_model"\)/)
  assert.match(pageSource, /\.eq\("status", "attached"\)/)
})
