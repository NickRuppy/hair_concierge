import assert from "node:assert/strict"
import test from "node:test"

import type { DiscoveryCallSheetBriefSections } from "../src/lib/discovery/call-sheet"
import type { ConsultInput, ConsultProduct } from "../src/lib/discovery/consult-brief/input"
import { CONCERN_RECIPES } from "../src/lib/discovery/concern-recipes"
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
    brand: null,
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
        brand: "Pflegehaus",
        categoryLabel: "Conditioner",
        verdict: "passt",
      }),
      product({
        bucket: "tauschenOderNeu",
        decisionKey: SHAMPOO_KEY,
        name: "Glanzwerk Volumen Shampoo",
        aliases: ["Glanzwerk Volumen Shampoo", "Volumen Shampoo"],
        brand: "Glanzwerk",
        categoryLabel: "Shampoo",
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
    mechanik:
      "Trockene, spröde Längen entstehen meist durch Vorschädigung der Haarstruktur, häufige Hitze und zu wenig Feuchtigkeit.",
    diagnose:
      "Blondiert und gefärbt, dazu zweimal pro Woche Lockenstab: Die Längen sind vorgeschädigt, und die Hitze setzt jede Woche neuen Schaden. Das Glanzwerk Volumen Shampoo passt nicht zu ihren Längen.",
    hebel: [
      {
        title: "Weniger neuer Schaden",
        note: "Lockenstab seltener, nur ins trockene Haar, Hitzeschutz vorher.",
        points: 1.5,
        bucket: "umgang",
      },
      {
        title: "Mildes Shampoo",
        note: "Sanftwerk Mild Shampoo statt Glanzwerk Volumen Shampoo, nur auf die Kopfhaut.",
        points: 1,
        bucket: "produkt",
      },
      {
        title: "Bondbuilder",
        note: "Bindwerk Bond Kur im vorgesehenen Rhythmus.",
        points: 1,
        bucket: "produkt",
      },
    ],
    swapReasons: {
      [SHAMPOO_KEY]:
        "Das jetzige Shampoo passt nicht: Es reinigt kräftig und raut die Längen weiter auf. Das Sanftwerk Mild Shampoo reinigt milder.",
      [CONDITIONER_KEY]: "Die Pflegehaus Repair Spülung passt und bleibt.",
    },
    zielLuecken: [],
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
 * Quotes after „Erlaubt", „Stattdessen", „Ausnahme" or a „Falsch → Richtig" arrow on their line
 * are allowed; the rest are forbidden, except these — named in rules that the phrase lint does
 * not own (G4 verdict words, G5's everyday evidence wording, G1's qualitative score direction,
 * a quoted product name, the G2 längen-only sentence).
 */
const ALLOWED_OUTSIDE_EXEMPT_CLAUSES = new Set([
  "passt nicht",
  "behalten",
  "passt",
  // G4's swap/drop exception names the decisions; they are verdict cues, not banned phrases.
  "tauschen",
  "weglassen",
  // G1b names its recommendation cues; they gate the R22 sentence check, not the phrase list.
  "solltest",
  "täglich anwenden",
  "kann helfen",
  "einen Versuch wert",
  "schauen wir uns an",
  "da ist realistisch Luft nach oben",
  "Repair-Maske",
  "Die Pflege betrifft nur die Längen; der Ausfall gehört ärztlich abgeklärt.",
  "gut untersucht",
  "eher Erfahrungswert aus der Beratung",
  "dazu gibt es kaum Forschung",
])

function guardrailQuotes(): { forbidden: string[]; allowed: string[] } {
  const forbidden: string[] = []
  const allowed: string[] = []
  for (const line of CONSULT_GUARDRAILS_MARKDOWN.split("\n")) {
    const cut = line.search(/Erlaubt|Stattdessen|Ausnahme|→/)
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

/**
 * Known hits in the knowledge base's own wording: phrase-true, kept in the entry (it is a
 * statement for Nick, not brief text). The prompt forbids score figures in the text, so the
 * model must not copy it. Pinned, so a new hit shows up here.
 */
// „expectation-windows" no longer names the 10 (reworded in guardrails v2): no known hits.
const KNOWN_KNOWLEDGE_HITS: Record<string, string[]> = {}

test("the knowledge base's own wording passes the phrase list (known hits pinned)", () => {
  for (const entry of CONSULT_KNOWLEDGE_ENTRIES) {
    const hits = [entry.einsicht, entry.imCall, ...entry.fragen].flatMap((text) =>
      findForbiddenPhrases(text).map((hit) => hit.id),
    )
    assert.deepEqual(hits, KNOWN_KNOWLEDGE_HITS[entry.id] ?? [], entry.id)
  }
  // „Heiligenschein" (frizz halo) is not healing.
  assert.deepEqual(findForbiddenPhrases("Die Haare bilden einen Heiligenschein."), [])
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
  brief.hebel.push({
    title: "Maske",
    note: "Heilkraut Reparatur Maske bleibt.",
    points: 0.5,
    bucket: "produkt",
  })
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
    bucket: "produkt",
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
  brief.hebel.push({
    title: "Spülung",
    note: "Die Repair Spülung weglassen.",
    points: 0.5,
    bucket: "produkt",
  })
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
    bucket: "umgang",
  })
  assert.deepEqual(lintConsultBrief(brief, nomiInput()), [])
})

// --- G4 invented products -------------------------------------------------------------------

test("adversarial: a brief with an invented product fails", () => {
  const brief = cleanBrief()
  brief.hebel.push({
    title: "Bond-Kur",
    note: "Olaplex No. 3 einmal pro Woche.",
    points: 1,
    bucket: "produkt",
  })
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
  brief.hebel.push({
    title: "Olaplex",
    note: "Olaplex No. 3 Hair Perfector bleibt.",
    points: 1,
    bucket: "produkt",
  })
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

test("the boundary line is mandatory in every brief, verbatim, in erwartungen (G2)", () => {
  const brief = cleanBrief()
  brief.erwartungen = brief.erwartungen.filter((line) => line !== CONSULT_BOUNDARY_LINE)
  assert.deepEqual(rules(lintConsultBrief(brief, nomiInput())), ["boundary_line_missing"])
  // Own words no longer count (ruling: deterministic beats judgment).
  const ownWords = cleanBrief()
  ownWords.erwartungen = [
    ownWords.erwartungen[0]!,
    "Bei vermehrtem Ausfall mit Wurzel: bitte ärztlich abklären lassen.",
  ]
  assert.deepEqual(rules(lintConsultBrief(ownWords, nomiInput())), ["boundary_line_missing"])
  // In callFragen it does not satisfy the requirement.
  const asQuestion = cleanBrief()
  asQuestion.erwartungen = asQuestion.erwartungen.filter((line) => line !== CONSULT_BOUNDARY_LINE)
  asQuestion.callFragen.push(CONSULT_BOUNDARY_LINE)
  assert.deepEqual(rules(lintConsultBrief(asQuestion, nomiInput())), ["boundary_line_missing"])
  // Whitespace differences and a lead-in are fine.
  const spaced = cleanBrief()
  spaced.erwartungen[1] = `Grenze:  ${CONSULT_BOUNDARY_LINE.replace(/ /g, "\n ")}`
  assert.deepEqual(lintConsultBrief(spaced, nomiInput()), [])
})

test("adversarial: a negated doctor sentence fails anywhere", () => {
  for (const line of [
    "Das muss nicht ärztlich abgeklärt werden.",
    "Kein Grund, das ärztlich anschauen zu lassen.",
    "Ärztlich ist das nicht nötig.",
  ]) {
    const brief = cleanBrief()
    brief.mechanik += ` ${line}`
    const findings = lintConsultBrief(brief, nomiInput())
    assert.ok(
      findings.some((finding) => finding.detail === "boundary_negated"),
      `${line}: ${JSON.stringify(findings)}`,
    )
  }
})

test("relativizing the boundary fails anywhere in the brief", () => {
  const brief = cleanBrief()
  brief.mechanik += " Der Ausfall ist wahrscheinlich harmlos, erst mal abwarten."
  const findings = lintConsultBrief(brief, nomiInput())
  assert.ok(findings.length >= 1)
  assert.ok(findings.every((finding) => finding.guardrail === "G2"))
})

// --- score ------------------------------------------------------------------------------------

test("score promises in the text fail; the sum is the display's business, not the lint's", () => {
  const promise = cleanBrief()
  promise.erwartungen.unshift("Mit den drei Hebeln kommst du auf 8, also +4 Punkte.")
  assert.ok(rules(lintConsultBrief(promise, nomiInput())).includes("score_promise"))

  // Points may sum past the cap: the score ladder caps the DISPLAY at 9 (runsheetScoreSteps),
  // the model's per-lever estimates stay untouched.
  const over = cleanBrief()
  over.hebel[0]!.points = 4
  assert.deepEqual(lintConsultBrief(over, nomiInput()), [])
})

// --- fix round 1: reviewer bypasses (each MUST flag) ---------------------------------------------

function flagsVerdict(extra: string, where: "diagnose" | "erwartung" = "diagnose") {
  const brief = cleanBrief()
  if (where === "diagnose") brief.diagnose += ` ${extra}`
  else brief.erwartungen.unshift(extra)
  return rules(lintConsultBrief(brief, nomiInput())).includes("verdict_contradiction")
}

test("G4 bypasses: whole sentence, bare passt, category and brand aliases, per-product exemption", () => {
  for (const sentence of [
    // (a) the keep cue sits in another comma clause of a one-product sentence
    "Das Volumen Shampoo, das sie seit Jahren nutzt, kann bleiben.",
    // (b) new cues
    "Das Glanzwerk Volumen Shampoo passt.",
    "Das Glanzwerk Volumen Shampoo ist geeignet.",
    "Das Glanzwerk Volumen Shampoo kann sie weiterbenutzen.",
    // (c) category label and brand + name token
    "Ihr Shampoo passt super.",
    "Das Glanzwerk Shampoo passt super.",
    "Glanzwerk ist top für sie.",
    // (d) a verdict named for another product does not exempt this one
    "Die Repair Spülung passt nicht, das Volumen Shampoo bleibt.",
  ]) {
    assert.ok(flagsVerdict(sentence), sentence)
  }
  for (const sentence of [
    "Die Repair Spülung rausnehmen.",
    "Die Repair Spülung streichen.",
    "Die Repair Spülung braucht sie nicht.",
    "Ihr Conditioner kann weg, lass ihn weg.",
  ]) {
    assert.ok(flagsVerdict(sentence), sentence)
  }
})

test("G4: the per-product rules keep their clean cases clean", () => {
  for (const sentence of [
    "Das Sanftwerk Mild Shampoo passt besser.",
    "Das Volumen Shampoo passt nicht zu ihr.",
    "Die Repair Spülung bleibt, das Volumen Shampoo tauschen.",
    "Das Volumen Shampoo ist nicht geeignet.",
  ]) {
    assert.equal(flagsVerdict(sentence), false, sentence)
  }
})

test("G1 inflections and compounds", () => {
  for (const sentence of [
    "Die Haarreparatur beginnt sofort.",
    "Das lässt die Spitzen ausheilen.",
    "Eine heilende Wirkung auf die Längen.",
    "Die Regeneration der Längen.",
    "Mit Garantie glatter.",
  ]) {
    assert.ok(findForbiddenPhrases(sentence).length > 0, sentence)
  }
})

test("G1b: brands and recommendation language fire; bare factual mentions pass (R22 v3)", () => {
  for (const sentence of [
    "Ein Vitaminpräparat nehmen.",
    "Regaine auf die Kopfhaut.",
    "Pantovigar als Kur.",
    "Priorin für drei Monate.",
  ]) {
    assert.ok(
      findForbiddenPhrases(sentence).some((hit) => hit.guardrail === "G1b"),
      sentence,
    )
  }
  for (const sentence of [
    "Ein Nahrungsergänzungsmittel hilft dagegen nicht.",
    "Haarvitamine dazu sind kaum untersucht.",
    "Der Biotinkomplex unterstützt wenig.",
    "Finasterid kann helfen.",
  ]) {
    assert.deepEqual(
      findForbiddenPhrases(sentence).filter((hit) => hit.guardrail === "G1b"),
      [],
      sentence,
    )
  }
})

test("score promises: score near a digit, points better, a target of 10", () => {
  for (const sentence of [
    "Der Score liegt danach bei 7.",
    "Sie kann sich um 2 Punkte verbessern.",
    "Das macht zwei Punkte besser.",
    "Ziel ist eine 10.",
  ]) {
    assert.ok(
      findForbiddenPhrases(sentence).some((hit) => hit.rule === "score_promise"),
      sentence,
    )
  }
  assert.deepEqual(findForbiddenPhrases("Ziel ist, die Längen geschmeidiger zu machen."), [])
  assert.deepEqual(findForbiddenPhrases("Kämmbarkeit stabil in 2–4 Wochen."), [])
})

test("normalization: soft hyphens, zero-width characters, decomposed umlauts, folded brands", () => {
  assert.ok(findForbiddenPhrases("Die Kur repa\u00adriert die Längen.").length > 0)
  assert.ok(findForbiddenPhrases("Die Kur re\u200bpariert die Längen.").length > 0)
  assert.ok(findForbiddenPhrases("Das stellt die Struktur wieder her.".normalize("NFD")).length > 0)
  for (const brand of ["Kerastase", "L'Oreal", "L’Oréal"]) {
    const brief = cleanBrief()
    brief.hebel.push({
      title: "Kur",
      note: `${brand} Maske einmal pro Woche.`,
      points: 0.5,
      bucket: "produkt",
    })
    assert.deepEqual(rules(lintConsultBrief(brief, nomiInput())), ["unknown_product"], brand)
  }
})

// --- fix round 2: vocabulary gaps (each MUST flag) ------------------------------------------------

test("round 2 G4 vocabulary: funktioniert gut, weiterhin verwenden, rausschmeißen", () => {
  for (const sentence of [
    "Das Glanzwerk Volumen Shampoo funktioniert gut.",
    "Das Volumen Shampoo funktioniert super für sie.",
    "Das Volumen Shampoo kann sie weiterhin verwenden.",
    "Das Volumen Shampoo weiterhin nutzen.",
    "Die Repair Spülung rausschmeißen.",
    "Die Repair Spülung weglassen.",
  ]) {
    assert.ok(flagsVerdict(sentence), sentence)
  }
})

test("round 2 score: a spelled-out number near Score or Ziel", () => {
  for (const sentence of ["Der Score nähert sich der Acht.", "Ziel ist eher eine Neun."]) {
    assert.ok(
      findForbiddenPhrases(sentence).some((hit) => hit.rule === "score_promise"),
      sentence,
    )
  }
  assert.deepEqual(findForbiddenPhrases("Sie soll auf die Spitzen achten."), [])
})

test("round 2 G2: negated dermatologist / examination phrasings", () => {
  for (const sentence of [
    "Ein Termin beim Hautarzt ist hier nicht nötig.",
    "Kein Anlass, das untersuchen zu lassen.",
  ]) {
    assert.ok(
      findForbiddenPhrases(sentence).some((hit) => hit.id === "boundary_negated"),
      sentence,
    )
  }
  assert.deepEqual(findForbiddenPhrases("Das sollte man beim Hautarzt untersuchen lassen."), [])
})

/**
 * The concern-recipe excerpt that reaches the prompt (`input.ts` `mainConcernExcerpt`): label,
 * meaning, talking point, primary categories' why, levers, avoid, call questions, boundary.
 * These hits are phrase-true negations and „avoid" quotes — acceptable as background (prompt
 * rule 8: never copied), pinned so a new hit shows up here.
 */
const KNOWN_RECIPE_HITS: Record<string, string[]> = {
  frizz_flyaways: ["frizz_free"],
  low_shine: ["as_new"],
  // R22 v3: the avoid-line „Nahrungsergänzungsmittel gegen Längenschäden" is a bare factual
  // mention now — no longer a hit.
  hair_damage: ["heal", "heal", "repair", "heal", "as_new"],
  hair_loss_or_thinning: ["against_loss", "that_is_surely"],
  split_ends: ["repair", "seal_split_ends"],
  tangling: ["repair"],
}

test("the recipe excerpt's own wording: known hits pinned", () => {
  const hits: Record<string, string[]> = {}
  for (const recipe of CONCERN_RECIPES) {
    const texts = [
      recipe.labelDe,
      recipe.meaningDe,
      recipe.talkingPointDe,
      ...recipe.primary.categories.map((entry) => entry.why),
      ...recipe.primary.levers.map((entry) => entry.lever),
      ...recipe.avoid,
      ...recipe.callQuestionsDe,
      ...(recipe.boundary ? [recipe.boundary] : []),
    ]
    const found = texts.flatMap((text) => findForbiddenPhrases(text).map((hit) => hit.id))
    if (found.length > 0) hits[recipe.code] = found
  }
  assert.deepEqual(hits, KNOWN_RECIPE_HITS)
})

// --- T5 eval false positive: „passt … nicht" window -------------------------------------------------

test("„passt dafür nicht“ is a negation: the T5 oily-overwash sentence passes", () => {
  const base = nomiInput()
  const input = nomiInput({
    products: [
      ...base.products,
      product({
        bucket: "tauschenOderNeu",
        decisionKey: "shampoo:x:none",
        name: "Frischkraft Tiefenrein Shampoo",
        brand: "Frischkraft",
        categoryLabel: "Shampoo",
        verdict: "passt_nicht",
      }),
    ],
  })
  const brief = cleanBrief()
  brief.diagnose +=
    " Die tägliche Wäsche passt grundsätzlich zu ihrer Kopfhaut; das Frischkraft Tiefenrein Shampoo passt dafür nicht."
  assert.deepEqual(lintConsultBrief(brief, input), [])
  for (const sentence of [
    "Das Volumen Shampoo passt hier nicht.",
    "Das Volumen Shampoo passt so leider nicht.",
  ]) {
    assert.equal(flagsVerdict(sentence), false, sentence)
  }
})

test("the negation window never weakens praise for a passt-nicht product", () => {
  for (const sentence of [
    "Das Volumen Shampoo passt — nicht ohne Grund.",
    "Das Volumen Shampoo passt gut und nicht zu schwer.",
    "Das Volumen Shampoo passt nicht nur gut, sondern super.",
    "Das Volumen Shampoo passt, nicht wahr?",
  ]) {
    assert.ok(flagsVerdict(sentence), sentence)
  }
})

test("T5 eval round 2: a wide negation window and praise for another subject", () => {
  for (const sentence of [
    "Das Volumen Shampoo passt bei feinem Haar ebenfalls nicht als erster Schritt.",
    "Für die Längen passt ein milderer Ansatz besser: Das Volumen Shampoo passt nicht, das Sanftwerk Mild Shampoo ist der passendere Versuch.",
    // The exact T5 nomi sentence shape: the category word inside a compound is no mention.
    "Für die Kopfhaut passt ein milderer Shampoo-Ansatz besser: Glanzwerk Volumen Shampoo passt nicht, Sanftwerk Mild Shampoo ist zunächst der passendere Versuch.",
  ]) {
    assert.equal(flagsVerdict(sentence), false, sentence)
  }
  // Without the stated verdict the whole sentence still counts (fix round 1a).
  assert.ok(flagsVerdict("Für die Längen passt es super: Das Volumen Shampoo bleibt."))
  assert.ok(flagsVerdict("Das Volumen Shampoo, das sie seit Jahren nutzt, kann bleiben."))
})

// --- re-review of the T5 loosenings: three holes (each MUST flag) ----------------------------------

test("a brand-hyphen compound names the product; a category-word compound does not", () => {
  const base = nomiInput()
  const input = nomiInput({
    products: [
      ...base.products,
      product({
        bucket: "tauschenOderNeu",
        decisionKey: "shampoo:x:none",
        name: "Frischkraft Tiefenrein Shampoo",
        brand: "Frischkraft",
        categoryLabel: "Shampoo",
        verdict: "passt_nicht",
      }),
    ],
  })
  for (const sentence of [
    "Das Frischkraft-Shampoo passt super.",
    "Das Glanzwerk-Shampoo passt super.",
  ]) {
    const brief = cleanBrief()
    brief.diagnose += ` ${sentence}`
    assert.ok(rules(lintConsultBrief(brief, input)).includes("verdict_contradiction"), sentence)
  }
  // „Shampoo-Ansatz" prose is still no mention of her (only) shampoo.
  assert.equal(flagsVerdict("Ein milderer Shampoo-Ansatz passt besser."), false)
})

test("negation idioms: „passt nicht selten/zuletzt/ohne …“ is praise", () => {
  for (const sentence of [
    "Das Volumen Shampoo passt nicht selten richtig gut.",
    "Das Volumen Shampoo passt nicht zuletzt wegen des Dufts.",
    "Das Volumen Shampoo passt nicht ohne Grund.",
    "Das Volumen Shampoo passt nicht nur gut, sondern super.",
  ]) {
    assert.ok(flagsVerdict(sentence), sentence)
  }
})

test("one product, verdict stated: praise in a following clause still flags", () => {
  for (const sentence of [
    "Das Volumen Shampoo passt nicht, ist aber trotzdem ideal für den Alltag.",
    "Das Volumen Shampoo passt nicht, aber wirklich perfekt für unterwegs.",
  ]) {
    assert.ok(flagsVerdict(sentence), sentence)
  }
})

// --- R22: medical options named, never recommended (G1b v2) ----------------------------------------

function phraseIds(text: string): string[] {
  return findForbiddenPhrases(text).map((hit) => hit.id)
}

test("R22: a factual medical mention with a doctor handoff in the same sentence passes", () => {
  for (const sentence of [
    "Gegen Haarausfall gibt es ärztliche Wirkstoffe, die nur wirken, solange man sie anwendet — ob so etwas für sie passt, gehört in ärztliche Hand.",
    "Es gibt ärztliche Optionen wie Minoxidil; ob das für sie passt, klärt die Ärztin.",
    "Nahrungsergänzung wie Biotin gehört in die ärztliche Abklärung, nicht in den Pflegeplan.",
    "Ob Zink oder Eisen fehlt, klärt die Hausärztin über ein Blutbild.",
    "Kortison und medizinisches Ketoconazol sind Sache der Dermatologin.",
    "Finasterid ist ein ärztlicher Wirkstoff, keine Pflege.",
    "Ob ein Nahrungsergänzungsmittel sinnvoll ist, gehört in ärztliche Hand.",
    "Haarausfall stoppen können nur ärztliche Wirkstoffe, und die gehören in dermatologische Hand.",
  ]) {
    assert.deepEqual(phraseIds(sentence), [], sentence)
  }
})

test("R22 v3: bare factual mentions pass; loss claims need medical framing", () => {
  // A substance named factually passes even without a doctor in the sentence (Nick 2026-09-29).
  for (const sentence of [
    "Minoxidil stoppt den Haarausfall.",
    "Minoxidil stoppt den Haarausfall nicht.",
    "Zink hilft den Haaren kaum.",
    "Eine Kortisonlösung ist Sache der Behandlung.",
    "Finasterid kann helfen.",
    "Minoxidil hilft nicht.",
    "Es gibt Wirkstoffe wie Minoxidil und Finasterid.",
  ]) {
    assert.deepEqual(phraseIds(sentence), [], sentence)
  }
  // Loss claims stay G1 promises unless the sentence is medically framed (doctor or drug).
  const cases: Array<[string, string]> = [
    ["against_loss", "Pflege hilft nicht gegen Haarausfall."],
    ["against_loss", "Biotin wirkt nicht gegen Haarausfall."],
    ["against_loss", "Das Serum wirkt gegen Haarausfall."],
    ["stop_loss", "Diese Kur stoppt den Haarausfall."],
    ["root", "Biotin stärkt die Wurzel."],
  ]
  for (const [id, sentence] of cases) {
    assert.ok(phraseIds(sentence).includes(id), `${id}: ${sentence} → ${phraseIds(sentence)}`)
  }
  // …and biotin itself is no medical framing, but also no finding on its own here.
  assert.ok(!phraseIds("Biotin wirkt nicht gegen Haarausfall.").includes("biotin"))
})

test("R22: a recommendation, dose, percent or brand fails even with a doctor token", () => {
  const cases: Array<[string, string]> = [
    ["minoxidil", "Probier Minoxidil, das empfehlen auch Ärzte."],
    ["percent", "2 % Minoxidil, ärztlich empfohlen."],
    ["minoxidil", "2 % Minoxidil, ärztlich empfohlen."],
    ["hair_loss_brands", "Regaine hilft, sagt auch die Ärztin."],
    ["dose", "Biotin 5 mg täglich, sagt die Hautärztin."],
    ["dose", "Ärztlich abgeklärt: 10 mg Zink."],
    ["biotin", "Nimm Biotin, das rät auch die Ärztin."],
    ["biotin", "Die Ärztin empfiehlt Biotin."],
    ["minoxidil", "Kauf Minoxidil in der Apotheke, dann zur Ärztin."],
    ["minoxidil", "Starte mit Minoxidil, ärztlich begleitet."],
    ["iron", "Fang mit Eisentabletten an, die Ärztin prüft später."],
    ["iron", "Besorg dir Eisen, sagt der Hausarzt."],
    ["biotin", "Versuch es mit Biotin, bevor du zum Arzt gehst."],
    // Cosmetic and medical never in one sentence (G6): a care product with a handoff still fails.
    ["against_loss", "Das Shampoo wirkt gegen Haarausfall, sagt die Hautärztin."],
    ["biotin", "Ein Biotin-Shampoo, ärztlich geprüft."],
    // A negated handoff is no handoff.
    ["minoxidil", "Minoxidil geht auch ohne Arzt."],
    ["biotin", "Biotin statt zur Hautärztin."],
    ["zinc", "Für Zink ist kein Arzttermin nötig."],
  ]
  for (const [id, sentence] of cases) {
    assert.ok(phraseIds(sentence).includes(id), `${id}: ${sentence} → ${phraseIds(sentence)}`)
  }
})

test("R22 adversarial: a loss claim's medical framing must sit in the SAME sentence", () => {
  for (const text of [
    "Die Routine stoppt den Haarausfall. Minoxidil wäre ein Wirkstoff.",
    "Die Ärztin weiß mehr; die Spülung wirkt gegen Haarausfall.",
  ]) {
    assert.ok(
      findForbiddenPhrases(text).some(
        (hit) =>
          hit.rule === "forbidden_phrase" && (hit.id === "stop_loss" || hit.id === "against_loss"),
      ),
      text,
    )
  }
  // Bare mentions in neighboring sentences are fine now.
  assert.deepEqual(phraseIds("Minoxidil hilft vielen. Das gehört ärztlich abgeklärt."), [])
})

test("R22 adversarial: call questions naming a substance pass with and without a handoff", () => {
  const brief = cleanBrief()
  brief.callFragen.push("Warst du damit schon mal beim Hautarzt, z. B. wegen Minoxidil?")
  assert.deepEqual(lintConsultBrief(brief, nomiInput()), [])
  const bare = cleanBrief()
  bare.callFragen.push("Nimmst du schon was, z. B. Minoxidil?")
  assert.deepEqual(lintConsultBrief(bare, nomiInput()), [])
})

test("R22 in a full brief: the allowed sentences add no finding, the boundary rule stays intact", () => {
  const brief = cleanBrief()
  brief.mechanik +=
    " Gegen Haarausfall gibt es ärztliche Wirkstoffe, die nur wirken, solange man sie anwendet — ob so etwas für sie passt, gehört in ärztliche Hand." +
    " Es gibt ärztliche Optionen wie Minoxidil; ob das für sie passt, klärt die Ärztin." +
    " Nahrungsergänzung wie Biotin gehört in die ärztliche Abklärung, nicht in den Pflegeplan."
  assert.deepEqual(lintConsultBrief(brief, nomiInput()), [])
  // boundary_negated still catches a softened handoff next to a drug mention.
  const softened = cleanBrief()
  softened.mechanik += " Minoxidil geht auch ohne Arzt, ärztlich ist das nicht nötig."
  const details = lintConsultBrief(softened, nomiInput()).map((finding) => finding.detail)
  assert.ok(details.includes("boundary_negated"), JSON.stringify(details))
})

test("R22 regression: soft-hyphen and zero-width evasion is still caught in a forbidden context", () => {
  assert.ok(phraseIds("Probier Mino­xidil.").includes("minoxidil"))
  assert.ok(phraseIds("Nimm Bio​tin.").includes("biotin"))
  // …and a soft hyphen inside the drug token does not break a loss claim's medical framing.
  assert.deepEqual(phraseIds("Mino­xidil stoppt den Haarausfall, sagt die Ärz­tin."), [])
})

test("R22: „Ziel ist 8“ is a score figure; „geschwärzt“ is no doctor token for loss claims", () => {
  assert.ok(phraseIds("Ziel ist 8.").includes("score_figure"))
  assert.ok(
    phraseIds("Die Pflege wirkt gegen Haarausfall, die Stelle ist geschwärzt.").includes(
      "against_loss",
    ),
  )
})

test("R22 hardening (Codex F1): advice and schedule wording is a recommendation, invisible marks are stripped", () => {
  // The doctor handoff does not excuse an application instruction.
  assert.ok(
    phraseIds("Minoxidil solltest du täglich anwenden, sprich mit deiner Ärztin.").includes(
      "minoxidil",
    ),
  )
  assert.ok(phraseIds("Minoxidil am besten abends, sagt auch die Ärztin.").includes("minoxidil"))
  assert.ok(phraseIds("Wende Minoxidil morgens an; ärztlich begleitet.").includes("minoxidil"))
  // U+200E / U+2063 injected into the drug name still match in a forbidden context.
  assert.ok(phraseIds("Probier Mino‎xidil.").includes("minoxidil"))
  assert.ok(phraseIds("Probier Mino⁣xidil.").includes("minoxidil"))
  // „Wende dich an deine Hautärztin" is the handoff itself, not an application instruction.
  assert.deepEqual(phraseIds("Wende dich mit dem Thema Minoxidil an deine Hautärztin."), [])
})

// --- v4: mechanik is linted, stored zielLuecken is not ------------------------------------------

test("v4: mechanik is linted like any prose section", () => {
  const brief = cleanBrief()
  brief.mechanik += " Die Bond Kur repariert die gebrochenen Längen."
  const findings = lintConsultBrief(brief, nomiInput())
  assert.deepEqual(rules(findings), ["forbidden_phrase"])
  assert.equal(findings[0]!.location, "mechanik")
})

test("v4: legacy zielLuecken lines on a stored brief are no longer linted", () => {
  const brief = cleanBrief()
  brief.zielLuecken = ["Die Bond Kur repariert die gebrochenen Längen."]
  assert.deepEqual(lintConsultBrief(brief, nomiInput()), [])
})
