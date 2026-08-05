import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import { renderToStaticMarkup } from "react-dom/server"

import OrganicRefreshLandingVariant from "../src/funnels/landing/organic-refresh"
import OrganicPlanV1OfferVariant from "../src/funnels/offers/organic-plan-v1"
import type { FunnelOfferVariantProps } from "../src/funnels/types"
import { buildQuizResultNarrative } from "../src/lib/quiz/result-narrative"
import type { QuizAnswers } from "../src/lib/quiz/types"

const quizAnswers: QuizAnswers = {
  structure: "wavy",
  thickness: "fine",
  density: "medium",
  hair_length: "long",
  scalp_type: "ausgeglichen",
  has_scalp_issue: false,
  fingertest: "leicht_uneben",
  pulltest: "stretches_stays",
  concerns: ["hair_damage", "frizz", "dryness"],
  treatment: ["blondiert"],
  goals: ["moisture", "less_frizz", "shine"],
}

const offerProps: FunnelOfferVariantProps = {
  entryContext: "quiz_completion",
  leadId: "lead-organic",
  name: "Lena Beispiel",
  narrative: buildQuizResultNarrative(quizAnswers),
  offerVariant: "organic-plan-v1",
  pricingSlot: <div data-testid="organic-pricing-slot">Pricing</div>,
  quizAnswers,
}

test("organic refresh landing presents a calm free analysis with optional paid plan boundary", () => {
  const html = renderToStaticMarkup(<OrganicRefreshLandingVariant />)

  assert.match(html, /Kostenlose Haaranalyse/)
  assert.match(html, /Versteh dein Haar\. Ohne Produktchaos\./)
  assert.match(html, /Zehn ruhige Fragen/)
  assert.match(html, /ohne künstlichen Druck/)
  assert.match(html, /Kostenlose Einordnung/)
  assert.match(html, /Optionaler Plan danach/)
  assert.match(html, /Der bezahlte Plan bleibt optional/)
  assert.equal((html.match(/href="\/quiz"/g) ?? []).length, 3)
  assert.doesNotMatch(html, /Founder|Score|Countdown|Angebot läuft ab|nur heute/i)
})

test("quiz-gate landing keeps its approved copy and routes every quiz action to the modal", () => {
  const landing = readFileSync(
    new URL("../src/components/waitlist/quiz-gate-landing.tsx", import.meta.url),
    "utf8",
  )
  const modal = readFileSync(
    new URL("../src/components/waitlist/quiz-gate-modal.tsx", import.meta.url),
    "utf8",
  )

  assert.match(landing, /Quiz starten/)
  assert.match(landing, /Kostenloses Quiz starten/)
  assert.match(landing, /Zehn Fragen\. Kostenlos\. Bald wieder verfügbar\./)
  assert.match(landing, /10 Fragen · Bald wieder verfügbar/)
  assert.match(landing, /Persönliches Ergebnis/)
  assert.match(
    landing,
    /Du erfährst, wo dein Haar heute steht und welche Pflegehebel relevant sind\./,
  )
  assert.match(landing, /Du erfährst, welche Pflegehebel für dich\s+relevant sind/)
  assert.doesNotMatch(landing, /Danach siehst du/)
  assert.match(modal, /Bald wieder offen/)
  assert.equal((modal.match(/Sonntag, 9\. August/g) ?? []).length, 1)
  assert.match(modal, /overlayClassName="bg-\[rgba\(42,24,69,0\.55\)\]"/)
  assert.doesNotMatch(landing, /href="\/quiz"/)
  assert.match(landing, /<SiteFooter onQuizAction=\{openFooterModal\} \/>/)
  assert.match(landing, /<QuizGateModal open=\{modalOpen\} onOpenChange=\{updateModalOpen\} \/>/)
})

test("organic offer renders the approved calm hierarchy with exactly one supplied pricing slot", () => {
  const html = renderToStaticMarkup(<OrganicPlanV1OfferVariant {...offerProps} />)
  const sectionIds = Array.from(html.matchAll(/data-offer-section="([^"]+)"/g), (match) => match[1])

  assert.match(html, /Dein Haarplan ist bereit/)
  assert.match(html, /Deine Ausgangslage/)
  assert.match(html, /In deinem Haar steckt viel Potenzial/)
  assert.equal((html.match(/data-organic-diagnostic-row=/g) ?? []).length, 3)
  assert.match(html, /Die Highlights deines Plans/)
  assert.match(html, /Plan freischalten/)
  assert.equal((html.match(/data-testid="organic-pricing-slot"/g) ?? []).length, 1)
  assert.ok(html.indexOf("Die Highlights deines Plans") < html.indexOf("Plan freischalten"))
  assert.match(html, /Dein Plan basiert auf echter Haar-Diagnostik/)
  assert.match(html, /Zugtest/)
  assert.match(html, /Oberflächentest/)
  assert.match(html, /Kopfhaut-Check/)
  assert.match(html, /Vorher und[\s\S]*nachher[\s\S]*mit Chaarlie/)
  assert.match(html, /So beschreiben es Frauen in unserer Umfrage/)
  assert.match(html, /Über 4\.000 Frauen haben uns geantwortet/)
  assert.match(html, /Das sagen Kundinnen über Chaarlie/)
  assert.match(html, /14 Tage Geld-zurück-Garantie/)
  assert.match(html, /Häufige Fragen/)
  assert.equal((html.match(/data-offer-faq=/g) ?? []).length, 5)
  assert.deepEqual(sectionIds, [
    "hero",
    "personal_plan_diagnosis",
    "personal_plan_complete_plan",
    "pricing",
    "personal_plan_method",
    "personal_plan_before_after",
    "personal_plan_survey",
    "testimonials",
    "guarantee",
    "faq",
    "final_cta",
  ])
})

test("organic offer excludes retired sales devices and photographic before-after assets", () => {
  const html = renderToStaticMarkup(<OrganicPlanV1OfferVariant {...offerProps} />)

  assert.doesNotMatch(html, /before-after-generic\.webp|<img\b|role="img"/i)
  assert.doesNotMatch(html, /FounderLetter|Liebe Lena|Nick &amp; Jonas|Founder/i)
  assert.doesNotMatch(html, /Dein Haarpotenzial|% erreicht|Score/i)
  assert.doesNotMatch(html, /Angebot läuft ab|Countdown|Danach zum regulären Preis|nur heute/i)
  assert.doesNotMatch(html, /Ja, zeig mir Chaarlie|Kapitel|freischalten, um weiterzulesen/i)
})

test("home page uses the organic refresh landing instead of the old default landing", () => {
  const source = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8")

  assert.match(source, /@\/funnels\/landing\/organic-refresh/)
  assert.doesNotMatch(source, /@\/funnels\/landing\/default/)
})

test("legacy unlock links target the organic plan highlights", () => {
  const source = readFileSync(
    new URL("../src/app/result/[leadId]/result-client.tsx", import.meta.url),
    "utf8",
  )

  assert.match(
    source,
    /focusTarget === "unlock-plan" \? "personal_plan_complete_plan" : focusTarget/,
  )
})
