import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { renderToStaticMarkup } from "react-dom/server"

import { ResultPageClient } from "../src/app/result/[leadId]/result-client"
import { scrollToPersonalPlanPricing } from "../src/components/personal-plan-offer/personal-plan-offer"
import { parsePersonalPlanOfferModel } from "../src/components/personal-plan-offer/model"
import type { PersonalPlanOfferModel } from "../src/components/personal-plan-offer/types"

const publicOfferModel: PersonalPlanOfferModel = {
  diagnosticRows: [
    {
      id: "surface",
      potentialLabel: "ruhig & glänzend",
      potentialSegments: 3,
      summary: "Dein Plan bringt Pflege und Styling in eine klare Reihenfolge.",
      explanationParts: [
        { kind: "answer", text: "Wenig Glanz" },
        { kind: "text", text: " beschreibt den sichtbaren Lichtreflex." },
      ],
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
      personalPlanFocusTarget="personal_plan_complete_plan"
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
  assert.match(html, /<strong[^>]*>Wenig Glanz<\/strong> beschreibt den sichtbaren Lichtreflex/i)
  assert.match(html, /In deinem Haar steckt viel Potenzial/i)
  assert.match(html, /Deine Antworten zeigen, wie wir deine Ausgangslage einordnen/i)
  assert.match(html, /Das Gute/i)
  assert.match(html, /Hier können wir gezielt ansetzen/i)
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
  assert.equal((html.match(/Entwickelt gemeinsam mit Friseurmeistern/g) ?? []).length, 1)
  assert.ok(
    html.indexOf("Entwickelt gemeinsam mit Friseurmeistern") < html.indexOf("Deine Ausgangslage"),
    "Friseurmeister proof should sit beneath the hero before diagnosis",
  )
  assert.match(
    html,
    /Unabhängig und passend zu deinem Haar ausgewählt\. Kauflinks können Affiliate-Links sein/i,
  )
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
  assert.match(html, />Erfahrungen</)
  assert.doesNotMatch(html, /Stimmen aus der Beta/i)
  assert.match(html, /34 · feines, welliges, blondiertes Haar/i)
  assert.match(
    html,
    /Der Fragebogen ist echt gut und leicht verständlich\. Im Chat hat das Antworten super geklappt\. Auch die Produktempfehlung fand ich gut\./i,
  )
  assert.match(html, /Kerstin · Echte Antworten bekommen/i)
  assert.match(
    html,
    /Ich finde die Interaktion sehr gut: meine Fragen stellen zu können und dann die benötigten Antworten zu bekommen\./i,
  )
  assert.match(html, /Sarah · Nie wieder googeln vorm Regal/i)
  assert.match(
    html,
    /Bei den Produkten stehen Preis und Anwendung dabei – und warum sie empfohlen werden\. So muss ich nicht erst googeln\./i,
  )
  assert.equal((html.match(/aria-label="5 von 5 Sternen"/g) ?? []).length, 3)
  assert.match(html, /Das sagen Kundinnen über Chaarlie/i)
  assert.match(html, /14 Tage Geld-zurück-Garantie/i)
  assert.doesNotMatch(html, /Ohne Risiko/i)
  assert.match(html, /Dein Plan zu schöneren Haaren in 30 Tagen/i)
  assert.match(html, /Warum reicht nicht einfach ein neues Shampoo/i)
  assert.match(html, /Ist der Plan wirklich auf mein Haar abgestimmt/i)
  assert.match(html, /Was bekomme ich – und was passiert nach dem Kauf/i)
  assert.match(html, /Muss ich neue oder teure Produkte kaufen/i)
  assert.match(html, /Was, wenn Chaarlie für mich nicht hilfreich ist/i)
  assert.match(html, /Woher weiß ich, dass das echt ist/i)
  assert.match(html, /Wie lange, bis ich etwas merke/i)
  assert.match(html, /Warum ist Chaarlie ein Abo/i)
  assert.match(html, /Wie und wann kann ich kündigen/i)
  assert.equal((html.match(/data-offer-faq=/g) ?? []).length, 9)
  assert.doesNotMatch(
    html,
    /Was bekomme ich genau|Kann ich meine bisherigen Produkte weiterverwenden|data-offer-faq="personal-plan-/i,
  )
  for (const slug of [
    "new-shampoo-not-enough",
    "personalized-plan",
    "included-and-after-purchase",
    "new-or-expensive-products",
    "not-helpful-refund",
    "recommendation-credibility",
    "time-to-notice",
    "why-subscription",
    "cancellation-timing",
  ]) {
    assert.match(html, new RegExp(`data-offer-faq="${slug}"`))
  }
  assert.doesNotMatch(html, /Warum kostet Chaarlie etwas|Ist das ein Abo\?/i)
  assert.match(html, /Haarmony LLC/i)
  assert.match(html, /info@chaarlie\.de/i)
  assert.match(html, /href="\/impressum"/)
  assert.match(html, /href="\/datenschutz"/)
  assert.match(html, /href="\/agb"/)
  assert.match(html, /href="\/widerruf"/)
  assert.match(html, /href="\/kontakt"/)
  assert.match(html, /data-cookie-settings-trigger/)
  assert.match(html, /data-offer-section="personal_plan_diagnosis"/)
  const completePlanSection = html.match(
    /<section[^>]*data-offer-section="personal_plan_complete_plan"[^>]*>/,
  )?.[0]
  assert.ok(completePlanSection)
  assert.match(completePlanSection, /id="personal_plan_complete_plan"/)
  assert.match(completePlanSection, /tabindex="-1"/)
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
    /data-offer-cta="sticky_header" data-offer-destination="pricing"[^>]*>Angebot ansehen</,
  )
  assert.match(html, /data-offer-sticky-state="before_pricing"/)
  assert.match(html, /data-offer-sticky-cta/)
  assert.doesNotMatch(html, /data-offer-selected-interval="one_time"/)
  assert.match(html, /data-offer-cta="final" data-offer-destination="checkout"/)
  assert.match(html, /mt-3 grid grid-cols-2 gap-2/)
  assert.match(html, /background-size:200% auto/i)
  assert.match(html, /conic-gradient\(#563882 82%/i)
  assert.match(html, /conic-gradient\(#7657a2 73%/i)
  assert.match(html, /conic-gradient\(#9a7cbd 63%/i)
  assert.deepEqual(
    Array.from(html.matchAll(/data-offer-section="([^"]+)"/g), (match) => match[1]),
    [
      "hero",
      "personal_plan_diagnosis",
      "pricing",
      "testimonials",
      "personal_plan_complete_plan",
      "personal_plan_method",
      "personal_plan_before_after",
      "personal_plan_survey",
      "guarantee",
      "faq",
      "final_cta",
    ],
  )
  assert.doesNotMatch(html, /Neqi Peptide Power|Alle 2–3 Haarwäschen|Kopfhautserum|Dry\.Shampoo/i)
  assert.doesNotMatch(html, /conditionerModuleId|shampooModuleId|suggestedCategory|needLane/)
})

test("sticky offer CTA morph preserves pricing navigation before checkout intent", () => {
  const offerSource = readFileSync(
    new URL("../src/components/personal-plan-offer/personal-plan-offer.tsx", import.meta.url),
    "utf8",
  )

  assert.match(offerSource, /const \[pricingReached, setPricingReached\] = useState\(false\)/)
  assert.match(offerSource, /const handlePricingReached = useCallback/)
  assert.match(offerSource, /onPricingReached=\{handlePricingReached\}/)
  assert.match(offerSource, /onCheckoutSummaryChange=\{setCheckoutSummary\}/)
  assert.match(offerSource, /pricingReached\s*\?\s*"checkout"\s*:\s*"pricing"/)
  assert.match(offerSource, /pricingReached\s*\?\s*openCheckout\s*:\s*scrollToPricing/)
  assert.match(offerSource, /h-11 w-36 sm:w-40/)
  assert.match(
    offerSource,
    /data-offer-sticky-state=\{pricingReached \? "after_pricing" : "before_pricing"\}/,
  )
  assert.match(offerSource, /checkoutSummary\.commerceKind === "membership"/)
  assert.match(offerSource, /data-offer-selected-interval=\{stickySelectedInterval\}/)
  assert.match(offerSource, /data-offer-cta="sticky_header"/)
})

test("personal plan FAQ stays native while exposing measured-height motion hooks", () => {
  const offerSource = readFileSync(
    new URL("../src/components/personal-plan-offer/personal-plan-offer.tsx", import.meta.url),
    "utf8",
  )

  assert.match(offerSource, /function AnimatedPersonalPlanFaqItem/)
  assert.match(offerSource, /<details/)
  assert.match(offerSource, /<summary/)
  assert.match(offerSource, /data-offer-faq=\{faqId\}/)
  assert.match(offerSource, /data-offer-faq-state=\{isOpen \? "open" : "closed"\}/)
  assert.match(offerSource, /data-offer-faq-chevron/)
  assert.match(offerSource, /isOpen \? "rotate-180" : "rotate-0"/)
  assert.match(offerSource, /scrollHeight/)
  assert.match(offerSource, /prefers-reduced-motion: reduce/)
  assert.match(offerSource, /onClick=\{handleSummaryClick\}/)
  assert.match(offerSource, /event\.preventDefault\(\)/)
  assert.doesNotMatch(offerSource, /onKeyDown=/)
})

test("one-time personal plan removes the membership guarantee from the shared offer", () => {
  const html = renderToStaticMarkup(
    <ResultPageClient
      entryContext="quiz_completion"
      focusRoutine={false}
      hasAccess={false}
      leadId="11111111-1111-4111-8111-111111111111"
      name="Lea"
      offerVariant="personal-plan-one-time-v1"
      personalPlanOffer={publicOfferModel}
      quizAnswers={null}
      quizKind="personal_plan"
    />,
  )

  assert.match(html, /Einmalige Erstellung/i)
  assert.match(html, /Einmalzahlung · Kein Abo/i)
  assert.doesNotMatch(html, /data-offer-section="guarantee"/i)
  assert.equal((html.match(/data-offer-faq=/g) ?? []).length, 7)
  assert.match(html, /data-offer-faq="new-shampoo-not-enough"/)
  assert.match(html, /data-offer-faq="time-to-notice"/)
  assert.doesNotMatch(
    html,
    /data-offer-faq="why-subscription"|data-offer-faq="cancellation-timing"/,
  )
  assert.doesNotMatch(html, /Warum ist Chaarlie ein Abo|Wie und wann kann ich kündigen/i)
  assert.doesNotMatch(html, /data-offer-faq="personal-plan-/)
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

test("malformed optional explanation parts fall back to the safe summary", () => {
  const malformed = structuredClone(publicOfferModel) as unknown as Record<string, unknown>
  const rows = malformed.diagnosticRows as Array<Record<string, unknown>>
  rows[0].explanationParts = [{ kind: "html", text: "<img src=x onerror=alert(1)>" }]
  const parsed = parsePersonalPlanOfferModel(malformed)
  assert.ok(parsed)
  assert.equal(parsed.diagnosticRows[0].explanationParts, undefined)
  assert.equal(parsed.diagnosticRows[0].summary, publicOfferModel.diagnosticRows[0].summary)
})

test("pricing exposes a narrow external checkout request seam", () => {
  const pricingSource = readFileSync(
    new URL("../src/components/quiz/result-offer-pricing.tsx", import.meta.url),
    "utf8",
  )
  assert.match(pricingSource, /openCheckoutRequestId\?: number/)
  assert.match(pricingSource, /claimCheckoutOpenRequest\(/)
  assert.match(pricingSource, /handledRequestsRef/)
  assert.match(pricingSource, /window\.setTimeout\(openCheckout, 0\)/)
})

test("sticky header only scrolls and focuses pricing", () => {
  const calls: unknown[][] = []
  let scheduled: (() => void) | undefined
  const pricing = {
    focus: (...args: unknown[]) => calls.push(["focus", ...args]),
    scrollIntoView: (...args: unknown[]) => calls.push(["scroll", ...args]),
  }

  assert.equal(
    scrollToPersonalPlanPricing(pricing, (callback, delay) => {
      calls.push(["schedule", delay])
      scheduled = callback
    }),
    true,
  )
  assert.deepEqual(calls, [
    ["scroll", { behavior: "smooth", block: "start" }],
    ["schedule", 450],
  ])
  scheduled?.()
  assert.deepEqual(calls.at(-1), ["focus", { preventScroll: true }])
})

test("personal plan offer opens checkout immediately without a readiness gate", () => {
  const offerSource = readFileSync(
    new URL("../src/components/personal-plan-offer/personal-plan-offer.tsx", import.meta.url),
    "utf8",
  )

  assert.doesNotMatch(offerSource, /checkoutWaiting|onCheckoutWaitingChange/)
  assert.match(offerSource, /onClick=\{fieldTest \? activateFieldTest : openCheckout\}/)
  assert.match(
    offerSource,
    /const stickyAction = fieldTest\s*\?\s*activateFieldTest\s*:\s*pricingReached\s*\?\s*openCheckout\s*:\s*scrollToPricing/,
  )
  assert.match(offerSource, /data-offer-cta="final"/)
  assert.doesNotMatch(offerSource, /Zahlungsoptionen werden vorbereitet …/)
})

test("personal plan restart is an explicit opt-in after the final CTA only", () => {
  const enabledHtml = renderToStaticMarkup(
    <ResultPageClient
      entryContext="quiz_completion"
      focusRoutine={false}
      hasAccess={false}
      leadId="11111111-1111-4111-8111-111111111111"
      name="Lea"
      personalPlanOffer={publicOfferModel}
      quizAnswers={null}
      quizKind="personal_plan"
      showQuizRestart
    />,
  )
  const disabledHtml = renderToStaticMarkup(
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

  assert.match(enabledHtml, /Du möchtest deine Angaben ändern\? Haar-Check neu starten/)
  assert.ok(
    enabledHtml.indexOf('data-offer-cta="final"') <
      enabledHtml.indexOf("Du möchtest deine Angaben ändern? Haar-Check neu starten"),
  )
  assert.doesNotMatch(disabledHtml, /Du möchtest deine Angaben ändern\? Haar-Check neu starten/)
})

test("personal plan restart stays out of paid, legacy, and default recovery result paths", () => {
  const paidHtml = renderToStaticMarkup(
    <ResultPageClient
      showQuizRestart
      focusRoutine={false}
      hasAccess
      leadId="11111111-1111-4111-8111-111111111111"
      name="Lea"
      personalPlanOffer={publicOfferModel}
      quizAnswers={null}
      quizKind="personal_plan"
    />,
  )
  const legacyHtml = renderToStaticMarkup(
    <ResultPageClient
      showQuizRestart
      focusRoutine={false}
      hasAccess={false}
      leadId="11111111-1111-4111-8111-111111111111"
      name="Lea"
      quizAnswers={null}
    />,
  )

  assert.doesNotMatch(paidHtml, /Du möchtest deine Angaben ändern\? Haar-Check neu starten/)
  assert.doesNotMatch(legacyHtml, /Du möchtest deine Angaben ändern\? Haar-Check neu starten/)
})

test("personal plan recovery exposes restart only when the server explicitly allows it", () => {
  const html = renderToStaticMarkup(
    <ResultPageClient
      showQuizRestart
      focusRoutine={false}
      hasAccess={false}
      leadId="11111111-1111-4111-8111-111111111111"
      name="Lea"
      personalPlanOffer={null}
      quizAnswers={null}
      quizKind="personal_plan"
    />,
  )

  assert.match(html, /Dein Ergebnis ist noch nicht vollständig bereit\./)
  assert.match(html, /Du möchtest deine Angaben ändern\? Haar-Check neu starten/)
})

test("personal plan return recovery reloads with its return entry context", () => {
  const html = renderToStaticMarkup(
    <ResultPageClient
      entryContext="quiz_return"
      focusRoutine={false}
      hasAccess={false}
      leadId="11111111-1111-4111-8111-111111111111"
      name="Lea"
      personalPlanOffer={null}
      quizAnswers={null}
      quizKind="personal_plan"
    />,
  )

  assert.match(html, /href="\/result\/11111111-1111-4111-8111-111111111111\?entry=quiz_return"/)
})

test("personal plan analytics use their own revision label", () => {
  const offerSource = readFileSync(
    new URL("../src/components/personal-plan-offer/personal-plan-offer.tsx", import.meta.url),
    "utf8",
  )

  assert.match(offerSource, /const PERSONAL_PLAN_OFFER_REVISION = "personal_plan_v4"/)
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
