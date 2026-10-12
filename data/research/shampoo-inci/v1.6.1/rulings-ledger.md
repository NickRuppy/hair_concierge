# Shampoo v1.6.1 — Nick's rulings ledger

Snapshot at lock (2026-10-12) of every ruling Nick made for v1.6.1, taken from `plans/shampoo-v161/plan.md` (*Scope* and *Rulings during the candidate phase*), the decided pre-registration items (rule-changes rows 131–137) and the test-round run log. One entry per decision, in the order they were made. Rulings R1–R17 of v1.6 stay in force unchanged (`data/research/shampoo-inci/v1.6/rulings-ledger.md`). Row numbers refer to `docs/research/shampoo-inci/v1.6.1/rule-changes.md`.

## P — Plan: v1.6.1 as its own version (2026-10-12)

Nick: "yes to A, do v1.6.1 in its own worktree". The selenium-sulfide evidence, the contradiction audit, the weight-method comparison and the surfactant-class evidence from the profi-shampoos wave become a new version, v1.6.1, with its own test round and lock receipt. v1.6 stays frozen and pinned.

## S1 — Selenium sulfide is a recognized anti-dandruff active (2026-10-11/12, rulings B and C)

`Selenium Sulfide` / `Selenium Disulfide` joins `Piroctone Olamine` and `Climbazole` in Section 11 (EU cosmetic use ≤ 1 %, micronized 0.6 % included). Evidence: `evidence/evidence-selenium-sulfide-2026-10-11.md`. Implemented as DS1 (rows 117, 118). No separate review code for the EU label warning; the warning belongs to a later user-copy step (see *Defaults accepted*).

## S2 — W-LINE: a materiality line for weight (2026-10-12, rulings A and 1)

"Material" for W-RICH, W1 (c) and the `high` convergence route means listed before the earliest *plausible* marker: a capped preservative or active, Parfum or a declared allergen, a typical sub-1 % active, or the alphabetical tail; with a plausibility test; never later than E3; fallback = the v1.6 reading. C2 and Section 5 keep E3; a W-line for C2 (Option B) is out of scope. Evidence: `evidence/weight-method-comparison-2026-10-12.md` (leave-in and mask precedent). Rows 119–124. Narrowed to lipids by *W-LINE scope* below.

## S3 — "fettiges Haar" in the oily-scalp lexicon (2026-10-12, ruling 2)

"fettiges Haar" counts like "schnell fettendes Haar" (contradiction audit, Aveda Rosemary Mint). Row 125. Extended by *Defaults accepted* ("fettendes Haar" counts).

## S4 — Four named surfactant classes (2026-10-12, ruling 4)

`Sodium Methyl 2-Sulfolaurate` / `Disodium 2-Sulfolaurate` = mild anionic; `Sulfated Castor Oil` = not a cleansing route; `Cocamidopropylamine Oxide` = amphoteric buffer; `Sodium Laureth-8 Sulfate` = strong anionic with a high-EO counter-signal. Evidence: `evidence/evidence-surfactant-classes-2026-10-12.md`. Rows 126–129.

## Scope — the R16.4 closed-list batch becomes v1.6.2 (2026-10-12)

The E4 / C2 humectant / CSA closed-list additions need the Track A/B `unlisted_route_candidate` collection, which has not run yet. Nick: v1.6.1 goes ahead now; the closed-list batch becomes v1.6.2 after the Track A/B collection. Also out of scope: lipid banding (v1.7 candidate) and a W-line for C2 (Option B).

## Alkanolamide breadth — option (a) (2026-10-12)

Candidate open question 1: every alkanolamide-type thickener (plain, PPG-n hydroxyethyl, PEG-n cocamide) makes an earlier W-line candidate implausible. Expected then: Maria Nila Pure Volume stays `high`, Head & Hair Heal `moderate` → `high`, Vichy Ultra-Sensitiv `high` → `moderate` (the last expectation was withdrawn by *W-LINE scope*). Row 120.

## Defaults accepted (2026-10-12)

Nick, no objection to the candidate defaults: "fettendes Haar" counts (S3); a pack-front claim counts at pack grade whatever its language (consistent with the 2026-10-12 System Professional P4 ruling); the heavier reading when no marker is visible (`w_line_none_visible`); alphabetical runs from 7 entries; sulfated castor oil stays cautious; no separate selenium-sulfide review code (the EU label warning belongs to a later user-copy step).

## W-LINE scope — `payload_lipid` only, option (a) (2026-10-12)

Pre-registration finding A13 Hair Biology: the W-line decides materiality for `payload_lipid` only (oils, butters, waxy lipids; the W-RICH lipid leg and W1 (c)). Silicones and cationic deposition systems keep the v1.6 / v1.4-final position-independent treatment, because they deposit at low dose. Keeps the Aug-26 approval for Hair Biology reachable; Vichy Ultra-Sensitiv expected to stay `high`. Row 130; rows 119, 121, 122 and 124 amended to match.

## D1–D6 — Pre-registration decisions (2026-10-12)

The six defects found while pre-registering the test round, decided before any lane ran (`test-round/pre-registration.md`, section 5):

- **D1** A claim printed on the exact product's pack is graded at its pack grade in any language (`pack_front` high, `pack_back` moderate); the foreign-language downgrade applies to manufacturer web pages only; E2 gains a closed list of English equivalents for `dandruff` and `oily` (row 131).
- **D2** The W-LINE allergen candidates are the classic 26 Annex III fragrance allergens, named by INCI; the 2023/1545 additions do not count (row 133).
- **D3** The E3 marker is always itself a W-line candidate; `w_line_fallback_e3` only when nothing up to and including it is plausible; `w_line_none_visible` only without a marker; never both (row 134).
- **D4** Split synonym entries are merged per ID-2 before any W-line position is counted (row 132).
- **D5** `Capryloyl Glycine` (any free-acid acyl amino acid) is not a W-line candidate (row 135; its surfactant status is closed by R2 below).
- **D6** `Sulfated Castor Oil` has no weight family; it is recorded as excluded (row 136).

## R1–R4 — Clarifications of the W-LINE scope ruling and D5 (2026-10-12, before any lane ran)

Orchestrator clarifications that carry Nick's *W-LINE scope* ruling (a) and D5 into the text; not new rulings (row 137; pre-registration addendum):

- **R1** Silicones and cationics keep the v1.6 deposition/persistence judgment exactly (a late trace may still be weak evidence); nothing in v1.6.1 makes a late silicone or cationic stronger than v1.6 did.
- **R2** An ingredient in no C3 class (for example `Capryloyl Glycine`) is not a cleansing surfactant for the W-LINE plausibility test (P34 W-line @19).
- **R3** `payload_lipid` membership stays as in 6.3/6.4.
- **R4** "oily dandruff" is a dandruff claim, not an oily claim.

## Lock — Test-round adjudication and lock (2026-10-12)

Nick: "Sounds good. lets goo". The sealed two-lane test round passed: 23 products, 379/391 = 96.9% lane agreement, every pre-registered movement happened, and the only departures from the registration (P40 lane A, the U4 baseline) were adjudicated below (`test-round/run-log.md`, `test-round/compare-output.txt`). Adjudication, cause-coded, no rule change:

- **P40 Moroccanoil Clarifying (VT09):** lane A `high`, lane B `moderate`. Lane A counted two trace cationics (@26/@30) as a full W-RICH partner, contrary to R1 (both v1.6 lanes `moderate`). Product correction → `moderate` (lane B). The product is ruled a deep cleanser in the profi wave anyway.
- **U4 Wahre Schätze Aktivkohle:** registered `low`, both lanes `moderate` (guar + Nigella oil @5, material under either reading). Not a v1.6.1 effect; the `low` baseline is a round-1 record from before the full weight method was merged. Baseline artifact; no rule action.
- **A13 Hair Biology:** both lanes `moderate` (`high` reachable, not reached), against the Aug-26 approved `high` (the v1.4 rerun-v3 was also `moderate`). Goes to Nick's flagged review in the Track A re-check; not a v1.6.1 question.
- The remaining differences are research-only properties (focus, secondary focus, comfort, combination): cautious value (P0), no live effect.

Decision: pass; lock v1.6.1.

## Note — Long-term direction (2026-10-12, not part of v1.6.1)

Nick, separate exploration: outcome-calibrated weight (retailer review mining) and a shared concentration-bounds / deposition-potency module across engines, as a v1.7 candidate.
