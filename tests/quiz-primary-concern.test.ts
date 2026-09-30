import assert from "node:assert/strict"
import test from "node:test"

import { buildAppValueStackHeroCopy } from "../src/lib/quiz/app-value-stack-copy"
import { buildProfilePrimaryConcern } from "../src/lib/quiz/link-to-profile"
import { resolveQuizNeed } from "../src/lib/quiz/need-lane"
import {
  canonicalizeQuizAnswers,
  normalizeStoredQuizAnswers,
  projectQuizAnswersForLegacyConsumers,
} from "../src/lib/quiz/normalization"
import { buildQuizOfferPreview } from "../src/lib/quiz/offer-preview"
import {
  reconcilePrimaryConcern,
  requiresPrimaryConcernPick,
  resolveStatedPrimaryConcern,
  toLegacyQuizConcern,
} from "../src/lib/quiz/primary-concern"
import { buildQuizResultNarrative } from "../src/lib/quiz/result-narrative"
import type { QuizAnswers } from "../src/lib/quiz/types"
import { leadSchema, quizAnswersSchema, storedQuizAnswersSchema } from "../src/lib/quiz/validators"

/**
 * F1 (discovery batch 7, plan Rev. 3 §1.1): the main problem is what she STATED — a
 * one-tap pick when she selected two or more concerns, or her only concern. The
 * inferred weight ranking is retired; without a statement there is no main problem.
 */

const COMPLETE: QuizAnswers = {
  structure: "wavy",
  thickness: "normal",
  density: "medium",
  hair_length: "medium",
  fingertest: "glatt",
  pulltest: "stretches_bounces",
  scalp_type: "ausgeglichen",
  has_scalp_issue: false,
  concerns: [],
  treatment: ["natur"],
  goals: ["moisture"],
}

// --- resolveStatedPrimaryConcern -------------------------------------------------

const STATED_TABLE: Array<{
  name: string
  answers: Pick<QuizAnswers, "concerns" | "primary_concern">
  expected: string | null
}> = [
  { name: "no concerns", answers: { concerns: [] }, expected: null },
  { name: "concerns missing", answers: {}, expected: null },
  {
    name: "one concern, no pick",
    answers: { concerns: ["frizz_flyaways"] },
    expected: "frizz_flyaways",
  },
  {
    name: "one concern with the same pick",
    answers: { concerns: ["breakage"], primary_concern: "breakage" },
    expected: "breakage",
  },
  {
    name: "one concern with a stale pick falls back to the only concern",
    answers: { concerns: ["breakage"], primary_concern: "low_shine" },
    expected: "breakage",
  },
  {
    name: "two concerns with a pick",
    answers: { concerns: ["breakage", "frizz_flyaways"], primary_concern: "frizz_flyaways" },
    expected: "frizz_flyaways",
  },
  {
    name: "two concerns without a pick (legacy answers)",
    answers: { concerns: ["breakage", "frizz_flyaways"] },
    expected: null,
  },
  {
    name: "two concerns with a stale pick",
    answers: { concerns: ["breakage", "frizz_flyaways"], primary_concern: "tangling" },
    expected: null,
  },
  {
    name: "legacy aliases stay in their own vocabulary",
    answers: { concerns: ["dryness", "frizz"], primary_concern: "dryness" },
    expected: "dryness",
  },
  {
    name: "non-legacy pick",
    answers: { concerns: ["low_shine", "hair_damage"], primary_concern: "low_shine" },
    expected: "low_shine",
  },
  {
    name: "unknown pick value is ignored",
    answers: {
      concerns: ["low_shine", "hair_damage"],
      primary_concern: "not_a_concern" as never,
    },
    expected: null,
  },
]

for (const row of STATED_TABLE) {
  test(`resolveStatedPrimaryConcern: ${row.name}`, () => {
    assert.equal(resolveStatedPrimaryConcern(row.answers), row.expected)
  })
}

test("a pick is asked for only with two or more concerns", () => {
  assert.equal(requiresPrimaryConcernPick([]), false)
  assert.equal(requiresPrimaryConcernPick(["breakage"]), false)
  assert.equal(requiresPrimaryConcernPick(["breakage", "low_shine"]), true)
})

test("reconcilePrimaryConcern keeps a contained pick and drops a stale one", () => {
  assert.equal(reconcilePrimaryConcern(["breakage", "low_shine"], "low_shine"), "low_shine")
  assert.equal(reconcilePrimaryConcern(["breakage"], "low_shine"), undefined)
  assert.equal(reconcilePrimaryConcern(["breakage", "low_shine"], undefined), undefined)
})

test("toLegacyQuizConcern maps aliases and leaves the four non-legacy codes out", () => {
  assert.equal(toLegacyQuizConcern("dry_lengths"), "dryness")
  assert.equal(toLegacyQuizConcern("frizz_flyaways"), "frizz")
  for (const legacy of ["hair_damage", "split_ends", "breakage", "dryness", "frizz", "tangling"]) {
    assert.equal(toLegacyQuizConcern(legacy as never), legacy)
  }
  for (const nonLegacy of [
    "low_shine",
    "lost_shape",
    "low_volume_or_weighed_down",
    "hair_loss_or_thinning",
  ]) {
    assert.equal(toLegacyQuizConcern(nonLegacy as never), null)
  }
  assert.equal(toLegacyQuizConcern(null), null)
})

// --- need lane --------------------------------------------------------------------

test("need lane: the stated pick decides, not a weight ranking", () => {
  // Frizz beats breakage because she said so — the retired ranking picked breakage.
  const resolution = resolveQuizNeed({
    ...COMPLETE,
    goals: [],
    concerns: ["breakage", "frizz"],
    primary_concern: "frizz",
  })
  assert.equal(resolution.primaryConcern, "frizz")
  assert.equal(resolution.lane, "surface_support")
})

test("need lane: several concerns without a pick run with no primary concern", () => {
  const resolution = resolveQuizNeed({ ...COMPLETE, goals: [], concerns: ["breakage", "frizz"] })
  assert.equal(resolution.primaryConcern, null)
  assert.equal(resolution.lane, "base")
})

test("need lane: aliases map into the legacy vocabulary", () => {
  assert.equal(
    resolveQuizNeed({ ...COMPLETE, goals: [], concerns: ["dry_lengths"] }).primaryConcern,
    "dryness",
  )
  assert.equal(
    resolveQuizNeed({
      ...COMPLETE,
      goals: [],
      concerns: ["frizz_flyaways", "breakage"],
      primary_concern: "frizz_flyaways",
    }).primaryConcern,
    "frizz",
  )
})

for (const nonLegacy of [
  "low_shine",
  "lost_shape",
  "low_volume_or_weighed_down",
  "hair_loss_or_thinning",
] as const) {
  test(`need lane: stated ${nonLegacy} falls back to no primary concern`, () => {
    const resolution = resolveQuizNeed({
      ...COMPLETE,
      goals: [],
      concerns: [nonLegacy, "breakage"],
      primary_concern: nonLegacy,
    })
    assert.equal(resolution.primaryConcern, null)
    assert.equal(resolution.lane, "base")
  })
}

test("need lane: the explicit stated concern wins over a collapsed legacy projection", () => {
  // Raw: two concerns, one of them non-legacy, no pick. The legacy projection alone
  // would see a single "dryness" and wrongly treat it as stated.
  const raw: QuizAnswers = { ...COMPLETE, goals: [], concerns: ["dry_lengths", "low_shine"] }
  const projected = projectQuizAnswersForLegacyConsumers(raw)
  assert.deepEqual(projected.concerns, ["dryness"])
  assert.equal(resolveQuizNeed(projected, resolveStatedPrimaryConcern(raw)).primaryConcern, null)
})

// --- narrative copy ---------------------------------------------------------------

test("narrative: the stated pick drives the intro and the friction row", () => {
  const narrative = buildQuizResultNarrative({
    ...COMPLETE,
    concerns: ["breakage", "frizz_flyaways"],
    primary_concern: "frizz_flyaways",
    goals: ["frizz_surface"],
  })
  assert.equal(narrative.primaryConcern, "frizz")
  assert.match(narrative.intro, /^Du hast gesagt, dass dich vor allem Frizz stört/)
  assert.equal(narrative.rows[1].before, "Frizz")
})

test("narrative: legacy multi-concern answers without a pick get neutral copy", () => {
  const narrative = buildQuizResultNarrative({
    ...COMPLETE,
    concerns: ["breakage", "frizz"],
    goals: ["less_frizz"],
  })
  assert.equal(narrative.primaryConcern, null)
  assert.doesNotMatch(narrative.intro, /vor allem/)
  assert.doesNotMatch(narrative.intro, /stört/)
  assert.equal(narrative.rows[1].before, "unpassende Pflege")
})

test("narrative: legacy multi-concern answers without a pick and without goals stay neutral", () => {
  const narrative = buildQuizResultNarrative({
    ...COMPLETE,
    concerns: ["breakage", "frizz"],
    goals: [],
  })
  assert.equal(
    narrative.intro,
    "Wir sehen schon, was dein Haar gerade noch ausbremst und in welche Richtung wir dein Haar jetzt weiterentwickeln.",
  )
})

const NON_LEGACY_COPY: Record<string, { before: string }> = {
  low_shine: { before: "wenig Glanz" },
  lost_shape: { before: "Formverlust" },
  low_volume_or_weighed_down: { before: "plattes, beschwertes Haar" },
  hair_loss_or_thinning: { before: "Haarausfall oder dünner werdendes Haar" },
}

for (const [concern, expected] of Object.entries(NON_LEGACY_COPY)) {
  test(`narrative: stated ${concern} has its own copy and does not crash`, () => {
    const narrative = buildQuizResultNarrative({
      ...COMPLETE,
      concerns: [concern as never, "breakage"],
      primary_concern: concern as never,
      goals: ["moisture"],
    })
    assert.equal(narrative.primaryConcern, concern)
    assert.equal(narrative.rows[1].before, expected.before)
    assert.ok(
      narrative.intro.startsWith(`Du hast gesagt, dass dich vor allem ${expected.before} stört`),
      narrative.intro,
    )
    assert.ok(narrative.rows[1].after.length > 0)
  })
}

test("narrative: hair loss keeps the medical boundary and promises no product result", () => {
  const narrative = buildQuizResultNarrative({
    ...COMPLETE,
    concerns: ["hair_loss_or_thinning"],
    goals: [],
  })
  assert.equal(narrative.primaryConcern, "hair_loss_or_thinning")
  assert.match(narrative.rows[1].after, /ärztlich/)
  assert.doesNotMatch(
    `${narrative.rows[1].after} ${narrative.needs.mainLeverProducts}`,
    /stopp|wächst|nachwachs|gegen haarausfall/i,
  )
})

test("app value stack: a stated non-legacy concern gets its lead, hair loss and none stay neutral", () => {
  const lowShine = buildQuizResultNarrative({
    ...COMPLETE,
    concerns: ["low_shine"],
    goals: ["shine"],
  })
  const lowShineCopy = buildAppValueStackHeroCopy({ narrative: lowShine, lane: "base" })
  assert.match(lowShineCopy.intro, /^Wenig Glanz ist dein wichtigster Pflegefokus\./)

  const hairLoss = buildQuizResultNarrative({
    ...COMPLETE,
    concerns: ["hair_loss_or_thinning"],
    goals: ["shine"],
  })
  const hairLossCopy = buildAppValueStackHeroCopy({ narrative: hairLoss, lane: "base" })
  assert.match(hairLossCopy.intro, /^Dein Ziel: /)

  const unstated = buildQuizResultNarrative({
    ...COMPLETE,
    concerns: ["breakage", "frizz"],
    goals: ["shine"],
  })
  assert.match(
    buildAppValueStackHeroCopy({ narrative: unstated, lane: "base" }).intro,
    /^Dein Ziel: /,
  )
})

test("offer preview lane follows the stated pick from the raw answers", () => {
  const stated = buildQuizOfferPreview({
    ...COMPLETE,
    goals: [],
    concerns: ["breakage", "frizz_flyaways"],
    primary_concern: "frizz_flyaways",
  })
  assert.equal(stated.lane, "surface_support")

  const unstated = buildQuizOfferPreview({
    ...COMPLETE,
    goals: [],
    concerns: ["dry_lengths", "low_shine"],
  })
  assert.equal(unstated.lane, "base")
})

// --- validators, canonicalisation, stored re-read -----------------------------------

const LEAD = { name: "Lea", email: "lea@example.com", marketingConsent: false }

test("lead schema accepts the new key and still accepts answers without it", () => {
  const withPick = leadSchema.parse({
    ...LEAD,
    quizAnswers: { ...COMPLETE, concerns: ["breakage", "low_shine"], primary_concern: "low_shine" },
  })
  assert.equal(withPick.quizAnswers.primary_concern, "low_shine")

  const without = leadSchema.parse({
    ...LEAD,
    quizAnswers: { ...COMPLETE, concerns: ["breakage"] },
  })
  assert.equal(without.quizAnswers.primary_concern, undefined)
})

test("lead schema never rejects a stale pick; canonicalisation drops it", () => {
  const parsed = leadSchema.parse({
    ...LEAD,
    quizAnswers: { ...COMPLETE, concerns: ["breakage"], primary_concern: "low_shine" },
  })
  const canonical = canonicalizeQuizAnswers(parsed.quizAnswers)
  assert.equal(canonical.primary_concern, undefined)
  assert.ok(!("primary_concern" in JSON.parse(JSON.stringify(canonical))))
})

test("lead schema rejects a pick outside the concern vocabulary", () => {
  assert.throws(() =>
    quizAnswersSchema.parse({ ...COMPLETE, concerns: ["breakage"], primary_concern: "dandruff" }),
  )
})

test("canonicalisation keeps a contained pick", () => {
  const canonical = canonicalizeQuizAnswers({
    ...COMPLETE,
    concerns: ["breakage", "low_shine"],
    primary_concern: "low_shine",
  })
  assert.equal(canonical.primary_concern, "low_shine")
})

test("stored re-read: old answers without the key and new answers with it both parse", () => {
  const legacy = storedQuizAnswersSchema.safeParse(
    normalizeStoredQuizAnswers({ ...COMPLETE, concerns: ["breakage", "frizz"] }),
  )
  assert.equal(legacy.success, true)

  const current = storedQuizAnswersSchema.safeParse(
    normalizeStoredQuizAnswers({
      ...COMPLETE,
      concerns: ["breakage", "frizz_flyaways"],
      primary_concern: "frizz_flyaways",
    }),
  )
  assert.equal(current.success, true)
  assert.equal(current.success && current.data.primary_concern, "frizz_flyaways")
})

test("stored re-read drops a stale pick instead of failing", () => {
  const normalized = normalizeStoredQuizAnswers({
    ...COMPLETE,
    concerns: ["breakage"],
    primary_concern: "frizz_flyaways",
  })
  assert.equal(normalized.primary_concern, undefined)
  assert.equal(storedQuizAnswersSchema.safeParse(normalized).success, true)
})

// --- hair profile projection --------------------------------------------------------

test("profile projection writes the legacy vocabulary like concerns", () => {
  assert.equal(
    buildProfilePrimaryConcern({
      concerns: ["dry_lengths", "breakage"],
      primary_concern: "dry_lengths",
    }),
    "dryness",
  )
  assert.equal(buildProfilePrimaryConcern({ concerns: ["hair_loss_or_thinning"] }), "hair_loss")
  assert.equal(buildProfilePrimaryConcern({ concerns: ["breakage", "frizz"] }), null)
  assert.equal(
    buildProfilePrimaryConcern({
      concerns: ["low_shine", "breakage"],
      primary_concern: "low_shine",
    }),
    null,
  )
  assert.equal(buildProfilePrimaryConcern({ concerns: [] }), null)
})
