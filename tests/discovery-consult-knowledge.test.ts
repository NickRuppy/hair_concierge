import assert from "node:assert/strict"
import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import test from "node:test"

import {
  CONSULT_FLAG_RELIABILITY,
  CONSULT_FLAGS,
  CONSULT_KNOWLEDGE_ENTRIES,
  CONSULT_KNOWLEDGE_MERGES,
  CONSULT_KNOWLEDGE_PRECEDENCE,
  UNSOURCED_CONSULT_FLAGS,
  deriveConsultFlags,
  evaluateConsultConditions,
  parseConsultKnowledgeEntry,
  selectConsultKnowledge,
  type ConsultFlag,
  type ConsultFlagFacts,
  type ConsultFlagReliability,
} from "../src/lib/discovery/consult-brief/knowledge"
import {
  CONSULT_GUARDRAILS_MARKDOWN,
  CONSULT_KNOWLEDGE_ENTRY_SOURCES,
} from "../src/lib/discovery/consult-brief/knowledge-sources"

/**
 * The consult knowledge base as the brief generator reads it (consult-agent T2): the typed
 * mirror of `docs/research/consult-knowledge/`, the CNF condition semantics, the flag
 * derivation from profile/intake/plan, and the README's generator rules (question first,
 * stronger variant wins, overlaps merged).
 */

const KNOWLEDGE_DIR = path.join(process.cwd(), "docs/research/consult-knowledge")

// --- mirror + contract ------------------------------------------------------------------

test("the mirror equals docs/research/consult-knowledge (entries + guardrails), byte for byte", () => {
  const files = readdirSync(path.join(KNOWLEDGE_DIR, "entries"))
    .filter((file) => file.endsWith(".md"))
    .sort()
  assert.deepEqual(Object.keys(CONSULT_KNOWLEDGE_ENTRY_SOURCES).sort(), files)
  for (const file of files) {
    assert.equal(
      CONSULT_KNOWLEDGE_ENTRY_SOURCES[file],
      readFileSync(path.join(KNOWLEDGE_DIR, "entries", file), "utf8"),
      `${file} drifted — copy the doc into knowledge-sources.ts`,
    )
  }
  assert.equal(
    CONSULT_GUARDRAILS_MARKDOWN,
    readFileSync(path.join(KNOWLEDGE_DIR, "guardrails.md"), "utf8"),
    "guardrails.md drifted — copy the doc into knowledge-sources.ts",
  )
})

test("the flag vocabulary and its reliability equal the README table", () => {
  const readme = readFileSync(path.join(KNOWLEDGE_DIR, "README.md"), "utf8")
  const rows = [...readme.matchAll(/^\| `([a-z_]+)`\s*\|[^|]*\|[^|]*\|\s*(hoch|niedrig)/gm)]
  const table = Object.fromEntries(rows.map((row) => [row[1], row[2]]))
  assert.deepEqual(Object.keys(table).sort(), [...CONSULT_FLAGS].sort())
  assert.deepEqual(table, { ...CONSULT_FLAG_RELIABILITY })
})

test("every entry parses: 11 entries, id = file name, sections present, only known flags", () => {
  assert.equal(CONSULT_KNOWLEDGE_ENTRIES.length, 11)
  for (const entry of CONSULT_KNOWLEDGE_ENTRIES) {
    assert.ok(CONSULT_KNOWLEDGE_ENTRY_SOURCES[`${entry.id}.md`], entry.id)
    assert.ok(entry.einsicht.length > 0, `${entry.id}: Einsicht`)
    assert.ok(entry.imCall.length > 0, `${entry.id}: Im Call`)
    assert.ok(!entry.imCall.includes("> "), `${entry.id}: blockquote markers stripped`)
    for (const element of entry.conditions) {
      for (const flag of Array.isArray(element) ? element : [element]) {
        assert.ok((CONSULT_FLAGS as readonly string[]).includes(flag), `${entry.id}: ${flag}`)
      }
    }
  }
  const heavy = CONSULT_KNOWLEDGE_ENTRIES.find(
    (entry) => entry.id === "heavy-care-paradox-fine-hair",
  )
  assert.deepEqual(heavy?.conditions, [
    "fine_hair",
    "volume_concern",
    ["mask_in_routine", "oil_on_wet"],
  ])
  assert.equal(heavy?.fragen.length, 4)
  const expectations = CONSULT_KNOWLEDGE_ENTRIES.find((entry) => entry.id === "expectation-windows")
  assert.deepEqual(expectations?.conditions, [])
  assert.deepEqual(expectations?.fragen, [])
})

test("invalid frontmatter is an error, never silently skipped", () => {
  const valid = CONSULT_KNOWLEDGE_ENTRY_SOURCES["ask-detangling.md"]!
  assert.throws(() => parseConsultKnowledgeEntry("other-name.md", valid), /id/)
  assert.throws(
    () =>
      parseConsultKnowledgeEntry("ask-detangling.md", valid.replace("evidence: moderate\n", "")),
    /frontmatter/,
  )
  assert.throws(
    () =>
      parseConsultKnowledgeEntry(
        "ask-detangling.md",
        valid.replace("evidence: moderate", "evidence: moderate\nsource: x"),
      ),
    /frontmatter/,
  )
  assert.throws(
    () =>
      parseConsultKnowledgeEntry(
        "ask-detangling.md",
        valid.replace("[breakage_signal]", "[unknown_flag]"),
      ),
    /unknown_flag/,
  )
  assert.throws(
    () =>
      parseConsultKnowledgeEntry(
        "ask-detangling.md",
        valid.replace("[breakage_signal]", "[[[breakage_signal]]]"),
      ),
    /one level/,
  )
  assert.throws(
    () => parseConsultKnowledgeEntry("ask-detangling.md", valid.replace("## Im Call", "## Anders")),
    /Im Call/,
  )
  assert.throws(
    () =>
      parseConsultKnowledgeEntry(
        "ask-detangling.md",
        valid.replace("category: question", "category: tip"),
      ),
    /category/,
  )
})

// --- CNF conditions ---------------------------------------------------------------------

function flags(entries: Array<[ConsultFlag, ConsultFlagReliability]>) {
  return new Map(entries)
}

test("conditions are CNF: top level AND, nested list OR, empty list always", () => {
  const set = flags([
    ["fine_hair", "hoch"],
    ["volume_concern", "hoch"],
    ["mask_in_routine", "niedrig"],
  ])
  assert.equal(evaluateConsultConditions([], set).fires, true)
  assert.equal(evaluateConsultConditions(["fine_hair"], set).fires, true)
  assert.equal(evaluateConsultConditions(["fine_hair", "colored"], set).fires, false)
  assert.equal(evaluateConsultConditions([["colored", "fine_hair"]], set).fires, true)
  assert.equal(
    evaluateConsultConditions(
      ["fine_hair", "volume_concern", ["mask_in_routine", "oil_on_wet"]],
      set,
    ).fires,
    true,
  )
  // Unknown values do not match: a coarse-hair participant with a mask stays silent.
  const coarse = flags([
    ["volume_concern", "hoch"],
    ["mask_in_routine", "niedrig"],
  ])
  assert.equal(
    evaluateConsultConditions(
      ["fine_hair", "volume_concern", ["mask_in_routine", "oil_on_wet"]],
      coarse,
    ).fires,
    false,
  )
})

test("question first: an AND element that is niedrig, or an OR group met only by niedrig flags", () => {
  const onlyHigh = flags([
    ["colored", "hoch"],
    ["hot_tool", "hoch"],
  ])
  assert.equal(evaluateConsultConditions(["colored", "hot_tool"], onlyHigh).questionFirst, false)
  assert.equal(evaluateConsultConditions([], onlyHigh).questionFirst, false)

  const lowInGroup = flags([
    ["fine_hair", "hoch"],
    ["oil_in_routine", "niedrig"],
  ])
  assert.equal(
    evaluateConsultConditions(["fine_hair", ["oil_in_routine", "oil_on_wet"]], lowInGroup)
      .questionFirst,
    true,
  )
  const lowAnd = flags([["mask_in_routine", "niedrig"]])
  assert.equal(evaluateConsultConditions(["mask_in_routine"], lowAnd).questionFirst, true)
  // A group also met by a hoch flag is not question-first.
  const mixedGroup = flags([
    ["bleached", "hoch"],
    ["colored", "niedrig"],
  ])
  assert.equal(
    evaluateConsultConditions([["bleached", "colored"]], mixedGroup).questionFirst,
    false,
  )
})

// --- flag derivation --------------------------------------------------------------------

const NO_FACTS: ConsultFlagFacts = {
  chemicalTreatments: null,
  thickness: null,
  scalpConcerns: null,
  intakeHeatTools: null,
  profileHeatTools: null,
  ownedCategories: [],
  planCategories: [],
  elasticity: null,
  concerns: [],
  washFrequency: { current: null, ideal: null },
}

function derived(facts: Partial<ConsultFlagFacts>) {
  return Object.fromEntries(deriveConsultFlags({ ...NO_FACTS, ...facts }))
}

test("unknown facts derive no flag", () => {
  assert.deepEqual(derived({}), {})
})

test("treatments in every stored vocabulary; fine hair from thickness", () => {
  assert.deepEqual(derived({ chemicalTreatments: ["lightened", "colored"], thickness: "fine" }), {
    bleached: "hoch",
    colored: "hoch",
    fine_hair: "hoch",
  })
  assert.deepEqual(
    derived({ chemicalTreatments: ["bleached", "permed", "chemically_straightened"] }),
    {
      bleached: "hoch",
      permed: "hoch",
      chemically_straightened: "hoch",
    },
  )
  assert.deepEqual(derived({ chemicalTreatments: ["blondiert", "gefaerbt"] }), {
    bleached: "hoch",
    colored: "hoch",
  })
  assert.deepEqual(derived({ thickness: "coarse", chemicalTreatments: ["natural"] }), {})
})

test("dry_scalp_dry_flakes only from the dry-flakes scalp condition, never from a dry scalp type", () => {
  assert.deepEqual(derived({ scalpConcerns: ["dry_dandruff"] }), { dry_scalp_dry_flakes: "hoch" })
  assert.deepEqual(derived({ scalpConcerns: ["dry_flakes"] }), { dry_scalp_dry_flakes: "hoch" })
  assert.deepEqual(derived({ scalpConcerns: ["oily_dandruff", "irritated"] }), {})
})

test("hot_tool: straightener / curling or wave iron — never the dryer; intake answers win", () => {
  assert.deepEqual(derived({ intakeHeatTools: ["straightener"] }), { hot_tool: "hoch" })
  assert.deepEqual(derived({ intakeHeatTools: ["curling_or_wave_iron"] }), { hot_tool: "hoch" })
  assert.deepEqual(derived({ intakeHeatTools: ["flat_iron"] }), { hot_tool: "hoch" })
  assert.deepEqual(derived({ intakeHeatTools: ["dryer_brush", "hot_air_styler"] }), {})
  // Not asked in the intake: the profile's heat events decide.
  assert.deepEqual(derived({ profileHeatTools: ["curling_iron"] }), { hot_tool: "hoch" })
  assert.deepEqual(derived({ profileHeatTools: ["hair_dryer"] }), {})
  // Asked and answered „keine" beats an older profile.
  assert.deepEqual(derived({ intakeHeatTools: [], profileHeatTools: ["straightener"] }), {})
})

test("routine flags from her captured categories; bond care from routine or plan", () => {
  assert.deepEqual(derived({ ownedCategories: ["mask", "oil"] }), {
    mask_in_routine: "niedrig",
    oil_in_routine: "niedrig",
  })
  assert.deepEqual(derived({ ownedCategories: ["bondbuilder"] }), { protein_or_bond_care: "hoch" })
  assert.deepEqual(derived({ planCategories: ["bondbuilder"] }), { protein_or_bond_care: "hoch" })
  assert.deepEqual(derived({ planCategories: ["mask"] }), {})
})

test("concern flags: breakage signal, volume, hold", () => {
  assert.deepEqual(derived({ elasticity: "snaps" }), { breakage_signal: "hoch" })
  assert.deepEqual(derived({ concerns: ["hair_damage"] }), { breakage_signal: "hoch" })
  assert.deepEqual(derived({ concerns: ["breakage"] }), { breakage_signal: "hoch" })
  assert.deepEqual(derived({ concerns: ["low_volume_or_weighed_down"] }), {
    volume_concern: "hoch",
  })
  assert.deepEqual(derived({ concerns: ["lost_shape"] }), { styling_goal_hold: "hoch" })
  assert.deepEqual(derived({ elasticity: "stretches_bounces", concerns: ["dry_lengths"] }), {})
})

test("wash_frequency_change: current and ideal both known and different", () => {
  assert.deepEqual(derived({ washFrequency: { current: "daily_1x", ideal: "weekly_3_4x" } }), {
    wash_frequency_change: "hoch",
  })
  assert.deepEqual(derived({ washFrequency: { current: "weekly_2x", ideal: "weekly_2x" } }), {})
  assert.deepEqual(derived({ washFrequency: { current: null, ideal: "weekly_2x" } }), {})
  assert.deepEqual(derived({ washFrequency: { current: "unknown", ideal: "weekly_2x" } }), {})
})

test("flags without a structured source are listed and never derived", () => {
  assert.deepEqual([...UNSOURCED_CONSULT_FLAGS], ["oil_on_wet"])
  const everything = derived({
    chemicalTreatments: ["lightened", "colored", "permed", "chemically_straightened"],
    thickness: "fine",
    scalpConcerns: ["dry_dandruff"],
    intakeHeatTools: ["straightener"],
    ownedCategories: ["mask", "oil", "bondbuilder"],
    elasticity: "snaps",
    concerns: ["low_volume_or_weighed_down", "lost_shape"],
    washFrequency: { current: "daily_1x", ideal: "weekly_2x" },
  })
  assert.equal("oil_on_wet" in everything, false)
  assert.deepEqual(
    Object.keys(everything).sort(),
    CONSULT_FLAGS.filter((flag) => !UNSOURCED_CONSULT_FLAGS.includes(flag)).sort(),
  )
})

// --- selection --------------------------------------------------------------------------

function selectedIds(entries: Array<[ConsultFlag, ConsultFlagReliability]>) {
  return selectConsultKnowledge(flags(entries)).map((entry) => entry.id)
}

test("the always-relevant entry fires for everyone; evidence never leaves the selection", () => {
  const selected = selectConsultKnowledge(new Map())
  assert.deepEqual(
    selected.map((entry) => entry.id),
    ["expectation-windows"],
  )
  assert.equal("evidence" in selected[0]!, false)
  assert.equal(selected[0]!.questionFirst, false)
})

test("ongoing-damage-first beats heat-on-colored-hair when both fire", () => {
  const ids = selectedIds([
    ["bleached", "hoch"],
    ["colored", "hoch"],
    ["hot_tool", "hoch"],
  ])
  assert.ok(ids.includes("ongoing-damage-first"))
  assert.ok(!ids.includes("heat-on-colored-hair"))
  // Colored only: the softer variant stays.
  const coloredOnly = selectedIds([
    ["colored", "hoch"],
    ["hot_tool", "hoch"],
  ])
  assert.ok(coloredOnly.includes("heat-on-colored-hair"))
  assert.ok(!coloredOnly.includes("ongoing-damage-first"))
})

test("heavy-care and oil-as-finish fold into one point, with a reference", () => {
  const selected = selectConsultKnowledge(
    flags([
      ["fine_hair", "hoch"],
      ["volume_concern", "hoch"],
      ["mask_in_routine", "niedrig"],
      ["oil_in_routine", "niedrig"],
    ]),
  )
  const ids = selected.map((entry) => entry.id)
  assert.ok(ids.includes("heavy-care-paradox-fine-hair"))
  assert.ok(!ids.includes("oil-as-finish"))
  const heavy = selected.find((entry) => entry.id === "heavy-care-paradox-fine-hair")!
  assert.deepEqual(heavy.mergedFrom, ["oil-as-finish"])
  assert.equal(heavy.questionFirst, true)
  // Oil alone (no volume concern): oil-as-finish stays, question first.
  const oilOnly = selectConsultKnowledge(
    flags([
      ["fine_hair", "hoch"],
      ["oil_in_routine", "niedrig"],
    ]),
  )
  const oil = oilOnly.find((entry) => entry.id === "oil-as-finish")
  assert.equal(oil?.questionFirst, true)
  assert.deepEqual(oil?.mergedFrom, [])
})

test("the precedence and merge rules name real entries", () => {
  const ids = new Set(CONSULT_KNOWLEDGE_ENTRIES.map((entry) => entry.id))
  for (const rule of CONSULT_KNOWLEDGE_PRECEDENCE) {
    assert.ok(ids.has(rule.winner) && ids.has(rule.loser))
  }
  for (const rule of CONSULT_KNOWLEDGE_MERGES) {
    assert.ok(ids.has(rule.keep) && ids.has(rule.fold))
  }
})

test("the Nomi constellation: bleached + colored + hot tool + breakage", () => {
  const ids = selectedIds([
    ["bleached", "hoch"],
    ["colored", "hoch"],
    ["hot_tool", "hoch"],
    ["breakage_signal", "hoch"],
  ])
  assert.deepEqual(ids, [
    "ask-bleach-cadence",
    "ask-detangling",
    "expectation-windows",
    "ongoing-damage-first",
  ])
})
