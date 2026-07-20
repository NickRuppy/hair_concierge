import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { renderToStaticMarkup } from "react-dom/server"

import { GuidedStorySupport } from "../src/components/quiz/guided-story-support"
import { buildQuizGuidedStoryPreview } from "../src/lib/quiz/guided-story-preview"

test("renders the approved independent chat, tracker, proof, and pricing handoff", () => {
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
  const html = renderToStaticMarkup(<GuidedStorySupport preview={preview} onContinue={() => {}} />)

  assert.match(html, /Deine Routine steht\. Doch im Alltag dranzubleiben, ist nicht immer leicht\./)
  assert.match(html, /data-guided-story-chat=/)
  assert.match(html, /data-testid="guided-story-tracker-proof"/)
  assert.match(html, /Im Chat hat das Antworten super geklappt/)
  assert.match(html, /meine Fragen stellen zu können/)
  assert.match(html, /Bereit für deinen Weg zu gesünderem, schönerem Haar\?/)
  assert.match(html, /Ja, mit Chaarlie starten/)
})

test("warms shared checkout readiness without mounting pricing or coupling chat and tracker", () => {
  const source = readFileSync(
    new URL("../src/components/quiz/guided-story-support.tsx", import.meta.url),
    "utf8",
  )

  assert.match(source, /warmOfferStripe\(\)/)
  assert.doesNotMatch(source, /ResultOfferPricing|pricingSlot/)
  assert.doesNotMatch(source, /setTimeout|onChat|onTracker/)
})
