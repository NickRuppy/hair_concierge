#!/usr/bin/env node
/**
 * Derives `mask-research-envelope-v1.0` JSON documents for the frozen Mask v1.0
 * calibration corpus from frozen artifacts only:
 *
 *   - reference-key-v1/<id>.json — the approved reference key (identity state,
 *     G0, profile evidence objects, bond_route, uncertain fields)
 *   - cohort.json                — the frozen cohort (formula of record, raw INCI)
 *   - blind-lane-v1 / blind-lane-v2p5 + their packets — the G0 refuse/stop
 *     records (u5, u6 exclusions; q3 `insufficient_information`)
 *
 * Deterministic and non-inventive: every value is transcribed. Profile evidence
 * objects are copied from the key minus their internal-only members
 * (`evidenceLevel`, `evidenceScope`, `counterSignals`, `balancedReading`), which
 * stay in the research record and never enter the envelope's projection inputs.
 * The only prose this script writes is the `bond_route` evidence wrapper, built
 * from the key's own token/rank/note fields plus a restatement of the property
 * set's trace-level rule.
 *
 * Usage: node scripts/mask-research/build-envelopes-from-key.mjs
 */
import { createHash } from "node:crypto"
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import path from "node:path"
import process from "node:process"

const ROOT = process.cwd()
const DATA = path.join(ROOT, "data/research/mask-inci/v1.0")
const KEY_DIR = path.join(DATA, "reference-key-v1")
const COHORT_PATH = path.join(DATA, "cohort.json")
const OUT_DIR = path.join(DATA, "calibration-envelopes")

const RESEARCH_METHOD = {
  policyId: "mask-classification-v1.0",
  modelVersion: "mask-inci-v1.0",
  policySha256: "d105ef3fdfc0e953591a54765004f59d107f049a9ea9007cf7c579dafa726ae0",
  lexiconSha256: "3dcaf54f8a7e4844f44d2731f30ca28c4a8565f17082d8fd0b27376ca3167ada",
}

/** §2.3 identity states the envelope accepts (and the leave-in confidence map). */
const IDENTITY_CONFIDENCE = {
  verified: "high",
  verified_with_minor_source_difference: "moderate",
  provisional_formula_conflict: "moderate",
  provisional_identity_conflict: "moderate",
  insufficient_information: "low",
  excluded_product_form: "low",
}

/**
 * Records the builder deliberately does not turn into an envelope, with the
 * frozen reason. #05's identity state is outside the §2.3 vocabulary: the key
 * confirms the product discontinued and keeps it for calibration only, so it is
 * never a production candidate and must not be re-labelled into a state it is not.
 */
const NOT_BUILT = {
  "05-isana-mandelmilch-3in1":
    "identity state `discontinued_confirmed_calibration_only` is outside the §2.3 vocabulary; a discontinued product is calibration-only and never a production candidate",
}

/**
 * G0 refuse/stop records outside the reference key. Each is transcribed from
 * its blind-lane record (G0 value / outcome) and its frozen packet (identity).
 */
const G0_RECORDS = [
  {
    id: "u5-olaplex-no3plus-prewash",
    record: "blind-lane-v1/u5-olaplex-no3plus-prewash.json",
    packet: "blind-packets-round2/u5-olaplex-no3plus-prewash.json",
  },
  {
    id: "u6-balea-silberglanz-2in1",
    record: "blind-lane-v1/u6-balea-silberglanz-2in1.json",
    packet: "blind-packets-round2/u6-balea-silberglanz-2in1.json",
  },
  {
    id: "q3-syoss-intense-repair",
    record: "blind-lane-v2p5/q3-syoss-intense-repair.json",
    packet: "blind-packets-round2p5/q3-syoss-intense-repair.json",
  },
]

/**
 * #13's G0 rationale names two charter grounds (pre-shampoo-only treatment and
 * bondbuilder catalog category with a specialist protocol); u5 — its successor
 * formula — carries exactly that pair as one reason label, which is reused here.
 */
const KEY_EXCLUSION_REASONS = {
  "13-olaplex-no3-hair-perfector": "excluded_pre_shampoo_bondbuilder_protocol",
}

const UNCERTAIN_FIELD_NAMES = {
  conditioningLevel: "conditioning_level",
  weightPotential: "weight_potential",
  careDirection: "care_direction",
  repairSupportLevel: "repair_support_level",
  primaryFocus: "primary_focus",
  secondaryFocus: "secondary_focus",
  hairThicknessFit: "hair_thickness_fit",
  damageFit: "damage_fit",
  textureFit: "texture_fit",
  bondRoute: "bond_route",
}

const CONFIDENCE_ORDER = ["low", "moderate", "high"]

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"))
}

function clean(value) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : ""
}

function unique(values) {
  return [...new Set(values.map(clean).filter(Boolean))]
}

function normalizeTokens(rawInci) {
  return rawInci
    .split(/(?<!\d),|,(?!\d)/)
    .map((token) => token.replace(/[*†]/g, "").trim())
    .filter((token) => token.length > 0)
    .map((token) => token.toUpperCase())
}

function sha256(text) {
  return createHash("sha256").update(text).digest("hex")
}

/** Copies a key evidence object, dropping the internal-only members. */
function transcribe(field, label) {
  if (!field) throw new Error(`${label}: missing evidence object`)
  const thresholdReasoning = unique(field.thresholdReasoning ?? [])
  // A key object with no recorded limitation falls back to its own
  // evidenceScope sentence (transcribed, never invented); the envelope
  // contract requires at least one limitation.
  const limitations = unique(
    (field.limitations ?? []).length > 0 ? field.limitations : [field.evidenceScope],
  )
  const evidenceSignals = unique(field.evidenceSignals ?? [])
  if (thresholdReasoning.length < 2) throw new Error(`${label}: needs two threshold entries`)
  if (limitations.length < 1) throw new Error(`${label}: needs a limitation`)
  if (evidenceSignals.length < 1) throw new Error(`${label}: needs an evidence signal`)
  return {
    value: field.value,
    confidence: field.confidence,
    rationale: clean(field.rationale),
    evidenceSignals,
    derivation: clean(field.derivation),
    thresholdReasoning,
    limitations,
  }
}

function lowerConfidence(left, right) {
  return CONFIDENCE_ORDER[Math.min(CONFIDENCE_ORDER.indexOf(left), CONFIDENCE_ORDER.indexOf(right))]
}

/** §9.5: primary and secondary are one hierarchy pass; the envelope carries one focus object. */
function focusEvidence(primary, secondary, label) {
  const merged = {
    value: { primary: primary.value, secondary: [...secondary.value] },
    confidence: lowerConfidence(primary.confidence, secondary.confidence),
    rationale: `${clean(primary.rationale)} Secondary: ${clean(secondary.rationale)}`,
    evidenceSignals: unique([
      ...(primary.evidenceSignals ?? []),
      ...(secondary.evidenceSignals ?? []),
    ]),
    derivation: `${clean(primary.derivation)} Secondary: ${clean(secondary.derivation)}`,
    thresholdReasoning: unique([
      ...(primary.thresholdReasoning ?? []),
      ...(secondary.thresholdReasoning ?? []),
    ]),
    limitations: unique([...(primary.limitations ?? []), ...(secondary.limitations ?? [])]),
  }
  if (merged.thresholdReasoning.length < 2) throw new Error(`${label}: focus thresholds`)
  return merged
}

function bondRouteEvidence(bondRoute, confidence, id) {
  const value = bondRoute?.value ?? "none"
  const token = clean(bondRoute?.token)
  return {
    value,
    confidence,
    rationale:
      value === "none"
        ? `bond_route recorded \`none\` in reference-key-v1 (${id}): no named bond chemistry above the sub-1 % tail.`
        : `bond_route recorded \`${value}\` in reference-key-v1 (${id}) on ${token}${bondRoute?.rank ? ` (rank ${bondRoute.rank})` : ""}.`,
    evidenceSignals: unique([`reference-key-v1 ${id}`, token, bondRoute?.note]),
    derivation:
      "Property set trace-level rule: `bond_route` is deterministic, by named INCI above the sub-1 % tail, and gates `repair_support_level: high`.",
    thresholdReasoning: [
      `Recorded \`${value}\`.`,
      "Citric acid, 'Bond' naming and hydrolyzed protein alone never qualify.",
    ],
    limitations: ["A named chemistry token is formula evidence (E2), never proof of bond repair."],
  }
}

function buildInCategory(key, cohortEntry) {
  const id = key.productId
  const identity = key.identity
  const identityStatus = identity.identityState
  if (!(identityStatus in IDENTITY_CONFIDENCE)) {
    throw new Error(
      `${id}: identity state ${identityStatus} is outside §2.3 and not listed in NOT_BUILT`,
    )
  }
  const rawInci = cohortEntry.formulaOfRecord.rawInci
  if (sha256(rawInci) !== identity.rawInciSha256) {
    throw new Error(`${id}: cohort formula of record does not match the key's rawInciSha256`)
  }
  const normalizedIngredients = normalizeTokens(rawInci)
  const sourceIds = unique([identity.formulaSource]).slice(0, 1)
  const multi = key.g0.multiUse
  const profile = key.profile

  return {
    version: "mask-research-envelope-v1.0",
    researchMethod: { ...RESEARCH_METHOD },
    identity: {
      researchId: `mask-v1.0-${id}`,
      market: "DE/EU",
      exactProductName: identity.productName,
      brand: identity.brand,
      gtin: identity.gtinEan ?? null,
      identityStatus,
      categoryBoundaryStatus: "eligible",
      exclusionReason: null,
      multiUse: Boolean(multi?.multi_use),
      uncoveredModes: multi?.multi_use ? [...multi.multi_use_uncovered_modes] : [],
      confidence: IDENTITY_CONFIDENCE[identityStatus],
      sourceIds,
    },
    formula: {
      status:
        identityStatus === "provisional_formula_conflict"
          ? "provisional_conflict"
          : (cohortEntry.conflicts ?? []).length > 0
            ? "verified_with_minor_difference"
            : "verified",
      rawInci,
      normalizedIngredients,
      formulaFingerprintSha256: sha256(normalizedIngredients.join(", ")),
      rawInciSha256: identity.rawInciSha256,
      sourceIds,
    },
    profile: {
      conditioningLevel: transcribe(profile.conditioningLevel, `${id} conditioningLevel`),
      weightPotential: transcribe(profile.weightPotential, `${id} weightPotential`),
      careDirection: transcribe(profile.careDirection, `${id} careDirection`),
      repairSupportLevel: transcribe(profile.repairSupportLevel, `${id} repairSupportLevel`),
      focus: focusEvidence(profile.primaryFocus, profile.secondaryFocus, id),
      bondRoute: bondRouteEvidence(key.bondRoute, profile.repairSupportLevel.confidence, id),
      hairThicknessFit: transcribe(profile.hairThicknessFit, `${id} hairThicknessFit`),
      damageFit: transcribe(profile.damageFit, `${id} damageFit`),
      textureFit: transcribe(profile.textureFit, `${id} textureFit`),
      uncertainFields: unique(
        (key.uncertainFields ?? []).map((field) => UNCERTAIN_FIELD_NAMES[field] ?? field),
      ),
      assumptionNotes: unique(key.assumptionNotes ?? []),
    },
  }
}

/** A G0 refuse/stop record carries identity only — no profile exists by rule (§2.1). */
function buildG0Only({ id, packetIdentity, g0Value, identityStatus, exclusionReason }) {
  return {
    version: "mask-research-envelope-v1.0",
    researchMethod: { ...RESEARCH_METHOD },
    identity: {
      researchId: `mask-v1.0-${id}`,
      market: "DE/EU",
      exactProductName: packetIdentity.productName,
      brand: packetIdentity.brand,
      gtin: packetIdentity.gtinEan ?? null,
      identityStatus,
      categoryBoundaryStatus:
        g0Value === "excluded_product_form" ? "excluded_product_form" : "eligible",
      exclusionReason,
      multiUse: false,
      uncoveredModes: [],
      confidence: IDENTITY_CONFIDENCE[identityStatus],
      sourceIds: unique([packetIdentity.formulaSource]).slice(0, 1),
    },
  }
}

function main() {
  const cohort = readJson(COHORT_PATH)
  const cohortById = new Map(cohort.products.map((product) => [product.id, product]))
  rmSync(OUT_DIR, { recursive: true, force: true })
  mkdirSync(OUT_DIR, { recursive: true })
  const written = []

  const keyFiles = readdirSync(KEY_DIR)
    .filter((file) => /^\d\d-.*\.json$/.test(file))
    .sort()
  for (const file of keyFiles) {
    const key = readJson(path.join(KEY_DIR, file))
    const id = key.productId
    if (NOT_BUILT[id]) continue
    let envelope
    if (key.g0.value === "in_category") {
      envelope = buildInCategory(key, cohortById.get(id))
    } else {
      envelope = buildG0Only({
        id,
        packetIdentity: key.identity,
        g0Value: key.g0.value,
        identityStatus: key.identity.identityState,
        exclusionReason: KEY_EXCLUSION_REASONS[id] ?? null,
      })
    }
    writeFileSync(path.join(OUT_DIR, `${id}.json`), `${JSON.stringify(envelope, null, 2)}\n`)
    written.push(id)
  }

  for (const entry of G0_RECORDS) {
    const record = readJson(path.join(DATA, entry.record))
    const packet = readJson(path.join(DATA, entry.packet))
    const g0Value = record.g0.value ?? record.g0.outcome
    const excluded = g0Value !== "insufficient_information"
    const envelope = buildG0Only({
      id: entry.id,
      packetIdentity: packet.identity,
      g0Value: excluded ? "excluded_product_form" : g0Value,
      identityStatus: excluded ? "excluded_product_form" : "insufficient_information",
      exclusionReason: excluded ? g0Value : null,
    })
    writeFileSync(path.join(OUT_DIR, `${entry.id}.json`), `${JSON.stringify(envelope, null, 2)}\n`)
    written.push(entry.id)
  }

  process.stdout.write(
    `${JSON.stringify({ written: written.length, notBuilt: Object.keys(NOT_BUILT) })}\n`,
  )
}

main()
