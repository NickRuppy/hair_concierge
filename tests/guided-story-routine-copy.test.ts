import assert from "node:assert/strict"
import test from "node:test"

import {
  GUIDED_STORY_CHAPTER_TWO_CTA_LABEL,
  GUIDED_STORY_CHAPTER_TWO_HANDOFF,
  GUIDED_STORY_LOCKED_CTA_LABEL,
  GUIDED_STORY_LOCKED_POPOVER,
  resolveGuidedStoryRoutineCopy,
} from "../src/lib/quiz/guided-story-routine-copy"
import { buildQuizGuidedStoryPreview } from "../src/lib/quiz/guided-story-preview"
import type { OfferPreviewCategory } from "../src/lib/quiz/offer-preview-types"
import type { QuizAnswers } from "../src/lib/quiz/types"

const baseAnswers: QuizAnswers = {
  structure: "straight",
  thickness: "normal",
  density: "medium",
  scalp_type: "ausgeglichen",
  has_scalp_issue: false,
  concerns: [],
  treatment: ["natur"],
  goals: [],
}

function words(value: string): number {
  return value.trim().split(/\s+/).length
}

function productPopover(answers: QuizAnswers, category: OfferPreviewCategory): string {
  const preview = buildQuizGuidedStoryPreview(answers)
  const product = preview.products.find((candidate) => candidate.category === category)
  assert.ok(product, `expected ${category} product`)
  const copy = resolveGuidedStoryRoutineCopy(preview).products.find(
    (candidate) => candidate.key === product.key,
  )
  assert.ok(copy, `expected ${category} copy`)
  assert.match(copy.popover, new RegExp(product.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
  assert.ok(words(copy.popover) >= 25, copy.popover)
  assert.ok(words(copy.popover) <= 45, copy.popover)
  assert.doesNotMatch(copy.popover, /Mit Chaarlie starten/)
  assert.doesNotMatch(copy.popover, /Dein Signal|Deine Aktion|Produkttyp|Beispiel:/)
  return copy.popover
}

function productCopy(answers: QuizAnswers, category: OfferPreviewCategory) {
  const preview = buildQuizGuidedStoryPreview(answers)
  const product = preview.products.find((candidate) => candidate.category === category)
  assert.ok(product, `expected ${category} product`)
  const copy = resolveGuidedStoryRoutineCopy(preview).products.find(
    (candidate) => candidate.key === product.key,
  )
  assert.ok(copy, `expected ${category} copy`)
  return copy
}

test("resolves truthful shampoo copy across scalp routes", () => {
  const cases: Array<[Partial<QuizAnswers>, RegExp]> = [
    [{ scalp_type: "trocken" }, /Trockenheit|mildes Shampoo/],
    [{ scalp_condition: "schuppen", has_scalp_issue: true }, /Schuppen|Anti-Schuppen-Shampoo/],
    [{ scalp_condition: "gereizt", has_scalp_issue: true }, /empfindlich|sanftes Shampoo/],
    [{ scalp_type: "fettig" }, /Ansatz fettet schneller|reinigendes Shampoo/],
    [{ scalp_type: "ausgeglichen" }, /gut ausgeglichen|stabile Basis/],
  ]

  for (const [answers, expected] of cases) {
    assert.match(productPopover({ ...baseAnswers, ...answers }, "shampoo"), expected)
  }
})

test("keeps the coarse oily shampoo fallback explicitly provisional", () => {
  const answers: QuizAnswers = {
    ...baseAnswers,
    scalp_type: "fettig",
    thickness: "coarse",
  }
  const copy = productCopy(answers, "shampoo")

  assert.equal(copy.categoryLabel, "Shampoo · vorläufiges Beispiel")
  assert.match(copy.popover, /nur ein vorläufiges Beispiel/)
  assert.match(copy.popover, /finalisiert das konkrete Shampoo mit dir/)
})

test("resolves conditioner copy from balance without inventing a deficiency diagnosis", () => {
  assert.match(
    productPopover({ ...baseAnswers, pulltest: "snaps" }, "conditioner"),
    /Zugtest spricht für eine feuchtigkeitsorientierte Pflege/,
  )
  assert.match(
    productPopover({ ...baseAnswers, pulltest: "stretches_stays" }, "conditioner"),
    /Zugtest spricht für eine proteinorientierte Pflege/,
  )
  assert.match(
    productPopover({ ...baseAnswers, pulltest: "stretches_bounces" }, "conditioner"),
    /Haarstärke und Dichte sprechen für eine ausgewogene Pflege/,
  )
})

test("resolves every targeted category and both leave-in variants with product names", () => {
  const cases: Array<[QuizAnswers, OfferPreviewCategory, RegExp]> = [
    [
      {
        ...baseAnswers,
        pulltest: "stretches_stays",
        concerns: ["breakage"],
        treatment: ["blondiert"],
        goals: ["anti_breakage"],
      },
      "bondbuilder",
      /Bond-Pflege/,
    ],
    [
      { ...baseAnswers, pulltest: "stretches_stays", concerns: ["breakage"] },
      "protein_mask",
      /Proteinmaske/,
    ],
    [
      { ...baseAnswers, pulltest: "snaps", concerns: ["dryness"] },
      "moisture_mask",
      /Feuchtigkeitsmaske/,
    ],
    [
      { ...baseAnswers, concerns: ["frizz"], fingertest: "rau", structure: "straight" },
      "leave_in",
      /leichtes Leave-in/,
    ],
    [
      { ...baseAnswers, concerns: ["frizz"], fingertest: "rau", structure: "curly" },
      "leave_in",
      /Locken-Leave-in/,
    ],
    [{ ...baseAnswers, concerns: ["split_ends"], goals: ["less_split_ends"] }, "oil", /Haaröl/],
  ]

  for (const [answers, category, expected] of cases) {
    assert.match(productPopover(answers, category), expected)
  }
})

test("normalizes visible category labels independently of legacy module wording", () => {
  const cases: Array<[QuizAnswers, OfferPreviewCategory, string]> = [
    [baseAnswers, "shampoo", "Shampoo · Beispiel"],
    [baseAnswers, "conditioner", "Conditioner · Beispiel"],
    [
      {
        ...baseAnswers,
        pulltest: "stretches_stays",
        concerns: ["breakage"],
        treatment: ["blondiert"],
      },
      "bondbuilder",
      "Bond-Pflege · Vorschlag",
    ],
    [
      { ...baseAnswers, pulltest: "stretches_stays", concerns: ["breakage"] },
      "protein_mask",
      "Proteinmaske · Vorschlag",
    ],
    [
      { ...baseAnswers, pulltest: "snaps", concerns: ["dryness"] },
      "moisture_mask",
      "Feuchtigkeitsmaske · Vorschlag",
    ],
    [
      { ...baseAnswers, concerns: ["frizz"], fingertest: "rau", structure: "straight" },
      "leave_in",
      "Leave-in · Vorschlag",
    ],
    [
      { ...baseAnswers, concerns: ["frizz"], fingertest: "rau", structure: "curly" },
      "leave_in",
      "Locken-Leave-in · Vorschlag",
    ],
    [
      { ...baseAnswers, concerns: ["split_ends"], goals: ["less_split_ends"] },
      "oil",
      "Haaröl · Vorschlag",
    ],
  ]

  for (const [answers, category, expected] of cases) {
    assert.equal(productCopy(answers, category).categoryLabel, expected)
  }
})

test("keeps the locked CTA and Chapter 2 handoff on their approved strings", () => {
  const copy = resolveGuidedStoryRoutineCopy(buildQuizGuidedStoryPreview(baseAnswers))

  assert.equal(copy.lockedPopover, GUIDED_STORY_LOCKED_POPOVER)
  assert.equal(copy.lockedCtaLabel, GUIDED_STORY_LOCKED_CTA_LABEL)
  assert.equal(copy.handoff, GUIDED_STORY_CHAPTER_TWO_HANDOFF)
  assert.equal(copy.handoffCtaLabel, GUIDED_STORY_CHAPTER_TWO_CTA_LABEL)
  assert.equal(copy.continuation, "So setzt deine Routine bei deinen drei wichtigsten Themen an.")
})

test("uses sparse basis intro when no truthful third product exists", () => {
  const fallback = resolveGuidedStoryRoutineCopy(buildQuizGuidedStoryPreview(baseAnswers))
  const targeted = resolveGuidedStoryRoutineCopy(
    buildQuizGuidedStoryPreview({ ...baseAnswers, concerns: ["frizz"], fingertest: "rau" }),
  )

  assert.doesNotMatch(fallback.basisIntro, /plus der Schritt/)
  assert.match(targeted.basisIntro, /plus der Schritt/)
})
