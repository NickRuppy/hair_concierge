import assert from "node:assert/strict"
import test from "node:test"

import { SCALP_CONDITIONS, SCALP_TYPES } from "../src/components/quiz/quiz-scalp-question"
import {
  DISCOVERY_LEGACY_SCALP_CONDITION_LABELS,
  DISCOVERY_LEGACY_SCALP_TYPE_LABELS,
  buildDiscoveryQuizAnswers,
  resolveDiscoveryMainConcern,
  type DiscoveryQuizAnswers,
} from "../src/lib/discovery/quiz-answers"

/**
 * „Quiz-Antworten" (batch 7c, F8): every quiz question with her answer in German, for both
 * quiz kinds, and the main problem — stated, single, or none (never inferred).
 */

type Ready = Extract<DiscoveryQuizAnswers, { status: "ready" }>

function ready(result: DiscoveryQuizAnswers): Ready {
  assert.equal(result.status, "ready")
  return result as Ready
}

function row(result: Ready, question: string) {
  const found = result.groups.flatMap((group) => group.rows).find((r) => r.question === question)
  assert.ok(found, `row „${question}" missing`)
  return found
}

function labels(result: Ready, question: string): string[] {
  return row(result, question).answers.map((answer) => answer.label)
}

function mainLabels(result: Ready, question: string): string[] {
  return row(result, question)
    .answers.filter((answer) => answer.main)
    .map((answer) => answer.label)
}

const legacyAnswers = {
  structure: "curly",
  thickness: "coarse",
  hair_length: "long",
  fingertest: "rau",
  pulltest: "snaps",
  scalp_type: "fettig",
  has_scalp_issue: true,
  scalp_condition: "gereizt",
  // Historical aliases, as stored before the visible concern cards were renamed.
  concerns: ["dryness", "frizz", "breakage"],
  treatment: ["blondiert"],
  goals: ["moisture", "shine"],
}

// --- main problem ----------------------------------------------------------------

test("main problem: stated wins, a single concern is the main one, otherwise none", () => {
  assert.equal(resolveDiscoveryMainConcern(["dry_lengths", "tangling"], "tangling"), "tangling")
  assert.equal(resolveDiscoveryMainConcern(["tangling"], undefined), "tangling")
  assert.equal(resolveDiscoveryMainConcern(["dry_lengths", "tangling"], undefined), null)
  assert.equal(resolveDiscoveryMainConcern([], "tangling"), null)
})

test("main problem: an invalid or no-longer-selected stated value is ignored", () => {
  assert.equal(resolveDiscoveryMainConcern(["dry_lengths", "tangling"], "bogus"), null)
  assert.equal(resolveDiscoveryMainConcern(["dry_lengths", "tangling"], 7), null)
  assert.equal(resolveDiscoveryMainConcern(["dry_lengths", "tangling"], "breakage"), null)
  // …and falls back to the single concern when there is only one.
  assert.equal(resolveDiscoveryMainConcern(["tangling"], "breakage"), "tangling")
  // The legacy vocabulary's aliases resolve like the quiz itself resolves them.
  assert.equal(resolveDiscoveryMainConcern(["dry_lengths", "tangling"], "dryness"), "dry_lengths")
})

// --- the standard quiz -----------------------------------------------------------

test("a legacy lead without primary_concern: German labels, grouped, no highlight", () => {
  const result = ready(
    buildDiscoveryQuizAnswers({ id: "lead-1", quiz_kind: "legacy", quiz_answers: legacyAnswers }),
  )
  assert.equal(result.kind, "legacy")
  assert.deepEqual(
    result.groups.map((group) => group.title),
    ["Haar", "Kopfhaut", "Behandlung", "Probleme", "Ziele"],
  )
  assert.deepEqual(labels(result, "Welche Haarstruktur haben die meisten deiner Haare?"), [
    "Lockig",
  ])
  assert.deepEqual(labels(result, "Wie dick fühlt sich ein einzelnes Haar bei dir meistens an?"), [
    "Dick",
  ])
  // Not answered → no answer; the section prints „—".
  assert.deepEqual(labels(result, "Wie dicht ist dein Haar insgesamt?"), [])
  assert.deepEqual(labels(result, "Wie fühlt sich deine Haaroberfläche an?"), [
    "Richtig rau und huckelig",
  ])
  assert.deepEqual(labels(result, "Wie fühlt sich deine Kopfhaut normalerweise an?"), [
    "Eher fettig",
  ])
  assert.deepEqual(
    labels(result, "Hast du zusätzlich Beschwerden wie Schuppen, Juckreiz oder Rötungen?"),
    ["Gereizte Kopfhaut"],
  )
  assert.deepEqual(labels(result, "Sind deine Haare chemisch behandelt?"), [
    "Blondiert / aufgehellt",
  ])
  // The concerns card labels the quiz showed her (texture-aware copy, aliases resolved).
  assert.deepEqual(labels(result, "Welche Haarprobleme beschäftigen dich gerade?"), [
    "Trockene oder strohige Längen",
    "Frizz oder viele abstehende Haare",
    "Mein Haar bricht in den Längen ab",
  ])
  assert.deepEqual(mainLabels(result, "Welche Haarprobleme beschäftigen dich gerade?"), [])
  assert.deepEqual(labels(result, "Was wünschst du dir für deine Haare?"), [
    "Intensive Feuchtigkeit",
    "Mehr Glanz",
  ])
  assert.deepEqual(result.concerns, ["dry_lengths", "frizz_flyaways", "breakage"])
  assert.equal(result.mainConcern, null)
})

test("a legacy lead with a stated primary_concern highlights it", () => {
  const result = ready(
    buildDiscoveryQuizAnswers({
      id: "lead-1",
      quiz_kind: "legacy",
      quiz_answers: { ...legacyAnswers, primary_concern: "breakage" },
    }),
  )
  assert.equal(result.mainConcern, "breakage")
  assert.deepEqual(mainLabels(result, "Welche Haarprobleme beschäftigen dich gerade?"), [
    "Mein Haar bricht in den Längen ab",
  ])
})

test("legacy: no scalp complaint reads „Nein“", () => {
  const result = ready(
    buildDiscoveryQuizAnswers({
      id: "lead-1",
      quiz_kind: "legacy",
      quiz_answers: { ...legacyAnswers, has_scalp_issue: false, scalp_condition: undefined },
    }),
  )
  assert.deepEqual(
    labels(result, "Hast du zusätzlich Beschwerden wie Schuppen, Juckreiz oder Rötungen?"),
    ["Nein"],
  )
})

test("the legacy scalp labels mirror the scalp step's own cards", () => {
  assert.deepEqual(
    DISCOVERY_LEGACY_SCALP_TYPE_LABELS,
    Object.fromEntries(SCALP_TYPES.map((option) => [option.value, option.label])),
  )
  assert.deepEqual(
    DISCOVERY_LEGACY_SCALP_CONDITION_LABELS,
    Object.fromEntries(SCALP_CONDITIONS.map((option) => [option.value, option.label])),
  )
})

// --- the personal-plan quiz -------------------------------------------------------

const personalPlanAnswers = {
  texture: "straight",
  thickness: "fine",
  density: "low",
  hairSurface: "smooth",
  elasticResponse: "stretches_bounces",
  chemicalTreatments: ["natural"],
  scalpOiliness: "oily",
  scalpConcerns: [],
  currentConcerns: ["lost_shape", "low_shine"],
  goals: ["shape_definition", "volume_balance"],
  blockers: ["product_fit"],
}

test("a personal-plan lead: its own question copy, texture-aware labels", () => {
  const result = ready(
    buildDiscoveryQuizAnswers({
      id: "lead-2",
      quiz_kind: "personal_plan",
      quiz_answers: { kind: "personal_plan", version: 3, answers: personalPlanAnswers },
    }),
  )
  assert.equal(result.kind, "personal_plan")
  assert.deepEqual(labels(result, "Welche Haarstruktur hast du?"), ["Glatt"])
  assert.deepEqual(labels(result, "Wie dick ist ein einzelnes Haar?"), ["Fein"])
  assert.deepEqual(labels(result, "Wie lang sind deine Haare aktuell?"), [])
  assert.deepEqual(labels(result, "Wie würdest du deine Kopfhaut beschreiben?"), ["Fettig"])
  // Answered with nothing selected is not the same as not answered.
  assert.deepEqual(labels(result, "Was trifft aktuell auf deine Kopfhaut zu?"), ["Nichts davon"])
  assert.deepEqual(labels(result, "Sind deine Haare chemisch behandelt?"), ["Naturhaar"])
  // Straight hair: the quiz asked about „Form und Halt", not curl definition.
  assert.deepEqual(labels(result, "Was beschäftigt dich gerade?"), [
    "Wenig Glanz",
    "Mein Haar verliert schnell Form und Halt",
  ])
  assert.deepEqual(labels(result, "Was wünschst du dir für deine Haare?"), [
    "Mehr Form und Halt",
    "Ausgewogenes Volumen",
  ])
  assert.deepEqual(labels(result, "Was macht eine passende Routine schwierig?"), [
    "Ich weiß nicht, welche Produkte zu meinem Haar passen",
  ])
  assert.equal(result.mainConcern, null)
})

test("a personal-plan lead with a stated main problem highlights it", () => {
  const result = ready(
    buildDiscoveryQuizAnswers({
      id: "lead-2",
      quiz_kind: "personal_plan",
      quiz_answers: {
        kind: "personal_plan",
        version: 3,
        answers: { ...personalPlanAnswers, primaryConcern: "lost_shape" },
      },
    }),
  )
  assert.equal(result.mainConcern, "lost_shape")
  assert.deepEqual(mainLabels(result, "Was beschäftigt dich gerade?"), [
    "Mein Haar verliert schnell Form und Halt",
  ])
})

test("no lead, an unknown quiz kind or unreadable answers say so instead of guessing", () => {
  assert.deepEqual(buildDiscoveryQuizAnswers(null), { status: "no_lead" })
  assert.deepEqual(buildDiscoveryQuizAnswers({ id: "x", quiz_kind: "other", quiz_answers: {} }), {
    status: "invalid",
  })
  assert.deepEqual(
    buildDiscoveryQuizAnswers({ id: "x", quiz_kind: "personal_plan", quiz_answers: "nope" }),
    { status: "invalid" },
  )
  assert.deepEqual(
    buildDiscoveryQuizAnswers({
      id: "x",
      quiz_kind: "personal_plan",
      quiz_answers: { kind: "personal_plan", version: 3 },
    }),
    { status: "invalid" },
  )
})
