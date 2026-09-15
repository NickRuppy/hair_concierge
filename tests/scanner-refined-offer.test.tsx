import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import { renderToStaticMarkup } from "react-dom/server"
import { ScannerRefinedOffer } from "../src/components/scan-regal-offer/scanner-refined-offer"
import { OrganicPlanOffer } from "../src/components/organic-plan-offer/organic-plan-offer"
import { TrialOffer } from "../src/components/billing/trial-offer"
import type { FunnelOfferVariantProps } from "../src/funnels/types"
import type { QuizAnswers } from "../src/lib/quiz/types"
import { buildQuizResultNarrative } from "../src/lib/quiz/result-narrative"

const baseAnswers: QuizAnswers = {
  structure: "wavy",
  thickness: "fine",
  density: "medium",
  hair_length: "long",
  scalp_type: "trocken",
  has_scalp_issue: false,
  fingertest: "rau",
  pulltest: "stretches_stays",
  concerns: ["frizz", "dryness"],
  treatment: [],
  goals: ["moisture", "less_frizz"],
}
const pricing = {
  trialDays: 7,
  monthlyAmountMinor: 1299,
  annualFirstAmountMinor: 7999,
  annualRenewalAmountMinor: 11999,
}
function propsFor(quizAnswers: QuizAnswers = baseAnswers): FunnelOfferVariantProps {
  return {
    name: "Lena",
    narrative: buildQuizResultNarrative(quizAnswers),
    quizAnswers,
    pricingSlot: (
      <div data-testid="authoritative-pricing">
        <TrialOffer
          pricing={pricing}
          selectedInterval="year"
          onSelect={() => {}}
          onContinue={() => {}}
          presentation="scanner"
        />
      </div>
    ),
    entryContext: "quiz_completion",
    leadId: "scanner-test",
    offerVariant: "scan-regal-v1",
    trialOfferPricing: pricing,
  }
}
function diagnostics(html: string) {
  return [
    ...html.matchAll(/<article[^>]*data-organic-diagnostic-row="[^"]+"[\s\S]*?<\/article>/g),
  ].map((match) => match[0])
}

test("refined scanner uses the same real-answer diagnostic output as organic for contrasting profiles", () => {
  const profiles: QuizAnswers[] = [
    baseAnswers,
    {
      ...baseAnswers,
      structure: "straight",
      thickness: "coarse",
      density: "low",
      scalp_type: "ausgeglichen",
      fingertest: "glatt",
      pulltest: "stretches_returns",
      concerns: ["hair_damage", "tangling"],
      goals: ["shine", "anti_breakage", "volume"],
    },
    {
      ...baseAnswers,
      structure: "coily",
      scalp_type: "fettig",
      has_scalp_issue: true,
      scalp_condition: "schuppen",
      concerns: ["breakage"],
      goals: ["healthy_scalp"],
    },
  ]
  const results = profiles.map((answers) => {
    const props = propsFor(answers)
    const html = renderToStaticMarkup(<ScannerRefinedOffer {...props} />)
    const actual = diagnostics(html)
    assert.equal(actual.length, 3)
    assert.deepEqual(actual, diagnostics(renderToStaticMarkup(<OrganicPlanOffer {...props} />)))
    return { html, actual }
  })
  assert.match(results[0].html, /Welliges, feines Haar mit mittlerer Dichte/)
  assert.match(results[0].actual.join(""), /Trockene Kopfhaut/)
  assert.match(results[0].actual.join(""), /Frizz oder abstehende Haare/)
  assert.match(results[1].html, /Glattes, kräftiges Haar mit geringer Dichte/)
  assert.doesNotMatch(results[1].actual.join(""), /Trockene Kopfhaut|Trockene oder strohige Längen/)
  assert.notDeepEqual(results[0].actual, results[1].actual)
  assert.notDeepEqual(results[0].actual, results[2].actual)
})

test("approved section sequence has one authoritative pricing slot directly after the timeline", () => {
  const html = renderToStaticMarkup(<ScannerRefinedOffer {...propsFor()} />)
  assert.deepEqual(
    [...html.matchAll(/data-offer-section="([a-z_]+)"/g)].map((match) => match[1]),
    [
      "hero",
      "personal_plan_diagnosis",
      "scan_criteria",
      "highlights",
      "method",
      "pricing",
      "product_tour",
      "testimonials",
      "faq",
    ],
  )
  assert.equal((html.match(/data-testid="authoritative-pricing"/g) ?? []).length, 1)
  assert.match(
    html,
    /Dein Abo startet – weiter voller Zugriff\.<\/p><\/div><\/li><\/ol><div data-testid="authoritative-pricing"/,
  )
  assert.match(html, /79,99/)
  assert.match(html, /119,99/)
  assert.doesNotMatch(html, /(?<![0-9])(?:69,99|99,99|9,99)/)
  assert.equal((html.match(/<footer/g) ?? []).length, 1)
  for (const label of ["Impressum", "Datenschutz", "AGB", "Widerruf", "Kontakt"])
    assert.match(html, new RegExp(`>${label}</a>`))
})

test("example, WhatsApp contact, captions and carousel expose labeled native controls", () => {
  const html = renderToStaticMarkup(<ScannerRefinedOffer {...propsFor()} />)
  assert.match(
    html,
    /aria-label="Scan-Ergebnis für ein Beispielprofil vergrößern" aria-haspopup="dialog"/,
  )
  assert.match(html, /<dialog[^>]*aria-labelledby="scanner-example-title"/)
  assert.match(html, /aria-label="Vergrößerte Ansicht schließen"/)
  const whatsappHref = "https://wa.me/message/NIQW4GQHV7UTD1"
  const whatsappLinks = [...html.matchAll(new RegExp(`<a[^>]*href="${whatsappHref}"[^>]*>`, "g"))]
  assert.equal(whatsappLinks.length, 3)
  for (const [link] of whatsappLinks) {
    assert.match(link, /target="_blank"/)
    assert.match(link, /rel="noopener"/)
  }
  assert.match(html, /aria-label="Frage per WhatsApp stellen"/)
  assert.doesNotMatch(html, /scanner-contact-title|WhatsApp-Kontakt noch nicht verfügbar/)
  assert.match(html, /<video controls="" playsInline=""/)
  assert.match(html, /<track kind="captions" srcLang="de" label="Deutsch"[^>]*default=""/)
  assert.match(html, /aria-label="Weitere Vorteile" aria-controls="scanner-benefits"/)
  for (const cta of ["sticky_header", "sticky_bottom"])
    assert.match(
      html,
      new RegExp(`href="#pricing" data-offer-cta="${cta}" data-offer-destination="pricing"`),
    )
})

test("the presentation does not fabricate trial terms when the server contract is absent", () => {
  assert.equal(
    renderToStaticMarkup(<ScannerRefinedOffer {...propsFor()} trialOfferPricing={null} />),
    "",
  )
})

test("published scanner media preserves the frozen approved source bytes", () => {
  const approved = "../plans/scanner-funnel-consolidation/preview/approved-v20/"
  const files = [
    [
      "images/funnels/scanner-offer/photo-scanner-shelf.webp",
      "images/funnels/scan-refinement/photo-scanner-shelf.webp",
    ],
    [
      "images/funnels/scanner-offer/steffi-scanner-poster.jpg",
      "images/funnels/scan-refinement/steffi-scanner-poster.jpg",
    ],
    [
      "images/production/ogx-production-scan-390x844.jpg",
      "images/funnels/scan-refinement/ogx-production-scan-390x844.jpg",
    ],
    [
      "videos/funnels/scanner-offer/steffi-scanner.mp4",
      "videos/funnels/scan-refinement/steffi-scanner.mp4",
    ],
    ["captions/steffi-de.vtt", "videos/funnels/scan-refinement/steffi-de.vtt"],
  ]
  for (const [source, destination] of files)
    assert.ok(
      readFileSync(new URL(approved + source, import.meta.url)).equals(
        readFileSync(new URL("../public/" + destination, import.meta.url)),
      ),
      destination,
    )
})
