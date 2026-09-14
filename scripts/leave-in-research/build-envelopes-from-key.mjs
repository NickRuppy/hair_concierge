#!/usr/bin/env node
/**
 * Derives `leave-in-research-envelope-v1.0` JSON documents for the 11 in-category
 * gold-set products from two frozen artifacts:
 *
 *   - reference-key-v4/reference-key.json  — the category-developer reference key
 *     (profile values, fit tables, focus, dimension evidence, basis prose)
 *   - calibration-packet.json              — the G1 freeze (identity, raw INCI,
 *     normalized ingredients, both fingerprints, directions)
 *
 * Deterministic and non-inventive: every value is transcribed from those files,
 * every prose string is either quoted from the key's own `*_basis` / `note` /
 * `mandatory_counter_signal` fields or is a verbatim restatement of the named
 * standard rule. Nothing is researched, re-judged or interpolated here.
 *
 * Usage: node scripts/leave-in-research/build-envelopes-from-key.mjs
 */
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import path from "node:path"
import process from "node:process"

const ROOT = process.cwd()
const KEY_PATH = path.join(
  ROOT,
  "data/research/leave-in-inci/v1.0/corpus/gold-set/reference-key-v4/reference-key.json",
)
const PACKET_PATH = path.join(
  ROOT,
  "data/research/leave-in-inci/v1.0/corpus/gold-set/calibration-packet.json",
)
const OUT_DIR = path.join(ROOT, "data/research/leave-in-inci/v1.0/calibration-envelopes")

const RESEARCH_METHOD = {
  policyId: "leave-in-classification-v1.0",
  modelVersion: "leave-in-inci-v1.0",
  policySha256: "7ae5e882d9cba3e3fccdea3623d056efe802ff3bc3adbe554112e471da551ace",
  runbookSha256: "dce7d84982e52f5094a0b29500105d13f42c31d44e04b1871bcbef1bda5e56ca",
}

const IDENTITY_CONFIDENCE = {
  verified: "high",
  verified_with_minor_source_difference: "moderate",
  provisional_formula_conflict: "moderate",
  provisional_identity_conflict: "moderate",
  insufficient_information: "low",
  excluded_product_form: "low",
}

/**
 * production-adapter.ts's §14 fail-closed identity gate refuses every
 * provisional identityStatus (`provisional_identity_conflict`,
 * `provisional_formula_conflict`, `insufficient_information`). This mirrors
 * the documented-resolution logic already used for `formula.status` below
 * (a `known_conflicts` entry moves formula off "provisional"), but for
 * identity a conflict only counts as resolved when the packet's own prose
 * names one variant authoritative and records the other as a conflict, not
 * merely that a conflict exists (`known_conflicts.length > 0` alone is NOT
 * sufficient).
 *
 * This is a narrow, per-slot allowlist rather than a prose classifier: each
 * entry is transcribed, not inferred, from the packet's own resolution
 * language, keeping this builder's "nothing is researched, re-judged or
 * interpolated" guarantee intact. A slot NOT listed here keeps its packet
 * `identity_status` verbatim and is correctly refused by the adapter when
 * that status is provisional.
 *
 * Slot 3's packet entry is still frozen at its pre-resolution
 * `provisional_formula_conflict` status (the resolution lives only in this
 * allowlist), so it is the one slot that still needs its status forced.
 * Slots 4, 9 and 10 were write-back-amended on 2026-09-14 to carry
 * `identity_status: verified_with_minor_source_difference` directly in the
 * packet, so forcing is a no-op for them — the entries below are kept only
 * to supply each envelope's citation note (see the `identityStatus`
 * computation below, which reads the packet status directly once it is
 * already resolved).
 */
const DOCUMENTED_IDENTITY_RESOLUTIONS = {
  3: {
    note:
      "identity.identityStatus resolved from provisional_formula_conflict to verified_with_minor_source_difference: known_conflicts documents the DE-pack Version A (dm.de, GTIN 810006945430) as authoritative for this gold set; the US-market variant (GTIN 810006943405, divergent INCI architecture) is recorded as a conflict, not merged.",
  },
  4: {
    note:
      "identity.identityStatus resolved from provisional_identity_conflict to verified_with_minor_source_difference (2026-09-14 write-back pass, packet notes/known_conflicts): three independent T3 aggregator captures (incibeauty.com EN, incibeauty.com DE, codecheck.info) return byte-identical INCI with zero contradiction, also independently confirmed by leave-in-classification-standard.md section 21.3's T18 reopening analysis ('a GTIN/product-page-availability question on a record whose three independent captures match each other exactly'); the residual is dm.de's current live-page availability under GTIN 4066447105032, not an absent GTIN or a formula conflict.",
  },
  9: {
    note:
      "identity.identityStatus resolved from provisional_identity_conflict to verified_with_minor_source_difference (2026-09-14 write-back pass, packet notes/known_conflicts): the round-4 evidence-gap-closure pass (data/research/leave-in-inci/v1.0/corpus/gold-set/round-4/evidence-gap-closure.md, Gap 2) found GTIN 884486453402 embedded in the redken.eu/de-de manufacturer packshot's image filenames, matching one of this record's two gtin_candidates exactly on a C2 manufacturer source; 884486453402 is promoted to gtin, and 884486210777 is retained as a non-German/legacy-packaging variant, not merged.",
  },
  10: {
    note:
      "identity.identityStatus resolved from provisional_identity_conflict to verified_with_minor_source_difference (2026-09-14 write-back pass, packet notes/known_conflicts): leave-in-classification-standard.md section 21.3 ledger row 14 (T14) records that the manufacturer's published 46-ingredient INCI matches the frozen douglas.de capture set-for-set and that EAN 850018802796 is confirmed at the German retailer xhair.eu, resolving the 46-vs-47 ingredient-count doubt as tail-count declaration variance, not a species-set conflict; the separate GTIN doubt (896364002602 vs 896364002619) remains open and unresolved.",
  },
}

/** The reference key's §4 confidence vocabulary onto the envelope's three-state scale. */
const CONFIDENCE = {
  low: "low",
  moderate: "moderate",
  moderately_high: "moderate",
  high: "high",
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"))
}

function clean(value) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : ""
}

function signals(slot, dimension, extras = []) {
  const out = [`reference key slot ${slot}`]
  if (dimension?.evidence_level) out.push(`evidence_level: ${dimension.evidence_level}`)
  if (dimension?.evidence_scope) out.push(`evidence_scope: ${dimension.evidence_scope}`)
  if (dimension?.row) out.push(`anchor row: ${dimension.row}`)
  for (const extra of extras) {
    const text = clean(extra)
    if (text) out.push(text)
  }
  return [...new Set(out)]
}

function evidence({ value, confidence, rationale, evidenceSignals, derivation, thresholds, limits }) {
  const thresholdReasoning = thresholds.map(clean).filter(Boolean)
  if (thresholdReasoning.length < 2) {
    throw new Error(`thresholdReasoning needs at least two entries (value ${JSON.stringify(value)})`)
  }
  const limitations = limits.map(clean).filter(Boolean)
  if (limitations.length === 0) {
    throw new Error(`limitations needs at least one entry (value ${JSON.stringify(value)})`)
  }
  const rationaleText = clean(rationale)
  if (!rationaleText) throw new Error(`rationale is required (value ${JSON.stringify(value)})`)
  return {
    value,
    confidence,
    rationale: rationaleText,
    evidenceSignals: evidenceSignals.map(clean).filter(Boolean),
    derivation: clean(derivation),
    thresholdReasoning,
    limitations,
  }
}

const ANCHOR_EXCLUSIVITY =
  "§7 anchors are exclusive: the recorded value means the adjacent band's anchor row was not reached on this evidence."

function sourceIds(entry) {
  const seen = new Map()
  const ids = []
  for (const source of entry.source_urls ?? []) {
    const base = `${source.tier ?? "T?"}:${source.domain ?? "unknown"}`
    const count = seen.get(base) ?? 0
    seen.set(base, count + 1)
    ids.push(count === 0 ? base : `${base}#${count + 1}`)
  }
  if (ids.length === 0) ids.push(`packet:slot-${entry.slot}`)
  return ids
}

function buildEnvelope(product, entry, keyVersion) {
  const slot = product.slot
  const profile = product.profile
  const dimensions = product.dimensions
  const conflicts = entry.known_conflicts ?? []
  const applicationStage = product.identity?.application_stage?.value ?? []
  if (applicationStage.length === 0) {
    throw new Error(`slot ${slot}: reference key carries no identity.application_stage`)
  }
  const ids = sourceIds(entry)

  const identityResolution = DOCUMENTED_IDENTITY_RESOLUTIONS[slot]
  // Only force the status when the packet itself has not already been
  // write-back-amended to carry it (slot 3's case); for a slot whose packet
  // entry already reads `verified_with_minor_source_difference` directly
  // (slots 4, 9, 10 since 2026-09-14), this is a no-op and `entry.identity_status`
  // is used as-is — the allowlist entry then contributes only its citation
  // note (assumptionNotes below).
  const identityStatus =
    identityResolution && entry.identity_status !== "verified_with_minor_source_difference"
      ? "verified_with_minor_source_difference"
      : entry.identity_status

  const cond = dimensions.conditioning_potential
  const weight = dimensions.weight_residue_potential
  const pers = dimensions.persistence_removal_class
  const hold = dimensions.hold_route_state
  const heat = dimensions.heat_protection_evidence_state
  const r2 = dimensions.repair_surface_film
  const careDirection = product.care_direction
  const smoothing = product.smoothing_route

  const focusBasis =
    clean(profile.focus_basis) ||
    "§10.2: no qualifying route clears its anchor threshold beyond baseline conditioning, so the focus falls back to `general`."

  return {
    version: "leave-in-research-envelope-v1.0",
    researchMethod: { ...RESEARCH_METHOD },
    identity: {
      researchId: `leave-in-gold-set-slot-${String(slot).padStart(2, "0")}`,
      market: "DE/EU",
      exactProductName: entry.exact_product_name,
      brand: entry.brand,
      gtin: entry.gtin ?? null,
      productForm: profile.product_form,
      applicationStage: [...applicationStage],
      identityStatus,
      categoryBoundaryStatus: "eligible",
      confidence: IDENTITY_CONFIDENCE[identityStatus],
      sourceIds: ids,
    },
    formula: {
      status: conflicts.length > 0 ? "verified_with_minor_difference" : "verified",
      rawInci: entry.raw_inci,
      normalizedIngredients: [...entry.normalized_ingredients],
      formulaFingerprintSha256: entry.formulaFingerprintSha256,
      rawInciSha256: entry.rawInciSha256,
      sourceIds: ids,
    },
    profile: {
      conditioningLevel: evidence({
        value: profile.conditioning_level,
        confidence: CONFIDENCE[cond.confidence],
        rationale: `§7.2 COND resolved to \`${cond.value}\` on ${cond.evidence_scope} evidence at ${cond.evidence_level} (${keyVersion}, slot ${slot}).`,
        evidenceSignals: signals(slot, cond, [
          cond.absorbed_slip_observation
            ? `absorbed slip observation: ${cond.absorbed_slip_observation.m1_contributors} M1 contributor(s)`
            : "",
          cond.note,
        ]),
        derivation:
          "§10.1: `conditioning_level` <- COND (low->low, moderate->moderate, high->high, unknown->unknown).",
        thresholds: [
          `COND anchor recorded \`${cond.value}\` with confidence \`${cond.confidence}\`.`,
          ANCHOR_EXCLUSIVITY,
        ],
        limits: [
          `Evidence level ${cond.evidence_level} on ${cond.evidence_scope} scope: formula potential, not measured finished-product performance.`,
        ],
      }),
      weightPotential: evidence({
        value: profile.weight_potential,
        confidence: CONFIDENCE[weight.confidence],
        rationale: `§7.5 WT resolved to \`${weight.value}\`${weight.row ? ` on the \`${weight.row}\` anchor row` : ""} at ${weight.evidence_level} (${keyVersion}, slot ${slot}).`,
        evidenceSignals: signals(slot, weight, [
          weight.mandatory_counter_signal,
          weight.conflict_tag_applied === true ? "§10.1.2 weight conflict tag applied" : "",
          weight.conflict_tag_condition_failed,
        ]),
        derivation:
          "§10.1: `weight_potential` <- WT; the multi-family `moderate` row projects as plain `moderate` and its mandatory counter-signal stays in the trace (§10.1.1).",
        thresholds: [
          `WT anchor recorded \`${weight.value}\` with confidence \`${weight.confidence}\`.`,
          ANCHOR_EXCLUSIVITY,
        ],
        limits: [
          "§7.5 records a judgment-call limitation on every fine-hair value derived from this dimension.",
        ],
      }),
      persistence: evidence({
        value: profile.persistence,
        confidence: CONFIDENCE[pers.confidence],
        rationale: `§7.6 PERS recorded mechanism class \`${pers.value}\` at ${pers.evidence_level} (${keyVersion}, slot ${slot}).`,
        evidenceSignals: signals(slot, pers, [pers.note, pers.quat_structure ? `quat structure: ${pers.quat_structure}` : ""]),
        derivation:
          "§10.1: `persistence` <- the PERS mechanism class projected ordinally (volatile_or_water_soluble->low; neutral_non_volatile->moderate; ph_dependent_cationic->moderate; permanent_cationic->high).",
        thresholds: [
          `The recorded mechanism class \`${pers.value}\` maps to the ordinal \`${profile.persistence}\`.`,
          "G11: this is a mechanism ordering, not a duration claim.",
        ],
        limits: [
          "The ordinal states removal mechanism only; it never asserts how long the product stays on hair.",
        ],
      }),
      holdSupport: evidence({
        value: profile.hold_support,
        confidence: CONFIDENCE[hold.confidence],
        rationale: `§7.7 HOLD recorded \`${hold.value}\` at ${hold.evidence_level} (${keyVersion}, slot ${slot}).`,
        evidenceSignals: signals(slot, hold, [
          hold.note,
          hold.manufacturer_hold_level === null
            ? "manufacturer_hold_level: null (no C1/C2 hold level in the frozen claims)"
            : `manufacturer_hold_level: ${hold.manufacturer_hold_level}`,
        ]),
        derivation:
          "§10.1: `hold_support` <- the HOLD 3-state, unchanged and with no `unknown` member (§7.7).",
        thresholds: [
          `HOLD is a coarse presence read and recorded \`${hold.value}\`.`,
          "§10: `hold_support` gains no `unknown`, because §7.7's ontology cannot produce one.",
        ],
        limits: ["A coarse presence read; it never grades hold strength."],
      }),
      careDirection: evidence({
        value: profile.care_direction,
        confidence: CONFIDENCE[careDirection.confidence],
        rationale: `§9 care_direction resolved to \`${careDirection.value}\`${careDirection.row ? ` on the \`${careDirection.row}\` row` : ""} at ${careDirection.evidence_level} (${keyVersion}, slot ${slot}).`,
        evidenceSignals: signals(slot, careDirection, [
          careDirection.mandatory_counter_signal,
          careDirection.note,
        ]),
        derivation: "§10.1: `care_direction` <- §9.",
        thresholds: [
          `§9 recorded \`${careDirection.value}\` with confidence \`${careDirection.confidence}\`.`,
          "§9 constraint 3: positioning corroborates a direction but never creates one.",
        ],
        limits: ["§9's ceiling caps a formula-only direction at moderate confidence."],
      }),
      repairSupportLevel: evidence({
        value: profile.repair_support_level,
        confidence: CONFIDENCE[r2.confidence],
        rationale: clean(profile.repair_support_basis),
        evidenceSignals: signals(slot, r2, [
          `repair_surface_film: ${r2.value}`,
          r2.plain_hydrolysate_note,
          r2.note,
          r2.candidate_below_tail === true ? "candidate_below_tail: true" : "",
        ]),
        derivation:
          "§10.3.2: `repair_support_level` <- the fixed ordered rule over [repair_surface_film, conditioning_level, product_evidence].",
        thresholds: [
          `R2 recorded \`${r2.value}\` and conditioning_level \`${profile.conditioning_level}\`, which selects \`${profile.repair_support_level}\`.`,
          "§10.3.2 clause 1: a bond claim is not repair support; R3 is invisible to this rule.",
        ],
        limits: [
          "§10.3.2 ceiling: a formula-only value cannot exceed `medium`; `high` requires exact-product E3+ repair evidence.",
        ],
      }),
      focus: evidence({
        value: { primary: profile.focus.primary, secondary: [...profile.focus.secondary] },
        confidence: CONFIDENCE[cond.confidence],
        rationale: focusBasis,
        evidenceSignals: signals(slot, null, [
          `smoothing_route: ${smoothing?.value ?? "none"}`,
          `repair_surface_film: ${r2.value}`,
          `hold_route_state: ${hold.value}`,
          `weight_residue_potential: ${weight.value}`,
        ]),
        derivation:
          "§10.2: qualifying routes are collected beyond baseline conditioning (§10.2.1, permissive reading T13b), then the rank order repair > smoothing > curl_definition > heat_styling > detangling > volume_lightness > shine binds.",
        thresholds: [
          `Selected primary \`${profile.focus.primary}\` with secondary [${profile.focus.secondary.join(", ")}].`,
          "§10.2 principle 4: official positioning may corroborate a route but never creates one.",
        ],
        limits: [
          "A focus is a statement of distinctive purpose, not an efficacy claim or a measured endpoint.",
        ],
      }),
      specialistFunctions: evidence({
        value: { providesHeatProtection: profile.specialist_functions.provides_heat_protection },
        confidence: CONFIDENCE[heat.confidence],
        rationale: `§13.3 heat binary derived from HEAT trace state \`${heat.value}\` at ${heat.evidence_level} (${keyVersion}, slot ${slot}).`,
        evidenceSignals: signals(slot, heat, [
          heat.claim_tier ? `claim_tier: ${heat.claim_tier}` : "",
          heat.claim_source,
          heat.l9_member_present === false ? "no L9 member present" : "",
          heat.routes_to_review,
          heat.note,
        ]),
        derivation:
          "§13.3: claim-led with an L9 formula sanity-check; the production model carries one binary and the four-state evidence detail stays in the trace.",
        thresholds: [
          `HEAT trace state \`${heat.value}\` yields provides_heat_protection = ${profile.specialist_functions.provides_heat_protection}.`,
          "§13.3: a formula never manufactures a claim, and efficacy is never graded.",
        ],
        limits: [
          "The binary reports what the product is sold as under EU claim law; it is not an efficacy statement (§3.3).",
        ],
      }),
      smoothingRoute: evidence({
        value: smoothing?.value ?? "none",
        confidence: CONFIDENCE[smoothing?.derived_from_sfr?.confidence ?? cond.confidence],
        rationale:
          clean(smoothing?.basis) ||
          "§7.4: no continuous alignment or film route is present as architecture, so the smoothing route is `none`.",
        evidenceSignals: signals(slot, smoothing?.derived_from_sfr ?? null, [
          `smoothing_route: ${smoothing?.value ?? "none"}`,
          smoothing?.derived_from_sfr
            ? `derived_from_sfr: ${smoothing.derived_from_sfr.value}`
            : "",
        ]),
        derivation:
          "§7.4 (T2): the route is typed from the recorded SFR observation plus §6 mechanism evidence; it is never graded and never itself projected as a production column.",
        thresholds: [
          `Typed as \`${smoothing?.value ?? "none"}\` from the recorded mechanism evidence.`,
          "§7.4.1's two-observation test gates whether a smoothing route exists at all.",
        ],
        limits: [
          "A route type, not a smoothing score; it carries no humidity or frizz claim (§7.9).",
        ],
      }),
      hairThicknessFit: evidence({
        value: { ...profile.hair_thickness_fit },
        confidence: CONFIDENCE[weight.confidence],
        rationale: `§10.3 hair_thickness_fit is weight-led; the \`${weight.value}\` row yields fine=${profile.hair_thickness_fit.fine}, medium=${profile.hair_thickness_fit.medium}, coarse=${profile.hair_thickness_fit.coarse}.`,
        evidenceSignals: signals(slot, weight, [weight.mandatory_counter_signal]),
        derivation: "§10.3: `hair_thickness_fit` <- weight_potential, and nothing else (G3).",
        thresholds: [
          `weight_potential \`${profile.weight_potential}\` selects the corresponding §10.3 row.`,
          "§10.3: no second weight-derived field may additionally modify this table.",
        ],
        limits: [
          "Broad product priors, not universal exclusions or efficacy claims; every fine-hair value carries the §7.5 judgment-call limitation.",
        ],
      }),
      damageFit: evidence({
        value: { ...profile.damage_fit },
        confidence: CONFIDENCE[cond.confidence],
        rationale:
          clean(profile.damage_fit_basis) ||
          `§10.3 damage_fit read from conditioning_level \`${profile.conditioning_level}\` and repair_surface_film \`${r2.value}\`.`,
        evidenceSignals: signals(slot, null, [
          `conditioning_level: ${profile.conditioning_level}`,
          `repair_surface_film: ${r2.value}`,
        ]),
        derivation:
          "§10.3: `damage_fit` <- [conditioning_level, repair_surface_film, bond_flag, product_evidence], with two independent paths to the highly-damaged tier (R14).",
        thresholds: [
          `The recorded inputs select the §10.3 row yielding healthy=${profile.damage_fit.healthy}, moderately_damaged=${profile.damage_fit.moderately_damaged}, highly_damaged=${profile.damage_fit.highly_damaged}.`,
          "§10.3 (R14): an R3 bond flag alone never qualifies a product for the highly-damaged tier.",
        ],
        limits: ["A broad prior for a damage tier, never an efficacy or repair claim."],
      }),
      textureFit: evidence({
        value: { ...profile.texture_fit },
        confidence: CONFIDENCE[weight.confidence],
        rationale: `§10.3 texture_fit is weight-led with the absorbed slip observation as the high-weight modifier; the \`${weight.value}\` row yields straight=${profile.texture_fit.straight}, wavy=${profile.texture_fit.wavy}, curly=${profile.texture_fit.curly}, coily=${profile.texture_fit.coily}.`,
        evidenceSignals: signals(slot, weight, [
          cond.absorbed_slip_observation
            ? `absorbed slip observation: ${cond.absorbed_slip_observation.m1_contributors} M1 contributor(s)`
            : "",
          `hold_route_state: ${hold.value}`,
        ]),
        derivation:
          "§10.3: `texture_fit` <- [weight_potential, conditioning_potential.absorbed_slip_observation, hold_route_state]; the table is exhaustive with an explicit `unknown` fallback row.",
        thresholds: [
          `weight_potential \`${profile.weight_potential}\` selects the §10.3 texture row.`,
          "§10.3: HOLD = meaningful_hold_route does not by itself raise curly/coily.",
        ],
        limits: ["A broad prior per texture family, not a per-user prediction."],
      }),
      uncertainFields: [...profile.uncertain_fields],
      assumptionNotes: [
        `Derived mechanically from ${keyVersion} and the frozen calibration packet; no re-classification, no web research, no re-judged evidence.`,
        ...(entry.known_conflicts ?? []).map(clean).filter(Boolean),
        ...(identityResolution ? [identityResolution.note] : []),
      ],
    },
  }
}

function main() {
  const key = readJson(KEY_PATH)
  const packet = readJson(PACKET_PATH)
  const keyVersion = key.key_version

  rmSync(OUT_DIR, { recursive: true, force: true })
  mkdirSync(OUT_DIR, { recursive: true })

  const built = []
  for (const product of key.products) {
    if (!product.profile) continue
    const entry = packet.entries.find((candidate) => candidate.slot === product.slot)
    if (!entry) throw new Error(`slot ${product.slot}: no calibration-packet entry`)
    const envelope = buildEnvelope(product, entry, keyVersion)
    const fileName = `slot-${String(product.slot).padStart(2, "0")}.json`
    writeFileSync(path.join(OUT_DIR, fileName), `${JSON.stringify(envelope, null, 2)}\n`)
    built.push(fileName)
  }

  const written = readdirSync(OUT_DIR).sort()
  process.stdout.write(
    `${JSON.stringify({ built: built.length, files: written, outDir: path.relative(ROOT, OUT_DIR) }, null, 2)}\n`,
  )
}

main()
