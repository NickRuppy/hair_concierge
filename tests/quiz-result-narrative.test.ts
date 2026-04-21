import assert from "node:assert/strict"
import test from "node:test"

import { buildQuizResultNarrative } from "../src/lib/quiz/result-narrative"

test("surface-led results expose scope labels, bucketed positions, concise goal copy, and a main lever", () => {
  const narrative = buildQuizResultNarrative({
    structure: "wavy",
    thickness: "normal",
    fingertest: "rau",
    pulltest: "stretches_bounces",
    concerns: ["frizz"],
    goals: ["less_frizz", "shine"],
  })

  assert.equal(narrative.rows[0]?.label, "Haargefühl")
  assert.equal(narrative.rows[0]?.scope, "LÄNGEN")
  assert.equal(narrative.rows[0]?.currentPosition, 66)
  assert.equal(narrative.rows[0]?.targetPosition, 78)

  assert.equal(narrative.rows[1]?.label, "Was dich gerade ausbremst")
  assert.equal(narrative.rows[1]?.scope, "LÄNGEN")
  assert.equal(narrative.rows[1]?.currentPosition, 66)
  assert.equal(narrative.rows[1]?.targetPosition, 84)

  assert.equal(narrative.rows[2]?.label, "Worauf wir hinarbeiten")
  assert.equal(narrative.rows[2]?.scope, "LÄNGEN")
  assert.equal(narrative.rows[2]?.before, "wenig Kontrolle")
  assert.equal(narrative.rows[2]?.after, "mehr Geschmeidigkeit & Kontrolle")
  assert.equal(narrative.rows[2]?.currentPosition, 50)
  assert.equal(narrative.rows[2]?.targetPosition, 88)

  assert.equal(narrative.needs.title, "Was dein Haar jetzt braucht")
  assert.equal(narrative.needs.mainLeverTitle, "Mehr Schutz für Oberfläche und Längen aufbauen")
  assert.match(narrative.needs.mainLeverWhy, /unruhig/i)
  assert.match(narrative.needs.mainLeverProducts, /Conditioner/i)
  assert.match(narrative.needs.mainLeverProducts, /zusätzlich/i)
  assert.match(narrative.needs.mainLeverProducts, /Leave-in/i)
  assert.ok(!("reveal" in narrative))

  assert.equal(narrative.cta.lead, "Als Nächstes: dein persönlicher Plan")
  assert.equal(narrative.cta.subline, "Mit passenden Produkten, Reihenfolge und Anwendung.")
})

test("primary concern ranking prefers hair damage over tangling, split ends, and frizz", () => {
  const narrative = buildQuizResultNarrative({
    structure: "wavy",
    thickness: "normal",
    fingertest: "rau",
    pulltest: "stretches_stays",
    concerns: ["hair_damage", "split_ends", "frizz"],
    goals: ["healthier_hair", "less_frizz"],
  })

  assert.equal(narrative.primaryConcern, "hair_damage")
  assert.equal(narrative.primaryGoal, "healthier_hair")
  assert.equal(narrative.rows[1]?.label, "Was dich gerade ausbremst")
  assert.equal(narrative.rows[1]?.before, "Haarschäden")
  assert.equal(narrative.rows[1]?.scope, "HAAR")
  assert.equal(narrative.rows[1]?.iconKey, "shield")
  assert.equal(narrative.rows[1]?.tickBefore, "angegriffen")
  assert.equal(narrative.rows[1]?.tickAfter, "geschützt")
})

test("treatment boost changes the concern ranking against untreated hair", () => {
  const untreated = buildQuizResultNarrative({
    structure: "curly",
    thickness: "normal",
    fingertest: "glatt",
    pulltest: "stretches_bounces",
    concerns: ["hair_damage", "dryness"],
    goals: ["healthy_scalp"],
  })

  const treated = buildQuizResultNarrative({
    structure: "curly",
    thickness: "normal",
    fingertest: "glatt",
    pulltest: "stretches_bounces",
    treatment: ["gefaerbt"],
    concerns: ["hair_damage", "dryness"],
    goals: ["healthy_scalp"],
  })

  assert.equal(untreated.primaryConcern, "dryness")
  assert.equal(treated.primaryConcern, "hair_damage")
  assert.equal(untreated.rows[1]?.before, "Trockenheit")
  assert.equal(treated.rows[1]?.before, "Haarschäden")
})

test("multi-goal intro acknowledges additional selected goals with unter anderem and mirrors the concern", () => {
  const narrative = buildQuizResultNarrative({
    structure: "straight",
    thickness: "fine",
    fingertest: "leicht_uneben",
    pulltest: "stretches_bounces",
    concerns: ["frizz"],
    goals: ["shine", "less_frizz"],
  })

  assert.equal(
    narrative.intro,
    "Du hast gesagt, dass dich vor allem Frizz stört und dass du dir unter anderem ruhigeres, geschmeidigeres Haar wünschst.",
  )
})

test("no-concern fallback can become scalp-led when scalp is the strongest real friction", () => {
  const narrative = buildQuizResultNarrative({
    structure: "straight",
    thickness: "fine",
    fingertest: "glatt",
    pulltest: "stretches_bounces",
    scalp_type: "fettig",
    has_scalp_issue: true,
    scalp_condition: "schuppen",
    goals: ["healthy_scalp"],
    concerns: [],
  })

  assert.equal(narrative.primaryConcern, null)
  assert.equal(narrative.primaryGoal, "healthy_scalp")
  assert.equal(
    narrative.intro,
    "Du hast gesagt, dass du dir eine ruhigere, ausgeglichenere Kopfhaut wünschst und wir sehen schon, was dein Haar gerade noch ausbremst.",
  )
  assert.equal(narrative.rows[1]?.label, "Was dich gerade ausbremst")
  assert.doesNotMatch(narrative.rows[0]?.before ?? "", /Kopfhaut|Ansatz/i)
  assert.doesNotMatch(narrative.rows[1]?.before ?? "", /Kopfhaut|Ansatz/i)
  assert.doesNotMatch(narrative.rows[2]?.before ?? "", /Kopfhaut|Ansatz/i)
  assert.equal(narrative.rows[0]?.scope, "KOPFHAUT")
  assert.equal(narrative.rows[1]?.scope, "KOPFHAUT")
  assert.equal(narrative.rows[2]?.scope, "KOPFHAUT")
  assert.equal(narrative.rows[0]?.iconKey, "droplet")
  assert.equal(narrative.rows[0]?.tickBefore, "unausgeglichen")
  assert.equal(narrative.rows[0]?.tickAfter, "ausgeglichen")
  assert.equal(narrative.rows[1]?.iconKey, "leaf")
  assert.equal(narrative.rows[1]?.tickBefore, "unruhig")
  assert.equal(narrative.rows[1]?.tickAfter, "ausgeglichen")
  assert.equal(narrative.rows[2]?.iconKey, "leaf")
  assert.equal(narrative.rows[2]?.tickBefore, "unruhig")
  assert.equal(narrative.rows[2]?.tickAfter, "beruhigt")
  assert.match(narrative.needs.mainLeverWhy, /Schuppen/i)
  assert.match(narrative.needs.mainLeverProducts, /Anti-Schuppen-Shampoo/i)
  assert.match(narrative.needs.mainLeverProducts, /Kopfhautserum/i)
})

test("an explicit dryness concern keeps row two and the main lever out of the scalp fallback", () => {
  const narrative = buildQuizResultNarrative({
    structure: "wavy",
    thickness: "normal",
    fingertest: "leicht_uneben",
    pulltest: "stretches_stays",
    treatment: ["gefaerbt"],
    scalp_type: "trocken",
    concerns: ["dryness"],
    goals: ["shine"],
  })

  assert.equal(narrative.primaryConcern, "dryness")
  assert.equal(narrative.rows[1]?.label, "Was dich gerade ausbremst")
  assert.equal(narrative.rows[1]?.scope, "LÄNGEN")
  assert.equal(narrative.rows[1]?.before, "Trockenheit")
  assert.equal(narrative.rows[1]?.after, "weichere, besser mit Feuchtigkeit versorgte Längen")
  assert.doesNotMatch(narrative.needs.mainLeverTitle, /Kopfhaut/i)
  assert.doesNotMatch(narrative.needs.mainLeverProducts, /Anti-Schuppen-Shampoo|Kopfhautserum/i)
})

test("ansatz fallback stays concise without repeating location words", () => {
  const narrative = buildQuizResultNarrative({
    structure: "straight",
    thickness: "fine",
    fingertest: "glatt",
    pulltest: "stretches_bounces",
    scalp_type: "fettig",
    concerns: [],
    goals: [],
  })

  assert.equal(narrative.rows[1]?.scope, "ANSATZ")
  assert.doesNotMatch(narrative.rows[1]?.before ?? "", /Ansatz/i)
  assert.doesNotMatch(narrative.rows[1]?.after ?? "", /Ansatz/i)
})

test("primary goal falls back to the existing ordered selected goals when no direct match is selected", () => {
  const narrative = buildQuizResultNarrative({
    structure: "straight",
    thickness: "fine",
    fingertest: "glatt",
    pulltest: "stretches_bounces",
    concerns: ["dryness"],
    goals: ["healthy_scalp", "shine"],
  })

  assert.equal(narrative.primaryGoal, "shine")
  assert.equal(narrative.rows[2]?.scope, "HAAR")
  assert.equal(narrative.rows[2]?.before, "wenig Glanz")
  assert.equal(narrative.rows[2]?.after, "mehr Leuchtkraft & Lebendigkeit")
  assert.equal(narrative.rows[2]?.iconKey, "sparkles")
  assert.equal(narrative.rows[2]?.tickBefore, "matt")
  assert.equal(narrative.rows[2]?.tickAfter, "glänzend")
})

test("severe structural signals can mention bondbuilder support in the main lever", () => {
  const narrative = buildQuizResultNarrative({
    structure: "wavy",
    thickness: "normal",
    fingertest: "rau",
    pulltest: "stretches_stays",
    treatment: ["blondiert"],
    concerns: ["breakage", "hair_damage"],
    goals: ["anti_breakage", "healthier_hair"],
  })

  assert.equal(narrative.rows[0]?.scope, "HAAR")
  assert.equal(narrative.rows[0]?.currentPosition, 82)
  assert.equal(narrative.rows[1]?.currentPosition, 82)
  assert.equal(narrative.rows[2]?.before, "wenig Stabilität")
  assert.match(narrative.needs.mainLeverProducts, /Bondbuilder/i)
  assert.match(narrative.needs.mainLeverProducts, /zusätzlich/i)
  assert.match(narrative.needs.mainLeverProducts, /Maske/i)
})

test("surface branch explains the main lever with multiple fitting categories", () => {
  const narrative = buildQuizResultNarrative({
    structure: "wavy",
    thickness: "normal",
    fingertest: "rau",
    pulltest: "stretches_bounces",
    concerns: ["frizz"],
    goals: ["less_frizz", "shine"],
  })

  assert.equal(
    narrative.needs.mainLeverProducts,
    "Am meisten erreichen wir hier mit einem passenden Conditioner; zusätzlich kann ein Leave-in helfen, die Längen zwischen den Wäschen ruhiger zu halten.",
  )
})

test("scalp branch explains the main lever with product-specific follow-through", () => {
  const narrative = buildQuizResultNarrative({
    structure: "straight",
    thickness: "fine",
    fingertest: "glatt",
    pulltest: "stretches_bounces",
    scalp_type: "trocken",
    has_scalp_issue: true,
    scalp_condition: "schuppen",
    goals: ["healthy_scalp"],
    concerns: [],
  })

  assert.equal(
    narrative.needs.mainLeverProducts,
    "Am meisten erreichen wir hier mit einem passenden Anti-Schuppen-Shampoo; zusätzlich kann ein beruhigendes Kopfhautserum helfen, die Kopfhaut zwischen den Haarwäschen ruhiger zu halten.",
  )
})

test("split-ends branch explains the main lever with tip-focused product guidance", () => {
  const narrative = buildQuizResultNarrative({
    structure: "straight",
    thickness: "fine",
    fingertest: "glatt",
    pulltest: "stretches_bounces",
    concerns: ["split_ends"],
    goals: ["less_split_ends"],
  })

  assert.equal(
    narrative.needs.mainLeverProducts,
    "Am meisten erreichen wir hier mit einem leichten Haaröl; zusätzlich kann ein Leave-in helfen, die Spitzen geschmeidiger und besser geschützt zu halten.",
  )
})

test("fallback branch still offers a concise but fuller product bridge", () => {
  const narrative = buildQuizResultNarrative({
    structure: "straight",
    thickness: "fine",
    fingertest: "glatt",
    pulltest: "stretches_bounces",
    concerns: [],
    goals: [],
  })

  assert.equal(
    narrative.needs.mainLeverProducts,
    "Am meisten erreichen wir hier mit einem passenden Conditioner; zusätzlich kann ein leichtes Leave-in helfen, die Wirkung in den Längen zu halten.",
  )
})

test("fixed row labels and CTA copy stay compact", () => {
  const narrative = buildQuizResultNarrative({
    structure: "wavy",
    thickness: "normal",
    fingertest: "glatt",
    pulltest: "stretches_bounces",
    concerns: ["dryness"],
    goals: ["moisture"],
  })

  assert.deepEqual(
    narrative.rows.map((row) => row.label),
    ["Haargefühl", "Was dich gerade ausbremst", "Worauf wir hinarbeiten"],
  )
  assert.equal(typeof narrative.rows[0]?.before, "string")
  assert.equal(typeof narrative.rows[0]?.after, "string")
  assert.equal(narrative.rows[0]?.scope, "LÄNGEN")
  assert.equal(narrative.rows[0]?.currentPosition, 34)
  assert.equal(narrative.rows[0]?.targetPosition, 78)
  assert.equal(narrative.cta.lead, "Als Nächstes: dein persönlicher Plan")
  assert.equal(narrative.cta.label, "MEINE ROUTINE STARTEN")
  assert.equal(narrative.cta.subline, "Mit passenden Produkten, Reihenfolge und Anwendung.")
})
