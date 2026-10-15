#!/usr/bin/env node
// Calibration round 2 — deterministic diff of blind lane A (Claude Opus) vs blind lane B (Codex)
// on the frozen round-2 cohort (139 records), plus unseen scoring against the sealed pre-registered
// expectations r2, a round-1 -> round-2 comparison on the 107 carried records, and an S0 redaction check.
//
// Usage: node data/research/styling-inci/v1.0/round-2/diff.js [--summary] [--tables] [--dump]
// Writes round-2/diff.json only. Reads frozen inputs (lanes, sealed file, r2 cohort + packets, round-1 diff.json);
// never edits them. Deterministic: no clock, no randomness, fixed key order; two runs give byte-identical output.
// Generic helpers are copied from round-1/diff.js (requiring it would rewrite round-1/diff.json).

'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const A = read('blind-lane-A-r2/results.json');
const B = read('blind-lane-B-r2/results.json');
const S = read('sealed/unseen-expectations-r2.json');
const C = read('r2/cohort.json');
const R1 = read('round-1/diff.json');
// Analyst classifications (judgment, recorded in-script so the output is reproducible).
// CLASSIFY_BEGIN
const CLASSIFY = (() => {
  // class: a = lane error (one lane misapplied a clear rule), b = rule gap/ambiguity, c = data/packet issue, d = needs an owner ruling
  const D = {};
  const set = (keys, v) => { for (const k of keys) D[k] = v; };
  const R = {}; // whole-record default (route splits: every cascading field shares the record's root cause)

  // ---------------- route splits ----------------
  R['osis-sparkler'] = { class: 'c', root_cause: 'P2-1', right: 'A', comment: 'S0 redaction blanked every job word of the lead: „Glanz-Spray", „glänzendes", „Finish" ⇒ „[CLAIM]-Spray für sofort glamouröses [CLAIM] Haar … leichtes [CLAIM]"; the residual text reads care/anti-frizz/heat. B stopped at evidence_gate (lead job „redacted beyond determination"); A read shine ⇒ 3.5 ⇒ shine_finish. §4.1 counts a redacted promise line as present (FREEZE-NOTES §5), so evidence_gate is not a valid reason; on the unredacted text the lead is a shine spray ⇒ A. A reached it by inference from „glamourös"/„Sparkler", which a blind lane should not have to do. Hold 0 vs null and all Styling fields cascade.' };
  R['balea-finishing-spray-glow-und-care'] = { class: 'c', root_cause: 'P2-1', right: 'A', comment: 'Name „Finishing Spray Glow & Care" ⇒ S0 „[CLAIM] Spray Glow & Care"; the only job-bearing C2 line „Finishing Spray" ⇒ „[CLAIM] Spray"; directions also redacted. B: evidence_gate („claims packet cannot repair S0"); A reconstructed „Finishing Spray" ⇒ finish lead, „pflegendem Camelinaöl" a call-out (SFS-15) ⇒ 3.4(ii) shine_finish. Unredacted: A. Distinct GTIN from the Glow&Shine spray (P-5 resolved the A7 duplicate question).' };
  R['got2b-gotgloss-glanz-spray'] = { class: 'c', root_cause: 'P2-2', right: 'A', comment: 'Frozen identity_status inci_conflict, but the two lists differ only by Benzyl Alcohol r14 vs Tetramethyl Acetyloctahydronaphthalenes + Citrus Aurantium Peel Oil in the fragrance/allergen block; LI §2.4.2 („What counts as a conflict"): fragrance/allergen granularity is not a set conflict. A applied T18 ⇒ verified_with_minor_source_difference ⇒ S0 runs; B kept the packet stamp ⇒ formula_conflict. A is right on identity. Second defect: the lead „Bis zu 48h spiegelglänzendes Haar" is fully redacted to „[CLAIM] Haar" (P2-1); A inferred shine and then chose smoothing_styler (pre-iron directions, RG2-15).' };
  R['schwarzkopf-taft-x-gliss-silky-shine-shine-coat'] = { class: 'c', root_cause: 'P2-1', right: 'A', comment: 'Name „Glanz-Spray taft x Gliss Silky Shine" ⇒ S0 „[CLAIM]-Spray taft x Gliss Silky [CLAIM]": both name job words blanked. On the packet as given §4.2 step 1 cannot run, step 3 = first C2 line „Mit veganem Keratin, Styling & Pflege in einem" ⇒ co-equal ⇒ mixed (B; also the round-1 result of both lanes). On the unredacted name (one job: shine) step 1 decides ⇒ styling_result ⇒ 3.5 (A). A reconstructed the blanked words. Subtype (A smoothing_styler, pre-heat directions) is RG2-15.' };
  R['balea-glattspray-anti-frizz'] = { class: 'a', root_cause: 'E2-1', right: 'A', comment: 'LI §2.3.2: excluded_styling_first needs both halves — architecture (VP/VA r3, thin conditioning ✓) AND C1/C2 positioning on durable hold or texture. The C2 lines are smoothing/anti-frizz („Glattspray", „seidig-glattes Haargefühl", „Wirkt Frizz entgegen") with damp-hair directions — an included LI use ⇒ clause 2 ⇒ provisional_boundary (li_g0_provisional). B emitted excluded_styling_first ⇒ styling smoothing_styler. Both lanes had li_g0_provisional in round 1.' };
  R['balea-haarserum-anti-frizz-glatt-und-glossy'] = { class: 'd', root_cause: 'RG2-2', comment: 'Registry (§4.6, „Balea Anti-Frizz Serum … leave_in, D6 examples, S0 letter: same") vs the v0.2 letter: anti-frizz lead + sold as „Haarserum" ⇒ 3.1 in scope; RG-15 exception needs an LGN pair or cationic above T_LI — Behentrimonium Chloride r12 sits just below T_LI Ethylhexylglycerin r11 ⇒ exception fails ⇒ oil (A). A registry override is allowed only for promise-evidence failures (§4.1), so A emitted the letter; B applied the registry (leave_in). RG-15 (written for the Glow & Shine serum) unintentionally moves a registered Leave-in product to Oil. Owner question Q2.' };
  for (const sl of ['bali-curls-hydrating-curl-cream', 'cantu-lockencreme-kokos', 'hask-lockencreme-curl-care']) {
    R[sl] = { class: 'a', root_cause: 'E2-2', right: 'A', comment: 'Both lanes read the letter as care + curl definition ⇒ mixed (R1-Q3) with D7 not firing. The §4.6 registry row v0.2 says for exactly these three curl creams: „where the C1/C2 promise covers care and curl definition, the letter reads mixed (R1-Q3) and the ruling overrides it (§4.1 (c))" ⇒ leave_in (A). R1-H2 itself says owner-named routes stand. B stopped at mixed_promise. (Cantu Kokos also carries a possible-split INCI flag the S0 packet does not show, P2-3/P2-4.)' };
  }
  R['neqi-diamond-glass-styling-spray-all'] = { class: 'a', root_cause: 'E2-3', right: 'A', comment: 'Lead = first C2 paragraph („… glatten Glass-Hair-Effekt. Es kombiniert Styling-Unterstützung mit Hitzeschutz …") plus the bullet „Styling + Hitzeschutz in einem": the lead joins styling and heat protection itself (§4.2 co-equal, cf. the anchor „Styling und Schutz in einem") ⇒ mixed ⇒ provisional_boundary (A). B read styling_result ⇒ leave_in, although B read the identical shape on the Ultimate sibling as mixed. The Ultimate ruling (§4.6) does not name this „All" variant (RG2-25). The freeze also flags this INCI as possibly truncated (blocking), which the S0 packet does not show (P2-3).' };
  R['redken-refreshing-curl-mist'] = { class: 'd', root_cause: 'RG2-1', comment: 'Name „Refreshing Curl Mist" (curl revival) + C2 „… REVITALISIERT UND REAKTIVIERT LOCKEN" + closing „Für [CLAIM] gestylte und gepflegte Locken". A: „gepflegte" is an adjective on the result, secondary ⇒ styling_result ⇒ D6 (no real care above the yardstick) ⇒ held refresher. B: R1-H2 (a care adjective is the care half) + curl ⇒ mixed ⇒ mixed_promise. Both readings are defensible under v0.2 (R1-H2 „adjective" vs SFS-15 „care call-out never makes mixed"; and whether curl revival is „curl definition"). Owner question Q1.' };
  R['wella-eimi-nutricurls-fresh-up'] = { class: 'd', root_cause: 'RG2-1', comment: 'Name „Curl Refreshing Detangling Spray" + C2 „Anti-Frizz-Effekt …" + „… um die Locken zu reaktivieren". A: the care word „Detangling" in the name is the care half (R1-H2) + curl ⇒ mixed. B: styling_result ⇒ 3.4(iii) ⇒ D6 real care (PQ-10 above the pH yardstick) ⇒ leave_in. Same R1-Q3 scope question (is detangling „care"; is curl reactivation „curl definition"). Note P2-6: both C2 lines come from lookfantastic.de (a retailer ⇒ C3), so on a correct tier stamp the record stops at evidence_gate. Owner question Q1.' };

  // ---------------- single-field disagreements ----------------
  D['alcina-foehn-lotion::primary_job'] = { class: 'b', root_cause: 'RG2-6', comment: 'Lead C2 „Sorgt für mehr Schwung & [CLAIM] (Elastizität) im Haar". „Schwung" and „Elastizität" have no §6.10 job mapping. A volume; B review. Lean A (bounce/body is the volume job of a blow-dry lotion).' };
  set(['alverde-locken-refresh-spray::application_moment', 'cantu-lockenspray-comeback-curl-next-day::application_moment', 'john-frieda-frizz-ease-zauberformel-seiden-finish-creme::application_moment'],
    { class: 'b', root_cause: 'RG2-8', comment: 'Dry-hair application with no explicit shaping step (strand-by-strand spraying to revive curls; a cream rubbed between the palms and distributed through dry hair). §6.11 anchors: dry_finish „applied over the finished style, with no further shaping" vs dry_restyle „applied to dry hair, then shaped by hand or comb". A dry_finish, B dry_restyle. §11.6 (alverde) is the worked example both lanes cite.' });
  D['balea-haargel-hair-jelly::reason_code'] = { class: 'a', root_cause: 'E2-12', right: 'A', comment: 'v0.2 §4.2 defines the lead (name job word; else first C1; else first C2). Lead = first house-brand C2 line „Styling-Gelee für das Haar" (shaping, no LI function) ⇒ li_function no ⇒ 3.4(ii) (A). B took li_function yes from the third line „Ideal für Sleek-Looks & Locken" (a suitability line) ⇒ 3.4(iii) excluded_styling_first. Same route. Persisting from round 1 (RG-6), now decidable by the v0.2 lead rule.' };
  set(['balea-haargel-hair-jelly::hold_level', 'balea-haargel-hair-jelly::neutral_fact'], { class: 'c', root_cause: 'P2-5', comment: 'The C2 hold claim text is „flexiblen Halt" (no strength word ⇒ null + neutral fact, A; standard §7.6 lists this product as a null-level neutral-fact record). The claims packet\'s words field also carries „soft", which is not in the claim text and has no provenance (possibly the dm „Halt" attribute, which PH2-7 would count). B read „soft" ⇒ level 1 ⇒ no neutral fact. Re-capture: if „soft" is the dm attribute, record it as its own C2 house-brand hold claim (then 1, B); otherwise drop it (null, A).' });
  D['balea-leave-in-spray-sea-salt-care-define::promise_class'] = { class: 'd', root_cause: 'RG2-1', comment: 'Name „Leave-In Spray Sea Salt Care & Define": A reads „Care" (name) + „Define" ⇒ care + definition ⇒ mixed (R1-H2), then the §4.6 registry override (§4.1 (c)) ⇒ held salt_spray. B: lead = first C2 „Texturgebendes Haarspray" ⇒ styling_result; „pflegender Ölphase" is a call-out (SFS-15). Route and profile identical (held salt_spray). Same R1-Q3/R1-H2 scope question (Q1).' };
  set(['balea-locken-crunchgel::tail_markers', 'cantu-lockencreme-kokos::tail_markers'], { class: 'c', root_cause: 'P2-4', comment: 'Same marker species; ranks differ by the number of split INCI tokens re-joined. Crunchgel packet carries unflagged split tokens („HYDRO" + „LYZED CORN STARCH", „POLYGLYCERYL" + „6 CAPRYLATE", „POLYGLYCERYL" + „4 CAPRATE"); Cantu Kokos carries the flagged split „SIMMONDSIA CHINENSIS (JOJOBA)" + „SEED OIL". A re-joined and renumbered (r7/r8; r34), B re-joined but kept the packet ranks (r10/r11; r35). No value moves.' });
  D['balea-overnight-wellenspray::reason_code'] = { class: 'b', root_cause: 'RG2-5', comment: 'Lead „Styling-Spray für Locken über Nacht": A reads curl setting as shaping/hold ⇒ li_function no ⇒ 3.4(ii); B reads curl support ⇒ li_function yes ⇒ 3.4(iii) excluded_styling_first. Same route. Sealed: soft (lean 3.4(iii), alternatives 3.4(ii) and 3.5 accepted).' };
  D['balea-overnight-wellenspray::subtype'] = { class: 'b', root_cause: 'RG2-13', comment: 'No §5 anchor for a heatless overnight wave/curl setting spray. A mousse (wave/curl lift, damp, hold), B gel. Sealed UNDETERMINED (lean gel; gel/hairspray/mousse acceptable; salt_spray is the trap — neither lane fell in).' };
  D['balea-professional-glow-und-shine-finishing-spray::primary_job'] = { class: 'c', root_cause: 'P2-1', right: 'A', comment: 'Name „Leave-In Glow&Shine Finishing Spray" ⇒ S0 „Leave-In Glow&[CLAIM] Spray": the claims packet has no name and the S0 name lost „Shine" and „Finishing". Unredacted, the name names one job (shine/finish) ⇒ §4.2 step 1 ⇒ primary shine (A). B went to step 2 (first C1 line „ANTI-FRIZZ-EFFEKT") ⇒ frizz_control. Route identical (committed shine_finish, R1-Q2).' };
  D['balea-professional-styling-cream-traumlocken::promise_class'] = { class: 'a', root_cause: 'E2-11', right: 'A', comment: 'Worked example §11.2 (binding): class mixed (definition + „Verbesserte Geschmeidigkeit" + heat line) ⇒ PH1-12 D7 fires ⇒ curl_cream, held. A mixed; B styling_result. No value moves (both held curl_cream).' };
  D['balea-pure-styling-volumenpuder-spray::reason_code'] = { class: 'a', root_cause: 'E2-4', right: 'A', comment: 'INCI Butane, Propane, Isobutane, Alcohol denat., starches, Silica, Panthenol, Tocopheryl Acetate: no water declared ⇒ non-aqueous ⇒ 3.5 (A). 3.4 requires an aqueous formula (§4.3); B emitted 3.4(ii). Same route.' };
  set(['balea-styling-creme-power-flex::finish', 'moroccanoil-root-boost::finish'], { class: 'b', root_cause: 'RG2-11', comment: '„natürlich aussehendes Finish": RG-10 makes natürlich a finish word only „with Finish, Look or Glanz next to it"; here „aussehendes" sits between. A natürlich (natural-looking finish = natürliches Finish), B unbekannt (§7.4 lists „natürlich aussehend" as a look word). Lean A.' });
  D['balea-styling-finishing-stick::primary_job'] = { class: 'c', root_cause: 'P2-1', right: 'B', comment: 'Unredacted C1 lines „fixiert Babyhaare und Frizz" (claims packet) ⇒ first job-bearing phrase „fixiert" ⇒ hold_fix (RG-11: fixing/shaping ⇒ hold_fix) (B). A read the redacted S0 line „[CLAIM] Babyhaare und Frizz" ⇒ frizz_control. C fields belong to the claims normalisation over claims[] (§10.2), so the claims packet is the right source; the name „Fixierungsbürste Styling Finishing Stick" (two job words) is in neither packet unredacted.' };
  set(['bali-curls-volumizing-curl-spray-refreshing::target_zone', 'got2b-styling-puder-volumen-powderfull::target_zone', 'john-frieda-frizz-ease-traumlocken-lockencreme::target_zone', 'moroccanoil-volumizing-spray::target_zone', 'schwarzkopf-taft-haarpuder-volumen::target_zone', 'john-frieda-frizz-ease-zauberformel-seiden-finish-creme::target_zone'],
    { class: 'b', root_cause: 'RG2-10', comment: 'Range or emphasis wording: „vom Ansatz bis in die Spitzen" (got2b Powderfull, JF Traumlocken, Moroccanoil Volumizing, Taft Haarpuder: A all, B roots — RG-9 „first-named site" read literally); „beginnend an den Spitzen … zum Ansatz" (Bali Curls Volumizing: A all, B lengths); „im trockenen Haar verteilen … besonders auf abstehende Härchen" (Zauberformel: A all, B surface). Lean A: a range covering the whole length is the whole hair.' });
  set(['bumble-and-bumble-brilliantine::promise_class', 'color-wow-dream-coat-supernatural-spray::promise_class', 'loreal-paris-elnett-stylingspray-hitzeschutz-3-tage-glatt::promise_class'],
    { class: 'a', root_cause: 'E2-5', right: 'A', comment: 'Promise class is assigned from C1/C2 claims by S0 step 2 (§4.2). Brilliantine and Color Wow carry C3 claims only — the ruled route applies under §4.1 (a) with no-claim values; Elnett 3 Tage Glatt stops at the evidence gate (directions missing), so step 2 never runs. A: not assigned; B: styling_result (the ruling\'s class). Persisting round-1 E-6 pattern; no value moves.' });
  D['guhl-foehn-spray-langzeit-volumen::heat_activated'] = { class: 'a', root_cause: 'E2-10', right: 'B', comment: 'heat_activated is a U field read from the F/U packet directions („Vor dem Föhnen aufsprühen") ⇒ no for the blind round (B). A raised it to yes from the S0 name variant „Föhn-Aktiv Styling Spray"; activation claims are a post-unblinding C raise (property set §7 crossing 1). The final record is yes (property-set calibration: C1 „aktiviert durch die Föhnhitze"). Persisting round-1 E-5.' };
  D['john-frieda-frizz-ease-zauberformel-seiden-finish-creme::tail_markers'] = { class: 'a', root_cause: 'E2-9', right: 'A', comment: 'T_LI Ethylhexylglycerin r20; everything at/below it is closed set (a) Phenoxyethanol, (b) Citrus Aurantium/Limon Peel Oil after Parfum r13 (RG-1, v0.2), Hexamethylindanopyran, Hexyl Cinnamal, Limonene, Linalool, Linalyl Acetate, TAN ⇒ vacuous (A). B plausible. No value moves (3.4(ii) path does not read T_LI).' };
  D['john-frieda-frizz-ease-zauberformel-seiden-finish-creme::primary_job'] = { class: 'b', root_cause: 'RG2-7', comment: 'Lead „Glättet abstehende Haare, verleiht [CLAIM] und bändigt Frizz": first job-bearing phrase „glättet abstehende Haare" = smoothing (sleek, A) or flyaway control (frizz_control, B). §6.10 maps „anti-frizz/flyaway" to frizz_control and has no rule for „glätten" of flyaways.' };
  set(['kevin-murphy-killer-curls::weight', 'kevin-murphy-killer-curls::buildup_note'], { class: 'a', root_cause: 'E2-7', right: 'A', comment: 'Lanolin Wax r2 is a rich member for Styling weight (PH2-12: waxes and lanolin) ⇒ weight rich ⇒ buildup limb 2 fires (A; both lanes in round 1). B: „no rich member" ⇒ medium, no note.' });
  D['loreal-paris-elnett-haarspray-extra-starker-halt::flexibility'] = { class: 'b', root_cause: 'RG2-12', comment: 'C1 „Stylen, Ausbürsten, wieder Stylen". A beweglich (= neu formbar / nachstylbar, §6.9); B unbekannt („ausbürstbar" is not a flexibility word, PH2-11). Lean A: the line states restyling, not only brushing out.' };
  set(['redken-powder-grip-03::application_moment', 'redken-root-tease::application_moment'], { class: 'b', root_cause: 'RG2-9', comment: 'Directions apply and then shape (knead through with fingers; tease) but state no moisture state. A dry_restyle; B unresolved („spray-only fallback does not apply"). Same gap as sealed slot 3 (UNDETERMINED: dry_restyle or unresolved).' });
  D['schwarzkopf-professional-osis-curl-retouch::tail_markers'] = { class: 'a', root_cause: 'E2-8', right: 'A', comment: 'T_LI Phenoxyethanol r4 outranks Stearamidopropyl Dimethylamine r6 and Behentrimonium Chloride r7, which establish COND ⇒ implausible (LI §3.1.1 clause 5 / T16) (A). B plausible (both lanes plausible in round 1). No value moves (leave_in either way).' };
  D['syoss-curl-cream-gel-3in1::subtype'] = { class: 'b', root_cause: 'RG2-14', comment: 'Packet format „cream"; promise and directions call it „Gel" (and describe a cast to scrunch out). §5 tie-break gel vs curl_cream: „gel/jelly/spray-gel form ⇒ gel", with the Power Flex precedent (sold as „Styling Creme", a gel ⇒ gel). A gel (round-1 result of both lanes), B curl_cream (format field). Lean A.' };
  set(['syoss-curl-cream-gel-3in1::primary_job', 'wella-eimi-nutricurls-curl-shaper::primary_job'], { class: 'b', root_cause: 'RG2-5', comment: 'Curl nouns and shaping verbs: Syoss „Gel hilft dabei, Locken zu formen und zu definieren" — RG-11 maps shaping to hold_fix (A) but „Locken formen" is curl definition (B). Nutricurls „Curl Shaper (Defining Gel Cream)" — A: the name names one job (curl definition); B: two job words (Shaper, Defining) ⇒ first C2 line „bändigt Frizz" ⇒ frizz_control.' });
  D['syoss-professional-performance-max-hold-power-wax::primary_job'] = { class: 'b', root_cause: 'RG2-4', comment: 'Lead „Intensiver Halt für glatte und glänzende, langanhaltende Looks". RG-11: strength phrases are not job-bearing unless nothing else is ⇒ first job phrase „glatte" ⇒ sleek (B, the letter). A hold_fix (the lead\'s subject is hold). The letter turns a hold-led wax into a sleek product; the rule was written for „Gel … mit mittlerem Halt".' };
  D['wella-eimi-glam-mist-shine-spray::reason_code'] = { class: 'a', root_cause: 'E2-6', right: 'A', comment: 'B emitted the reason „dry_hair_finish" with rule_path „§4.2;R1-Q2;§4.3" and no pair rule. R1-Q2 sets li_function; the pair rule is still required (§10.1 pair_rule 3.1–3.5); Aqua r14 sits in the tail ⇒ non-aqueous ⇒ 3.5 (A; sealed firm). Route identical.' };

  const unseenMisses = {
    'wella-eimi-glam-mist-shine-spray::reason_code::B': { class: 'a', root_cause: 'E2-6', right: 'A', comment: 'sealed firm non_aqueous_styling_result (3.5); B named no pair rule (dry_hair_finish). Format-level miss; route, subtype and every property match.' },
  };
  const undeterminedGaps = {
    'balea-overnight-wellenspray::subtype': 'RG2-13',
    'balea-haarwachs-styling-stick::subtype': 'RG2-17',
    'got2b-kleber-4-brows-and-edges-2in1-stylinggel::application_moment': 'RG2-9',
    'redken-wax-spray::hold_level': 'RG2-18',
    'moroccanoil-glaettende-creme-smoothing-lotion::promise_class': 'RG2-1',
    'moroccanoil-glaettende-creme-smoothing-lotion::route': 'RG2-1',
    'moroccanoil-glaettende-creme-smoothing-lotion::reason_code': 'RG2-1',
  };
  const traps = {
    1: { exercised: 'caught_both', note: 'salt-free wave spray: neither lane chose salt_spray (A mousse, B gel; subtype itself UNDETERMINED, RG2-13); route styling, not held.' },
    2: { exercised: 'caught_both', note: 'hairline vs surface: both lanes target_zone surface („abstehende Härchen"), first real surface case; claims („Babyhaare") did not set U fields.' },
    3: { exercised: 'caught_both', note: 'edge + brow gel: both gel / hairline; „Kleber" read as rigidity (fest), hold 3 not 4 (RG-14).' },
    4: { exercised: 'caught_both', note: 'Trockenshampoo with volume/texture: both dry_shampoo via the refresh tie (3.2).' },
    5: { exercised: 'caught_both', note: 'heat + shine primer „3in1 Style, pflege": both mixed_promise, not heat_protectant or smoothing_styler.' },
    6: { exercised: 'caught_both', note: 'wax in spray form: both texture_spray, no wax above T_S (SFS-1), level 2 (the sealed value is UNDETERMINED 2/null, RG2-18).' },
    7: { exercised: 'caught_both', note: 'smoothing cream usable as Leave-in-Kur: both non-Styling and not Oil („Moroccanoil" never triggers D2); both chose mixed_promise, an acceptable answer of an UNDETERMINED route (RG2-1).' },
    8: { exercised: 'caught_both', note: 'hold claim on a shine spray: both D8b claim_formula_conflict, level 1 kept, no alcohol note (Alcohol Denat. r5). Lane B missed only the pair-rule code (E2-6).' },
  };

  const register = [
    { id: 'RG2-1', class: 'd', owner_question: 'Q1', section: 'standard §4.2 (R1-Q3 „care + curl definition ⇒ mixed"), R1-H2 („a care word in the name or an adjective is the care half") vs SFS-15 („a care or ingredient call-out never makes a promise mixed")', source: ['round-2 diff (Redken Refreshing Curl Mist route, Wella Nutricurls Fresh Up route, Balea Sea Salt Care & Define class)', 'sealed slot 7 UNDETERMINED (Moroccanoil Glättende Creme)', 'lane B ambiguous_rules §4.2;R1-Q3/R1-H2 vs SFS-15', 'lane A handback „R1-H2 breadth vs SFS-15"; lane A note Balea Locken Lotion'], issue: 'What counts as the care half (a care noun/verb stated as a job; a care word in the name such as „Detangling" or „Care"; an adjective on the result such as „gepflegte Locken"; an ingredient call-out) and what counts as the definition half (curl definition only, or also curl revival/reactivation and an unqualified „Definition").', records: ['redken-refreshing-curl-mist', 'wella-eimi-nutricurls-fresh-up', 'balea-leave-in-spray-sea-salt-care-define', 'moroccanoil-glaettende-creme-smoothing-lotion', 'balea-styling-locken-lotion'], impact: '2 route splits now; at scale every curl spray/refresher with a care word', proposed_fix: 'Add to §4.2 after the R1-Q3 paragraph: „The care half is a care job the C1/C2 promise states — moisturise, nourish, repair, condition, detangle (incl. those words in the confirmed name: Pflege-, Care, Detangling, Feuchtigkeits-). It is not an adjective describing the styled result („gepflegte Locken", „geschmeidige Locken"), a feel line („Verbesserte Geschmeidigkeit" stays care only where §11.2 says so) or an ingredient call-out (SFS-15 governs over R1-H2 for those). The definition half is a promise to define, shape or form curls/waves („definiert", „Definition" on a product for curly hair); reviving or reactivating curls (refresher job) is not definition." Replace R1-H2\'s „or an adjective" with „or a care word in the name".' },
    { id: 'RG2-2', class: 'd', owner_question: 'Q2', section: 'standard §4.3 3.1 RG-15 exception test vs §4.6 registry („Balea Anti-Frizz Serum … leave_in … S0 letter: same"); §4.1 override limits', source: ['round-2 diff (route split)', 'lane A handback „Balea Anti-Frizz Serum registry vs letter (oil)"; lane A review trigger registry_letter_divergence'], issue: 'RG-15 credits a cationic conditioner only above T_LI; Balea Anti-Frizz Serum has Cetearyl Alcohol r3 and Behentrimonium Chloride r12 one rank below T_LI Ethylhexylglycerin r11 ⇒ the exception fails ⇒ Oil, while the registry names it Leave-in and claims the letter agrees. The registry may not override a non-promise step (§4.1).', records: ['balea-haarserum-anti-frizz-glatt-und-glossy'], impact: '1 route (oil vs leave_in); any water-based „Serum" whose cationic sits just under the preservative', proposed_fix: 'Change the RG-15 test to the D6 dose rule: „Aqua above T_S and (an LGN pair above T_LI, or a cationic conditioner/cationic polymer above T_LI or below it down to — not including — the first pH adjuster after T_LI (PH1-13 R2 yardstick))". Balea Anti-Frizz Serum (BTAC r12, Citric Acid r20) ⇒ exception ⇒ 3.4 (iii) ⇒ leave_in, matching the registry; Glow & Shine serum unchanged.' },
    { id: 'RG2-3', class: 'd', owner_question: 'Q3', section: 'PH2-6 / standard §10.2 S0 packet („removes … finish/flexibility words") vs §4.2 lead-promise step 1 and §6.10 primary job', source: ['round-2 diff (OSiS Sparkler, Balea Finishing Spray Glow & Care, taft x Gliss Shine Coat routes; Glow&Shine and Finishing Stick primary jobs)', 'lane B ambiguous_rules §4.2;R1-H1;§10.2 („Some S0 redactions remove the complete lead-job wording")', 'P2-1'], issue: 'The finish words the S0 packet must remove (Glanz, Shine, Gloss, Finish, glänzend) are the job words of every shine product, and the confirmed name — §4.2 step 1 — is redacted while the claims packet carries no name at all. Lanes then either gate the product (B) or reconstruct the blanked words (A), which defeats blinding.', records: ['osis-sparkler', 'balea-finishing-spray-glow-und-care', 'schwarzkopf-taft-x-gliss-silky-shine-shine-coat', 'got2b-gotgloss-glanz-spray', 'balea-professional-glow-und-shine-finishing-spray', 'balea-styling-finishing-stick', 'wella-eimi-glam-mist-shine-spray'], impact: '3 route splits, 2 primary-job splits; blinding integrity', proposed_fix: 'PH2-6 amendment: „In the S0 packet, redact hold strength, flexibility and finish adjectives that grade a result (starker, flexibler, mattes, glänzendes as an adjective of Finish/Haar), hold numbers and scale words; keep nouns that name the product\'s job (Glanz-Spray, Glanzspray, Shine, Gloss, Finish, Finishing, Haarspray, Wachs, Puder) in the promise lines and the confirmed name. Add the unredacted confirmed name to the claims packet (it is a C1/C2 claim, §2.2 A3)."' },
    { id: 'RG2-4', class: 'b', section: 'standard §6.10 RG-11 (strength phrases not job-bearing)', source: ['round-2 diff (Syoss Max Hold Wax primary job)'], issue: 'A lead whose subject is the hold itself („Intensiver Halt für glatte und glänzende … Looks") loses hold_fix to the next adjective under RG-11.', records: ['syoss-professional-performance-max-hold-power-wax'], impact: 'primary job of hold-led molding/hairspray products', proposed_fix: 'Amend RG-11: „A strength phrase is not job-bearing when it qualifies a product noun or follows another job phrase („Gel mit mittlerem Halt"); when the hold is the lead\'s subject („Intensiver Halt für …", „Starker Halt –"), the lead states hold_fix."' },
    { id: 'RG2-5', class: 'b', section: 'standard §4.2 li_function („curl support"), §4.2 step 1 (name job-word count), §6.10 RG-11 („shaping ⇒ hold_fix")', source: ['round-2 diff (Overnight Wellenspray reason, Syoss Curl Cream Gel and Nutricurls Curl Shaper primary jobs)', 'lane A handback „curl noun as job word in names"', 'sealed slot 1 li_function soft'], issue: 'Curl nouns combined with setting/shaping verbs: is „Locken formen", „Curl Shaper", „Styling-Spray für Locken über Nacht" curl support/definition or shaping/hold; does „Curl Shaper (Defining Gel Cream)" name one job or two.', records: ['balea-overnight-wellenspray', 'syoss-curl-cream-gel-3in1', 'wella-eimi-nutricurls-curl-shaper'], impact: 'li_function (reason only here) and primary_job', proposed_fix: 'Add to §6.10 and §4.2: „A curl/wave noun with a shaping or setting verb („Locken formen", „Curl Shaper", „Wellen über Nacht") states curl definition (li_function yes, primary definition); shaping without a curl noun maps to hold_fix (RG-11). Name job words naming the same job (Curl + Defining + Shaper on a curl product) count as one job."' },
    { id: 'RG2-6', class: 'b', section: 'standard §6.10 job vocabulary', source: ['round-2 diff (Alcina Föhn Lotion)', 'lane B ambiguous_rules §6.10 („Schwung and Elastizität have no explicit primary-job mapping")'], issue: '„Schwung", „Sprungkraft", „Elastizität", „Fülle" have no job mapping.', records: ['alcina-foehn-lotion'], impact: 'primary job of blow-dry lotions/mousses', proposed_fix: 'Add to §6.10: „Schwung, Sprungkraft, Spannkraft, Fülle ⇒ volume; Elastizität is a flexibility word (§6.9), never a job."' },
    { id: 'RG2-7', class: 'b', section: 'standard §6.10 (frizz_control vs sleek)', source: ['round-2 diff (JF Zauberformel)'], issue: '„Glättet abstehende Haare" — smoothing (sleek) or flyaway control (frizz_control).', records: ['john-frieda-frizz-ease-zauberformel-seiden-finish-creme'], impact: 'primary job of finishing creams', proposed_fix: 'Add to §6.10: „Taming or smoothing flyaways, abstehende Haare/Härchen or Babyhaare ⇒ frizz_control; sleek only for a smooth/straight result of the whole style („glatte Looks", „Sleek-Look")."' },
    { id: 'RG2-8', class: 'b', section: 'standard §6.11 / property set §2.13 (dry_finish vs dry_restyle)', source: ['round-2 diff (alverde Locken Refresh, Cantu Comeback Curl, JF Zauberformel)'], issue: 'Dry-hair application by strand-wise spraying or hand distribution with no explicit shaping step.', records: ['alverde-locken-refresh-spray', 'cantu-lockenspray-comeback-curl-next-day', 'john-frieda-frizz-ease-zauberformel-seiden-finish-creme'], impact: 'routine slot of refreshers and finishing creams', proposed_fix: 'Add to §6.11: „dry_restyle needs a shaping act named in the directions (kneten, einkneten, formen, stylen, in Form bringen, toupieren); spraying or distributing on dry hair without one is dry_finish. A product applied to revive curls by spraying strands is dry_finish; „und nach Wunsch stylen" makes it dry_restyle."' },
    { id: 'RG2-9', class: 'b', section: 'standard §6.11 (no moisture-state default)', source: ['round-2 diff (Redken Powder Grip, Redken Root Tease)', 'sealed slot 3 UNDETERMINED (got2b Kleber gel)', 'lane A handback „no moisture-state default"'], issue: 'Directions that apply and then shape (kneten, toupieren, Haarlinie formen) but name no moisture state: dry_restyle or unresolved.', records: ['redken-powder-grip-03', 'redken-root-tease', 'got2b-kleber-4-brows-and-edges-2in1-stylinggel'], impact: 'application_moment of powders, teasing sprays, edge gels', proposed_fix: 'Add to §6.11 (mirror of RG-2): „Directions that name a shaping step but no moisture state, no drying and no heat step read dry_restyle, confidence moderate; missing or copied directions stay unresolved."' },
    { id: 'RG2-10', class: 'b', section: 'standard §6.12 RG-9 („first-named site")', source: ['round-2 diff (6 records)'], issue: 'Ranges („vom Ansatz bis in die Spitzen", „beginnend an den Spitzen … zum Ansatz") and emphasis („besonders auf abstehende Härchen") are read as roots/lengths/surface by one lane and all by the other.', records: ['got2b-styling-puder-volumen-powderfull', 'john-frieda-frizz-ease-traumlocken-lockencreme', 'moroccanoil-volumizing-spray', 'schwarzkopf-taft-haarpuder-volumen', 'bali-curls-volumizing-curl-spray-refreshing', 'john-frieda-frizz-ease-zauberformel-seiden-finish-creme'], impact: 'target_zone (root-lift branch, cautions)', proposed_fix: 'Add to §6.12: „A range that spans the hair length in either direction („vom Ansatz bis in die Spitzen", „von den Spitzen zum Ansatz") is all. An emphasis inside a whole-hair instruction („im Haar verteilen, besonders auf …") is all; surface/lengths/roots need the zone to be the only application site."' },
    { id: 'RG2-11', class: 'b', section: 'standard §6.8 RG-10 (natürlich adjacency); matt family', source: ['round-2 diff (Power Flex, Root Boost)', 'lane B ambiguous_rules §6.8 („natürlich aussehendes Finish"; „Halbmatt read in the matt family")'], issue: '„natürlich aussehendes Finish" has a participle between natürlich and Finish; „halbmatt" is not listed.', records: ['balea-styling-creme-power-flex', 'moroccanoil-root-boost'], impact: 'finish preference on molding/texture products', proposed_fix: 'Add to §6.8: „natürlich aussehendes Finish / natürlich wirkender Look ⇒ natürlich (same phrase as natürliches Finish); halbmatt, seidenmatt ⇒ matt."' },
    { id: 'RG2-12', class: 'b', section: 'standard §6.9 flexibility lexicon', source: ['round-2 diff (Elnett Haarspray)', 'lane B ambiguous_rules §6.9 („verformbar")', 'lane A handback „verformbar"', '§13.2 item 4'], issue: '„Stylen, Ausbürsten, wieder Stylen" (restylable?), „verformbar" (Taft Paste), „Elastizität" are in no list.', records: ['loreal-paris-elnett-haarspray-extra-starker-halt', 'taft-styling-paste-forming-halt-5plus', 'alcina-foehn-lotion'], impact: 'flexibility on hairsprays and pastes', proposed_fix: 'Add to §6.9 beweglich: „verformbar, wieder stylen / neu stylen (a restyling sequence such as „Stylen, Ausbürsten, wieder Stylen"), Elastizität"; keep „ausbürstbar" alone as not flexibility (PH2-11).' },
    { id: 'RG2-13', class: 'b', section: 'standard §5 anchor table', source: ['round-2 diff (Overnight Wellenspray subtype)', 'sealed slot 1 UNDETERMINED', 'lane A handback „no subtype anchor for a heatless overnight setting spray"'], issue: 'No subtype anchor for a heatless overnight wave/curl setting spray (sprayed damp or dry, set with curlers/braids).', records: ['balea-overnight-wellenspray'], impact: 'subtype of a growing heatless-styling segment', proposed_fix: 'Add to the §5 gel row: „incl. setting sprays/lotions for heatless sets (curlers, braids, overnight): hold + definition, damp or dry, shaped by a tool" ⇒ gel; mousse stays foam-only (form tie-break).' },
    { id: 'RG2-14', class: 'b', section: 'standard §5 gel vs curl_cream tie-break (form)', source: ['round-2 diff (Syoss Curl Cream Gel subtype)'], issue: 'Which „form" decides: the packet\'s format field („cream") or the formula/self-description („Gel", cast to scrunch out). The Power Flex precedent reads the formula.', records: ['syoss-curl-cream-gel-3in1'], impact: 'gel/curl_cream coverage', proposed_fix: 'Add to §5: „Form = what the product is as applied — a gel/jelly (carbomer- or polymer-thickened, self-described Gel, cast expected) is gel even when sold as a cream (Power Flex, Syoss Curl Cream Gel); the capture format field is not a tie-breaker on its own."' },
    { id: 'RG2-15', class: 'b', section: 'standard §5 smoothing_styler vs shine_finish tie-break', source: ['lane A handback „smoothing_styler vs shine_finish tie-break"', 'lane A subtype readings (gotGloss, taft x Gliss Shine Coat)'], issue: 'A shine/anti-frizz spray whose directions apply it before the blow-dryer or iron reads smoothing_styler by the moment tie-break, although its job is shine.', records: ['got2b-gotgloss-glanz-spray', 'schwarzkopf-taft-x-gliss-silky-shine-shine-coat'], impact: 'smoothing_styler coverage (0 committed)', proposed_fix: 'Clarify §5: „smoothing_styler needs a sleek/straight result as the job; a shine lead stays shine_finish whatever the moment (moment breaks the tie only between two subtypes the job leaves open)."' },
    { id: 'RG2-16', class: 'b', section: 'standard §6.10 RG-12 (secondary jobs)', source: ['round-2 diff (37 supplementary disagreements)'], issue: 'RG-12 maps hold/frizz/shine/definition words; it does not say whether volume, texture and sleek words in non-lead claims may be secondaries. B adds them (texture, volume) on 15+ records; A does not.', records: ['37 records, see disagreements (field secondary_jobs)'], impact: 'secondary jobs (ranking context only)', proposed_fix: 'State RG-12 as closed or open: recommended open — „any job word of the §6.10 vocabulary stated in a C1/C2 promise line (not in feel, ingredient or duration lines), in claim order, max two, after the primary"; or keep closed and say „only these four mappings create secondaries".' },
    { id: 'RG2-17', class: 'b', section: 'standard §5 step 3 / §6.10 RG-11 (job-less lead on a wax stick)', source: ['sealed slot 2 UNDETERMINED'], issue: 'A lead with no job word („Haarwachs-Stift für trendige Styles") vs specific shine/flyaway lines and dry-finish directions: product-noun fallback (molding) or the specific lines (shine_finish). Both lanes chose shine_finish.', records: ['balea-haarwachs-styling-stick'], impact: 'subtype of finishing sticks', proposed_fix: 'Add to §4.2: „A lead line with no job word is skipped; the next C1/C2 line with a job word is the lead."' },
    { id: 'RG2-18', class: 'b', section: 'standard §7.4 word lexicon; §7.8 vs §13.2 item 4', source: ['sealed slot 6 UNDETERMINED („mittlerer Kontrolle")', 'lane B ambiguous_rules §7.8 vs §7.4/§13.2(4) („ultra krass")', 'lane A handback „ultra krass"'], issue: '„mittlerer Kontrolle" (Redken Wax Spray) and „krass/ultra krass" (got2b) are not in §7.4, while §7.8 binds „ultra krass" ⇒ 4. Both lanes gave 2 and 4.', records: ['redken-wax-spray', 'got2b-styling-paste-istyler-texture-clay', 'got2b-spruehkleber-freeze-haarlack'], impact: 'hold level on 2–3 products (lanes agree today)', proposed_fix: 'Add to §7.4: „Kontrolle with a strength word reads as Halt (mittlere Kontrolle ⇒ 2); krass ⇒ 3, ultra krass / krasser Halt at the top of a got2b display ⇒ 4". Remove „krass" from §13.2 item 4.' },
    { id: 'RG2-19', class: 'b', section: 'standard §4.3 3.3 („protection-first")', source: ['lane A handback „undefined protection-first for multi-protection promises"; lane A note OSiS Super Shield'], issue: 'A lead protecting from heat, humidity and environment together: protection-first (heat_protectant) or co-equal (mixed).', records: ['osis-super-shield'], impact: 'one route (lanes agree heat_protectant)', proposed_fix: 'Add to §4.2: „A protection lead naming heat among other protections (Feuchtigkeit, Umwelt) is heat_protection; mixed only when it joins protection with a styling or care job."' },
    { id: 'RG2-20', class: 'b', section: 'standard §4 (no rinse-out / dual-use step); §13.2 item 4', source: ['lane A handback „no rinse-out step"; lane A notes Redken One United, GUHL 2in1'], issue: 'Directions with a leave-on and a rinse-out variant have no S0 step.', records: ['redken-one-united-all-in-one-multi-benefit-treatment', 'guhl-styling-spray-locken-pflege-und-styling-2in1', 'guhl-locken-pflege-und-styling-3in1'], impact: 'none today (lanes agree)', proposed_fix: 'Add to §4.1: „When directions offer leave-on and rinse-out uses, the first-named use decides the category; the other is recorded (PH1-7 one route)."' },
    { id: 'RG2-21', class: 'b', section: 'standard §4.2 step 1 vs §5 hairspray tie-break example', source: ['lane A handback „§4.2 lead vs §5 hairspray example (Taft Glanz Halt 4)"'], issue: '„Haarspray Glanz Halt 4": the name has two job words (Haarspray = hold, Glanz = shine), so step 1 does not decide and step 3 picks a shine line, while §5 says a hold lead ⇒ hairspray even with a shine word. Lanes agree on hairspray.', records: ['schwarzkopf-taft-haarspray-glanz-halt-4'], impact: 'none today', proposed_fix: 'Add to §4.2 step 1: „The product-type noun (Haarspray, Gel, Wachs, Puder, Schaumfestiger) names the job when it is the only job noun; a shine/strength qualifier in the same name does not make it a second job."' },
    { id: 'RG2-22', class: 'b', section: 'standard §7.5 D8b rule 1 vs §6.10 formula gate', source: ['lane A handback „D8b rule 1 and dropped hold_fix"'], issue: 'A hold claim on a shine_finish fires D8b and keeps the level, while the same claim\'s hold_fix secondary is dropped by the gate. Lanes agree; wording only.', records: ['wella-eimi-glam-mist-shine-spray'], impact: 'none', proposed_fix: 'Add to §7.5: „Rule 1 never changes the level and never restores a dropped hold_fix secondary."' },
    { id: 'RG2-23', class: 'b', section: 'lexicon v0.2 (species gaps, T_S class (c) vs T_LI Annex V, Benzyl Alcohol PR-1 + allergen, rank-based „aqueous" for propellant aerosols)', source: ['sealed rule gaps (slots 1, 4, 6)', 'lane A handback „lexicon species gaps"'], issue: 'Unlisted species (Sodium Bisulfite, Polymethylsilsesquioxane, Polyglyceryl-3 Betainate Acetate, Fructose, Octyldodecanol, hydrogenated rapeseed/palm/vegetable oils); Sodium Bisulfite is T_LI-eligible (Annex V) but not T_S (PR-1 list); Benzyl Alcohol is both PR-1 and an allergen; Water r6 in a propellant dry-shampoo makes it „aqueous".', records: ['balea-overnight-wellenspray', 'redken-wax-spray', 'wella-eimi-volume-dry-me', 'balea-haarwachs-styling-stick'], impact: 'markers/aqueous on 2 records; no route moved', proposed_fix: 'Lexicon v0.3: place the listed species; state that an Annex V antioxidant (sulfites) is not a T_S or T_LI marker unless declared „as preservative"; Benzyl Alcohol above Parfum reads PR-1; propellants count as the continuous phase when they lead (water below a propellant is not aqueous).' },
    { id: 'RG2-24', class: 'b', section: 'standard §4.1 input 3 („complete INCI") vs LI §2.4 („blocks only when the dominant architecture is unreadable"); rank convention after split repair', source: ['P2-3', 'P2-4', 'FREEZE-NOTES §5 evidence-gate table'], issue: 'The freeze blocks 4 records for tail-only INCI defects (truncated allergen block, a split oil name, a missing separator in the fragrance block, a possibly truncated tail), but the S0 packet does not carry the flags and both lanes routed the records. Repaired split tokens are renumbered by one lane only.', records: ['jean-und-len-sea-salt-spray', 'balea-locken-revitalizing-spray', 'cantu-lockencreme-kokos', 'neqi-diamond-glass-styling-spray-all', 'balea-locken-crunchgel'], impact: 'coverage: salt_spray committed 5→4 and refresher held 4→3 if the freeze reading stands', proposed_fix: 'Add to §4.1: „An INCI defect confined to the tail (at or below T_S: truncation inside the allergen block, a split fragrance/oil token) does not block S0; it carries review inci_tail_defect. A defect above T_S blocks." Ship identity.inci_flags in the S0 packet. Ranks: „re-join split tokens and renumber; the freeze applies the repair so packets and lanes share one numbering."' },
    { id: 'RG2-25', class: 'b', section: 'standard §4.6 registry scope (siblings)', source: ['round-2 diff (NEQI Diamond Glass All)'], issue: 'The NEQI Ultimate ruling (leave_in, T15/D3) does not cover its fixative-free „All" sibling, which by the letter stops at mixed_promise (manual review).', records: ['neqi-diamond-glass-styling-spray-all'], impact: 'one product in manual review', proposed_fix: 'Owner may extend the registry row: „NEQI Diamond Glass Ultimate · NEQI Diamond Glass All ⇒ leave_in (T15/D3)" — All has the same Polysilicone-29 + Silicone Quaternium-18 film without the fixative (D6 real care) ⇒ leave_in is also the letter\'s Leave-in reading. Needs the INCI completeness check first (P2-3).' },
    { id: 'RG2-26', class: 'b', section: 'standard §6.13 / property set §7 crossing 1 (U fields from names)', source: ['E2-10 (GUHL Föhn-Spray)'], issue: 'Whether a confirmed-name word („Föhn-Aktiv") is „the product\'s own text that heat activates it" and whether a blind lane may read it for a U field.', records: ['guhl-foehn-spray-langzeit-volumen'], impact: 'one heat_activated value in the blind round (final value yes either way)', proposed_fix: 'Add to §6.13: „In the blind round heat_activated reads the F/U directions only; name and claim activation statements raise it after unblinding."' },
    { id: 'RG2-27', class: 'b', section: 'standard PH1-7 / §5 rule 2 (brow use of a hairline gel)', source: ['sealed rule gaps (slot 3)'], issue: 'Brow (facial) application of a 2in1 edge gel has no scope line.', records: ['got2b-kleber-4-brows-and-edges-2in1-stylinggel', 'bali-curls-sleek-stick-brows-and-edges'], impact: 'none (recorded only)', proposed_fix: 'Add to §5 rule 2: „Brow use is recorded (PH1-7); the hair use decides the route and subtype."' },
  ];

  const packetIssues = [
    { id: 'P2-1', class: 'c', records: ['osis-sparkler', 'balea-finishing-spray-glow-und-care', 'got2b-gotgloss-glanz-spray', 'schwarzkopf-taft-x-gliss-silky-shine-shine-coat', 'balea-professional-glow-und-shine-finishing-spray', 'balea-styling-finishing-stick', 'wella-eimi-glam-mist-shine-spray'], issue: 'S0 redaction (PH2-6 plus the coordinator\'s round-2 extension: compound finish words, Gloss, Shine, Finish, rigidity words) removes job words from lead lines and confirmed names. Computed check (s0_redaction_check): 71 records lose at least one styling job word; on 5 the lead line and the name keep none (OSiS Sparkler, gotGloss, Glam Mist, Elvital Öl Magique, NIVEA MEN Styling Cream); the Finishing Spray Glow & Care keeps only „Glow" in the name and loses its only job line; on taft x Gliss Shine Coat, Glow&Shine and the Finishing Stick the name\'s job words are blanked. Three route splits and two primary-job splits follow. The claims packet carries no confirmed name, so name-based C fields cannot be computed blind. Lane B\'s statement („Some S0 redactions remove the complete lead-job wording") is confirmed.', fix: 'Owner question Q3 (RG2-3): keep job-naming nouns in S0 promise lines and the confirmed name; redact only grading adjectives, numbers and scales; add the unredacted confirmed name to the claims packet.' },
    { id: 'P2-2', class: 'c', records: ['got2b-gotgloss-glanz-spray'], issue: 'Frozen identity_status inci_conflict although the two captures differ only in fragrance/allergen granularity (Benzyl Alcohol vs TAN + Citrus Aurantium Peel Oil, all in the tail) — LI §2.4.2 says that is not a set conflict.', fix: 'Re-freeze as verified_with_minor_source_difference + review formula_or_identity_conflict (A\'s reading).' },
    { id: 'P2-3', class: 'c', records: ['jean-und-len-sea-salt-spray', 'balea-locken-revitalizing-spray', 'cantu-lockencreme-kokos', 'neqi-diamond-glass-styling-spray-all'], issue: 'The freeze computes these 4 records as failing §4.1 input 3 (INCI incomplete: truncated allergen tail, missing separator „CITRONELLOL SODIUM CHLORIDE", split „JOJOBA, SEED OIL", possibly truncated list), but identity.inci_flags are not in the S0 packet; both lanes passed them through the gate (Jean & Len committed salt_spray, Revitalizing held refresher in both lanes).', fix: 'Decide RG2-24 (tail-only defects do not block, recommended) and ship inci_flags in the S0 packet.' },
    { id: 'P2-4', class: 'c', records: ['balea-locken-crunchgel', 'cantu-lockencreme-kokos'], issue: 'Split INCI tokens in the packet (Crunchgel unflagged: „HYDRO"/„LYZED CORN STARCH", „POLYGLYCERYL"/„6 CAPRYLATE", „POLYGLYCERYL"/„4 CAPRATE"; Cantu flagged); lanes renumber differently (tail-marker rank disagreements, no value moves).', fix: 'Freeze applies the transcription repair and renumbers; flag every split.' },
    { id: 'P2-5', class: 'c', records: ['balea-haargel-hair-jelly'], issue: 'Hold claim text „flexiblen Halt" but the words field carries „flexibler Halt, soft"; „soft" has no claim line or provenance. B read it (level 1), A did not (null + neutral fact). One of the two hold mismatches.', fix: 'Re-capture: if „soft" is the dm „Halt" attribute, record it as its own C2 house-brand hold claim (PH2-7 ⇒ 1); otherwise delete it from words.' },
    { id: 'P2-6', class: 'c', records: ['wella-eimi-nutricurls-fresh-up', 'redken-one-united-all-in-one-multi-benefit-treatment', 'kevin-murphy-killer-curls'], issue: 'C1/C2 promise lines stamped C2 from hosts that are not a German manufacturer page: lookfantastic.de (retailer ⇒ C3), redken.co.uk (UK page ⇒ C5 unless LI rule 7; one line from redken.eu), kevinmurphy.com.au/de/de (brand\'s global site, German locale — likely C2 but unverified). Nutricurls Fresh Up would stop at evidence_gate on a correct stamp (its route split becomes moot); Killer.Curls would fall back under PH2-10 (evidence_gate) if the page is not the German-market page, removing one held curl_cream.', fix: 'Re-stamp per LI rule 3/7: lookfantastic ⇒ C3; redken.co.uk ⇒ C5 (keep redken.eu as C2 if German-language); confirm kevinmurphy.com.au/de/de serves the German market.' },
  ];

  const laneErrors = [
    { id: 'E2-1', record: 'balea-glattspray-anti-frizz', field: 'route (+ cascade)', wrong: 'B', right: 'A', rule: 'LI §2.3.2 clause 2 (positioning half not on durable hold; included LI use) ⇒ li_g0_provisional', moves_value: true },
    { id: 'E2-2', record: 'bali-curls-hydrating-curl-cream, cantu-lockencreme-kokos, hask-lockencreme-curl-care', field: 'route, reason_code', wrong: 'B', right: 'A', rule: 'standard §4.6 registry row v0.2 + §4.1 (c): the ruling overrides the mixed letter ⇒ leave_in; R1-H2 „owner-named routes stand"', moves_value: true },
    { id: 'E2-3', record: 'neqi-diamond-glass-styling-spray-all', field: 'promise_class, route, reason_code', wrong: 'B', right: 'A', rule: 'standard §4.2 co-equal lead („kombiniert Styling-Unterstützung mit Hitzeschutz", „Styling + Hitzeschutz in einem") ⇒ mixed', moves_value: true },
    { id: 'E2-4', record: 'balea-pure-styling-volumenpuder-spray', field: 'reason_code', wrong: 'B', right: 'A', rule: 'standard §4.3: 3.4 needs an aqueous formula; no water declared ⇒ 3.5', moves_value: false },
    { id: 'E2-5', record: 'bumble-and-bumble-brilliantine, color-wow-dream-coat-supernatural-spray, loreal-paris-elnett-stylingspray-hitzeschutz-3-tage-glatt', field: 'promise_class', wrong: 'B', right: 'A', rule: 'standard §4.2 (class from C1/C2 only), §4.1 (a) no-claim values; evidence gate stops S0 before step 2 (round-1 E-6)', moves_value: false },
    { id: 'E2-6', record: 'wella-eimi-glam-mist-shine-spray', field: 'reason_code (unseen slot 8, firm)', wrong: 'B', right: 'A', rule: 'standard §10.1 pair_rule required; non-aqueous ⇒ 3.5', moves_value: false },
    { id: 'E2-7', record: 'kevin-murphy-killer-curls', field: 'weight, buildup_note', wrong: 'B', right: 'A', rule: 'PH2-12 (lanolin wax is a rich member) ⇒ rich ⇒ buildup limb 2', moves_value: true },
    { id: 'E2-8', record: 'schwarzkopf-professional-osis-curl-retouch', field: 'tail_markers (T_LI status)', wrong: 'B', right: 'A', rule: 'LI §3.1.1 clause 5 / T16: marker outranks the COND-establishing cationics ⇒ implausible', moves_value: false },
    { id: 'E2-9', record: 'john-frieda-frizz-ease-zauberformel-seiden-finish-creme', field: 'tail_markers (T_LI status)', wrong: 'B', right: 'A', rule: 'LI §3.1.1 clause 6 closed set + RG-1 (essential oils after Parfum) ⇒ vacuous', moves_value: false },
    { id: 'E2-10', record: 'guhl-foehn-spray-langzeit-volumen', field: 'heat_activated', wrong: 'A', right: 'B', rule: 'U field from F/U directions in the blind round; claim/name activation is a post-unblinding raise (property set §7 crossing 1; round-1 E-5)', moves_value: true },
    { id: 'E2-11', record: 'balea-professional-styling-cream-traumlocken', field: 'promise_class', wrong: 'B', right: 'A', rule: 'worked example §11.2 (mixed ⇒ PH1-12 D7)', moves_value: false },
    { id: 'E2-12', record: 'balea-haargel-hair-jelly', field: 'reason_code', wrong: 'B', right: 'A', rule: 'standard §4.2 v0.2 lead order: lead = first C2 line „Styling-Gelee für das Haar" ⇒ li_function no ⇒ 3.4(ii) (round-1 RG-6 now decided)', moves_value: false },
  ];

  const ownerQuestions = [
    { id: 'Q1', rank: 1, root_cause: 'RG2-1', question: 'Which words make a curl product „care + curl definition" (and so a hand-reviewed mixed product)? (a) Only a care job the product promises (spendet Feuchtigkeit, pflegt, repariert, entwirrt — incl. „Pflege"/„Care"/„Detangling" in the name), or (b) any care word, including an adjective on the result such as „gepflegte Locken"? And does reviving or reactivating curls count as „curl definition"?', examples: ['Redken Refreshing Curl Mist: „revitalisiert und reaktiviert Locken … für gestylte und gepflegte Locken". Reading (a): not mixed ⇒ held Styling refresher (lane A). Reading (b): mixed ⇒ manual review (lane B).', 'Wella EIMI Nutricurls Fresh Up („Curl Refreshing Detangling Spray", „Locken reaktivieren"): if „Detangling" is care and reactivation is definition ⇒ mixed (lane A); if reactivation is only refresh ⇒ Leave-in by D6 (lane B).'], affects: '2 route splits now; sealed slot 7 (Moroccanoil Glättende Creme, both lanes mixed); every curl spray/refresher with a care word', recommendation: 'Choose (a), and say curl revival is not curl definition (the definition half needs „definiert/Definition"). It keeps „mixed" for products that really sell both jobs, follows SFS-15, and sends Redken Curl Mist to the held refresher queue and Nutricurls Fresh Up to Leave-in (after its tier re-stamp, P2-6).' },
    { id: 'Q2', rank: 2, root_cause: 'RG2-2', question: 'A water-based anti-frizz „Haarserum" whose conditioner sits one rank below the preservative: Oil (the „Serum" name rule, as v0.2\'s new serum test now says) or Leave-in (as the registry names it)?', examples: ['Balea Haarserum Anti-Frizz Glatt & Glossy: Aqua r1, Cetearyl Alcohol r3, Behentrimonium Chloride r12 just below Ethylhexylglycerin r11 ⇒ v0.2 letter Oil (lane A); registry Leave-in (lane B).', 'Contrast Balea Pro Haarserum Glow & Shine (Behentrimonium Chloride r5, above the preservative) ⇒ Leave-in under both.'], affects: 'one route now; every water-based serum near the line', recommendation: 'Leave-in: widen the serum test to read the conditioner the way D6 already does (down to the first pH adjuster after the preservative). The registry outcome then follows from the letter, no override needed.' },
    { id: 'Q3', rank: 3, root_cause: 'RG2-3', question: 'The blind S0 packet removes finish words (Glanz, Shine, Gloss, Finish) and blanks them in product names. For shine products those words are the product\'s job. Should the blind packet keep job-naming nouns and only remove grading words?', examples: ['OSiS Sparkler: „ein Glanz-Spray für … glänzendes Haar … leichtes Finish" becomes „ein [CLAIM]-Spray für … [CLAIM] Haar … leichtes [CLAIM]": lane B stopped at the evidence gate, lane A guessed a shine spray.', 'taft x Gliss „Glanz-Spray … Silky Shine" becomes „[CLAIM]-Spray … Silky [CLAIM]": lane B read the next line „Styling & Pflege in einem" ⇒ mixed, lane A reconstructed „Shine" ⇒ Styling.'], affects: '3 route splits and 2 primary-job splits in this round; blinding integrity (a lane reconstructing blanked words is no longer blind)', recommendation: 'Yes. Keep job nouns (Glanz-Spray, Shine, Gloss, Finish/Finishing, Haarspray, Wachs, Puder) in S0 lines and the confirmed name; keep removing hold strength, flexibility and finish grading adjectives, numbers and scales; put the unredacted name into the claims packet. Re-run only the affected records.' },
    { id: 'Q4', rank: 4, root_cause: 'RG2-25', question: 'NEQI Diamond Glass All is the fixative-free sibling of NEQI Diamond Glass Ultimate (ruled Leave-in). By the letter it is „Styling + Hitzeschutz in einem" ⇒ mixed ⇒ manual review. Extend the Ultimate ruling to it?', examples: ['NEQI Diamond Glass All: same Polysilicone-29 + Silicone Quaternium-18 film, no fixative; lane A mixed (review), lane B Leave-in.'], affects: 'one product', recommendation: 'Yes, extend the row (Leave-in is also what the letter\'s Leave-in reading gives), after the INCI-truncation flag is cleared (P2-3).' },
  ];

  const reportedAmbiguityMap = [
    { lane: 'B', section: '§7.8 versus §7.4 and §13.2(4) („ultra krass")', maps_to: 'RG2-18' },
    { lane: 'B', section: '§4.2;R1-Q3/R1-H2 versus SFS-15', maps_to: 'RG2-1 (Q1)' },
    { lane: 'B', section: '§4.2;R1-H1;§10.2 (S0 redactions remove lead-job wording)', maps_to: 'RG2-3 (Q3) + P2-1' },
    { lane: 'B', section: '§6.10 (Schwung, Elastizität)', maps_to: 'RG2-6' },
    { lane: 'B', section: '§6.9;§13.2(4) (verformbar)', maps_to: 'RG2-12' },
    { lane: 'B', section: '§6.8 (Halbmatt; natürlich aussehendes Finish)', maps_to: 'RG2-11' },
    { lane: 'A', section: '§4.2 lead vs §5 hairspray example (Taft Glanz Halt 4)', maps_to: 'RG2-21' },
    { lane: 'A', section: 'R1-H2 breadth vs SFS-15 (also note on Balea Locken Lotion)', maps_to: 'RG2-1 (Q1)' },
    { lane: 'A', section: 'curl noun as job word in names', maps_to: 'RG2-5' },
    { lane: 'A', section: '„ultra krass" / „verformbar"', maps_to: 'RG2-18 + RG2-12' },
    { lane: 'A', section: 'no subtype anchor for a heatless overnight setting spray; no moisture-state default', maps_to: 'RG2-13 + RG2-9' },
    { lane: 'A', section: 'smoothing_styler vs shine_finish tie-break', maps_to: 'RG2-15' },
    { lane: 'A', section: 'undefined „protection-first" for multi-protection promises (OSiS Super Shield)', maps_to: 'RG2-19' },
    { lane: 'A', section: 'packet claim-tier host mismatches (redken.co.uk, kevinmurphy.com.au, lookfantastic.de stamped C2)', maps_to: 'P2-6' },
    { lane: 'A', section: 'Balea Anti-Frizz Serum registry vs letter (oil)', maps_to: 'RG2-2 (Q2)' },
    { lane: 'A', section: 'lexicon species gaps', maps_to: 'RG2-23' },
    { lane: 'A', section: 'D8b rule 1 and dropped hold_fix (Glam Mist)', maps_to: 'RG2-22' },
    { lane: 'A', section: 'no rinse-out / dual-use step (Redken One United, GUHL)', maps_to: 'RG2-20' },
    { lane: 'A', section: 'note: „gel-type shaping product" undefined (Bali Curls Sleek Stick)', maps_to: 'RG2-27 (round-1 RG-20 item, unchanged)' },
    { lane: 'A', section: 'note: Elvital Big Hair Day freshness vs volume lead', maps_to: 'no register entry (lanes agree dry_shampoo by the tie rule)' },
    { lane: 'sealed', section: 'UNDETERMINED: slot 1 subtype, slot 2 subtype, slot 3 application_moment, slot 6 hold level and R2 marker, slot 7 promise/route', maps_to: 'RG2-13, RG2-17, RG2-9, RG2-18 + RG2-23, RG2-1' },
    { lane: 'sealed', section: 'rule gaps: T_S class (c) vs T_LI Annex V; aqueous by rank for propellants; unlisted species; brow scope; unmarked promise-line positions', maps_to: 'RG2-23, RG2-27, P2-1 (positions)' },
  ];

  return {
    disagreements: D,
    by_record: R,
    default_secondary: { class: 'b', root_cause: 'RG2-16', comment: 'secondary jobs: RG-12 closed vs open list (B adds volume/texture/sleek from non-lead lines; A applies only the four RG-12 mappings); supplementary, not in the overall %.' },
    unseen_misses: unseenMisses,
    undetermined_gaps: undeterminedGaps,
    unseen_traps: traps,
    unseen_verdict: 'MET. 8 unseen products (>= 6); all 8 boundary traps exercised and caught by both lanes (>= 2). Route + reason match on 8/8 for A and 7/8 for B (slot 8: B named no pair rule; route and every property match). Firm values: A 148/148, B 147/148; soft values 21/21 for both (incl. listed alternatives; exact expected value A 19, B 20). 7 UNDETERMINED values (slots 1, 2, 3, 6, 7) are not scorable; every lane answer lies inside the acceptable set. Both lanes chose mixed_promise on slot 7 where the sealed lean was leave_in (RG2-1).',
    unseen_criterion_met: true,
    unseen_criterion_numbers: '8 unseen, 8/8 traps caught by both lanes; firm A 148/148, B 147/148 (one pair-rule code); 7 UNDETERMINED values not scorable (rule gaps)',
    reported_ambiguity_map: reportedAmbiguityMap,
    rule_gap_register: register,
    packet_issues: packetIssues,
    owner_questions: ownerQuestions,
    lane_errors: laneErrors,
  };
})();
// CLASSIFY_END
const classifyKey = (slug, f) => CLASSIFY.disagreements[`${slug}::${f}`] || CLASSIFY.by_record[slug] || (f === 'secondary_jobs' ? CLASSIFY.default_secondary : null);

// ---------------------------------------------------------------------------
// Normalisation (round-1 rules, with the round-2 changes marked R2)
// ---------------------------------------------------------------------------
const NORMALISATION_NOTES = {
  identity_status: 'string as emitted',
  tail_markers: 'as round 1: T_S and T_LI compared as (inci lower-cased, whitespace collapsed, Parfum/Fragrance aliases folded to parfum; rank; status); T_S.alt ignored (both lanes now emit it, but only for unresolved markers; reported in notes, not compared).',
  promise_class: 'as round 1: null / "unknown" -> "not_assigned".',
  route: 'string as emitted',
  reason_code: 'R2 CHANGE. Lane A now writes reason_code only for provisional_boundary; for every other route A\'s canonical reason is derived from its rule_path (the first rule_path entry that ends in "→/⇒ styling" names the pair rule: first of 3.4(iii)/3.4(ii)/3.4(i)/3.5 in that entry, 3.1 ignored; route oil -> 3.1, dry_shampoo -> 3.2, heat_protectant -> 3.3, leave_in -> 3.4(iii)_in_category; an entry "§4.6 registry … override" -> 4.6_owner_named). Lane B uses a new vocabulary: direct_styling -> 3.4(ii); non_aqueous_styling -> 3.5; styling_first -> 3.4(iii)_excluded_styling_first; conditioning_first -> 3.4(iii)_in_category, or 4.6_owner_named when B\'s rule_path starts with §4.6; oil_name_rule -> 3.1; refresh_first -> 3.2; protection_first -> 3.3; ruled_styling / ruled_styling_first -> 4.6_owner_named; dry_hair_finish -> the pair rule its rule_path names (3.4(ii) or 3.5), else "dry_hair_finish(pair_unnamed)". Boundary reasons are identical strings in both lanes.',
  subtype: 'string or null',
  result_mechanisms: 'as round 1: sorted set of mechanism values; members not compared.',
  hold_route: 'string or null',
  weight: 'string or null',
  alcohol_note: 'string or null',
  buildup_note: 'A {fired} -> fires/does_not_fire; B string.',
  provides_heat_protection: 'A {value} -> boolean; B boolean.',
  application_moment: 'both lanes now emit {primary, also[]}; primary compared (as round 1); also[] reported as a supplementary field.',
  target_zone: 'string or null',
  heat_activated: 'string or null',
  hold_level: 'number, null, or "review"',
  flexibility: 'string or null',
  finish: 'string or null',
  primary_job: 'string or null ("review" kept as a value)',
  neutral_fact: 'whitespace collapsed, quotes unified; null = not shown',
  d8b_flags: 'sorted set; null (no Styling profile) kept distinct from []',
  informational_values: 'R2 CHANGE. Lane A emits formula values on 43 non-Styling records (leave_in, oil, heat_protectant, dry_shampoo, mixed_promise, li_g0_provisional) marked informational_and_non_authoritative (standard §4.7 makes them optional and non-authoritative; the sealed file does not score them). Lane B does not emit them. They are masked to null before comparison, so only authoritative values are compared. Supplementary ingredient_flags are masked the same way for any lane record without a Styling profile.',
  secondary_jobs: 'supplementary, sorted set; null kept distinct from []',
  ingredient_flags: 'R2 ADDITION (supplementary, both lanes now emit it): object compared with fixative_family sorted.',
  application_moment_also: 'R2 ADDITION (supplementary): sorted also[] set.',
};

const FIELDS = [
  'identity_status', 'tail_markers', 'promise_class', 'route', 'reason_code', 'subtype',
  'result_mechanisms', 'hold_route', 'weight', 'alcohol_note', 'buildup_note',
  'provides_heat_protection', 'application_moment', 'target_zone', 'heat_activated',
  'hold_level', 'flexibility', 'finish', 'primary_job', 'neutral_fact', 'd8b_flags',
];
const SUPPLEMENTARY = ['secondary_jobs', 'ingredient_flags', 'application_moment_also', 'tail_T_S', 'tail_T_LI'];
const FORMULA_FIELDS = ['result_mechanisms', 'hold_route', 'weight', 'alcohol_note', 'buildup_note'];

const normStr = (s) => (s == null ? null : String(s).replace(/[“”„]/g, '"').replace(/\s+/g, ' ').trim());
const normInci = (s) => {
  if (s == null) return null;
  const t = String(s).toLowerCase().replace(/\s+/g, ' ').trim();
  if (/^(parfum|fragrance)( ?\((fragrance|parfum)\))?$|^(parfum|fragrance) ?\/ ?(parfum|fragrance)$/.test(t)) return 'parfum';
  return t;
};
const marker = (m) => (m ? { inci: normInci(m.inci), rank: m.rank == null ? null : m.rank, status: m.status || null } : null);
const setOf = (arr) => (arr == null ? null : [...arr].map(String).sort());
const flagsOf = (f) => (f == null ? null : {
  silicones: f.silicones, oils: f.oils, fragrance: f.fragrance, salt: f.salt, propellant: f.propellant,
  fixative_family: setOf(f.fixative_family || []),
});

const RULE_TOKEN = /3\.4\(iii\)|3\.4\(ii\)|3\.4\(i\)|3\.5/;
function A_REASON(r) {
  if (r.reason_code) return r.reason_code;
  const p = Array.isArray(r.rule_path) ? r.rule_path : [String(r.rule_path || '')];
  if (p.some((s) => /registry[^;]*override/.test(s))) return '4.6_owner_named';
  if (r.route === 'oil') return '3.1';
  if (r.route === 'dry_shampoo') return '3.2';
  if (r.route === 'heat_protectant') return '3.3';
  if (r.route === 'leave_in') return '3.4(iii)_in_category';
  if (r.route === 'styling') {
    const entry = p.find((s) => /(→|⇒)\s*styling(?!_)/.test(s)) || p.join(' ');
    const m = entry.match(RULE_TOKEN);
    if (!m) return 'unparsed';
    if (m[0] === '3.4(iii)') return '3.4(iii)_excluded_styling_first';
    return m[0];
  }
  return 'unparsed';
}
function B_REASON(r) {
  const c = r.reason_code; const p = String(r.rule_path || '');
  switch (c) {
    case 'direct_styling': return '3.4(ii)';
    case 'non_aqueous_styling': return '3.5';
    case 'styling_first': return '3.4(iii)_excluded_styling_first';
    case 'conditioning_first': return /^§4\.6/.test(p) ? '4.6_owner_named' : '3.4(iii)_in_category';
    case 'oil_name_rule': return '3.1';
    case 'refresh_first': return '3.2';
    case 'protection_first': return '3.3';
    case 'ruled_styling': case 'ruled_styling_first': return '4.6_owner_named';
    case 'dry_hair_finish': return /3\.4\(ii\)/.test(p) ? '3.4(ii)' : /3\.5/.test(p) ? '3.5' : 'dry_hair_finish(pair_unnamed)';
    default: return c;
  }
}
const hasProfile = (r) => r.route === 'styling' || r.reason_code === 'pending_leave_in_addendum';

function normA(r) {
  const info = r.informational_and_non_authoritative === true;
  const F = (v) => (info ? null : v);
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
    application_moment_also: r.application_moment == null ? null : setOf(r.application_moment.also || []),
    target_zone: r.target_zone == null ? null : r.target_zone,
    heat_activated: r.heat_activated == null ? null : r.heat_activated,
    hold_level: r.hold_level == null ? null : r.hold_level,
    flexibility: r.flexibility == null ? null : r.flexibility,
    finish: r.finish == null ? null : r.finish,
    primary_job: r.primary_job == null ? null : r.primary_job,
    neutral_fact: normStr(r.neutral_fact),
    d8b_flags: setOf(r.d8b_flags),
    secondary_jobs: setOf(r.secondary_jobs),
    ingredient_flags: hasProfile(r) ? flagsOf(r.ingredient_flags) : null,
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
    application_moment: r.application_moment == null ? null : (typeof r.application_moment === 'object' ? r.application_moment.primary : r.application_moment),
    application_moment_also: r.application_moment == null ? null : (typeof r.application_moment === 'object' ? setOf(r.application_moment.also || []) : []),
    target_zone: r.target_zone == null ? null : r.target_zone,
    heat_activated: r.heat_activated == null ? null : r.heat_activated,
    hold_level: r.hold_level == null ? null : r.hold_level,
    flexibility: r.flexibility == null ? null : r.flexibility,
    finish: r.finish == null ? null : r.finish,
    primary_job: r.primary_job == null ? null : r.primary_job,
    neutral_fact: normStr(r.neutral_fact),
    d8b_flags: setOf(r.d8b_flags),
    secondary_jobs: setOf(r.secondary_jobs),
    ingredient_flags: hasProfile(r) ? flagsOf(r.ingredient_flags) : null,
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
if (ids.length !== 139 || B.records.length !== 139 || !ids.every((id) => bById.has(id) && cohortById.has(id) && idMap.has(id))) {
  throw new Error('record sets do not join 1:1 on 139 ids');
}
const ROLES = ['calibration', 'negative_control', 'unseen'];
const ORIGINS = ['carried', 'new'];

const rows = ids.map((id) => {
  const c = cohortById.get(id);
  const a = aById.get(id);
  const b = bById.get(id);
  return {
    id, slug: c.source_slug, name: `${c.identity.brand} ${c.identity.product_name}`, role: c.cohort_role,
    origin: idMap.get(id).round1_sample_id ? 'carried' : 'new', round1_id: idMap.get(id).round1_sample_id || null,
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
const SUBSETS = {
  all: () => rows,
  calibration: () => rows.filter((r) => r.role === 'calibration'),
  negative_control: () => rows.filter((r) => r.role === 'negative_control'),
  unseen: () => rows.filter((r) => r.role === 'unseen'),
  carried: () => rows.filter((r) => r.origin === 'carried'),
  new: () => rows.filter((r) => r.origin === 'new'),
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
  if (field === 'hold_level' && raw.hold_basis) bits.push('hold_basis: ' + raw.hold_basis);
  if (raw.notes && (Array.isArray(raw.notes) ? raw.notes.length : true)) bits.push('notes: ' + (Array.isArray(raw.notes) ? raw.notes.join(' | ') : raw.notes));
  return bits.join(' || ');
}
const disagreements = [];
for (const r of rows) {
  for (const f of [...FIELDS, 'secondary_jobs']) {
    if (same(r.A[f], r.B[f])) continue;
    const key = `${r.slug}::${f}`;
    const cls = classifyKey(r.slug, f);
    disagreements.push({
      slug: r.slug, id: r.id, name: r.name, role: r.role, origin: r.origin, field: f,
      supplementary: f === 'secondary_jobs',
      A: r.A[f], B: r.B[f],
      A_rule_path: rulePath(r.rawA, f), B_rule_path: rulePath(r.rawB, f),
      classification: cls ? cls.class : 'UNCLASSIFIED',
      root_cause: cls ? cls.root_cause : null,
      right_lane: cls ? (cls.right || null) : null,
      comment: cls ? cls.comment : null,
    });
  }
}
const unclassified = disagreements.filter((d) => d.classification === 'UNCLASSIFIED').map((d) => `${d.slug}::${d.field}`);

// ---------------------------------------------------------------------------
// 1b. Round 1 -> round 2 on the 107 carried records
// ---------------------------------------------------------------------------
const r1Dis = new Map();
for (const d of R1.disagreements) r1Dis.set(`${d.slug}::${d.field}`, d);
const carried = rows.filter((r) => r.origin === 'carried');
const carriedSlugs = new Set(carried.map((r) => r.slug));
const r1ToR2 = { resolved: [], persisting: [], new_in_round2: [] };
for (const r of carried) {
  for (const f of [...FIELDS, 'secondary_jobs']) {
    const key = `${r.slug}::${f}`;
    const was = r1Dis.get(key);
    const nowOk = same(r.A[f], r.B[f]);
    if (was && nowOk) r1ToR2.resolved.push({ slug: r.slug, name: r.name, field: f, round1_class: was.classification, round1_root_cause: was.root_cause, round2_value: r.A[f] });
    else if (was && !nowOk) r1ToR2.persisting.push({ slug: r.slug, name: r.name, field: f, round1_class: was.classification, round1_root_cause: was.root_cause, round1_A: was.A, round1_B: was.B, round2_A: r.A[f], round2_B: r.B[f], round2_class: (classifyKey(r.slug, f) || {}).class || null, round2_root_cause: (classifyKey(r.slug, f) || {}).root_cause || null });
    else if (!was && !nowOk) r1ToR2.new_in_round2.push({ slug: r.slug, name: r.name, field: f, round2_A: r.A[f], round2_B: r.B[f], round2_class: (classifyKey(r.slug, f) || {}).class || null, round2_root_cause: (classifyKey(r.slug, f) || {}).root_cause || null });
  }
}
const r1Core = R1.disagreements.filter((d) => !d.supplementary && carriedSlugs.has(d.slug));
const r1Overall = R1.overall_agreement.all;
const round1Comparison = {
  note: 'Round-1 values come from round-1/diff.json (107 records, v0.1 rules, round-1 packets). Every round-1 record is carried into round 2 under the same slug. Round-1 reason codes used the round-1 canonical mapping; the round-2 mapping is equivalent for the same pair rules.',
  round1_overall_all_107: { cells_agree: r1Overall.cells_agree, field_cells: r1Overall.field_cells, pct_cells: r1Overall.pct_cells, records_all_fields_agree: r1Overall.records_all_fields_agree, core_disagreements: R1.counts.disagreements_core_fields, route_disagreements: R1.disagreements.filter((d) => d.field === 'route').length },
  round2_overall_carried_107: overallAgreement.carried,
  round2_core_disagreements_carried: disagreements.filter((d) => !d.supplementary && d.origin === 'carried').length,
  round2_route_disagreements_carried: disagreements.filter((d) => d.field === 'route' && d.origin === 'carried').length,
  round1_core_disagreements_on_carried: r1Core.length,
  resolved_core: r1ToR2.resolved.filter((x) => x.field !== 'secondary_jobs').length,
  persisting_core: r1ToR2.persisting.filter((x) => x.field !== 'secondary_jobs').length,
  new_core_in_round2: r1ToR2.new_in_round2.filter((x) => x.field !== 'secondary_jobs').length,
  resolved_secondary_jobs: r1ToR2.resolved.filter((x) => x.field === 'secondary_jobs').length,
  persisting_secondary_jobs: r1ToR2.persisting.filter((x) => x.field === 'secondary_jobs').length,
  new_secondary_jobs: r1ToR2.new_in_round2.filter((x) => x.field === 'secondary_jobs').length,
  resolved_by_round1_root_cause: r1ToR2.resolved.filter((x) => x.field !== 'secondary_jobs').reduce((m, x) => { m[x.round1_root_cause] = (m[x.round1_root_cause] || 0) + 1; return m; }, {}),
  persisting: r1ToR2.persisting,
  resolved: r1ToR2.resolved,
  new_in_round2: r1ToR2.new_in_round2,
};

// ---------------------------------------------------------------------------
// 2. Hold normalisation check (PH1-11)
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
  mismatch_list: holdMismatches,
  hold_basis_note: 'Lane B emits hold_basis as a category label (brand_scale, words, …); lane A as prose. Bases are shown, not compared.',
  all_rows: holdRows.map((r) => ({ slug: r.slug, name: r.name, origin: r.origin, subtype: r.A.subtype || r.B.subtype, A: r.A.hold_level, B: r.B.hold_level, same: same(r.A.hold_level, r.B.hold_level), A_basis: r.rawA.hold_basis || null, B_basis: r.rawB.hold_basis || null })),
};

// ---------------------------------------------------------------------------
// 3. Unseen scoring vs sealed expectations r2
// ---------------------------------------------------------------------------
const bySlug = new Map(rows.map((r) => [r.slug, r]));
const firstTok = (s) => (s == null ? s : typeof s === 'string' ? s.split(/[\s(]/)[0] : s);
const SEALED_REASON = {
  li_g0_excluded_styling_first: '3.4(iii)_excluded_styling_first', promise_outside_li_functions: '3.4(ii)',
  non_aqueous_styling_result: '3.5', dry_shampoo_refresh_tie: '3.2', mixed_promise_d7_not_fired: 'mixed_promise',
  li_g0_in_category_d6_not_fired: '3.4(iii)_in_category', mixed_promise: 'mixed_promise',
};
const mapReason = (s) => (s == null ? null : SEALED_REASON[firstTok(s)] || firstTok(s));
function slot(o, map) {
  // o = {value, firmness, alternatives?, acceptable?, leaning?}
  const m = map || ((x) => x);
  const firm = o.firmness === 'UNDETERMINED' ? 'UNDETERMINED' : /^firm/.test(String(o.firmness)) ? 'firm' : 'soft';
  return {
    expected: firm === 'UNDETERMINED' ? 'UNDETERMINED' : m(o.value),
    firmness: firm,
    acceptable: firm === 'UNDETERMINED' ? (o.acceptable || []).map(m) : [m(o.value), ...(o.alternatives || []).map(m)],
    leaning: o.leaning === undefined ? null : m(o.leaning),
  };
}
const fixed = (v) => ({ expected: v, firmness: 'firm', acceptable: [v], leaning: null });
function expectedFields(rec) {
  const out = [];
  const s0 = rec.s0;
  out.push({ field: 'identity_status', ...slot(rec.identity_status) });
  out.push({ field: 'tail_T_S', ...slot(rec.tail_markers.T_S, marker) });
  out.push({ field: 'tail_T_LI', ...slot(rec.tail_markers.T_LI, marker) });
  out.push({ field: 'promise_class', ...slot(s0.promise_class, (v) => (v == null ? 'not_assigned' : firstTok(v))) });
  out.push({ field: 'route', ...slot(s0.route, firstTok) });
  const br = s0.boundary_reason;
  const useBoundary = br && br.value != null && br.firmness !== 'UNDETERMINED';
  out.push({ field: 'reason_code', ...(useBoundary ? slot(br, mapReason) : slot(s0.reason_code, mapReason)) });
  out.push({ field: 'subtype', ...slot(rec.styling_subtype, (v) => (v == null ? null : firstTok(v))) });
  const p = rec.properties;
  const emitted = p && typeof p === 'object';
  const prop = (k, map) => (emitted ? slot(p[k], map) : fixed(null));
  out.push({ field: 'result_mechanisms', ...prop('result_mechanisms', (v) => setOf(v.map((x) => x.value))) });
  out.push({ field: 'hold_route', ...prop('hold_route') });
  out.push({ field: 'weight', ...prop('weight', firstTok) });
  out.push({ field: 'alcohol_note', ...prop('alcohol_note') });
  out.push({ field: 'buildup_note', ...prop('buildup_note', (v) => (v === 'fired' ? 'fires' : v === 'not_fired' ? 'does_not_fire' : v)) });
  out.push({ field: 'provides_heat_protection', ...prop('provides_heat_protection', (v) => (v && typeof v === 'object' ? v.value : v)) });
  out.push({ field: 'application_moment', ...prop('application_moment', (v) => (v && typeof v === 'object' ? v.primary : v)) });
  out.push({ field: 'target_zone', ...prop('target_zone') });
  out.push({ field: 'heat_activated', ...prop('heat_activated') });
  const top = (k) => (emitted && rec[k] && typeof rec[k] === 'object' ? slot(rec[k]) : fixed(null));
  out.push({ field: 'flexibility', ...top('flexibility') });
  out.push({ field: 'finish', ...top('finish') });
  out.push({ field: 'primary_job', ...top('primary_job') });
  out.push({ field: 'hold_level', ...slot(rec.chaarlie_hold_level, (v) => (v === 'not_emitted' ? null : v)) });
  out.push({ field: 'd8b_flags', ...(emitted ? slot(rec.d8b_flags, setOf) : fixed(null)) });
  out.push({ field: 'neutral_fact_shown', ...slot(rec.neutral_fact, (v) => v != null) });
  return out;
}
function laneValue(r, lane, field) {
  if (field === 'neutral_fact_shown') return r[lane].neutral_fact !== null;
  return r[lane][field];
}
const unseenScore = [];
const unseenTotals = { A: { firm: [0, 0], soft: [0, 0], soft_exact: [0, 0], und: [0, 0] }, B: { firm: [0, 0], soft: [0, 0], soft_exact: [0, 0], und: [0, 0] } };
const unseenSlotMatch = { A: { route_and_reason: 0, all_firm: 0, all_scored: 0 }, B: { route_and_reason: 0, all_firm: 0, all_scored: 0 } };
const unseenMisses = [];
const undeterminedReport = [];
for (const rec of [...S.records].sort((x, y) => x.unseen_slot - y.unseen_slot)) {
  const r = bySlug.get(rec.sample_id);
  if (!r) throw new Error('sealed slug not in cohort: ' + rec.sample_id);
  const exp = expectedFields(rec);
  const s = { slot: rec.unseen_slot, slug: rec.sample_id, name: r.name, trap: rec.intended_trap, fields: [] };
  const firmOk = { A: true, B: true }; const scoredOk = { A: true, B: true }; const rrOk = { A: true, B: true };
  for (const e of exp) {
    const res = { field: e.field, expected: e.expected, firmness: e.firmness, acceptable: e.acceptable, leaning: e.leaning };
    for (const lane of ['A', 'B']) {
      const got = laneValue(r, lane, e.field);
      res[lane] = got;
      if (e.firmness === 'UNDETERMINED') {
        const inAcc = e.acceptable.some((x) => same(x, got));
        res[lane + '_match'] = null; res[lane + '_in_acceptable'] = inAcc; res[lane + '_equals_leaning'] = same(got, e.leaning);
        unseenTotals[lane].und[1]++; if (inAcc) unseenTotals[lane].und[0]++;
        if (!inAcc && (e.field === 'route' || e.field === 'reason_code')) rrOk[lane] = false;
        continue;
      }
      const exact = same(got, e.expected);
      const ok = e.acceptable.some((x) => same(x, got));
      res[lane + '_match'] = ok; res[lane + '_exact'] = exact;
      unseenTotals[lane][e.firmness][1]++; if (ok) unseenTotals[lane][e.firmness][0]++;
      if (e.firmness === 'soft') { unseenTotals[lane].soft_exact[1]++; if (exact) unseenTotals[lane].soft_exact[0]++; }
      if (!ok) {
        scoredOk[lane] = false;
        if (e.firmness === 'firm') firmOk[lane] = false;
        if (e.field === 'route' || e.field === 'reason_code') rrOk[lane] = false;
        const key = `${rec.sample_id}::${e.field}::${lane}`;
        const cls = CLASSIFY.unseen_misses[key] || null;
        unseenMisses.push({
          slot: rec.unseen_slot, slug: rec.sample_id, name: r.name, lane, field: e.field, firmness: e.firmness,
          expected: e.expected, acceptable: e.acceptable, got,
          classification: cls ? cls.class : 'UNCLASSIFIED', root_cause: cls ? cls.root_cause : null, right: cls ? (cls.right || null) : null, comment: cls ? cls.comment : null,
        });
      }
    }
    if (e.firmness === 'UNDETERMINED') undeterminedReport.push({ slot: rec.unseen_slot, slug: rec.sample_id, field: e.field, acceptable: e.acceptable, leaning: e.leaning, A: res.A, B: res.B, A_in_acceptable: res.A_in_acceptable, B_in_acceptable: res.B_in_acceptable, rule_gap: (CLASSIFY.undetermined_gaps[`${rec.sample_id}::${e.field}`] || null) });
    s.fields.push(res);
  }
  for (const lane of ['A', 'B']) {
    s[lane + '_all_scored_match'] = scoredOk[lane];
    s[lane + '_all_firm_match'] = firmOk[lane];
    s[lane + '_route_and_reason_match'] = rrOk[lane];
    if (scoredOk[lane]) unseenSlotMatch[lane].all_scored++;
    if (firmOk[lane]) unseenSlotMatch[lane].all_firm++;
    if (rrOk[lane]) unseenSlotMatch[lane].route_and_reason++;
  }
  s.trap_exercised = (CLASSIFY.unseen_traps[rec.unseen_slot] || {}).exercised || null;
  s.trap_note = (CLASSIFY.unseen_traps[rec.unseen_slot] || {}).note || null;
  unseenScore.push(s);
}
const unseenUnclassified = unseenMisses.filter((m) => m.classification === 'UNCLASSIFIED').map((m) => `${m.slug}::${m.field}::${m.lane}`);
const trapsExercised = unseenScore.filter((s) => s.trap_exercised === 'caught_both' || s.trap_exercised === 'caught_one');
const unseenCriterion = {
  rule: 'PH1-11: >= 6 unseen products, >= 2 traps, matching pre-registered expectations',
  unseen_products: S.records.length,
  traps_caught_by_both_lanes: unseenScore.filter((s) => s.trap_exercised === 'caught_both').map((s) => s.slot),
  traps_caught_by_one_lane: unseenScore.filter((s) => s.trap_exercised === 'caught_one').map((s) => s.slot),
  traps_not_exercised: unseenScore.filter((s) => s.trap_exercised === 'not_exercised').map((s) => s.slot),
  traps_undetermined: unseenScore.filter((s) => s.trap_exercised === 'undetermined').map((s) => s.slot),
  slots_matching_on_all_firm_fields: { A: unseenSlotMatch.A.all_firm, B: unseenSlotMatch.B.all_firm },
  slots_matching_on_route_and_reason: { A: unseenSlotMatch.A.route_and_reason, B: unseenSlotMatch.B.route_and_reason },
  slots_matching_on_every_scored_field: { A: unseenSlotMatch.A.all_scored, B: unseenSlotMatch.B.all_scored },
  undetermined_values: undeterminedReport.length / 2,
  verdict: CLASSIFY.unseen_verdict,
  traps_exercised_count: trapsExercised.length,
};

// ---------------------------------------------------------------------------
// 4c. S0 redaction check (lane B ambiguity "Some S0 redactions remove the complete lead-job wording")
// ---------------------------------------------------------------------------
// Styling job words (German/English stems). Care/heat/refresh words are listed separately so a residual
// care/heat line is not mistaken for a surviving styling job.
const STYLING_JOB = /(volum|glow|halt\b|hold|glanz|glänz|shine|gloss|brillanz|finish|matt|textur|texture|struktur|lock|curl|well|wave|defini|frizz|glatt|glätt|sleek|smooth|form|model|fixier|beach|grip|griff|auffrisch|refresh|revitali|sprungkraft|spannkraft|lift|puder|kontrolle|flex|styl)/i;
const tokens = (s) => String(s || '').split(/[^A-Za-zÄÖÜäöüß0-9-]+/).filter(Boolean);
const jobWords = (s) => tokens(s).filter((t) => STYLING_JOB.test(t));
// Product nouns that name a job by themselves (§4.2 step 1 name job words: Haarspray ⇒ hold, Gel/Wachs/Paste ⇒ shaping, Puder ⇒ texture …).
const JOB_NOUN = /(salz|salt|haarspray|haarlack|spr[üu]hlack|gel\b|gelee|jelly|wachs|wax|paste|pomade|clay|puder|powder|schaumfestiger|mousse|f[öo]hn)/i;
const jobNouns = (s) => tokens(s).filter((t) => JOB_NOUN.test(t));
const redactionCheck = [];
for (const r of rows) {
  const c = cohortById.get(r.id);
  const pr = c.claims.filter((x) => x.type === 'promise' && /^C[12]/.test(String(x.tier)));
  const name = c.identity.product_name;
  const nameS0 = c.s0_redacted_name || name;
  const lines = pr.map((x) => ({ tier: String(x.tier), raw: x.raw, s0: x.s0_redacted_text || x.raw }));
  if (!lines.length) continue;
  const leadIdx = Math.max(0, lines.findIndex((l) => /^C1/.test(l.tier)));
  const lead = lines[leadIdx];
  const lost = (raw, red) => { const rr = jobWords(raw); const left = new Set(jobWords(red).map((t) => t.toLowerCase())); return rr.filter((t) => !left.has(t.toLowerCase())); };
  const leadLost = lost(lead.raw, lead.s0);
  const nameLost = lost(name, nameS0);
  const leadLeft = jobWords(lead.s0).filter((t) => !/^styl/i.test(t));
  const nameLeft = [...jobWords(nameS0).filter((t) => !/^styl/i.test(t)), ...jobNouns(nameS0)];
  const anyLineLeft = lines.some((l) => jobWords(l.s0).filter((t) => !/^styl/i.test(t)).length > 0);
  if (!leadLost.length && !nameLost.length) continue;
  redactionCheck.push({
    slug: r.slug, name: r.name, origin: r.origin, role: r.role,
    name_raw: name, name_s0: nameS0, name_job_words_lost: nameLost,
    lead_line_tier: lead.tier, lead_raw: lead.raw, lead_s0: lead.s0, lead_job_words_lost: leadLost,
    lead_job_words_left: leadLeft, name_job_words_left: nameLeft, any_promise_line_keeps_a_job_word: anyLineLeft,
    complete_lead_job_loss: leadLost.length > 0 && leadLeft.length === 0 && nameLeft.length === 0,
    routes: { A: r.A.route + (r.A.reason_code && !/^3\.|^4\./.test(r.A.reason_code) ? ` (${r.A.reason_code})` : ''), B: r.B.route + (r.B.reason_code && !/^3\.|^4\./.test(r.B.reason_code) ? ` (${r.B.reason_code})` : '') },
    lanes_agree_on_route: r.A.route === r.B.route,
  });
}
const redactionSummary = {
  method: 'For every record: the lead promise line (first C1 line, else first C2 line) and the confirmed name, raw (cohort.json) vs S0 packet text (s0_redacted_text / s0_redacted_name). A styling job word (volume, hold, shine/Glanz/Finish, matt, texture, curl/wave, definition, frizz, sleek/glatt, shaping, refresh …) that is present raw but missing after redaction is "lost". complete_lead_job_loss = the lead line lost a job word AND neither the redacted lead line nor the redacted name keeps any styling job word or job-naming product noun (Haarspray, Gel, Wachs, Paste, Puder, Schaumfestiger, Föhn…).',
  records_with_a_lost_job_word: redactionCheck.length,
  records_with_complete_lead_job_loss: redactionCheck.filter((x) => x.complete_lead_job_loss).length,
  complete_loss_slugs: redactionCheck.filter((x) => x.complete_lead_job_loss).map((x) => x.slug),
  complete_loss_with_route_disagreement: redactionCheck.filter((x) => x.complete_lead_job_loss && !x.lanes_agree_on_route).map((x) => x.slug),
  records_with_name_job_words_lost: redactionCheck.filter((x) => x.name_job_words_lost.length).map((x) => `${x.slug} (${x.name_job_words_lost.join(', ')})`),
  records_with_lost_job_word_and_a_route_promise_or_job_disagreement: redactionCheck.filter((x) => disagreements.some((d) => d.slug === x.slug && ['route', 'promise_class', 'reason_code', 'primary_job'].includes(d.field))).map((x) => x.slug),
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
      if (k && st && coverage[st] && !coverage[st].disputed.includes(r.slug)) coverage[st].disputed.push(r.slug);
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
// 7. Lock criteria (PH1-11 as adjusted by PH1-16)
// ---------------------------------------------------------------------------
// Unseen acceptance is computed from record-level matches (Codex review 2026-10-12): >= 6 unseen slots
// matching all firm values in BOTH lanes, and >= 2 analyst-identified trap slots whose route + reason both lanes match.
const trapSlotsBothRouteMatch = unseenScore.filter((s) => CLASSIFY.unseen_traps[s.slot] && s.A_route_and_reason_match && s.B_route_and_reason_match).map((s) => s.slot);
const unseenComputedMet = S.records.length >= 6 && Math.min(unseenSlotMatch.A.all_firm, unseenSlotMatch.B.all_firm) >= 6 && trapSlotsBothRouteMatch.length >= 2;
const coreDis = disagreements.filter((d) => !d.supplementary);
const routeDis = coreDis.filter((d) => d.field === 'route');
const lockCriteria = [
  { criterion: 'Every subtype >= 5 products (agreed; committed + held, held reported separately)', met: coverageTable.every((c) => c.meets_5_incl_held),
    numbers: `${coverageTable.filter((c) => c.meets_5_incl_held).length}/12 subtypes reach 5 incl. held; ${coverageTable.filter((c) => c.meets_5_committed_only).length}/12 reach 5 committed; short incl. held: ${coverageTable.filter((c) => !c.meets_5_incl_held).map((c) => `${c.subtype} ${c.total_agreed}`).join(', ') || 'none'}` },
  { criterion: 'Two blind lanes agree on all routes and properties, no unresolved disagreements', met: coreDis.length === 0,
    numbers: `${routeDis.length} route and ${coreDis.length} core-field disagreements on ${new Set(coreDis.map((d) => d.slug)).size} records (all classified: ${unclassified.length === 0})` },
  { criterion: 'Two independent claim normalisations give identical hold levels', met: holdCheck.criterion_met,
    numbers: `${holdCheck.identical}/${holdCheck.products_where_either_emits_a_level} identical` },
  { criterion: '>= 6 unseen products incl. >= 2 traps, matching pre-registered expectations', met: unseenComputedMet,
    numbers: `computed: ${Math.min(unseenSlotMatch.A.all_firm, unseenSlotMatch.B.all_firm)} slots match all firm values in both lanes (A ${unseenSlotMatch.A.all_firm}/${S.records.length}, B ${unseenSlotMatch.B.all_firm}/${S.records.length}); ${trapSlotsBothRouteMatch.length} trap slots with route+reason matched by both lanes (${trapSlotsBothRouteMatch.join(', ')}). Analyst note: ${CLASSIFY.unseen_criterion_numbers}` },
  { criterion: 'Leave-in addendum drafted and queued for right after lock (PH1-16)', met: false, numbers: 'not drafted (no addendum file in the repo; queued only as an intention in PH1-16)' },
];

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------
const out = {
  generated_by: 'data/research/styling-inci/v1.0/round-2/diff.js',
  inputs: {
    lane_A: { file: 'blind-lane-A-r2/results.json', model: A.model, standard: A.standard, run_at: A.run_at || null },
    lane_B: { file: 'blind-lane-B-r2/results.json', model: B.model, standard: B.standard, run_note: B.run_note || null },
    sealed: { file: 'sealed/unseen-expectations-r2.json', sealed_at: S.sealed_at, standard_version: S.standard_version, lexicon_version: S.lexicon_version },
    cohort: { file: 'r2/cohort.json', cohort_version: C.cohort_version, frozen_on: C.frozen_on },
    round1: { file: 'round-1/diff.json' },
  },
  normalisation: NORMALISATION_NOTES,
  counts: {
    records: rows.length,
    by_role: Object.fromEntries(ROLES.map((role) => [role, rows.filter((r) => r.role === role).length])),
    by_origin: Object.fromEntries(ORIGINS.map((o) => [o, rows.filter((r) => r.origin === o).length])),
    disagreements_core_fields: coreDis.length,
    disagreements_supplementary_secondary_jobs: disagreements.filter((d) => d.supplementary).length,
    records_with_any_core_disagreement: new Set(coreDis.map((d) => d.slug)).size,
    route_disagreements: routeDis.length,
    disagreements_by_class: coreDis.reduce((m, d) => { m[d.classification] = (m[d.classification] || 0) + 1; return m; }, {}),
    disagreements_by_root_cause: coreDis.reduce((m, d) => { m[d.root_cause] = (m[d.root_cause] || 0) + 1; return m; }, {}),
    records_by_root_cause: Object.fromEntries(Object.entries(coreDis.reduce((m, d) => { (m[d.root_cause] = m[d.root_cause] || new Set()).add(d.slug); return m; }, {})).map(([k, v]) => [k, [...v].sort()]).sort((x, y) => (x[0] < y[0] ? -1 : 1))),
    records_by_class: Object.fromEntries(['a', 'b', 'c', 'd'].map((k) => [k, new Set(coreDis.filter((d) => d.classification === k).map((d) => d.slug)).size])),
    route_split_records: routeDis.map((d) => ({ slug: d.slug, A: d.A, B: d.B, class: d.classification, root_cause: d.root_cause })),
    unclassified_disagreements: unclassified,
    unseen_misses: unseenMisses.length,
    unclassified_unseen_misses: unseenUnclassified,
  },
  overall_agreement: overallAgreement,
  field_agreement: fieldAgreement,
  route_agreement_by_pair_rule: routeAgreementByRule,
  round1_to_round2: round1Comparison,
  hold_normalisation_check: holdCheck,
  unseen: {
    totals_by_firmness: Object.fromEntries(['A', 'B'].map((l) => [l, {
      firm_matched: unseenTotals[l].firm[0], firm_total: unseenTotals[l].firm[1],
      soft_matched_incl_alternatives: unseenTotals[l].soft[0], soft_total: unseenTotals[l].soft[1],
      soft_exact_expected_value: unseenTotals[l].soft_exact[0],
      undetermined_in_acceptable: unseenTotals[l].und[0], undetermined_total: unseenTotals[l].und[1],
    }])),
    criterion: unseenCriterion,
    slots: unseenScore,
    misses: unseenMisses,
    undetermined: undeterminedReport,
  },
  coverage_per_subtype_agreed: coverageTable,
  lock_criteria: lockCriteria,
  s0_redaction_check: { summary: redactionSummary, records: redactionCheck },
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
  console.log(JSON.stringify({ counts: out.counts, overall: out.overall_agreement, r1r2: Object.fromEntries(Object.entries(round1Comparison).filter(([k]) => !['persisting', 'resolved', 'new_in_round2'].includes(k))), hold: { n: holdCheck.products_where_either_emits_a_level, mismatches: holdCheck.mismatches }, unseen: out.unseen.totals_by_firmness, unseen_criterion: unseenCriterion, redaction: redactionSummary, lock: lockCriteria }, null, 2));
}
if (process.argv.includes('--dump')) {
  for (const d of disagreements) {
    console.log(`\n### ${d.slug} [${d.role}/${d.origin}] ${d.field}${d.supplementary ? ' (supp)' : ''} :: ${d.classification} ${d.root_cause || ''}`);
    console.log('  A =', JSON.stringify(d.A), '\n  B =', JSON.stringify(d.B));
    console.log('  A path:', d.A_rule_path.slice(0, 900));
    console.log('  B path:', d.B_rule_path.slice(0, 600));
  }
}

// TABLES_BEGIN
// --tables: print the report's full markdown tables (built from the same output object) to stdout.
function markdownTables(d) {
  const v = (x) => (x && typeof x === 'object' && !Array.isArray(x) && x.T_LI && x.T_S ? `T_S ${x.T_S.inci} r${x.T_S.rank} ${x.T_S.status}; T_LI ${x.T_LI.inci} r${x.T_LI.rank} ${x.T_LI.status}` : x === null ? '—' : Array.isArray(x) ? (x.length ? x.map((y) => (y === null ? 'null' : typeof y === 'object' ? JSON.stringify(y).replace(/"/g, '') : String(y))).join(', ') : '[]') : typeof x === 'object' ? JSON.stringify(x).replace(/"/g, '') : String(x));
  const esc = (s) => String(s).replace(/\|/g, '\\|');
  const fa = d.field_agreement;
  let o = '';
  o += '### T1. Field agreement (A vs B, after normalisation)\n\n| Field | All 139 | Where either lane emitted | Calibration (116) | Neg. control (15) | Unseen (8) | Carried (107) | New (32) | Disagreements |\n|---|---|---|---|---|---|---|---|---|\n';
  for (const [f, x] of Object.entries(fa)) {
    if (f === 'tail_T_S' || f === 'tail_T_LI') continue;
    const sup = ['secondary_jobs', 'ingredient_flags', 'application_moment_also'].includes(f);
    o += `| ${f}${sup ? ' (supplementary)' : ''} | ${x.all.agree}/${x.all.n} (${x.all.pct} %) | ${x.all.agree_where_emitted}/${x.all.emitted_by_either} (${x.all.pct_where_emitted} %) | ${x.calibration.pct} % | ${x.negative_control.pct} % | ${x.unseen.pct} % | ${x.carried.pct} % | ${x.new.pct} % | ${x.all.n - x.all.agree} |\n`;
  }
  for (const f of ['tail_T_S', 'tail_T_LI']) { const x = fa[f]; o += `| ↳ ${f} | ${x.all.agree}/${x.all.n} (${x.all.pct} %) | — | ${x.calibration.pct} % | ${x.negative_control.pct} % | ${x.unseen.pct} % | ${x.carried.pct} % | ${x.new.pct} % | ${x.all.n - x.all.agree} |\n`; }
  o += '\n### T2. Overall agreement (21 core fields)\n\n| Subset | Cells agree | Emitted cells agree | Records with all 21 fields equal |\n|---|---|---|---|\n';
  for (const [k, x] of Object.entries(d.overall_agreement)) o += `| ${k} (${x.records}) | ${x.cells_agree}/${x.field_cells} (${x.pct_cells} %) | ${x.emitted_cells_agree}/${x.emitted_cells} (${x.pct_emitted_cells} %) | ${x.records_all_fields_agree}/${x.records} (${x.pct_records} %) |\n`;
  const r1 = d.round1_to_round2;
  o += `| round 1, same 107 records | ${r1.round1_overall_all_107.cells_agree}/${r1.round1_overall_all_107.field_cells} (${r1.round1_overall_all_107.pct_cells} %) | — | ${r1.round1_overall_all_107.records_all_fields_agree}/107 |\n`;
  o += '\n### T3. Route agreement per pair rule / boundary reason\n\n| Reason (canonical) | Records (either lane) | Route agrees | Reason agrees |\n|---|---|---|---|\n';
  for (const x of d.route_agreement_by_pair_rule) o += `| ${x.reason_code} | ${x.records} | ${x.route_agree} | ${x.reason_agree} |\n`;
  o += '\n### T4. Route splits\n\n| Product | A | B | Class | Root cause |\n|---|---|---|---|---|\n';
  for (const x of d.counts.route_split_records) o += `| \`${x.slug}\` | ${x.A} | ${x.B} | ${x.class} | ${x.root_cause} |\n`;
  o += '\n### T5. Every core-field disagreement\n\nRoute splits cascade into every Styling field of the record; those cells carry the record\'s root cause.\n\n| # | Product | Role / origin | Field | A | B | Class | Root cause | Right lane |\n|---|---|---|---|---|---|---|---|---|\n';
  let i = 0;
  for (const x of d.disagreements.filter((y) => !y.supplementary)) { i++; o += `| ${i} | ${esc(x.name)} (\`${x.slug}\`) | ${x.role} / ${x.origin} | ${x.field} | ${esc(v(x.A))} | ${esc(v(x.B))} | ${x.classification} | ${x.root_cause} | ${x.right_lane || '—'} |\n`; }
  o += '\n### T6. secondary_jobs disagreements (supplementary)\n\n| Product | A | B | Root cause |\n|---|---|---|---|\n';
  for (const x of d.disagreements.filter((y) => y.supplementary)) o += `| \`${x.slug}\` | ${v(x.A)} | ${v(x.B)} | ${x.root_cause} |\n`;
  o += '\n### T7. Round 1 → round 2 on the 107 carried records\n\n';
  o += `Round-1 core disagreements on these records: ${r1.round1_core_disagreements_on_carried}; resolved in round 2: ${r1.resolved_core}; persisting: ${r1.persisting_core}; new in round 2: ${r1.new_core_in_round2} (on ${new Set(r1.new_in_round2.filter((x) => x.field !== 'secondary_jobs').map((x) => x.slug)).size} records). secondary_jobs: resolved ${r1.resolved_secondary_jobs}, persisting ${r1.persisting_secondary_jobs}, new ${r1.new_secondary_jobs}.\n\n`;
  o += '| Persisting | Field | Round-1 cause | Round-2 A | Round-2 B | Round-2 cause |\n|---|---|---|---|---|---|\n';
  for (const x of r1.persisting) o += `| \`${x.slug}\` | ${x.field} | ${x.round1_root_cause} | ${esc(v(x.round2_A))} | ${esc(v(x.round2_B))} | ${x.round2_root_cause} |\n`;
  o += '\n| Resolved round-1 cause | Cells |\n|---|---|\n';
  for (const [k, n] of Object.entries(r1.resolved_by_round1_root_cause).sort()) o += `| ${k} | ${n} |\n`;
  o += '\n### T8. Hold levels — every product where either lane emits one\n\n| Product | Subtype | A | B | Same |\n|---|---|---|---|---|\n';
  for (const h of d.hold_normalisation_check.all_rows) o += `| ${esc(h.name)} (\`${h.slug}\`) | ${h.subtype} | ${v(h.A)} | ${v(h.B)} | ${h.same ? 'yes' : '**no**'} |\n`;
  o += '\n### T9. Unseen scoring per slot (sealed r2)\n\n| Slot | Product | Expected route (reason) | A route/reason | B route/reason | A firm | B firm | A soft | B soft | UNDETERMINED (A/B in acceptable) | Trap |\n|---|---|---|---|---|---|---|---|---|---|---|\n';
  for (const s of d.unseen.slots) {
    const g = (f) => s.fields.find((x) => x.field === f);
    const fm = (l, fi) => { const xs = s.fields.filter((x) => x.firmness === fi); return `${xs.filter((x) => x[l + '_match']).length}/${xs.length}`; };
    const und = s.fields.filter((x) => x.firmness === 'UNDETERMINED');
    o += `| ${s.slot} | ${esc(s.name)} | ${v(g('route').expected)} (${v(g('reason_code').expected)}) | ${g('route').A} (${g('reason_code').A}) | ${g('route').B} (${g('reason_code').B}) | ${fm('A', 'firm')} | ${fm('B', 'firm')} | ${fm('A', 'soft')} | ${fm('B', 'soft')} | ${und.length ? und.map((x) => `${x.field}: ${v(x.A)}/${v(x.B)} (${x.A_in_acceptable ? 'in' : 'out'}/${x.B_in_acceptable ? 'in' : 'out'})`).join('; ') : '—'} | ${s.trap_exercised} |\n`;
  }
  o += '\n### T10. Unseen misses and UNDETERMINED values\n\n| Slot | Product | Lane | Field | Firmness | Expected | Got | Class | Root cause |\n|---|---|---|---|---|---|---|---|---|\n';
  for (const m of d.unseen.misses) o += `| ${m.slot} | ${esc(m.name)} | ${m.lane} | ${m.field} | ${m.firmness} | ${esc(v(m.expected))} | ${esc(v(m.got))} | ${m.classification} | ${m.root_cause} |\n`;
  o += '\n| Slot | Product | UNDETERMINED field | Acceptable | Sealed lean | A | B | Rule gap |\n|---|---|---|---|---|---|---|---|\n';
  for (const u of d.unseen.undetermined) o += `| ${u.slot} | \`${u.slug}\` | ${u.field} | ${esc(v(u.acceptable))} | ${esc(v(u.leaning))} | ${esc(v(u.A))} | ${esc(v(u.B))} | ${u.rule_gap} |\n`;
  o += '\n### T11. Coverage per subtype (A and B agree on route kind and subtype)\n\n| Subtype | Committed | Held (PH2-2) | Total | ≥ 5 committed | ≥ 5 incl. held | Disputed |\n|---|---|---|---|---|---|---|\n';
  for (const c of d.coverage_per_subtype_agreed) o += `| ${c.subtype} | ${c.committed_agreed} | ${c.held_agreed} | ${c.total_agreed} | ${c.meets_5_committed_only ? 'yes' : '**no**'} | ${c.meets_5_incl_held ? 'yes' : '**no**'} | ${c.disputed_slugs.join(', ') || '—'} |\n`;
  o += '\n### T12. S0 redaction check (records whose lead line or confirmed name lost a styling job word)\n\n| Product | Name raw → S0 | Lead line S0 | Lost | Complete loss | Route A / B |\n|---|---|---|---|---|---|\n';
  for (const x of d.s0_redaction_check.records) o += `| \`${x.slug}\` | ${esc(x.name_raw)} → ${esc(x.name_s0)} | ${esc(x.lead_s0.slice(0, 110))}${x.lead_s0.length > 110 ? '…' : ''} | ${esc([...x.name_job_words_lost, ...x.lead_job_words_lost].join(', '))} | ${x.complete_lead_job_loss ? '**yes**' : 'no'} | ${esc(x.routes.A)} / ${esc(x.routes.B)} |\n`;
  return o;
}
if (process.argv.includes('--tables')) process.stdout.write(markdownTables(out));
// TABLES_END
