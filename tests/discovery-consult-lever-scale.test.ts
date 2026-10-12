import assert from "node:assert/strict"
import test from "node:test"

import {
  CONSULT_LEVER_KINDS,
  CONSULT_LEVER_SPECS,
  consultLeverLevel,
  consultLeverSituation,
  consultScoreRange,
  levelFromLegacyPoints,
  type ConsultLeverSituation,
} from "../src/lib/discovery/consult-brief/lever-scale"

/**
 * The point system v2 (plans/consult-brief-d, Nick 2026-10-12: dots + total range): a fixed
 * level per lever kind, three explicit modifiers, and one total range bounded by the room
 * above her baseline. Pure and deterministic — the model only picks kind and gap.
 */

const PLAIN: ConsultLeverSituation = { vulnerable: false, fineHair: false }
const NOMI: ConsultLeverSituation = { vulnerable: true, fineHair: true }

test("every kind has a spec, and only scored kinds carry a base level", () => {
  for (const kind of CONSULT_LEVER_KINDS) assert.ok(CONSULT_LEVER_SPECS[kind], kind)
  assert.equal(CONSULT_LEVER_SPECS.kopfhaut.base, null)
  assert.equal(CONSULT_LEVER_SPECS.nachtschutz.base, null)
  assert.equal(CONSULT_LEVER_SPECS.sonstiges.base, null)
  assert.equal(CONSULT_LEVER_SPECS.hitze_tools.base, 3)
  assert.equal(CONSULT_LEVER_SPECS.spuelung_neu.base, 3)
  assert.equal(CONSULT_LEVER_SPECS.bondbuilder.base, 1)
  assert.equal(CONSULT_LEVER_SPECS.bondbuilder.thinEvidence, true)
})

test("the situation reads bleached or breaking as vulnerable, and fine hair", () => {
  assert.deepEqual(consultLeverSituation(["bleached"]), { vulnerable: true, fineHair: false })
  assert.deepEqual(consultLeverSituation(["breakage_signal", "fine_hair"]), {
    vulnerable: true,
    fineHair: true,
  })
  assert.deepEqual(consultLeverSituation(["colored", "hot_tool"]), PLAIN)
})

test("a large gap keeps the base level", () => {
  assert.equal(consultLeverLevel("hitze_tools", "gross", PLAIN), 3)
  assert.equal(consultLeverLevel("gewicht_tausch", "gross", PLAIN), 2)
  assert.equal(consultLeverLevel("maske", "gross", PLAIN), 1)
})

test("a small or unknown gap is one level lower, never below one", () => {
  assert.equal(consultLeverLevel("hitze_tools", "klein", PLAIN), 2)
  assert.equal(consultLeverLevel("entwirren", "offen", PLAIN), 1)
  assert.equal(consultLeverLevel("maske", "klein", PLAIN), 1)
})

test("bleached or breaking hair lifts only the breakage levers, capped at three", () => {
  assert.equal(consultLeverLevel("entwirren", "gross", NOMI), 3)
  assert.equal(consultLeverLevel("hitzeschutz", "klein", NOMI), 2)
  assert.equal(consultLeverLevel("hitze_tools", "gross", NOMI), 3)
  assert.equal(consultLeverLevel("foehnen", "gross", NOMI), 1)
  assert.equal(consultLeverLevel("bondbuilder", "gross", NOMI), 1)
  assert.equal(consultLeverLevel("gewicht_tausch", "gross", NOMI), 2)
})

test("fine hair lowers leave-in and oil, never below one", () => {
  assert.equal(consultLeverLevel("leave_in", "gross", { vulnerable: false, fineHair: true }), 1)
  assert.equal(consultLeverLevel("oel", "gross", { vulnerable: false, fineHair: true }), 1)
  assert.equal(consultLeverLevel("leave_in", "gross", PLAIN), 2)
})

test("unscored kinds have no level", () => {
  assert.equal(consultLeverLevel("kopfhaut", "gross", NOMI), null)
  assert.equal(consultLeverLevel("nachtschutz", "gross", PLAIN), null)
  assert.equal(consultLeverLevel("sonstiges", "gross", PLAIN), null)
})

test("Nomi's plan: 7,5 → 8 bis 9", () => {
  const levers = [
    { kind: "hitze_tools", level: consultLeverLevel("hitze_tools", "gross", NOMI) },
    { kind: "entwirren", level: consultLeverLevel("entwirren", "offen", NOMI) },
    { kind: "gewicht_tausch", level: consultLeverLevel("gewicht_tausch", "gross", NOMI) },
    { kind: "bondbuilder", level: consultLeverLevel("bondbuilder", "gross", NOMI) },
    { kind: "kopfhaut", level: consultLeverLevel("kopfhaut", "gross", NOMI) },
  ] as const
  assert.deepEqual(
    levers.map((lever) => lever.level),
    [3, 2, 2, 1, null],
  )
  assert.deepEqual(consultScoreRange(7.5, levers), { low: 8, high: 9 })
})

test("the range grows with the levers when there is room above the baseline", () => {
  assert.deepEqual(consultScoreRange(5, [{ kind: "maske", level: 1 }]), { low: 5, high: 5.5 })
  assert.deepEqual(consultScoreRange(5, [{ kind: "spuelung_neu", level: 3 }]), {
    low: 5.5,
    high: 6.5,
  })
  // 1,5 + ½ × (1 + 1 + 1) = 3 → capped at 2.
  assert.deepEqual(
    consultScoreRange(5, [
      { kind: "spuelung_neu", level: 3 },
      { kind: "entwirren", level: 2 },
      { kind: "leave_in", level: 2 },
      { kind: "waschrhythmus", level: 2 },
    ]),
    { low: 6, high: 7 },
  )
})

test("the room above the baseline caps the range, and nothing passes 9", () => {
  // 0,6 × (10 − 8,5) = 0,9 → 0,5.
  assert.deepEqual(consultScoreRange(8.5, [{ kind: "hitze_tools", level: 3 }]), {
    low: 8.5,
    high: 9,
  })
  assert.deepEqual(consultScoreRange(9, [{ kind: "hitze_tools", level: 3 }]), {
    low: 9,
    high: 9,
  })
  assert.deepEqual(consultScoreRange(9.5, [{ kind: "hitze_tools", level: 3 }]), {
    low: 9.5,
    high: 9.5,
  })
})

test("appointment levers, the scalp block and unscored rows stay out of the range", () => {
  assert.equal(
    consultScoreRange(6, [
      { kind: "chemie_abstaende", level: 3 },
      { kind: "spitzen", level: 2 },
      { kind: "kopfhaut", level: null },
    ]),
    null,
  )
  assert.equal(consultScoreRange(6, []), null)
})

test("rows without a kind (added by hand, or legacy) count with the level they carry", () => {
  assert.deepEqual(consultScoreRange(6, [{ kind: null, level: 2 }]), { low: 6.5, high: 7 })
  assert.equal(consultScoreRange(6, [{ kind: null, level: null }]), null)
})

test("legacy points map onto levels", () => {
  assert.equal(levelFromLegacyPoints(2), 3)
  assert.equal(levelFromLegacyPoints(1.5), 3)
  assert.equal(levelFromLegacyPoints(1), 2)
  assert.equal(levelFromLegacyPoints(0.5), 1)
  assert.equal(levelFromLegacyPoints(0), null)
  assert.equal(levelFromLegacyPoints(null), null)
})
