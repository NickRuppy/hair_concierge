# Styling Research and Classification Standard v0.3

Status: **v0.3, amended 2026-10-12 (R2-H1…R2-H6) — blind round 2 run 2026-10-12; round-2 rulings folded in (R2-Q1…R2-Q4, R2-T: RG2-1…RG2-27, P2-1…P2-6), then the post-recheck clarifications R2-H1…R2-H6; next: round-3 cohort freeze (incl. the targeted `smoothing_styler` capture and the re-check data), blind round 3.** Not calibrated, not locked. Executable procedures for a classification lane, in run order.
Document version: `v0.3` · Engine version: `styling-inci-v0.3` · Lexicon: `02_evidence_lexicon.v0.3.md` (`styling-lexicon-v0.3`)
Scope: leave-on styling products under the one category key `styling` with 12 subtypes (SD1, SD2, D1), German/EU market, plus the S0 boundary with Leave-in, Heat Protectant, Oil and Dry Shampoo.
Normative source: this Markdown file. Drafted 2026-10-10; v0.2 and v0.3 2026-10-12.
Governing inputs, in order of authority: `plans/styling-concept/02-rulings.md` (SD1–SD5, D1–D8b, PH1-1…PH1-16, PH2-1…PH2-12, R1-Q1…R1-Q4, R1-T, R1-H1…R1-H3, R2-Q1…R2-Q4, R2-T, R2-H1…R2-H6 — **governs**) > `00_category_charter.md` > `01_property-set-v0.md` > `plans/styling-concept/01-styling-concept.md` Rev. 2.
Inherited method (reused by reference, cited "LI §x"): `docs/research/leave-in-inci/v1.0/leave-in-classification-standard.md` (Leave-In Standard v1.0). Structural precedent: `docs/research/mask-inci/v1.0/mask-classification-standard.md` (cited "Mask §x") and the engine template `docs/research/category-classification-engine-template.md`.
Evidence: `data/research/styling-inci/concept-v0/calibration-set-r2.json` (90 records), raw INCI/claims/directions in `samples/*.json` and `round2/`; the frozen round-2 cohort `data/research/styling-inci/v1.0/r2/cohort.json` (139 records) with both lanes' outputs (`blind-lane-A-r2/`, `blind-lane-B-r2/`) and `round-2/diff.json`. Counts marked **(node)** were recomputed by a scratch script — on 2026-10-10 over the raw INCI under lexicon v0.1, and, where marked 2026-10-12, over the round-2 cohort and lane outputs; the scripts are not committed and no frozen record was edited.

## Version

**Status: v0.3, amended 2026-10-12 (R2-H1…R2-H6) — round-2 rulings folded in 2026-10-12; the post-recheck clarifications R2-H1…R2-H6 amend it without a version bump (they clarify v0.3 readings; no deterministic rule or lexicon family changes); next: round-3 cohort freeze, blind round 3.**

### Amendment to v0.3 (2026-10-12, R2-H1…R2-H6)

Source: the re-check capture `data/research/styling-inci/v1.0/capture/recheck-r6.json` (+ `RECHECK-R6-NOTES.md`) and Nick's rulings R2-H1…R2-H6 in the ledger. They settle §13.2 items 2–6 and clarify v0.3 readings; no deterministic rule or lexicon family changes, so the version stays v0.3 (engine `styling-inci-v0.3`, lexicon `styling-lexicon-v0.3`). The data changes they imply are applied by the round-3 freeze (`build/freeze-cohort-r3.js`), never by patching a frozen record.

| Change | Ruling | Where |
|---|---|---|
| Wella EIMI Fresh Up: its promise lines are on wella.com/professional/de-DE (C2, re-stamped from lookfantastic.de); „Detangling"/„entwirrend" is retailer text only (C3) ⇒ no C1/C2 care job ⇒ not an R1-Q3 care + definition tie; D6/T15 decide in round 3. Corrects the R2-Q1 example | R2-H1 | §4.2, §4.6, §11.14, §13.2 item 3 |
| **INCI page-error rule:** a manufacturer page that prints an evidently foreign INCI (another product's list, contradicting the page's own formula text) is recorded as a page error, not as a T18 capture; the consistent list is the formula of record; review `formula_source_page_error` until a pack INCI is captured | R2-H1 | §2.2 A10, §8 |
| GUHL Locken 3in1 is a care product, not Styling; it stays in its current category. **General reading:** a care cream that can also be left in as a curl cream stays care; only a fixative-class polymer or the D7 middle band makes it Styling. Its leave-in use is recorded for the Leave-in addendum | R2-H2 | §4.1, §4.6, §9 (SFS-24), §11.15, §13.2 item 4 |
| Balea Haarwachs Styling Stick ⇒ `molding`: the name step (§4.2 step 1, RG2-21; pack name „Styling WAX STICK") precedes RG2-17; Babyhaare is a secondary use; INCI = the 14-item pack list | R2-H3 | §4.2, §4.6, §11.16, §13.2 item 5 |
| NEQI Diamond Glass All: the INCI is complete (pack and neqi-hair.com agree, 14 items); the truncation flag is withdrawn and R2-Q4 (`leave_in`) applies without a block | R2-H4 | §4.1, §4.6, §11.4, §13.2 item 2 |
| Feel lines never count as the care half (R2-Q1), incl. „Verbesserte Geschmeidigkeit"; Balea Pro Traumlocken keeps `curl_cream` via D7 before the mixed stop (PH1-12) | R2-H5 | §4.2, §9 (SFS-22), §11.2, §13.2 item 6 |
| **Claim host rule:** a manufacturer's German-language storefront for the German market counts as C2 whatever its domain ending, when the brand's .de domain points to it (kevinmurphy.com.au/de/de); English or other-market pages stay C5 (redken.co.uk, evohair.com/us); Redken One United lines found on redken.eu/de-de are C2, the rest C5 | R2-H6 | §2.2 A9, §4.6, §9 (SFS-25) |

### Changelog v0.2 → v0.3 (2026-10-12)

Source: `data/research/styling-inci/v1.0/round-2/diff.json` (`rule_gap_register`, `packet_issues`, `owner_questions`, `lane_errors`, `s0_redaction_check`) and `report.md`; rulings R2-Q1…R2-Q4 and R2-T in the ledger. Blind round 2 ran on v0.2; every record a change below touches is re-derived in the next blind round (rerun obligation, §14), never patched. RG2-16 is ruled „open" (R2-T).

| Change | Ruling | Where |
|---|---|---|
| The care half of a care + curl-definition tie is a **care job the product promises** (spendet Feuchtigkeit, pflegt, repariert, entwirrt; „Pflege"/„Care"/„Detangling" in the name); a result adjective („gepflegte Locken"), a feel line or an ingredient call-out is not. The definition half needs „definiert"/„Definition"; reviving or reactivating curls is refresh. Narrows R1-H2; D6 (PH1-13), T15 and D7 then run as before | R2-Q1, RG2-1 | §4.2, §4.6, §9, §11.13 |
| The water-based-serum exception reads a cationic conditioner the D6 way: above T_LI **or** below it down to — not including — the first pH adjuster after T_LI (fallback `Parfum`) | R2-Q2, RG2-2 | §4.3 3.1, §4.6 |
| Blind S0 masking keeps job nouns and masks only grading words (exact keep/mask lists); the unmasked confirmed name goes into the claims packet; only affected records are re-frozen and re-run | R2-Q3, RG2-3, P2-1 (refines PH2-6) | §10.2 |
| Registry: NEQI Diamond Glass **All** ⇒ `leave_in` (T15/D3), blocked until its INCI truncation flag clears | R2-Q4, RG2-25, P2-3 | §4.6, §11.4 |
| A strength phrase that is the lead's subject („Intensiver Halt für …") states `hold_fix` | RG2-4 | §6.10 |
| A curl/wave noun with a shaping or setting verb states curl definition (`li_function: yes`, primary `definition`); name job words naming the same job count once | RG2-5 | §4.2, §6.10 |
| Schwung, Sprungkraft, Spannkraft, Fülle ⇒ `volume`; Elastizität is a flexibility word | RG2-6 | §6.9, §6.10 |
| Taming flyaways / abstehende Haare / Babyhaare ⇒ `frizz_control`; `sleek` only for a smooth result of the whole style | RG2-7 | §6.10 |
| `dry_restyle` needs a named shaping act; spraying or distributing on dry hair without one ⇒ `dry_finish` | RG2-8 | §6.11 |
| Directions with a shaping step but no moisture state, drying or heat step ⇒ `dry_restyle`, moderate | RG2-9 | §6.11 |
| A full-length range or an emphasis inside a whole-hair instruction ⇒ `all` | RG2-10 | §6.12 |
| „natürlich aussehendes Finish" / „natürlich wirkender Look" ⇒ `natürlich`; halbmatt, seidenmatt ⇒ `matt` | RG2-11 | §6.8 |
| verformbar, wieder/neu stylen (a restyling sequence), Elastizität ⇒ `beweglich`; „ausbürstbar" alone stays out | RG2-12 | §6.9 |
| Heatless overnight setting sprays/lotions ⇒ `gel` (mousse stays foam-only) | RG2-13 | §5, §4.6 |
| Form = what the product is as applied; the capture format field alone never breaks a gel/curl_cream tie | RG2-14 | §5 |
| A shine lead stays `shine_finish` whatever the moment; `smoothing_styler` needs a sleek/straight job | RG2-15 | §5, §4.6, §9 (SFS-23) |
| Secondary jobs: any §6.10 job word in a C1/C2 promise line, max two, in claim order (ruled „open") | RG2-16 | §6.10 |
| A lead line with no job word is skipped; the next C1/C2 line with a job word leads | RG2-17 | §4.2 |
| „Kontrolle" with a strength word reads as „Halt" (mittlere Kontrolle ⇒ 2); krass ⇒ 3; ultra krass / krasser Halt at the top of a got2b display ⇒ 4 | RG2-18 | §7.4, §13.2 |
| A protection lead naming heat among other protections ⇒ `heat_protection`; `mixed` only when protection is joined with a styling or care job | RG2-19 | §4.2, §4.3 3.3, §4.6 |
| Leave-on + rinse-out directions ⇒ the first-named use decides the category; the other is recorded (PH1-7) | RG2-20 | §4.1, §4.6 |
| The product-type noun names the job when it is the only job noun; a shine/strength qualifier in the same name is not a second job | RG2-21 | §4.2 |
| D8b rule 1 never changes the level and never restores a dropped `hold_fix` secondary | RG2-22 | §7.5 |
| Lexicon v0.3: species placements; Annex V antioxidants are not markers; Benzyl Alcohol above `Parfum` reads PR-1; propellant-led aerosols are non-aqueous | RG2-23 | lexicon v0.3 §0.2, §0.3, §1; §3.2, §4.3 3.5, §6.1 |
| An INCI defect confined to the tail does not block S0 (review `inci_tail_defect`); a defect above T_S blocks; `identity.inci_flags` ship in the S0 packet; the freeze re-joins split tokens and renumbers | RG2-24, P2-3, P2-4 | §4.1, §8, §10.2; lexicon v0.3 §0.4 |
| In the blind round `heat_activated` reads the F/U directions only; name and claim activation statements raise it after unblinding | RG2-26 | §6.13, §10.2 |
| Brow use of a hairline gel is recorded (PH1-7); the hair use decides route and subtype | RG2-27 | §5 |
| Claim capture: a hold entry's `words` come only from its own `raw` | P2-5 | §2.2 A3 |
| Re-stamps and re-freezes: gotGloss re-frozen `verified_with_minor_source_difference` (P2-2); lookfantastic.de ⇒ C3, redken.co.uk ⇒ C5, kevinmurphy.com.au/de/de to be confirmed as the German-market page (P2-6; confirmed as C2 by R2-H6, amendment above) | P2-2, P2-6 | §4.6 (data, handled outside this file) |
| Capture facts from the round-2 freeze: Taft Styling Balm Locken „Halt 3" is a C1 pack claim ⇒ 2 (closes v0.2 §13.2 item 5); Balea Finishing Stick has C1 pack directions ⇒ its evidence gate passes (R1-Q2 ⇒ `shine_finish`) | — (capture) | §4.6, §7.3, §7.8 |
| Open items after round 2 | — | §13.2 |

Lane errors E2-1…E2-12 (`round-2/diff.json`) imply no rule change; RG2-26 states the reading behind E2-10.

### Changelog v0.1 → v0.2 (2026-10-12)

Source: `data/research/styling-inci/v1.0/round-1/diff.json` (`rule_gap_register`, `packet_issues`, `owner_questions`) and `report.md`; rulings R1-Q1…R1-Q4 and R1-T in the ledger. Blind round 1 ran on v0.1; every record a change below touches is re-derived in round 2 (rerun obligation, §14), never patched.

| Change | Ruling | Where |
|---|---|---|
| Henkel „Haltegrad" x/5 covers every Henkel leave-on format except Taft gels; „5+" = 5 | R1-Q1, RG-4 | §7.3 |
| An illegible or self-contradicting brand number is not used; words decide; `hold_number_unreadable` + re-capture (Taft Paste „5+" beside 4 dots stays here until re-read) | RG-19, R1-Q1 | §7.2, §8 |
| Anti-frizz / flyaway control on dry, finished hair = the `shine_finish` job (`li_function: no`); the main directions decide, a side tip does not | R1-Q2, RG-6 | §4.2, §4.6 |
| Lead-promise picking order (name job word → first C1 pack-front line → first C2 line); the name never breaks a care-vs-curl-definition tie; a C1/C2 promise covering both care and curl definition ⇒ `mixed` ⇒ manual review; PH1-12 unchanged | R1-Q3, RG-5 (adjusted by R1-T) | §4.2, §4.6 |
| `heat_activated: yes` only when the product's own text says heat activates it or makes it work; a blow-dry tip is an `application_moment` fact | R1-Q4, RG-3 | §6.13 |
| T_LI vacuity: essential oils at/after `Parfum` or in the allergen block are closed set (b) | RG-1 | §3.2; lexicon §0.2 |
| Spray-only directions ⇒ `dry_finish` (moderate) | RG-2 | §6.11 |
| `identity_status` describes product and formula identity only; a directions or claim gap is an evidence-gate fact | RG-7 | §2.3 |
| Equal alternatives: the first-named moment is primary; §11.8 corrected | RG-8 | §6.11, §11.8 |
| `roots` when the Ansatz is the only or first-named site, incl. an either/or | RG-9 | §6.12 |
| matt + natürlich ⇒ matt; glänzend + natürlich ⇒ natürlich; natürlich needs Finish/Look/Glanz next to it | RG-10 | §6.8 |
| Primary job = first job-bearing phrase; product nouns and strength phrases are not job-bearing; shaping ⇒ `hold_fix` | RG-11 | §6.10 |
| Secondary jobs from hold-strength, anti-frizz, shine and definition words, in claim order | RG-12 | §6.10 |
| A strength word in a name counts only when it qualifies hold or the product as a whole; name words never become hold claims otherwise | RG-13, P-1 | §7.4, §2.2 A3 |
| „Kleber" is a rigidity word only, no longer a strength word | RG-14 | §6.9, §7.4 |
| Water-based-serum exception gets a test and a trigger | RG-15 | §4.3 3.1, §8 |
| Malic Acid → PH-1; Polysilicone-9 → SI-4; PQ-69 → FX-R (ambiguous hold group) | RG-16, R1-T | lexicon v0.2; §4.3, §6.2 |
| A2 release test: a dated C1 pack capture with the record's GTIN, newer than both lists | RG-17 | §2.2 A2 |
| `tail_marker_vacuous` / `_implausible` fire only when a border rule on the path reads T_LI | RG-18 | §8 |
| Untested gaps carried to round 2 | RG-20 | §13.2, §14 |
| Kevin.Murphy Killer.Curls released by the capture ⇒ D7 `curl_cream`, held | RG-21 | §4.6 |
| Claim-capture rules implied by packet issues: house-brand stamp only per A5; name-derived flexibility words become flexibility claims; editor annotations are never claim text | P-2, P-4, P-6 | §2.2 A3, A5 |
| Particulate cohort count: 11 confirmed (property set's 10 omitted the lexicon's Cellulose placement) | — (housekeeping) | §6.1; property set §2.3 |
| Contradictions not resolvable from the ledger | — | §13.2 |
| Name with two job words does not decide the lead (Elnett ⇒ pack front, PH1-14 kept); the v0.1 „Pflegecreme" adjective clause is retired under R1-Q3; Polysilicone-9 is FX-U (ambiguous hold, D6 hold limb unresolved ⇒ review) | R1-H1, R1-H2, R1-H3 | §4.2, §13.2; lexicon v0.2 |

Packet issues P-1, P-3, P-5, P-7, P-8 are data re-captures (handled outside this file); they imply no new rule beyond those listed.

### v0.1

**v0.1 (drafted 2026-10-10, ruled 2026-10-11) — first standard.** It operationalises the ruled property set and charter. It adds no property and reopens no ruling. On 2026-10-11 Nick ruled the six proposals P-S1…P-S6 as PH2-1…PH2-6 and six further points as PH2-7…PH2-12 (`plans/styling-concept/02-rulings.md`); the body below states the ruled rule, and §12 records the mapping.

**Marking convention.**
- `[D6]`, `[PH1-13]` … — the passage encodes that owner ruling.
- `[LI §x reused]` — a Leave-in rule adopted unchanged (PH1-8, PH1-2, PH1-3, PH1-4, PH1-15 tell us which ones).
- `[operational]` — a mechanical reading that follows directly from a ruled or reused rule (usually LI §1.1); calibration may test it.
- `[PH2-n]` — the passage encodes a Phase 2 ruling (2026-10-11). The six former proposals P-S1…P-S6 are ruled as PH2-1…PH2-6 (§12); no proposal is open.
- `[R1-Qn]`, `[RG-n]`, `[P-n]` — the passage encodes a round-1 ruling (2026-10-12): an owner answer (R1-Q1…R1-Q4) or an item of the technical bundle approved by R1-T (rule gap RG-n, packet issue P-n, `round-1/diff.json`).
- `[R2-Qn]`, `[RG2-n]`, `[P2-n]` — the passage encodes a round-2 ruling (2026-10-12): an owner answer (R2-Q1…R2-Q4) or an item of the technical bundle approved by R2-T (rule gap RG2-n, packet issue P2-n, `round-2/diff.json`).
- `[R2-Hn]` — the passage encodes a post-recheck clarification of v0.3 (2026-10-12, R2-H1…R2-H6; amendment table above).

**Superseded text, named so nobody applies it.** Property set v0's `drying_alcohol_load` (high/present/none) and `washability` are replaced by PH1-3 and PH1-4; the property-set file already reflects this. The charter's former step 5 ("Styling never fills the heat role") is superseded by PH1-15. The concept Rev. 2 still carries that line (charter §13 item 9); this standard follows PH1-15. Where the calibration file's `route`, `v1_subtype`, `application_moment` or `proposed_finish` disagree with a rule below, the rule governs and the record is re-derived in the blind round, never hand-edited (Mask rerun obligation).

**What this draft is not.** Not calibrated, no repeatability claim, no catalog, Supabase, intake, matcher or copy change (charter §16).

---

## 1. Purpose and the lane run order

This standard turns one exact German-market styling product (exact pack, exact formula version) into an auditable research record. A lane runs these steps in this order and never skips ahead:

| Step | What | Section | Inputs |
|---|---|---|---|
| 1 | Identity and formula freeze; directions and claim capture | §2 | sources |
| 2 | Read both tail markers | §3 | frozen INCI |
| 3 | S0 routing gate | §4 | frozen claims (C1/C2 only), directions, INCI |
| 4 | Subtype (only if `route = styling` or a held Styling lean, §4.5) | §5 | promise, directions, format |
| 5 | Properties (F, U, C kinds) | §6 | frozen packet |
| 6 | Hold level normalisation, D8b flag, neutral fact | §7 | frozen claims, F values |
| 7 | Derived echoes and cautions (computed last, never reviewed per product) | §6.16 | the above |
| 8 | Review triggers and the record envelope | §8, §10 | everything |

### 1.1 The conservative-failure invariant `[LI §1.1 reused]`

Every hard rule here — threshold, closed list, gate, marker convention — fails toward **human review** or toward **the anchor's conservative value**, never toward a recommendation, an upgrade or a value that reads better for the user than the evidence supports (LI §1.1, Mask §1.1). Consequences carried through this file:

1. An implausible or unresolved input can neither qualify nor disqualify (LI §3.1.1 clauses 5–6; Mask §3.1.1).
2. "Unresolved" always means review, never a default good answer.
3. S0 fails toward `provisional_boundary` and the product's current category, never toward a confident new route (charter §5).
4. Never encode unresolved uncertainty as an extreme (Mask §1.1): an unresolved reading never produces `weight: rich` or `light`, a hold level, or `provides_heat_protection: true`.

**Conformance of the Styling additions.** Every `[operational]` rule and every ruled proposal in §12 was checked against this bar: each one either fails to review / the conservative value, or resolves only on converging evidence.

### 1.2 Separation of evidence kinds (property set §0, §7)

| Kind | Source | May set |
|---|---|---|
| **R** routing | S0 (§4) | `route`, `styling_subtype` |
| **F** formula-blind | frozen INCI only | `result_mechanisms`, `hold_route`, `weight`, `alcohol_note`, `ingredient_flags`, the buildup note's formula limbs, the F half of `provides_heat_protection`, molding `base`, curl-cream `conditioning_co_load` |
| **U** usage | frozen directions transcription | `application_moment`, `target_zone`, `heat_activated` (directions half) |
| **C** claim | C1/C2 claims only (LI §2.4.1) | `chaarlie_hold_level`, `flexibility`, `finish`, `primary_job`/`secondary_jobs`, gel `cast_expected`, molding `form_label`, `captured_claims`, the C half of `provides_heat_protection` |
| **D** derived | the above | echo fields, cautions, hold display, neutral fact |

Subtype, product name and format **never set an F value** (LI G9 parity). One bounded reading uses format: the lexicon FX-2c check may read the identity `format` (thin spray or foam with no RH-1 member) to confirm that a generic Acrylates Copolymer is a fixative; it can only resolve that one membership, and without corroboration the value falls to `ambiguous` + review, never to a better reading. F never sets a C value and C never sets an F value. The only crossings are the three in property set §7 (heat-activation raise; job gate; D8b / finish sanity / weight-claim conflict as review notes that move no value) plus PH1-15's two-part heat test (§6.7).

---

## 2. Identity, formula freeze and claim capture (lane step 1)

### 2.1 Reused unchanged `[PH1-8; LI §2.4, §2.4.1, §2.4.2 reused]`

| LI rule | What it fixes for Styling |
|---|---|
| LI §2.4 G1 checklist | exact product, brand, name, market, pack size, GTIN (or a documented gap), dated exact-market INCI, normalised fingerprint, **verbatim directions with tier**, `claims[]`, conflicts preserved |
| LI §2.4 mandatory directions capture | Verbatim, source-stamped, G1 source hierarchy (pack → DE manufacturer → exact-GTIN DE retailer → other DE/EU retailer). Missing directions are a documented gap: U fields go `unresolved`, never an INCI guess. **Directions are not claim-gated** (LI §2.4.1 last paragraph) — a C3 directions text is valid for U fields, with confidence `moderate` |
| LI §2.4 mandatory claim capture | `claims[]` is part of the freeze; "not captured" ≠ "does not exist"; lanes never re-research a claim; a claim found mid-classification reopens the freeze |
| LI §2.4.1 rules 1–7 | Only C1 (current DE pack) and C2 (manufacturer DE page) create a claim. **Rule 6:** a retailer's page for its **own** private label is C2 (named: dm ↔ Balea/alverde, Rossmann ↔ Isana), recorded `claim_tier_basis: house_brand`, routed to review for ownership confirmation. **Rule 7:** a non-German manufacturer page counts as `C2_cross_market_verified` only with identity verified (identical INCI or a DE-confirmed shared GTIN) **and** a DE retailer corroborating. Rule 2: C1 vs C2 conflict ⇒ preserve both, take the more conservative reading, review |
| LI §2.4.2 / T18 | Same-market INCI set conflicts: ≥ 3 identical lists incl. one GTIN-anchored DE retailer ⇒ convergent list is the record (`verified_with_minor_source_difference`, confidence −1, review); otherwise affected fields `unknown`, `formula_source_conflict`, no downstream use. Cross-market differences are identity questions (rule 7), never convergence counts |
| LI §2.4 packet requirements | Sources stamped C1–C5; normalisation never splits inside an ingredient name (lexicon §0.4) |

### 2.2 Styling additions

| # | Rule | Basis | Example |
|---|---|---|---|
| A1 | **Pack vs manufacturer-page hold conflict ⇒ `chaarlie_hold_level: null`** („Halt: keine Herstellerangabe"), both claims kept in the trace, review `hold_claim_conflict`. Not the lower number, not `review` | PH1-8 | — (none in cohort) |
| A2 | **Two INCIs under one GTIN (same German market) ⇒ apply LI T18 first.** (1) **Tier 1 convergence:** ≥ 3 independent captures return the identical list in identical order, ≥ 1 of them a GTIN-anchored German retailer capture, manufacturer formula markers matching where visible ⇒ the convergent list is the formula of record, outliers kept as demoted captures, `identity_status: verified_with_minor_source_difference`, confidence −1 on every affected dimension, review `formula_or_identity_conflict`, and classification proceeds normally. (2) **Only when convergence fails ⇒ tier 2:** `identity_status: provisional_formula_conflict`, S0 `provisional_boundary` (`boundary_reason: formula_conflict`), review `formula_source_conflict`, no Styling value committed, until a **C1 pack capture** identifies the unit on sale or a later capture set reaches tier 1. **Release test `[RG-17]`:** a **dated C1 pack capture carrying the record's GTIN, newer than both conflicting lists**, is the formula of record ⇒ `identity_status: verified_with_minor_source_difference`, review `formula_or_identity_conflict`, and classification proceeds (the freeze re-runs; any other gate still applies — e.g. a missing-directions evidence gate). Cross-market differences are identity questions (LI §2.4.1 rule 7), never convergence counts | PH1-8 (P3 example), LI §2.4.2 T18, RG-17 | `bali-curls-leave-in-spray-curl-defining`: only two captures, and they disagree — dm.de (GTIN 4262391990490; Hydrolyzed Corn Starch r3, no care) vs bali-care.com/de-de (same GTIN; olivate, Cetyl Alcohol, proteins). Tier 1 is not reachable on this evidence ⇒ **stays blocked** (`formula_conflict`) until a C1 pack capture, or further independent captures that make one list reach the full tier-1 bar. *Round 1 (RG-17):* the frozen packet now carries a C1 current list for this record and for `cantu-shea-butter-extra-hold-edge-stay-gel`; if that capture meets the release test, both are re-frozen as `verified_with_minor_source_difference` (Cantu then still stops at the evidence gate: no directions) |
| A3 | **Typed claim capture.** Each `claims[]` entry carries `type` ∈ {promise, hold, flexibility, finish, cast, duration, humidity, heat_protection, heat_activation, hair_type, free_from, other}, `raw` (verbatim DE), `tier`, `source`, `date`; hold entries add `number`, `scale_as_written`, `words`. The confirmed **product name is a C1/C2 claim** once a pack image or the manufacturer page shows it (charter §7); the **full pack name** is kept (no word dropped). **Name-derived claim entries `[P-1, P-2, RG-13]`:** a rigidity or flexibility word of §6.9 in the confirmed name („Kleber", „Freeze") is added as a `flexibility` claim with `from_product_name: true`; a strength word in the name is added as a `hold` claim **only** under the §7.4 name test (it qualifies hold or the product as a whole — never „Ultra" in „Ultra Volumen"). **Editor annotations are never claim text `[P-6]`:** capture notes („(no gloss/matt claim)", „matt: '…'", a hold text „null") go to a separate note field; an empty claim is dropped, never recorded as a claim. **A hold entry's `words` come only from its own `raw` `[P2-5]`:** a word with no claim line of its own is either captured as its own claim with provenance (e.g. a dm „Halt" attribute as a C2 `house_brand` hold claim, PH2-7) or dropped (`balea-haargel-hair-jelly`: claim „flexiblen Halt", `words` also „soft" with no line — re-captured) | charter §7, property set §2.16, P-1, P-2, P-6, P2-5 | `wellaflex-schaumfestiger-locken-und-wellen-starker-halt`: name „Starker Halt" (C1) + 3 of 5 dots (C1) |
| A4 | **House-brand structured attributes.** On a house brand's own retailer page (rule 6), the retailer's structured product fields („Halt: sehr starker Halt") are the brand owner's product data ⇒ C2 `house_brand`, review `[PH2-7]`. **Filter chips and attributes on third-party products are C3/C4 traces and never create a claim** | LI §2.4.1 rule 6; charter §6 | `balea-styling-spray-ultra-volumen` dm attribute ⇒ C2 house-brand; `color-wow-dream-coat-supernatural-spray` Douglas „Haltgrad" chip ⇒ C3 trace |
| A5 | Retailer-exclusive brands are **not** house brands unless ownership is documented. **The `C2_house_brand` stamp is applied only to the brands LI rule 6 names (dm ↔ Balea, alverde; Rossmann ↔ Isana) or a brand whose retailer ownership is documented in the record `[P-4]`**; every other retailer-page claim is stamped C3 at capture, never C2 | charter §13 item 5, P-4 | Langhaarmädchen ⇒ C3 (`langhaarmaedchen-lockenspray-halt-sprungkraft`: round 1's C2 stamp is re-stamped C3) |
| A6 | A reformulation reopens the record; frozen records are never rewritten. The GTIN may survive it | charter §8 | Syoss Curl Cream Gel, Syoss Max Hold Wax, John Frieda Volume Lift (three formulas) |
| A7 | Possible duplicates are resolved by GTIN before calibration, never by name | charter §8 | Balea „Finishing Spray Glow & Care" vs „Glow&Shine Finishing Spray" |
| A8 | One product = one route; other uses are recorded only | PH1-7 | `balea-men-pomade-haar-bart-2in1`: beard use recorded, one Styling `molding` record |
| A9 | **Claim host rule (C2 vs C5) `[R2-H6]`.** The host decides the tier, not the domain ending: a **manufacturer's German-language storefront for the German market** counts as C2 when the brand's .de domain points to it (redirects there or names it as the German site). English or other-market manufacturer pages stay **C5** (LI §2.4.1 rule 7 still applies to them), and a German translation of a non-German page is not a German page. A line counts as C2 only where it is **found on the German page**; lines found only on the other-market page stay C5, even on the same record. A retailer page stays C3 (C2 `house_brand` only under A5) | R2-H6; LI §2.4.1 rules 1, 3, 7 | `kevin-murphy-killer-curls`, `kevin-murphy-powder-puff-volume`: kevinmurphy.com.au/de/de (kevinmurphy.de redirects there) ⇒ **C2**. `redken-one-united-all-in-one-multi-benefit-treatment`: lines found on redken.eu/de-de ⇒ C2 with that source; the rest of the redken.co.uk lines ⇒ C5. `evo-head-mistress-cuticle-sealer`: evohair.com/us ⇒ C5 (no German page found). `wella-eimi-nutricurls-fresh-up`: lines found on wella.com/professional/de-DE ⇒ C2 (previously mis-stamped C2 from lookfantastic.de, a C3 retailer) |
| A10 | **INCI page error `[R2-H1]`.** When a manufacturer page prints an INCI that is evidently another product's list — it contradicts the page's own formula text (named actives absent, a different product type's architecture) while independent captures agree with each other and with that text — the printed list is recorded as a **page error**, not as a capture for LI T18 convergence; the consistent list is the formula of record (its own tier unchanged), `identity_status` is not downgraded, and the record carries review `formula_source_page_error` until a pack INCI (C1) is captured | R2-H1 | `wella-eimi-nutricurls-fresh-up`: wella.com DE prints a wax/pomade list (Ceresin, Petrolatum, Carnauba, iron oxides; no jojoba, no wheat) under a page text naming wheat bran extract and jojoba oil; the 29-item retailer list (lookfantastic.de, also beautyflash.co.uk) matches that text ⇒ formula of record (C3), page list kept as `inci_page_error`, review `formula_source_page_error` |

### 2.3 Identity states

`verified` · `verified_with_minor_source_difference` · `provisional_formula_conflict` · `provisional_identity_conflict` · `insufficient_information` (LI §2.4). **`identity_status` describes the product and formula identity only** (exact product, GTIN or a documented gap, INCI set). **A directions or claim gap never changes it**; it is carried by the S0 evidence gate (§4.1) with the missing input named `[RG-7]` (e.g. `balea-styling-finishing-stick`, no directions ⇒ `verified` + `provisional_boundary (evidence_gate)`). A conflict affecting one property makes **that property** `unknown`; it blocks the whole record only when the dominant architecture is unreadable (LI §2.4). Any state other than the two `verified` ones sends S0 to `provisional_boundary` (§4.1).

---

## 3. Evidence scale and the two tail markers (lane step 2)

### 3.1 Scale `[LI §3.1 reused]`

E0 claim · E1 formula observation or directions transcription · E2 any value read from the formula (the ceiling) · E3–E5 exact-product testing (reachable, unobserved). The assignment ladder of LI §3.1 binds every field (lexicon §0.1). Confidence (`high`/`moderate`/`low`, Mask §4.1) is **internal only** — never projected, never user-facing (LI G14).

### 3.2 Markers `[PH1-1, PH2-9]`

Every record states **T_S** (Styling marker: Mask §3.1 classes — fragrance, declared allergens/aroma chemicals, preservatives, boosters in a pair, chelators) and **T_LI** (LI §3.1.1 capped-preservative list plus other Annex V preservatives). Exact class lists: lexicon §0.2. **T_S is the full Mask rule `[PH2-9]`**, as approved under PH1-1 — the earliest of preservative, perfume, declared allergens/aroma chemicals, preservative boosters in a pair and chelators; not the ledger's short form „first preservative or perfume“. **T_S feeds every Styling property; T_LI feeds only the S0 border rules** (LI G0/T15, D6/R2, D7, the PH1-16 double-claim check). Each record carries `tail_marker: {T_S: {inci, rank, status}, T_LI: {inci, rank, status}}` with `status` ∈ `plausible · unresolved · absent` for T_S and LI's `plausible · implausible · vacuous · none_visible` for T_LI.

### 3.3 Unresolved or absent T_S `[operational — Mask §3.1.1 consequences + §1.1]`

Mask §3.1.1 says an unresolved marker may neither qualify nor disqualify, caps confidence and routes to review. The deterministic reading for a lane:

1. Read the list twice: **R1** with the marker as listed, **R2** with the next ordinally consistent T_S member.
2. Species ranked between the two markers are `unpositioned`. They are recorded (E1) and credited to **nothing** that improves a value: not to `result_mechanisms`, not to `hold_route: present`, not to the neutral fact, not to the heat test.
3. Each F property is computed under R1 and R2. **Same value ⇒ that value**, confidence ≤ `moderate`, trigger `tail_marker_unresolved`. **Different values ⇒** `hold_route: ambiguous`; `weight: unknown`; mechanisms = the R1 set with the `unpositioned` members listed; review.
4. **Absent** (no T_S class anywhere) ⇒ the whole list is above-tail, confidence ≤ `moderate`, trigger `tail_marker_absent` (Mask §3.1).

Cohort (node): 9 of 70 Styling records have a non-plausible T_S (8 unresolved, 1 absent). On all of them R1 and R2 give the same `hold_route` and `weight`; no value rests on this rule today.

**Marker-class readings `[RG2-23]`** (lexicon v0.3 §0.2): an Annex V antioxidant (sulfites, e.g. Sodium Bisulfite) sets neither T_S nor T_LI unless the list declares it „as preservative"; Benzyl Alcohol ranked above `Parfum` reads PR-1 (a preservative), not a declared allergen, so it never fires the third limb (i) there.

T_LI keeps LI §3.1.1 clauses 1–6 **unchanged**, including clause 5 (implausible marker cannot disqualify) and clause 6 (vacuous marker cannot qualify). **Reading of clause 6 closed set (b) `[RG-1]`:** an essential or botanical fragrance oil declared at or after `Parfum`/`Fragrance`, or among the declared allergens, is a fragrance declaration; the same oil above `Parfum` is outside the set (lexicon §0.2).

### 3.4 Below-marker candidates `[Mask E13; LI §3.1.1 clause 3 reused]`

A species at or below T_S never makes the marker implausible and earns nothing. Where crediting it would change a value, the record carries `candidate_below_tail` (species, rank, marker, marker rank) and routes to review. A species that would change nothing is recorded as E1 only. Cohort (node): 17 of 70 Styling records carry at least one value-changing candidate (e.g. `balea-locken-revitalizing-spray`: Coconut r13 + Shea r14 behind Sodium Benzoate r4 would turn `light` into `rich`).

### 3.5 Boundary position `[Mask E1 reused]`

A load-bearing member at `T_S − 1` counts normally but caps that value's confidence at `moderate`.

---

## 4. The S0 routing gate (lane step 3)

### 4.0 Outputs

`route` ∈ `styling · leave_in · oil · heat_protectant · dry_shampoo · provisional_boundary`. A `provisional_boundary` carries exactly one `boundary_reason`:

| `boundary_reason` | Meaning | Remedy |
|---|---|---|
| `evidence_gate` | A step-1 input is missing (no C1/C2 promise, no directions, incomplete INCI) | evidence work (a fresh capture), never a ruling — Mask's `insufficient_information` distinction |
| `claim_conflict` | Two C1/C2 sources disagree on the lead promise | review |
| `formula_conflict` | T18 tier 2: a same-market INCI set conflict, incl. two INCIs under one GTIN (§2.2 A2), that does not reach tier-1 convergence | a C1 pack capture, or a capture set that reaches T18 tier 1 |
| `mixed_promise` | Step 2 `mixed` after tie precedence (§4.2), D7 did not fire | review |
| `li_g0_provisional` | LI G0's own `provisional_boundary` (LI §2.3.2 clauses 2/4) | review |
| `pending_leave_in_addendum` | The PH1-16 hold (§4.5): Styling S0 says `styling`, the locked Leave-in G0 would also claim the product | released by the Leave-in addendum |

Every `provisional_boundary` **stays in its current category** and routes to review (charter §5).

### 4.1 Step 1 — Evidence gate

S0 runs only when all three hold:
1. a **C1/C2 primary promise** (pack, manufacturer DE page, house brand on its own retailer page, or `C2_cross_market_verified`);
2. **captured directions** (any G1 tier, verbatim);
3. a **complete INCI** with `identity_status` `verified` or `verified_with_minor_source_difference`.

Any input missing ⇒ `provisional_boundary (evidence_gate)`; two C1/C2 sources leading with different promise classes ⇒ `provisional_boundary (claim_conflict)`; a formula conflict ⇒ `provisional_boundary (formula_conflict)`.

**Tail-only INCI defects `[RG2-24, P2-3]`.** An INCI defect confined to the tail — at or below T_S: a truncation inside the allergen block, a split fragrance or oil token, a missing separator in the fragrance block — **does not block S0**; the record carries review `inci_tail_defect` and input 3 counts as met. A defect above T_S blocks (`evidence_gate`). The S0 packet carries `identity.inci_flags`, so a lane sees the defect and its position (§10.2). Round-2 cases: `jean-und-len-sea-salt-spray` (allergen block continues past the capture), `balea-locken-revitalizing-spray` („CITRONELLOL SODIUM CHLORIDE" r15, T_S Sodium Benzoate r4), `cantu-lockencreme-kokos` („SIMMONDSIA CHINENSIS (JOJOBA)" r18 / „SEED OIL" r19, T_S Parfum r5; re-joined by the round-3 freeze, P2-4) — none blocks. `neqi-diamond-glass-styling-spray-all` is **not** a tail-defect case: the re-check found its list complete (pack and neqi-hair.com agree, 14 items, ending „Glycerin"), so the truncation flag is withdrawn and nothing blocks it `[R2-H4]` (§4.6; §13.2 item 2).

**Leave-on and rinse-out directions `[RG2-20]`.** When the directions offer both a leave-on and a rinse-out use, the **first-named use decides the category**; the other use is recorded only (PH1-7: one product = one route). E.g. `redken-one-united-all-in-one-multi-benefit-treatment` („1. Variante: … Nicht ausspülen" first) ⇒ the leave-on use decides; `guhl-locken-pflege-und-styling-3in1` names „Spülung: … ausspülen" first (pack back „3in1 ANWENDUNG: 1 - Spülung … 2 - Kur … 3 - Lockencreme"), and R2-H2 rules it a care product (below; §4.6).

**A care cream that can also be left in stays care `[R2-H2]`.** A care product (conditioner, mask, Kur) whose directions also offer a leave-in curl-cream use is a care cream left in — a Leave-in-type use — and **stays in its current category**; it is not a Styling S0 route. Only a fixative-class polymer (lexicon FX-1…FX-4) above the tail or the D7 middle band (§4.3 3.4 (i)) makes such a product Styling. The leave-in use is recorded for the Leave-in addendum (PH1-16). Signals that identify the care product: the first-named use is rinse-out (RG2-20), the manufacturer shelves it with conditioners/masks, and the hold is stated to come from care, not fixation. Case: `guhl-locken-pflege-und-styling-3in1` (pack back directions start with Spülung; guhl.com files it under „Spülungen, Kuren & Seren" and says „Der Halt entsteht dabei durch Pflege, nicht durch Fixierung."; no fixative-class polymer) ⇒ care, stays in its current category. S0 never emits a Styling route or profile for it: the record stays `provisional_boundary` (which keeps a product in its current category, §4.0) with the R2-H2 reading in its rationale (§4.6, §11.15).

**Owner-named routes: a ruled destination is not permission to emit a profile.** A product whose route an owner ruling names (§4.6 registry) records that route as `ruled_route`. The ruling overrides **only promise-evidence failures** — the questions an owner ruling actually answers (which category the product's promise belongs to):

| Overridden by an owner ruling | Cohort cases |
|---|---|
| (a) input 1 missing: **no C1/C2 primary promise** (C3/C5 claims only) | Bumble and bumble Brilliantine, Color Wow Dream Coat (D2-named); John Frieda Lockencreme Traumlocken (D7-named) |
| (b) `claim_conflict`: two C1/C2 sources lead with different promise classes | Elnett Stylingspray 3 Tage Glatt (PH1-14) |
| (c) a step-2 `mixed` reading (§4.2) | NEQI Diamond Glass Ultimate (D3/T15, §11.4) |

In those three cases the product takes the ruled route (then the PH1-16 hold, §4.5, still applies); under (a) its claim-keyed fields take their no-claim values and it carries `claim_authority_gap`; every override carries `ruled_route_override`.

**Never overridden.** Input 2 (no directions), input 3 (incomplete INCI, or `identity_status` other than `verified` / `verified_with_minor_source_difference`), a formula conflict (§2.2 A2, LI T18 tier 2, PH1-8) and an identity conflict keep blocking value emission even for a named product: S0 emits `provisional_boundary` with that `boundary_reason` (`evidence_gate` or `formula_conflict`), the `ruled_route` is recorded as the destination once the block clears, and **no Styling value is emitted** (§4.7). Example: `syoss-curl-control-hydrating-spray` is ruled Leave-in (PH1-13) but stays blocked on its DE identity (dm.at INCI).

### 4.2 Step 2 — Promise class and the Leave-in-function tag

**Promise class** (structured judgment, C1/C2 only; the confirmed product name is C1/C2 positioning):

| Class | Anchor |
|---|---|
| `styling_result` | The lead promise is a visible styling result: shape/hold, curl or wave definition, volume, texture, sleekness, shine/finish (charter §2) — **including** reviving curls or a style between washes (the `refresher` job) |
| `care` | The lead promise is conditioning, repair or moisture |
| `heat_protection` | The lead promise is protection from heat (e.g. „Hitzeschutzspray") |
| `refresh` | The lead promise is **hair freshness / oil absorption / cleansing** between washes (the Dry Shampoo sense; charter §2 "refresh/cleansing (dry shampoo)") — never curl revival |
| `mixed` | The lead claim states two classes as **co-equal jobs** („Styling und Schutz in einem") **and** the tie-precedence rule below does not assign a class. A care or curl word **in the product name** never settles a care-vs-definition tie (R1-Q3 below; `[R1-H2]` retires the v0.1 „Pflegecreme" adjective example), and a secondary bullet („Hitzeschutz bis 220 °C" under a volume promise), an ingredient call-out („mit Arganöl") or an adjective on the result („gepflegte Locken", R2-Q1) does **not** make a promise mixed. **A C1/C2 promise covering both a care job and curl definition is always `mixed` (R1-Q3 as narrowed by R2-Q1, below).** A protection lead that names heat among other protections is `heat_protection`, not `mixed`; it is `mixed` only when it joins protection with a styling or care job `[RG2-19]` |

**Tie precedence (part of class assignment, applied before any `mixed` reading) `[charter §5 Dry Shampoo row; concept §2 S0 table; dry-shampoo/decision.md]`.** When the co-equal lead jobs are **refresh in the Dry Shampoo sense** (hair freshness, oil absorption, cleansing between washes) **and** a volume/texture styling result, the class is **`refresh`**, not `mixed`: the charter's Dry Shampoo boundary rule says "tie ⇒ Dry Shampoo", and the Dry Shampoo decision already owns volume/texture as a refresh product's styling direction (`styling_effect: volume_texture`), so such a product is a Dry Shampoo with a volume direction. The record keeps `promise_tie: refresh_plus_volume_texture` in its S0 rationale. Curl revival is never Dry Shampoo refresh (it is `styling_result`, the `refresher` job), so this rule never applies to a curl refresher. Every other co-equal pair stays `mixed`.

**Lead promise `[RG-5 as adjusted by R1-Q3; R1-T]`.** A packet may list several C1/C2 promise lines without marking the headline. The **lead promise** — the line that sets the class — is picked in this order:
1. the **job word of the confirmed product name**, when it names exactly one (Lockencreme ⇒ definition; Hitzeschutzspray ⇒ heat protection; Finishing-Spray / Glanzspray ⇒ finish). **A name with two or more job words does not decide; go to step 2** `[R1-H1]` (Elnett „Stylingspray Hitzeschutz 3 Tage Glatt" ⇒ pack front „Hitze Styling-Spray, glatt 3 Tage, starker Halt" ⇒ styling result, as PH1-14 rules). **Counting the name's job words `[RG2-21, RG2-5]`:** the product-type noun (Haarspray, Gel, Wachs, Puder, Schaumfestiger) names the job when it is the only job noun, and a shine or strength qualifier in the same name is not a second job (`schwarzkopf-taft-haarspray-glanz-halt-4` „Haarspray Glanz Halt 4" ⇒ one job, hold, so `hairspray`, as §5 says); name job words that name the same job count as one (Curl + Defining + Shaper on a curl product; „Glanz-Spray … Silky Shine");
2. else the **first C1 pack-front line**;
3. else the **first C2 line**.

**A line with no job word is skipped `[RG2-17]`:** at steps 2 and 3, a lead line that states no job word („Haarwachs-Stift für trendige Styles", „Praktische Anwendung") is passed over and the next C1/C2 line with a job word is the lead (`balea-haarwachs-styling-stick`, sealed round-2 slot 2: past „Haarwachs-Stift für trendige Styles" and „Praktische Anwendung" to „Für ein glattes & glänzendes Finish", the reading both lanes took in round 2 ⇒ `shine_finish`). **The name step comes first `[R2-H3]`:** RG2-17 applies only at steps 2 and 3; when the confirmed name names exactly one job (step 1, RG2-21), the name decides and later lines with a more specific job word are secondaries. `balea-haarwachs-styling-stick` (pack name „Styling WAX STICK", dm title „Haarwachs Styling Stick": one product-type noun, Wachs/Wax) ⇒ lead = molding ⇒ **`molding`**, not `shine_finish`; „glattes, glänzendes Finish", „Ideal für den Sleek-Look" and „auch gegen Babyhaare" are secondary jobs and uses (§4.6, §11.16).

The lead is **co-equal (`mixed`)** when it joins two classes itself with „und", „&", „+" or a „2in1/3in1" that names both (GUHL „Pflege & Styling", Taft „Textur und Pflege"). Packet side: each promise line carries its position (pack front, headline, bullet).

**Care + curl definition ⇒ `mixed`, whatever the name `[R1-Q3]`.** A product whose C1/C2 promise covers **both care and curl definition** is `mixed` ⇒ manual review. **The product name never breaks that tie** in either direction: a care noun in the name (Pflege-Spray, Kur, Balsam) does not make the product `care`, and a curl noun does not make it `styling_result`. Examples: Garnier Fructis Locken Methode Feuchtigkeitsboost Pflege-Spray („Feuchtigkeit und definierte Locken") ⇒ `mixed` (review); GUHL Locken Pflege & Styling 2in1 / 3in1 ⇒ `mixed` (review). Each such product is decided by hand — GUHL 3in1 was: a care product, not Styling, staying in its current category `[R2-H2]` (§4.1). The lead-promise order above still picks the headline for every other purpose (subtype job, `primary_job`, §6.10). **PH1-12 is unchanged:** for a `mixed` product the D7 middle-band test runs first (stop paragraph below).

**What counts as each half `[R2-Q1, RG2-1]`** (narrows R1-H2; SFS-15 governs adjectives and call-outs):
- **Care half = a care job the C1/C2 promise states:** moisturise, nourish, repair, condition, detangle („spendet Feuchtigkeit", „pflegt", „repariert", „entwirrt"), including those words in the confirmed name („Pflege", „Care", „Detangling", „Feuchtigkeits-"). **Not** the care half: an adjective describing the styled result („gepflegte Locken", „geschmeidige Locken"), a feel line, or an ingredient call-out („mit Squalan und Jojoba-Öl angereichert"). **Feel lines never count `[R2-H5]`**, whatever their position: „Verbesserte Geschmeidigkeit", „für ein geschmeidiges Haargefühl", „Geschmeidigkeit und verbesserte Kämmbarkeit" describe how the hair feels, not a promised care job (§11.2). A care job must also be promised **at C1/C2**: a care word found only in retailer text (C3) is not the care half `[R2-H1]`. R1-H2's „a care word in the name or an adjective" now reads „a care word in the name".
- **Definition half = a promise to define curls or waves:** „definiert", „Definition" (on a product for curly or wavy hair), or a curl/wave noun with a shaping or setting verb (`[RG2-5]` below). **Reviving or reactivating curls is refresh, not definition** (the `refresher` job, `styling_result`).
- When the promise is not `mixed` on this reading, the existing border rules decide on the ingredients: D7 (3.4 (i)), LI G0 / T15 (3.4 (iii)) and D6 with the PH1-13 effective-amount test. Examples (R2-Q1): `redken-refreshing-curl-mist` („REVITALISIERT UND REAKTIVIERT LOCKEN" and „Für langanhaltend gestylte und gepflegte Locken": revival + a result adjective ⇒ `styling_result`) ⇒ D6 ⇒ Styling `refresher`, held (§4.6, §11.13); `wella-eimi-nutricurls-fresh-up` — **corrected by R2-H1:** its promise lines are on wella.com/professional/de-DE (C2), where the product is „EIMI Fresh Up"; „Curl Refreshing Detangling Spray" and „entwirrend" are retailer text only (C3), so no care job is promised at C1/C2 and the promise („Frische deine Locken auf und erhalte Definition, Glanz und Anti-Frizz-Effekt.") is **not** a care + definition tie; the border ingredient checks (D6 / T15) decide in round 3 (§4.6, §11.14). Unchanged: Garnier Locken Methode Pflege-Spray („Feuchtigkeit und definierte Locken") and GUHL 2in1 stay `mixed`; GUHL 3in1 is ruled a care product by R2-H2 (§4.1) and stays in its current category; `moroccanoil-glaettende-creme-smoothing-lotion` („pflegende … Stylingcreme … verleiht … Geschmeidigkeit und Definition … um trockenes Haar zu pflegen", sealed round-2 slot 7) is `mixed` (care job „pflegen" + „Definition" for curly hair).

**Leave-in-function tag** (input to step 3.4 (ii)): `li_function: yes` when the C1/C2 lead promise or confirmed name states one of LI §2.1's own functions — **conditioning/care, detangling, smoothing/anti-frizz, curl support (definition or revival of curls/waves), heat-styling support** — and `no` when it states only hold, volume, texture, molding/shaping, or shine/finish. **A curl or wave noun with a shaping or setting verb states curl definition `[RG2-5]`** („Locken formen", „Curl Shaper", „Styling-Spray für Locken über Nacht", „Wellen über Nacht") ⇒ `li_function: yes`, primary `definition` (§6.10); shaping without a curl/wave noun is `hold_fix` (`li_function: no`). **`li_function` is what scopes the Leave-in border check `[PH2-1]`** (step 3.4 (ii)).

**Anti-frizz on dry, finished hair is the shine-finish job `[R1-Q2, RG-6]`.** Flyaway or frizz control promised for **dry, styled hair** is part of the `shine_finish` job (§5 anchor „shine, flyaway control on dry hair") ⇒ `li_function: no`, so 3.4 (ii) routes it to `styling` directly and the PH1-16 hold does not apply (§4.5). The product's **main directions** decide („Nach dem Styling … auf das trockene Haar sprühen"); a **side tip** („bei krausem Haar vorher ins handtuchtrockene Haar") does not. Anti-frizz promised **for damp hair**, or **sold as care**, keeps `li_function: yes` and the full Leave-in check. Missing directions cannot establish the dry-hair reading: the product stops at the evidence gate (§4.1). Outcomes: Balea Glow & Shine Finishing Spray and Feschi Smooth & Shine ⇒ `shine_finish`, not held (Feschi once its evidence gate passes); Balea Finishing Stick stopped at the evidence gate in v0.2 (no directions); the round-2 capture carries C1 pack directions, so it now reads `shine_finish` (§4.6). A care-ingredient test was considered and set aside by the owner (R1-Q2).

**`mixed` stop, with the PH1-12 exception.** The stop applies to the combinations left after tie precedence. If the class is `mixed`, run the D7 middle-band test (step 3.4 (i)) **first**. If it fires ⇒ `styling`, subtype `curl_cream`, even with a care or heat co-promise. Otherwise ⇒ `provisional_boundary (mixed_promise)`. `[PH1-12]`

### 4.3 Step 3 — Pair rules, in fixed order

The charter's "exactly one pair rule applies" is implemented as an ordered selection, so a product with a secondary heat claim and an aqueous formula is not tested twice. `[operational]`

**3.1 Oil — name rule `[D2]`, scoped to shine and anti-frizz products.** **Scope:** this step runs **only** when the C1/C2 lead promise is shine, finish, anti-frizz/flyaway control or a smoothing finish (class `styling_result` with a shine, sleek or frizz-control lead; D2 rules "the Oil ↔ Styling boundary **for shine and anti-frizz products**"). Any other lead promise skips 3.1, whatever the name: a protection-first „Serum" (class `heat_protection`) goes on to 3.3 (Heat Protectant), a curl-definition or care-led „Serum" goes on to 3.4/3.6. Within scope: sold as „Öl" or „Serum" (confirmed C1/C2 name) ⇒ `oil`, whatever the formula. Exception: a water-based „Serum" that is really a leave-in conditioner ⇒ go to 3.4 (LI G0 decides). **Exception test `[RG-15, as amended by R2-Q2 / RG2-2]`:** `Aqua` above T_S (aqueous, lexicon §0.3) **and** either an LGN pair above T_LI **or** a cationic conditioner or cationic polymer (lexicon CA-1…CA-5) above T_LI **or below it down to — not including — the first pH adjuster (lexicon PH-1) listed after T_LI** (fallback `Parfum`; no yardstick ⇒ review `care_yardstick_missing`) — the D6 dose rule of PH1-13 ⇒ go to **3.4 (iii)** (LI G0 decides), skipping 3.4 (ii) even when the promise is shine-only (`li_function: no`); trigger `water_based_serum_exception` (plus `care_decided_below_preservative` when the cationic sits below T_LI). Otherwise a „Serum" in scope is `oil`; real oil and silicone serums stay Oil by name (D2). Cases: `balea-professional-haarserum-glow-und-shine` (Behentrimonium Chloride r5 above T_LI ⇒ `leave_in` under both readings); `balea-haarserum-anti-frizz-glatt-und-glossy` (R2-Q2: Aqua r1, Cetearyl Alcohol r3, Behentrimonium Chloride r12 just below T_LI Ethylhexylglycerin r11 and above the yardstick Citric Acid r20; damp-hair directions; „ohne Silikone" ⇒ exception ⇒ 3.4 (iii) ⇒ `leave_in`, matching the registry, §4.6). Every other shine/finish/anti-frizz name (Glanzspray, Shine Spray, Finishing Spray, Brilliantine, Anti-Frizz-Spray) continues.

**3.2 Dry Shampoo `[charter §5; dry-shampoo/decision.md]`.** Class `refresh` — including a refresh + volume/texture tie, which §4.2's tie precedence already assigned to `refresh` — **or** directions/promise positioned on oil absorption or cleansing ⇒ `dry_shampoo`. Texture/grip with no refresh positioning ⇒ continue. The formula (starch powder, silica) never decides this boundary.

**3.3 Heat Protectant `[charter §5; heat-protectant/decision.md]`.** Class `heat_protection` ⇒ `heat_protectant` (protection-first, even with a fixative: got2b Schutzengel, VP/VA r2). A protection lead that names heat among other protections (Feuchtigkeit, Umwelt) is class `heat_protection` (§4.2, `[RG2-19]`): `osis-super-shield` („multifunktionales Schutzspray … vor Umweltbelastungen, Hitze und Feuchtigkeit zu schützen") ⇒ `heat_protectant`. A heat claim that is **not** the lead promise does not select this pair; it is captured and handled by PH1-15 (§6.7).

**3.4 Leave-in** — class `styling_result` or `care`, formula **aqueous** (lexicon §0.3). Sub-steps in order:

- **(i) D7 middle band `[D7, PH1-12]`.** All three ⇒ `styling`, subtype `curl_cream`:
  1. a fixative-class polymer (lexicon FX-1…FX-4) **above T_LI** — generic Acrylates Copolymer only when FX-2c corroborated; an uncorroborated one cannot establish this limb (review);
  2. a **substantive conditioning system** — LI G0's conditioning half reads not thin (LI COND ≥ `moderate`, the T15 reading). **Never the R2 care test** (PH1-13: R2 "is not to be used as the T15 thin test");
  3. sold as a curl or styling cream or balm („Lockencreme", „Curl Cream", „Styling Cream/Balm … Locken"). Scope: the curl-cream middle band only. A curl cream **without** a fixative stays under T15 ⇒ Leave-in, even when named „Lockencreme" (Cantu Kokos, HASK, Bali Hydrating).
- **(ii) Border scope: the Leave-in check applies only where the promise overlaps Leave-in's own definition `[PH2-1]`.** Class `styling_result` with `li_function: no` — the C1/C2 promise is volume, hold, texture, shaping/molding or shine ⇒ `styling` **directly, with no Leave-in check** (no T15, D6 or D7). Leave-in's own definition (LI §2.1: care, detangling, smoothing/anti-frizz, curl support, blow-dry/heat support) does not cover such a product, whatever conditioning the formula carries (e.g. Balea Föhnlotion Volume Effect and the 9 "care + no polymer" volume/hold/molding products). Promises that overlap Leave-in (`li_function: yes`) keep the full check: (i), (iii), D6. **Accepted consequences (PH2-1):** Garnier Fructis „Leave-In Spray" Diamond Sleek ⇒ `leave_in` (smoothing promise, real care, no fixative); Wella EIMI Flowing Form ⇒ `provisional_boundary` (D7 covers curl creams only).
- **(iii) LI G0 unchanged `[D3, T15; LI §2.3, §2.3.2 reused]`**, read with the **Styling** fixative-class list (FX-1…FX-4, PH1-16), T_LI, and LI §2.3.2's precedence (positioning half C1/C2 only):
  - `excluded_styling_first` (fixative-class route, thin conditioning, C1/C2 positioning on durable hold or texture) ⇒ `styling`;
  - `in_category` (incl. T15 `incidental_film`: a conditioning film with a supporting fixative — NEQI) ⇒ run **D6** below; if D6 does not fire ⇒ `leave_in`;
  - LI G0 `provisional_boundary` ⇒ `provisional_boundary (li_g0_provisional)`.
- **D6 — the exception `[D6, PH1-10, PH1-13]`.** All three ⇒ `styling`:
  1. **no real hold**: no FX-1…FX-4 member above T_LI. PQ-11/-16/-46/-69 (FX-R; PQ-69 by R1-T), FX-U, natural films, salts and particles are not real hold (D6 clarification, PH1-6). An uncorroborated generic Acrylates Copolymer (lexicon FX-2c) **or Polysilicone-9 `[R1-H3]`** above T_LI leaves this limb **unresolved** ⇒ D6 neither fires nor is excluded on it; the product goes to `provisional_boundary (li_g0_provisional)` + review `acrylates_copolymer_function_unresolved` (FX-2c) or `hair_fixing_silicone_unresolved` (Polysilicone-9) (§1.1 item 1);
  2. **no real care** by the PH1-13 effective-amount rule (R2): oils, esters, butters/hydrocarbons, plain silicones and fatty alcohols count **only above T_LI**; cationic conditioners, cationic polymers (incl. PQ-11/-16/-46) and amino silicones count above T_LI **or** below it down to — not including — the first pH adjuster (lexicon PH-1) listed after T_LI (fallback `Parfum`; no yardstick ⇒ review `care_yardstick_missing`). Humectants, panthenol, proteins, extracts, starch and volatile carriers never count. Any care decided below T_LI carries `care_decided_below_preservative`; a cationic below the yardstick carries `care_below_dose_yardstick`. "Real care" = any care, not COND ≥ moderate (a detangling spray counts). Oils count, as in Leave-in (PH1-10);
  3. a C1/C2 **styling-look promise**.
  - Format `[PH2-3]`: D6 applies to **any format**, not only sprays; format never routes. Example: Balea Locken Crunchgel (starch gel, no real care, no fixative, „Haargel für definierte Locken") ⇒ `styling`.

**3.5 Non-aqueous, not „Öl"/„Serum" `[operational — LI G0 + D2]`.** Class `styling_result`, water absent, only in the tail, or declared below a leading VC-1 propellant (lexicon v0.3 §0.3, `[RG2-23]`) ⇒ `styling`. LI G0 could only return `excluded_anhydrous` (oil/serum destination), and D2 reserves the Oil boundary for products sold as „Öl"/„Serum" (Balea MEN Pomade, Elnett Haarspray, got2b Curlz, taft x Gliss Shine Coat).

**3.6 Anything else** (class `care` with no Leave-in claim, an unforeseen combination) ⇒ `provisional_boundary`, review. Never a confident route by default.

### 4.4 Step 4 — Names route in exactly two places `[D2, D7]`

D2 (Oil, only for products whose lead promise is shine, finish, anti-frizz or a smoothing finish — §4.3 step 3.1) and D7 (curl-cream middle band). Nowhere else does a name route **on its own**, and a name never stands in for formula evidence (an F value). The one other use of a name is as **promise evidence**: the job word of the confirmed name picks the lead promise (§4.2 step 1, RG2-21, R2-H3; e.g. Balea „Styling WAX STICK" ⇒ `molding`). Formula-type nouns in a name are never read as ingredients: Taft „Gel Wax" has no wax or gel former; got2b „Texture Clay" has no clay; Taft Volumen Schaumfestiger „Halt 4" has no synthetic polymer. Retailer facets are never evidence (alverde Beach Waves „ohne Alkohol" with Alcohol denat. r3; Color Wow „silikonfrei" with Polysilicone-29 r3).

### 4.5 Step 5 — The PH1-16 double-claim hold `[PH1-16, PH2-2]`

After steps 1–4 say `styling`, run the **locked** Leave-in G0 letter once more: LI L5 only (no FX-4), no D6, no D7, T_LI. If it would return `in_category` or `provisional_boundary` — i.e. the Leave-in engine could also claim the product — the S0 output is `provisional_boundary (pending_leave_in_addendum)` with `lean_route: styling` and the lean subtype. Products that reach `styling` through LI G0 `excluded_styling_first` (with LI L5), through 3.4 (ii), or through 3.5 are not double-claimed and are not held.

Under PH2-1, a product whose promise names no Leave-in function (`li_function: no`) is never Leave-in-claimable: LI's `in_category` needs an LI §2.1 function, and LI's `provisional_boundary` is reserved for genuine evidence conflicts (LI §2.3.2 clause 4), which a hold or volume promise is not.

What reaches the hold: every D6 route, every D7 route, every Styling route that rests on an FX-4 member alone where LI L5 sees none, and every owner-named Styling route that the Leave-in letter would claim (§4.6).

**Scope `[PH2-2]`.** The hold covers **every Styling route the unchanged Leave-in letter would also claim** — all D6 and D7 moves and the owner-named routes — decided by re-running the locked letter as described above; it is not limited to the products charter §13 item 1 names.

**Carriage `[PH2-2]`.** A held record gets the **complete** Styling profile (every F, U, C and D field), marked `provisional`, with its lean subtype. It **counts toward the PH1-11 "≥ 5 per subtype" criterion, reported separately** from committed records. It is **not matchable or recommendable** until the Leave-in addendum is approved.

### 4.6 Registry of owner-named routes (they override the procedure where it would differ, within the §4.1 limits: promise-evidence failures only, never identity or formula blocks)

| Product (`sample_id`) | Ruled route | Ruling | S0 letter without the ruling | Held (PH1-16)? |
|---|---|---|---|---|
| Maria Nila Curlicue (`maria-nila-curlicue-cream`) | styling `curl_cream` | T15, D3 | same (LI G0 `excluded_styling_first`) | no |
| NEQI Diamond Glass Ultimate (`neqi-diamond-glass-ultimate-styling-spray`) | leave_in | T15, D3 | same | — |
| NEQI Diamond Glass Styling Spray **All** (`neqi-diamond-glass-styling-spray-all`) | leave_in, **not blocked** (R2-H4: the INCI is complete — pack and neqi-hair.com agree, 14 items ending „Glycerin"; the truncation flag is withdrawn) | **R2-Q4** (extends D3 to the fixative-free sibling: conditioning silicone film — Polysilicone-29 r7 above the first preservative Ethylhexylglycerin r8, Silicone Quaternium-18 r10 just after Hydroxyacetophenone r9 — no hold polymer, damp hair before blow-drying); reopening D3 was declined. **R2-H4** releases it | `mixed` (C2 „Styling + Hitzeschutz in einem", RG2-19: protection joined with a styling job) ⇒ the ruling overrides it (§4.1 (c)); the letter's Leave-in reading (3.4 (iii); D6 does not fire: Polysilicone-29 r7, a plain silicone above T_LI, is real care) is also `leave_in`. No classic preservative is declared (the markers are the multifunctionals Ethylhexylglycerin / Hydroxyacetophenone, lexicon §0.2). Round-3 capture: C2 directions from neqi-hair.com („handtuchtrockene (nicht nasse) Haar … mit Hitze und auf Spannung föhnen"), the C1 pack line with „Hitzeschutz bis zu 230°C"; hair-type lines re-sourced to neqi-hair.com (C2) | — |
| Taft Styling Balm Locken · Balea Pro Styling Cream Traumlocken · John Frieda Lockencreme Traumlocken | styling `curl_cream` | D7 (+ PH1-12 for Balea; its „Verbesserte Geschmeidigkeit" is a feel line, never the care half, **R2-H5**, §11.2) | same via 3.4 (i) for Taft and Balea. John Frieda: no C1/C2 promise (C3 only; §4.1 override (a)), and its only fixative candidate, generic Acrylates Copolymer r2 in an aqueous HEC/NaOH cream, is not corroborated under lexicon FX-2c ⇒ the D7 letter cannot establish the fixative limb; **the route rests on the D7 naming**, while its F reading stays `hold_route: ambiguous` + review `acrylates_copolymer_function_unresolved` | **yes** |
| Cantu Lockencreme Kokos · HASK Curl Care · Bali Curls Hydrating Curl Cream | leave_in | D7 scope, T15 | same; *v0.2:* where the C1/C2 promise covers a care job and curl definition, the letter reads `mixed` (R1-Q3, R2-Q1) and the ruling overrides it (§4.1 (c)). Cantu's split token „SIMMONDSIA CHINENSIS (JOJOBA)" r18 / „SEED OIL" r19 is a tail defect: `inci_tail_defect`, no block (RG2-24) | — |
| Balea Locken Revitalizing Spray · Balea Leave-In Spray Sea Salt Care & Define | styling `refresher` · `salt_spray` | D6 | same for Revitalizing (its „CITRONELLOL SODIUM CHLORIDE" r15 is a tail defect: `inci_tail_defect`, no block, RG2-24). Sea Salt Care & Define: under R2-Q1 the name's „Care" is a care job and „Define" / C2 „Griffigkeit und Definition" the definition half ⇒ the letter reads `mixed`; the D6 ruling overrides it (§4.1 (c)), as lane A read it in round 2 | **yes** |
| Redken Refreshing Curl Mist (`redken-refreshing-curl-mist`) | styling `refresher`, held | **R2-Q1** (revival is refresh, „gepflegte Locken" is a result adjective) + D6 (PH1-13) | same: not `mixed` ⇒ 3.4 (iii) LI G0 `in_category` ⇒ D6 fires (humectants only above T_LI Phenoxyethanol r4; Polyquaternium-6 r7 below the yardstick Citric Acid r5; jojoba r11 / squalane r12 after the preservative; no fixative) (§11.13) | **yes** |
| Wella EIMI Nutricurls Fresh Up (`wella-eimi-nutricurls-fresh-up`) — „EIMI Fresh Up" on wella.com DE | **no owner-named route since R2-H1**; the letter decides in round 3 (expected `leave_in`) | **R2-H1** corrects the R2-Q1 example: the promise lines are on wella.com/professional/de-DE (**C2**, re-stamped from lookfantastic.de per A9); „Detangling"/„entwirrend" appears only in retailer text (C3) ⇒ no C1/C2 care job ⇒ not an R1-Q3 tie. INCI: the retailer list is the formula of record; the list printed on Wella's DE page (a wax list: Ceresin, Petrolatum, Carnauba, iron oxides) is a page error (A10), review `formula_source_page_error` until a pack INCI is captured | not `mixed` (definition + revival + shine + anti-frizz, no care job) ⇒ `li_function: yes` · aqueous · 3.4 (i) not a curl cream · 3.4 (iii) LI G0 · D6: no fixative above T_LI (PVP r9 and AMP-Acrylates/Allyl Methacrylate Copolymer r11 sit below Phenoxyethanol r6) but real care (Polyquaternium-10 r13 above the yardstick Citric Acid r17) ⇒ D6 does not fire ⇒ `leave_in` (to be confirmed blind, §11.14) | — |
| alverde Locken Refresh-Spray | styling `refresher` + review | PH1-13 | same (D6; `care_below_dose_yardstick`) | **yes** |
| syoss Curl Control Hydrating Spray | leave_in, review (identity-blocked) | PH1-13 | evidence gate (C3, dm.at INCI) | — |
| Balea Pro Definier Spray Traumlocken | leave_in; „24 h" flagged | PH1-10 | same (oils above T_LI = real care) | — |
| Balea Haarserum Anti-Frizz Glatt & Glossy (`balea-haarserum-anti-frizz-glatt-und-glossy`) | leave_in | D6 example; **R2-Q2** | same since v0.3: the 3.1 water-based-serum exception now reads Behentrimonium Chloride r12 (below T_LI Ethylhexylglycerin r11, above the yardstick Citric Acid r20) ⇒ 3.4 (iii) ⇒ `leave_in`, no override needed (v0.2's letter said `oil`) | — |
| Redken One United · EVO Cuticle Sealer | leave_in | D6 examples | same. Redken One United: leave-on is its first-named use („1. Variante: … Nicht ausspülen"), the rinse-out variant is recorded (RG2-20); under the host rule (A9, **R2-H6**) the lines found on redken.eu/de-de are C2 with that source („verbesserte Kämmbarkeit", „schützt vor Hitze, Haarbruch und Spliss", „gibt Glanz", the hair-type line; INCI re-sourced to redken.eu), the other redken.co.uk lines are C5 (P2-6). EVO: every claim and the INCI come from evohair.com/us ⇒ C5 (R2-H6); with no C1/C2 promise **and** no directions it stops at the evidence gate (`ruled_route: leave_in`; missing directions are never overridden, §4.1) | — |
| Elvital Öl Magique · Frizz Ease Haarserum · Garnier Sleek & Stay Haarserum | oil | D2 | same | — |
| Bumble and bumble Brilliantine | styling `shine_finish` | D2 | evidence gate (C3 only) | no |
| Balea PROFESSIONAL Leave-In Glow&Shine Finishing Spray (`balea-professional-glow-und-shine-finishing-spray`) | styling `shine_finish`, recommendable | D2 (not „Öl"/„Serum"), **R1-Q2** (anti-frizz on dry, finished hair = the shine-finish job, `li_function: no`) | same: 3.4 (ii) under v0.2 (main directions „Nach dem Styling … auf das trockene Haar sprühen"); 3.5 under lexicon v0.3, because its propellant r1 leads Aqua r8 (RG2-23) — same route, not held. Round 1 split held vs committed (RG-6); its promise line „Wirkt einem Anti-Frizz-Effekt entgegen" is queued for a re-read (P-7); the route does not depend on that line | **no** |
| Feschi smooth & shine Anti Frizz Spray (`feschi-smooth-and-shine-anti-frizz-spray-glanzspray`) | styling `shine_finish` once its evidence gate passes | R1-Q2 (main directions: after styling, on the dry lengths; the damp-hair „Tipp" is a side tip) | evidence gate (C3 claims only) until a C1/C2 promise is captured | no |
| Balea Fixierungsbürste Styling Finishing Stick (`balea-styling-finishing-stick`) | styling `shine_finish` (v0.2: `provisional_boundary (evidence_gate)`, no directions) | R1-Q2 | the round-2 capture carries C1 pack directions („Nach dem Frisurenstyling sanft über die abstehenden Härchen streichen") ⇒ the evidence gate passes ⇒ flyaway control on dry, finished hair ⇒ `shine_finish` (both round-2 lanes); `identity_status: verified` (RG-7); its name job words stay visible under R2-Q3 (P2-1) | — |
| Balea Haarwachs Styling Stick (`balea-haarwachs-styling-stick`) — pack name „Styling WAX STICK" | styling `molding` | **R2-H3**: pack front „Styling WAX STICK", dm shelf Haare > Haarstyling > Haarwachs, „einfache Fixierung", „Ideal für den Sleek-Look", „auch gegen Babyhaare" (a secondary use; `target_zone` may read `surface`). The name step (§4.2 step 1, RG2-21) precedes RG2-17. INCI = the 14-item pack list (C1; Persea Gratissima Oil r9 before Parfum r10; Dimethyl Phenethyl Acetate r13 and Vanillin r14 added; the dm text had 12) | round 2 (sealed unseen slot 2, dm text only): RG2-17 skipped the job-less lines and both lanes read `shine_finish`; under R2-H3 the name decides ⇒ `molding`; no water in the list ⇒ 3.5 (§11.16) | no |
| Garnier Fructis Locken Methode Feuchtigkeitsboost Pflege-Spray (`garnier-fructis-locken-methode-feuchtigkeitsboost-pflege-spray`) · GUHL Locken Pflege & Styling 2in1 (`guhl-styling-spray-locken-pflege-und-styling-2in1`) | `provisional_boundary (mixed_promise)` ⇒ manual review; stays in its current category | **R1-Q3** (care + curl definition ⇒ `mixed`, whatever the name; the „Pflege-Spray ⇒ Leave-in" proposal was declined); the care halves are care jobs under **R2-Q1** („Feuchtigkeitsboost", „Pflege" in the names) | same. GUHL 2in1's directions name only a leave-on use | — |
| GUHL Locken Pflege & Styling 3in1 Lockencreme, Kur & Spülung (`guhl-locken-pflege-und-styling-3in1`) | **care product, not Styling; stays in its current category** (S0: `provisional_boundary`, never a Styling profile) | **R2-H2** (owner): pack back directions start with Spülung („3in1 ANWENDUNG: 1 - Spülung … 2 - Kur … 3 - Lockencreme"), guhl.com files it under „Spülungen, Kuren & Seren", no hold polymer („Der Halt entsteht dabei durch Pflege, nicht durch Fixierung."). General reading: a care cream that can also be left in as a curl cream stays care; only a fixative-class polymer or the D7 middle band makes it Styling (§4.1). Its leave-in curl-cream use is recorded for the Leave-in addendum | the R1-Q3 letter reads `mixed` (C1 „Tiefenwirksame Pflege & natürlich langanhaltende Definition"); D7 does not fire (no fixative-class polymer); RG2-20's first-named use is the rinse-out Spülung. Either way it stays in its current category; R2-H2 settles which reading the record carries (§11.15) | — |
| Color Wow Dream Coat (`color-wow-dream-coat-supernatural-spray`) | styling `smoothing_styler` | D2 (corrected example) | evidence gate (C3 only); LI letter `in_category` | **yes** |
| Elnett Stylingspray 3 Tage Glatt (`loreal-paris-elnett-stylingspray-hitzeschutz-3-tage-glatt`) | styling `smoothing_styler`, level 3 + D8b flag | PH1-14 | `claim_conflict` (C1 pack front leads with result, C2 article with protection); LI letter `in_category` | **yes** |
| Balea MEN Pomade Haar & Bart 2in1 | styling `molding` (one route) | PH1-7 | same (3.5) | no |
| Balea Föhnlotion Volume Effect (`balea-foehnlotion-volume-effect`) and the 9 "care + no polymer" volume/hold/molding products | styling directly (3.4 (ii), no Leave-in check) | PH2-1 | same | no |
| Balea Locken Crunchgel (`balea-locken-crunchgel`) · Bali Curls Strong Hold Flaxseed Gel (same reading) | styling `gel` | D6 any format (PH2-3) | same | **yes** (PH2-2) |
| Garnier Fructis „Leave-In Spray" Diamond Sleek (`garnier-fructis-leave-in-spray-diamond-sleek-glaettungsspray`) | leave_in | PH2-1 (smoothing promise overlaps LI §2.1; real care, no fixative) | same | — |
| Wella Professionals EIMI Flowing Form (`wella-professionals-eimi-flowing-form`) | `provisional_boundary` (`li_g0_provisional`) | PH2-1 (D7 covers curl creams only) | same | — |
| Kevin.Murphy Killer.Curls (`kevin-murphy-killer-curls`) | styling `curl_cream`, held | PH2-10, **RG-21** | PH2-10's evidence gate is **released by the 2026-10 capture** (the frozen packet carries a C2 promise); D7 ⇒ styling `curl_cream` (both round-1 lanes). **P2-6, settled by R2-H6:** the C2 stamp rests on kevinmurphy.com.au/de/de, the manufacturer's German-language storefront (kevinmurphy.de redirects there) ⇒ C2 under the host rule (A9); the release stands | **yes** (PH2-2) |
| Langhaarmädchen Lockenwunder (`langhaarmaedchen-lockenspray-natur-lockenwunder`) | leave_in | PH1-13 R2 (cationic r4 above the preservative), PH2-11 | same | — |
| got2b Schutzengel · taft x Gliss Hitzeschutzspray | heat_protectant | charter §5.1 | same | — |
| OSiS Super Shield (`osis-super-shield`) | heat_protectant | **R2-T (RG2-19)**: a protection lead naming heat among other protections is `heat_protection` | same: lead C2 „… multifunktionales Schutzspray … um es vor Umweltbelastungen, Hitze und Feuchtigkeit zu schützen" ⇒ 3.3 (both round-2 lanes) | — |
| Balea Overnight Wellenspray (`balea-overnight-wellenspray`) | styling `gel` | **R2-T (RG2-13)**: heatless overnight setting spray ⇒ `gel`; RG2-5 („Styling-Spray für Locken über Nacht" ⇒ curl definition, `li_function: yes`); RG2-23 (Butane r2 above Aqua r9 ⇒ non-aqueous) | same: 3.5 ⇒ `styling`, not held. Round 2 split `mousse` (lane A) vs `gel` (lane B); sealed slot 1 was undetermined | no |
| got2b gotGloss Glanz Spray (`got2b-gotgloss-glanz-spray`) · taft x Gliss Silky Shine Glanz-Spray (`schwarzkopf-taft-x-gliss-silky-shine-shine-coat`) | styling `shine_finish` | **R2-T (RG2-15)**: a shine lead stays `shine_finish` whatever the moment (both are applied before the blow-dryer or iron); R2-Q3 (the name's job words stay visible) | same: lead = the name's one job, shine (step 1; „Glanz-Spray … Silky Shine" count once, RG2-5) ⇒ non-aqueous ⇒ 3.5. gotGloss only after its re-freeze as `verified_with_minor_source_difference` (P2-2: the two captures differ only inside the fragrance/allergen block). taft x Gliss's „Styling & Pflege in einem" is a later C2 line, not the lead | no (3.5) |
| got2b Trockenshampoo Extra Volumen | dry_shampoo | charter §5.1 | evidence gate (C3) ⇒ stays in its current category, Dry Shampoo | — |

### 4.7 Emission contract `[LI §2.3.1 reused]`

| Outcome | Emitted |
|---|---|
| `styling` | full record (§10) |
| `leave_in` · `oil` · `heat_protectant` · `dry_shampoo` | identity block, formula record, `route` + rationale, both markers; Styling properties **optional and marked `informational_and_non_authoritative: true`**; no subtype, no fit, no cautions |
| `provisional_boundary (evidence_gate / formula_conflict)` | identity block, formula record, the missing input, a capture work order; for an owner-named product (§4.6) also its `ruled_route`. **No Styling values** — a ruled destination does not lift an identity, INCI, directions or formula block (§4.1) |
| `provisional_boundary (claim_conflict / mixed_promise / li_g0_provisional)` | as `leave_in` above, plus both readings |
| `provisional_boundary (pending_leave_in_addendum)` | `[PH2-2]` the complete Styling profile marked `provisional`, `lean_route` and lean subtype; not matchable until the Leave-in addendum is approved (§4.5) |

### 4.8 Cohort dry run (lexicon v0.1, node; annotations of promise class and Leave-in function by hand)

| S0 path | Records | Calibration-file Styling records it covers |
|---|---|---|
| Evidence gate (no C1/C2 promise), not named in a ruling | 15 | 12: `bumble-and-bumble-surf-spray`, `living-proof-full-dry-volume-texture-spray`, `american-crew-fiber`, `cantu-shea-butter-extra-hold-edge-stay-gel`, `kevin-murphy-killer-curls` (PH2-10), `langhaarmaedchen-lockenspray-halt-sprungkraft`, `got2b-gotgloss-glanz-spray`, `feschi-smooth-and-shine-anti-frizz-spray-glanzspray`, `john-frieda-volume-lift-pushed-up-dry-texture-spray`, `jean-und-len-sea-salt-spray`, `schwarzkopf-taft-texturspray-aloe-boost` (C5), `kevin-murphy-powder-puff-volume` (C5). Plus 3 already-provisional records |
| 3.5 non-aqueous ⇒ styling | 6 | Elnett Haarspray, Balea MEN Pomade, Balea Volumenpuder, got2b Curlz, taft x Gliss Shine Coat, Moroccanoil Dry Texture |
| 3.4 (ii) promise outside Leave-in functions ⇒ styling (PH2-1) | 37 | all mousses/Föhn-sprays/powders/hairsprays/water-based molding with a C1/C2 volume, hold, texture, molding or shine promise |
| 3.4 (iii) LI G0 `excluded_styling_first` ⇒ styling | 3 | syoss Curl Cream Gel, Wellaflex Locken & Wellen, Maria Nila |
| D2-named ⇒ styling (not held) | 1 | Brilliantine |
| Held, PH1-16 (`pending_leave_in_addendum`) | 10 | D6: Balea Revitalizing, Balea Sea Salt Care & Define, alverde Locken Refresh, Balea Locken Crunchgel (PH2-3), Bali Curls Flaxseed Gel (PH2-3); D7: Taft Balm, Balea Pro Traumlocken, John Frieda Traumlocken; named: Elnett 3 Tage Glatt, Color Wow |
| LI G0 `provisional_boundary` (PH2-1) | 1 | `wella-professionals-eimi-flowing-form` (PVP r2 + PQ-37 r3 + ester + BTAC r5: middle band, but a smoothing balm, not a curl cream, so D7 does not apply) |
| ⇒ leave_in (PH2-1) | 11 | 1 calibration-Styling: `garnier-fructis-leave-in-spray-diamond-sleek-glaettungsspray` (sold as „Leave-In Spray … Glättungsspray": smoothing is a Leave-in function, argan r6 + SAPDMA r7 = care, no fixative ⇒ `in_category`; no ruling names it) |
| oil / heat_protectant / dry_shampoo | 3 / 2 / 1 | — |

**Committed Styling routes: 47.** Per subtype (node): hairspray 6 · molding 10 · blowdry_lotion 8 · mousse 5 · gel 5 · shine_finish 4 · hair_powder 3 · texture_spray 2 · salt_spray 2 · refresher 1 · curl_cream 1 · **smoothing_styler 0**. Held: curl_cream 3 · refresher 2 · gel 2 · smoothing_styler 2 · salt_spray 1. This is the PH1-11 coverage picture under the rules as ruled; held records are reported separately from committed ones (PH2-2; §13 item 1).

**Counts note.** The table was annotated by hand (promise class and Leave-in function), not by script, and it already assumed the readings later ruled as PH2-1…PH2-3 and PH2-10. It has **not** been re-derived after the Phase 2 rulings; the per-path and per-subtype counts, and the routing of `langhaarmaedchen-lockenspray-natur-lockenwunder` (Leave-in under PH1-13 R2 / PH2-11; a `provisional_boundary` stress case in the calibration file, so outside the 70 Styling records), are **to be re-derived in Phase 3 under PH2-1/PH2-2**. No count here is a result.

**Round 1 (2026-10-12).** Blind round 1 re-derived the routes on the frozen v1.0 cohort (107 records) under v0.1; the per-subtype coverage both lanes agree on is `round-1/report.md` T9 (computed by `diff.js`), and it supersedes this table as the current picture. The v0.2 rulings move these round-1 outcomes, to be confirmed in round 2: Kevin.Murphy Killer.Curls ⇒ held `curl_cream` (RG-21); Balea Glow&Shine Finishing Spray ⇒ committed `shine_finish` (R1-Q2); Garnier Locken Methode Pflege-Spray ⇒ `mixed_promise` (R1-Q3); the hold levels of Taft Styling Balm Locken (⇒ 2; the tier question of its „Halt 3" was closed by the round-2 C1 capture, §7.3) and Taft Gel Wax (⇒ 1) under R1-Q1 (§7.3).

**Round 2 (2026-10-12).** Blind round 2 ran v0.2 on the frozen round-2 cohort (139 records: 116 calibration, 15 negative control, 8 unseen). Coverage where both lanes agree on route kind and subtype is `round-2/report.md` T11 (from `diff.json` `coverage_per_subtype_agreed`): committed / held — gel 5 / 2 · curl_cream 1 / 5 · mousse 5 / 0 · blowdry_lotion 9 / 0 · smoothing_styler 0 / 1 · hairspray 7 / 0 · shine_finish 6 / 0 · salt_spray 5 / 1 · texture_spray 5 / 0 · hair_powder 8 / 0 · molding 10 / 0 · refresher 1 / 4. It supersedes the round-1 picture. The v0.3 rulings move these round-2 outcomes, to be confirmed in the next blind round: Redken Refreshing Curl Mist ⇒ held `refresher` (R2-Q1); Balea Anti-Frizz Serum ⇒ `leave_in` (R2-Q2); NEQI Diamond Glass All ⇒ `leave_in` (R2-Q4; its INCI re-check found the list complete, R2-H4); Balea Overnight Wellenspray ⇒ committed `gel` (RG2-13); Syoss Curl Cream Gel ⇒ `gel` (RG2-14; round 2 split `gel` vs `curl_cream`); got2b gotGloss and taft x Gliss Shine Coat ⇒ committed `shine_finish` (RG2-15, P2-2); OSiS Sparkler and Balea Finishing Spray Glow & Care are re-run on the R2-Q3 packet. The R2-H rulings add: Balea Haarwachs Styling Stick ⇒ `molding` (R2-H3; round 2 read `shine_finish`); GUHL 3in1 ⇒ care, current category (R2-H2); Wella EIMI Fresh Up ⇒ no longer owner-named, the border checks decide (R2-H1). `smoothing_styler` stays short (no committed record; Color Wow held): R2-T approved a targeted capture for it before blind round 3.

---

## 5. Subtype assignment (lane step 4)

Subtypes describe **how and when** a product is used (charter §3). They never set an F value (§1.2). Run in order; the first rule that decides, decides.

1. **D7 fired ⇒ `curl_cream`** (§4.3, 3.4 (i)). `[D7]`
2. **Directions lead with edges, baby hair or brows (`target_zone: hairline`) and the product is a gel-type shaping product ⇒ `gel`.** Edge control is a zone, not a subtype. `[D1]` **Brow use is recorded (PH1-7); the hair use decides the route and the subtype `[RG2-27]`** (`got2b-kleber-4-brows-and-edges-2in1-stylinggel`, `bali-curls-sleek-stick-brows-and-edges`).
3. Otherwise match the **job** (from the C1/C2 lead promise) and the **moment** (from the directions, §6.11) against the anchor table. Where the job and moment leave two subtypes open, the **product form breaks the tie** (property set §2.2). A name never decides (`[D1]`, step 4 of S0). **The moment breaks a tie only between two subtypes the job leaves open `[RG2-15]`**; it never overrides the job. **Form = what the product is as applied `[RG2-14]`:** a gel or jelly (carbomer- or polymer-thickened, self-described „Gel", a cast expected) is `gel` even when sold as a cream (Power Flex; `syoss-curl-cream-gel-3in1`, „das Gel … in das nasse Haar einkneten", a film to scrunch out); the capture `format` field alone is never a tie-breaker.

| Family → Stage-5 role | Subtype | DE label | Job anchor | Moment anchor | Tie-breaks |
|---|---|---|---|---|---|
| A Formen → `styling` | `gel` | Haargel | hold + definition, sleek looks; edges (`hairline`); **setting sprays and lotions for heatless sets (curlers, braids, overnight): hold + definition, damp or dry, shaped by a tool `[RG2-13]`** (`balea-overnight-wellenspray`) | damp or dry, shaped by hand or by a tool | vs `curl_cream`: gel/jelly/spray-gel form ⇒ `gel` (`balea-styling-creme-power-flex`: sold as „Styling Creme", a hydroalcoholic PVP/carbomer gel ⇒ `gel`; `langhaarmaedchen-lockenspray-halt-sprungkraft`: liquid curl-hold spray-gel ⇒ `gel`) |
| | `curl_cream` | Lockencreme | soft definition + frizz control with a real hold route | damp | membership only via LI G0 `excluded_styling_first` (T15) or D7; a curl cream with no fixative is Leave-in |
| | `mousse` | Schaumfestiger | volume + hold, wave/curl lift | damp, before drying | vs `blowdry_lotion`: foam form ⇒ `mousse` (`balea-ansatzvolumen-booster`); foam only — a heatless setting spray is `gel` (RG2-13) |
| | `blowdry_lotion` | Föhnlotion & Föhnspray | volume/hold created by blow-drying; root lift (`target_zone: roots`) | damp, before drying (usually `before_heat`) | absorbs Föhnspray and root lift (D1) |
| | `smoothing_styler` | Glättungsstyler | sleek result made with heat — **a sleek/straight result must be the job `[RG2-15]`** | damp or before heat | vs `shine_finish`: a pre-heat/damp moment ⇒ `smoothing_styler` **only when the job is sleek** (`color-wow-dream-coat-supernatural-spray`); **a shine lead stays `shine_finish` whatever the moment** (`got2b-gotgloss-glanz-spray`, `schwarzkopf-taft-x-gliss-silky-shine-shine-coat`); not sold as „Öl"/„Serum" (D2) |
| B Finish → `finish` | `hairspray` | Haarspray & Haarlack | fixes the finished style | `dry_finish` | vs `shine_finish`: a hold lead ⇒ `hairspray` even with a shine word (`schwarzkopf-taft-haarspray-glanz-halt-4`) |
| | `shine_finish` | Glanz- & Anti-Frizz-Finish | shine, flyaway control on dry hair — incl. anti-frizz on dry, finished hair by the main directions (R1-Q2, §4.2) | `dry_finish` / `dry_restyle`; a shine lead applied before heat stays here (RG2-15) | D2: not „Öl"/„Serum" |
| C Textur & Volumen → `styling` | `salt_spray` | Salz- & Beach-Spray | beachy, piecey texture | damp or dry, scrunched | a salt-free beach spray is still `salt_spray` (the salt mechanism is an extra, §6.15) |
| | `texture_spray` | Texturspray | dry grip, airy volume, matte texture | `dry_restyle` | vs `hair_powder`: spray form ⇒ `texture_spray` |
| | `hair_powder` | Haarpuder | root grip, matte volume | dry, roots | powder form |
| D Modellieren → `styling` | `molding` | Wachs, Paste & Pomade | restylable shape, separation; men's creams | `dry_restyle` | wax, paste, clay, fiber, pomade, cream are one subtype; `form_label` is display only (D1) |
| E Auffrischen → `styling` | `refresher` | Locken-Refresh | revive curls/waves between washes | the lead promise is revival; directions on dry hair | D5: refresh is a day-2 *instruction* reusing the gel; a `refresher` product is an optional extra (matching policy, not S0) |

Confidence: `high` when promise and directions agree; `moderate` when the form broke a tie or directions are retailer-only. A held record (§4.5) carries its **lean** subtype.

---

## 6. Properties (lane step 5)

Every property object carries the LI §4 / Mask §4 evidence record: `value`, `decision_type` (`deterministic` · `structured_judgment` · `claim_gated` · `transcription`), `confidence` (internal), `evidence_level`, `formula_observations[]` (with ranks and both markers), `supporting_signals[]`, `counter_signals[]`, `review_status`. Section numbers follow the property set's order.

### 6.1 `result_mechanisms` (F)

| Field | Rule |
|---|---|
| Values | Set of `fixative_film · natural_film · wax_lipid · particulate · salt · silicone_coat · humectant_only · none`, each with members `[{inci, rank}]` |
| Decision | **Deterministic lexicon membership above T_S** (lexicon §1, §2): FX-1…FX-4 ⇒ `fixative_film`; NF-1, NF-U (aqueous only) ⇒ `natural_film` (NF-U adds `natural_film_unsettled`); WL-1…WL-8 ⇒ `wax_lipid` (WL-1, WL-2, WL-8 tagged `structuring`); PT-1, PT-2 (non-aqueous only) ⇒ `particulate`; SA-1 ⇒ `salt`; SI-1 ⇒ `silicone_coat`; HU-1 alone ⇒ `humectant_only`; nothing ⇒ `none` |
| Never | RH-1 rheology, VC carriers, EM-1 emulsifiers, CA-1/CA-2 monomeric cationics, FX-R, FX-U and an uncorroborated generic Acrylates Copolymer (lexicon FX-2c) (they act through `hold_route`), SA-2 Sodium Chloride, SI-2/SI-3 |
| Counter-signals | §3.3 (unresolved T_S), §3.4 (`candidate_below_tail`), §3.5 (boundary position), NF-U |
| Evidence / confidence | E2. `high`: plausible T_S, members clearly above it; `moderate`: boundary member, unresolved/absent marker, NF-U; `low`: INCI source conflict |
| False signals | Names („Clay", „Wax", „Fiber"); retailer chips; tail heroes |
| Consumers | subtype extras (§6.15), D8b set (§7.5), job gate (§6.10), cautions |
| Cohort (node, 70) | fixative_film 38 · wax_lipid 28 · natural_film 11 (v0.2; **10** under v0.3, end of this cell) · particulate 11 · silicone_coat 6 · salt 5 · humectant_only 3 (fixative_film was 39 before the FX-2c condition; `john-frieda-frizz-ease-traumlocken-lockencreme` drops out). **Particulate 11 re-confirmed (node, 2026-10-12)** over the raw INCI: `balea-pure-styling-volumenpuder-spray`, `schwarzkopf-taft-texturspray-aloe-boost` (Cellulose r7, the lexicon's T4 PT-1 placement), `living-proof-full-dry-volume-texture-spray`, `schwarzkopf-taft-haarpuder-volumen`, `got2b-styling-puder-volumen-powderfull`, `balea-haarpuder-volumen-pomegranate`, `kevin-murphy-powder-puff-volume`, `balea-men-pomade-haar-bart-2in1`, `nivea-men-styling-cream-active-craft-stylers`, `moroccanoil-dry-texture-spray`, `john-frieda-volume-lift-pushed-up-dry-texture-spray`. The property set's earlier 10 used its v0 member list, which has no Cellulose; it now reads 11. Not credited: Potato Starch r2 in the aqueous Taft Schaumfestiger (NF-U), Kaolin r13 below Parfum r12 in Bali Gents Matt Paste. The three v0.2 lexicon additions occur in none of the 70. **v0.3 (node, 2026-10-12):** the lexicon v0.3 propellant reading of „aqueous" (`[RG2-23]`) flips 9 of the 70 to non-aqueous and moves one mechanism: `schwarzkopf-taft-texturspray-aloe-boost` (Dimethyl Ether r1 above Aqua r5) no longer credits Distarch Phosphate r4 (NF-1, aqueous only) and reads Tapioca Starch r8 as PT-2 ⇒ **natural_film 10** (was 11); particulate stays 11 (the record was already particulate via Cellulose r7). None of the v0.3 species placements occurs in the 70 |

### 6.2 `hold_route` (F)

| Field | Rule |
|---|---|
| Values | `present` · `absent` · `ambiguous` — the D6 "real hold" sense (fixative-class film), **never a strength** |
| Decision | Deterministic, above T_S. `present`: ≥ 1 FX-1…FX-4 member. `ambiguous`: no FX member, but an FX-R member (PQ-11/-16/-46, PH1-6; PQ-69, R1-T / RG-16), an FX-U member or an **uncorroborated generic Acrylates Copolymer** (lexicon FX-2c: LI L5 counts acrylates copolymers only when "used as fixatives", and the generic name also covers rheology modifiers); or an FX member that is `unpositioned` under §3.3. `absent`: otherwise. An FX member only at/below T_S ⇒ `absent` + `fixative_below_tail` note |
| Never | Starch, salt, particles, waxes, silicones (Polysilicone-29 alone = absent, LI L5 placement); a captured hold level never moves it (LI T7) |
| Counter-signals | LI L5 anionic/cationic pairing check — an identity check only |
| Evidence / confidence | E2 on every record (LI §7.7 freeze note), as §6.1 |
| Consumers | neutral fact (§7.6), gel film type, refresher/shine extras, D8b, job gate |
| Cohort (node) | present 38 (3 rest on FX-4 alone: Elnett Haarspray, Barber Club Pomade, taft x Gliss Shine Coat) · ambiguous 2 (`alcina-styling-mousse-aerosol`, PQ-11 r5; `john-frieda-frizz-ease-traumlocken-lockencreme`, uncorroborated Acrylates Copolymer r2 — review `acrylates_copolymer_function_unresolved`) · absent 30. Before the FX-2c condition: present 39 · ambiguous 1. Generic Acrylates Copolymer also sits in `gard-haarspray-extrastark-pumpspray` (pump spray, no RH-1 ⇒ corroborated; VP/VA r3 present anyway) and `kevin-murphy-killer-curls` (cream ⇒ not corroborated; Polyurethane-14 r5 keeps it `present`) |

### 6.3 `weight` (F) `[PH1-2, PH1-4, PH2-8; LI §7.5 reused]`

| Field | Rule |
|---|---|
| Values | production scale `light · medium · rich · unknown` (research trace LI `low · moderate · high`) |
| Decision | Structured judgment on the **LI WT anchors, unchanged in substance**, above T_S. Persistent families: (a) WL-6 oils + WL-7 esters; (b) WL-1 waxes, WL-2/WL-3 hydrocarbons, WL-4 butters, WL-5 lanolin; (c) FA-1 fatty alcohols; (d) SI-1 persistent silicones; (e) CA-3 cationic polymers and the polymeric CA-4.<br>• `light` (LI `low`): no persistent family above T_S and no LGN pair.<br>• `medium` (LI `moderate`): exactly one family; **or** ≥ 2 families with no rich member (the multi-family counter-signal is mandatory: name every family and its rank).<br>• `rich` (LI `high`): **an LGN pair** — a CA-1/CA-2 monomeric cationic **and** an FA-1 fatty alcohol both above T_S (LI §7.5 `high` row) — **and/or** ≥ 2 families with ≥ 1 rich member (lexicon WL-1, WL-2, Paraffinum Liquidum, WL-4, WL-5, the WL-6 rich band).<br>• `unknown`: incomplete INCI, T18 tier 2, or §3.3 readings that disagree |
| Ruled — PH2-8 (settles property set §9 item 12) | **Weight = the exact Leave-in WT rule, including the LGN-pair route to `high`/`rich`; no extra anhydrous route `[PH2-8]`.** (a) The property set's extra "anhydrous base with a rich member ⇒ rich" route is **not carried**: LI §7.5 has no such row, and dropping it moves no cohort value (node). (b) **Ruled — PH2-12:** the rich-member list keeps waxes, paraffin, microcrystalline wax and lanolin (Styling-local; moves into the Leave-in addendum after lock): PH1-2 adopted PS3, whose text names "petrolatum, wax, butter or castor oil", and Mask R8 placed lanolin heavy. (c) **The LI LGN-pair route to `high` is carried** (PH2-8), because PH1-4 reuses "the Leave-in WT rule" and that row is part of it. Consequence vs the property-set dry run: `balea-professional-styling-cream-traumlocken` (Cetearyl Alcohol r2 + Cetrimonium Chloride r9) and `john-frieda-frizz-ease-traumlocken-lockencreme` read `rich`, not `medium` |
| Never | form, subtype or name (LI G9; FS-1, FS-2, FS-17, FS-18); fixatives, natural films, particles, salts, humectants, volatiles; an **unresolved quat** never forms an LGN pair (LI §7.6: `maria-nila-curlicue-cream`, Quaternium-95 r11 ⇒ `medium`, review `quat_structure_unresolved`) |
| Counter-signals | rich member at `T_S − 1` ⇒ `moderate`; a C1/C2 weight claim („ohne zu beschweren", „für feines Haar") against `medium`/`rich` ⇒ `weight_claim_conflict` + review, value unchanged (LI §10.1.2 parity: `schwarzkopf-taft-schaumfestiger-volumen-halt-4-feines-haar`, `medium` via Guar HPTC r6) |
| Evidence / confidence | E2; ceiling `moderate` unless the families are fully readable above a plausible T_S (LI §7.5 ceiling) |
| Consumers | `thickness_fit` echo (a ranking signal, never an exclusion); buildup note limb 2 |
| Cohort (node) | light 32 · medium 23 · rich 15 (`molding` 10 of 11 `rich`) |

### 6.4 Buildup note (Hinweise) `[PH1-4, PH2-5; LI §8.5 reused]`

| Field | Rule |
|---|---|
| Values | entry in the `hinweise` record (LI §8.6): fired / not fired. **A note, not a score.** No „schwer auswaschbar" field exists (PH1-4) |
| Decision | LI §8.5 unchanged: fires when **limb 1** — LI §7.6 `permanent_cationic` above T_S (any Polyquaternium-n incl. PQ-11/-16/-46, Guar HPTC, Hydroxypropyl Guar HPTC, Silicone Quaternium-n, Quaternium-80, cationised proteins) — **or limb 2** — `weight: rich` (which always has a persistent family above T_S). **Limb 1 is reused literally `[PH2-5]`:** the lane reads the LI §7.6 persistence enumeration (`permanent_cationic`) internally, **only to feed the note**; Styling gets no PERS field and no persistence value is stored or shown. Example: Alcina Styling Mousse (PQ-11 r5) gets the note |
| Copy (LI §18, reused) | „Bleibt lange im Haar. Bei häufiger Anwendung kann ein kräftigeres Shampoo nötig sein – wie schnell sich etwas aufbaut, hängt von Menge, Häufigkeit und Shampoo ab." |
| Never | a duration, wash count or clarification schedule (LI G11); never an exclusion; never a skin claim |
| Deferred | Whether a `rich` Styling product used weekly adds +1 to the Deep-Cleansing reset load: Personal-Plan decision (PH1-4) |
| Cohort (node) | fires on 22 of 70: 10 via limb 1 (Taft Balm, Balea Pro Traumlocken, Taft Volumen Schaumfestiger, Syoss Schaumfestiger, Alcina Mousse, Alcina Föhn Lotion, Alcina Ansatz Volumen, Taft Texturspray, Wella Flowing Form, John Frieda Traumlocken) and 12 more via limb 2 only |

### 6.5 `alcohol_note` (F) `[PH1-3]`

| Field | Rule |
|---|---|
| Values | `fires` · `does_not_fire` |
| Decision | Deterministic: fires when an AL-1 member (Alcohol, Alcohol Denat., SD Alcohol n, Ethanol, Isopropyl Alcohol) is among the **first 3 declared ingredients** (water and propellants counted). Fatty alcohols and Benzyl Alcohol never count (lexicon AL-X) |
| Copy (LI alcohol note, reused) | „Enthält Alkohol – bei empfindlicher Kopfhaut lieber nur in die Längen geben." |
| Never | an exclusion, a ranking penalty, an „ohne Alkohol" filter, or "damages hair" (charter §10). Retailer „ohne Alkohol" chips never override it |
| Evidence / confidence | E1 observation driving a note; `high` on a complete INCI, `low` on a source conflict |
| Cohort (node) | fires on 28 of 70 (e.g. `john-frieda-volume-lift-ansatz-booster`, Alcohol Denat. r1; `alverde-beach-waves-spray-seaside-balance`, Alcohol denat. r3 despite the dm chip). Isopropyl Alcohol beyond rank 3 (`schwarzkopf-taft-styling-balm-locken-halt-3` r14) does not fire |

### 6.6 `ingredient_flags` (F)

As property set §2.8, on the **whole** list: `silicones` (any silicone incl. PEG-modified, volatile, Polysilicone-15; lexicon SI-1…SI-4), `oils` (WL-6 non-fragrance oils, WL-4 butters, WL-3 mineral oil; never essential oils or ethoxylated oils), `fragrance` (FR-1), `salt` (SA-1 or Sodium Chloride), `propellant` (VC-1); `fixative_family[]` ⊂ {`pvp_vp`, `acrylate`, `polyurethane`, `vinyl_acetate`, `pvm_ma`, `natural_film`} from members **above T_S**. Free-from claims and chips never override a flag (`color-wow-dream-coat-supernatural-spray` „silikonfrei" on Douglas ⇒ `silicones: true`, Polysilicone-29 r3). An unreadable token (lexicon §0.4 item 3) sets `flags_incomplete` + review (`balea-locken-revitalizing-spray` „CITRONELLOL SODIUM CHLORIDE" hides a `salt` flag). Flags never predict tolerance (LI L8). Cohort (node): fragrance 66 · propellant 23 · oils 22 · silicones 12 · salt 10.

### 6.7 `provides_heat_protection` (C + F) `[PH1-15, PH2-4; LI §7.8, §13 reused]`

| Field | Rule |
|---|---|
| Values | `true` · `false` (binary). Research trace: LI's `not_claimed · claim_only · formula_plausible · product_tested` |
| Decision | `true` **only** when (1) a **C1/C2 heat-protection claim** exists (LI §2.4.1; `C2_cross_market_verified` allowed) **and** (2) a closed-list **HP-1 (LI L9) member sits above T_S** (trace `formula_plausible`). **The heat check reads Styling's own tail marker T_S (the Mask rule), the stricter side `[PH2-4]`**, not T_LI. Otherwise `false`; a C1/C2 claim without the L9 pass is still **shown** („Hitzeschutz laut Hersteller") but never fills the Personal-Plan heat role. No claim + L9 member ⇒ `false`, `not_claimed` (a formula never manufactures a claim) |
| Differences from LI, encoded as ruled | LI §13.3 sets `true` on a claim alone (trace `claim_only`, review); PH1-15 requires the L9 pass, so Styling's `true` is narrower. LI's `product_tested` (claim + exact-product test) is reachable in the trace but, under PH1-15's text, sets `true` only with the L9 pass as well; `product_tested` without an L9 member stays `false` until ruled (PH2-4; §13 item 5) |
| What is a heat claim | Protection from heat damage („Hitzeschutz bis 230 °C", „schützt vor Föhnschäden", „schützt vor Sprödigkeit und Haarbruch, die durch das Föhnen entstehen"). **Not** a heat claim: activation („Föhnhitze verstärkt den Volumen-Effekt", „wärmeaktiviertes Polymer") — that is §6.13 |
| Never | a grade, temperature or percentage (LI G10, FS-14); generic silicone, Polysilicone-29, generic/cationised protein, panthenol, oils (FS-7, FS-24) |
| Cohort (node) | 11 committed or held Styling records carry a C1/C2 heat claim; **0 reach `true`**. `john-frieda-volume-lift-ansatz-booster` (C2 „bis zu 220 °C") has VP/DMAPA Acrylates Copolymer (HP-1) at r10, behind T_S (Parfum r6) but ahead of T_LI (Benzalkonium Chloride r11) — it is the case PH2-4 decided: heat polymer after Parfum ⇒ `provides_heat_protection = false` (the claim is still shown). `garnier-fructis-leave-in-spray-diamond-sleek-glaettungsspray` (C1 „Hitzeschutz bis 230° C", Hydrolyzed Wheat Protein r12 above both markers) would be `true` but routes `leave_in` (§4.8) |

### 6.8 `finish` (C, F sanity) `[PH1-5]`

| Field | Rule |
|---|---|
| Values | `matt · natürlich · glänzend · unbekannt` |
| Decision | Lexicon on C1/C2 text incl. the confirmed name: `matt` (matt, mattierend, „kein Glanz"; **halbmatt, seidenmatt** `[RG2-11]`); `glänzend` (Glanz, glänzend, Shine, Gloss, Brillanz, Wet Look); `natürlich` („natürliches Finish", „Natural Look", **„natürlicher Glanz"**, PH1-5). Brand shine numbers are recorded; words decide. Both a matt and a shine word ⇒ `unbekannt` + review. **Unclaimed ⇒ `unbekannt`, never formula-derived**. **Word pairs and the natürlich test `[RG-10]`:** matt + natürlich ⇒ `matt` (natürlich is the weaker, compatible word); glänzend + natürlich ⇒ `natürlich` (the PH1-5 pattern). „natürlich" is a finish word **only with Finish, Look or Glanz next to it** („natürliches Finish", „Natural Look", „natürlicher Look", „natürlicher Glanz"; also with a participle between them `[RG2-11]`: „natürlich aussehendes Finish", „natürlich wirkender Look" ⇒ `natürlich`); natürlich + a verb or another noun („natürlich gestylt aussehen", „natürlich strukturierter Look", „natürlich definierter Look", „natürliches Haargefühl") is a look/feel word ⇒ `unbekannt`. Round-1 cases: `bali-gents-matt-paste` (C2 „natürlichem Finish" + „mattem Finish" ⇒ `matt`), `wellaflex-schaumfestiger-locken-und-wellen-starker-halt` (C2 „lockiges Haar natürlich gestylt aussehen lässt" ⇒ `unbekannt`) |
| Not finish words | movement or texture words („natürlicher Haarschwung", „Sprungkraft", „geschmeidig", „seidig") |
| Counter-signal (F sanity, property set §2.11) | `matt` on an oil/silicone-led formula with no particulate, structuring wax or fatty-acid soap, or `glänzend` on a particulate-led dry powder ⇒ `finish_formula_conflict` review; **the value never changes** |
| Evidence / confidence | E0 claim; `high` on an explicit C1/C2 word |
| Consumers | finish preference, asked only when `molding` or `texture_spray` is in play |

### 6.9 `flexibility` (C) `[PH1-5]`

| Field | Rule |
|---|---|
| Values | `beweglich · fest · unbekannt` |
| Decision | `beweglich`: flexibel, beweglich, elastisch, formbar, neu formbar/nachstylbar, variabel, **verformbar, Elastizität, wieder stylen / neu stylen (a restyling sequence such as „Stylen, Ausbürsten, wieder Stylen") `[RG2-12, RG2-6]`**, or a negated rigidity word („ohne zu verhärten", „ohne steif zu wirken"). Cases: `taft-styling-paste-forming-halt-5plus` (C1 „Verformbare Styles") and `loreal-paris-elnett-haarspray-extra-starker-halt` („Stylen, Ausbürsten, wieder Stylen") ⇒ `beweglich`. `fest`: Kleber, Freeze, betonhart, steif. Both ⇒ `unbekannt` + review; neither ⇒ `unbekannt`. Brand flex numbers (Alcina Flex-Faktor x/10) are recorded; words decide. **„Kleber" is a rigidity word only `[RG-14]`** (removed from the §7.4 strength list, so the two lists never overlap). **Words in the confirmed name count `[P-2]`:** a rigidity or flexibility word in the full pack name is captured as a `flexibility` claim with `from_product_name: true` (§2.2 A3); e.g. `got2b-spruehkleber-freeze-haarlack` „Haarlack Sprühkleber … Freeze" ⇒ `fest` |
| Not flexibility words | „ohne zu verkleben" (PH1-5); „ausbürstbar" **alone** (v0 convention, property set §9 item 15; PH2-11, kept by RG2-12); „Crunch" (a cast to knead out ⇒ gel `cast_expected`, never `fest`, PH1-5) |
| Never | a strength word, and vice versa (§7.4) |

### 6.10 `primary_job` + `secondary_jobs` (C + F gate)

| Field | Rule |
|---|---|
| Values | one primary, ≤ 2 secondaries from `definition · volume · texture · sleek · hold_fix · shine · frizz_control · refresh` |
| Decision | Structured judgment: primary = the job the C1/C2 lead promise (§4.2 order) states; secondaries = up to two further jobs the C1/C2 claims state explicitly. **Primary `[RG-11]`:** the first **job-bearing** phrase of the lead promise; product nouns (Gel, Gelee, Paste, Wachs) and strength phrases („mit mittlerem Halt") are not job-bearing unless nothing else is; shaping/forming wording maps to `hold_fix`. **A strength phrase is not job-bearing when it qualifies a product noun or follows another job phrase („Gel mit mittlerem Halt"); when the hold is the lead's subject („Intensiver Halt für …", „Starker Halt –") the lead states `hold_fix` `[RG2-4]`** (`syoss-professional-performance-max-hold-power-wax`: „Intensiver Halt für glatte und glänzende … Looks" ⇒ `hold_fix`). **A curl/wave noun with a shaping or setting verb („Locken formen", „Curl Shaper", „Wellen über Nacht") states `definition`; shaping without a curl/wave noun stays `hold_fix` `[RG2-5]`** (`syoss-curl-cream-gel-3in1` „Locken zu formen und zu definieren" ⇒ `definition`). **Job vocabulary `[RG2-6, RG2-7]`:** Schwung, Sprungkraft, Spannkraft, Fülle ⇒ `volume` (Elastizität is a flexibility word, §6.9, never a job); taming or smoothing flyaways, „abstehende Haare/Härchen" or „Babyhaare" ⇒ `frizz_control`; `sleek` only for a smooth or straight result of the whole style („glatte Looks", „Sleek-Look") (`john-frieda-frizz-ease-zauberformel-seiden-finish-creme` „Glättet abstehende Haare" ⇒ `frizz_control`). **Secondaries `[RG-12; RG2-16, ruled „open" by R2-T]`:** any job word of this vocabulary stated in a C1/C2 promise line — including the RG-12 mappings: a C1/C2 hold claim with a strength word ⇒ `hold_fix`; an anti-frizz/flyaway word ⇒ `frizz_control`; a shine word ⇒ `shine`; a curl-definition word ⇒ `definition` — and also volume, texture, sleek and refresh words; taken in claim order, at most two, after the primary; feel, ingredient and duration lines never state a job. **Formula gate** (property set §2.12): `hold_fix` ⇒ the D8b hold-mechanism set (§7.5); `volume` ⇒ fixative_film / natural_film / particulate / salt; `texture` ⇒ particulate / salt / structuring wax_lipid / a film; `sleek` ⇒ silicone_coat / wax_lipid / fixative_film; `shine` ⇒ wax_lipid / silicone_coat; `frizz_control` ⇒ silicone_coat / wax_lipid / a film; `definition` ⇒ any mechanism except humectant_only/none; `refresh` ⇒ any. A failing secondary is **dropped and recorded**; a failing primary is **kept** and tagged `job_formula_conflict` + review |
| Never | duration or humidity wording as a job („bis zu 48 h", „100H" ⇒ `captured_claims`) |
| No C1/C2 promise | only for a ruling-named route (§4.1 exception): jobs empty + `claim_authority_gap` |

### 6.11 `application_moment` (U)

| Field | Rule |
|---|---|
| Values | `damp_before_drying · before_heat · dry_finish · dry_restyle · second_day · unresolved`; primary = the lead instruction, others in `also[]` |
| Decision | Transcription against the property-set anchors (§2.13), from the verbatim directions (any G1 tier; not claim-gated). **Reading the two damp anchors `[operational — property set §2.13 anchor text]`:** `before_heat` when the directions make a heat step a **required** next step (blow-dry or iron named, no air-dry option) or apply to dry hair before a hot tool; `damp_before_drying` when air-drying is allowed, drying is unspecified, or blow-drying is offered as optional („für optimales Ergebnis föhnen"). This resolves property set §9 item 4: `alcina-foehn-lotion` and `balea-foehnlotion-volume-effect` both read `before_heat` if their directions require the blow-dry. `second_day` only when the **directions** lead with refreshing between washes — marketing copy („ideal zum Auffrischen") is not directions. **Spray-only directions `[RG-2]`:** directions that consist only of spraying the product onto the hair (distance, evenness, optional targeting of strands — „Aus 30 cm Abstand sprühen") with no moisture state, no drying or heat step and no shaping step read **`dry_finish`** (the product is applied last, onto the finished style), confidence `moderate`; missing or copied directions stay `unresolved`. **Equal alternatives `[RG-8]`:** when the directions offer two moments as equal options („in handtuchtrockenes oder trockenes Haar", „feucht oder trocken"), the **first-named** is primary and the others go to `also[]`. **`dry_restyle` needs a named shaping act `[RG2-8]`** (kneten, einkneten, formen, stylen, in Form bringen, toupieren): spraying or distributing on dry hair without one is `dry_finish`; a product sprayed strand by strand to revive curls is `dry_finish` (`alverde-locken-refresh-spray`), while a named shaping act such as „und nach Wunsch stylen" or „einkneten" makes it `dry_restyle` (`redken-refreshing-curl-mist` „sprühen und sanft einkneten" ⇒ `dry_restyle`). **Shaping with no moisture state `[RG2-9]`** (mirror of RG-2): directions that name a shaping step but no moisture state, no drying and no heat step read **`dry_restyle`**, confidence `moderate` (`redken-powder-grip-03` „über das Haar streuen … mit den Fingern durch das Haar kneten"; `redken-root-tease`; `got2b-kleber-4-brows-and-edges-2in1-stylinggel`); missing or copied directions stay `unresolved` |
| Counter-signals | missing, conflicting or copied directions ⇒ `unresolved` + review (LI G5). Never from the formula or the name |
| Confidence | `high` on pack or manufacturer directions; `moderate` on retailer-only directions |

### 6.12 `target_zone` (U)

As property set §2.14: `roots` (directions lead with Ansatz), `lengths`, `surface`, `hairline` (edges, baby hair, brows), `all`; no directions ⇒ empty + review. **„Lead with Ansatz" `[RG-9]`:** `roots` when the Ansatz is the only or the **first-named** application site, including an either/or that names it („in den Handflächen verreiben oder direkt auf den Haaransatz streuen" ⇒ `roots`, `bali-gents-haarpuder-volumizing-styling-powder`); `all` when the Ansatz is mentioned only as a later, optional step. **Ranges and emphasis `[RG2-10]`:** a range that spans the hair length in either direction („vom Ansatz bis in die Spitzen", „beginnend an den Spitzen … zum Ansatz") is `all`; an emphasis inside a whole-hair instruction („im Haar verteilen, besonders auf …") is `all`; `surface`, `lengths` and `roots` need the zone to be the only application site (round-2 cases: `got2b-styling-puder-volumen-powderfull`, `schwarzkopf-taft-haarpuder-volumen`, `moroccanoil-volumizing-spray`, `bali-curls-volumizing-curl-spray-refreshing`, `john-frieda-frizz-ease-traumlocken-lockencreme`, `john-frieda-frizz-ease-zauberformel-seiden-finish-creme`). Feeds the subtype tie-break (§5), the edge branch and the cautions.

### 6.13 `heat_activated` (U, C raise)

As property set §2.15, narrowed by **R1-Q4 `[RG-3]`**: `yes` **only when the product's own text says it is heat-activated or that heat makes it work** — the text attributes the effect to heat acting on the product („hitzeaktiviert", „wärmeaktiviert", „aktiviert durch Wärme" / „durch die Föhnhitze", „durch Wärme fixiert", „Föhnhitze verstärkt den Volumen-Effekt" on `schwarzkopf-taft-schaumfestiger-volumen-halt-4-feines-haar`). An instruction to blow-dry — required, optional or offered for more volume („Für mehr Volumen trocken föhnen", „Du willst mehr Volumen? Dann einfach … trocken föhnen") — is a usage step for `application_moment` and gives **`no`** (`balea-styling-spray-ultra-volumen`, `jean-und-len-sea-salt-spray`, `balea-sea-salt-texture-spray`). `no` also when directions give heat no role; `unresolved` when activation appears only at C3/C5 (`color-wow-dream-coat-supernatural-spray`, Douglas „wärmeaktiviertes Polymer"). After unblinding, a C1/C2 activation statement may raise `no` to `yes` (property set §7 crossing 1). **In the blind round `heat_activated` reads the F/U directions only; activation statements in the confirmed name or in claims raise it after unblinding `[RG2-26]`** (`guhl-foehn-spray-langzeit-volumen`: blind directions „Vor dem Föhnen aufsprühen" ⇒ `no`; the confirmed-name word „Föhn-Aktiv" raises it to `yes` after unblinding; round-2 E2-10). **Never heat protection** (§6.7).

### 6.14 `captured_claims` (C)

Typed verbatim list (§2.2 A3), all tiers recorded with their tier. **Consumers: none** for selection, ranking or copy, except that a C1/C2 heat claim feeds §6.7 and its display line. Humidity follows LI T9; „bis zu 48 h" is never shown; hair-type claims never set fit; free-from claims never override flags; health-adjacent claims („Sanft zu Haar und Kopfhaut", „Dermatologisch bestätigte Hautverträglichkeit") are recorded and never repeated (charter §10).

### 6.15 Subtype extras

As property set §3; four are new fields, the rest are views:

| Subtype | Extra | Rule |
|---|---|---|
| `gel` | film type (view) | `synthetic` (hold_route present) · `natural` (natural_film, no FX) · `mixed` |
| `gel` | `cast_expected` (C) | `yes` when C1/C2 text or the confirmed name promises a cast („Crunch", „Cast", „knusprig"), else `unbekannt` |
| `curl_cream` | `conditioning_co_load` (F) | `rich` = LI COND ≥ moderate (the D7 read); `light` = thin/absent (the T15 `excluded_styling_first` read) |
| `molding` | `form_label` (identity) | `wax · paste · clay · fiber · pomade · cream` from the confirmed name; display only |
| `molding` | `base` (F) | `anhydrous` (no water declared anywhere) · `water_based` |
| `smoothing_styler` | coating type (view) | silicone_coat · fixative_film · wax_lipid |
| `shine_finish` | base; fixative present (views) | wax_lipid vs silicone_coat; hold_route |
| `salt_spray` | real salt vs salt-free (view) | `salt` mechanism present or not |
| `texture_spray` / `hair_powder` | particle type (view) | PT members |
| `refresher` | type (view) | `humectant_only` vs `hold_route: present` vs lipid |
| `mousse`, `blowdry_lotion`, `hairspray` | views of `target_zone`, `heat_activated`, format, §6.8/§6.9 | — |

### 6.16 Derived echoes and cautions (D; computed last)

As property set §4 (LI T8 / Mask R9: annotations, never independently reviewed): `thickness_fit` from `weight` (ranking only), `texture_fit`, `length_fit`, the hold display and neutral fact (§7.6), the alcohol note (§6.5), the buildup note (§6.4) and the cosmetic / medically adjacent cautions, kept in separate layers (charter §10). The PH1-3 ruling drops the former alcohol + roots caution (property set §8, PS4). Matching policy owns the final tables (charter §14).

---

## 7. Hold level normalisation, D8b flag, neutral fact (lane step 6) `[SD5, D8, D8b, PH1-8, PH1-9]`

### 7.1 Where the level is used (D8)

| Subtypes | Role |
|---|---|
| `gel`, `curl_cream`, `mousse`, `blowdry_lotion`, `hairspray`, `molding` | A stated, fitting level ranks first; **no level ⇒ still eligible**, ranked after, shown „Halt: keine Herstellerangabe". Never excluded |
| `salt_spray`, `texture_spray`, `hair_powder`, `shine_finish`, `smoothing_styler`, `refresher` | Captured and stored; **no part in selection** (finish, weight and application decide) |

### 7.2 Assignment order (deterministic, claim-only)

1. **Only C1/C2 counts**, including house-brand C2 (§2.2 A4; the dm „Halt" attribute on Balea/alverde, PH2-7) and `C2_cross_market_verified`. Retailer copy, retailer filter chips and attributes on third-party products (dm „Halt", Douglas „Haltgrad") and C5 pages are tier-stamped traces and **never assign** (LI §2.4.1 rule 1; LI T7).
2. **Brand number on a known scale ⇒ table §7.3.** **An illegible or self-contradicting brand number is not used `[RG-19]`:** words decide, confidence `moderate`, review `hold_number_unreadable`, and the pack is queued for re-capture. Self-contradicting includes a number printed beside a display with a different maximum. Cases: `got2b-spruehkleber-freeze-haarlack` (dot scale illegible; „ultrastarke" ⇒ 4 by words); `taft-styling-paste-forming-halt-5plus` („5+" beside a 4-dot display) **stays under this rule until the pack is re-read** (R1-Q1) — its only C1/C2 hold text is the number, so it reads `null` + neutral fact meanwhile; once a re-read confirms „5+" on the x/5 scale, §7.3 gives 4.
3. **The number beats the word** on the same pack or page (Henkel words inflate: Syoss calls Haltegrad 4 „extra stark").
4. **Brand word ladders** ⇒ table §7.3. An unranked step ⇒ `review`.
5. **Strength words ⇒ §7.4.** Flexibility, look and unquantified words are not strength words.
6. **No strength claim ⇒ `null`** („Halt: keine Herstellerangabe"). **Never `0`** unless the product claims „kein Halt" (D8); **never derived from the formula** in either direction; **never borrowed** from a similar formula or a sibling (Balea Haarpuder keeps its own „starker Halt" although got2b's near-identical base says „natürlicher Halt"). The gap is queued for pack-photo fill.
7. **Pack (C1) vs manufacturer page (C2) disagree on hold ⇒ `null`**, both claims kept, review `hold_claim_conflict` (PH1-8).

Confidence: `high` for a number on a known scale or an unambiguous word; `moderate` for house-brand C2 (ownership confirmed in review), cross-market C2, or a mid-ladder step. Internal only.

### 7.3 Normalisation tables (brand × format; mirror `TABLES` in `build-calibration-r2.js`)

| Brand scale (formats) | ⇒ 1 | ⇒ 2 | ⇒ 3 | ⇒ 4 | Note |
|---|---|---|---|---|---|
| Henkel Haltegrad x/5 — Taft, Syoss, got2b: **every Henkel leave-on format except Taft gels** (sprays, mousses, Föhnspray, pastes, waxes, balms, creams) `[R1-Q1, RG-4]` | 1–2 | 3 | 4 | 5 / 5+ („5+" = 5) | numbers shared across Henkel brands; number beats inflated words. Round-1 cases: Taft Styling Balm Locken „Halt 3" + „Starker Halt" ⇒ **2** (the round-2 capture carries C1 pack „HALT 3" and C2 „Halt 3"; both round-2 lanes 2); Taft Gel Wax „Haltegrad 2" ⇒ **1**; Syoss Max Hold Wax Haltegrad 5 + „Mega stark" ⇒ 4; Taft Matt Wax Halt 5 + „maximal" ⇒ 4; Taft Paste „5+" ⇒ §7.2 step 2 until re-read |
| Wellaflex dots x/5; Maria Nila x/5 | 1–2 | 3 | 4 | 5 / 5+ | |
| Printed 1–6 — NIVEA MEN, Gard, Taft 6 | 1–2 | 3 | 4 | 5–6 | |
| Alcina Hold-Faktor x/10 | 1–2 | 3–5 | 6–7 | 8–10 | Flex-Faktor recorded separately (§6.9) |
| **Taft gels** (scale 4–14, no legend) | — | — | — | — | **number not comparable ⇒ words only** („maximal" ⇒ 4); no word ⇒ `null` |
| Elnett word ladder | — | Normal | Stark | Extra stark | „Sehr stark" unranked ⇒ `review` |
| Brands with no stated maximum — Wella EIMI Haltegrad, American Crew Haltfaktor | — | — | — | — | **words decide**; the number is recorded |

New brand scales are added only with a published legend and maximum; until then the brand is words-only.

### 7.4 Word lexicon

| Strength words | Level |
|---|---|
| leicht, sanft, soft, weich | 1 |
| mittel, normal | 2 |
| stark | 3 |
| sehr / extra / ultra / mega / extrem stark, maximal, Max, Power | 4 |

**Round-2 additions `[RG2-18]`.** „Kontrolle" with a strength word reads as „Halt": „mittlere Kontrolle" ⇒ **2** (`redken-wax-spray` C2 „fixierender Haarspray mit mittlerer Kontrolle"). „krass" ⇒ **3**; „ultra krass" / „krasser Halt" at the top of a got2b display ⇒ **4** (`got2b-styling-paste-istyler-texture-clay` C2 „ultra krassem Halt" ⇒ 4, the binding property set §5.6 row).

„Power" is present in both concept §4 and the build-script `TABLES` word list (the property set's earlier note that it was missing is obsolete). **„Kleber" is no longer a strength word `[RG-14]`:** it is a rigidity word only (§6.9); the got2b Sprühkleber level 4 rests on „ultrastarke" independently.

**Strength words in the product name `[RG-13, P-1]`.** A strength word in the confirmed name counts **only when it qualifies hold or the product as a whole** (Taft POWER Haargel, „Extra Hold", „Max Hold"). It does **not** count when it qualifies another result noun: „Ultra Volumen" (volume), „Power Flex" (flex). The freeze adds name words as hold claims only under this test. Consequences: `balea-styling-spray-ultra-volumen` takes its level from the dm house-brand attribute „sehr starker Halt" (PH2-7 ⇒ 4) once it is re-captured into `claims[]` (P-1), never from „Ultra"; `balea-styling-creme-power-flex` is re-derived from its dm house-brand „Halt" attribute once captured — until then it has no strength claim (⇒ `null` + neutral fact, §7.6).

**Never strength (⇒ `null` when nothing else is stated):** flexibility words (§6.9); look words („natürlich", „natürlich aussehend", „natürlicher Halt"); unquantified words („langanhaltend", „perfekt", „zuverlässig", „kraftvoll"); duration („bis zu 48 h", „24 h definierte Locken", „3 Tage") ⇒ `captured_claims`.

### 7.5 D8b plausibility flag (internal; **never changes a level**)

**Hold-mechanism set:** `hold_route` `present` or `ambiguous`, **or** `natural_film`, `particulate` or `salt` in `result_mechanisms`, **or** `wax_lipid` with ≥ 1 `structuring` member (lexicon WL-1, WL-2, WL-8). Non-structuring oils, butters, esters, mineral oil, silicone coats and humectants are not hold mechanisms (property set §6).

**Claims it reads:** C1/C2 claims, plus hold words in the product name **at any tier** (a confirmed name is C1; D8b names Cantu „Extra Hold"). Never retailer chips.

1. A strength claim of ≥ „stark", or **any** hold claim on a `shine_finish`, `smoothing_styler` or `refresher`, with **no** member of the hold-mechanism set above T_S ⇒ `claim_formula_conflict`, review.
2. Same brand + character-identical INCI + different stated level ⇒ `d8b_identical_inci_sibling`, verify against the pack. Neither level is borrowed.

**Rule 1 never changes the level and never restores a dropped `hold_fix` secondary `[RG2-22]`:** on a `shine_finish` with a hold claim and no hold mechanism, the level stays as normalised, the flag fires, and the `hold_fix` secondary stays dropped by the §6.10 gate (`wella-eimi-glam-mist-shine-spray`).

Cohort (node): rule 1 fires on `cantu-shea-butter-extra-hold-edge-stay-gel` (name „Extra Hold", only Shea r7) and `loreal-paris-elnett-stylingspray-hitzeschutz-3-tage-glatt` (C1 „Starker Halt", silicone_coat only; level 3 kept, PH1-14). Rule 2 fires on `schwarzkopf-taft-haarspray-classic-halt-3` (2) vs `schwarzkopf-taft-haarspray-glanz-halt-4` (3). Duration-only claims (`balea-locken-revitalizing-spray` „bis zu 24 Stunden definierte Locken") are not hold claims and do not fire it.

### 7.6 Neutral fact `[PH1-9, D8b]`

„Enthält Stylingpolymere (z. B. ‹first FX member above T_S›)" is shown **iff** the subtype is one of the six hold-relevant subtypes (§7.1), the level is `null`, and `hold_route = present`. FX-R alone (`ambiguous`), an uncorroborated generic Acrylates Copolymer (lexicon FX-2c; `ambiguous`, and never the named example), natural films, waxes, salts and particles never trigger it. It is an E1 ingredient observation, never a rating. Cohort (node): 8 records — `syoss-curl-cream-gel-3in1` (PVP r2), `john-frieda-volume-lift-ansatz-booster` (PVP r3), `balea-ansatzvolumen-booster` (Butyl Ester of PVM/MA Copolymer r5), `american-crew-fiber` (PVP r4), `loreal-men-expert-barber-club-styling-pomade` (VP/DMAEMA r8), `balea-styling-creme-power-flex` (PVP r3; round 1's level 4 from „Power" is not valid under RG-13 — re-derived from its dm attribute once captured), `kevin-murphy-killer-curls` (Polyurethane-14 r5; its Acrylates Copolymer r4 is uncorroborated, and the record is `provisional_boundary (evidence_gate)` under PH2-10, so nothing is emitted today), `balea-haargel-hair-jelly` (PVP r6). *Superseded:* the v0.1 draft listed 9, including `john-frieda-frizz-ease-traumlocken-lockencreme` (Acrylates Copolymer r2); under FX-2c its `hold_route` is `ambiguous`, so the fact is not shown. Whether a „pflanzliche Filmbildner" variant is wanted stays open (property set §6).

### 7.7 Comparability

Levels compare only within a hold family — film (gel, curl_cream, mousse, blowdry_lotion, hairspray, salt and texture sprays), molding, powder. The app never compares hold across families (charter §11).

### 7.8 Worked normalisations

The 17 worked rows of property set §5.6 are binding examples of this section and are not repeated here. Additions: `alcina-styling-mousse-aerosol` C2 „Starker, flexibler Halt" + Hold-Faktor 5/10 ⇒ number beats word ⇒ **2**, flexibility `beweglich`; `balea-men-pomade-haar-bart-2in1` house-brand dm attribute „mittlerer Halt" ⇒ **2** (moderate, house-brand review), „langanhaltenden Halt" is unquantified; `schwarzkopf-taft-styling-balm-locken-halt-3` C1 pack „HALT 3" (Henkel x/5, R1-Q1) + C2 „Starker … Halt" ⇒ number beats word ⇒ **2** (round 1 split 3 vs 2; the v0.2 open question whether „Halt 3" was C1/C2 is closed by the round-2 capture, both lanes 2); `redken-wax-spray` „mittlerer Kontrolle" ⇒ **2** (RG2-18).

---

## 8. Review triggers

Each trigger is a named id. A record lists every trigger that fired; none of them changes a value unless its own rule says so.

| Trigger | Fires when | Section |
|---|---|---|
| `s0_evidence_gate` | no C1/C2 promise, no directions, or incomplete INCI | §4.1 |
| `s0_claim_conflict` | C1 and C2 lead with different promise classes | §4.1 |
| `formula_source_conflict` / `formula_or_identity_conflict` | LI T18 tier 2 / tier 1 residual; two INCIs under one GTIN are tested for tier 1 first | §2.2 A2 |
| `s0_mixed_promise` | step 2 `mixed` and D7 did not fire — incl. every C1/C2 promise covering a care job and curl definition (R1-Q3 as narrowed by R2-Q1; manual review) | §4.2 |
| `li_g0_provisional` | LI G0 returns `provisional_boundary` | §4.3 |
| `pending_leave_in_addendum` | PH1-16 hold | §4.5 |
| `ruled_route_override` | a §4.6 registry route differs from the S0 letter | §4.6 |
| `claim_authority_gap` | a claim-keyed field had no C1/C2 source (LI §2.4.1 rule 1) | §2.1 |
| `house_brand_ownership` | a C2 claim rests on LI rule 6 | §2.2 A4 |
| `care_decided_below_preservative` · `care_below_dose_yardstick` · `care_yardstick_missing` | the D6 care test decided below T_LI, below the yardstick, or found no yardstick | §4.3 D6 |
| `tail_marker_unresolved` · `tail_marker_absent` | T_S third limb or no T_S class | §3.3 |
| `tail_marker_implausible` · `tail_marker_vacuous` | T_LI clauses 5 / 6 (LI §3.1.1). **Fire only when a border rule on the record's path reads T_LI** (3.4 (i), 3.4 (iii), D6, D7, PH1-16) `[RG-18]`. Round-1 records that raised the question: `got2b-spruehkleber-freeze-haarlack` (3.4 (ii): no border rule reads T_LI), `guhl-locken-pflege-und-styling-3in1` (`mixed`: the D7 test runs first and reads T_LI) | §3.3 |
| `candidate_below_tail` | a below-marker species would change a value | §3.4 |
| `natural_film_unsettled` | an NF-U member was credited | §6.1 |
| `pq_only_film_former` | `hold_route: ambiguous` via FX-R | §6.2 |
| `acrylates_copolymer_function_unresolved` | a generic Acrylates Copolymer without FX-2c corroboration (lexicon §1A) is the only fixative candidate, or a D6/D7/LI G0 border limb turns on it | §6.2, §4.3 |
| `hair_fixing_silicone_unresolved` | Polysilicone-9 (lexicon SI-4 + FX-U, R1-H3) is the only fixative candidate, or the D6 hold limb turns on it | §6.2, §4.3 |
| `unsettled_film_former` | `hold_route: ambiguous` via FX-U | §6.2 |
| `quat_structure_unresolved` | an opaque Quaternium-n | §6.3 |
| `weight_claim_conflict` | C1/C2 weight claim vs `medium`/`rich` | §6.3 |
| `flags_incomplete` · `transcription_defect` | an unreadable INCI token | §6.6 |
| `formula_source_page_error` | a manufacturer page prints an evidently foreign INCI (A10); the consistent list is the formula of record; open until a pack INCI (C1) is captured `[R2-H1]` | §2.2 A10 |
| `inci_tail_defect` | an INCI defect confined to the tail (at or below T_S: truncated allergen block, split fragrance/oil token, missing separator in the fragrance block); S0 is not blocked `[RG2-24]` | §4.1 |
| `heat_claim_without_l9` | C1/C2 heat claim, no HP-1 above the marker (shown, not used) | §6.7 |
| `finish_formula_conflict` | §6.8 sanity check | §6.8 |
| `finish_word_conflict` · `flex_word_conflict` | both a matt and a shine word; both a flex and a rigidity word | §6.8, §6.9 |
| `job_formula_conflict` | the primary job fails the formula gate | §6.10 |
| `directions_unresolved` | missing / conflicting / copied directions | §6.11 |
| `hold_claim_conflict` | pack vs page hold conflict | §7.2 |
| `hold_ladder_unranked` | an unranked brand step („Sehr stark") | §7.3 |
| `hold_number_unreadable` | a captured brand number is illegible or contradicts its own display; words decided; pack queued for re-capture `[RG-19]` | §7.2 |
| `water_based_serum_exception` | a „Serum" in the 3.1 scope passed the water-based exception test (cationic read down to the PH1-13 yardstick, R2-Q2) and went to 3.4 (iii) `[RG-15, RG2-2]` | §4.3 3.1 |
| `claim_formula_conflict` · `d8b_identical_inci_sibling` | D8b rules 1 / 2 | §7.5 |
| `species_reading_conflict` | one species at one rank read as architecture by one rule and as trace by another (LI §2.3.2 cross-rule clause) | §3 |
| `low_confidence` | any value at `low` | §3.1 |

---

## 9. False-signal register

LI FS-1…FS-27 (LI §12) apply unchanged where relevant (FS-1/2/17/18 form ≠ weight; FS-3/20 silicone-free ≠ low buildup; FS-4 volatile ≠ no residue; FS-6/15 humectants ≠ anti-frizz; FS-7/14/24 heat; FS-9 hold polymer ≠ care; FS-25 bottle rheology). Styling-specific false signals (SFS) — producing one is a rule violation:

| ID | False signal | Correct reading |
|---|---|---|
| SFS-1 | A name decides the formula or the subtype: „Gel Wax" = wax, „Texture Clay" = clay, „Fiber" = fibres, „Haaröl" = oil formula | Names route only under D2 and D7 (§4.4); the INCI decides mechanisms |
| SFS-2 | A retailer filter chip or attribute is a claim: dm „ohne Alkohol", Douglas „silikonfrei", dm/Douglas „Halt"/„Haltgrad" on a third-party product | C3/C4 trace; INCI governs flags; only C1/C2 (incl. house brand) assigns a level |
| SFS-3 | A duration is a strength: „bis zu 48 h Halt", „24 h definierte Locken", „3 Tage glatt" | `captured_claims`; never a level, never a job |
| SFS-4 | A thick gel or a high carbomer rank means strong hold | RH-1 is never a hold route |
| SFS-5 | Starch, salt or silica is "real hold" for D6 | D6 clarification: fixative-class only |
| SFS-6 | PQ-11/-16/-46/-69 alone is a fixative | PH1-6, R1-T: `ambiguous` + review |
| SFS-7 | A strength can be estimated from the formula („PVP rank 3 ⇒ starker Halt") | D8/D8b: never; best formula rule tested was right 3 of 6 (`round2/hold-research-ingredients.md`) |
| SFS-8 | Brand numbers compare across brands (Taft gel „Halt 14" > Syoss „Haltegrad 5") | §7.3: tables per brand; Taft gels words-only |
| SFS-9 | „Hitzeschutz bis 230 °C" is a protection grade, or any heat claim fills the heat role | PH1-15: binary, claim **and** L9 pass; temperatures never used |
| SFS-10 | Heat activation („wärmeaktiviert", „Föhnhitze verstärkt") is heat protection | §6.13 vs §6.7 |
| SFS-11 | Fatty alcohols trigger the alcohol note | PH1-3: AL-1 only |
| SFS-12 | „Natürlicher Glanz" is a shine finish; „ohne zu verkleben" is flexibility; „Crunch" is `fest` | PH1-5 |
| SFS-13 | Marketing "refresh" copy is a second-day direction | §6.11: only directions set `second_day` |
| SFS-14 | A "Leave-In" word in a name makes a product Leave-in (Balea „Leave-In Glow&Shine Finishing Spray") | the promise class and LI G0 decide (§4.2–§4.3) |
| SFS-15 | A care or ingredient call-out („mit pflegendem Camelinaöl") makes a promise `mixed` or `care` | §4.2: only co-equal lead jobs make `mixed` |
| SFS-16 | A heat claim on a curl cream turns it into a heat protectant | primary promise decides (3.3); PH1-12 for the D7 band |
| SFS-17 | A blow-dry tip („für mehr Volumen trocken föhnen") makes a product heat-activated | R1-Q4: only the product's own text that heat activates it or makes it work; a blow-dry step is `application_moment` (§6.13) |
| SFS-18 | A care noun in the name („Pflege-Spray", „Kur") settles a care-vs-curl-definition promise as `care` | R1-Q3: such a promise is `mixed` ⇒ manual review, whatever the name (§4.2); the name's care word is the care half (R2-Q1), it never breaks the tie |
| SFS-19 | Any anti-frizz word makes a finishing spray a Leave-in function | R1-Q2: anti-frizz on dry, finished hair by the main directions is the `shine_finish` job (§4.2) |
| SFS-20 | „Ultra Volumen" or „Power Flex" in a name is a strength claim | RG-13: a name strength word counts only when it qualifies hold or the product (§7.4) |
| SFS-21 | Reviving or reactivating curls („revitalisiert und reaktiviert Locken") is curl definition | R2-Q1: revival is refresh (the `refresher` job); the definition half needs „definiert"/„Definition" (§4.2) |
| SFS-22 | A care adjective on the result („gepflegte Locken") or a feel line („Verbesserte Geschmeidigkeit") is the care half of a care + definition tie | R2-Q1, R2-H5: only a promised care job counts (§4.2); SFS-15 governs adjectives and call-outs; feel lines never count |
| SFS-23 | A pre-heat moment makes a shine spray a `smoothing_styler` | RG2-15: a shine lead stays `shine_finish` whatever the moment (§5) |
| SFS-24 | A care cream that may also be left in as a curl cream („3in1 Lockencreme, Kur & Spülung") is Styling | R2-H2: it stays care in its current category; only a fixative-class polymer or the D7 middle band makes it Styling (§4.1) |
| SFS-25 | The domain ending decides the tier (a .com.au or .eu host ⇒ C5; a .de retailer ⇒ C2) | R2-H6: a manufacturer's German-language storefront for the German market is C2 whatever its domain; other-market pages are C5; retailers are C3 (§2.2 A9) |

---

## 10. Record and blind-lane envelope

### 10.1 Record (one per product; JSON shape, field ownership in brackets)

```jsonc
{
  "sample_id": "…", "standard_version": "styling-inci-v0.3", "lexicon_version": "styling-lexicon-v0.3",
  "identity": { "brand": "…", "product_name": "…", "gtin": "…", "size": "…", "format": "gel|spray_gel|jelly|cream|foam|pump_spray|aerosol|wax|paste|pomade|powder",
                "identity_status": "verified|…", "inci_raw": "…", "inci_normalised": [{"rank":1,"inci":"…","lexicon_id":"…"}],
                "inci_source": {"tier":"C1|C2|C3|C4|C5","url":"…","date":"…"}, "transcription_repairs": [], "inci_flags": [] }, // [capture; inci_flags ship in the S0 packet, RG2-24]
  "directions": { "verbatim": "…", "tier": "…", "source": "…", "date": "…" },                                     // [capture, U input]
  "claims": [ { "type": "promise|hold|flexibility|finish|cast|duration|humidity|heat_protection|heat_activation|hair_type|free_from|other",
                "raw": "…", "tier": "C1|C2|C2_house_brand|C2_cross_market_verified|C3|C4|C5", "source": "…", "date": "…",
                "number": null, "scale_as_written": null, "words": null, "from_product_name": false } ],                                       // [capture, C]
  "tail_marker": { "T_S": {"inci":"…","rank":0,"status":"plausible|unresolved|absent","alt":null},
                   "T_LI": {"inci":"…","rank":0,"status":"plausible|implausible|vacuous|none_visible"} },       // [F]
  "s0": { "route": "…", "boundary_reason": null, "lean_route": null, "promise_class": "…", "li_function": "yes|no",
          "pair_rule": "3.1|3.2|3.3|3.4(i)|3.4(ii)|3.4(iii)|3.5", "li_g0_state": null, "d6": null, "d7": null,
          "ruled_route": null, "rationale": "…" },                                                               // [R]
  "styling_subtype": "…|null",                                                                                    // [R]
  "properties": {
    "result_mechanisms": [{"value":"fixative_film","members":[{"inci":"PVP","rank":3}]}],                          // [F]
    "hold_route": "present|absent|ambiguous", "weight": "light|medium|rich|unknown", "alcohol_note": "fires|does_not_fire",
    "ingredient_flags": {"silicones":false,"oils":false,"fragrance":true,"salt":false,"propellant":false,"fixative_family":["pvp_vp"]},
    "provides_heat_protection": {"value": false, "trace": "not_claimed|claim_only|formula_plausible|product_tested"}, // [C+F]
    "chaarlie_hold_level": {"value": 4, "raw": "…", "scale": "…", "tier": "C2", "basis": "…"},                   // [C]
    "flexibility": "…", "finish": "…", "primary_job": "…", "secondary_jobs": [], "dropped_jobs": [],               // [C]
    "application_moment": {"primary":"…","also":[]}, "target_zone": "…", "heat_activated": "yes|no|unresolved",    // [U]
    "captured_claims": [], "subtype_extras": {}                                                                   // [C]/[F]/[view]
  },
  "hinweise": { "fired": [ {"flag":"buildup|alcohol_note","basis":"…","note":"…"} ] },                         // [D] always emitted, may be empty
  "derived": { "thickness_fit": "…", "texture_fit": "…", "length_fit": "…", "hold_display": "…", "neutral_fact": null, "cautions": [] }, // [D]
  "evidence": { "<property>": {"decision_type":"…","confidence":"high|moderate|low","evidence_level":"E0|E1|E2","formula_observations":[],"counter_signals":[]} },
  "review_triggers": [], "uncertain_fields": [], "blind_to_final_changes": []
}
```

### 10.2 Blind lanes (PH1-11 (b)) — separate sealed S0 packet `[PH2-6, refined by R2-Q3]`

| Lane input | Contents | Classifies |
|---|---|---|
| **S0 packet** (sealed, PH2-6, R2-Q3) | normalised INCI with ranks and tiers, **re-joined and renumbered by the freeze, with `identity.inci_flags`** (RG2-24, P2-3, P2-4); verbatim directions; the confirmed product name; the C1/C2 **promise and heat-protection** claims with tiers and line positions; format. **Masks only grading words** (below). **Removes** prior routes, subtypes, hold levels, retailer chips, prices, calibration labels | `route`, `boundary_reason`, `promise_class`, `li_function`, pair rule, D6/D7 readings, lean subtype |
| **F/U packet** (sealed; property set §7). Each lane classifies F/U from the blind packet using **its own** S0 output (PH2-6) | normalised INCI; format; verbatim directions with brand, name and strength/look adjectives replaced by `[CLAIM]`; **the lane's own S0 output** | every F and U field (§1.2); `heat_activated` from these directions only — name and claim activation statements raise it after unblinding (RG2-26) |
| **Claim normalisation** (two independent passes; PH1-11 (c)) | frozen `claims[]` **plus the unmasked confirmed product name** (a C1/C2 claim, §2.2 A3; R2-Q3) | `chaarlie_hold_level`, flexibility, finish, jobs, `cast_expected`, `form_label`, `captured_claims`, the C half of heat |
| **Derived last** | — | echoes, cautions, hold display, neutral fact |

**S0 masking: keep job words, mask grading words `[R2-Q3, RG2-3, P2-1]`.** Blindness hides the answers under test (hold, flexibility, finish grade), not the input the routing rule needs. In the S0 promise lines, the confirmed name and the directions:
- **Kept (job-naming nouns; R2-Q3 names them „such as", so the list is open to other nouns that name a job):** Glanz-Spray / Glanzspray, Glanz, Shine, Gloss, Finish / Finishing, Haarspray, Wachs, Puder, Gel, Schaum, Paste.
- **Masked (grading words):** hold strengths and hold words with numbers or scales („starker Halt", „Halt 5", „Haltegrad …", dots), flexibility words (flexibel, fest, Kleber …) and finish grades (matt, seidig-glänzend, natürlich …; „glänzend/glänzendes" as an adjective of Finish or Haar). In a compound or a name only the grading part is masked, so the job noun stays readable (e.g. got2b „Mattpaste" keeps „paste").
- **Re-freeze scope:** only the records whose S0 text changes under these lists are re-frozen and re-run (P2-1: in round 2, 71 records lost at least one styling job word and 5 kept none in the lead line or the name — OSiS Sparkler, gotGloss, Glam Mist, Elvital Öl Magique, NIVEA MEN Styling Cream; `round-2/diff.json` `s0_redaction_check`).

Agreement: deterministic F fields must reach 100 %; a disagreement is a lexicon defect, fixed in the lexicon, never per product. U fields report agreement with coded causes. Routes report agreement per pair rule. Every blind-to-final change is recorded with its reason (property set §7). Cohort independence: products named in this file, the property set or the charter are confirmation-grade only (Mask round-1 lesson); the unseen set (PH1-11 (d)) compensates.

---

## 11. Worked examples (full procedure, expected outputs)

All sixteen are real calibration records; ranks re-read from the raw INCI with lexicon v0.1 (node), §11.13 from the frozen round-2 cohort and §11.14–§11.16 from the round-2 cohort plus the re-check capture `capture/recheck-r6.json` (2026-10-12). §11.14–§11.16 state the S0 reading the R2-H rulings fix; their full profiles are derived blind in round 3. They are named in this standard, so in calibration they are **confirmation-grade only** (§10.2). Where a value rests on a Phase 2 ruling, the cell cites its PH2 ID.

### 11.1 Schwarzkopf Taft Haargel POWER Halt 5 — `schwarzkopf-taft-power-haargel-halt-5`

| Step | Output |
|---|---|
| Identity | C2 schwarzkopf.de (promise, hold); INCI dm.de (retailer, complete); directions C3 dm.de (the brand page's Anwendung is empty) |
| Markers | T_S Phenoxyethanol r4, plausible · T_LI Phenoxyethanol r4 |
| S0 | step 1 pass · class `styling_result` („maximalen langanhaltenden Halt von Taft"), `li_function: no` · aqueous · 3.4 (ii) ⇒ **`styling`** (PH2-1). Cross-check without PH2-1: 3.4 (iii) LI G0 — PVP r3 (FX-1) above T_LI, no conditioning ⇒ `excluded_styling_first` with C2 hold positioning ⇒ `styling`. Not held (LI L5 sees PVP; Leave-in excludes it) |
| Subtype | `gel` (gel form; hold job; damp or dry) |
| F | mechanisms `fixative_film` [PVP r3] · hold_route `present` · weight `light` (no family: Carbomer RH-1, PEG-32/PEG-40 HCO EM-1, Panthenol HU-1) · buildup no · alcohol_note **fires** (Alcohol denat. r2) · flags fragrance; fixative_family [pvp_vp] |
| Heat | no heat claim ⇒ `false` (`not_claimed`) |
| Hold | Taft gel scale is not comparable (4–14) ⇒ words: „maximalen … Halt" (C2), name „POWER" ⇒ **4**, confidence high. D8b: no flag. Neutral fact: n/a (level stated) |
| C | finish `unbekannt` · flexibility `unbekannt` („ohne zu verkleben", PH1-5) · primary_job `hold_fix` (gate ✓; the hold is the lead's subject, RG2-4) · gel film type `synthetic`, cast_expected `unbekannt` |
| U | application_moment `dry_restyle`, also `damp_before_drying` (moderate, retailer directions) · target_zone `all` · heat_activated `no` |
| Captured | duration „für bis zu 48 Stunden Halt" (C2) · humidity „schützt die Frisur vor Feuchtigkeit" (C2) · free-from „ohne Silikone" (C3). „Sanft zu Haar und Kopfhaut" (C3) is never repeated |
| Triggers | none |

### 11.2 Balea Professional Styling Cream Traumlocken — `balea-professional-styling-cream-traumlocken`

| Step | Output |
|---|---|
| Identity | house-brand C2 (dm ↔ Balea, LI rule 6) ⇒ `house_brand_ownership`; INCI dm.de; directions house-brand C2 |
| Markers | T_S Sodium Benzoate r10, plausible · T_LI Sodium Benzoate r10 |
| S0 | class: v0.2 read **`mixed`** (definition + „Verbesserte Geschmeidigkeit" + „Hitzeschutz bis zu 220 °C", round-2 G0 lane) ⇒ PH1-12: D7 first. **R2-H5:** „Verbesserte Geschmeidigkeit" (a dm bullet; the pack says „Locken-Forming-System für Geschmeidigkeit und verbesserte Kämmbarkeit.") is a feel line and never the care half, and the heat line is a bullet, so the class reads `styling_result` (`li_function: yes`) and 3.4 (i) runs the same D7 test; whichever class a lane reads, D7 runs before the mixed stop (PH1-12) and the product keeps `curl_cream`. The round-3 freeze adds the C1 pack lines („BIS ZU 24h DEFINIERTE LOCKEN" — a duration; „Perfekt definierte, glänzende Locken und Hitzeschutz bis 220 °C"; „PFLEGE-FORMEL MIT SHEABUTTER UND KERATIN" — an ingredient call-out, SFS-15; „SCHWUNGVOLL. DEFINIERT. VERWÖHNT."); none changes this path. D7 — VP/VA Copolymer r3 above T_LI ✓; substantive conditioning (LI COND high: LGN pair Cetearyl Alcohol r2 + Cetrimonium Chloride r9, esters r4–r6, Polyquaternium-37 r8) ✓; sold as „Styling Cream Traumlocken" ✓ ⇒ **`styling` `curl_cream`**. PH1-16: the locked LI G0 letter reads `provisional_boundary` (G0 lane, LI §2.3.2 clause 2) ⇒ Leave-in could claim it ⇒ **`provisional_boundary (pending_leave_in_addendum)`, lean `styling`/`curl_cream`** |
| F | mechanisms `fixative_film` [VP/VA r3] + `wax_lipid` [Isopropyl Palmitate r4, Dicaprylyl Carbonate r5, Caprylic/Capric Triglyceride r6] · hold_route `present` · weight **`rich`** (LGN pair; families a, c, e) — the property-set dry run said `medium` because it omitted LI's LGN row (§6.3) · buildup **fires** (limb 1: Polyquaternium-37 r8; limb 2: rich) · alcohol_note no · flags silicones (Dimethicone r12, tail), oils (Shea r17, tail), fragrance; candidate_below_tail: Dimethicone r12/Trimethylsiloxyphenyl Dimethicone r13 would add `silicone_coat` ⇒ review |
| Heat | house-brand C2 „Hitzeschutz bis zu 220 °C"; no HP-1 member ⇒ **`false`** (`claim_only`), shown „Hitzeschutz laut Hersteller", `heat_claim_without_l9` |
| Hold | house-brand dm attribute „mittlerer Halt" ⇒ **2**, confidence moderate; the round-2 G0 lane read that attribute as a C3 trace; PH2-7 rules it C2 `house_brand` ⇒ `house_brand_ownership` review (§13 item 6) |
| C | finish `glänzend` („perfekt definierte und glänzende Locken") · flexibility `unbekannt` · primary `definition` (gate ✓), secondaries in claim order `frizz_control` („Schützt effektiv vor Frizz"; gate ✓) and `hold_fix` (house-brand C2 „mittlerer Halt", RG-12 within RG2-16; gate ✓) · conditioning_co_load `rich` |
| U | `damp_before_drying` („in handtuchtrockenes oder trockenes Haar einarbeiten"), also `dry_restyle` · `all` · heat_activated `no` |
| Triggers | `pending_leave_in_addendum`, `house_brand_ownership`, `heat_claim_without_l9`, `candidate_below_tail` |

### 11.3 Maria Nila Curlicue Cream — `maria-nila-curlicue-cream`

| Step | Output |
|---|---|
| Identity | C2 marianila.de (German shop, GTIN = round-1 EAN); INCI identical across sources; directions C2 |
| Markers | T_S Ethylhexylglycerin r13 **unresolved** (booster above Phenoxyethanol r16) ⇒ R2 marker Phenoxyethanol r16; `unpositioned`: Triethanolamine r14, antioxidant r15 (nothing that moves a value) · T_LI Ethylhexylglycerin r13 (on LI's list outright) |
| S0 | class: v0.2 read `mixed` on the letter („Definierende Pflegecreme … Sprungkraft": care + curl definition, R1-Q3, R1-H2). R2-Q1 counts only a promised care job; whether „Pflegecreme" (a product noun in a C2 line, not the confirmed name „Curlicue Cream") states one does not change the outcome: if `mixed`, the D7 test runs first (PH1-12), fails, and the owner-named route (T15, D3) overrides the stop under §4.1 (c); if `styling_result`, the steps below give the same route directly. `li_function: yes` (curl definition) · aqueous · 3.4 (i) D7 not met (conditioning thin per T15) · 3.4 (iii) LI G0 = **T15 paradigm `excluded_styling_first`** (PVP r4 ahead of the fatty alcohol, no conditioning architecture) ⇒ **`styling` `curl_cream`** [T15, D3]. Not held (Leave-in excludes it). R2 would read Cetyl r5 + Quaternium-95 r11 as care — irrelevant, R2 is never the T15 test (PH1-13) |
| F | mechanisms `fixative_film` [PVP r4] · hold_route `present` · weight **`medium`** (family c: Cetyl Alcohol r5; Quaternium-95 r11 is an opaque quat ⇒ no LGN pair, `quat_structure_unresolved`) · buildup no · alcohol_note no · flags fragrance |
| Heat | no claim ⇒ `false` |
| Hold | C2 „Halt 3/5" ⇒ x/5 table ⇒ **2**, high |
| C | finish `unbekannt` („Betont und definiert Locken" names no finish) · flexibility `unbekannt` · primary `definition`, secondary `volume` („lebendige Sprungkraft", RG2-6, RG2-16; gate ✓ via fixative_film) · conditioning_co_load `light` |
| U | `damp_before_drying` (C2: towel-dried, „für optimales Ergebnis föhnen" = optional heat) · `all` · `no` |
| Triggers | `tail_marker_unresolved` (values agree under both readings), `quat_structure_unresolved` |

### 11.4 NEQI Diamond Glass Ultimate Styling Spray — `neqi-diamond-glass-ultimate-styling-spray`

| Step | Output |
|---|---|
| S0 | D3 names the route (§4.6), so the promise-class reading (styling and heat protection both lead: „Es kombiniert Styling mit intensivem Hitzeschutz") cannot stop it at `mixed`. Letter: `li_function: yes` (anti-frizz, smoothing film, heat-styling support) · aqueous · 3.4 (i) not a curl cream · 3.4 (iii) LI G0 = **T15 `incidental_film`** (Silicone Quaternium-18 + Polysilicone-29 conditioning film with one supporting fixative, VP/Methacrylamide/Vinyl Imidazole Copolymer r8) ⇒ `in_category` · D6 does not fire (real hold and real care) ⇒ **`leave_in`** [T15, D3] |
| Emission | identity, formula, route + rationale; Styling observations informational only: T_S Ethylhexylglycerin r9 unresolved; FX-1 r8 above T_LI; no Styling profile, no subtype |
| Sibling (R2-Q4, R2-H4) | `neqi-diamond-glass-styling-spray-all` has the same conditioning silicone film (Polysilicone-29 r7 above T_LI Ethylhexylglycerin r8; Silicone Quaternium-18 r10) without the fixative and the same towel-dried, before-blow-dry use (C2 directions from neqi-hair.com: „handtuchtrockene (nicht nasse) Haar … mit Hitze und auf Spannung föhnen"). Its C2 lead „Styling + Hitzeschutz in einem" reads `mixed` (RG2-19); R2-Q4 extends this ruling to it ⇒ **`leave_in`** (the letter's Leave-in reading agrees: D6 does not fire, real care). **R2-H4:** its INCI is complete (pack and neqi-hair.com agree, 14 items), so the earlier truncation flag is withdrawn and no evidence gate blocks it (§4.6) |

### 11.5 Balea Locken Revitalizing Spray — `balea-locken-revitalizing-spray`

| Step | Output |
|---|---|
| Identity | house-brand C2; INCI dm.de with typos (`GLYERIN`, `BETANE` aliased) and one missing separator („CITRONELLOL SODIUM CHLORIDE", `transcription_defect`) |
| Markers | T_S Sodium Benzoate r4, plausible · T_LI Sodium Benzoate r4 |
| S0 | class `styling_result` („Revitalisierendes Lockenspray", „Für definierte Locken mit Sprungkraft"), `li_function: yes` (curl revival) · aqueous · (i) no fixative · (iii) LI G0 letter `in_category` (curl support, no L5) ⇒ **D6**: no FX above T_LI ✓; no real care (nothing above T_LI but Glycerin and Nitrogen; Coconut r13 and Shea r14 are below T_LI; no cationic; Cocamidopropyl Betaine is EM-1) ✓; styling-look promise ✓ ⇒ **`styling` `refresher`** [D6]. PH1-16: LI letter claims it ⇒ **`provisional_boundary (pending_leave_in_addendum)`, lean `refresher`** |
| F | mechanisms `humectant_only` [Glycerin r2] · hold_route `absent` · weight `light`; `candidate_below_tail`: Coconut r13 + Shea r14 would make it `rich` ⇒ review · buildup no · alcohol_note no · flags oils, fragrance, propellant; salt unreadable ⇒ `flags_incomplete` |
| Heat / Hold | no heat claim ⇒ `false` · no hold claim ⇒ **`null`**; „bis zu 24 Stunden definierte Locken" is duration, not hold ⇒ no D8b flag (the calibration file's `claim_formula_conflict` predates §7.5) |
| C | primary `refresh` (gate ✓); `definition` and `frizz_control` claimed but **dropped** by the gate (humectant_only) and recorded · finish/flexibility `unbekannt` · refresher type `humectant_only` |
| U | **`dry_restyle`** („auf trockenes Haar sprühen, sanft einkneten": a named shaping act, RG2-8); not `second_day` — „Ideal zum Auffrischen" is marketing, not directions (the calibration file says `second_day`; re-label) · `all` · heat_activated `no` („ggf. diffusen" = optional) |
| Triggers | `pending_leave_in_addendum`, `house_brand_ownership`, `candidate_below_tail`, `flags_incomplete`, `transcription_defect`, `inci_tail_defect` (the unreadable token r15 sits below T_S r4: no S0 block, RG2-24) |

### 11.6 alverde Locken Refresh-Spray — `alverde-locken-refresh-spray`

| Step | Output |
|---|---|
| Markers | T_S Levulinic Acid r6 (PR-1), plausible · T_LI Levulinic Acid r6 |
| S0 | class `styling_result` („Spray zur Auffrischung von Locken & Wellen"), `li_function: yes` · aqueous · (iii) LI G0 letter `in_category` ⇒ **D6**: no FX ✓; R2 care test — oils r12, r14, r16 and Brassica Alcohol r21 sit below T_LI ⇒ not care; Brassicyl Isoleucinate Esylate r17 (CA-1) sits below the yardstick Lactic Acid r13 (first PH-1 after T_LI) ⇒ not care, `care_below_dose_yardstick` ✓; styling-look promise ✓ ⇒ **`styling` `refresher`** with review [PH1-13]. PH1-16 ⇒ **`provisional_boundary (pending_leave_in_addendum)`, lean `refresher`** |
| F | mechanisms `humectant_only` [Propanediol r3, Glycerin r4] · hold_route `absent` · weight `light`; `candidate_below_tail`: the oils plus the Esylate/Brassica Alcohol pair would make it `rich` ⇒ review (lexicon §5.3) · buildup no · alcohol_note no · flags oils, fragrance |
| Heat / Hold | `false` · **`null`** |
| C | primary `refresh`; „geschmeidige Locken voller Sprungkraft" names no definition (R2-Q1: „geschmeidige Locken" is a result adjective) — read as a job it is `volume` (RG2-6), which the gate drops (humectant_only) and records · free-from „Ohne Silikone & Sulfate" captured |
| U | `dry_finish` (sprayed strand by strand to revive curls, no shaping act — RG2-8), also `damp_before_drying` · `all` · `no` |
| Triggers | `pending_leave_in_addendum`, `care_decided_below_preservative`, `care_below_dose_yardstick`, `candidate_below_tail`, `house_brand_ownership` |

### 11.7 L'Oréal Elnett Stylingspray Hitzeschutz 3 Tage Glatt — `loreal-paris-elnett-stylingspray-hitzeschutz-3-tage-glatt`

| Step | Output |
|---|---|
| Identity | C1 pack front (dm image) + C2 L'Oréal article (real directions) + C2 archived product page; possibly delisted at the manufacturer |
| Markers | T_S Phenoxyethanol r5, plausible · T_LI Phenoxyethanol r5 |
| S0 | step 1: C1 pack front leads with the result („Hitze Styling-Spray, glatt 3 Tage, starker Halt"), C2 article leads with protection ⇒ letter `claim_conflict`. **PH1-14 names the route ⇒ `styling` `smoothing_styler`.** Letter without PH1-14 even past step 1: smoothing is a Leave-in function, Dimethicone r2 + Stearyl Alcohol r3 above T_LI = care, no fixative ⇒ LI `in_category` ⇒ Leave-in could claim it ⇒ PH1-16 ⇒ **`provisional_boundary (pending_leave_in_addendum)`, lean `smoothing_styler`**, `ruled_route_override` |
| F | mechanisms `silicone_coat` [Dimethicone r2] · hold_route `absent` · weight `medium` (families d, c; no rich member); `candidate_below_tail`: Behentrimonium Chloride r7 would form an LGN pair with Stearyl Alcohol ⇒ `rich` ⇒ review · buildup no · alcohol_note no (Isopropyl Alcohol r14) · flags silicones, fragrance |
| Heat | C1 „230 °C Hitze-Schutz-Technologie"; no HP-1 member ⇒ **`false`**, shown „Hitzeschutz laut Hersteller", `heat_claim_without_l9` |
| Hold | C1 „Starker Halt" ⇒ **3** (PH1-14), stored, not used (`smoothing_styler`). D8b rule 1 **fires** (≥ stark, no hold mechanism: silicone_coat only, Stearyl Alcohol is not structuring) |
| C | primary `sleek` (gate ✓); `hold_fix` dropped (gate fails) and recorded; secondary `frizz_control` („Schutz vor Frizz & Feuchtigkeit", C1; gate ✓) · finish `unbekannt` („glatt und geschmeidig, seidig" are not finish words) · flexibility `unbekannt` · coating type `silicone_coat` |
| U | **`before_heat`** (C2: towel-dried, then blow-dry, optional flat iron — heat is a required next step) · `all` · heat_activated `no` |
| Captured | duration „GLATT 3 TAGE" · humidity „Schutz vor Frizz & Feuchtigkeit" · heat „bis zu 230 Grad" (temperature never used) |
| Triggers | `pending_leave_in_addendum`, `ruled_route_override`, `claim_formula_conflict`, `heat_claim_without_l9`, `candidate_below_tail` |

### 11.8 Bumble and bumble Brilliantine — `bumble-and-bumble-brilliantine`

| Step | Output |
|---|---|
| Identity | No German manufacturer site; Douglas (C3) and a US page (C5) only |
| Markers | T_S Ethylhexylglycerin r11 **unresolved** (booster above Phenoxyethanol r28) ⇒ R2 marker Tetrasodium EDTA r18; `unpositioned` r12–r17 (PEG-40 Castor Oil, Carbomer, Acetylated Lanolin Alcohol, Arachidyl/Myristyl Alcohol, AMP) · T_LI Ethylhexylglycerin r11 |
| S0 | step 1 **fails** (no C1/C2 promise). **D2 names it ⇒ `styling` `shine_finish`** (§4.1 exception), `claim_authority_gap`. Not held: with no C1/C2 promise, the Leave-in function conjunct cannot be established, and the C3 promise („Definition & Glanz für lebendige Styles") names no Leave-in function |
| F | mechanisms `wax_lipid` [Caprylic/Capric Triglyceride r3, Castor Oil r4, Polybutene r6, Cetyl Acetate r7] (none structuring) · hold_route `absent` · weight **`rich`** under both readings (families a, b, c; Castor Oil rich), confidence moderate · buildup **fires** (limb 2) · alcohol_note no · flags oils, fragrance |
| Heat / Hold | `false` · **`null`** (Douglas „Haltgrad leicht" is a C3 trace) · D8b: no C1/C2 hold claim ⇒ no flag |
| C | finish `unbekannt` (C3 „fantastischen Glanz" is a trace) · jobs empty + `claim_authority_gap` · shine base `wax_lipid` |
| U | **`damp_before_drying`, also `dry_restyle`** (C3 directions „im feuchten oder trockenen Haar verwenden": equal alternatives ⇒ the first-named is primary, RG-8; fingers or comb) · `all` · `no`. *Corrected in v0.2:* v0.1 read `dry_restyle` primary, against §11.2's first-named reading |
| Triggers | `claim_authority_gap`, `ruled_route_override` (evidence gate vs D2), `tail_marker_unresolved` |

### 11.9 Balea MEN Pomade Haar & Bart 2in1 — `balea-men-pomade-haar-bart-2in1`

| Step | Output |
|---|---|
| Markers | T_S Parfum r8, plausible · T_LI none visible (no preservative declared) |
| S0 | class `styling_result` („Formt & festigt individuelle Styles", house-brand C2), `li_function: no` · **non-aqueous** (no water declared) ⇒ 3.5 ⇒ **`styling` `molding`**. One route; beard use recorded only [PH1-7]. Not held (Leave-in could only say `excluded_anhydrous`) |
| F | mechanisms `wax_lipid` [structuring: Petrolatum r2, Cera Microcristallina r3, Paraffin r4; Ethylhexyl Stearate r1, Shea r5, Macadamia r6] + `particulate` [Silica r7] · hold_route `absent` · weight **`rich`** (families a, b; rich members) · buildup **fires** (limb 2) · alcohol_note no · flags oils, fragrance |
| Heat / Hold | `false` · house-brand dm attribute „mittlerer Halt" ⇒ **2** (moderate); „langanhaltenden Halt" unquantified · D8b no (structuring wax) |
| C | primary `hold_fix` (gate ✓), secondary `definition` · finish/flexibility `unbekannt` · form_label `pomade` · base `anhydrous` |
| U | `dry_restyle`, also `damp_before_drying` · `all` · `no` |
| Derived | the medically adjacent pomade caution (molding + rich/anhydrous; property set §4). „Dermatologisch bestätigte Hautverträglichkeit" is never repeated |
| Triggers | `house_brand_ownership` |

### 11.10 got2b Trockenshampoo Extra Volumen — `got2b-trockenshampoo-extra-volumen` (negative control)

| Step | Output |
|---|---|
| S0 | step 1 **fails**: the claims are dm.de copy for a third-party brand (C3) ⇒ **`provisional_boundary (evidence_gate)`, stays in its current category: Dry Shampoo.** With a C1/C2 capture, the same answer follows: refresh („schnelle Reinigung", „Bis zu 48 Stunden Frische") co-leads with volume („Extra Volumen") ⇒ §4.2 tie precedence assigns class **`refresh`** (not `mixed`, so the mixed stop is never reached) ⇒ 3.2 ⇒ **`dry_shampoo`** |
| Formula note | Oryza Sativa (Rice) Starch r4 in a non-aqueous formula (Aqua r10, tail) is PT-2 `particulate` — informational; the formula never decides the Dry Shampoo boundary |
| Emission | identity, formula, route; no Styling profile |

### 11.11 Schwarzkopf Taft Föhn-Spray VOLUMEN Halt 3 — `schwarzkopf-taft-foehn-spray-volumen-halt-3`

| Step | Output |
|---|---|
| Markers | T_S Parfum r6, plausible · T_LI Benzyl Alcohol r8 |
| S0 | class `styling_result` (C2 „verleiht Volumen und einen natürlichen Haarschwung"), `li_function: no` · aqueous · 3.4 (ii) ⇒ **`styling`** (PH2-1). Cross-check: VP/VA r3 (FX-1) above T_LI, lone Cetrimonium Chloride r5 = thin ⇒ LI G0 `excluded_styling_first` with C2 positioning „Haltegrad 3 … Halt" ⇒ `styling`. Not held. The C2 heat sentence is secondary ⇒ 3.3 does not apply |
| Subtype | `blowdry_lotion` |
| F | mechanisms `fixative_film` [VP/VA r3] · hold_route `present` · weight `light` (Cetrimonium Chloride r5 is monomeric with no fatty alcohol ⇒ no family, no LGN) · buildup no · alcohol_note **fires** (Alcohol denat. r2) · flags fragrance; fixative_family [pvp_vp] |
| Heat | C2 „hilft dabei, das Haar vor Sprödigkeit und Haarbruch zu schützen, die durch das Föhnen entstehen" = a heat-protection claim; no HP-1 ⇒ **`false`**, shown „Hitzeschutz laut Hersteller" |
| Hold | C2 Haltegrad 3 ⇒ Henkel x/5 ⇒ **2**, high |
| C | primary `volume` (gate ✓; „Volumen und … Haarschwung" — Schwung is `volume` too, RG2-6, one job), secondary `hold_fix` (✓) · finish `unbekannt` („natürlicher Haarschwung" is movement, not a finish) · flexibility `unbekannt` |
| U | **`before_heat`** (C3 dm: „in das handtuchtrockene Haar sprühen, Haare trocken föhnen") · `all` · heat_activated `no` |
| Triggers | `heat_claim_without_l9` |

### 11.12 Alcina Styling Mousse Aerosol — `alcina-styling-mousse-aerosol` (PH1-6 and PH2-5 case)

| Step | Output |
|---|---|
| Markers | T_S Caprylyl Glycol r11 **unresolved** (booster above Phenoxyethanol r13) ⇒ R2 marker Phenoxyethanol r13; `unpositioned`: Citric Acid r12 · T_LI Caprylyl Glycol r11 (in a pair) |
| S0 | class `styling_result` (C2 „Starker, flexibler Halt"), `li_function: no` · aqueous · 3.4 (ii) ⇒ **`styling`** (PH2-1). **Without PH2-1 no Leave-in state fits:** PQ-11 is LI L1, not L5, so no architecture half; and a hold promise fails `in_category`'s function conjunct |
| Subtype | `mousse` (foam) |
| F | mechanisms `humectant_only` [Panthenol r6, Propylene Glycol r10] · hold_route **`ambiguous`** (Polyquaternium-11 r5 alone, PH1-6) ⇒ `pq_only_film_former` · weight `medium` (family e: PQ-11 r5; Cetrimonium Chloride r9 without a fatty alcohol) · buildup: **fires** (limb 1 reused literally, PH2-5: PQ-11 = LI `permanent_cationic`), not under a limb-2-only reading · alcohol_note no · flags propellant, fragrance |
| Hold | C2 Hold-Faktor 5/10 ⇒ Alcina table ⇒ **2** (number beats „Starker") · D8b: no flag (`ambiguous` is in the hold-mechanism set) · neutral fact: n/a (level stated; `ambiguous` never triggers it) |
| C | flexibility `beweglich` („flexibler Halt") · finish `glänzend` (C2 „intensiven Glanz") · primary `hold_fix` (gate ✓ via `ambiguous`); `shine` claimed but dropped (no wax_lipid/silicone_coat) |
| U | `damp_before_drying` (C2: „im feuchten Haar verteilen"; blow-drying not required) · `all` · `no` |
| Triggers | `pq_only_film_former`, `tail_marker_unresolved` |

### 11.13 Redken Refreshing Curl Mist — `redken-refreshing-curl-mist` (R2-Q1 case)

| Step | Output |
|---|---|
| Identity | C2 redken.eu/de-de (promise lines, directions); INCI as captured (20 items, no flags) |
| Markers | T_S Phenoxyethanol r4, plausible · T_LI Phenoxyethanol r4 |
| S0 | name „Refreshing Curl Mist" names one job (refresh) ⇒ lead; C2 „REVITALISIERT UND REAKTIVIERT LOCKEN" and „… sofortige Revitalisierung von Locken … Für langanhaltend gestylte und gepflegte Locken" ⇒ class **`styling_result`**, not `mixed` (R2-Q1: revival is refresh, not definition; „gepflegte Locken" is a result adjective and „mit Squalan und Jojoba-Öl angereichert" an ingredient call-out — no care job). `li_function: yes` (curl revival) · aqueous · 3.4 (i) no fixative · 3.4 (iii) LI G0 `in_category` (curl support, no L5) ⇒ **D6**: no FX above T_LI ✓; no real care — above T_LI only Aqua, Propylene Glycol r2, Glycerin r3 (HU-1); Polyquaternium-6 r7 sits below the yardstick Citric Acid r5 (first PH-1 after T_LI) ⇒ not care, `care_below_dose_yardstick`; jojoba r11 and squalane r12 sit after the preservative ⇒ not care ✓; styling-look promise ✓ ⇒ **`styling` `refresher`** [R2-Q1, D6, PH1-13]. PH1-16: the LI letter claims it ⇒ **`provisional_boundary (pending_leave_in_addendum)`, lean `refresher`** |
| F | mechanisms `humectant_only` [Propylene Glycol r2, Glycerin r3] · hold_route `absent` · weight `light`; `candidate_below_tail`: Polyquaternium-6 r7 (a cationic-polymer family and buildup limb 1), jojoba r11, squalane r12 ⇒ review · buildup no · alcohol_note no · flags oils, fragrance |
| Heat / Hold | no heat claim ⇒ `false` · no hold claim ⇒ **`null`**; „bis zum 7. Tag, ohne Haarwäsche" is a duration ⇒ `captured_claims` |
| C | primary `refresh` (gate ✓); „Sprungkraft" would be `volume` (RG2-6, RG2-16) but fails the gate (humectant_only) ⇒ dropped and recorded · finish `unbekannt` („natürliche Bewegung" is movement) · flexibility `unbekannt` · refresher type `humectant_only` · free-from „silikonfrei" captured |
| U | **`dry_restyle`** („In die trockenen Längen und Spitzen sprühen und sanft einkneten": a named shaping act, RG2-8), confidence high · target_zone **`lengths`** (the only site) · heat_activated `no` („entweder lufttrocknen lassen oder föhnen" = optional) |
| Triggers | `pending_leave_in_addendum`, `care_decided_below_preservative`, `care_below_dose_yardstick`, `candidate_below_tail` |

### 11.14 Wella EIMI Fresh Up — `wella-eimi-nutricurls-fresh-up` (R2-H1 case)

| Step | Output |
|---|---|
| Identity | confirmed name „EIMI Nutricurls Fresh Up" (pack front „FRESH UP 72H / NUTRICURLS / EIMI"; wella.com DE „EIMI Fresh Up"); „Curl Refreshing Detangling Spray" is the retailer title (C3), never the confirmed name. Promise lines, hold („Haltegrad 1"), directions: wella.com/professional/de-DE (**C2**, A9 — re-stamped from lookfantastic.de). INCI: the 29-item retailer list (lookfantastic.de, C3; also beautyflash.co.uk) is the formula of record; the list on the Wella DE page (Ceresin, Petrolatum, Carnauba, iron oxides; no jojoba, no wheat) is a **page error** (A10) ⇒ review `formula_source_page_error` until a pack INCI is captured |
| Markers | T_S Phenoxyethanol r6, plausible · T_LI Phenoxyethanol r6 |
| S0 | lead: no single job word in the confirmed name ⇒ first C2 line „Frische deine Locken auf und erhalte Definition, Glanz und Anti-Frizz-Effekt." ⇒ class **`styling_result`**, not `mixed` (R2-H1: no care job at C1/C2 — „Detangling"/„entwirrend" is C3 only; „Locken reaktivieren" is refresh, R2-Q1; the „pflegt, definiert" sentence on the page is line-level text of the EIMI Nutricurls „Nourish-In Complex" block, not this product's promise). `li_function: yes` · aqueous · 3.4 (i) not a curl cream · 3.4 (iii) LI G0 · **D6**: no FX above T_LI (PVP r9, AMP-Acrylates/Allyl Methacrylate Copolymer r11 are below Phenoxyethanol r6) ✓; real care: Polyquaternium-10 r13 above the yardstick Citric Acid r17 (`care_decided_below_preservative`) ⇒ limb 2 fails ⇒ D6 does not fire ⇒ expected **`leave_in`**. No owner-named route any more: round 3 tests this reading blind |
| Triggers (expected) | `formula_source_page_error`, `care_decided_below_preservative` |

### 11.15 GUHL Locken Pflege & Styling 3in1 — `guhl-locken-pflege-und-styling-3in1` (R2-H2 case)

| Step | Output |
|---|---|
| Identity | INCI identical on the pack (C1), guhl.com (C2) and dm (24 items; Benzoic Acid r19, Sodium Benzoate r20, Potassium Sorbate r21); directions = the verbatim pack back (C1): „3in1 ANWENDUNG: 1 - Spülung: … Gründlich ausspülen. 2 - Kur: … Gründlich ausspülen. 3 - Lockencreme: Ins handtuchtrockene oder trockene Haar einarbeiten. Wie gewohnt stylen. Mit Hitzeschutz bis 220°C." (replaces the paraphrase in the round-2 cohort) |
| S0 | **R2-H2: a care product, not Styling.** Signals: the first-named use is rinse-out (Spülung, RG2-20); guhl.com shelves it under „Spülungen, Kuren & Seren"; „Der Halt entsteht dabei durch Pflege, nicht durch Fixierung."; no fixative-class polymer (FX-1…FX-4) anywhere in the list; not a D7 middle-band product (no fixative). The pack front leads „LOCKEN PFLEGE & STYLING" and „Tiefenwirksame Pflege & natürlich langanhaltende Definition" (care + definition ⇒ the R1-Q3 letter is `mixed`), but the ruling settles it: **stays in its current category**, S0 `provisional_boundary`, no Styling profile. The leave-in curl-cream use (use 3) is recorded for the Leave-in addendum |
| General reading | a care cream that can also be left in as a curl cream stays care; only a fixative-class polymer above the tail or the D7 middle band makes it Styling (§4.1, SFS-24) |

### 11.16 Balea Haarwachs Styling Stick — `balea-haarwachs-styling-stick` (R2-H3 case)

| Step | Output |
|---|---|
| Identity | house brand (dm ↔ Balea) ⇒ `house_brand_ownership`. Confirmed name **„Styling WAX STICK"** (C1 pack front; dm title „Haarwachs Styling Stick" kept as a variant). INCI = the **14-item pack list** (C1): Prunus Amygdalus Dulcis Oil r1, Mangifera Indica Seed Butter r2, Stearyl Alcohol r3, Cocos Nucifera Oil r4, Butyrospermum Parkii Butter r5, Copernicia Cerifera Cera r6, Hydrogenated Rapeseed Oil r7 (pack reads „HYRDOGENATED", transposed letters, repaired with the as-printed form kept), Hydrogenated Palm Oil r8, Persea Gratissima Oil r9, Parfum r10, Tocopherol r11, Linalool r12, Dimethyl Phenethyl Acetate r13, Vanillin r14 (the dm text had 12, with avocado after Parfum). Directions C1 pack = dm: „Mit dem Stick sparsam über das trockene Haar streichen, um abstehende Härchen zu fixieren." |
| Markers | T_S Parfum r10 (first T_S class; no preservative) |
| S0 | lead: **step 1 decides** — the name names exactly one job, Wachs/Wax (RG2-21) ⇒ molding; RG2-17 (skip job-less lines) applies only at steps 2–3 and never overrides a deciding name `[R2-H3]`. Class `styling_result`, `li_function: no` · no water ⇒ 3.5 ⇒ **`styling`**, not held |
| Subtype | **`molding`**; „einfache Fixierung" (C1) is the hold job; „glattes, glänzendes Finish" and „Ideal für den Sleek-Look" are secondary jobs; „auch gegen Babyhaare" is a secondary use (frizz control on flyaways); `target_zone` may read `surface` |
| Hold | no strength stated anywhere („Fixierung" without a strength word) ⇒ `null`, „Halt: keine Herstellerangabe" |

---

## 12. Ruled (PH2-1…PH2-6)

The six proposals of the 2026-10-10 draft (P-S1…P-S6) were ruled by Nick on 2026-10-11 as PH2-1…PH2-6 (`plans/styling-concept/02-rulings.md`, "Phase 2 research-engine rulings"). None is open; the body of this standard states each ruled rule. Six further rulings (PH2-7…PH2-12) closed ledger ambiguities (§13).

| Ruling | Former proposal | What was ruled | Where it lives | Real example |
|---|---|---|---|---|
| **PH2-1** | P-S1 | The Leave-in border check applies **only where the promise overlaps Leave-in's own definition** (care, detangling, smoothing/anti-frizz, curl support, blow-dry/heat support; LI §2.1). A C1/C2 promise of volume, hold, texture, shaping/molding or shine goes to **Styling directly**, with no Leave-in check. Overlapping promises keep the full check (T15/D6/D7). Accepted consequences: Garnier Fructis „Leave-In Spray" Diamond Sleek ⇒ Leave-in; Wella EIMI Flowing Form ⇒ `provisional_boundary` | §4.2, §4.3 (ii), §4.5, §4.6 | Balea Föhnlotion Volume Effect and the 9 "care + no polymer" volume/hold/molding products ⇒ Styling directly |
| **PH2-2** | P-S2 | The PH1-16 hold covers **every Styling route the unchanged Leave-in letter would also claim** (all D6/D7 moves and owner-named routes). Held records get the **complete** Styling profile, marked `provisional`; they count toward "≥ 5 per subtype" (reported separately) and are **not matchable/recommendable** until the Leave-in addendum is approved | §4.5, §4.7, §4.8 | Balea Locken Revitalizing Spray: profiled as a `refresher` now, live only after the addendum |
| **PH2-3** | P-S3 | **D6 applies to any format**, not only sprays (format never routes) | §4.3 D6 | Balea Locken Crunchgel ⇒ Styling `gel` (held) |
| **PH2-4** | P-S4 | The heat check (PH1-15) reads Styling's own tail marker **T_S** (the Mask rule), the stricter side. `provides_heat_protection = true` needs a C1/C2 heat claim **and** an L9 member above T_S. LI `product_tested` without an L9 member stays `false` until ruled | §6.7 | John Frieda Ansatz-Booster: heat polymer after Parfum ⇒ `false` (claim still shown) |
| **PH2-5** | P-S5 | The buildup note is reused literally, **including limb 1**: permanently charged cationics, read internally from the LI §7.6 persistence enumeration only to feed the note | §6.4 | Alcina Styling Mousse (PQ-11) gets the note |
| **PH2-6** | P-S6 | Blind lanes get a **separate sealed S0 packet** (INCI, directions, confirmed name, C1/C2 promise and heat claims with tiers; no prior routes, no hold/finish/flexibility words). Each lane classifies F/U from the blind packet using its own S0 output | §10.2 | Balea Pro Styling Cream Traumlocken: the lane sees name and C2 promise for PH1-12/D7, never the dm „mittlerer Halt" attribute |

Also ruled on 2026-10-11 (not former proposals): **PH2-7** (dm „Halt" attribute on house-brand products = C2 `house_brand`, §2.2 A4, §7.2) · **PH2-8** (weight = the exact LI WT rule, §6.3) · **PH2-9** (T_S = the full Mask rule, §3.2) · **PH2-10** (Killer.Curls ⇒ `provisional_boundary (evidence_gate)`, §4.6) · **PH2-11** (housekeeping: Langhaarmädchen Lockenwunder ⇒ Leave-in; „ausbürstbar" stays a v0 convention; the charter's dropped P1 extras are tracked as open; the calibration file stays frozen, §13) · **PH2-12** (waxes, paraffin, microcrystalline wax and lanolin are rich members for Styling `weight`, §6.3, §13 item 15).

**Round-1 rulings (2026-10-12).** After blind round 1, Nick answered the four owner questions (R1-Q1 Henkel x/5 on every Henkel leave-on format except Taft gels; R1-Q2 anti-frizz on dry, finished hair = `shine_finish`; R1-Q3 care + curl definition ⇒ `mixed`, whatever the name; R1-Q4 `heat_activated` only on the product's own heat statement) and approved the technical bundle RG-1…RG-21 and P-1…P-8 as proposed (R1-T), with RG-5 adjusted to R1-Q3. The changelog under "Version" maps each to its section.

**Round-2 rulings (2026-10-12).** After blind round 2, Nick answered the four owner questions (R2-Q1 the care half is a promised care job and curl revival is refresh, narrowing R1-H2; R2-Q2 the water-based-serum exception reads the conditioner the D6 way; R2-Q3 blind S0 masking keeps job words and masks only grading words, refining PH2-6; R2-Q4 NEQI Diamond Glass All ⇒ Leave-in, extending D3) and approved the technical bundle RG2-4…RG2-27 and P2-1…P2-6 as proposed (R2-T), with RG2-16 ruled „open" and a targeted `smoothing_styler` capture before blind round 3. The v0.3 changelog under "Version" maps each to its section.

**Post-recheck clarifications (2026-10-12).** After the re-check capture (`capture/recheck-r6.json`), Nick ruled R2-H1…R2-H6: Wella EIMI Fresh Up's lines are C2 and promise no care job, and a manufacturer page's foreign INCI is a page error (R2-H1); GUHL 3in1 is a care product (R2-H2); Balea Haarwachs Styling Stick ⇒ `molding` (R2-H3); NEQI All's INCI is complete (R2-H4); feel lines never count as the care half (R2-H5); the claim host rule (R2-H6). They close §13.2 items 2–6; the amendment table under "Version" maps each to its section.

---

## 13. Ledger ambiguities and conflicts noticed (for the record)

Each item is marked with the ruling that resolved it, or stays marked **Open**.

### 13.1 Through Phase 2 (cited elsewhere as „§13 item n")

1. **PH1-16 vs PH1-11 coverage. Resolved in part — PH2-2.** Held records are profiled completely, counted toward "≥ 5 per subtype" and reported separately; committed counts per subtype are curl_cream 1, smoothing_styler 0, refresher 1, salt_spray 2, texture_spray 2, hair_powder 3 (§4.8, hand-annotated, to be re-derived in Phase 3). **Open:** 12 cohort records fail the S0 evidence gate (C3/C5 claims only); only more captures close that, and PH1-11's "≥ 5 per subtype" may still fall short on `smoothing_styler` (held 2). *Round 2 (computed, `round-2/diff.json` `coverage_per_subtype_agreed`):* 11 of 12 subtypes reach 5 when held records count; committed below 5: curl_cream 1, smoothing_styler 0, refresher 1; `smoothing_styler` has 1 agreed record (Color Wow, held). R2-T approved a targeted `smoothing_styler` capture before blind round 3 (§4.8).
2. **Evidence gate vs owner-named examples. Resolved — PH2-10 for Killer.Curls.** Brilliantine and Color Wow (D2) and John Frieda Lockencreme Traumlocken (D7) have no C1/C2 promise; this standard routes them by their rulings (§4.1 owner-named routes). That override is limited to promise-evidence failures (no C1/C2 promise, a C1/C2 lead-promise conflict, a `mixed` reading); identity, INCI, directions and formula blocks are never lifted by a ruling, and a ruled route is never an F value (John Frieda's `hold_route` stays `ambiguous` under lexicon FX-2c). Kevin.Murphy Killer.Curls (C3 claims only) is `provisional_boundary (evidence_gate)` until a C1/C2 German claim is captured (PH2-10). **Released (RG-21):** the 2026-10 capture carries a C2 promise; D7 ⇒ styling `curl_cream`, held (PH2-2; §4.6).
3. **Routes the literal rules change versus the calibration file. Resolved — PH2-1.** `garnier-fructis-leave-in-spray-diamond-sleek-glaettungsspray` ⇒ `leave_in`; `wella-professionals-eimi-flowing-form` ⇒ `provisional_boundary (li_g0_provisional)`. The calibration file has both as Styling `smoothing_styler`; it stays frozen and is re-derived in Phase 3 (PH2-11).
4. **PH1-1 wording. Resolved — PH2-9.** T_S is the full Mask rule (preservative, perfume, declared allergens, boosters in a pair, chelators), as approved under PH1-1. It decides the marker on 8 of 70 records (all unresolved via the third limb); no value moves.
5. **PH1-15 vs LI §13.3. Resolved in part — PH2-4.** The heat binary follows PH1-15's explicit text (C1/C2 claim **and** L9 pass, read against T_S); LI §13.3's claim-alone `true` is not used. **Open:** LI's `product_tested` state (claim + exact-product test, no L9 member) stays `false` until ruled.
6. **House-brand structured attributes. Resolved — PH2-7.** dm's „Halt" attribute on Balea/alverde products is C2 `house_brand` (LI rule 6, routes to review). Levels kept: Balea Ultra Volumen 4, Pro Traumlocken 2, MEN Pomade 2, Haarpuder 3, Volumenpuder 1. The round-2 G0 lane's C3 reading of the Traumlocken attribute is superseded.
7. **Leave-in WT rule vs the property-set dry run. Resolved — PH2-8.** Weight is the exact Leave-in WT rule including the LGN-pair route to `high`/`rich`; no extra anhydrous route (§6.3). Net cohort change: two curl creams move to `rich`; no other value moves.
8. **D6 wording "sprays". Resolved — PH2-3.** D6 applies to any format.
9. **Mixed-promise detection. Not a ruling item.** The round-2 G0 lane read Balea Pro Traumlocken as `mixed` from a definition claim, a softness claim and a heat bullet. §4.2 reads `mixed` for co-equal lead jobs **and, since R1-Q3, for any C1/C2 promise covering both care and curl definition**; either way Traumlocken reaches D7 first (PH1-12). The outcome is the same either way; the definition matters for future products.
10. **"Exactly one pair rule applies"** (charter §5 step 3) does not hold for products with a secondary heat claim and an aqueous formula (11 cohort records). §4.3 selects the pair by promise class in a fixed order. Not a ruling item.
11. **Booster-above-preservative limb.** Mask's third limb fires on 7 of 70 Styling records (common in L'Oréal and salon lists). It is part of the full Mask rule ruled in PH2-9, moves no value today (§3.3), but will keep producing `tail_marker_unresolved` reviews.
12. **Calibration-file labels to re-derive, not edit. PH2-11.** `calibration-set-r2.json` stays frozen: ruled outcomes are re-derived in the Phase 3 blind round, never patched. Known labels: `balea-locken-revitalizing-spray` `application_moment` (`second_day` ⇒ `dry_restyle`), the `claim_formula_conflict` flag on the same record (duration is not hold), the stale `proposed_finish` values (property set §9 item 4), and every route listed in item 3.
13. **Langhaarmädchen Lockenwunder. Resolved — PH2-11.** Leave-in by the PH1-13 R2 rule (cationic r4 above the preservative); no longer an unnamed edge case.
14. **„ausbürstbar". Resolved — PH2-11 (convention).** Stays a v0 convention: not a flexibility word. It is not a rule of the ledger beyond that housekeeping ruling.
15. **Resolved — PH2-12 (rich-member list for `weight`).** Waxes, paraffin, microcrystalline wax and lanolin are rich members for Styling (Styling-local; they move into the Leave-in addendum after lock).
16. **Open (tracked, not lock criteria) — charter P1 extras.** The charter's dropped P1 extras (≥ 80 % shelf coverage, every pair rule exercised at least once) are tracked as open, not as lock criteria (PH2-11).

### 13.2 Open after round 2 (2026-10-12)

Contradictions or gaps the ledger did not settle after round 2. Items 2–6 were settled by the post-recheck rulings R2-H1…R2-H5 (2026-10-12; marked below, the original text kept for the record); item 1 stays open and needs a capture or a blind-round test. The round-1 items closed by R1-H1…R1-H3 and the round-2 items closed by R2-Q1…R2-Q4 and R2-T are in the changelogs under "Version"; the v0.2 item on the tier of Taft Styling Balm Locken „Halt 3" is closed by the round-2 C1 capture („HALT 3", §7.3).

1. **Untested gaps carried from RG-20 (no rule added).** Round 2 exercised FX-U on a deciding case (`john-frieda-frizz-ease-3-tage-glatt-styling-spray`, Polysilicone-9: both lanes `hair_fixing_silicone_unresolved`), `target_zone: surface` on two finishing sticks and `hairline` on two edge gels (both lanes agree), and RG2-12/RG2-18/RG2-20 closed the word and rinse-out gaps. Still untested (node over both round-2 lanes): a salt-free `salt_spray` (every agreed `salt_spray` carries a `salt` mechanism in lane A); FX-2c on a record whose route turns on it (`john-frieda-frizz-ease-traumlocken-lockencreme` carries `acrylates_copolymer_function_unresolved`, but its route rests on the D7 naming); LI COND when T_LI is `none_visible` (no such record reached 3.4 (i), 3.4 (iii), D6 or D7); §5 rule 2's undefined „gel-type shaping product". Capture still queued: a German pack for `redken-styling-beach-spray` (no C1/C2 promise, directions a paraphrase).
2. **Resolved — R2-H4.** The re-check found the list complete (pack and neqi-hair.com agree, 14 items ending „Glycerin"); the truncation flag is withdrawn, so neither R2-Q4's block nor RG2-24 applies and R2-Q4 (`leave_in`) stands without a block. The general question (does a possibly truncated list end count as a tail defect) did not need an answer. *Original item:* **NEQI Diamond Glass All: R2-Q4's block vs the RG2-24 tail-defect rule.** R2-Q4: „It stays blocked until the possibly truncated dm INCI is re-checked (P2-3)." RG2-24 (approved by R2-T): „An INCI defect confined to the tail (at or below T_S: truncation inside the allergen block, a split fragrance/oil token) does not block S0; it carries review inci_tail_defect. A defect above T_S blocks." The record's flag reads „list_possibly_truncated: dm text field … ends 'Propylene glycol, Glycerin'"; its T_S is Ethylhexylglycerin r8 (unresolved; R2 marker Hydroxyacetophenone r9), so anything missing would follow r14. This file applies R2-Q4 (the specific ruling) and keeps the record blocked. Open: whether a possibly truncated list end counts as a defect „confined to the tail" for other products.
3. **Resolved — R2-H1.** Its promise lines are on wella.com/professional/de-DE (C2); „Detangling"/„entwirrend" is C3 retailer text only, so no C1/C2 care job is promised and the „Definition" lines cannot make it `mixed`; the border ingredient checks (D6/T15) decide in round 3 (§4.6, §11.14). The INCI printed on Wella's DE page is a page error (§2.2 A10). *Original item:* **Wella EIMI Nutricurls Fresh Up: R2-Q1's named outcome vs its own „Definition" line.** R2-Q1: „Wella Nutricurls Fresh Up ⇒ Leave-in by D6 (after its tier re-stamp, P2-6)" and „the definition half needs „definiert"/„Definition"". The record's name is „Curl Refreshing Detangling Spray" (a care job under R2-Q1), and its captured lines include „Frische deine Locken auf und erhalte Definition, Glanz und Anti-Frizz-Effekt." (typed `other`) and „Definition und Glanz" (typed `finish`). All its promise lines come from lookfantastic.de, re-stamped C3 by P2-6, so today it stops at the evidence gate. Open: whether a „Definition" line in a future C1/C2 capture makes it `mixed` (R1-Q3 / R2-Q1 letter) or the R2-Q1 example (`leave_in`) stands.
4. **Resolved — R2-H2.** GUHL 3in1 is a care product, not Styling; it stays in its current category (its leave-in curl-cream use is recorded for the Leave-in addendum). General reading: a care cream that can also be left in as a curl cream stays care; only a fixative-class polymer or the D7 middle band makes it Styling (§4.1). S0 needs no rinse-out exit: the record stays `provisional_boundary` in its current category. *Original item:* **GUHL 3in1: RG2-20 picks a rinse-out first-named use.** RG2-20 (approved by R2-T): „When directions offer leave-on and rinse-out uses, the first-named use decides the category; the other is recorded (PH1-7 one route)." `guhl-locken-pflege-und-styling-3in1` directions: „3 uses. Spülung: in nasse Längen, kurz einwirken, ausspülen. Kur: 3-5 min einwirken, ausspülen. Lockencreme: … (leave-in)". The first-named use is a rinse-out conditioner, which is none of the S0 routes (§4.0), while the registry keeps the product at `provisional_boundary (mixed_promise)` under R1-Q3 (§4.6). Both keep it in its current category under review; open: which reading the record carries and whether S0 needs a rinse-out exit.
5. **Resolved — R2-H3.** The name step (§4.2 step 1, RG2-21) precedes RG2-17; the stick (pack name „Styling WAX STICK") ⇒ `molding`; INCI from the pack (14 items) (§4.6, §11.16). *Original item:* **Balea Haarwachs Styling Stick: RG2-21 vs RG2-17.** RG2-21: „The product-type noun (Haarspray, Gel, Wachs, Puder, Schaumfestiger) names the job when it is the only job noun". RG2-17: „A lead line with no job word is skipped; the next C1/C2 line with a job word is the lead." The confirmed name „Haarwachs Styling Stick" has one product-type noun (Wachs), so step 1 could decide the lead from the name (a `molding` reading); RG2-17 was written for the same product (sealed slot 2), whose first line „Haarwachs-Stift für trendige Styles" it treats as job-less, so the lead becomes „Für ein glattes & glänzendes Finish" (`shine_finish`, both lanes). Open: whether a product-type noun in the name decides at step 1 when later C1/C2 lines name a more specific job.
6. **Resolved — R2-H5.** Feel lines never count as the care half (R2-Q1), incl. „Verbesserte Geschmeidigkeit"; Balea Pro Traumlocken keeps `curl_cream` via D7 before the mixed stop (PH1-12) (§11.2). *Original item:* **„Verbesserte Geschmeidigkeit" (Balea Pro Styling Cream Traumlocken, §11.2).** R2-Q1: „An adjective on the result („gepflegte Locken") or an ingredient/feel call-out does not count (SFS-15)." The RG2-1 proposed text approved with it says „It is not … a feel line („Verbesserte Geschmeidigkeit" stays care only where §11.2 says so)". §11.2 reads the line as part of a `mixed` promise. The route is the same either way (D7 fires before or at 3.4 (i)); open: whether §11.2's `mixed` reading stands as an exception or the class reads `styling_result`.

## 14. What this standard does not do, and what comes next

- It approves no product and authorises no catalog, Supabase, intake, matcher or copy change (charter §16). User-facing strings appear only where a ruling already fixed them (PH1-3, PH1-4 copy reused from Leave-in; „Hitzeschutz laut Hersteller", „Halt: keine Herstellerangabe", „Enthält Stylingpolymere" from PH1-15/D8/D8b).
- It sets no need tier, plan composition or ranking (SD4, D4, D5, D8 ranking are matching policy, charter §14).
- Rerun obligation: any change to a deterministic rule here or to a deterministic lexicon family re-derives every affected record (Mask rerun obligation); agreement statements never carry across a systemic change.

**Next (Phase 3, as planned before round 1; round 1 has run):** capture fills the evidence-gate gaps (Killer.Curls needs a C1/C2 German claim, PH2-10) and the short subtypes (charter §15 P1 (a)); re-derive the §4.8 counts and every route in §13 item 3 under PH2-1/PH2-2; freeze the S0 packet (PH2-6) and the F/U packets; blind calibration round 1 with two sealed lanes plus two claim normalisations; diff; owner rulings on disagreements; ≥ 6 unseen products with ≥ 2 boundary traps (candidates: a salt-free beach spray, a `target_zone: surface` product, a C1/C2 `fest` claim — the three ruled-but-uncalibrated values, property set §9 item 7); draft and queue the Leave-in addendum (PH1-16).

**Next after round 1 (v0.2):** the re-captures behind P-1…P-8 and RG-13 (dm attribute for Balea Ultra Volumen and Power Flex, full got2b pack name, Elnett 3 Tage Glatt real directions and pack-front line, A5 re-stamp of Langhaarmädchen, Glow & Care INCI separator and GTIN duplicate check, editor annotations out of claim text, Glow&Shine promise re-read, got2b and Taft Paste pack re-reads); re-freeze the S0 and F/U packets under v0.2; blind round 2 on every record a v0.2 change touches (rerun obligation); owner rulings on §13.2.

**Status of the round-2 next steps (2026-10-12):** §13.2 items 2–6 are settled by R2-H1…R2-H5 and the host question by R2-H6; the `smoothing_styler` capture (`capture/round3-smoothing-r5.json`, 4 products) and the re-check (`capture/recheck-r6.json`) are done; the round-3 freeze (`build/freeze-cohort-r3.js` ⇒ `r3/`) applies P2-1…P2-6 and the R2-H data. Remaining: blind round 3, owner rulings on what it finds, the Leave-in addendum.

**Next after round 2 (v0.3):** the data fixes behind P2-2…P2-6 (gotGloss re-freeze; ship `inci_flags` in the S0 packet; the freeze re-joins and renumbers split tokens; Hair Jelly „soft"; re-stamps of lookfantastic.de, redken.co.uk and kevinmurphy.com.au/de/de); re-freeze the S0 packet under the R2-Q3 masking lists for the affected records only; the targeted `smoothing_styler` capture (R2-T); NEQI Diamond Glass All's INCI re-check; re-run every record a v0.3 change touches (rerun obligation); blind round 3; owner rulings on §13.2; draft and queue the Leave-in addendum (PH1-16).
