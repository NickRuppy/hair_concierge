// One-off generator for data/research/leave-in-inci/v1.0/lab-fixture.json
//
// Reads the frozen gold-set research artifacts and merges them into a single
// review fixture. Rationale text is copied verbatim from the per-product
// markdown evidence chains; nothing is paraphrased or invented.
//
// Usage: node build-lab-fixture.mjs <gold-set-dir> <out-dir> [unseen-test-dir]
//   - <gold-set-dir> and <out-dir> are required, as before.
//   - [unseen-test-dir] is optional and defaults to
//     "<gold-set-dir>/../unseen-test" (i.e. a plain two-arg call already
//     regenerates both batches when the two directories are siblings under
//     data/research/leave-in-inci/v1.0/corpus/, as they are in this repo).
//     Pass an explicit empty string ("") as the third arg to build the
//     gold-set batch only.
//
// Canonical invocation from the repo root, after the v1.0 freeze moved the
// calibration corpus into the artifact root:
//
//   node scripts/leave-in-research/build-lab-fixture.mjs \
//     data/research/leave-in-inci/v1.0/corpus/gold-set \
//     data/research/leave-in-inci/v1.0
//
// The output fixture now carries TWO product batches, tagged by the
// `batch` field on every product:
//   - "gold-set": the 13 calibration products below (unchanged pipeline).
//   - "unseen-test": 6 products built by the sibling module
//     ./build-unseen-products.mjs from data/research/leave-in-inci/v1.0/
//     corpus/unseen-test/ (lane-a/records.json + unseen-packet.json) — a
//     structurally different input (every rationale already lives directly
//     in JSON prose, no markdown evidence chain to parse), so it has its
//     own builder rather than being threaded through this file's
//     markdown-parsing machinery. See that module's header for how it
//     sources reasoningShort/rationale text and for the one T18-candidate
//     adjudication banner it contributes.
//
// v0.4 (Nick's trim rulings T1-T10, 2026-09-05, T11-T15, 2026-09-10, and T16,
// 2026-09-11; T9 and T10 both issued same day as T1-T8, T10 issued same day
// as T9, T11, T12, T13, T14 and T15 issued five days later, and T16 issued a
// day after that, into the same still-unfrozen draft):
//   - the JSON key is the v4 projection (reference-key-v4/reference-key.json);
//   - the verbatim evidence text still comes from the round-3 markdown chains
//     in reference-key-v3/, which are unchanged and are the evidence of record;
//   - SLIP evidence is merged under COND's row (T1);
//   - SFR evidence is attached to the focus row as `smoothing_route` (T2);
//   - DOSE and scalp_application_fit rows are gone (T3, T4);
//   - the six demoted flag rows collapse into one Hinweise row (T5);
//   - repair_support_level is a reviewable profile row (T6);
//   - deterministic profile echoes are annotations on their dimension (T8);
//   - HUM (humidity_resistance_evidence_state) is dropped entirely, not
//     re-homed anywhere — no dimension row, no echo annotation (T9);
//   - product_form is no longer a projection of FORM's architecture value; it
//     is the presentation form (spray | milk | lotion | cream | serum)
//     captured directly at identity (pack, product name, directions), and is
//     now its own separately reviewable row rather than a pure echo (T10).
//   - FORM (product_form_architecture) is no longer a dimension row at all
//     (T11). Its value/confidence/evidence_level survive in
//     `reading_conventions.architecture` in the reference key (not a review
//     row) and are folded, as a one-line clause, into the WT row's own
//     reasoningShort — WT is where the architecture read is actually
//     consumed via G9. The `product_form` row's context observation now cites
//     `reading_conventions.architecture` instead of the removed dimension.
//   - ROLE (usage_role) is no longer a dimension or profile row at all (T12).
//     Its one surviving bit — dry-hair usability — is identity data,
//     `identity.application_stage` in the reference key, rendered in the
//     fixture's identity header next to `directionsOfUse` (see the `identity`
//     object below) rather than as a reviewed property or a dimension echo.
//     The `heat_styling` focus row now reads `provides_heat_protection` and
//     `application_stage` directly instead of HEAT and ROLE.
//   - the repair row's marketing-position prong is deleted, and §10.2.1's
//     beyond-baseline-conditioning test now reads permissively where COND is
//     over-satisfied (T13). Unlike every ruling above, this is a genuine
//     re-derivation of `focus.primary`/`focus.secondary`, not a carrier move:
//     slots 2, 6, 8 and 10 change value (general/repair -> smoothing). The
//     `focus_permissive_vs_conservative` adjudication banner this used to
//     surface is removed — the question it flagged is now a settled rule, not
//     an open one — and the affected slots' reasoningShort/focus_basis text
//     is rewritten accordingly. See reference-key-v4/transform-notes.md §12.
//   - claim authority (§2.4.1 rule 3) gains a narrow cross-market exception:
//     a non-German-market manufacturer page can create a claim, tier
//     `C2_cross_market_verified`, when product identity is verified and a
//     German-market retailer corroborates it (T14, adjudicated against the
//     Olaplex gold-set record). Slot 10 only: `heat_protection_evidence_state`
//     moves not_claimed -> claim_only (no L9 member), `provides_heat_protection`
//     moves false -> true, and its `claim_authority_gap` review trigger is
//     replaced by `heat_claim_without_l9_member`. The `heat_retailer_tier_only`
//     adjudication banner (slots 3 and 10) is removed on the same precedent as
//     `focus_permissive_vs_conservative` above — Nick has now ruled both
//     halves (Olaplex resolves via the exception; Cantu resolves by the
//     exception's own guarding counter-example, its documented US/German
//     formula split failing the identity prong), so nothing remains open for
//     a reviewer to adjudicate. See reference-key-v4/transform-notes.md §14.
//   - the designed styling-boundary archetype (slot 13, Neqi) is ruled
//     in-category with HOLD = `incidental_film` (T15, Nick's adjudication of
//     the round-3 report's item 4): a genuine, substantive conditioning film
//     (Silicone Quaternium-18 + Polysilicone-29) stands behind a single
//     supporting fixative-class polymer, so the styling-first test's
//     architecture half is never established and the round-3
//     `provisional_boundary` / `meaningful_hold_route` reading is
//     superseded. This record is now the standard's worked example for
//     §2.3.2/§7.7, paired with slot 7 (Maria Nila Curlicue Cream,
//     `excluded_styling_first` — a fixative system with thin conditioning
//     behind it). The `neqi_boundary` adjudication banner is removed on the
//     same precedent as `focus_permissive_vs_conservative` and
//     `heat_retailer_tier_only` above — nothing remains open for a reviewer
//     to adjudicate. See reference-key-v4/transform-notes.md §16.
//   - §3.1.1's tail-marker rule becomes conditional on the marker's own
//     plausibility (T16): the strict-rank prong only disqualifies a route or
//     ingredient when the marker sits AFTER the product's core conditioning
//     architecture (the ingredients that establish COND/WT). Slot 9 only:
//     the marker (Phenoxyethanol r3) sits BEFORE that architecture
//     (Amodimethicone r4), so it is `tail_marker_implausible` and may not
//     disqualify the below-marker silane. `repair_surface_film` moves
//     none_visible -> candidate; `repair_support_level` moves low -> medium
//     (the gold set's first `medium`); `damage_fit` opens the R14 repair-film
//     path (row 3b: healthy recommended -> conditional, highly_damaged
//     conditional -> recommended); `focus.primary` moves general -> repair
//     (R2 candidate now qualifies the row, T13a); `care_direction` moves
//     moisture -> protein (§9's protein anchor is now met). The record's
//     `candidate_below_tail` review trigger is replaced by the standing
//     `tail_marker_implausible` trigger. Slot 10 (Olaplex) and every other
//     in-category slot are independently re-checked and ruled plausible —
//     their core conditioning architecture sits above their own markers — so
//     nothing changes on them. The now-exercised `medium` row resolves the
//     `repair_support_level_uncalibrated` adjudication; see the adjudication
//     comment block below. See reference-key-v4/transform-notes.md §18.
//   - seven items from the hard-rule audit Nick commissioned against T16 are
//     adopted together (T17, same day), plus the general invariant the audit
//     generalises into (new §1.1): "every hard rule must fail toward review
//     or toward the conservative value - never toward a recommendation."
//     Slot 6 (Curlsmith) and slot 12 (Kevin Murphy, excluded/informational)
//     carry a marker so late that everything below it is only capped
//     material or a declared allergen/colourant - `tail_marker: vacuous`
//     (H1, §3.1.1 clause 6), routed to review, no value moved. Slot 4
//     (alverde Nutri-Care) loses its allergen-block marker (H2 - the block
//     is no longer marker-eligible) and reads `tail_marker: none_visible`,
//     with five dimensions' confidence stepped down one level per mandatory
//     limit 2; no value moved. Slot 3 (Cantu) and slot 10 (Olaplex) gain the
//     buildup caution (H6): `weight_potential` projects `high` with a
//     persistent non-volatile family present as architecture (a monomeric
//     long-chain quat in both cases), the WT-high/PERS-not-permanent_cationic
//     inversion the widened rule closes; `persistence_removal_class` itself
//     is unchanged. Slot 13 (Neqi) gains `species_reading_conflict` (H9):
//     Silicone Quaternium-18 (r11) is T15's named substantive conditioning
//     film for HOLD and simultaneously §7.10's `candidate_below_tail`
//     disqualified trace for R2, on the same record - neither reading is
//     overridden. H3 (§2.4 rule 2, the rinse test scoped to the application
//     step) and H8 (§14's new `l9_member_without_claim` trigger) are defined
//     but unexercised on this gold set - no record's directions or L9/claim
//     shape matches either condition. See
//     reference-key-v4/transform-notes.md §20-21 and
//     plans/leave-in-inci/research/hard-rule-audit.md.

import { readFileSync, readdirSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs"
import path from "node:path"

import {
  slugify,
  stableStringify,
  fingerprint,
  displayValue,
  DIMENSION_ABBREVIATIONS,
  DIMENSION_LABELS,
  ECHO_OF_DIMENSION,
  PROFILE_LABELS,
} from "./lab-fixture-shared.mjs"
import { buildUnseenProducts } from "./build-unseen-products.mjs"

const GOLD_SET = process.argv[2]
const OUT_DIR = process.argv[3]
// Optional fourth arg: the unseen-test directory (lane-a/records.json,
// unseen-packet.json). Defaults to the repo's unseen-test artifact set so a
// plain two-arg invocation still regenerates both batches. Pass an explicit
// empty string ("") to skip the unseen-test batch entirely (gold-set only).
const UNSEEN_TEST_DIR =
  process.argv[4] === undefined
    ? path.join(GOLD_SET ?? ".", "..", "unseen-test")
    : process.argv[4]
if (!GOLD_SET || !OUT_DIR) {
  console.error(
    "usage: node build-lab-fixture.mjs <gold-set-dir> <out-dir> [unseen-test-dir|'']",
  )
  process.exit(1)
}

// The v4 key is a projection of the round-3 record; the evidence chains it
// projects live in the round-3 directory and are read verbatim from there.
const KEY_DIR = path.join(GOLD_SET, "reference-key-v4")
const EVIDENCE_DIR = path.join(GOLD_SET, "reference-key-v3")
const key = JSON.parse(readFileSync(path.join(KEY_DIR, "reference-key.json"), "utf8"))
const packet = JSON.parse(readFileSync(path.join(GOLD_SET, "calibration-packet.json"), "utf8"))

const markdownFiles = readdirSync(EVIDENCE_DIR)
  .filter((name) => /^\d\d-.*\.md$/.test(name))
  .sort()

// ---------------------------------------------------------------- markdown --

function splitSections(markdown) {
  const lines = markdown.split("\n")
  const sections = []
  let current = null
  for (const line of lines) {
    const heading = /^(#{1,4})\s+(.*)$/.exec(line)
    if (heading) {
      if (current) sections.push(current)
      current = { level: heading[1].length, title: heading[2].trim(), lines: [] }
      continue
    }
    if (current) current.lines.push(line)
  }
  if (current) sections.push(current)
  return sections.map((section) => ({ ...section, body: section.lines.join("\n").trim() }))
}

function stripMarkers(value) {
  return value.replace(/`/g, "").replace(/\*\*/g, "").replace(/\*/g, "").trim()
}

// Top-level `- ` bullets, with their indented continuation lines folded in.
function bulletsOf(body) {
  const bullets = []
  let current = null
  for (const line of body.split("\n")) {
    if (/^-\s+/.test(line)) {
      if (current) bullets.push(current.join(" ").replace(/\s+/g, " ").trim())
      current = [line.replace(/^-\s+/, "")]
    } else if (current && /^\s+\S/.test(line)) {
      current.push(line.trim())
    } else if (current && line.trim() === "") {
      bullets.push(current.join(" ").replace(/\s+/g, " ").trim())
      current = null
    }
  }
  if (current) bullets.push(current.join(" ").replace(/\s+/g, " ").trim())
  return bullets
}

const MARKER_PATTERN = /^\*{0,2}`?([a-z_]+)(?:\[\])?`?\*{0,2}\s*[:—-]/

function bulletsWithMarker(body, marker) {
  return bulletsOf(body)
    .filter((bullet) => {
      const match = MARKER_PATTERN.exec(bullet)
      return match?.[1] === marker
    })
    .map((bullet) => bullet.replace(MARKER_PATTERN, "").trim())
}

// A pipe table -> array of cell arrays (header and separator dropped).
function tableRows(body) {
  return body
    .split("\n")
    .filter((line) => line.trim().startsWith("|"))
    .map((line) =>
      line
        .trim()
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map((cell) => cell.trim()),
    )
    .filter((cells) => !cells.every((cell) => /^-{2,}$/.test(cell)))
    .slice(1)
}

// ------------------------------------------------------------------ shapes --

// The seven dimensions that survive the v0.4 trim, in review order. HUM
// (humidity_resistance_evidence_state) is dropped entirely by T9, not merely
// descored — it carries no key in any of these maps and no row in the fixture.
// FORM (product_form_architecture) is dropped the same way by T11: it is no
// longer a scored dimension, so it carries no key here either. Its value
// survives as `reading_conventions.architecture` in the reference key (a
// trace reading convention, not a dimension) and is folded into the WT row's
// reasoningShort below, since WT is the row that actually consumes it (G9).
// ROLE (usage_role) is dropped the same way again by T12: no dimension row,
// no profile row, no echo entry. Its one surviving bit — dry-hair usability —
// is identity data (`identity.application_stage`), rendered in the fixture's
// identity header next to `directionsOfUse`, not as a reviewed property.
//
// DIMENSION_ABBREVIATIONS and DIMENSION_LABELS now live in
// ./lab-fixture-shared.mjs (imported above) — the unseen-test lane reviews
// the same seven §7 dimensions against the same frozen v0.4 standard, so the
// vocabulary is shared rather than duplicated.

// T8: profile fields that are deterministic identity projections of exactly one
// dimension. They are annotations on that dimension's row, not review items.
//
// T10: `product_form` is captured independently at identity (E1), not derived
// from FORM's architecture read, so it is a separately reviewable profile row
// (see PROFILE_LABELS below, and the `identity` kind in
// PROFILE_RATIONALE_SOURCE) rather than an echo of any dimension.
//
// T11: FORM itself is no longer a dimension at all, so there is no FORM row
// left for `product_form` to have been an echo of in the first place. The
// `product_form` row's context observation now cites
// `reading_conventions.architecture` directly (see the profilePath ===
// "product_form" block below) instead of a dimension echo.
//
// T12: `usage_role` was this map's last entry (`usage_role: "usage_role"`).
// ROLE is removed entirely, not re-annotated — there is no usage_role value
// left to echo. Its identity-capture successor, `application_stage`, never
// joins this map: it is not a lean-profile field, echo or otherwise.
//
// ECHO_OF_DIMENSION and PROFILE_LABELS also now live in
// ./lab-fixture-shared.mjs (imported above).

// profile path -> where its verbatim reasoning lives in the markdown
const PROFILE_RATIONALE_SOURCE = {
  // T10: not sourced from a markdown evidence section at all — built directly
  // from the frozen packet's identity fields (see the "identity" kind below).
  product_form: { kind: "identity" },
  repair_support_level: { kind: "dimension", abbreviation: "R2" },
  "focus.primary": { kind: "focus" },
  "focus.secondary": { kind: "focus" },
  "specialist_functions.provides_heat_protection": { kind: "dimension", abbreviation: "HEAT" },
  "hair_thickness_fit.fine": { kind: "fit", bullet: "hair_thickness_fit" },
  "hair_thickness_fit.medium": { kind: "fit", bullet: "hair_thickness_fit" },
  "hair_thickness_fit.coarse": { kind: "fit", bullet: "hair_thickness_fit" },
  "damage_fit.healthy": { kind: "fit", bullet: "damage_fit" },
  "damage_fit.moderately_damaged": { kind: "fit", bullet: "damage_fit" },
  "damage_fit.highly_damaged": { kind: "fit", bullet: "damage_fit" },
  "texture_fit.straight": { kind: "fit", bullet: "texture_fit" },
  "texture_fit.wavy": { kind: "fit", bullet: "texture_fit" },
  "texture_fit.curly": { kind: "fit", bullet: "texture_fit" },
  "texture_fit.coily": { kind: "fit", bullet: "texture_fit" },
}

const PROFILE_DERIVED_FROM = {
  // T10: identity, not a §7 dimension — pack + product name + directions (E1).
  product_form: ["identity (pack + product name + directions, E1)"],
  repair_support_level: ["R2", "COND", "product_evidence"],
  // T10: FORM is dropped here — the fit table never used it (only WT decides
  // a row), and it is even less a weight signal now that `product_form` is
  // the presentation form rather than the FORM architecture class (§7.1: the
  // presentation word "carries no decision weight").
  "hair_thickness_fit.fine": ["WT"],
  "hair_thickness_fit.medium": ["WT"],
  "hair_thickness_fit.coarse": ["WT"],
  "damage_fit.healthy": ["COND", "R2", "R3", "product_evidence"],
  "damage_fit.moderately_damaged": ["COND", "R2", "R3", "product_evidence"],
  "damage_fit.highly_damaged": ["COND", "R2", "R3", "product_evidence"],
  "texture_fit.straight": ["WT", "COND (absorbed slip observation)", "HOLD"],
  "texture_fit.wavy": ["WT", "COND (absorbed slip observation)", "HOLD"],
  "texture_fit.curly": ["WT", "COND (absorbed slip observation)", "HOLD"],
  "texture_fit.coily": ["WT", "COND (absorbed slip observation)", "HOLD"],
  "specialist_functions.provides_heat_protection": ["HEAT"],
}

// ------------------------------------------------------------- adjudication --

// focus_permissive_vs_conservative (§10.2.1 general-vs-smoothing) was removed
// 2026-09-10: Nick's ruling T13b settles the question as a standing rule (the
// permissive single-admissible-set reading), so it is no longer an open
// adjudication for a reviewer to decide per record. See
// leave-in-classification-standard.v0.4.md §10.2.1 and §21.3 (T13), and
// reference-key-v4/transform-notes.md §12 for the four affected slots.
//
// heat_retailer_tier_only (heat claim exists only at retailer tier — Cantu,
// slot 3, and Olaplex, slot 10) was removed 2026-09-10: Nick's ruling T14
// resolves both halves in the same sitting. Olaplex's resolves via §2.4.1
// rule 7's new cross-market exception (product identity verified, C3/C4
// corroborated -> claim admitted at tier `C2_cross_market_verified`); Cantu's
// resolves by that exception's own guarding counter-example — its documented
// US/German formula split fails the identity prong, so its heat statement
// stays exactly what it already was (C3-only, non-creating, `not_claimed`).
// With both halves ruled, nothing is left for a reviewer to adjudicate. See
// leave-in-classification-standard.v0.4.md §2.4.1 and §21.3 (T14), and
// reference-key-v4/transform-notes.md §14.
//
// neqi_boundary (G0 in_category vs. boundary + HOLD state, slot 13) was
// removed 2026-09-10: Nick's ruling T15 rules the designed styling-boundary
// archetype directly — g0_state in_category, hold_route_state
// incidental_film. A genuine, substantive conditioning film (Silicone
// Quaternium-18 r11 + Polysilicone-29 r7) stands behind a single supporting
// fixative-class polymer (VP/Methacrylamide/Vinyl Imidazole Copolymer r8),
// which is the incidental_film shape, not meaningful_hold_route. This
// record is now the standard's worked example for §2.3.2/§7.7, paired with
// slot 7 (Maria Nila Curlicue Cream, excluded_styling_first — a fixative
// system with thin conditioning behind it). With the record ruled, nothing
// is left for a reviewer to adjudicate. See
// leave-in-classification-standard.v0.4.md §2.3.2, §7.7 and §21.3 (T15), and
// reference-key-v4/transform-notes.md §16.
//
// repair_support_level_uncalibrated (the §10.3.2 `medium` row had never been
// exercised — every record read `low`) was removed 2026-09-11: Nick's ruling
// T16 makes §3.1.1's tail-marker rule conditional on the marker's own
// plausibility (does it sit after the product's core conditioning
// architecture?). Slot 9 (Redken)'s marker is ruled implausible — Phenoxyethanol
// at rank 3 sits *before* the architecture it is supposed to bound (Amodimethicone
// r4) — so it may no longer disqualify the below-marker silane route. R2 moves
// none_visible -> candidate, and slot 9 becomes the gold set's first record to
// reach `repair_support_level: medium`. That is the calibration the adjudication
// was waiting for: the `medium` row is now demonstrably reachable and the rule
// works as designed, not merely applied and never tested. Slot 8 (GLISS) and
// slot 10 (Olaplex) stay `low` on their own, independently-verified markers
// (both ruled plausible under the same T16 test) — a bond-claim product and a
// plain-hydrolysate product with no qualifying R2 route are the honest floor,
// not an open question. With the rule now exercised, nothing is left for a
// reviewer to adjudicate. See leave-in-classification-standard.v0.4.md §3.1.1,
// §10.3.2 and §21.3 (T16), and reference-key-v4/transform-notes.md §18.
const ADJUDICATIONS = {}

// slot -> property path -> adjudication id
// (empty: every adjudication this key ever carried — focus_permissive_vs_
// conservative, heat_retailer_tier_only, neqi_boundary, repair_support_level_
// uncalibrated — has been resolved by a standing rule or a direct ruling.
// See the comment block above and reference-key-v4/transform-notes.md.)
const ADJUDICATION_ASSIGNMENTS = {}

// ------------------------------------------------------- reasoningShort --

// One short, faithful compression per property, written by hand from that
// property's own verbatim rationale + observations in the round-3 evidence
// chains. Nothing here may assert anything the source record does not; the
// source language (mostly English) and the load-bearing ingredient names and
// ranks are kept. Keyed by productId -> property path so a regeneration is
// reproducible and a missing entry fails the build loudly.
//
// A property whose rationale is missing from the evidence markdown
// (rationale_extraction_gap) does NOT get an invented summary — it gets
// REASONING_SHORT_GAP. The current gold set has no such property.
const REASONING_SHORT_GAP = "— (Begründung fehlt im Quellrecord)"

const REASONING_SHORT = {
  "slot-01-alverde-naturkosmetik-leave-in-spruehkur-express-7in1": {
    g0: "in_category: Aqua leads (r1) and the C2 directions spray into lengths and ends with no rinse (rinse test PASS); conditioning is primary. Neither exclusion fires — aqueous-led, and HOLD returns none.",
    "profile.product_form":
      "Presentation form spray, captured at identity (T10): the pack is named `Sprühkur` and directions instruct spraying into lengths and ends — not derived from the architecture read's `two_phase` value.",
    "dimension.conditioning_potential":
      "Persistent emollients above the tail (sunflower oil r2, Dicaprylyl Ether r5, Isoamyl Laurate r8) exclude low; high needs an LGN pair and there is no cationic surfactant at all → moderate. One M1 slip contributor.",
    "dimension.weight_residue_potential":
      "Two persistent families above the tail — medium-band sunflower oil (r2) and dry-feel esters/ether (r5, r8) — but no rich/low-spreading member (castor sits at r11, below the marker at r9), so weight holds at moderate. [two_phase]",
    "dimension.persistence_removal_class":
      "No polymeric or silicone-functional quat and no amodimethicone-class species is declared, so both cationic rows are unreachable; the highest class present as architecture is the neutral non-volatile lipid deposit (r2, r5, r8).",
    "dimension.hold_route_state":
      "No fixative-class L5 polymer is declared. Inulin (r7) is a polysaccharide serving prebiotic and film-quality roles, not an L5 member, so it is not read as hold.",
    "dimension.heat_protection_evidence_state":
      "No C1/C2 heat claim — the C2 house-brand page was fetched and its silence recorded. The L9 member Hydrolyzed Wheat Protein sits at r14, below the marker, so two rules bar any upgrade.",
    "dimension.repair_surface_film":
      "No §7.10 route (cationised protein, silane derivative, silicone quat) at any rank. Hydrolyzed Corn (13), Wheat (14) and Soy (15) Protein are plain hydrolysates, which read none_visible at any position.",
    "dimension.fragrance_scalp_exposure":
      "Parfum (r23) plus a declared allergen block (Geraniol, Limonene, Terpineol, Geranyl Acetate, Linalyl Acetate, Vanillin) and aromatic citrus and cedar oils. Alcohol Denat. at r3 adds the alcohol note.",
    hinweise:
      "Only SHN fired, and only as a qualifier on SFR with no independent value. R3 is researched and negative (no C1/C2 bond claim, no recognised chemistry), CURL has no value vocabulary, and no LAYER or buildup caution is emitted.",
    care_direction:
      "R2 none_visible puts protein and balanced out of reach; a coherent L3 emollient plus L4 humectant direction sits above the tail (Glycerin r4, Pentylene Glycol r6, oils r2/r5/r8). The C2 keratin copy never sets the value.",
    "profile.repair_support_level":
      "R2 is none_visible, so no qualifying substantive film route reaches the medium row, and there is no exact-product repair evidence at E3+ to reach high → low.",
    "profile.focus.primary":
      "Every route fails its gate — repair (R2 none_visible, no C1/C2 claim), smoothing (SFR moderate, no continuous film), curl_definition, heat_styling, and detangling/volume_lightness (WT is moderate, not low) → general.",
    "profile.focus.secondary":
      "No route qualified at all, so nothing is left to carry as a secondary focus; the §10.2 step-5 fallback to general leaves the list empty.",
    "profile.specialist_functions.provides_heat_protection":
      "No C1/C2 heat claim exists (the C2 page was checked and is silent) and the L9 member at r14 is below the marker, so §13.3 rule 4 sets the binary to false.",
    "profile.hair_thickness_fit.fine":
      "hair_thickness_fit follows weight_potential: moderate (row 2 of §10.3), which reads fine hair as conditional. The fine-hair prior carries the §7.5 judgment-call limitation.",
    "profile.hair_thickness_fit.medium":
      "hair_thickness_fit follows weight_potential: moderate (row 2 of §10.3), which recommends the product for normal-diameter hair; DOSE does not additionally modify this table (G3).",
    "profile.hair_thickness_fit.coarse":
      "hair_thickness_fit follows weight_potential: moderate (row 2 of §10.3), which recommends the product for coarse hair; DOSE does not additionally modify this table (G3).",
    "profile.damage_fit.healthy":
      "damage_fit row 2: conditioning_level moderate with no qualifying repair route, which recommends the product for healthy hair.",
    "profile.damage_fit.moderately_damaged":
      "damage_fit row 2: conditioning_level moderate with no qualifying repair route — R2 none_visible blocks row 3b and COND is not high for row 3a → recommended.",
    "profile.damage_fit.highly_damaged":
      "damage_fit row 2 applies because no repair route qualifies (R2 none_visible, COND not high), and that row reads highly damaged hair as conditional.",
    "profile.texture_fit.straight":
      "texture_fit row 2: weight_potential moderate with any slip level, which recommends the product here. Not a row-4 or row-5 record, so the §14 texture trigger does not fire.",
    "profile.texture_fit.wavy":
      "texture_fit row 2: weight_potential moderate with any slip level, which recommends the product here. Not a row-4 or row-5 record, so the §14 texture trigger does not fire.",
    "profile.texture_fit.curly":
      "texture_fit row 2: weight_potential moderate with any slip level, which recommends the product here. Not a row-4 or row-5 record, so the §14 texture trigger does not fire.",
    "profile.texture_fit.coily":
      "texture_fit row 2 (weight_potential moderate, any slip) reads coily hair as conditional. Not a row-4 or row-5 record, so the §14 texture trigger does not fire.",
  },
  "slot-02-isana-professional-leave-in-conditioner-hyaluron-panthenol": {
    g0: "in_category: Aqua leads and the C2 directions apply the product to towel-dried lengths and ends and then style, with no rinse instruction anywhere including the storage block (rinse test PASS).",
    "profile.product_form":
      "Presentation form lotion, captured at identity (T10): no container word is stated, so the call rests on the packet's own `Mainstream milk/lotion` archetype label plus hand-poured, massage-in directions — the single least-certain call in this pass.",
    "dimension.conditioning_potential":
      "The LGN pair above the tail (r2 + r7 + r8) plus a further independent lubrication route, the cationic polymer Guar Hydroxypropyltrimonium Chloride (r5), is exactly the high anchor's shape, so moderate is refused.",
    "dimension.weight_residue_potential":
      "The LGN pair present as architecture (Cetearyl Alcohol r2 with the two quats r7/r8) satisfies the high anchor's first prong on its own. No rich-band lipid anywhere, which is why confidence stays at moderate. [emulsion/LGN]",
    "dimension.persistence_removal_class":
      "Guar Hydroxypropyltrimonium Chloride at r5 is enumerated by INCI name in the permanent_cationic class, and the highest class present as architecture wins; the monomeric quats (r7, r8) rank lower.",
    "dimension.hold_route_state": "No fixative-class L5 polymer is declared anywhere in the list.",
    "dimension.heat_protection_evidence_state":
      "§13.2 row 1: no C1/C2 heat claim and no L9 member anywhere in the list. The C2 source exists and is silent, so this is not a claim_authority_gap and no review trigger fires.",
    "dimension.repair_surface_film":
      "No cationised protein, silane derivative or silicone quat at any rank. Guar Hydroxypropyltrimonium Chloride is a non-silicone cationic polymer and counts only for PERS and SFR; Panthenol is a fibre-mechanics signal, not an R2 route.",
    "dimension.fragrance_scalp_exposure":
      "Parfum (r10) plus a declared allergen block — Hexyl Cinnamal (15), Alpha-Isomethyl Ionone (17), Geraniol (18), Citronellol (19). No Alcohol Denat., so no alcohol note.",
    hinweise:
      "SHN fired as an SFR qualifier and the buildup caution fired with persistence: high. R3 is researched and negative, CURL has no value vocabulary, and LAYER is not emitted.",
    care_direction:
      "R2 none_visible puts protein and balanced out of reach, and the architecture is not silicone-led. L1 (cationic conditioning), L3 (Dicaprylyl Ether) and L4 (Glycerin, Betaine) are all present → moisture at moderate confidence.",
    "profile.repair_support_level":
      "R2 is none_visible, so no qualifying substantive film route reaches the medium row, and there is no exact-product repair evidence at E3+ to reach high → low.",
    "profile.focus.primary":
      "T13 (permissive reading, 2026-09-10): SFR high clears the two-observation test (film Guar HPTC r5, lubrication Dicaprylyl Ether r4). COND high was over-satisfied by the LGN pair alone, so a single admissible set leaves the film beyond baseline → smoothing.",
    "profile.focus.secondary":
      "No further route clears the independent-moderate-or-better bar once smoothing is primary: repair has no route, and curl_definition/heat_styling/detangling/volume_lightness/shine each fail their own gate.",
    "profile.specialist_functions.provides_heat_protection":
      "§13.2 row 1: no C1/C2 heat claim and no L9 member anywhere in the list, so §13.3 rule 4 sets the binary to false.",
    "profile.hair_thickness_fit.fine":
      "hair_thickness_fit follows weight_potential: high (row 3), which reads fine hair as caution. No evidence establishes the residue load at which fine hair reads as limp — this is a named judgment call (§7.5).",
    "profile.hair_thickness_fit.medium":
      "hair_thickness_fit follows weight_potential: high (row 3), which reads normal-diameter hair as conditional.",
    "profile.hair_thickness_fit.coarse":
      "hair_thickness_fit follows weight_potential: high (row 3), which recommends the product for coarse hair.",
    "profile.damage_fit.healthy":
      "damage_fit row 2 applies and recommends the product for healthy hair. COND is high, but row 3a needs a qualifying specialist route and a non-silicone cationic polymer does not qualify.",
    "profile.damage_fit.moderately_damaged":
      "damage_fit row 2: COND high but no qualifying specialist route (row 3a) and R2 none_visible (row 3b), so moderately damaged hair reads recommended.",
    "profile.damage_fit.highly_damaged":
      "damage_fit row 2 applies because neither row 3a (no qualifying specialist route) nor row 3b (R2 none_visible) is reached, and that row reads highly damaged hair as conditional.",
    "profile.texture_fit.straight":
      "texture_fit row 3: weight_potential high with SLIP high, which reads straight hair as conditional. Not a row-4 or row-5 record, so the §14 texture trigger does not fire.",
    "profile.texture_fit.wavy":
      "texture_fit row 3: weight_potential high with SLIP high (two or more M1 contributors), which recommends the product for wavy hair.",
    "profile.texture_fit.curly":
      "texture_fit row 3: weight_potential high with SLIP high (two or more M1 contributors), which recommends the product for curly hair.",
    "profile.texture_fit.coily":
      "texture_fit row 3: weight_potential high with SLIP high (two or more M1 contributors), which recommends the product for coily hair.",
  },
  "slot-03-cantu-leave-in-haarkur-repair-creme": {
    g0: "in_category: Aqua leads and the directions state „Nicht ausspülen“ explicitly (rinse test PASS); conditioning is primary. HOLD is none, so the §2.3.2 styling-first exclusion does not arise.",
    "profile.product_form":
      "Presentation form cream, captured at identity (T10): the pack is named `Creme`, sold in a 453 g jar-scale pack, with generous scoop-and-work-in directions.",
    "dimension.conditioning_potential":
      "The LGN pair above the tail (Cetearyl Alcohol r3 + Behentrimonium Methosulfate r5) plus an independent rich/medium emollient route (canola r2, shea r6, olive r7) gives high. Polyquaternium-10 at r30 is below the marker and not counted.",
    "dimension.weight_residue_potential":
      "Both high prongs fire independently: the LGN pair (r3 + r5), and two persistent families with enumerated rich-band members — shea butter (r6) and olive oil (r7) beside medium-band canola (r2). Transfer caution attached. [emulsion/LGN]",
    "dimension.persistence_removal_class":
      "Polyquaternium-10 would reach permanent_cationic but sits at r30, below the marker at r28, so it cannot set the class. What remains as architecture is the neutral lipid deposit plus the monomeric quat Behentrimonium Methosulfate.",
    "dimension.hold_route_state": "No fixative-class L5 polymer is declared.",
    "dimension.heat_protection_evidence_state":
      "The only heat statement is C3 (dm.de) and retailer copy never creates a claim; the C2 manufacturer page was checked and is silent. Routed to review under claim_authority_gap so a human confirms nothing was missed.",
    "dimension.repair_surface_film":
      "No cationised protein, silane derivative or silicone quat at any rank, and no hydrolysed protein of any kind is declared. The two C2 repair claims are recorded but a claim cannot set this formula dimension.",
    "dimension.fragrance_scalp_exposure":
      "Parfum (r27) plus a declared allergen block (Benzyl Salicylate, Citral, Coumarin, Hexyl Cinnamal, Limonene, Linalool, r37–42). Benzyl Alcohol (r36) sits outside the Alcohol Denat. enumeration, so no alcohol note.",
    hinweise:
      "SHN fired as an SFR qualifier; transfer fired on the shea/olive lipid load. R3 negative (repair, not bond claims). Buildup now fires too (T17/H6): WT high + a persistent non-volatile family (monomeric quat); persistence itself stays neutral_non_volatile.",
    care_direction:
      "R2 none_visible puts protein and balanced out of reach, and the architecture is not silicone-led. L1 (Behentrimonium Methosulfate + Cetearyl Alcohol), L3 (canola, shea, olive) and L4 (Glycerin r4) all sit as architecture → moisture.",
    "profile.repair_support_level":
      "R2 is none_visible, so no qualifying substantive film route reaches the medium row and there is no E3+ exact-product evidence for high. The C2 repair claims are explicitly barred from raising the level (§10.3.2 clause 2).",
    "profile.focus.primary":
      "The repair route fails on both prongs — R2 none_visible, and „Sheabutter und natürlichen Ölen“ plus generic repair naming are excluded actives. Smoothing needs SFR high (it is moderate) and every other route fails → general.",
    "profile.focus.secondary":
      "No route qualified as primary, so nothing is left to carry as a secondary focus.",
    "profile.specialist_functions.provides_heat_protection":
      "The only heat statement is C3 retailer copy, which creates no claim, and the C2 page is silent, so §13.3 rule 1 sets the binary to false while routing the record to review.",
    "profile.hair_thickness_fit.fine":
      "hair_thickness_fit follows weight_potential: high (row 3), which reads fine hair as caution; that value carries the §7.5 judgment-call limitation.",
    "profile.hair_thickness_fit.medium":
      "hair_thickness_fit follows weight_potential: high (row 3), which reads normal-diameter hair as conditional.",
    "profile.hair_thickness_fit.coarse":
      "hair_thickness_fit follows weight_potential: high (row 3), which recommends the product for coarse hair.",
    "profile.damage_fit.healthy":
      "damage_fit row 2 applies and recommends the product for healthy hair; row 3a needs a qualifying specialist route (generic oil, butter and repair naming do not qualify) and row 3b needs R2 candidate or tested.",
    "profile.damage_fit.moderately_damaged":
      "damage_fit row 2: COND high but no qualifying specialist route and R2 none_visible, so moderately damaged hair reads recommended — the honest result for a rich cream sold on repair whose formula shows no repair route.",
    "profile.damage_fit.highly_damaged":
      "damage_fit row 2 applies because neither row 3a nor row 3b opens, and that row reads highly damaged hair as conditional despite the C2 repair positioning.",
    "profile.texture_fit.straight":
      "texture_fit row 3: WT high with SLIP high (two independent M1 contributors), which reads straight hair as conditional.",
    "profile.texture_fit.wavy":
      "texture_fit row 3: WT high with SLIP high (two independent M1 contributors), which recommends the product for wavy hair.",
    "profile.texture_fit.curly":
      "texture_fit row 3: WT high with SLIP high (two independent M1 contributors), which recommends the product for curly hair.",
    "profile.texture_fit.coily":
      "texture_fit row 3: WT high with SLIP high (two independent M1 contributors), which recommends the product for coily hair.",
  },
  "slot-04-alverde-naturkosmetik-nutri-care-2-phasen-spruehkur-bio-mandel-bio-argan": {
    g0: "in_category: Aqua leads and the C2 directions spray into the lengths and ends with no rinse instruction (rinse test PASS); conditioning is primary. The product is aqueous-led and HOLD is none, so no exclusion row fires.",
    "profile.product_form":
      "Presentation form spray, captured at identity (T10): the pack is named `Sprühkur` and directions instruct spraying plus shaking before use — the two-phase-presents-as-spray case §7.1 records as observed, not derived.",
    "dimension.conditioning_potential":
      "One coherent route: the medium-band emollient package above the tail (soy r2, argan r7); no cationic surfactant, so high is unreachable → moderate. T17/H2: marker is now none_visible; confidence down one level (limit 2); value unchanged.",
    "dimension.weight_residue_potential":
      "Exactly one persistent family above the tail — medium-band oil, twice (soy r2, argan r7). No LGN pair, no rich-band member; alternative reading lands the same. [two_phase] T17/H2: confidence down one level; value unchanged.",
    "dimension.persistence_removal_class":
      "No quat of any kind and no silicone; the highest class present as architecture is the neutral non-volatile oil deposit (r2, r7). Alcohol (r3) is volatile and adds nothing to persistence. T17/H2: confidence down one level; value unchanged.",
    "dimension.hold_route_state":
      "No fixative-class L5 polymer is declared. T17/H2: confidence down one level (mandatory limit 2); value unchanged.",
    "dimension.heat_protection_evidence_state":
      "No C1/C2 heat claim in the frozen capture and no L9 member at any rank. Routed to review as a claim_authority_gap because the C1/C2 search could not be completed — the SKU appears delisted and the archive was unavailable.",
    "dimension.repair_surface_film":
      "No cationised protein, silane derivative or silicone quat at any rank, and no hydrolysed protein of any kind is declared, so neither the plain-hydrolysate nor the below-tail note arises. T17/H2: confidence down one level; value unchanged.",
    "dimension.fragrance_scalp_exposure":
      "Parfum (r13) plus a declared allergen block — Linalool (14), Limonene (15), Coumarin (16). Alcohol is materially present at r3, so the alcohol exposure note is emitted.",
    hinweise:
      "Only SHN fired, as an SFR qualifier. R3 is researched and negative, CURL has no value vocabulary, LAYER is not emitted, and the buildup caution stays off because persistence projects moderate.",
    care_direction:
      "R2 none_visible puts protein and balanced out of reach and no silicone is declared, so the silicone-led unknown rule does not fire. L3 (soy, argan) and L4 (Glycerin r4, Sodium Lactate r5, Betaine r6) are both architecture → moisture.",
    "profile.repair_support_level":
      "R2 is none_visible, so no qualifying substantive film route reaches the medium row, and there is no exact-product repair evidence at E3+ to reach high → low.",
    "profile.focus.primary":
      "Every route fails its gate. Detangling is the closest near-miss — the archived C2 copy names „Verbessert die Kämmbarkeit“, but that is one benefit among several, not detangling-led positioning, and WT is moderate rather than low → general.",
    "profile.focus.secondary":
      "No route qualified as primary, so nothing is left to carry as a secondary focus.",
    "profile.specialist_functions.provides_heat_protection":
      "No C1/C2 heat claim in the frozen capture and no L9 member at any rank → binary false, with the record routed to review because the C1/C2 source could not be re-checked.",
    "profile.hair_thickness_fit.fine":
      "hair_thickness_fit follows weight_potential: moderate (row 2), which reads fine hair as conditional; that value carries the §7.5 judgment-call limitation.",
    "profile.hair_thickness_fit.medium":
      "hair_thickness_fit follows weight_potential: moderate (row 2), which recommends the product for normal-diameter hair.",
    "profile.hair_thickness_fit.coarse":
      "hair_thickness_fit follows weight_potential: moderate (row 2), which recommends the product for coarse hair.",
    "profile.damage_fit.healthy":
      "damage_fit row 2 — conditioning_level moderate with no qualifying repair route — recommends the product for healthy hair.",
    "profile.damage_fit.moderately_damaged":
      "damage_fit row 2 — conditioning_level moderate with no qualifying repair route — recommends the product for moderately damaged hair.",
    "profile.damage_fit.highly_damaged":
      "damage_fit row 2 — conditioning_level moderate with no qualifying repair route — reads highly damaged hair as conditional.",
    "profile.texture_fit.straight":
      "texture_fit row 2: weight_potential moderate with any slip level, which recommends the product for straight hair.",
    "profile.texture_fit.wavy":
      "texture_fit row 2: weight_potential moderate with any slip level, which recommends the product for wavy hair.",
    "profile.texture_fit.curly":
      "texture_fit row 2: weight_potential moderate with any slip level, which recommends the product for curly hair.",
    "profile.texture_fit.coily":
      "texture_fit row 2 (weight_potential moderate, any slip) reads coily hair as conditional.",
  },
  "slot-05-evo-head-mistress-cuticle-sealer": {
    g0: "in_category: Aqua leads (r1) and the captured directions apply the product to towel-dried hair with no rinse (rinse test PASS). The only candidate hold polymer, Polyacrylamide, is deliberately unenumerated in L5, so HOLD returns none.",
    "profile.product_form":
      "Presentation form cream, captured at identity (T10): the round-3 evidence chain independently describes it as an opaque cream carrying Dimethicone at rank 2, applied by hand before blow-drying.",
    "dimension.conditioning_potential":
      "One coherent route: the persistent silicone package above the tail (Dimethicone r2, Dimethiconol r5); Cyclopentasiloxane (r3) is a volatile carrier and adds nothing. high is gated on an absent LGN pair — the carried-open silicone COND cap.",
    "dimension.weight_residue_potential":
      "Exactly one persistent family above the tail — the persistent silicone (r2, r5). Polyacrylamide is an emulsifier polymer and not an enumerated family; macadamia oil is below the marker. The rank-6 marker holds confidence at moderate. [emulsion/nonLGN]",
    "dimension.persistence_removal_class":
      "Quaternium-80 would reach permanent_cationic but sits at r14, below the marker at r6, so it cannot set the class. What remains as architecture is the neutral non-volatile silicone deposit — a direction that under-warns on buildup.",
    "dimension.hold_route_state":
      "Polyacrylamide (r4) is the only candidate polymer, and v0.3 deliberately leaves it unenumerated in L5 (§17.19); here it plausibly serves the emulsifier and rheology function, so reading it as hold would be an untraced rule extension.",
    "dimension.heat_protection_evidence_state":
      "No C1/C2 heat claim: the heat statements sit at C5 (US manufacturer page) and C4 (German retailer), neither of which can create one, and no L9 member is present. Generic silicone does not prove heat protection.",
    "dimension.repair_surface_film":
      "Quaternium-80, a qualifying silicone quat, sits at r14 — below the tail marker at r6 — so R2 takes its rank-supported none_visible value and routes to review. Hydrolyzed Quinoa (r12) is a plain hydrolysate.",
    "dimension.fragrance_scalp_exposure":
      "Parfum (r7) plus a declared allergen block — Limonene (21), Hexyl Cinnamal (22), Linalool (23), Geraniol (24), Citral (25). No Alcohol Denat., so no alcohol note; Benzophenone-4 (r11) is recorded but infers nothing.",
    hinweise:
      "Only SHN fired, as an SFR qualifier. R3 is researched and negative, CURL has no value vocabulary, and the buildup caution stays off because persistence projects moderate — which is the under-warning direction here.",
    care_direction:
      "T19: film-led → balanced (Richtungsneutralität). Alle vier Klauseln greifen: kein R2 als Architektur, Silikonfilm über dem Marker (Dimethicone r2, Cyclopentasiloxane r3, Dimethiconol r5), kein L1/L3/L4 über dem Marker.",
    "profile.repair_support_level":
      "R2 holds none_visible because the qualifying silicone quat sits below the tail marker, so the medium row is not reached and there is no E3+ exact-product evidence for high; the record routes to review on that below-marker note.",
    "profile.focus.primary":
      "Smoothing fails twice over: SFR is moderate, and the persistent silicone film is itself what established COND, so it is baseline conditioning, not a route. Every other route fails too → general, a deliberate outcome for this archetype.",
    "profile.focus.secondary":
      "No route cleared the beyond-baseline test, so nothing is left to carry as a secondary focus.",
    "profile.specialist_functions.provides_heat_protection":
      "The heat statements sit only at C5 and C4, neither of which creates a claim, and no L9 member is present, so §13.3 rule 1 sets the binary to false while routing the record to review.",
    "profile.hair_thickness_fit.fine":
      "hair_thickness_fit follows weight_potential: moderate (row 2), which reads fine hair as conditional.",
    "profile.hair_thickness_fit.medium":
      "hair_thickness_fit follows weight_potential: moderate (row 2), which recommends the product for normal-diameter hair.",
    "profile.hair_thickness_fit.coarse":
      "hair_thickness_fit follows weight_potential: moderate (row 2), which recommends the product for coarse hair.",
    "profile.damage_fit.healthy":
      "damage_fit row 2 — COND moderate with no qualifying repair route — recommends the product for healthy hair.",
    "profile.damage_fit.moderately_damaged":
      "damage_fit row 2: R2 is none_visible even though a silicone quat is present, because it sits below the marker, so row 3b stays closed and moderately damaged hair reads recommended.",
    "profile.damage_fit.highly_damaged":
      "damage_fit row 2 reads highly damaged hair as conditional; row 3b is unreachable because the silicone quat sits below the marker — exactly the consequence the candidate_below_tail review route exists to surface.",
    "profile.texture_fit.straight":
      "texture_fit row 2: weight_potential moderate with any slip level, which recommends the product for straight hair.",
    "profile.texture_fit.wavy":
      "texture_fit row 2: weight_potential moderate with any slip level, which recommends the product for wavy hair.",
    "profile.texture_fit.curly":
      "texture_fit row 2: weight_potential moderate with any slip level, which recommends the product for curly hair.",
    "profile.texture_fit.coily":
      "texture_fit row 2 (weight_potential moderate, any slip) reads coily hair as conditional.",
  },
  "slot-06-curlsmith-hydrate-plump-leave-in": {
    g0: "in_category: Water leads and the directions work the product into wet hair with no rinse step (rinse test PASS). PVP is present, but a substantive conditioning architecture dominates it, so HOLD returns incidental_film.",
    "profile.product_form":
      "Presentation form lotion, captured at identity (T10): a 237 ml pack with hand-distributed, work-into-wet-hair directions consistent with a pourable liquid rather than a scooped cream.",
    "dimension.conditioning_potential":
      "The LGN pair above the tail (Cetearyl Alcohol r3 + Behentrimonium Chloride r6) plus a rich emollient package (r2, r4, r5, r9, r10), with the cationic polymers (r11, r12) as a third route → high.",
    "dimension.weight_residue_potential":
      "Both high prongs fire: an LGN pair as architecture (r3 + r6), and two or more persistent families with enumerated rich-band members — castor oil (r5) and shea butter (r9) alongside the dry-feel esters and jojoba. Transfer caution attached. [emulsion/LGN]",
    "dimension.persistence_removal_class":
      "Guar Hydroxypropyltrimonium Chloride (r11) and Polyquaternium-10 (r12) are both enumerated by INCI name in the permanent_cationic class and sit above the marker. Silicone-free plus a cationic polymer is not low buildup (FS-20).",
    "dimension.hold_route_state":
      "PVP (r32) is a fixative-class L5 member above the marker (r36); a conditioning architecture dominates it → incidental_film. T17/H1: marker now vacuous (cl.6) — PVP rests on the coherence read (floor confidence), not rank credit; value unchanged.",
    "dimension.heat_protection_evidence_state":
      "No C1/C2 heat claim and no L9 member at any rank: plain PVP is deliberately not on the closed L9 list, which carries PVP/DMAPA Acrylates Copolymer instead. Routed to review because no German-market source exists at all.",
    "dimension.repair_surface_film":
      "No cationised protein, silane derivative or silicone quat at any rank. Guar HPTC and PQ-10 are non-silicone cationic polymers that feed only PERS and SFR, and Panthenol is a fibre-mechanics signal, not an R2 route.",
    "dimension.fragrance_scalp_exposure":
      "No Parfum is declared, but two EU-labelled allergens are — Hydroxycitronellal (r39) and Citronellol (r40) — alongside a large botanical block. Isopropyl Alcohol (r27) sits outside the §7.12 enumeration, so no alcohol note.",
    hinweise:
      "SHN fired as an SFR qualifier, the buildup caution fired with persistence: high, and the transfer caution fired on the castor/shea lipid load. R3 is researched and negative, and CURL has no value vocabulary.",
    care_direction:
      "R2 none_visible puts protein and balanced out of reach, and the product is silicone-free so the silicone-led rule does not fire. L1, L3 and L4 are all present as architecture → moisture at up to moderate confidence.",
    "profile.repair_support_level":
      "R2 is none_visible — the two cationic polymers are explicitly not qualifying routes — so the medium row is not reached, and there is no exact-product repair evidence at E3+ for high.",
    "profile.focus.primary":
      "T13 (permissive reading, 2026-09-10): SFR high clears the two-observation test (film Guar HPTC r11 + PQ-10 r12). COND high was over-satisfied; one admissible set (the LGN pair) leaves the film beyond baseline → smoothing.",
    "profile.focus.secondary":
      "No further route clears the independent-moderate-or-better bar once smoothing is primary: no C1/C2 marketing position exists at all, so repair was never reachable even before T13, and every other route fails its own gate.",
    "profile.specialist_functions.provides_heat_protection":
      "No C1/C2 heat claim and no L9 member: plain PVP is not on the closed L9 list, and adding a member would need new peer-reviewed evidence and a version bump → binary false.",
    "profile.hair_thickness_fit.fine":
      "hair_thickness_fit follows weight_potential: high (row 3), which reads fine hair as caution; that value carries the §7.5 judgment-call limitation.",
    "profile.hair_thickness_fit.medium":
      "hair_thickness_fit follows weight_potential: high (row 3), which reads normal-diameter hair as conditional.",
    "profile.hair_thickness_fit.coarse":
      "hair_thickness_fit follows weight_potential: high (row 3), which recommends the product for coarse hair.",
    "profile.damage_fit.healthy":
      "damage_fit row 2 recommends the product for healthy hair; row 3a needs a qualifying specialist route and a non-silicone cationic polymer explicitly does not qualify.",
    "profile.damage_fit.moderately_damaged":
      "damage_fit row 2: no qualifying specialist route for row 3a and R2 is not candidate or tested for row 3b, so moderately damaged hair reads recommended.",
    "profile.damage_fit.highly_damaged":
      "damage_fit row 2 applies because neither the specialist-route path nor the R2 path opens, and that row reads highly damaged hair as conditional.",
    "profile.texture_fit.straight":
      "texture_fit row 3: WT high with SLIP high, which reads straight hair as conditional. HOLD incidental_film does not raise curly or coily by itself, and curl branding never determines the result.",
    "profile.texture_fit.wavy":
      "texture_fit row 3: WT high with SLIP high, which recommends the product for wavy hair. Curl branding never determines the result (§10.3).",
    "profile.texture_fit.curly":
      "texture_fit row 3: WT high with SLIP high, which recommends the product for curly hair. HOLD incidental_film does not raise this row by itself.",
    "profile.texture_fit.coily":
      "texture_fit row 3: WT high with SLIP high, which recommends the product for coily hair. HOLD incidental_film does not raise this row by itself.",
  },
  "slot-07-maria-nila-curlicue-cream": {
    g0: "excluded_styling_first via §2.3.2 clause 3: PVP at r4 is a fixative L5 member in a film-forming context with thin conditioning behind it, and the positioning half rests only on C4/C5 with no C1/C2 evidence pointing the other way.",
    "dimension.conditioning_potential":
      "The rank prong places Cetyl Alcohol (r5) and Quaternium-95 (r11) as architecture, so low is refused. A lone fatty alcohol with no cationic partner plus an unresolvable quat is a thin read — recorded, and it lowers confidence one step.",
    "dimension.weight_residue_potential":
      "Exactly one persistent non-volatile family above the tail — Cetyl Alcohol (r5), read as an emollient and consistency factor. No LGN pair, no rich band, no silicone. [solution]",
    "dimension.persistence_removal_class":
      "Quaternium-95's polymeric-versus-monomeric structure is not settled by the INCI name, so it is not promoted to permanent_cationic; §7.6 takes neutral_non_volatile with the monomeric note and routes to review.",
    "dimension.hold_route_state":
      "The G0-deciding read: PVP (r4) sits above the marker in a film-forming context with thin conditioning behind it. Only the coarse state is emitted — the C5 „Hold 3/5“ is the manufacturer's own scale and is not adopted as a level.",
    "dimension.heat_protection_evidence_state":
      "No heat claim at any tier and no L9 member anywhere. The binary would be false but is not emitted, because an excluded record carries no lean profile.",
    "dimension.repair_surface_film":
      "No cationised protein, silane derivative or silicone quat at any rank, and no hydrolysed protein at all, so no below-tail candidate note arises.",
    "dimension.fragrance_scalp_exposure":
      "Parfum (r17) is declared but no individual EU allergens are, which is the fragrance_declared shape. No Alcohol Denat., so no alcohol note; the flag is an exposure statement only.",
    hinweise:
      "Only SHN fired, as an SFR qualifier. R3 is researched and negative — no C1/C2 bond claim and no recognised bond chemistry — CURL has no value vocabulary, and neither LAYER nor the buildup caution is emitted.",
    care_direction:
      "The humectant-led minimum row: an L4 leg is present as architecture (Propylene Glycol r2, Glycerin r3, Butylene Glycol r9, Propanediol r12) with no R2 route, while the emollient and cationic legs are thin or absent. Informational only.",
  },
  "slot-08-schwarzkopf-gliss-sprueh-conditioner-express-repair-ultimate-repair": {
    g0: "in_category: Aqua leads and the C2 directions state „Nicht ausspülen!“ explicitly (rinse test PASS), despite the brand's own „Sprüh-Conditioner“ / „Spülung“ naming — the classic case for classifying by directions, not by name. HOLD is none.",
    "profile.product_form":
      "Presentation form spray, captured at identity (T10): the pack is named `Sprüh-Conditioner` and directions instruct shaking before use and spraying onto towel-dried or dry hair.",
    "dimension.conditioning_potential":
      "One coherent route: the persistent silicone package above the tail (Dimethicone r3, Phenyl Trimethicone r5, Dimethiconol r8); Trisiloxane (r2) is a volatile carrier. high is gated on an LGN pair that cannot exist without a fatty alcohol.",
    "dimension.weight_residue_potential":
      "Three persistent families above the tail — silicone (r3/r5/r8), medium-band apricot kernel oil (r4) and the cationic-polymer film PQ-16 (r9) — but no rich/low-spreading band member at any rank and no LGN pair, so weight holds at moderate. [emulsion/nonLGN]",
    "dimension.persistence_removal_class":
      "Polyquaternium-16 at r9, above the marker, is a declared Polyquaternium-x enumerated by INCI name in the permanent_cationic class; FS-20 names it among the most substantive materials in the category. The buildup caution travels with it.",
    "dimension.hold_route_state":
      "No fixative-class L5 polymer is declared. Polyquaternium-16 is a cationic conditioning polymer, not a fixative (FS-9).",
    "dimension.heat_protection_evidence_state":
      "A C1/C2 heat claim exists („Hitzeschutz bis zu 230 °C“), so the claim leads. The formula check finds no L9 member — PQ-16 is not PQ-55, Hydrolyzed Keratin is not hydrolyzed wheat protein — so the record routes to review.",
    "dimension.repair_surface_film":
      "No route from the closed §7.10 list is present. Hydrolyzed Keratin (r6) and Hydrolyzed Pearl (r7) sit high in the list but are plain hydrolysates: cationisation or silane functionalisation, not rank, is what makes a protein an R2 route.",
    "dimension.fragrance_scalp_exposure":
      "Parfum (r12), Tetramethyl Acetyloctahydronaphthalenes (r16), Citrus Aurantium Peel Oil (r17), Limonene (r18) and Geranyl Acetate (r21). No Alcohol Denat., so no alcohol note.",
    hinweise:
      "SHN fired as an SFR qualifier and the buildup caution fired with persistence: high. R3 is negative — the two C2 claims are repair claims, not bond claims, and no recognised bond chemistry is present.",
    care_direction:
      "R2 none_visible puts protein and balanced out of reach whatever the keratin marketing says. The silicone-led unknown rule does not fire because a material emollient leg is present (apricot oil r4), so L1 + L3 → moisture. Open gap §17.22.",
    "profile.repair_support_level":
      "R2 is none_visible — the headline Hydrolyzed Keratin is a plain hydrolysate — so the medium row is not reached and there is no E3+ exact-product evidence for high. The C2 repair claims explicitly cannot raise the level.",
    "profile.focus.primary":
      "T13 (2026-09-10): the marketing-position prong is deleted (positioning never creates a route) — R2 none_visible leaves no repair route. SFR high clears the two-observation test (film r3/r5/r8); permissive reading → smoothing.",
    "profile.focus.secondary":
      "repair cannot appear even as secondary — its only route was the deleted marketing prong. heat_styling remains the near-miss: provides_heat_protection is true, but application_stage has no pre_heat.",
    "profile.specialist_functions.provides_heat_protection":
      "The C1/C2 heat claim leads (§13.3 rule 1), so the binary is true — a policy decision about what the product is sold as, not an efficacy statement. No L9 member is present, so the record routes to review; the 230 °C figure is never a level.",
    "profile.hair_thickness_fit.fine":
      "hair_thickness_fit follows weight_potential: moderate (row 2), which reads fine hair as conditional; that value carries the §7.5 judgment-call limitation.",
    "profile.hair_thickness_fit.medium":
      "hair_thickness_fit follows weight_potential: moderate (row 2), which recommends the product for normal-diameter hair.",
    "profile.hair_thickness_fit.coarse":
      "hair_thickness_fit follows weight_potential: moderate (row 2), which recommends the product for coarse hair.",
    "profile.damage_fit.healthy":
      "damage_fit row 2 — COND is moderate, so row 3a is closed, and R2 none_visible closes row 3b — recommends the product for healthy hair.",
    "profile.damage_fit.moderately_damaged":
      "damage_fit row 2: COND moderate and R2 none_visible, so neither specialist path opens and moderately damaged hair reads recommended.",
    "profile.damage_fit.highly_damaged":
      "R14's repair-film path (row 3b) needs a genuine R2 candidate/tested route; a keratin claim over a plain hydrolysate is not one, so row 3b stays closed and highly damaged hair reads conditional on the conditioning path alone.",
    "profile.texture_fit.straight":
      "texture_fit row 2: weight_potential moderate with any slip level, which recommends the product for straight hair.",
    "profile.texture_fit.wavy":
      "texture_fit row 2: weight_potential moderate with any slip level, which recommends the product for wavy hair.",
    "profile.texture_fit.curly":
      "texture_fit row 2: weight_potential moderate with any slip level, which recommends the product for curly hair.",
    "profile.texture_fit.coily":
      "texture_fit row 2 (weight_potential moderate, any slip) reads coily hair as conditional.",
  },
  "slot-09-redken-extreme-anti-snap-leave-in-treatment": {
    g0: "in_category: Aqua leads and the directions state „Ohne ausspülen“ explicitly (rinse test PASS). HOLD is none, so the §2.3.2 architecture half is not established.",
    "profile.product_form":
      "Presentation form lotion, captured at identity (T10): a 250 ml treatment-lotion pack with hand-distributed, massage-in directions and no spray or shake verb.",
    "dimension.conditioning_potential":
      "The high anchor demands an LGN pair above the tail and the pair sits at r15–17, so high is refused; limit 3 forbids collapsing to low on a rank-3 marker. The readable route is Amodimethicone (r4) with the cationic package and IPM (r8).",
    "dimension.weight_residue_potential":
      "Three families are readable — silicone (Amodimethicone r4), dry-feel ester (IPM r8) and the LGN/cationic deposit — but no rich-band member appears at any rank, and limit 3 forbids the mechanical low. All sit below the rank-3 marker. [emulsion/nonLGN]",
    "dimension.persistence_removal_class":
      "Quaternium-33 (r19) is an opaque quat number that §7.6 refuses to promote, so Amodimethicone (r4) is the dominant persistent cationic species. It sits below the rank-3 marker; the alternative monomeric-quat reading projects moderate too.",
    "dimension.hold_route_state":
      "Polyacrylamide (r2) is the only candidate polymer and v0.3 deliberately leaves it unenumerated in L5; here it plainly serves the pre-neutralised emulsifier system, so reading it as a fixative would be an untraced rule extension.",
    "dimension.heat_protection_evidence_state":
      "A C1/C2 heat claim exists („…bietet gleichzeitig einen Hitzeschutz“, redken.eu/de-de). The closed-L9 check finds no member — the silanetriol is not wheat protein, Quaternium-33 is not Quaternium-70 — so the record routes to review.",
    "dimension.repair_surface_film":
      "T16: the marker (Phenoxyethanol r3) sits before this product's own core conditioning architecture (Amodimethicone r4), so it is implausible and cannot disqualify the silane. PG-Propyl Silanetriol at r14 qualifies directly → candidate.",
    "dimension.fragrance_scalp_exposure":
      "Parfum (r9) plus a declared allergen block — Benzyl Benzoate (18), Limonene (20), Benzyl Alcohol (21), Linalool (22). Benzyl Alcohol sits outside the §7.12 alcohol enumeration, so no alcohol note is emitted.",
    hinweise:
      "Only SHN fired, as an SFR qualifier; the C2 „glättet die Schuppenschicht“ positioning creates no independent value. R3 is negative — the C2 claims are heat and a strength percentage, not bond claims — and the buildup caution stays off.",
    care_direction:
      "T16: R2 is now candidate, so §9's protein anchor is met directly — moisture's no-protein-film condition no longer holds. balanced is not reached: the moisture-leg ingredients keep their below-marker reading in this pass → protein.",
    "profile.repair_support_level":
      "T16: the marker is ruled implausible (it precedes the product's own core conditioning architecture), so it can no longer disqualify the r14 silane. R2 = candidate, conditioning_level = moderate → §10.3.2's medium row is reached.",
    "profile.focus.primary":
      "T16 re-derivation: R2 = candidate opens a dedicated repair route (§10.2, T13a), the sole qualifying route in the rank order → primary moves general → repair. smoothing still fails (SFR moderate, one observation only, unchanged by this pass).",
    "profile.focus.secondary":
      "No other route clears its own independent-support bar, so secondary stays empty. repair is now primary via R2 candidate (T16); the C2 repair-led positioning corroborates but does not create the route (principle 4).",
    "profile.specialist_functions.provides_heat_protection":
      "A C1/C2 heat claim on the German-market Redken page leads, so the binary is true as a policy decision. No L9 member is present at any rank, so the record routes to review; no °C figure exists on that page and none is used.",
    "profile.hair_thickness_fit.fine":
      "hair_thickness_fit follows weight_potential: moderate (row 2), which reads fine hair as conditional; that value carries the §7.5 judgment-call limitation.",
    "profile.hair_thickness_fit.medium":
      "hair_thickness_fit follows weight_potential: moderate (row 2), which recommends the product for normal-diameter hair.",
    "profile.hair_thickness_fit.coarse":
      "hair_thickness_fit follows weight_potential: moderate (row 2), which recommends the product for coarse hair.",
    "profile.damage_fit.healthy":
      "T16: R2 candidate + conditioning_level moderate now open §10.3's repair-film path (row 3b), which reads healthy hair as conditional — replacing row 2's recommended, the honest cost of the repair-film tier opening.",
    "profile.damage_fit.moderately_damaged":
      "Row 3b (R2 candidate, COND ≥ moderate) is now reached and, like row 2 before it, reads moderately damaged hair as recommended — both rows agree on this cell, so the value is unchanged by T16.",
    "profile.damage_fit.highly_damaged":
      "T16: the marker no longer disqualifies the r14 silane, so R2 = candidate opens R14's repair-film path (row 3b) — the tier written for exactly this archetype. highly damaged hair moves conditional → recommended.",
    "profile.texture_fit.straight":
      "texture_fit row 2: weight_potential moderate with any slip level, which recommends the product for straight hair.",
    "profile.texture_fit.wavy":
      "texture_fit row 2: weight_potential moderate with any slip level, which recommends the product for wavy hair.",
    "profile.texture_fit.curly":
      "texture_fit row 2: weight_potential moderate with any slip level, which recommends the product for curly hair.",
    "profile.texture_fit.coily":
      "texture_fit row 2 (weight_potential moderate, any slip) reads coily hair as conditional.",
  },
  "slot-10-olaplex-n-6-bond-smoother": {
    g0: "in_category: Water leads and the manufacturer's own FAQ calls it an out-of-shower leave-in treatment, with no rinse instruction anywhere (rinse test PASS). HOLD is none, so the „styling product“ self-description never reaches §2.3.2.",
    "profile.product_form":
      "Presentation form cream, captured at identity (T10): sold as the Bond Smoother creme, dispensed by pump and combed through rather than sprayed or bulk-massaged.",
    "dimension.conditioning_potential":
      "The LGN pair above the tail (r2 + r7) plus an independent persistent silicone route (Dimethicone r3, Phenyl Trimethicone r9), with the dry-feel esters (r5, r6) as a third. Isohexadecane and Isododecane are volatile and add nothing.",
    "dimension.weight_residue_potential":
      "The LGN pair (Cetearyl Alcohol r2 + Behentrimonium Chloride r7) fires the high anchor's first prong on its own. The rich-band candidates — coconut (r46) and sunflower (r34) — sit far below the marker at r14, so the second prong stays shut. [emulsion/LGN]",
    "dimension.persistence_removal_class":
      "No polymeric or silicone-functional quat is present: Hydroxypropyl Guar (r18) is the non-ionic guar, not the quaternised species. The dominant persistent cationics are the monomeric quats Behentrimonium and Cetrimonium Chloride.",
    "dimension.hold_route_state":
      "No fixative-class L5 polymer is declared. Hydroxyethylcellulose (r17) and Hydroxypropyl Guar (r18) are explicit L5 rheology exclusions — gums serving bottle viscosity are not a hold route by themselves.",
    "dimension.heat_protection_evidence_state":
      "T14 (§2.4.1 rule 7): the 450°F/232°C claim on olaplex.com/es.olaplex.com is admitted — identity verified against douglas.de's INCI/GTIN, and douglas.de (C3) corroborates. No L9 member → claim_only, not formula_plausible.",
    "dimension.repair_surface_film":
      "The qualifying silane route — PG-Propyl Silanetriol at r24 — sits below the marker at r14, so the rank-supported none_visible stands. Bis-Aminopropyl Diglycol Dimaleate is L7 bond chemistry, not an R2 route.",
    "dimension.fragrance_scalp_exposure":
      "Parfum (r12) plus a large declared allergen block (Hexyl Cinnamal, Limonene, Citral, Linalool, Citronellol, Hydroxycitronellal, Geraniol). Isopropyl Alcohol (r16) sits outside the §7.12 enumeration, so no alcohol note.",
    hinweise:
      "SHN fired as an SFR qualifier; R3 fired as chemistry_candidate (r11), opening bond_claim_review but never a repair level (G8, salon evidence barred). Buildup now fires too (T17/H6): WT high + the monomeric quats as a persistent non-volatile family.",
    care_direction:
      "R2 none_visible puts protein and balanced out of reach, and emollient (r5, r6) plus humectant (Propanediol r10) legs above the marker keep the silicone-led unknown rule from firing → moisture. Bond-repair positioning never sets the value.",
    "profile.repair_support_level":
      "The qualifying silane sits at r24, below the marker at r14, so R2 holds none_visible and the medium row is unreachable. The R3 bond-chemistry candidate is explicitly invisible to this rule, so a bond-claim-only product is low.",
    "profile.focus.primary":
      "T13 (permissive reading, 2026-09-10): SFR high clears the two-observation test (film r3/r9). COND high was over-satisfied by the LGN pair alone, so a single admissible set leaves the film beyond baseline → smoothing, matching the 'Bond Smoother' identity.",
    "profile.focus.secondary":
      "repair stays unavailable: the silane is below the marker, no C1/C2 marketing position exists, and R3 alone may never set repair (R14) — as secondary it needs an independent moderate+ observation, and the only candidate (the silane) fails the rank prong.",
    "profile.specialist_functions.provides_heat_protection":
      "T14: the claim now exists (C2_cross_market_verified), so §13.3 rule 1 sets the binary true; no L9 member, so it routes to review under heat_claim_without_l9_member. The figure is never a protection strength.",
    "profile.hair_thickness_fit.fine":
      "hair_thickness_fit follows weight_potential: high (row 3), which reads fine hair as caution; that value carries the §7.5 judgment-call limitation.",
    "profile.hair_thickness_fit.medium":
      "hair_thickness_fit follows weight_potential: high (row 3), which reads normal-diameter hair as conditional.",
    "profile.hair_thickness_fit.coarse":
      "hair_thickness_fit follows weight_potential: high (row 3), which recommends the product for coarse hair.",
    "profile.damage_fit.healthy":
      "damage_fit row 2 recommends the product for healthy hair; the silane is below the marker so row 3b stays closed, and R14 makes the R3 bond flag invisible to this table.",
    "profile.damage_fit.moderately_damaged":
      "damage_fit row 2: no qualifying specialist route for row 3a and R2 none_visible for row 3b, so moderately damaged hair reads recommended.",
    "profile.damage_fit.highly_damaged":
      "R14 is explicit that an R3 bond flag never qualifies a product for the highly-damaged tier on its own — it opens a review flag and stays invisible here — so this bond-repair product reads conditional on its conditioning level.",
    "profile.texture_fit.straight":
      "texture_fit row 3: WT high with SLIP high (three independent M1 contributors), which reads straight hair as conditional.",
    "profile.texture_fit.wavy":
      "texture_fit row 3: WT high with SLIP high, which recommends the product for wavy hair.",
    "profile.texture_fit.curly":
      "texture_fit row 3: WT high with SLIP high, which recommends the product for curly hair.",
    "profile.texture_fit.coily":
      "texture_fit row 3: WT high with SLIP high, which recommends the product for coily hair.",
  },
  "slot-11-balea-leichtkaemmspray-pure-styling": {
    g0: "in_category: Aqua leads and the C2 directions state „Produkt muss nicht wieder ausgespült werden.“ explicitly (rinse test PASS). HOLD is none — and the „Pure Styling“ in the product name does not touch the decision.",
    "profile.product_form":
      "Presentation form spray, captured at identity (T10): the pack is named `Spray` and directions instruct spraying onto wet hair.",
    "dimension.conditioning_potential":
      "Cetrimonium Chloride (r4) is the sole conditioning species and no persistent non-volatile of any kind sits above the tail — literally the low anchor. moderate would need a cationic-polymer film or a persistent emollient package.",
    "dimension.weight_residue_potential":
      "All four low conditions hold literally: a water/glycol-dominant architecture with no persistent non-volatile family above the tail, no LGN pair and no rich-band lipid. On an eleven-ingredient list there is genuinely nothing to miss. [solution]",
    "dimension.persistence_removal_class":
      "No polymeric or silicone-functional quat, no amino silicone and no amidoamine. §7.6 explicitly refuses volatile_or_water_soluble here because a monomeric long-chain quat (Cetrimonium Chloride r4) is the dominant persistent species.",
    "dimension.hold_route_state":
      "No fixative-class L5 polymer is declared. „Pure Styling“ in the product name creates nothing.",
    "dimension.heat_protection_evidence_state":
      "No C1/C2 heat claim — the C2 house-brand page was fetched live and its silence recorded as an active check — and no L9 member at any rank. The source was located and is silent, so this is not a claim_authority_gap.",
    "dimension.repair_surface_film":
      "No cationised protein, silane derivative or silicone quat at any rank, and no hydrolysed protein of any kind. Panthenol (r6) is a fibre-mechanics signal, not an R2 surface-film route and not a heat route.",
    "dimension.fragrance_scalp_exposure":
      "No Parfum, no Aroma, no declared EU allergen and no aromatic essential oil at any rank; the C2 „Ohne Parfüm“ badge corroborates. This is not fragrance-free, not allergy-safe and not hypoallergenic — only an exposure statement.",
    hinweise:
      "Nothing fired. SHN is absent because there is no alignment or deposition film — the C2 „Natürlicher Glanz“ positioning does not create the qualifier. R3 is researched and negative, and no buildup or transfer caution applies.",
    care_direction:
      "The humectant-led minimum row: an L4 leg is present as architecture (Betaine r2, Propylene Glycol r3, Panthenol r6, all above the marker) with no R2 route, while there is no L3 leg at all and the L1 leg is a single monomeric quat.",
    "profile.repair_support_level":
      "R2 is none_visible, so no qualifying substantive film route reaches the medium row, and there is no exact-product repair evidence at E3+ to reach high → low.",
    "profile.focus.primary":
      "detangling qualifies on both prongs: detangling-led C2 positioning („Leichtkämmspray“, „erleichtert das Kämmen erheblich“) with SLIP moderate, and a slip-dominant light architecture — SLIP moderate, COND low, WT low.",
    "profile.focus.secondary":
      "volume_lightness qualifies on WT low with no persistent film route, and clears the independent-support bar on a distinct weight observation — the absence of any persistent non-volatile family — not the slip read behind detangling.",
    "profile.specialist_functions.provides_heat_protection":
      "No C1/C2 heat claim — the C2 house-brand page was actively checked and is silent — and no L9 member at any rank, so the binary is false without any authority gap.",
    "profile.hair_thickness_fit.fine":
      "hair_thickness_fit follows weight_potential: low (row 1), which recommends the product for fine hair; that value still carries the §7.5 judgment-call limitation.",
    "profile.hair_thickness_fit.medium":
      "hair_thickness_fit follows weight_potential: low (row 1), which recommends the product for normal-diameter hair.",
    "profile.hair_thickness_fit.coarse":
      "hair_thickness_fit follows weight_potential: low (row 1), which reads coarse hair as conditional.",
    "profile.damage_fit.healthy":
      "damage_fit row 1 — conditioning_level low with no qualifying repair route — recommends the product for healthy hair.",
    "profile.damage_fit.moderately_damaged":
      "damage_fit row 1: conditioning_level low with no qualifying repair route reads moderately damaged hair as conditional.",
    "profile.damage_fit.highly_damaged":
      "damage_fit row 1 reads highly damaged hair as caution — the honest result, since a water/glycol solution with one monomeric quat has little to offer badly damaged hair.",
    "profile.texture_fit.straight":
      "texture_fit row 1: weight_potential low, a light dry-down, which recommends the product for straight hair.",
    "profile.texture_fit.wavy":
      "texture_fit row 1: weight_potential low, a light dry-down, which recommends the product for wavy hair.",
    "profile.texture_fit.curly":
      "texture_fit row 1: weight_potential low, a light dry-down, which reads curly hair as conditional.",
    "profile.texture_fit.coily":
      "texture_fit row 1: weight_potential low, a light dry-down, which reads coily hair as caution.",
  },
  "slot-12-kevin-murphy-young-again-oil": {
    g0: "excluded_anhydrous: Water sits at r23 of 36, behind Cyclopentasiloxane, Dimethicone, Dimethiconol and Bis-Cetearyl Amodimethicone (r1–4). §2.3 trap 1: an anhydrous serum leaves the category regardless of its leave-on directions.",
    "dimension.conditioning_potential":
      "An LGN pair sits above the rank-29 marker (Cetearyl Alcohol r18 + Behentrimonium Chloride r24), with persistent silicones (r2, r3) and an amino silicone (r4). T17/H1: marker now formally vacuous (§3.1.1 cl.6) — informational only, no profile emitted.",
    "dimension.weight_residue_potential":
      "The LGN pair (r18 + r24) fires the high anchor's first prong; the volatiles (r1, r16) contribute nothing. No enumerated rich-band member — safflower is an unenumerated liquid vegetable oil read medium-band. [anhydrous]",
    "dimension.persistence_removal_class":
      "Quaternium-91 (r21) is an opaque quat number that §7.6 refuses to promote, so Bis-Cetearyl Amodimethicone (r4), an amino silicone, places the record in ph_dependent_cationic. The rinse-off selectivity argument is not used.",
    "dimension.hold_route_state": "No fixative-class L5 polymer is declared.",
    "dimension.heat_protection_evidence_state":
      "No C1/C2 heat claim exists: the German-language heat statement is on the brand's Austrian site and the temperature figure on the Australian one, both C5. No L9 member at any rank, and the 93 °C figure is never read as a protection strength.",
    "dimension.repair_surface_film":
      "No cationised protein, silane derivative or silicone quat at any rank. Hydrolyzed Soy Protein (r14) is a plain hydrolysate, and Hexapeptide-11 (r15) is a peptide with no cationisation or silane function, so neither is a qualifying route.",
    "dimension.fragrance_scalp_exposure":
      "Fragrance (r31), Citrus Limon Peel Oil (r9) and a declared allergen block including EU-restricted HICC (r35), one of the four preserved conflicts. No Alcohol Denat.; the violet dye at r36 draws no colour-deposit conclusion.",
    hinweise:
      "Only SHN fired, as an SFR qualifier. R3 is researched and negative — no C1/C2 bond claim and no recognised bond chemistry — and neither LAYER nor the buildup caution is emitted.",
    care_direction:
      "R2 none_visible puts protein and balanced out of reach, and emollient and humectant legs above the marker (safflower r6, Myristyl Myristate r20) block the silicone-led unknown rule — the §17.22 under-firing shape. Informational only.",
  },
  "slot-13-neqi-diamond-glass-ultimate-styling-spray": {
    g0: "in_category (T15): HOLD is incidental_film — Silicone Quaternium-18 (r11) + Polysilicone-29 (r7) form a genuine conditioning film behind the fixative vinyl copolymer (r8); the styling-first architecture half never fires. Supersedes round-3.",
    "profile.product_form":
      "Presentation form spray, captured at identity (T10): the pack is named `Spray` and directions instruct spraying onto towel-dried hair before heat styling.",
    "dimension.conditioning_potential":
      "One coherent route: Polysilicone-29 (r7), a persistent silicone film former present as architecture. There is no LGN pair for high, and low is refused because that silicone is a persistent non-volatile above the tail.",
    "dimension.weight_residue_potential":
      "One persistent non-volatile family above the tail — the silicone film former Polysilicone-29 (r7). No LGN pair and no lipid of any kind; the alternative reading that counts the fixative film as a second family lands on the same row. [microemulsion]",
    "dimension.persistence_removal_class":
      "Silicone Quaternium-18 would reach permanent_cationic but sits at r11, below the marker at r9, so it cannot set the class. What remains as architecture is Polysilicone-29, a neutral non-volatile — a direction that under-warns on buildup.",
    "dimension.hold_route_state":
      "incidental_film (T15): Silicone Quaternium-18 (r11) + Polysilicone-29 (r7) form a conditioning film dominating the fixative copolymer (r8). T17/H9: same species/rank reads disqualified for R2 below — species_reading_conflict; neither value changes.",
    "dimension.heat_protection_evidence_state":
      "A C2 heat claim exists („Hitzeschutz bis 230°“), so the claim leads. The vinyl copolymer is enumerated as L5 fixative-class, not L9 — family resemblance is not membership — so no L9 member is present and the record routes to review.",
    "dimension.repair_surface_film":
      "A qualifying route (Silicone Quaternium-18, r11) sits below the marker (r9), so R2 takes its rank-supported none_visible value and routes to review. T17/H9: HOLD (above) reads the same species/rank as substantive — species_reading_conflict; R2 unchanged.",
    "dimension.fragrance_scalp_exposure":
      "No Parfum, no Aroma and no declared EU allergen at any rank. Gardenia Taitensis Flower Extract (r3) is aromatic, but the aromatic value covers essential oils and an extract is not one, so the literal read stands and the field is uncertain.",
    hinweise:
      "Only SHN fired, as an SFR qualifier — „Diamond Glass“ and „ultimativer Glanz“ are positioning and create nothing. R3 is researched and negative, and the buildup caution stays off because persistence projects moderate.",
    care_direction:
      "R2 none_visible puts protein and balanced out of reach, and a humectant leg above the tail (Dipropylene and Pentylene Glycol, r2/r6) keeps the silicone-led unknown rule from firing → the humectant-led minimum row.",
    "profile.repair_support_level":
      "The qualifying silicone quat sits at r11, below the marker at r9, so R2 holds none_visible and the medium row is unreachable; there is no exact-product repair evidence at E3+ for high.",
    "profile.focus.primary":
      "heat_styling qualifies on both halves cleanly: the C2 „Hitzeschutz bis 230°“ claim sets provides_heat_protection true, and application_stage includes pre_heat from „mit Hitze … föhnen“. It sets a use context, never a protection level.",
    "profile.focus.secondary":
      "No remaining route qualifies. curl_definition failed the C1/C2 negative gate — the directions blow-dry auf Spannung — and volume_lightness was refused despite the C2 „Ultra-leichte Textur“ claim, because positioning never creates a route.",
    "profile.specialist_functions.provides_heat_protection":
      "The C2 „Hitzeschutz bis 230°“ claim leads (§13.3 rule 1), so the binary is true as a policy decision. No L9 member is present — the vinyl copolymer is L5, not L9 — so the record routes to review. The 230° figure is never a protection level.",
    "profile.hair_thickness_fit.fine":
      "hair_thickness_fit follows weight_potential: moderate (row 2), which reads fine hair as conditional; that value carries the §7.5 judgment-call limitation.",
    "profile.hair_thickness_fit.medium":
      "hair_thickness_fit follows weight_potential: moderate (row 2), which recommends the product for normal-diameter hair.",
    "profile.hair_thickness_fit.coarse":
      "hair_thickness_fit follows weight_potential: moderate (row 2), which recommends the product for coarse hair.",
    "profile.damage_fit.healthy":
      "damage_fit row 2 — COND moderate with no qualifying repair route — recommends the product for healthy hair.",
    "profile.damage_fit.moderately_damaged":
      "damage_fit row 2: R2 is none_visible despite the below-marker silicone quat, so row 3b stays closed and moderately damaged hair reads recommended.",
    "profile.damage_fit.highly_damaged":
      "damage_fit row 2 reads highly damaged hair as conditional; row 3b is unreachable because the silicone quat sits below the marker.",
    "profile.texture_fit.straight":
      "texture_fit row 2: weight_potential moderate with any slip level, which recommends the product for straight hair. HOLD meaningful_hold_route does not raise curly or coily by itself.",
    "profile.texture_fit.wavy":
      "texture_fit row 2: weight_potential moderate with any slip level, which recommends the product for wavy hair.",
    "profile.texture_fit.curly":
      "texture_fit row 2: weight_potential moderate with any slip level, which recommends the product for curly hair. HOLD meaningful_hold_route only triggers the G0 styling review, which it has.",
    "profile.texture_fit.coily":
      "texture_fit row 2 (weight_potential moderate, any slip) reads coily hair as conditional. HOLD meaningful_hold_route does not raise this row by itself.",
  },
}

// ---------------------------------------------------------------- helpers ---
//
// slugify, stableStringify, fingerprint and displayValue now live in
// ./lab-fixture-shared.mjs (imported above) so build-unseen-products.mjs can
// fingerprint and format its own records identically without duplicating
// this logic.

// Distinctive terms that let a §14 routing basis be attached to the property it
// names. Only the routing text itself is shown; nothing is rewritten.
const BASIS_ALIASES = {
  heat_protection_evidence_state: ["heat claim", "heat and", "heat,", "hitze"],
  "specialist_functions.provides_heat_protection": ["heat claim", "heat and", "heat,", "hitze"],
  hold_route_state: ["hold"],
  repair_surface_film: ["bond chemistry", "repair"],
  repair_support_level: ["bond chemistry", "repair"],
  fragrance_scalp_exposure: ["fragrance", "allergen"],
  persistence_removal_class: ["persistence", "quat"],
  // T11: the "two-phase" / "product form" aliases used to live on the FORM
  // row's own key; FORM is no longer a dimension, so its §14 routing basis
  // (e.g. `two_phase_product`) now attaches to WT, where the architecture
  // read is actually consumed (§3.1.2, §7.5 G9).
  weight_residue_potential: ["weight", "two-phase", "two phase", "product form"],
  "focus.primary": ["focus"],
  "focus.secondary": ["focus"],
  "texture_fit.straight": ["texture"],
  "texture_fit.wavy": ["texture"],
  "texture_fit.curly": ["texture"],
  "texture_fit.coily": ["texture"],
}

const gaps = []
const usedReasoningShortKeys = new Set()

// The build must fail rather than ship an unexplained row: every property needs
// an entry in REASONING_SHORT, except one whose rationale is missing from the
// evidence markdown, which gets the explicit gap string instead.
function reasoningShortFor(productId, propertyPath, hasRationale) {
  const summaries = REASONING_SHORT[productId]
  if (!summaries) throw new Error(`No reasoningShort map for product ${productId}`)
  usedReasoningShortKeys.add(`${productId}::${propertyPath}`)
  if (!hasRationale) return REASONING_SHORT_GAP
  const summary = summaries[propertyPath]
  if (typeof summary !== "string" || summary.trim().length === 0)
    throw new Error(`Missing reasoningShort for ${productId}.${propertyPath}`)
  if (summary.length > 260)
    throw new Error(
      `reasoningShort for ${productId}.${propertyPath} is ${summary.length} chars (budget ~220, hard cap 260)`,
    )
  return summary.trim()
}

function makeProperty(input) {
  const {
    productId,
    path: propertyPath,
    group,
    label,
    rawValue,
    confidence = null,
    evidenceLevel = null,
    evidenceScope = null,
    informational = false,
    echo = null,
    rationale,
    rationaleSource,
    observations = [],
    counterSignals = [],
    derivedFrom = [],
    reviewNote = null,
    adjudicationId = null,
    slot,
  } = input
  const hasRationale = typeof rationale === "string" && rationale.trim().length > 0
  if (!hasRationale) gaps.push(`slot ${slot} · ${propertyPath}`)
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
    reasoningShort: reasoningShortFor(productId, propertyPath, hasRationale),
    rationale: hasRationale ? rationale.trim() : null,
    rationaleSource: hasRationale ? rationaleSource : "json_fields_only",
    rationaleExtractionGap: !hasRationale,
    observations,
    counterSignals,
    derivedFrom,
    reviewNote,
    adjudication: adjudicationId ? ADJUDICATIONS[adjudicationId] : null,
  }
}

// json extras that read as observations vs counter-signals
const COUNTER_SIGNAL_JSON_KEYS = new Set([
  "mandatory_counter_signal",
  "conflict_tag_condition_failed",
  "below_marker_counter_signal",
  "coherence_counter_signal",
  "counter_signal",
])
const SKIP_JSON_KEYS = new Set([
  "value",
  "confidence",
  "evidence_level",
  "evidence_scope",
  "derived_from",
  "absorbed_slip_observation",
])

function jsonExtras(entry) {
  const observations = []
  const counterSignals = []
  for (const [k, v] of Object.entries(entry)) {
    if (SKIP_JSON_KEYS.has(k)) continue
    const text = Array.isArray(v) ? v.join(" · ") : String(v)
    if (COUNTER_SIGNAL_JSON_KEYS.has(k)) counterSignals.push(`${k}: ${text}`)
    else observations.push(`${k}: ${text}`)
  }
  return { observations, counterSignals }
}

// --------------------------------------------------------------- per product --

const products = []

for (const [index, product] of key.products.entries()) {
  const fileName = markdownFiles[index]
  const markdown = readFileSync(path.join(EVIDENCE_DIR, fileName), "utf8")
  const sections = splitSections(markdown)
  const packetEntry = packet.entries.find((entry) => entry.slot === product.slot)
  if (!packetEntry) throw new Error(`No packet entry for slot ${product.slot}`)
  const slot = product.slot
  const productId = `slot-${String(slot).padStart(2, "0")}-${slugify(`${product.brand} ${product.product}`)}`

  const sectionByTitleStart = (level, prefix) =>
    sections.find((section) => section.level === level && section.title.startsWith(prefix)) ?? null

  const dimensionSection = (abbreviation) =>
    sections.find(
      (section) =>
        section.level === 3 && new RegExp(`^${abbreviation}\\b`).test(stripMarkers(section.title)),
    ) ?? null

  // excluded records carry the §7 set as a table instead of level-3 sections
  const dimensionTableSection = sections.find(
    (section) => section.level === 2 && /^§7 dimensions/.test(section.title),
  )
  const dimensionTable = dimensionTableSection
    ? new Map(
        tableRows(dimensionTableSection.body).map((cells) => [
          stripMarkers(cells[0] ?? ""),
          { value: cells[1] ?? "", confidence: cells[2] ?? "", basis: cells[3] ?? "" },
        ]),
      )
    : null

  // Verbatim evidence for an abbreviation, from a level-3 section or the
  // excluded record's §7 table row.
  function dimensionEvidence(abbreviation) {
    const section = dimensionSection(abbreviation)
    if (section)
      return {
        text: `### ${section.title}\n\n${section.body}`,
        source: `${fileName} · ### ${section.title}`,
        section,
      }
    const row = dimensionTable?.get(abbreviation) ?? null
    if (row)
      return {
        text: row.basis,
        source: `${fileName} · ## §7 dimensions (Tabelle, Zeile ${abbreviation})`,
        section: null,
      }
    return { text: null, source: "json_fields_only", section: null }
  }

  const g0Section = sectionByTitleStart(2, "G0")
  const careSection = sections.find(
    (section) => section.level === 2 && /^`?care_direction`?/.test(section.title),
  )
  const focusSection = sectionByTitleStart(2, "Focus")
  const leanSection = sectionByTitleStart(2, "Lean matching profile")
  const cautionsSection = sectionByTitleStart(2, "German cautions")
  const demotedSection = sections.find(
    (section) => section.level === 2 && /^Demoted flags/.test(section.title),
  )
  const routingSection = sectionByTitleStart(2, "Review routing")

  const routingTable = routingSection ? tableRows(routingSection.body) : []
  let routingTriggers = routingTable.map((cells) => ({
    trigger: stripMarkers(cells[0] ?? ""),
    basis: cells[1] ?? "",
  }))

  // T14 (2026-09-10, §2.4.1 rule 7): slot 10 (Olaplex)'s claim_authority_gap
  // is resolved by the cross-market claim exception, but the verbatim v3
  // evidence markdown this table is read from (reference-key-v3/, frozen and
  // out of this key's write scope) still describes the pre-T14 state. Patched
  // here, the same way a reasoningShort or a cautions_de string is hand-
  // maintained for a ruling the frozen markdown predates — the JSON key
  // (reference-key-v4/reference-key.json) already carries the corrected
  // `review_routing.triggers` array; this keeps the display text consistent
  // with it. See leave-in-classification-standard.v0.4.md §21.3 (T14) and
  // reference-key-v4/transform-notes.md §14.
  if (slot === 10) {
    routingTriggers = routingTriggers.map((entry) =>
      entry.trigger === "claim_authority_gap"
        ? {
            trigger: "heat_claim_without_l9_member",
            basis:
              "T14 (§2.4.1 rule 7): the 450°F/232°C claim is now admitted at tier C2_cross_market_verified (identity verified against the frozen douglas.de INCI/GTIN; douglas.de (C3) corroborates). No L9 member in the formula, so the claim looks formula-unsupported (§13.3 rule 2).",
          }
        : entry,
    )
  }

  // T15 (2026-09-10, designed boundary archetype — round-3 report item 4):
  // slot 13 (Neqi)'s G0/HOLD boundary call is resolved — in_category,
  // hold_route_state incidental_film. The verbatim v3 evidence markdown this
  // table is read from (reference-key-v3/, frozen and out of this key's
  // write scope) still describes the pre-T15 provisional_boundary /
  // meaningful_hold_route state. Patched here on the same T14 precedent
  // above: the JSON key (reference-key-v4/reference-key.json) already
  // carries the corrected `review_routing.triggers` array (both triggers
  // removed, recorded in `review_routing.resolved_triggers` with dated
  // notes); this keeps the display text consistent with it. See
  // leave-in-classification-standard.v0.4.md §21.3 (T15) and
  // reference-key-v4/transform-notes.md §16.
  if (slot === 13) {
    routingTriggers = routingTriggers
      .filter(
        (entry) =>
          entry.trigger !== "provisional_boundary under §2.3.2 clause 2" &&
          entry.trigger !== "HOLD = meaningful_hold_route",
      )
      .concat([
        {
          trigger: "g0_boundary_resolved_t15",
          basis:
            "T15 (2026-09-10): Nick's adjudication of the designed boundary archetype resolves G0 in_category — HOLD reads incidental_film, so the styling-first test's architecture half is never established and the round-3 clause-2 conflict no longer exists.",
        },
        {
          trigger: "hold_incidental_film_t15",
          basis:
            "T15 (2026-09-10): hold_route_state moves meaningful_hold_route -> incidental_film — a genuine conditioning film (Silicone Quaternium-18 r11 + Polysilicone-29 r7) dominates a single supporting fixative-class polymer (VP/Methacrylamide/Vinyl Imidazole Copolymer r8), the standard's worked example for §2.3.2/§7.7.",
        },
      ])
  }

  // T16 (2026-09-11, §3.1.1's marker-plausibility condition): slot 9
  // (Redken)'s `candidate_below_tail` route is resolved — the marker itself
  // is ruled implausible (it sits before the product's own core conditioning
  // architecture), so it may not disqualify the below-marker silane, and R2
  // moves none_visible -> candidate. The verbatim v3 evidence markdown this
  // table is read from (reference-key-v3/, frozen and out of this key's
  // write scope) still describes the pre-T16 `candidate_below_tail` state.
  // Patched here on the same T14/T15 precedent above: the JSON key
  // (reference-key-v4/reference-key.json) already carries the corrected
  // `review_routing.triggers` array; this keeps the display text consistent
  // with it. See leave-in-classification-standard.v0.4.md §3.1.1, §10.3.2
  // and §21.3 (T16), and reference-key-v4/transform-notes.md §18.
  if (slot === 9) {
    routingTriggers = routingTriggers.map((entry) =>
      entry.trigger === "candidate_below_tail"
        ? {
            trigger: "tail_marker_implausible",
            basis:
              "T16 (2026-09-11, §3.1.1): the marker (Phenoxyethanol r3) sits before this product's own core conditioning architecture (Amodimethicone r4; LGN/cationic deposit r15-17), so it is implausible and may not disqualify the silane route (Hydrolyzed Vegetable Protein PG-Propyl Silanetriol, r14). R2 now takes `candidate` directly; the record still routes to human review, under the standing tail_marker_implausible note rather than the retired candidate_below_tail mechanism.",
          }
        : entry,
    )
  }

  // T17 (2026-09-11, hard-rule audit items H1/H2/H9): three more slots whose
  // frozen v3 evidence markdown (reference-key-v3/, out of this key's write
  // scope) describes a pre-T17 reading. Patched on the same T14/T15/T16
  // precedent above — the JSON key already carries the corrected
  // `review_routing.triggers` array; this keeps the display text consistent
  // with it. See leave-in-classification-standard.v0.4.md §3.1.1, §2.3.2,
  // §21.3 (T17) and reference-key-v4/transform-notes.md §20.
  if (slot === 4) {
    // H2: the allergen block is no longer marker-eligible; this record's
    // marker is now `none_visible`, not "the allergen block only".
    routingTriggers = routingTriggers.map((entry) =>
      entry.trigger === "Tail marker rests on the allergen block only"
        ? {
            trigger: "tail_marker_none_visible",
            basis:
              "T17/H2 (§3.1.1): the declared EU fragrance-allergen block is removed from the marker-eligible list. No other capped ingredient is declared on this formula, so the record now reads `tail_marker: none_visible` under mandatory limit 2 (ordinal read, confidence lowered one step on five dimensions, routed to review) instead of resting on the allergen block.",
          }
        : entry,
    )
  }
  if (slot === 6 || slot === 12) {
    // H1: the marker's own tail (everything at or below it) contains only
    // capped preservative, fragrance/allergen declarations or (on slot 12) a
    // colourant — nothing the architecture read would have placed there
    // anyway — so the marker is vacuous, not merely very late.
    routingTriggers = routingTriggers.map((entry) =>
      entry.trigger === "Very late tail marker"
        ? {
            trigger: "tail_marker_vacuous",
            basis:
              slot === 6
                ? "T17/H1 (§3.1.1 clause 6): everything at or below the marker (Potassium Sorbate r37, Sodium Benzoate r38, Hydroxycitronellal r39, Citronellol r40) is capped preservative or a declared EU allergen — the tail contains nothing the architecture read would have placed there anyway, so the marker is vacuous. Re-checked against every anchor: none rests solely on the vacuous marker's rank-prong credit, so no value moves."
                : "T17/H1 (§3.1.1 clause 6): everything at or below the marker (Potassium Sorbate, Fragrance/Parfum, four declared EU allergens, and the colourant Violet 2 CI 60725) is capped preservative, a fragrance/allergen declaration or a colourant — the marker is vacuous. Informational only: this record emits no lean profile and its `excluded_anhydrous` decision does not read the tail marker.",
          }
        : entry,
    )
  }

  // T17 (2026-09-11, hard-rule audit item H9): slot 13 (Neqi) gains a new
  // trigger with no frozen-markdown row to patch — `species_reading_conflict`
  // is genuinely new, not a rename of a pre-existing row, so it is appended
  // rather than mapped over an existing entry. See
  // leave-in-classification-standard.v0.4.md §2.3.2 (T17) and
  // reference-key-v4/transform-notes.md §20.
  if (slot === 13) {
    routingTriggers = routingTriggers.concat([
      {
        trigger: "species_reading_conflict",
        basis:
          "T17/H9 (§2.3.2): Silicone Quaternium-18 (r11) is T15's named substantive conditioning film for hold_route_state: incidental_film, while §7.10's rank prong independently keeps the same species, at the same rank, as candidate_below_tail for R2 (repair_surface_film: none_visible). Neither reading is overridden; the record routes to review so the divergence is visible.",
      },
    ])
  }

  function reviewNoteFor(...tokens) {
    const normalized = tokens.filter(Boolean).map((token) => token.toLowerCase())
    const aliases = normalized.flatMap((token) => BASIS_ALIASES[token] ?? [])
    const hits = routingTriggers.filter((entry) => {
      const trigger = entry.trigger.toLowerCase()
      const basis = entry.basis.toLowerCase()
      return (
        normalized.some(
          (token) => trigger.includes(token) || token.includes(trigger.replace(/\s+/g, "_")),
        ) || aliases.some((alias) => basis.includes(alias))
      )
    })
    return hits.length ? hits.map((hit) => `${hit.trigger}: ${hit.basis}`).join(" | ") : null
  }

  const properties = []
  const assignments = ADJUDICATION_ASSIGNMENTS[slot] ?? {}

  function profileValueAt(profilePath) {
    return profilePath
      .split(".")
      .reduce(
        (accumulator, segment) =>
          accumulator === null || accumulator === undefined ? undefined : accumulator[segment],
        product.profile,
      )
  }

  // --- G0 -------------------------------------------------------------------
  properties.push(
    makeProperty({
      productId,
      slot,
      path: "g0",
      group: "g0",
      label: "G0 — Produktform-Gate",
      rawValue: product.g0_state,
      evidenceScope: "product",
      rationale: g0Section ? `${g0Section.title}\n\n${g0Section.body}` : product.g0_rationale,
      rationaleSource: g0Section
        ? `${fileName} · ## ${g0Section.title}`
        : "reference-key.json · g0_rationale",
      observations: [
        `g0_rationale: ${product.g0_rationale}`,
        `out_of_category: ${product.out_of_category}`,
        `identity_status: ${product.identity_status}`,
      ],
      reviewNote: reviewNoteFor("g0", "boundary", "product-form", "product form"),
      adjudicationId: assignments.g0 ?? null,
    }),
  )

  // --- the seven §7 dimensions ------------------------------------------------
  for (const [dimensionKey, abbreviation] of Object.entries(DIMENSION_ABBREVIATIONS)) {
    const entry = product.dimensions[dimensionKey]
    if (!entry) throw new Error(`Missing dimension ${dimensionKey} on slot ${slot}`)
    const evidence = dimensionEvidence(abbreviation)
    let rationale = evidence.text
    let rationaleSource = evidence.source
    const extras = jsonExtras(entry)
    const observations = [
      ...extras.observations,
      ...(evidence.section ? bulletsWithMarker(evidence.section.body, "formula_observations") : []),
    ]
    const counterSignals = [
      ...extras.counterSignals,
      ...(evidence.section ? bulletsWithMarker(evidence.section.body, "counter_signals") : []),
    ]

    // T1: SLIP is not a row. Its verbatim evidence and its observation are
    // merged into COND, which is where the model now carries them.
    if (dimensionKey === "conditioning_potential") {
      const slipEvidence = dimensionEvidence("SLIP")
      if (slipEvidence.text)
        rationale =
          `${rationale ?? ""}\n\n— — — aufgenommene Slip-Beobachtung (T1, §7.2) — — —\n\n${slipEvidence.text}`.trim()
      rationaleSource = slipEvidence.text
        ? `${rationaleSource} + ${slipEvidence.source} (aufgenommen, T1)`
        : rationaleSource
      const absorbed = entry.absorbed_slip_observation
      if (absorbed) {
        observations.push(
          `absorbed_slip_observation.m1_contributors: ${absorbed.m1_contributors} (v0.3-SLIP-Wert: ${absorbed.v3_slip_value})`,
          `absorbed_slip_observation.bias: ${absorbed.bias}`,
          `absorbed_slip_observation.rule: ${absorbed.rule}`,
        )
        if (absorbed.note) observations.push(`absorbed_slip_observation.note: ${absorbed.note}`)
      }
    }

    // T7: a captured manufacturer hold level rides on the HOLD row.
    if (dimensionKey === "hold_route_state") {
      observations.push(
        `manufacturer_hold_level: ${entry.manufacturer_hold_level ?? "null — keine C1/C2-Halt-Angabe in den eingefrorenen Claims (T7, §7.7)"}`,
      )
    }

    const echoPath = ECHO_OF_DIMENSION[dimensionKey]
    const echoValue = echoPath && product.profile ? profileValueAt(echoPath) : undefined

    properties.push(
      makeProperty({
        productId,
        slot,
        path: `dimension.${dimensionKey}`,
        group: "dimension",
        label: `${abbreviation} — ${DIMENSION_LABELS[dimensionKey]}`,
        rawValue: entry.value,
        confidence: entry.confidence ?? null,
        evidenceLevel: entry.evidence_level ?? null,
        evidenceScope: entry.evidence_scope ?? null,
        informational: product.informational_and_non_authoritative === true,
        echo:
          echoValue === undefined
            ? null
            : { field: echoPath, value: displayValue(echoValue), label: "Profilwert" },
        rationale,
        rationaleSource,
        observations,
        counterSignals,
        derivedFrom: Array.isArray(entry.derived_from) ? entry.derived_from : [],
        reviewNote: reviewNoteFor(dimensionKey, abbreviation, String(entry.value ?? "")),
        adjudicationId: assignments[`dimension.${dimensionKey}`] ?? null,
      }),
    )
  }

  // --- T5: one Hinweise record ----------------------------------------------
  {
    const hinweise = product.hinweise
    const demotedProse = dimensionTableSection
      ? (
          /\*\*Demoted flags \(informational\)\.\*\*([\s\S]*?)(?:\n\n|$)/.exec(
            dimensionTableSection.body,
          )?.[1] ?? ""
        )
          .replace(/\s+/g, " ")
          .trim()
      : ""
    const rationale = demotedSection
      ? `## ${demotedSection.title}\n\n${demotedSection.body}`
      : demotedProse || null
    properties.push(
      makeProperty({
        productId,
        slot,
        path: "hinweise",
        group: "hinweise",
        label: "Hinweise (§8) — nur was ausgelöst hat",
        rawValue: hinweise.fired.length
          ? hinweise.fired.map((entry) => entry.flag)
          : "keine Hinweise ausgelöst",
        informational: true,
        rationale,
        rationaleSource: demotedSection
          ? `${fileName} · ## ${demotedSection.title}`
          : demotedProse
            ? `${fileName} · ## §7 dimensions · Demoted flags (informational)`
            : "json_fields_only",
        observations: [
          ...hinweise.fired.map(
            (entry) => `${entry.flag} = ${displayValue(entry.value)} — ${entry.note}`,
          ),
          `r3_state: ${hinweise.r3_state}${hinweise.r3_state === "none" ? " (löst nicht aus, §8.3)" : ""}`,
          ...(hinweise.r3_review_routing.length
            ? [`r3_review_routing: ${hinweise.r3_review_routing.join(" · ")}`]
            : []),
          `CURL: ${hinweise.curl_note}`,
          `SHN-Qualifier: ${hinweise.shn_qualifier ?? "nicht gesetzt"}`,
        ],
        derivedFrom: ["SHN", "CURL", "R3", "LAYER", "buildup", "transfer"],
        reviewNote: reviewNoteFor("bond_chemistry_candidate", "buildup", "transfer"),
        adjudicationId: assignments.hinweise ?? null,
      }),
    )
  }

  // --- care_direction -------------------------------------------------------
  {
    const careProse = dimensionTableSection
      ? (/\*\*`care_direction` \(informational\)[\s\S]*?(?=\n\n|$)/.exec(
          dimensionTableSection.body,
        )?.[0] ?? "")
      : ""
    const rationale = careSection
      ? `## ${careSection.title}\n\n${careSection.body}`
      : careProse || null
    const extras = jsonExtras(product.care_direction)
    properties.push(
      makeProperty({
        productId,
        slot,
        path: "care_direction",
        group: "care_direction",
        label: "Pflegerichtung (§9)",
        rawValue: product.care_direction.value,
        confidence: product.care_direction.confidence ?? null,
        evidenceLevel: product.care_direction.evidence_level ?? null,
        evidenceScope: product.care_direction.evidence_scope ?? null,
        informational: product.informational_and_non_authoritative === true,
        echo: product.profile
          ? {
              field: "care_direction",
              value: displayValue(product.profile.care_direction),
              label: "Profilwert",
            }
          : null,
        rationale,
        rationaleSource: careSection
          ? `${fileName} · ## ${careSection.title}`
          : careProse
            ? `${fileName} · ## §7 dimensions · care_direction (informational)`
            : "json_fields_only",
        observations: extras.observations,
        counterSignals: careSection ? bulletsWithMarker(careSection.body, "counter_signals") : [],
        reviewNote: reviewNoteFor("care_direction", "care direction"),
        adjudicationId: assignments.care_direction ?? null,
      }),
    )
  }

  // --- lean matching profile (reviewable members only, T8) -------------------
  const fitBullets = leanSection ? bulletsOf(leanSection.body) : []
  const fitBulletFor = (name) =>
    fitBullets.find((bullet) => stripMarkers(bullet).startsWith(name)) ?? null

  if (product.profile) {
    for (const [profilePath, label] of Object.entries(PROFILE_LABELS)) {
      const source = PROFILE_RATIONALE_SOURCE[profilePath]
      let rationale = null
      let rationaleSource = "json_fields_only"
      const observations = []
      if (source.kind === "dimension") {
        const evidence = dimensionEvidence(source.abbreviation)
        if (evidence.text) {
          rationale = evidence.text
          rationaleSource = `${evidence.source} (projiziert)`
        }
      } else if (source.kind === "focus" && focusSection) {
        rationale = `## ${focusSection.title}\n\n${focusSection.body}`
        rationaleSource = `${fileName} · ## ${focusSection.title}`
        // T2: the SFR evidence is attached to the focus row, as smoothing_route.
        const sfrEvidence = dimensionEvidence("SFR")
        if (sfrEvidence.text) {
          rationale = `${rationale}\n\n— — — smoothing_route-Evidenz (T2, §7.4) — — —\n\n${sfrEvidence.text}`
          rationaleSource = `${rationaleSource} + ${sfrEvidence.source} (angehängt, T2)`
        }
      } else if (source.kind === "fit") {
        const bullet = fitBulletFor(source.bullet)
        if (bullet) {
          rationale = bullet
          rationaleSource = `${fileName} · ## Lean matching profile · Fit derivations · ${source.bullet}`
        }
      } else if (source.kind === "identity") {
        // T10: product_form is read directly off identity, not a markdown
        // evidence section — build the rationale from the frozen packet.
        rationale = `Identität (E1, T10): „${packetEntry.exact_product_name}" (${packetEntry.pack_size}). Anwendung: „${packetEntry.directions_of_use}"`
        rationaleSource = "calibration-packet.json · exact_product_name + pack_size + directions_of_use (E1, T10)"
      }

      if (profilePath === "product_form") {
        const architecture = product.reading_conventions?.architecture
        if (architecture) {
          observations.push(
            `reading_conventions.architecture (§3.1.2, trace-only, T11): ${architecture.value}`,
            "product_form is not derived from the architecture read — it is captured directly at identity (§7.1, §3.1.2, §10.1, T10).",
          )
        }
      }
      if (profilePath === "repair_support_level") {
        observations.push(
          `Ableitung (§10.3.2): ${product.profile.repair_support_basis}`,
          `repair_surface_film: ${product.dimensions.repair_surface_film.value}`,
          `conditioning_level: ${product.profile.conditioning_level}`,
          `R3-Zustand: ${product.hinweise.r3_state} — für diese Regel unsichtbar (R14, G8)`,
        )
      }
      if (profilePath.startsWith("focus.")) {
        observations.push(
          `smoothing_route: ${product.smoothing_route.value} — ${product.smoothing_route.basis}`,
          `smoothing_route.rule: ${product.smoothing_route.rule}`,
        )
        if (product.profile.focus_basis)
          observations.push(`focus_basis: ${product.profile.focus_basis}`)
      }
      if (profilePath.startsWith("texture_fit.")) {
        const absorbed = product.dimensions.conditioning_potential.absorbed_slip_observation
        if (absorbed)
          observations.push(
            `Slip-Modifikator (T1): ${absorbed.m1_contributors} M1-Beitrag/Beiträge als Architektur — der Schwellenwert ist der v0.3-SLIP-Anker, ausgeschrieben`,
          )
      }

      properties.push(
        makeProperty({
          productId,
          slot,
          path: `profile.${profilePath}`,
          group: "profile",
          label,
          rawValue: profileValueAt(profilePath) ?? null,
          rationale,
          rationaleSource,
          observations,
          derivedFrom: PROFILE_DERIVED_FROM[profilePath] ?? [],
          reviewNote: reviewNoteFor(
            profilePath,
            profilePath.split(".").pop() ?? "",
            String(profileValueAt(profilePath) ?? ""),
          ),
          adjudicationId: assignments[`profile.${profilePath}`] ?? null,
        }),
      )
    }
  }

  const propertyFingerprints = Object.fromEntries(
    properties.map((property) => [
      property.path,
      fingerprint({
        path: property.path,
        value: property.value,
        rationale: property.rationale,
        observations: property.observations,
        counterSignals: property.counterSignals,
        derivedFrom: property.derivedFrom,
        echo: property.echo,
      }),
    ]),
  )

  products.push({
    productId,
    slot,
    batch: "gold-set",
    brand: product.brand,
    productName: product.product,
    archetypeRole: product.archetype_role,
    identity: {
      gtin: product.gtin ?? null,
      gtinCandidates: packetEntry.gtin_candidates ?? null,
      market: packetEntry.market,
      packSize: packetEntry.pack_size,
      identityStatus: product.identity_status,
      rawInci: packetEntry.raw_inci,
      normalizedIngredients: packetEntry.normalized_ingredients,
      directionsOfUse: packetEntry.directions_of_use,
      directionsStatus: packetEntry.directions_status,
      directionsSource: packetEntry.directions_source ?? null,
      // T12: application_stage is identity data, not a §7 dimension or a
      // profile row — it is rendered in the identity header next to
      // directionsOfUse, never as a reviewed property. null on the two
      // excluded records (slots 7, 12), which carry no `identity` block at
      // all in the reference key (§2.3.1).
      applicationStage: product.identity?.application_stage
        ? {
            value: product.identity.application_stage.value,
            evidenceLevel: product.identity.application_stage.evidence_level,
            evidenceScope: product.identity.application_stage.evidence_scope,
            sourceTier: product.identity.application_stage.source_tier,
            basis: product.identity.application_stage.basis.map((entry) => ({
              stage: entry.stage,
              quote: entry.quote,
            })),
            note: product.identity.application_stage.note ?? null,
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
      tailMarker: product.tail_marker ?? null,
      fingerprints: {
        rawInciSha256: packetEntry.rawInciSha256,
        formulaFingerprintSha256: packetEntry.formulaFingerprintSha256,
      },
    },
    g0: {
      state: product.g0_state,
      outOfCategory: product.out_of_category,
      rationale: product.g0_rationale,
      informationalOnly: product.informational_and_non_authoritative === true,
      profileNote: product.profile_note ?? null,
    },
    reviewRouting: {
      reviewStatus: product.review_routing.review_status,
      routed: product.review_routing.routed,
      triggers: product.review_routing.triggers,
      triggerBasis: routingTriggers,
    },
    uncertainFields: product.profile?.uncertain_fields ?? [],
    cautionsDe: product.profile?.cautions_de ?? [],
    properties,
    propertyFingerprints,
    productFingerprint: fingerprint(propertyFingerprints),
  })
}

// A summary left behind by a removed or renamed property would silently rot, so
// the build refuses to finish while REASONING_SHORT carries an unused key.
const staleReasoningShortKeys = Object.entries(REASONING_SHORT).flatMap(([productId, summaries]) =>
  Object.keys(summaries)
    .map((propertyPath) => `${productId}::${propertyPath}`)
    .filter((key) => !usedReasoningShortKeys.has(key)),
)
if (staleReasoningShortKeys.length)
  throw new Error(`Unused reasoningShort entries: ${staleReasoningShortKeys.join(", ")}`)

// -------------------------------------------------------- unseen-test batch --
//
// Batch 2: six unseen-product-test records (lane-a, the conservative-consensus
// lane), built by the sibling module from data/research/leave-in-inci/v1.0/
// corpus/unseen-test/ rather than from this gold set's markdown evidence
// chains. See
// build-unseen-products.mjs's own header for how it sources reasoningShort
// text. Pass an explicit empty string as the fourth CLI arg to skip this
// batch (gold-set-only regeneration).
const unseenAdjudications = []
if (UNSEEN_TEST_DIR) {
  const unseen = buildUnseenProducts(UNSEEN_TEST_DIR)
  products.push(...unseen.products)
  unseenAdjudications.push(...unseen.adjudications)
  console.log(`unseen-test products: ${unseen.products.length} (from ${UNSEEN_TEST_DIR})`)
}

const fixture = {
  schemaVersion: "leave-in-inci-lab-fixture-v2",
  keyVersion: key.key_version,
  derivedFromRun: key.derived_from_run,
  standardVersion: key.category_standard_version,
  modelVersion: key.model_version,
  packetVersion: packet.packet_version,
  generatedAt: key.generated_at,
  stopCondition: key.stop_condition,
  conventions: key.conventions,
  openAdjudications: [...Object.values(ADJUDICATIONS), ...unseenAdjudications],
  products,
}

mkdirSync(OUT_DIR, { recursive: true })
writeFileSync(path.join(OUT_DIR, "lab-fixture.json"), `${JSON.stringify(fixture, null, 2)}\n`)
copyFileSync(
  path.join(GOLD_SET, "calibration-packet.json"),
  path.join(OUT_DIR, "calibration-packet.json"),
)

const counts = products.map((product) => product.properties.length)
console.log(`products: ${products.length}`)
console.log(`properties per product: ${[...new Set(counts)].sort((a, b) => a - b).join(", ")}`)
console.log(`total properties: ${counts.reduce((a, b) => a + b, 0)}`)
console.log(`reasoningShort entries: ${usedReasoningShortKeys.size}`)
console.log(`rationale extraction gaps: ${gaps.length}`)
for (const gap of gaps) console.log(`  - ${gap}`)
