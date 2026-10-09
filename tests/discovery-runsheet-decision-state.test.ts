import assert from "node:assert/strict"
import test from "node:test"

import {
  RUNSHEET_DECISION_STATE_LABELS,
  runsheetDecisionState,
} from "../src/lib/discovery/runsheet/decision-state"

/**
 * One status per step entry (cockpit call-ready A1, Nick 2026-10-09): Entschieden · Vorschlag ·
 * Offen · Bewusst ohne Produkt — the same derivation for the step card, „Für den Plan
 * festgehalten" and the week view.
 */

test("a click decides: keep, swap or drop of her product is Entschieden", () => {
  for (const decision of ["keep", "swap", "drop"] as const) {
    assert.equal(
      runsheetDecisionState({ intakeItemId: "item", decision, hasProposal: true }),
      "entschieden",
      decision,
    )
  }
  assert.equal(
    runsheetDecisionState({ intakeItemId: null, decision: "swap", hasProposal: true }),
    "entschieden",
  )
})

test("an empty step kept (or dropped) without a product is Bewusst ohne Produkt — never offen", () => {
  for (const decision of ["keep", "drop"] as const) {
    assert.equal(
      runsheetDecisionState({ intakeItemId: null, decision, hasProposal: true }),
      "bewusst_ohne",
    )
  }
})

test("undecided: her own product is Offen; an empty step with an engine pick is Vorschlag", () => {
  assert.equal(
    runsheetDecisionState({ intakeItemId: "item", decision: null, hasProposal: true }),
    "offen",
  )
  assert.equal(
    runsheetDecisionState({ intakeItemId: null, decision: null, hasProposal: true }),
    "vorschlag",
  )
  assert.equal(
    runsheetDecisionState({ intakeItemId: null, decision: null, hasProposal: false }),
    "offen",
  )
})

test("the German labels", () => {
  assert.deepEqual(RUNSHEET_DECISION_STATE_LABELS, {
    entschieden: "Entschieden",
    vorschlag: "Vorschlag",
    offen: "Offen",
    bewusst_ohne: "Bewusst ohne Produkt",
  })
})
