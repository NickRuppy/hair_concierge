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

test("every entry parses: 24 entries, id = file name, sections present, only known flags", () => {
  assert.equal(CONSULT_KNOWLEDGE_ENTRIES.length, 24)
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
        valid.replace("[[breakage_signal, tangling_concern]]", "[unknown_flag]"),
      ),
    /unknown_flag/,
  )
  assert.throws(
    () =>
      parseConsultKnowledgeEntry(
        "ask-detangling.md",
        valid.replace("[[breakage_signal, tangling_concern]]", "[[[breakage_signal]]]"),
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
  hairTexture: null,
  thickness: null,
  scalpType: null,
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
  assert.deepEqual(derived({ scalpType: "dry" }), {})
})

test("scalp flags: oily scalp type, oily flakes, irritated — each only from its own value", () => {
  assert.deepEqual(derived({ scalpType: "oily" }), { oily_scalp: "hoch" })
  assert.deepEqual(derived({ scalpType: "balanced" }), {})
  assert.deepEqual(derived({ scalpConcerns: ["oily_dandruff"] }), { oily_scalp_flakes: "hoch" })
  assert.deepEqual(derived({ scalpConcerns: ["irritated"] }), { irritated_scalp: "hoch" })
  // hair_profiles `dandruff` does not say which kind of flakes: no flake flag either way.
  assert.deepEqual(derived({ scalpConcerns: ["dandruff"] }), {})
  // Oily flakes do not imply an oily scalp type, and vice versa.
  assert.deepEqual(derived({ scalpType: "oily", scalpConcerns: [] }), { oily_scalp: "hoch" })
  assert.deepEqual(derived({ scalpConcerns: ["oily_dandruff", "dry_dandruff", "irritated"] }), {
    oily_scalp_flakes: "hoch",
    dry_scalp_dry_flakes: "hoch",
    irritated_scalp: "hoch",
  })
})

test("texture flags: curly or coily, wavy — straight and unknown stay silent", () => {
  assert.deepEqual(derived({ hairTexture: "curly" }), { curly_or_coily: "hoch" })
  assert.deepEqual(derived({ hairTexture: "coily" }), { curly_or_coily: "hoch" })
  assert.deepEqual(derived({ hairTexture: "wavy" }), { wavy_hair: "hoch" })
  assert.deepEqual(derived({ hairTexture: "straight" }), {})
  assert.deepEqual(derived({ hairTexture: null }), {})
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
  assert.deepEqual(derived({ elasticity: "stretches_bounces", concerns: ["split_ends"] }), {})
})

test("concern flags: frizz, shine, dry lengths, tangling", () => {
  assert.deepEqual(derived({ concerns: ["frizz_flyaways"] }), { frizz_concern: "hoch" })
  assert.deepEqual(derived({ concerns: ["low_shine"] }), { shine_concern: "hoch" })
  assert.deepEqual(derived({ concerns: ["dry_lengths"] }), { dry_lengths_concern: "hoch" })
  assert.deepEqual(derived({ concerns: ["tangling"] }), { tangling_concern: "hoch" })
  assert.deepEqual(derived({ concerns: ["hair_loss_or_thinning", "lost_shape"] }), {
    styling_goal_hold: "hoch",
  })
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
    scalpType: "oily",
    scalpConcerns: ["dry_dandruff", "oily_dandruff", "irritated"],
    intakeHeatTools: ["straightener"],
    ownedCategories: ["mask", "oil", "bondbuilder"],
    elasticity: "snaps",
    concerns: [
      "low_volume_or_weighed_down",
      "lost_shape",
      "frizz_flyaways",
      "low_shine",
      "dry_lengths",
      "tangling",
    ],
    washFrequency: { current: "daily_1x", ideal: "weekly_2x" },
  })
  assert.equal("oil_on_wet" in everything, false)
  // Texture is one value: curly and wavy never hold together.
  const textured = (hairTexture: string) => Object.keys(derived({ hairTexture }))
  assert.deepEqual(
    [...Object.keys(everything), ...textured("curly"), ...textured("wavy")].sort(),
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
  // fine + volume also fires fine-hair-buildup-layering, which folds in as well.
  assert.deepEqual(heavy.mergedFrom, ["oil-as-finish", "fine-hair-buildup-layering"])
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
    "color-fade-honesty",
    "expectation-windows",
    "ongoing-damage-first",
  ])
})

// --- seeding batch 2026-09-29 (R25) -------------------------------------------------------

test("ask-detangling fires on a breakage signal OR a tangling concern", () => {
  const detangling = CONSULT_KNOWLEDGE_ENTRIES.find((entry) => entry.id === "ask-detangling")
  assert.deepEqual(detangling?.conditions, [["breakage_signal", "tangling_concern"]])
  assert.ok(selectedIds([["tangling_concern", "hoch"]]).includes("ask-detangling"))
  assert.ok(selectedIds([["breakage_signal", "hoch"]]).includes("ask-detangling"))
  assert.ok(!selectedIds([["frizz_concern", "hoch"]]).includes("ask-detangling"))
})

test("each new flag fires its seeded entry; without it the entry stays silent", () => {
  const cases: Array<[ConsultFlag[], string]> = [
    [["oily_scalp"], "oily-scalp-wash-cadence"],
    [["oily_scalp", "dry_lengths_concern"], "oily-roots-dry-lengths"],
    [["oily_scalp_flakes"], "oily-flakes-antidandruff"],
    [["irritated_scalp"], "irritated-scalp-phrasing"],
    [["frizz_concern"], "frizz-mechanism"],
    [["frizz_concern"], "ask-frizz-or-breakage"],
    [["shine_concern"], "shine-surface-reflection"],
    [["dry_lengths_concern"], "dry-lengths-softness"],
    [["curly_or_coily"], "curly-coily-care-basics"],
    [["wavy_hair", "frizz_concern"], "wavy-hair-weight-and-handling"],
    [["colored", "oily_scalp"], "colored-oily-scalp-tradeoff"],
    [["colored"], "color-fade-honesty"],
    [["fine_hair", "volume_concern"], "fine-hair-buildup-layering"],
  ]
  for (const [held, id] of cases) {
    assert.ok(
      selectedIds(held.map((flag) => [flag, "hoch"])).includes(id),
      `${id} fires on ${held.join(" + ")}`,
    )
    // Drop any one required flag: silent.
    for (const missing of held) {
      const rest = held.filter((flag) => flag !== missing)
      assert.ok(
        !selectedIds(rest.map((flag) => [flag, "hoch"])).includes(id),
        `${id} silent without ${missing}`,
      )
    }
  }
  // Wavy alone (no frizz, volume or hold concern) stays silent; straight hair never fires it.
  assert.ok(!selectedIds([["wavy_hair", "hoch"]]).includes("wavy-hair-weight-and-handling"))
})

test("dry-lengths-softness folds into oily-roots-dry-lengths when both fire", () => {
  const selected = selectConsultKnowledge(
    flags([
      ["oily_scalp", "hoch"],
      ["dry_lengths_concern", "hoch"],
    ]),
  )
  const ids = selected.map((entry) => entry.id)
  assert.ok(ids.includes("oily-roots-dry-lengths"))
  assert.ok(!ids.includes("dry-lengths-softness"))
  const kept = selected.find((entry) => entry.id === "oily-roots-dry-lengths")!
  assert.deepEqual(kept.mergedFrom, ["dry-lengths-softness"])
  // Oily roots through another group member (bleached): nothing to fold, no reference.
  const bleached = selectConsultKnowledge(
    flags([
      ["oily_scalp", "hoch"],
      ["bleached", "hoch"],
    ]),
  )
  assert.deepEqual(bleached.find((entry) => entry.id === "oily-roots-dry-lengths")?.mergedFrom, [])
  // Dry lengths without an oily scalp: dry-lengths-softness stays on its own.
  const dryOnly = selectConsultKnowledge(flags([["dry_lengths_concern", "hoch"]]))
  assert.deepEqual(dryOnly.find((entry) => entry.id === "dry-lengths-softness")?.mergedFrom, [])
  assert.ok(!dryOnly.some((entry) => entry.id === "oily-roots-dry-lengths"))
})

test("fine-hair-buildup-layering folds into heavy-care-paradox-fine-hair when both fire", () => {
  const selected = selectConsultKnowledge(
    flags([
      ["fine_hair", "hoch"],
      ["volume_concern", "hoch"],
      ["mask_in_routine", "niedrig"],
    ]),
  )
  const ids = selected.map((entry) => entry.id)
  assert.ok(ids.includes("heavy-care-paradox-fine-hair"))
  assert.ok(!ids.includes("fine-hair-buildup-layering"))
  const heavy = selected.find((entry) => entry.id === "heavy-care-paradox-fine-hair")!
  assert.deepEqual(heavy.mergedFrom, ["fine-hair-buildup-layering"])
  // With oil as well: both fold into the one point.
  const withOil = selectConsultKnowledge(
    flags([
      ["fine_hair", "hoch"],
      ["volume_concern", "hoch"],
      ["mask_in_routine", "niedrig"],
      ["oil_in_routine", "niedrig"],
    ]),
  )
  assert.deepEqual(
    withOil.find((entry) => entry.id === "heavy-care-paradox-fine-hair")?.mergedFrom,
    ["oil-as-finish", "fine-hair-buildup-layering"],
  )
  // No mask (heavy-care silent): the layering entry fires on its own, no reference.
  const noMask = selectConsultKnowledge(
    flags([
      ["fine_hair", "hoch"],
      ["volume_concern", "hoch"],
    ]),
  )
  assert.ok(!noMask.some((entry) => entry.id === "heavy-care-paradox-fine-hair"))
  assert.deepEqual(
    noMask.find((entry) => entry.id === "fine-hair-buildup-layering")?.mergedFrom,
    [],
  )
})

test("the two frizz entries stay two points (deliberately not merged)", () => {
  const selected = selectConsultKnowledge(flags([["frizz_concern", "hoch"]]))
  const ids = selected.map((entry) => entry.id)
  assert.ok(ids.includes("frizz-mechanism"))
  assert.ok(ids.includes("ask-frizz-or-breakage"))
  for (const entry of selected) assert.deepEqual(entry.mergedFrom, [])
  for (const rule of [...CONSULT_KNOWLEDGE_MERGES, ...CONSULT_KNOWLEDGE_PRECEDENCE]) {
    const pair = Object.values(rule)
    assert.ok(!(pair.includes("frizz-mechanism") && pair.includes("ask-frizz-or-breakage")))
  }
})
