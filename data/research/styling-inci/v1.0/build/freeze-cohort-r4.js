#!/usr/bin/env node
// Styling research engine - round-4 (confirmation round) cohort freeze (standard v0.4 amended 2026-10-13 R3-H2...R3-H4, lexicon v0.4).
//   node data/research/styling-inci/v1.0/build/freeze-cohort-r4.js
// Rebuilds the 143 round-3 records by running build/freeze-cohort-r3.js unchanged inside a sandbox whose file
// writes go to memory (the round-3 outputs on disk are compared byte-for-byte and never written; the round-3
// script itself rebuilds rounds 2 and 1 the same way), applies the round-3 packet issues P3-1...P3-7 and the
// owner rulings R3-H3 / R3-H4 (d), (f) with the pack-name capture capture/packnames-r7.json, and writes everything
// under v1.0/r4/ only: cohort.json, packets/{s0,fu,claims}/, artifact-manifest.json, FREEZE-NOTES.md.
// Deterministic: no clock, no randomness, sorted iteration. It never reads v1.0/sealed/ and never classifies
// (no route, subtype or hold level is assigned).
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const V1 = path.resolve(__dirname, "..");
const BASE = path.resolve(V1, "..");
const OUT = path.join(V1, "r4");
const R3_SCRIPT = path.join(__dirname, "freeze-cohort-r3.js");
const R3_OUT = path.join(V1, "r3");
const FREEZE_DATE = "2026-10-13";
const COHORT_VERSION = "styling-inci-v1.0-cohort-4";
const STANDARD_VERSION = "styling-inci-v0.4";
const LEXICON_VERSION = "styling-lexicon-v0.4";
const ID_SALT = "styling-inci-v1.0-cohort-4/opaque-id/"; // new salt: no round-4 id may equal a round-1, -2 or -3 id
const R7_PACKNAMES = "v1.0/capture/packnames-r7.json";
const LEXICON_DOC = path.resolve(BASE, "../../../docs/research/styling-inci/v1.0/02_evidence_lexicon.v0.4.md");

// ---------------------------------------------------------------------------------------------
// Round 3 (and through it rounds 2 and 1), rebuilt from its own inputs inside a sandbox
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
const ctx = vm.createContext({ require: (m) => (m === "fs" ? sandboxFs : require(m)), __dirname: path.dirname(R3_SCRIPT), __filename: R3_SCRIPT, console: { log: () => {} }, Buffer });
vm.runInContext(fs.readFileSync(R3_SCRIPT, "utf8"), ctx, { filename: R3_SCRIPT });
const R3 = (name) => vm.runInContext(name, ctx);
const round3Check = { files: 0, identical: 0, differing: [] };
for (const k of [...mem.keys()].sort()) {
  if (!k.startsWith(R3_OUT + path.sep)) continue;
  round3Check.files++;
  if (fs.existsSync(k) && fs.readFileSync(k).equals(mem.get(k))) round3Check.identical++;
  else round3Check.differing.push(path.relative(V1, k));
}
if (round3Check.differing.length || !round3Check.files) throw new Error("round-3 rebuild differs from round-3 outputs on disk: " + round3Check.differing.join(", "));

const sha256 = R3("sha256");
const normaliseInci = R3("normaliseInci");
const packetText = R3("packetText");
const maskDirections = R3("maskDirections");
const leakCheck = R3("leakCheck");
const sourceClass = R3("sourceClass");
const isC12 = R3("isC12");
const productTypeWord = R3("productTypeWord");
const dirBlock = R3("dirBlock");
const fieldList = R3("fieldList");
const HFF_RE = R3("HFF_RE");
const HOLD_NUMBER_RE = R3("HOLD_NUMBER_RE");
const addNameClaims = R3("addNameClaims");
const nameTable = R3("nameTable");
const mk = R3("mk");
const srcHost = R3("srcHost");
const INCOMPLETE_FLAG_RE = R3("INCOMPLETE_FLAG_RE");
const CLAIMS_LEAK_RE = R3("CLAIMS_LEAK_RE");
const ANY_LEAK_RE = R3("ANY_LEAK_RE");
const FORBIDDEN_KEYS = R3("FORBIDDEN_KEYS");
const maskS0 = R3("maskS0");
const S0_LEAK = R3("S0_LEAK");
const nameStrengthLeft = R3("nameStrengthLeft");
const STRENGTH_ELSEWHERE = R3("STRENGTH_ELSEWHERE");
const diffMethod = R3("diffMethod");
const jobCheck = R3("jobCheck");
const displayForPacketR3 = R3("displayForPacket");
const flagRankR3 = R3("flagRank");
const keyOf = R3("keyOf");
const EXTRA_MASK = R3("EXTRA_MASK");
const R1_IDS = new Set(R3("[...R1_IDS]"));
const R2_IDS = new Set(R3("[...R2_IDS]"));
const R3_INPUTS = JSON.parse(JSON.stringify(R3("INPUTS")));
const R3_EXCLUSIONS = JSON.parse(JSON.stringify(R3("exclusions")));
const r3Records = JSON.parse(JSON.stringify(R3("records")));
const R3_IDS = new Set(r3Records.map((r) => r.sample_id));
const R3_ID_BY_SLUG = Object.fromEntries(r3Records.map((r) => [r.source_slug, r.sample_id]));
const r3IdMap = Object.fromEntries(JSON.parse(JSON.stringify(R3("cohort.id_map"))).map((x) => [x.source_slug, x]));
const r3Disk = JSON.parse(fs.readFileSync(path.join(R3_OUT, "cohort.json"), "utf8"));
if (JSON.stringify(r3Disk.records) !== JSON.stringify(r3Records)) throw new Error("round-3 in-memory records differ from r3/cohort.json");
const r3Packets = { s0: {}, claims: {} }; // round-3 packets on disk, for the before/after comparisons
for (const kind of ["s0", "claims"]) for (const f of fs.readdirSync(path.join(R3_OUT, "packets", kind)).sort()) r3Packets[kind][f.replace(/\.json$/, "")] = JSON.parse(fs.readFileSync(path.join(R3_OUT, "packets", kind, f), "utf8"));

const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(BASE, rel), "utf8"));
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const uniq = (a) => [...new Set(a)];
const sortKeys = (o) => Object.fromEntries(Object.entries(o).sort((a, b) => cmp(a[0], b[0])));
const count = (arr, f) => arr.reduce((m, x) => ((m[f(x)] = (m[f(x)] || 0) + 1), m), {});
const note = (o, k, txt) => (o[k] = (o[k] ? o[k] + " || " : "") + txt);
const r7 = readJson(R7_PACKNAMES);
const r7Used = new Set();
const r7Row = (slug, item, pick) => {
  const hits = r7.map((x, i) => [x, i]).filter(([x]) => x.slug === slug && x.item === item && (!pick || pick(x)));
  if (hits.length !== 1) throw new Error("packnames-r7 row not unique: " + slug + " " + item + " (" + hits.length + ")");
  r7Used.add(hits[0][1]);
  return hits[0][0];
};
const patchLog = [];
const logPatch = (id, slug, status, detail) => patchLog.push({ id, slug, status, detail });
const notApplied = [];

// ---------------------------------------------------------------------------------------------
// Base: the 143 round-3 records
// ---------------------------------------------------------------------------------------------
const bySlug = {};
for (const r of r3Records) {
  r.history = r.history || {};
  r.history.round4 = { round3_sample_id: r.sample_id, round3_role: r.cohort_role, round3_standard_version: r.standard_version, round3_lexicon_version: r.lexicon_version };
  delete r.s0_redacted_name;
  delete r.s0_redacted_directions;
  delete r.evidence_gate_inputs;
  delete r.identity.inci_flag_ranks;
  for (const c of r.claims) delete c.s0_redacted_text;
  bySlug[r.source_slug] = r;
}
const R = (slug) => {
  if (!bySlug[slug]) throw new Error("round-3 record missing: " + slug);
  return bySlug[slug];
};
const records = r3Records;
const addReview = (r, flag) => (r.identity.review_flags = uniq((r.identity.review_flags || []).concat([flag])));

// ---------------------------------------------------------------------------------------------
// P3-4 / R3-H3: Elnett 3 Tage Glatt - C2 directions from L'Oreal Paris's own German article;
// pack front line and „Starker Halt" confirmed by the r7 re-read (C1)
// ---------------------------------------------------------------------------------------------
const ELNETT = "loreal-paris-elnett-stylingspray-hitzeschutz-3-tage-glatt";
{
  const r = R(ELNETT);
  if (r.directions.directions_status !== "missing") throw new Error("Elnett precondition: directions not missing");
  const art = r7Row(ELNETT, "elnett_directions", (x) => x.tier === "C2" && /tipps-und-trends/.test(x.source_url));
  const page = r7Row(ELNETT, "elnett_directions", (x) => x.tier === "C2" && /web\.archive\.org/.test(x.source_url));
  const dmDir = r7Row(ELNETT, "elnett_directions", (x) => x.tier === "C3");
  const front = r7Row(ELNETT, "elnett_pack_front");
  const hold = r7Row(ELNETT, "elnett_hold");
  r.history.round4.removed_directions = { text: r.directions.text, directions_status: r.directions.directions_status, status_note: r.directions.status_note };
  r.directions = {
    text: art.value_verbatim,
    directions_status: "verbatim",
    directions_verbatim: true,
    status_note: "packnames-r7 / R3-H3: product-specific how-to in L'Oréal Paris's own German advice article (loreal-paris.de 'Haar dauerhaft glätten', live " + art.capture_date + "); counts as C2 directions, review directions_from_brand_article. The archived product-page 'Anwendung' line is the generic Elnett hairspray text and is not used; the dm text (C3) is hairspray copy",
    tier: art.tier,
    source: art.source_url,
    source_host: srcHost(art.source_url),
    date: art.capture_date,
    basis: "packnames-r7 elnett_directions (C2 article), R3-H3",
    language_note: r.directions.language_note,
  };
  addReview(r, "directions_from_brand_article");
  // pack front line and hold, confirmed by the re-read
  const fl = r.claims.filter((c) => c.type === "promise" && c.tier === "C1" && front.value_verbatim === "L'ORÉAL PARIS | " + c.raw);
  if (fl.length !== 1) throw new Error("Elnett pack-front line does not match the r7 re-read");
  const hl = r.claims.filter((c) => c.type === "hold" && c.tier === "C1" && c.raw === hold.value_verbatim);
  if (hl.length !== 1) throw new Error("Elnett C1 hold line does not match the r7 re-read");
  for (const [c, row] of [[fl[0], front], [hl[0], hold]]) {
    c.source_as_captured = c.source;
    c.date_as_captured = c.date;
    c.source = row.source_url;
    c.date = row.capture_date;
    c.tier_basis = "packnames-r7 " + row.item + ": dm pack photo #1 re-read at 1200 px (" + row.capture_date + "); text identical to the frozen line (C1)";
  }
  notApplied.push("`" + ELNETT + "`: the archived L'Oréal product-page directions („" + page.value_verbatim.slice(0, 60) + "…\", C2) are not used — R3-H3: word for word the generic Elnett hairspray line; the dm directions („" + dmDir.value_verbatim.slice(0, 40) + "…\", C3) are hairspray copy");
  logPatch("P3-4 / R3-H3", ELNETT, "applied", "directions = the loreal-paris.de article text (C2, verbatim, " + art.capture_date + "), review directions_from_brand_article (old status 'missing' kept under history.round4.removed_directions); C1 pack-front line '" + fl[0].raw.slice(0, 50) + "…' and C1 hold 'Starker Halt' confirmed by the r7 re-read (source and date updated, text unchanged)");
}

// ---------------------------------------------------------------------------------------------
// P3-7 / R3-Q2 / R3-H4 (d), (f): confirmed names from the pack (C1) or the German brand page (C2)
// ---------------------------------------------------------------------------------------------
// The pack-name blocks are chosen by hand from the r7 text (each block must occur verbatim in the row):
// the product-name blocks with the type designation printed with them; claims, hair types, ingredients,
// sizes, badges and French translations are not part of the name.
const NAME_PICK = {
  "aussie-leave-in-creme-work-that-curl": { tier: "C1", blocks: ["WORK THAT CURL", "LEAVE-IN CREAM"] },
  "bali-curls-hydrating-curl-cream": { tier: "C1", blocks: ["HYDRATING CURL CREAM"] },
  "bali-gents-haarpuder-volumizing-styling-powder": { tier: "C1", blocks: ["VOLUMIZING STYLING POWDER"] },
  "batiste-trockenshampoo-all-in-one": { tier: "C1", blocks: ["TROCKENSHAMPOO", "ALL IN ONE", "fruchtig frischer Duft"] },
  "bumble-and-bumble-brilliantine": { tier: "C1", blocks: ["brilliantine"] },
  "cantu-lockencreme-kokos": { tier: "C1", blocks: ["SHEA BUTTER", "COCONUT CURLING CREAM"] },
  "cantu-lockenspray-comeback-curl-next-day": { tier: "C1", blocks: ["SHEA BUTTER", "COMEBACK CURL NEXT DAY CURL REVITALIZER"] },
  "garnier-fructis-locken-methode-feuchtigkeitsboost-pflege-spray": { tier: "C1", blocks: ["LOCKEN METHODE", "SHAPE REFRESH", "STEP 4", "FEUCHTIGKEITS-BOOST SPRAY"] },
  "garnier-fructis-sleek-and-stay-heat-activated-serum": { tier: "C1", blocks: ["SLEEK & STAY", "HEAT-ACTIVATED SERUM"] },
  "got2b-hitzeschutzspray-schutzengel": { tier: "C1", blocks: ["Schutz-engel", "Hitzeschutz Spray"] },
  "got2b-trockenshampoo-extra-volumen": { tier: "C1", blocks: ["Trocken SHAMPOO", "Extra Volumen"] },
  "guhl-locken-pflege-und-styling-3in1": { tier: "C1", blocks: ["LOCKEN PFLEGE & STYLING", "3in1", "LOCKENCREME, KUR & SPÜLUNG"] },
  "guhl-styling-spray-locken-pflege-und-styling-2in1": { tier: "C1", blocks: ["LOCKEN PFLEGE & STYLING", "2in1", "STYLING-SPRAY"] },
  "hask-lockencreme-curl-care": { tier: "C1", blocks: ["curls", "defining cream"] },
  "john-frieda-haarserum-frizz-ease-der-baendiger": { tier: "C1", blocks: ["Frizz Ease DER BÄNDIGER", "EXTRA STRONG", "SERUM"] },
  "kerastase-curl-manifesto-refresh-absolu": { tier: "C1", blocks: ["CURL MANIFESTO", "REFRESH ABSOLU", "Second day curl refreshing spray"] },
  "langhaarmaedchen-lockenspray-halt-sprungkraft": { tier: "C1", blocks: ["LOCKENHALT SPRAY", "Halt & Sprungkraft"] },
  "loreal-elvital-haaroel-oel-magique-alle-haartypen": { tier: "C1", blocks: ["ÖL MAGIQUE", "VEREDELNDES HAARÖL"] },
  "redken-styling-beach-spray": { tier: "C1", blocks: ["BEACH SPRAY", "BEACHY TEXTURE SPRAY"] },
  "schwarzkopf-professional-osis-curl-retouch": { tier: "C1", blocks: ["OSiS+", "CURL RETOUCH", "CURL ENHANCING SPRAY"] },
  "syoss-hitzeschutzspray-keratin-heat": { tier: "C1", blocks: ["KERATIN Heat", "HITZESCHUTZ-SPRAY"] },
  "taft-styling-paste-forming-halt-5plus": { tier: "C1", blocks: ["FORMING", "STYLING PASTE"] },
  "taft-x-gliss-hitzeschutzspray-lovely-long": { tier: "C1", blocks: ["taft x GLISS", "Lovely Long", "MULTITASKING HITZESCHUTZ-SPRAY"] },
  // C2: the C1 photo is a manufacturer-CDN image whose size cannot be read; the German brand page names the product
  "american-crew-fiber": { tier: "C2", blocks: ["FIBER"] },
};
// Products whose r7 pack photo does not confirm the name under R3-H4 (f): the retailer title stays (A3 / R3-Q2).
// Every retailer title captured for the product, with its product-type noun as written (R3-H4 (d)).
const TITLE_ONLY = {
  "bumble-and-bumble-surf-spray": { titles: [{ title: "Surf Spray", where: "frozen record (lookfantastic.de / douglas.de)", noun: "Spray" }, { title: "Surf Surf Spray Textur-Spray", where: "Douglas H1 (packnames-r7 note)", noun: "Textur-Spray" }] },
  "color-wow-dream-coat-supernatural-spray": { titles: [{ title: "Dream Coat Supernatural Spray", where: "frozen record (douglas.de)", noun: "Spray" }, { title: "Dream Coat Supernatural Spray Haarspray", where: "Douglas H1 (packnames-r7 note)", noun: "Haarspray" }] },
  "living-proof-full-dry-volume-texture-spray": { titles: [{ title: "Full Dry Volume & Texture Spray", where: "frozen record (flaconi.de)", noun: "Texture Spray" }, { title: "… Texturizing Spray", where: "Flaconi title addition (packnames-r7 note)", noun: "Texturizing Spray" }], agree_note: "„Texture Spray\" and „Texturizing Spray\" are the same type noun (texture spray)" },
  "feschi-smooth-and-shine-anti-frizz-spray-glanzspray": { titles: [{ title: "smooth & shine Anti Frizz Spray (Glanzspray)", where: "frozen record (flaconi.de)", noun: "Anti Frizz Spray" }, { title: "smooth & shine Anti Frizz Spray (Glanzspray)", where: "same Flaconi title, bracket addition (packnames-r7 note: Flaconi only)", noun: "Glanzspray" }] },
  "isana-professional-styling-creme-locken-traum": { titles: [{ title: "Styling Creme Locken Traum", where: "frozen record (codecheck.info listing title)", noun: "Styling Creme" }], agree_note: "one title captured; codecheck's category label „Lockencreme\" is a category label, not a title, and the Rossmann title seen only in search snippets was not read (r7)" },
};
const sameNoun = (a, b) => a.toLowerCase().replace(/[^a-zäöüß]/g, "").replace(/izing/, "e") === b.toLowerCase().replace(/[^a-zäöüß]/g, "").replace(/izing/, "e");
const sizeOf = (s) => {
  const m = String(s || "").match(/(\d+(?:[.,]\d+)?)\s*(ml|g)\b/i);
  return m ? m[1].replace(",", ".") + " " + m[2].toLowerCase() : null;
};
const MANUFACTURER_HOSTS = ["kerastase.de"];
const nameRows = [];
const r3NameC3 = new Set(Object.keys(r3Packets.claims).filter((id) => r3Packets.claims[id].confirmed_name_tier === "C3").map((id) => r3Records.find((r) => r.history.round4.round3_sample_id === id).source_slug));
for (const slug of [...r3NameC3].sort()) {
  const r = R(slug);
  const oldName = r.identity.product_name;
  if (NAME_PICK[slug]) {
    const pick = NAME_PICK[slug];
    const row = r7Row(slug, "pack_name", (x) => x.tier === pick.tier);
    for (const b of pick.blocks) if (!row.value_verbatim.includes(b)) throw new Error("name block not in the r7 text: " + slug + " '" + b + "'");
    // R3-H4 (f): dm-hosted photos are C1 as before; any other host needs the GTIN or the exact pack name and size
    let basis;
    if (pick.tier === "C1") {
      const host = srcHost(row.source_url);
      if (host === "products.dm.de" && /\/DE\/dan\//.test(row.source_url)) basis = "dm.de-hosted pack photo (C1, as in every round)";
      else if (r.identity.gtin && String(row.note).includes(r.identity.gtin)) basis = "pack photo hosted by " + host + (/\/AT\/dan\//.test(row.source_url) ? " (dm.at listing; dm.de has no page for this DAN)" : "") + "; GTIN " + r.identity.gtin + " matches the record (R3-H4 (f))";
      else if (sizeOf(row.value_verbatim) && sizeOf(row.value_verbatim) === sizeOf(r.identity.size)) basis = (MANUFACTURER_HOSTS.includes(host) ? "packshot on the manufacturer's German site " + host : "pack photo hosted by " + host) + "; pack name and size (" + sizeOf(r.identity.size) + ") match the record (R3-H4 (f)" + (MANUFACTURER_HOSTS.includes(host) ? " test" : "") + ")";
      else throw new Error("C1 pick without a GTIN or size match: " + slug);
    } else basis = "German brand page (C2, " + srcHost(row.source_url) + ")";
    const name = pick.blocks.join(" ");
    r.identity.name_variants = uniq((r.identity.name_variants || []).concat(["retailer title (C3, round 1-3 confirmed name): " + oldName]));
    r.identity.product_name = name;
    r.identity.name_override = "packnames-r7 / P3-7: confirmed name from " + basis + "; the retailer title is kept as a name variant";
    r.identity.name_tier = { tier: pick.tier, source: row.source_url, date: row.capture_date, basis };
    // other r7 rows of the same product (corroboration)
    for (const [x, i] of r7.map((x, i) => [x, i]).filter(([x]) => x.slug === slug && x.item === "pack_name" && x.tier !== pick.tier)) {
      r7Used.add(i);
      r.identity.name_corroboration = (r.identity.name_corroboration || []).concat([{ tier: x.tier, source: x.source_url, date: x.capture_date, text: x.value_verbatim, type_word: x.product_type_word }]);
    }
    nameRows.push({ slug, old: oldName, name, tier: pick.tier, basis, type_word: row.product_type_word, differs: row.differs_from_retailer_title });
  } else if (TITLE_ONLY[slug]) {
    const t = TITLE_ONLY[slug];
    const rows = r7.map((x, i) => [x, i]).filter(([x]) => x.slug === slug && x.item === "pack_name");
    for (const [, i] of rows) r7Used.add(i);
    const photo = rows.length ? rows[0][0] : null;
    if (photo && photo.value_verbatim) {
      if (r.identity.gtin && String(photo.note).includes(r.identity.gtin)) throw new Error("title-only product has a GTIN-matched photo: " + slug);
      if (sizeOf(photo.value_verbatim) && sizeOf(photo.value_verbatim) === sizeOf(r.identity.size)) throw new Error("title-only product has a size-matched photo: " + slug);
    }
    const agree = t.titles.every((x) => sameNoun(x.noun, t.titles[0].noun));
    const why = photo && photo.value_verbatim ? "r7 pack photo (" + srcHost(String(photo.source_url)) + ") shows " + (sizeOf(photo.value_verbatim) ? "a " + sizeOf(photo.value_verbatim) + " pack against the record's " + r.identity.size : "no readable size") + " and no GTIN is matched ⇒ not C1 under R3-H4 (f)" : "no pack photo or brand page found in r7";
    r.identity.name_tier = { tier: "C3", source: "retailer title", date: null, basis: "R3-Q2 / R3-H4 (d), (f): " + why };
    r.identity.retailer_titles = t.titles;
    r.identity.retailer_title_type_noun_agrees = agree;
    if (agree) addReview(r, "name_from_retailer_title");
    else addReview(r, "retailer_title_type_noun_conflict");
    if (photo && photo.value_verbatim) r.identity.name_corroboration = [{ tier: "not_C1 (R3-H4 (f))", source: photo.source_url, date: photo.capture_date, text: photo.value_verbatim, type_word: photo.product_type_word }];
    nameRows.push({ slug, old: oldName, name: oldName, tier: "C3", basis: why, agree, nouns: t.titles.map((x) => x.noun), agree_note: t.agree_note || null });
  } else throw new Error("C3-name record not covered by the r7 tables: " + slug);
}
for (const s of [...Object.keys(NAME_PICK), ...Object.keys(TITLE_ONLY)]) if (!r3NameC3.has(s)) throw new Error("r7 table names a record whose round-3 name was not C3: " + s);
// name-derived claims of the renamed records are re-derived from the new name, with the name's tier
const nameTableStart = nameTable.length;
for (const row of nameRows.filter((x) => x.name !== x.old)) {
  const r = R(row.slug);
  const old = r.claims.filter((c) => c.from_product_name);
  r.claims = r.claims.filter((c) => !c.from_product_name);
  const before = r.claims.length;
  addNameClaims(r);
  for (const c of r.claims.slice(before)) {
    c.tier = r.identity.name_tier.tier;
    c.tier_basis = "name-derived claim (RG-13) from the confirmed name, " + r.identity.name_tier.basis;
  }
  if (old.length) r.history.round4.removed_name_claims = old;
}
const nameTableR4 = nameTable.slice(nameTableStart);
logPatch("P3-7 / R3-Q2 / R3-H4 (d), (f)", "(" + nameRows.length + " records)", "applied", nameRows.filter((x) => x.name !== x.old).length + " retailer-title names replaced by the pack (C1) or German brand-page (C2) name from packnames-r7 (" + nameRows.filter((x) => x.name !== x.old && x.tier === "C1").length + " C1, " + nameRows.filter((x) => x.name !== x.old && x.tier === "C2").length + " C2; table in section 6); " + nameRows.filter((x) => x.name === x.old).length + " keep the retailer title (" + nameRows.filter((x) => x.name === x.old && x.agree).length + " with review name_from_retailer_title, " + nameRows.filter((x) => x.name === x.old && !x.agree).length + " with review retailer_title_type_noun_conflict); name-derived claims re-derived: " + (nameTableR4.filter((x) => x.kept).map((x) => x.slug + " '" + x.word + "' (" + x.type + ")").join(", ") || "none"));

// ---------------------------------------------------------------------------------------------
// P3-2: a hold entry's words come only from its own captured text (P2-5 for every record);
// a dropped strength phrase found verbatim in another C1/C2 line of the record gets its own hold line
// ---------------------------------------------------------------------------------------------
const STRENGTH_STEMS = /(leicht|sanft|soft|weich|mittel|normal|stark|extra|ultra|mega|extrem|maximal|\bmax\b|power|krass)/i; // round-3 diff.js §7.4 stems
const PURE_NUMBER_RE = /^[^A-Za-zÄÖÜäöüß]*(?:hold[- ]?faktor|haltfaktor|halte?grad|halte?stufe|halt|hold)?(?:\s*(?:von|:))?\s*\d+\+?\s*$/i; // „Haltegrad: 5", „Hold-Faktor 6", „HALT 3"
const holdLog = [];
const holdAdded = [];
for (const r of records.slice().sort((a, b) => cmp(a.source_slug, b.source_slug))) {
  const holds = r.claims.filter((c) => c.type === "hold");
  for (const h of holds) {
    if (h.words == null) continue;
    const phrases = String(h.words).split(/\s*;\s*/).filter(Boolean);
    const raw = String(h.raw);
    const kept = [];
    const dropped = [];
    for (const p of phrases) {
      const i = raw.toLowerCase().indexOf(p.toLowerCase());
      if (i >= 0) kept.push(raw.slice(i, i + p.length));
      else dropped.push(p);
    }
    if (!dropped.length) continue;
    const before = h.words;
    h.words_as_captured = h.words_as_captured || before;
    // nothing of the words occurs in the line: the line's own text is its words (P2-5 precedent), unless the line is a number/scale only
    h.words = kept.length ? uniq(kept).join("; ") : PURE_NUMBER_RE.test(raw) ? null : raw;
    const fate = [];
    const stemsOf = (t) => new Set((String(t).toLowerCase().match(new RegExp(STRENGTH_STEMS.source, "gi")) || []).map((x) => x.toLowerCase()));
    const rawStems = stemsOf(raw);
    for (const p of dropped) {
      if (stemsOf(p).size && [...stemsOf(p)].every((x) => rawStems.has(x))) {
        fate.push("„" + p + "\" is the line's own wording in another inflection or spelling (its strength word is in the line's text)");
        continue;
      }
      const src = STRENGTH_STEMS.test(p) ? r.claims.find((c) => c !== h && isC12(c.tier) && c.type !== "hold" && String(c.raw).toLowerCase().includes(p.toLowerCase())) : null;
      const dup = r.claims.some((c) => c.type === "hold" && STRENGTH_STEMS.test(String(c.raw)) && (String(c.raw).toLowerCase().includes(p.toLowerCase()) || p.toLowerCase().includes(String(c.raw).toLowerCase())));
      if (src && !dup) {
        const i = String(src.raw).toLowerCase().indexOf(p.toLowerCase());
        const text = String(src.raw).slice(i, i + p.length);
        r.claims.push(mk({ type: "hold", raw: text, tier: src.tier, source: src.source, date: src.date, words: text, tier_basis: "P3-2: strength phrase split out of the captured " + src.tier + " " + src.type + " line „" + src.raw + "\" (same source); it had been carried only as hold words of „" + h.raw + "\"" }));
        holdAdded.push({ slug: r.source_slug, text, tier: src.tier, from: src.type + " „" + src.raw + "\"" });
        fate.push("„" + p + "\" ⇒ own " + src.tier + " hold line „" + text + "\" (found in the " + src.type + " line)");
      } else {
        r.claim_capture.dropped_values = (r.claim_capture.dropped_values || []).concat([{ type: "hold.words", value: p, reason: "P3-2: not in the hold line's own text „" + h.raw + "\"" + (dup ? "; already carried by a hold line" : STRENGTH_STEMS.test(p) ? "; contains a strength stem and no captured C1/C2 line carries it (re-capture needed)" : "; no strength word") }]);
        fate.push("„" + p + "\" dropped" + (dup ? " (already a hold line)" : STRENGTH_STEMS.test(p) ? " (contains a §7.4 strength stem; no captured C1/C2 line carries it)" : ""));
      }
    }
    note(h, "capture_note", "P3-2: words '" + before + "' -> " + (h.words == null ? "none" : "'" + h.words + "'") + " (only text found in this line's own raw)");
    holdLog.push({ slug: r.source_slug, raw: h.raw, tier: h.tier, before, after: h.words, fate, strength_dropped: fate.some((f) => /strength stem; no captured/.test(f)) });
  }
}
// guard: no hold entry keeps a word outside its own text
for (const r of records) for (const h of r.claims.filter((c) => c.type === "hold" && c.words != null)) for (const p of String(h.words).split(/\s*;\s*/)) if (!String(h.raw).toLowerCase().includes(p.toLowerCase())) throw new Error("P3-2 guard: " + r.source_slug + " '" + p + "'");
logPatch("P3-2", "(" + uniq(holdLog.map((x) => x.slug)).length + " records)", "applied", holdLog.length + " hold entries corrected (" + holdLog.filter((x) => x.strength_dropped).length + " of them lost a strength-stem phrase that no captured C1/C2 line carries); " + holdAdded.length + " strength phrases found verbatim in another C1/C2 line of the same record became their own hold line; every change listed in section 7");

// ---------------------------------------------------------------------------------------------
// P3-3 / RG3-15: a missing space or slash inside one INCI name that reads as exactly one known name
// ---------------------------------------------------------------------------------------------
const lexText = fs.readFileSync(LEXICON_DOC, "utf8").toLowerCase();
const knownKeys = new Map();
for (const r of records) for (const L of [r.identity.inci_normalised, (r.identity.inci_alt || {}).inci_normalised || []]) for (const it of L) {
  const k = keyOf(it.inci);
  if (!knownKeys.has(k)) knownKeys.set(k, new Set());
  knownKeys.get(k).add(r.source_slug);
}
const DEFECT_RE = /[a-z][A-Z]|[0-9][A-Z][a-z]|\bVPVA\b/;
const inciRepairs = [];
const inciUnrepaired = [];
for (const r of records.slice().sort((a, b) => cmp(a.source_slug, b.source_slug))) {
  for (const [label, L] of [["inci", r.identity.inci_normalised], ["inci_alt", (r.identity.inci_alt || {}).inci_normalised || []]]) {
    for (const it of L) {
      if (!DEFECT_RE.test(it.inci)) continue;
      const cand = /\bVPVA\b/i.test(it.inci) ? it.inci.replace(/\bVPVA\b/i, (m) => m.slice(0, 2) + "/" + m.slice(2)) : it.inci.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/([0-9])([A-Z][a-z])/g, "$1 $2");
      const k = keyOf(cand);
      const elsewhere = knownKeys.has(k) && [...knownKeys.get(k)].some((s) => s !== r.source_slug);
      const inLexicon = lexText.includes(k);
      if (!elsewhere && !inLexicon) {
        // not a known name in the cohort or lexicon v0.4: left as printed, flagged with its rank (RG3-15 repairs known names only)
        inciUnrepaired.push({ slug: r.source_slug, list: label, rank: it.rank, inci: it.inci, candidate: cand });
        if (label === "inci") r.identity.inci_flags = uniq(r.identity.inci_flags.concat(["missing_space_as_printed (P3-3, rank " + it.rank + "): '" + it.inci + "' — the spaced reading '" + cand + "' is not an INCI name of another record or of lexicon v0.4, so it is not repaired; one item either way (no separator missing)"]));
        continue;
      }
      const from = it.inci;
      it.inci = cand;
      const txt = "P3-3 / RG3-15 repair (" + label + " r" + it.rank + "): '" + from + "' -> '" + cand + "' (missing " + (/VPVA/i.test(from) ? "slash" : "space") + " inside one INCI name; the repaired form is " + (elsewhere ? "an INCI name in another record" : "named in lexicon v0.4") + "; as_written kept)";
      r.identity.transcription_repairs = uniq((r.identity.transcription_repairs || []).concat([txt]));
      if (label === "inci") r.identity.inci_flags = uniq(r.identity.inci_flags.concat(["repaired_missing_" + (/VPVA/i.test(from) ? "slash" : "space") + " (P3-3, rank " + it.rank + "): '" + from + "' -> '" + cand + "'"]));
      inciRepairs.push({ slug: r.source_slug, list: label, rank: it.rank, from, to: cand, known: elsewhere ? "other record" : "lexicon v0.4" });
    }
  }
  // the round-3 flags that reported these defects as unrepaired are superseded
  r.identity.inci_flags = r.identity.inci_flags.map((f) => (/^missing_spaces_as_printed:.*\(not repaired\)$/.test(f) && inciRepairs.some((x) => x.slug === r.source_slug) ? f.replace(/\(not repaired\)$/, "(repaired by the round-4 freeze, P3-3)") : f));
}
logPatch("P3-3 / RG3-15", "(" + uniq(inciRepairs.map((x) => x.slug)).length + " records)", "applied", inciRepairs.length + " repairs: " + inciRepairs.map((x) => x.slug + " r" + x.rank + " '" + x.from + "' -> '" + x.to + "'").join("; ") + " (as_written kept, flagged with rank)" + (inciUnrepaired.length ? "; not repaired (spaced reading not a known name, flagged with rank): " + inciUnrepaired.map((x) => x.slug + " r" + x.rank + " '" + x.inci + "'").join("; ") : ""));

// ---------------------------------------------------------------------------------------------
// P3-6 / RG3-22: item-count mismatch flags resolved against the captured source text
// ---------------------------------------------------------------------------------------------
const countLog = [];
for (const r of records.slice().sort((a, b) => cmp(a.source_slug, b.source_slug))) {
  r.identity.inci_flags = r.identity.inci_flags.map((f) => {
    const m = f.match(/^capture_item_count_(\d+)_vs_split_(\d+)$/);
    if (!m) return f;
    const n = +m[1];
    const split = +m[2];
    const naive = String(r.identity.inci_raw).split(",").map((x) => x.trim()).filter(Boolean).length;
    const paren = (String(r.identity.inci_raw).match(/\([^()]*(?:\([^()]*\)[^()]*)*\)/g) || []).filter((g) => g.includes(","));
    if (naive !== n || r.identity.inci_normalised.length !== split) throw new Error("P3-6 unresolved count flag: " + r.source_slug + " " + f);
    const res = "capture_item_count_resolved (P3-6, RG3-22): the capture's count " + n + " counts the commas inside " + paren.length + " parenthesised synonym group(s) (" + paren.join("; ") + "); split at the top level the source list has " + split + " items; no item missing or extra";
    countLog.push({ slug: r.source_slug, flag: f, resolution: res });
    return res;
  });
}
logPatch("P3-6 / RG3-22", "(" + countLog.length + " records)", "applied", countLog.map((x) => x.slug + ": '" + x.flag + "' resolved (no item missing; the capture count included commas inside parentheses)").join("; "));

// ---------------------------------------------------------------------------------------------
// P3-5: a hold claim read from a printed display carries the display description in the claims packet
// ---------------------------------------------------------------------------------------------
const displayLog = [];
for (const r of records) for (const c of r.claims) if (c.type === "hold" && c.display && c.display.as_captured) displayLog.push({ slug: r.source_slug, raw: c.raw });
if (!displayLog.some((x) => x.slug === "taft-styling-paste-forming-halt-5plus")) throw new Error("P3-5: Taft Paste display missing");
{
  const r = R("taft-styling-paste-forming-halt-5plus");
  const row = r7Row(r.source_slug, "pack_name"); // already used by P3-7; re-read confirms the display
  if (!/four filled dots \+ larger circle "5\+"/.test(row.value_verbatim)) throw new Error("P3-5: r7 does not confirm the Taft display");
  const c = r.claims.find((x) => x.type === "hold" && x.display);
  c.display.confirmed = "packnames-r7 (" + row.capture_date + "): the pack front again shows four filled dots and a larger circle „5+\"";
}
logPatch("P3-5", "(" + displayLog.length + " records)", "applied", "the claims packet's hold display now carries `description` (the observer's description of the printed display, as captured) and, where re-read, `confirmed`: " + displayLog.map((x) => x.slug + " („" + x.raw + "\")").join(", "));

// ---------------------------------------------------------------------------------------------
// Versions, ids, guards
// ---------------------------------------------------------------------------------------------
const typeOrder = ["promise", "hold", "flexibility", "finish", "duration", "humidity", "heat_protection", "heat_activation", "cast", "other", "hair_type", "free_from"];
for (const r of records) {
  r.standard_version = STANDARD_VERSION;
  r.lexicon_version = LEXICON_VERSION;
  r.claims = r.claims.map((c, i) => [c, i]).sort((a, b) => typeOrder.indexOf(a[0].type) - typeOrder.indexOf(b[0].type) || a[1] - b[1]).map((x) => x[0]);
}
const exclusions = R3_EXCLUSIONS.map((e) => Object.assign({}, e, { status_in_round4: "unchanged from round 3" }));
{
  const idSet = new Set();
  for (const r of records) {
    r.sample_id = "sty-" + sha256(Buffer.from(ID_SALT + r.source_slug)).slice(0, 10);
    if (idSet.has(r.sample_id)) throw new Error("opaque id collision " + r.sample_id);
    if (R1_IDS.has(r.sample_id)) throw new Error("round-4 id equals a round-1 id: " + r.sample_id);
    if (R2_IDS.has(r.sample_id)) throw new Error("round-4 id equals a round-2 id: " + r.sample_id);
    if (R3_IDS.has(r.sample_id)) throw new Error("round-4 id equals a round-3 id: " + r.sample_id);
    idSet.add(r.sample_id);
  }
  const slugs = new Set();
  for (const r of records) {
    if (slugs.has(r.source_slug)) throw new Error("duplicate slug " + r.source_slug);
    slugs.add(r.source_slug);
  }
  if (records.length !== 143) throw new Error("expected 143 records, got " + records.length);
  if (records.some((r) => r.cohort_role !== r.history.round4.round3_role)) throw new Error("a cohort role changed");
}
records.sort((a, b) => cmp(a.sample_id, b.sample_id));
const r7Unused = r7.map((x, i) => [x, i]).filter(([, i]) => !r7Used.has(i)).map(([x]) => x.slug + " / " + x.item + " / " + x.tier);
if (r7Unused.length) throw new Error("packnames-r7 rows not read: " + r7Unused.join(", "));

// ---------------------------------------------------------------------------------------------
// Packets (round-3 builder, plus P3-1, P3-5 and the name tier)
// ---------------------------------------------------------------------------------------------
const packets = { s0: [], fu: [], claims: [] };
const leaks = { fu_brand_name: [], s0_hold_number_or_scale: [], s0_strength_word: [], s0_flexibility_word: [], s0_finish_grade: [], s0_label: [], claims_annotation: [], slug: [], round1_2_or_3_id: [], url: [], forbidden_key: [], subtype_or_route_id: [], any_label: [] };
const s0Stats = { promise_lines_masked: 0, packets_with_masked_promise: 0, replacements: 0, names_masked: 0, directions_masked: 0 };
const strengthElsewhere = [];
// Generic German words of the new pack names that the round-1 F/U name check matches by prefix inside ordinary
// directions words („trockene Haar", „Spülung", „feuchtigkeitsauffüllende"). They identify no product, and masking them
// would remove U-field input (dry vs damp hair; RG2-20's first-named rinse-out use), so they are not masked or counted.
const R4_GENERIC_NAME_HITS = ["name:trocken", "name:spülung", "name:feuchtigkeits"];
const genericNameHits = [];
const subtypeIds = uniq(records.map((r) => r.reference_only_not_for_blind_lanes.draft_subtype).filter((x) => x && /_/.test(x))).concat(["leave_in", "heat_protectant", "dry_shampoo", "provisional_boundary", "negative_control", "salt_spray", "texture_spray", "shine_finish", "smoothing_styler", "curl_cream"]);
const allSlugs = records.map((r) => r.source_slug);
const priorIds = new Set([...R1_IDS, ...R2_IDS, ...R3_IDS]);
const srcClassOf = (c) => c.source_class_override || (c.from_product_name ? "product_name" : c.retailer_attribute ? "retailer_attribute" : sourceClass(c.tier));
const displayForPacket = (d) => {
  const o = displayForPacketR3(d);
  if (!o) return o;
  if (d.as_captured) o.description = d.as_captured; // P3-5
  if (d.confirmed) o.confirmed = d.confirmed;
  return o;
};
const R4_FLAG_RE = /^capture_item_count_resolved \(P3-6|^repaired_missing_(?:space|slash) \(P3-3|^missing_space_as_printed \(P3-3/; // flags written by this freeze
const flagRank = (rec, f) => (R4_FLAG_RE.test(f) ? (f.match(/rank (\d+)/) ? +f.match(/rank (\d+)/)[1] : null) : flagRankR3(rec, f));
const nameTierOf = (rec) => (rec.identity.name_tier ? rec.identity.name_tier.tier : rec.claim_capture.record_best_tier);
// P3-1: identity_status inside `identity` in every S0 packet. The records' 'as_captured' (one list, no identity or
// formula conflict found at capture; the evidence gate has always read it as verified) ships as 'verified'.
const packetIdentityStatus = (rec) => (rec.identity.identity_status === "as_captured" ? "verified" : rec.identity.identity_status);
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
  // kept where round 3 had them (top level), so a lane reading either place sees the same status (P3-1)
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
  const cp = { packet: "claims", packet_version: COHORT_VERSION, sample_id: id, brand: rec.identity.brand, confirmed_name: rec.identity.product_name, confirmed_name_tier: nt, format: rec.identity.format, product_type_word: productTypeWord(rec.identity.product_name, rec.identity.format), scale_info: scaleHold ? { number: scaleHold.number, scale_as_written: scaleHold.scale_as_written, scale_max: scaleHold.scale_max, scale_max_stated: scaleHold.scale_max_stated, tier: scaleHold.tier } : null, claims: cl };
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
    for (const rid of priorIds) if (ser.includes(rid)) leaks.round1_2_or_3_id.push(kind + "/" + p.id + ": " + rid);
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
// P3-1 guard: every S0 packet carries identity.identity_status; every conflict packet carries identity.inci_alt
for (const p of packets.s0) {
  if (!p.body.identity.identity_status) throw new Error("P3-1: no identity.identity_status in " + p.id);
  if (p.rec.identity.identity_status === "inci_conflict" && !p.body.identity.inci_alt) throw new Error("P3-1: no identity.inci_alt in " + p.id);
}
logPatch("P3-1", "(all records)", "applied", "every S0 packet carries identity.identity_status (" + Object.entries(count(packets.s0, (p) => p.body.identity.identity_status)).sort().map(([k, v]) => v + " " + k).join(", ") + "; the records' 'as_captured' ships as 'verified', as the gate has always read it), with identity.inci_alt next to it on the inci_conflict records and identity.identity_note on the verified_with_minor_source_difference records; the round-3 top-level fields are kept as well");
logPatch("name tier in S0", "(all records)", "applied", "the S0 product block carries confirmed_name_tier (the claims packet's value) so the R3-Q2 / R3-H4 (d) name rules can be applied blind; C3 names add confirmed_name_from_retailer_title and retailer_title_type_noun_agrees");

// ---------------------------------------------------------------------------------------------
// S0 job-word check (before = round-3 records, after = round-4 records; same masking)
// ---------------------------------------------------------------------------------------------
const s0Mask = (t, isName) => (t == null ? null : maskS0(t, isName).text);
const r3Base = JSON.parse(JSON.stringify(R3("records")));
const summarise = (j) => ({
  diff_records_with_a_lost_job_word: j.diff.filter(([, x]) => x && x.any_lost).length,
  diff_records_with_complete_lead_job_loss: j.diff.filter(([, x]) => x && x.complete).length,
  diff_complete_loss_slugs: j.diff.filter(([, x]) => x && x.complete).map(([s]) => s).sort(),
  job_records_with_job_words_in_capture: j.job.filter(([, x]) => x.raw > 0).length,
  job_records_zero_job_words_in_s0_where_capture_had_one: j.job.filter(([, x]) => x.raw > 0 && x.s0 === 0).map(([s]) => s).sort(),
  job_records_losing_at_least_one_job_word: j.job.filter(([, x]) => x.lost.length).length,
});
const jobBefore = { diff: r3Base.map((r) => [r.source_slug, diffMethod(r, s0Mask)]), job: r3Base.map((r) => [r.source_slug, jobCheck(r, s0Mask)]) };
const jobAfter = { diff: records.map((r) => [r.source_slug, diffMethod(r, s0Mask)]), job: records.map((r) => [r.source_slug, jobCheck(r, s0Mask)]) };
const jobSummary = { before_round3: summarise(jobBefore), after_round4: summarise(jobAfter) };
const lostAfter = jobAfter.job.filter(([, x]) => x.lost.length).map(([s, x]) => s + " (" + x.lost.join(", ") + ")").sort();
if (jobSummary.after_round4.job_records_zero_job_words_in_s0_where_capture_had_one.length) throw new Error("S0 records with zero job words: " + jobSummary.after_round4.job_records_zero_job_words_in_s0_where_capture_had_one.join(", "));

// ---------------------------------------------------------------------------------------------
// Evidence gate (standard 4.1 + RG2-24 + RG3-15: only incompleteness above the tail blocks)
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
  failing: gateRows.filter((x) => !x.pass).map((x) => "`" + x.r.source_slug + "` (" + x.r.cohort_role + "; " + [x.promise ? null : "no C1/C2 promise", x.dir ? null : "directions " + x.r.directions.directions_status, x.inciComplete ? null : "INCI defect above the tail", x.identityOk ? null : "identity " + x.r.identity.identity_status].filter(Boolean).join(", ") + ")").sort(),
};
const r3GatePassBySlug = Object.fromEntries(r3Base.map((r) => [r.source_slug, r.evidence_gate_inputs.all_three]));
const r3GatePass = Object.values(r3GatePassBySlug).filter(Boolean).length;
const gateChanged = gateRows.filter((x) => r3GatePassBySlug[x.r.source_slug] !== x.pass).map((x) => "`" + x.r.source_slug + "` (" + (r3GatePassBySlug[x.r.source_slug] ? "pass" : "fail") + " -> " + (x.pass ? "pass" : "fail") + ")").sort();
for (const g of gateRows) g.r.evidence_gate_inputs = { c1_c2_promise: g.promise, directions_verbatim: g.dir, inci_complete: g.inciComplete, inci_tail_defects: g.tailOnly.map((d) => d.flag), identity_status_ok: g.identityOk, all_three: g.pass };

// records whose S0 or claims packet changed against round 3 (the rerun scope of the confirmation round)
const stripIds = (o) => JSON.stringify(o).replace(/"sample_id":"sty-[0-9a-f]+"/, "").replace(/"packet_version":"[^"]*"/, "");
const changedS0 = [];
const changedClaims = [];
const s0Only = (b) => {
  const c = JSON.parse(JSON.stringify(b));
  delete c.product.confirmed_name_tier; // new field in every packet
  delete c.product.confirmed_name_from_retailer_title;
  delete c.product.retailer_title_type_noun_agrees;
  delete c.identity.identity_status; // P3-1 moves it into every packet
  delete c.identity.inci_alt;
  delete c.identity.identity_note;
  for (const f of c.identity.inci_flags) delete f.status;
  return c;
};
for (const p of packets.s0) {
  const old = r3Packets.s0[p.rec.history.round4.round3_sample_id];
  if (stripIds(s0Only(p.body)) !== stripIds(old)) changedS0.push(p.rec.source_slug);
}
for (const p of packets.claims) {
  const old = r3Packets.claims[p.rec.history.round4.round3_sample_id];
  if (stripIds(p.body) !== stripIds(old)) changedClaims.push(p.rec.source_slug);
}

// ---------------------------------------------------------------------------------------------
// Write outputs (only under v1.0/r4/)
// ---------------------------------------------------------------------------------------------
const INPUTS = R3_INPUTS.concat([R7_PACKNAMES, "v1.0/build/freeze-cohort-r3.js"]);
const counts = {
  total: records.length,
  by_role: sortKeys(count(records, (r) => r.cohort_role)),
  by_origin: sortKeys(count(records, (r) => r.reference_only_not_for_blind_lanes.origin)),
  by_role_and_origin: sortKeys(count(records, (r) => r.cohort_role + " / " + r.reference_only_not_for_blind_lanes.origin)),
  by_draft_subtype: sortKeys(count(records, (r) => r.reference_only_not_for_blind_lanes.draft_subtype)),
  by_identity_status: sortKeys(count(records, (r) => r.identity.identity_status)),
  by_directions_status: sortKeys(count(records, (r) => r.directions.directions_status)),
  by_confirmed_name_tier: sortKeys(count(records, (r) => nameTierOf(r))),
  evidence_gate_all_three: gate.pass,
};
const cohort = {
  cohort_version: COHORT_VERSION,
  frozen_on: FREEZE_DATE,
  standard_version: STANDARD_VERSION,
  lexicon_version: LEXICON_VERSION,
  purpose: "Frozen round-4 (confirmation round, R3-L) cohort. REFERENCE INPUT ONLY: never give this file to a blind lane (it maps opaque ids to slugs and to round-1/-2/-3 ids and carries legacy labels).",
  counts,
  exclusions,
  patches: patchLog,
  not_applied: notApplied,
  rerun_scope: { s0_packet_changed: changedS0.slice().sort(), claims_packet_changed: changedClaims.slice().sort() },
  s0_job_word_check: { summary: jobSummary, records_losing_a_job_word_after: lostAfter },
  inputs: INPUTS.map((f) => ({ path: f, sha256: sha256(fs.readFileSync(path.join(BASE, f))) })),
  round3_rebuild_check: { files_compared: round3Check.files, byte_identical: round3Check.identical, round3_manifest_sha256: sha256(fs.readFileSync(path.join(R3_OUT, "artifact-manifest.json"))) },
  id_map: records.map((r) => ({ sample_id: r.sample_id, source_slug: r.source_slug, round3_sample_id: R3_ID_BY_SLUG[r.source_slug] || null, round2_sample_id: (r3IdMap[r.source_slug] || {}).round2_sample_id || null, round1_sample_id: (r3IdMap[r.source_slug] || {}).round1_sample_id || null })),
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
const s0Sample = (packets.s0.find((p) => p.body.identity.inci_alt && p.body.directions) || packets.s0.find((p) => p.body.product.confirmed_name_from_retailer_title) || packets.s0[0]).body;
const s0Sample2 = (packets.s0.find((p) => p.body.product.confirmed_name_from_retailer_title && p.body.directions) || packets.s0[0]).body;
const fuSample = packets.fu.find((p) => p.body.directions).body;
const clSample = (packets.claims.find((p) => p.body.claims.some((c) => c.display && c.display.description) && p.body.claims.some((c) => c.from_product_name)) || packets.claims.find((p) => p.body.claims.some((c) => c.display && c.display.description)) || packets.claims[0]).body;
const roleList = (role) => records.filter((r) => r.cohort_role === role).map((r) => "`" + r.source_slug + "`").sort();
const leakLines = Object.entries(leaks).map(([k, v]) => "| " + k + " | " + v.length + " |").join("\n");
const b = jobSummary.before_round3;
const a = jobSummary.after_round4;
const notes = `# FREEZE-NOTES - Styling round-4 confirmation cohort (${COHORT_VERSION})

Generated by \`build/freeze-cohort-r4.js\` (deterministic; re-run to reproduce every hash in \`r4/artifact-manifest.json\`). Frozen ${FREEZE_DATE}. Standard \`${STANDARD_VERSION}\` (amended 2026-10-13, R3-H2…R3-H4), lexicon \`${LEXICON_VERSION}\`. Round 4 is the confirmation round of R3-L. Every number below is computed by the script. Nothing here is committed or locked, and nothing is classified (no route, subtype or hold level is assigned).

## 1. How the cohort was built

1. The round-3 script \`build/freeze-cohort-r3.js\` is run unchanged in a sandbox whose writes go to memory (it rebuilds rounds 2 and 1 the same way). Its ${round3Check.files} round-3 outputs were compared with the files under \`r3/\` on disk: ${round3Check.identical} of ${round3Check.files} byte-identical (the build stops on any difference). Its ${r3Records.length} records are the base; no record is added or removed and every cohort role is kept (no unseen slots).
2. The round-3 packet issues P3-1…P3-7 are applied with the owner rulings R3-H3 (Elnett directions) and R3-H4 (d), (f) (name rules) and the pack-name capture \`capture/packnames-r7.json\` (section 3). All ${r7.length} r7 rows were read by a patch (the build stops on an unread row).
3. Opaque ids: \`sty-\` + 10 hex of SHA-256(\`${ID_SALT}\` + slug). No round-4 id equals a round-1, round-2 or round-3 id (checked). The slug ↔ id map (with the round-1, -2 and -3 ids) lives only in \`r4/cohort.json\` (\`id_map\`, \`records[].source_slug\`, \`records[].history\`).

## 2. Counts

| Metric | Value |
|---|---|
| Records in cohort | ${counts.total} |
| Evidence gate, all items | ${gate.pass} of ${counts.total} (round 3: ${r3GatePass}) |
| Records whose S0 packet content changed against round 3 | ${changedS0.length} |
| Records whose claims packet content changed against round 3 | ${changedClaims.length} |

By cohort role:

| Role | n |
|---|---|
${fmt(counts.by_role)}

By origin:

| Origin | n |
|---|---|
${fmt(counts.by_origin)}

By identity status (record; the S0 packet ships \`as_captured\` as \`verified\`, section 9.1):

| Status | n |
|---|---|
${fmt(counts.by_identity_status)}

By directions status:

| Status | n |
|---|---|
${fmt(counts.by_directions_status)}

By confirmed-name tier (claims packet \`confirmed_name_tier\`, now also in S0):

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

${notApplied.map((x) => "- " + x).join("\n")}
- Pack-front lines other than the name in \`packnames-r7.json\` (claims, hold words such as American Crew „HIGH HOLD\", the OSiS „+\" display, the Langhaarmädchen „Hitzeschutz bis 220°C\" line) are not added as claims: R3-T and P3-7 approve the names only.
- Hold words with a §7.4 strength stem that occur in no captured C1/C2 line are dropped, not re-captured (section 7): ${list(holdLog.filter((x) => x.strength_dropped).map((x) => "`" + x.slug + "`"))}. Where the brand scale has no maximum (Wella EIMI Glam Mist, Sugar Lift, Flowing Form), the words decided the level, so these records now carry no strength word until a re-capture puts the phrase on its own hold line.

## 5. Evidence gate (standard 4.1, RG2-24, RG3-15), computed from the S0 packets

| Criterion | Records |
|---|---|
| C1/C2 promise line present | ${gate.promise} of ${counts.total} |
| \`directions_status: verbatim\` | ${gate.dir} of ${counts.total} |
| No INCI incompleteness flag above the tail | ${gate.inci} of ${counts.total} |
| \`identity_status\` not a conflict | ${gate.identity} of ${counts.total} |
| **All items** | **${gate.pass} of ${counts.total}** (round 3: ${r3GatePass}) |

Pass by role: ${Object.entries(gate.by_role).map(([k, v]) => v + " " + k).join(", ")}.

Gate outcome changed against round 3 (${gateChanged.length}): ${list(gateChanged)}.

Tail-only INCI defects (not blocking, review \`inci_tail_defect\`): ${list(gate.tail_only)}.

Records whose only C1/C2 promise lines are fully masked to \`[CLAIM]\`: ${list(gate.promise_only_claim_markers.map((s) => "`" + s + "`"))}.

Not passing (${gate.failing.length}): ${list(gate.failing)}.

## 6. Confirmed names (P3-7, R3-Q2, R3-H4 (d), (f))

| Product | Round-3 name (retailer title) | Round-4 confirmed name | Tier | Basis |
|---|---|---|---|---|
${nameRows.map((x) => "| `" + x.slug + "` | " + esc(x.old) + " | " + (x.name === x.old ? "*(retailer title kept)*" : esc(x.name)) + " | " + x.tier + " | " + esc(x.basis) + (x.name === x.old ? "; type nouns " + x.nouns.map((n) => "„" + n + "\"").join(" / ") + " ⇒ " + (x.agree ? "agree ⇒ review `name_from_retailer_title`" : "differ ⇒ no fallback, review `retailer_title_type_noun_conflict`") + (x.agree_note ? " (" + esc(x.agree_note) + ")" : "") : "") + " |").join("\n")}

Names keep the pack's capitalisation and words; the brand line, claims, hair types, ingredients, sizes and French translations are not part of the name. In S0 the names pass through the R2-Q3 masking (e.g. „EXTRA STRONG\" before „SERUM\" is a strength word that qualifies the product noun, RG-13, so S0 shows „[CLAIM] SERUM\"; the claims packet has the unmasked name). Name-derived claims after the renames: ${nameTableR4.map((x) => "`" + x.slug + "` „" + x.word + "\" (" + (x.kept ? x.type : "rejected: " + x.why) + ")").join(", ") || "none"}.

## 7. Hold words (P3-2) — ${holdLog.length} entries corrected, ${holdAdded.length} hold lines added

${holdLog.map((x) => "- `" + x.slug + "` „" + esc(x.raw) + "\" (" + x.tier + "): words „" + esc(x.before) + "\" → " + (x.after == null ? "none" : "„" + esc(x.after) + "\"") + "; " + x.fate.map(esc).join("; ")).join("\n")}

Rule: a hold entry keeps only the parts of its \`words\` that occur in its own text (case-insensitive; the text's own spelling is kept); when no part occurs, the line's own text becomes its words (the P2-5 precedent), or none when the line is a number or scale only („Haltegrad 3", „Hold-Faktor 5"); every dropped part is logged under the record's \`claim_capture.dropped_values\`. A dropped part with a §7.4 strength stem that occurs verbatim in another C1/C2 line of the same record (same source) becomes its own hold line with that line's tier, source and date, unless a hold line already carries it.

## 8. INCI repairs (P3-3) and count flags (P3-6)

${inciRepairs.map((x) => "- `" + x.slug + "` " + x.list + " r" + x.rank + ": „" + x.from + "\" → „" + x.to + "\" (known reading: " + x.known + ")").join("\n")}

${inciUnrepaired.map((x) => "- `" + x.slug + "` " + x.list + " r" + x.rank + ": „" + x.inci + "\" **not repaired** — the spaced reading „" + x.candidate + "\" is not an INCI name of another record or of lexicon v0.4; flagged with its rank (one item either way, so nothing is incomplete)").join("\n")}

Rule (RG3-15): an INCI item with a lower-case letter or digit directly followed by a capitalised word, or the form „VPVA\", is repaired when inserting the missing space (or slash) gives one name that occurs in another record or in lexicon v0.4; \`as_written\` keeps the printed form and the record carries a \`repaired_missing_space\` / \`repaired_missing_slash\` flag with the rank (status \`resolved_by_freeze\` in S0). The round-3 flags that reported these defects as „not repaired\" now say „repaired by the round-4 freeze\".

${countLog.map((x) => "- `" + x.slug + "`: " + x.resolution).join("\n")}

## 9. Packet field lists

All packets: one JSON file per product, \`r4/packets/<kind>/<opaque id>.json\`.

### 9.1 S0 (\`packets/s0/\`)

${fieldList(s0Sample, "").join("\n")}

A retailer-title name adds (example):

${fieldList({ product: s0Sample2.product }, "").join("\n")}

**P3-1:** \`identity.identity_status\` is in **every** S0 packet: \`verified\` (the records' \`as_captured\`: one INCI list, no identity or formula conflict found; the evidence gate has always read it as verified), \`verified_with_minor_source_difference\` (with \`identity.identity_note\`) or \`inci_conflict\` (with \`identity.inci_alt\`, the second list). The round-3 top-level \`identity_status\` / \`inci_alt\` / \`identity_note\` are kept on the same records. \`identity.inci_flags\` is always present (empty when the record has no flag); flags the freeze resolved carry \`status: resolved_by_freeze\`. \`product.confirmed_name_tier\` is in every packet (C1 pack, C2 brand page or house brand, C3 retailer title); a C3 name adds \`confirmed_name_from_retailer_title: true\` and \`retailer_title_type_noun_agrees\` (R3-H4 (d): only when \`true\` may the title's product-type noun stand in for the name).

### 9.2 F/U (\`packets/fu/\`)

${fieldList(fuSample, "").join("\n")}

F/U directions keep the round-1 masking (brand, name, look/strength words → \`[CLAIM]\`).

### 9.3 Claims (\`packets/claims/\`)

${fieldList(clSample, "").join("\n")}

**P3-5:** a hold claim read from a printed display carries \`display.description\` (the observer's description as captured) and, where re-read, \`display.confirmed\`.

## 10. S0 masking (R2-Q3, unchanged) and the job-word check

S0 masking is the round-3 masking, unchanged. ${s0Stats.promise_lines_masked} promise lines on ${s0Stats.packets_with_masked_promise} S0 packets carry a mask (${s0Stats.replacements} replacements); ${s0Stats.names_masked} confirmed names and ${s0Stats.directions_masked} directions texts carry one.

| Check | Round 3 (${r3Base.length} records) | Round 4 (${records.length} records) |
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

F/U name check: generic words of the new pack names matched by prefix inside ordinary directions words are not masked and not counted (${genericNameHits.length}: ${list(genericNameHits)}); masking them would hide whether the hair is dry or damp and the first-named rinse-out use (RG2-20). The round-3 checks are otherwise unchanged, with the id check extended to the round-3 ids (\`round1_2_or_3_id\`); the build stops on any hit. Strength words that grade something other than hold stay visible under R2-Q3; listed for review (${uniq(strengthElsewhere).length}): ${list(uniq(strengthElsewhere).sort())}.

## 12. Rerun scope (records whose packet content changed against round 3)

S0 (${changedS0.length}; ignoring the fields every packet gained — \`confirmed_name_tier\`, \`identity.identity_status\` and its neighbours, the \`status\` of resolved flags): ${list(changedS0.slice().sort().map((s) => "`" + s + "`"))}.

Claims (${changedClaims.length}): ${list(changedClaims.slice().sort().map((s) => "`" + s + "`"))}.

Under R3-L round 4 is a confirmation round over the whole cohort; these lists show where the packets themselves moved. The v0.4 rule changes (R3-Q1…R3-Q4, R3-H, RG3-*, R3-H2…R3-H4) touch records whose packets did not move; the rerun obligation (standard §14) covers them too.

## 13. Reproduction

\`node data/research/styling-inci/v1.0/build/freeze-cohort-r4.js\` rewrites \`r4/\` only; two consecutive runs give byte-identical output. \`r4/artifact-manifest.json\` records the SHA-256 of every input (round-1…3 inputs, the capture files, the earlier scripts), of this script and of every output.
`;
writeOut("FREEZE-NOTES.md", notes);
const manifest = {
  manifest_version: COHORT_VERSION,
  frozen_on: FREEZE_DATE,
  algorithm: "sha256",
  script: { path: "v1.0/build/freeze-cohort-r4.js", sha256: sha256(fs.readFileSync(__filename)) },
  inputs: cohort.inputs,
  round3_rebuild_check: cohort.round3_rebuild_check,
  counts: { packets_s0: packets.s0.length, packets_fu: packets.fu.length, packets_claims: packets.claims.length, cohort_records: records.length },
  artifacts: written.slice().sort(cmp).map((r) => ({ path: "r4/" + r, sha256: sha256(fs.readFileSync(path.join(OUT, r))) })),
};
fs.writeFileSync(path.join(OUT, "artifact-manifest.json"), ser(manifest));
const rootHash = sha256(Buffer.from(manifest.artifacts.map((x) => x.path + ":" + x.sha256).join("\n")));
console.log(JSON.stringify({ records: records.length, by_role: counts.by_role, evidence_gate_pass: gate.pass, evidence_gate_pass_round3: r3GatePass, gate_changed_vs_r3: gateChanged, names: { replaced: nameRows.filter((x) => x.name !== x.old).length, kept: nameRows.filter((x) => x.name === x.old).map((x) => x.slug + (x.agree ? " (agree)" : " (conflict)")) }, hold_entries_corrected: holdLog.length, hold_lines_added: holdAdded.length, inci_repairs: inciRepairs.length, count_flags_resolved: countLog.length, job_check: { zero_job_before: b.job_records_zero_job_words_in_s0_where_capture_had_one.length, zero_job_after: a.job_records_zero_job_words_in_s0_where_capture_had_one.length }, leak_total: leakTotal, changed_s0: changedS0.length, changed_claims: changedClaims.length, packets: manifest.counts, manifest_root_sha256: rootHash, manifest_file_sha256: sha256(fs.readFileSync(path.join(OUT, "artifact-manifest.json"))) }, null, 2));
