import assert from "node:assert/strict"
import test from "node:test"

import { profileAnswersSchema } from "../src/lib/hair-profile/profile-answers"
import {
  buildHaarCheckPayload,
  createHaarCheckDraft,
  haarCheckSaveBlock,
  pickMainProblem,
  selectNoScalpConcern,
  setProblemNote,
  showsMainProblemQuestion,
  toggleChemicalTreatment,
  toggleProblem,
  toggleProblemNote,
  toggleScalpConcern,
  type HaarCheckDraft,
} from "../src/lib/profile/haar-check-draft"
import { canSaveGoals, initialGoalSelection, toggleGoal } from "../src/lib/profile/goals-draft"
import { readProfileDiagnostics } from "../src/lib/user-facts/profile-diagnostics"
import { diagnosticsV1Schema, type DiagnosticsV1 } from "../src/lib/user-facts/schema"

/**
 * Clean-switch task 8: the two web editors' deterministic rules — preselection/conversion, the
 * quiz's toggle rules, main-problem reconciliation, the save-enable rule and the payload (only
 * the changed answer groups, in the route's vocabulary). Test-first.
 */

function doc(overrides: Partial<DiagnosticsV1> = {}): DiagnosticsV1 {
  return diagnosticsV1Schema.parse({
    texture: "wavy",
    thickness: "fine",
    density: "medium",
    hairLength: "long",
    hairSurface: "rough",
    elasticResponse: "snaps",
    chemicalTreatments: ["colored"],
    scalpOiliness: "oily",
    scalpConcerns: ["oily_dandruff"],
    goals: ["shine", "moisture"],
    currentConcerns: ["dry_lengths", "breakage"],
    primaryConcern: "breakage",
    source: { kind: "legacy_quiz", version: 1, leadId: "lead", raw: null },
    ...overrides,
  })
}

// ---------------------------------------------------------------------------
// Ziele editor
// ---------------------------------------------------------------------------

test("goals: preselection is the stored goals in the quiz's order", () => {
  assert.deepEqual(initialGoalSelection({ diagnostics: doc() }), ["moisture", "shine"])
})

test("goals: legacy goals convert only through resolveVisibleDiagnosticGoals (row not backfilled)", () => {
  const row = {
    diagnostics: null,
    hair_texture: "straight",
    goals: ["healthier_hair", "color_protection", "less_frizz", "volume", "anti_breakage"],
    desired_volume: "more",
  }
  assert.deepEqual(initialGoalSelection(row), [
    "frizz_surface",
    "shine",
    "strength_ends",
    "volume_balance",
  ])
  assert.deepEqual(initialGoalSelection(null), [])
  assert.deepEqual(initialGoalSelection({ diagnostics: null }), [])
})

test("goals: toggling keeps the quiz order, has no maximum, needs at least one to save", () => {
  let selected = initialGoalSelection({ diagnostics: doc() })
  for (const goal of [
    "volume_balance",
    "frizz_surface",
    "strength_ends",
    "scalp_balance",
    "manageability_styling",
    "shape_definition",
  ] as const) {
    selected = toggleGoal(selected, goal, "wavy")
  }
  assert.equal(selected.length, 8)
  assert.deepEqual(selected, [
    "moisture",
    "frizz_surface",
    "shine",
    "strength_ends",
    "scalp_balance",
    "manageability_styling",
    "shape_definition",
    "volume_balance",
  ])
  assert.equal(canSaveGoals(selected), true)
  assert.equal(canSaveGoals([]), false)
  assert.deepEqual(toggleGoal(["shine"], "shine", "wavy"), [])
})

// ---------------------------------------------------------------------------
// Haar-Check editor
// ---------------------------------------------------------------------------

test("haar-check: the draft is the stored answers in the quiz vocabulary; an unchanged draft sends nothing", () => {
  const initial = createHaarCheckDraft(doc({ currentConcernsOtherText: "stumpf" }))
  assert.equal(initial.hairSurface, "rough")
  assert.deepEqual(initial.scalpConcerns, ["oily_dandruff"])
  assert.equal(initial.noteOpen, true)
  assert.equal(initial.note, "stumpf")
  assert.equal(buildHaarCheckPayload(initial, initial), null)
  assert.equal(haarCheckSaveBlock(initial, initial), null)
})

test("haar-check: legacy columns preselect through table M (row not backfilled)", () => {
  const draft = createHaarCheckDraft(
    readProfileDiagnostics({
      diagnostics: null,
      hair_texture: "curly",
      cuticle_condition: "slightly_rough",
      scalp_type: "balanced",
      scalp_condition: "dry_flakes",
      chemical_treatment: ["bleached"],
      concerns: ["dryness", "dandruff", "thinning"],
    }),
  )
  assert.equal(draft.texture, "curly")
  assert.equal(draft.hairSurface, "slightly_uneven")
  assert.deepEqual(draft.chemicalTreatments, ["lightened"])
  assert.deepEqual(draft.scalpConcerns, ["dry_dandruff", "oily_dandruff"])
  assert.deepEqual(draft.currentConcerns, ["dry_lengths", "hair_loss_or_thinning"])

  const empty = createHaarCheckDraft(readProfileDiagnostics(null))
  assert.equal(empty.texture, undefined)
  assert.deepEqual(empty.currentConcerns, [])
  assert.equal(empty.scalpConcerns, undefined)
})

test("haar-check: only changed groups are sent, and the payload passes the route schema", () => {
  const initial = createHaarCheckDraft(doc())
  let draft: HaarCheckDraft = { ...initial, thickness: "coarse", hairSurface: "rough" }
  draft = toggleChemicalTreatment(draft, "lightened")
  const payload = buildHaarCheckPayload(draft, initial)
  assert.deepEqual(payload, { thickness: "coarse", chemicalTreatments: ["colored", "lightened"] })
  assert.equal(profileAnswersSchema.safeParse(payload).success, true)
})

test("haar-check: Naturhaar excludes every treatment, as in the quiz", () => {
  const initial = createHaarCheckDraft(doc())
  const natural = toggleChemicalTreatment(initial, "natural")
  assert.deepEqual(natural.chemicalTreatments, ["natural"])
  assert.deepEqual(toggleChemicalTreatment(natural, "permed").chemicalTreatments, ["permed"])
  const none = toggleChemicalTreatment(initial, "colored")
  assert.deepEqual(none.chemicalTreatments, [])
  assert.equal(haarCheckSaveBlock(none, initial), "chemical_treatments")
})

test("haar-check: scalp complaints are multi-select with Nichts davon as the empty answer", () => {
  const initial = createHaarCheckDraft(doc())
  const more = toggleScalpConcern(initial, "irritated")
  assert.deepEqual(more.scalpConcerns, ["oily_dandruff", "irritated"])
  const none = selectNoScalpConcern(more)
  assert.deepEqual(none.scalpConcerns, [])
  assert.deepEqual(buildHaarCheckPayload(none, initial), { scalpConcerns: [] })

  // Never answered + untouched is not turned into „Nichts davon".
  const unanswered = createHaarCheckDraft(doc({ scalpConcerns: undefined }))
  assert.equal(buildHaarCheckPayload(unanswered, unanswered), null)
})

test("haar-check: main problem is asked with two or more problems, only among them; a deselected pick is dropped", () => {
  const initial = createHaarCheckDraft(doc())
  assert.equal(showsMainProblemQuestion(initial), true)

  const dropped = toggleProblem(initial, "breakage")
  assert.equal(dropped.primaryConcern, undefined, "the pick went with its problem")
  assert.equal(showsMainProblemQuestion(dropped), false, "one problem is her main problem")
  assert.equal(haarCheckSaveBlock(dropped, initial), null)
  assert.deepEqual(buildHaarCheckPayload(dropped, initial), {
    currentConcerns: ["dry_lengths"],
    currentConcernsOtherText: null,
    primaryConcern: null,
  })

  const three = toggleProblem(toggleProblem(dropped, "tangling"), "low_shine")
  assert.equal(haarCheckSaveBlock(three, initial), "main_problem")
  assert.equal(pickMainProblem(three, "split_ends").primaryConcern, undefined, "not selected")
  const picked = pickMainProblem(three, "tangling")
  assert.equal(haarCheckSaveBlock(picked, initial), null)
  const payload = buildHaarCheckPayload(picked, initial)
  assert.deepEqual(payload, {
    currentConcerns: ["dry_lengths", "tangling", "low_shine"],
    currentConcernsOtherText: null,
    primaryConcern: "tangling",
  })
  assert.equal(profileAnswersSchema.safeParse(payload).success, true)
})

test("haar-check: saving needs a problem or a typed note; the note is capped at 50 and dropped when closed", () => {
  const initial = createHaarCheckDraft(doc({ currentConcerns: [], primaryConcern: undefined }))
  assert.equal(haarCheckSaveBlock(initial, initial), "problems", "an empty stored list blocks save")

  const opened = toggleProblemNote(initial)
  assert.equal(haarCheckSaveBlock(opened, initial), "problems", "an empty note is not a note")
  const typed = setProblemNote(opened, "x".repeat(80))
  assert.equal(typed.note.length, 50)
  assert.equal(haarCheckSaveBlock(typed, initial), null)
  const payload = buildHaarCheckPayload(
    setProblemNote(opened, "  stumpf nach dem Föhnen "),
    initial,
  )
  assert.deepEqual(payload, {
    currentConcerns: [],
    currentConcernsOtherText: "stumpf nach dem Föhnen",
    primaryConcern: null,
  })
  assert.equal(profileAnswersSchema.safeParse(payload).success, true)

  const closed = toggleProblemNote(typed)
  assert.equal(closed.note, "")
  assert.equal(haarCheckSaveBlock(closed, initial), "problems")
})

test("haar-check: removing a stored note sends the group with the note cleared", () => {
  const initial = createHaarCheckDraft(doc({ currentConcernsOtherText: "stumpf" }))
  const payload = buildHaarCheckPayload(toggleProblemNote(initial), initial)
  assert.deepEqual(payload, {
    currentConcerns: ["dry_lengths", "breakage"],
    currentConcernsOtherText: null,
    primaryConcern: "breakage",
  })
})

test("haar-check adversarial: a stored stale main problem is not preselected and must be asked again", () => {
  const initial = createHaarCheckDraft(
    doc({ currentConcerns: ["dry_lengths", "tangling"], primaryConcern: "breakage" }),
  )
  assert.equal(initial.primaryConcern, undefined)
  assert.equal(haarCheckSaveBlock(initial, initial), "main_problem")
})
