# Styling calibration round 4 (confirmation round) — diff, scoring and impact triage

Blind lane A (Claude Opus) vs blind lane B (Codex) on the frozen round-4 cohort (`r4/cohort.json`, 143 records, standard `styling-inci-v0.4` as amended, lexicon v0.4). Every number comes from `round-4/diff.js` (deterministic; two runs give byte-identical `diff.json`). Analyst judgments — classifications, the findings register, impact classes, owner questions — are recorded inside the script (`CLASSIFY` block), so they are reproducible and reviewable. Nothing here is committed, locked or ruled.

## Executive summary

**Agreement.** The two lanes now agree on 2923 of 3003 field cells (97.3 %; round 3: 95.4 %) and on all 21 fields for 120 of 143 products (round 3: 95). Core-field disagreements fell from 138 on 48 products to **80 on 23 products**; route splits from 8 to **5**. Route agrees on 138/143, the full state (route + reason + subtype) on 134/143.

**Round 3 → round 4.** 133 of the 138 round-3 disagreements are gone. The 5 that persist are all lane errors (lane B still assigns a promise class to blocked records and still raises heat activation from claims in the blind field; lane A regressed on one tail-marker status). All 24 product checks of the round-3 owner rulings (R3-Q1…Q4, R3-H, R3-H2…H5) reached their intended outcome in **both** lanes; 34 of 37 checks on the RG3 fixes and round-3 lane errors did too (T7). 75 new disagreement cells appeared on 18 products — **55 of them from one new question** that the round-4 pack-name capture created: a product whose pack or German brand page now gives its name but no promise sentence (RG4-1).

**Hold check.** 46 of 46 products with a hold level are identical in both lanes (round 3: 38/44). All six round-3 hold mismatches are resolved. Criterion (c) is met.

**Coverage.** All 12 subtypes reach 5 agreed products when held records count; `texture_spray` is back to 6 (R3-Q3, RG3-18). `smoothing_styler` has 5 (KMS 2-in-1 Spray committed; Color Wow, Elnett 3 Tage Glatt, KMS Straightening Creme and Wella Flowing Form held), so the R3-Q1 market-size exception is no longer needed for the incl.-held count. Committed only, four subtypes stay under 5: curl_cream 1, smoothing_styler 1, refresher 1, salt_spray 4.

**Findings by impact.** One deduplicated register (RG4-1…RG4-27) merges every rule gap the diff found with lane A's 36 findings and lane B's 7 ambiguous rules (all 43 mapped, none dropped), plus 4 packet issues (P4-1…P4-4) and 5 lane errors (E4-1…E4-5):

| Impact | Register items | Owner decisions | Cause an A/B split today | Packet issues |
|---|---|---|---|---|
| **I-1** route / recommendability | 8 | 5 | 4 | 1 |
| **I-2** user-visible value | 7 | 1 | 3 | 1 |
| **I-3** internal / label only | 12 | 0 | 6 | 2 |

**Lock status (R3-L).** Not yet. Met: (a) coverage, (c) hold levels, (d) unseen products (round 2), (e) the Leave-in addendum draft is queued (`docs/research/leave-in-inci/v1.2/DRAFT-styling-border-addendum.md`). Not met: (b) — R3-L asks the confirmation round to show **only lane errors and no new rule gaps**; round 4 shows 9 lane-error cells and 27 rule gaps (15 of them cause a split today or need an owner decision, 12 are wording fixes on outputs both lanes already agree on). What remains: owner answers to Q1–Q7 below, the mechanical text fixes (I-2/I-3), the four packet fixes, then a further confirmation round on the changed rules.

**A proposal for the owner (not a decision).** Under R3-L as worded, each of the 12 wording fixes on agreed outputs also counts as a „new rule gap", so a fifth round can fail on items that move nothing. One option: count only I-1 and I-2 gaps against R3-L and close I-3 items by text in v0.5 without another blind round. The alternative is to keep R3-L literal and run round 5 on the whole cohort.

## I-1 owner questions (route / recommendability), ranked

**Q1 (RG4-1). If a product's pack or German brand page shows only its name — no promise sentence — may the name count as the product's promise?**
Example: American Crew „FIBER". The German brand page shows only the name; „starker Halt, mattes Finish" comes from a shop (C3). Lane A: blocked, not recommendable. Lane B: Styling molding, recommendable, hold and finish shown as „keine Herstellerangabe". Same question for Kérastase „CURL MANIFESTO REFRESH ABSOLU Second day curl refreshing spray" (would go to Leave-in).
Affected: 5 products split today (American Crew Fiber, American Crew Pomade, Kérastase Curl Refresh, Langhaarmädchen Lockenspray Halt & Sprungkraft, Redken Beach Spray) — 55 of the 80 disagreement cells.
**Recommendation:** yes, but only for a C1/C2 name that names exactly one job (the test §4.2 step 1 already uses), never a shop title; claim-keyed values stay empty. Effect: Fiber ⇒ committed molding, Kérastase ⇒ Leave-in; Pomade stays blocked (its directions come from the US site, P4-1), Langhaarmädchen stays blocked (its name names curl, hold and spring — several jobs), Redken Beach Spray stays blocked (paraphrased directions).

**Q2 (RG4-4). Is „Beach Waves / Strandwellen" a texture look (salt spray) or curl definition? Are „Glaze"/„Topcoat" shine words?**
Example: alverde Beach Waves Spray (sea salt, alcohol, no polymer, no care). Read as curl definition it goes through the Leave-in check and is held — not recommendable until the Leave-in addendum; read as texture it is a committed salt spray, recommendable now. In round 3 both lanes committed it; in round 4 both hold it, because v0.4 made every wave noun a curl word (RG3-1). Syoss Glaze Topcoat likewise moved from committed shine finish (round 3) to manual review (round 4) in both lanes.
Affected: 2 products change state; 1 split today (alverde's main job).
**Recommendation:** texture — „Beach Waves / Strandwellen / beachy" names the salt-spray look, as the §5 salt_spray anchor already says; keep the curl-word rule for Wellen-Spray / Wellenauffrischer products. Yes, Glaze / Topcoat / Gloss are shine words. Effect: both products committed again.

**Q3 (RG4-3). Does a result phrase like „strong hair" count as a care promise?**
Example: Aussie Work That Curl Leave-In Cream, pack: „5 days of curl definition (plus 48-hour frizz protection) and strong hair*". Lane A: „strong hair" is strengthening care ⇒ care + definition ⇒ manual review. Lane B: a result phrase, like „gepflegte Locken" ⇒ Leave-in. It never becomes Styling either way.
Affected: 1 split (Aussie); the same word list decides three agreed products (Redken One United „Treatment", Wella „Nutri-", Wella „Balsam-Lotion").
**Recommendation:** no — only a care verb or care noun counts (pflegt/Pflege/Care, Kur, Balsam, Treatment, Feuchtigkeit, nährt, repariert, stärkt as a verb, entwirrt); result phrases and line prefixes („Nutri-") do not. Aussie ⇒ Leave-in; the others unchanged.

**Q4 (RG4-6). Should a smoothing spray whose main active is a hold polymer (little care) be a Styling smoothing styler, like the two straightening creams?**
Example: Balea Glattspray Anti-Frizz — fixative-led, thin conditioning, sold for smoothing. It falls between the rules and goes to manual review (both lanes).
Affected: 1 product (no split).
**Recommendation:** yes, held like Wella Flowing Form; the R3-Q4 reason (a straightening product should not reach curly users as a care Leave-in) applies equally. smoothing_styler 5 ⇒ 6.

**Q5 (RG4-5). Three products are held by an owner-registry row although the v0.4 letter would now commit one and send another to review. Keep them held?**
Example: Bali Curls Strong Hold Flaxseed Gel — its name says only „Strong Hold", so the letter commits it as a gel (recommendable now); the registry and §11.19 hold it (D6). Kevin.Murphy Killer.Curls and John Frieda Lockencreme Traumlocken are held by their D7 rows; for Traumlocken the original override reason (no C1/C2 promise) is gone since a pack line was captured. Both lanes hold all three.
Affected: 3 products (no split).
**Recommendation:** keep them held until the Leave-in addendum (conservative; the addendum is queued right after lock) and write the reason down: a registry D6/D7 row rules the route for the record it names; li_function reads the lead promise only.

**Q6 (RG4-2, RG4-7, RG4-8). Confirm three text fixes that keep today's intended outcomes.**
(a) HASK curls defining cream: the registry row still uses the old shop name „HASK Curl Care", so lane B missed it (manual review instead of the ruled Leave-in) ⇒ every registry row gets brand + pack name (+ GTIN) and the packet an opaque registry pointer. (b) §4.5's FX-4 sentence ⇒ routes via 3.4 (ii)/3.5 are never held (Barber Club Pomade, Redken Wax Spray, Taft x Gliss Shine Coat stay committed). (c) R3-Q3's „names that name both jobs" means „Pflege & Styling 2in1/3in1"-type names, and R1-Q3 wins over R3-Q3 (Balea Finishing Spray Glow & Care stays committed, JF Wellenauffrischer stays in review).
Affected: 1 split (HASK); 5 products confirmed unchanged. **Recommendation:** approve as worded in the register.

Packet issue with I-1 stakes: **P4-1** — American Crew Pomade's directions come from americancrew.com (C5, outside the G1 hierarchy) but ship as „verbatim" and count as captured in the freeze's gate table. Matters only if Q1 is answered yes.

## I-2 (user-visible values)

**Q7 (RG4-9, product decision). Is Taft „Gel Wax Glanz" a styling wax or a shine finisher?**
Example: Taft Gel Wax Glanz („bietet ein glänzendes Finish mit langanhaltendem Halt", Haltegrad 2 of 5; no wax or hold polymer in the formula). Lane A: shine finisher (the shine word is its only job; then flagged „hold claim without hold ingredient"). Lane B: wax (Modellieren), finish „glänzend". The same rule decides got2b Texture Clay's main job (texture vs hold).
Affected: 2 products split (subtype, main job, flag).
**Recommendation:** wax — the product noun names the job and „Glanz" stays the finish (as „Haarspray Glanz" is a hairspray); „glänzend" is still shown. Texture Clay ⇒ main job hold, texture secondary.

Mechanical I-2 fixes (no owner decision; proposed wording in the register, T11):

| ID | What | Products | Split today | Proposed reading |
|---|---|---|---|---|
| RG4-10 | „POWER-SHINE-TECHNOLOGIE" as a finish claim | Elnett 3 Tage Glatt | yes (finish, secondary) | a technology label is a call-out ⇒ finish unbekannt |
| RG4-11 | stale §11.2 finish | Balea Traumlocken | no | natürlich (RG-10) |
| RG4-12 | „leichte Fixierung", „fixiert die Frisur" | Balea Finishing Stick, Balea Overnight | no | Fixierung + strength word = Halt; a fixing verb alone = hold_fix secondary, no level |
| RG4-13 | subtype ties | Balea Pure Volumenpuder Spray, Redken Root Tease | no | aerosol powder ⇒ texture_spray; volume lead with teasing ⇒ texture_spray |
| RG4-14 | moment/zone readings | Balea Finishing Stick, Balea Ultra Volumen, JF Pushed Up | no | stick on dry hair ⇒ dry_finish/surface; „Ansatz … bis in die Längen" ⇒ all; „vom Ansatz her" ⇒ roots |
| RG4-15 | salt flag behind a merged token | Balea Locken Revitalizing | yes (flags) | may-hide ⇒ unknown, never false |
| P4-2 | heat-protection lines not typed as heat claims | KMS 2-in-1, OSiS Sparkler | no | re-type as C2 heat claims (shown as „Hitzeschutz laut Hersteller") |

## I-3 (internal / labels only)

| ID | What | Products | Split today | Lean / fix |
|---|---|---|---|---|
| RG4-16 | got2b six-mark display; Taft gel „Haltegrad 5" of 5 | got2b Sprühkleber, Taft Power Gel | no | add §7.3 rows; every reading gives 4 |
| RG4-17 | secondaries: refill after a gate drop, packet order, which claim types state a job | 8 records (secondary_jobs) | yes | first two eligible, gate, then refill; humidity/duration lines state no job |
| RG4-18 | blind heat_activated vs §6.13's Color Wow `unresolved` | Color Wow | yes | lanes apply the claim raise themselves (simplest; also dissolves E4-2) |
| RG4-19 | T_LI „implausible" vs the PH1-13 dose rule | OSiS Curl Retouch | yes | plausible (B) |
| RG4-20 | stale NEQI registry letters after RG3-4 | NEQI All, NEQI Ultimate | yes (All) | All: letter leave_in, no override (A) |
| RG4-21 | `inci_conflict` not in §2.3; two blocks, one reason; stale Ansatz-Booster notes | 3 conflict records | no | add the state; formula_conflict wins; re-derive notes |
| RG4-22 | definition word in the name as the definition half | HASK | no | state the symmetry with care words |
| RG4-23 | English lines on the German-market pack | Aussie, HASK, Cantu ×2 | no | C1 whatever the language |
| RG4-24 | unplaced lexicon species | Moroccanoil Volumizing, Bali Gents Sea Salt | no | place in lexicon v0.5 |
| RG4-25 | D8b rule 2 needs a sibling the lane cannot see | Taft Classic / Glanz | no | run rule 2 in the pipeline, not per lane |
| RG4-26 | „Sleek" edge stick and li_function | Bali Sleek Stick | yes (reason) | li_function no (R1-Q2 extended) — B |
| RG4-27 | NF-U film formers in fixative_family | 4 records | yes (flags) | NF-U adds natural_film (B) |
| P4-3 | promise lines carry no position | Elnett | no | add `position` to every line |
| P4-4 | product_type_word „gel" for a spray | got2b Schutzengel | no | re-derive from the pack name |

## Packet issues

| ID | Impact | Products | Issue | Fix |
|---|---|---|---|---|
| P4-1 | I-1 | American Crew Pomade | C5 directions (americancrew.com) shipped as „verbatim" and counted by the freeze gate | count only G1-tier directions; capture German directions |
| P4-2 | I-2 | KMS 2-in-1 Spray, OSiS Sparkler | protection-from-heat lines typed as promise, S0 heat field empty | re-type as heat claims |
| P4-3 | I-3 | Elnett 3 Tage Glatt | no line positions (§4.2 says they exist) | add `position` |
| P4-4 | I-3 | got2b Schutzengel | product_type_word „gel" | re-derive („spray") |

## Lane errors (proven against a clear rule)

| ID | Lane wrong | Products | Field | Rule | Moves a value |
|---|---|---|---|---|---|
| E4-1 | B | Cantu Edge Stay Gel, JF Ansatz-Booster, KM Powder.Puff, Redken Beach Spray | promise_class | §4.1 „S0 runs only when all three hold", §4.7: a blocked record has no class | no |
| E4-2 | B | Guhl Föhn-Spray, KMS 2-in-1, KMS Straightening Creme | heat_activated | RG2-26 / §6.13: blind round reads F/U only (persisting E3-4); final value after unblinding is yes in both lanes | no |
| E4-3 | A | Moroccanoil Textur- & Volumenpuder | T_LI status | clause-6 closed set ⇒ vacuous (A regressed from round 3) | no |
| E4-4 | B | taft x Gliss Hitzeschutzspray | T_LI status | clause-6 closed set ⇒ vacuous | no |
| E4-5 | B | Redken Wax Spray | ingredient_flags.oils (supplementary) | WL-6 Glycine Soja Oil r12; flags read the whole list | no |

## Normalisation changes against round 3

Same 21 core fields and the same supplementary fields. Changes (both lanes changed vocabulary again; full text in `diff.json` → `normalisation`): reason codes mapped to the canonical pair rule / boundary reason from the round-4 vocabularies (lane B: `no_leave_in_function` ⇒ 3.4 (ii), `non_aqueous` ⇒ 3.5, `li_g0_in_category` ⇒ 3.4 (iii) in-category, `ruled_route_override` ⇒ 4.6_owner_named …; lane A: `ruled_route_override` on a non-boundary route ⇒ 4.6_owner_named); lane A's buildup string `fired`/`not_fired` ⇒ fires/does_not_fire; lane A's informational profile on its 41 non-Styling records now includes heat protection, moment, zone and activation, all masked like the formula values; lane B's ingredient_flags is an object again; salt „unknown" ⇒ null on both lanes.

## Tables

### T1. Field agreement (A vs B, after normalisation)

| Field | All 143 | Where either lane emitted | Calibration (128) | Neg. control (15) | Packets changed vs r3 (72) | Packets unchanged (71) | Disagreements |
|---|---|---|---|---|---|---|---|
| identity_status | 143/143 (100 %) | 143/143 (100 %) | 100 % | 100 % | 100 % | 100 % | 0 |
| tail_markers | 140/143 (97.9 %) | 140/143 (97.9 %) | 99.2 % | 86.7 % | 97.2 % | 98.6 % | 3 |
| promise_class | 133/143 (93 %) | 133/143 (93 %) | 93 % | 93.3 % | 90.3 % | 95.8 % | 10 |
| route | 138/143 (96.5 %) | 138/143 (96.5 %) | 97.7 % | 86.7 % | 94.4 % | 98.6 % | 5 |
| reason_code | 135/143 (94.4 %) | 135/143 (94.4 %) | 95.3 % | 86.7 % | 91.7 % | 97.2 % | 8 |
| subtype | 139/143 (97.2 %) | 87/91 (95.6 %) | 96.9 % | 100 % | 95.8 % | 98.6 % | 4 |
| result_mechanisms | 140/143 (97.9 %) | 88/91 (96.7 %) | 97.7 % | 100 % | 97.2 % | 98.6 % | 3 |
| hold_route | 140/143 (97.9 %) | 88/91 (96.7 %) | 97.7 % | 100 % | 97.2 % | 98.6 % | 3 |
| weight | 140/143 (97.9 %) | 88/91 (96.7 %) | 97.7 % | 100 % | 97.2 % | 98.6 % | 3 |
| alcohol_note | 140/143 (97.9 %) | 88/91 (96.7 %) | 97.7 % | 100 % | 97.2 % | 98.6 % | 3 |
| buildup_note | 140/143 (97.9 %) | 88/91 (96.7 %) | 97.7 % | 100 % | 97.2 % | 98.6 % | 3 |
| provides_heat_protection | 140/143 (97.9 %) | 88/91 (96.7 %) | 97.7 % | 100 % | 97.2 % | 98.6 % | 3 |
| application_moment | 140/143 (97.9 %) | 88/91 (96.7 %) | 97.7 % | 100 % | 97.2 % | 98.6 % | 3 |
| target_zone | 140/143 (97.9 %) | 88/91 (96.7 %) | 97.7 % | 100 % | 97.2 % | 98.6 % | 3 |
| heat_activated | 136/143 (95.1 %) | 84/91 (92.3 %) | 94.5 % | 100 % | 95.8 % | 94.4 % | 7 |
| hold_level | 143/143 (100 %) | 46/46 (100 %) | 100 % | 100 % | 100 % | 100 % | 0 |
| flexibility | 140/143 (97.9 %) | 88/91 (96.7 %) | 97.7 % | 100 % | 97.2 % | 98.6 % | 3 |
| finish | 139/143 (97.2 %) | 87/91 (95.6 %) | 96.9 % | 100 % | 95.8 % | 98.6 % | 4 |
| primary_job | 137/143 (95.8 %) | 83/89 (93.3 %) | 95.3 % | 100 % | 94.4 % | 97.2 % | 6 |
| neutral_fact | 141/143 (98.6 %) | 8/10 (80 %) | 98.4 % | 100 % | 98.6 % | 98.6 % | 2 |
| d8b_flags | 139/143 (97.2 %) | 87/91 (95.6 %) | 96.9 % | 100 % | 95.8 % | 98.6 % | 4 |
| secondary_jobs (supplementary) | 128/143 (89.5 %) | 76/91 (83.5 %) | 88.3 % | 100 % | 88.9 % | 90.1 % | 15 |
| ingredient_flags (supplementary) | 134/143 (93.7 %) | 82/91 (90.1 %) | 93 % | 100 % | 93.1 % | 94.4 % | 9 |
| ↳ tail_T_S | 143/143 (100 %) | — | 100 % | 100 % | 100 % | 100 % | 0 |
| ↳ tail_T_LI | 140/143 (97.9 %) | — | 99.2 % | 86.7 % | 97.2 % | 98.6 % | 3 |

### T2. Overall agreement (21 core fields)

| Subset | Cells agree | Emitted cells agree | Records with all 21 fields equal |
|---|---|---|---|
| all (143) | 2923/3003 (97.3 %) | 1963/2043 (96.1 %) | 120/143 (83.9 %) |
| calibration (128) | 2615/2688 (97.3 %) | 1895/1968 (96.3 %) | 109/128 (85.2 %) |
| negative_control (15) | 308/315 (97.8 %) | 68/75 (90.7 %) | 11/15 (73.3 %) |
| packets_changed_vs_r3 (72) | 1458/1512 (96.4 %) | 967/1021 (94.7 %) | 57/72 (79.2 %) |
| packets_unchanged_vs_r3 (71) | 1465/1491 (98.3 %) | 996/1022 (97.5 %) | 63/71 (88.7 %) |
| round 3, same 143 products | 2865/3003 (95.4 %) | — | 95/143 |

State agreement (route + canonical reason + subtype): 134/143; route: 138/143; state kind (committed / held / blocked:reason / other route): 137/143.

### T3. Route agreement per pair rule / boundary reason

| Reason (canonical) | Records (either lane) | Route agrees | Reason agrees |
|---|---|---|---|
| 3.1 | 3 | 3 | 3 |
| 3.2 | 4 | 4 | 4 |
| 3.3 | 6 | 6 | 6 |
| 3.4(ii) | 45 | 43 | 42 |
| 3.4(iii)_excluded_styling_first | 4 | 4 | 3 |
| 3.4(iii)_in_category | 17 | 15 | 14 |
| 3.5 | 23 | 23 | 23 |
| 4.6_owner_named | 6 | 5 | 4 |
| evidence_gate | 10 | 7 | 6 |
| formula_conflict | 3 | 3 | 3 |
| li_g0_provisional | 2 | 2 | 2 |
| mixed_promise | 9 | 7 | 7 |
| pending_leave_in_addendum | 19 | 19 | 18 |

### T4. Every core-field disagreement

Route splits cascade into every Styling field of the record; those cells carry the record's root cause. Full rule paths and lane notes are in `diff.json` → `disagreements[]`.

| # | Product | Field | A | B | Class | Root cause | Right lane |
|---|---|---|---|---|---|---|---|
| 1 | alverde NATURKOSMETIK Beach Waves Spray Seaside Balance (`alverde-beach-waves-spray-seaside-balance`) | primary_job | definition | texture | d | RG4-4 | — |
| 2 | American Crew FIBER (`american-crew-fiber`) | promise_class | not_assigned | styling_result | d | RG4-1 | — |
| 3 | American Crew FIBER (`american-crew-fiber`) | route | provisional_boundary | styling | d | RG4-1 | — |
| 4 | American Crew FIBER (`american-crew-fiber`) | reason_code | evidence_gate | 3.4(ii) | d | RG4-1 | — |
| 5 | American Crew FIBER (`american-crew-fiber`) | subtype | — | molding | d | RG4-1 | — |
| 6 | American Crew FIBER (`american-crew-fiber`) | result_mechanisms | — | fixative_film, wax_lipid | d | RG4-1 | — |
| 7 | American Crew FIBER (`american-crew-fiber`) | hold_route | — | present | d | RG4-1 | — |
| 8 | American Crew FIBER (`american-crew-fiber`) | weight | — | rich | d | RG4-1 | — |
| 9 | American Crew FIBER (`american-crew-fiber`) | alcohol_note | — | does_not_fire | d | RG4-1 | — |
| 10 | American Crew FIBER (`american-crew-fiber`) | buildup_note | — | fires | d | RG4-1 | — |
| 11 | American Crew FIBER (`american-crew-fiber`) | provides_heat_protection | — | false | d | RG4-1 | — |
| 12 | American Crew FIBER (`american-crew-fiber`) | application_moment | — | damp_before_drying | d | RG4-1 | — |
| 13 | American Crew FIBER (`american-crew-fiber`) | target_zone | — | all | d | RG4-1 | — |
| 14 | American Crew FIBER (`american-crew-fiber`) | heat_activated | — | no | d | RG4-1 | — |
| 15 | American Crew FIBER (`american-crew-fiber`) | flexibility | — | unbekannt | d | RG4-1 | — |
| 16 | American Crew FIBER (`american-crew-fiber`) | finish | — | unbekannt | d | RG4-1 | — |
| 17 | American Crew FIBER (`american-crew-fiber`) | primary_job | — | hold_fix | d | RG4-1 | — |
| 18 | American Crew FIBER (`american-crew-fiber`) | neutral_fact | — | enthält stylingpolymere (z. b. pvp) | d | RG4-1 | — |
| 19 | American Crew FIBER (`american-crew-fiber`) | d8b_flags | — | [] | d | RG4-1 | — |
| 20 | American Crew Styling Pomade (`american-crew-pomade`) | promise_class | not_assigned | styling_result | d | RG4-1 | A (under the proposed fix, P4-1) |
| 21 | American Crew Styling Pomade (`american-crew-pomade`) | route | provisional_boundary | styling | d | RG4-1 | A (under the proposed fix, P4-1) |
| 22 | American Crew Styling Pomade (`american-crew-pomade`) | reason_code | evidence_gate | 3.4(ii) | d | RG4-1 | A (under the proposed fix, P4-1) |
| 23 | American Crew Styling Pomade (`american-crew-pomade`) | subtype | — | molding | d | RG4-1 | A (under the proposed fix, P4-1) |
| 24 | American Crew Styling Pomade (`american-crew-pomade`) | result_mechanisms | — | fixative_film, wax_lipid | d | RG4-1 | A (under the proposed fix, P4-1) |
| 25 | American Crew Styling Pomade (`american-crew-pomade`) | hold_route | — | present | d | RG4-1 | A (under the proposed fix, P4-1) |
| 26 | American Crew Styling Pomade (`american-crew-pomade`) | weight | — | rich | d | RG4-1 | A (under the proposed fix, P4-1) |
| 27 | American Crew Styling Pomade (`american-crew-pomade`) | alcohol_note | — | does_not_fire | d | RG4-1 | A (under the proposed fix, P4-1) |
| 28 | American Crew Styling Pomade (`american-crew-pomade`) | buildup_note | — | fires | d | RG4-1 | A (under the proposed fix, P4-1) |
| 29 | American Crew Styling Pomade (`american-crew-pomade`) | provides_heat_protection | — | false | d | RG4-1 | A (under the proposed fix, P4-1) |
| 30 | American Crew Styling Pomade (`american-crew-pomade`) | application_moment | — | damp_before_drying | d | RG4-1 | A (under the proposed fix, P4-1) |
| 31 | American Crew Styling Pomade (`american-crew-pomade`) | target_zone | — | all | d | RG4-1 | A (under the proposed fix, P4-1) |
| 32 | American Crew Styling Pomade (`american-crew-pomade`) | heat_activated | — | no | d | RG4-1 | A (under the proposed fix, P4-1) |
| 33 | American Crew Styling Pomade (`american-crew-pomade`) | flexibility | — | unbekannt | d | RG4-1 | A (under the proposed fix, P4-1) |
| 34 | American Crew Styling Pomade (`american-crew-pomade`) | finish | — | unbekannt | d | RG4-1 | A (under the proposed fix, P4-1) |
| 35 | American Crew Styling Pomade (`american-crew-pomade`) | primary_job | — | hold_fix | d | RG4-1 | A (under the proposed fix, P4-1) |
| 36 | American Crew Styling Pomade (`american-crew-pomade`) | neutral_fact | — | enthält stylingpolymere (z. b. pvp) | d | RG4-1 | A (under the proposed fix, P4-1) |
| 37 | American Crew Styling Pomade (`american-crew-pomade`) | d8b_flags | — | [] | d | RG4-1 | A (under the proposed fix, P4-1) |
| 38 | AUSSIE WORK THAT CURL LEAVE-IN CREAM (`aussie-leave-in-creme-work-that-curl`) | promise_class | mixed | styling_result | d | RG4-3 | B (under the proposed fix) |
| 39 | AUSSIE WORK THAT CURL LEAVE-IN CREAM (`aussie-leave-in-creme-work-that-curl`) | route | provisional_boundary | leave_in | d | RG4-3 | B (under the proposed fix) |
| 40 | AUSSIE WORK THAT CURL LEAVE-IN CREAM (`aussie-leave-in-creme-work-that-curl`) | reason_code | mixed_promise | 3.4(iii)_in_category | d | RG4-3 | B (under the proposed fix) |
| 41 | Bali Curls Sleek Stick Brows & Edges (`bali-curls-sleek-stick-brows-and-edges`) | reason_code | 3.4(iii)_excluded_styling_first | 3.4(ii) | b | RG4-26 | B (lean) |
| 42 | Cantu Shea Butter for Natural Hair Firm Hold Edge Stay Gel (`cantu-shea-butter-extra-hold-edge-stay-gel`) | promise_class | not_assigned | styling_result | a | E4-1 | A |
| 43 | COLOR WOW Dream Coat Supernatural Spray (`color-wow-dream-coat-supernatural-spray`) | heat_activated | no | unresolved | b | RG4-18 | A (blind letter) / B (§6.13 example) |
| 44 | got2b (Schwarzkopf) Styling Paste iStyler Texture Clay (`got2b-styling-paste-istyler-texture-clay`) | primary_job | texture | hold_fix | d | RG4-9 | — |
| 45 | GUHL Föhn-Spray Langzeit Volumen (Föhn-Aktiv Styling Spray) (`guhl-foehn-spray-langzeit-volumen`) | heat_activated | no | yes | a | E4-2 | A |
| 46 | HASK curls defining cream (`hask-lockencreme-curl-care`) | route | leave_in | provisional_boundary | b | RG4-2 | A |
| 47 | HASK curls defining cream (`hask-lockencreme-curl-care`) | reason_code | 4.6_owner_named | mixed_promise | b | RG4-2 | A |
| 48 | John Frieda Volume Lift Ansatz-Booster (`john-frieda-volume-lift-ansatz-booster`) | promise_class | not_assigned | styling_result | a | E4-1 | A |
| 49 | Kérastase CURL MANIFESTO REFRESH ABSOLU Second day curl refreshing spray (`kerastase-curl-manifesto-refresh-absolu`) | promise_class | not_assigned | styling_result | d | RG4-1 | — |
| 50 | Kérastase CURL MANIFESTO REFRESH ABSOLU Second day curl refreshing spray (`kerastase-curl-manifesto-refresh-absolu`) | route | provisional_boundary | leave_in | d | RG4-1 | — |
| 51 | Kérastase CURL MANIFESTO REFRESH ABSOLU Second day curl refreshing spray (`kerastase-curl-manifesto-refresh-absolu`) | reason_code | evidence_gate | 3.4(iii)_in_category | d | RG4-1 | — |
| 52 | Kevin.Murphy Powder.Puff Volume (`kevin-murphy-powder-puff-volume`) | promise_class | not_assigned | styling_result | a | E4-1 | A |
| 53 | KMS Thermashape 2-in-1 Spray (`kms-thermashape-2-in-1-spray`) | heat_activated | no | yes | a | E4-2 | A |
| 54 | KMS Thermashape Straightening Creme (`kms-thermashape-straightening-creme`) | heat_activated | no | yes | a | E4-2 | A |
| 55 | LANGHAARMÄDCHEN LOCKENHALT SPRAY Halt & Sprungkraft (`langhaarmaedchen-lockenspray-halt-sprungkraft`) | promise_class | not_assigned | styling_result | d | RG4-1 | A (under the proposed fix) |
| 56 | LANGHAARMÄDCHEN LOCKENHALT SPRAY Halt & Sprungkraft (`langhaarmaedchen-lockenspray-halt-sprungkraft`) | reason_code | evidence_gate | pending_leave_in_addendum | d | RG4-1 | A (under the proposed fix) |
| 57 | LANGHAARMÄDCHEN LOCKENHALT SPRAY Halt & Sprungkraft (`langhaarmaedchen-lockenspray-halt-sprungkraft`) | subtype | — | gel | d | RG4-1 | A (under the proposed fix) |
| 58 | LANGHAARMÄDCHEN LOCKENHALT SPRAY Halt & Sprungkraft (`langhaarmaedchen-lockenspray-halt-sprungkraft`) | result_mechanisms | — | natural_film | d | RG4-1 | A (under the proposed fix) |
| 59 | LANGHAARMÄDCHEN LOCKENHALT SPRAY Halt & Sprungkraft (`langhaarmaedchen-lockenspray-halt-sprungkraft`) | hold_route | — | absent | d | RG4-1 | A (under the proposed fix) |
| 60 | LANGHAARMÄDCHEN LOCKENHALT SPRAY Halt & Sprungkraft (`langhaarmaedchen-lockenspray-halt-sprungkraft`) | weight | — | light | d | RG4-1 | A (under the proposed fix) |
| 61 | LANGHAARMÄDCHEN LOCKENHALT SPRAY Halt & Sprungkraft (`langhaarmaedchen-lockenspray-halt-sprungkraft`) | alcohol_note | — | does_not_fire | d | RG4-1 | A (under the proposed fix) |
| 62 | LANGHAARMÄDCHEN LOCKENHALT SPRAY Halt & Sprungkraft (`langhaarmaedchen-lockenspray-halt-sprungkraft`) | buildup_note | — | does_not_fire | d | RG4-1 | A (under the proposed fix) |
| 63 | LANGHAARMÄDCHEN LOCKENHALT SPRAY Halt & Sprungkraft (`langhaarmaedchen-lockenspray-halt-sprungkraft`) | provides_heat_protection | — | false | d | RG4-1 | A (under the proposed fix) |
| 64 | LANGHAARMÄDCHEN LOCKENHALT SPRAY Halt & Sprungkraft (`langhaarmaedchen-lockenspray-halt-sprungkraft`) | application_moment | — | damp_before_drying | d | RG4-1 | A (under the proposed fix) |
| 65 | LANGHAARMÄDCHEN LOCKENHALT SPRAY Halt & Sprungkraft (`langhaarmaedchen-lockenspray-halt-sprungkraft`) | target_zone | — | all | d | RG4-1 | A (under the proposed fix) |
| 66 | LANGHAARMÄDCHEN LOCKENHALT SPRAY Halt & Sprungkraft (`langhaarmaedchen-lockenspray-halt-sprungkraft`) | heat_activated | — | no | d | RG4-1 | A (under the proposed fix) |
| 67 | LANGHAARMÄDCHEN LOCKENHALT SPRAY Halt & Sprungkraft (`langhaarmaedchen-lockenspray-halt-sprungkraft`) | flexibility | — | unbekannt | d | RG4-1 | A (under the proposed fix) |
| 68 | LANGHAARMÄDCHEN LOCKENHALT SPRAY Halt & Sprungkraft (`langhaarmaedchen-lockenspray-halt-sprungkraft`) | finish | — | unbekannt | d | RG4-1 | A (under the proposed fix) |
| 69 | LANGHAARMÄDCHEN LOCKENHALT SPRAY Halt & Sprungkraft (`langhaarmaedchen-lockenspray-halt-sprungkraft`) | primary_job | — | definition | d | RG4-1 | A (under the proposed fix) |
| 70 | LANGHAARMÄDCHEN LOCKENHALT SPRAY Halt & Sprungkraft (`langhaarmaedchen-lockenspray-halt-sprungkraft`) | d8b_flags | — | [] | d | RG4-1 | A (under the proposed fix) |
| 71 | L'ORÉAL PARiS Elnett Stylingspray Hitzeschutz 3 Tage Glatt (`loreal-paris-elnett-stylingspray-hitzeschutz-3-tage-glatt`) | finish | glänzend | unbekannt | b | RG4-10 | B (lean) |
| 72 | Moroccanoil Textur- & Volumenpuder fürs Haar (Texture & Volume Hair Powder) (`moroccanoil-textur-und-volumenpuder`) | tail_markers | T_S parfum r5 plausible; T_LI sodium benzoate r7 plausible | T_S parfum r5 plausible; T_LI sodium benzoate r7 vacuous | a | E4-3 | B |
| 73 | NEQI Diamond Glass Styling Spray All (`neqi-diamond-glass-styling-spray-all`) | promise_class | styling_result | mixed | b | RG4-20 | A (lean) |
| 74 | NEQI Diamond Glass Styling Spray All (`neqi-diamond-glass-styling-spray-all`) | reason_code | 3.4(iii)_in_category | 4.6_owner_named | b | RG4-20 | A (lean) |
| 75 | Redken BEACH SPRAY BEACHY TEXTURE SPRAY (`redken-styling-beach-spray`) | promise_class | not_assigned | styling_result | a | E4-1 | A |
| 76 | Schwarzkopf Professional OSiS+ CURL RETOUCH CURL ENHANCING SPRAY (`schwarzkopf-professional-osis-curl-retouch`) | tail_markers | T_S phenoxyethanol r4 plausible; T_LI phenoxyethanol r4 implausible | T_S phenoxyethanol r4 plausible; T_LI phenoxyethanol r4 plausible | b | RG4-19 | B (lean) |
| 77 | Schwarzkopf Taft Gel Wax Glanz (Strahlender Glanz) (`schwarzkopf-taft-gel-wax-glanz-halt-2`) | subtype | shine_finish | molding | d | RG4-9 | — |
| 78 | Schwarzkopf Taft Gel Wax Glanz (Strahlender Glanz) (`schwarzkopf-taft-gel-wax-glanz-halt-2`) | primary_job | shine | hold_fix | d | RG4-9 | — |
| 79 | Schwarzkopf Taft Gel Wax Glanz (Strahlender Glanz) (`schwarzkopf-taft-gel-wax-glanz-halt-2`) | d8b_flags | claim_formula_conflict | [] | d | RG4-9 | — |
| 80 | Schwarzkopf taft taft x GLISS Lovely Long MULTITASKING HITZESCHUTZ-SPRAY (`taft-x-gliss-hitzeschutzspray-lovely-long`) | tail_markers | T_S parfum r10 plausible; T_LI sodium benzoate r13 vacuous | T_S parfum r10 plausible; T_LI sodium benzoate r13 plausible | a | E4-4 | A |

### T5. secondary_jobs disagreements (supplementary)

| Product | A | B | Root cause |
|---|---|---|---|
| `alverde-beach-waves-spray-seaside-balance` | texture | [] | RG4-4 |
| `american-crew-fiber` | — | [] | RG4-1 |
| `american-crew-pomade` | — | [] | RG4-1 |
| `balea-finishing-spray-glow-und-care` | frizz_control | frizz_control, sleek | RG4-17 |
| `balea-men-pomade-haar-bart-2in1` | definition | [] | RG4-17 |
| `balea-sea-salt-texture-spray` | definition | [] | RG4-17 |
| `bali-curls-sleek-stick-brows-and-edges` | frizz_control, hold_fix | hold_fix | RG4-17 |
| `bali-curls-volumizing-curl-spray-refreshing` | volume | texture, volume | RG4-17 |
| `got2b-styling-mattpaste-strand-matte` | [] | texture | RG4-17 |
| `got2b-styling-paste-istyler-texture-clay` | hold_fix | texture | RG4-9 |
| `kms-thermashape-2-in-1-spray` | definition | definition, hold_fix | RG4-17 |
| `langhaarmaedchen-lockenspray-halt-sprungkraft` | — | hold_fix, volume | RG4-1 |
| `loreal-paris-elnett-haarspray-extra-starker-halt` | volume | [] | RG4-17 |
| `loreal-paris-elnett-stylingspray-hitzeschutz-3-tage-glatt` | frizz_control, shine | frizz_control | RG4-10 |
| `schwarzkopf-taft-gel-wax-glanz-halt-2` | [] | shine | RG4-9 |

**ingredient_flags disagreements (supplementary)**

| Product | A | B | Root cause |
|---|---|---|---|
| `american-crew-fiber` | — | {silicones:false,oils:false,fragrance:true,salt:false,propellant:false,fixative_family:[pvp_vp]} | RG4-1 |
| `american-crew-pomade` | — | {silicones:false,oils:true,fragrance:true,salt:false,propellant:false,fixative_family:[pvp_vp]} | RG4-1 |
| `balea-locken-revitalizing-spray` | {silicones:false,oils:true,fragrance:true,salt:false,propellant:true,fixative_family:[]} | {silicones:false,oils:true,fragrance:true,salt:null,propellant:true,fixative_family:[]} | RG4-15 |
| `balea-men-styling-powder` | {silicones:false,oils:false,fragrance:true,salt:false,propellant:false,fixative_family:[]} | {silicones:false,oils:false,fragrance:true,salt:false,propellant:false,fixative_family:[natural_film]} | RG4-27 |
| `bali-curls-strong-hold-flaxseed-gel` | {silicones:false,oils:false,fragrance:true,salt:true,propellant:false,fixative_family:[]} | {silicones:false,oils:false,fragrance:true,salt:true,propellant:false,fixative_family:[natural_film]} | RG4-27 |
| `bali-gents-matt-paste` | {silicones:false,oils:true,fragrance:true,salt:true,propellant:false,fixative_family:[]} | {silicones:false,oils:true,fragrance:true,salt:true,propellant:false,fixative_family:[natural_film]} | RG4-27 |
| `langhaarmaedchen-lockenspray-halt-sprungkraft` | — | {silicones:false,oils:false,fragrance:true,salt:false,propellant:false,fixative_family:[natural_film]} | RG4-1 |
| `redken-wax-spray` | {silicones:false,oils:true,fragrance:true,salt:false,propellant:true,fixative_family:[vinyl_acetate]} | {silicones:false,oils:false,fragrance:true,salt:false,propellant:true,fixative_family:[vinyl_acetate]} | E4-5 |
| `schwarzkopf-taft-schaumfestiger-volumen-halt-4-feines-haar` | {silicones:false,oils:false,fragrance:true,salt:true,propellant:true,fixative_family:[]} | {silicones:false,oils:false,fragrance:true,salt:true,propellant:true,fixative_family:[natural_film]} | RG4-27 |

### T6. Round 3 → round 4 on the same 143 products

Round-3 core disagreements: 138 on 48 records. Gone in round 4: 133 (on 46 records); persisting: 5; new: 75 (on 18 records). secondary_jobs: gone 16, persisting 5, new 10.

| Persisting (core) | Field | Round-3 cause | Round-4 A | Round-4 B | Round-4 cause |
|---|---|---|---|---|---|
| `guhl-foehn-spray-langzeit-volumen` | heat_activated | E3-4 | no | yes | E4-2 |
| `john-frieda-volume-lift-ansatz-booster` | promise_class | E3-1 | not_assigned | styling_result | E4-1 |
| `kevin-murphy-powder-puff-volume` | promise_class | E3-1 | not_assigned | styling_result | E4-1 |
| `kms-thermashape-2-in-1-spray` | heat_activated | E3-4 | no | yes | E4-2 |
| `moroccanoil-textur-und-volumenpuder` | tail_markers | E3-2 | T_S parfum r5 plausible; T_LI sodium benzoate r7 plausible | T_S parfum r5 plausible; T_LI sodium benzoate r7 vacuous | E4-3 |

| Gone: round-3 cause | Cells |
|---|---|
| E3-1 | 37 |
| E3-10 | 1 |
| E3-2 | 5 |
| E3-3 | 1 |
| E3-5 | 1 |
| E3-6 | 2 |
| E3-7 | 5 |
| E3-8 | 1 |
| E3-9 | 1 |
| P3-2 | 3 |
| P3-3 | 19 |
| RG3-1 | 9 |
| RG3-10 | 2 |
| RG3-11 | 1 |
| RG3-12 | 2 |
| RG3-13 | 2 |
| RG3-14 | 1 |
| RG3-2 | 17 |
| RG3-3 | 7 |
| RG3-4 | 3 |
| RG3-5 | 2 |
| RG3-6 | 6 |
| RG3-7 | 3 |
| RG3-8 | 1 |
| RG3-9 | 1 |

| New: round-4 cause | Cells |
|---|---|
| E4-1 | 2 |
| E4-2 | 1 |
| E4-4 | 1 |
| RG4-1 | 55 |
| RG4-10 | 1 |
| RG4-18 | 1 |
| RG4-19 | 1 |
| RG4-2 | 2 |
| RG4-20 | 2 |
| RG4-26 | 1 |
| RG4-3 | 3 |
| RG4-4 | 1 |
| RG4-9 | 4 |

**State changes round 3 → round 4 (either lane), 22 products** (agreed states: round 3 132/143, round 4 136/143):

| Product | A r3 → r4 | B r3 → r4 |
|---|---|---|
| `alverde-beach-waves-spray-seaside-balance` | committed/salt_spray → held/salt_spray | committed/salt_spray → held/salt_spray |
| `american-crew-fiber` | blocked:evidence_gate → blocked:evidence_gate | blocked:evidence_gate → committed/molding |
| `american-crew-pomade` | blocked:evidence_gate → blocked:evidence_gate | blocked:evidence_gate → committed/molding |
| `aussie-leave-in-creme-work-that-curl` | route:leave_in → blocked:mixed_promise | route:leave_in → route:leave_in |
| `bali-curls-volumizing-curl-spray-refreshing` | committed/salt_spray → held/refresher | held/refresher → held/refresher |
| `cantu-shea-butter-extra-hold-edge-stay-gel` | blocked:formula_conflict → blocked:formula_conflict | blocked:evidence_gate → blocked:formula_conflict |
| `guhl-locken-pflege-und-styling-3in1` | blocked:mixed_promise → blocked:mixed_promise | blocked:owner_ruled_care_current_category → blocked:mixed_promise |
| `hask-lockencreme-curl-care` | route:leave_in → route:leave_in | route:leave_in → blocked:mixed_promise |
| `john-frieda-frizz-ease-zauberformel-seiden-finish-creme` | committed/shine_finish → committed/shine_finish | blocked:evidence_gate → committed/shine_finish |
| `john-frieda-volume-lift-ansatz-booster` | blocked:formula_conflict → blocked:formula_conflict | committed/blowdry_lotion → blocked:formula_conflict |
| `kerastase-curl-manifesto-refresh-absolu` | blocked:evidence_gate → blocked:evidence_gate | blocked:evidence_gate → route:leave_in |
| `kevin-murphy-powder-puff-volume` | blocked:formula_conflict → blocked:formula_conflict | committed/hair_powder → blocked:formula_conflict |
| `kms-thermashape-straightening-creme` | route:leave_in → held/smoothing_styler | blocked:li_g0_provisional → held/smoothing_styler |
| `langhaarmaedchen-lockenspray-halt-sprungkraft` | blocked:evidence_gate → blocked:evidence_gate | blocked:evidence_gate → held/gel |
| `loreal-paris-elnett-stylingspray-hitzeschutz-3-tage-glatt` | blocked:evidence_gate → held/smoothing_styler | blocked:evidence_gate → held/smoothing_styler |
| `redken-wax-spray` | committed/molding → committed/texture_spray | committed/texture_spray → committed/texture_spray |
| `schwarzkopf-taft-gel-wax-glanz-halt-2` | committed/molding → committed/shine_finish | committed/molding → committed/molding |
| `schwarzkopf-taft-texturspray-aloe-boost` | committed/texture_spray → committed/texture_spray | blocked:mixed_promise → committed/texture_spray |
| `syoss-glaze-topcoat` | committed/shine_finish → blocked:mixed_promise | committed/shine_finish → blocked:mixed_promise |
| `syoss-hitzeschutzspray-keratin-heat` | blocked:li_g0_provisional → route:heat_protectant | route:heat_protectant → route:heat_protectant |
| `wella-eimi-smooth-thermal-image` | blocked:mixed_promise → route:heat_protectant | route:heat_protectant → route:heat_protectant |
| `wella-professionals-eimi-flowing-form` | blocked:li_g0_provisional → held/smoothing_styler | blocked:li_g0_provisional → held/smoothing_styler |

### T7. Did each round-3 ruling / fix reach its products? (both lanes' round-4 values vs the ruled outcome)

Owner rulings: 24/24 product checks reached in both lanes; RG3 fixes and E3 lane errors: 34/37.

| Ruling | Product | Ruled | A | B | Effect |
|---|---|---|---|---|---|
| R3-Q1 | `kms-thermashape-2-in-1-spray` | route styling; subtype smoothing_styler | ✓; ✓ | ✓; ✓ | both |
| R3-Q1 | `color-wow-dream-coat-supernatural-spray` | reason_code pending_leave_in_addendum; subtype smoothing_styler | ✓; ✓ | ✓; ✓ | both |
| R3-Q1 | `loreal-paris-elnett-stylingspray-hitzeschutz-3-tage-glatt` | reason_code pending_leave_in_addendum; subtype smoothing_styler | ✓; ✓ | ✓; ✓ | both |
| R3-Q2 | `syoss-hitzeschutzspray-keratin-heat` | route heat_protectant; reason_code 3.3 | ✓; ✓ | ✓; ✓ | both |
| R3-Q2 | `loreal-elvital-haaroel-oel-magique-alle-haartypen` | route oil; reason_code 3.1 | ✓; ✓ | ✓; ✓ | both |
| R3-Q2 | `john-frieda-haarserum-frizz-ease-der-baendiger` | route oil; reason_code 3.1 | ✓; ✓ | ✓; ✓ | both |
| R3-Q2 | `garnier-fructis-sleek-and-stay-heat-activated-serum` | route oil; reason_code 3.1 | ✓; ✓ | ✓; ✓ | both |
| R3-Q2 | `taft-x-gliss-hitzeschutzspray-lovely-long` | route heat_protectant; promise_class heat_protection | ✓; ✓ | ✓; ✓ | both |
| R3-Q2 | `got2b-hitzeschutzspray-schutzengel` | route heat_protectant | ✓ | ✓ | both |
| R3-H4(d) | `feschi-smooth-and-shine-anti-frizz-spray-glanzspray` | reason_code evidence_gate | ✓ | ✓ | both |
| R3-H4(d) | `bumble-and-bumble-surf-spray` | reason_code evidence_gate | ✓ | ✓ | both |
| R3-Q3 | `schwarzkopf-taft-texturspray-aloe-boost` | route styling; promise_class styling_result; subtype texture_spray; reason_code 3.5 | ✓; ✓; ✓; ✓ | ✓; ✓; ✓; ✓ | both |
| R3-Q4 | `kms-thermashape-straightening-creme` | route provisional_boundary; reason_code pending_leave_in_addendum; subtype smoothing_styler | ✓; ✓; ✓ | ✓; ✓; ✓ | both |
| R3-H | `bali-curls-strong-hold-flaxseed-gel` | hold_level 4 | ✓ | ✓ | both |
| R3-H2 | `wella-professionals-eimi-flowing-form` | reason_code pending_leave_in_addendum; subtype smoothing_styler | ✓; ✓ | ✓; ✓ | both |
| R3-H3 | `loreal-paris-elnett-stylingspray-hitzeschutz-3-tage-glatt` | route provisional_boundary; reason_code pending_leave_in_addendum; hold_level 3; d8b_flags claim_formula_conflict | ✓; ✓; ✓; ✓ | ✓; ✓; ✓; ✓ | both |
| R3-H4(a) | `schwarzkopf-taft-styling-balm-locken-halt-3` | hold_level 2 | ✓ | ✓ | both |
| R3-H4(a) | `alcina-styling-mousse-aerosol` | hold_level 2 | ✓ | ✓ | both |
| R3-H4(f) | `bumble-and-bumble-brilliantine` | route styling; subtype shine_finish; reason_code 4.6_owner_named | ✓; ✓; ✓ | ✓; ✓; ✓ | both |
| R3-H5 | `wella-eimi-texture-ocean-spritz` | hold_level 1 | ✓ | ✓ | both |
| R3-H5 | `wella-eimi-sugar-lift` | hold_level 3 | ✓ | ✓ | both |
| R3-H5 | `wella-eimi-glam-mist-shine-spray` | hold_level 1 | ✓ | ✓ | both |
| R3-H5 | `wella-professionals-eimi-flowing-form` | hold_level 1 | ✓ | ✓ | both |
| R3-H5 | `wella-eimi-nutricurls-curl-shaper` | hold_level 1 | ✓ | ✓ | both |
| RG3-1 | `bali-curls-volumizing-curl-spray-refreshing` | reason_code pending_leave_in_addendum; subtype refresher | ✓; ✓ | ✓; ✓ | both |
| RG3-1 | `wellaflex-schaumfestiger-locken-und-wellen-starker-halt` | reason_code 3.4(iii)_excluded_styling_first; primary_job definition | ✓; ✓ | ✓; ✓ | both |
| RG3-1 | `kevin-murphy-killer-curls` | reason_code pending_leave_in_addendum; subtype curl_cream; primary_job hold_fix | ✓; ✓; ✓ | ✓; ✓; ✓ | both |
| RG3-1 | `jean-und-len-sea-salt-spray` | primary_job texture; subtype salt_spray | ✓; ✓ | ✓; ✓ | both |
| RG3-1/RG3-18 | `redken-wax-spray` | primary_job texture; subtype texture_spray | ✓; ✓ | ✓; ✓ | both |
| RG3-4 | `wella-eimi-smooth-thermal-image` | route heat_protectant | ✓ | ✓ | both |
| RG3-6 | `schwarzkopf-taft-foehn-spray-volumen-halt-3` | tli_status none_visible | ✓ | ✓ | both |
| RG3-7 | `got2b-styling-paste-istyler-texture-clay` | application_moment dry_restyle | ✓ | ✓ | both |
| RG3-7 | `osis-dust-it` | application_moment dry_restyle | ✓ | ✓ | both |
| RG3-7 | `syoss-professional-performance-max-hold-power-wax` | application_moment dry_restyle | ✓ | ✓ | both |
| RG3-9 | `kms-thermashape-2-in-1-spray` | hold_level 4 | ✓ | ✓ | both |
| RG3-10 | `taft-styling-paste-forming-halt-5plus` | hold_level 4 | ✓ | ✓ | both |
| RG3-11 | `osis-sparkler` | d8b_flags [] | ✓ | ✓ | both |
| RG3-12 | `maria-nila-curlicue-cream` | promise_class styling_result | ✓ | ✓ | both |
| RG3-12 | `wella-eimi-nutricurls-curl-shaper` | promise_class mixed; reason_code pending_leave_in_addendum; subtype curl_cream | ✓; ✓; ✓ | ✓; ✓; ✓ | both |
| RG3-13 | `guhl-locken-pflege-und-styling-3in1` | route provisional_boundary; reason_code mixed_promise; promise_class mixed | ✓; ✓; ✓ | ✓; ✓; ✓ | both |
| RG3-14 | `maria-nila-curlicue-cream` | reason_code 3.4(iii)_excluded_styling_first | ✓ | ✓ | both |
| RG3-15 | `john-frieda-frizz-ease-zauberformel-seiden-finish-creme` | route styling; subtype shine_finish | ✓; ✓ | ✓; ✓ | both |
| RG3-18 | `moroccanoil-volumizing-spray` | subtype blowdry_lotion | ✓ | ✓ | both |
| RG3-18 | `wella-eimi-sugar-lift` | subtype blowdry_lotion | ✓ | ✓ | both |
| RG3-20 | `osis-dust-it` | target_zone all | ✓ | ✓ | both |
| RG3-23 | `balea-styling-creme-power-flex` | hold_level — | ✓ | ✓ | both |
| E3-1 | `john-frieda-volume-lift-ansatz-booster` | identity_status inci_conflict; reason_code formula_conflict | ✓; ✓ | ✓; ✓ | both |
| E3-1 | `kevin-murphy-powder-puff-volume` | identity_status inci_conflict; reason_code formula_conflict | ✓; ✓ | ✓; ✓ | both |
| E3-1 | `cantu-shea-butter-extra-hold-edge-stay-gel` | identity_status inci_conflict; reason_code formula_conflict | ✓; ✓ | ✓; ✓ | both |
| E3-2 | `moroccanoil-textur-und-volumenpuder` | tli_status vacuous | plausible | ✓ | **lane B only** |
| E3-2 | `alcina-styling-mousse-aerosol` | tli_status vacuous | ✓ | ✓ | both |
| E3-3 | `loreal-paris-elvital-big-hair-day-erfrischendes-volumenspray` | ts_inci dimethyl phenethyl acetate | ✓ | ✓ | both |
| E3-4 | `guhl-foehn-spray-langzeit-volumen` | heat_activated no | ✓ | yes | **lane A only** |
| E3-4 | `kms-thermashape-2-in-1-spray` | heat_activated no | ✓ | yes | **lane A only** |
| E3-5 | `balea-leave-in-spray-sea-salt-care-define` | promise_class mixed; reason_code pending_leave_in_addendum | ✓; ✓ | ✓; ✓ | both |
| E3-6 | `kevin-murphy-killer-curls` | weight rich; buildup_note fires | ✓; ✓ | ✓; ✓ | both |
| E3-7 | `bumble-and-bumble-brilliantine` | promise_class not_assigned; primary_job — | ✓; ✓ | ✓; ✓ | both |
| E3-7 | `color-wow-dream-coat-supernatural-spray` | promise_class not_assigned; primary_job — | ✓; ✓ | ✓; ✓ | both |
| E3-8 | `syoss-curl-cream-gel-3in1` | reason_code 3.4(iii)_excluded_styling_first | ✓ | ✓ | both |
| E3-9 | `balea-haargel-hair-jelly` | primary_job hold_fix | ✓ | ✓ | both |
| E3-10 | `balea-professional-glow-und-shine-finishing-spray` | primary_job shine | ✓ | ✓ | both |

### T8. Hold levels — every product where either lane emits one (46/46 identical)

| Product | Subtype | A | B | Same |
|---|---|---|---|---|
| ALCINA Ansatz Volumen Spray Aerosol (`alcina-ansatz-volumen-spray-aerosol`) | blowdry_lotion | 3 | 3 | yes |
| ALCINA Föhn Lotion (`alcina-foehn-lotion`) | blowdry_lotion | 1 | 1 | yes |
| ALCINA Styling Mousse Aerosol (`alcina-styling-mousse-aerosol`) | mousse | 2 | 2 | yes |
| Balea Haarpuder Volumen (Pomegranate) (`balea-haarpuder-volumen-pomegranate`) | hair_powder | 3 | 3 | yes |
| Balea MEN Pomade Haar & Bart 2in1 (`balea-men-pomade-haar-bart-2in1`) | molding | 2 | 2 | yes |
| Balea MEN Styling Powder (`balea-men-styling-powder`) | hair_powder | 3 | 3 | yes |
| Balea PROFESSIONAL Styling Cream Traumlocken (`balea-professional-styling-cream-traumlocken`) | curl_cream | 2 | 2 | yes |
| Balea Styling Spray Volumenpuder Pure Styling (`balea-pure-styling-volumenpuder-spray`) | texture_spray | 1 | 1 | yes |
| Balea Fixierungsbürste Styling Finishing Stick (`balea-styling-finishing-stick`) | shine_finish | 1 | 1 | yes |
| Balea Styling Spray Ultra Volumen (`balea-styling-spray-ultra-volumen`) | blowdry_lotion | 4 | 4 | yes |
| Bali Curls Sleek Stick Brows & Edges (`bali-curls-sleek-stick-brows-and-edges`) | gel | 3 | 3 | yes |
| BALI CURLS Haargel Strong Hold Flaxseed (`bali-curls-strong-hold-flaxseed-gel`) | gel | 4 | 4 | yes |
| BALI GENTS Matt Paste (`bali-gents-matt-paste`) | molding | 3 | 3 | yes |
| Gard Haarspray extrastark (Pumpspray, ohne Treibgas) (`gard-haarspray-extrastark-pumpspray`) | hairspray | 4 | 4 | yes |
| got2b Kleber 4 Brows & Edges 2in1 Stylinggel (`got2b-kleber-4-brows-and-edges-2in1-stylinggel`) | gel | 3 | 3 | yes |
| got2b SPRÜH KLEBER Freeze Haarlack (`got2b-spruehkleber-freeze-haarlack`) | hairspray | 4 | 4 | yes |
| got2b (Schwarzkopf) Styling Mattpaste Strand Matte (`got2b-styling-mattpaste-strand-matte`) | molding | 2 | 2 | yes |
| got2b (Schwarzkopf) Styling Paste iStyler Texture Clay (`got2b-styling-paste-istyler-texture-clay`) | molding | 4 | 4 | yes |
| Kevin.Murphy Killer.Curls (Leave-in Anti-Frizz Creme) (`kevin-murphy-killer-curls`) | curl_cream | 3 | 3 | yes |
| KMS Thermashape 2-in-1 Spray (`kms-thermashape-2-in-1-spray`) | smoothing_styler | 4 | 4 | yes |
| L'ORÉAL PARiS Elnett Haarspray Extra Starker Halt (`loreal-paris-elnett-haarspray-extra-starker-halt`) | hairspray | 4 | 4 | yes |
| L'ORÉAL PARiS Elnett Stylingspray Hitzeschutz 3 Tage Glatt (`loreal-paris-elnett-stylingspray-hitzeschutz-3-tage-glatt`) | smoothing_styler | 3 | 3 | yes |
| Maria Nila Curlicue Cream (Stylingcreme) (`maria-nila-curlicue-cream`) | curl_cream | 2 | 2 | yes |
| NIVEA MEN Styling Cream Active (`nivea-men-styling-cream-active-craft-stylers`) | molding | 3 | 3 | yes |
| Schwarzkopf Professional OSiS Dust It (`osis-dust-it`) | hair_powder | 3 | 3 | yes |
| Schwarzkopf Professional OSiS Sparkler (`osis-sparkler`) | shine_finish | 0 | 0 | yes |
| Redken Wax Spray (Redken Spray Wax) (`redken-wax-spray`) | texture_spray | 2 | 2 | yes |
| Schwarzkopf taft Föhn-Spray VOLUMEN Halt 3 (`schwarzkopf-taft-foehn-spray-volumen-halt-3`) | blowdry_lotion | 2 | 2 | yes |
| Schwarzkopf Taft Gel Wax Glanz (Strahlender Glanz) (`schwarzkopf-taft-gel-wax-glanz-halt-2`) | shine_finish | 1 | 1 | yes |
| Schwarzkopf taft Haarspray CLASSIC Halt 3 (`schwarzkopf-taft-haarspray-classic-halt-3`) | hairspray | 2 | 2 | yes |
| Schwarzkopf taft Haarspray GLANZ Halt 4 (`schwarzkopf-taft-haarspray-glanz-halt-4`) | hairspray | 3 | 3 | yes |
| Schwarzkopf taft Haarspray POWER Halt 5 (`schwarzkopf-taft-haarspray-power-halt-5`) | hairspray | 4 | 4 | yes |
| Schwarzkopf Taft Haargel MATT WAX Halt 5 (`schwarzkopf-taft-matt-wax-halt-5`) | molding | 4 | 4 | yes |
| Schwarzkopf taft Haargel POWER Halt 5 (`schwarzkopf-taft-power-haargel-halt-5`) | gel | 4 | 4 | yes |
| Schwarzkopf taft Schaumfestiger Volumen Halt 4, für feines Haar (`schwarzkopf-taft-schaumfestiger-volumen-halt-4-feines-haar`) | mousse | 3 | 3 | yes |
| Schwarzkopf taft Styling Balm LOCKEN Halt 3 (`schwarzkopf-taft-styling-balm-locken-halt-3`) | curl_cream | 2 | 2 | yes |
| syoss Haarspray Max Hold (`syoss-haarspray-max-hold`) | hairspray | 4 | 4 | yes |
| Syoss Max Hold Wax (`syoss-professional-performance-max-hold-power-wax`) | molding | 4 | 4 | yes |
| Syoss Schaumfestiger Volume (`syoss-schaumfestiger-volume`) | mousse | 3 | 3 | yes |
| Schwarzkopf taft FORMING STYLING PASTE (`taft-styling-paste-forming-halt-5plus`) | molding | 4 | 4 | yes |
| Wella Professionals EIMI Glam Mist Shinespray (`wella-eimi-glam-mist-shine-spray`) | shine_finish | 1 | 1 | yes |
| Wella Professionals EIMI Nutricurls Curl Shaper (Defining Gel Cream) (`wella-eimi-nutricurls-curl-shaper`) | curl_cream | 1 | 1 | yes |
| Wella Professionals EIMI Volume Sugar Lift Volumenspray (`wella-eimi-sugar-lift`) | blowdry_lotion | 3 | 3 | yes |
| Wella Professionals EIMI Texture Ocean Spritz (Texturizing Salt Spray) (`wella-eimi-texture-ocean-spritz`) | salt_spray | 1 | 1 | yes |
| Wella Professionals EIMI Flowing Form (Smooth Flowing Form) Glättungscreme / Anti-Frizz Smoothing Balm (`wella-professionals-eimi-flowing-form`) | smoothing_styler | 1 | 1 | yes |
| wellaflex Schaumfestiger Locken & Wellen, Starker Halt (`wellaflex-schaumfestiger-locken-und-wellen-starker-halt`) | mousse | 2 | 2 | yes |

Round-3 hold mismatches now:

| Product | Round 3 A / B | Round 4 A / B | Resolved |
|---|---|---|---|
| `bali-curls-strong-hold-flaxseed-gel` | review / 4 | 4 / 4 | yes |
| `kevin-murphy-powder-puff-volume` | — / 1 | — / — | yes |
| `kms-thermashape-2-in-1-spray` | 4 / — | 4 / 4 | yes |
| `taft-styling-paste-forming-halt-5plus` | 4 / — | 4 / 4 | yes |
| `wella-eimi-glam-mist-shine-spray` | 1 / — | 1 / 1 | yes |
| `wella-eimi-sugar-lift` | 3 / — | 3 / 3 | yes |

### T9. Coverage per subtype (A and B agree on state and subtype)

| Subtype | Committed | Held | Total | Round 3 total | ≥ 5 committed | ≥ 5 incl. held | Disputed |
|---|---|---|---|---|---|---|---|
| gel | 7 | 2 | 9 | 9 | yes | yes | langhaarmaedchen-lockenspray-halt-sprungkraft |
| curl_cream | 1 | 5 | 6 | 6 | **no** | yes | — |
| mousse | 5 | 0 | 5 | 5 | yes | yes | — |
| blowdry_lotion | 9 | 0 | 9 | 9 | yes | yes | — |
| smoothing_styler | 1 | 4 | 5 | 2 | **no** | yes | — |
| hairspray | 7 | 0 | 7 | 7 | yes | yes | — |
| shine_finish | 9 | 0 | 9 | 9 | yes | yes | schwarzkopf-taft-gel-wax-glanz-halt-2 |
| salt_spray | 4 | 2 | 6 | 6 | **no** | yes | — |
| texture_spray | 6 | 0 | 6 | 4 | yes | yes | — |
| hair_powder | 8 | 0 | 8 | 8 | yes | yes | — |
| molding | 11 | 0 | 11 | 12 | yes | yes | american-crew-fiber, american-crew-pomade, schwarzkopf-taft-gel-wax-glanz-halt-2 |
| refresher | 1 | 5 | 6 | 5 | **no** | yes | — |

### T10. Lock criteria (§14.1), computed

| Criterion | Met | Numbers |
|---|---|---|
| (a) Every subtype ≥ 5 products (agreed; committed + held, held reported separately); smoothing_styler may lock below 5 (R3-Q1) | yes | 12/12 subtypes reach 5 incl. held; 8/12 reach 5 committed; short incl. held: none; smoothing_styler 1 committed + 4 held (R3-Q1 exception not needed incl. held) |
| (b-1) R3-L: every remaining A/B disagreement resolved — a proven lane error, or the rule gap behind it closed | **no** | 80 core-field disagreements on 23 records (5 route): 9 lane errors (resolved), 71 open behind 10 register items (RG4-1, RG4-10, RG4-18, RG4-19, RG4-2, RG4-20, RG4-26, RG4-3, RG4-4, RG4-9); unclassified 0 |
| (b-2) R3-L: the confirmation round shows only lane errors and no new rule gaps | **no** | 27 register items were raised in round 4 (rule gaps or ambiguities, none a lane error); 15 of them cause a disagreement now or need an owner decision (RG4-1, RG4-2, RG4-3, RG4-4, RG4-5, RG4-6, RG4-9, RG4-10, RG4-15, RG4-17, RG4-18, RG4-19, RG4-20, RG4-26, RG4-27); 12 are wording fixes on outputs both lanes already agree on; plus 4 packet issues |
| (c) Hold levels: every mismatch between the two claim normalisations resolved (R3-H4 (c)) | yes | 46/46 identical (round 3: 38/44); all 6 round-3 mismatches resolved: true |
| (d) ≥ 6 unseen products incl. ≥ 2 traps (met in round 2) | yes | not re-tested (0 unseen slots in r4/cohort.json); read from round-3/diff.json: met=true |
| (e) Leave-in addendum drafted and queued for right after lock, carrying D6, D7 and R3-Q4 | yes | queued draft: docs/research/leave-in-inci/v1.2/DRAFT-styling-border-addendum.md |

### T11. Findings register (RG4), impact-triaged

| ID | Impact | Kind | Products | Disagreement now | Reported by | Issue | Proposed fix |
|---|---|---|---|---|---|---|---|
| RG4-1 | I-1 | owner | 6: American Crew FIBER; American Crew Styling Pomade; Kérastase CURL MANIFESTO REFRESH ABSOLU Second day curl refreshing spray; LANGHAARMÄDCHEN LOCKENHALT SPRAY Halt & Sprungkraft; Redken BEACH SPRAY BEACHY TEXTURE SPRAY; Living Proof Full Dry Volume & Texture Spray | yes (61 cells) | A1, A2 | New in round 4: the r7 pack-name capture turned retailer titles into C1/C2 names, so five products now have a C1/C2 name but no C1/C2 promise line. §4.1 asks for „a C1/C2 primary promise" and does not say whether a C1/C2 name can be it. Lane A: no (gate fails). Lane B: yes (the name supplies the promise). Sub-question: can a C3 retailer-title type noun (R3-Q2) meet input 1 (Living Proof)? Both lanes: no. | §4.1 input 1: „a C1/C2 promise line, or a C1/C2 confirmed name whose job words name exactly one job (§4.2 step 1). A name with several job words, or none, does not meet it; a C3 retailer-title type noun (R3-Q2) never meets it. With no C1/C2 claim line the claim-keyed fields take their no-claim values + claim_authority_gap." |
| RG4-2 | I-1 | mechanical | 3: HASK curls defining cream; cantu SHEA BUTTER COCONUT CURLING CREAM; BALI CURLS HYDRATING CURL CREAM | yes (2 cells) | A5 | Blind packets carry opaque ids, and the round-4 freeze renamed 24 products to their pack names (P3-7), so a lane can only match a registry row by brand + product. HASK is now „curls defining cream"; the row still reads „HASK Curl Care". Lane A matched it (leave_in, override 4.1 (c)); lane B did not (mixed_promise ⇒ review). Cantu Kokos and Bali Hydrating were matched by both. | Every registry row also names the brand and the round-4 confirmed name (and GTIN); the S0 packet of a registry product carries an opaque `registry_row` pointer, so matching never depends on an old shop title. HASK row ⇒ „HASK curls defining cream". |
| RG4-3 | I-1 | owner | 4: AUSSIE WORK THAT CURL LEAVE-IN CREAM; Redken One United All-in-One Multi-Benefit Treatment; Wella Professionals EIMI Nutricurls Fresh Up; Wella Professionals EIMI Smooth Perfect Me (Balsam-Lotion) | yes (3 cells) | A13 | The care-word list is closed by example only. Aussie C1 „5 days of curl definition … and strong hair*": lane A reads „strong hair" as a strengthen/repair care job ⇒ care + definition ⇒ mixed ⇒ review; lane B reads it as a result phrase ⇒ leave_in. Also unsettled (both lanes agree today): „Treatment" in a name (Redken One United — without it the lead becomes heat protection, which the registry cannot override), the line prefix „Nutri-" (Wella Nutricurls), „Balsam-Lotion" in a name (Wella Smooth Perfect Me). | Care half = a care verb or care noun that states a job: pflegt/Pflege/Care, Kur, Balsam, Treatment, spendet Feuchtigkeit/moisturises, nährt/nourishes, repariert/repairs, stärkt/strengthens (as a verb), entwirrt/detangles. Not the care half: a result phrase describing the hair („strong hair", „gesunde Locken", like „gepflegte Locken" under R2-Q1) and a product-line prefix („Nutri-"). |
| RG4-4 | I-1 | owner | 4: alverde NATURKOSMETIK Beach Waves Spray Seaside Balance; Syoss Glaze Topcoat; L'ORÉAL PARiS ELVITAL Volumenspray Big Hair Day (Erfrischendes Volumen Spray); John Frieda Frizz Ease Unendlich Smooth Salon Blow-Out Spray | yes (2 cells) | A15, B5 | Look names the job-word list does not place. „Beach Waves": RG3-1 makes a wave noun a curl job word (definition, li_function yes ⇒ Leave-in check ⇒ D6 ⇒ held), while §5 files beach waves under salt_spray texture. Both lanes hold alverde Beach Waves; lane A gives primary definition, lane B texture. „Glaze"/„Topcoat" (Syoss Glaze Topcoat): if a shine job noun, R3-Q3 makes the one-job name win ⇒ committed shine_finish; both lanes read no job ⇒ mixed ⇒ review. „Big Hair Day" and „Salon Blow-Out" are slogans; both lanes skip them (Elvital ⇒ dry_shampoo; JF ⇒ leave_in). | „Beach Waves / Strandwellen / beachy" names the salt-spray texture look ⇒ texture, li_function no (RG3-1's wave nouns cover curl/wave definition products — Wellen-Spray, Wellenauffrischer — not beach-look names). „Glaze", „Topcoat", „Gloss" are shine job nouns (R2-Q3 list). Slogans („Big Hair Day", „Salon Blow-Out") name no job ⇒ skipped (RG2-17). |
| RG4-5 | I-1 | owner | 3: BALI CURLS Haargel Strong Hold Flaxseed; Kevin.Murphy Killer.Curls (Leave-in Anti-Frizz Creme); John Frieda Lockencreme Traumlocken (Frizz Ease Traumlocken Definierende Locken-Creme) | no | A7, A8, A9, B2 | Three products the registry holds (not recommendable until the Leave-in addendum) where the v0.4 letter now says otherwise. Bali Flaxseed: one-job hold name ⇒ li_function no ⇒ 3.4 (ii) ⇒ committed gel, but the registry and §11.19 say D6, held. Killer.Curls: by RG3-19 the hold lead gives li_function no ⇒ 3.4 (ii) ⇒ committed; §4.2 also lets the name („Curls") set it ⇒ D7 ⇒ held. JF Lockencreme Traumlocken: its 4.1 (a) override basis is gone (a C1 line is now captured) and the remaining failure (FX-2c, uncorroborated acrylates) is a formula limb no ruling overrides ⇒ li_g0_provisional by the letter. Both lanes emit the registry outcome (held) on all three. | Keep the three held and say why: a registry D6/D7 row rules the route itself for the record it names (a fourth §4.1 override case, „(d) a named D6/D7 border route where the v0.4 letter differs"), until the Leave-in addendum releases or re-rules them; li_function reads the lead promise only (RG3-19; delete „or confirmed name" from §4.2 except where the name is the step-1 lead). |
| RG4-6 | I-1 | owner | 1: Balea Glattspray Anti-Frizz | no | A17 | A fixative-led smoothing spray with thin conditioning is reached by neither the D7 straightening limb (needs substantive conditioning) nor 3.4 (ii) (smoothing is a Leave-in function), so it lands in li_g0_provisional (review) — the gap PH2-1 accepted for Flowing Form before R3-H2. Both lanes: li_g0_provisional. | Extend R3-Q4: a fixative-class polymer above T_S + a smoothing/straightening sale ⇒ Styling smoothing_styler whatever the conditioning reads; held under PH1-16 when the Leave-in letter would claim it (as Flowing Form). |
| RG4-7 | I-1 | mechanical | 3: L'Oréal Men Expert Barber Club Styling Pomade Bart & Haar mit ätherischem Zedernholzöl; Redken Wax Spray (Redken Spray Wax); Schwarzkopf taft (taft x GLISS) Glanz-Spray taft x Gliss Silky Shine | no | A18 | The two §4.5 sentences disagree for an FX-4-only product routed by 3.4 (ii) or 3.5. Both lanes read „not held" (committed). | §4.5: the FX-4 clause applies only to routes where the Leave-in letter runs (3.4 (i)/(iii), owner-named routes); 3.4 (ii) and 3.5 routes are never held. |
| RG4-8 | I-1 | mechanical | 2: Balea Finishing Spray Glow & Care; John Frieda Traumlocken Belebender Wellenauffrischer | no | A11, A12 | Balea „Finishing Spray Glow & Care": a name joining shine and care with „&" — co-equal mixed (R3-Q3 sentence) or a two-job name that decides nothing (R1-H1, then the first C2 line, shine)? Both lanes: committed shine_finish (the R2-Q3 outcome). JF Wellenauffrischer: one-job name (refresh) but the line covers care + definition — R1-Q3 (mixed) or R3-Q3 (name wins)? Both lanes: mixed (R1-Q3 is stated as unchanged). | §4.2: R3-Q3's „names that name both jobs" means names that join care and styling as the product's two jobs („Pflege & Styling 2in1/3in1"); a care word beside a styling product noun („Finishing Spray Glow & Care") is a call-out. R1-Q3 (care + curl definition ⇒ mixed) wins over R3-Q3. |
| RG4-9 | I-2 | owner | 3: Schwarzkopf Taft Gel Wax Glanz (Strahlender Glanz); got2b (Schwarzkopf) Styling Paste iStyler Texture Clay; Balea Styling Glow Wax | yes (6 cells) | A22 | Taft „Gel Wax Glanz": lane A reads „Gel Wax" as a form compound (RG3-1) ⇒ Glanz is the one job ⇒ shine_finish (and D8b rule 1 fires: hold claim on a shine_finish); lane B reads Wax as the job and Glanz as a qualifier (RG2-21) ⇒ molding, primary hold_fix. got2b „Texture Clay": lane A reads Paste/Clay as form nouns ⇒ primary texture; lane B ⇒ two jobs ⇒ the C2 line „… ultra krassem Halt" ⇒ hold_fix. Balea Glow Wax: both hold_fix. | RG2-21 wins: a product noun (Wachs/Wax, Paste, Clay, Gel, Pomade, Fiber) names the job (molding/hold) and a shine or strength qualifier in the name (Glanz, Glow, Strong) is never a second job, also inside a compound; a true job word beside it (Texture, Volume, Curl) makes two jobs ⇒ the lead line decides. |
| RG4-10 | I-2 | mechanical | 1: L'ORÉAL PARiS Elnett Stylingspray Hitzeschutz 3 Tage Glatt | yes (2 cells) | A24, B3 | The r7 re-read C1 pack front begins „Elnett de Luxe \| POWER-SHINE-TECHNOLOGIE \| …". Lane A reads „Shine" as a §6.8 shine word ⇒ finish glänzend + shine secondary; lane B reads a technology label as no claim ⇒ unbekannt. | §6.8/§6.10: a technology, formula or complex label („…-Technologie", „-Formel", „-Komplex") is a call-out, never a finish word or a job (SFS-15 extended from the promise class to finish and jobs). |
| RG4-11 | I-2 | mechanical | 1: Balea PROFESSIONAL Styling Cream Traumlocken | no | A23 | §11.2 gives Balea Traumlocken finish glänzend; with the round-3 C1 line „NATÜRLICHEM GLANZ" RG-10 gives natürlich (both lanes natürlich). | Update §11.2 to natürlich (glänzend + natürlicher Glanz ⇒ natürlich, RG-10) and to the round-4 claim order. |
| RG4-12 | I-2 | mechanical | 2: Balea Fixierungsbürste Styling Finishing Stick; Balea Overnight Wellenspray | no | A25 | „leichte Fixierung" (Balea Finishing Stick) is read as a hold claim by analogy (both lanes level 1); no rule names „Fixierung". „fixiert die Frisur zuverlässig" (Balea Overnight) has no strength word; both lanes add hold_fix as a secondary. | §7.4: „Fixierung" with a strength word reads as „Halt" (leichte Fixierung ⇒ 1). §6.10: a fixing verb without a strength word („fixiert die Frisur") states hold_fix as a secondary job but sets no level. |
| RG4-13 | I-2 | mechanical | 2: Balea Styling Spray Volumenpuder Pure Styling; Redken Root Tease | no | A27 | A powder dispensed as an aerosol spray (texture_spray vs hair_powder), and a „Volumen-Haarspray" with a root-teasing step (hairspray vs texture_spray). Both lanes: texture_spray for both. | §5: form as applied decides — a powder sold as an aerosol spray ⇒ texture_spray; a volume/texture lead with a teasing step ⇒ texture_spray, not hairspray (the hairspray anchor needs a hold lead). |
| RG4-14 | I-2 | mechanical | 3: Balea Fixierungsbürste Styling Finishing Stick; Balea Styling Spray Ultra Volumen; John Frieda Spray Volume Lift Pushed-up Dry Texture | no | A28, A29 | A stick stroked over dry, finished hair with no shaping act; „auf den feuchten Ansatz … bis in die Längen" (range or Ansatz-first?); „vom Ansatz her ins Haar sprühen" (roots or range?). Both lanes agree on each (dry_finish/surface; all; roots). | Add as cases: stroking over dry hair without a shaping act ⇒ dry_finish, flyaways ⇒ surface; „Ansatz … bis in die Längen" is a range ⇒ all (RG2-10); „vom Ansatz her" with no other site ⇒ roots (RG-9). |
| RG4-15 | I-2 | mechanical | 1: Balea Locken Revitalizing Spray | yes (1 cells) | B6 | „CITRONELLOL SODIUM CHLORIDE" (merged token) may hide a salt. §6.6 says it sets flags_incomplete + review but not the salt value: lane A salt false, lane B salt unknown (supplementary field). | §6.6: a token that may hide a flag sets that flag to unknown (never false) + flags_incomplete. |
| RG4-16 | I-3 | mechanical | 2: got2b SPRÜH KLEBER Freeze Haarlack; Schwarzkopf taft Haargel POWER Halt 5 | no | A26, B4 | got2b six-mark display (Henkel x/5 row vs the printed 1–6 row); Taft gel „Haltegrad 5" with max 5 now stated (§7.3 keeps Taft gels words-only). Both lanes 4 on both; every reading gives 4. | §7.3: add „got2b six-mark display ⇒ words decide (the 1–6 row gives the same level)" and „Taft gels: Haltegrad x/5 recorded, words decide". |
| RG4-17 | I-3 | mechanical | 8: Balea Finishing Spray Glow & Care; Balea MEN Pomade Haar & Bart 2in1; Balea Sea Salt Texture Spray; Bali Curls Sleek Stick Brows & Edges; BALI CURLS Volumizing Curl Spray; got2b (Schwarzkopf) Styling Mattpaste Strand Matte; KMS Thermashape 2-in-1 Spray; L'ORÉAL PARiS Elnett Haarspray Extra Starker Halt | yes (8 cells) | A19, A20, A21, B1, B7 | Three open points: (1) does a later qualifying job refill a slot a formula-gate drop frees (lane B: no refill; lane A: refills); (2) claim order follows packet order, which moved between rounds; (3) which claim types state a job — humidity/duration lines with an anti-frizz word, a fixing verb without a strength word, a technology label. | §6.10: take the first two eligible candidates (name job words first, then C1/C2 promise lines in packet order), apply the formula gate, and refill from the next eligible candidate; humidity and duration lines never state a job, an explicit anti-frizz word in them does. |
| RG4-18 | I-3 | mechanical | 1: COLOR WOW Dream Coat Supernatural Spray | yes (1 cells) | A30 | Lane A emits the blind F/U value (no); lane B the post-unblinding value (unresolved, the §6.13 example). Round 3 both lanes wrote unresolved. | §6.13: the record carries the unblinded value; the blind lanes see the claims packet anyway, so they apply the raise themselves (C1/C2 activation ⇒ yes; C3/C5-only ⇒ unresolved). Drop the „blind reads F/U only" sentence. |
| RG4-19 | I-3 | mechanical | 1: Schwarzkopf Professional OSiS+ CURL RETOUCH CURL ENHANCING SPRAY | yes (1 cells) | A31 | Phenoxyethanol r4 sits above Stearamidopropyl Dimethylamine r6 and Behentrimonium Chloride r7: lane A calls T_LI implausible, lane B plausible. Care is real either way (Cetearyl Alcohol r3 above T_LI; the cationics above the yardstick) ⇒ leave_in in both. | A T_LI with cationics below it is plausible; PH1-13 already reads them. „implausible" only when the marker sits above an oil/ester/fatty-alcohol base no rule reads below T_LI. |
| RG4-20 | I-3 | mechanical | 2: NEQI Diamond Glass Styling Spray All; NEQI Diamond Glass Ultimate Styling Spray | yes (2 cells) | A10 | NEQI All: the registry says the letter reads mixed („Styling + Hitzeschutz in einem"); under RG3-4 the lead is the first job sentence of the first C2 line („… glatten Glass Hair-Effekt" ⇒ sleek) ⇒ styling_result ⇒ 3.4 (iii) ⇒ leave_in without an override (lane A); lane B followed the registry text (mixed, override). NEQI Ultimate: registry „same" but §4.1 (c) lists it as an override (both lanes: override). | Update both NEQI rows: All ⇒ letter styling_result ⇒ 3.4 (iii) ⇒ leave_in, reason the letter's pair rule (RG3-14); Ultimate ⇒ the §4.1 (c) override, letter column „mixed". |
| RG4-21 | I-3 | mechanical | 3: John Frieda Volume Lift Ansatz-Booster; Kevin.Murphy Powder.Puff Volume; Cantu Shea Butter for Natural Hair Firm Hold Edge Stay Gel | no | A3, A4, A6 | The packets ship identity_status „inci_conflict", which §2.3 does not list (it names provisional_formula_conflict); Cantu Edge Stay Gel has two blocks (formula conflict + missing directions) but §4.0 allows one boundary_reason; §6.7/§7.6 cohort notes for the Ansatz-Booster describe its inci_alt list. Both lanes: inci_conflict, formula_conflict. | §2.3: add inci_conflict (packet name of the two-list state); §4.0: formula_conflict wins, the other block is listed as a trigger; §6.7/§7.6: re-derive the Ansatz-Booster notes from the list of record. |
| RG4-22 | I-3 | mechanical | 1: HASK curls defining cream | no | A14 | Is a definition word in the confirmed name („curls defining cream") the definition half of an R1-Q3 tie? Both lanes: yes (mixed); the registry decides HASK anyway (RG4-2). | §4.2: state the symmetry — a definition word in the confirmed name is the definition half, as a care word in the name is the care half. |
| RG4-23 | I-3 | mechanical | 4: AUSSIE WORK THAT CURL LEAVE-IN CREAM; HASK curls defining cream; Cantu Shea Butter for Natural Hair Firm Hold Edge Stay Gel; cantu SHEA BUTTER COMEBACK CURL NEXT DAY CURL REVITALIZER | no | A33 | English promise lines printed on the German-market pack carry non_german_wording; nothing says whether they count as C1. Both lanes: C1. | §2.2: text printed on the German-market pack is C1 whatever its language; non_german_wording stays a flag. |
| RG4-24 | I-3 | mechanical | 2: Moroccanoil Volumizing Spray (Volumizing Mist); BALI GENTS Sea Salt Spray | no | A35 | Unplaced species above T_S: Pullulan (a film former), Algin, Trehalose, Xylitylglucoside, Anhydroxylitol, Galactoarabinan, Cinnamidopropyltrimonium Chloride; Ethyl Benzoate. Recorded E1 only; no value moves today. | Lexicon v0.5: place Pullulan (NF-U), Algin (NF-U), Cinnamidopropyltrimonium Chloride (CA), the sugars as humectants, Ethyl Benzoate as FR-2. |
| RG4-25 | I-3 | mechanical | 2: Schwarzkopf taft Haarspray CLASSIC Halt 3; Schwarzkopf taft Haarspray GLANZ Halt 4 | no | A36 | Rule 2 needs a same-brand sibling with an identical INCI, which a blind lane sees only through the pair §7.5 names. Both lanes fire it on the named pair. | §7.5: rule 2 runs in the pipeline across records after the lanes, not per lane. |
| RG4-26 | I-3 | mechanical | 1: Bali Curls Sleek Stick Brows & Edges | yes (1 cells) | diff | „Sleek Stick Brows & Edges": lane A reads sleek as smoothing ⇒ li_function yes ⇒ 3.4 (iii) excluded_styling_first; lane B ⇒ li_function no ⇒ 3.4 (ii). Same route (committed gel) either way. | R1-Q2 extended: sleeking baby hair, edges or brows on dry hair is a styling look ⇒ li_function no ⇒ 3.4 (ii). |
| RG4-27 | I-3 | mechanical | 4: Balea MEN Styling Powder; BALI CURLS Haargel Strong Hold Flaxseed; BALI GENTS Matt Paste; Schwarzkopf taft Schaumfestiger Volumen Halt 4, für feines Haar | yes (4 cells) | diff | Does an unsettled natural film former (NF-U: Carrageenan, unmodified starches, flax extract) put natural_film into fixative_family? NF-1 says IF natural_film; NF-U only says RM natural_film + review. Lane B adds it, lane A does not (supplementary field; result_mechanisms agree). | Lexicon NF-U: „IF fixative_family: natural_film, with natural_film_unsettled" (as NF-1), so the flag follows the mechanism. |

### T12. Lane-reported items → register

| Lane | # | Item | Maps to |
|---|---|---|---|
| A | 1 | Gate input 1 vs confirmed name (Kérastase Curl Refresh, Brilliantine, American Crew Fiber/Pomade, Redken Beach Spray, Langhaarmädchen Halt) | RG4-1 |
| A | 2 | R3-Q2 shop-title fallback vs the gate (Living Proof Full Dry Volume Texture Spray) | RG4-1 |
| A | 3 | `inci_conflict` is not a §2.3 identity state | RG4-21 |
| A | 4 | Two blocks, one boundary_reason (Cantu Edge Stay Gel: formula conflict + missing directions) | RG4-21 |
| A | 5 | Registry rows keyed by sample_id cannot be matched blind | RG4-2 |
| A | 6 | Stale Ansatz-Booster cohort notes (§6.7/§7.6 describe the inci_alt list) | RG4-21 |
| A | 7 | li_function: §4.2 „lead promise or confirmed name" vs RG3-19 „lead promise only" (Killer.Curls) | RG4-5 |
| A | 8 | Bali Flaxseed: letter (one-job hold name ⇒ 3.4 (ii), committed) vs registry/§11.19 (D6, held) | RG4-5 |
| A | 9 | JF Lockencreme Traumlocken: override basis 4.1 (a) gone (C1 line captured); remaining FX-2c limb is not overridable | RG4-5 |
| A | 10 | NEQI Ultimate: registry letter „same" vs §4.1 (c) override list | RG4-20 |
| A | 11 | R1-Q3 vs R3-Q3 (JF Traumlocken Wellenauffrischer: one-job name + care + definition line) | RG4-8 |
| A | 12 | „Glow & Care" two-job name vs R3-Q3 „names that name both jobs" (Balea Finishing Spray) | RG4-8 |
| A | 13 | Care-word list: Aussie „strong hair", „Nutri-", „Treatment", „Balsam-Lotion" | RG4-3 |
| A | 14 | Definition word in the name as the definition half of an R1-Q3 tie (HASK „curls defining cream") | RG4-22 |
| A | 15 | Lead words: „Beach Waves", „Glaze", „Big Hair Day", „Salon Blow-Out" | RG4-4 |
| A | 16 | Promise lines carry no line position (first C1 pack-front line unreadable; Elnett) | P4-3 |
| A | 17 | Smoothing-spray gap: fixative-led, thin conditioning (Balea Glattspray Anti-Frizz ⇒ li_g0_provisional) | RG4-6 |
| A | 18 | §4.5 FX-4 hold sentence vs „3.4 (ii)/3.5 routes are not held" (Barber Club Pomade, Redken Wax Spray, Taft x Gliss Shine Coat) | RG4-7 |
| A | 19 | Secondaries: refill after a gate drop | RG4-17 |
| A | 20 | Secondaries: claim order depends on packet order (Balea Traumlocken vs §11.2) | RG4-17 |
| A | 21 | Secondaries: which claim types state a job (humidity, duration, „fixiert die Frisur") | RG4-17 |
| A | 22 | Primary job when a name's product noun routes (Balea Glow Wax, got2b Texture Clay, Taft Gel Wax) | RG4-9 |
| A | 23 | „natürlicher Glanz" vs stale §11.2 (Balea Traumlocken finish) | RG4-11 |
| A | 24 | „POWER-SHINE-TECHNOLOGIE" as a finish/shine claim (Elnett 3 Tage Glatt) | RG4-10 |
| A | 25 | Hold words „leichte Fixierung" (Balea Finishing Stick) and „fixiert die Frisur" (Balea Overnight) | RG4-12 |
| A | 26 | Scale gaps: got2b six-mark display; Taft gel „Haltegrad 5" with max 5 stated | RG4-16 |
| A | 27 | Subtype ties: aerosol powder (Balea Pure Volumenpuder Spray), Redken Root Tease | RG4-13 |
| A | 28 | Stick stroked over dry hair: moment and zone (Balea Finishing Stick) | RG4-14 |
| A | 29 | target_zone ranges („vom Ansatz … bis in die Längen", „vom Ansatz her") | RG4-14 |
| A | 30 | Color Wow heat_activated blind (RG2-26 no vs §6.13 unresolved) | RG4-18 |
| A | 31 | Implausible T_LI vs the PH1-13 dose rule (OSiS Curl Retouch) | RG4-19 |
| A | 32 | Heat claims not typed as heat claims in the S0 packet (KMS 2-in-1, OSiS Sparkler) | P4-2 |
| A | 33 | English C1 lines on the German-market pack (Aussie, HASK, Cantu ×2) | RG4-23 |
| A | 34 | got2b Schutzengel claims-packet product_type_word „gel" for a pump spray | P4-4 |
| A | 35 | Unplaced lexicon species (Pullulan, Algin, Trehalose, … in Moroccanoil Volumizing; Ethyl Benzoate) | RG4-24 |
| A | 36 | D8b rule 2 needs a same-brand sibling the lane cannot see (Taft Haarspray Classic / Glanz) | RG4-25 |
| B | 1 | §6.10 / RG2-16 / RG3-16: RG2-16 remains explicitly open. The text caps secondaries at two and drops formula failures, but does not explicitly say whether later qualifying jobs refill dropped slots. (balea-locken-crunchgel, wella-eimi-glam-mist-shine-spray, wella-eimi-sugar-lift) | RG4-17 |
| B | 2 | §4.2 one-job names / PH2-1 versus §4.6 and §11.19: Haargel Strong Hold Flaxseed has a one-job hold name, which appears to bypass the Leave-in check under the generic name/PH2-1 rules. Its explicit registry and binding… (bali-curls-strong-hold-flaxseed-gel) | RG4-5 |
| B | 3 | §6.10 / RG2-16 / SFS-15: Elnett's captured pack names POWER-SHINE-TECHNOLOGIE. The job-word rule could count Shine, but no explicit rule settles whether this technology label independently promises the shine job. (loreal-paris-elnett-stylingspray-hitzeschutz-3-tage-glatt) | RG4-10 |
| B | 4 | §7.3 Henkel x/5 / printed 1–6 / §7.2(2): The got2b packet supplies a legible six-position display. The table assigns Henkel formats x/5 and names NIVEA MEN, Gard and Taft 6 for the 1–6 row; the older got2b example cal… (got2b-spruehkleber-freeze-haarlack) | RG4-16 |
| B | 5 | §4.2 job nouns / §5 subtype anchors: Topcoat is not explicitly mapped as a confirmed-name job noun. Reading it as finish could let R3-Q3 defeat the joined styling/care lead; treating it as an unmapped form leaves that… (syoss-glaze-topcoat) | RG4-4 |
| B | 6 | §6.6 / lexicon §0.4: The flags contract gives boolean salt flags but forbids guessing a repair of CITRONELLOL SODIUM CHLORIDE. It does not specify the flag value for this potentially hidden salt declaration. (balea-locken-revitalizing-spray) | RG4-15 |
| B | 7 | §6.10/RG2-16 versus property set §2.12 claim boundary: The job rule reads explicit C1/C2 job wording, while the property set excludes duration/humidity parts. Some packets type a bare cosmetic anti-frizz statement as … (balea-finishing-spray-glow-und-care, john-frieda-frizz-ease-traumlocken-lockencreme) | RG4-17 |

### T13. Packet checks (computed)

S0 packets with a C1/C2 confirmed name and no C1/C2 promise line (the RG4-1 population): 6.

| Product | Name tier | Name | Directions tier | A | B |
|---|---|---|---|---|---|
| `american-crew-fiber` | C2 | FIBER | C3 | provisional_boundary/evidence_gate | styling/3.4(ii) |
| `american-crew-pomade` | C2 | Styling Pomade | C5 | provisional_boundary/evidence_gate | styling/3.4(ii) |
| `bumble-and-bumble-brilliantine` | C1 | brilliantine | C3 | styling/4.6_owner_named | styling/4.6_owner_named |
| `kerastase-curl-manifesto-refresh-absolu` | C1 | CURL MANIFESTO REFRESH ABSOLU Second day curl refreshing spray | C3 | provisional_boundary/evidence_gate | leave_in/3.4(iii)_in_category |
| `langhaarmaedchen-lockenspray-halt-sprungkraft` | C1 | LOCKENHALT SPRAY Halt & Sprungkraft | C3 | provisional_boundary/evidence_gate | provisional_boundary/pending_leave_in_addendum |
| `redken-styling-beach-spray` | C1 | BEACH SPRAY BEACHY TEXTURE SPRAY | C3 | provisional_boundary/evidence_gate | provisional_boundary/evidence_gate |

S0 directions stamped C5 (outside the G1 hierarchy; P4-1): `american-crew-pomade` (americancrew.com, verbatim).

C1/C2 claim lines with protection-from-heat wording, typed other than heat_protection, on records whose S0 heat field is empty (P4-2):

| Product | Type | Tier | Text |
|---|---|---|---|
| `got2b-hitzeschutzspray-schutzengel` | promise | C2 | got2b Schutzengel Hitzeschutz-Spray schützt dein Haar bis zu 230 °C vor Hitzeschäden und hinterlässt ein gepflegtes Haargefühl und einen himmlischen Glanz, ohne… |
| `kms-thermashape-2-in-1-spray` | promise | C2 | Hitzereaktives Spray für schnelles, einfaches und lang anhaltendes Styling auf trockenem Haar. Ideal zum Glätten und für Lockenstylings mit Hot Tools. Reduziert… |
| `osis-sparkler` | promise | C2 | Bring den Glamour zum Vorschein! Dieses silikonfreie Glanzspray sorgt für einen leichten Pflegeeffekt und ein herrlich glänzendes Finish nach dem Föhnen. Es red… |

claims-packet product_type_word that does not occur in a confirmed name containing „Spray" (P4-4): `wella-eimi-smooth-thermal-image` („two_phase_spray" for „EIMI Smooth Thermal Image (2-Phasen-Spray)"); `wella-eimi-texture-ocean-spritz` („pump_spray" for „EIMI Texture Ocean Spritz (Texturizing Salt Spray)").
