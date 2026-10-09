# Styling ingredient research

Status: **Phase 1 — category charter drafted, not ruled, not locked (2026-10-09).** No classification standard, evidence lexicon, calibration lanes or production adapter exist yet. This is not matching logic and authorizes no catalog, Supabase, Product Intake or production change.

This directory is the durable entry point for the Styling (one category key `styling`, 12 subtypes) ingredient-classification work. As in every engine, formula-derived product research is kept separate from user fit, and both are kept separate from catalog or production activation.

## Versioning note

The folder `v1.0/` is the **artifact root version**. When a classification standard is written, it will carry its own semantic version (`styling-inci-v0.x` until a logic lock). This follows the Mask and Leave-in convention.

## Start here

1. Read the [category charter](./v1.0/00_category_charter.md): the definition, the 12 subtypes, the S0 routing gate, market and claim authority, the research unit, the medical boundary, the evidence ceiling, non-goals, and the coverage and stop conditions.
2. Read the owner rulings in `plans/styling-concept/02-rulings.md`. They govern wherever another document differs.

## What is authoritative

| Layer | Location | Purpose |
| --- | --- | --- |
| Category boundary + market | `v1.0/00_category_charter.md` | Phase 1 charter; four open proposals (§15) and one ruling conflict (§13 item 7) |
| Owner rulings ledger | `plans/styling-concept/02-rulings.md` | SD1–SD5 and D1–D8b (Nick, 2026-10-09) |
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
| D2 | Oil ↔ Styling by product name: „Öl"/„Serum" → Oil. |
| D3 | T15 stays the Leave-in ↔ Styling border. |
| D4, D5 | Need tier and plan composition: matching policy, referenced only. |
| D6 | No real care + no fixative-class hold + a styling-look promise → Styling. |
| D7 | Curl-cream middle band: the name decides. |
| D8, D8b | Hold level is claim-only, never guessed and never a reason to exclude; internal plausibility flag; neutral „Enthält Stylingpolymere" fact. |

## Next phases

Phase 2 property set → Phase 3 evidence lexicon → Phase 4 standard and calibration (two sealed blind lanes) → Phase 5 logic lock. The lock also needs a Leave-in overlay that encodes D6 and D7 (charter §13 item 1). A production adapter is a separate, explicitly approved step after the lock.
