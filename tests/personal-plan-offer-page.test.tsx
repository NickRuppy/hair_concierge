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
  profileLine: "Basierend auf deiner Analyse für glattes, mittelstarkes Haar",
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
  assert.match(html, /Dein Haarplan ist bereit/i)
  assert.doesNotMatch(html, /Lea, dein Haarplan/i)
  assert.match(html, /Für glattes, mittelstarkes Haar\./i)
  assert.doesNotMatch(html, /Mit klaren Schritten für Reinigung/i)
  assert.doesNotMatch(html, /Persönlicher Haarpflegeplan|perfekten Haarplan/i)
  assert.doesNotMatch(html, /Plan für ruhige Längen und klaren Glanz/i)
  assert.doesNotMatch(
    html,
    /Beispielansicht|Deine Haarpflege|Dein passendes Shampoo|Dein passender Conditioner|Dein passendes Leave-in|Deine Reihenfolge/i,
  )
  assert.doesNotMatch(html, /🔒|GESPERRT/i)
  assert.match(html, /Symbolische heutige Haarsituation/i)
  assert.match(html, /Symbolisches Haarziel/i)
  assert.ok(
    html.indexOf("Symbolische heutige Haarsituation") < html.indexOf("Deine Ausgangslage"),
    "the transformation image should precede the diagnosis introduction",
  )
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
  assert.doesNotMatch(html, /bg-\[#eef7f1\]/i)
  assert.doesNotMatch(html, /unruhig|wechselhaft|ruhig &amp; glänzend/i)
  assert.match(html, /Die Highlights deines Plans/i)
  assert.match(
    html,
    /Versteh endlich[\s\S]*, was deine Haare wirklich brauchen[\s\S]* – statt weiter zu raten/i,
  )
  assert.match(
    html,
    /Eine klare Routine[\s\S]* ohne Produktchaos:[\s\S]* wenige Produkte, feste Reihenfolge/i,
  )
  assert.match(
    html,
    /Fahr dir durch die Haare und sie fühlen sich [\s\S]*weich[\s\S]* an – nicht trocken und strohig/i,
  )
  assert.match(
    html,
    /Trag deine Haare wieder [\s\S]*offen[\s\S]* – mit einem richtig guten Gefühl/i,
  )
  assert.match(html, /before-after-generic\.webp/i)
  assert.match(html, /Zugtest/i)
  assert.match(html, /Struktur &amp; Elastizität/i)
  assert.match(html, /Oberflächentest/i)
  assert.match(html, /Haaroberfläche &amp; Glanz/i)
  assert.match(html, /Kopfhaut-Check/i)
  assert.match(html, /Typ &amp; Zustand/i)
  assert.match(html, /Dein Plan basiert auf echter Haar-Diagnostik/i)
  assert.match(html, /Über 1.000 Produkte/i)
  assert.match(html, /analysiert &amp; geprüft/i)
  assert.match(html, /Entwickelt gemeinsam mit Friseurmeistern/i)
  assert.match(html, /Daraus entstehen deine Produktauswahl, Reihenfolge und Anwendung/i)
  assert.match(html, /Vorher und[\s\S]*nachher[\s\S]*mit Chaarlie/i)
  assert.match(html, /So beschreiben es Frauen in unserer Umfrage/i)
  assert.match(html, /Ich weiß nie, welche Produkte wirklich zu mir passen/i)
  assert.match(html, /Empfehlungen mit Grund, abgestimmt auf deine Auswertung/i)
  assert.match(html, /Meine Haare sind trocken, strohig oder glanzlos/i)
  assert.match(html, /Weich, geschmeidig, mit Glanz, den man sieht/i)
  assert.match(html, /Haare im Dutt oder Zopf verstecken/i)
  assert.match(html, /Haare offen tragen, mit gutem Gefühl/i)
  assert.match(html, /Monatlich/i)
  assert.match(html, /<s[^>]*>€19,99<\/s>[\s\S]*€14,99/)
  assert.match(html, /€14,99/i)
  assert.match(html, /Quartal/i)
  assert.match(html, /<s[^>]*>€44,49<\/s>[\s\S]*€34,99/)
  assert.match(html, /€34,99/i)
  assert.match(html, /Beliebteste Wahl/i)
  assert.match(html, /Jährlich/i)
  assert.match(html, /<s[^>]*>€149,99<\/s>[\s\S]*€99,99/)
  assert.match(html, /€99,99/i)
  assert.match(html, /Jetzt starten — €34,99 im Quartal/i)
  assert.match(html, /82%/i)
  assert.match(html, /73%/i)
  assert.match(html, /63%/i)
  assert.match(html, /4\.024 Antworten/i)
  assert.match(html, /Kim · Endlich verstehe ich meine Haare/i)
  assert.match(html, /Kerstin · Echte Antworten bekommen/i)
  assert.match(html, /Sarah · Nie wieder googeln vorm Regal/i)
  assert.match(html, /Das sagen Kundinnen über Chaarlie/i)
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
  assert.match(html, /data-offer-section="personal_plan_before_after"/)
  assert.match(html, /data-offer-section="personal_plan_survey"/)
  assert.match(
    html,
    /data-offer-section="pricing" id="pricing" tabindex="-1"><div class="text-center">/,
  )
  assert.match(
    html,
    /class="text-center font-serif text-\[2rem\] leading-tight tracking-\[-0\.035em\] sm:text-4xl">Häufige Fragen/,
  )
  assert.equal((html.match(/data-offer-cta="sticky_header"/g) ?? []).length, 1)
  assert.equal((html.match(/data-offer-cta="final"/g) ?? []).length, 1)
  assert.match(
    html,
    /data-offer-cta="sticky_header" data-offer-destination="pricing"[^>]*>Pläne ansehen</,
  )
  assert.match(html, /data-offer-cta="final" data-offer-destination="checkout"/)
  assert.match(html, /mt-3 grid grid-cols-2 gap-2/)
  assert.match(html, /background-size:200% auto/i)
  assert.match(html, /conic-gradient\(#563882 82%/i)
  assert.match(html, /conic-gradient\(#7657a2 73%/i)
  assert.match(html, /conic-gradient\(#9a7cbd 63%/i)
  assert.ok(
    html.indexOf('data-offer-section="personal_plan_method"') <
      html.indexOf('data-offer-section="personal_plan_before_after"') &&
      html.indexOf('data-offer-section="personal_plan_before_after"') <
        html.indexOf('data-offer-section="pricing"'),
    "the new before/after section should sit between method and pricing",
  )
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

  assert.match(offerSource, /const PERSONAL_PLAN_OFFER_REVISION = "personal_plan_v2"/)
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
