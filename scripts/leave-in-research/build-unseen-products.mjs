// Sibling module for scripts/leave-in-research/build-lab-fixture.mjs.
//
// Builds the Lab's second product batch ("unseen-test", 6 products) from the
// unseen-product-test artifacts in data/research/leave-in-inci/v1.0/corpus/unseen-test/
// — a structurally different input than the gold set's markdown evidence
// chains, so it gets its own builder rather than being threaded through the
// markdown-parsing machinery in build-lab-fixture.mjs.
//
// Source shape: lane-a/records.json holds six JSON records (slots "u1".."u6")
// in the SAME schema as the gold set's reference-key-v4/reference-key.json
// products (g0_state, dimensions{}, hinweise, care_direction, profile{},
// review_routing{}) — and, unlike the gold set, almost every rationale
// already lives directly in the JSON (anchor / threshold_reasoning /
// counter_signals / limitations / assumption_notes prose) rather than in a
// separate markdown evidence chain. So this builder mostly never parses
// markdown: every `rationale` and `reasoningShort` is built by quoting (and,
// where the 260-char budget requires it, truncating) the record's own prose
// fields — never inventing new justification text. The one exception is
// care_direction, whose JSON entry carries no prose at all (just {value,
// confidence, evidence_level}); its rationale is instead recovered by
// quoting the matching notes markdown files verbatim — see
// careDirectionNotesRationale below (Nick's 2026-09-12 ruling: every
// reviewable row must carry reasoning, low-confidence reasoning is fine,
// absent reasoning is not).
//
// Lane choice: lane-a is used exclusively (the conservative-consensus lane;
// see unseen-test-report.md — lane-a and lane-b agree on every value field
// except 9 fields on u1, all caused by one three-way INCI source conflict).
// Identity/INCI/directions/claims come from the frozen unseen-packet.json,
// exactly as the gold set sources its identity block from calibration-
// packet.json rather than from the reference key.
//
// Excluded records (u2, u3; g0_state excluded_*): the unseen-test records
// carry no §7 dimensions or lean profile at all for an excluded product
// (§2.3.1's emission contract — see each record's own review_routing.notes),
// so — unlike the gold set's excluded slots 7/12, which still carry an
// informational §7 table — these emit only the single G0 property. That is
// the fixture's existing shape for "an excluded record with nothing to
// review beyond G0": `properties: z.array(propertySchema).min(1)` is
// satisfied by the one row, and no `profile` group properties exist.

import { readFileSync } from "node:fs"
import path from "node:path"

import {
  slugify,
  fingerprint,
  displayValue,
  DIMENSION_ABBREVIATIONS,
  DIMENSION_LABELS,
  ECHO_OF_DIMENSION,
  PROFILE_LABELS,
} from "./lab-fixture-shared.mjs"

const REASONING_SHORT_GAP = "— (Begründung fehlt im Quellrecord)"
const MAX_REASONING_SHORT = 260

// ------------------------------------------------------------- adjudication --
//
// formula_source_conflict_rule (Kandidat T18 — Vorrangregel bei Formel-
// Quellkonflikten) was removed 2026-09-12: Nick's binding ruling T18 settles
// the general precedence rule for future formula-source conflicts —
// convergence resolution is primary (three or more independent sources with
// matching formula/F.I.L. codes resolve the conflict directly), conservative-
// unknown is the fallback otherwise. The rule is encoded in the standard
// (§2.4 area, ledger row 18). u1, the one record this banner was ever
// attached to, is already conformant: its 2026-09-12 re-derivation
// (rederived/u1-record.json) resolved the record itself by exactly this kind
// of 3-source convergence (Rossmann, parfumdreams, codecheck — identical
// 31-ingredient list, matching formula/F.I.L. codes), and the now-ruled
// general question leaves nothing open for a reviewer to adjudicate. Kept
// here, commented out, as the retired registry — same precedent as
// build-lab-fixture.mjs's ADJUDICATIONS/ADJUDICATION_ASSIGNMENTS history for
// focus_permissive_vs_conservative, heat_retailer_tier_only, neqi_boundary
// and repair_support_level_uncalibrated (see that file's "adjudication"
// section).
//
// const T18_ADJUDICATION = {
//   id: "formula_source_conflict_rule",
//   title: "Formel-Quellkonflikt bei mehreren INCI-Quellen (Kandidat T18)",
//   note: "Drei unabhängige INCI-Quellen desselben Produkts widersprechen sich (38/35/31 Inhaltsstoffe). Lane A setzt betroffene Dimensionen auf unknown (§2.4-Lesart), Lane B klassifiziert aus der eingefrorenen Primärquelle und routet die Unsicherheit (G5-Lesart). Regelentscheidung nötig: Vorrangregel bei Formel-Quellkonflikten (Kandidat T18). Angezeigt werden die konservativen Lane-A-Werte.",
//   source:
//     "data/research/leave-in-inci/v1.0/corpus/unseen-test/unseen-test-report.md · „The one real disagreement — u1 formula-source conflict“",
// }
//
// const T18_ADJUDICATION_RESOLVED_RECORD = {
//   id: "formula_source_conflict_rule",
//   title: "Formel-Quellkonflikt: Record aufgelöst — Regelentscheidung offen (Kandidat T18)",
//   note: "Der Quellkonflikt dieses Records ist per Evidenz aufgelöst: 3-Quellen-Konvergenz (Rossmann, parfumdreams, codecheck — identische 31-Ingredient-Liste, gleiche Formel- und F.I.L.-Codes) hat die aktuelle Regalformel bestimmt; das Packet wurde re-verankert und der Record neu abgeleitet (keine unknown-Felder mehr). Offen bleibt die generelle Vorrangregel für künftige Formel-Quellkonflikte (Kandidat T18): unknown + Review (§2.4-Lesart), Primärquelle + Routing (G5-Lesart) oder Konvergenz-Auflösung ab drei unabhängigen Quellen mit übereinstimmenden Formel-Codes.",
//   source:
//     "data/research/leave-in-inci/v1.0/corpus/unseen-test/u1-formula-recency.md · Verdict; unseen-packet.json · amendment_log",
// }

function truncate(text, max = MAX_REASONING_SHORT) {
  const trimmed = text.trim().replace(/\s+/g, " ")
  if (trimmed.length <= max) return trimmed
  return `${trimmed.slice(0, max - 1).trimEnd()}…`
}

// --- care_direction rationale, recovered from the notes files ---------------
//
// Nick's 2026-09-12 ruling: every reviewable row must carry reasoning (low-
// confidence reasoning is fine, absent reasoning is not). lane-a/records.json
// carries no per-field prose for care_direction (only {value, confidence,
// evidence_level}), so — unlike every other property in this file, which
// quotes prose already sitting in the JSON record — the four in-category
// products' care_direction rationale is recovered by quoting the researchers'
// own care-direction reasoning out of the notes files that DID capture it in
// prose: the post-amendment re-derivation notes for u1 (a dedicated,
// gold-set-evidence-chain-style `## care_direction` section) and the
// per-product lane-a write-up for u4/u5/u6 (one numbered-bullet list per
// product, headed `## u{N} — <product>`, with no dedicated per-field
// sections). Quoted verbatim and truncated to the 260-char reasoningShort
// budget — never invented; a product whose section carries no identifiable
// care-direction reasoning keeps the honest rationaleExtractionGap.

function readNotesFile(filePath) {
  try {
    return readFileSync(filePath, "utf8")
  } catch {
    return null
  }
}

// A markdown "paragraph": text.split(/\n(?=\d+\.\s)/) callers pass in a
// section or bullet body; here we split on blank lines.
function paragraphContaining(text, marker) {
  return text.split(/\n\s*\n/).find((paragraph) => paragraph.includes(marker)) ?? null
}

// Naive sentence split (after a ". ") — good enough for the hand-written
// prose in these notes files, used only to narrow a long bullet down to the
// one sentence that actually names `care_direction`.
function sentenceContaining(text, marker) {
  return text.split(/(?<=\.)\s+/).find((sentence) => sentence.includes(marker)) ?? null
}

function parentheticalContaining(text, prefix) {
  const match = new RegExp(`\\(${prefix}[^)]*\\)`).exec(text)
  return match ? match[0] : null
}

function firstSentences(text, count) {
  return text.split(/(?<=\.)\s+/).slice(0, count).join(" ")
}

// reasoningShort is rendered as plain text (research-lab-client.tsx renders
// `rationale` through a markdown-lite parser that understands `**bold**`,
// `` `code` `` and tables, but reasoningShort is a raw string in a table
// cell) — strip the bold markers the notes' prose uses so the short field
// does not show literal asterisks.
function plainText(text) {
  return text.replace(/\*/g, "").trim()
}

// u1's post-amendment re-derivation notes document each topic under its own
// numbered heading (mirroring the gold-set evidence chains' `## care_direction`
// sections — see build-lab-fixture.mjs's `careSection` lookup), unlike
// lane-a/notes.md's per-product bullet write-ups. Extracts the
// `## 7. \`care_direction\`` section body verbatim.
function extractU1CareDirectionPassage(notesText) {
  if (!notesText) return null
  const lines = notesText.split("\n")
  const headingIndex = lines.findIndex((line) => /^##\s+.*care_direction/.test(line))
  if (headingIndex === -1) return null
  const body = []
  for (let i = headingIndex + 1; i < lines.length; i++) {
    if (/^##\s+/.test(lines[i]) || /^---\s*$/.test(lines[i])) break
    body.push(lines[i])
  }
  const text = body.join("\n").trim()
  return text.length ? text : null
}

// lane-a/notes.md documents all seven topics for a product as one numbered
// list under `## u{N} — <product>` (located by slot id; falls back to the
// product name for robustness). Returns the bullet that reasons about
// care_direction: the literal assertion when the write-up names the field
// directly (u5: "`care_direction` is `moisture` ..."), or else the bullet
// that establishes the §9 legs — the COND/WT ingredient architecture
// (cationic/emollient/silicone) care_direction is read off — for a product
// whose write-up never spells the field out by name (u4, u6). Returns null,
// an honest gap, when neither exists.
function extractLaneACareDirectionBullet(notesText, slot, productName) {
  if (!notesText) return null
  const lines = notesText.split("\n")
  let startIndex = lines.findIndex((line) => new RegExp(`^##\\s+${slot}\\b`).test(line))
  if (startIndex === -1 && productName)
    startIndex = lines.findIndex((line) => /^##\s+/.test(line) && line.includes(productName))
  if (startIndex === -1) return null
  let endIndex = lines.length
  for (let i = startIndex + 1; i < lines.length; i++) {
    if (/^##\s+/.test(lines[i]) || /^---\s*$/.test(lines[i])) {
      endIndex = i
      break
    }
  }
  const bullets = lines
    .slice(startIndex + 1, endIndex)
    .join("\n")
    .split(/\n(?=\d+\.\s)/)
    .map((bullet) => bullet.trim().replace(/^\d+\.\s*/, ""))
    .filter(Boolean)

  const assertion = bullets.find((bullet) => /`care_direction`\s+(is|=)\s*`?[a-z_]+`?/i.test(bullet))
  if (assertion) return { bullet: assertion, kind: "explicit" }

  const architecture = bullets.find((bullet) => /COND\s*`/.test(bullet))
  if (architecture) return { bullet: architecture, kind: "architecture" }

  return null
}

// Returns { rationale, shortText, source } or null (an honest gap) for a
// given in-category unseen-test record's care_direction property.
function careDirectionNotesRationale({ unseenDir, record }) {
  if (record.slot === "u1") {
    // Only the post-amendment re-derivation resolved u1's care_direction to a
    // value (`moisture`); the raw lane-a record's value is `unknown` (the
    // three-way formula conflict), for which no notes passage should be
    // attached — the honest gap is the correct read there.
    if (record.care_direction?.value === "unknown") return null
    const notesPath = path.join(unseenDir, "rederived", "u1-notes.md")
    const passage = extractU1CareDirectionPassage(readNotesFile(notesPath))
    if (!passage) return null
    const short = paragraphContaining(passage, "⇒ `moisture`") ?? passage
    return {
      rationale: passage,
      shortText: plainText(short),
      source: "data/research/leave-in-inci/v1.0/corpus/unseen-test/rederived/u1-notes.md · §7 `care_direction`",
    }
  }

  const notesPath = path.join(unseenDir, "lane-a", "notes.md")
  const found = extractLaneACareDirectionBullet(readNotesFile(notesPath), record.slot, record.product)
  if (!found) return null

  let short
  if (found.kind === "explicit") {
    short = sentenceContaining(found.bullet, "`care_direction`") ?? found.bullet
  } else {
    // The architecture bullet's COND mention isn't always inside its own
    // parenthetical (u4: "COND `high` (LGN pair ...)"); when it is (u6: "(COND
    // `high` is independently establishable ...)"), that parenthetical alone
    // is the tightest on-topic quote — otherwise fall back to the bullet's
    // first two sentences (COND, then WT), which is where this write-up's
    // architecture legs live.
    short = parentheticalContaining(found.bullet, "COND") ?? firstSentences(found.bullet, 2)
  }

  const sectionLabel =
    found.kind === "explicit"
      ? `${record.slot} care_direction bullet`
      : `${record.slot} COND/WT architecture bullet (no dedicated care_direction bullet in the notes)`

  return {
    rationale: found.bullet,
    shortText: plainText(short),
    source: `data/research/leave-in-inci/v1.0/corpus/unseen-test/lane-a/notes.md · ${sectionLabel}`,
  }
}

function profileValueAt(profile, propertyPath) {
  if (!profile) return undefined
  return propertyPath
    .split(".")
    .reduce(
      (accumulator, segment) =>
        accumulator === null || accumulator === undefined ? undefined : accumulator[segment],
      profile,
    )
}

function formatValue(value) {
  if (value === null || value === undefined) return "null"
  if (Array.isArray(value))
    return value.length
      ? value.map((item) => (typeof item === "object" ? JSON.stringify(item) : String(item))).join(" · ")
      : "[]"
  if (typeof value === "object") return JSON.stringify(value)
  return String(value)
}

const DIMENSION_OBSERVATION_SKIP_KEYS = new Set([
  "value",
  "confidence",
  "evidence_level",
  "evidence_scope",
  "counter_signals",
])

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

// One level of flattening for a nested object field (e.g. `absorbed_slip_observation`,
// `weight_conflict_tag`) — `key.subkey: value` observation rows, mirroring the
// gold-set builder's own `absorbed_slip_observation.*` convention, rather than
// one opaque JSON-stringified blob per field.
function dimensionObservations(entry) {
  const observations = []
  for (const [key, value] of Object.entries(entry)) {
    if (DIMENSION_OBSERVATION_SKIP_KEYS.has(key)) continue
    if (isPlainObject(value)) {
      for (const [subKey, subValue] of Object.entries(value))
        observations.push(`${key}.${subKey}: ${formatValue(subValue)}`)
    } else {
      observations.push(`${key}: ${formatValue(value)}`)
    }
  }
  return observations
}

function counterSignalsOf(entry) {
  const counterSignals = entry.counter_signals
  if (!counterSignals) return []
  return Array.isArray(counterSignals) ? counterSignals : [String(counterSignals)]
}

function buildDimensionRationale(entry) {
  const parts = []
  if (entry.anchor) parts.push(entry.anchor)
  if (entry.conflict_detail) parts.push(`Conflict detail: ${entry.conflict_detail}`)
  if (entry.threshold_reasoning) parts.push(`Threshold reasoning: ${entry.threshold_reasoning}`)
  if (Array.isArray(entry.limitations) && entry.limitations.length)
    parts.push(`Limitations: ${entry.limitations.join(" ")}`)
  return parts.length ? parts.join("\n\n") : null
}

function buildHinweiseRationale(hinweise) {
  const parts = []
  if (hinweise.rule) parts.push(hinweise.rule)
  for (const entry of hinweise.fired)
    parts.push(`${entry.flag} = ${displayValue(entry.value)}: ${entry.note}`)
  if (hinweise.curl_note) parts.push(`CURL: ${hinweise.curl_note}`)
  return parts.length ? parts.join("\n\n") : null
}

function buildProductFormRationale(value, packetEntry) {
  return `Presentation form ${value}, captured at identity (T10): pack ${packetEntry.pack_size}; Anwendung: „${packetEntry.directions_of_use}“.`
}

function findAssumptionNote(notes, keyword) {
  return (notes ?? []).find((note) => note.includes(keyword)) ?? null
}

// focus.secondary rarely gets its own dedicated assumption note (it is often
// folded into the focus.primary note's route-by-route walkthrough) — fall
// back to the primary note, then to the first note, rather than emitting a
// gap for a field the record does explain, just not under its own heading.
function focusNote(notes, profilePath) {
  return (
    findAssumptionNote(notes, profilePath) ??
    findAssumptionNote(notes, "focus.primary") ??
    notes?.[0] ??
    null
  )
}

function buildApplicationStageBasis(stages, basisStrings) {
  const fallback = (basisStrings ?? []).join(" ")
  return stages.map((stage) => {
    const match = (basisStrings ?? []).find((entry) => entry.includes(`${stage} —`))
    return { stage, quote: match ?? fallback }
  })
}

// Splits a record's `review_routing.notes` (one long " | "-joined string) back
// into {trigger, basis} pairs, matching each declared trigger to the segment
// that names it — the same shape the gold-set builder reads off a markdown
// "Review routing" table.
function parseTriggerBasis(triggers, notes) {
  if (!notes) return triggers.map((trigger) => ({ trigger, basis: "" }))
  const segments = notes.split(" | ")
  return triggers.map((trigger) => {
    const segment = segments.find(
      (entry) =>
        entry.startsWith(`${trigger} (`) || entry.startsWith(`${trigger}:`) || entry.startsWith(`${trigger} `),
    )
    return { trigger, basis: (segment ?? notes).trim() }
  })
}

const REVIEW_NOTE_ALIASES = {
  g0: ["g0", "boundary", "dual_use", "anhydrous", "styling"],
  "dimension.weight_residue_potential": ["weight", "wt", "conflict"],
  "dimension.persistence_removal_class": ["persistence", "quat", "pers"],
  "dimension.repair_surface_film": ["repair", "r2", "below_marker", "bond"],
  "dimension.conditioning_potential": ["cond", "slip"],
  "dimension.hold_route_state": ["hold"],
  "dimension.heat_protection_evidence_state": ["heat", "l9", "claim"],
  "dimension.fragrance_scalp_exposure": ["fragrance", "allergen"],
  hinweise: ["buildup", "transfer", "layer", "r3"],
  care_direction: ["care_direction", "care direction"],
  "profile.product_form": ["product_form", "form"],
  "profile.repair_support_level": ["repair"],
  "profile.focus.primary": ["focus"],
  "profile.focus.secondary": ["focus"],
  "profile.specialist_functions.provides_heat_protection": ["heat", "l9", "claim"],
  "profile.hair_thickness_fit.fine": ["thickness", "weight"],
  "profile.hair_thickness_fit.medium": ["thickness", "weight"],
  "profile.hair_thickness_fit.coarse": ["thickness", "weight"],
  "profile.damage_fit.healthy": ["damage"],
  "profile.damage_fit.moderately_damaged": ["damage"],
  "profile.damage_fit.highly_damaged": ["damage"],
  "profile.texture_fit.straight": ["texture", "row_5", "row_4"],
  "profile.texture_fit.wavy": ["texture", "row_5", "row_4"],
  "profile.texture_fit.curly": ["texture", "row_5", "row_4"],
  "profile.texture_fit.coily": ["texture", "row_5", "row_4"],
}

function reviewNoteFor(propertyPath, triggerBasis) {
  const aliases = REVIEW_NOTE_ALIASES[propertyPath] ?? []
  if (!aliases.length) return null
  const hits = triggerBasis.filter((entry) => {
    const trigger = entry.trigger.toLowerCase()
    const basis = entry.basis.toLowerCase()
    return aliases.some((alias) => trigger.includes(alias) || basis.includes(alias))
  })
  return hits.length ? hits.map((hit) => `${hit.trigger}: ${hit.basis}`).join(" | ") : null
}

function makeProperty({
  path: propertyPath,
  group,
  label,
  rawValue,
  confidence = null,
  evidenceLevel = null,
  evidenceScope = null,
  informational = false,
  echo = null,
  rationale = null,
  shortText = null,
  rationaleSource,
  observations = [],
  counterSignals = [],
  derivedFrom = [],
  reviewNote = null,
  adjudication = null,
}) {
  const hasRationale = typeof rationale === "string" && rationale.trim().length > 0
  const shortSource = typeof shortText === "string" && shortText.trim().length > 0 ? shortText : rationale
  const hasShortSource = typeof shortSource === "string" && shortSource.trim().length > 0
  return {
    path: propertyPath,
    group,
    label,
    value: displayValue(rawValue),
    rawValue: rawValue === undefined ? null : rawValue,
    confidence,
    evidenceLevel,
    evidenceScope,
    informational,
    echo,
    reasoningShort: hasShortSource ? truncate(shortSource) : REASONING_SHORT_GAP,
    rationale: hasRationale ? rationale.trim() : null,
    rationaleSource: hasRationale ? rationaleSource : "json_fields_only",
    rationaleExtractionGap: !hasRationale,
    observations,
    counterSignals,
    derivedFrom,
    reviewNote,
    adjudication,
  }
}

function buildIdentity(record, packetEntry) {
  const stage = record.identity?.application_stage
  return {
    gtin: record.gtin ?? null,
    gtinCandidates: packetEntry.gtin_candidates ?? null,
    market: packetEntry.market,
    packSize: packetEntry.pack_size,
    identityStatus: record.identity_status,
    rawInci: packetEntry.raw_inci,
    normalizedIngredients: packetEntry.normalized_ingredients,
    directionsOfUse: packetEntry.directions_of_use,
    directionsStatus: packetEntry.directions_status,
    directionsSource: packetEntry.directions_source ?? null,
    applicationStage: stage
      ? {
          value: stage.value,
          evidenceLevel: stage.evidence_level,
          evidenceScope: stage.evidence_scope,
          sourceTier: stage.source_tier,
          basis: buildApplicationStageBasis(stage.value, stage.basis),
          note: stage.note ?? null,
        }
      : null,
    claims: (packetEntry.claims ?? []).map((claim) => ({
      claimText: claim.claim_text,
      claimType: claim.claim_type ?? null,
      authorityTier: claim.source_authority_tier ?? null,
      tierBasis: claim.claim_tier_basis ?? null,
      domain: claim.domain ?? null,
      url: claim.url ?? null,
      date: claim.date ?? null,
      createsClaim: claim.creates_claim ?? null,
      note: claim.note ?? null,
    })),
    claimsStatus: packetEntry.claims_status,
    knownConflicts: packetEntry.known_conflicts ?? [],
    remainingGap: packetEntry.remaining_gap ?? null,
    sourceUrls: packetEntry.source_urls ?? [],
    tailMarker: record.tail_marker ?? null,
    fingerprints: {
      rawInciSha256: packetEntry.rawInciSha256,
      formulaFingerprintSha256: packetEntry.formulaFingerprintSha256,
    },
  }
}

function buildG0(record) {
  return {
    state: record.g0_state,
    outOfCategory: record.out_of_category,
    rationale: record.g0_rationale,
    informationalOnly: record.informational_and_non_authoritative === true,
    profileNote: record.profile_note ?? null,
  }
}

function buildReviewRouting(record) {
  const triggers = record.review_routing?.triggers ?? []
  const notes = record.review_routing?.notes ?? null
  return {
    reviewStatus: "draft",
    routed: triggers.length > 0,
    triggers,
    triggerBasis: parseTriggerBasis(triggers, notes),
  }
}

function g0Property(record, triggerBasis) {
  return makeProperty({
    path: "g0",
    group: "g0",
    label: "G0 — Produktform-Gate",
    rawValue: record.g0_state,
    evidenceScope: "product",
    rationale: record.g0_rationale,
    shortText: record.g0_rationale,
    rationaleSource: `lane-a/records.json · ${record.slot}.g0_rationale`,
    observations: [
      `g0_rationale: ${record.g0_rationale}`,
      `out_of_category: ${record.out_of_category}`,
      `identity_status: ${record.identity_status}`,
    ],
    reviewNote: reviewNoteFor("g0", triggerBasis),
  })
}

function fingerprintProperty(property) {
  return fingerprint({
    path: property.path,
    value: property.value,
    rationale: property.rationale,
    observations: property.observations,
    counterSignals: property.counterSignals,
    derivedFrom: property.derivedFrom,
    echo: property.echo,
  })
}

function buildExcludedProduct({ record, packetEntry, productId, slot }) {
  const triggerBasis = parseTriggerBasis(
    record.review_routing?.triggers ?? [],
    record.review_routing?.notes ?? null,
  )
  const properties = [g0Property(record, triggerBasis)]
  const propertyFingerprints = Object.fromEntries(
    properties.map((property) => [property.path, fingerprintProperty(property)]),
  )
  return {
    productId,
    slot,
    batch: "unseen-test",
    brand: record.brand,
    productName: record.product,
    archetypeRole: packetEntry.archetype_role,
    identity: buildIdentity(record, packetEntry),
    g0: buildG0(record),
    reviewRouting: buildReviewRouting(record),
    uncertainFields: [],
    cautionsDe: record.cautions_de ?? [],
    properties,
    propertyFingerprints,
    productFingerprint: fingerprint(propertyFingerprints),
  }
}

function buildInCategoryProduct({ record, packetEntry, productId, slot, unseenDir }) {
  const triggerBasis = parseTriggerBasis(
    record.review_routing?.triggers ?? [],
    record.review_routing?.notes ?? null,
  )
  const properties = [g0Property(record, triggerBasis)]

  for (const [dimensionKey, abbreviation] of Object.entries(DIMENSION_ABBREVIATIONS)) {
    const entry = record.dimensions[dimensionKey]
    if (!entry) throw new Error(`unseen ${record.slot} missing dimension ${dimensionKey}`)
    const echoPath = ECHO_OF_DIMENSION[dimensionKey]
    const echoValue = echoPath ? profileValueAt(record.profile, echoPath) : undefined
    properties.push(
      makeProperty({
        path: `dimension.${dimensionKey}`,
        group: "dimension",
        label: `${abbreviation} — ${DIMENSION_LABELS[dimensionKey]}`,
        rawValue: entry.value,
        confidence: entry.confidence ?? null,
        evidenceLevel: entry.evidence_level ?? null,
        evidenceScope: entry.evidence_scope ?? null,
        echo:
          echoValue === undefined
            ? null
            : { field: echoPath, value: displayValue(echoValue), label: "Profilwert" },
        rationale: buildDimensionRationale(entry),
        shortText: entry.anchor,
        rationaleSource: `lane-a/records.json · ${record.slot}.dimensions.${dimensionKey}`,
        observations: dimensionObservations(entry),
        counterSignals: counterSignalsOf(entry),
        reviewNote: reviewNoteFor(`dimension.${dimensionKey}`, triggerBasis),
        adjudication: null,
      }),
    )
  }

  properties.push(
    makeProperty({
      path: "hinweise",
      group: "hinweise",
      label: "Hinweise (§8) — nur was ausgelöst hat",
      rawValue: record.hinweise.fired.length
        ? record.hinweise.fired.map((entry) => entry.flag)
        : "keine Hinweise ausgelöst",
      informational: true,
      rationale: buildHinweiseRationale(record.hinweise),
      shortText: record.hinweise.rule,
      rationaleSource: `lane-a/records.json · ${record.slot}.hinweise`,
      observations: [
        ...record.hinweise.fired.map(
          (entry) => `${entry.flag} = ${displayValue(entry.value)} — ${entry.note}`,
        ),
        `r3_state: ${record.hinweise.r3_state}`,
        ...(record.hinweise.r3_review_routing?.length
          ? [`r3_review_routing: ${record.hinweise.r3_review_routing.join(" · ")}`]
          : []),
        `CURL: ${record.hinweise.curl_note}`,
        `SHN-Qualifier: ${record.hinweise.shn_qualifier ?? "nicht gesetzt"}`,
      ],
      derivedFrom: ["SHN", "CURL", "R3", "LAYER", "buildup", "transfer"],
      reviewNote: reviewNoteFor("hinweise", triggerBasis),
    }),
  )

  // care_direction carries no per-field prose in the lane-a record itself
  // (only {value, confidence, evidence_level}) — recovered from the notes
  // files instead (see careDirectionNotesRationale above); an honest
  // rationaleExtractionGap only where no notes passage exists either.
  const careNotes = careDirectionNotesRationale({ unseenDir, record })
  properties.push(
    makeProperty({
      path: "care_direction",
      group: "care_direction",
      label: "Pflegerichtung (§9)",
      rawValue: record.care_direction.value,
      confidence: record.care_direction.confidence ?? null,
      evidenceLevel: record.care_direction.evidence_level ?? null,
      evidenceScope: record.care_direction.evidence_scope ?? null,
      echo: { field: "care_direction", value: displayValue(record.profile.care_direction), label: "Profilwert" },
      rationale: careNotes?.rationale ?? null,
      shortText: careNotes?.shortText ?? null,
      rationaleSource: careNotes?.source ?? `lane-a/records.json · ${record.slot}.care_direction`,
      reviewNote: reviewNoteFor("care_direction", triggerBasis),
      adjudication: null,
    }),
  )

  for (const [profilePath, label] of Object.entries(PROFILE_LABELS)) {
    const rawValue = profileValueAt(record.profile, profilePath) ?? null
    let rationale = null
    let shortText = null
    let rationaleSource = "json_fields_only"
    const observations = []
    let derivedFrom = []

    if (profilePath === "product_form") {
      rationale = buildProductFormRationale(rawValue, packetEntry)
      shortText = rationale
      rationaleSource = `unseen-packet.json · ${record.slot}.pack_size + directions_of_use (E1, T10)`
      derivedFrom = ["identity (pack + product name + directions, E1)"]
      const architecture = record.reading_conventions?.architecture
      if (architecture) {
        observations.push(
          `reading_conventions.architecture (§3.1.2, trace-only, T11): ${architecture.value}`,
          "product_form is not derived from the architecture read — it is captured directly at identity (§7.1, §3.1.2, §10.1, T10).",
        )
      }
    } else if (profilePath === "repair_support_level") {
      rationale = record.profile.repair_support_basis
      shortText = rationale
      rationaleSource = `lane-a/records.json · ${record.slot}.profile.repair_support_basis`
      derivedFrom = ["R2", "COND", "product_evidence"]
      observations.push(
        `Ableitung (§10.3.2): ${record.profile.repair_support_basis}`,
        `repair_surface_film: ${record.dimensions.repair_surface_film.value}`,
        `conditioning_level: ${record.profile.conditioning_level}`,
        `R3-Zustand: ${record.hinweise.r3_state} — für diese Regel unsichtbar (R14, G8)`,
      )
    } else if (profilePath === "focus.primary" || profilePath === "focus.secondary") {
      const note = focusNote(record.profile.assumption_notes, profilePath)
      rationale = note
      shortText = note
      rationaleSource = `lane-a/records.json · ${record.slot}.profile.assumption_notes`
      if (record.smoothing_route) {
        const basis = Array.isArray(record.smoothing_route.basis)
          ? record.smoothing_route.basis.join(" | ")
          : record.smoothing_route.basis
        observations.push(
          `smoothing_route: ${record.smoothing_route.value} — ${basis}`,
          `smoothing_route.rule: ${record.smoothing_route.rule}`,
        )
      }
    } else if (profilePath === "specialist_functions.provides_heat_protection") {
      const heat = record.dimensions.heat_protection_evidence_state
      rationale = [heat.claim_authority, heat.formula_sanity_check].filter(Boolean).join("\n\n") || null
      shortText = heat.formula_sanity_check ?? heat.claim_authority ?? null
      rationaleSource = `lane-a/records.json · ${record.slot}.dimensions.heat_protection_evidence_state`
    } else if (profilePath.startsWith("hair_thickness_fit.")) {
      const note = findAssumptionNote(record.profile.assumption_notes, "hair_thickness_fit")
      rationale = note
      shortText = note
      rationaleSource = `lane-a/records.json · ${record.slot}.profile.assumption_notes`
      derivedFrom = ["WT"]
    } else if (profilePath.startsWith("damage_fit.")) {
      const note = findAssumptionNote(record.profile.assumption_notes, "damage_fit")
      rationale = note
      shortText = note
      rationaleSource = `lane-a/records.json · ${record.slot}.profile.assumption_notes`
      derivedFrom = ["COND", "R2", "R3", "product_evidence"]
    } else if (profilePath.startsWith("texture_fit.")) {
      const note = findAssumptionNote(record.profile.assumption_notes, "texture_fit")
      rationale = note
      shortText = note
      rationaleSource = `lane-a/records.json · ${record.slot}.profile.assumption_notes`
      derivedFrom = ["WT", "COND (absorbed slip observation)", "HOLD"]
    }

    properties.push(
      makeProperty({
        path: `profile.${profilePath}`,
        group: "profile",
        label,
        rawValue,
        rationale,
        shortText,
        rationaleSource,
        observations,
        derivedFrom,
        reviewNote: reviewNoteFor(`profile.${profilePath}`, triggerBasis),
        adjudication: null,
      }),
    )
  }

  const propertyFingerprints = Object.fromEntries(
    properties.map((property) => [property.path, fingerprintProperty(property)]),
  )

  return {
    productId,
    slot,
    batch: "unseen-test",
    brand: record.brand,
    productName: record.product,
    archetypeRole: packetEntry.archetype_role,
    identity: buildIdentity(record, packetEntry),
    g0: buildG0(record),
    reviewRouting: buildReviewRouting(record),
    uncertainFields: record.profile?.uncertain_fields ?? [],
    cautionsDe: record.cautions_de ?? [],
    properties,
    propertyFingerprints,
    productFingerprint: fingerprint(propertyFingerprints),
  }
}

export function buildUnseenProducts(unseenDir) {
  const laneA = JSON.parse(readFileSync(path.join(unseenDir, "lane-a", "records.json"), "utf8"))
  const packet = JSON.parse(readFileSync(path.join(unseenDir, "unseen-packet.json"), "utf8"))

  // Post-amendment overrides: for any slot with a rederived/u{N}-record.json
  // on disk (a sealed re-derivation or evidence-resolution against the
  // amended packet), that record supersedes lane-a's — lane-a stays frozen
  // as the test artifact of record. Current overrides: u1 (T18 tier-1
  // formula re-anchoring + full re-derivation, 2026-09-12) and u5
  // (presentation-form resolution from packshot evidence, 2026-09-12,
  // u5-format-evidence.md).
  const rederivedSlots = new Set()
  const sourceRecords = laneA.records.map((record) => {
    const overridePath = path.join(unseenDir, "rederived", `${record.slot}-record.json`)
    try {
      const override = JSON.parse(readFileSync(overridePath, "utf8"))
      rederivedSlots.add(record.slot)
      return override.records[0]
    } catch {
      return record // no override on disk — lane-a's record stands
    }
  })

  const products = sourceRecords.map((record, index) => {
    const packetEntry = packet.entries.find((entry) => entry.slot === record.slot)
    if (!packetEntry) throw new Error(`No unseen-packet entry for ${record.slot}`)
    // Gold-set slots are numbered 1-13; continue the same numeric sequence
    // here (14-19) so `slot` stays a globally unique positive integer across
    // the whole fixture. productId uses its own "unseen-0N" sequence,
    // independent of that continuation, per the task's naming convention.
    const slot = 13 + index + 1
    const productId = `unseen-${String(index + 1).padStart(2, "0")}-${slugify(`${record.brand} ${record.product}`)}`
    return record.out_of_category
      ? buildExcludedProduct({ record, packetEntry, productId, slot })
      : buildInCategoryProduct({ record, packetEntry, productId, slot, unseenDir })
  })

  for (const slot of rederivedSlots) {
    const index = laneA.records.findIndex((record) => record.slot === slot)
    const overridden = products[index]
    if (!overridden) continue
    // Correct provenance: the record's prose now comes from the override
    // file, not lane-a. (The u1 conflict banner that used to move to the G0
    // row here — "record resolved, rule stays open" — is retired; see the
    // "adjudication" section above: T18 is now a settled rule and u1's
    // record is already conformant with it.)
    for (const property of overridden.properties) {
      property.rationaleSource = property.rationaleSource.replace(
        "lane-a/records.json",
        `rederived/${slot}-record.json`,
      )
    }
  }

  // formula_source_conflict_rule (Kandidat T18) is retired — see the
  // "adjudication" section above. No adjudication is attached anywhere in
  // this batch any more.
  return { products, adjudications: [] }
}
