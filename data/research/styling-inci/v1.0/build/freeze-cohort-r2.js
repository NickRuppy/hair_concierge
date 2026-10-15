#!/usr/bin/env node
// Styling research engine - round-2 cohort freeze (standard v0.2, lexicon v0.2).
//   node data/research/styling-inci/v1.0/build/freeze-cohort-r2.js
// Rebuilds the 107 round-1 records by running build/freeze-cohort.js unchanged inside a sandbox whose
// file writes go to memory (the round-1 outputs on disk are compared byte-for-byte and never written),
// applies the round-4 re-capture patches (recapture-r4.json), freezes the 32 new products of
// round2-new-r4.json, and writes everything under v1.0/r2/ only: cohort.json, packets/{s0,fu,claims}/,
// artifact-manifest.json, FREEZE-NOTES.md. Deterministic: no clock, no randomness, sorted iteration.
// It never reads v1.0/sealed/ and never classifies (no route, subtype or hold level is assigned).
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const vm = require("vm");

const V1 = path.resolve(__dirname, "..");
const BASE = path.resolve(V1, "..");
const OUT = path.join(V1, "r2");
const R1_SCRIPT = path.join(__dirname, "freeze-cohort.js");
const FREEZE_DATE = "2026-10-12";
const COHORT_VERSION = "styling-inci-v1.0-cohort-2";
const STANDARD_VERSION = "styling-inci-v0.2";
const LEXICON_VERSION = "styling-lexicon-v0.2";
const ID_SALT = "styling-inci-v1.0-cohort-2/opaque-id/"; // new salt: no round-2 id may equal a round-1 id
const R4_NEW = "v1.0/capture/round2-new-r4.json";
const R4_RECAP = "v1.0/capture/recapture-r4.json";

// ---------------------------------------------------------------------------------------------
// Owner-visible switches and fixed decisions
// ---------------------------------------------------------------------------------------------
// RG-17 for Cantu: coordinator ruling 2026-10-12 - the C1 pack image is not verified as the current
// German-market unit and the record carries no GTIN, so the A2 release test is not met. Flip only on a new ruling.
const CANTU_RELEASE_A2 = false;
const ROUND2_UNSEEN = [
  "balea-overnight-wellenspray",
  "balea-haarwachs-styling-stick",
  "got2b-kleber-4-brows-and-edges-2in1-stylinggel",
  "wella-eimi-volume-dry-me",
  "syoss-glaze-glanz-und-schutz-primer",
  "redken-wax-spray",
  "moroccanoil-glaettende-creme-smoothing-lotion",
  "wella-eimi-glam-mist-shine-spray",
];
// standard 2.2 A5 / LI 2.4.1 rule 6: the only brands that may carry C2_house_brand
const HOUSE_A5_RE = /^(balea|alverde|ebelin|isana|alterra)/i;
// INCI notes for the new products, transcribed from the capture notes / capture_gaps (no lexicon work)
const R4_INCI_NOTES = {
  "john-frieda-frizz-ease-zauberformel-seiden-finish-creme": {
    flags: ["missing_spaces_as_printed: 'PerseaGratissima', 'IsostearylPalmitate', 'TetramethylAcetyloctahydronaphthalenes' (not repaired)", "possible_truncation_unconfirmed: capture note says the list 'may be cut at the end'; it ends in the fragrance block (non-blocking, review)"],
  },
  "john-frieda-frizz-ease-unendlich-smooth-blow-out-spray": { flags: ["duplicate_item_as_printed: 'Sclerocarya Birrea Seed Oil' appears twice", "typo_as_printed: 'Acetyloctahydronaaphthalene'"] },
  "wella-eimi-glam-mist-shine-spray": { flags: ["missing_spaces_as_printed: 'HexylCinnamal' (not repaired)"] },
  "neqi-diamond-glass-styling-spray-all": { flags: ["list_possibly_truncated: dm text field, 13 items, ends 'Propylene glycol, Glycerin' (capture gap; blocking)"] },
  "bali-curls-volumizing-curl-spray-refreshing": { repairs_by_capture: ["page typo 'LIMONE NE' corrected to 'LIMONENE' by the capture"] },
  "balea-overnight-wellenspray": { repairs_by_capture: ["page junk prefix 'INGREDIENTSSASTOJCI...' stripped and ' · ' separators converted by the capture"] },
  "balea-men-styling-powder": { repairs_by_capture: ["prefix 'Ingredients:' stripped by the capture"] },
  "balea-haarwachs-styling-stick": { repairs_by_capture: ["prefix 'INGREDIENTS:' stripped by the capture"] },
  "redken-wax-spray": { repairs_by_capture: ["' • ' separators converted to ', ' by the capture"] },
  "redken-root-tease": { repairs_by_capture: ["' • ' separators converted to ', ' by the capture"] },
  "redken-powder-grip-03": { repairs_by_capture: ["' • ' separators converted to ', ' by the capture"] },
  "redken-refreshing-curl-mist": { repairs_by_capture: ["' • ' separators converted to ', ' and article-code prefix stripped by the capture"] },
  "loreal-paris-elvital-big-hair-day-erfrischendes-volumenspray": { repairs_by_capture: ["'•' separators converted to ', ' by the capture"] },
};
const INCOMPLETE_FLAG_RE = /^(pack_list_truncated|possible_missing_separator|possible_split_item|stale_inci|list_possibly_truncated)/;

// ---------------------------------------------------------------------------------------------
// Round 1, rebuilt from its own inputs inside a sandbox (reuse, not duplication)
// ---------------------------------------------------------------------------------------------
const mem = new Map();
const sandboxFs = Object.assign({}, fs, {
  readFileSync: (p, enc) => {
    const k = path.resolve(String(p));
    if (mem.has(k)) return enc ? mem.get(k).toString(enc) : mem.get(k);
    return fs.readFileSync(p, enc);
  },
  writeFileSync: (p, d) => void mem.set(path.resolve(String(p)), Buffer.from(d)),
  rmSync: () => {},
  mkdirSync: () => {},
});
const ctx = vm.createContext({ require: (m) => (m === "fs" ? sandboxFs : require(m)), __dirname: path.dirname(R1_SCRIPT), __filename: R1_SCRIPT, console: { log: () => {} }, Buffer });
vm.runInContext(fs.readFileSync(R1_SCRIPT, "utf8"), ctx, { filename: R1_SCRIPT });
const R1 = (name) => vm.runInContext(name, ctx);
const round1Check = { files: 0, identical: 0, differing: [] };
for (const k of [...mem.keys()].sort()) {
  round1Check.files++;
  if (fs.existsSync(k) && fs.readFileSync(k).equals(mem.get(k))) round1Check.identical++;
  else round1Check.differing.push(path.relative(V1, k));
}
if (round1Check.differing.length) throw new Error("round-1 rebuild differs from round-1 outputs on disk: " + round1Check.differing.join(", "));
const normaliseInci = R1("normaliseInci");
const packetText = R1("packetText");
const maskDirections = R1("maskDirections");
const leakCheck = R1("leakCheck");
const redactHff = R1("redactHff");
const classifyHeat = R1("classifyHeat");
const looksEnglish = R1("looksEnglish");
const sourceClass = R1("sourceClass");
const hostOf = R1("hostOf");
const isC12 = R1("isC12");
const sha256 = R1("sha256");
const productTypeWord = R1("productTypeWord");
const dirBlock = R1("dirBlock");
const fieldList = R1("fieldList");
const HFF_RE = R1("HFF_RE");
const HOLD_NUMBER_RE = R1("HOLD_NUMBER_RE");
const FREEFROM_RE = R1("FREEFROM_RE");
const PROTECT_RE = R1("PROTECT_RE");
const TYPE_NOUNS = R1("TYPE_NOUNS");
// Round-2 additions to the round-1 F/U masking tables (product-line words of the new products that the
// generic brand/name masking misses; generic verb/problem words that are not name leakage)
const R2_EXTRA_MASK = {
  "syoss-glaze-topcoat": ["Glaze"],
  "syoss-glaze-glanz-und-schutz-primer": ["Glaze"],
  "moroccanoil-anti-frizz-schild-spray": ["Frizz Shield Spray", "Frizz Shield"],
  "moroccanoil-glaettende-creme-smoothing-lotion": ["Glättende Lotion"],
};
const R2_GENERIC_NAME = ["sprüh", "frizz"];
{
  const em = R1("EXTRA_MASK");
  for (const [k, v] of Object.entries(R2_EXTRA_MASK)) {
    if (em[k]) throw new Error("EXTRA_MASK already has " + k);
    em[k] = v;
  }
  const gn = R1("GENERIC_NAME");
  for (const w of R2_GENERIC_NAME) gn.add(w);
}
const R1_INPUTS = JSON.parse(JSON.stringify(R1("INPUT_FILES")));
const R1_EXCLUSIONS = JSON.parse(JSON.stringify(R1("exclusions")));
const r1Records = JSON.parse(JSON.stringify(R1("records")));
const R1_IDS = new Set(r1Records.map((r) => r.sample_id));
const R1_ID_BY_SLUG = Object.fromEntries(r1Records.map((r) => [r.source_slug, r.sample_id]));

const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(BASE, rel), "utf8"));
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const uniq = (a) => [...new Set(a)];
const clone = (o) => JSON.parse(JSON.stringify(o));
const newRecs = readJson(R4_NEW);
const recap = readJson(R4_RECAP);
const recapGet = (slug, issue, field) => {
  const e = recap.find((x) => x.slug === slug && x.issue_id === issue && x.field === field);
  if (!e) throw new Error("recapture-r4 entry missing: " + slug + " " + issue + " " + field);
  return e;
};
const srcHost = (s) => {
  const m = String(s || "").match(/https?:\/\/[^\s)]+/);
  if (m) return hostOf(m[0]);
  const h = hostOf(s);
  if (h) return h;
  const d = String(s || "").match(/\b((?:[a-z0-9-]+\.)+[a-z]{2,})\b/i);
  return d ? d[1].toLowerCase() : null;
};
const TIER_RANK = { C1: 0, C2: 1, C2_cross_market_verified: 2, C2_house_brand: 3, C3: 4, C4: 5, C5: 6 };
const blank = () => ({ number: null, scale_as_written: null, scale_max: null, scale_max_stated: null, words: null });
const mk = (o) => Object.assign({ type: null, raw: null, tier: null, source: null, date: null }, blank(), o);

const patchLog = []; // {id, slug, status, detail}
const logPatch = (id, slug, status, detail) => patchLog.push({ id, slug, status, detail });

// ---------------------------------------------------------------------------------------------
// P-6: editor annotations out of claim text (mechanical; every change is logged on the claim)
// ---------------------------------------------------------------------------------------------
const ANNOT_RE = /(\bno\b|\bkein\w*|\bnur\b|\bnot\b|\bsic\b|\braw\b|skala|\bscale\b|alt-text|footnote|collection|product line|brand line|product name|search|\bvia\b|certified|round-?\d|filter|draft|chip|dauer-|duration only|\balso\b|but see|vegane formeln|\bdm\b|dm-|\bdm\.|\bpack\b|pack-front|retailer|h(?:ä|ae)ndler|flaconi|douglas|rossmann|amazon|\ben\b|\bus\b|manufacturer|hersteller|\bfaq\b|\.(?:com|de|net|at)\b|codecheck|flie(?:ß|ss)text|merkmal|attribut|property|\bpill\b|\btag\b|reported|\btitle\b|infographic|listing|hero line|instrumental|keshop|nicebeauty|\bc[1-5]\b|lookfantastic|easycosmetic|\bweb\b|article|as printed)/i;
const SOURCE_ANNOT_RE = /(\bdm\b|dm-|\bpack\b|retailer|h(?:ä|ae)ndler|flaconi|douglas|rossmann|amazon|\ben\b|\bus\b|manufacturer|hersteller|\.(?:com|de|net|at)\b|codecheck|keshop|nicebeauty|lookfantastic|easycosmetic|\bweb\b|article)/i;
const ATTRIBUTE_ANNOT_RE = /(merkmal|attribut|property|\bpill\b|\btag\b|chip|filter)/i;
function cleanAnnot(s) {
  if (s == null) return { text: null, removed: [], label: null, sourceNotes: false, attribute: false };
  let t = String(s);
  const removed = [];
  let label = null;
  const raw = t.match(/\(raw:\s*'([^']+)'[^)]*\)/i);
  if (raw) {
    removed.push("editor summary '" + t.replace(raw[0], "").trim() + "' replaced by its raw quote");
    t = raw[1];
  }
  let sourceNotes = false;
  let attribute = false;
  for (;;) {
    let hit = false;
    t = t.replace(/\s*\(([^()]*)\)/g, (m, inner) => {
      if (!ANNOT_RE.test(inner)) return m;
      hit = true;
      removed.push("(" + inner + ")");
      if (SOURCE_ANNOT_RE.test(inner)) sourceNotes = true;
      if (ATTRIBUTE_ANNOT_RE.test(inner)) attribute = true;
      return "";
    });
    if (!hit) break;
  }
  if (!raw && !/;/.test(t)) {
    const lq = t.match(/^([A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß\/\- ]{0,38}?)\s*(?::|-\s*raw:)\s*'/);
    if (lq) {
      const quotes = [...t.matchAll(/'([^']+)'/g)].map((m) => m[1]);
      label = lq[1].trim();
      removed.push("editor label '" + label + "' removed; quoted text kept: " + t);
      t = quotes.join("; ");
    }
  }
  // segment pass: source labels at the start of a ';' segment are editor annotations (the text after them is kept
  // and the claim is marked mixed_source); pure editor commentary segments are removed
  const segs = t.split(/;\s+/);
  if (segs.length) {
    const out = [];
    for (let seg of segs) {
      const lab = seg.match(/^(Hersteller-Web|Text|text|Vorteil|infographic|Rossmann|pack front|pack|EN|US page|US|dm|Amazon\.de text|bali-care\.com|manufacturer|article|Tipp)\s*:?\s+(?=\S)/);
      if (lab && (/:\s*$/.test(lab[0]) || /^Vorteil/.test(lab[1]) || /^'/.test(seg.slice(lab[0].length)))) {
        removed.push("segment label '" + lab[1] + "'");
        sourceNotes = true;
        seg = seg.slice(lab[0].length);
      }
      if (/(drops the|numbers conflict|nennt keinen|product photo|not product-specific|not seen on|retailer text)/i.test(seg) && !/^'/.test(seg)) {
        const keep = seg.replace(/\s+-\s+the two numbers conflict\s*$/i, "");
        if (keep !== seg && keep.length) {
          removed.push("commentary ' - the two numbers conflict'");
          seg = keep;
        } else {
          removed.push("commentary segment '" + seg + "'");
          continue;
        }
      }
      const lqs = seg.match(/^([A-Za-z\u00c4\u00d6\u00dc\u00e4\u00f6\u00fc\u00df][A-Za-z0-9\u00c4\u00d6\u00dc\u00e4\u00f6\u00fc\u00df.\/\- ]{0,30}?)\s*:?\s*'([^']+)'$/);
      if (lqs) {
        removed.push("segment label '" + lqs[1] + "'");
        seg = "'" + lqs[2] + "'";
      }
      const q = seg.match(/^'([^']+)'$/);
      out.push(q ? q[1] : seg);
    }
    t = out.join("; ");
  }
  t = t.replace(/\s+/g, " ").replace(/\s+([;,.])/g, "$1").replace(/^[;,\s]+|[;,\s]+$/g, "").trim();
  if (!t.length || /^null\b/i.test(t)) return { text: null, removed: removed.concat(t.length ? ["null-claim text '" + t + "'"] : []), label, sourceNotes, attribute };
  return { text: t, removed, label, sourceNotes, attribute };
}
const EDITOR_STATEMENT_RE = /^(kein|keine|keinen|no|none|nur)\b/i;
function cleanClaims(rec, tag) {
  const kept = [];
  const dropped = [];
  let changed = 0;
  for (const c of rec.claims) {
    const r = cleanAnnot(c.raw);
    const w = cleanAnnot(c.words);
    const notes = [];
    if (r.removed.length) notes.push("raw: " + r.removed.join(" | "));
    if (w.removed.length) notes.push("words: " + w.removed.join(" | "));
    let words = w.text;
    if (words && words !== r.text && EDITOR_STATEMENT_RE.test(words)) {
      notes.push("words: editor statement '" + words + "' moved to note");
      words = null;
    }
    if (r.text == null && c.number == null && !c.display) {
      dropped.push({ type: c.type, tier: c.tier, raw_as_captured: c.raw, words_as_captured: c.words, reason: "P-6: empty or null claim text (absence statement or editor note), dropped" });
      changed++;
      continue;
    }
    if (notes.length) {
      changed++;
      c.capture_note = uniq([...(c.capture_note ? [c.capture_note] : []), ...notes]).join(" || ");
      c.raw_as_captured = c.raw;
      if (c.words !== words) c.words_as_captured = c.words;
    }
    c.raw = r.text;
    c.words = words;
    if (r.text && /[;\/]/.test(r.text) && (r.sourceNotes || w.sourceNotes)) c.mixed_source = true;
    if ((r.attribute || w.attribute) && !isC12(c.tier)) c.retailer_attribute = true;
    if (c.type === "hold" && c.absence_statement !== undefined) delete c.absence_statement;
    kept.push(c);
  }
  rec.claims = kept;
  if (dropped.length) rec.claim_capture.dropped_claims = (rec.claim_capture.dropped_claims || []).concat(dropped);
  return changed;
}

// ---------------------------------------------------------------------------------------------
// P-4: A5 house-brand stamp
// ---------------------------------------------------------------------------------------------
function applyA5(rec) {
  if (HOUSE_A5_RE.test(rec.identity.brand)) return 0;
  let n = 0;
  const re = (o, k, basisKey) => {
    if (o && o[k] === "C2_house_brand") {
      o[k] = "C3";
      if (basisKey) o[basisKey] = (o[basisKey] ? o[basisKey] + "; " : "") + "P-4: re-stamped C2_house_brand -> C3 (standard 2.2 A5: brand is not on the house-brand list)";
      n++;
    }
  };
  for (const c of rec.claims) re(c, "tier", "tier_basis");
  re(rec.identity.inci_source, "tier", "note");
  if (rec.identity.inci_source.tier === "C3" && rec.identity.inci_source.source_class === "own_brand_retailer_page") rec.identity.inci_source.source_class = "retailer_product_page";
  re(rec.directions, "tier", null);
  re(rec.claim_capture, "record_best_tier", "record_tier_basis");
  return n;
}

// ---------------------------------------------------------------------------------------------
// Round-1 records + re-capture patches
// ---------------------------------------------------------------------------------------------
const bySlug = {};
for (const r of r1Records) {
  r.history = r.history || {};
  r.history.round2 = { round1_sample_id: r.sample_id, round1_role: r.cohort_role, round1_standard_version: r.standard_version, round1_lexicon_version: r.lexicon_version };
  if (r.cohort_role === "unseen") {
    r.cohort_role = "calibration";
    r.history.round2.role_note = "round-1 unseen slot; becomes calibration in round 2";
  }
  r.reference_only_not_for_blind_lanes.origin = "round1_" + r.reference_only_not_for_blind_lanes.origin;
  bySlug[r.source_slug] = r;
}
const R = (slug) => {
  if (!bySlug[slug]) throw new Error("round-1 record missing: " + slug);
  return bySlug[slug];
};
const p6Counts = {};
for (const r of r1Records) {
  const n = cleanClaims(r, "round1");
  if (n) p6Counts[r.source_slug] = n;
}
const a5Counts = {};
for (const r of r1Records) {
  const n = applyA5(r);
  if (n) a5Counts[r.source_slug] = n;
}

// P-1 Balea Styling Spray Ultra Volumen
{
  const r = R("balea-styling-spray-ultra-volumen");
  const attr = recapGet(r.source_slug, "P-1", "dm_attribute_Halt");
  const pack = recapGet(r.source_slug, "P-1", "pack_front_claims_C1");
  const bullet = r.claims.find((c) => c.type === "hold" && /flexiblen und langanhaltenden Halt/.test(c.raw));
  if (bullet && bullet.words) {
    bullet.capture_note = (bullet.capture_note ? bullet.capture_note + " || " : "") + "P-1: words field held the dm attribute value; that value is now its own claim";
    bullet.words_as_captured = bullet.words_as_captured || bullet.words;
    bullet.words = null;
  }
  r.claims.push(mk({ type: "hold", raw: "Halt: " + attr.value_verbatim, words: attr.value_verbatim, tier: attr.tier, source: attr.source_url, date: attr.capture_date, attribute: "Halt", tier_basis: "recapture-r4 P-1: dm structured product attribute on the own-brand page (standard 2.2 A4, PH2-7)" }));
  r.claims.push(mk({ type: "promise", raw: pack.value_verbatim, tier: pack.tier, source: pack.source_url, date: pack.capture_date, tier_basis: "recapture-r4 P-1: pack front read from the dm-hosted photo (segments separated by ' | ' as captured)" }));
  r.claims.push(mk({ type: "hold", raw: "flexibler Halt", words: "flexibler Halt", tier: pack.tier, source: pack.source_url, date: pack.capture_date, tier_basis: "recapture-r4 P-1: pack-front line '· Anti-Frizz · flexibler Halt'" }));
  logPatch("P-1", r.source_slug, "applied", "dm attribute 'Halt: sehr starker Halt' added as C2_house_brand hold claim; pack front line added as C1 promise and 'flexibler Halt' as C1 hold claim; the bullet's words field no longer carries the attribute; 'Ultra' (qualifies Volumen) is no longer a name-derived hold claim (RG-13)");
}
// P-1 / RG-13 Balea Styling Creme Power Flex
{
  const r = R("balea-styling-creme-power-flex");
  const attr = recapGet(r.source_slug, "P-1", "dm_attribute_Halt");
  const disp = recapGet(r.source_slug, "P-1/RG-13", "pack_hold_display_C1");
  if (attr.value_verbatim != null) throw new Error("Power Flex dm attribute unexpectedly present");
  r.claim_capture.capture_facts = (r.claim_capture.capture_facts || []).concat(["recapture-r4 P-1 (2026-10-12): the dm Produktmerkmale block has no 'Halt' attribute"]);
  r.claims.push(mk({ type: "hold", raw: "1 2 3 4 5 6 7", number: 5, scale_as_written: "1 2 3 4 5 6 7", scale_max: 7, scale_max_stated: false, tier: disp.tier, source: disp.source_url, date: disp.capture_date, display: { marks: 7, labels_as_printed: "1 2 3 4 5 6 7", highlighted: [5], filled: [5], caption_as_printed: null, as_captured: disp.value_verbatim, value_kind: disp.value_kind || null }, tier_basis: "recapture-r4 P-1/RG-13: jar-lid hold display read from the dm-hosted pack photo; scale max = count of circles (no '5/7' printed)" }));
  logPatch("P-1", r.source_slug, "applied", "no dm 'Halt' attribute exists (recorded as capture fact, no claim); jar-lid 1-7 circle display added as C1 hold claim (number 5, scale max 7 not stated, labels '1 2 3 4 5 6 7'); 'Power' (qualifies Flex) is no longer a name-derived hold claim (RG-13)");
}
// P-2 / P-8 got2b SPRÜH KLEBER Freeze Haarlack
{
  const r = R("got2b-spruehkleber-freeze-haarlack");
  const name = recapGet(r.source_slug, "P-2", "full_pack_name_as_printed");
  const disp = recapGet(r.source_slug, "P-8", "pack_hold_display");
  r.identity.name_variants = uniq(r.identity.name_variants.concat(["dm title: Haarlack Sprühkleber, 300 ml"]));
  r.identity.product_name = "SPRÜH KLEBER Freeze Haarlack";
  r.identity.name_override = "recapture-r4 P-2: full pack name as printed ('got2b / SPRÜH KLEBER / Freeze Haarlack', C1 dm pack photo 2026-10-12)";
  r.identity.name_tier = { tier: name.tier, source: name.source_url, date: name.capture_date };
  const old = r.claims.find((c) => c.type === "hold" && c.tier === "C1");
  if (!old) throw new Error("got2b C1 hold missing");
  Object.assign(old, { raw: "krasser Halt", words: "krasser Halt", number: 6, scale_as_written: "1 2 3 4 5 6", scale_max: 6, scale_max_stated: false, source: disp.source_url, date: disp.capture_date, display: { marks: 6, labels_as_printed: "1 2 3 4 5 6", highlighted: [6], filled: [6], caption_as_printed: "krasser Halt", as_captured: disp.value_verbatim, value_kind: disp.value_kind || null }, tier_basis: "recapture-r4 P-8: chevron hold display re-read on the dm pack photo (legible); scale max = count of boxes" });
  logPatch("P-2", r.source_slug, "applied", "confirmed name = full pack name 'SPRÜH KLEBER Freeze Haarlack' (brand got2b), dm title kept as a name variant; 'KLEBER' and 'Freeze' become flexibility claims with from_product_name: true (C1)");
  logPatch("P-8", r.source_slug, "applied", "C1 hold display recorded as captured: 6 chevron boxes labelled 1-6, box 6 filled, caption 'krasser Halt' (number 6, scale max 6 not stated)");
}
// P-3 Elnett Stylingspray Hitzeschutz 3 Tage Glatt
{
  const r = R("loreal-paris-elnett-stylingspray-hitzeschutz-3-tage-glatt");
  const pack = recapGet(r.source_slug, "P-3", "pack_front_result_line");
  const dirs = recapGet(r.source_slug, "P-3", "directions_verbatim_real");
  r.history.round2.removed_directions = r.directions.text;
  r.directions = { text: null, directions_status: "missing", directions_verbatim: false, status_note: "recapture-r4 P-3: the captured dm Verwendungshinweise are the Elnett hairspray text (dm copy), not this product's directions; no real German directions found on any reachable source (" + dirs.capture_date + ")", tier: null, source: null, source_host: null, date: null, basis: "recapture-r4 P-3: missing", language_note: r.directions.language_note };
  r.claims.push(mk({ type: "promise", raw: pack.value_verbatim, tier: pack.tier, source: pack.source_url, date: pack.capture_date, tier_basis: "recapture-r4 P-3: pack front read from the single dm pack photo ('[...]' = framed box on the pack; segments separated by ' | ' as captured)" }));
  logPatch("P-3", r.source_slug, "applied", "hairspray directions removed (directions_status missing, old text under history.round2.removed_directions); C1 pack-front line added as a promise");
}
// P-5 Balea Finishing Spray Glow & Care + A7 duplicate check
{
  const r = R("balea-finishing-spray-glow-und-care");
  const packInci = recapGet(r.source_slug, "P-5", "inci_pack_back_C1");
  const dup = recapGet(r.source_slug, "P-5", "gtin_and_duplicate_check");
  const items = r.identity.inci_normalised;
  const i = items.findIndex((x) => /^Triheptanoin Camelina Stativa Seed Oil$/i.test(x.inci));
  if (i < 0) throw new Error("P-5 item not found");
  const fixed = [
    { inci: "Triheptanoin", as_written: "TRIHEPTANOIN" },
    { inci: "Camelina Sativa Seed Oil", as_written: "CAMELINA SATIVA SEED OIL" },
  ];
  items.splice(i, 1, ...fixed.map((f) => ({ rank: 0, inci: f.inci, as_written: f.as_written })));
  items.forEach((x, k) => (x.rank = k + 1));
  r.identity.inci_item_count = items.length;
  r.identity.transcription_repairs = uniq(r.identity.transcription_repairs.concat(["P-5: rank 6 of the dm text 'Triheptanoin Camelina Stativa Seed Oil' split into 'Triheptanoin', 'Camelina Sativa Seed Oil' as read on the C1 pack back (" + packInci.capture_date + ")"]));
  r.identity.inci_flags = uniq(r.identity.inci_flags.concat(["repaired_dm_missing_separator_and_typo_rank6_from_pack (P-5): dm text lacks the comma and reads 'Stativa'; Parfum and Linalool are not visible on the pack photo and come from the dm text"]));
  r.identity.duplicate_check = "A7 by GTIN: distinct unit from balea-professional-glow-und-shine-finishing-spray (GTIN 4067796069679 / DAN 3043007 vs 4070765016611 / DAN 3165375)";
  R("balea-professional-glow-und-shine-finishing-spray").identity.duplicate_check = "A7 by GTIN: distinct unit from balea-finishing-spray-glow-und-care (GTIN 4070765016611 / DAN 3165375 vs 4067796069679 / DAN 3043007)";
  r.history.round2.p5_sources = [packInci.source_url, dup.source_url];
  logPatch("P-5", r.source_slug, "applied", "INCI rank 6 split per the pack ('Triheptanoin', 'Camelina Sativa Seed Oil'), item count " + items.length + ", flag in identity.inci_flags; both Balea finishing sprays kept as distinct units (different GTIN and DAN)");
}
// P-7 Balea Professional Glow & Shine Finishing Spray
{
  const r = R("balea-professional-glow-und-shine-finishing-spray");
  const bullet = recapGet(r.source_slug, "P-7", "dm_bullet_verbatim");
  const pack = recapGet(r.source_slug, "P-7", "pack_claims_C1");
  const c = r.claims.find((x) => x.type === "promise" && x.raw === bullet.value_verbatim);
  if (!c) throw new Error("P-7 bullet missing");
  c.capture_note = "recapture-r4 P-7 (" + bullet.capture_date + "): literal dm bullet (bullet 3 of 5), not a capture slip; it contradicts the pack badge 'ANTI-FRIZZ-EFFEKT'";
  r.claims.push(mk({ type: "promise", raw: "ANTI-FRIZZ-EFFEKT", tier: pack.tier, source: pack.source_url, date: pack.capture_date, capture_note: "pack front badge, left edge partly cut on the photo ('TI-FRIZZ-EFFEKT')", tier_basis: "recapture-r4 P-7: pack front read from the dm-hosted photo" }));
  logPatch("P-7", r.source_slug, "applied", "dm bullet 'Wirkt einem Anti-Frizz-Effekt entgegen' kept as captured (C2_house_brand, note added); pack badge 'ANTI-FRIZZ-EFFEKT' added as C1 promise (the other pack lines in recapture-r4 were not added: not in the brief)");
}
// P-8 / RG-19 Taft Styling Paste Forming Halt 5+
{
  const r = R("taft-styling-paste-forming-halt-5plus");
  const disp = recapGet(r.source_slug, "P-8", "pack_hold_display");
  const old = r.claims.find((c) => c.type === "hold" && c.tier === "C1");
  if (!old) throw new Error("Taft paste C1 hold missing");
  Object.assign(old, { raw: "5+", words: null, number: 5, scale_as_written: "5+", scale_max: null, scale_max_stated: false, source: disp.source_url, date: disp.capture_date, display: { marks: 5, labels_as_printed: "5+ (only the fifth, larger circle is numbered)", highlighted: [5], filled: [1, 2, 3, 4], caption_as_printed: null, as_captured: disp.value_verbatim, value_kind: disp.value_kind || null }, tier_basis: "recapture-r4 P-8: pot-front display re-read (4 filled dots + larger circle containing '5+'); no maximum and no hold word printed" });
  logPatch("P-8", r.source_slug, "applied", "C1 hold display recorded as captured: 4 filled dots plus a larger circle containing '5+' (5 positions; number 5 as written '5+', no maximum printed) - resolves the RG-19 '5+ beside 4 dots' reading");
}
// RG-17 Bali Curls Leave-in Spray (A2 release test) and Cantu (not released)
function a2ReleaseTest(r, cap) {
  const gtinOnPack = (String(cap.note).match(/GTIN (\d{12,14})/) || [])[1] || null;
  const packList = normaliseInci(cap.value_verbatim).items.map((x) => x.inci.toLowerCase());
  const curList = r.identity.inci_normalised.map((x) => x.inci.toLowerCase());
  const datesOk = cap.capture_date > (r.identity.inci_source.date || "") ;
  const res = {
    pack_tier_c1: cap.tier === "C1",
    record_gtin: r.identity.gtin,
    gtin_on_pack: gtinOnPack,
    gtin_match: !!(r.identity.gtin && gtinOnPack && gtinOnPack.replace(/^0+/, "") === String(r.identity.gtin).replace(/^0+/, "")),
    pack_capture_date: cap.capture_date,
    newer_than_current_list: datesOk,
    current_list_date: r.identity.inci_source.date,
    alt_list_date: null,
    pack_list_identical_to_current: JSON.stringify(packList) === JSON.stringify(curList),
  };
  res.passes = res.pack_tier_c1 && res.gtin_match && res.newer_than_current_list;
  return res;
}
{
  const r = R("bali-curls-leave-in-spray-curl-defining");
  const cap = recapGet(r.source_slug, "RG-17", "pack_inci_C1_dated");
  const t = a2ReleaseTest(r, cap);
  if (!t.passes) throw new Error("Bali A2 release test failed: " + JSON.stringify(t));
  if (!t.pack_list_identical_to_current) {
    const ni = normaliseInci(cap.value_verbatim);
    r.identity.inci_normalised = ni.items;
    r.identity.inci_item_count = ni.items.length;
    r.identity.inci_raw = cap.value_verbatim;
  }
  r.identity.identity_status = "verified_with_minor_source_difference";
  r.identity.review_flags = ["formula_or_identity_conflict"];
  r.identity.a2_release_test = t;
  r.identity.inci_source = { tier: "C1", source_class: "pack", url: cap.source_url, date: cap.capture_date, date_note: null, note: "recapture-r4 RG-17: dated C1 pack back with printed GTIN " + t.gtin_on_pack + " = record GTIN; identical to bali-care.com/de-de (C2); dm.de text field still shows the old list" };
  r.identity.inci_alt.status = "demoted_capture (A2 release test passed)";
  logPatch("RG-17", r.source_slug, "applied", "A2 release test passed (C1 pack, printed GTIN = record GTIN, capture " + t.pack_capture_date + " newer than the " + t.current_list_date + " list, list " + (t.pack_list_identical_to_current ? "identical to" : "replaces") + " the current list): identity_status verified_with_minor_source_difference, review formula_or_identity_conflict; old dm list kept as demoted inci_alt");
}
{
  const r = R("cantu-shea-butter-extra-hold-edge-stay-gel");
  const cap = recapGet(r.source_slug, "RG-17", "pack_inci_C1_dated");
  const dirs = recapGet(r.source_slug, "RG-17", "directions_verbatim_pack");
  const t = a2ReleaseTest(r, cap);
  t.gtin_on_pack = "817513015694 (UPC-A, read at moderate resolution)";
  t.passes = CANTU_RELEASE_A2 && t.passes;
  t.ruling = "coordinator 2026-10-12: do not release; the C1 pack image (Amazon.de gallery, listing not re-opened) is not verified as the current German-market unit; the record has no GTIN to match";
  r.identity.a2_release_test = t;
  r.identity.inci_flags = uniq(r.identity.inci_flags.concat(["non_german_wording: the only pack (INCI panel and directions) is the English US-style pack with EU RP"]));
  r.directions.status_note = r.directions.status_note + " | recapture-r4 RG-17 (" + dirs.capture_date + "): the pack carries English directions only; no German directions found";
  r.directions.non_german_text = dirs.value_verbatim;
  logPatch("RG-17", r.source_slug, "not_applied", "A2 release NOT applied (coordinator ruling: pack image not verified as the current German-market unit; record GTIN null, pack UPC 817513015694 read at moderate resolution); identity_status stays inci_conflict; flag non_german_wording added; directions stay missing (English pack text kept in cohort.json only)");
}
// RG-20 Balea Styling Finishing Stick directions; Redken Beach Spray unchanged
{
  const r = R("balea-styling-finishing-stick");
  const d = recapGet(r.source_slug, "RG-20", "directions_verbatim_pack");
  const text = String(d.value_verbatim).replace(/^ANWENDUNG:\s*/, "");
  if (text !== "Nach dem Frisurenstyling sanft über die abstehenden Härchen streichen.") throw new Error("RG-20 text drift");
  r.history.round2.round1_directions_status_note = r.directions.status_note;
  r.directions = { text, directions_status: "verbatim", directions_verbatim: true, status_note: "recapture-r4 RG-20: pack back (carton) ANWENDUNG, heading 'ANWENDUNG:' dropped; dm Verwendungshinweise say 'keine vorhanden' (dm gap, not a pack gap)", tier: d.tier, source: d.source_url, source_host: srcHost(d.source_url), date: d.capture_date, basis: "recapture-r4 RG-20 directions_verbatim_pack", language_note: r.directions.language_note };
  logPatch("RG-20", r.source_slug, "applied", "C1 pack directions 'Nach dem Frisurenstyling sanft über die abstehenden Härchen streichen.' added (directions_status verbatim, tier C1)");
  const rb = R("redken-styling-beach-spray");
  const n = recapGet(rb.source_slug, "RG-20", "german_pack_text_C1");
  rb.claim_capture.capture_facts = (rb.claim_capture.capture_facts || []).concat(["recapture-r4 RG-20 (" + n.capture_date + "): no German pack text found (only an English/French pack photo; not listed at dm; not on redken.eu/de-de)"]);
  logPatch("RG-20", rb.source_slug, "not_applied", "no German pack text exists in any reachable source; record unchanged (capture fact noted)");
}
// OPEN-5 Taft Styling Balm Locken: HALT 3 on the pack (C1), dm attribute (C3 trace)
{
  const r = R("schwarzkopf-taft-styling-balm-locken-halt-3");
  const disp = recapGet(r.source_slug, "OPEN-5", "pack_hold_display_C1");
  const dmUrl = (String(disp.source_url).match(/https?:\/\/\S+/) || [null])[0];
  r.claims.push(mk({ type: "hold", raw: "HALT 3", number: 3, scale_as_written: "HALT 3", scale_max: null, scale_max_stated: false, tier: disp.tier, source: disp.source_url, date: disp.capture_date, display: { marks: 5, labels_as_printed: "3 (only the middle, larger circle is numbered)", highlighted: [3], filled: [3, 4, 5], caption_as_printed: "HALT 3", as_captured: disp.value_verbatim, value_kind: disp.value_kind || null }, tier_basis: "recapture-r4 OPEN-5: 'STYLING BALM / HALT 3' printed on the pack front beside a 5-mark column (C1, dm pack photo)" }));
  r.claims.push(mk({ type: "hold", raw: "Halt: mittlerer Halt", words: "mittlerer Halt", tier: "C3", source: dmUrl, date: disp.capture_date, attribute: "Halt", retailer_attribute: true, tier_basis: "recapture-r4 OPEN-5: dm attribute on a third-party product = C3 trace (standard 2.2 A4); never assigns" }));
  logPatch("OPEN-5", r.source_slug, "applied", "'HALT 3' added as C1 hold claim (number 3, 5-mark column, no maximum printed); dm attribute 'mittlerer Halt' added as a C3 retailer-attribute trace");
}
logPatch("P-4", "(all records)", "applied", "C2_house_brand kept only for Balea, alverde, ebelin (dm) and Isana, Alterra (Rossmann); re-stamped to C3 elsewhere: " + (Object.keys(a5Counts).map((s) => s + " (" + a5Counts[s] + " fields)").join(", ") || "none"));
logPatch("RG-19", "got2b-spruehkleber-freeze-haarlack, taft-styling-paste-forming-halt-5plus", "applied", "both pack displays re-read and recorded as captured (see P-8); no illegible number remains in the claims");

// ---------------------------------------------------------------------------------------------
// The 32 new products (round2-new-r4.json)
// ---------------------------------------------------------------------------------------------
const nq = (s) => String(s || "").toLowerCase().replace(/[„“”"'‚‘’]/g, "").replace(/^\s*[•·]\s*/, "").replace(/\s+/g, " ").replace(/[\s.*!]+$/g, "").trim();
function buildNew(raw) {
  const slug = raw.sample_id;
  const house = HOUSE_A5_RE.test(raw.brand);
  const a5 = (t) => (t === "C2_house_brand" && !house ? "C3" : t);
  const capDate = raw.capture_date;
  // identity
  const variants = [];
  const name = String(raw.product_name)
    .replace(/\s*\(((?:dm:|URL\/directions:)[^)]*)\)/g, (m, inner) => (variants.push(inner.trim()), ""))
    .replace(/\s+/g, " ")
    .trim();
  let inciText = String(raw.inci);
  const repairs = [];
  inciText = inciText.replace(/\s*\(F\.I\.L\.[^)]*\)\s*$/, (m) => (repairs.push("trailing page code '" + m.trim() + "' removed"), ""));
  inciText = inciText.replace(/(\.)\s*[A-Z&]{2,}\d{2,}\s*$/, (m, dot) => (repairs.push("trailing batch code '" + m.slice(1).trim() + "' removed"), dot));
  const ni = normaliseInci(inciText);
  const note = R4_INCI_NOTES[slug] || {};
  const identity = {
    brand: raw.brand,
    product_name: name,
    product_name_as_captured: raw.product_name,
    name_override: null,
    name_variants: variants,
    gtin: raw.ean || null,
    dm_dan: raw.dm_dan != null ? raw.dm_dan : null,
    size: raw.size || null,
    format: raw.format,
    market_tier: raw.market_tier || null,
    identity_status: "as_captured",
    inci_raw: String(raw.inci).replace(/\s+/g, " ").trim(),
    inci_normalised: ni.items,
    inci_item_count: ni.items.length,
    inci_source: { tier: a5(raw.inci_source_evidence_tier), source_class: raw.inci_source_tier, url: raw.inci_source_url, date: capDate, date_note: null, note: null },
    transcription_repairs: uniq(repairs.concat(ni.repairs, note.repairs_by_capture || [])),
    inci_flags: (note.flags || []).slice(),
    inci_alt: null,
  };
  if (slug === "john-frieda-volume-lift-ansatz-booster") {
    const m = String(raw.notes).match(/dm\.de \(C3, DAN (\d+), GTIN (\d+)\) = "([^"]+)"/);
    if (!m) throw new Error("JF volume lift dm list not found in notes");
    const altNi = normaliseInci(m[3]);
    identity.inci_alt = { raw: m[3], inci_normalised: altNi.items, repairs: altNi.repairs, source: "dm.de text field (C3, DAN " + m[1] + ", GTIN " + m[2] + ")" };
    identity.identity_status = "inci_conflict";
    identity.inci_source.note = "manufacturer page list (C2, no GTIN on the page) vs dm.de list (C3, GTIN " + m[2] + "); pack not read (capture gap)";
  }
  // directions
  const dText = raw.directions_verbatim || null;
  const directions = dText
    ? { text: dText, directions_status: "verbatim", directions_verbatim: true, status_note: "verbatim capture in round2-new-r4 (" + srcHost(raw.directions_source_url) + ")" + (slug === "osis-flatliner" ? "; capture gap: the page has no primary directions, only this secondary-use line" : ""), tier: a5(raw.directions_tier), source: raw.directions_source_url, source_host: srcHost(raw.directions_source_url), date: capDate, basis: "round2-new-r4 directions_verbatim", language_note: "paraphrase texts are shipped as captured and are never labelled verbatim" }
    : { text: null, directions_status: "missing", directions_verbatim: false, status_note: "no directions captured", tier: null, source: null, source_host: null, date: null, basis: "round2-new-r4", language_note: "paraphrase texts are shipped as captured and are never labelled verbatim" };
  // claims
  const lines = raw.promise_lines.map((p) => ({ raw: p.raw, tier: a5(p.tier), source: p.source, date: p.date || capDate, source_class: p.source_class || null }));
  const findLine = (t) => {
    const k = nq(t);
    if (!k) return null;
    const hits = lines.filter((l) => nq(l.raw).includes(k)).sort((a, b) => TIER_RANK[a.tier] - TIER_RANK[b.tier]);
    if (hits.length) return { kind: "line", line: hits[0] };
    if (dText && nq(dText).includes(k)) return { kind: "directions" };
    if ((raw.claims_verbatim || []).some((c) => nq(c).includes(k))) return { kind: "claims_verbatim" };
    return null;
  };
  const claims = [];
  const editorSummaries = [];
  const dropped = [];
  const holdRawKey = raw.hold_claim && raw.hold_claim.raw ? nq(raw.hold_claim.raw) : null;
  for (const l of lines) {
    const c = cleanAnnot(l.raw);
    if (c.text == null) continue;
    if (/^GTIN:\s*\d+$/.test(c.text)) {
      dropped.push({ type: "identity", raw_as_captured: l.raw, reason: "GTIN line is identity data, not a claim (GTIN kept in identity.gtin)" });
      continue;
    }
    let type = "promise";
    if (/^Halt:\s/.test(c.text)) type = "hold";
    else if (FREEFROM_RE.test(c.text)) type = "free_from";
    if (type === "hold" && holdRawKey && nq(c.text) === holdRawKey) continue; // same as hold_claim (added below)
    const o = mk({ type, raw: c.text, tier: l.tier, source: l.source, date: l.date, tier_basis: "round2-new-r4 promise_lines tier" + (l.tier !== raw.promise_lines.find((p) => p.raw === l.raw).tier ? " (P-4 A5 re-stamp to C3)" : "") });
    if (l.source_class) o.source_class_override = l.source_class;
    if (type === "hold") {
      o.words = c.text.replace(/^Halt:\s*/, "");
      o.attribute = "Halt";
      if (!isC12(o.tier)) o.retailer_attribute = true;
    }
    if (c.removed.length) o.capture_note = c.removed.join(" | ");
    claims.push(o);
  }
  const h = raw.hold_claim || {};
  if (h.raw) {
    const c = cleanAnnot(h.raw);
    const w = cleanAnnot(h.words);
    let tier;
    let basis;
    let src = h.source || null;
    let extra = {};
    if (h.tier) {
      tier = a5(h.tier);
      basis = "hold_claim per-claim tier in round2-new-r4" + (h.note ? " (" + h.note + ")" : "");
    } else if (/^Halt:\s/.test(c.text)) {
      tier = house ? "C2_house_brand" : "C3";
      basis = "dm structured attribute 'Halt' (standard 2.2 A4: house brand ⇒ C2_house_brand, else C3 trace)";
      extra = { attribute: "Halt" };
    } else {
      const f = findLine(c.text);
      if (f && f.kind === "line") {
        tier = f.line.tier;
        src = src || f.line.source;
        basis = "hold wording found verbatim in a captured promise line; takes that line's tier";
      } else if (f && f.kind === "directions") {
        tier = directions.tier;
        src = src || directions.source;
        basis = "hold wording found verbatim in the directions text; takes the directions tier";
      } else {
        tier = a5(raw.claim_tier);
        basis = "hold field, not found verbatim in captured lines; record claim_tier";
      }
    }
    if (h.source_class === "retailer_attribute" || (extra.attribute && !isC12(tier))) extra.retailer_attribute = true;
    if (/^Halt:\s/.test(c.text)) extra.attribute = "Halt";
    claims.push(mk(Object.assign({ type: "hold", raw: c.text, words: w.text, number: h.number != null ? h.number : null, scale_as_written: h.number != null ? c.text : null, scale_max: h.scale_max != null ? h.scale_max : null, scale_max_stated: h.scale_max != null, tier, source: src || raw.inci_source_url, date: h.date || capDate, tier_basis: basis }, extra, c.removed.length || w.removed.length ? { capture_note: c.removed.concat(w.removed).join(" | ") } : {})));
  } else if (h.none_stated) {
    dropped.push({ type: "hold", raw_as_captured: null, reason: "P-6: capture states no hold claim (none_stated); no claim recorded" });
  }
  const typed = [
    ["finish", raw.finish_claim],
    ["humidity", raw.humidity_claim],
    ["duration", raw.duration_claim],
    ["heat", raw.heat_claim],
  ];
  for (const [kind, val] of typed) {
    if (val == null || val === "") continue;
    for (const part0 of String(val).split(/;\s*(?=pack\s*:)/i)) {
      const part = part0.replace(/^pack\s*:\s*/i, "");
      const c = cleanAnnot(part);
      if (c.text == null) continue;
      const f = findLine(c.text);
      const type = kind === "heat" ? classifyHeat(c.text) : kind;
      if (f && f.kind === "line") {
        claims.push(mk({ type, raw: c.text, tier: f.line.tier, source: f.line.source, date: f.line.date, tier_basis: kind + " field found verbatim in a captured promise line; takes that line's tier", ...(c.removed.length ? { capture_note: c.removed.join(" | ") } : {}) }));
        continue;
      }
      if (f && f.kind === "directions") {
        claims.push(mk({ type, raw: c.text, tier: directions.tier, source: directions.source, date: directions.date, tier_basis: kind + " field found verbatim in the directions text; takes the directions tier" }));
        continue;
      }
      if (kind === "heat") {
        let derived = null;
        for (const l of lines.filter((x) => isC12(x.tier)).sort((a, b) => TIER_RANK[a.tier] - TIER_RANK[b.tier])) {
          const s = String(l.raw).split(/(?<=[.!?])\s+/).find((x) => PROTECT_RE.test(x));
          if (s) {
            derived = { text: s.trim(), line: l };
            break;
          }
        }
        if (derived) {
          claims.push(mk({ type: classifyHeat(derived.text), raw: derived.text, tier: derived.line.tier, source: derived.line.source, date: derived.line.date, tier_basis: "heat field was an editor summary ('" + part + "'); the claim is the first C1/C2 captured sentence with heat-protection wording", capture_note: "derived from promise line" }));
          continue;
        }
      }
      editorSummaries.push({ type: kind, text: part, reason: "not found verbatim in any captured line or the directions; editor summary, not claim text (P-6)" });
    }
  }
  const tierFromHint = (removed) => (removed.some((x) => /\bpack\b/i.test(x)) ? "C1" : null);
  for (const [type, arr] of [["hair_type", raw.hair_type_claims || []], ["free_from", raw.free_from_claims || []]]) {
    for (const t of arr) {
      const c = cleanAnnot(t);
      if (c.text == null) continue;
      if (claims.some((x) => x.type === type && nq(x.raw) === nq(c.text))) continue;
      const f = findLine(c.text);
      const hint = tierFromHint(c.removed);
      const isAttr = c.attribute || /^Haartyp:/i.test(c.text);
      const tier = f && f.kind === "line" ? f.line.tier : hint || (isAttr ? (house ? "C2_house_brand" : "C3") : a5(raw.claim_tier));
      claims.push(mk({ type, raw: c.text, tier, source: f && f.kind === "line" ? f.line.source : raw.inci_source_url, date: capDate, tier_basis: f && f.kind === "line" ? "found in a captured line" : hint ? "annotation names the pack" : isAttr ? "retailer attribute (A4)" : "record claim_tier", ...(c.removed.length ? { capture_note: c.removed.join(" | ") } : {}) }));
    }
  }
  for (const c of claims) if (c.tier === "C1" && looksEnglish(c.raw)) c.flags = uniq((c.flags || []).concat("non_german_wording"));
  const typeOrder = ["promise", "hold", "flexibility", "finish", "duration", "humidity", "heat_protection", "heat_activation", "cast", "other", "hair_type", "free_from"];
  claims.sort((a, b) => typeOrder.indexOf(a.type) - typeOrder.indexOf(b.type));
  return {
    sample_id: null,
    source_slug: slug,
    standard_version: STANDARD_VERSION,
    lexicon_version: LEXICON_VERSION,
    cohort_role: ROUND2_UNSEEN.includes(slug) ? "unseen" : "calibration",
    identity,
    directions,
    claims,
    capture_flags: [],
    claim_capture: {
      refreshed_by: "round2-new-r4",
      record_best_tier: a5(raw.claim_tier),
      record_tier_basis: "round2-new-r4 claim_tier" + (a5(raw.claim_tier) !== raw.claim_tier ? " (P-4 A5 re-stamp)" : ""),
      round1_old_tier: null,
      tier_note: null,
      conflicts_with_round1: null,
      editor_summaries: editorSummaries,
      dropped_claims: dropped,
      claims_verbatim_as_captured: raw.claims_verbatim || [],
      capture_gaps: raw.capture_gaps || [],
    },
    market: { retailers_seen: raw.retailers_seen || [], price_eur: raw.price_eur != null ? raw.price_eur : null, price_source_url: raw.price_source_url || null },
    reference_only_not_for_blind_lanes: {
      draft_subtype: raw.subtype_candidate,
      legacy_route: null,
      round: 4,
      origin: "round2_new",
      boundary_probe: !!raw.boundary_probe,
      capture_application_moment: raw.application_moment || null,
      capture_formula_observations: raw.formula_observations || null,
      capture_notes: raw.notes || null,
      capture_passes_three_evidence_items: raw.passes_three_evidence_items,
    },
    history: {},
  };
}
const newBuilt = newRecs.map(buildNew);
for (const r of newBuilt) {
  const n = cleanClaims(r, "new");
  if (n) p6Counts[r.source_slug] = (p6Counts[r.source_slug] || 0) + n;
}
logPatch("P-6", "(all records)", "applied", "editor annotations moved out of claim raw/words into capture_note on " + Object.keys(p6Counts).length + " records (" + Object.values(p6Counts).reduce((a, b) => a + b, 0) + " claim edits incl. dropped empty/null claims); new-product typed fields not found verbatim were kept as editor_summaries, not claims");

// ---------------------------------------------------------------------------------------------
// Name-derived claims (standard 2.2 A3, 6.9, 7.4; RG-13, P-2)
// ---------------------------------------------------------------------------------------------
const STRENGTH_TOK = /^(leicht\w*|sanft\w*|soft|weich\w*|mittel\w*|normal\w*|stark\w*|st(?:ä|ae)rk\w*|sehr|extra\w*|ultra\w*|mega|extrem\w*|maximal\w*|max|power|strong|firm)$/i;
const HOLD_TOK = /^(halt|hold)$/i;
const NUM_TOK = /^\d+\+?$/;
const PRODUCT_NOUNS = TYPE_NOUNS.concat(["haarlack", "lack", "pumpspray", "haargel", "wachs"]);
const isProductNoun = (t) => PRODUCT_NOUNS.some((n) => t.toLowerCase() === n || t.toLowerCase().endsWith(n));
const FLEX_TOK = (t) => /^(flex|beweglich|elastisch|formbar|nachstylbar|variabel|freeze|betonhart|steif)/i.test(t) || /kleber/i.test(t);
const NAME_TIER = { "got2b-spruehkleber-freeze-haarlack": { tier: "C1", basis: "recapture-r4 P-2: full pack name read from the dm pack photo" } };
const nameTable = [];
function addNameClaims(rec) {
  const toks = rec.identity.product_name.replace(/\([^)]*\)/g, " ").split(/[\s\/,]+/).filter(Boolean);
  const nt = NAME_TIER[rec.source_slug] || { tier: rec.claim_capture.record_best_tier, basis: "name tier = record best tier (name confirmation not captured separately)" };
  const out = [];
  const used = new Set();
  for (let i = 0; i < toks.length; i++) {
    if (!HOLD_TOK.test(toks[i])) continue;
    let s = i;
    while (s - 1 >= 0 && STRENGTH_TOK.test(toks[s - 1])) s--;
    let e = i;
    if (toks[i + 1] && NUM_TOK.test(toks[i + 1])) e = i + 1;
    if (s === i && e === i) continue;
    for (let k = s; k <= e; k++) used.add(k);
    const phrase = toks.slice(s, e + 1).join(" ");
    const num = e > i ? toks[e] : null;
    out.push({ type: "hold", phrase, number: num ? parseInt(num, 10) : null, scale_as_written: num ? phrase : null, why: "qualifies hold" });
  }
  for (let i = 0; i < toks.length; i++) {
    if (used.has(i) || !STRENGTH_TOK.test(toks[i])) continue;
    let e = i;
    while (toks[e + 1] && STRENGTH_TOK.test(toks[e + 1]) && !used.has(e + 1)) e++;
    const next = toks[e + 1];
    const phrase = toks.slice(i, e + 1).join(" ");
    for (let k = i; k <= e; k++) used.add(k);
    if (next === undefined || isProductNoun(next)) out.push({ type: "hold", phrase, number: null, scale_as_written: null, why: next === undefined ? "ends the name (qualifies the product)" : "qualifies the product noun '" + next + "'" });
    else nameTable.push({ slug: rec.source_slug, word: phrase, kept: false, why: "qualifies '" + next + "' (RG-13: not hold)" });
  }
  for (const t of toks) if (FLEX_TOK(t)) out.push({ type: "flexibility", phrase: t, number: null, scale_as_written: null, why: "standard 6.9 rigidity/flexibility word" });
  for (const o of out) {
    nameTable.push({ slug: rec.source_slug, word: o.phrase, kept: true, type: o.type, why: o.why });
    rec.claims.push(mk({ type: o.type, raw: o.phrase, tier: nt.tier, source: "product_name", date: null, number: o.number, scale_as_written: o.scale_as_written, scale_max: null, scale_max_stated: o.type === "hold" ? false : null, from_product_name: true, tier_basis: nt.basis }));
  }
}

// ---------------------------------------------------------------------------------------------
// Cohort assembly, ids, guards
// ---------------------------------------------------------------------------------------------
const records = r1Records.concat(newBuilt);
for (const r of records) {
  addNameClaims(r);
  r.standard_version = STANDARD_VERSION;
  r.lexicon_version = LEXICON_VERSION;
  const typeOrder = ["promise", "hold", "flexibility", "finish", "duration", "humidity", "heat_protection", "heat_activation", "cast", "other", "hair_type", "free_from"];
  r.claims = r.claims.map((c, i) => [c, i]).sort((a, b) => typeOrder.indexOf(a[0].type) - typeOrder.indexOf(b[0].type) || a[1] - b[1]).map((x) => x[0]);
}
logPatch("RG-13", "(all records)", "applied", "name words become hold claims only when they qualify hold ('Halt', 'Hold', a hold number) or the product as a whole; " + nameTable.filter((x) => !x.kept).length + " name words rejected, " + nameTable.filter((x) => x.kept && x.type === "hold").length + " kept as hold, " + nameTable.filter((x) => x.kept && x.type === "flexibility").length + " flexibility words added (table in section 9)");
const exclusions = R1_EXCLUSIONS.map((e) => Object.assign({}, e, { round: 1, status_in_round2: e.sample_id === "john-frieda-volume-lift-ansatz-booster" ? "re-entered as a fresh round2-new-r4 capture; frozen with identity_status inci_conflict (manufacturer page vs dm list), so the gate blocks it" : "still excluded (not in round2-new-r4)" }));
{
  const idSet = new Set();
  for (const r of records) {
    r.sample_id = "sty-" + sha256(Buffer.from(ID_SALT + r.source_slug)).slice(0, 10);
    if (idSet.has(r.sample_id)) throw new Error("opaque id collision " + r.sample_id);
    if (R1_IDS.has(r.sample_id)) throw new Error("round-2 id equals a round-1 id: " + r.sample_id);
    idSet.add(r.sample_id);
  }
  const slugs = new Set();
  for (const r of records) {
    if (slugs.has(r.source_slug)) throw new Error("duplicate slug " + r.source_slug);
    slugs.add(r.source_slug);
  }
  const seen = new Map();
  for (const r of records) {
    for (const k of [r.identity.gtin ? "gtin:" + r.identity.gtin : null, r.identity.dm_dan != null ? "dan:" + r.identity.dm_dan : null]) {
      if (!k) continue;
      if (seen.has(k)) exclusions.push({ sample_id: "(warning)", origin: "guard", reason: "duplicate " + k + ": " + seen.get(k) + " and " + r.source_slug, source: "freeze-cohort-r2.js", round: 2 });
      seen.set(k, r.source_slug);
    }
  }
}
records.sort((a, b) => cmp(a.sample_id, b.sample_id));

// ---------------------------------------------------------------------------------------------
// Packets
// ---------------------------------------------------------------------------------------------
// S0 blinding (PH2-6 + coordinator 2026-10-12): the round-1 redaction plus hold-qualifier phrases,
// Haltegrad/Haltestufe, compound finish words and the 6.9 rigidity/flexibility words. Applied to the
// promise and heat lines, the confirmed name and the directions text.
const S0_PRE = [/\b(leicht\w*|sanft\w*|soft|weich\w*|mittel\w*|mittler\w*|normal\w*|stark\w*|starr\w*)\s+(halt\w*|hold\w*|fixier\w*|kontroll\w*)/gi, /\bhalte(grad|stufe)\w*\s*:?\s*(von\s*)?\d*\+?/gi];
const S0_POST = [/\b\w*gl(?:a|ä)nz\w*/gi, /\b\w+matt\w*/gi, /\b\w*gloss\w*/gi, /\b\w*shine\w*/gi, /\bbrillan\w*/gi, /\bwet look\b/gi, /\bflex\w*/gi, /\belastisch\w*/gi, /\b(ver)?formbar\w*/gi, /\bnachstylbar\w*/gi, /\b\w*kleber\w*/gi, /\bfreeze\w*/gi, /\bbetonhart\w*/gi, /\bsteif\w*/gi, /\bkrass\w*/gi, /\b\w+natürlich\w*/gi];
function redactS0(text) {
  if (text == null) return { text: null, count: 0 };
  let n = 0;
  let t = String(text);
  for (const re of S0_PRE) t = t.replace(re, () => (n++, "[CLAIM]"));
  const r = redactHff(t);
  t = r.text;
  n += r.count;
  for (const re of S0_POST) t = t.replace(re, () => (n++, "[CLAIM]"));
  t = t.replace(/\[CLAIM\][a-z\u00e4\u00f6\u00fc\u00df]+/gi, "[CLAIM]").replace(/[A-Za-z\u00c4\u00d6\u00dc\u00e4\u00f6\u00fc\u00df]+\[CLAIM\]/g, "[CLAIM]");
  t = t.replace(/(\[CLAIM\][\s\-\/&,+]*){2,}/g, (m) => "[CLAIM]" + (/\s$/.test(m) ? " " : ""));
  return { text: t.replace(/[ \t]+/g, " ").replace(/ *\n */g, "\n").trim(), count: n };
}
const S0_LEAK_RE = /(\bhalt\w*|\bhold\w*|haltegrad|haltestufe|\bfixier\w*|\bflex\w*|elastisch|elastiz|formbar|kleber|freeze|\bsteif|betonhart|\bstark\w*|\bstärk\w*|\bextra\w*|\bultra\w*|\bmega\b|\bkrass\w*|\bpower\w*|\bmax\w*|\bstrong|\bfirm\b|gl(?:a|ä)nz|gloss|shine|brillan|matt(?!h)|natürlich|\bnatural|\b\d\s*\/\s*\d\b|\b\d\+)/i;
const CLAIMS_LEAK_RE = /(round-?\s?\d|\bfilter\b|dm filter|\bdraft\b|\blane\b|calibration|cohort|unseen|negative_control|subtype|legacy)/i;
const ANY_LEAK_RE = /(round-?\s?1\b|\bdraft\b|\bfilter\b|blind-lane|negative_control|\bunseen\b|reference_only|source_slug|cohort_role|subtype_candidate|draft_subtype|legacy_route|boundary_probe)/i;
const FORBIDDEN_KEYS = ["source_slug", "cohort_role", "reference_only_not_for_blind_lanes", "draft_subtype", "subtype_candidate", "legacy_route", "route", "styling_subtype", "boundary_probe", "history", "origin", "application_moment", "capture_notes", "formula_observations", "tier_basis", "capture_note", "as_captured", "round"];
const packets = { s0: [], fu: [], claims: [] };
const leaks = { fu_brand_name: [], s0_hff_residual: [], claims_annotation: [], slug: [], round1_id: [], url: [], forbidden_key: [], subtype_or_route_id: [], any_label: [] };
const s0Stats = { promise_redacted_packets: 0, replacements: 0, name_redacted: 0, directions_redacted: 0 };
const subtypeIds = uniq(records.map((r) => r.reference_only_not_for_blind_lanes.draft_subtype).filter((x) => x && /_/.test(x))).concat(["leave_in", "heat_protectant", "dry_shampoo", "provisional_boundary", "negative_control", "salt_spray", "texture_spray", "shine_finish", "smoothing_styler", "curl_cream"]);
const allSlugs = records.map((r) => r.source_slug);
const srcClassOf = (c) => c.source_class_override || (c.from_product_name ? "product_name" : c.retailer_attribute ? "retailer_attribute" : sourceClass(c.tier));
const displayForPacket = (d) => (d ? { marks: d.marks, labels_as_printed: d.labels_as_printed, highlighted: d.highlighted, filled: d.filled, caption_as_printed: d.caption_as_printed } : undefined);
for (const rec of records) {
  const id = rec.sample_id;
  const inciBlock = { inci_item_count: rec.identity.inci_normalised.length, tier: rec.identity.inci_source.tier, source_class: sourceClass(rec.identity.inci_source.tier), date: rec.identity.inci_source.date, items: rec.identity.inci_normalised.map((x) => ({ rank: x.rank, inci: x.inci })) };
  // S0
  const promise = [];
  let redCount = 0;
  for (const c of rec.claims) {
    if (c.type !== "promise" || !isC12(c.tier)) continue;
    const red = redactS0(packetText(c.raw));
    redCount += red.count;
    c.s0_redacted_text = red.text;
    promise.push(Object.assign({ text: red.text, redacted: red.count > 0, tier: c.tier, source_class: srcClassOf(c), date: c.date }, c.flags ? { flags: c.flags } : {}, c.mixed_source ? { mixed_source: true } : {}));
  }
  if (redCount) {
    s0Stats.promise_redacted_packets++;
    s0Stats.replacements += redCount;
  }
  const heat = rec.claims.filter((c) => c.type === "heat_protection" && isC12(c.tier)).map((c) => {
    const red = redactS0(packetText(c.raw));
    return Object.assign({ text: red.text, redacted: red.count > 0, tier: c.tier, source_class: srcClassOf(c), date: c.date }, c.flags ? { flags: c.flags } : {}, c.mixed_source ? { mixed_source: true } : {});
  });
  const nameRed = redactS0(rec.identity.product_name);
  const dirRed = redactS0(rec.directions.text);
  if (nameRed.count) s0Stats.name_redacted++;
  if (dirRed.count) s0Stats.directions_redacted++;
  rec.s0_redacted_name = nameRed.text;
  rec.s0_redacted_directions = dirRed.text;
  const s0dir = dirBlock(rec, dirRed.text);
  if (s0dir && dirRed.count) s0dir.redacted_with = "[CLAIM]";
  const s0 = {
    packet: "s0",
    packet_version: COHORT_VERSION,
    sample_id: id,
    product: { confirmed_name: nameRed.text, confirmed_name_redacted: nameRed.count > 0, brand: rec.identity.brand, format: rec.identity.format },
    inci: inciBlock,
    directions_status: rec.directions.directions_status,
    directions: s0dir,
    promise_claims_c1_c2: promise,
    heat_protection_claims_c1_c2: heat,
  };
  if (rec.identity.identity_status === "inci_conflict") {
    s0.identity_status = "inci_conflict";
    s0.inci_alt = { items: rec.identity.inci_alt.inci_normalised.map((x) => ({ rank: x.rank, inci: x.inci })), note: "second capture of the same product with a different list; the list in 'inci' is the one read from the newer/higher-tier source" };
  } else if (rec.identity.identity_status !== "as_captured") {
    s0.identity_status = rec.identity.identity_status;
    s0.identity_note = "two INCI lists were captured for this GTIN; a dated C1 pack capture carrying the GTIN is the formula of record (standard 2.2 A2 release test)";
  }
  packets.s0.push({ id, body: s0, rec });
  // F/U
  const masked = maskDirections(rec.directions.text, rec.identity.brand, rec.identity.product_name, rec.source_slug);
  const fu = { packet: "fu", packet_version: COHORT_VERSION, sample_id: id, format: rec.identity.format, inci: inciBlock, directions_status: rec.directions.directions_status, directions: dirBlock(rec, masked.text, true) };
  const lk = leakCheck(masked.text, rec);
  if (lk.length) leaks.fu_brand_name.push({ slug: rec.source_slug, hits: lk, text: masked.text });
  packets.fu.push({ id, body: fu, rec });
  // claims
  const cl = [];
  for (const c of rec.claims) {
    if (c.type === "free_from" || c.type === "hair_type") continue;
    if (c.type === "other" && !(HFF_RE.test(c.raw) || HOLD_NUMBER_RE.test(c.raw))) continue;
    const o = { type: c.type, text: packetText(c.raw), tier: c.tier, source_class: srcClassOf(c), source_host: c.from_product_name ? null : srcHost(c.source), date: c.date };
    if (c.type === "hold") {
      o.number = c.number;
      o.scale_as_written = c.scale_as_written;
      o.scale_max = c.scale_max;
      o.scale_max_stated = c.scale_max_stated;
      o.words = c.words != null ? packetText(c.words) : null;
      if (c.display) o.display = displayForPacket(c.display);
    }
    if (c.from_product_name) o.from_product_name = true;
    if (c.attribute) o.attribute = c.attribute;
    if (c.retailer_attribute) o.retailer_attribute = true;
    if (c.mixed_source) o.mixed_source = true;
    if (c.flags) o.flags = c.flags;
    cl.push(o);
  }
  const scaleHold = cl.find((x) => x.type === "hold" && x.number != null && !x.from_product_name) || cl.find((x) => x.type === "hold" && x.number != null) || null;
  const cp = { packet: "claims", packet_version: COHORT_VERSION, sample_id: id, brand: rec.identity.brand, format: rec.identity.format, product_type_word: productTypeWord(rec.identity.product_name, rec.identity.format), scale_info: scaleHold ? { number: scaleHold.number, scale_as_written: scaleHold.scale_as_written, scale_max: scaleHold.scale_max, scale_max_stated: scaleHold.scale_max_stated, tier: scaleHold.tier } : null, claims: cl };
  packets.claims.push({ id, body: cp, rec });
}
// leak checks over every packet
const walk = (o, fn, k) => {
  if (Array.isArray(o)) o.forEach((x) => walk(x, fn, k));
  else if (o && typeof o === "object") for (const [kk, v] of Object.entries(o)) (fn(kk, v, true), walk(v, fn, kk));
  else fn(k, o, false);
};
for (const kind of ["s0", "fu", "claims"]) {
  for (const p of packets[kind]) {
    const ser = JSON.stringify(p.body);
    const low = ser.toLowerCase();
    for (const s of allSlugs) if (low.includes(s)) leaks.slug.push(kind + "/" + p.id + ": " + s);
    for (const rid of R1_IDS) if (ser.includes(rid)) leaks.round1_id.push(kind + "/" + p.id + ": " + rid);
    if (/https?:\/\/|www\./i.test(ser)) leaks.url.push(kind + "/" + p.id);
    for (const sid of subtypeIds) if (new RegExp("\\b" + sid + "\\b", "i").test(ser)) leaks.subtype_or_route_id.push(kind + "/" + p.id + ": " + sid);
    walk(p.body, (k, v, isKey) => {
      if (isKey && FORBIDDEN_KEYS.includes(k)) leaks.forbidden_key.push(kind + "/" + p.id + ": " + k);
      if (!isKey && typeof v === "string" && ANY_LEAK_RE.test(v)) leaks.any_label.push(kind + "/" + p.id + ": " + v.slice(0, 120));
    });
    if (kind === "claims") walk(p.body.claims, (k, v, isKey) => {
      if (!isKey && typeof v === "string" && CLAIMS_LEAK_RE.test(v)) leaks.claims_annotation.push(p.id + " (" + p.rec.source_slug + "): " + v.slice(0, 160));
    });
    if (kind === "s0") {
      const b = p.body;
      const texts = [["name", b.product.confirmed_name], ["directions", b.directions ? b.directions.text || b.directions.paraphrase_text : null]].concat(b.promise_claims_c1_c2.map((x) => ["promise", x.text]), b.heat_protection_claims_c1_c2.map((x) => ["heat", x.text]));
      for (const [f, t] of texts) {
        if (!t) continue;
        const m = String(t).replace(/\[CLAIM\]/g, " ").match(S0_LEAK_RE);
        if (m) leaks.s0_hff_residual.push(p.id + " (" + p.rec.source_slug + ") " + f + ": '" + m[0] + "' in \"" + t.slice(0, 140) + "\"");
      }
    }
  }
}
const leakTotal = Object.values(leaks).reduce((a, b) => a + b.length, 0);

// ---------------------------------------------------------------------------------------------
// Evidence gate inputs (computed from the S0 packets; standard 4.1)
// ---------------------------------------------------------------------------------------------
const gateRows = packets.s0.map((p) => {
  const r = p.rec;
  const b = p.body;
  const promise = b.promise_claims_c1_c2.length > 0;
  const promiseInformative = b.promise_claims_c1_c2.some((x) => x.text.replace(/\[CLAIM\]/g, "").replace(/[\s\W]+/g, "").length > 0);
  const dir = b.directions_status === "verbatim";
  const inciComplete = !r.identity.inci_flags.some((f) => INCOMPLETE_FLAG_RE.test(f));
  const identityOk = ["as_captured", "verified", "verified_with_minor_source_difference"].includes(r.identity.identity_status);
  const pass = promise && dir && inciComplete && identityOk;
  return { r, promise, promiseInformative, dir, inciComplete, identityOk, pass, capture: r.reference_only_not_for_blind_lanes.capture_passes_three_evidence_items };
});
const count = (arr, f) => arr.reduce((m, x) => ((m[f(x)] = (m[f(x)] || 0) + 1), m), {});
const sortKeys = (o) => Object.fromEntries(Object.entries(o).sort((a, b) => cmp(a[0], b[0])));
const gate = {
  pass: gateRows.filter((x) => x.pass).length,
  promise: gateRows.filter((x) => x.promise).length,
  promise_only_claim_markers: gateRows.filter((x) => x.promise && !x.promiseInformative).map((x) => x.r.source_slug).sort(),
  dir: gateRows.filter((x) => x.dir).length,
  inci: gateRows.filter((x) => x.inciComplete).length,
  identity: gateRows.filter((x) => x.identityOk).length,
  by_role: sortKeys(count(gateRows.filter((x) => x.pass), (x) => x.r.cohort_role)),
  by_origin: sortKeys(count(gateRows.filter((x) => x.pass), (x) => x.r.reference_only_not_for_blind_lanes.origin)),
  failing: gateRows.filter((x) => !x.pass).map((x) => "`" + x.r.source_slug + "` (" + x.r.cohort_role + "; " + [x.promise ? null : "no C1/C2 promise", x.dir ? null : "directions " + x.r.directions.directions_status, x.inciComplete ? null : "INCI incomplete", x.identityOk ? null : "identity " + x.r.identity.identity_status].filter(Boolean).join(", ") + ")").sort(),
  capture_disagree: gateRows.filter((x) => x.capture !== undefined && x.capture !== x.pass).map((x) => "`" + x.r.source_slug + "` (capture " + x.capture + ", computed " + x.pass + ")").sort(),
};
for (const g of gateRows) g.r.evidence_gate_inputs = { c1_c2_promise: g.promise, directions_verbatim: g.dir, inci_complete: g.inciComplete, identity_status_ok: g.identityOk, all_three: g.pass };

// ---------------------------------------------------------------------------------------------
// Write outputs (only under v1.0/r2/)
// ---------------------------------------------------------------------------------------------
const INPUTS = R1_INPUTS.concat([R4_NEW, R4_RECAP, "v1.0/build/freeze-cohort.js"]);
const counts = {
  total: records.length,
  by_role: sortKeys(count(records, (r) => r.cohort_role)),
  by_origin: sortKeys(count(records, (r) => r.reference_only_not_for_blind_lanes.origin)),
  by_role_and_origin: sortKeys(count(records, (r) => r.cohort_role + " / " + r.reference_only_not_for_blind_lanes.origin)),
  by_draft_subtype: sortKeys(count(records, (r) => r.reference_only_not_for_blind_lanes.draft_subtype)),
  by_identity_status: sortKeys(count(records, (r) => r.identity.identity_status)),
  by_directions_status: sortKeys(count(records, (r) => r.directions.directions_status)),
  evidence_gate_all_three: gate.pass,
};
const cohort = {
  cohort_version: COHORT_VERSION,
  frozen_on: FREEZE_DATE,
  standard_version: STANDARD_VERSION,
  lexicon_version: LEXICON_VERSION,
  purpose: "Frozen round-2 calibration cohort. REFERENCE INPUT ONLY: never give this file to a blind lane (it maps opaque ids to slugs and to round-1 ids and carries legacy labels).",
  counts,
  exclusions,
  patches: patchLog,
  inputs: INPUTS.map((f) => ({ path: f, sha256: sha256(fs.readFileSync(path.join(BASE, f))) })),
  round1_rebuild_check: { files_compared: round1Check.files, byte_identical: round1Check.identical, round1_manifest_sha256: sha256(fs.readFileSync(path.join(V1, "artifact-manifest.json"))) },
  id_map: records.map((r) => ({ sample_id: r.sample_id, source_slug: r.source_slug, round1_sample_id: R1_ID_BY_SLUG[r.source_slug] || null })),
  records,
};
const ser = (o) => JSON.stringify(o, null, 2) + "\n";
fs.rmSync(OUT, { recursive: true, force: true });
for (const d of ["packets/s0", "packets/fu", "packets/claims"]) fs.mkdirSync(path.join(OUT, d), { recursive: true });
const written = [];
const writeOut = (rel, text) => {
  fs.writeFileSync(path.join(OUT, rel), text);
  written.push(rel);
};
writeOut("cohort.json", ser(cohort));
for (const kind of ["s0", "fu", "claims"]) for (const p of packets[kind].slice().sort((a, b) => cmp(a.id, b.id))) writeOut("packets/" + kind + "/" + p.id + ".json", ser(p.body));

// FREEZE-NOTES.md
const fmt = (o) => Object.entries(o).map(([k, v]) => "| " + k + " | " + v + " |").join("\n");
const list = (a) => (a.length ? a.join("; ") : "none");
const s0Sample = (packets.s0.find((p) => p.body.identity_status === "inci_conflict" && p.body.directions && p.body.heat_protection_claims_c1_c2.length) || packets.s0.find((p) => p.body.inci_alt) || packets.s0[0]).body;
const fuSample = packets.fu.find((p) => p.body.directions).body;
const clSample = (packets.claims.find((p) => p.body.claims.some((c) => c.display) && p.body.claims.some((c) => c.from_product_name)) || packets.claims[0]).body;
const roleList = (role, origin) => records.filter((r) => r.cohort_role === role && (!origin || r.reference_only_not_for_blind_lanes.origin === origin)).map((r) => "`" + r.source_slug + "`").sort();
const editorSummaryCount = records.reduce((a, r) => a + ((r.claim_capture.editor_summaries || []).length), 0);
const droppedCount = records.reduce((a, r) => a + ((r.claim_capture.dropped_claims || []).length), 0);
const leakLines = Object.entries(leaks).map(([k, v]) => "| " + k + " | " + v.length + " |").join("\n");
const notes = `# FREEZE-NOTES - Styling round-2 calibration cohort (${COHORT_VERSION})

Generated by \`build/freeze-cohort-r2.js\` (deterministic; re-run to reproduce every hash in \`r2/artifact-manifest.json\`). Frozen ${FREEZE_DATE}. Standard \`${STANDARD_VERSION}\`, lexicon \`${LEXICON_VERSION}\`. Every number below is computed by the script. Nothing here is committed or locked, and nothing is classified (no route, subtype or hold level is assigned).

## 1. How the cohort was built

1. The round-1 script \`build/freeze-cohort.js\` is run unchanged in a sandbox whose writes go to memory. Its ${round1Check.files} outputs were compared with the round-1 files on disk: ${round1Check.identical} of ${round1Check.files} byte-identical (the build stops on any difference). Its ${r1Records.length} records are the base.
2. Round-4 re-capture patches (\`capture/recapture-r4.json\`) and the v0.2 capture rules (P-4, P-6, RG-13) are applied (section 3).
3. The ${newBuilt.length} new products of \`capture/round2-new-r4.json\` are frozen with the same record schema. Records that fail an evidence item are still frozen (they test the gate).
4. Opaque ids: \`sty-\` + 10 hex of SHA-256(\`${ID_SALT}\` + slug). No round-2 id equals a round-1 id (checked). The slug ↔ id map (and the round-1 id) lives only in \`r2/cohort.json\` (\`id_map\`, \`records[].source_slug\`, \`records[].history.round2.round1_sample_id\`).

## 2. Counts

| Metric | Value |
|---|---|
| Records in cohort | ${counts.total} |
| Round-1 records | ${r1Records.length} |
| New round-4 records | ${newBuilt.length} |
| Evidence gate, all three items | ${gate.pass} of ${counts.total} |

By cohort role:

| Role | n |
|---|---|
${fmt(counts.by_role)}

By origin:

| Origin | n |
|---|---|
${fmt(counts.by_origin)}

By role and origin:

| Role / origin | n |
|---|---|
${fmt(counts.by_role_and_origin)}

By identity status:

| Status | n |
|---|---|
${fmt(counts.by_identity_status)}

By directions status:

| Status | n |
|---|---|
${fmt(counts.by_directions_status)}

By draft subtype (reference only, never in a packet):

| Draft subtype | n |
|---|---|
${fmt(counts.by_draft_subtype)}

Round-2 unseen (${roleList("unseen").length}): ${roleList("unseen").join(", ")}.

Round-1 unseen now calibration (${records.filter((r) => r.history.round2 && r.history.round2.round1_role === "unseen").length}): ${records.filter((r) => r.history.round2 && r.history.round2.round1_role === "unseen").map((r) => "`" + r.source_slug + "`").sort().join(", ")}.

Negative controls (${roleList("negative_control").length}, unchanged from round 1): ${roleList("negative_control").join(", ")}.

## 3. Patches applied (one line each)

${patchLog.map((p) => "- **" + p.id + "** `" + p.slug + "` - " + p.status + ": " + p.detail).join("\n")}

P-6 detail: ${droppedCount} empty/null claims dropped (kept under \`claim_capture.dropped_claims\`), ${editorSummaryCount} new-product typed fields kept only as \`claim_capture.editor_summaries\` (not found verbatim in any captured line). Removed annotations stay on each claim as \`capture_note\` with \`raw_as_captured\` / \`words_as_captured\` (cohort.json only). Claims whose stripped annotation named a source and whose text has several segments carry \`mixed_source: true\` (also in the claims packet). Retailer filter/attribute values on C3 claims carry \`retailer_attribute: true\`; no retailer attribute is stamped C1/C2 on a non-house brand.

## 4. Exclusions

${exclusions.map((e) => "- `" + e.sample_id + "` (round " + e.round + ", " + e.origin + "): " + e.reason + (e.status_in_round2 ? " **Round 2:** " + e.status_in_round2 + "." : "")).join("\n")}

No new product was excluded (GTIN/DAN duplicate guard over all ${counts.total} records: ${exclusions.filter((e) => e.origin === "guard").length} warnings).

## 5. Evidence gate (standard 4.1), computed from the S0 packets

| Criterion | Records |
|---|---|
| C1/C2 promise line present | ${gate.promise} of ${counts.total} |
| \`directions_status: verbatim\` | ${gate.dir} of ${counts.total} |
| Complete INCI (no truncation / missing-separator / split-item flag) | ${gate.inci} of ${counts.total} |
| \`identity_status\` not a conflict (as_captured / verified_with_minor_source_difference) | ${gate.identity} of ${counts.total} |
| **All items** | **${gate.pass} of ${counts.total}** |

Pass by role: ${Object.entries(gate.by_role).map(([k, v]) => v + " " + k).join(", ")}. Pass by origin: ${Object.entries(gate.by_origin).map(([k, v]) => v + " " + k).join(", ")}.

Records whose only C1/C2 promise lines are fully redacted to \`[CLAIM]\` (counted as present, as in round 1): ${list(gate.promise_only_claim_markers.map((s) => "`" + s + "`"))}.

Not passing (${gate.failing.length}): ${list(gate.failing)}.

Capture's own \`passes_three_evidence_items\` vs computed (new products): ${list(gate.capture_disagree)}.

## 6. Leak checks (all packets)

| Check | Hits |
|---|---|
${leakLines}
| **Total** | **${leakTotal}** |

Checks: \`fu_brand_name\` = the round-1 residual brand/name-token check on masked F/U directions; \`s0_hff_residual\` = hold/finish/flexibility/strength words or hold numbers left in the S0 confirmed name, directions, promise and heat lines after redaction; \`claims_annotation\` = round/filter/draft/lane/cohort labels inside claims-packet claim objects; \`slug\` = any cohort slug in any packet; \`round1_id\` = any round-1 opaque id in any packet; \`url\` = any URL; \`forbidden_key\` = keys such as route, subtype, cohort_role, history, tier_basis, capture_note, as_captured; \`subtype_or_route_id\` = draft-subtype or route ids; \`any_label\` = round-1/draft/filter/unseen/reference-only labels in any packet value.
${leakTotal ? "\nHits:\n\n" + Object.entries(leaks).flatMap(([k, v]) => v.map((x) => "- " + k + ": " + (typeof x === "string" ? x : JSON.stringify(x)))).join("\n") : ""}

## 7. S0 blinding

PH2-6 redaction of round 1 plus (coordinator, 2026-10-12): hold-qualifier phrases („mittlerer Kontrolle", „leichter Halt"), Haltegrad/Haltestufe with numbers, compound finish words (…glänzend, …matt, Gloss, Shine, Brillanz) and the standard 6.9 rigidity/flexibility words (Flex…, elastisch, formbar, Kleber, Freeze, steif, betonhart, krass). Applied to S0 promise and heat lines, **the confirmed name and the directions text**. ${s0Stats.promise_redacted_packets} S0 packets carry a redacted promise line (${s0Stats.replacements} replacements); ${s0Stats.name_redacted} confirmed names and ${s0Stats.directions_redacted} directions texts were redacted. Unredacted name and directions stay in cohort.json (\`identity.product_name\`, \`directions.text\`), the redacted forms in \`s0_redacted_name\` / \`s0_redacted_directions\` / \`claims[].s0_redacted_text\`. F/U directions keep the round-1 masking (brand, name, look/strength words → \`[CLAIM]\`), extended for the new products by \`R2_EXTRA_MASK\` (${Object.entries(R2_EXTRA_MASK).map(([k, v]) => "\`" + k + "\`: " + v.join(", ")).join("; ")}) and by treating ${R2_GENERIC_NAME.map((x) => "„" + x + "“").join(", ")} as generic name tokens (a verb stem and a problem word, not name leakage). Name variants are not in any packet.

## 8. Packet field lists

All packets: one JSON file per product, \`r2/packets/<kind>/<opaque id>.json\`. No URL, slug, route, subtype, prior lane output or reference-only field appears in any packet (section 6).

### 8.1 S0 (\`packets/s0/\`)

${fieldList(s0Sample, "").join("\n")}

\`identity_status\` + \`inci_alt\` appear only for \`inci_conflict\`; \`identity_status\` + \`identity_note\` only for \`verified_with_minor_source_difference\`.

### 8.2 F/U (\`packets/fu/\`)

${fieldList(fuSample, "").join("\n")}

### 8.3 Claims (\`packets/claims/\`)

${fieldList(clSample, "").join("\n")}

Hold displays (pack graphics described by the observer, \`value_kind: observer_description_of_graphic\`) are carried as structured \`display\` fields; the observer's description itself stays in cohort.json (\`display.as_captured\`), never as claim text. Name-derived claims carry \`from_product_name: true\`, \`source_class: product_name\`.

## 9. Name-derived claims (RG-13, P-2)

| Record | Name word | Result |
|---|---|---|
${nameTable.slice().sort((a, b) => cmp(a.slug + a.word, b.slug + b.word)).map((x) => "| `" + x.slug + "` | " + x.word + " | " + (x.kept ? x.type + " claim (" + x.why + ")" : "rejected: " + x.why) + " |").join("\n")}

## 10. Notes for the owner

1. \`john-frieda-volume-lift-ansatz-booster\` was excluded in round 1 (no INCI could be frozen). round2-new-r4 recaptured it; it is frozen with \`identity_status: inci_conflict\` (manufacturer page vs dm list; both lists in S0), so the evidence gate blocks it. Exclude it instead if the round-1 ruling should still stand.
2. Cantu Edge Stay Gel stays \`inci_conflict\` (switch \`CANTU_RELEASE_A2\` = ${CANTU_RELEASE_A2}).
3. \`osis-flatliner\` directions are the page's only usage line (a secondary use); kept as verbatim, flagged in \`directions.status_note\`.
4. Re-capture lines available but not applied (outside the brief): Power Flex front label „FORMING CREAM POWER FLEX · kein Verkleben · für flexiblen Halt"; the further Glow & Shine pack lines; Bali Curls Leave-in pack-back German directions; the Balea Finishing Stick carton claims.
6. S0 redaction is word-based and therefore also blanks ambiguous verbs in directions (e.g. „senkrecht halten", „fixieren"); the F/U packet keeps those directions with only the round-1 masking.
5. Some new-product formats are the capture's assumptions (pump vs aerosol; see \`reference_only_not_for_blind_lanes.capture_notes\`).

## 11. Reproduction

\`node data/research/styling-inci/v1.0/build/freeze-cohort-r2.js\` rewrites \`r2/\` only; two consecutive runs give byte-identical output. \`r2/artifact-manifest.json\` records the SHA-256 of every input (round-1 inputs, both round-4 capture files, the round-1 script), of this script and of every output.
`;
writeOut("FREEZE-NOTES.md", notes);
const manifest = {
  manifest_version: COHORT_VERSION,
  frozen_on: FREEZE_DATE,
  algorithm: "sha256",
  script: { path: "v1.0/build/freeze-cohort-r2.js", sha256: sha256(fs.readFileSync(__filename)) },
  inputs: cohort.inputs,
  round1_rebuild_check: cohort.round1_rebuild_check,
  counts: { packets_s0: packets.s0.length, packets_fu: packets.fu.length, packets_claims: packets.claims.length, cohort_records: records.length },
  artifacts: written.slice().sort(cmp).map((r) => ({ path: "r2/" + r, sha256: sha256(fs.readFileSync(path.join(OUT, r))) })),
};
fs.writeFileSync(path.join(OUT, "artifact-manifest.json"), ser(manifest));
const rootHash = sha256(Buffer.from(manifest.artifacts.map((a) => a.path + ":" + a.sha256).join("\n")));
console.log(JSON.stringify({ records: records.length, by_role: counts.by_role, by_origin: counts.by_origin, evidence_gate_pass: gate.pass, leak_total: leakTotal, leaks: Object.fromEntries(Object.entries(leaks).map(([k, v]) => [k, v.length])), packets: manifest.counts, manifest_root_sha256: rootHash, manifest_file_sha256: sha256(fs.readFileSync(path.join(OUT, "artifact-manifest.json"))) }, null, 2));
