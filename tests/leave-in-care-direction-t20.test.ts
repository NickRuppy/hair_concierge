import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import test from "node:test"

import {
  deriveLeaveInCareDirectionT20,
  type T20Input,
  type T20Species,
  type T20SpeciesClass,
} from "../src/lib/leave-in-research/care-direction-t20"

const RECORDS_PATH = path.resolve(
  "data/research/leave-in-inci/v1.1/corpus/t20-rederived/t20-care-direction-records.json",
)
const GOLD_PACKET = path.resolve(
  "data/research/leave-in-inci/v1.0/corpus/gold-set/calibration-packet.json",
)
const UNSEEN_PACKET = path.resolve(
  "data/research/leave-in-inci/v1.0/corpus/unseen-test/unseen-packet.json",
)

const s = (rank: number, inci: string, speciesClass: T20SpeciesClass): T20Species => ({
  rank,
  inci,
  speciesClass,
})

const plain = (speciesAboveTail: T20Species[], overrides: Partial<T20Input> = {}): T20Input => ({
  proteinAnchor: false,
  markerStatus: "plausible",
  speciesAboveTail,
  ...overrides,
})

// ---------------------------------------------------------------------------
// Red-proof cases: each one is a product v1.0 §9 called `moisture`.
// ---------------------------------------------------------------------------

test("T20 red proof: a glycol-only product is not moisture", () => {
  // v1.0 counted any L4 species above the tail as a leg -> moisture.
  const result = deriveLeaveInCareDirectionT20(
    plain([
      s(2, "PROPANEDIOL", "multifunctional_glycol"),
      s(3, "BUTYLENE GLYCOL", "multifunctional_glycol"),
      s(4, "ROSMARINUS OFFICINALIS LEAF EXTRACT", "other"),
    ]),
  )
  assert.notEqual(result.value, "moisture")
  assert.equal(result.value, "balanced")
  assert.equal(result.row, "conditioning_only_neutral")
  assert.equal(result.o6Confidence, "low", "a read resting on a glycol demotion is never moderate")
  assert.deepEqual(result.reviewTriggers, ["glycol_only_leg"])
  assert.deepEqual(
    result.demotedSpecies.map((item) => item.inci),
    ["PROPANEDIOL", "BUTYLENE GLYCOL"],
  )
})

test("T20 red proof: a film that outranks the humectant makes the product balanced", () => {
  const result = deriveLeaveInCareDirectionT20(
    plain([
      s(2, "DIMETHICONE", "persistent_film"),
      s(3, "AMODIMETHICONE", "persistent_film"),
      s(5, "GLYCERIN", "settled_humectant"),
    ]),
  )
  assert.equal(result.value, "balanced")
  assert.equal(result.row, "film_leads_moisture_leg")
  assert.equal(result.filmLeadMargin, 3)
  assert.equal(result.o6Confidence, "moderate")
  assert.deepEqual(result.reviewTriggers, [])
})

test("T20 red proof: dry-feel esters, volatiles and cationics never create a moisture leg", () => {
  // Olaplex No.6 shape: v1.0 read the esters and the glycol as legs.
  const result = deriveLeaveInCareDirectionT20(
    plain([
      s(2, "CETEARYL ALCOHOL", "fatty_alcohol"),
      s(3, "DIMETHICONE", "persistent_film"),
      s(4, "ISOHEXADECANE", "volatile_carrier"),
      s(5, "COCO-CAPRYLATE", "dry_feel_ester"),
      s(7, "BEHENTRIMONIUM CHLORIDE", "cationic"),
      s(10, "PROPANEDIOL", "multifunctional_glycol"),
    ]),
  )
  assert.equal(result.value, "balanced")
  assert.equal(result.row, "film_led_neutral")
  assert.equal(result.o6Confidence, "moderate", "the glycol ranks behind the film lead")
})

// ---------------------------------------------------------------------------
// The rest of the rule
// ---------------------------------------------------------------------------

test("a directional species that leads the film stays moisture", () => {
  const result = deriveLeaveInCareDirectionT20(
    plain([
      s(2, "HELIANTHUS ANNUUS SEED OIL", "medium_rich_lipid"),
      s(4, "GLYCERIN", "settled_humectant"),
      s(9, "PHENYL TRIMETHICONE", "persistent_film"),
    ]),
  )
  assert.equal(result.value, "moisture")
  assert.equal(result.row, "moisture_led")
  assert.equal(result.o6Confidence, null, "O5 keeps the v1.0 confidence rules")
})

test("O6: an adjacent-rank film lead is low and routes to review", () => {
  const result = deriveLeaveInCareDirectionT20(
    plain([
      s(3, "DIMETHICONE", "persistent_film"),
      s(4, "PRUNUS ARMENIACA KERNEL OIL", "medium_rich_lipid"),
    ]),
  )
  assert.equal(result.value, "balanced")
  assert.equal(result.filmLeadMargin, 1)
  assert.equal(result.o6Confidence, "low")
  assert.deepEqual(result.reviewTriggers, ["moisture_leg_subordinate"])
})

test("O6: glycols that outrank the film make a film-led read low with glycol review", () => {
  // Neqi shape.
  const result = deriveLeaveInCareDirectionT20(
    plain([
      s(2, "DIPROPYLENE GLYCOL", "multifunctional_glycol"),
      s(6, "PENTYLENE GLYCOL", "multifunctional_glycol"),
      s(7, "POLYSILICONE-29", "persistent_film"),
    ]),
  )
  assert.equal(result.value, "balanced")
  assert.equal(result.row, "film_led_neutral")
  assert.equal(result.o6Confidence, "low")
  assert.deepEqual(result.reviewTriggers, ["glycol_only_leg"])
})

test("O6: an unreliable marker steps every O3/O4 balanced down to low", () => {
  for (const markerStatus of ["implausible", "vacuous", "none_visible"] as const) {
    const neutral = deriveLeaveInCareDirectionT20(
      plain([s(2, "DIMETHICONE", "persistent_film")], { markerStatus }),
    )
    assert.equal(neutral.o6Confidence, "low", markerStatus)
    const subordinate = deriveLeaveInCareDirectionT20(
      plain([s(2, "DIMETHICONE", "persistent_film"), s(6, "GLYCERIN", "settled_humectant")], {
        markerStatus,
      }),
    )
    assert.equal(subordinate.o6Confidence, "low", markerStatus)
    assert.deepEqual(subordinate.reviewTriggers, ["moisture_leg_subordinate"], markerStatus)
  }
})

test("cationic conditioning alone is directional neutrality, not moisture", () => {
  const result = deriveLeaveInCareDirectionT20(
    plain([s(2, "CETEARYL ALCOHOL", "fatty_alcohol"), s(3, "BEHENTRIMONIUM CHLORIDE", "cationic")]),
  )
  assert.equal(result.value, "balanced")
  assert.equal(result.row, "conditioning_only_neutral")
  assert.equal(result.o6Confidence, "moderate")
})

test("no readable care architecture stays an evidence failure", () => {
  const result = deriveLeaveInCareDirectionT20(
    plain([s(2, "ALCOHOL DENAT.", "other"), s(3, "CYCLOPENTASILOXANE", "volatile_carrier")]),
  )
  assert.equal(result.value, "unknown")
  assert.equal(result.row, "evidence_failure")
})

test("the protein anchor decides first; a directional leg beside it is substantive mixed", () => {
  const protein = deriveLeaveInCareDirectionT20(
    plain(
      [s(4, "AMODIMETHICONE", "persistent_film"), s(8, "ISOPROPYL MYRISTATE", "dry_feel_ester")],
      {
        proteinAnchor: true,
      },
    ),
  )
  assert.equal(protein.value, "protein")
  assert.equal(protein.row, "protein_anchor")

  const mixed = deriveLeaveInCareDirectionT20(
    plain([s(3, "GLYCERIN", "settled_humectant")], { proteinAnchor: true }),
  )
  assert.equal(mixed.value, "balanced")
  assert.equal(mixed.row, "substantive_mixed")
})

// ---------------------------------------------------------------------------
// The T20 corpus records are reproduced by the rule, on the frozen INCI.
// ---------------------------------------------------------------------------

type T20Record = {
  slot: number | string
  live_catalog: boolean
  tail_marker: {
    ingredient: string | null
    rank: number | null
    marker_status: T20Input["markerStatus"]
  }
  protein_anchor: boolean
  species_above_tail: T20Species[]
  care_direction: {
    value: string
    confidence: "low" | "moderate"
    o6_confidence: "low" | "moderate" | null
    row: string
    film_lead_margin: number | null
    changed: boolean
    note: string
    mandatory_counter_signal?: string
    routes_to_review: boolean
    review_triggers: string[]
    superseded_reading?: string
  }
}

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T
}

const records = readJson<{ records: T20Record[] }>(RECORDS_PATH).records
const packetEntries = [
  ...readJson<{ entries: Array<{ slot: number | string; normalized_ingredients: string[] }> }>(
    GOLD_PACKET,
  ).entries,
  ...readJson<{ entries: Array<{ slot: number | string; normalized_ingredients: string[] }> }>(
    UNSEEN_PACKET,
  ).entries,
]

test("every T20 record covers the 15 in-category corpus records exactly once", () => {
  assert.deepEqual(records.map((record) => String(record.slot)).sort(), [
    "1",
    "10",
    "11",
    "13",
    "2",
    "3",
    "4",
    "5",
    "6",
    "8",
    "9",
    "u1",
    "u4",
    "u5",
    "u6",
  ])
})

test("every classified species matches the frozen INCI at its rank, and sits above the marker", () => {
  for (const record of records) {
    const entry = packetEntries.find((candidate) => String(candidate.slot) === String(record.slot))
    assert.ok(entry, `slot ${record.slot}: no frozen packet entry`)
    if (record.tail_marker.rank !== null) {
      assert.equal(
        entry.normalized_ingredients[record.tail_marker.rank - 1],
        record.tail_marker.ingredient,
        `slot ${record.slot}: tail marker`,
      )
    }
    for (const species of record.species_above_tail) {
      assert.equal(
        entry.normalized_ingredients[species.rank - 1],
        species.inci,
        `slot ${record.slot} r${species.rank}`,
      )
      if (record.tail_marker.rank !== null && record.tail_marker.marker_status !== "implausible") {
        assert.ok(
          species.rank < record.tail_marker.rank,
          `slot ${record.slot} r${species.rank} above the tail`,
        )
      }
    }
  }
})

test("the T20 rule reproduces every record's value, row, margin and O6 confidence", () => {
  for (const record of records) {
    const result = deriveLeaveInCareDirectionT20({
      proteinAnchor: record.protein_anchor,
      markerStatus: record.tail_marker.marker_status,
      speciesAboveTail: record.species_above_tail,
    })
    const recorded = record.care_direction
    assert.equal(result.value, recorded.value, `slot ${record.slot}: value`)
    assert.equal(result.row, recorded.row, `slot ${record.slot}: row`)
    assert.equal(result.filmLeadMargin, recorded.film_lead_margin, `slot ${record.slot}: margin`)
    assert.equal(result.o6Confidence, recorded.o6_confidence, `slot ${record.slot}: O6 confidence`)
    if (recorded.o6_confidence === "low") {
      assert.equal(recorded.confidence, "low", `slot ${record.slot}: a record may not exceed O6`)
    }
    for (const trigger of result.reviewTriggers) {
      assert.ok(
        recorded.review_triggers.includes(trigger),
        `slot ${record.slot}: trigger ${trigger}`,
      )
    }
    assert.equal(
      recorded.routes_to_review,
      recorded.review_triggers.length > 0,
      `slot ${record.slot}: routing flag matches the triggers`,
    )
    assert.ok(recorded.note.length > 0, `slot ${record.slot}: every value carries reasoning`)
  }
})

test("exactly the four ruled flips move, each with counter-signal and superseded reading", () => {
  const changed = records.filter((record) => record.care_direction.changed)
  assert.deepEqual(changed.map((record) => String(record.slot)).sort(), ["10", "13", "8", "u1"])
  for (const record of changed) {
    assert.equal(record.care_direction.value, "balanced", `slot ${record.slot}`)
    assert.match(record.care_direction.superseded_reading ?? "", /value `moisture`/)
    assert.ok(
      (record.care_direction.mandatory_counter_signal ?? "").length > 0,
      `slot ${record.slot}: mandatory counter-signal`,
    )
  }
  // Low-confidence flips keep their review markers (Nick, 2026-09-29).
  const bySlot = new Map(records.map((record) => [String(record.slot), record.care_direction]))
  assert.equal(bySlot.get("8")?.confidence, "low")
  assert.deepEqual(bySlot.get("8")?.review_triggers, ["moisture_leg_subordinate"])
  assert.equal(bySlot.get("13")?.confidence, "low")
  assert.deepEqual(bySlot.get("13")?.review_triggers, ["glycol_only_leg"])
  assert.equal(bySlot.get("u1")?.confidence, "low")
  assert.equal(bySlot.get("10")?.confidence, "moderate")
  assert.equal(bySlot.get("10")?.routes_to_review, false)
})

test("the anchors hold: EVO balanced, Redken protein, ISANA and alverde 7in1 moisture", () => {
  const value = (slot: string) =>
    records.find((record) => String(record.slot) === slot)?.care_direction.value
  assert.equal(value("5"), "balanced")
  assert.equal(value("9"), "protein")
  assert.equal(value("2"), "moisture")
  assert.equal(value("1"), "moisture")
})

test("§9-O6: every O3/O4 balanced record carries its mandatory counter-signal, flips or not", () => {
  const o3o4Rows = new Set([
    "film_leads_moisture_leg",
    "film_led_neutral",
    "conditioning_only_neutral",
  ])
  const balanced = records.filter(
    (record) =>
      record.care_direction.value === "balanced" && o3o4Rows.has(record.care_direction.row),
  )
  // EVO (unchanged O4) plus the four flips.
  assert.deepEqual(balanced.map((record) => String(record.slot)).sort(), [
    "10",
    "13",
    "5",
    "8",
    "u1",
  ])
  for (const record of balanced) {
    const signal = record.care_direction.mandatory_counter_signal ?? ""
    assert.ok(signal.trim().length > 0, `slot ${record.slot}: mandatory counter-signal`)
    assert.match(signal, /Marker:/, `slot ${record.slot}: names the marker`)
    assert.match(
      signal,
      /Film species:|Directional species/,
      `slot ${record.slot}: names the species`,
    )
  }
})
