#!/usr/bin/env node
// Styling research engine - round-3 cohort freeze (standard v0.3 amended 2026-10-12 R2-H1...R2-H6, lexicon v0.3).
//   node data/research/styling-inci/v1.0/build/freeze-cohort-r3.js
// Rebuilds the 139 round-2 records by running build/freeze-cohort-r2.js unchanged inside a sandbox whose
// file writes go to memory (the round-2 outputs on disk are compared byte-for-byte and never written; the
// round-2 script itself rebuilds round 1 the same way), applies the round-2 packet issues P2-1...P2-6, the
// owner rulings R2-H1...R2-H6 and the re-check capture (capture/recheck-r6.json), freezes the 4 products of
// capture/round3-smoothing-r5.json, and writes everything under v1.0/r3/ only: cohort.json,
// packets/{s0,fu,claims}/, artifact-manifest.json, FREEZE-NOTES.md. Deterministic: no clock, no randomness,
// sorted iteration. It never reads v1.0/sealed/ and never classifies (no route, subtype or hold level).
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const V1 = path.resolve(__dirname, "..");
const BASE = path.resolve(V1, "..");
const OUT = path.join(V1, "r3");
const R2_SCRIPT = path.join(__dirname, "freeze-cohort-r2.js");
const R2_OUT = path.join(V1, "r2");
const FREEZE_DATE = "2026-10-12";
const COHORT_VERSION = "styling-inci-v1.0-cohort-3";
const STANDARD_VERSION = "styling-inci-v0.3";
const LEXICON_VERSION = "styling-lexicon-v0.3";
const ID_SALT = "styling-inci-v1.0-cohort-3/opaque-id/"; // new salt: no round-3 id may equal a round-1 or round-2 id
const R5_NEW = "v1.0/capture/round3-smoothing-r5.json";
const R6_RECHECK = "v1.0/capture/recheck-r6.json";

// ---------------------------------------------------------------------------------------------
// Round 2 (and through it round 1), rebuilt from its own inputs inside a sandbox (reuse, not duplication)
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
const ctx = vm.createContext({ require: (m) => (m === "fs" ? sandboxFs : require(m)), __dirname: path.dirname(R2_SCRIPT), __filename: R2_SCRIPT, console: { log: () => {} }, Buffer });
vm.runInContext(fs.readFileSync(R2_SCRIPT, "utf8"), ctx, { filename: R2_SCRIPT });
const R2 = (name) => vm.runInContext(name, ctx);
const round2Check = { files: 0, identical: 0, differing: [] };
for (const k of [...mem.keys()].sort()) {
  if (!k.startsWith(R2_OUT + path.sep)) continue;
  round2Check.files++;
  if (fs.existsSync(k) && fs.readFileSync(k).equals(mem.get(k))) round2Check.identical++;
  else round2Check.differing.push(path.relative(V1, k));
}
if (round2Check.differing.length || !round2Check.files) throw new Error("round-2 rebuild differs from round-2 outputs on disk: " + round2Check.differing.join(", "));

const sha256 = R2("sha256");
const normaliseInci = R2("normaliseInci");
const packetText = R2("packetText");
const maskDirections = R2("maskDirections");
const leakCheck = R2("leakCheck");
const sourceClass = R2("sourceClass");
const isC12 = R2("isC12");
const productTypeWord = R2("productTypeWord");
const dirBlock = R2("dirBlock");
const fieldList = R2("fieldList");
const HFF_RE = R2("HFF_RE");
const HOLD_NUMBER_RE = R2("HOLD_NUMBER_RE");
const buildNew = R2("buildNew");
const cleanClaims = R2("cleanClaims");
const addNameClaims = R2("addNameClaims");
const nameTable = R2("nameTable");
const isProductNoun = R2("isProductNoun");
const mk = R2("mk");
const srcHost = R2("srcHost");
const redactS0R2 = R2("redactS0");
const INCOMPLETE_FLAG_RE = R2("INCOMPLETE_FLAG_RE");
const CLAIMS_LEAK_RE = R2("CLAIMS_LEAK_RE");
const ANY_LEAK_RE = R2("ANY_LEAK_RE");
const FORBIDDEN_KEYS = R2("FORBIDDEN_KEYS");
const R1_IDS = new Set(R2("R1_IDS"));
const R2_INPUTS = JSON.parse(JSON.stringify(R2("INPUTS")));
const R2_EXCLUSIONS = JSON.parse(JSON.stringify(R2("exclusions")));
const r2Records = JSON.parse(JSON.stringify(R2("records")));
const R2_IDS = new Set(r2Records.map((r) => r.sample_id));
const R2_ID_BY_SLUG = Object.fromEntries(r2Records.map((r) => [r.source_slug, r.sample_id]));
const R1_ID_BY_SLUG = Object.fromEntries(r2Records.map((r) => [r.source_slug, (r.history.round2 && r.history.round2.round1_sample_id) || null]));
const r2Disk = JSON.parse(fs.readFileSync(path.join(R2_OUT, "cohort.json"), "utf8"));
if (JSON.stringify(r2Disk.records) !== JSON.stringify(r2Records)) throw new Error("round-2 in-memory records differ from r2/cohort.json");
// F/U masking table of round 1 (extended in round 2); round 3 adds the new product-line words below
const EXTRA_MASK = R2("R1")("EXTRA_MASK");
const R3_EXTRA_MASK = { "got2b-anti-frizz-lotion-schmusekatze": ["Schmusekatze"], "kms-thermashape-straightening-creme": ["Thermashape"], "kms-thermashape-2-in-1-spray": ["Thermashape"] };
for (const [k, v] of Object.entries(R3_EXTRA_MASK)) {
  if (EXTRA_MASK[k]) throw new Error("EXTRA_MASK already has " + k);
  EXTRA_MASK[k] = v;
}

const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(BASE, rel), "utf8"));
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const uniq = (a) => [...new Set(a)];
const clone = (o) => JSON.parse(JSON.stringify(o));
const sortKeys = (o) => Object.fromEntries(Object.entries(o).sort((a, b) => cmp(a[0], b[0])));
const count = (arr, f) => arr.reduce((m, x) => ((m[f(x)] = (m[f(x)] || 0) + 1), m), {});
const r5 = readJson(R5_NEW);
const r6 = readJson(R6_RECHECK);
const r6Used = new Set();
const r6Row = (slug, field, pick) => {
  const hits = r6.map((x, i) => [x, i]).filter(([x]) => x.slug === slug && x.field === field && (!pick || pick(x)));
  if (hits.length !== 1) throw new Error("recheck-r6 row not unique: " + slug + " " + field + " (" + hits.length + ")");
  r6Used.add(hits[0][1]);
  return hits[0][0];
};
const patchLog = [];
const logPatch = (id, slug, status, detail) => patchLog.push({ id, slug, status, detail });
const notApplied = []; // capture data available but outside the brief

// ---------------------------------------------------------------------------------------------
// Base: the 139 round-2 records
// ---------------------------------------------------------------------------------------------
const bySlug = {};
for (const r of r2Records) {
  r.history = r.history || {};
  r.history.round3 = { round2_sample_id: r.sample_id, round2_role: r.cohort_role, round2_standard_version: r.standard_version, round2_lexicon_version: r.lexicon_version };
  if (r.cohort_role === "unseen") {
    r.cohort_role = "calibration";
    r.history.round3.role_note = "round-2 unseen slot; becomes calibration in round 3 (no new unseen slots this round)";
  }
  // stale round-2 packet derivations are recomputed below
  delete r.s0_redacted_name;
  delete r.s0_redacted_directions;
  delete r.evidence_gate_inputs;
  for (const c of r.claims) delete c.s0_redacted_text;
  bySlug[r.source_slug] = r;
}
const R = (slug) => {
  if (!bySlug[slug]) throw new Error("round-2 record missing: " + slug);
  return bySlug[slug];
};
const note = (o, k, txt) => (o[k] = (o[k] ? o[k] + " || " : "") + txt);
const listKey = (items) => items.map((x) => String(x.inci).toLowerCase().replace(/\s+/g, " ").trim());
const sameList = (a, b) => JSON.stringify(listKey(a)) === JSON.stringify(listKey(b));

// ---------------------------------------------------------------------------------------------
// P2-2: got2b gotGloss - lists differ only after Parfum (fragrance/allergen block) => not a set conflict
// ---------------------------------------------------------------------------------------------
{
  const r = R("got2b-gotgloss-glanz-spray");
  const cur = listKey(r.identity.inci_normalised);
  const alt = listKey(r.identity.inci_alt.inci_normalised);
  const pc = cur.findIndex((x) => /^parfum/.test(x));
  const pa = alt.findIndex((x) => /^parfum/.test(x));
  if (pc < 0 || pc !== pa || JSON.stringify(cur.slice(0, pc + 1)) !== JSON.stringify(alt.slice(0, pa + 1))) throw new Error("P2-2 precondition: lists differ above Parfum");
  const onlyCur = cur.slice(pc + 1).filter((x) => !alt.includes(x));
  const onlyAlt = alt.slice(pa + 1).filter((x) => !cur.includes(x));
  const reason = "P2-2: the two captures are identical through Parfum (r" + (pc + 1) + "); they differ only inside the fragrance/allergen block after it (only in the got2b.de list: " + (onlyCur.join(", ") || "none") + "; only in the pack/dm list: " + (onlyAlt.join(", ") || "none") + "), which LI §2.4.2 does not count as a set conflict";
  r.identity.identity_status = "verified_with_minor_source_difference";
  r.identity.review_flags = uniq((r.identity.review_flags || []).concat(["formula_or_identity_conflict"]));
  r.identity.inci_alt.status = "demoted_capture (P2-2)";
  r.identity.p2_2_reason = reason;
  r.identity.s0_identity_note = "two captures of this product differ only in the fragrance/allergen block after Parfum; the list in 'inci' is the formula of record (not a set conflict)";
  logPatch("P2-2", r.source_slug, "applied", "inci_conflict flag removed: identity_status verified_with_minor_source_difference, review formula_or_identity_conflict, second list kept as demoted inci_alt; reason recorded (" + reason.replace(/^P2-2: /, "") + ")");
}

// ---------------------------------------------------------------------------------------------
// P2-5: Balea Haargel Hair Jelly - a hold entry's words come only from its own raw
// ---------------------------------------------------------------------------------------------
{
  const r = R("balea-haargel-hair-jelly");
  const h = r.claims.filter((c) => c.type === "hold");
  if (h.length !== 1 || h[0].raw !== "flexiblen Halt") throw new Error("P2-5 precondition");
  const before = h[0].words;
  h[0].words_as_captured = before;
  h[0].words = h[0].raw;
  note(h[0], "capture_note", "P2-5: words '" + before + "' replaced by the words of its own raw; 'soft' has no claim line and no provenance (no dm 'Halt' attribute captured) and is dropped");
  r.claim_capture.dropped_values = (r.claim_capture.dropped_values || []).concat([{ type: "hold.words", value: "soft", reason: "P2-5: no captured claim line carries it" }]);
  logPatch("P2-5", r.source_slug, "applied", "hold claim 'flexiblen Halt': words '" + before + "' -> '" + h[0].words + "' (from its own raw); uncaptured value 'soft' dropped and logged under claim_capture.dropped_values; no claim line for 'soft' added");
}

// ---------------------------------------------------------------------------------------------
// P2-6 + R2-H1 + R2-H6 + recheck-r6: re-stamp claims by host
// ---------------------------------------------------------------------------------------------
const cohortTextOf = (row) => {
  const m = String(row.note || "").match(/Cohort text: "([^"]*)"/);
  if (!m) throw new Error("no cohort text in recheck row " + row.slug + " " + row.field);
  return m[1];
};
// Wella EIMI Fresh Up (R2-H1)
{
  const slug = "wella-eimi-nutricurls-fresh-up";
  const r = R(slug);
  const rows = r6.map((x, i) => [x, i]).filter(([x]) => x.slug === slug && /Cohort text:/.test(x.note || ""));
  if (rows.length !== 6) throw new Error("Wella recheck rows: " + rows.length);
  const done = [];
  for (const [row, i] of rows) {
    r6Used.add(i);
    const ct = cohortTextOf(row);
    const c = r.claims.find((x) => x.raw === ct && /lookfantastic/.test(String(x.source)));
    if (!c) throw new Error("Wella claim not found: " + ct);
    if (row.tier !== "C2" || !/wella\.com\/professional\/de-DE/.test(row.source_url)) throw new Error("Wella row not a de-DE C2 row");
    if (c.raw !== row.value_verbatim) c.raw_as_captured = c.raw;
    c.raw = row.value_verbatim;
    c.source_as_captured = c.source;
    c.source = row.source_url;
    c.tier = "C2";
    c.date = row.capture_date;
    c.tier_basis = "recheck-r6 (P2-6, R2-H1, R2-H6): found on wella.com/professional/de-DE (German manufacturer page); previously stamped C2 from lookfantastic.de (a retailer)";
    if (c.type === "other" && /^Frische deine Locken auf/.test(c.raw)) {
      c.type = "promise";
      delete c.hff;
      note(c, "capture_note", "recheck-r6: typed 'promise' (the page intro / 'Produkt Details' promise line, recheck row 'promise_line_intro'); round 2 typed it 'other'");
      done.push("intro line re-typed other -> promise");
    }
    done.push("'" + (c.raw_as_captured || c.raw) + "'" + (c.raw_as_captured ? " -> '" + c.raw + "'" : "") + " (" + c.type + ")");
  }
  r6Row(slug, "promise_line_intro");
  // item-1 rows repeat the item-6 rows; checked for consistency
  for (const f of ["promise_line_benefit_1", "promise_line_benefit_2", "hold", "hair_type"]) {
    const row = r6Row(slug, f, (x) => x.item === 1);
    if (!r.claims.some((c) => c.raw === row.value_verbatim && c.tier === "C2")) throw new Error("Wella item-1 row not in claims: " + f);
  }
  if (r6Row(slug, "directions").value_verbatim !== r.directions.text) throw new Error("Wella directions differ from the German page");
  r6Row(slug, "care_line_text");
  r6Row(slug, "detangling_wording");
  if (r.claims.some((x) => /lookfantastic/.test(String(x.source)) && isC12(x.tier))) throw new Error("Wella: lookfantastic claim left at C1/C2");
  // confirmed name: the retailer title is not the product's name (R2-H1)
  const pack = r6Row(slug, "pack_front_lines");
  const page = r6Row(slug, "german_page_identity");
  r.identity.name_variants = uniq(r.identity.name_variants.concat(["retailer title (lookfantastic.de, C3): EIMI Nutricurls Fresh Up (Curl Refreshing Detangling Spray)", "wella.com/professional/de-DE (C2): EIMI Fresh Up"]));
  r.identity.product_name = "EIMI Nutricurls Fresh Up";
  r.identity.name_override = "recheck-r6 / R2-H1: confirmed name from the pack front ('FRESH UP 72H / NUTRICURLS / EIMI', " + pack.tier + ") and wella.com DE ('EIMI Fresh Up', " + page.tier + "); 'Curl Refreshing Detangling Spray' is retailer copy (C3) and no longer part of the confirmed name";
  r.identity.name_tier = { tier: pack.tier, source: pack.source_url, date: pack.capture_date };
  notApplied.push("`" + slug + "`: the pack-front line „72h Anti-Frizz Spray\" and the 1-of-4 hold dots (C1, manufacturer packshot) were not added as claims (not in the brief; the C2 „Haltegrad 1\" stands)");
  // INCI page error (R2-H1, standard 2.2 A10)
  const wrong = r6Row(slug, "inci_as_printed_on_wella_de_page");
  const retail = r6Row(slug, "inci_as_printed_retailer");
  if (!sameList(normaliseInci(retail.value_verbatim).items, r.identity.inci_normalised)) throw new Error("Wella retailer INCI differs from the cohort list");
  r.identity.inci_page_error = { tier: wrong.tier, source: wrong.source_url, date: wrong.capture_date, list_as_printed: wrong.value_verbatim, item_count: normaliseInci(wrong.value_verbatim).items.length, ruling: "R2-H1", note: "the list printed on the manufacturer's German page is another product's (wax/pomade architecture: Ceresin, Petrolatum, Carnauba, Mineral Oil, iron oxides; no jojoba, no wheat bran) and contradicts the page's own formula text; recorded as a page error, not as a T18 capture" };
  r.identity.inci_source.note = "R2-H1: formula of record = the retailer list (identical on beautyflash.co.uk), which matches Wella's own formula text (wheat bran extract, jojoba oil); review formula_source_page_error until a pack INCI is captured";
  r.identity.review_flags = uniq((r.identity.review_flags || []).concat(["formula_source_page_error"]));
  r.identity.inci_flags = uniq(r.identity.inci_flags.concat(["formula_source_page_error: the manufacturer's German page prints another product's INCI (wax/pomade list) under a formula text naming wheat bran extract and jojoba oil; this list (retailer capture, matching that text) is the formula of record until a pack INCI is captured"]));
  // hair type wording (R2-H1 re-source changed it)
  logPatch("P2-6 / R2-H1", slug, "applied", "6 claims re-sourced from lookfantastic.de to wella.com/professional/de-DE (C2): " + done.join("; ") + "; confirmed name 'EIMI Nutricurls Fresh Up' (retailer title kept as a name variant, so 'Detangling' is no longer in the S0 name); INCI = retailer list (formula of record), Wella-page list recorded as identity.inci_page_error, review formula_source_page_error, non-blocking inci_flag shipped in S0");
}
// Redken One United (R2-H6)
{
  const slug = "redken-one-united-all-in-one-multi-benefit-treatment";
  const r = R(slug);
  const rows = r6.map((x, i) => [x, i]).filter(([x]) => x.slug === slug && /Cohort text:/.test(x.note || ""));
  const out = [];
  for (const [row, i] of rows) {
    r6Used.add(i);
    const ct = cohortTextOf(row);
    const c = r.claims.find((x) => x.raw === ct && /redken\.co\.uk/.test(String(x.source)));
    if (!c) throw new Error("Redken claim not found: " + ct);
    const already = row.value_verbatim && r.claims.some((x) => x !== c && x.type === c.type && isC12(x.tier) && /redken\.eu/.test(String(x.source)) && String(x.raw).includes(row.value_verbatim));
    if (row.value_verbatim && !already) {
      c.raw_as_captured = c.raw;
      c.raw = row.value_verbatim;
      c.source_as_captured = c.source;
      c.source = row.source_url;
      c.tier = "C2";
      c.date = row.capture_date;
      c.tier_basis = "recheck-r6 (P2-6, R2-H6): the German wording is on redken.eu/de-de (German manufacturer page) => C2 with that source; the round-2 text was a translation of the redken.co.uk list";
      out.push("'" + c.raw_as_captured + "' -> C2 '" + c.raw + "'");
    } else {
      c.tier = "C5";
      c.tier_basis = "recheck-r6 (P2-6, R2-H6): redken.co.uk is a UK English page => C5; " + (already ? "its German wording is already captured in the redken.eu line" : "not found on redken.eu/de-de");
      out.push("'" + c.raw + "' -> C5");
    }
  }
  for (const c of r.claims) if (/redken\.co\.uk/.test(String(c.source)) && c.tier !== "C5") throw new Error("Redken: redken.co.uk claim not re-stamped: " + c.raw);
  const inci = r6Row(slug, "inci");
  if (!sameList(normaliseInci(inci.value_verbatim).items, r.identity.inci_normalised)) throw new Error("Redken redken.eu INCI differs");
  r.identity.inci_source = Object.assign({}, r.identity.inci_source, { tier: "C2", source_class: "manufacturer_page", url: inci.source_url, date: inci.capture_date, note: "recheck-r6 (P2-6, R2-H6): identical list (same order) on redken.eu/de-de; previously sourced to redken.co.uk" });
  logPatch("P2-6 / R2-H6", slug, "applied", "redken.co.uk claims re-stamped (" + out.join("; ") + "); INCI re-sourced to redken.eu/de-de (C2, identical list)");
}
// Kevin Murphy (R2-H6: German-language storefront for the German market => C2)
for (const slug of ["kevin-murphy-killer-curls", "kevin-murphy-powder-puff-volume"]) {
  const r = R(slug);
  const row = r6Row(slug, slug === "kevin-murphy-killer-curls" ? "promise_hold_flexibility" : "promise_hold_duration");
  let n = 0;
  for (const c of r.claims) {
    if (!/kevinmurphy\.com\.au\/de\/de/.test(String(c.source))) continue;
    if (c.tier !== "C2") throw new Error("KM claim not C2");
    note(c, "tier_basis", "R2-H6: kevinmurphy.com.au/de/de is the manufacturer's German-language storefront for the German market (kevinmurphy.de redirects there) => C2 confirmed");
    n++;
  }
  note(r.identity.inci_source, "note", "R2-H6: German-market storefront => C2 confirmed");
  r.claim_capture.tier_note = "R2-H6 (2026-10-12): C2 confirmed - the manufacturer's German-language storefront for the German market, whatever its domain ending, when the brand's .de domain points to it (" + row.capture_date + " re-check: kevinmurphy.de redirects to kevinmurphy.com.au/de/de)";
  logPatch("R2-H6", slug, "applied", n + " claims and the INCI keep C2 (kevinmurphy.com.au/de/de confirmed as the German-market storefront); tier_basis notes added");
}
// EVO (R2-H6: US English page => C5)
{
  const slug = "evo-head-mistress-cuticle-sealer";
  const r = R(slug);
  r6Row(slug, "all_claims_and_inci");
  let n = 0;
  for (const c of r.claims) {
    if (!/evohair\.com\/us/.test(String(c.source))) continue;
    c.tier = "C5";
    c.tier_basis = "recheck-r6 (R2-H6): evohair.com/us is a US English page => C5; no German page found (evohair.de 403, not bypassed)";
    n++;
  }
  r.identity.inci_source = Object.assign({}, r.identity.inci_source, { tier: "C5", source_class: "non_DE_page", note: "recheck-r6 (R2-H6): US English page => C5" });
  r.claim_capture.record_best_tier = "C5";
  r.claim_capture.record_tier_basis = "R2-H6: every claim comes from evohair.com/us (C5)";
  logPatch("R2-H6", slug, "applied", n + " claims and the INCI re-stamped C2 -> C5 (evohair.com/us); the record now has no C1/C2 promise (it already had no directions)");
}
// NEQI All hair_type sources (P2-6 part)
{
  const slug = "neqi-diamond-glass-styling-spray-all";
  const r = R(slug);
  const row = r6Row(slug, "hair_type_x5");
  r6Row(slug, "manufacturer_ideal_fuer");
  const parts = row.value_verbatim.split(/\s*\|\s*/);
  let n = 0;
  for (const c of r.claims) {
    if (c.type !== "hair_type" || !/products\.dm\.de/.test(String(c.source))) continue;
    if (!parts.includes(c.raw)) throw new Error("NEQI hair_type text not on the manufacturer page: " + c.raw);
    c.source_as_captured = c.source;
    c.source = row.source_url;
    c.tier = "C2";
    c.tier_basis = "recheck-r6 (P2-6): the line is on neqi-hair.com ('Ideal für:', German manufacturer page), not on dm";
    n++;
  }
  if (n !== 5) throw new Error("NEQI hair_type count " + n);
  logPatch("P2-6", slug, "applied", n + " hair_type claims re-sourced from products.dm.de to neqi-hair.com (C2)");
}
// Wella EIMI Flowing Form INCI source URL
{
  const slug = "wella-professionals-eimi-flowing-form";
  const r = R(slug);
  const row = r6Row(slug, "inci");
  if (!sameList(normaliseInci(row.value_verbatim).items, r.identity.inci_normalised)) throw new Error("Flowing Form de-DE INCI differs");
  r.identity.inci_source = Object.assign({}, r.identity.inci_source, { url: row.source_url, date: row.capture_date, note: "recheck-r6: identical list on the de-DE page; source changed from the en-SE page" });
  logPatch("P2-6", slug, "applied", "INCI source URL en-SE -> de-DE (identical list, tier C2 unchanged)");
}

// ---------------------------------------------------------------------------------------------
// recheck-r6 data: GUHL 3in1, Balea Haarwachs Styling Stick, NEQI All, Balea Pro Traumlocken
// ---------------------------------------------------------------------------------------------
{
  const slug = "guhl-locken-pflege-und-styling-3in1";
  const r = R(slug);
  const d = r6Row(slug, "pack_back_directions");
  r6Row(slug, "dm_verwendungshinweise");
  r.history.round3.removed_directions = r.directions.text;
  r.directions = { text: d.value_verbatim, directions_status: "verbatim", directions_verbatim: true, status_note: "recheck-r6: pack back, read by eye (" + d.capture_date + "); identical wording on dm Verwendungshinweise; replaces the round-2 paraphrase", tier: d.tier, source: d.source_url, source_host: srcHost(d.source_url), date: d.capture_date, basis: "recheck-r6 pack_back_directions", language_note: r.directions.language_note };
  const added = [];
  for (const f of ["pack_front_headline", "pack_front_badge"]) {
    const row = r6Row(slug, f);
    r.claims.push(mk({ type: "promise", raw: row.value_verbatim, tier: row.tier, source: row.source_url, date: row.capture_date, tier_basis: "recheck-r6 " + f + ": pack front, dm pack photo read by eye" }));
    added.push("'" + row.value_verbatim + "'");
  }
  for (const f of ["pack_front_tagline", "pack_front_use_band", "pack_front_claim_band", "pack_front_active", "pack_front_free_from", "pack_back_lead", "pack_back_bullets", "pack_back_promise_box", "inci_pack", "guhl_de_product_name", "guhl_de_uses_sentence", "guhl_de_category_shelving", "guhl_de_leave_in_remark", "dm_product_name", "dm_breadcrumb", "dm_bullets"]) r6Row(slug, f);
  r.claim_capture.capture_facts = (r.claim_capture.capture_facts || []).concat(["recheck-r6 (R2-H2): guhl.com shelves the product under 'Spülungen, Kuren & Seren'; guhl.com: 'Der Halt entsteht dabei durch Pflege, nicht durch Fixierung.'; pack front band order Lockencreme, Kur, Spülung; pack back directions order Spülung, Kur, Lockencreme"]);
  logPatch("recheck-r6 / R2-H2", slug, "applied", "directions = verbatim pack back text (C1), replacing the paraphrase (old text under history.round3.removed_directions); pack-front lines " + added.join(", ") + " added as C1 promise lines; shelving facts recorded as capture facts");
  notApplied.push("`" + slug + "`: confirmed name left as the dm title (guhl.com C2 name „Locken Pflege & Styling 3in1 Lockencreme, Kur & Spülung\" available); INCI tier left C3 (the pack and guhl.com carry the identical list); pack-back bullets and the guhl.com sentences were used as capture facts only");
}
{
  const slug = "balea-haarwachs-styling-stick";
  const r = R(slug);
  const nameRow = r6Row(slug, "pack_front_name");
  const bullets = r6Row(slug, "pack_front_bullets");
  const badge = r6Row(slug, "pack_front_badge");
  const back = r6Row(slug, "pack_back_headline");
  const dirs = r6Row(slug, "pack_back_directions");
  const inci = r6Row(slug, "inci_pack");
  for (const f of ["pack_back_other", "dm_product_name", "dm_breadcrumb", "dm_bullets", "dm_description", "hold_statement"]) r6Row(slug, f);
  // name (R2-H3)
  r.identity.name_variants = uniq(r.identity.name_variants.concat(["dm title (C2_house_brand): " + r.identity.product_name]));
  r.identity.product_name = nameRow.value_verbatim;
  r.identity.name_override = "recheck-r6 / R2-H3: confirmed name = the pack-front name '" + nameRow.value_verbatim + "' (C1); the dm title is kept as a name variant";
  r.identity.name_tier = { tier: nameRow.tier, source: nameRow.source_url, date: nameRow.capture_date };
  // pack lines
  const lines = bullets.value_verbatim.split(/\s*·\s*/).map((x) => x.trim()).filter(Boolean).concat([badge.value_verbatim, back.value_verbatim]);
  const srcOf = (t) => (t === back.value_verbatim ? back : t === badge.value_verbatim ? badge : bullets);
  for (const t of lines) r.claims.push(mk({ type: "promise", raw: t, tier: srcOf(t).tier, source: srcOf(t).source_url, date: srcOf(t).capture_date, tier_basis: "recheck-r6 " + srcOf(t).field + ": pack, dm pack photo read by eye" }));
  // directions: same text, now from the pack
  if (r.directions.text !== dirs.value_verbatim) throw new Error("stick directions differ from pack");
  r.directions = Object.assign({}, r.directions, { tier: dirs.tier, source: dirs.source_url, source_host: srcHost(dirs.source_url), date: dirs.capture_date, status_note: "recheck-r6: pack back ANWENDUNG, identical to the dm Verwendungshinweise", basis: "recheck-r6 pack_back_directions" });
  // INCI: the 14-item pack list
  const ni = normaliseInci(inci.value_verbatim);
  const repairs = ni.repairs.slice();
  for (const it of ni.items) {
    if (/^HYRDOGENATED /.test(it.inci)) {
      it.inci = it.inci.replace(/^HYRDOGENATED /, "HYDROGENATED ");
      repairs.push("pack typo 'HYRDOGENATED RAPESEED OIL' read as 'HYDROGENATED RAPESEED OIL' (as_written kept; letters transposed on the pack, spelling unverified; lexicon v0.3 §0.4 item 4)");
    }
  }
  r.identity.inci_superseded = { raw: r.identity.inci_raw, items: r.identity.inci_normalised.map((x) => ({ rank: x.rank, inci: x.inci })), source: r.identity.inci_source, reason: "R2-H3 / recheck-r6: replaced by the 14-item pack list (the dm text has 12 items and places Persea Gratissima Oil after Parfum)" };
  r.identity.inci_raw = inci.value_verbatim;
  r.identity.inci_normalised = ni.items;
  r.identity.inci_item_count = ni.items.length;
  r.identity.inci_source = { tier: inci.tier, source_class: "pack", url: inci.source_url, date: inci.capture_date, date_note: null, note: "recheck-r6: pack back label (dm pack photo), read by eye" };
  r.identity.transcription_repairs = uniq(repairs);
  r.identity.inci_flags = uniq(r.identity.inci_flags.concat(["typo_as_printed: 'HYRDOGENATED RAPESEED OIL' (rank 7) read as Hydrogenated Rapeseed Oil"]));
  if (ni.items.length !== 14) throw new Error("stick pack INCI count " + ni.items.length);
  r.claim_capture.capture_facts = (r.claim_capture.capture_facts || []).concat(["recheck-r6: no hold statement ('Halt', 'Haltegrad' or a level) on the pack or dm; the fixing words are 'einfache Fixierung' / 'schnelle und einfache Fixierung' (pack) and 'abstehende Härchen zu fixieren' (directions)", "recheck-r6: dm breadcrumb Haare > Haarstyling > Haarwachs"]);
  logPatch("recheck-r6 / R2-H3", slug, "applied", "confirmed name '" + nameRow.value_verbatim + "' (C1 pack front; dm title kept as variant); C1 pack lines added: " + lines.map((x) => "'" + x + "'").join(", ") + "; directions re-sourced to the pack (C1, same text); INCI replaced by the 14-item pack list (C1; dm 12-item list kept under identity.inci_superseded; 'HYRDOGENATED' repaired, as_written kept)");
  notApplied.push("`" + slug + "`: pack back „HAUTVERTRÄGLICHKEIT Dermatologisch bestätigt | HINWEIS Den Wax Stick unter 25 °C lagern\" not added (no promise)");
}
{
  const slug = "neqi-diamond-glass-styling-spray-all";
  const r = R(slug);
  const man = r6Row(slug, "inci_manufacturer_page");
  const dm = r6Row(slug, "inci_dm");
  r6Row(slug, "inci_pack");
  r6Row(slug, "preservative_declared");
  r6Row(slug, "manufacturer_product_type");
  r6Row(slug, "pack_front");
  const manList = normaliseInci(man.value_verbatim.replace(/^Alle Inhaltsstoffe:\s*/, "")).items;
  if (!sameList(manList, r.identity.inci_normalised) || !sameList(normaliseInci(dm.value_verbatim).items, r.identity.inci_normalised)) throw new Error("NEQI INCI lists differ");
  const before = r.identity.inci_flags.slice();
  r.identity.inci_flags = r.identity.inci_flags.filter((f) => !/^list_possibly_truncated/.test(f));
  if (r.identity.inci_flags.length !== before.length - 1) throw new Error("NEQI truncation flag not found");
  r.identity.withdrawn_inci_flags = before.filter((f) => /^list_possibly_truncated/.test(f)).map((f) => ({ flag: f, withdrawn_by: "R2-H4", reason: "the list is complete: neqi-hair.com (C2) prints the same 14 items ending 'Glycerin' and the pack back (C1, read by eye) matches in order; the flag's '13 items' was a miscount" }));
  r.identity.inci_source = { tier: man.tier, source_class: "manufacturer_page", url: man.source_url, date: man.capture_date, date_note: null, note: "recheck-r6 / R2-H4: identical to the dm list (C3) and to the pack back (C1, partial read); complete, 14 items" };
  const d = r6Row(slug, "manufacturer_directions");
  r.history.round3.removed_directions = { text: r.directions.text, tier: r.directions.tier, source: r.directions.source };
  r.directions = { text: d.value_verbatim, directions_status: "verbatim", directions_verbatim: true, status_note: "recheck-r6: neqi-hair.com tab 'ANWENDUNG' (C2 manufacturer page) replaces the dm text (C3), G1 hierarchy", tier: d.tier, source: d.source_url, source_host: srcHost(d.source_url), date: d.capture_date, basis: "recheck-r6 manufacturer_directions", language_note: r.directions.language_note };
  const heat = r6Row(slug, "pack_back_claim");
  const de = heat.value_verbatim.split(/\s+\/\s+/).find((x) => /Hitzeschutz/.test(x));
  if (!de || !/\[Glan\]z/.test(de)) throw new Error("NEQI pack heat line");
  r.claims.push(mk({ type: "heat_protection", raw: de.replace("[Glan]z", "Glanz"), tier: heat.tier, source: heat.source_url, date: heat.capture_date, capture_note: "recheck-r6: German line of the pack back, read by eye; the letters 'Glan' of 'Glanz' are clipped by the bottle curvature (as read: '" + de + "') and completed from the English line ('shine')", tier_basis: "recheck-r6 pack_back_claim: C1 pack back" }));
  logPatch("recheck-r6 / R2-H4", slug, "applied", "INCI truncation flag withdrawn (list complete: neqi-hair.com C2 and pack C1 agree, 14 items; INCI re-sourced to neqi-hair.com C2); directions = neqi-hair.com C2 text (dm C3 text under history.round3.removed_directions); C1 pack heat line added: '" + de.replace("[Glan]z", "Glanz") + "'");
  notApplied.push("`" + slug + "`: pack front „STYLING SPRAY … Diamond Glass / for all hair types\" and the manufacturer product type „Leave-in Styling Spray mit Hitzeschutz\" (C2) recorded in the capture file only");
}
{
  const slug = "balea-professional-styling-cream-traumlocken";
  const r = R(slug);
  const front = r6Row(slug, "pack_front");
  const back = r6Row(slug, "pack_back_other");
  const gesch = r6Row(slug, "pack_back_geschmeidigkeit");
  for (const f of ["dm_bullet_geschmeidigkeit", "dm_bullets", "dm_description_lines"]) r6Row(slug, f);
  const add = [];
  const push = (type, raw, row, why) => {
    r.claims.push(mk({ type, raw, tier: row.tier, source: row.source_url, date: row.capture_date, tier_basis: "recheck-r6 " + row.field + ": pack, dm pack photo read by eye" + (why ? " (" + why + ")" : "") }));
    add.push(type + " '" + raw + "'");
  };
  for (const seg of front.value_verbatim.split(/\s+\/\s+/)) {
    if (/^BIS ZU 24h/i.test(seg)) push("duration", seg, front);
    else if (/^Balea PROFESSIONAL$|^TRAUM LOCKEN STYLING CREAM$/i.test(seg)) continue; // brand / product name
    else if (/^lockiges und gewelltes Haar$/i.test(seg)) push("hair_type", seg, front);
    else {
      push("promise", seg, front);
      const m = seg.match(/Hitzeschutz bis \d+ °C/);
      if (m) push("heat_protection", m[0], front, "heat part of the line above");
    }
  }
  for (const seg of back.value_verbatim.split(/\s+\/\s+/)) {
    if (/^ANWENDUNG\b/.test(seg)) {
      if (!seg.includes(r.directions.text)) throw new Error("Traumlocken pack directions differ");
      continue;
    }
    push("promise", seg, back);
  }
  push("promise", gesch.value_verbatim, gesch);
  r.claim_capture.capture_facts = (r.claim_capture.capture_facts || []).concat(["recheck-r6: the pack carries no hold wording; 'Verbesserte Geschmeidigkeit' is dm's bullet wording (C2_house_brand), not on the pack", "recheck-r6: pack directions identical to the dm text"]);
  logPatch("recheck-r6 / R2-H5", slug, "applied", "C1 pack lines added as captured: " + add.join("; ") + "; the pack name line 'TRAUM LOCKEN STYLING CREAM' and the brand line are not claims; the dm feel line 'Verbesserte Geschmeidigkeit' (C2_house_brand) is kept unchanged");
}

// ---------------------------------------------------------------------------------------------
// The 4 new products (round3-smoothing-r5.json), frozen with the round-2 builder
// ---------------------------------------------------------------------------------------------
const deepReplace = (o, a, b) => {
  if (Array.isArray(o)) return o.map((x) => deepReplace(x, a, b));
  if (o && typeof o === "object") return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, deepReplace(v, a, b)]));
  return typeof o === "string" ? o.split(a).join(b) : o;
};
const newBuilt = r5.map((raw) => {
  let rec = buildNew(raw);
  rec = deepReplace(rec, "round2-new-r4", "round3-smoothing-r5");
  rec.cohort_role = "calibration";
  rec.reference_only_not_for_blind_lanes.round = 5;
  rec.reference_only_not_for_blind_lanes.origin = "round3_smoothing";
  rec.reference_only_not_for_blind_lanes.why_smoothing_styler = raw.why_smoothing_styler || null;
  rec.history = { round3: { new_in_round3: true, capture: "round3-smoothing-r5" } };
  return rec;
});
const p6New = {};
for (const r of newBuilt) {
  const n = cleanClaims(r, "new");
  if (n) p6New[r.source_slug] = n;
}
const nameTableStart = nameTable.length;
for (const r of newBuilt) addNameClaims(r);
// renamed records: drop their old name-derived claims and re-derive them from the new confirmed name
for (const slug of ["wella-eimi-nutricurls-fresh-up", "balea-haarwachs-styling-stick"]) {
  const r = R(slug);
  const old = r.claims.filter((c) => c.from_product_name);
  r.claims = r.claims.filter((c) => !c.from_product_name);
  addNameClaims(r);
  if (old.length) r.history.round3.removed_name_claims = old;
}
const nameTableR3 = nameTable.slice(nameTableStart);
logPatch("R5-new", newBuilt.map((r) => r.source_slug).join(", "), "applied", newBuilt.length + " products of round3-smoothing-r5.json frozen with the round-2 builder (role calibration, origin round3_smoothing); P-6 annotation cleaning on " + Object.keys(p6New).length + " of them; name-derived claims: " + (nameTableR3.filter((x) => x.kept).map((x) => x.slug + " '" + x.word + "' (" + x.type + ")").join(", ") || "none"));

// ---------------------------------------------------------------------------------------------
// P2-4: re-join split INCI tokens and in-token hyphenation artifacts, then renumber (every repair logged)
// ---------------------------------------------------------------------------------------------
const records = r2Records.concat(newBuilt);
const keyOf = (s) => String(s).toLowerCase().replace(/\*/g, "").replace(/\s+/g, " ").trim();
const keyRecords = new Map(); // inci key -> set of slugs
for (const r of records) for (const it of r.identity.inci_normalised) {
  const k = keyOf(it.inci);
  if (!keyRecords.has(k)) keyRecords.set(k, new Set());
  keyRecords.get(k).add(r.source_slug);
}
const knownElsewhere = (k, slug) => keyRecords.has(k) && [...keyRecords.get(k)].some((s) => s !== slug);
const repairLog = [];
for (const r of records.slice().sort((a, b) => cmp(a.source_slug, b.source_slug))) {
  const items = r.identity.inci_normalised;
  const done = [];
  // (a) in-token hyphenation artifacts: 'Tri-heptanoin' -> 'Triheptanoin' when only the de-hyphenated form is a known name
  for (const it of items) {
    const m = it.inci.match(/^([A-Za-z]+)-([a-z]+)$/);
    if (!m) continue;
    const joined = m[1] + m[2];
    if (knownElsewhere(keyOf(joined), r.source_slug) && !knownElsewhere(keyOf(it.inci), r.source_slug)) {
      done.push({ kind: "hyphenation_artifact", from: [it.inci], to: joined });
      it.inci = joined;
    }
  }
  // (b) split tokens: a fragment that is no INCI name of its own and forms a known name (or a locant name) with its neighbour
  for (let i = 0; i < items.length - 1; i++) {
    const a = items[i].inci;
    const b = items[i + 1].inci;
    let joined = null;
    if ((/^\d+$/.test(a) || /-\d+$/.test(a)) && /^\d+-[A-Za-z]/.test(b)) joined = a + "," + b; // locant split: '1' + '2-Hexanediol'
    else if (!knownElsewhere(keyOf(a), r.source_slug) || !knownElsewhere(keyOf(b), r.source_slug)) {
      // the joined form used by the most other records wins (ties: space, hyphen, none)
      let best = 0;
      for (const glue of [" ", "-", ""]) {
        const cand = a + glue + b;
        const k = keyOf(cand);
        const n = keyRecords.has(k) ? [...keyRecords.get(k)].filter((x) => x !== r.source_slug).length : 0;
        if (n > best) {
          best = n;
          joined = cand;
        }
      }
    }
    if (!joined) continue;
    done.push({ kind: "split_token", from: [a, b], to: joined, ranks: [items[i].rank, items[i + 1].rank] });
    items.splice(i, 2, { rank: 0, inci: joined, as_written: items[i].as_written + ", " + items[i + 1].as_written });
    i--;
  }
  if (!done.length) continue;
  items.forEach((x, k) => (x.rank = k + 1));
  r.identity.inci_item_count = items.length;
  for (const d of done) {
    const txt = d.kind === "split_token" ? "P2-4 re-join: '" + d.from[0] + "' (r" + d.ranks[0] + ") + '" + d.from[1] + "' (r" + d.ranks[1] + ") -> '" + d.to + "'" : "P2-4 hyphenation artifact: '" + d.from[0] + "' -> '" + d.to + "'";
    r.identity.transcription_repairs = uniq(r.identity.transcription_repairs.concat([txt]));
    r.identity.inci_flags = uniq(r.identity.inci_flags.concat(["repaired_" + d.kind + ": '" + d.from.join("' + '") + "' -> '" + d.to + "'"]));
    repairLog.push({ slug: r.source_slug, kind: d.kind, text: txt });
  }
  // a split flag the re-join resolved is no longer an incompleteness flag
  r.identity.inci_flags = r.identity.inci_flags.map((f) => (/^possible_split_item/.test(f) && done.some((d) => d.kind === "split_token") ? f.replace(/^possible_split_item/, "repaired_split_item (P2-4, re-joined and renumbered)") : f));
  r.identity.transcription_repairs.push("P2-4: list renumbered after " + done.length + " repair(s); " + items.length + " items");
}
logPatch("P2-4", "(all records)", "applied", repairLog.length + " repairs on " + uniq(repairLog.map((x) => x.slug)).length + " records, each logged in identity.transcription_repairs and identity.inci_flags and listed in section 6: " + repairLog.map((x) => x.slug + ": " + x.text.replace(/^P2-4 /, "")).join("; "));

// ---------------------------------------------------------------------------------------------
// Versions, ids, guards
// ---------------------------------------------------------------------------------------------
const typeOrder = ["promise", "hold", "flexibility", "finish", "duration", "humidity", "heat_protection", "heat_activation", "cast", "other", "hair_type", "free_from"];
for (const r of records) {
  r.standard_version = STANDARD_VERSION;
  r.lexicon_version = LEXICON_VERSION;
  r.claims = r.claims.map((c, i) => [c, i]).sort((a, b) => typeOrder.indexOf(a[0].type) - typeOrder.indexOf(b[0].type) || a[1] - b[1]).map((x) => x[0]);
}
const exclusions = R2_EXCLUSIONS.map((e) => Object.assign({}, e, { status_in_round3: "unchanged from round 2" }));
{
  const idSet = new Set();
  for (const r of records) {
    r.sample_id = "sty-" + sha256(Buffer.from(ID_SALT + r.source_slug)).slice(0, 10);
    if (idSet.has(r.sample_id)) throw new Error("opaque id collision " + r.sample_id);
    if (R1_IDS.has(r.sample_id)) throw new Error("round-3 id equals a round-1 id: " + r.sample_id);
    if (R2_IDS.has(r.sample_id)) throw new Error("round-3 id equals a round-2 id: " + r.sample_id);
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
      if (seen.has(k)) exclusions.push({ sample_id: "(warning)", origin: "guard", reason: "duplicate " + k + ": " + seen.get(k) + " and " + r.source_slug, source: "freeze-cohort-r3.js", round: 3 });
      seen.set(k, r.source_slug);
    }
  }
}
records.sort((a, b) => cmp(a.sample_id, b.sample_id));

// ---------------------------------------------------------------------------------------------
// R2-Q3 / P2-1: S0 masking keeps job nouns and masks only grading words (standard 10.2)
// ---------------------------------------------------------------------------------------------
const L = "A-Za-zÄÖÜäöüß";
const STRENGTH = "(?:leicht\\w*|sanft\\w*|soft|weich\\w*|mittel\\w*|mittler\\w*|normal\\w*|stark\\w*|st[äa]rk\\w*|sehr|extra|extrem\\w*|ultra|super|mega|maximal\\w*|maximum|max\\.?|power|strong|firm|krass\\w*|intensiv\\w*|medium|light)";
const HOLDW = "(?:halt|hold|fixier\\w*|fixation|kontroll\\w*|control)";
const MID = "(?:[\\s,\\-]+[a-zäöüß&][" + L + "]*){0,3}"; // up to three lowercase words between (adjectives, „und"); a capitalised noun stops it
const S0_MASK = [
  // hold numbers, scales and dots
  [new RegExp("\\bhalte?(?:grad|stufe)\\w*\\s*:?\\s*(?:von\\s*)?\\d*\\+?(?:\\s*\\/\\s*\\d+)?", "gi"), () => "[CLAIM]"],
  [/\b(halt|hold)(\s*:?\s*)\d+\+?(?:\s*\/\s*\d+)?/gi, (m, w) => w + " [CLAIM]"],
  [/\b\d+\+?\s*\/\s*\d+\b/g, () => "[CLAIM]"],
  [/\b\d\+/g, () => "[CLAIM]"],
  [/[●○◉◯⬤]+/g, () => "[CLAIM]"],
  // hold strengths: 'Halt: stark', 'starker (flexibler) Halt', 'mittlere Kontrolle'
  [new RegExp("\\b(halt|hold)(\\s*[:\\-–]\\s*)" + STRENGTH + "(?:[\\s\\-]+" + STRENGTH + ")*\\b", "gi"), (m, w, sep) => w + sep + "[CLAIM]"],
  [new RegExp("\\b" + STRENGTH + "(?:[\\s,\\-]+" + STRENGTH + ")*(?=" + MID + "[\\s,\\-]+" + HOLDW + "\\b)", "gi"), () => "[CLAIM]"],
  // flexibility / rigidity words (6.9)
  [new RegExp("[" + L + "]*flex[" + L + "]*", "gi"), () => "[CLAIM]"],
  [new RegExp("\\b(?:beweglich|elastisch|elastiz|nachstylbar|variab|betonhart|steif|verhärt|freeze)[" + L + "]*", "gi"), () => "[CLAIM]"],
  [new RegExp("\\b(?:ver|neu\\s*)?formbar[" + L + "]*", "gi"), () => "[CLAIM]"],
  [/kl?eber/gi, () => "[CLAIM]"], // incl. the page typo „Keber-Produkte" for the got2b Kleber line
  [/\b(?:bomben|felsen|stein)?fest(?:e|er|en|es|em)?\b/gi, () => "[CLAIM]"],
  [/\b(?:wieder|neu)\s+styl\w*/gi, () => "[CLAIM]"],
  // finish grades (6.8): glänzend (adjective), matt, natürlich + Finish/Look/Glanz, Wet Look, glossy, shiny, schimmernd, brillant, satin
  [new RegExp("[" + L + "]*gl(?:ä|ae)nzend[" + L + "]*", "gi"), () => "[CLAIM]"],
  [/\b(?:spiegel|hoch)(?=gl(?:a|ä)nz)/gi, () => "[CLAIM]"],
  [new RegExp("(?<![" + L + "])(?:halb|seiden|semi-?)?matt(?:ierend[" + L + "]*|ifying|ified|en|er|es|em|e)?", "gi"), () => "[CLAIM]"],
  // natürlich is a finish grade only next to Finish/Look/Glanz (6.8, RG-10, RG2-11: a participle such as aussehend/wirkend may stand between)
  [new RegExp("(?<![" + L + "])nat(?:ü|ue)rlich[" + L + "]*(?=(?:[\\s\\-]+(?:aussehend|wirkend)[" + L + "]*)?(?:,?\\s*\\[CLAIM\\])?[\\s\\-]+(?:finish|look|glanz|shine|halt|hold)\\b)", "gi"), () => "[CLAIM]"],
  [/\bnatural\w*(?=\s+(?:finish|look|shine|hold)\b)/gi, () => "[CLAIM]"],
  [/\bwet[\s-]?look\b/gi, () => "[CLAIM]"],
  [new RegExp("(?<![" + L + "])(?:glossy|shiny|satin[" + L + "]*|schimmernd[" + L + "]*|brillant(?:e[nrsm]?)?)(?![" + L + "])", "gi"), () => "[CLAIM]"],
];
function maskS0(text, isName) {
  if (text == null) return { text: null, count: 0 };
  let t = String(text);
  let n = 0;
  if (isName) {
    // RG-13 name test: a strength run that ends the name or qualifies the product noun is a hold grade
    const toks = t.split(/(\s+)/);
    const words = toks.map((x, i) => [x, i]).filter(([x]) => /\S/.test(x));
    const STR_TOK = new RegExp("^" + STRENGTH + "$", "i");
    for (let w = 0; w < words.length; w++) {
      if (!STR_TOK.test(words[w][0])) continue;
      let e = w;
      while (words[e + 1] && STR_TOK.test(words[e + 1][0])) e++;
      const next = words[e + 1] ? words[e + 1][0] : null;
      if (next === null || isProductNoun(next.replace(/[^A-Za-zäöüß-]/g, ""))) {
        for (let k = w; k <= e; k++) toks[words[k][1]] = k === w ? "[CLAIM]" : "";
        n++;
      }
      w = e;
    }
    t = toks.join("");
  }
  for (const [re, fn] of S0_MASK) t = t.replace(re, (...a) => (n++, fn(...a)));
  // a strength word that qualifies a masked grade ('Power [CLAIM]', 'starker, [CLAIM] Halt') is part of that grade
  t = t.replace(new RegExp("\\b" + STRENGTH + "(?:[\\s,\\-]+" + STRENGTH + ")*(?=[\\s,\\-]+\\[CLAIM\\])", "gi"), () => (n++, "[CLAIM]"));
  t = t.replace(/(\[CLAIM\][\s,\-\/&+]*){2,}/g, (m) => "[CLAIM]" + (/\s$/.test(m) ? " " : ""));
  return { text: t.replace(/[ \t]+/g, " ").replace(/ *\n */g, "\n").trim(), count: n };
}
// leak checks for S0 text (applied after masking, with [CLAIM] removed)
const S0_LEAK = {
  hold_number_or_scale: /\b(?:halt|hold)\w*\s*[:\-]?\s*\d|\b\d+\+|\b\d\s*\/\s*\d\b|halte?grad|halte?stufe|hold[- ]?(?:faktor|level)|[●○◉⬤]/i,
  strength_word: new RegExp("\\b" + STRENGTH + MID + "[\\s,\\-]+" + HOLDW + "\\b|\\b(?:halt|hold)\\s*[:\\-–]\\s*" + STRENGTH + "\\b|\\bkrass\\w*", "i"),
  flexibility_word: /flex|beweglich|elastisch|elastiz|formbar|nachstylbar|kl?eber|freeze|betonhart|\bsteif|\b(?:bomben|felsen|stein)?fest(?:e|er|en|es|em)?\b|verhärt|\bvariab|\b(?:wieder|neu)\s+styl/i,
  finish_grade: new RegExp("gl(?:ä|ae)nzend|(?<![" + L + "])(?:halb|seiden|semi-?)?matt(?:ierend|ifying|e[nrsm]?)?(?![" + L + "]{3,})|nat(?:ü|ue)rlich[" + L + "]*(?:[\\s\\-]+(?:aussehend|wirkend)[" + L + "]*)?,?[\\s\\-]+(?:finish|look|glanz|shine)\\b|natural\\s+(?:finish|look|shine)|wet[\\s-]?look|glossy|shiny|schimmernd|\\bbrillant(?:e[nrsm]?)?\\b|\\bsatin|spiegelglanz|hochglanz", "i"),
  label: /(round-?\s?\d|\bfilter\b|\bdraft\b|\blane\b|calibration|cohort|unseen|negative_control|subtype|legacy)/i,
};
// a strength word left in the name that ends it or qualifies the product noun (RG-13)
function nameStrengthLeft(name) {
  const w = String(name).split(/\s+/).filter(Boolean);
  const STR_TOK = new RegExp("^" + STRENGTH + "$", "i");
  for (let i = 0; i < w.length; i++) {
    if (!STR_TOK.test(w[i])) continue;
    let e = i;
    while (w[e + 1] && STR_TOK.test(w[e + 1])) e++;
    const next = w[e + 1];
    if (next === undefined || isProductNoun(next.replace(/[^A-Za-zäöüß-]/g, ""))) return w.slice(i, e + 1).join(" ");
    i = e;
  }
  return null;
}
// strength words that grade something other than hold (volume, texture, damage): not masked under R2-Q3, listed for review
const STRENGTH_ELSEWHERE = /\b(?:stark|starke[nrsm]?|st[äa]rker\w*|st[äa]rkste\w*|strong|firm|maximal\w*|extrem\w*)\b/i;
const strengthElsewhere = [];
// job-bearing words (styling jobs and job-naming product nouns; grading stems such as matt/flex are not jobs)
const JOB_TOKEN = /(volum|f(?:ü|ue)lle|schwung|sprungkraft|spannkraft|lift|^halt$|hold|fixier|kontrolle|control|glanz|glow|shine|gloss|brillanz|brilliantine|finish|textur|texture|struktur|grip|griff|lock|curl|well|wave|defini|frizz|flyaway|abstehend|babyhaar|glatt|glätt|sleek|smooth|^form(?!el|ul)|formen|forming|model|shap|auffrisch|refresh|revitali|reaktiv|beach|salz|salt|haarspray|haarlack|lack$|^gel$|haargel|gelee|jelly|wachs|wax|paste|pomade|clay|puder|powder|schaum|mousse|f(?:ö|oe)hn)/i;
const tokens = (s) => String(s || "").replace(/\[CLAIM\]/g, " ").split(/[^A-Za-zÄÖÜäöüß0-9-]+/).filter(Boolean);
const jobTokens = (s) => tokens(s).flatMap((t) => t.split("-")).filter((t) => JOB_TOKEN.test(t));

// ---------------------------------------------------------------------------------------------
// Packets
// ---------------------------------------------------------------------------------------------
const packets = { s0: [], fu: [], claims: [] };
const leaks = { fu_brand_name: [], s0_hold_number_or_scale: [], s0_strength_word: [], s0_flexibility_word: [], s0_finish_grade: [], s0_label: [], claims_annotation: [], slug: [], round1_or_round2_id: [], url: [], forbidden_key: [], subtype_or_route_id: [], any_label: [] };
const s0Stats = { promise_lines_masked: 0, packets_with_masked_promise: 0, replacements: 0, names_masked: 0, directions_masked: 0 };
const subtypeIds = uniq(records.map((r) => r.reference_only_not_for_blind_lanes.draft_subtype).filter((x) => x && /_/.test(x))).concat(["leave_in", "heat_protectant", "dry_shampoo", "provisional_boundary", "negative_control", "salt_spray", "texture_spray", "shine_finish", "smoothing_styler", "curl_cream"]);
const allSlugs = records.map((r) => r.source_slug);
const priorIds = new Set([...R1_IDS, ...R2_IDS]);
const srcClassOf = (c) => c.source_class_override || (c.from_product_name ? "product_name" : c.retailer_attribute ? "retailer_attribute" : sourceClass(c.tier));
const displayForPacket = (d) => (d ? { marks: d.marks, labels_as_printed: d.labels_as_printed, highlighted: d.highlighted, filled: d.filled, caption_as_printed: d.caption_as_printed } : undefined);
const flagRank = (rec, f) => {
  if (/truncat/i.test(f)) return rec.identity.inci_normalised.length + 1;
  const q = f.match(/'([^']+)'/) || f.match(/:\s*([A-Z][A-Z0-9 ()\/-]+)$/);
  if (!q) return null;
  const k = keyOf(q[1]);
  const it = rec.identity.inci_normalised.find((x) => keyOf(x.inci) === k || keyOf(x.inci).includes(k) || k.includes(keyOf(x.inci)));
  return it ? it.rank : null;
};
for (const rec of records) {
  const id = rec.sample_id;
  const inciBlock = { inci_item_count: rec.identity.inci_normalised.length, tier: rec.identity.inci_source.tier, source_class: sourceClass(rec.identity.inci_source.tier), date: rec.identity.inci_source.date, items: rec.identity.inci_normalised.map((x) => ({ rank: x.rank, inci: x.inci })) };
  // S0
  const promise = [];
  let redCount = 0;
  for (const c of rec.claims) {
    if (c.type !== "promise" || !isC12(c.tier)) continue;
    const red = maskS0(packetText(c.raw), false);
    redCount += red.count;
    if (red.count) s0Stats.promise_lines_masked++;
    c.s0_redacted_text = red.text;
    promise.push(Object.assign({ text: red.text, redacted: red.count > 0, tier: c.tier, source_class: srcClassOf(c), date: c.date }, c.flags ? { flags: c.flags } : {}, c.mixed_source ? { mixed_source: true } : {}));
  }
  if (redCount) {
    s0Stats.packets_with_masked_promise++;
    s0Stats.replacements += redCount;
  }
  const heat = rec.claims.filter((c) => c.type === "heat_protection" && isC12(c.tier)).map((c) => {
    const red = maskS0(packetText(c.raw), false);
    c.s0_redacted_text = red.text;
    return Object.assign({ text: red.text, redacted: red.count > 0, tier: c.tier, source_class: srcClassOf(c), date: c.date }, c.flags ? { flags: c.flags } : {}, c.mixed_source ? { mixed_source: true } : {});
  });
  const nameRed = maskS0(rec.identity.product_name, true);
  const dirRed = maskS0(rec.directions.text, false);
  if (nameRed.count) s0Stats.names_masked++;
  if (dirRed.count) s0Stats.directions_masked++;
  rec.s0_redacted_name = nameRed.text;
  rec.s0_redacted_directions = dirRed.text;
  const s0dir = dirBlock(rec, dirRed.text);
  if (s0dir && dirRed.count) s0dir.redacted_with = "[CLAIM]";
  rec.identity.inci_flag_ranks = rec.identity.inci_flags.map((f) => ({ flag: f, defect_rank: flagRank(rec, f) }));
  const s0 = {
    packet: "s0",
    packet_version: COHORT_VERSION,
    sample_id: id,
    product: { confirmed_name: nameRed.text, confirmed_name_redacted: nameRed.count > 0, brand: rec.identity.brand, format: rec.identity.format },
    identity: { inci_flags: rec.identity.inci_flag_ranks.map((x) => ({ flag: x.flag, defect_rank: x.defect_rank })) },
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
    s0.identity_note = rec.identity.s0_identity_note || "two INCI lists were captured for this GTIN; a dated C1 pack capture carrying the GTIN is the formula of record (standard 2.2 A2 release test)";
  }
  packets.s0.push({ id, body: s0, rec });
  // F/U (round-1 masking, unchanged)
  const masked = maskDirections(rec.directions.text, rec.identity.brand, rec.identity.product_name, rec.source_slug);
  const fu = { packet: "fu", packet_version: COHORT_VERSION, sample_id: id, format: rec.identity.format, inci: inciBlock, directions_status: rec.directions.directions_status, directions: dirBlock(rec, masked.text, true) };
  const lk = leakCheck(masked.text, rec);
  if (lk.length) leaks.fu_brand_name.push({ slug: rec.source_slug, hits: lk, text: masked.text });
  packets.fu.push({ id, body: fu, rec });
  // claims (R2-Q3: plus the unmasked confirmed name)
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
  const nt = rec.identity.name_tier || null;
  const cp = { packet: "claims", packet_version: COHORT_VERSION, sample_id: id, brand: rec.identity.brand, confirmed_name: rec.identity.product_name, confirmed_name_tier: nt ? nt.tier : rec.claim_capture.record_best_tier, format: rec.identity.format, product_type_word: productTypeWord(rec.identity.product_name, rec.identity.format), scale_info: scaleHold ? { number: scaleHold.number, scale_as_written: scaleHold.scale_as_written, scale_max: scaleHold.scale_max, scale_max_stated: scaleHold.scale_max_stated, tier: scaleHold.tier } : null, claims: cl };
  packets.claims.push({ id, body: cp, rec });
}
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
    for (const rid of priorIds) if (ser.includes(rid)) leaks.round1_or_round2_id.push(kind + "/" + p.id + ": " + rid);
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
        const bare = String(t).replace(/\[CLAIM\]/g, " ");
        for (const [k, re] of Object.entries(S0_LEAK)) {
          const m = bare.match(re);
          if (m) leaks["s0_" + k].push(p.id + " (" + p.rec.source_slug + ") " + f + ": '" + m[0] + "' in \"" + t.slice(0, 140) + "\"");
        }
        if (f === "name") {
          const left = nameStrengthLeft(bare);
          if (left) leaks.s0_strength_word.push(p.id + " (" + p.rec.source_slug + ") name: '" + left + "' (RG-13 name test) in \"" + t + "\"");
        }
        const other = bare.match(STRENGTH_ELSEWHERE);
        if (other && !S0_LEAK.strength_word.test(bare)) strengthElsewhere.push("`" + p.rec.source_slug + "` " + f + ": „" + other[0] + "\"");
      }
    }
  }
}
const leakTotal = Object.values(leaks).reduce((a, b) => a + b.length, 0);

// ---------------------------------------------------------------------------------------------
// S0 job-word check (before = round-2 packets, after = round-3 packets)
// ---------------------------------------------------------------------------------------------
// Method A (round-2 diff.js s0_redaction_check, reproduced): lead line (first C1, else first C2) + name.
const DIFF_STYLING_JOB = /(volum|glow|halt\b|hold|glanz|glänz|shine|gloss|brillanz|finish|matt|textur|texture|struktur|lock|curl|well|wave|defini|frizz|glatt|glätt|sleek|smooth|form|model|fixier|beach|grip|griff|auffrisch|refresh|revitali|sprungkraft|spannkraft|lift|puder|kontrolle|flex|styl)/i;
const DIFF_JOB_NOUN = /(salz|salt|haarspray|haarlack|spr[üu]hlack|gel\b|gelee|jelly|wachs|wax|paste|pomade|clay|puder|powder|schaumfestiger|mousse|f[öo]hn)/i;
const dTokens = (s) => String(s || "").split(/[^A-Za-zÄÖÜäöüß0-9-]+/).filter(Boolean);
const dJob = (s) => dTokens(s).filter((t) => DIFF_STYLING_JOB.test(t));
const dNoun = (s) => dTokens(s).filter((t) => DIFF_JOB_NOUN.test(t));
function diffMethod(rec, maskFn) {
  const pr = rec.claims.filter((x) => x.type === "promise" && /^C[12]/.test(String(x.tier)));
  if (!pr.length) return null;
  const lines = pr.map((x) => ({ tier: String(x.tier), raw: x.raw, s0: maskFn(packetText(x.raw), false) }));
  const lead = lines[Math.max(0, lines.findIndex((l) => /^C1/.test(l.tier)))];
  const name = rec.identity.product_name;
  const nameS0 = maskFn(name, true);
  const lost = (raw, red) => {
    const left = new Set(dJob(red).map((t) => t.toLowerCase()));
    return dJob(raw).filter((t) => !left.has(t.toLowerCase()));
  };
  const leadLost = lost(lead.raw, lead.s0);
  const nameLost = lost(name, nameS0);
  const leadLeft = dJob(lead.s0).filter((t) => !/^styl/i.test(t));
  const nameLeft = [...dJob(nameS0).filter((t) => !/^styl/i.test(t)), ...dNoun(nameS0)];
  return { any_lost: leadLost.length > 0 || nameLost.length > 0, complete: leadLost.length > 0 && leadLeft.length === 0 && nameLeft.length === 0, lost: nameLost.concat(leadLost) };
}
// Method B (new, R2-Q3 check): name + every C1/C2 promise and heat line; job-bearing words only (grading stems excluded)
function jobCheck(rec, maskFn) {
  const parts = [[rec.identity.product_name, true]].concat(rec.claims.filter((c) => (c.type === "promise" || c.type === "heat_protection") && isC12(c.tier)).map((c) => [packetText(c.raw), false]));
  const raw = parts.flatMap(([t]) => jobTokens(t));
  const s0 = parts.flatMap(([t, isName]) => jobTokens(maskFn(t, isName)));
  const left = new Set(s0.map((t) => t.toLowerCase()));
  return { raw: raw.length, s0: s0.length, lost: uniq(raw.filter((t) => !left.has(t.toLowerCase()))) };
}
const r2Mask = (t) => (t == null ? null : redactS0R2(t).text);
const r3Mask = (t, isName) => (t == null ? null : maskS0(t, isName).text);
const r2Base = JSON.parse(JSON.stringify(R2("records")));
const jobBefore = { diff: r2Base.map((r) => [r.source_slug, diffMethod(r, r2Mask)]), job: r2Base.map((r) => [r.source_slug, jobCheck(r, r2Mask)]) };
const jobAfter = { diff: records.map((r) => [r.source_slug, diffMethod(r, r3Mask)]), job: records.map((r) => [r.source_slug, jobCheck(r, r3Mask)]) };
const summarise = (j) => ({
  diff_records_with_a_lost_job_word: j.diff.filter(([, x]) => x && x.any_lost).length,
  diff_records_with_complete_lead_job_loss: j.diff.filter(([, x]) => x && x.complete).length,
  diff_complete_loss_slugs: j.diff.filter(([, x]) => x && x.complete).map(([s]) => s).sort(),
  job_records_with_job_words_in_capture: j.job.filter(([, x]) => x.raw > 0).length,
  job_records_zero_job_words_in_s0_where_capture_had_one: j.job.filter(([, x]) => x.raw > 0 && x.s0 === 0).map(([s]) => s).sort(),
  job_records_losing_at_least_one_job_word: j.job.filter(([, x]) => x.lost.length).length,
});
const jobSummary = { before_round2: summarise(jobBefore), after_round3: summarise(jobAfter) };
const lostAfter = jobAfter.job.filter(([, x]) => x.lost.length).map(([s, x]) => s + " (" + x.lost.join(", ") + ")").sort();
const lostAfterDiff = jobAfter.diff.filter(([, x]) => x && x.any_lost).map(([s, x]) => s + " (" + uniq(x.lost).join(", ") + ")").sort();
if (jobSummary.after_round3.job_records_zero_job_words_in_s0_where_capture_had_one.length) throw new Error("S0 records with zero job words: " + jobSummary.after_round3.job_records_zero_job_words_in_s0_where_capture_had_one.join(", "));

// ---------------------------------------------------------------------------------------------
// Evidence gate (standard 4.1 + RG2-24: a defect proven to sit in the tail does not block)
// ---------------------------------------------------------------------------------------------
const parfumRank = (rec) => {
  const it = rec.identity.inci_normalised.find((x) => /^(parfum|fragrance|perfume)\b/i.test(x.inci));
  return it ? it.rank : null;
};
const gateRows = packets.s0.map((p) => {
  const r = p.rec;
  const b = p.body;
  const promise = b.promise_claims_c1_c2.length > 0;
  const promiseInformative = b.promise_claims_c1_c2.some((x) => x.text.replace(/\[CLAIM\]/g, "").replace(/[\s\W]+/g, "").length > 0);
  const dir = b.directions_status === "verbatim";
  const pr = parfumRank(r);
  const defects = r.identity.inci_flag_ranks.filter((x) => INCOMPLETE_FLAG_RE.test(x.flag)).map((x) => Object.assign({}, x, { below_parfum: pr != null && x.defect_rank != null && x.defect_rank > pr, parfum_rank: pr }));
  const blocking = defects.filter((x) => !x.below_parfum);
  const tailOnly = defects.filter((x) => x.below_parfum);
  const inciComplete = blocking.length === 0;
  const identityOk = ["as_captured", "verified", "verified_with_minor_source_difference"].includes(r.identity.identity_status);
  const pass = promise && dir && inciComplete && identityOk;
  if (tailOnly.length) r.identity.review_flags = uniq((r.identity.review_flags || []).concat(["inci_tail_defect"]));
  return { r, promise, promiseInformative, dir, inciComplete, identityOk, pass, tailOnly, blocking };
});
const gate = {
  pass: gateRows.filter((x) => x.pass).length,
  promise: gateRows.filter((x) => x.promise).length,
  promise_only_claim_markers: gateRows.filter((x) => x.promise && !x.promiseInformative).map((x) => x.r.source_slug).sort(),
  dir: gateRows.filter((x) => x.dir).length,
  inci: gateRows.filter((x) => x.inciComplete).length,
  identity: gateRows.filter((x) => x.identityOk).length,
  tail_only: gateRows.filter((x) => x.tailOnly.length).map((x) => "`" + x.r.source_slug + "` (" + x.tailOnly.map((d) => "defect r" + d.defect_rank + " below Parfum r" + d.parfum_rank).join("; ") + ")").sort(),
  by_role: sortKeys(count(gateRows.filter((x) => x.pass), (x) => x.r.cohort_role)),
  by_origin: sortKeys(count(gateRows.filter((x) => x.pass), (x) => x.r.reference_only_not_for_blind_lanes.origin)),
  failing: gateRows.filter((x) => !x.pass).map((x) => "`" + x.r.source_slug + "` (" + x.r.cohort_role + "; " + [x.promise ? null : "no C1/C2 promise", x.dir ? null : "directions " + x.r.directions.directions_status, x.inciComplete ? null : "INCI defect above the tail", x.identityOk ? null : "identity " + x.r.identity.identity_status].filter(Boolean).join(", ") + ")").sort(),
  capture_disagree: gateRows.filter((x) => x.r.reference_only_not_for_blind_lanes.origin === "round3_smoothing" && x.r.reference_only_not_for_blind_lanes.capture_passes_three_evidence_items !== x.pass).map((x) => "`" + x.r.source_slug + "`").sort(),
};
const r2GatePassBySlug = Object.fromEntries(r2Base.map((r) => [r.source_slug, r.evidence_gate_inputs.all_three]));
const gateChanged = gateRows.filter((x) => r2GatePassBySlug[x.r.source_slug] !== undefined && r2GatePassBySlug[x.r.source_slug] !== x.pass).map((x) => "`" + x.r.source_slug + "` (" + (r2GatePassBySlug[x.r.source_slug] ? "pass" : "fail") + " -> " + (x.pass ? "pass" : "fail") + ")").sort();
for (const g of gateRows) g.r.evidence_gate_inputs = { c1_c2_promise: g.promise, directions_verbatim: g.dir, inci_complete: g.inciComplete, inci_tail_defects: g.tailOnly.map((d) => d.flag), identity_status_ok: g.identityOk, all_three: g.pass };
logPatch("P2-3 / RG2-24", "(all records)", "applied", "identity.inci_flags ship in every S0 packet (with the defect rank where the flag names a token); an incompleteness flag whose defect sits below the first Parfum/Fragrance rank (a T_S class member, so at or below T_S) does not block the gate and adds review inci_tail_defect: " + (gate.tail_only.join(", ") || "none"));
logPatch("P2-1 / R2-Q3", "(all records)", "applied", "S0 masking keeps job nouns and masks only grading words (hold numbers/scales/Haltegrad/dots, hold strengths, flexibility words, finish grades; durations are no longer masked); the claims packet carries the unmasked confirmed name; checks in sections 7-8");

// ---------------------------------------------------------------------------------------------
// Write outputs (only under v1.0/r3/)
// ---------------------------------------------------------------------------------------------
const r6Unused = r6.map((x, i) => [x, i]).filter(([, i]) => !r6Used.has(i)).map(([x]) => x.slug + " / " + x.field);
const INPUTS = R2_INPUTS.concat([R5_NEW, R6_RECHECK, "v1.0/build/freeze-cohort-r2.js"]);
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
  purpose: "Frozen round-3 calibration cohort. REFERENCE INPUT ONLY: never give this file to a blind lane (it maps opaque ids to slugs and to round-1/round-2 ids and carries legacy labels).",
  counts,
  exclusions,
  patches: patchLog,
  not_applied: notApplied,
  s0_job_word_check: { summary: jobSummary, records_losing_a_job_word_after: lostAfter },
  inputs: INPUTS.map((f) => ({ path: f, sha256: sha256(fs.readFileSync(path.join(BASE, f))) })),
  round2_rebuild_check: { files_compared: round2Check.files, byte_identical: round2Check.identical, round2_manifest_sha256: sha256(fs.readFileSync(path.join(R2_OUT, "artifact-manifest.json"))) },
  id_map: records.map((r) => ({ sample_id: r.sample_id, source_slug: r.source_slug, round2_sample_id: R2_ID_BY_SLUG[r.source_slug] || null, round1_sample_id: R1_ID_BY_SLUG[r.source_slug] || null })),
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
const s0Sample = (packets.s0.find((p) => p.body.identity.inci_flags.length && p.body.directions && p.body.heat_protection_claims_c1_c2.length && p.body.identity_status) || packets.s0.find((p) => p.body.identity.inci_flags.length && p.body.directions && p.body.heat_protection_claims_c1_c2.length) || packets.s0[0]).body;
const fuSample = packets.fu.find((p) => p.body.directions).body;
const clSample = (packets.claims.find((p) => p.body.claims.some((c) => c.display) && p.body.claims.some((c) => c.from_product_name)) || packets.claims[0]).body;
const roleList = (role) => records.filter((r) => r.cohort_role === role).map((r) => "`" + r.source_slug + "`").sort();
const leakLines = Object.entries(leaks).map(([k, v]) => "| " + k + " | " + v.length + " |").join("\n");
const b = jobSummary.before_round2;
const a = jobSummary.after_round3;
const notes = `# FREEZE-NOTES - Styling round-3 calibration cohort (${COHORT_VERSION})

Generated by \`build/freeze-cohort-r3.js\` (deterministic; re-run to reproduce every hash in \`r3/artifact-manifest.json\`). Frozen ${FREEZE_DATE}. Standard \`${STANDARD_VERSION}\` (amended 2026-10-12, R2-H1…R2-H6), lexicon \`${LEXICON_VERSION}\`. Every number below is computed by the script. Nothing here is committed or locked, and nothing is classified (no route, subtype or hold level is assigned).

## 1. How the cohort was built

1. The round-2 script \`build/freeze-cohort-r2.js\` is run unchanged in a sandbox whose writes go to memory (it rebuilds round 1 the same way). Its ${round2Check.files} round-2 outputs were compared with the files under \`r2/\` on disk: ${round2Check.identical} of ${round2Check.files} byte-identical (the build stops on any difference). Its ${r2Records.length} records are the base.
2. The round-2 packet issues P2-1…P2-6, the post-recheck rulings R2-H1…R2-H6 and the re-check capture \`capture/recheck-r6.json\` are applied (section 3). ${r6.length - r6Unused.length} of the ${r6.length} re-check rows were read by a patch${r6Unused.length ? "; not read: " + r6Unused.join(", ") : ""}.
3. The ${newBuilt.length} products of \`capture/round3-smoothing-r5.json\` are frozen with the round-2 builder (same record schema), role calibration.
4. P2-4 transcription repairs run over every record, then every list is renumbered (section 6).
5. Opaque ids: \`sty-\` + 10 hex of SHA-256(\`${ID_SALT}\` + slug). No round-3 id equals a round-1 or round-2 id (checked). The slug ↔ id map (with the round-1 and round-2 ids) lives only in \`r3/cohort.json\` (\`id_map\`, \`records[].source_slug\`, \`records[].history\`).

## 2. Counts

| Metric | Value |
|---|---|
| Records in cohort | ${counts.total} |
| Round-2 records carried | ${r2Records.length} |
| New round-5 capture records | ${newBuilt.length} |
| Evidence gate, all items | ${gate.pass} of ${counts.total} |

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

Round-2 unseen now calibration (${records.filter((r) => r.history.round3 && r.history.round3.round2_role === "unseen").length}): ${records.filter((r) => r.history.round3 && r.history.round3.round2_role === "unseen").map((r) => "`" + r.source_slug + "`").sort().join(", ")}. No new unseen slots this round (unseen records: ${roleList("unseen").length}).

New round-5 records (${newBuilt.length}): ${newBuilt.map((r) => "`" + r.source_slug + "`").sort().join(", ")}.

Negative controls (${roleList("negative_control").length}, unchanged): ${roleList("negative_control").join(", ")}.

## 3. Patches applied (one line each)

${patchLog.map((p) => "- **" + p.id + "** `" + p.slug + "` - " + p.status + ": " + p.detail).join("\n")}

## 4. Available but not applied (outside the brief)

${notApplied.map((x) => "- " + x).join("\n")}

## 5. Evidence gate (standard 4.1, RG2-24), computed from the S0 packets

| Criterion | Records |
|---|---|
| C1/C2 promise line present | ${gate.promise} of ${counts.total} |
| \`directions_status: verbatim\` | ${gate.dir} of ${counts.total} |
| No INCI incompleteness flag above the tail | ${gate.inci} of ${counts.total} |
| \`identity_status\` not a conflict | ${gate.identity} of ${counts.total} |
| **All items** | **${gate.pass} of ${counts.total}** |

Pass by role: ${Object.entries(gate.by_role).map(([k, v]) => v + " " + k).join(", ")}. Pass by origin: ${Object.entries(gate.by_origin).map(([k, v]) => v + " " + k).join(", ")}.

Tail-only INCI defects (RG2-24: flagged, review \`inci_tail_defect\`, not blocking; the defect sits below the first Parfum/Fragrance rank, a T_S class member): ${list(gate.tail_only)}.

Gate outcome changed against round 2 (${gateChanged.length}): ${list(gateChanged)}.

Records whose only C1/C2 promise lines are fully masked to \`[CLAIM]\`: ${list(gate.promise_only_claim_markers.map((s) => "`" + s + "`"))}.

Not passing (${gate.failing.length}): ${list(gate.failing)}.

New records whose capture flag \`passes_three_evidence_items\` disagrees with the computed gate: ${list(gate.capture_disagree)}.

## 6. P2-4 transcription repairs (${repairLog.length})

${repairLog.map((x) => "- `" + x.slug + "` - " + x.text).join("\n") || "none"}

Rule: a list item that is no INCI name of its own (it occurs in no other record) is re-joined with its neighbour when the joined form (no glue, „-" or a space) is an INCI name in another record; a locant split („1" + „2-Hexanediol") is re-joined with a comma; an in-token hyphenation artifact („Tri-heptanoin") is repaired when only the de-hyphenated form is a known name. The list is renumbered; \`as_written\` keeps both fragments.

## 7. S0 masking (R2-Q3, standard 10.2) and the job-word check

Masked in S0 promise and heat lines, the confirmed name and the directions: hold numbers and scales (Halt 5 ⇒ „Halt [CLAIM]", Haltegrad/Haltestufe, x/5, 5+, dots), hold strengths next to a hold word („[CLAIM] Halt", „[CLAIM] Kontrolle") and, in the name, a strength word that ends the name or qualifies the product noun (RG-13), flexibility/rigidity words (flex…, beweglich, elastisch/Elastizität, (ver)formbar, nachstylbar, Kleber, Freeze, steif, betonhart, fest, wieder/neu stylen) and finish grades (glänzend as an adjective, matt and its compounds — only the grading part of a compound, so „Mattpaste" ⇒ „[CLAIM]paste" —, natürlich next to Finish/Look/Glanz, Wet Look, glossy, shiny, schimmernd, brillant, satin, the Spiegel-/Hoch- prefix of Glanz). Kept: job nouns and job words (Glanz, Shine, Gloss, Finish, Haarspray, Wachs, Puder, Gel, Schaum, Paste, Halt as a noun, Volumen, Locken, Definition, Frizz, glatt …), durations, feel and care words. ${s0Stats.promise_lines_masked} promise lines on ${s0Stats.packets_with_masked_promise} S0 packets carry a mask (${s0Stats.replacements} replacements); ${s0Stats.names_masked} confirmed names and ${s0Stats.directions_masked} directions texts carry one. The unmasked confirmed name is in every claims packet (\`confirmed_name\`, \`confirmed_name_tier\`).

Job-word check, round-2 packets (before) vs round-3 packets (after):

| Check | Round 2 (${r2Base.length} records) | Round 3 (${records.length} records) |
|---|---|---|
| Method A (round-2 \`s0_redaction_check\`, reproduced: lead line + name; counts matt/flex as job words): records losing ≥ 1 job word | ${b.diff_records_with_a_lost_job_word} | ${a.diff_records_with_a_lost_job_word} |
| Method A: complete lead-job loss | ${b.diff_records_with_complete_lead_job_loss} (${b.diff_complete_loss_slugs.join(", ") || "none"}) | ${a.diff_records_with_complete_lead_job_loss} (${a.diff_complete_loss_slugs.join(", ") || "none"}) |
| Method B (new; name + every C1/C2 promise and heat line; job-bearing words only): records with a job word in the capture | ${b.job_records_with_job_words_in_capture} | ${a.job_records_with_job_words_in_capture} |
| **Method B: records with zero job words in S0 where the capture had one** | **${b.job_records_zero_job_words_in_s0_where_capture_had_one.length}** (${b.job_records_zero_job_words_in_s0_where_capture_had_one.join(", ") || "none"}) | **${a.job_records_zero_job_words_in_s0_where_capture_had_one.length}** |
| Method B: records losing ≥ 1 job word | ${b.job_records_losing_at_least_one_job_word} | ${a.job_records_losing_at_least_one_job_word} |

Method A still counts graded words (matt, flex…) and graded hold phrases as "lost" by design of the round-2 check; the round-3 losses under method A are: ${list(lostAfterDiff)}. Method B losses after masking (job words that occur only inside a masked grading phrase): ${list(lostAfter)}.

## 8. Leak checks (all packets)

| Check | Hits |
|---|---|
${leakLines}
| **Total** | **${leakTotal}** |

S0 checks run on the confirmed name, directions, promise and heat lines after masking: \`s0_hold_number_or_scale\` (Halt/Hold + number, x/y, n+, Haltegrad/-stufe, dots), \`s0_strength_word\` (a strength word next to a hold word or after „Halt:", „krass" anywhere, or a strength word left in the name by the RG-13 name test), \`s0_flexibility_word\`, \`s0_finish_grade\`, \`s0_label\` (round/filter/draft/lane/cohort labels). Packet-wide: \`fu_brand_name\` (round-1 residual brand/name check on F/U directions), \`claims_annotation\`, \`slug\`, \`round1_or_round2_id\`, \`url\`, \`forbidden_key\`, \`subtype_or_route_id\`, \`any_label\`.
Strength words that grade something other than hold (volume, texture, damage, the hair itself) are not grading words under R2-Q3 and stay visible; listed for review (${uniq(strengthElsewhere).length}): ${list(uniq(strengthElsewhere).sort())}.
${leakTotal ? "\nHits:\n\n" + Object.entries(leaks).flatMap(([k, v]) => v.map((x) => "- " + k + ": " + (typeof x === "string" ? x : JSON.stringify(x)))).join("\n") : ""}

## 9. Packet field lists

All packets: one JSON file per product, \`r3/packets/<kind>/<opaque id>.json\`.

### 9.1 S0 (\`packets/s0/\`)

${fieldList(s0Sample, "").join("\n")}

\`identity.inci_flags\` is always present (empty when the record has no flag; RG2-24, P2-3). \`identity_status\` + \`inci_alt\` appear only for \`inci_conflict\`; \`identity_status\` + \`identity_note\` only for \`verified_with_minor_source_difference\`.

### 9.2 F/U (\`packets/fu/\`)

${fieldList(fuSample, "").join("\n")}

F/U directions keep the round-1 masking (brand, name, look/strength words → \`[CLAIM]\`), extended for the new products by ${Object.entries(R3_EXTRA_MASK).map(([k, v]) => "`" + k + "`: " + v.join(", ")).join("; ")}.

### 9.3 Claims (\`packets/claims/\`)

${fieldList(clSample, "").join("\n")}

## 10. Notes for the owner

1. The S0 hold mask keeps the noun „Halt"/„Hold" and masks only the grade („starker Halt" ⇒ „[CLAIM] Halt", „Halt 5" ⇒ „Halt [CLAIM]"), so the hold job stays readable (standard 10.2: „only the grading part is masked, so the job noun stays readable"). Durations are no longer masked (they are not grading words under R2-Q3).
2. Wella EIMI Fresh Up's intro line „Frische deine Locken auf und erhalte Definition, Glanz und Anti-Frizz-Effekt." is now typed \`promise\` (the re-check calls it the page's promise line), so it enters the S0 packet.
3. Name-derived claims after the two renames and for the new products: ${nameTableR3.map((x) => "`" + x.slug + "` „" + x.word + "\" (" + (x.kept ? x.type : "rejected: " + x.why) + ")").join(", ") || "none"}.
4. Still \`inci_conflict\` (unchanged from round 2): ${records.filter((r) => r.identity.identity_status === "inci_conflict").map((r) => "\`" + r.source_slug + "\`").sort().join(", ")}.

## 11. Reproduction

\`node data/research/styling-inci/v1.0/build/freeze-cohort-r3.js\` rewrites \`r3/\` only; two consecutive runs give byte-identical output. \`r3/artifact-manifest.json\` records the SHA-256 of every input (round-1 and round-2 inputs, the round-4/5/6 capture files, both earlier scripts), of this script and of every output.
`;
writeOut("FREEZE-NOTES.md", notes);
const manifest = {
  manifest_version: COHORT_VERSION,
  frozen_on: FREEZE_DATE,
  algorithm: "sha256",
  script: { path: "v1.0/build/freeze-cohort-r3.js", sha256: sha256(fs.readFileSync(__filename)) },
  inputs: cohort.inputs,
  round2_rebuild_check: cohort.round2_rebuild_check,
  counts: { packets_s0: packets.s0.length, packets_fu: packets.fu.length, packets_claims: packets.claims.length, cohort_records: records.length },
  artifacts: written.slice().sort(cmp).map((r) => ({ path: "r3/" + r, sha256: sha256(fs.readFileSync(path.join(OUT, r))) })),
};
fs.writeFileSync(path.join(OUT, "artifact-manifest.json"), ser(manifest));
const rootHash = sha256(Buffer.from(manifest.artifacts.map((x) => x.path + ":" + x.sha256).join("\n")));
console.log(JSON.stringify({ records: records.length, by_role: counts.by_role, by_origin: counts.by_origin, evidence_gate_pass: gate.pass, gate_changed_vs_r2: gateChanged, repairs: repairLog.length, job_check: { before: { diff_lost: b.diff_records_with_a_lost_job_word, diff_complete: b.diff_records_with_complete_lead_job_loss, zero_job: b.job_records_zero_job_words_in_s0_where_capture_had_one.length }, after: { diff_lost: a.diff_records_with_a_lost_job_word, diff_complete: a.diff_records_with_complete_lead_job_loss, zero_job: a.job_records_zero_job_words_in_s0_where_capture_had_one.length } }, leak_total: leakTotal, leaks: Object.fromEntries(Object.entries(leaks).map(([k, v]) => [k, v.length])), r6_unused: r6Unused, packets: manifest.counts, manifest_root_sha256: rootHash, manifest_file_sha256: sha256(fs.readFileSync(path.join(OUT, "artifact-manifest.json"))) }, null, 2));
