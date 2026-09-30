import assert from "node:assert/strict"
import test from "node:test"

import {
  buildProfileAnswersFacts,
  profileAnswersSchema,
  type ProfileAnswers,
} from "../src/lib/hair-profile/profile-answers"
import { quizSupersedesFacts } from "../src/lib/user-facts/account-link"
import { deriveDiagnosticsColumns } from "../src/lib/user-facts/derive-legacy-columns"
import { diagnosticsV1Schema, type DiagnosticsV1 } from "../src/lib/user-facts/schema"
import type { UserFacts } from "../src/lib/user-facts/read"

/**
 * Clean-switch task 5: `POST /api/profile/answers` takes the quiz's own vocabulary and the web
 * editors' edits are hand edits through `user_facts_save_v1` — the same rules as the iOS edit.
 * Test-first; the adversarial block at the bottom feeds inputs designed to break it.
 */

const NOW = "2026-09-30T12:00:00.000Z"
const EARLIER = "2026-09-01T08:00:00.000Z"

type Stored = Pick<UserFacts, "diagnostics" | "provenance" | "quizContext" | "legacyColumns">

function quizDoc(overrides: Partial<DiagnosticsV1> = {}): DiagnosticsV1 {
  return diagnosticsV1Schema.parse({
    texture: "wavy",
    thickness: "fine",
    density: "medium",
    hairLength: "long",
    hairSurface: "rough",
    elasticResponse: "stretches_bounces",
    chemicalTreatments: ["natural"],
    scalpOiliness: "balanced",
    scalpConcerns: [],
    goals: ["moisture", "shine"],
    currentConcerns: ["dry_lengths"],
    source: {
      kind: "personal_plan_v3",
      version: 3,
      leadId: "lead-web",
      raw: { kind: "personal_plan_v3", version: 3, answers: {} },
      takenAt: EARLIER,
    },
    ...overrides,
  })
}

function stored(diagnostics: DiagnosticsV1 | null, fields = {}): Stored {
  return {
    diagnostics,
    provenance: diagnostics
      ? {
          diagnostics: {
            source: { kind: "personal_plan_artifact", id: "artifact-1" },
            schemaVersion: 1,
            at: EARLIER,
            fields,
          },
        }
      : {},
    quizContext: null,
    legacyColumns: { density: null, hair_length: null },
  }
}

function merge(old: DiagnosticsV1 | null, patch: Record<string, unknown>): DiagnosticsV1 {
  const next: Record<string, unknown> = { ...(old ?? {}), ...patch }
  for (const [key, value] of Object.entries(patch)) if (value === null) delete next[key]
  return diagnosticsV1Schema.parse(next)
}

function parse(body: unknown): ProfileAnswers {
  const result = profileAnswersSchema.safeParse(body)
  assert.equal(result.success, true, JSON.stringify(result.error?.issues))
  return result.data as ProfileAnswers
}

function rejects(body: unknown, label: string) {
  assert.equal(profileAnswersSchema.safeParse(body).success, false, label)
}

const LEGACY_ROW = {
  hair_texture: "curly",
  thickness: "coarse",
  density: "high",
  hair_length: "medium",
  cuticle_condition: "slightly_rough",
  protein_moisture_balance: "snaps",
  scalp_type: "oily",
  scalp_condition: null,
  chemical_treatment: ["colored"],
  concerns: ["frizz", "dandruff"],
  goals: ["less_volume", "healthier_hair"],
  desired_volume: "less",
  primary_concern: null,
}

// ---------------------------------------------------------------------------
// Route vocabulary
// ---------------------------------------------------------------------------

test("schema: accepts the quiz's own vocabulary, one group at a time", () => {
  parse({ goals: ["moisture", "volume_balance", "manageability_styling"] })
  parse({
    texture: "wavy",
    thickness: "normal",
    density: "low",
    hairLength: "very_long",
    hairSurface: "slightly_uneven",
    elasticResponse: "snaps",
    chemicalTreatments: ["colored", "lightened"],
    scalpOiliness: "oily",
    scalpConcerns: ["oily_dandruff", "irritated"],
  })
  parse({ scalpConcerns: [] })
  parse({
    currentConcerns: ["low_shine", "lost_shape"],
    primaryConcern: "lost_shape",
    currentConcernsOtherText: null,
  })
  parse({ currentConcerns: [], currentConcernsOtherText: "stumpf nach dem Föhnen" })
})

test("schema: no maximum on goals or problems", () => {
  parse({
    goals: [
      "moisture",
      "frizz_surface",
      "shine",
      "strength_ends",
      "scalp_balance",
      "manageability_styling",
      "shape_definition",
      "volume_balance",
    ],
  })
  parse({
    currentConcerns: [
      "dry_lengths",
      "frizz_flyaways",
      "low_shine",
      "hair_damage",
      "hair_loss_or_thinning",
      "breakage",
      "split_ends",
      "tangling",
      "lost_shape",
      "low_volume_or_weighed_down",
    ],
    primaryConcern: "breakage",
  })
})

// ---------------------------------------------------------------------------
// Hand-edit semantics
// ---------------------------------------------------------------------------

test("edit: only the named fields are written; only changed values are re-marked user; editedAt marks it", () => {
  const facts = stored(quizDoc(), { density: "assumed" })
  const write = buildProfileAnswersFacts({
    answers: parse({ thickness: "coarse", density: "medium", texture: "wavy" }),
    stored: facts,
    row: {},
    now: NOW,
  })
  const { patch, provenance } = write.diagnostics
  assert.deepEqual(Object.keys(patch).sort(), ["density", "texture", "thickness"])
  assert.equal(patch.source, undefined, "an existing quiz source is kept")
  assert.deepEqual(provenance.source, { kind: "profile_editor" })
  assert.equal(provenance.editedAt, NOW)
  assert.deepEqual(provenance.fields, { thickness: "user" }, "unchanged values keep their marker")
  assert.deepEqual(write.columns, deriveDiagnosticsColumns(merge(facts.diagnostics, patch)))
  assert.equal(write.quizContext, undefined)
})

test("edit: kept against an older quiz linked later, replaced by a quiz taken later", () => {
  const facts = stored(quizDoc())
  const write = buildProfileAnswersFacts({
    answers: parse({ goals: ["shine"] }),
    stored: facts,
    row: {},
    now: NOW,
  })
  const after = {
    diagnostics: merge(facts.diagnostics, write.diagnostics.patch),
    provenance: { diagnostics: write.diagnostics.provenance },
  }
  assert.equal(quizSupersedesFacts(after, "2026-09-29T00:00:00.000Z"), false)
  assert.equal(quizSupersedesFacts(after, "2026-10-01T00:00:00.000Z"), true)
})

test("edit adds no completeness default", () => {
  const facts = stored(quizDoc({ density: undefined, hairLength: undefined }))
  const write = buildProfileAnswersFacts({
    answers: parse({ texture: "curly" }),
    stored: facts,
    row: {},
    now: NOW,
  })
  assert.equal("density" in write.diagnostics.patch, false)
  assert.equal("hairLength" in write.diagnostics.patch, false)
  assert.equal(write.columns.density, null)
  assert.equal(write.columns.hair_length, null)
})

test("goals: the stored volume direction is kept while the volume goal stays; changing it follows hair type", () => {
  const facts = stored(quizDoc({ goals: ["volume_balance", "shine"], volumeDirection: "less" }))
  const kept = buildProfileAnswersFacts({
    answers: parse({ goals: ["volume_balance", "moisture"] }),
    stored: facts,
    row: {},
    now: NOW,
  })
  assert.equal("volumeDirection" in kept.diagnostics.patch, false)
  assert.deepEqual(kept.columns.goals.includes("less_volume"), true)
  assert.equal(kept.columns.desired_volume, "less")

  const removed = buildProfileAnswersFacts({
    answers: parse({ goals: ["moisture"] }),
    stored: facts,
    row: {},
    now: NOW,
  })
  assert.equal(removed.diagnostics.patch.volumeDirection, null)

  const added = buildProfileAnswersFacts({
    answers: parse({ goals: ["moisture", "volume_balance"] }),
    stored: stored(quizDoc({ goals: ["moisture"] })),
    row: {},
    now: NOW,
  })
  assert.equal("volumeDirection" in added.diagnostics.patch, false)
  // Fine + medium wavy: the hair-type resolver decides.
  assert.equal(added.columns.desired_volume, "more")
})

test("problems: main problem stored only with two or more; one problem is her main problem; note trimmed", () => {
  const facts = stored(
    quizDoc({ currentConcerns: ["dry_lengths", "breakage"], primaryConcern: "breakage" }),
  )
  const two = buildProfileAnswersFacts({
    answers: parse({
      currentConcerns: ["low_shine", "tangling"],
      primaryConcern: "tangling",
      currentConcernsOtherText: "  stumpf nach dem Föhnen  ",
    }),
    stored: facts,
    row: {},
    now: NOW,
  })
  assert.equal(two.diagnostics.patch.primaryConcern, "tangling")
  assert.equal(two.diagnostics.patch.currentConcernsOtherText, "stumpf nach dem Föhnen")
  assert.equal(two.columns.primary_concern, "tangling")

  const one = buildProfileAnswersFacts({
    answers: parse({ currentConcerns: ["breakage"], primaryConcern: null }),
    stored: facts,
    row: {},
    now: NOW,
  })
  assert.equal(one.diagnostics.patch.primaryConcern, null)
  assert.equal(one.diagnostics.patch.currentConcernsOtherText, null)
  assert.equal(one.columns.primary_concern, "breakage")
})

test("problems: a recurrence for a deselected problem is cleared", () => {
  const facts = stored(
    quizDoc({
      currentConcerns: ["dry_lengths", "breakage"],
      concernRecurrence: { concernId: "breakage", frequency: "often" } as never,
    }),
  )
  const write = buildProfileAnswersFacts({
    answers: parse({ currentConcerns: ["dry_lengths"] }),
    stored: facts,
    row: {},
    now: NOW,
  })
  assert.equal(write.diagnostics.patch.concernRecurrence, null)
})

test("no profile row: the profile is created with exactly what was entered", () => {
  const write = buildProfileAnswersFacts({
    answers: parse({ goals: ["shine", "moisture"] }),
    stored: null,
    row: null,
    now: NOW,
  })
  const { patch } = write.diagnostics
  assert.deepEqual(patch.goals, ["shine", "moisture"])
  assert.equal(patch.source?.kind, "legacy_quiz")
  assert.equal(patch.source && "leadId" in patch.source ? patch.source.leadId : null, "profile")
  assert.deepEqual(write.diagnostics.provenance.fields, { goals: "user" })
  assert.equal(write.columns.hair_texture, null)
  assert.deepEqual(write.columns.goals, ["shine", "moisture"])
})

// ---------------------------------------------------------------------------
// Adversarial
// ---------------------------------------------------------------------------

test("adversarial: legacy-vocabulary payloads are rejected", () => {
  rejects({ goals: ["volume"] }, "legacy goal")
  rejects({ goals: ["less_volume", "healthier_hair"] }, "legacy goals")
  rejects({ currentConcerns: ["dryness"] }, "legacy concern")
  rejects({ hair_texture: "wavy" }, "legacy column key")
  rejects({ concerns: ["frizz"] }, "legacy concerns key")
  rejects({ hairSurface: "slightly_rough" }, "legacy cuticle value")
  rejects({ chemicalTreatments: ["bleached"] }, "legacy chemical value")
  rejects({ scalpConcerns: ["dandruff"] }, "legacy scalp condition")
  rejects({ scalpOiliness: "not-a-scalp" }, "unknown value")
  rejects({ user_id: "11111111-1111-4111-8111-111111111111", goals: ["shine"] }, "protected key")
  rejects({ volumeDirection: "less" }, "internal field")
  rejects({ source: {} }, "source")
})

test("adversarial: empty, duplicate and contradictory answers are rejected", () => {
  rejects({}, "empty body")
  rejects({ goals: [] }, "empty goals")
  rejects({ goals: ["shine", "shine"] }, "duplicate goal")
  rejects({ chemicalTreatments: ["natural", "colored"] }, "natural with a treatment")
  rejects({ chemicalTreatments: [] }, "no treatment answer")
  rejects({ currentConcerns: [] }, "no problem and no note")
  rejects({ currentConcerns: [], currentConcernsOtherText: "   " }, "blank note")
  rejects(
    { currentConcerns: [], currentConcernsOtherText: "x".repeat(51) },
    "note longer than 50 characters",
  )
  rejects(
    { currentConcerns: ["dry_lengths", "breakage"], primaryConcern: "tangling" },
    "main problem not among the selected",
  )
  rejects({ currentConcerns: ["dry_lengths"], primaryConcern: "tangling" }, "stale main problem")
  rejects({ currentConcerns: ["dry_lengths", "breakage"] }, "two problems without a main problem")
  rejects({ primaryConcern: "breakage" }, "main problem without the problems")
  rejects({ currentConcernsOtherText: "Spliss" }, "note without the problems")
})

test("adversarial: edit on a profile with NULL diagnostics keeps every column it did not name", () => {
  const write = buildProfileAnswersFacts({
    answers: parse({ texture: "wavy" }),
    stored: stored(null),
    row: LEGACY_ROW,
    now: NOW,
  })
  const { patch, provenance } = write.diagnostics
  assert.equal(patch.source?.kind, "legacy_quiz")
  assert.equal(write.columns.hair_texture, "wavy")
  assert.equal(write.columns.thickness, "coarse")
  assert.equal(write.columns.cuticle_condition, "slightly_rough")
  assert.deepEqual(write.columns.goals.sort(), ["anti_breakage", "less_volume"].sort())
  assert.equal(write.columns.desired_volume, "less")
  assert.equal(write.columns.scalp_condition, "dandruff")
  assert.deepEqual(write.columns.concerns, ["frizz"])
  assert.deepEqual(provenance.fields, { texture: "user" }, "only the edited value is claimed")
})

test("adversarial: edit on a backfilled legacy_columns profile gets a quiz source and keeps the rest", () => {
  const doc = diagnosticsV1Schema.parse({
    texture: "straight",
    thickness: "fine",
    goals: ["shine"],
    source: { kind: "legacy_columns", version: 1, raw: { hair_texture: "straight" } },
  })
  const write = buildProfileAnswersFacts({
    answers: parse({ goals: ["shine", "scalp_balance"] }),
    stored: stored(doc),
    row: {},
    now: NOW,
  })
  const { patch, provenance } = write.diagnostics
  assert.equal(patch.source?.kind, "legacy_quiz")
  assert.equal("texture" in patch, false, "untouched fields are not re-written")
  assert.deepEqual(provenance.fields, { goals: "user" })
  const merged = merge(doc, patch)
  assert.equal(merged.texture, "straight")
  assert.deepEqual(write.columns, deriveDiagnosticsColumns(merged))
})

test("adversarial: an edit that changes nothing is not an edit (no editedAt, no markers, stored provenance kept)", () => {
  const facts = stored(quizDoc(), { density: "assumed" })
  const write = buildProfileAnswersFacts({
    answers: parse({
      goals: ["shine", "moisture"],
      currentConcerns: ["dry_lengths"],
      primaryConcern: null,
      currentConcernsOtherText: null,
    }),
    stored: facts,
    row: {},
    now: NOW,
  })
  assert.deepEqual(write.diagnostics.patch, {}, "reordering is not a change")
  assert.deepEqual(write.diagnostics.provenance, facts.provenance.diagnostics)
  assert.equal(write.diagnostics.provenance.editedAt, undefined)
  assert.deepEqual(
    write.columns,
    deriveDiagnosticsColumns(facts.diagnostics!),
    "the derived columns do not move",
  )
})

test("adversarial: a no-op edit on a legacy_columns document does not re-source it", () => {
  const doc = diagnosticsV1Schema.parse({
    texture: "straight",
    goals: ["shine"],
    source: { kind: "legacy_columns", version: 1, raw: {} },
  })
  const write = buildProfileAnswersFacts({
    answers: parse({ goals: ["shine"], texture: "straight" }),
    stored: stored(doc),
    row: {},
    now: NOW,
  })
  assert.deepEqual(write.diagnostics.patch, {})
  assert.equal(write.diagnostics.provenance.editedAt, undefined)
})

test("adversarial: a complete new document carries an emittable legacy source; an incomplete one none", () => {
  const complete = buildProfileAnswersFacts({
    answers: parse({ goals: ["shine"] }),
    stored: stored(null),
    row: LEGACY_ROW,
    now: NOW,
  })
  const source = complete.diagnostics.patch.source as { raw: { kind: string; answers: object } }
  assert.equal(source.raw.kind, "legacy_quiz")
  assert.deepEqual((source.raw.answers as { goals: string[] }).goals, ["shine"])

  const partial = buildProfileAnswersFacts({
    answers: parse({ goals: ["shine"] }),
    stored: null,
    row: null,
    now: NOW,
  })
  assert.equal((partial.diagnostics.patch.source as { raw: unknown }).raw, null)
})
