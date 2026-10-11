/**
 * Builds the Standard v1.2 (T21, heat activation) calibration set and lock.
 *
 * Inputs (all frozen, never rewritten here):
 *   - data/research/leave-in-inci/v1.1/calibration-envelopes/      — the 11 v1.1 envelopes
 *   - data/research/leave-in-inci/v1.1/calibration-expected-projections.json
 *   - data/research/leave-in-inci/v1.1/lab-fixture.json             — the Lab fixture v1.2 overlays
 *   - data/research/leave-in-inci/v1.0/lab-fixture.json             — each record's frozen
 *     directions capture (`identity.directionsOfUse`, `identity.directionsSource`)
 *   - plans/catalog-completeness-fill/research/r4-user-submitted-14/leave-in-v1.1/
 *     {aussie,balea,bali,neqi-spray}/envelope.json                  — the S1 user-submitted envelopes
 *
 * T21 reopened one identity field (§16). Each v1.2 envelope is therefore the
 * v1.1 envelope with (a) the v1.2 research-method stamp, (b) `identity.heatActivation`
 * transcribed from the record's frozen directions capture (HA-1…HA-9), and
 * (c) one assumption note naming the overlay. Every other field is carried
 * byte-for-byte. The script refuses to run when a `not_required` reading meets
 * activation wording in the frozen capture, when slot 13's direction quote is
 * not verbatim in its frozen capture, or when any projection other than slot
 * 13 moves (golden rule: byte-identical to v1.1 apart from the documented AD-7
 * keys).
 *
 * Writes:
 *   data/research/leave-in-inci/v1.2/{calibration-envelopes/slot-*.json,
 *     calibration-expected-projections.json, lab-fixture.json,
 *     v1.2-logic-lock-receipt.json, artifact-manifest.json}
 *   plans/catalog-completeness-fill/research/r4-user-submitted-14/leave-in-v1.2/
 *     {aussie,balea,bali,neqi-spray}/{envelope.json, adapter/*}
 *
 * Usage (from the repo root):
 *   node --import ./tests/server-only-register.cjs --import tsx scripts/leave-in-research/build-v1.2-calibration.ts
 */
import { createHash } from "node:crypto"
import { mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs"
import path from "node:path"

import type { HeatActivationCapture } from "@/lib/heat-activation/contract"
import {
  LEAVE_IN_BASE_STANDARD,
  LEAVE_IN_OVERLAY_PATH,
  LEAVE_IN_PRODUCTION_ADAPTER_RESEARCH_METHOD,
  LEAVE_IN_PRODUCTION_ADAPTER_VERSION,
  LEAVE_IN_RESEARCH_ENVELOPE_VERSION,
  LEAVE_IN_V1_1_OVERLAY,
  projectLeaveInForProduction,
  type LeaveInProductionAdapterOutcome,
  type LeaveInResearchEnvelope,
} from "@/lib/leave-in-research/production-adapter"

import { runLeaveInProductionAdapterCli } from "./project-production-adapter"
// Plain .mjs helper shared with the Lab fixture builders (same fingerprint function).
import { fingerprint } from "./lab-fixture-shared.mjs"

const ROOT = process.cwd()
const rel = (absolute: string) => path.relative(ROOT, absolute)

const V11_ROOT = path.join(ROOT, "data/research/leave-in-inci/v1.1")
const V11_ENVELOPES = path.join(V11_ROOT, "calibration-envelopes")
const V11_EXPECTED = path.join(V11_ROOT, "calibration-expected-projections.json")
const V11_LAB_FIXTURE = path.join(V11_ROOT, "lab-fixture.json")
const V10_LAB_FIXTURE = path.join(ROOT, "data/research/leave-in-inci/v1.0/lab-fixture.json")
const OUT_ROOT = path.join(ROOT, "data/research/leave-in-inci/v1.2")
const OUT_ENVELOPES = path.join(OUT_ROOT, "calibration-envelopes")
const OUT_EXPECTED = path.join(OUT_ROOT, "calibration-expected-projections.json")
const OUT_LAB_FIXTURE = path.join(OUT_ROOT, "lab-fixture.json")
const OUT_RECEIPT = path.join(OUT_ROOT, "v1.2-logic-lock-receipt.json")
const OUT_MANIFEST = path.join(OUT_ROOT, "artifact-manifest.json")
const R4_ROOT = path.join(ROOT, "plans/catalog-completeness-fill/research/r4-user-submitted-14")
const R4_IN = path.join(R4_ROOT, "leave-in-v1.1")
const R4_OUT = path.join(R4_ROOT, "leave-in-v1.2")

const RULING_DATE = "2026-10-09"
const NEQI_C2_URL = "https://neqi-hair.com/products/diamond-glass-ultimate-styling-spray"
const NEQI_DM_URL = "https://www.dm.de/p/d/3080142/neqi-leave-in-spray-diamond-glass-ultimate"

/** Slot 13 / Neqi (S3 plan §1.2, §2.2): the only `required` record in the corpus. */
const NEQI_ACTIVATION: HeatActivationCapture = {
  value: "required",
  route: "airflow_shaping",
  statements: [
    {
      kind: "activation_statement",
      quote: "Noch mehr hitzeaktivierte Polymere als im goldenen Diamond Glass Styling Spray",
      sourceTier: "C2",
      sourceUrl: NEQI_C2_URL,
      retrievedAt: RULING_DATE,
    },
    {
      kind: "heat_step_direction",
      quote: "Anschließend die einzelnen Partien mit Hitze und auf Spannung föhnen.",
      sourceTier: "C2",
      sourceUrl: NEQI_C2_URL,
      retrievedAt: RULING_DATE,
    },
  ],
  counterSignals: [
    {
      quote:
        "Jeden Abschnitt unter Hitze und Spannung föhnen, um den leistungsstarken Feuchtigkeitsschutz für spiegelglatte Haare zu aktivieren und die besten Ergebnisse zu erzielen.",
      sourceTier: "C3",
      sourceUrl: NEQI_DM_URL,
    },
  ],
}

const NOT_REQUIRED: HeatActivationCapture = {
  value: "not_required",
  route: null,
  statements: [],
  counterSignals: [],
}

/**
 * Heat-activation wording in one sentence (German or English): an activation
 * verb together with heat or a heat tool. Its presence in a frozen capture
 * forbids a silent `not_required`. A product name such as „Curl Activator
 * Cream" (Cantu, slot 3) carries no heat and does not match.
 */
const HEAT_WORD = "(hitze|heat|wärme|föhn|fön|blow-?dry|glätteisen|lockenstab|flat ?iron)"
const ACTIVATION_VERB = "(aktivier|activat)"
const ACTIVATION_WORDING = new RegExp(
  `${HEAT_WORD}[^.!?]*${ACTIVATION_VERB}|${ACTIVATION_VERB}[^.!?]*${HEAT_WORD}`,
  "i",
)

type LabProduct = {
  slot: number
  batch: string
  productName: string
  g0: { outOfCategory: boolean }
  identity: {
    directionsOfUse: string | null
    directionsSource: {
      claim_tier?: string
      source_authority_tier?: string
      url?: string | null
    } | null
  }
  properties: Array<Record<string, unknown> & { path: string }>
  propertyFingerprints: Record<string, string>
  productFingerprint: string
  reviewRouting: {
    triggers: string[]
    triggerBasis: Array<{ trigger: string; basis: string }>
  } & Record<string, unknown>
  uncertainFields: string[]
} & Record<string, unknown>

type LabFixture = { products: LabProduct[] } & Record<string, unknown>

type Ready = Extract<LeaveInProductionAdapterOutcome, { status: "projection_ready" }>

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T
}

function writeJson(filePath: string, value: unknown) {
  mkdirSync(path.dirname(filePath), { recursive: true })
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`)
}

function pin(filePath: string) {
  const absolute = path.isAbsolute(filePath) ? filePath : path.join(ROOT, filePath)
  return {
    path: rel(absolute),
    bytes: statSync(absolute).size,
    sha256: createHash("sha256").update(readFileSync(absolute)).digest("hex"),
  }
}

/** Gold-set slot → its frozen directions capture in the v1.0 Lab fixture. */
function frozenDirections(slot: number) {
  const fixture = readJson<LabFixture>(V10_LAB_FIXTURE)
  const product = fixture.products.find(
    (candidate) => candidate.batch === "gold-set" && candidate.slot === slot,
  )
  if (!product) throw new Error(`no frozen Lab capture for gold-set slot ${slot}`)
  return product
}

/**
 * The T21 transcription for one gold-set record. Slot 13 is `required`; slot 5
 * is checked explicitly (it carries `pre_heat`); every other record is HA-1
 * silence. Each reading is asserted against the frozen directions capture.
 */
function captureForSlot(slot: number): { capture: HeatActivationCapture; basis: string } {
  const frozen = frozenDirections(slot)
  const directions = frozen.identity.directionsOfUse ?? ""
  const source = frozen.identity.directionsSource
  const tier = source?.source_authority_tier ?? source?.claim_tier ?? "unknown"
  if (slot === 13) {
    const direction = NEQI_ACTIVATION.statements.find(
      (statement) => statement.kind === "heat_step_direction",
    )!
    if (!directions.includes(direction.quote)) {
      throw new Error("slot 13: the heat-step direction is not verbatim in the frozen capture")
    }
    if (source?.url !== NEQI_C2_URL || tier !== "C2") {
      throw new Error("slot 13: the frozen directions source is not the C2 manufacturer page")
    }
    return {
      capture: NEQI_ACTIVATION,
      basis:
        "required / airflow_shaping — HA-2(a) C2 activation statement „Noch mehr hitzeaktivierte Polymere als im goldenen Diamond Glass Styling Spray“ (neqi-hair.com, read 2026-10-09); HA-2(b) the frozen C2 direction „Anschließend die einzelnen Partien mit Hitze und auf Spannung föhnen.“ names a blow-dry step and offers no non-heat finish; HA-4 föhnen → airflow_shaping; the dm.de C3 wording is a counter-signal only (HA-3); routes to review (HA-8)",
    }
  }
  if (ACTIVATION_WORDING.test(directions)) {
    throw new Error(
      `slot ${slot}: frozen directions carry activation wording — not a silent record`,
    )
  }
  if (slot === 5) {
    if (!/blow-dry/i.test(directions)) {
      throw new Error("slot 5: expected the frozen EVO blow-dry direction")
    }
    if (tier === "C1" || tier === "C2") {
      throw new Error("slot 5: expected a non-German (not C1/C2) directions source")
    }
    return {
      capture: NOT_REQUIRED,
      basis: `not_required — checked explicitly: the frozen directions name a blow-dry step („${directions}“) but make no activation statement ("for improved manageability and softness" is a benefit, not activation; HA-2(a) fails), and the source (${tier}, US English manufacturer page) is not a German pack or German-market page (HA-3 fails independently); application_stage keeps pre_heat (§7.13)`,
    }
  }
  return {
    capture: NOT_REQUIRED,
    basis: `not_required — HA-1 silence: the frozen directions (${tier}) name no activation statement`,
  }
}

function restamp(
  base: LeaveInResearchEnvelope,
  capture: HeatActivationCapture,
  note: string,
): LeaveInResearchEnvelope {
  const { applicationStage, ...identityRest } = base.identity
  const identityKeys = Object.keys(base.identity)
  const identity = Object.fromEntries(
    identityKeys.flatMap((key) =>
      key === "applicationStage"
        ? [
            ["applicationStage", applicationStage],
            ["heatActivation", capture],
          ]
        : [[key, (identityRest as Record<string, unknown>)[key]]],
    ),
  ) as LeaveInResearchEnvelope["identity"]
  return {
    ...base,
    researchMethod: { ...LEAVE_IN_PRODUCTION_ADAPTER_RESEARCH_METHOD },
    identity,
    profile: {
      ...base.profile,
      assumptionNotes: [...base.profile.assumptionNotes, note],
    },
  }
}

/** The documented v1.1 → v1.2 differences on a non-activated projection. */
function stripAd7(outcome: Ready): unknown {
  const copy = structuredClone(outcome) as unknown as {
    productionProjection: Record<string, unknown> & {
      category_specs: { product_leave_in_specs: Record<string, unknown> }
      field_rationales: Record<string, string>
    }
  }
  const projection = copy.productionProjection
  delete projection.research_model_version
  delete projection.research_input_sha256
  delete projection.projection_sha256
  delete projection.category_specs.product_leave_in_specs.heat_activation_route
  delete projection.field_rationales[
    "category_specs.product_leave_in_specs.heat_activation_required"
  ]
  delete projection.field_rationales["category_specs.product_leave_in_specs.heat_activation_route"]
  return copy
}

function project(envelope: LeaveInResearchEnvelope, label: string): Ready {
  const outcome = projectLeaveInForProduction(envelope)
  if (outcome.status !== "projection_ready") {
    throw new Error(`${label}: projection ${outcome.status} — ${outcome.reasons.join("; ")}`)
  }
  return outcome
}

function assertSlot13Delta(v11: Ready, v12: Ready) {
  const before = v11.productionProjection.category_specs
  const after = v12.productionProjection.category_specs
  const expect = (label: string, actual: unknown, expected: unknown) => {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error(`slot 13 ${label}: ${JSON.stringify(actual)} !== ${JSON.stringify(expected)}`)
    }
  }
  expect("v1.1 roles", before.product_leave_in_specs.roles, [
    "replacement_conditioner",
    "styling_prep",
  ])
  expect("roles", after.product_leave_in_specs.roles, ["styling_prep"])
  expect("fit", after.product_leave_in_fit_specs.conditioner_relationship, "booster_only")
  expect("plan_roles", after.product_leave_in_specs.plan_roles, ["pre_heat_application"])
  expect("activation", after.product_leave_in_specs.heat_activation_required, true)
  expect("route", after.product_leave_in_specs.heat_activation_route, "airflow_shaping")
  expect(
    "eligibility",
    after.product_leave_in_eligibility.map(
      (row) => `${row.thickness}|${row.need_bucket}|${row.styling_context}`,
    ),
    [
      "normal|heat_protect|heat_style",
      "normal|moisture_anti_frizz|heat_style",
      "coarse|heat_protect|heat_style",
      "coarse|moisture_anti_frizz|heat_style",
    ],
  )
  expect("requiredProtocolRoles", v12.requiredProtocolRoles, ["pre_heat_protection"])
  // Everything outside the AD-7 fields is carried unchanged.
  const unchanged = (table: Record<string, unknown>, keys: string[]) =>
    Object.fromEntries(Object.entries(table).filter(([key]) => !keys.includes(key)))
  const movedSpecs = ["roles", "plan_roles", "heat_activation_required", "heat_activation_route"]
  expect(
    "other specs",
    unchanged(after.product_leave_in_specs, movedSpecs),
    unchanged(before.product_leave_in_specs, movedSpecs),
  )
  expect(
    "other fit specs",
    unchanged(after.product_leave_in_fit_specs, ["conditioner_relationship"]),
    unchanged(before.product_leave_in_fit_specs, ["conditioner_relationship"]),
  )
  expect(
    "suitable_thicknesses",
    v12.productionProjection.suitable_thicknesses,
    v11.productionProjection.suitable_thicknesses,
  )
}

function buildCalibration() {
  const expectedV11 = readJson<{ projections: Record<string, Ready> }>(V11_EXPECTED).projections
  const files = readdirSync(V11_ENVELOPES)
    .filter((file) => file.endsWith(".json"))
    .sort()
  if (files.length !== 11) throw new Error(`expected 11 v1.1 envelopes, found ${files.length}`)

  rmSync(OUT_ENVELOPES, { recursive: true, force: true })
  mkdirSync(OUT_ENVELOPES, { recursive: true })

  const projections: Record<string, Ready> = {}
  const readings: Array<{ slot: number; value: string; route: string | null; basis: string }> = []
  for (const file of files) {
    const slot = Number(file.replace(/^slot-|\.json$/g, ""))
    const base = readJson<LeaveInResearchEnvelope>(path.join(V11_ENVELOPES, file))
    const { capture, basis } = captureForSlot(slot)
    const envelope = restamp(
      base,
      capture,
      `Standard v1.2 (T21, ${RULING_DATE}): identity.heatActivation transcribed from the frozen directions capture (data/research/leave-in-inci/v1.0/lab-fixture.json, gold-set slot ${slot}): ${basis}. Every other field is carried unchanged from the v1.1 envelope (§16 — only the fields whose rules changed reopen).`,
    )
    writeJson(path.join(OUT_ENVELOPES, file), envelope)
    const outcome = project(envelope, file)
    projections[file] = outcome
    readings.push({ slot, value: capture.value, route: capture.route, basis })

    const golden = expectedV11[file]
    if (!golden) throw new Error(`${file}: no v1.1 golden projection`)
    if (slot === 13) {
      assertSlot13Delta(golden, outcome)
    } else if (JSON.stringify(stripAd7(outcome)) !== JSON.stringify(stripAd7(golden))) {
      throw new Error(`${file}: golden rule violated — the projection moved under v1.2`)
    }
  }
  writeJson(OUT_EXPECTED, { adapter_version: LEAVE_IN_PRODUCTION_ADAPTER_VERSION, projections })
  return readings
}

/** Lab fixture v1.2: overlay of the v1.1 fixture; only slot 13 gains a property. */
function buildLabFixture() {
  const fixture = readJson<LabFixture>(V11_LAB_FIXTURE)
  const neqi = fixture.products.find(
    (product) => product.batch === "gold-set" && product.slot === 13,
  )
  if (!neqi) throw new Error("Lab fixture: no gold-set slot 13")
  const template = neqi.properties.find((property) => property.path === "care_direction")!
  const statementLines = NEQI_ACTIVATION.statements.map(
    (statement) =>
      `${statement.kind === "activation_statement" ? "Aktivierungsaussage" : "Hitzeschritt"} (${statement.sourceTier}, ${statement.sourceUrl}, ${statement.retrievedAt}): „${statement.quote}“`,
  )
  const property = {
    path: "heat_activation",
    group: "profile",
    label: "Hitzeaktivierung (Identität)",
    value: "required · airflow_shaping",
    rawValue: { value: NEQI_ACTIVATION.value, route: NEQI_ACTIVATION.route },
    confidence: null,
    evidenceLevel: "E1",
    evidenceScope: "directions",
    informational: false,
    echo: null,
    reasoningShort:
      "T21 (v1.2): Hersteller (C2) nennt hitzeaktivierte Polymere und verlangt Föhnen unter Spannung → required, Route airflow_shaping. Prüfen: heat_activation_required.",
    rationale: [
      "## `heat_activation` — `required` · `airflow_shaping` (Standard v1.2, T21)",
      "",
      "- **HA-2(a)** activation statement, C2: „Noch mehr hitzeaktivierte Polymere als im goldenen Diamond Glass Styling Spray“",
      "- **HA-2(b)** heat-step direction, C2: „Anschließend die einzelnen Partien mit Hitze und auf Spannung föhnen.“ — no non-heat finish offered",
      "- **HA-4** route: „föhnen“ → `airflow_shaping`",
      "- **HA-3** dm.de wording (C3) recorded as a counter-signal only",
      "- **HA-6** separate from the HEAT binary (`provides_heat_protection` stays `true` on its own claim)",
      "- **HA-8** every `required` value routes to human review",
    ].join("\n"),
    rationaleSource: `${LEAVE_IN_OVERLAY_PATH} · §2 slot 13`,
    rationaleExtractionGap: false,
    observations: statementLines,
    counterSignals: NEQI_ACTIVATION.counterSignals.map(
      (signal) => `${signal.sourceTier} (${signal.sourceUrl}): „${signal.quote}“`,
    ),
    derivedFrom: ["identity.heatActivation"],
    reviewNote: "T21 review: heat_activation_required (HA-8)",
    adjudication: null,
  }
  if (
    JSON.stringify(Object.keys(property).sort()) !== JSON.stringify(Object.keys(template).sort())
  ) {
    throw new Error("Lab fixture: the heat_activation row does not match the property shape")
  }
  if (neqi.properties.some((existing) => existing.path === "heat_activation")) {
    throw new Error("Lab fixture: slot 13 already carries heat_activation")
  }
  neqi.properties = [...neqi.properties, property]
  neqi.propertyFingerprints = {
    ...neqi.propertyFingerprints,
    heat_activation: fingerprint({
      path: property.path,
      value: property.value,
      rationale: property.rationale,
      observations: property.observations,
      counterSignals: property.counterSignals,
      derivedFrom: property.derivedFrom,
      echo: property.echo,
    }),
  }
  neqi.productFingerprint = fingerprint(neqi.propertyFingerprints)
  neqi.reviewRouting = {
    ...neqi.reviewRouting,
    triggers: [...neqi.reviewRouting.triggers, "heat_activation_required"],
    triggerBasis: [
      ...neqi.reviewRouting.triggerBasis,
      {
        trigger: "heat_activation_required",
        basis: `Standard v1.2 T21 HA-8 — required / airflow_shaping (${LEAVE_IN_OVERLAY_PATH}, §2 slot 13)`,
      },
    ],
  }
  fixture.generatedAt = RULING_DATE
  // `standardVersion` stays the approval persistence key (see build-lab-fixture-v1.1.mjs),
  // so every untouched approval survives; only slot 13's new row is unreviewed.
  fixture.effectiveStandard = {
    version: "leave-in-inci-v1.2",
    label: "leave-in-inci-v1.2 (Standard v1.0 + T20- und T21-Overlay)",
    overlay: LEAVE_IN_OVERLAY_PATH,
  }
  writeJson(OUT_LAB_FIXTURE, fixture)
}

/** Re-stamps the S1 user-submitted v1.1 envelopes and builds the Neqi v1.2 envelope. */
function buildUserSubmitted() {
  const products: Array<[string, HeatActivationCapture, string]> = [
    [
      "aussie",
      NOT_REQUIRED,
      "not_required — HA-1 silence: the r4 sources carry no activation statement and no heat-step direction",
    ],
    [
      "balea",
      NOT_REQUIRED,
      "not_required — HA-1 silence: the r4 sources name heat tools only in the heat-protection claim („Hitzeschutz bis zu 230 Grad … Föhn oder Glätteisen“), which never sets activation (HA-6); no activation statement",
    ],
    [
      "bali",
      NOT_REQUIRED,
      "not_required — HA-1 silence: the r4 sources carry only the ambient „Hitze“ protection wording, no activation statement and no heat-step direction",
    ],
    [
      "neqi-spray",
      NEQI_ACTIVATION,
      "required / airflow_shaping — HA-2(a) C2 „Noch mehr hitzeaktivierte Polymere als im goldenen Diamond Glass Styling Spray“ and HA-2(b) C2 „Anschließend die einzelnen Partien mit Hitze und auf Spannung föhnen.“ (neqi-hair.com, read 2026-10-09); dm.de C3 wording as counter-signal only; routes to review (HA-8); profile values unchanged (T20 balanced)",
    ],
  ]
  const summary: Record<string, unknown> = {}
  for (const [name, capture, basis] of products) {
    const inputPath = path.join(R4_IN, name, "envelope.json")
    const base = readJson<LeaveInResearchEnvelope>(inputPath)
    const v11Outcome = readJson<Ready>(path.join(R4_IN, name, "adapter/production-projection.json"))
    const envelope = restamp(
      base,
      capture,
      `Standard v1.2 (T21, ${RULING_DATE}): identity.heatActivation ${basis}. Every other field is carried unchanged from the v1.1 envelope.`,
    )
    const outDir = path.join(R4_OUT, name)
    const envelopePath = path.join(outDir, "envelope.json")
    writeJson(envelopePath, envelope)
    runLeaveInProductionAdapterCli({
      input: envelopePath,
      output: path.join(outDir, "adapter"),
      overwrite: true,
    })
    const outcome = readJson<Ready>(path.join(outDir, "adapter/production-projection.json"))
    if (outcome.status !== "projection_ready") throw new Error(`${name}: ${outcome.status}`)
    if (capture.value === "not_required") {
      if (JSON.stringify(stripAd7(outcome)) !== JSON.stringify(stripAd7(v11Outcome))) {
        throw new Error(`${name}: the re-stamped projection moved under v1.2`)
      }
    } else {
      assertSlot13Delta(v11Outcome, outcome)
    }
    summary[name] = {
      value: capture.value,
      route: capture.route,
      requiredProtocolRoles: outcome.requiredProtocolRoles,
    }
  }
  return summary
}

function buildReceipt(readings: ReturnType<typeof buildCalibration>) {
  const receipt = {
    schema_version: "leave-in-research-logic-lock.v1",
    locked_standard_version: "1.2",
    locked_at: RULING_DATE,
    decision: "approved_and_locked_for_reuse",
    ruling:
      'T21 — Nick, 2026-10-09: A1 ("needs heat to work" is a real property set from manufacturer statements and directions; activated products are offered only in the heat-styling routine, never as conditioner replacement or plain post-wash leave-in), A2 (the Neqi styling spray is never a conditioner replacement), D-c (HEAT&GLOW\'s between-wash use is covered by its activation direction), D-d (activation evidence is manufacturer-only: German page or pack), D-e (activation and heat protection are separate properties).',
    normative_sources: {
      overlay: { ...pin(LEAVE_IN_OVERLAY_PATH) },
      previous_overlay: {
        version: "1.1",
        ...pin(LEAVE_IN_V1_1_OVERLAY.path),
        note: "byte-identical to the v1.1 lock",
      },
      base_standard: {
        version: "1.0",
        ...pin(LEAVE_IN_BASE_STANDARD.path),
        note: "byte-identical to the v1.0 lock; v1.2 = base + v1.1 overlay + v1.2 overlay",
      },
      base_lock_receipt: {
        path: "data/research/leave-in-inci/v1.0/v1.0-logic-lock-receipt.json",
        sha256: pin("data/research/leave-in-inci/v1.0/v1.0-logic-lock-receipt.json").sha256,
      },
      previous_lock_receipt: {
        path: "data/research/leave-in-inci/v1.1/v1.1-logic-lock-receipt.json",
        sha256: pin("data/research/leave-in-inci/v1.1/v1.1-logic-lock-receipt.json").sha256,
      },
    },
    research_method: {
      ...LEAVE_IN_PRODUCTION_ADAPTER_RESEARCH_METHOD,
      research_envelope_version: LEAVE_IN_RESEARCH_ENVELOPE_VERSION,
      note: "policySha256 pins the v1.2 overlay, which names the v1.1 overlay and the v1.0 base by hash. The envelope version string is unchanged; the identity block gains the required heatActivation capture, and the adapter refuses v1.1-stamped envelopes with a re-stamp reason.",
    },
    changed_scope: {
      field: "identity.heatActivation",
      reopened_fields: ["identity.heatActivation"],
      values: ["required", "not_required"],
      routes: ["airflow_shaping", "direct_contact_heat", "either_heat"],
      evidence_rule: "HA-1…HA-9 (v1.2 overlay §1.3)",
      production_invariants: "I1–I8 (v1.2 overlay §1.4; adapter AD-7)",
      unchanged:
        "every §7 dimension, lean-profile field, anchor, threshold, gate, evidence bar and German string of Standard v1.0; the v1.1 care_direction rule; §13.3 (HEAT binary); §2.4.1 and T9 (HEAT stays the only claim-led field); §7.13 application_stage",
      executable_rule: "src/lib/heat-activation/contract.ts",
    },
    reviewed_anchor_patterns: [
      {
        product_id: "slot-13-neqi-diamond-glass-ultimate-styling-spray",
        heat_activation: "required",
        route: "airflow_shaping",
        purpose:
          "both prongs from the C2 manufacturer page; dm.de C3 wording is a counter-signal only; projects to the pre-heat slot only (AD-7)",
      },
      {
        product_id: "slot-05-evo-head-mistress-cuticle-sealer",
        heat_activation: "not_required",
        route: null,
        purpose:
          "a blow-dry direction without an activation statement, from a non-German page, stays not_required; pre_heat in application_stage is unaffected",
      },
    ],
    validation_basis: {
      calibration_records_transcribed: readings.length,
      corpus_records_transcribed: 15,
      records_changed: readings.filter((reading) => reading.value === "required").length,
      changed: ["slot-13 not activated -> required / airflow_shaping (review, HA-8)"],
      readings,
      machine_checks: [
        "every not_required reading is asserted free of activation wording in its frozen directions capture; slot 13's direction is asserted verbatim in its frozen C2 capture (scripts/leave-in-research/build-v1.2-calibration.ts)",
        "every v1.2 projection except slot 13 is byte-identical to its v1.1 golden projection apart from the version pin, the input/projection hashes, the new heat_activation_route: null key and the two AD-7 rationale strings (tests/leave-in-production-adapter-calibration.test.ts)",
        "the v1.0 base and the v1.1 overlay are byte-identical to their locks (tests/leave-in-research-v1-2-lock.test.ts)",
      ],
      independent_sealed_lanes: 0,
      calibration_note:
        "Applied by one transcription lane with every reading machine-checked against the frozen captures. One positive record in the corpus; not yet run by two independent sealed lanes (v1.2 overlay §6).",
    },
    known_limits_retained: [
      "Only one corpus record is heat-activated; the rule is implemented, not yet calibrated on a wider positive set.",
      "Every v1.0 and v1.1 known limit and §17 open evidence gap stays open.",
    ],
    separate_gates: {
      individual_product_lab_approval: "required",
      lab_fixture_update:
        "done — data/research/leave-in-inci/v1.2/lab-fixture.json (overlay of the v1.1 fixture; slot 13 gains one heat_activation row routed to review, every other approval kept)",
      production_adapter: "updated (research-method pin v1.2; AD-7 heat-activation projection)",
      catalog_apply_batch: "not prepared here (S3 data migration, separate approval)",
      catalog_activation: false,
      production_database_write: false,
      user_facing_copy_change: false,
      commit_push_or_pr: false,
    },
    production_writes: false,
  }
  writeJson(OUT_RECEIPT, receipt)
}

function buildManifest(userSubmitted: Record<string, unknown>) {
  const envelopes = readdirSync(OUT_ENVELOPES)
    .filter((file) => file.endsWith(".json"))
    .sort()
    .map((file) => pin(path.join(OUT_ENVELOPES, file)))
  const r4 = ["aussie", "balea", "bali", "neqi-spray"].flatMap((name) => [
    pin(path.join(R4_OUT, name, "envelope.json")),
    pin(path.join(R4_OUT, name, "adapter/production-projection.json")),
  ])
  const manifest = {
    schema_version: "leave-in-stage-a-artifact-manifest.v1.2",
    created_at: RULING_DATE,
    standard_version: "1.2",
    composition:
      "Standard v1.2 = the byte-frozen Standard v1.0 (normative_base) + the byte-frozen T20 overlay (previous_overlay) + the T21 heat-activation overlay (normative_overlay). v1.0 and v1.1 artifacts stay pinned by their own manifests and are re-verified in CI.",
    normative_overlay: {
      ...pin(LEAVE_IN_OVERLAY_PATH),
      verification:
        "T21 heat-activation overlay; names the v1.1 overlay and the v1.0 base by sha256; pinned as the adapter research method policySha256",
    },
    previous_overlay: {
      ...pin(LEAVE_IN_V1_1_OVERLAY.path),
      verification: "Standard v1.1 overlay (T20), unchanged since the 2026-09-29 lock",
    },
    normative_base: {
      ...pin(LEAVE_IN_BASE_STANDARD.path),
      verification: "Standard v1.0, unchanged since the 2026-09-13 lock",
    },
    runbook: {
      ...pin("docs/research/leave-in-inci/v1.0/runbook.md"),
      verification: "unchanged; still the procedure of record",
    },
    base_lock_receipt: pin("data/research/leave-in-inci/v1.0/v1.0-logic-lock-receipt.json"),
    previous_lock_receipt: pin("data/research/leave-in-inci/v1.1/v1.1-logic-lock-receipt.json"),
    previous_artifact_manifest: {
      path: "data/research/leave-in-inci/v1.1/artifact-manifest.json",
      verification:
        "every artifact it lists except the README is byte-identical and re-hashed by tests/leave-in-research-v1-1-lock.test.ts",
    },
    readme: {
      ...pin("docs/research/leave-in-inci/README.md"),
      verification:
        "README as of the v1.2 lock; recorded for provenance, not CI-enforced (living entry point)",
    },
    logic_lock_receipt: pin(OUT_RECEIPT),
    calibration: {
      builder: "scripts/leave-in-research/build-v1.2-calibration.ts",
      expected_projections: pin(OUT_EXPECTED),
      envelopes,
    },
    user_submitted_restamps: {
      root: rel(R4_OUT),
      summary: userSubmitted,
      artifacts: r4,
    },
    production_writes: false,
    lab_fixture: {
      ...pin(OUT_LAB_FIXTURE),
      verification:
        "v1.1 Lab fixture overlay: slot 13 gains one heat_activation row (review trigger heat_activation_required); every other property fingerprint and every other product unchanged",
    },
  }
  writeJson(OUT_MANIFEST, manifest)
}

function main() {
  const readings = buildCalibration()
  buildLabFixture()
  const userSubmitted = buildUserSubmitted()
  buildReceipt(readings)
  buildManifest(userSubmitted)
  process.stdout.write(
    `${JSON.stringify(
      {
        envelopes: readings.length,
        required: readings.filter((reading) => reading.value === "required").map((r) => r.slot),
        outDir: rel(OUT_ROOT),
        userSubmitted,
      },
      null,
      2,
    )}\n`,
  )
}

main()
