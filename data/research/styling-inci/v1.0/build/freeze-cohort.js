#!/usr/bin/env node
// Styling research engine - Phase 3 cohort freeze.
//   node data/research/styling-inci/v1.0/build/freeze-cohort.js
// Builds the frozen calibration cohort (cohort.json), the three sealed blind-lane packet sets
// (packets/s0, packets/fu, packets/claims; PH2-6, standard section 10.2, property set section 7)
// and artifact-manifest.json (SHA-256 of every output). Deterministic: no clock, no randomness,
// sorted iteration everywhere. Writes only inside v1.0/ (cohort.json, packets/, manifest, notes).
// It never reads v1.0/sealed/.
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const V1 = path.resolve(__dirname, "..");
const BASE = path.resolve(V1, "..");
const FREEZE_DATE = "2026-10-12";
const COHORT_VERSION = "styling-inci-v1.0-cohort-1";
const STANDARD_VERSION = "styling-inci-v0.1";
const LEXICON_VERSION = "styling-lexicon-v0.1";
const ID_SALT = "styling-inci-v1.0-cohort-1/opaque-id/";

// ---------------------------------------------------------------------------------------------
// Switches the owner can flip (documented in FREEZE-NOTES.md)
// ---------------------------------------------------------------------------------------------
const INCLUDE_ALT_INCI_IN_S0 = true; // inci_conflict products carry both lists in the S0 packet (standard 2.2 A2)

// ---------------------------------------------------------------------------------------------
// Fixed decisions
// ---------------------------------------------------------------------------------------------
const EXCLUDED = {
  "john-frieda-volume-lift-ansatz-booster": {
    reason:
      "Coordinator ruling (2026-10-12): three live formulas (retired dm 125 ml SKU, current dm 150 ml SKU 3122357, johnfrieda.com/de-de page) and the SKU physically on the shelf is unverified; no INCI can be frozen. Capture detail in directions-promise-r3 notes.",
    source: "v1.0/capture/directions-promise-r3.json",
  },
  "syoss-curl-control-hydrating-spray": {
    reason:
      "Not sold in Germany: recapture-r3 (2026-10-11) found only dm.at (Henkel CEE) and the AT/ES/GR/CY multi-country pack; no German retailer or syoss.de listing, so even a C5 cross-market reading is not eligible (needs a DE retailer). tier_note in recapture-r3.",
    source: "v1.0/capture/recapture-r3.json",
  },
};
// Gap-fill records that are the same physical product as an unseen record: kept ONLY as unseen.
const DUPLICATE_OF_UNSEEN_RULE = "same dm DAN or same GTIN as an unseen-r3 record";

// Confirmed-name overrides where the current capture explicitly states a rename of the unit on sale.
const NAME_OVERRIDES = {
  "cantu-shea-butter-extra-hold-edge-stay-gel": {
    name: "Shea Butter for Natural Hair Firm Hold Edge Stay Gel",
    basis: "recapture-r3: current pack is 'Firm Hold Edge Stay Gel' (NEW & IMPROVED), not 'Extra Hold'; Amazon.de title still says Extra Hold",
  },
  "syoss-curl-cream-gel-3in1": {
    name: "Curl Cream Gel",
    basis: "F1: syoss.de lists 'Syoss Curl Cream Gel' (not '3in1 Curl Creme-Gel' / 'Curl Control')",
  },
  "syoss-professional-performance-max-hold-power-wax": {
    name: "Max Hold Wax",
    basis: "F1: syoss.de lists 'Syoss Max Hold Wax' (not 'Professional Performance Max Hold Power Wax')",
  },
};
// Products whose round-1 INCI is known stale but whose current INCI is not in any input.
// (empty since directions-promise-r3 supplies inci_current for the three previously stale records; john-frieda-volume-lift-ansatz-booster is excluded)
const STALE_INCI_UNRECAPTURED = {};
const CAPTURE_FLAGS = { "neqi-diamond-glass-ultimate-styling-spray": ["chf_pricing (neqi-hair.com is the DACH shop with CHF prices; tier stays C2)"] };
// Non-binding annotation variants of the confirmed name (kept in cohort.json only).
const NAME_VARIANTS = {
  "schwarzkopf-taft-gel-wax-glanz-halt-2": ["schwarzkopf.de: Glanz Gel Wax 75 ml"],
  "got2b-styling-mattpaste-strand-matte": ["got2b.de: Strand Matte Matt-Paste 100 ml"],
  "got2b-styling-paste-istyler-texture-clay": ["got2b.de: iStyler Texture Clay 75 ml"],
  "wella-professionals-eimi-flowing-form": ["wella.com DE: EIMI Smooth Flowing Form (glaettender Haarbalsam)"],
  "garnier-fructis-leave-in-spray-diamond-sleek-glaettungsspray": ["manufacturer: Fructis Diamond Sleek Shine-Coat Glaettungsspray"],
  "wellaflex-schaumfestiger-locken-und-wellen-starker-halt": ["brand page: Wellaflex Locken & Wellen Schaumfestiger"],
  "john-frieda-volume-lift-ansatz-booster": ["current dm SKU: Leave-In Spray Volume Lift Ansatz-Booster (mit Peptiden)"],
  "schwarzkopf-taft-haarspray-classic-halt-3": ["schwarzkopf.de: Classic Haarspray Halt & Schutz"],
};

// Per-record tier overrides for the 8 unseen + 12 gap-fill records whose capture strings mix pack (C1) and retailer text.
// hold: list of {raw, tier, words, number, scale_max, scale_max_stated, source_class}
const HOLD_OVERRIDES = {
  "got2b-spruehkleber-freeze-haarlack": [
    { raw: "krasser Halt", tier: "C1", words: "krasser Halt (Pack front; Punkteskala neben dem Text, Zahl der gefuellten Punkte nicht lesbar)", number: null, scale_max: null, scale_max_stated: false, source_class: "pack" },
    { raw: "sehr starker Halt (dm-Produktmerkmal)", tier: "C3", words: "sehr starker Halt", number: null, scale_max: null, scale_max_stated: false, source_class: "retailer_page" },
  ],
  "taft-styling-paste-forming-halt-5plus": [
    { raw: "5+", tier: "C1", words: "5+ gedruckt auf der Packung; Pack-Front zeigt eine 4-Punkte-Skala plus eingekreiste '5+'", number: 5, scale_max: null, scale_max_stated: false, source_class: "pack" },
    { raw: "Haltegrad: 5", tier: "C3", words: "sehr starker Halt (dm-Produktmerkmal); starker Halt bis zu 24h; Rossmann: Haltegrad 5+", number: 5, scale_max: null, scale_max_stated: false, source_class: "retailer_page" },
  ],
  "redken-styling-beach-spray": [
    { raw: "MITTLERER HALT", tier: "C3", words: "mittlerer Halt (nur Haendler-Text easycosmetic.de; englisches Produktfoto lookfantastic.at)", number: null, scale_max: null, scale_max_stated: false, source_class: "retailer_page" },
  ],
};

// ---------------------------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------------------------
const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(BASE, rel), "utf8"));
const sha256 = (buf) => crypto.createHash("sha256").update(buf).digest("hex");
const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9äöüß]+/g, " ").trim();
const uniq = (a) => [...new Set(a)];
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const isC12 = (t) => ["C1", "C2", "C2_house_brand", "C2_cross_market_verified"].includes(t);
const hostOf = (u) => {
  const m = String(u || "").match(/^https?:\/\/([^/]+)/);
  if (m) return m[1].replace(/^www\./, "");
  return u && /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(String(u)) ? String(u).replace(/^www\./, "") : null;
};

// ---------------------------------------------------------------------------------------------
// Load inputs
// ---------------------------------------------------------------------------------------------
const INPUT_FILES = [
  "concept-v0/calibration-set-r2.json",
  "concept-v0/samples/lane1-gel-curl.json",
  "concept-v0/samples/lane2-mousse-lotion-root.json",
  "concept-v0/samples/lane3-hairspray-finish.json",
  "concept-v0/samples/lane4-texture.json",
  "concept-v0/samples/lane5-modelling.json",
  "concept-v0/samples/lane6-heat-boundary.json",
  "concept-v0/round2/G1-curls-refresh.json",
  "concept-v0/round2/G2-finish-texture.json",
  "concept-v0/round2/F1-henkel-claims.json",
  "concept-v0/round2/F2-mass-claims.json",
  "concept-v0/round2/F3-salon-claims.json",
  "v1.0/capture/gapfill-r3.json",
  "v1.0/capture/recapture-r3.json",
  "v1.0/capture/unseen-r3.json",
  "v1.0/capture/directions-promise-r3.json",
];
const cal = readJson("concept-v0/calibration-set-r2.json").records;
const rawFiles = {};
for (const f of INPUT_FILES.slice(1, 9)) rawFiles[path.basename(f)] = readJson(f);
const F = {};
for (const f of INPUT_FILES.slice(9, 12)) for (const r of readJson(f)) F[r.sample_id] = { ...r, _file: path.basename(f) };
const gapfill = readJson("v1.0/capture/gapfill-r3.json");
const recapture = Object.fromEntries(readJson("v1.0/capture/recapture-r3.json").map((r) => [r.sample_id, r]));
const unseen = readJson("v1.0/capture/unseen-r3.json");
const dpMap = Object.fromEntries(readJson("v1.0/capture/directions-promise-r3.json").map((r) => [r.slug, r]));

// raw capture per calibration record: the lane file named by the calibration record is primary;
// the same id in another lane file is a duplicate capture (kept in cohort.json, not used).
function rawFor(c) {
  // source_lane "round2" = the G1/G2 gap-fill files; otherwise the lane file named by the record
  const laneFiles = c.source_lane === "round2" ? ["G1-curls-refresh.json", "G2-finish-texture.json"] : [c.source_lane];
  let hit = null;
  let primaryName = null;
  for (const fn of laneFiles) {
    const h = rawFiles[fn] && rawFiles[fn].find((r) => r.sample_id === c.sample_id);
    if (h) {
      hit = h;
      primaryName = fn;
      break;
    }
  }
  if (!hit) throw new Error("no raw capture in " + c.source_lane + " for " + c.sample_id);
  const dups = [];
  for (const [fn, arr] of Object.entries(rawFiles)) {
    if (fn === primaryName) continue;
    if (arr.some((r) => r.sample_id === c.sample_id)) dups.push(fn);
  }
  return { raw: hit, dups: dups.sort() };
}

// ---------------------------------------------------------------------------------------------
// INCI normalisation (mechanical only; no lexicon ids, no typo repair)
// ---------------------------------------------------------------------------------------------
function splitTopLevel(s) {
  const out = [];
  let depth = 0;
  let cur = "";
  for (const ch of s) {
    if (ch === "(" || ch === "[") depth++;
    if (ch === ")" || ch === "]") depth = Math.max(0, depth - 1);
    if (depth === 0 && (ch === "," || ch === "•" || ch === "·")) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}
function normaliseInci(rawText) {
  const repairs = [];
  let s = String(rawText).replace(/\s+/g, " ").trim();
  const strip = (re, why) => {
    const before = s;
    s = s.replace(re, "").trim();
    if (s !== before) repairs.push(why);
  };
  strip(/\s*\(pack list;[^]*$/i, "removed trailing capture annotation '(pack list; ...)'");
  strip(/\s*\(\*certified organic ingredient\)\s*$/i, "removed trailing footnote '(*certified organic ingredient)'");
  strip(/\.\s*\*certified organic ingredient\.?\s*$/i, "removed trailing footnote '*CERTIFIED ORGANIC INGREDIENT.'");
  strip(/\s*\(\*\s*from certified organic agriculture[^)]*\)\s*$/i, "removed trailing footnote '(* from certified organic agriculture ...)'");
  strip(/\s+\*+\s*ingredients from certified organic[^]*$/i, "removed trailing footnote '* ingredients from certified organic agriculture ...'");
  strip(/\.\s*\*\s*Ethylalcohol\s*$/i, "removed trailing footnote '*Ethylalcohol'");
  strip(/\s*\(\*Curl Activating Complex[^)]*\)\s*$/i, "removed trailing footnote '(*Curl Activating Complex ...)'");
  if (/[•·]/.test(s)) repairs.push("bullet separators read as commas");
  if (/\\/.test(s)) repairs.push("backslash alias separators in a single item read as '/'");
  s = s.replace(/\.\s*$/, "");
  if (s !== String(rawText).trim() && !repairs.length) repairs.push("trailing period removed");
  const items = splitTopLevel(s)
    .map((x) => x.replace(/\s+/g, " ").trim())
    .filter((x) => x.length);
  const list = items.map((asWritten, i) => {
    let inci = asWritten.replace(/\\/g, "/").replace(/\*+$/g, "").replace(/\s+/g, " ").trim();
    if (inci !== asWritten) {
      /* footnote asterisks / backslashes normalised */
    }
    return { rank: i + 1, inci, as_written: asWritten };
  });
  if (/\*/.test(s)) repairs.push("footnote asterisks stripped from item names (kept in as_written)");
  return { items: list, repairs: uniq(repairs) };
}
function inciFlags(items, id) {
  const flags = [];
  for (const it of items) {
    if (/\s(?:sodium chloride|citrate|acid)$/i.test(it.inci) && /citronellol sodium chloride/i.test(it.inci)) flags.push("possible_missing_separator:" + it.inci);
  }
  return flags;
}

// ---------------------------------------------------------------------------------------------
// Claim helpers
// ---------------------------------------------------------------------------------------------
const HOUSE_BRAND_RE = /^(balea|alverde|langhaarm|isana)/i;
const HFF_RE = /(halt\w*|\bhold\w*|fixier\w*|\bfest\w*|stark\w*|st\u00e4rk\w*|\bextra\b|\bultra\w*|\bpower\b|\bmax\w*|flex\w*|beweglich\w*|elastiz\w*|sprungkraft|glanz\w*|gl\u00e4nz\w*|gloss\w*|\bshine\b|matt\w*|\bfinish\b|griff\w*|crunch|ausb\u00fcrst\w*|verkleb\w*|\bkleb\w*)/i;
const HOLD_NUMBER_RE = /(halt\w*\s*[:]?\s*\d|\d\s*\/\s*\d|hold[- ]?(faktor|level)|haltgrad|haltegrad|haltstufe|haltfaktor|glanzstufe|stufe\s*\d|\b\d\+\s*;|\b5\+)/i;
const FREEFROM_RE = /^(ohne\b|frei von|vegan|vegane|sulfatfrei|silikonfrei|parabenfrei|enthält keine|cruelty|peta|mikroplastik)/i;
const PROTECT_RE = /(hitzeschutz|heat[- ]protect|schutz vor hitze|schützt[^.;]{0,30}(hitze|föhn|stylen)|föhnschäd|bis zu\s*\d+\s*°|\d{3}\s*°\s*c|hitzeeinwirkung|vor der hitze|vor hitze)/i;
const ACTIVATE_RE = /(aktiviert|activated|wärmeaktiv|hitzeaktiv|verstärkt)/i;

function classifyHeat(text) {
  const heatWord = /(hitze|heat|f\u00f6hn|hei(\u00df|ss)e\w* ger\u00e4t|glatt\w*eisen|stylinggerat)/i.test(text);
  const protect = /(sch\u00fctz|schutz|protect|bewahr|prevent)/i.test(text);
  if ((heatWord && protect) || /\d{3}\s*(\u00b0|grad)/i.test(text) || /hitze-?schutz/i.test(text)) return "heat_protection";
  if (/(aktiv|activated|verst\u00e4rkt)/i.test(text) && heatWord) return "heat_activation";
  return "other";
}
// parenthetical source annotations ("(dm text)", "(pack front)", "(nicebeauty.com DE, C4)") are removed from packet text only
function packetText(t) {
  return String(t)
    .replace(/\s*\((?=[^)]*(?:\bpack\b|\bdm\b|dm\.at|dm-|douglas|flaconi|rossmann|retailer|amazon|codecheck|flie\u00dftext|alt-text|\bimage\b|\bC[1-5]\b|manufacturer|keshop|nicebeauty))[^)]*\)/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}
const RETAILER_MENTION_RE = /(dm text|\bdm\b|douglas|flaconi|rossmann|retailer|amazon|codecheck|nicebeauty|keshop)/i;
const PACKMANU_MENTION_RE = /(\bpack\b|manufacturer|hersteller|\.com\b)/i;
function sourceClass(tier) {
  return { C1: "pack", C2: "manufacturer_page", C2_house_brand: "own_brand_retailer_page", C2_cross_market_verified: "manufacturer_page_cross_market", C3: "retailer_page", C4: "other_retailer_or_database", C5: "non_DE_page" }[tier] || "unknown";
}

// ---------------------------------------------------------------------------------------------
// Directions cleaning (capture annotations are removed; text otherwise untouched)
// ---------------------------------------------------------------------------------------------
const META_SENTENCE_RE = /(round-?1|inferred|should not be used|Manufacturer text does NOT|^Not published|^Not printed|^Not stated|REAL DIRECTIONS|^No explicit|^Description:|^Sibling|Verwendungshinweise|^Not captured|^Page has no step|Hack:|from product description|pack photo shows)/i;
function cleanDirections(text) {
  if (text == null) return null;
  if (/^Not captured/i.test(String(text).trim())) return null;
  let t = String(text).replace(/REAL DIRECTIONS \([^)]*\):\s*/i, "");
  t = t.replace(/\s*\((?:[^)]*?(?:retailer|\bdm\b|dm\.at|easycosmetic|lookfantastic|flaconi|rossmann|Dry hair|roots|Roots|whole hair|damp OR|Damp|lengths|FAQ|Maria Nila|from product description|Flaconi)[^)]*)\)/g, "");
  const sentences = t.split(/(?<=[.!?])\s+/).filter((x) => x.trim().length);
  const kept = sentences.filter((x) => !META_SENTENCE_RE.test(x.trim()));
  const out = kept.join(" ").trim();
  return out.length ? out : null;
}

// ---------------------------------------------------------------------------------------------
// Directions masking for the F/U packet: brand, product name and strength/look words -> [CLAIM]
// ---------------------------------------------------------------------------------------------
const COMMON_TOKENS = new Set(["professional", "professionals", "naturkosmetik", "men", "paris", "and", "color", "wow", "american", "crew", "living", "proof", "jean", "len", "head", "kevin", "murphy", "maria", "nila"]);
const LOOK_RE = /\b(stark\w*|extra\w*|ultra\w*|power\w*|max\w*|mega|krass\w*|gl\u00e4nz\w*|glanz\w*|matt\w*|nat\u00fcrlich\w*|flexibl\w*|strong\w*|firm\w*|soft\w*|natural\w*|hold\w*)\b/gi;
// numeric heat-protection claim fragments inside directions are claims, not directions
const HEAT_CLAIM_IN_DIR_RE = /(mit )?(integriertem )?(hitzeschutz|heat protection)( up to| bis( zu)?)?\s*\d{2,3}\s*\u00b0?\s*C\b/gi;
// extra product-line words that identify a product inside its own directions
const EXTRA_MASK = {
  "syoss-hitzeschutzspray-keratin-heat": ["Keratin"],
  "garnier-fructis-locken-methode-feuchtigkeitsboost-pflege-spray": ["Shape Refresh Feuchtigkeitsboost", "Feuchtigkeitsboost"],
  "loreal-elvital-haaroel-oel-magique-alle-haartypen": ["\u00d6l Magique Haar\u00f6l"],
  "got2b-gotgloss-glanz-spray": ["gotGloss"],
  "garnier-fructis-sleek-and-stay-heat-activated-serum": ["Keratin Sleek", "Sleek & Stay Heat-Activated Serums", "Sleek & Stay Heat-Activated Serum"],
  "garnier-fructis-leave-in-spray-diamond-sleek-glaettungsspray": ["Diamond Sleek Shine-Coat Gl\u00e4ttungsspray", "Keratin Sleek"],
};
const GENERIC_NAME = new Set(["haar", "haargel", "spray", "gel", "lotion", "creme", "cream", "styling", "locken", "wellen", "volumen", "volume", "leave-in", "leave", "pump", "aerosol", "hair", "treatment", "balm", "serum", "puder", "powder", "paste", "wax", "pomade", "stick", "schaumfestiger", "mousse", "haarspray", "lockenspray", "trockenes", "texturspray", "texture", "finishing", "ansatz", "föhn", "foehn", "spray-gel", "definier", "refresh", "refresher", "mit", "und", "für", "der", "die", "das", "von", "halt", "feines", "feinem", "bart", "all", "one", "in", "pflege", "curl", "curls", "defining", "smooth", "glatt", "strand", "sleek", "lockencreme", "gliss"]);
function brandTokens(brand) {
  const phrase = String(brand).replace(/[()]/g, " ").replace(/[^A-Za-zÀ-ÿ0-9&.]+/g, " ").trim();
  const toks = phrase.toLowerCase().split(/[\s.&]+/).filter((t) => t.length >= 3 && !COMMON_TOKENS.has(t));
  return { phrase, toks: uniq(toks) };
}
function maskDirections(text, brand, productName, slug) {
  if (!text) return { text: null, masked_count: 0 };
  let s = text;
  let n = 0;
  const rep = () => {
    n++;
    return "[CLAIM]";
  };
  const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const { phrase, toks } = brandTokens(brand);
  if (phrase.length >= 4) s = s.replace(new RegExp("\\b" + esc(phrase) + "\\b", "gi"), rep);
  for (const t of toks) s = s.replace(new RegExp("\\b" + esc(t) + "\\w*", "gi"), rep);
  const nameClean = String(productName).replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
  if (nameClean.length >= 6) s = s.replace(new RegExp(esc(nameClean), "gi"), rep);
  for (const x of EXTRA_MASK[slug] || []) s = s.replace(new RegExp(esc(x), "gi"), rep);
  s = s.replace(HEAT_CLAIM_IN_DIR_RE, rep);
  s = s.replace(LOOK_RE, rep);
  // collapse runs of [CLAIM]
  s = s.replace(/(\[CLAIM\][\s\-\/&,]*){2,}/g, (m) => "[CLAIM]" + (/\s$/.test(m) ? " " : ""));
  return { text: s.replace(/\s+/g, " ").trim(), masked_count: n };
}
function leakCheck(maskedText, rec) {
  if (!maskedText) return [];
  const hits = [];
  const low = maskedText.toLowerCase();
  const { toks } = brandTokens(rec.identity.brand);
  for (const t of toks) if (low.includes(t)) hits.push("brand:" + t);
  const nameToks = norm(rec.identity.product_name).split(" ").filter((t) => t.length >= 5 && !GENERIC_NAME.has(t));
  for (const t of nameToks) if (new RegExp("\\b" + t, "i").test(low)) hits.push("name:" + t);
  return hits;
}

// ---------------------------------------------------------------------------------------------
// Tier derivation for records captured only in the round-1/gap-fill/unseen style
// ---------------------------------------------------------------------------------------------
function baseClaimTier(brand, claimTier, inciSourceTier, isNewStyle) {
  const house = HOUSE_BRAND_RE.test(brand);
  if (claimTier === "C2_house_brand") return { tier: "C2_house_brand", basis: "record claim_tier" };
  if (claimTier === "C2") return { tier: "C2", basis: "record claim_tier" };
  if (claimTier === "C1" && !isNewStyle) return { tier: "C1", basis: "record claim_tier" };
  if (isNewStyle && claimTier === "C1") {
    if (house) return { tier: "C2_house_brand", basis: "unseen/gap-fill claim_tier C1 is pack-only; non-pack lines of an own-brand product read as C2_house_brand" };
    return { tier: "C3", basis: "unseen/gap-fill claim_tier C1 is pack-only; non-pack lines of a third-party product are C3 retailer copy" };
  }
  if (claimTier == null) {
    if (house) return { tier: "C2_house_brand", basis: "DERIVED: claim_tier not stored in calibration-set-r2; own-brand rule (dm/Rossmann private label)" };
    if (inciSourceTier === "manufacturer") return { tier: "C2", basis: "DERIVED: claim_tier not stored in calibration-set-r2; round-1 capture was a manufacturer page" };
    return { tier: "C3", basis: "DERIVED: claim_tier not stored in calibration-set-r2; round-1 capture was a retailer page" };
  }
  return { tier: claimTier, basis: "record claim_tier" };
}

// ---------------------------------------------------------------------------------------------
// PH2-6 redaction of S0 promise lines: hold / finish / flexibility / duration words and hold numbers -> [CLAIM]
// (rest of the line verbatim; the unredacted line stays in cohort.json only)
// ---------------------------------------------------------------------------------------------
const REDACT_PATTERNS = [
  /halt\w*\s*[:]?\s*\d+(\s*\/\s*\d+)?\+?/gi, // hold numbers: Haltegrad 5, Halt 3/5
  /hold[- ]?(faktor|level)\s*\d+/gi,
  /\b\d\s*\/\s*\d\b|\b\d+\+/g,
  /(?:\b(?:bis zu|up to)\s+)?\b\d+\s*(?:h\b|std\.?|stunden|tage[n]?|days|hours|haarw\u00e4schen)\*?/gi, // duration numbers
  /\bbis zur n\u00e4chsten haarw\u00e4sche\b/gi,
  /\b(lang\s?anhaltend\w*|dauerhaft\w*|langzeit\w*|ganzen tag)\b/gi, // duration
  /\b(halt\w*|hold\w*|fixier\w*|fest\w*|st\u00e4rk\w*|stark\w*|extra\w*|ultra\w*|krass\w*|power\w*|max\w*|mega|griff\w*|strong\w*|firm\w*)\b/gi, // hold
  /\b(gl\u00e4nz\w*|glanz\w*|gloss\w*|shine\w*|shiny|matt\w*|finish\w*|nat\u00fcrlich\w*|natural\w*)\b/gi, // finish
  /\b(flexib\w*|beweglich\w*|elastiz\w*|sprungkraft\w*)\b/gi, // flexibility
];
function redactHff(text) {
  let n = 0;
  let t = String(text);
  for (const re of REDACT_PATTERNS) t = t.replace(re, () => (n++, "[CLAIM]"));
  t = t.replace(/(\[CLAIM\][\s\-\/&,+]*){2,}/g, (m) => "[CLAIM]" + (/\s$/.test(m) ? " " : ""));
  return { text: t.replace(/\s+/g, " ").trim(), count: n };
}
const RESIDUAL_HFF_RE = /\b(halt\w*|hold\w*|flexib\w*|stark\w*|glanz\w*|gl\u00e4nz\w*|matt\w*|fixier\w*|ultra\w*|extra\w*)/i;
const EN_WORDS_C1 = /\b(the|and|with|for|your|of|to|is|adds|refreshes|curls|defines|softens|moisturises|moisturizes|controls|frizz|hold|natural|hair|firm)\b/gi;
const DE_WORDS_C1 = /\b(und|mit|f\u00fcr|der|die|das|ein|eine|dein|deine|zu|von|bei|ohne|auf|nach)\b/gi;
function looksEnglish(t) {
  const en = (String(t).match(EN_WORDS_C1) || []).length;
  const de = (String(t).match(DE_WORDS_C1) || []).length;
  return en >= 2 && de === 0;
}
// unseen records: C1 promise lines from the pack text read from the dm-hosted photos
const SERIES_HEADERS = new Set(["professional performance"]);
function packPromiseLines(raw) {
  const txt = raw.pack_text_observed;
  if (!txt) return [];
  const quoted = [...String(txt).matchAll(/'([^']+)'/g)].map((m) => m[1]);
  const brandToks = String(raw.brand).toLowerCase().split(/[^a-z\u00e4\u00f6\u00fc0-9]+/).filter((x) => x.length >= 3);
  const nameToks = String(raw.product_name).replace(/\([^)]*\)/g, " ").toLowerCase().split(/[^a-z\u00e4\u00f6\u00fc0-9]+/).filter((x) => x.length >= 5);
  const boxStyle = /^Tube:/i.test(String(txt));
  const out = [];
  for (const q of quoted) {
    let parts = q.split(/\s*;\s*/);
    if (boxStyle) parts = parts.flatMap((x) => x.split(/\s*,\s*/)).flatMap((x) => x.split(/\s+-\s+/));
    parts.forEach((seg0, idx) => {
      const seg = seg0.replace(/^\s+|\s+$/g, "").replace(/\.$/, "");
      if (!seg) return;
      const low = seg.toLowerCase();
      if (/dot scale|punkteskala/i.test(seg)) return; // scale note, not wording
      if (SERIES_HEADERS.has(low)) return;
      if (FREEFROM_RE.test(seg) || /^dermatologisch/i.test(seg)) return;
      const hits = [...brandToks, ...nameToks].filter((t) => low.includes(t)).length;
      if (idx === 0 && hits >= 1) return; // header segment: brand and/or product name echo
      if (/^(finishing stick|styling finishing stick)$/i.test(seg)) return;
      out.push(seg);
    });
  }
  return uniq(out);
}

// ---------------------------------------------------------------------------------------------
// Directions status: "verbatim" only for unedited German capture text; everything else is a paraphrase
// (English summaries, composite "Pack:/Web:" strings, texts edited to remove capture annotations) or missing.
// ---------------------------------------------------------------------------------------------
const DIRECTIONS_MISSING = {
  "balea-styling-finishing-stick": "dm Verwendungshinweise: 'keine vorhanden'; capture holds only a paraphrase of the product description",
};
const DE_WORDS = /\b(und|auf|in|ins|das|die|den|dem|der|mit|nach|f\u00fcr|zu|bei|oder|aus|vor|dann|wie|nicht|haar|haare|haaren|sprühen|spr\u00fchen|einarbeiten|verteilen|gewohnt|stylen|f\u00f6hnen|handtuchtrockene\w*|feuchte\w*|trockene\w*|menge|schütteln|sch\u00fctteln|ausspülen|ausspülen)\b/gi;
const EN_WORDS = /\b(the|and|into|hair|with|apply|then|small|amount|from|dry|damp|wet|spray|for|your|rub|palms|work|style|blow|towel|only|page|text|use|used|on|of|or|to)\b/gi;
function directionsStatus(slug, originalText, cleanedText) {
  if (DIRECTIONS_MISSING[slug]) return { status: "missing", verbatim: false, note: DIRECTIONS_MISSING[slug] };
  if (!cleanedText) return { status: "missing", verbatim: false, note: "no directions text captured" };
  const de = (cleanedText.match(DE_WORDS) || []).length;
  const en = (cleanedText.match(EN_WORDS) || []).length;
  const edited = String(originalText).replace(/\s+/g, " ").trim() !== cleanedText;
  const composite = /(^|\s)(Pack|Web|Flaconi|US page|EN manufacturer|Only the|Manufacturer-DE)\b\s*:/i.test(cleanedText) || /\(pack:/i.test(cleanedText);
  if (de >= 4 && en <= 2 && !edited && !composite) return { status: "verbatim", verbatim: true, note: "German capture text, unedited (heuristic: language + no annotation removed; not re-checked against the source page)" };
  return { status: "paraphrase", verbatim: false, note: edited ? "capture text edited to remove capture annotations" : composite ? "composite of several sources" : "English or mixed-language capture summary" };
}

// ---------------------------------------------------------------------------------------------
// Assemble one cohort record
// ---------------------------------------------------------------------------------------------
function buildRecord(entry) {
  const { slug, kind } = entry; // kind: calibration | gapfill | unseen
  const isNew = kind !== "calibration";
  const raw = entry.raw;
  const calRec = entry.cal || null;
  const R = recapture[slug] || null;
  const Fr = !R && F[slug] ? F[slug] : null;
  const cap = R || Fr; // refreshed claim capture (recapture overrides F)
  const claimTierRec = calRec ? calRec.claim_tier : raw.claim_tier;
  const base = baseClaimTier(raw.brand, claimTierRec, raw.inci_source_tier, isNew);
  const capDate = isNew ? raw.capture_date : null;
  const rawSource = raw.inci_source_url || raw.price_source_url || null;

  // ---- identity
  const nameOv = NAME_OVERRIDES[slug];
  const nameCaptured = raw.product_name;
  const nameBase = nameOv ? nameOv.name : nameCaptured;
  const nameClean = nameBase.replace(/\s*\((?:[^)]*?(?:Rossmann|dm\.at|dm\.de|dm:|schwarzkopf\.de|pack:)[^)]*)\)/gi, "").replace(/\s+/g, " ").trim();
  const gtin = raw.ean || (R && null) || null;
  const identity = {
    brand: raw.brand,
    product_name: nameClean,
    product_name_as_captured: nameCaptured,
    name_override: nameOv ? nameOv.basis : null,
    name_variants: NAME_VARIANTS[slug] || [],
    gtin: gtin,
    dm_dan: raw.dm_dan != null ? raw.dm_dan : null,
    size: raw.size || null,
    format: raw.format,
    market_tier: raw.market_tier || null,
    identity_status: "as_captured",
  };

  // ---- INCI
  const DP = dpMap[slug] || null;
  const inciOverride = DP && DP.inci_current ? DP.inci_current : null;
  const inciText = inciOverride ? inciOverride.list : R ? R.inci_current : raw.inci;
  const ni = normaliseInci(inciText);
  let inciTier;
  let inciUrl;
  let inciDate;
  let inciSourceClass;
  let inciNote = null;
  if (inciOverride) {
    inciTier = inciOverride.tier;
    inciUrl = inciOverride.source_host;
    inciDate = inciOverride.date;
    inciSourceClass = sourceClass(inciTier);
    inciNote = "directions-promise-r3 inci_current (" + inciOverride.source_host + "); replaces the stale round-1 list";
  } else if (R) {
    const m = String(R.inci_source).match(/\((C\d(?:_[a-z_]+)?)[^)]*\)/);
    inciTier = m ? m[1] : null;
    const src = R.sources.find((s) => s.tier === inciTier) || R.sources[0];
    inciUrl = src.url;
    inciDate = src.retrieved;
    inciSourceClass = sourceClass(inciTier);
    inciNote = R.inci_source;
  } else {
    const house = HOUSE_BRAND_RE.test(raw.brand);
    if (raw.inci_source_tier === "manufacturer") inciTier = "C2";
    else if (raw.inci_source_tier === "ingredient_database") inciTier = "C4";
    else inciTier = house && (claimTierRec === "C2_house_brand" || claimTierRec === "C1") ? "C2_house_brand" : "C3";
    inciUrl = raw.inci_source_url;
    inciDate = capDate;
    inciSourceClass = raw.inci_source_tier;
    inciNote = raw.inci_corroboration || null;
  }
  identity.inci_raw = String(inciText).replace(/\s+/g, " ").trim();
  identity.inci_normalised = ni.items;
  identity.inci_item_count = ni.items.length;
  identity.inci_source = { tier: inciTier, source_class: inciSourceClass, url: inciUrl, date: inciDate, date_note: inciDate ? null : "round-1 capture date not stored in the sample file (calibration-set-r2 frozen 2026-10-09)", note: inciNote };
  identity.transcription_repairs = ni.repairs;
  identity.inci_flags = inciFlags(ni.items, slug);
  if (isNew && raw.inci_item_count && raw.inci_item_count !== ni.items.length) identity.inci_flags.push("capture_item_count_" + raw.inci_item_count + "_vs_split_" + ni.items.length);
  identity.inci_alt = null;
  if (R && R.inci_alt) {
    const altNi = normaliseInci(String(R.inci_alt).replace(/^(Round-1 list|OLD list)[^:]*:\s*/i, "").replace(/\s*\((?:Flaconi|German pack|dm\.de|dm\.at)[^)]*\)\s*$/i, ""));
    identity.inci_alt = { raw: R.inci_alt, inci_normalised: altNi.items, repairs: altNi.repairs };
    identity.identity_status = "inci_conflict";
  }
  if (STALE_INCI_UNRECAPTURED[slug]) {
    identity.identity_status = identity.identity_status === "inci_conflict" ? "inci_conflict" : "inci_stale_recapture_needed";
    identity.inci_flags.push("stale_inci_not_recaptured");
    identity.stale_inci_note = STALE_INCI_UNRECAPTURED[slug];
  }
  if (slug === "jean-und-len-sea-salt-spray") identity.inci_flags.push("pack_list_truncated_per_capture (dm text continues with further fragrance allergens)");
  if (slug === "balea-locken-revitalizing-spray") identity.inci_flags.push("possible_missing_separator: 'CITRONELLOL SODIUM CHLORIDE'; 'GLYERIN' / 'BETANE' typos kept as captured");
  if (slug === "cantu-lockencreme-kokos") identity.inci_flags.push("possible_split_item: 'SIMMONDSIA CHINENSIS (JOJOBA), SEED OIL' split across two ranks; 'VITAMNIN' typo kept as captured");

  // ---- directions
  let dText = null;
  let dOrig = null;
  let dTier = null;
  let dBasis = null;
  let dSrc = null;
  let dDate = null;
  if (R) {
    dOrig = R.directions_summary;
    dText = cleanDirections(R.directions_summary);
    dTier = R.directions_tier;
    dBasis = "recapture-r3 directions_summary";
    dDate = (R.sources[0] || {}).retrieved;
  } else if (Fr) {
    const c = cleanDirections(Fr.directions_summary);
    if (c) {
      dOrig = Fr.directions_summary;
      dText = c;
      dTier = Fr.directions_tier;
      dBasis = "F-file directions_summary (capture annotations removed)";
      dDate = (Fr.sources[0] || {}).retrieved;
    } else {
      dOrig = raw.directions;
      dText = cleanDirections(raw.directions);
      dTier = Fr.directions_tier;
      dBasis = "round-1 directions text (F-file summary was an annotation only); tier as stated in the F-file";
      dDate = null;
    }
  } else {
    dOrig = raw.directions;
    dText = cleanDirections(raw.directions);
    dTier = dText ? base.tier : null;
    dBasis = "raw capture directions (tier = record claim tier)";
    dDate = capDate;
  }
  dSrc = (cap && cap.sources && cap.sources[0] && cap.sources[0].url) || rawSource;
  let ds;
  let dHost = null;
  if (DP) {
    if (DP.directions_status === "verbatim" && DP.directions) {
      dText = DP.directions.verbatim;
      dTier = DP.directions.tier;
      dDate = DP.directions.date;
      dSrc = DP.directions.source_url || DP.directions.source_host;
      dHost = DP.directions.source_host;
      dBasis = "directions-promise-r3 verbatim directions";
      ds = { status: "verbatim", verbatim: true, note: "verbatim capture in directions-promise-r3 (" + DP.directions.source_host + ")" };
    } else {
      dText = null;
      dBasis = "directions-promise-r3: missing";
      ds = { status: "missing", verbatim: false, note: DP.notes || "directions-promise-r3: missing" };
    }
  } else ds = directionsStatus(slug, dOrig, dText);
  if (ds.status === "missing") dText = null;
  if (dText && /americancrew\.com/i.test(String(dSrc || dHost || ""))) dTier = "C5";
  const directions = { text: dText, directions_status: ds.status, directions_verbatim: ds.verbatim, status_note: ds.note, tier: dText ? dTier : null, source: dText ? dSrc : null, source_host: dText ? dHost || hostOf(dSrc) : null, date: dText ? dDate : null, basis: dBasis, language_note: "paraphrase texts are shipped as captured and are never labelled verbatim" };

  // ---- claims
  const claims = [];
  const withheldFromS0 = [];
  const add = (c) => claims.push(Object.assign({ number: null, scale_as_written: null, scale_max: null, scale_max_stated: null, words: null, tier_basis: null }, c));
  const capDateFor = (src) => (src && src.retrieved) || capDate || null;
  const capSrcFor = (tier) => {
    if (!cap || !cap.sources) return rawSource;
    const s = cap.sources.find((x) => x.tier === tier) || cap.sources[0];
    return s ? s.url : rawSource;
  };
  const capDateForTier = (tier) => {
    if (!cap || !cap.sources) return capDate;
    const s = cap.sources.find((x) => x.tier === tier) || cap.sources[0];
    return capDateFor(s);
  };
  const typedTexts = [];
  if (cap) {
    const bt = cap.best_tier;
    const rec = (type, rawText, tier0, extra) => {
      if (rawText == null || rawText === "") return;
      let tier = tier0;
      let downgraded = null;
      if (["duration", "humidity", "heat_protection", "heat_activation", "other"].includes(type) && RETAILER_MENTION_RE.test(rawText)) {
        if (!PACKMANU_MENTION_RE.test(rawText)) {
          if (isC12(tier)) downgraded = "annotation names a retailer source only: tier lowered from " + tier + " to C3";
          if (isC12(tier)) tier = "C3";
        } else downgraded = "mixed-source string (pack/manufacturer and retailer in one entry); record tier kept";
      }
      typedTexts.push(norm(rawText));
      add(Object.assign({ type, raw: rawText, tier, source: capSrcFor(tier), date: capDateForTier(tier), tier_basis: (tier === bt ? "best_tier of " : "per-field tier in ") + (R ? "recapture-r3" : cap._file) + (downgraded ? "; " + downgraded : "") }, extra || {}));
    };
    {
      // promise tier is not captured separately: a promise that contains the hold (or finish) wording takes that field's own tier, else best_tier
      const pr = cap.primary_promise_raw;
      let pt = bt;
      let pb = "record best_tier of " + (R ? "recapture-r3" : cap._file) + " (promise tier not captured separately)";
      if (pr && cap.hold && cap.hold.raw && cap.hold.tier && pr.includes(cap.hold.raw)) {
        pt = cap.hold.tier;
        pb = "promise contains the hold wording; takes hold.tier";
      } else if (pr && cap.finish && cap.finish.raw && cap.finish.tier && pr.includes(cap.finish.raw)) {
        pt = cap.finish.tier;
        pb = "promise contains the finish wording; takes finish.tier";
      }
      rec("promise", pr, pt, { tier_basis: pb });
    }
    const h = cap.hold || {};
    if (h.raw != null || h.words) {
      add({ type: "hold", raw: h.raw != null ? h.raw : null, tier: h.tier || bt, source: capSrcFor(h.tier || bt), date: capDateForTier(h.tier || bt), number: h.number != null ? h.number : null, scale_as_written: h.number != null ? h.raw : null, scale_max: h.scale_max != null ? h.scale_max : null, scale_max_stated: h.scale_max_stated != null ? h.scale_max_stated : null, words: h.words || null, tier_basis: "hold.tier in " + (R ? "recapture-r3" : cap._file), absence_statement: h.raw == null });
      if (h.raw) typedTexts.push(norm(h.raw));
    }
    for (const w of cap.flexibility_words || []) rec("flexibility", w, h.tier || bt, { tier_basis: "flexibility words carry no tier of their own; hold.tier (else best_tier)" });
    if (cap.finish && cap.finish.raw) {
      rec("finish", cap.finish.raw, cap.finish.tier || bt, { number: cap.finish.number != null ? cap.finish.number : null, tier_basis: "finish.tier" });
    }
    rec("duration", cap.duration_claim_raw, bt);
    rec("humidity", cap.humidity_claim_raw, bt);
    if (cap.heat_claim_raw) rec(classifyHeat(cap.heat_claim_raw), cap.heat_claim_raw, bt);
  }

  // raw-capture claims
  const rawIsPrimary = !cap;
  const baseT = base.tier;
  const tierForLine = (text) => {
    if (isNew && /^pack\s*:/i.test(text)) return { tier: "C1", basis: "'Pack:' line (pack photo read) in " + kind + "-r3 capture" };
    return { tier: baseT, basis: base.basis };
  };
  const rawDate = capDate;
  const pushRaw = (type, text, extra) => {
    if (text == null || text === "") return;
    const t = tierForLine(text);
    const clean = text.replace(/^pack\s*:\s*/i, "");
    typedTexts.push(norm(clean));
    add(Object.assign({ type, raw: clean, tier: t.tier, source: rawSource, date: rawDate, tier_basis: t.basis }, extra || {}));
  };
  if (rawIsPrimary) {
    if (HOLD_OVERRIDES[slug]) {
      for (const h of HOLD_OVERRIDES[slug]) {
        add({ type: "hold", raw: h.raw, tier: h.tier, source: rawSource, date: rawDate, number: h.number, scale_as_written: h.number != null ? h.raw : null, scale_max: h.scale_max, scale_max_stated: h.scale_max_stated, words: h.words, tier_basis: "owner-visible override table in freeze-cohort.js (mixed pack/retailer capture string split)" });
        typedTexts.push(norm(h.raw));
      }
    } else if (raw.hold_claim && (raw.hold_claim.raw != null || raw.hold_claim.words)) {
      const hc = raw.hold_claim;
      const t = tierForLine(String(hc.raw || hc.words));
      add({ type: "hold", raw: hc.raw != null ? hc.raw : null, tier: t.tier, source: rawSource, date: rawDate, number: hc.number != null ? hc.number : null, scale_as_written: hc.number != null ? hc.raw : null, scale_max: hc.scale_max != null ? hc.scale_max : null, scale_max_stated: hc.scale_max != null ? true : false, words: hc.words || null, tier_basis: t.basis, absence_statement: hc.raw == null });
      if (hc.raw) typedTexts.push(norm(hc.raw));
    }
    if (raw.finish_claim) pushRaw("finish", raw.finish_claim);
    if (raw.humidity_claim) pushRaw("humidity", raw.humidity_claim);
    if (raw.duration_claim) pushRaw("duration", raw.duration_claim);
    if (raw.heat_claim) pushRaw(classifyHeat(raw.heat_claim), raw.heat_claim);
  }
  // hair type / free-from always come from the raw capture (no refresh file carries them)
  for (const t of raw.hair_type_claims || []) {
    claims.push({ type: "hair_type", raw: t, tier: HOUSE_BRAND_RE.test(raw.brand) && !isNew ? "C2_house_brand" : base.tier === "C2_house_brand" ? "C2_house_brand" : cap ? "C3" : base.tier, source: rawSource, date: rawDate, number: null, scale_as_written: null, scale_max: null, scale_max_stated: null, words: null, tier_basis: cap ? "round-1 retailer capture (not refreshed by " + (R ? "recapture-r3" : "F-file") + ")" : base.basis });
  }
  for (const t of raw.free_from_claims || []) {
    claims.push({ type: "free_from", raw: t, tier: cap ? (HOUSE_BRAND_RE.test(raw.brand) ? "C2_house_brand" : "C3") : base.tier, source: rawSource, date: rawDate, number: null, scale_as_written: null, scale_max: null, scale_max_stated: null, words: null, tier_basis: cap ? "round-1 retailer capture (not refreshed)" : base.basis });
  }
  // remaining verbatim lines of raw-primary records
  if (rawIsPrimary) {
    const lines = [];
    for (const l of raw.claims_verbatim || []) {
      if (isNew && /^pack\s*:/i.test(l)) for (const seg of l.replace(/^pack\s*:\s*/i, "").split(/\s*;\s*/)) lines.push("Pack: " + seg);
      else lines.push(l);
    }
    for (const l of lines) {
      const n = norm(l.replace(/^pack\s*:\s*/i, ""));
      if (!n) continue;
      if (typedTexts.some((tt) => tt && (tt === n || (n.length >= 12 && (tt.includes(n) || n.includes(tt)))))) continue;
      const bare = l.replace(/^pack\s*:\s*/i, "");
      let type;
      if (FREEFROM_RE.test(bare)) type = "free_from";
      else if (HOLD_NUMBER_RE.test(bare)) type = "hold";
      else if (HFF_RE.test(bare)) type = "other_hff";
      else type = "promise";
      const t = tierForLine(l);
      const extra = type === "hold" ? { number: null, words: null, tier_basis: t.basis + "; numeric hold wording found in a free claim line" } : {};
      claims.push(Object.assign({ type: type === "other_hff" ? "other" : type, raw: bare, tier: t.tier, source: rawSource, date: rawDate, number: null, scale_as_written: null, scale_max: null, scale_max_stated: null, words: null, tier_basis: t.basis, hff: type === "other_hff" || undefined }, extra));
    }
  }
  // promise lines from directions-promise-r3 (any tier; only C1/C2 reach S0)
  if (DP) {
    for (const p of DP.promise_lines || []) {
      claims.push({ type: "promise", raw: p.raw, tier: p.tier, source: p.source_host, date: p.date, number: null, scale_as_written: null, scale_max: null, scale_max_stated: null, words: null, tier_basis: "directions-promise-r3 promise_lines (" + p.source_host + ")" });
    }
  }
  // unseen records: C1 promise lines derived from pack_text_observed (dm-hosted pack photos)
  if (kind === "unseen") {
    const have = new Set(claims.filter((c) => c.type === "promise").map((c) => norm(c.raw)));
    for (const t of packPromiseLines(raw)) {
      if (have.has(norm(t))) continue;
      claims.push({ type: "promise", raw: t, tier: "C1", source: rawSource, date: rawDate, number: null, scale_as_written: null, scale_max: null, scale_max_stated: null, words: null, tier_basis: "derived from pack_text_observed (pack text read from dm-hosted photos = C1)" });
    }
  }
  // host rules: americancrew.com/de is the US shop in German = C5
  for (const c of claims) {
    if (/americancrew\.com/i.test(String(c.source || "")) && c.tier !== "C5") {
      c.tier_basis = (c.tier_basis || "") + "; tier lowered from " + c.tier + " to C5 (americancrew.com/de is the US shop in German)";
      c.tier = "C5";
    }
  }
  // flags
  for (const c of claims) {
    if (c.tier === "C1" && looksEnglish(c.raw)) c.flags = uniq((c.flags || []).concat("non_german_wording"));
  }
  // fallback: a refreshed record without a primary promise line gets none (evidence gap), never a guess
  // stable order
  const typeOrder = ["promise", "hold", "flexibility", "finish", "duration", "humidity", "heat_protection", "heat_activation", "cast", "other", "hair_type", "free_from"];
  claims.sort((a, b) => typeOrder.indexOf(a.type) - typeOrder.indexOf(b.type));
  claims.forEach((c) => {
    if (c.hff === undefined) delete c.hff;
  });

  const role =
    entry.kind === "unseen"
      ? "unseen"
      : calRec && ["leave_in", "oil", "dry_shampoo", "heat_protectant"].includes(calRec.route)
      ? "negative_control"
      : "calibration";

  // retained history that the packets must not use
  const history = {};
  if (cap) {
    history.superseded_round1_claims = {
      claims_verbatim: raw.claims_verbatim || [],
      hold_claim: raw.hold_claim || null,
      finish_claim: raw.finish_claim || null,
      humidity_claim: raw.humidity_claim || null,
      heat_claim: raw.heat_claim || null,
    };
    if (R && R.inci_changed) history.round1_inci = raw.inci;
  }
  const dupInfo = entry.dups && entry.dups.length ? { duplicate_capture_files_ignored: entry.dups } : {};

  return {
    sample_id: entry.opaque,
    source_slug: slug,
    standard_version: STANDARD_VERSION,
    lexicon_version: LEXICON_VERSION,
    cohort_role: role,
    identity,
    directions,
    claims,
    capture_flags: CAPTURE_FLAGS[slug] || [],
    claim_capture: {
      refreshed_by: R ? "recapture-r3" : Fr ? Fr._file : null,
      record_best_tier: cap ? cap.best_tier : base.tier,
      record_tier_basis: cap ? "best_tier field" : base.basis,
      round1_old_tier: R ? R.old_tier : null,
      tier_note: R && R.tier_note ? R.tier_note : null,
      conflicts_with_round1: cap && cap.conflicts_with_round1 ? cap.conflicts_with_round1 : null,
    },
    reference_only_not_for_blind_lanes: {
      draft_subtype: calRec ? calRec.draft_subtype : raw.subtype_candidate,
      legacy_route: calRec ? calRec.route : null,
      round: calRec ? calRec.round : kind === "gapfill" ? 3 : 3,
      origin: kind,
    },
    history,
    ...dupInfo,
  };
}

// ---------------------------------------------------------------------------------------------
// Cohort membership
// ---------------------------------------------------------------------------------------------
const unseenDan = new Set(unseen.map((r) => r.dm_dan).filter((x) => x != null));
const unseenEan = new Set(unseen.map((r) => r.ean).filter((x) => x != null));
const unseenIds = new Set(unseen.map((r) => r.sample_id));
const entries = [];
const exclusions = [];
for (const c of cal) {
  if (EXCLUDED[c.sample_id]) {
    exclusions.push({ sample_id: c.sample_id, origin: "calibration-set-r2", reason: EXCLUDED[c.sample_id].reason, source: EXCLUDED[c.sample_id].source });
    continue;
  }
  const { raw, dups } = rawFor(c);
  entries.push({ slug: c.sample_id, kind: "calibration", raw, cal: c, dups });
}
for (const g of gapfill) {
  if ((g.dm_dan != null && unseenDan.has(g.dm_dan)) || (g.ean && unseenEan.has(g.ean)) || unseenIds.has(g.sample_id)) {
    const twin = unseen.find((u) => (g.dm_dan != null && u.dm_dan === g.dm_dan) || (g.ean && u.ean === g.ean) || u.sample_id === g.sample_id);
    exclusions.push({ sample_id: g.sample_id, origin: "gapfill-r3", reason: "Same product as unseen record '" + twin.sample_id + "' (" + DUPLICATE_OF_UNSEEN_RULE + "; dm DAN " + g.dm_dan + ", GTIN " + g.ean + "). Kept ONLY as unseen.", source: "v1.0/capture/gapfill-r3.json" });
    continue;
  }
  entries.push({ slug: g.sample_id, kind: "gapfill", raw: g, cal: null, dups: [] });
}
for (const u of unseen) entries.push({ slug: u.sample_id, kind: "unseen", raw: u, cal: null, dups: [] });

// opaque ids (deterministic, collision-checked)
const idSet = new Set();
for (const e of entries) {
  e.opaque = "sty-" + sha256(Buffer.from(ID_SALT + e.slug)).slice(0, 10);
  if (idSet.has(e.opaque)) throw new Error("opaque id collision " + e.opaque);
  idSet.add(e.opaque);
}
// duplicate-product guard across the whole cohort (GTIN / DAN)
{
  const seen = new Map();
  for (const e of entries) {
    for (const k of [e.raw.ean ? "ean:" + e.raw.ean : null, e.raw.dm_dan != null ? "dan:" + e.raw.dm_dan : null]) {
      if (!k) continue;
      if (seen.has(k) && seen.get(k) !== e.slug) exclusions.push({ sample_id: "(warning)", origin: "guard", reason: "duplicate " + k + ": " + seen.get(k) + " and " + e.slug, source: "freeze-cohort.js" });
      seen.set(k, e.slug);
    }
  }
}

const records = entries.map(buildRecord);
records.sort((a, b) => cmp(a.sample_id, b.sample_id));

// ---------------------------------------------------------------------------------------------
// Packets
// ---------------------------------------------------------------------------------------------
const NAME_STRENGTH_RE = /(halt\s*\d+\+?|\d\+?\s*halt|extra[- ]?stark\w*|ultra\w*|power\w*|max\.?\s*hold|maximal\w*|strong hold|extra hold|firm hold|stark\w*|krass\w*|mega|soft\b|leicht\w*|flex\w*|natural hold)/gi;
const TYPE_NOUNS = ["schaumfestiger", "haarspray", "lockenspray", "gel", "spray", "lotion", "creme", "cream", "balm", "balsam", "wax", "wachs", "paste", "pomade", "puder", "powder", "clay", "fiber", "serum", "stick", "mousse", "jelly", "brilliantine", "pflege-spray", "stylingcreme"];
function productTypeWord(name, format) {
  const toks = name.replace(/\([^)]*\)/g, " ").toLowerCase().split(/[^a-zäöüß-]+/).filter(Boolean);
  for (const t of toks) {
    for (const n of TYPE_NOUNS) if (t === n || t.endsWith(n)) return n;
  }
  return format;
}

function dirBlock(rec, text, masked) {
  const d = rec.directions;
  if (!text || d.directions_status === "missing") return null;
  const base = { tier: d.tier, source_class: sourceClass(d.tier), source_host: d.source_host || null, date: d.date };
  if (d.directions_verbatim) return Object.assign({ directions_verbatim: true, text }, base, masked ? { masked_with: "[CLAIM]" } : {});
  return Object.assign({ directions_verbatim: false, paraphrase_text: text }, base, masked ? { masked_with: "[CLAIM]" } : {});
}
const packets = { s0: [], fu: [], claims: [] };
const gaps = []; // products lacking C1/C2 promise
const promiseWithHff = [];
const redactedPromise = [];
const leakReport = [];
for (const rec of records) {
  const id = rec.sample_id;
  const inciBlock = { inci_item_count: rec.identity.inci_normalised.length, tier: rec.identity.inci_source.tier, source_class: sourceClass(rec.identity.inci_source.tier), date: rec.identity.inci_source.date, items: rec.identity.inci_normalised.map((x) => ({ rank: x.rank, inci: x.inci })) };

  // S0 packet
  const promiseClaims = [];
  for (const c of rec.claims) {
    if (c.type !== "promise" || !isC12(c.tier)) continue;
    // raw-primary fallback lines: hold/finish/flexibility wording withheld; refreshed primary promise lines stay verbatim
    const red = redactHff(packetText(c.raw));
    if (red.count) redactedPromise.push({ slug: rec.source_slug, n: red.count });
    c.s0_redacted_text = red.text;
    promiseClaims.push(Object.assign({ text: red.text, redacted: red.count > 0, tier: c.tier, source_class: sourceClass(c.tier), date: c.date }, c.flags ? { flags: c.flags } : {}));
  }
  const heatClaims = rec.claims.filter((c) => c.type === "heat_protection" && isC12(c.tier)).map((c) => ({ text: packetText(c.raw), tier: c.tier, source_class: sourceClass(c.tier), date: c.date }));
  if (!promiseClaims.length) gaps.push({ sample_id: id, slug: rec.source_slug, role: rec.cohort_role, best_tier: rec.claim_capture.record_best_tier });
  if (promiseClaims.some((p) => RESIDUAL_HFF_RE.test(p.text) || HOLD_NUMBER_RE.test(p.text))) promiseWithHff.push(rec.source_slug + ": " + promiseClaims.map((p) => p.text).join(" | "));
  const s0 = {
    packet: "s0",
    packet_version: COHORT_VERSION,
    sample_id: id,
    product: { confirmed_name: rec.identity.product_name, brand: rec.identity.brand, format: rec.identity.format },
    inci: inciBlock,
    directions_status: rec.directions.directions_status,
    directions: dirBlock(rec, rec.directions.text),
    promise_claims_c1_c2: promiseClaims,
    heat_protection_claims_c1_c2: heatClaims,
  };
  if (INCLUDE_ALT_INCI_IN_S0 && rec.identity.inci_alt) {
    s0.identity_status = "inci_conflict";
    s0.inci_alt = { items: rec.identity.inci_alt.inci_normalised.map((x) => ({ rank: x.rank, inci: x.inci })), note: "second capture of the same GTIN with a different list; the list in 'inci' is the one read from the newer/higher-tier source" };
  }
  packets.s0.push({ id, body: s0 });

  // F/U packet
  const masked = maskDirections(rec.directions.text, rec.identity.brand, rec.identity.product_name, rec.source_slug);
  const fu = {
    packet: "fu",
    packet_version: COHORT_VERSION,
    sample_id: id,
    format: rec.identity.format,
    inci: inciBlock,
    directions_status: rec.directions.directions_status,
    directions: dirBlock(rec, masked.text, true),
  };
  const leaks = leakCheck(masked.text, rec);
  if (leaks.length) leakReport.push({ slug: rec.source_slug, text: masked.text, hits: leaks });
  packets.fu.push({ id, body: fu });

  // claims packet
  const nameWords = uniq((rec.identity.product_name.match(NAME_STRENGTH_RE) || []).map((x) => x.trim()));
  const nameTier = rec.claim_capture.record_best_tier;
  const cl = [];
  for (const c of rec.claims) {
    if (c.type === "free_from" || c.type === "hair_type") continue;
    if (c.type === "other" && !(HFF_RE.test(c.raw) || HOLD_NUMBER_RE.test(c.raw))) continue;
    const o = { type: c.type, text: packetText(c.raw), tier: c.tier, source_class: sourceClass(c.tier), source_host: hostOf(c.source), date: c.date };
    if (c.type === "hold") {
      o.number = c.number;
      o.scale_as_written = c.scale_as_written;
      o.scale_max = c.scale_max;
      o.scale_max_stated = c.scale_max_stated;
      o.words = c.words;
      if (c.absence_statement) o.absence_statement = true;
    }
    cl.push(o);
  }
  for (const w of nameWords) cl.push({ type: "hold", text: w, tier: nameTier, source_class: "product_name", source_host: null, date: null, from_product_name: true, number: /\d/.test(w) ? parseInt((w.match(/\d+/) || [])[0], 10) : null, scale_as_written: /\d/.test(w) ? w : null, scale_max: null, scale_max_stated: false, words: null, tier_basis: "name tier = record best_tier (name confirmation not captured separately)" });
  const scaleHold = cl.find((x) => x.type === "hold" && x.number != null && !x.from_product_name) || cl.find((x) => x.type === "hold" && x.number != null) || null;
  const cp = {
    packet: "claims",
    packet_version: COHORT_VERSION,
    sample_id: id,
    brand: rec.identity.brand,
    format: rec.identity.format,
    product_type_word: productTypeWord(rec.identity.product_name, rec.identity.format),
    scale_info: scaleHold ? { number: scaleHold.number, scale_as_written: scaleHold.scale_as_written, scale_max: scaleHold.scale_max, scale_max_stated: scaleHold.scale_max_stated, tier: scaleHold.tier } : null,
    claims: cl,
  };
  packets.claims.push({ id, body: cp });
}

// ---------------------------------------------------------------------------------------------
// cohort.json
// ---------------------------------------------------------------------------------------------
const count = (arr, f) => arr.reduce((m, x) => ((m[f(x)] = (m[f(x)] || 0) + 1), m), {});
const sortKeys = (o) => Object.fromEntries(Object.entries(o).sort((a, b) => cmp(a[0], b[0])));
const counts = {
  total: records.length,
  by_role: sortKeys(count(records, (r) => r.cohort_role)),
  by_origin: sortKeys(count(records, (r) => r.reference_only_not_for_blind_lanes.origin)),
  by_draft_subtype: sortKeys(count(records, (r) => r.reference_only_not_for_blind_lanes.draft_subtype)),
  by_identity_status: sortKeys(count(records, (r) => r.identity.identity_status)),
};
const cohort = {
  cohort_version: COHORT_VERSION,
  frozen_on: FREEZE_DATE,
  standard_version: STANDARD_VERSION,
  lexicon_version: LEXICON_VERSION,
  purpose: "Frozen Phase-3 calibration cohort. REFERENCE INPUT ONLY: never give this file to a blind lane (it maps opaque ids to slugs and carries legacy labels).",
  counts,
  exclusions,
  inputs: INPUT_FILES.map((f) => ({ path: f, sha256: sha256(fs.readFileSync(path.join(BASE, f))) })),
  records,
};

// ---------------------------------------------------------------------------------------------
// Write outputs
// ---------------------------------------------------------------------------------------------
const out = (rel) => path.join(V1, rel);
const ser = (o) => JSON.stringify(o, null, 2) + "\n";
for (const d of ["packets/s0", "packets/fu", "packets/claims"]) {
  fs.rmSync(out(d), { recursive: true, force: true });
  fs.mkdirSync(out(d), { recursive: true });
}
const written = [];
const writeOut = (rel, text) => {
  fs.writeFileSync(out(rel), text);
  written.push(rel);
};
writeOut("cohort.json", ser(cohort));
for (const kind of ["s0", "fu", "claims"]) for (const p of packets[kind].slice().sort((a, b) => cmp(a.id, b.id))) writeOut("packets/" + kind + "/" + p.id + ".json", ser(p.body));

// FREEZE-NOTES.md
const fmtCounts = (o) => Object.entries(o).map(([k, v]) => "| " + k + " | " + v + " |").join("\n");
const fieldList = (obj, prefix) => {
  const lines = [];
  for (const [k, v] of Object.entries(obj)) {
    lines.push("- `" + prefix + k + "`");
    if (v && typeof v === "object" && !Array.isArray(v)) lines.push(...fieldList(v, prefix + k + ".").map((x) => x));
    else if (Array.isArray(v) && v.length && typeof v[0] === "object") lines.push(...fieldList(v[0], prefix + k + "[].").map((x) => x));
  }
  return lines;
};
const sample = (kind, pick) => packets[kind].find((p) => pick(p.body)).body;
const s0Sample = (() => {
  const full = packets.s0.map((p) => p.body).find((b) => b.promise_claims_c1_c2.length && b.heat_protection_claims_c1_c2.length && b.directions) || packets.s0[0].body;
  const alt = packets.s0.map((p) => p.body).find((b) => b.inci_alt) || {};
  return Object.assign({}, full, alt.inci_alt ? { identity_status: alt.identity_status, inci_alt: alt.inci_alt } : {});
})();
const fuSample = packets.fu.find((p) => p.body.directions).body;
const clSample = packets.claims.find((p) => p.body.claims.some((c) => c.type === "hold" && c.number != null) && p.body.claims.some((c) => c.from_product_name)) ? packets.claims.find((p) => p.body.claims.some((c) => c.type === "hold" && c.number != null) && p.body.claims.some((c) => c.from_product_name)).body : packets.claims[0].body;
const bySlug = Object.fromEntries(records.map((r) => [r.source_slug, r]));
const invConflict = records.filter((r) => r.identity.identity_status === "inci_conflict");
const stale = records.filter((r) => r.identity.identity_status === "inci_stale_recapture_needed");
const lacking = gaps.map((g) => g).sort((a, b) => cmp(a.slug, b.slug));
const derivedTier = records.filter((r) => /DERIVED/.test(r.claim_capture.record_tier_basis));
const dirNull = records.filter((r) => r.directions.directions_status === "missing");
const dirPara = records.filter((r) => r.directions.directions_status === "paraphrase");
const dirVerb = records.filter((r) => r.directions.directions_status === "verbatim");
const dupCap = records.filter((r) => r.duplicate_capture_files_ignored);
const negControls = records.filter((r) => r.cohort_role === "negative_control").map((r) => r.source_slug).sort();
const unseenList = records.filter((r) => r.cohort_role === "unseen").map((r) => r.source_slug).sort();

const incompleteFlag = (r) => r.identity.inci_flags.some((f) => /^(pack_list_truncated|possible_missing_separator|possible_split_item|stale_inci)/.test(f));
const readiness = (() => {
  const s0 = Object.fromEntries(packets.s0.map((p) => [p.id, p.body]));
  const rows = records.map((r) => {
    const b = s0[r.sample_id];
    return { r, promise: b.promise_claims_c1_c2.length > 0, dir: b.directions_status === "verbatim", inci: !incompleteFlag(r) && r.identity.identity_status !== "inci_stale_recapture_needed" };
  });
  const all3 = rows.filter((x) => x.promise && x.dir && x.inci);
  return {
    promise: rows.filter((x) => x.promise).length,
    dir: rows.filter((x) => x.dir).length,
    inci: rows.filter((x) => x.inci).length,
    all3: all3.length,
    all3_conflict: all3.filter((x) => x.r.identity.identity_status === "inci_conflict").length,
    all3_by_role: sortKeys(count(all3, (x) => x.r.cohort_role)),
    not_ready: rows.filter((x) => !(x.promise && x.dir && x.inci)).map((x) => "`" + x.r.source_slug + "` (" + [x.promise ? null : "no C1/C2 promise", x.dir ? null : "directions " + x.r.directions.directions_status, x.inci ? null : "INCI incomplete"].filter(Boolean).join(", ") + ")").sort(),
  };
})();
const notes = `# FREEZE-NOTES - Styling Phase-3 calibration cohort (${COHORT_VERSION})

Generated by \`build/freeze-cohort.js\` on ${FREEZE_DATE} (deterministic; re-run to reproduce every hash in \`artifact-manifest.json\`). Standard \`${STANDARD_VERSION}\`, lexicon \`${LEXICON_VERSION}\`. Nothing here is committed or locked.

## 1. Counts

| Metric | Value |
|---|---|
| Records in cohort | ${counts.total} |

By cohort role:

| Role | n |
|---|---|
${fmtCounts(counts.by_role)}

By origin:

| Origin | n |
|---|---|
${fmtCounts(counts.by_origin)}

By draft subtype (\`draft_subtype\` of calibration-set-r2, \`subtype_candidate\` for gap-fill and unseen; reference only, never shown to a lane):

| Draft subtype | n |
|---|---|
${fmtCounts(counts.by_draft_subtype)}

By identity status:

| Status | n |
|---|---|
${fmtCounts(counts.by_identity_status)}

Arithmetic: 90 calibration records - ${exclusions.filter((e) => e.origin === "calibration-set-r2").length} excluded + (12 gap-fill - ${exclusions.filter((e) => e.origin === "gapfill-r3").length} excluded) + 8 unseen = ${counts.total}.

Negative controls (${negControls.length}; derived from the legacy calibration route being leave_in, oil, dry_shampoo or heat_protectant; the 5 \`provisional_boundary\` records stay \`calibration\`): ${negControls.map((x) => "\`" + x + "\`").join(", ")}.

Unseen (${unseenList.length}): ${unseenList.map((x) => "\`" + x + "\`").join(", ")}.

## 2. Exclusions

${exclusions.map((e) => "- \`" + e.sample_id + "\` (" + e.origin + "): " + e.reason).join("\n")}

## 3. Identity conflicts and capture defects

Two lists under one GTIN (\`identity_status: inci_conflict\`; both lists kept in \`cohort.json\`, \`identity.inci_alt\`). The list in the packets' \`inci\` is the recapture-r3 \`inci_current\`:

${invConflict.map((r) => "- \`" + r.source_slug + "\` (current list tier " + r.identity.inci_source.tier + ")").join("\n")}

${INCLUDE_ALT_INCI_IN_S0 ? "S0 packets of these products also carry \`identity_status\` and \`inci_alt\` (switch \`INCLUDE_ALT_INCI_IN_S0\` in the script; standard 2.2 A2 needs the conflict to be visible in S0). F/U and claims packets carry the current list only." : "S0 packets carry the current list only."}

**Stale INCI:** ${stale.length ? stale.map((r) => "\`" + r.source_slug + "\`").join(", ") : "none left. syoss-curl-cream-gel-3in1, syoss-professional-performance-max-hold-power-wax and got2b-styling-mattpaste-strand-matte take the current syoss.de / got2b.de list (C2, 2026-10-12) from directions-promise-r3 and carry no stale flag; the round-1 lists are kept under \`history.round1_inci\`-less raw captures only. john-frieda-volume-lift-ansatz-booster is excluded (section 2)."}

Mechanical INCI repairs are listed per record in \`identity.transcription_repairs\` (trailing periods, bullet separators, footnote text, backslash aliases). Typos and probable missing separators were NOT repaired; they are flagged in \`identity.inci_flags\`: \`balea-locken-revitalizing-spray\` (CITRONELLOL SODIUM CHLORIDE, GLYERIN, BETANE), \`cantu-lockencreme-kokos\` (JOJOBA / SEED OIL split, VITAMNIN), \`jean-und-len-sea-salt-spray\` (pack list truncated; dm list longer).

Duplicate captures of the same id in two round-1 lane files (the lane named by the calibration record is used; the other is kept as \`duplicate_capture_files_ignored\`): ${dupCap.map((r) => "\`" + r.source_slug + "\` (" + r.duplicate_capture_files_ignored.join(", ") + ")").join("; ")}. \`alcina-foehn-lotion\` differs in EAN and page URL between its two captures (4008666108265 vs 4008666114396).

## 4. Products lacking a C1/C2 promise (evidence gate)

${lacking.length} of ${counts.total} S0 packets carry an empty \`promise_claims_c1_c2\` (only the confirmed name and INCI/directions can drive S0 for them):

${lacking.map((g) => "- \`" + g.slug + "\` (" + g.role + "; record best tier " + g.best_tier + ")").join("\n")}

### 4a. Evidence-gate readiness of the S0 packets

| Criterion | S0 packets |
|---|---|
| C1/C2 promise line present (after redaction) | ${readiness.promise} of ${counts.total} |
| \`directions_status: verbatim\` | ${readiness.dir} of ${counts.total} |
| Complete INCI (no truncation / missing-separator / split-item flag, not stale) | ${readiness.inci} of ${counts.total} |
| **All three** | **${readiness.all3} of ${counts.total}** (${Object.entries(readiness.all3_by_role).map(([k, v]) => v + " " + k).join(", ")}; ${readiness.all3_conflict} of them carry an inci_conflict) |

Not ready (${readiness.not_ready.length}): ${readiness.not_ready.join("; ")}.

## 5. Packet field lists (exact)

All packets: one JSON file per product, \`<opaque sample_id>.json\`, \`sample_id\` = \`sty-\` + 10 hex of SHA-256(salt + source slug). The slug-to-id map exists only in \`cohort.json\`. No URLs appear in any packet (URL slugs carry names and hold words); only \`source_class\` (pack, manufacturer_page, own_brand_retailer_page, retailer_page, other_retailer_or_database, non_DE_page), tier and date.

### 5.1 S0 packet (\`packets/s0/\`), PH2-6

${fieldList(s0Sample, "").join("\n")}

Contents: confirmed name (retailer-annotation parentheticals such as "(Rossmann: ...)" removed; three explicit rename overrides, see 6), brand, format; complete INCI as ordered items with capture tier and date; the directions text with tier; **only C1/C2 (incl. C2_house_brand) promise and heat-protection claims**. **Not included:** any route, subtype, hold level, hold/finish/flexibility/duration/humidity fields, retailer chips, prices, round notes, flags, free-from and hair-type claims, formula observations, URLs. Heat-activation statements are not in S0 (permitted crossing only after unblinding).

### 5.2 F/U packet (\`packets/fu/\`), property set 7

${fieldList(fuSample, "").join("\n")}

Contents: format, INCI (items, tier, date), directions with brand tokens, the confirmed product name and strength/look words (stark*, extra*, ultra*, power*, max*, krass*, glanz*, matt*, natuerlich*, flexibl*, strong, firm, soft, natural, hold) replaced by \`[CLAIM]\`. **Not included:** brand, name, any claims, any S0 output. The lane's own S0 output is attached at run time as a separate envelope (not part of the frozen file). Format is included because the property set 7 / standard 10.2 list it for the F/U packet. Residual-leak check (brand tokens and name tokens of 5+ letters in the masked text) is run by the script: ${leakReport.length ? leakReport.length + " hit(s), see section 7." : "no hits."}

### 5.3 Claims packet (\`packets/claims/\`), two independent hold normalisations

${fieldList(clSample, "").join("\n")}

Contents: brand, format, a form noun taken from the name (\`product_type_word\`), every captured promise, hold, flexibility, finish, duration, humidity and heat claim with tier, source class, host and date; hold entries carry number, scale as written, scale max and whether the max was stated on the source; strength words found in the product name are added as hold claims with \`from_product_name: true\`. Lines of type \`other\` are kept only if they contain hold/finish/flexibility wording. **Not included:** INCI, full product name, directions, free-from and hair-type claims, prior hold levels or labels, round notes. Free-text scale ladders (e.g. Taft gel scale 4 to 14, Elnett ladder) are NOT in the packet; they live in the normalisation tables of the standard.

## 6. Decisions the script made that the owner may want to change

1. **PH2-6 redaction applied.** In every S0 promise line, hold / finish / flexibility / duration words and hold numbers are replaced by \`[CLAIM]\` (rest verbatim, adjacent markers collapsed); the unredacted line and the redacted form (\`s0_redacted_text\`) are in cohort.json only. ${redactedPromise.length} S0 packets contain at least one redacted promise line (${redactedPromise.reduce((a, b) => a + b.n, 0)} replacements). Residual hold/finish wording after redaction (review list): ${promiseWithHff.length ? promiseWithHff.map((x) => "\`" + x + "\`").join("; ") : "none"}. For round-1-style records with no designated promise line, the script derives promise lines from free claim lines and withholds every line with hold/finish/flexibility wording or numbers. Unseen records get C1 promise lines from \`pack_text_observed\` (header/brand/name echoes, scale notes and free-from words removed); no other new data was added to unseen records.
2. **Tier of the promise** = record \`best_tier\` of the recapture or F-file (a per-field promise tier was not captured). Hold and finish use their own recorded tiers; flexibility words use the hold tier. Records without a refresh file take the calibration \`claim_tier\`; ${derivedTier.length} records had no stored \`claim_tier\` and were DERIVED (own-brand rule, manufacturer page, else retailer): ${derivedTier.map((r) => "\`" + r.source_slug + "\` (" + r.claim_capture.record_best_tier + ")").join(", ")}.
3. **Round-1 retailer claims are superseded** where a recapture or F-file exists (kept under \`history\`); hair-type and free-from claims always come from the round-1 capture at C3 (C2_house_brand for own-brand products).
4. **Unseen and gap-fill claim lines:** a \`Pack:\` line is C1; other lines are C2_house_brand for own-brand products, C2 when the record is a manufacturer-page capture, else C3. Hold strings that mix pack and retailer text were split by hand in the \`HOLD_OVERRIDES\` table (got2b Spruehkleber, Taft Forming Paste, Redken Beach Spray).
5. **Name overrides** (current unit on sale): Cantu "Firm Hold Edge Stay Gel", Syoss "Curl Cream Gel", Syoss "Max Hold Wax". Other manufacturer-name variants are kept in \`identity.name_variants\` only.
6. **Directions status** (coordinator rule: paraphrase is never presented as verbatim). ${records.filter((r) => /^directions-promise-r3/.test(r.directions.basis)).length} records take verbatim German directions (or \`missing\`) from \`capture/directions-promise-r3.json\`; the 8 unseen records and nothing else keep the earlier capture with the heuristic below. Each S0 and F/U packet carries \`directions_status\` = \`verbatim\` | \`paraphrase\` | \`missing\`. \`verbatim\` (${dirVerb.length}) = German capture text that needed no editing; this is a language heuristic, the text was not re-checked against the source page. \`paraphrase\` (${dirPara.length}) = English or mixed-language capture summaries, composites of several sources (\"Pack:/Web:\") and texts from which capture annotations had to be removed; the packet block is \`{directions_verbatim:false, paraphrase_text, tier, ...}\`. \`missing\` (${dirNull.length}) = no directions in the packet (\`directions: null\`): ${dirNull.map((r) => "\`" + r.source_slug + "\`").join(", ") || "none"} (the Balea Styling Finishing Stick: dm states no directions exist; the capture paraphrase is withheld). Tiers are those of the underlying source. \`inci.inci_item_count\` in every packet is computed by the script from the split list; capture-file counts are never copied (mismatches with capture counts are flagged in \`identity.inci_flags\`).
7. **No lexicon ids.** \`inci_normalised\` carries rank and name as written (mechanically cleaned); lexicon normalisation (\`lexicon_id\`) belongs to the blind lanes and the lexicon, not to the freeze.
9. **Tier rules and flags (coordinator, 2026-10-12).** americancrew.com/de is the US shop in German: every claim, direction and INCI source on that host is C5 (\`american-crew-fiber\`, \`american-crew-pomade\`; both therefore have no C1/C2 promise). English-language pack text on products sold in Germany stays C1 with flag \`non_german_wording\` (${records.flatMap((r) => r.claims.filter((c) => (c.flags || []).includes("non_german_wording")).map(() => r.source_slug)).filter((x, i, a) => a.indexOf(x) === i).map((x) => "\`" + x + "\`").join(", ")}). neqi-hair.com stays C2 with record flag \`chf_pricing\` (\`neqi-diamond-glass-ultimate-styling-spray\`). C3/C5 promise lines from directions-promise-r3 are recorded in cohort.json only (e.g. \`american-crew-fiber\`).
8. **Date of round-1 captures** is not stored in the sample files; round-1 fields carry \`date: null\`. Calibration-set-r2 was frozen 2026-10-09; F-file retrievals are 2026-10-09; recapture, gap-fill and unseen captures are 2026-10-11.

## 7. Residual-leak report for F/U directions

${leakReport.length ? leakReport.map((l) => "- \`" + l.slug + "\`: " + l.hits.join(", ") + " in \"" + l.text + "\"").join("\n") : "No brand or name token survives in any masked F/U directions text."}

## 8. Reproduction

\`node data/research/styling-inci/v1.0/build/freeze-cohort.js\` rewrites \`cohort.json\`, \`packets/**\`, \`artifact-manifest.json\` and this file; two consecutive runs give byte-identical output. The manifest also records the SHA-256 of every input file and of the script.
`;
writeOut("FREEZE-NOTES.md", notes);

// artifact-manifest.json
const manifest = {
  manifest_version: COHORT_VERSION,
  frozen_on: FREEZE_DATE,
  algorithm: "sha256",
  script: { path: "build/freeze-cohort.js", sha256: sha256(fs.readFileSync(__filename)) },
  inputs: cohort.inputs,
  counts: { packets_s0: packets.s0.length, packets_fu: packets.fu.length, packets_claims: packets.claims.length, cohort_records: records.length },
  artifacts: written
    .filter((r) => r === "cohort.json" || r === "FREEZE-NOTES.md" || r.startsWith("packets/"))
    .sort(cmp)
    .map((r) => ({ path: r, sha256: sha256(fs.readFileSync(out(r))) })),
};
fs.writeFileSync(out("artifact-manifest.json"), ser(manifest));
const rootHash = sha256(Buffer.from(manifest.artifacts.map((a) => a.path + ":" + a.sha256).join("\n")));
console.log(JSON.stringify({ records: records.length, by_role: counts.by_role, excluded: exclusions.map((e) => e.sample_id), packet_sets: manifest.counts, manifest_root_sha256: rootHash, manifest_file_sha256: sha256(fs.readFileSync(out("artifact-manifest.json"))), leak_hits: leakReport.length, lacking_promise: gaps.length }, null, 2));
