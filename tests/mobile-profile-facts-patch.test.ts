import assert from "node:assert/strict"
import test from "node:test"

import {
  MOBILE_ANSWER_GROUPS,
  MobileProfileFactsError,
  buildMobileHandEditFacts,
  buildMobileQuizFacts,
  toProfileFactsArgument,
} from "../src/lib/mobile/profile-facts-patch"
import { quizSupersedesFacts } from "../src/lib/user-facts/account-link"
import { deriveDiagnosticsColumns } from "../src/lib/user-facts/derive-legacy-columns"
import { buildLegacyQuizStage1Source } from "../src/lib/personal-plan/input"
import { diagnosticsV1Schema, type DiagnosticsV1 } from "../src/lib/user-facts/schema"
import type { UserFacts } from "../src/lib/user-facts/read"
import type { QuizAnswers } from "../src/lib/quiz/types"

/**
 * Clean-switch tasks 3 + 4: the pure builders that turn submitted iOS answers into the facts
 * `scanner_profile_edit_publish` / `mobile_registration_publish` hand to `user_facts_save_v1`.
 * Test-first; the adversarial block at the bottom feeds inputs designed to break them.
 */

const NOW = "2026-09-30T12:00:00.000Z"
const EARLIER = "2026-09-01T08:00:00.000Z"

const ANSWERS: QuizAnswers = {
  structure: "wavy",
  thickness: "fine",
  density: "medium",
  hair_length: "long",
  fingertest: "rau",
  pulltest: "stretches_bounces",
  scalp_type: "ausgeglichen",
  has_scalp_issue: false,
  treatment: ["natur"],
  concerns: ["dryness"],
  goals: ["moisture"],
}

type Stored = Pick<UserFacts, "diagnostics" | "provenance" | "quizContext" | "legacyColumns">

const NO_FACTS: Stored = {
  diagnostics: null,
  provenance: {},
  quizContext: null,
  legacyColumns: { density: null, hair_length: null },
}

/** A quiz-sourced diagnostics document as the account link writes one. */
function quizFacts(overrides: Partial<DiagnosticsV1> = {}, fields = {}): Stored {
  const diagnostics = diagnosticsV1Schema.parse({
    texture: "wavy",
    thickness: "fine",
    density: "medium",
    hairLength: "long",
    hairSurface: "rough",
    elasticResponse: "stretches_bounces",
    chemicalTreatments: ["natural"],
    scalpOiliness: "balanced",
    scalpConcerns: [],
    goals: ["moisture"],
    currentConcerns: ["dry_lengths"],
    source: {
      kind: "legacy_quiz",
      version: 1,
      leadId: "lead-web",
      raw: { kind: "legacy_quiz", version: 1, leadId: "lead-web", answers: {} },
      takenAt: EARLIER,
    },
    ...overrides,
  })
  return {
    diagnostics,
    provenance: {
      diagnostics: {
        source: { kind: "legacy_lead", id: "lead-web" },
        schemaVersion: 1,
        at: EARLIER,
        fields,
      },
    },
    quizContext: null,
    legacyColumns: { density: diagnostics.density ?? null, hair_length: "long" },
  }
}

/** What `user_facts_save_v1` stores: the patch merged over the old document, a top-level
 * JSON null clearing the key. */
function merge(old: DiagnosticsV1 | null, patch: Record<string, unknown>): DiagnosticsV1 {
  const next: Record<string, unknown> = { ...(old ?? {}), ...patch }
  for (const [key, value] of Object.entries(patch)) if (value === null) delete next[key]
  return diagnosticsV1Schema.parse(next)
}

// ---------------------------------------------------------------------------
// Hand edit (task 3)
// ---------------------------------------------------------------------------

test("hand edit: every answer group is named, source and quiz time stay, editedAt marks the edit", () => {
  const stored = quizFacts()
  const write = buildMobileHandEditFacts({
    answers: { ...ANSWERS, thickness: "coarse" },
    stored,
    now: NOW,
  })
  const { patch, provenance } = write.diagnostics

  assert.equal(patch.source, undefined, "an existing quiz source (and its raw envelope) is kept")
  assert.equal(patch.thickness, "coarse")
  assert.deepEqual(patch.currentConcerns, ["dry_lengths"])
  assert.deepEqual(patch.goals, ["moisture"])
  assert.equal(patch.volumeDirection, null)
  assert.deepEqual(provenance.source, { kind: "profile_editor" })
  assert.equal(provenance.at, NOW)
  assert.equal(provenance.editedAt, NOW)
  // Only the value the user actually changed claims a new `user` answer.
  assert.deepEqual(provenance.fields, { thickness: "user" })
  assert.equal(write.quizContext, undefined, "a hand edit never touches quiz_context")

  const merged = merge(stored.diagnostics, patch)
  assert.deepEqual(write.columns, deriveDiagnosticsColumns(merged))
  assert.equal(write.columns.thickness, "coarse")
})

test("hand edit: a newer quiz replaces it, an older one does not (plan §3)", () => {
  const stored = quizFacts()
  const write = buildMobileHandEditFacts({
    answers: { ...ANSWERS, thickness: "coarse" },
    stored,
    now: NOW,
  })
  const after = {
    diagnostics: merge(stored.diagnostics, write.diagnostics.patch),
    provenance: { diagnostics: write.diagnostics.provenance },
  }
  assert.equal(quizSupersedesFacts(after, "2026-09-29T00:00:00.000Z"), false)
  assert.equal(quizSupersedesFacts(after, "2026-10-01T00:00:00.000Z"), true)
})

test("hand edit: a saved legacy volume goal keeps its stored direction; the new volume card follows hair type", () => {
  const kept = buildMobileHandEditFacts({
    answers: { ...ANSWERS, goals: ["less_volume"] },
    stored: quizFacts({ goals: ["volume_balance"], volumeDirection: "less" }),
    now: NOW,
  })
  // The stored goal handed back unchanged is no change at all (rule: a no-op is not an edit).
  assert.deepEqual(kept.diagnostics.patch, {})
  assert.deepEqual(
    kept.columns.goals,
    ["less_volume"],
    "fine hair would otherwise resolve to volume",
  )
  assert.equal(kept.columns.desired_volume, "less")

  const fresh = buildMobileHandEditFacts({
    answers: { ...ANSWERS, goals: ["volume_balance"] },
    stored: quizFacts({ goals: ["volume_balance"], volumeDirection: "less" }),
    now: NOW,
  })
  assert.equal(fresh.diagnostics.patch.volumeDirection, null, "the stored direction is cleared")
  assert.deepEqual(fresh.columns.goals, ["volume"])
})

test("hand edit: legacy goals convert through resolveVisibleDiagnosticGoals (migration table M)", () => {
  const write = buildMobileHandEditFacts({
    answers: { ...ANSWERS, goals: ["healthier_hair", "less_frizz", "color_protection"] },
    stored: quizFacts(),
    now: NOW,
  })
  assert.deepEqual(write.diagnostics.patch.goals, ["frizz_surface", "shine", "strength_ends"])
  assert.deepEqual(write.columns.goals, ["less_frizz", "shine", "anti_breakage"])
})

test("hand edit: a stated main problem is set when answered and left alone when not", () => {
  const stored = quizFacts({
    currentConcerns: ["dry_lengths", "frizz_flyaways"],
    primaryConcern: "frizz_flyaways",
  })
  const unstated = buildMobileHandEditFacts({
    answers: { ...ANSWERS, concerns: ["dryness", "frizz"] },
    stored,
    now: NOW,
  })
  assert.equal("primaryConcern" in unstated.diagnostics.patch, false)
  assert.equal(unstated.columns.primary_concern, "frizz")

  const stated = buildMobileHandEditFacts({
    answers: { ...ANSWERS, concerns: ["dryness", "frizz"], primary_concern: "dryness" },
    stored,
    now: NOW,
  })
  assert.equal(stated.diagnostics.patch.primaryConcern, "dry_lengths")
  assert.equal(stated.columns.primary_concern, "dryness")
})

test("hand edit: an unchanged value keeps its provenance marker (an assumed default stays assumed)", () => {
  const stored = quizFacts({}, { density: "assumed", texture: "user" })
  const changed = buildMobileHandEditFacts({
    answers: { ...ANSWERS, density: "high" },
    stored,
    now: NOW,
  })
  assert.deepEqual(changed.diagnostics.provenance.fields, { density: "user" })
})

test("hand edit: an edit that changes no value is not an edit (no editedAt, stored provenance verbatim)", () => {
  const stored = quizFacts({}, { density: "assumed", texture: "user" })
  const write = buildMobileHandEditFacts({ answers: ANSWERS, stored, now: NOW })
  assert.deepEqual(write.diagnostics.patch, {})
  assert.deepEqual(write.diagnostics.provenance, stored.provenance.diagnostics)
  assert.equal(write.diagnostics.provenance.editedAt, undefined)
  assert.deepEqual(write.columns, deriveDiagnosticsColumns(stored.diagnostics!))

  // A previous edit's editedAt survives a later no-op edit (its provenance is re-sent as is).
  const edited = {
    ...stored,
    provenance: {
      diagnostics: { ...stored.provenance.diagnostics!, editedAt: EARLIER },
    },
  }
  const again = buildMobileHandEditFacts({ answers: ANSWERS, stored: edited, now: NOW })
  assert.equal(again.diagnostics.provenance.editedAt, EARLIER)
})

test("completion (registration missing mode): only the missing groups are named", () => {
  const stored = quizFacts({ hairLength: undefined })
  const write = buildMobileHandEditFacts({
    answers: { ...ANSWERS, hair_length: "short" },
    stored,
    now: NOW,
    groups: ["hair_length"],
  })
  assert.deepEqual(write.diagnostics.patch, { hairLength: "short" })
  assert.deepEqual(write.diagnostics.provenance.fields, { hairLength: "user" })
  assert.equal(write.diagnostics.provenance.editedAt, NOW)
  assert.equal(write.columns.hair_length, "short")
  assert.equal(write.columns.thickness, "fine")
})

test("MOBILE_ANSWER_GROUPS covers the ten regular iOS question groups", () => {
  assert.deepEqual(
    [...MOBILE_ANSWER_GROUPS],
    [
      "structure",
      "thickness",
      "density",
      "hair_length",
      "fingertest",
      "pulltest",
      "treatment",
      "scalp_type",
      "concerns",
      "goals",
    ],
  )
})

// ---------------------------------------------------------------------------
// Quiz taken now (task 4: registration create / replace)
// ---------------------------------------------------------------------------

test("registration quiz: the latest own quiz replaces the whole document like the web account link", () => {
  const stored = quizFacts(
    {
      primaryConcern: "dry_lengths",
      concernRecurrence: { concernId: "dry_lengths", frequency: "often" },
    },
    { density: "assumed" },
  )
  const write = buildMobileQuizFacts({
    answers: { ...ANSWERS, thickness: "coarse" },
    leadId: "lead-ios",
    stored,
    now: NOW,
  })
  const { patch, provenance } = write.diagnostics
  assert.deepEqual(patch.source, {
    kind: "legacy_quiz",
    version: 1,
    leadId: "lead-ios",
    raw: buildLegacyQuizStage1Source({
      leadId: "lead-ios",
      answers: { ...ANSWERS, thickness: "coarse" } as never,
    }),
    takenAt: NOW,
    statedOutsideRaw: { primaryConcern: null, currentConcernsOtherText: null },
  })
  assert.equal(patch.thickness, "coarse")
  assert.equal(patch.primaryConcern, null, "fields the new quiz does not carry are cleared")
  assert.equal(patch.concernRecurrence, null)
  assert.equal(patch.volumeDirection, null)
  assert.deepEqual(provenance.source, { kind: "legacy_lead", id: "lead-ios" })
  assert.equal(provenance.at, NOW)
  assert.equal(provenance.editedAt, undefined)
  assert.equal(provenance.fields?.density, "user", "a real answer replaces the assumed marker")
  assert.equal(Object.values(provenance.fields ?? {}).includes("assumed"), false)
  assert.equal(write.quizContext, undefined, "no stored quiz_context, nothing to clear")
  assert.deepEqual(write.columns, deriveDiagnosticsColumns(merge(stored.diagnostics, patch)))
})

test("registration quiz: a stored quiz_context from an earlier artifact is cleared (F4)", () => {
  const stored = {
    ...quizFacts(),
    quizContext: { routineClarity: "clear", blockers: ["time"] } as never,
  }
  const write = buildMobileQuizFacts({ answers: ANSWERS, leadId: "lead-ios", stored, now: NOW })
  assert.ok(write.quizContext)
  assert.ok(Object.values(write.quizContext.patch).every((value) => value === null))
  assert.deepEqual(write.quizContext.provenance.source, { kind: "legacy_lead", id: "lead-ios" })
  assert.deepEqual(toProfileFactsArgument(write), {
    diagnostics: write.diagnostics,
    quiz_context: write.quizContext,
  })
})

test("fix round 1 (D): an already-cleared {} quiz_context counts as absent — nothing to clear", () => {
  const stored = { ...quizFacts(), quizContext: {} as never }
  const write = buildMobileQuizFacts({ answers: ANSWERS, leadId: "lead-ios", stored, now: NOW })
  assert.equal(write.quizContext, undefined)
  assert.deepEqual(toProfileFactsArgument(write), { diagnostics: write.diagnostics })
})

test("registration quiz on an empty profile writes the full document", () => {
  const write = buildMobileQuizFacts({
    answers: ANSWERS,
    leadId: "lead-ios",
    stored: null,
    now: NOW,
  })
  assert.equal(write.diagnostics.patch.texture, "wavy")
  assert.deepEqual(toProfileFactsArgument(write), { diagnostics: write.diagnostics })
  assert.deepEqual(write.columns, {
    hair_texture: "wavy",
    thickness: "fine",
    density: "medium",
    hair_length: "long",
    cuticle_condition: "rough",
    protein_moisture_balance: "stretches_bounces",
    scalp_type: "balanced",
    scalp_condition: null,
    chemical_treatment: ["natural"],
    concerns: ["dryness"],
    goals: ["moisture"],
    desired_volume: null,
    primary_concern: "dryness",
  })
})

// ---------------------------------------------------------------------------
// Adversarial block
// ---------------------------------------------------------------------------

test("adversarial: empty, partial and unknown answers never become a patch", () => {
  const bad: unknown[] = [
    {},
    { ...ANSWERS, hair_length: undefined },
    { ...ANSWERS, structure: "zigzag" },
    { ...ANSWERS, goals: ["volume", "less_volume"] },
    { ...ANSWERS, has_scalp_issue: true },
    { ...ANSWERS, treatment: [] },
    { ...ANSWERS, userId: "someone-else" },
  ]
  for (const answers of bad) {
    assert.throws(
      () => buildMobileHandEditFacts({ answers: answers as never, stored: quizFacts(), now: NOW }),
      (error) => error instanceof MobileProfileFactsError && error.code === "invalid_answers",
      JSON.stringify(answers),
    )
    assert.throws(
      () =>
        buildMobileQuizFacts({ answers: answers as never, leadId: "l", stored: null, now: NOW }),
      (error) => error instanceof MobileProfileFactsError && error.code === "invalid_answers",
    )
  }
})

test("adversarial: an edit on a profile with NULL diagnostics writes a complete, readable document", () => {
  for (const groups of [undefined, ["hair_length"] as const]) {
    const write = buildMobileHandEditFacts({
      answers: ANSWERS,
      stored: { ...NO_FACTS, legacyColumns: { density: "high", hair_length: null } },
      now: NOW,
      groups,
    })
    const { patch } = write.diagnostics
    // A partial new document would derive NULL into every column it lacks.
    assert.equal(patch.texture, "wavy")
    assert.equal(patch.goals?.length, 1)
    assert.deepEqual(patch.source, {
      kind: "legacy_quiz",
      version: 1,
      leadId: "profile",
      raw: buildLegacyQuizStage1Source({ leadId: "profile", answers: ANSWERS as never }),
      statedOutsideRaw: { primaryConcern: null, currentConcernsOtherText: null },
    })
    assert.ok(diagnosticsV1Schema.safeParse(merge(null, patch)).success)
    assert.equal(write.diagnostics.provenance.fields?.texture, "user")
    assert.equal(write.columns.hair_texture, "wavy")
  }
})

test("adversarial: an edit on a backfilled legacy_columns profile gains a quiz envelope and keeps unchanged markers", () => {
  const stored = quizFacts(
    {
      source: { kind: "legacy_columns", version: 1, raw: { hair_texture: "wavy" } },
    },
    { texture: "unknown_historical", thickness: "unknown_historical" },
  )
  const write = buildMobileHandEditFacts({
    answers: { ...ANSWERS, thickness: "normal" },
    stored,
    now: NOW,
  })
  assert.equal(write.diagnostics.patch.source?.kind, "legacy_quiz")
  assert.deepEqual(write.diagnostics.provenance.fields, { thickness: "user" })
  const after = {
    diagnostics: merge(stored.diagnostics, write.diagnostics.patch),
    provenance: { diagnostics: write.diagnostics.provenance },
  }
  // The hand edit still wins against an older quiz linked later.
  assert.equal(quizSupersedesFacts(after, EARLIER), false)
})

test("adversarial: a concern recurrence that no longer names a current concern is cleared", () => {
  const stored = quizFacts({
    currentConcerns: ["dry_lengths"],
    concernRecurrence: { concernId: "dry_lengths", frequency: "often" },
  })
  const dropped = buildMobileHandEditFacts({
    answers: { ...ANSWERS, concerns: ["frizz"] },
    stored,
    now: NOW,
  })
  assert.equal(dropped.diagnostics.patch.concernRecurrence, null)
  const keptRecurrence = buildMobileHandEditFacts({ answers: ANSWERS, stored, now: NOW })
  assert.equal("concernRecurrence" in keptRecurrence.diagnostics.patch, false)
  const completion = buildMobileHandEditFacts({
    answers: { ...ANSWERS, concerns: ["frizz"] },
    stored,
    now: NOW,
    groups: ["hair_length"],
  })
  assert.equal("concernRecurrence" in completion.diagnostics.patch, false, "concerns untouched")
})

test("adversarial: a quiz taken now that is somehow not newer is refused, never silently dropped", () => {
  const future = quizFacts({
    source: {
      kind: "legacy_quiz",
      version: 1,
      leadId: "lead-web",
      raw: {},
      takenAt: "2027-01-01T00:00:00.000Z",
    },
  })
  assert.throws(
    () => buildMobileQuizFacts({ answers: ANSWERS, leadId: "lead-ios", stored: future, now: NOW }),
    (error) => error instanceof MobileProfileFactsError && error.code === "not_newer",
  )
  assert.throws(
    () =>
      buildMobileHandEditFacts({
        answers: ANSWERS,
        stored: future,
        now: NOW,
        groups: ["hair_length"],
        completion: true,
      }),
    (error) => error instanceof MobileProfileFactsError && error.code === "not_newer",
  )
  // A hand edit is by definition the newest word — no quiz-time check.
  assert.ok(buildMobileHandEditFacts({ answers: ANSWERS, stored: future, now: NOW }))
})

test("adversarial: the builders are deterministic for the same input (replay-safe hashes live elsewhere)", () => {
  const a = buildMobileHandEditFacts({ answers: ANSWERS, stored: quizFacts(), now: NOW })
  const b = buildMobileHandEditFacts({ answers: ANSWERS, stored: quizFacts(), now: NOW })
  assert.deepEqual(a, b)
})
