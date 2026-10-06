import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import test from "node:test"

import { CATEGORY_COPY } from "../src/components/personal-plan-products/stage3-product-copy"
import {
  COCKPIT_DANDRUFF_SUFFIX,
  COCKPIT_NOT_NEEDED_REASONS,
  COCKPIT_VOICE_MAP,
  cockpitVoice,
} from "../src/lib/discovery/cockpit-copy"
import type { PersonalPlanCategory } from "../src/lib/personal-plan/products/contracts"
import { scanReasonsLabel } from "../src/lib/scan/result-presentation"
import {
  SCAN_NOT_NEEDED_REASON_COPY,
  SCAN_VERDICT_COPY,
  scanDeferredSubtitle,
  scanNotNeededHeadline,
  scanNotNeededSubtitle,
} from "../src/lib/scan/verdict-labels"

/**
 * Verdict-layer T4 (O4): the cockpit's neutral variants of shared verdict copy. The map is
 * explicit; these tests pin that every entry is a real shared string, every neutral variant
 * is free of the second person, and anything the map does not know passes through as is.
 */

/** Second-person forms (du, dein…, dir, dich) as whole words, any case. */
const SECOND_PERSON =
  /(^|[^\p{L}])(du|dein|deine|deinem|deinen|deiner|deines|dir|dich)(?=[^\p{L}]|$)/iu

/**
 * Third-person pronouns about the participant (sie, ihr…), as whole words, any case. The
 * cockpit speaks pronoun-free (Nick's ruling 2026-09-29).
 */
const THIRD_PERSON = /(^|[^\p{L}])(sie|ihr|ihre|ihrem|ihren|ihrer|ihres)(?=[^\p{L}]|$)/iu

const CATEGORIES = Object.keys(CATEGORY_COPY) as PersonalPlanCategory[]

const SOURCES = [
  "src/lib/personal-plan/decision-presentation.ts",
  "src/lib/personal-plan/routine/labels.ts",
  "src/lib/personal-plan/products/authority/categories/conditioner.ts",
  "src/components/scan/scan-verdict-sections.tsx",
  "src/lib/scan/verdict-labels.ts",
  "src/lib/scan/result-presentation.ts",
].map((file) => readFileSync(path.join(process.cwd(), file), "utf8"))

test("known shared strings map to their neutral variant", () => {
  assert.equal(cockpitVoice("Passt nicht zu deinem Haar"), "Passt nicht zum Haarprofil")
  assert.equal(cockpitVoice("Passt zu deinem Haar"), "Passt zum Haarprofil")
  assert.equal(
    cockpitVoice(
      "Deine Kopfhaut ist eher trocken. Deshalb eine milde Reinigung, die ihr nicht zusätzlich Fett entzieht.",
    ),
    "Die Kopfhaut ist eher trocken. Deshalb eine milde Reinigung ohne zusätzlichen Fettentzug.",
  )
  assert.equal(cockpitVoice("Du stylst aktuell ohne Hitze."), "Aktuell Styling ohne Hitze.")
  assert.equal(cockpitVoice("Das übernimmt bei dir:"), "Das übernimmt bereits:")
})

test("scan verdict titles come from the scan's own copy object", () => {
  assert.equal(cockpitVoice(SCAN_VERDICT_COPY.mismatch.title), "Passt nicht zum Haarprofil")
  assert.equal(
    cockpitVoice(SCAN_VERDICT_COPY.supportive.title),
    "Passt mit Einschränkung zum Haarprofil",
  )
  // Labels without a second person are not in the map and stay exactly as they are.
  assert.equal(cockpitVoice(SCAN_VERDICT_COPY.mismatch.label), "Passt nicht")
  assert.equal(cockpitVoice(SCAN_VERDICT_COPY.unknown.title), SCAN_VERDICT_COPY.unknown.title)
})

test("every not_needed reason the scan knows has a neutral variant", () => {
  assert.deepEqual(
    Object.keys(COCKPIT_NOT_NEEDED_REASONS).sort(),
    Object.keys(SCAN_NOT_NEEDED_REASON_COPY).sort(),
  )
  for (const [id, copy] of Object.entries(SCAN_NOT_NEEDED_REASON_COPY)) {
    assert.notEqual(cockpitVoice(copy), copy, id)
  }
})

test("per-category not_needed templates are mapped for every category", () => {
  for (const category of CATEGORIES) {
    const label = CATEGORY_COPY[category].label
    const headline = cockpitVoice(scanNotNeededHeadline(category))
    assert.match(headline, new RegExp(`^Aktuell (kein|keine) ${label} nötig$`), category)
    assert.equal(
      cockpitVoice(scanNotNeededSubtitle(category)),
      scanNotNeededSubtitle(category).replace("in deinem Bedarf", "im Bedarf"),
    )
    assert.ok(cockpitVoice(scanDeferredSubtitle(category)).includes("steht die Einschätzung"))
    const reasons = cockpitVoice(
      scanReasonsLabel({ kind: "not_needed", mode: "not_needed", category }),
    )
    assert.match(reasons, /^Warum (kein|keine) .+ nötig ist$/, category)
  }
  // Grammar spot checks: the accusative article turns nominative in the headline only.
  assert.equal(cockpitVoice(scanNotNeededHeadline("conditioner")), "Aktuell kein Conditioner nötig")
  assert.equal(
    cockpitVoice(
      scanReasonsLabel({ kind: "not_needed", mode: "not_needed", category: "conditioner" }),
    ),
    "Warum kein Conditioner nötig ist",
  )
})

test("every neutral variant is pronoun-free: no second person, no sie/ihr", () => {
  for (const [shared, neutral] of COCKPIT_VOICE_MAP) {
    assert.ok(!SECOND_PERSON.test(neutral), `still second person: ${neutral} (from ${shared})`)
    assert.ok(!THIRD_PERSON.test(neutral), `still third person: ${neutral} (from ${shared})`)
  }
})

test("every map key is a real shared string (drift guard)", () => {
  for (const shared of COCKPIT_VOICE_MAP.keys()) {
    const generated = CATEGORIES.some(
      (category) =>
        shared === scanNotNeededHeadline(category) ||
        shared === scanNotNeededSubtitle(category) ||
        shared === scanDeferredSubtitle(category) ||
        shared === scanReasonsLabel({ kind: "not_needed", mode: "not_needed", category }),
    )
    assert.ok(
      generated || SOURCES.some((source) => source.includes(shared)),
      `not found in any shared source: ${shared}`,
    )
    assert.ok(SECOND_PERSON.test(shared), `mapped without need: ${shared}`)
  }
})

test("the dandruff tail is kept after a mapped shampoo sentence", () => {
  const head =
    "Deine Kopfhaut fettet schneller nach. Deshalb eine ausgleichende Reinigung, die Talg zuverlässig mitnimmt, ohne die Kopfhaut zu reizen."
  assert.equal(
    cockpitVoice(`${head}${COCKPIT_DANDRUFF_SUFFIX}`),
    `${cockpitVoice(head)}${COCKPIT_DANDRUFF_SUFFIX}`,
  )
  // The tail alone after an unknown head changes nothing.
  assert.equal(
    cockpitVoice(`Etwas anderes.${COCKPIT_DANDRUFF_SUFFIX}`),
    `Etwas anderes.${COCKPIT_DANDRUFF_SUFFIX}`,
  )
})

test("unknown strings pass through untouched — no blind pronoun rewriting", () => {
  for (const text of [
    "",
    "Sebamed Anti Schuppen",
    "Anti-Schuppen trocknet ihre Kopfhaut weiter aus.",
    // A second-person string the map does not know stays second person (visible, not mangled).
    "Deine Haare sind wunderschön.",
    // Case variants are different strings: exact match only.
    "passt nicht zu deinem Haar",
    "PASST NICHT ZU DEINEM HAAR",
    " Passt nicht zu deinem Haar",
  ]) {
    assert.equal(cockpitVoice(text), text)
  }
})

test("the participant's copy objects are not mutated by building the map", () => {
  assert.equal(SCAN_VERDICT_COPY.mismatch.title, "Passt nicht zu deinem Haar")
  assert.equal(
    SCAN_NOT_NEEDED_REASON_COPY["heat_protectant.inclusion.no_heat_event"],
    "Du stylst aktuell ohne Hitze.",
  )
})
