#!/usr/bin/env node
// Calibration round 3 — deterministic diff of blind lane A (Claude Opus) vs blind lane B (Codex)
// on the frozen round-3 cohort (143 records: 139 carried from round 2 + 4 new smoothing products),
// plus a round-2 -> round-3 comparison on the 139 carried records, a check of every round-2 owner
// ruling / RG2 fix on the products it names, the hold check, subtype coverage and the lock criteria.
//
// Usage: node data/research/styling-inci/v1.0/round-3/diff.js [--summary] [--tables] [--dump]
// Writes round-3/diff.json only. Reads frozen inputs (lanes, r3 cohort, round-2 diff.json, r2 cohort);
// never edits them. Deterministic: no clock, no randomness, fixed key order; two runs give byte-identical output.
// There are no unseen slots this round (r3/FREEZE-NOTES §2): the unseen criterion is read from
// round-2/diff.json (met in round 2) and is not re-tested.
// Generic helpers are adapted from round-2/diff.js (requiring it would rewrite round-2/diff.json).

'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const REPO = path.resolve(ROOT, '..', '..', '..', '..');
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const A = read('blind-lane-A-r3/results.json');
const B = read('blind-lane-B-r3/results.json');
const C = read('r3/cohort.json');
const R2 = read('round-2/diff.json');
const C2 = read('r2/cohort.json');
// Analyst classifications (judgment, recorded in-script so the output is reproducible).
// CLASSIFY_BEGIN
// Ruled outcomes of every round-2 owner ruling (R2-Q1…Q4, R2-H1…H6) and the visible effects of the R2-T bundle (RG2 fixes, P2 patches),
// on the products they name, as normalised field values (diff.js normalisation). Expected values come from the ledger and the v0.3 standard text.
const RULING_CHECKS = [
  { ruling: 'R2-Q1', slug: 'redken-refreshing-curl-mist', expect: { route: 'provisional_boundary', reason_code: 'pending_leave_in_addendum', subtype: 'refresher' }, note: 'revival is refresh ⇒ D6 ⇒ held refresher' },
  { ruling: 'R2-Q1', slug: 'balea-leave-in-spray-sea-salt-care-define', expect: { promise_class: 'mixed', reason_code: 'pending_leave_in_addendum', subtype: 'salt_spray' }, note: '„Care" in the name is a care job ⇒ letter mixed; D6 ruling ⇒ held salt_spray (§4.6)' },
  { ruling: 'R2-Q1', slug: 'moroccanoil-glaettende-creme-smoothing-lotion', expect: { promise_class: 'mixed', reason_code: 'mixed_promise' }, note: 'care job „pflegen" + „Definition" ⇒ mixed (§4.2)' },
  { ruling: 'R2-Q1', slug: 'garnier-fructis-locken-methode-feuchtigkeitsboost-pflege-spray', expect: { reason_code: 'mixed_promise' }, note: 'unchanged: Feuchtigkeitsboost/Pflege = care job ⇒ mixed' },
  { ruling: 'R2-Q1', slug: 'guhl-styling-spray-locken-pflege-und-styling-2in1', expect: { reason_code: 'mixed_promise' }, note: 'unchanged ⇒ mixed' },
  { ruling: 'R2-Q2', slug: 'balea-haarserum-anti-frizz-glatt-und-glossy', expect: { route: 'leave_in' }, note: 'serum exception reads the cationic the D6 way ⇒ 3.4(iii) ⇒ leave_in' },
  { ruling: 'R2-Q3', slug: 'osis-sparkler', expect: { route: 'styling', subtype: 'shine_finish', primary_job: 'shine' }, note: 'job nouns visible ⇒ shine lead' },
  { ruling: 'R2-Q3', slug: 'balea-finishing-spray-glow-und-care', expect: { route: 'styling', subtype: 'shine_finish' }, note: '„Finishing Spray" visible' },
  { ruling: 'R2-Q3', slug: 'schwarzkopf-taft-x-gliss-silky-shine-shine-coat', expect: { promise_class: 'styling_result', route: 'styling', subtype: 'shine_finish' }, note: 'name „Glanz-Spray … Silky Shine" visible; RG2-15' },
  { ruling: 'R2-Q3', slug: 'got2b-gotgloss-glanz-spray', expect: { route: 'styling', subtype: 'shine_finish' }, note: 'with P2-2 and RG2-15' },
  { ruling: 'R2-Q3', slug: 'balea-professional-glow-und-shine-finishing-spray', expect: { primary_job: 'shine' }, note: 'name „Glow&Shine Finishing Spray" visible ⇒ step 1 shine' },
  { ruling: 'R2-Q3', slug: 'balea-styling-finishing-stick', expect: { primary_job: 'frizz_control' }, note: 'Babyhaare ⇒ frizz_control (RG2-7)' },
  { ruling: 'R2-Q3', slug: 'wella-eimi-glam-mist-shine-spray', expect: { reason_code: '3.5', subtype: 'shine_finish' }, note: 'non-aqueous shine lead' },
  { ruling: 'R2-Q4', slug: 'neqi-diamond-glass-styling-spray-all', expect: { route: 'leave_in' }, note: 'D3 extended; released by R2-H4' },
  { ruling: 'R2-H1', slug: 'wella-eimi-nutricurls-fresh-up', expect: { route: 'leave_in' }, note: 'C2 promise lines, no care job ⇒ D6 does not fire (PQ-10 above the yardstick) ⇒ leave_in' },
  { ruling: 'R2-H2', slug: 'guhl-locken-pflege-und-styling-3in1', expect: { route: 'provisional_boundary', subtype: null }, note: 'care product, current category, no Styling profile' },
  { ruling: 'R2-H3', slug: 'balea-haarwachs-styling-stick', expect: { route: 'styling', subtype: 'molding' }, note: 'name step ⇒ molding' },
  { ruling: 'R2-H4', slug: 'neqi-diamond-glass-styling-spray-all', expect: { reason_code: '4.6_owner_named' }, note: 'INCI complete ⇒ not blocked; owner-named leave_in' },
  { ruling: 'R2-H5', slug: 'balea-professional-styling-cream-traumlocken', expect: { route: 'provisional_boundary', reason_code: 'pending_leave_in_addendum', subtype: 'curl_cream' }, note: 'D7 before the mixed stop ⇒ held curl_cream' },
  { ruling: 'R2-H6', slug: 'kevin-murphy-killer-curls', expect: { route: 'provisional_boundary', reason_code: 'pending_leave_in_addendum', subtype: 'curl_cream' }, note: 'kevinmurphy.com.au/de/de = C2 ⇒ D7 ⇒ held curl_cream' },
  { ruling: 'R2-H6', slug: 'kevin-murphy-powder-puff-volume', expect: { reason_code: 'formula_conflict' }, note: 'claims C2, but the inci_conflict still blocks (§4.1)' },
  { ruling: 'R2-H6', slug: 'evo-head-mistress-cuticle-sealer', expect: { reason_code: 'evidence_gate' }, note: 'evohair.com/us ⇒ C5 ⇒ no C1/C2 promise, no directions' },
  { ruling: 'R2-H6', slug: 'redken-one-united-all-in-one-multi-benefit-treatment', expect: { route: 'leave_in' }, note: 'redken.eu lines C2; leave-on first (RG2-20)' },
  { ruling: 'RG2-4', slug: 'syoss-professional-performance-max-hold-power-wax', expect: { primary_job: 'hold_fix' }, note: 'hold as the lead\'s subject' },
  { ruling: 'RG2-5', slug: 'syoss-curl-cream-gel-3in1', expect: { primary_job: 'definition', reason_code: '3.4(iii)_excluded_styling_first' }, note: '„Locken formen" ⇒ definition, li_function yes' },
  { ruling: 'RG2-5', slug: 'wella-eimi-nutricurls-curl-shaper', expect: { primary_job: 'definition' }, note: '„Curl Shaper" ⇒ definition' },
  { ruling: 'RG2-6', slug: 'alcina-foehn-lotion', expect: { primary_job: 'volume' }, note: 'Schwung ⇒ volume' },
  { ruling: 'RG2-7', slug: 'john-frieda-frizz-ease-zauberformel-seiden-finish-creme', expect: { primary_job: 'frizz_control' }, note: '„Glättet abstehende Haare" ⇒ frizz_control' },
  { ruling: 'RG2-8', slug: 'alverde-locken-refresh-spray', expect: { application_moment: 'dry_finish' }, note: 'strand spraying without a shaping act' },
  { ruling: 'RG2-8', slug: 'john-frieda-frizz-ease-zauberformel-seiden-finish-creme', expect: { application_moment: 'dry_finish' }, note: 'distributing on dry hair without a shaping act' },
  { ruling: 'RG2-9', slug: 'redken-powder-grip-03', expect: { application_moment: 'dry_restyle' }, note: 'shaping, no moisture state' },
  { ruling: 'RG2-9', slug: 'redken-root-tease', expect: { application_moment: 'dry_restyle' }, note: 'shaping, no moisture state' },
  { ruling: 'RG2-9', slug: 'got2b-kleber-4-brows-and-edges-2in1-stylinggel', expect: { application_moment: 'dry_restyle' }, note: 'shaping, no moisture state' },
  { ruling: 'RG2-10', slug: 'got2b-styling-puder-volumen-powderfull', expect: { target_zone: 'all' }, note: 'full-length range' },
  { ruling: 'RG2-10', slug: 'john-frieda-frizz-ease-traumlocken-lockencreme', expect: { target_zone: 'all' }, note: 'full-length range' },
  { ruling: 'RG2-10', slug: 'moroccanoil-volumizing-spray', expect: { target_zone: 'all' }, note: 'full-length range' },
  { ruling: 'RG2-10', slug: 'schwarzkopf-taft-haarpuder-volumen', expect: { target_zone: 'all' }, note: 'full-length range' },
  { ruling: 'RG2-10', slug: 'bali-curls-volumizing-curl-spray-refreshing', expect: { target_zone: 'all' }, note: 'range from the ends to the root' },
  { ruling: 'RG2-10', slug: 'john-frieda-frizz-ease-zauberformel-seiden-finish-creme', expect: { target_zone: 'all' }, note: 'emphasis inside a whole-hair instruction' },
  { ruling: 'RG2-11', slug: 'balea-styling-creme-power-flex', expect: { finish: 'natürlich' }, note: '„natürlich aussehendes Finish"' },
  { ruling: 'RG2-11', slug: 'moroccanoil-root-boost', expect: { finish: 'natürlich' }, note: '„natürlich aussehendes Finish"' },
  { ruling: 'RG2-12', slug: 'loreal-paris-elnett-haarspray-extra-starker-halt', expect: { flexibility: 'beweglich' }, note: '„Stylen, Ausbürsten, wieder Stylen"' },
  { ruling: 'RG2-12', slug: 'taft-styling-paste-forming-halt-5plus', expect: { flexibility: 'beweglich' }, note: '„Verformbare Styles"' },
  { ruling: 'RG2-13', slug: 'balea-overnight-wellenspray', expect: { route: 'styling', subtype: 'gel' }, note: 'heatless overnight setting spray ⇒ gel, not held' },
  { ruling: 'RG2-14', slug: 'syoss-curl-cream-gel-3in1', expect: { subtype: 'gel' }, note: 'form as applied' },
  { ruling: 'RG2-15', slug: 'got2b-gotgloss-glanz-spray', expect: { subtype: 'shine_finish' }, note: 'shine lead stays shine_finish before heat' },
  { ruling: 'RG2-15', slug: 'schwarzkopf-taft-x-gliss-silky-shine-shine-coat', expect: { subtype: 'shine_finish' }, note: 'shine lead stays shine_finish before heat' },
  { ruling: 'RG2-18', slug: 'redken-wax-spray', expect: { hold_level: 2 }, note: '„mittlere Kontrolle" ⇒ 2' },
  { ruling: 'RG2-18', slug: 'got2b-styling-paste-istyler-texture-clay', expect: { hold_level: 4 }, note: '„ultra krass" ⇒ 4' },
  { ruling: 'RG2-19', slug: 'osis-super-shield', expect: { route: 'heat_protectant' }, note: 'protection lead naming heat among others' },
  { ruling: 'RG2-21', slug: 'schwarzkopf-taft-haarspray-glanz-halt-4', expect: { subtype: 'hairspray' }, note: 'Haarspray is the only job noun' },
  { ruling: 'RG2-22', slug: 'wella-eimi-glam-mist-shine-spray', expect: { hold_level: 1, d8b_flags: ['claim_formula_conflict'] }, note: 'D8b fires, level kept' },
  { ruling: 'RG2-24', slug: 'jean-und-len-sea-salt-spray', expect: { route: 'styling' }, note: 'tail-only defect does not block' },
  { ruling: 'RG2-24', slug: 'balea-locken-revitalizing-spray', expect: { reason_code: 'pending_leave_in_addendum', subtype: 'refresher' }, note: 'tail-only defect does not block; D6 held refresher' },
  { ruling: 'RG2-24', slug: 'cantu-lockencreme-kokos', expect: { route: 'leave_in' }, note: 'tail-only split token repaired; registry leave_in' },
  { ruling: 'RG2-26', slug: 'guhl-foehn-spray-langzeit-volumen', expect: { heat_activated: 'no' }, note: 'blind round reads F/U directions only' },
  { ruling: 'RG2-27', slug: 'got2b-kleber-4-brows-and-edges-2in1-stylinggel', expect: { subtype: 'gel' }, note: 'hair use decides' },
  { ruling: 'RG2-27', slug: 'bali-curls-sleek-stick-brows-and-edges', expect: { subtype: 'gel' }, note: 'hair use decides' },
  { ruling: 'P2-2', slug: 'got2b-gotgloss-glanz-spray', expect: { identity_status: 'verified_with_minor_source_difference' }, note: 're-frozen identity' },
  { ruling: 'P2-5', slug: 'balea-haargel-hair-jelly', expect: { hold_level: null, neutral_fact: 'enthält stylingpolymere (z. b. pvp)' }, note: '„soft" dropped ⇒ null + neutral fact' },
];

const OLD_SENTENCES = {
  commit: '0f8af0ff (after both lanes ran)',
  sentences: [
    { id: 'OS-1', text: 'charter step 4 / standard §4.4 / property set „Claim boundary": names never route or set a subtype except D2 and D7', now: 'a name never routes on its own; its job word is promise evidence for the lead promise (§4.2 step 1, RG2-21, R2-H3)' },
    { id: 'OS-2', text: 'charter: the S0 packet has „no hold/finish/flexibility words"', now: 'grading words are masked, job nouns (Glanz, Shine, Finish, Haarspray, Wachs …) stay visible (R2-Q3)' },
    { id: 'OS-3', text: 'charter: the effective-amount test is „scoped to D6 only"', now: 'D6 and the D2 water-based-serum exception (R2-Q2)' },
  ],
  finding: 'No disagreement traces to OS-2 or OS-3 (R2-Q2: both lanes route Balea Haarserum Anti-Frizz to leave_in via the serum exception; R2-Q3: every shine product now routes the same in both lanes). OS-1 is a possible contributor on 4 records where lane B did not let a one-job confirmed name pick the lead (Balea Haargel and Balea Glow&Shine primary job, Redken Wax Spray subtype, Taft Texturspray Aloe Boost route). Lane B never cites the sentence, so this is inferred from the direction of the split; in each case the post-fix text supports lane A, except Redken Wax Spray where the form question (RG3-1) is open.',
};

const LANE_A_AMBIGUITIES = [
  'einarbeiten vs RG2-8 shaping acts (§11.2)', 'D2 when the Öl/Serum name is C3-only', 'registry matched by name only (taft x Gliss Lovely Long)',
  'P2-5 hold words without a claim line (Sugar Lift, Glam Mist)', 'two disagreeing C1/C2 strength words on one source (Bali Flaxseed)',
  'name step vs the „Textur und Pflege" mixed example', '§5 subtype gaps (damp volume sprays without blow-dry, Redken Wax Spray, Root Tease, Bali Volumizing Curl Spray)',
  'a later line overlapping a Leave-in function decides held vs not', 'LI §2.3.2 clauses / T15 „thin"',
  'unlisted lexicon species (Bis-Isobutyl PEG/PPG-20/35/Amodimethicone; WL-7 emollients; Polyurethane-34/-48; AMP-Acrylates/Allyl Methacrylate; Acrylic Acid/VP Crosspolymer)',
  'RG-9 vs RG2-10 „Ansatz und Längen"', 'secondary-job scope', 'D7 limb 3 „Curl Shaper (Defining Gel Cream)"', 'Benzyl Alcohol after Parfum §11.11 vs LI T17',
  'INCI count mismatches without a defect rank', 'Elnett 3 Tage Glatt has no directions', 'Taft Paste 5+ display reading', 'Color Wow heat_activated in the blind round',
];

const REPORTED_MAP = [
  { lane: 'A', item: 'einarbeiten vs RG2-8 shaping acts (§11.2)', maps_to: 'RG3-7' },
  { lane: 'A', item: 'D2 when the Öl/Serum name is C3-only', maps_to: 'RG3-3 (Q2)' },
  { lane: 'A', item: 'registry matched by name only (taft x Gliss Lovely Long)', maps_to: 'RG3-3 (Q2), sub-item registry identity' },
  { lane: 'A', item: 'P2-5 hold words without a claim line (Sugar Lift, Glam Mist)', maps_to: 'P3-2' },
  { lane: 'A', item: 'two disagreeing C1/C2 strength words on one source (Bali Flaxseed)', maps_to: 'RG3-8' },
  { lane: 'A', item: 'name step vs „Textur und Pflege" mixed example', maps_to: 'RG3-2 (Q3)' },
  { lane: 'A', item: '§5 subtype gaps (damp volume sprays, Redken Wax Spray, Root Tease, Bali Volumizing)', maps_to: 'RG3-18 + RG3-1' },
  { lane: 'A', item: 'later line overlapping LI function decides held vs not', maps_to: 'RG3-19' },
  { lane: 'A', item: 'LI §2.3.2 clauses / T15 „thin"', maps_to: 'RG3-5 (Q4)' },
  { lane: 'A', item: 'unlisted lexicon species', maps_to: 'RG3-17' },
  { lane: 'A', item: 'RG-9 vs RG2-10 „Ansatz und Längen"', maps_to: 'RG3-20' },
  { lane: 'A', item: 'secondary-job scope', maps_to: 'RG3-16' },
  { lane: 'A', item: 'D7 limb 3 „Curl Shaper (Defining Gel Cream)"', maps_to: 'RG3-21' },
  { lane: 'A', item: 'Benzyl Alcohol after Parfum §11.11 vs LI T17', maps_to: 'RG3-6' },
  { lane: 'A', item: 'INCI count mismatches without defect rank', maps_to: 'RG3-22 + P3-6' },
  { lane: 'A', item: 'Elnett 3 Tage Glatt no directions', maps_to: 'P3-4' },
  { lane: 'A', item: 'Taft Paste 5+ display reading', maps_to: 'RG3-10 + P3-5' },
  { lane: 'A', item: 'Color Wow heat_activated in blind round', maps_to: 'RG3-24 (no action: §6.13 already gives unresolved; both lanes agree)' },
  { lane: 'B', item: 'RG2-16 secondary vocabulary', maps_to: 'RG3-16' },
  { lane: 'B', item: 'D8b-negative-hold (OSiS Sparkler „Kein Halt")', maps_to: 'RG3-11' },
  { lane: 'B', item: 'S0-identity-metadata („S0 identity blocks omit identity_status")', maps_to: 'P3-1 + E3-1 (the packets carry identity_status at the top level; lane B missed it)' },
  { lane: 'B', item: 'INCI-unlisted-alias (VPVA; missing spaces above T_S)', maps_to: 'RG3-15 + P3-3' },
  { lane: 'B', item: 'Balea-7-scale (Power Flex printed 1–7)', maps_to: 'RG3-23' },
];

const REGISTER = [
  { id: 'RG3-1', class: 'b', section: 'standard §4.2 step 1 (RG2-21 job nouns, RG2-5 curl nouns), §5 form tie-break', records: ['bali-curls-volumizing-curl-spray-refreshing', 'wellaflex-schaumfestiger-locken-und-wellen-starker-halt', 'kevin-murphy-killer-curls', 'jean-und-len-sea-salt-spray', 'redken-wax-spray'], issue: 'Which words in a confirmed name are job words: a curl/wave noun without a verb („Curl Spray", „Locken & Wellen", „Killer.Curls"), a salt noun („Sea Salt Spray"), and a product noun that names a form inside a compound („Wax Spray", „Sprühwachs"). RG2-21 lists only Haarspray, Gel, Wachs, Puder, Schaumfestiger; §4.2 treats „Lockencreme" as a definition job word.', impact: '1 route split (Bali Volumizing: committed salt_spray vs held refresher), 1 subtype split (Redken Wax Spray: molding vs texture_spray), 3 primary jobs, 1 pair rule', proposed_fix: 'Add to §4.2 step 1: „A curl or wave noun in the name (Locken-, Curl, Wellen-) is a curl job word: definition, or refresh when the product revives curls; a salt noun (Salzspray, Sea Salt Spray) names texture; a product noun used as a form in a compound with another product noun (Wax Spray, Spray Wax, Sprühwachs, Gel-Spray) names the form, not a job — go to step 2/3." Outcomes: Bali Volumizing ⇒ two job words ⇒ first C2 line (revival) ⇒ held refresher (B); Wellaflex ⇒ definition, 3.4(iii) (A); Killer.Curls ⇒ two job words ⇒ C2 hold line ⇒ hold_fix (A); Jean&Len ⇒ texture (A); Redken Wax Spray ⇒ first C2 line „Texturierendes Sprühwachs" ⇒ texture_spray (B).', lean: 'mixed per record (see outcomes)' },
  { id: 'RG3-2', class: 'd', owner_question: 'Q3', section: 'standard §4.2 step 1 (RG2-21, R2-H3) vs §4.2 co-equal example „Taft „Textur und Pflege""', records: ['schwarzkopf-taft-texturspray-aloe-boost'], issue: 'The name names one job (Texturspray) and decides by step 1; the only C1 line joins texture and care („Textur und Pflege …"), and §4.2 cites exactly this line as its example of a co-equal mixed lead.', impact: '1 route split, 18 cascading cells; texture_spray coverage 4 vs 5', proposed_fix: 'If the owner confirms the name step: delete „Taft „Textur und Pflege"" from the §4.2 co-equal examples and add „a care word in a later or co-equal line of a product whose name names one styling job is a call-out (SFS-15)". Otherwise add „a C1 line that joins the name\'s job with care makes the product mixed although the name names one job".', lean: 'A (name decides, as R2-H3)' },
  { id: 'RG3-3', class: 'd', owner_question: 'Q2', section: 'standard §4.2 („the confirmed product name is C1/C2 positioning"), §4.3 3.1 (D2 „confirmed C1/C2 name"), §4.6 registry identity', records: ['syoss-hitzeschutzspray-keratin-heat', 'garnier-fructis-sleek-and-stay-heat-activated-serum', 'loreal-elvital-haaroel-oel-magique-alle-haartypen', 'john-frieda-haarserum-frizz-ease-der-baendiger', 'taft-x-gliss-hitzeschutzspray-lovely-long'], issue: 'The claims packet stamps 29 confirmed names C3 (retailer titles). Lane A will not let a C3 name pick the lead or fire D2; lane B uses it. The registry also matches „taft x Gliss Hitzeschutzspray" to the Lovely Long variant by name only.', impact: '1 route split (Syoss Hitzeschutzspray), 3 reason codes, 1 promise class; systemic for 29 records', proposed_fix: 'Owner answer, then §4.2 / §4.3 3.1: either „a C3-captured product name counts for step 1 and D2 when no C1/C2 name exists, for its product-type noun only (Hitzeschutzspray, Haarserum, Haaröl); retailer-only extra words never count (R2-H1)" or „a C3-only name never decides; capture the pack name". Registry rows carry the sample_id they rule.', lean: 'B (with a pack-name capture to make it moot)' },
  { id: 'RG3-4', class: 'b', section: 'standard §4.2 lead promise (line vs sentence), RG2-19', records: ['wella-eimi-smooth-thermal-image'], issue: 'A multi-sentence C2 paragraph opens with protection and then describes phases that care and smooth. Is the lead the paragraph or its first sentence?', impact: '1 route split (heat_protectant vs mixed_promise; non-Styling either way)', proposed_fix: 'Add to §4.2: „The lead is the first sentence of the chosen line that states a job; later sentences of the same line are secondary claims." ⇒ heat_protection ⇒ 3.3.', lean: 'B' },
  { id: 'RG3-5', class: 'd', owner_question: 'Q4', section: 'LI T15 (incidental_film, NEQI Ultimate) vs PH2-1 accepted consequence (Wella EIMI Flowing Form ⇒ li_g0_provisional); LI §2.3.2 clause 4', records: ['kms-thermashape-straightening-creme'], issue: 'A smoothing cream with a fixative-class polymer and a not-thin conditioning base, not a curl cream: T15 incidental_film ⇒ in_category ⇒ leave_in, or the middle band outside D7 ⇒ li_g0_provisional?', impact: '1 route split; smoothing_styler coverage only if T15 reads the base as thin (then committed smoothing_styler)', proposed_fix: 'Add to §4.3 3.4(iii): „A fixative-class polymer ranked after the conditioning architecture is a supporting fixative (T15 incidental_film ⇒ in_category ⇒ D6); one ranked at or above it with substantive conditioning is the middle band ⇒ D7 for curl creams, li_g0_provisional otherwise (PH2-1, Flowing Form PVP r2)."', lean: 'A' },
  { id: 'RG3-6', class: 'b', section: 'standard §11.11 (T_LI Benzyl Alcohol r8 after Parfum r6) vs lexicon v0.3 §0.2 / FR-2 and LI T17', records: ['aussie-leave-in-creme-work-that-curl', 'gard-haarspray-extrastark-pumpspray', 'got2b-gotgloss-glanz-spray', 'isana-professional-styling-creme-locken-traum', 'schwarzkopf-taft-foehn-spray-volumen-halt-3', 'schwarzkopf-taft-texturspray-aloe-boost'], issue: 'The worked example sets T_LI on a Benzyl Alcohol ranked after Parfum; the lexicon says at or after Parfum it is an allergen declaration and never T_LI.', impact: '6 tail-marker cells, no value moves', proposed_fix: 'Correct §11.11 Markers to „T_LI none_visible (Benzyl Alcohol r8 sits after Parfum r6: an allergen declaration, lexicon §0.2)" and add the sentence to §3.2.', lean: 'B' },
  { id: 'RG3-7', class: 'b', section: 'standard §6.11 RG2-8 shaping-act list vs worked example §11.2', records: ['got2b-styling-paste-istyler-texture-clay', 'osis-dust-it', 'syoss-professional-performance-max-hold-power-wax'], issue: '„einarbeiten", „in den Handflächen verreiben und ins Haar arbeiten", „auf trockenem Haar anwenden, um den gewünschten Look zu erzielen" are not in the RG2-8 list; §11.2 reads einarbeiten as shaping.', impact: '3 application_moment cells', proposed_fix: 'Add „einarbeiten, durcharbeiten, mit den Fingern verteilen und formen" to the RG2-8 list, and: „a paste, wax, cream or powder worked into dry hair by hand is dry_restyle".', lean: 'A' },
  { id: 'RG3-8', class: 'b', section: 'standard §7.2 (PH1-8 covers pack vs page only)', records: ['bali-curls-strong-hold-flaxseed-gel'], issue: 'Two C1/C2 strength statements on one source disagree (name „Strong Hold" ⇒ 3, line „Extra-starker Halt" ⇒ 4).', impact: '1 hold level (a gel: hold ranks first in selection)', proposed_fix: 'Add §7.2 step 7b: „Two C1/C2 strength statements of one product that map to different levels ⇒ null, both kept, review hold_claim_conflict (as PH1-8)." (conservative; neither lane emitted it).', lean: 'neither (A\'s review is closer)' },
  { id: 'RG3-9', class: 'b', section: 'standard §7.4 word lexicon vs RG-13 („Extra Hold" in names)', records: ['kms-thermashape-2-in-1-spray'], issue: '„extra Halt" in a claim line is not in §7.4, while „Extra Hold" in a name counts as a strength phrase.', impact: '1 hold level (stored only, smoothing_styler)', proposed_fix: 'Add to §7.4 level 4: „extra Halt / Extra Hold / Max Hold (extra, ultra, mega qualifying Halt directly)".', lean: 'A' },
  { id: 'RG3-10', class: 'b', section: 'standard §7.2 step 2 and §7.3 Henkel row („Taft Paste … until re-read")', records: ['taft-styling-paste-forming-halt-5plus'], issue: 'Stale text: the re-read (recapture-r4 P-8: four filled dots and a larger fifth circle „5+", no maximum printed) exists but no document closes the item; the claims packet does not carry the display description (P3-5).', impact: '1 hold level + neutral fact (molding: hold ranks first)', proposed_fix: 'Replace the §7.2/§7.3 „until re-read" clauses with „re-read 2026-10-12 (recapture-r4 P-8): a five-mark Henkel display whose fifth mark reads 5+ ⇒ x/5 ⇒ 4". Not one of the three sentences fixed in 0f8af0ff.', lean: 'A' },
  { id: 'RG3-11', class: 'b', section: 'standard §7.5 D8b rule 1', records: ['osis-sparkler'], issue: 'Does a negated hold claim („Kein Halt", level 0) fire D8b rule 1?', impact: '1 d8b flag', proposed_fix: 'Add to §7.5: „A negated hold claim (kein Halt, ohne Halt) is not a hold claim for rule 1."', lean: 'A' },
  { id: 'RG3-12', class: 'b', section: 'standard §4.2 care half (R2-Q1, R2-H5); §11.3', records: ['maria-nila-curlicue-cream', 'wella-eimi-nutricurls-curl-shaper'], issue: 'Care-half vocabulary: a care product noun inside a C2 descriptor line („Definierende Pflegecreme"; §11.3 leaves it open) and moisture-locking („schließt Feuchtigkeit ein").', impact: '2 promise classes, no value moves (D7 or the registry gives the same route)', proposed_fix: 'Add to §4.2: „A care product noun in a C2 descriptor line (Pflegecreme, Pflegespray) is not a care job unless it is the confirmed name; moisture-locking (schließt Feuchtigkeit ein) is the moisturise care job."', lean: 'A for Maria Nila (styling_result), A for Curl Shaper (mixed)' },
  { id: 'RG3-13', class: 'b', section: 'R2-H2 / standard §4.1, §11.15 (emission for a care product kept in its category)', records: ['guhl-locken-pflege-und-styling-3in1'], issue: 'R2-H2 names neither the boundary_reason nor the promise class. Lane B invented „owner_ruled_care_current_category" (not in §4.0); lane A left the class unassigned.', impact: '1 promise class + 1 reason (route and no-profile agree)', proposed_fix: 'Add to §11.15: „S0 output: provisional_boundary (mixed_promise), promise_class mixed (the R1-Q3 letter), ruled_route „care, current category (R2-H2)"."', lean: 'class B, reason A' },
  { id: 'RG3-14', class: 'b', section: 'standard §4.6 registry („S0 letter without the ruling: same") / §10.1 reason', records: ['maria-nila-curlicue-cream'], issue: 'Which reason a registry product carries when its letter already gives the ruled route: the letter\'s pair rule or the ruling.', impact: '1 reason code', proposed_fix: 'Add to §4.6: „Where the letter column reads „same", the record carries the letter\'s pair rule and the ruling as `ruled_route`; the reason is the ruling only where it overrides (§4.1 (a)–(c))."', lean: 'A' },
  { id: 'RG3-15', class: 'b', section: 'standard §4.1 RG2-24 (which INCI defects block); lexicon aliases', records: ['john-frieda-frizz-ease-zauberformel-seiden-finish-creme', 'balea-styling-finishing-stick'], issue: 'A missing space inside one readable INCI name („PerseaGratissima Oil") or a missing slash („VPVA COPOLYMER") above T_S: a blocking defect (B) or a transcription artifact read as the obvious name (A)?', impact: '1 route split (18 cells), 2 F values', proposed_fix: 'Add to RG2-24: „Only incompleteness blocks (truncation, a missing separator that merges two INCI names, an unreadable token). A missing space or slash inside one INCI name that reads as exactly one known name is repaired by the freeze (P2-4 pattern, as_written kept)." See P3-3.', lean: 'A' },
  { id: 'RG3-16', class: 'b', section: 'standard §6.10 secondaries (RG2-16 „open")', records: ['11 records with secondary_jobs-only or non-cascade disagreements (field secondary_jobs)'], issue: 'Applying the open rule: a hold claim whose strength is masked („[CLAIM] Halt") or only numeric (Haltegrad) — hold_fix or not; job words in the confirmed name as secondaries; gate drops.', impact: 'supplementary only', proposed_fix: 'Add to §6.10: „A hold claim with a strength word or a brand number ⇒ hold_fix (the mask hides the grade, not the job); job words of the confirmed name count as secondaries after the primary, in name order, before the claim lines."', lean: 'A' },
  { id: 'RG3-17', class: 'b', section: 'lexicon v0.3 species', records: ['syoss-hitzeschutzspray-keratin-heat', 'kms-thermashape-straightening-creme', 'john-frieda-frizz-ease-zauberformel-seiden-finish-creme'], issue: 'Unlisted species: Bis-Isobutyl PEG/PPG-20/35/Amodimethicone Copolymer (D6 care limb), WL-7-type emollients (Isoamyl Laurate, Triheptanoin, Isostearyl Palmitate, Hydrogenated Polydecene), Polyurethane-34/-48, AMP-Acrylates/Allyl Methacrylate Copolymer, Acrylic Acid/VP Crosspolymer, Sodium Polyacryloyldimethyl Taurate.', impact: 'Syoss Hitzeschutzspray D6 care limb (secondary to RG3-3); KMS creme conditioning read', proposed_fix: 'Lexicon v0.4: place each species; PEG/PPG-modified amodimethicones as CA-4 (amino silicone: counts as care under PH1-13) unless declared otherwise.', lean: '—' },
  { id: 'RG3-18', class: 'b', section: 'standard §5 anchor table', records: ['moroccanoil-volumizing-spray', 'wella-eimi-sugar-lift', 'redken-root-tease', 'redken-wax-spray', 'bali-curls-volumizing-curl-spray-refreshing'], issue: 'Damp volume sprays with no blow-dry step (both lanes chose blowdry_lotion as „closest"), a wax in spray form, a salt-led curl spray.', impact: 'agreed today except the RG3-1 records', proposed_fix: 'Add to §5 blowdry_lotion: „incl. damp volume sprays whether or not a blow-dry is named"; add a texture_spray tie-break: „a wax or paste in spray form ⇒ texture_spray".', lean: '—' },
  { id: 'RG3-19', class: 'b', section: 'standard §4.2 li_function / §4.5', records: [], issue: 'Lane A: a later C1/C2 line naming a Leave-in function (anti-frizz, care) can decide whether a product is held, although li_function reads the lead only.', impact: 'no disagreement this round', proposed_fix: 'State in §4.2: „li_function reads the lead promise only; later lines never set it."', lean: '—' },
  { id: 'RG3-20', class: 'b', section: 'standard §6.12 RG-9 vs RG2-10', records: ['osis-dust-it'], issue: '„Auf den Haaransatz und die Längen" — two sites named together: RG-9 (first-named ⇒ roots) or RG2-10 (whole hair ⇒ all). Both lanes chose all.', impact: 'none this round', proposed_fix: 'Add to RG2-10: „two sites named together (Ansatz und Längen) ⇒ all".', lean: '—' },
  { id: 'RG3-21', class: 'b', section: 'standard §4.3 3.4(i) D7 limb 3', records: ['wella-eimi-nutricurls-curl-shaper'], issue: '„Curl Shaper (Defining Gel Cream)": is that „sold as a curl or styling cream"? Both lanes said yes.', impact: 'none this round', proposed_fix: 'Add „Curl Shaper / Defining Cream / Gel Cream on a curl product" to the limb-3 examples.', lean: '—' },
  { id: 'RG3-22', class: 'b', section: 'standard §4.1 input 3; freeze inci_flags', records: ['syoss-hitzeschutzspray-keratin-heat', 'taft-styling-paste-forming-halt-5plus', 'got2b-spruehkleber-freeze-haarlack'], issue: 'Item-count mismatch flags (capture count vs split count) carry no defect rank, so a lane cannot tell whether the gap is above T_S.', impact: 'none this round (both lanes passed the gate)', proposed_fix: 'Freeze: resolve each count mismatch or give its rank (P3-6).', lean: '—' },
  { id: 'RG3-23', class: 'b', section: 'standard §7.3 brand scales', records: ['balea-styling-creme-power-flex'], issue: 'Balea printed 1–7 display has no row; both lanes null.', impact: 'none this round', proposed_fix: 'Add „Balea 1–7 display: no legend ⇒ words only" to §7.3.', lean: '—' },
  { id: 'RG3-24', class: 'b', section: 'standard §6.13', records: ['color-wow-dream-coat-supernatural-spray'], issue: 'Activation only at C3 in the blind round.', impact: 'none (both unresolved, as §6.13 says)', proposed_fix: 'none', lean: '—' },
];

const PACKET_ISSUES = [
  { id: 'P3-1', class: 'c', records: ['john-frieda-volume-lift-ansatz-booster', 'kevin-murphy-powder-puff-volume', 'cantu-shea-butter-extra-hold-edge-stay-gel'], issue: 'identity_status („inci_conflict") and inci_alt sit at the S0 packet top level, outside the `identity` block; FREEZE-NOTES §9.1 lists only identity.inci_flags inside the block and verified records carry no identity_status at all. Lane B read the block as „omitting identity_status" and treated all three as verified (E3-1, two route splits).', fix: 'Freeze: put identity_status in every S0 packet (incl. verified) inside `identity`, with inci_alt next to it; list both in §9.1.' },
  { id: 'P3-2', class: 'c', records: ['wella-eimi-glam-mist-shine-spray', 'wella-eimi-sugar-lift', 'wella-professionals-eimi-flowing-form', 'wella-eimi-smooth-thermal-image'], issue: 'P2-5 (a hold entry\'s words come only from its own raw) was applied to Balea Haargel only. Hold entries on other records still carry strength words that are not in their own text (computed list: packet_checks.hold_words_not_in_text). Where the brand scale has no maximum (Wella EIMI), the words decide the level, so the lanes split (Glam Mist 1 vs null, Sugar Lift 3 vs null).', fix: 'Re-capture: put each strength phrase found on the page in its own C1/C2 hold line, drop words that have no line; re-freeze the affected records.' },
  { id: 'P3-3', class: 'c', records: ['john-frieda-frizz-ease-zauberformel-seiden-finish-creme', 'balea-styling-finishing-stick', 'wella-eimi-glam-mist-shine-spray', 'wella-eimi-sugar-lift'], issue: 'Unrepaired transcription defects in INCI names (computed list: packet_checks.inci_transcription_defects): missing spaces („PerseaGratissima Oil" r3, „IsostearylPalmitate" r8, „HexylCinnamal", „PEG-40Hydrogenated Castor Oil") and a missing slash („VPVA COPOLYMER" r4, not flagged at all). One route split (Zauberformel) and two F values (Finishing Stick).', fix: 'Freeze: repair names that read as exactly one known INCI (P2-4 pattern, as_written kept, flag with rank); keep blocking only for incompleteness (RG3-15).' },
  { id: 'P3-4', class: 'c', records: ['loreal-paris-elnett-stylingspray-hitzeschutz-3-tage-glatt'], issue: 'Directions missing, although standard §11.7 cites C2 L\'Oréal article directions. Both lanes stop at evidence_gate; the ruled route (PH1-14, held smoothing_styler) waits for them.', fix: 'Capture the C2 article directions into the frozen record; this adds one held smoothing_styler.' },
  { id: 'P3-5', class: 'c', records: ['taft-styling-paste-forming-halt-5plus'], issue: 'The claims packet carries only „5+" and scale_info without the re-read display description (four filled dots + a larger fifth circle „5+", recapture-r4 P-8), so a lane cannot see that the re-read §7.2 waits for has happened.', fix: 'Carry the display description (marks, filled, labels) in the hold claim of the claims packet; close §7.2 (RG3-10).' },
  { id: 'P3-6', class: 'c', records: ['syoss-hitzeschutzspray-keratin-heat', 'taft-styling-paste-forming-halt-5plus', 'got2b-spruehkleber-freeze-haarlack'], issue: 'inci_flags „capture_item_count_N_vs_split_M" with defect_rank null.', fix: 'Re-check the count against the source and record the missing/extra item and its rank.' },
  { id: 'P3-7', class: 'c', records: ['see packet_checks.confirmed_name_tier_C3'], issue: 'Confirmed names stamped C3 (computed count). Five of them carry the RG3-3 disagreements (Syoss Hitzeschutzspray, the three serums/oil, taft x Gliss Lovely Long).', fix: 'Capture pack-front names (C1) for these products; this settles Q2 for them whatever the ruling.' },
];

const LANE_ERRORS = [
  { id: 'E3-1', record: 'john-frieda-volume-lift-ansatz-booster, kevin-murphy-powder-puff-volume, cantu-shea-butter-extra-hold-edge-stay-gel', field: 'identity_status, route (+ cascade)', wrong: 'B', right: 'A', rule: 'standard §4.1 input 3 + §2.2 A2 / LI T18: an inci_conflict with two lists never reaches tier 1 ⇒ provisional_boundary (formula_conflict); never overridden', moves_value: true },
  { id: 'E3-2', record: 'alcina-styling-mousse-aerosol, john-frieda-volume-lift-pushed-up-dry-texture-spray, moroccanoil-textur-und-volumenpuder, schwarzkopf-taft-haarpuder-volumen, john-frieda-frizz-ease-traumlocken-lockencreme, kms-thermashape-straightening-creme', field: 'tail_markers (T_LI status)', wrong: 'B', right: 'A', rule: 'LI §3.1.1 clause 6 (closed set) + RG-1 ⇒ vacuous (round-2 E2-9 pattern)', moves_value: false },
  { id: 'E3-3', record: 'loreal-paris-elvital-big-hair-day-erfrischendes-volumenspray', field: 'tail_markers (T_S)', wrong: 'B', right: 'A', rule: 'lexicon FR-2: named synthetic aroma chemicals are T_S class (b) ⇒ Dimethyl Phenethyl Acetate r10 is the first member', moves_value: false },
  { id: 'E3-4', record: 'guhl-foehn-spray-langzeit-volumen, kms-thermashape-2-in-1-spray', field: 'heat_activated', wrong: 'B', right: 'A', rule: 'RG2-26 / §6.13: blind round reads F/U directions only', moves_value: true },
  { id: 'E3-5', record: 'balea-leave-in-spray-sea-salt-care-define', field: 'promise_class', wrong: 'B', right: 'A', rule: '§4.6 registry row v0.3: the letter reads mixed (R2-Q1), the D6 ruling overrides it', moves_value: false },
  { id: 'E3-6', record: 'kevin-murphy-killer-curls', field: 'weight, buildup_note', wrong: 'B', right: 'A', rule: 'PH2-12 (lanolin wax is a rich member) ⇒ rich ⇒ buildup limb 2 (round-2 E2-7 persists)', moves_value: true },
  { id: 'E3-7', record: 'bumble-and-bumble-brilliantine, color-wow-dream-coat-supernatural-spray', field: 'promise_class, primary_job (+ Brilliantine reason_code)', wrong: 'B', right: 'A', rule: '§4.2 class from C1/C2 only, §4.1 (a) no-claim values, §6.10 „jobs empty" (round-2 E2-5 persists; „unknown" is not a job value)', moves_value: false },
  { id: 'E3-8', record: 'syoss-curl-cream-gel-3in1', field: 'reason_code', wrong: 'B', right: 'A', rule: 'RG2-5 („Locken zu formen" ⇒ li_function yes) ⇒ 3.4(iii) excluded_styling_first', moves_value: false },
  { id: 'E3-9', record: 'balea-haargel-hair-jelly', field: 'primary_job', wrong: 'B', right: 'A', rule: '§4.2 step 1 + RG2-21 + R2-H3 (a one-job name decides the lead; later specific lines are secondaries) + RG-11', moves_value: true },
  { id: 'E3-10', record: 'balea-professional-glow-und-shine-finishing-spray', field: 'primary_job', wrong: 'B', right: 'A', rule: '§4.2 step 1: the now-visible name names one job (shine/finish; RG2-5 same-job words count once)', moves_value: true },
];

const OWNER_QUESTIONS = [
  { id: 'Q1', rank: 1, root_cause: 'lock criterion 1 (PH1-11 „every subtype ≥ 5")', question: 'Only two products are Glättungsstyler (smoothing_styler) in both lanes, and the German market search found just four candidates. Do you accept fewer than five for this one subtype, or should it be merged into a neighbour for v1.0?', examples: ['KMS Thermashape 2-in-1 Spray: both lanes smoothing_styler (committed).', 'Color Wow Dream Coat: both lanes smoothing_styler, held until the Leave-in addendum.', 'Elnett Stylingspray 3 Tage Glatt is ruled smoothing_styler (PH1-14) but has no directions in the packet, so both lanes stop at the evidence gate (P3-4).'], options: ['(a) Lock with a written exception: smoothing_styler stays a subtype with < 5 products (2 now, 3 once the Elnett directions are captured).', '(b) Merge smoothing_styler into blowdry_lotion (sleek blow-dry products) or shine_finish for v1.0.', '(c) Keep the criterion and wait for the market.'], recommendation: '(a), and capture the Elnett directions now. Five is not reachable from this cohort even if every open item went the Styling way (see smoothing_styler section).' },
  { id: 'Q2', rank: 2, root_cause: 'RG3-3', question: 'When we only know a product\'s name from a shop listing (not from the pack or the brand\'s German page), may that name still decide what the product is — e.g. „Hitzeschutzspray" ⇒ heat protectant, „Haarserum"/„Haaröl" ⇒ Oil?', examples: ['syoss Hitzeschutzspray Keratin: name only from dm; the only pack line is „2x Frizz-Kontrolle". Lane B: heat protectant (name). Lane A: ignores the name ⇒ anti-frizz product ⇒ unresolved Leave-in border ⇒ review.', 'Elvital Öl Magique, John Frieda Frizz Ease Haarserum, Garnier Sleek & Stay Haarserum: both lanes say Oil, but lane A only via the owner registry because the „Öl/Serum" name is C3.'], recommendation: 'Yes, for the product-type noun of the shop title when no pack or brand-page name exists (a product\'s name is identity, not a marketing claim); retailer-only extra words still never count (R2-H1). Also capture the pack names for these five products (29 names are C3 today).' },
  { id: 'Q3', rank: 3, root_cause: 'RG3-2', question: 'The name says one job, but the only pack line joins that job with care. Does the name win?', examples: ['taft Texturspray Aloe Boost: name „Texturspray" (texture); pack line „Textur und Pflege für mühelose Undone Looks". Lane A: name wins ⇒ Styling texture_spray. Lane B: „Textur und Pflege" is texture + care ⇒ mixed ⇒ manual review — and the standard itself uses this very line as its example of a mixed promise.'], recommendation: 'Yes, the name wins (same logic as your Balea Wax Stick ruling R2-H3: the name decides, later lines are extras). That also lifts texture_spray to 5 agreed products. Delete the Taft example from the mixed list.' },
  { id: 'Q4', rank: 4, root_cause: 'RG3-5', question: 'A smoothing cream with a hold polymer sitting behind a rich conditioning base: Leave-in (like NEQI Ultimate) or hand review (like Wella Flowing Form)?', examples: ['KMS Thermashape Straightening Creme: Isoamyl Laurate r2 and Triheptanoin r3 (emollients), then VP/VA r5 (hold polymer); „glatte Styles, die bis zur nächsten Haarwäsche halten". Lane A: Leave-in. Lane B: review.', 'Precedents: NEQI Ultimate (one supporting fixative on a conditioning film ⇒ Leave-in, T15) vs Wella Flowing Form (PVP r2 leads ⇒ review, PH2-1).'], recommendation: 'Leave-in when the hold polymer ranks after the conditioning base (a supporting fixative); review only when it leads (Flowing Form). KMS Creme ⇒ Leave-in. It does not help smoothing_styler coverage either way.' },
];

const SMOOTHING_NOTE = 'Agreed smoothing_styler: KMS Thermashape 2-in-1 Spray (committed, new) and Color Wow Dream Coat (held). No other record is smoothing_styler in either lane. ≥ 5 is not reachable from this cohort: the round-5 capture added 4 products, of which only the KMS spray landed here (Balea Glow Wax ⇒ molding, got2b Schmusekatze ⇒ leave_in in both lanes, KMS Straightening Creme ⇒ leave_in vs li_g0_provisional). The only further candidates are Elnett 3 Tage Glatt (ruled smoothing_styler, blocked by missing directions — capture ⇒ held, 3 total), KMS Straightening Creme (only if T15 read its emollient base as thin — both lanes read it not thin) and Syoss Hitzeschutzspray (only if a C3 name never decides and its amodimethicone copolymer is ruled no-care so D6 fires — lane A\'s lean, held). Even with all three the count is 5, two of them on readings both lanes rejected.';

const CLASSIFY = (() => {
  // class: a = lane error (one lane misapplied a clear rule), b = rule gap/ambiguity, c = data/packet issue, d = needs an owner ruling.
  // old_sentence: 'possible' when the disagreement may trace to one of the three doc sentences fixed after the lanes ran (commit 0f8af0ff);
  // false when it does not. Lane B never cites those sentences, so 'possible' is an inference from the direction of the split.
  const D = {};
  const set = (keys, v) => { for (const k of keys) D[k] = v; };
  const R = {}; // whole-record default (route splits: every cascading field shares the record's root cause)

  // ---------------- route splits ----------------
  R['bali-curls-volumizing-curl-spray-refreshing'] = { class: 'b', root_cause: 'RG3-1', right: 'B (lean)', comment: 'Name „Volumizing Curl Spray". A: one job word (Volumizing; „Curl" names the hair type) ⇒ step 1 ⇒ volume ⇒ li_function no ⇒ 3.4(ii) ⇒ committed salt_spray. B: lead = first C2 line „erfrischt deine Locken und verleiht … voluminösen Beachlook" (revival first) ⇒ li_function yes ⇒ LI G0 in_category ⇒ D6 (no fixative, no real care above T_LI Phenoxyethanol r6) ⇒ held refresher — the reading both lanes took in round 2. §4.2 step 1 counts „Lockencreme ⇒ definition" as a name job word, so by analogy „Curl Spray" is a curl job word ⇒ two job words ⇒ step 3 ⇒ B. The standard never says whether a curl/wave noun without a verb in a name is a job word (RG2-5 covers only noun + shaping verb). New in round 3 (the RG2-21 name step).' };
  R['john-frieda-frizz-ease-zauberformel-seiden-finish-creme'] = { class: 'c', root_cause: 'P3-3', right: 'A', comment: 'B stopped at evidence_gate: „Unrepaired missing-space tokens above T_S, including rank 3" (S0 inci_flags: missing_spaces_as_printed „PerseaGratissima", „IsostearylPalmitate", … defect_rank 3). A read the names as unambiguous and passed the gate (the freeze computes the gate as passed: FREEZE-NOTES §5 lists 143/143 with no blocking INCI flag). RG2-24 says „a defect above T_S blocks" but lists only truncation, split tokens and missing separators; a missing space inside one readable INCI name is a transcription artifact the freeze could repair (as P2-4 does for splits). On the repaired list A\'s reading holds: R1-Q2 dry-hair flyaway control ⇒ shine_finish, primary frizz_control (RG2-7 names this product). Every Styling field cascades.' };
  R['john-frieda-volume-lift-ansatz-booster'] = { class: 'a', root_cause: 'E3-1', right: 'A', comment: 'The S0 packet carries identity_status „inci_conflict" and inci_alt at the packet top level (two captures: PQ-16 r3 + PQ-68 r5 vs PVP r3 + VP/VA r4 + sea salt). §4.1 input 3 and §2.2 A2 / LI T18: two lists, tier 1 unreachable ⇒ provisional_boundary (formula_conflict), no Styling values, never overridden (A, and both lanes in round 2). B emitted identity_status verified and a full blowdry_lotion profile; its ambiguity note says the S0 identity block omits identity_status — B looked inside `identity` only (packet layout, P3-1). Every field cascades.' };
  R['kevin-murphy-powder-puff-volume'] = { class: 'a', root_cause: 'E3-1', right: 'A', comment: 'Same as the Ansatz-Booster: top-level identity_status „inci_conflict" (Zinc Myristate + Undaria vs Nylon-12 + Alaria) ⇒ formula_conflict, no values (A; both lanes in round 2). R2-H6 made its claims C2 but does not release a formula conflict (§4.1 „never overridden"). B read verified and emitted a hair_powder profile with hold 1. Every field cascades, incl. one hold-level mismatch.' };
  R['cantu-shea-butter-extra-hold-edge-stay-gel'] = { class: 'a', root_cause: 'E3-1', right: 'A', comment: 'Top-level identity_status „inci_conflict" plus missing directions. A: formula_conflict (the conflict is the deeper block; §4.0 remedy order, §2.2 A2 example). B: verified + evidence_gate (directions missing). Route identical (provisional_boundary), no values either way.' };
  R['kms-thermashape-straightening-creme'] = { class: 'd', root_cause: 'RG3-5', owner_question: 'Q4', right: null, comment: 'New smoothing product. Both lanes: VP/VA r5 (FX-1) above T_LI with a not-thin emollient base (Isoamyl Laurate r2, Triheptanoin r3), smoothing/heat-styling promise (li_function yes), not a curl cream (no D7). A: T15 incidental_film (NEQI Ultimate paradigm: one supporting fixative on a conditioning base) ⇒ in_category ⇒ D6 fails on real hold ⇒ leave_in. B: middle band outside curl creams ⇒ li_g0_provisional (the PH2-1 consequence for Wella EIMI Flowing Form). Both precedents are owner rulings; the standard does not say which one a third product follows. A notes the alternative T15 „thin" reading would make it Styling smoothing_styler (not held).' };
  R['schwarzkopf-taft-texturspray-aloe-boost'] = { class: 'd', root_cause: 'RG3-2', owner_question: 'Q3', right: null, old_sentence: 'possible', comment: 'Name „Texturspray Aloe Boost" (one job: texture) vs the only C1 line „Textur und Pflege für mühelose Undone Looks …". A: §4.2 step 1 (RG2-21, R2-H3: when the name names one job it decides; later lines are secondaries) ⇒ texture ⇒ non-aqueous ⇒ 3.5 ⇒ texture_spray. B: the line joins texture and care with „und" ⇒ co-equal ⇒ mixed ⇒ review — and §4.2 itself lists „Taft „Textur und Pflege"" as its example of a co-equal mixed lead. The standard contradicts itself on this exact product. The pre-0f8af0ff sentence „names never route or set a subtype except D2/D7" points the same way as B (possible contributor). Round 2: both lanes mixed (name masked then). Every Styling field cascades; texture_spray coverage is 4 instead of 5 because of this record.' };
  R['syoss-hitzeschutzspray-keratin-heat'] = { class: 'd', root_cause: 'RG3-3', owner_question: 'Q2', right: null, comment: 'Confirmed name „Hitzeschutzspray Keratin" is stamped C3 (retailer title); the only C1/C2 promise is the pack line „2x Frizz-Kontrolle"; heat claims C3. A: a C3 name cannot pick the lead (§4.2: the confirmed name is C1/C2 positioning) ⇒ lead = frizz control, damp-first ⇒ li_function yes ⇒ LI G0 ⇒ D6 care limb unresolved (Bis-Isobutyl PEG/PPG-20/35/Amodimethicone Copolymer r11 is not a lexicon member, RG3-17) ⇒ li_g0_provisional. B: name job word „Hitzeschutzspray" ⇒ heat_protection ⇒ 3.3 heat_protectant (both lanes in round 2). Whether a C3-only product name may serve as step-1 evidence is not stated.' };
  R['wella-eimi-smooth-thermal-image'] = { class: 'b', root_cause: 'RG3-4', right: 'B (lean)', comment: 'Name has two job words (Smooth, Thermal) ⇒ first C2 line: „… schützt Ihr Haar bei der Verwendung von heißen Geräten. Phase 1 pflegt das Haar und schützt es vor Hitze … Phase 2 glättet Ihr Haar …". A read the whole line as the lead ⇒ protection joined with care and smoothing ⇒ mixed (RG2-19) ⇒ mixed_promise. B read the opening sentence as the lead ⇒ heat_protection ⇒ 3.3 (both lanes in round 2). §4.2 picks a „line" but never says whether a multi-sentence paragraph is one lead or the first sentence is; RG2-19 („mixed only when protection is joined with a styling or care job") then decides. Not a Styling route either way.' };

  // ---------------- tail markers ----------------
  set(['alcina-styling-mousse-aerosol::tail_markers', 'john-frieda-volume-lift-pushed-up-dry-texture-spray::tail_markers', 'moroccanoil-textur-und-volumenpuder::tail_markers', 'schwarzkopf-taft-haarpuder-volumen::tail_markers', 'john-frieda-frizz-ease-traumlocken-lockencreme::tail_markers', 'kms-thermashape-straightening-creme::tail_markers'],
    { class: 'a', root_cause: 'E3-2', right: 'A', comment: 'T_LI status: every ingredient at or below T_LI is in the LI §3.1.1 clause-6 closed set (preservatives/boosters, Parfum and declared or named fragrance substances, essential oils after Parfum per RG-1, pH adjusters/chelators) ⇒ vacuous (A). B wrote plausible. Same pattern as round-2 E2-9; no value moves on these records.' });
  set(['aussie-leave-in-creme-work-that-curl::tail_markers', 'gard-haarspray-extrastark-pumpspray::tail_markers', 'got2b-gotgloss-glanz-spray::tail_markers', 'isana-professional-styling-creme-locken-traum::tail_markers', 'schwarzkopf-taft-foehn-spray-volumen-halt-3::tail_markers', 'schwarzkopf-taft-texturspray-aloe-boost::tail_markers'],
    { class: 'b', root_cause: 'RG3-6', right: 'B (lean)', comment: 'Benzyl Alcohol ranked after Parfum. A took it as T_LI (following worked example §11.11, which gives Taft Föhn-Spray „T_LI Benzyl Alcohol r8" with Parfum r6). B: at or after Parfum it is an allergen declaration (lexicon v0.3 §0.2: „At or after Parfum it stays an allergen declaration (class (b))"; FR-2 „Never T_LI (LI T17)") ⇒ next capped preservative or none_visible. The lexicon and LI T17 support B; §11.11 contradicts them. No value moves on these records (A reported this ambiguity).' });
  D['loreal-paris-elvital-big-hair-day-erfrischendes-volumenspray::tail_markers'] = { class: 'a', root_cause: 'E3-3', right: 'A', comment: 'T_S = first T_S-class member: Dimethyl Phenethyl Acetate r10 is a named synthetic aroma chemical (lexicon FR-2 includes „named synthetic aroma chemicals", T_S class (b)) above Limonene r11 ⇒ T_S DPA r10, unresolved (above its own Parfum r29) (A). B started at Limonene r11. Dry shampoo; no value moves.' };

  // ---------------- identity ----------------
  D['cantu-shea-butter-extra-hold-edge-stay-gel::identity_status'] = R['cantu-shea-butter-extra-hold-edge-stay-gel'];

  // ---------------- promise class / reason / primary job ----------------
  D['balea-haargel-hair-jelly::primary_job'] = { class: 'a', root_cause: 'E3-9', right: 'A', old_sentence: 'possible', comment: 'Name „Haargel Hair Jelly": one job noun (Gel) ⇒ §4.2 step 1 decides the lead (RG2-21); R2-H3 / §11.16: when the name decides, later lines with a more specific job word („Ideal für Sleek-Looks & Locken") are secondaries ⇒ primary hold_fix (A; RG-11 lets a product noun carry the job when nothing else in the lead does). B kept the round-2 reading (sleek from the third C2 line; both lanes read sleek in round 2, before RG2-21). The old „names never set a subtype" sentence points the same way as B (possible contributor).' };
  D['balea-leave-in-spray-sea-salt-care-define::promise_class'] = { class: 'a', root_cause: 'E3-5', right: 'A', comment: '§4.6 registry row (v0.3): „under R2-Q1 the name\'s „Care" is a care job and „Define" / C2 „Griffigkeit und Definition" the definition half ⇒ the letter reads mixed; the D6 ruling overrides it". A mixed; B styling_result. Route, subtype and profile identical (held salt_spray). Persisting from round 2 (RG2-1, now ruled).' };
  D['balea-professional-glow-und-shine-finishing-spray::primary_job'] = { class: 'a', root_cause: 'E3-10', right: 'A', old_sentence: 'possible', comment: 'The R2-Q3 packet now shows the full name „Leave-In Glow&Shine Finishing Spray": one job (shine/finish; Glow, Shine and Finishing name the same job, RG2-5) ⇒ step 1 ⇒ primary shine (A; the round-2 analysis already found A right on the unredacted name). B still took the first C1 line „ANTI-FRIZZ-EFFEKT" ⇒ frizz_control. Persisting from round 2 although its packet cause (P2-1) is fixed. The old name sentence points the same way as B (possible contributor).' };
  set(['bumble-and-bumble-brilliantine::promise_class', 'color-wow-dream-coat-supernatural-spray::promise_class'],
    { class: 'a', root_cause: 'E3-7', right: 'A', comment: 'C3 claims only: §4.2 assigns the class from C1/C2 claims; under §4.1 (a) the ruled route applies with no-claim values ⇒ class not assigned (A). B wrote styling_result. Persisting round-2 lane error E2-5.' });
  set(['bumble-and-bumble-brilliantine::primary_job', 'color-wow-dream-coat-supernatural-spray::primary_job'],
    { class: 'a', root_cause: 'E3-7', right: 'A', comment: '§6.10 „No C1/C2 promise: only for a ruling-named route: jobs empty + claim_authority_gap" ⇒ null (A). B wrote „unknown", which is not in the primary_job vocabulary.' });
  D['bumble-and-bumble-brilliantine::reason_code'] = { class: 'a', root_cause: 'E3-7', right: 'A', comment: 'The letter stops at evidence_gate (no C1/C2 promise); the route is the D2-named route (§4.1 (a), §4.6) ⇒ 4.6_owner_named (A). B coded direct_styling „4.3/3.4(ii)/PH2-1" while also emitting ruled_route_override; 3.4(ii) needs a C1/C2 promise with li_function no, which this record cannot establish.' };
  set(['garnier-fructis-sleek-and-stay-heat-activated-serum::reason_code', 'loreal-elvital-haaroel-oel-magique-alle-haartypen::reason_code', 'john-frieda-haarserum-frizz-ease-der-baendiger::reason_code'],
    { class: 'd', root_cause: 'RG3-3', owner_question: 'Q2', right: null, comment: 'Route oil in both lanes. The „Öl"/„Serum" name is confirmed only at C3 (claims packet confirmed_name_tier C3). A: D2 needs a confirmed C1/C2 name ⇒ the letter cannot fire 3.1 ⇒ registry D2 override ⇒ 4.6_owner_named. B: 3.1 name rule (D2) directly (both lanes 3.1 in round 2). Same question as Syoss Hitzeschutzspray (A reported „D2 when Öl/Serum name is C3-only").' });
  D['taft-x-gliss-hitzeschutzspray-lovely-long::promise_class'] = { class: 'd', root_cause: 'RG3-3', owner_question: 'Q2', right: null, comment: 'Route heat_protectant in both lanes (registry). Name „Hitzeschutzspray taft x Gliss Lovely Long" is C3 only. A: lead = the only C2 line „Schutz & Pflege – … kombiniert … Styling und Pflege" ⇒ mixed (RG2-19), then the registry override. B: heat_protection (name job word). A also notes the registry row „taft x Gliss Hitzeschutzspray" is matched by name only (RG3-3 sub-item).' };
  D['maria-nila-curlicue-cream::promise_class'] = { class: 'b', root_cause: 'RG3-12', right: null, comment: 'C2 „Definierende Pflegecreme …". §11.3 leaves it open whether „Pflegecreme" (a product noun in a C2 line, not the confirmed name) states a care job, because the route is the same either way. A styling_result; B mixed. No value moves.' };
  D['maria-nila-curlicue-cream::reason_code'] = { class: 'b', root_cause: 'RG3-14', right: null, comment: 'Registry: Maria Nila styling curl_cream (T15, D3), „S0 letter without the ruling: same". A coded the letter (3.4(iii) excluded_styling_first); B coded the ruling (owner_ruled_styling_first ⇒ 4.6) after reading mixed. The standard does not say which reason a registry product carries when the letter already gives the ruled route. No value moves.' };
  D['wella-eimi-nutricurls-curl-shaper::promise_class'] = { class: 'b', root_cause: 'RG3-12', right: null, comment: 'Name „Curl Shaper (Defining Gel Cream)" = definition; C2 „Die Formel bändigt Frizz und schließt Feuchtigkeit ein". A: „schließt Feuchtigkeit ein" is a moisture care job ⇒ care + definition ⇒ mixed (R1-Q3), D7 fires first (PH1-12). B: styling_result. R2-Q1 lists „spendet Feuchtigkeit" but not moisture-locking. Route and profile identical (held curl_cream).' };
  set(['guhl-locken-pflege-und-styling-3in1::promise_class', 'guhl-locken-pflege-und-styling-3in1::reason_code'],
    { class: 'b', root_cause: 'RG3-13', right: null, comment: 'R2-H2: a care product, stays in its current category; S0 provisional_boundary „with the R2-H2 reading in its rationale". A: boundary mixed_promise (the R1-Q3 letter), class not assigned. B: class mixed, boundary reason „owner_ruled_care_current_category", which is not in the §4.0 boundary_reason list. R2-H2 and §11.15 name neither the boundary_reason nor the class. Lean: class mixed (B, the letter), boundary mixed_promise (A, the §4.0 list).' });
  D['syoss-curl-cream-gel-3in1::reason_code'] = { class: 'a', root_cause: 'E3-8', right: 'A', comment: 'RG2-5 names this product: „Locken zu formen und zu definieren" ⇒ curl definition ⇒ li_function yes ⇒ 3.4(iii) LI G0 (PVP r2 with thin conditioning + C2 shaping positioning) ⇒ excluded_styling_first (A). B coded 3.4(ii) (li_function no) while emitting primary definition. Same route and subtype (gel, RG2-14 effect reached in both lanes).' };
  D['wellaflex-schaumfestiger-locken-und-wellen-starker-halt::reason_code'] = { class: 'b', root_cause: 'RG3-1', right: 'A (lean)', comment: 'Name „Schaumfestiger Locken & Wellen, Starker Halt". A: the curl/wave nouns plus C1 „schwungvolle, definierte Locken" ⇒ curl definition ⇒ li_function yes ⇒ 3.4(iii) excluded_styling_first (both lanes in round 2). B: product-type noun Schaumfestiger is the only job noun (RG2-21) ⇒ hold ⇒ li_function no ⇒ 3.4(ii). Whether „Locken & Wellen" in a name is a job word or a hair-type word is not stated. Same route and subtype (mousse).' };
  D['jean-und-len-sea-salt-spray::primary_job'] = { class: 'b', root_cause: 'RG3-1', right: 'A (lean)', comment: 'Name „Sea Salt Spray". A: one job (beach texture) ⇒ primary texture. B: name has no job word ⇒ C1 „verleiht … Fülle sowie Griffigkeit" ⇒ Fülle = volume (RG2-6). RG2-21 lists Haarspray, Gel, Wachs, Puder, Schaumfestiger as job nouns, not Salzspray/Sea Salt Spray. Same route and subtype (salt_spray).' };
  D['kevin-murphy-killer-curls::primary_job'] = { class: 'b', root_cause: 'RG3-1', right: 'A (lean)', comment: 'Name „Killer.Curls (Leave-in Anti-Frizz Creme)". A: two job words (Curls, Anti-Frizz) ⇒ C2 lead „ideale Balance zwischen [CLAIM] Halt und [CLAIM]" ⇒ hold_fix (both lanes hold_fix in round 2). B: definition (the curl noun as the name\'s job). Same curl-noun question as Bali Volumizing and Wellaflex.' };
  set(['redken-wax-spray::subtype', 'redken-wax-spray::primary_job'],
    { class: 'b', root_cause: 'RG3-1', right: 'B (lean)', old_sentence: 'possible', comment: 'Name „Wax Spray (Redken Spray Wax)". A: one product-type noun (Wachs) ⇒ RG2-21 ⇒ molding job ⇒ molding. B: first C2 line „Texturierendes Sprühwachs" ⇒ texture ⇒ texture_spray (both lanes and the sealed round-2 trap „wax in spray form" expected texture_spray). Whether a product noun that names a form inside a compound („Spray Wax", „Sprühwachs") is a job word is not stated; §5 lets the form break job ties only. The old „names never set a subtype" sentence points the same way as B (possible contributor).' });

  // ---------------- formula / F fields ----------------
  set(['balea-styling-finishing-stick::result_mechanisms', 'balea-styling-finishing-stick::hold_route'],
    { class: 'c', root_cause: 'P3-3', right: 'A', comment: 'INCI r4 printed „VPVA COPOLYMER" (missing slash). A read VP/VA Copolymer (FX-1) ⇒ fixative_film, hold_route present. B: „not an authorised VP/VA alias" ⇒ FX-U ⇒ humectant_only, ambiguous. The packet carries no inci_flag for it; the freeze repairs split tokens (P2-4) but not missing separators inside one name.' });
  set(['kevin-murphy-killer-curls::weight', 'kevin-murphy-killer-curls::buildup_note'],
    { class: 'a', root_cause: 'E3-6', right: 'A', comment: 'PH2-12: lanolin wax is a rich member for Styling weight ⇒ Lanolin Wax r2 ⇒ rich ⇒ buildup limb 2 fires (A). B medium, no note. Persisting round-2 lane error E2-7.' });
  D['osis-sparkler::d8b_flags'] = { class: 'b', root_cause: 'RG3-11', right: 'A (lean)', comment: 'C2 „Kein Halt" (level 0 in both lanes). B fired D8b rule 1 literally („any hold claim on a shine_finish"); A: a negated hold claim is not a hold claim. B reported the ambiguity. The P2-1/R2-Q3 fix had its intended effect: the route split of round 2 is gone.' };

  // ---------------- U fields ----------------
  set(['got2b-styling-paste-istyler-texture-clay::application_moment', 'osis-dust-it::application_moment', 'syoss-professional-performance-max-hold-power-wax::application_moment'],
    { class: 'b', root_cause: 'RG3-7', right: 'A (lean)', comment: 'Directions „zwischen den Handflächen verreiben und ins trockene Haar einarbeiten" / „mit den Fingern in das trockene Haar einarbeiten" / „Auf trockenem Haar anwenden, um den gewünschten Look zu erzielen". RG2-8 requires a named shaping act (kneten, einkneten, formen, stylen, in Form bringen, toupieren) for dry_restyle; „einarbeiten" is not listed, but worked example §11.2 reads „einarbeiten" as shaping. A dry_restyle; B dry_finish (strict list). A reported this ambiguity. For pastes, waxes and powders worked into dry hair the molding/powder moment is dry_restyle.' });
  set(['guhl-foehn-spray-langzeit-volumen::heat_activated', 'kms-thermashape-2-in-1-spray::heat_activated'],
    { class: 'a', root_cause: 'E3-4', right: 'A', comment: 'RG2-26 / §6.13: in the blind round heat_activated reads the F/U directions only („Vor dem Föhnen aufsprühen"; „Auf das trockene Haar sprühen, bevor Hot Tools verwendet werden") ⇒ no; the name word „Föhn-Aktiv" and the C2 word „Hitzereaktives" raise it only after unblinding (A). B wrote yes. RG2-26 names the GUHL product; round 2 had the reverse error in lane A (E2-10).' });

  // ---------------- hold ----------------
  D['bali-curls-strong-hold-flaxseed-gel::hold_level'] = { class: 'b', root_cause: 'RG3-8', right: null, comment: 'Two C2 strength statements on the same source: confirmed name „Strong Hold" (stark ⇒ 3) and promise „Extra-starker Halt" (⇒ 4). A: review (no rule picks between them; PH1-8 covers pack vs page only). B: 4 (promise line). Proposed: mirror PH1-8 ⇒ null + review hold_claim_conflict; neither lane emitted that. Round 2: both 4.' };
  D['kms-thermashape-2-in-1-spray::hold_level'] = { class: 'b', root_cause: 'RG3-9', right: 'A (lean)', comment: 'C2 „Sorgt für extra Halt …". A: „extra" ⇒ 4 (RG-13 accepts „Extra Hold" as a strength phrase in names). B: no mapped strength (§7.4 lists „extra stark", not „extra" alone) ⇒ null. smoothing_styler: the level is stored only (§7.1).' };
  set(['taft-styling-paste-forming-halt-5plus::hold_level', 'taft-styling-paste-forming-halt-5plus::neutral_fact'],
    { class: 'b', root_cause: 'RG3-10', right: 'A (lean)', comment: 'C1 pack display „5+". §7.2 step 2 still says the Taft Paste „stays under RG-19 until the pack is re-read … reads null + neutral fact meanwhile; once a re-read confirms 5+ on the x/5 scale, §7.3 gives 4". The re-read exists (recapture-r4 P-8: four filled dots + a larger fifth circle labelled „5+", no maximum printed) but no document closes the item, and the claims packet carries only „5+" (P3-5). A: re-read done ⇒ x/5 ⇒ 4 (round-2 both lanes 4). B: number_unreadable ⇒ null + neutral fact (the current letter of §7.2). A stale sentence outside the three fixed by 0f8af0ff. The neutral fact cascades from the level.' });
  set(['wella-eimi-glam-mist-shine-spray::hold_level', 'wella-eimi-sugar-lift::hold_level', 'wella-eimi-sugar-lift::neutral_fact'],
    { class: 'c', root_cause: 'P3-2', right: 'B (by the letter; data fix needed)', comment: 'Wella EIMI Haltegrad has no stated maximum ⇒ words decide (§7.3). The hold entry\'s text is only „Haltegrad 1" / „Haltegrad: 3", but its `words` field carries „leichten Halt" / „starker, dennoch beweglicher Halt" — words that are not in the entry\'s own text (the P2-5 pattern; the freeze applied P2-5 to Balea Haargel only). A used the words (1, 3) with a P2-5 caveat; B applied P2-5 strictly (null; Sugar Lift then shows the neutral fact). Round 2: both 1 and 3. Re-capture: if the words are on wella.com, add them as their own C2 hold lines (then A); otherwise drop them (B).' });

  // ---------------- secondary jobs (supplementary) ----------------
  set(['balea-haargel-hair-jelly::secondary_jobs', 'balea-professional-glow-und-shine-finishing-spray::secondary_jobs', 'bali-curls-volumizing-curl-spray-refreshing::secondary_jobs', 'jean-und-len-sea-salt-spray::secondary_jobs', 'kevin-murphy-killer-curls::secondary_jobs', 'redken-wax-spray::secondary_jobs', 'john-frieda-frizz-ease-zauberformel-seiden-finish-creme::secondary_jobs', 'john-frieda-volume-lift-ansatz-booster::secondary_jobs', 'kevin-murphy-powder-puff-volume::secondary_jobs', 'schwarzkopf-taft-texturspray-aloe-boost::secondary_jobs'],
    { class: 'b', root_cause: 'cascade', comment: 'Follows the primary-job or route disagreement on the same record (the primary and secondaries swap, or one lane emits no profile).' });
  return {
    disagreements: D,
    by_record: R,
    default_secondary: { class: 'b', root_cause: 'RG3-16', comment: 'Secondary jobs under the RG2-16 „open" rule: lanes differ on hold_fix when the strength word is masked („[CLAIM] Halt") or numeric only, on job words in the confirmed name, and on gate drops. Supplementary, not in the overall %.' },
    ruling_checks: RULING_CHECKS,
    smoothing_note: SMOOTHING_NOTE,
    old_sentences: OLD_SENTENCES,
    lane_A_ambiguities: LANE_A_AMBIGUITIES,
    reported_ambiguity_map: REPORTED_MAP,
    rule_gap_register: REGISTER,
    packet_issues: PACKET_ISSUES,
    owner_questions: OWNER_QUESTIONS,
    lane_errors: LANE_ERRORS,
  };
})();
// CLASSIFY_END
const classifyKey = (slug, f) => CLASSIFY.disagreements[`${slug}::${f}`] || CLASSIFY.by_record[slug] || (f === 'secondary_jobs' ? CLASSIFY.default_secondary : null);

// ---------------------------------------------------------------------------
// Normalisation (round-2 rules, with the round-3 changes marked R3)
// ---------------------------------------------------------------------------
const NORMALISATION_NOTES = {
  identity_status: 'string as emitted',
  tail_markers: 'as round 2: T_S and T_LI compared as (inci lower-cased, whitespace collapsed, Parfum/Fragrance aliases folded to parfum; rank; status); T_S.alt ignored. R3: the misprint alias „Fragrance (Perfum)" is folded to parfum too (moroccanoil-anti-frizz-schild-spray: lane A copied the packet spelling, lane B wrote „Fragrance").',
  promise_class: 'as round 2: null / "unknown" -> "not_assigned".',
  route: 'string as emitted',
  reason_code: 'R3 CHANGE (both lanes changed their output vocabulary). Canonical reason = the pair rule or boundary reason, as in round 2. Lane A now emits boundary_reason, pair_rule and a descriptive reason_code: route provisional_boundary -> boundary_reason; a pair_rule starting "ruled" (registry / owner-named route) -> 4.6_owner_named; otherwise oil -> 3.1, dry_shampoo -> 3.2, heat_protectant -> 3.3, leave_in -> 3.4(iii)_in_category (incl. the D2 water-based-serum exception, pair_rule "3.1 exception -> 3.4(iii)": the deciding pair rule is 3.4(iii)), styling -> the pair_rule (3.4(iii) -> 3.4(iii)_excluded_styling_first). Lane B: real_care / care_first -> 3.4(iii)_in_category; water_based_serum_exception -> 3.4(iii)_in_category (the exception hands the record to 3.4(iii)); owner_ruled_* -> 4.6_owner_named; protection_first -> 3.3, or 4.6_owner_named when its rule_path starts with 4.6; oil_name -> 3.1; refresh_first -> 3.2; every other styling code (direct_styling, non_aqueous_styling, dry_finish, shine_lead, dry_texture_volume) -> the pair rule its rule_path names (3.4(ii), 3.5, 3.4(iii)); boundary reasons as emitted.',
  subtype: 'string or null',
  result_mechanisms: 'as round 2: sorted set of mechanism values (A {value}; B now plain strings); members not compared.',
  hold_route: 'string or null',
  weight: 'string or null',
  alcohol_note: 'string or null',
  buildup_note: 'A {fired} -> fires/does_not_fire; B string.',
  provides_heat_protection: 'A {value} -> boolean; B boolean.',
  application_moment: 'R3 CHANGE: lane B now emits a plain string (no also[]); primary compared as before. The round-2 supplementary field application_moment_also is dropped (only lane A still emits also[]).',
  target_zone: 'string or null',
  heat_activated: 'string or null',
  hold_level: 'number, null, or "review"',
  flexibility: 'string or null',
  finish: 'string or null',
  primary_job: 'string or null ("review" kept as a value)',
  neutral_fact: 'whitespace collapsed, quotes unified; null = not shown. R3 CHANGE: compared case-insensitively — lane B copies the INCI name in the packet casing („VP/VA COPOLYMER"), lane A in title case; the shown string is the same fact.',
  d8b_flags: 'R3 CHANGE: lane B now emits [] on every record, incl. records without a Styling profile. d8b_flags is masked to null for any lane record without a Styling profile (route styling or reason pending_leave_in_addendum), as round 2 did for ingredient_flags; on profile records null and [] stay distinct.',
  informational_values: 'as round 2: lane A emits formula values on non-Styling records marked informational_and_non_authoritative (42 records this round); they are masked to null before comparison.',
  secondary_jobs: 'supplementary, sorted set. R3 CHANGE: masked to null for a lane record without a Styling profile (lane B now emits [] there).',
  ingredient_flags: 'supplementary. R3 CHANGE: lane B now emits a token list (silicones, oils, fragrance, salt, salt:unknown, propellant, fixative_family:<family>); it is folded into the round-2 object (a missing token = false; salt:unknown -> null) and compared with fixative_family sorted. Masked for records without a Styling profile.',
};

const FIELDS = [
  'identity_status', 'tail_markers', 'promise_class', 'route', 'reason_code', 'subtype',
  'result_mechanisms', 'hold_route', 'weight', 'alcohol_note', 'buildup_note',
  'provides_heat_protection', 'application_moment', 'target_zone', 'heat_activated',
  'hold_level', 'flexibility', 'finish', 'primary_job', 'neutral_fact', 'd8b_flags',
];
const SUPPLEMENTARY = ['secondary_jobs', 'ingredient_flags', 'tail_T_S', 'tail_T_LI'];

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
const flagsObj = (f) => (f == null ? null : {
  silicones: f.silicones, oils: f.oils, fragrance: f.fragrance, salt: f.salt, propellant: f.propellant,
  fixative_family: setOf(f.fixative_family || []),
});
const flagsFromTokens = (t) => {
  if (t == null) return null;
  const has = (k) => t.includes(k);
  return {
    silicones: has('silicones'), oils: has('oils'), fragrance: has('fragrance'),
    salt: has('salt:unknown') ? null : has('salt'), propellant: has('propellant'),
    fixative_family: setOf(t.filter((x) => x.startsWith('fixative_family:')).map((x) => x.slice('fixative_family:'.length))),
  };
};

const PAIR = (s) => {
  const m = String(s || '').match(/3\.4\(iii\)|3\.4\(ii\)|3\.4\(i\)|3\.5|3\.3|3\.2|3\.1/);
  if (!m) return null;
  return m[0] === '3.4(iii)' ? '3.4(iii)_excluded_styling_first' : m[0];
};
function A_REASON(r) {
  if (r.route === 'provisional_boundary') return r.boundary_reason || 'boundary_unnamed';
  const pr = String(r.pair_rule || '');
  if (/^ruled/.test(pr)) return '4.6_owner_named';
  if (r.route === 'oil') return '3.1';
  if (r.route === 'dry_shampoo') return '3.2';
  if (r.route === 'heat_protectant') return '3.3';
  if (r.route === 'leave_in') return '3.4(iii)_in_category';
  if (r.route === 'styling') return PAIR(pr) || 'unparsed';
  return 'unparsed';
}
function B_REASON(r) {
  const c = r.reason_code; const p = String(r.rule_path || '');
  switch (c) {
    case 'real_care': case 'care_first': return '3.4(iii)_in_category';
    case 'water_based_serum_exception': return '3.4(iii)_in_category';
    case 'owner_ruled_leave_in': case 'owner_ruled_styling_first': return '4.6_owner_named';
    case 'protection_first': return /^4\.6/.test(p) ? '4.6_owner_named' : '3.3';
    case 'oil_name': return '3.1';
    case 'refresh_first': return '3.2';
    case 'direct_styling': case 'non_aqueous_styling': case 'dry_finish': case 'shine_lead': case 'dry_texture_volume':
      return PAIR(p.replace(/^4\.3\//, '')) || 'styling(pair_unnamed)';
    default: return c;
  }
}
const hasProfileA = (r) => r.route === 'styling' || (r.route === 'provisional_boundary' && r.boundary_reason === 'pending_leave_in_addendum');
const hasProfileB = (r) => r.route === 'styling' || (r.route === 'provisional_boundary' && r.reason_code === 'pending_leave_in_addendum');

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
    result_mechanisms: F(r.result_mechanisms == null ? null : setOf(r.result_mechanisms.map((m) => m.value))),
    hold_route: F(r.hold_route == null ? null : r.hold_route),
    weight: F(r.weight == null ? null : r.weight),
    alcohol_note: F(r.alcohol_note == null ? null : (typeof r.alcohol_note === 'object' ? r.alcohol_note.value : r.alcohol_note)),
    buildup_note: F(r.buildup_note == null ? null : (r.buildup_note.fired ? 'fires' : 'does_not_fire')),
    provides_heat_protection: r.provides_heat_protection == null ? null : r.provides_heat_protection.value,
    application_moment: r.application_moment == null ? null : r.application_moment.primary,
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
    ingredient_flags: prof ? flagsFromTokens(r.ingredient_flags) : null,
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
const r2CohortById = new Map(C2.records.map((r) => [r.sample_id, r]));
const ROLES = ['calibration', 'negative_control'];
const ORIGINS = ['carried', 'new'];

const rows = ids.map((id) => {
  const c = cohortById.get(id);
  const m = idMap.get(id);
  const r2rec = m.round2_sample_id ? r2CohortById.get(m.round2_sample_id) : null;
  return {
    id, slug: c.source_slug, name: `${c.identity.brand} ${c.identity.product_name}`, role: c.cohort_role,
    origin: m.round2_sample_id ? 'carried' : 'new', round2_id: m.round2_sample_id || null,
    round2_role: r2rec ? r2rec.cohort_role : null,
    rawA: aById.get(id), rawB: bById.get(id), A: normA(aById.get(id)), B: normB(bById.get(id)),
  };
});
for (const r of rows) if (r.origin === 'carried' && (!r.round2_role || r2CohortById.get(r.round2_id).source_slug !== r.slug)) throw new Error(`r2 id map broken for ${r.slug}`);

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
  carried: () => rows.filter((r) => r.origin === 'carried'),
  new: () => rows.filter((r) => r.origin === 'new'),
  round2_unseen_now_calibration: () => rows.filter((r) => r.round2_role === 'unseen'),
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
      slug: r.slug, id: r.id, name: r.name, role: r.role, origin: r.origin, field: f,
      supplementary: f === 'secondary_jobs',
      A: r.A[f], B: r.B[f],
      A_rule_path: rulePath(r.rawA, f), B_rule_path: rulePath(r.rawB, f),
      A_path_short: [r.rawA.route, r.rawA.boundary_reason, r.rawA.pair_rule, r.rawA.reason_code].filter(Boolean).join(' · '),
      B_path_short: [r.rawB.route, r.rawB.reason_code, r.rawB.rule_path].filter(Boolean).join(' · '),
      classification: cls ? cls.class : 'UNCLASSIFIED',
      root_cause: cls ? cls.root_cause : null,
      right_lane: cls ? (cls.right || null) : null,
      old_sentence: cls ? (cls.old_sentence || false) : false,
      comment: cls ? cls.comment : null,
    });
  }
}
const unclassified = disagreements.filter((d) => d.classification === 'UNCLASSIFIED').map((d) => `${d.slug}::${d.field}`);
const coreDis = disagreements.filter((d) => !d.supplementary);
const routeDis = coreDis.filter((d) => d.field === 'route');

// ---------------------------------------------------------------------------
// 2. Round 2 -> round 3 on the 139 carried records
// ---------------------------------------------------------------------------
const r2Dis = new Map();
for (const d of R2.disagreements) r2Dis.set(`${d.slug}::${d.field}`, d);
const carried = rows.filter((r) => r.origin === 'carried');
const carriedSlugs = new Set(carried.map((r) => r.slug));
const r2ToR3 = { resolved: [], persisting: [], new_in_round3: [] };
for (const r of carried) {
  for (const f of [...FIELDS, 'secondary_jobs']) {
    const key = `${r.slug}::${f}`;
    const was = r2Dis.get(key);
    const nowOk = same(r.A[f], r.B[f]);
    const c3 = classifyKey(r.slug, f) || {};
    if (was && nowOk) r2ToR3.resolved.push({ slug: r.slug, name: r.name, field: f, round2_class: was.classification, round2_root_cause: was.root_cause, round3_value: r.A[f] });
    else if (was && !nowOk) r2ToR3.persisting.push({ slug: r.slug, name: r.name, field: f, round2_class: was.classification, round2_root_cause: was.root_cause, round2_A: was.A, round2_B: was.B, round3_A: r.A[f], round3_B: r.B[f], round3_class: c3.class || null, round3_root_cause: c3.root_cause || null });
    else if (!was && !nowOk) r2ToR3.new_in_round3.push({ slug: r.slug, name: r.name, field: f, round3_A: r.A[f], round3_B: r.B[f], round3_class: c3.class || null, round3_root_cause: c3.root_cause || null });
  }
}
const r2Core = R2.disagreements.filter((d) => !d.supplementary && carriedSlugs.has(d.slug));
const core = (xs) => xs.filter((x) => x.field !== 'secondary_jobs');
const tally = (xs, k) => xs.reduce((m, x) => { const v = x[k] == null ? 'none' : x[k]; m[v] = (m[v] || 0) + 1; return m; }, {});
const sortObj = (o) => Object.fromEntries(Object.entries(o).sort((x, y) => (x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : 0)));
const round2Comparison = {
  note: 'Round-2 values come from round-2/diff.json (139 records, standard v0.2, round-2 packets). Every round-2 record is carried into round 3 under the same slug (r3/cohort.json id_map). Round-3 normalisation changes (reason vocabulary, d8b/secondary masking, B application_moment string) are listed under normalisation; they apply to round-3 values only.',
  round2_overall_all_139: { cells_agree: R2.overall_agreement.all.cells_agree, field_cells: R2.overall_agreement.all.field_cells, pct_cells: R2.overall_agreement.all.pct_cells, records_all_fields_agree: R2.overall_agreement.all.records_all_fields_agree, core_disagreements: R2.counts.disagreements_core_fields, route_disagreements: R2.counts.route_disagreements, records_with_core_disagreement: R2.counts.records_with_any_core_disagreement },
  round3_overall_carried_139: overallAgreement.carried,
  round3_core_disagreements_carried: coreDis.filter((d) => d.origin === 'carried').length,
  round3_route_disagreements_carried: routeDis.filter((d) => d.origin === 'carried').length,
  round3_records_with_core_disagreement_carried: new Set(coreDis.filter((d) => d.origin === 'carried').map((d) => d.slug)).size,
  round2_core_disagreements_on_carried: r2Core.length,
  resolved_core: core(r2ToR3.resolved).length,
  persisting_core: core(r2ToR3.persisting).length,
  new_core_in_round3: core(r2ToR3.new_in_round3).length,
  new_core_records_in_round3: new Set(core(r2ToR3.new_in_round3).map((x) => x.slug)).size,
  resolved_secondary_jobs: r2ToR3.resolved.length - core(r2ToR3.resolved).length,
  persisting_secondary_jobs: r2ToR3.persisting.length - core(r2ToR3.persisting).length,
  new_secondary_jobs: r2ToR3.new_in_round3.length - core(r2ToR3.new_in_round3).length,
  resolved_by_round2_root_cause: sortObj(tally(core(r2ToR3.resolved), 'round2_root_cause')),
  persisting_by_round3_root_cause: sortObj(tally(core(r2ToR3.persisting), 'round3_root_cause')),
  new_by_round3_root_cause: sortObj(tally(core(r2ToR3.new_in_round3), 'round3_root_cause')),
  persisting: r2ToR3.persisting,
  resolved: r2ToR3.resolved,
  new_in_round3: r2ToR3.new_in_round3,
};

// Ruling-effect check: every product an R2-Q / R2-H ruling or an RG2 fix names, both lanes' r3 values vs the ruled outcome.
const bySlug = new Map(rows.map((r) => [r.slug, r]));
const rulingEffects = CLASSIFY.ruling_checks.map((rc) => {
  const r = bySlug.get(rc.slug);
  if (!r) return { ...rc, present: false };
  const fields = Object.entries(rc.expect).map(([f, want]) => {
    const wants = want && want.any ? want.any : [want];
    const a = r.A[f]; const b = r.B[f];
    const okA = wants.some((w) => same(a, w)); const okB = wants.some((w) => same(b, w));
    return { field: f, ruled: want, A: a, B: b, A_matches: okA, B_matches: okB };
  });
  const both = fields.every((x) => x.A_matches && x.B_matches);
  const anyLane = fields.every((x) => x.A_matches) || fields.every((x) => x.B_matches);
  return { ruling: rc.ruling, slug: rc.slug, name: r.name, outcome_note: rc.note, fields, effect: both ? 'intended_effect_both_lanes' : anyLane ? 'one_lane_only' : 'not_reached' };
});
const rulingSummary = Object.values(rulingEffects.reduce((m, x) => {
  const k = x.ruling; if (!m[k]) m[k] = { ruling: k, products: 0, both_lanes: 0, one_lane: 0, neither: 0 };
  m[k].products++; if (x.effect === 'intended_effect_both_lanes') m[k].both_lanes++; else if (x.effect === 'one_lane_only') m[k].one_lane++; else m[k].neither++;
  return m;
}, {}));

// ---------------------------------------------------------------------------
// 3. Hold normalisation check (PH1-11)
// ---------------------------------------------------------------------------
const holdRows = rows.filter((r) => r.A.hold_level !== null || r.B.hold_level !== null);
const holdMismatches = holdRows.filter((r) => !same(r.A.hold_level, r.B.hold_level)).map((r) => ({
  slug: r.slug, name: r.name, role: r.role, origin: r.origin, subtype_A: r.A.subtype, subtype_B: r.B.subtype,
  A: r.A.hold_level, A_basis: r.rawA.hold_basis || null, B: r.B.hold_level, B_basis: r.rawB.hold_basis || null,
  classification: (classifyKey(r.slug, 'hold_level') || {}).class || 'UNCLASSIFIED',
  root_cause: (classifyKey(r.slug, 'hold_level') || {}).root_cause || null,
}));
const holdBoth = holdRows.filter((r) => r.A.hold_level !== null && r.B.hold_level !== null);
const holdCheck = {
  products_where_either_emits_a_level: holdRows.length,
  products_where_both_emit_a_level: holdBoth.length,
  identical: holdRows.length - holdMismatches.length,
  mismatches: holdMismatches.length,
  criterion_met: holdMismatches.length === 0,
  round2: { either: R2.hold_normalisation_check.products_where_either_emits_a_level, identical: R2.hold_normalisation_check.identical, mismatches: R2.hold_normalisation_check.mismatches, mismatch_slugs: R2.hold_normalisation_check.mismatch_list.map((x) => x.slug) },
  mismatch_list: holdMismatches,
  hold_basis_note: 'Both lanes emit hold_basis as prose or a label; bases are shown, not compared.',
  all_rows: holdRows.map((r) => ({ slug: r.slug, name: r.name, origin: r.origin, subtype: r.A.subtype || r.B.subtype, A: r.A.hold_level, B: r.B.hold_level, same: same(r.A.hold_level, r.B.hold_level), A_basis: r.rawA.hold_basis || null, B_basis: r.rawB.hold_basis || null })),
};

// ---------------------------------------------------------------------------
// 6. Coverage per subtype where A and B agree
// ---------------------------------------------------------------------------
const SUBTYPES = ['gel', 'curl_cream', 'mousse', 'blowdry_lotion', 'smoothing_styler', 'hairspray', 'shine_finish', 'salt_spray', 'texture_spray', 'hair_powder', 'molding', 'refresher'];
const kindOf = (x) => (x.route === 'styling' ? 'committed' : x.reason_code === 'pending_leave_in_addendum' ? 'held' : null);
const coverage = {};
for (const st of SUBTYPES) coverage[st] = { committed_agreed: [], held_agreed: [], disputed: [], either_lane: [] };
for (const r of rows) {
  const aK = kindOf(r.A); const bK = kindOf(r.B);
  for (const [k, st] of [[aK, r.A.subtype], [bK, r.B.subtype]]) if (k && st && coverage[st] && !coverage[st].either_lane.includes(r.slug)) coverage[st].either_lane.push(r.slug);
  if (aK && bK && aK === bK && r.A.subtype === r.B.subtype && r.A.subtype) coverage[r.A.subtype][aK + '_agreed'].push(r.slug);
  else for (const [k, st] of [[aK, r.A.subtype], [bK, r.B.subtype]]) if (k && st && coverage[st] && !coverage[st].disputed.includes(r.slug)) coverage[st].disputed.push(r.slug);
}
const r2Cov = new Map(R2.coverage_per_subtype_agreed.map((c) => [c.subtype, c]));
const coverageTable = SUBTYPES.map((st) => ({
  subtype: st,
  committed_agreed: coverage[st].committed_agreed.length,
  held_agreed: coverage[st].held_agreed.length,
  total_agreed: coverage[st].committed_agreed.length + coverage[st].held_agreed.length,
  round2_total_agreed: r2Cov.get(st) ? r2Cov.get(st).total_agreed : null,
  disputed: coverage[st].disputed.length,
  meets_5_committed_only: coverage[st].committed_agreed.length >= 5,
  meets_5_incl_held: coverage[st].committed_agreed.length + coverage[st].held_agreed.length >= 5,
  committed_slugs: coverage[st].committed_agreed,
  held_slugs: coverage[st].held_agreed,
  disputed_slugs: coverage[st].disputed,
  either_lane_slugs: coverage[st].either_lane,
}));
const smoothing = coverageTable.find((c) => c.subtype === 'smoothing_styler');
const smoothingDetail = {
  agreed_committed: smoothing.committed_slugs,
  agreed_held: smoothing.held_slugs,
  agreed_total: smoothing.total_agreed,
  either_lane: smoothing.either_lane_slugs.map((s) => { const r = bySlug.get(s); return { slug: s, name: r.name, origin: r.origin, A: `${r.A.route}/${r.A.reason_code}/${r.A.subtype}`, B: `${r.B.route}/${r.B.reason_code}/${r.B.subtype}` }; }),
  reachable_if_every_either_lane_product_agreed: smoothing.either_lane_slugs.length,
  new_round3_products: rows.filter((r) => r.origin === 'new').map((r) => ({ slug: r.slug, name: r.name, A: `${r.A.route}/${r.A.reason_code}/${r.A.subtype}`, B: `${r.B.route}/${r.B.reason_code}/${r.B.subtype}` })),
  analyst_note: CLASSIFY.smoothing_note,
};

// ---------------------------------------------------------------------------
// 7. Lock criteria (PH1-11 as adjusted by PH1-16)
// ---------------------------------------------------------------------------
const r2Unseen = R2.lock_criteria.find((c) => /unseen/.test(c.criterion));
const addendumCandidates = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/addendum/i.test(e.name) && /(styling|leave-?in)/i.test(p) && !/evidence/.test(p)) addendumCandidates.push(path.relative(REPO, p));
  }
})(path.join(REPO, 'docs', 'research'));
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/addendum/i.test(e.name)) addendumCandidates.push(path.relative(REPO, p));
  }
})(path.join(REPO, 'plans', 'styling-concept'));
addendumCandidates.sort();
const lockCriteria = [
  { criterion: 'Every subtype >= 5 products (agreed; committed + held, held reported separately)', met: coverageTable.every((c) => c.meets_5_incl_held),
    numbers: `${coverageTable.filter((c) => c.meets_5_incl_held).length}/12 subtypes reach 5 incl. held; ${coverageTable.filter((c) => c.meets_5_committed_only).length}/12 reach 5 committed; short incl. held: ${coverageTable.filter((c) => !c.meets_5_incl_held).map((c) => `${c.subtype} ${c.total_agreed}`).join(', ') || 'none'}` },
  { criterion: 'Two blind lanes agree on all routes and properties, no unresolved disagreements', met: coreDis.length === 0,
    numbers: `${routeDis.length} route and ${coreDis.length} core-field disagreements on ${new Set(coreDis.map((d) => d.slug)).size} records (all classified: ${unclassified.length === 0})` },
  { criterion: 'Two independent claim normalisations give identical hold levels', met: holdCheck.criterion_met,
    numbers: `${holdCheck.identical}/${holdCheck.products_where_either_emits_a_level} identical` },
  { criterion: '>= 6 unseen products incl. >= 2 traps, matching pre-registered expectations', met: r2Unseen.met === true,
    numbers: `not re-tested in round 3 (0 unseen slots in r3/cohort.json: ${rows.filter((r) => r.role === 'unseen').length}); read from round-2/diff.json lock_criteria: met=${r2Unseen.met} — ${r2Unseen.numbers}` },
  { criterion: 'Leave-in addendum drafted and queued for right after lock (PH1-16)', met: addendumCandidates.length > 0,
    numbers: addendumCandidates.length ? `candidate files: ${addendumCandidates.join(', ')}` : 'no addendum file under docs/research (styling/leave-in) or plans/styling-concept' },
];

// ---------------------------------------------------------------------------
// 8. Packet checks (computed from the frozen r3 packets; evidence for P3-2, P3-3, P3-7)
// ---------------------------------------------------------------------------
const PK = path.join(ROOT, 'r3', 'packets');
const pkt = (kind, id) => JSON.parse(fs.readFileSync(path.join(PK, kind, id + '.json'), 'utf8'));
const STRENGTH = /(leicht|sanft|soft|weich|mittel|normal|stark|extra|ultra|mega|extrem|maximal|\bmax\b|power|krass)/gi;
const stems = (t) => new Set((String(t || '').toLowerCase().match(STRENGTH) || []).map((w) => w.replace(/\b/g, '')));
const holdWordsNotInText = [];
const nameTierC3 = [];
const inciDefects = [];
for (const r of rows) {
  const cl = pkt('claims', r.id);
  if (cl.confirmed_name_tier === 'C3') nameTierC3.push(r.slug);
  for (const c of cl.claims) {
    if (c.type !== 'hold' || !c.words) continue;
    const inText = stems(c.text); const missing = [...stems(c.words)].filter((w) => !inText.has(w));
    if (missing.length) holdWordsNotInText.push({ slug: r.slug, text: c.text, words: c.words, strength_words_not_in_text: missing.sort(), tier: c.tier, A_level: r.A.hold_level, B_level: r.B.hold_level });
  }
  const s0 = pkt('s0', r.id);
  for (const it of s0.inci.items) if (/[a-z][A-Z]|[0-9][A-Z][a-z]|\bVPVA\b/.test(it.inci)) inciDefects.push({ slug: r.slug, rank: it.rank, inci: it.inci, flagged_in_packet: s0.identity.inci_flags.some((f) => f.defect_rank === it.rank || String(f.flag).includes(it.inci.split(' ')[0])) });
}
const packetChecks = {
  hold_words_not_in_text: { note: 'claims-packet hold entries whose `words` carry a strength word (§7.4 stems) that the entry\'s own text does not contain (P2-5 pattern)', count: holdWordsNotInText.length, levels_split: holdWordsNotInText.filter((x) => !same(x.A_level, x.B_level)).map((x) => x.slug), records: holdWordsNotInText },
  inci_transcription_defects: { note: 'S0 INCI items with a missing space (lower-case letter or digit followed by a capitalised word) or the missing-slash form VPVA', count: inciDefects.length, records: inciDefects },
  confirmed_name_tier_C3: { count: nameTierC3.length, slugs: nameTierC3 },
};

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------
const out = {
  generated_by: 'data/research/styling-inci/v1.0/round-3/diff.js',
  inputs: {
    lane_A: { file: 'blind-lane-A-r3/results.json', model: A.model, standard: A.standard, run_at: A.run_at || null },
    lane_B: { file: 'blind-lane-B-r3/results.json', model: B.model, standard: B.standard },
    cohort: { file: 'r3/cohort.json', cohort_version: C.cohort_version, frozen_on: C.frozen_on, standard_version: C.standard_version, lexicon_version: C.lexicon_version },
    round2: { file: 'round-2/diff.json', cohort: 'r2/cohort.json' },
    doc_fix_after_lanes: CLASSIFY.old_sentences,
  },
  normalisation: NORMALISATION_NOTES,
  counts: {
    records: rows.length,
    by_role: Object.fromEntries(ROLES.map((role) => [role, rows.filter((r) => r.role === role).length])),
    by_origin: Object.fromEntries(ORIGINS.map((o) => [o, rows.filter((r) => r.origin === o).length])),
    unseen_records: rows.filter((r) => r.role === 'unseen').length,
    disagreements_core_fields: coreDis.length,
    disagreements_supplementary_secondary_jobs: disagreements.filter((d) => d.supplementary).length,
    records_with_any_core_disagreement: new Set(coreDis.map((d) => d.slug)).size,
    route_disagreements: routeDis.length,
    disagreements_by_class: sortObj(coreDis.reduce((m, d) => { m[d.classification] = (m[d.classification] || 0) + 1; return m; }, {})),
    disagreements_by_root_cause: sortObj(coreDis.reduce((m, d) => { m[d.root_cause] = (m[d.root_cause] || 0) + 1; return m; }, {})),
    records_by_root_cause: Object.fromEntries(Object.entries(coreDis.reduce((m, d) => { (m[d.root_cause] = m[d.root_cause] || new Set()).add(d.slug); return m; }, {})).map(([k, v]) => [k, [...v].sort()]).sort((x, y) => (x[0] < y[0] ? -1 : 1))),
    records_by_class: Object.fromEntries(['a', 'b', 'c', 'd'].map((k) => [k, new Set(coreDis.filter((d) => d.classification === k).map((d) => d.slug)).size])),
    old_sentence_disagreements: coreDis.filter((d) => d.old_sentence).length,
    route_split_records: routeDis.map((d) => ({ slug: d.slug, name: d.name, A: d.A, B: d.B, class: d.classification, root_cause: d.root_cause, right_lane: d.right_lane })),
    unclassified_disagreements: unclassified,
  },
  overall_agreement: overallAgreement,
  field_agreement: fieldAgreement,
  route_agreement_by_pair_rule: routeAgreementByRule,
  round2_to_round3: round2Comparison,
  ruling_effects: { summary: rulingSummary, products: rulingEffects },
  hold_normalisation_check: holdCheck,
  unseen: { round3_unseen_slots: rows.filter((r) => r.role === 'unseen').length, note: 'No unseen slots in round 3. The unseen criterion was met in round 2 (round-2/diff.json) and is not re-tested.', round2_lock_entry: r2Unseen },
  coverage_per_subtype_agreed: coverageTable,
  smoothing_styler: smoothingDetail,
  lock_criteria: lockCriteria,
  packet_checks: packetChecks,
  disagreements,
  lane_A_reported_ambiguities: CLASSIFY.lane_A_ambiguities,
  lane_B_ambiguous_rules: B.ambiguous_rules,
  reported_ambiguity_map: CLASSIFY.reported_ambiguity_map,
  rule_gap_register: CLASSIFY.rule_gap_register,
  packet_issues: CLASSIFY.packet_issues,
  owner_questions: CLASSIFY.owner_questions,
  lane_errors: CLASSIFY.lane_errors,
};
fs.writeFileSync(path.join(__dirname, 'diff.json'), JSON.stringify(out, null, 2) + '\n');

if (process.argv.includes('--summary')) {
  console.log(JSON.stringify({ counts: out.counts, overall: out.overall_agreement, r2r3: Object.fromEntries(Object.entries(round2Comparison).filter(([k]) => !['persisting', 'resolved', 'new_in_round3'].includes(k))), rulings: rulingSummary, hold: { n: holdCheck.products_where_either_emits_a_level, mismatches: holdCheck.mismatches }, coverage: coverageTable.map((c) => `${c.subtype} ${c.committed_agreed}+${c.held_agreed} (r2 ${c.round2_total_agreed}) disputed ${c.disputed}`), lock: lockCriteria }, null, 2));
}
if (process.argv.includes('--dump')) {
  for (const d of disagreements) {
    if (process.argv.includes('--core') && d.supplementary) continue;
    console.log(`\n### ${d.slug} [${d.role}/${d.origin}] ${d.field}${d.supplementary ? ' (supp)' : ''} :: ${d.classification} ${d.root_cause || ''}`);
    console.log('  A =', JSON.stringify(d.A), '\n  B =', JSON.stringify(d.B));
    console.log('  A path:', d.A_rule_path.slice(0, 1400));
    console.log('  B path:', d.B_rule_path.slice(0, 700));
  }
}

// TABLES_BEGIN
// --tables: print the report's full markdown tables (built from the same output object) to stdout.
function markdownTables(d) {
  const v = (x) => (x && typeof x === 'object' && !Array.isArray(x) && 'T_LI' in x && 'T_S' in x ? `T_S ${x.T_S ? `${x.T_S.inci} r${x.T_S.rank} ${x.T_S.status}` : '—'}; T_LI ${x.T_LI ? `${x.T_LI.inci} r${x.T_LI.rank} ${x.T_LI.status}` : '—'}` : x === null ? '—' : Array.isArray(x) ? (x.length ? x.join(', ') : '[]') : typeof x === 'object' ? JSON.stringify(x).replace(/"/g, '') : String(x));
  const esc = (s) => String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ');
  const fa = d.field_agreement; const n = d.counts;
  let o = '';
  o += `### T1. Field agreement (A vs B, after normalisation)\n\n| Field | All ${n.records} | Where either lane emitted | Calibration (${n.by_role.calibration}) | Neg. control (${n.by_role.negative_control}) | Carried (${n.by_origin.carried}) | New (${n.by_origin.new}) | R2-unseen now calibration (8) | Disagreements |\n|---|---|---|---|---|---|---|---|---|\n`;
  for (const [f, x] of Object.entries(fa)) {
    if (f === 'tail_T_S' || f === 'tail_T_LI') continue;
    const sup = ['secondary_jobs', 'ingredient_flags'].includes(f);
    o += `| ${f}${sup ? ' (supplementary)' : ''} | ${x.all.agree}/${x.all.n} (${x.all.pct} %) | ${x.all.agree_where_emitted}/${x.all.emitted_by_either} (${x.all.pct_where_emitted} %) | ${x.calibration.pct} % | ${x.negative_control.pct} % | ${x.carried.pct} % | ${x.new.pct} % | ${x.round2_unseen_now_calibration.pct} % | ${x.all.n - x.all.agree} |\n`;
  }
  for (const f of ['tail_T_S', 'tail_T_LI']) { const x = fa[f]; o += `| ↳ ${f} | ${x.all.agree}/${x.all.n} (${x.all.pct} %) | — | ${x.calibration.pct} % | ${x.negative_control.pct} % | ${x.carried.pct} % | ${x.new.pct} % | ${x.round2_unseen_now_calibration.pct} % | ${x.all.n - x.all.agree} |\n`; }
  o += '\n### T2. Overall agreement (21 core fields)\n\n| Subset | Cells agree | Emitted cells agree | Records with all 21 fields equal |\n|---|---|---|---|\n';
  for (const [k, x] of Object.entries(d.overall_agreement)) o += `| ${k} (${x.records}) | ${x.cells_agree}/${x.field_cells} (${x.pct_cells} %) | ${x.emitted_cells_agree}/${x.emitted_cells} (${x.pct_emitted_cells} %) | ${x.records_all_fields_agree}/${x.records} (${x.pct_records} %) |\n`;
  const r2 = d.round2_to_round3;
  o += `| round 2, same 139 records | ${r2.round2_overall_all_139.cells_agree}/${r2.round2_overall_all_139.field_cells} (${r2.round2_overall_all_139.pct_cells} %) | — | ${r2.round2_overall_all_139.records_all_fields_agree}/139 |\n`;
  o += '\n### T3. Route agreement per pair rule / boundary reason\n\n| Reason (canonical) | Records (either lane) | Route agrees | Reason agrees |\n|---|---|---|---|\n';
  for (const x of d.route_agreement_by_pair_rule) o += `| ${x.reason_code} | ${x.records} | ${x.route_agree} | ${x.reason_agree} |\n`;
  o += '\n### T4. Route splits\n\n| Product | A | B | Class | Root cause | Right lane |\n|---|---|---|---|---|---|\n';
  for (const x of d.counts.route_split_records) o += `| ${esc(x.name)} (\`${x.slug}\`) | ${x.A} | ${x.B} | ${x.class} | ${x.root_cause} | ${x.right_lane || '—'} |\n`;
  o += '\n### T5. Every core-field disagreement\n\nRoute splits cascade into every Styling field of the record; those cells carry the record\'s root cause. „Path" = the lane\'s route · boundary/pair rule · reason as emitted (full rule paths and notes are in `diff.json` → `disagreements[].A_rule_path / B_rule_path`). OS = may trace to a pre-0f8af0ff sentence.\n\n| # | Product | Field | A | A path | B | B path | Class | Root cause | Right lane | OS |\n|---|---|---|---|---|---|---|---|---|---|---|\n';
  let i = 0;
  for (const x of d.disagreements.filter((y) => !y.supplementary)) { i++; o += `| ${i} | ${esc(x.name)} (\`${x.slug}\`) | ${x.field} | ${esc(v(x.A))} | ${esc(x.A_path_short)} | ${esc(v(x.B))} | ${esc(x.B_path_short)} | ${x.classification} | ${x.root_cause} | ${x.right_lane || '—'} | ${x.old_sentence || '—'} |\n`; }
  o += '\n### T6. secondary_jobs disagreements (supplementary)\n\n| Product | A | B | Root cause |\n|---|---|---|---|\n';
  for (const x of d.disagreements.filter((y) => y.supplementary)) o += `| \`${x.slug}\` | ${v(x.A)} | ${v(x.B)} | ${x.root_cause} |\n`;
  o += '\n### T7. Round 2 → round 3 on the 139 carried records\n\n';
  o += `Round-2 core disagreements on these records: ${r2.round2_core_disagreements_on_carried} (on ${r2.round2_overall_all_139.records_with_core_disagreement} records); resolved in round 3: ${r2.resolved_core}; persisting: ${r2.persisting_core}; new in round 3: ${r2.new_core_in_round3} (on ${r2.new_core_records_in_round3} records). secondary_jobs: resolved ${r2.resolved_secondary_jobs}, persisting ${r2.persisting_secondary_jobs}, new ${r2.new_secondary_jobs}.\n\n`;
  o += '| Persisting (core) | Field | Round-2 cause | Round-3 A | Round-3 B | Round-3 cause |\n|---|---|---|---|---|---|\n';
  for (const x of r2.persisting.filter((y) => y.field !== 'secondary_jobs')) o += `| \`${x.slug}\` | ${x.field} | ${x.round2_root_cause} | ${esc(v(x.round3_A))} | ${esc(v(x.round3_B))} | ${x.round3_root_cause} |\n`;
  o += '\n| Resolved round-2 cause | Cells |\n|---|---|\n';
  for (const [k, c] of Object.entries(r2.resolved_by_round2_root_cause)) o += `| ${k} | ${c} |\n`;
  o += '\n| New round-3 cause | Cells |\n|---|---|\n';
  for (const [k, c] of Object.entries(r2.new_by_round3_root_cause)) o += `| ${k} | ${c} |\n`;
  o += '\n### T8. Did each round-2 ruling / fix reach its products? (both lanes\' round-3 values vs the ruled outcome)\n\n| Ruling | Product | Ruled | A | B | Effect |\n|---|---|---|---|---|---|\n';
  for (const x of d.ruling_effects.products) o += `| ${x.ruling} | \`${x.slug}\` | ${esc(x.fields.map((f) => `${f.field} ${v(f.ruled)}`).join('; '))} | ${esc(x.fields.map((f) => (f.A_matches ? '✓' : v(f.A))).join('; '))} | ${esc(x.fields.map((f) => (f.B_matches ? '✓' : v(f.B))).join('; '))} | ${x.effect === 'intended_effect_both_lanes' ? 'both' : x.effect === 'one_lane_only' ? '**one lane**' : '**neither**'} |\n`;
  o += '\n### T9. Hold levels — every product where either lane emits one\n\n| Product | Subtype | A | B | Same |\n|---|---|---|---|---|\n';
  for (const h of d.hold_normalisation_check.all_rows) o += `| ${esc(h.name)} (\`${h.slug}\`) | ${h.subtype} | ${v(h.A)} | ${v(h.B)} | ${h.same ? 'yes' : '**no**'} |\n`;
  o += '\n### T10. Coverage per subtype (A and B agree on route kind and subtype)\n\n| Subtype | Committed | Held (PH2-2) | Total | Round 2 total | ≥ 5 committed | ≥ 5 incl. held | Disputed |\n|---|---|---|---|---|---|---|---|\n';
  for (const c of d.coverage_per_subtype_agreed) o += `| ${c.subtype} | ${c.committed_agreed} | ${c.held_agreed} | ${c.total_agreed} | ${c.round2_total_agreed} | ${c.meets_5_committed_only ? 'yes' : '**no**'} | ${c.meets_5_incl_held ? 'yes' : '**no**'} | ${c.disputed_slugs.join(', ') || '—'} |\n`;
  o += '\n### T11. Lock criteria (PH1-11 as adjusted by PH1-16), computed\n\n| Criterion | Met | Numbers |\n|---|---|---|\n';
  for (const c of d.lock_criteria) o += `| ${esc(c.criterion)} | ${c.met ? 'yes' : '**no**'} | ${esc(c.numbers)} |\n`;
  const pc = d.packet_checks;
  o += `\n### T12. Packet checks (computed)\n\nHold entries whose words carry a strength word not in their own text: ${pc.hold_words_not_in_text.count} (levels split on: ${pc.hold_words_not_in_text.levels_split.join(', ')}).\n\n| Product | Hold text | Words | Strength word not in text | A | B |\n|---|---|---|---|---|---|\n`;
  for (const x of pc.hold_words_not_in_text.records) o += `| \`${x.slug}\` | ${esc(x.text)} | ${esc(x.words)} | ${x.strength_words_not_in_text.join(', ')} | ${v(x.A_level)} | ${v(x.B_level)} |\n`;
  o += `\nUnrepaired INCI transcription defects: ${pc.inci_transcription_defects.count}.\n\n| Product | Rank | As in packet | Flagged in packet |\n|---|---|---|---|\n`;
  for (const x of pc.inci_transcription_defects.records) o += `| \`${x.slug}\` | ${x.rank} | ${esc(x.inci)} | ${x.flagged_in_packet ? 'yes' : '**no**'} |\n`;
  o += `\nConfirmed names stamped C3 in the claims packet: ${pc.confirmed_name_tier_C3.count} — ${pc.confirmed_name_tier_C3.slugs.join(', ')}.\n`;
  return o;
}
if (process.argv.includes('--tables')) process.stdout.write(markdownTables(out));
// TABLES_END
