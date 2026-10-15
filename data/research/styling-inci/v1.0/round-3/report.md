# Styling calibration round 3 — blind lane A vs lane B: diff and scoring

Inputs: `blind-lane-A-r3/results.json` (Claude Opus), `blind-lane-B-r3/results.json` (Codex), frozen cohort `r3/cohort.json` (143 records: 139 carried from round 2, 4 new smoothing products; 128 calibration, 15 negative controls, **0 unseen**), standard v0.3 + lexicon v0.3. Every number below comes from `round-3/diff.js` (deterministic; two runs give `diff.json` SHA-256 `4aab7681…17eb5a` and identical `--tables` output). Nothing here edits a lane output, packet, cohort, sealed file, doc or the ledger.

## 1. Executive summary

**Agreement.** The two lanes agree on 95.4 % of the 3 003 core cells (2 865; round 2: 94.6 % on 139 records) and on all 21 fields for 95 of 143 products (66.4 %). They agree on the route for 135 of 143 products. There are **8 route splits** (round 2: 11) and **138 core-field disagreements on 48 products**. Most of those cells come from the 8 route splits, where one disagreement fills every Styling field of the product. The 4 new smoothing products agree on 79 of 84 cells. Their only route split is the KMS Straightening Creme. The 8 former unseen products agree on 165 of 168 cells.

**Round 2 → round 3 (the 139 carried products).** Of round 2's 157 core disagreements, **146 are gone and 11 persist**. 122 new cells appeared on 42 products. Five causes produce 87 of them:

- Lane B read three formula-conflict products as verified (39 cells).
- The name rule (RG2-21) raised two new questions: does a one-job name beat a „Textur und Pflege" line (17 cells, Taft Aloe Boost), and which name words are job words (9 cells)?
- Unrepaired INCI typos stopped lane B on one product (16 cells).
- The Benzyl-Alcohol marker contradiction appeared (6 cells).

The round-2 rulings mostly worked. Of 60 product checks covering R2-Q1…Q4, R2-H1…H6 and the R2-T fixes, **51 reached the ruled outcome in both lanes**. The other 9 reached it in lane A only, and every one of those traces to a lane-B error or a packet issue, not to a ruling that failed. Specific outcomes:

- Every R2-Q3 shine product now routes the same way (OSiS Sparkler, gotGloss, taft x Gliss Shine Coat, Balea Glow & Care).
- Balea Anti-Frizz Serum is Leave-in (R2-Q2).
- NEQI Diamond Glass All is Leave-in (R2-Q4/H4).
- Wella Fresh Up is Leave-in (R2-H1).
- Redken Curl Mist is a held refresher (R2-Q1).
- GUHL 3in1 stays out of Styling (R2-H2).
- The Balea Wax Stick is molding (R2-H3).
- Balea Pro Traumlocken and Killer.Curls are held curl creams (R2-H5, H6).

**Hold check.** Identical levels on 38 of 44 products where either lane states one (round 2: 41/43). Six mismatches:

- one lane error (KM Powder Puff: lane B ignored its formula conflict);
- three rule gaps: Bali Flaxseed's two strength words; „extra Halt" on the KMS spray; the Taft Paste „5+" sentence that still waits for a re-read that has already happened;
- two packet issues: Wella Glam Mist and Sugar Lift carry hold words that are not in their own claim line.

**Coverage.** 10 of 12 subtypes reach 5 agreed products, counting held ones. Two fall short:

- **smoothing_styler has 2**: the KMS 2-in-1 Spray (committed) and Color Wow (held).
- **texture_spray has 4.** It drops from 5 because Taft Aloe Boost and Redken Wax Spray are now disputed. Either of Q3 below or the RG3-1 fix brings it back to 5.

Plainly: **5 smoothing stylers are not reachable from this cohort.** The round-5 capture added 4 products, and only the KMS spray landed in smoothing_styler. Elnett 3 Tage Glatt would add a third, held one once its directions are captured. A fourth and fifth would need readings both lanes rejected.

**Lock status: not lockable.**

- Not met: subtype coverage, full lane agreement, the hold check, and the Leave-in addendum (no draft file exists).
- Met: the unseen criterion, in round 2. It is not re-tested in round 3 because there are no unseen slots.

**Who was right.** All 10 clear lane errors this round are lane B's (59 cells on 19 products). In round 2, lane A had one of 12. Lane A's contested readings are all rule gaps or open questions:

- 22 products with rule gaps (31 cells);
- 4 products with packet issues (22 cells);
- 7 products that need an owner ruling (26 cells).

**The three old doc sentences (fixed in 0f8af0ff after the lanes ran).** No disagreement traces to the old „S0 has no finish words" sentence or the old „effective-amount test is D6 only" sentence. The old „names never route or set a subtype except D2/D7" sentence may have contributed on 4 products (21 cells): Balea Haargel and Balea Glow&Shine (primary job), Redken Wax Spray (subtype) and Taft Texturspray Aloe Boost (route). On each of them lane B did not let a one-job name pick the lead. Lane B never cites the sentence, so this is an inference from the direction of the split.

## 2. Owner questions, ranked by impact

**Q1 — Can Glättungsstyler lock with fewer than 5 products?** (lock criterion 1)

Only two products are smoothing stylers in both lanes:

- KMS Thermashape 2-in-1 Spray: committed.
- Color Wow Dream Coat: held.

Elnett Stylingspray 3 Tage Glatt is ruled smoothing_styler (PH1-14), but its packet has no directions, so both lanes stop at the evidence gate. The targeted market capture found only four candidates in Germany. Options:

- (a) Lock with a written exception for this one subtype: 2 products now, 3 once the Elnett directions are captured.
- (b) Merge it into blowdry_lotion or shine_finish for v1.0.
- (c) Wait for the market.

**Recommendation: (a), and capture the Elnett directions now.** Even if every open item fell toward Styling, the count would be 5, and two of those five rest on readings both lanes rejected.

**Q2 — May a product name known only from a shop listing decide what the product is?** (RG3-3; 1 route split, 5 products, systemic for 29 C3-only names)

- *syoss Hitzeschutzspray Keratin.* The name comes only from dm. The only pack line is „2x Frizz-Kontrolle".
  - Lane B: heat protectant, from the name.
  - Lane A: ignores the name, reads an anti-frizz product, and stops at an unresolved Leave-in border (review).
- *Elvital Öl Magique, John Frieda Frizz Ease Haarserum, Garnier Sleek & Stay Haarserum.* Both lanes say Oil, but lane A gets there only through the owner registry, because the „Öl/Serum" name is C3.

**Recommendation: yes, for the product-type word of the shop title when no pack or brand-page name exists.** A product's name is identity, not a marketing claim. Retailer-only extra words would still not count (as in R2-H1, Wella Fresh Up). Also capture the pack names of these five products, which settles them whatever the rule.

**Q3 — The name names one job, but the only pack line adds care. Does the name win?** (RG3-2; 1 route split, 17 cascading cells, texture_spray coverage 4 → 5)

*taft Texturspray Aloe Boost* is named „Texturspray" and its pack says „Textur und Pflege für mühelose Undone Looks".

- Lane A: the name wins, so Styling texture_spray.
- Lane B: texture + care, so mixed, so manual review. The standard itself uses this exact line as its example of a mixed promise.

**Recommendation: yes, the name wins.** This is the same logic as your Balea Wax Stick ruling (R2-H3). Delete the Taft example from the mixed list.

**Q4 — A smoothing cream with a hold polymer behind a rich conditioning base: Leave-in or manual review?** (RG3-5; 1 route split, new product)

*KMS Thermashape Straightening Creme* lists Isoamyl Laurate r2 and Triheptanoin r3 (emollients), then VP/VA r5 (hold polymer), and promises „glatte Styles, die bis zur nächsten Haarwäsche halten".

- Lane A: Leave-in, by the NEQI Ultimate precedent: a supporting fixative on a conditioning base.
- Lane B: review, by the Wella Flowing Form precedent (PVP r2 leads).

**Recommendation: Leave-in when the hold polymer ranks after the conditioning base, review only when it leads.** That gives the KMS Creme Leave-in. It does not change smoothing_styler coverage either way.

## 3. Rule-gap register (RG3), deduplicated with both lanes' reported ambiguities

RG3-1, RG3-4, RG3-6…RG3-16 need only analyst wording; their leans are below. RG3-17…RG3-24 caused no split this round.

| ID | Class | Section | Records | Issue | Proposed fix | Lean |
|---|---|---|---|---|---|---|
| RG3-1 | b | standard §4.2 step 1 (RG2-21 job nouns, RG2-5 curl nouns), §5 form tie-break | `bali-curls-volumizing-curl-spray-refreshing`, `wellaflex-schaumfestiger-locken-und-wellen-starker-halt`, `kevin-murphy-killer-curls`, `jean-und-len-sea-salt-spray`, `redken-wax-spray` | Which words in a confirmed name are job words: a curl/wave noun without a verb („Curl Spray", „Locken & Wellen", „Killer.Curls"), a salt noun („Sea Salt Spray"), and a product noun that names a form inside a compound („Wax Spray", „Sprühwachs"). RG2-21 lists only Haarspray, Gel, Wachs, Puder, Schaumfestiger; §4.2 treats „Lockencreme" as a definition job word. Impact: 1 route split (Bali Volumizing: committed salt_spray vs held refresher), 1 subtype split (Redken Wax Spray: molding vs texture_spray), 3 primary jobs, 1 pair rule. | Add to §4.2 step 1: „A curl or wave noun in the name (Locken-, Curl, Wellen-) is a curl job word: definition, or refresh when the product revives curls; a salt noun (Salzspray, Sea Salt Spray) names texture; a product noun used as a form in a compound with another product noun (Wax Spray, Spray Wax, Sprühwachs, Gel-Spray) names the form, not a job — go to step 2/3." Outcomes: Bali Volumizing ⇒ two job words ⇒ first C2 line (revival) ⇒ held refresher (B); Wellaflex ⇒ definition, 3.4(iii) (A); Killer.Curls ⇒ two job words ⇒ C2 hold line ⇒ hold_fix (A); Jean&Len ⇒ texture (A); Redken Wax Spray ⇒ first C2 line „Texturierendes Sprühwachs" ⇒ texture_spray (B). | mixed per record (see outcomes) |
| RG3-2 (Q3) | d | standard §4.2 step 1 (RG2-21, R2-H3) vs §4.2 co-equal example „Taft „Textur und Pflege"" | `schwarzkopf-taft-texturspray-aloe-boost` | The name names one job (Texturspray) and decides by step 1; the only C1 line joins texture and care („Textur und Pflege …"), and §4.2 cites exactly this line as its example of a co-equal mixed lead. Impact: 1 route split, 18 cascading cells; texture_spray coverage 4 vs 5. | If the owner confirms the name step: delete „Taft „Textur und Pflege"" from the §4.2 co-equal examples and add „a care word in a later or co-equal line of a product whose name names one styling job is a call-out (SFS-15)". Otherwise add „a C1 line that joins the name's job with care makes the product mixed although the name names one job". | A (name decides, as R2-H3) |
| RG3-3 (Q2) | d | standard §4.2 („the confirmed product name is C1/C2 positioning"), §4.3 3.1 (D2 „confirmed C1/C2 name"), §4.6 registry identity | `syoss-hitzeschutzspray-keratin-heat`, `garnier-fructis-sleek-and-stay-heat-activated-serum`, `loreal-elvital-haaroel-oel-magique-alle-haartypen`, `john-frieda-haarserum-frizz-ease-der-baendiger`, `taft-x-gliss-hitzeschutzspray-lovely-long` | The claims packet stamps 29 confirmed names C3 (retailer titles). Lane A will not let a C3 name pick the lead or fire D2; lane B uses it. The registry also matches „taft x Gliss Hitzeschutzspray" to the Lovely Long variant by name only. Impact: 1 route split (Syoss Hitzeschutzspray), 3 reason codes, 1 promise class; systemic for 29 records. | Owner answer, then §4.2 / §4.3 3.1: either „a C3-captured product name counts for step 1 and D2 when no C1/C2 name exists, for its product-type noun only (Hitzeschutzspray, Haarserum, Haaröl); retailer-only extra words never count (R2-H1)" or „a C3-only name never decides; capture the pack name". Registry rows carry the sample_id they rule. | B (with a pack-name capture to make it moot) |
| RG3-4 | b | standard §4.2 lead promise (line vs sentence), RG2-19 | `wella-eimi-smooth-thermal-image` | A multi-sentence C2 paragraph opens with protection and then describes phases that care and smooth. Is the lead the paragraph or its first sentence? Impact: 1 route split (heat_protectant vs mixed_promise; non-Styling either way). | Add to §4.2: „The lead is the first sentence of the chosen line that states a job; later sentences of the same line are secondary claims." ⇒ heat_protection ⇒ 3.3. | B |
| RG3-5 (Q4) | d | LI T15 (incidental_film, NEQI Ultimate) vs PH2-1 accepted consequence (Wella EIMI Flowing Form ⇒ li_g0_provisional); LI §2.3.2 clause 4 | `kms-thermashape-straightening-creme` | A smoothing cream with a fixative-class polymer and a not-thin conditioning base, not a curl cream: T15 incidental_film ⇒ in_category ⇒ leave_in, or the middle band outside D7 ⇒ li_g0_provisional? Impact: 1 route split; smoothing_styler coverage only if T15 reads the base as thin (then committed smoothing_styler). | Add to §4.3 3.4(iii): „A fixative-class polymer ranked after the conditioning architecture is a supporting fixative (T15 incidental_film ⇒ in_category ⇒ D6); one ranked at or above it with substantive conditioning is the middle band ⇒ D7 for curl creams, li_g0_provisional otherwise (PH2-1, Flowing Form PVP r2)." | A |
| RG3-6 | b | standard §11.11 (T_LI Benzyl Alcohol r8 after Parfum r6) vs lexicon v0.3 §0.2 / FR-2 and LI T17 | `aussie-leave-in-creme-work-that-curl`, `gard-haarspray-extrastark-pumpspray`, `got2b-gotgloss-glanz-spray`, `isana-professional-styling-creme-locken-traum`, `schwarzkopf-taft-foehn-spray-volumen-halt-3`, `schwarzkopf-taft-texturspray-aloe-boost` | The worked example sets T_LI on a Benzyl Alcohol ranked after Parfum; the lexicon says at or after Parfum it is an allergen declaration and never T_LI. Impact: 6 tail-marker cells, no value moves. | Correct §11.11 Markers to „T_LI none_visible (Benzyl Alcohol r8 sits after Parfum r6: an allergen declaration, lexicon §0.2)" and add the sentence to §3.2. | B |
| RG3-7 | b | standard §6.11 RG2-8 shaping-act list vs worked example §11.2 | `got2b-styling-paste-istyler-texture-clay`, `osis-dust-it`, `syoss-professional-performance-max-hold-power-wax` | „einarbeiten", „in den Handflächen verreiben und ins Haar arbeiten", „auf trockenem Haar anwenden, um den gewünschten Look zu erzielen" are not in the RG2-8 list; §11.2 reads einarbeiten as shaping. Impact: 3 application_moment cells. | Add „einarbeiten, durcharbeiten, mit den Fingern verteilen und formen" to the RG2-8 list, and: „a paste, wax, cream or powder worked into dry hair by hand is dry_restyle". | A |
| RG3-8 | b | standard §7.2 (PH1-8 covers pack vs page only) | `bali-curls-strong-hold-flaxseed-gel` | Two C1/C2 strength statements on one source disagree (name „Strong Hold" ⇒ 3, line „Extra-starker Halt" ⇒ 4). Impact: 1 hold level (a gel: hold ranks first in selection). | Add §7.2 step 7b: „Two C1/C2 strength statements of one product that map to different levels ⇒ null, both kept, review hold_claim_conflict (as PH1-8)." (conservative; neither lane emitted it). | neither (A's review is closer) |
| RG3-9 | b | standard §7.4 word lexicon vs RG-13 („Extra Hold" in names) | `kms-thermashape-2-in-1-spray` | „extra Halt" in a claim line is not in §7.4, while „Extra Hold" in a name counts as a strength phrase. Impact: 1 hold level (stored only, smoothing_styler). | Add to §7.4 level 4: „extra Halt / Extra Hold / Max Hold (extra, ultra, mega qualifying Halt directly)". | A |
| RG3-10 | b | standard §7.2 step 2 and §7.3 Henkel row („Taft Paste … until re-read") | `taft-styling-paste-forming-halt-5plus` | Stale text: the re-read (recapture-r4 P-8: four filled dots and a larger fifth circle „5+", no maximum printed) exists but no document closes the item; the claims packet does not carry the display description (P3-5). Impact: 1 hold level + neutral fact (molding: hold ranks first). | Replace the §7.2/§7.3 „until re-read" clauses with „re-read 2026-10-12 (recapture-r4 P-8): a five-mark Henkel display whose fifth mark reads 5+ ⇒ x/5 ⇒ 4". Not one of the three sentences fixed in 0f8af0ff. | A |
| RG3-11 | b | standard §7.5 D8b rule 1 | `osis-sparkler` | Does a negated hold claim („Kein Halt", level 0) fire D8b rule 1? Impact: 1 d8b flag. | Add to §7.5: „A negated hold claim (kein Halt, ohne Halt) is not a hold claim for rule 1." | A |
| RG3-12 | b | standard §4.2 care half (R2-Q1, R2-H5); §11.3 | `maria-nila-curlicue-cream`, `wella-eimi-nutricurls-curl-shaper` | Care-half vocabulary: a care product noun inside a C2 descriptor line („Definierende Pflegecreme"; §11.3 leaves it open) and moisture-locking („schließt Feuchtigkeit ein"). Impact: 2 promise classes, no value moves (D7 or the registry gives the same route). | Add to §4.2: „A care product noun in a C2 descriptor line (Pflegecreme, Pflegespray) is not a care job unless it is the confirmed name; moisture-locking (schließt Feuchtigkeit ein) is the moisturise care job." | A for Maria Nila (styling_result), A for Curl Shaper (mixed) |
| RG3-13 | b | R2-H2 / standard §4.1, §11.15 (emission for a care product kept in its category) | `guhl-locken-pflege-und-styling-3in1` | R2-H2 names neither the boundary_reason nor the promise class. Lane B invented „owner_ruled_care_current_category" (not in §4.0); lane A left the class unassigned. Impact: 1 promise class + 1 reason (route and no-profile agree). | Add to §11.15: „S0 output: provisional_boundary (mixed_promise), promise_class mixed (the R1-Q3 letter), ruled_route „care, current category (R2-H2)"." | class B, reason A |
| RG3-14 | b | standard §4.6 registry („S0 letter without the ruling: same") / §10.1 reason | `maria-nila-curlicue-cream` | Which reason a registry product carries when its letter already gives the ruled route: the letter's pair rule or the ruling. Impact: 1 reason code. | Add to §4.6: „Where the letter column reads „same", the record carries the letter's pair rule and the ruling as `ruled_route`; the reason is the ruling only where it overrides (§4.1 (a)–(c))." | A |
| RG3-15 | b | standard §4.1 RG2-24 (which INCI defects block); lexicon aliases | `john-frieda-frizz-ease-zauberformel-seiden-finish-creme`, `balea-styling-finishing-stick` | A missing space inside one readable INCI name („PerseaGratissima Oil") or a missing slash („VPVA COPOLYMER") above T_S: a blocking defect (B) or a transcription artifact read as the obvious name (A)? Impact: 1 route split (18 cells), 2 F values. | Add to RG2-24: „Only incompleteness blocks (truncation, a missing separator that merges two INCI names, an unreadable token). A missing space or slash inside one INCI name that reads as exactly one known name is repaired by the freeze (P2-4 pattern, as_written kept)." See P3-3. | A |
| RG3-16 | b | standard §6.10 secondaries (RG2-16 „open") | 11 records with secondary_jobs-only or non-cascade disagreements (field secondary_jobs) | Applying the open rule: a hold claim whose strength is masked („[CLAIM] Halt") or only numeric (Haltegrad) — hold_fix or not; job words in the confirmed name as secondaries; gate drops. Impact: supplementary only. | Add to §6.10: „A hold claim with a strength word or a brand number ⇒ hold_fix (the mask hides the grade, not the job); job words of the confirmed name count as secondaries after the primary, in name order, before the claim lines." | A |
| RG3-17 | b | lexicon v0.3 species | `syoss-hitzeschutzspray-keratin-heat`, `kms-thermashape-straightening-creme`, `john-frieda-frizz-ease-zauberformel-seiden-finish-creme` | Unlisted species: Bis-Isobutyl PEG/PPG-20/35/Amodimethicone Copolymer (D6 care limb), WL-7-type emollients (Isoamyl Laurate, Triheptanoin, Isostearyl Palmitate, Hydrogenated Polydecene), Polyurethane-34/-48, AMP-Acrylates/Allyl Methacrylate Copolymer, Acrylic Acid/VP Crosspolymer, Sodium Polyacryloyldimethyl Taurate. Impact: Syoss Hitzeschutzspray D6 care limb (secondary to RG3-3); KMS creme conditioning read. | Lexicon v0.4: place each species; PEG/PPG-modified amodimethicones as CA-4 (amino silicone: counts as care under PH1-13) unless declared otherwise. | — |
| RG3-18 | b | standard §5 anchor table | `moroccanoil-volumizing-spray`, `wella-eimi-sugar-lift`, `redken-root-tease`, `redken-wax-spray`, `bali-curls-volumizing-curl-spray-refreshing` | Damp volume sprays with no blow-dry step (both lanes chose blowdry_lotion as „closest"), a wax in spray form, a salt-led curl spray. Impact: agreed today except the RG3-1 records. | Add to §5 blowdry_lotion: „incl. damp volume sprays whether or not a blow-dry is named"; add a texture_spray tie-break: „a wax or paste in spray form ⇒ texture_spray". | — |
| RG3-19 | b | standard §4.2 li_function / §4.5 | — | Lane A: a later C1/C2 line naming a Leave-in function (anti-frizz, care) can decide whether a product is held, although li_function reads the lead only. Impact: no disagreement this round. | State in §4.2: „li_function reads the lead promise only; later lines never set it." | — |
| RG3-20 | b | standard §6.12 RG-9 vs RG2-10 | `osis-dust-it` | „Auf den Haaransatz und die Längen" — two sites named together: RG-9 (first-named ⇒ roots) or RG2-10 (whole hair ⇒ all). Both lanes chose all. Impact: none this round. | Add to RG2-10: „two sites named together (Ansatz und Längen) ⇒ all". | — |
| RG3-21 | b | standard §4.3 3.4(i) D7 limb 3 | `wella-eimi-nutricurls-curl-shaper` | „Curl Shaper (Defining Gel Cream)": is that „sold as a curl or styling cream"? Both lanes said yes. Impact: none this round. | Add „Curl Shaper / Defining Cream / Gel Cream on a curl product" to the limb-3 examples. | — |
| RG3-22 | b | standard §4.1 input 3; freeze inci_flags | `syoss-hitzeschutzspray-keratin-heat`, `taft-styling-paste-forming-halt-5plus`, `got2b-spruehkleber-freeze-haarlack` | Item-count mismatch flags (capture count vs split count) carry no defect rank, so a lane cannot tell whether the gap is above T_S. Impact: none this round (both lanes passed the gate). | Freeze: resolve each count mismatch or give its rank (P3-6). | — |
| RG3-23 | b | standard §7.3 brand scales | `balea-styling-creme-power-flex` | Balea printed 1–7 display has no row; both lanes null. Impact: none this round. | Add „Balea 1–7 display: no legend ⇒ words only" to §7.3. | — |
| RG3-24 | b | standard §6.13 | `color-wow-dream-coat-supernatural-spray` | Activation only at C3 in the blind round. Impact: none (both unresolved, as §6.13 says). | none | — |

**Where each lane-reported ambiguity went** (lane A's 18 handback items; lane B's 5 `ambiguous_rules`):

| Lane | Reported ambiguity | Maps to |
|---|---|---|
| A | einarbeiten vs RG2-8 shaping acts (§11.2) | RG3-7 |
| A | D2 when the Öl/Serum name is C3-only | RG3-3 (Q2) |
| A | registry matched by name only (taft x Gliss Lovely Long) | RG3-3 (Q2), sub-item registry identity |
| A | P2-5 hold words without a claim line (Sugar Lift, Glam Mist) | P3-2 |
| A | two disagreeing C1/C2 strength words on one source (Bali Flaxseed) | RG3-8 |
| A | name step vs „Textur und Pflege" mixed example | RG3-2 (Q3) |
| A | §5 subtype gaps (damp volume sprays, Redken Wax Spray, Root Tease, Bali Volumizing) | RG3-18 + RG3-1 |
| A | later line overlapping LI function decides held vs not | RG3-19 |
| A | LI §2.3.2 clauses / T15 „thin" | RG3-5 (Q4) |
| A | unlisted lexicon species | RG3-17 |
| A | RG-9 vs RG2-10 „Ansatz und Längen" | RG3-20 |
| A | secondary-job scope | RG3-16 |
| A | D7 limb 3 „Curl Shaper (Defining Gel Cream)" | RG3-21 |
| A | Benzyl Alcohol after Parfum §11.11 vs LI T17 | RG3-6 |
| A | INCI count mismatches without defect rank | RG3-22 + P3-6 |
| A | Elnett 3 Tage Glatt no directions | P3-4 |
| A | Taft Paste 5+ display reading | RG3-10 + P3-5 |
| A | Color Wow heat_activated in blind round | RG3-24 (no action: §6.13 already gives unresolved; both lanes agree) |
| B | RG2-16 secondary vocabulary | RG3-16 |
| B | D8b-negative-hold (OSiS Sparkler „Kein Halt") | RG3-11 |
| B | S0-identity-metadata („S0 identity blocks omit identity_status") | P3-1 + E3-1 (the packets carry identity_status at the top level; lane B missed it) |
| B | INCI-unlisted-alias (VPVA; missing spaces above T_S) | RG3-15 + P3-3 |
| B | Balea-7-scale (Power Flex printed 1–7) | RG3-23 |

## 4. Packet issues (P3)

The computed evidence is in `diff.json` under `packet_checks` and in table T12.

| ID | Records | Issue | Fix |
|---|---|---|---|
| P3-1 | `john-frieda-volume-lift-ansatz-booster`, `kevin-murphy-powder-puff-volume`, `cantu-shea-butter-extra-hold-edge-stay-gel` | identity_status („inci_conflict") and inci_alt sit at the S0 packet top level, outside the `identity` block; FREEZE-NOTES §9.1 lists only identity.inci_flags inside the block and verified records carry no identity_status at all. Lane B read the block as „omitting identity_status" and treated all three as verified (E3-1, two route splits). | Freeze: put identity_status in every S0 packet (incl. verified) inside `identity`, with inci_alt next to it; list both in §9.1. |
| P3-2 | `wella-eimi-glam-mist-shine-spray`, `wella-eimi-sugar-lift`, `wella-professionals-eimi-flowing-form`, `wella-eimi-smooth-thermal-image` | P2-5 (a hold entry's words come only from its own raw) was applied to Balea Haargel only. Hold entries on other records still carry strength words that are not in their own text (computed list: packet_checks.hold_words_not_in_text). Where the brand scale has no maximum (Wella EIMI), the words decide the level, so the lanes split (Glam Mist 1 vs null, Sugar Lift 3 vs null). | Re-capture: put each strength phrase found on the page in its own C1/C2 hold line, drop words that have no line; re-freeze the affected records. |
| P3-3 | `john-frieda-frizz-ease-zauberformel-seiden-finish-creme`, `balea-styling-finishing-stick`, `wella-eimi-glam-mist-shine-spray`, `wella-eimi-sugar-lift` | Unrepaired transcription defects in INCI names (computed list: packet_checks.inci_transcription_defects): missing spaces („PerseaGratissima Oil" r3, „IsostearylPalmitate" r8, „HexylCinnamal", „PEG-40Hydrogenated Castor Oil") and a missing slash („VPVA COPOLYMER" r4, not flagged at all). One route split (Zauberformel) and two F values (Finishing Stick). | Freeze: repair names that read as exactly one known INCI (P2-4 pattern, as_written kept, flag with rank); keep blocking only for incompleteness (RG3-15). |
| P3-4 | `loreal-paris-elnett-stylingspray-hitzeschutz-3-tage-glatt` | Directions missing, although standard §11.7 cites C2 L'Oréal article directions. Both lanes stop at evidence_gate; the ruled route (PH1-14, held smoothing_styler) waits for them. | Capture the C2 article directions into the frozen record; this adds one held smoothing_styler. |
| P3-5 | `taft-styling-paste-forming-halt-5plus` | The claims packet carries only „5+" and scale_info without the re-read display description (four filled dots + a larger fifth circle „5+", recapture-r4 P-8), so a lane cannot see that the re-read §7.2 waits for has happened. | Carry the display description (marks, filled, labels) in the hold claim of the claims packet; close §7.2 (RG3-10). |
| P3-6 | `syoss-hitzeschutzspray-keratin-heat`, `taft-styling-paste-forming-halt-5plus`, `got2b-spruehkleber-freeze-haarlack` | inci_flags „capture_item_count_N_vs_split_M" with defect_rank null. | Re-check the count against the source and record the missing/extra item and its rank. |
| P3-7 | see packet_checks.confirmed_name_tier_C3 | Confirmed names stamped C3 (computed count). Five of them carry the RG3-3 disagreements (Syoss Hitzeschutzspray, the three serums/oil, taft x Gliss Lovely Long). | Capture pack-front names (C1) for these products; this settles Q2 for them whatever the ruling. |

## 5. Lane errors (E3)

All 10 are lane B's. E3-2, E3-6 and E3-7 persist from round 2 (E2-9, E2-7, E2-5). E3-4 is the mirror of round 2's lane-A error E2-10, now made by lane B.

| ID | Records | Field | Wrong | Right | Rule | Moves a value |
|---|---|---|---|---|---|---|
| E3-1 | john-frieda-volume-lift-ansatz-booster, kevin-murphy-powder-puff-volume, cantu-shea-butter-extra-hold-edge-stay-gel | identity_status, route (+ cascade) | B | A | standard §4.1 input 3 + §2.2 A2 / LI T18: an inci_conflict with two lists never reaches tier 1 ⇒ provisional_boundary (formula_conflict); never overridden | yes |
| E3-2 | alcina-styling-mousse-aerosol, john-frieda-volume-lift-pushed-up-dry-texture-spray, moroccanoil-textur-und-volumenpuder, schwarzkopf-taft-haarpuder-volumen, john-frieda-frizz-ease-traumlocken-lockencreme, kms-thermashape-straightening-creme | tail_markers (T_LI status) | B | A | LI §3.1.1 clause 6 (closed set) + RG-1 ⇒ vacuous (round-2 E2-9 pattern) | no |
| E3-3 | loreal-paris-elvital-big-hair-day-erfrischendes-volumenspray | tail_markers (T_S) | B | A | lexicon FR-2: named synthetic aroma chemicals are T_S class (b) ⇒ Dimethyl Phenethyl Acetate r10 is the first member | no |
| E3-4 | guhl-foehn-spray-langzeit-volumen, kms-thermashape-2-in-1-spray | heat_activated | B | A | RG2-26 / §6.13: blind round reads F/U directions only | yes |
| E3-5 | balea-leave-in-spray-sea-salt-care-define | promise_class | B | A | §4.6 registry row v0.3: the letter reads mixed (R2-Q1), the D6 ruling overrides it | no |
| E3-6 | kevin-murphy-killer-curls | weight, buildup_note | B | A | PH2-12 (lanolin wax is a rich member) ⇒ rich ⇒ buildup limb 2 (round-2 E2-7 persists) | yes |
| E3-7 | bumble-and-bumble-brilliantine, color-wow-dream-coat-supernatural-spray | promise_class, primary_job (+ Brilliantine reason_code) | B | A | §4.2 class from C1/C2 only, §4.1 (a) no-claim values, §6.10 „jobs empty" (round-2 E2-5 persists; „unknown" is not a job value) | no |
| E3-8 | syoss-curl-cream-gel-3in1 | reason_code | B | A | RG2-5 („Locken zu formen" ⇒ li_function yes) ⇒ 3.4(iii) excluded_styling_first | no |
| E3-9 | balea-haargel-hair-jelly | primary_job | B | A | §4.2 step 1 + RG2-21 + R2-H3 (a one-job name decides the lead; later specific lines are secondaries) + RG-11 | yes |
| E3-10 | balea-professional-glow-und-shine-finishing-spray | primary_job | B | A | §4.2 step 1: the now-visible name names one job (shine/finish; RG2-5 same-job words count once) | yes |

## 6. Normalisation changes from round 2

These are the field rules in `diff.js`. Everything else is as in round 2.

- **reason_code.** Both lanes changed their output vocabulary. Lane A now emits `boundary_reason`, `pair_rule` and a descriptive `reason_code`. Lane B uses new codes (real_care, direct_styling plus a rule_path, owner_ruled_*, …). Both are mapped to the round-2 canonical pair rule or boundary reason:
  - a registry override is `4.6_owner_named`;
  - the D2 water-based-serum exception counts as `3.4(iii)_in_category`, because 3.4(iii) is the rule that decides.
- **application_moment.** Lane B now emits a plain string with no `also[]`. The primary moment is still compared; the round-2 supplementary field `application_moment_also` is dropped.
- **d8b_flags and secondary_jobs.** Lane B now emits `[]` on every record. On a record without a Styling profile, both fields are masked to null, as round 2 did for ingredient_flags.
- **ingredient_flags.** Lane B now emits tokens; they are folded into the round-2 object.
- **neutral_fact.** Compared case-insensitively: lane B copies the INCI name in packet casing.
- **tail_markers.** „Fragrance (Perfum)" is folded to parfum.
- **Unseen scoring.** Dropped, since there are no unseen slots. Lock criterion 4 is read from `round-2/diff.json`.

## 7. Tables

### T1. Field agreement (A vs B, after normalisation)

| Field | All 143 | Where either lane emitted | Calibration (128) | Neg. control (15) | Carried (139) | New (4) | R2-unseen now calibration (8) | Disagreements |
|---|---|---|---|---|---|---|---|---|
| identity_status | 140/143 (97.9 %) | 140/143 (97.9 %) | 97.7 % | 100 % | 97.8 % | 100 % | 100 % | 3 |
| tail_markers | 130/143 (90.9 %) | 130/143 (90.9 %) | 90.6 % | 93.3 % | 91.4 % | 75 % | 100 % | 13 |
| promise_class | 130/143 (90.9 %) | 130/143 (90.9 %) | 90.6 % | 93.3 % | 90.6 % | 100 % | 100 % | 13 |
| route | 135/143 (94.4 %) | 135/143 (94.4 %) | 93.8 % | 100 % | 95 % | 75 % | 100 % | 8 |
| reason_code | 126/143 (88.1 %) | 126/143 (88.1 %) | 89.1 % | 80 % | 88.5 % | 75 % | 100 % | 17 |
| subtype | 137/143 (95.8 %) | 82/88 (93.2 %) | 95.3 % | 100 % | 95.7 % | 100 % | 87.5 % | 6 |
| result_mechanisms | 138/143 (96.5 %) | 83/88 (94.3 %) | 96.1 % | 100 % | 96.4 % | 100 % | 100 % | 5 |
| hold_route | 138/143 (96.5 %) | 83/88 (94.3 %) | 96.1 % | 100 % | 96.4 % | 100 % | 100 % | 5 |
| weight | 138/143 (96.5 %) | 83/88 (94.3 %) | 96.1 % | 100 % | 96.4 % | 100 % | 100 % | 5 |
| alcohol_note | 139/143 (97.2 %) | 84/88 (95.5 %) | 96.9 % | 100 % | 97.1 % | 100 % | 100 % | 4 |
| buildup_note | 138/143 (96.5 %) | 83/88 (94.3 %) | 96.1 % | 100 % | 96.4 % | 100 % | 100 % | 5 |
| provides_heat_protection | 139/143 (97.2 %) | 84/88 (95.5 %) | 96.9 % | 100 % | 97.1 % | 100 % | 100 % | 4 |
| application_moment | 136/143 (95.1 %) | 81/88 (92 %) | 94.5 % | 100 % | 95 % | 100 % | 100 % | 7 |
| target_zone | 139/143 (97.2 %) | 84/88 (95.5 %) | 96.9 % | 100 % | 97.1 % | 100 % | 100 % | 4 |
| heat_activated | 137/143 (95.8 %) | 82/88 (93.2 %) | 95.3 % | 100 % | 96.4 % | 75 % | 100 % | 6 |
| hold_level | 137/143 (95.8 %) | 38/44 (86.4 %) | 95.3 % | 100 % | 96.4 % | 75 % | 87.5 % | 6 |
| flexibility | 139/143 (97.2 %) | 84/88 (95.5 %) | 96.9 % | 100 % | 97.1 % | 100 % | 100 % | 4 |
| finish | 139/143 (97.2 %) | 84/88 (95.5 %) | 96.9 % | 100 % | 97.1 % | 100 % | 100 % | 4 |
| primary_job | 131/143 (91.6 %) | 76/88 (86.4 %) | 90.6 % | 100 % | 91.4 % | 100 % | 87.5 % | 12 |
| neutral_fact | 141/143 (98.6 %) | 9/11 (81.8 %) | 98.4 % | 100 % | 98.6 % | 100 % | 100 % | 2 |
| d8b_flags | 138/143 (96.5 %) | 83/88 (94.3 %) | 96.1 % | 100 % | 96.4 % | 100 % | 100 % | 5 |
| secondary_jobs (supplementary) | 122/143 (85.3 %) | 67/88 (76.1 %) | 83.6 % | 100 % | 85.6 % | 75 % | 62.5 % | 21 |
| ingredient_flags (supplementary) | 138/143 (96.5 %) | 83/88 (94.3 %) | 96.1 % | 100 % | 96.4 % | 100 % | 100 % | 5 |
| ↳ tail_T_S | 142/143 (99.3 %) | — | 99.2 % | 100 % | 99.3 % | 100 % | 100 % | 1 |
| ↳ tail_T_LI | 131/143 (91.6 %) | — | 91.4 % | 93.3 % | 92.1 % | 75 % | 100 % | 12 |

### T2. Overall agreement (21 core fields)

| Subset | Cells agree | Emitted cells agree | Records with all 21 fields equal |
|---|---|---|---|
| all (143) | 2865/3003 (95.4 %) | 1864/2002 (93.1 %) | 95/143 (66.4 %) |
| calibration (128) | 2555/2688 (95.1 %) | 1794/1927 (93.1 %) | 85/128 (66.4 %) |
| negative_control (15) | 310/315 (98.4 %) | 70/75 (93.3 %) | 10/15 (66.7 %) |
| carried (139) | 2786/2919 (95.4 %) | 1820/1953 (93.2 %) | 93/139 (66.9 %) |
| new (4) | 79/84 (94 %) | 44/49 (89.8 %) | 2/4 (50 %) |
| round2_unseen_now_calibration (8) | 165/168 (98.2 %) | 111/114 (97.4 %) | 6/8 (75 %) |
| round 2, same 139 records | 2762/2919 (94.6 %) | — | 95/139 |

### T3. Route agreement per pair rule / boundary reason

| Reason (canonical) | Records (either lane) | Route agrees | Reason agrees |
|---|---|---|---|
| 3.1 | 3 | 3 | 0 |
| 3.2 | 4 | 4 | 4 |
| 3.3 | 5 | 3 | 3 |
| 3.4(ii) | 50 | 46 | 43 |
| 3.4(iii)_excluded_styling_first | 3 | 3 | 0 |
| 3.4(iii)_in_category | 16 | 15 | 15 |
| 3.5 | 24 | 23 | 23 |
| 4.6_owner_named | 11 | 11 | 6 |
| evidence_gate | 13 | 12 | 11 |
| formula_conflict | 3 | 1 | 0 |
| li_g0_provisional | 5 | 3 | 3 |
| mixed_promise | 8 | 6 | 5 |
| owner_ruled_care_current_category | 1 | 1 | 0 |
| pending_leave_in_addendum | 14 | 13 | 13 |

### T4. Route splits

| Product | A | B | Class | Root cause | Right lane |
|---|---|---|---|---|---|
| BALI CURLS Volumizing Curl Spray (`bali-curls-volumizing-curl-spray-refreshing`) | styling | provisional_boundary | b | RG3-1 | B (lean) |
| John Frieda Frizz Ease Zauberformel Seiden-Finish Creme (`john-frieda-frizz-ease-zauberformel-seiden-finish-creme`) | styling | provisional_boundary | c | P3-3 | A |
| John Frieda Volume Lift Ansatz-Booster (`john-frieda-volume-lift-ansatz-booster`) | provisional_boundary | styling | a | E3-1 | A |
| Kevin.Murphy Powder.Puff Volume (`kevin-murphy-powder-puff-volume`) | provisional_boundary | styling | a | E3-1 | A |
| KMS Thermashape Straightening Creme (`kms-thermashape-straightening-creme`) | leave_in | provisional_boundary | d | RG3-5 | — |
| Schwarzkopf taft Texturspray Aloe Boost (`schwarzkopf-taft-texturspray-aloe-boost`) | styling | provisional_boundary | d | RG3-2 | — |
| syoss Hitzeschutzspray Keratin (`syoss-hitzeschutzspray-keratin-heat`) | provisional_boundary | heat_protectant | d | RG3-3 | — |
| Wella Professionals EIMI Smooth Thermal Image (2-Phasen-Spray) (`wella-eimi-smooth-thermal-image`) | provisional_boundary | heat_protectant | b | RG3-4 | B (lean) |

### T5. Every core-field disagreement

Route splits cascade into every Styling field of the record; those cells carry the record's root cause. „Path" = the lane's route · boundary/pair rule · reason as emitted (full rule paths and notes are in `diff.json` → `disagreements[].A_rule_path / B_rule_path`). OS = may trace to a pre-0f8af0ff sentence.

| # | Product | Field | A | A path | B | B path | Class | Root cause | Right lane | OS |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | ALCINA Styling Mousse Aerosol (`alcina-styling-mousse-aerosol`) | tail_markers | T_S caprylyl glycol r11 unresolved; T_LI caprylyl glycol r11 vacuous | styling · 3.4(ii) · styling_direct_hold_promise | T_S caprylyl glycol r11 unresolved; T_LI caprylyl glycol r11 plausible | styling · direct_styling · 4.3/3.4(ii)/PH2-1 | a | E3-2 | A | — |
| 2 | AUSSIE Leave-In Creme Work That Curl (`aussie-leave-in-creme-work-that-curl`) | tail_markers | T_S parfum r7 plausible; T_LI benzyl alcohol r8 plausible | leave_in · 3.4(iii) · li_g0_in_category_d6_not_fired_real_care | T_S parfum r7 plausible; T_LI sodium benzoate r9 plausible | leave_in · real_care · 4.3/3.4(iii)/D6 | b | RG3-6 | B (lean) | — |
| 3 | Balea Haargel Hair Jelly (Styling Hair Jelly) (`balea-haargel-hair-jelly`) | primary_job | hold_fix | styling · 3.4(ii) · styling_direct_hold_promise | sleek | styling · direct_styling · 4.3/3.4(ii)/PH2-1 | a | E3-9 | A | possible |
| 4 | Balea Leave-In Spray Sea Salt Care & Define (`balea-leave-in-spray-sea-salt-care-define`) | promise_class | mixed | provisional_boundary · pending_leave_in_addendum · ruled (4.1(c)); letter mixed · owner_ruled_D6_salt_spray_held_overrides_mixed | styling_result | provisional_boundary · pending_leave_in_addendum · 4.3/D6-or-D7/4.5/PH2-2 | a | E3-5 | A | — |
| 5 | Balea PROFESSIONAL Leave-In Glow&Shine Finishing Spray (`balea-professional-glow-und-shine-finishing-spray`) | primary_job | shine | styling · 3.5 · non_aqueous_shine_finish_R1-Q2 | frizz_control | styling · dry_finish · 4.3/3.5/R1-Q2 | a | E3-10 | A | possible |
| 6 | Balea Fixierungsbürste Styling Finishing Stick (`balea-styling-finishing-stick`) | result_mechanisms | fixative_film | styling · 3.4(ii) · flyaway_control_dry_finished_hair_R1-Q2 | humectant_only | styling · direct_styling · 4.3/3.4(ii)/PH2-1 | c | P3-3 | A | — |
| 7 | Balea Fixierungsbürste Styling Finishing Stick (`balea-styling-finishing-stick`) | hold_route | present | styling · 3.4(ii) · flyaway_control_dry_finished_hair_R1-Q2 | ambiguous | styling · direct_styling · 4.3/3.4(ii)/PH2-1 | c | P3-3 | A | — |
| 8 | BALI CURLS Haargel Strong Hold Flaxseed (`bali-curls-strong-hold-flaxseed-gel`) | hold_level | review | provisional_boundary · pending_leave_in_addendum · 3.4(iii) -> D6 · d6_styling_held_ph1-16 | 4 | provisional_boundary · pending_leave_in_addendum · 4.3/D6/4.5 | b | RG3-8 | — | — |
| 9 | BALI CURLS Volumizing Curl Spray (`bali-curls-volumizing-curl-spray-refreshing`) | route | styling | styling · 3.4(ii) · styling_direct_volume_promise | provisional_boundary | provisional_boundary · pending_leave_in_addendum · 4.3/D6-or-D7/4.5/PH2-2 | b | RG3-1 | B (lean) | — |
| 10 | BALI CURLS Volumizing Curl Spray (`bali-curls-volumizing-curl-spray-refreshing`) | reason_code | 3.4(ii) | styling · 3.4(ii) · styling_direct_volume_promise | pending_leave_in_addendum | provisional_boundary · pending_leave_in_addendum · 4.3/D6-or-D7/4.5/PH2-2 | b | RG3-1 | B (lean) | — |
| 11 | BALI CURLS Volumizing Curl Spray (`bali-curls-volumizing-curl-spray-refreshing`) | subtype | salt_spray | styling · 3.4(ii) · styling_direct_volume_promise | refresher | provisional_boundary · pending_leave_in_addendum · 4.3/D6-or-D7/4.5/PH2-2 | b | RG3-1 | B (lean) | — |
| 12 | BALI CURLS Volumizing Curl Spray (`bali-curls-volumizing-curl-spray-refreshing`) | primary_job | volume | styling · 3.4(ii) · styling_direct_volume_promise | refresh | provisional_boundary · pending_leave_in_addendum · 4.3/D6-or-D7/4.5/PH2-2 | b | RG3-1 | B (lean) | — |
| 13 | Bumble and bumble Brilliantine (`bumble-and-bumble-brilliantine`) | promise_class | not_assigned | styling · ruled (4.1 override (a)); letter evidence_gate · owner_named_route_D2_claim_authority_gap | styling_result | styling · direct_styling · 4.3/3.4(ii)/PH2-1 | a | E3-7 | A | — |
| 14 | Bumble and bumble Brilliantine (`bumble-and-bumble-brilliantine`) | reason_code | 4.6_owner_named | styling · ruled (4.1 override (a)); letter evidence_gate · owner_named_route_D2_claim_authority_gap | 3.4(ii) | styling · direct_styling · 4.3/3.4(ii)/PH2-1 | a | E3-7 | A | — |
| 15 | Bumble and bumble Brilliantine (`bumble-and-bumble-brilliantine`) | primary_job | — | styling · ruled (4.1 override (a)); letter evidence_gate · owner_named_route_D2_claim_authority_gap | unknown | styling · direct_styling · 4.3/3.4(ii)/PH2-1 | a | E3-7 | A | — |
| 16 | Cantu Shea Butter for Natural Hair Firm Hold Edge Stay Gel (`cantu-shea-butter-extra-hold-edge-stay-gel`) | identity_status | provisional_formula_conflict | provisional_boundary · formula_conflict · formula_conflict_and_missing_directions | verified | provisional_boundary · evidence_gate · 4.1 | a | E3-1 | A | — |
| 17 | Cantu Shea Butter for Natural Hair Firm Hold Edge Stay Gel (`cantu-shea-butter-extra-hold-edge-stay-gel`) | reason_code | formula_conflict | provisional_boundary · formula_conflict · formula_conflict_and_missing_directions | evidence_gate | provisional_boundary · evidence_gate · 4.1 | a | E3-1 | A | — |
| 18 | COLOR WOW Dream Coat Supernatural Spray (`color-wow-dream-coat-supernatural-spray`) | promise_class | not_assigned | provisional_boundary · pending_leave_in_addendum · ruled (4.1 override (a)); letter evidence_gate · owner_named_route_D2_held_claim_authority_gap | styling_result | provisional_boundary · pending_leave_in_addendum · 4.3/D6-or-D7/4.5/PH2-2 | a | E3-7 | A | — |
| 19 | COLOR WOW Dream Coat Supernatural Spray (`color-wow-dream-coat-supernatural-spray`) | primary_job | — | provisional_boundary · pending_leave_in_addendum · ruled (4.1 override (a)); letter evidence_gate · owner_named_route_D2_held_claim_authority_gap | unknown | provisional_boundary · pending_leave_in_addendum · 4.3/D6-or-D7/4.5/PH2-2 | a | E3-7 | A | — |
| 20 | Gard Haarspray extrastark (Pumpspray, ohne Treibgas) (`gard-haarspray-extrastark-pumpspray`) | tail_markers | T_S parfum r5 plausible; T_LI benzyl alcohol r12 vacuous | styling · 3.4(ii) · styling_direct_hold_promise | T_S parfum r5 plausible; T_LI null rnull none_visible | styling · direct_styling · 4.3/3.4(ii)/PH2-1 | b | RG3-6 | B (lean) | — |
| 21 | GARNIER FRUCTIS Haarserum Keratin Sleek & Stay (Heat-Activated Serum), Anti-Frizz (`garnier-fructis-sleek-and-stay-heat-activated-serum`) | reason_code | 4.6_owner_named | oil · ruled D2 (registry); letter 3.5 · owner_named_route_D2_oil | 3.1 | oil · oil_name · 4.3/3.1/D2 | d | RG3-3 | — | — |
| 22 | got2b (Schwarzkopf/Henkel) Glanz Spray got Gloss (gotGloss Glanz Spray) (`got2b-gotgloss-glanz-spray`) | tail_markers | T_S parfum r7 plausible; T_LI benzyl alcohol r14 vacuous | styling · 3.5 · non_aqueous_shine_lead_RG2-15 | T_S parfum r7 plausible; T_LI null rnull none_visible | styling · shine_lead · 4.3/3.5/RG2-15 | b | RG3-6 | B (lean) | — |
| 23 | got2b (Schwarzkopf) Styling Paste iStyler Texture Clay (`got2b-styling-paste-istyler-texture-clay`) | application_moment | dry_restyle | styling · 3.4(ii) · styling_direct_promise_outside_li_functions | dry_finish | styling · direct_styling · 4.3/3.4(ii) | b | RG3-7 | A (lean) | — |
| 24 | GUHL Föhn-Spray Langzeit Volumen (Föhn-Aktiv Styling Spray) (`guhl-foehn-spray-langzeit-volumen`) | heat_activated | no | styling · 3.4(ii) · styling_direct_volume_promise | yes | styling · direct_styling · 4.3/3.4(ii) | a | E3-4 | A | — |
| 25 | GUHL Haarkur, Conditioner & Lockencreme Pflege & Styling 3in1 (`guhl-locken-pflege-und-styling-3in1`) | promise_class | not_assigned | provisional_boundary · mixed_promise · R2-H2_care_cream_stays_current_category | mixed | provisional_boundary · owner_ruled_care_current_category · 4.1/R2-H2/RG2-20 | b | RG3-13 | — | — |
| 26 | GUHL Haarkur, Conditioner & Lockencreme Pflege & Styling 3in1 (`guhl-locken-pflege-und-styling-3in1`) | reason_code | mixed_promise | provisional_boundary · mixed_promise · R2-H2_care_cream_stays_current_category | owner_ruled_care_current_category | provisional_boundary · owner_ruled_care_current_category · 4.1/R2-H2/RG2-20 | b | RG3-13 | — | — |
| 27 | ISANA PROFESSIONAL Styling Creme Locken Traum (`isana-professional-styling-creme-locken-traum`) | tail_markers | T_S parfum r24 plausible; T_LI benzyl alcohol r28 vacuous | provisional_boundary · evidence_gate · s0_evidence_gate_no_promise_no_directions | T_S parfum r24 plausible; T_LI phenoxyethanol r31 vacuous | provisional_boundary · evidence_gate · 4.1 | b | RG3-6 | B (lean) | — |
| 28 | Jean&Len Sea Salt Spray (`jean-und-len-sea-salt-spray`) | primary_job | texture | styling · 3.4(ii) · styling_direct_texture_promise | volume | styling · direct_styling · 4.3/3.4(ii)/PH2-1 | b | RG3-1 | A (lean) | — |
| 29 | John Frieda Lockencreme Traumlocken (Frizz Ease Traumlocken Definierende Locken-Creme) (`john-frieda-frizz-ease-traumlocken-lockencreme`) | tail_markers | T_S caprylhydroxamic acid r14 unresolved; T_LI phenoxyethanol r24 vacuous | provisional_boundary · pending_leave_in_addendum · ruled D7 naming; letter 3.4(iii) -> D6 unresolved · owner_named_D7_curl_cream_held | T_S caprylhydroxamic acid r14 unresolved; T_LI phenoxyethanol r24 plausible | provisional_boundary · pending_leave_in_addendum · 4.3/D6-or-D7/4.5/PH2-2 | a | E3-2 | A | — |
| 30 | John Frieda Frizz Ease Zauberformel Seiden-Finish Creme (`john-frieda-frizz-ease-zauberformel-seiden-finish-creme`) | promise_class | styling_result | styling · 3.4(ii) · styling_direct_dry_hair_anti_frizz_R1-Q2 | not_assigned | provisional_boundary · evidence_gate · 4.1 | c | P3-3 | A | — |
| 31 | John Frieda Frizz Ease Zauberformel Seiden-Finish Creme (`john-frieda-frizz-ease-zauberformel-seiden-finish-creme`) | route | styling | styling · 3.4(ii) · styling_direct_dry_hair_anti_frizz_R1-Q2 | provisional_boundary | provisional_boundary · evidence_gate · 4.1 | c | P3-3 | A | — |
| 32 | John Frieda Frizz Ease Zauberformel Seiden-Finish Creme (`john-frieda-frizz-ease-zauberformel-seiden-finish-creme`) | reason_code | 3.4(ii) | styling · 3.4(ii) · styling_direct_dry_hair_anti_frizz_R1-Q2 | evidence_gate | provisional_boundary · evidence_gate · 4.1 | c | P3-3 | A | — |
| 33 | John Frieda Frizz Ease Zauberformel Seiden-Finish Creme (`john-frieda-frizz-ease-zauberformel-seiden-finish-creme`) | subtype | shine_finish | styling · 3.4(ii) · styling_direct_dry_hair_anti_frizz_R1-Q2 | — | provisional_boundary · evidence_gate · 4.1 | c | P3-3 | A | — |
| 34 | John Frieda Frizz Ease Zauberformel Seiden-Finish Creme (`john-frieda-frizz-ease-zauberformel-seiden-finish-creme`) | result_mechanisms | fixative_film, silicone_coat, wax_lipid | styling · 3.4(ii) · styling_direct_dry_hair_anti_frizz_R1-Q2 | — | provisional_boundary · evidence_gate · 4.1 | c | P3-3 | A | — |
| 35 | John Frieda Frizz Ease Zauberformel Seiden-Finish Creme (`john-frieda-frizz-ease-zauberformel-seiden-finish-creme`) | hold_route | present | styling · 3.4(ii) · styling_direct_dry_hair_anti_frizz_R1-Q2 | — | provisional_boundary · evidence_gate · 4.1 | c | P3-3 | A | — |
| 36 | John Frieda Frizz Ease Zauberformel Seiden-Finish Creme (`john-frieda-frizz-ease-zauberformel-seiden-finish-creme`) | weight | rich | styling · 3.4(ii) · styling_direct_dry_hair_anti_frizz_R1-Q2 | — | provisional_boundary · evidence_gate · 4.1 | c | P3-3 | A | — |
| 37 | John Frieda Frizz Ease Zauberformel Seiden-Finish Creme (`john-frieda-frizz-ease-zauberformel-seiden-finish-creme`) | alcohol_note | does_not_fire | styling · 3.4(ii) · styling_direct_dry_hair_anti_frizz_R1-Q2 | — | provisional_boundary · evidence_gate · 4.1 | c | P3-3 | A | — |
| 38 | John Frieda Frizz Ease Zauberformel Seiden-Finish Creme (`john-frieda-frizz-ease-zauberformel-seiden-finish-creme`) | buildup_note | fires | styling · 3.4(ii) · styling_direct_dry_hair_anti_frizz_R1-Q2 | — | provisional_boundary · evidence_gate · 4.1 | c | P3-3 | A | — |
| 39 | John Frieda Frizz Ease Zauberformel Seiden-Finish Creme (`john-frieda-frizz-ease-zauberformel-seiden-finish-creme`) | provides_heat_protection | false | styling · 3.4(ii) · styling_direct_dry_hair_anti_frizz_R1-Q2 | — | provisional_boundary · evidence_gate · 4.1 | c | P3-3 | A | — |
| 40 | John Frieda Frizz Ease Zauberformel Seiden-Finish Creme (`john-frieda-frizz-ease-zauberformel-seiden-finish-creme`) | application_moment | dry_finish | styling · 3.4(ii) · styling_direct_dry_hair_anti_frizz_R1-Q2 | — | provisional_boundary · evidence_gate · 4.1 | c | P3-3 | A | — |
| 41 | John Frieda Frizz Ease Zauberformel Seiden-Finish Creme (`john-frieda-frizz-ease-zauberformel-seiden-finish-creme`) | target_zone | all | styling · 3.4(ii) · styling_direct_dry_hair_anti_frizz_R1-Q2 | — | provisional_boundary · evidence_gate · 4.1 | c | P3-3 | A | — |
| 42 | John Frieda Frizz Ease Zauberformel Seiden-Finish Creme (`john-frieda-frizz-ease-zauberformel-seiden-finish-creme`) | heat_activated | no | styling · 3.4(ii) · styling_direct_dry_hair_anti_frizz_R1-Q2 | — | provisional_boundary · evidence_gate · 4.1 | c | P3-3 | A | — |
| 43 | John Frieda Frizz Ease Zauberformel Seiden-Finish Creme (`john-frieda-frizz-ease-zauberformel-seiden-finish-creme`) | flexibility | unbekannt | styling · 3.4(ii) · styling_direct_dry_hair_anti_frizz_R1-Q2 | — | provisional_boundary · evidence_gate · 4.1 | c | P3-3 | A | — |
| 44 | John Frieda Frizz Ease Zauberformel Seiden-Finish Creme (`john-frieda-frizz-ease-zauberformel-seiden-finish-creme`) | finish | glänzend | styling · 3.4(ii) · styling_direct_dry_hair_anti_frizz_R1-Q2 | — | provisional_boundary · evidence_gate · 4.1 | c | P3-3 | A | — |
| 45 | John Frieda Frizz Ease Zauberformel Seiden-Finish Creme (`john-frieda-frizz-ease-zauberformel-seiden-finish-creme`) | primary_job | frizz_control | styling · 3.4(ii) · styling_direct_dry_hair_anti_frizz_R1-Q2 | — | provisional_boundary · evidence_gate · 4.1 | c | P3-3 | A | — |
| 46 | John Frieda Frizz Ease Zauberformel Seiden-Finish Creme (`john-frieda-frizz-ease-zauberformel-seiden-finish-creme`) | d8b_flags | [] | styling · 3.4(ii) · styling_direct_dry_hair_anti_frizz_R1-Q2 | — | provisional_boundary · evidence_gate · 4.1 | c | P3-3 | A | — |
| 47 | John Frieda Haarserum Frizz Ease Der Bändiger (Extra Strong Serum) (`john-frieda-haarserum-frizz-ease-der-baendiger`) | reason_code | 4.6_owner_named | oil · ruled D2 (registry); letter 3.5 · owner_named_route_D2_oil | 3.1 | oil · oil_name · 4.3/3.1/D2 | d | RG3-3 | — | — |
| 48 | John Frieda Volume Lift Ansatz-Booster (`john-frieda-volume-lift-ansatz-booster`) | identity_status | provisional_formula_conflict | provisional_boundary · formula_conflict · formula_conflict_two_inci_lists_no_t18_convergence | verified | styling · direct_styling · 4.3/3.4(ii) | a | E3-1 | A | — |
| 49 | John Frieda Volume Lift Ansatz-Booster (`john-frieda-volume-lift-ansatz-booster`) | promise_class | not_assigned | provisional_boundary · formula_conflict · formula_conflict_two_inci_lists_no_t18_convergence | styling_result | styling · direct_styling · 4.3/3.4(ii) | a | E3-1 | A | — |
| 50 | John Frieda Volume Lift Ansatz-Booster (`john-frieda-volume-lift-ansatz-booster`) | route | provisional_boundary | provisional_boundary · formula_conflict · formula_conflict_two_inci_lists_no_t18_convergence | styling | styling · direct_styling · 4.3/3.4(ii) | a | E3-1 | A | — |
| 51 | John Frieda Volume Lift Ansatz-Booster (`john-frieda-volume-lift-ansatz-booster`) | reason_code | formula_conflict | provisional_boundary · formula_conflict · formula_conflict_two_inci_lists_no_t18_convergence | 3.4(ii) | styling · direct_styling · 4.3/3.4(ii) | a | E3-1 | A | — |
| 52 | John Frieda Volume Lift Ansatz-Booster (`john-frieda-volume-lift-ansatz-booster`) | subtype | — | provisional_boundary · formula_conflict · formula_conflict_two_inci_lists_no_t18_convergence | blowdry_lotion | styling · direct_styling · 4.3/3.4(ii) | a | E3-1 | A | — |
| 53 | John Frieda Volume Lift Ansatz-Booster (`john-frieda-volume-lift-ansatz-booster`) | result_mechanisms | — | provisional_boundary · formula_conflict · formula_conflict_two_inci_lists_no_t18_convergence | none | styling · direct_styling · 4.3/3.4(ii) | a | E3-1 | A | — |
| 54 | John Frieda Volume Lift Ansatz-Booster (`john-frieda-volume-lift-ansatz-booster`) | hold_route | — | provisional_boundary · formula_conflict · formula_conflict_two_inci_lists_no_t18_convergence | ambiguous | styling · direct_styling · 4.3/3.4(ii) | a | E3-1 | A | — |
| 55 | John Frieda Volume Lift Ansatz-Booster (`john-frieda-volume-lift-ansatz-booster`) | weight | — | provisional_boundary · formula_conflict · formula_conflict_two_inci_lists_no_t18_convergence | medium | styling · direct_styling · 4.3/3.4(ii) | a | E3-1 | A | — |
| 56 | John Frieda Volume Lift Ansatz-Booster (`john-frieda-volume-lift-ansatz-booster`) | alcohol_note | — | provisional_boundary · formula_conflict · formula_conflict_two_inci_lists_no_t18_convergence | fires | styling · direct_styling · 4.3/3.4(ii) | a | E3-1 | A | — |
| 57 | John Frieda Volume Lift Ansatz-Booster (`john-frieda-volume-lift-ansatz-booster`) | buildup_note | — | provisional_boundary · formula_conflict · formula_conflict_two_inci_lists_no_t18_convergence | fires | styling · direct_styling · 4.3/3.4(ii) | a | E3-1 | A | — |
| 58 | John Frieda Volume Lift Ansatz-Booster (`john-frieda-volume-lift-ansatz-booster`) | provides_heat_protection | — | provisional_boundary · formula_conflict · formula_conflict_two_inci_lists_no_t18_convergence | false | styling · direct_styling · 4.3/3.4(ii) | a | E3-1 | A | — |
| 59 | John Frieda Volume Lift Ansatz-Booster (`john-frieda-volume-lift-ansatz-booster`) | application_moment | — | provisional_boundary · formula_conflict · formula_conflict_two_inci_lists_no_t18_convergence | before_heat | styling · direct_styling · 4.3/3.4(ii) | a | E3-1 | A | — |
| 60 | John Frieda Volume Lift Ansatz-Booster (`john-frieda-volume-lift-ansatz-booster`) | target_zone | — | provisional_boundary · formula_conflict · formula_conflict_two_inci_lists_no_t18_convergence | roots | styling · direct_styling · 4.3/3.4(ii) | a | E3-1 | A | — |
| 61 | John Frieda Volume Lift Ansatz-Booster (`john-frieda-volume-lift-ansatz-booster`) | heat_activated | — | provisional_boundary · formula_conflict · formula_conflict_two_inci_lists_no_t18_convergence | no | styling · direct_styling · 4.3/3.4(ii) | a | E3-1 | A | — |
| 62 | John Frieda Volume Lift Ansatz-Booster (`john-frieda-volume-lift-ansatz-booster`) | flexibility | — | provisional_boundary · formula_conflict · formula_conflict_two_inci_lists_no_t18_convergence | unbekannt | styling · direct_styling · 4.3/3.4(ii) | a | E3-1 | A | — |
| 63 | John Frieda Volume Lift Ansatz-Booster (`john-frieda-volume-lift-ansatz-booster`) | finish | — | provisional_boundary · formula_conflict · formula_conflict_two_inci_lists_no_t18_convergence | unbekannt | styling · direct_styling · 4.3/3.4(ii) | a | E3-1 | A | — |
| 64 | John Frieda Volume Lift Ansatz-Booster (`john-frieda-volume-lift-ansatz-booster`) | primary_job | — | provisional_boundary · formula_conflict · formula_conflict_two_inci_lists_no_t18_convergence | volume | styling · direct_styling · 4.3/3.4(ii) | a | E3-1 | A | — |
| 65 | John Frieda Volume Lift Ansatz-Booster (`john-frieda-volume-lift-ansatz-booster`) | d8b_flags | — | provisional_boundary · formula_conflict · formula_conflict_two_inci_lists_no_t18_convergence | [] | styling · direct_styling · 4.3/3.4(ii) | a | E3-1 | A | — |
| 66 | John Frieda Spray Volume Lift Pushed-up Dry Texture (`john-frieda-volume-lift-pushed-up-dry-texture-spray`) | tail_markers | T_S sodium benzoate r8 plausible; T_LI sodium benzoate r8 vacuous | styling · 3.5 · non_aqueous_texture_promise | T_S sodium benzoate r8 plausible; T_LI sodium benzoate r8 plausible | styling · direct_styling · 4.3/3.5 | a | E3-2 | A | — |
| 67 | Kevin.Murphy Killer.Curls (Leave-in Anti-Frizz Creme) (`kevin-murphy-killer-curls`) | weight | rich | provisional_boundary · pending_leave_in_addendum · 3.4(i) D7 · d7_curl_cream_held_ph1-16 | medium | provisional_boundary · pending_leave_in_addendum · 4.3/D6-or-D7/4.5/PH2-2 | a | E3-6 | A | — |
| 68 | Kevin.Murphy Killer.Curls (Leave-in Anti-Frizz Creme) (`kevin-murphy-killer-curls`) | buildup_note | fires | provisional_boundary · pending_leave_in_addendum · 3.4(i) D7 · d7_curl_cream_held_ph1-16 | does_not_fire | provisional_boundary · pending_leave_in_addendum · 4.3/D6-or-D7/4.5/PH2-2 | a | E3-6 | A | — |
| 69 | Kevin.Murphy Killer.Curls (Leave-in Anti-Frizz Creme) (`kevin-murphy-killer-curls`) | primary_job | hold_fix | provisional_boundary · pending_leave_in_addendum · 3.4(i) D7 · d7_curl_cream_held_ph1-16 | definition | provisional_boundary · pending_leave_in_addendum · 4.3/D6-or-D7/4.5/PH2-2 | b | RG3-1 | A (lean) | — |
| 70 | Kevin.Murphy Powder.Puff Volume (`kevin-murphy-powder-puff-volume`) | identity_status | provisional_formula_conflict | provisional_boundary · formula_conflict · formula_conflict_two_inci_lists_no_t18_convergence | verified | styling · direct_styling · 4.3/3.4(ii) | a | E3-1 | A | — |
| 71 | Kevin.Murphy Powder.Puff Volume (`kevin-murphy-powder-puff-volume`) | promise_class | not_assigned | provisional_boundary · formula_conflict · formula_conflict_two_inci_lists_no_t18_convergence | styling_result | styling · direct_styling · 4.3/3.4(ii) | a | E3-1 | A | — |
| 72 | Kevin.Murphy Powder.Puff Volume (`kevin-murphy-powder-puff-volume`) | route | provisional_boundary | provisional_boundary · formula_conflict · formula_conflict_two_inci_lists_no_t18_convergence | styling | styling · direct_styling · 4.3/3.4(ii) | a | E3-1 | A | — |
| 73 | Kevin.Murphy Powder.Puff Volume (`kevin-murphy-powder-puff-volume`) | reason_code | formula_conflict | provisional_boundary · formula_conflict · formula_conflict_two_inci_lists_no_t18_convergence | 3.4(ii) | styling · direct_styling · 4.3/3.4(ii) | a | E3-1 | A | — |
| 74 | Kevin.Murphy Powder.Puff Volume (`kevin-murphy-powder-puff-volume`) | subtype | — | provisional_boundary · formula_conflict · formula_conflict_two_inci_lists_no_t18_convergence | hair_powder | styling · direct_styling · 4.3/3.4(ii) | a | E3-1 | A | — |
| 75 | Kevin.Murphy Powder.Puff Volume (`kevin-murphy-powder-puff-volume`) | result_mechanisms | — | provisional_boundary · formula_conflict · formula_conflict_two_inci_lists_no_t18_convergence | fixative_film, particulate | styling · direct_styling · 4.3/3.4(ii) | a | E3-1 | A | — |
| 76 | Kevin.Murphy Powder.Puff Volume (`kevin-murphy-powder-puff-volume`) | hold_route | — | provisional_boundary · formula_conflict · formula_conflict_two_inci_lists_no_t18_convergence | present | styling · direct_styling · 4.3/3.4(ii) | a | E3-1 | A | — |
| 77 | Kevin.Murphy Powder.Puff Volume (`kevin-murphy-powder-puff-volume`) | weight | — | provisional_boundary · formula_conflict · formula_conflict_two_inci_lists_no_t18_convergence | light | styling · direct_styling · 4.3/3.4(ii) | a | E3-1 | A | — |
| 78 | Kevin.Murphy Powder.Puff Volume (`kevin-murphy-powder-puff-volume`) | alcohol_note | — | provisional_boundary · formula_conflict · formula_conflict_two_inci_lists_no_t18_convergence | does_not_fire | styling · direct_styling · 4.3/3.4(ii) | a | E3-1 | A | — |
| 79 | Kevin.Murphy Powder.Puff Volume (`kevin-murphy-powder-puff-volume`) | buildup_note | — | provisional_boundary · formula_conflict · formula_conflict_two_inci_lists_no_t18_convergence | does_not_fire | styling · direct_styling · 4.3/3.4(ii) | a | E3-1 | A | — |
| 80 | Kevin.Murphy Powder.Puff Volume (`kevin-murphy-powder-puff-volume`) | provides_heat_protection | — | provisional_boundary · formula_conflict · formula_conflict_two_inci_lists_no_t18_convergence | false | styling · direct_styling · 4.3/3.4(ii) | a | E3-1 | A | — |
| 81 | Kevin.Murphy Powder.Puff Volume (`kevin-murphy-powder-puff-volume`) | application_moment | — | provisional_boundary · formula_conflict · formula_conflict_two_inci_lists_no_t18_convergence | damp_before_drying | styling · direct_styling · 4.3/3.4(ii) | a | E3-1 | A | — |
| 82 | Kevin.Murphy Powder.Puff Volume (`kevin-murphy-powder-puff-volume`) | target_zone | — | provisional_boundary · formula_conflict · formula_conflict_two_inci_lists_no_t18_convergence | roots | styling · direct_styling · 4.3/3.4(ii) | a | E3-1 | A | — |
| 83 | Kevin.Murphy Powder.Puff Volume (`kevin-murphy-powder-puff-volume`) | heat_activated | — | provisional_boundary · formula_conflict · formula_conflict_two_inci_lists_no_t18_convergence | no | styling · direct_styling · 4.3/3.4(ii) | a | E3-1 | A | — |
| 84 | Kevin.Murphy Powder.Puff Volume (`kevin-murphy-powder-puff-volume`) | hold_level | — | provisional_boundary · formula_conflict · formula_conflict_two_inci_lists_no_t18_convergence | 1 | styling · direct_styling · 4.3/3.4(ii) | a | E3-1 | A | — |
| 85 | Kevin.Murphy Powder.Puff Volume (`kevin-murphy-powder-puff-volume`) | flexibility | — | provisional_boundary · formula_conflict · formula_conflict_two_inci_lists_no_t18_convergence | unbekannt | styling · direct_styling · 4.3/3.4(ii) | a | E3-1 | A | — |
| 86 | Kevin.Murphy Powder.Puff Volume (`kevin-murphy-powder-puff-volume`) | finish | — | provisional_boundary · formula_conflict · formula_conflict_two_inci_lists_no_t18_convergence | unbekannt | styling · direct_styling · 4.3/3.4(ii) | a | E3-1 | A | — |
| 87 | Kevin.Murphy Powder.Puff Volume (`kevin-murphy-powder-puff-volume`) | primary_job | — | provisional_boundary · formula_conflict · formula_conflict_two_inci_lists_no_t18_convergence | volume | styling · direct_styling · 4.3/3.4(ii) | a | E3-1 | A | — |
| 88 | Kevin.Murphy Powder.Puff Volume (`kevin-murphy-powder-puff-volume`) | d8b_flags | — | provisional_boundary · formula_conflict · formula_conflict_two_inci_lists_no_t18_convergence | [] | styling · direct_styling · 4.3/3.4(ii) | a | E3-1 | A | — |
| 89 | KMS Thermashape 2-in-1 Spray (`kms-thermashape-2-in-1-spray`) | heat_activated | no | styling · 3.5 · non_aqueous_styling_result | yes | styling · non_aqueous_styling · 4.3/3.5/5/RG2-15 | a | E3-4 | A | — |
| 90 | KMS Thermashape 2-in-1 Spray (`kms-thermashape-2-in-1-spray`) | hold_level | 4 | styling · 3.5 · non_aqueous_styling_result | — | styling · non_aqueous_styling · 4.3/3.5/5/RG2-15 | b | RG3-9 | A (lean) | — |
| 91 | KMS Thermashape Straightening Creme (`kms-thermashape-straightening-creme`) | tail_markers | T_S benzoic acid r16 plausible; T_LI benzoic acid r16 vacuous | leave_in · 3.4(iii) · li_g0_in_category_d6_not_fired | T_S benzoic acid r16 plausible; T_LI benzoic acid r16 plausible | provisional_boundary · li_g0_provisional · 4.3/3.4(iii)/LI2.3.2 | a | E3-2 | A | — |
| 92 | KMS Thermashape Straightening Creme (`kms-thermashape-straightening-creme`) | route | leave_in | leave_in · 3.4(iii) · li_g0_in_category_d6_not_fired | provisional_boundary | provisional_boundary · li_g0_provisional · 4.3/3.4(iii)/LI2.3.2 | d | RG3-5 | — | — |
| 93 | KMS Thermashape Straightening Creme (`kms-thermashape-straightening-creme`) | reason_code | 3.4(iii)_in_category | leave_in · 3.4(iii) · li_g0_in_category_d6_not_fired | li_g0_provisional | provisional_boundary · li_g0_provisional · 4.3/3.4(iii)/LI2.3.2 | d | RG3-5 | — | — |
| 94 | L'ORÉAL PARiS ELVITAL Haaröl Öl Magique, für alle Haartypen (`loreal-elvital-haaroel-oel-magique-alle-haartypen`) | reason_code | 4.6_owner_named | oil · ruled D2 (registry); letter 3.5 · owner_named_route_D2_oil | 3.1 | oil · oil_name · 4.3/3.1/D2 | d | RG3-3 | — | — |
| 95 | L'ORÉAL PARiS ELVITAL Volumenspray Big Hair Day (Erfrischendes Volumen Spray) (`loreal-paris-elvital-big-hair-day-erfrischendes-volumenspray`) | tail_markers | T_S dimethyl phenethyl acetate r10 unresolved; T_LI benzyl alcohol r13 plausible | dry_shampoo · 3.2 · refresh_plus_volume_tie_dry_shampoo | T_S limonene r11 unresolved; T_LI benzyl alcohol r13 plausible | dry_shampoo · refresh_first · 4.3/3.2 | a | E3-3 | A | — |
| 96 | Maria Nila Curlicue Cream (Stylingcreme) (`maria-nila-curlicue-cream`) | promise_class | styling_result | styling · 3.4(iii) · li_g0_excluded_styling_first_T15 | mixed | styling · owner_ruled_styling_first · 4.6/D3/T15/R1-Q3 | b | RG3-12 | — | — |
| 97 | Maria Nila Curlicue Cream (Stylingcreme) (`maria-nila-curlicue-cream`) | reason_code | 3.4(iii)_excluded_styling_first | styling · 3.4(iii) · li_g0_excluded_styling_first_T15 | 4.6_owner_named | styling · owner_ruled_styling_first · 4.6/D3/T15/R1-Q3 | b | RG3-14 | — | — |
| 98 | Moroccanoil Textur- & Volumenpuder fürs Haar (Texture & Volume Hair Powder) (`moroccanoil-textur-und-volumenpuder`) | tail_markers | T_S parfum r5 plausible; T_LI sodium benzoate r7 vacuous | styling · 3.4(ii) · styling_direct_volume_promise | T_S parfum r5 plausible; T_LI sodium benzoate r7 plausible | styling · direct_styling · 4.3/3.4(ii)/PH2-1 | a | E3-2 | A | — |
| 99 | Schwarzkopf Professional OSiS Dust It (`osis-dust-it`) | application_moment | dry_restyle | styling · 3.4(ii) · styling_direct_volume_promise | dry_finish | styling · direct_styling · 4.3/3.4(ii)/PH2-1 | b | RG3-7 | A (lean) | — |
| 100 | Schwarzkopf Professional OSiS Sparkler (`osis-sparkler`) | d8b_flags | [] | styling · 3.5 · non_aqueous_shine_lead | claim_formula_conflict | styling · direct_styling · 4.3/3.5 | b | RG3-11 | A (lean) | — |
| 101 | Redken Wax Spray (Redken Spray Wax) (`redken-wax-spray`) | subtype | molding | styling · 3.5 · non_aqueous_styling_result | texture_spray | styling · direct_styling · 4.3/3.5 | b | RG3-1 | B (lean) | possible |
| 102 | Redken Wax Spray (Redken Spray Wax) (`redken-wax-spray`) | primary_job | hold_fix | styling · 3.5 · non_aqueous_styling_result | texture | styling · direct_styling · 4.3/3.5 | b | RG3-1 | B (lean) | possible |
| 103 | Schwarzkopf taft Föhn-Spray VOLUMEN Halt 3 (`schwarzkopf-taft-foehn-spray-volumen-halt-3`) | tail_markers | T_S parfum r6 plausible; T_LI benzyl alcohol r8 plausible | styling · 3.4(ii) · styling_direct_volume_promise | T_S parfum r6 plausible; T_LI null rnull none_visible | styling · direct_styling · 4.3/3.4(ii)/PH2-1 | b | RG3-6 | B (lean) | — |
| 104 | Schwarzkopf taft Haarpuder VOLUMEN (`schwarzkopf-taft-haarpuder-volumen`) | tail_markers | T_S sodium benzoate r3 plausible; T_LI sodium benzoate r3 vacuous | styling · 3.4(ii) · styling_direct_volume_promise | T_S sodium benzoate r3 plausible; T_LI sodium benzoate r3 plausible | styling · direct_styling · 4.3/3.4(ii)/PH2-1 | a | E3-2 | A | — |
| 105 | Schwarzkopf taft Texturspray Aloe Boost (`schwarzkopf-taft-texturspray-aloe-boost`) | tail_markers | T_S parfum r13 plausible; T_LI benzyl alcohol r15 vacuous | styling · 3.5 · non_aqueous_texture_promise | T_S parfum r13 plausible; T_LI sodium benzoate r18 vacuous | provisional_boundary · mixed_promise · 4.2/R2-Q1 | b | RG3-6 | B (lean) | — |
| 106 | Schwarzkopf taft Texturspray Aloe Boost (`schwarzkopf-taft-texturspray-aloe-boost`) | promise_class | styling_result | styling · 3.5 · non_aqueous_texture_promise | mixed | provisional_boundary · mixed_promise · 4.2/R2-Q1 | d | RG3-2 | — | possible |
| 107 | Schwarzkopf taft Texturspray Aloe Boost (`schwarzkopf-taft-texturspray-aloe-boost`) | route | styling | styling · 3.5 · non_aqueous_texture_promise | provisional_boundary | provisional_boundary · mixed_promise · 4.2/R2-Q1 | d | RG3-2 | — | possible |
| 108 | Schwarzkopf taft Texturspray Aloe Boost (`schwarzkopf-taft-texturspray-aloe-boost`) | reason_code | 3.5 | styling · 3.5 · non_aqueous_texture_promise | mixed_promise | provisional_boundary · mixed_promise · 4.2/R2-Q1 | d | RG3-2 | — | possible |
| 109 | Schwarzkopf taft Texturspray Aloe Boost (`schwarzkopf-taft-texturspray-aloe-boost`) | subtype | texture_spray | styling · 3.5 · non_aqueous_texture_promise | — | provisional_boundary · mixed_promise · 4.2/R2-Q1 | d | RG3-2 | — | possible |
| 110 | Schwarzkopf taft Texturspray Aloe Boost (`schwarzkopf-taft-texturspray-aloe-boost`) | result_mechanisms | fixative_film, particulate | styling · 3.5 · non_aqueous_texture_promise | — | provisional_boundary · mixed_promise · 4.2/R2-Q1 | d | RG3-2 | — | possible |
| 111 | Schwarzkopf taft Texturspray Aloe Boost (`schwarzkopf-taft-texturspray-aloe-boost`) | hold_route | present | styling · 3.5 · non_aqueous_texture_promise | — | provisional_boundary · mixed_promise · 4.2/R2-Q1 | d | RG3-2 | — | possible |
| 112 | Schwarzkopf taft Texturspray Aloe Boost (`schwarzkopf-taft-texturspray-aloe-boost`) | weight | medium | styling · 3.5 · non_aqueous_texture_promise | — | provisional_boundary · mixed_promise · 4.2/R2-Q1 | d | RG3-2 | — | possible |
| 113 | Schwarzkopf taft Texturspray Aloe Boost (`schwarzkopf-taft-texturspray-aloe-boost`) | alcohol_note | fires | styling · 3.5 · non_aqueous_texture_promise | — | provisional_boundary · mixed_promise · 4.2/R2-Q1 | d | RG3-2 | — | possible |
| 114 | Schwarzkopf taft Texturspray Aloe Boost (`schwarzkopf-taft-texturspray-aloe-boost`) | buildup_note | fires | styling · 3.5 · non_aqueous_texture_promise | — | provisional_boundary · mixed_promise · 4.2/R2-Q1 | d | RG3-2 | — | possible |
| 115 | Schwarzkopf taft Texturspray Aloe Boost (`schwarzkopf-taft-texturspray-aloe-boost`) | provides_heat_protection | false | styling · 3.5 · non_aqueous_texture_promise | — | provisional_boundary · mixed_promise · 4.2/R2-Q1 | d | RG3-2 | — | possible |
| 116 | Schwarzkopf taft Texturspray Aloe Boost (`schwarzkopf-taft-texturspray-aloe-boost`) | application_moment | dry_finish | styling · 3.5 · non_aqueous_texture_promise | — | provisional_boundary · mixed_promise · 4.2/R2-Q1 | d | RG3-2 | — | possible |
| 117 | Schwarzkopf taft Texturspray Aloe Boost (`schwarzkopf-taft-texturspray-aloe-boost`) | target_zone | all | styling · 3.5 · non_aqueous_texture_promise | — | provisional_boundary · mixed_promise · 4.2/R2-Q1 | d | RG3-2 | — | possible |
| 118 | Schwarzkopf taft Texturspray Aloe Boost (`schwarzkopf-taft-texturspray-aloe-boost`) | heat_activated | no | styling · 3.5 · non_aqueous_texture_promise | — | provisional_boundary · mixed_promise · 4.2/R2-Q1 | d | RG3-2 | — | possible |
| 119 | Schwarzkopf taft Texturspray Aloe Boost (`schwarzkopf-taft-texturspray-aloe-boost`) | flexibility | unbekannt | styling · 3.5 · non_aqueous_texture_promise | — | provisional_boundary · mixed_promise · 4.2/R2-Q1 | d | RG3-2 | — | possible |
| 120 | Schwarzkopf taft Texturspray Aloe Boost (`schwarzkopf-taft-texturspray-aloe-boost`) | finish | unbekannt | styling · 3.5 · non_aqueous_texture_promise | — | provisional_boundary · mixed_promise · 4.2/R2-Q1 | d | RG3-2 | — | possible |
| 121 | Schwarzkopf taft Texturspray Aloe Boost (`schwarzkopf-taft-texturspray-aloe-boost`) | primary_job | texture | styling · 3.5 · non_aqueous_texture_promise | — | provisional_boundary · mixed_promise · 4.2/R2-Q1 | d | RG3-2 | — | possible |
| 122 | Schwarzkopf taft Texturspray Aloe Boost (`schwarzkopf-taft-texturspray-aloe-boost`) | d8b_flags | [] | styling · 3.5 · non_aqueous_texture_promise | — | provisional_boundary · mixed_promise · 4.2/R2-Q1 | d | RG3-2 | — | possible |
| 123 | syoss Curl Cream Gel (`syoss-curl-cream-gel-3in1`) | reason_code | 3.4(iii)_excluded_styling_first | styling · 3.4(iii) · li_g0_excluded_styling_first | 3.4(ii) | styling · direct_styling · 4.3/3.4(ii)/PH2-1 | a | E3-8 | A | — |
| 124 | syoss Hitzeschutzspray Keratin (`syoss-hitzeschutzspray-keratin-heat`) | promise_class | styling_result | provisional_boundary · li_g0_provisional · 3.4(iii) -> D6 unresolved · d6_care_limb_unresolved_unlisted_amino_silicone | heat_protection | heat_protectant · protection_first · 4.3/3.3 | d | RG3-3 | — | — |
| 125 | syoss Hitzeschutzspray Keratin (`syoss-hitzeschutzspray-keratin-heat`) | route | provisional_boundary | provisional_boundary · li_g0_provisional · 3.4(iii) -> D6 unresolved · d6_care_limb_unresolved_unlisted_amino_silicone | heat_protectant | heat_protectant · protection_first · 4.3/3.3 | d | RG3-3 | — | — |
| 126 | syoss Hitzeschutzspray Keratin (`syoss-hitzeschutzspray-keratin-heat`) | reason_code | li_g0_provisional | provisional_boundary · li_g0_provisional · 3.4(iii) -> D6 unresolved · d6_care_limb_unresolved_unlisted_amino_silicone | 3.3 | heat_protectant · protection_first · 4.3/3.3 | d | RG3-3 | — | — |
| 127 | Syoss Max Hold Wax (`syoss-professional-performance-max-hold-power-wax`) | application_moment | dry_restyle | styling · 3.4(ii) · styling_direct_hold_promise | dry_finish | styling · direct_styling · 4.3/3.4(ii) | b | RG3-7 | A (lean) | — |
| 128 | Schwarzkopf taft Styling Paste Forming Verformbare Styles (`taft-styling-paste-forming-halt-5plus`) | hold_level | 4 | styling · 3.4(ii) · styling_direct_shaping_promise | — | styling · direct_styling · 4.3/3.4(ii)/PH2-1 | b | RG3-10 | A (lean) | — |
| 129 | Schwarzkopf taft Styling Paste Forming Verformbare Styles (`taft-styling-paste-forming-halt-5plus`) | neutral_fact | — | styling · 3.4(ii) · styling_direct_shaping_promise | enthält stylingpolymere (z. b. vp/va copolymer) | styling · direct_styling · 4.3/3.4(ii)/PH2-1 | b | RG3-10 | A (lean) | — |
| 130 | Schwarzkopf taft Hitzeschutzspray taft x Gliss Lovely Long (`taft-x-gliss-hitzeschutzspray-lovely-long`) | promise_class | mixed | heat_protectant · ruled (registry: taft x Gliss Hitzeschutzspray, charter 5.1); letter mixed · owner_named_route_heat_protectant_overrides_mixed | heat_protection | heat_protectant · protection_first · 4.6/4.3/3.3 | d | RG3-3 | — | — |
| 131 | Wella Professionals EIMI Glam Mist Shinespray (`wella-eimi-glam-mist-shine-spray`) | hold_level | 1 | styling · 3.5 · non_aqueous_shine_lead | — | styling · direct_styling · 4.3/3.5 | c | P3-2 | B (by the letter; data fix needed) | — |
| 132 | Wella Professionals EIMI Nutricurls Curl Shaper (Defining Gel Cream) (`wella-eimi-nutricurls-curl-shaper`) | promise_class | mixed | provisional_boundary · pending_leave_in_addendum · 3.4(i) D7 (PH1-12, before the mixed stop) · d7_curl_cream_held_ph1-16 | styling_result | provisional_boundary · pending_leave_in_addendum · 4.3/D6-or-D7/4.5/PH2-2 | b | RG3-12 | — | — |
| 133 | Wella Professionals EIMI Smooth Thermal Image (2-Phasen-Spray) (`wella-eimi-smooth-thermal-image`) | promise_class | mixed | provisional_boundary · mixed_promise · 4.2 mixed stop (D7 first) · mixed_protection_joined_with_care_and_smoothing_RG2-19 | heat_protection | heat_protectant · protection_first · 4.3/3.3 | b | RG3-4 | B (lean) | — |
| 134 | Wella Professionals EIMI Smooth Thermal Image (2-Phasen-Spray) (`wella-eimi-smooth-thermal-image`) | route | provisional_boundary | provisional_boundary · mixed_promise · 4.2 mixed stop (D7 first) · mixed_protection_joined_with_care_and_smoothing_RG2-19 | heat_protectant | heat_protectant · protection_first · 4.3/3.3 | b | RG3-4 | B (lean) | — |
| 135 | Wella Professionals EIMI Smooth Thermal Image (2-Phasen-Spray) (`wella-eimi-smooth-thermal-image`) | reason_code | mixed_promise | provisional_boundary · mixed_promise · 4.2 mixed stop (D7 first) · mixed_protection_joined_with_care_and_smoothing_RG2-19 | 3.3 | heat_protectant · protection_first · 4.3/3.3 | b | RG3-4 | B (lean) | — |
| 136 | Wella Professionals EIMI Volume Sugar Lift Volumenspray (`wella-eimi-sugar-lift`) | hold_level | 3 | styling · 3.4(ii) · styling_direct_volume_promise | — | styling · direct_styling · 4.3/3.4(ii)/PH2-1 | c | P3-2 | B (by the letter; data fix needed) | — |
| 137 | Wella Professionals EIMI Volume Sugar Lift Volumenspray (`wella-eimi-sugar-lift`) | neutral_fact | — | styling · 3.4(ii) · styling_direct_volume_promise | enthält stylingpolymere (z. b. vp/va copolymer) | styling · direct_styling · 4.3/3.4(ii)/PH2-1 | c | P3-2 | B (by the letter; data fix needed) | — |
| 138 | wellaflex Schaumfestiger Locken & Wellen, Starker Halt (`wellaflex-schaumfestiger-locken-und-wellen-starker-halt`) | reason_code | 3.4(iii)_excluded_styling_first | styling · 3.4(iii) · li_g0_excluded_styling_first | 3.4(ii) | styling · direct_styling · 4.3/3.4(ii)/PH2-1 | b | RG3-1 | A (lean) | — |

### T6. secondary_jobs disagreements (supplementary)

| Product | A | B | Root cause |
|---|---|---|---|
| `alcina-foehn-lotion` | [] | hold_fix | RG3-16 |
| `balea-finishing-spray-glow-und-care` | frizz_control | [] | RG3-16 |
| `balea-haargel-hair-jelly` | sleek | [] | cascade |
| `balea-overnight-wellenspray` | volume | hold_fix, volume | RG3-16 |
| `balea-professional-glow-und-shine-finishing-spray` | frizz_control | shine | cascade |
| `bali-curls-volumizing-curl-spray-refreshing` | refresh | volume | cascade |
| `got2b-styling-paste-istyler-texture-clay` | texture | [] | RG3-16 |
| `jean-und-len-sea-salt-spray` | volume | texture | cascade |
| `john-frieda-frizz-ease-zauberformel-seiden-finish-creme` | shine | — | cascade |
| `john-frieda-volume-lift-ansatz-booster` | — | [] | cascade |
| `kevin-murphy-killer-curls` | frizz_control | hold_fix | cascade |
| `kevin-murphy-powder-puff-volume` | — | hold_fix | cascade |
| `kms-thermashape-2-in-1-spray` | definition, hold_fix | hold_fix | RG3-16 |
| `loreal-men-expert-barber-club-styling-pomade` | [] | shine | RG3-16 |
| `loreal-paris-elnett-haarspray-extra-starker-halt` | [] | volume | RG3-16 |
| `moroccanoil-volumizing-spray` | hold_fix, texture | texture | RG3-16 |
| `redken-wax-spray` | texture, volume | hold_fix, volume | cascade |
| `schwarzkopf-taft-styling-balm-locken-halt-3` | frizz_control, hold_fix | hold_fix, volume | RG3-16 |
| `schwarzkopf-taft-texturspray-aloe-boost` | [] | — | cascade |
| `wella-eimi-glam-mist-shine-spray` | frizz_control | frizz_control, sleek | RG3-16 |
| `wella-eimi-sugar-lift` | hold_fix, texture | texture | RG3-16 |

### T7. Round 2 → round 3 on the 139 carried records

Round-2 core disagreements on these records: 157 (on 44 records); resolved in round 3: 146; persisting: 11; new in round 3: 122 (on 42 records). secondary_jobs: resolved 24, persisting 13, new 7.

| Persisting (core) | Field | Round-2 cause | Round-3 A | Round-3 B | Round-3 cause |
|---|---|---|---|---|---|
| `balea-leave-in-spray-sea-salt-care-define` | promise_class | RG2-1 | mixed | styling_result | E3-5 |
| `balea-professional-glow-und-shine-finishing-spray` | primary_job | P2-1 | shine | frizz_control | E3-10 |
| `bumble-and-bumble-brilliantine` | promise_class | E2-5 | not_assigned | styling_result | E3-7 |
| `color-wow-dream-coat-supernatural-spray` | promise_class | E2-5 | not_assigned | styling_result | E3-7 |
| `guhl-foehn-spray-langzeit-volumen` | heat_activated | E2-10 | no | yes | E3-4 |
| `john-frieda-frizz-ease-zauberformel-seiden-finish-creme` | application_moment | RG2-8 | dry_finish | — | P3-3 |
| `john-frieda-frizz-ease-zauberformel-seiden-finish-creme` | target_zone | RG2-10 | all | — | P3-3 |
| `john-frieda-frizz-ease-zauberformel-seiden-finish-creme` | primary_job | RG2-7 | frizz_control | — | P3-3 |
| `kevin-murphy-killer-curls` | weight | E2-7 | rich | medium | E3-6 |
| `kevin-murphy-killer-curls` | buildup_note | E2-7 | fires | does_not_fire | E3-6 |
| `osis-sparkler` | d8b_flags | P2-1 | [] | claim_formula_conflict | RG3-11 |

| Resolved round-2 cause | Cells |
|---|---|
| E2-1 | 16 |
| E2-11 | 1 |
| E2-12 | 1 |
| E2-2 | 6 |
| E2-3 | 3 |
| E2-4 | 1 |
| E2-5 | 1 |
| E2-6 | 1 |
| E2-8 | 1 |
| E2-9 | 1 |
| P2-1 | 52 |
| P2-2 | 18 |
| P2-4 | 2 |
| P2-5 | 2 |
| RG2-1 | 19 |
| RG2-10 | 5 |
| RG2-11 | 2 |
| RG2-12 | 1 |
| RG2-13 | 1 |
| RG2-14 | 1 |
| RG2-2 | 2 |
| RG2-4 | 1 |
| RG2-5 | 3 |
| RG2-6 | 1 |
| RG2-8 | 2 |
| RG2-9 | 2 |

| New round-3 cause | Cells |
|---|---|
| E3-1 | 39 |
| E3-2 | 5 |
| E3-3 | 1 |
| E3-7 | 3 |
| E3-8 | 1 |
| E3-9 | 1 |
| P3-2 | 3 |
| P3-3 | 16 |
| RG3-1 | 9 |
| RG3-10 | 2 |
| RG3-12 | 2 |
| RG3-13 | 2 |
| RG3-14 | 1 |
| RG3-2 | 17 |
| RG3-3 | 7 |
| RG3-4 | 3 |
| RG3-6 | 6 |
| RG3-7 | 3 |
| RG3-8 | 1 |

### T8. Did each round-2 ruling / fix reach its products? (both lanes' round-3 values vs the ruled outcome)

| Ruling | Product | Ruled | A | B | Effect |
|---|---|---|---|---|---|
| R2-Q1 | `redken-refreshing-curl-mist` | route provisional_boundary; reason_code pending_leave_in_addendum; subtype refresher | ✓; ✓; ✓ | ✓; ✓; ✓ | both |
| R2-Q1 | `balea-leave-in-spray-sea-salt-care-define` | promise_class mixed; reason_code pending_leave_in_addendum; subtype salt_spray | ✓; ✓; ✓ | styling_result; ✓; ✓ | **one lane** |
| R2-Q1 | `moroccanoil-glaettende-creme-smoothing-lotion` | promise_class mixed; reason_code mixed_promise | ✓; ✓ | ✓; ✓ | both |
| R2-Q1 | `garnier-fructis-locken-methode-feuchtigkeitsboost-pflege-spray` | reason_code mixed_promise | ✓ | ✓ | both |
| R2-Q1 | `guhl-styling-spray-locken-pflege-und-styling-2in1` | reason_code mixed_promise | ✓ | ✓ | both |
| R2-Q2 | `balea-haarserum-anti-frizz-glatt-und-glossy` | route leave_in | ✓ | ✓ | both |
| R2-Q3 | `osis-sparkler` | route styling; subtype shine_finish; primary_job shine | ✓; ✓; ✓ | ✓; ✓; ✓ | both |
| R2-Q3 | `balea-finishing-spray-glow-und-care` | route styling; subtype shine_finish | ✓; ✓ | ✓; ✓ | both |
| R2-Q3 | `schwarzkopf-taft-x-gliss-silky-shine-shine-coat` | promise_class styling_result; route styling; subtype shine_finish | ✓; ✓; ✓ | ✓; ✓; ✓ | both |
| R2-Q3 | `got2b-gotgloss-glanz-spray` | route styling; subtype shine_finish | ✓; ✓ | ✓; ✓ | both |
| R2-Q3 | `balea-professional-glow-und-shine-finishing-spray` | primary_job shine | ✓ | frizz_control | **one lane** |
| R2-Q3 | `balea-styling-finishing-stick` | primary_job frizz_control | ✓ | ✓ | both |
| R2-Q3 | `wella-eimi-glam-mist-shine-spray` | reason_code 3.5; subtype shine_finish | ✓; ✓ | ✓; ✓ | both |
| R2-Q4 | `neqi-diamond-glass-styling-spray-all` | route leave_in | ✓ | ✓ | both |
| R2-H1 | `wella-eimi-nutricurls-fresh-up` | route leave_in | ✓ | ✓ | both |
| R2-H2 | `guhl-locken-pflege-und-styling-3in1` | route provisional_boundary; subtype — | ✓; ✓ | ✓; ✓ | both |
| R2-H3 | `balea-haarwachs-styling-stick` | route styling; subtype molding | ✓; ✓ | ✓; ✓ | both |
| R2-H4 | `neqi-diamond-glass-styling-spray-all` | reason_code 4.6_owner_named | ✓ | ✓ | both |
| R2-H5 | `balea-professional-styling-cream-traumlocken` | route provisional_boundary; reason_code pending_leave_in_addendum; subtype curl_cream | ✓; ✓; ✓ | ✓; ✓; ✓ | both |
| R2-H6 | `kevin-murphy-killer-curls` | route provisional_boundary; reason_code pending_leave_in_addendum; subtype curl_cream | ✓; ✓; ✓ | ✓; ✓; ✓ | both |
| R2-H6 | `kevin-murphy-powder-puff-volume` | reason_code formula_conflict | ✓ | 3.4(ii) | **one lane** |
| R2-H6 | `evo-head-mistress-cuticle-sealer` | reason_code evidence_gate | ✓ | ✓ | both |
| R2-H6 | `redken-one-united-all-in-one-multi-benefit-treatment` | route leave_in | ✓ | ✓ | both |
| RG2-4 | `syoss-professional-performance-max-hold-power-wax` | primary_job hold_fix | ✓ | ✓ | both |
| RG2-5 | `syoss-curl-cream-gel-3in1` | primary_job definition; reason_code 3.4(iii)_excluded_styling_first | ✓; ✓ | ✓; 3.4(ii) | **one lane** |
| RG2-5 | `wella-eimi-nutricurls-curl-shaper` | primary_job definition | ✓ | ✓ | both |
| RG2-6 | `alcina-foehn-lotion` | primary_job volume | ✓ | ✓ | both |
| RG2-7 | `john-frieda-frizz-ease-zauberformel-seiden-finish-creme` | primary_job frizz_control | ✓ | — | **one lane** |
| RG2-8 | `alverde-locken-refresh-spray` | application_moment dry_finish | ✓ | ✓ | both |
| RG2-8 | `john-frieda-frizz-ease-zauberformel-seiden-finish-creme` | application_moment dry_finish | ✓ | — | **one lane** |
| RG2-9 | `redken-powder-grip-03` | application_moment dry_restyle | ✓ | ✓ | both |
| RG2-9 | `redken-root-tease` | application_moment dry_restyle | ✓ | ✓ | both |
| RG2-9 | `got2b-kleber-4-brows-and-edges-2in1-stylinggel` | application_moment dry_restyle | ✓ | ✓ | both |
| RG2-10 | `got2b-styling-puder-volumen-powderfull` | target_zone all | ✓ | ✓ | both |
| RG2-10 | `john-frieda-frizz-ease-traumlocken-lockencreme` | target_zone all | ✓ | ✓ | both |
| RG2-10 | `moroccanoil-volumizing-spray` | target_zone all | ✓ | ✓ | both |
| RG2-10 | `schwarzkopf-taft-haarpuder-volumen` | target_zone all | ✓ | ✓ | both |
| RG2-10 | `bali-curls-volumizing-curl-spray-refreshing` | target_zone all | ✓ | ✓ | both |
| RG2-10 | `john-frieda-frizz-ease-zauberformel-seiden-finish-creme` | target_zone all | ✓ | — | **one lane** |
| RG2-11 | `balea-styling-creme-power-flex` | finish natürlich | ✓ | ✓ | both |
| RG2-11 | `moroccanoil-root-boost` | finish natürlich | ✓ | ✓ | both |
| RG2-12 | `loreal-paris-elnett-haarspray-extra-starker-halt` | flexibility beweglich | ✓ | ✓ | both |
| RG2-12 | `taft-styling-paste-forming-halt-5plus` | flexibility beweglich | ✓ | ✓ | both |
| RG2-13 | `balea-overnight-wellenspray` | route styling; subtype gel | ✓; ✓ | ✓; ✓ | both |
| RG2-14 | `syoss-curl-cream-gel-3in1` | subtype gel | ✓ | ✓ | both |
| RG2-15 | `got2b-gotgloss-glanz-spray` | subtype shine_finish | ✓ | ✓ | both |
| RG2-15 | `schwarzkopf-taft-x-gliss-silky-shine-shine-coat` | subtype shine_finish | ✓ | ✓ | both |
| RG2-18 | `redken-wax-spray` | hold_level 2 | ✓ | ✓ | both |
| RG2-18 | `got2b-styling-paste-istyler-texture-clay` | hold_level 4 | ✓ | ✓ | both |
| RG2-19 | `osis-super-shield` | route heat_protectant | ✓ | ✓ | both |
| RG2-21 | `schwarzkopf-taft-haarspray-glanz-halt-4` | subtype hairspray | ✓ | ✓ | both |
| RG2-22 | `wella-eimi-glam-mist-shine-spray` | hold_level 1; d8b_flags claim_formula_conflict | ✓; ✓ | —; ✓ | **one lane** |
| RG2-24 | `jean-und-len-sea-salt-spray` | route styling | ✓ | ✓ | both |
| RG2-24 | `balea-locken-revitalizing-spray` | reason_code pending_leave_in_addendum; subtype refresher | ✓; ✓ | ✓; ✓ | both |
| RG2-24 | `cantu-lockencreme-kokos` | route leave_in | ✓ | ✓ | both |
| RG2-26 | `guhl-foehn-spray-langzeit-volumen` | heat_activated no | ✓ | yes | **one lane** |
| RG2-27 | `got2b-kleber-4-brows-and-edges-2in1-stylinggel` | subtype gel | ✓ | ✓ | both |
| RG2-27 | `bali-curls-sleek-stick-brows-and-edges` | subtype gel | ✓ | ✓ | both |
| P2-2 | `got2b-gotgloss-glanz-spray` | identity_status verified_with_minor_source_difference | ✓ | ✓ | both |
| P2-5 | `balea-haargel-hair-jelly` | hold_level —; neutral_fact enthält stylingpolymere (z. b. pvp) | ✓; ✓ | ✓; ✓ | both |

### T9. Hold levels — every product where either lane emits one

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
| BALI CURLS Haargel Strong Hold Flaxseed (`bali-curls-strong-hold-flaxseed-gel`) | gel | review | 4 | **no** |
| BALI GENTS Matt Paste (`bali-gents-matt-paste`) | molding | 3 | 3 | yes |
| Gard Haarspray extrastark (Pumpspray, ohne Treibgas) (`gard-haarspray-extrastark-pumpspray`) | hairspray | 4 | 4 | yes |
| got2b Kleber 4 Brows & Edges 2in1 Stylinggel (`got2b-kleber-4-brows-and-edges-2in1-stylinggel`) | gel | 3 | 3 | yes |
| got2b SPRÜH KLEBER Freeze Haarlack (`got2b-spruehkleber-freeze-haarlack`) | hairspray | 4 | 4 | yes |
| got2b (Schwarzkopf) Styling Mattpaste Strand Matte (`got2b-styling-mattpaste-strand-matte`) | molding | 2 | 2 | yes |
| got2b (Schwarzkopf) Styling Paste iStyler Texture Clay (`got2b-styling-paste-istyler-texture-clay`) | molding | 4 | 4 | yes |
| Kevin.Murphy Killer.Curls (Leave-in Anti-Frizz Creme) (`kevin-murphy-killer-curls`) | curl_cream | 3 | 3 | yes |
| Kevin.Murphy Powder.Puff Volume (`kevin-murphy-powder-puff-volume`) | hair_powder | — | 1 | **no** |
| KMS Thermashape 2-in-1 Spray (`kms-thermashape-2-in-1-spray`) | smoothing_styler | 4 | — | **no** |
| L'ORÉAL PARiS Elnett Haarspray Extra Starker Halt (`loreal-paris-elnett-haarspray-extra-starker-halt`) | hairspray | 4 | 4 | yes |
| Maria Nila Curlicue Cream (Stylingcreme) (`maria-nila-curlicue-cream`) | curl_cream | 2 | 2 | yes |
| NIVEA MEN Styling Cream Active (`nivea-men-styling-cream-active-craft-stylers`) | molding | 3 | 3 | yes |
| Schwarzkopf Professional OSiS Dust It (`osis-dust-it`) | hair_powder | 3 | 3 | yes |
| Schwarzkopf Professional OSiS Sparkler (`osis-sparkler`) | shine_finish | 0 | 0 | yes |
| Redken Wax Spray (Redken Spray Wax) (`redken-wax-spray`) | molding | 2 | 2 | yes |
| Schwarzkopf taft Föhn-Spray VOLUMEN Halt 3 (`schwarzkopf-taft-foehn-spray-volumen-halt-3`) | blowdry_lotion | 2 | 2 | yes |
| Schwarzkopf Taft Gel Wax Glanz (Strahlender Glanz) (`schwarzkopf-taft-gel-wax-glanz-halt-2`) | molding | 1 | 1 | yes |
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
| Schwarzkopf taft Styling Paste Forming Verformbare Styles (`taft-styling-paste-forming-halt-5plus`) | molding | 4 | — | **no** |
| Wella Professionals EIMI Glam Mist Shinespray (`wella-eimi-glam-mist-shine-spray`) | shine_finish | 1 | — | **no** |
| Wella Professionals EIMI Volume Sugar Lift Volumenspray (`wella-eimi-sugar-lift`) | blowdry_lotion | 3 | — | **no** |
| Wella Professionals EIMI Texture Ocean Spritz (Texturizing Salt Spray) (`wella-eimi-texture-ocean-spritz`) | salt_spray | 1 | 1 | yes |
| wellaflex Schaumfestiger Locken & Wellen, Starker Halt (`wellaflex-schaumfestiger-locken-und-wellen-starker-halt`) | mousse | 2 | 2 | yes |

### T10. Coverage per subtype (A and B agree on route kind and subtype)

| Subtype | Committed | Held (PH2-2) | Total | Round 2 total | ≥ 5 committed | ≥ 5 incl. held | Disputed |
|---|---|---|---|---|---|---|---|
| gel | 7 | 2 | 9 | 7 | yes | yes | — |
| curl_cream | 1 | 5 | 6 | 6 | **no** | yes | — |
| mousse | 5 | 0 | 5 | 5 | yes | yes | — |
| blowdry_lotion | 9 | 0 | 9 | 9 | yes | yes | john-frieda-volume-lift-ansatz-booster |
| smoothing_styler | 1 | 1 | 2 | 1 | **no** | **no** | — |
| hairspray | 7 | 0 | 7 | 7 | yes | yes | — |
| shine_finish | 9 | 0 | 9 | 6 | yes | yes | john-frieda-frizz-ease-zauberformel-seiden-finish-creme |
| salt_spray | 5 | 1 | 6 | 6 | yes | yes | bali-curls-volumizing-curl-spray-refreshing |
| texture_spray | 4 | 0 | 4 | 5 | **no** | **no** | redken-wax-spray, schwarzkopf-taft-texturspray-aloe-boost |
| hair_powder | 8 | 0 | 8 | 8 | yes | yes | kevin-murphy-powder-puff-volume |
| molding | 12 | 0 | 12 | 10 | yes | yes | redken-wax-spray |
| refresher | 1 | 4 | 5 | 5 | **no** | yes | bali-curls-volumizing-curl-spray-refreshing |

### T11. Lock criteria (PH1-11 as adjusted by PH1-16), computed

| Criterion | Met | Numbers |
|---|---|---|
| Every subtype >= 5 products (agreed; committed + held, held reported separately) | **no** | 10/12 subtypes reach 5 incl. held; 8/12 reach 5 committed; short incl. held: smoothing_styler 2, texture_spray 4 |
| Two blind lanes agree on all routes and properties, no unresolved disagreements | **no** | 8 route and 138 core-field disagreements on 48 records (all classified: true) |
| Two independent claim normalisations give identical hold levels | **no** | 38/44 identical |
| >= 6 unseen products incl. >= 2 traps, matching pre-registered expectations | yes | not re-tested in round 3 (0 unseen slots in r3/cohort.json: 0); read from round-2/diff.json lock_criteria: met=true — computed: 7 slots match all firm values in both lanes (A 8/8, B 7/8); 7 trap slots with route+reason matched by both lanes (1, 2, 3, 4, 5, 6, 7). Analyst note: 8 unseen, 8/8 traps caught by both lanes; firm A 148/148, B 147/148 (one pair-rule code); 7 UNDETERMINED values not scorable (rule gaps) |
| Leave-in addendum drafted and queued for right after lock (PH1-16) | **no** | no addendum file under docs/research (styling/leave-in) or plans/styling-concept |

### T12. Packet checks (computed)

Hold entries whose words carry a strength word not in their own text: 16 (levels split on: taft-styling-paste-forming-halt-5plus, wella-eimi-glam-mist-shine-spray, wella-eimi-sugar-lift).

| Product | Hold text | Words | Strength word not in text | A | B |
|---|---|---|---|---|---|
| `alcina-foehn-lotion` | Hold-Faktor 2 | natürlicher Halt (leicht) | leicht | 1 | 1 |
| `alcina-styling-mousse-aerosol` | Hold-Faktor 5 | starker, flexibler Halt | stark | 2 | 2 |
| `american-crew-fiber` | Haltfaktor 9 | Sehr starker Halt - kein Glanz. Haltfaktor 9 - Glanzfaktor 1. | stark | — | — |
| `cantu-shea-butter-extra-hold-edge-stay-gel` | up to 48 hour firm hold | FIRM HOLD; UP TO 16HR FIRM HOLD; extra Halt | extra | — | — |
| `got2b-styling-paste-istyler-texture-clay` | ultra krassem Halt | ultra krasser Halt; flexiblem, mattem Halt; starkem Halt | stark | 4 | 4 |
| `nivea-men-styling-cream-active-craft-stylers` | 4... FLEXIBLE HOLD 1 2 3 4 5 6; Haltestufe 4 | Starker Halt; Flexible Hold | stark | 3 | 3 |
| `schwarzkopf-taft-haarspray-classic-halt-3` | Haltegrad 3 | langanhaltender Halt; lässt sich leicht ausbürsten | leicht | 2 | 2 |
| `schwarzkopf-taft-haarspray-glanz-halt-4` | Haltegrad 4 | langanhaltenden Halt ohne zu verkleben, leicht ausbürsten | leicht | 3 | 3 |
| `schwarzkopf-taft-matt-wax-halt-5` | den maximalen Halt von Taft | maximaler Halt von Taft, mit reduziertem Glanz; Styling-Wax mit starkem Halt | stark | 4 | 4 |
| `schwarzkopf-taft-power-haargel-halt-5` | Haltegrad 5 | maximalen langanhaltenden Halt von Taft; Styling-Gel mit starkem Halt | maximal, stark | 4 | 4 |
| `taft-styling-paste-forming-halt-5plus` | Haltegrad: 5 | sehr starker Halt; starker Halt bis zu 24h; Haltegrad 5+ | stark | 4 | — |
| `wella-eimi-glam-mist-shine-spray` | Haltegrad 1 | leichten Halt | leicht | 1 | — |
| `wella-eimi-smooth-thermal-image` | Haltegrad: 2 | leichtem Halt | leicht | — | — |
| `wella-eimi-sugar-lift` | Haltegrad: 3 | starker, dennoch beweglicher Halt; 'mit starkem Halt' (Vorteile) | stark | 3 | — |
| `wella-eimi-texture-ocean-spritz` | Haltegrad: 2 | leichtem Halt | leicht | 1 | 1 |
| `wella-professionals-eimi-flowing-form` | Haltegrad: 2 | leichter, flexibler Halt | leicht | — | — |

Unrepaired INCI transcription defects: 7.

| Product | Rank | As in packet | Flagged in packet |
|---|---|---|---|
| `balea-styling-finishing-stick` | 4 | VPVA COPOLYMER | **no** |
| `john-frieda-frizz-ease-zauberformel-seiden-finish-creme` | 3 | PerseaGratissima Oil | yes |
| `john-frieda-frizz-ease-zauberformel-seiden-finish-creme` | 8 | IsostearylPalmitate | yes |
| `john-frieda-frizz-ease-zauberformel-seiden-finish-creme` | 18 | Steardimonium Hydroxypropyl Hydrolyzed WheatProtein | **no** |
| `john-frieda-frizz-ease-zauberformel-seiden-finish-creme` | 29 | TetramethylAcetyloctahydronaphthalenes | yes |
| `wella-eimi-glam-mist-shine-spray` | 10 | HexylCinnamal | yes |
| `wella-eimi-sugar-lift` | 10 | PEG-40Hydrogenated Castor Oil | **no** |

Confirmed names stamped C3 in the claims packet: 29 — american-crew-fiber, aussie-leave-in-creme-work-that-curl, bali-curls-hydrating-curl-cream, bali-gents-haarpuder-volumizing-styling-powder, batiste-trockenshampoo-all-in-one, bumble-and-bumble-brilliantine, bumble-and-bumble-surf-spray, cantu-lockencreme-kokos, cantu-lockenspray-comeback-curl-next-day, color-wow-dream-coat-supernatural-spray, feschi-smooth-and-shine-anti-frizz-spray-glanzspray, garnier-fructis-locken-methode-feuchtigkeitsboost-pflege-spray, garnier-fructis-sleek-and-stay-heat-activated-serum, got2b-hitzeschutzspray-schutzengel, got2b-trockenshampoo-extra-volumen, guhl-locken-pflege-und-styling-3in1, guhl-styling-spray-locken-pflege-und-styling-2in1, hask-lockencreme-curl-care, isana-professional-styling-creme-locken-traum, john-frieda-haarserum-frizz-ease-der-baendiger, kerastase-curl-manifesto-refresh-absolu, langhaarmaedchen-lockenspray-halt-sprungkraft, living-proof-full-dry-volume-texture-spray, loreal-elvital-haaroel-oel-magique-alle-haartypen, redken-styling-beach-spray, schwarzkopf-professional-osis-curl-retouch, syoss-hitzeschutzspray-keratin-heat, taft-styling-paste-forming-halt-5plus, taft-x-gliss-hitzeschutzspray-lovely-long.

---

Reproduce: `node data/research/styling-inci/v1.0/round-3/diff.js` (writes `round-3/diff.json` only); `--summary` prints the counts and `--tables` prints the tables above; `--dump` lists every disagreement with the full rule paths and notes.
