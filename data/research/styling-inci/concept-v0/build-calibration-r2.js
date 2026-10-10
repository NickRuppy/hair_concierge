// Round-2 calibration: re-derives hold from frozen C1/C2 claims (round2/F*.json), adds gap-fill records
// (round2/G1, G2) and applies the G0 border verdicts. Rules: plans/styling-concept/01-styling-concept.md §4 (Rev. 2)
// + brand×format normalisation tables below. Run: node build-calibration-r2.js
const fs = require("fs");
const base = JSON.parse(fs.readFileSync("calibration-set.json"));
const recs = base.records.map(r => ({ ...r, round: 1 }));
const byId = Object.fromEntries(recs.map(r => [r.sample_id, r]));

// Normalisation tables (brand scale -> Chaarlie 0-4). Numbers win over words on the same pack.
const TABLES = {
  "x/5 (Taft/Syoss/Wellaflex/Maria Nila; Henkel numbers shared across brands)": "1-2→1 · 3→2 · 4→3 · 5/5+→4",
  "x/6 (NIVEA MEN, Gard, Taft 6)": "1-2→1 · 3→2 · 4→3 · 5-6→4",
  "Alcina Hold-Faktor x/10": "1-2→1 · 3-5→2 · 6-7→3 · 8-10→4",
  "Taft gels (scale 4..14)": "number not comparable → use words ('maximal' → 4); else review",
  "Elnett ladder": "Normal→2 · Stark→3 · Extra stark→4 · 'Sehr stark' unranked → review",
  "Wella EIMI": "no scale max stated → strength words decide",
  "Words": "leicht/sanft/soft/weich→1 · mittel/normal→2 · stark→3 · extra/ultra/mega/sehr stark, maximal, Max, Kleber→4; flexibel/natürlich/langanhaltend/perfekt/Nh = not strength → review",
};
// [hold, basis, claim_tier, extraFlags[], note]
const R2 = {
  "schwarzkopf-taft-power-haargel-halt-5": [4, "C2 'maximalen Halt von Taft' (gel numbers not comparable)", "C2", [], ""],
  "schwarzkopf-taft-schaumfestiger-volumen-halt-4-feines-haar": [3, "C2 Haltegrad 4 (x/5)", "C2", [], ""],
  "schwarzkopf-taft-foehn-spray-volumen-halt-3": [2, "C2 Haltegrad 3 (x/5)", "C2", [], ""],
  "schwarzkopf-taft-haarspray-classic-halt-3": [2, "C2 Haltegrad 3", "C2", ["d8b_identical_inci_sibling"], "INCI identical to Taft Glanz (Halt 4) — verify both against the pack"],
  "schwarzkopf-taft-haarspray-glanz-halt-4": [3, "C2 Haltegrad 4", "C2", ["d8b_identical_inci_sibling"], "INCI identical to Taft Classic (Halt 3) — verify both against the pack"],
  "schwarzkopf-taft-haarspray-power-halt-5": [4, "C2 Haltegrad 5 'Tafts höchste Stufe'", "C2", ["renamed_power_cashmere"], ""],
  "schwarzkopf-taft-texturspray-aloe-boost": [null, "only C5 (AT press release), no hold claim; VP/VA present", "C5", ["possibly_delisted"], ""],
  "schwarzkopf-taft-haarpuder-volumen": [null, "C2 '24 Stunden' = duration only", "C2", [], ""],
  "schwarzkopf-taft-gel-wax-glanz-halt-2": [1, "C2 Haltegrad 2", "C2", [], "Glanzstufe 5 only a Rossmann trace"],
  "schwarzkopf-taft-matt-wax-halt-5": [4, "C2 'maximalen Halt von Taft'", "C2", [], ""],
  "schwarzkopf-taft-styling-balm-locken-halt-3": [3, "C2 'Starker, langanhaltender Halt' (Halt 3 only dm title, C3)", "C2", ["d7_middle_band"], ""],
  "syoss-curl-cream-gel-3in1": [null, "C2 has no hold strength ('48 h definierte Locken'); 'hold 5' only C5", "C2", ["inci_changed"], ""],
  "syoss-schaumfestiger-volume": [3, "C2 'extra starken Halt (Haltegrad 4)'", "C2", [], "round 1 review → 3"],
  "syoss-haarspray-max-hold": [4, "C2 Haltegrad 5", "C2", [], ""],
  "syoss-professional-performance-max-hold-power-wax": [4, "C2 Haltegrad 5", "C2", ["inci_changed"], "finish now 'glänzend'"],
  "got2b-lockenspray-refresher-curlz": [null, "C2 no hold claim; trace fixative", "C2", [], ""],
  "got2b-styling-puder-volumen-powderfull": [null, "C2 'natürlichem Halt' = look word", "C2", [], "round 1 had 1 (dm 'leicht')"],
  "got2b-styling-mattpaste-strand-matte": [2, "C2 'mittlerem Halt'", "C2", [], "round 1 had 1 from dm — corrected"],
  "got2b-styling-paste-istyler-texture-clay": [4, "C2 'ultra krassem Halt'", "C2", [], ""],
  "loreal-paris-elnett-haarspray-extra-starker-halt": [4, "C1/C2 'Extra Starker Halt' (Elnett ladder)", "C1", [], ""],
  "loreal-men-expert-barber-club-styling-pomade": [null, "C2 'perfekten Halt' = no strength", "C2", [], "round 1 had 3 from Douglas"],
  "loreal-paris-elnett-stylingspray-hitzeschutz-3-tage-glatt": [3, "C1 'Starker Halt' (pack); D8b plausibility flag: no hold route — level kept", "C1", ["claim_formula_conflict","possibly_delisted"], "directions resolved: towel-dried, before blow-dry"],
  "wellaflex-schaumfestiger-locken-und-wellen-starker-halt": [2, "C1 3/5 dots (x/5)", "C1", [], "round 1 had 3 from words"],
  "wella-eimi-sugar-lift": [3, "C2 'starker, dennoch beweglicher Halt' (Haltegrad 3, max unstated → words)", "C2", [], "flexibility: beweglich"],
  "wella-professionals-eimi-flowing-form": [1, "C2 'leichter, flexibler Halt' (Haltegrad 2, max unstated → words)", "C2", [], ""],
  "guhl-foehn-spray-langzeit-volumen": [null, "C1/C2 '48h Halt' = duration", "C1", [], ""],
  "john-frieda-volume-lift-ansatz-booster": [null, "C2 no hold; relaunched", "C2", ["inci_changed"], ""],
  "nivea-men-styling-cream-active-craft-stylers": [3, "C1 4 of printed 1–6 scale", "C1", [], ""],
  "garnier-fructis-leave-in-spray-diamond-sleek-glaettungsspray": [null, "no hold claim → keine Herstellerangabe (hold not used for smoothing_styler)", "C1", [], ""],
  "gard-haarspray-extrastark-pumpspray": [4, "C1 5 of printed 1–6", "C1", [], ""],
  "bali-curls-strong-hold-flaxseed-gel": [4, "C2 'Extra-starker Halt'", "C2", [], ""],
  "bali-gents-matt-paste": [3, "C2 'starkem Halt'", "C2", [], ""],
  "bali-curls-sleek-stick-brows-and-edges": [3, "C2 'starken Halt'", "C2", [], ""],
  "alcina-styling-mousse-aerosol": [2, "C2 Hold-Faktor 5/10", "C2", [], ""],
  "alcina-foehn-lotion": [1, "C2 Hold-Faktor 2/10", "C2", [], ""],
  "alcina-ansatz-volumen-spray-aerosol": [3, "C2 Hold-Faktor 6/10, Flex 6/10", "C2", [], ""],
  "bumble-and-bumble-brilliantine": [null, "C3 Douglas chip only", "C3", [], ""],
  "bumble-and-bumble-surf-spray": [null, "C3 Douglas chip only", "C3", [], ""],
  "color-wow-dream-coat-supernatural-spray": [null, "no manufacturer hold claim; C3 chip ignored", "C3", [], ""],
  "living-proof-full-dry-volume-texture-spray": [null, "C3 only ('weichen Halt'), US page differs (C5)", "C3", [], ""],
  "kevin-murphy-powder-puff-volume": [null, "C5 'Soft Hold' only", "C5", [], ""],
  "american-crew-fiber": [null, "C3 only (Haltfaktor 9, no max)", "C3", [], ""],
  "american-crew-pomade": [2, "C2 via cross-market exception: 'Mittlerer Halt' (Haltfaktor 7)", "C2", [], ""],
  "cantu-shea-butter-extra-hold-edge-stay-gel": [null, "C3 only (cannot assign); D8b plausibility flag: 'Extra Hold' with no hold route", "C3", ["claim_formula_conflict"], "Amazon.de only"],
  "balea-styling-spray-ultra-volumen": [4, "house-brand C2 dm attribute 'sehr starker Halt' (+ 'flexiblen Halt' → beweglich)", "C2_house_brand", [], ""],
  "balea-professional-glow-und-shine-finishing-spray": [null, "house-brand C2: no hold claim; fixative present", "C2_house_brand", [], ""],
  "maria-nila-curlicue-cream": [2, "C2 marianila.de 'Halt 3/5'", "C2", [], "round 1 review → 2"],
};
for (const [id, [hold, basis, tier, fl, note]] of Object.entries(R2)) {
  const r = byId[id]; if (!r) throw new Error("R2 unknown " + id);
  r.round1_hold = r.proposed_hold_level; r.proposed_hold_level = hold; r.hold_basis = basis; r.claim_tier = tier;
  r.flags = [...new Set([...r.flags, ...fl])]; if (note) r.note = (r.note ? r.note + " · " : "") + note;
}
for (const r of recs) if (r.route === "styling" && !r.claim_tier) r.claim_tier = r.flags.includes("house_brand_c2") ? "C2_house_brand" : "C3";

// G0 border verdicts (round2/G0-border-verdicts.json) + D6 wording clarification (fixative-class hold only)
const G0 = {
  "balea-locken-revitalizing-spray": ["styling", "refresher", 0, "D6: no L5, no conditioning"],
  "balea-leave-in-spray-sea-salt-care-define": ["styling", "salt_spray", null, "D6 (salt ≠ fixative-class hold)"],
  "bali-curls-leave-in-spray-curl-defining": ["provisional_boundary", "gel", null, "two INCIs under one GTIN (manufacturer version adds conditioning) — identify the pack formula, then apply D6/G0; C2 'langanhaltenden Halt' = duration"],
  "schwarzkopf-taft-styling-balm-locken-halt-3": ["styling", "curl_cream", 3, "D7 (Nick): middle band + named Styling Balm Locken → Styling; hold C2 'Starker Halt'"],
  "balea-professional-styling-cream-traumlocken": ["styling", "curl_cream", 2, "D7 (Nick): middle band + named Styling Cream → Styling; hold house-brand C2 'mittlerer Halt'"],
  "syoss-curl-control-hydrating-spray": ["provisional_boundary", "refresher", null, "German market unverified / possibly discontinued"],
  "alverde-locken-refresh-spray": ["provisional_boundary", "refresher", null, "cationic below early preservative marker — Leave-in §3.1.1 interpretation"],
};
for (const [id, [route, sub, hold, why]] of Object.entries(G0)) {
  const r = byId[id]; r.route = route; r.v1_subtype = sub; if (route !== "styling") r.proposed_hold_level = null; else if (hold !== null) r.proposed_hold_level = hold;
  r.flags = r.flags.filter(f => f !== "g0_pending").concat(["g0_ruled"]); r.g0_verdict = why;
}

// Gap-fill records
const G = {
  "john-frieda-frizz-ease-traumlocken-lockencreme": ["styling", "curl_cream", null, "C3 'langanhaltenden Halt' = duration", ["d7_middle_band"], "acrylates r2 + fatty alcohols r4/r5"],
  "cantu-lockencreme-kokos": ["leave_in", null, null, "", [], "no fixative, rich conditioning"],
  "hask-lockencreme-curl-care": ["leave_in", null, null, "", [], "fixatives only at r15+, behentrimonium r5"],
  "kevin-murphy-killer-curls": ["styling", "curl_cream", null, "no DE hold claim; fixative-led", ["hold_unclaimed"], "acrylates/PU-14, no cationic → styling-first"],
  "aussie-leave-in-creme-work-that-curl": ["leave_in", null, null, "", ["extra_beyond_quota"], "behentrimonium r3"],
  "langhaarmaedchen-lockenspray-natur-lockenwunder": ["provisional_boundary", "refresher", null, "", [], "amidoamine conditioner r4 — D6 needs a G0 read"],
  "balea-professional-definier-spray-traumlocken": ["provisional_boundary", "refresher", null, "", ["claim_formula_conflict"], "oils+protein, no cationic — does oil count as conditioning for D6?"],
  "schwarzkopf-professional-osis-curl-retouch": ["leave_in", null, null, "", [], "four cationics + cetearyl; starch only"],
  "balea-haargel-hair-jelly": ["styling", "gel", null, "C2 'flexiblen Halt' = flexibility only", ["house_brand_c2"], "light gel, PVP r6"],
  "langhaarmaedchen-lockenspray-halt-sprungkraft": ["styling", "gel", null, "C2 'Verleiht Halt' no strength", ["house_brand_c2"], "D6: starch only, no conditioning; liquid curl-hold spray filed as gel (spray format)"],
};
const G2 = { // shine/texture/salt
  "_shine_hold_unclaimed_fixative": null,
};
const g1 = JSON.parse(fs.readFileSync("round2/G1-curls-refresh.json"));
const g2 = JSON.parse(fs.readFileSync("round2/G2-finish-texture.json"));
const routeG2 = r => {
  const t = r.subtype_candidate, fx = /(pvp|vp\/va|polyurethane-14|acrylates|caprolactam)/i.test(r.inci || "");
  const salt = /(maris sal|sodium chloride|magnesium sulfate|sea salt)/i.test(r.inci || "");
  if (t === "shine_finish") return ["styling", t, fx ? null : 0, fx ? "no hold claim; fixative present → review" : "no hold claim, no hold route"];
  if (t === "salt_spray") return ["styling", t, salt ? null : 0, "no hold claim; salt route → review"];
  return ["styling", t, null, r.hold_claim && r.hold_claim.raw ? `'${r.hold_claim.raw}' = no strength word → review` : "no hold claim; fixative → review"];
};
for (const r of [...g1, ...g2]) {
  if (byId[r.sample_id]) throw new Error("duplicate " + r.sample_id);
  let route, sub, hold, basis, fl = [], note = "";
  if (G[r.sample_id]) [route, sub, hold, basis, fl, note] = G[r.sample_id];
  else [route, sub, hold, basis] = routeG2(r);
  if (r.sample_id.includes("balea-finishing-spray-glow")) { fl.push("possible_duplicate_of_round1_balea_glow"); }
  if (r.sample_id.includes("alverde-beach")) { fl.push("chip_ohne_alkohol_contradicts_inci"); }
  recs.push({ sample_id: r.sample_id, brand: r.brand, product_name: r.product_name, format: r.format, market_tier: r.market_tier, price_eur: r.price_eur,
    inci_source_tier: r.inci_source_tier, draft_subtype: r.subtype_candidate, route, v1_subtype: route === "leave_in" ? null : sub, proposed_hold_level: hold,
    hold_basis: basis, proposed_finish: r.finish_claim || null, flags: fl, note, claim_tier: r.claim_tier, source_lane: "round2", round: 2 });
}
// Finish: normalise to the concept enum; frozen C1/C2 updates win.
const FINISH_FROZEN = { "syoss-professional-performance-max-hold-power-wax": "glänzend" };
const normFinish = v => { const t = (v || "").toString().toLowerCase();
  if (/matt/.test(t)) return "matt"; if (/glänz|glanz|gloss|shine|wet/.test(t)) return "glänzend"; if (/natürlich|natural/.test(t)) return "natürlich"; return null; };
for (const r of recs) r.proposed_finish = FINISH_FROZEN[r.sample_id] || normFinish(r.proposed_finish);
// D8: never a formula-derived level — unclaimed strength is null ("keine Herstellerangabe"); 0 only for an explicit "kein Halt" claim.
for (const r of recs) if (r.route === "styling" && r.proposed_hold_level === 0) { r.proposed_hold_level = null; r.hold_basis = (r.hold_basis ? r.hold_basis + " · " : "") + "D8: unclaimed → keine Herstellerangabe"; }
// D3 is ruled: drop the historical alternative from active notes.
for (const r of recs) if (r.flags.includes("decision_D3")) { r.flags = r.flags.filter(f => f !== "decision_D3").concat(["d3_ruled_t15"]); r.note = "T15 (2026-09-10), confirmed by D3: in-category Leave-in (incidental_film)"; }
for (const r of recs) if (r.claim_tier === "C3" && r.flags.includes("house_brand_c2")) r.claim_tier = "C2_house_brand";
// A level resolved from a frozen claim clears the old review flag.
for (const r of recs) if (r.proposed_hold_level !== null) r.flags = r.flags.filter(f => f !== "hold_needs_review" && f !== "hold_unclaimed");
const out = { version: "styling-calibration-r2", created: "2026-10-09", status: base.status.replace("DRY RUN", "ROUND 2"), normalisation_tables: TABLES, records: recs };
fs.writeFileSync("calibration-set-r2.json", JSON.stringify(out, null, 2) + "\n");
const st = recs.filter(r => r.route === "styling");
const routes = {}; recs.forEach(r => routes[r.route] = (routes[r.route] || 0) + 1);
const sub = {}; st.forEach(r => sub[r.v1_subtype] = (sub[r.v1_subtype] || 0) + 1);
const hold = {}; st.forEach(r => { const k = r.proposed_hold_level === null ? "review" : r.proposed_hold_level; hold[k] = (hold[k] || 0) + 1 });
const tiers = {}; st.forEach(r => tiers[r.claim_tier] = (tiers[r.claim_tier] || 0) + 1);
const changed = st.filter(r => r.round1_hold !== undefined && r.round1_hold !== r.proposed_hold_level).map(r => `${r.sample_id}: ${r.round1_hold}→${r.proposed_hold_level}`);
console.log(JSON.stringify({ total: recs.length, routes, styling_subtypes: sub, hold, claim_tiers: tiers }, null, 1)); console.log("changed vs round1:\n " + changed.join("\n "));
