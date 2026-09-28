import assert from "node:assert/strict"
import test from "node:test"

import type { DiscoveryCallSheetBriefSections } from "../src/lib/discovery/call-sheet"
import type { ConsultInput, ConsultProduct } from "../src/lib/discovery/consult-brief/input"
import { CONSULT_KNOWLEDGE_ENTRIES } from "../src/lib/discovery/consult-brief/knowledge"
import { CONSULT_GUARDRAILS_MARKDOWN } from "../src/lib/discovery/consult-brief/knowledge-sources"
import {
  CONSULT_BOUNDARY_LINE,
  CONSULT_FORBIDDEN_PHRASES,
  CONSULT_MARKET_BRANDS,
  findForbiddenPhrases,
  lintConsultBrief,
  type ConsultLintFinding,
} from "../src/lib/discovery/consult-brief/lint"

/**
 * The deterministic guardrail lint over a generated brief (consult-agent T2): forbidden
 * phrases (G1–G6, pinned against guardrails.md), verdict contradictions in both directions
 * (G4), invented products, the mandatory boundary line (G2) and score promises (G1/G3).
 * An empty list = pass.
 */

const SHAMPOO_KEY = "shampoo:shampoo_everyday:none"
const CONDITIONER_KEY = "conditioner:conditioner_rinse_out:none"
const BOND_KEY = "bondbuilder:specialized_bond_treatment:none"

function product(input: Partial<ConsultProduct> & Pick<ConsultProduct, "name">): ConsultProduct {
  return {
    bucket: "behalten",
    decisionKey: null,
    intakeItemId: null,
    categoryLabel: null,
    aliases: [input.name],
    verdict: "passt",
    verdictLabel: null,
    decision: null,
    swapTarget: null,
    swapOptions: [],
    ...input,
  }
}

function nomiInput(overrides: Partial<ConsultInput> = {}): ConsultInput {
  return {
    profile: {
      hairTexture: "wavy",
      thickness: "normal",
      scalpType: "balanced",
      chemicalTreatments: ["lightened", "colored"],
      elasticity: "snaps",
      scalpConcerns: [],
      concerns: ["breakage"],
    },
    mainConcern: null,
    flags: ["bleached", "colored", "hot_tool", "breakage_signal"],
    knowledge: [],
    products: [
      product({
        bucket: "behalten",
        decisionKey: CONDITIONER_KEY,
        name: "Pflegehaus Repair Spülung",
        aliases: ["Pflegehaus Repair Spülung", "Repair Spülung"],
        verdict: "passt",
      }),
      product({
        bucket: "tauschenOderNeu",
        decisionKey: SHAMPOO_KEY,
        name: "Glanzwerk Volumen Shampoo",
        aliases: ["Glanzwerk Volumen Shampoo", "Volumen Shampoo"],
        verdict: "passt_nicht",
        swapOptions: ["Sanftwerk Mild Shampoo"],
      }),
      product({
        bucket: "tauschenOderNeu",
        decisionKey: BOND_KEY,
        name: "Bindwerk Bond Kur",
        verdict: "neu",
      }),
    ],
    checklist: [],
    heat: null,
    washFrequency: {
      current: null,
      currentLabel: null,
      ideal: null,
      idealLabel: null,
      changes: false,
    },
    boundaryTriggers: [],
    baselineScore: 4,
    ...overrides,
  }
}

/** A brief that honours every rule — the baseline the adversarial variants break. */
function cleanBrief(): DiscoveryCallSheetBriefSections {
  return {
    diagnose:
      "Blondiert und gefärbt, dazu zweimal pro Woche Lockenstab: Die Längen sind vorgeschädigt, und die Hitze setzt jede Woche neuen Schaden. Das Glanzwerk Volumen Shampoo passt nicht zu ihren Längen.",
    hebel: [
      {
        title: "Weniger neuer Schaden",
        note: "Lockenstab seltener, nur ins trockene Haar, Hitzeschutz vorher.",
        points: 1.5,
      },
      {
        title: "Mildes Shampoo",
        note: "Sanftwerk Mild Shampoo statt Glanzwerk Volumen Shampoo, nur auf die Kopfhaut.",
        points: 1,
      },
      { title: "Bondbuilder", note: "Bindwerk Bond Kur im vorgesehenen Rhythmus.", points: 1 },
    ],
    swapReasons: {
      [SHAMPOO_KEY]:
        "Das jetzige Shampoo passt nicht: Es reinigt kräftig und raut die Längen weiter auf. Das Sanftwerk Mild Shampoo reinigt milder.",
      [CONDITIONER_KEY]: "Die Pflegehaus Repair Spülung passt und bleibt.",
    },
    zielLuecken: [
      "Der Glanz kommt mit der Pflege; die gebrochenen Spitzen wachsen raus oder werden geschnitten.",
    ],
    callFragen: ["Wie oft pro Woche nutzt du den Lockenstab, und auf welcher Stufe?"],
    erwartungen: [
      "Kämmbarkeit: erste Unterschiede nach wenigen Wäschen, stabil in 2–4 Wochen.",
      CONSULT_BOUNDARY_LINE,
    ],
  }
}

function rules(findings: ConsultLintFinding[]) {
  return findings.map((finding) => finding.rule)
}

// --- clean ------------------------------------------------------------------------------

test("a clean brief has no findings", () => {
  assert.deepEqual(lintConsultBrief(cleanBrief(), nomiInput()), [])
})

test("the boundary line itself passes the phrase list", () => {
  assert.deepEqual(findForbiddenPhrases(CONSULT_BOUNDARY_LINE), [])
  assert.ok(CONSULT_GUARDRAILS_MARKDOWN.includes(CONSULT_BOUNDARY_LINE))
})

// --- G1 phrases, pinned to guardrails.md ---------------------------------------------------

/**
 * Every „…" quote in guardrails.md is either forbidden (flagged) or allowed (not flagged).
 * Quotes after „Erlaubt", „Stattdessen" or „Ausnahme" on their line are allowed; the rest are
 * forbidden, except these — named in rules that the phrase lint does not own (G4 verdict
 * words, G5's recommended cautious wording).
 */
const ALLOWED_OUTSIDE_EXEMPT_CLAUSES = new Set([
  "passt nicht",
  "behalten",
  "passt",
  "kann helfen",
  "einen Versuch wert",
  "schauen wir uns an",
])

function guardrailQuotes(): { forbidden: string[]; allowed: string[] } {
  const forbidden: string[] = []
  const allowed: string[] = []
  for (const line of CONSULT_GUARDRAILS_MARKDOWN.split("\n")) {
    const cut = line.search(/Erlaubt|Stattdessen|Ausnahme/)
    for (const match of line.matchAll(/„([^"“]+)["“]/g)) {
      const quote = match[1]!.replace(/…/g, "").trim()
      const exempt = cut !== -1 && match.index! > cut
      if (exempt || ALLOWED_OUTSIDE_EXEMPT_CLAUSES.has(quote)) allowed.push(quote)
      else forbidden.push(quote)
    }
  }
  return { forbidden, allowed }
}

test("every forbidden quote in guardrails.md is caught by the phrase list (no silent drift)", () => {
  const { forbidden } = guardrailQuotes()
  assert.ok(forbidden.length >= 40, `only ${forbidden.length} quotes found`)
  const missed = forbidden.filter((quote) => findForbiddenPhrases(`Satz: ${quote}.`).length === 0)
  assert.deepEqual(missed, [])
})

test("every allowed quote in guardrails.md passes the phrase list", () => {
  const { allowed } = guardrailQuotes()
  assert.ok(allowed.length >= 10)
  const flagged = allowed.filter((quote) => findForbiddenPhrases(`Satz: ${quote}.`).length > 0)
  assert.deepEqual(flagged, [])
})

test("every phrase rule names its guardrail and an anchor that exists in guardrails.md", () => {
  for (const phrase of CONSULT_FORBIDDEN_PHRASES) {
    assert.ok(
      CONSULT_GUARDRAILS_MARKDOWN.includes(phrase.anchor),
      `${phrase.id}: anchor „${phrase.anchor}" not in guardrails.md`,
    )
    assert.ok(CONSULT_GUARDRAILS_MARKDOWN.includes(`## ${phrase.guardrail} `), phrase.id)
  }
})

test("G1b: supplements and drug actives named in guardrails.md are flagged; Glätteisen is not", () => {
  for (const word of ["Biotin", "Zink", "Eisen", "Minoxidil", "Kortison", "Ketoconazol"]) {
    assert.ok(CONSULT_GUARDRAILS_MARKDOWN.includes(word), word)
    assert.ok(findForbiddenPhrases(`Probier mal ${word}.`).length > 0, word)
  }
  assert.deepEqual(findForbiddenPhrases("Glätteisen und Welleneisen nur ins trockene Haar."), [])
})

test("the knowledge base's own wording passes the phrase list", () => {
  for (const entry of CONSULT_KNOWLEDGE_ENTRIES) {
    for (const text of [entry.einsicht, entry.imCall, ...entry.fragen]) {
      assert.deepEqual(
        findForbiddenPhrases(text).map((hit) => hit.id),
        [],
        `${entry.id}: ${text.slice(0, 60)}`,
      )
    }
  }
  // Her description of shedding is not the „mehr Haare" promise.
  assert.deepEqual(findForbiddenPhrases("Mir fallen mehr Haare aus als sonst."), [])
  assert.deepEqual(findForbiddenPhrases("Sie verliert mehr Haare als früher."), [])
})

test("inflections of the repair/heal promises are caught", () => {
  for (const sentence of [
    "Die Kur repariert die Längen.",
    "Das Serum soll die Spitzen reparieren.",
    "Das heilt die Kopfhaut.",
    "Die Spitzen werden wie neu.",
    "Es regeneriert das Haar.",
    "Das stellt die Struktur wieder her.",
  ]) {
    assert.ok(findForbiddenPhrases(sentence).length > 0, sentence)
  }
})

test("a product name quoted from a verdict may carry „Repair“ or „Reparatur“", () => {
  const input = nomiInput({
    products: [
      ...nomiInput().products,
      product({ name: "Heilkraut Reparatur Maske", decisionKey: "mask:x:none", verdict: "passt" }),
    ],
  })
  const brief = cleanBrief()
  brief.hebel.push({ title: "Maske", note: "Heilkraut Reparatur Maske bleibt.", points: 0.5 })
  assert.deepEqual(lintConsultBrief(brief, input), [])
})

test("adversarial: a brief with „repariert“ fails", () => {
  const brief = cleanBrief()
  brief.diagnose += " Die Bond Kur repariert die gebrochenen Längen."
  const findings = lintConsultBrief(brief, nomiInput())
  assert.deepEqual(rules(findings), ["forbidden_phrase"])
  assert.equal(findings[0]!.location, "diagnose")
  assert.equal(findings[0]!.guardrail, "G1")
})

// --- G4 verdicts ---------------------------------------------------------------------------

test("adversarial: a brief that praises the passt-nicht shampoo fails", () => {
  const brief = cleanBrief()
  brief.hebel[1] = {
    title: "Shampoo",
    note: "Das Glanzwerk Volumen Shampoo passt super, einfach behalten.",
    points: 1,
  }
  const findings = lintConsultBrief(brief, nomiInput())
  assert.deepEqual(rules(findings), ["verdict_contradiction"])
  assert.equal(findings[0]!.location, "hebel[1].note")
})

test("keeping a passt-nicht product is allowed only with the verdict named", () => {
  const brief = cleanBrief()
  brief.erwartungen.unshift(
    "Das Volumen Shampoo darf sie aufbrauchen und behalten, bis es leer ist.",
  )
  assert.deepEqual(rules(lintConsultBrief(brief, nomiInput())), ["verdict_contradiction"])

  const named = cleanBrief()
  named.erwartungen.unshift(
    "Das Volumen Shampoo passt nicht; sie kann es aufbrauchen und behalten, bis es leer ist.",
  )
  assert.deepEqual(lintConsultBrief(named, nomiInput()), [])
})

test("a swap reason keyed to a passt-nicht step may not say keep", () => {
  const brief = cleanBrief()
  brief.swapReasons[SHAMPOO_KEY] = "Kann bleiben, reinigt gut."
  assert.deepEqual(rules(lintConsultBrief(brief, nomiInput())), ["verdict_contradiction"])
})

test("the other direction: advising against a passt product fails", () => {
  const brief = cleanBrief()
  brief.hebel.push({ title: "Spülung", note: "Die Repair Spülung weglassen.", points: 0.5 })
  assert.deepEqual(rules(lintConsultBrief(brief, nomiInput())), ["verdict_contradiction"])

  const reason = cleanBrief()
  reason.swapReasons[CONDITIONER_KEY] = "Lieber tauschen, das passt nicht zu ihr."
  assert.deepEqual(rules(lintConsultBrief(reason, nomiInput())), ["verdict_contradiction"])
})

test("a passt product the call already decided to swap may be discussed as a swap", () => {
  const input = nomiInput()
  input.products[0] = { ...input.products[0]!, decision: "swap", bucket: "tauschenOderNeu" }
  const brief = cleanBrief()
  brief.swapReasons[CONDITIONER_KEY] =
    "Sie wollte tauschen; das Sanftwerk Mild Shampoo ist gesetzt."
  assert.deepEqual(lintConsultBrief(brief, input), [])
})

test("amount and placement advice on a passt product is not a contradiction", () => {
  const brief = cleanBrief()
  brief.hebel.push({
    title: "Menge",
    note: "Von der Repair Spülung weniger nehmen und nur in die Längen.",
    points: 0.5,
  })
  assert.deepEqual(lintConsultBrief(brief, nomiInput()), [])
})

// --- G4 invented products -------------------------------------------------------------------

test("adversarial: a brief with an invented product fails", () => {
  const brief = cleanBrief()
  brief.hebel.push({ title: "Bond-Kur", note: "Olaplex No. 3 einmal pro Woche.", points: 1 })
  const findings = lintConsultBrief(brief, nomiInput())
  assert.deepEqual(rules(findings), ["unknown_product"])
  assert.match(findings[0]!.excerpt, /Olaplex/)
})

test("a market brand is fine when it is one of her products or options", () => {
  const input = nomiInput({
    products: [
      ...nomiInput().products,
      product({ name: "Olaplex No. 3 Hair Perfector", decisionKey: "bondbuilder:y:none" }),
    ],
  })
  const brief = cleanBrief()
  brief.hebel.push({ title: "Olaplex", note: "Olaplex No. 3 Hair Perfector bleibt.", points: 1 })
  assert.deepEqual(lintConsultBrief(brief, input), [])
})

test("a swap reason for a step that is not in the input fails", () => {
  const brief = cleanBrief()
  brief.swapReasons["leave_in:post_wash_leave_in:none"] = "Neues Leave-in."
  assert.deepEqual(rules(lintConsultBrief(brief, nomiInput())), ["unknown_swap_key"])
})

test("the market brand list has no common German word in it", () => {
  for (const brand of CONSULT_MARKET_BRANDS) {
    assert.deepEqual(
      lintConsultBrief(
        { ...cleanBrief(), diagnose: "Sie wäscht täglich, föhnt heiß und bürstet nass." },
        nomiInput(),
      ).filter((finding) => finding.excerpt.includes(brand)),
      [],
    )
  }
})

// --- G2 boundary ------------------------------------------------------------------------------

test("adversarial: no ärztlich line despite a hair-loss trigger fails", () => {
  const brief = cleanBrief()
  brief.erwartungen = brief.erwartungen.filter((line) => line !== CONSULT_BOUNDARY_LINE)
  const findings = lintConsultBrief(brief, nomiInput({ boundaryTriggers: ["hair_loss_concern"] }))
  assert.deepEqual(rules(findings), ["boundary_line_missing"])
  assert.match(findings[0]!.detail ?? "", /hair_loss_concern/)
})

test("the boundary line is mandatory in every brief, trigger or not (G2)", () => {
  const brief = cleanBrief()
  brief.erwartungen = brief.erwartungen.filter((line) => line !== CONSULT_BOUNDARY_LINE)
  assert.deepEqual(rules(lintConsultBrief(brief, nomiInput())), ["boundary_line_missing"])
  // A shorter doctor sentence in its own words also counts.
  brief.erwartungen.push("Bei vermehrtem Ausfall mit Wurzel: bitte ärztlich abklären lassen.")
  assert.deepEqual(lintConsultBrief(brief, nomiInput()), [])
})

test("relativizing the boundary fails anywhere in the brief", () => {
  const brief = cleanBrief()
  brief.zielLuecken.push("Der Ausfall ist wahrscheinlich harmlos, erst mal abwarten.")
  const findings = lintConsultBrief(brief, nomiInput())
  assert.ok(findings.length >= 1)
  assert.ok(findings.every((finding) => finding.guardrail === "G2"))
})

// --- score ------------------------------------------------------------------------------------

test("score promises fail; the target is capped at 9", () => {
  const promise = cleanBrief()
  promise.erwartungen.unshift("Mit den drei Hebeln kommst du auf 8, also +4 Punkte.")
  assert.ok(rules(lintConsultBrief(promise, nomiInput())).includes("score_promise"))

  const over = cleanBrief()
  over.hebel[0]!.points = 4
  // 4 + 4 + 1 + 1 = 10 > 9
  assert.deepEqual(rules(lintConsultBrief(over, nomiInput())), ["score_target_cap"])

  // Without a baseline there is nothing to cap.
  assert.deepEqual(lintConsultBrief(over, nomiInput({ baselineScore: null })), [])
})
