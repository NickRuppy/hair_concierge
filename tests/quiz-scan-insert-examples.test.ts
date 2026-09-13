import assert from "node:assert/strict"
import test from "node:test"

import {
  getScanInsertDensityLabel,
  getScanInsertExample,
  getScanInsertScalpTarget,
  getScanInsertTextureAdjective,
  getScanInsertThicknessLabel,
} from "../src/lib/quiz/scan-insert-examples"
import type { QuizAnswers } from "../src/lib/quiz/types"

/**
 * The example card on a scan insert is a demo of the scanner, not a
 * recommendation: it mirrors the product on the photo against the answers the
 * quiz already holds at that screen. Every branch below is reachable from the
 * real quiz option values (`quiz-scalp-question.tsx`, `questions.ts`).
 */

function answers(overrides: QuizAnswers = {}): QuizAnswers {
  return { ...overrides }
}

test("insert 16 stays partial: cleansing and thickness, no scalp row", () => {
  const card = getScanInsertExample(16, answers({ structure: "wavy", thickness: "fine" }))

  assert.equal(card.product.name, "OGX Argan Oil of Morocco Shampoo")
  assert.equal(card.product.category, "Shampoo")
  assert.equal(card.product.price, "ca. 6,95 €")
  assert.deepEqual(
    card.rows.map((row) => row.label),
    ["Reinigung", "Haardicke"],
  )
  assert.deepEqual(card.rows[0], {
    label: "Reinigung",
    productValue: "regulär",
    targetValue: "regulär",
    status: "ok",
  })
  assert.deepEqual(card.rows[1], {
    label: "Haardicke",
    productValue: "dick",
    targetValue: "fein",
    status: "bad",
  })
  assert.equal(card.verdict, "bad")
  assert.equal(card.headline, "Passt nicht zu deinem Haar")
  assert.equal(card.deviation, "Haardicke: dick statt fein")
})

test("insert 16 weighs the fixed thick product against every thickness", () => {
  const expected: [string, string, "ok" | "warn" | "bad", string][] = [
    ["fine", "fein", "bad", "Haardicke: dick statt fein"],
    ["normal", "mittel", "warn", "Haardicke: dick statt mittel"],
    ["coarse", "dick", "ok", "Alles im Ziel."],
  ]
  for (const [thickness, label, status, deviation] of expected) {
    const card = getScanInsertExample(16, answers({ thickness }))
    assert.equal(card.rows[1].targetValue, label, thickness)
    assert.equal(card.rows[1].status, status, thickness)
    assert.equal(card.deviation, deviation, thickness)
    assert.equal(
      card.headline,
      status === "bad"
        ? "Passt nicht zu deinem Haar"
        : status === "warn"
          ? "Passt mit Einschränkung"
          : "Passt zu deinem Haar",
      thickness,
    )
  }
})

test("insert 16 falls back to the default thickness before the question is answered", () => {
  const card = getScanInsertExample(16, answers())

  assert.equal(card.rows[1].targetValue, "fein")
  assert.equal(card.rows[1].status, "bad")
  assert.equal(card.verdict, "bad")
  assert.equal(card.headline, "Passt nicht zu deinem Haar")
  assert.equal(card.deviation, "Haardicke: dick statt fein")
})

test("insert 17 reads the scalp type when the user reported no complaint", () => {
  const expected: [string, string, "ok" | "warn" | "bad"][] = [
    ["fettig", "fettig", "bad"],
    ["ausgeglichen", "ausgeglichen", "bad"],
    ["trocken", "trocken", "ok"],
  ]
  for (const [scalpType, target, status] of expected) {
    const card = getScanInsertExample(
      17,
      answers({ scalp_type: scalpType, has_scalp_issue: false, thickness: "normal" }),
    )
    const scalpRow = card.rows.find((row) => row.label === "Kopfhaut")
    assert.ok(scalpRow, scalpType)
    assert.equal(scalpRow.productValue, "trocken, gereizt")
    assert.equal(scalpRow.targetValue, target, scalpType)
    assert.equal(scalpRow.status, status, scalpType)
  }
})

test("insert 17 reads the reported complaint over the scalp type", () => {
  const expected: [string, string, "ok" | "warn" | "bad"][] = [
    ["schuppen", "Schuppen", "bad"],
    ["trockene_schuppen", "trockene Schuppen", "bad"],
    ["gereizt", "gereizt", "ok"],
  ]
  for (const [condition, target, status] of expected) {
    const card = getScanInsertExample(
      17,
      answers({
        scalp_type: "trocken",
        has_scalp_issue: true,
        scalp_condition: condition,
      }),
    )
    const scalpRow = card.rows.find((row) => row.label === "Kopfhaut")
    assert.ok(scalpRow, condition)
    assert.equal(scalpRow.targetValue, target, condition)
    assert.equal(scalpRow.status, status, condition)
  }
})

test("insert 17 ignores a complaint the user took back", () => {
  // `quiz-scalp-question.tsx` clears `scalp_condition` and `has_scalp_issue`
  // separately, so a changed answer can leave a stale condition behind.
  const card = getScanInsertExample(
    17,
    answers({ scalp_type: "fettig", has_scalp_issue: false, scalp_condition: "schuppen" }),
  )

  assert.equal(card.rows.find((row) => row.label === "Kopfhaut")?.targetValue, "fettig")
})

test("insert 17 asks for a clarifying wash when the scalp runs oily", () => {
  const card = getScanInsertExample(
    17,
    answers({ scalp_type: "fettig", has_scalp_issue: false, thickness: "coarse" }),
  )

  assert.deepEqual(
    card.rows.map((row) => row.label),
    ["Reinigung", "Kopfhaut", "Haardicke"],
  )
  assert.deepEqual(card.rows[0], {
    label: "Reinigung",
    productValue: "regulär",
    targetValue: "klärend",
    status: "warn",
  })
  assert.equal(card.verdict, "bad")
  assert.equal(card.headline, "Passt nicht zu deiner Kopfhaut")
  assert.equal(
    card.deviation,
    "Reinigung: regulär statt klärend · Kopfhaut: trocken, gereizt statt fettig",
  )
})

// Insert 17 sits right behind the scalp question and judges a scalp shampoo:
// its positive verdict must say "Kopfhaut" like its negative one already does,
// and the line below it must name the criterion that was met.
test("insert 17 passes on the scalp and says so, naming the matched criterion", () => {
  const card = getScanInsertExample(
    17,
    answers({ scalp_type: "trocken", has_scalp_issue: false, thickness: "normal" }),
  )

  assert.equal(card.verdict, "ok")
  assert.equal(card.headline, "Passt zu deiner Kopfhaut")
  assert.equal(card.deviation, "Kopfhaut trocken, gereizt – genau dein Profil.")
  assert.equal(
    card.rows.every((row) => row.status === "ok"),
    true,
  )
})

test("inserts 16 and 18 carry no scalp row, so they keep the hair verdict", () => {
  const problem = getScanInsertExample(16, answers({ thickness: "coarse" }))
  assert.equal(problem.verdict, "ok")
  assert.equal(problem.headline, "Passt zu deinem Haar")
  assert.equal(problem.deviation, "Alles im Ziel.")

  const home = getScanInsertExample(18, answers({ thickness: "normal" }))
  assert.equal(home.verdict, "ok")
  assert.equal(home.headline, "Passt zu deinem Haar")
  assert.equal(home.deviation, "Alles im Ziel.")
})

test("insert 17 keeps the restriction verdict when only the wash deviates", () => {
  const card = getScanInsertExample(
    17,
    answers({ scalp_type: "fettig", has_scalp_issue: true, scalp_condition: "gereizt" }),
  )

  assert.equal(card.rows.find((row) => row.label === "Kopfhaut")?.status, "ok")
  assert.equal(card.verdict, "warn")
  assert.equal(card.headline, "Passt mit Einschränkung")
  assert.equal(card.deviation, "Reinigung: regulär statt klärend")
})

test("insert 17 falls back to a balanced scalp before the question is answered", () => {
  const card = getScanInsertExample(17, answers())

  assert.equal(card.rows.find((row) => row.label === "Kopfhaut")?.targetValue, "ausgeglichen")
  assert.equal(card.rows.find((row) => row.label === "Haardicke")?.targetValue, "fein")
  assert.equal(card.verdict, "bad")
  assert.equal(card.headline, "Passt nicht zu deiner Kopfhaut")
})

test("insert 18 weighs the mask against thickness, direction and repair need", () => {
  const card = getScanInsertExample(18, answers({ thickness: "normal" }))

  assert.equal(card.product.name, "Balea Professional Repair Kur")
  assert.equal(card.product.category, "Haarmaske")
  assert.equal(card.product.price, "ca. 1,95 €")
  assert.deepEqual(
    card.rows.map((row) => row.label),
    ["Pflegegewicht", "Pflegerichtung", "Repair-Pflege"],
  )
  assert.deepEqual(card.rows, [
    { label: "Pflegegewicht", productValue: "mittel", targetValue: "mittel", status: "ok" },
    {
      label: "Pflegerichtung",
      productValue: "ausgeglichen",
      targetValue: "ausgeglichen",
      status: "ok",
    },
    { label: "Repair-Pflege", productValue: "mittel", targetValue: "mittel", status: "ok" },
  ])
  assert.equal(card.verdict, "ok")
  assert.equal(card.headline, "Passt zu deinem Haar")
  assert.equal(card.deviation, "Alles im Ziel.")
})

test("insert 18 warns one step off the care weight in both directions", () => {
  const expected: [string, string][] = [
    ["fine", "leicht"],
    ["coarse", "reichhaltig"],
  ]
  for (const [thickness, target] of expected) {
    const card = getScanInsertExample(18, answers({ thickness }))
    assert.deepEqual(card.rows[0], {
      label: "Pflegegewicht",
      productValue: "mittel",
      targetValue: target,
      status: "warn",
    })
    assert.equal(card.verdict, "warn", thickness)
    assert.equal(card.headline, "Passt mit Einschränkung", thickness)
    assert.equal(card.deviation, `Pflegegewicht: mittel statt ${target}`, thickness)
  }
})

test("insert 18 raises the repair target for bleached hair", () => {
  const card = getScanInsertExample(
    18,
    answers({ thickness: "normal", treatment: ["gefaerbt", "blondiert"] }),
  )

  assert.deepEqual(card.rows[2], {
    label: "Repair-Pflege",
    productValue: "mittel",
    targetValue: "hoch",
    status: "warn",
  })
  assert.equal(card.verdict, "warn")
  assert.equal(card.deviation, "Repair-Pflege: mittel statt hoch")
})

test("insert 18 raises the repair target for damage concerns", () => {
  for (const concern of ["hair_damage", "breakage", "split_ends"] as const) {
    const card = getScanInsertExample(18, answers({ thickness: "normal", concerns: [concern] }))
    assert.equal(card.rows[2].targetValue, "hoch", concern)
    assert.equal(card.rows[2].status, "warn", concern)
  }

  const untouched = getScanInsertExample(
    18,
    answers({ thickness: "normal", concerns: ["frizz_flyaways"], treatment: ["natur"] }),
  )
  assert.equal(untouched.rows[2].targetValue, "mittel")
})

test("insert 18 joins every deviation into one line", () => {
  const card = getScanInsertExample(18, answers({ thickness: "coarse", treatment: ["blondiert"] }))

  assert.equal(
    card.deviation,
    "Pflegegewicht: mittel statt reichhaltig · Repair-Pflege: mittel statt hoch",
  )
})

test("insert 18 stays valid before any question is answered", () => {
  const card = getScanInsertExample(18, answers())

  assert.equal(card.rows.length, 3)
  assert.deepEqual(
    card.rows.map((row) => row.targetValue),
    ["leicht", "ausgeglichen", "mittel"],
  )
  assert.equal(card.verdict, "warn")
})

test("the copy helpers name the hair the quiz already knows", () => {
  const textures: [string, string][] = [
    ["straight", "glattes"],
    ["wavy", "welliges"],
    ["curly", "lockiges"],
    ["coily", "krauses"],
  ]
  for (const [structure, adjective] of textures) {
    assert.equal(getScanInsertTextureAdjective({ structure }), adjective, structure)
  }
  assert.equal(getScanInsertTextureAdjective({}), "welliges")
  assert.equal(getScanInsertTextureAdjective({ structure: "unbekannt" }), "welliges")

  assert.equal(getScanInsertThicknessLabel({ thickness: "coarse" }), "dick")
  assert.equal(getScanInsertThicknessLabel({}), "fein")

  const densities: [string, string][] = [
    ["low", "geringe Dichte"],
    ["medium", "mittlere Dichte"],
    ["high", "hohe Dichte"],
  ]
  for (const [density, label] of densities) {
    assert.equal(getScanInsertDensityLabel({ density }), label, density)
  }
  assert.equal(getScanInsertDensityLabel({}), "mittlere Dichte")
  assert.equal(getScanInsertDensityLabel({ density: "unbekannt" }), "mittlere Dichte")

  assert.equal(getScanInsertScalpTarget({ scalp_type: "fettig", has_scalp_issue: false }), "fettig")
  assert.equal(
    getScanInsertScalpTarget({
      scalp_type: "fettig",
      has_scalp_issue: true,
      scalp_condition: "trockene_schuppen",
    }),
    "trockene Schuppen",
  )
  assert.equal(getScanInsertScalpTarget({}), "ausgeglichen")
})

test("every row value stays a single word except the scalp range the product covers", () => {
  const cards = [
    getScanInsertExample(16, answers({ thickness: "coarse" })),
    getScanInsertExample(17, answers({ scalp_type: "fettig", has_scalp_issue: false })),
    getScanInsertExample(18, answers({ thickness: "fine" })),
  ]
  for (const card of cards) {
    for (const row of card.rows) {
      if (row.label === "Kopfhaut") {
        assert.equal(row.productValue, "trocken, gereizt")
        continue
      }
      assert.doesNotMatch(row.productValue, /\s/, `${row.label} product value`)
    }
  }
})
