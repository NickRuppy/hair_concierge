import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { renderToStaticMarkup } from "react-dom/server"

import { renderOfferVariant } from "../src/funnels/offers/registry"
import { ScanHeroDemoView } from "../src/components/scan-regal-offer/scan-hero-demo"
import type { FunnelOfferVariantProps } from "../src/funnels/types"
import { resolveOfferSectionIndex } from "../src/lib/analytics/offer-section-order"
import { buildQuizResultNarrative } from "../src/lib/quiz/result-narrative"
import { getScanInsertExample } from "../src/lib/quiz/scan-insert-examples"
import type { QuizAnswers } from "../src/lib/quiz/types"

const heroDemoSource = readFileSync(
  new URL("../src/components/scan-regal-offer/scan-hero-demo.tsx", import.meta.url),
  "utf8",
)

const quizAnswers: QuizAnswers = {
  structure: "wavy",
  thickness: "normal",
  density: "medium",
  hair_length: "long",
  scalp_type: "fettig",
  has_scalp_issue: false,
  fingertest: "leicht_uneben",
  pulltest: "stretches_stays",
  concerns: ["frizz", "dryness"],
  treatment: [],
  goals: ["moisture", "shine"],
}

const commercialProps: FunnelOfferVariantProps = {
  entryContext: "quiz_completion",
  leadId: "lead-scan",
  name: "Lena Beispiel",
  narrative: buildQuizResultNarrative(quizAnswers),
  offerVariant: "scan-regal-v1",
  pricingSlot: <div data-testid="scan-pricing-slot">Pricing</div>,
  quizAnswers,
}

/** The order the sections actually appear in the rendered document. */
const EXPECTED_SECTION_ORDER = [
  "hero",
  "before_after",
  "scan_criteria",
  "product_tour",
  "pricing",
  "scan_coverage",
  "highlights",
  "method",
  "survey",
  "testimonials",
  "guarantee",
  "faq",
  "final_cta",
] as const

function renderScanOffer(props: FunnelOfferVariantProps = commercialProps) {
  const element = renderOfferVariant("scan-regal-v1", props)
  assert.ok(element, "the scan-regal-v1 variant is registered")
  return renderToStaticMarkup(element)
}

function renderedSectionIds(html: string) {
  return Array.from(html.matchAll(/data-offer-section="([a-z_]+)"/g)).map((match) => match[1])
}

test("the scanner offer renders through the registry with its approved hero", () => {
  const html = renderScanOffer()

  assert.match(html, /Dein Haarprofil ist fertig/)
  assert.match(html, /Nie wieder raten vorm Regal\./)
  // The profile sentence is derived from the answers, not a fixed string.
  assert.match(html, /Welliges, mittelstarkes Haar mit mittlerer Dichte\./)
  assert.match(
    html,
    /So prüft der Scanner Produkte für dein Profil – bei den gängigen Produkten von dm und\s+Rossmann\./,
  )
  assert.match(html, /%2Fimages%2Ffunnels%2Fscan%2Ftour-scanner\.png/)
  assert.match(html, /%2Fimages%2Ffunnels%2Fscan%2Fpackshot-ogx\.png/)
  assert.doesNotMatch(html, /Urteil/i)
})

test("the scanner offer keeps the approved section order and renders pricing exactly once", () => {
  const html = renderScanOffer()

  assert.deepEqual(renderedSectionIds(html), [...EXPECTED_SECTION_ORDER])
  assert.equal((html.match(/data-testid="scan-pricing-slot"/g) ?? []).length, 1)
  // The section owns the eyebrow and heading; the slot owns cards and CTA.
  assert.match(html, /Freischalten/)
  assert.match(html, /Scanner und Plan freischalten\./)
  assert.match(html, /14 Tage Geld-zurück-Garantie · Details in den Bedingungen/)
})

test("the tracked section order matches what the page renders", () => {
  for (const [index, sectionId] of EXPECTED_SECTION_ORDER.entries()) {
    assert.equal(resolveOfferSectionIndex("scan-regal-v1", sectionId), index)
  }
})

test("the scanner offer carries the criteria, the tour, coverage and the proof blocks", () => {
  const html = renderScanOffer()

  assert.match(html, /Darauf achtet der Scanner bei dir\./)
  assert.match(html, /Abgeleitet aus deinen 10 Antworten\./)
  // `scalp_type: "fettig"` must reach the chips as a clarifying cleansing target.
  assert.match(html, /Reinigung: klärend/)
  assert.match(html, /Haardicke: mittel/)
  assert.match(html, /Hitzeschutz/)
  assert.match(html, /Repair-Pflege/)
  assert.match(html, /Jede Zeile im Ergebnis lässt sich antippen und erklärt sich\./)

  assert.match(html, /Scanner, Plan und Chat – in einer App\./)
  for (const title of ["Produkt-Scanner", "Dein Plan", "Anwendung", "Frag Chaarlie"]) {
    assert.match(html, new RegExp(title), title)
  }

  assert.match(html, /Die gängigen Produkte von dm und Rossmann\./)
  assert.match(
    html,
    /Unbekanntes Produkt\? Ein Tipp genügt – wir prüfen es und melden uns im Chat, sobald das\s+Ergebnis da ist\./,
  )

  assert.match(html, /Dein Ergebnis basiert auf echter Haar-Diagnostik:/)
  assert.match(html, /Über 1\.000 Produkte/)
  assert.match(html, /Entwickelt gemeinsam mit Friseurmeistern\./)
  assert.match(html, /Über 4\.000 Frauen haben uns geantwortet\./)
  assert.match(html, /Sarah · Nie wieder googeln vorm Regal/)
  assert.match(html, /Welche Produkte kennt der Scanner\?/)

  assert.match(html, /Dein Scanner wartet\./)
  assert.match(html, /Scann als Erstes, was bei dir im Bad steht\./)
  assert.match(html, /Jetzt freischalten/)
})

test("both offer CTAs carry the tracking attributes the provider listens for", () => {
  const html = renderScanOffer()

  assert.match(
    html,
    /data-offer-cta="sticky_header"[^>]*data-offer-destination="pricing"[^>]*data-offer-source-section="hero"/,
  )
  assert.match(
    html,
    /data-offer-cta="final"[^>]*data-offer-destination="pricing"[^>]*data-offer-source-section="final_cta"/,
  )
  assert.equal((html.match(/data-offer-faq="scan-regal-\d"/g) ?? []).length, 5)
})

test("non-commercial activation contexts fall back to the organic offer", () => {
  for (const props of [
    { ...commercialProps, regularFieldTest: { accessDurationHours: 168 } },
    {
      ...commercialProps,
      partnerAccess: { activationApiPath: "/api/partner-access/activate" as const },
    },
  ]) {
    const html = renderScanOffer(props)
    assert.match(html, /Dein Haarplan ist bereit\./)
    assert.doesNotMatch(html, /Nie wieder raten vorm Regal\./)
    assert.doesNotMatch(html, /data-offer-section="scan_criteria"/)
  }
})

test("the hero demo's finished frame is what renders without a clock", () => {
  const card = getScanInsertExample(16, quizAnswers)
  const html = renderToStaticMarkup(<ScanHeroDemoView card={card} phase="result" />)

  assert.match(html, /data-scan-hero-demo-phase="result"/)
  assert.match(html, /✓ Barcode erkannt/)
  assert.doesNotMatch(html, /data-scan-hero-demo-line/)
  assert.match(html, new RegExp(card.headline))
  assert.match(html, new RegExp(card.deviation.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
  for (const row of card.rows) {
    assert.match(html, new RegExp(`${row.label}: ${row.productValue}`), row.label)
  }
})

test("the hero demo starts on the finished frame and never times out under reduced motion", () => {
  // The initial state is the end state, so the server and a reduced-motion
  // visitor share one still frame and no timer is ever scheduled for them.
  assert.match(heroDemoSource, /useState<ScanHeroDemoPhase>\("result"\)/)
  assert.match(
    heroDemoSource,
    /if \(window\.matchMedia\("\(prefers-reduced-motion: reduce\)"\)\.matches\) return/,
  )
  assert.match(heroDemoSource, /window\.clearInterval\(loop\)/)
  assert.match(heroDemoSource, /pending\.forEach\(\(timer\) => window\.clearTimeout\(timer\)\)/)
})
