#!/usr/bin/env node
// Calibration round 1 — deterministic diff of blind lane A (Claude Opus) vs blind lane B (Codex)
// plus unseen scoring against the sealed pre-registered expectations.
//
// Usage: node data/research/styling-inci/v1.0/round-1/diff.js
// Writes round-1/diff.json. Reads only frozen inputs; never edits them.
// Deterministic: no clock, no randomness; key order is fixed; two runs give byte-identical output.

'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const A = read('blind-lane-A/results.json');
const B = read('blind-lane-B/results.json');
const S = read('sealed/unseen-expectations.json');
const C = read('cohort.json');
// Analyst classifications (judgment, recorded in-script so the output is reproducible). Filled below.
// CLASSIFY_BEGIN
const CLASSIFY = (() => {
  // class: a = lane error (one lane misapplied a clear rule), b = rule gap/ambiguity, c = data/packet issue, d = needs an owner ruling
  const D = {};
  const set = (keys, v) => { for (const k of keys) D[k] = v; };

  // ---- RG-1  T_LI vacuity: essential oils in the fragrance block (b)
  set([
    'alcina-styling-mousse-aerosol::tail_markers', 'balea-styling-creme-power-flex::tail_markers',
    'john-frieda-frizz-ease-traumlocken-lockencreme::tail_markers', 'john-frieda-volume-lift-pushed-up-dry-texture-spray::tail_markers',
    'schwarzkopf-taft-haarspray-classic-halt-3::tail_markers', 'schwarzkopf-taft-haarspray-glanz-halt-4::tail_markers',
    'taft-x-gliss-hitzeschutzspray-lovely-long::tail_markers',
  ], { class: 'b', root_cause: 'RG-1', comment: 'T_LI status only (vacuous vs plausible). Every species at/below T_LI is in the LI §3.1.1 cl. 6 closed set except a named essential oil (Citrus Aurantium/Limon Peel Oil, Pogostemon Cablin Oil, Juniperus Virginiana Oil) inside the fragrance block. A reads it as fragrance (b) => vacuous; B reads it as "job not settled by INCI name" => outside the set => plausible. No route or Styling value moves (T_LI is unused on 3.4(ii) paths; JF Traumlocken is route-named); only the tail_marker_vacuous trigger differs.' });

  // ---- lane errors on T_LI
  D['neqi-diamond-glass-ultimate-styling-spray::tail_markers'] = { class: 'a', root_cause: 'E-1', right: 'B', comment: 'LI §3.1.1 cl. 5: T_LI Ethylhexylglycerin r9 sits above Silicone Quaternium-18 r11, which both lanes (and standard §11.4) read as part of the conditioning film => marker implausible. A kept plausible. No value moves (route leave_in is owner-named).' };
  D['langhaarmaedchen-lockenspray-natur-lockenwunder::tail_markers'] = { class: 'a', root_cause: 'E-2', right: 'B', comment: 'LI §3.1.1 cl. 6: tail r23-r30 = Sodium Benzoate, Potassium Sorbate (a), Linalyl Acetate, Terpineol, TAHN, Geranyl Acetate (b), Lactic Acid + Sodium Lactate (d, buffer pair) => vacuous. A said plausible. No value moves (route leave_in by PH2-11).' };

  // ---- RG-2  spray-distance-only directions (b)
  set([
    'schwarzkopf-taft-haarspray-classic-halt-3::application_moment', 'schwarzkopf-taft-haarspray-glanz-halt-4::application_moment',
    'schwarzkopf-taft-haarspray-power-halt-5::application_moment', 'loreal-paris-elnett-haarspray-extra-starker-halt::application_moment',
    'got2b-spruehkleber-freeze-haarlack::application_moment',
  ], { class: 'b', root_cause: 'RG-2', comment: 'Directions name only spraying (e.g. "Aus 30 cm Abstand sprühen"): no moisture state, no drying, heat or shaping step. A reads dry_finish; B reads unresolved (§6.11 gives no anchor for this text, §1.1 conservative). Sealed slot 3 expects dry_finish (firm).' });

  // ---- RG-3  heat_activated vs optional blow-drying for volume (b; owner question Q4)
  set([
    'balea-sea-salt-texture-spray::heat_activated', 'balea-styling-spray-ultra-volumen::heat_activated', 'jean-und-len-sea-salt-spray::heat_activated',
  ], { class: 'b', root_cause: 'RG-3', comment: 'Directions offer blow-drying "für mehr Volumen". B reads that as heat strengthening the effect (§6.13 "strengthens") => yes; A reads it as an optional drying step that gives heat no activating role => no. Lean A (owner question Q4).' });
  D['guhl-foehn-spray-langzeit-volumen::heat_activated'] = { class: 'a', root_cause: 'E-5', right: 'B', comment: 'Directions ("Vor dem Föhnen aufsprühen") give heat no activating role => no. A raised to yes from the confirmed-name variant "Föhn-Aktiv Styling Spray"; the C1/C2 activation raise is a post-unblinding crossing (property set §7 crossing 1; FREEZE-NOTES 5.1: heat-activation statements are not in the blind packets). B right for the blind round; the final record may still be raised to yes after unblinding.' };

  // ---- RG-4  Henkel x/5 scale format scope (d -> Q1)
  D['schwarzkopf-taft-styling-balm-locken-halt-3::hold_level'] = { class: 'd', root_cause: 'RG-4', comment: 'C2 "Halt 3" (no stated maximum) + C2 "Starker ... Halt" on a balm. A: §7.3 Henkel row lists sprays/mousses/Föhnspray only => words => stark => 3. B: 2 (Henkel x/5 applied; B cites a property-set §5.6 row that does not exist for this product). Owner question Q1.' };

  // ---- packet issues
  D['balea-styling-spray-ultra-volumen::hold_level'] = { class: 'c', root_cause: 'P-1', right: 'A', comment: 'PH2-7 keeps level 4 from the dm house-brand attribute „sehr starker Halt" (property set §5.6), but the frozen claims packet does not carry that attribute; instead the freeze script added "Ultra" from the name "Ultra Volumen" as a hold claim (Ultra qualifies Volumen, not hold). A took 4 from the PH2-7 ruling text; B emitted "review" (standalone Ultra unranked). Value per ruling = 4.' };
  D['got2b-spruehkleber-freeze-haarlack::flexibility'] = { class: 'c', root_cause: 'P-2', right: 'A', comment: 'Rigidity words "Kleber"/"Freeze" live only in the confirmed name; the claims packet carries no name-derived flexibility claim (the script adds name words only as hold claims) and the S0 name drops "Freeze". A read "Kleber" from the S0 name => fest (sealed: fest, firm); B normalised from the claims packet => unbekannt.' };
  D['loreal-paris-elnett-stylingspray-hitzeschutz-3-tage-glatt::promise_class'] = { class: 'c', root_cause: 'P-3', comment: 'The S0 packet\'s only C1/C2 promise line is the heat line; the C1 pack-front result line PH1-14 rests on („glatt 3 Tage, starker Halt") is not in the packet. A reported the letter (heat_protection) and overrode it with PH1-14; B wrote the ruling\'s class (styling_result). Route identical (held smoothing_styler).' };
  D['loreal-paris-elnett-stylingspray-hitzeschutz-3-tage-glatt::target_zone'] = { class: 'a', root_cause: 'E-7', right: 'A', comment: 'Both lanes found the directions copied from an Elnett hairspray (P-3) and set application_moment unresolved; §6.11/§6.12 then leave target_zone empty + review. B still emitted "all".' };

  // ---- RG-5 lead-promise identification / co-equal (b; Q3 for the route case)
  set([
    'bali-curls-hydrating-curl-cream::promise_class', 'cantu-lockencreme-kokos::promise_class',
    'wella-eimi-smooth-perfect-me::promise_class', 'balea-professional-haarserum-glow-und-shine::promise_class',
  ], { class: 'b', root_cause: 'RG-5', comment: 'Lead promise mixes a curl/shine/styling result with care words ("defines, softens & moisturises", "spendet Feuchtigkeit, definiert", "Balsam-Lotion für Haarstyling ... verleiht Geschmeidigkeit", Haarserum with "Anti-Frizz" + "Spitzenpflege"). A: styling_result; B: care. Route identical (leave_in) on all four; no Styling value moves.' });
  set([
    'garnier-fructis-locken-methode-feuchtigkeitsboost-pflege-spray::promise_class', 'garnier-fructis-locken-methode-feuchtigkeitsboost-pflege-spray::route',
    'garnier-fructis-locken-methode-feuchtigkeitsboost-pflege-spray::reason_code',
  ], { class: 'd', root_cause: 'RG-5', comment: 'C2 „spenden den Locken ... Feuchtigkeit und definierte Locken" in a product named „Pflege-Spray". A: moisture + definition co-equal => mixed => D7 fails => provisional_boundary (mixed_promise). B: care-led => LI G0 in_category, real care (Shea r7) => leave_in. Neither reaches Styling. Owner question Q3.' });

  // ---- RG-6 li_function scope / registry vs PH2-2 (d -> Q2)
  set([
    'balea-professional-glow-und-shine-finishing-spray::route', 'balea-professional-glow-und-shine-finishing-spray::reason_code',
  ], { class: 'd', root_cause: 'RG-6', comment: 'D2-named Styling shine_finish; registry §4.6 says "Held? no". A: first C2 line is anti-frizz => li_function yes => the unchanged LI letter claims it => PH2-2 (ledger, governs) => held. B: shine/finish lead => 3.4(ii) committed, not held. Committed vs held (not matchable) is a product decision. Owner question Q2.' });
  D['balea-haargel-hair-jelly::reason_code'] = { class: 'b', root_cause: 'RG-6', comment: '„Ideal für Sleek-Looks & Locken": A li_function no => 3.4(ii); B li_function yes (sleek/curls) => 3.4(iii) LI G0 excluded_styling_first. Same route, not held either way.' };

  // ---- RG-7 identity_status vs evidence gate (b)
  set([
    'balea-styling-finishing-stick::identity_status', 'evo-head-mistress-cuticle-sealer::identity_status',
    'isana-professional-styling-creme-locken-traum::identity_status', 'redken-styling-beach-spray::identity_status',
  ], { class: 'b', root_cause: 'RG-7', comment: 'Directions missing or paraphrased (and/or no C1/C2 promise). B moves identity_status to insufficient_information (LI §2.4 G1 checklist includes directions); A keeps verified and lets S0 stop at evidence_gate. Same route. Sealed: verified (slot 2 firm, slot 1 soft).' });

  // ---- lane errors, U
  D['balea-ansatzvolumen-booster::application_moment'] = { class: 'a', root_cause: 'E-3', right: 'A', comment: '§6.11: damp_before_drying "when air-drying is allowed, drying is unspecified, or blow-drying is offered as optional". Directions: foam into roots, then „Trocken föhnen, über Nacht einwirken lassen oder lufttrocknen lassen" => damp_before_drying. B emitted unresolved because wet/dry hair is not stated; the anchor does not require it.' };
  D['bumble-and-bumble-brilliantine::application_moment'] = { class: 'b', root_cause: 'RG-8', comment: '„im feuchten oder trockenen Haar verwenden": no rule for which equal option is primary. A followed worked example §11.8 (dry_restyle, also damp); B took the first-named (damp, also dry). §11.2 (Traumlocken, „handtuchtrockenes oder trockenes Haar" => damp primary) uses first-named, so the two worked examples conflict.' };
  D['bali-gents-haarpuder-volumizing-styling-powder::target_zone'] = { class: 'b', root_cause: 'RG-9', comment: '„in den Handflächen verreiben oder direkt auf den Haaransatz streuen. In das trockene Haar einmassieren": A all; B roots. §6.12 "directions lead with Ansatz" does not say whether an either/or naming of the Ansatz counts as leading.' };

  // ---- subtype
  D['balea-pure-styling-volumenpuder-spray::subtype'] = { class: 'a', root_cause: 'E-4', right: 'A', comment: '§5 anchor table: texture_spray vs hair_powder — "spray form ⇒ texture_spray". The product is an aerosol (format aerosol). B chose hair_powder (name „Volumenpuder" + root job); a name never decides (§4.4, SFS-1).' };

  // ---- C fields
  D['bali-gents-matt-paste::finish'] = { class: 'b', root_cause: 'RG-10', comment: 'C2 „natürlichem Finish" and C2 „mattem Finish"/„mattierende Wirkung". §6.8 only says matt + shine ⇒ unbekannt; natürlich + matt is not covered. A unbekannt (+ review, conservative); B matt.' };
  D['wellaflex-schaumfestiger-locken-und-wellen-starker-halt::finish'] = { class: 'b', root_cause: 'RG-10', comment: 'C2 „lockiges Haar natürlich gestylt aussehen lässt": A not a lexicon phrase => unbekannt; B = "Natural Look" => natürlich. §6.8 lists „natürliches Finish", „Natural Look", „natürlicher Glanz" only; §7.4 calls „natürlich aussehend" a look word.' };
  set(['balea-haargel-hair-jelly::primary_job', 'got2b-styling-mattpaste-strand-matte::primary_job'], { class: 'b', root_cause: 'RG-11', comment: 'Lead promise is a product noun plus a look/hold phrase („Styling-Gelee ... Ideal für Sleek-Looks & Locken"; „kreiert matte Surfer-Styles mit mittlerem Halt"). §6.10 says only "the job the lead promise states". Jelly: A hold_fix, B sleek. Mattpaste: A texture, B hold_fix. Primary and secondary swap; no hold level or route moves.' });
  // secondary jobs (supplementary)
  set([
    'balea-haargel-hair-jelly::secondary_jobs', 'balea-professional-glow-und-shine-finishing-spray::secondary_jobs',
    'balea-professional-styling-cream-traumlocken::secondary_jobs', 'balea-sea-salt-texture-spray::secondary_jobs',
    'balea-styling-creme-power-flex::secondary_jobs', 'bali-curls-sleek-stick-brows-and-edges::secondary_jobs',
    'got2b-styling-mattpaste-strand-matte::secondary_jobs', 'got2b-styling-puder-volumen-powderfull::secondary_jobs',
    'kevin-murphy-killer-curls::secondary_jobs', 'loreal-men-expert-barber-club-styling-pomade::secondary_jobs',
    'maria-nila-curlicue-cream::secondary_jobs', 'schwarzkopf-taft-styling-balm-locken-halt-3::secondary_jobs',
    'syoss-curl-cream-gel-3in1::secondary_jobs', 'wella-eimi-nutricurls-curl-shaper::secondary_jobs',
  ], { class: 'b', root_cause: 'RG-12', comment: 'Secondary-job evidence threshold. B adds hold_fix whenever a hold claim exists (Traumlocken, sea salt, Powderfull, Maria Nila, Nutricurls) and definition/shine/frizz from attribute lines; A adds frizz_control from anti-frizz bullets B skipped (Glow&Shine, Killer.Curls, Taft Balm). §6.10 "jobs the C1/C2 claims state explicitly" does not say whether a hold-strength claim or an attribute line states a job. Supplementary field, not in the overall %.' });
  D['color-wow-dream-coat-supernatural-spray::promise_class'] = { class: 'a', root_cause: 'E-6', right: 'A', comment: '§4.2 assigns a class from C1/C2 claims only; Color Wow has none (C3 only; D2 names the route via §4.1 override (a)). A: not assigned. B: styling_result — inconsistent with B\'s own Brilliantine (same situation, "unknown"). No value moves.' };

  const U = {};
  U['redken-styling-beach-spray::identity_status::B'] = { class: 'b', root_cause: 'RG-7', comment: 'sealed soft (alternative insufficient_information named in the sealed file)' };
  U['balea-styling-finishing-stick::identity_status::B'] = { class: 'b', root_cause: 'RG-7', comment: 'sealed firm verified; B moved identity for missing directions' };
  U['got2b-spruehkleber-freeze-haarlack::application_moment::B'] = { class: 'b', root_cause: 'RG-2', comment: 'spray-only directions; sealed dry_finish (firm)' };
  U['got2b-spruehkleber-freeze-haarlack::flexibility::B'] = { class: 'c', root_cause: 'P-2', comment: 'claims packet lacks the name rigidity words; sealed fest (firm)' };
  U['balea-professional-haarserum-glow-und-shine::promise_class::B'] = { class: 'b', root_cause: 'RG-5', comment: 'sealed soft styling_result; B care; route leave_in matches' };
  for (const l of ['A', 'B']) {
    U[`taft-styling-paste-forming-halt-5plus::hold_level::${l}`] = { class: 'd', root_cause: 'RG-4', comment: 'both lanes: C1 "5+" on a paste, Henkel row does not list molding => words only, none => null. Sealed soft 4 (Henkel x/5 extended by calibration precedent). Owner question Q1.' };
    U[`taft-styling-paste-forming-halt-5plus::neutral_fact_shown::${l}`] = { class: 'd', root_cause: 'RG-4', comment: 'consequence of the null level (§7.6): „Enthält Stylingpolymere (z. B. VP/VA Copolymer)" shown. Sealed soft false (flips to true under the null alternative, which the sealed file names).' };
  }

  const register = [
    { id: 'RG-1', class: 'b', section: 'LI §3.1.1 cl. 6 (closed set (b)), reused by standard §3.2', source: ['round-1 diff (7 records)'], issue: 'Is a named essential oil in the fragrance block (Citrus Aurantium/Limon Peel Oil, Pogostemon Cablin Oil, Juniperus Virginiana Oil) a fragrance declaration (closed set (b)) or a species whose job is "not settled by its INCI name" (outside the set)? Decides vacuous vs plausible T_LI.', records: ['alcina-styling-mousse-aerosol', 'balea-styling-creme-power-flex', 'john-frieda-frizz-ease-traumlocken-lockencreme', 'john-frieda-volume-lift-pushed-up-dry-texture-spray', 'schwarzkopf-taft-haarspray-classic-halt-3', 'schwarzkopf-taft-haarspray-glanz-halt-4', 'taft-x-gliss-hitzeschutzspray-lovely-long'], impact: 'review trigger only; no route or Styling value moves in this cohort', proposed_fix: 'Add to lexicon §0.2 / closed set (b): "an essential oil or other botanical fragrance oil declared at or after the Parfum/Fragrance entry, or among the declared allergens, counts as a fragrance declaration (b). The same oil ranked above Parfum is outside the set." (Lean: A\'s reading; the oil sits inside the allergen block on all seven records.)' },
    { id: 'RG-2', class: 'b', section: 'standard §6.11; property set §2.13', source: ['round-1 diff (5 records)', 'lane B ambiguous_rules §6.11/§5'], issue: 'Directions that only say how to spray („Aus 30 cm Abstand sprühen") name no moisture state, drying, heat or shaping step. No anchor says whether that is dry_finish or unresolved.', records: ['schwarzkopf-taft-haarspray-classic-halt-3', 'schwarzkopf-taft-haarspray-glanz-halt-4', 'schwarzkopf-taft-haarspray-power-halt-5', 'loreal-paris-elnett-haarspray-extra-starker-halt', 'got2b-spruehkleber-freeze-haarlack'], impact: 'application_moment of 5 hairsprays (unresolved = review on every mainstream hairspray)', proposed_fix: 'Add to §6.11: "Directions that consist only of spraying the product onto the hair (distance, evenness, optional targeting of strands) with no moisture state, no drying or heat step and no shaping step read dry_finish (the product is applied last, onto the finished style); confidence moderate. Directions that are missing or copied stay unresolved."' },
    { id: 'RG-3', class: 'b', section: 'standard §6.13; property set §2.15', source: ['round-1 diff (3 records)'], issue: '„Für mehr Volumen trocken föhnen" — is an optional blow-dry for more volume "heat strengthening the effect" (heat_activated yes) or just a drying option (no)?', records: ['balea-sea-salt-texture-spray', 'balea-styling-spray-ultra-volumen', 'jean-und-len-sea-salt-spray'], impact: 'heat_activated on 3 products; at scale it decides whether nearly every volume product reads heat-activated', proposed_fix: 'Add to §6.13: "yes only when the text attributes the effect to heat acting on the product (Föhnhitze verstärkt, wärmeaktiviert, hitzeaktiviert, durch Wärme fixiert). An instruction to blow-dry — required, optional or offered for more volume — is an application_moment fact, not activation." (owner question Q4)' , owner_question: 'Q4' },
    { id: 'RG-4', class: 'd', section: 'standard §7.3 (Henkel row "sprays, mousses, Föhnspray"), §7.6', source: ['round-1 diff', 'sealed slot 8', 'lane B ambiguous_rules §7.3', 'lane A notes (Taft Balm, Taft Gel Wax, Syoss Max Hold Wax, Taft Paste)'], issue: 'Does the Henkel Haltegrad x/5 table apply to Henkel pastes, waxes and balms, or are those words-only?', records: ['schwarzkopf-taft-styling-balm-locken-halt-3', 'taft-styling-paste-forming-halt-5plus', 'schwarzkopf-taft-gel-wax-glanz-halt-2', 'syoss-professional-performance-max-hold-power-wax', 'schwarzkopf-taft-matt-wax-halt-5'], impact: 'hold level in two ranking-relevant subtypes (molding, curl_cream): Taft Balm 3 vs 2, Taft Paste null vs 4, Taft Gel Wax null vs 1', proposed_fix: 'Owner question Q1. If extended: change the §7.3 Henkel row to "Taft, Syoss, got2b — every leave-on format except Taft gels (4–14 scale)"; a "5+" maps like 5.', owner_question: 'Q1' },
    { id: 'RG-5', class: 'b', section: 'standard §4.2 (promise class, co-equal lead)', source: ['round-1 diff (5 records)', 'lane B ambiguous_rules §4.2/§4.4', 'lane A notes (Taft x Gliss Shine Coat, Taft Texturspray Aloe Boost)', 'sealed slot 4/5'], issue: 'Packets list several C1/C2 promise lines without marking the headline, and §4.2 has no rule for which line is the lead or when two jobs in one sentence are "co-equal". Lanes split care vs styling_result on curl creams/serums and mixed vs care on one curl spray.', records: ['garnier-fructis-locken-methode-feuchtigkeitsboost-pflege-spray', 'bali-curls-hydrating-curl-cream', 'cantu-lockencreme-kokos', 'wella-eimi-smooth-perfect-me', 'balea-professional-haarserum-glow-und-shine'], impact: 'one route (Garnier: mixed_promise vs leave_in); promise_class on four leave_in records', proposed_fix: 'Add to §4.2: "Lead promise = (1) the job word of the confirmed product name when it names one (Lockencreme ⇒ definition, Hitzeschutzspray ⇒ heat protection, Pflege-Spray/Kur/Balsam ⇒ care, Finishing/Glanz-Spray ⇒ finish); else (2) the first C1 pack-front line; else (3) the first C2 line. Co-equal (mixed) only when the lead itself joins two classes with und/&/+/„2in1/3in1" naming both (GUHL „Pflege & Styling", Taft „Textur und Pflege"). A result named as the effect of a care action („spendet Feuchtigkeit ... und definierte Locken") stays with the class of the name." Packet side: mark each promise line with its position (pack front, headline, bullet).', owner_question: 'Q3' },
    { id: 'RG-6', class: 'd', section: 'standard §4.2 li_function tag; §4.5 / PH2-2; §4.6 registry "Held?" column', source: ['round-1 diff (Glow&Shine route; Hair Jelly reason code)', 'lane A note (registry vs PH2-2)', 'sealed slot 2 and 5 rule gaps'], issue: 'li_function = yes for any anti-frizz/smoothing or curl word. On dry-hair finishing products (a finishing spray, a finishing stick, a shine serum) this makes the unchanged Leave-in letter claim them, so PH2-2 holds them — while the §4.6 registry says "Held? no" for Balea Glow & Shine Finishing Spray.', records: ['balea-professional-glow-und-shine-finishing-spray', 'balea-haargel-hair-jelly', 'balea-styling-finishing-stick', 'balea-professional-haarserum-glow-und-shine'], impact: 'one product committed vs held (not matchable until the Leave-in addendum); shine_finish coverage', proposed_fix: 'Owner question Q2. If "finish job": add to §4.2 "Flyaway or frizz control promised for dry, styled hair — directions apply the product after styling or on dry hair — is the shine_finish job (§5 anchor „flyaway control on dry hair"), li_function no; anti-frizz promised for damp hair or as care stays li_function yes." and keep the registry row "Held? no".', owner_question: 'Q2' },
    { id: 'RG-7', class: 'b', section: 'standard §2.3 identity states vs §4.1 evidence gate', source: ['round-1 diff (4 records)', 'sealed slots 1/2'], issue: 'Does a missing or paraphrased directions capture (or a missing C1/C2 promise) change identity_status to insufficient_information, or does it only stop S0 at evidence_gate?', records: ['balea-styling-finishing-stick', 'evo-head-mistress-cuticle-sealer', 'isana-professional-styling-creme-locken-traum', 'redken-styling-beach-spray'], impact: 'none on routes or values; identity field and review queue only', proposed_fix: 'Add to §2.3: "identity_status describes the product and formula identity only (exact product, GTIN or documented gap, INCI set). A directions or claim gap never changes it; it is carried by S0 evidence_gate with the missing input named." (Lean: A; matches the sealed file.)' },
    { id: 'RG-8', class: 'b', section: 'standard §6.11 (primary vs also); worked examples §11.2 vs §11.8', source: ['round-1 diff (Brilliantine)'], issue: 'When directions offer damp or dry hair as equal options, which is primary? §11.2 takes the first-named (handtuchtrocken ⇒ damp), §11.8 does not („feucht oder trocken" ⇒ dry_restyle primary).', records: ['bumble-and-bumble-brilliantine'], impact: 'primary application_moment; feeds subtype tie-breaks', proposed_fix: 'Add to §6.11: "Equal alternatives: primary = the first-named moment, the others go to also[]." and correct §11.8 to damp_before_drying, also dry_restyle.' },
    { id: 'RG-9', class: 'b', section: 'standard §6.12 target_zone', source: ['round-1 diff (Bali Gents Haarpuder)'], issue: '"Directions lead with Ansatz" — does an either/or instruction („in den Handflächen verreiben oder direkt auf den Haaransatz streuen") lead with the Ansatz?', records: ['bali-gents-haarpuder-volumizing-styling-powder'], impact: 'target_zone on one powder; feeds caution layer', proposed_fix: 'Add to §6.12: "roots when the Ansatz is the only or the first-named application site, including an either/or that names it; all when the Ansatz is mentioned only as a later, optional step."' },
    { id: 'RG-10', class: 'b', section: 'standard §6.8 finish lexicon', source: ['round-1 diff (2 records)', 'lane A notes (Bali Gents Haarpuder, alverde Beach Waves)'], issue: '(1) natürlich + matt words on one product: not covered (only matt + shine ⇒ unbekannt). (2) Phrases like „natürlich gestylt aussehen", „natürlich definierter Look", „natürlich strukturierter Look" — are they „Natural Look"?', records: ['bali-gents-matt-paste', 'wellaflex-schaumfestiger-locken-und-wellen-starker-halt'], impact: 'finish on molding/texture products, where the finish preference is asked', proposed_fix: 'Add to §6.8: "matt + natürlich ⇒ matt (natürlich is the weaker, compatible word); glänzend + natürlich ⇒ natürlich (PH1-5 pattern). natürlich needs the word Finish, Look or Glanz next to it („natürliches Finish", „Natural Look", „natürlicher Look", „natürlicher Glanz"); natürlich + a verb or another noun („natürlich gestylt aussehen", „natürlich strukturierter Look", „natürliches Haargefühl") is a look/feel word ⇒ unbekannt."' },
    { id: 'RG-11', class: 'b', section: 'standard §6.10 primary_job', source: ['round-1 diff (2 records)', 'sealed slot 8 (no shaping key)'], issue: 'Which job is primary when the lead is a product noun plus a look and/or a hold phrase; the job list has no shaping key.', records: ['balea-haargel-hair-jelly', 'got2b-styling-mattpaste-strand-matte'], impact: 'primary/secondary order only', proposed_fix: 'Add to §6.10: "Primary = the first job-bearing phrase of the lead promise; product nouns (Gel, Gelee, Paste, Wachs) and strength phrases („mit mittlerem Halt") are not job-bearing unless nothing else is; shaping/forming wording maps to hold_fix."' },
    { id: 'RG-12', class: 'b', section: 'standard §6.10 secondary_jobs', source: ['round-1 diff (14 supplementary records)'], issue: 'Whether a hold-strength claim, an attribute bullet („Anti-Frizz-Effekt") or an ingredient/feel line states a job explicitly.', records: ['14 records, see disagreements (field secondary_jobs)'], impact: 'secondary jobs (ranking context, not selection)', proposed_fix: 'Add to §6.10: "A C1/C2 hold claim with a strength word ⇒ hold_fix; an anti-frizz/flyaway word ⇒ frizz_control; a shine word ⇒ shine; a curl-definition word ⇒ definition; take them in claim order, max two, after the primary; feel and ingredient lines never state a job."' },
    { id: 'RG-13', class: 'b', section: 'standard §7.4 (name-derived strength words) vs §7.6 dry run', source: ['lane B ambiguous_rules §7.4/PH2-7/§7.6', 'P-1'], issue: 'A strength word in a name that qualifies another noun („Ultra Volumen", „Power Flex"). Both lanes read „Power" in Balea Styling Creme Power Flex as level 4, while §7.6 lists the same product among the null-level neutral-fact records.', records: ['balea-styling-creme-power-flex', 'balea-styling-spray-ultra-volumen'], impact: 'Power Flex: level 4 vs null + neutral fact (agreed 4 in this round)', proposed_fix: 'Add to §7.4: "A strength word in the product name counts only when it qualifies hold or the product as a whole (Taft POWER Haargel, Extra Hold, Max Hold); it does not count when it qualifies another result noun (Ultra Volumen, Power Flex is flex). Freeze script: add name words as hold claims only under that test." Then re-derive Power Flex from its dm house-brand Halt attribute (PH2-7) — capture it.' },
    { id: 'RG-14', class: 'b', section: 'standard §6.9 vs §7.4 („Kleber")', source: ['sealed slot 3 rule gaps'], issue: '„Kleber" is listed both as a strength word (level 4) and as a rigidity word (fest), although each section says the two lists never overlap.', records: ['got2b-spruehkleber-freeze-haarlack'], impact: 'none today (ultrastarke gives 4 independently)', proposed_fix: 'Keep „Kleber" in §6.9 (fest) only and delete it from §7.4.' },
    { id: 'RG-15', class: 'b', section: 'standard §4.3 step 3.1 water-based-serum exception', source: ['sealed slot 5', 'lane A note (Haarserum)'], issue: '"A water-based Serum that is really a leave-in conditioner" has no operational test and no trigger id; and it conflicts with 3.4(ii) for a shine-only (li_function no) promise.', records: ['balea-professional-haarserum-glow-und-shine'], impact: 'none this round (both lanes leave_in), but oil vs leave_in is open by letter', proposed_fix: 'Add to 3.1: "Exception test: Aqua above T_S and an LGN pair or a cationic conditioner above T_LI ⇒ go to 3.4(iii) (LI G0 decides), skipping 3.4(ii); trigger water_based_serum_exception."' },
    { id: 'RG-16', class: 'b', section: 'lexicon PH-1, SI-1…SI-4, CA-3/FX', source: ['lane B ambiguous_rules (Lexicon §1B SI-1/§1D PH-1)', 'lane A notes (JF 3 Tage Glatt, Balea Locken Lotion)'], issue: 'Unenumerated species decide border limbs: Malic Acid (PH-1 yardstick?), Polysilicone-9 (SI placement), Polyquaternium-69 (CA-3 only, though a styling film former by trade use).', records: ['john-frieda-frizz-ease-3-tage-glatt-styling-spray', 'balea-styling-locken-lotion'], impact: 'JF 3 Tage Glatt stays li_g0_provisional; Balea Locken Lotion routes leave_in on the letter', proposed_fix: 'Lexicon: add Malic Acid to PH-1; place Polysilicone-9 (SI-1 or SI-4) with a reason; decide whether PQ-69 joins FX-R (ambiguous hold) like PQ-11/16/46. Re-run both records (rerun obligation).' },
    { id: 'RG-17', class: 'b', section: 'standard §2.2 A2 release condition', source: ['lane B ambiguous_rules §2.2 A2/§4.1'], issue: 'A2 releases a two-INCI conflict "when a C1 pack capture identifies the unit on sale". Two conflict records now carry a C1 current list (Bali Curls Leave-in Spray, Cantu Edge Stay Gel), but the freeze kept identity_status inci_conflict; both lanes kept the block.', records: ['bali-curls-leave-in-spray-curl-defining', 'cantu-shea-butter-extra-hold-edge-stay-gel'], impact: '2 records stay blocked (formula_conflict)', proposed_fix: 'State the release test: "a dated C1 pack capture with the record\'s GTIN, newer than both conflicting lists, is the formula of record; identity_status verified_with_minor_source_difference, review formula_or_identity_conflict". The coordinator then re-freezes those two records (Cantu would still stop at evidence_gate: no directions).' },
    { id: 'RG-18', class: 'b', section: 'standard §8 tail_marker_vacuous', source: ['sealed cross-record findings'], issue: 'Does tail_marker_vacuous fire when T_LI is read but no border rule on the record\'s path uses it (3.4(ii) products)?', records: ['got2b-spruehkleber-freeze-haarlack', 'guhl-locken-pflege-und-styling-3in1'], impact: 'review noise', proposed_fix: 'Add to §8: "tail_marker_vacuous / _implausible fire only when a border rule on the record\'s path reads T_LI (3.4(i), 3.4(iii), D6, D7, PH1-16)."' },
    { id: 'RG-19', class: 'b', section: 'standard §7.2', source: ['sealed slot 3/8'], issue: 'No rule for a captured but illegible brand number (number beats word cannot run), or a number printed beside a display with a different maximum (Taft Paste "5+" beside 4 dots).', records: ['got2b-spruehkleber-freeze-haarlack', 'taft-styling-paste-forming-halt-5plus'], impact: 'hold level confidence', proposed_fix: 'Add to §7.2: "An illegible or self-contradicting brand number is not used; words decide, confidence moderate, review hold_number_unreadable, and the pack is queued for re-capture."' },
    { id: 'RG-20', class: 'b', section: 'lexicon FX-2c, FX-U; LI COND with T_LI none_visible; §5 rule 2 "gel-type"; Styling S0 has no rinse-out/dual-use step; „verformbar"/„krass" not in lexicons', source: ['sealed cross-record findings (slots 1, 2, 4, 8)'], issue: 'Gaps the sealed file named that the round could not test (slots 1 and 2 stopped at the evidence gate).', records: ['redken-styling-beach-spray', 'balea-styling-finishing-stick', 'guhl-locken-pflege-und-styling-3in1', 'taft-styling-paste-forming-halt-5plus'], impact: 'untested values (salt-free salt_spray, hairline/surface zone)', proposed_fix: 'Carry into v0.2 drafting; capture German packs for Redken Beach Spray and the Balea Finishing Stick directions so round 2 can test them.' },
    { id: 'RG-21', class: 'b', section: 'standard §4.6 registry (PH2-10 row)', source: ['lane A note (Killer.Curls)', 'lane B note (Killer.Curls)'], issue: 'PH2-10 holds Kevin.Murphy Killer.Curls at evidence_gate "until a C1/C2 German claim is captured". The frozen packet now carries a C2 promise; both lanes lifted the gate and held it as curl_cream (D7 + PH1-16). The registry row is stale.', records: ['kevin-murphy-killer-curls'], impact: 'none (lanes agree); registry text only', proposed_fix: 'Update the §4.6 row: "released by the 2026-10 capture; D7 ⇒ styling curl_cream, held (PH2-2)".' },
  ];

  const reportedAmbiguityMap = [
    { lane: 'B', section: '§4.2/§4.4', maps_to: 'RG-5' },
    { lane: 'B', section: '§2.2 A2/§4.1', maps_to: 'RG-17' },
    { lane: 'B', section: '§7.3', maps_to: 'RG-4' },
    { lane: 'B', section: '§7.4/PH2-7/§7.6', maps_to: 'RG-13 + P-1' },
    { lane: 'B', section: '§6.8/§6.9', maps_to: 'P-6' },
    { lane: 'B', section: '§6.11/§5', maps_to: 'RG-2 + P-3' },
    { lane: 'B', section: 'Lexicon §1B SI-1/§1D PH-1', maps_to: 'RG-16' },
    { lane: 'B', section: '§6/§4.7', maps_to: 'none — output-format note (null Styling fields = not emitted); handled by the diff normalisation' },
    { lane: 'A', section: 'balea-professional-glow-und-shine-finishing-spray (registry Held? no vs PH2-2)', maps_to: 'RG-6' },
    { lane: 'A', section: 'balea-professional-haarserum-glow-und-shine (serum exception judgment)', maps_to: 'RG-15' },
    { lane: 'A', section: 'john-frieda-frizz-ease-3-tage-glatt-styling-spray (Malic Acid, Polysilicone-9)', maps_to: 'RG-16' },
    { lane: 'A', section: 'balea-styling-locken-lotion (PQ-69 lexicon placement)', maps_to: 'RG-16' },
    { lane: 'A', section: 'Henkel table format scope (Taft Balm, Taft Gel Wax, Syoss Max Hold Wax, Taft Paste)', maps_to: 'RG-4' },
    { lane: 'A', section: 'bali-gents-matt-paste natürlich vs matt; „natürlich ... Look" phrases (Wellaflex, Bali Gents Haarpuder, alverde Beach Waves)', maps_to: 'RG-10' },
    { lane: 'A', section: 'schwarzkopf-taft-x-gliss-silky-shine-shine-coat / schwarzkopf-taft-texturspray-aloe-boost (lead line vs name; Pflege co-equal)', maps_to: 'RG-5' },
    { lane: 'A', section: 'balea-styling-spray-ultra-volumen (level from PH2-7 text, not the packet)', maps_to: 'P-1 + RG-13' },
    { lane: 'A', section: 'loreal-paris-elnett-stylingspray-hitzeschutz-3-tage-glatt (copied directions; PH1-14 override of a heat-class letter)', maps_to: 'P-3' },
    { lane: 'A', section: 'langhaarmaedchen-lockenspray-halt-sprungkraft (C2_house_brand stamp vs A5)', maps_to: 'P-4' },
    { lane: 'A', section: 'balea-finishing-spray-glow-und-care (missing separator; possible duplicate)', maps_to: 'P-5' },
    { lane: 'A', section: 'kevin-murphy-killer-curls (PH2-10 lifted by the capture)', maps_to: 'RG-21' },
    { lane: 'A', section: 'wella-eimi-sugar-lift (blowdry_lotion vs texture_spray on a damp-applied spray)', maps_to: 'agreed by both lanes (blowdry_lotion); no register entry' },
  ];

  const packetIssues = [
    { id: 'P-1', class: 'c', records: ['balea-styling-spray-ultra-volumen'], issue: 'Claims packet lacks the dm house-brand attribute „Halt: sehr starker Halt" that PH2-7 and property set §5.6 rest on (level 4); instead the freeze script added "Ultra" from the name as a hold claim (Ultra qualifies Volumen).', fix: 'Re-capture the dm attribute into claims[] (C2 house_brand); stop deriving hold claims from name words that qualify another noun (RG-13).' },
    { id: 'P-2', class: 'c', records: ['got2b-spruehkleber-freeze-haarlack'], issue: 'Rigidity words in the confirmed name (Kleber, Freeze) are not in the claims packet; the S0 confirmed name „Haarlack Sprühkleber" drops „Freeze".', fix: 'Freeze script: add name-derived flexibility words (§6.9 list) as flexibility claims with from_product_name: true; keep the full pack name.' },
    { id: 'P-3', class: 'c', records: ['loreal-paris-elnett-stylingspray-hitzeschutz-3-tage-glatt'], issue: 'Directions in the frozen capture are copied from an Elnett hairspray (both lanes); the S0 packet\'s only promise line is the heat line, so the C1 pack-front result line PH1-14 relies on is missing.', fix: 'Re-capture the real directions (the L\'Oréal article §11.7 cites) and the pack-front line into the S0 packet.' },
    { id: 'P-4', class: 'c', records: ['langhaarmaedchen-lockenspray-halt-sprungkraft'], issue: 'Promise stamped C2_house_brand although standard §2.2 A5 says Langhaarmädchen is a retailer-exclusive brand (C3 unless ownership is documented). Both lanes overrode the stamp.', fix: 'Freeze script: apply A5 (house-brand list = Balea, alverde, Isana, … only); re-stamp C3.' },
    { id: 'P-5', class: 'c', records: ['balea-finishing-spray-glow-und-care', 'balea-professional-glow-und-shine-finishing-spray'], issue: 'Unflagged missing separator at r6 („Triheptanoin Camelina Stativa Seed Oil") forces weight unknown and a job_formula_conflict; both lanes also note a possible duplicate with the Leave-In Glow&Shine Finishing Spray (A7: resolve by GTIN).', fix: 'Add to identity.inci_flags; re-capture the INCI; resolve the duplicate by GTIN before round 2.' },
    { id: 'P-6', class: 'c', records: ['schwarzkopf-taft-styling-balm-locken-halt-3', 'taft-styling-paste-forming-halt-5plus', 'bali-gents-haarpuder-volumizing-styling-powder'], issue: 'Claims packets carry capture-editor annotations inside claim text („(no gloss/matt claim)", „matt: \'Mit mattem Finish\'", hold text "null") — lane B ambiguity §6.8/§6.9.', fix: 'Freeze script: strip editor annotations into a separate note field; drop empty "null" claims.' },
    { id: 'P-7', class: 'c', records: ['balea-professional-glow-und-shine-finishing-spray'], issue: 'Promise line „Wirkt einem Anti-Frizz-Effekt entgegen" says literally the opposite of anti-frizz — probably a capture/transcription slip; it is the line that makes li_function yes (RG-6).', fix: 'Re-read the dm page / pack before Q2 is applied.' },
    { id: 'P-8', class: 'c', records: ['got2b-spruehkleber-freeze-haarlack', 'taft-styling-paste-forming-halt-5plus'], issue: 'Pack dot scale illegible (got2b) / "5+" printed beside a 4-dot display (Taft Paste) (sealed file).', fix: 'Pack photo re-read.' },
  ];

  const ownerQuestions = [
    { id: 'Q1', rank: 1, root_cause: 'RG-4', question: 'Henkel prints a „Haltegrad" number on its pastes, waxes and balms too (Taft, Syoss, got2b). Should those numbers be read on the same 1–5 scale as their sprays and mousses?', examples: ['Taft Styling Paste Forming „5+": scale ⇒ level 4 („sehr stark"); words-only ⇒ no level, card shows „Halt: keine Herstellerangabe" + „Enthält Stylingpolymere (z. B. VP/VA Copolymer)". Both lanes said no level; the sealed expectation said 4.', 'Taft Styling Balm Locken „Halt 3" + „Starker Halt": scale ⇒ 2 (number beats the inflated word, as on Syoss mousse „extra stark (Haltegrad 4)" ⇒ 3); words-only ⇒ 3. Lanes split 3 vs 2. Taft Gel Wax „Haltegrad 2" ⇒ 1 vs no level.'], affects: 'hold level in molding and curl_cream, where a stated level ranks first (D8)', recommendation: 'Yes — extend the Henkel row to every Henkel leave-on format except Taft gels (their 4–14 scale stays words-only), with "5+" = 5. Where Henkel molding products carry both a number and a word, they already agree with the x/5 mapping (Syoss Max Hold Wax Haltegrad 5 + „Mega stark" ⇒ 4; Taft Matt Wax Halt 5 + „maximal" ⇒ 4), so the scale is evidently shared. Re-read the Taft Paste pack (5+ beside 4 dots) before locking.' },
    { id: 'Q2', rank: 2, root_cause: 'RG-6', question: 'A finishing spray promises shine and „Anti-Frizz" on dry, already-styled hair. Is the anti-frizz part a Leave-in job (so the product waits for the Leave-in addendum and is not recommendable yet) or simply part of the shine-finish job (recommendable now)?', examples: ['Balea Professional Leave-In Glow&Shine Finishing Spray („Nach dem Styling ... auf das trockene Haar sprühen"): lane A held it (not matchable), lane B committed it as shine_finish; the standard\'s registry says „not held".', 'Same pattern waiting in the unseen set: Balea Styling Finishing Stick („Bändigt abstehende Babyhaare und Frizz") and Balea Haarserum Glow & Shine („Anti-Frizz-Effekt").'], affects: 'whether shine_finish products with an anti-frizz line are recommendable before the Leave-in addendum', recommendation: 'Treat flyaway/frizz control on dry, styled hair as the shine_finish job (the subtype table already defines shine_finish as „shine, flyaway control on dry hair"); keep li_function yes for anti-frizz promised on damp hair or as care. Glow&Shine Finishing Spray then stays committed, matching the registry. First re-check its promise text (P-7).' },
    { id: 'Q3', rank: 3, root_cause: 'RG-5', question: 'A curl spray named „Pflege-Spray" promises „Feuchtigkeit und definierte Locken". Is it a Leave-in product (care-led) or an undecided mixed product that stays in its current category for review?', examples: ['Garnier Fructis Locken Methode Feuchtigkeitsboost Pflege-Spray: lane A mixed (review), lane B leave_in. Neither makes it a Styling product.', 'Contrast GUHL Locken Pflege & Styling 3in1, whose pack says „Pflege & Styling" outright — both lanes and the sealed file call that mixed.'], affects: 'one route now; the rule decides every care-named curl product with a definition claim', recommendation: 'Let the product name break the tie: a care-named product (Pflege-Spray, Kur, Balsam) whose definition claim is the result of the care is care-led ⇒ Leave-in; keep mixed only for explicit dual names („Pflege & Styling", „2in1/3in1", „Textur und Pflege").' },
    { id: 'Q4', rank: 4, root_cause: 'RG-3', question: 'Should „heat-activated" mean only products that say heat activates or strengthens them, or also products whose directions suggest blow-drying for more volume?', examples: ['Balea Styling Spray Ultra Volumen („mit einer Rundbürste ... trocken föhnen" for more volume) and Jean & Len Sea Salt Spray („Du willst mehr Volumen? Dann einfach ... trocken föhnen"): lane B yes, lane A no.', 'Contrast Taft Schaumfestiger Volumen („Föhnhitze verstärkt den Volumen-Effekt") — yes for both readings.'], affects: 'heat_activated label on mousse/blowdry/salt products; at scale it would mark nearly every volume product heat-activated', recommendation: 'Only when the text says heat acts on the product (verstärkt, aktiviert, fixiert durch Wärme). A blow-dry suggestion is a usage step, already captured by application_moment.' },
  ];

  const laneErrors = [
    { id: 'E-1', record: 'neqi-diamond-glass-ultimate-styling-spray', field: 'T_LI status', wrong: 'A', right: 'B', rule: 'LI §3.1.1 cl. 5 (implausible: marker above the conditioning architecture)', moves_value: false },
    { id: 'E-2', record: 'langhaarmaedchen-lockenspray-natur-lockenwunder', field: 'T_LI status', wrong: 'A', right: 'B', rule: 'LI §3.1.1 cl. 6 (vacuous: whole tail in the closed set)', moves_value: false },
    { id: 'E-3', record: 'balea-ansatzvolumen-booster', field: 'application_moment', wrong: 'B', right: 'A', rule: 'standard §6.11 damp anchor (air-drying allowed / drying optional)', moves_value: true },
    { id: 'E-4', record: 'balea-pure-styling-volumenpuder-spray', field: 'subtype', wrong: 'B', right: 'A', rule: 'standard §5 tie-break: spray form ⇒ texture_spray; name never decides (§4.4)', moves_value: true },
    { id: 'E-5', record: 'guhl-foehn-spray-langzeit-volumen', field: 'heat_activated', wrong: 'A', right: 'B', rule: 'property set §7 crossing 1 (C raise only after unblinding); FREEZE-NOTES 5.1', moves_value: true },
    { id: 'E-6', record: 'color-wow-dream-coat-supernatural-spray', field: 'promise_class', wrong: 'B', right: 'A', rule: 'standard §4.2 (class from C1/C2 only)', moves_value: false },
    { id: 'E-7', record: 'loreal-paris-elnett-stylingspray-hitzeschutz-3-tage-glatt', field: 'target_zone', wrong: 'B', right: 'A', rule: 'standard §6.11/§6.12 (copied directions ⇒ unresolved/empty + review)', moves_value: true },
  ];

  return {
    disagreements: D,
    unseen_misses: U,
    unseen_trap_slots: { exercised: [4, 5, 6, 7], controls_with_embedded_traps: [3, 8], not_exercised: [1, 2], note: 'From the sealed file: boundary traps 4 (curl-cream name without fixative), 5 (D2 serum name), 6 (refresh vs refresher), 7 (protection-first spray) were exercised and caught; controls 3 (C1 fest) and 8 (C3-only matte, 5+ display) carried embedded traps. Slots 1 (salt-free beach spray) and 2 (hairline/surface zone) stopped at the evidence gate, so their traps were not exercised.' },
    unseen_verdict: 'MET on the letter: 8 unseen products (>= 6), 4 boundary traps exercised and caught (>= 2). Both lanes match route and reason on 8/8. Lane A matches every firm expectation on 8/8 slots; lane B on 6/8 (slot 2 identity_status, slot 3 application_moment + flexibility). Soft misses: both lanes on slot 8 hold (null vs 4, owner question Q1); B on slot 1 identity and slot 5 promise class. Caveat: slots 1 and 2 did not exercise their traps (evidence gate), so salt-free salt_spray and hairline/surface zone remain untested.',
    rule_gap_register: register,
    packet_issues: packetIssues,
    reported_ambiguity_map: reportedAmbiguityMap,
    owner_questions: ownerQuestions,
    lane_errors: laneErrors,
  };
})();
// CLASSIFY_END

// ---------------------------------------------------------------------------
// Normalisation of trivial format differences (documented in NORMALISATION_NOTES)
// ---------------------------------------------------------------------------
const NORMALISATION_NOTES = {
  identity_status: 'string as emitted',
  tail_markers: 'T_S and T_LI compared as (inci lower-cased, whitespace collapsed, the fragrance aliases Parfum / Parfum (Fragrance) / Fragrance/Parfum folded to parfum; rank; status). Lane A\'s T_S.alt is ignored (B does not emit it). Field agrees only if all six parts agree; T_S and T_LI are also reported separately.',
  promise_class: 'A null and B "unknown" both mean "not assigned (S0 stopped before step 2)" and are mapped to "not_assigned".',
  route: 'string as emitted',
  reason_code: 'Lanes use different code vocabularies. Both are mapped to the deciding rule: A "3.4(ii)" = B "ph2_1_direct" -> 3.4(ii); A "3.5" = B "non_aqueous_styling" -> 3.5; A "3.3" = B "protection_first" -> 3.3; A "3.2" = B "refresh_tie_precedence" -> 3.2; A "3.1" = B "d2_oil_serum_name" -> 3.1; A "ruled (D2)" = B "owner_named_styling" -> 4.6_owner_named; A "3.4(iii)" on route leave_in, A "3.1 exception -> 3.4(iii)", B "li_g0_in_category" -> 3.4(iii)_in_category; A "3.4(iii)" on route styling, B "li_g0_excluded_styling_first" -> 3.4(iii)_excluded_styling_first. Boundary reasons (evidence_gate, formula_conflict, mixed_promise, li_g0_provisional, pending_leave_in_addendum) are identical strings in both lanes.',
  subtype: 'string or null',
  result_mechanisms: 'A [{value, members}] -> sorted set of value; B [string] -> sorted set. Members are not compared (B does not emit them).',
  hold_route: 'string or null',
  weight: 'string or null',
  alcohol_note: 'A {value} -> value; B string. "fires" / "does_not_fire" / null.',
  buildup_note: 'A {fired: true|false} -> "fires" | "does_not_fire"; B string.',
  provides_heat_protection: 'A {value} -> boolean; B boolean. A\'s trace/display are not compared.',
  application_moment: 'A {primary, also[]} -> primary; B string (B puts "also" readings in notes). Primary only is compared.',
  target_zone: 'string or null',
  heat_activated: 'string or null',
  hold_level: 'number, null, or the string "review"',
  flexibility: 'string or null',
  finish: 'string or null',
  primary_job: 'string or null',
  neutral_fact: 'string with whitespace collapsed and straight/curly quotes unified; null = not shown',
  d8b_flags: 'sorted set of strings; null (no Styling profile) kept distinct from []',
  secondary_jobs: '(supplementary, not in the overall %) sorted set; null kept distinct from []',
};

const FIELDS = [
  'identity_status', 'tail_markers', 'promise_class', 'route', 'reason_code', 'subtype',
  'result_mechanisms', 'hold_route', 'weight', 'alcohol_note', 'buildup_note',
  'provides_heat_protection', 'application_moment', 'target_zone', 'heat_activated',
  'hold_level', 'flexibility', 'finish', 'primary_job', 'neutral_fact', 'd8b_flags',
];
const SUPPLEMENTARY = ['secondary_jobs', 'tail_T_S', 'tail_T_LI'];

const normStr = (s) => (s == null ? null : String(s).replace(/[“”„]/g, '"').replace(/\s+/g, ' ').trim());
// INCI alias normalisation: the fragrance entry is written 'Parfum', 'Parfum (Fragrance)', 'Fragrance/Parfum' etc.;
// all are mapped to 'parfum'. No other alias is folded.
const normInci = (s) => {
  if (s == null) return null;
  const t = String(s).toLowerCase().replace(/\s+/g, ' ').trim();
  if (/^(parfum|fragrance)( ?\((fragrance|parfum)\))?$|^(parfum|fragrance) ?\/ ?(parfum|fragrance)$/.test(t)) return 'parfum';
  return t;
};
const marker = (m) => (m ? { inci: normInci(m.inci), rank: m.rank == null ? null : m.rank, status: m.status || null } : null);
const setOf = (arr) => (arr == null ? null : [...arr].map(String).sort());

const A_REASON = (r) => {
  const c = r.reason_code;
  if (c === '3.4(ii)') return '3.4(ii)';
  if (c === '3.5') return '3.5';
  if (c === '3.3') return '3.3';
  if (c === '3.2') return '3.2';
  if (c === '3.1') return '3.1';
  if (c === 'ruled (D2)') return '4.6_owner_named';
  if (c === '3.1 exception -> 3.4(iii)') return '3.4(iii)_in_category';
  if (c === '3.4(iii)') return r.route === 'leave_in' ? '3.4(iii)_in_category' : '3.4(iii)_excluded_styling_first';
  return c;
};
const B_REASON = (r) => ({
  ph2_1_direct: '3.4(ii)', non_aqueous_styling: '3.5', protection_first: '3.3', refresh_tie_precedence: '3.2',
  d2_oil_serum_name: '3.1', owner_named_styling: '4.6_owner_named', li_g0_in_category: '3.4(iii)_in_category',
  li_g0_excluded_styling_first: '3.4(iii)_excluded_styling_first',
}[r.reason_code] || r.reason_code);

function normA(r) {
  return {
    identity_status: r.identity_status,
    tail_markers: { T_S: marker(r.tail_markers && r.tail_markers.T_S), T_LI: marker(r.tail_markers && r.tail_markers.T_LI) },
    tail_T_S: marker(r.tail_markers && r.tail_markers.T_S),
    tail_T_LI: marker(r.tail_markers && r.tail_markers.T_LI),
    promise_class: r.promise_class == null || r.promise_class === 'unknown' ? 'not_assigned' : r.promise_class,
    route: r.route,
    reason_code: A_REASON(r),
    subtype: r.subtype == null ? null : r.subtype,
    result_mechanisms: r.result_mechanisms == null ? null : setOf(r.result_mechanisms.map((m) => m.value)),
    hold_route: r.hold_route == null ? null : r.hold_route,
    weight: r.weight == null ? null : r.weight,
    alcohol_note: r.alcohol_note == null ? null : r.alcohol_note.value,
    buildup_note: r.buildup_note == null ? null : (r.buildup_note.fired ? 'fires' : 'does_not_fire'),
    provides_heat_protection: r.provides_heat_protection == null ? null : r.provides_heat_protection.value,
    application_moment: r.application_moment == null ? null : r.application_moment.primary,
    target_zone: r.target_zone == null ? null : r.target_zone,
    heat_activated: r.heat_activated == null ? null : r.heat_activated,
    hold_level: r.hold_level == null ? null : r.hold_level,
    flexibility: r.flexibility == null ? null : r.flexibility,
    finish: r.finish == null ? null : r.finish,
    primary_job: r.primary_job == null ? null : r.primary_job,
    neutral_fact: normStr(r.neutral_fact),
    d8b_flags: setOf(r.d8b_flags),
    secondary_jobs: setOf(r.secondary_jobs),
  };
}
function normB(r) {
  return {
    identity_status: r.identity_status,
    tail_markers: { T_S: marker(r.tail_markers && r.tail_markers.T_S), T_LI: marker(r.tail_markers && r.tail_markers.T_LI) },
    tail_T_S: marker(r.tail_markers && r.tail_markers.T_S),
    tail_T_LI: marker(r.tail_markers && r.tail_markers.T_LI),
    promise_class: r.promise_class == null || r.promise_class === 'unknown' ? 'not_assigned' : r.promise_class,
    route: r.route,
    reason_code: B_REASON(r),
    subtype: r.subtype == null ? null : r.subtype,
    result_mechanisms: setOf(r.result_mechanisms),
    hold_route: r.hold_route == null ? null : r.hold_route,
    weight: r.weight == null ? null : r.weight,
    alcohol_note: r.alcohol_note == null ? null : r.alcohol_note,
    buildup_note: r.buildup_note == null ? null : r.buildup_note,
    provides_heat_protection: r.provides_heat_protection == null ? null : r.provides_heat_protection,
    application_moment: r.application_moment == null ? null : r.application_moment,
    target_zone: r.target_zone == null ? null : r.target_zone,
    heat_activated: r.heat_activated == null ? null : r.heat_activated,
    hold_level: r.hold_level == null ? null : r.hold_level,
    flexibility: r.flexibility == null ? null : r.flexibility,
    finish: r.finish == null ? null : r.finish,
    primary_job: r.primary_job == null ? null : r.primary_job,
    neutral_fact: normStr(r.neutral_fact),
    d8b_flags: setOf(r.d8b_flags),
    secondary_jobs: setOf(r.secondary_jobs),
  };
}
const same = (x, y) => JSON.stringify(x) === JSON.stringify(y);

// ---------------------------------------------------------------------------
// Join
// ---------------------------------------------------------------------------
const cohortById = new Map(C.records.map((r) => [r.sample_id, r]));
const bById = new Map(B.records.map((r) => [r.id, r]));
const ids = A.records.map((r) => r.id).sort((x, y) => {
  const sx = cohortById.get(x).source_slug; const sy = cohortById.get(y).source_slug;
  return sx < sy ? -1 : sx > sy ? 1 : 0;
});
if (ids.length !== 107 || B.records.length !== 107 || !ids.every((id) => bById.has(id) && cohortById.has(id))) {
  throw new Error('record sets do not join 1:1 on 107 ids');
}
const ROLES = ['calibration', 'negative_control', 'unseen'];

const rows = ids.map((id) => {
  const c = cohortById.get(id);
  const a = A.records.find((r) => r.id === id);
  const b = bById.get(id);
  return {
    id, slug: c.source_slug, name: `${c.identity.brand} ${c.identity.product_name}`, role: c.cohort_role,
    rawA: a, rawB: b, A: normA(a), B: normB(b),
  };
});

// ---------------------------------------------------------------------------
// 1. Field agreement
// ---------------------------------------------------------------------------
function pct(n, d) { return d === 0 ? null : Math.round((n / d) * 1000) / 10; }
function agreementFor(subset, field) {
  let agree = 0; let emitted = 0; let emittedAgree = 0;
  for (const r of subset) {
    const ok = same(r.A[field], r.B[field]);
    if (ok) agree++;
    const anyEmitted = r.A[field] !== null || r.B[field] !== null;
    if (anyEmitted) { emitted++; if (ok) emittedAgree++; }
  }
  return {
    n: subset.length, agree, pct: pct(agree, subset.length),
    emitted_by_either: emitted, agree_where_emitted: emittedAgree, pct_where_emitted: pct(emittedAgree, emitted),
  };
}
const fieldAgreement = {};
for (const f of [...FIELDS, ...SUPPLEMENTARY]) {
  fieldAgreement[f] = { all: agreementFor(rows, f) };
  for (const role of ROLES) fieldAgreement[f][role] = agreementFor(rows.filter((r) => r.role === role), f);
}
function overall(subset) {
  let cells = 0; let agree = 0; let emittedCells = 0; let emittedAgree = 0; let recordsFullyAgree = 0;
  for (const r of subset) {
    let all = true;
    for (const f of FIELDS) {
      cells++;
      const ok = same(r.A[f], r.B[f]);
      if (ok) agree++; else all = false;
      if (r.A[f] !== null || r.B[f] !== null) { emittedCells++; if (ok) emittedAgree++; }
    }
    if (all) recordsFullyAgree++;
  }
  return {
    records: subset.length, field_cells: cells, cells_agree: agree, pct_cells: pct(agree, cells),
    emitted_cells: emittedCells, emitted_cells_agree: emittedAgree, pct_emitted_cells: pct(emittedAgree, emittedCells),
    records_all_fields_agree: recordsFullyAgree, pct_records: pct(recordsFullyAgree, subset.length),
  };
}
const overallAgreement = { all: overall(rows) };
for (const role of ROLES) overallAgreement[role] = overall(rows.filter((r) => r.role === role));

// Route agreement per pair rule / boundary reason (standard §10.2: "Routes report agreement per pair rule").
// A record is counted under every canonical reason code either lane gave it.
const routeByRule = {};
for (const r of rows) {
  for (const code of new Set([r.A.reason_code, r.B.reason_code])) {
    if (!routeByRule[code]) routeByRule[code] = { records: 0, route_agree: 0, reason_agree: 0 };
    routeByRule[code].records++;
    if (r.A.route === r.B.route) routeByRule[code].route_agree++;
    if (r.A.reason_code === r.B.reason_code) routeByRule[code].reason_agree++;
  }
}
const routeAgreementByRule = Object.keys(routeByRule).sort().map((k) => ({ reason_code: k, ...routeByRule[k] }));

// ---------------------------------------------------------------------------
// 4. Disagreement list (with rule paths and classification)
// ---------------------------------------------------------------------------
function rulePathA(raw, field) {
  const bits = [];
  if (Array.isArray(raw.rule_path)) bits.push(raw.rule_path.join(' | '));
  if (field === 'hold_level' && raw.hold_basis) bits.push('hold_basis: ' + raw.hold_basis);
  if (raw.notes) bits.push('notes: ' + (Array.isArray(raw.notes) ? raw.notes.join(' | ') : raw.notes));
  return bits.join(' || ');
}
function rulePathB(raw, field) {
  const bits = [];
  if (Array.isArray(raw.rule_path)) bits.push(raw.rule_path.join(' | '));
  if (field === 'hold_level' && raw.hold_basis) bits.push('hold_basis: ' + raw.hold_basis);
  if (raw.notes) bits.push('notes: ' + (Array.isArray(raw.notes) ? raw.notes.join(' | ') : raw.notes));
  return bits.join(' || ');
}
const disagreements = [];
for (const r of rows) {
  for (const f of [...FIELDS, 'secondary_jobs']) {
    if (same(r.A[f], r.B[f])) continue;
    const key = `${r.slug}::${f}`;
    const cls = CLASSIFY.disagreements[key] || null;
    disagreements.push({
      slug: r.slug, id: r.id, name: r.name, role: r.role, field: f,
      supplementary: f === 'secondary_jobs',
      A: r.A[f], B: r.B[f],
      A_rule_path: rulePathA(r.rawA, f), B_rule_path: rulePathB(r.rawB, f),
      classification: cls ? cls.class : 'UNCLASSIFIED',
      root_cause: cls ? cls.root_cause : null,
      right_lane: cls ? (cls.right || null) : null,
      comment: cls ? cls.comment : null,
    });
  }
}
const unclassified = disagreements.filter((d) => d.classification === 'UNCLASSIFIED').map((d) => `${d.slug}::${d.field}`);

// ---------------------------------------------------------------------------
// 2. Hold normalisation check (PH1-11 "two independent claim normalisations give identical hold levels")
// ---------------------------------------------------------------------------
const holdRows = rows.filter((r) => r.A.hold_level !== null || r.B.hold_level !== null);
const holdMismatches = holdRows.filter((r) => !same(r.A.hold_level, r.B.hold_level)).map((r) => ({
  slug: r.slug, name: r.name, role: r.role, subtype_A: r.A.subtype, subtype_B: r.B.subtype,
  A: r.A.hold_level, A_basis: r.rawA.hold_basis || null, B: r.B.hold_level, B_basis: r.rawB.hold_basis || null,
}));
const holdCheck = {
  products_where_either_emits_a_level: holdRows.length,
  identical: holdRows.length - holdMismatches.length,
  mismatches: holdMismatches.length,
  criterion_met: holdMismatches.length === 0,
  mismatch_list: holdMismatches,
  all_rows: holdRows.map((r) => ({ slug: r.slug, name: r.name, subtype: r.A.subtype || r.B.subtype, A: r.A.hold_level, B: r.B.hold_level, same: same(r.A.hold_level, r.B.hold_level) })),
};

// ---------------------------------------------------------------------------
// 3. Unseen scoring vs sealed expectations
// ---------------------------------------------------------------------------
const bySlug = new Map(rows.map((r) => [r.slug, r]));
const firmOf = (x) => (x && typeof x === 'object' && 'firmness' in x ? String(x.firmness) : null);
const isFirm = (f) => (f == null ? 'firm' : /^firm/.test(f) ? 'firm' : /firm/.test(f) && !/^soft/.test(f) ? 'firm' : 'soft');

function expectedFields(rec) {
  // Returns [{field, expected, firmness, note}] in lane-normalised vocabulary.
  const out = [];
  const s0 = rec.s0;
  const s0Firm = isFirm(s0.firmness);
  out.push({ field: 'identity_status', expected: rec.identity_status.value, firmness: isFirm(rec.identity_status.firmness) });
  out.push({ field: 'tail_T_S', expected: marker(rec.tail_markers.T_S), firmness: isFirm(rec.tail_markers.T_S.firmness) });
  out.push({ field: 'tail_T_LI', expected: marker(rec.tail_markers.T_LI), firmness: isFirm(rec.tail_markers.T_LI.firmness) });
  // promise class: sealed uses prose ("styling_result (C1: ...)", "not assigned ...")
  const pc = /^not assigned/.test(s0.promise_class) ? 'not_assigned' : s0.promise_class.split(/[\s(]/)[0];
  out.push({ field: 'promise_class', expected: pc, firmness: s0Firm });
  out.push({ field: 'route', expected: s0.route, firmness: s0Firm });
  // reason code: boundary_reason or pair rule
  let rc = s0.boundary_reason;
  if (!rc) {
    const pr = s0.pair_rule || '';
    if (/^3\.4\(ii\)/.test(pr)) rc = '3.4(ii)';
    else if (/^3\.2/.test(pr)) rc = '3.2';
    else if (/^3\.3/.test(pr)) rc = '3.3';
    else if (/3\.4\(iii\)/.test(pr)) rc = s0.route === 'leave_in' ? '3.4(iii)_in_category' : '3.4(iii)_excluded_styling_first';
    else rc = pr;
  }
  out.push({ field: 'reason_code', expected: rc, firmness: s0Firm });
  out.push({ field: 'subtype', expected: rec.styling_subtype.value, firmness: isFirm(rec.styling_subtype.firmness) });
  const p = rec.properties;
  const emitted = p && typeof p === 'object';
  const prop = (k) => (emitted ? p[k] : null);
  const val = (k, map) => {
    const x = prop(k);
    if (!emitted) return { expected: null, firmness: 'firm' };
    return { expected: map ? map(x.value) : x.value, firmness: isFirm(x.firmness) };
  };
  out.push({ field: 'result_mechanisms', ...val('result_mechanisms', (v) => setOf(v.map((m) => m.value))) });
  out.push({ field: 'hold_route', ...val('hold_route') });
  out.push({ field: 'weight', ...val('weight') });
  out.push({ field: 'alcohol_note', ...val('alcohol_note') });
  out.push({ field: 'buildup_note', ...val('buildup_note', (v) => (v === 'fired' ? 'fires' : v === 'not_fired' ? 'does_not_fire' : v)) });
  out.push({ field: 'provides_heat_protection', ...val('provides_heat_protection') });
  out.push({ field: 'application_moment', ...(emitted ? { expected: p.application_moment.primary, firmness: isFirm(p.application_moment.firmness) } : { expected: null, firmness: 'firm' }) });
  out.push({ field: 'target_zone', ...val('target_zone') });
  out.push({ field: 'heat_activated', ...val('heat_activated') });
  out.push({ field: 'flexibility', ...val('flexibility') });
  out.push({ field: 'finish', ...val('finish') });
  out.push({ field: 'primary_job', ...val('primary_job') });
  const hl = rec.chaarlie_hold_level;
  out.push({ field: 'hold_level', expected: hl.value === 'not_emitted' ? null : hl.value, firmness: isFirm(hl.firmness) });
  const d8 = rec.d8b_flags;
  const d8v = Array.isArray(d8) ? d8 : d8.value;
  out.push({ field: 'd8b_flags', expected: emitted ? setOf(d8v) : null, firmness: Array.isArray(d8) ? 'firm' : isFirm(d8.firmness) });
  const nf = rec.neutral_fact_shown;
  const nfv = typeof nf === 'object' ? nf.value : nf;
  out.push({ field: 'neutral_fact_shown', expected: nfv, firmness: typeof nf === 'object' ? isFirm(nf.firmness) : 'firm' });
  return out;
}
function laneValue(r, lane, field) {
  if (field === 'neutral_fact_shown') return r[lane].neutral_fact !== null;
  return r[lane][field];
}
const unseenScore = [];
const unseenTotals = { A: { firm: [0, 0], soft: [0, 0] }, B: { firm: [0, 0], soft: [0, 0] } };
const unseenSlotMatch = { A: { route_and_reason: 0, all_firm: 0, all: 0 }, B: { route_and_reason: 0, all_firm: 0, all: 0 } };
const unseenMisses = [];
for (const rec of [...S.records].sort((x, y) => x.unseen_slot - y.unseen_slot)) {
  const r = bySlug.get(rec.sample_id);
  const exp = expectedFields(rec);
  const slot = { slot: rec.unseen_slot, slug: rec.sample_id, name: r.name, trap: rec.intended_trap, fields: [] };
  const allOk = { A: true, B: true }; const firmOk = { A: true, B: true }; const rrOk = { A: true, B: true };
  for (const e of exp) {
    const res = { field: e.field, expected: e.expected, firmness: e.firmness };
    for (const lane of ['A', 'B']) {
      const got = laneValue(r, lane, e.field);
      const ok = same(got, e.expected);
      res[lane] = got; res[lane + '_match'] = ok;
      unseenTotals[lane][e.firmness][1]++;
      if (ok) unseenTotals[lane][e.firmness][0]++;
      else {
        allOk[lane] = false;
        if (e.firmness === 'firm') firmOk[lane] = false;
        if (e.field === 'route' || e.field === 'reason_code') rrOk[lane] = false;
        const key = `${rec.sample_id}::${e.field}::${lane}`;
        const cls = CLASSIFY.unseen_misses[key] || null;
        unseenMisses.push({
          slot: rec.unseen_slot, slug: rec.sample_id, name: r.name, lane, field: e.field, firmness: e.firmness,
          expected: e.expected, got,
          classification: cls ? cls.class : 'UNCLASSIFIED', root_cause: cls ? cls.root_cause : null, comment: cls ? cls.comment : null,
        });
      }
    }
    slot.fields.push(res);
  }
  for (const lane of ['A', 'B']) {
    slot[lane + '_all_fields_match'] = allOk[lane];
    slot[lane + '_all_firm_match'] = firmOk[lane];
    slot[lane + '_route_and_reason_match'] = rrOk[lane];
    if (allOk[lane]) unseenSlotMatch[lane].all++;
    if (firmOk[lane]) unseenSlotMatch[lane].all_firm++;
    if (rrOk[lane]) unseenSlotMatch[lane].route_and_reason++;
  }
  unseenScore.push(slot);
}
const unseenUnclassified = unseenMisses.filter((m) => m.classification === 'UNCLASSIFIED').map((m) => `${m.slug}::${m.field}::${m.lane}`);
const trapSlots = CLASSIFY.unseen_trap_slots; // slots whose trap was actually exercised (from the sealed file's trap_caught)
const unseenCriterion = {
  rule: 'PH1-11: >= 6 unseen products, >= 2 traps, matching pre-registered expectations',
  unseen_products: S.records.length,
  traps_exercised: trapSlots.exercised.length,
  traps_exercised_slots: trapSlots.exercised,
  controls_with_embedded_traps: trapSlots.controls_with_embedded_traps,
  traps_not_exercised: trapSlots.not_exercised,
  trap_note: trapSlots.note,
  slots_matching_on_all_firm_fields: { A: unseenSlotMatch.A.all_firm, B: unseenSlotMatch.B.all_firm },
  slots_matching_on_route_and_reason: { A: unseenSlotMatch.A.route_and_reason, B: unseenSlotMatch.B.route_and_reason },
  slots_matching_on_every_field_incl_soft: { A: unseenSlotMatch.A.all, B: unseenSlotMatch.B.all },
  verdict: CLASSIFY.unseen_verdict,
};

// ---------------------------------------------------------------------------
// 6. Coverage per subtype where A and B agree
// ---------------------------------------------------------------------------
const SUBTYPES = ['gel', 'curl_cream', 'mousse', 'blowdry_lotion', 'smoothing_styler', 'hairspray', 'shine_finish', 'salt_spray', 'texture_spray', 'hair_powder', 'molding', 'refresher'];
const coverage = {};
for (const st of SUBTYPES) coverage[st] = { committed_agreed: [], held_agreed: [], disputed: [] };
for (const r of rows) {
  const a = r.A; const b = r.B;
  const aKind = a.route === 'styling' ? 'committed' : a.reason_code === 'pending_leave_in_addendum' ? 'held' : null;
  const bKind = b.route === 'styling' ? 'committed' : b.reason_code === 'pending_leave_in_addendum' ? 'held' : null;
  if (aKind && bKind && aKind === bKind && a.subtype === b.subtype && a.subtype) {
    coverage[a.subtype][aKind + '_agreed'].push(r.slug);
  } else {
    for (const [k, st] of [[aKind, a.subtype], [bKind, b.subtype]]) {
      if (k && st && !coverage[st].disputed.includes(r.slug)) coverage[st].disputed.push(r.slug);
    }
  }
}
const coverageTable = SUBTYPES.map((st) => ({
  subtype: st,
  committed_agreed: coverage[st].committed_agreed.length,
  held_agreed: coverage[st].held_agreed.length,
  total_agreed: coverage[st].committed_agreed.length + coverage[st].held_agreed.length,
  disputed: coverage[st].disputed.length,
  meets_5_committed_only: coverage[st].committed_agreed.length >= 5,
  meets_5_incl_held: coverage[st].committed_agreed.length + coverage[st].held_agreed.length >= 5,
  committed_slugs: coverage[st].committed_agreed,
  held_slugs: coverage[st].held_agreed,
  disputed_slugs: coverage[st].disputed,
}));

// ---------------------------------------------------------------------------
// 5. Reported ambiguities (both lanes) + merged register
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------
const out = {
  generated_by: 'data/research/styling-inci/v1.0/round-1/diff.js',
  inputs: {
    lane_A: { file: 'blind-lane-A/results.json', model: A.model, standard: A.standard, run_at: A.run_at || null },
    lane_B: { file: 'blind-lane-B/results.json', model: B.model, standard: B.standard, run_note: B.run_note || null },
    sealed: { file: 'sealed/unseen-expectations.json', sealed_at: S.sealed_at },
    cohort: { file: 'cohort.json', cohort_version: C.cohort_version },
  },
  normalisation: NORMALISATION_NOTES,
  counts: {
    records: rows.length,
    by_role: Object.fromEntries(ROLES.map((role) => [role, rows.filter((r) => r.role === role).length])),
    disagreements_core_fields: disagreements.filter((d) => !d.supplementary).length,
    disagreements_supplementary_secondary_jobs: disagreements.filter((d) => d.supplementary).length,
    records_with_any_core_disagreement: new Set(disagreements.filter((d) => !d.supplementary).map((d) => d.slug)).size,
    disagreements_by_class: disagreements.filter((d) => !d.supplementary).reduce((m, d) => { m[d.classification] = (m[d.classification] || 0) + 1; return m; }, {}),
    unclassified_disagreements: unclassified,
    unseen_misses: unseenMisses.length,
    unclassified_unseen_misses: unseenUnclassified,
  },
  overall_agreement: overallAgreement,
  field_agreement: fieldAgreement,
  route_agreement_by_pair_rule: routeAgreementByRule,
  hold_normalisation_check: holdCheck,
  unseen: {
    totals_by_firmness: {
      A: { firm_matched: unseenTotals.A.firm[0], firm_total: unseenTotals.A.firm[1], soft_matched: unseenTotals.A.soft[0], soft_total: unseenTotals.A.soft[1] },
      B: { firm_matched: unseenTotals.B.firm[0], firm_total: unseenTotals.B.firm[1], soft_matched: unseenTotals.B.soft[0], soft_total: unseenTotals.B.soft[1] },
    },
    criterion: unseenCriterion,
    slots: unseenScore,
    misses: unseenMisses,
  },
  coverage_per_subtype_agreed: coverageTable,
  disagreements,
  lane_B_ambiguous_rules: B.ambiguous_rules,
  reported_ambiguity_map: CLASSIFY.reported_ambiguity_map,
  rule_gap_register: CLASSIFY.rule_gap_register,
  packet_issues: CLASSIFY.packet_issues,
  owner_questions: CLASSIFY.owner_questions,
  lane_errors: CLASSIFY.lane_errors,
};
fs.writeFileSync(path.join(__dirname, 'diff.json'), JSON.stringify(out, null, 2) + '\n');
if (process.argv.includes('--summary')) {
  console.log(JSON.stringify({ counts: out.counts, overall: out.overall_agreement, hold: { n: holdCheck.products_where_either_emits_a_level, mismatches: holdCheck.mismatches }, unseen: out.unseen.totals_by_firmness, unseen_criterion: unseenCriterion }, null, 2));
}

// ---------------------------------------------------------------------------
// --tables: print the report's full markdown tables (built from the same output object) to stdout.
// ---------------------------------------------------------------------------
function markdownTables(d) {
const v=(x)=>x&&x.T_LI&&x.T_S?`T_S ${x.T_S.inci} r${x.T_S.rank} ${x.T_S.status}; T_LI ${x.T_LI.inci} r${x.T_LI.rank} **${x.T_LI.status}**`:x===null?'—':Array.isArray(x)?(x.length?x.join(', '):'[]'):typeof x==='object'?JSON.stringify(x).replace(/"/g,''):String(x);
const esc=(s)=>String(s).replace(/\|/g,'\\|');
let o='';
o+='### T1. Field agreement (A vs B, after normalisation)\n\n| Field | All 107 | Where either lane emitted | Calibration (84) | Neg. control (15) | Unseen (8) | Disagreements |\n|---|---|---|---|---|---|---|\n';
for(const [f,x] of Object.entries(d.field_agreement)){ if(f==='tail_T_S'||f==='tail_T_LI') continue; o+=`| ${f}${f==='secondary_jobs'?' (supplementary)':''} | ${x.all.agree}/${x.all.n} (${x.all.pct} %) | ${x.all.agree_where_emitted}/${x.all.emitted_by_either} (${x.all.pct_where_emitted} %) | ${x.calibration.pct} % | ${x.negative_control.pct} % | ${x.unseen.pct} % | ${x.all.n-x.all.agree} |\n`; }
for(const f of ['tail_T_S','tail_T_LI']){const x=d.field_agreement[f]; o+=`| ↳ ${f} | ${x.all.agree}/${x.all.n} (${x.all.pct} %) | — | ${x.calibration.pct} % | ${x.negative_control.pct} % | ${x.unseen.pct} % | ${x.all.n-x.all.agree} |\n`;}
o+='\n### T2. Overall agreement (21 core fields)\n\n| Subset | Cells agree | Emitted cells agree | Records with all 21 fields equal |\n|---|---|---|---|\n';
for(const [k,x] of Object.entries(d.overall_agreement)) o+=`| ${k} (${x.records}) | ${x.cells_agree}/${x.field_cells} (${x.pct_cells} %) | ${x.emitted_cells_agree}/${x.emitted_cells} (${x.pct_emitted_cells} %) | ${x.records_all_fields_agree}/${x.records} (${x.pct_records} %) |\n`;
o+='\n### T3. Route agreement per pair rule / boundary reason\n\n| Reason (canonical) | Records (either lane) | Route agrees | Reason agrees |\n|---|---|---|---|\n';
for(const x of d.route_agreement_by_pair_rule) o+=`| ${x.reason_code} | ${x.records} | ${x.route_agree} | ${x.reason_agree} |\n`;
o+='\n### T4. Every disagreement (core fields)\n\n| # | Product | Role | Field | A | B | Class | Root cause | Right lane |\n|---|---|---|---|---|---|---|---|---|\n';
let i=0; for(const x of d.disagreements.filter(x=>!x.supplementary)){ i++; o+=`| ${i} | ${esc(x.name)} (\`${x.slug}\`) | ${x.role} | ${x.field} | ${esc(v(x.A))} | ${esc(v(x.B))} | ${x.classification} | ${x.root_cause} | ${x.right_lane||'—'} |\n`; }
o+='\n### T5. secondary_jobs disagreements (supplementary; all RG-12)\n\n| Product | A | B |\n|---|---|---|\n';
for(const x of d.disagreements.filter(x=>x.supplementary)) o+=`| ${esc(x.name)} (\`${x.slug}\`) | ${v(x.A)} | ${v(x.B)} |\n`;
o+='\n### T6. Hold levels — every product where either lane emits one\n\n| Product | Subtype | A | B | Same |\n|---|---|---|---|---|\n';
for(const h of d.hold_normalisation_check.all_rows) o+=`| ${esc(h.name)} (\`${h.slug}\`) | ${h.subtype} | ${v(h.A)} | ${v(h.B)} | ${h.same?'yes':'**no**'} |\n`;
o+='\n### T7. Unseen scoring per slot\n\n| Slot | Product | Expected route (reason) | A route/reason | B route/reason | A firm fields | B firm fields | A soft | B soft |\n|---|---|---|---|---|---|---|---|---|\n';
for(const s of d.unseen.slots){ const g=(f)=>s.fields.find(x=>x.field===f); const fm=(l,fi)=>{const xs=s.fields.filter(x=>x.firmness===fi); return `${xs.filter(x=>x[l+'_match']).length}/${xs.length}`}; o+=`| ${s.slot} | ${esc(s.name)} | ${g('route').expected} (${g('reason_code').expected}) | ${g('route').A} (${g('reason_code').A}) | ${g('route').B} (${g('reason_code').B}) | ${fm('A','firm')} | ${fm('B','firm')} | ${fm('A','soft')} | ${fm('B','soft')} |\n`; }
o+='\n### T8. Unseen misses\n\n| Slot | Product | Lane | Field | Firmness | Expected | Got | Class | Root cause |\n|---|---|---|---|---|---|---|---|---|\n';
for(const m of d.unseen.misses) o+=`| ${m.slot} | ${esc(m.name)} | ${m.lane} | ${m.field} | ${m.firmness} | ${esc(v(m.expected))} | ${esc(v(m.got))} | ${m.classification} | ${m.root_cause} |\n`;
o+='\n### T9. Coverage per subtype (A and B agree on route kind and subtype)\n\n| Subtype | Committed | Held (PH2-2) | Total | ≥ 5 committed | ≥ 5 incl. held | Disputed |\n|---|---|---|---|---|---|---|\n';
for(const c of d.coverage_per_subtype_agreed) o+=`| ${c.subtype} | ${c.committed_agreed} | ${c.held_agreed} | ${c.total_agreed} | ${c.meets_5_committed_only?'yes':'no'} | ${c.meets_5_incl_held?'yes':'no'} | ${c.disputed_slugs.join(', ')||'—'} |\n`;
return o;

}
if (process.argv.includes('--tables')) process.stdout.write(markdownTables(JSON.parse(JSON.stringify(out))));
