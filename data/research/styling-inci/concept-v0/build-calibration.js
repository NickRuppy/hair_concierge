// Builds calibration-set.json: v1 subtype routing + proposed Chaarlie hold/finish per sample.
const fs = require("fs"), path = require("path");
const dir = process.argv[2], out = process.argv[3];
const seen = new Map();
for (const f of fs.readdirSync(dir).sort()) for (const r of JSON.parse(fs.readFileSync(path.join(dir, f)))) if (!seen.has(r.sample_id)) seen.set(r.sample_id, { ...r, _lane: f });
// [route, v1_subtype, hold(0-4|null), hold_basis, finish, flags[], note]
const M = {
  "schwarzkopf-taft-power-haargel-halt-5": ["styling","gel",4,"Taft Haltegrad 5","natürlich",[],""],
  "balea-locken-crunchgel": ["styling","gel",null,"no hold claim; natural-polymer film (starch/xanthan/gellan)","glänzend",["hold_unclaimed"],"crunch = cast, flexibility 'fest' candidate"],
  "bali-curls-strong-hold-flaxseed-gel": ["styling","gel",4,"word 'extra starker Halt' (no brand ladder)","glänzend",[],"carrageenan film; flaxseed trace — name ≠ mechanism"],
  "bali-curls-leave-in-spray-curl-defining": ["styling","gel",null,"'mit Halt' (unquantified)","natürlich",["boundary_leave_in","claim_formula_conflict"],"spray gel by promise; starch-only formula; heat 230°C claim without thermal active"],
  "syoss-curl-cream-gel-3in1": ["styling","gel",3,"word 'starken Halt' (dm.at, C2 DE pending)","natürlich",["renamed_subtype"],"named Creme-Gel, formula is PVP+acrylates gel"],
  "balea-styling-creme-power-flex": ["styling","gel",2,"'flexiblen Halt' → flexibility only; strength unclaimed → mid default needs review",
    "natürlich",["renamed_subtype","hold_needs_review"],"named Creme, formula is hydroalcoholic PVP/carbomer gel"],
  "bali-curls-sleek-stick-brows-and-edges": ["styling","gel",3,"word 'Stark'","natürlich",[],"target_zone hairline (edge control → zone, not subtype)"],
  "cantu-shea-butter-extra-hold-edge-stay-gel": ["styling","gel",null,"'Extra Hold' claim without any hold mechanism","glänzend",["claim_formula_conflict","non_de_inci"],"edge control; Amazon-only"],
  "schwarzkopf-taft-styling-balm-locken-halt-3": ["styling","curl_cream",2,"Taft Haltegrad 3","natürlich",[],"emulsion + PVP r4"],
  "balea-professional-styling-cream-traumlocken": ["styling","curl_cream",2,"dm chip 'mittlerer Halt' (C3)","glänzend",["retailer_chip_only"],"VP/VA r3 in emulsion"],
  "maria-nila-curlicue-cream": ["styling","curl_cream",null,"brand 'Hold 3/5' seen in leave-in research (re-capture)","natürlich",["moves_from_leave_in"],"T15 excluded_styling_first"],
  "bali-curls-hydrating-curl-cream": ["leave_in",null,null,"","",["boundary_leave_in"],"no fixative; brand says finish with gel → stays Leave-in"],
  "balea-locken-revitalizing-spray": ["styling","refresher",0,"no hold claim, no hold mechanism","natürlich",["claim_formula_conflict"],"'24 h definierte Locken' on a humectant mist"],
  "got2b-lockenspray-refresher-curlz": ["styling","refresher",0,"no hold claim; trace hairspray polymer","glänzend",[],"near-anhydrous aerosol — reads as light finish"],
  "syoss-curl-control-hydrating-spray": ["styling","refresher",0,"brand: no strong hold","natürlich",["boundary_leave_in"],"moisture-led mist; promise = curl control → refresher"],
  "alverde-locken-refresh-spray": ["styling","refresher",0,"none","natürlich",[],"aloe/humectant mist"],
  "schwarzkopf-taft-schaumfestiger-volumen-halt-4-feines-haar": ["styling","mousse",3,"Taft Haltegrad 4","natürlich",[],"starch-only film — number does not track chemistry"],
  "syoss-schaumfestiger-volume": ["styling","mousse",1,"'natürlich aussehender Halt' (dm chip 'stark' ignored, C3)","natürlich",["retailer_chip_conflict"],"starch film"],
  "wellaflex-schaumfestiger-locken-und-wellen-starker-halt": ["styling","mousse",3,"word 'Starker Halt' (dm chip 'leicht' ignored)","natürlich",["retailer_chip_conflict"],"PVP+VP/VA+PQ-16; contains dimethicone"],
  "alcina-styling-mousse-aerosol": ["styling","mousse",2,"Alcina Hold-Faktor 5/10","glänzend",[],"words say 'stark' → brand number wins"],
  "balea-ansatzvolumen-booster": ["styling","mousse",null,"volume only, no hold claim; hairspray-grade resin","natürlich",["hold_unclaimed"],"target_zone roots"],
  "alcina-foehn-lotion": ["styling","blowdry_lotion",1,"Alcina Hold-Faktor 2/10","natürlich",["moves_from_leave_in_research"],"VP/VA+PQ-11; heat claim secondary"],
  "schwarzkopf-taft-foehn-spray-volumen-halt-3": ["styling","blowdry_lotion",2,"Taft Haltegrad 3","natürlich",[],"VP/VA r3"],
  "guhl-foehn-spray-langzeit-volumen": ["styling","blowdry_lotion",null,"'48 h Halt' = duration, no strength","natürlich",["hold_unclaimed"],"heat-activated starch/gum film"],
  "balea-foehnlotion-volume-effect": ["styling","blowdry_lotion",0,"none; no fixative","natürlich",["claim_formula_conflict"],"volume + 200°C claim, no fixative/thermal active"],
  "alcina-ansatz-volumen-spray-aerosol": ["styling","blowdry_lotion",3,"Alcina Hold-Faktor 6/10, Flex 6","natürlich",[],"target_zone roots; brand publishes flex axis"],
  "john-frieda-volume-lift-ansatz-booster": ["styling","blowdry_lotion",null,"volume only, PVP+VP/VA present","natürlich",["hold_unclaimed"],"target_zone roots; sea salt grit"],
  "balea-styling-spray-ultra-volumen": ["styling","blowdry_lotion",null,"'flexiblen Halt' (flex only); dm chip 'sehr stark' (C3)","natürlich",["hold_needs_review"],"damp roots; hairspray-grade resins — boundary vs hairspray"],
  "wella-eimi-sugar-lift": ["styling","blowdry_lotion",3,"Douglas 'Haltgrad stark' + brand 'starken Halt'","glänzend",["renamed_subtype"],"marketed with sugar/texture; formula = VP/VA+PVP lotion"],
  "schwarzkopf-taft-haarspray-classic-halt-3": ["styling","hairspray",2,"Taft Haltegrad 3","natürlich",[],"INCI identical to Glanz Halt 4"],
  "schwarzkopf-taft-haarspray-glanz-halt-4": ["styling","hairspray",3,"Taft Haltegrad 4","glänzend",[],"INCI identical to Classic Halt 3"],
  "schwarzkopf-taft-haarspray-power-halt-5": ["styling","hairspray",4,"Taft Haltegrad 5","natürlich",[],"+ second film former at r11"],
  "loreal-paris-elnett-haarspray-extra-starker-halt": ["styling","hairspray",4,"Elnett ladder: Normal<Stark<Extra stark≈Sehr stark","natürlich",["ladder_mid_uncertain"],"INCI identical to Elnett Normaler Halt"],
  "gard-haarspray-extrastark-pumpspray": ["styling","hairspray",4,"Gard Haltegrad 5","natürlich",[],"pump, no propellant"],
  "syoss-haarspray-max-hold": ["styling","hairspray",4,"word 'mega starker Halt'","natürlich",[],""],
  "balea-professional-glow-und-shine-finishing-spray": ["styling","shine_finish",null,"no claim; PU-14/acrylates fixative present → unknown (never derived)","glänzend",["hold_unclaimed"],"oils follow volatiles BUT fixative present → Styling (oil test only for fixative-free)"],
  "bumble-and-bumble-brilliantine": ["oil",null,null,"","glänzend",["boundary_oil"],"oil-led emulsion, no fixative → Oil per SD3 rule"],
  "john-frieda-haarserum-frizz-ease-der-baendiger": ["styling","shine_finish",0,"none","glänzend",["moves_from_oil_candidate"],"silicone-led; rice oil r3 behind silicones"],
  "color-wow-dream-coat-supernatural-spray": ["styling","smoothing_styler",0,"Douglas chip 'mittel' (C3) ignored, no fixative","glänzend",["retailer_chip_conflict"],"heat-activated Polysilicone-29 coat, damp before blow-dry"],
  "loreal-elvital-haaroel-oel-magique-alle-haartypen": ["styling","shine_finish",0,"none","glänzend",["moves_from_oil_candidate","decision_needed"],"sold as Haaröl; silicone-led (dimethicone first non-volatile)"],
  "balea-haarserum-anti-frizz-glatt-und-glossy": ["leave_in",null,null,"","",["boundary_leave_in"],"cationic conditioner emulsion → Leave-in"],
  "balea-sea-salt-texture-spray": ["styling","salt_spray",1,"'natürlichen/flexiblen Halt'","natürlich",[],"Maris Sal r4, no fixative"],
  "balea-leave-in-spray-sea-salt-care-define": ["styling","salt_spray",0,"none","matt",["boundary_leave_in"],"beach-look promise; MgSO4 r3"],
  "bumble-and-bumble-surf-spray": ["styling","salt_spray",1,"'Haltgrad leicht' (Douglas, C3)","matt",["retailer_chip_only"],"Epsom salt only"],
  "balea-pure-styling-volumenpuder-spray": ["styling","texture_spray",1,"'leichter Halt' (dm chip)","matt",["retailer_chip_only"],"formula ≈ dry shampoo; directions = styling → Styling"],
  "schwarzkopf-taft-texturspray-aloe-boost": ["styling","texture_spray",null,"none; VP/VA present","matt",["hold_unclaimed"],""],
  "living-proof-full-dry-volume-texture-spray": ["styling","texture_spray",1,"'weichen/aufbaubaren Halt'","matt",[],"VP/VA + crotonates + particles"],
  "got2b-trockenshampoo-extra-volumen": ["dry_shampoo",null,null,"","",["boundary_dry_shampoo"],"refresh positioning → stays Dry Shampoo"],
  "schwarzkopf-taft-haarpuder-volumen": ["styling","hair_powder",null,"'24 h Halt' = duration only","matt",["hold_unclaimed"],"silica silylate"],
  "got2b-styling-puder-volumen-powderfull": ["styling","hair_powder",1,"'leichter Halt'","matt",[],"silica silylate, 4 ingredients"],
  "balea-haarpuder-volumen-pomegranate": ["styling","hair_powder",1,"dm chip 'starker Halt' (C3) contradicts identical-base got2b 'leicht'","matt",["retailer_chip_conflict","hold_needs_review"],""],
  "kevin-murphy-powder-puff-volume": ["styling","hair_powder",null,"none (snippet 'medium' unverified)","matt",["hold_unclaimed"],"+ VP/VA"],
  "schwarzkopf-taft-gel-wax-glanz-halt-2": ["styling","molding",1,"Taft Haltegrad 2 / Glanzstufe 5","glänzend",[],"form wax; no wax, no polymer — mineral-oil emulsion"],
  "schwarzkopf-taft-matt-wax-halt-5": ["styling","molding",4,"Taft Haltegrad 5","matt",[],"form wax; wax/fatty-acid chassis"],
  "syoss-professional-performance-max-hold-power-wax": ["styling","molding",4,"word 'megastarke Kontrolle'","natürlich",[],"form wax; beeswax/petrolatum + PVP"],
  "got2b-styling-mattpaste-strand-matte": ["styling","molding",1,"'leichten Halt'","matt",[],"form paste"],
  "got2b-styling-paste-istyler-texture-clay": ["styling","molding",3,"'starken & flexiblen Halt'","matt",[],"form clay — contains no clay"],
  "bali-gents-matt-paste": ["styling","molding",3,"'Starker Halt'","matt",[],"form paste; kaolin below parfum"],
  "american-crew-fiber": ["styling","molding",4,"brand words 'Sehr starker Halt' (Haltfaktor 9)","matt",[],"form fiber"],
  "balea-men-pomade-haar-bart-2in1": ["styling","molding",2,"dm chip 'mittlerer Halt' (C3)","glänzend",["retailer_chip_only"],"form pomade; anhydrous petrolatum/wax → hard_to_wash"],
  "loreal-men-expert-barber-club-styling-pomade": ["styling","molding",3,"'starken Halt'","glänzend",[],"form pomade; mineral-oil emulsion"],
  "american-crew-pomade": ["styling","molding",2,"brand words 'Mittlerer Halt' (Haltfaktor 7)","glänzend",[],"form pomade; water-based"],
  "nivea-men-styling-cream-active-craft-stylers": ["styling","molding",3,"'Starker Halt'","natürlich",[],"form cream"],
  "wella-professionals-eimi-flowing-form": ["styling","smoothing_styler",1,"Wella 'Hold level 2' (scale ?)","natürlich",["non_de_inci"],"Glättungscreme, PVP r2, before heat"],
  "garnier-fructis-leave-in-spray-diamond-sleek-glaettungsspray": ["styling","smoothing_styler",0,"none","glänzend",[],"sleek via brush/iron"],
  "loreal-paris-elnett-stylingspray-hitzeschutz-3-tage-glatt": ["styling","smoothing_styler",null,"'Perfekter Halt' without fixative","natürlich",["claim_formula_conflict"],""],
  "neqi-diamond-glass-ultimate-styling-spray": ["styling","smoothing_styler",0,"none","glänzend",["moves_from_leave_in","decision_needed"],"T15 ruled it Leave-in (incidental_film)"],
  "evo-head-mistress-cuticle-sealer": ["leave_in",null,null,"","",["boundary_leave_in"],"care-led silicone cream; DE availability doubtful"],
  "redken-one-united-all-in-one-multi-benefit-treatment": ["leave_in",null,null,"","",["boundary_leave_in"],"conditioning leave-in"],
  "garnier-fructis-sleek-and-stay-heat-activated-serum": ["styling","smoothing_styler",0,"none","glänzend",["moves_from_oil"],"oil-free silane silicone, heat-activated"],
  "got2b-hitzeschutzspray-schutzengel": ["heat_protectant",null,null,"","",["boundary_heat"],"VP/VA r2 but promise = protection"],
  "taft-x-gliss-hitzeschutzspray-lovely-long": ["heat_protectant",null,null,"","",["boundary_heat"],""],
};

// --- Codex review fixes (2026-10-09): T7 claim authority, house-brand C2, no borrowed/guessed strength,
// hold_route vs result mechanism, full G0 baseline (NEQI stays Leave-in), g0_pending where Leave-in G0 must run.
const O = {
  "balea-styling-creme-power-flex": {hold:null, basis:"'flexiblen Halt' = flexibility word only → review", flags:["renamed_subtype","hold_needs_review","house_brand_c2"]},
  "balea-haarpuder-volumen-pomegranate": {hold:3, basis:"own house-brand claim 'starker Halt' (dm owns Balea → C2); identical base to got2b 'leicht' — claims diverge, never borrowed", flags:["house_brand_c2"]},
  "balea-men-pomade-haar-bart-2in1": {hold:2, basis:"house-brand C2 'mittlerer Halt'", flags:["house_brand_c2"]},
  "balea-professional-styling-cream-traumlocken": {hold:2, basis:"house-brand C2 'mittlerer Halt'", flags:["house_brand_c2","g0_pending"]},
  "balea-pure-styling-volumenpuder-spray": {hold:1, basis:"house-brand C2 'leichter Halt'", flags:["house_brand_c2"]},
  "bumble-and-bumble-surf-spray": {hold:null, basis:"only a Douglas chip 'Haltgrad leicht' (C3) → cannot populate (T7) → review", flags:["retailer_chip_only"]},
  "syoss-schaumfestiger-volume": {hold:null, basis:"'natürlich aussehender Halt' describes the look, not strength → review (dm chip 'stark' C3 ignored)", flags:["retailer_chip_conflict"]},
  "balea-sea-salt-texture-spray": {hold:null, basis:"'natürlichen / flexiblen Halt' = look + flexibility words, no strength → review", flags:["house_brand_c2"]},
  "balea-leave-in-spray-sea-salt-care-define": {hold:null, basis:"no claim but salt hold_route (MgSO4 r3) → review, not 0", flags:["boundary_leave_in","g0_pending","house_brand_c2"]},
  "got2b-lockenspray-refresher-curlz": {hold:null, basis:"no claim but fixative present (trace) → review, not 0", flags:[]},
  "syoss-curl-control-hydrating-spray": {hold:null, basis:"no claim; unmodified corn starch r2 is ambiguous (rheology exclusion) → review", flags:["boundary_leave_in","g0_pending"]},
  "alverde-locken-refresh-spray": {flags:["g0_pending","house_brand_c2"]},
  "balea-locken-revitalizing-spray": {flags:["claim_formula_conflict","g0_pending","house_brand_c2"]},
  "bali-curls-leave-in-spray-curl-defining": {flags:["boundary_leave_in","claim_formula_conflict","g0_pending"]},
  "schwarzkopf-taft-styling-balm-locken-halt-3": {flags:["g0_pending"]},
  "balea-locken-crunchgel": {flags:["hold_unclaimed","house_brand_c2"]},
  "balea-ansatzvolumen-booster": {flags:["hold_unclaimed","house_brand_c2"]},
  "balea-styling-spray-ultra-volumen": {flags:["hold_needs_review","house_brand_c2"]},
  "balea-foehnlotion-volume-effect": {flags:["claim_formula_conflict","house_brand_c2"]},
  "neqi-diamond-glass-ultimate-styling-spray": {route:"leave_in", subtype:null, hold:null, basis:"", flags:["t15_baseline","decision_D3"], note:"T15 (2026-09-10) ruled in-category Leave-in (incidental_film). Only if Nick picks D3(b) → smoothing_styler"},
  "loreal-paris-elnett-stylingspray-hitzeschutz-3-tage-glatt": {note:"routed by promise (3 Tage glatt); application_moment UNRESOLVED — captured directions look copied from a hairspray"},
  "wella-professionals-eimi-flowing-form": {note:"Glättungscreme, PVP r2, no silicone — in smoothing_styler by job (sleek result with heat), not by mechanism"},
};
for (const [id,o] of Object.entries(O)) { const m=M[id]; if(!m) throw new Error("override for unknown "+id);
  if("route" in o) m[0]=o.route; if("subtype" in o) m[1]=o.subtype; if("hold" in o) m[2]=o.hold; if("basis" in o) m[3]=o.basis;
  if("flags" in o) m[5]=o.flags; if("note" in o) m[6]=o.note; }

// --- Rev. 2 owner rulings (Nick 2026-10-09, plans/styling-concept/02-rulings.md) ---
// D2: Oil<->Styling by product NAME (retailer way): sold as "Öl"/"Serum" stays Oil; other shine/finish names -> Styling.
const R2 = {
  "john-frieda-haarserum-frizz-ease-der-baendiger": {route:"oil", subtype:null, hold:null, basis:"", flags:["d2_name_rule"], note:"named 'Haarserum' → Oil (D2), although silicone-led"},
  "loreal-elvital-haaroel-oel-magique-alle-haartypen": {route:"oil", subtype:null, hold:null, basis:"", flags:["d2_name_rule"], note:"named 'Haaröl' → Oil (D2), although silicone-led"},
  "garnier-fructis-sleek-and-stay-heat-activated-serum": {route:"oil", subtype:null, hold:null, basis:"", flags:["d2_name_rule"], note:"named 'Haarserum' → stays Oil (D2), although oil-free silane silicone"},
  "bumble-and-bumble-brilliantine": {route:"styling", subtype:"shine_finish", hold:null, basis:"no brand hold claim; Douglas chip 'leicht' (C3) cannot assign; lipid/polybutene base → review", flags:["d2_name_rule","retailer_chip_only"], note:"named 'Brilliantine' (not Öl/Serum) → Styling (D2)"},
};
for (const [id,o] of Object.entries(R2)) { const m=M[id]; if(!m) throw new Error("R2 unknown "+id);
  m[0]=o.route; m[1]=o.subtype; m[2]=o.hold; m[3]=o.basis; m[5]=o.flags; m[6]=o.note; }
// D6 (refresh/beach sprays without care and hold -> Styling) is applied per product by the round-2 G0 lane; g0_pending flags stay until then.

const recs = [];
for (const [id, r] of seen) {
  const m = M[id]; if (!m) throw new Error("unmapped " + id);
  recs.push({ sample_id: id, brand: r.brand, product_name: r.product_name, format: r.format, market_tier: r.market_tier, price_eur: r.price_eur, inci_source_tier: r.inci_source_tier,
    draft_subtype: r.subtype_candidate, route: m[0], v1_subtype: m[1], proposed_hold_level: m[2], hold_basis: m[3], proposed_finish: m[4] || null, flags: m[5], note: m[6], source_lane: r._lane });
}
const missing = Object.keys(M).filter(k => !seen.has(k)); if (missing.length) throw new Error("mapped but absent: " + missing);
fs.writeFileSync(out, JSON.stringify({ version: "styling-concept-v0-rev2", created: "2026-10-09", hold_scale: "Chaarlie 0-4 (0 kein Halt, 1 leicht, 2 mittel, 3 stark, 4 sehr stark); null = needs review", status: "DRY RUN of the normalisation rules on captured text. Most hold claims were captured from third-party retailer pages (C3); every level stays provisional until round 2 freezes C1/C2 claims (pack or manufacturer DE page; house brands Balea/alverde/Isana on their own retailer = C2).", records: recs }, null, 2) + "\n");
const c = {}; recs.forEach(x => { const k = x.route === "styling" ? x.v1_subtype : "→ " + x.route; c[k] = (c[k] || 0) + 1 });
console.log(recs.length, c);
