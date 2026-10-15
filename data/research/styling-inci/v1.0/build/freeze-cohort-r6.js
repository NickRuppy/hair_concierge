#!/usr/bin/env node
// Styling research engine - round-6 final confirmation cohort freeze (standard v0.5 as amended 2026-10-13, lexicon v0.5).
//   node data/research/styling-inci/v1.0/build/freeze-cohort-r6.js
// Round 5 was aborted before any lane ran: the Codex review (2026-10-13) found S0 hold-grade leaks
// („Haarspray extrastark", „ultrastarke Styles"), prior-round editorial labels in S0 INCI flags and an open
// Brilliantine name reading that R4-H (4) had resolved. This script rebuilds the 143 round-5 records by running
// build/freeze-cohort-r5.js unchanged inside a sandbox whose file writes go to memory (the round-5 outputs on disk
// are compared byte-for-byte and never written; the round-5 script itself rebuilds rounds 4...1 the same way),
// applies the fixes P5-1...P5-3 and writes everything under v1.0/r6/ only: cohort.json, packets/{s0,fu,claims}/,
// artifact-manifest.json, FREEZE-NOTES.md.
// Deterministic: no clock, no randomness, sorted iteration. It never reads v1.0/sealed/ and never classifies.
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const V1 = path.resolve(__dirname, "..");
const BASE = path.resolve(V1, "..");
const OUT = path.join(V1, "r6");
const R5_SCRIPT = path.join(__dirname, "freeze-cohort-r5.js");
const R5_OUT = path.join(V1, "r5");
const FREEZE_DATE = "2026-10-13";
const COHORT_VERSION = "styling-inci-v1.0-cohort-6";
const STANDARD_VERSION = "styling-inci-v0.5";
const LEXICON_VERSION = "styling-lexicon-v0.5";
const ID_SALT = "styling-inci-v1.0-cohort-6/opaque-id/"; // new salt: no round-6 id may equal a round-1...5 id
// The note added on top of r5/FREEZE-NOTES.md after the round-5 abort; the rest of that file is the round-5 build output.
const R5_SUPERSEDED_NOTE = "> **SUPERSEDED by r6 (2026-10-13): round-5 blind run aborted after the Codex review found S0 hold-grade leaks and doc contradictions; never scored.** The text below is the unchanged round-5 build output; `r5/artifact-manifest.json` hashes that output without this note.\n\n";

// ---------------------------------------------------------------------------------------------
// Round 5 (and through it rounds 4...1), rebuilt from its own inputs inside a sandbox
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
const ctx = vm.createContext({ require: (m) => (m === "fs" ? sandboxFs : require(m)), __dirname: path.dirname(R5_SCRIPT), __filename: R5_SCRIPT, console: { log: () => {} }, Buffer });
vm.runInContext(fs.readFileSync(R5_SCRIPT, "utf8"), ctx, { filename: R5_SCRIPT });
const R5 = (name) => vm.runInContext(name, ctx);
const round5Check = { files: 0, identical: 0, identical_after_superseded_note: [], differing: [] };
for (const k of [...mem.keys()].sort()) {
  if (!k.startsWith(R5_OUT + path.sep)) continue;
  round5Check.files++;
  const disk = fs.existsSync(k) ? fs.readFileSync(k) : null;
  if (disk && disk.equals(mem.get(k))) round5Check.identical++;
  else if (disk && path.basename(k) === "FREEZE-NOTES.md" && disk.equals(Buffer.concat([Buffer.from(R5_SUPERSEDED_NOTE), mem.get(k)]))) round5Check.identical_after_superseded_note.push(path.relative(V1, k));
  else round5Check.differing.push(path.relative(V1, k));
}
if (round5Check.differing.length || !round5Check.files) throw new Error("round-5 rebuild differs from round-5 outputs on disk: " + round5Check.differing.join(", "));

const sha256 = R5("sha256");
const packetText = R5("packetText");
const maskDirections = R5("maskDirections");
const leakCheck = R5("leakCheck");
const sourceClass = R5("sourceClass");
const isC12 = R5("isC12");
const dirBlock = R5("dirBlock");
const fieldList = R5("fieldList");
const HFF_RE = R5("HFF_RE");
const HOLD_NUMBER_RE = R5("HOLD_NUMBER_RE");
const srcHost = R5("srcHost");
const INCOMPLETE_FLAG_RE = R5("INCOMPLETE_FLAG_RE");
const CLAIMS_LEAK_RE = R5("CLAIMS_LEAK_RE");
const ANY_LEAK_RE = R5("ANY_LEAK_RE");
const FORBIDDEN_KEYS = R5("FORBIDDEN_KEYS");
const maskS0R5 = R5("maskS0");
const S0_LEAK = R5("S0_LEAK");
const nameStrengthLeft = R5("nameStrengthLeft");
const STRENGTH_ELSEWHERE = R5("STRENGTH_ELSEWHERE");
const diffMethod = R5("diffMethod");
const jobCheck = R5("jobCheck");
const displayForPacket = R5("displayForPacket");
const flagRank = R5("flagRank");
const srcClassOf = R5("srcClassOf");
const nameTierOf = R5("nameTierOf");
const packetIdentityStatus = R5("packetIdentityStatus");
const R4_GENERIC_NAME_HITS = R5("R4_GENERIC_NAME_HITS");
const typeOrder = R5("typeOrder");
const ptwOf = R5("ptwOf");
const R5_NAME_ONE_JOB = JSON.parse(JSON.stringify(R5("NAME_ONE_JOB")));
const PRIOR_IDS = { "round-1": new Set(R5("[...R1_IDS]")), "round-2": new Set(R5("[...R2_IDS]")), "round-3": new Set(R5("[...R3_IDS]")), "round-4": new Set(R5("[...R4_IDS]")) };
const R5_INPUTS = JSON.parse(JSON.stringify(R5("INPUTS")));
const R5_EXCLUSIONS = JSON.parse(JSON.stringify(R5("exclusions")));
const r5Records = JSON.parse(JSON.stringify(R5("records")));
const r5Base = JSON.parse(JSON.stringify(R5("records"))); // untouched copy for the before/after checks
PRIOR_IDS["round-5"] = new Set(r5Records.map((r) => r.sample_id));
const R5_ID_BY_SLUG = Object.fromEntries(r5Records.map((r) => [r.source_slug, r.sample_id]));
const r5IdMap = Object.fromEntries(JSON.parse(JSON.stringify(R5("cohort.id_map"))).map((x) => [x.source_slug, x]));
const r5Disk = JSON.parse(fs.readFileSync(path.join(R5_OUT, "cohort.json"), "utf8"));
if (JSON.stringify(r5Disk.records) !== JSON.stringify(r5Records)) throw new Error("round-5 in-memory records differ from r5/cohort.json");
const r5Packets = { s0: {}, fu: {}, claims: {} }; // round-5 packets on disk, for the before/after comparisons
for (const kind of ["s0", "fu", "claims"]) for (const f of fs.readdirSync(path.join(R5_OUT, "packets", kind)).sort()) r5Packets[kind][f.replace(/\.json$/, "")] = JSON.parse(fs.readFileSync(path.join(R5_OUT, "packets", kind, f), "utf8"));

const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const uniq = (a) => [...new Set(a)];
const sortKeys = (o) => Object.fromEntries(Object.entries(o).sort((a, b) => cmp(a[0], b[0])));
const count = (arr, f) => arr.reduce((m, x) => ((m[f(x)] = (m[f(x)] || 0) + 1), m), {});
const patchLog = [];
const logPatch = (id, slug, status, detail) => patchLog.push({ id, slug, status, detail });

// ---------------------------------------------------------------------------------------------
// Base: the 143 round-5 records
// ---------------------------------------------------------------------------------------------
const bySlug = {};
for (const r of r5Records) {
  r.history = r.history || {};
  r.history.round6 = { round5_sample_id: r.sample_id, round5_role: r.cohort_role, round5_never_scored: true, round5_evidence_gate_inputs: r.evidence_gate_inputs };
  delete r.s0_redacted_name;
  delete r.s0_redacted_directions;
  delete r.evidence_gate_inputs;
  delete r.identity.inci_flag_ranks;
  for (const c of r.claims) delete c.s0_redacted_text;
  bySlug[r.source_slug] = r;
}
const records = r5Records;

// ---------------------------------------------------------------------------------------------
// P5-1: S0 masking covers every §7.4 hold-grade strength word, also inside compounds and after the product noun
// ---------------------------------------------------------------------------------------------
// Standard §7.4 level-4 words written as one compound or hyphenated („extrastark", „ultrastarke", „super-stark",
// „Extra Strong") and the got2b ladder word „krass" are hold grades wherever they stand: they are masked in names,
// promise and heat lines and directions. A strength word that qualifies the styles or the hairdo as a whole
// („ultrastarke Styles", „starke Frisuren") grades hold too. In a name, a strength run placed after the product noun
// that ends the name or a name part („Haarspray extrastark (Pumpspray …)") is a hold grade (RG-13 name test, postpositive).
// A strength word that grades another result noun („maximales Volumen", „Ultra Volumen") stays visible (R2-Q3, RG-13).
const L = "A-Za-zÄÖÜäöüß";
const STRENGTH = "(?:leicht\\w*|sanft\\w*|soft|weich\\w*|mittel\\w*|mittler\\w*|normal\\w*|stark\\w*|st[äa]rk\\w*|sehr|extra|extrem\\w*|ultra|super|mega|maximal\\w*|maximum|max\\.?|power|strong|firm|krass\\w*|intensiv\\w*|medium|light)"; // = round-3 maskS0 STRENGTH
const STR_PREFIX = "(?:extra|ultra|super|mega|sehr|extrem|maximal|bomben)";
const COMPOUND_STRENGTH = new RegExp("(?<![" + L + "])" + STR_PREFIX + "[\\s\\-]?(?:st[äa]rk|strong)[" + L + "]*", "gi");
const KRASS = new RegExp("(?<![" + L + "])krass[" + L + "]*", "gi");
const STYLE_NOUN = "(?:styles?|stylings?|frisur(?:en)?|hairstyles?)";
const STRENGTH_ON_STYLES = new RegExp("(?<![" + L + "])" + STRENGTH + "(?:[\\s,\\-]+" + STRENGTH + ")*(?=[\\s\\-]+" + STYLE_NOUN + "(?![" + L + "]))", "gi");
const NAME_NOUNS = ["haarspray", "spray", "haarlack", "lack", "gel", "wachs", "wax", "paste", "pomade", "creme", "cream", "mousse", "schaum", "schaumfestiger", "puder", "powder", "lotion", "serum", "balm", "clay", "fiber", "stick", "gelee", "jelly"];
const isNameNoun = (t) => NAME_NOUNS.some((n) => t.toLowerCase().replace(/[^a-zäöüß-]/g, "").endsWith(n));
const STR_TOK = new RegExp("^" + STRENGTH + "$", "i");
// RG-13 postpositive: product noun, then a strength run that ends the name or is followed by a bracket, comma or slash
function postNounStrength(name) {
  const toks = String(name).split(/(\s+)/);
  const words = toks.map((x, i) => [x, i]).filter(([x]) => /\S/.test(x));
  const hits = [];
  for (let w = 1; w < words.length; w++) {
    if (!isNameNoun(words[w - 1][0])) continue;
    const bare = (s) => s.replace(/[^A-Za-zÄÖÜäöüß.-]/g, "");
    if (!STR_TOK.test(bare(words[w][0]))) continue;
    let e = w;
    while (words[e + 1] && STR_TOK.test(bare(words[e + 1][0])) && !/[,)/]$/.test(words[e][0])) e++;
    const next = words[e + 1] ? words[e + 1][0] : null;
    if (next === null || /^[(\[/,]/.test(next) || /[,)/]$/.test(words[e][0])) hits.push({ from: w, to: e });
    w = e;
  }
  return { toks, words, hits };
}
const p51Stats = { compound: 0, krass: 0, on_styles: 0, post_noun: 0 };
const p51Hits = [];
function maskS0(text, isName, tally) {
  if (text == null) return { text: null, count: 0 };
  const base = maskS0R5(text, isName);
  let t = base.text;
  let n = base.count;
  const bump = (k, m) => {
    n++;
    if (tally) {
      p51Stats[k]++;
      p51Hits.push({ kind: k, match: m, field: tally });
    }
    return "[CLAIM]";
  };
  t = t.replace(COMPOUND_STRENGTH, (m) => bump("compound", m));
  t = t.replace(KRASS, (m) => bump("krass", m));
  t = t.replace(STRENGTH_ON_STYLES, (m) => bump("on_styles", m));
  if (isName) {
    const { toks, words, hits } = postNounStrength(t);
    for (const h of hits) {
      const m = words.slice(h.from, h.to + 1).map((x) => x[0]).join(" ");
      for (let k = h.from; k <= h.to; k++) toks[words[k][1]] = k === h.from ? toks[words[k][1]].replace(/^[A-Za-zÄÖÜäöüß.-]+/, "[CLAIM]") : "";
      bump("post_noun", m);
    }
    t = toks.join("");
  }
  t = t.replace(/(\[CLAIM\][\s,\-\/&+]*){2,}/g, (m) => "[CLAIM]" + (/\s$/.test(m) ? " " : ""));
  return { text: t.replace(/[ \t]+/g, " ").replace(/ *\n */g, "\n").trim(), count: n };
}
// leak tests added by P5-1 (applied to every string of every S0 and F/U packet, [CLAIM] removed)
const S0_LEAK_R6 = {
  strength_compound: new RegExp("(?<![" + L + "])" + STR_PREFIX + "[\\s\\-]?(?:st[äa]rk|strong)|(?<![" + L + "])krass", "i"),
  strength_on_styles: new RegExp("(?<![" + L + "])" + STRENGTH + "[\\s\\-]+" + STYLE_NOUN + "(?![" + L + "])", "i"),
};

// ---------------------------------------------------------------------------------------------
// P5-3: editorial and round labels never reach a packet
// ---------------------------------------------------------------------------------------------
// Any string field of any packet: rule/patch ids (P-5, P3-3, RG3-22, R4-Q1, PH1-8), round numbers, freeze/repair
// provenance and lexicon/standard versions are stripped; the fact the label annotated stays.
const EDITORIAL_RE = /\b(?:P\d?-\d+|RG\d*-\d+|R\d-(?:Q|H|T|L)\d*|PH\d-\d+)\b|round-?\s?\d|\b(?:lexicon|standard)\s+v\d|repaired by|\bfreeze\b(?!\s+haarlack)|_by_freeze|\bcohort\b|calibration|\bdraft\b|\blane\b|subtype|legacy|non-blocking|\(review\)|, review\)/i;
const EDITORIAL_SKIP_KEYS = new Set(["packet_version", "sample_id"]); // structural metadata, not text
const LABEL_PART = /^(?:P\d?-\d+|RG\d*-\d+|R\d-(?:Q|H|T|L)\d*|PH\d-\d+|non-blocking|review)$/; // „(non-blocking, review)\" is a gate verdict, which the lanes derive themselves
const p53Edits = [];
function stripLabels(s, where) {
  if (typeof s !== "string") return s;
  let t = s.replace(/\s*\(([^()]*)\)/g, (m, inner) => {
    const parts = inner.split(/,\s*/);
    const keep = parts.map((p) => (/^repaired by the round-\d+ freeze$/i.test(p) ? "repaired" : p)).filter((p) => !LABEL_PART.test(p.trim()));
    if (keep.length === parts.length && keep.every((p, i) => p === parts[i])) return m;
    return keep.length ? " (" + keep.join(", ") + ")" : "";
  });
  t = t.replace(/\bof lexicon v\d+\.\d+\b/g, "of the lexicon").replace(/\blexicon v\d+\.\d+\b/g, "the lexicon");
  if (t !== s) p53Edits.push({ where, from: s, to: t });
  return t;
}

// ---------------------------------------------------------------------------------------------
// P5-2: Bumble and bumble „brilliantine" is a one-job C1 name (R4-H (4), R4-Q1: shine)
// ---------------------------------------------------------------------------------------------
const NAME_ONE_JOB = JSON.parse(JSON.stringify(R5_NAME_ONE_JOB));
if (!NAME_ONE_JOB["bumble-and-bumble-brilliantine"] || NAME_ONE_JOB["bumble-and-bumble-brilliantine"].reading !== "open") throw new Error("P5-2 precondition: Brilliantine not read 'open' in round 5");
NAME_ONE_JOB["bumble-and-bumble-brilliantine"] = { reading: "one_job", why: "„brilliantine\": one shine product noun (D2/SD3) - one-job C1 name under R4-Q1, resolved by R4-H (4), consistent with its §4.6 registry row (shine_finish)" };
logPatch("P5-2", "bumble-and-bumble-brilliantine", "applied", "R4-Q1 name reading „open\" -> „one_job\" (R4-H (4): a one-job C1 name, shine; standard §4.6 registry row and §13.4 item 4 aligned). Hand table only; no packet field changes");

// ---------------------------------------------------------------------------------------------
// Versions, ids, guards
// ---------------------------------------------------------------------------------------------
for (const r of records) {
  r.standard_version = STANDARD_VERSION;
  r.lexicon_version = LEXICON_VERSION;
}
const exclusions = R5_EXCLUSIONS.map((e) => Object.assign({}, e, { status_in_round6: "unchanged from round 5" }));
{
  const idSet = new Set();
  for (const r of records) {
    r.sample_id = "sty-" + sha256(Buffer.from(ID_SALT + r.source_slug)).slice(0, 10);
    if (idSet.has(r.sample_id)) throw new Error("opaque id collision " + r.sample_id);
    for (const [label, set] of Object.entries(PRIOR_IDS)) if (set.has(r.sample_id)) throw new Error("round-6 id equals a " + label + " id: " + r.sample_id);
    idSet.add(r.sample_id);
  }
  if (records.length !== 143) throw new Error("expected 143 records, got " + records.length);
  if (records.some((r) => r.cohort_role !== r.history.round6.round5_role)) throw new Error("a cohort role changed");
  if (new Set(records.map((r) => r.source_slug)).size !== 143) throw new Error("duplicate slug");
}
records.sort((a, b) => cmp(a.sample_id, b.sample_id));

// ---------------------------------------------------------------------------------------------
// Packets (round-5 builder; S0 masking extended by P5-1; every string label-stripped by P5-3)
// ---------------------------------------------------------------------------------------------
const packets = { s0: [], fu: [], claims: [] };
const s0Stats = { promise_lines_masked: 0, packets_with_masked_promise: 0, replacements: 0, names_masked: 0, directions_masked: 0 };
const genericNameHits = [];
const fuNameLeaks = [];
const deepStrip = (o, where) => {
  if (Array.isArray(o)) return o.map((x, i) => deepStrip(x, where + "[" + i + "]"));
  if (o && typeof o === "object") return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, EDITORIAL_SKIP_KEYS.has(k) ? v : deepStrip(v, where + "." + k)]));
  return stripLabels(o, where);
};
for (const rec of records) {
  const id = rec.sample_id;
  const slug = rec.source_slug;
  const inciBlock = { inci_item_count: rec.identity.inci_normalised.length, tier: rec.identity.inci_source.tier, source_class: sourceClass(rec.identity.inci_source.tier), date: rec.identity.inci_source.date, items: rec.identity.inci_normalised.map((x) => ({ rank: x.rank, inci: x.inci })) };
  const promise = [];
  let redCount = 0;
  for (const c of rec.claims) {
    if (c.type !== "promise" || !isC12(c.tier)) continue;
    const red = maskS0(packetText(c.raw), false, slug + " promise");
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
    const red = maskS0(packetText(c.raw), false, slug + " heat");
    c.s0_redacted_text = red.text;
    return Object.assign({ text: red.text, redacted: red.count > 0, tier: c.tier, source_class: srcClassOf(c), date: c.date }, c.flags ? { flags: c.flags } : {}, c.mixed_source ? { mixed_source: true } : {});
  });
  const nameRed = maskS0(rec.identity.product_name, true, slug + " name");
  const dirRed = maskS0(rec.directions.text, false, slug + " directions");
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
  // the resolved status is read from the record's own flag text (with its labels) before P5-3 strips the labels
  identity.inci_flags = rec.identity.inci_flag_ranks.map((x) => Object.assign({ flag: x.flag, defect_rank: x.defect_rank }, /^capture_item_count_resolved \(P3-6|^repaired_missing_(?:space|slash) \(P3-3/.test(x.flag) ? { status: "resolved" } : {}));
  const s0 = { packet: "s0", packet_version: COHORT_VERSION, sample_id: id, product, identity, inci: inciBlock, directions_status: rec.directions.directions_status, directions: s0dir, promise_claims_c1_c2: promise, heat_protection_claims_c1_c2: heat };
  if (rec.identity.identity_status === "inci_conflict") {
    s0.identity_status = "inci_conflict";
    s0.inci_alt = identity.inci_alt;
  } else if (rec.identity.identity_status !== "as_captured") {
    s0.identity_status = rec.identity.identity_status;
    s0.identity_note = identity.identity_note;
  }
  packets.s0.push({ id, body: deepStrip(s0, "s0/" + slug), rec });
  // F/U (round-1 masking, unchanged)
  const masked = maskDirections(rec.directions.text, rec.identity.brand, rec.identity.product_name, rec.source_slug);
  const fu = { packet: "fu", packet_version: COHORT_VERSION, sample_id: id, format: rec.identity.format, inci: inciBlock, directions_status: rec.directions.directions_status, directions: dirBlock(rec, masked.text, true) };
  const lkAll = leakCheck(masked.text, rec);
  const lk = lkAll.filter((h) => !R4_GENERIC_NAME_HITS.includes(h));
  for (const h of lkAll.filter((x) => R4_GENERIC_NAME_HITS.includes(x))) genericNameHits.push("`" + slug + "` " + h.replace(/^name:/, "„") + "…\"");
  if (lk.length) fuNameLeaks.push({ slug, hits: lk, text: masked.text });
  packets.fu.push({ id, body: deepStrip(fu, "fu/" + slug), rec });
  // claims (R2-Q3: plus the unmasked confirmed name)
  const cl = [];
  for (const c of rec.claims) {
    if (c.type === "free_from" || c.type === "hair_type") continue;
    if (c.type === "other" && !(HFF_RE.test(c.raw) || HOLD_NUMBER_RE.test(c.raw))) continue;
    const o = { type: c.type, text: packetText(c.raw), tier: c.tier, source_class: srcClassOf(c), source_host: c.from_product_name ? null : srcHost(c.source), date: c.date };
    if (c.type === "promise") o.position = c.position;
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
  packets.claims.push({ id, body: deepStrip(cp, "claims/" + slug), rec });
}
logPatch("P5-1", "(all S0 packets)", "applied", "S0 masking extended (standard §7.4, §10.2, R2-Q3): compound/hyphenated level-4 strength words (" + p51Stats.compound + "), „krass…\" (" + p51Stats.krass + "), a strength word qualifying the styles or the hairdo (" + p51Stats.on_styles + "), a strength run after the product noun in the name (" + p51Stats.post_noun + "); masked: " + (p51Hits.map((h) => "`" + h.field + "` „" + h.match + "\"").join("; ") || "none"));
logPatch("P5-3", "(all packets)", "applied", p53Edits.length + " string field(s) stripped of editorial or round labels: " + uniq(p53Edits.map((e) => "„" + e.from.slice(0, 70) + "\" ⇒ „" + e.to.slice(0, 70) + "\"")).join("; "));

// ---------------------------------------------------------------------------------------------
// Leak checks over ALL string fields of ALL packets (build stops on any hit)
// ---------------------------------------------------------------------------------------------
const leaks = { fu_brand_name: fuNameLeaks.map((x) => x.slug + ": " + x.hits.join(", ")), s0_hold_number_or_scale: [], s0_strength_word: [], s0_strength_compound: [], s0_strength_on_styles: [], s0_flexibility_word: [], s0_finish_grade: [], s0_label: [], fu_strength_compound: [], editorial_label: [], claims_annotation: [], slug: [], round1_to_5_id: [], url: [], forbidden_key: [], subtype_or_route_id: [], any_label: [] };
const stringsScanned = { s0: 0, fu: 0, claims: 0 };
const strengthElsewhere = [];
// a registered brand name is identity, not a claim: „wellaflex\" contains the stem „flex\" (exempt for that test only)
const BRAND_NAME_EXEMPT = { wellaflex: "flexibility_word" };
const brandExempt = [];
const subtypeIds = uniq(records.map((r) => r.reference_only_not_for_blind_lanes.draft_subtype).filter((x) => x && /_/.test(x))).concat(["leave_in", "heat_protectant", "dry_shampoo", "provisional_boundary", "negative_control", "salt_spray", "texture_spray", "shine_finish", "smoothing_styler", "curl_cream"]);
const allSlugs = records.map((r) => r.source_slug);
const priorIds = new Set(Object.values(PRIOR_IDS).flatMap((s) => [...s]));
const walk = (o, fn, k, p) => {
  if (Array.isArray(o)) o.forEach((x, i) => walk(x, fn, k, p + "[" + i + "]"));
  else if (o && typeof o === "object") for (const [kk, v] of Object.entries(o)) (fn(kk, v, true, p + "." + kk), walk(v, fn, kk, p + "." + kk));
  else fn(k, o, false, p);
};
for (const kind of ["s0", "fu", "claims"]) {
  for (const p of packets[kind]) {
    const ser = JSON.stringify(p.body);
    const low = ser.toLowerCase();
    const tag = kind + "/" + p.id + " (" + p.rec.source_slug + ")";
    for (const s of allSlugs) if (low.includes(s)) leaks.slug.push(tag + ": " + s);
    for (const rid of priorIds) if (ser.includes(rid)) leaks.round1_to_5_id.push(tag + ": " + rid);
    if (/https?:\/\/|www\./i.test(ser)) leaks.url.push(tag);
    for (const sid of subtypeIds) if (new RegExp("\\b" + sid + "\\b", "i").test(ser)) leaks.subtype_or_route_id.push(tag + ": " + sid);
    walk(p.body, (k, v, isKey, at) => {
      if (isKey) {
        if (FORBIDDEN_KEYS.includes(k)) leaks.forbidden_key.push(tag + ": " + k);
        return;
      }
      if (typeof v !== "string") return;
      stringsScanned[kind]++;
      if (ANY_LEAK_RE.test(v)) leaks.any_label.push(tag + " " + at + ": " + v.slice(0, 120));
      if (!EDITORIAL_SKIP_KEYS.has(k) && EDITORIAL_RE.test(v) && !(kind === "claims" && /^text$|^words$/.test(k) && /^Freeze$/i.test(v.trim()))) leaks.editorial_label.push(tag + " " + at + ": '" + v.match(EDITORIAL_RE)[0] + "' in \"" + v.slice(0, 120) + "\"");
      if (kind === "claims") {
        if (/^\.claims\[/.test(at) && CLAIMS_LEAK_RE.test(v)) leaks.claims_annotation.push(tag + " " + at + ": " + v.slice(0, 160));
        return;
      }
      if (EDITORIAL_SKIP_KEYS.has(k) || k === "packet") return;
      const bare = v.replace(/\[CLAIM\]/g, " ");
      if (kind === "fu") {
        if (S0_LEAK_R6.strength_compound.test(bare)) leaks.fu_strength_compound.push(tag + " " + at + ": '" + bare.match(S0_LEAK_R6.strength_compound)[0] + "'");
        return;
      }
      // S0: every string field, not only the selected text fields
      for (const [lk, re] of Object.entries(S0_LEAK).concat(Object.entries(S0_LEAK_R6))) {
        const m = bare.match(re);
        if (m && at === ".product.brand" && BRAND_NAME_EXEMPT[v.toLowerCase()] === lk) {
          brandExempt.push("`" + p.rec.source_slug + "` brand „" + v + "\" (" + lk + ")");
          continue;
        }
        if (m) leaks["s0_" + lk].push(tag + " " + at + ": '" + m[0] + "' in \"" + v.slice(0, 140) + "\"");
      }
      if (at === ".product.confirmed_name") {
        const left = nameStrengthLeft(bare);
        if (left) leaks.s0_strength_word.push(tag + " name: '" + left + "' (RG-13 name test) in \"" + v + "\"");
        const post = postNounStrength(bare).hits;
        if (post.length) leaks.s0_strength_word.push(tag + " name: strength after the product noun (RG-13 postpositive) in \"" + v + "\"");
      }
      const other = bare.match(STRENGTH_ELSEWHERE);
      if (other) strengthElsewhere.push("`" + p.rec.source_slug + "` " + at.replace(/^\./, "") + ": „" + other[0] + "\"");
    }, "", "");
  }
}
const leakTotal = Object.values(leaks).reduce((a, b) => a + b.length, 0);
if (leakTotal) throw new Error("leak check hits: " + JSON.stringify(Object.fromEntries(Object.entries(leaks).filter(([, v]) => v.length)), null, 1).slice(0, 6000));
// the two Codex findings, checked by name
{
  const gard = packets.s0.find((p) => /extrastark/i.test(p.rec.identity.product_name));
  if (!gard || /stark/i.test(gard.body.product.confirmed_name)) throw new Error("P5-1: the „extrastark\" name is not masked");
  const ultra = packets.s0.find((p) => p.rec.claims.some((c) => /ultrastarke Styles/.test(c.raw || "")));
  if (!ultra || ultra.body.promise_claims_c1_c2.some((x) => /stark/i.test(x.text))) throw new Error("P5-1: „ultrastarke Styles\" is not masked");
}
// guards kept from round 5
for (const p of packets.s0) {
  if (!p.body.identity.identity_status) throw new Error("P3-1: no identity.identity_status in " + p.id);
  if (p.rec.identity.identity_status === "inci_conflict" && !p.body.identity.inci_alt) throw new Error("P3-1: no identity.inci_alt in " + p.id);
  if (p.body.directions && p.body.directions.tier === "C5") throw new Error("P4-1: C5 directions in S0 packet " + p.id);
  if (p.body.promise_claims_c1_c2.some((x) => !x.position)) throw new Error("P4-3: promise line without position in " + p.id);
}
for (const p of packets.fu) if (p.body.directions && p.body.directions.tier === "C5") throw new Error("P4-1: C5 directions in F/U packet " + p.id);
for (const p of packets.claims) if (p.body.claims.some((x) => x.type === "promise" && !x.position)) throw new Error("P4-3: promise line without position in claims " + p.id);

// ---------------------------------------------------------------------------------------------
// S0 job-word check (before = round-5 records with the round-5 masking, after = round-6 records with P5-1)
// ---------------------------------------------------------------------------------------------
const maskR5 = (t, isName) => (t == null ? null : maskS0R5(t, isName).text);
const maskR6 = (t, isName) => (t == null ? null : maskS0(t, isName).text);
const summarise = (j) => ({
  diff_records_with_a_lost_job_word: j.diff.filter(([, x]) => x && x.any_lost).length,
  diff_records_with_complete_lead_job_loss: j.diff.filter(([, x]) => x && x.complete).length,
  diff_complete_loss_slugs: j.diff.filter(([, x]) => x && x.complete).map(([s]) => s).sort(),
  job_records_with_job_words_in_capture: j.job.filter(([, x]) => x.raw > 0).length,
  job_records_zero_job_words_in_s0_where_capture_had_one: j.job.filter(([, x]) => x.raw > 0 && x.s0 === 0).map(([s]) => s).sort(),
  job_records_losing_at_least_one_job_word: j.job.filter(([, x]) => x.lost.length).length,
});
const jobBefore = { diff: r5Base.map((r) => [r.source_slug, diffMethod(r, maskR5)]), job: r5Base.map((r) => [r.source_slug, jobCheck(r, maskR5)]) };
const jobAfter = { diff: records.map((r) => [r.source_slug, diffMethod(r, maskR6)]), job: records.map((r) => [r.source_slug, jobCheck(r, maskR6)]) };
const jobSummary = { before_round5: summarise(jobBefore), after_round6: summarise(jobAfter) };
const lostAfter = jobAfter.job.filter(([, x]) => x.lost.length).map(([s, x]) => s + " (" + x.lost.join(", ") + ")").sort();
if (jobSummary.after_round6.job_records_zero_job_words_in_s0_where_capture_had_one.length) throw new Error("S0 records with zero job words: " + jobSummary.after_round6.job_records_zero_job_words_in_s0_where_capture_had_one.join(", "));
if (jobSummary.after_round6.diff_records_with_complete_lead_job_loss) throw new Error("S0 records with complete lead-job loss: " + jobSummary.after_round6.diff_complete_loss_slugs.join(", "));

// ---------------------------------------------------------------------------------------------
// Evidence gate (standard 4.1 + RG2-24 + RG3-15 + P4-1 + R4-Q1), computed from the S0 packets
// ---------------------------------------------------------------------------------------------
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
    if (!t) throw new Error("R4-Q1 population: no hand reading for " + r.source_slug);
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
  return { r, promise, promiseInformative, nameReading, dir, inciComplete, identityOk, pass, passQ1, tailOnly };
});
if (nameOnlyPop.some((x) => x.reading === "open")) throw new Error("R4-Q1 population: a name reading is still open");
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
  by_role: sortKeys(count(gateRows.filter((x) => x.passQ1), (x) => x.r.cohort_role)),
  q1_added: gateRows.filter((x) => x.passQ1 && !x.pass).map((x) => "`" + x.r.source_slug + "`").sort(),
  failing: gateRows.filter((x) => !x.passQ1).map((x) => "`" + x.r.source_slug + "` (" + x.r.cohort_role + "; " + [x.promise ? null : "no C1/C2 promise line" + (x.nameReading ? " (C1/C2 name: " + x.nameReading + ")" : " and no C1/C2 name"), x.dir ? null : "directions " + x.r.directions.directions_status, x.inciComplete ? null : "INCI defect above the tail", x.identityOk ? null : "identity " + x.r.identity.identity_status].filter(Boolean).join(", ") + ")").sort(),
};
const r5Gate = Object.fromEntries(r5Base.map((r) => [r.source_slug, r.evidence_gate_inputs]));
const r5GatePass = Object.values(r5Gate).filter((g) => g.all_three).length;
const r5GatePassQ1 = Object.values(r5Gate).filter((g) => g.all_three_with_r4q1_name).length;
const gateChanged = gateRows.filter((x) => r5Gate[x.r.source_slug].all_three_with_r4q1_name !== x.passQ1).map((x) => "`" + x.r.source_slug + "` (" + (r5Gate[x.r.source_slug].all_three_with_r4q1_name ? "pass" : "fail") + " -> " + (x.passQ1 ? "pass" : "fail") + ")").sort();
for (const g of gateRows) {
  if (g.tailOnly.length) g.r.identity.review_flags = uniq((g.r.identity.review_flags || []).concat(["inci_tail_defect"]));
  g.r.evidence_gate_inputs = { c1_c2_promise_line: g.promise, c1_c2_name_reading_r4q1: g.nameReading, directions_verbatim: g.dir, inci_complete: g.inciComplete, inci_tail_defects: g.tailOnly.map((d) => d.flag), identity_status_ok: g.identityOk, all_three: g.pass, all_three_with_r4q1_name: g.passQ1 };
}

// records whose packet content changed against round 5 (ids and packet_version ignored)
const stripIds = (o) => JSON.stringify(o).replace(/"sample_id":"sty-[0-9a-f]+"/, "").replace(/"packet_version":"[^"]*"/, "");
const changed = { s0: [], fu: [], claims: [] };
for (const kind of ["s0", "fu", "claims"]) {
  for (const p of packets[kind]) {
    const old = r5Packets[kind][p.rec.history.round6.round5_sample_id];
    if (!old) throw new Error("no round-5 packet for " + p.rec.source_slug);
    if (stripIds(p.body) !== stripIds(old)) changed[kind].push(p.rec.source_slug);
  }
}
if (changed.fu.length || changed.claims.length) throw new Error("F/U or claims packets changed against round 5 (only S0 should): " + changed.fu.concat(changed.claims).join(", "));

// ---------------------------------------------------------------------------------------------
// Write outputs (only under v1.0/r6/)
// ---------------------------------------------------------------------------------------------
const INPUTS = R5_INPUTS.concat(["v1.0/build/freeze-cohort-r5.js"]);
const counts = {
  total: records.length,
  by_role: sortKeys(count(records, (r) => r.cohort_role)),
  by_origin: sortKeys(count(records, (r) => r.reference_only_not_for_blind_lanes.origin)),
  by_draft_subtype: sortKeys(count(records, (r) => r.reference_only_not_for_blind_lanes.draft_subtype)),
  by_identity_status: sortKeys(count(records, (r) => r.identity.identity_status)),
  by_directions_status: sortKeys(count(records, (r) => r.directions.directions_status)),
  by_confirmed_name_tier: sortKeys(count(records, (r) => nameTierOf(r))),
  evidence_gate_promise_line_only: gate.pass,
  evidence_gate_with_r4q1_name_reading: gate.passQ1,
  leak_check_hits: leakTotal,
  strings_scanned: stringsScanned,
};
const cohort = {
  cohort_version: COHORT_VERSION,
  frozen_on: FREEZE_DATE,
  standard_version: STANDARD_VERSION,
  lexicon_version: LEXICON_VERSION,
  purpose: "Frozen round-6 final confirmation cohort (R3-L / R4-L), replacing the aborted, never-scored round 5. REFERENCE INPUT ONLY: never give this file to a blind lane (it maps opaque ids to slugs and to round-1...5 ids and carries legacy labels).",
  supersedes: { cohort: "styling-inci-v1.0-cohort-5", reason: "round-5 blind run aborted after the Codex review (2026-10-13) found S0 hold-grade leaks (a name „Haarspray extrastark\", a promise line „ultrastarke Styles\"), prior-round editorial labels in S0 INCI flags, and doc contradictions; round 5 was never scored" },
  counts,
  exclusions,
  patches: patchLog,
  rerun_scope: { s0_packet_changed: changed.s0.slice().sort(), fu_packet_changed: changed.fu.slice().sort(), claims_packet_changed: changed.claims.slice().sort(), note: "against round 5, ignoring sample_id and packet_version; round 6 is a full confirmation round over all 143 records" },
  r4q1_name_population: nameOnlyPop.slice().sort((a, b) => cmp(a.slug, b.slug)),
  s0_job_word_check: { summary: jobSummary, records_losing_a_job_word_after: lostAfter },
  inputs: INPUTS.map((f) => ({ path: f, sha256: sha256(fs.readFileSync(path.join(BASE, f))) })),
  round5_rebuild_check: { files_compared: round5Check.files, byte_identical: round5Check.identical, identical_after_superseded_note: round5Check.identical_after_superseded_note, round5_manifest_sha256: sha256(fs.readFileSync(path.join(R5_OUT, "artifact-manifest.json"))) },
  id_map: records.map((r) => ({ sample_id: r.sample_id, source_slug: r.source_slug, round5_sample_id: R5_ID_BY_SLUG[r.source_slug] || null, round4_sample_id: (r5IdMap[r.source_slug] || {}).round4_sample_id || null, round3_sample_id: (r5IdMap[r.source_slug] || {}).round3_sample_id || null, round2_sample_id: (r5IdMap[r.source_slug] || {}).round2_sample_id || null, round1_sample_id: (r5IdMap[r.source_slug] || {}).round1_sample_id || null })),
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
const b5 = jobSummary.before_round5;
const a6 = jobSummary.after_round6;
const leakLines = Object.entries(leaks).map(([k, v]) => "| " + k + " | " + v.length + " |").join("\n");
const notes = `# FREEZE-NOTES - Styling round-6 final confirmation cohort (${COHORT_VERSION})

Generated by \`build/freeze-cohort-r6.js\` (deterministic; re-run to reproduce every hash in \`r6/artifact-manifest.json\`). Frozen ${FREEZE_DATE}. Standard \`${STANDARD_VERSION}\` (as amended 2026-10-13, Codex review), lexicon \`${LEXICON_VERSION}\`. Round 6 is the final confirmation round under R3-L as narrowed by R4-L: only differences in user-facing fields count. Every number below is computed by the script. Nothing is classified (no route, subtype or hold level is assigned).

**Round 5 is superseded.** The round-5 cohort (\`r5/\`, \`styling-inci-v1.0-cohort-5\`) stays committed for the record but was never scored: its blind run was aborted after the Codex review (2026-10-13) found S0 hold-grade leaks (a confirmed name „Haarspray extrastark", a C1 promise line „…ultrastarke Styles", both shipped unredacted), prior-round editorial labels in S0 INCI flags („repaired by the round-4 freeze, P3-3"), and contradictions in the standard, lexicon, property set and charter. Round 6 uses the same 143 records and roles with those packet defects fixed and new opaque ids.

## 1. How the cohort was built

1. The round-5 script \`build/freeze-cohort-r5.js\` is run unchanged in a sandbox whose writes go to memory (it rebuilds rounds 4…1 the same way). Its ${round5Check.files} round-5 outputs were compared with \`r5/\` on disk: ${round5Check.identical} byte-identical, ${round5Check.identical_after_superseded_note.length} (\`${round5Check.identical_after_superseded_note.join("`, `")}\`) identical after the superseded note added on top of it; the build stops on any other difference. Its ${records.length} records are the base; no record is added or removed and every cohort role is kept.
2. Fixes P5-1…P5-3 are applied (section 3). No capture file is added and no captured value is edited.
3. Opaque ids: \`sty-\` + 10 hex of SHA-256(\`${ID_SALT}\` + slug). No round-6 id equals a round-1…5 id (checked). The slug ↔ id map lives only in \`r6/cohort.json\`.

## 2. Counts

| Metric | Value |
|---|---|
| Records in cohort | ${counts.total} |
| **Evidence gate, all items, input 1 = a C1/C2 promise line or a one-job C1/C2 name (R4-Q1)** | **${gate.passQ1} of ${counts.total}** (round 5: ${r5GatePassQ1}) |
| Evidence gate, input 1 = a C1/C2 promise line only | ${gate.pass} of ${counts.total} (round 5: ${r5GatePass}) |
| Records whose S0 packet changed against round 5 | ${changed.s0.length} |
| Records whose F/U packet changed against round 5 | ${changed.fu.length} |
| Records whose claims packet changed against round 5 | ${changed.claims.length} |
| String fields scanned by the leak checks (S0 / F/U / claims) | ${stringsScanned.s0} / ${stringsScanned.fu} / ${stringsScanned.claims} |
| Leak-check hits | ${leakTotal} |

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

## 3. Fixes applied (one line each)

${patchLog.map((p) => "- **" + p.id + "** `" + p.slug + "` - " + p.status + ": " + esc(p.detail)).join("\n")}

## 4. Evidence gate (standard 4.1, RG2-24, RG3-15, P4-1, R4-Q1), computed from the S0 packets

| Criterion | Records |
|---|---|
| C1/C2 promise line present | ${gate.promise} of ${counts.total} |
| \`directions_status: verbatim\` (G1 tiers only, P4-1) | ${gate.dir} of ${counts.total} |
| No INCI incompleteness flag above the tail | ${gate.inci} of ${counts.total} |
| \`identity_status\` not a conflict | ${gate.identity} of ${counts.total} |
| All items, promise line only | ${gate.pass} of ${counts.total} |
| **All items, input 1 also met by a one-job C1/C2 name (R4-Q1)** | **${gate.passQ1} of ${counts.total}** |

Pass by role (with R4-Q1): ${Object.entries(gate.by_role).map(([k, v]) => v + " " + k).join(", ")}. Gate outcome changed against round 5 (with R4-Q1; ${gateChanged.length}): ${list(gateChanged)}.

**R4-Q1 population** — S0 packets with a C1/C2 confirmed name and no C1/C2 promise line (${nameOnlyPop.length}); hand readings in the script (reference only, never in a packet; the lanes apply R4-Q1 themselves). No reading is open (R4-H (4) resolves Brilliantine):

| Product | Name | Tier | Reading | Why |
|---|---|---|---|---|
${nameOnlyPop.slice().sort((x, y) => cmp(x.slug, y.slug)).map((x) => "| `" + x.slug + "` | " + esc(x.name) + " | " + x.tier + " | " + x.reading + " | " + esc(x.why) + " |").join("\n")}

Passing only with the R4-Q1 name reading (${gate.q1_added.length}): ${list(gate.q1_added)}.

Tail-only INCI defects (not blocking, review \`inci_tail_defect\`): ${list(gate.tail_only)}.

Records whose only C1/C2 promise lines are fully masked to \`[CLAIM]\`: ${list(gate.promise_only_claim_markers.map((s) => "`" + s + "`"))}.

Not passing (${gate.failing.length}): ${list(gate.failing)}.

## 5. S0 masking (R2-Q3 + P5-1) and the job-word check

S0 masking is the round-5 masking plus P5-1. ${s0Stats.promise_lines_masked} promise lines on ${s0Stats.packets_with_masked_promise} S0 packets carry a mask (${s0Stats.replacements} replacements); ${s0Stats.names_masked} confirmed names and ${s0Stats.directions_masked} directions texts carry one. P5-1 masks (${p51Hits.length}): ${list(p51Hits.map((h) => "`" + h.field + "` „" + esc(h.match) + "\" (" + h.kind + ")"))}.

| Check | Round 5 masking (${r5Base.length} records) | Round 6 masking (${records.length} records) |
|---|---|---|
| Method A (lead line + name): records losing ≥ 1 job word | ${b5.diff_records_with_a_lost_job_word} | ${a6.diff_records_with_a_lost_job_word} |
| Method A: complete lead-job loss | ${b5.diff_records_with_complete_lead_job_loss} | ${a6.diff_records_with_complete_lead_job_loss} |
| Method B (name + every C1/C2 promise and heat line; job-bearing words only): records with a job word in the capture | ${b5.job_records_with_job_words_in_capture} | ${a6.job_records_with_job_words_in_capture} |
| **Method B: records with zero job words in S0 where the capture had one** | **${b5.job_records_zero_job_words_in_s0_where_capture_had_one.length}** | **${a6.job_records_zero_job_words_in_s0_where_capture_had_one.length}** |
| Method B: records losing ≥ 1 job word | ${b5.job_records_losing_at_least_one_job_word} | ${a6.job_records_losing_at_least_one_job_word} |

Method B losses after masking (job words that occur only inside a masked grading phrase): ${list(lostAfter)}.

## 6. Leak checks (every string field of every packet)

| Check | Hits |
|---|---|
${leakLines}
| **Total** | **${leakTotal}** |

Scope: round 5 ran the S0 grade tests on four selected fields (name, directions, promise and heat lines). Round 6 runs every S0 test on **every string field of every S0 packet** (${stringsScanned.s0} strings, incl. INCI items, flags and notes), the compound strength test on every F/U string (${stringsScanned.fu}), and the editorial-label test on every string of every packet (${stringsScanned.s0 + stringsScanned.fu + stringsScanned.claims}; \`packet_version\` and \`sample_id\` excepted, and the claims packet's captured flexibility word „Freeze"). New tests: \`s0_strength_compound\` (extra-/ultra-/super-/mega-/sehr-/extrem-/maximal-/bomben- + stark/strong, hyphenated or spaced, and „krass…", anywhere), \`s0_strength_on_styles\` (a strength word qualifying Styles/Styling/Frisur), the RG-13 postpositive name test (a strength run after the product noun), \`fu_strength_compound\`, and \`editorial_label\` (P-/RG-/R-/PH- ids, round numbers, freeze/repair provenance, lexicon/standard versions, cohort/lane/draft/subtype/legacy words). The build stops on any hit. F/U name check: generic words of pack names matched by prefix inside ordinary directions words are not counted, as in rounds 4–5 (${genericNameHits.length}: ${list(genericNameHits)}). Brand fields exempt from one S0 grade test because the registered brand name contains the stem (identity, not a claim; ${uniq(brandExempt).length}): ${list(uniq(brandExempt))}.

Strength words that grade something other than hold stay visible under R2-Q3 / RG-13 („maximales Volumen", „leistungsstarke Formel", „mittelstarkes Haar", „Power-Shine-Technologie"); listed for review (${uniq(strengthElsewhere).length}): ${list(uniq(strengthElsewhere).sort())}.

## 7. Rerun scope

Round 6 is the final confirmation round over all ${records.length} records (round 5 was never scored). Packets that differ from round 5 (ids ignored): S0 ${changed.s0.length} (${list(changed.s0.slice().sort().map((s) => "`" + s + "`"))}); F/U ${changed.fu.length}; claims ${changed.claims.length}.

## 8. Packet field lists

Unchanged from round 5 (\`r5/FREEZE-NOTES.md\` §9), except that \`identity.inci_flags[].status\` reads \`resolved\` (round 5: \`resolved_by_freeze\`). All packets: one JSON file per product, \`r6/packets/<kind>/<opaque id>.json\`.

## 9. Reproduction

\`node data/research/styling-inci/v1.0/build/freeze-cohort-r6.js\` rewrites \`r6/\` only; two consecutive runs give byte-identical output. \`r6/artifact-manifest.json\` records the SHA-256 of every input (the round-1…5 inputs and scripts, the capture files), of this script and of every output.
`;
writeOut("FREEZE-NOTES.md", notes);
const manifest = {
  manifest_version: COHORT_VERSION,
  frozen_on: FREEZE_DATE,
  algorithm: "sha256",
  script: { path: "v1.0/build/freeze-cohort-r6.js", sha256: sha256(fs.readFileSync(__filename)) },
  inputs: cohort.inputs,
  round5_rebuild_check: cohort.round5_rebuild_check,
  counts: { packets_s0: packets.s0.length, packets_fu: packets.fu.length, packets_claims: packets.claims.length, cohort_records: records.length },
  artifacts: written.slice().sort(cmp).map((r) => ({ path: "r6/" + r, sha256: sha256(fs.readFileSync(path.join(OUT, r))) })),
};
fs.writeFileSync(path.join(OUT, "artifact-manifest.json"), ser(manifest));
const rootHash = sha256(Buffer.from(manifest.artifacts.map((x) => x.path + ":" + x.sha256).join("\n")));
console.log(JSON.stringify({ records: records.length, by_role: counts.by_role, evidence_gate_pass_q1: gate.passQ1, evidence_gate_pass_promise_only: gate.pass, r5_gate_q1: r5GatePassQ1, gate_changed: gateChanged, p51: p51Stats, p51_hits: p51Hits, p53_edits: p53Edits.length, job_check: { zero_job_before: b5.job_records_zero_job_words_in_s0_where_capture_had_one.length, zero_job_after: a6.job_records_zero_job_words_in_s0_where_capture_had_one.length, losing_after: a6.job_records_losing_at_least_one_job_word, lost: lostAfter }, strings_scanned: stringsScanned, leak_total: leakTotal, changed: { s0: changed.s0.length, fu: changed.fu.length, claims: changed.claims.length }, packets: manifest.counts, manifest_root_sha256: rootHash, manifest_file_sha256: sha256(fs.readFileSync(path.join(OUT, "artifact-manifest.json"))) }, null, 2));
