# Styling ingredient research

Status: **Standard v0.4 (2026-10-13), after blind calibration round 3; next: the pack-name and Elnett-directions captures (R3-T), the round-4 freeze, the confirmation round 4 under R3-L, then the Leave-in addendum draft.** The charter, property set, evidence lexicon v0.4 and classification standard v0.4 exist and encode Nick's rulings SD1–SD5, D1–D8b, PH1-1…16, PH2-1…12, the round-1 rulings R1-Q1…R1-Q4, R1-T, R1-H1…R1-H3, the round-2 rulings R2-Q1…R2-Q4, R2-T, R2-H1…R2-H6 and the round-3 rulings R3-L, R3-Q1…R3-Q4, R3-H and R3-T. They are **not calibrated and not locked**: blind round 1 ran on the v0.1 rules (`data/research/styling-inci/v1.0/round-1/`), blind round 2 on the v0.2 rules (`round-2/`), blind round 3 on the v0.3 rules (`round-3/`); the lock criteria (PH1-11 as adjusted by PH1-16, R3-L and R3-Q1; standard §14.1) are not met, and no production adapter exists. This is not matching logic and authorizes no catalog, Supabase, Product Intake or production change.

This directory is the durable entry point for the Styling (one category key `styling`, 12 subtypes) ingredient-classification work. As in every engine, formula-derived product research is kept separate from user fit, and both are kept separate from catalog or production activation.

## Versioning note

The folder `v1.0/` is the **artifact root version**. The classification standard carries its own semantic version (`styling-inci-v0.x` until a logic lock). This follows the Mask and Leave-in convention.

## Start here

1. Read the [category charter](./v1.0/00_category_charter.md): the definition, the 12 subtypes, the S0 routing gate, market and claim authority, the research unit, the medical boundary, the evidence ceiling, non-goals, and the coverage and stop conditions.
2. Read the owner rulings in `plans/styling-concept/02-rulings.md`. They govern wherever another document differs.

## What is authoritative

| Layer | Location | Purpose |
| --- | --- | --- |
| Category boundary + market | `v1.0/00_category_charter.md` | Phase 1 charter; proposals P1–P4 ruled (PH1), hold scope, route agreement and Lockenwunder closed by PH2 (§15.2) |
| Property set | `v1.0/01_property-set-v0.md` | Ruled (PH1-1…6, PH1-15); Phase 2 items closed by PH2-2, 4, 5, 6, 8, 9, 11, 12 (§9, §2.1, §7); updated in place for the round-1 rulings (version note, §9 items 16–20), the round-2 rulings (version note v0.3, §9 items 21–24) and the round-3 rulings (version note v0.4, §9 items 25–28) |
| Evidence lexicon | `v1.0/02_evidence_lexicon.v0.4.md` | v0.4 (`styling-lexicon-v0.4`); adds RG3-17 (PEG/PPG amodimethicones CA-4; four WL-7 emollients; Polyurethane-34/-48 and AMP-Acrylates/Allyl Methacrylate Copolymer FX-U; two RH-1 thickeners), RG3-6 (Benzyl Alcohol at or after Parfum is never T_LI) and RG3-15 (missing space/slash repaired by the freeze) to v0.3 |
| Evidence lexicon (round-3 version) | `v1.0/02_evidence_lexicon.v0.3.md` | v0.3 (`styling-lexicon-v0.3`), unchanged; the version blind round 3 ran on; added RG2-23 and RG2-24 to v0.2 |
| Evidence lexicon (round-2 version) | `v1.0/02_evidence_lexicon.v0.2.md` | v0.2 (`styling-lexicon-v0.2`), unchanged; the version blind round 2 ran on; added RG-1 and RG-16 to v0.1 |
| Evidence lexicon (round-1 version) | `v1.0/02_evidence_lexicon.v0.1.md` | v0.1 (`styling-lexicon-v0.1`), unchanged; the version blind round 1 ran on |
| Classification standard | `v1.0/styling-classification-standard.md` | v0.4 (`styling-inci-v0.4`), round-3 rulings folded in 2026-10-13 (changelogs under "Version"; open items §13.2, §13.3; lock criteria §14.1); not calibrated, not locked |
| Owner rulings ledger | `plans/styling-concept/02-rulings.md` | SD1–SD5, D1–D8b, PH1-1…16 (Nick, 2026-10-09), PH2-1…12 (2026-10-11), R1-Q1…R1-Q4, R1-T, R1-H1…R1-H3, R2-Q1…R2-Q4, R2-T, R2-H1…R2-H6 and R3-L, R3-Q1…R3-Q4, R3-H, R3-T (2026-10-12) |
| Blind round 1 | `data/research/styling-inci/v1.0/round-1/` (`diff.json`, `report.md`) | Two sealed lanes on the frozen v1.0 cohort (107 records); rule gaps RG-1…RG-21, packet issues P-1…P-8, owner questions Q1–Q4 |
| Blind round 2 | `data/research/styling-inci/v1.0/round-2/` (`diff.json`, `report.md`); cohort `r2/cohort.json` | Two sealed lanes on the frozen round-2 cohort (139 records); rule gaps RG2-1…RG2-27, packet issues P2-1…P2-6, owner questions Q1–Q4 |
| Blind round 3 | `data/research/styling-inci/v1.0/round-3/` (`diff.json`, `report.md`); cohort `r3/cohort.json` | Two sealed lanes on the frozen round-3 cohort (143 records); rule gaps RG3-1…RG3-24, packet issues P3-1…P3-7, owner questions Q1–Q4, lane errors E3-1…E3-10 |
| Concept | `plans/styling-concept/01-styling-concept.md` | Rev. 2: definition, S0, subtypes, property candidates, hold scale, matching sketch |
| Plan-composition evidence | `plans/styling-concept/03-d5-evidence.md` | Evidence behind D5 (one product per job) |
| Calibration set | `data/research/styling-inci/concept-v0/calibration-set-r2.json` (built by `build-calibration-r2.js`) | 90 products: 70 Styling, 5 `provisional_boundary`, 15 routed to a neighbour |
| Round-2 lanes | `data/research/styling-inci/concept-v0/round2/` | Claim freeze (F1–F3), gap fill (G1–G2), Leave-in G0 border verdicts, hold research, `SUMMARY.md` |
| Round-1 samples | `data/research/styling-inci/concept-v0/samples/`, `calibration-set.json` | 72 unique products (77 records); historical |
| Inherited method | `docs/research/leave-in-inci/v1.0/leave-in-classification-standard.md` | G0 (§2.3, §2.3.2, T15), identity and claim authority (§2.4–§2.4.2), L5 fixatives, HOLD and T7 (§7.7) |

## Rulings the charter rests on

| # | Ruling |
| --- | --- |
| SD1–SD5 | All styling families plus the overlap types; one key `styling` with subtypes; non-oil shine goes to Styling (narrowed by D2); optional by default (refined by D4); Chaarlie's own hold scale. |
| D1 | 12 subtypes (merges into `blowdry_lotion` and `molding`; edge control becomes a zone). |
| D2 | Oil ↔ Styling by product name: „Öl"/„Serum" → Oil (retailer-title product-type noun as the fallback name, R3-Q2). |
| D3 | T15 stays the Leave-in ↔ Styling border. |
| D4, D5 | Need tier and plan composition: matching policy, referenced only. |
| D6 | No real care + no fixative-class hold + a styling-look promise → Styling. |
| D7 | Curl-cream middle band: the name decides (extended to straightening/smoothing creams by R3-Q4). |
| D8, D8b | Hold level is claim-only, never guessed and never a reason to exclude; internal plausibility flag; neutral „Enthält Stylingpolymere" fact. Conflicting C1/C2 strengths ⇒ the middle level, rounded up (R3-H). |

## Next phases

Captures approved by R3-T (real pack names of the retailer-title-only products; Elnett 3 Tage Glatt German directions) and data fixes P3-1…P3-6 → round-4 freeze under v0.4 → confirmation round 4 under R3-L (only lane errors, no new rule gaps) → owner rulings on standard §13.3 → Leave-in addendum drafted and queued (PH1-16; carries D6, D7 and the R3-Q4 extension) → logic lock under the criteria in standard §14.1. A production adapter is a separate, explicitly approved step after the lock.
