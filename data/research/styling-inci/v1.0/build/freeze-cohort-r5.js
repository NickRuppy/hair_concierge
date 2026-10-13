#!/usr/bin/env node
// Styling research engine - round-5 (final confirmation round) cohort freeze (standard v0.5, lexicon v0.5).
//   node data/research/styling-inci/v1.0/build/freeze-cohort-r5.js
// Rebuilds the 143 round-4 records by running build/freeze-cohort-r4.js unchanged inside a sandbox whose file
// writes go to memory (the round-4 outputs on disk are compared byte-for-byte and never written; the round-4
// script itself rebuilds rounds 3, 2 and 1 the same way), applies the round-4 packet issues P4-1...P4-4, and
// writes everything under v1.0/r5/ only: cohort.json, packets/{s0,fu,claims}/, artifact-manifest.json, FREEZE-NOTES.md.
// Deterministic: no clock, no randomness, sorted iteration. It never reads v1.0/sealed/ and never classifies
// (no route, subtype or hold level is assigned; the R4-Q1 name readings in section 5 are reference counts only).
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const V1 = path.resolve(__dirname, "..");
const BASE = path.resolve(V1, "..");
const OUT = path.join(V1, "r5");
const R4_SCRIPT = path.join(__dirname, "freeze-cohort-r4.js");
const R4_OUT = path.join(V1, "r4");
const FREEZE_DATE = "2026-10-13";
const COHORT_VERSION = "styling-inci-v1.0-cohort-5";
const STANDARD_VERSION = "styling-inci-v0.5";
const LEXICON_VERSION = "styling-lexicon-v0.5";
const ID_SALT = "styling-inci-v1.0-cohort-5/opaque-id/"; // new salt: no round-5 id may equal a round-1...4 id

// ---------------------------------------------------------------------------------------------
// Round 4 (and through it rounds 3, 2 and 1), rebuilt from its own inputs inside a sandbox
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
const ctx = vm.createContext({ require: (m) => (m === "fs" ? sandboxFs : require(m)), __dirname: path.dirname(R4_SCRIPT), __filename: R4_SCRIPT, console: { log: () => {} }, Buffer });
vm.runInContext(fs.readFileSync(R4_SCRIPT, "utf8"), ctx, { filename: R4_SCRIPT });
const R4 = (name) => vm.runInContext(name, ctx);
const round4Check = { files: 0, identical: 0, differing: [] };
for (const k of [...mem.keys()].sort()) {
  if (!k.startsWith(R4_OUT + path.sep)) continue;
  round4Check.files++;
  if (fs.existsSync(k) && fs.readFileSync(k).equals(mem.get(k))) round4Check.identical++;
  else round4Check.differing.push(path.relative(V1, k));
}
if (round4Check.differing.length || !round4Check.files) throw new Error("round-4 rebuild differs from round-4 outputs on disk: " + round4Check.differing.join(", "));

const sha256 = R4("sha256");
const packetText = R4("packetText");
const maskDirections = R4("maskDirections");
const leakCheck = R4("leakCheck");
const sourceClass = R4("sourceClass");
const isC12 = R4("isC12");
const productTypeWord = R4("productTypeWord");
const dirBlock = R4("dirBlock");
const fieldList = R4("fieldList");
const HFF_RE = R4("HFF_RE");
const HOLD_NUMBER_RE = R4("HOLD_NUMBER_RE");
const mk = R4("mk");
const srcHost = R4("srcHost");
const INCOMPLETE_FLAG_RE = R4("INCOMPLETE_FLAG_RE");
const CLAIMS_LEAK_RE = R4("CLAIMS_LEAK_RE");
const ANY_LEAK_RE = R4("ANY_LEAK_RE");
const FORBIDDEN_KEYS = R4("FORBIDDEN_KEYS");
const maskS0 = R4("maskS0");
const S0_LEAK = R4("S0_LEAK");
const nameStrengthLeft = R4("nameStrengthLeft");
const STRENGTH_ELSEWHERE = R4("STRENGTH_ELSEWHERE");
const diffMethod = R4("diffMethod");
const jobCheck = R4("jobCheck");
const displayForPacket = R4("displayForPacket");
const flagRank = R4("flagRank");
const srcClassOf = R4("srcClassOf");
const nameTierOf = R4("nameTierOf");
const packetIdentityStatus = R4("packetIdentityStatus");
const R4_GENERIC_NAME_HITS = R4("R4_GENERIC_NAME_HITS");
const typeOrder = R4("typeOrder");
const R1_IDS = new Set(R4("[...R1_IDS]"));
const R2_IDS = new Set(R4("[...R2_IDS]"));
const R3_IDS = new Set(R4("[...R3_IDS]"));
const R4_INPUTS = JSON.parse(JSON.stringify(R4("INPUTS")));
const R4_EXCLUSIONS = JSON.parse(JSON.stringify(R4("exclusions")));
const r4Records = JSON.parse(JSON.stringify(R4("records")));
const r4Base = JSON.parse(JSON.stringify(R4("records"))); // untouched copy for the before/after checks
const R4_IDS = new Set(r4Records.map((r) => r.sample_id));
const R4_ID_BY_SLUG = Object.fromEntries(r4Records.map((r) => [r.source_slug, r.sample_id]));
const r4IdMap = Object.fromEntries(JSON.parse(JSON.stringify(R4("cohort.id_map"))).map((x) => [x.source_slug, x]));
const r4Disk = JSON.parse(fs.readFileSync(path.join(R4_OUT, "cohort.json"), "utf8"));
if (JSON.stringify(r4Disk.records) !== JSON.stringify(r4Records)) throw new Error("round-4 in-memory records differ from r4/cohort.json");
const r4Packets = { s0: {}, fu: {}, claims: {} }; // round-4 packets on disk, for the before/after comparisons
for (const kind of ["s0", "fu", "claims"]) for (const f of fs.readdirSync(path.join(R4_OUT, "packets", kind)).sort()) r4Packets[kind][f.replace(/\.json$/, "")] = JSON.parse(fs.readFileSync(path.join(R4_OUT, "packets", kind, f), "utf8"));

const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const uniq = (a) => [...new Set(a)];
const sortKeys = (o) => Object.fromEntries(Object.entries(o).sort((a, b) => cmp(a[0], b[0])));
const count = (arr, f) => arr.reduce((m, x) => ((m[f(x)] = (m[f(x)] || 0) + 1), m), {});
const patchLog = [];
const logPatch = (id, slug, status, detail) => patchLog.push({ id, slug, status, detail });
const notApplied = [];

// ---------------------------------------------------------------------------------------------
// Base: the 143 round-4 records
// ---------------------------------------------------------------------------------------------
const bySlug = {};
for (const r of r4Records) {
  r.history = r.history || {};
  r.history.round5 = { round4_sample_id: r.sample_id, round4_role: r.cohort_role, round4_standard_version: r.standard_version, round4_lexicon_version: r.lexicon_version };
  delete r.s0_redacted_name;
  delete r.s0_redacted_directions;
  delete r.evidence_gate_inputs;
  delete r.identity.inci_flag_ranks;
  for (const c of r.claims) delete c.s0_redacted_text;
  bySlug[r.source_slug] = r;
}
const R = (slug) => {
  if (!bySlug[slug]) throw new Error("round-4 record missing: " + slug);
  return bySlug[slug];
};
const records = r4Records;
const addReview = (r, flag) => (r.identity.review_flags = uniq((r.identity.review_flags || []).concat([flag])));

// ---------------------------------------------------------------------------------------------
// P4-1: directions outside the G1 hierarchy (a C5 non-German manufacturer page) are not captured directions
// ---------------------------------------------------------------------------------------------
const P41 = [];
for (const r of records.slice().sort((a, b) => cmp(a.source_slug, b.source_slug))) {
  if (r.directions.directions_status === "missing" || r.directions.tier !== "C5") continue;
  r.history.round5.removed_directions = JSON.parse(JSON.stringify(r.directions));
  r.directions = {
    text: null,
    directions_status: "missing",
    directions_verbatim: false,
    status_note: "P4-1 (standard 2.2 A14): the only captured directions come from " + (r.directions.source_host || r.directions.source) + " (C5, a non-German manufacturer page), which is outside the LI 2.4 G1 directions hierarchy (pack -> German manufacturer -> exact-GTIN German retailer -> other German/EU retailer). Not captured directions for the S0 evidence gate or the U fields; the text is kept under history.round5.removed_directions. Remedy: German directions from the pack back or a German retailer",
    tier: null,
    source: null,
    source_host: null,
    date: null,
    basis: "P4-1: C5 directions not used",
    language_note: r.directions.language_note,
  };
  addReview(r, "directions_outside_g1_tier");
  P41.push({ slug: r.source_slug, host: r.history.round5.removed_directions.source_host, text: r.history.round5.removed_directions.text });
}
if (!P41.some((x) => x.slug === "american-crew-pomade")) throw new Error("P4-1: American Crew Pomade not found with C5 directions");
logPatch("P4-1", P41.map((x) => x.slug).join(", "), "applied", P41.length + " record(s) with directions from a C5 page: directions_status 'verbatim' -> 'missing' in the record and in both the S0 and the F/U packet (the G1 hierarchy binds the U fields too, LI 2.4: missing directions are a documented gap, U fields unresolved); the C5 text („" + P41.map((x) => x.text.slice(0, 60)).join("…\"; „") + "…\", " + uniq(P41.map((x) => x.host)).join(", ") + ") is kept under history.round5.removed_directions; review directions_outside_g1_tier");

// ---------------------------------------------------------------------------------------------
// P4-2: protection-from-heat sentences inside a C1/C2 promise line are typed as heat_protection claims
// ---------------------------------------------------------------------------------------------
const HEAT_SPLIT = {
  "kms-thermashape-2-in-1-spray": "Reduziert Hitzeschädigungen und Haarbruch.",
  "osis-sparkler": "Es reduziert Frizz und entwirrt, während es gleichzeitig vor Feuchtigkeit und Hitze bis zu 230°C schützt.",
};
const P42 = [];
for (const slug of Object.keys(HEAT_SPLIT).sort()) {
  const r = R(slug);
  const sentence = HEAT_SPLIT[slug];
  if (r.claims.some((c) => c.type === "heat_protection" && isC12(c.tier))) throw new Error("P4-2: " + slug + " already has a C1/C2 heat claim");
  const host = r.claims.filter((c) => c.type === "promise" && isC12(c.tier) && String(c.raw).includes(sentence));
  if (host.length !== 1) throw new Error("P4-2: heat sentence not in exactly one C1/C2 promise line: " + slug);
  const src = host[0];
  r.claims.push(mk({ type: "heat_protection", raw: sentence, tier: src.tier, source: src.source, date: src.date, tier_basis: "P4-2: protection-from-heat sentence of the captured " + src.tier + " promise line „" + src.raw.slice(0, 80) + "…\" (same source), typed as a heat claim; the promise line keeps its full text" }));
  P42.push({ slug, sentence, tier: src.tier });
}
logPatch("P4-2", Object.keys(HEAT_SPLIT).sort().join(", "), "applied", P42.map((x) => "`" + x.slug + "`: „" + x.sentence + "\" ⇒ own " + x.tier + " heat_protection claim").join("; ") + "; the S0 packet carries them under heat_protection_claims_c1_c2 and the claims packet as type heat_protection; the promise lines are unchanged");

// ---------------------------------------------------------------------------------------------
// P4-3: every promise line carries its position where the capture records it; otherwise 'unknown'
// ---------------------------------------------------------------------------------------------
// Read only from the capture's own labels (tier_basis / capture_note); a position is never guessed.
const POSITION_RULES = [
  { re: /pack_front\w*|pack front/i, pos: "pack_front" },
  { re: /\bpack_back_headline\b/i, pos: "headline" },
  { re: /\bdm bullet\b|\bdm_bullets\b/i, pos: "bullet" },
  { re: /\bpack_back_(?:other|geschmeidigkeit)\b/i, pos: "body" },
];
const positionOf = (c) => {
  const t = [c.tier_basis, c.capture_note].filter(Boolean).join(" ## ");
  for (const rule of POSITION_RULES) {
    const m = t.match(rule.re);
    if (m) return { position: rule.pos, basis: "capture label „" + m[0] + "\"" };
  }
  return { position: "unknown", basis: "the capture records no position for this line" };
};
const posRows = [];
for (const r of records.slice().sort((a, b) => cmp(a.source_slug, b.source_slug))) {
  for (const c of r.claims) {
    if (c.type !== "promise") continue;
    const p = positionOf(c);
    c.position = p.position;
    c.position_basis = "P4-3: " + p.basis;
    posRows.push({ slug: r.source_slug, tier: c.tier, position: p.position, c12: isC12(c.tier), raw: c.raw, basis: p.basis });
  }
}
const posCount = sortKeys(count(posRows, (x) => x.position));
const posCountC12 = sortKeys(count(posRows.filter((x) => x.c12), (x) => x.position));
const c1Records = uniq(posRows.filter((x) => x.tier === "C1").map((x) => x.slug));
const c1WithFront = uniq(posRows.filter((x) => x.tier === "C1" && x.position === "pack_front").map((x) => x.slug));
logPatch("P4-3", "(all records)", "applied", posRows.length + " promise lines carry `position` (" + Object.entries(posCount).map(([k, v]) => v + " " + k).join(", ") + "); C1/C2 lines in the S0 packets: " + Object.entries(posCountC12).map(([k, v]) => v + " " + k).join(", ") + "; read only from the capture's own labels (record field position_basis), never guessed");

// ---------------------------------------------------------------------------------------------
// P4-4: got2b Schutzengel's claims-packet product_type_word re-derived from the pack name
// ---------------------------------------------------------------------------------------------
const PTW_OVERRIDE = {};
{
  const r = R("got2b-hitzeschutzspray-schutzengel");
  const was = productTypeWord(r.identity.product_name, r.identity.format);
  if (was !== "gel" || !/\bSpray\b/.test(r.identity.product_name)) throw new Error("P4-4 precondition: " + was + " / " + r.identity.product_name);
  PTW_OVERRIDE[r.source_slug] = "spray";
  r.identity.product_type_word_override = "P4-4: the r7 pack name „" + r.identity.product_name + "\" names a spray; the token „Schutz-engel\" ends in „gel\" (the name rule's suffix match), which is not a product noun";
  logPatch("P4-4", r.source_slug, "applied", "claims-packet product_type_word „" + was + "\" -> „spray\" (pack name „" + r.identity.product_name + "\")");
}
// audit: every product_type_word that came from a suffix match inside a longer token (reported, not changed)
const ptwAudit = [];
for (const r of records.slice().sort((a, b) => cmp(a.source_slug, b.source_slug))) {
  const w = productTypeWord(r.identity.product_name, r.identity.format);
  const toks = r.identity.product_name.replace(/\([^)]*\)/g, " ").toLowerCase().split(/[^a-zäöüß-]+/).filter(Boolean);
  const tok = toks.find((t) => t === w || t.endsWith(w));
  if (tok && tok !== w) ptwAudit.push({ slug: r.source_slug, token: tok, word: w, fixed: !!PTW_OVERRIDE[r.source_slug] });
}
// reviewed by eye at freeze time: real compounds ending in the type noun (the suffix match is right); the build stops on a new one
const PTW_REVIEWED_COMPOUNDS = new Set(["crunchgel", "föhn-spray", "föhnlotion", "glanz-spray", "glattspray", "glättungscreme", "haargel", "haarpuder", "haarserum", "hitzeschutz-spray", "lockencreme", "mattpaste", "refresh-spray", "schild-spray", "shinespray", "styling-spray", "stylinggel", "stylingspray", "texturspray", "volumenpuder", "volumenspray", "wellenspray"]);
for (const x of ptwAudit) if (!x.fixed && !PTW_REVIEWED_COMPOUNDS.has(x.token)) throw new Error("product_type_word suffix match not reviewed: " + x.slug + " '" + x.token + "' -> " + x.word);
const ptwOf = (rec) => PTW_OVERRIDE[rec.source_slug] || productTypeWord(rec.identity.product_name, rec.identity.format);

// ---------------------------------------------------------------------------------------------
// Versions, ids, guards
// ---------------------------------------------------------------------------------------------
for (const r of records) {
  r.standard_version = STANDARD_VERSION;
  r.lexicon_version = LEXICON_VERSION;
  r.claims = r.claims.map((c, i) => [c, i]).sort((a, b) => typeOrder.indexOf(a[0].type) - typeOrder.indexOf(b[0].type) || a[1] - b[1]).map((x) => x[0]);
}
const exclusions = R4_EXCLUSIONS.map((e) => Object.assign({}, e, { status_in_round5: "unchanged from round 4" }));
{
  const idSet = new Set();
  for (const r of records) {
    r.sample_id = "sty-" + sha256(Buffer.from(ID_SALT + r.source_slug)).slice(0, 10);
    if (idSet.has(r.sample_id)) throw new Error("opaque id collision " + r.sample_id);
    for (const [label, set] of [["round-1", R1_IDS], ["round-2", R2_IDS], ["round-3", R3_IDS], ["round-4", R4_IDS]]) if (set.has(r.sample_id)) throw new Error("round-5 id equals a " + label + " id: " + r.sample_id);
    idSet.add(r.sample_id);
  }
  const slugs = new Set();
  for (const r of records) {
    if (slugs.has(r.source_slug)) throw new Error("duplicate slug " + r.source_slug);
    slugs.add(r.source_slug);
  }
  if (records.length !== 143) throw new Error("expected 143 records, got " + records.length);
  if (records.some((r) => r.cohort_role !== r.history.round5.round4_role)) throw new Error("a cohort role changed");
}
records.sort((a, b) => cmp(a.sample_id, b.sample_id));

// ---------------------------------------------------------------------------------------------
// Packets (round-4 builder, plus P4-1 directions, P4-2 heat claims, P4-3 positions, P4-4 type word)
// ---------------------------------------------------------------------------------------------
const packets = { s0: [], fu: [], claims: [] };
const leaks = { fu_brand_name: [], s0_hold_number_or_scale: [], s0_strength_word: [], s0_flexibility_word: [], s0_finish_grade: [], s0_label: [], claims_annotation: [], slug: [], round1_to_4_id: [], url: [], forbidden_key: [], subtype_or_route_id: [], any_label: [] };
const s0Stats = { promise_lines_masked: 0, packets_with_masked_promise: 0, replacements: 0, names_masked: 0, directions_masked: 0 };
const strengthElsewhere = [];
const genericNameHits = [];
const subtypeIds = uniq(records.map((r) => r.reference_only_not_for_blind_lanes.draft_subtype).filter((x) => x && /_/.test(x))).concat(["leave_in", "heat_protectant", "dry_shampoo", "provisional_boundary", "negative_control", "salt_spray", "texture_spray", "shine_finish", "smoothing_styler", "curl_cream"]);
const allSlugs = records.map((r) => r.source_slug);
const priorIds = new Set([...R1_IDS, ...R2_IDS, ...R3_IDS, ...R4_IDS]);
for (const rec of records) {
  const id = rec.sample_id;
  const inciBlock = { inci_item_count: rec.identity.inci_normalised.length, tier: rec.identity.inci_source.tier, source_class: sourceClass(rec.identity.inci_source.tier), date: rec.identity.inci_source.date, items: rec.identity.inci_normalised.map((x) => ({ rank: x.rank, inci: x.inci })) };
  const promise = [];
  let redCount = 0;
  for (const c of rec.claims) {
    if (c.type !== "promise" || !isC12(c.tier)) continue;
    const red = maskS0(packetText(c.raw), false);
    redCount += red.count;
    if (red.count) s0Stats.promise_lines_masked++;
    c.s0_redacted_text = red.text;
    promise.push(Object.assign({ text: red.text, redacted: red.count > 0, tier: c.tier, source_class: srcClassOf(c), date: c.date, position: c.position }, c.flags ? { flags: c.flags } : {}, c.mixed_source ? { mixed_source: true } : {}));
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
  const nt = nameTierOf(rec);
  const product = { confirmed_name: nameRed.text, confirmed_name_redacted: nameRed.count > 0, confirmed_name_tier: nt, brand: rec.identity.brand, format: rec.identity.format };
  if (nt === "C3") {
    product.confirmed_name_from_retailer_title = true;
    product.retailer_title_type_noun_agrees = rec.identity.retailer_title_type_noun_agrees === true;
  }
  const identity = { identity_status: packetIdentityStatus(rec) };
  if (rec.identity.identity_status === "inci_conflict") identity.inci_alt = { items: rec.identity.inci_alt.inci_normalised.map((x) => ({ rank: x.rank, inci: x.inci })), note: "second capture of the same product with a different list; the list in 'inci' is the one read from the newer/higher-tier source" };
  else if (!["as_captured"].includes(rec.identity.identity_status)) identity.identity_note = rec.identity.s0_identity_note || "two INCI lists were captured for this GTIN; a dated C1 pack capture carrying the GTIN is the formula of record (standard 2.2 A2 release test)";
  identity.inci_flags = rec.identity.inci_flag_ranks.map((x) => Object.assign({ flag: x.flag, defect_rank: x.defect_rank }, /^capture_item_count_resolved \(P3-6|^repaired_missing_(?:space|slash) \(P3-3/.test(x.flag) ? { status: "resolved_by_freeze" } : {}));
  const s0 = {
    packet: "s0",
    packet_version: COHORT_VERSION,
    sample_id: id,
    product,
    identity,
    inci: inciBlock,
    directions_status: rec.directions.directions_status,
    directions: s0dir,
    promise_claims_c1_c2: promise,
    heat_protection_claims_c1_c2: heat,
  };
  if (rec.identity.identity_status === "inci_conflict") {
    s0.identity_status = "inci_conflict";
    s0.inci_alt = identity.inci_alt;
  } else if (rec.identity.identity_status !== "as_captured") {
    s0.identity_status = rec.identity.identity_status;
    s0.identity_note = identity.identity_note;
  }
  packets.s0.push({ id, body: s0, rec });
  // F/U (round-1 masking, unchanged)
  const masked = maskDirections(rec.directions.text, rec.identity.brand, rec.identity.product_name, rec.source_slug);
  const fu = { packet: "fu", packet_version: COHORT_VERSION, sample_id: id, format: rec.identity.format, inci: inciBlock, directions_status: rec.directions.directions_status, directions: dirBlock(rec, masked.text, true) };
  const lkAll = leakCheck(masked.text, rec);
  const lk = lkAll.filter((h) => !R4_GENERIC_NAME_HITS.includes(h));
  for (const h of lkAll.filter((x) => R4_GENERIC_NAME_HITS.includes(x))) genericNameHits.push("`" + rec.source_slug + "` " + h.replace(/^name:/, "„") + "…\"");
  if (lk.length) leaks.fu_brand_name.push({ slug: rec.source_slug, hits: lk, text: masked.text });
  packets.fu.push({ id, body: fu, rec });
  // claims (R2-Q3: plus the unmasked confirmed name)
  const cl = [];
  for (const c of rec.claims) {
    if (c.type === "free_from" || c.type === "hair_type") continue;
    if (c.type === "other" && !(HFF_RE.test(c.raw) || HOLD_NUMBER_RE.test(c.raw))) continue;
    const o = { type: c.type, text: packetText(c.raw), tier: c.tier, source_class: srcClassOf(c), source_host: c.from_product_name ? null : srcHost(c.source), date: c.date };
    if (c.type === "promise") o.position = c.position; // P4-3
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
  const cp = { packet: "claims", packet_version: COHORT_VERSION, sample_id: id, brand: rec.identity.brand, confirmed_name: rec.identity.product_name, confirmed_name_tier: nt, format: rec.identity.format, product_type_word: ptwOf(rec), scale_info: scaleHold ? { number: scaleHold.number, scale_as_written: scaleHold.scale_as_written, scale_max: scaleHold.scale_max, scale_max_stated: scaleHold.scale_max_stated, tier: scaleHold.tier } : null, claims: cl };
  if (nt === "C3") cp.retailer_title_type_noun_agrees = rec.identity.retailer_title_type_noun_agrees === true;
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
    for (const rid of priorIds) if (ser.includes(rid)) leaks.round1_to_4_id.push(kind + "/" + p.id + ": " + rid);
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
if (leakTotal) throw new Error("leak check hits: " + JSON.stringify(leaks, null, 1).slice(0, 4000));
// guards: P3-1 kept; P4-1 C5 directions absent from every packet; P4-3 position on every promise line
for (const p of packets.s0) {
  if (!p.body.identity.identity_status) throw new Error("P3-1: no identity.identity_status in " + p.id);
  if (p.rec.identity.identity_status === "inci_conflict" && !p.body.identity.inci_alt) throw new Error("P3-1: no identity.inci_alt in " + p.id);
  if (p.body.directions && p.body.directions.tier === "C5") throw new Error("P4-1: C5 directions in S0 packet " + p.id);
  if (p.body.promise_claims_c1_c2.some((x) => !x.position)) throw new Error("P4-3: promise line without position in " + p.id);
}
for (const p of packets.fu) if (p.body.directions && p.body.directions.tier === "C5") throw new Error("P4-1: C5 directions in F/U packet " + p.id);
for (const p of packets.claims) if (p.body.claims.some((x) => x.type === "promise" && !x.position)) throw new Error("P4-3: promise line without position in claims " + p.id);

// ---------------------------------------------------------------------------------------------
// S0 job-word check (before = round-4 records, after = round-5 records; same masking)
// ---------------------------------------------------------------------------------------------
const s0Mask = (t, isName) => (t == null ? null : maskS0(t, isName).text);
const summarise = (j) => ({
  diff_records_with_a_lost_job_word: j.diff.filter(([, x]) => x && x.any_lost).length,
  diff_records_with_complete_lead_job_loss: j.diff.filter(([, x]) => x && x.complete).length,
  diff_complete_loss_slugs: j.diff.filter(([, x]) => x && x.complete).map(([s]) => s).sort(),
  job_records_with_job_words_in_capture: j.job.filter(([, x]) => x.raw > 0).length,
  job_records_zero_job_words_in_s0_where_capture_had_one: j.job.filter(([, x]) => x.raw > 0 && x.s0 === 0).map(([s]) => s).sort(),
  job_records_losing_at_least_one_job_word: j.job.filter(([, x]) => x.lost.length).length,
});
const jobBefore = { diff: r4Base.map((r) => [r.source_slug, diffMethod(r, s0Mask)]), job: r4Base.map((r) => [r.source_slug, jobCheck(r, s0Mask)]) };
const jobAfter = { diff: records.map((r) => [r.source_slug, diffMethod(r, s0Mask)]), job: records.map((r) => [r.source_slug, jobCheck(r, s0Mask)]) };
const jobSummary = { before_round4: summarise(jobBefore), after_round5: summarise(jobAfter) };
const lostAfter = jobAfter.job.filter(([, x]) => x.lost.length).map(([s, x]) => s + " (" + x.lost.join(", ") + ")").sort();
if (jobSummary.after_round5.job_records_zero_job_words_in_s0_where_capture_had_one.length) throw new Error("S0 records with zero job words: " + jobSummary.after_round5.job_records_zero_job_words_in_s0_where_capture_had_one.join(", "));

// ---------------------------------------------------------------------------------------------
// Evidence gate (standard 4.1 + RG2-24 + RG3-15 + P4-1), computed from the S0 packets.
// Input 1 is counted twice: (a) a C1/C2 promise line (the round-4 count), and (b) also a C1/C2 confirmed name
// that names exactly one job (R4-Q1), read from the hand table below - a reference count only; the lanes decide.
// ---------------------------------------------------------------------------------------------
const NAME_ONE_JOB = {
  "american-crew-fiber": { reading: "one_job", why: "„FIBER\": one product noun (molding) - R4-Q1's example" },
  "american-crew-pomade": { reading: "one_job", why: "„Styling Pomade\": one product noun (molding)" },
  "kerastase-curl-manifesto-refresh-absolu": { reading: "one_job", why: "curl + refresh/refreshing name one job (curl revival) - R4-Q1's example" },
  "langhaarmaedchen-lockenspray-halt-sprungkraft": { reading: "several", why: "„LOCKENHALT SPRAY Halt & Sprungkraft\": curl, hold and Sprungkraft (volume) - several job words" },
  "redken-styling-beach-spray": { reading: "one_job", why: "„BEACH SPRAY BEACHY TEXTURE SPRAY\": beach/beachy + texture name one job, texture (R4-Q2)" },
  "bumble-and-bumble-brilliantine": { reading: "open", why: "„brilliantine\": a shine product noun (D2/SD3); R4-Q1 does not name it - standard 13.4 item 4; owner-named route either way" },
};
const parfumRank = (rec) => {
  const it = rec.identity.inci_normalised.find((x) => /^(parfum|fragrance|perfume)\b/i.test(x.inci));
  return it ? it.rank : null;
};
const C12_NAME_TIERS = ["C1", "C2", "C2_house_brand", "C2_cross_market_verified"];
const nameOnlyPop = [];
const gateRows = packets.s0.map((p) => {
  const r = p.rec;
  const b = p.body;
  const promise = b.promise_claims_c1_c2.length > 0;
  const promiseInformative = b.promise_claims_c1_c2.some((x) => x.text.replace(/\[CLAIM\]/g, "").replace(/[\s\W]+/g, "").length > 0);
  const nameC12 = C12_NAME_TIERS.includes(b.product.confirmed_name_tier);
  let nameReading = null;
  if (!promise && nameC12) {
    const t = NAME_ONE_JOB[r.source_slug];
    if (!t) throw new Error("R4-Q1 population: no hand reading for " + r.source_slug + " (name tier " + b.product.confirmed_name_tier + ")");
    nameReading = t.reading;
    nameOnlyPop.push({ slug: r.source_slug, name: r.identity.product_name, tier: b.product.confirmed_name_tier, reading: t.reading, why: t.why });
  }
  const dir = b.directions_status === "verbatim";
  const pr = parfumRank(r);
  const defects = r.identity.inci_flag_ranks.filter((x) => INCOMPLETE_FLAG_RE.test(x.flag)).map((x) => Object.assign({}, x, { below_parfum: pr != null && x.defect_rank != null && x.defect_rank > pr, parfum_rank: pr }));
  const blocking = defects.filter((x) => !x.below_parfum);
  const tailOnly = defects.filter((x) => x.below_parfum);
  const inciComplete = blocking.length === 0;
  const identityOk = ["as_captured", "verified", "verified_with_minor_source_difference"].includes(r.identity.identity_status);
  const pass = promise && dir && inciComplete && identityOk;
  const passQ1 = (promise || nameReading === "one_job") && dir && inciComplete && identityOk;
  if (tailOnly.length) r.identity.review_flags = uniq((r.identity.review_flags || []).concat(["inci_tail_defect"]));
  return { r, promise, promiseInformative, nameReading, dir, inciComplete, identityOk, pass, passQ1, tailOnly, blocking };
});
for (const s of Object.keys(NAME_ONE_JOB)) if (!nameOnlyPop.some((x) => x.slug === s)) throw new Error("R4-Q1 hand table names a record outside the population: " + s);
const gate = {
  pass: gateRows.filter((x) => x.pass).length,
  passQ1: gateRows.filter((x) => x.passQ1).length,
  promise: gateRows.filter((x) => x.promise).length,
  promise_only_claim_markers: gateRows.filter((x) => x.promise && !x.promiseInformative).map((x) => x.r.source_slug).sort(),
  dir: gateRows.filter((x) => x.dir).length,
  inci: gateRows.filter((x) => x.inciComplete).length,
  identity: gateRows.filter((x) => x.identityOk).length,
  tail_only: gateRows.filter((x) => x.tailOnly.length).map((x) => "`" + x.r.source_slug + "` (" + x.tailOnly.map((d) => "defect r" + d.defect_rank + " below Parfum r" + d.parfum_rank).join("; ") + ")").sort(),
  by_role: sortKeys(count(gateRows.filter((x) => x.pass), (x) => x.r.cohort_role)),
  q1_added: gateRows.filter((x) => x.passQ1 && !x.pass).map((x) => "`" + x.r.source_slug + "`").sort(),
  failing: gateRows.filter((x) => !x.pass).map((x) => "`" + x.r.source_slug + "` (" + x.r.cohort_role + "; " + [x.promise ? null : "no C1/C2 promise line" + (x.nameReading ? " (C1/C2 name: " + x.nameReading + ")" : ""), x.dir ? null : "directions " + x.r.directions.directions_status, x.inciComplete ? null : "INCI defect above the tail", x.identityOk ? null : "identity " + x.r.identity.identity_status].filter(Boolean).join(", ") + ")").sort(),
};
const r4GatePassBySlug = Object.fromEntries(r4Base.map((r) => [r.source_slug, r.evidence_gate_inputs.all_three]));
const r4GatePass = Object.values(r4GatePassBySlug).filter(Boolean).length;
const gateChanged = gateRows.filter((x) => r4GatePassBySlug[x.r.source_slug] !== x.pass).map((x) => "`" + x.r.source_slug + "` (" + (r4GatePassBySlug[x.r.source_slug] ? "pass" : "fail") + " -> " + (x.pass ? "pass" : "fail") + ")").sort();
const r4DirOkBlocked = gateRows.filter((x) => !x.dir && r4Base.find((b) => b.source_slug === x.r.source_slug).evidence_gate_inputs.directions_verbatim).map((x) => "`" + x.r.source_slug + "`");
for (const g of gateRows) g.r.evidence_gate_inputs = { c1_c2_promise_line: g.promise, c1_c2_name_reading_r4q1: g.nameReading, directions_verbatim: g.dir, inci_complete: g.inciComplete, inci_tail_defects: g.tailOnly.map((d) => d.flag), identity_status_ok: g.identityOk, all_three: g.pass, all_three_with_r4q1_name: g.passQ1 };

// records whose packet content changed against round 4 (the position field reported separately)
const stripIds = (o) => JSON.stringify(o).replace(/"sample_id":"sty-[0-9a-f]+"/, "").replace(/"packet_version":"[^"]*"/, "");
const noPos = (b) => {
  const c = JSON.parse(JSON.stringify(b));
  for (const x of c.promise_claims_c1_c2 || []) delete x.position;
  for (const x of c.claims || []) if (x.type === "promise") delete x.position;
  return c;
};
const changed = { s0: [], fu: [], claims: [] };
for (const kind of ["s0", "fu", "claims"]) {
  for (const p of packets[kind]) {
    const old = r4Packets[kind][p.rec.history.round5.round4_sample_id];
    if (!old) throw new Error("no round-4 packet for " + p.rec.source_slug);
    if (stripIds(noPos(p.body)) !== stripIds(old)) changed[kind].push(p.rec.source_slug);
  }
}
const s0WithPromise = packets.s0.filter((p) => p.body.promise_claims_c1_c2.length).length;

// ---------------------------------------------------------------------------------------------
// Write outputs (only under v1.0/r5/)
// ---------------------------------------------------------------------------------------------
const INPUTS = R4_INPUTS.concat(["v1.0/build/freeze-cohort-r4.js"]);
const counts = {
  total: records.length,
  by_role: sortKeys(count(records, (r) => r.cohort_role)),
  by_origin: sortKeys(count(records, (r) => r.reference_only_not_for_blind_lanes.origin)),
  by_role_and_origin: sortKeys(count(records, (r) => r.cohort_role + " / " + r.reference_only_not_for_blind_lanes.origin)),
  by_draft_subtype: sortKeys(count(records, (r) => r.reference_only_not_for_blind_lanes.draft_subtype)),
  by_identity_status: sortKeys(count(records, (r) => r.identity.identity_status)),
  by_directions_status: sortKeys(count(records, (r) => r.directions.directions_status)),
  by_confirmed_name_tier: sortKeys(count(records, (r) => nameTierOf(r))),
  promise_line_positions: posCount,
  promise_line_positions_c1_c2: posCountC12,
  evidence_gate_all_three: gate.pass,
  evidence_gate_all_three_with_r4q1_name_reading: gate.passQ1,
};
const cohort = {
  cohort_version: COHORT_VERSION,
  frozen_on: FREEZE_DATE,
  standard_version: STANDARD_VERSION,
  lexicon_version: LEXICON_VERSION,
  purpose: "Frozen round-5 (final confirmation round, R3-L / R4-L) cohort. REFERENCE INPUT ONLY: never give this file to a blind lane (it maps opaque ids to slugs and to round-1...4 ids and carries legacy labels).",
  counts,
  exclusions,
  patches: patchLog,
  not_applied: notApplied,
  rerun_scope: { s0_packet_changed: changed.s0.slice().sort(), fu_packet_changed: changed.fu.slice().sort(), claims_packet_changed: changed.claims.slice().sort(), note: "ignoring the `position` field every promise line gained (P4-3)" },
  r4q1_name_population: nameOnlyPop.slice().sort((a, b) => cmp(a.slug, b.slug)),
  product_type_word_suffix_audit: ptwAudit,
  s0_job_word_check: { summary: jobSummary, records_losing_a_job_word_after: lostAfter },
  inputs: INPUTS.map((f) => ({ path: f, sha256: sha256(fs.readFileSync(path.join(BASE, f))) })),
  round4_rebuild_check: { files_compared: round4Check.files, byte_identical: round4Check.identical, round4_manifest_sha256: sha256(fs.readFileSync(path.join(R4_OUT, "artifact-manifest.json"))) },
  id_map: records.map((r) => ({ sample_id: r.sample_id, source_slug: r.source_slug, round4_sample_id: R4_ID_BY_SLUG[r.source_slug] || null, round3_sample_id: (r4IdMap[r.source_slug] || {}).round3_sample_id || null, round2_sample_id: (r4IdMap[r.source_slug] || {}).round2_sample_id || null, round1_sample_id: (r4IdMap[r.source_slug] || {}).round1_sample_id || null })),
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
const esc = (s) => String(s).replace(/\|/g, "/");
const s0Sample = (packets.s0.find((p) => p.body.identity.inci_alt && p.body.directions && p.body.promise_claims_c1_c2.length) || packets.s0.find((p) => p.body.promise_claims_c1_c2.length) || packets.s0[0]).body;
const fuSample = packets.fu.find((p) => p.body.directions).body;
const clSample = (packets.claims.find((p) => p.body.claims.some((c) => c.display && c.display.description) && p.body.claims.some((c) => c.type === "promise")) || packets.claims.find((p) => p.body.claims.some((c) => c.type === "promise")) || packets.claims[0]).body;
const roleList = (role) => records.filter((r) => r.cohort_role === role).map((r) => "`" + r.source_slug + "`").sort();
const leakLines = Object.entries(leaks).map(([k, v]) => "| " + k + " | " + v.length + " |").join("\n");
const b = jobSummary.before_round4;
const a = jobSummary.after_round5;
const posKnown = posRows.filter((x) => x.position !== "unknown");
const notes = `# FREEZE-NOTES - Styling round-5 final confirmation cohort (${COHORT_VERSION})

Generated by \`build/freeze-cohort-r5.js\` (deterministic; re-run to reproduce every hash in \`r5/artifact-manifest.json\`). Frozen ${FREEZE_DATE}. Standard \`${STANDARD_VERSION}\`, lexicon \`${LEXICON_VERSION}\`. Round 5 is the final confirmation round under R3-L as narrowed by R4-L: only differences in user-facing fields count. Every number below is computed by the script. Nothing here is committed or locked, and nothing is classified (no route, subtype or hold level is assigned).

## 1. How the cohort was built

1. The round-4 script \`build/freeze-cohort-r4.js\` is run unchanged in a sandbox whose writes go to memory (it rebuilds rounds 3, 2 and 1 the same way). Its ${round4Check.files} round-4 outputs were compared with the files under \`r4/\` on disk: ${round4Check.identical} of ${round4Check.files} byte-identical (the build stops on any difference). Its ${r4Records.length} records are the base; no record is added or removed and every cohort role is kept (no unseen slots).
2. The round-4 packet issues P4-1…P4-4 are applied (section 3). No capture file is added: P4-1 removes non-G1 directions, P4-2 and P4-3 re-type and annotate captured lines, P4-4 re-derives one packet field.
3. Opaque ids: \`sty-\` + 10 hex of SHA-256(\`${ID_SALT}\` + slug). No round-5 id equals a round-1, -2, -3 or -4 id (checked). The slug ↔ id map (with the round-1…4 ids) lives only in \`r5/cohort.json\` (\`id_map\`, \`records[].source_slug\`, \`records[].history\`).
4. Versions: every record carries \`standard_version: ${STANDARD_VERSION}\` and \`lexicon_version: ${LEXICON_VERSION}\`. The v0.5 rule and lexicon changes (R4-Q1…R4-Q7, RG4-*) are rules for the lanes, not data changes; no frozen value was edited for them.

## 2. Counts

| Metric | Value |
|---|---|
| Records in cohort | ${counts.total} |
| Evidence gate, all items (input 1 = a C1/C2 promise line, as in round 4) | ${gate.pass} of ${counts.total} (round 4: ${r4GatePass}) |
| Evidence gate with input 1 also met by a one-job C1/C2 name (R4-Q1; hand readings, section 5) | ${gate.passQ1} of ${counts.total} |
| Promise lines with a recorded position (P4-3) | ${posKnown.length} of ${posRows.length} |
| Records whose S0 packet changed against round 4 (besides \`position\`) | ${changed.s0.length} |
| Records whose F/U packet changed against round 4 | ${changed.fu.length} |
| Records whose claims packet changed against round 4 (besides \`position\`) | ${changed.claims.length} |

By cohort role:

| Role | n |
|---|---|
${fmt(counts.by_role)}

By origin:

| Origin | n |
|---|---|
${fmt(counts.by_origin)}

By identity status (record; the S0 packet ships \`as_captured\` as \`verified\`):

| Status | n |
|---|---|
${fmt(counts.by_identity_status)}

By directions status:

| Status | n |
|---|---|
${fmt(counts.by_directions_status)}

By confirmed-name tier:

| Tier | n |
|---|---|
${fmt(counts.by_confirmed_name_tier)}

By draft subtype (reference only, never in a packet):

| Draft subtype | n |
|---|---|
${fmt(counts.by_draft_subtype)}

Negative controls (${roleList("negative_control").length}, unchanged): ${roleList("negative_control").join(", ")}. Unseen records: ${roleList("unseen").length}.

## 3. Patches applied (one line each)

${patchLog.map((p) => "- **" + p.id + "** `" + p.slug + "` - " + p.status + ": " + p.detail).join("\n")}

## 4. Available but not applied

- **RG4-2's opaque \`registry_row\` pointer in the S0 packet** is not built: R4-Q6's ruling text names brand + pack name (+ old retailer title) in the registry rows, which standard v0.5 §4.6 carries; whether the S0 packet should also point to a row is open (standard §13.4 item 1).
- **No re-capture.** American Crew Pomade's German directions (P4-1's remedy), the Redken Beach Spray German pack and pack-side positions for the lines whose capture records none (P4-3) are capture work, not freeze work; the records carry \`directions_status: missing\` and \`position: unknown\` until then.
- **product_type_word:** only P4-4's record is re-derived. Other names whose type word came from a suffix match inside a longer token are listed in section 8, not changed.
${notApplied.map((x) => "- " + x).join("\n")}

## 5. Evidence gate (standard 4.1, RG2-24, RG3-15, P4-1, R4-Q1), computed from the S0 packets

| Criterion | Records |
|---|---|
| C1/C2 promise line present | ${gate.promise} of ${counts.total} |
| \`directions_status: verbatim\` (G1 tiers only, P4-1) | ${gate.dir} of ${counts.total} |
| No INCI incompleteness flag above the tail | ${gate.inci} of ${counts.total} |
| \`identity_status\` not a conflict | ${gate.identity} of ${counts.total} |
| **All items (promise line)** | **${gate.pass} of ${counts.total}** (round 4: ${r4GatePass}) |
| **All items, input 1 also met by a one-job C1/C2 name (R4-Q1)** | **${gate.passQ1} of ${counts.total}** |

Pass by role (promise line): ${Object.entries(gate.by_role).map(([k, v]) => v + " " + k).join(", ")}.

Gate outcome changed against round 4 (promise-line count; ${gateChanged.length}): ${list(gateChanged)}. Records whose directions passed in round 4 and are \`missing\` now (P4-1): ${list(r4DirOkBlocked)}.

**R4-Q1 population** — S0 packets with a C1/C2 confirmed name and no C1/C2 promise line (${nameOnlyPop.length}); the reading of each name is a hand table in the script (reference only, never in a packet; the lanes apply R4-Q1 themselves):

| Product | Name | Tier | Reading | Why |
|---|---|---|---|---|
${nameOnlyPop.slice().sort((x, y) => cmp(x.slug, y.slug)).map((x) => "| `" + x.slug + "` | " + esc(x.name) + " | " + x.tier + " | " + x.reading + " | " + esc(x.why) + " |").join("\n")}

Passing only with the R4-Q1 name reading (${gate.q1_added.length}): ${list(gate.q1_added)}. A name read \`one_job\` still fails when another input fails (American Crew Pomade: directions, P4-1; Redken Beach Spray: paraphrased directions). Brilliantine's name reading is open (standard §13.4 item 4) and is not counted.

Tail-only INCI defects (not blocking, review \`inci_tail_defect\`): ${list(gate.tail_only)}.

Records whose only C1/C2 promise lines are fully masked to \`[CLAIM]\`: ${list(gate.promise_only_claim_markers.map((s) => "`" + s + "`"))}.

Not passing on the promise-line count (${gate.failing.length}): ${list(gate.failing)}.

## 6. Promise-line positions (P4-3)

Rule: a position is read only from the capture's own label on the line (\`tier_basis\` / \`capture_note\`): „pack_front…\" or „pack front\" ⇒ \`pack_front\` (headline, badge or bullets on the front); „pack_back_headline\" ⇒ \`headline\`; a dm bullet ⇒ \`bullet\`; „pack_back_other\" / „pack_back_geschmeidigkeit\" ⇒ \`body\`; anything else ⇒ \`unknown\` (the record keeps \`position_basis\`). Lines read from a pack photo whose side the capture did not record (\`pack_text_observed\`, „'Pack:' line\", a manufacturer pack render) stay \`unknown\`.

| Position | All promise lines | C1/C2 lines (in S0) |
|---|---|---|
${uniq(Object.keys(posCount).concat(Object.keys(posCountC12))).sort().map((k) => "| " + k + " | " + (posCount[k] || 0) + " | " + (posCountC12[k] || 0) + " |").join("\n")}

Records with at least one C1 promise line: ${c1Records.length}; of them with a C1 \`pack_front\` line: ${c1WithFront.length} (${list(c1WithFront.map((s) => "`" + s + "`"))}). Every other C1 line is \`unknown\`, so §4.2 step 2 reads the first C1 line in packet order there (standard §4.2, §13.4 item 3).

Lines with a recorded position: ${list(posKnown.map((x) => "`" + x.slug + "` " + x.tier + " " + x.position + " („" + esc(x.raw.slice(0, 50)) + "…\")"))}.

## 7. Heat claims (P4-2) and directions (P4-1)

${P42.map((x) => "- `" + x.slug + "`: „" + esc(x.sentence) + "\" — split out of its " + x.tier + " promise line as a \`heat_protection\` claim (same source and date); the promise line is unchanged.").join("\n")}
${P41.map((x) => "- `" + x.slug + "`: directions from " + x.host + " (C5) removed from both packets (\`directions_status: missing\`); text kept in \`history.round5.removed_directions\`: „" + esc(x.text) + "\"").join("\n")}

## 8. product_type_word (P4-4) and the suffix audit

Names whose claims-packet \`product_type_word\` came from a suffix match inside a longer token: ${ptwAudit.length}. One is a false match and is re-derived by P4-4: ${list(ptwAudit.filter((x) => x.fixed).map((x) => "`" + x.slug + "` „" + x.token + "\" ⇒ " + x.word + " → spray"))}. The other ${ptwAudit.filter((x) => !x.fixed).length} are compound nouns that end in the type noun, reviewed by eye and listed in the script (\`PTW_REVIEWED_COMPOUNDS\`; the build stops on an unreviewed one), so their type word is right: ${uniq(ptwAudit.filter((x) => !x.fixed).map((x) => "„" + x.token + "\" ⇒ " + x.word)).sort().join(", ")}.

## 9. Packet field lists

All packets: one JSON file per product, \`r5/packets/<kind>/<opaque id>.json\`.

### 9.1 S0 (\`packets/s0/\`)

${fieldList(s0Sample, "").join("\n")}

**P4-3:** every entry of \`promise_claims_c1_c2\` carries \`position\` ∈ {pack_front, headline, bullet, body, unknown}. **P4-2:** a heat sentence split out of a promise line appears in \`heat_protection_claims_c1_c2\`. **P4-1:** \`directions_status\` is \`verbatim\` or \`paraphrase\` only for a G1-tier source; a C5 page ships as \`missing\` with \`directions: null\`. Everything else as round 4 (P3-1 \`identity.identity_status\` in every packet, \`product.confirmed_name_tier\`, R2-Q3 masking).

### 9.2 F/U (\`packets/fu/\`)

${fieldList(fuSample, "").join("\n")}

F/U directions keep the round-1 masking (brand, name, look/strength words → \`[CLAIM]\`); P4-1 applies here too.

### 9.3 Claims (\`packets/claims/\`)

${fieldList(clSample, "").join("\n")}

**P4-3:** every \`claims[]\` entry of type \`promise\` carries \`position\`. **P4-4:** \`product_type_word\` of the got2b Schutzengel record reads \`spray\`.

## 10. S0 masking (R2-Q3, unchanged) and the job-word check

S0 masking is the round-4 masking, unchanged. ${s0Stats.promise_lines_masked} promise lines on ${s0Stats.packets_with_masked_promise} S0 packets carry a mask (${s0Stats.replacements} replacements); ${s0Stats.names_masked} confirmed names and ${s0Stats.directions_masked} directions texts carry one.

| Check | Round 4 (${r4Base.length} records) | Round 5 (${records.length} records) |
|---|---|---|
| Method A (lead line + name; counts matt/flex as job words): records losing ≥ 1 job word | ${b.diff_records_with_a_lost_job_word} | ${a.diff_records_with_a_lost_job_word} |
| Method A: complete lead-job loss | ${b.diff_records_with_complete_lead_job_loss} | ${a.diff_records_with_complete_lead_job_loss} |
| Method B (name + every C1/C2 promise and heat line; job-bearing words only): records with a job word in the capture | ${b.job_records_with_job_words_in_capture} | ${a.job_records_with_job_words_in_capture} |
| **Method B: records with zero job words in S0 where the capture had one** | **${b.job_records_zero_job_words_in_s0_where_capture_had_one.length}** | **${a.job_records_zero_job_words_in_s0_where_capture_had_one.length}** |
| Method B: records losing ≥ 1 job word | ${b.job_records_losing_at_least_one_job_word} | ${a.job_records_losing_at_least_one_job_word} |

Method B losses after masking (job words that occur only inside a masked grading phrase): ${list(lostAfter)}.

## 11. Leak checks (all packets)

| Check | Hits |
|---|---|
${leakLines}
| **Total** | **${leakTotal}** |

The round-4 checks are unchanged, with the id check extended to the round-4 ids (\`round1_to_4_id\`); the build stops on any hit. F/U name check: generic words of the pack names matched by prefix inside ordinary directions words are not masked and not counted, as in round 4 (${genericNameHits.length}: ${list(genericNameHits)}). Strength words that grade something other than hold stay visible under R2-Q3; listed for review (${uniq(strengthElsewhere).length}): ${list(uniq(strengthElsewhere).sort())}.

## 12. Rerun scope (records whose packet content changed against round 4)

Every promise line gained \`position\` (${s0WithPromise} S0 packets carry promise lines); beyond that:

S0 (${changed.s0.length}): ${list(changed.s0.slice().sort().map((s) => "`" + s + "`"))}.

F/U (${changed.fu.length}): ${list(changed.fu.slice().sort().map((s) => "`" + s + "`"))}.

Claims (${changed.claims.length}): ${list(changed.claims.slice().sort().map((s) => "`" + s + "`"))}.

Round 5 is a confirmation round over the whole cohort; the v0.5 rule changes (R4-Q1…R4-Q7, RG4-*) touch records whose packets did not move, and the rerun obligation (standard §14) covers them too.

## 13. Reproduction

\`node data/research/styling-inci/v1.0/build/freeze-cohort-r5.js\` rewrites \`r5/\` only; two consecutive runs give byte-identical output. \`r5/artifact-manifest.json\` records the SHA-256 of every input (round-1…4 inputs, the capture files, the earlier scripts), of this script and of every output.
`;
writeOut("FREEZE-NOTES.md", notes);
const manifest = {
  manifest_version: COHORT_VERSION,
  frozen_on: FREEZE_DATE,
  algorithm: "sha256",
  script: { path: "v1.0/build/freeze-cohort-r5.js", sha256: sha256(fs.readFileSync(__filename)) },
  inputs: cohort.inputs,
  round4_rebuild_check: cohort.round4_rebuild_check,
  counts: { packets_s0: packets.s0.length, packets_fu: packets.fu.length, packets_claims: packets.claims.length, cohort_records: records.length },
  artifacts: written.slice().sort(cmp).map((r) => ({ path: "r5/" + r, sha256: sha256(fs.readFileSync(path.join(OUT, r))) })),
};
fs.writeFileSync(path.join(OUT, "artifact-manifest.json"), ser(manifest));
const rootHash = sha256(Buffer.from(manifest.artifacts.map((x) => x.path + ":" + x.sha256).join("\n")));
console.log(JSON.stringify({ records: records.length, by_role: counts.by_role, evidence_gate_pass: gate.pass, evidence_gate_pass_with_r4q1: gate.passQ1, evidence_gate_pass_round4: r4GatePass, gate_changed_vs_r4: gateChanged, q1_added: gate.q1_added, positions: posCount, positions_c12: posCountC12, heat_split: P42.length, directions_removed: P41.map((x) => x.slug), ptw_audit: ptwAudit, job_check: { zero_job_before: b.job_records_zero_job_words_in_s0_where_capture_had_one.length, zero_job_after: a.job_records_zero_job_words_in_s0_where_capture_had_one.length }, leak_total: leakTotal, changed: { s0: changed.s0.length, fu: changed.fu.length, claims: changed.claims.length }, packets: manifest.counts, manifest_root_sha256: rootHash, manifest_file_sha256: sha256(fs.readFileSync(path.join(OUT, "artifact-manifest.json"))) }, null, 2));
