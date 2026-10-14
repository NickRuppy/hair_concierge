import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import test from "node:test"

import {
  maskFormulaFingerprintSha256,
  projectMaskForProduction,
  type MaskProductionAdapterOutcome,
} from "../src/lib/mask-research/production-adapter"

const DATA_DIR = path.resolve("data/research/mask-inci/v1.0")
const ENVELOPE_DIR = path.join(DATA_DIR, "calibration-envelopes")
const EXPECTED_PATH = path.join(DATA_DIR, "calibration-expected-projections.json")
const KEY_DIR = path.join(DATA_DIR, "reference-key-v1")

type ExpectedFile = {
  adapter_version: string
  not_built: Record<string, string>
  projections: Record<string, MaskProductionAdapterOutcome>
}

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T
}

const envelopeFiles = readdirSync(ENVELOPE_DIR)
  .filter((file) => file.endsWith(".json"))
  .sort()

/**
 * Expected app-side values for the twelve approved reference-key-v1 records,
 * derived by hand from each record's approved profile with the adapter rules
 * (weight map, D1 concentration twin, D6 balance direction, D2 focus benefits +
 * the 2026-10-07 moisture_softness care chip, the thickness echo), independently of the adapter code.
 */
const READY = {
  "02-gliss-7sekunden-express-repair": {
    weight: "medium",
    concentration: "medium",
    balance_direction: "moisture",
    repair_support_level: "high",
    functional_benefits: ["detangling_slip", "moisture_softness"],
    suitable_thicknesses: ["fine", "normal", "coarse"],
  },
  "03-bali-curls-sos-protein-treatment": {
    weight: "rich",
    concentration: "high",
    balance_direction: "moisture",
    repair_support_level: "low",
    functional_benefits: ["detangling_slip", "moisture_softness"],
    suitable_thicknesses: ["normal", "coarse"],
  },
  "04-gliss-liquid-silk-4in1": {
    weight: "medium",
    concentration: "high",
    balance_direction: "protein",
    ingredient_flags: ["silicones", "oils", "proteins", "humectants"],
    repair_support_level: "high",
    functional_benefits: ["detangling_slip"],
    suitable_thicknesses: ["fine", "normal", "coarse"],
  },
  "06-monday-smooth-anti-frizz": {
    weight: "rich",
    concentration: "medium",
    balance_direction: "moisture",
    repair_support_level: "low",
    functional_benefits: ["smoothing_frizz_control", "detangling_slip", "moisture_softness"],
    suitable_thicknesses: ["normal", "coarse"],
  },
  "07-pantene-molecular-bond-repair": {
    weight: "medium",
    concentration: "medium",
    balance_direction: "moisture",
    repair_support_level: "low",
    functional_benefits: ["smoothing_frizz_control", "detangling_slip", "moisture_softness"],
    suitable_thicknesses: ["fine", "normal", "coarse"],
  },
  "08-sante-intense-hydration": {
    weight: "light",
    concentration: "medium",
    balance_direction: "balanced",
    repair_support_level: "medium",
    functional_benefits: ["detangling_slip", "moisture_softness"],
    suitable_thicknesses: ["fine", "normal"],
  },
  "09-balea-professional-aqua-hyaluron": {
    weight: "medium",
    concentration: "medium",
    balance_direction: "moisture",
    repair_support_level: "low",
    functional_benefits: ["detangling_slip", "moisture_softness"],
    suitable_thicknesses: ["fine", "normal", "coarse"],
  },
  "10-bali-curls-deep-repair-mask": {
    weight: "rich",
    concentration: "high",
    balance_direction: "moisture",
    repair_support_level: "low",
    functional_benefits: ["detangling_slip", "moisture_softness"],
    suitable_thicknesses: ["normal", "coarse"],
  },
  "12-guhl-panthenol-reparatur-2in1": {
    weight: "light",
    concentration: "medium",
    balance_direction: "moisture",
    repair_support_level: "low",
    functional_benefits: ["detangling_slip", "moisture_softness"],
    suitable_thicknesses: ["fine", "normal"],
  },
} as const

/** Approved records the fail-closed gates must refuse or route, with the gate that fires. */
const REFUSED = {
  "01-hask-argan-oil-sachet": ["needs_research", /provisional_identity_conflict/],
  "11-elvital-glycolic-gloss": ["needs_research", /provisional_formula_conflict/],
  "13-olaplex-no3-hair-perfector": [
    "routed_out_of_scope",
    /excluded_pre_shampoo_bondbuilder_protocol/,
  ],
  "u5-olaplex-no3plus-prewash": [
    "routed_out_of_scope",
    /excluded_pre_shampoo_bondbuilder_protocol/,
  ],
  "u6-balea-silberglanz-2in1": ["routed_out_of_scope", /excluded_color_depositing/],
  "q3-syoss-intense-repair": ["needs_research", /insufficient_information — G0 evidence stop/],
} as const

test("the calibration corpus covers every approved record plus the G0 refuse/stop records", () => {
  const expected = readJson<ExpectedFile>(EXPECTED_PATH)
  assert.equal(expected.adapter_version, "mask-production-adapter-v1")
  const ids = envelopeFiles.map((file) => file.replace(/\.json$/, ""))
  assert.deepEqual(ids, [...Object.keys(READY), ...Object.keys(REFUSED)].sort())
  assert.deepEqual(Object.keys(expected.projections).sort(), envelopeFiles)
  // #05 is discontinued and calibration-only: it is deliberately not an envelope.
  assert.deepEqual(Object.keys(expected.not_built), ["05-isana-mandelmilch-3in1"])

  const keyIds = readdirSync(KEY_DIR)
    .filter((file) => /^\d\d-.*\.json$/.test(file))
    .map((file) => file.replace(/\.json$/, ""))
  assert.equal(keyIds.length, 13)
  for (const id of keyIds) {
    assert.ok(
      ids.includes(id) || id in expected.not_built,
      `${id}: every reference-key record is an envelope or a documented not-built entry`,
    )
  }
})

test("every in-category approved record projects the hand-derived app values", () => {
  for (const [id, values] of Object.entries(READY)) {
    const envelope = readJson<unknown>(path.join(ENVELOPE_DIR, `${id}.json`))
    const before = JSON.stringify(envelope)
    const outcome = projectMaskForProduction(envelope)
    assert.equal(JSON.stringify(envelope), before, `${id}: the envelope must not be mutated`)
    assert.equal(
      outcome.status,
      "projection_ready",
      `${id}: ${outcome.status === "projection_ready" ? "" : outcome.reasons.join("; ")}`,
    )
    if (outcome.status !== "projection_ready") continue
    const specs = outcome.productionProjection.category_specs.product_mask_specs
    const { suitable_thicknesses: thicknesses, ...specValues } = values
    for (const [field, value] of Object.entries(specValues)) {
      assert.deepEqual(specs[field as keyof typeof specs], value, `${id}: ${field}`)
    }
    assert.deepEqual(outcome.productionProjection.suitable_thicknesses, thicknesses, id)
    assert.deepEqual(outcome.requiredProtocolRoles, ["intensive_conditioning_mask"], id)
  }
})

test("the fail-closed gates refuse or route every record that must not reach the catalog", () => {
  for (const [id, [status, reason]] of Object.entries(REFUSED)) {
    const outcome: MaskProductionAdapterOutcome = projectMaskForProduction(
      readJson(path.join(ENVELOPE_DIR, `${id}.json`)),
    )
    if (outcome.status === "projection_ready") {
      assert.fail(`${id}: must not project`)
    }
    assert.equal(outcome.status, status, id)
    assert.match(outcome.reasons.join(" "), reason, id)
  }
})

test("every calibration envelope matches the frozen expectation byte for byte", () => {
  const expected = readJson<ExpectedFile>(EXPECTED_PATH)
  for (const file of envelopeFiles) {
    const outcome = projectMaskForProduction(readJson(path.join(ENVELOPE_DIR, file)))
    assert.deepEqual(outcome, expected.projections[file], `${file}: projection drifted`)
  }
})

test("the in-category envelopes carry the reference key's frozen formula identity", () => {
  for (const id of [
    ...Object.keys(READY),
    "01-hask-argan-oil-sachet",
    "11-elvital-glycolic-gloss",
  ]) {
    const key = readJson<{ identity: { rawInciSha256: string } }>(path.join(KEY_DIR, `${id}.json`))
    const envelope = readJson<{
      formula: { rawInci: string; rawInciSha256: string; formulaFingerprintSha256: string }
    }>(path.join(ENVELOPE_DIR, `${id}.json`))
    assert.equal(
      createHash("sha256").update(envelope.formula.rawInci).digest("hex"),
      key.identity.rawInciSha256,
      `${id}: raw INCI must be the key's formula of record`,
    )
    assert.equal(
      maskFormulaFingerprintSha256(envelope.formula.rawInci),
      envelope.formula.formulaFingerprintSha256,
      `${id}: fingerprint`,
    )
  }
})

test("no research confidence, evidence level or counter-signal leaks into a projected column", () => {
  const expected = readJson<ExpectedFile>(EXPECTED_PATH)
  for (const [file, outcome] of Object.entries(expected.projections)) {
    if (outcome.status !== "projection_ready") continue
    const projected = JSON.stringify({
      suitable_thicknesses: outcome.productionProjection.suitable_thicknesses,
      category_specs: outcome.productionProjection.category_specs,
    })
    assert.doesNotMatch(projected, /confidence|\bE[0-5]\b|counter|uncertain/i, file)
  }
})
