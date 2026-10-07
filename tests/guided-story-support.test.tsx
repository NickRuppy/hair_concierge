import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { renderToStaticMarkup } from "react-dom/server"

import { GuidedStorySupport } from "../src/components/quiz/guided-story-support"
import { buildQuizGuidedStoryPreview } from "../src/lib/quiz/guided-story-preview"

const preview = buildQuizGuidedStoryPreview({
  structure: "wavy",
  thickness: "normal",
  density: "medium",
  scalp_type: "trocken",
  fingertest: "rau",
  pulltest: "snaps",
  concerns: ["breakage", "dryness", "frizz"],
  treatment: ["blondiert"],
  goals: ["anti_breakage", "moisture", "less_frizz"],
})

test("renders the approved independent chat, tracker, proof, and pricing handoff", () => {
  const html = renderToStaticMarkup(<GuidedStorySupport preview={preview} onContinue={() => {}} />)

  assert.match(html, /Deine Routine steht\. Doch im Alltag dranzubleiben, ist nicht immer leicht\./)
  assert.match(html, /data-guided-story-chat=/)
  assert.match(html, /data-testid="guided-story-tracker-proof"/)
  assert.match(html, /data-testid="guided-story-testimonial-proof"/)
  assert.match(
    html,
    /Denn so hat man eine Haar Analyse die man eher selten, wenn nur auf Nachfrage bei einem Frisör bekommt./,
  )
  assert.match(html, /Durch die App habe ich endlich eine Routine gefunden/)
  assert.equal((html.match(/Auszug · Bewertung auf Trustpilot/g) ?? []).length, 2)
  assert.match(html, />Chiara</)
  assert.match(html, />Lucia</)
  assert.match(html, /Bereit für deinen Weg zu gesünderem, schönerem Haar\?/)
  assert.match(html, /Ja, mit Chaarlie starten/)
})

test("warms shared checkout readiness without mounting pricing or coupling chat and tracker", () => {
  const source = readFileSync(
    new URL("../src/components/quiz/guided-story-support.tsx", import.meta.url),
    "utf8",
  )

  assert.match(source, /warmOfferStripe\(\)/)
  assert.doesNotMatch(source, /import \{ Quote \}/)
  assert.doesNotMatch(source, /ResultOfferPricing|pricingSlot/)
  assert.doesNotMatch(source, /setTimeout|onChat|onTracker/)
})

test("supports the experiment support transition with name and no-name fallback", () => {
  const personalized = renderToStaticMarkup(
    <GuidedStorySupport firstName="Lea" preview={preview} onContinue={() => {}} />,
  )
  assert.match(
    personalized,
    /Lea, deine Routine steht\. Jetzt hilft dir Chaarlie, sie im Alltag umzusetzen\./,
  )

  const fallback = renderToStaticMarkup(
    <GuidedStorySupport firstName="" preview={preview} onContinue={() => {}} />,
  )
  assert.match(
    fallback,
    /Deine Routine steht\. Jetzt hilft dir Chaarlie, sie im Alltag umzusetzen\./,
  )
})
