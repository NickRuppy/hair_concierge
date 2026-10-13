#!/usr/bin/env node
// Calibration round 4 (CONFIRMATION round under R3-L) — deterministic diff of blind lane A (Claude Opus)
// vs blind lane B (Codex) on the frozen round-4 cohort (143 records, all carried from round 3 under the same slugs),
// plus a round-3 -> round-4 comparison on the same products, a product-level check of every round-3 ruling
// (R3-Q1…Q4, R3-H, R3-H2…H5), the hold check, subtype coverage, the impact-triaged findings register (RG4-*)
// and the R3-L lock criteria, every one computed from data.
//
// Usage: node data/research/styling-inci/v1.0/round-4/diff.js [--summary] [--tables] [--dump [--core]]
// Writes round-4/diff.json only. Reads frozen inputs (lanes, r4 cohort and packets, round-3 diff.json, r3 cohort);
// never edits them. Deterministic: no clock, no randomness, fixed key order; two runs give byte-identical output.
// Generic helpers are adapted from round-3/diff.js (requiring it would rewrite round-3/diff.json).

'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const REPO = path.resolve(ROOT, '..', '..', '..', '..');
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const A = read('blind-lane-A-r4/results.json');
const B = read('blind-lane-B-r4/results.json');
const C = read('r4/cohort.json');
const R3 = read('round-3/diff.json');
const C3 = read('r3/cohort.json');

// Analyst classifications (judgment, recorded in-script so the output is reproducible).
// CLASSIFY_BEGIN
// Ruled outcomes of every round-3 owner ruling (R3-Q1…Q4, R3-H, R3-H2…H5) and the visible effects of the R3-T bundle
// (RG3 fixes, P3 patches) and of the round-3 lane errors E3-*, on the products they name, as normalised field values
// (this script's normalisation). Expected values come from the ledger and the v0.4 standard text (§4.6 registry, §11.17–§11.21, §14.1).
// Derived check fields: tli_status / ts_inci = T_LI status / T_S inci of the normalised tail markers.
const RULING_CHECKS = [
  { ruling: 'R3-Q1', slug: 'kms-thermashape-2-in-1-spray', expect: { route: 'styling', subtype: 'smoothing_styler' }, note: 'counted committed under the market-size exception (3.5)' },
  { ruling: 'R3-Q1', slug: 'color-wow-dream-coat-supernatural-spray', expect: { reason_code: 'pending_leave_in_addendum', subtype: 'smoothing_styler' }, note: 'counted held (D2-named, LI letter in_category)' },
  { ruling: 'R3-Q1', slug: 'loreal-paris-elnett-stylingspray-hitzeschutz-3-tage-glatt', expect: { reason_code: 'pending_leave_in_addendum', subtype: 'smoothing_styler' }, note: 'joins once its German directions are captured (R3-H3)' },
  { ruling: 'R3-Q2', slug: 'syoss-hitzeschutzspray-keratin-heat', expect: { route: 'heat_protectant', reason_code: '3.3' }, note: 'R3-Q2 example; pack name „KERATIN Heat HITZESCHUTZ-SPRAY" (C1) now carries it (P3-7)' },
  { ruling: 'R3-Q2', slug: 'loreal-elvital-haaroel-oel-magique-alle-haartypen', expect: { route: 'oil', reason_code: '3.1' }, note: '„Öl" reaches D2 by the letter (no registry override needed)' },
  { ruling: 'R3-Q2', slug: 'john-frieda-haarserum-frizz-ease-der-baendiger', expect: { route: 'oil', reason_code: '3.1' }, note: '„Serum" reaches D2 by the letter' },
  { ruling: 'R3-Q2', slug: 'garnier-fructis-sleek-and-stay-heat-activated-serum', expect: { route: 'oil', reason_code: '3.1' }, note: '„Serum" reaches D2 by the letter' },
  { ruling: 'R3-Q2', slug: 'taft-x-gliss-hitzeschutzspray-lovely-long', expect: { route: 'heat_protectant', promise_class: 'heat_protection' }, note: 'name „… HITZESCHUTZ-SPRAY" decides the lead (round 3 split mixed / heat_protection)' },
  { ruling: 'R3-Q2', slug: 'got2b-hitzeschutzspray-schutzengel', expect: { route: 'heat_protectant' }, note: 'type noun Hitzeschutz Spray' },
  { ruling: 'R3-H4(d)', slug: 'feschi-smooth-and-shine-anti-frizz-spray-glanzspray', expect: { reason_code: 'evidence_gate' }, note: 'retailer type nouns differ ⇒ no fallback ⇒ gate (C3 claims only)' },
  { ruling: 'R3-H4(d)', slug: 'bumble-and-bumble-surf-spray', expect: { reason_code: 'evidence_gate' }, note: 'retailer type nouns differ ⇒ no fallback' },
  { ruling: 'R3-Q3', slug: 'schwarzkopf-taft-texturspray-aloe-boost', expect: { route: 'styling', promise_class: 'styling_result', subtype: 'texture_spray', reason_code: '3.5' }, note: 'one-job name wins over the care-joined line (§11.18)' },
  { ruling: 'R3-Q4', slug: 'kms-thermashape-straightening-creme', expect: { route: 'provisional_boundary', reason_code: 'pending_leave_in_addendum', subtype: 'smoothing_styler' }, note: 'D7 straightening limb, held (§11.17); R3-H4 (e): vacuous T_LI does not block' },
  { ruling: 'R3-H', slug: 'bali-curls-strong-hold-flaxseed-gel', expect: { hold_level: 4 }, note: '„Strong Hold" 3 vs „Extra-starker Halt" 4 ⇒ 4 (§11.19)' },
  { ruling: 'R3-H2', slug: 'wella-professionals-eimi-flowing-form', expect: { reason_code: 'pending_leave_in_addendum', subtype: 'smoothing_styler' }, note: 'D7 straightening limb 3′ (Glättungscreme)' },
  { ruling: 'R3-H3', slug: 'loreal-paris-elnett-stylingspray-hitzeschutz-3-tage-glatt', expect: { route: 'provisional_boundary', reason_code: 'pending_leave_in_addendum', hold_level: 3, d8b_flags: ['claim_formula_conflict'] }, note: 'article directions pass the gate; PH1-14 route, level 3 + D8b flag (§4.6)' },
  { ruling: 'R3-H4(a)', slug: 'schwarzkopf-taft-styling-balm-locken-halt-3', expect: { hold_level: 2 }, note: 'number beats word: Taft Balm stays 2' },
  { ruling: 'R3-H4(a)', slug: 'alcina-styling-mousse-aerosol', expect: { hold_level: 2 }, note: 'keeps its round-3 level (2)' },
  { ruling: 'R3-H4(f)', slug: 'bumble-and-bumble-brilliantine', expect: { route: 'styling', subtype: 'shine_finish', reason_code: '4.6_owner_named' }, note: 'douglas.de pack photo ⇒ C1 name; still the D2-named route (no C1/C2 promise line)' },
  { ruling: 'R3-H5', slug: 'wella-eimi-texture-ocean-spritz', expect: { hold_level: 1 }, note: 'Haltegrad 2 ⇒ 1 (leicht)' },
  { ruling: 'R3-H5', slug: 'wella-eimi-sugar-lift', expect: { hold_level: 3 }, note: 'Haltegrad 3 ⇒ 3 (stark); round 3 split 3 vs null' },
  { ruling: 'R3-H5', slug: 'wella-eimi-glam-mist-shine-spray', expect: { hold_level: 1 }, note: 'Haltegrad 1 ⇒ 1; round 3 split 1 vs null' },
  { ruling: 'R3-H5', slug: 'wella-professionals-eimi-flowing-form', expect: { hold_level: 1 }, note: 'Haltegrad 2 ⇒ 1' },
  { ruling: 'R3-H5', slug: 'wella-eimi-nutricurls-curl-shaper', expect: { hold_level: 1 }, note: 'Haltestufe 2 ⇒ 1' },
  { ruling: 'RG3-1', slug: 'bali-curls-volumizing-curl-spray-refreshing', expect: { reason_code: 'pending_leave_in_addendum', subtype: 'refresher' }, note: 'two job words ⇒ C2 revival ⇒ held refresher' },
  { ruling: 'RG3-1', slug: 'wellaflex-schaumfestiger-locken-und-wellen-starker-halt', expect: { reason_code: '3.4(iii)_excluded_styling_first', primary_job: 'definition' }, note: 'curl job word ⇒ definition ⇒ 3.4 (iii)' },
  { ruling: 'RG3-1', slug: 'kevin-murphy-killer-curls', expect: { reason_code: 'pending_leave_in_addendum', subtype: 'curl_cream', primary_job: 'hold_fix' }, note: 'two job words ⇒ C2 hold line leads; D7 held' },
  { ruling: 'RG3-1', slug: 'jean-und-len-sea-salt-spray', expect: { primary_job: 'texture', subtype: 'salt_spray' }, note: 'salt noun names texture' },
  { ruling: 'RG3-1/RG3-18', slug: 'redken-wax-spray', expect: { primary_job: 'texture', subtype: 'texture_spray' }, note: 'Wax Spray names the form; wax in spray form ⇒ texture_spray' },
  { ruling: 'RG3-4', slug: 'wella-eimi-smooth-thermal-image', expect: { route: 'heat_protectant' }, note: 'lead = first sentence ⇒ heat protection (§11.20)' },
  { ruling: 'RG3-6', slug: 'schwarzkopf-taft-foehn-spray-volumen-halt-3', expect: { tli_status: 'none_visible' }, note: 'Benzyl Alcohol after Parfum is an allergen declaration ⇒ T_LI none_visible (§11.11)' },
  { ruling: 'RG3-7', slug: 'got2b-styling-paste-istyler-texture-clay', expect: { application_moment: 'dry_restyle' }, note: 'paste worked into dry hair by hand' },
  { ruling: 'RG3-7', slug: 'osis-dust-it', expect: { application_moment: 'dry_restyle' }, note: 'einarbeiten' },
  { ruling: 'RG3-7', slug: 'syoss-professional-performance-max-hold-power-wax', expect: { application_moment: 'dry_restyle' }, note: 'in den Handflächen verreiben' },
  { ruling: 'RG3-9', slug: 'kms-thermashape-2-in-1-spray', expect: { hold_level: 4 }, note: '„extra Halt" ⇒ 4' },
  { ruling: 'RG3-10', slug: 'taft-styling-paste-forming-halt-5plus', expect: { hold_level: 4 }, note: 'five-mark Henkel display, 5+ ⇒ x/5 ⇒ 4' },
  { ruling: 'RG3-11', slug: 'osis-sparkler', expect: { d8b_flags: [] }, note: 'negated hold claim does not fire D8b rule 1' },
  { ruling: 'RG3-12', slug: 'maria-nila-curlicue-cream', expect: { promise_class: 'styling_result' }, note: '„Definierende Pflegecreme" in a C2 line is not a care job' },
  { ruling: 'RG3-12', slug: 'wella-eimi-nutricurls-curl-shaper', expect: { promise_class: 'mixed', reason_code: 'pending_leave_in_addendum', subtype: 'curl_cream' }, note: 'moisture-locking = care job ⇒ mixed ⇒ D7 first ⇒ held curl_cream' },
  { ruling: 'RG3-13', slug: 'guhl-locken-pflege-und-styling-3in1', expect: { route: 'provisional_boundary', reason_code: 'mixed_promise', promise_class: 'mixed' }, note: 'R2-H2 emission named' },
  { ruling: 'RG3-14', slug: 'maria-nila-curlicue-cream', expect: { reason_code: '3.4(iii)_excluded_styling_first' }, note: 'letter reaches the registry route ⇒ the letter\'s pair rule' },
  { ruling: 'RG3-15', slug: 'john-frieda-frizz-ease-zauberformel-seiden-finish-creme', expect: { route: 'styling', subtype: 'shine_finish' }, note: 'missing spaces repaired by the freeze; gate passes' },
  { ruling: 'RG3-18', slug: 'moroccanoil-volumizing-spray', expect: { subtype: 'blowdry_lotion' }, note: 'damp volume spray ⇒ blowdry_lotion' },
  { ruling: 'RG3-18', slug: 'wella-eimi-sugar-lift', expect: { subtype: 'blowdry_lotion' }, note: 'damp volume spray ⇒ blowdry_lotion' },
  { ruling: 'RG3-20', slug: 'osis-dust-it', expect: { target_zone: 'all' }, note: '„Ansatz und Längen" ⇒ all' },
  { ruling: 'RG3-23', slug: 'balea-styling-creme-power-flex', expect: { hold_level: null }, note: 'Balea 1–7 display: no legend ⇒ words only (no strength word)' },
  { ruling: 'E3-1', slug: 'john-frieda-volume-lift-ansatz-booster', expect: { identity_status: 'inci_conflict', reason_code: 'formula_conflict' }, note: 'P3-1 moved identity_status into the identity block' },
  { ruling: 'E3-1', slug: 'kevin-murphy-powder-puff-volume', expect: { identity_status: 'inci_conflict', reason_code: 'formula_conflict' }, note: 'P3-1' },
  { ruling: 'E3-1', slug: 'cantu-shea-butter-extra-hold-edge-stay-gel', expect: { identity_status: 'inci_conflict', reason_code: 'formula_conflict' }, note: 'P3-1' },
  { ruling: 'E3-2', slug: 'moroccanoil-textur-und-volumenpuder', expect: { tli_status: 'vacuous' }, note: 'every member at or below T_LI in the clause-6 closed set' },
  { ruling: 'E3-2', slug: 'alcina-styling-mousse-aerosol', expect: { tli_status: 'vacuous' }, note: 'clause-6 closed set' },
  { ruling: 'E3-3', slug: 'loreal-paris-elvital-big-hair-day-erfrischendes-volumenspray', expect: { ts_inci: 'dimethyl phenethyl acetate' }, note: 'named aroma chemical is T_S class (b)' },
  { ruling: 'E3-4', slug: 'guhl-foehn-spray-langzeit-volumen', expect: { heat_activated: 'no' }, note: 'blind round reads F/U directions only (RG2-26)' },
  { ruling: 'E3-4', slug: 'kms-thermashape-2-in-1-spray', expect: { heat_activated: 'no' }, note: 'blind round reads F/U directions only (RG2-26)' },
  { ruling: 'E3-5', slug: 'balea-leave-in-spray-sea-salt-care-define', expect: { promise_class: 'mixed', reason_code: 'pending_leave_in_addendum' }, note: 'letter mixed, D6 ruling overrides' },
  { ruling: 'E3-6', slug: 'kevin-murphy-killer-curls', expect: { weight: 'rich', buildup_note: 'fires' }, note: 'lanolin wax is a rich member (PH2-12)' },
  { ruling: 'E3-7', slug: 'bumble-and-bumble-brilliantine', expect: { promise_class: 'not_assigned', primary_job: null }, note: 'no C1/C2 promise ⇒ class not assigned, jobs empty' },
  { ruling: 'E3-7', slug: 'color-wow-dream-coat-supernatural-spray', expect: { promise_class: 'not_assigned', primary_job: null }, note: 'no C1/C2 promise' },
  { ruling: 'E3-8', slug: 'syoss-curl-cream-gel-3in1', expect: { reason_code: '3.4(iii)_excluded_styling_first' }, note: '„Locken zu formen" ⇒ li_function yes' },
  { ruling: 'E3-9', slug: 'balea-haargel-hair-jelly', expect: { primary_job: 'hold_fix' }, note: 'one-job name decides the lead' },
  { ruling: 'E3-10', slug: 'balea-professional-glow-und-shine-finishing-spray', expect: { primary_job: 'shine' }, note: 'one-job name (shine/finish)' },
];

// Lane A's 36 findings (handback list, reconstructed item by item from the brief and lane A's per-record notes) -> register.
const LANE_A_FINDINGS = [
  { n: 1, item: 'Gate input 1 vs confirmed name (Kérastase Curl Refresh, Brilliantine, American Crew Fiber/Pomade, Redken Beach Spray, Langhaarmädchen Halt)', maps_to: 'RG4-1' },
  { n: 2, item: 'R3-Q2 shop-title fallback vs the gate (Living Proof Full Dry Volume Texture Spray)', maps_to: 'RG4-1' },
  { n: 3, item: '`inci_conflict` is not a §2.3 identity state', maps_to: 'RG4-21' },
  { n: 4, item: 'Two blocks, one boundary_reason (Cantu Edge Stay Gel: formula conflict + missing directions)', maps_to: 'RG4-21' },
  { n: 5, item: 'Registry rows keyed by sample_id cannot be matched blind', maps_to: 'RG4-2' },
  { n: 6, item: 'Stale Ansatz-Booster cohort notes (§6.7/§7.6 describe the inci_alt list)', maps_to: 'RG4-21' },
  { n: 7, item: 'li_function: §4.2 „lead promise or confirmed name" vs RG3-19 „lead promise only" (Killer.Curls)', maps_to: 'RG4-5' },
  { n: 8, item: 'Bali Flaxseed: letter (one-job hold name ⇒ 3.4 (ii), committed) vs registry/§11.19 (D6, held)', maps_to: 'RG4-5' },
  { n: 9, item: 'JF Lockencreme Traumlocken: override basis 4.1 (a) gone (C1 line captured); remaining FX-2c limb is not overridable', maps_to: 'RG4-5' },
  { n: 10, item: 'NEQI Ultimate: registry letter „same" vs §4.1 (c) override list', maps_to: 'RG4-20' },
  { n: 11, item: 'R1-Q3 vs R3-Q3 (JF Traumlocken Wellenauffrischer: one-job name + care + definition line)', maps_to: 'RG4-8' },
  { n: 12, item: '„Glow & Care" two-job name vs R3-Q3 „names that name both jobs" (Balea Finishing Spray)', maps_to: 'RG4-8' },
  { n: 13, item: 'Care-word list: Aussie „strong hair", „Nutri-", „Treatment", „Balsam-Lotion"', maps_to: 'RG4-3' },
  { n: 14, item: 'Definition word in the name as the definition half of an R1-Q3 tie (HASK „curls defining cream")', maps_to: 'RG4-22' },
  { n: 15, item: 'Lead words: „Beach Waves", „Glaze", „Big Hair Day", „Salon Blow-Out"', maps_to: 'RG4-4' },
  { n: 16, item: 'Promise lines carry no line position (first C1 pack-front line unreadable; Elnett)', maps_to: 'P4-3' },
  { n: 17, item: 'Smoothing-spray gap: fixative-led, thin conditioning (Balea Glattspray Anti-Frizz ⇒ li_g0_provisional)', maps_to: 'RG4-6' },
  { n: 18, item: '§4.5 FX-4 hold sentence vs „3.4 (ii)/3.5 routes are not held" (Barber Club Pomade, Redken Wax Spray, Taft x Gliss Shine Coat)', maps_to: 'RG4-7' },
  { n: 19, item: 'Secondaries: refill after a gate drop', maps_to: 'RG4-17' },
  { n: 20, item: 'Secondaries: claim order depends on packet order (Balea Traumlocken vs §11.2)', maps_to: 'RG4-17' },
  { n: 21, item: 'Secondaries: which claim types state a job (humidity, duration, „fixiert die Frisur")', maps_to: 'RG4-17' },
  { n: 22, item: 'Primary job when a name\'s product noun routes (Balea Glow Wax, got2b Texture Clay, Taft Gel Wax)', maps_to: 'RG4-9' },
  { n: 23, item: '„natürlicher Glanz" vs stale §11.2 (Balea Traumlocken finish)', maps_to: 'RG4-11' },
  { n: 24, item: '„POWER-SHINE-TECHNOLOGIE" as a finish/shine claim (Elnett 3 Tage Glatt)', maps_to: 'RG4-10' },
  { n: 25, item: 'Hold words „leichte Fixierung" (Balea Finishing Stick) and „fixiert die Frisur" (Balea Overnight)', maps_to: 'RG4-12' },
  { n: 26, item: 'Scale gaps: got2b six-mark display; Taft gel „Haltegrad 5" with max 5 stated', maps_to: 'RG4-16' },
  { n: 27, item: 'Subtype ties: aerosol powder (Balea Pure Volumenpuder Spray), Redken Root Tease', maps_to: 'RG4-13' },
  { n: 28, item: 'Stick stroked over dry hair: moment and zone (Balea Finishing Stick)', maps_to: 'RG4-14' },
  { n: 29, item: 'target_zone ranges („vom Ansatz … bis in die Längen", „vom Ansatz her")', maps_to: 'RG4-14' },
  { n: 30, item: 'Color Wow heat_activated blind (RG2-26 no vs §6.13 unresolved)', maps_to: 'RG4-18' },
  { n: 31, item: 'Implausible T_LI vs the PH1-13 dose rule (OSiS Curl Retouch)', maps_to: 'RG4-19' },
  { n: 32, item: 'Heat claims not typed as heat claims in the S0 packet (KMS 2-in-1, OSiS Sparkler)', maps_to: 'P4-2' },
  { n: 33, item: 'English C1 lines on the German-market pack (Aussie, HASK, Cantu ×2)', maps_to: 'RG4-23' },
  { n: 34, item: 'got2b Schutzengel claims-packet product_type_word „gel" for a pump spray', maps_to: 'P4-4' },
  { n: 35, item: 'Unplaced lexicon species (Pullulan, Algin, Trehalose, … in Moroccanoil Volumizing; Ethyl Benzoate)', maps_to: 'RG4-24' },
  { n: 36, item: 'D8b rule 2 needs a same-brand sibling the lane cannot see (Taft Haarspray Classic / Glanz)', maps_to: 'RG4-25' },
];
// Lane B ambiguous_rules, in file order -> register.
const LANE_B_MAP = ['RG4-17', 'RG4-5', 'RG4-10', 'RG4-16', 'RG4-4', 'RG4-15', 'RG4-17'];

// Impact classes: I-1 route/recommendability; I-2 user-visible value; I-3 internal/label only.
// kind: owner = a product decision the owner makes; mechanical = the fix follows from existing rulings (confirm only).
const REGISTER = [
  { id: 'RG4-1', impact: 'I-1', kind: 'owner', owner_question: 'Q1', section: '§4.1 input 1 vs §4.2 („the confirmed product name is C1/C2 positioning"; step 1) and R3-Q2',
    records: ['american-crew-fiber', 'american-crew-pomade', 'kerastase-curl-manifesto-refresh-absolu', 'langhaarmaedchen-lockenspray-halt-sprungkraft', 'redken-styling-beach-spray', 'living-proof-full-dry-volume-texture-spray'],
    issue: 'New in round 4: the r7 pack-name capture turned retailer titles into C1/C2 names, so five products now have a C1/C2 name but no C1/C2 promise line. §4.1 asks for „a C1/C2 primary promise" and does not say whether a C1/C2 name can be it. Lane A: no (gate fails). Lane B: yes (the name supplies the promise). Sub-question: can a C3 retailer-title type noun (R3-Q2) meet input 1 (Living Proof)? Both lanes: no.',
    proposed_fix: '§4.1 input 1: „a C1/C2 promise line, or a C1/C2 confirmed name whose job words name exactly one job (§4.2 step 1). A name with several job words, or none, does not meet it; a C3 retailer-title type noun (R3-Q2) never meets it. With no C1/C2 claim line the claim-keyed fields take their no-claim values + claim_authority_gap."',
    effect_if_adopted: 'American Crew Fiber ⇒ committed molding (recommendable, no hold/finish shown); Kérastase Curl Refresh ⇒ leave_in; Langhaarmädchen (name names curl + hold + Sprungkraft) stays blocked; American Crew Pomade stays blocked on its C5 directions (P4-1); Redken Beach Spray stays blocked on paraphrased directions; Living Proof stays blocked.' },
  { id: 'RG4-2', impact: 'I-1', kind: 'mechanical', owner_question: 'Q6', section: '§4.6 registry identity („every row names the sample_id it rules", RG3-3) vs blind packets',
    records: ['hask-lockencreme-curl-care', 'cantu-lockencreme-kokos', 'bali-curls-hydrating-curl-cream'],
    issue: 'Blind packets carry opaque ids, and the round-4 freeze renamed 24 products to their pack names (P3-7), so a lane can only match a registry row by brand + product. HASK is now „curls defining cream"; the row still reads „HASK Curl Care". Lane A matched it (leave_in, override 4.1 (c)); lane B did not (mixed_promise ⇒ review). Cantu Kokos and Bali Hydrating were matched by both.',
    proposed_fix: 'Every registry row also names the brand and the round-4 confirmed name (and GTIN); the S0 packet of a registry product carries an opaque `registry_row` pointer, so matching never depends on an old shop title. HASK row ⇒ „HASK curls defining cream".',
    effect_if_adopted: 'HASK ⇒ leave_in (the ruled route) in both lanes.' },
  { id: 'RG4-3', impact: 'I-1', kind: 'owner', owner_question: 'Q3', section: '§4.2 care half (R2-Q1 list: pflegt, Feuchtigkeit, repariert, entwirrt, „Pflege", „Care", „Detangling", „Feuchtigkeits-"); R1-Q3',
    records: ['aussie-leave-in-creme-work-that-curl', 'redken-one-united-all-in-one-multi-benefit-treatment', 'wella-eimi-nutricurls-fresh-up', 'wella-eimi-smooth-perfect-me'],
    issue: 'The care-word list is closed by example only. Aussie C1 „5 days of curl definition … and strong hair*": lane A reads „strong hair" as a strengthen/repair care job ⇒ care + definition ⇒ mixed ⇒ review; lane B reads it as a result phrase ⇒ leave_in. Also unsettled (both lanes agree today): „Treatment" in a name (Redken One United — without it the lead becomes heat protection, which the registry cannot override), the line prefix „Nutri-" (Wella Nutricurls), „Balsam-Lotion" in a name (Wella Smooth Perfect Me).',
    proposed_fix: 'Care half = a care verb or care noun that states a job: pflegt/Pflege/Care, Kur, Balsam, Treatment, spendet Feuchtigkeit/moisturises, nährt/nourishes, repariert/repairs, stärkt/strengthens (as a verb), entwirrt/detangles. Not the care half: a result phrase describing the hair („strong hair", „gesunde Locken", like „gepflegte Locken" under R2-Q1) and a product-line prefix („Nutri-").',
    effect_if_adopted: 'Aussie ⇒ leave_in (lane B); Redken One United stays leave_in (care via „Treatment"); the Wella records unchanged.' },
  { id: 'RG4-4', impact: 'I-1', kind: 'owner', owner_question: 'Q2', section: '§4.2 step 1 job words (RG3-1 wave nouns; R2-Q3 job nouns) vs §5 salt_spray anchor („Salz- & Beach-Spray: beachy, piecey texture"); RG2-17',
    records: ['alverde-beach-waves-spray-seaside-balance', 'syoss-glaze-topcoat', 'loreal-paris-elvital-big-hair-day-erfrischendes-volumenspray', 'john-frieda-frizz-ease-unendlich-smooth-blow-out-spray'],
    issue: 'Look names the job-word list does not place. „Beach Waves": RG3-1 makes a wave noun a curl job word (definition, li_function yes ⇒ Leave-in check ⇒ D6 ⇒ held), while §5 files beach waves under salt_spray texture. Both lanes hold alverde Beach Waves; lane A gives primary definition, lane B texture. „Glaze"/„Topcoat" (Syoss Glaze Topcoat): if a shine job noun, R3-Q3 makes the one-job name win ⇒ committed shine_finish; both lanes read no job ⇒ mixed ⇒ review. „Big Hair Day" and „Salon Blow-Out" are slogans; both lanes skip them (Elvital ⇒ dry_shampoo; JF ⇒ leave_in).',
    proposed_fix: '„Beach Waves / Strandwellen / beachy" names the salt-spray texture look ⇒ texture, li_function no (RG3-1\'s wave nouns cover curl/wave definition products — Wellen-Spray, Wellenauffrischer — not beach-look names). „Glaze", „Topcoat", „Gloss" are shine job nouns (R2-Q3 list). Slogans („Big Hair Day", „Salon Blow-Out") name no job ⇒ skipped (RG2-17).',
    effect_if_adopted: 'alverde Beach Waves ⇒ committed salt_spray via 3.4 (ii) (recommendable now instead of held); Syoss Glaze Topcoat ⇒ committed shine_finish (3.5); Elvital Big Hair Day and JF Blow-Out unchanged.' },
  { id: 'RG4-5', impact: 'I-1', kind: 'owner', owner_question: 'Q5', section: '§4.6 registry rows vs the v0.4 letter; §4.2 li_function („lead promise or confirmed name") vs RG3-19 („lead promise only"); §4.1 override limits',
    records: ['bali-curls-strong-hold-flaxseed-gel', 'kevin-murphy-killer-curls', 'john-frieda-frizz-ease-traumlocken-lockencreme'],
    issue: 'Three products the registry holds (not recommendable until the Leave-in addendum) where the v0.4 letter now says otherwise. Bali Flaxseed: one-job hold name ⇒ li_function no ⇒ 3.4 (ii) ⇒ committed gel, but the registry and §11.19 say D6, held. Killer.Curls: by RG3-19 the hold lead gives li_function no ⇒ 3.4 (ii) ⇒ committed; §4.2 also lets the name („Curls") set it ⇒ D7 ⇒ held. JF Lockencreme Traumlocken: its 4.1 (a) override basis is gone (a C1 line is now captured) and the remaining failure (FX-2c, uncorroborated acrylates) is a formula limb no ruling overrides ⇒ li_g0_provisional by the letter. Both lanes emit the registry outcome (held) on all three.',
    proposed_fix: 'Keep the three held and say why: a registry D6/D7 row rules the route itself for the record it names (a fourth §4.1 override case, „(d) a named D6/D7 border route where the v0.4 letter differs"), until the Leave-in addendum releases or re-rules them; li_function reads the lead promise only (RG3-19; delete „or confirmed name" from §4.2 except where the name is the step-1 lead).',
    effect_if_adopted: 'No output changes (both lanes already emit held); text and lanes agree.' },
  { id: 'RG4-6', impact: 'I-1', kind: 'owner', owner_question: 'Q4', section: '§4.3 3.4 (i) limb 3′ (R3-Q4: needs substantive conditioning) vs 3.4 (iii) LI G0',
    records: ['balea-glattspray-anti-frizz'],
    issue: 'A fixative-led smoothing spray with thin conditioning is reached by neither the D7 straightening limb (needs substantive conditioning) nor 3.4 (ii) (smoothing is a Leave-in function), so it lands in li_g0_provisional (review) — the gap PH2-1 accepted for Flowing Form before R3-H2. Both lanes: li_g0_provisional.',
    proposed_fix: 'Extend R3-Q4: a fixative-class polymer above T_S + a smoothing/straightening sale ⇒ Styling smoothing_styler whatever the conditioning reads; held under PH1-16 when the Leave-in letter would claim it (as Flowing Form).',
    effect_if_adopted: 'Balea Glattspray Anti-Frizz ⇒ held smoothing_styler (+1 smoothing product; still not recommendable until the addendum).' },
  { id: 'RG4-7', impact: 'I-1', kind: 'mechanical', owner_question: 'Q6', section: '§4.5 „every Styling route that rests on an FX-4 member alone where LI L5 sees none" vs „3.4 (ii)/3.5 routes are not double-claimed"',
    records: ['loreal-men-expert-barber-club-styling-pomade', 'redken-wax-spray', 'schwarzkopf-taft-x-gliss-silky-shine-shine-coat'],
    issue: 'The two §4.5 sentences disagree for an FX-4-only product routed by 3.4 (ii) or 3.5. Both lanes read „not held" (committed).',
    proposed_fix: '§4.5: the FX-4 clause applies only to routes where the Leave-in letter runs (3.4 (i)/(iii), owner-named routes); 3.4 (ii) and 3.5 routes are never held.',
    effect_if_adopted: 'No output changes (all three stay committed).' },
  { id: 'RG4-8', impact: 'I-1', kind: 'mechanical', owner_question: 'Q6', section: '§4.2 R3-Q3 („mixed stays for names that themselves name both jobs") vs R1-H1 (a two-job name decides nothing) and R1-Q3',
    records: ['balea-finishing-spray-glow-und-care', 'john-frieda-traumlocken-belebender-wellenauffrischer'],
    issue: 'Balea „Finishing Spray Glow & Care": a name joining shine and care with „&" — co-equal mixed (R3-Q3 sentence) or a two-job name that decides nothing (R1-H1, then the first C2 line, shine)? Both lanes: committed shine_finish (the R2-Q3 outcome). JF Wellenauffrischer: one-job name (refresh) but the line covers care + definition — R1-Q3 (mixed) or R3-Q3 (name wins)? Both lanes: mixed (R1-Q3 is stated as unchanged).',
    proposed_fix: '§4.2: R3-Q3\'s „names that name both jobs" means names that join care and styling as the product\'s two jobs („Pflege & Styling 2in1/3in1"); a care word beside a styling product noun („Finishing Spray Glow & Care") is a call-out. R1-Q3 (care + curl definition ⇒ mixed) wins over R3-Q3.',
    effect_if_adopted: 'No output changes.' },
  { id: 'RG4-9', impact: 'I-2', kind: 'owner', owner_question: 'Q7', section: '§4.2 RG2-21 (product noun names the job; shine/strength qualifier is not a second job) vs RG3-1 (a product noun in a compound with another product noun names the form); §6.10 RG-11',
    records: ['schwarzkopf-taft-gel-wax-glanz-halt-2', 'got2b-styling-paste-istyler-texture-clay', 'balea-haarwachs-glow-wax'],
    issue: 'Taft „Gel Wax Glanz": lane A reads „Gel Wax" as a form compound (RG3-1) ⇒ Glanz is the one job ⇒ shine_finish (and D8b rule 1 fires: hold claim on a shine_finish); lane B reads Wax as the job and Glanz as a qualifier (RG2-21) ⇒ molding, primary hold_fix. got2b „Texture Clay": lane A reads Paste/Clay as form nouns ⇒ primary texture; lane B ⇒ two jobs ⇒ the C2 line „… ultra krassem Halt" ⇒ hold_fix. Balea Glow Wax: both hold_fix.',
    proposed_fix: 'RG2-21 wins: a product noun (Wachs/Wax, Paste, Clay, Gel, Pomade, Fiber) names the job (molding/hold) and a shine or strength qualifier in the name (Glanz, Glow, Strong) is never a second job, also inside a compound; a true job word beside it (Texture, Volume, Curl) makes two jobs ⇒ the lead line decides.',
    effect_if_adopted: 'Taft Gel Wax ⇒ molding, primary hold_fix, finish glänzend kept, no D8b flag (lane B); Texture Clay ⇒ primary hold_fix, texture secondary (lane B); Glow Wax unchanged.' },
  { id: 'RG4-10', impact: 'I-2', kind: 'mechanical', section: '§6.8 finish lexicon / §6.10 secondaries vs SFS-15 (call-outs)',
    records: ['loreal-paris-elnett-stylingspray-hitzeschutz-3-tage-glatt'],
    issue: 'The r7 re-read C1 pack front begins „Elnett de Luxe | POWER-SHINE-TECHNOLOGIE | …". Lane A reads „Shine" as a §6.8 shine word ⇒ finish glänzend + shine secondary; lane B reads a technology label as no claim ⇒ unbekannt.',
    proposed_fix: '§6.8/§6.10: a technology, formula or complex label („…-Technologie", „-Formel", „-Komplex") is a call-out, never a finish word or a job (SFS-15 extended from the promise class to finish and jobs).',
    effect_if_adopted: 'Elnett 3 Tage Glatt ⇒ finish unbekannt, secondaries frizz_control only (lane B).' },
  { id: 'RG4-11', impact: 'I-2', kind: 'mechanical', section: '§11.2 worked example vs §6.8 RG-10/PH1-5',
    records: ['balea-professional-styling-cream-traumlocken'],
    issue: '§11.2 gives Balea Traumlocken finish glänzend; with the round-3 C1 line „NATÜRLICHEM GLANZ" RG-10 gives natürlich (both lanes natürlich).',
    proposed_fix: 'Update §11.2 to natürlich (glänzend + natürlicher Glanz ⇒ natürlich, RG-10) and to the round-4 claim order.',
    effect_if_adopted: 'No output changes.' },
  { id: 'RG4-12', impact: 'I-2', kind: 'mechanical', section: '§7.4 word lexicon (hold nouns); §6.10 RG3-16',
    records: ['balea-styling-finishing-stick', 'balea-overnight-wellenspray'],
    issue: '„leichte Fixierung" (Balea Finishing Stick) is read as a hold claim by analogy (both lanes level 1); no rule names „Fixierung". „fixiert die Frisur zuverlässig" (Balea Overnight) has no strength word; both lanes add hold_fix as a secondary.',
    proposed_fix: '§7.4: „Fixierung" with a strength word reads as „Halt" (leichte Fixierung ⇒ 1). §6.10: a fixing verb without a strength word („fixiert die Frisur") states hold_fix as a secondary job but sets no level.',
    effect_if_adopted: 'No output changes.' },
  { id: 'RG4-13', impact: 'I-2', kind: 'mechanical', section: '§5 tie-breaks',
    records: ['balea-pure-styling-volumenpuder-spray', 'redken-root-tease'],
    issue: 'A powder dispensed as an aerosol spray (texture_spray vs hair_powder), and a „Volumen-Haarspray" with a root-teasing step (hairspray vs texture_spray). Both lanes: texture_spray for both.',
    proposed_fix: '§5: form as applied decides — a powder sold as an aerosol spray ⇒ texture_spray; a volume/texture lead with a teasing step ⇒ texture_spray, not hairspray (the hairspray anchor needs a hold lead).',
    effect_if_adopted: 'No output changes.' },
  { id: 'RG4-14', impact: 'I-2', kind: 'mechanical', section: '§6.11 application_moment, §6.12 target_zone',
    records: ['balea-styling-finishing-stick', 'balea-styling-spray-ultra-volumen', 'john-frieda-volume-lift-pushed-up-dry-texture-spray'],
    issue: 'A stick stroked over dry, finished hair with no shaping act; „auf den feuchten Ansatz … bis in die Längen" (range or Ansatz-first?); „vom Ansatz her ins Haar sprühen" (roots or range?). Both lanes agree on each (dry_finish/surface; all; roots).',
    proposed_fix: 'Add as cases: stroking over dry hair without a shaping act ⇒ dry_finish, flyaways ⇒ surface; „Ansatz … bis in die Längen" is a range ⇒ all (RG2-10); „vom Ansatz her" with no other site ⇒ roots (RG-9).',
    effect_if_adopted: 'No output changes.' },
  { id: 'RG4-15', impact: 'I-2', kind: 'mechanical', section: '§6.6 ingredient_flags (unreadable token sets flags_incomplete)',
    records: ['balea-locken-revitalizing-spray'],
    issue: '„CITRONELLOL SODIUM CHLORIDE" (merged token) may hide a salt. §6.6 says it sets flags_incomplete + review but not the salt value: lane A salt false, lane B salt unknown (supplementary field).',
    proposed_fix: '§6.6: a token that may hide a flag sets that flag to unknown (never false) + flags_incomplete.',
    effect_if_adopted: 'salt unknown (lane B); a salt filter does not treat the product as salt-free.' },
  { id: 'RG4-16', impact: 'I-3', kind: 'mechanical', section: '§7.3 brand scales',
    records: ['got2b-spruehkleber-freeze-haarlack', 'schwarzkopf-taft-power-haargel-halt-5'],
    issue: 'got2b six-mark display (Henkel x/5 row vs the printed 1–6 row); Taft gel „Haltegrad 5" with max 5 now stated (§7.3 keeps Taft gels words-only). Both lanes 4 on both; every reading gives 4.',
    proposed_fix: '§7.3: add „got2b six-mark display ⇒ words decide (the 1–6 row gives the same level)" and „Taft gels: Haltegrad x/5 recorded, words decide".',
    effect_if_adopted: 'No value moves.' },
  { id: 'RG4-17', impact: 'I-3', kind: 'mechanical', section: '§6.10 secondaries (RG2-16 „open", RG3-16)',
    records: ['secondary_jobs disagreements (15 records)'],
    issue: 'Three open points: (1) does a later qualifying job refill a slot a formula-gate drop frees (lane B: no refill; lane A: refills); (2) claim order follows packet order, which moved between rounds; (3) which claim types state a job — humidity/duration lines with an anti-frizz word, a fixing verb without a strength word, a technology label.',
    proposed_fix: '§6.10: take the first two eligible candidates (name job words first, then C1/C2 promise lines in packet order), apply the formula gate, and refill from the next eligible candidate; humidity and duration lines never state a job, an explicit anti-frizz word in them does.',
    effect_if_adopted: 'secondary_jobs converge; nothing user-visible moves.' },
  { id: 'RG4-18', impact: 'I-3', kind: 'mechanical', section: '§6.13 heat_activated (RG2-26 blind reads F/U only vs „unresolved when activation appears only at C3/C5 (Color Wow)")',
    records: ['color-wow-dream-coat-supernatural-spray'],
    issue: 'Lane A emits the blind F/U value (no); lane B the post-unblinding value (unresolved, the §6.13 example). Round 3 both lanes wrote unresolved.',
    proposed_fix: '§6.13: the record carries the unblinded value; the blind lanes see the claims packet anyway, so they apply the raise themselves (C1/C2 activation ⇒ yes; C3/C5-only ⇒ unresolved). Drop the „blind reads F/U only" sentence.',
    effect_if_adopted: 'Color Wow unresolved (lane B); E4-2 disappears as well (lane B would then be right on Guhl, KMS 2-in-1, KMS Straightening Creme).' },
  { id: 'RG4-19', impact: 'I-3', kind: 'mechanical', section: 'LI §3.1.1 clause 5 (implausible marker) vs PH1-13 (cationics read below T_LI down to the yardstick)',
    records: ['schwarzkopf-professional-osis-curl-retouch'],
    issue: 'Phenoxyethanol r4 sits above Stearamidopropyl Dimethylamine r6 and Behentrimonium Chloride r7: lane A calls T_LI implausible, lane B plausible. Care is real either way (Cetearyl Alcohol r3 above T_LI; the cationics above the yardstick) ⇒ leave_in in both.',
    proposed_fix: 'A T_LI with cationics below it is plausible; PH1-13 already reads them. „implausible" only when the marker sits above an oil/ester/fatty-alcohol base no rule reads below T_LI.',
    effect_if_adopted: 'tail status plausible (lane B); no route moves.' },
  { id: 'RG4-20', impact: 'I-3', kind: 'mechanical', section: '§4.6 registry letter column (RG3-14) after RG3-4',
    records: ['neqi-diamond-glass-styling-spray-all', 'neqi-diamond-glass-ultimate-styling-spray'],
    issue: 'NEQI All: the registry says the letter reads mixed („Styling + Hitzeschutz in einem"); under RG3-4 the lead is the first job sentence of the first C2 line („… glatten Glass Hair-Effekt" ⇒ sleek) ⇒ styling_result ⇒ 3.4 (iii) ⇒ leave_in without an override (lane A); lane B followed the registry text (mixed, override). NEQI Ultimate: registry „same" but §4.1 (c) lists it as an override (both lanes: override).',
    proposed_fix: 'Update both NEQI rows: All ⇒ letter styling_result ⇒ 3.4 (iii) ⇒ leave_in, reason the letter\'s pair rule (RG3-14); Ultimate ⇒ the §4.1 (c) override, letter column „mixed".',
    effect_if_adopted: 'NEQI All class/reason as lane A; route leave_in either way.' },
  { id: 'RG4-21', impact: 'I-3', kind: 'mechanical', section: '§2.3 identity states, §4.0 one boundary_reason, §6.7/§7.6 cohort notes',
    records: ['john-frieda-volume-lift-ansatz-booster', 'kevin-murphy-powder-puff-volume', 'cantu-shea-butter-extra-hold-edge-stay-gel'],
    issue: 'The packets ship identity_status „inci_conflict", which §2.3 does not list (it names provisional_formula_conflict); Cantu Edge Stay Gel has two blocks (formula conflict + missing directions) but §4.0 allows one boundary_reason; §6.7/§7.6 cohort notes for the Ansatz-Booster describe its inci_alt list. Both lanes: inci_conflict, formula_conflict.',
    proposed_fix: '§2.3: add inci_conflict (packet name of the two-list state); §4.0: formula_conflict wins, the other block is listed as a trigger; §6.7/§7.6: re-derive the Ansatz-Booster notes from the list of record.',
    effect_if_adopted: 'No output changes.' },
  { id: 'RG4-22', impact: 'I-3', kind: 'mechanical', section: '§4.2 R2-Q1 (names care words in the name, not definition words)',
    records: ['hask-lockencreme-curl-care'],
    issue: 'Is a definition word in the confirmed name („curls defining cream") the definition half of an R1-Q3 tie? Both lanes: yes (mixed); the registry decides HASK anyway (RG4-2).',
    proposed_fix: '§4.2: state the symmetry — a definition word in the confirmed name is the definition half, as a care word in the name is the care half.',
    effect_if_adopted: 'No output changes.' },
  { id: 'RG4-23', impact: 'I-3', kind: 'mechanical', section: '§2.2 tiers (non_german_wording flag)',
    records: ['aussie-leave-in-creme-work-that-curl', 'hask-lockencreme-curl-care', 'cantu-shea-butter-extra-hold-edge-stay-gel', 'cantu-lockenspray-comeback-curl-next-day'],
    issue: 'English promise lines printed on the German-market pack carry non_german_wording; nothing says whether they count as C1. Both lanes: C1.',
    proposed_fix: '§2.2: text printed on the German-market pack is C1 whatever its language; non_german_wording stays a flag.',
    effect_if_adopted: 'No output changes.' },
  { id: 'RG4-24', impact: 'I-3', kind: 'mechanical', section: 'lexicon v0.4 species',
    records: ['moroccanoil-volumizing-spray', 'bali-gents-sea-salt-spray'],
    issue: 'Unplaced species above T_S: Pullulan (a film former), Algin, Trehalose, Xylitylglucoside, Anhydroxylitol, Galactoarabinan, Cinnamidopropyltrimonium Chloride; Ethyl Benzoate. Recorded E1 only; no value moves today.',
    proposed_fix: 'Lexicon v0.5: place Pullulan (NF-U), Algin (NF-U), Cinnamidopropyltrimonium Chloride (CA), the sugars as humectants, Ethyl Benzoate as FR-2.',
    effect_if_adopted: 'No value moves today.' },
  { id: 'RG4-25', impact: 'I-3', kind: 'mechanical', section: '§7.5 D8b rule 2',
    records: ['schwarzkopf-taft-haarspray-classic-halt-3', 'schwarzkopf-taft-haarspray-glanz-halt-4'],
    issue: 'Rule 2 needs a same-brand sibling with an identical INCI, which a blind lane sees only through the pair §7.5 names. Both lanes fire it on the named pair.',
    proposed_fix: '§7.5: rule 2 runs in the pipeline across records after the lanes, not per lane.',
    effect_if_adopted: 'No output changes (internal flag).' },
  { id: 'RG4-26', impact: 'I-3', kind: 'mechanical', section: '§4.2 li_function / R1-Q2 (anti-frizz on dry, finished hair is the shine-finish job)',
    records: ['bali-curls-sleek-stick-brows-and-edges'],
    issue: '„Sleek Stick Brows & Edges": lane A reads sleek as smoothing ⇒ li_function yes ⇒ 3.4 (iii) excluded_styling_first; lane B ⇒ li_function no ⇒ 3.4 (ii). Same route (committed gel) either way.',
    proposed_fix: 'R1-Q2 extended: sleeking baby hair, edges or brows on dry hair is a styling look ⇒ li_function no ⇒ 3.4 (ii).',
    effect_if_adopted: 'reason 3.4 (ii) (lane B); route unchanged.' },
  { id: 'RG4-27', impact: 'I-3', kind: 'mechanical', section: '§6.6 ingredient_flags fixative_family vs lexicon NF-U („as NF-1", RM natural_film with natural_film_unsettled)',
    records: ['balea-men-styling-powder', 'bali-curls-strong-hold-flaxseed-gel', 'bali-gents-matt-paste', 'schwarzkopf-taft-schaumfestiger-volumen-halt-4-feines-haar'],
    issue: 'Does an unsettled natural film former (NF-U: Carrageenan, unmodified starches, flax extract) put natural_film into fixative_family? NF-1 says IF natural_film; NF-U only says RM natural_film + review. Lane B adds it, lane A does not (supplementary field; result_mechanisms agree).',
    proposed_fix: 'Lexicon NF-U: „IF fixative_family: natural_film, with natural_film_unsettled" (as NF-1), so the flag follows the mechanism.',
    effect_if_adopted: 'fixative_family gains natural_film on 4 records (lane B); no route or shown value moves.' },
];

const PACKET_ISSUES = [
  { id: 'P4-1', impact: 'I-1', records: ['american-crew-pomade'], issue: 'Directions come from americancrew.com (C5, a non-German manufacturer page) yet ship as directions_status „verbatim" and count as captured in the freeze\'s evidence-gate table; the G1 hierarchy (pack → DE manufacturer → exact-GTIN DE retailer → other DE/EU retailer) does not include a C5 page.', fix: 'Freeze: count only G1-tier directions; capture German directions (pack back or a DE retailer). Matters only if RG4-1 lets the name pass the gate.' },
  { id: 'P4-2', impact: 'I-2', records: ['kms-thermashape-2-in-1-spray', 'osis-sparkler'], issue: 'Protection-from-heat lines are not typed as heat claims in the S0/claims packets (KMS 2-in-1 C2 „Reduziert Hitzeschädigungen und Haarbruch"; OSiS Sparkler C2 PDF „… vor Feuchtigkeit und Hitze bis zu 230°C schützt"). provides_heat_protection stays false (no HP-1), but §6.7 shows a C1/C2 heat claim as „Hitzeschutz laut Hersteller".', fix: 'Re-type both lines as heat_protection claims (C2).' },
  { id: 'P4-3', impact: 'I-3', records: ['loreal-paris-elnett-stylingspray-hitzeschutz-3-tage-glatt'], issue: '§4.2 says each promise line carries its position (pack front, headline, bullet); the packets carry none, so „the first C1 pack-front line" (step 2) cannot be read when a record has two C1 lines. Elnett is decided by its registry row.', fix: 'Add `position` to every promise line in S0 and claims packets.' },
  { id: 'P4-4', impact: 'I-3', records: ['got2b-hitzeschutzspray-schutzengel'], issue: 'Claims-packet product_type_word „gel" for a pump spray named „Schutz-engel Hitzeschutz Spray".', fix: 'Re-derive product_type_word from the r7 pack name (spray).' },
];

const LANE_ERRORS = [
  { id: 'E4-1', record: 'cantu-shea-butter-extra-hold-edge-stay-gel, john-frieda-volume-lift-ansatz-booster, kevin-murphy-powder-puff-volume, redken-styling-beach-spray', field: 'promise_class', wrong: 'B', right: 'A', rule: '§4.1 „S0 runs only when all three hold" + §4.7 (evidence_gate / formula_conflict emit no S0 reading): a record blocked at step 1 has no promise class. Lane B writes styling_result.', impact: 'I-3', moves_value: false },
  { id: 'E4-2', record: 'guhl-foehn-spray-langzeit-volumen, kms-thermashape-2-in-1-spray, kms-thermashape-straightening-creme', field: 'heat_activated', wrong: 'B', right: 'A', rule: 'RG2-26 / §6.13: the blind round reads the F/U directions only; claim or name activation („Föhn-Aktiv", „Hitzereaktiv", „WÄRME-AKTIVIERUNG") raises it after unblinding (§6.13 names Guhl). Persisting round-3 E3-4. The final value after unblinding is yes in both lanes.', impact: 'I-3', moves_value: false },
  { id: 'E4-3', record: 'moroccanoil-textur-und-volumenpuder', field: 'tail_markers (T_LI status)', wrong: 'A', right: 'B', rule: 'LI §3.1.1 clause 6 closed set: every member at or below T_LI Sodium Benzoate r7 (allergens, named aroma chemicals, Lavandula oil after Parfum per RG-1) ⇒ vacuous (round-3 E3-2 named this record; lane A now writes plausible).', impact: 'I-3', moves_value: false },
  { id: 'E4-4', record: 'taft-x-gliss-hitzeschutzspray-lovely-long', field: 'tail_markers (T_LI status)', wrong: 'B', right: 'A', rule: 'LI §3.1.1 clause 6 closed set: every member below T_LI Sodium Benzoate r13 is an allergen, a named aroma chemical or an essential oil after Parfum ⇒ vacuous.', impact: 'I-3', moves_value: false },
  { id: 'E4-5', record: 'redken-wax-spray', field: 'ingredient_flags (oils; supplementary)', wrong: 'B', right: 'A', rule: '§6.6 / lexicon WL-6: flags read the whole list; Glycine Soja (Soybean) Oil r12 is a WL-6 seed oil ⇒ oils true.', impact: 'I-3', moves_value: false },
];

const OWNER_QUESTIONS = [
  { id: 'Q1', rank: 1, impact: 'I-1', register: 'RG4-1', question: 'If a product\'s pack or German brand page shows only its name — no promise sentence — may the name count as the product\'s promise?',
    example: 'American Crew „FIBER": the German brand page shows only the name; the claims („starker Halt, mattes Finish") are from flaconi (C3). Lane A: blocked, not recommendable. Lane B: Styling molding, recommendable, with hold/finish shown as „keine Herstellerangabe". Same question for Kérastase „CURL MANIFESTO REFRESH ABSOLU Second day curl refreshing spray" (⇒ Leave-in).',
    counts: '5 products split today (American Crew Fiber, American Crew Pomade, Kérastase Curl Refresh, Langhaarmädchen Lockenspray Halt & Sprungkraft, Redken Beach Spray); under the recommendation 2 move (Fiber ⇒ committed molding, Kérastase ⇒ leave_in), 3 stay blocked for other reasons.',
    recommendation: 'Yes, but only when the name names exactly one job (the same test §4.2 step 1 already uses to pick the lead) and only for a C1/C2 name; a shop title never counts. Claim-keyed values stay empty. Pomade then still needs German directions (P4-1).' },
  { id: 'Q2', rank: 2, impact: 'I-1', register: 'RG4-4', question: 'Is „Beach Waves / Strandwellen" a texture look (salt spray) or curl definition? And are „Glaze"/„Topcoat" shine words?',
    example: 'alverde Beach Waves Spray (sea salt, alcohol, no polymer, no care): read as curl definition it goes through the Leave-in check and is held (not recommendable until the Leave-in addendum) — both lanes today; read as texture it is a committed salt spray, recommendable now. Syoss Glaze Topcoat: with „Glaze" a shine word it is a committed shine finisher; without, it stays in manual review (both lanes today).',
    counts: '2 products change state under the recommendation (alverde ⇒ committed salt_spray; Syoss Glaze Topcoat ⇒ committed shine_finish); 1 current A/B split (alverde primary job).',
    recommendation: 'Texture: „Beach Waves/Strandwellen/beachy" names the salt-spray look (as the §5 salt_spray anchor already says); keep the curl-word rule for Wellen-Spray/Wellenauffrischer products. Yes, Glaze/Topcoat/Gloss are shine words.' },
  { id: 'Q3', rank: 3, impact: 'I-1', register: 'RG4-3', question: 'Does a result phrase like „strong hair" count as a care promise?',
    example: 'Aussie Work That Curl Leave-In Cream, pack: „5 days of curl definition (plus 48-hour frizz protection) and strong hair*". Lane A: „strong hair" = strengthening care ⇒ care + definition ⇒ manual review. Lane B: a result phrase (like „gepflegte Locken") ⇒ Leave-in. It never becomes Styling either way.',
    counts: '1 product split (Aussie); 3 more depend on the same list but agree today (Redken One United „Treatment", Wella „Nutri-", Wella „Balsam-Lotion").',
    recommendation: 'No: only a care verb or care noun counts (pflegt/Pflege/Care, Kur, Balsam, Treatment, Feuchtigkeit, nährt, repariert, stärkt as a verb, entwirrt); result phrases and line prefixes („Nutri-") do not. Aussie ⇒ Leave-in.' },
  { id: 'Q4', rank: 4, impact: 'I-1', register: 'RG4-6', question: 'Should a smoothing spray whose main active is a hold polymer (thin care) be a Styling smoothing styler, like the two straightening creams?',
    example: 'Balea Glattspray Anti-Frizz: fixative-led, little conditioning, sold for smoothing. Today it falls between the rules and goes to manual review (both lanes).',
    counts: '1 product (held smoothing_styler under the recommendation; smoothing count 5 ⇒ 6).',
    recommendation: 'Yes, held like Wella Flowing Form — the R3-Q4 reason (a straightening product should not be recommended to curly users as a care leave-in) applies equally.' },
  { id: 'Q5', rank: 5, impact: 'I-1', register: 'RG4-5', question: 'Three products are held by an owner-registry row although the v0.4 letter would now commit one and review another. Keep them held?',
    example: 'Bali Curls Strong Hold Flaxseed Gel: the name says only „Strong Hold", so the letter commits it as a gel (recommendable now); the registry and §11.19 hold it (D6). Kevin.Murphy Killer.Curls and John Frieda Lockencreme Traumlocken are held by their D7 rows. Both lanes hold all three today.',
    counts: '3 products; no A/B split.',
    recommendation: 'Keep them held until the Leave-in addendum (conservative; the addendum is queued right after lock) and write it down: a registry D6/D7 row rules the route for the record it names; li_function reads the lead promise only.' },
  { id: 'Q6', rank: 6, impact: 'I-1', register: 'RG4-2, RG4-7, RG4-8', question: 'Confirm three text fixes that keep today\'s outcomes (no product decision).',
    example: 'HASK curls defining cream: the registry row still uses the old shop name, so lane B missed it ⇒ add brand + pack name to every registry row (HASK ⇒ Leave-in, as ruled). §4.5 FX-4 sentence ⇒ 3.4 (ii)/3.5 routes are never held (Barber Club Pomade, Redken Wax Spray, Taft x Gliss Shine Coat stay committed). R3-Q3 vs „Glow & Care"/R1-Q3 ⇒ Balea Finishing Spray Glow & Care stays committed, JF Wellenauffrischer stays in review.',
    counts: '1 split (HASK); 5 products confirmed unchanged.',
    recommendation: 'Approve as worded in RG4-2, RG4-7, RG4-8.' },
  { id: 'Q7', rank: 7, impact: 'I-2', register: 'RG4-9', question: 'Is Taft „Gel Wax Glanz" a styling wax or a shine finisher?',
    example: 'Taft Gel Wax Glanz („bietet ein glänzendes Finish mit langanhaltendem Halt", Haltegrad 2 of 5, no wax or polymer in the formula). Lane A: shine finisher (the shine word is the job; then flagged „hold claim without hold ingredient"). Lane B: wax (Modellieren) with finish „glänzend". Same rule decides got2b Texture Clay\'s main job (texture vs hold).',
    counts: '2 products split (Taft Gel Wax: subtype, main job, flag; got2b Texture Clay: main job).',
    recommendation: 'Wax: the product noun names the job and „Glanz" stays the finish (as „Haarspray Glanz" is a hairspray); finish „glänzend" is still shown. Texture Clay ⇒ main job hold.' },
];

const SMOOTHING_NOTE = 'R3-Q1 market-size exception: smoothing_styler may lock below 5. Round 4 counts 5 agreed (KMS Thermashape 2-in-1 Spray committed; Color Wow Dream Coat, Elnett 3 Tage Glatt, KMS Thermashape Straightening Creme and Wella EIMI Flowing Form held), so the exception is no longer needed for the incl.-held count; committed alone is 1. Balea Glattspray Anti-Frizz would be a sixth (held) under Q4.';

const CLASSIFY = (() => {
  // class: a = lane error (one lane misapplied a clear rule), b = rule gap / ambiguity (mechanical fix), c = data/packet issue, d = needs an owner ruling.
  const D = {};
  const set = (keys, v) => { for (const k of keys) D[k] = v; };
  const R = {};
  // ---------------- route / state splits (every cascading field shares the record's root cause) ----------------
  R['american-crew-fiber'] = { class: 'd', root_cause: 'RG4-1', owner_question: 'Q1', right: null, comment: 'C2 brand-page name „FIBER", no C1/C2 promise line (claims C3 flaconi, C5 americancrew.com). A: input 1 fails ⇒ evidence_gate. B: the name noun supplies the promise ⇒ 3.4 (ii) ⇒ committed molding (claim_authority_gap). Under the proposed fix (one-job C1/C2 name meets input 1) B is right.' };
  R['american-crew-pomade'] = { class: 'd', root_cause: 'RG4-1', owner_question: 'Q1', right: 'A (under the proposed fix, P4-1)', comment: 'C2 name „Styling Pomade"; promise C5, hold/finish C3; directions C5 (americancrew.com). A: input 1 fails (and the directions sit outside the G1 hierarchy). B: name ⇒ committed molding. Even if the name meets input 1, input 2 fails on C5 directions (P4-1) ⇒ A.' };
  R['kerastase-curl-manifesto-refresh-absolu'] = { class: 'd', root_cause: 'RG4-1', owner_question: 'Q1', right: null, comment: 'C1 pack name „CURL MANIFESTO REFRESH ABSOLU Second day curl refreshing spray" (one job: curl refresh); the only claim line is C3 (easycosmetic, calling it a Trockenshampoo). A: evidence_gate. B: name ⇒ refresh lead ⇒ 3.4 (iii) ⇒ D6 does not fire (real care) ⇒ leave_in. Under the proposed fix B is right.' };
  R['langhaarmaedchen-lockenspray-halt-sprungkraft'] = { class: 'd', root_cause: 'RG4-1', owner_question: 'Q1', right: 'A (under the proposed fix)', comment: 'C1 name „LOCKENHALT SPRAY Halt & Sprungkraft"; every claim line is dm C3. A: evidence_gate (the name names curl, hold and Sprungkraft = several jobs, R1-H1). B: name supplies jobs ⇒ D6 ⇒ held gel. Under the proposed fix (exactly one job) the name does not meet input 1 ⇒ A.' };
  R['aussie-leave-in-creme-work-that-curl'] = { class: 'd', root_cause: 'RG4-3', owner_question: 'Q3', right: 'B (under the proposed fix)', comment: 'C1 „Dive into 5 days of curl definition (plus 48-hour frizz protection) and strong hair*". A: „strong hair" = strengthen/repair care job ⇒ care + definition ⇒ mixed (R1-Q3) ⇒ D7 fails ⇒ mixed_promise. B: no care job ⇒ styling_result ⇒ 3.4 (iii) ⇒ D6 does not fire ⇒ leave_in. Negative control: Styling never claims it either way.' };
  R['hask-lockencreme-curl-care'] = { class: 'b', root_cause: 'RG4-2', right: 'A', comment: 'Letter: C1 name „curls defining cream" (definition) + C1 „MOISTURIZES & CONTROLS FRIZZ" (care) ⇒ mixed, D7 fails (both lanes). Registry row „HASK Curl Care" (D7 scope, T15) ⇒ leave_in overriding the mixed stop (§4.1 (c)). A matched the row by brand + product; B did not (the r4 freeze renamed the product, P3-7, and the blind packet has no sample_id).' };
  // ---------------- field-level ----------------
  set(['cantu-shea-butter-extra-hold-edge-stay-gel::promise_class', 'john-frieda-volume-lift-ansatz-booster::promise_class', 'kevin-murphy-powder-puff-volume::promise_class', 'redken-styling-beach-spray::promise_class'],
    { class: 'a', root_cause: 'E4-1', right: 'A', comment: 'Record blocked at step 1 (formula_conflict, or no verbatim directions for Redken). §4.1: S0 runs only when all three inputs hold; §4.7 emits no S0 reading. A: class not assigned. B: styling_result.' });
  set(['guhl-foehn-spray-langzeit-volumen::heat_activated', 'kms-thermashape-2-in-1-spray::heat_activated', 'kms-thermashape-straightening-creme::heat_activated'],
    { class: 'a', root_cause: 'E4-2', right: 'A', comment: 'Blind F/U directions give heat no activating role ⇒ no (RG2-26; §6.13 names Guhl). B raised it from the name/claims („Föhn-Aktiv", „Hitzereaktives Spray", „WÄRME-AKTIVIERUNG"), the post-unblinding value. Persisting E3-4.' });
  D['moroccanoil-textur-und-volumenpuder::tail_markers'] = { class: 'a', root_cause: 'E4-3', right: 'B', comment: 'T_LI Sodium Benzoate r7; below it only allergens, named aroma chemicals, Vanillin and Lavandula oil after Parfum ⇒ clause-6 closed set ⇒ vacuous. Lane A wrote plausible (round 3 it wrote vacuous, E3-2).' };
  D['taft-x-gliss-hitzeschutzspray-lovely-long::tail_markers'] = { class: 'a', root_cause: 'E4-4', right: 'A', comment: 'T_LI Sodium Benzoate r13; below it only aroma chemicals/allergens and Juniperus Virginiana Oil after Parfum ⇒ vacuous. Lane B wrote plausible.' };
  set(['alverde-beach-waves-spray-seaside-balance::primary_job', 'alverde-beach-waves-spray-seaside-balance::secondary_jobs'],
    { class: 'd', root_cause: 'RG4-4', owner_question: 'Q2', right: null, comment: 'Name „Beach Waves Spray": A reads „Waves" as a curl job word (RG3-1) ⇒ primary definition, texture secondary; B gives primary texture (beach look) yet holds via D6 like A. Route agrees (held salt_spray); the rule decides held vs committed.' });
  D['bali-curls-sleek-stick-brows-and-edges::reason_code'] = { class: 'b', root_cause: 'RG4-26', right: 'B (lean)', comment: '„Sleek Stick Brows & Edges": A li_function yes (sleek = smoothing) ⇒ 3.4 (iii) excluded_styling_first; B li_function no ⇒ 3.4 (ii). Committed gel either way.' };
  D['color-wow-dream-coat-supernatural-spray::heat_activated'] = { class: 'b', root_cause: 'RG4-18', right: 'A (blind letter) / B (§6.13 example)', comment: 'Blind F/U directions ⇒ no (A, RG2-26); §6.13 names Color Wow `unresolved` (activation only at C3 Douglas) — B. Round 3 both wrote unresolved.' };
  set(['got2b-styling-paste-istyler-texture-clay::primary_job', 'got2b-styling-paste-istyler-texture-clay::secondary_jobs'],
    { class: 'd', root_cause: 'RG4-9', owner_question: 'Q7', right: null, comment: 'Name „Styling Paste iStyler Texture Clay": A — Paste/Clay are form nouns ⇒ one job word Texture ⇒ primary texture; B — two jobs ⇒ C2 line „… ultra krassem Halt" ⇒ hold_fix. Subtype molding either way.' });
  set(['schwarzkopf-taft-gel-wax-glanz-halt-2::subtype', 'schwarzkopf-taft-gel-wax-glanz-halt-2::primary_job', 'schwarzkopf-taft-gel-wax-glanz-halt-2::d8b_flags', 'schwarzkopf-taft-gel-wax-glanz-halt-2::secondary_jobs'],
    { class: 'd', root_cause: 'RG4-9', owner_question: 'Q7', right: null, comment: 'Name „Gel Wax Glanz": A — „Gel Wax" names the form (RG3-1) ⇒ Glanz is the one job ⇒ shine_finish, and D8b rule 1 fires (hold claim on a shine_finish, no hold mechanism); B — Wax names the job, Glanz is a qualifier (RG2-21) ⇒ molding, primary hold_fix, shine secondary. Hold level 1 and finish glänzend agree.' });
  set(['loreal-paris-elnett-stylingspray-hitzeschutz-3-tage-glatt::finish', 'loreal-paris-elnett-stylingspray-hitzeschutz-3-tage-glatt::secondary_jobs'],
    { class: 'b', root_cause: 'RG4-10', right: 'B (lean)', comment: 'C1 pack front „Elnett de Luxe | POWER-SHINE-TECHNOLOGIE | …": A reads „Shine" ⇒ finish glänzend + shine secondary; B: a technology label is not a claim ⇒ unbekannt.' });
  set(['neqi-diamond-glass-styling-spray-all::promise_class', 'neqi-diamond-glass-styling-spray-all::reason_code'],
    { class: 'b', root_cause: 'RG4-20', right: 'A (lean)', comment: 'A: RG3-4 ⇒ lead = first job sentence of the first C2 line (glatter Glass-Hair-Effekt ⇒ sleek) ⇒ styling_result ⇒ 3.4 (iii) ⇒ leave_in, no override. B: the registry text („letter mixed") ⇒ ruled_route_override. Both leave_in.' });
  D['schwarzkopf-professional-osis-curl-retouch::tail_markers'] = { class: 'b', root_cause: 'RG4-19', right: 'B (lean)', comment: 'Phenoxyethanol r4 above the cationics r6/r7: A implausible (LI clause 5), B plausible. Leave_in either way.' };
  D['kms-thermashape-2-in-1-spray::secondary_jobs'] = { class: 'b', root_cause: 'RG4-17', right: null, comment: 'A: definition, shine dropped by the gate, no refill; B: definition + hold_fix from the masked „[CLAIM] Halt" line (RG3-16).' };
  D['bali-curls-sleek-stick-brows-and-edges::secondary_jobs'] = { class: 'b', root_cause: 'RG4-17', right: null, comment: 'A adds frizz_control (Babyhaare, RG2-7) before hold_fix; B hold_fix only.' };
  // supplementary ingredient_flags disagreements (listed separately; not in the 21 core fields)
  const F = {
    'american-crew-fiber': 'RG4-1', 'american-crew-pomade': 'RG4-1', 'langhaarmaedchen-lockenspray-halt-sprungkraft': 'RG4-1',
    'balea-locken-revitalizing-spray': 'RG4-15', 'redken-wax-spray': 'E4-5',
    'balea-men-styling-powder': 'RG4-27', 'bali-curls-strong-hold-flaxseed-gel': 'RG4-27', 'bali-gents-matt-paste': 'RG4-27', 'schwarzkopf-taft-schaumfestiger-volumen-halt-4-feines-haar': 'RG4-27',
  };
  return {
    flags: F,
    disagreements: D, by_record: R,
    default_secondary: { class: 'b', root_cause: 'RG4-17', right: null, comment: 'Secondary-job scope (refill, packet order, claim types; RG2-16 open, RG3-16).' },
    ruling_checks: RULING_CHECKS, lane_a_findings: LANE_A_FINDINGS, lane_b_map: LANE_B_MAP,
    rule_gap_register: REGISTER, packet_issues: PACKET_ISSUES, lane_errors: LANE_ERRORS, owner_questions: OWNER_QUESTIONS, smoothing_note: SMOOTHING_NOTE,
  };
})();
// CLASSIFY_END
const classifyKey = (slug, f) => CLASSIFY.disagreements[`${slug}::${f}`] || CLASSIFY.by_record[slug] || (f === 'secondary_jobs' ? CLASSIFY.default_secondary : null);

// ---------------------------------------------------------------------------
// Normalisation (round-3 rules, with the round-4 changes marked R4)
// ---------------------------------------------------------------------------
const NORMALISATION_NOTES = {
  identity_status: 'string as emitted (R4: both lanes now emit inci_conflict for the three two-list records; lane A no longer writes provisional_formula_conflict).',
  tail_markers: 'as round 3: T_S and T_LI compared as (inci lower-cased, whitespace collapsed, Parfum/Fragrance aliases folded to parfum; rank; status); T_S.alt ignored.',
  promise_class: 'as round 3: null / "unknown" -> "not_assigned".',
  route: 'string as emitted',
  reason_code: 'R4 CHANGE (both lanes changed their reason vocabulary again). Canonical reason = the pair rule or boundary reason, as in rounds 2–3. Lane A: route provisional_boundary -> boundary_reason; reason_code ruled_route_override on a non-boundary route -> 4.6_owner_named; otherwise oil -> 3.1, dry_shampoo -> 3.2, heat_protectant -> 3.3, leave_in -> 3.4(iii)_in_category (incl. water_based_serum_exception_3.4(iii)), styling -> the pair_rule (3.4(iii) -> 3.4(iii)_excluded_styling_first). Lane B: provisional_boundary -> reason_code; ruled_route_override -> 4.6_owner_named; li_g0_in_category / water_based_serum_exception -> 3.4(iii)_in_category; li_g0_excluded_styling_first -> 3.4(iii)_excluded_styling_first; no_leave_in_function -> 3.4(ii); non_aqueous -> 3.5; protection_first -> 3.3; oil_name_rule -> 3.1; refresh_oil_absorption / refresh_plus_volume_texture -> 3.2.',
  subtype: 'string or null',
  result_mechanisms: 'as round 3: sorted set of mechanism values (A {value}; B plain strings); members not compared.',
  hold_route: 'string or null',
  weight: 'string or null',
  alcohol_note: 'string or null',
  buildup_note: 'R4 CHANGE: lane A now emits a string fired / not_fired (round 3: {fired}) -> fires / does_not_fire; B string.',
  provides_heat_protection: 'A {value, trace} -> boolean; B boolean.',
  application_moment: 'primary compared (A {primary, also[]}; B string). also[] is not compared (only lane A emits it).',
  target_zone: 'string or null',
  heat_activated: 'string or null',
  hold_level: 'number, null, or "review"',
  flexibility: 'string or null',
  finish: 'string or null',
  primary_job: 'string or null ("review" kept as a value)',
  neutral_fact: 'whitespace collapsed, quotes unified, compared case-insensitively (as round 3).',
  d8b_flags: 'masked to null for a lane record without a Styling profile (route styling or reason pending_leave_in_addendum), as round 3.',
  informational_values: 'R4 CHANGE: lane A now emits a full informational formula profile (incl. provides_heat_protection, application_moment, target_zone, heat_activated) on its 41 non-Styling records marked informational_and_non_authoritative (round 3: formula values only). Every Styling field is masked to null on those records before comparison (lane B withholds them; §4.7 makes them non-authoritative). The informational values themselves are listed under RG4 as I-3.',
  secondary_jobs: 'supplementary, sorted set, masked to null for a lane record without a Styling profile (as round 3).',
  ingredient_flags: 'supplementary. R4 CHANGE: lane B emits an object again (round 3: a token list); salt "unknown" -> null on both lanes; fixative_family sorted. Token lists are still folded for robustness. Masked for records without a Styling profile.',
};

const FIELDS = [
  'identity_status', 'tail_markers', 'promise_class', 'route', 'reason_code', 'subtype',
  'result_mechanisms', 'hold_route', 'weight', 'alcohol_note', 'buildup_note',
  'provides_heat_protection', 'application_moment', 'target_zone', 'heat_activated',
  'hold_level', 'flexibility', 'finish', 'primary_job', 'neutral_fact', 'd8b_flags',
];
const SUPPLEMENTARY = ['secondary_jobs', 'ingredient_flags', 'tail_T_S', 'tail_T_LI'];
const STYLING_FIELDS = ['result_mechanisms', 'hold_route', 'weight', 'alcohol_note', 'buildup_note', 'provides_heat_protection', 'application_moment', 'target_zone', 'heat_activated', 'hold_level', 'flexibility', 'finish', 'primary_job', 'neutral_fact'];

const normStr = (s) => (s == null ? null : String(s).replace(/[“”„]/g, '"').replace(/\s+/g, ' ').trim());
const normFact = (s) => (s == null ? null : normStr(s).toLowerCase());
const normInci = (s) => {
  if (s == null) return null;
  const t = String(s).toLowerCase().replace(/\s+/g, ' ').trim();
  if (/^(parfum|fragrance)( ?\((fragrance|parfum|perfum)\))?$|^(parfum|fragrance) ?\/ ?(parfum|fragrance)$/.test(t)) return 'parfum';
  return t;
};
const marker = (m) => (m ? { inci: normInci(m.inci), rank: m.rank == null ? null : m.rank, status: m.status || null } : null);
const setOf = (arr) => (arr == null ? null : [...arr].map(String).sort());
const saltOf = (v) => (v === 'unknown' || v == null ? null : v);
const flagsObj = (f) => {
  if (f == null) return null;
  if (Array.isArray(f)) {
    const has = (k) => f.includes(k);
    return {
      silicones: has('silicones'), oils: has('oils'), fragrance: has('fragrance'),
      salt: has('salt:unknown') ? null : has('salt'), propellant: has('propellant'),
      fixative_family: setOf(f.filter((x) => x.startsWith('fixative_family:')).map((x) => x.slice('fixative_family:'.length))),
    };
  }
  return { silicones: f.silicones, oils: f.oils, fragrance: f.fragrance, salt: saltOf(f.salt), propellant: f.propellant, fixative_family: setOf(f.fixative_family || []) };
};

const PAIR = (s) => {
  const m = String(s || '').match(/3\.4\(iii\)|3\.4\(ii\)|3\.4\(i\)|3\.5|3\.3|3\.2|3\.1/);
  if (!m) return null;
  return m[0] === '3.4(iii)' ? '3.4(iii)_excluded_styling_first' : m[0];
};
function A_REASON(r) {
  if (r.route === 'provisional_boundary') return r.boundary_reason || 'boundary_unnamed';
  if (r.reason_code === 'ruled_route_override') return '4.6_owner_named';
  if (r.route === 'oil') return '3.1';
  if (r.route === 'dry_shampoo') return '3.2';
  if (r.route === 'heat_protectant') return '3.3';
  if (r.route === 'leave_in') return '3.4(iii)_in_category';
  if (r.route === 'styling') return PAIR(r.pair_rule) || 'unparsed';
  return 'unparsed';
}
function B_REASON(r) {
  switch (r.reason_code) {
    case 'li_g0_in_category': case 'water_based_serum_exception': return '3.4(iii)_in_category';
    case 'li_g0_excluded_styling_first': return '3.4(iii)_excluded_styling_first';
    case 'ruled_route_override': return '4.6_owner_named';
    case 'no_leave_in_function': return '3.4(ii)';
    case 'non_aqueous': return '3.5';
    case 'protection_first': return '3.3';
    case 'oil_name_rule': return '3.1';
    case 'refresh_oil_absorption': case 'refresh_plus_volume_texture': return '3.2';
    default: return r.reason_code;
  }
}
const hasProfileA = (r) => r.route === 'styling' || (r.route === 'provisional_boundary' && r.boundary_reason === 'pending_leave_in_addendum');
const hasProfileB = (r) => r.route === 'styling' || (r.route === 'provisional_boundary' && r.reason_code === 'pending_leave_in_addendum');
const buildupA = (b) => (b == null ? null : typeof b === 'object' ? (b.fired ? 'fires' : 'does_not_fire') : b === 'fired' ? 'fires' : b === 'not_fired' ? 'does_not_fire' : b);

function normA(r) {
  const info = r.informational_and_non_authoritative === true;
  const F = (v) => (info ? null : v);
  const prof = hasProfileA(r);
  return {
    identity_status: r.identity_status,
    tail_markers: { T_S: marker(r.tail_markers && r.tail_markers.T_S), T_LI: marker(r.tail_markers && r.tail_markers.T_LI) },
    tail_T_S: marker(r.tail_markers && r.tail_markers.T_S),
    tail_T_LI: marker(r.tail_markers && r.tail_markers.T_LI),
    promise_class: r.promise_class == null || r.promise_class === 'unknown' ? 'not_assigned' : r.promise_class,
    route: r.route,
    reason_code: A_REASON(r),
    subtype: r.subtype == null ? null : r.subtype,
    result_mechanisms: F(r.result_mechanisms == null ? null : setOf(r.result_mechanisms.map((m) => (typeof m === 'object' ? m.value : m)))),
    hold_route: F(r.hold_route == null ? null : r.hold_route),
    weight: F(r.weight == null ? null : r.weight),
    alcohol_note: F(r.alcohol_note == null ? null : (typeof r.alcohol_note === 'object' ? r.alcohol_note.value : r.alcohol_note)),
    buildup_note: F(buildupA(r.buildup_note)),
    provides_heat_protection: F(r.provides_heat_protection == null ? null : (typeof r.provides_heat_protection === 'object' ? r.provides_heat_protection.value : r.provides_heat_protection)),
    application_moment: F(r.application_moment == null ? null : (typeof r.application_moment === 'object' ? r.application_moment.primary : r.application_moment)),
    target_zone: F(r.target_zone == null ? null : r.target_zone),
    heat_activated: F(r.heat_activated == null ? null : r.heat_activated),
    hold_level: F(r.hold_level == null ? null : r.hold_level),
    flexibility: F(r.flexibility == null ? null : r.flexibility),
    finish: F(r.finish == null ? null : r.finish),
    primary_job: F(r.primary_job == null ? null : r.primary_job),
    neutral_fact: F(normFact(r.neutral_fact)),
    d8b_flags: prof ? setOf(r.d8b_flags) : null,
    secondary_jobs: prof ? setOf(r.secondary_jobs) : null,
    ingredient_flags: prof ? flagsObj(r.ingredient_flags) : null,
  };
}
function normB(r) {
  const prof = hasProfileB(r);
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
    application_moment: r.application_moment == null ? null : (typeof r.application_moment === 'object' ? r.application_moment.primary : r.application_moment),
    target_zone: r.target_zone == null ? null : r.target_zone,
    heat_activated: r.heat_activated == null ? null : r.heat_activated,
    hold_level: r.hold_level == null ? null : r.hold_level,
    flexibility: r.flexibility == null ? null : r.flexibility,
    finish: r.finish == null ? null : r.finish,
    primary_job: r.primary_job == null ? null : r.primary_job,
    neutral_fact: normFact(r.neutral_fact),
    d8b_flags: prof ? setOf(r.d8b_flags) : null,
    secondary_jobs: prof ? setOf(r.secondary_jobs) : null,
    ingredient_flags: prof ? flagsObj(r.ingredient_flags) : null,
  };
}
const same = (x, y) => JSON.stringify(x) === JSON.stringify(y);

// ---------------------------------------------------------------------------
// Join
// ---------------------------------------------------------------------------
const cohortById = new Map(C.records.map((r) => [r.sample_id, r]));
const idMap = new Map(C.id_map.map((m) => [m.sample_id, m]));
const bById = new Map(B.records.map((r) => [r.id, r]));
const aById = new Map(A.records.map((r) => [r.id, r]));
const ids = [...aById.keys()].sort((x, y) => {
  const sx = cohortById.get(x).source_slug; const sy = cohortById.get(y).source_slug;
  return sx < sy ? -1 : sx > sy ? 1 : 0;
});
const N = C.records.length;
if (ids.length !== N || B.records.length !== N || !ids.every((id) => bById.has(id) && cohortById.has(id) && idMap.has(id))) {
  throw new Error(`record sets do not join 1:1 on ${N} ids`);
}
const r3CohortById = new Map(C3.records.map((r) => [r.sample_id, r]));
const ROLES = ['calibration', 'negative_control'];
const s0Changed = new Set(C.rerun_scope.s0_packet_changed);
const claimsChanged = new Set(C.rerun_scope.claims_packet_changed);

const rows = ids.map((id) => {
  const c = cohortById.get(id);
  const m = idMap.get(id);
  const r3rec = r3CohortById.get(m.round3_sample_id);
  if (!r3rec || r3rec.source_slug !== c.source_slug) throw new Error(`r3 id map broken for ${c.source_slug}`);
  return {
    id, slug: c.source_slug, name: `${c.identity.brand} ${c.identity.product_name}`, role: c.cohort_role,
    origin: (c.history && c.history.round4 && c.history.round4.round3_origin) || null,
    round3_id: m.round3_sample_id,
    packet_changed: s0Changed.has(c.source_slug) || claimsChanged.has(c.source_slug),
    rawA: aById.get(id), rawB: bById.get(id), A: normA(aById.get(id)), B: normB(bById.get(id)),
  };
});
const bySlug = new Map(rows.map((r) => [r.slug, r]));

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
  return { n: subset.length, agree, pct: pct(agree, subset.length), emitted_by_either: emitted, agree_where_emitted: emittedAgree, pct_where_emitted: pct(emittedAgree, emitted) };
}
const SUBSETS = {
  all: () => rows,
  calibration: () => rows.filter((r) => r.role === 'calibration'),
  negative_control: () => rows.filter((r) => r.role === 'negative_control'),
  packets_changed_vs_r3: () => rows.filter((r) => r.packet_changed),
  packets_unchanged_vs_r3: () => rows.filter((r) => !r.packet_changed),
};
const fieldAgreement = {};
for (const f of [...FIELDS, ...SUPPLEMENTARY]) {
  fieldAgreement[f] = {};
  for (const [k, fn] of Object.entries(SUBSETS)) fieldAgreement[f][k] = agreementFor(fn(), f);
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
const overallAgreement = {};
for (const [k, fn] of Object.entries(SUBSETS)) overallAgreement[k] = overall(fn());

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
// State agreement: route + canonical reason + subtype (the record's state: committed / held / blocked / other route)
const stateOf = (x) => `${x.route}/${x.reason_code}/${x.subtype || '-'}`;
const kindOf = (x) => (x.route === 'styling' ? 'committed' : x.reason_code === 'pending_leave_in_addendum' ? 'held' : x.route === 'provisional_boundary' ? `blocked:${x.reason_code}` : `route:${x.route}`);
const stateAgreement = {
  route_and_reason_and_subtype: rows.filter((r) => stateOf(r.A) === stateOf(r.B)).length,
  route: rows.filter((r) => r.A.route === r.B.route).length,
  styling_state_kind: rows.filter((r) => kindOf(r.A) === kindOf(r.B)).length,
  of: rows.length,
};

// ---------------------------------------------------------------------------
// 4. Disagreement list
// ---------------------------------------------------------------------------
function rulePath(raw, field) {
  const bits = [];
  if (Array.isArray(raw.rule_path)) bits.push(raw.rule_path.join(' | ')); else if (raw.rule_path) bits.push(String(raw.rule_path));
  if (raw.pair_rule) bits.push('pair_rule: ' + raw.pair_rule);
  if (raw.reason_code) bits.push('reason_code: ' + raw.reason_code);
  if (field === 'hold_level' && raw.hold_basis) bits.push('hold_basis: ' + raw.hold_basis);
  if (raw.notes && (Array.isArray(raw.notes) ? raw.notes.length : true)) bits.push('notes: ' + (Array.isArray(raw.notes) ? raw.notes.join(' | ') : raw.notes));
  return bits.join(' || ');
}
const disagreements = [];
for (const r of rows) {
  for (const f of [...FIELDS, 'secondary_jobs']) {
    if (same(r.A[f], r.B[f])) continue;
    const cls = classifyKey(r.slug, f);
    disagreements.push({
      slug: r.slug, id: r.id, name: r.name, role: r.role, field: f,
      supplementary: f === 'secondary_jobs',
      A: r.A[f], B: r.B[f],
      A_rule_path: rulePath(r.rawA, f), B_rule_path: rulePath(r.rawB, f),
      A_path_short: [r.rawA.route, r.rawA.boundary_reason, r.rawA.pair_rule, r.rawA.reason_code].filter(Boolean).join(' · '),
      B_path_short: [r.rawB.route, r.rawB.reason_code, r.rawB.rule_path].filter(Boolean).join(' · '),
      classification: cls ? cls.class : 'UNCLASSIFIED',
      root_cause: cls ? cls.root_cause : null,
      right_lane: cls ? (cls.right || null) : null,
      comment: cls ? cls.comment : null,
    });
  }
}
const unclassified = disagreements.filter((d) => d.classification === 'UNCLASSIFIED').map((d) => `${d.slug}::${d.field}`);
const coreDis = disagreements.filter((d) => !d.supplementary);
const routeDis = coreDis.filter((d) => d.field === 'route');

if (process.argv.includes('--dump')) {
  for (const d of disagreements) {
    if (process.argv.includes('--core') && d.supplementary) continue;
    console.log(`\n### ${d.slug} [${d.role}] ${d.field}${d.supplementary ? ' (supp)' : ''} :: ${d.classification} ${d.root_cause || ''}`);
    console.log('  A =', JSON.stringify(d.A), '\n  B =', JSON.stringify(d.B));
    console.log('  A path:', d.A_path_short, '\n  B path:', d.B_path_short);
  }
}

// ---------------------------------------------------------------------------
// 2. Round 3 -> round 4 on the same 143 products (joined by slug)
// ---------------------------------------------------------------------------
const r3Dis = new Map();
for (const d of R3.disagreements) r3Dis.set(`${d.slug}::${d.field}`, d);
const r4DisKeys = new Set(disagreements.map((d) => `${d.slug}::${d.field}`));
const r3ToR4 = { gone: [], persisting: [], new_in_round4: [] };
for (const r of rows) {
  for (const f of [...FIELDS, 'secondary_jobs']) {
    const key = `${r.slug}::${f}`;
    const was = r3Dis.get(key);
    const now = r4DisKeys.has(key);
    const c4 = classifyKey(r.slug, f) || {};
    if (was && !now) r3ToR4.gone.push({ slug: r.slug, name: r.name, field: f, round3_class: was.classification, round3_root_cause: was.root_cause, round4_value: r.A[f] });
    else if (was && now) r3ToR4.persisting.push({ slug: r.slug, name: r.name, field: f, round3_class: was.classification, round3_root_cause: was.root_cause, round3_A: was.A, round3_B: was.B, round4_A: r.A[f], round4_B: r.B[f], round4_class: c4.class || null, round4_root_cause: c4.root_cause || null });
    else if (!was && now) r3ToR4.new_in_round4.push({ slug: r.slug, name: r.name, field: f, round4_A: r.A[f], round4_B: r.B[f], round4_class: c4.class || null, round4_root_cause: c4.root_cause || null });
  }
}
const core = (xs) => xs.filter((x) => x.field !== 'secondary_jobs');
const tally = (xs, k) => xs.reduce((m, x) => { const v = x[k] == null ? 'none' : x[k]; m[v] = (m[v] || 0) + 1; return m; }, {});
const sortObj = (o) => Object.fromEntries(Object.entries(o).sort((x, y) => (x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : 0)));
const recSet = (xs) => [...new Set(xs.map((x) => x.slug))].sort();
// Per-lane state of each product in round 3 vs round 4 (state = committed / held / blocked:<reason> / route:<route>, plus subtype).
const R3A = new Map(read('blind-lane-A-r3/results.json').records.map((x) => [x.id, x]));
const R3B = new Map(read('blind-lane-B-r3/results.json').records.map((x) => [x.id, x]));
const state3 = (x, lane) => {
  const reason = lane === 'A' ? x.boundary_reason : x.reason_code;
  const k = x.route === 'styling' ? 'committed' : x.route === 'provisional_boundary' ? (reason === 'pending_leave_in_addendum' ? 'held' : `blocked:${reason}`) : `route:${x.route}`;
  return `${k}${x.subtype ? '/' + x.subtype : ''}`;
};
const state4 = (x) => `${kindOf(x)}${x.subtype ? '/' + x.subtype : ''}`;
const stateChanges = [];
for (const r of rows) {
  const a3 = state3(R3A.get(r.round3_id), 'A'); const b3 = state3(R3B.get(r.round3_id), 'B');
  const a4 = state4(r.A); const b4 = state4(r.B);
  if (a3 !== a4 || b3 !== b4) stateChanges.push({ slug: r.slug, name: r.name, A_r3: a3, A_r4: a4, B_r3: b3, B_r4: b4, agreed_r3: a3 === b3, agreed_r4: a4 === b4 });
}
const round3Comparison = {
  note: 'Round-3 values come from round-3/diff.json (same 143 products, standard v0.3, round-3 packets), joined by slug. Round-4 normalisation changes (reason vocabulary, A buildup string, A informational masking extended to every Styling field, B ingredient_flags object) apply to round-4 values only. A disagreement is keyed product::field.',
  round3_overall_all_143: { cells_agree: R3.overall_agreement.all.cells_agree, field_cells: R3.overall_agreement.all.field_cells, pct_cells: R3.overall_agreement.all.pct_cells, records_all_fields_agree: R3.overall_agreement.all.records_all_fields_agree, core_disagreements: R3.counts.disagreements_core_fields, route_disagreements: R3.counts.route_disagreements, records_with_core_disagreement: R3.counts.records_with_any_core_disagreement, secondary_jobs_disagreements: R3.counts.disagreements_supplementary_secondary_jobs },
  round4_overall_all_143: overallAgreement.all,
  gone_core: core(r3ToR4.gone).length,
  persisting_core: core(r3ToR4.persisting).length,
  new_core_in_round4: core(r3ToR4.new_in_round4).length,
  gone_core_records: recSet(core(r3ToR4.gone)).length,
  persisting_core_records: recSet(core(r3ToR4.persisting)),
  new_core_records_in_round4: recSet(core(r3ToR4.new_in_round4)),
  gone_secondary_jobs: r3ToR4.gone.length - core(r3ToR4.gone).length,
  persisting_secondary_jobs: r3ToR4.persisting.length - core(r3ToR4.persisting).length,
  new_secondary_jobs: r3ToR4.new_in_round4.length - core(r3ToR4.new_in_round4).length,
  gone_by_round3_root_cause: sortObj(tally(core(r3ToR4.gone), 'round3_root_cause')),
  persisting_by_round4_root_cause: sortObj(tally(core(r3ToR4.persisting), 'round4_root_cause')),
  new_by_round4_root_cause: sortObj(tally(core(r3ToR4.new_in_round4), 'round4_root_cause')),
  state_changes: { note: 'Products whose state (committed / held / blocked:<reason> / route:<route>, with subtype) changed in at least one lane between round 3 and round 4.', count: stateChanges.length, agreed_r3: rows.filter((r) => state3(R3A.get(r.round3_id), "A") === state3(R3B.get(r.round3_id), "B")).length, agreed_r4: rows.filter((r) => state4(r.A) === state4(r.B)).length, list: stateChanges },
  persisting: r3ToR4.persisting,
  gone: r3ToR4.gone,
  new_in_round4: r3ToR4.new_in_round4,
};

// Ruling-effect check: every product a round-3 ruling, RG3 fix or E3 lane error names, both lanes' r4 values vs the ruled outcome.
const checkVal = (x, f) => (f === 'tli_status' ? (x.tail_markers.T_LI ? x.tail_markers.T_LI.status : null) : f === 'ts_inci' ? (x.tail_markers.T_S ? x.tail_markers.T_S.inci : null) : x[f]);
const rulingEffects = CLASSIFY.ruling_checks.map((rc) => {
  const r = bySlug.get(rc.slug);
  if (!r) return { ...rc, present: false };
  const fields = Object.entries(rc.expect).map(([f, want]) => {
    const a = checkVal(r.A, f); const b = checkVal(r.B, f);
    return { field: f, ruled: want, A: a, B: b, A_matches: same(a, want), B_matches: same(b, want) };
  });
  const both = fields.every((x) => x.A_matches && x.B_matches);
  const aOk = fields.every((x) => x.A_matches); const bOk = fields.every((x) => x.B_matches);
  return { ruling: rc.ruling, slug: rc.slug, name: r.name, outcome_note: rc.note, fields, effect: both ? 'intended_effect_both_lanes' : aOk ? 'lane_A_only' : bOk ? 'lane_B_only' : 'not_reached' };
});
const rulingSummary = Object.values(rulingEffects.reduce((m, x) => {
  const k = x.ruling; if (!m[k]) m[k] = { ruling: k, products: 0, both_lanes: 0, lane_A_only: 0, lane_B_only: 0, neither: 0 };
  m[k].products++; if (x.effect === 'intended_effect_both_lanes') m[k].both_lanes++; else if (x.effect === 'lane_A_only') m[k].lane_A_only++; else if (x.effect === 'lane_B_only') m[k].lane_B_only++; else m[k].neither++;
  return m;
}, {}));
const R3_RULINGS = ['R3-Q1', 'R3-Q2', 'R3-Q3', 'R3-Q4', 'R3-H', 'R3-H2', 'R3-H3', 'R3-H4(a)', 'R3-H4(d)', 'R3-H4(f)', 'R3-H5'];
const rulingTotals = {
  owner_rulings: { checks: rulingEffects.filter((x) => R3_RULINGS.includes(x.ruling)).length, both: rulingEffects.filter((x) => R3_RULINGS.includes(x.ruling) && x.effect === 'intended_effect_both_lanes').length },
  rg3_fixes_and_e3: { checks: rulingEffects.filter((x) => !R3_RULINGS.includes(x.ruling)).length, both: rulingEffects.filter((x) => !R3_RULINGS.includes(x.ruling) && x.effect === 'intended_effect_both_lanes').length },
  misses: rulingEffects.filter((x) => x.effect !== 'intended_effect_both_lanes').map((x) => `${x.ruling} ${x.slug}: ${x.effect}`),
};

// ---------------------------------------------------------------------------
// 3. Hold check (PH1-11 (c) as read by R3-H4 (c))
// ---------------------------------------------------------------------------
const holdRows = rows.filter((r) => r.A.hold_level !== null || r.B.hold_level !== null);
const holdMismatches = holdRows.filter((r) => !same(r.A.hold_level, r.B.hold_level)).map((r) => ({
  slug: r.slug, name: r.name, role: r.role, subtype_A: r.A.subtype, subtype_B: r.B.subtype,
  A: r.A.hold_level, A_basis: r.rawA.hold_basis || null, B: r.B.hold_level, B_basis: r.rawB.hold_basis || null,
  classification: (classifyKey(r.slug, 'hold_level') || {}).class || 'UNCLASSIFIED',
  root_cause: (classifyKey(r.slug, 'hold_level') || {}).root_cause || null,
}));
const holdBoth = holdRows.filter((r) => r.A.hold_level !== null && r.B.hold_level !== null);
// Records where one lane emits a hold level on a record whose route makes the other lane withhold Styling values (route splits) are listed separately.
const holdCheck = {
  products_where_either_emits_a_level: holdRows.length,
  products_where_both_emit_a_level: holdBoth.length,
  identical: holdRows.length - holdMismatches.length,
  mismatches: holdMismatches.length,
  criterion_met: holdMismatches.length === 0,
  round3: { either: R3.hold_normalisation_check.products_where_either_emits_a_level, identical: R3.hold_normalisation_check.identical, mismatches: R3.hold_normalisation_check.mismatches, mismatch_slugs: R3.hold_normalisation_check.mismatch_list.map((x) => x.slug) },
  round3_mismatches_now: R3.hold_normalisation_check.mismatch_list.map((x) => { const r = bySlug.get(x.slug); return { slug: x.slug, round3_A: x.A, round3_B: x.B, round4_A: r.A.hold_level, round4_B: r.B.hold_level, resolved: same(r.A.hold_level, r.B.hold_level) }; }),
  mismatch_list: holdMismatches,
  hold_basis_note: 'Both lanes emit hold_basis as prose or a label; bases are shown, not compared.',
  all_rows: holdRows.map((r) => ({ slug: r.slug, name: r.name, subtype: r.A.subtype || r.B.subtype, A: r.A.hold_level, B: r.B.hold_level, same: same(r.A.hold_level, r.B.hold_level), A_basis: r.rawA.hold_basis || null, B_basis: r.rawB.hold_basis || null })),
};

// ---------------------------------------------------------------------------
// 5. Coverage per subtype where A and B agree
// ---------------------------------------------------------------------------
const SUBTYPES = ['gel', 'curl_cream', 'mousse', 'blowdry_lotion', 'smoothing_styler', 'hairspray', 'shine_finish', 'salt_spray', 'texture_spray', 'hair_powder', 'molding', 'refresher'];
const coverage = {};
for (const st of SUBTYPES) coverage[st] = { committed_agreed: [], held_agreed: [], disputed: [], either_lane: [] };
for (const r of rows) {
  const aK = kindOf(r.A); const bK = kindOf(r.B);
  const prof = (k) => k === 'committed' || k === 'held';
  for (const [k, st] of [[aK, r.A.subtype], [bK, r.B.subtype]]) if (prof(k) && st && coverage[st] && !coverage[st].either_lane.includes(r.slug)) coverage[st].either_lane.push(r.slug);
  if (prof(aK) && aK === bK && r.A.subtype === r.B.subtype && r.A.subtype) coverage[r.A.subtype][aK + '_agreed'].push(r.slug);
  else for (const [k, st] of [[aK, r.A.subtype], [bK, r.B.subtype]]) if (prof(k) && st && coverage[st] && !coverage[st].disputed.includes(r.slug)) coverage[st].disputed.push(r.slug);
}
const r3Cov = new Map(R3.coverage_per_subtype_agreed.map((c) => [c.subtype, c]));
const coverageTable = SUBTYPES.map((st) => ({
  subtype: st,
  committed_agreed: coverage[st].committed_agreed.length,
  held_agreed: coverage[st].held_agreed.length,
  total_agreed: coverage[st].committed_agreed.length + coverage[st].held_agreed.length,
  round3_total_agreed: r3Cov.get(st) ? r3Cov.get(st).total_agreed : null,
  disputed: coverage[st].disputed.length,
  meets_5_committed_only: coverage[st].committed_agreed.length >= 5,
  meets_5_incl_held: coverage[st].committed_agreed.length + coverage[st].held_agreed.length >= 5,
  below_5_flag: coverage[st].committed_agreed.length + coverage[st].held_agreed.length < 5,
  committed_slugs: coverage[st].committed_agreed,
  held_slugs: coverage[st].held_agreed,
  disputed_slugs: coverage[st].disputed,
}));
const smoothing = coverageTable.find((c) => c.subtype === 'smoothing_styler');
const smoothingDetail = {
  agreed_committed: smoothing.committed_slugs, agreed_held: smoothing.held_slugs, agreed_total: smoothing.total_agreed,
  r3q1_exception_needed_incl_held: smoothing.total_agreed < 5, r3q1_exception_needed_committed_only: smoothing.committed_agreed < 5,
  analyst_note: CLASSIFY.smoothing_note,
};

// ---------------------------------------------------------------------------
// Findings register (RG4) with computed disagreement links and impact counts
// ---------------------------------------------------------------------------
const flagDis = rows.filter((r) => !same(r.A.ingredient_flags, r.B.ingredient_flags)).map((r) => ({ slug: r.slug, name: r.name, field: 'ingredient_flags', supplementary: true, A: r.A.ingredient_flags, B: r.B.ingredient_flags, root_cause: CLASSIFY.flags[r.slug] || 'UNCLASSIFIED' }));
const disByCause = [...disagreements, ...flagDis].reduce((m, d) => { (m[d.root_cause] = m[d.root_cause] || []).push(d); return m; }, {});
const nameOf = (s) => (bySlug.get(s) ? bySlug.get(s).name : s);
const aFindingsBy = (id) => CLASSIFY.lane_a_findings.filter((x) => x.maps_to === id).map((x) => `A${x.n}`);
const bFindingsBy = (id) => CLASSIFY.lane_b_map.map((m, i) => (m === id ? `B${i + 1}` : null)).filter(Boolean);
const register = CLASSIFY.rule_gap_register.map((g) => {
  const ds = disByCause[g.id] || [];
  const prods = g.records.filter((s) => bySlug.has(s));
  return {
    ...g,
    products: g.id === 'RG4-17' ? recSet(ds).map((s) => ({ slug: s, name: nameOf(s) })) : prods.map((s) => ({ slug: s, name: nameOf(s) })),
    products_count: g.id === 'RG4-17' ? recSet(ds).length : prods.length,
    causes_disagreement_now: ds.length > 0,
    disagreement_cells: ds.length,
    disagreement_records: recSet(ds),
    reported_by: [...aFindingsBy(g.id), ...bFindingsBy(g.id)],
  };
});
const packetIssues = CLASSIFY.packet_issues.map((p) => ({ ...p, causes_disagreement_now: (disByCause[p.id] || []).length > 0, reported_by: [...aFindingsBy(p.id), ...bFindingsBy(p.id)] }));
const impactCounts = ['I-1', 'I-2', 'I-3'].map((k) => ({
  impact: k,
  register_items: register.filter((g) => g.impact === k).length,
  of_which_owner_decisions: register.filter((g) => g.impact === k && g.kind === 'owner').length,
  of_which_causing_disagreement: register.filter((g) => g.impact === k && g.causes_disagreement_now).length,
  packet_issues: packetIssues.filter((p) => p.impact === k).length,
  ids: register.filter((g) => g.impact === k).map((g) => g.id),
}));
const reportedMap = [
  ...CLASSIFY.lane_a_findings.map((x) => ({ lane: 'A', n: x.n, item: x.item, maps_to: x.maps_to })),
  ...B.ambiguous_rules.map((x, i) => ({ lane: 'B', n: i + 1, item: `${x.rule}: ${x.ambiguity}`, affected: x.affected_ids.map((id) => (cohortById.get(id) || {}).source_slug || id), maps_to: CLASSIFY.lane_b_map[i] })),
];
const unmappedReported = reportedMap.filter((x) => !register.find((g) => g.id === x.maps_to) && !packetIssues.find((p) => p.id === x.maps_to)).map((x) => `${x.lane}${x.n}`);

// ---------------------------------------------------------------------------
// 6. Lock criteria (§14.1: PH1-11 as adjusted by PH1-16, R3-L, R3-Q1, R3-H4 (c)) — computed
// ---------------------------------------------------------------------------
const r3Unseen = R3.lock_criteria.find((c) => /unseen/.test(c.criterion));
const addendumCandidates = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/addendum/i.test(e.name) && /(styling|leave-?in)/i.test(p) && !/evidence/.test(p)) addendumCandidates.push(path.relative(REPO, p));
  }
})(path.join(REPO, 'docs', 'research'));
addendumCandidates.sort();
const addendumQueued = addendumCandidates.filter((p) => { const t = fs.readFileSync(path.join(REPO, p), 'utf8'); return /queued for after Styling v1\.0 lock/i.test(t) && /R3-Q4/.test(t); });
const nonLaneErrorDis = coreDis.filter((d) => d.classification !== 'a');
const newRuleGaps = register.filter((g) => g.causes_disagreement_now || g.kind === 'owner');
const exceptionApplied = coverageTable.filter((c) => c.below_5_flag && c.subtype !== 'smoothing_styler');
const lockCriteria = [
  { criterion: '(a) Every subtype ≥ 5 products (agreed; committed + held, held reported separately); smoothing_styler may lock below 5 (R3-Q1)', met: exceptionApplied.length === 0,
    numbers: `${coverageTable.filter((c) => c.meets_5_incl_held).length}/12 subtypes reach 5 incl. held; ${coverageTable.filter((c) => c.meets_5_committed_only).length}/12 reach 5 committed; short incl. held: ${coverageTable.filter((c) => c.below_5_flag).map((c) => `${c.subtype} ${c.total_agreed}`).join(', ') || 'none'}; smoothing_styler ${smoothing.committed_agreed} committed + ${smoothing.held_agreed} held (R3-Q1 exception ${smoothing.total_agreed >= 5 ? 'not needed incl. held' : 'applied'})` },
  { criterion: '(b-1) R3-L: every remaining A/B disagreement resolved — a proven lane error, or the rule gap behind it closed', met: nonLaneErrorDis.length === 0 && unclassified.length === 0,
    numbers: `${coreDis.length} core-field disagreements on ${new Set(coreDis.map((d) => d.slug)).size} records (${routeDis.length} route): ${coreDis.filter((d) => d.classification === 'a').length} lane errors (resolved), ${nonLaneErrorDis.length} open behind ${new Set(nonLaneErrorDis.map((d) => d.root_cause)).size} register items (${[...new Set(nonLaneErrorDis.map((d) => d.root_cause))].sort().join(', ')}); unclassified ${unclassified.length}` },
  { criterion: '(b-2) R3-L: the confirmation round shows only lane errors and no new rule gaps', met: nonLaneErrorDis.length === 0 && newRuleGaps.length === 0,
    numbers: `${register.length} register items were raised in round 4 (rule gaps or ambiguities, none a lane error); ${newRuleGaps.length} of them cause a disagreement now or need an owner decision (${newRuleGaps.map((g) => g.id).join(', ')}); ${register.length - newRuleGaps.length} are wording fixes on outputs both lanes already agree on; plus ${packetIssues.length} packet issues` },
  { criterion: '(c) Hold levels: every mismatch between the two claim normalisations resolved (R3-H4 (c))', met: holdCheck.mismatches === 0,
    numbers: `${holdCheck.identical}/${holdCheck.products_where_either_emits_a_level} identical (round 3: ${holdCheck.round3.identical}/${holdCheck.round3.either}); all ${holdCheck.round3.mismatches} round-3 mismatches resolved: ${holdCheck.round3_mismatches_now.every((x) => x.resolved)}` },
  { criterion: '(d) ≥ 6 unseen products incl. ≥ 2 traps (met in round 2)', met: r3Unseen.met === true,
    numbers: `not re-tested (0 unseen slots in r4/cohort.json); read from round-3/diff.json: met=${r3Unseen.met}` },
  { criterion: '(e) Leave-in addendum drafted and queued for right after lock, carrying D6, D7 and R3-Q4', met: addendumQueued.length > 0,
    numbers: addendumQueued.length ? `queued draft: ${addendumQueued.join(', ')}` : `candidates: ${addendumCandidates.join(', ') || 'none'}` },
];

// ---------------------------------------------------------------------------
// 7. Packet checks (computed from the frozen r4 packets)
// ---------------------------------------------------------------------------
const PK = path.join(ROOT, 'r4', 'packets');
const pkt = (kind, id) => JSON.parse(fs.readFileSync(path.join(PK, kind, id + '.json'), 'utf8'));
const nameOnlyGate = []; const c5Directions = []; const heatWordsUntyped = []; const ptwMismatch = [];
const HEAT_DAMAGE = /(hitzesch(ä|a)d|hitze bis|vor hitze|schützt[^.]*hitze|hitze[^.]*schützt)/i;
for (const r of rows) {
  const s0 = pkt('s0', r.id); const cl = pkt('claims', r.id);
  const tier = s0.product.confirmed_name_tier;
  if (s0.promise_claims_c1_c2.length === 0 && ['C1', 'C2', 'C2_house_brand'].includes(tier)) nameOnlyGate.push({ slug: r.slug, name_tier: tier, confirmed_name: s0.product.confirmed_name, directions_tier: s0.directions ? s0.directions.tier : null, A: `${r.A.route}/${r.A.reason_code}`, B: `${r.B.route}/${r.B.reason_code}` });
  if (s0.directions && s0.directions.tier === 'C5') c5Directions.push({ slug: r.slug, host: s0.directions.source_host, directions_status: s0.directions_status });
  const typedHeat = new Set(cl.claims.filter((c) => c.type === 'heat_protection').map((c) => c.text));
  for (const c of cl.claims) if (c.type !== 'heat_protection' && ['C1', 'C2', 'C2_house_brand'].includes(c.tier) && HEAT_DAMAGE.test(c.text) && !typedHeat.has(c.text) && s0.heat_protection_claims_c1_c2.length === 0) heatWordsUntyped.push({ slug: r.slug, type: c.type, tier: c.tier, text: c.text.slice(0, 160) });
  if (cl.product_type_word && /spray/i.test(s0.product.confirmed_name) && !s0.product.confirmed_name.toLowerCase().includes(String(cl.product_type_word).toLowerCase())) ptwMismatch.push({ slug: r.slug, product_type_word: cl.product_type_word, confirmed_name: s0.product.confirmed_name });
}
const packetChecks = {
  c1c2_name_but_no_c1c2_promise_line: { note: 'S0 packets with a C1/C2 confirmed name and no C1/C2 promise line (the RG4-1 population)', count: nameOnlyGate.length, records: nameOnlyGate },
  c5_directions: { note: 'S0 directions stamped C5 (outside the G1 hierarchy; P4-1)', count: c5Directions.length, records: c5Directions },
  untyped_heat_protection_lines: { note: 'C1/C2 claim lines with protection-from-heat wording, typed other than heat_protection, on records whose S0 heat field is empty (P4-2)', count: heatWordsUntyped.length, records: heatWordsUntyped },
  product_type_word_vs_spray_name: { note: 'claims-packet product_type_word that does not occur in a confirmed name containing „Spray" (P4-4)', count: ptwMismatch.length, records: ptwMismatch },
};

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------
const out = {
  generated_by: 'data/research/styling-inci/v1.0/round-4/diff.js',
  inputs: {
    lane_A: { file: 'blind-lane-A-r4/results.json', model: A.model, standard: A.standard, run_at: A.run_at || null },
    lane_B: { file: 'blind-lane-B-r4/results.json', model: B.model, standard: B.standard },
    cohort: { file: 'r4/cohort.json', cohort_version: C.cohort_version, frozen_on: C.frozen_on, standard_version: C.standard_version, lexicon_version: C.lexicon_version },
    round3: { file: 'round-3/diff.json', cohort: 'r3/cohort.json', lanes: ['blind-lane-A-r3/results.json', 'blind-lane-B-r3/results.json'] },
  },
  normalisation: NORMALISATION_NOTES,
  counts: {
    records: rows.length,
    by_role: Object.fromEntries(ROLES.map((role) => [role, rows.filter((r) => r.role === role).length])),
    packets_changed_vs_r3: rows.filter((r) => r.packet_changed).length,
    disagreements_core_fields: coreDis.length,
    disagreements_supplementary_secondary_jobs: disagreements.filter((d) => d.supplementary).length,
    records_with_any_core_disagreement: new Set(coreDis.map((d) => d.slug)).size,
    route_disagreements: routeDis.length,
    disagreements_by_class: sortObj(tally(coreDis, 'classification')),
    disagreements_by_root_cause: sortObj(tally(coreDis, 'root_cause')),
    records_by_root_cause: Object.fromEntries(Object.entries(coreDis.reduce((m, d) => { (m[d.root_cause] = m[d.root_cause] || new Set()).add(d.slug); return m; }, {})).map(([k, v]) => [k, [...v].sort()]).sort((x, y) => (x[0] < y[0] ? -1 : 1))),
    records_by_class: Object.fromEntries(['a', 'b', 'c', 'd'].map((k) => [k, new Set(coreDis.filter((d) => d.classification === k).map((d) => d.slug)).size])),
    route_split_records: routeDis.map((d) => ({ slug: d.slug, name: d.name, A: d.A, B: d.B, class: d.classification, root_cause: d.root_cause, right_lane: d.right_lane })),
    unclassified_disagreements: unclassified,
  },
  overall_agreement: overallAgreement,
  state_agreement: stateAgreement,
  field_agreement: fieldAgreement,
  route_agreement_by_pair_rule: routeAgreementByRule,
  round3_to_round4: round3Comparison,
  ruling_effects: { summary: rulingSummary, totals: rulingTotals, products: rulingEffects },
  hold_check: holdCheck,
  coverage_per_subtype_agreed: coverageTable,
  smoothing_styler: smoothingDetail,
  findings_register: register,
  impact_counts: impactCounts,
  owner_questions: CLASSIFY.owner_questions,
  packet_issues: packetIssues,
  lane_errors: CLASSIFY.lane_errors,
  lock_criteria: lockCriteria,
  packet_checks: packetChecks,
  reported_ambiguity_map: reportedMap,
  unmapped_reported_items: unmappedReported,
  lane_B_ambiguous_rules: B.ambiguous_rules,
  disagreements,
  ingredient_flags_disagreements: flagDis,
};
fs.writeFileSync(path.join(__dirname, 'diff.json'), JSON.stringify(out, null, 2) + '\n');

if (process.argv.includes('--summary')) {
  console.log(JSON.stringify({ counts: out.counts, overall: out.overall_agreement.all, state: stateAgreement, r3r4: Object.fromEntries(Object.entries(round3Comparison).filter(([k]) => !['persisting', 'gone', 'new_in_round4', 'state_changes'].includes(k))), state_changes: round3Comparison.state_changes.count, rulings: rulingTotals, hold: { n: holdCheck.products_where_either_emits_a_level, mismatches: holdCheck.mismatches }, coverage: coverageTable.map((c) => `${c.subtype} ${c.committed_agreed}+${c.held_agreed} (r3 ${c.round3_total_agreed}) disputed ${c.disputed}`), impact: impactCounts, lock: lockCriteria, unmapped: unmappedReported, flag_unclassified: flagDis.filter((x) => x.root_cause === 'UNCLASSIFIED').map((x) => x.slug), packet_checks: Object.fromEntries(Object.entries(packetChecks).map(([k, v]) => [k, v.count])) }, null, 2));
}

// TABLES_BEGIN
// --tables: print the report's full markdown tables (built from the same output object) to stdout.
function markdownTables(d) {
  const v = (x) => (x && typeof x === 'object' && !Array.isArray(x) && 'T_LI' in x && 'T_S' in x ? `T_S ${x.T_S ? `${x.T_S.inci} r${x.T_S.rank} ${x.T_S.status}` : '—'}; T_LI ${x.T_LI ? `${x.T_LI.inci} r${x.T_LI.rank} ${x.T_LI.status}` : '—'}` : x === null || x === undefined ? '—' : Array.isArray(x) ? (x.length ? x.join(', ') : '[]') : typeof x === 'object' ? JSON.stringify(x).replace(/"/g, '') : String(x));
  const esc = (s) => String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ');
  const fa = d.field_agreement; const n = d.counts;
  let o = '';
  o += `### T1. Field agreement (A vs B, after normalisation)\n\n| Field | All ${n.records} | Where either lane emitted | Calibration (${n.by_role.calibration}) | Neg. control (${n.by_role.negative_control}) | Packets changed vs r3 (${n.packets_changed_vs_r3}) | Packets unchanged (${n.records - n.packets_changed_vs_r3}) | Disagreements |\n|---|---|---|---|---|---|---|---|\n`;
  for (const [f, x] of Object.entries(fa)) {
    if (f === 'tail_T_S' || f === 'tail_T_LI') continue;
    const sup = ['secondary_jobs', 'ingredient_flags'].includes(f);
    o += `| ${f}${sup ? ' (supplementary)' : ''} | ${x.all.agree}/${x.all.n} (${x.all.pct} %) | ${x.all.agree_where_emitted}/${x.all.emitted_by_either} (${x.all.pct_where_emitted} %) | ${x.calibration.pct} % | ${x.negative_control.pct} % | ${x.packets_changed_vs_r3.pct} % | ${x.packets_unchanged_vs_r3.pct} % | ${x.all.n - x.all.agree} |\n`;
  }
  for (const f of ['tail_T_S', 'tail_T_LI']) { const x = fa[f]; o += `| ↳ ${f} | ${x.all.agree}/${x.all.n} (${x.all.pct} %) | — | ${x.calibration.pct} % | ${x.negative_control.pct} % | ${x.packets_changed_vs_r3.pct} % | ${x.packets_unchanged_vs_r3.pct} % | ${x.all.n - x.all.agree} |\n`; }
  o += '\n### T2. Overall agreement (21 core fields)\n\n| Subset | Cells agree | Emitted cells agree | Records with all 21 fields equal |\n|---|---|---|---|\n';
  for (const [k, x] of Object.entries(d.overall_agreement)) o += `| ${k} (${x.records}) | ${x.cells_agree}/${x.field_cells} (${x.pct_cells} %) | ${x.emitted_cells_agree}/${x.emitted_cells} (${x.pct_emitted_cells} %) | ${x.records_all_fields_agree}/${x.records} (${x.pct_records} %) |\n`;
  const r3 = d.round3_to_round4;
  o += `| round 3, same 143 products | ${r3.round3_overall_all_143.cells_agree}/${r3.round3_overall_all_143.field_cells} (${r3.round3_overall_all_143.pct_cells} %) | — | ${r3.round3_overall_all_143.records_all_fields_agree}/143 |\n`;
  o += `\nState agreement (route + canonical reason + subtype): ${d.state_agreement.route_and_reason_and_subtype}/${d.state_agreement.of}; route: ${d.state_agreement.route}/${d.state_agreement.of}; state kind (committed / held / blocked:reason / other route): ${d.state_agreement.styling_state_kind}/${d.state_agreement.of}.\n`;
  o += '\n### T3. Route agreement per pair rule / boundary reason\n\n| Reason (canonical) | Records (either lane) | Route agrees | Reason agrees |\n|---|---|---|---|\n';
  for (const x of d.route_agreement_by_pair_rule) o += `| ${x.reason_code} | ${x.records} | ${x.route_agree} | ${x.reason_agree} |\n`;
  o += '\n### T4. Every core-field disagreement\n\nRoute splits cascade into every Styling field of the record; those cells carry the record\'s root cause. Full rule paths and lane notes are in `diff.json` → `disagreements[]`.\n\n| # | Product | Field | A | B | Class | Root cause | Right lane |\n|---|---|---|---|---|---|---|---|\n';
  let i = 0;
  for (const x of d.disagreements.filter((y) => !y.supplementary)) { i++; o += `| ${i} | ${esc(x.name)} (\`${x.slug}\`) | ${x.field} | ${esc(v(x.A))} | ${esc(v(x.B))} | ${x.classification} | ${x.root_cause} | ${esc(x.right_lane || '—')} |\n`; }
  o += '\n### T5. secondary_jobs disagreements (supplementary)\n\n| Product | A | B | Root cause |\n|---|---|---|---|\n';
  for (const x of d.disagreements.filter((y) => y.supplementary)) o += `| \`${x.slug}\` | ${v(x.A)} | ${v(x.B)} | ${x.root_cause} |\n`;
  o += '\n**ingredient_flags disagreements (supplementary)**\n\n| Product | A | B | Root cause |\n|---|---|---|---|\n';
  for (const x of d.ingredient_flags_disagreements) o += `| \`${x.slug}\` | ${esc(v(x.A))} | ${esc(v(x.B))} | ${x.root_cause} |\n`;
  o += '\n### T6. Round 3 → round 4 on the same 143 products\n\n';
  o += `Round-3 core disagreements: ${r3.round3_overall_all_143.core_disagreements} on ${r3.round3_overall_all_143.records_with_core_disagreement} records. Gone in round 4: ${r3.gone_core} (on ${r3.gone_core_records} records); persisting: ${r3.persisting_core}; new: ${r3.new_core_in_round4} (on ${r3.new_core_records_in_round4.length} records). secondary_jobs: gone ${r3.gone_secondary_jobs}, persisting ${r3.persisting_secondary_jobs}, new ${r3.new_secondary_jobs}.\n\n`;
  o += '| Persisting (core) | Field | Round-3 cause | Round-4 A | Round-4 B | Round-4 cause |\n|---|---|---|---|---|---|\n';
  for (const x of r3.persisting.filter((y) => y.field !== 'secondary_jobs')) o += `| \`${x.slug}\` | ${x.field} | ${x.round3_root_cause} | ${esc(v(x.round4_A))} | ${esc(v(x.round4_B))} | ${x.round4_root_cause} |\n`;
  o += '\n| Gone: round-3 cause | Cells |\n|---|---|\n';
  for (const [k, c] of Object.entries(r3.gone_by_round3_root_cause)) o += `| ${k} | ${c} |\n`;
  o += '\n| New: round-4 cause | Cells |\n|---|---|\n';
  for (const [k, c] of Object.entries(r3.new_by_round4_root_cause)) o += `| ${k} | ${c} |\n`;
  o += `\n**State changes round 3 → round 4 (either lane), ${r3.state_changes.count} products** (agreed states: round 3 ${r3.state_changes.agreed_r3}/143, round 4 ${r3.state_changes.agreed_r4}/143):\n\n| Product | A r3 → r4 | B r3 → r4 |\n|---|---|---|\n`;
  for (const s of r3.state_changes.list) o += `| \`${s.slug}\` | ${s.A_r3} → ${s.A_r4} | ${s.B_r3} → ${s.B_r4} |\n`;
  o += `\n### T7. Did each round-3 ruling / fix reach its products? (both lanes' round-4 values vs the ruled outcome)\n\nOwner rulings: ${d.ruling_effects.totals.owner_rulings.both}/${d.ruling_effects.totals.owner_rulings.checks} product checks reached in both lanes; RG3 fixes and E3 lane errors: ${d.ruling_effects.totals.rg3_fixes_and_e3.both}/${d.ruling_effects.totals.rg3_fixes_and_e3.checks}.\n\n| Ruling | Product | Ruled | A | B | Effect |\n|---|---|---|---|---|---|\n`;
  for (const x of d.ruling_effects.products) o += `| ${x.ruling} | \`${x.slug}\` | ${esc(x.fields.map((f) => `${f.field} ${v(f.ruled)}`).join('; '))} | ${esc(x.fields.map((f) => (f.A_matches ? '✓' : v(f.A))).join('; '))} | ${esc(x.fields.map((f) => (f.B_matches ? '✓' : v(f.B))).join('; '))} | ${x.effect === 'intended_effect_both_lanes' ? 'both' : `**${x.effect.replace(/_/g, ' ')}**`} |\n`;
  o += `\n### T8. Hold levels — every product where either lane emits one (${d.hold_check.identical}/${d.hold_check.products_where_either_emits_a_level} identical)\n\n| Product | Subtype | A | B | Same |\n|---|---|---|---|---|\n`;
  for (const h of d.hold_check.all_rows) o += `| ${esc(h.name)} (\`${h.slug}\`) | ${h.subtype} | ${v(h.A)} | ${v(h.B)} | ${h.same ? 'yes' : '**no**'} |\n`;
  o += '\nRound-3 hold mismatches now:\n\n| Product | Round 3 A / B | Round 4 A / B | Resolved |\n|---|---|---|---|\n';
  for (const x of d.hold_check.round3_mismatches_now) o += `| \`${x.slug}\` | ${v(x.round3_A)} / ${v(x.round3_B)} | ${v(x.round4_A)} / ${v(x.round4_B)} | ${x.resolved ? 'yes' : '**no**'} |\n`;
  o += '\n### T9. Coverage per subtype (A and B agree on state and subtype)\n\n| Subtype | Committed | Held | Total | Round 3 total | ≥ 5 committed | ≥ 5 incl. held | Disputed |\n|---|---|---|---|---|---|---|---|\n';
  for (const c of d.coverage_per_subtype_agreed) o += `| ${c.subtype} | ${c.committed_agreed} | ${c.held_agreed} | ${c.total_agreed} | ${c.round3_total_agreed} | ${c.meets_5_committed_only ? 'yes' : '**no**'} | ${c.meets_5_incl_held ? 'yes' : '**no**'} | ${c.disputed_slugs.join(', ') || '—'} |\n`;
  o += '\n### T10. Lock criteria (§14.1), computed\n\n| Criterion | Met | Numbers |\n|---|---|---|\n';
  for (const c of d.lock_criteria) o += `| ${esc(c.criterion)} | ${c.met ? 'yes' : '**no**'} | ${esc(c.numbers)} |\n`;
  o += '\n### T11. Findings register (RG4), impact-triaged\n\n| ID | Impact | Kind | Products | Disagreement now | Reported by | Issue | Proposed fix |\n|---|---|---|---|---|---|---|---|\n';
  for (const g of d.findings_register) o += `| ${g.id} | ${g.impact} | ${g.kind} | ${g.products_count}: ${esc(g.products.map((p) => p.name).join('; '))} | ${g.causes_disagreement_now ? `yes (${g.disagreement_cells} cells)` : 'no'} | ${g.reported_by.join(', ') || 'diff'} | ${esc(g.issue)} | ${esc(g.proposed_fix)} |\n`;
  o += '\n### T12. Lane-reported items → register\n\n| Lane | # | Item | Maps to |\n|---|---|---|---|\n';
  for (const x of d.reported_ambiguity_map) o += `| ${x.lane} | ${x.n} | ${esc(x.item.length > 220 ? x.item.slice(0, 217) + '…' : x.item)}${x.affected ? ` (${x.affected.join(', ')})` : ''} | ${x.maps_to} |\n`;
  const pc = d.packet_checks;
  o += `\n### T13. Packet checks (computed)\n\n${pc.c1c2_name_but_no_c1c2_promise_line.note}: ${pc.c1c2_name_but_no_c1c2_promise_line.count}.\n\n| Product | Name tier | Name | Directions tier | A | B |\n|---|---|---|---|---|---|\n`;
  for (const x of pc.c1c2_name_but_no_c1c2_promise_line.records) o += `| \`${x.slug}\` | ${x.name_tier} | ${esc(x.confirmed_name)} | ${x.directions_tier} | ${x.A} | ${x.B} |\n`;
  o += `\n${pc.c5_directions.note}: ${pc.c5_directions.records.map((x) => `\`${x.slug}\` (${x.host}, ${x.directions_status})`).join('; ') || 'none'}.\n\n${pc.untyped_heat_protection_lines.note}:\n\n| Product | Type | Tier | Text |\n|---|---|---|---|\n`;
  for (const x of pc.untyped_heat_protection_lines.records) o += `| \`${x.slug}\` | ${x.type} | ${x.tier} | ${esc(x.text)}… |\n`;
  o += `\n${pc.product_type_word_vs_spray_name.note}: ${pc.product_type_word_vs_spray_name.records.map((x) => `\`${x.slug}\` („${x.product_type_word}" for „${x.confirmed_name}")`).join('; ') || 'none'}.\n`;
  return o;
}
if (process.argv.includes('--tables')) process.stdout.write(markdownTables(out));
// TABLES_END
